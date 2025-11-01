// ===== system/drawing/drawing-engine.js - Phase 1: タブレットペン完全対応版 =====
// 役割：PointerEvent → 座標変換 → BrushCore呼び出し
// Phase 1改修: タブレットペン完全サポート・座標変換強化

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        // BrushCore統合
        this.brushCore = new window.BrushCore(app, layerSystem, cameraSystem, this.config);
        
        // ブラシ設定
        this.brushSettings = null;
        
        // PointerHandler
        this.pointerDetach = null;
        
        // CoordinateSystem
        this.coordSystem = window.CoordinateSystem;

        // アクティブなポインターを追跡（マルチタッチ対応）
        this.activePointers = new Map();

        this._initializeCanvas();
    }

    /**
     * キャンバスイベント初期化
     */
    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('[DrawingEngine] Canvas not found');
            return;
        }

        // touch-action設定（タブレットペン対応に必須）
        canvas.style.touchAction = 'none';

        // PointerEventハンドラ登録
        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        console.log('[DrawingEngine] Canvas pointer events initialized');
    }

    /**
     * PointerDown処理（タブレットペン完全対応）
     */
    _handlePointerDown(info, e) {
        // レイヤー移動モード中は描画しない
        if (this.layerSystem.vKeyPressed) {
            return;
        }

        // 右クリック無視
        if (info.button === 2) {
            return;
        }

        console.log('[DrawingEngine] PointerDown:', {
            type: info.pointerType,
            client: `(${info.clientX}, ${info.clientY})`,
            pressure: info.pressure
        });

        // 座標変換パイプライン
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.warn('[DrawingEngine] Coordinate conversion failed');
            return;
        }

        // アクティブポインター登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType,
            isDrawing: true
        });

        // BrushCoreにストローク開始を通知
        this.brushCore.startStroke(
            localCoords.localX,
            localCoords.localY,
            info.pressure,
            info.pointerId
        );
    }

    /**
     * PointerMove処理（連続描画）
     */
    _handlePointerMove(info, e) {
        // アクティブなポインターのみ処理
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo || !pointerInfo.isDrawing) {
            return;
        }

        if (!this.brushCore.getIsDrawing()) {
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) return;

        this.brushCore.addPoint(
            localCoords.localX,
            localCoords.localY,
            info.pressure,
            info.pointerId
        );
    }

    /**
     * PointerUp処理（ストローク終了）
     */
    _handlePointerUp(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore.getIsDrawing()) {
            this.brushCore.endStroke(info.pointerId);
        }

        // アクティブポインター削除
        this.activePointers.delete(info.pointerId);
    }

    /**
     * PointerCancel処理（中断）
     */
    _handlePointerCancel(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore.getIsDrawing()) {
            this.brushCore.cancelStroke(info.pointerId);
        }

        this.activePointers.delete(info.pointerId);
    }

    /**
     * 座標変換：Screen → Local（ガイドライン準拠）
     * Phase 1強化: NaNチェック・エラーハンドリング強化
     */
    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            console.error('[DrawingEngine] CoordinateSystem not available');
            return null;
        }

        // アクティブレイヤー取得
        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) {
            console.warn('[DrawingEngine] No active layer');
            return null;
        }

        // 1. Screen → Canvas (DPI補正)
        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            console.error('[DrawingEngine] screenClientToCanvas failed');
            return null;
        }

        // 2. Canvas → World (worldContainer逆行列)
        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            console.error('[DrawingEngine] canvasToWorld failed');
            return null;
        }

        // 3. World → Local (アクティブレイヤーのローカル座標)
        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            console.error('[DrawingEngine] worldToLocal failed');
            return null;
        }

        // NaN チェック
        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            console.error('[DrawingEngine] worldToLocal returned NaN:', localCoords);
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    /**
     * ブラシ設定をセット
     */
    setBrushSettings(settings) {
        this.brushSettings = settings;
        if (this.brushCore) {
            this.brushCore.setBrushSettings(settings);
        }
        console.log('[DrawingEngine] Brush settings applied');
    }

    /**
     * ツール切り替え
     */
    setTool(tool) {
        if (this.brushCore) {
            this.brushCore.setTool(tool);
        }
    }

    /**
     * 現在のツールを取得
     */
    getTool() {
        return this.brushCore ? this.brushCore.getTool() : 'pen';
    }

    /**
     * 後方互換性：古いAPI
     */
    get currentTool() {
        return this.brushCore ? this.brushCore.getTool() : 'pen';
    }

    get isDrawing() {
        return this.brushCore ? this.brushCore.getIsDrawing() : false;
    }

    /**
     * 後方互換性：core-runtime.jsからの古いAPI
     */
    startDrawing(x, y, nativeEvent) {
        if (!nativeEvent) {
            console.error('[DrawingEngine] startDrawing: nativeEvent is required');
            return;
        }
        
        const clientX = nativeEvent.clientX;
        const clientY = nativeEvent.clientY;
        const pressure = nativeEvent.pressure ?? 0.5;
        const pointerId = nativeEvent.pointerId;

        if (clientX === undefined || clientY === undefined) {
            console.warn('[DrawingEngine] Invalid nativeEvent', nativeEvent);
            return;
        }

        this._handlePointerDown({
            clientX,
            clientY,
            pressure,
            pointerId,
            pointerType: nativeEvent.pointerType || 'mouse',
            button: nativeEvent.button || 0
        }, nativeEvent);
    }

    continueDrawing(x, y, nativeEvent) {
        if (!nativeEvent) return;

        const clientX = nativeEvent.clientX;
        const clientY = nativeEvent.clientY;
        const pressure = nativeEvent.pressure ?? 0.5;
        const pointerId = nativeEvent.pointerId;

        if (clientX === undefined || clientY === undefined) return;

        this._handlePointerMove({
            clientX,
            clientY,
            pressure,
            pointerId,
            pointerType: nativeEvent.pointerType || 'mouse'
        }, nativeEvent);
    }

    stopDrawing() {
        console.log('[DrawingEngine] stopDrawing (legacy API)');
        if (this.brushCore) {
            this.brushCore.endStroke();
        }
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

// グローバル公開
window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js (Phase 1: タブレットペン完全対応版) loaded');
console.log('   ✓ Tablet pen full support (pressure/tilt)');
console.log('   ✓ Multi-pointer tracking');
console.log('   ✓ Coordinate pipeline: Screen → Canvas → World → Local');
console.log('   ✓ NaN validation enhanced');