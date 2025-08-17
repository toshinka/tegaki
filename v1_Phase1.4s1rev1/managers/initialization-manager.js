/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1.5
 * 🎯 AI_WORK_SCOPE: 初期化簡素化・依存関係解決・DRY原則適用
 * 🔧 Phase1.5-Step4: InitializationManager クラス実装
 * 🚨 PURE_JAVASCRIPT: ES6モジュール禁止・グローバル変数使用
 * 
 * 📋 PHASE_TARGET: Phase1.5 初期化簡素化
 * 📋 V8_MIGRATION: 初期化プロセス互換性保持
 * 📋 DRY_COMPLIANCE: 重複初期化処理完全排除
 * 📋 SOLID_COMPLIANCE: 単一責任・初期化管理統一
 */

class InitializationManager {
    constructor(configManager, errorManager) {
        this.version = 'v1.5-InitializationManager';
        this.configManager = configManager;
        this.errorManager = errorManager;
        this.initialized = false;
        
        // 🎯 初期化ステップ管理 - 宣言的な初期化フロー
        this.steps = new Map();
        this.currentStep = null;
        this.completedSteps = [];
        this.failedSteps = [];
        this.startTime = null;
        
        // 🎯 依存関係管理 - 自動解決システム
        this.dependencyGraph = new Map();
        this.dependencyStates = new Map();
        
        // 🎯 初期化オプション統一
        this.options = {
            maxInitTime: 10000,         // 10秒
            stepTimeout: 5000,          // 各ステップ5秒
            retryAttempts: 3,
            retryDelay: 500,
            parallelExecution: false,   // 順次実行
            failFast: false,            // エラー時も継続
            progressCallback: null,
            diagnostics: true
        };
        
        this.setupDefaultSteps();
        console.log('🚀 InitializationManager 初期化完了 - 初期化簡素化実装');
    }
    
    /**
     * InitializationManager初期化
     */
    initialize() {
        if (this.initialized) {
            console.warn('⚠️ InitializationManager は既に初期化済みです');
            return true;
        }
        
        try {
            this.startTime = performance.now();
            
            // エラーマネージャー連携
            this.setupErrorIntegration();
            
            // 設定マネージャー連携
            this.setupConfigIntegration();
            
            // 進捗監視設定
            this.setupProgressMonitoring();
            
            this.initialized = true;
            console.log('✅ InitializationManager 初期化完了 - 統一初期化システム開始');
            return true;
            
        } catch (error) {
            console.error('❌ InitializationManager 初期化失敗:', error);
            return false;
        }
    }
    
    // ===========================================
    // 🚀 初期化ステップ管理（宣言的）
    // ===========================================
    
    /**
     * 初期化ステップ登録（宣言的）
     * @param {string} name - ステップ名
     * @param {Array<string>} dependencies - 依存関係ステップ名配列
     * @param {Function} handler - 実行ハンドラー
     * @param {Object} options - ステップオプション
     */
    registerStep(name, dependencies = [], handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error(`ステップ '${name}' のハンドラーは関数である必要があります`);
        }
        
        const step = {
            name,
            dependencies: Array.isArray(dependencies) ? dependencies : [],
            handler,
            options: {
                timeout: options.timeout || this.options.stepTimeout,
                retryable: options.retryable !== false,
                critical: options.critical !== false,
                description: options.description || `${name} ステップ`,
                ...options
            },
            status: 'pending',      // pending, running, completed, failed
            startTime: null,
            endTime: null,
            duration: null,
            result: null,
            error: null,
            retryCount: 0
        };
        
        this.steps.set(name, step);
        this.dependencyStates.set(name, false);
        
        // 依存関係グラフ更新
        this.dependencyGraph.set(name, dependencies);
        
        console.log(`✅ 初期化ステップ登録: ${name} (依存: ${dependencies.join(', ') || 'なし'})`);
        return step;
    }
    
    /**
     * デフォルト初期化ステップ設定
     */
    setupDefaultSteps() {
        // Phase 1: 基盤依存関係確認
        this.registerStep('validate-environment', [], async () => {
            this.validateBrowserEnvironment();
            this.validateRequiredGlobals();
        }, { 
            description: 'ブラウザ環境・グローバル変数確認',
            critical: true
        });
        
        // Phase 2: 外部依存関係確認
        this.registerStep('load-dependencies', ['validate-environment'], async () => {
            await this.loadExternalDependencies();
        }, { 
            description: 'PixiJS・外部ライブラリ読み込み確認',
            critical: true
        });
        
        // Phase 3: 拡張ライブラリ初期化
        this.registerStep('initialize-extensions', ['load-dependencies'], async () => {
            await this.initializePixiExtensions();
        }, { 
            description: 'PixiJS拡張ライブラリ初期化',
            critical: false
        });
        
        // Phase 4: 設定管理初期化
        this.registerStep('initialize-config', ['validate-environment'], async () => {
            await this.initializeConfigManager();
        }, { 
            description: 'ConfigManager 初期化',
            critical: true
        });
        
        // Phase 5: エラー管理初期化
        this.registerStep('initialize-error-manager', ['initialize-config'], async () => {
            await this.initializeErrorManager();
        }, { 
            description: 'ErrorManager 初期化',
            critical: true
        });
        
        // Phase 6: AppCore初期化
        this.registerStep('initialize-app-core', ['load-dependencies', 'initialize-config'], async () => {
            await this.initializeAppCore();
        }, { 
            description: 'AppCore 初期化・キャンバス作成',
            critical: true
        });
        
        // Phase 7: UI統合
        this.registerStep('initialize-ui', ['initialize-app-core', 'initialize-error-manager'], async () => {
            await this.initializeUIComponents();
        }, { 
            description: 'UI コンポーネント統合',
            critical: false
        });
        
        // Phase 8: 最終検証
        this.registerStep('final-validation', ['initialize-ui'], async () => {
            await this.performFinalValidation();
        }, { 
            description: '最終動作確認・状態検証',
            critical: true
        });
        
        console.log(`✅ デフォルト初期化ステップ設定完了: ${this.steps.size}ステップ`);
    }
    
    /**
     * 依存関係解決付き実行
     */
    async execute() {
        if (!this.initialized) {
            throw new Error('InitializationManager が初期化されていません');
        }
        
        try {
            this.startTime = performance.now();
            console.log('🚀 統一初期化開始 - 依存関係解決システム');
            
            // 依存関係順にステップをソート
            const sortedSteps = this.sortStepsByDependencies();
            console.log(`📋 実行順序: ${sortedSteps.map(s => s.name).join(' → ')}`);
            
            // 各ステップを順次実行
            for (const step of sortedSteps) {
                await this.executeStep(step);
                
                // 失敗時の処理
                if (step.status === 'failed' && step.options.critical && this.options.failFast) {
                    throw new Error(`致命的ステップ '${step.name}' が失敗しました`);
                }
            }
            
            // 実行結果確認
            const results = this.getExecutionResults();
            
            if (results.failed > 0 && results.criticalFailed > 0) {
                throw new Error(`致命的ステップ ${results.criticalFailed}個が失敗しました`);
            }
            
            const totalTime = performance.now() - this.startTime;
            console.log(`🎉 統一初期化完了! 総時間: ${totalTime.toFixed(2)}ms`);
            console.log(`📊 結果: 成功 ${results.completed}/${results.total}, 失敗 ${results.failed}, 警告 ${results.nonCriticalFailed}`);
            
            return results;
            
        } catch (error) {
            const totalTime = performance.now() - this.startTime;
            console.error(`💀 統一初期化失敗: ${error.message} (${totalTime.toFixed(2)}ms)`);
            
            if (this.errorManager) {
                this.errorManager.handleError(error, 'initialization', 'InitializationManager.execute');
            }
            
            throw error;
        }
    }
    
    /**
     * 個別ステップ実行
     */
    async executeStep(step) {
        this.currentStep = step.name;
        step.status = 'running';
        step.startTime = performance.now();
        
        console.log(`🔄 実行中: ${step.name} - ${step.options.description}`);
        
        try {
            // 依存関係確認
            if (!this.checkStepDependencies(step)) {
                throw new Error(`依存関係が満たされていません: ${step.dependencies.join(', ')}`);
            }
            
            // タイムアウト付き実行
            const result = await this.executeWithTimeout(step);
            
            // 成功処理
            step.status = 'completed';
            step.endTime = performance.now();
            step.duration = step.endTime - step.startTime;
            step.result = result;
            
            this.completedSteps.push(step.name);
            this.dependencyStates.set(step.name, true);
            
            console.log(`✅ 完了: ${step.name} (${step.duration.toFixed(2)}ms)`);
            
            // 進捗通知
            this.notifyProgress(step, 'completed');
            
        } catch (error) {
            // エラー処理
            step.status = 'failed';
            step.endTime = performance.now();
            step.duration = step.endTime - step.startTime;
            step.error = error;
            
            this.failedSteps.push(step.name);
            
            console.error(`❌ 失敗: ${step.name} (${step.duration?.toFixed(2) || '?'}ms) - ${error.message}`);
            
            // リトライ処理
            if (step.options.retryable && step.retryCount < this.options.retryAttempts) {
                console.log(`🔄 リトライ: ${step.name} (${step.retryCount + 1}/${this.options.retryAttempts})`);
                step.retryCount++;
                await this.delay(this.options.retryDelay);
                return await this.executeStep(step);
            }
            
            // 進捗通知
            this.notifyProgress(step, 'failed');
            
            // エラー管理連携
            if (this.errorManager) {
                this.errorManager.handleError(
                    error, 
                    'initialization', 
                    `初期化ステップ: ${step.name}`,
                    { severity: step.options.critical ? 'critical' : 'error' }
                );
            }
        }
    }
    
    /**
     * タイムアウト付き実行
     */
    async executeWithTimeout(step) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`ステップ '${step.name}' がタイムアウトしました (${step.options.timeout}ms)`));
            }, step.options.timeout);
            
            try {
                const result = await step.handler();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    /**
     * 依存関係によるソート（トポロジカルソート）
     */
    sortStepsByDependencies() {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (stepName) => {
            if (visiting.has(stepName)) {
                throw new Error(`循環依存を検出: ${stepName}`);
            }
            
            if (visited.has(stepName)) {
                return;
            }
            
            visiting.add(stepName);
            
            const step = this.steps.get(stepName);
            if (!step) {
                throw new Error(`不明なステップ: ${stepName}`);
            }
            
            // 依存関係を先に処理
            step.dependencies.forEach(dep => {
                if (!this.steps.has(dep)) {
                    throw new Error(`不明な依存関係: ${dep} (ステップ: ${stepName})`);
                }
                visit(dep);
            });
            
            visiting.delete(stepName);
            visited.add(stepName);
            sorted.push(step);
        };
        
        // 全ステップを処理
        this.steps.forEach((step, name) => {
            if (!visited.has(name)) {
                visit(name);
            }
        });
        
        return sorted;
    }
    
    /**
     * ステップ依存関係確認
     */
    checkStepDependencies(step) {
        return step.dependencies.every(dep => this.dependencyStates.get(dep) === true);
    }
    
    // ===========================================
    // 🔧 個別初期化ステップ実装
    // ===========================================
    
    /**
     * ブラウザ環境検証
     */
    validateBrowserEnvironment() {
        const checks = {
            canvas: 'HTMLCanvasElement' in window,
            webgl: this.checkWebGLSupport(),
            localStorage: 'localStorage' in window,
            performance: 'performance' in window,
            requestAnimationFrame: 'requestAnimationFrame' in window
        };
        
        const failed = Object.entries(checks)
            .filter(([name, supported]) => !supported)
            .map(([name]) => name);
        
        if (failed.length > 0) {
            throw new Error(`サポートされていない機能: ${failed.join(', ')}`);
        }
        
        console.log('✅ ブラウザ環境確認完了');
        return checks;
    }
    
    /**
     * WebGL サポート確認
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }
    
    /**
     * 必須グローバル変数確認
     */
    validateRequiredGlobals() {
        const required = [
            'document', 'window', 'console', 'performance'
        ];
        
        const missing = required.filter(name => typeof window[name] === 'undefined');
        
        if (missing.length > 0) {
            throw new Error(`必須グローバル変数が不足: ${missing.join(', ')}`);
        }
        
        console.log('✅ 必須グローバル変数確認完了');
        return true;
    }
    
    /**
     * 外部依存関係読み込み
     */
    async loadExternalDependencies() {
        const dependencies = [
            { name: 'PIXI', check: () => typeof window.PIXI !== 'undefined' },
            { name: 'gsap', check: () => typeof window.gsap !== 'undefined', optional: true },
            { name: 'lodash', check: () => typeof window._ !== 'undefined', optional: true },
            { name: 'Hammer', check: () => typeof window.Hammer !== 'undefined', optional: true }
        ];
        
        const results = {};
        const missing = [];
        
        for (const dep of dependencies) {
            const available = dep.check();
            results[dep.name] = available;
            
            if (!available && !dep.optional) {
                missing.push(dep.name);
            }
            
            if (available) {
                const version = window[dep.name]?.VERSION || window[dep.name]?.version || 'unknown';
                console.log(`✅ ${dep.name} 確認完了 (v${version})`);
            } else if (!dep.optional) {
                console.error(`❌ ${dep.name} が読み込まれていません`);
            } else {
                console.warn(`⚠️ ${dep.name} は読み込まれていません（オプション）`);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`必須依存関係が不足: ${missing.join(', ')}`);
        }
        
        return results;
    }
    
    /**
     * PixiJS拡張ライブラリ初期化
     */
    async initializePixiExtensions() {
        if (typeof window.PixiExtensions !== 'undefined') {
            try {
                if (!window.PixiExtensions.initialized) {
                    await window.PixiExtensions.initialize();
                }
                
                const stats = window.PixiExtensions.getStats();
                console.log(`✅ PixiExtensions初期化完了: ${stats.available}/${stats.total}機能利用可能`);
                return stats;
            } catch (error) {
                console.warn('⚠️ PixiExtensions初期化でエラー:', error.message);
                return { available: 0, total: 0, fallbackMode: true };
            }
        } else {
            console.warn('⚠️ PixiExtensions未検出 - 基本機能のみ使用');
            return { available: 0, total: 0, notFound: true };
        }
    }
    
    /**
     * ConfigManager初期化
     */
    async initializeConfigManager() {
        if (!this.configManager) {
            // ConfigManagerが渡されていない場合は新規作成
            if (typeof window.ConfigManager !== 'undefined') {
                this.configManager = new window.ConfigManager();
                window.configManager = this.configManager; // グローバル公開
            } else {
                console.warn('⚠️ ConfigManager クラスが見つかりません');
                return { fallbackMode: true };
            }
        }
        
        const initialized = this.configManager.initialize();
        if (!initialized) {
            throw new Error('ConfigManager初期化に失敗しました');
        }
        
        console.log('✅ ConfigManager初期化完了');
        return { initialized: true, configItems: this.configManager.countSettings?.() || 'N/A' };
    }
    
    /**
     * ErrorManager初期化
     */
    async initializeErrorManager() {
        if (!this.errorManager) {
            // ErrorManagerが渡されていない場合は新規作成
            if (typeof window.ErrorManager !== 'undefined') {
                this.errorManager = new window.ErrorManager();
                window.errorManager = this.errorManager; // グローバル公開
            } else {
                console.warn('⚠️ ErrorManager クラスが見つかりません');
                return { fallbackMode: true };
            }
        }
        
        const initialized = this.errorManager.initialize();
        if (!initialized) {
            throw new Error('ErrorManager初期化に失敗しました');
        }
        
        console.log('✅ ErrorManager初期化完了');
        return { initialized: true };
    }
    
    /**
     * AppCore初期化
     */
    async initializeAppCore() {
        if (typeof window.AppCore === 'undefined') {
            throw new Error('AppCore クラスが読み込まれていません');
        }
        
        // FutabaDrawingTool経由でAppCore初期化
        if (window.futabaDrawingTool && window.futabaDrawingTool.appCore) {
            console.log('✅ AppCore は既に初期化済みです');
            return { alreadyInitialized: true };
        }
        
        if (window.futabaDrawingTool) {
            // AppCoreインスタンス作成
            window.futabaDrawingTool.appCore = new window.AppCore();
            
            // 初期化実行
            await window.futabaDrawingTool.appCore.initialize();
            
            console.log('✅ AppCore初期化完了');
            return { 
                initialized: true,
                canvasSize: `${window.futabaDrawingTool.appCore.canvasWidth}x${window.futabaDrawingTool.appCore.canvasHeight}`
            };
        } else {
            throw new Error('FutabaDrawingTool インスタンスが見つかりません');
        }
    }
    
    /**
     * UIコンポーネント初期化
     */
    async initializeUIComponents() {
        const components = [
            { id: 'pen-settings', name: 'ペン設定パネル' },
            { id: 'resize-settings', name: 'リサイズ設定パネル' },
            { id: 'drawing-canvas', name: '描画キャンバス' },
            { id: 'current-tool', name: 'ツール表示' },
            { id: 'canvas-info', name: 'キャンバス情報' }
        ];
        
        const results = {};
        
        components.forEach(comp => {
            const element = document.getElementById(comp.id);
            results[comp.id] = !!element;
            
            if (element) {
                console.log(`✅ ${comp.name} 確認完了`);
            } else {
                console.warn(`⚠️ ${comp.name} (${comp.id}) が見つかりません`);
            }
        });
        
        // 基本的なUI統合処理
        this.setupBasicUIIntegration();
        
        const availableComponents = Object.values(results).filter(Boolean).length;
        console.log(`✅ UI初期化完了: ${availableComponents}/${components.length}コンポーネント利用可能`);
        
        return { components: results, available: availableComponents, total: components.length };
    }
    
    /**
     * 基本UI統合
     */
    setupBasicUIIntegration() {
        // APIGateway初期化（利用可能な場合）
        if (typeof window.APIGateway !== 'undefined' && window.futabaDrawingTool) {
            try {
                window.futaba = new window.APIGateway(window.futabaDrawingTool);
                window.futaba.initialize();
                console.log('✅ APIGateway統合完了');
            } catch (error) {
                console.warn('⚠️ APIGateway統合でエラー:', error.message);
            }
        }
        
        // 基本的なキーボードショートカット設定
        this.setupBasicKeyboardShortcuts();
    }
    
    /**
     * 基本キーボードショートカット設定
     */
    setupBasicKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => {
                // ポップアップを閉じる
                document.querySelectorAll('.popup-panel.show').forEach(popup => {
                    popup.classList.remove('show');
                });
            }
        };
        
        document.addEventListener('keydown', (e) => {
            if (shortcuts[e.code] && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                // テキスト入力中は無視
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    shortcuts[e.code]();
                }
            }
        });
        
        console.log('✅ 基本キーボードショートカット設定完了');
    }
    
    /**
     * 最終検証
     */
    async performFinalValidation() {
        const validationResults = {
            appCore: this.validateAppCore(),
            ui: this.validateUIState(),
            config: this.validateConfig(),
            apis: this.validateAPIs()
        };
        
        const errors = Object.entries(validationResults)
            .filter(([name, result]) => result.valid === false)
            .map(([name, result]) => `${name}: ${result.error}`);
        
        if (errors.length > 0) {
            console.warn('⚠️ 最終検証で警告:', errors);
            // 警告として扱い、致命的エラーではない
        }
        
        console.log('✅ 最終検証完了');
        return validationResults;
    }
    
    /**
     * AppCore状態検証
     */
    validateAppCore() {
        try {
            if (!window.futabaDrawingTool?.appCore) {
                return { valid: false, error: 'AppCore インスタンスが見つかりません' };
            }
            
            const appCore = window.futabaDrawingTool.appCore;
            
            if (!appCore.app) {
                return { valid: false, error: 'PixiJS Application が初期化されていません' };
            }
            
            if (!appCore.drawingContainer) {
                return { valid: false, error: 'DrawingContainer が初期化されていません' };
            }
            
            return { valid: true, appCore: 'initialized' };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * UI状態検証
     */
    validateUIState() {
        try {
            const canvasElement = document.getElementById('drawing-canvas');
            if (!canvasElement) {
                return { valid: false, error: 'drawing-canvas 要素が見つかりません' };
            }
            
            const pixiCanvas = canvasElement.querySelector('canvas');
            if (!pixiCanvas) {
                return { valid: false, error: 'PixiJS キャンバスがDOM内に見つかりません' };
            }
            
            return { valid: true, canvas: 'attached' };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * 設定状態検証
     */
    validateConfig() {
        try {
            if (!window.configManager) {
                return { valid: false, error: 'ConfigManager が初期化されていません' };
            }
            
            // 基本設定値の確認
            const canvasWidth = window.configManager.get('canvas.defaultWidth');
            const brushSize = window.configManager.get('brush.defaultSize');
            
            if (!canvasWidth || !brushSize) {
                return { valid: false, error: '基本設定値が取得できません' };
            }
            
            return { valid: true, config: 'available' };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    /**
     * API状態検証
     */
    validateAPIs() {
        try {
            if (!window.futaba) {
                return { valid: false, error: 'APIGateway (futaba) が初期化されていません' };
            }
            
            // 基本API動作確認
            const stateResult = window.futaba.getState();
            if (!stateResult || !stateResult.success) {
                return { valid: false, error: '基本API動作確認に失敗' };
            }
            
            return { valid: true, apis: 'functional' };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    // ===========================================
    // 📊 初期化状態・結果管理
    // ===========================================
    
    /**
     * 初期化状態取得
     */
    getInitializationStatus() {
        return {
            currentStep: this.currentStep,
            completedSteps: this.completedSteps,
            failedSteps: this.failedSteps,
            totalSteps: this.steps.size,
            progress: this.calculateProgress(),
            duration: this.startTime ? performance.now() - this.startTime : 0,
            details: this.getDetailedStatus()
        };
    }
    
    /**
     * 実行結果取得
     */
    getExecutionResults() {
        const stepArray = Array.from(this.steps.values());
        
        return {
            total: stepArray.length,
            completed: stepArray.filter(s => s.status === 'completed').length,
            failed: stepArray.filter(s => s.status === 'failed').length,
            criticalFailed: stepArray.filter(s => s.status === 'failed' && s.options.critical).length,
            nonCriticalFailed: stepArray.filter(s => s.status === 'failed' && !s.options.critical).length,
            totalDuration: this.startTime ? performance.now() - this.startTime : 0,
            steps: stepArray.map(step => ({
                name: step.name,
                status: step.status,
                duration: step.duration,
                critical: step.options.critical,
                error: step.error?.message || null
            }))
        };
    }
    
    /**
     * 進捗計算
     */
    calculateProgress() {
        if (this.steps.size === 0) return 0;
        
        const completed = this.completedSteps.length + this.failedSteps.length;
        return Math.round((completed / this.steps.size) * 100);
    }
    
    /**
     * 詳細状態取得
     */
    getDetailedStatus() {
        const details = {};
        
        this.steps.forEach((step, name) => {
            details[name] = {
                status: step.status,
                duration: step.duration,
                retryCount: step.retryCount,
                critical: step.options.critical,
                error: step.error?.message || null
            };
        });
        
        return details;
    }
    
    // ===========================================
    // 🔧 進捗・エラー管理統合
    // ===========================================
    
    /**
     * 進捗通知
     */
    notifyProgress(step, status) {
        if (this.options.progressCallback && typeof this.options.progressCallback === 'function') {
            try {
                this.options.progressCallback({
                    step: step.name,
                    status,
                    progress: this.calculateProgress(),
                    duration: step.duration,
                    total: this.steps.size
                });
            } catch (error) {
                console.warn('進捗コールバックでエラー:', error);
            }
        }
        
        // カスタムイベント発火
        const event = new CustomEvent('initializationProgress', {
            detail: {
                step: step.name,
                status,
                progress: this.calculateProgress()
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * エラー管理統合設定
     */
    setupErrorIntegration() {
        if (this.errorManager) {
            // 初期化エラー用リスナー登録
            this.errorManager.onError('initialization', (errorInfo) => {
                console.log(`🚨 初期化エラー受信: ${errorInfo.context}`);
            });
        }
    }
    
    /**
     * 設定管理統合設定
     */
    setupConfigIntegration() {
        if (this.configManager) {
            // 初期化オプションを設定から取得
            const initConfig = this.configManager.getSection('performance');
            if (initConfig) {
                this.options.maxInitTime = initConfig.maxInitTime || this.options.maxInitTime;
                this.options.retryAttempts = initConfig.retryAttempts || this.options.retryAttempts;
                this.options.retryDelay = initConfig.retryDelay || this.options.retryDelay;
            }
        }
    }
    
    /**
     * 進捗監視設定
     */
    setupProgressMonitoring() {
        // タイムアウト監視
        setTimeout(() => {
            if (this.currentStep && this.startTime) {
                const elapsed = performance.now() - this.startTime;
                if (elapsed > this.options.maxInitTime) {
                    const error = new Error(`初期化がタイムアウトしました (${elapsed.toFixed(2)}ms)`);
                    if (this.errorManager) {
                        this.errorManager.handleError(error, 'initialization', 'Timeout Monitor');
                    } else {
                        console.error('💀 初期化タイムアウト:', error);
                    }
                }
            }
        }, this.options.maxInitTime);
    }
    
    // ===========================================
    // 🔧 ユーティリティ関数
    // ===========================================
    
    /**
     * 遅延実行
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * デバッグ情報取得
     */
    getDebugInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            status: this.getInitializationStatus(),
            options: this.options,
            dependencies: Object.fromEntries(this.dependencyGraph),
            dependencyStates: Object.fromEntries(this.dependencyStates)
        };
    }
    
    /**
     * 初期化リセット
     */
    reset() {
        this.completedSteps = [];
        this.failedSteps = [];
        this.currentStep = null;
        this.startTime = null;
        
        // ステップ状態リセット
        this.steps.forEach(step => {
            step.status = 'pending';
            step.startTime = null;
            step.endTime = null;
            step.duration = null;
            step.result = null;
            step.error = null;
            step.retryCount = 0;
        });
        
        // 依存関係状態リセット
        this.dependencyStates.forEach((value, key) => {
            this.dependencyStates.set(key, false);
        });
        
        console.log('🔄 InitializationManager リセット完了');
    }
}

// グローバル公開
window.InitializationManager = InitializationManager;

// 使用例とテスト
console.log('📋 InitializationManager 使用例:');
console.log('  const initManager = new InitializationManager(configManager, errorManager);');
console.log('  initManager.initialize();');
console.log('  await initManager.execute();  // 全ステップ実行');
console.log('  initManager.getInitializationStatus()  // 状態確認');
console.log('  initManager.registerStep("custom-step", ["dependency"], handler)  // カスタムステップ追加');
console.log('🚀 ふたば☆お絵描きツール v1.5 - InitializationManager実装完了');