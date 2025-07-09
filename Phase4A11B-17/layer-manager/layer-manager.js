// layer-manager.js

// core-engine.jsからLayerクラスをインポートします
import { Layer } from '../core-engine.js';
// 新しく作成したIndexedDB操作用の関数をインポートします
import {
    saveLayerToIndexedDB,
    deleteLayerFromIndexedDB,
    clearAllLayersFromIndexedDB
} from '../core/db/db-indexed.js';

export class LayerManager {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.width = 344;
        this.height = 135;
        this.mergeCanvas = document.createElement('canvas');
        this.mergeCanvas.width = this.width;
        this.mergeCanvas.height = this.height;
        this.mergeCtx = this.mergeCanvas.getContext('2d');
    }

    /**
     * アプリケーション初回起動時に、初期レイヤーを作成します。
     * DBもクリアされ、新しいレイヤーが保存されます。
     */
    async setupInitialLayers() {
        await clearAllLayersFromIndexedDB();
        this.layers = [];

        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);
        await this.app.canvasManager.onDrawEnd(bgLayer); // 背景をDBに保存

        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);
        await this.app.canvasManager.onDrawEnd(drawingLayer); // 描画レイヤーをDBに保存

        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    /**
     * 新しいレイヤーを追加します。
     */
    async addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        // Layerクラスの静的プロパティnextIdを使って新しいIDを自動で割り振ります
        const newLayer = new Layer(`レイヤー ${Layer.nextId}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);

        await this.app.canvasManager.onDrawEnd(newLayer); // 新規レイヤーをDBに保存
        this.app.canvasManager.saveState();
    }

    /**
     * 現在アクティブなレイヤーを削除します。
     */
    async deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;

        const layerToDelete = this.layers[this.activeLayerIndex];
        await deleteLayerFromIndexedDB(layerToDelete.id); // DBから削除

        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    /**
     * レイヤー名をインデックスに基づいて「レイヤー 1」「レイヤー 2」のように振り直します。
     */
    renameLayers() {
        this.layers.forEach((layer, index) => {
            if (index > 0) { // 背景レイヤーは改名しない
                const newName = `レイヤー ${index}`;
                if (layer.name !== newName) {
                    layer.name = newName;
                    // 名前変更もDBに反映
                    this.app.canvasManager.onDrawEnd(layer);
                }
            }
        });
    }

    /**
     * 指定されたインデックスのレイヤーに切り替えます。
     * @param {number} index - 切り替えたいレイヤーのインデックス
     */
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    }

    /**
     * IDで指定されたレイヤーに切り替えます。（DBからの復元時に使用）
     * @param {number} id - レイヤーID
     */
    switchLayerById(id) {
        const index = this.layers.findIndex(layer => layer.id === id);
        if (index !== -1) {
            this.switchLayer(index);
        }
    }

    /**
     * 現在アクティブなレイヤーのオブジェクトを返します。
     * @returns {Layer | null}
     */
    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    /**
     * IDで指定されたレイヤーオブジェクトを返します。（DBからの復元時に使用）
     * @param {number} id - レイヤーID
     * @returns {Layer | undefined}
     */
    getLayerById(id) {
        return this.layers.find(layer => layer.id === id);
    }

    /**
     * アクティブなレイヤーを複製します。
     */
    async duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer || this.layers.length >= 99) return;

        // 新しいレイヤーを作成
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.visible = activeLayer.visible;
        newLayer.opacity = activeLayer.opacity;
        newLayer.blendMode = activeLayer.blendMode;
        newLayer.gpuDirty = true;

        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);

        await this.app.canvasManager.onDrawEnd(newLayer); // 複製したレイヤーをDBに保存
        this.app.canvasManager.saveState();
    }

    /**
     * アクティブなレイヤーを一つ下のレイヤーと結合します。
     */
    async mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return; // 背景レイヤーには結合できない
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];

        const tempCtx = this.mergeCtx;
        tempCtx.clearRect(0, 0, this.width, this.height);
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);

        // ★★★★★ 修正 (Phase 4A11B-15) ★★★★★
        // Phase 4A11B-15 指示: drawImage() を getImageData/putImageData に置換します。
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;

        // 【注意】 putImageDataは不透明度(globalAlpha)やブレンドモード(globalCompositeOperation)を適用しません。
        // そのため、この変更により、レイヤー結合時に上のレイヤーの不透明度やブレンドモードが無視され、
        // 単純に上書きされるようになります。これは指示書に厳密に従った結果です。
        const topLayerImageData = topLayer.imageData;
        tempCtx.putImageData(topLayerImageData, 0, 0);
        // ★★★★★ 修正ここまで ★★★★★

        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.gpuDirty = true;

        // DBから上のレイヤーを削除
        await deleteLayerFromIndexedDB(topLayer.id);
        // 結合後の下のレイヤーをDBに保存
        await this.app.canvasManager.onDrawEnd(bottomLayer);

        this.layers.splice(this.activeLayerIndex, 1);
        this.renameLayers(); // 結合後に名前を振り直す
        this.switchLayer(this.activeLayerIndex - 1);

        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
}