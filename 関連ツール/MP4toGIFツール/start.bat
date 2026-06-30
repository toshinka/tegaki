@echo off
chcp 65001 >nul
echo ------------------------------------------
echo MP4 to GIF Converter を起動します...
echo ------------------------------------------
cd /d "%~dp0"
call npm run dev -- --open
pause
