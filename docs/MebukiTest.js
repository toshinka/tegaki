/*
 * MebukiTest.js
 * Bookmarklet Loader for Toshinka Tegaki Tool
 * (Canvas98スタイル簡易版)
 * v1.0
 */

globalThis.mebukiStart = function() {
    try {
        const d = document;
        const existing = d.getElementById('mebuki-tegaki-overlay');

        // すでに起動中なら終了処理
        if (existing) {
            existing.remove();
            if (d.body.dataset.mebukiOriginalOverflow) {
                d.body.style.overflow = d.body.dataset.mebukiOriginalOverflow;
                delete d.body.dataset.mebukiOriginalOverflow;
            }
            if (d.documentElement.dataset.mebukiOriginalOverflow) {
                d.documentElement.style.overflow = d.documentElement.dataset.mebukiOriginalOverflow;
                delete d.documentElement.dataset.mebukiOriginalOverflow;
            }
            console.log('🪶 MebukiTegakiTool closed.');
            return;
        }

        // overflow状態を保存して非表示化
        d.body.dataset.mebukiOriginalOverflow = d.body.style.overflow || 'visible';
        d.documentElement.dataset.mebukiOriginalOverflow = d.documentElement.style.overflow || 'visible';
        d.body.style.overflow = 'hidden';
        d.documentElement.style.overflow = 'hidden';

        // iframe生成
        const iframe = d.createElement('iframe');
        iframe.id = 'mebuki-tegaki-overlay';
        iframe.src = 'https://toshinka.github.io/tegaki/';
        iframe.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            border: none !important;
            z-index: 2147483647 !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            background-color: rgba(0, 0, 0, 0.15) !important;
        `;
        d.body.appendChild(iframe);

        // 終了要求・エクスポート完了メッセージのリスナー
        window.addEventListener('message', async (e) => {
            if (e.origin !== 'https://toshinka.github.io') return;
            if (e.data?.type === 'export-finish') {
                alert('描画完了！GIFまたはPNGを処理中です。');
                // BlobやClipboardなどのデータ処理が必要ならここで行う
            }
            if (e.data?.type === 'tool-close-request') {
                iframe.remove();
                d.body.style.overflow = d.body.dataset.mebukiOriginalOverflow;
                d.documentElement.style.overflow = d.documentElement.dataset.mebukiOriginalOverflow;
                delete d.body.dataset.mebukiOriginalOverflow;
                delete d.documentElement.dataset.mebukiOriginalOverflow;
                console.log('🪶 MebukiTegakiTool closed via message.');
            }
        });

        console.log('🌸 MebukiTegakiTool launched.');
    } catch (err) {
        console.error('MebukiTegakiTool Loader Error:', err);
        alert('ツールの起動に失敗しました。\n' + err.message);
    }
};
