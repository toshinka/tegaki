/**
 * ================================================================================
 * drawing-engine.js Phase 2完全版: WebGPU Canvas接続確立
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - system/drawing/brush-core.js (BrushCore)
 *   - system/drawing/pointer-handler.js (PointerHandler)
 *   - system/drawing/webgpu/webgpu-drawing-layer.js (WebGPUDrawingLayer)
 *   - coordinate-system.js (CoordinateSystem)
 *   - system/camera-system.js (CameraSystem)
 *   - system/layer-system.js (LayerSystem)
 *   - system/event-bus.js (EventBus)
 * 
 * 📄 子ファイル使用先:
 *   - core-engine.js (flushPendingPoints呼び出し)
 * 
 * 【責務】
 * - WebGPU Canvas接続管理
 * - 座標変換パイプライン（Screen→Canvas→World→Local）
 * - PointerEventのキューイング
 * - Master Loop連携
 * 
 * 【Phase 2完全改修内容】
 * ✅ WebGPUDrawingLayer.getCanvas()からCanvas取得
 * ✅ Canvas ID厳密検証
 * ✅ activePointers管理の確実化
 * 
 * 【PixiJS使用制限】
 * - PixiJS は UI ホスト専用
 * - pointer イベントは WebGPU Canvas が担当
 * - 描画処理は WebGPU が担当
 * 
 * ================================================================================
 */

let pendingPoints = [];

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        this.brushCore = window.BrushCore;
        if (!this.brushCore) {
            throw new Error('[DrawingEngine] window.BrushCore not initialized');
        }

        this.brushSettings = null;
        this.pointerDetach = null;
        this.coordSystem = window.CoordinateSystem;
        this.eventBus = window.TegakiEventBus || window.eventBus;
        this.activePointers = new Map();
        
        this._initializeCanvas();
    }

    _initializeCanvas() {
        // WebGPUDrawingLayer から Canvas取得
        let canvas = null;
        
        if (window.WebGPUDrawingLayer && window.WebGPUDrawingLayer.isInitialized()) {
            try {
                canvas = window.WebGPUDrawingLayer.getCanvas();
            } catch (e) {
                console.warn('[DrawingEngine] Failed to get canvas from WebGPUDrawingLayer:', e);
            }
        }
        
        // フォールバック: DOM直接取得
        if (!canvas) {
            canvas = document.getElementById('webgpu-canvas');
        }
        
        if (!canvas) {
            throw new Error('[DrawingEngine] Canvas not found');
        }

        // Canvas ID検証
        if (canvas.id !== 'webgpu-canvas') {
            throw new Error(`[DrawingEngine] Invalid canvas: ${canvas.id}. Expected: webgpu-canvas`);
        }

        canvas.style.touchAction = 'none';

        if (!window.PointerHandler) {
            throw new Error('[DrawingEngine] window.PointerHandler not available');
        }

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        console.log('[DrawingEngine] PointerEvents attached to:', canvas.id);
    }

    flushPendingPoints() {
        if (pendingPoints.length === 0) return;

        for (const point of pendingPoints) {
            if (point.type === 'begin') {
                this._processPointerDown(point.info);
            } else if (point.type === 'move') {
                this._processPointerMove(point.info);
            } else if (point.type === 'end') {
                this._processPointerUp(point.info);
            }
        }

        pendingPoints = [];
    }

    _handlePointerDown(info, e) {
        if (this.cameraSystem?.isCanvasMoveMode()) return;
        if (this.layerSystem?.vKeyPressed) return;
        if (info.button === 2) return;

        pendingPoints.push({ type: 'begin', info });
    }

    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) return;

        pendingPoints.push({ type: 'move', info });
    }

    _handlePointerUp(info, e) {
        pendingPoints.push({ type: 'end', info });
        this.activePointers.delete(info.pointerId);
    }

    _handlePointerCancel(info, e) {
        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }
        this.activePointers.delete(info.pointerId);
    }

    _processPointerDown(info) {
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.error('[DrawingEngine] Local coords conversion failed');
            return;
        }

        const currentMode = this.brushCore.getMode();
        
        if (currentMode === 'fill') {
            if (this.eventBus) {
                this.eventBus.emit('canvas:pointerdown', {
                    localX: localCoords.localX,
                    localY: localCoords.localY,
                    clientX: info.clientX,
                    clientY: info.clientY,
                    pressure: info.pressure,
                    pointerType: info.pointerType
                });
            }
            return;
        }

        // activePointers登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                localCoords.localX,
                localCoords.localY,
                info.pressure,
                info.pointerType
            );
        }
    }

    _processPointerMove(info) {
        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) return;

        if (this.brushCore.updateStroke) {
            this.brushCore.updateStroke(
                localCoords.localX,
                localCoords.localY,
                info.pressure,
                info.pointerType
            );
        }
    }

    _processPointerUp(info) {
        if (this.brushCore && this.brushCore.isActive && this.brushCore.isActive()) {
            if (this.brushCore.finalizeStroke) {
                this.brushCore.finalizeStroke();
            }
        }
    }

    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            console.error('[DrawingEngine] CoordinateSystem not available');
            return null;
        }

        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) return null;

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) return null;

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) return null;

        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    setBrushSettings(settings) {
        this.brushSettings = settings;
    }

    get isDrawing() {
        return this.brushCore && this.brushCore.isActive ? this.brushCore.isActive() : false;
    }

    destroy() {
        if (this.pointerDetach) {
            this.pointerDetach();
            this.pointerDetach = null;
        }
        this.activePointers.clear();
        pendingPoints = [];
    }
}

window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js Phase 2 loaded');