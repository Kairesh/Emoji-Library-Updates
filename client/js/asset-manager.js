/**
 * Local Folders & Custom Playlists Manager
 */
const AssetManager = (function () {
    const fs = (typeof window !== "undefined" && window.require) ? window.require('fs') : (typeof require !== "undefined" ? require('fs') : null);
    const path = (typeof window !== "undefined" && window.require) ? window.require('path') : (typeof require !== "undefined" ? require('path') : null);

    const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.mp4'];

    function getLinkedFolders() {
        let folders = Settings.get('linkedFolders') || [];
        if (fs) {
            const valid = folders.filter(f => f && fs.existsSync(f));
            if (valid.length !== folders.length) {
                Settings.set('linkedFolders', valid);
                folders = valid;
            }
        }
        return folders;
    }

    function addLinkedFolder(folderPath) {
        if (!folderPath || !fs || !fs.existsSync(folderPath)) return;
        const folders = getLinkedFolders();
        if (!folders.includes(folderPath)) {
            folders.push(folderPath);
            Settings.set('linkedFolders', folders);
        }
    }

    function removeLinkedFolder(folderPath) {
        let folders = getLinkedFolders();
        folders = folders.filter(f => f !== folderPath);
        Settings.set('linkedFolders', folders);
    }

    async function saveAssetToFolder(targetFolder, item, options = {}) {
        if (!targetFolder || !fs || !fs.existsSync(targetFolder)) {
            throw new Error("Target folder does not exist on disk.");
        }
        const cleanName = (item.name || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_');
        let destPath = null;

        if (item.type === 'icon') {
            const color = options.color || '#ffffff';
            const strokeWidth = options.strokeWidth || 2;
            let svgText = '';
            if (typeof IconEngine !== "undefined" && IconEngine.fetchSvgContent) {
                svgText = await IconEngine.fetchSvgContent(item.iconFullName, { color, strokeWidth });
            } else if (item.svgContent) {
                svgText = item.svgContent;
            }
            if (!svgText) throw new Error("Could not retrieve vector SVG content.");
            destPath = path.join(targetFolder, `${cleanName}.svg`);
            fs.writeFileSync(destPath, svgText, 'utf8');
        } else if (item.type === 'emoji') {
            const style = options.style || 'microsoft';
            let dlUrl = "";
            if (typeof getEmojiDownloadUrl === "function") {
                dlUrl = getEmojiDownloadUrl(item.emojiChar, style, 'png');
            } else {
                dlUrl = `https://emojicdn.elk.sh/${encodeURIComponent(item.emojiChar)}?style=${style}`;
            }
            destPath = path.join(targetFolder, `emoji_${cleanName}.png`);
            if (typeof Net !== "undefined" && Net.downloadFile) {
                await Net.downloadFile(dlUrl, destPath);
            }
        } else if (item.type === 'local' || item.type === 'clipboard') {
            if (item.fullPath && fs.existsSync(item.fullPath)) {
                const baseName = item.fileName || path.basename(item.fullPath);
                destPath = path.join(targetFolder, baseName);
                fs.copyFileSync(item.fullPath, destPath);
            } else {
                throw new Error("Source file does not exist on disk.");
            }
        }

        return destPath;
    }

    function scanFolder(folderPath, recursive = false) {
        if (!fs || !path || !fs.existsSync(folderPath)) return [];
        const results = [];
        try {
            const items = fs.readdirSync(folderPath, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(folderPath, item.name);
                if (item.isDirectory() && recursive) {
                    results.push(...scanFolder(fullPath, recursive));
                } else if (item.isFile()) {
                    const ext = path.extname(item.name).toLowerCase();
                    if (SUPPORTED_EXTS.includes(ext)) {
                        results.push({
                            name: path.parse(item.name).name,
                            fileName: item.name,
                            fullPath: fullPath,
                            ext: ext,
                            type: 'local'
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("Scan folder error:", e);
        }
        return results;
    }

    // Playlists
    function getPlaylists() {
        return Settings.get('playlists') || [{ id: 'favs', name: 'Favorites', items: [] }];
    }

    function createPlaylist(name) {
        if (!name || !name.trim()) return;
        const list = getPlaylists();
        const id = 'pl_' + Date.now();
        list.push({ id, name: name.trim(), items: [] });
        Settings.set('playlists', list);
        return id;
    }

    function deletePlaylist(id) {
        if (id === 'favs') return; // protect default favorites
        let list = getPlaylists();
        list = list.filter(p => p.id !== id);
        Settings.set('playlists', list);
    }

    function addToPlaylist(playlistId, item) {
        const list = getPlaylists();
        const target = list.find(p => p.id === playlistId);
        if (target) {
            if (!target.items.some(it => it.id === item.id)) {
                target.items.push(item);
                Settings.set('playlists', list);
            }
        }
    }

    function removeFromPlaylist(playlistId, itemId) {
        const list = getPlaylists();
        const target = list.find(p => p.id === playlistId);
        if (target) {
            target.items = target.items.filter(it => it.id !== itemId);
            Settings.set('playlists', list);
        }
    }

    return {
        getLinkedFolders: getLinkedFolders,
        addLinkedFolder: addLinkedFolder,
        removeLinkedFolder: removeLinkedFolder,
        scanFolder: scanFolder,
        getPlaylists: getPlaylists,
        createPlaylist: createPlaylist,
        deletePlaylist: deletePlaylist,
        addToPlaylist: addToPlaylist,
        removeFromPlaylist: removeFromPlaylist,
        saveAssetToFolder: saveAssetToFolder
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = AssetManager;
} else {
    window.AssetManager = AssetManager;
}
