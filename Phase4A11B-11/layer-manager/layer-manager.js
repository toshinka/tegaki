// Layerクラスをcore-engine.jsからインポートします
import { Layer } from '../core-engine.js';

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

    // [追加] DB復元用にIDと名前を指定してレイヤーを作成
    createLayer(id, name) {
        const newLayer = new Layer(name, this.width, this.height, id);
        this.layers.push(newLayer);
        // layers配列をソートしてID順に並べる
        this.layers.sort((a, b) => a.id - b.id);
        return newLayer;
    }

    // [追加] IDでレイヤーを検索
    getLayerById(id) {
        return this.layers.find(layer => layer.id === id);
    }
    
    // [追加] IDでレイヤーをアクティブにする
    switchLayerById(id) {
        const index = this.layers.findIndex(layer => layer.id === id);
        if (index !== -1) {
            this.switchLayer(index);
        }
    }
    
    setupInitialLayers() {
        // setupInitialLayersはDBに何もないときだけ呼ばれるので、
        // IndexedDBに保存する処理は不要。代わりにonDrawEndで保存される。
        this.addLayer(); // 背景レイヤー
        this.layers[0].name = '背景';
        this.layers[0].fill('#f0e0d6');
        this.addLayer(); // 描画レイヤー
        
        // 初期状態をundo履歴に保存
        this.app.canvasManager.saveState();
    } 
    
    addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        // LayerのIDは自動でインクリメントされる
        const newLayer = new Layer(`レイヤー ${Layer.nextId}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
        // ★ onDrawEndを呼び出してIndexedDBに新規レイヤーを保存
        this.app.canvasManager.onDrawEnd?.(newLayer);
    } 
    
    deleteActiveLayer() {
        if (this.activeLayerIndex <= 0 || this.layers.length <= 1) return;
        const deletedLayer = this.layers[this.activeLayerIndex];
        this.layers.splice(this.activeLayerIndex, 1);
        const newActiveIndex = Math.min(this.layers.length - 1, this.activeLayerIndex);
        this.renameLayers();
        this.switchLayer(newActiveIndex);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
        // ★ IndexedDBからも削除
        this.app.db?.deleteLayerFromIndexedDB(deletedLayer.id);
    } 
    
    renameLayers() {
        let drawingLayerCount = 1;
        this.layers.forEach((layer) => {
            if (layer.name !== '背景') {
                layer.name = `レイヤー ${drawingLayerCount++}`;
            }
        });
    } 
    
    switchLayer(index) {
        if (index < 0 || index >= this.layers.length) return;
        this.activeLayerIndex = index;
        if (this.app.layerUIManager) {
            this.app.layerUIManager.renderLayers();
        }
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
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
        // ★ IndexedDBに保存
        this.app.canvasManager.onDrawEnd?.(newLayer);
    } 
    
    mergeDownActiveLayer() {
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
        
        this.layers.splice(this.activeLayerIndex, 1);
        this.switchLayer(this.activeLayerIndex - 1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();

        // ★ IndexedDBの状態を更新
        this.app.canvasManager.onDrawEnd?.(bottomLayer);
        this.app.db?.deleteLayerFromIndexedDB(topLayer.id);
    } 
}