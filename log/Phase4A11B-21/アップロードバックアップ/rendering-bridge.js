/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (WebGL-Only)
 * Version: 3.0.1 (Phase 4A11B-20 - Jaggy-Free Capture)
 *
 * - 変更点 (Phase 4A11B-20):
 * - 「🎨Phase 4A11B-20 指示書」に基づき、getTransformedImageDataを改修。
 * - レイヤー移動開始時のジャギー劣化を防ぐため、gl.readPixelsを使用して
 * WebGLフレームバッファからピクセルデータを直接読み取る方式に変更。
 * - これにより、drawImageによる暗黙的な補間を完全に回避し、ピクセルパーフェクトな
 * データ転写を実現する。
 * - 指示書に基づき、取得したImageDataのサイズを検証するログを追加。
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
     * 【Phase 4A11B-20 改修箇所】
     * WebGLのフレームバッファから指定領域のピクセルデータをImageDataとして取得します。
     * gl.readPixelsを使用することで、補間なしの正確なピクセルデータを取得し、ジャギーを防ぎます。
     * @param {number} sourceX - 読み取り開始点のX座標
     * @param {number} sourceY - 読み取り開始点のY座標
     * @param {number} width - 読み取る領域の幅
     * @param {number} height - 読み取る領域の高さ
     * @returns {ImageData | null} 取得したImageDataオブジェクト、または失敗時にnull
     */
    getTransformedImageData(sourceX, sourceY, width, height) {
        const gl = this.currentEngine.gl;
        if (!gl) {
            console.error("WebGL context is not available for getTransformedImageData.");
            return null;
        }

        // ピクセルデータを格納するための配列を準備
        const pixels = new Uint8Array(width * height * 4);

        // WebGLのフレームバッファからピクセルデータを読み取ります。
        // readPixelsのY座標は左下が原点のため、キャンバス座標（左上が原点）から変換する必要があります。
        const glY = gl.drawingBufferHeight - (sourceY + height);

        // フレームバッファをバインド（念のため）
        // オフスクリーン描画をしている場合は、正しいフレームバッファをバインドする必要があります。
        // ここではデフォルトのフレームバッファを想定しています。
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(
            sourceX,      // X
            glY,          // Y (変換済み)
            width,        // 幅
            height,       // 高さ
            gl.RGBA,      // フォーマット
            gl.UNSIGNED_BYTE, // 型
            pixels        // 格納先
        );
        
        // Uint8ClampedArrayを使ってImageDataオブジェクトを作成
        const imageData = new ImageData(new Uint8ClampedArray(pixels.buffer), width, height);

        // 指示書[3]に基づく検証ログ
        console.log(`[🔍検証] 転写後ImageDataサイズ: ${imageData.width} x ${imageData.height}`);

        return imageData;
    }
}