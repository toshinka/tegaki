/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (WebGL-Only)
 * Version: 3.0.0 (Phase 4A11Z - WebGL-Only Architecture)
 *
 * - 変更点 (Phase 4A11Z):
 * - 「🎨Phase 4A11Z WebGL専用構成への完全移行 指示書」に基づき、WebGL専用構成に全面改修。
 * - Canvas2DEngineに関する全てのコード、import、エンジン切替ロジックを完全に削除。
 * - WebGL非対応ブラウザではアラートを表示し、処理を中断するエラーハンドリングを導入。
 * - constructor内で直接WebGLEngineを初期化し、displayCanvas（イベント用）と
 * webglCanvas（描画用）の役割を明確に分離・設定する。
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
        webglCanvas.style.zIndex = (parseInt(displayStyle.zIndex) || 0) + 1;
        
        console.log("WebGL canvas style setup completed");
    }

    _addWebGLCanvasToDOM(webglCanvas) {
        if (this.displayCanvas.parentNode) {
            this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas.nextSibling);
            console.log("WebGL canvas added to DOM");
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---
    // Canvas2Dエンジンがなくなったため、全ての命令はWebGLエンジンに送られます。
    drawCircle(...args) { this.currentEngine.drawCircle(...args); }
    drawLine(...args) { this.currentEngine.drawLine(...args); }
    fill(...args) { this.currentEngine.fill(...args); }
    clear(...args) { this.currentEngine.clear(...args); }
    getTransformedImageData(...args) { return this.currentEngine.getTransformedImageData(...args); }
    compositeLayers(...args) { this.currentEngine.compositeLayers(...args); }
    renderToDisplay(...args) { this.currentEngine.renderToDisplay(...args); }
    syncDirtyRectToImageData(...args) { this.currentEngine.syncDirtyRectToImageData?.(...args); }
}