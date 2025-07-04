/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.4.0 (Phase 4A9: WebGL Layer Movement Support)
 *
 * - 修正：
 * - WebGLエンジンへの描画コマンド発行時に、Projection、View、Model行列を適切に結合・伝達。
 * - レイヤー合成とブラシ描画で異なる行列（MVP, PV）をWebGLEngineに渡すように変更。
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
import { WebGLEngine } from './webgl-engine.js';

// Assume gl-matrix is loaded globally

export class RenderingBridge {
    constructor(displayCanvas) {
        this.displayCanvas = displayCanvas;
        this.engines = {};
        this.currentEngine = null;
        this.currentEngineType = '';

        this.projectionMatrix = mat4.create(); // Will be set by CanvasManager
        this.viewMatrix = mat4.create();     // Will be set by CanvasManager

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

                if (this.engines['webgl'].gl) {
                    console.log("WebGL Engine initialized successfully.");
                    this._addWebGLCanvasToDOM();
                    this.switchEngine('webgl'); // Prefer WebGL if available
                } else {
                    console.warn("WebGL Engine initialization returned no context. It will be unavailable.");
                    this.switchEngine('canvas2d');
                }
            } catch (e) {
                console.warn("WebGL Engine initialization failed:", e);
                this.switchEngine('canvas2d');
            }
        } else {
            console.warn("WebGL is not supported in this browser. Falling back to Canvas2D.");
            this.switchEngine('canvas2d');
        }
    }

    // Sets the global projection and view matrices, called by CanvasManager
    setMatrices(projectionMatrix, viewMatrix) {
        mat4.copy(this.projectionMatrix, projectionMatrix);
        mat4.copy(this.viewMatrix, viewMatrix);
    }

    switchEngine(type) {
        if (this.currentEngineType === type) return;

        // Hide old canvas
        if (this.currentEngine && this.currentEngine.canvas) {
            this.currentEngine.canvas.style.display = 'none';
            this.currentEngine.canvas.style.pointerEvents = 'none';
        }

        this.currentEngineType = type;
        this.currentEngine = this.engines[type];

        // Show new canvas
        if (this.currentEngine && this.currentEngine.canvas) {
            this.currentEngine.canvas.style.display = 'block';
            this.currentEngine.canvas.style.pointerEvents = 'auto';
        }
        console.log(`Switched rendering engine to: ${this.currentEngineType}`);
        this.logEngineStates();
    }

    _setupWebGLCanvasStyle(webglCanvas) {
        webglCanvas.style.position = 'absolute';
        webglCanvas.style.top = '0';
        webglCanvas.style.left = '0';
        webglCanvas.style.width = '100%';
        webglCanvas.style.height = '100%';
        webglCanvas.style.display = 'none'; // Initially hidden
        webglCanvas.style.pointerEvents = 'none'; // Initially no pointer events
    }

    _addWebGLCanvasToDOM() {
        if (this.engines['webgl'] && this.engines['webgl'].canvas) {
            this.displayCanvas.parentNode.insertBefore(this.engines['webgl'].canvas, this.displayCanvas);
        }
    }

    logEngineStates() {
        if (this.displayCanvas) {
            console.debug("Canvas2D State:");
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

    // Modified compositeLayers to accept layers (matrices are stored internally)
    compositeLayers(layers) {
        if (this.currentEngineType === 'webgl') {
            const glEngine = this.engines['webgl'];
            glEngine.bindSuperCompositeFramebuffer(); // Render to super-sampled FBO

            // Clear the composite FBO for a fresh composition
            glEngine.gl.clear(glEngine.gl.COLOR_BUFFER_BIT);

            for (const layer of layers) {
                if (!layer.visible) continue;
                // Calculate MVP for each layer: Projection * View * Model
                const mvpMatrix = mat4.create();
                mat4.multiply(mvpMatrix, this.projectionMatrix, this.viewMatrix);
                mat4.multiply(mvpMatrix, mvpMatrix, layer.modelMatrix);
                
                glEngine.compositeLayer(layer, mvpMatrix);
            }
            glEngine.unbindSuperCompositeFramebuffer(); // Unbind after all layers are composed

            // Now render the super-sampled composite to the display canvas
            glEngine.renderToDisplay(); // This method now handles using the superCompositeTexture
        } else {
            // Existing Canvas2D fallback logic
            this.currentEngine.compositeLayers(layers);
        }
    }

    // Modified drawing methods to pass matrices needed for brush drawing (PV matrix)
    drawCircle(x, y, radius, color, isEraser, targetLayer, projectionMatrix, viewMatrix) {
        if (this.currentEngineType === 'webgl') {
            this.engines['webgl'].drawCircle(x, y, radius, color, isEraser, targetLayer, projectionMatrix, viewMatrix);
        } else {
            this.currentEngine.drawCircle(x, y, radius, color, isEraser, targetLayer);
        }
    }

    drawLine(x1, y1, r1, x2, y2, r2, color, isEraser, targetLayer, projectionMatrix, viewMatrix) {
        if (this.currentEngineType === 'webgl') {
            this.engines['webgl'].drawLine(x1, y1, r1, x2, y2, r2, color, isEraser, targetLayer, projectionMatrix, viewMatrix);
        } else {
            this.currentEngine.drawLine(x1, y1, r1, x2, y2, r2, color, isEraser, targetLayer);
        }
    }

    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    // renderToDisplay is now an internal call within compositeLayers for WebGL
}