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
        tegaki: 'https://cdn.jsdelivr.net/gh/toshinka/tegaki/docs/tegaki_anime.js',
        upng: 'https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.min.js',
        pako: 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', 
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
    
    function loadText(url) {
        return fetch(url).then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch script text: ${response.status} ${response.statusText}`);
            }
            return response.text();
        });
    }

    function createButton(text, onClick, isPrimary = false) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        
        const primaryBg = '#4ade80', primaryHover = '#22c55e', primaryBorder = '#22c55e';
        const secondaryBg = '#f87171', secondaryHover = '#ef4444', secondaryBorder = '#ef4444';

        btn.style.cssText = `
            padding: 8px 16px; background: ${isPrimary ? primaryBg : secondaryBg}; color: white;
            border: 2px solid ${isPrimary ? primaryBorder : secondaryBorder}; border-radius: 4px; cursor: pointer;
            font-size: 14px; font-weight: bold; transition: all 0.2s;
            display: inline-flex; align-items: center; gap: 4px;
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
            return location.host.includes('mebuki.moe') ? 'mebuki' : null;
        }
        
        async findTargetElements() {
            if (this.boardType === 'mebuki') {
                document.querySelector(MEBUKI_SELECTORS.postButton)?.click();
                await this.wait(300);
                
                await this.waitFor(() => (this.targetInput = document.querySelector(MEBUKI_SELECTORS.fileInput)) !== null, MEBUKI_TIMEOUT);
                
                if (!this.targetInput) throw new Error('ファイル入力要素が見つかりません');
            }
        }

        async start() {
            console.log('[Tegaki Anime Loader] Starting...');
            
            document.getElementById('tegaki-anime-container')?.remove();
            window.tegakiAnimeCore?.destroy();
            window.tegakiAnimeCore = null;

            try {
                this.boardType = this.detectBoard();
                if (!this.boardType) throw new Error('対応していない掲示板です');
                await this.findTargetElements();
            } catch (error) {
                alert(`Tegaki起動に失敗しました: ${error.message}`);
                return;
            }

            this.loadingEl = document.body.appendChild(document.createElement('div'));
            this.loadingEl.textContent = 'お絵かきツールを準備中...';
            this.loadingEl.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background: #800000; color:white; padding:10px; border-radius:5px; z-index:10001;';

            try {
                const [gifWorkerText] = await Promise.all([
                    loadText(SCRIPT_URLS.gifWorker),
                    loadScript(SCRIPT_URLS.upng),
                    loadScript(SCRIPT_URLS.pako), 
                    loadScript(SCRIPT_URLS.gif),
                    loadScript(SCRIPT_URLS.tegaki)
                ]);
                
                if (window.GIF && gifWorkerText) {
                    const blob = new Blob([gifWorkerText], { type: 'application/javascript' });
                    const blobURL = URL.createObjectURL(blob);
                    if (!window.GIF.options) window.GIF.options = {};
                    window.GIF.options.workerScript = blobURL;
                    console.log('GIF worker script set as a global default.');
                } else {
                     console.warn('GIFライブラリまたはWorkerテキストが見つかりません。');
                }

                if (window.pako) {
                     window.Zlib = window.pako; 
                     console.log('pako linked to Zlib for UPNG compatibility.');
                }
                
                this.createUI();
                
                const tegakiArea = document.getElementById('tegaki-canvas-area-anime');
                if (!window.TegakiAnimeCore) throw new Error('TegakiAnimeCoreクラスが見つかりません。');
                this.core = new window.TegakiAnimeCore(tegakiArea);
                window.tegakiAnimeCore = this.core;
                
                this.loadingEl.remove();
            } catch (error) {
                console.error('Tegaki loader failed:', error);
                this.loadingEl.textContent = `読み込み失敗: ${error.message}`;
                setTimeout(() => this.loadingEl.remove(), 5000);
            }
        }

        createUI() {
            this.container = document.body.appendChild(document.createElement('div'));
            this.container.id = 'tegaki-anime-container';
            this.container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #f0e0d6; z-index: 10000;
                display: flex; flex-direction: column;
            `;

            const topBar = this.container.appendChild(document.createElement('div'));
            topBar.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 16px; background: #e9c2ba; border-bottom: 2px solid #cf9c97; gap: 8px;
            `;
            
            const title = topBar.appendChild(document.createElement('div'));
            title.textContent = 'アニメお絵かきツール';
            title.style.cssText = 'color: #800000; font-size: 14px; font-weight: bold;';
            
            const buttonGroup = topBar.appendChild(document.createElement('div'));
            buttonGroup.style.cssText = 'display: flex; gap: 8px;';

            buttonGroup.appendChild(createButton('APNG投稿', () => this.exportAndAttach('apng'), true)).title = 'APNGを生成して掲示板に添付';
            buttonGroup.appendChild(createButton('GIF投稿', () => this.exportAndAttach('gif'), true)).title = 'GIFを生成して掲示板に添付';
            buttonGroup.appendChild(createButton('✕ 閉じる', () => this.cancel())).title = '破棄して閉じる';
            
            const canvasArea = this.container.appendChild(document.createElement('div'));
            canvasArea.id = 'tegaki-canvas-area-anime';
            canvasArea.style.cssText = 'flex: 1; position: relative; overflow: hidden; background: #ffffee;';
            
            this.originalBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }

        async exportAndAttach(type) {
            if (!this.core) return alert('お絵かきツールが初期化されていません');
            
            this.loadingEl.textContent = `${type.toUpperCase()}を生成中...`;
            document.body.appendChild(this.loadingEl);

            try {
                const progressCallback = p => this.loadingEl.textContent = `${type.toUpperCase()}を生成中... (${Math.floor(p * 100)}%)`;
                const blob = type === 'apng' ? await this.core.exportAsApng() : await this.core.exportAsGif(progressCallback);
                
                this.loadingEl.remove();
                if (!blob) return alert(`${type.toUpperCase()}の生成に失敗しました。`);
                
                console.log(`✓ ${type.toUpperCase()} Blob created:`, blob.size, 'bytes');
                await this.injectToBoard(blob, type);
                
                alert(`画像を添付しました！投稿ボタンを押してください。\n(ファイル形式: ${type.toUpperCase()})`);
                this.cleanup();
            } catch (error) {
                console.error('エクスポート失敗:', error);
                this.loadingEl.remove();
                alert(`画像の出力に失敗しました\n${error.message}`);
            }
        }
        
        async injectToBoard(blob, type) {
            if (!this.targetInput) throw new Error('入力要素が見つかりません');
            
            const mimeType = type === 'apng' ? 'image/apng' : 'image/gif';
            const extension = type === 'apng' ? 'png' : 'gif';
            const filename = `tegaki_anime_${Date.now()}.${extension}`;
            
            const file = new File([blob], filename, { type: mimeType, lastModified: Date.now() });
            
            const dt = new DataTransfer();
            dt.items.add(file);
            this.targetInput.files = dt.files;
            
            this.targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            try {
                await this.waitFor(() => document.querySelector(MEBUKI_SELECTORS.previewImg) !== null, 3000);
            } catch (error) {
                console.warn('プレビュー確認タイムアウト');
            }
        }

        cancel() {
            if (confirm('描いた内容は破棄されます。よろしいですか?')) this.cleanup();
        }
        
        cleanup() {
            this.core?.destroy();
            this.container?.remove();
            if (this.originalBodyOverflow !== null) document.body.style.overflow = this.originalBodyOverflow;
        }

        wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        
        waitFor(condition, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const check = () => {
                    if (condition()) resolve();
                    else if (Date.now() - startTime > timeout) reject(new Error('タイムアウト'));
                    else setTimeout(check, 100);
                };
                check();
            });
        }
    }

    window.tegakiAnimeStart = function() {
        if (!window.tegakiAnimeInstance || !document.getElementById('tegaki-anime-container')) {
            window.tegakiAnimeInstance = new TegakiLoaderAnime();
        }
        window.tegakiAnimeInstance.start();
    };
    
})();