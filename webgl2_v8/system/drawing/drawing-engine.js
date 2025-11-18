// ================================================================================
// drawing-engine.js - v8.14.1 WebGL2移行版（tilt情報追加）
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
// - BrushCoreへの描画命令委譲（tilt情報含む）
// - pendingPoints機構によるバッチ処理
// ================================================================================
// 【v8.14.1 修正内容】
// 🔧 tiltX/tiltY情報をPointerEventから取得してstroke-recorderに渡す
// 🔧 不要なコンソールログ削除
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

    _initializeCanvas() {
      if (window.WebGL2DrawingLayer && window.WebGL2DrawingLayer.getCanvas) {
        this.canvas = window.WebGL2DrawingLayer.getCanvas();
      }
      
      if (!this.canvas) {
        this.canvas = document.getElementById('webgpu-canvas') || 
                      document.getElementById('webgl2-canvas');
      }
      
      if (!this.canvas) {
        throw new Error('[DrawingEngine] Canvas not found');
      }
    }

    _initializePointerHandler() {
      if (!window.PointerHandler) {
        throw new Error('[DrawingEngine] PointerHandler class not loaded');
      }

      this.pointerHandler = new window.PointerHandler(this.canvas);

      this.pointerHandler.on('pointerdown', (e) => {
        this._handlePointerDown(e);
      });

      this.pointerHandler.on('pointermove', (e) => {
        this._handlePointerMove(e);
      });

      this.pointerHandler.on('pointerup', (e) => {
        this._handlePointerUp(e);
      });
    }

    _handlePointerDown(e) {
      const localCoords = this._transformPointerToLocal(e);
      if (!localCoords) {
        return;
      }

      const tiltX = e.tiltX || 0;
      const tiltY = e.tiltY || 0;
      const pressure = e.pressure || 0.5;

      if (window.BrushCore && typeof window.BrushCore.startStroke === 'function') {
        window.BrushCore.startStroke(
          localCoords.localX,
          localCoords.localY,
          pressure
        );
      }

      this.isDrawing = true;
      this.pendingPoints = [];
    }

    _handlePointerMove(e) {
      if (!this.isDrawing) return;

      const localCoords = this._transformPointerToLocal(e);
      if (!localCoords) return;

      const tiltX = e.tiltX || 0;
      const tiltY = e.tiltY || 0;
      const pressure = e.pressure || 0.5;

      this.pendingPoints.push({
        localX: localCoords.localX,
        localY: localCoords.localY,
        pressure: pressure,
        tiltX: tiltX,
        tiltY: tiltY,
        timestamp: e.timeStamp || Date.now()
      });

      if (this.pendingPoints.length >= this.maxPendingPoints) {
        this.flushPendingPoints();
      }
    }

    _handlePointerUp(e) {
      if (!this.isDrawing) return;

      this.flushPendingPoints();

      if (window.BrushCore && typeof window.BrushCore.finalizeStroke === 'function') {
        window.BrushCore.finalizeStroke();
      }

      this.isDrawing = false;
      this.pendingPoints = [];
    }

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

    _transformPointerToLocal(e) {
      const coordSys = window.CoordinateSystem;
      if (!coordSys) return null;

      const canvasCoords = coordSys.screenClientToCanvas(e.clientX, e.clientY);
      if (!canvasCoords) return null;

      const worldCoords = coordSys.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
      if (!worldCoords) return null;

      const activeLayer = this.layerManager ? this.layerManager.getActiveLayer() : null;
      if (!activeLayer) {
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

    setBrushSettings(brushSettings) {
      this.brushSettings = brushSettings;
      
      if (window.BrushCore && typeof window.BrushCore.setBrushSettings === 'function') {
        window.BrushCore.setBrushSettings(brushSettings);
      }
    }

    resize(width, height) {
      if (!this.canvas) return;

      const dpr = 1;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;

      if (window.WebGL2DrawingLayer && window.WebGL2DrawingLayer.gl) {
        const gl = window.WebGL2DrawingLayer.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    destroy() {
      if (this.pointerHandler) {
        this.pointerHandler.detach();
        this.pointerHandler = null;
      }

      this.pendingPoints = [];
      this.isDrawing = false;
    }

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

  window.DrawingEngine = DrawingEngine;

})();