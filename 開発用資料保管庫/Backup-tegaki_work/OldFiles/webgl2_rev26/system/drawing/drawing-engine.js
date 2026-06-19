/**
 * ============================================================
 * drawing-engine.js - Phase B-2: ペン傾き伝達実装版
 * ============================================================
 * 
 * 【親依存】
 * - system/drawing/brush-core.js (BrushCore)
 * - system/drawing/pointer-handler.js (PointerHandler)
 * - coordinate-system.js (CoordinateSystem)
 * - system/camera-system.js (CameraSystem)
 * - system/layer-system.js (LayerSystem)
 * - system/event-bus.js (EventBus)
 * - system/drawing/stroke-renderer.js (StrokeRenderer)
 * 
 * 【子依存】
 * - core-engine.js (初期化元)
 * - core-runtime.js (API経由)
 * - system/drawing/fill-tool.js (canvas:pointerdown イベント購読)
 * - core-initializer.js (strokeRenderer参照)
 * 
 * 【Phase B-2改修内容】
 * ✅ _handlePointerDown() 傾き伝達（tiltX/tiltY/twist追加）
 * ✅ _handlePointerMove() 傾き伝達
 * ✅ brush-core.startStroke() / updateStroke() に傾きパラメータ追加
 * ✅ Phase 4.1全機能継承
 * ============================================================
 */

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        this.brushCore = window.BrushCore;
        
        if (!this.brushCore) {
            console.error('❌ [DrawingEngine] window.BrushCore not initialized');
            throw new Error('[DrawingEngine] window.BrushCore not initialized. Check core-engine.js initialization order.');
        }

        this.brushSettings = null;
        this.strokeRenderer = window.strokeRenderer || null;
        
        this.pointerDetach = null;
        this.coordSystem = window.CoordinateSystem;
        this.eventBus = window.TegakiEventBus || window.eventBus;
        this.activePointers = new Map();
        
        this._initializeCanvas();
    }

    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('❌ [DrawingEngine] Canvas not found');
            return;
        }

        canvas.style.touchAction = 'none';

        if (!window.PointerHandler) {
            console.error('❌ [DrawingEngine] window.PointerHandler not available!');
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
    }

    /**
     * Phase B-2: 傾き伝達実装
     * tiltX/tiltY/twist をBrushCoreに渡す
     */
    _handlePointerDown(info, e) {
        if (this.cameraSystem?.isCanvasMoveMode()) {
            return;
        }

        if (this.layerSystem?.vKeyPressed) {
            return;
        }

        if (info.button === 2) {
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
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

        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        // Phase B-2: 傾きパラメータ追加
        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.tiltX !== undefined ? info.tiltX : 0,
                info.tiltY !== undefined ? info.tiltY : 0,
                info.twist !== undefined ? info.twist : 0
            );
        }
    }

    /**
     * Phase B-2: 傾き伝達実装
     */
    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        // Phase B-2: 傾きパラメータ追加
        if (this.brushCore.updateStroke) {
            this.brushCore.updateStroke(
                info.clientX,
                info.clientY,
                info.pressure,
                info.tiltX !== undefined ? info.tiltX : 0,
                info.tiltY !== undefined ? info.tiltY : 0,
                info.twist !== undefined ? info.twist : 0
            );
        }
    }

    _handlePointerUp(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.isActive && this.brushCore.isActive()) {
            if (this.brushCore.finalizeStroke) {
                this.brushCore.finalizeStroke();
            }
        }

        this.activePointers.delete(info.pointerId);
    }

    _handlePointerCancel(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }

        this.activePointers.delete(info.pointerId);
    }

    /**
     * 座標変換パイプライン: Screen → Canvas → World → Local
     */
    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
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

    setStrokeRenderer(renderer) {
        this.strokeRenderer = renderer;
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
    }
}

window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js Phase B-2 loaded (ペン傾き伝達版)');
console.log('   ✅ startStroke() に tiltX/tiltY/twist 追加');
console.log('   ✅ updateStroke() に tiltX/tiltY/twist 追加');
console.log('   ✅ Phase 4.1全機能継承');