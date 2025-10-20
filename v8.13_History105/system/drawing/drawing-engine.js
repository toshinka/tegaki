/**
 * DrawingEngine v7.10 - v7.9修正版（最小限の改修）
 * 
 * 🔧 修正内容 v7.10:
 * - startDrawing() で毎回 BrushSettings から値を直接取得（スナップショット化廃止）
 * - subscribeToSettings() メソッドを確実に定義
 * - _isEventBusSubscribed フラグを確実に初期化
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // settings プロパティを明示的にnullで初期化
    this.settings = null;
    this._initializeBrushSettingsSync();
    
    if (window.TegakiDrawing) {
      this.recorder = window.TegakiDrawing.StrokeRecorder ? 
        new window.TegakiDrawing.StrokeRecorder() : null;
      this.renderer = window.TegakiDrawing.StrokeRenderer ? 
        new window.TegakiDrawing.StrokeRenderer(config) : null;
      this.pressureHandler = window.TegakiDrawing.PressureHandler ? 
        new window.TegakiDrawing.PressureHandler() : null;
      this.transformer = window.TegakiDrawing.StrokeTransformer ? 
        new window.TegakiDrawing.StrokeTransformer(config) : null;
    }

    this.brushSize = config?.pen?.size || 8;
    this.brushColor = config?.pen?.color || 0x000000;
    this.brushOpacity = config?.pen?.opacity || 1.0;

    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    // 🔧 修正 v7.10: フラグを false で確実に初期化
    this._isEventBusSubscribed = false;
    
    // 即座購読を試みる
    this._immediateSubscription();
    
    // フォールバック: 50ms後に再試行
    this._setupEventBusSubscription();
    
    this.applySyncSettings();
  }

  /**
   * 即座にEventBus購読を試みる
   */
  _immediateSubscription() {
    const eventBus = this.eventBus || window.TegakiEventBus;
    
    if (eventBus && typeof eventBus.on === 'function' && !this._isEventBusSubscribed) {
      this.eventBus = eventBus;
      this.subscribeToSettings();
    }
  }

  /**
   * EventBus購読のフォールバック
   */
  _setupEventBusSubscription() {
    if (this._isEventBusSubscribed) return;

    const checkAndSubscribe = () => {
      if (this._isEventBusSubscribed) return;

      const eventBus = window.TegakiEventBus || this.eventBus;
      
      if (eventBus && typeof eventBus.on === 'function') {
        this.eventBus = eventBus;
        this.subscribeToSettings();
        return;
      }

      setTimeout(checkAndSubscribe, 50);
    };

    setTimeout(checkAndSubscribe, 50);
  }

  /**
   * BrushSettings同期初期化
   */
  _initializeBrushSettingsSync() {
    const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || 
                                window.BrushSettings ||
                                null;
    
    if (BrushSettingsClass) {
      try {
        this.settings = new BrushSettingsClass(this.config, this.eventBus);
        this._emitBrushInitialized();
        return true;
      } catch (e) {
        this._initializeBrushSettingsDelayed();
        return false;
      }
    }
    
    this._initializeBrushSettingsDelayed();
    return false;
  }

  /**
   * BrushSettings遅延初期化
   */
  _initializeBrushSettingsDelayed() {
    let retryCount = 0;
    const maxRetries = 200;
    
    const retryInit = () => {
      retryCount++;
      
      if (this.settings) {
        return;
      }
      
      const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || 
                                  window.BrushSettings ||
                                  null;
      
      if (BrushSettingsClass) {
        this.settings = new BrushSettingsClass(this.config, this.eventBus);
        this._emitBrushInitialized();
        this.applySyncSettings();
        return;
      }
      
      if (retryCount < maxRetries) {
        setTimeout(retryInit, 50);
      }
    };
    
    setTimeout(retryInit, 50);
  }

  /**
   * brush:initialized イベント発行
   */
  _emitBrushInitialized() {
    try {
      const eventBus = this.eventBus || window.TegakiEventBus;
      if (eventBus && typeof eventBus.emit === 'function') {
        eventBus.emit('brush:initialized', { settings: this.settings });
      }
    } catch (e) {
      // 静かに失敗
    }
  }

  /**
   * BrushSettings確認
   */
  _ensureBrushSettings() {
    if (this.settings) {
      return true;
    }
    
    const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || 
                                window.BrushSettings ||
                                null;
    
    if (BrushSettingsClass) {
      this.settings = new BrushSettingsClass(this.config, this.eventBus);
      this._emitBrushInitialized();
      this.applySyncSettings();
      return true;
    }
    
    return false;
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
    
    if (this.pressureHandler && this.config.pen?.pressure?.filter) {
      this.pressureHandler.setFilterSettings(this.config.pen.pressure.filter);
    }
  }

  /**
   * 🔧 修正 v7.10: EventBus購読メソッド（確実に定義）
   */
  subscribeToSettings() {
    // 既に購読済みの場合はスキップ
    if (this._isEventBusSubscribed) {
      return;
    }
    
    const eventBus = this.eventBus || window.TegakiEventBus;
    if (!eventBus) {
      return;
    }
    
    // 🔥 P/E+ドラッグ対応: tool:size-opacity-changed イベント購読
    eventBus.on('tool:size-opacity-changed', ({ tool, size, opacity }) => {
      if (!this.settings) return;
      
      if (!tool || tool === this.currentTool) {
        if (size !== undefined) {
          this.settings.setBrushSize(size);
        }
        if (opacity !== undefined) {
          this.settings.setBrushOpacity(opacity);
        }
      }
    });
    
    eventBus.on('settings:pressure-correction', ({ value }) => {
      if (this.settings) this.settings.setPressureCorrection(value);
      if (this.pressureHandler) this.pressureHandler.setPressureCorrection(value);
    });
    
    eventBus.on('settings:smoothing', ({ value }) => {
      if (this.settings) this.settings.setSmoothing(value);
    });
    
    eventBus.on('settings:pressure-curve', ({ curve }) => {
      if (this.settings) this.settings.setPressureCurve(curve);
    });
    
    eventBus.on('settings:simplify-tolerance', ({ value }) => {
      if (this.settings) this.settings.setSimplifyTolerance(value);
      if (this.recorder) this.recorder.setSimplifySettings(value, true);
    });
    
    eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      if (this.settings) this.settings.setSimplifyEnabled(enabled);
      if (this.recorder) this.recorder.setSimplifyEnabled(enabled);
    });
    
    eventBus.on('settings:smoothing-mode', ({ mode }) => {
      if (this.settings) this.settings.setSmoothingMode(mode);
      if (this.transformer) this.transformer.setSmoothingMode(mode);
    });
    
    eventBus.on('settings:spline-tension', ({ value }) => {
      if (this.settings) this.settings.setSplineTension(value);
      if (this.transformer) {
        const segments = this.settings.splineSegments;
        this.transformer.setSplineParameters(value, segments);
      }
    });
    
    eventBus.on('settings:spline-segments', ({ value }) => {
      if (this.settings) this.settings.setSplineSegments(value);
      if (this.transformer) {
        const tension = this.settings.splineTension;
        this.transformer.setSplineParameters(tension, value);
      }
    });
    
    eventBus.on('settings:filter-enabled', ({ enabled }) => {
      if (this.pressureHandler) this.pressureHandler.setFilterEnabled(enabled);
    });
    
    eventBus.on('settings:filter-settings', (settings) => {
      if (this.pressureHandler) this.pressureHandler.setFilterSettings(settings);
    });
    
    // 🔧 修正 v7.10: 購読完了フラグを確実に設定
    this._isEventBusSubscribed = true;
  }

  /**
   * 🔧 修正 v7.10: startDrawing で毎回リアルタイムの値を取得
   * スナップショット化を廃止し、常に最新のBrushSettingsから取得
   */
  startDrawing(screenX, screenY, pressureOrEvent) {
    if (!this._ensureBrushSettings()) return;
    
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    const pressure = this.pressureHandler.getFilteredPressure(
      pressureOrEvent, 
      { x: canvasPoint.x, y: canvasPoint.y }
    );
    
    const currentScale = this.cameraSystem.camera.scale || 1;

    // 🔧 修正 v7.10: 直前に取得（毎回新鮮な値）
    const strokeOptions = this.settings.getStrokeOptions();
    const currentSize = this.settings.getBrushSize();
    const currentColor = this.settings.getBrushColor();
    const currentOpacity = this.settings.getBrushOpacity();
    
    const scaledSize = this.renderer.getScaledSize(currentSize, currentScale);
    strokeOptions.size = scaledSize;

    this.currentPath = this.recorder.startNewPath(
      { x: canvasPoint.x, y: canvasPoint.y, pressure },
      this.currentTool === 'eraser' ? this.config.background.color : currentColor,
      currentSize,
      currentOpacity,
      this.currentTool,
      strokeOptions
    );

    this.currentPath.originalSize = currentSize;
    this.currentPath.scaleAtDrawTime = currentScale;

    this.currentPath.container = new PIXI.Container();
    
    this.isDrawing = true;
  }

  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
    const pressure = this.pressureHandler.getFilteredPressure(
      pressureOrEvent,
      { x: canvasPoint.x, y: canvasPoint.y }
    );

    this.recorder.addPoint(this.currentPath, {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure
    });

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

  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    if (this.transformer && this.currentPath.points.length > 2 && !this.currentPath.isSinglePoint) {
      this.currentPath.points = this.transformer.preprocessStroke(this.currentPath.points);
    }
    
    this.recorder.finalizePath(this.currentPath);

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
      const eventBus = this.eventBus || window.TegakiEventBus;
      if (eventBus) {
        eventBus.emit('toolChanged', { tool });
      }
    }
  }

  setBrushSize(size) {
    if (this._ensureBrushSettings()) {
      this.settings.setBrushSize(size);
    }
  }

  setBrushColor(color) {
    if (this._ensureBrushSettings()) {
      this.settings.setBrushColor(color);
    }
  }

  setBrushOpacity(opacity) {
    if (this._ensureBrushSettings()) {
      this.settings.setBrushOpacity(opacity);
    }
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
      renderer: this.renderer?.getDebugInfo(),
      eventBusSubscribed: this._isEventBusSubscribed,
      eventBusReference: !!(this.eventBus || window.TegakiEventBus)
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js v7.10 loaded (v7.9修正版 - スナップショット化廃止)');