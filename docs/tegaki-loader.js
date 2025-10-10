<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ふたば風お絵かきツール</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'MS PGothic', 'Osaka-Mono', monospace;
  background: #ffe;
  color: #800000;
  overflow: hidden;
}

#app {
  display: flex;
  height: 100vh;
  flex-direction: column;
}

/* ヘッダー */
#header {
  background: #ea8;
  border-bottom: 1px solid #800000;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

#header h1 {
  font-size: 16px;
  font-weight: bold;
}

#header-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  background: #f0e0d6;
  border: 1px solid #800000;
  color: #800000;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}

.btn:hover {
  background: #fff;
}

.btn:active {
  background: #ddd;
}

/* メインエリア */
#main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左サイドバー - ツール */
#left-sidebar {
  width: 200px;
  background: #f0e0d6;
  border-right: 1px solid #800000;
  overflow-y: auto;
  flex-shrink: 0;
}

.panel {
  border-bottom: 1px solid #d9bfb7;
  padding: 8px;
}

.panel-title {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 6px;
  color: #800000;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.tool-btn {
  background: #fff;
  border: 2px solid #d9bfb7;
  padding: 8px;
  cursor: pointer;
  text-align: center;
  font-size: 11px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: #ffffee;
  border-color: #800000;
}

.tool-btn.active {
  background: #ea8;
  border-color: #800000;
  font-weight: bold;
}

/* カラーピッカー */
.color-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.color-box {
  width: 40px;
  height: 40px;
  border: 2px solid #800000;
  cursor: pointer;
}

.color-info {
  flex: 1;
  font-size: 11px;
}

.color-preset {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  margin-top: 6px;
}

.color-preset-item {
  width: 20px;
  height: 20px;
  border: 1px solid #ccc;
  cursor: pointer;
}

.color-preset-item:hover {
  border-color: #800000;
  transform: scale(1.1);
}

/* スライダー */
.slider-row {
  margin-bottom: 8px;
}

.slider-label {
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}

input[type="range"] {
  width: 100%;
}

/* キャンバスエリア */
#canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0e0e0;
  position: relative;
  overflow: hidden;
}

#canvas-container {
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
}

#main-canvas, #temp-canvas {
  display: block;
  cursor: crosshair;
  image-rendering: pixelated;
}

#temp-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

/* 右サイドバー - レイヤー */
#right-sidebar {
  width: 220px;
  background: #f0e0d6;
  border-left: 1px solid #800000;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

#layer-controls {
  padding: 8px;
  border-bottom: 1px solid #d9bfb7;
  display: flex;
  gap: 4px;
}

.layer-btn {
  flex: 1;
  background: #fff;
  border: 1px solid #800000;
  color: #800000;
  padding: 4px;
  cursor: pointer;
  font-size: 11px;
}

.layer-btn:hover {
  background: #ffffee;
}

#layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.layer-item {
  background: #fff;
  border: 2px solid #d9bfb7;
  margin-bottom: 4px;
  padding: 6px;
  cursor: pointer;
  user-select: none;
}

.layer-item:hover {
  border-color: #800000;
}

.layer-item.active {
  background: #ea8;
  border-color: #800000;
}

.layer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.layer-name {
  font-size: 11px;
  font-weight: bold;
  flex: 1;
}

.layer-visibility {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.layer-opacity {
  font-size: 10px;
  margin-top: 2px;
}

.layer-opacity input {
  width: 100%;
}

/* ステータスバー */
#status-bar {
  background: #ea8;
  border-top: 1px solid #800000;
  padding: 4px 12px;
  font-size: 11px;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}

/* モーダル */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  align-items: center;
  justify-content: center;
}

.modal.show {
  display: flex;
}

.modal-content {
  background: #f0e0d6;
  border: 2px solid #800000;
  padding: 20px;
  max-width: 400px;
  width: 90%;
}

.modal-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #800000;
}

.modal-body {
  margin-bottom: 16px;
}

.modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
}

.input-group input {
  width: 100%;
  padding: 4px;
  border: 1px solid #800000;
  font-family: inherit;
}
</style>
</head>
<body>

<div id="app">
  <!-- ヘッダー -->
  <div id="header">
    <h1>🎨 ふたば風お絵かきツール</h1>
    <div id="header-buttons">
      <button class="btn" id="btn-new">新規</button>
      <button class="btn" id="btn-resize">サイズ変更</button>
      <button class="btn" id="btn-export">保存</button>
      <button class="btn" id="btn-post" style="background:#ea8;font-weight:bold;">めぶきに投稿</button>
    </div>
  </div>

  <!-- メインエリア -->
  <div id="main">
    <!-- 左サイドバー -->
    <div id="left-sidebar">
      <!-- ツール -->
      <div class="panel">
        <div class="panel-title">ツール</div>
        <div class="tool-grid">
          <div class="tool-btn active" data-tool="pen">🖊️ ペン</div>
          <div class="tool-btn" data-tool="pencil">✏️ 鉛筆</div>
          <div class="tool-btn" data-tool="watercolor">💧 水彩</div>
          <div class="tool-btn" data-tool="airbrush">💨 エアブラシ</div>
          <div class="tool-btn" data-tool="eraser">🧹 消しゴム</div>
          <div class="tool-btn" data-tool="bucket">🪣 塗りつぶし</div>
          <div class="tool-btn" data-tool="eyedropper">💉 スポイト</div>
        </div>
      </div>

      <!-- カラー -->
      <div class="panel">
        <div class="panel-title">カラー</div>
        <div class="color-row">
          <div class="color-box" id="current-color" style="background:#000"></div>
          <div class="color-info">
            <div>現在: <span id="color-hex">#000000</span></div>
            <input type="color" id="color-picker" value="#000000" style="width:100%;margin-top:4px;">
          </div>
        </div>
        <div class="color-preset" id="color-preset"></div>
      </div>

      <!-- ブラシ設定 -->
      <div class="panel">
        <div class="panel-title">ブラシ設定</div>
        <div class="slider-row">
          <div class="slider-label">
            <span>サイズ</span>
            <span id="size-value">10</span>
          </div>
          <input type="range" id="brush-size" min="1" max="100" value="10">
        </div>
        <div class="slider-row">
          <div class="slider-label">
            <span>不透明度</span>
            <span id="opacity-value">100%</span>
          </div>
          <input type="range" id="brush-opacity" min="1" max="100" value="100">
        </div>
      </div>

      <!-- 変形 -->
      <div class="panel">
        <div class="panel-title">変形</div>
        <div class="tool-grid">
          <button class="btn" id="btn-flip-h" title="H">↔️ 左右反転</button>
          <button class="btn" id="btn-flip-v" title="Shift+H">↕️ 上下反転</button>
          <button class="btn" id="btn-rotate-l">↺ 左回転</button>
          <button class="btn" id="btn-rotate-r">↻ 右回転</button>
        </div>
        <div style="font-size:10px;margin-top:6px;color:#666;">
          ホイール:拡縮<br>
          Shift+ドラッグ:回転/拡縮
        </div>
      </div>
    </div>

    <!-- キャンバスエリア -->
    <div id="canvas-area">
      <div id="canvas-container">
        <canvas id="main-canvas" width="400" height="400"></canvas>
        <canvas id="temp-canvas" width="400" height="400"></canvas>
      </div>
    </div>

    <!-- 右サイドバー -->
    <div id="right-sidebar">
      <div class="panel-title" style="padding:8px;">レイヤー</div>
      <div id="layer-controls">
        <button class="layer-btn" id="btn-add-layer">➕</button>
        <button class="layer-btn" id="btn-duplicate-layer">📋</button>
        <button class="layer-btn" id="btn-delete-layer">🗑️</button>
      </div>
      <div id="layer-list"></div>
    </div>
  </div>

  <!-- ステータスバー -->
  <div id="status-bar">
    <div id="cursor-pos">x: 0, y: 0</div>
    <div id="zoom-level">100%</div>
  </div>
</div>

<!-- サイズ変更モーダル -->
<div class="modal" id="resize-modal">
  <div class="modal-content">
    <div class="modal-title">キャンバスサイズ変更</div>
    <div class="modal-body">
      <div class="input-group">
        <label>幅</label>
        <input type="number" id="resize-width" value="400" min="1" max="2000">
      </div>
      <div class="input-group">
        <label>高さ</label>
        <input type="number" id="resize-height" value="400" min="1" max="2000">
      </div>
    </div>
    <div class="modal-buttons">
      <button class="btn" id="resize-cancel">キャンセル</button>
      <button class="btn" id="resize-ok">OK</button>
    </div>
  </div>
</div>

<script>
// ==================== グローバル変数 ====================
const app = {
  canvas: null,
  ctx: null,
  tempCanvas: null,
  tempCtx: null,
  layers: [],
  currentLayerIndex: 0,
  tool: 'pen',
  color: '#000000',
  brushSize: 10,
  brushOpacity: 100,
  isDrawing: false,
  lastX: 0,
  lastY: 0,
  history: [],
  historyIndex: -1,
  zoom: 1,
  rotation: 0,
  dragStartX: 0,
  dragStartY: 0,
  canvasWidth: 400,
  canvasHeight: 400
};

// カラープリセット
const colorPresets = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#808080', '#800080', '#008000', '#000080', '#808000', '#008080', '#C0C0C0'
];

// ==================== 初期化 ====================
function init() {
  app.canvas = document.getElementById('main-canvas');
  app.ctx = app.canvas.getContext('2d', { willReadFrequently: true });
  app.tempCanvas = document.getElementById('temp-canvas');
  app.tempCtx = app.tempCanvas.getContext('2d');
  
  // 初期レイヤー作成
  addLayer();
  
  // カラープリセット描画
  const presetContainer = document.getElementById('color-preset');
  colorPresets.forEach(color => {
    const div = document.createElement('div');
    div.className = 'color-preset-item';
    div.style.background = color;
    div.onclick = () => setColor(color);
    presetContainer.appendChild(div);
  });
  
  // イベントリスナー
  setupEventListeners();
  
  // レイヤーUI更新
  updateLayerUI();
  
  // 初期履歴
  saveHistory();
}

// ==================== レイヤー管理 ====================
function addLayer(name) {
  const canvas = document.createElement('canvas');
  canvas.width = app.canvasWidth;
  canvas.height = app.canvasHeight;
  const ctx = canvas.getContext('2d');
  
  const layer = {
    canvas: canvas,
    ctx: ctx,
    name: name || `レイヤー ${app.layers.length + 1}`,
    visible: true,
    opacity: 100
  };
  
  app.layers.push(layer);
  app.currentLayerIndex = app.layers.length - 1;
  updateLayerUI();
  composeLayers();
}

function deleteLayer() {
  if (app.layers.length <= 1) {
    alert('最後のレイヤーは削除できません');
    return;
  }
  app.layers.splice(app.currentLayerIndex, 1);
  app.currentLayerIndex = Math.min(app.currentLayerIndex, app.layers.length - 1);
  updateLayerUI();
  composeLayers();
  saveHistory();
}

function duplicateLayer() {
  const src = app.layers[app.currentLayerIndex];
  const canvas = document.createElement('canvas');
  canvas.width = app.canvasWidth;
  canvas.height = app.canvasHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src.canvas, 0, 0);
  
  const layer = {
    canvas: canvas,
    ctx: ctx,
    name: src.name + ' コピー',
    visible: true,
    opacity: src.opacity
  };
  
  app.layers.splice(app.currentLayerIndex + 1, 0, layer);
  app.currentLayerIndex++;
  updateLayerUI();
  composeLayers();
  saveHistory();
}

function updateLayerUI() {
  const list = document.getElementById('layer-list');
  list.innerHTML = '';
  
  for (let i = app.layers.length - 1; i >= 0; i--) {
    const layer = app.layers[i];
    const div = document.createElement('div');
    div.className = 'layer-item' + (i === app.currentLayerIndex ? ' active' : '');
    div.onclick = () => {
      app.currentLayerIndex = i;
      updateLayerUI();
    };
    
    div.innerHTML = `
      <div class="layer-header">
        <span class="layer-name">${layer.name}</span>
        <button class="layer-visibility">${layer.visible ? '👁️' : '🚫'}</button>
      </div>
      <div class="layer-opacity">
        不透明度: ${layer.opacity}%
        <input type="range" min="0" max="100" value="${layer.opacity}">
      </div>
    `;
    
    const visBtn = div.querySelector('.layer-visibility');
    visBtn.onclick = (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      updateLayerUI();
      composeLayers();
    };
    
    const opacitySlider = div.querySelector('input[type="range"]');
    opacitySlider.oninput = (e) => {
      e.stopPropagation();
      layer.opacity = parseInt(e.target.value);
      composeLayers();
    };
    
    list.appendChild(div);
  }
}

function composeLayers() {
  app.ctx.clearRect(0, 0, app.canvasWidth, app.canvasHeight);
  
  app.layers.forEach(layer => {
    if (!layer.visible) return;
    
    app.ctx.save();
    app.ctx.globalAlpha = layer.opacity / 100;
    app.ctx.drawImage(layer.canvas, 0, 0);
    app.ctx.restore();
  });
}

function getCurrentLayer() {
  return app.layers[app.currentLayerIndex];
}

// ==================== 描画 ====================
function startDrawing(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  
  app.isDrawing = true;
  const pos = getCanvasPos(e);
  app.lastX = pos.x;
  app.lastY = pos.y;
  
  if (app.tool === 'eyedropper') {
    pickColor(pos.x, pos.y);
    app.isDrawing = false;
    return;
  }
  
  if (app.tool === 'bucket') {
    floodFill(pos.x, pos.y);
    app.isDrawing = false;
    saveHistory();
    return;
  }
  
  // 描画開始
  draw(pos.x, pos.y, e.pressure || 0.5);
}

function drawing(e) {
  if (!app.isDrawing) return;
  
  const pos = getCanvasPos(e);
  const pressure = e.pressure || 0.5;
  
  if (e.shiftKey && e.buttons === 1) {
    // Shift押しながらドラッグで回転/拡縮
    const dx = pos.x - app.dragStartX;
    const dy = pos.y - app.dragStartY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // 左右で回転
      app.rotation += dx * 0.5;
    } else {
      // 上下で拡縮
      app.zoom += dy * 0.01;
      app.zoom = Math.max(0.1, Math.min(5, app.zoom));
    }
    
    app.dragStartX = pos.x;
    app.dragStartY = pos.y;
    updateCanvas();
    return;
  }
  
  // 通常の描画
  drawLine(app.lastX, app.lastY, pos.x, pos.y, pressure);
  
  app.lastX = pos.x;
  app.lastY = pos.y;
}

function stopDrawing() {
  if (app.isDrawing) {
    app.isDrawing = false;
    composeLayers();
    saveHistory();
  }
}

function draw(x, y, pressure) {
  const layer = getCurrentLayer();
  const ctx = layer.ctx;
  
  ctx.save();
  ctx.globalCompositeOperation = app.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = (app.brushOpacity / 100) * pressure;
  
  const size = app.brushSize * pressure;
  
  switch(app.tool) {
    case 'pen':
      ctx.fillStyle = app.color;
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'pencil':
      ctx.fillStyle = app.color;
      for (let i = 0; i < 3; i++) {
        const ox = (Math.random() - 0.5) * size * 0.3;
        const oy = (Math.random() - 0.5) * size * 0.3;
        ctx.globalAlpha = (app.brushOpacity / 100) * pressure * 0.4;
        ctx.fillRect(x + ox, y + oy, 1, 1);
      }
      break;
      
    case 'watercolor':
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, app.color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'airbrush':
      ctx.fillStyle = app.color;
      for (let i = 0; i < size * 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * size;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        ctx.globalAlpha = (app.brushOpacity / 100) * pressure * 0.1;
        ctx.fillRect(px, py, 1, 1);
      }
      break;
      
    case 'eraser':
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  
  ctx.restore();
  composeLayers();
}

function drawLine(x1, y1, x2, y2, pressure) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(dist / 2));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    draw(x, y, pressure);
  }
}

function getCanvasPos(e) {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - rect.left) / rect.width * app.canvasWidth),
    y: Math.floor((e.clientY - rect.top) / rect.height * app.canvasHeight)
  };
}

// ==================== ツール ====================
function pickColor(x, y) {
  const imageData = app.ctx.getImageData(x, y, 1, 1);
  const [r, g, b] = imageData.data;
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  setColor(hex);
}

function floodFill(x, y) {
  const layer = getCurrentLayer();
  const ctx = layer.ctx;
  const imageData = ctx.getImageData(0, 0, app.canvasWidth, app.canvasHeight);
  const data = imageData.data;
  
  const targetColor = getPixelColor(data, x, y);
  const fillColor = hexToRgb(app.color);
  
  if (colorsMatch(targetColor, fillColor)) return;
  
  const stack = [[x, y]];
  const visited = new Set();
  
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    
    if (visited.has(key)) continue;
    if (cx < 0 || cx >= app.canvasWidth || cy < 0 || cy >= app.canvasHeight) continue;
    
    const currentColor = getPixelColor(data, cx, cy);
    if (!colorsMatch(currentColor, targetColor)) continue;
    
    visited.add(key);
    setPixelColor(data, cx, cy, fillColor);
    
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  
  ctx.putImageData(imageData, 0, 0);
  composeLayers();
}

function getPixelColor(data, x, y) {