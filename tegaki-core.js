 if (targetCanvas.width > 400 || targetCanvas.height > 400) {
   if (confirm('キャンバスが大きすぎます。400x400にリサイズしますか？')) {
     const scale = Math.min(400 / targetCanvas.width, 400 / targetCanvas.height);
     const newWidth = targetCanvas.width * scale;
     const newHeight = targetCanvas.height * scale;
     const tempCanvas = document.createElement('canvas');
     tempCanvas.width = newWidth;
     tempCanvas.height = newHeight;
     tempCanvas.getContext('2d').drawImage(targetCanvas, 0, 0, newWidth, newHeight);
     targetCanvas.width = newWidth;
     targetCanvas.height = newHeight;
     ctx.drawImage(tempCanvas, 0, 0);
   }
 }
