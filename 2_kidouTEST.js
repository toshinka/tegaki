if (!document.getElementById('oejs')) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.id = 'oejs';
  tempCanvas.width = 135;
  tempCanvas.height = 135;
  document.querySelector('#oest1')?.appendChild(tempCanvas); // #oest1内に追加
}