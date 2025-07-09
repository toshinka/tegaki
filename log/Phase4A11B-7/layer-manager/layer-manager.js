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
    
    setupInitialLayers() {
        const bgLayer = new Layer('背景', this.width, this.height);
        bgLayer.fill('#f0e0d6');
        this.layers.push(bgLayer);
        const drawingLayer = new Layer('レイヤー 1', this.width, this.height);
        this.layers.push(drawingLayer);
        this.switchLayer(1);
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    } 
    
    addLayer() {
        if (this.layers.length >= 99) return;
        const insertIndex = this.activeLayerIndex + 1;
        const newLayer = new Layer(`レイヤー ${this.layers.length + 1}`, this.width, this.height);
        this.layers.splice(insertIndex, 0, newLayer);
        this.renameLayers();
        this.switchLayer(insertIndex);
        this.app.canvasManager.saveState();
    } 
    
    deleteActiveLayer() {
        if (this.activeLayerIndex === 0 || this.layers.length <= 1) return;
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
    } 
}