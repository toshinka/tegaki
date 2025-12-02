/**
 * ============================================================================
 * ファイル名: raster-brush-engine.js
 * 責務: PixiJS Graphics ベースのラスター描画エンジン
 * 依存:
 *   - pixi.js (外部ライブラリ - libs/pixi.min.js)
 *   - konva (外部ライブラリ - libs/konva.min.js)
 *   - event-bus.js (TegakiEventBus)
 *   - konva-layer-manager.js (KonvaLayerManager)
 *   - pressure-handler.js (PressureHandler - optional)
 *   - pointer-handler.js (PointerHandler - optional)
 *   - brush-settings.js (BrushSettings - optional)
 * 親依存:
 *   - core-engine.js → このファイルを参照
 * 子依存:
 *   - pixi.min.js
 *   - konva.min.js
 *   - event-bus.js
 *   - konva-layer-manager.js
 * 公開API:
 *   - RasterBrushEngine.startStroke(x, y, pressure)
 *   - RasterBrushEngine.updateStroke(x, y, pressure)
 *   - RasterBrushEngine.endStroke()
 * イベント発火:
 *   - 'brush:stroke-started'
 *   - 'brush:stroke-updated'
 *   - 'brush:stroke-completed'
 * イベント受信:
 *   - 'layer:created' → 新レイヤーにRenderTexture割り当て
 * グローバル登録: window.RasterBrushEngine
 * 実装状態: 🆕新規 Phase 2 - 最小ラスター描画
 * ============================================================================
 */

'use strict';

// ========================================
// グローバル依存確認
// ========================================
if (!window.PIXI) {
  throw new Error('PixiJS が読み込まれていません');
}
if (!window.Konva) {
  throw new Error('Konva.js が読み込まれていません');
}
if (!window.TegakiEventBus) {
  throw new Error('EventBus が初期化されていません');
}
if (!window.KonvaLayerManager) {
  throw new Error('KonvaLayerManager が初期化されていません');
}

window.RasterBrushEngine = (() => {
  
  // ========================================
  // プライベート変数
  // ========================================
  const eventBus = window.TegakiEventBus;
  const layerManager = window.KonvaLayerManager;
  const pixiApp = window.pixiApp;
  
  let isDrawing = false;
  let currentLayerId = null;
  let currentRenderTexture = null;
  let currentGraphics = null;
  let strokePoints = [];
  
  // レイヤーごとのRenderTexture管理
  const layerTextures = new Map();  // layerId → { renderTexture, konvaImage }
  
  // ========================================
  // ブラシ設定取得
  // ========================================
  function getBrushSettings() {
    // brushSettings はグローバルインスタンス
    if (window.brushSettings && typeof window.brushSettings.getSettings === 'function') {
      return window.brushSettings.getSettings();
    }
    
    // デフォルト設定
    return {
      size: 10,
      opacity: 1.0,
      color: window.UIComponents?.UI_COLORS?.maroon || '#800000',
      mode: 'pen'
    };
  }
  
  // ========================================
  // 色変換: HEX → 0xRRGGBB
  // ========================================
  function hexToPixiColor(hex) {
    if (typeof hex === 'number') return hex;
    
    const cleaned = hex.replace('#', '');
    return parseInt(cleaned, 16);
  }
  
  // ========================================
  // レイヤー用RenderTexture作成
  // ========================================
  function createRenderTextureForLayer(layerId) {
    if (layerTextures.has(layerId)) {
      return layerTextures.get(layerId);
    }
    
    const config = window.TEGAKI_CONFIG;
    const width = config.canvas.width;
    const height = config.canvas.height;
    
    // PixiJS RenderTexture作成
    const renderTexture = PIXI.RenderTexture.create({
      width: width,
      height: height
    });
    
    // Konva.Image用のCanvas作成
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Konva.Image作成
    const konvaImage = new Konva.Image({
      image: canvas,
      x: 0,
      y: 0,
      width: width,
      height: height
    });
    
    // レイヤーに追加
    const layerData = layerManager.getLayer(layerId);
    if (layerData && layerData.konvaGroup) {
      layerData.konvaGroup.add(konvaImage);
      layerData.konvaGroup.getLayer()?.batchDraw();
    }
    
    // マップに登録
    const textureData = {
      renderTexture,
      konvaImage,
      canvas
    };
    
    layerTextures.set(layerId, textureData);
    
    console.log(`[RasterBrushEngine] RenderTexture created for layer: ${layerId}`);
    
    return textureData;
  }
  
  // ========================================
  // RenderTexture → Canvas転送
  // ========================================
  function transferRenderTextureToCanvas(layerId) {
    const textureData = layerTextures.get(layerId);
    if (!textureData) {
      console.warn('[RasterBrushEngine] No texture data for layer:', layerId);
      return;
    }
    
    const { renderTexture, canvas, konvaImage } = textureData;
    
    // pixiApp確認
    if (!window.pixiApp || !window.pixiApp.renderer) {
      console.error('[RasterBrushEngine] PixiJS renderer not available');
      return;
    }
    
    console.log('[RasterBrushEngine] Transferring to canvas:', {
      layerId,
      canvasSize: `${canvas.width}x${canvas.height}`,
      textureSize: `${renderTexture.width}x${renderTexture.height}`
    });
    
    // PixiJS RenderTextureをCanvasに描画
    const ctx = canvas.getContext('2d');
    
    try {
      // RenderTextureからピクセルデータ取得
      const pixels = window.pixiApp.renderer.extract.pixels(renderTexture);
      
      console.log('[RasterBrushEngine] Extracted pixels:', pixels.length, 'bytes');
      
      // ImageDataに変換
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      imageData.data.set(pixels);
      
      // Canvasに描画
      ctx.putImageData(imageData, 0, 0);
      
      console.log('[RasterBrushEngine] Canvas updated');
      
      // Konva.Imageを更新
      konvaImage.image(canvas);
      const layer = konvaImage.getLayer();
      if (layer) {
        layer.batchDraw();
        console.log('[RasterBrushEngine] Konva layer redrawn');
      } else {
        console.warn('[RasterBrushEngine] Konva image has no parent layer');
      }
    } catch (error) {
      console.error('[RasterBrushEngine] Transfer error:', error);
    }
  }
  
  // ========================================
  // 筆圧処理
  // ========================================
  function processPressure(pressure) {
    // pressureHandler はグローバルインスタンス
    if (window.pressureHandler && typeof window.pressureHandler.process === 'function') {
      return window.pressureHandler.process(pressure);
    }
    return pressure;
  }
  
  // ========================================
  // ストローク開始
  // ========================================
  /**
   * ストローク開始
   * @param {number} x - Canvas X座標
   * @param {number} y - Canvas Y座標
   * @param {number} pressure - 筆圧 0.0-1.0
   */
  function startStroke(x, y, pressure = 1.0) {
    if (isDrawing) return;
    
    // アクティブレイヤー取得
    const allLayers = layerManager.getAllLayers();
    if (allLayers.length === 0) {
      console.warn('[RasterBrushEngine] No layers available');
      return;
    }
    
    // 最後のレイヤーをアクティブとする（Phase 2では簡易実装）
    const activeLayer = allLayers[allLayers.length - 1];
    currentLayerId = activeLayer.id;
    
    console.log('[RasterBrushEngine] Active layer:', {
      layerId: currentLayerId,
      name: activeLayer.name,
      layerCount: allLayers.length
    });
    
    // RenderTexture準備
    const textureData = createRenderTextureForLayer(currentLayerId);
    currentRenderTexture = textureData.renderTexture;
    
    // Graphics初期化
    currentGraphics = new PIXI.Graphics();
    
    // ストロークポイント初期化
    strokePoints = [{
      x: x,
      y: y,
      pressure: processPressure(pressure)
    }];
    
    isDrawing = true;
    
    // 最初のポイントを描画
    drawPoint(x, y, processPressure(pressure));
    
    eventBus.emit('brush:stroke-started', {
      layerId: currentLayerId,
      x, y, pressure
    });
    
    console.log('[RasterBrushEngine] Stroke started:', { x, y, pressure });
  }
  
  // ========================================
  // ストローク更新
  // ========================================
  /**
   * ストローク更新
   * @param {number} x - Canvas X座標
   * @param {number} y - Canvas Y座標
   * @param {number} pressure - 筆圧 0.0-1.0
   */
  function updateStroke(x, y, pressure = 1.0) {
    if (!isDrawing) return;
    
    const processedPressure = processPressure(pressure);
    
    strokePoints.push({
      x: x,
      y: y,
      pressure: processedPressure
    });
    
    // ポイント描画
    drawPoint(x, y, processedPressure);
    
    eventBus.emit('brush:stroke-updated', {
      layerId: currentLayerId,
      x, y, pressure: processedPressure
    });
  }
  
  // ========================================
  // ポイント描画
  // ========================================
  function drawPoint(x, y, pressure) {
    const settings = getBrushSettings();
    const size = settings.size * pressure;
    const color = hexToPixiColor(settings.color);
    const alpha = settings.opacity;
    
    console.log('[RasterBrushEngine] Drawing point:', {
      x, y, pressure, size, color: color.toString(16), alpha
    });
    
    // 円形スタンプ描画
    currentGraphics.circle(x, y, size / 2);
    currentGraphics.fill({
      color: color,
      alpha: alpha
    });
    
    // pixiApp確認
    if (!window.pixiApp || !window.pixiApp.renderer) {
      console.error('[RasterBrushEngine] PixiJS renderer not available');
      return;
    }
    
    // RenderTextureに描画
    window.pixiApp.renderer.render(currentGraphics, {
      renderTexture: currentRenderTexture,
      clear: false
    });
    
    console.log('[RasterBrushEngine] Rendered to RenderTexture');
    
    // Konva.Imageに転送
    transferRenderTextureToCanvas(currentLayerId);
  }
  
  // ========================================
  // ストローク終了
  // ========================================
  /**
   * ストローク終了
   */
  function endStroke() {
    if (!isDrawing) return;
    
    // Graphics破棄
    if (currentGraphics) {
      currentGraphics.destroy();
      currentGraphics = null;
    }
    
    // 最終転送
    transferRenderTextureToCanvas(currentLayerId);
    
    // ストローク情報
    const strokeInfo = {
      layerId: currentLayerId,
      pointCount: strokePoints.length,
      points: [...strokePoints]
    };
    
    // リセット
    isDrawing = false;
    currentLayerId = null;
    currentRenderTexture = null;
    strokePoints = [];
    
    eventBus.emit('brush:stroke-completed', strokeInfo);
    
    console.log('[RasterBrushEngine] Stroke completed:', strokeInfo);
  }
  
  // ========================================
  // ストロークキャンセル
  // ========================================
  function cancelStroke() {
    if (!isDrawing) return;
    
    if (currentGraphics) {
      currentGraphics.destroy();
      currentGraphics = null;
    }
    
    isDrawing = false;
    currentLayerId = null;
    currentRenderTexture = null;
    strokePoints = [];
    
    console.log('[RasterBrushEngine] Stroke cancelled');
  }
  
  // ========================================
  // イベントハンドラー登録
  // ========================================
  function registerEventHandlers() {
    // 新レイヤー作成時
    eventBus.on('layer:created', (data) => {
      const { layerId } = data;
      createRenderTextureForLayer(layerId);
      console.log(`[RasterBrushEngine] Texture prepared for new layer: ${layerId}`);
    });
  }
  
  // ========================================
  // 初期化
  // ========================================
  function initialize() {
    registerEventHandlers();
    
    // 既存レイヤーにRenderTexture割り当て
    const allLayers = layerManager.getAllLayers();
    allLayers.forEach(layer => {
      createRenderTextureForLayer(layer.id);
    });
    
    console.log('[RasterBrushEngine] Initialized with', allLayers.length, 'layers');
  }
  
  // runtime:initialized後に初期化
  eventBus.on('runtime:initialized', () => {
    setTimeout(initialize, 100);
  });
  
  // ========================================
  // 公開API
  // ========================================
  return {
    startStroke,
    updateStroke,
    endStroke,
    cancelStroke,
    get isDrawing() { return isDrawing; }
  };

})();

console.log('✅ RasterBrushEngine Phase 2 loaded (最小ラスター描画)');