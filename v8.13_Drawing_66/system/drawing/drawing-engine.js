// ===== system/drawing/drawing-engine.js - BrushCore統合版 =====
// 役割：PointerEvent → 座標変換 → BrushCore呼び出し
// 描画ロジックはBrushCoreに委譲

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        // BrushCore統合
        this.brushCore = new window.BrushCore(app, layerSystem, cameraSystem, this.config);
        
        // ブラシ設定（後で設定される）
        this.brushSettings = null;
        
        // PointerHandler
        this.pointerDetach = null;
        
        // CoordinateSystem
        this.coordSystem = window.CoordinateSystem;

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

        // touch-action設定
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
     * PointerDown処理
     */
    _handlePointerDown(info, e) {
        // レイヤー移動モード中は描画しない
        if (this.layerSystem.vKeyPressed) {
            console.log('[DrawingEngine] Skipped: Layer move mode active');
            return;
        }

        console.log('[DrawingEngine] PointerDown:', {
            client: `(${info.clientX}, ${info.clientY})`,
            pressure: info.pressure,
            type: info.pointerType
        });

        // 座標変換パイプライン
        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.warn('[DrawingEngine] Coordinate conversion failed');
            return;
        }

        console.log('[DrawingEngine] Converted to local:', {
            local: `(${localCoords.localX}, ${localCoords.localY})`
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
     * PointerMove処理
     */
    _handlePointerMove(info, e) {
        if (!this.brushCore.getIsDrawing()) return;

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
     * PointerUp処理
     */
    _handlePointerUp(info, e) {
        if (!this.brushCore.getIsDrawing()) return;

        this.brushCore.endStroke(info.pointerId);
    }

    /**
     * PointerCancel処理
     */
    _handlePointerCancel(info, e) {
        if (!this.brushCore.getIsDrawing()) return;

        this.brushCore.cancelStroke(info.pointerId);
    }

    /**
     * 座標変換：Screen → Local
     * ガイドライン準拠：screenClientToCanvas → canvasToWorld → worldToLocal
     */
    _screenToLocal(clientX, clientY) {
        if (!this.coordSystem) {
            console.error('[DrawingEngine] CoordinateSystem not available');
            return null;
        }

        // 1. Screen → Canvas (DPI補正)
        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords) return null;

        // 2. Canvas → World (worldContainer逆行列)
        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.x, canvasCoords.y);
        if (!worldCoords) return null;

        // 3. World → Local (アクティブレイヤーのローカル座標)
        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) return null;

        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.x,
            worldCoords.y,
            activeLayer
        );
        if (!localCoords) return null;

        return {
            localX: localCoords.x,
            localY: localCoords.y
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
        console.log('[DrawingEngine] Brush settings applied:', settings);
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
     * 後方互換性：古いAPI対応
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

        console.log('[DrawingEngine] startDrawing (legacy API):', {
            client: `(${clientX}, ${clientY})`,
            pressure
        });

        // 新しいAPIに転送
        this._handlePointerDown({
            clientX,
            clientY,
            pressure,
            pointerId,
            pointerType: nativeEvent.pointerType || 'mouse'
        }, nativeEvent);
    }

    continueDrawing(x, y, nativeEvent) {
        if (!nativeEvent) return;

        const clientX = nativeEvent.clientX;
        const clientY = nativeEvent.clientY;
        const pressure = nativeEvent.pressure ?? 0.5;
        const pointerId = nativeEvent.pointerId;

        if (clientX === undefined || clientY === undefined) return;

        // 新しいAPIに転送
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
    }
}

// グローバル公開（後方互換性）
window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js (BrushCore統合版) loaded');
console.log('   ✓ PointerEvent unified');
console.log('   ✓ Coordinate pipeline: Screen → Canvas → World → Local');
console.log('   ✓ Pen/Eraser via BrushCore');
console.log('   ✓ Legacy API support: startDrawing/continueDrawing/stopDrawing');