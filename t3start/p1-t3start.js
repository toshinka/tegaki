javascript:(d => {
  // 手書きJSを強制初期化
  const oebtnj = d.getElementById('oebtnj');
  if (oebtnj) {
    oebtnj.click(); // 手書きモードをトリガー
    setTimeout(() => {
      let oejs = d.getElementById('oejs');
      if (!oejs) {
        oejs = d.createElement('canvas');
        oejs.id = 'oejs';
        oejs.width = 400;
        oejs.height = 400;
        oejs.style.position = 'absolute';
        d.querySelector('#oest1')?.appendChild(oejs);
      }
      // 逆転写ロジック: 手書きJSから白四角に描画
      const c = d.createElement('canvas');
      c.width = 400;
      c.height = 400;
      c.style.position = 'fixed';
      c.style.top = '50px';
      c.style.left = '0';
      c.style.zIndex = '2000000025';
      c.getContext('2d', { willReadFrequently: true });
      d.body.appendChild(c);
      const ctx = c.getContext('2d');
      if (oejs && oejs.width > 0 && oejs.height > 0) { // サイズ確認
        ctx.drawImage(oejs, 0, 0, oejs.width, oejs.height, 0, 0, 400, 400); // サイズ調整
      } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      const b = d.createElement('button');
      b.textContent = '☓';
      b.style.position = 'absolute';
      b.style.top = '5px';
      b.style.right = '5px';
      b.style.zIndex = '2000000026';
      b.addEventListener('click', () => {
        if (oejs) {
          const tc = oejs.getContext('2d', { willReadFrequently: true });
          const maxSize = 400;
          let scale = 1;
          if (c.width <= maxSize && c.height <= maxSize) scale = 1;
          else scale = Math.min(maxSize / c.width, maxSize / c.height);
          const w = c.width * scale, h = c.height * scale;
          oejs.width = w;
          oejs.height = h;
          tc.clearRect(0, 0, w, h);
          tc.drawImage(c, 0, 0, c.width, c.height, 0, 0, w, h);
          alert('転写完了！');
        } else {
          alert('手書きJSの初期化に失敗しました。');
        }
        c.remove();
        b.remove();
      });
      c.parentNode.insertBefore(b, c.nextSibling);
      let drawing = false;
      c.addEventListener('mousedown', e => {
        if (c.parentNode) {
          drawing = true;
          ctx.beginPath();
          ctx.moveTo(e.offsetX, e.offsetY);
        }
      });
      c.addEventListener('mousemove', e => {
        if (drawing && c.parentNode) {
          ctx.lineTo(e.offsetX, e.offsetY);
          ctx.stroke();
        }
      });
      c.addEventListener('mouseup', () => drawing = false);
      c.addEventListener('mouseleave', () => drawing = false);
    }, 300); // 初期化待機
  } else {
    alert('手書きJSボタンが見つかりませんでした。');
  }
})(document);
