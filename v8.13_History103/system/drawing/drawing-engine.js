/**
 * DrawingEngine v8.2 - P/E+ドラッグ完全対応版
 * 
 * 🔧 修正内容:
 * - tool:size-opacity-changed のツールチェックを削除（132行目）
 *   理由: KeyboardHandler.dragState.activeTool と DrawingEngine.currentTool の
 *        同期タイミングの問題により、イベントが無視されていた
 * 
 * 既存の改修内容:
 * - constructor内でBrushSettingsを確実に生成
 * - this.brushSize/brushColor/brushOpacity プロパティ削除（BrushSettingsに一元化）
 * - 冗長な遅延初期化ロジック削除
 * - イベント購読の簡素化
 * - tool:size:changed イベント追加対応（DragVisualFeedback互換性）
 */

class DrawingEngine {
  constructor(cameraSystem, layerManager, eventBus, config) {
    this.cameraSystem = cameraSystem;
    this.layerManager = layerManager;
    this.eventBus = eventBus;
    this.config = config || {};

    // BrushSettingsを確実に初期化
    this._initializeBrushSettings();
    
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

    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    // EventBus購読
    this.subscribeToSettings();
    
    // 設定を各コンポーネントに適用
    this.applySyncSettings();
  }

  /**
   * BrushSettings初期化（同期的に実行）
   */
  _initializeBrushSettings() {
    const BrushSettingsClass = window.TegakiDrawing?.BrushSettings || 
                                window.BrushSettings ||
                                null;
    
    if (!BrushSettingsClass) {
      console.error('❌ BrushSettings class not found. Ensure brush-settings.js is loaded before drawing-engine.js');
      console.error('   window.TegakiDrawing:', window.TegakiDrawing);
      console.error('   window.BrushSettings:', window.BrushSettings);
      throw new Error('BrushSettings class not found. Ensure brush-settings.js is loaded before drawing-engine.js');
    }
    
    try {
      this.settings = new BrushSettingsClass(this.config, this.eventBus);
      
      if (this.eventBus) {
        this.eventBus.emit('brush:initialized', { settings: this.settings });
      }
    } catch (error) {
      console.error('❌ Failed to create BrushSettings instance:', error);
      console.error('   config:', this.config);
      console.error('   eventBus:', this.eventBus);
      throw error;
    }
  }

  /**
   * 設定を各描画コンポーネントに適用
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
    
    if (this.pressureHandler && this.config.pen?.pressure?.filter) {
      this.pressureHandler.setFilterSettings(this.config.pen.pressure.filter);
    }
  }

  /**
   * EventBus経由の設定変更を購読
   */
  subscribeToSettings() {
    if (!this.eventBus) return;
    
    // tool:size:changed イベント購読（DragVisualFeedback互換性）
    this.eventBus.on('tool:size:changed', ({ tool, size }) => {
      if (!this.settings) return;
      
      // ツールが一致する場合のみ反映（toolがnullの場合は常に反映）
      if (!tool || tool === this.currentTool) {
        if (size !== undefined) {
          this.settings.setBrushSize(size);
        }
      }
    });
    
    // 🔧 修正: tool:size-opacity-changed イベント購読（P/E+ドラッグ対応）
    // ツールチェックを削除し、常に反映するように変更
    this.eventBus.on('tool:size-opacity-changed', ({ tool, size, opacity }) => {
      if (!this.settings) return;
      
      // 🔧 修正前（GitHubファイル132行目）:
      // if (!tool || tool === this.currentTool) {
      //
      // 🔧 修正後: ツールチェックを完全削除
      // 理由: KeyboardHandler.dragState.activeTool と DrawingEngine.currentTool が
      //      非同期のため、P/Eキー押下直後はツールが一致せずイベントが無視される
      
      if (size !== undefined) {
        this.settings.setBrushSize(size);
      }
      if (opacity !== undefined) {
        this.settings.setBrushOpacity(opacity);
      }
    });
    
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
    if (!this.settings) return;
    
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
    if (this.settings) {
      this.settings.setBrushSize(size);
    }
  }

  setBrushColor(color) {
    if (this.settings) {
      this.settings.setBrushColor(color);
    }
  }

  setBrushOpacity(opacity) {
    if (this.settings) {
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
      hasSettings: !!this.settings,
      eventBusReference: !!this.eventBus
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;