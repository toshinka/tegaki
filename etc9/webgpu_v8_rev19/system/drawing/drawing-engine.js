/**
 * @file system/drawing/drawing-engine.js
 * @description 座標変換・PointerEvent処理・ストローク制御
 * 
 * 【Phase 5 改修内容 - 座標系統一修正】
 * ✅ BrushCore に Local座標を渡すように修正（重大バグ修正）
 * ✅ startStroke/updateStroke で localX/localY を使用
 * 
 * 【Phase 4 改修内容 - Fill Tool 対応】
 * ✅ fill モード時にクリックイベントを発行
 * ✅ canvas:pointerdown イベントに localX/localY を含める
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 * - system/drawing/brush-core.js (BrushCore - ツール状態管理)
 * - system/drawing/pointer-handler.js (PointerHandler)
 * - coordinate-system.js (CoordinateSystem)
 * - system/camera-system.js (CameraSystem)
 * - system/layer-system.js (LayerSystem)
 * - system/event-bus.js (EventBus)
 * 
 * 【子ファイル (このファイルに依存)】
 * - core-engine.js (初期化元)
 * - core-runtime.js (API経由)
 * - system/drawing/fill-tool.js (canvas:pointerdown イベント購読)
 * 
 * 【座標系責務】
 * - _screenToLocal(): Screen → Canvas → World → Local 変換を実行
 * - BrushCore: Local座標のみを受け取る（座標変換を行わない）
 * - StrokeRecorder: Local座標をそのまま記録（座標変換を行わない）
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
     * PointerDown: ストローク開始
     * @param {Object} info - PointerHandler からの情報
     * @param {Event} e - 元のPointerEvent
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

        // 座標変換: Screen → Local
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.warn('[DrawingEngine] Failed to convert screen to local coordinates');
            return;
        }

        // Phase 4: fill モード時は canvas:pointerdown イベントを発行
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
            return; // FillTool に処理を委譲
        }

        // ペン・消しゴムモードの描画処理
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        // ✅ Phase 5修正: Local座標を渡す
        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                localCoords.localX,  // ← Local座標
                localCoords.localY,  // ← Local座標
                info.pressure
            );
        }
    }

    /**
     * PointerMove: ストローク更新
     * @param {Object} info - PointerHandler からの情報
     * @param {Event} e - 元のPointerEvent
     */
    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        // 座標変換: Screen → Local
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            return;
        }

        // ✅ Phase 5修正: Local座標を渡す
        if (this.brushCore.updateStroke) {
            this.brushCore.updateStroke(
                localCoords.localX,  // ← Local座標
                localCoords.localY,  // ← Local座標
                info.pressure
            );
        }
    }

    /**
     * PointerUp: ストローク終了
     */
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

    /**
     * PointerCancel: ストロークキャンセル
     */
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
     * @param {number} clientX - Screen X座標
     * @param {number} clientY - Screen Y座標
     * @returns {Object|null} {localX, localY} または null
     */
    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            console.error('[DrawingEngine] CoordinateSystem not available');
            return null;
        }

        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) {
            console.warn('[DrawingEngine] No active layer');
            return null;
        }

        // Step 1: Screen → Canvas
        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            console.warn('[DrawingEngine] screenClientToCanvas failed');
            return null;
        }

        // Step 2: Canvas → World
        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            console.warn('[DrawingEngine] canvasToWorld failed');
            return null;
        }

        // Step 3: World → Local
        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            console.warn('[DrawingEngine] worldToLocal failed');
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            console.warn('[DrawingEngine] Invalid local coordinates (NaN)');
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    /**
     * BrushSettings インスタンスの設定
     */
    setBrushSettings(settings) {
        this.brushSettings = settings;
    }

    /**
     * 描画中かどうか
     */
    get isDrawing() {
        return this.brushCore && this.brushCore.isActive ? this.brushCore.isActive() : false;
    }

    /**
     * クリーンアップ
     */
    destroy() {
        if (this.pointerDetach) {
            this.pointerDetach();
            this.pointerDetach = null;
        }
        this.activePointers.clear();
    }
}

window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js (Phase 5 - 座標系統一修正版) loaded');
console.log('   ✅ BrushCore に Local座標を渡すように修正');
console.log('   ✅ startStroke/updateStroke で localX/localY を使用');