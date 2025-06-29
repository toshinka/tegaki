/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge
 * Version: 2.0.0 (Engine Switching support)
 *
 * このファイルは、アプリケーション本体 (core-engine) と
 * 実際の描画エンジン (Canvas2D, WebGL等) との間に立つ「橋渡し役」です。
 *
 * core-engineはこのブリッジに描画を依頼するだけで、裏でどのエンジンが
 * 動いているかを気にする必要がなくなります。
 * ★★★ WebGLエンジンを組み込み、切り替えられるように改修 ★★★
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
import { WebGLEngine } from './webgl-engine.js'; // ★ WebGLエンジンをインポート

export class RenderingBridge {
    constructor(canvas) {
        this.canvas = canvas;
        
        // 利用可能なエンジンを保持
        this.engines = {};
        this.engines.canvas2d = new Canvas2DEngine(this.canvas);
        this.engines.webgl = new WebGLEngine(this.canvas);

        // デフォルトの描画エンジン
        this.engine = this.engines.canvas2d;
        this.activeEngineType = 'canvas2d';
    }

    /**
     * 描画エンジンを切り替えるメソッド
     * @param {'canvas2d' | 'webgl'} type - 使用するエンジンの種類
     */
    setEngine(type) {
        if (this.engines[type]) {
            // WebGLエンジンが初期化に失敗している場合は切り替えない
            if (type === 'webgl' && !this.engines.webgl.gl) {
                console.error("WebGL engine is not available. Cannot switch.");
                return;
            }
            this.engine = this.engines[type];
            this.activeEngineType = type;
            console.log(`Rendering engine switched to: ${this.activeEngineType}`);

            // エンジン切り替え時にキャンバスをクリアする
            if (this.engine.compositeLayers) {
                 this.engine.compositeLayers([], null, null);
            }

        } else {
            console.error(`Engine type "${type}" is not supported.`);
        }
    }

    // --- DrawingEngineのインターフェースをそのまま呼び出す (変更なし) ---

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