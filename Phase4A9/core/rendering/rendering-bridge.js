/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.3.0 (Phase 4A'-7 GPU Drawing Prep)
 *
 * - 修正：
 * - DrawingEngineのインターフェース変更に伴い、委譲するメソッドの引数を更新。
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
                webglCanvas.width = this.displayCanvas.width;
                webglCanvas.height = this.displayCanvas.height;
                
                this._setupWebGLCanvasStyle(webglCanvas);
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
        // WebGLキャンバスをdisplayCanvasの上に重ねるように配置
        webglCanvas.style.position = 'absolute';
        webglCanvas.style.left = '0';
        webglCanvas.style.top = '0';
        webglCanvas.style.width = '100%';
        webglCanvas.style.height = '100%';
        this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas.nextSibling);
    }

    _updateCanvasDisplay() {
        if (this.currentEngineType === 'webgl') {
            this.displayCanvas.style.display = 'none'; // Canvas2Dを非表示
            if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                this.engines['webgl'].canvas.style.display = 'block'; // WebGLを表示
            }
        } else {
            this.displayCanvas.style.display = 'block'; // Canvas2Dを表示
            if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                this.engines['webgl'].canvas.style.display = 'none'; // WebGLを非表示
            }
        }
        this._debugCanvasVisibility();
    }

    _debugCanvasVisibility() {
        if (true) { // デバッグフラグ
            console.debug("--- Canvas Visibility Status:");
            console.debug("- Canvas2D display:", this.displayCanvas.style.display);
            console.debug("- Canvas2D opacity:", this.displayCanvas.style.opacity);
            console.debug("- Canvas2D pointerEvents:", this.displayCanvas.style.pointerEvents);
            console.debug("- Canvas2D visible:", this.displayCanvas.offsetWidth > 0 && this.displayCanvas.offsetHeight > 0);
            
            if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                const webglCanvas = this.engines['webgl'].canvas;
                console.debug("- WebGL display:", webglCanvas.style.display);
                console.debug("- WebGL pointerEvents:", webglCanvas.style.pointerEvents);
                console.debug("- WebGL visible:", webglCanvas.offsetWidth > 0 && webglCanvas.offsetHeight > 0);
            }
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---
    // ★★★ 修正: メソッドのシグネチャ（引数）をインターフェースに合わせる ★★★
    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }
    updateLayerTexture(...args) { this.currentEngine.updateLayerTexture(...args); }
    renderLayerToBuffer(...args) { this.currentEngine.renderLayerToBuffer(...args); }
    getCurrentFrameBufferData(...args) { return this.currentEngine.getCurrentFrameBufferData(...args); }
}