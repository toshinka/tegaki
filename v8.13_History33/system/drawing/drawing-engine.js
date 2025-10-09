/**
 * DrawingEngine v2.0 (分割統合版)
 * Perfect Freehand対応ベクターペンエンジン
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // サブモジュール初期化
    this.settings = new window.TegakiDrawing.BrushSettings(config, eventBus);
    this.recorder = new window.TegakiDrawing.StrokeRecorder();
    this.renderer = new window.TegakiDrawing.StrokeRenderer(config);
    this.pressureHandler = new window.TegakiDrawing.PressureHandler();
    this.transformer = new window.TegakiDrawing.StrokeTransformer(config);

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen'; // 'pen' | 'eraser'
    this.currentPath = null;
  }

  /**
   * 描画開始
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  startDrawing(screenX, screenY, pressureOrEvent) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // ストロークオプション取得
    const strokeOptions = this.settings.getStrokeOptions();

    // 新規パス開始
    this.currentPath = this.recorder.startNewPath(
      { x: canvasPoint.x, y: canvasPoint.y, pressure },
      this.currentTool === 'eraser' ? this.config.background.color : this.settings.getBrushColor(),
      this.settings.getBrushSize(),
      this.settings.getBrushOpacity(),
      this.currentTool,
      strokeOptions
    );

    // Graphics作成
    this.currentPath.graphics = new PIXI.Graphics();
    
    this.isDrawing = true;
  }

  /**
   * 描画継続
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // 座標追加
    this.recorder.addPoint(this.currentPath, {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure
    });

    // リアルタイム描画
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity
    };

    this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.graphics
    );
  }

  /**
   * 描画終了
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // パス確定
    this.recorder.finalizePath(this.currentPath);

    // 最終描画
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity
    };

    this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.graphics
    );

    // レイヤーに追加
    this.addPathToActiveLayer(this.currentPath);

    // 筆圧ハンドラーリセット
    this.pressureHandler.reset();

    this.isDrawing = false;
    this.currentPath = null;
  }

  /**
   * アクティブレイヤーにパス追加
   * @param {Object} pathData
   */
  addPathToActiveLayer(pathData) {
    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer) return;

    // レイヤー変形が適用されている場合
    if (activeLayer.transform && !this.transformer.isTransformNonDefault(activeLayer.transform)) {
      const transformedGraphics = this.transformer.applyTransformToPath(
        pathData,
        activeLayer.transform,
        this.config.canvas.width,
        this.config.canvas.height
      );
      
      if (transformedGraphics) {
        pathData.graphics = transformedGraphics;
      }
    }

    // レイヤーに追加
    activeLayer.container.addChild(pathData.graphics);
    
    // パスデータ記録
    if (!activeLayer.paths) {
      activeLayer.paths = [];
    }
    activeLayer.paths.push(pathData);

    // History登録
    if (this.eventBus) {
      this.eventBus.emit('pathAdded', { 
        layerId: activeLayer.id,
        path: this.recorder.clonePathData(pathData)
      });
    }
  }

  /**
   * ツール設定
   * @param {string} tool - 'pen' | 'eraser'
   */
  setTool(tool) {
    if (tool === 'pen' || tool === 'eraser') {
      this.currentTool = tool;
      
      if (this.eventBus) {
        this.eventBus.emit('toolChanged', { tool });
      }
    }
  }

  /**
   * ブラシサイズ設定
   * @param {number} size
   */
  setBrushSize(size) {
    this.settings.setBrushSize(size);
  }

  /**
   * ブラシ色設定
   * @param {number} color
   */
  setBrushColor(color) {
    this.settings.setBrushColor(color);
  }

  /**
   * ブラシ不透明度設定
   * @param {number} opacity
   */
  setBrushOpacity(opacity) {
    this.settings.setBrushOpacity(opacity);
  }

  /**
   * 現在のツール取得
   * @returns {string}
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * 描画中かチェック
   * @returns {boolean}
   */
  getIsDrawing() {
    return this.isDrawing;
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;