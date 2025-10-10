// ==================================================
// tegaki_loader_anime.js
// お絵かきツールをページに読み込み、UIを制御する
// ==================================================

(function() {
    'use strict';
    
    // 起動関数がすでに存在する場合は重複実行を防ぐ
    if (window.tegakiAnimeStart) {
        window.tegakiAnimeStart();
        return;
    }

    // ===== 設定 (アニメーション版) =====
    const SCRIPT_URLS = {
        // ↓↓↓↓↓ このURLはご自身の環境に合わせて書き換えてください ↓↓↓↓↓
        tegaki: 'https://cdn.jsdelivr.net/gh/toshinka/tegaki/docs/tegaki_anime.js', // 例: GitHub PagesのURL
        upng: 'https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.min.js',
        gif: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js',
        gifWorker: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
    };
    const MEBUKI_TIMEOUT = 3000;
    const MEBUKI_SELECTORS = {
        postButton: 'button[title="レスを投稿"]',
        fileInput: 'input[type="file"][accept*="image"]',
        previewImg: 'img[src^="blob:"]'
    };
    
    // ===== ユーティリティ =====
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    }

    // ふたば/めぶき風ボタンを作成するヘルパー関数
    function createButton(text, onClick, isPrimary = false) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        
        const primaryBg = '#4ade80'; // 緑系
        const primaryHover = '#22c55e';
        const primaryBorder = '#22c55e';

        const secondaryBg = '#f87171'; // 朱色系
        const secondaryHover = '#ef4444';
        const secondaryBorder = '#ef4444';

        btn.style.cssText = `
            padding: 8px 16px;
            background: ${isPrimary ? primaryBg : secondaryBg};
            color: white;
            border: 2px solid ${isPrimary ? primaryBorder : secondaryBorder};
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        `;
        btn.onmouseover = () => btn.style.background = isPrimary ? primaryHover : secondaryHover;
        btn.onmouseout = () => btn.style.background = isPrimary ? primaryBg : secondaryBg;
        btn.onclick = onClick;
        return btn;
    }
    
    // ===== ローダーメインクラス =====
    class TegakiLoaderAnime {
        constructor() {
            this.boardType = null;
            this.targetInput = null;
            this.core = null;
            this.container = null;
            this.originalBodyOverflow = null;
            this.loadingEl = null;
        }

        // ===== 掲示板判定 (Basicから流用) =====
        detectBoard() {
            const host = location.host;
            if (host.includes('mebuki.moe')) {
                return 'mebuki';
            }
            return null;
        }
        
        // ===== ファイル入力要素の検出 (Basicから流用) =====
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

        // ===== エントリーポイント =====
        async start() {
            console.log('[Tegaki Anime Loader] Starting...');
            
            // 既存のUIがあれば削除して作り直す
            if (window.tegakiAnimeCore) {
                window.tegakiAnimeCore.destroy();
                window.tegakiAnimeCore = null;
            }
            const existingContainer = document.getElementById('tegaki-anime-container');
            if (existingContainer) {
                existingContainer.remove();
            }

            // 掲示板判定と要素検出を先に行う (失敗したらここで終了)
            try {
                this.boardType = this.detectBoard();
                if (!this.boardType) {
                    throw new Error('対応していない掲示板です');
                }
                await this.findTargetElements();
            } catch (error) {
                alert(`Tegaki起動に失敗しました: ${error.message}`);
                this.cleanup();
                return;
            }

            // ローディング表示
            this.loadingEl = document.createElement('div');
            this.loadingEl.textContent = 'お絵かきツールを準備中...';
            this.loadingEl.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background: #800000; color:white; padding:10px; border-radius:5px; z-index:10001;';
            document.body.appendChild(this.loadingEl);

            try {
                // ライブラリを読み込み
                await Promise.all([
                    loadScript(SCRIPT_URLS.upng),
                    loadScript(SCRIPT_URLS.gif),
                    loadScript(SCRIPT_URLS.tegaki)
                ]);
                
                // GIFライブラリのバグ修正を適用
                if (window.GIF && window.GIF.prototype) {
                    if (typeof window.GIF.prototype.options === 'undefined') {
                        window.GIF.prototype.options = {};
                    }
                    window.GIF.prototype.options.workerScript = SCRIPT_URLS.gifWorker;
                } else {
                     throw new Error('GIFライブラリ (window.GIF) が見つかりません。');
                }
                
                // UI作成とコアインスタンス化
                this.createUI();
                
                // TegakiCoreをインスタンス化
                const tegakiArea = document.getElementById('tegaki-canvas-area-anime');
                if (!window.TegakiAnimeCore) {
                    throw new Error('TegakiAnimeCoreクラスが見つかりません。');
                }
                this.core = new window.TegakiAnimeCore(tegakiArea);
                window.tegakiAnimeCore = this.core; // グローバルに公開
                
                this.loadingEl.remove();

            } catch (error) {
                console.error('Tegaki loader failed:', error);
                this.loadingEl.textContent = 'お絵かきツールの読み込みに失敗しました。';
                setTimeout(() => this.loadingEl.remove(), 3000);
                this.cleanup();
            }
        }

        // ===== UI作成 (BasicのトップバーとAnimeのメインUIを統合) =====
        createUI() {
            // フルスクリーンコンテナ
            this.container = document.createElement('div');
            this.container.id = 'tegaki-anime-container';
            this.container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #f0e0d6; z-index: 10000;
                display: flex; flex-direction: column;
            `;

            // トップバー（ふたば風カラー）
            const topBar = document.createElement('div');
            topBar.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: #e9c2ba;
                border-bottom: 2px solid #cf9c97;
                gap: 8px;
            `;
            
            // 左側：タイトル
            const title = document.createElement('div');
            title.textContent = 'アニメお絵かきツール';
            title.style.cssText = `
                color: #800000;
                font-size: 14px;
                font-weight: bold;
            `;
            
            // 右側：ボタングループ
            const buttonGroup = document.createElement('div');
            buttonGroup.style.cssText = `display: flex; gap: 8px;`;

            // APNG投稿ボタン
            const postApngBtn = createButton('APNG投稿', () => this.exportAndAttach('apng'), true);
            postApngBtn.title = 'APNGを生成して掲示板に添付';
            
            // GIF投稿ボタン
            const postGifBtn = createButton('GIF投稿', () => this.exportAndAttach('gif'), true);
            postGifBtn.title = 'GIFを生成して掲示板に添付';

            // 閉じるボタン
            const closeBtn = createButton('✕ 閉じる', () => this.cancel());
            closeBtn.title = '破棄して閉じる';
            
            buttonGroup.appendChild(postApngBtn);
            buttonGroup.appendChild(postGifBtn);
            buttonGroup.appendChild(closeBtn);
            topBar.appendChild(title);
            topBar.appendChild(buttonGroup);
            this.container.appendChild(topBar);

            // キャンバスエリア（Tegakiコアが使用）
            const canvasArea = document.createElement('div');
            canvasArea.id = 'tegaki-canvas-area-anime';
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

        // ===== エクスポートして添付 (Basicから改変) =====
        async exportAndAttach(type) {
            if (!this.core) {
                alert('お絵かきツールが初期化されていません');
                return;
            }
            
            try {
                this.loadingEl.textContent = `${type.toUpperCase()}を生成中...`;
                this.loadingEl.style.display = 'block';

                let blob;
                if (type === 'apng') {
                    blob = await this.core.exportAsApng();
                } else if (type === 'gif') {
                    blob = await this.core.exportAsGif();
                } else {
                    throw new Error('無効なエクスポートタイプです。');
                }
                
                this.loadingEl.style.display = 'none';

                if (!blob) {
                    alert(`${type.toUpperCase()}の生成に失敗しました。`);
                    return;
                }
                
                console.log(`[Tegaki Anime Loader] ✓ ${type.toUpperCase()} Blob created:`, blob.size, 'bytes');
                
                // 掲示板に注入
                await this.injectToBoard(blob, type);
                console.log('[Tegaki Anime Loader] ✓ Image injected to board');
                
                alert(`画像を添付しました！投稿ボタンを押してください。\n(ファイル形式: ${type.toUpperCase()})`);
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki Anime Loader] エクスポート失敗:', error);
                this.loadingEl.style.display = 'none';
                alert(`画像の出力に失敗しました\n${error.message}`);
            }
        }
        
        // ===== 掲示板にFile注入 (Basicから流用) =====
        async injectToBoard(blob, type) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            const mimeType = type === 'apng' ? 'image/apng' : 'image/gif';
            const filename = `tegaki_anime_${Date.now()}.${type}`;
            const file = new File([blob], filename, {
                type: mimeType,
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
                console.log('[Tegaki Anime Loader] ✓ Preview displayed');
            } catch (error) {
                console.warn('[Tegaki Anime Loader] プレビュー確認タイムアウト（処理は正常完了）');
            }
        }

        // ===== キャンセル (Basicから流用) =====
        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか?')) {
                this.cleanup();
            }
        }
        
        // ===== クリーンアップ (Basicから流用) =====
        cleanup() {
            console.log('[Tegaki Anime Loader] Cleaning up...');
            
            if (this.core && this.core.destroy) {
                this.core.destroy();
                this.core = null;
                window.tegakiAnimeCore = null;
            }
            
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            
            if (this.originalBodyOverflow !== null) {
                document.body.style.overflow = this.originalBodyOverflow;
                this.originalBodyOverflow = null;
            }
            
            if (this.loadingEl) {
                this.loadingEl.remove();
                this.loadingEl = null;
            }
            
            console.log('[Tegaki Anime Loader] ✓ Cleanup complete');
        }

        // ===== ユーティリティ: 待機 (Basicから流用) =====
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // ===== ユーティリティ: 条件待機 (Basicから流用) =====
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
    window.tegakiAnimeStart = function() {
        if (!window.tegakiAnimeInstance) {
            window.tegakiAnimeInstance = new TegakiLoaderAnime();
        }
        window.tegakiAnimeInstance.start();
    };
    
    // 初回実行
    window.tegakiAnimeStart();

})();