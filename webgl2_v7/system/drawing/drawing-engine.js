// ================================================================================
// drawing-engine.js - v8.14.0 WebGL2移行版（座標プロパティ名修正）
// ================================================================================
// 【親依存】
// - coordinate-system.js（座標変換）
// - system/camera-system.js（TegakiCameraSystem）
// - system/layer-system.js（TegakiLayerSystem）
// - system/drawing/brush-core.js（BrushCore）
// - system/drawing/pointer-handler.js（PointerHandler）
// - system/drawing/webgl2/webgl2-drawing-layer.js（WebGL2DrawingLayer）
// 【子依存】
// - core-engine.js（初期化呼び出し）
// ================================================================================
// 【責務】
// - PointerEvent受信・座標変換パイプライン実行
// - BrushCoreへの描画命令委譲
// - pendingPoints機構によるバッチ処理
// ================================================================================
// 【v8.14.0 修正内容】
// 🔧 _transformPointerToLocal(): プロパティ名修正
//    canvasCoords.x → canvasCoords.canvasX
//    worldCoords.x → worldCoords.worldX
//    localCoords.x → localCoords.localX
// ================================================================================

(function() {
  'use strict';

  if (!window.CoordinateSystem) {
    throw new Error('[DrawingEngine] coordinate-system.js required');
  }
  if (!window.BrushCore) {
    throw new Error('[DrawingEngine] brush-core.js required');
  }

  class DrawingEngine {
    constructor(app, layerManager, cameraSystem, history) {
      this.app = app;
      this.layerManager = layerManager;
      this.cameraSystem = cameraSystem;
      this.history = history;
      
      this.canvas = null;
      this.pointerHandler = null;
      this.brushSettings = null;
      
      this.isDrawing = false;
      this.pendingPoints = [];
      this.maxPendingPoints = 3;
      
      this._initializeCanvas();
      this._initializePointerHandler();
    }

    /**
     * Canvas初期化（WebGL2対応）
     * 🔧 Phase 1-4: WebGL2DrawingLayer参照に変更
     */
    _initializeCanvas() {
      // WebGL2DrawingLayer経由でCanvas取得
      if (window.WebGL2DrawingLayer && window.WebGL2DrawingLayer.getCanvas) {
        this.canvas = window.WebGL2DrawingLayer.getCanvas();
      }
      
      // Fallback: 直接DOM取得
      if (!this.canvas) {
        this.canvas = document.getElementById('webgpu-canvas') || 
                      document.getElementById('webgl2-canvas');
      }
      
      if (!this.canvas) {
        throw new Error('[DrawingEngine] Canvas not found');
      }

      console.log('[DrawingEngine] Canvas initialized:', this.canvas.id);
    }

    /**
     * PointerHandler初期化
     * ✅ 座標変換ロジック完全保持
     */
    _initializePointerHandler() {
      if (!window.PointerHandler) {
        throw new Error('[DrawingEngine] PointerHandler class not loaded');
      }

      this.pointerHandler = new window.PointerHandler(this.canvas);

      // PointerDown
      this.pointerHandler.on('pointerdown', (e) => {
        this._handlePointerDown(e);
      });

      // PointerMove
      this.pointerHandler.on('pointermove', (e) => {
        this._handlePointerMove(e);
      });

      // PointerUp
      this.pointerHandler.on('pointerup', (e) => {
        this._handlePointerUp(e);
      });

      console.log('[DrawingEngine] PointerHandler initialized');
    }

    /**
     * 🔀 PointerDown処理
     * ✅ 座標変換パイプライン完全保持
     */
    _handlePointerDown(e) {
      // 座標変換パイプライン
      const localCoords = this._transformPointerToLocal(e);
      if (!localCoords) {
        console.warn('[DrawingEngine] Coordinate transformation failed');
        return;
      }

      // BrushCore呼び出し
      if (window.BrushCore && typeof window.BrushCore.startStroke === 'function') {
        window.BrushCore.startStroke(
          localCoords.localX,
          localCoords.localY,
          e.pressure || 0.5,
          e
        );
      }

      this.isDrawing = true;
      this.pendingPoints = [];
    }

    /**
     * 🔀 PointerMove処理
     * ✅ pendingPoints機構保持
     */
    _handlePointerMove(e) {
      if (!this.isDrawing) return;

      const localCoords = this._transformPointerToLocal(e);
      if (!localCoords) return;

      // pendingPointsに追加
      this.pendingPoints.push({
        localX: localCoords.localX,
        localY: localCoords.localY,
        pressure: e.pressure || 0.5,
        timestamp: e.timeStamp || Date.now()
      });

      // maxPendingPoints到達でflush
      if (this.pendingPoints.length >= this.maxPendingPoints) {
        this.flushPendingPoints();
      }
    }

    /**
     * 🔀 PointerUp処理
     */
    _handlePointerUp(e) {
      if (!this.isDrawing) return;

      // 残りのポイントをflush
      this.flushPendingPoints();

      // BrushCore終了処理
      if (window.BrushCore && typeof window.BrushCore.finalizeStroke === 'function') {
        window.BrushCore.finalizeStroke();
      }

      this.isDrawing = false;
      this.pendingPoints = [];
    }

    /**
     * pendingPointsバッチ処理
     * ✅ 完全保持
     */
    flushPendingPoints() {
      if (this.pendingPoints.length === 0) return;

      if (window.BrushCore && typeof window.BrushCore.updateStroke === 'function') {
        this.pendingPoints.forEach(point => {
          window.BrushCore.updateStroke(
            point.localX,
            point.localY,
            point.pressure
          );
        });
      }

      this.pendingPoints = [];
    }

    /**
     * 座標変換パイプライン
     * 🔧 v8.14.0: プロパティ名修正（canvasX, worldX, localX）
     * 
     * PointerEvent.clientX/Y
     * → screenClientToCanvas() [DPI補正]
     * → canvasToWorld() [worldContainer逆行列]
     * → worldToLocal() [手動逆算・親チェーン遡査]
     * → Local座標確定
     */
    _transformPointerToLocal(e) {
      const coordSys = window.CoordinateSystem;
      if (!coordSys) return null;

      // 1. Screen → Canvas
      const canvasCoords = coordSys.screenClientToCanvas(e.clientX, e.clientY);
      if (!canvasCoords) return null;

      // 2. Canvas → World
      const worldCoords = coordSys.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
      if (!worldCoords) return null;

      // 3. World → Local
      const activeLayer = this.layerManager ? this.layerManager.getActiveLayer() : null;
      if (!activeLayer) {
        console.warn('[DrawingEngine] No active layer');
        return null;
      }

      const localCoords = coordSys.worldToLocal(
        worldCoords.worldX,
        worldCoords.worldY,
        activeLayer
      );

      if (!localCoords) return null;

      return {
        localX: localCoords.localX,
        localY: localCoords.localY,
        worldX: worldCoords.worldX,
        worldY: worldCoords.worldY,
        canvasX: canvasCoords.canvasX,
        canvasY: canvasCoords.canvasY
      };
    }

    /**
     * BrushSettings設定
     */
    setBrushSettings(brushSettings) {
      this.brushSettings = brushSettings;
      
      if (window.BrushCore && typeof window.BrushCore.setBrushSettings === 'function') {
        window.BrushCore.setBrushSettings(brushSettings);
      }
    }

    /**
     * キャンバスサイズ変更対応
     */
    resize(width, height) {
      if (!this.canvas) return;

      const dpr = 1; // DPR固定
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;

      // WebGL2 Viewport更新
      if (window.WebGL2DrawingLayer && window.WebGL2DrawingLayer.gl) {
        const gl = window.WebGL2DrawingLayer.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }

      console.log(`[DrawingEngine] Canvas resized: ${width}x${height}`);
    }

    /**
     * クリーンアップ
     */
    destroy() {
      if (this.pointerHandler) {
        this.pointerHandler.detach();
        this.pointerHandler = null;
      }

      this.pendingPoints = [];
      this.isDrawing = false;

      console.log('[DrawingEngine] Destroyed');
    }

    // Getter
    getCanvas() {
      return this.canvas;
    }

    getPointerHandler() {
      return this.pointerHandler;
    }

    isCurrentlyDrawing() {
      return this.isDrawing;
    }
  }

  // グローバル登録
  window.DrawingEngine = DrawingEngine;

  console.log('✅ drawing-engine.js v8.14.0 (Phase 1修正版) loaded');
  console.log('   🔧 座標プロパティ名修正: canvasX, worldX, localX');
  console.log('   ✅ 座標変換パイプライン完全保持');
  console.log('   ✅ pendingPoints機構維持');

})();