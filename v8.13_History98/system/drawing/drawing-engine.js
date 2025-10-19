/**
 * DrawingEngine v7.8 - P/E+ドラッグ完全対応版（強制EventBus統合）
 * 
 * 🔧 修正内容 v7.8:
 * - EventBus統合をより確実に（即座購読 + フォールバック）
 * - window.TegakiEventBus直接参照を追加
 * - リスナー登録の確実性を最大化
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
    
    // 🔧 修正: 即座購読 + 遅延フォールバック
    this._isEventBusSubscribed = false;
    this._immediateSubscription();
    this._setupEventBusSubscription();
    
    this.applySyncSettings();
  }

  /**
   * 🆕 即座にEventBus購読を試みる（利用可能な場合）
   */
  _immediateSubscription() {
    const eventBus = this.eventBus || window.TegakiEventBus;
    
    if (eventBus && typeof eventBus.on === 'function' && !this._isEventBusSubscribed) {
      this.eventBus = eventBus;
      this.subscribeToSettings();
      this._isEventBusSubscribed = true;
    }
  }

  /**
   * 🆕 EventBus購読の遅延セットアップ（フォールバック）
   */
  _setupEventBusSubscription() {
    if (this._isEventBusSubscribed) return;

    const checkAndSubscribe = () => {
      if (this._isEventBusSubscribed) return;

      // グローバルEventBusを優先的に確認
      const eventBus = window.TegakiEventBus || this.eventBus;
      
      if (eventBus && typeof eventBus.on === 'function') {
        this.eventBus = eventBus;
        this.subscribeToSettings();
        this._isEventBusSubscribed = true;
        return;
      }

      // 再試行
      setTimeout(checkAndSubscribe, 50);
    };

    setTimeout(checkAndSubscribe, 50);
  }

  /**
   * BrushSettings同期初期化（即座に成功する場合）
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
        // 初期化失敗時は遅延初期化へ
      }
    }
    
    this._initializeBrushSettingsDelayed();
    return false;
  }

  /**
   * BrushSettings遅延初期化（最大10秒待機）
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
   * BrushSettings確認（なければ再試行）
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

  subscribeToSettings() {
    if (this._isEventBusSubscribed) return;
    
    const eventBus = this.eventBus || window.TegakiEventBus;
    if (!eventBus) return;
    
    // 🆕 P/E+ドラッグ対応: tool:size-opacity-changed イベント購読
    eventBus.on('tool:size-opacity-changed', ({ tool, size, opacity }) => {
      if (!this.settings) return;
      
      // ツールが一致する場合のみ反映（toolがnullの場合は常に反映）
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
    
    this._isEventBusSubscribed = true;
  }

  startDrawing(screenX, screenY, pressureOrEvent) {
    if (!this._ensureBrushSettings()) return;
    
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    
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

console.log('✅ drawing-engine.js v7.8 loaded (強制EventBus統合版)');