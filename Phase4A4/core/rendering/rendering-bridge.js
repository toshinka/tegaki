/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.0.1 (Phase 4A-3 Hotfix)
 *
 * WebGLが利用可能な場合に、デフォルトでWebGLエンジンを選択するよう修正。
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
        let webglAvailable = false;

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
                
                // ★追加: CSSで非表示のCanvasがレイアウトに影響を与えないようにする
                webglCanvas.style.position = 'absolute';
                webglCanvas.style.top = '0';
                webglCanvas.style.left = '0';
                
                this.engines['webgl'] = new WebGLEngine(webglCanvas);

                if (this.engines['webgl'].gl) {
                    console.log("WebGL Engine initialized successfully.");
                    webglAvailable = true; // ★成功フラグを立てる
                } else {
                     console.warn("WebGL Engine initialization returned no context. It will be unavailable.");
                }
            } catch (e) {
                console.warn("WebGL Engine initialization failed:", e);
            }
        } else {
            console.warn("WebGL is not supported in this browser.");
        }

        // ★★★ 修正箇所 ★★★
        // WebGLが利用可能なら 'webgl' を、そうでなければ 'canvas2d' をデフォルトに設定
        const defaultEngine = webglAvailable ? 'webgl' : 'canvas2d';
        this.setEngine(defaultEngine);
    }

    /**
     * 使用する描画エンジンを切り替えます。
     * @param {'canvas2d' | 'webgl'} type - 切り替えたいエンジンの種類
     * @returns {boolean} 切り替えが成功したかどうか
     */
    setEngine(type) {
        if (this.engines[type] && (type !== 'webgl' || this.engines[type].gl)) {
            this.currentEngine = this.engines[type];
            this.currentEngineType = type;
            console.log(`Switched rendering engine to: ${type}`);
            
            if (type === 'webgl') {
                this.currentEngine.canvas.style.display = 'block'; 
                this.displayCanvas.style.display = 'none'; 
                if (!this.displayCanvas.parentNode.contains(this.currentEngine.canvas)) {
                     this.displayCanvas.parentNode.insertBefore(this.currentEngine.canvas, this.displayCanvas);
                }
            } else { 
                if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'none'; 
                }
                this.displayCanvas.style.display = 'block'; 
            }

            return true;
        } else {
            console.warn(`'${type}' engine is not available. Staying on '${this.currentEngineType}'.`);
            return false;
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---

    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }
}