@echo off
echo ===========================================
echo   Drawing Tool Development Server
echo ===========================================
echo.

cd /d "%~dp0drawing-tool"

echo プロジェクトディレクトリに移動しました: %CD%
echo.

echo 依存関係をチェック中...
if not exist "node_modules" (
    echo node_modules が見つかりません。npm install を実行します...
    call npm install
    if errorlevel 1 (
        echo npm install に失敗しました。
        pause
        exit /b 1
    )
    echo.
)

echo 開発サーバーを起動中...
echo ブラウザで http://localhost:5173 を開いてください
echo.
echo サーバーを停止するには Ctrl+C を押してください
echo.

call npm run dev

pause