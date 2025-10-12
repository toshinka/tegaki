(function() {
    'use strict';
    
    // バージョン情報
    const LOADER_VERSION = 'v7';
    
    // ===== 設定 =====
    const SCRIPT_URLS = {
        // 統合済みファイルのみ読み込む（他は不要）
        tegaki: 'https://toshinka.github.io/tegaki/tegaki_anime_test/dist/tegaki_anime.js'
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

    function createButton(text, onClick, isPrimary = false) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        
        const primaryBg = '#4ade80';
        const primaryHover = '#22c55e';
        const primaryBorder = '#22c55e';
        const secondaryBg = '#f87171';
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

        detectBoard() {
            const host = location.host;
            if (host.includes('mebuki.moe')) {
                return 'mebuki';
            }
            return null;
        }
        
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

        async start() {
            if (window.tegakiAnimeCore) {
                window.tegakiAnimeCore.destroy();
                window.tegakiAnimeCore = null;
            }
            const existingContainer = document.getElementById('tegaki-anime-container');
            if (existingContainer) {
                existingContainer.remove();
            }

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

            this.loadingEl = document.createElement('div');
            this.loadingEl.textContent = `お絵かきツールを準備中... (${LOADER_VERSION})`;
            this.loadingEl.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background: #800000; color:white; padding:10px; border-radius:5px; z-index:10001;';
            document.body.appendChild(this.loadingEl);

            try {
                // 統合済みファイルのみ読み込み
                await loadScript(SCRIPT_URLS.tegaki);
                
                // UI作成とコアインスタンス化
                this.createUI();
                
                const tegakiArea = document.getElementById('tegaki-canvas-area-anime');
                if (!window.TegakiAnimeCore) {
                    throw new Error('TegakiAnimeCoreクラスが見つかりません。');
                }
                this.core = new window.TegakiAnimeCore(tegakiArea);
                window.tegakiAnimeCore = this.core;
                
                this.loadingEl.remove();

            } catch (error) {
                console.error('Tegaki loader failed:', error);
                this.loadingEl.textContent = 'お絵かきツールの読み込みに失敗しました。';
                setTimeout(() => this.loadingEl.remove(), 3000);
                this.cleanup();
            }
        }

        createUI() {
            this.container = document.createElement('div');
            this.container.id = 'tegaki-anime-container';
            this.container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #f0e0d6; z-index: 10000;
                display: flex; flex-direction: column;
            `;

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
            
            const title = document.createElement('div');
            title.textContent = `めぶき手書き APNGアニメてすと ${LOADER_VERSION}`;
            title.style.cssText = `
                color: #800000;
                font-size: 14px;
                font-weight: bold;
            `;
            
            const buttonGroup = document.createElement('div');
            buttonGroup.style.cssText = `display: flex; gap: 8px;`;

            const postApngBtn = createButton('APNG投稿', () => this.exportAndAttach('apng'), true);
            postApngBtn.title = 'APNGを生成して掲示板に添付';
            
            // GIFボタンは一旦削除（Worker問題のため）
            // const postGifBtn = createButton('GIF投稿', () => this.exportAndAttach('gif'), true);

            const closeBtn = createButton('✕ 閉じる', () => this.cancel());
            closeBtn.title = '破棄して閉じる';
            
            buttonGroup.appendChild(postApngBtn);
            // buttonGroup.appendChild(postGifBtn); // 削除
            buttonGroup.appendChild(closeBtn);
            topBar.appendChild(title);
            topBar.appendChild(buttonGroup);
            this.container.appendChild(topBar);

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
            
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }

        async exportAndAttach(type) {
            if (!this.core) {
                alert('お絵かきツールが初期化されていません');
                return;
            }
            
            try {
                this.loadingEl = this.loadingEl || document.createElement('div');
                this.loadingEl.textContent = `${type.toUpperCase()}を生成中...`;
                this.loadingEl.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background: #800000; color:white; padding:10px; border-radius:5px; z-index:10001;';
                document.body.appendChild(this.loadingEl);

                let blob;
                
                const progressCallback = (p) => {
                    const percent = Math.floor(p * 100);
                    this.loadingEl.textContent = `${type.toUpperCase()}を生成中... (${percent}%)`;
                };

                if (type === 'apng') {
                    blob = await this.core.exportAsApng();
                } else if (type === 'gif') {
                    blob = await this.core.exportAsGif(progressCallback);
                } else {
                    throw new Error('無効なエクスポートタイプです。');
                }
                
                this.loadingEl.remove();

                if (!blob) {
                    alert(`${type.toUpperCase()}の生成に失敗しました。`);
                    return;
                }
                
                await this.injectToBoard(blob, type);
                
                alert(`画像を添付しました！投稿ボタンを押してください。\n(ファイル形式: ${type.toUpperCase()})`);
                this.cleanup();
                
            } catch (error) {
                console.error('[Tegaki Anime Loader] エクスポート失敗:', error);
                if (this.loadingEl) this.loadingEl.remove();
                alert(`画像の出力に失敗しました\n${error.message}`);
            }
        }
        
        async injectToBoard(blob, type) {
            if (!this.targetInput) {
                throw new Error('入力要素が見つかりません');
            }
            
            // APNG は標準の image/png を使用
            const mimeType = type === 'apng' ? 'image/png' : 'image/gif';
            
            // 拡張子も .png に統一
            const ext = type === 'apng' ? 'png' : 'gif';
            const filename = `tegaki_anime_${Date.now()}.${ext}`;
            
            const file = new File([blob], filename, {
                type: mimeType,
                lastModified: Date.now()
            });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            this.targetInput.dispatchEvent(changeEvent);
            
            try {
                await this.waitFor(() => {
                    return document.querySelector(MEBUKI_SELECTORS.previewImg) !== null;
                }, 3000);
            } catch (error) {
                // プレビュータイムアウトは警告のみ
            }
        }

        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか?')) {
                this.cleanup();
            }
        }
        
        cleanup() {
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
            }
        }

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

    // ===== グローバル登録（一度だけ実行） =====
    if (!window.tegakiAnimeStart) {
        window.tegakiAnimeStart = function() {
            if (!window.tegakiAnimeInstance) {
                window.tegakiAnimeInstance = new TegakiLoaderAnime();
            }
            window.tegakiAnimeInstance.start();
        };
        
        // 初回読み込み時は自動起動
        window.tegakiAnimeStart();
    } else {
        // 既にローダーが読み込まれている場合も起動
        window.tegakiAnimeStart();
    }

})();