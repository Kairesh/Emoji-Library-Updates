// Main Studio Client Controller
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

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
    const projectDir = await getActiveProjectDir();
    let targetDir = "";
    if (projectDir) {
        targetDir = path.join(projectDir, "Emoji & Icon Assets");
    } else {
        targetDir = path.join(os.homedir(), "Documents", "Emoji & Icon Studio Assets");
    }

    if (!fs.existsSync(targetDir)) {
        try {
            fs.mkdirSync(targetDir, { recursive: true });
        } catch (e) {
            console.error("Failed to create assets folder:", e);
        }
    }

    const storageDisplay = document.getElementById('storage-path-display');
    if (storageDisplay) {
        if (projectDir) {
            const projName = path.basename(projectDir);
            storageDisplay.textContent = `📁 ${projName}/Emoji & Icon Assets`;
            storageDisplay.title = `Saved inside project at: ${targetDir}`;
        } else {
            storageDisplay.textContent = `📁 Documents/Emoji & Icon Studio Assets`;
            storageDisplay.title = `${targetDir} (Save project to store directly in project folder)`;
        }
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

let activeCustomizerItem = null; // Currently customizing item

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
    } catch(err) {
        console.error("loadJSX error:", err);
    }

    csInterface.evalScript('EMOJI_HOST.getHost()', function(res) {
        if (res && res !== 'EvalScript error.') {
            hostApp = res.trim();
        }
        updateStatus(`Connected to ${hostApp === 'AEFT' ? 'After Effects' : hostApp === 'PPRO' ? 'Premiere Pro' : 'Adobe Host'}`);
    });
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

            emojiSub.style.display = (currentTab === 'emojis') ? 'flex' : 'none';
            iconSub.style.display = (currentTab === 'icons') ? 'flex' : 'none';
            folderSub.style.display = (currentTab === 'folders') ? 'flex' : 'none';
            playlistSub.style.display = (currentTab === 'playlists') ? 'flex' : 'none';

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
    if (format === 'png' || style === 'apple') {
        return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=${style}`;
    }
    if (style === 'google') {
        const notoHex = hex.replace(/-/g, '_');
        return `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@master/svg/emoji_u${notoHex}.svg`;
    } else if (style === 'twitter') {
        return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${hex}.svg`;
    } else {
        return `https://emojicdn.elk.sh/${encodeURIComponent(emojiChar)}?style=apple`;
    }
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
        const icons = await IconEngine.searchIcons(query, selectedPrefix, 70);
        loadingSpinner.style.display = 'none';

        if (!icons || icons.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        const quickColor = document.getElementById('quick-icon-color').value || '#ffffff';

        // Render cards with direct SVG inlining or fallback
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

            // Fetch SVG text and insert inline - 100% reliable in Adobe CEF Chromium
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
                // Fallback to img tag if fetch fails
                const img = document.createElement('img');
                img.src = IconEngine.buildSvgUrl(iconFullName, { color: quickColor });
                iconContainer.appendChild(img);
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
            const img = document.createElement('img');
            img.src = IconEngine.buildSvgUrl(item.iconFullName, { color: item.color || '#fff' });
            card.appendChild(img);
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
    title.textContent = `Customize: ${item.name}`;

    // Fill playlist options
    const plSelect = document.getElementById('modal-playlist-select');
    plSelect.innerHTML = '';
    AssetManager.getPlaylists().forEach(pl => {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        plSelect.appendChild(opt);
    });

    // Stroke control only applicable to stroke icons
    if (item.type === 'icon') {
        strokeControlRow.style.display = 'flex';
        modalColorPicker.value = item.color || '#ffffff';
        modalColorHex.value = item.color || '#ffffff';
    } else {
        strokeControlRow.style.display = 'none';
    }

    updateCustomizerPreview();
    customizerModal.style.display = 'flex';
}

async function updateCustomizerPreview() {
    if (!activeCustomizerItem) return;
    previewRenderBox.innerHTML = '';

    const color = modalColorHex.value || '#ffffff';
    const strokeWidth = parseFloat(modalStrokeSlider.value) || 2;

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

function downloadBinaryFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return downloadBinaryFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Server returned ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(destPath));
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function insertActiveCustomizerItem() {
    if (!activeCustomizerItem) return;
    customizerModal.style.display = 'none';

    const item = activeCustomizerItem;
    const size = parseInt(modalSizeSlider.value) || 256;
    const color = modalColorHex.value || '#ffffff';
    const strokeWidth = parseFloat(modalStrokeSlider.value) || 2;
    const isPremiere = (hostApp === 'PPRO');

    updateStatus(`Preparing ${item.name}...`, 'info');

    const assetsDir = await resolveAssetsDir();

    try {
        if (item.type === 'local') {
            triggerHostImport(item.fullPath, item.name, size);
            return;
        }

        if (item.type === 'icon') {
            // Fetch customized SVG
            const svgText = await IconEngine.fetchSvgContent(item.iconFullName, {
                color: color,
                strokeWidth: strokeWidth
            });

            const cleanName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const colorClean = color.replace('#', '');

            if (isPremiere || currentFormat === 'png') {
                // Rasterize to crisp transparent 1024px PNG for Premiere or PNG mode
                const pngBuffer = await convertSvgToPng(svgText, 1024);
                const localPng = path.join(assetsDir, `icon_${cleanName}_${colorClean}.png`);
                fs.writeFileSync(localPng, pngBuffer);
                triggerHostImport(localPng, item.name, size);
            } else {
                // Vector SVG for After Effects
                const localSvg = path.join(assetsDir, `icon_${cleanName}_${colorClean}.svg`);
                fs.writeFileSync(localSvg, svgText, 'utf8');
                triggerHostImport(localSvg, item.name, size);
            }
        } else if (item.type === 'emoji') {
            const hex = getEmojiHex(item.emojiChar);
            const ext = (isPremiere || currentStyle === 'apple' || currentFormat === 'png') ? 'png' : 'svg';
            const localFile = path.join(assetsDir, `emoji_${currentStyle}_${hex}.${ext}`);

            if (!fs.existsSync(localFile) || fs.statSync(localFile).size === 0) {
                if (ext === 'svg') {
                    const svgUrl = getEmojiDownloadUrl(item.emojiChar, currentStyle, 'svg');
                    const resp = await fetch(svgUrl);
                    const svgText = await resp.text();
                    fs.writeFileSync(localFile, svgText, 'utf8');
                } else {
                    const dlUrl = getEmojiDownloadUrl(item.emojiChar, currentStyle, 'png');
                    if (dlUrl.endsWith('.svg')) {
                        const resp = await fetch(dlUrl);
                        const svgText = await resp.text();
                        const pngBuf = await convertSvgToPng(svgText, 1024);
                        fs.writeFileSync(localFile, pngBuf);
                    } else {
                        await downloadBinaryFile(dlUrl, localFile);
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

    // Populate Linked Folders dropdown
    const folderSelect = document.getElementById('linked-folder-select');
    function updateFolderDropdown() {
        if (!folderSelect) return;
        folderSelect.innerHTML = '<option value="">-- Select Linked Folder --</option>';
        AssetManager.getLinkedFolders().forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = path.basename(f) + ` (${f})`;
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
            // Ask user for folder path via quick prompt or native picker
            const defaultDoc = path.join(os.homedir(), "Documents");
            const folder = prompt("Enter local folder path (e.g. C:\\Users\\...\\MyIcons or G:\\My Drive\\Icons):", defaultDoc);
            if (folder && fs.existsSync(folder)) {
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
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderCurrentTab();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderCurrentTab();
    });

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
        toggleSettingsBtn.addEventListener('click', () => {
            const isHidden = (settingsDrawer.style.display === 'none' || !settingsDrawer.style.display);
            settingsDrawer.style.display = isHidden ? 'flex' : 'none';
        });
    }
    if (closeSettingsBtn && settingsDrawer) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsDrawer.style.display = 'none';
        });
    }

    // Open Assets Folder Button
    const openAssetsBtn = document.getElementById('open-assets-btn');
    if (openAssetsBtn) {
        openAssetsBtn.addEventListener('click', async () => {
            const currentDir = await resolveAssetsDir();
            const { exec } = require('child_process');
            exec(`explorer "${currentDir}"`);
        });
    }

    // Settings API keys
    const btnSaveKeys = document.getElementById('btn-save-keys');
    if (btnSaveKeys) {
        btnSaveKeys.addEventListener('click', () => {
            const apiVal = document.getElementById('setting-iconify-api').value;
            const ghVal = document.getElementById('setting-github-token').value;
            Settings.set('iconifyCustomApiUrl', apiVal);
            Settings.set('githubToken', ghVal);
            alert("API settings saved successfully!");
        });
    }

    // Check updates
    const btnCheckUpdates = document.getElementById('btn-check-updates');
    if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', () => {
            PluginUpdater.check(true);
        });
    }

    // Customizer Modal event listeners
    document.getElementById('btn-close-customizer').onclick = () => {
        customizerModal.style.display = 'none';
    };
    document.getElementById('btn-cancel-customizer').onclick = () => {
        customizerModal.style.display = 'none';
    };
    document.getElementById('btn-insert-customizer').onclick = insertActiveCustomizerItem;

    // Customizer Controls updates
    modalColorPicker.addEventListener('input', () => {
        modalColorHex.value = modalColorPicker.value;
        updateCustomizerPreview();
    });
    modalColorHex.addEventListener('input', () => {
        modalColorPicker.value = modalColorHex.value;
        updateCustomizerPreview();
    });
    modalStrokeSlider.addEventListener('input', () => {
        modalStrokeVal.textContent = `${parseFloat(modalStrokeSlider.value).toFixed(1)}px`;
        updateCustomizerPreview();
    });
    modalSizeSlider.addEventListener('input', () => {
        modalSizeVal.textContent = `${modalSizeSlider.value}px`;
    });

    // Save to Playlist from Customizer
    document.getElementById('btn-modal-add-playlist').onclick = () => {
        if (!activeCustomizerItem) return;
        const plId = document.getElementById('modal-playlist-select').value;
        AssetManager.addToPlaylist(plId, Object.assign({}, activeCustomizerItem, {
            id: activeCustomizerItem.iconFullName || activeCustomizerItem.fullPath || activeCustomizerItem.emojiChar,
            color: modalColorHex.value,
            strokeWidth: parseFloat(modalStrokeSlider.value)
        }));
        updatePlaylistDropdown();
        alert("Added to playlist!");
    };

    // Background preview toggle
    document.querySelectorAll('.bg-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bg-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            previewStage.className = `preview-stage ${btn.dataset.bg}`;
        });
    });

    // Initial render
    renderEmojis(true);

    // Initial background update check
    setTimeout(() => {
        PluginUpdater.check(false);
    }, 1200);
});
