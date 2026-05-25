@echo off
title TimeManager
cd /d "%~dp0"
call npm run build
if %errorlevel% equ 0 (
    start "" npx electron .
) else (
    echo.
    echo Build failed.
)
echo.
pause
