// AppManager-v2-0.js
class TegakiAppManager {
    constructor(config = {}) {
        this.version = '2.0.0';
        this.currentUser = config.currentUser || 'toshinka';
        this.currentTimestamp = config.currentTimestamp || '2025-06-17 16:41:21';
        
        // 基本設定
        this.config = {
            container: config.container || document.getElementById('tegaki-app'),
            width: config.width || 1920,
            height: config.height || 1080,
            debug: config.debug || false,
            ...config
        };

        // コアマネージャーの初期化
        this.managers = {
            canvas: null,    // キャンバス管理
            layer: null,     // レイヤー管理
            color: null,     // カラー管理
            tool: null       // ツール管理
        };

        // 拡張機能の初期化
        this.extensions = {
            brushEngine: null,    // ブラシエンジン
            effects: null,        // エフェクト
            imageProcessor: null, // 画像処理
            selectionTools: null  // 選択ツール
        };

        // ユーティリティの初期化
        this.utils = {
            debug: null,          // デバッグツール
            optimization: null,   // 最適化
            performance: null     // パフォーマンス監視
        };

        // アプリケーションの状態
        this.state = {
            isInitialized: false,
            isReady: false,
            isBusy: false,
            errors: [],
            warnings: [],
            history: []
        };

        // 設定の検証
        this.validateConfig();

        // 初期化の開始
        this.initialize();
    }

    validateConfig() {
        if (!this.config.container) {
            throw new Error('Container element is required');
        }

        if (this.config.width <= 0 || this.config.height <= 0) {
            throw new Error('Invalid canvas dimensions');
        }

        // コンテナの準備
        if (typeof this.config.container === 'string') {
            this.config.container = document.getElementById(this.config.container);
            if (!this.config.container) {
                throw new Error('Container element not found');
            }
        }
    }

    async initialize() {
        console.log(`Initializing Tegaki v${this.version} at ${this.currentTimestamp}`);

        try {
            // コアマネージャーの作成
            await this.initializeManagers();

            // 拡張機能の作成
            await this.initializeExtensions();

            // ユーティリティの作成
            await this.initializeUtils();

            // イベントリスナーの設定
            this.setupEventListeners();

            // 初期化完了
            this.state.isInitialized = true;
            this.state.isReady = true;

            console.log('Tegaki initialization completed successfully');
            
            // 初期化完了イベントの発火
            this.config.container.dispatchEvent(new CustomEvent('tegaki-ready', {
                detail: { 
                    version: this.version,
                    timestamp: this.currentTimestamp,
                    user: this.currentUser
                }
            }));

        } catch (error) {
            this.handleError('Initialization failed', error);
            throw error;
        }
    }

    async initializeManagers() {
        // キャンバスマネージャー
        this.managers.canvas = new TegakiCanvasManager(this);
        await this.managers.canvas.initialize();

        // レイヤーマネージャー
        this.managers.layer = new TegakiLayerManager(this);
        await this.managers.layer.initialize();

        // カラーマネージャー
        this.managers.color = new TegakiCoreColorManager(this);
        await this.managers.color.initialize();

        // ツールマネージャー
        this.managers.tool = new TegakiToolManager(this);
        await this.managers.tool.initialize();
    }

    async initializeExtensions() {
        // ブラシエンジン
        this.extensions.brushEngine = new TegakiBrushEngine(this);
        await this.extensions.brushEngine.initialize();

        // その他の拡張機能は必要に応じて初期化
        if (this.config.enableEffects) {
            this.extensions.effects = new TegakiEffects(this);
            await this.extensions.effects.initialize();
        }

        if (this.config.enableImageProcessor) {
            this.extensions.imageProcessor = new TegakiImageProcessor(this);
            await this.extensions.imageProcessor.initialize();
        }

        if (this.config.enableSelectionTools) {
            this.extensions.selectionTools = new TegakiSelectionTools(this);
            await this.extensions.selectionTools.initialize();
        }
    }

    async initializeUtils() {
        // デバッグツール
        if (this.config.debug) {
            this.utils.debug = new TegakiDebug(this);
            await this.utils.debug.initialize();
        }

        // 最適化
        this.utils.optimization = new TegakiOptimization(this);
        await this.utils.optimization.initialize();

        // パフォーマンス監視
        this.utils.performance = new TegakiPerformance(this);
        await this.utils.performance.initialize();
    }

    setupEventListeners() {
        // ウィンドウのリサイズイベント
        window.addEventListener('resize', this.handleResize.bind(this));

        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // アプリケーションのイベント
        this.config.container.addEventListener('tegaki-ready', this.handleReady.bind(this));
        this.config.container.addEventListener('tegaki-error', this.handleError.bind(this));

        // 終了時の処理
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    handleResize(event) {
        if (this.state.isBusy) return;
        this.state.isBusy = true;

        try {
            this.managers.canvas.handleResize();
            this.notifyStateChange('resize', { event });
        } catch (error) {
            this.handleError('Resize failed', error);
        } finally {
            this.state.isBusy = false;
        }
    }

    handleKeyDown(event) {
        if (this.state.isBusy) return;

        try {
            // ショートカットキーの処理
            this.managers.tool.handleKeyDown(event);
            this.notifyStateChange('keydown', { event });
        } catch (error) {
            this.handleError('Keyboard event failed', error);
        }
    }

    handleKeyUp(event) {
        try {
            // ショートカットキーの解除
            this.managers.tool.handleKeyUp(event);
            this.notifyStateChange('keyup', { event });
        } catch (error) {
            this.handleError('Keyboard event failed', error);
        }
    }

    handleReady(event) {
        console.log(`Tegaki v${event.detail.version} is ready`);
        this.notifyStateChange('ready', event.detail);
    }

    handleError(message, error) {
        const errorDetail = {
            message,
            error: error.toString(),
            timestamp: new Date().toISOString(),
            stack: error.stack
        };

        this.state.errors.push(errorDetail);
        console.error('Tegaki error:', errorDetail);

        this.config.container.dispatchEvent(new CustomEvent('tegaki-error', {
            detail: errorDetail
        }));
    }

    handleBeforeUnload(event) {
        // 未保存の変更がある場合
        if (this.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = '未保存の変更があります。本当に閉じますか？';
            return event.returnValue;
        }
    }

    hasUnsavedChanges() {
        return this.managers.layer?.hasUnsavedChanges() || false;
    }

    notifyStateChange(type, data = {}) {
        this.config.container.dispatchEvent(new CustomEvent('tegaki-state-change', {
            detail: {
                type,
                data,
                timestamp: new Date().toISOString()
            }
        }));
    }

    // ユーティリティメソッド
    getManager(name) {
        return this.managers[name] || null;
    }

    getExtension(name) {
        return this.extensions[name] || null;
    }

    getUtil(name) {
        return this.utils[name] || null;
    }

    // 状態管理
    getState() {
        return {
            version: this.version,
            timestamp: this.currentTimestamp,
            user: this.currentUser,
            isInitialized: this.state.isInitialized,
            isReady: this.state.isReady,
            isBusy: this.state.isBusy,
            canvas: this.managers.canvas?.getState(),
            layers: this.managers.layer?.getState(),
            color: this.managers.color?.getState(),
            tool: this.managers.tool?.getState()
        };
    }

    setState(state) {
        if (!state) return;

        // 各マネージャーの状態を復元
        if (state.canvas) {
            this.managers.canvas?.setState(state.canvas);
        }
        if (state.layers) {
            this.managers.layer?.setState(state.layers);
        }
        if (state.color) {
            this.managers.color?.setState(state.color);
        }
        if (state.tool) {
            this.managers.tool?.setState(state.tool);
        }

        this.notifyStateChange('state');
    }

    // リソース解放
    dispose() {
        // イベントリスナーの解除
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);

        // マネージャーの解放
        for (const manager of Object.values(this.managers)) {
            if (manager?.dispose) {
                manager.dispose();
            }
        }

        // 拡張機能の解放
        for (const extension of Object.values(this.extensions)) {
            if (extension?.dispose) {
                extension.dispose();
            }
        }

        // ユーティリティの解放
        for (const util of Object.values(this.utils)) {
            if (util?.dispose) {
                util.dispose();
            }
        }

        // 状態のリセット
        this.managers = null;
        this.extensions = null;
        this.utils = null;
        this.state = null;
        this.config = null;
    }
}