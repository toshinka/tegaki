/**
 * [クラス責務] LayerActions.js
 * 目的：レイヤーに対するユーザー操作（ユースケース）のロジックをカプセル化する。
 */
export class LayerActions {
    constructor(layerStore, viewport, historyStore) {
        this.layerStore = layerStore;
        this.viewport = viewport;
        this.historyStore = historyStore;
    }

    async setupInitialLayers() {
        this.layerStore._addLayer('背景');
        const bgLayer = this.layerStore.getCurrentLayer();
        const data = bgLayer.imageData.data;
        for (let i = 0; i < data.length; i += 4) { data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=255; }
        bgLayer.gpuDirty = true;
        
        this.layerStore._addLayer('レイヤー 1');
    }

    addLayer(name) {
        this.layerStore._addLayer(name || `レイヤー ${this.layerStore.getLayers().length + 1}`);
        this.historyStore.saveState();
    }
    
    deleteActiveLayer() {
        if (this.layerStore.getLayers().length <= 1) return;
        if (confirm('レイヤーを削除しますか？')) {
            this.layerStore._deleteLayer(this.layerStore.activeLayerIndex);
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
        }
    }
    
    duplicateActiveLayer() {
        const activeLayer = this.layerStore.getCurrentLayer();
        if (!activeLayer) return;
        const newLayer = this.layerStore._addLayer(`${activeLayer.name}のコピー`, activeLayer.imageData);
        this.layerStore.updateLayerProperties(this.layerStore.layers.indexOf(newLayer), {
            opacity: activeLayer.opacity,
            blendMode: activeLayer.blendMode,
            visible: activeLayer.visible,
        });
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        this.historyStore.saveState();
    }

    mergeDownActiveLayer() {
        const activeIndex = this.layerStore.activeLayerIndex;
        if (activeIndex > 0) {
            this.layerStore._mergeLayers(activeIndex, activeIndex - 1);
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
        }
    }

    switchLayer(index) {
        this.layerStore.switchLayer(index);
    }
    
    updateLayerProperties(index, props) {
        this.layerStore.updateLayerProperties(index, props);
        this.viewport.renderAllLayers(this.layerStore.getLayers());
        // Note: Does not create undo state for performance.
    }
    
    clearActiveLayer() {
        const layer = this.layerStore.getCurrentLayer();
        if(layer) {
            const data = layer.imageData.data;
            for(let i=0; i < data.length; i++) { data[i] = 0; }
            layer.gpuDirty = true;
            this.viewport.renderAllLayers(this.layerStore.getLayers());
            this.historyStore.saveState();
        }
    }
}