javascript:((async (d) => {
    /*
     * ToshinkaTegakiTool Loader for Futaba Channel
     * v3.0 (srcdoc + fetch version)
     * このファイルは t3start-over.js です。
     * 動作安定性を確保するため、最初のバージョンのsrcdoc方式に回帰しつつ、
     * fetchによるHTMLの外部読み込みを実現します。
     */

    try {
        // =========================================================================
        // 外部HTMLをfetchで読み込み、文字列として取得します
        // =========================================================================
        const toolUrl = 'https://toshinka.github.io/tegaki/ToshinkaTegakiTool.html';
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
                            // ... 既存のコード ...
                        };

                        // --- 2. 閉じるボタンの動作を拡張して、親ウィンドウにメッセージを送る ---
                        // 元のcloseTool関数を保存
                        const originalCloseTool = tool.closeTool;
                        tool.closeTool = function() {
                            // 親ウィンドウにツールが閉じられたことを通知
                            window.parent.postMessage({ type: 'toshinka-tegaki-tool-closed' }, '*');
                            // 元のcloseTool関数を実行
                            originalCloseTool.apply(this, arguments);
                        };

                        // --- 3. 転写ボタンの動作を拡張して、親ウィンドウにメッセージを送る ---
                        // 元のexportImage関数を保存
                        const originalExportImage = tool.exportImage;
                        tool.exportImage = function() {
                            // 元のexportImage関数を実行
                            const result = originalExportImage.apply(this, arguments);
                            // 親ウィンドウにツールが閉じられたことを通知 (転写時もツールは閉じるので)
                            window.parent.postMessage({ type: 'toshinka-tegaki-tool-closed' }, '*');
                            return result;
                        };

                        // ... 既存のpatchWhenReady関数の残りの部分 ...
                        // (もしあれば、ここに続く)
                    } else {
                        setTimeout(patchWhenReady, 100);
                    }
                }
                patchWhenReady();
            })();
        `;
        const patchedToolHtml = toolHtmlTemplate.replace('', patchScript);

        // =========================================================================
        // iframeを作成し、bodyに追加します
        // =========================================================================
        const iframe = d.createElement('iframe');
        iframe.id = 'toshinka-tegaki-tool-iframe';
        iframe.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: 9999999999; background-color: rgba(0, 0, 0, 0.3);`;
        iframe.srcdoc = patchedToolHtml; // HTML文字列を直接埋め込む
+        // ★ 親ドキュメントのスクロールバーを隠す
+        const prevOverflow = d.body.style.overflow;
+        d.body.style.overflow = 'hidden';

        // *** ここから追加・変更する部分 ***

        // 親ページのスクロールバーを一時的に非表示にする
        // body要素にoverflow: hidden;を適用する
        // 既存のスタイルを保存しておくことで、元に戻せるようにする
        const originalBodyOverflow = d.body.style.overflow;
        const originalHtmlOverflow = d.documentElement.style.overflow; // html要素も対象にするのが安全
        d.body.style.overflow = 'hidden';
        d.documentElement.style.overflow = 'hidden';

        d.body.appendChild(iframe);

        // iframeが完全に読み込まれるまで待機
        iframe.onload = () => {
            // iframe内のDOMContentLoadedイベントを待つ
            // これはiframe内部のスクリプトが確実に実行されるようにするため
            iframe.contentWindow.addEventListener('DOMContentLoaded', () => {
                // iframe内のスクリプトがすべて実行された後にメッセージハンドラを設定
                // この setTimeout はなくても動く可能性が高いですが、念のため。
                setTimeout(() => {
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
                                // ツールが閉じられた際の処理 (export時もツールは閉じる)
                                iframe.remove();
                                window.removeEventListener('message', messageHandler);
                                iframe.remove();
                                d.body.style.overflow = prevOverflow; // スクロールバー設定を戻す
                                window.removeEventListener('message', messageHandler);
                                // 親ページのスクロールバーを元に戻す
                                d.body.style.overflow = originalBodyOverflow;
                                d.documentElement.style.overflow = originalHtmlOverflow;
                            };
                            img.src = event.data.imageDataUrl;
                        }
                        // *** ここから追加 ***
                        else if (event.data && event.data.type === 'toshinka-tegaki-tool-closed') {
                            // ツールが「閉じる」ボタンで閉じられた際の処理
                            iframe.remove();
                            window.removeEventListener('message', messageHandler);
                            // 親ページのスクロールバーを元に戻す
                            d.body.style.overflow = originalBodyOverflow;
                            d.documentElement.style.overflow = originalHtmlOverflow;
                        }
                        // *** 追加ここまで ***
                    };

                    window.addEventListener('message', messageHandler);
                }, 300); // 念のため少し遅延
            });
        };

    } catch (error) {
        console.error('ToshinkaTegakiTool Loader Error:', error);
        alert('ツールの起動に失敗しました。\n' + error.message);
    }
})(document);