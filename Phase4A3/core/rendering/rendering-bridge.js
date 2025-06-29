/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.1.0 (Phase 4A-3: Default WebGL & WebGL RenderToDisplay)
 *
 * 描画エンジンを動的に切り替える機能を持つ、新しいブリッジです。
 * core-engineからの描画命令を、現在選択されているエンジン（Canvas2D or WebGL）
 * に適切に振り分けます。
 *
 * 【改修点】
 * ・デフォルトの描画エンジンをWebGLに設定しました。
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
            // Canvas2Dは表示用のキャンバスを直接使う
            this.engines['canvas2d'] = new Canvas2DEngine(this.displayCanvas);
            console.log("Canvas2D Engine initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Canvas2D engine:", e);
            throw e; // Canvas2Dは必須なので、失敗したらここで処理を止める
        }

        // 2. WebGLエンジンが利用可能かチェックして、試行する
        if (WebGLEngine.isSupported()) {
            try {
                // ★重要★ WebGL用には、メモリ上に新しい非表示のキャンバスを作成して渡す
                // これにより「同一Canvas要素で複数コンテキスト取得不可」問題を回避する
                const webglCanvas = document.createElement('canvas');
                webglCanvas.width = this.displayCanvas.width;
                webglCanvas.height = this.displayCanvas.height;
                
                this.engines['webgl'] = new WebGLEngine(webglCanvas);

                // .glプロパティが正常に作られていれば成功とみなす
                if (this.engines['webgl'].gl) {
                    console.log("WebGL Engine initialized successfully.");
                } else {
                     console.warn("WebGL Engine initialization returned no context. It will be unavailable.");
                }
            } catch (e) {
                console.warn("WebGL Engine initialization failed:", e);
            }
        } else {
            console.warn("WebGL is not supported in this browser.");
        }

        // ★改修点: デフォルトのエンジンをWebGLに設定 (利用可能な場合)
        if (this.engines['webgl'] && this.engines['webgl'].gl) {
            this.setEngine('webgl');
        } else {
            // WebGLが利用できない場合はCanvas2Dにフォールバック
            this.setEngine('canvas2d');
            console.warn("Falling back to Canvas2D engine as WebGL is not available or failed to initialize.");
        }
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
            
            // WebGLに切り替えた場合、WebGL用キャンバスを表示し、2D用キャンバスを非表示にする
            if (type === 'webgl') {
                this.currentEngine.canvas.style.display = 'block'; // WebGLキャンバスを表示
                this.displayCanvas.style.display = 'none'; // Canvas2Dキャンバスを非表示
                // WebGLキャンバスをDOMに追加（一度だけ）
                if (!this.displayCanvas.parentNode.contains(this.currentEngine.canvas)) {
                     this.displayCanvas.parentNode.insertBefore(this.currentEngine.canvas, this.displayCanvas);
                }
            } else { // Canvas2Dに戻す場合
                if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'none'; // WebGLキャンバスを非表示
                }
                this.displayCanvas.style.display = 'block'; // Canvas2Dキャンバスを表示
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