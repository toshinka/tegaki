/**
 * drawing-engine.js
 * 統合・公開API
 * Version: 1.0.0
 * 
 * 【責務】
 * - 各サブモジュールの初期化・統合
 * - 外部からの描画操作API提供
 * - EventBus連携
 * - History連携の橋渡し
 */

(function(global) {
  'use strict';

  class DrawingEngine {
    constructor(cameraSystem, layerManager, eventBus, config) {
      this.cameraSystem = cameraSystem;
      this.layerManager = layerManager;
      this.eventBus = eventBus;
      this.config = config;

      // サブモジュール初期化
      this.settings = new global.TegakiDrawing.BrushSettings(config, eventBus);
      this.recorder = new global.TegakiDrawing.StrokeRecorder();
      this.renderer = new global.TegakiDrawing.StrokeRenderer(config);
      this.pressureHandler = new global.TegakiDrawing.PressureHandler();
      this.transformer = new global.TegakiDrawing.StrokeTransformer(config);

      // 描画状態
      this.currentTool = 'pen';
      this.isDrawing = false;
      this.currentPath = null;
    }

    /**
     * 描画開始
     * @param {number} screenX
     * @param {number} screenY
     * @param {number|PointerEvent} pressureOrEvent
     */
    startDrawing(screenX, screenY, pressureOrEvent) {
      // 座標変換
      const worldPos = this.cameraSystem.screenToWorld(screenX, screenY);
      
      // 筆圧取得
      const pressure = typeof pressureOrEvent === 'object' 
        ? this.pressureHandler.getPressure(pressureOrEvent)
        : (pressureOrEvent || 0.5);

      const point = {
        x: worldPos.x,
        y: worldPos.y,
        pressure: pressure
      };

      // パス開始
      const strokeOptions = this.settings.getStrokeOptions();
      this.currentPath = this.recorder.startNewPath(
        point,
        this.settings.getBrushColor(),
        this.settings.getBrushSize(),
        this.settings.getBrushOpacity(),
        this.currentTool,
        strokeOptions
      );

      // Graphics生成
      this.currentPath.graphics = new PIXI.Graphics();
      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer && activeLayer.container) {
        activeLayer.container.addChild(this.currentPath.graphics);
      }

      this.isDrawing = true;

      // 初回描画
      this.renderer.renderStroke(
        this.currentPath.points,
        this.currentPath.strokeOptions,
        this.currentPath.graphics
      );
    }

    /**
     * 描画継続
     * @param {number} screenX
     * @param {number} screenY
     * @param {number|PointerEvent} pressureOrEvent
     */
    continueDrawing(screenX, screenY, pressureOrEvent) {
      if (!this.isDrawing || !this.currentPath) return;

      // 座標変換
      const worldPos = this.cameraSystem.screenToWorld(screenX, screenY);

      // 筆圧取得
      const pressure = typeof pressureOrEvent === 'object'
        ? this.pressureHandler.getPressure(pressureOrEvent)
        : (pressureOrEvent || 0.5);

      const point = {
        x: worldPos.x,
        y: worldPos.y,
        pressure: pressure
      };

      // ポイント追加
      this.recorder.addPoint(this.currentPath, point);

      // 再描画
      this.renderer.renderStroke(
        this.currentPath.points,
        this.currentPath.strokeOptions,
        this.currentPath.graphics
      );
    }

    /**
     * 描画終了
     */
    stopDrawing() {
      if (!this.isDrawing || !this.currentPath) return;

      // パス完了
      this.recorder.finalizePath(this.currentPath);

      // History登録（最小限のデータ）
      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer && this.eventBus) {
        const pathDataClone = this.recorder.clonePathData(this.currentPath);
        
        this.eventBus.emit('drawing:stroke-completed', {
          layerId: activeLayer.id,
          pathData: pathDataClone
        });
      }

      // リセット