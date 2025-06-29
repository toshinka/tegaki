/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Rendering Bridge (Dynamic Switching)
 * Version: 2.0.0 (Phase 4A-1)
 *
 * 描画エンジンを動的に切り替える機能を持つ、新しいブリッジです。
 * core-engineからの描画命令を、現在選択されているエンジン（Canvas2D or WebGL）
 * に適切に振り分けます。
 * ===================================================================================
 */
import { Canvas2DEngine } from './canvas2d-engine.js';
import { WebGLEngine } from './webgl-engine.js';

export class RenderingBridge {
    constructor(displayCanvas) {
        this.displayCanvas = displayCanvas;
        this.displayCtx = displayCanvas.getContext('2d', { willReadFrequently: true }); // 追加: displayCanvasの2Dコンテキスト
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
                webglCanvas.style.position = 'absolute'; // displayCanvasと同じ位置に配置
                webglCanvas.style.left = '0';
                webglCanvas.style.top = '0';
                webglCanvas.style.display = 'none'; // 初期状態では非表示

                this.engines['webgl'] = new WebGLEngine(webglCanvas);

                // .glプロパティが正常に作られていれば成功とみなす
                if (this.engines['webgl'] && this.engines['webgl'].gl) {
                    console.log("WebGL Engine initialized successfully.");
                    // WebGLキャンバスをDOMに追加（一度だけ）
                    // displayCanvasの親要素に挿入することで、位置関係を保つ
                    this.displayCanvas.parentNode.insertBefore(webglCanvas, this.displayCanvas.nextSibling);
                } else {
                    console.warn("WebGL Engine could not get context. It might not be fully supported.");
                    this.engines['webgl'] = null; // WebGLコンテキストが取得できなかった場合はnullに設定
                }
            } catch (e) {
                console.error("Failed to initialize WebGL engine:", e);
                this.engines['webgl'] = null;
            }
        } else {
            console.warn("WebGL is not supported in this browser.");
        }

        // 初期エンジンを設定
        // WebGLが利用可能ならWebGLを優先、そうでなければCanvas2D
        this.setEngine(this.engines['webgl'] ? 'webgl' : 'canvas2d');
    }

    /**
     * エンジンを切り替えるメソッド
     * @param {string} type - 'canvas2d' または 'webgl'
     * @returns {boolean} 切り替えが成功したかどうか
     */
    setEngine(type) {
        if (this.engines[type]) {
            // 現在のエンジンがCanvas2Dだった場合、WebGLキャンバスを非表示に
            if (this.currentEngineType === 'canvas2d' && this.engines['webgl'] && this.engines['webgl'].canvas) {
                this.engines['webgl'].canvas.style.display = 'none';
            }
            // 現在のエンジンがWebGLだった場合、displayCanvasを非表示に
            if (this.currentEngineType === 'webgl' && this.displayCanvas) {
                this.displayCanvas.style.display = 'none';
            }

            this.currentEngine = this.engines[type];
            this.currentEngineType = type;
            console.log(`Switched to ${type} engine.`);

            // 新しいエンジンに応じてキャンバスの表示を切り替える
            if (type === 'webgl') {
                if (this.currentEngine.canvas) { // WebGLキャンバスが存在するか確認
                    this.currentEngine.canvas.style.display = 'block'; // WebGLキャンバスを表示
                }
                this.displayCanvas.style.display = 'none'; // displayCanvasを非表示
            } else { // Canvas2Dに戻す場合
                if (this.engines['webgl'] && this.engines['webgl'].canvas) {
                    this.engines['webgl'].canvas.style.display = 'none'; // WebGLキャンバスを非表示
                }
                this.displayCanvas.style.display = 'block'; // displayCanvasを表示
            }

            return true;
        } else {
            console.warn(`'${type}' engine is not available. Staying on '${this.currentEngineType}'.`);
            return false;
        }
    }

    // --- DrawingEngineのインターフェースを現在のエンジンに委譲 ---

    drawCircle(...args) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return;
        }
        this.currentEngine.drawCircle(...args);
    }
    drawLine(...args) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return;
        }
        this.currentEngine.drawLine(...args);
    }
    fill(...args) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return;
        }
        this.currentEngine.fill(...args);
    }
    clear(...args) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return;
        }
        this.currentEngine.clear(...args);
    }
    getTransformedImageData(...args) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return null;
        }
        return this.currentEngine.getTransformedImageData(...args);
    }

    /**
     * レイヤー群を合成するメソッド。
     * core-engineから渡されたcompositionDataに最終的な合成結果を書き込む。
     * @param {Array<Layer>} layers - 合成するレイヤーの配列
     * @param {ImageData} compositionData - 合成結果を書き込むImageDataオブジェクト
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.currentEngine) {
            console.error("No drawing engine is set.");
            return;
        }
        // 現在のエンジン（Canvas2DまたはWebGL）のcompositeLayersを呼び出す
        this.currentEngine.compositeLayers(layers, compositionData, dirtyRect);
    }

    /**
     * 最終的に合成されたImageDataをdisplayCanvasに描画するメソッド
     * @param {ImageData} imageData - 描画するImageDataオブジェクト (compositionData)
     * @param {object} dirtyRect - 再描画が必要な領域
     */
    renderToDisplay(imageData, dirtyRect) {
        // dirtyRectに基づいて、ImageDataの一部をdisplayCanvasに描画する
        // WebGLエンジンが最終描画まで担うようになった場合は、このメソッドはWebGL側で実装されるか、不要になる
        if (this.displayCtx && imageData) {
            const { minX, minY, maxX, maxY } = dirtyRect;
            const width = maxX - minX;
            const height = maxY - minY;

            if (width > 0 && height > 0) {
                // dirtyRectで指定された範囲のみをコピーして描画する
                const imageDataToPut = new ImageData(
                    new Uint8ClampedArray(imageData.data.buffer, (minY * imageData.width + minX) * 4, width * height * 4),
                    width,
                    height
                );
                // putImageDataの第4,5,6,7引数はコピー元のImageDataの座標とサイズ
                // 第2,3引数は描画先のCanvasの座標
                this.displayCtx.putImageData(imageDataToPut, minX, minY, 0, 0, width, height);
            }
        }
    }
}