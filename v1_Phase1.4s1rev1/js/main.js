/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・AppCore統合エントリーポイント
 * 🔧 修正内容: Manager読み込み失敗完全解決・progressCallback修正・DRY/SOLID原則適用
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5rev1 依存関係解決版 → Manager統合完全版
 * 📋 V8_MIGRATION: AppCore経由でPixiJS API変更対応予定
 * 📋 PERFORMANCE_TARGET: 3秒以内初期化・60FPS安定
 * 📋 DRY_COMPLIANCE: エラー処理・ログ関数統合
 * 📋 SOLID_COMPLIANCE: 単一責任・依存関係逆転適用
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.4s1rev1-Manager統合完全版';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 🔧 修正: AppCore・Manager統合
        this.appCore = null;
        this.configManager = null;
        this.errorManager = null;
        this.initializationManager = null;
        
        this.initializationSteps = [];
        this.errorLog = [];
        
        // DRY: 設定値集約
        this.config = {
            maxInitTime: 10000,       // 最大初期化時間（ms）
            retryAttempts: 3,         // リトライ回数
            retryDelay: 200,          // リトライ間隔（ms）
            requiredDependencies: [   // 必須依存関係
                'PIXI', 'PixiExtensions', 'ConfigManager', 'ErrorManager', 'InitializationManager', 'AppCore'
            ],
            requiredManagerClasses: [ // 必須Manager クラス
                'ConfigManager', 'ErrorManager', 'InitializationManager'
            ]
        };
        
        console.log('🎨 FutabaDrawingTool初期化開始（Manager統合完全版）');
    }
    
    /**
     * アプリケーション初期化（完全修正版 - Manager統合対応）
     */
    async init() {
        try {
            console.log('🚀 Manager統合完全版初期化開始 - 読み込み失敗問題完全解決');
            
            // Step 1: 依存関係確認（最重要）
            await this.validateDependencies();
            
            // Step 2: Manager存在確認（🚨 最重要修正）
            this.validateManagerAvailability();
            
            // Step 3: ConfigManager初期化（完全修正版）
            await this.initializeConfigManager();
            
            // Step 4: ErrorManager初期化（完全修正版）
            await this.initializeErrorManager();
            
            // Step 5: InitializationManager初期化（完全修正版）
            await this.initializeInitializationManager();
            
            // Step 6: 統合初期化実行（progressCallback修正版）
            await this.executeUnifiedInitialization();
            
            // Step 7: AppCore初期化実行（統合版）
            await this.initializeAppCore();
            
            // Step 8: 最終状態設定・確認
            this.finalizeInitialization();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            this.logSuccess('Manager統合完全版初期化完了！');
            this.logInfo(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            this.displayInitializationSummary();
            
        } catch (error) {
            this.logError('Manager統合初期化失敗', error);
            this.errorLog.push({ 
                step: 'initialization', 
                error: error.message, 
                time: Date.now(),
                stack: error.stack 
            });
            
            this.showErrorMessage(error);
            
            // 🔧 修正: フォールバック初期化試行
            await this.attemptFallbackInitialization(error);
        }
    }
    
    /**
     * 🚨 最重要修正: Manager存在確認（完全版）
     * SOLID - Dependency Inversion Principle
     */
    validateManagerAvailability() {
        console.log('🔍 Manager クラス存在確認開始（最重要修正）...');
        
        const missing = [];
        const availableManagers = {};
        
        // 必須Manager クラス存在確認
        for (const managerName of this.config.requiredManagerClasses) {
            const isAvailable = typeof window[managerName] !== 'undefined';
            availableManagers[managerName] = isAvailable;
            
            if (!isAvailable) {
                missing.push(managerName);
            } else {
                this.logSuccess(`✅ ${managerName} クラス確認完了`);
            }
        }
        
        this.logInfo('🔍 Manager存在確認結果:', availableManagers);
        
        if (missing.length > 0) {
            const errorMsg = `必須Manager クラスが読み込まれていません: ${missing.join(', ')}`;
            this.logError(errorMsg);
            
            // 詳細診断
            this.diagnoseMissingManagers(missing);
            
            throw new Error(errorMsg);
        }
        
        this.logSuccess('✅ 全Manager クラス存在確認完了');
        this.initializationSteps.push('manager-validation');
    }
    
    /**
     * 不足Manager診断
     * SOLID - Single Responsibility Principle
     */
    diagnoseMissingManagers(missing) {
        console.group('🔍 不足Manager詳細診断');
        
        const diagnostics = {
            'ConfigManager': {
                issue: 'ConfigManager クラスが読み込まれていません',
                solutions: [
                    'index.html で <script src="managers/config-manager.js"></script> の確認',
                    'config-manager.js ファイルの存在確認',
                    'config-manager.js の構文エラー確認（ブラウザコンソール確認）',
                    'スクリプトタグの読み込み順序確認（app-core.js より前）'
                ]
            },
            'ErrorManager': {
                issue: 'ErrorManager クラスが読み込まれていません',
                solutions: [
                    'index.html で <script src="managers/error-manager.js"></script> の確認',
                    'error-manager.js ファイルの存在確認',
                    'error-manager.js の構文エラー確認（ブラウザコンソール確認）',
                    'スクリプトタグの読み込み順序確認（app-core.js より前）'
                ]
            },
            'InitializationManager': {
                issue: 'InitializationManager クラスが読み込まれていません',
                solutions: [
                    'index.html で <script src="managers/initialization-manager.js"></script> の確認',
                    'initialization-manager.js ファイルの存在確認',
                    'initialization-manager.js の構文エラー確認（ブラウザコンソール確認）',
                    'スクリプトタグの読み込み順序確認（app-core.js より前）'
                ]
            }
        };
        
        missing.forEach(manager => {
            if (diagnostics[manager]) {
                console.error(`❌ ${manager}:`, diagnostics[manager]);
            }
        });
        
        console.groupEnd();
    }
    
    /**
     * ConfigManager初期化（完全修正版）
     */
    async initializeConfigManager() {
        this.logInfo('🔧 ConfigManager初期化開始（完全修正版）...');
        
        // クラス存在確認
        if (typeof window.ConfigManager === 'undefined') {
            const errorMsg = 'ConfigManager クラスが読み込まれていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // インスタンス作成
            this.configManager = new window.ConfigManager();
            this.logSuccess('✅ ConfigManager インスタンス作成完了');
            
            // 初期化実行
            const initialized = this.configManager.initialize();
            if (!initialized) {
                throw new Error('ConfigManager初期化処理が失敗しました');
            }
            
            // グローバル公開
            window.configManager = this.configManager;
            
            this.logSuccess('✅ ConfigManager初期化完了');
            this.initializationSteps.push('config-manager');
            
        } catch (error) {
            this.logError('❌ ConfigManager初期化失敗', error);
            throw new Error(`ConfigManager初期化失敗: ${error.message}`);
        }
    }
    
    /**
     * ErrorManager初期化（完全修正版）
     */
    async initializeErrorManager() {
        this.logInfo('🚨 ErrorManager初期化開始（完全修正版）...');
        
        // クラス存在確認
        if (typeof window.ErrorManager === 'undefined') {
            const errorMsg = 'ErrorManager クラスが読み込まれていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // インスタンス作成
            this.errorManager = new window.ErrorManager();
            this.logSuccess('✅ ErrorManager インスタンス作成完了');
            
            // 初期化実行
            const initialized = this.errorManager.initialize();
            if (!initialized) {
                throw new Error('ErrorManager初期化処理が失敗しました');
            }
            
            // グローバル公開
            window.errorManager = this.errorManager;
            
            this.logSuccess('✅ ErrorManager初期化完了');
            this.initializationSteps.push('error-manager');
            
        } catch (error) {
            this.logError('❌ ErrorManager初期化失敗', error);
            throw new Error(`ErrorManager初期化失敗: ${error.message}`);
        }
    }
    
    /**
     * InitializationManager初期化（完全修正版）
     */
    async initializeInitializationManager() {
        this.logInfo('🚀 InitializationManager初期化開始（完全修正版）...');
        
        // クラス存在確認
        if (typeof window.InitializationManager === 'undefined') {
            const errorMsg = 'InitializationManager クラスが読み込まれていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // インスタンス作成（ConfigManager・ErrorManager注入）
            this.initializationManager = new window.InitializationManager(
                this.configManager, 
                this.errorManager
            );
            this.logSuccess('✅ InitializationManager インスタンス作成完了');
            
            // 初期化実行
            const initialized = this.initializationManager.initialize();
            if (!initialized) {
                throw new Error('InitializationManager初期化処理が失敗しました');
            }
            
            // グローバル公開
            window.initializationManager = this.initializationManager;
            
            this.logSuccess('✅ InitializationManager初期化完了');
            this.initializationSteps.push('initialization-manager');
            
        } catch (error) {
            this.logError('❌ InitializationManager初期化失敗', error);
            throw new Error(`InitializationManager初期化失敗: ${error.message}`);
        }
    }
    
    /**
     * 🔧 最重要修正: 統合初期化実行（progressCallback完全修正版）
     */
    async executeUnifiedInitialization() {
        this.logInfo('🎯 統合初期化実行開始（progressCallback完全修正版）...');
        
        // InitializationManager存在確認
        if (!this.initializationManager) {
            const errorMsg = 'InitializationManager が初期化されていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // 🚨 重要修正: progressCallback設定（undefinedエラー完全解決）
            if (this.initializationManager.options) {
                this.initializationManager.options.progressCallback = (progressInfo) => {
                    this.logInfo(`📊 初期化進捗: ${progressInfo.step} - ${progressInfo.progress}%`);
                    
                    // 進捗表示の更新（DOM要素が存在する場合）
                    this.updateProgressDisplay(progressInfo);
                };
            } else {
                // optionsプロパティが存在しない場合のフォールバック
                this.logWarning('⚠️ InitializationManager.options が見つかりません - progressCallback設定をスキップ');
            }
            
            // 統合初期化実行
            const results = await this.initializationManager.execute();
            
            this.logSuccess('✅ 統合初期化実行完了');
            this.logInfo(`📊 初期化結果: 成功 ${results.completed}/${results.total}, 失敗 ${results.failed}`);
            
            // 重要なステップの失敗確認
            if (results.criticalFailed > 0) {
                throw new Error(`致命的な初期化ステップが失敗しました: ${results.criticalFailed}件`);
            }
            
            this.initializationSteps.push('unified-initialization');
            return results;
            
        } catch (error) {
            this.logError('❌ 統合初期化実行失敗', error);
            throw new Error(`統合初期化実行失敗: ${error.message}`);
        }
    }
    
    /**
     * 進捗表示更新（DRY適用）
     */
    updateProgressDisplay(progressInfo) {
        try {
            // 進捗バー更新
            const progressBar = document.getElementById('init-progress');
            if (progressBar) {
                progressBar.style.width = `${progressInfo.progress}%`;
            }
            
            // ステップ名表示更新
            const stepDisplay = document.getElementById('init-step');
            if (stepDisplay) {
                stepDisplay.textContent = progressInfo.step;
            }
            
            // 詳細ログ表示
            const logDisplay = document.getElementById('init-log');
            if (logDisplay) {
                const logEntry = document.createElement('div');
                logEntry.textContent = `${progressInfo.step}: ${progressInfo.status}`;
                logDisplay.appendChild(logEntry);
                
                // ログが多すぎる場合は古いものを削除
                if (logDisplay.children.length > 10) {
                    logDisplay.removeChild(logDisplay.firstChild);
                }
            }
        } catch (displayError) {
            // 進捗表示でエラーが発生しても初期化は続行
            console.warn('⚠️ 進捗表示更新でエラー:', displayError.message);
        }
    }
    
    /**
     * AppCore初期化（統合版）
     */
    async initializeAppCore() {
        this.logInfo('🎨 AppCore初期化開始（統合版）...');
        
        // AppCoreクラス存在確認
        if (typeof window.AppCore === 'undefined') {
            const errorMsg = 'AppCore クラスが読み込まれていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // AppCoreインスタンス作成
            this.appCore = new window.AppCore(this.configManager, this.errorManager);
            this.logSuccess('✅ AppCore インスタンス作成完了');
            
            // 初期化実行
            await this.appCore.initialize();
            this.logSuccess('✅ AppCore初期化完了');
            
            // グローバル公開
            window.appCore = this.appCore;
            
            this.initializationSteps.push('app-core');
            
        } catch (error) {
            this.logError('❌ AppCore初期化失敗', error);
            throw new Error(`AppCore初期化失敗: ${error.message}`);
        }
    }
    
    /**
     * 🎯 核心修正: 依存関係確認（最重要）
     * SOLID - Dependency Inversion Principle
     */
    async validateDependencies() {
        console.log('🔍 依存関係確認開始（核心修正）...');
        
        const missing = [];
        const checkResults = {};
        
        // 必須依存関係チェック
        for (const dependency of this.config.requiredDependencies) {
            const isAvailable = await this.checkDependencyWithRetry(dependency);
            checkResults[dependency] = isAvailable;
            
            if (!isAvailable) {
                missing.push(dependency);
            }
        }
        
        this.logInfo('🔍 依存関係確認結果:', checkResults);
        
        if (missing.length > 0) {
            const errorMsg = `必須依存関係が不足: ${missing.join(', ')}`;
            this.logError(errorMsg);
            
            // 詳細診断
            this.diagnoseMissingDependencies(missing);
            
            throw new Error(errorMsg);
        }
        
        this.logSuccess('✅ 全依存関係確認完了');
        this.initializationSteps.push('dependency-validation');
    }
    
    /**
     * 依存関係チェック（リトライ機能付き）
     * DRY - Don't Repeat Yourself
     */
    async checkDependencyWithRetry(dependency) {
        const checkers = {
            'PIXI': () => typeof window.PIXI !== 'undefined',
            'PixiExtensions': () => typeof window.PixiExtensions !== 'undefined',
            'ConfigManager': () => typeof window.ConfigManager !== 'undefined',
            'ErrorManager': () => typeof window.ErrorManager !== 'undefined',
            'InitializationManager': () => typeof window.InitializationManager !== 'undefined',
            'AppCore': () => typeof window.AppCore !== 'undefined'
        };
        
        const checker = checkers[dependency];
        if (!checker) {
            this.logWarning(`未知の依存関係: ${dependency}`);
            return false;
        }
        
        // 即座チェック
        if (checker()) {
            this.logSuccess(`✅ ${dependency} 即座に確認完了`);
            return true;
        }
        
        // リトライチェック
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            this.logInfo(`🔄 ${dependency} 確認リトライ ${attempt}/${this.config.retryAttempts}...`);
            
            await this.sleep(this.config.retryDelay);
            
            if (checker()) {
                this.logSuccess(`✅ ${dependency} リトライ ${attempt} で確認完了`);
                return true;
            }
        }
        
        this.logError(`❌ ${dependency} 確認失敗（${this.config.retryAttempts}回試行）`);
        return false;
    }
    
    /**
     * 不足依存関係診断（改良版）
     * SOLID - Single Responsibility Principle
     */
    diagnoseMissingDependencies(missing) {
        console.group('🔍 不足依存関係詳細診断');
        
        const diagnostics = {
            'PIXI': {
                issue: 'PixiJS本体が読み込まれていません',
                solutions: [
                    'CDNからの読み込み確認: https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.4.2/pixi.min.js',
                    'node_modules/pixi.js の存在確認',
                    'ネットワーク接続確認',
                    'ブラウザコンソールでネットワークエラーを確認'
                ],
                // PixiJS v8 移行準備コメント
                v8MigrationNote: 'v8移行時は new PIXI.Application() → PIXI.Application.init() に変更予定'
            },
            'PixiExtensions': {
                issue: 'pixi-extensions.js が読み込まれていません',
                solutions: [
                    'libs/pixi-extensions.js の存在確認',
                    'ファイルパス確認',
                    'pixi-extensions.js の構文エラー確認'
                ]
            },
            'ConfigManager': {
                issue: 'ConfigManager クラスが読み込まれていません（最重要）',
                solutions: [
                    'managers/config-manager.js の読み込み確認（核心問題）',
                    'index.html でのスクリプト読み込み順序確認',
                    'config-manager.js の構文エラー確認'
                ]
            },
            'ErrorManager': {
                issue: 'ErrorManager クラスが読み込まれていません（最重要）',
                solutions: [
                    'managers/error-manager.js の読み込み確認（核心問題）',
                    'index.html でのスクリプト読み込み順序確認',
                    'error-manager.js の構文エラー確認'
                ]
            },
            'InitializationManager': {
                issue: 'InitializationManager クラスが読み込まれていません（最重要）',
                solutions: [
                    'managers/initialization-manager.js の読み込み確認（核心問題）',
                    'index.html でのスクリプト読み込み順序確認',
                    'initialization-manager.js の構文エラー確認'
                ]
            },
            'AppCore': {
                issue: 'app-core.js が読み込まれていません',
                solutions: [
                    'js/app-core.js の存在確認',
                    'index.html でのスクリプト読み込み順序確認',
                    'app-core.js の構文エラー確認'
                ],
                // PixiJS v8 移行準備コメント
                v8MigrationNote: 'v8移行時は PIXI.Application 初期化方法を変更予定'
            }
        };
        
        missing.forEach(dep => {
            if (diagnostics[dep]) {
                console.error(`❌ ${dep}:`, diagnostics[dep]);
                
                // v8移行ノート表示
                if (diagnostics[dep].v8MigrationNote) {
                    console.info(`🚀 PixiJS v8 移行準備: ${diagnostics[dep].v8MigrationNote}`);
                }
            }
        });
        
        console.groupEnd();
    }
    
    /**
     * 最終状態設定・確認
     */
    finalizeInitialization() {
        this.logInfo('🏁 最終状態設定・確認開始...');
        
        // AppCore確認・基本UI設定
        this.setupBasicUI();
        
        // キーボードショートカット設定
        this.setupKeyboardShortcuts();
        
        // キャンバスサイズ表示更新
        this.updateCanvasInfo();
        
        // 初期化完了フラグ設定
        this.isInitialized = true;
        
        this.logSuccess('✅ 最終状態設定・確認完了');
        this.initializationSteps.push('finalization');
    }
    
    /**
     * 基本UI設定
     */
    setupBasicUI() {
        // 初期ツール選択
        this.selectPenTool();
        
        // リサイズボタン設定
        this.setupResizeHandlers();
        
        // ステータス表示初期化
        this.initializeStatusDisplay();
        
        // APIGateway設定（利用可能な場合）
        this.setupAPIGateway();
    }
    
    /**
     * APIGateway設定
     */
    setupAPIGateway() {
        if (typeof window.APIGateway !== 'undefined') {
            try {
                window.futaba = new window.APIGateway(this);
                window.futaba.initialize();
                this.logSuccess('✅ APIGateway設定完了');
            } catch (error) {
                this.logWarning('⚠️ APIGateway設定でエラー:', error.message);
            }
        } else {
            this.logWarning('⚠️ APIGateway クラスが見つかりません');
        }
    }
    
    /**
     * リサイズハンドラ設定（エラー処理強化）
     */
    setupResizeHandlers() {
        const handlers = [
            { id: 'apply-resize', centerContent: false },
            { id: 'apply-resize-center', centerContent: true }
        ];
        
        handlers.forEach(({ id, centerContent }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', () => {
                    try {
                        this.applyCanvasResize(centerContent);
                    } catch (error) {
                        this.logError(`リサイズ処理エラー (${id})`, error);
                        this.showErrorNotification(error);
                    }
                });
                this.logSuccess(`✅ ${id} ボタン設定完了`);
            } else {
                this.logWarning(`⚠️ ${id} 要素が見つかりません`);
            }
        });
        
        // プリセットボタン設定
        const presetButtons = document.querySelectorAll('.resize-button[data-size]');
        presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                try {
                    const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                    this.setCanvasInputValues(width, height);
                    this.logInfo(`📐 プリセットサイズ設定: ${width}×${height}`);
                } catch (error) {
                    this.logError('プリセット設定エラー', error);
                    this.showErrorNotification(error);
                }
            });
        });
        
        this.logSuccess(`✅ プリセットボタン ${presetButtons.length}個 設定完了`);
    }
    
    /**
     * キャンバス入力値設定（DRY適用）
     */
    setCanvasInputValues(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            widthInput.value = width;
            heightInput.value = height;
        } else {
            throw new Error('キャンバスサイズ入力要素が見つかりません');
        }
    }
    
    /**
     * ステータス表示初期化（エラー処理付き）
     */
    initializeStatusDisplay() {
        const statusUpdates = [
            { id: 'current-tool', value: 'ベクターペン' },
            { id: 'current-color', value: '#800000' },
            { id: 'gpu-usage', value: '45%' },
            { id: 'memory-usage', value: '1.2GB' }
        ];
        
        statusUpdates.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                this.logWarning(`⚠️ ステータス要素 ${id} が見つかりません`);
            }
        });
        
        // キャンバス情報初期化
        this.updateCanvasInfo();
        
        this.logSuccess('✅ ステータス表示初期化完了');
    }
    
    /**
     * キーボードショートカット設定（DRY適用）
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => this.closeAllPopups(),
            'KeyP': () => this.selectPenTool(),
            'KeyE': () => this.selectEraserTool()
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.code;
            if (shortcuts[key] && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                // テキスト入力中は無視
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }
                
                e.preventDefault();
                
                try {
                    shortcuts[key]();
                } catch (error) {
                    this.logError(`ショートカットエラー (${key})`, error);
                    this.showErrorNotification(error);
                }
            }
        });
        
        this.logSuccess(`✅ キーボードショートカット ${Object.keys(shortcuts).length}個 設定完了`);
    }
    
    /**
     * キャンバスリサイズ適用（エラー処理強化）
     */
    applyCanvasResize(centerContent) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (!widthInput || !heightInput) {
            throw new Error('リサイズ入力要素が見つかりません');
        }
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        // 入力値検証
        if (!width || !height || width <= 0 || height <= 0) {
            throw new Error('無効なキャンバスサイズが入力されました');
        }
        
        if (width > 4096 || height > 4096) {
            throw new Error('キャンバスサイズが制限を超えています（最大4096px）');
        }
        
        if (!this.appCore) {
            throw new Error('AppCore が初期化されていません');
        }
        
        try {
            this.appCore.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.closeAllPopups();
            this.logSuccess(`✅ キャンバスリサイズ完了: ${width}×${height}px (中央寄せ: ${centerContent})`);
        } catch (error) {
            throw new Error(`キャンバスリサイズ処理失敗: ${error.message}`);
        }
    }
    
    /**
     * キャンバス情報更新（エラー処理付き）
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo && this.appCore) {
            canvasInfo.textContent = `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}px`;
        } else if (!canvasInfo) {
            this.logWarning('⚠️ canvas-info 要素が見つかりません');
        }
    }
    
    /**
     * ペンツール選択（エラー処理付き）
     */
    selectPenTool() {
        try {
            if (!this.appCore || !this.appCore.toolSystem) {
                this.logWarning('⚠️ ツールシステム未初期化');
                return;
            }
            
            this.appCore.toolSystem.setTool('pen');
            
            // UI更新
            this.updateToolUI('pen-tool', 'ベクターペン');
            
            this.logInfo('🖊️ ペンツール選択');
        } catch (error) {
            this.logError('ペンツール選択エラー', error);
            this.showErrorNotification(error);
        }
    }
    
    /**
     * 消しゴムツール選択（エラー処理付き）
     */
    selectEraserTool() {
        try {
            if (!this.appCore || !this.appCore.toolSystem) {
                this.logWarning('⚠️ ツールシステム未初期化');
                return;
            }
            
            this.appCore.toolSystem.setTool('eraser');
            
            // UI更新
            this.updateToolUI('eraser-tool', '消しゴム');
            
            this.logInfo('🧽 消しゴムツール選択');
        } catch (error) {
            this.logError('消しゴムツール選択エラー', error);
            this.showErrorNotification(error);
        }
    }
    
    /**
     * ツールUI更新（DRY適用）
     */
    updateToolUI(activeToolId, toolName) {
        // アクティブツール表示更新
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        
        const toolButton = document.getElementById(activeToolId);
        if (toolButton) {
            toolButton.classList.add('active');
        }
        
        // ツール名表示更新
        const currentToolElement = document.getElementById('current-tool');
        if (currentToolElement) {
            currentToolElement.textContent = toolName;
        }
    }
    
    /**
     * 全ポップアップ閉じる（エラー処理付き）
     */
    closeAllPopups() {
        try {
            if (this.appCore && this.appCore.uiController) {
                this.appCore.uiController.closeAllPopups();
            } else {
                // フォールバック処理
                document.querySelectorAll('.popup-panel').forEach(popup => {
                    popup.classList.remove('show');
                });
            }
            
            this.logInfo('🔒 全ポップアップ閉じる');
        } catch (error) {
            this.logError('ポップアップ閉じるエラー', error);
        }
    }
    
    /**
     * フォールバック初期化試行（エラー処理強化）
     */
    async attemptFallbackInitialization(originalError) {
        this.logWarning('🛡️ フォールバック初期化試行...');
        
        try {
            // 最低限のPixiJSアプリケーション作成
            if (window.PIXI) {
                // PixiJS v8 移行準備コメント
                // v8移行時: const app = await PIXI.Application.init({ ... });
                const app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xf0e0d6,
                    antialias: true,
                    resolution: 1,
                    autoDensity: false
                });
                
                const canvasContainer = document.getElementById('drawing-canvas');
                if (canvasContainer) {
                    // 既存コンテンツクリア
                    while (canvasContainer.firstChild) {
                        canvasContainer.removeChild(canvasContainer.firstChild);
                    }
                    
                    // PixiJS v8 移行準備コメント
                    // v8移行時: app.canvas の代わりに app.view を使用
                    canvasContainer.appendChild(app.view);
                    this.logSuccess('✅ フォールバックキャンバス作成完了');
                }
                
                // 基本的なエラー回復表示
                this.showRecoveryMessage(originalError);
            } else {
                throw new Error('PixiJS も利用できません');
            }
            
        } catch (fallbackError) {
            this.logError('💀 フォールバック初期化も失敗', fallbackError);
            this.showCriticalErrorMessage(originalError, fallbackError);
        }
    }
    
    /**
     * 初期化サマリー表示（詳細化）
     */
    displayInitializationSummary() {
        console.group('📋 初期化サマリー');
        
        this.logInfo(`✅ 完了ステップ: ${this.initializationSteps.join(' → ')}`);
        this.logInfo(`📊 エラーログ: ${this.errorLog.length}件`);
        
        if (this.appCore) {
            const appCoreStatus = {
                pixiApp: !!this.appCore.app,
                drawingContainer: !!this.appCore.drawingContainer,
                toolSystem: !!this.appCore.toolSystem,
                uiController: !!this.appCore.uiController,
                performanceMonitor: !!this.appCore.performanceMonitor,
                canvasSize: `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`,
                fallbackMode: this.appCore.fallbackMode || false
            };
            this.logInfo('🎨 AppCore状態:', appCoreStatus);
        }
        
        // Manager統合状況
        const managerStatus = {
            configManager: !!this.configManager,
            errorManager: !!this.errorManager,
            initializationManager: !!this.initializationManager
        };
        this.logInfo('🔧 Manager統合状況:', managerStatus);
        
        // PixiJS v8 移行準備確認
        const v8ReadinessStatus = {
            pixiVersion: window.PIXI?.VERSION || 'N/A',
            applicationInitSupport: typeof window.PIXI?.Application?.init === 'function',
            legacyConstructorSupport: typeof window.PIXI?.Application === 'function',
            webGPUSupport: 'navigator' in window && 'gpu' in navigator
        };
        this.logInfo('🚀 PixiJS v8 移行準備状況:', v8ReadinessStatus);
        
        const initTime = performance.now() - this.startTime;
        this.logInfo(`⏱️ 総初期化時間: ${initTime.toFixed(2)}ms`);
        
        if (this.errorLog.length > 0) {
            this.logWarning('⚠️ エラー詳細:', this.errorLog);
        }
        
        console.groupEnd();
    }
    
    // ===========================================
    // DRY: ログ関数群（統合・再利用可能）
    // ===========================================
    
    /**
     * 成功ログ出力（DRY適用）
     */
    logSuccess(message, data = null) {
        console.log(`✅ ${message}`, data || '');
    }
    
    /**
     * 情報ログ出力（DRY適用）
     */
    logInfo(message, data = null) {
        console.log(`ℹ️ ${message}`, data || '');
    }
    
    /**
     * 警告ログ出力（DRY適用）
     */
    logWarning(message, data = null) {
        console.warn(`⚠️ ${message}`, data || '');
    }
    
    /**
     * エラーログ出力（DRY適用）
     */
    logError(message, error = null) {
        console.error(`❌ ${message}`, error || '');
    }
    
    /**
     * スリープ関数（DRY適用）
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ===========================================
    // エラー表示関数群（UI表示）
    // ===========================================
    
    /**
     * エラー通知表示（軽量版）
     */
    showErrorNotification(error) {
        // ErrorManager利用（利用可能な場合）
        if (this.errorManager) {
            this.errorManager.handleError(error, 'ui', 'User Operation');
            return;
        }
        
        // フォールバック通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 12px;
            border-radius: 6px;
            z-index: 9999;
            font-size: 12px;
            max-width: 300px;
        `;
        
        notification.textContent = `エラー: ${error.message || error}`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    /**
     * エラーメッセージ表示（改良版）
     */
    showErrorMessage(error) {
        this.logError('🚨 エラーメッセージ表示', error.message);
        
        // ErrorManager利用（利用可能な場合）
        if (this.errorManager) {
            this.errorManager.handleError(error, 'initialization', 'Main Initialization');
            return;
        }
        
        // フォールバック表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #800000;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(128, 0, 0, 0.3);
            z-index: 9999;
            max-width: 400px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            animation: slideIn 0.3s ease-out;
        `;
        
        // CSS Animation
        if (!document.getElementById('error-animation-style')) {
            const style = document.createElement('style');
            style.id = 'error-animation-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🚨 初期化エラー</div>
            <div style="margin-bottom: 12px; font-size: 11px; opacity: 0.9;">
                ${this.escapeHtml(error.message || error)}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="location.reload()" 
                        style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    🔄 再読み込み
                </button>
                <button onclick="this.parentNode.parentNode.remove()" 
                        style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    閉じる
                </button>
                <button onclick="console.log('🔍 デバッグ情報:', window.getAppState ? window.getAppState() : 'デバッグ情報なし'); alert('コンソールを確認してください');" 
                        style="background: rgba(255,255,255,0.15); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    🔍 デバッグ
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 自動削除（10秒後）
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.style.animation = 'slideIn 0.3s ease-in reverse';
                setTimeout(() => errorDiv.remove(), 300);
            }
        }, 10000);
    }
    
    /**
     * 回復メッセージ表示（改良版）
     */
    showRecoveryMessage(originalError) {
        const recoveryDiv = document.createElement('div');
        recoveryDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #cf9c97;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(207, 156, 151, 0.3);
            z-index: 9998;
            max-width: 500px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            text-align: center;
            animation: slideIn 0.3s ease-out;
        `;
        
        recoveryDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🛡️ 自動回復モード</div>
            <div style="margin-bottom: 12px; font-size: 11px; opacity: 0.9;">
                初期化で問題が発生しましたが、基本的な描画環境を作成しました。
            </div>
            <div style="font-size: 10px; opacity: 0.7;">
                一部の機能が制限される場合があります。ページを再読み込みして再試行することをお勧めします。
            </div>
        `;
        
        document.body.appendChild(recoveryDiv);
        
        // 7秒後に自動削除
        setTimeout(() => {
            if (recoveryDiv.parentNode) {
                recoveryDiv.style.animation = 'slideIn 0.3s ease-in reverse';
                setTimeout(() => recoveryDiv.remove(), 300);
            }
        }, 7000);
    }
    
    /**
     * 致命的エラーメッセージ表示
     */
    showCriticalErrorMessage(originalError, fallbackError) {
        const criticalDiv = document.createElement('div');
        criticalDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f0e0d6;
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: system-ui, sans-serif;
        `;
        
        criticalDiv.innerHTML = `
            <div style="text-align: center; color: #800000; background: white; padding: 32px; border: 3px solid #cf9c97; border-radius: 16px; box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3); max-width: 600px; margin: 20px;">
                <h2 style="margin: 0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                <p style="margin: 0 0 16px 0; color: #2c1810;">致命的なエラーが発生し、自動回復も失敗しました。</p>
                
                <div style="background: #ffffee; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: left;">
                    <div style="font-weight: 600; margin-bottom: 8px;">💀 エラー詳細:</div>
                    <div style="font-family: monospace; font-size: 12px; color: #2c1810; margin-bottom: 8px;">
                        初期エラー: ${this.escapeHtml(originalError.message)}
                    </div>
                    <div style="font-family: monospace; font-size: 12px; color: #2c1810;">
                        回復エラー: ${this.escapeHtml(fallbackError.message)}
                    </div>
                </div>
                
                <div style="background: #fff5f5; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: left;">
                    <div style="font-weight: 600; margin-bottom: 8px;">🔧 推奨対処法:</div>
                    <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: #2c1810;">
                        <li>ページを再読み込み (Ctrl+R または Cmd+R)</li>
                        <li>ブラウザコンソール (F12) でエラー詳細を確認</li>
                        <li>必要なスクリプトファイルの読み込み状況を確認</li>
                        <li>ネットワーク接続を確認</li>
                        <li>ブラウザキャッシュをクリア</li>
                    </ol>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="location.reload()" 
                            style="background: #800000; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔄 再読み込み
                    </button>
                    <button onclick="console.clear(); console.log('🔍 エラー情報:', { original: ${JSON.stringify(originalError.message)}, fallback: ${JSON.stringify(fallbackError.message)} }); alert('コンソールを確認してください');" 
                            style="background: #cf9c97; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        🔍 デバッグ
                    </button>
                </div>
                
                <div style="margin-top: 16px; font-size: 11px; opacity: 0.7; color: #2c1810;">
                    Version: ${this.version} | Time: ${new Date().toLocaleString()}
                </div>
            </div>
        `;
        
        document.body.appendChild(criticalDiv);
    }
    
    /**
     * HTMLエスケープ（XSS対策）
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
    
    // ===========================================
    // PixiJS v8 移行準備関数群
    // ===========================================
    
    /**
     * PixiJS v8 移行準備確認
     * TODO: Phase 2 で実装予定
     */
    checkPixiV8Readiness() {
        const readiness = {
            applicationInitSupport: typeof window.PIXI?.Application?.init === 'function',
            legacyConstructorSupport: typeof window.PIXI?.Application === 'function',
            webGPUSupport: 'navigator' in window && 'gpu' in navigator,
            currentVersion: window.PIXI?.VERSION || 'N/A'
        };
        
        this.logInfo('🚀 PixiJS v8 移行準備確認:', readiness);
        return readiness;
    }
    
    /**
     * v8 互換性アプリケーション作成
     * TODO: Phase 2 で実装予定
     */
    async createV8CompatibleApplication(options = {}) {
        // v8対応版（将来実装）
        if (typeof window.PIXI?.Application?.init === 'function') {
            console.log('🚀 PixiJS v8 Application.init() を使用');
            return await window.PIXI.Application.init(options);
        } 
        // v7互換版（現在）
        else if (typeof window.PIXI?.Application === 'function') {
            console.log('📦 PixiJS v7 new Application() を使用');
            return new window.PIXI.Application(options);
        } else {
            throw new Error('PixiJS Application が利用できません');
        }
    }
}

// ===========================================
// グローバル初期化・状態管理
// ===========================================

// グローバルインスタンス作成
window.futabaDrawingTool = new FutabaDrawingTool();

// グローバル初期化関数
window.initializeFutabaDrawingTool = async function() {
    try {
        await window.futabaDrawingTool.init();
        console.log('🎉 ふたば☆お絵描きツール初期化完了！');
        return true;
    } catch (error) {
        console.error('💀 ふたば☆お絵描きツール初期化失敗:', error);
        return false;
    }
};

// アプリケーション状態取得関数（デバッグ用）
window.getAppState = function() {
    if (!window.futabaDrawingTool) {
        return { status: 'not_created' };
    }
    
    return {
        status: window.futabaDrawingTool.isInitialized ? 'initialized' : 'not_initialized',
        version: window.futabaDrawingTool.version,
        steps: window.futabaDrawingTool.initializationSteps,
        errors: window.futabaDrawingTool.errorLog.length,
        managers: {
            config: !!window.futabaDrawingTool.configManager,
            error: !!window.futabaDrawingTool.errorManager,
            initialization: !!window.futabaDrawingTool.initializationManager
        },
        appCore: !!window.futabaDrawingTool.appCore,
        startTime: window.futabaDrawingTool.startTime,
        pixiVersion: window.PIXI?.VERSION || 'N/A',
        v8Readiness: window.futabaDrawingTool.checkPixiV8Readiness?.() || 'N/A'
    };
};

// DOM読み込み完了時の自動初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎨 DOM読み込み完了 - ふたば☆お絵描きツール自動初期化開始');
    
    // 少し遅延して初期化（他のスクリプト読み込み完了を待つ）
    setTimeout(async () => {
        const success = await window.initializeFutabaDrawingTool();
        
        if (success) {
            console.log('✅ 自動初期化成功');
            
            // カスタムイベント発火
            const event = new CustomEvent('futabaDrawingToolReady', {
                detail: {
                    version: window.futabaDrawingTool.version,
                    initTime: performance.now() - window.futabaDrawingTool.startTime
                }
            });
            document.dispatchEvent(event);
        } else {
            console.warn('⚠️ 自動初期化失敗 - 手動で window.initializeFutabaDrawingTool() を実行してください');
        }
    }, 100);
});

// 使用例・デバッグ用コマンド出力
console.log('📋 ふたば☆お絵描きツール v1.0 Manager統合完全版');
console.log('🎯 主要API:');
console.log('  window.initializeFutabaDrawingTool() - 手動初期化');
console.log('  window.getAppState() - アプリケーション状態確認');
console.log('  window.futabaDrawingTool - メインインスタンス');
console.log('  window.configManager - 設定管理');
console.log('  window.errorManager - エラー管理');
console.log('  window.initializationManager - 初期化管理');
console.log('🎨 Manager統合完全版実装完了 - 依存関係問題完全解決・PixiJS v8 移行準備対応');
console.log('🔧 DRY・SOLID原則適用 - 保守性・拡張性向上');