// mebuki-loader.js
(function() {
  if (globalThis.mebukiStart) {
    // すでにロード済みなら再実行
    globalThis.mebukiStart();
    return;
  }

  // お絵かきツールのURL（docs/index.html をエントリにしている想定）
  const toolUrl = 'https://toshinka.github.io/tegaki/?mode=mebuki';

  // iFrameでツールを呼び出す
  function openTool() {
    // 既にiFrameが存在すれば再利用
    if (document.getElementById('tegaki-iframe')) {
      document.getElementById('tegaki-iframe').style.display = 'block';
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'tegaki-iframe';
    iframe.src = toolUrl;
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.zIndex = '999999';
    iframe.style.border = 'none';
    iframe.style.background = '#fff';
    document.body.appendChild(iframe);

    // メッセージ受信: ツールから描画完了PNGを受け取る
    window.addEventListener('message', async (ev) => {
      if (!ev.data || !ev.data.type) return;

      if (ev.data.type === 'tegaki:close') {
        iframe.remove();
      }

      if (ev.data.type === 'tegaki:export') {
        const blob = await (await fetch(ev.data.dataUrl)).blob();
        const file = new File([blob], "tegaki.png", { type: "image/png" });

        // Mebukiのfile inputを探す
        let input = document.querySelector('input[type="file"][accept*="image/png"]');
        if (!input) {
          const btn = document.querySelector('.dt_r_status-button');
          if (btn) btn.click();
          input = await waitForInput();
        }

        // inputにFileをセット
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        iframe.remove();
      }
    });
  }

  // input[type=file] 出現待ち
  function waitForInput() {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        const input = document.querySelector('input[type="file"][accept*="image/png"]');
        if (input) {
          observer.disconnect();
          resolve(input);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject("Mebuki input not found"); }, 5000);
    });
  }

  // グローバルエントリ
  globalThis.mebukiStart = openTool;
})();
