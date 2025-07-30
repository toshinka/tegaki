@echo off
echo Starting Vite development server...
echo.

:: npmがインストールされているかチェック
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: npm is not installed or not in your PATH.
    echo Please install Node.js and npm from https://nodejs.org/
    pause
    exit /b 1
)

:: プロジェクトの依存関係がインストールされているかチェック
if not exist "node_modules" (
    echo "node_modules" directory not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: npm install failed.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully.
    echo.
)

:: Vite開発サーバーを起動
echo Running npm run dev...
call npm run dev

echo.
echo Development server stopped.
pause