/**
 * Local Folders & Custom Playlists Manager
 */
const AssetManager = (function () {
    const fs = (typeof window !== "undefined" && window.require) ? window.require('fs') : (typeof require !== "undefined" ? require('fs') : null);
    const path = (typeof window !== "undefined" && window.require) ? window.require('path') : (typeof require !== "undefined" ? require('path') : null);

    const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.mp4'];

    function getLinkedFolders() {
        return Settings.get('linkedFolders') || [];
    }

    function addLinkedFolder(folderPath) {
        if (!folderPath) return;
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
        removeFromPlaylist: removeFromPlaylist
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = AssetManager;
} else {
    window.AssetManager = AssetManager;
}
