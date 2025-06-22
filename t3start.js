javascript:((d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.0 (URL Loader version)
     */
    const TOOL_URL = "https://toshinka.github.io/tegaki/ToshinkaTegakiTool.html";

    // 多重起動防止
    const existingIframe = d.getElementById('toshinka-tegaki-tool-iframe');
    if (existingIframe) {
        alert('としんか手書きツールは既に開いています。');
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
        iframe.src = TOOL_URL;
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
        
        iframe.onload = () => {
            // iframeのツールが完全に読み込まれた後、初期画像を送信
            if (initialImageDataUrl) {
                iframe.contentWindow.postMessage({
                    type: 'init',
                    imageDataUrl: initialImageDataUrl
                }, '*');
            }
        };

        d.body.appendChild(iframe);

        const messageHandler = (event) => {
            // 送信元がiframeであること、URLが正しいことを確認
            if (event.source !== iframe.contentWindow || !event.origin.startsWith(new URL(TOOL_URL).origin)) {
                return;
            }

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