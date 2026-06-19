// ================================================================================
// HistorySystem - Undo/Redo管理（EventBus連携版）
// ================================================================================

class HistorySystem {
    constructor(layerSystem) {
        this.layerSystem = layerSystem;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        EventBus.on("history:undo", () => this.undo());
        EventBus.on("history:redo", () => this.redo());
    }

    saveState() {
        const state = this._captureState();
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        EventBus.emit("history:stateChanged", {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    _captureState() {
        return {
            layers: this.layerSystem.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                imageData: this._captureLayerData(layer)
            })),
            activeLayerId: this.layerSystem.activeLayer?.id || null
        };
    }

    _captureLayerData(layer) {
        const canvas = layer.texture.source.resource;
        const ctx = canvas.getContext("2d");
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    undo() {
        if (!this.canUndo()) return;

        const currentState = this._captureState();
        this.redoStack.push(currentState);

        const previousState = this.undoStack.pop();
        this._restoreState(previousState);

        EventBus.emit("history:stateChanged", {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    redo() {
        if (!this.canRedo()) return;

        const currentState = this._captureState();
        this.undoStack.push(currentState);

        const nextState = this.redoStack.pop();
        this._restoreState(nextState);

        EventBus.emit("history:stateChanged", {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    _restoreState(state) {
        while (this.layerSystem.layers.length > 0) {
            const layer = this.layerSystem.layers[0];
            this.layerSystem.removeLayer(layer.id);
        }

        state.layers.forEach(layerData => {
            const layer = this.layerSystem.createLayer(layerData.name);
            layer.id = layerData.id;
            layer.visible = layerData.visible;
            layer.sprite.alpha = layerData.opacity;

            const canvas = layer.texture.source.resource;
            const ctx = canvas.getContext("2d");
            ctx.putImageData(layerData.imageData, 0, 0);
            layer.texture.update();
        });

        if (state.activeLayerId) {
            const activeLayer = this.layerSystem.layers.find(l => l.id === state.activeLayerId);
            if (activeLayer) {
                this.layerSystem.setActiveLayer(activeLayer.id);
            }
        }

        EventBus.emit("layer:updated");
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        EventBus.emit("history:stateChanged", {
            canUndo: false,
            canRedo: false
        });
    }
}