javascript:void(async (d) => {
    const toolUrl = 'https://toshinka.github.io/tegaki/';
    const existingIframe = d.getElementById('mebuki-tegaki-overlay');
    if (existingIframe) {
        existingIframe.remove();
        return; 
    }

    const iframe = d.createElement('iframe');
    iframe.id = 'mebuki-tegaki-overlay';
    
    // スタイル (変更なし)
    iframe.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
    `;
    
    d.body.appendChild(iframe);
    iframe.src = toolUrl;

    // メッセージハンドラ (tool-close-request を追加)
    window.addEventListener('message', async (e) => {
        if (e.origin !== toolUrl.slice(0, -1)) return; 
        
        // ★★★ データ出力後の終了 または 単純終了要求 ★★★
        if (e.data.type === 'export-finish' || e.data.type === 'tool-close-request') {
            
            // export-finish の場合のみ、ダウンロードとクリップボード処理を実行
            if (e.data.type === 'export-finish') {
                const { gifBlob, firstFramePNG } = e.data;
                
                // 1. GIFの自動ダウンロード
                const url = URL.createObjectURL(gifBlob);
                const a = d.createElement('a');
                a.href = url;
                a.download = `mebuki-${Date.now()}.gif`;
                d.body.appendChild(a); 
                a.click();
                d.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // 2. 静止画をクリップボードにコピー
                if (firstFramePNG && navigator.clipboard.write) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': firstFramePNG })
                        ]);
                    } catch (clipError) {
                        console.warn('クリップボードへのコピーに失敗しました:', clipError);
                    }
                }
                
                alert('描画完了！データを処理し、ツールを閉じます。');
            } else {
                 // tool-close-request の場合
                 console.log('ツールからの終了リクエストを受信しました。');
            }
            
            // 3. iframe削除（ツールを閉じる）
            iframe.remove();
        }
    });
    
})(document);