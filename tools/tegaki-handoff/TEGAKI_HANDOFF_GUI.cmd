@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "TOOL_DIR=%~dp0"
for %%I in ("%TOOL_DIR%..\..") do set "REPO_ROOT=%%~fI"

start "TEGAKI Handoff GUI" powershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -STA -File "%TOOL_DIR%TEGAKI_HANDOFF_GUI.ps1" -RepoRoot "%REPO_ROOT%"

endlocal
exit /b 0
