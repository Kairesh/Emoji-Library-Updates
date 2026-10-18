@echo off
title Uninstall Emoji Library by Kairesh
color 0E

echo ================================================================
echo       UNINSTALL EMOJI LIBRARY BY KAIRESH
echo ================================================================
echo.

set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\emoji-library-by-kairesh"

if exist "%TARGET_DIR%" (
    echo [*] Removing Emoji Library from Adobe extensions...
    rmdir /s /q "%TARGET_DIR%" >nul 2>&1
    echo [SUCCESS] Extension uninstalled cleanly!
) else (
    echo [*] Emoji Library is not currently installed.
)

echo.
pause
