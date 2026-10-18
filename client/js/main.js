// Main Studio Client Controller
const fs = (typeof window !== "undefined" && window.require) ? window.require('fs') : (typeof require !== "undefined" ? require('fs') : null);
const path = (typeof window !== "undefined" && window.require) ? window.require('path') : (typeof require !== "undefined" ? require('path') : null);
const os = (typeof window !== "undefined" && window.require) ? window.require('os') : (typeof require !== "undefined" ? require('os') : null);
const cp = (typeof window !== "undefined" && window.require) ? window.require('child_process') : (typeof require !== "undefined" ? require('child_process') : null);

const csInterface = new CSInterface();

// Active Host Application detection
let hostApp = 'UNKNOWN';

function getActiveProjectDir() {
    return new Promise((resolve) => {
        try {
            csInterface.evalScript('EMOJI_HOST.getProjectDirectory()', (result) => {
                if (result && !result.startsWith("ERROR") && result.trim().length > 0) {
                    resolve(result.trim());
                } else {
                    resolve(null);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });
}

async function resolveAssetsDir() {
    let targetDir = "";
    try {
        const projectDir = await getActiveProjectDir();
        if (projectDir && path) {
            targetDir = path.join(projectDir, "Emoji & Icon Assets");
        } else if (os && path) {
            targetDir = path.join(os.homedir(), "Documents", "Emoji & Icon Studio Assets");
        } else {
            targetDir = "C:\\Emoji & Icon Studio Assets";
        }

        if (fs && !fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Clean any zero-byte or corrupt non-SVG files from assets directory
        if (fs && fs.existsSync(targetDir)) {
            try {
                const files = fs.readdirSync(targetDir);
                for (const f of files) {
                    if (f.toLowerCase().endsWith('.svg')) {
                        const fp = path.join(targetDir, f);
                        const stat = fs.statSync(fp);
                        if (stat.size < 120) {
                            const content = fs.readFileSync(fp, 'utf8');
                            if (!content.includes('<svg')) {
                                fs.unlinkSync(fp);
                            }
                        }
                    }
                }
            } catch (cleanErr) {}
        }
    } catch (e) {
        console.warn("resolveAssetsDir error:", e);
    }

    const storageDisplay = document.getElementById('storage-path-display');
    if (storageDisplay) {
        storageDisplay.textContent = `📁 ${targetDir}`;
        storageDisplay.title = targetDir;
    }

    return targetDir;
}

// State
let currentTab = 'emojis'; // 'emojis', 'icons', 'folders', 'playlists'
let currentStyle = Settings.get('style') || 'google';
let currentTone = '';
let currentMode = Settings.get('insertMode') || 'shape';
let currentFormat = Settings.get('shapeFormat') || 'svg';
let currentCategory = 'all';
let searchQuery = '';

let activeCustomizerItem = null;

// DOM Elements
const assetGrid = document.getElementById('asset-grid');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const statusBar = document.getElementById('status-bar');
const loadingSpinner = document.getElementById('loading-spinner');
const noResults = document.getElementById('no-results');

// ExtendScript initialization
function loadJSX() {
    try {
        if (typeof csInterface !== "undefined" && path && fs) {
            let extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
            if (extPath.indexOf("file://") === 0) extPath = extPath.slice(7);
            extPath = decodeURIComponent(extPath);
            if (extPath.charAt(0) === '/' && extPath.charAt(2) === ':') extPath = extPath.slice(1);

            const jsxPath = path.join(extPath, "host", "index.jsx");
            if (fs.existsSync(jsxPath)) {
                const jsxCode = fs.readFileSync(jsxPath, 'utf8');
                csInterface.evalScript(jsxCode, function(res) {
                    console.log("ExtendScript initialized:", res);
                });
            }
        }
    } catch(err) {
        console.error("loadJSX error:", err);
    }

    try {
        csInterface.evalScript('EMOJI_HOST.getHost()', function(res) {
            if (res && res !== 'EvalScript error.') {
                hostApp = res.trim();
            }
            updateStatus(`Connected to ${hostApp === 'AEFT' ? 'After Effects' : hostApp === 'PPRO' ? 'Premiere Pro' : 'Adobe Host'}`);
        });
    } catch (e) {}
}

function updateStatus(msg, type = 'info') {
    if (statusBar) {
        statusBar.textContent = msg;
        statusBar.className = `status-bar ${type}`;
    }
}

// Category Definitions for Emojis
const EMOJI_CATEGORIES = [
    { id: "all", label: "All Emojis", icon: "✨", desc: "All standard Unicode emojis" },
    { id: "Smileys & Emotion", label: "Smileys & Emotion", icon: "😀", desc: "Faces, emotions & expressions" },
    { id: "People & Body", label: "People & Body", icon: "👋", desc: "Hands, body parts & people" },
    { id: "Animals & Nature", label: "Animals & Nature", icon: "🐶", desc: "Animals, plants & nature" },
    { id: "Food & Drink", label: "Food & Drink", icon: "🍔", desc: "Food, drinks & fruit" },
    { id: "Travel & Places", label: "Travel & Places", icon: "🚗", desc: "Vehicles, buildings & maps" },
    { id: "Activities", label: "Activities", icon: "⚽", desc: "Sports, hobbies & games" },
    { id: "Objects", label: "Objects", icon: "💡", desc: "Tools, gadgets, office & music" },
    { id: "Symbols", label: "Symbols", icon: "❤️", desc: "Hearts, signs & math symbols" },
    { id: "Flags", label: "Flags", icon: "🇺🇸", desc: "Country & regional flags" }
];

// Dynamic Category Bar & Popover Engine
function updateCategoryBarAndPopover() {
    const pillsBar = document.getElementById('category-pills-bar');
    const popoverList = document.getElementById('popover-category-list');
    const filterLabel = document.getElementById('current-filter-label');
    if (!pillsBar || !popoverList) return;

    let categories = [];
    if (currentTab === 'emojis') {
        categories = EMOJI_CATEGORIES;
    } else if (currentTab === 'icons') {
        const libSelect = document.getElementById('icon-library-select');
        const selectedPrefix = libSelect ? libSelect.value : 'all';
        categories = IconEngine.getCategories ? IconEngine.getCategories(selectedPrefix) : [];
    } else if (currentTab === 'folders') {
        categories = [
            { id: "all", label: "All Local Files", icon: "📁", desc: "All icons & images in linked folders" },
            { id: "svg", label: "Vectors (SVG)", icon: "📐", desc: "Scalable vector graphics" },
            { id: "png", label: "Images (PNG/JPG)", icon: "🖼️", desc: "Raster graphics & photos" }
        ];
    } else if (currentTab === 'playlists') {
        const playlists = AssetManager.getPlaylists();
        categories = playlists.map(pl => ({
            id: pl.id,
            label: pl.name,
            icon: pl.id === 'favs' ? '★' : '📋',
            desc: `${pl.items ? pl.items.length : 0} items saved`
        }));
        if (categories.length === 0) {
            categories = [{ id: "favs", label: "Favorites", icon: "★", desc: "Your starred assets" }];
        }
    }

    if (!categories.some(c => c.id === currentCategory)) {
        currentCategory = categories[0] ? categories[0].id : 'all';
    }

    const activeCatObj = categories.find(c => c.id === currentCategory) || categories[0];
    if (filterLabel && activeCatObj) {
        filterLabel.textContent = activeCatObj.label.replace(/^[^\w\s]+\s*/, '');
    }

    // Populate Horizontal Pills Bar
    pillsBar.innerHTML = '';
    categories.forEach(cat => {
        const pill = document.createElement('button');
        pill.className = `platform-pill ${cat.id === currentCategory ? 'active' : ''}`;
        pill.dataset.cat = cat.id;
        pill.innerHTML = `<span>${cat.icon ? cat.icon + ' ' : ''}${cat.label}</span>`;
        pill.addEventListener('click', () => {
            selectCategory(cat.id, cat.label);
        });
        pillsBar.appendChild(pill);
    });

    // Populate Floating Popover
    popoverList.innerHTML = '';
    categories.forEach(cat => {
        const item = document.createElement('div');
        const isActive = cat.id === currentCategory;
        item.className = `popover-item ${isActive ? 'active' : ''}`;
        item.dataset.cat = cat.id;
        item.innerHTML = `
            <span class="popover-icon">${cat.icon || '•'}</span>
            <div class="popover-text">
                <div class="popover-title">${cat.label}</div>
                <div class="popover-desc">${cat.desc || ''}</div>
            </div>
            ${isActive ? '<span class="popover-check">✓</span>' : ''}
        `;
        item.addEventListener('click', () => {
            selectCategory(cat.id, cat.label);
            closeCategoryPopover();
        });
        popoverList.appendChild(item);
    });
}

function selectCategory(catId, catLabel) {
    currentCategory = catId;
    const filterLabel = document.getElementById('current-filter-label');
    if (filterLabel && catLabel) {
        filterLabel.textContent = catLabel.replace(/^[^\w\s]+\s*/, '');
    }
    document.querySelectorAll('#category-pills-bar .platform-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.cat === catId);
    });
    document.querySelectorAll('#popover-category-list .popover-item').forEach(it => {
        const isActive = (it.dataset.cat === catId);
        it.classList.toggle('active', isActive);
        let check = it.querySelector('.popover-check');
        if (isActive && !check) {
            const span = document.createElement('span');
            span.className = 'popover-check';
            span.textContent = '✓';
            it.appendChild(span);
        } else if (!isActive && check) {
            check.remove();
        }
    });
    renderCurrentTab();
}

function closeCategoryPopover() {
    const popoverEl = document.getElementById('category-popover');
    const btnPopover = document.getElementById('btn-category-popover');
    if (popoverEl) popoverEl.style.display = 'none';
    if (btnPopover) btnPopover.classList.remove('active');
}

// Tab Switching
function initTabs() {
    const tabButtons = document.querySelectorAll('.studio-tab, .nav-tab-btn');
    const emojiSub = document.getElementById('emoji-subtoolbar');
    const iconControls = document.getElementById('icon-controls-inline');
    const folderSub = document.getElementById('folder-subtoolbar');
    const playlistSub = document.getElementById('playlist-subtoolbar');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            currentCategory = 'all';

            if (emojiSub) emojiSub.style.display = (currentTab === 'emojis') ? 'flex' : 'none';
            if (iconControls) iconControls.style.display = (currentTab === 'icons') ? 'flex' : 'none';
            if (folderSub) folderSub.style.display = (currentTab === 'folders') ? 'flex' : 'none';
            if (playlistSub) playlistSub.style.display = (currentTab === 'playlists') ? 'flex' : 'none';

            closeCategoryPopover();
            updateCategoryBarAndPopover();
            renderCurrentTab();
        });
    });

    // Wire Popover Toggle
    const btnPopover = document.getElementById('btn-category-popover');
    const popoverEl = document.getElementById('category-popover');
    if (btnPopover && popoverEl) {
        btnPopover.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popoverEl.style.display === 'flex';
            if (isOpen) {
                closeCategoryPopover();
            } else {
                popoverEl.style.display = 'flex';
                btnPopover.classList.add('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (popoverEl.style.display === 'flex' && !popoverEl.contains(e.target) && e.target !== btnPopover && !btnPopover.contains(e.target)) {
                closeCategoryPopover();
            }
        });
    }

    updateCategoryBarAndPopover();
}

function renderCurrentTab() {
    if (currentTab === 'emojis') {
        renderEmojis();
    } else if (currentTab === 'icons') {
        renderIcons();
    } else if (currentTab === 'folders') {
        renderFolders();
    } else if (currentTab === 'playlists') {
        renderPlaylists();
    }
}

// ----------------------------------------------------
// TAB 1: EMOJIS (Throttled for 4GB-8GB Low RAM Devices)
// ----------------------------------------------------
let displayedEmojiCount = 0;
const CHUNK_SIZE = 60;
let currentFilteredEmojis = [];

function renderEmojis(reset = true) {
    if (reset) {
        assetGrid.innerHTML = '';
        displayedEmojiCount = 0;
        let query = (searchQuery || '').trim().toLowerCase();
        
        currentFilteredEmojis = EMOJI_DB.filter(emoji => {
            const matchesCat = (currentCategory === 'all' || emoji.group === currentCategory);
            const matchesQuery = (!query || emoji.name.toLowerCase().includes(query) || (emoji.keywords && emoji.keywords.includes(query)));
            return matchesCat && matchesQuery;
        });

        if (currentFilteredEmojis.length === 0) {
            noResults.style.display = 'block';
            updateStatus("No matching emojis found.");
            return;
        } else {
            noResults.style.display = 'none';
        }
    }

    const nextBatch = currentFilteredEmojis.slice(displayedEmojiCount, displayedEmojiCount + CHUNK_SIZE);
    nextBatch.forEach(emoji => {
        const card = createEmojiCard(emoji);
        assetGrid.appendChild(card);
    });
    displayedEmojiCount += nextBatch.length;
    updateStatus(`Showing ${displayedEmojiCount} of ${currentFilteredEmojis.length.toLocaleString()} emojis (scroll for more)`);
}

function createEmojiCard(emoji) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.title = emoji.name;

    const rawChar = emoji.char || emoji.emoji || '';
    const emojiChar = applySkinTone(rawChar, currentTone, emoji);

    const img = document.createElement('img');
    img.alt = emoji.name;
    img.loading = "lazy";
    img.src = getEmojiDownloadUrl(emojiChar, currentStyle, 'png');
    img.onerror = function() {
        if (this.dataset.fallback !== 'apple' && currentStyle !== 'apple') {
            this.dataset.fallback = 'apple';
            this.src = `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=apple`;
        } else if (this.dataset.fallback !== 'google' && currentStyle !== 'google') {
            this.dataset.fallback = 'google';
            this.src = `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=google`;
        } else {
            const parent = this.parentElement;
            if (parent) {
                parent.innerHTML = '';
                const span = document.createElement('span');
                span.className = 'card-emoji-text';
                span.textContent = emojiChar;
                parent.appendChild(span);
            }
        }
    };
    card.appendChild(img);

    card.addEventListener('click', () => {
        openCustomizer({
            type: 'emoji',
            emojiChar: emojiChar,
            name: emoji.name,
            style: currentStyle
        });
    });

    return card;
}

function applySkinTone(baseEmoji, tone, emojiObj) {
    if (!tone) return baseEmoji;
    // Strictly prevent tone modifiers from being attached to smileys, objects, animals, etc.
    // Unicode tone modifiers only apply to emojis that explicitly support skin tones
    if (emojiObj && !emojiObj.skin_tone_support) return baseEmoji;
    return baseEmoji + tone;
}

function getEmojiHex(emojiStr) {
    const codePoints = [];
    for (let char of emojiStr) {
        codePoints.push(char.codePointAt(0).toString(16));
    }
    return codePoints.filter(cp => cp !== 'fe0f').join('-');
}

function getEmojiDownloadUrl(emojiChar, style, format) {
    const hex = getEmojiHex(emojiChar).toLowerCase();
    if (style === 'microsoft') {
        return `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${hex}_3d.png`;
    }
    if (style === 'twitter') {
        if (format === 'svg') {
            return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${hex}.svg`;
        }
        return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${hex}.png`;
    }
    if (style === 'google') {
        return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=google`;
    }
    if (style === 'apple') {
        return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=apple`;
    }
    return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=${style}`;
}

// ----------------------------------------------------
// TAB 2: ICONS (200k+ Online Streaming & Infinite Scroll)
// ----------------------------------------------------
let currentIconList = [];
let displayedIconCount = 0;
let isIconLoading = false;
const ICON_CHUNK_SIZE = 60;

async function renderIcons(reset = true) {
    const librarySelect = document.getElementById('icon-library-select');
    const selectedPrefix = librarySelect ? librarySelect.value : 'all';
    const query = (searchQuery || '').trim();

    if (reset) {
        assetGrid.innerHTML = '';
        displayedIconCount = 0;
        noResults.style.display = 'none';
        loadingSpinner.style.display = 'flex';
        updateStatus("Loading icon collection...");

        try {
            if (query) {
                currentIconList = await IconEngine.searchIcons(query, selectedPrefix);
            } else if (!selectedPrefix || selectedPrefix === 'all') {
                currentIconList = await IconEngine.getAllLibrariesStream();
            } else {
                currentIconList = await IconEngine.getCollectionIcons(selectedPrefix);
            }

            // Filter by official library category if selected
            if (currentCategory && currentCategory !== 'all') {
                currentIconList = IconEngine.filterIconsByCategory(currentIconList, currentCategory, selectedPrefix);
            }
        } catch (err) {
            console.error("renderIcons error:", err);
            currentIconList = [];
        }

        loadingSpinner.style.display = 'none';

        if (!currentIconList || currentIconList.length === 0) {
            noResults.style.display = 'block';
            updateStatus("No matching icons found.");
            return;
        }
    }

    await loadMoreIcons();
}

async function loadMoreIcons() {
    if (isIconLoading || displayedIconCount >= currentIconList.length) return;
    isIconLoading = true;
    loadingSpinner.style.display = 'flex';

    const nextBatch = currentIconList.slice(displayedIconCount, displayedIconCount + ICON_CHUNK_SIZE);
    displayedIconCount += nextBatch.length;

    const quickColor = (document.getElementById('quick-icon-color') && document.getElementById('quick-icon-color').value) || '#ffffff';

    try {
        const svgMap = await IconEngine.fetchBatchIcons(nextBatch, { color: quickColor, strokeWidth: 1.8 });

        nextBatch.forEach((iconFullName) => {
            const card = document.createElement('div');
            card.className = 'asset-card';
            card.title = iconFullName;

            const iconContainer = document.createElement('div');
            iconContainer.className = 'icon-container';
            iconContainer.style.width = '28px';
            iconContainer.style.height = '28px';
            iconContainer.style.display = 'flex';
            iconContainer.style.alignItems = 'center';
            iconContainer.style.justifyContent = 'center';
            card.appendChild(iconContainer);

            const svgContent = svgMap[iconFullName];
            if (svgContent) {
                iconContainer.innerHTML = svgContent;
                const svgEl = iconContainer.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.pointerEvents = 'none';
                }
            } else {
                // Fallback to online SVG image if not present in batch
                const imgFallback = document.createElement('img');
                imgFallback.src = IconEngine.buildSvgUrl(iconFullName, { color: quickColor });
                imgFallback.style.width = '100%';
                imgFallback.style.height = '100%';
                imgFallback.style.pointerEvents = 'none';
                iconContainer.appendChild(imgFallback);
            }

            card.addEventListener('click', () => {
                openCustomizer({
                    type: 'icon',
                    iconFullName: iconFullName,
                    name: iconFullName.split(':')[1] || iconFullName,
                    color: quickColor,
                    strokeWidth: 2
                });
            });

            assetGrid.appendChild(card);
        });

        updateStatus(`Showing ${displayedIconCount} of ${currentIconList.length.toLocaleString()} icons (scroll for more)`);

        // If content does not yet fill the scrollable container, automatically load the next batch
        setTimeout(() => {
            const scrollContainer = document.querySelector('.emoji-container');
            if (scrollContainer && scrollContainer.scrollHeight <= scrollContainer.clientHeight + 100 && displayedIconCount < currentIconList.length) {
                loadMoreIcons();
            }
        }, 50);
    } catch (err) {
        console.error("loadMoreIcons error:", err);
    } finally {
        isIconLoading = false;
        loadingSpinner.style.display = 'none';
    }
}

// ----------------------------------------------------
// TAB 3: LOCAL FOLDERS
// ----------------------------------------------------
// TAB 3: LOCAL FOLDERS
// ----------------------------------------------------
function renderFolders() {
    assetGrid.innerHTML = '';
    noResults.style.display = 'none';

    const select = document.getElementById('linked-folder-select');
    const folderPath = select ? select.value : '';

    if (!folderPath) {
        assetGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px 14px; color: var(--text-muted);">
                <div style="font-size: 38px; margin-bottom: 10px;">📁</div>
                <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">No Linked Folder Selected</div>
                <div style="font-size: 11px; margin-bottom: 16px; color: var(--text-secondary); max-width: 260px; margin-left: auto; margin-right: auto;">Select or link your local SVG/PNG icons, stickers, client assets, or Google Drive folder.</div>
                <button id="btn-browse-empty-folder" class="primary-btn" style="padding: 7px 18px;">+ Link Folder</button>
            </div>
        `;
        const btnEmpty = document.getElementById('btn-browse-empty-folder');
        if (btnEmpty) {
            btnEmpty.addEventListener('click', () => {
                const btn = document.getElementById('btn-add-folder');
                if (btn) btn.click();
            });
        }
        updateStatus("No local folder selected.");
        return;
    }

    let items = AssetManager.scanFolder(folderPath);

    // Apply category filter for folders: 'all', 'svg', 'png'
    if (currentCategory === 'svg') {
        items = items.filter(it => it.ext === '.svg');
    } else if (currentCategory === 'png') {
        items = items.filter(it => it.ext !== '.svg');
    }

    // Apply search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(it => it.name.toLowerCase().includes(q));
    }

    if (items.length === 0) {
        assetGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <p>No matching files found in this folder (.svg, .png, .jpg, .webp)</p>
            </div>
        `;
        updateStatus("0 files found in folder.");
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.title = item.name;

        const img = document.createElement('img');
        img.src = `file://${item.fullPath.replace(/\\/g, '/')}`;
        card.appendChild(img);

        const badge = document.createElement('span');
        badge.className = 'asset-badge';
        badge.textContent = item.ext.replace('.', '');
        card.appendChild(badge);

        // Individual item delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'asset-delete-btn';
        delBtn.title = `Delete ${item.fileName}`;
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Permanently delete "${item.fileName}" from disk?`)) {
                try {
                    if (fs && fs.existsSync(item.fullPath)) {
                        fs.unlinkSync(item.fullPath);
                    }
                    renderFolders();
                    updateStatus(`Deleted ${item.fileName}`, 'info');
                } catch (delErr) {
                    alert(`Failed to delete: ${delErr.message}`);
                }
            }
        });
        card.appendChild(delBtn);

        card.addEventListener('click', () => {
            openCustomizer({
                type: 'local',
                name: item.name,
                fullPath: item.fullPath,
                ext: item.ext
            });
        });

        assetGrid.appendChild(card);
    });

    updateStatus(`Showing ${items.length} files from ${path ? path.basename(folderPath) : folderPath}`);
}

// ----------------------------------------------------
// TAB 4: PLAYLISTS
// ----------------------------------------------------
function renderPlaylists() {
    assetGrid.innerHTML = '';
    noResults.style.display = 'none';

    const select = document.getElementById('playlist-select');
    const playlistId = select ? select.value : 'favs';
    const playlists = AssetManager.getPlaylists();
    const currentList = playlists.find(p => p.id === playlistId) || playlists[0];

    if (!currentList || !currentList.items || currentList.items.length === 0) {
        assetGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #8e8e8e;">
                <p style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">Playlist "${currentList ? currentList.name : 'Favorites'}" is empty</p>
                <p style="font-size: 11px;">Click any icon or emoji, then click <b>"★ Save"</b> in the preview modal to add it here!</p>
            </div>
        `;
        return;
    }

    currentList.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.title = item.name;

        if (item.type === 'emoji') {
            const img = document.createElement('img');
            img.src = getEmojiDownloadUrl(item.emojiChar, currentStyle, 'png');
            img.onerror = function() {
                const parent = this.parentElement;
                if (parent) {
                    parent.innerHTML = '';
                    const span = document.createElement('span');
                    span.className = 'card-emoji-text';
                    span.textContent = item.emojiChar;
                    parent.appendChild(span);
                }
            };
            card.appendChild(img);
        } else if (item.type === 'icon') {
            const iconContainer = document.createElement('div');
            iconContainer.style.width = '28px';
            iconContainer.style.height = '28px';
            card.appendChild(iconContainer);
            IconEngine.fetchSvgContent(item.iconFullName, { color: item.color || '#fff' }).then(svg => {
                iconContainer.innerHTML = svg;
            }).catch(() => {});
        } else if (item.type === 'local') {
            const img = document.createElement('img');
            img.src = `file://${item.fullPath.replace(/\\/g, '/')}`;
            card.appendChild(img);
        }

        // Remove item from playlist button
        const delBtn = document.createElement('button');
        delBtn.className = 'asset-delete-btn';
        delBtn.title = `Remove from playlist`;
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = item.id || item.iconFullName || item.emojiChar || item.name;
            AssetManager.removeFromPlaylist(playlistId, itemId);
            const plSelect = document.getElementById('playlist-select');
            if (plSelect) {
                const currentVal = plSelect.value;
                plSelect.innerHTML = '';
                AssetManager.getPlaylists().forEach(pl => {
                    const opt = document.createElement('option');
                    opt.value = pl.id;
                    opt.textContent = `${pl.name} (${pl.items ? pl.items.length : 0})`;
                    plSelect.appendChild(opt);
                });
                plSelect.value = currentVal;
            }
            renderPlaylists();
        });
        card.appendChild(delBtn);

        card.addEventListener('click', () => {
            openCustomizer(item);
        });

        assetGrid.appendChild(card);
    });
}

// ----------------------------------------------------
// LIVE CUSTOMIZER & PREVIEW MODAL
// ----------------------------------------------------
const customizerModal = document.getElementById('customizer-modal');
const previewRenderBox = document.getElementById('preview-render-box');
const previewStage = document.getElementById('preview-stage');
const modalColorPicker = document.getElementById('modal-color-picker');
const modalColorHex = document.getElementById('modal-color-hex');
const modalStrokeSlider = document.getElementById('modal-stroke-slider');
const modalStrokeVal = document.getElementById('modal-stroke-val');
const modalSizeSlider = document.getElementById('modal-size-slider');
const modalSizeVal = document.getElementById('modal-size-val');
const strokeControlRow = document.getElementById('stroke-control-row');

async function openCustomizer(item) {
    activeCustomizerItem = item;
    const title = document.getElementById('customizer-title');
    if (title) title.textContent = `Customize: ${item.name}`;

    const plSelect = document.getElementById('modal-playlist-select');
    if (plSelect) {
        plSelect.innerHTML = '';
        AssetManager.getPlaylists().forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = pl.name;
            plSelect.appendChild(opt);
        });
    }

    if (item.type === 'icon') {
        if (strokeControlRow) strokeControlRow.style.display = 'flex';
        if (modalColorPicker) modalColorPicker.value = item.color || '#ffffff';
        if (modalColorHex) modalColorHex.value = item.color || '#ffffff';
    } else {
        if (strokeControlRow) strokeControlRow.style.display = 'none';
    }

    const curSize = Settings.get('insertSize') || 256;
    if (modalSizeSlider) modalSizeSlider.value = curSize;
    const modalSizeInput = document.getElementById('modal-size-input');
    if (modalSizeInput) modalSizeInput.value = curSize;

    const curStroke = Settings.get('strokeWidth') || 2.0;
    if (modalStrokeSlider) modalStrokeSlider.value = curStroke;
    const modalStrokeInput = document.getElementById('modal-stroke-input');
    if (modalStrokeInput) modalStrokeInput.value = curStroke;

    updateCustomizerPreview();
    if (customizerModal) customizerModal.style.display = 'flex';
}

async function updateCustomizerPreview() {
    if (!activeCustomizerItem || !previewRenderBox) return;
    previewRenderBox.innerHTML = '';

    const color = (modalColorHex && modalColorHex.value) || '#ffffff';
    const strokeInput = document.getElementById('modal-stroke-input');
    const strokeWidth = (strokeInput && parseFloat(strokeInput.value)) || (modalStrokeSlider && parseFloat(modalStrokeSlider.value)) || 2;

    if (activeCustomizerItem.type === 'emoji') {
        const img = document.createElement('img');
        img.src = getEmojiDownloadUrl(activeCustomizerItem.emojiChar, currentStyle, 'png');
        img.onerror = function() {
            if (this.dataset.fallback !== 'apple' && currentStyle !== 'apple') {
                this.dataset.fallback = 'apple';
                this.src = `https://emojicdn.elk.sh/${encodeURIComponent(activeCustomizerItem.emojiChar)}?style=apple`;
            } else if (this.dataset.fallback !== 'google' && currentStyle !== 'google') {
                this.dataset.fallback = 'google';
                this.src = `https://emojicdn.elk.sh/${encodeURIComponent(activeCustomizerItem.emojiChar)}?style=google`;
            } else {
                previewRenderBox.innerHTML = '';
                const span = document.createElement('span');
                span.style.fontSize = '50px';
                span.textContent = activeCustomizerItem.emojiChar;
                previewRenderBox.appendChild(span);
            }
        };
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        previewRenderBox.appendChild(img);
    } else if (activeCustomizerItem.type === 'icon') {
        try {
            const svgContent = await IconEngine.fetchSvgContent(activeCustomizerItem.iconFullName, {
                color: color,
                strokeWidth: strokeWidth
            });
            previewRenderBox.innerHTML = svgContent;
        } catch (e) {
            console.warn("Preview svg failed:", e);
        }
    } else if (activeCustomizerItem.type === 'local') {
        const img = document.createElement('img');
        img.src = `file://${activeCustomizerItem.fullPath.replace(/\\/g, '/')}`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        previewRenderBox.appendChild(img);
    }
}

// ----------------------------------------------------
// CANVAS RASTERIZATION & TIMELINE INSERTION
// ----------------------------------------------------
function convertSvgToPng(svgText, targetDimension = 1024) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            const blobUrl = URL.createObjectURL(svgBlob);
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = targetDimension;
                    canvas.height = targetDimension;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, targetDimension, targetDimension);
                    ctx.drawImage(img, 0, 0, targetDimension, targetDimension);
                    URL.revokeObjectURL(blobUrl);
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                    resolve(Buffer.from(base64Data, 'base64'));
                } catch (canvasErr) {
                    URL.revokeObjectURL(blobUrl);
                    reject(canvasErr);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error("Failed to render SVG onto canvas"));
            };
            img.src = blobUrl;
        } catch (e) {
            reject(e);
        }
    });
}

async function insertActiveCustomizerItem() {
    if (!activeCustomizerItem) return;
    if (customizerModal) customizerModal.style.display = 'none';

    const item = activeCustomizerItem;
    const modalSizeInput = document.getElementById('modal-size-input');
    const modalStrokeInput = document.getElementById('modal-stroke-input');
    const size = (modalSizeInput && parseInt(modalSizeInput.value, 10)) || (modalSizeSlider && parseInt(modalSizeSlider.value, 10)) || 256;
    const color = (modalColorHex && modalColorHex.value) || '#ffffff';
    const strokeWidth = (modalStrokeInput && parseFloat(modalStrokeInput.value)) || (modalStrokeSlider && parseFloat(modalStrokeSlider.value)) || 2;
    const isPremiere = (hostApp === 'PPRO');

    updateStatus(`Preparing ${item.name}...`, 'info');

    const assetsDir = await resolveAssetsDir();

    try {
        if (item.type === 'local') {
            triggerHostImport(item.fullPath, item.name, size);
            return;
        }

        if (item.type === 'icon') {
            let svgText = await IconEngine.fetchSvgContent(item.iconFullName, {
                color: color,
                strokeWidth: strokeWidth
            });

            // Ensure animated or trimmed stroke lines are fully visible at t=0
            svgText = svgText
                .replace(/stroke-dashoffset="[^"]*"/g, 'stroke-dashoffset="0"')
                .replace(/visibility="hidden"/g, '')
                .replace(/opacity="0"/g, 'opacity="1"');

            const isAnimated = !!(item.iconFullName && item.iconFullName.startsWith('line-md'));
            const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const colorClean = color.replace('#', '');

            if (isPremiere || currentFormat === 'png') {
                const pngBuffer = await convertSvgToPng(svgText, 1024);
                const localPng = path.join(assetsDir, `icon_${cleanName}_${colorClean}.png`);
                fs.writeFileSync(localPng, pngBuffer);
                triggerHostImport(localPng, item.name, size, isAnimated);
            } else {
                const localSvg = path.join(assetsDir, `icon_${cleanName}_${colorClean}.svg`);
                fs.writeFileSync(localSvg, svgText, 'utf8');
                triggerHostImport(localSvg, item.name, size, isAnimated);
            }
        } else if (item.type === 'emoji') {
            const hex = getEmojiHex(item.emojiChar);
            const ext = (isPremiere || currentFormat === 'png') ? 'png' : 'svg';
            const localFile = path.join(assetsDir, `emoji_${currentStyle}_${hex}.${ext}`);

            let needsDownload = true;
            if (fs && fs.existsSync(localFile) && fs.statSync(localFile).size > 100) {
                if (ext === 'svg') {
                    const content = fs.readFileSync(localFile, 'utf8');
                    if (content.includes('<svg') && content.includes('</svg>')) {
                        needsDownload = false;
                    } else {
                        try { fs.unlinkSync(localFile); } catch (e) {}
                    }
                } else {
                    needsDownload = false;
                }
            }

            if (needsDownload) {
                if (ext === 'svg') {
                    let svgText = '';
                    const twemojiUrl = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${hex}.svg`;
                    try {
                        svgText = await Net.get(twemojiUrl);
                    } catch (e) {
                        const notoHex = hex.replace(/-/g, '_');
                        const notoUrl = `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@master/svg/emoji_u${notoHex}.svg`;
                        try {
                            svgText = await Net.get(notoUrl);
                        } catch (e2) {}
                    }

                    if (svgText && svgText.includes('<svg')) {
                        fs.writeFileSync(localFile, svgText, 'utf8');
                    } else {
                        // If no vector SVG available for this emoji, fallback to 1024px PNG
                        const pngUrl = `https://emojicdn.elk.sh/${encodeURIComponent(item.emojiChar)}?style=${currentStyle}`;
                        const fallbackPng = path.join(assetsDir, `emoji_${currentStyle}_${hex}.png`);
                        await Net.downloadFile(pngUrl, fallbackPng);
                        triggerHostImport(fallbackPng, item.name, size);
                        return;
                    }
                } else {
                    const dlUrl = getEmojiDownloadUrl(item.emojiChar, currentStyle, 'png');
                    try {
                        await Net.downloadFile(dlUrl, localFile);
                    } catch (dlErr) {
                        const fallbackUrl = `https://emojicdn.elk.sh/${encodeURIComponent(item.emojiChar)}?style=apple`;
                        await Net.downloadFile(fallbackUrl, localFile);
                    }
                }
            }
            triggerHostImport(localFile, item.name, size);
        }
    } catch (err) {
        console.error("Insertion error:", err);
        updateStatus(`Failed: ${err.message}`, 'error');
    }
}

function triggerHostImport(filePath, assetName, size, isAnimated = false) {
    const isPremiere = (hostApp === 'PPRO');
    const safePath = filePath.replace(/\\/g, "\\\\");
    const safeName = assetName.replace(/["\\]/g, "");

    updateStatus(`Inserting ${assetName} into timeline...`, 'info');

    if (isPremiere) {
        const script = `EMOJI_HOST.prInsertFootage("${safePath}", "${safeName}")`;
        csInterface.evalScript(script, (result) => {
            if (result === 'SUCCESS') {
                updateStatus(`Inserted ${assetName} into Premiere timeline!`, 'success');
            } else {
                updateStatus(result || 'Premiere insertion failed', 'error');
            }
        });
    } else {
        const convertToShape = (currentFormat === 'svg' && filePath.toLowerCase().endsWith('.svg'));
        const script = `EMOJI_HOST.aeInsertFootage("${safePath}", "${safeName}", ${size}, ${convertToShape}, ${isAnimated})`;
        csInterface.evalScript(script, (result) => {
            if (result === 'SUCCESS') {
                updateStatus(`Inserted ${assetName} into AE composition!`, 'success');
            } else {
                updateStatus(result || 'AE insertion failed', 'error');
            }
        });
    }
}

// ----------------------------------------------------
// INITIALIZATION & EVENT LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadJSX();
    initTabs();

    // Populate Icon Library dropdown (Compact Short Labels)
    try {
        const libSelect = document.getElementById('icon-library-select');
        if (libSelect) {
            IconEngine.collections.forEach(col => {
                const opt = document.createElement('option');
                opt.value = col.id;
                let shortName = col.name;
                if (col.id === 'all') shortName = 'All';
                else if (col.id === 'simple-icons') shortName = 'Brands';
                else if (col.id === 'flagpack') shortName = 'Flags';
                else if (col.id === 'line-md') shortName = 'Line MD';
                else if (col.id === 'pixelarticons') shortName = 'Pixel';
                else if (col.id === 'akar-icons') shortName = 'Akar';
                else if (col.id === 'css.gg') shortName = 'CSS.gg';
                opt.textContent = shortName;
                opt.title = `${col.name} ${col.count ? '(' + col.count + ')' : ''}`;
                libSelect.appendChild(opt);
            });

            libSelect.addEventListener('change', () => {
                currentCategory = 'all';
                updateCategoryBarAndPopover();
                if (currentTab === 'icons') renderIcons();
            });
        }
    } catch (e) {
        console.warn("libSelect init error:", e);
    }

    // Native Adobe Folder Selection Dialog (Zero OS Shell / Prompt)
    function pickFolderNative(callback) {
        try {
            const cepFs = window.cep && window.cep.fs;
            if (cepFs && typeof cepFs.showOpenDialogEx === 'function') {
                const res = cepFs.showOpenDialogEx(false, true, "Select Folder for Icons & Assets", "", []);
                if (res && res.data && res.data.length > 0 && res.data[0]) {
                    callback(res.data[0]);
                    return;
                } else if (res && Array.isArray(res.data)) {
                    return; // user canceled
                }
            }
            if (cepFs && typeof cepFs.showOpenDialog === 'function') {
                const res = cepFs.showOpenDialog(false, true, "Select Folder for Icons & Assets", "", []);
                if (res && res.data && res.data.length > 0 && res.data[0]) {
                    callback(res.data[0]);
                    return;
                } else if (res && Array.isArray(res.data)) {
                    return;
                }
            }
        } catch (e) {
            console.warn("cep.fs folder dialog error:", e);
        }
        // Fallback: Adobe ExtendScript Folder.selectDialog
        if (typeof csInterface !== 'undefined') {
            csInterface.evalScript('EMOJI_HOST.selectFolderDialog("Select Folder for Icons & Assets")', function(res) {
                const cleaned = (res || "").trim();
                if (cleaned && !cleaned.startsWith("ERROR") && cleaned !== "undefined" && cleaned !== "null" && cleaned !== "false") {
                    callback(cleaned);
                }
            });
        }
    }

    // Populate Linked Folders dropdown
    const folderSelect = document.getElementById('linked-folder-select');
    function updateFolderDropdown() {
        if (!folderSelect) return;
        folderSelect.innerHTML = '<option value="">-- Select Linked Folder --</option>';
        AssetManager.getLinkedFolders().forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = (path ? path.basename(f) : f) + ` (${f})`;
            folderSelect.appendChild(opt);
        });
    }
    updateFolderDropdown();

    if (folderSelect) {
        folderSelect.addEventListener('change', () => {
            if (currentTab === 'folders') renderFolders();
        });
    }

    // Link Folder Button (Smooth Native Picker)
    const btnAddFolder = document.getElementById('btn-add-folder');
    if (btnAddFolder) {
        btnAddFolder.addEventListener('click', () => {
            pickFolderNative((folder) => {
                if (folder && fs && fs.existsSync(folder)) {
                    AssetManager.addLinkedFolder(folder);
                    updateFolderDropdown();
                    folderSelect.value = folder;
                    renderFolders();
                }
            });
        });
    }

    // Unlink Folder Button
    const btnRemoveFolder = document.getElementById('btn-remove-folder');
    if (btnRemoveFolder) {
        btnRemoveFolder.addEventListener('click', () => {
            const current = folderSelect ? folderSelect.value : null;
            if (current) {
                AssetManager.removeLinkedFolder(current);
                updateFolderDropdown();
                renderFolders();
            }
        });
    }

    // Populate Playlists dropdown
    const plSelect = document.getElementById('playlist-select');
    function updatePlaylistDropdown() {
        if (!plSelect) return;
        plSelect.innerHTML = '';
        AssetManager.getPlaylists().forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = `${pl.name} (${pl.items ? pl.items.length : 0})`;
            plSelect.appendChild(opt);
        });
    }
    updatePlaylistDropdown();

    if (plSelect) {
        plSelect.addEventListener('change', () => {
            if (currentTab === 'playlists') renderPlaylists();
        });
    }

    // Playlist buttons
    const btnNewPl = document.getElementById('btn-new-playlist');
    if (btnNewPl) {
        btnNewPl.addEventListener('click', () => {
            const name = prompt("Enter new playlist name:");
            if (name) {
                const id = AssetManager.createPlaylist(name);
                updatePlaylistDropdown();
                plSelect.value = id;
                renderPlaylists();
            }
        });
    }

    const btnDelPl = document.getElementById('btn-delete-playlist');
    if (btnDelPl) {
        btnDelPl.addEventListener('click', () => {
            if (plSelect.value === 'favs') {
                alert("The default Favorites playlist cannot be deleted.");
                return;
            }
            if (confirm("Delete this playlist?")) {
                AssetManager.deletePlaylist(plSelect.value);
                updatePlaylistDropdown();
                renderPlaylists();
            }
        });
    }

    // Debounced Search Bar & Dedicated Search Button
    let searchDebounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const val = searchInput.value;
            if (clearSearchBtn) clearSearchBtn.style.display = val ? 'block' : 'none';
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchQuery = val;
                renderCurrentTab();
            }, 180);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchDebounceTimer);
                searchQuery = searchInput.value;
                renderCurrentTab();
                document.querySelector('.emoji-container')?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    const mainSearchBtn = document.getElementById('main-search-btn');
    if (mainSearchBtn) {
        mainSearchBtn.addEventListener('click', () => {
            clearTimeout(searchDebounceTimer);
            searchQuery = searchInput ? searchInput.value : '';
            renderCurrentTab();
            document.querySelector('.emoji-container')?.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.style.display = 'none';
            renderCurrentTab();
        });
    }

    // Skin tones
    const skinToneSelector = document.getElementById('skin-tone-selector');
    if (skinToneSelector) {
        skinToneSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.tone-btn');
            if (!btn) return;
            document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTone = btn.dataset.tone;
            renderEmojis(true);
        });
    }

    // Settings Drawer
    const toggleSettingsBtn = document.getElementById('toggle-settings');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsDrawer = document.getElementById('settings-drawer');

    if (toggleSettingsBtn && settingsDrawer) {
        toggleSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = (settingsDrawer.style.display === 'none' || !settingsDrawer.style.display);
            settingsDrawer.style.display = isHidden ? 'flex' : 'none';
        });
    }
    if (closeSettingsBtn && settingsDrawer) {
        closeSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            settingsDrawer.style.display = 'none';
        });
    }

    // Open Assets Folder Button
    const openAssetsBtn = document.getElementById('open-assets-btn');
    if (openAssetsBtn) {
        openAssetsBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const currentDir = await resolveAssetsDir();
            if (cp) {
                cp.exec(`explorer "${currentDir}"`);
            }
        });
    }

    // Wire Insert Mode Toggle (Shape vs Text)
    const insertModeToggle = document.getElementById('insert-mode-toggle');
    if (insertModeToggle) {
        insertModeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (!btn) return;
            insertModeToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            Settings.set('insertMode', currentMode);
            const composer = document.getElementById('composer-container');
            if (composer) {
                composer.style.display = (currentMode === 'text') ? 'flex' : 'none';
            }
        });
    }

    // Wire Vector Format Toggle (SVG vs PNG)
    const shapeFormatToggle = document.getElementById('shape-format-toggle');
    if (shapeFormatToggle) {
        shapeFormatToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (!btn) return;
            shapeFormatToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFormat = btn.dataset.format;
            Settings.set('shapeFormat', currentFormat);
        });
    }

    // Wire Emoji Artwork Style Select
    const styleSelect = document.getElementById('style-select');
    if (styleSelect) {
        styleSelect.value = currentStyle;
        styleSelect.addEventListener('change', () => {
            currentStyle = styleSelect.value;
            Settings.set('style', currentStyle);
            if (currentTab === 'emojis') renderEmojis(true);
        });
    }

    // Wire Settings Size: Slider <-> Manual Number Input
    const sizeSlider = document.getElementById('size-slider');
    const settingSizeInput = document.getElementById('setting-size-input');
    if (sizeSlider) {
        const savedSize = Settings.get('insertSize') || 256;
        sizeSlider.value = savedSize;
        if (settingSizeInput) settingSizeInput.value = savedSize;

        sizeSlider.addEventListener('input', () => {
            if (settingSizeInput) settingSizeInput.value = sizeSlider.value;
            Settings.set('insertSize', parseInt(sizeSlider.value, 10));
        });
        if (settingSizeInput) {
            settingSizeInput.addEventListener('input', () => {
                let val = parseInt(settingSizeInput.value, 10) || 64;
                sizeSlider.value = val;
                Settings.set('insertSize', val);
            });
        }
    }

    // Wire Settings Stroke: Slider <-> Manual Number Input
    const settingStrokeSlider = document.getElementById('setting-stroke-slider');
    const settingStrokeInput = document.getElementById('setting-stroke-input');
    if (settingStrokeSlider) {
        const savedStroke = Settings.get('strokeWidth') || 2.0;
        settingStrokeSlider.value = savedStroke;
        if (settingStrokeInput) settingStrokeInput.value = savedStroke;

        settingStrokeSlider.addEventListener('input', () => {
            if (settingStrokeInput) settingStrokeInput.value = settingStrokeSlider.value;
            Settings.set('strokeWidth', parseFloat(settingStrokeSlider.value));
        });
        if (settingStrokeInput) {
            settingStrokeInput.addEventListener('input', () => {
                let val = parseFloat(settingStrokeInput.value) || 1.0;
                settingStrokeSlider.value = val;
                Settings.set('strokeWidth', val);
            });
        }
    }

    // API Guide Modal Wiring
    const modalApiGuide = document.getElementById('modal-api-guide');
    const btnOpenApiGuide = document.getElementById('btn-open-api-guide');
    const btnCloseApiGuide = document.getElementById('btn-close-api-guide');
    const btnDoneApiGuide = document.getElementById('btn-done-api-guide');
    const linkGetGhToken = document.getElementById('link-get-gh-token');
    const btnOpenGhBrowser = document.getElementById('btn-open-gh-browser');

    if (btnOpenApiGuide && modalApiGuide) {
        btnOpenApiGuide.addEventListener('click', (e) => {
            e.preventDefault();
            modalApiGuide.style.display = 'flex';
        });
    }
    if (btnCloseApiGuide && modalApiGuide) {
        btnCloseApiGuide.onclick = () => { modalApiGuide.style.display = 'none'; };
    }
    if (btnDoneApiGuide && modalApiGuide) {
        btnDoneApiGuide.onclick = () => { modalApiGuide.style.display = 'none'; };
    }

    function openGhTokenPage(e) {
        if (e) e.preventDefault();
        const ghUrl = "https://github.com/settings/tokens";
        if (cp) {
            cp.exec(`start "" "${ghUrl}"`);
        } else {
            window.open(ghUrl, "_blank");
        }
    }
    if (linkGetGhToken) linkGetGhToken.addEventListener('click', openGhTokenPage);
    if (btnOpenGhBrowser) btnOpenGhBrowser.addEventListener('click', openGhTokenPage);

    // Settings API keys
    const btnSaveKeys = document.getElementById('btn-save-keys');
    if (btnSaveKeys) {
        btnSaveKeys.addEventListener('click', (e) => {
            e.preventDefault();
            const apiVal = document.getElementById('setting-iconify-api').value;
            const ghVal = document.getElementById('setting-github-token').value;
            Settings.set('iconifyCustomApiUrl', apiVal);
            Settings.set('githubToken', ghVal);
            updateStatus("Settings saved successfully!", "success");
            alert("Settings saved successfully!");
        });
    }

    // Check updates
    const btnCheckUpdates = document.getElementById('btn-check-updates');
    if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            PluginUpdater.check(true);
        });
    }

    // Customizer Modal event listeners
    const btnCloseCust = document.getElementById('btn-close-customizer');
    if (btnCloseCust) {
        btnCloseCust.onclick = () => { if (customizerModal) customizerModal.style.display = 'none'; };
    }
    const btnCancelCust = document.getElementById('btn-cancel-customizer');
    if (btnCancelCust) {
        btnCancelCust.onclick = () => { if (customizerModal) customizerModal.style.display = 'none'; };
    }
    const btnInsertCust = document.getElementById('btn-insert-customizer');
    if (btnInsertCust) {
        btnInsertCust.onclick = insertActiveCustomizerItem;
    }

    // Customizer Controls: Slider <-> Manual Number Input Sync
    const modalStrokeSlider = document.getElementById('modal-stroke-slider');
    const modalStrokeInput = document.getElementById('modal-stroke-input');
    if (modalStrokeSlider) {
        modalStrokeSlider.addEventListener('input', () => {
            if (modalStrokeInput) modalStrokeInput.value = modalStrokeSlider.value;
            updateCustomizerPreview();
        });
        if (modalStrokeInput) {
            modalStrokeInput.addEventListener('input', () => {
                let val = parseFloat(modalStrokeInput.value) || 1.0;
                modalStrokeSlider.value = val;
                updateCustomizerPreview();
            });
        }
    }

    const modalSizeSlider = document.getElementById('modal-size-slider');
    const modalSizeInput = document.getElementById('modal-size-input');
    if (modalSizeSlider) {
        modalSizeSlider.addEventListener('input', () => {
            if (modalSizeInput) modalSizeInput.value = modalSizeSlider.value;
            updateCustomizerPreview();
        });
        if (modalSizeInput) {
            modalSizeInput.addEventListener('input', () => {
                let val = parseInt(modalSizeInput.value, 10) || 64;
                modalSizeSlider.value = val;
                updateCustomizerPreview();
            });
        }
    }

    if (modalColorPicker && modalColorHex) {
        modalColorPicker.addEventListener('input', () => {
            modalColorHex.value = modalColorPicker.value;
            updateCustomizerPreview();
        });
        modalColorHex.addEventListener('input', () => {
            modalColorPicker.value = modalColorHex.value;
            updateCustomizerPreview();
        });
    }

    // Save to Playlist from Customizer
    const btnAddPl = document.getElementById('btn-modal-add-playlist');
    if (btnAddPl) {
        btnAddPl.onclick = () => {
            if (!activeCustomizerItem) return;
            const plSelectEl = document.getElementById('modal-playlist-select');
            const plId = plSelectEl ? plSelectEl.value : 'favs';
            AssetManager.addToPlaylist(plId, Object.assign({}, activeCustomizerItem, {
                id: activeCustomizerItem.iconFullName || activeCustomizerItem.fullPath || activeCustomizerItem.emojiChar,
                color: (modalColorHex && modalColorHex.value) || '#ffffff',
                strokeWidth: (modalStrokeSlider && parseFloat(modalStrokeSlider.value)) || 2
            }));
            updatePlaylistDropdown();
            alert("Added to playlist!");
        };
    }

    // Background preview toggle
    document.querySelectorAll('.bg-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bg-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (previewStage) previewStage.className = `preview-stage ${btn.dataset.bg}`;
        });
    });

    // Quick icon color picker
    const quickColorInput = document.getElementById('quick-icon-color');
    const colorPreviewDot = document.getElementById('color-preview-dot');
    if (quickColorInput) {
        quickColorInput.addEventListener('input', () => {
            if (colorPreviewDot) colorPreviewDot.style.background = quickColorInput.value;
            if (currentTab === 'icons') renderIcons();
        });
    }

    // Infinite scroll listener for both Emojis and Icons
    const scrollContainer = document.querySelector('.emoji-container');
    if (scrollContainer) {
        const handleScrollOrWheel = () => {
            const threshold = 400;
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - threshold) {
                if (currentTab === 'emojis') {
                    renderEmojis(false);
                } else if (currentTab === 'icons') {
                    loadMoreIcons();
                }
            }
        };

        scrollContainer.addEventListener('scroll', handleScrollOrWheel);
        scrollContainer.addEventListener('wheel', handleScrollOrWheel, { passive: true });
    }

    // Update version badge dynamically
    const verBadge = document.getElementById('settings-app-version-badge');
    if (verBadge) {
        verBadge.textContent = 'v' + PluginUpdater.version();
    }

    // Initial render
    renderEmojis(true);

    // Initial background update check
    setTimeout(() => {
        PluginUpdater.check(false);
    }, 1000);
});
