javascript:(() => {
  if (!document.querySelector('script[src="https://toshinka.github.io/tegaki/1_tegaki-core.js?1749718800001"]')) {
    const script = document.createElement('script');
    script.src = 'https://toshinka.github.io/tegaki/1_tegaki-core.js?1749718800001';
    document.head.appendChild(script);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '2000000021';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const closeButton = document.createElement('button');
  closeButton.textContent = '☓';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.style.zIndex = '2000000022';
  closeButton.addEventListener('click', () => {
    console.log('Closing canvas');
    const targetCanvas = document.getElementById('oejs');
    if (!targetCanvas) {
      alert('手書きJSが起動していません。手書きJSを起動してから再度お試しください。');
    } else {
      const targetCtx = targetCanvas.getContext('2d');
      const scale = Math.min(135 / canvas.width, 135 / canvas.height);
      const newWidth = canvas.width * scale;
      const newHeight = canvas.height * scale;
      targetCanvas.width = newWidth;
      targetCanvas.height = newHeight;
      targetCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newWidth, newHeight);
      alert('転写完了！手書きJSを確認してください。');
    }
    canvas.remove();
    closeButton.remove();
  });
  canvas.parentNode.insertBefore(closeButton, canvas.nextSibling);

  let isDrawing = false;
  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
    }
  });
  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseleave', () => isDrawing = false);
})();
