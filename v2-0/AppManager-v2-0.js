// AppManager-v2-0.js
class TegakiAppManager {
    constructor(config = {}) {
        this.version = '2.0.0';
        this.currentUser = 'toshinka';
        this.currentTimestamp = '2025-06-17 07:42:33';
        
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

        this.initialize();
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

            console.log('Tegaki initialization completed successfully');
            
            // 初期化完了イベントの発火
            this.config.container.dispatchEvent(new CustomEvent('tegaki-ready', {
                detail: { version: this.version }
            }));

        } catch (error) {
            console.error('Tegaki initialization failed:', error);
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
        this.managers.color = new TegakiColorManager(this);
        await this.managers.color.initialize();

        // ツールマネージャー
        this.managers.tool = new TegakiToolManager(this);
        await this.managers.tool.initialize();
    }

    async initializeExtensions() {
        // ブラシエンジン
        this.extensions.brushEngine = new TegakiBrushEngine(this);
        await this.extensions.brushEngine.initialize();

        // エフェクト
        this.extensions.effects = new TegakiEffects(this);
        await this.extensions.effects.initialize();

        // 画像処理
        this.extensions.imageProcessor = new TegakiImageProcessor(this);
        await this.extensions.imageProcessor.initialize();

        // 選択ツール
        this.extensions.selectionTools = new TegakiSelectionTools(this);
        await this.extensions.selectionTools.initialize();
    }

    async initializeUtils() {
        // デバッグツール
        if (this.config.debug) {
            this.utils.debug = new TegakiTestDebug(this);
            await this.utils.debug.initialize();
        }

        // 最適化
        this.utils.optimization = new TegakiOptimizationManager(this);
        await this.utils.optimization.initialize();

        // パフォーマンス監視
        this.utils.performance = new TegakiPerformanceMonitor(this);
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
    }

    handleResize() {
        // キャンバスのリサイズ処理
        this.managers.canvas.handleResize();
    }

    handleKeyDown(event) {
        // ショートカットキーの処理
        this.managers.tool.handleKeyDown(event);
    }

    handleKeyUp(event) {
        // ショートカットキーの解除
        this.managers.tool.handleKeyUp(event);
    }

    handleReady(event) {
        console.log(`Tegaki v${event.detail.version} is ready`);
    }

    handleError(event) {
        console.error('Tegaki error:', event.detail.error);
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
            canvas: this.managers.canvas.getState(),
            layers: this.managers.layer.getState(),
            color: this.managers.color.getState(),
            tool: this.managers.tool.getState()
        };
    }

    setState(state) {
        if (!state) return;

        // 各マネージャーの状態を復元
        this.managers.canvas.setState(state.canvas);
        this.managers.layer.setState(state.layers);
        this.managers.color.setState(state.color);
        this.managers.tool.setState(state.tool);
    }
}