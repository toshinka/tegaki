/**
 * DrawingEngine v4.0 - Phase 1: ベクター消しゴム実装
 * 既存コード維持 + 消しゴム機能追加
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // サブモジュール初期化（存在する場合のみ）
    if (window.TegakiDrawing) {
      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(config, eventBus) : null;
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

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen'; // 'pen' | 'eraser'
    this.currentPath = null;
    this.lastPoint = null;
    
    // EventBus購読の初期化
    this.subscribeToSettings();
    
    // Phase 2-3: 初期設定をサブモジュールに同期
    this.applySyncSettings();
  }

  /**
   * Phase 2-3: 初期設定の同期
   */
  applySyncSettings() {
    if (!this.settings) return;
    
    const currentSettings = this.settings.getCurrentSettings();
    
    if (this.recorder && typeof this.recorder.setSimplifySettings === 'function') {
      this.recorder.setSimplifySettings(currentSettings.simplifyTolerance, true);
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
   * EventBus購読の設定
   */
  subscribeToSettings() {
    if (!this.eventBus) return;
    
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      if (this.settings) this.settings.setPressureCorrection(value);
      if (this.pressureHandler) this.pressureHandler.setPressureCorrection(value);
    });
    
    this.eventBus.on('settings:smoothing', ({ value }) => {
      if (this.settings) this.settings.setSmoothing(value);
    });
    
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      if (this.settings) this.settings.setPressureCurve(curve);
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      if (this.settings) this.settings.setSimplifyTolerance(value);
      if (this.recorder) this.recorder.setSimplifySettings(value, true);
    });
    
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      if (this.settings) this.settings.setSimplifyEnabled(enabled);
      if (this.recorder) this.recorder.setSimplifyEnabled(enabled);
    });
    
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      if (this.settings) this.settings.setSmoothingMode(mode);
      if (this.transformer) this.transformer.setSmoothingMode(mode);
    });
    
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      if (this.settings) this.settings.setSplineTension(value);
      if (this.transformer) {
        const segments = this.settings.splineSegments;
        this.transformer.setSplineParameters(value, segments);
      }
    });
    
    this.eventBus.on('settings:spline-segments', ({ value }) => {
      if (this.settings) this.settings.setSplineSegments(value);
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
   * 描画終了（Phase 1: 消しゴム処理追加）
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // Step 1: Catmull-Rom Splineスムージング適用
    if (this.transformer && this.currentPath.points.length > 2) {
      this.currentPath.points = this.transformer.preprocessStroke(this.currentPath.points);
    }
    
    // Step 2: Simplify最適化
    this.recorder.finalizePath(this.currentPath);

    // Step 3: 最終描画
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

    // Phase 1: 消しゴムモード時の処理
    if (this.currentTool === 'eraser' && this.currentPath.points.length > 0) {
      this.applyEraserEffect(this.currentPath);
      
      // 消しゴムパス自体は削除
      if (this.currentPath.graphics) {
        this.currentPath.graphics.destroy();
      }
      
      this.pressureHandler.reset();
      this.isDrawing = false;
      this.currentPath = null;
      return;
    }

    // ペンモード: History統合
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

  // ========================================
  // Phase 1: 消しゴム機能（新規メソッド）
  // ========================================

  /**
   * 消しゴム効果の適用
   */
  applyEraserEffect(eraserPath) {
    const VectorOps = window.TegakiDrawing?.VectorOperations;
    if (!VectorOps) return;

    const eraserPoints = eraserPath.points;
    const eraserRadius = eraserPath.size / 2;
    
    const activeLayer = this.layerManager.getActiveLayer();
    if (!activeLayer?.layerData?.paths) return;
    
    const modifications = [];
    
    for (const path of activeLayer.layerData.paths) {
      if (path === eraserPath) continue;
      
      let hasIntersection = false;
      
      for (const eraserPoint of eraserPoints) {
        if (VectorOps.testCircleStrokeIntersection(
          eraserPoint, 
          eraserRadius, 
          path.points
        )) {
          hasIntersection = true;
          break;
        }
      }
      
      if (hasIntersection) {
        const segments = this.splitPathByEraserTrail(
          path, 
          eraserPoints, 
          eraserRadius
        );
        modifications.push({ original: path, segments });
      }
    }
    
    if (modifications.length > 0) {
      this.applyPathModifications(modifications);
    }
  }

  /**
   * 消しゴムの軌跡全体でパスを分割
   */
  splitPathByEraserTrail(path, eraserPoints, eraserRadius) {
    const VectorOps = window.TegakiDrawing.VectorOperations;
    
    const circles = eraserPoints.map(point => ({
      center: point,
      radius: eraserRadius
    }));
    
    return VectorOps.splitStrokeByCircles(path.points, circles, 5);
  }

  /**
   * パス変更の適用とHistory記録
   */
  applyPathModifications(modifications) {
    const activeLayer = this.layerManager.getActiveLayer();
    const removedPaths = [];
    const addedPaths = [];
    
    for (const { original, segments } of modifications) {
      removedPaths.push(original);
      activeLayer.layerData.paths = 
        activeLayer.layerData.paths.filter(p => p !== original);
      
      if (original.graphics) {
        activeLayer.removeChild(original.graphics);
        original.graphics.destroy();
      }
      
      for (const segmentPoints of segments) {
        if (segmentPoints.length < 2) continue;
        
        const newPath = {
          ...original,
          points: segmentPoints,
          graphics: new PIXI.Graphics()
        };
        
        const options = {
          ...original.strokeOptions,
          color: original.color,
          alpha: original.opacity
        };
        this.renderer.renderStroke(segmentPoints, options, newPath.graphics);
        
        activeLayer.addChild(newPath.graphics);
        activeLayer.layerData.paths.push(newPath);
        addedPaths.push(newPath);
      }
    }
    
    if (window.History && removedPaths.length > 0) {
      const layerIndex = this.layerManager.activeLayerIndex;
      const command = {
        name: 'eraser-applied',
        do: () => {
          const layer = this.layerManager.layers[layerIndex];
          
          for (const path of removedPaths) {
            layer.layerData.paths = 
              layer.layerData.paths.filter(p => p !== path);
            if (path.graphics) {
              layer.removeChild(path.graphics);
            }
          }
          
          for (const path of addedPaths) {
            layer.layerData.paths.push(path);
            layer.addChild(path.graphics);
          }
          
          this.layerManager.requestThumbnailUpdate(layerIndex);
        },
        undo: () => {
          const layer = this.layerManager.layers[layerIndex];
          
          for (const path of addedPaths) {
            layer.layerData.paths = 
              layer.layerData.paths.filter(p => p !== path);
            if (path.graphics) {
              layer.removeChild(path.graphics);
              path.graphics.destroy();
            }
          }
          
          for (const path of removedPaths) {
            layer.layerData.paths.push(path);
            
            path.graphics = new PIXI.Graphics();
            const options = {
              ...path.strokeOptions,
              color: path.color,
              alpha: path.opacity
            };
            this.renderer.renderStroke(path.points, options, path.graphics);
            layer.addChild(path.graphics);
          }
          
          this.layerManager.requestThumbnailUpdate(layerIndex);
        },
        meta: { type: 'eraser', layerIndex }
      };
      
      window.History.push(command);
    }
    
    this.layerManager.requestThumbnailUpdate();
  }

  // ========================================
  // 既存API（変更なし）
  // ========================================

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
  
  getDebugInfo() {
    return {
      settings: this.settings?.getCurrentSettings(),
      recorder: this.recorder?.getDebugInfo(),
      transformer: this.transformer?.getDebugInfo(),
      pressureHandler: this.pressureHandler?.getDebugInfo()
    };
  }
}

// グローバル登録
if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;