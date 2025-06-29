/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching) - FIXED VERSION
 * Version: 2.1.2 (Phase 4A-3: Mouse Event Fix)
 *
 * WebGL化後にペンで書けなくなる問題を修正しました。
 * WebGL使用時も元のキャンバスでイベントを受け取り、描画結果だけをWebGLで処理します。
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
                // ★修正★ WebGL用キャンバスを元のキャンバスと同じ位置・サイズで作成
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

    /**
     * ★修正★ WebGLキャンバスのスタイルを設定（イベント処理は元のキャンバスで継続）
     */
    _setupWebGLCanvasStyle(webglCanvas) {
        const displayStyle = window.getComputedStyle(this.displayCanvas);
        
        // 元のキャンバスと全く同じ位置・サイズに配置
        webglCanvas.style.position = displayStyle.position || 'absolute';
        webglCanvas.style.left = displayStyle.left || '0px';
        webglCanvas.style.top = displayStyle.top || '0px';
        webglCanvas.style.width = displayStyle.width || `${this.displayCanvas.width}px`;
        webglCanvas.style.height = displayStyle.height || `${this.displayCanvas.height}px`;
        webglCanvas.style.zIndex = (parseInt(displayStyle.zIndex) || 0) + 1; // 元のキャンバスより前面に
        
        // ★重要★ WebGLキャンバスはイベントを受け取らない（元のキャンバスで処理）
        webglCanvas.style.pointerEvents = 'none';
        webglCanvas.style.display = 'none'; // 初期は非表示
        
        console.log("WebGL canvas style setup completed");
    }

    /**
     * WebGLキャンバスをDOMに追加
     */
    _addWebGLCanvasToDOM() {
        if (this.engines['webgl'] && this.displayCanvas.parentNode) {
            const webglCanvas = this.engines['webgl'].canvas;
            // 元のキャンバスの直後に挿入
            this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas.nextSibling);
            console.log("WebGL canvas added to DOM");
        }
    }

    /**
     * ★修正★ エンジン切り替え（表示の切り替えのみ、イベント処理は常に元のキャンバス）
     */
    setEngine(type) {
        if (this.engines[type] && (type !== 'webgl' || this.engines[type].gl)) {
            this.currentEngine = this.engines[type];
            this.currentEngineType = type;
            console.log(`Switched rendering engine to: ${type}`);
            
            if (type === 'webgl') {
                // WebGLに切り替え：WebGLキャンバスを表示、元のキャンバスは透明に
                if (this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'block';
                }
                // ★重要★ 元のキャンバスは非表示にせず、透明にしてイベント処理を継続
                this.displayCanvas.style.opacity = '0';
                this.displayCanvas.style.pointerEvents = 'auto'; // イベントは受け取る
                console.log("WebGL canvas displayed, original canvas made transparent for events");
                
            } else {
                // Canvas2Dに戻す：元のキャンバスを表示、WebGLキャンバスを非表示
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

    /**
     * ★デバッグ用★ キャンバスの表示状態をログ出力
     */
    _logCanvasVisibility() {
        console.log("Canvas visibility status:");
        console.log("- Canvas2D opacity:", this.displayCanvas.style.opacity);
        console.log("- Canvas2D pointerEvents:", this.displayCanvas.style.pointerEvents);
        console.log("- Canvas2D visible:", this.displayCanvas.offsetWidth > 0 && this.displayCanvas.offsetHeight > 0);
        
        if (this.engines['webgl'] && this.engines['webgl'].canvas) {
            const webglCanvas = this.engines['webgl'].canvas;
            console.log("- WebGL display:", webglCanvas.style.display);
            console.log("- WebGL pointerEvents:", webglCanvas.style.pointerEvents);
            console.log("- WebGL visible:", webglCanvas.offsetWidth > 0 && webglCanvas.offsetHeight > 0);
        }
    }

    /**
     * エンジン切り替えテスト用メソッド
     */
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
    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }
}