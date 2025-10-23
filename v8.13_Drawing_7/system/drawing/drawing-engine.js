/**
 * DrawingEngine - 座標変換修正版
 * 
 * ✅ 修正:
 * - event.global (PIXI座標) → canvasContainer.toLocal() で直接変換
 * - BrushSettings.getCurrentSettings() 使用
 * - PressureHandler統合の安全化
 */

class DrawingEngine {
  constructor(app, layerSystem, cameraSystem, historyManager) {
    this.app = app;
    this.layerManager = layerSystem;
    this.cameraSystem = cameraSystem;
    this.historyManager = historyManager;
    
    this.eventBus = window.TegakiEventBus;
    this.config = window.TEGAKI_CONFIG || {};

    // サブモジュール初期化
    this.toolManager = null;
    this.dataManager = null;
    this.settings = null;
    this.recorder = null;
    this.renderer = null;
    this.pressureHandler = null;
    this.transformer = null;

    if (window.TegakiDrawing) {
      this.toolManager = window.TegakiDrawing.ToolManager ? 
        new window.TegakiDrawing.ToolManager(this.eventBus) : null;
      
      this.dataManager = window.TegakiDrawing.StrokeDataManager ? 
        new window.TegakiDrawing.StrokeDataManager(this.eventBus) : null;

      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(this.config, this.eventBus) : null;
      
      this.pressureHandler = window.TegakiDrawing.PressureHandler ? 
        new window.TegakiDrawing.PressureHandler() : null;
      
      this.recorder = window.TegakiDrawing.StrokeRecorder ? 
        new window.TegakiDrawing.StrokeRecorder(this.pressureHandler, this.cameraSystem) : null;
      
      this.renderer = window.TegakiDrawing.StrokeRenderer ? 
        new window.TegakiDrawing.StrokeRenderer(this.app) : null;
      
      this.transformer = window.TegakiDrawing.StrokeTransformer ? 
        new window.TegakiDrawing.StrokeTransformer(this.config) : null;
    }

    // 描画状態
    this.isDrawing = false;
    this.currentTool = 'pen';
    this.currentPath = null;
    this.lastPoint = null;
    
    // Renderer初期化時にツール設定
    if (this.renderer && typeof this.renderer.setTool === 'function') {
      this.renderer.setTool(this.currentTool);
    }
    
    // イベント購読
    this.subscribeToSettings();
    this.subscribeToStrokeData();
    this.subscribeToToolEvents();
    
    // 初期設定同期
    this.applySyncSettings();
  }

  /**
   * ツール切り替えイベント購読
   */
  subscribeToToolEvents() {
    if (!this.eventBus) return;
    
    this.eventBus.on('tool:changed', ({ to, tool }) => {
      this.currentTool = to;
      if (this.renderer && typeof this.renderer.setTool === 'function') {
        this.renderer.setTool(to);
      }
    });
    
    this.eventBus.on('tool:select', ({ tool }) => {
      this.setTool(tool);
    });
  }

  /**
   * StrokeDataManager イベント購読
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
   * 再描画リクエスト
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
   * 初期設定の同期
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
      if (this.settings && typeof this.settings.setPressureCorrection === 'function') {
        this.settings.setPressureCorrection(value);
      }
      if (this.pressureHandler && typeof this.pressureHandler.setPressureCorrection === 'function') {
        this.pressureHandler.setPressureCorrection(value);
      }
    });
    
    this.eventBus.on('settings:smoothing', ({ value }) => {
      if (this.settings && typeof this.settings.setSmoothing === 'function') {
        this.settings.setSmoothing(value);
      }
    });
    
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      if (this.settings && typeof this.settings.setPressureCurve === 'function') {
        this.settings.setPressureCurve(curve);
      }
    });
    
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      if (this.settings && typeof this.settings.setSimplifyTolerance === 'function') {
        this.settings.setSimplifyTolerance(value);
      }
      if (this.recorder) this.recorder.setSimplifySettings(value, true);
    });
    
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      if (this.settings && typeof this.settings.setSimplifyEnabled === 'function') {
        this.settings.setSimplifyEnabled(enabled);
      }
      if (this.recorder) this.recorder.setSimplifyEnabled(enabled);
    });
    
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      if (this.settings && typeof this.settings.setSmoothingMode === 'function') {
        this.settings.setSmoothingMode(mode);
      }
      if (this.transformer) this.transformer.setSmoothingMode(mode);
    });
    
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      if (this.settings && typeof this.settings.setSplineTension === 'function') {
        this.settings.setSplineTension(value);
      }
      if (this.transformer) {
        const segments = this.settings?.splineSegments || 20;
        this.transformer.setSplineParameters(value, segments);
      }
    });
    
    this.eventBus.on('settings:spline-segments', ({ value }) => {
      if (this.settings && typeof this.settings.setSplineSegments === 'function') {
        this.settings.setSplineSegments(value);
      }
      if (this.transformer) {
        const tension = this.settings?.splineTension || 0.5;
        this.transformer.setSplineParameters(tension, value);
      }
    });
  }

  /**
   * 筆圧取得（安全なフォールバック付き）
   */
  _getPressure(pressureOrEvent) {
    if (this.pressureHandler && typeof this.pressureHandler.getCalibratedPressure === 'function') {
      return this.pressureHandler.getCalibratedPressure(pressureOrEvent);
    }
    
    if (typeof pressureOrEvent === 'number') {
      return Math.max(0, Math.min(1, pressureOrEvent));
    }
    if (pressureOrEvent?.pressure !== undefined) {
      return Math.max(0, Math.min(1, pressureOrEvent.pressure));
    }
    return 0.5;
  }

  /**
   * 🔧 PIXI global座標 → レイヤーローカル座標変換
   */
  _globalToLayerLocal(globalX, globalY) {
    if (!this.cameraSystem?.canvasContainer) {
      return { x: globalX, y: globalY };
    }
    
    // PIXI global座標をcanvasContainerのローカル座標に変換
    return this.cameraSystem.canvasContainer.toLocal({ x: globalX, y: globalY });
  }

  /**
   * 描画開始
   * ✅ 修正: event.global (PIXI座標) を直接変換
   */
  startDrawing(globalX, globalY, pressureOrEvent) {
    if (!this.cameraSystem || !this.settings || !this.recorder || !this.renderer) {
      return;
    }

    // PIXI global座標 → レイヤーローカル座標
    const layerPoint = this._globalToLayerLocal(globalX, globalY);

    const pressure = this._getPressure(pressureOrEvent);
    const currentScale = this.cameraSystem.worldContainer?.scale?.x || 1;

    // BrushSettings.getCurrentSettings() を使用
    const currentSettings = this.settings.getCurrentSettings();
    const strokeOptions = {
      size: currentSettings.size,
      color: currentSettings.color,
      alpha: currentSettings.alpha
    };

    const scaledSize = this.renderer.calculateWidth 
      ? this.renderer.calculateWidth(pressure, this.settings.getSize())
      : this.settings.getSize() * pressure;
    
    strokeOptions.size = scaledSize;

    this.currentPath = {
      points: [{ x: layerPoint.x, y: layerPoint.y, pressure }],
      color: this.currentTool === 'eraser' ? this.config.background?.color || 0xFFFFFF : this.settings.getColor(),
      size: this.settings.getSize(),
      opacity: this.settings.getAlpha(),
      tool: this.currentTool,
      strokeOptions: strokeOptions,
      originalSize: this.settings.getSize(),
      scaleAtDrawTime: currentScale,
      graphics: new PIXI.Graphics()
    };
    
    this.isDrawing = true;
    this.lastPoint = { x: layerPoint.x, y: layerPoint.y };
  }

  /**
   * 描画継続
   * ✅ 修正: event.global (PIXI座標) を直接変換
   */
  continueDrawing(globalX, globalY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;
    if (!this.cameraSystem || !this.renderer) return;

    // PIXI global座標 → レイヤーローカル座標
    const layerPoint = this._globalToLayerLocal(globalX, globalY);

    const pressure = this._getPressure(pressureOrEvent);

    this.currentPath.points.push({
      x: layerPoint.x,
      y: layerPoint.y,
      pressure
    });

    const settings = {
      color: this.currentPath.color,
      size: this.currentPath.size,
      alpha: this.currentPath.opacity
    };

    if (this.renderer.renderPreview) {
      this.renderer.renderPreview(this.currentPath.points, settings);
    }

    this.lastPoint = { x: layerPoint.x, y: layerPoint.y };
  }

  /**
   * 描画終了
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;
    if (!this.renderer || !this.layerManager) return;

    // ストロークデータ確定
    const isSingleDot = this.currentPath.points.length <= 2 && 
      this._getTotalDistance(this.currentPath.points) < 2;

    const strokeData = {
      points: [...this.currentPath.points],
      isSingleDot: isSingleDot
    };

    const settings = {
      color: this.currentPath.color,
      size: this.currentPath.size,
      alpha: this.currentPath.opacity
    };

    // 最終描画
    const graphics = this.renderer.renderFinalStroke(strokeData, settings);

    // History統合
    if (this.currentPath.points.length > 0) {
      const path = {
        ...this.currentPath,
        graphics: graphics
      };
      
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

    // StrokeDataManager へ登録
    if (this.dataManager && this.currentPath.points.length > 0) {
      const strokeDataRecord = {
        points: [...this.currentPath.points],
        color: this.currentPath.color,
        size: this.currentPath.size,
        opacity: this.currentPath.opacity,
        tool: this.currentPath.tool,
        isSingleDot: isSingleDot
      };
      this.dataManager.addStroke(strokeDataRecord);
    }

    this.isDrawing = false;
    this.currentPath = null;
    this.lastPoint = null;
  }

  /**
   * ストローク総距離計算（内部用）
   */
  _getTotalDistance(points) {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
    return totalDistance;
  }

  /**
   * ツール設定
   */
  setTool(tool) {
    if (tool === 'pen' || tool === 'eraser') {
      this.currentTool = tool;
      
      if (this.renderer && typeof this.renderer.setTool === 'function') {
        this.renderer.setTool(tool);
      }
      
      if (this.eventBus) {
        this.eventBus.emit('toolChanged', { tool });
      }
    }
  }

  /**
   * BrushSettings互換API
   */
  setBrushSettings(brushSettings) {
    if (brushSettings) {
      this.settings = brushSettings;
    }
  }

  getBrushSettings() {
    return this.settings;
  }

  setBrushSize(size) {
    if (this.settings && typeof this.settings.setSize === 'function') {
      this.settings.setSize(size);
    }
  }

  setBrushColor(color) {
    if (this.settings && typeof this.settings.setColor === 'function') {
      this.settings.setColor(color);
    }
  }

  setBrushOpacity(opacity) {
    if (this.settings && typeof this.settings.setOpacity === 'function') {
      this.settings.setOpacity(opacity);
    }
  }

  getCurrentTool() {
    return this.currentTool;
  }

  getIsDrawing() {
    return this.isDrawing;
  }
  
  /**
   * デバッグ情報取得
   */
  getDebugInfo() {
    return {
      settings: this.settings?.getCurrentSettings?.() || null,
      currentTool: this.currentTool,
      isDrawing: this.isDrawing,
      hasRenderer: !!this.renderer,
      rendererTool: this.renderer?.currentTool || null,
      cameraSystem: {
        hasCanvasContainer: !!this.cameraSystem?.canvasContainer,
        canvasContainerExists: !!this.cameraSystem?.canvasContainer
      },
      toolManager: this.toolManager ? {
        currentTool: this.toolManager.currentTool,
        registeredTools: this.toolManager.getRegisteredToolNames?.() || []
      } : null,
      dataManager: this.dataManager ? {
        strokeCount: this.dataManager.getStrokeCount?.() || 0
      } : null
    };
  }
}

if (typeof window.TegakiDrawing === 'undefined') {
  window.TegakiDrawing = {};
}
window.TegakiDrawing.DrawingEngine = DrawingEngine;