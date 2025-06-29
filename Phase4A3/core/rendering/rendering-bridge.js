/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching) - FIXED VERSION
 * Version: 2.1.1 (Phase 4A-3: WebGL Canvas Display Fix)
 *
 * 描画エンジンを動的に切り替える機能を持つ、新しいブリッジです。
 * core-engineからの描画命令を、現在選択されているエンジン（Canvas2D or WebGL）
 * に適切に振り分けます。
 *
 * 【修正点】
 * ・WebGLキャンバスの表示問題を修正
 * ・適切なスタイル設定とDOM操作を追加
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
        this.webglCanvasAdded = false; // WebGLキャンバスがDOMに追加済みかのフラグ

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
                
                // ★修正★ WebGLキャンバスに適切なスタイルを設定
                this._setupWebGLCanvasStyle(webglCanvas);
                
                this.engines['webgl'] = new WebGLEngine(webglCanvas);

                // .glプロパティが正常に作られていれば成功とみなす
                if (this.engines['webgl'].gl) {
                    console.log("WebGL Engine initialized successfully.");
                    // ★修正★ 初期化時にWebGLキャンバスをDOMに追加
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
     * ★新規追加★ WebGLキャンバスのスタイルを設定
     * @param {HTMLCanvasElement} webglCanvas 
     */
    _setupWebGLCanvasStyle(webglCanvas) {
        const displayStyle = window.getComputedStyle(this.displayCanvas);
        
        // 基本的なスタイルをコピー
        webglCanvas.style.position = displayStyle.position || 'absolute';
        webglCanvas.style.left = displayStyle.left || '0px';
        webglCanvas.style.top = displayStyle.top || '0px';
        webglCanvas.style.width = displayStyle.width || `${this.displayCanvas.width}px`;
        webglCanvas.style.height = displayStyle.height || `${this.displayCanvas.height}px`;
        webglCanvas.style.zIndex = displayStyle.zIndex || '1';
        webglCanvas.style.pointerEvents = 'none'; // イベントは元のキャンバスで処理
        webglCanvas.style.display = 'none'; // 初期は非表示
        
        // デバッグ用のボーダー（必要に応じて削除）
        webglCanvas.style.border = '2px solid red';
        
        console.log("WebGL canvas style setup completed:", {
            width: webglCanvas.style.width,
            height: webglCanvas.style.height,
            position: webglCanvas.style.position
        });
    }

    /**
     * ★新規追加★ WebGLキャンバスをDOMに追加
     */
    _addWebGLCanvasToDOM() {
        if (!this.webglCanvasAdded && this.engines['webgl'] && this.displayCanvas.parentNode) {
            const webglCanvas = this.engines['webgl'].canvas;
            this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas);
            this.webglCanvasAdded = true;
            console.log("WebGL canvas added to DOM");
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
            
            // ★修正★ より確実なキャンバス表示切り替え
            if (type === 'webgl') {
                // WebGLに切り替え
                if (!this.webglCanvasAdded) {
                    this._addWebGLCanvasToDOM();
                }
                
                // WebGLキャンバスを表示
                this.currentEngine.canvas.style.display = 'block';
                console.log("WebGL canvas display set to block");
                
                // Canvas2Dキャンバスを非表示
                this.displayCanvas.style.display = 'none';
                console.log("Canvas2D canvas hidden");
                
            } else { // Canvas2Dに戻す場合
                // WebGLキャンバスを非表示
                if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'none';
                    console.log("WebGL canvas hidden");
                }
                
                // Canvas2Dキャンバスを表示
                this.displayCanvas.style.display = 'block';
                console.log("Canvas2D canvas displayed");
            }

            // ★デバッグ用★ 現在の表示状態をログ出力
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
        console.log("- Canvas2D display:", this.displayCanvas.style.display);
        console.log("- Canvas2D visible:", this.displayCanvas.offsetWidth > 0 && this.displayCanvas.offsetHeight > 0);
        
        if (this.engines['webgl'] && this.engines['webgl'].canvas) {
            const webglCanvas = this.engines['webgl'].canvas;
            console.log("- WebGL display:", webglCanvas.style.display);
            console.log("- WebGL visible:", webglCanvas.offsetWidth > 0 && webglCanvas.offsetHeight > 0);
            console.log("- WebGL in DOM:", document.contains(webglCanvas));
        }
    }

    /**
     * ★新規追加★ エンジン切り替えテスト用メソッド
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