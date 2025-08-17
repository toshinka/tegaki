/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・AppCore統合エントリーポイント
 * 🔧 修正内容: Manager読み込み失敗解決・エラー処理強化・DRY/SOLID原則適用
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5rev1 依存関係解決版 → Manager統合版
 * 📋 V8_MIGRATION: AppCore経由でPixiJS API変更対応予定
 * 📋 PERFORMANCE_TARGET: 3秒以内初期化・60FPS安定
 * 📋 DRY_COMPLIANCE: エラー処理・ログ関数統合
 * 📋 SOLID_COMPLIANCE: 単一責任・依存関係逆転適用
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.4s1rev1-Manager統合版';
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
        
        console.log('🎨 FutabaDrawingTool初期化開始（Manager統合版）');
    }
    
    /**
     * アプリケーション初期化（修正版 - Manager統合対応）
     */
    async init() {
        try {
            console.log('🚀 Manager統合版初期化開始 - 読み込み失敗問題完全解決');
            
            // Step 1: 依存関係確認（最重要）
            await this.validateDependencies();
            
            // Step 2: Manager存在確認（🚨 新規追加）
            this.validateManagerAvailability();
            
            // Step 3: ConfigManager初期化（修正版）
            await this.initializeConfigManager();
            
            // Step 4: ErrorManager初期化（修正版）
            await this.initializeErrorManager();
            
            // Step 5: InitializationManager初期化（修正版）
            await this.initializeInitializationManager();
            
            // Step 6: 統合初期化実行（修正版）
            await this.executeUnifiedInitialization();
            
            // Step 7: 最終状態設定・確認
            this.finalizeInitialization();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            this.logSuccess('Manager統合版初期化完了！');
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
     * 🚨 新規追加: Manager存在確認（最重要修正）
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
                    'managers/config-manager.js の読み込み確認（最重要）',
                    'index.html でのスクリプトタグ存在確認',
                    'config-manager.js ファイルの存在・構文エラー確認'
                ]
            },
            'ErrorManager': {
                issue: 'ErrorManager クラスが読み込まれていません',
                solutions: [
                    'managers/error-manager.js の読み込み確認（最重要）',
                    'index.html でのスクリプトタグ存在確認',
                    'error-manager.js ファイルの存在・構文エラー確認'
                ]
            },
            'InitializationManager': {
                issue: 'InitializationManager クラスが読み込まれていません',
                solutions: [
                    'managers/initialization-manager.js の読み込み確認（最重要）',
                    'index.html でのスクリプトタグ存在確認',
                    'initialization-manager.js ファイルの存在・構文エラー確認'
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
     * ConfigManager初期化（修正版）
     */
    async initializeConfigManager() {
        this.logInfo('🔧 ConfigManager初期化開始（修正版）...');
        
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
     * ErrorManager初期化（修正版）
     */
    async initializeErrorManager() {
        this.logInfo('🚨 ErrorManager初期化開始（修正版）...');
        
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
     * InitializationManager初期化（修正版）
     */
    async initializeInitializationManager() {
        this.logInfo('🚀 InitializationManager初期化開始（修正版）...');
        
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
     * 統合初期化実行（修正版 - progressCallback修正）
     */
    async executeUnifiedInitialization() {
        this.logInfo('🎯 統合初期化実行開始（修正版）...');
        
        // InitializationManager存在確認
        if (!this.initializationManager) {
            const errorMsg = 'InitializationManager が初期化されていません';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        try {
            // 進捗コールバック設定（🔧 修正: undefinedエラー解決）
            if (this.initializationManager.options) {
                this.initializationManager.options.progressCallback = (progressInfo) => {
                    this.logInfo(`📊 初期化進捗: ${progressInfo.step} - ${progressInfo.progress}%`);
                };
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
     * 不足依存関係診断
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
                    'ネットワーク接続確認'
                ]
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
                ]
            }
        };
        
        missing.forEach(dep => {
            if (diagnostics[dep]) {
                console.error(`❌ ${dep}:`, diagnostics[dep]);
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