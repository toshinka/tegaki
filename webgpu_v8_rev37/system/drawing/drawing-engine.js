/**
 * ================================================================================
 * drawing-engine.js Phase 5完全版
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
 *   - core-engine.js
 *   - core-runtime.js
 *   - system/drawing/fill-tool.js
 * 
 * 【責務】
 * - 座標変換パイプライン（Screen→Canvas→World→Local）
 * - PointerEvent処理
 * - ストローク制御（開始・更新・終了）
 * 
 * 【Phase 5改修内容】
 * ✅ pointermoveバッチ処理実装（フリッカー解消）
 * ✅ requestAnimationFrame統合
 * ✅ pendingPointsキュー管理
 * ✅ 過剰ログ削除
 * 
 * ================================================================================
 */

// Phase 5: ポインタバッチ処理用グローバル変数（モジュールスコープ）
let pendingPoints = [];
let isRenderScheduled = false;

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
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('[DrawingEngine] Canvas not found');
            return;
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
    }

    /**
     * Phase 5: ポインタバッチをフラッシュ
     */
    _flushPendingPoints() {
        if (pendingPoints.length === 0) return;

        // バッチ処理
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

    /**
     * Phase 5: レンダリングスケジュール
     */
    _scheduleRender() {
        if (isRenderScheduled) return;
        
        isRenderScheduled = true;
        requestAnimationFrame(() => {
            isRenderScheduled = false;
            this._flushPendingPoints();
        });
    }

    /**
     * PointerDown: キューに追加
     */
    _handlePointerDown(info, e) {
        if (this.cameraSystem?.isCanvasMoveMode()) return;
        if (this.layerSystem?.vKeyPressed) return;
        if (info.button === 2) return;

        pendingPoints.push({ type: 'begin', info });
        this._scheduleRender();
    }

    /**
     * PointerMove: キューに追加
     */
    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) return;

        pendingPoints.push({ type: 'move', info });
        this._scheduleRender();
    }

    /**
     * PointerUp: 即座にフラッシュ
     */
    _handlePointerUp(info, e) {
        pendingPoints.push({ type: 'end', info });
        // 即座にフラッシュ（ストローク終了は遅延不可）
        this._flushPendingPoints();
        this.activePointers.delete(info.pointerId);
    }

    _handlePointerCancel(info, e) {
        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }
        this.activePointers.delete(info.pointerId);
    }

    /**
     * Phase 5: 実際のPointerDown処理
     */
    _processPointerDown(info) {
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) return;

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

        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                localCoords.localX,
                localCoords.localY,
                info.pressure,
                info.pointerType
            );
        }
    }

    /**
     * Phase 5: 実際のPointerMove処理
     */
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

    /**
     * Phase 5: 実際のPointerUp処理
     */
    _processPointerUp(info) {
        if (this.brushCore && this.brushCore.isActive && this.brushCore.isActive()) {
            if (this.brushCore.finalizeStroke) {
                this.brushCore.finalizeStroke();
            }
        }
    }

    /**
     * 座標変換: Screen → Canvas → World → Local
     */
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

console.log('✅ drawing-engine.js Phase 5 loaded');