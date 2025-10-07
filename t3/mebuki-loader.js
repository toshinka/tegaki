javascript:void(async (d) => {
    // ツールURL。末尾のスラッシュは必須です。
    const toolUrl = 'https://toshinka.github.io/tegaki/';
    
    // #1. 既存のiframeをチェックし、もしあれば削除（多重起動防止）
    const existingIframe = d.getElementById('mebuki-tegaki-overlay');
    if (existingIframe) {
        existingIframe.remove();
        return; // 既に起動中なら終了
    }

    // #2. オーバーレイ iframe 作成
    const iframe = d.createElement('iframe');
    iframe.id = 'mebuki-tegaki-overlay';
    
    // スタイル: 画面全体を覆い、他の要素に干渉しないようz-indexを最大値に近く設定
    iframe.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important; /* 最大値: 2147483647 */
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
    `;
    
    // #3. iframeの挿入とコンテンツのロード
    // ツールURLを直接srcに指定することで、CSPや相対パスの問題を回避します。
    d.body.appendChild(iframe);
    iframe.src = toolUrl;

    // #4. メッセージハンドラ (ツール側からのデータ受信)
    window.addEventListener('message', async (e) => {
        // セキュリティのため、メッセージの送信元がツールURLであることを厳密に確認
        if (e.origin !== toolUrl.slice(0, -1)) return; 
        
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
            
            alert('描画完了！GIFをダウンロードし、最初のコマをクリップボードにコピーしました！');
            
            // 3. iframe削除（ツールを閉じる）
            iframe.remove();
        }
    });
    
})(document);