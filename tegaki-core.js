javascript:(() => {
  const targetCanvas = document.getElementById('oejs');
  if (!targetCanvas) {
    console.error('oejsが見つかりません');
    return;
  }
  const ctx = targetCanvas.getContext('2d');

  // 閉じるボタン
  const closeButton = document.createElement('button');
  closeButton.textContent = '☓';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.style.zIndex = '1001';
  closeButton.addEventListener('click', () => {
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    closeButton.remove();
  });
  document.body.appendChild(closeButton);

  // 画像アップロード
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = function(e) {
    const file = e.target.files[0];
    const img = new Image();
    img.onload = () => {
      let scale = 1;
      if (img.width > 400 || img.height > 400) {
        scale = Math.min(400 / img.width, 400 / img.height);
      }
      targetCanvas.width = img.width * scale;
      targetCanvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * scale, img.height * scale);
    };
    img.onerror = () => console.error('読み込みエラー');
    img.src = URL.createObjectURL(file);
  };
  document.getElementById('ftbl').insertRow(-1).insertCell(-1).appendChild(input);

  let isDrawing = false;
  targetCanvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });
  targetCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });
  targetCanvas.addEventListener('mouseup', () => isDrawing = false);
  targetCanvas.addEventListener('mouseleave', () => isDrawing = false);
})();
