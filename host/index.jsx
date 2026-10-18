// Host-side ExtendScript execution context for com.antigravity.emojilib.panel

var EMOJI_HOST = {
    // Utility to log to console
    log: function(msg) {
        $.writeln("[Emoji Plugin] " + msg);
    },

    // Bulletproof Host App Detection
    isPremiereHost: function() {
        try {
            if (typeof BridgeTalk !== "undefined" && BridgeTalk.appName) {
                return BridgeTalk.appName.toLowerCase().indexOf("premiere") !== -1;
            }
            if (typeof app !== "undefined") {
                if (app.name && app.name.toLowerCase().indexOf("premiere") !== -1) return true;
                if (app.project && typeof app.project.importFiles === "function") return true;
            }
        } catch (_) {}
        return false;
    },

    isAfterEffectsHost: function() {
        try {
            if (typeof BridgeTalk !== "undefined" && BridgeTalk.appName) {
                return BridgeTalk.appName.toLowerCase().indexOf("aftereffects") !== -1;
            }
            if (typeof app !== "undefined") {
                if (app.name && app.name.toLowerCase().indexOf("after effects") !== -1) return true;
                if (typeof FolderItem !== "undefined" || (app.project && typeof app.project.importFile === "function")) return true;
            }
        } catch (_) {}
        return false;
    },

    getHost: function() {
        if (this.isPremiereHost()) return "PPRO";
        if (this.isAfterEffectsHost()) return "AEFT";
        return "UNKNOWN";
    },

    // Get Active Project Directory (Premiere Pro or After Effects)
    getProjectDirectory: function() {
        try {
            // Check Premiere Pro first
            if (typeof app.project !== "undefined" && typeof app.project.path !== "undefined") {
                if (app.project.path && app.project.path.length > 0) {
                    var prFile = new File(app.project.path);
                    if (prFile.exists && prFile.parent) {
                        return prFile.parent.fsName;
                    }
                }
            }
            
            // Check After Effects
            if (typeof app.project !== "undefined" && typeof app.project.file !== "undefined") {
                if (app.project.file && app.project.file.exists && app.project.file.parent) {
                    return app.project.file.parent.fsName;
                }
            }
        } catch (e) {
            // ignore
        }
        return "";
    },

    // Native Adobe Folder Selection Dialog (Zero OS Shell / Prompt)
    selectFolderDialog: function(title) {
        try {
            var f = Folder.selectDialog(title || "Select Icons & Assets Folder");
            if (f && f.exists) {
                return f.fsName;
            }
        } catch (e) {
            return "ERROR: " + e.toString();
        }
        return "";
    },

    insertFootage: function(filePath, assetName, size, convertToShape, isAnimated) {
        try {
            if (this.isPremiereHost()) {
                return this.prInsertFootage(filePath, assetName);
            } else {
                return this.aeInsertFootage(filePath, assetName, size, convertToShape, isAnimated);
            }
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    },

    // Helper to safely import to AE Project panel "Icons" folder without requiring open composition
    aeImportToProjectBin: function(filePath, assetName) {
        try {
            var file = new File(filePath);
            if (!file.exists) return "ERROR: File does not exist: " + filePath;

            // Check if already in project
            for (var i = 1; i <= app.project.items.length; i++) {
                var pItem = app.project.items[i];
                if (pItem instanceof FootageItem && pItem.file && pItem.file.fsName === file.fsName) {
                    return "SUCCESS";
                }
            }

            var iconsFolder = null;
            for (var fIdx = 1; fIdx <= app.project.items.length; fIdx++) {
                var pFolder = app.project.items[fIdx];
                if (pFolder instanceof FolderItem && pFolder.name === "Icons") {
                    iconsFolder = pFolder;
                    break;
                }
            }
            if (!iconsFolder) {
                try { iconsFolder = app.project.items.addFolder("Icons"); } catch (e) {}
            }

            var importOptions = new ImportOptions(file);
            var footageItem = app.project.importFile(importOptions);
            if (footageItem && iconsFolder) {
                try { footageItem.parentFolder = iconsFolder; } catch (e2) {}
            }
            if (footageItem) footageItem.name = "Emoji - " + assetName;
            return "SUCCESS";
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    },

    // ----------------------------------------------------
    // AFTER EFFECTS SPECIFIC METHODS
    // ----------------------------------------------------
    aeInsertText: function(textString, size, useOriginalColor) {
        if (this.isPremiereHost()) {
            return "ERROR: Text layers are only supported in After Effects. Please insert as PNG/SVG emoji in Premiere Pro.";
        }
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "ERROR: Please select or open a Composition first.";
        }

        app.beginUndoGroup("Insert Emoji Text");
        try {
            var textLayer = comp.layers.addText(textString);
            
            // Set base font as standard Arial
            var textProp = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
            var textDoc = textProp.value;
            textDoc.fontSize = parseFloat(size) || 120;
            textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
            
            var baseFont = "Arial-BoldMT";
            textDoc.font = baseFont;
            
            // Default styling for the layer (solid fill, no stroke outlines)
            textDoc.applyFill = true;
            textDoc.applyStroke = false;
            textProp.setValue(textDoc);
            
            // Re-read textDoc to ensure properties are registered
            textDoc = textProp.value;
            
            var fontName = ($.os.indexOf("Windows") !== -1) ? "EmojiOneColor" : "AppleColorEmoji";
            var aeVersion = parseFloat(app.version);

            // If CharacterRange is supported (After Effects 24.3+)
            if (aeVersion >= 24.3) {
                var textStr = textDoc.text;
                var i = 0;
                while (i < textStr.length) {
                    var code = textStr.charCodeAt(i);
                    var isHighSurrogate = (code >= 0xD800 && code <= 0xDBFF);
                    var charLen = 1;
                    
                    if (isHighSurrogate && (i + 1 < textStr.length)) {
                        charLen = 2;
                    }
                    
                    var isEmojiChar = isHighSurrogate || 
                                      (code >= 0x2000 && code <= 0x32FF) || 
                                      (code >= 0xFE00 && code <= 0xFE0F);
                    
                    try {
                        var range = textDoc.characterRange(i, i + charLen);
                        if (isEmojiChar) {
                            if (useOriginalColor) {
                                range.font = fontName;
                                range.applyFill = false; // Disable custom color overlay for color emojis!
                            } else {
                                range.font = baseFont;
                                range.applyFill = true;  // Force solid color for silhouette emojis
                            }
                        } else {
                            range.font = baseFont;
                            range.applyFill = true;
                        }
                    } catch (e) {
                        // Ignore character formatting errors
                    }
                    
                    i += charLen; // Move past the processed character(s)
                }
            } else {
                // Fallback for older versions of After Effects (pre 24.3)
                if (useOriginalColor) {
                    // Try EmojiOneColor first (beautiful standard letters + color emojis)
                    // If not installed, falls back to Segoe UI Emoji / Apple Color Emoji
                    textDoc.font = "EmojiOneColor";
                    textDoc.applyFill = false; // Enable native colors
                } else {
                    textDoc.font = baseFont;
                    textDoc.applyFill = true;
                }
                textProp.setValue(textDoc);
            }

            // Center in comp
            textLayer.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]);
            textLayer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);
            
            textLayer.selected = true;
            app.endUndoGroup();
            return "SUCCESS";
        } catch (err) {
            app.endUndoGroup();
            return "ERROR: " + err.toString();
        }
    },

    aeInsertFootage: function(filePath, emojiName, targetSize, convertToShape, isAnimated) {
        // Absolute safety guard: If invoked inside Premiere Pro, immediately route to prInsertFootage!
        if (this.isPremiereHost()) {
            return this.prInsertFootage(filePath, emojiName);
        }

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            var binRes = this.aeImportToProjectBin(filePath, emojiName);
            if (binRes === "SUCCESS") {
                return "SUCCESS: Added to 'Icons' folder in Project panel. (Open a Composition to place on timeline)";
            }
            return "ERROR: Please select or open an After Effects Composition first.";
        }

        app.beginUndoGroup("Insert Emoji Graphic");
        try {
            var file = new File(filePath);
            if (!file.exists) {
                app.endUndoGroup();
                return "ERROR: File does not exist: " + filePath;
            }

            // Check if file is already imported in project to avoid duplicate bin items
            var footageItem = null;
            for (var i = 1; i <= app.project.items.length; i++) {
                var pItem = app.project.items[i];
                if (pItem instanceof FootageItem && pItem.file && pItem.file.fsName === file.fsName) {
                    footageItem = pItem;
                    break;
                }
            }

            // Find or create "Icons" folder in AE Project panel
            var iconsFolder = null;
            for (var fIdx = 1; fIdx <= app.project.items.length; fIdx++) {
                var pFolder = app.project.items[fIdx];
                if (pFolder instanceof FolderItem && pFolder.name === "Icons") {
                    iconsFolder = pFolder;
                    break;
                }
            }
            if (!iconsFolder) {
                try {
                    iconsFolder = app.project.items.addFolder("Icons");
                } catch (addFoldErr) {}
            }

            if (!footageItem) {
                var importOptions = new ImportOptions(file);
                footageItem = app.project.importFile(importOptions);
            }
            if (footageItem && iconsFolder) {
                try {
                    footageItem.parentFolder = iconsFolder;
                } catch (fErr) {}
            }
            
            // Add to composition
            var layer = comp.layers.add(footageItem);
            layer.name = "Emoji - " + emojiName;
            
            // Position at center (handles separate Dimensions mode in AE)
            try {
                var posProp = layer.property("ADBE Transform Group").property("ADBE Position");
                if (posProp && posProp.canSetValue && posProp.canSetValue([comp.width / 2, comp.height / 2])) {
                    posProp.setValue([comp.width / 2, comp.height / 2]);
                } else if (posProp && posProp.value) {
                    posProp.setValue([comp.width / 2, comp.height / 2]);
                }
            } catch (posErr) {
                try {
                    // If dimensions are separated into X Position and Y Position
                    var xProp = layer.property("ADBE Transform Group").property("ADBE Position_0");
                    var yProp = layer.property("ADBE Transform Group").property("ADBE Position_1");
                    if (xProp) xProp.setValue(comp.width / 2);
                    if (yProp) yProp.setValue(comp.height / 2);
                } catch (sepErr) {}
            }
            
            // Scale to match target size preserving aspect ratio (never distort landscape/portrait footage)
            try {
                var w = footageItem.width || layer.source.width || 128;
                var h = footageItem.height || layer.source.height || 128;
                if (w <= 0) w = 128;
                if (h <= 0) h = 128;

                if (targetSize && targetSize > 0) {
                    var maxDim = Math.max(w, h);
                    var uniformScale = (targetSize / maxDim) * 100;
                    var scaleProp = layer.property("ADBE Transform Group").property("ADBE Scale");
                    if (scaleProp) {
                        scaleProp.setValue([uniformScale, uniformScale, 100]);
                    }
                }
            } catch (scaleErr) {}

            // If it's an SVG file, enable continuously rasterize (collapse transformation) to prevent blurriness when scaled
            var isSvg = (filePath.toLowerCase().indexOf(".svg") !== -1);
            if (isSvg) {
                try {
                    layer.collapseTransformation = true;
                } catch (e) {
                    // Ignore if not supported on this layer type
                }
            }

            // Convert to native AE Shape Layer if requested (SVGs only)
            if (convertToShape && isSvg) {
                try {
                    // Deselect all layers first
                    for (var j = 1; j <= comp.layers.length; j++) {
                        comp.layers[j].selected = false;
                    }
                    layer.selected = true;
                    
                    var origCount = comp.layers.length;
                    var cmdID = app.findMenuCommandId("Create Shapes from Vector Layer");
                    if (!cmdID || cmdID === 0) cmdID = 3973;
                    
                    if (cmdID) {
                        try { app.beginSuppressDialogs(); } catch (supErr) {}
                        app.executeCommand(cmdID);
                        try { app.endSuppressDialogs(false); } catch (supEndErr) {}

                        // Only remove original if a new shape layer was actually generated
                        if (comp.layers.length > origCount) {
                            var newShapeLayer = comp.selectedLayers[0] || comp.layers[1];
                            layer.remove();

                            // If this is an animated vector icon (line-md), add native AE motion graphics animation
                            if (isAnimated && newShapeLayer) {
                                try {
                                    var nameLower = (emojiName || "").toLowerCase();
                                    
                                    // 1. Rotation animation for rotating/looping icons
                                    if (nameLower.indexOf("loading") !== -1 || 
                                        nameLower.indexOf("spinner") !== -1 || 
                                        nameLower.indexOf("rotate") !== -1 || 
                                        nameLower.indexOf("refresh") !== -1 || 
                                        nameLower.indexOf("sync") !== -1 || 
                                        nameLower.indexOf("loop") !== -1) {
                                        var rotProp = newShapeLayer.property("ADBE Transform Group").property("ADBE Rotation");
                                        if (rotProp) {
                                            rotProp.expression = "time * 240;";
                                        }
                                    }

                                    // 2. Add native Trim Paths drawing animation for stroke icons
                                    var rootVectors = newShapeLayer.property("ADBE Root Vectors Group");
                                    if (rootVectors) {
                                        var trim = rootVectors.addProperty("ADBE Vector Filter - Trim");
                                        if (trim) {
                                            var curTime = comp.time;
                                            var endProp = trim.property("ADBE Vector Trim End");
                                            if (endProp) {
                                                endProp.setValueAtTime(curTime, 0);
                                                endProp.setValueAtTime(curTime + 1.0, 100);
                                            }
                                        }
                                    }
                                } catch (animErr) {}
                            }
                        } else {
                            layer.enabled = true;
                            layer.selected = true;
                        }
                    } else {
                        layer.enabled = true;
                        layer.selected = true;
                    }
                } catch (shapeErr) {
                    try { app.endSuppressDialogs(false); } catch (supEndErr2) {}
                    layer.enabled = true;
                    layer.selected = true;
                }
            } else {
                layer.enabled = true;
                layer.selected = true;
            }

            app.endUndoGroup();
            return "SUCCESS";
        } catch (err) {
            app.endUndoGroup();
            return "ERROR: " + err.toString();
        }
    },

    // ----------------------------------------------------
    // PREMIERE PRO SPECIFIC METHODS
    // ----------------------------------------------------
    prInsertFootage: function(filePath, emojiName) {
        try {
            var file = new File(filePath);
            if (!file.exists) {
                return "ERROR: File does not exist on disk: " + filePath;
            }

            var nativePath = file.fsName;
            var cleanPath = file.fsName.replace(/\\/g, '/');
            var root = app.project.rootItem;
            if (!root) {
                return "ERROR: No active Premiere Pro project found.";
            }

            // Find or create "Icons" bin in Premiere Pro Project panel
            var iconsBin = null;
            if (root.children) {
                for (var b = 0; b < root.children.numItems; b++) {
                    var cBin = root.children[b];
                    if (cBin && cBin.type === 2 && cBin.name === "Icons") { // 2 = BIN
                        iconsBin = cBin;
                        break;
                    }
                }
                if (!iconsBin) {
                    try {
                        iconsBin = root.createBin("Icons");
                    } catch (bErr) {
                        iconsBin = root;
                    }
                }
            }

            // First check if the item is already in project to avoid duplicates
            var projectItem = this.prSearchBin(iconsBin, nativePath) || this.prSearchBin(root, nativePath);

            if (!projectItem) {
                var prevIconsCount = (iconsBin && iconsBin.children) ? iconsBin.children.numItems : 0;
                var prevRootCount = (root && root.children) ? root.children.numItems : 0;
                var didImport = false;

                // Attempt 1: Try importing directly into iconsBin if distinct from root
                if (iconsBin && iconsBin !== root) {
                    try {
                        didImport = app.project.importFiles([nativePath], true, iconsBin, false);
                    } catch (_) {
                        try {
                            didImport = app.project.importFiles([cleanPath], true, iconsBin, false);
                        } catch (_) {}
                    }

                    // Check if item landed directly in iconsBin
                    if (iconsBin.children && iconsBin.children.numItems > prevIconsCount) {
                        for (var ci = iconsBin.children.numItems - 1; ci >= 0; ci--) {
                            var cand = iconsBin.children[ci];
                            if (cand && cand.type !== 2) {
                                projectItem = cand;
                                break;
                            }
                        }
                    }
                }

                // Attempt 2: Import into rootItem with retry loop (bypasses Premiere sub-bin import bugs)
                if (!projectItem) {
                    for (var attempt = 0; attempt < 3 && !projectItem; attempt++) {
                        if (attempt > 0) {
                            try { $.sleep(150); } catch (_) {}
                        }
                        try {
                            var r1 = app.project.importFiles([nativePath], true, root, false);
                            didImport = didImport || r1;
                        } catch (_) {
                            try {
                                var r2 = app.project.importFiles([cleanPath], true, root, false);
                                didImport = didImport || r2;
                            } catch (_) {
                                try {
                                    var r3 = app.project.importFiles([nativePath], true);
                                    didImport = didImport || r3;
                                } catch (_) {}
                            }
                        }

                        // Detect newly added item in rootItem
                        if (root.children && root.children.numItems > prevRootCount) {
                            for (var ri = root.children.numItems - 1; ri >= 0; ri--) {
                                var rCand = root.children[ri];
                                if (rCand && rCand.type !== 2) {
                                    projectItem = rCand;
                                    break;
                                }
                            }
                        }

                        if (!projectItem) {
                            projectItem = this.prSearchBin(iconsBin, nativePath) || this.prSearchBin(root, nativePath);
                        }
                    }
                }

                // Attempt 3: Final fallback scan
                if (!projectItem) {
                    try { $.sleep(150); } catch (_) {}
                    projectItem = this.prSearchBin(iconsBin, nativePath) || this.prSearchBin(root, nativePath);
                }
            }

            if (!projectItem) {
                return "ERROR: Premiere failed to import file into project bins.";
            }

            // Move into Icons bin if Premiere placed it in rootItem
            if (iconsBin && iconsBin !== root && projectItem.parent !== iconsBin) {
                try {
                    if (typeof projectItem.moveBin === "function") {
                        projectItem.moveBin(iconsBin);
                    } else if (typeof projectItem.move === "function") {
                        projectItem.move(iconsBin);
                    }
                } catch (mvErr) {}
            }

            // Name the item nicely
            try {
                projectItem.name = "Emoji - " + emojiName;
            } catch (_) {}

            var activeSeq = app.project.activeSequence;
            if (!activeSeq) {
                return "SUCCESS: Added to 'Icons' bin in Project panel. (Open a sequence to place on timeline)";
            }

            var playheadTime = activeSeq.getPlayerPosition();
            var pSec = 0;
            if (playheadTime) {
                if (playheadTime.seconds !== undefined) {
                    pSec = playheadTime.seconds;
                } else {
                    pSec = parseFloat(playheadTime) || 0;
                }
            }

            var numTracks = (activeSeq.videoTracks && activeSeq.videoTracks.numTracks) ? activeSeq.videoTracks.numTracks : 0;
            var targetTrack = null;

            // Search for an available video track at playhead (top-down to prefer upper overlay tracks)
            for (var t = numTracks - 1; t >= 0; t--) {
                var vt = activeSeq.videoTracks[t];
                if (!vt || !vt.clips) continue;
                var collision = false;
                for (var c = 0; c < vt.clips.numItems; c++) {
                    var clip = vt.clips[c];
                    if (clip && clip.start && clip.end) {
                        if (clip.start.seconds <= pSec && clip.end.seconds > pSec) {
                            collision = true;
                            break;
                        }
                    }
                }
                if (!collision) {
                    targetTrack = vt;
                    break;
                }
            }

            // Fallback to highest track
            if (!targetTrack && numTracks > 0) {
                targetTrack = activeSeq.videoTracks[numTracks - 1];
            }

            var inserted = false;
            if (targetTrack) {
                try { targetTrack.insertClip(projectItem, playheadTime); inserted = true; } catch (_) {}
                if (!inserted) { try { targetTrack.insertClip(projectItem, pSec); inserted = true; } catch (_) {} }
                if (!inserted && typeof targetTrack.overwriteClip === "function") {
                    try { targetTrack.overwriteClip(projectItem, playheadTime); inserted = true; } catch (_) {}
                    if (!inserted) { try { targetTrack.overwriteClip(projectItem, pSec); inserted = true; } catch (_) {} }
                }
                if (!inserted) { try { targetTrack.insertClip(projectItem, "0"); inserted = true; } catch (_) {} }
            }

            if (!inserted) {
                return "SUCCESS: Added to 'Icons' bin in Project panel. (Place manually on timeline)";
            }

            return "SUCCESS";
        } catch (err) {
            return "ERROR: " + err.toString();
        }
    },

    prFindProjectItemByPath: function(filePath) {
        return this.prSearchBin(app.project.rootItem, filePath);
    },

    prSearchBin: function(folder, filePath) {
        if (!folder || !folder.children) return null;
        var file = new File(filePath);
        var normTarget = file.fsName ? file.fsName.replace(/\\/g, "/").toLowerCase() : filePath.replace(/\\/g, "/").toLowerCase();
        var baseName = file.name ? file.name.toLowerCase() : "";

        for (var i = 0; i < folder.children.numItems; i++) {
            var child = folder.children[i];
            if (!child) continue;
            if (child.type === 2) { // Bin
                var found = this.prSearchBin(child, filePath);
                if (found) return found;
            } else { // Non-bin (clips, stills, files)
                try {
                    if (child.getMediaPath) {
                        var mediaPath = child.getMediaPath();
                        if (mediaPath) {
                            var normChild = mediaPath.replace(/\\/g, "/").toLowerCase();
                            if (normChild === normTarget) {
                                return child;
                            }
                        }
                    }
                } catch (_) {}
                try {
                    if (baseName && child.name && child.name.toLowerCase() === baseName) {
                        return child;
                    }
                } catch (_) {}
            }
        }
        return null;
    },

    organizeDroppedItem: function(filePath) {
        try {
            if (this.isPremiereHost()) {
                var file = new File(filePath);
                var root = app.project.rootItem;
                if (!root) return "NO_ROOT";

                var iconsBin = null;
                for (var b = 0; b < root.children.numItems; b++) {
                    var cBin = root.children[b];
                    if (cBin && cBin.type === 2 && cBin.name === "Icons") {
                        iconsBin = cBin;
                        break;
                    }
                }
                if (!iconsBin) {
                    try { iconsBin = root.createBin("Icons"); } catch (e) {}
                }
                if (!iconsBin) return "NO_BIN";

                var targetName = file.name ? file.name.toLowerCase() : "";
                var targetFs = file.fsName ? file.fsName.replace(/\\/g, "/").toLowerCase() : "";

                for (var i = root.children.numItems - 1; i >= 0; i--) {
                    var item = root.children[i];
                    if (item && item.type !== 2 && item !== iconsBin) {
                        var mPath = "";
                        try { if (item.getMediaPath) mPath = item.getMediaPath().replace(/\\/g, "/").toLowerCase(); } catch (_) {}
                        var iName = item.name ? item.name.toLowerCase() : "";
                        if ((mPath && mPath === targetFs) || (targetName && iName === targetName) || (targetName && iName.indexOf(targetName) !== -1)) {
                            try {
                                if (typeof item.moveBin === "function") {
                                    item.moveBin(iconsBin);
                                }
                            } catch (_) {}
                        }
                    }
                }
                return "SUCCESS";
            } else {
                var file = new File(filePath);
                var iconsFolder = null;
                for (var fIdx = 1; fIdx <= app.project.items.length; fIdx++) {
                    var pFolder = app.project.items[fIdx];
                    if (pFolder instanceof FolderItem && pFolder.name === "Icons") {
                        iconsFolder = pFolder;
                        break;
                    }
                }
                if (!iconsFolder) {
                    try { iconsFolder = app.project.items.addFolder("Icons"); } catch (e) {}
                }
                if (!iconsFolder) return "NO_FOLDER";

                for (var i = 1; i <= app.project.items.length; i++) {
                    var pItem = app.project.items[i];
                    if (pItem instanceof FootageItem && pItem.file && pItem.file.fsName === file.fsName) {
                        if (pItem.parentFolder !== iconsFolder) {
                            try { pItem.parentFolder = iconsFolder; } catch (_) {}
                        }
                    }
                }
                return "SUCCESS";
            }
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    }
};
