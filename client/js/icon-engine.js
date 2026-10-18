/**
 * Online Icon Engine for 200,000+ vector icons
 * Streams SVGs directly on demand via Iconify & jsDelivr APIs with 0MB bloat.
 */
const IconEngine = (function () {
    // Curated high quality open-source libraries from toools.design
    const COLLECTIONS = [
        { id: "all", name: "All Libraries", category: "all" },
        // Category A: Modern UI & Minimalist
        { id: "lucide", name: "Lucide", category: "minimal", count: "1,800+" },
        { id: "ph", name: "Phosphor", category: "minimal", count: "9,000+" },
        { id: "tabler", name: "Tabler", category: "minimal", count: "5,500+" },
        { id: "heroicons", name: "Heroicons", category: "minimal", count: "800+" },
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
        { id: "pixelarticons", name: "Pixelarticons", category: "retro", count: "480+" },
        { id: "doodle", name: "Doodle Icons", category: "retro", count: "400+" },
        // Category C: Brand & Tech Logos
        { id: "simple-icons", name: "Brand & Tech Logos", category: "brands", count: "3,200+" },
        // Category D: Multi-Color & Flags
        { id: "openmoji", name: "OpenMoji", category: "color", count: "4,000+" },
        { id: "flagpack", name: "Flagpack (Flags)", category: "color", count: "250+" },
        // Category E: Animated / Line Motion
        { id: "line-md", name: "Line MD (Motion)", category: "animated", count: "1,100+" }
    ];

    const searchCache = new Map();
    const svgCache = new Map();

    function getApiBase() {
        if (typeof Settings !== "undefined") {
            const customUrl = Settings.get('iconifyCustomApiUrl');
            if (customUrl && customUrl.trim().length > 0) {
                return customUrl.trim().replace(/\/$/, "");
            }
        }
        return "https://api.iconify.design";
    }

    async function searchIcons(query, prefix = "all", limit = 100) {
        const base = getApiBase();
        const cleanQuery = (query || "").trim();
        const cacheKey = `${cleanQuery}_${prefix}_${limit}`;
        if (searchCache.has(cacheKey)) {
            return searchCache.get(cacheKey);
        }

        let iconList = [];

        try {
            if (!cleanQuery) {
                if (!prefix || prefix === "all") {
                    // Popular starter icons across diverse UI categories
                    const url = `${base}/search?query=arrow&limit=${limit}`;
                    const data = await Net.getJSON(url);
                    if (data && Array.isArray(data.icons)) {
                        iconList = data.icons;
                    }
                } else {
                    // Load specific collection
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
                        iconList = names.slice(0, limit).map(n => `${p}:${n}`);
                    }
                }
            } else {
                const encodedQuery = encodeURIComponent(cleanQuery);
                let url = "";
                if (prefix && prefix !== "all") {
                    url = `${base}/search?query=${encodedQuery}&prefixes=${prefix}&limit=${limit}`;
                } else {
                    url = `${base}/search?query=${encodedQuery}&limit=${limit}`;
                }
                const data = await Net.getJSON(url);
                if (data && Array.isArray(data.icons)) {
                    iconList = data.icons;
                }
            }

            searchCache.set(cacheKey, iconList);
            return iconList;
        } catch (e) {
            console.warn("Icon search error:", e);
            return [];
        }
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
        buildSvgUrl: buildSvgUrl,
        fetchSvgContent: fetchSvgContent
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = IconEngine;
} else {
    window.IconEngine = IconEngine;
}
