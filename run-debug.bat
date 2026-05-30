@echo off
title TimeManager Debug
cd /d "%~dp0"
echo Building...
call npm run build
if %errorlevel% equ 0 (
    echo Starting Electron with debug console...
    npx electron . --enable-logging
) else (
    echo.
    echo Build FAILED - check errors above
)
echo.
pause
