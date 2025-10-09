// ==================================================
// tegaki-loader.js
// ブックマークレット用ローダー - めぶきちゃんねる連携
// ==================================================

(function() {
    'use strict';
    
    // ===== 設定 =====
    const TEGAKI_BASE_URL = 'https://toshinka.github.io/tegaki/';
    const MEBUKI_TIMEOUT = 3000; // 要素検出タイムアウト(ms)
    
    // ===== めぶきちゃんねる検出用セレクタ =====
    const MEBUKI_SELECTORS = {
        postButton: 'button[title="レスを投稿"]',
        fileInput: 'input[type="file"][accept*="image"]',
        previewImg: 'img[src^="blob:"]'
    };
    
    // ===== ブックマークレット本体 =====
    class TegakiBookmarklet {
        constructor() {
            this.boardType = null;
            this.targetInput = null;
            this.tegakiApp = null;
            this.container = null;
            this.exportFormat = 'gif'; // デフォルトはGIF
            this.originalBodyOverflow = null;
        }
        
        // ===== エントリーポイント =====
        async start() {
            try {
                // 1. 掲示板判定
                this.boardType = this.detectBoard();
                if (!this.boardType) {
                    alert('対応していない掲示板です\n現在はめぶきちゃんねる(mebuki.moe)のみ対応しています');
                    return;
                }
                
                // 2. 要素検出
                await this.findTargetElements();
                
                // 3. Tegakiコア読込
                await this.loadTegakiCore();
                
                // 4. UI作成
                this.createContainer();
                
                // 5. Tegaki起動
                await this.initializeTegaki();
                
            } catch (error) {
                console.error('[Tegaki] 起動失敗:', error);
                alert('Tegaki起動に失敗しました\n' + error.message);
                this.cleanup();
            }
        }
        
        // ===== 掲示板判定 =====
        detectBoard() {
            const host = location.host;
            if (host.includes('mebuki.moe')) {
                return 'mebuki';
            }
            // 将来的に他の掲示板にも対応可能
            return null;
        }
        
        // ===== ファイル入力要素の検出 =====
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                // レス投稿ボタンをクリックして入力欄を開く
                const postBtn = document.querySelector(MEBUKI_SELECTORS.postButton);
                if (postBtn) {
                    postBtn.click();
                    await this.wait(300); // UI展開待ち
                }
                
                // input要素を探す
                await this.waitFor(() => {
                    this.targetInput = document.querySelector(MEBUKI_SELECTORS.fileInput);
                    return this.targetInput !== null;
                }, MEBUKI_TIMEOUT);
                
                if (!this.targetInput) {
                    throw new Error('ファイル入力要素が見つかりません');
                }
            }
        }
        
        // ===== Tegakiコアスクリプトの読込 =====
        async loadTegakiCore() {
            // CDNライブラリ（先に読み込む）
            const cdnLibraries = [
                'https://cdn.jsdelivr.net/npm/pixi.js@8.13.0/dist/pixi.min.js',
                'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js',
                'https://unpkg.com/upng-js@2.1.0/UPNG.js',
                'https://cdnjs.cloudflare.com/ajax/libs/UPNG-js/2.1.0/UPNG.js'
            ];
            
            console.log('[Tegaki] Loading CDN libraries...');
            for (const url of cdnLibraries) {
                await this.loadScript(url);
            }
            console.log('[Tegaki] ✓ All CDN libraries loaded');
            
            // Tegakiコアスクリプト
            const scripts = [
                'config.js',
                'coordinate-system.js',
                'system/event-bus.js',
                'system/state-manager.js',
                'system/layer-commands.js',
                'system/camera-system.js',
                'system/layer-system.js',
                'system/drawing-clipboard.js',
                'system/history.js',
                'system/virtual-album.js',
                'system/animation-system.js',
                'system/export-manager.js',
                'system/exporters/png-exporter.js',
                'system/exporters/apng-exporter.js',
                'system/exporters/gif-exporter.js',
                'system/exporters/webp-exporter.js',
                'ui/timeline-ui.js',
                'ui/album-popup.js',
                'ui/ui-panels.js',
                'ui/timeline-thumbnail-utils.js',
                'core-runtime.js',
                'core-engine.js'
            ];
            
            console.log('[Tegaki] Loading Tegaki core scripts...');
            for (const script of scripts) {
                const url = TEGAKI_BASE_URL + script;
                await this.loadScript(url);
            }
            console.log('[Tegaki] ✓ All Tegaki scripts loaded');
        }
        
        // ===== スクリプト読込ヘルパー =====
        loadScript(url) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.charset = 'UTF-8';
                script.onload = () => {
                    console.log(`[Tegaki] ✓ Script loaded: ${url}`);
                    resolve();
                };
                script.onerror = (error) => {
                    console.error(`[Tegaki] ✗ Failed to load: ${url}`, error);
                    reject(new Error(`Failed to load: ${url}`));
                };
                document.head.appendChild(script);
            });
        }
        
        // ===== UIコンテナ作成 =====
        createContainer() {
            // フルスクリーンコンテナ
            this.container = document.createElement('div');
            this.container.id = 'tegaki-bookmarklet-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 999999;
                background: #1a1a1a;
                display: flex;
                flex-direction: column;
            `;
            
            // トップバー
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background: #2a2a2a;
                border-bottom: 1px solid #444;
            `;
            
            // タイトル
            const title = document.createElement('div');
            title.textContent = 'Tegaki - お絵かきツール';
            title.style.cssText = `
                color: white;
                font-size: 16px;
                font-weight: bold;
            `;
            topBar.appendChild(title);
            
            // ボタングループ
            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = `
                display: flex;
                gap: 10px;
            `;
            
            // フォーマット選択
            const formatSelect = document.createElement('select');
            formatSelect.style.cssText = `
                padding: 8px 12px;
                background: #3a3a3a;
                color: white;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
            `;
            formatSelect.innerHTML = `
                <option value="gif">GIF形式</option>
                <option value="png">PNG形式</option>
                <option value="apng">APNG形式</option>
                <option value="webp">WebP形式</option>
            `;
            formatSelect.value = this.exportFormat;
            formatSelect.onchange = (e) => {
                this.exportFormat = e.target.value;
            };
            btnGroup.appendChild(formatSelect);
            
            // 完了ボタン
            const doneBtn = document.createElement('button');
            doneBtn.textContent = '✓ 掲示板に貼り付けて閉じる';
            doneBtn.style.cssText = `
                padding: 10px 20px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
            `;
            doneBtn.onmouseover = () => doneBtn.style.background = '#45a049';
            doneBtn.onmouseout = () => doneBtn.style.background = '#4CAF50';
            doneBtn.onclick = () => this.exportAndClose();
            btnGroup.appendChild(doneBtn);
            
            // キャンセルボタン
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '✕ キャンセル';
            cancelBtn.style.cssText = `
                padding: 10px 20px;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            cancelBtn.onmouseover = () => cancelBtn.style.background = '#da190b';
            cancelBtn.onmouseout = () => cancelBtn.style.background = '#f44336';
            cancelBtn.onclick = () => this.cancel();
            btnGroup.appendChild(cancelBtn);
            
            topBar.appendChild(btnGroup);
            this.container.appendChild(topBar);
            
            // キャンバス用コンテナ
            const canvasArea = document.createElement('div');
            canvasArea.id = 'tegaki-canvas-container';
            canvasArea.style.cssText = `
                flex: 1;
                position: relative;
                overflow: hidden;
            `;
            this.container.appendChild(canvasArea);
            
            document.body.appendChild(this.container);
            
            // スクロール防止
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        
        // ===== Tegaki起動 =====
        async initializeTegaki() {
            const canvasDiv = document.getElementById('tegaki-canvas-container');
            
            // デバッグ: 利用可能なシステムを確認
            console.log('[Tegaki] Available systems:');
            console.log('  - window.startTegakiApp:', typeof window.startTegakiApp);
            console.log('  - window.TegakiCore:', typeof window.TegakiCore);
            console.log('  - window.PIXI:', typeof window.PIXI);
            console.log('  - window.TEGAKI_CONFIG:', typeof window.TEGAKI_CONFIG);
            
            if (!window.startTegakiApp) {
                throw new Error('Tegakiアプリケーションが見つかりません\nwindow.startTegakiAppが存在しません');
            }
            
            // Tegaki起動 (ブックマークレットモード)
            this.tegakiApp = await window.startTegakiApp({
                container: canvasDiv,
                isBookmarkletMode: true
            });
            
            console.log('[Tegaki] ✓ Application started successfully');
        }
        
        // ===== エクスポートして閉じる =====
        async exportAndClose() {
            if (!this.tegakiApp || !this.tegakiApp.coreEngine) {
                alert('Tegakiアプリケーションが初期化されていません');
                return;
            }
            
            try {
                // エクスポート実行
                const blob = await this.exportBlob(this.exportFormat);
                
                // 掲示板に注入
                await this.injectToBoard(blob);
                
                // 成功したら閉じる
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki] エクスポート失敗:', error);
                alert('画像の出力に失敗しました\n' + error.message);
            }
        }
        
        // ===== Blob取得 =====
        async exportBlob(format) {
            const coreEngine = this.tegakiApp.coreEngine;
            const exportManager = this.tegakiApp.exportManager;
            const animationSystem = coreEngine.getAnimationSystem();
            
            if (!exportManager) {
                throw new Error('ExportManagerが見つかりません');
            }
            
            // カット数チェック
            const animData = animationSystem ? animationSystem.getAnimationData() : null;
            const cutCount = animData && animData.cuts ? animData.cuts.length : 1;
            
            if (cutCount === 1 && format !== 'png') {
                // 単一フレームの場合はPNGを推奨
                if (!confirm(`カットが1つしかありません。PNG形式で出力しますか?\n\n「キャンセル」を押すと${format.toUpperCase()}形式で出力します。`)) {
                    // ユーザーが選択したフォーマットを維持
                } else {
                    format = 'png';
                }
            }
            
            // フォーマット別にBlob取得
            const result = await exportManager.generatePreview(format);
            return result.blob;
        }
        
        // ===== 掲示板にFile注入 =====
        async injectToBoard(blob) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            // ファイル名決定
            const ext = blob.type.split('/')[1]?.split('+')[0] || 'png';
            const filename = `tegaki_${Date.now()}.${ext}`;
            
            // Blob → File変換
            const file = new File([blob], filename, {
                type: blob.type,
                lastModified: Date.now()
            });
            
            // DataTransfer経由で注入
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            // changeイベント発火
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            // プレビュー表示を待つ
            await this.waitForPreview();
        }
        
        // ===== プレビュー表示待機 =====
        async waitForPreview() {
            try {
                await this.waitFor(() => {
                    const preview = document.querySelector(MEBUKI_SELECTORS.previewImg);
                    return preview !== null;
                }, 5000);
            } catch (error) {
                // プレビュー表示されなくてもエラーにしない
                console.warn('[Tegaki] プレビュー表示の確認がタイムアウトしましたが、処理を継続します');
            }
        }
        
        // ===== キャンセル =====
        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか?')) {
                this.cleanup();
            }
        }
        
        // ===== クリーンアップ =====
        cleanup() {
            // Tegaki破棄
            if (this.tegakiApp && this.tegakiApp.app) {
                this.tegakiApp.app.destroy(true, { children: true });
                this.tegakiApp = null;
            }
            
            // コンテナ削除
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            // スタイル復元
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
        }
        
        // ===== ユーティリティ: 待機 =====
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // ===== ユーティリティ: 条件待機 =====
        waitFor(condition, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const check = () => {
                    if (condition()) {
                        resolve();
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('タイムアウト'));
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }
    }
    
    // ===== グローバル登録 =====
    window.tegakiStart = function() {
        if (!window._tegakiBookmarklet) {
            window._tegakiBookmarklet = new TegakiBookmarklet();
        }
        window._tegakiBookmarklet.start();
    };
    
    // ===== 自動起動 =====
    window.tegakiStart();
    
})();

console.log('✅ tegaki-loader.js loaded');