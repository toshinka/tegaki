// ===== system/drawing/drawing-engine.js - 修正版 =====

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.config = window.TEGAKI_CONFIG;

        // ★★★ 修正: グローバルインスタンスを参照 ★★★
        this.brushCore = window.BrushCore;
        
        if (!this.brushCore) {
            console.error('❌ [DrawingEngine] window.BrushCore not initialized');
            throw new Error('[DrawingEngine] window.BrushCore not initialized. Check core-engine.js initialization order.');
        }

        this.brushSettings = null;
        this.pointerDetach = null;
        this.coordSystem = window.CoordinateSystem;
        this.activePointers = new Map();

        console.log('🔧 [DrawingEngine] Initializing...');
        console.log('   BrushCore reference:', !!this.brushCore);
        
        this._initializeCanvas();
    }

    _initializeCanvas() {
        const canvas = this.app.canvas || this.app.view;
        if (!canvas) {
            console.error('❌ [DrawingEngine] Canvas not found');
            return;
        }

        canvas.style.touchAction = 'none';
        console.log('✅ [DrawingEngine] Canvas found');

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

        console.log('✅ [DrawingEngine] PointerHandler attached');
    }

    _handlePointerDown(info, e) {
        console.log('🖱️ [DrawingEngine] PointerDown:', {
            type: info.pointerType,
            id: info.pointerId,
            pressure: info.pressure
        });

        // レイヤー移動モード中は描画しない
        if (this.layerSystem?.vKeyPressed) {
            console.log('⏸️ [DrawingEngine] Skipped: vKey mode active');
            return;
        }

        // 右クリック無視
        if (info.button === 2) {
            return;
        }

        const localCoords = this._screenToLocal(info.clientX, info.clientY);
        if (!localCoords) {
            console.error('❌ [DrawingEngine] Coordinate conversion failed');
            return;
        }

        // アクティブポインター登録
        this.activePointers.set(info.pointerId, {
            type: info.pointerType || 'unknown',
            isDrawing: true
        });

        // ★★★ 修正: BrushCore.startStroke()を呼び出し ★★★
        // BrushCoreは既にLocal座標を受け取る設計なので、clientX/clientYではなくlocalX/localYを渡す
        if (this.brushCore && this.brushCore.startStroke) {
            // BrushCore.startStroke()はclientX/clientYを期待しているので
            // 一旦元の座標を渡す（BrushCore内部で変換される）
            this.brushCore.startStroke(
                info.clientX,
                info.clientY,
                info.pressure
            );
        } else {
            console.error('❌ [DrawingEngine] BrushCore.startStroke not available');
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
        console.log('🖱️ [DrawingEngine] PointerUp:', {
            type: info.pointerType,
            id: info.pointerId
        });

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
        console.log('🖱️ [DrawingEngine] PointerCancel:', {
            type: info.pointerType,
            id: info.pointerId
        });

        const pointerInfo = this.activePointers.get(info.pointerId);
        if (!pointerInfo) {
            return;
        }

        if (this.brushCore && this.brushCore.cancelStroke) {
            this.brushCore.cancelStroke();
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

        const canvasCoords = this.coordSystem.screenClientToCanvas(clientX, clientY);
        if (!canvasCoords || canvasCoords.canvasX === undefined) {
            console.error('❌ [DrawingEngine] screenClientToCanvas failed');
            return null;
        }

        const worldCoords = this.coordSystem.canvasToWorld(canvasCoords.canvasX, canvasCoords.canvasY);
        if (!worldCoords || worldCoords.worldX === undefined) {
            console.error('❌ [DrawingEngine] canvasToWorld failed');
            return null;
        }

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

        return {
            localX: localCoords.localX,
            localY: localCoords.localY
        };
    }

    // ★★★ 修正: setBrushSettings → updateSettings ★★★
    setBrushSettings(settings) {
        this.brushSettings = settings;
        if (this.brushCore && this.brushCore.updateSettings) {
            this.brushCore.updateSettings({
                size: settings.getSize ? settings.getSize() : settings.size,
                opacity: settings.getAlpha ? settings.getAlpha() : settings.opacity,
                color: settings.getColor ? settings.getColor() : settings.color
            });
        } else {
            console.warn('⚠️ [DrawingEngine] BrushCore.updateSettings not available');
        }
    }

    setTool(tool) {
        console.log('🔧 [DrawingEngine] setTool:', tool);
        if (this.brushCore && this.brushCore.setMode) {
            this.brushCore.setMode(tool);
        } else {
            console.warn('⚠️ [DrawingEngine] BrushCore.setMode not available');
        }
    }

    getTool() {
        return this.brushCore && this.brushCore.getMode ? this.brushCore.getMode() : 'pen';
    }

    get currentTool() {
        return this.getTool();
    }

    get isDrawing() {
        return this.brushCore && this.brushCore.isActive ? this.brushCore.isActive() : false;
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

console.log('✅ drawing-engine.js (修正版) loaded');
console.log('   ✓ グローバルBrushCore参照');
console.log('   ✓ setBrushSettings → updateSettings');