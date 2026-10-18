@echo off
setlocal enabledelayedexpansion
title Emoji Library by Kairesh - One-Click Installer
color 0B

echo ================================================================
echo          EMOJI LIBRARY BY KAIRESH - INSTALLER
echo   Adobe After Effects and Adobe Premiere Pro Extension
echo ================================================================
echo.

:: Step 1: Ensure CEP Extensions folder exists
set "CEP_DIR=%APPDATA%\Adobe\CEP\extensions"
set "TARGET_DIR=%CEP_DIR%\emoji-library-by-kairesh"

:: Determine source folder (current folder or subfolder)
set "SOURCE_DIR=%~dp0"
if exist "%~dp0emoji-library-by-kairesh\CSXS\manifest.xml" (
    set "SOURCE_DIR=%~dp0emoji-library-by-kairesh"
) else (
    if not exist "%~dp0CSXS\manifest.xml" (
        color 0C
        echo [ERROR] Extension files (CSXS\manifest.xml) not found!
        echo Please make sure all files were extracted properly before running.
        echo.
        pause
        exit /b 1
    )
)

echo [*] Target directory:
echo     %TARGET_DIR%
echo.

:: Step 2: Create target directory
if not exist "%CEP_DIR%" mkdir "%CEP_DIR%"

:: Step 3: Enable PlayerDebugMode in Windows Registry for Adobe CSXS versions
echo [*] Enabling Adobe CEP PlayerDebugMode in Windows Registry...
for %%V in (8 9 10 11 12 13 14 15 16) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d "1" /f >nul 2>&1
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v LogLevel /t REG_SZ /d "1" /f >nul 2>&1
)

:: Step 4: Copy extension files
echo [*] Installing extension files...
if exist "%TARGET_DIR%" (
    rmdir /s /q "%TARGET_DIR%" >nul 2>&1
)
mkdir "%TARGET_DIR%"

if exist "%SOURCE_DIR%\CSXS" xcopy "%SOURCE_DIR%\CSXS" "%TARGET_DIR%\CSXS\" /E /I /H /Y /Q >nul 2>&1
if exist "%SOURCE_DIR%\client" xcopy "%SOURCE_DIR%\client" "%TARGET_DIR%\client\" /E /I /H /Y /Q >nul 2>&1
if exist "%SOURCE_DIR%\host" xcopy "%SOURCE_DIR%\host" "%TARGET_DIR%\host\" /E /I /H /Y /Q >nul 2>&1
if exist "%SOURCE_DIR%\.debug" copy /Y "%SOURCE_DIR%\.debug" "%TARGET_DIR%\.debug" >nul 2>&1

:: Create fallback folder if needed
if not exist "%USERPROFILE%\Documents\Emoji Library Assets" (
    mkdir "%USERPROFILE%\Documents\Emoji Library Assets" >nul 2>&1
)

if exist "%TARGET_DIR%\CSXS\manifest.xml" (
    color 0A
    echo.
    echo ================================================================
    echo        [SUCCESS] EMOJI LIBRARY INSTALLED SUCCESSFULLY!
    echo ================================================================
    echo.
    echo Instructions:
    echo 1. Launch or Restart Adobe After Effects or Premiere Pro.
    echo 2. Open: Window -^> Extensions -^> Emoji Library by Kairesh.
    echo 3. Start inserting emojis directly into your timeline!
    echo.
) else (
    color 0C
    echo [ERROR] Installation failed. Could not copy files to %TARGET_DIR%.
)

pause
