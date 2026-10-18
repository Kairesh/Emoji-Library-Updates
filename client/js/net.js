/**
 * Unified Rock-Solid Network Requester for Adobe CEP
 * Uses Node.js https/http inside Adobe CEP to completely bypass CORS and Chromium sandbox limits.
 */
const Net = (function () {
    const isNode = (typeof window !== "undefined" && !!window.require) || (typeof process !== "undefined" && !!process.versions?.node);
    let https = null;
    let http = null;
    let fs = null;

    if (isNode) {
        try {
            const reqFn = (typeof window !== "undefined" && window.require) ? window.require : require;
            https = reqFn("https");
            http = reqFn("http");
            fs = reqFn("fs");
        } catch (e) {
            console.warn("Net: Node modules unavailable, falling back to browser fetch", e);
        }
    }

    function request(urlStr, options = {}) {
        if (isNode && https && http) {
            return new Promise((resolve, reject) => {
                try {
                    const u = new URL(urlStr);
                    const isHttps = u.protocol === "https:";
                    const client = isHttps ? https : http;
                    const reqOptions = {
                        hostname: u.hostname,
                        port: u.port || (isHttps ? 443 : 80),
                        path: u.pathname + u.search,
                        method: options.method || "GET",
                        headers: Object.assign({
                            "Accept": "*/*"
                        }, options.headers || {})
                    };

                    const req = client.request(reqOptions, (res) => {
                        // Follow redirects (301, 302, 307, 308)
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            const redirectUrl = new URL(res.headers.location, u).toString();
                            return resolve(request(redirectUrl, options));
                        }

                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || ''} for ${urlStr}`));
                        }

                        const chunks = [];
                        res.on("data", (chunk) => chunks.push(chunk));
                        res.on("end", () => {
                            const buffer = Buffer.concat(chunks);
                            resolve(buffer.toString("utf8"));
                        });
                    });

                    req.on("error", (err) => reject(err));
                    req.setTimeout(12000, () => {
                        req.destroy();
                        reject(new Error(`Request timed out: ${urlStr}`));
                    });
                    req.end();
                } catch (e) {
                    reject(e);
                }
            });
        }

        // Browser fetch fallback
        return fetch(urlStr, { cache: "no-store" }).then(res => {
            if (!res.ok) throw new Error(`Fetch HTTP ${res.status}`);
            return res.text();
        });
    }

    async function getJSON(urlStr) {
        const text = await request(urlStr, {
            headers: { "Accept": "application/json" }
        });
        return JSON.parse(text);
    }

    function downloadFile(urlStr, destPath, onProgress) {
        if (isNode && https && http && fs) {
            return new Promise((resolve, reject) => {
                try {
                    const u = new URL(urlStr);
                    const isHttps = u.protocol === "https:";
                    const client = isHttps ? https : http;
                    const reqOptions = {
                        hostname: u.hostname,
                        port: u.port || (isHttps ? 443 : 80),
                        path: u.pathname + u.search,
                        headers: {
                            "Accept": "*/*"
                        }
                    };

                    const req = client.request(reqOptions, (res) => {
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            const redirectUrl = new URL(res.headers.location, u).toString();
                            return resolve(downloadFile(redirectUrl, destPath, onProgress));
                        }

                        if (res.statusCode !== 200) {
                            return reject(new Error(`Download HTTP ${res.statusCode} for ${urlStr}`));
                        }

                        const total = parseInt(res.headers['content-length'] || "0", 10);
                        let downloaded = 0;
                        const fileStream = fs.createWriteStream(destPath);

                        res.on("data", (chunk) => {
                            downloaded += chunk.length;
                            fileStream.write(chunk);
                            if (total > 0 && onProgress) {
                                onProgress((downloaded / total) * 100);
                            }
                        });

                        res.on("end", () => {
                            fileStream.end();
                            fileStream.on("finish", () => resolve(destPath));
                        });

                        res.on("error", (err) => {
                            fileStream.close();
                            fs.unlink(destPath, () => {});
                            reject(err);
                        });
                    });

                    req.on("error", (err) => {
                        fs.unlink(destPath, () => {});
                        reject(err);
                    });
                    req.setTimeout(60000, () => {
                        req.destroy();
                        fs.unlink(destPath, () => {});
                        reject(new Error("Download timed out"));
                    });
                    req.end();
                } catch (e) {
                    reject(e);
                }
            });
        }

        return Promise.reject(new Error("Node fs is required for local file download"));
    }

    return {
        get: request,
        getJSON: getJSON,
        downloadFile: downloadFile
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = Net;
} else {
    window.Net = Net;
}
