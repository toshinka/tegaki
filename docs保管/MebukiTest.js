// ==================================================
// MebukiTest.js
// ブックマークレット起動対応・iframe直読み型
// ==================================================
(function() {
  // 既に読み込み済みなら再呼び出し
  if (globalThis.mebukiStart) return;

  globalThis.mebukiStart = function() {
    // 既に開いていたら閉じる
    const existing = document.getElementById('mebuki-tool-iframe');
    if (existing) {
      existing.remove();
      const closeBtn = document.getElementById('mebuki-close-btn');
      if (closeBtn) closeBtn.remove();
      document.body.style.overflow = '';
      return;
    }

    // iframe生成
    const iframe = document.createElement('iframe');
    iframe.id = 'mebuki-tool-iframe';
    iframe.src = 'https://toshinka.github.io/tegaki/';
    iframe.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 2147483646 !important;
      background: rgba(0,0,0,0.25) !important;
      display: block !important;
    `;
    document.body.appendChild(iframe);

    // 背景スクロール抑止
    document.body.style.overflow = 'hidden';

    // ✕ボタン生成
    const closeBtn = document.createElement('button');
    closeBtn.id = 'mebuki-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: fixed !important;
      top: 10px !important;
      right: 15px !important;
      font-size: 24px !important;
      color: white !important;
      background: rgba(0,0,0,0.6) !important;
      border: none !important;
      border-radius: 50% !important;
      width: 40px !important;
      height: 40px !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
    `;
    closeBtn.title = 'ツールを閉じる';
    closeBtn.onclick = () => {
      iframe.remove();
      closeBtn.remove();
      document.body.style.overflow = '';
    };
    document.body.appendChild(closeBtn);

    // Escキーで閉じる対応
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        iframe.remove();
        closeBtn.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    console.log('[MebukiTest] iframe inserted successfully');
  };

  console.log('[MebukiTest] mebukiStart() ready');
})();
