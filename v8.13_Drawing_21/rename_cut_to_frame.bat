@echo off
chcp 65001 >nul
echo ========================================
echo CUT → Frame 用語変更バッチ
echo ========================================
echo.
echo 対象フォルダ: %~dp0
echo.
echo 以下のファイルを処理します:
echo - system/animation-system.js
echo - ui/timeline-ui.js
echo - ui/keyboard-handler.js
echo - ui/timeline-thumbnail-utils.js
echo - ui/album-popup.js
echo - ui/quick-access-popup.js
echo.
pause

setlocal enabledelayedexpansion

:: 処理対象ファイルリスト
set "files=system\animation-system.js ui\timeline-ui.js ui\keyboard-handler.js ui\timeline-thumbnail-utils.js ui\album-popup.js ui\quick-access-popup.js"

:: バックアップフォルダ作成
set "backup_dir=%~dp0_backup_before_rename_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "backup_dir=!backup_dir: =0!"
mkdir "!backup_dir!" 2>nul

echo.
echo バックアップ作成中...
for %%f in (%files%) do (
    if exist "%%f" (
        echo   %%f
        xcopy "%%f" "!backup_dir!\%%f*" /Y /I /Q >nul
    )
)

echo.
echo 置換処理開始...
echo.

for %%f in (%files%) do (
    if exist "%%f" (
        echo [処理中] %%f
        
        :: 一時ファイル作成
        set "temp_file=%%f.tmp"
        
        :: PowerShellで置換実行（UTF-8対応）
        powershell -NoProfile -Command ^
        "$content = Get-Content '%%f' -Encoding UTF8 -Raw; ^
        $content = $content -replace '\bCUT\b', 'FRAME'; ^
        $content = $content -replace '\bCut\b', 'Frame'; ^
        $content = $content -replace '\bcut\b', 'frame'; ^
        $content = $content -replace '\bcuts\b', 'frames'; ^
        $content = $content -replace '\bCuts\b', 'Frames'; ^
        [System.IO.File]::WriteAllText('!temp_file!', $content, [System.Text.UTF8Encoding]::new($false))"
        
        :: 元ファイルを置き換え
        move /Y "!temp_file!" "%%f" >nul
        
        echo   [完了] %%f
    ) else (
        echo   [スキップ] %%f (ファイルが見つかりません)
    )
)

echo.
echo ========================================
echo 処理完了
echo ========================================
echo.
echo バックアップ: !backup_dir!
echo.
echo 次のステップ:
echo 1. ブラウザで index.html を開いて動作確認
echo 2. 問題があればバックアップから復元
echo.
pause