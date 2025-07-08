import { Layer } from '../core-engine.js';
import { deleteLayerFromIndexedDB } from '../core/db/db-indexed.js';

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

    // DBからの復元時に使用
    createLayer(id, name) {
        const newLayer = new Layer(name, this.width, this.height, id);
        this.layers.push(newLayer);
        this.layers.sort((a, b) => a.id - b.id);
        return newLayer;
    }

    getLayerById(id) {
        return this.layers.find(layer => layer.id === id);
    }

    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);
        
        const drawingLayer = new Layer(`レイヤー ${Layer.nextId}`, this.width, this.height);
        this.layers.push(drawingLayer);
        this.switchLayer(1);
        
        // 初期レイヤーをDBに保存するために onDrawEnd を呼び出す
        this.app.canvasManager.renderAllLayers();
        setTimeout(() => { // レンダリング後に実行
            this.layers.forEach(layer => this.app.canvasManager.onDrawEnd?.(layer));
        }, 100);

        this.app.canvasManager.saveState();
    }

    addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${Layer.nextId}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.switchLayer(insertIndex);
        this.app.canvasManager.onDrawEnd?.(newLayer); // 新規レイヤーをDBに保存
        this.app.canvasManager.saveState();
        this.app.layerUIManager.renderLayers?.();
    }

    async deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;
        const layerToDelete = this.layers[this.activeLayerIndex];
        if (layerToDelete) {
            await deleteLayerFromIndexedDB(layerToDelete.id); // DBから削除
        }
        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
        this.app.layerUIManager.renderLayers?.();
    }

    renameLayers() { /* インデックスベースの命名はDBと相性が悪いため、現在は使用しない */ }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        this.app.layerUIManager.renderLayers?.();
    }

    switchLayerById(id) {
        const index = this.layers.findIndex(layer => layer.id === id);
        if (index !== -1) this.switchLayer(index);
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;
        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.visible = activeLayer.visible;
        newLayer.opacity = activeLayer.opacity;
        newLayer.blendMode = activeLayer.blendMode;
        newLayer.gpuDirty = true;
        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        this.switchLayer(insertIndex);
        this.app.canvasManager.onDrawEnd?.(newLayer); // 複製レイヤーをDBに保存
        this.app.canvasManager.saveState();
        this.app.layerUIManager.renderLayers?.();
    }

    async mergeDownActiveLayer() {
        if (this.activeLayerIndex <= 0) return;
        const topLayer = this.layers[this.activeLayerIndex];
        const bottomLayer = this.layers[this.activeLayerIndex - 1];
        
        const tempCtx = this.mergeCtx;
        tempCtx.clearRect(0, 0, this.width, this.height);
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.width;
        topLayerCanvas.height = this.height;
        topLayerCanvas.getContext('2d').putImageData(topLayer.imageData, 0, 0);
        
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.gpuDirty = true;
        
        await deleteLayerFromIndexedDB(topLayer.id); // 上のレイヤーをDBから削除
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        
        this.app.canvasManager.onDrawEnd?.(bottomLayer); // 結合後のレイヤーをDBに保存
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
        this.app.layerUIManager.renderLayers?.();
    }
}