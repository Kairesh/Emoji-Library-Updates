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

// Tab Switching
function initTabs() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    const emojiSub = document.getElementById('emoji-subtoolbar');
    const iconSub = document.getElementById('icon-subtoolbar');
    const folderSub = document.getElementById('folder-subtoolbar');
    const playlistSub = document.getElementById('playlist-subtoolbar');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;

            if (emojiSub) emojiSub.style.display = (currentTab === 'emojis') ? 'flex' : 'none';
            if (iconSub) iconSub.style.display = (currentTab === 'icons') ? 'flex' : 'none';
            if (folderSub) folderSub.style.display = (currentTab === 'folders') ? 'flex' : 'none';
            if (playlistSub) playlistSub.style.display = (currentTab === 'playlists') ? 'flex' : 'none';

            renderCurrentTab();
        });
    });
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
// TAB 1: EMOJIS
// ----------------------------------------------------
let displayedEmojiCount = 0;
const CHUNK_SIZE = 100;
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
}

function createEmojiCard(emoji) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.title = emoji.name;

    const rawChar = emoji.char || emoji.emoji || '';
    const emojiChar = applySkinTone(rawChar, currentTone);

    if (currentStyle === 'apple' || currentStyle === 'microsoft') {
        const img = document.createElement('img');
        img.alt = emoji.name;
        img.loading = "lazy";
        img.src = getEmojiDownloadUrl(emojiChar, currentStyle, 'png');
        card.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.className = 'card-emoji-text';
        span.textContent = emojiChar;
        card.appendChild(span);
    }

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

function applySkinTone(baseEmoji, tone) {
    if (!tone) return baseEmoji;
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
    if (format === 'svg') {
        // Twemoji provides pure vector SVGs that convert cleanly to AE outlines without complex filters
        return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${hex}.svg`;
    }
    return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=${style}`;
}

// ----------------------------------------------------
// TAB 2: ICONS (200k+ Online Streaming)
// ----------------------------------------------------
async function renderIcons() {
    assetGrid.innerHTML = '';
    noResults.style.display = 'none';
    loadingSpinner.style.display = 'flex';

    const librarySelect = document.getElementById('icon-library-select');
    const selectedPrefix = librarySelect ? librarySelect.value : 'all';
    const query = (searchQuery || '').trim();

    try {
        const icons = await IconEngine.searchIcons(query, selectedPrefix, 80);
        loadingSpinner.style.display = 'none';

        if (!icons || icons.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        const quickColor = (document.getElementById('quick-icon-color') && document.getElementById('quick-icon-color').value) || '#ffffff';

        icons.forEach(async (iconFullName) => {
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

            try {
                const svgText = await IconEngine.fetchSvgContent(iconFullName, { color: quickColor, strokeWidth: 1.8 });
                iconContainer.innerHTML = svgText;
                const svgEl = iconContainer.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '100%';
                    svgEl.style.height = '100%';
                    svgEl.style.pointerEvents = 'none';
                }
            } catch (err) {
                iconContainer.innerHTML = `<span style="font-size: 11px; color: #666;">•</span>`;
            }
        });
    } catch (err) {
        loadingSpinner.style.display = 'none';
        noResults.style.display = 'block';
        console.error("renderIcons error:", err);
    }
}

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
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #8e8e8e;">
                <p style="font-size: 13px; font-weight: 500; margin-bottom: 6px;">No local folder selected</p>
                <p style="font-size: 11px;">Click <b>"+ Link Folder"</b> above to connect your local icons, stickers, or Drive desktop folder.</p>
            </div>
        `;
        return;
    }

    const items = AssetManager.scanFolder(folderPath);
    if (items.length === 0) {
        assetGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #8e8e8e;">
                <p>No supported media found in this folder (.svg, .png, .jpg, .webp)</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.title = item.name;

        const img = document.createElement('img');
        img.src = `file://${item.fullPath.replace(/\\/g, '/')}`;
        card.appendChild(img);

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
            const span = document.createElement('span');
            span.className = 'card-emoji-text';
            span.textContent = item.emojiChar;
            card.appendChild(span);
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

    updateCustomizerPreview();
    if (customizerModal) customizerModal.style.display = 'flex';
}

async function updateCustomizerPreview() {
    if (!activeCustomizerItem || !previewRenderBox) return;
    previewRenderBox.innerHTML = '';

    const color = (modalColorHex && modalColorHex.value) || '#ffffff';
    const strokeWidth = (modalStrokeSlider && parseFloat(modalStrokeSlider.value)) || 2;

    if (activeCustomizerItem.type === 'emoji') {
        if (currentStyle === 'apple' || currentStyle === 'microsoft') {
            const img = document.createElement('img');
            img.src = getEmojiDownloadUrl(activeCustomizerItem.emojiChar, currentStyle, 'png');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            previewRenderBox.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.style.fontSize = '50px';
            span.textContent = activeCustomizerItem.emojiChar;
            previewRenderBox.appendChild(span);
        }
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
    const size = (modalSizeSlider && parseInt(modalSizeSlider.value, 10)) || 256;
    const color = (modalColorHex && modalColorHex.value) || '#ffffff';
    const strokeWidth = (modalStrokeSlider && parseFloat(modalStrokeSlider.value)) || 2;
    const isPremiere = (hostApp === 'PPRO');

    updateStatus(`Preparing ${item.name}...`, 'info');

    const assetsDir = await resolveAssetsDir();

    try {
        if (item.type === 'local') {
            triggerHostImport(item.fullPath, item.name, size);
            return;
        }

        if (item.type === 'icon') {
            const svgText = await IconEngine.fetchSvgContent(item.iconFullName, {
                color: color,
                strokeWidth: strokeWidth
            });

            const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const colorClean = color.replace('#', '');

            if (isPremiere || currentFormat === 'png') {
                const pngBuffer = await convertSvgToPng(svgText, 1024);
                const localPng = path.join(assetsDir, `icon_${cleanName}_${colorClean}.png`);
                fs.writeFileSync(localPng, pngBuffer);
                triggerHostImport(localPng, item.name, size);
            } else {
                const localSvg = path.join(assetsDir, `icon_${cleanName}_${colorClean}.svg`);
                fs.writeFileSync(localSvg, svgText, 'utf8');
                triggerHostImport(localSvg, item.name, size);
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
                    await Net.downloadFile(dlUrl, localFile);
                }
            }
            triggerHostImport(localFile, item.name, size);
        }
    } catch (err) {
        console.error("Insertion error:", err);
        updateStatus(`Failed: ${err.message}`, 'error');
    }
}

function triggerHostImport(filePath, assetName, size) {
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
        const script = `EMOJI_HOST.aeInsertFootage("${safePath}", "${safeName}", ${size}, ${convertToShape})`;
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

    // Populate Icon Library dropdown
    try {
        const libSelect = document.getElementById('icon-library-select');
        if (libSelect) {
            IconEngine.collections.forEach(col => {
                const opt = document.createElement('option');
                opt.value = col.id;
                opt.textContent = `${col.name} ${col.count ? '(' + col.count + ')' : ''}`;
                libSelect.appendChild(opt);
            });

            libSelect.addEventListener('change', () => {
                if (currentTab === 'icons') renderIcons();
            });
        }
    } catch (e) {
        console.warn("libSelect init error:", e);
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

    // Link Folder Button
    const btnAddFolder = document.getElementById('btn-add-folder');
    if (btnAddFolder) {
        btnAddFolder.addEventListener('click', () => {
            const defaultDoc = (os && path) ? path.join(os.homedir(), "Documents") : "C:\\";
            const folder = prompt("Enter local folder path (e.g. C:\\Users\\...\\MyIcons or G:\\My Drive\\Icons):", defaultDoc);
            if (folder && fs && fs.existsSync(folder)) {
                AssetManager.addLinkedFolder(folder);
                updateFolderDropdown();
                folderSelect.value = folder;
                renderFolders();
            } else if (folder) {
                alert("Folder does not exist. Please verify path.");
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

    // Search bar
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value;
            if (clearSearchBtn) clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
            renderCurrentTab();
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

    // Category Tabs (Emojis)
    const categoryTabs = document.getElementById('category-tabs');
    if (categoryTabs) {
        categoryTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            renderEmojis(true);
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

    // Wire Size Slider
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    if (sizeSlider && sizeValue) {
        sizeSlider.value = Settings.get('insertSize') || 256;
        sizeValue.textContent = `${sizeSlider.value}px`;
        sizeSlider.addEventListener('input', () => {
            sizeValue.textContent = `${sizeSlider.value}px`;
            Settings.set('insertSize', parseInt(sizeSlider.value, 10));
        });
    }

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

    // Customizer Controls updates
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
    if (modalStrokeSlider && modalStrokeVal) {
        modalStrokeSlider.addEventListener('input', () => {
            modalStrokeVal.textContent = `${parseFloat(modalStrokeSlider.value).toFixed(1)}px`;
            updateCustomizerPreview();
        });
    }
    if (modalSizeSlider && modalSizeVal) {
        modalSizeSlider.addEventListener('input', () => {
            modalSizeVal.textContent = `${modalSizeSlider.value}px`;
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

    // Initial render
    renderEmojis(true);

    // Initial background update check
    setTimeout(() => {
        PluginUpdater.check(false);
    }, 1000);
});
