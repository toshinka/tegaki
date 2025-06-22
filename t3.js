javascript:((async (d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.1 (srcdoc + fetch + resize-adjust version)
     * このファイルは t3start-rev4.js です。
     * ブラウザのスクロールバー表示時にツールが重ならないよう、自動調整機能を追加しました。
     */

    try {
        // 外部HTMLの読み込み（変更なし）
        const toolUrl = 'https://toshinka.github.io/tegaki/v1-5/ToshinkaTegakiTool-v1-5rev3.html';
        const response = await fetch(toolUrl);
        if (!response.ok) {
            throw new Error(`HTMLの読み込みに失敗しました: ${response.status} ${response.statusText}`);
        }
        const toolHtmlTemplate = await response.text();

        // patchScript（変更なし）
        const patchScript = `
            (() => {
                function patchWhenReady() {
                    if (window.toshinkaTegakiTool && window.toshinkaTegakiTool.layerManager) {
                        const tool = window.toshinkaTegakiTool;
                        tool.layerManager.loadBackgroundImage = function(imageDataUrl) {
                            const bgLayer = this.layers[0]; if (!bgLayer) return;
                            const img = new Image();
                            img.onload = () => {
                                bgLayer.ctx.clearRect(0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
                                bgLayer.ctx.drawImage(img, 0, 0, bgLayer.canvas.width, bgLayer.canvas.height);
                                this.app.canvasManager.saveState();
                            };
                            img.src = imageDataUrl;
                        };
                        tool.canvasManager.transferToParent = function() {
                            const mergedCanvas = document.createElement('canvas');
                            mergedCanvas.width = this.canvas.width; mergedCanvas.height = this.canvas.height;
                            const mergedCtx = mergedCanvas.getContext('2d');
                            this.app.layerManager.layers.forEach(layer => { mergedCtx.drawImage(layer.canvas, 0, 0); });
                            const dataURL = mergedCanvas.toDataURL('image/png');
                            window.parent.postMessage({ type: 'toshinka-tegaki-tool-export', imageDataUrl: dataURL }, '*');
                        };
                        if (tool.topBarManager) {
                            tool.topBarManager.closeTool = function() {
                                if (confirm('描画内容を手書きJSに転写して閉じますか？')) {
                                    this.app.canvasManager.transferToParent();
                                }
                            };
                        }
                        window.addEventListener('message', (event) => {
                            if (event.data && event.data.type === 'init' && event.data.imageDataUrl) {
                                tool.layerManager.loadBackgroundImage(event.data.imageDataUrl);
                            }
                        });
                    } else { setTimeout(patchWhenReady, 100); }
                }
                patchWhenReady();
            })();
        `;

        // メインロジック（変更なしの部分は省略）
        const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
        if (existingIframe) {
            existingIframe.remove();
            // 以前のリスナーが残っている可能性を考慮して削除を試みる
            if(window.toshinkaTegakiToolResizeHandler) {
                window.removeEventListener('resize', window.toshinkaTegakiToolResizeHandler);
            }
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
                oejs = d.createElement('canvas'); oejs.id = 'oejs';
                const oest1 = d.querySelector('#oest1');
                if (oest1) oest1.appendChild(oejs); else { alert('手書きJSの描画領域が見つかりませんでした。'); return; }
            }
            const initialImageDataUrl = (oejs.width > 0 && oejs.height > 0) ? oejs.toDataURL('image/png') : null;

            const iframe = d.createElement('iframe');
            iframe.id = 'toshinka-tegaki-tool-iframe';
            // 初期スタイルからwidth/heightを削除し、JSで制御するように変更
            iframe.style.cssText = `position: fixed; top: 0; left: 0; border: none; z-index: 2000000025; background-color: rgba(0, 0, 0, 0.3);`;
            d.body.appendChild(iframe);

            // ★★★ ここからが今回の修正箇所 ★★★
            // iframeのサイズを動的に調整する関数
            const adjustIframeSize = () => {
                if (!d.getElementById('toshinka-tegaki-tool-iframe')) return;
                // スクロールバーを除いた実際の表示領域のサイズを取得
                const viewportWidth = d.documentElement.clientWidth;
                const viewportHeight = d.documentElement.clientHeight;
                // iframeのサイズを実際の表示領域に合わせる
                iframe.style.width = `${viewportWidth}px`;
                iframe.style.height = `${viewportHeight}px`;
            };

            // ツール起動時に一度サイズを調整
            adjustIframeSize();

            // ウィンドウのリサイズを監視して、再度サイズを調整する
            window.addEventListener('resize', adjustIframeSize);
            // 削除できるように、グローバルに関数を保持
            window.toshinkaTegakiToolResizeHandler = adjustIframeSize;
            // ★★★ ここまでが今回の修正箇所 ★★★

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
                        const maxSize = 400; let scale = 1;
                        if (img.width > maxSize || img.height > maxSize) scale = Math.min(maxSize / img.width, maxSize / img.height);
                        const w = img.width * scale; const h = img.height * scale;
                        oejs.width = w; oejs.height = h;
                        const tc = oejs.getContext('2d');
                        tc.clearRect(0, 0, w, h);
                        tc.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
                        alert('転写完了！');
                        
                        iframe.remove();
                        // ★★★ ツール終了時にリサイズ監視を停止 ★★★
                        if(window.toshinkaTegakiToolResizeHandler) {
                             window.removeEventListener('resize', window.toshinkaTegakiToolResizeHandler);
                             delete window.toshinkaTegakiToolResizeHandler;
                        }
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