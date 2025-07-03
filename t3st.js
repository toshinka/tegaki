javascript:((async (d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.1 (スクロールバー対応版)
     * このファイルは t3start-rev3.js のスクロールバー問題対応版です。
     */

    try {
        const toolUrl = 'https://toshinka.github.io/tegaki/Phase4A9/ToshinkaTegakiTool.html';
        const response = await fetch(toolUrl);
        if (!response.ok) {
            throw new Error(`HTMLの読み込みに失敗しました: ${response.status} ${response.statusText}`);
        }
        const toolHtmlTemplate = await response.text();

        const patchScript = `
            (() => {
                function patchWhenReady() {
                    if (window.toshinkaTegakiTool && window.toshinkaTegakiTool.layerManager) {
                        const tool = window.toshinkaTegakiTool;

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

                        if (tool.topBarManager) {
                            tool.topBarManager.closeTool = function() {
                                if (confirm('お絵かき…終わった…？')) {
                                    this.app.canvasManager.transferToParent();
                                }
                            };
                        }

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


        const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
        if (existingIframe) {
            existingIframe.remove();

            if (d.body.dataset.originalOverflow) {
                d.body.style.overflow = d.body.dataset.originalOverflow;
                delete d.body.dataset.originalOverflow;
            }
            if (d.documentElement.dataset.originalOverflow) {
                d.documentElement.style.overflow = d.documentElement.dataset.originalOverflow;
                delete d.documentElement.dataset.originalOverflow;
            }
            return;
        }

        const oebtnj = d.getElementById('oebtnj');
        if (!oebtnj) {
            alert('あうぅ…手書きJSボタンが見つかんない…。');
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
                    alert('ひぃん…手書きJSの描画領域が見つかんない…。');
                    return;
                }
            }

            const initialImageDataUrl = (oejs.width > 0 && oejs.height > 0) ? oejs.toDataURL('image/png') : null;


            d.body.dataset.originalOverflow = d.body.style.overflow || 'visible';
            d.documentElement.dataset.originalOverflow = d.documentElement.style.overflow || 'visible';
            

            d.body.style.overflow = 'hidden';
            d.documentElement.style.overflow = 'hidden';

            const iframe = d.createElement('iframe');
            iframe.id = 'toshinka-tegaki-tool-iframe';

            iframe.style.cssText = `
                position: fixed !important; 
                top: 0 !important; 
                left: 0 !important; 
                width: 100vw !important; 
                height: 100vh !important; 
                border: none !important; 
                z-index: 2147483647 !important; 
                background-color: rgba(0, 0, 0, 0.3) !important;
                margin: 0 !important;
                padding: 0 !important;
                pointer-events: auto !important;
            `;
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
                        alert('にへへ…');
                        
                        d.body.style.overflow = d.body.dataset.originalOverflow;
                        d.documentElement.style.overflow = d.documentElement.dataset.originalOverflow;
                        delete d.body.dataset.originalOverflow;
                        delete d.documentElement.dataset.originalOverflow;
                        
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
        
        if (d.body.dataset.originalOverflow) {
            d.body.style.overflow = d.body.dataset.originalOverflow;
            delete d.body.dataset.originalOverflow;
        }
        if (d.documentElement.dataset.originalOverflow) {
            d.documentElement.style.overflow = d.documentElement.dataset.originalOverflow;
            delete d.documentElement.dataset.originalOverflow;
        }
    }
})(document));
