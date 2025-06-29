/*
 * ===================================================================================
 * Toshinka Tegaki Tool - WebGL Engine (Texture Management)
 * Version: 0.2.0 (Phase 4A-2)
 *
 * レイヤーのImageDataをWebGLテクスチャに変換し、管理する機能を追加しました。
 * まだ画面には描画されませんが、GPUに画像データを送る準備が整います。
 * ===================================================================================
 */
import { DrawingEngine } from './drawing-engine.js';

export class WebGLEngine extends DrawingEngine {
    constructor(canvas) {
        super(canvas);
        this.gl = null;

        // ★新規追加: 作成したテクスチャをレイヤーごとに保管する場所
        this.layerTextures = new Map();

        try {
            this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!this.gl) {
                throw new Error('WebGL is not supported in this browser.');
            }
        } catch (e) {
            console.error("WebGL Engine initialization failed:", e);
            return;
        }

        this.gl.clearColor(0.1, 0.1, 0.1, 1.0);
    }

    /**
     * WebGLが利用可能か事前にチェックするための静的メソッド
     * @returns {boolean}
     */
    static isSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    // --- DrawingEngineのインターフェース実装 ---

    clear(imageData) {
        if (!this.gl) return;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        if (imageData) {
            imageData.data.fill(0);
        }
        // WebGLエンジンに切り替えてクリアした際に、保管済みのテクスチャも破棄する
        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        console.log("WebGL textures cleared.");
    }
    
    /**
     * ★新規追加: レイヤーのImageDataからWebGLテクスチャを作成または更新する
     * @param {ImageData} imageData - レイヤーの画像データ
     * @returns {WebGLTexture} 作成または更新されたテクスチャ
     */
    _createOrUpdateTextureFromImageData(imageData) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // WebGLでは画像のY軸が逆なので、ピクセルを反転させる設定
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // テクスチャにImageDataをアップロード
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

        // テクスチャの拡大・縮小時のフィルタリング方法を設定（ピクセルアートなのでニアレストネイバー法）
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        
        // ラッピング（画像の端の外側をどう扱うか）の設定
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 他のテクスチャに影響を与えないように、バインドを解除
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * ★処理を更新: レイヤーをテクスチャに変換し、管理する
     */
    compositeLayers(layers, compositionData, dirtyRect) {
        if (!this.gl) return;

        console.log(`Compositing ${layers.length} layers for WebGL...`);

        // 既存のテクスチャを一旦クリア（簡単のため。将来的には差分更新が望ましい）
        this.layerTextures.forEach(texture => this.gl.deleteTexture(texture));
        this.layerTextures.clear();
        
        // 表示可能なレイヤーをテクスチャに変換して保管
        for (const layer of layers) {
            if (!layer.visible || layer.opacity === 0) continue;

            const texture = this._createOrUpdateTextureFromImageData(layer.imageData);
            this.layerTextures.set(layer, texture); // Mapにレイヤーとテクスチャのペアを保存
            console.log(`Texture created for layer: "${layer.name}"`, texture);
        }

        // この段階ではまだ描画しないので、キャンバスをクリアするだけ
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    // ▼▼▼ 以下はまだ未実装のメソッド群です ▼▼▼
    drawCircle(imageData, centerX, centerY, radius, color, isEraser) {}
    drawLine(imageData, x0, y0, x1, y1, size, color, isEraser, p0, p1, calculatePressureSize) {}
    fill(imageData, color) {}
    getTransformedImageData(sourceImageData, transform) { return sourceImageData; }
    renderToDisplay(compositionData, dirtyRect) {}
}