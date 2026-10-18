// Host-side ExtendScript execution context for com.antigravity.emojilib.panel

var EMOJI_HOST = {
    // Utility to log to console
    log: function(msg) {
        $.writeln("[Emoji Plugin] " + msg);
    },

    // Detect Host App
    getHost: function() {
        if (app.name.indexOf("After Effects") !== -1) {
            return "AEFT";
        } else if (app.name.indexOf("Premiere") !== -1) {
            return "PPRO";
        }
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

    // ----------------------------------------------------
    // AFTER EFFECTS SPECIFIC METHODS
    // ----------------------------------------------------
    aeInsertText: function(textString, size, useOriginalColor) {
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
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "ERROR: Please select or open a Composition first.";
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
            // Find or create "Icons" bin in Premiere Pro Project panel
            var iconsBin = null;
            var root = app.project.rootItem;
            if (root && root.children) {
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

            // First check if the item is already in project bins to avoid duplicates
            var projectItem = this.prFindProjectItemByPath(filePath);
            
            if (!projectItem) {
                var filePaths = [filePath];
                var targetBin = iconsBin || (app.project.getInsertionBin ? app.project.getInsertionBin() : root);
                var success = app.project.importFiles(filePaths, true, targetBin, false);
                if (!success) {
                    return "ERROR: Premiere failed to import the file.";
                }
                projectItem = this.prFindProjectItemByPath(filePath);
            }

            if (!projectItem) {
                return "ERROR: Could not find imported item in project bin.";
            }

            // Move into Icons bin if not already inside
            if (projectItem && iconsBin && projectItem.parent !== iconsBin) {
                try {
                    projectItem.move(iconsBin);
                } catch (mvErr) {}
            }

            // Name the item nicely
            projectItem.name = "Emoji - " + emojiName;

            var activeSeq = app.project.activeSequence;
            if (!activeSeq) {
                return "SUCCESS"; // Successfully imported into Icons project bin!
            }

            var playheadTime = activeSeq.getPlayerPosition();
            var inserted = false;
            var numTracks = activeSeq.videoTracks.numTracks;
            var targetTrack = null;

            // Search for an available video track at playhead, preferring upper tracks (V2, V3...)
            for (var t = 1; t < numTracks; t++) {
                var vt = activeSeq.videoTracks[t];
                var isOccupied = false;
                for (var c = 0; c < vt.clips.numItems; c++) {
                    var clip = vt.clips[c];
                    if (playheadTime.ticks >= clip.start.ticks && playheadTime.ticks < clip.end.ticks) {
                        isOccupied = true;
                        break;
                    }
                }
                if (!isOccupied) {
                    targetTrack = vt;
                    break;
                }
            }

            // If higher tracks are busy, check V1
            if (!targetTrack && numTracks > 0) {
                var v0 = activeSeq.videoTracks[0];
                var v0Occupied = false;
                for (var c0 = 0; c0 < v0.clips.numItems; c0++) {
                    var clip0 = v0.clips[c0];
                    if (playheadTime.ticks >= clip0.start.ticks && playheadTime.ticks < clip0.end.ticks) {
                        v0Occupied = true;
                        break;
                    }
                }
                if (!v0Occupied) {
                    targetTrack = v0;
                }
            }

            // Fallback to highest track
            if (!targetTrack && numTracks > 0) {
                targetTrack = activeSeq.videoTracks[numTracks - 1];
            }

            if (targetTrack) {
                try {
                    // Non-destructive overwrite at playhead
                    targetTrack.overwriteClip(projectItem, playheadTime);
                    inserted = true;
                } catch (eOverwrite) {
                    targetTrack.insertClip(projectItem, playheadTime);
                    inserted = true;
                }
            }

            if (!inserted) {
                return "ERROR: No video tracks found to insert clip.";
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
        // Normalize paths for comparison (replace backslashes)
        var normTarget = filePath.replace(/\\/g, "/").toLowerCase();
        
        for (var i = 0; i < folder.children.numItems; i++) {
            var child = folder.children[i];
            if (child.type === 2) { // ProjectItemType.BIN is 2
                var found = this.prSearchBin(child, filePath);
                if (found) return found;
            } else if (child.type === 1) { // ProjectItemType.CLIP is 1
                var mediaPath = child.getMediaPath();
                if (mediaPath) {
                    var normChild = mediaPath.replace(/\\/g, "/").toLowerCase();
                    if (normChild === normTarget) {
                        return child;
                    }
                }
            }
        }
        return null;
    }
};
