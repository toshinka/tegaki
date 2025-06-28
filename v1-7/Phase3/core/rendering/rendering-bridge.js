/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge
 *
 * このファイルは、アプリケーション本体 (core-engine) と
 * 実際の描画エンジン (Canvas2D, WebGL等) との間に立つ「橋渡し役」です。
 *
 * core-engineはこのブリッジに描画を依頼するだけで、裏でどのエンジンが
 * 動いているかを気にする必要がなくなります。
 * 将来、エンジンを切り替える際は、このファイルの修正だけで済みます。
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
// import { WebGLEngine } from './webgl-engine.js'; // 将来の拡張用

export class RenderingBridge {
    constructor(canvas) {
        // 現在はCanvas2Dエンジンを直接使用
        // 将来的にはここでユーザー設定やブラウザ対応状況に応じてエンジンを選択する
        this.engine = new Canvas2DEngine(canvas);
    }

    // --- DrawingEngineのインターフェースをそのまま呼び出す ---

    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {
        this.engine.drawCircle(imageData, centerX, centerY, radius, color, isEraser);
    }

    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {
        this.engine.drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize);
    }

    fill(imageData, color) {
        this.engine.fill(imageData, color);
    }
    
    clear(imageData) {
        this.engine.clear(imageData);
    }

    getTransformedImageData(sourceImageData, transform) {
        return this.engine.getTransformedImageData(sourceImageData, transform);
    }

    compositeLayers(layers, compositionData, dirtyRect) {
        this.engine.compositeLayers(layers, compositionData, dirtyRect);
    }

    renderToDisplay(compositionData, dirtyRect) {
        this.engine.renderToDisplay(compositionData, dirtyRect);
    }
}