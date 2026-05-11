/**
 * @file system/drawing/drawing-engine.js - Phase 4.1
 * @description 座標変換・PointerEvent処理・ストローク制御
 * 
 * 【Phase 4.1 改修内容】
 * ✅ strokeRenderer プロパティ追加
 * ✅ WebGL2初期化用の参照を提供
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
 * - system/drawing/stroke-renderer.js (StrokeRenderer) ← 🆕 Phase 4.1
 * 
 * 【子ファイル (このファイルに依存)】
 * - core-engine.js (初期化元)
 * - core-runtime.js (API経由)
 * - system/drawing/fill-tool.js (canvas:pointerdown イベント購読)
 * - core-initializer.js (strokeRenderer参照) ← 🆕 Phase 4.1
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
        
        // 🆕 Phase 4.1: StrokeRenderer参照を追加
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

        if (this.brushCore && this.brushCore.startStroke) {
            this.brushCore.startStroke(
                info.clientX,
                info.clientY,
                info.pressure
            );
        }
    }

    _handlePointerMove(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore || !this.brushCore.isActive || !this.brushCore.isActive()) {
            return;
        }

        if (this.brushCore.updateStroke) {
            this.brushCore.updateStroke(
                info.clientX,
                info.clientY,
                info.pressure
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

    /**
     * BrushSettings インスタンスの設定
     */
    setBrushSettings(settings) {
        this.brushSettings = settings;
    }

    /**
     * 🆕 Phase 4.1: StrokeRenderer 参照を更新
     * （CoreEngine初期化後に呼ばれる）
     */
    setStrokeRenderer(renderer) {
        this.strokeRenderer = renderer;
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

console.log('✅ drawing-engine.js (Phase 4.1 StrokeRenderer参照追加版) loaded');
console.log('   ✅ strokeRenderer プロパティ追加');
console.log('   ✅ setStrokeRenderer() メソッド追加');
console.log('   ✓ Phase 4 全機能継承');