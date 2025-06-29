javascript:((async (d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.0 (srcdoc + fetch version)
     * このファイルは t3start-rev3.js です。
     * 動作安定性を確保するため、最初のバージョンのsrcdoc方式に回帰しつつ、
     * fetchによるHTMLの外部読み込みを実現します。
     */

    try {
        // =========================================================================
        // 外部HTMLをfetchで読み込み、文字列として取得します
        // =========================================================================
        const toolUrl = 'https://toshinka.github.io/tegaki/v1-5/ToshinkaTegakiTool-v1-5rev3.html';
        const response = await fetch(toolUrl);
        if (!response.ok) {
            throw new Error(`HTMLの読み込みに失敗しました: ${response.status} ${response.statusText}`);
        }
        const toolHtmlTemplate = await response.text();

        // =========================================================================
        // patchScriptを最初の安定していたバージョンに戻します
        // =========================================================================
        const patchScript = `
            (() => {
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
                        setTimeout(patchWhenReady, 100);
                    }
                }
                patchWhenReady();
            })();
        `;

        // =========================================================================
        // メインロジック (最初の安定バージョンとほぼ同じ構造)
        // =========================================================================
        const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
        if (existingIframe) {
            existingIframe.remove();
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
            iframe.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: 2147483647; background-color: rgba(0, 0, 0, 0.3);`;
            d.body.appendChild(iframe);

            iframe.onload = () => {
                const patcher = iframe.contentWindow.document.createElement('script');
                patcher.textContent = patchScript;
                iframe.contentWindow.document.body.appendChild(patcher);

                setTimeout(() => {
                    if (initialImageDataUrl) {
                        iframe.contentWindow.postMessage({ type: 'init', imageDataUrl: initialImageDataUrl }, '*');
                    }
                }, 100);
            };
            
            // ★★★ 解決策の核心部: 読み込んだHTMLをsrcdocに設定 ★★★
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

    } catch (error) {
        console.error('ToshinkaTegakiTool Loader Error:', error);
        alert('ツールの起動に失敗しました。\n' + error.message);
    }
})(document));