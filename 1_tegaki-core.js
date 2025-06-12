closeButton.addEventListener('click', () => {
  console.log('Closing canvas');
  const targetCanvas = document.getElementById('oejs');
  if (targetCanvas) {
    const targetCtx = targetCanvas.getContext('2d');
    const scale = Math.min(135 / canvas.width, 135 / canvas.height);
    const newWidth = canvas.width * scale;
    const newHeight = canvas.height * scale;
    targetCanvas.width = newWidth;
    targetCanvas.height = newHeight;
    targetCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newWidth, newHeight);
  }
  canvas.remove();
  closeButton.remove();
});
