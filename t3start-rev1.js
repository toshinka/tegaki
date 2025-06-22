javascript:((d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v2.2 (Iframe version / Revised)
     * このファイルは t3start-rev2.js です。
     * 起動・終了時の転写が失敗する問題を修正し、安定性を向上させました。
     */

    // =========================================================================
    // 外部ツールのURL（変更なし）
    // =========================================================================
    const toolUrl = 'https://toshinka.github.io/tegaki/v1-5/ToshinkaTegakiTool-v1-5rev3.html';

    // =========================================================================
    // 起動後のツールに注入（後付け）する改修コード
    // 【修正】終了処理を親ウィンドウの専用ボタンに任せるため、メッセージ受信の仕組みを修正。
    // =========================================================================
    const patchScript = `
        (() => {
            function patchWhenReady() {
                if (window.toshinkaTegakiTool && window.toshinkaTegakiTool.layerManager) {
                    const tool = window.toshinkaTegakiTool;

                    // --- 機能: 親ウィンドウから画像を受け取って背景に描画 ---
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

                    // --- 機能: 完成した画像を親ウィンドウに転送 ---
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
                    
                    // --- 待受開始: 親ウィンドウからのメッセージを監視 ---
                    window.addEventListener('message', (event) => {
                        if (!event.data || !event.data.type) return;
                        switch (event.data.type) {
                            case 'init': // 起動時に親から画像データを受け取る
                                if (event.data.imageDataUrl) {
                                    tool.layerManager.loadBackgroundImage(event.data.imageDataUrl);
                                }
                                break;
                            case 'request-transfer': // 親の専用ボタンから転送リクエストを受け取る
                                tool.canvasManager.transferToParent();
                                break;
                        }
                    });

                } else {
                    setTimeout(patchWhenReady, 100);
                }
            }
            patchWhenReady();
        })();
    `;

    // =========================================================================
    // メインロジック
    // =========================================================================

    const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
    if (existingIframe) {
        existingIframe.remove();
        const existingBtn = d.getElementById('toshinka-tegaki-tool-transfer-btn');
        if (existingBtn) existingBtn.remove();
        return;
    }

    const oebtnj = d.getElementById('oebtnj');
    if (!oebtnj) {
        alert('手書きJSボタンが見つかりませんでした。');
        return;
    }
    oebtnj.click();

    setTimeout(() => {
        let oejs = d.getElementById('oejs');
        if (!oejs) {
            oejs = d.createElement('canvas');
            oejs.id = 'oejs';
            // (以下、oejsが見つからない場合のフォールバック処理は変更なし)
            const oest1 = d.querySelector('#oest1');
            if (oest1) oest1.appendChild(oejs);
            else { alert('手書きJSの描画領域が見つかりませんでした。'); return; }
        }

        const initialImageDataUrl = (oejs.width > 0 && oejs.height > 0) ? oejs.toDataURL('image/png') : null;

        const iframe = d.createElement('iframe');
        iframe.id = 'toshinka-tegaki-tool-iframe';
        iframe.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: 2000000025; background-color: rgba(0, 0, 0, 0.3);`;
        d.body.appendChild(iframe);

        // 【新規】転写＆閉じる専用ボタンを作成
        const transferBtn = d.createElement('button');
        transferBtn.id = 'toshinka-tegaki-tool-transfer-btn';
        transferBtn.textContent = '手書きJSに転写して閉じる';
        transferBtn.style.cssText = `position: fixed; top: 5px; right: 5px; z-index: 2147483647; padding: 6px 12px; background-color: #ff4444; color: white; border: 1px solid #cc3333; border-radius: 5px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);`;
        transferBtn.onclick = function() {
            if (iframe.contentWindow) {
                // iframe内のツールに画像転送をリクエスト
                iframe.contentWindow.postMessage({ type: 'request-transfer' }, '*');
            }
        };
        d.body.appendChild(transferBtn);

        iframe.onload = () => {
            const patcher = iframe.contentWindow.document.createElement('script');
            patcher.textContent = patchScript;
            iframe.contentWindow.document.body.appendChild(patcher);

            // 【修正】待機時間を延長して、ツールの準備が整うのを待つ
            setTimeout(() => {
                if (initialImageDataUrl) {
                    iframe.contentWindow.postMessage({ type: 'init', imageDataUrl: initialImageDataUrl }, '*');
                }
            }, 500); // 100msから500msに延長
        };

        iframe.src = toolUrl;

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

                    // 【修正】iframeと専用ボタンの両方を削除
                    iframe.remove();
                    transferBtn.remove();
                    window.removeEventListener('message', messageHandler);
                };
                img.src = event.data.imageDataUrl;
            }
        };

        window.addEventListener('message', messageHandler);
    }, 300);

})(document);