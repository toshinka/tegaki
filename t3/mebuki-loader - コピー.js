// mebuki-loader.js（概念コード）
javascript:((async (d) => {
    const toolUrl = 'https://toshinka.github.io/tegaki/';
    const response = await fetch(toolUrl);
    const toolHTML = await response.text();
    
    // オーバーレイ iframe 作成
    const iframe = d.createElement('iframe');
    iframe.id = 'mebuki-tegaki-overlay';
    iframe.style.cssText = `
        position: fixed !important;
        top: 0 !important;https://github.com/toshinka/tegaki
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999999 !important;
        border: none !important;
    `;
    d.body.appendChild(iframe);
    iframe.srcdoc = toolHTML;
    
    // メッセージハンドラ
    window.addEventListener('message', async (e) => {
        if (e.data.type === 'export-animation') {
            // GIF Blobを受け取る
            const gifBlob = e.data.blob;
            
            // 方式1: 自動ダウンロード
            const url = URL.createObjectURL(gifBlob);
            const a = d.createElement('a');
            a.href = url;
            a.download = `mebuki-${Date.now()}.gif`;
            a.click();
            URL.revokeObjectURL(url);
            
            // 方式2: 静止画をクリップボードに（おまけ）
            const firstFrame = e.data.firstFramePNG;
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': firstFrame })
            ]);
            
            alert('GIFをダウンロードしました！\nめぶきのレス欄にドラッグ&ドロップしてください。');
            
            // iframe削除
            iframe.remove();
        }
    });
})(document));