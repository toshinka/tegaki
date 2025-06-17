// LayerManager-v2-0.js
class TegakiLayerManager {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 08:10:55';
        
        // レイヤー管理
        this.layers = [];
        this.activeLayer = null;
        this.layerCache = new Map();

        // レイヤーグループ
        this.groups = new Map();
        this.activeGroup = null;

        // レイヤー履歴
        this.history = {
            actions: [],
            maxSize: 50,
            currentIndex: -1
        };

        // レイヤーの設定
        this.settings = {
            defaultWidth: app.config.width || 1920,
            defaultHeight: app.config.height || 1080,
            maxLayers: 100,
            thumbnailSize: 150,
            cacheSize: 200 * 1024 * 1024  // 200MB
        };

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Layer Manager at ${this.currentTimestamp}`);

        try {
            // 基本レイヤーの初期化
            await this.initializeBasicLayers();

            // キャッシュの設定
            this.setupLayerCache();

            // レイヤー最適化の設定
            this.setupOptimization();

            console.log('Layer Manager initialization completed');

        } catch (error) {
            console.error('Layer Manager initialization failed:', error);
            throw error;
        }
    }

    async initializeBasicLayers() {
        // 背景レイヤー
        const backgroundLayer = await this.createLayer({
            name: 'Background',
            type: 'background',
            visible: true,
            locked: false
        });

        // メインレイヤー
        const mainLayer = await this.createLayer({
            name: 'Layer 1',
            type: 'normal',
            visible: true,
            locked: false
        });

        this.layers.push(backgroundLayer, mainLayer);
        await this.setActiveLayer(mainLayer.id);
    }

    async createLayer(options = {}) {
        if (this.layers.length >= this.settings.maxLayers) {
            throw new Error('Maximum layer limit reached');
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.settings.defaultWidth;
        canvas.height = this.settings.defaultHeight;

        const layer = {
            id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            canvas: canvas,
            context: canvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: true
            }),
            name: options.name || `Layer ${this.layers.length + 1}`,
            type: options.type || 'normal',
            visible: options.visible !== undefined ? options.visible : true,
            locked: options.locked !== undefined ? options.locked : false,
            opacity: options.opacity || 1,
            blendMode: options.blendMode || 'normal',
            mask: null,
            clip: null,
            effects: [],
            metadata: {
                created: this.currentTimestamp,
                modified: this.currentTimestamp,
                author: this.currentUser
            }
        };

        // レイヤーの最適化
        await this.optimizeLayer(layer);

        // サムネイルの生成
        await this.generateThumbnail(layer);

        return layer;
    }

    async optimizeLayer(layer) {
        // オフスクリーンキャンバスの使用
        if ('transferControlToOffscreen' in layer.canvas) {
            try {
                layer.offscreen = layer.canvas.transferControlToOffscreen();
                layer.worker = new Worker('../Workers/layer-worker-v2-0.js');
                layer.worker.postMessage({ 
                    type: 'init', 
                    canvas: layer.offscreen,
                    settings: {
                        width: this.settings.defaultWidth,
                        height: this.settings.defaultHeight
                    }
                }, [layer.offscreen]);
            } catch (error) {
                console.warn('Failed to create offscreen canvas:', error);
            }
        }

        // レイヤーキャッシュの設定
        this.setupLayerCaching(layer);
    }
    async setupLayerCaching(layer) {
        // キャッシュの初期設定
        layer.cache = {
            lastModified: this.currentTimestamp,
            dirtyRegions: new Set(),
            thumbnail: null,
            preview: null
        };

        // サムネイルの生成
        await this.generateThumbnail(layer);

        // プレビューキャッシュの生成
        await this.generatePreviewCache(layer);
    }

    async generateThumbnail(layer) {
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = this.settings.thumbnailSize;
        thumbnailCanvas.height = this.settings.thumbnailSize * 
                                (layer.canvas.height / layer.canvas.width);

        const ctx = thumbnailCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            layer.canvas,
            0, 0,
            thumbnailCanvas.width,
            thumbnailCanvas.height
        );

        layer.cache.thumbnail = thumbnailCanvas;
    }

    async generatePreviewCache(layer) {
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = layer.canvas.width / 2;
        previewCanvas.height = layer.canvas.height / 2;

        const ctx = previewCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(
            layer.canvas,
            0, 0,
            previewCanvas.width,
            previewCanvas.height
        );

        layer.cache.preview = previewCanvas;
    }

    setupLayerCache() {
        // キャッシュクリーンアップの定期実行
        setInterval(() => {
            this.cleanupLayerCache();
        }, 30000); // 30秒ごと
    }

    setupOptimization() {
        // レイヤー合成の最適化設定
        this.compositingStrategy = {
            method: this.selectCompositingMethod(),
            quality: this.determineCompositingQuality(),
            batchSize: this.calculateBatchSize()
        };
    }

    selectCompositingMethod() {
        if (this.isWebGL2Supported()) {
            return 'webgl2';
        } else if (this.isWebGLSupported()) {
            return 'webgl';
        }
        return 'canvas2d';
    }

    isWebGL2Supported() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    isWebGLSupported() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || 
                     canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    determineCompositingQuality() {
        // デバイスの性能に基づいて品質を決定
        if (navigator.hardwareConcurrency >= 8) {
            return 'high';
        } else if (navigator.hardwareConcurrency >= 4) {
            return 'medium';
        }
        return 'low';
    }

    calculateBatchSize() {
        // デバイスのメモリに基づいてバッチサイズを計算
        const memory = navigator.deviceMemory || 4;
        return Math.max(2, Math.min(10, Math.floor(memory / 2)));
    }

    async setActiveLayer(layerId) {
        const layer = this.findLayer(layerId);
        if (!layer) return false;

        this.activeLayer = layer;
        this.notifyLayerChange('active');
        return true;
    }

    findLayer(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }

    async updateLayer(layerId, updateFunction) {
        const layer = this.findLayer(layerId);
        if (!layer || layer.locked) return false;

        try {
            // 更新前の状態を保存
            await this.saveLayerState(layer);

            // レイヤーの更新
            await updateFunction(layer);

            // キャッシュの更新
            await this.updateLayerCache(layer);

            // 履歴の記録
            this.recordHistory({
                type: 'layer_update',
                layerId: layer.id,
                timestamp: this.currentTimestamp
            });

            return true;

        } catch (error) {
            console.error('Layer update failed:', error);
            await this.restoreLayerState(layer);
            return false;
        }
    }

    async saveLayerState(layer) {
        const state = {
            canvas: await this.cloneCanvas(layer.canvas),
            properties: {
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode
            }
        };

        this.layerCache.set(`${layer.id}_backup`, state);
    }

    async cloneCanvas(canvas) {
        const cloned = document.createElement('canvas');
        cloned.width = canvas.width;
        cloned.height = canvas.height;

        const ctx = cloned.getContext('2d');
        ctx.drawImage(canvas, 0, 0);

        return cloned;
    }

    async restoreLayerState(layer) {
        const state = this.layerCache.get(`${layer.id}_backup`);
        if (!state) return;

        const ctx = layer.context;
        ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        ctx.drawImage(state.canvas, 0, 0);

        Object.assign(layer, state.properties);
    }

    async updateLayerCache(layer) {
        layer.cache.lastModified = this.currentTimestamp;

        // サムネイルとプレビューの更新
        await this.generateThumbnail(layer);
        await this.generatePreviewCache(layer);

        // キャッシュサイズの確認
        this.checkCacheSize();
    }

    checkCacheSize() {
        let totalSize = 0;
        for (const layer of this.layers) {
            if (layer.cache.thumbnail) {
                totalSize += this.estimateCanvasSize(layer.cache.thumbnail);
            }
            if (layer.cache.preview) {
                totalSize += this.estimateCanvasSize(layer.cache.preview);
            }
        }

        if (totalSize > this.settings.cacheSize) {
            this.cleanupLayerCache();
        }
    }

    estimateCanvasSize(canvas) {
        // キャンバスのメモリサイズを推定（バイト単位）
        return canvas.width * canvas.height * 4;
    }

    cleanupLayerCache() {
        *

