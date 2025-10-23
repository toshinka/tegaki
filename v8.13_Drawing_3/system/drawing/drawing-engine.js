/**
 * DrawingEngine - Phase 1改修版（core-engine.js互換）
 * ToolManager・StrokeDataManager統合
 * 
 * ✅ 修正: core-engine.jsの呼び出しに合わせて引数調整
 * 呼び出し: new DrawingEngine(app, layerSystem, cameraSystem, History)
 */

class DrawingEngine {
  constructor(app, layerSystem, cameraSystem, historyManager) {
    // 引数をcore-engine.jsの呼び出しに合わせる
    this.app = app;
    this.layerManager = layerSystem;
    this.cameraSystem = cameraSystem;
    this.historyManager = historyManager;
    
    // EventBusとConfigを取得
    this.eventBus = window.TegakiEventBus;
    this.config = window.TEGAKI_CONFIG || {};

    // Phase 1: ToolManager・StrokeDataManager初期化
    if (window.TegakiDrawing) {
      // ToolManager（ツール管理）
      this.toolManager = window.TegakiDrawing.ToolManager ? 
        new window.TegakiDrawing.ToolManager(this.eventBus) : null;
      
      // StrokeDataManager（データ管理）
      this.dataManager = window.TegakiDrawing.StrokeDataManager ? 
        new window.TegakiDrawing.StrokeDataManager(this.eventBus) : null;

      // 既存サブモジュール
      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(this.config, this.eventBus) : null;
      this.recorder = window.TegakiDrawing.StrokeRecorder ? 
        new window.TegakiDrawing.StrokeRecorder() : null;
      this.renderer = window.TegakiDrawing.StrokeRenderer ? 
        new window.TegakiDrawing.StrokeRenderer(this.config) : null;
      this.pressureHandler = window.TegakiDrawing.PressureHandler ? 
        new window.TegakiDrawing.PressureHandler() : null;
      this.transformer = window.TegakiDrawing.StrokeTransformer ? 
        new window.TegakiDrawing.StrokeTransformer(this.config) : null;
    }

    // フォールバック: 基本設定
    this.brushSize = this.config?.pen?.size || 8;
    this.brushColor = this.config?.pen?.color || 0x000000;
    this.brushOpacity = this.config?.pen?.opacity || 1.0;

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    // EventBus購読
    this.subscribeToSettings();
    this.subscribeToStrokeData();
    
    // 初期設定同期
    this.applySyncSettings();
  }

  /**
   * Phase 1: StrokeDataManager イベント購読
   */
  subscribeToStrokeData() {
    if (!this.eventBus || !this.dataManager) return;
    
    this.eventBus.on('stroke:added', ({ id, strokeData }) => {
      this.requestRender();
    });
    
    this.eventBus.on('stroke:removed', ({ id }) => {
      this.requestRender();
    });
    
    this.eventBus.on('stroke:updated', ({ id, strokeData }) => {
      this.requestRender();
    });
  }

  /**
   * Phase 1: 再描画リクエスト
   */
  requestRender() {
    if (this.layerManager) {
      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer) {
        this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
      }
    }
  }

  /**
   * Phase 2-3: 初期設定の同期
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
   * Phase 1-3: EventBus購読の設定
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
   * BrushSettings設定（互換性のため）
   */
  setBrushSettings(brushSettings) {
    if (brushSettings) {
      this.settings = brushSettings;
    }
  }

  /**
   * BrushSettings取得（互換性のため）
   */
  getBrushSettings() {
    return this.settings;
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

    // Phase 1: StrokeDataManager へデータ追加
    if (this.dataManager && this.currentPath.points.length > 0) {
      const strokeData = {
        points: [...this.currentPath.points],
        color: this.currentPath.color,
        size: this.currentPath.size,
        opacity: this.currentPath.opacity,
        tool: this.currentPath.tool,
        strokeOptions: { ...this.currentPath.strokeOptions }
      };
      this.dataManager.addStroke(strokeData);
    }

    // History統合
    if (this.currentPath && this.currentPath.points.length > 0) {
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
          },
          meta: { type: 'stroke', layerIndex }
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

  setBrushSize(size) {
    if (this.settings) this.settings.setBrushSize(size);
  }

  setBrushColor(color) {
    if (this.settings) this.settings.setBrushColor(color);
  }

  setBrushOpacity(opacity) {
    if (this.settings) this.settings.setBrushOpacity(opacity);
  }

  getCurrentTool() {
    return this.currentTool;
  }

  getIsDrawing() {
    return this.isDrawing;
  }
  
  /**
   * Phase 1: デバッグ情報取得
   */
  getDebugInfo() {
    return {
      settings: this.settings?.getCurrentSettings(),
      recorder: this.recorder?.getDebugInfo(),
      transformer: this.transformer?.getDebugInfo(),
      pressureHandler: this.pressureHandler?.getDebugInfo(),
      toolManager: this.toolManager ? {
        currentTool: this.toolManager.currentTool,
        registeredTools: Array.from(this.toolManager.toolRegistry?.keys() || [])
      } : null,
      dataManager: this.dataManager ? {
        strokeCount: this.dataManager.strokes?.size || 0
      } : null
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;