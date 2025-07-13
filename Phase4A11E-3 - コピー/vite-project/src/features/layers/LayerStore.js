// src/features/layers/LayerStore.js
import { Layer } from './Layer.js';

export class LayerStore {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.activeLayerIndex = -1;
    }

    async setupInitialLayers() {
        this.addLayer('背景', false); // 背景レイヤー
        const bgLayer = this.layers[0];
        bgLayer.fill('#FFFFFF'); // 白で塗りつぶし
        
        this.addLayer('レイヤー 1', false); // 通常レイヤー
        this.switchLayer(1);
        await this.app.canvasManager.onDrawEnd?.(bgLayer);
        await this.app.canvasManager.onDrawEnd?.(this.layers[1]);
    }

    addLayer(name = `レイヤー ${Layer.nextId}`, shouldRender = true) {
        const newLayer = new Layer(name, this.app.canvasManager.width, this.app.canvasManager.height);
        this.layers.push(newLayer);
        this.switchLayer(this.layers.length - 1, shouldRender);
        this.app.canvasManager.saveState();
        return newLayer;
    }

    deleteActiveLayer() {
        if (this.layers.length > 1 && this.activeLayerIndex !== -1) {
            this.layers.splice(this.activeLayerIndex, 1);
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            }
            this.switchLayer(this.activeLayerIndex);
            this.app.canvasManager.saveState();
        }
    }

    duplicateActiveLayer() {
        const activeLayer = this.getCurrentLayer();
        if (!activeLayer) return;

        const newLayer = this.addLayer(`${activeLayer.name}のコピー`, false);
        newLayer.imageData.data.set(activeLayer.imageData.data);
        newLayer.opacity = activeLayer.opacity;
        newLayer.blendMode = activeLayer.blendMode;
        newLayer.visible = activeLayer.visible;
        newLayer.gpuDirty = true;
        
        this.app.layerUIManager.renderLayers();
        this.app.canvasManager.renderAllLayers();
        this.app.canvasManager.saveState();
    }

    mergeDownActiveLayer() {
        if (this.activeLayerIndex > 0) {
            const topLayer = this.layers[this.activeLayerIndex];
            const bottomLayer = this.layers[this.activeLayerIndex - 1];

            // 一時的なキャンバスで描画結果を合成
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.app.canvasManager.width;
            tempCanvas.height = this.app.canvasManager.height;
            const tempCtx = tempCanvas.getContext('2d');

            // 下のレイヤーを描画
            tempCtx.putImageData(bottomLayer.imageData, 0, 0);

            // 上のレイヤーを描画（不透明度とブレンドモードを考慮）
            tempCtx.globalAlpha = topLayer.opacity / 100;
            tempCtx.globalCompositeOperation = topLayer.blendMode;
            tempCtx.drawImage(this.createCanvasFromImageData(topLayer.imageData), 0, 0);

            // 合成結果を下のレイヤーのimageDataに書き戻す
            bottomLayer.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            bottomLayer.gpuDirty = true;

            // 上のレイヤーを削除
            this.layers.splice(this.activeLayerIndex, 1);
            
            // アクティブレイヤーを更新
            this.switchLayer(this.activeLayerIndex - 1);
            this.app.canvasManager.saveState();
        }
    }

    createCanvasFromImageData(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    switchLayer(index, shouldRender = true) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            const newActiveLayer = this.layers[index];
            this.app.canvasManager.setCurrentLayer(newActiveLayer);
            this.app.layerUIManager.renderLayers();
            if (shouldRender) {
                this.app.canvasManager.renderAllLayers();
            }
        }
    }

    getCurrentLayer() {
        if (this.activeLayerIndex !== -1 && this.layers[this.activeLayerIndex]) {
            return this.layers[this.activeLayerIndex];
        }
        return null;
    }
}