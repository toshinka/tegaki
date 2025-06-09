(function(){
  console.log("二次裏用手書きブックマークレット起動！");

  // カラーパレット仮例（今後もし他でも使うならwindow.palette化でも可）
  const palette = ['#FFFCE5','#A42C2C','#D28F8F','#EBC4B4','#F7E8D5','#FFFFFF','#FF9C4A','#77BB77'];

  // 二次裏の手描きcanvas取得
  const targetCanvas = document.getElementById('oejs');
  if (!targetCanvas) {
    alert('手書きキャンバスが見つかりません！先に手書きモードを開いてください。');
  } else {
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
    ctx.strokeStyle = '#A42C2C';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(200, 50);
    ctx.stroke();
    console.log('描画完了！');
  }
})();
