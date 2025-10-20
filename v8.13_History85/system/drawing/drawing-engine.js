/**
 * DrawingEngine v3.1 - Phase 1-3統合完全版（処理順序修正）
 * Perfect Freehand対応ベクターペンエンジン + History統合 + 筆圧対応
 * 
 * Phase 1: ゼロ荷重対応 + twist検出
 * Phase 2: Simplify.js統合
 * Phase 3: Catmull-Rom Spline統合
 * 
 * 🔧 v3.1修正内容:
 * - continueDrawing(): リアルタイムスムージングを削除（パフォーマンス改善）
 * - stopDrawing(): 処理順序を修正（Spline → Simplifyに変更）
 * - 座標数の爆発を防止
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
   * BrushSettingsからRecorder/Transformerへ設定を適用
   */
  applySyncSettings() {
    if (!this.settings) return;
    
    const currentSettings = this.settings.getCurrentSettings();
    
    // StrokeRecorderへのSimplify設定適用
    if (this.recorder && typeof this.recorder.setSimplifySettings === 'function') {
      this.recorder.setSimplifySettings(
        currentSettings.simplifyTolerance,
        true // highQuality
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
    
    // 筆圧補正の変更を購読
    this.eventBus.on('settings:pressure-correction', ({ value }) => {
      if (this.settings) {
        this.settings.setPressureCorrection(value);
      }
      if (this.pressureHandler) {
        this.pressureHandler.setPressureCorrection(value);
      }
    });
    
    // 線補正（スムージング）の変更を購読
    this.eventBus.on('settings:smoothing', ({ value }) => {
      if (this.settings) {
        this.settings.setSmoothing(value);
      }
    });
    
    // 筆圧カーブの変更を購読
    this.eventBus.on('settings:pressure-curve', ({ curve }) => {
      if (this.settings) {
        this.settings.setPressureCurve(curve);
      }
    });
    
    // === Phase 2: Simplify.js設定 ===
    
    // Simplify許容誤差の変更を購読
    this.eventBus.on('settings:simplify-tolerance', ({ value }) => {
      if (this.settings) {
        this.settings.setSimplifyTolerance(value);
      }
      if (this.recorder) {
        this.recorder.setSimplifySettings(value, true);
      }
    });
    
    // Simplify有効/無効の変更を購読
    this.eventBus.on('settings:simplify-enabled', ({ enabled }) => {
      if (this.settings) {
        this.settings.setSimplifyEnabled(enabled);
      }
      if (this.recorder) {
        this.recorder.setSimplifyEnabled(enabled);
      }
    });
    
    // === Phase 3: Catmull-Rom Spline設定 ===
    
    // スムージングモードの変更を購読
    this.eventBus.on('settings:smoothing-mode', ({ mode }) => {
      if (this.settings) {
        this.settings.setSmoothingMode(mode);
      }
      if (this.transformer) {
        this.transformer.setSmoothingMode(mode);
      }
    });
    
    // スプライン張力の変更を購読
    this.eventBus.on('settings:spline-tension', ({ value }) => {
      if (this.settings) {
        this.settings.setSplineTension(value);
      }
      if (this.transformer) {
        const segments = this.settings.splineSegments;
        this.transformer.setSplineParameters(value, segments);
      }
    });
    
    // スプラインセグメント数の変更を購読
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
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  startDrawing(screenX, screenY, pressureOrEvent) {
    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // 現在のズーム率取得
    const currentScale = this.cameraSystem.camera.scale || 1;

    // ストロークオプション取得（ズーム対応サイズ）
    const strokeOptions = this.settings.getStrokeOptions();
    const scaledSize = this.renderer.getScaledSize(this.settings.getBrushSize(), currentScale);
    strokeOptions.size = scaledSize;

    // 新規パス開始
    this.currentPath = this.recorder.startNewPath(
      { x: canvasPoint.x, y: canvasPoint.y, pressure },
      this.currentTool === 'eraser' ? this.config.background.color : this.settings.getBrushColor(),
      this.settings.getBrushSize(),
      this.settings.getBrushOpacity(),
      this.currentTool,
      strokeOptions
    );

    // 元サイズとスケール記録
    this.currentPath.originalSize = this.settings.getBrushSize();
    this.currentPath.scaleAtDrawTime = currentScale;

    // Graphics作成
    this.currentPath.graphics = new PIXI.Graphics();
    
    this.isDrawing = true;
  }

  /**
   * 描画継続（v3.1: リアルタイムスムージング削除）
   * @param {number} screenX
   * @param {number} screenY
   * @param {number|PointerEvent} pressureOrEvent
   */
  continueDrawing(screenX, screenY, pressureOrEvent) {
    if (!this.isDrawing || !this.currentPath) return;

    const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY);
    const pressure = this.pressureHandler.getPressure(pressureOrEvent);

    // 座標追加
    this.recorder.addPoint(this.currentPath, {
      x: canvasPoint.x,
      y: canvasPoint.y,
      pressure
    });

    // リアルタイム描画（スムージングなし・高速）
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
   * 描画終了（v3.1: 処理順序修正 - Spline → Simplify）
   */
  stopDrawing() {
    if (!this.isDrawing || !this.currentPath) return;

    // 🔄 正しい処理順序: Spline → Simplify
    
    // Step 1: Catmull-Rom Splineスムージング適用
    if (this.transformer && this.currentPath.points.length > 2) {
      this.currentPath.points = this.transformer.preprocessStroke(this.currentPath.points);
    }
    
    // Step 2: Simplify最適化（Spline後の座標を最適化）
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

    // History統合
    if (this.currentPath && this.currentPath.points.length > 0) {
      const path = this.currentPath;
      const layerIndex = this.layerManager.activeLayerIndex;
      
      // History に記録
      if (window.History && !window.History._manager.isApplying) {
        const command = {
          name: 'stroke-added',
          do: () => {
            this.layerManager.addPathToActiveLayer(path);
          },
          undo: () => {
            // アクティブレイヤーから path を削除
            const activeLayer = this.layerManager.getActiveLayer();
            if (activeLayer?.layerData?.paths) {
              activeLayer.layerData.paths = 
                activeLayer.layerData.paths.filter(p => p !== path);
            }
            // 互換性維持
            if (activeLayer?.paths) {
              activeLayer.paths = activeLayer.paths.filter(p => p !== path);
            }
            
            // Graphics を破棄
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

    // 筆圧ハンドラーリセット
    this.pressureHandler.reset();

    this.isDrawing = false;
    this.currentPath = null;
  }

  /**
   * ツール設定
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
    this.settings.setBrushSize(size);
  }

  /**
   * ブラシ色設定
   * @param {number} color
   */
  setBrushColor(color) {
    this.settings.setBrushColor(color);
  }

  /**
   * ブラシ不透明度設定
   * @param {number} opacity
   */
  setBrushOpacity(opacity) {
    this.settings.setBrushOpacity(opacity);
  }

  /**
   * 現在のツール取得
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
   */
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