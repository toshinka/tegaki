javascript:(d => {
  // 手書きJSを強制起動
  const oebtnj = d.getElementById('oebtnj');
  if (oebtnj && oebtnj.style.display === 'none') {
    oebtnj.click(); // 手書きモードに切り替え
  } else if (!d.getElementById('oejs')) {
    const t = d.createElement('canvas');
    t.id = 'oejs';
    t.width = 400;
    t.height = 400;
    t.style.position = 'absolute';
    d.querySelector('#oest1')?.appendChild(t);
  }

  if (!d.querySelector('script[src="https://toshinka.github.io/tegaki/1_tegaki-core.js?' + (parseInt(Date.now() / 36e+5) * 36e+5) + '"]')) {
    const s = d.createElement('script');
    s.src = 'https://toshinka.github.io/tegaki/1_tegaki-core.js?' + (parseInt(Date.now() / 36e+5) * 36e+5);
    d.head.appendChild(s);
  }
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
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, c.width, c.height);
  const b = d.createElement('button');
  b.textContent = '☓';
  b.style.position = 'absolute';
  b.style.top = '5px';
  b.style.right = '5px';
  b.style.zIndex = '2000000026';
  b.addEventListener('click', () => {
    const t = d.getElementById('oejs');
    if (t) {
      const tc = t.getContext('2d', { willReadFrequently: true });
      const maxSize = 400;
      let scale = 1;
      if (c.width <= maxSize && c.height <= maxSize) scale = 1;
      else scale = Math.min(maxSize / c.width, maxSize / c.height);
      const w = c.width * scale, h = c.height * scale;
      t.width = w;
      t.height = h;
      tc.clearRect(0, 0, t.width, t.height);
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
})(document);
