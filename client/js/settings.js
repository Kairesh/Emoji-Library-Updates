/**
 * Settings & API Keys Manager for Emoji & Icon Studio
 */
const Settings = (function () {
    const STORAGE_KEY = "kairesh_emoji_icon_settings";

    const defaultSettings = {
        // API Keys & External Guides
        iconifyCustomApiUrl: "", // Custom private/self-hosted Iconify instance (optional)
        githubToken: "",        // GitHub Personal Access Token for higher rate limits on direct raw repos

        // Behavior & Insertion
        insertMode: "shape",    // 'shape' or 'text'
        shapeFormat: "svg",     // 'svg' (AE only) or 'png' (Pr & AE)
        pngRasterSize: 1024,    // 512, 1024, 2048
        insertSize: 256,
        style: "google",        // 'google', 'apple', 'twitter', 'microsoft'

        // Icon Customization defaults
        iconColor: "#ffffff",
        iconStrokeWidth: 2,
        iconSize: 256,
        selectedCollection: "all",

        // Local Folders & Playlists
        linkedFolders: [],      // Array of local directory paths
        playlists: [            // User defined playlists
            { id: "favs", name: "Favorites", items: [] }
        ],

        // Updates
        skipUpdateVersion: "",
        remindLaterVersion: "",
        remindLaterTime: 0
    };

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return Object.assign({}, defaultSettings, parsed);
            }
        } catch (e) {
            console.warn("Failed to load settings:", e);
        }
        return Object.assign({}, defaultSettings);
    }

    function save(newSettings) {
        try {
            const current = load();
            const updated = Object.assign({}, current, newSettings);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error("Failed to save settings:", e);
            return load();
        }
    }

    function get(key) {
        const s = load();
        return s[key] !== undefined ? s[key] : defaultSettings[key];
    }

    function set(key, value) {
        const obj = {};
        obj[key] = value;
        return save(obj);
    }

    return {
        load: load,
        save: save,
        get: get,
        set: set,
        defaults: defaultSettings
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = Settings;
} else {
    window.Settings = Settings;
}
