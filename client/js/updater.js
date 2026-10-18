/**
 * Auto-Updater for Emoji & Icon Studio
 * Powered by GitHub repository releases & version.json
 */
const PluginUpdater = (function () {
    const CURRENT_VERSION = "2.0.0";
    const MANIFEST_URLS = [
        "https://raw.githubusercontent.com/Kairesh/Emoji-Library-Updates/main/version.json",
        "https://cdn.jsdelivr.net/gh/Kairesh/Emoji-Library-Updates@main/version.json"
    ];

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
        for (const url of MANIFEST_URLS) {
            try {
                const bustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
                const resp = await fetch(bustUrl, { cache: 'no-store' });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.version) return data;
                }
            } catch (e) {
                // Try next mirror
            }
        }
        return null;
    }

    async function checkForUpdates(isManual = false) {
        const sStatus = document.getElementById('settings-update-status');
        const btnCheck = document.getElementById('btn-check-updates');
        const modal = document.getElementById('update-modal');

        if (isManual && btnCheck) {
            btnCheck.disabled = true;
            btnCheck.innerHTML = '<span>Checking...</span>';
        }

        try {
            const data = await fetchManifest();
            if (!data) {
                if (isManual && sStatus) {
                    sStatus.textContent = "Could not check for updates. Verify internet connection.";
                    sStatus.style.color = "#ff9500";
                }
                return;
            }

            const isNewer = compareVersions(data.version, CURRENT_VERSION) > 0;

            if (!isManual) {
                // Check if skipped
                const skipped = Settings.get('skipUpdateVersion');
                if (isNewer && skipped === data.version) return;

                // Check remind later (24 hours)
                const remindVer = Settings.get('remindLaterVersion');
                const remindTime = Settings.get('remindLaterTime') || 0;
                if (remindVer === data.version && remindTime > Date.now()) return;
            }

            if (isNewer) {
                showUpdateModal(data);
                if (sStatus) {
                    sStatus.textContent = `New v${data.version} available!`;
                    sStatus.style.color = "#02a676";
                }
            } else {
                if (isManual && sStatus) {
                    sStatus.textContent = `You're on the latest version (v${CURRENT_VERSION}).`;
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

    function showUpdateModal(data) {
        const modal = document.getElementById('update-modal');
        if (!modal) return;

        const tag = document.getElementById('modal-update-version');
        const curTag = document.getElementById('modal-update-current');
        const notes = document.getElementById('modal-update-notes');
        const btnInstall = document.getElementById('btn-modal-update-now');
        const btnLater = document.getElementById('btn-modal-update-later');
        const btnSkip = document.getElementById('btn-modal-update-skip');
        const btnClose = document.getElementById('btn-modal-update-close');

        if (tag) tag.textContent = `v${data.version}`;
        if (curTag) curTag.textContent = `v${CURRENT_VERSION}`;
        if (notes) notes.textContent = data.releaseNotes || "Performance optimizations and new icon libraries.";

        modal.style.display = 'flex';

        if (btnClose) {
            btnClose.onclick = () => { modal.style.display = 'none'; };
        }

        if (btnLater) {
            btnLater.onclick = () => {
                Settings.set('remindLaterVersion', data.version);
                Settings.set('remindLaterTime', Date.now() + 24 * 60 * 60 * 1000);
                modal.style.display = 'none';
            };
        }

        if (btnSkip) {
            btnSkip.onclick = () => {
                Settings.set('skipUpdateVersion', data.version);
                modal.style.display = 'none';
            };
        }

        if (btnInstall) {
            btnInstall.onclick = async () => {
                btnInstall.disabled = true;
                await performUpdate(data);
            };
        }
    }

    async function performUpdate(data) {
        const progRow = document.getElementById('update-progress-row');
        const progBar = document.getElementById('update-progress-bar');
        const progTxt = document.getElementById('update-progress-text');

        const updateStatus = (pct, msg) => {
            if (progRow) progRow.style.display = 'block';
            if (progBar) progBar.style.width = `${pct}%`;
            if (progTxt) progTxt.textContent = msg || `Updating ${pct}%...`;
        };

        try {
            updateStatus(10, "Fetching package info...");
            const packageUrl = data.zxpUrl || data.backupZxpUrl || data.packageUrl;
            
            if (packageUrl && (packageUrl.endsWith('.zxp') || packageUrl.endsWith('.zip'))) {
                updateStatus(30, "Downloading latest update package...");
                // Download package to temp
                const tempZxp = path.join(os.tmpdir(), `Emoji_Library_v${data.version}.zxp`);
                const tempZip = path.join(os.tmpdir(), `Emoji_Library_v${data.version}.zip`);
                await downloadFile(packageUrl, tempZxp, (p) => {
                    updateStatus(30 + Math.floor(p * 0.4), `Downloading (${Math.floor(p)}%)...`);
                });
                fs.copyFileSync(tempZxp, tempZip);

                updateStatus(75, "Extracting update into plugin directory...");
                // Determine extension dir
                let extDir = csInterface.getSystemPath(SystemPath.EXTENSION);
                if (extDir.startsWith("file://")) extDir = extDir.slice(7);
                extDir = decodeURIComponent(extDir);
                if (extDir.charAt(0) === '/' && extDir.charAt(2) === ':') extDir = extDir.slice(1);

                // Use AdmZip or PowerShell to unzip into extension dir
                const psExtract = `Expand-Archive -Path "${tempZip}" -DestinationPath "${extDir}" -Force`;
                const { exec } = require('child_process');
                await new Promise((res, rej) => {
                    exec(`powershell -Command "${psExtract}"`, (err) => {
                        if (err) {
                            console.warn("PowerShell extract fallback:", err);
                        }
                        res();
                    });
                });

                updateStatus(100, "Update complete! Reloading panel...");
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } else {
                // If packageUrl is a web page, open in default browser
                if (data.updateUrl) {
                    const { shell } = require('electron') || {};
                    const { exec } = require('child_process');
                    exec(`start "" "${data.updateUrl}"`);
                }
                updateStatus(100, "Opening download page...");
            }
        } catch (e) {
            console.error("Update failed:", e);
            updateStatus(100, "Update could not finish automatically. Please visit GitHub.");
        }
    }

    function downloadFile(url, destPath, onProg) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            const req = https.get(url, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return downloadFile(res.headers.location, destPath, onProg).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`Download failed with status ${res.statusCode}`));
                }
                const total = parseInt(res.headers['content-length'] || "0", 10);
                let cur = 0;
                res.on('data', (chunk) => {
                    cur += chunk.length;
                    file.write(chunk);
                    if (total > 0 && onProg) onProg((cur / total) * 100);
                });
                res.on('end', () => {
                    file.end();
                    resolve(destPath);
                });
            });
            req.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }

    return {
        check: checkForUpdates,
        showModal: showUpdateModal,
        version: CURRENT_VERSION
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = PluginUpdater;
} else {
    window.PluginUpdater = PluginUpdater;
}
