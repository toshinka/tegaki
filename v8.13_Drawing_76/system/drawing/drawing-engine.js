// ===== system/drawing/drawing-engine.js - デバッグ版 =====
// タブレットペン問題調査用：詳細ログ追加

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

        console.log('🔧 [DrawingEngine] Initializing with debug logs...');
        this._initializeCanvas();
    }

    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('❌ [DrawingEngine] Canvas not found');
            return;
        }

        canvas.style.touchAction = 'none';
        console.log('✅ [DrawingEngine] Canvas found:', canvas);

        // PointerHandler.attach 前にチェック
        if (!window.PointerHandler) {
            console.error('❌ [DrawingEngine] window.PointerHandler not available!');
            return;
        }

        console.log('✅ [DrawingEngine] PointerHandler available');

        this.pointerDetach = window.PointerHandler.attach(canvas, {
            down: this._handlePointerDown.bind(this),
            move: this._handlePointerMove.bind(this),
            up: this._handlePointerUp.bind(this),
            cancel: this._handlePointerCancel.bind(this)
        }, {
            preventDefault: true
        });

        console.log('✅ [DrawingEngine] PointerHandler attached successfully');
        console.log('   Canvas element:', canvas.tagName);
        console.log('   Canvas size:', canvas.width, 'x', canvas.height);
    }

    _handlePointerDown(info, e) {
        console.log('🖱️ [DrawingEngine] PointerDown received:', {
            type: info.pointerType,
            id: info.pointerId,
            client: `(${info.clientX}, ${info.clientY})`,
            pressure: info.pressure,
            button: info.button,
            vKeyPressed: this.layerSystem?.vKeyPressed
        });

        // レイヤー移動モード中は描画しない
        if (this.layerSystem?.vKeyPressed) {
            console.log('⏸️ [DrawingEngine] Skipped: vKey mode active');
            return;
        }

        // 右クリック無視
        if (info.button === 2) {
            console.log('⏸️ [DrawingEngine] Skipped: right button');
            return;
        }

        console.log('🔄 [DrawingEngine] Starting coordinate conversion...');

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.error('❌ [DrawingEngine] Coordinate conversion failed');
            return;
        }

        console.log('✅ [DrawingEngine] Local coords:', localCoords);

        // アクティブポインター登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        console.log('📊 [DrawingEngine] Active pointers:', this.activePointers.size);

        // BrushCoreにストローク開始を通知
        console.log('🎨 [DrawingEngine] Calling brushCore.startStroke...');
        this.brushCore.startStroke(
            localCoords.localX,
            localCoords.localY,
            info.pressure,
            info.pointerId
        );
        console.log('✅ [DrawingEngine] startStroke completed');
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
        console.log('🖱️ [DrawingEngine] PointerUp received:', {
            type: info.pointerType,
            id: info.pointerId
        });

        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            console.log('⚠️ [DrawingEngine] PointerUp: pointer not found in activePointers');
            return;
        }

        if (this.brushCore.getIsDrawing()) {
            console.log('🎨 [DrawingEngine] Calling brushCore.endStroke...');
            this.brushCore.endStroke(info.pointerId);
        }

        this.activePointers.delete(info.pointerId);
        console.log('📊 [DrawingEngine] Active pointers after up:', this.activePointers.size);
    }

    _handlePointerCancel(info, e) {
        console.log('🖱️ [DrawingEngine] PointerCancel received:', {
            type: info.pointerType,
            id: info.pointerId
        });

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
            console.error('❌ [DrawingEngine] CoordinateSystem not available');
            return null;
        }

        const activeLayer = this.layerSystem.getActiveLayer();
        if (!activeLayer) {
            console.warn('⚠️ [DrawingEngine] No active layer');
            return null;
        }

        console.log('  Step 1: screenClientToCanvas...');
        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            console.error('❌ [DrawingEngine] screenClientToCanvas failed');
            return null;
        }
        console.log('    Canvas coords:', canvasCoords);

        console.log('  Step 2: canvasToWorld...');
        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            console.error('❌ [DrawingEngine] canvasToWorld failed');
            return null;
        }
        console.log('    World coords:', worldCoords);

        console.log('  Step 3: worldToLocal...');
        const localCoords = this.coordSystem.worldToLocal(
            worldCoords.worldX,
            worldCoords.worldY,
            activeLayer
        );
        
        if (!localCoords || localCoords.localX === undefined || localCoords.localY === undefined) {
            console.error('❌ [DrawingEngine] worldToLocal failed');
            return null;
        }

        if (isNaN(localCoords.localX) || isNaN(localCoords.localY)) {
            console.error('❌ [DrawingEngine] worldToLocal returned NaN:', localCoords);
            return null;
        }

        console.log('    Local coords:', localCoords);

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
        console.log('🔧 [DrawingEngine] setTool:', tool);
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
        console.warn('⚠️ [DrawingEngine] Legacy API called: startDrawing()');
    }

    continueDrawing(x, y, nativeEvent) {
        // 何もしない（PointerHandlerが処理）
    }

    stopDrawing() {
        console.warn('⚠️ [DrawingEngine] Legacy API called: stopDrawing()');
    }

    destroy() {
        console.log('🔧 [DrawingEngine] Destroying...');
        if (this.pointerDetach) {
            this.pointerDetach();
            this.pointerDetach = null;
        }
        this.activePointers.clear();
    }
}

window.DrawingEngine = DrawingEngine;

console.log('✅ drawing-engine.js (デバッグ版) loaded');
console.log('   ✓ Detailed logging enabled');
console.log('   ✓ All pointer events will be logged');