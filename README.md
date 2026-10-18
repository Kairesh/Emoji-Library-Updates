# ✨ Emoji Library by Kairesh

A premium, standalone Adobe CEP extension for **Adobe After Effects** and **Adobe Premiere Pro** that provides full access to 1,900+ emojis across multiple styles (**Apple**, **Google Noto**, and **Twemoji**) with full skin-tone controls, instant search, and native timeline insertion.

---

## 🚀 Features

- **Direct Timeline Integration**:
  - **Adobe After Effects**: Insert as native **Shape Layers** (converted from true vector SVGs with infinite scale) or high-resolution **Image Layers** (PNG).
  - **Adobe Premiere Pro**: Insert as crisp, transparent **High-Res PNG Clips (1024x1024)** placed non-destructively on available video overlay tracks at the playhead.
  - **Text Layers**: Compose sentences and insert text layers with emojis.
- **🎨 4 Artwork Styles**:
  - **Microsoft Fluent 3D** (Modern glossy 3D clay-render style)
  - **Apple** (iOS native style)
  - **Google** (Android Noto Color Emoji)
  - **Twitter / Twemoji** (Modern flat vector style)
- **🙌 Skin Tone Selector**: 5 Fitzpatrick skin-tone options (only applies to emojis that support skin tones, preventing broken images).
- **🛡️ 100% Project-Folder Assets - Zero Missing Media**:
  - Assets are stored directly inside your active project directory (`[Project_Folder]/Emoji Assets/`) beside your `.prproj` or `.aep` file.
  - If the project is moved or archived, all media stays intact.
  - Safe fallback to `Documents/Emoji Library Assets` for unsaved new projects.
  - Quick **"📂 Open Folder"** button right inside the panel's settings drawer.
- **⚡ Super Fast & Lightweight**:
  - 1,900+ emojis pre-compiled offline database with category navigation and search indexing.
  - Deduplicated footage imports (reuses existing project bin items).

---

## 💻 Installation

### Method 1: Automatic 1-Click Installer (Windows)
1. Download or clone this repository.
2. Right-click `install.ps1` and select **"Run with PowerShell"**.
3. Restart **After Effects** or **Premiere Pro**.
4. In the top menu, go to: **Window -> Extensions -> Emoji Library by Kairesh**.

---

### Method 2: Manual Installation

#### Windows:
1. Copy this entire folder to:
   ```
   C:\Users\<Your_Username>\AppData\Roaming\Adobe\CEP\extensions\emoji-library-by-kairesh
   ```
   *(Press `Win + R`, type `%appdata%` and navigate to `Adobe > CEP > extensions`)*.
2. Enable Adobe Debug Mode by running Command Prompt as Administrator:
   ```cmd
   reg add "HKCU\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.13" /v PlayerDebugMode /t REG_SZ /d 1 /f
   reg add "HKCU\Software\Adobe\CSXS.14" /v PlayerDebugMode /t REG_SZ /d 1 /f
   ```
3. Restart After Effects / Premiere Pro and open via **Window -> Extensions**.

#### macOS:
1. Copy this entire folder to:
   ```
   /Users/<Your_Username>/Library/Application Support/Adobe/CEP/extensions/emoji-library-by-kairesh
   ```
2. In Terminal, run:
   ```bash
   defaults write com.adobe.CSXS.9 PlayerDebugMode 1
   defaults write com.adobe.CSXS.10 PlayerDebugMode 1
   defaults write com.adobe.CSXS.11 PlayerDebugMode 1
   defaults write com.adobe.CSXS.12 PlayerDebugMode 1
   defaults write com.adobe.CSXS.13 PlayerDebugMode 1
   defaults write com.adobe.CSXS.14 PlayerDebugMode 1
   ```
3. Restart After Effects / Premiere Pro.

---

## 🛠️ Usage Tips

- **In Premiere Pro**: Premiere Pro natively supports transparent PNGs. The plugin automatically generates high-resolution 1024x1024 PNGs for full quality.
- **In After Effects**: Select **Shape Layer > Vector (SVG)** to turn any Google or Twemoji emoji into an editable, infinitely scalable shape layer inside After Effects.
- **Asset Management**: All downloaded graphics are stored in `Documents/Emoji Library Assets`. You can open this folder anytime by opening the Settings (⚙️) drawer and clicking **"📂 Open Folder"**.

---

## 👤 Author
Developed with ❤️ by **Kairesh**
