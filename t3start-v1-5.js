// t3start-v1-5.js
// 掲示板ページ上に、としんか手書き-v1-5.htmlをiframeとして埋め込み表示し、
// 手書きJSへの転写と、手書きJSからの復元を可能にするスクリプト
(function(d) {
  // 既に起動している場合は多重起動防止
  if (d.getElementById('toshinka-tegaki-iframe')) {
    alert('としんか手書きツールは既に開いています。');
    return;
  }

  let oejs = d.getElementById('oejs');
  let initialDrawingData = null;

  // oejsに既存の描画がある場合、そのデータを取得
  // t3start.js の逆転写ロジックに似た処理
  if (oejs && oejs.width > 0 && oejs.height > 0) {
    try {
      // 一時的なcanvasを作成してoejsの内容をコピーし、toDataURLで取得
      const tempCanvas = d.createElement('canvas');
      tempCanvas.width = oejs.width;
      tempCanvas.height = oejs.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.drawImage(oejs, 0, 0);
      initialDrawingData = tempCanvas.toDataURL('image/png');
      console.log('既存のoejsから初期描画データを取得しました。');
    } catch (e) {
      console.error('oejsの内容取得に失敗しました:', e);
      initialDrawingData = null; // エラー時は初期データなしとする
    }
  }

  // iframeの作成
  const iframe = document.createElement('iframe');
  // iframe.src は、ToshinkaTegakiTool-v1-5rev2.html の実際のパスに合わせてください。
  // ここではtoshinka.github.ioのパスを仮定しています。
  iframe.src = 'https://toshinka.github.io/tegaki/v1-5/ToshinkaTegakiTool-v1-5rev2.html'; // ←絶対必要
  iframe.id = 'toshinka-tegaki-iframe';
  iframe.style.position = "fixed";
  iframe.style.top = 0;
  iframe.style.left = 0;
  iframe.style.width = "100vw";
  iframe.style.height = "100vh";
  iframe.style.zIndex = "2000000025";
  iframe.style.border = "none";
  d.body.appendChild(iframe);

  // iframeロード後に初期描画データを送信
  iframe.onload = () => {
    if (initialDrawingData) {
      // postMessageで子フレームに初期画像データを送信
      // 注意: targetOriginは、実際のToshinkaTegakiTool-v1-5rev2.htmlがホストされているオリジンに厳密に設定してください。
      // ローカルでテストする場合は 'null' もしくは '*' を使用できますが、本番環境ではセキュリティリスクがあります。
      // 例: iframe.contentWindow.postMessage({ type: 'initialDrawing', data: initialDrawingData }, 'https://toshinka.github.io');
      iframe.contentWindow.postMessage({
        type: 'initialDrawing',
        data: initialDrawingData
      }, '*'); // 開発・テスト用に '*' を使用。本番では適切なオリジンを指定
      console.log('初期画像データを子フレームに送信しました。');
    }
  };

  // 子フレームからのメッセージ（描画データや閉じる指示）を受信するためのリスナー
  window.addEventListener('message', (event) => {
    // セキュリティ: イベントのオリジンを確認することを強く推奨
    // if (event.origin !== 'https://toshinka.github.io') { // 適切なオリジンに置き換える
    //   console.warn('不明なオリジンからのメッセージをブロックしました:', event.origin);
    //   return;
    // }

    if (event.data && event.data.type === 'drawingData') {
      const imageDataURL = event.data.data;
      console.log('子フレームから描画データを受信しました。');

      // 手書きJSのcanvas (oejs) を取得
      // t3start.js の oejs 生成ロジックに似た処理
      let oejs = d.getElementById('oejs');
      if (!oejs) {
        oejs = d.createElement('canvas');
        oejs.id = 'oejs';
        oejs.width = 400; // t3start.jsのデフォルトサイズ
        oejs.height = 400; // t3start.jsのデフォルトサイズ
        oejs.style.position = 'absolute';
        const oest1 = d.querySelector('#oest1'); // ふたばの投稿フォーム下の要素
        if (oest1) {
          oest1.appendChild(oejs);
          console.log('oejsを新しく作成しました (#oest1内)。');
        } else {
          d.body.appendChild(oejs); // fallback
          console.warn('oejsの配置場所 (#oest1) が見つかりませんでした。bodyに直接追加しました。');
        }
      }

      if (oejs) {
        const tc = oejs.getContext('2d', { willReadFrequently: true });
        const img = new Image();
        img.onload = () => {
          // t3start.jsの転写ロジックを参考にサイズ調整
          const maxSize = 400;
          let scale = 1;
          if (img.width <= maxSize && img.height <= maxSize) scale = 1;
          else scale = Math.min(maxSize / img.width, maxSize / img.height);
          const w = img.width * scale;
          const h = img.height * scale;

          oejs.width = w;
          oejs.height = h;
          tc.clearRect(0, 0, w, h);
          tc.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
          alert('手書きツールからの転写が完了しました！');
        };
        img.onerror = (e) => {
          console.error('画像のロードに失敗しました:', e);
          alert('画像データの転写に失敗しました。');
        };
        img.src = imageDataURL;
      } else {
        alert('手書きJSのcanvas (oejs) が見つからないため、転写できませんでした。');
      }

      // 転写が完了したらiframeを閉じる
      const iframeElement = d.getElementById('toshinka-tegaki-iframe');
      if (iframeElement) {
        iframeElement.remove();
        console.log('手書きツールiframeを閉じました。');
      }

    } else if (event.data && event.data.type === 'closeTool') {
      // 閉じるボタンだけ押された場合（画像データなし）
      console.log('子フレームからツールを閉じる要求を受信しました。');
      const iframeElement = d.getElementById('toshinka-tegaki-iframe');
      if (iframeElement) {
        iframeElement.remove();
        console.log('手書きツールiframeを閉じました (画像データなし)。');
      }
    }
  });

  // t3start-v1-5.js 独自の閉じるボタンは、子フレームの閉じるボタンに機能が集約されるため削除します。
  const existingCloseBtn = d.querySelector('#toshinka-tegaki-iframe + button');
  if (existingCloseBtn) {
    existingCloseBtn.remove();
  }

})(document);