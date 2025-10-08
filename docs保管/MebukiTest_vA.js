// MebukiTest_vA.js
// めぶきちゃんねる用ブックマークレット起動スクリプト
// 既存キャンバスを検出し、PixiJS/tegakiツールを展開
// ▷ 右上に閉じる✗ボタンも実装

globalThis.mebukiStart = async function() {
    if (globalThis._mebukiInjected) return; // 二重起動防止
    globalThis._mebukiInjected = true;

    try {
        // 親ページのキャンバス検出
        const canvas = document.getElementById('oejs') || document.querySelector('canvas');
        const postBtn = document.getElementById('oebtnj') || document.getElementById('oebtnj_f');

        if (!canvas || !postBtn) {
            alert('キャンバスまたは投稿ボタンが見つかりません。');
            return;
        }

        // 元のキャンバスを隠す
        canvas.style.visibility = 'hidden';

        // オーバーレイ用div作成
        const overlay = document.createElement('div');
        overlay.id = 'mebuki-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.3);
            z-index: 2147483647;
            display: flex; justify-content: center; align-items: center;
        `;
        document.body.appendChild(overlay);

        // 閉じるボタン
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✗';
        closeBtn.style.cssText = `
            position: absolute; top: 10px; right: 10px;
            font-size: 24px; background: rgba(255,255,255,0.8);
            border: none; border-radius: 4px; cursor: pointer;
            z-index: 2147483648;
        `;
        overlay.appendChild(closeBtn);

        closeBtn.onclick = () => {
            overlay.remove();
            canvas.style.visibility = 'visible';
            globalThis._mebukiInjected = false;
        };

        // PixiJS/tegakiツール用canvas
        const toolCanvas = document.createElement('canvas');
        toolCanvas.id = 'mebuki-canvas';
        toolCanvas.width = canvas.width;
        toolCanvas.height = canvas.height;
        toolCanvas.style.cssText = `background:white; z-index:2147483647;`;
        overlay.appendChild(toolCanvas);

        // PixiJSを使って描画コンテナを生成（PixiJSが既にロード済みなら利用）
        if (!window.PIXI) {
            const script = document.createElement('script');
            script.src = 'https://pixijs.download/release/pixi.min.js';
            script.onload = initPixi;
            document.body.appendChild(script);
        } else {
            initPixi();
        }

        function initPixi() {
            const app = new PIXI.Application({
                view: toolCanvas,
                width: toolCanvas.width,
                height: toolCanvas.height,
                transparent: true
            });
            globalThis._mebukiApp = app;

            // 簡易描画：マウスで線を描く
            const graphics = new PIXI.Graphics();
            app.stage.addChild(graphics);

            let drawing = false;
            toolCanvas.addEventListener('mousedown', () => drawing = true);
            toolCanvas.addEventListener('mouseup', () => drawing = false);
            toolCanvas.addEventListener('mouseleave', () => drawing = false);
            toolCanvas.addEventListener('mousemove', e => {
                if (!drawing) return;
                const rect = toolCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                graphics.lineStyle(2, 0x000000, 1);
                graphics.moveTo(x, y);
                graphics.lineTo(x, y);
                graphics.closePath();
                graphics.endFill();
            });

            // 終了時に元キャンバスに転送
            closeBtn.onclick = () => {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(toolCanvas, 0, 0);
                overlay.remove();
                canvas.style.visibility = 'visible';
                globalThis._mebukiInjected = false;
            };
        }

    } catch(e) {
        console.error('mebukiStart error:', e);
        alert('ツールの起動に失敗しました。Consoleを確認してください。');
    }
};
