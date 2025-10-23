/**
 * DrawingEngine - Phase 1 完全版
 * ツール基盤構築 + 既存機能の完全継承
 * 
 * 改修内容:
 * - ToolManager統合
 * - StrokeDataManager統合
 * - EventBus参照修正
 * - 既存描画機能の完全維持
 */

class DrawingEngine {
  constructor(app, layerManager, cameraSystem, history, config) {
    // CoreEngineからの引数に対応
    this.app = app;
    this.layerManager = layerManager;
    this.cameraSystem = cameraSystem;
    this.history = history;
    this.config = config || {};
    this.eventBus = window.TegakiEventBus;

    // Phase 1: 新規マネージャー初期化
    this.toolManager = new window.TegakiDrawing.ToolManager(this.eventBus);
    this.dataManager = new window.TegakiDrawing.StrokeDataManager(this.eventBus);

    // サブモジュール初期化（既存機能維持）
    if (window.TegakiDrawing) {
      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(config, this.eventBus) : null;
      this.recorder = window.TegakiDrawing.StrokeRecorder ? 
        new window.TegakiDrawing.StrokeRecorder() : null;
      this.renderer = window.TegakiDrawing.StrokeRenderer ? 
        new window.TegakiDrawing.StrokeRenderer(config) : null;
      this.pressureHandler = window.TegakiDrawing.PressureHandler ? 
        new window.TegakiDrawing.PressureHandler() : null;
      this.transformer = window.TegakiDrawing.StrokeTransformer ? 
        new window.TegakiDrawing.StrokeTransformer(config) : null;
    }

    // フォールバック: 基本設定
    this.brushSize = config?.pen?.size || 8;
    this.brushColor = config?.pen?.color || 0x000000;
    this.brushOpacity = config?.pen?.opacity || 1.0;

    // 描画状態（Phase 2でツールに移行予定）
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    // EventBus購読の初期化
    this.subscribeToEvents();
    this.subscribeToSettings();
    
    // 初期設定の同期
    this.applySyncSettings();
  }

  /**
   * Phase 1: EventBus購読（データ管理連携）
   */
  subscribeToEvents() {
    if (!this.eventBus) return;
    
    // ストローク追加時の再描画
    this.eventBus.on('stroke:added', ({ strokeData }) => {
      if (this.layerManager) {
        const layerIndex = strokeData.layerIndex || this.layerManager.activeLayerIndex;
        this.layerManager.requestThumbnailUpdate(layerIndex);
      }
    });
    
    // ストローク削除時の再描画
    this.eventBus.on('stroke:removed', ({ id }) => {
      if (this.layerManager) {
        this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
      }
    });
    
    // ツール切り替え
    this.eventBus.on('tool:switch', ({ tool }) => {
      this.setTool(tool);
    });
  }

  /**
   * 初期設定の同期
   */
  applySyncSettings() {
    if (!this.settings) return;
    
    const currentSettings = this.settings.getCurrentSettings();
    
    if (this.recorder && typeof this.recorder.setSimplifySettings === 'function') {
      this.recorder.setSimplifySettings(
        currentSettings.simplifyTolerance,
        true
      );
    }
    if (this.recorder && typeof this.recorder.setSimplifyEnabled === 'function') {
      this.recorder.setSimplifyEnabled(currentSettings.simplifyEnabled);
    }
    
    if (this.transformer && typeof this.transformer.setSmoothingMode === 'function') {
      this.transformer.setSmoothingMode(currentSettings.smoothingMode);
    }
    if (this.transformer && typeof this.transformer.setSplineParameters === 'function') {
      this.transformer.setSplineParameters(
        currentSettings.splineTension,
        currentSettings.splineSegments
      );
    }
    
    if (this.pressureHandler && typeof this.pressureHandler.setPressureCorrection === 'function') {
      this.pressureHandler.setPressureCorrection(currentSettings.pressureCorrection);
    }
  }

  /**
   * EventBus購読（設定変更）
   */
  subscribeToSettings() {
    if (!this.eventBus) return;
    
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      if (this.settings) {
        this.settings.setPressureCorrection(value);
      }
      if (this.pressureHandler) {
        this.pressureHandler.setPressureCorrection(value);
      }
    });
    
    this.eventBus.on('settings:smoothing', ({ value }) => {
      if (this.settings) {
        this.settings.setSmoothing(value);
      }
    });
    
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      if (this.settings) {
        this.settings.setPressureCurve(curve);
      }
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      if (this.settings) {
        this.settings.setSimplifyTolerance(value);
      }
      if (this.recorder) {
        this.recorder.setSimplifySettings(value, true);
      }
    });
    
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      if (this.settings) {
        this.settings.setSimplifyEnabled(enabled);
      }
      if (this.recorder) {
        this.recorder.setSimplifyEnabled(enabled);
      }
    });
    
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      if (this.settings) {
        this.settings.setSmoothingMode(mode);
      }
      if (this.transformer) {
        this.transformer.setSmoothingMode(mode);
      }
    });
    
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      if (this.settings) {
        this.settings.setSplineTension(value);
      }
      if (this.transformer) {
        const segments = this.settings.splineSegments;
        this.transformer.setSplineParameters(value, segments);
      }
    });
    
    this.eventBus.on('settings:spline-segments', ({ value }) => {
      if (this.settings) {
        this.settings.setSplineSegments(value);
      }
      if (this.transformer) {
        const tension = this.settings.splineTension;
        this.transformer.setSplineParameters(tension, value);
      }
    });
  }

  /**
   * 描画開始
   */
  startDrawing(screenX, screenY, pressureOrEvent) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    const currentScale = this.cameraSystem.camera.scale || 1;

    const strokeOptions = this.settings.getStrokeOptions();
    const scaledSize = this.renderer.getScaledSize(this.settings.getBrushSize(), currentScale);
    strokeOptions.size = scaledSize;

    this.currentPath = this.recorder.startNewPath(
      { x: canvasPoint.x, y: canvasPoint.y, pressure },
      this.currentTool === 'eraser' ? this.config.background.color : this.settings.getBrushColor(),
      this.settings.getBrushSize(),
      this.settings.getBrushOpacity(),
      this.currentTool,
      strokeOptions
    );

    this.currentPath.originalSize = this.settings.getBrushSize();
    this.currentPath.scaleAtDrawTime = currentScale;

    this.currentPath.graphics = new PIXI.Graphics();
    
    this.isDrawing = true;
  }

  /**
   * 描画継続
   */
  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    this.recorder.addPoint(this.currentPath, {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure
    });

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

    if (this.transformer && this.currentPath.points.length > 2) {
      this.currentPath.points = this.transformer.preprocessStroke(this.currentPath.points);
    }
    
    this.recorder.finalizePath(this.currentPath);

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

    // Phase 1: DataManagerにストローク追加
    if (this.currentPath && this.currentPath.points.length > 0) {
      const strokeData = {
        points: this.currentPath.points,
        color: this.currentPath.color,
        size: this.currentPath.originalSize,
        opacity: this.currentPath.opacity,
        tool: this.currentTool,
        strokeOptions: this.currentPath.strokeOptions,
        layerIndex: this.layerManager.activeLayerIndex,
        graphics: this.currentPath.graphics
      };
      
      const strokeId = this.dataManager.addStroke(strokeData);

      // History統合
      const path = this.currentPath;
      const layerIndex = this.layerManager.activeLayerIndex;
      
      if (window.History && !window.History._manager.isApplying) {
        const command = {
          name: 'stroke-added',
          do: () => {
            this.layerManager.addPathToActiveLayer(path);
          },
          undo: () => {
            const activeLayer = this.layerManager.getActiveLayer();
            if (activeLayer?.layerData?.paths) {
              activeLayer.layerData.paths = 
                activeLayer.layerData.paths.filter(p => p !== path);
            }
            if (activeLayer?.paths) {
              activeLayer.paths = activeLayer.paths.filter(p => p !== path);
            }
            
            if (path.graphics) {
              try {
                if (activeLayer) {
                  activeLayer.removeChild(path.graphics);
                }
                path.graphics.destroy({ children: true, texture: false, baseTexture: false });
              } catch (e) {}
            }
            
            this.layerManager.requestThumbnailUpdate(layerIndex);
            this.dataManager.removeStroke(strokeId);
          },
          meta: { type: 'stroke', layerIndex, strokeId }
        };
        
        window.History.push(command);
      } else {
        this.layerManager.addPathToActiveLayer(path);
      }
    }

    this.pressureHandler.reset();

    this.isDrawing = false;
    this.currentPath = null;
  }

  /**
   * ツール設定
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
   */
  setBrushSize(size) {
    this.settings.setBrushSize(size);
  }

  /**
   * ブラシ色設定
   */
  setBrushColor(color) {
    this.settings.setBrushColor(color);
  }

  /**
   * ブラシ不透明度設定
   */
  setBrushOpacity(opacity) {
    this.settings.setBrushOpacity(opacity);
  }

  /**
   * 現在のツール取得
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * Phase 1: 現在のツール名取得
   */
  getCurrentToolName() {
    return this.currentTool;
  }

  /**
   * 描画中かチェック
   */
  getIsDrawing() {
    return this.isDrawing;
  }
  
  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      settings: this.settings?.getCurrentSettings(),
      recorder: this.recorder?.getDebugInfo(),
      transformer: this.transformer?.getDebugInfo(),
      pressureHandler: this.pressureHandler?.getDebugInfo(),
      dataManager: {
        strokeCount: this.dataManager.getAllStrokes().length
      }
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;