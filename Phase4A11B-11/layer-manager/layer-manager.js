import { Layer } from '../core-engine.js';
// IndexedDB操作関数をインポートして、レイヤー操作と連動させます。
import { saveLayerToIndexedDB, deleteLayerFromIndexedDB } from '../core/db/db-indexed.js';

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

    async setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);
        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);

        // 作成した初期レイヤーをDBに保存します。
        for (const layer of this.layers) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = layer.imageData.width;
            tempCanvas.height = layer.imageData.height;
            tempCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
            await saveLayerToIndexedDB(layer.id, layer.name, tempCanvas.toDataURL());
        }

        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    async addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${Layer.nextId}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);

        // 新しい空のレイヤーをDBに保存します。
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newLayer.imageData.width;
        tempCanvas.height = newLayer.imageData.height;
        await saveLayerToIndexedDB(newLayer.id, newLayer.name, tempCanvas.toDataURL());

        this.app.canvasManager.saveState();
    }
    
    // アプリ起動時にIndexedDBからレイヤー情報を復元するために使います。 
    createLayer(id, name) {
        if (this.layers.some(layer => layer.id === id)) return;
        const newLayer = new Layer(name, this.width, this.height, id);
        this.layers.push(newLayer);
    }

    async deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;
        const deletedLayer = this.layers[this.activeLayerIndex];
        
        // DBからもレイヤーを削除します。
        await deleteLayerFromIndexedDB(deletedLayer.id);

        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    renameLayers() {
        this.layers.forEach((layer, index) => {
            if (index > 0) layer.name = `レイヤー ${index}`;
        });
    }

    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app && this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
    }
    
    // IDを使ってレイヤーを切り替えるためのメソッドです。 
    switchLayerById(id) {
        const index = this.layers.findIndex(layer => layer.id === id);
        if (index !== -1) {
            this.switchLayer(index);
        }
    }

    getCurrentLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    async duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;

        const newLayer = new Layer(`${activeLayer.name}のコピー`, this.width, this.height);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.gpuDirty = true;

        const insertIndex = this.activeLayerIndex + 1;
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);

        // 複製したレイヤーをDBに保存します。
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newLayer.imageData.width;
        tempCanvas.height = newLayer.imageData.height;
        tempCanvas.getContext('2d').putImageData(newLayer.imageData, 0, 0);
        await saveLayerToIndexedDB(newLayer.id, newLayer.name, tempCanvas.toDataURL());

        this.app.canvasManager.saveState();
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
        const topLayerCtx = topLayerCanvas.getContext('2d');
        topLayerCtx.putImageData(topLayer.imageData, 0, 0);
        
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        bottomLayer.gpuDirty = true;
        
        // 結合して消えた方のレイヤーをDBから削除し、
        await deleteLayerFromIndexedDB(topLayer.id);
        // 結合されたレイヤーの新しい状態をDBに保存します。
        const mergedDataURL = tempCtx.canvas.toDataURL();
        await saveLayerToIndexedDB(bottomLayer.id, bottomLayer.name, mergedDataURL);

        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }
}