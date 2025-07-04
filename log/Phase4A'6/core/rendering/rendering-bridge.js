/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.2.0 (Phase 4A'6 Performance Patch)
 *
 * - syncDirtyRectToImageDataメソッドの委譲を追加。
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(displayCanvas) {
        this.displayCanvas = displayCanvas;
        this.engines = {};
        this.currentEngine = null;
        this.currentEngineType = '';

        // 1. Canvas2Dエンジンは必ず初期化
        try {
            this.engines['canvas2d'] = new Canvas2DEngine(this.displayCanvas);
            console.log("Canvas2D Engine initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Canvas2D engine:", e);
            throw e;
        }

        // 2. WebGLエンジンが利用可能かチェックして、試行する
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
                } else {
                     console.warn("WebGL Engine initialization returned no context. It will be unavailable.");
                }
            } catch (e) {
                console.warn("WebGL Engine initialization failed:", e);
            }
        } else {
            console.warn("WebGL is not supported in this browser.");
        }

        // デフォルトのエンジンをWebGLに設定 (利用可能な場合)
        if (this.engines['webgl'] && this.engines['webgl'].gl) {
            this.setEngine('webgl');
        } else {
            this.setEngine('canvas2d');
            console.warn("Falling back to Canvas2D engine as WebGL is not available or failed to initialize.");
        }
    }

    _setupWebGLCanvasStyle(webglCanvas) {
        const displayStyle = window.getComputedStyle(this.displayCanvas);
        
        webglCanvas.style.position = displayStyle.position || 'absolute';
        webglCanvas.style.left = displayStyle.left || '0px';
        webglCanvas.style.top = displayStyle.top || '0px';
        webglCanvas.style.width = displayStyle.width || `${this.displayCanvas.width}px`;
        webglCanvas.style.height = displayStyle.height || `${this.displayCanvas.height}px`;
        webglCanvas.style.zIndex = (parseInt(displayStyle.zIndex) || 0) + 1;
        
        webglCanvas.style.pointerEvents = 'none';
        webglCanvas.style.display = 'none';
        
        console.log("WebGL canvas style setup completed");
    }

    _addWebGLCanvasToDOM() {
        if (this.engines['webgl'] && this.displayCanvas.parentNode) {
            const webglCanvas = this.engines['webgl'].canvas;
            this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas.nextSibling);
            console.log("WebGL canvas added to DOM");
        }
    }

    setEngine(type) {
        if (this.engines[type] && (type !== 'webgl' || this.engines[type].gl)) {
            this.currentEngine = this.engines[type];
            this.currentEngineType = type;
            console.log(`Switched rendering engine to: ${type}`);
            
            if (type === 'webgl') {
                if (this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'block';
                }
                this.displayCanvas.style.opacity = '0';
                this.displayCanvas.style.pointerEvents = 'auto';
                console.log("WebGL canvas displayed, original canvas made transparent for events");
                
            } else {
                if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'none';
                }
                this.displayCanvas.style.opacity = '1';
                this.displayCanvas.style.pointerEvents = 'auto';
                console.log("Canvas2D canvas restored to full visibility");
            }

            this._logCanvasVisibility();
            return true;
        } else {
            console.warn(`'${type}' engine is not available. Staying on '${this.currentEngineType}'.`);
            return false;
        }
    }

    _logCanvasVisibility() {
        if (console.debug) { // デバッグログは通常のログより目立たないように
            console.debug("Canvas visibility status:");
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

    testEngineSwitch() {
        console.log("Testing engine switch...");
        const currentType = this.currentEngineType;
        const targetType = currentType === 'webgl' ? 'canvas2d' : 'webgl';
        
        console.log(`Switching from ${currentType} to ${targetType}`);
        const success = this.setEngine(targetType);
        
        if (success) {
            setTimeout(() => {
                console.log(`Switching back from ${targetType} to ${currentType}`);
                this.setEngine(currentType);
            }, 2000);
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---
    // スプレッド構文(...)を使っているため、引数の数が変わっても自動的に全てが渡される
    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }

    /**
     * ★★★ 追加したメソッド委譲 ★★★
     * GPU->CPUのデータ同期用。オプショナルチェイニング(?.)を使い、
     * このメソッドを持たないエンジン（Canvas2Dなど）でもエラーにならないようにします。
     */
    syncDirtyRectToImageData(...args) { this.currentEngine.syncDirtyRectToImageData?.(...args); }
}