/**
 * Auto-Updater for Emoji & Icon Studio
 * Powered by GitHub repository releases & version.json
 */
const PluginUpdater = (function () {
    const fs = (typeof window !== "undefined" && window.require) ? window.require('fs') : (typeof require !== "undefined" ? require('fs') : null);
    const path = (typeof window !== "undefined" && window.require) ? window.require('path') : (typeof require !== "undefined" ? require('path') : null);
    const os = (typeof window !== "undefined" && window.require) ? window.require('os') : (typeof require !== "undefined" ? require('os') : null);
    const cp = (typeof window !== "undefined" && window.require) ? window.require('child_process') : (typeof require !== "undefined" ? require('child_process') : null);

    const MANIFEST_URLS = [
        "https://raw.githubusercontent.com/Kairesh/Emoji-Library-Updates/main/version.json",
        "https://cdn.jsdelivr.net/gh/Kairesh/Emoji-Library-Updates@main/version.json"
    ];

    function getInstalledVersion() {
        try {
            if (typeof csInterface !== "undefined" && path && fs) {
                let extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
                if (extDir.startsWith("file://")) extDir = extDir.slice(7);
                extDir = decodeURIComponent(extDir);
                if (extDir.charAt(0) === '/' && extDir.charAt(2) === ':') extDir = extDir.slice(1);

                const manifestPath = path.join(extDir, "CSXS", "manifest.xml");
                if (fs.existsSync(manifestPath)) {
                    const xml = fs.readFileSync(manifestPath, 'utf8');
                    const m = xml.match(/ExtensionBundleVersion="([^"]+)"/);
                    if (m && m[1]) return m[1];
                }
            }

            const stored = localStorage.getItem('kairesh_installed_version');
            if (stored) return stored;
        } catch (e) {
            console.warn("getInstalledVersion warning:", e);
        }
        return "2.8.0";
    }

    function compareVersions(v1, v2) {
        const parts1 = (v1 || "0.0.0").split('.').map(p => parseInt(p, 10) || 0);
        const parts2 = (v2 || "0.0.0").split('.').map(p => parseInt(p, 10) || 0);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }

    async function fetchManifest() {
        // 1. Primary: GitHub Contents API (Real-time, zero CDN caching)
        try {
            const apiRes = await Net.request("https://api.github.com/repos/Kairesh/Emoji-Library-Updates/contents/version.json?ref=main", {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AdobeCEP/11.0",
                    "Accept": "application/vnd.github.v3+json",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache"
                }
            });
            if (apiRes) {
                const apiJson = JSON.parse(apiRes);
                if (apiJson && apiJson.content) {
                    const decoded = (typeof Buffer !== "undefined")
                        ? Buffer.from(apiJson.content, 'base64').toString('utf8')
                        : atob(apiJson.content.replace(/\s/g, ''));
                    const parsed = JSON.parse(decoded);
                    if (parsed && parsed.version) {
                        console.log("[Updater] Manifest from GitHub API:", parsed.version);
                        return parsed;
                    }
                }
            }
        } catch (apiErr) {
            console.warn("[Updater] GitHub API fetch warning:", apiErr.message);
        }

        // 2. Secondary: Raw GitHub with timestamp parameter
        try {
            const rawUrl = "https://raw.githubusercontent.com/Kairesh/Emoji-Library-Updates/main/version.json?_t=" + Date.now();
            const text = await Net.request(rawUrl, {
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache"
                }
            });
            if (text) {
                const parsed = JSON.parse(text);
                if (parsed && parsed.version) {
                    console.log("[Updater] Manifest from raw GitHub:", parsed.version);
                    return parsed;
                }
            }
        } catch (rawErr) {
            console.warn("[Updater] Raw GitHub fetch warning:", rawErr.message);
        }

        // 3. Fallback: Windows curl.exe if available
        if (cp && os && os.platform() === 'win32') {
            try {
                const curlCmd = `curl.exe -s -H "Cache-Control: no-cache" "https://raw.githubusercontent.com/Kairesh/Emoji-Library-Updates/main/version.json?_t=${Date.now()}"`;
                const stdout = cp.execSync(curlCmd, { timeout: 4000, encoding: 'utf8' });
                if (stdout && stdout.trim().startsWith('{')) {
                    const parsed = JSON.parse(stdout);
                    if (parsed && parsed.version) {
                        console.log("[Updater] Manifest from curl fallback:", parsed.version);
                        return parsed;
                    }
                }
            } catch (curlErr) {
                console.warn("[Updater] curl fallback warning:", curlErr.message);
            }
        }

        return null;
    }

    async function checkForUpdates(isManual = false) {
        const sStatus = document.getElementById('settings-update-status');
        const btnCheck = document.getElementById('btn-check-updates');

        const currentVer = getInstalledVersion();
        if (isManual && btnCheck) {
            btnCheck.disabled = true;
            btnCheck.innerHTML = '<span>Checking...</span>';
        }

        try {
            const data = await fetchManifest();
            if (!data) {
                if (isManual && sStatus) {
                    sStatus.textContent = "Offline / Connection timeout.";
                    sStatus.style.color = "#ff9500";
                }
                return;
            }

            const isNewer = compareVersions(data.version, currentVer) > 0;

            if (!isManual) {
                const skipped = Settings.get('skipUpdateVersion');
                if (isNewer && skipped === data.version) return;

                const remindVer = Settings.get('remindLaterVersion');
                const remindTime = Settings.get('remindLaterTime') || 0;
                if (remindVer === data.version && remindTime > Date.now()) return;
            }

            if (isNewer) {
                showUpdateModal(data, currentVer);
            }

            if (sStatus) {
                if (isNewer) {
                    sStatus.textContent = `New v${data.version} available! (Click Check for Updates)`;
                    sStatus.style.color = "#02a676";
                } else {
                    sStatus.textContent = `You're on the latest version (v${currentVer}).`;
                    sStatus.style.color = "#02a676";
                }
            }
        } catch (err) {
            console.warn("Update check error:", err);
            if (isManual && sStatus) {
                sStatus.textContent = "Update check failed.";
                sStatus.style.color = "#ff453a";
            }
        } finally {
            if (isManual && btnCheck) {
                btnCheck.disabled = false;
                btnCheck.innerHTML = '<span>Check for Updates</span>';
            }
        }
    }

    function showUpdateModal(data, currentVer) {
        const modal = document.getElementById('update-modal');
        if (!modal) return;

        const modalTitle = document.getElementById('modal-update-title');
        const tag = document.getElementById('modal-update-version');
        const curTag = document.getElementById('modal-update-current');
        const notes = document.getElementById('modal-update-notes');
        const btnInstall = document.getElementById('btn-modal-update-now');
        const btnLater = document.getElementById('btn-modal-update-later');
        const btnSkip = document.getElementById('btn-modal-update-skip');
        const btnClose = document.getElementById('btn-modal-update-close');
        const progRow = document.getElementById('update-progress-row');
        const progBar = document.getElementById('update-progress-bar');
        const progTxt = document.getElementById('update-progress-text');

        // Reset previous progress/error states
        if (progRow) progRow.style.display = 'none';
        if (progBar) progBar.style.width = '0%';
        if (progTxt) progTxt.textContent = '';

        const isNewer = compareVersions(data.version, currentVer) > 0;

        if (modalTitle) {
            modalTitle.textContent = isNewer ? "Update Available!" : "You're Up to Date! 🎉";
        }
        if (tag) tag.textContent = `v${data.version}`;
        if (curTag) curTag.textContent = `Installed: v${currentVer || getInstalledVersion()}`;
        if (notes) notes.textContent = data.releaseNotes || "Performance optimizations and new icon libraries.";

        modal.style.display = 'flex';
        modal.style.zIndex = '999999';

        // Close settings drawer so it never covers the update modal
        const drawer = document.getElementById('settings-drawer');
        if (drawer) drawer.style.display = 'none';

        if (btnClose) {
            btnClose.onclick = () => { modal.style.display = 'none'; };
        }

        if (btnLater) {
            btnLater.style.display = isNewer ? 'block' : 'none';
            btnLater.onclick = () => {
                Settings.set('remindLaterVersion', data.version);
                Settings.set('remindLaterTime', Date.now() + 24 * 60 * 60 * 1000);
                modal.style.display = 'none';
            };
        }

        if (btnSkip) {
            btnSkip.style.display = isNewer ? 'block' : 'none';
            btnSkip.onclick = () => {
                Settings.set('skipUpdateVersion', data.version);
                modal.style.display = 'none';
            };
        }

        if (btnInstall) {
            btnInstall.textContent = isNewer ? "Update Now" : "Great, Close";
            btnInstall.disabled = false;
            btnInstall.onclick = async () => {
                if (!isNewer) {
                    modal.style.display = 'none';
                    return;
                }
                btnInstall.disabled = true;
                await performUpdate(data);
            };
        }
    }

    async function performUpdate(data) {
        const progRow = document.getElementById('update-progress-row');
        const progBar = document.getElementById('update-progress-bar');
        const progTxt = document.getElementById('update-progress-text');
        const btnInstall = document.getElementById('btn-modal-update-now');

        const updateStatus = (pct, msg) => {
            if (progRow) progRow.style.display = 'block';
            if (progBar) progBar.style.width = `${pct}%`;
            if (progTxt) progTxt.textContent = msg || `Updating ${pct}%...`;
        };

        try {
            updateStatus(10, "Connecting to update CDN...");
            const candidateUrls = [
                data.zxpUrl,
                data.backupZxpUrl,
                `https://raw.githubusercontent.com/Kairesh/Emoji-Library-Updates/main/Emoji-Library.zxp`,
                `https://cdn.jsdelivr.net/gh/Kairesh/Emoji-Library-Updates@main/Emoji-Library.zxp`
            ].filter(Boolean);

            const tempZxp = path.join(os.tmpdir(), `Emoji_Library.zxp`);
            const tempZip = path.join(os.tmpdir(), `Emoji_Library.zip`);

            let downloadSuccess = false;
            let lastErr = null;

            for (const url of candidateUrls) {
                try {
                    updateStatus(25, "Downloading update package...");
                    await Net.downloadFile(url, tempZxp, (p) => {
                        updateStatus(25 + Math.floor(p * 0.45), `Downloading (${Math.floor(p)}%)...`);
                    });
                    if (fs.existsSync(tempZxp) && fs.statSync(tempZxp).size > 1000) {
                        downloadSuccess = true;
                        break;
                    }
                } catch (dlErr) {
                    console.warn(`Mirror download failed (${url}):`, dlErr.message);
                    lastErr = dlErr;
                }
            }

            if (!downloadSuccess) {
                throw lastErr || new Error("All mirrors failed. Check connection.");
            }

            fs.copyFileSync(tempZxp, tempZip);

            updateStatus(75, "Extracting update into plugin directory...");
            let extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
            if (extDir.startsWith("file://")) extDir = extDir.slice(7);
            extDir = decodeURIComponent(extDir);
            if (extDir.charAt(0) === '/' && extDir.charAt(2) === ':') extDir = extDir.slice(1);

            const safeExtDir = extDir.replace(/\//g, '\\');
            const safeZip = tempZip.replace(/\//g, '\\');
            const psExtract = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${safeZip}' -DestinationPath '${safeExtDir}' -Force"`;
            await new Promise((resolve, reject) => {
                if (cp) {
                    cp.exec(psExtract, (err, stdout, stderr) => {
                        if (err) {
                            console.error("Extraction error:", err, stderr);
                            reject(new Error("Extraction failed: " + (stderr || err.message)));
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });

            // Save installed version permanently
            localStorage.setItem('kairesh_installed_version', data.version);

            updateStatus(100, "Update complete! Reloading panel...");
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } catch (e) {
            console.error("Update failed:", e);
            updateStatus(100, "Update failed: " + e.message);
            if (btnInstall) btnInstall.disabled = false;
        }
    }

    return {
        check: checkForUpdates,
        showModal: showUpdateModal,
        version: getInstalledVersion
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = PluginUpdater;
} else {
    window.PluginUpdater = PluginUpdater;
}
