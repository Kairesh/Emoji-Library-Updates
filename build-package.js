const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const rootDir = 'c:\\Users\\pc\\Documents\\VsCode\\Emoji-Library-Updates';
const zipOut = path.join(rootDir, 'Emoji-Library-v2.0.0.zip');
const zxpOut = path.join(rootDir, 'Emoji-Library-v2.0.0.zxp');

const stage = path.join(os.tmpdir(), 'Emoji_Library_Stage');
if (fs.existsSync(stage)) {
    fs.rmSync(stage, { recursive: true, force: true });
}
fs.mkdirSync(stage, { recursive: true });

function copyRec(src, dst) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        for (const item of fs.readdirSync(src)) {
            copyRec(path.join(src, item), path.join(dst, item));
        }
    } else {
        fs.copyFileSync(src, dst);
    }
}

const itemsToCopy = [
    'client',
    'CSXS',
    'host',
    '.debug',
    'Install-Emoji-Library.bat',
    'install.ps1',
    'Uninstall-Emoji-Library.bat',
    'README.md'
];

for (const it of itemsToCopy) {
    const srcPath = path.join(rootDir, it);
    if (fs.existsSync(srcPath)) {
        copyRec(srcPath, path.join(stage, it));
    }
}

console.log('Staged files successfully into:', stage);

if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
if (fs.existsSync(zxpOut)) fs.unlinkSync(zxpOut);

const psCmd = `Compress-Archive -Path "${stage}\\*" -DestinationPath "${zipOut}" -Force`;
cp.execSync(`powershell -Command "${psCmd}"`);

fs.copyFileSync(zipOut, zxpOut);

console.log('Created ZIP:', zipOut, fs.statSync(zipOut).size, 'bytes');
console.log('Created ZXP:', zxpOut, fs.statSync(zxpOut).size, 'bytes');

fs.rmSync(stage, { recursive: true, force: true });
