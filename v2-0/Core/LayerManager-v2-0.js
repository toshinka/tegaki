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
