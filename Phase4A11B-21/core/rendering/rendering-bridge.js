/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (WebGL-Only)
 * Version: 3.1.0 (Phase 4A11B-21 - Fix Transform Glitch)
 *
 * - 変更点 (Phase 4A11B-21):
 * - 「🎨Phase 4A11B-21 指示書」に基づき、getTransformedImageDataの実装を修正。
 * - 従来は本ファイルに処理を記述していましたが、責務分離の観点から、
 * WebGLに関する専門的な処理はすべてwebgl-engine.jsに委譲する方式に変更。
 * - これにより、core-engine -> rendering-bridge -> webgl-engineという
 * 一貫した呼び出しフローを確立し、メンテナンス性を向上させます。
 * ===================================================================================
 */
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(displayCanvas) {
        // 【4】 WebGL非対応時のエラー処理をalertに一本化
        if (!WebGLEngine.isSupported()) {
            alert('このブラウザはWebGLをサポートしていません。対応ブラウザでご利用ください。');
            throw new Error('WebGL not supported');
        }

        this.displayCanvas = displayCanvas;
        
        // 【1】 WebGLエンジンのみを直接初期化
        this.currentEngine = null;
        this.currentEngineType = 'webgl';

        try {
            // WebGL描画用の新しいCanvasを生成
            const webglCanvas = document.createElement('canvas');
            webglCanvas.width = this.displayCanvas.width;
            webglCanvas.height = this.displayCanvas.height;

            // スタイルを設定し、DOMツリーに追加
            this._setupWebGLCanvasStyle(webglCanvas);
            this._addWebGLCanvasToDOM(webglCanvas);

            // WebGLEngineをインスタンス化
            this.currentEngine = new WebGLEngine(webglCanvas);

            if (!this.currentEngine.gl) {
                // WebGLEngineのコンストラクタ内でWebGLコンテキスト取得に失敗した場合
                 alert('WebGLの初期化に失敗しました。アプリケーションを開始できません。');
                 throw new Error('WebGL Engine failed to initialize its rendering context.');
            }

            // 【3】 displayCanvasは透明にしてイベント取得のみに利用
            this.displayCanvas.style.opacity = '0';
            this.displayCanvas.style.pointerEvents = 'auto'; // マウスイベントはこちらで受け取る

            // WebGL用Canvasは表示するが、マウスイベントは透過させる
            webglCanvas.style.display = 'block';
            webglCanvas.style.pointerEvents = 'none';
            
            console.log("RenderingBridge initialized in WebGL-only mode.");

        } catch (e) {
            console.error("Fatal error during WebGL engine initialization:", e);
            // エラーを再スローしてアプリケーションの実行を停止
            throw e;
        }
    }

    _setupWebGLCanvasStyle(webglCanvas) {
        const displayStyle = window.getComputedStyle(this.displayCanvas);
        
        webglCanvas.style.position = displayStyle.position || 'absolute';
        webglCanvas.style.left = displayStyle.left || '0px';
        webglCanvas.style.top = displayStyle.top || '0px';
        webglCanvas.style.width = displayStyle.width || `${this.displayCanvas.width}px`;
        webglCanvas.style.height = displayStyle.height || `${this.displayCanvas.height}px`;
        webglCanvas.style.zIndex = (parseInt(displayStyle.zIndex) || 0) -1; // displayCanvasの背後に配置
        
        console.log("WebGL canvas style setup completed");
    }

    _addWebGLCanvasToDOM(webglCanvas) {
        if (this.displayCanvas.parentNode) {
            // displayCanvasの「前」に挿入して、イベントを受け取るdisplayCanvasが最前面になるようにする
            this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas);
            console.log("WebGL canvas added to DOM");
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---
    
    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }
    syncDirtyRectToImageData(...args) { this.currentEngine.syncDirtyRectToImageData?.(...args); }
    
    /**
     * 【Phase 4A11B-21 改修箇所】
     * WebGLエンジンに変形後の画像データ取得処理を委譲します。
     * これにより、描画処理とデータ取得の責務がWebGLエンジンに集約され、
     * 呼び出しフローが統一されます。
     * @param {...any} args - WebGLEngineのgetTransformedImageDataに渡す引数
     * @returns {ImageData | null} 取得したImageDataオブジェクト、または失敗時にnull
     */
    getTransformedImageData(...args) {
        if (this.currentEngine && typeof this.currentEngine.getTransformedImageData === 'function') {
            return this.currentEngine.getTransformedImageData(...args);
        }
        console.error("getTransformedImageData is not available on the current rendering engine.");
        return null;
    }
}