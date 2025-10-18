/**
 * DrawingEngine v7.3 - BrushSettings超堅牢版
 * 
 * 変更点:
 * - BrushSettingsの探索を徹底強化（グローバル・TegakiDrawing両対応）
 * - 初期化失敗時の詳細ログ追加
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // 🔥 修正: BrushSettings初期化（超堅牢版）
    this.settings = null;
    this._initializeBrushSettingsRobust();
    
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
    
    this.subscribeToSettings();
    this.applySyncSettings();
  }

  /**
   * 🔥 BrushSettings超堅牢版初期化
   */
  _initializeBrushSettingsRobust() {
    console.log('🔧 Attempting to initialize BrushSettings...');
    
    // 複数の候補から探索
    const candidates = [
      { name: 'window.TegakiDrawing.BrushSettings', value: window.TegakiDrawing?.BrushSettings },
      { name: 'window.BrushSettings', value: window.BrushSettings },
      { name: 'globalThis.BrushSettings', value: globalThis.BrushSettings }
    ];
    
    console.log('🔍 Searching for BrushSettings in:');
    candidates.forEach(c => {
      console.log(`  ${c.name}:`, !!c.value);
    });
    
    // 最初に見つかったものを使用
    for (const candidate of candidates) {
      if (candidate.value && typeof candidate.value === 'function') {
        try {
          this.settings = new candidate.value(this.config, this.eventBus);
          console.log(`✅ BrushSettings initialized from ${candidate.name}`);
          return true;
        } catch (error) {
          console.error(`❌ Failed to initialize from ${candidate.name}:`, error);
        }
      }
    }
    
    // すべて失敗した場合
    console.error('❌ BrushSettings class not found in any location');
    console.log('🔍 Available window properties:', Object.keys(window).filter(k => k.includes('Brush') || k.includes('Tegaki')));
    
    // 遅延初期化を試行
    this._initializeBrushSettingsDelayed();
    return false;
  }

  /**
   * BrushSettings遅延初期化（フォールバック用）
   */
  _initializeBrushSettingsDelayed() {
    console.warn('⚠️ Starting delayed BrushSettings initialization...');
    
    let retryCount = 0;
    const maxRetries = 200; // 最大10秒待機
    
    const retryInit = () => {
      retryCount++;
      
      if (this.settings) {
        console.log('✅ BrushSettings already initialized');
        return;
      }
      
      // 複数の候補を再チェック
      const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || 
                                  window.BrushSettings ||
                                  globalThis.BrushSettings ||
                                  null;
      
      if (BrushSettingsClass && typeof BrushSettingsClass === 'function') {
        try {
          this.settings = new BrushSettingsClass(this.config, this.eventBus);
          console.log(`✅ BrushSettings initialized (delayed after ${retryCount * 50}ms)`);
          
          // 遅延初期化後に設定を再適用
          this.applySyncSettings();
          
          // グローバルに公開（keyboard-handlerからアクセス可能に）
          if (!window.drawingEngine) {
            window.drawingEngine = this;
          }
          
          return;
        } catch (error) {
          console.error('❌ Delayed initialization failed:', error);
        }
      }
      
      if (retryCount < maxRetries) {
        setTimeout(retryInit, 50);
      } else {
        console.error(`❌ BrushSettings initialization failed after ${retryCount * 50}ms`);
        console.log('🔍 Final check - Available globals:');
        console.log('  window.TegakiDrawing:', window.TegakiDrawing);
        console.log('  window.BrushSettings:', window.BrushSettings);
      }
    };
    
    setTimeout(retryInit, 50);
  }

  /**
   * BrushSettings取得（nullチェック付き）
   */
  _ensureBrushSettings() {
    if (!this.settings) {
      console.error('❌ BrushSettings not initialized');
      return false;
    }
    return true;
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
    
    this.eventBus.on('settings:filter-enabled', ({ enabled }) => {
      if (this.pressureHandler) this.pressureHandler.setFilterEnabled(enabled);
    });
    
    this.eventBus.on('settings:filter-settings', (settings) => {
      if (this.pressureHandler) this.pressureHandler.setFilterSettings(settings);
    });
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
      if (this.eventBus) {
        this.eventBus.emit('toolChanged', { tool });
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
      renderer: this.renderer?.getDebugInfo()
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;