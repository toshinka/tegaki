// LayerManager-v2-0.js
class TegakiLayerManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 16:50:24';

        // レイヤー状態
        this.state = {
            layers: [],
            currentLayerId: null,
            maxLayers: 64,
            nextLayerId: 0,
            isCompositing: false,
            undoStack: [],
            redoStack: [],
            maxHistorySteps: 50
        };

        // レイヤーオプション
        this.defaultOptions = {
            name: '',
            opacity: 1.0,
            visible: true,
            locked: false,
            blendMode: 'source-over',
            mask: null,
            clip: false,
            metadata: {}
        };

        // キャンバス管理
        this.canvasManager = null;
        this.compositeCanvas = null;
        this.compositeContext = null;

        // ワーカー管理
        this.compositeWorker = null;
        this.workerBusy = false;
        this.workerQueue = [];

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Layer Manager at ${this.currentTimestamp}`);

        try {
            // キャンバスマネージャーの取得
            this.canvasManager = this.app.getManager('canvas');
            if (!this.canvasManager) {
                throw new Error('Canvas Manager not found');
            }

            // 合成用キャンバスの作成
            await this.createCompositeCanvas();

            // コンポジットワーカーの初期化
            await this.initializeCompositeWorker();

            // 初期レイヤーの作成
            await this.createInitialLayer();

            // イベントリスナーの設定
            this.setupEventListeners();

            console.log('Layer Manager initialization completed');

        } catch (error) {
            console.error('Layer Manager initialization failed:', error);
            throw error;
        }
    }

    async createCompositeCanvas() {
        const { width, height } = this.canvasManager.state;
        
        if ('OffscreenCanvas' in window) {
            this.compositeCanvas = new OffscreenCanvas(width, height);
        } else {
            this.compositeCanvas = document.createElement('canvas');
            this.compositeCanvas.width = width;
            this.compositeCanvas.height = height;
        }

        this.compositeContext = this.compositeCanvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });
    }

    async initializeCompositeWorker() {
        try {
            this.compositeWorker = new Worker('../Workers/composite-worker-v2-0.js');
            
            this.compositeWorker.onmessage = (event) => {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'composite-complete':
                        this.handleCompositeComplete(data);
                        break;
                    case 'composite-error':
                        this.handleCompositeError(data);
                        break;
                }

                this.workerBusy = false;
                this.processWorkerQueue();
            };

            this.compositeWorker.onerror = (error) => {
                console.error('Composite Worker error:', error);
                this.workerBusy = false;
                this.processWorkerQueue();
            };

        } catch (error) {
            console.warn('Failed to initialize Composite Worker:', error);
            this.compositeWorker = null;
        }
    }

    async createInitialLayer() {
        const layer = await this.createLayer({
            name: 'Background',
            locked: false
        });

        this.state.layers.push(layer);
        this.state.currentLayerId = layer.id;
    }

    setupEventListeners() {
        this.app.config.container.addEventListener('tegaki-layer-update', (event) => {
            const { type, layerId, data } = event.detail;
            this.handleLayerUpdate(type, layerId, data);
        });

        this.app.config.container.addEventListener('tegaki-layer-order', (event) => {
            const { sourceId, targetId, position } = event.detail;
            this.reorderLayer(sourceId, targetId, position);
        });
    }

    async createLayer(options = {}) {
        if (this.state.layers.length >= this.state.maxLayers) {
            throw new Error('Maximum layer count reached');
        }

        const layerId = this.state.nextLayerId++;
        const layerName = options.name || `Layer ${layerId + 1}`;

        const layer = {
            id: layerId,
            name: layerName,
            canvas: await this.createLayerCanvas(),
            ...this.defaultOptions,
            ...options
        };

        layer.context = layer.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true
        });

        return layer;
    }

    async createLayerCanvas() {
        const { width, height } = this.canvasManager.state;
        
        if ('OffscreenCanvas' in window) {
            return new OffscreenCanvas(width, height);
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }
    }

    async addLayer(options = {}) {
        const layer = await this.createLayer(options);
        
        // 履歴の保存
        this.saveHistoryState('add-layer', {
            layerId: layer.id,
            layerData: await this.serializeLayer(layer)
        });

        this.state.layers.push(layer);
        this.state.currentLayerId = layer.id;
        
        this.notifyLayerChange('add', layer.id);
        return layer;
    }

    async duplicateLayer(layerId) {
        const sourceLayer = this.getLayer(layerId);
        if (!sourceLayer) return null;

        const newLayer = await this.createLayer({
            name: `${sourceLayer.name} Copy`,
            opacity: sourceLayer.opacity,
            visible: sourceLayer.visible,
            blendMode: sourceLayer.blendMode
        });

        // キャンバスの内容をコピー
        newLayer.context.drawImage(sourceLayer.canvas, 0, 0);

        // 履歴の保存
        this.saveHistoryState('duplicate-layer', {
            sourceId: layerId,
            newId: newLayer.id,
            layerData: await this.serializeLayer(newLayer)
        });

        const sourceIndex = this.state.layers.findIndex(l => l.id === layerId);
        this.state.layers.splice(sourceIndex + 1, 0, newLayer);
        this.state.currentLayerId = newLayer.id;

        this.notifyLayerChange('duplicate', newLayer.id);
        return newLayer;
    }

    async deleteLayer(layerId) {
        const index = this.state.layers.findIndex(l => l.id === layerId);
        if (index === -1 || this.state.layers.length <= 1) return false;

        const layer = this.state.layers[index];

        // 履歴の保存
        this.saveHistoryState('delete-layer', {
            layerId: layerId,
            layerData: await this.serializeLayer(layer),
            index: index
        });

        // レイヤーの削除
        this.state.layers.splice(index, 1);

        // 現在のレイヤーの更新
        if (this.state.currentLayerId === layerId) {
            const newIndex = Math.min(index, this.state.layers.length - 1);
            this.state.currentLayerId = this.state.layers[newIndex].id;
        }

        this.notifyLayerChange('delete', layerId);
        return true;
    }

    async mergeLayer(sourceId, targetId) {
        const sourceLayer = this.getLayer(sourceId);
        const targetLayer = this.getLayer(targetId);
        
        if (!sourceLayer || !targetLayer) return false;

        // 履歴の保存
        this.saveHistoryState('merge-layer', {
            sourceId: sourceId,
            targetId: targetId,
            sourceData: await this.serializeLayer(sourceLayer),
            targetData: await this.serializeLayer(targetLayer)
        });

        // レイヤーの合成
        targetLayer.context.globalAlpha = sourceLayer.opacity;
        targetLayer.context.globalCompositeOperation = sourceLayer.blendMode;
        targetLayer.context.drawImage(sourceLayer.canvas, 0, 0);
        targetLayer.context.globalAlpha = 1;
        targetLayer.context.globalCompositeOperation = 'source-over';

        // ソースレイヤーの削除
        await this.deleteLayer(sourceId);

        this.notifyLayerChange('merge', targetId);
        return true;
    }

    async flattenLayers() {
        if (this.state.layers.length <= 1) return;

        // 履歴の保存
        this.saveHistoryState('flatten', {
            layers: await Promise.all(this.state.layers.map(l => this.serializeLayer(l)))
        });

        // 最下層のレイヤーをターゲットとして使用
        const targetLayer = this.state.layers[0];
        const layersToRemove = this.state.layers.slice(1);

        // レイヤーの合成
        for (const layer of layersToRemove) {
            if (layer.visible) {
                targetLayer.context.globalAlpha = layer.opacity;
                targetLayer.context.globalCompositeOperation = layer.blendMode;
                targetLayer.context.drawImage(layer.canvas, 0, 0);
            }
        }

        targetLayer.context.globalAlpha = 1;
        targetLayer.context.globalCompositeOperation = 'source-over';

        // 他のレイヤーを削除
        this.state.layers = [targetLayer];
        this.state.currentLayerId = targetLayer.id;

        this.notifyLayerChange('flatten');
    }

    reorderLayer(sourceId, targetId, position = 'before') {
        const sourceIndex = this.state.layers.findIndex(l => l.id === sourceId);
        const targetIndex = this.state.layers.findIndex(l => l.id === targetId);
        
        if (sourceIndex === -1 || targetIndex === -1) return false;

        // 履歴の保存
        this.saveHistoryState('reorder', {
            sourceId,
            targetId,
            position,
            sourceIndex,
            targetIndex
        });

        // レイヤーの移動
        const [layer] = this.state.layers.splice(sourceIndex, 1);
        const newIndex = position === 'before' ? targetIndex : targetIndex + 1;
        this.state.layers.splice(newIndex, 0, layer);

        this.notifyLayerChange('reorder', sourceId);
        return true;
    }

    setLayerOpacity(layerId, opacity) {
        const layer = this.getLayer(layerId);
        if (!layer) return;

        opacity = Math.max(0, Math.min(1, opacity));

        // 履歴の保存
        this.saveHistoryState('opacity', {
            layerId,
            oldOpacity: layer.opacity,
            newOpacity: opacity
        });

        layer.opacity = opacity;
        this.notifyLayerChange('opacity', layerId);
    }

    setLayerBlendMode(layerId, mode) {
        const layer = this.getLayer(layerId);
        if (!layer) return;

        // 履歴の保存
        this.saveHistoryState('blend-mode', {
            layerId,
            oldMode: layer.blendMode,
            newMode: mode
        });

        layer.blendMode = mode;
        this.notifyLayerChange('blend-mode', layerId);
    }

    setLayerVisibility(layerId, visible) {
        const layer = this.getLayer(layerId);
        if (!layer) return;

        // 履歴の保存
        this.saveHistoryState('visibility', {
            layerId,
            oldVisible: layer.visible,
            newVisible: visible
        });

        layer.visible = visible;
        this.notifyLayerChange('visibility', layerId);
    }

    setLayerLock(layerId, locked) {
        const layer = this.getLayer(layerId);
        if (!layer) return;

        // 履歴の保存
        this.saveHistoryState('lock', {
            layerId,
            oldLocked: layer.locked,
            newLocked: locked
        });

        layer.locked = locked;
        this.notifyLayerChange('lock', layerId);
    }

    setCurrentLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer || layer.locked) return;

        this.state.currentLayerId = layerId;
        this.notifyLayerChange('current', layerId);
    }

    getCurrentLayer() {
        return this.getLayer(this.state.currentLayerId);
    }

    getLayer(layerId) {
        return this.state.layers.find(l => l.id === layerId);
    }

    async compositeAll() {
        if (this.state.isCompositing) return;
        this.state.isCompositing = true;

        try {
            if (this.compositeWorker && !this.workerBusy) {
                await this.compositeWithWorker();
            } else {
                await this.compositeWithoutWorker();
            }
        } catch (error) {
            console.error('Layer composition failed:', error);
        } finally {
            this.state.isCompositing = false;
        }
    }

    async compositeWithWorker() {
        const layerData = await Promise.all(
            this.state.layers
                .filter(l => l.visible)
                .map(async l => ({
                    id: l.id,
                    opacity: l.opacity,
                    blendMode: l.blendMode,
                    imageData: await createImageBitmap(l.canvas)
                }))
        );

        if (this.workerBusy) {
            this.workerQueue.push({ layerData });
            return;
        }

        this.workerBusy = true;
        this.compositeWorker.postMessage({
            type: 'composite',
            layers: layerData,
            width: this.compositeCanvas.width,
            height: this.compositeCanvas.height
        }, layerData.map(l => l.imageData));
    }

    async compositeWithoutWorker() {
        const ctx = this.compositeContext;
        ctx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);

        for (const layer of this.state.layers) {
            if (!layer.visible) continue;

            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = layer.blendMode;
            ctx.drawImage(layer.canvas, 0, 0);
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const mainContext = this.canvasManager.getContext('main');
        mainContext.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        mainContext.drawImage(this.compositeCanvas, 0, 0);
    }

    processWorkerQueue() {
        if (this.workerQueue.length > 0 && !this.workerBusy) {
            const next = this.workerQueue.shift();
            this.compositeWithWorker(next.layerData);
        }
    }

    handleCompositeComplete(imageData) {
        const mainContext = this.canvasManager.getContext('main');
        mainContext.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
        mainContext.putImageData(imageData, 0, 0);
    }

    handleCompositeError(error) {
        console.error('Composite Worker error:', error);
        this.compositeWithoutWorker();
    }

    // 履歴管理
    saveHistoryState(type, data) {
        const historyState = {
            type,
            data,
            timestamp: Date.now()
        };

        this.state.undoStack.push(historyState);
        if (this.state.undoStack.length > this.state.maxHistorySteps) {
            this.state.undoStack.shift();
        }

        // Redoスタックのクリア
        this.state.redoStack = [];
    }

    async undo() {
        if (this.state.undoStack.length === 0) return false;

        const state = this.state.undoStack.pop();
        this.state.redoStack.push(state);

        await this.applyHistoryState(state, 'undo');
        this.notifyLayerChange('undo');
        return true;
    }

    async redo() {
        if (this.state.redoStack.length === 0) return false;

        const state = this.state.redoStack.pop();
        this.state.undoStack.push(state);

        await this.applyHistoryState(state, 'redo');
        this.notifyLayerChange('redo');
        return true;
    }

    async applyHistoryState(state, direction) {
        const { type, data } = state;

        switch (type) {
            case 'add-layer':
                if (direction === 'undo') {
                    await this.deleteLayer(data.layerId);
                } else {
                    const layer = await this.deserializeLayer(data.layerData);
                    this.state.layers.push(layer);
                    this.state.currentLayerId = layer.id;
                }
                break;

            case 'delete-layer':
                if (direction === 'undo') {
                    const layer = await this.deserializeLayer(data.layerData);
                    this.state.layers.splice(data.index, 0, layer);
                    this.state.currentLayerId = layer.id;
                } else {
                    await this.deleteLayer(data.layerId);
                }
                break;

            // その他の履歴状態の適用...
        }
    }

    // レイヤーのシリアライズ/デシリアライズ
    async serializeLayer(layer) {
        return {
            id: layer.id,
            name: layer.name,
            opacity: layer.opacity,
            visible: layer.visible,
            locked: layer.locked,
            blendMode: layer.blendMode,
            imageData: layer.context.getImageData(
                0, 0,
                layer.canvas.width,
                layer.canvas.height
            )
        };
    }

    async deserializeLayer(data) {
        const layer = await this.createLayer({
            name: data.name,
            opacity: data.opacity,
            visible: data.visible,
            locked: data.locked,
            blendMode: data.blendMode
        });

        layer.id = data.id;
        layer.context.putImageData(data.imageData, 0, 0);

        return layer;
    }

    // イベント通知
    notifyLayerChange(type, layerId = null) {
        this.app.config.container.dispatchEvent(new CustomEvent('tegaki-layer-changed', {
            detail: {
                type,
                layerId,
                layers: this.state.layers.map(l => ({
                    id: l.id,
                    name: l.name,
                    opacity: l.opacity,
                    visible: l.visible,
                    locked: l.locked,
                    blendMode: l.blendMode
                })),
                currentLayerId: this.state.currentLayerId
            }
        }));
    }

    // 状態管理
    getState() {
        return {
            layers: this.state.layers.map(l => ({
                id: l.id,
                name: l.name,
                opacity: l.opacity,
                visible: l.visible,
                locked: l.locked,
                blendMode: l.blendMode
            })),
            currentLayerId: this.state.currentLayerId
        };
    }

    setState(state) {
        if (!state) return;

        // レイヤーの再構築
        Promise.all(state.layers.map(async layerState => {
            const layer = await this.createLayer(layerState);
            return layer;
        })).then(layers => {
            this.state.layers = layers;
            this.state.currentLayerId = state.currentLayerId;
            this.notifyLayerChange('state');
        });
    }

    // リソース解放
    dispose() {
        // ワーカーの終了
        if (this.compositeWorker) {
            this.compositeWorker.terminate();
            this.compositeWorker = null;
        }

        // キャンバスの解放
        for (const layer of this.state.layers) {
            layer.canvas.width = 0;
            layer.canvas.height = 0;
            layer.context = null;
            layer.canvas = null;
        }

        if (this.compositeCanvas) {
            this.compositeCanvas.width = 0;
            this.compositeCanvas.height = 0;
            this.compositeContext = null;
            this.compositeCanvas = null;
        }

        // 状態のリセット
        this.state = null;
        this.canvasManager = null;
    }
}