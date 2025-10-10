// ==================================================
// tegaki-loader.js
// ブックマークレット用ローダー - 拡張可能な2ファイル構成
// ==================================================

(function() {
    'use strict';
    
    // ===== 設定 =====
    // GitHub Pagesを使用（正しいMIMEタイプで配信される）
    const TEGAKI_CORE_URL = 'https://toshinka.github.io/tegaki/docs/tegaki_basic.js';
    const MEBUKI_TIMEOUT = 3000;
    
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
                console.log('[Tegaki Loader] Starting...');
                
                // 1. 掲示板判定
                this.boardType = this.detectBoard();
                if (!this.boardType) {
                    alert('対応していない掲示板です\n現在はめぶきちゃんねる(mebuki.moe)のみ対応しています');
                    return;
                }
                console.log('[Tegaki Loader] ✓ Board detected:', this.boardType);
                
                // 2. 要素検出
                await this.findTargetElements();
                console.log('[Tegaki Loader] ✓ Target elements found');
                
                // 3. UI作成（トップバーのみ）
                this.createContainer();
                console.log('[Tegaki Loader] ✓ Container created');
                
                // 4. Tegakiコア読込と起動
                await this.loadAndInitTegaki();
                console.log('[Tegaki Loader] ✓ Tegaki initialized');
                
            } catch (error) {
                console.error('[Tegaki Loader] 起動失敗:', error);
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
            // 将来的に他の掲示板を追加可能
            // if (host.includes('futaba.com')) return 'futaba';
            return null;
        }
        
        // ===== ファイル入力要素の検出 =====
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                // レス投稿ボタンをクリックして入力欄を開く
                const postBtn = document.querySelector(MEBUKI_SELECTORS.postButton);
                if (postBtn) {
                    postBtn.click();
                    await this.wait(300);
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
            
            // トップバー（ふたば風カラー）
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: #e9c2ba;
                border-bottom: 1px solid #aa5a56;
                gap: 8px;
            `;
            
            // 左側：タイトルと注意書き
            const titleArea = document.createElement('div');
            titleArea.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 2px;
            `;
            
            const title = document.createElement('div');
            title.textContent = 'めぶき用Tegakiツールテスト';
            title.style.cssText = `
                color: #800000;
                font-size: 14px;
                font-weight: bold;
            `;
            
            const notice = document.createElement('div');
            notice.textContent = '※予告無しにツール削除の可能性があります。';
            notice.style.cssText = `
                color: #aa5a56;
                font-size: 10px;
            `;
            
            titleArea.appendChild(title);
            titleArea.appendChild(notice);
            
            // 右側：ボタングループ
            const buttonGroup = document.createElement('div');
            buttonGroup.style.cssText = `
                display: flex;
                gap: 8px;
            `;
            
            // 投稿ボタン（めぶきアイコン + 緑）
            const postBtn = document.createElement('button');
            postBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
                    <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/>
                    <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/>
                    <path d="M5 21h14"/>
                </svg>
                <span style="vertical-align: middle;">投稿</span>
            `;
            postBtn.title = '掲示板に添付';
            postBtn.style.cssText = `
                padding: 8px 16px;
                background: #4ade80;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background 0.2s;
                display: inline-flex;
                align-items: center;
            `;
            postBtn.onmouseover = () => postBtn.style.background = '#22c55e';
            postBtn.onmouseout = () => postBtn.style.background = '#4ade80';
            postBtn.onclick = () => this.exportAndAttach();
            
            // 閉じるボタン（朱色）
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
            
            buttonGroup.appendChild(postBtn);
            buttonGroup.appendChild(closeBtn);
            topBar.appendChild(titleArea);
            topBar.appendChild(buttonGroup);
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
            // スクリプトが既に読み込まれているかチェック
            if (window.TegakiCore) {
                console.log('[Tegaki Loader] TegakiCore already loaded');
                this.initTegaki();
                return;
            }
            
            console.log('[Tegaki Loader] Loading TegakiCore from:', TEGAKI_CORE_URL);
            
            // スクリプトタグで読み込み
            const script = document.createElement('script');
            script.src = TEGAKI_CORE_URL;
            script.charset = 'UTF-8';
            script.type = 'text/javascript'; // 明示的に指定
            
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('[Tegaki Loader] ✓ TegakiCore script loaded');
                    resolve();
                };
                script.onerror = (error) => {
                    console.error('[Tegaki Loader] ✗ Failed to load TegakiCore:', error);
                    reject(new Error('Tegakiコアの読み込みに失敗しました\nURL: ' + TEGAKI_CORE_URL));
                };
                document.head.appendChild(script);
            });
            
            // TegakiCoreが定義されているか確認
            if (!window.TegakiCore) {
                throw new Error('TegakiCoreが読み込まれましたが、クラスが見つかりません');
            }
            
            this.initTegaki();
        }
        
        // ===== Tegakiコア初期化 =====
        initTegaki() {
            const canvasArea = document.getElementById('tegaki-canvas-area');
            if (!canvasArea) {
                throw new Error('キャンバスエリアが見つかりません');
            }
            
            try {
                this.tegakiCore = new window.TegakiCore(canvasArea);
                console.log('[Tegaki Loader] ✓ TegakiCore instance created');
            } catch (error) {
                console.error('[Tegaki Loader] ✗ Failed to initialize TegakiCore:', error);
                throw new Error('TegakiCoreの初期化に失敗しました: ' + error.message);
            }
        }
        
        // ===== エクスポートして添付 =====
        async exportAndAttach() {
            if (!this.tegakiCore) {
                alert('お絵かきツールが初期化されていません');
                return;
            }
            
            try {
                console.log('[Tegaki Loader] Exporting canvas...');
                
                // キャンバスから画像を取得
                const blob = await this.tegakiCore.exportAsBlob();
                console.log('[Tegaki Loader] ✓ Blob created:', blob.size, 'bytes');
                
                // 掲示板に注入
                await this.injectToBoard(blob);
                console.log('[Tegaki Loader] ✓ Image injected to board');
                
                alert('画像を添付しました！投稿ボタンを押してください。');
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki Loader] エクスポート失敗:', error);
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
            
            // changeイベント発火
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            // プレビュー表示を待つ（オプション）
            try {
                await this.waitFor(() => {
                    return document.querySelector(MEBUKI_SELECTORS.previewImg) !== null;
                }, 3000);
                console.log('[Tegaki Loader] ✓ Preview displayed');
            } catch (error) {
                console.warn('[Tegaki Loader] プレビュー確認タイムアウト（処理は正常完了）');
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
            console.log('[Tegaki Loader] Cleaning up...');
            
            // Tegakiコア破棄
            if (this.tegakiCore && this.tegakiCore.destroy) {
                this.tegakiCore.destroy();
                this.tegakiCore = null;
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
            
            console.log('[Tegaki Loader] ✓ Cleanup complete');
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

console.log('✅ tegaki-loader.js loaded (2-file architecture)');