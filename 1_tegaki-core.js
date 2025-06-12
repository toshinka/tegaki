javascript:(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '2000000021'; // FUTAKUROを上回る
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const closeButton = document.createElement('button');
  closeButton.textContent = '☓';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.style.zIndex = '2000000022'; // さらに高く
  closeButton.addEventListener('click', () => canvas.remove());
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
