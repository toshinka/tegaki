javascript:((d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v2.0 (Monkey-patching version)
     * This script loads the original tool and dynamically injects modifications
     * for integration with the oekaki board.
     */

    // =========================================================================
    // HTMLテンプレート（ToshinkaTegakiTool-v1-5rev2b.htmlの元々の内容）
    // 外部JSファイルを直接参照します
    // =========================================================================
    const toolHtmlTemplate = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>T3v1-5rev2Smooth)</title>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffee; overflow: hidden; }
        :root { --main-bg-color: rgb(240, 208, 195); --dark-brown: #800000; --light-brown-border: rgb(220, 188, 175); --button-active-bg: white; --button-inactive-bg: var(--main-bg-color); }
        .main-container { width: 100vw; height: 100vh; display: flex; position: relative; }
        .left-toolbar { position: absolute; top: 30px; left: 0; width: 28px; background-color: var(--main-bg-color); border-right: 1px solid var(--light-brown-border); display: flex; flex-direction: column; padding: 2px 0; gap: 5px; box-sizing: border-box; align-items: center; z-index: 100; }
        .top-toolbar { position: absolute; top: 0; left: 0; right: 0; height: 30px; background-color: var(--main-bg-color); border-bottom: 1px solid var(--light-brown-border); display: flex; align-items: center; padding: 0 3px; gap: 2px; box-sizing: border-box; justify-content: space-between; z-index: 100; }
        .canvas-area { position: absolute; top: 30px; left: 28px; right: 0; bottom: 0; background-color: #ffffee; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .canvas-container { position: relative; transform-origin: center; width: 344px; height: 135px; background-color: transparent; border: none; padding: 0; transition: transform 0.03s ease; transform-style: preserve-3d; }
        .main-canvas { display: block; background-color: transparent; cursor: crosshair; touch-action: none; position: absolute; top: 0; left: 0; pointer-events: none; }
        .top-left-controls { display: flex; flex-direction: row; gap: 2px; align-items: center; }
        .color-palette { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; width: 100%; }
        .color-btn { width: 20px; height: 20px; border: 1px solid var(--dark-brown); cursor: pointer; border-radius: 2px; }
        .color-btn.active { border-color: var(--button-active-bg); border-width: 2px; }
        .color-mode-display { width: 24px; height: 24px; position: relative; cursor: pointer; margin-top: 5px; background-color: var(--main-bg-color); border: 1px solid var(--light-brown-border); box-sizing: border-box; border-radius: 2px; overflow: hidden; }
        .color-square { width: 16px; height: 16px; border: 1px solid var(--dark-brown); position: absolute; box-sizing: border-box; }
        .main-color-square { top: 0; left: 0; z-index: 2; }
        .sub-color-square { bottom: 0; right: 0; z-index: 1; }
        .tools { display: flex; flex-direction: column; gap: 2px; width: 100%; align-items: center; }
        .tool-btn { width: 24px; height: 24px; border: 1px solid var(--light-brown-border); background: var(--button-inactive-bg); cursor: pointer; font-size: 16px; margin: 0; display: flex; align-items: center; justify-content: center; border-radius: 3px; line-height: 1; color: var(--dark-brown); }
        .tool-btn.active { background-color: var(--button-active-bg); color: var(--dark-brown); border-color: var(--dark-brown); }
        .sizes { display: flex; flex-direction: column; gap: 4px; width: 100%; align-items: center; }
        .size-btn { width: 24px; height: 34px; border: 1px solid var(--light-brown-border); background: var(--button-inactive-bg); cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 2px 0; border-radius: 3px; }
        .size-btn.active { border-color: var(--dark-brown); background-color: var(--button-active-bg); }
        .size-indicator { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--dark-brown); background-color: transparent; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .size-dot { border-radius: 50%; background-color: var(--dark-brown); }
        .size-number { font-size: 10px; color: var(--dark-brown); text-align: center; display: block; line-height: 1; margin-top: 2px; }
        .top-btn { height: 24px; padding: 0 6px; border: 1px solid var(--light-brown-border); background: var(--button-inactive-bg); cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--dark-brown); }
        .top-btn:hover { background-color: var(--button-active-bg); border-color: var(--dark-brown); }
        .close-btn { background-color: #ff4444; color: white; border: none; }
        .close-btn:hover { background-color: #cc3333; }
        .separator { width: 80%; height: 1px; background-color: var(--light-brown-border); }
        .right-sidebar { position: absolute; top: 30px; right: 0; width: 120px; height: calc(100vh - 30px); background-color: rgba(0, 0, 0, 0); border-left: 0px solid var(--light-brown-border); display: flex; flex-direction: column; padding: 5px; box-sizing: border-box; z-index: 100; }
        .layer-list { flex-grow: 1; overflow-y: auto; border: 0px solid var(--light-brown-border); background-color: rgba(0, 0, 0, 0); border-radius: 3px; margin-bottom: 5px; }
        .layer-item { display: flex; align-items: center; padding: 5px; border-bottom: 1px solid var(--light-brown-border); cursor: pointer; background-color: rgba(255, 255, 255, 0.8); }
        .layer-item:last-child { border-bottom: none; }
        .layer-item.active { background-color: var(--button-active-bg); border: 1px solid var(--dark-brown); position: relative; z-index: 1; }
        .layer-name { font-size: 12px; color: var(--dark-brown); }
        #layer-controls { display: flex; gap: 2px; justify-content: center; padding-top: 5px; padding-bottom: 5px; }
        #layer-controls .tool-btn { width: 28px; height: 28px; font-size: 18px; }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="top-toolbar">
            <div class="top-left-controls">
                <button id="saveMergedButton">📜</button>
                <button class="tool-btn" id="undo-btn" title="元に戻す (Ctrl+Z)">↶</button>
                <button class="tool-btn" id="redo-btn" title="やり直し (Ctrl+Y)">↷</button>
                <button class="tool-btn" id="clear-btn" title="アクティブレイヤーを消去 (Delete)">&#128465;</button>
            </div>
            <div class="canvas-ops-group" style="display: flex; gap: 2px;">
                <button class="top-btn" id="flip-h-btn" title="左右反転 (H)">⇄</button>
                <button class="top-btn" id="flip-v-btn" title="上下反転 (Shift+H)">⇅</button>
                <button class="top-btn" id="zoom-out-btn" title="縮小 (↓ / Wheel Down)">－</button>
                <button class="top-btn" id="zoom-in-btn" title="拡大 (↑ / Wheel Up)">＋</button>
                <button class="top-btn" id="rotate-btn" title="回転 (Shift+Wheel)">↻</button>
                <button class="top-btn" id="rotate-ccw-btn" title="反時計回りに回転 (Shift+Wheel)">↺</button>
                <button class="top-btn" id="reset-view-btn" title="表示リセット (1)">&#9750;</button>
            </div>
            <button class="top-btn close-btn" id="close-btn">×閉じる</button>
        </div>
        <div class="left-toolbar">
            <div class="color-palette">
                <div class="color-btn active" data-color="#800000" style="background-color: #800000;" title="暗赤"></div>
                <div class="color-btn" data-color="#aa5a56" style="background-color: #aa5a56;" title="赤茶"></div>
                <div class="color-btn" data-color="#cf9c97" style="background-color: #cf9c97;" title="中間色"></div>
                <div class="color-btn" data-color="#e9c2ba" style="background-color: #e9c2ba;" title="薄茶"></div>
                <div class="color-btn" data-color="#f0e0d6" style="background-color: #f0e0d6;" title="肌色"></div>
            </div>
            <div class="color-mode-display" title="メイン/サブカラー切り替え (X)">
                <div id="main-color-display" class="color-square main-color-square"></div>
                <div id="sub-color-display" class="color-square sub-color-square"></div>
            </div>
            <div class="separator"></div>
            <div class="tools">
                <button class="tool-btn active" id="pen-tool" title="ペン (P)">&#9998;</button>
                <button class="tool-btn" id="eraser-tool" title="消しゴム (E)">&#9003;</button>
                <button class="tool-btn" id="bucket-tool" title="塗りつぶし (G)">&#x1F5F3;</button>
                <button class="tool-btn" id="move-tool" title="レイヤー移動 (V)">&#10021;</button>
            </div>
            <div class="separator"></div>
            <div class="sizes">
                <button class="size-btn active" data-size="1"><div class="size-indicator"><div class="size-dot" style="width: 2px; height: 2px;"></div></div><span class="size-number">1</span></button>
                <button class="size-btn" data-size="3"><div class="size-indicator"><div class="size-dot" style="width: 4px; height: 4px;"></div></div><span class="size-number">3</span></button>
                <button class="size-btn" data-size="5"><div class="size-indicator"><div class="size-dot" style="width: 6px; height: 6px;"></div></div><span class="size-number">5</span></button>
                <button class="size-btn" data-size="10"><div class="size-indicator"><div class="size-dot" style="width: 10px; height: 10px;"></div></div><span class="size-number">10</span></button>
                <button class="size-btn" data-size="30"><div class="size-indicator"><div class="size-dot" style="width: 16px; height: 16px;"></div></div><span class="size-number">30</span></button>
            </div>
        </div>
        <div class="canvas-area" id="canvas-area">
            <div class="canvas-container" id="canvas-container">
                <canvas id="drawingCanvas" class="main-canvas" width="344" height="135"></canvas>
            </div>
        </div>
        <div class="right-sidebar">
            <div id="layer-controls">
                <button class="tool-btn" id="add-layer-btn" title="新規レイヤーを追加">+</button>
                <button class="tool-btn" id="duplicate-layer-btn" title="アクティブレイヤーを複製">📋</button>
                <button class="tool-btn" id="merge-layer-btn" title="アクティブレイヤーを結合">⬇️</button>
                <button class="tool-btn" id="delete-layer-btn" title="アクティブレイヤーを削除">🗑️</button>
            </div>
            <div class="layer-list" id="layer-list"></div>
        </div>
    </div>
    <script src="https://toshinka.github.io/tegaki/v1-5/core-v1-5rev3.js"></script> 
    <script src="https://toshinka.github.io/tegaki/v1-5/ui-v1-5rev3.js"></script>
</body>
</html>`;

    // =========================================================================
    // 起動後のツールに注入（後付け）する改修コード
    // =========================================================================
    const patchScript = `
        (() => {
            const BROWSER_API_PATCH_VERSION = '2.0';

            function patchWhenReady() {
                if (window.toshinkaTegakiTool && window.toshinkaTegakiTool.layerManager) {
                    const tool = window.toshinkaTegakiTool;

                    // --- 1. 機能追加: 親ウィンドウから画像を受け取って背景に描画 ---
                    tool.layerManager.loadBackgroundImage = function(imageDataUrl) {
                        const bgLayer = this.layers[0];
                        if (!bgLayer) return;

                        const img = new Image();
                        img.onload = () => {
                            bgLayer.ctx.clearRect(0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
                            bgLayer.ctx.drawImage(img, 0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
                            this.app.canvasManager.saveState();
                        };
                        img.src = imageDataUrl;
                    };

                    // --- 2. 機能追加: 完成した画像を親ウィンドウに転送 ---
                    tool.canvasManager.transferToParent = function() {
                        const mergedCanvas = document.createElement('canvas');
                        mergedCanvas.width = this.canvas.width;
                        mergedCanvas.height = this.canvas.height;
                        const mergedCtx = mergedCanvas.getContext('2d');
                        
                        this.app.layerManager.layers.forEach(layer => {
                            mergedCtx.drawImage(layer.canvas, 0, 0);
                        });
                        
                        const dataURL = mergedCanvas.toDataURL('image/png');
                        window.parent.postMessage({ type: 'toshinka-tegaki-tool-export', imageDataUrl: dataURL }, '*');
                    };

                    // --- 3. 挙動変更: 「×閉じる」ボタンの動作を上書き ---
                    if (tool.topBarManager) {
                        tool.topBarManager.closeTool = function() {
                            if (confirm('描画内容を手書きJSに転写して閉じますか？')) {
                                this.app.canvasManager.transferToParent();
                            }
                        };
                    }

                    // --- 4. 待受開始: 親ウィンドウからのメッセージを監視 ---
                    window.addEventListener('message', (event) => {
                        if (event.data && event.data.type === 'init' && event.data.imageDataUrl) {
                            tool.layerManager.loadBackgroundImage(event.data.imageDataUrl);
                        }
                    });

                } else {
                    // ツールがまだ初期化されていない場合は、少し待ってから再試行
                    setTimeout(patchWhenReady, 100);
                }
            }
            patchWhenReady();
        })();
    `;

    // =========================================================================
    // メインロジック
    // =========================================================================

    // 既存のツールが起動していたら閉じる
    const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
    if (existingIframe) {
        existingIframe.remove();
        return;
    }

    // 手書きJSボタンを探してクリック
    const oebtnj = d.getElementById('oebtnj');
    if (!oebtnj) {
        alert('手書きJSボタンが見つかりませんでした。');
        return;
    }
    oebtnj.click();

    // 手書きJSの初期化を少し待つ
    setTimeout(() => {
        let oejs = d.getElementById('oejs');
        if (!oejs) {
            oejs = d.createElement('canvas');
            oejs.id = 'oejs';
            oejs.width = 344;
            oejs.height = 135;
            oejs.style.position = 'absolute';
            const oest1 = d.querySelector('#oest1');
            if (oest1) {
                oest1.appendChild(oejs);
            } else {
                alert('手書きJSの描画領域が見つかりませんでした。');
                return;
            }
        }

        const initialImageDataUrl = (oejs.width > 0 && oejs.height > 0) ? oejs.toDataURL('image/png') : null;

        const iframe = d.createElement('iframe');
        iframe.id = 'toshinka-tegaki-tool-iframe';
        iframe.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            border: none;
            z-index: 2000000025;
            background-color: rgba(0, 0, 0, 0.3);
        `;
        d.body.appendChild(iframe);

        iframe.onload = () => {
            const patcher = iframe.contentWindow.document.createElement('script');
            patcher.textContent = patchScript;
            iframe.contentWindow.document.body.appendChild(patcher);

            setTimeout(() => {
                if (initialImageDataUrl) {
                    iframe.contentWindow.postMessage({
                        type: 'init',
                        imageDataUrl: initialImageDataUrl
                    }, '*');
                }
            }, 100);
        };
        
        iframe.srcdoc = toolHtmlTemplate;

        const messageHandler = (event) => {
            if (event.source !== iframe.contentWindow) return;
            if (event.data && event.data.type === 'toshinka-tegaki-tool-export') {
                const img = new Image();
                img.onload = () => {
                    const maxSize = 400;
                    let scale = 1;
                    
                    if (img.width > maxSize || img.height > maxSize) {
                        scale = Math.min(maxSize / img.width, maxSize / img.height);
                    }
                    const w = img.width * scale;
                    const h = img.height * scale;

                    oejs.width = w;
                    oejs.height = h;
                    const tc = oejs.getContext('2d');
                    tc.clearRect(0, 0, w, h);
                    tc.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
                    alert('転写完了！');
                    
                    iframe.remove();
                    window.removeEventListener('message', messageHandler);
                };
                img.src = event.data.imageDataUrl;
            }
        };

        window.addEventListener('message', messageHandler);

    }, 300);

})(document);