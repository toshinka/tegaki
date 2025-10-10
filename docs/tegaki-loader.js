// ==================================================
// tegaki-loader.js
// ブックマークレット用ローダー - コンパクト版
// ==================================================

(function() {
    'use strict';
    
    // ===== 設定 =====
    const TEGAKI_CORE_URL = 'https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/docs/tegaki.js';
    const MEBUKI_TIMEOUT = 3000;
    
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
            this.tegakiCore = null;
            this.container = null;
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
                
                // 3. UI作成
                this.createContainer();
                
                // 4. Tegakiコア読込と起動
                await this.loadAndInitTegaki();
                
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
            return null;
        }
        
        // ===== ファイル入力要素の検出 =====
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                const postBtn = document.querySelector(MEBUKI_SELECTORS.postButton);
                if (postBtn) {
                    postBtn.click();
                    await this.wait(300);
                }
                
                await this.waitFor(() => {
                    this.targetInput = document.querySelector(MEBUKI_SELECTORS.fileInput);
                    return this.targetInput !== null;
                }, MEBUKI_TIMEOUT);
                
                if (!this.targetInput) {
                    throw new Error('ファイル入力要素が見つかりません');
                }
            }
        }
        
        // ===== UIコンテナ作成（トップバーのみ） =====
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
                display: flex;
                flex-direction: column;
            `;
            
            // トップバー
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 8px 16px;
                background: #cf9c97;
                border-bottom: 2px solid #aa5a56;
                gap: 8px;
            `;
            
            // 投稿ボタン
            const postBtn = document.createElement('button');
            postBtn.textContent = '📎';
            postBtn.title = '掲示板に添付';
            postBtn.style.cssText = `
                padding: 8px 12px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: background 0.2s;
            `;
            postBtn.onmouseover = () => postBtn.style.background = '#22c55e';
            postBtn.onmouseout = () => postBtn.style.background = '#4ade80';
            postBtn.onclick = () => this.exportAndAttach();
            
            // 閉じるボタン
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.title = '閉じる';
            closeBtn.style.cssText = `
                padding: 8px 12px;
                background: #f87171;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: background 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.background = '#ef4444';
            closeBtn.onmouseout = () => closeBtn.style.background = '#f87171';
            closeBtn.onclick = () => this.cancel();
            
            topBar.appendChild(postBtn);
            topBar.appendChild(closeBtn);
            this.container.appendChild(topBar);
            
            // キャンバスエリア（Tegakiコアが使用）
            const canvasArea = document.createElement('div');
            canvasArea.id = 'tegaki-canvas-area';
            canvasArea.style.cssText = `
                flex: 1;
                position: relative;
                overflow: hidden;
                background: #ffffee;
            `;
            this.container.appendChild(canvasArea);
            
            document.body.appendChild(this.container);
            
            // スクロール防止
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        
        // ===== Tegakiコア読込と起動 =====
        async loadAndInitTegaki() {
            const script = document.createElement('script');
            script.src = TEGAKI_CORE_URL;
            script.charset = 'UTF-8';
            
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('[Tegaki] ✓ Core loaded');
                    resolve();
                };
                script.onerror = () => {
                    reject(new Error('Tegakiコアの読み込みに失敗しました'));
                };
                document.head.appendChild(script);
            });
            
            // Tegakiコアを初期化
            if (!window.TegakiCore) {
                throw new Error('TegakiCoreが見つかりません');
            }
            
            const canvasArea = document.getElementById('tegaki-canvas-area');
            this.tegakiCore = new window.TegakiCore(canvasArea);
        }
        
        // ===== エクスポートして添付 =====
        async exportAndAttach() {
            if (!this.tegakiCore) {
                alert('お絵かきツールが初期化されていません');
                return;
            }
            
            try {
                // キャンバスから画像を取得
                const blob = await this.tegakiCore.exportAsBlob();
                
                // 掲示板に注入
                await this.injectToBoard(blob);
                
                alert('画像を添付しました！投稿ボタンを押してください。');
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki] エクスポート失敗:', error);
                alert('画像の出力に失敗しました\n' + error.message);
            }
        }
        
        // ===== 掲示板にFile注入 =====
        async injectToBoard(blob) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            const filename = `tegaki_${Date.now()}.png`;
            const file = new File([blob], filename, {
                type: 'image/png',
                lastModified: Date.now()
            });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            // プレビュー表示を待つ
            try {
                await this.waitFor(() => {
                    return document.querySelector(MEBUKI_SELECTORS.previewImg) !== null;
                }, 3000);
            } catch (error) {
                console.warn('[Tegaki] プレビュー確認タイムアウト');
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
            if (this.tegakiCore && this.tegakiCore.destroy) {
                this.tegakiCore.destroy();
                this.tegakiCore = null;
            }
            
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
        }
        
        // ===== ユーティリティ =====
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
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