/**
 * DrawingEngine - 描画エンジンの中核
 * Phase 1: ToolManager/StrokeDataManager統合、座標変換の一元化
 */
class DrawingEngine {
  constructor(app, layerSystem, cameraSystem, historyManager) {
    this.app = app;
    this.layerSystem = layerSystem;
    this.cameraSystem = cameraSystem;
    this.historyManager = historyManager;
    this.eventBus = window.eventBus;
    
    // Phase 1: 新規コンポーネント
    this.toolManager = new ToolManager(this.eventBus);
    this.dataManager = new StrokeDataManager(this.eventBus);
    
    // 描画設定
    this.settings = new BrushSettings(window.config, this.eventBus);
    
    // ストローク記録・レンダリング
    this.recorder = new StrokeRecorder(this.eventBus);
    this.renderer = new StrokeRenderer(this.eventBus);
    this.pressureHandler = new PressureHandler(this.eventBus);
    this.transformer = new StrokeTransformer();
    
    // 描画状態
    this.isDrawing = false;
    this.currentGraphics = null;
    
    this.subscribeToEvents();
    this.initializeTools();
  }

  /**
   * ツール初期化 - Phase 1: PenToolを登録
   */
  initializeTools() {
    const toolDeps = {
      recorder: this.recorder,
      renderer: this.renderer,
      settings: this.settings,
      pressureHandler: this.pressureHandler,
      dataManager: this.dataManager,
      layerSystem: this.layerSystem
    };
    
    this.toolManager.registerTool('pen', PenTool);
    this.toolManager.switchTool('pen', toolDeps);
  }

  /**
   * イベント購読
   */
  subscribeToEvents() {
    // ストローク追加時の再描画
    this.eventBus.on('stroke:added', () => {
      this.requestRender();
    });
    
    this.eventBus.on('stroke:removed', () => {
      this.requestRender();
    });
    
    // ツール切り替え
    this.eventBus.on('tool:switch', ({ tool }) => {
      const toolDeps = {
        recorder: this.recorder,
        renderer: this.renderer,
        settings: this.settings,
        pressureHandler: this.pressureHandler,
        dataManager: this.dataManager,
        layerSystem: this.layerSystem
      };
      this.toolManager.switchTool(tool, toolDeps);
    });
    
    // 設定変更の購読
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      this.pressureHandler.setPressureCorrection(value);
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      this.transformer.setSimplifyTolerance(value);
    });
    
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      this.transformer.setSmoothingMode(mode);
    });
  }

  /**
   * 描画開始 - Phase 1: ツールに委譲
   * @param {number} screenX - スクリーン座標X
   * @param {number} screenY - スクリーン座標Y
   * @param {number} pressure - 筆圧 (0.0-1.0)
   */
  startDrawing(screenX, screenY, pressure = 0.5) {
    if (this.isDrawing) return;
    
    // 座標変換: スクリーン → ワールド
    const worldPos = this.cameraSystem.screenToWorld(screenX, screenY);
    
    this.isDrawing = true;
    
    // アクティブレイヤーの Graphics を取得
    const activeLayer = this.layerSystem.getActiveLayer();
    if (!activeLayer) return;
    
    this.currentGraphics = new PIXI.Graphics();
    activeLayer.container.addChild(this.currentGraphics);
    
    // ツールに委譲
    const tool = this.toolManager.getCurrentTool();
    if (tool) {
      tool.onPointerDown(worldPos, pressure, this.currentGraphics);
    }
  }

  /**
   * 描画継続 - Phase 1: ツールに委譲
   * @param {number} screenX - スクリーン座標X
   * @param {number} screenY - スクリーン座標Y
   * @param {number} pressure - 筆圧 (0.0-1.0)
   */
  continueDrawing(screenX, screenY, pressure = 0.5) {
    if (!this.isDrawing) return;
    
    // 座標変換: スクリーン → ワールド
    const worldPos = this.cameraSystem.screenToWorld(screenX, screenY);
    
    // ツールに委譲
    const tool = this.toolManager.getCurrentTool();
    if (tool) {
      tool.onPointerMove(worldPos, pressure, this.currentGraphics);
    }
  }

  /**
   * 描画終了 - Phase 1: ツールに委譲
   */
  endDrawing() {
    if (!this.isDrawing) return;
    
    // ツールに委譲
    const tool = this.toolManager.getCurrentTool();
    if (tool) {
      tool.onPointerUp(this.currentGraphics);
    }
    
    this.isDrawing = false;
    this.currentGraphics = null;
  }

  /**
   * 再描画リクエスト
   */
  requestRender() {
    const activeLayer = this.layerSystem.getActiveLayer();
    if (!activeLayer) return;
    
    // 既存のストロークをクリア
    activeLayer.container.children
      .filter(child => child instanceof PIXI.Graphics)
      .forEach(child => {
        activeLayer.container.removeChild(child);
        child.destroy();
      });
    
    // 全ストロークを再描画
    const strokes = this.dataManager.getAllStrokes();
    strokes.forEach(strokeData => {
      const graphics = new PIXI.Graphics();
      activeLayer.container.addChild(graphics);
      
      const currentSettings = this.settings.getCurrentSettings();
      const renderSettings = {
        color: currentSettings.color,
        size: currentSettings.size,
        alpha: currentSettings.alpha
      };
      
      this.renderer.renderFinalStroke(strokeData, renderSettings, graphics);
    });
  }

  /**
   * 現在のツール名を取得
   */
  getCurrentToolName() {
    return this.toolManager.getCurrentToolName();
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.toolManager.clearInstances();
    this.isDrawing = false;
    this.currentGraphics = null;
  }
}

window.DrawingEngine = DrawingEngine;