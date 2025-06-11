javascript:(() => {
  const targetCanvas = document.getElementById('oejs');
  if (!targetCanvas) {
    console.error('oejsが見つかりません');
    return;
  }
  const ctx = targetCanvas.getContext('2d');

  // 閉じるボタンの追加
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
