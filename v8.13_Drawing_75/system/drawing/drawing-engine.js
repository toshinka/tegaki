// ===== system/drawing/drawing-engine.js - ユニバーサルポインター対応版 =====
// 修正: すべてのpointerTypeを同等に扱う（'mouse'も'pen'も区別しない）

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        this.brushCore = new window.BrushCore(app, layerSystem, cameraSystem, this.config);
        this.brushSettings = null;
        this.pointerDetach = null;
        this.coordSystem = window.CoordinateSystem;
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

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        console.log('[DrawingEngine] Canvas pointer events initialized (universal mode)');
    }

    _handlePointerDown(info, e) {
        // レイヤー移動モード中は描画しない
        if (this.layerSystem.vKeyPressed) {
            return;
        }

        // 右クリック無視
        if (info.button === 2) {
            return;
        }

        // ✅ 修正: すべてのpointerTypeを受け入れる（'mouse'も'pen'も同等）
        console.log('[DrawingEngine] PointerDown:', {
            type: info.pointerType || 'unknown',
            id: info.pointerId,
            client: `(${info.clientX}, ${info.clientY})`,
            pressure: info.pressure,
            button: info.button
        });

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.warn('[DrawingEngine] Coordinate conversion failed');
            return;
        }

        // アクティブポインター登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
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

    _handlePointerMove(info, e) {
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

    _handlePointerUp(info, e) {
        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore.getIsDrawing()) {
            this.brushCore.endStroke(info.pointerId);
        }

        this.activePointers.delete(info.pointerId);
    }

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

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            console.error('[DrawingEngine] screenClientToCanvas failed');
            return null;
        }

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            console.error('[DrawingEngine] canvasToWorld failed');
            return null;
        }

        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            console.error('[DrawingEngine] worldToLocal failed');
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            console.error('[DrawingEngine] worldToLocal returned NaN:', localCoords);
            return null;
        }

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    setBrushSettings(settings) {
        this.brushSettings = settings;
        if (this.brushCore) {
            this.brushCore.setBrushSettings(settings);
        }
    }

    setTool(tool) {
        if (this.brushCore) {
            this.brushCore.setTool(tool);
        }
    }

    getTool() {
        return this.brushCore ? this.brushCore.getTool() : 'pen';
    }

    get currentTool() {
        return this.brushCore ? this.brushCore.getTool() : 'pen';
    }

    get isDrawing() {
        return this.brushCore ? this.brushCore.getIsDrawing() : false;
    }

    // ✅ 後方互換性API（削除予定）
    startDrawing(x, y, nativeEvent) {
        console.warn('[DrawingEngine] Legacy API called: startDrawing()');
        // 何もしない（PointerHandlerが処理）
    }

    continueDrawing(x, y, nativeEvent) {
        // 何もしない（PointerHandlerが処理）
    }

    stopDrawing() {
        console.warn('[DrawingEngine] Legacy API called: stopDrawing()');
        // 何もしない（PointerHandlerが処理）
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

console.log('✅ drawing-engine.js (ユニバーサルポインター対応版) loaded');
console.log('   ✓ All pointer types accepted (mouse/pen/touch)');
console.log('   ✓ Legacy CoreRuntime APIs deprecated');