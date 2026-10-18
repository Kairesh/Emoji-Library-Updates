# Emoji Library by Kairesh - Adobe CEP Extension Installer
# Run this file with PowerShell (Right-click -> Run with PowerShell)

$sourceDir = $PSScriptRoot
$destDir = "$env:APPDATA\Adobe\CEP\extensions\emoji-library-by-kairesh"

Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "     Emoji Library by Kairesh - Adobe Plugin Installer   " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Check source directories
if (!(Test-Path (Join-Path $sourceDir "CSXS")) -or !(Test-Path (Join-Path $sourceDir "client"))) {
    Write-Host "Error: Run this script from the plugin root folder containing CSXS/ and client/." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    Exit
}

# 1. Create target extensions directory
Write-Host "Creating extension directory..." -ForegroundColor Yellow
if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

# 2. Copy files to Adobe extensions folder
Write-Host "Copying files to $destDir..." -ForegroundColor Yellow
Copy-Item -Path (Join-Path $sourceDir "CSXS") -Destination $destDir -Recurse -Force
Copy-Item -Path (Join-Path $sourceDir "client") -Destination $destDir -Recurse -Force
Copy-Item -Path (Join-Path $sourceDir "host") -Destination $destDir -Recurse -Force
if (Test-Path (Join-Path $sourceDir ".debug")) {
    Copy-Item -Path (Join-Path $sourceDir ".debug") -Destination $destDir -Force
}
if (Test-Path (Join-Path $sourceDir "SETUP.txt")) {
    Copy-Item -Path (Join-Path $sourceDir "SETUP.txt") -Destination $destDir -Force
}

# Create permanent Documents asset folder
$assetsDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('MyDocuments'), 'Emoji Library Assets')
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

Write-Host "Files copied successfully!" -ForegroundColor Green

# 3. Update CSXS Debug Mode in registry
Write-Host "Updating Adobe CSXS registry settings (PlayerDebugMode)..." -ForegroundColor Yellow
$csxsVersions = @("CSXS.9", "CSXS.10", "CSXS.11", "CSXS.12", "CSXS.13", "CSXS.14")
foreach ($ver in $csxsVersions) {
    $regPath = "HKCU:\Software\Adobe\$ver"
    if (!(Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Force
}

Write-Host "Registry updated successfully! Adobe PlayerDebugMode is enabled." -ForegroundColor Green
Write-Host ""
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "             Installation Successful!                    " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Instructions:"
Write-Host "1. Restart Adobe After Effects or Adobe Premiere Pro."
Write-Host "2. Go to: Window -> Extensions -> Emoji Library by Kairesh."
Write-Host "3. Start inserting emojis directly into your timeline!"
Write-Host ""
Write-Host "All assets are permanently saved in: Documents/Emoji Library Assets" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to finish..."
