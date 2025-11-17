/**
 * ================================================================================
 * drawing-engine.js Phase 1-2: PointerEvent配信デバッグ強化版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - system/drawing/brush-core.js (BrushCore)
 *   - system/drawing/pointer-handler.js (PointerHandler)
 *   - coordinate-system.js (CoordinateSystem)
 *   - system/camera-system.js (CameraSystem)
 *   - system/layer-system.js (LayerSystem)
 *   - system/event-bus.js (EventBus)
 * 
 * 📄 子ファイル使用先:
 *   - core-engine.js (flushPendingPoints()呼び出し)
 * 
 * 【責務】
 * - 座標変換パイプライン（Screen→Canvas→World→Local）
 * - PointerEventのキューイング
 * - Master Loop連携（rAF発行禁止）
 * 
 * 【Phase 1-2改修内容】
 * 🔧 WebGPU Canvas専用接続の明示化
 * 🔧 PointerEvent配信フローのデバッグログ追加
 * 🔧 activePointers管理の厳密化
 * 
 * 【PixiJS使用制限】
 * - PixiJS は UI ホスト専用
 * - pointer イベントの一次取得は WebGPU Canvas が担当
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
            console.error('[DrawingEngine] window.BrushCore not initialized');
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
        // 🔧 WebGPU Canvas専用接続を明示
        const canvas = document.getElementById('webgpu-canvas') || this.app.canvas || this.app.view;
        
        if (!canvas) {
            console.error('[DrawingEngine] Canvas not found');
            return;
        }

        if (canvas.id !== 'webgpu-canvas') {
            console.warn('[DrawingEngine] Canvas is not webgpu-canvas:', canvas.id);
        }

        canvas.style.touchAction = 'none';

        if (!window.PointerHandler) {
            console.error('[DrawingEngine] window.PointerHandler not available');
            return;
        }

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        console.log('[DrawingEngine] Pointer events attached to:', canvas.id);
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

        console.log('[DrawingEngine] _handlePointerDown:', {
            pointerId: info.pointerId,
            clientX: info.clientX,
            clientY: info.clientY,
            pressure: info.pressure
        });

        pendingPoints.push({ type: 'begin', info });
    }

    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        
        console.log('[DrawingEngine] _handlePointerMove:', {
            pointerId: info.pointerId,
            hasPointerInfo: !!pointerInfo,
            isDrawing: pointerInfo?.isDrawing,
            clientX: info.clientX,
            clientY: info.clientY
        });
        
        if (!pointerInfo || !pointerInfo.isDrawing) {
            console.warn('[DrawingEngine] PointerMove blocked - not drawing');
            return;
        }

        console.log('[DrawingEngine] Queuing move point');
        pendingPoints.push({ type: 'move', info });
    }

    _handlePointerUp(info, e) {
        console.log('[DrawingEngine] _handlePointerUp:', {
            pointerId: info.pointerId,
            clientX: info.clientX,
            clientY: info.clientY
        });

        pendingPoints.push({ type: 'end', info });
        this.activePointers.delete(info.pointerId);
    }

    _handlePointerCancel(info, e) {
        console.log('[DrawingEngine] _handlePointerCancel:', info.pointerId);
        
        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }
        this.activePointers.delete(info.pointerId);
    }

    _processPointerDown(info) {
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.error('[DrawingEngine] _processPointerDown: localCoords is null');
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

        // 🔧 isDrawing: trueを確実に設定
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        console.log('[DrawingEngine] activePointers.set:', {
            pointerId: info.pointerId,
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
        console.log('[DrawingEngine] _processPointerMove:', {
            hasBrushCore: !!this.brushCore,
            isActive: this.brushCore?.isActive?.()
        });

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            console.warn('[DrawingEngine] BrushCore not active');
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.warn('[DrawingEngine] Local coords conversion failed');
            return;
        }

        console.log('[DrawingEngine] Calling updateStroke:', {
            localX: localCoords.localX,
            localY: localCoords.localY,
            pressure: info.pressure
        });

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
        if (!activeLayer) {
            return null;
        }

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            return null;
        }

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            return null;
        }

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

console.log('✅ drawing-engine.js Phase 1-2 loaded');
console.log('   🔧 WebGPU Canvas専用接続');
console.log('   🔧 PointerEvent配信デバッグ強化');