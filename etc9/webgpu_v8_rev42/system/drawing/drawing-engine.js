/**
 * ================================================================================
 * drawing-engine.js Phase 3完全版（フリッカー完全解消）
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
 * 【Phase 3改修内容】
 * 🔧 _scheduleRender()削除 - requestAnimationFrame発行禁止
 * 🔧 pendingPointsをキューに溜めるのみ
 * 🔧 core-engineのMaster Loopに完全依存
 * 🚨 二重レンダーループの完全排除
 * 
 * ================================================================================
 */

// ポインタバッチ処理用グローバル変数（モジュールスコープ）
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
     * 🔧 Phase 3: 公開メソッド（core-engine Master Loop専用）
     * ⚠️ この関数のみがpendingPointsを処理する
     */
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

    /**
     * 🔧 Phase 3改修: ポインタダウン → キューに追加のみ
     * ❌ requestAnimationFrame発行禁止
     */
    _handlePointerDown(info, e) {
        if (this.cameraSystem?.isCanvasMoveMode()) return;
        if (this.layerSystem?.vKeyPressed) return;
        if (info.button === 2) return;

        pendingPoints.push({ type: 'begin', info });
        // ❌ _scheduleRender()呼び出し削除 - Master Loop依存
    }

    /**
     * 🔧 Phase 3改修: ポインタムーブ → キューに追加のみ
     * ❌ requestAnimationFrame発行禁止
     */
    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) return;

        pendingPoints.push({ type: 'move', info });
        // ❌ _scheduleRender()呼び出し削除 - Master Loop依存
    }

    /**
     * 🔧 Phase 3改修: ポインタアップ → キューに追加のみ
     * ⚠️ 即座フラッシュも削除（Master Loop一本化）
     */
    _handlePointerUp(info, e) {
        pendingPoints.push({ type: 'end', info });
        this.activePointers.delete(info.pointerId);
        // ❌ 即座フラッシュ削除 - Master Loop依存
    }

    _handlePointerCancel(info, e) {
        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
        }
        this.activePointers.delete(info.pointerId);
    }

    /**
     * 実際のPointerDown処理
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
     * 実際のPointerMove処理
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
     * 実際のPointerUp処理
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

console.log('✅ drawing-engine.js Phase 3完全版 loaded');
console.log('   🔧 requestAnimationFrame発行禁止');
console.log('   🔧 Master Loop完全統合');
console.log('   🚨 二重レンダーループ排除完了');