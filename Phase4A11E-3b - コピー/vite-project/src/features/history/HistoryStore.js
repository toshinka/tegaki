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

    /**
     * 現在の状態を履歴に追加します。
     * undo後のredo分は切り捨てられます。
     * @param {object} state - 保存するアプリケーションの状態
     */
    saveState(state) {
        // undo後に新しい状態が保存された場合、現在のhistoryIndexより後の履歴は切り捨てる
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex = this.history.length - 1; // 最新の状態が追加されたので、インデックスを更新
        this.notify(); // 履歴の状態が変更されたことを通知
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

    /**
     * 一つ前の状態に戻します。
     * @returns {object|null} 一つ前の状態。存在しない場合はnull。
     */
    undo() {
        if (this.canUndo()) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            return this.history[this.historyIndex];
        }
        return null;
    }

    /**
     * 一つ後の状態に進めます。
     * @returns {object|null} 一つ後の状態。存在しない場合はnull。
     */
    redo() {
        if (this.canRedo()) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            return this.history[this.historyIndex];
        }
        return null;
    }

    /**
     * 履歴全体をリセットします。
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.notify();
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