/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Canvas 2D Engine
 * Version: 2.0 (Phase 4 Architecture)
 *
 * DrawingEngineインタフェースをCanvas 2D APIで実装したもの。
 * 主にピクセル単位の描画処理（線、円、塗りつぶしなど）を担当する。
 * ===================================================================================
 */
import { DrawingEngine } from './rendering-bridge.js';

// ... (hexToRgba関数など、前と同じ部分は省略) ...

export class Canvas2DEngine extends DrawingEngine {
    constructor(canvas, width, height) {
        // ... (コンストラクタは変更なし) ...
    }

    // --- Public API (from DrawingEngine) ---

    /**
     * @deprecated Phase 4以降、このメソッドはWebGLEngineに責務が移管されたため使用されません。
     */
    compositeAndRender(layers, dirtyRect) {
        console.warn("Canvas2DEngine.compositeAndRender is deprecated. Composition is now handled by WebGLEngine.");
        // (処理は残しておくが、基本的には呼ばれない)
    }
    
    // ... (clearLayer, fillLayer, drawCircle, drawLine, floodFill, mergeLayers, getTransformedImageData など、他の描画系メソッドは変更なし) ...

    /**
     * @deprecated Phase 4以降、このメソッドはWebGLEngineに責務が移管されたため使用されません。
     */
    exportToDataURL(layers) {
        console.warn("Canvas2DEngine.exportToDataURL is deprecated. Export is now handled by WebGLEngine.");
        return null;
    }

    // --- Private Helper Methods ---
    // ... (内部ヘルパーメソッドは変更なし) ...
}