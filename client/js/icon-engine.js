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
        "pixelarticons:coin", "pixelarticons:dice", "pixelarticons:power", "pixelarticons:music",
        // Motion & System (Tabler & Heroicons)
        "tabler:trending-up", "tabler:refresh", "tabler:sparkles", "tabler:flame", "tabler:wand",
        "tabler:arrow-right", "tabler:arrow-left", "tabler:arrow-up", "tabler:arrow-down",
        "heroicons:hand-thumb-up-solid", "heroicons:face-smile-solid", "heroicons:shield-check-solid",
        "heroicons:clock-solid", "heroicons:calendar-days-solid"
    ];

    const OFFICIAL_CATEGORIES = {
        "all": [
            { id: "all", label: "All Items", icon: "🌐", desc: "All 200,000+ vector icons across all libraries" },
            { id: "essentials", label: "UI Essentials", icon: "✨", query: "home,search,settings,user,bell,mail,camera,heart,star,trash,check,close,plus,folder,download,upload", desc: "Common buttons, navigation & interface icons" },
            { id: "media", label: "Media & Audio", icon: "🎬", query: "play,pause,stop,volume,speaker,music,video,camera,microphone,headphones,film,disc", desc: "Playback, audio controls, camera & sound" },
            { id: "arrows", label: "Arrows & Direction", icon: "➔", query: "arrow,chevron,caret,trending,refresh,repeat,sync,corner,undo,redo", desc: "Directional indicators, navigation arrows & chevrons" },
            { id: "brands", label: "Brands & Logos", icon: "🏷️", query: "youtube,instagram,tiktok,discord,spotify,github,apple,figma,twitter,google,whatsapp,adobe", desc: "Social media, streaming, software & tech logos" },
            { id: "motion", label: "Animated (Line MD)", icon: "⚡", query: "loading,spinner,confirm,alert,arrow,weather,player", desc: "Smooth animated motion vectors with trim paths" },
            { id: "retro", label: "Retro 8-Bit", icon: "👾", query: "gamepad,heart,coin,dice,trophy,power,zap,sword,shield", desc: "Pixelart & gaming icons" }
        ],
        "lucide": [
            { id: "all", label: "All Lucide", icon: "💎", desc: "Complete Lucide icon collection (2,100+)" },
            { id: "arrows", label: "Arrows", icon: "➔", query: "arrow,chevron,move,corner,refresh,rotate,redo,undo", desc: "Chevrons, rotations, directions" },
            { id: "design", label: "Design & Creative", icon: "🎨", query: "palette,brush,pen,pencil,layers,shapes,crop,scissors,ruler,wand", desc: "Art tools, layers, shapes" },
            { id: "dev", label: "Development", icon: "💻", query: "code,terminal,git,binary,bug,cpu,database,server,webhook", desc: "Coding, servers, databases" },
            { id: "media", label: "Media & Audio", icon: "🎵", query: "play,pause,volume,music,video,film,mic,headphones,radio,disc", desc: "Music, player, video, mics" },
            { id: "communication", label: "Communication", icon: "💬", query: "mail,message,chat,phone,inbox,send,at-sign,bell,share", desc: "Chat, messages, calls, notifications" },
            { id: "weather", label: "Weather", icon: "☀️", query: "sun,moon,cloud,rain,wind,snow,thermometer,sunset,sunrise", desc: "Sun, rain, clouds, climate" },
            { id: "devices", label: "Devices & Tech", icon: "📱", query: "laptop,smartphone,tablet,monitor,tv,watch,printer,hard-drive", desc: "Phones, computers, monitors" },
            { id: "shapes", label: "Shapes & Geometry", icon: "🔺", query: "circle,square,triangle,hexagon,octagon,diamond,star,heart", desc: "Geometric shapes & symbols" },
            { id: "commerce", label: "Commerce & Finance", icon: "💳", query: "shopping,cart,bag,credit-card,dollar,wallet,receipt,tag", desc: "Shopping, checkout, cards, currency" },
            { id: "system", label: "System & Files", icon: "⚙️", query: "settings,sliders,lock,key,file,folder,archive,trash,clipboard", desc: "Files, settings, folders, security" }
        ],
        "ph": [
            { id: "all", label: "All Phosphor", icon: "⚡", desc: "Complete Phosphor collection (9,000+)" },
            { id: "arrows", label: "Arrows", icon: "➔", query: "arrow,caret,chevron,arrows", desc: "Arrows & directions" },
            { id: "brand", label: "Brand & Logos", icon: "🏷️", query: "logo,brand,github,google,apple,twitter,instagram,facebook", desc: "Company & social brands" },
            { id: "communication", label: "Communication", icon: "💬", query: "chat,envelope,phone,paper-plane,broadcast,megaphone", desc: "Chats, mail, speech" },
            { id: "design", label: "Design", icon: "🎨", query: "paint,bezier,pen,eyedropper,crop,selection,swatches", desc: "Design & vectors" },
            { id: "dev", label: "Development", icon: "💻", query: "code,brackets,terminal,git,cpu,database,bug", desc: "Code & engineering" },
            { id: "editor", label: "Editor & Text", icon: "✍️", query: "text,align,bold,italic,underline,list,heading,quotes", desc: "Typography & editor" },
            { id: "finance", label: "Finance & Money", icon: "💰", query: "currency,coin,credit-card,wallet,bank,chart,trend", desc: "Money, coins, wallets" },
            { id: "games", label: "Games & Fun", icon: "🎮", query: "game-controller,dice,sword,ghost,trophy,medal,sparkle", desc: "Gaming & entertainment" },
            { id: "health", label: "Health & Fitness", icon: "❤️", query: "heart,first-aid,activity,pill,barbell,dna,mask", desc: "Medical & wellness" },
            { id: "media", label: "Media & Audio", icon: "🎬", query: "play,pause,record,speaker,microphone,music,video,image,camera", desc: "Sound & video" },
            { id: "system", label: "System & Interface", icon: "⚙️", query: "gear,faders,bell,shield,lock,key,folder,trash,check,x", desc: "Settings & UI" },
            { id: "weather", label: "Weather", icon: "⛅", query: "sun,moon,cloud,lightning,drop,snowflake,wind", desc: "Atmosphere & nature" }
        ],
        "tabler": [
            { id: "all", label: "All Tabler", icon: "📐", desc: "Complete Tabler collection (6,000+)" },
            { id: "arrows", label: "Arrows", icon: "➔", query: "arrow,chevron,corner,circle-arrow,arrows", desc: "Directional arrows" },
            { id: "brand", label: "Brand", icon: "🏷️", query: "brand,logo,social", desc: "Brands & companies" },
            { id: "commerce", label: "Commerce", icon: "🛒", query: "shopping,cart,discount,receipt,cash,coin,wallet,credit-card", desc: "Shop, payment & bills" },
            { id: "communication", label: "Communication", icon: "💬", query: "mail,message,phone,send,inbox,bell", desc: "Messaging & alert" },
            { id: "devices", label: "Devices", icon: "💻", query: "device,cpu,laptop,phone,tablet,camera,keyboard,mouse", desc: "Hardware & gadgets" },
            { id: "dev", label: "Development", icon: "⌨️", query: "code,git,terminal,database,server,bug,api", desc: "Code, git & database" },
            { id: "filled", label: "Filled / Solid", icon: "⬛", query: "filled", desc: "Solid filled icon variants" },
            { id: "gaming", label: "Gaming", icon: "🎮", query: "device-gamepad,dice,pacman,sword,trophy,playstation", desc: "Games & arcade" },
            { id: "media", label: "Media", icon: "📹", query: "player,movie,photo,music,microphone,headphones,volume", desc: "Video, music & photography" },
            { id: "system", label: "System & UI", icon: "⚙️", query: "settings,adjustments,lock,key,folder,file,trash,check,x", desc: "Settings, security & files" },
            { id: "weather", label: "Weather", icon: "🌧️", query: "sun,moon,cloud,rain,wind,snowflake", desc: "Forecast & climate" }
        ],
        "line-md": [
            { id: "all", label: "All Motion Icons", icon: "⚡", desc: "All 1,100+ animated motion icons" },
            { id: "loading", label: "Loading & Spinners", icon: "🔄", query: "loading,spinner,spin,sync", desc: "Looping spinners & loaders" },
            { id: "arrows", label: "Motion Arrows", icon: "➔", query: "arrow,chevron,download,upload", desc: "Animated drawing arrows" },
            { id: "symbols", label: "Alerts & Status", icon: "🔔", query: "confirm,alert,check,close,cancel,info,question,bell", desc: "Checkmarks, crosses & badges" },
            { id: "interface", label: "Interface & UI", icon: "📱", query: "menu,home,cog,settings,search,filter,heart,star,sun,moon", desc: "Standard animated UI" },
            { id: "media", label: "Media & Player", icon: "🎬", query: "play,pause,stop,volume,mute,music,mic,camera,image", desc: "Play, sound & recording" },
            { id: "weather", label: "Weather Motion", icon: "☀️", query: "sunny,cloudy,rainy,weather,wind", desc: "Sun, rain & clouds" },
            { id: "editing", label: "Editing & Tools", icon: "✏️", query: "edit,pencil,folder,document,trash,link,copy", desc: "Writing, docs & folders" }
        ],
        "simple-icons": [
            { id: "all", label: "All Brands", icon: "🌐", desc: "Complete 3,700+ brand & tech logos" },
            { id: "social", label: "Social Media", icon: "📱", query: "youtube,instagram,tiktok,facebook,x,twitter,reddit,snapchat,pinterest,linkedin,threads", desc: "Popular social platforms" },
            { id: "streaming", label: "Video & Streaming", icon: "📺", query: "youtube,netflix,twitch,vimeo,disneyplus,primevideo,hulu,kick", desc: "Video streaming networks" },
            { id: "creative", label: "Design & Creative", icon: "🎨", query: "adobe,figma,canva,sketch,blender,unrealengine,unity,dribbble,behance,procreate", desc: "Creative tools & suites" },
            { id: "dev", label: "Dev & Code", icon: "💻", query: "github,gitlab,stackoverflow,vscode,visualstudio,python,javascript,react,vue,nodejs,docker", desc: "Developer tools & languages" },
            { id: "tech", label: "Tech & Cloud", icon: "☁️", query: "apple,google,microsoft,amazon,aws,cloudflare,meta,intel,amd,nvidia", desc: "Big tech & cloud providers" },
            { id: "gaming", label: "Gaming", icon: "🎮", query: "steam,playstation,xbox,nintendo,epicgames,discord,roblox,riotgames", desc: "Game stores & consoles" },
            { id: "audio", label: "Music & Audio", icon: "🎧", query: "spotify,applemusic,soundcloud,bandcamp,tidal,deezer,audible", desc: "Music streaming & podcast apps" },
            { id: "crypto", label: "Finance & Crypto", icon: "🪙", query: "bitcoin,ethereum,paypal,stripe,visa,mastercard,shopify", desc: "Payments, banks & crypto" }
        ],
        "pixelarticons": [
            { id: "all", label: "All 8-Bit Pixel", icon: "👾", desc: "Complete 1,300+ retro pixel icons" },
            { id: "gaming", label: "Gaming & Arcade", icon: "🎮", query: "gamepad,arcade,dice,coin,trophy,pixel,vr-headset", desc: "Arcade, controllers & games" },
            { id: "items", label: "Weapons & Items", icon: "🗡️", query: "sword,shield,heart,potion,zap,power,flag,key,lock", desc: "RPG items, health & keys" },
            { id: "arrows", label: "Pixel Arrows", icon: "➔", query: "arrow,chevron,corner,move", desc: "Pixelated directions" },
            { id: "devices", label: "Tech & Devices", icon: "📻", query: "computer,device,camera,headphone,radio,battery,clock", desc: "Retro tech & hardware" },
            { id: "ui", label: "UI & Interface", icon: "📋", query: "menu,checkbox,close,plus,minus,search,trash,user,mail", desc: "Pixelated UI controls" }
        ],
        "heroicons": [
            { id: "all", label: "All Heroicons", icon: "🛡️", desc: "Clean crafted Tailwind Heroicons" },
            { id: "arrows", label: "Arrows", icon: "➔", query: "arrow,chevron", desc: "Directions & navigation" },
            { id: "media", label: "Media", icon: "🎬", query: "play,pause,speaker,video,photo,camera,film,microphone", desc: "Sound, video & photos" },
            { id: "interface", label: "Interface", icon: "⚙️", query: "cog,adjustments,bars,x-mark,check,bell,heart,star,magnifying-glass", desc: "System, settings, search" },
            { id: "users", label: "Users & People", icon: "👤", query: "user,users,user-group,user-circle,user-plus", desc: "Profiles, accounts, teams" },
            { id: "files", label: "Files & Folders", icon: "📁", query: "folder,document,clipboard,archive,trash,inbox", desc: "Folders, docs & storage" }
        ]
    };

    function getCategories(collectionId) {
        if (OFFICIAL_CATEGORIES[collectionId]) {
            return OFFICIAL_CATEGORIES[collectionId];
        }
        return [
            { id: "all", label: "All Icons", icon: "🌐", desc: "All icons in this library" },
            { id: "arrows", label: "Arrows", icon: "➔", query: "arrow,chevron,move", desc: "Navigation & direction" },
            { id: "media", label: "Media & Sound", icon: "🎬", query: "play,pause,sound,volume,music,video", desc: "Audio & video controls" },
            { id: "interface", label: "Interface & UI", icon: "⚙️", query: "cog,settings,menu,close,check,search,user", desc: "Common UI symbols" },
            { id: "files", label: "Files & Folders", icon: "📁", query: "folder,file,document,trash,save", desc: "Content management" }
        ];
    }

    function filterIconsByCategory(iconsList, categoryId, collectionId) {
        if (!categoryId || categoryId === "all") return iconsList;
        const cats = getCategories(collectionId);
        const cat = cats.find(c => c.id === categoryId);
        if (!cat || !cat.query) return iconsList;
        const keywords = cat.query.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
        return iconsList.filter(name => {
            const lower = name.toLowerCase();
            return keywords.some(kw => lower.includes(kw));
        });
    }

    // Low-RAM bounded caches for 4GB-8GB devices
    const MAX_CACHE_ENTRIES = 120;
    const searchCache = new Map();
    const svgCache = new Map();
    const collectionListCache = new Map();
    const batchDataCache = new Map();

    function setBoundedCache(map, key, value) {
        if (map.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = map.keys().next().value;
            map.delete(oldestKey);
        }
        map.set(key, value);
    }

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
        fetchSvgContent: fetchSvgContent,
        getCategories: getCategories,
        filterIconsByCategory: filterIconsByCategory,
        officialCategories: OFFICIAL_CATEGORIES
    };
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = IconEngine;
} else {
    window.IconEngine = IconEngine;
}
