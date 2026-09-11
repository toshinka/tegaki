@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "TOOL_DIR=%~dp0"
for %%I in ("%TOOL_DIR%..\..") do set "REPO_ROOT=%%~fI"

:menu
cls
echo TEGAKI Handoff
echo.
echo 1. Stage Card from Clipboard
echo 2. Show Status
echo 3. Copy Latest Report to Clipboard
echo 4. Initialize / Repair Handoff Folders
echo 0. Exit
echo.
choice /C 12340 /N /M "Select: "
if errorlevel 5 goto :end
if errorlevel 4 goto :init
if errorlevel 3 goto :copy_report
if errorlevel 2 goto :status
if errorlevel 1 goto :stage
goto :menu

:stage
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TOOL_DIR%stage_card_from_clipboard.ps1" -RepoRoot "%REPO_ROOT%" -FriendlyErrors
echo.
pause
goto :menu

:status
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TOOL_DIR%show_handoff_status.ps1" -RepoRoot "%REPO_ROOT%" -FriendlyErrors
echo.
pause
goto :menu

:copy_report
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TOOL_DIR%copy_report_to_clipboard.ps1" -RepoRoot "%REPO_ROOT%" -FriendlyErrors
echo.
pause
goto :menu

:init
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TOOL_DIR%init_handoff.ps1" -RepoRoot "%REPO_ROOT%" -FriendlyErrors
echo.
pause
goto :menu

:end
endlocal
exit /b 0
