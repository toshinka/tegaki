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

    // ===== 設定 =====
    const SCRIPT_URLS = {
        // ↓↓↓↓↓ このURLはご自身の環境に合わせて書き換えてください ↓↓↓↓↓
        tegaki: 'https://cdn.jsdelivr.net/gh/toshinka/tegaki/docs/tegaki_anime.js', // 例: GitHub PagesのURL
        upng: 'https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.min.js',
        gif: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js',
        gifWorker: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
    };
    
    // ===== ユーティリティ =====
    // スクリプトを動的に読み込む
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    }

    // ボタンを作成するヘルパー関数
    function createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            background: #800000;
            color: white;
            border: 2px solid #aa5a56;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
        btn.onmouseover = () => btn.style.background = '#aa5a56';
        btn.onmouseout = () => btn.style.background = '#800000';
        btn.onclick = onClick;
        return btn;
    }

    // ===== メイン処理 =====
    async function main() {
        // 既存のUIがあれば削除して作り直す
        if (window.tegakiInstance) {
            window.tegakiInstance.destroy();
            window.tegakiInstance = null;
        }
        const existingContainer = document.getElementById('tegaki-anime-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        console.log('Tegaki loader started...');

        // ローディング表示
        const loadingEl = document.createElement('div');
        loadingEl.textContent = 'お絵かきツールを準備中...';
        loadingEl.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background: #800000; color:white; padding:10px; border-radius:5px; z-index:10001;';
        document.body.appendChild(loadingEl);

        try {
            // ライブラリを読み込み
            await Promise.all([
                loadScript(SCRIPT_URLS.upng),
                loadScript(SCRIPT_URLS.gif),
                loadScript(SCRIPT_URLS.tegaki)
            ]);

            // gif.jsのワーカーパスを設定
            if (window.GIF && window.GIF.prototype) {
                // optionsが存在しない場合は初期化する
                if (typeof window.GIF.prototype.options === 'undefined') {
                    window.GIF.prototype.options = {};
                }
                window.GIF.prototype.options.workerScript = SCRIPT_URLS.gifWorker;
                console.log('GIF worker script path set.');
            } else {
                 throw new Error('GIFライブラリ (window.GIF) が見つかりません。');
            }

            // ローダーUIを作成
            const container = document.createElement('div');
            container.id = 'tegaki-anime-container';
            container.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); z-index: 10000;
                display: flex; justify-content: center; align-items: center;
            `;

            const panel = document.createElement('div');
            panel.style.cssText = `
                width: 90%; max-width: 700px; height: 90%; max-height: 700px;
                background: #f0e0d6; border: 3px solid #800000; border-radius: 8px;
                display: flex; flex-direction: column; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 8px 15px; background: #e9c2ba; color: #800000; font-weight: bold;
                border-bottom: 2px solid #cf9c97; display: flex; justify-content: space-between; align-items: center;
            `;
            header.innerHTML = '<span>アニメお絵かき</span>';
            const closeBtn = createButton('✖', () => container.remove());
            closeBtn.style.padding = '5px 10px';
            header.appendChild(closeBtn);

            const tegakiArea = document.createElement('div');
            tegakiArea.style.cssText = 'flex: 1; position: relative;';

            const footer = document.createElement('div');
            footer.style.cssText = `
                padding: 12px; background: #e9c2ba; border-top: 2px solid #cf9c97;
                display: flex; justify-content: center; gap: 20px;
            `;
            
            const postApngBtn = createButton('APNG投稿', async () => {
                loadingEl.textContent = 'APNGを生成中...';
                loadingEl.style.display = 'block';
                const blob = await window.tegakiInstance.exportAsApng();
                loadingEl.style.display = 'none';
                if(blob) {
                    console.log('APNG Blob:', blob);
                    alert(`APNGを作成しました (サイズ: ${Math.round(blob.size / 1024)} KB)`);
                    // TODO: ここにBlobをフォームに添付するなどの投稿処理を実装
                }
            });

            const postGifBtn = createButton('GIF投稿', async () => {
                loadingEl.textContent = 'GIFを生成中...';
                loadingEl.style.display = 'block';
                const blob = await window.tegakiInstance.exportAsGif();
                loadingEl.style.display = 'none';
                if(blob) {
                    console.log('GIF Blob:', blob);
                    alert(`GIFを作成しました (サイズ: ${Math.round(blob.size / 1024)} KB)`);
                    // TODO: ここにBlobをフォームに添付するなどの投稿処理を実装
                }
            });

            footer.appendChild(postApngBtn);
            footer.appendChild(postGifBtn);
            
            panel.appendChild(header);
            panel.appendChild(tegakiArea);
            panel.appendChild(footer);
            container.appendChild(panel);
            document.body.appendChild(container);
            
            // TegakiCoreをインスタンス化
            window.tegakiInstance = new TegakiAnimeCore(tegakiArea);
            
            loadingEl.remove();

        } catch (error) {
            console.error('Tegaki loader failed:', error);
            loadingEl.textContent = 'お絵かきツールの読み込みに失敗しました。';
            setTimeout(() => loadingEl.remove(), 3000);
        }
    }

    // 起動関数をグローバルに公開
    window.tegakiAnimeStart = main;
    
    // 初回実行
    main();

})();