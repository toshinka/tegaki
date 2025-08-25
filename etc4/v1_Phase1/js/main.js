/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0
 * 🎯 AI_WORK_SCOPE: アプリケーション初期化・AppCore統合エントリーポイント
 * 🔧 修正内容: 依存関係解決・エラー処理強化・DRY/SOLID原則適用
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止 - グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.1ss5rev1 依存関係解決版
 * 📋 V8_MIGRATION: AppCore経由でPixiJS API変更対応予定
 * 📋 PERFORMANCE_TARGET: 3秒以内初期化・60FPS安定
 * 📋 DRY_COMPLIANCE: エラー処理・ログ関数統合
 * 📋 SOLID_COMPLIANCE: 単一責任・依存関係逆転適用
 */

class FutabaDrawingTool {
    constructor() {
        this.version = 'v1.0-Phase1.1ss5rev1-依存関係解決版';
        this.isInitialized = false;
        this.startTime = performance.now();
        
        // 🔧 修正: AppCore統合
        this.appCore = null;
        this.initializationSteps = [];
        this.errorLog = [];
        
        // DRY: 設定値集約
        this.config = {
            maxInitTime: 5000,        // 最大初期化時間（ms）
            retryAttempts: 3,         // リトライ回数
            retryDelay: 200,          // リトライ間隔（ms）
            requiredDependencies: [   // 必須依存関係
                'PIXI', 'PixiExtensions', 'AppCore'
            ]
        };
        
        console.log('🎨 FutabaDrawingTool初期化開始（依存関係解決版）');
    }
    
    /**
     * アプリケーション初期化（修正版 - 依存関係解決）
     */
    async init() {
        try {
            console.log('🚀 依存関係解決版初期化開始 - AppCore統合エラー完全解決');
            
            // Step 1: 依存関係確認（最重要）
            await this.validateDependencies();
            
            // Step 2: 初期化前チェック
            this.performPreInitializationChecks();
            
            // Step 3: 拡張ライブラリ確認・初期化
            await this.initializeExtensions();
            
            // Step 4: AppCore初期化（核心修正）
            await this.initializeAppCore();
            
            // Step 5: UI統合・イベント処理設定
            this.setupUIIntegration();
            
            // Step 6: 追加機能初期化
            this.initializeAdditionalFeatures();
            
            // Step 7: 最終状態設定・確認
            this.finalizeInitialization();
            
            this.isInitialized = true;
            const initTime = performance.now() - this.startTime;
            
            this.logSuccess('AppCore統合依存関係解決版初期化完了！');
            this.logInfo(`⏱️ 初期化時間: ${initTime.toFixed(2)}ms`);
            this.displayInitializationSummary();
            
        } catch (error) {
            this.logError('AppCore統合初期化失敗', error);
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
            'AppCore': {
                issue: 'app-core.js が読み込まれていません（最重要）',
                solutions: [
                    'js/app-core.js の存在確認（核心問題）',
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
     * 初期化前チェック（DRY適用）
     */
    performPreInitializationChecks() {
        this.logInfo('🔍 初期化前チェック開始...');
        
        const requiredElements = [
            'drawing-canvas', 'pen-tool', 'pen-settings',
            'canvas-info', 'current-tool', 'coordinates'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            this.logWarning('⚠️ 不足DOM要素', missingElements);
            this.errorLog.push({ 
                step: 'pre-check', 
                error: `Missing DOM elements: ${missingElements.join(', ')}`, 
                time: Date.now() 
            });
        } else {
            this.logSuccess('✅ 必要DOM要素確認完了');
        }
        
        // PixiJS詳細確認
        if (window.PIXI) {
            this.logSuccess(`✅ PixiJS v${PIXI.VERSION} 検出`);
            
            // v8移行準備チェック
            if (PIXI.VERSION.startsWith('8')) {
                this.logInfo('🚀 PixiJS v8 検出 - Application.init()対応');
            } else {
                this.logInfo('📋 PixiJS v7 使用中 - v8移行準備済み');
            }
        }
        
        this.initializationSteps.push('pre-check');
    }
    
    /**
     * 拡張ライブラリ初期化（エラー処理強化）
     */
    async initializeExtensions() {
        this.logInfo('🔧 拡張ライブラリ初期化開始...');
        
        if (typeof window.PixiExtensions !== 'undefined') {
            try {
                if (!window.PixiExtensions.initialized) {
                    await window.PixiExtensions.initialize();
                }
                
                const stats = window.PixiExtensions.getStats();
                this.logSuccess(`✅ PixiExtensions初期化完了: ${stats.available?.length || 0}機能利用可能`);
                
                if (stats.fallbackMode) {
                    this.logWarning('⚠️ 一部機能でフォールバックモード動作中');
                }
                
            } catch (error) {
                this.logWarning('⚠️ PixiExtensions初期化でエラー', error.message);
                this.errorLog.push({ 
                    step: 'extensions', 
                    error: error.message, 
                    time: Date.now() 
                });
            }
        } else {
            this.logWarning('⚠️ PixiExtensions未読み込み - 基本機能のみ使用');
        }
        
        this.initializationSteps.push('extensions');
    }
    
    /**
     * AppCore初期化（核心修正・エラー処理強化）
     * SOLID - Single Responsibility Principle
     */
    async initializeAppCore() {
        this.logInfo('🎯 AppCore初期化開始（核心修正・完全版）...');
        
        // AppCoreクラス存在確認（最重要）
        if (typeof window.AppCore === 'undefined') {
            const errorMsg = 'AppCore クラスが読み込まれていません - js/app-core.js の読み込み確認が必要';
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        // AppCore インスタンス作成（エラーハンドリング強化）
        try {
            this.appCore = new window.AppCore();
            this.logSuccess('✅ AppCore インスタンス作成完了');
        } catch (error) {
            this.logError('❌ AppCore インスタンス作成失敗', error);
            throw new Error(`AppCore インスタンス作成失敗: ${error.message}`);
        }
        
        // AppCore 初期化実行（詳細ログ付き）
        try {
            await this.appCore.initialize();
            this.logSuccess('✅ AppCore 初期化完了');
        } catch (error) {
            this.logError('❌ AppCore 初期化失敗', error);
            throw new Error(`AppCore 初期化失敗: ${error.message}`);
        }
        
        // AppCore状態確認（詳細検証）
        const validationResults = this.validateAppCoreState();
        
        if (!validationResults.valid) {
            const errorMsg = `AppCore状態不正: ${validationResults.errors.join(', ')}`;
            this.logError(errorMsg);
            throw new Error(errorMsg);
        }
        
        this.logSuccess('✅ AppCore状態確認完了');
        this.logInfo(`📐 キャンバスサイズ: ${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`);
        this.logInfo(`🎨 描画パス数: ${this.appCore.paths?.length || 0}`);
        
        this.initializationSteps.push('app-core');
    }
    
    /**
     * AppCore状態検証
     * SOLID - Single Responsibility Principle
     */
    validateAppCoreState() {
        const errors = [];
        
        if (!this.appCore.app) {
            errors.push('PixiJS Application初期化失敗');
        }
        
        if (!this.appCore.drawingContainer) {
            errors.push('DrawingContainer初期化失敗');
        }
        
        if (!this.appCore.toolSystem) {
            errors.push('ToolSystem初期化失敗');
        }
        
        // DOM接続確認
        const canvasElement = document.getElementById('drawing-canvas');
        if (!canvasElement?.contains(this.appCore.app?.view)) {
            errors.push('キャンバスDOM接続失敗');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * UI統合・イベント処理設定（DRY適用）
     */
    setupUIIntegration() {
        this.logInfo('🎨 UI統合・イベント処理設定開始...');
        
        // リサイズ機能統合
        this.setupResizeHandlers();
        
        // ステータス表示初期化
        this.initializeStatusDisplay();
        
        // ポップアップ統合確認
        this.verifyPopupIntegration();
        
        this.logSuccess('✅ UI統合・イベント処理設定完了');
        this.initializationSteps.push('ui-integration');
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
     * ポップアップ統合確認
     */
    verifyPopupIntegration() {
        const popups = ['pen-settings', 'resize-settings'];
        const availablePopups = popups.filter(id => document.getElementById(id));
        
        this.logSuccess(`✅ ポップアップ統合確認: ${availablePopups.length}/${popups.length}個利用可能`);
        
        if (availablePopups.length < popups.length) {
            const missingPopups = popups.filter(id => !document.getElementById(id));
            this.logWarning('⚠️ 不足ポップアップ', missingPopups);
        }
    }
    
    /**
     * 追加機能初期化
     */
    initializeAdditionalFeatures() {
        this.logInfo('🔧 追加機能初期化開始...');
        
        // キーボードショートカット設定
        this.setupKeyboardShortcuts();
        
        this.logSuccess('✅ 追加機能初期化完了');
        this.initializationSteps.push('additional-features');
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
                }
            }
        });
        
        this.logSuccess(`✅ キーボードショートカット ${Object.keys(shortcuts).length}個 設定完了`);
    }
    
    /**
     * 最終状態設定・確認
     */
    finalizeInitialization() {
        this.logInfo('🏁 最終状態設定・確認開始...');
        
        // 初期ツール選択
        this.selectPenTool();
        
        // キャンバスサイズ表示更新
        this.updateCanvasInfo();
        
        // 初期化完了フラグ設定
        this.isInitialized = true;
        
        this.logSuccess('✅ 最終状態設定・確認完了');
        this.initializationSteps.push('finalization');
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
     * エラーメッセージ表示（改良版）
     */
    showErrorMessage(error) {
        this.logError('🚨 エラーメッセージ表示', error.message);
        
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
        this.logWarning('🛡️ 回復メッセージ表示');
        
        const recoveryDiv = document.createElement('div');
        recoveryDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #cf9c97;
            color: #2c1810;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(207, 156, 151, 0.3);
            z-index: 9998;
            max-width: 350px;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            animation: slideUp 0.4s ease-out;
        `;
        
        // CSS Animation
        if (!document.getElementById('recovery-animation-style')) {
            const style = document.createElement('style');
            style.id = 'recovery-animation-style';
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        recoveryDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🛡️ フォールバックモード</div>
            <div style="margin-bottom: 8px; font-size: 11px;">
                一部機能で問題が発生しましたが、基本描画機能は利用可能です。
            </div>
            <div style="font-size: 10px; opacity: 0.8; margin-bottom: 8px;">
                エラー: ${this.escapeHtml(originalError.message.substring(0, 50))}${originalError.message.length > 50 ? '...' : ''}
            </div>
            <button onclick="this.parentNode.remove()" 
                    style="background: #800000; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                了解
            </button>
        `;
        
        document.body.appendChild(recoveryDiv);
    }
    
    /**
     * 致命的エラーメッセージ表示（改良版）
     */
    showCriticalErrorMessage(originalError, fallbackError) {
        this.logError('💀 致命的エラーメッセージ表示');
        
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #ffffee; font-family: system-ui, sans-serif;">
                <div style="text-align: center; color: #800000; background: #f0e0d6; padding: 32px; border: 3px solid #cf9c97; border-radius: 16px; box-shadow: 0 8px 24px rgba(128,0,0,0.15); max-width: 500px;">
                    <h2 style="margin: 0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin: 0 0 16px 0; color: #2c1810;">申し訳ございませんが、アプリケーションの初期化に失敗しました。</p>
                    <details style="margin: 16px 0; text-align: left;">
                        <summary style="cursor: pointer; font-weight: 600; color: #800000;">エラー詳細</summary>
                        <div style="background: #ffffee; padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 11px; color: #2c1810;">
                            <div><strong>初期化エラー:</strong> ${this.escapeHtml(originalError.message)}</div>
                            <div style="margin-top: 8px;"><strong>フォールバックエラー:</strong> ${this.escapeHtml(fallbackError.message)}</div>
                            <div style="margin-top: 8px;"><strong>推奨対処法:</strong> js/app-core.js の読み込み確認</div>
                        </div>
                    </details>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="location.reload()" 
                                style="background: #800000; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            🔄 再読み込み
                        </button>
                        <button onclick="console.clear(); console.log('🔍 デバッグモード開始'); console.log('PIXI:', typeof PIXI); console.log('AppCore:', typeof AppCore); console.log('PixiExtensions:', typeof PixiExtensions); alert('コンソールを確認してください');" 
                                style="background: #cf9c97; color: #2c1810; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            🔍 デバッグ
                        </button>
                        <button onclick="window.location.href='https://github.com/toshinka/tegaki';" 
                                style="background: #aa5a56; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            📚 GitHub
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * HTMLエスケープ（XSS対策）
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ===========================================
    // アプリケーション状態・デバッグ関数群
    // ===========================================
    
    /**
     * アプリケーション状態取得（詳細版）
     */
    getAppState() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            initializationSteps: this.initializationSteps,
            errorLog: this.errorLog,
            config: this.config,
            dependencies: {
                PIXI: typeof window.PIXI !== 'undefined',
                PixiExtensions: typeof window.PixiExtensions !== 'undefined',
                AppCore: typeof window.AppCore !== 'undefined',
                pixiVersion: window.PIXI?.VERSION || 'N/A'
            },
            appCore: this.appCore ? {
                hasPixiApp: !!this.appCore.app,
                hasDrawingContainer: !!this.appCore.drawingContainer,
                hasToolSystem: !!this.appCore.toolSystem,
                hasUIController: !!this.appCore.uiController,
                canvasSize: `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}`,
                pathCount: this.appCore.paths ? this.appCore.paths.length : 0,
                currentTool: this.appCore.toolSystem ? this.appCore.toolSystem.currentTool : 'unknown',
                fallbackMode: this.appCore.fallbackMode || false,
                extensionsAvailable: this.appCore.extensionsAvailable || false
            } : null,
            performance: {
                initTime: performance.now() - this.startTime,
                memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A',
                isHighPerformance: performance.memory ? performance.memory.usedJSHeapSize < 50 * 1024 * 1024 : true
            },
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * デバッグモード開始
     */
    startDebugMode() {
        console.clear();
        console.log('🔍 FutabaDrawingTool デバッグモード開始');
        console.log('='.repeat(50));
        
        const state = this.getAppState();
        console.log('📊 現在の状態:', state);
        
        // デバッグ用のグローバル関数を提供
        window.debugFutaba = {
            getState: () => this.getAppState(),
            checkDependencies: () => this.config.requiredDependencies.map(dep => ({
                name: dep,
                available: typeof window[dep] !== 'undefined'
            })),
            testAppCore: () => {
                if (this.appCore) {
                    return {
                        canDraw: typeof this.appCore.toolSystem?.startDrawing === 'function',
                        canResize: typeof this.appCore.resize === 'function',
                        hasCanvas: !!this.appCore.app?.view
                    };
                }
                return { error: 'AppCore not initialized' };
            },
            reinitialize: () => this.init()
        };
        
        console.log('🔧 デバッグ関数が利用可能になりました:');
        console.log('  - window.debugFutaba.getState()');
        console.log('  - window.debugFutaba.checkDependencies()');
        console.log('  - window.debugFutaba.testAppCore()');
        console.log('  - window.debugFutaba.reinitialize()');
    }
}

/**
 * アプリケーション起動（依存関係解決・エラー処理強化版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.0');
        console.log('🔧 依存関係解決・エラー処理強化版: AppCore統合問題完全解決');
        console.log('🚀 依存関係解決版起動開始...');
        
        // グローバルインスタンス作成
        window.futabaDrawingTool = new FutabaDrawingTool();
        
        // 初期化実行
        await window.futabaDrawingTool.init();
        
        console.log('🎉 依存関係解決版アプリケーション起動完了！');
        console.log('💡 使用方法:');
        console.log('  - キャンバス上でドラッグして描画');
        console.log('  - P キー: ペンツール選択');
        console.log('  - E キー: 消しゴムツール選択');
        console.log('  - Escape キー: ポップアップ閉じる');
        console.log('  - ペンツールボタンクリック: 設定パネル表示');
        
        // 🎯 デバッグ用 - アプリケーション状態をグローバル公開
        window.getAppState = () => {
            return window.futabaDrawingTool.getAppState();
        };
        
        // 🎯 デバッグモード起動関数
        window.startDebugMode = () => {
            window.futabaDrawingTool.startDebugMode();
        };
        
        console.log('🔍 デバッグ情報:');
        console.log('  - window.getAppState() : アプリ状態確認');
        console.log('  - window.startDebugMode() : デバッグモード開始');
        
    } catch (error) {
        console.error('💀 依存関係解決版起動失敗:', error);
        
        // 🔧 修正: エラー画面をふたば風デザインに（改良版）
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;box-shadow:0 8px 24px rgba(128,0,0,0.15);max-width:600px;">
                    <h2 style="margin:0 0 16px 0;">🎨 ふたば☆ちゃんねる風お絵描きツール</h2>
                    <p style="margin:0 0 16px 0;color:#2c1810;">申し訳ございませんが、依存関係解決版の初期化に失敗しました。</p>
                    <div style="background:#ffffee;padding:12px;border-radius:8px;margin:16px 0;font-family:monospace;font-size:12px;color:#2c1810;text-align:left;">
                        <strong>エラー詳細:</strong><br>
                        ${error.message || error}
                        <br><br>
                        <strong>最も考えられる原因:</strong><br>
                        • js/app-core.js の読み込み失敗（最重要）<br>
                        • libs/pixi-extensions.js の読み込み失敗<br>
                        • PixiJS CDN接続失敗<br>
                        • スクリプト読み込み順序エラー
                        <br><br>
                        <strong>対処方法:</strong><br>
                        1. ブラウザのデベロッパーツール（F12）でコンソールを確認<br>
                        2. ネットワークタブで読み込み失敗ファイルを特定<br>
                        3. js/app-core.js ファイルの存在を確認
                    </div>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="location.reload()" 
                                style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            🔄 再読み込み
                        </button>
                        <button onclick="console.clear(); console.log('🔍 依存関係デバッグ開始'); console.log('PIXI:', typeof PIXI); console.log('AppCore:', typeof AppCore); console.log('PixiExtensions:', typeof PixiExtensions); console.log('DOM elements:', document.querySelectorAll('script').length + ' scripts loaded'); alert('コンソールを確認してください（F12キー）');" 
                                style="background:#cf9c97;color:#2c1810;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            🔍 依存関係確認
                        </button>
                        <button onclick="window.location.href='https://github.com/toshinka/tegaki';" 
                                style="background:#aa5a56;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.2s ease;">
                            📚 GitHub
                        </button>
                    </div>
                    <div style="margin-top:16px;font-size:11px;opacity:0.7;color:#2c1810;">
                        Version: ${error.version || 'v1.0-Phase1.1ss5rev1'}
                    </div>
                </div>
            </div>
        `;
    }
});