// New content for layer-manager.js
/*
 * ===================================================================================
 * Toshinka Tegaki Tool - Layer Manager
 * Version: 2.9.0 (Phase 4A11-Pre - Layer Management Refactor)
 *
 * - 機能：レイヤーの作成、管理、選択、順序変更、可視性/不透明度/ブレンドモードの制御。
 * - CoreEngine.jsからレイヤー関連のロジックを分離し、軽量化とモジュール化を促進。
 * - レイヤーオブジェクト自体もこのモジュール内で定義し、管理を集中させる。
 * ===================================================================================
 */

// --- Utility Function (Moved from core-engine.js) ---
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
}

// --- Layer Class (Moved from core-engine.js) ---
export class Layer {
    constructor(name, width, height) {
        this.name = name;
        this.visible = true;
        this.opacity = 100;
        this.blendMode = 'normal';
        this.imageData = new ImageData(width, height);
        
        // Phase 4A11-Pre: 旧transformプロパティをコメントアウト
        // this.transform = { x: 0, y: 0, scale: 1, rotation: 0, flipX: 1, flipY: 1 };
        
        // WebGL用のモデル行列 (glMatrixが必要な場合は別途インポートを検討)
        // ここでは glMatrix.mat4.create() は直接実行できないので、glMatrixのインポートが必要です
        // もしglMatrixがLayerManagerの外部から提供されるなら、コンストラクタで受け取るか、
        // CoreEngine側でモデル行列をLayerに設定するように変更が必要です。
        // 今のところglMatrixはwebgl-engine.jsで使われているので、Layerクラス自体は純粋なデータ構造として扱います。
        // modelMatrixの初期化は、レイヤーが作成され、WebGLコンテキストが利用可能になった後に行われるべきです。
        // ここでは便宜上、シンプルな配列で保持します。
        this.modelMatrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; // Identity matrix

        // Phase 4A11-Pre: 旧transformプロパティに依存する部分をコメントアウト
        // this.originalImageData = null;
        this.gpuDirty = true; // GPUテクスチャが更新を必要とするか
    }
    clear() {
        this.imageData.data.fill(0);
        this.gpuDirty = true;
    }
    fill(hexColor) {
        const color = hexToRgba(hexColor);
        const data = this.imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = color.a;
        }
        this.gpuDirty = true;
    }
}

// --- LayerManager Class (Moved from core-engine.js) ---
export class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.canvasWidth = app.canvasManager.width;
        this.canvasHeight = app.canvasManager.height;
    }

    setupInitialLayers() {
        this.addLayer('背景', true);
        this.addLayer('レイヤー 1');
        this.switchLayer(1);
    }

    addLayer(name, isBackground = false) {
        const newLayer = new Layer(name, this.canvasWidth, this.canvasHeight);
        if (isBackground) {
            this.layers.unshift(newLayer);
            this.activeLayerIndex = 0;
            newLayer.fill('#FFFFFF'); // 背景レイヤーは白で塗りつぶし
        } else {
            // アクティブレイヤーの次に挿入
            const insertIndex = this.activeLayerIndex !== -1 ? this.activeLayerIndex + 1 : this.layers.length;
            this.layers.splice(insertIndex, 0, newLayer);
            this.switchLayer(insertIndex);
        }
        this.app.layerUIManager.updateLayerList();
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
        return newLayer;
    }

    deleteLayer(index) {
        if (this.layers.length <= 1) {
            alert('最後のレイヤーは削除できません。');
            return;
        }
        if (index > -1 && index < this.layers.length) {
            const deletedLayer = this.layers.splice(index, 1);
            if (deletedLayer) {
                // WebGLテクスチャを解放
                this.app.canvasManager.renderingBridge.deleteLayerTexture(deletedLayer[0]);
            }
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            }
            if (this.activeLayerIndex < 0) { // すべてのレイヤーが削除された場合（理論上ないはずだが念のため）
                this.activeLayerIndex = 0;
            }
            this.app.layerUIManager.updateLayerList();
            this.app.canvasManager.renderAllLayers();
            this.app.canvasManager.saveState();
        }
    }

    switchLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.app.layerUIManager.updateLayerList();
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex];
    }

    moveLayer(fromIndex, toIndex) {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || 
            fromIndex >= this.layers.length || toIndex >= this.layers.length) {
            return;
        }
        const [movedLayer] = this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, movedLayer);
        
        // アクティブレイヤーインデックスの調整
        if (this.activeLayerIndex === fromIndex) {
            this.activeLayerIndex = toIndex;
        } else if (this.activeLayerIndex >= Math.min(fromIndex, toIndex) && 
                   this.activeLayerIndex <= Math.max(fromIndex, toIndex)) {
            if (fromIndex < toIndex) { // 下に移動
                this.activeLayerIndex--;
            } else { // 上に移動
                this.activeLayerIndex++;
            }
        }
        this.app.layerUIManager.updateLayerList();
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    setLayerVisibility(index, visible) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].visible = visible;
            this.app.canvasManager.renderAllLayers();
            this.app.canvasManager.saveState();
        }
    }

    setLayerOpacity(index, opacity) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].opacity = opacity;
            this.app.canvasManager.renderAllLayers();
            this.app.canvasManager.saveState();
        }
    }

    setLayerBlendMode(index, blendMode) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].blendMode = blendMode;
            this.app.canvasManager.renderAllLayers();
            this.app.canvasManager.saveState();
        }
    }
}