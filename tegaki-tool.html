<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>二次裏風はっちゃんUIペイントツール</title>
<style>
  body {
    margin: 0; background: #FFFCE5;
    display: flex; flex-direction: row;
  }
  #toolbar {
    background: #F7E8D5;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .toolbtn, .colorbtn, .sizebtn {
    width: 32px; height: 32px;
    border: 2px solid #A42C2C;
    border-radius: 4px;
    background: #FFFCE5;
    cursor: pointer;
  }
  .colorbtn {
    border-radius: 50%;
  }
  #canvas {
    flex: 1;
    cursor: crosshair;
  }
</style>
</head>
<body>
<div id="toolbar">
  <button class="toolbtn" id="undo">↶</button>
  <button class="toolbtn" id="redo">↷</button>
  <button class="toolbtn" id="eraser">✕</button>
  <div>
    <div id="colors"></div>
  </div>
  <div>
    <button class="sizebtn" data-size="1">1</button>
    <button class="sizebtn" data-size="3">3</button>
    <button class="sizebtn" data-size="5">5</button>
    <button class="sizebtn" data-size="10">10</button>
    <button class="sizebtn" data-size="30">30</button>
  </div>
</div>
<canvas id="canvas" width="800" height="600"></canvas>
<script>
const colors = ['#FFFCE5','#A42C2C','#D28F8F','#EBC4B4','#F7E8D5','#FFFFFF','#FF9C4A','#77BB77'];
const colorsDiv = document.getElementById('colors');
colors.forEach(col => {
  const c = document.createElement('button');
  c.className = 'colorbtn';
  c.style.background = col;
  c.onclick = () => currentColor = col;
  colorsDiv.appendChild(c);
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let currentColor = '#A42C2C';
let currentSize = 3;
let isDrawing = false;

canvas.addEventListener('mousedown', e => {
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
});
canvas.addEventListener('mousemove', e => {
  if (!isDrawing) return;
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = currentSize;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});
canvas.addEventListener('mouseup', () => isDrawing = false);

const sizeBtns = document.querySelectorAll('.sizebtn');
sizeBtns.forEach(btn => {
  btn.onclick = () => currentSize = Number(btn.dataset.size);
});
</script>
</body>
</html>
