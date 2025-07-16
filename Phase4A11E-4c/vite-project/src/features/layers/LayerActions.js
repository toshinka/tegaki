import Layer from './layer.js';

class LayerActions {
    constructor(layerStore, storageService, historyStore) {
        this.layerStore = layerStore;
        this.storageService = storageService;
        this.historyStore = historyStore;
    }

    addLayer() {
        // 現在のレイヤー構成と選択状態を保存
        const oldLayers = [...this.layerStore.getLayers()];
        const oldSelectedId = this.layerStore.getSelectedLayerId();
        
        // 新しいレイヤーを作成して追加
        const newLayer = this.layerStore.addLayer();
        
        // アクションを履歴に記録
        this.historyStore.addState(
            () => { // undo
                this.layerStore.setLayers(oldLayers);
                this.layerStore.selectLayer(oldSelectedId);
            },
            () => { // redo
                this.layerStore.addLayer(newLayer, false); // redo時は履歴に追加しない
                this.layerStore.selectLayer(newLayer.id);
            }
        );
    }

    removeLayer(layerId) {
        const layerToRemove = this.layerStore.getLayerById(layerId);
        if (!layerToRemove) return;

        const oldLayers = [...this.layerStore.getLayers()];
        const oldSelectedId = this.layerStore.getSelectedLayerId();
        
        this.layerStore.removeLayer(layerId);

        const newSelectedId = this.layerStore.getSelectedLayerId();
        
        this.historyStore.addState(
             () => { // undo
                this.layerStore.setLayers(oldLayers);
                this.layerStore.selectLayer(oldSelectedId);
             },
             () => { // redo
                this.layerStore.removeLayer(layerId, false);
                this.layerStore.selectLayer(newSelectedId);
             }
        );
    }

    selectLayer(layerId) {
        this.layerStore.selectLayer(layerId);
    }
    
    moveLayer(layerId, direction) {
        const oldLayers = [...this.layerStore.getLayers()];
        const success = this.layerStore.moveLayer(layerId, direction);
        if(success) {
            const newLayers = [...this.layerStore.getLayers()];
             this.historyStore.addState(
                 () => this.layerStore.setLayers(oldLayers),
                 () => this.layerStore.setLayers(newLayers)
            );
        }
    }

    setLayerVisibility(layerId, visible) {
        const layer = this.layerStore.getLayerById(layerId);
        if(!layer) return;

        const oldVisibility = layer.visible;
        this.layerStore.setLayerVisibility(layerId, visible);
        
        this.historyStore.addState(
             () => this.layerStore.setLayerVisibility(layerId, oldVisibility, false),
             () => this.layerStore.setLayerVisibility(layerId, visible, false)
        );
    }
    
    setLayerOpacity(layerId, opacity) {
        const layer = this.layerStore.getLayerById(layerId);
        if (!layer) return;
        
        const oldOpacity = layer.opacity;
        this.layerStore.setLayerOpacity(layerId, opacity);

        // 履歴に状態を記録
        this.historyStore.addState(
            () => this.layerStore.setLayerOpacity(layerId, oldOpacity, false),
            () => this.layerStore.setLayerOpacity(layerId, opacity, false)
        );
    }

    renameLayer(layerId, newName) {
        const layer = this.layerStore.getLayerById(layerId);
        if (!layer) return;

        const oldName = layer.name;
        this.layerStore.renameLayer(layerId, newName);

        this.historyStore.addState(
             () => this.layerStore.renameLayer(layerId, oldName, false),
             () => this.layerStore.renameLayer(layerId, newName, false)
        );
    }
    
    saveLayers() {
        this.storageService.saveToIndexedDB();
    }
}

export default LayerActions;