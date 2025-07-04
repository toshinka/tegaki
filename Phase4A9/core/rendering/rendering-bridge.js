/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.4.0 (Phase4A9 MVP Bridge)
 *
 * - 修正：
 * - Phase4A9対応：`compositeLayers`と`drawBrush`の引数を新しい仕様に更新。
 * - `core-engine`から渡されるMVP行列やワールド座標を、`webgl-engine`に正しく中継する。
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
import { WebGLEngine } from './webgl-engine.js';
import { mat4 } from 'gl-matrix'; // gl-matrixライブラリをインポート

export class RenderingBridge {
    constructor(displayCanvas) {
        this.displayCanvas = displayCanvas;
        this.engines = {};
        this.currentEngine = null;
        this.currentEngineType = '';
        this.eventTargetCanvas = null;

        try {
            this.engines['canvas2d'] = new Canvas2DEngine(this.displayCanvas);
            console.log("Canvas2D Engine initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Canvas2D engine:", e);
            throw e;
        }

        if (WebGLEngine.isSupported()) {
            try {
                const webglCanvas = document.createElement('canvas');
                webglCanvas.id = 'webglCanvas';
                webglCanvas.width = this.displayCanvas.width;
                webglCanvas.height = this.displayCanvas.height;
                
                this._setupWebGLCanvasStyle(webglCanvas);
                this.displayCanvas.parentNode.appendChild(webglCanvas);

                this.engines['webgl'] = new WebGLEngine(webglCanvas);

                if (this.engines['webgl']) {
                    this.setEngine('webgl');
                } else {
                    console.warn("WebGL engine initialized but not available. Falling back to Canvas2D.");
                    this.setEngine('canvas2d');
                }
            } catch (e) {
                console.error("Failed to initialize WebGL engine:", e);
                console.warn("Falling back to Canvas2D engine.");
                this.setEngine('canvas2d');
            }
        } else {
            console.log("WebGL is not supported. Using Canvas2D engine.");
            this.setEngine('canvas2d');
        }
        this._updateCanvasDisplay();
    }

    setEngine(engineType) {
        if (this.engines[engineType]) {
            this.currentEngineType = engineType;
            this.currentEngine = this.engines[engineType];
            this.eventTargetCanvas = this.currentEngine.canvas;
            console.log(`Rendering engine set to: ${engineType}`);
            this._updateCanvasDisplay();
        } else {
            console.warn(`Engine type ${engineType} not found.`);
        }
    }

    getEngine() {
        return this.currentEngine;
    }

    getEngineType() {
        return this.currentEngineType;
    }

    _setupWebGLCanvasStyle(webglCanvas) {
        webglCanvas.style.position = 'absolute';
        webglCanvas.style.left = '0';
        webglCanvas.style.top = '0';
        webglCanvas.style.width = '100%';
        webglCanvas.style.height = '100%';
        webglCanvas.style.zIndex = '1'; // displayCanvasの上に表示
    }

    _updateCanvasDisplay() {
        if (this.currentEngineType === 'webgl') {
            this.displayCanvas.style.display = 'none';
            if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                this.engines['webgl'].canvas.style.display = 'block';
            }
        } else {
            this.displayCanvas.style.display = 'block';
            if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                this.engines['webgl'].canvas.style.display = 'none';
            }
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---
    // 可変長引数(...)を使用して、すべての引数をそのまま現在のエンジンに渡す
    clear(...args) { this.currentEngine.clear(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    updateLayerTexture(...args) { this.currentEngine.updateLayerTexture(...args); }
    drawBrush(...args) { this.currentEngine.drawBrush(...args); }
    getCurrentFrameBufferData(...args) { return this.currentEngine.getCurrentFrameBufferData(...args); }
}