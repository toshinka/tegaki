@echo off
chcp 65001 >nul
title Anime FX Editor
echo =========================================
echo Anime FX Editor 起動ツール
echo =========================================
cd /d "%~dp0anime_fx_editor"

if not exist "node_modules\" (
    echo 初回セットアップ: 必要なパッケージをインストールしています...
    call npm install
)

echo 開発サーバーを起動しています...
cmd /k "npm run dev -- --open"
