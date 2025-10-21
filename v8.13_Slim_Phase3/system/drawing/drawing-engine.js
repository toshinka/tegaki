/**
 * DrawingEngine v3.3 - PHASE 3完了版
 * Perfect Freehand対応ベクターペンエンジン
 * 
 * 🔧 v3.3改修内容（Phase 3: 設定参照統一）:
 * - CONFIG直接参照削除
 * - SettingsManager経由での設定取得に統一
 * - コンソールログ削減（エラーのみ保持）
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    if (!window.TegakiDrawing) {
      throw new Error('window.TegakiDrawing namespace not found');
    }

    if (!window.TegakiDrawing.BrushSettings) {
      throw new Error('BrushSettings module not loaded');
    }
    if (!window.TegakiDrawing.StrokeRecorder) {
      throw new Error('StrokeRecorder module not loaded');
    }
    if (!window.TegakiDrawing.StrokeRenderer) {
      throw new Error('StrokeRenderer module not loaded');
    }
    if (!window.TegakiDrawing.PressureHandler) {
      throw new Error('PressureHandler module not loaded');
    }
    if (!window.TegakiDrawing.StrokeTransformer) {
      throw new Error('StrokeTransformer module not loaded');
    }

    this.settings = new window.TegakiDrawing.BrushSettings(config, eventBus);
    this.recorder = new window.TegakiDrawing.StrokeRecorder();
    this.renderer = new window.TegakiDrawing.StrokeRenderer(config);
    this.pressureHandler = new window.TegakiDrawing.PressureHandler();
    this.transformer = new window.TegakiDrawing.StrokeTransformer(config);

    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    this.subscribeToSettings();
    this.applySyncSettings();
  }

  applySyncSettings() {
    const currentSettings = this.settings.getCurrentSettings();
    
    this.recorder.setSimplifySettings(
      currentSettings.simplifyTolerance,
      true
    );
    this.recorder.setSimplifyEnabled(currentSettings.simplifyEnabled);
    
    this.transformer.setSmoothingMode(currentSettings.smoothingMode);
    this.transformer.setSplineParameters(
      currentSettings.splineTension,
      currentSettings.splineSegments
    );
    
    this.pressureHandler.setPressureCorrection(currentSettings.pressureCorrection);
  }

  subscribeToSettings() {
    if (!this.eventBus) return;
    
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      this.settings.setPressureCorrection(value);
      this.pressureHandler.setPressureCorrection(value);
    });
    
    this.eventBus.on('settings:smoothing', ({ value }) => {
      this.settings.setSmoothing(value);
    });
    
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      this.settings.setPressureCurve(curve);
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      this.settings.setSimplifyTolerance(value);
      this.recorder.setSimplifySettings(value, true);
    });
    
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      this.settings.setSimplifyEnabled(enabled);
      this.recorder.setSimplifyEnabled(enabled);
    });
    
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      this.settings.setSmoothingMode(mode);
      this.transformer.setSmoothingMode(mode);
    });
    
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      this.settings.setSplineTension(value);
      const segments = this.settings.splineSegments;
      this.transformer.setSplineParameters(value, segments);
    });
    
    this.eventBus.on('settings:spline-segments', ({ value }) => {
      this.settings.setSplineSegments(value);
      const tension = this.settings.splineTension;
      this.transformer.setSplineParameters(tension, value);
    });
  }

  startDrawing(screenX, screenY, pressureOrEvent) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);
    const currentScale = this.cameraSystem.worldContainer?.scale?.x || 1;

    const strokeOptions = this.settings.getStrokeOptions();
    const scaledSize = this.renderer.getScaledSize(this.settings.getBrushSize(), currentScale);
    strokeOptions.size = scaledSize;

    // Phase 3: CONFIG.background.color → config参照（起動時固定値OK）
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

    if (this.currentPath && this.currentPath.points.length > 0) {
      const path = this.currentPath;
      const layerIndex = this.layerManager.activeLayerIndex;
      
      if (window.History && !window.History._manager?.isApplying) {
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
      settings: this.settings.getCurrentSettings(),
      recorder: this.recorder.getDebugInfo(),
      transformer: this.transformer.getDebugInfo(),
      pressureHandler: this.pressureHandler.getDebugInfo()
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;