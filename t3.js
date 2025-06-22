javascript:((async (d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.2 (t3start-rev5.js)
     * t3start-rev3.jsをベースに、スクロールバー対応機能の追加に必要な最小限の変更を加えました。
     * コードの表現はt3start-rev3.jsと同一性を保っています。
     */

    try {
        // =========================================================================
        // 外部HTMLをfetchで読み込み、文字列として取得します (変更なし)
        // =========================================================================
        const toolUrl = 'https://toshinka.github.io/tegaki/v1-5/ToshinkaTegakiTool-v1-5rev3.html';
        const response = await fetch(toolUrl);
        if (!response.ok) {
            throw new Error(`HTMLの読み込みに失敗しました: ${response.status} ${response.statusText}`);
        }
        const toolHtmlTemplate = await response.text();

        // =========================================================================
        // patchScript (t3start-rev3.jsから変更なし)
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
        // メインロジック (t3start-rev3.jsから変更なしの部分はコメントもそのままです)
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
            // 【変更点①】iframeのstyleからwidthとheightを削除し、JSでサイズを制御するようにします
            iframe.style.cssText = `position: fixed; top: 0; left: 0; border: none; z-index: 2000000025; background-color: rgba(0, 0, 0, 0.3);`;
            d.body.appendChild(iframe);

            // 【追記点①】スクロールバーを避けてiframeのサイズを自動調整する機能
            const adjustIframeSize = () => {
                const targetIframe = d.getElementById('toshinka-tegaki-tool-iframe');
                if (!targetIframe) return; // 念のため、iframeが存在するかチェック
                // スクロールバーを除いたブラウザ表示領域の正確なサイズを取得
                const viewportWidth = d.documentElement.clientWidth;
                const viewportHeight = d.documentElement.clientHeight;
                // iframeのサイズを上記で取得したサイズに設定
                targetIframe.style.width = `${viewportWidth}px`;
                targetIframe.style.height = `${viewportHeight}px`;
            };
            adjustIframeSize(); // 起動時に一度実行
            window.addEventListener('resize', adjustIframeSize); // ウィンドウサイズ変更時も実行


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
                        
                        // 【追記点②】ツール終了時に、追加したサイズ監視を停止します
                        window.removeEventListener('resize', adjustIframeSize);

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