import { mat4 } from 'gl-matrix';

/**
 * [クラス責務] LayerStore.js
 * 目的：アプリケーションの全レイヤーに関する状態を一元管理する。
 */
export class LayerStore {
    constructor(LayerClass, canvasWidth, canvasHeight) {
        this.Layer = LayerClass;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.subscribers = [];
    }

    // --- State Access ---
    getLayers() { return this.layers; }
    getCurrentLayer() {
        return (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length)
            ? this.layers[this.activeLayerIndex]
            : null;
    }

    // --- State Modification ---
    _addLayer(name, imageData = null) {
        const newLayer = new this.Layer(name, this.canvasWidth, this.canvasHeight);
        if (imageData) {
            newLayer.imageData.data.set(imageData.data);
            newLayer.gpuDirty = true;
        }
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1);
        return newLayer;
    }

    _deleteLayer(index) {
        if (this.layers.length <= 1 || index < 0 || index >= this.layers.length) return;
        this.layers.splice(index, 1);
        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        }
        this.switchLayer(this.activeLayerIndex);
    }
    
    _mergeLayers(topIndex, bottomIndex) {
        const topLayer = this.layers[topIndex];
        const bottomLayer = this.layers[bottomIndex];
        if (!topLayer || !bottomLayer) return;
        
        // Use a temporary canvas to composite the two layers
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvasWidth;
        tempCanvas.height = this.canvasHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw bottom, then top
        tempCtx.putImageData(bottomLayer.imageData, 0, 0);
        tempCtx.globalAlpha = topLayer.opacity / 100;
        tempCtx.globalCompositeOperation = topLayer.blendMode;
        
        const topLayerCanvas = document.createElement('canvas');
        topLayerCanvas.width = this.canvasWidth;
        topLayerCanvas.height = this.canvasHeight;
        topLayerCanvas.getContext('2d').putImageData(topLayer.imageData, 0, 0);
        tempCtx.drawImage(topLayerCanvas, 0, 0);
        
        // Update bottom layer's data and remove top layer
        bottomLayer.imageData = tempCtx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
        bottomLayer.gpuDirty = true;
        this.layers.splice(topIndex, 1);
        this.switchLayer(bottomIndex);
    }

    setLayers(layers, shouldNotify = true) {
        this.layers = layers;
        const activeIndex = this.layers.findIndex(l => l.visible);
        this.activeLayerIndex = activeIndex !== -1 ? activeIndex : this.layers.length - 1;
        if (shouldNotify) this.notify();
    }

    switchLayer(index, shouldNotify = true) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            if (shouldNotify) this.notify();
        }
    }
    
    updateLayerProperties(index, props) {
        if (this.layers[index]) {
            Object.assign(this.layers[index], props);
            this.layers[index].gpuDirty = true;
            this.notify();
        }
    }

    // --- Subscription ---
    subscribe(callback) { this.subscribers.push(callback); }
    notify() {
        this.subscribers.forEach(cb => cb({
            layers: this.layers,
            activeLayerIndex: this.activeLayerIndex
        }));
    }
}