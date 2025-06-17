// BrushEngine-v2-0.js
class TegakiBrushEngine {
    constructor(app) {
        this.app = app;
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 08:54:18';
        
        // ブラシエンジンの状態
        this.state = {
            isInitialized: false,
            isProcessing: false,
            currentBrush: null,
            brushCache: new Map(),
            strokeBuffer: null,
            lastPoint: null,
            points: []
        };

        // ブラシの設定
        this.settings = {
            defaultSize: 5,
            defaultOpacity: 1.0,
            defaultFlow: 1.0,
            defaultHardness: 0.8,
            defaultSpacing: 0.1,
            maxSize: 1000,
            minSize: 1,
            cacheTTL: 300000, // 5分
            maxCacheSize: 100 * 1024 * 1024  // 100MB
        };

        // オフスクリーンキャンバス
        this.offscreen = {
            brush: null,
            stroke: null,
            temp: null
        };

        // WebGLコンテキスト
        this.gl = null;
        this.glPrograms = new Map();

        // ワーカー
        this.workers = new Map();

        this.initialize();
    }

    async initialize() {
        console.log(`Initializing Brush Engine at ${this.currentTimestamp}`);

        try {
            // オフスクリーンキャンバスの初期化
            await this.initializeOffscreenCanvases();

            // WebGLの初期化
            await this.initializeWebGL();

            // ブラシワーカーの初期化
            await this.initializeWorkers();

            // 基本ブラシの生成
            await this.generateBasicBrushes();

            this.state.isInitialized = true;
            console.log('Brush Engine initialization completed');

        } catch (error) {
            console.error('Brush Engine initialization failed:', error);
            throw error;
        }
    }

    async initializeOffscreenCanvases() {
        // ブラシテクスチャ用キャンバス
        this.offscreen.brush = document.createElement('canvas');
        this.offscreen.brush.width = 512;
        this.offscreen.brush.height = 512;

        // ストローク用キャンバス
        this.offscreen.stroke = document.createElement('canvas');
        this.offscreen.stroke.width = this.app.config.width;
        this.offscreen.stroke.height = this.app.config.height;

        // 一時描画用キャンバス
        this.offscreen.temp = document.createElement('canvas');
        this.offscreen.temp.width = this.app.config.width;
        this.offscreen.temp.height = this.app.config.height;

        // コンテキストの設定
        for (const canvas of Object.values(this.offscreen)) {
            const ctx = canvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: true
            });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }
    }

    async initializeWebGL() {
        try {
            this.gl = this.offscreen.brush.getContext('webgl2');
            if (!this.gl) {
                throw new Error('WebGL2 not supported');
            }

            // シェーダープログラムの初期化
            await this.initializeShaders();

            console.log('WebGL initialization completed');
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            // フォールバック: 2Dキャンバスを使用
            this.gl = null;
        }
    }