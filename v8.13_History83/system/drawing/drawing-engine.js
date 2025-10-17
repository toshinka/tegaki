/**
 * DrawingEngine v6.0 - Phase 4: 圧力フィルタ統合
 * 
 * 変更点:
 * - getFilteredPressure()を使用（座標を渡す）
 * - baseline補正→フィルタ適用の順序を保証
 * - Phase 3の単独点対応を完全継承
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // サブモジュール初期化
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

    // フォールバック設定
    this.brushSize = config?.pen?.size || 8;
    this.brushColor = config?.pen?.color || 0x000000;
    this.brushOpacity = config?.pen?.opacity || 1.0;

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    this.subscribeToSettings();
    this.applySyncSettings();
  }

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
    
    // 🆕 Phase 4: フィルタ設定イベント
    this.eventBus.on('settings:filter-enabled', ({ enabled }) => {
      if (this.pressureHandler) this.pressureHandler.setFilterEnabled(enabled);
    });
    
    this.eventBus.on('settings:filter-settings', (settings) => {
      if (this.pressureHandler) this.pressureHandler.setFilterSettings(settings);
    });
  }

  startDrawing(screenX, screenY, pressureOrEvent) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    // 🔥 Phase 4: フィルタ適用済み筆圧取得
    const pressure = this.pressureHandler.getFilteredPressure(
      pressureOrEvent, 
      { x: canvasPoint.x, y: canvasPoint.y }
    );
    
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

    // Phase 2継承: Container作成
    this.currentPath.container = new PIXI.Container();
    
    this.isDrawing = true;
  }

  /**
   * 🔥 Phase 4: フィルタ適用済み筆圧取得版
   */
  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    // 🔥 Phase 4: フィルタ適用済み筆圧取得（座標を渡す）
    const pressure = this.pressureHandler.getFilteredPressure(
      pressureOrEvent,
      { x: canvasPoint.x, y: canvasPoint.y }
    );

    this.recorder.addPoint(this.currentPath, {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure
    });

    // Phase 3継承: isSinglePointフラグを含むオプション
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity,
      isSinglePoint: this.currentPath.isSinglePoint || false
    };

    this.currentPath.container.removeChildren();

    const result = this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.container,
      true
    );
    
    if (result && result.meshVertices) {
      this.currentPath.meshVertices = result.meshVertices;
    }
  }

  /**
   * Phase 4継承: フィルタ統合完了版
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // Step 1: Catmull-Rom Splineスムージング（単独点以外）
    if (this.transformer && this.currentPath.points.length > 2 && !this.currentPath.isSinglePoint) {
      this.currentPath.points = this.transformer.preprocessStroke(this.currentPath.points);
    }
    
    // Step 2: Simplify最適化 + 単独点判定
    this.recorder.finalizePath(this.currentPath);

    // Step 3: 最終描画
    const options = {
      ...this.currentPath.strokeOptions,
      color: this.currentPath.color,
      alpha: this.currentPath.opacity,
      isSinglePoint: this.currentPath.isSinglePoint || false
    };

    this.currentPath.container.removeChildren();

    const result = this.renderer.renderStroke(
      this.currentPath.points,
      options,
      this.currentPath.container,
      false
    );

    if (result && result.meshVertices) {
      this.currentPath.meshVertices = result.meshVertices;
    }

    this.currentPath.mesh = result.mesh;

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
            
            // Phase 2継承: Mesh/Container破棄
            if (path.container) {
              try {
                if (activeLayer) {
                  activeLayer.removeChild(path.container);
                }
                path.container.destroy({ children: true });
              } catch (e) {}
            } else if (path.mesh) {
              try {
                if (activeLayer) {
                  activeLayer.removeChild(path.mesh);
                }
                path.mesh.destroy({ children: true });
              } catch (e) {}
            } else if (path.graphics) {
              try {
                if (activeLayer) {
                  activeLayer.removeChild(path.graphics);
                }
                path.graphics.destroy({ children: true });
              } catch (e) {}
            }
            
            this.layerManager.requestThumbnailUpdate(layerIndex);
          },
          meta: { 
            type: 'stroke', 
            layerIndex,
            hasMesh: !!path.meshVertices,
            isSinglePoint: path.isSinglePoint || false
          }
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

  setTool(tool) {
    if (tool === 'pen' || tool === 'eraser') {
      this.currentTool = tool;
      if (this.eventBus) {
        this.eventBus.emit('toolChanged', { tool });
      }
    }
  }

  setBrushSize(size) {
    this.settings.setBrushSize(size);
  }

  setBrushColor(color) {
    this.settings.setBrushColor(color);
  }

  setBrushOpacity(opacity) {
    this.settings.setBrushOpacity(opacity);
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
      pressureHandler: this.pressureHandler?.getDebugInfo(),
      renderer: this.renderer?.getDebugInfo()
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;