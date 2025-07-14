import { mat4 } from 'gl-matrix';

/**
 * [クラス責務] HistoryStore.js
 * 目的：アプリケーションの操作履歴（Undo/Redo）の状態を管理する。
 */
export class HistoryStore {
    constructor({ layerStore }) {
        this.layerStore = layerStore;
        this.history = [];
        this.historyIndex = -1;
        this.subscribers = [];
        this.onStateRestored = null;
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    // 変更: saveState -> pushHistory
    pushHistory() {
        const state = {
            layers: this.layerStore.getLayers().map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData: new ImageData(
                    new Uint8ClampedArray(layer.imageData.data),
                    layer.imageData.width,
                    layer.imageData.height
                ),
                modelMatrix: Array.from(layer.modelMatrix)
            })),
            activeLayerIndex: this.layerStore.activeLayerIndex
        };
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        this.notify();
    }

    restoreState(state) {
        if (!state) return;
        const restoredLayers = state.layers.map(layerData => {
            const layer = new this.layerStore.Layer(layerData.name, layerData.imageData.width, layerData.imageData.height, layerData.id);
            Object.assign(layer, layerData); // Simplified assignment
            layer.modelMatrix = new Float32Array(layerData.modelMatrix);
            layer.gpuDirty = true;
            return layer;
        });
        this.layerStore.setLayers(restoredLayers, false); // Don't notify yet
        this.layerStore.switchLayer(state.activeLayerIndex, false); // Don't notify yet
        this.onStateRestored?.();
        this.notify();
    }

    undo() {
        if (this.canUndo()) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.canRedo()) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    // --- Subscription ---
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    notify() {
        this.subscribers.forEach(callback => callback({
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        }));
    }
}