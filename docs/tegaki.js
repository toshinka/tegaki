// tegaki.js - 改修版お絵かきツール
(function() {
  'use strict';

  // グローバルステート
  const state = {
    tool: 'pen', // 'pen', 'eraser', 'bucket'
    color: '#800000',
    penSize: 2,
    eraserSize: 20,
    penOpacity: 1,
    eraserOpacity: 1,
    pressure: true,
    smoothing: 0.5,
    activeLayer: 1,
    layers: [],
    history: [],
    historyIndex: -1,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    lastPressure: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 }
  };

  // UI要素の作成
  function createUI() {
    // メインコンテナ
    const container = document.createElement('div');
    container.id = 'tegaki-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      flex-direction: column;
    `;

    // トップバー
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      height: 50px;
      background: #d4b5a8;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 15px;
    `;

    // トップバー左側（削除ボタン等）
    const topLeft = document.createElement('div');
    topLeft.style.cssText = 'display: flex; gap: 10px; align-items: center;';
    
    const undoBtn = createIconButton(svgIcons.undo, 'Undo (Ctrl+Z)');
    const redoBtn = createIconButton(svgIcons.redo, 'Redo (Ctrl+U)');
    const trashBtn = createIconButton(svgIcons.trash, 'Delete Layer (Del)');
    
    topLeft.appendChild(undoBtn);
    topLeft.appendChild(redoBtn);
    topLeft.appendChild(trashBtn);

    // トップバー中央（変形ボタン）
    const topCenter = document.createElement('div');
    topCenter.style.cssText = 'display: flex; gap: 10px; align-items: center; margin: 0 auto;';
    
    const flipHBtn = createIconButton(svgIcons.flipHorizontal, 'Flip Horizontal');
    const flipVBtn = createIconButton(svgIcons.flipVertical, 'Flip Vertical');
    const rotateBtn = createIconButton(svgIcons.rotateCw, 'Rotate (Shift+Wheel)');
    const zoomInBtn = createIconButton(svgIcons.scaling, 'Zoom In');
    const zoomOutBtn = createIconButton(svgIcons.scaling, 'Zoom Out');
    const resetBtn = createIconButton(svgIcons.fullscreen, 'Reset Position');
    
    topCenter.appendChild(flipHBtn);
    topCenter.appendChild(flipVBtn);
    topCenter.appendChild(rotateBtn);
    topCenter.appendChild(zoomInBtn);
    topCenter.appendChild(zoomOutBtn);
    topCenter.appendChild(resetBtn);

    // トップバー右側（閉じるボタン）
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      width: 30px;
      height: 30px;
      border: none;
      background: #c19a88;
      cursor: pointer;
      font-size: 20px;
      border-radius: 5px;
    `;
    closeBtn.onclick = closeTegaki;

    topBar.appendChild(topLeft);
    topBar.appendChild(topCenter);
    topBar.appendChild(closeBtn);

    // メインエリア
    const mainArea = document.createElement('div');
    mainArea.style.cssText = `
      flex: 1;
      display: flex;
      position: relative;
      background: #f5e6d3;
    `;

    // 左サイドバー
    const leftSidebar = createLeftSidebar();

    // キャンバスエリア
    const canvasArea = document.createElement('div');
    canvasArea.id = 'canvas-area';
    canvasArea.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    `;

    // ショートカット説明
    const shortcuts = document.createElement('div');
    shortcuts.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.7);
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      line-height: 1.6;
      pointer-events: none;
    `;
    shortcuts.innerHTML = `
      <b>Shortcuts:</b><br>
      P: Pen | E: Eraser<br>
      Ctrl+Z: Undo | Ctrl+U: Redo<br>
      Del: Delete Layer<br>
      Wheel: Zoom | Shift+Wheel: Rotate<br>
      Space+Drag: Move Canvas
    `;
    canvasArea.appendChild(shortcuts);

    // キャンバスコンテナ（白い縁付き）
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-container';
    canvasContainer.style.cssText = `
      position: relative;
      box-shadow: 0 0 20px rgba(0,0,0,0.3);
      background: white;
      padding: 20px;
    `;

    const canvas = document.createElement('canvas');
    canvas.id = 'main-canvas';
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.cssText = 'display: block; background: white;';
    
    canvasContainer.appendChild(canvas);
    canvasArea.appendChild(canvasContainer);

    // 右サイドバー（レイヤー）
    const rightSidebar = createRightSidebar();

    mainArea.appendChild(leftSidebar);
    mainArea.appendChild(canvasArea);
    mainArea.appendChild(rightSidebar);

    container.appendChild(topBar);
    container.appendChild(mainArea);

    return container;
  }

  // 左サイドバーの作成
  function createLeftSidebar() {
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 60px;
      background: #e8d4c4;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 5px;
      gap: 5px;
    `;

    // カラーパレット
    const colorPalette = createColorPalette();
    sidebar.appendChild(colorPalette);

    // ツールボタン
    const penBtn = createToolButton(svgIcons.pen, 'Pen (P)', 'pen');
    const eraserBtn = createToolButton(svgIcons.eraser, 'Eraser (E)', 'eraser');
    const bucketBtn = createToolButton(svgIcons.bucket, 'Fill Bucket', 'bucket');
    
    sidebar.appendChild(penBtn);
    sidebar.appendChild(eraserBtn);
    sidebar.appendChild(bucketBtn);

    // ペンサイズスロット
    const sizeSlot = createSizeSlot();
    sidebar.appendChild(sizeSlot);

    // スペーサー
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    sidebar.appendChild(spacer);

    // 設定ボタン
    const settingsBtn = createToolButton(svgIcons.settings, 'Settings', 'settings');
    sidebar.appendChild(settingsBtn);

    return sidebar;
  }

  // カラーパレットの作成
  function createColorPalette() {
    const container = document.createElement('div');
    container.style.cssText = 'position: relative; margin-bottom: 5px;';

    const colorBtn = document.createElement('button');
    colorBtn.style.cssText = `
      width: 50px;
      height: 50px;
      border: 3px solid #800000;
      border-radius: 50%;
      background: ${state.color};
      cursor: pointer;
      position: relative;
    `;

    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '▲';
    expandBtn.style.cssText = `
      position: absolute;
      bottom: -5px;
      right: -5px;
      width: 20px;
      height: 20px;
      border: 2px solid #800000;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    expandBtn.onclick = () => showColorPicker(colorBtn);

    container.appendChild(colorBtn);
    container.appendChild(expandBtn);

    return container;
  }

  // カラーピッカーの表示
  function showColorPicker(colorBtn) {
    const picker = document.createElement('div');
    picker.style.cssText = `
      position: absolute;
      left: 70px;
      top: 10px;
      background: #d4b5a8;
      padding: 15px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
    `;

    // 基本色
    const colors = [
      '#800000', '#FF0000', '#FFFF00', '#00FF00',
      '#00FFFF', '#0000FF', '#FF00FF', '#000000', '#FFFFFF'
    ];

    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;';

    colors.forEach(color => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 30px;
        height: 30px;
        border: 2px solid #666;
        border-radius: 5px;
        background: ${color};
        cursor: pointer;
      `;
      btn.onclick = () => {
        state.color = color;
        colorBtn.style.background = color;
        picker.remove();
      };
      colorGrid.appendChild(btn);
    });

    picker.appendChild(colorGrid);

    // HTMLカラーピッカー
    const input = document.createElement('input');
    input.type = 'color';
    input.value = state.color;
    input.style.cssText = 'width: 100%; height: 30px; cursor: pointer; border: none;';
    input.onchange = (e) => {
      state.color = e.target.value;
      colorBtn.style.background = e.target.value;
    };
    picker.appendChild(input);

    // スポイト
    const eyedropperBtn = document.createElement('button');
    eyedropperBtn.innerHTML = svgIcons.pipette;
    eyedropperBtn.title = 'Eyedropper';
    eyedropperBtn.style.cssText = `
      width: 100%;
      height: 30px;
      margin-top: 10px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 5px;
    `;
    picker.appendChild(eyedropperBtn);

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      width: 100%;
      height: 25px;
      margin-top: 10px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 5px;
    `;
    closeBtn.onclick = () => picker.remove();
    picker.appendChild(closeBtn);

    document.body.appendChild(picker);
  }

  // サイズスロットの作成
  function createSizeSlot() {
    const container = document.createElement('div');
    container.id = 'size-slot';
    container.style.cssText = 'position: relative; margin-top: 10px;';

    const sizeBtn = document.createElement('button');
    sizeBtn.style.cssText = `
      width: 50px;
      height: 50px;
      border: 2px solid #800000;
      border-radius: 10px;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    `;

    const sizeCircle = document.createElement('div');
    sizeCircle.style.cssText = `
      width: ${state.penSize * 2}px;
      height: ${state.penSize * 2}px;
      max-width: 40px;
      max-height: 40px;
      border-radius: 50%;
      background: #800000;
    `;
    sizeBtn.appendChild(sizeCircle);

    const expandBtn = document.createElement('button');
    expandBtn.innerHTML = '▲';
    expandBtn.style.cssText = `
      position: absolute;
      bottom: -5px;
      right: -5px;
      width: 20px;
      height: 20px;
      border: 2px solid #800000;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      font-size: 10px;
    `;

    expandBtn.onclick = () => showSizeSlider(sizeCircle);

    container.appendChild(sizeBtn);
    container.appendChild(expandBtn);

    return container;
  }

  // サイズスライダーの表示
  function showSizeSlider(sizeCircle) {
    const isEraser = state.tool === 'eraser';
    const currentSize = isEraser ? state.eraserSize : state.penSize;
    const currentOpacity = isEraser ? state.eraserOpacity : state.penOpacity;

    const slider = document.createElement('div');
    slider.style.cssText = `
      position: absolute;
      left: 70px;
      top: 150px;
      background: #d4b5a8;
      padding: 15px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      width: 200px;
    `;

    // サイズ
    const sizeLabel = document.createElement('div');
    sizeLabel.textContent = `Size: ${currentSize.toFixed(1)}`;
    sizeLabel.style.cssText = 'margin-bottom: 5px; font-size: 12px;';
    slider.appendChild(sizeLabel);

    const sizeControls = document.createElement('div');
    sizeControls.style.cssText = 'display: flex; align-items: center; gap: 5px; margin-bottom: 15px;';

    const sizeDown = document.createElement('button');
    sizeDown.innerHTML = '◀';
    sizeDown.style.cssText = 'width: 25px; height: 25px; cursor: pointer; border: 1px solid #800000; background: white; border-radius: 3px;';
    sizeDown.onclick = () => {
      const newSize = Math.max(0.1, currentSize - 0.1);
      if (isEraser) state.eraserSize = newSize;
      else state.penSize = newSize;
      sizeLabel.textContent = `Size: ${newSize.toFixed(1)}`;
      sizeInput.value = newSize;
      updateSizeCircle(sizeCircle);
    };

    const sizeInput = document.createElement('input');
    sizeInput.type = 'range';
    sizeInput.min = '0.1';
    sizeInput.max = '50';
    sizeInput.step = '0.1';
    sizeInput.value = currentSize;
    sizeInput.style.cssText = 'flex: 1;';
    sizeInput.oninput = (e) => {
      const val = parseFloat(e.target.value);
      if (isEraser) state.eraserSize = val;
      else state.penSize = val;
      sizeLabel.textContent = `Size: ${val.toFixed(1)}`;
      updateSizeCircle(sizeCircle);
    };

    const sizeUp = document.createElement('button');
    sizeUp.innerHTML = '▶';
    sizeUp.style.cssText = 'width: 25px; height: 25px; cursor: pointer; border: 1px solid #800000; background: white; border-radius: 3px;';
    sizeUp.onclick = () => {
      const newSize = Math.min(50, currentSize + 0.1);
      if (isEraser) state.eraserSize = newSize;
      else state.penSize = newSize;
      sizeLabel.textContent = `Size: ${newSize.toFixed(1)}`;
      sizeInput.value = newSize;
      updateSizeCircle(sizeCircle);
    };

    sizeControls.appendChild(sizeDown);
    sizeControls.appendChild(sizeInput);
    sizeControls.appendChild(sizeUp);
    slider.appendChild(sizeControls);

    // 不透明度
    const opacityLabel = document.createElement('div');
    opacityLabel.textContent = `Opacity: ${(currentOpacity * 100).toFixed(0)}%`;
    opacityLabel.style.cssText = 'margin-bottom: 5px; font-size: 12px;';
    slider.appendChild(opacityLabel);

    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '0';
    opacityInput.max = '1';
    opacityInput.step = '0.01';
    opacityInput.value = currentOpacity;
    opacityInput.style.cssText = 'width: 100%;';
    opacityInput.oninput = (e) => {
      const val = parseFloat(e.target.value);
      if (isEraser) state.eraserOpacity = val;
      else state.penOpacity = val;
      opacityLabel.textContent = `Opacity: ${(val * 100).toFixed(0)}%`;
    };
    slider.appendChild(opacityInput);

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      width: 100%;
      height: 25px;
      margin-top: 10px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 5px;
    `;
    closeBtn.onclick = () => slider.remove();
    slider.appendChild(closeBtn);

    document.body.appendChild(slider);
  }

  // サイズサークルの更新
  function updateSizeCircle(sizeCircle) {
    const size = state.tool === 'eraser' ? state.eraserSize : state.penSize;
    const displaySize = Math.min(size * 2, 40);
    sizeCircle.style.width = displaySize + 'px';
    sizeCircle.style.height = displaySize + 'px';
  }

  // 右サイドバー（レイヤー）の作成
  function createRightSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'right-sidebar';
    sidebar.style.cssText = `
      width: 120px;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px;
    `;

    // レイヤーコントロール
    const layerControls = document.createElement('div');
    layerControls.style.cssText = 'display: flex; gap: 5px; margin-bottom: 10px;';

    const addLayerBtn = createSmallIconButton(svgIcons.copyPlus, 'Add Layer');
    addLayerBtn.onclick = addLayer;
    
    const removeLayerBtn = createSmallIconButton(svgIcons.trash, 'Remove Layer');
    removeLayerBtn.onclick = removeLayer;

    layerControls.appendChild(addLayerBtn);
    layerControls.appendChild(removeLayerBtn);
    sidebar.appendChild(layerControls);

    // レイヤーリスト
    const layerList = document.createElement('div');
    layerList.id = 'layer-list';
    layerList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
      width: 100%;
      align-items: center;
    `;
    sidebar.appendChild(layerList);

    return sidebar;
  }

  // アイコンボタンの作成
  function createIconButton(svg, title) {
    const btn = document.createElement('button');
    btn.innerHTML = svg;
    btn.title = title;
    btn.style.cssText = `
      width: 30px;
      height: 30px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px;
    `;
    btn.querySelector('svg').style.cssText = 'width: 100%; height: 100%;';
    return btn;
  }

  // 小さいアイコンボタン
  function createSmallIconButton(svg, title) {
    const btn = document.createElement('button');
    btn.innerHTML = svg;
    btn.title = title;
    btn.style.cssText = `
      width: 24px;
      height: 24px;
      border: 1px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 3px;
      padding: 2px;
    `;
    btn.querySelector('svg').style.cssText = 'width: 100%; height: 100%;';
    return btn;
  }

  // ツールボタンの作成
  function createToolButton(svg, title, tool) {
    const btn = document.createElement('button');
    btn.innerHTML = svg;
    btn.title = title;
    btn.dataset.tool = tool;
    btn.style.cssText = `
      width: 50px;
      height: 50px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 10px;
      padding: 8px;
    `;
    btn.querySelector('svg').style.cssText = 'width: 100%; height: 100%;';
    
    btn.onclick = () => {
      state.tool = tool;
      updateToolButtons();
      if (tool !== 'settings') {
        updateSizeSlot();
      } else {
        showSettings();
      }
    };
    
    return btn;
  }

  // ツールボタンの状態更新
  function updateToolButtons() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      if (btn.dataset.tool === state.tool) {
        btn.style.background = '#f0e0d0';
      } else {
        btn.style.background = 'white';
      }
    });
  }

  // サイズスロットの更新
  function updateSizeSlot() {
    const sizeCircle = document.querySelector('#size-slot .size-circle');
    if (sizeCircle) {
      updateSizeCircle(sizeCircle);
    }
  }

  // 設定ダイアログの表示
  function showSettings() {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #d4b5a8;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 10000;
      min-width: 300px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Settings';
    title.style.cssText = 'margin: 0 0 15px 0;';
    dialog.appendChild(title);

    // 筆圧感知
    const pressureDiv = document.createElement('div');
    pressureDiv.style.cssText = 'margin-bottom: 15px;';
    
    const pressureCheck = document.createElement('input');
    pressureCheck.type = 'checkbox';
    pressureCheck.id = 'pressure-check';
    pressureCheck.checked = state.pressure;
    pressureCheck.onchange = (e) => state.pressure = e.target.checked;
    
    const pressureLabel = document.createElement('label');
    pressureLabel.htmlFor = 'pressure-check';
    pressureLabel.textContent = ' Enable Pressure Sensitivity';
    
    pressureDiv.appendChild(pressureCheck);
    pressureDiv.appendChild(pressureLabel);
    dialog.appendChild(pressureDiv);

    // 手ブレ補正
    const smoothDiv = document.createElement('div');
    smoothDiv.style.cssText = 'margin-bottom: 15px;';
    
    const smoothLabel = document.createElement('div');
    smoothLabel.textContent = `Smoothing: ${(state.smoothing * 100).toFixed(0)}%`;
    smoothLabel.style.cssText = 'margin-bottom: 5px;';
    
    const smoothSlider = document.createElement('input');
    smoothSlider.type = 'range';
    smoothSlider.min = '0';
    smoothSlider.max = '1';
    smoothSlider.step = '0.01';
    smoothSlider.value = state.smoothing;
    smoothSlider.style.cssText = 'width: 100%;';
    smoothSlider.oninput = (e) => {
      state.smoothing = parseFloat(e.target.value);
      smoothLabel.textContent = `Smoothing: ${(state.smoothing * 100).toFixed(0)}%`;
    };
    
    smoothDiv.appendChild(smoothLabel);
    smoothDiv.appendChild(smoothSlider);
    dialog.appendChild(smoothDiv);

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      width: 100%;
      height: 30px;
      border: 2px solid #800000;
      background: white;
      cursor: pointer;
      border-radius: 5px;
      margin-top: 10px;
    `;
    closeBtn.onclick = () => dialog.remove();
    dialog.appendChild(closeBtn);

    document.body.appendChild(dialog);
  }

  // レイヤー追加
  function addLayer() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    state.layers.push({
      canvas: canvas,
      ctx: ctx,
      visible: true,
      opacity: 1
    });
    
    state.activeLayer = state.layers.length - 1;
    updateLayerList();
    saveHistory();
  }

  // レイヤー削除
  function removeLayer() {
    if (state.layers.length > 1 && state.activeLayer > 0) {
      state.layers.splice(state.activeLayer, 1);
      state.activeLayer = Math.max(0, state.activeLayer - 1);
      updateLayerList();
      renderCanvas();
      saveHistory();
    }
  }

  // レイヤーリストの更新
  function updateLayerList() {
    const layerList = document.getElementById('layer-list');
    layerList.innerHTML = '';

    state.layers.slice().reverse().forEach((layer, i) => {
      const realIndex = state.layers.length - 1 - i;
      const layerItem = document.createElement('div');
      layerItem.style.cssText = `
        width: 100px;
        height: 60px;
        border: 2px solid ${realIndex === state.activeLayer ? '#800000' : '#ccc'};
        background: white;
        cursor: pointer;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      `;
      layerItem.textContent = realIndex === 0 ? 'Background' : `Layer ${realIndex}`;
      layerItem.onclick = () => {
        state.activeLayer = realIndex;
        updateLayerList();
      };
      layerList.appendChild(layerItem);
    });
  }

  // キャンバスの初期化
  function initCanvas() {
    // 背景レイヤー
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 800;
    bgCanvas.height = 600;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = 'white';
    bgCtx.fillRect(0, 0, 800, 600);

    // 透明レイヤー
    const layer1Canvas = document.createElement('canvas');
    layer1Canvas.width = 800;
    layer1Canvas.height = 600;
    const layer1Ctx = layer1Canvas.getContext('2d');

    state.layers = [
      { canvas: bgCanvas, ctx: bgCtx, visible: true, opacity: 1 },
      { canvas: layer1Canvas, ctx: layer1Ctx, visible: true, opacity: 1 }
    ];

    state.activeLayer = 1;
    updateLayerList();

    const mainCanvas = document.getElementById('main-canvas');
    setupCanvasEvents(mainCanvas);
    renderCanvas();
  }

  // キャンバスの描画
  function renderCanvas() {
    const mainCanvas = document.getElementById('main-canvas');
    const mainCtx = mainCanvas.getContext('2d');
    
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    
    state.layers.forEach(layer => {
      if (layer.visible) {
        mainCtx.globalAlpha = layer.opacity;
        mainCtx.drawImage(layer.canvas, 0, 0);
      }
    });
    
    mainCtx.globalAlpha = 1;
  }

  // キャンバスイベントの設定
  function setupCanvasEvents(canvas) {
    const container = document.getElementById('canvas-container');
    let isSpacePressed = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // ポインターイベント
    canvas.addEventListener('pointerdown', (e) => {
      if (isSpacePressed || e.button === 1) {
        isDragging = true;
        dragStartX = e.clientX - state.transform.x;
        dragStartY = e.clientY - state.transform.y;
        return;
      }

      state.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      state.lastX = (e.clientX - rect.left) * (canvas.width / rect.width);
      state.lastY = (e.clientY - rect.top) * (canvas.height / rect.height);
      state.lastPressure = e.pressure || 1;

      if (state.tool === 'bucket') {
        floodFill(state.lastX, state.lastY);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (isDragging) {
        state.transform.x = e.clientX - dragStartX;
        state.transform.y = e.clientY - dragStartY;
        updateTransform();
        return;
      }

      if (!state.isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const pressure = state.pressure ? (e.pressure || 1) : 1;

      drawLine(state.lastX, state.lastY, x, y, state.lastPressure, pressure);

      // スムージング
      state.lastX = state.lastX * state.smoothing + x * (1 - state.smoothing);
      state.lastY = state.lastY * state.smoothing + y * (1 - state.smoothing);
      state.lastPressure = pressure;

      renderCanvas();
    });

    canvas.addEventListener('pointerup', () => {
      if (state.isDrawing) {
        state.isDrawing = false;
        saveHistory();
      }
      isDragging = false;
    });

    canvas.addEventListener('pointerleave', () => {
      state.isDrawing = false;
      isDragging = false;
    });

    // ホイールイベント（ズーム・回転）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      if (e.shiftKey) {
        // 回転
        state.transform.rotation += e.deltaY * 0.5;
      } else {
        // ズーム
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        state.transform.scale *= delta;
        state.transform.scale = Math.max(0.1, Math.min(5, state.transform.scale));
      }
      
      updateTransform();
    }, { passive: false });

    // キーボードイベント
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        isSpacePressed = true;
        canvas.style.cursor = 'grab';
      }

      if (e.key === 'p' || e.key === 'P') {
        state.tool = 'pen';
        updateToolButtons();
      }
      if (e.key === 'e' || e.key === 'E') {
        state.tool = 'eraser';
        updateToolButtons();
      }
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          undo();
        }
        if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          redo();
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        clearActiveLayer();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        isSpacePressed = false;
        canvas.style.cursor = 'crosshair';
      }
    });

    // キャンバス外ドラッグ
    const canvasArea = document.getElementById('canvas-area');
    canvasArea.addEventListener('mousedown', (e) => {
      if (e.target === canvasArea) {
        isDragging = true;
        dragStartX = e.clientX - state.transform.x;
        dragStartY = e.clientY - state.transform.y;
      }
    });
  }

  // 線の描画
  function drawLine(x1, y1, x2, y2, pressure1, pressure2) {
    const layer = state.layers[state.activeLayer];
    const ctx = layer.ctx;

    const isEraser = state.tool === 'eraser';
    const baseSize = isEraser ? state.eraserSize : state.penSize;
    const opacity = isEraser ? state.eraserOpacity : state.penOpacity;

    ctx.save();
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : state.color;
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 筆圧による太さの変化
    const size1 = baseSize * (state.pressure ? pressure1 : 1);
    const size2 = baseSize * (state.pressure ? pressure2 : 1);
    const avgSize = (size1 + size2) / 2;

    ctx.lineWidth = avgSize;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  // 塗りつぶし
  function floodFill(x, y) {
    const layer = state.layers[state.activeLayer];
    const ctx = layer.ctx;
    const imageData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const pixels = imageData.data;

    x = Math.floor(x);
    y = Math.floor(y);

    const targetColor = getPixelColor(pixels, x, y, layer.canvas.width);
    const fillColor = hexToRgb(state.color);

    if (colorsMatch(targetColor, fillColor)) return;

    const stack = [[x, y]];
    const visited = new Set();

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;

      if (visited.has(key)) continue;
      if (cx < 0 || cx >= layer.canvas.width || cy < 0 || cy >= layer.canvas.height) continue;

      const currentColor = getPixelColor(pixels, cx, cy, layer.canvas.width);
      if (!colorsMatch(currentColor, targetColor)) continue;

      visited.add(key);
      setPixelColor(pixels, cx, cy, layer.canvas.width, fillColor);

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    renderCanvas();
    saveHistory();
  }

  // ピクセル色の取得
  function getPixelColor(pixels, x, y, width) {
    const index = (y * width + x) * 4;
    return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
  }

  // ピクセル色の設定
  function setPixelColor(pixels, x, y, width, color) {
    const index = (y * width + x) * 4;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = 255;
  }

  // 色の比較
  function colorsMatch(c1, c2) {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3];
  }

  // Hex to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      255
    ] : [0, 0, 0, 255];
  }

  // トランスフォームの適用
  function updateTransform() {
    const container = document.getElementById('canvas-container');
    container.style.transform = `
      translate(${state.transform.x}px, ${state.transform.y}px)
      scale(${state.transform.scale})
      rotate(${state.transform.rotation}deg)
    `;
  }

  // トランスフォームのリセット
  function resetTransform() {
    state.transform = { x: 0, y: 0, scale: 1, rotation: 0 };
    updateTransform();
  }

  // 履歴の保存
  function saveHistory() {
    const snapshot = state.layers.map(layer => {
      const canvas = document.createElement('canvas');
      canvas.width = layer.canvas.width;
      canvas.height = layer.canvas.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(layer.canvas, 0, 0);
      return canvas;
    });

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex++;

    // 履歴の制限
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIndex--;
    }
  }

  // 元に戻す
  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      restoreHistory();
    }
  }

  // やり直す
  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      restoreHistory();
    }
  }

  // 履歴の復元
  function restoreHistory() {
    const snapshot = state.history[state.historyIndex];
    snapshot.forEach((canvas, i) => {
      if (state.layers[i]) {
        const ctx = state.layers[i].ctx;
        ctx.clearRect(0, 0, state.layers[i].canvas.width, state.layers[i].canvas.height);
        ctx.drawImage(canvas, 0, 0);
      }
    });
    renderCanvas();
  }

  // アクティブレイヤーのクリア
  function clearActiveLayer() {
    if (state.activeLayer > 0) {
      const layer = state.layers[state.activeLayer];
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      renderCanvas();
      saveHistory();
    }
  }

  // 閉じる
  function closeTegaki() {
    const container = document.getElementById('tegaki-container');
    if (container) {
      container.remove();
    }
  }

  // SVGアイコン定義
  const svgIcons = {
    pen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
    
    eraser: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>',
    
    bucket: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>',
    
    pipette: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/></svg>',
    
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
    
    copyPlus: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="15" x2="15" y1="12" y2="18"/><line x1="12" x2="18" y1="15" y2="15"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    
    undo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
    
    redo: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></svg>',
    
    flipHorizontal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>',
    
    flipVertical: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m17 3-5 5-5-5h10"/><path d="m17 21-5-5-5 5h10"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/></svg>',
    
    rotateCw: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    
    scaling: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M14 15H9v-5"/><path d="M16 3h5v5"/><path d="M21 3 9 15"/></svg>',
    
    fullscreen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#800000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/></svg>'
  };

  // 起動
  function start() {
    const existing = document.getElementById('tegaki-container');
    if (existing) {
      existing.remove();
    }

    const ui = createUI();
    document.body.appendChild(ui);
    initCanvas();
    updateToolButtons();
  }

  // グローバルに公開
  window.tegakiStart = start;

  // 自動起動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();