/**
 * Online Icon Engine for 200,000+ vector icons
 * Streams SVGs directly on demand via Iconify & jsDelivr APIs with 0MB bloat.
 */
const IconEngine = (function () {
    // Curated high quality open-source libraries from toools.design
    const COLLECTIONS = [
        { id: "all", name: "All Libraries", category: "all" },
        // Category A: Modern UI & Minimalist
        { id: "lucide", name: "Lucide", category: "minimal", count: "2,100+" },
        { id: "ph", name: "Phosphor", category: "minimal", count: "9,000+" },
        { id: "tabler", name: "Tabler", category: "minimal", count: "6,000+" },
        { id: "heroicons", name: "Heroicons", category: "minimal", count: "1,200+" },
        { id: "iconoir", name: "Iconoir", category: "minimal", count: "1,500+" },
        { id: "ri", name: "Remix Icon", category: "minimal", count: "2,800+" },
        { id: "bi", name: "Bootstrap Icons", category: "minimal", count: "2,000+" },
        { id: "eva", name: "Eva Icons", category: "minimal", count: "480+" },
        { id: "feather", name: "Feather", category: "minimal", count: "280+" },
        { id: "akar-icons", name: "Akar Icons", category: "minimal", count: "800+" },
        { id: "mingcute", name: "MingCute", category: "minimal", count: "2,300+" },
        { id: "mage", name: "Mage Icons", category: "minimal", count: "1,200+" },
        { id: "css.gg", name: "CSS.gg Icons", category: "minimal", count: "700+" },
        // Category B: Hand-Drawn & Retro Fun
        { id: "pixelarticons", name: "Pixelarticons", category: "retro", count: "1,300+" },
        { id: "doodle", name: "Doodle Icons", category: "retro", count: "400+" },
        // Category C: Brand & Tech Logos
        { id: "simple-icons", name: "Brand & Tech Logos", category: "brands", count: "3,700+" },
        // Category D: Multi-Color & Flags
        { id: "openmoji", name: "OpenMoji", category: "color", count: "4,000+" },
        { id: "flagpack", name: "Flagpack (Flags)", category: "color", count: "250+" },
        // Category E: Animated / Line Motion
        { id: "line-md", name: "Line MD (Motion)", category: "animated", count: "1,100+" }
    ];

    // Rich curated showcase across top libraries for the default "All Libraries" view
    const CURATED_DEFAULT_ICONS = [
        // UI Essentials (Lucide)
        "lucide:home", "lucide:search", "lucide:settings", "lucide:user", "lucide:bell",
        "lucide:mail", "lucide:camera", "lucide:heart", "lucide:star", "lucide:trash-2",
        "lucide:check", "lucide:x", "lucide:plus", "lucide:folder", "lucide:download",
        "lucide:upload", "lucide:share-2", "lucide:bookmark", "lucide:message-square", "lucide:sun",
        // Media & Controls (Phosphor)
        "ph:play-fill", "ph:pause-fill", "ph:speaker-high-fill", "ph:music-notes-fill", "ph:video-camera-fill",
        "ph:microphone-fill", "ph:film-slate-fill", "ph:image-fill", "ph:headphones-fill", "ph:broadcast-fill",
        "ph:lightning-fill", "ph:fire-fill", "ph:chat-circle-dots-fill", "ph:compass-fill", "ph:globe-simple-fill",
        // Brand & Tech Logos (Simple Icons)
        "simple-icons:youtube", "simple-icons:instagram", "simple-icons:tiktok", "simple-icons:x",
        "simple-icons:discord", "simple-icons:spotify", "simple-icons:github", "simple-icons:figma",
        "simple-icons:adobephotoshop", "simple-icons:adobeaftereffects", "simple-icons:adobepremierepro",
        "simple-icons:apple", "simple-icons:twitch", "simple-icons:whatsapp", "simple-icons:google",
        // Retro Gaming & Fun (Pixelarticons)
        "pixelarticons:heart", "pixelarticons:zap", "pixelarticons:gamepad", "pixelarticons:trophy",
        "pixelarticons:coin", "pixelarticons:ghost", "pixelarticons:power", "pixelarticons:music",
        // Motion & System (Tabler & Heroicons)
        "tabler:trending-up", "tabler:refresh", "tabler:sparkles", "tabler:flame", "tabler:wand",
        "tabler:arrow-right", "tabler:arrow-left", "tabler:arrow-up", "tabler:arrow-down",
        "heroicons:hand-thumb-up-solid", "heroicons:face-smile-solid", "heroicons:shield-check-solid",
        "heroicons:clock-solid", "heroicons:calendar-days-solid"
    ];

    const searchCache = new Map();
    const svgCache = new Map();
    const collectionListCache = new Map();
    // Cache for batch JSON payloads: prefix -> { icons: { name: { body, width, height } }, width, height }
    const batchDataCache = new Map();

    function getApiBase() {
        if (typeof Settings !== "undefined") {
            const customUrl = Settings.get('iconifyCustomApiUrl');
            if (customUrl && customUrl.trim().length > 0) {
                return customUrl.trim().replace(/\/$/, "");
            }
        }
        return "https://api.iconify.design";
    }

    /**
     * Loads the complete set of icons for a specific collection.
     * Uses jsDelivr CDN mirrors to bypass all Cloudflare API rate limits.
     */
    async function getCollectionIcons(prefix) {
        if (collectionListCache.has(prefix)) {
            return collectionListCache.get(prefix);
        }

        // Primary source: jsDelivr icon-sets CDN
        try {
            const cdnUrl = `https://cdn.jsdelivr.net/gh/iconify/icon-sets@master/json/${prefix}.json`;
            const data = await Net.getJSON(cdnUrl);
            if (data && data.icons) {
                batchDataCache.set(prefix, data);
                const p = data.prefix || prefix;
                const names = Object.keys(data.icons);
                if (data.aliases) {
                    for (const a in data.aliases) {
                        const parentKey = data.aliases[a].parent;
                        if (data.icons[parentKey]) {
                            data.icons[a] = data.icons[parentKey];
                            names.push(a);
                        }
                    }
                }
                const fullList = Array.from(new Set(names)).map(n => `${p}:${n}`);
                collectionListCache.set(prefix, fullList);
                return fullList;
            }
        } catch (cdnErr) {
            console.warn(`jsDelivr fetch failed for ${prefix}, trying fallback:`, cdnErr);
        }

        // Fallback: iconify API
        try {
            const base = getApiBase();
            const url = `${base}/collection?prefix=${prefix}`;
            const data = await Net.getJSON(url);
            if (data) {
                const p = data.prefix || prefix;
                let names = [];
                if (Array.isArray(data.uncategorized)) {
                    names = names.concat(data.uncategorized);
                }
                if (data.categories) {
                    for (const catName in data.categories) {
                        if (Array.isArray(data.categories[catName])) {
                            names = names.concat(data.categories[catName]);
                        }
                    }
                }
                const fullList = Array.from(new Set(names)).map(n => `${p}:${n}`);
                if (fullList.length > 0) {
                    collectionListCache.set(prefix, fullList);
                    return fullList;
                }
            }
        } catch (apiErr) {
            console.warn(`Iconify API fetch failed for ${prefix}:`, apiErr);
        }

        return [];
    }

    /**
     * Builds an infinite stream for "All Libraries" by combining top collections.
     */
    async function getAllLibrariesStream() {
        const topPrefixes = ['lucide', 'ph', 'tabler', 'simple-icons', 'pixelarticons', 'heroicons'];
        const lists = await Promise.all(topPrefixes.map(getCollectionIcons));
        
        const combined = [...CURATED_DEFAULT_ICONS];
        const seen = new Set(CURATED_DEFAULT_ICONS);
        const maxLen = Math.max(...lists.map(l => l.length));

        for (let i = 0; i < maxLen; i++) {
            for (const list of lists) {
                if (i < list.length) {
                    const item = list[i];
                    if (!seen.has(item)) {
                        seen.add(item);
                        combined.push(item);
                    }
                }
            }
        }
        return combined;
    }

    async function searchIcons(query, prefix = "all") {
        const base = getApiBase();
        const cleanQuery = (query || "").trim().toLowerCase();
        const cacheKey = `${cleanQuery}_${prefix}`;
        if (searchCache.has(cacheKey)) {
            return searchCache.get(cacheKey);
        }

        let iconList = [];

        try {
            if (!cleanQuery) {
                if (!prefix || prefix === "all") {
                    // For All Libraries, start with curated list immediately, and background-expand with full stream
                    iconList = [...CURATED_DEFAULT_ICONS];
                } else {
                    // Load ALL icons in the selected collection
                    iconList = await getCollectionIcons(prefix);
                }
            } else {
                if (prefix && prefix !== "all") {
                    // Check if collection is already loaded locally for instant search
                    if (collectionListCache.has(prefix)) {
                        const allNames = collectionListCache.get(prefix);
                        iconList = allNames.filter(name => name.toLowerCase().includes(cleanQuery));
                    } else {
                        const encodedQuery = encodeURIComponent(cleanQuery);
                        const url = `${base}/search?query=${encodedQuery}&prefixes=${prefix}&limit=999`;
                        const data = await Net.getJSON(url);
                        if (data && Array.isArray(data.icons)) {
                            iconList = data.icons;
                        }
                    }
                } else {
                    // Search across all libraries
                    const encodedQuery = encodeURIComponent(cleanQuery);
                    const url = `${base}/search?query=${encodedQuery}&limit=999`;
                    const data = await Net.getJSON(url);
                    if (data && Array.isArray(data.icons)) {
                        iconList = data.icons;
                    }
                }
            }

            searchCache.set(cacheKey, iconList);
            return iconList;
        } catch (e) {
            console.warn("Icon search error:", e);
            return [];
        }
    }

    /**
     * Batch-fetch icon definitions for multiple icons.
     * Checks in-memory cache first for instant rendering with 0 network calls.
     */
    async function fetchBatchIcons(iconFullNames, options = {}) {
        const base = getApiBase();
        const color = options.color || "#ffffff";
        const strokeWidth = options.strokeWidth || 2;
        const results = {};

        // Group icons by prefix
        const prefixMap = {};
        iconFullNames.forEach(full => {
            const parts = full.split(':');
            const p = parts.length > 1 ? parts[0] : 'ph';
            const n = parts.length > 1 ? parts[1] : parts[0];
            if (!prefixMap[p]) prefixMap[p] = [];
            if (!prefixMap[p].includes(n)) prefixMap[p].push(n);
        });

        // Fetch each prefix batch concurrently
        const fetchPromises = Object.keys(prefixMap).map(async (p) => {
            let cachedCollection = batchDataCache.get(p) || { width: 24, height: 24, icons: {} };
            const missingNames = prefixMap[p].filter(n => !cachedCollection.icons[n]);

            if (missingNames.length > 0) {
                try {
                    const batchUrl = `${base}/${p}.json?icons=${missingNames.join(',')}`;
                    const json = await Net.getJSON(batchUrl);
                    if (json && json.icons) {
                        cachedCollection.width = json.width || cachedCollection.width;
                        cachedCollection.height = json.height || cachedCollection.height;
                        for (const name in json.icons) {
                            cachedCollection.icons[name] = json.icons[name];
                        }
                        if (json.aliases) {
                            for (const alias in json.aliases) {
                                const parentKey = json.aliases[alias].parent;
                                if (json.icons[parentKey]) {
                                    cachedCollection.icons[alias] = json.icons[parentKey];
                                }
                            }
                        }
                        batchDataCache.set(p, cachedCollection);
                    }
                } catch (err) {
                    console.warn(`Batch fetch failed for prefix ${p}:`, err);
                }
            }

            // Build SVGs for requested names in this prefix
            prefixMap[p].forEach(name => {
                const iconObj = cachedCollection.icons[name];
                const fullKey = `${p}:${name}`;
                if (iconObj && iconObj.body) {
                    const w = iconObj.width || cachedCollection.width || 24;
                    const h = iconObj.height || cachedCollection.height || 24;
                    let body = iconObj.body;
                    if (color) {
                        body = body.replace(/currentColor/g, color);
                    }
                    if (strokeWidth && strokeWidth !== 2) {
                        body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`);
                    }
                    results[fullKey] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${body}</svg>`;
                }
            });
        });

        await Promise.all(fetchPromises);
        return results;
    }

    function buildSvgUrl(iconFullName, options = {}) {
        const base = getApiBase();
        const color = options.color || "#ffffff";
        const encodedColor = encodeURIComponent(color);
        const w = options.width || 32;
        const h = options.height || 32;
        return `${base}/${iconFullName}.svg?color=${encodedColor}&width=${w}&height=${h}`;
    }

    async function fetchSvgContent(iconFullName, options = {}) {
        const color = options.color || "#ffffff";
        const strokeWidth = options.strokeWidth || 2;

        // Check if already in batch data cache
        const parts = iconFullName.split(':');
        const p = parts.length > 1 ? parts[0] : 'ph';
        const n = parts.length > 1 ? parts[1] : parts[0];
        const cachedCollection = batchDataCache.get(p);
        if (cachedCollection && cachedCollection.icons && cachedCollection.icons[n]) {
            const iconObj = cachedCollection.icons[n];
            const w = iconObj.width || cachedCollection.width || 24;
            const h = iconObj.height || cachedCollection.height || 24;
            let body = iconObj.body;
            if (color) {
                body = body.replace(/currentColor/g, color);
            }
            if (strokeWidth && strokeWidth !== 2) {
                body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`);
            }
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${body}</svg>`;
        }

        const svgUrl = buildSvgUrl(iconFullName, options);
        if (svgCache.has(svgUrl)) {
            return svgCache.get(svgUrl);
        }

        try {
            let svgText = await Net.get(svgUrl);
            if (!svgText || !svgText.includes('<svg')) {
                throw new Error("Invalid SVG received");
            }

            // Apply stroke width override dynamically if needed
            if (options.strokeWidth && options.strokeWidth !== 2) {
                svgText = svgText.replace(/stroke-width="[^"]*"/g, `stroke-width="${options.strokeWidth}"`);
                if (!svgText.includes('stroke-width=')) {
                    svgText = svgText.replace(/<svg\b([^>]*)>/, `<svg$1 stroke-width="${options.strokeWidth}">`);
                }
            }

            svgCache.set(svgUrl, svgText);
            return svgText;
        } catch (e) {
            console.error("fetchSvgContent error:", e);
            throw e;
        }
    }

    return {
        collections: COLLECTIONS,
        searchIcons: searchIcons,
        getCollectionIcons: getCollectionIcons,
        getAllLibrariesStream: getAllLibrariesStream,
        fetchBatchIcons: fetchBatchIcons,
        buildSvgUrl: buildSvgUrl,
        fetchSvgContent: fetchSvgContent
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = IconEngine;
} else {
    window.IconEngine = IconEngine;
}
