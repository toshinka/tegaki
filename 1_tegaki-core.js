closeButton.addEventListener('click', () => {
  const targetCanvas = document.getElementById('oejs');
  if (targetCanvas) {
    const targetCtx = targetCanvas.getContext('2d');
    const scale = Math.min(135 / canvas.width, 135 / canvas.height);
    const newWidth = canvas.width * scale;
    const newHeight = canvas.height * scale;
    targetCanvas.width = newWidth;
    targetCanvas.height = newHeight;
    targetCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newWidth, newHeight);
    targetCanvas.style.display = 'block'; // 強制再描画
    alert('転写完了！手書きJSを確認してください。');
  }
  canvas.remove();
  closeButton.remove();
});
