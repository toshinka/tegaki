/**
 * DrawingEngine v4.0 - Phase 1: ツール基盤の構築
 * Perfect Freehand対応ベクターペンエンジン + ツールアーキテクチャ
 * 
 * 改修内容:
 * - ToolManager 統合: ツール切り替え機構の導入
 * - StrokeDataManager 統合: データ管理の一元化
 * - 座標変換のみ担当: ワールド座標をツールに委譲
 * 
 * Phase 1では既存のペン描画機能を維持しつつ、
 * Phase 2でPenToolへの移行を準備
 */

class DrawingEngine {
  constructor(app, layerManager, cameraSystem, historyManager) {
    // 引数の順序を既存のcore-engine.jsに合わせる
    this.app = app;
    this.layerManager = layerManager;
    this.cameraSystem = cameraSystem;
    this.historyManager = historyManager;
    
    // EventBusとConfigをグローバルから取得
    this.eventBus = window.TegakiEventBus;
    this.config = window.TEGAKI_CONFIG || {};

    // === Phase 1: 新規追加 ===
    
    // EventBusの存在確認
    if (!this.eventBus) {
      console.error('DrawingEngine: EventBus is not available');
    }
    
    // ToolManager初期化
    this.toolManager = window.TegakiDrawing?.ToolManager ? 
      new window.TegakiDrawing.ToolManager(this.eventBus) : null;
    
    // StrokeDataManager初期化
    this.dataManager = window.TegakiDrawing?.StrokeDataManager ? 
      new window.TegakiDrawing.StrokeDataManager(this.eventBus) : null;

    // === 既存サブモジュール初期化 ===
    
    if (window.TegakiDrawing) {
      this.settings = window.TegakiDrawing.BrushSettings ? 
        new window.TegakiDrawing.BrushSettings(this.config, this.eventBus) : null;
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
    this.currentTool = 'pen'; // Phase 2でtoolManager経由に移行
    this.currentPath = null;
    this.lastPoint = null;
    
    // EventBus購読の初期化
    this.subscribeToSettings();
    this.subscribeToStrokeEvents(); // Phase 1追加
    
    // Phase 2-3: 初期設定をサブモジュールに同期
    this.applySyncSettings();
  }

  /**
   * Phase 1: StrokeDataManagerイベント購読
   * ストローク追加・削除時の再描画トリガー
   */
  subscribeToStrokeEvents() {
    if (!this.eventBus) return;
    
    // ストローク追加時の処理（将来の再描画用）
    this.eventBus.on('stroke:added', ({ id, strokeData }) => {
      // Phase 5で実装: RenderPipelineによる再描画
    });
    
    // ストローク削除時の処理
    this.eventBus.on('stroke:removed', ({ id }) => {
      // Phase 5で実装: RenderPipelineによる再描画
    });
    
    // ストローク更新時の処理
    this.eventBus.on('stroke:updated', ({ id, strokeData }) => {
      // Phase 5で実装: RenderPipelineによる再描画
    });
  }

  /**
   * Phase 2-3: 初期設定の同期
   * BrushSettingsからRecorder/Transformerへ設定を適用
   */
  applySyncSettings() {
    if (!this.settings) return;
    
    const currentSettings = this.settings.getCurrentSettings();
    
    // StrokeRecorderへのSimplify設定適用
    if (this.recorder && typeof this.recorder.setSimplifySettings === 'function') {
      this.recorder.setSimplifySettings(
        currentSettings.simplifyTolerance,
        true
      );
    }
    if (this.recorder && typeof this.recorder.setSimplifyEnabled === 'function') {
      this.recorder.setSimplifyEnabled(currentSettings.simplifyEnabled);
    }
    
    // StrokeTransformerへのSpline設定適用
    if (this.transformer && typeof this.transformer.setSmoothingMode === 'function') {
      this.transformer.setSmoothingMode(currentSettings.smoothingMode);
    }
    if (this.transformer && typeof this.transformer.setSplineParameters === 'function') {
      this.transformer.setSplineParameters(
        currentSettings.splineTension,
        currentSettings.splineSegments
      );
    }
    
    // PressureHandlerへの筆圧補正適用
    if (this.pressureHandler && typeof this.pressureHandler.setPressureCorrection === 'function') {
      this.pressureHandler.setPressureCorrection(currentSettings.pressureCorrection);
    }
  }

  /**
   * Phase 1-3: EventBus購読の設定（拡張版）
   * 設定変更イベントを購読し、各サブモジュールに即座に適用
   */
  subscribeToSettings() {
    if (!this.eventBus) return;
    
    // === Phase 1: 筆圧・線補正 ===
    
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
    
    // === Phase 2: Simplify.js設定 ===
    
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
    
    // === Phase 3: Catmull-Rom Spline設定 ===
    
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
   * Phase 1: 座標変換後、既存処理を維持
   * Phase 2: ToolManager経由に移行予定
   * 
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  startDrawing(screenX, screenY, pressureOrEvent) {
    // 座標変換: Screen → Canvas (World)
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // Phase 2では以下のようにツールに委譲:
    // const tool = this.toolManager.getCurrentTool();
    // if (tool) {
    //   tool.onPointerDown(canvasPoint, pressure);
    //   return;
    // }

    // === 既存のペン描画処理（Phase 2まで維持） ===
    
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
   * Phase 1: 座標変換後、既存処理を維持
   * 
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    // 座標変換: Screen → Canvas (World)
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // Phase 2では以下のようにツールに委譲:
    // const tool = this.toolManager.getCurrentTool();
    // if (tool) {
    //   tool.onPointerMove(canvasPoint, pressure);
    //   return;
    // }

    // === 既存のペン描画処理（Phase 2まで維持） ===
    
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
   * Phase 1: 既存処理を維持しつつ、DataManagerへの追加を準備
   * 
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // Phase 2では以下のようにツールに委譲:
    // const tool = this.toolManager.getCurrentTool();
    // if (tool) {
    //   const canvasPoint = { x: 0, y: 0 }; // 最終位置
    //   tool.onPointerUp(canvasPoint, 0);
    //   this.isDrawing = false;
    //   return;
    // }

    // === 既存のペン描画処理（Phase 2まで維持） ===
    
    // 正しい処理順序: Spline → Simplify
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

    // Phase 1: DataManagerへの追加（将来実装）
    // if (this.currentPath && this.currentPath.points.length > 0) {
    //   this.dataManager.addStroke({
    //     points: this.currentPath.points,
    //     color: this.currentPath.color,
    //     size: this.currentPath.originalSize,
    //     opacity: this.currentPath.opacity,
    //     tool: this.currentTool
    //   });
    // }

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
   * Phase 1: 既存処理を維持
   * Phase 2: toolManager.switchTool() に移行予定
   * 
   * @param {string} tool - 'pen' | 'eraser'
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
   * @param {number} size
   */
  setBrushSize(size) {
    if (this.settings) {
      this.settings.setBrushSize(size);
    }
  }

  /**
   * ブラシ色設定
   * @param {number} color
   */
  setBrushColor(color) {
    if (this.settings) {
      this.settings.setBrushColor(color);
    }
  }

  /**
   * ブラシ不透明度設定
   * @param {number} opacity
   */
  setBrushOpacity(opacity) {
    if (this.settings) {
      this.settings.setBrushOpacity(opacity);
    }
  }

  /**
   * 現在のツール取得
   * Phase 2: toolManager.getCurrentToolName() に移行予定
   * 
   * @returns {string}
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * 描画中かチェック
   * @returns {boolean}
   */
  getIsDrawing() {
    return this.isDrawing;
  }
  
  /**
   * デバッグ情報取得
   * Phase 1: toolManager, dataManager 追加
   */
  getDebugInfo() {
    return {
      toolManager: {
        currentTool: this.toolManager?.getCurrentToolName(),
        registeredTools: this.toolManager?.getRegisteredToolNames()
      },
      dataManager: {
        strokeCount: this.dataManager?.getStrokeCount()
      },
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