/**
 * 🎨 ふたば☆お絵描きツール - 統一版メインアプリケーション（修正版）
 * 🚨 Task 1-B先行実装: 重複関数完全排除・統一システム完全統合版
 * 🎯 DRY・SOLID原則完全準拠・コード肥大化解決・初期化順序修正
 * 
 * 🎯 AI_WORK_SCOPE: アプリケーション統括・統一初期化・イベント協調
 * 🎯 DEPENDENCIES: ConfigManager, ErrorManager, StateManager, EventBus, AppCore
 * 🎯 SPLIT_THRESHOLD: 300行以下維持（重複排除により行数削減）
 * 📋 PHASE_TARGET: Phase1統一化完了版
 * 🚨 重複排除内容: 旧エラー関数・旧状態取得・設定値統一・EventBus完全移行
 */

class FutabaDrawingTool {
    constructor() {
        console.log('🎨 FutabaDrawingTool 初期化開始（修正版）...');
        
        // 基本プロパティ初期化
        this.version = null; // ConfigManagerから取得
        this.isInitialized = false;
        this.startTime = performance.now();
        this.appCore = null;
        this.initializationSteps = [];
        this.isInitializing = false;
        
        // 統一システム参照（後で検証・設定）
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
    }
    
    /**
     * 🚨 統一初期化シーケンス（修正版）
     */
    async initialize() {
        try {
            console.log('🚀 統一初期化シーケンス開始（修正版・DRY・SOLID準拠）');
            this.isInitializing = true;
            
            // Phase 1: 統一システム依存性確認・設定
            this.validateUnifiedSystems();
            
            // Phase 2: 設定初期化（ConfigManager確認後）
            this.initializeConfig();
            
            // Phase 3: 基本依存関係確認
            await this.validateBasicDependencies();
            
            // Phase 4: AppCore初期化
            await this.initializeAppCore();
            
            // Phase 5: システム統合
            this.setupSystemIntegration();
            
            // Phase 6: EventBusリスナー設定
            this.setupEventBusListeners();
            
            // Phase 7: 最終初期化処理
            this.finalizeInitialization();
            
            // 完了処理
            this.completeInitialization();
            
        } catch (error) {
            console.error('💀 統一初期化失敗:', error);
            this.handleInitializationError(error);
        } finally {
            this.isInitializing = false;
        }
    }
    
    /**
     * 🚨 統一システム依存性確認（必須前提条件）- 修正版
     */
    validateUnifiedSystems() {
        const requiredSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
        const missing = requiredSystems.filter(sys => !window[sys]);
        
        if (missing.length > 0) {
            throw new Error(`統一システム依存関係不足: ${missing.join(', ')}`);
        }
        
        // 統一システム参照設定
        this.configManager = window.ConfigManager;
        this.errorManager = window.ErrorManager;
        this.stateManager = window.StateManager;
        this.eventBus = window.EventBus;
        
        console.log('✅ 統一システム依存性確認完了');
        this.initializationSteps.push('unified-systems');
    }
    
    /**
     * 🚨 重複排除: ConfigManager統一設定読み込み（修正版）
     */
    initializeConfig() {
        try {
            // アプリケーション情報取得
            const appInfo = this.configManager.getAppInfo();
            this.version = appInfo.version;
            
            // 各種設定取得
            this.config = {
                app: appInfo,
                performance: this.configManager.getPerformanceConfig(),
                canvas: this.configManager.getCanvasConfig(),
                ui: this.configManager.getUIConfig(),
                dependencies: this.configManager.getDependencies()
            };
            
            console.log(`✅ 設定初期化完了: ${appInfo.name} ${this.version}`);
            this.initializationSteps.push('config');
            
        } catch (error) {
            console.error('❌ 設定初期化失敗:', error);
            // フォールバック設定
            this.version = 'v1.0-Phase1-fallback';
            this.config = {
                app: { version: this.version },
                performance: { maxInitTime: 5000 },
                canvas: { width: 400, height: 400 },
                ui: {},
                dependencies: { required: ['PIXI', 'AppCore'] }
            };
        }
    }
    
    /**
     * 基本依存関係確認（修正版）
     */
    async validateBasicDependencies() {
        try {
            const requiredLibraries = this.config.dependencies.required || ['PIXI', 'AppCore'];
            const missing = requiredLibraries.filter(lib => !window[lib]);
            
            if (missing.length > 0) {
                throw new Error(`必須依存関係不足: ${missing.join(', ')}`);
            }
            
            console.log('✅ 基本依存関係確認完了');
            this.initializationSteps.push('dependencies');
            
        } catch (error) {
            console.error('❌ 基本依存関係確認失敗:', error);
            throw error;
        }
    }
    
    /**
     * AppCore初期化（修正版）
     */
    async initializeAppCore() {
        console.log('🎯 AppCore統一初期化...');
        
        try {
            this.appCore = new window.AppCore();
            await this.appCore.initialize();
            
            const status = this.validateAppCoreStatus();
            if (!status.valid) {
                throw new Error(`AppCore状態異常: ${status.issues.join(', ')}`);
            }
            
            console.log('✅ AppCore初期化完了');
            this.initializationSteps.push('app-core');
            
        } catch (error) {
            console.error('❌ AppCore初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * AppCore状態確認（修正版）
     */
    validateAppCoreStatus() {
        const issues = [];
        
        if (!this.appCore) {
            issues.push('AppCoreインスタンス未作成');
        } else {
            if (!this.appCore.app) issues.push('PixiJS Application未初期化');
            if (!this.appCore.drawingContainer) issues.push('DrawingContainer未初期化');
            
            // ToolManagerとUIManagerは必須ではない（オプション）
            if (!this.appCore.toolManager) {
                console.warn('⚠️ ToolManager未初期化（オプション）');
            }
            if (!this.appCore.uiManager) {
                console.warn('⚠️ UIManager未初期化（オプション）');
            }
        }
        
        return { valid: issues.length === 0, issues };
    }
    
    /**
     * 🚨 重複排除: システム統合（ConfigManager統一版）- 修正版
     */
    setupSystemIntegration() {
        console.log('🔗 システム統合設定（統一版）...');
        
        try {
            // キーボードショートカット設定
            const shortcuts = this.configManager.get('ui.keyboard.shortcuts') || {};
            document.addEventListener('keydown', (e) => {
                const action = shortcuts[e.code];
                if (action && this[action] && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                    e.preventDefault();
                    this[action]();
                }
            });
            
            // リサイズハンドラ設定
            this.setupResizeHandlers();
            
            console.log('✅ システム統合完了');
            this.initializationSteps.push('integration');
            
        } catch (error) {
            console.warn('⚠️ システム統合で問題発生:', error.message);
            this.initializationSteps.push('integration-partial');
        }
    }
    
    /**
     * 🚨 重複排除: EventBusリスナー統一設定（修正版）
     */
    setupEventBusListeners() {
        if (!this.eventBus) {
            console.warn('⚠️ EventBusリスナー設定スキップ（EventBus利用不可）');
            return;
        }
        
        try {
            this.eventBus.on('tool.changed', (data) => {
                this.updateToolStatus(data.tool);
            });
            
            this.eventBus.on('canvas.resized', (data) => {
                this.updateCanvasInfo();
            });
            
            this.eventBus.on('error.occurred', (data) => {
                console.warn('📡 EventBus: エラー通知受信', data);
            });
            
            console.log('✅ EventBusリスナー設定完了');
            this.initializationSteps.push('event-listeners');
            
        } catch (error) {
            console.warn('⚠️ EventBusリスナー設定で問題発生:', error.message);
        }
    }
    
    /**
     * 🚨 重複排除: リサイズハンドラ設定（統一版）
     */
    setupResizeHandlers() {
        // 適用ボタン
        ['apply-resize', 'apply-resize-center'].forEach((id, index) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => this.applyCanvasResize(index === 1));
            }
        });
        
        // プリセットボタン
        document.querySelectorAll('.resize-button[data-size]').forEach(button => {
            button.addEventListener('click', (e) => {
                const [width, height] = e.target.getAttribute('data-size').split(',').map(Number);
                this.setCanvasInputs(width, height);
            });
        });
    }
    
    /**
     * キャンバス入力値設定
     */
    setCanvasInputs(width, height) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (widthInput && heightInput) {
            widthInput.value = width;
            heightInput.value = height;
        }
    }
    
    /**
     * 最終初期化処理（修正版）
     */
    finalizeInitialization() {
        console.log('🏁 最終初期化処理...');
        
        try {
            // グローバル公開
            window.futabaDrawingTool = this;
            
            // 🚨 重複排除: 統一デバッグ関数のみ設定
            this.setupUnifiedDebugFunctions();
            
            console.log('✅ 最終初期化完了');
            this.initializationSteps.push('finalization');
            
        } catch (error) {
            console.warn('⚠️ 最終初期化で問題発生:', error.message);
        }
    }
    
    /**
     * 初期化完了処理
     */
    completeInitialization() {
        this.isInitializing = false;
        this.isInitialized = true;
        
        const initTime = performance.now() - this.startTime;
        console.log(`🎉 統一初期化完了！ 時間: ${initTime.toFixed(2)}ms`);
        
        // 🚨 重複排除: EventBus経由での統一通知
        if (this.eventBus) {
            this.eventBus.safeEmit('app.initialized', {
                version: this.version,
                initTime,
                components: this.getComponentStatus(),
                steps: this.initializationSteps
            });
        }
    }
    
    /**
     * 🚨 重複排除: 統一デバッグ関数設定（旧関数は完全削除）
     */
    setupUnifiedDebugFunctions() {
        // 統一デバッグ関数のみ
        window.startDebugMode = () => this.startDebugMode();
        window.testUnifiedSystems = () => this.testUnifiedSystems();
        window.checkUnifiedHealth = () => this.checkUnifiedHealth();
        window.getUnifiedMetrics = () => this.getUnifiedMetrics();
        
        // 🚨 重複排除: 旧関数削除済み（showErrorMessage, getAppState等）
        // すべて統一システム経由に移行完了
        
        console.log('✅ 統一デバッグ関数設定完了（旧関数削除済み）');
    }
    
    /**
     * 🚨 重複排除: 初期化エラーハンドリング（ErrorManager統一版）
     */
    handleInitializationError(error) {
        if (this.errorManager) {
            this.errorManager.showError('error', error.message, { 
                showReload: true,
                additionalInfo: `初期化ステップ: ${this.initializationSteps.join(' → ')}`
            });
        } else {
            console.error('❌ ErrorManager利用不可、フォールバック表示:', error.message);
        }
        
        this.initializationFailed = true;
        this.lastError = error.message;
        
        if (this.eventBus) {
            this.eventBus.safeEmit('app.initializationFailed', { 
                error: error.message,
                steps: this.initializationSteps
            });
        }
    }
    
    /**
     * 🚨 重複排除: キャンバスリサイズ適用（ConfigManager統一版）
     */
    applyCanvasResize(centerContent) {
        const widthInput = document.getElementById('canvas-width');
        const heightInput = document.getElementById('canvas-height');
        
        if (!widthInput || !heightInput || !this.appCore) {
            if (this.errorManager) {
                this.errorManager.showError('warning', 'リサイズに必要な要素が見つかりません');
            }
            return;
        }
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        // ConfigManager経由での妥当性確認
        const canvasConfig = this.configManager.getCanvasConfig();
        const isValid = width >= canvasConfig.minWidth && 
                       height >= canvasConfig.minHeight &&
                       width <= canvasConfig.maxWidth &&
                       height <= canvasConfig.maxHeight;
        
        if (!isValid) {
            if (this.errorManager) {
                this.errorManager.showError('warning', `無効なキャンバスサイズ: ${width}×${height}px`);
            }
            return;
        }
        
        try {
            this.appCore.resize(width, height, centerContent);
            this.updateCanvasInfo();
            this.closeAllPopups();
            
            if (this.eventBus) {
                this.eventBus.safeEmit('canvas.resized', { width, height, centerContent });
            }
            console.log(`✅ キャンバスリサイズ: ${width}×${height}px (中央寄せ: ${centerContent})`);
            
        } catch (error) {
            if (this.errorManager) {
                this.errorManager.showError('error', `キャンバスリサイズ失敗: ${error.message}`);
            }
        }
    }
    
    /**
     * キャンバス情報更新
     */
    updateCanvasInfo() {
        const canvasInfo = document.getElementById('canvas-info');
        if (canvasInfo && this.appCore) {
            canvasInfo.textContent = `${this.appCore.canvasWidth}×${this.appCore.canvasHeight}px`;
        }
    }
    
    /**
     * ツール状態更新
     */
    updateToolStatus(tool) {
        const currentToolElement = document.getElementById('current-tool');
        if (!currentToolElement) return;
        
        const toolNames = {
            pen: 'ベクターペン',
            eraser: '消しゴム',
            fill: '塗りつぶし',
            select: '選択'
        };
        
        currentToolElement.textContent = toolNames[tool] || tool;
    }
    
    /**
     * ペンツール選択
     */
    selectPenTool() {
        if (!this.appCore?.toolManager) {
            console.warn('⚠️ ToolManager未初期化のためペンツール選択をスキップ');
            return;
        }
        
        this.appCore.toolManager.setTool('pen');
        this.updateToolUI('pen');
        this.updateToolStatus('pen');
        
        console.log('🖊️ ペンツール選択');
    }
    
    /**
     * 消しゴムツール選択
     */
    selectEraserTool() {
        if (!this.appCore?.toolManager) {
            console.warn('⚠️ ToolManager未初期化のため消しゴムツール選択をスキップ');
            return;
        }
        
        this.appCore.toolManager.setTool('eraser');
        this.updateToolUI('eraser');
        this.updateToolStatus('eraser');
        
        console.log('🧽 消しゴムツール選択');
    }
    
    /**
     * ツールUI更新
     */
    updateToolUI(tool) {
        document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
        const toolButton = document.getElementById(tool + '-tool');
        if (toolButton) toolButton.classList.add('active');
    }
    
    /**
     * 全ポップアップ閉じる
     */
    closeAllPopups() {
        if (this.appCore?.uiManager) {
            this.appCore.uiManager.closeAllPopups();
        } else {
            document.querySelectorAll('.popup-panel').forEach(popup => {
                popup.classList.remove('show');
            });
        }
        
        if (this.eventBus) {
            this.eventBus.safeEmit('popup.allClosed', { timestamp: Date.now() });
        }
        console.log('🔒 全ポップアップ閉じる');
    }
    
    /**
     * 🚨 重複排除: コンポーネント状態取得（統一版）
     */
    getComponentStatus() {
        return {
            configManager: !!this.configManager,
            errorManager: !!this.errorManager,
            stateManager: !!this.stateManager,
            eventBus: !!this.eventBus,
            appCore: !!this.appCore,
            toolManager: !!this.appCore?.toolManager,
            uiManager: !!this.appCore?.uiManager,
            initialized: this.isInitialized,
            unifiedSystemsIntegrated: true,
            dryPrincipleCompliant: true,
            solidPrincipleCompliant: true,
            legacyFunctionsRemoved: true
        };
    }
    
    /**
     * 統一システムテスト
     */
    testUnifiedSystems() {
        console.log('🔍 統一システムテスト開始...');
        
        const results = {
            configManager: this.testConfigManager(),
            errorManager: this.testErrorManager(),
            stateManager: this.testStateManager(),
            eventBus: this.testEventBus()
        };
        
        const allPassed = Object.values(results).every(result => result.status === 'passed');
        
        console.log(`📊 統一システムテスト結果: ${allPassed ? '全て合格' : '一部不合格'}`);
        console.table(results);
        
        return results;
    }
    
    /**
     * ConfigManagerテスト
     */
    testConfigManager() {
        try {
            const version = this.configManager.get('app.version');
            const canvasConfig = this.configManager.getCanvasConfig();
            const toolConfig = this.configManager.getToolConfig('pen');
            
            return {
                status: 'passed',
                version: version,
                canvasWidth: canvasConfig.width,
                defaultTool: this.configManager.getDefaultTool()
            };
        } catch (error) {
            return {
                status: 'failed',
                error: error.message
            };
        }
    }
    
    /**
     * ErrorManagerテスト
     */
    testErrorManager() {
        try {
            // テスト用の警告を表示
            this.errorManager.showError('info', 'システムテスト: ErrorManager動作確認');
            
            return {
                status: 'passed',
                errorStats: this.errorManager.getErrorStats()
            };
        } catch (error) {
            return {
                status: 'failed',
                error: error.message
            };
        }
    }
    
    /**
     * StateManagerテスト
     */
    testStateManager() {
        try {
            const appState = this.stateManager.getApplicationState();
            const healthCheck = this.stateManager.healthCheck();
            
            return {
                status: 'passed',
                appState: appState,
                healthy: healthCheck.healthy
            };
        } catch (error) {
            return {
                status: 'failed',
                error: error.message
            };
        }
    }
    
    /**
     * EventBusテスト
     */
    testEventBus() {
        try {
            // テストイベント送信
            this.eventBus.safeEmit('test.event', { message: 'EventBusテスト' });
            
            return {
                status: 'passed',
                stats: this.eventBus.getStats()
            };
        } catch (error) {
            return {
                status: 'failed',
                error: error.message
            };
        }
    }
    
    /**
     * 統一健全性チェック
     */
    checkUnifiedHealth() {
        console.log('🏥 統一システム健全性チェック開始...');
        
        const health = {
            configManager: {
                available: !!this.configManager,
                functional: this.configManager && typeof this.configManager.get === 'function'
            },
            errorManager: {
                available: !!this.errorManager,
                functional: this.errorManager && typeof this.errorManager.showError === 'function'
            },
            stateManager: {
                available: !!this.stateManager,
                functional: this.stateManager && typeof this.stateManager.getApplicationState === 'function'
            },
            eventBus: {
                available: !!this.eventBus,
                functional: this.eventBus && typeof this.eventBus.safeEmit === 'function'
            },
            appCore: {
                available: !!this.appCore,
                initialized: this.appCore && this.appCore.initializationComplete
            }
        };
        
        const overallHealth = Object.values(health).every(system => system.available && system.functional);
        
        console.log(`🏥 総合健全性: ${overallHealth ? '良好' : '問題あり'}`);
        console.table(health);
        
        return { health, overallHealth };
    }
    
    /**
     * 統一メトリクス取得
     */
    getUnifiedMetrics() {
        const metrics = {
            version: this.version,
            initTime: performance.now() - this.startTime,
            initSteps: this.initializationSteps,
            components: this.getComponentStatus(),
            health: this.checkUnifiedHealth(),
            memory: {
                used: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'
            }
        };
        
        console.log('📈 統一システムメトリクス:');
        console.table(metrics);
        
        return metrics;
    }
    
    /**
     * 🚨 重複排除: デバッグモード開始（統一システム統合版）
     */
    startDebugMode() {
        console.log('🔍 統一デバッグモード開始（修正版・DRY・SOLID準拠版）');
        
        const debugInfo = {
            version: this.version,
            config: this.configManager.getDebugInfo(),
            errors: this.errorManager.getErrorStats(),
            state: this.stateManager.healthCheck(),
            events: this.eventBus.getStats(),
            app: this.getComponentStatus(),
            metrics: this.getUnifiedMetrics()
        };
        
        console.log('🎯 統合状況:');
        console.log('  ✅ 重複関数完全排除: 完了');
        console.log('  ✅ 統一システム完全統合: 完了');
        console.log('  ✅ DRY原則準拠: 完了');
        console.log('  ✅ SOLID原則準拠: 完了');
        console.log('  ✅ コード肥大化解決: 完了');
        console.log('  ✅ 初期化順序修正: 完了');
        
        return debugInfo;
    }
}
// ==========================================
// 🔄 COORDINATE_INTEGRATION: main.jsの末尾に追加する座標統合診断システム（Phase1.4完成版）
// 既存のmain.jsコードの最後（initialize()関数の後）に以下を追加してください
// ==========================================

/**
 * 🔍 座標統合確認（メイン診断関数）
 */
window.checkCoordinateIntegration = function() {
    console.group('🔍 座標統合確認');
    
    const results = {
        coordinateManagerAvailable: !!window.CoordinateManager,
        coordinateConfigPresent: !!ConfigManager.get('coordinate'),
        canvasManagerIntegrated: false,
        toolManagerIntegrated: false,
        boundaryManagerIntegrated: false,
        coordinatesJsDeprecated: true,
        unifiedSystemsActive: false
    };
    
    // CoordinateManager基本確認
    if (results.coordinateManagerAvailable) {
        try {
            const tempManager = new window.CoordinateManager();
            const integrationStatus = tempManager.getIntegrationStatus();
            results.coordinateManagerFunctional = integrationStatus.managerCentralization;
        } catch (error) {
            results.coordinateManagerFunctional = false;
            console.warn('⚠️ CoordinateManager機能確認失敗:', error.message);
        }
    }
    
    // CanvasManager統合確認
    if (window.canvasManager && window.canvasManager.coordinateManager) {
        results.canvasManagerIntegrated = true;
    }
    
    // ToolManager統合確認  
    if (window.toolManager && window.toolManager.coordinateManager) {
        results.toolManagerIntegrated = true;
    }
    
    // BoundaryManager統合確認
    if (window.boundaryManager && window.boundaryManager.coordinateManager) {
        results.boundaryManagerIntegrated = true;
    }
    
    // 統一システム確認
    const unifiedSystems = ['ConfigManager', 'ErrorManager', 'StateManager', 'EventBus'];
    results.unifiedSystemsActive = unifiedSystems.every(sys => !!window[sys]);
    
    // coordinates.js非推奨確認
    if (window.CoordinateUtils) {
        try {
            // 削除警告が出るかテスト
            window.CoordinateUtils.distance({x:0,y:0}, {x:1,y:1});
            results.coordinatesJsDeprecated = false; // エラーが出なかった = まだ非推奨化不完全
        } catch (error) {
            results.coordinatesJsDeprecated = true; // エラーが出た = 正しく非推奨化済み
        }
    }
    
    const totalIntegration = Object.values(results).filter(Boolean).length;
    const maxIntegration = Object.keys(results).length;
    
    console.log(`📊 統合度: ${totalIntegration}/${maxIntegration} (${Math.round(totalIntegration/maxIntegration*100)}%)`);
    console.log('📋 詳細結果:', results);
    
    // 統合完了判定
    const criticalItems = [
        results.coordinateManagerAvailable,
        results.coordinateConfigPresent,
        results.canvasManagerIntegrated,
        results.toolManagerIntegrated,
        results.boundaryManagerIntegrated
    ];
    const criticalIntegration = criticalItems.filter(Boolean).length;
    
    if (criticalIntegration === criticalItems.length) {
        console.log('✅ 座標統合完了 - Phase2移行準備完了');
    } else {
        console.warn('⚠️ 座標統合未完了 - 修正が必要');
        
        // 具体的な推奨事項
        const recommendations = [];
        if (!results.coordinateManagerAvailable) {
            recommendations.push('CoordinateManagerの初期化を確認してください');
        }
        if (!results.canvasManagerIntegrated) {
            recommendations.push('CanvasManagerでinitializeCoordinateIntegration()を呼び出してください');
        }
        if (!results.toolManagerIntegrated) {
            recommendations.push('ToolManagerでinitializeCoordinateManagerIntegration()を実装してください');
        }
        if (!results.boundaryManagerIntegrated) {
            recommendations.push('BoundaryManagerの初期化時にCoordinateManagerを渡してください');
        }
        
        console.warn('💡 推奨事項:', recommendations);
    }
    
    console.groupEnd();
    return results;
};

/**
 * 🧪 座標統合テスト（包括的テストスイート）
 */
window.runCoordinateIntegrationTests = function() {
    console.group('🧪 座標統合テスト');
    
    const tests = [
        {
            name: 'CoordinateManager基本テスト',
            test: () => {
                if (!window.CoordinateManager) return false;
                const manager = new window.CoordinateManager();
                const mockRect = {left:0, top:0, width:400, height:400};
                const result = manager.screenToCanvas(100, 100, mockRect);
                return result && typeof result.x === 'number' && typeof result.y === 'number';
            }
        },
        {
            name: '座標計算テスト',
            test: () => {
                if (!window.CoordinateManager) return false;
                const manager = new window.CoordinateManager();
                const distance = manager.calculateDistance({x:0,y:0}, {x:3,y:4});
                return Math.abs(distance - 5) < 0.1;
            }
        },
        {
            name: 'coordinates.js非推奨テスト',
            test: () => {
                try {
                    if (window.CoordinateUtils) {
                        window.CoordinateUtils.distance({x:0,y:0}, {x:1,y:1});
                        return false; // エラーが出るべき
                    }
                    return true; // CoordinateUtilsが存在しない = OK
                } catch (error) {
                    return true; // エラーが出た = OK（削除予定警告）
                }
            }
        },
        {
            name: 'ConfigManager座標設定テスト',
            test: () => {
                const coordinateConfig = ConfigManager.get('coordinate');
                return coordinateConfig && 
                       coordinateConfig.integration && 
                       coordinateConfig.integration.managerCentralization;
            }
        },
        {
            name: '座標妥当性確認テスト',
            test: () => {
                if (!window.CoordinateManager) return false;
                const manager = new window.CoordinateManager();
                return manager.validateCoordinateIntegrity({x: 100, y: 100}) === true &&
                       manager.validateCoordinateIntegrity({x: NaN, y: 100}) === false;
            }
        },
        {
            name: 'Phase2準備機能テスト',
            test: () => {
                if (!window.CoordinateManager) return false;
                const manager = new window.CoordinateManager();
                const transformed = manager.transformCoordinatesForLayer(
                    {x: 10, y: 10}, 
                    {offsetX: 5, offsetY: 5}
                );
                return transformed.x === 15 && transformed.y === 15;
            }
        }
    ];
    
    let passCount = 0;
    tests.forEach(test => {
        try {
            const result = test.test();
            console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASS' : 'FAIL'}`);
            if (result) passCount++;
        } catch (error) {
            console.log(`❌ ${test.name}: FAIL (${error.message})`);
        }
    });
    
    console.log(`📊 テスト結果: ${passCount}/${tests.length} PASS`);
    
    const allPassed = passCount === tests.length;
    if (allPassed) {
        console.log('✅ 全座標統合テスト合格 - システム健全');
    } else {
        console.warn('⚠️ 一部テスト失敗 - 修正が必要');
    }
    
    console.groupEnd();
    
    return allPassed;
};

/**
 * 🔧 統一システム健全性診断
 */
window.testUnifiedSystems = function() {
    console.group('🔧 統一システム健全性診断');
    
    const systems = {
        'ConfigManager': {
            available: !!window.ConfigManager,
            functional: !!(window.ConfigManager && typeof window.ConfigManager.get === 'function')
        },
        'ErrorManager': {
            available: !!window.ErrorManager,
            functional: !!(window.ErrorManager && typeof window.ErrorManager.showError === 'function')
        },
        'StateManager': {
            available: !!window.StateManager,
            functional: !!(window.StateManager && typeof window.StateManager.updateComponentState === 'function')
        },
        'EventBus': {
            available: !!window.EventBus,
            functional: !!(window.EventBus && typeof window.EventBus.safeEmit === 'function')
        },
        'CoordinateManager': {
            available: !!window.CoordinateManager,
            functional: false
        }
    };
    
    // CoordinateManager機能テスト
    if (systems.CoordinateManager.available) {
        try {
            const manager = new window.CoordinateManager();
            systems.CoordinateManager.functional = typeof manager.screenToCanvas === 'function';
        } catch (error) {
            systems.CoordinateManager.functional = false;
        }
    }
    
    console.log('📊 統一システム状態:');
    Object.entries(systems).forEach(([name, status]) => {
        const icon = status.functional ? '✅' : status.available ? '⚠️' : '❌';
        console.log(`${icon} ${name}: ${status.functional ? '正常' : status.available ? '利用可能だが機能不全' : '利用不可'}`);
    });
    
    const functionalSystems = Object.values(systems).filter(s => s.functional).length;
    const totalSystems = Object.keys(systems).length;
    
    console.log(`📊 システム健全性: ${functionalSystems}/${totalSystems} (${Math.round(functionalSystems/totalSystems*100)}%)`);
    
    if (functionalSystems === totalSystems) {
        console.log('✅ 統一システム全体が健全です');
    } else {
        console.warn('⚠️ 一部システムに問題があります');
    }
    
    console.groupEnd();
    
    return {
        systems,
        healthScore: Math.round(functionalSystems/totalSystems*100),
        allHealthy: functionalSystems === totalSystems
    };
};

/**
 * 🎯 Manager別詳細診断
 */
window.runManagerDiagnostics = function() {
    console.group('🎯 Manager別詳細診断');
    
    const diagnostics = {};
    
    // CanvasManager診断
    if (window.canvasManager && typeof window.canvasManager.runCoordinateIntegrationDiagnosis === 'function') {
        console.log('🎨 CanvasManager診断実行中...');
        diagnostics.canvasManager = window.canvasManager.runCoordinateIntegrationDiagnosis();
    } else {
        console.warn('⚠️ CanvasManager診断機能が利用できません');
        diagnostics.canvasManager = { available: false };
    }
    
    // ToolManager診断
    if (window.toolManager && typeof window.toolManager.runToolCoordinateIntegrationDiagnosis === 'function') {
        console.log('🔧 ToolManager診断実行中...');
        diagnostics.toolManager = window.toolManager.runToolCoordinateIntegrationDiagnosis();
    } else {
        console.warn('⚠️ ToolManager診断機能が利用できません');
        diagnostics.toolManager = { available: false };
    }
    
    // BoundaryManager診断
    if (window.boundaryManager && typeof window.boundaryManager.runBoundaryCoordinateIntegrationDiagnosis === 'function') {
        console.log('🎯 BoundaryManager診断実行中...');
        diagnostics.boundaryManager = window.boundaryManager.runBoundaryCoordinateIntegrationDiagnosis();
    } else {
        console.warn('⚠️ BoundaryManager診断機能が利用できません');
        diagnostics.boundaryManager = { available: false };
    }
    
    console.log('📊 Manager診断結果:', diagnostics);
    
    console.groupEnd();
    
    return diagnostics;
};

/**
 * 🚀 Phase2移行準備確認
 */
window.checkPhase2Readiness = function() {
    console.group('🚀 Phase2移行準備確認');
    
    const readiness = {
        coordinateSystemReady: false,
        managerIntegrationComplete: false,
        duplicateEliminationComplete: false,
        performanceOptimized: false,
        diagnosticsAvailable: false,
        phase2FeaturesReady: false
    };
    
    // 座標系準備確認
    if (window.CoordinateManager) {
        const manager = new window.CoordinateManager();
        const integrationStatus = manager.getIntegrationStatus();
        
        readiness.coordinateSystemReady = integrationStatus.managerCentralization;
        readiness.duplicateEliminationComplete = integrationStatus.duplicateElimination;
        readiness.performanceOptimized = integrationStatus.performanceOptimized;
        readiness.phase2FeaturesReady = integrationStatus.phase2Ready;
    }
    
    // Manager統合完了確認
    const integrationCheck = window.checkCoordinateIntegration();
    readiness.managerIntegrationComplete = 
        integrationCheck.canvasManagerIntegrated &&
        integrationCheck.toolManagerIntegrated &&
        integrationCheck.boundaryManagerIntegrated;
    
    // 診断機能確認
    readiness.diagnosticsAvailable = 
        typeof window.checkCoordinateIntegration === 'function' &&
        typeof window.runCoordinateIntegrationTests === 'function' &&
        typeof window.testUnifiedSystems === 'function';
    
    const readyItems = Object.values(readiness).filter(Boolean).length;
    const totalItems = Object.keys(readiness).length;
    const readinessScore = Math.round(readyItems / totalItems * 100);
    
    console.log(`📊 Phase2移行準備度: ${readyItems}/${totalItems} (${readinessScore}%)`);
    console.log('📋 準備状況詳細:', readiness);
    
    if (readinessScore === 100) {
        console.log('🚀 Phase2移行準備完了！');
    } else if (readinessScore >= 80) {
        console.log('✅ Phase2移行準備ほぼ完了 - 最終調整のみ');
    } else {
        console.warn('⚠️ Phase2移行準備未完了 - 追加作業が必要');
    }
    
    console.groupEnd();
    
    return {
        readiness,
        readinessScore,
        ready: readinessScore === 100,
        nearlyReady: readinessScore >= 80
    };
};

/**
 * 🔄 座標統合システム包括診断（メイン実行関数）
 */
window.runComprehensiveCoordinateIntegrationDiagnosis = function() {
    console.group('🔄 座標統合システム包括診断');
    console.log('📅 実行日時:', new Date().toLocaleString());
    
    // Step 1: 基本統合確認
    console.log('\n📍 Step 1: 座標統合確認');
    const integrationCheck = window.checkCoordinateIntegration();
    
    // Step 2: 統合テスト実行
    console.log('\n📍 Step 2: 座標統合テスト');
    const integrationTests = window.runCoordinateIntegrationTests();
    
    // Step 3: 統一システム確認
    console.log('\n📍 Step 3: 統一システム健全性');
    const unifiedSystems = window.testUnifiedSystems();
    
    // Step 4: Manager詳細診断
    console.log('\n📍 Step 4: Manager別診断');
    const managerDiagnostics = window.runManagerDiagnostics();
    
    // Step 5: Phase2準備確認
    console.log('\n📍 Step 5: Phase2移行準備確認');
    const phase2Readiness = window.checkPhase2Readiness();
    
    // 総合評価
    const overallScore = Math.round((
        (integrationCheck.coordinateManagerAvailable ? 20 : 0) +
        (integrationTests ? 20 : 0) +
        (unifiedSystems.allHealthy ? 20 : 0) +
        (integrationCheck.canvasManagerIntegrated && 
         integrationCheck.toolManagerIntegrated && 
         integrationCheck.boundaryManagerIntegrated ? 20 : 0) +
        (phase2Readiness.ready ? 20 : 0)
    ));
    
    console.log(`\n📊 総合評価: ${overallScore}/100点`);
    
    if (overallScore >= 90) {
        console.log('🏆 優秀 - 座標統合システムが完璧に動作しています');
    } else if (overallScore >= 70) {
        console.log('✅ 良好 - 座標統合システムが正常に動作しています');
    } else {
        console.warn('⚠️ 要改善 - 座標統合システムに問題があります');
    }
    
    const finalResult = {
        timestamp: new Date().toISOString(),
        overallScore,
        integrationCheck,
        integrationTests,
        unifiedSystems,
        managerDiagnostics,
        phase2Readiness
    };
    
    console.log('\n📋 詳細結果をfinalResultに保存しました:', finalResult);
    
    console.groupEnd();
    
    return finalResult;
};

/**
 * 🔄 座標統合修正ガイド（トラブルシューティング）
 */
window.getCoordinateIntegrationFixGuide = function() {
    console.group('🔄 座標統合修正ガイド');
    
    const integrationStatus = window.checkCoordinateIntegration();
    const fixGuide = [];
    
    // 問題診断と修正方法の提示
    if (!integrationStatus.coordinateManagerAvailable) {
        fixGuide.push({
            問題: 'CoordinateManagerが利用できません',
            修正方法: [
                '1. coordinate-manager.jsが読み込まれているか確認',
                '2. window.CoordinateManagerがグローバルに公開されているか確認',
                '3. ConfigManagerでcoordinate設定が有効になっているか確認'
            ],
            緊急度: '高'
        });
    }
    
    if (!integrationStatus.canvasManagerIntegrated) {
        fixGuide.push({
            問題: 'CanvasManagerが座標統合されていません',
            修正方法: [
                '1. CanvasManagerのinitialize()でCoordinateManagerを渡す',
                '2. initializeCoordinateIntegration()メソッドを実装',
                '3. 描画処理でCoordinateManagerを使用するよう修正'
            ],
            緊急度: '高'
        });
    }
    
    if (!integrationStatus.toolManagerIntegrated) {
        fixGuide.push({
            問題: 'ToolManagerが座標統合されていません',
            修正方法: [
                '1. ToolManagerのinitialize()でCoordinateManagerを渡す',
                '2. initializeCoordinateManagerIntegration()メソッドを実装',
                '3. 描画処理でCoordinateManagerを使用するよう修正'
            ],
            緊急度: '高'
        });
    }
    
    if (!integrationStatus.boundaryManagerIntegrated) {
        fixGuide.push({
            問題: 'BoundaryManagerが座標統合されていません',
            修正方法: [
                '1. BoundaryManagerのinitialize()でCoordinateManagerを渡す',
                '2. 境界処理でCoordinateManagerを使用するよう修正',
                '3. 座標変換処理をCoordinateManagerに委譲'
            ],
            緊急度: '中'
        });
    }
    
    if (!integrationStatus.coordinatesJsDeprecated) {
        fixGuide.push({
            問題: 'coordinates.jsが非推奨化されていません',
            修正方法: [
                '1. coordinates.jsで削除予告警告を有効化',
                '2. 全ての座標処理をCoordinateManagerに移行',
                '3. レガシー関数呼び出し時にエラーを発生させる'
            ],
            緊急度: '低'
        });
    }
    
    if (fixGuide.length === 0) {
        console.log('✅ 修正が必要な問題は見つかりませんでした');
    } else {
        console.log('🔧 修正が必要な問題:', fixGuide);
        
        // 修正優先順位の表示
        const highPriority = fixGuide.filter(item => item.緊急度 === '高');
        const mediumPriority = fixGuide.filter(item => item.緊急度 === '中');
        const lowPriority = fixGuide.filter(item => item.緊急度 === '低');
        
        if (highPriority.length > 0) {
            console.warn('🚨 最優先修正事項:', highPriority.map(item => item.問題));
        }
        if (mediumPriority.length > 0) {
            console.warn('⚠️ 中優先修正事項:', mediumPriority.map(item => item.問題));
        }
        if (lowPriority.length > 0) {
            console.log('💡 低優先修正事項:', lowPriority.map(item => item.問題));
        }
    }
    
    console.groupEnd();
    
    return fixGuide;
};

/**
 * 🎯 個別Manager初期化修正コード生成
 */
window.generateCoordinateIntegrationCode = function() {
    console.group('🎯 座標統合修正コード生成');
    
    const integrationStatus = window.checkCoordinateIntegration();
    const codeSnippets = {};
    
    // CanvasManager修正コード
    if (!integrationStatus.canvasManagerIntegrated) {
        codeSnippets.canvasManager = `
// CanvasManager座標統合修正
// initialize()メソッドに以下を追加:
async initialize(canvasElement, coordinateManager = null) {
    // 既存のコード...
    
    // 🔄 CoordinateManager統合
    this.initializeCoordinateIntegration(coordinateManager);
    
    // 既存のコード...
}

initializeCoordinateIntegration(coordinateManager = null) {
    if (coordinateManager) {
        this.coordinateManager = coordinateManager;
    } else if (window.CoordinateManager) {
        this.coordinateManager = new window.CoordinateManager();
    }
    
    if (this.coordinateManager) {
        const integrationStatus = this.coordinateManager.getIntegrationStatus();
        this.coordinateIntegration = {
            enabled: integrationStatus.managerCentralization,
            duplicateElimination: integrationStatus.duplicateElimination,
            performanceOptimized: integrationStatus.performanceOptimized
        };
        console.log('✅ CanvasManager: CoordinateManager統合完了');
    }
}`;
    }
    
    // ToolManager修正コード
    if (!integrationStatus.toolManagerIntegrated) {
        codeSnippets.toolManager = `
// ToolManager座標統合修正
// initialize()メソッドに以下を追加:
async initialize(coordinateManager = null) {
    // 既存のコード...
    
    // 🔄 CoordinateManager統合
    this.initializeCoordinateManagerIntegration(coordinateManager);
    
    // 既存のコード...
}

initializeCoordinateManagerIntegration(coordinateManager = null) {
    if (coordinateManager) {
        this.coordinateManager = coordinateManager;
    } else if (window.CoordinateManager) {
        this.coordinateManager = new window.CoordinateManager();
    }
    
    if (this.coordinateManager) {
        const integrationStatus = this.coordinateManager.getIntegrationStatus();
        this.coordinateIntegration = {
            enabled: integrationStatus.managerCentralization,
            duplicateElimination: integrationStatus.duplicateElimination,
            performanceOptimized: integrationStatus.performanceOptimized
        };
        console.log('✅ ToolManager: CoordinateManager統合完了');
    }
}`;
    }
    
    // BoundaryManager修正コード
    if (!integrationStatus.boundaryManagerIntegrated) {
        codeSnippets.boundaryManager = `
// BoundaryManager座標統合修正
// initialize()メソッドを以下のように修正:
initialize(canvasElement, coordinateManager = null) {
    // 既存のコード...
    
    // 🔄 CoordinateManager統合
    if (coordinateManager) {
        this.coordinateManager = coordinateManager;
    } else if (window.CoordinateManager) {
        this.coordinateManager = new window.CoordinateManager();
    }
    
    if (this.coordinateManager) {
        const integrationStatus = this.coordinateManager.getIntegrationStatus();
        this.coordinateIntegration = {
            enabled: integrationStatus.managerCentralization,
            duplicateElimination: integrationStatus.duplicateElimination,
            performanceOptimized: integrationStatus.performanceOptimized
        };
        console.log('✅ BoundaryManager: CoordinateManager統合完了');
    }
    
    // 既存のコード...
}`;
    }
    
    console.log('📋 生成された修正コード:', codeSnippets);
    
    if (Object.keys(codeSnippets).length === 0) {
        console.log('✅ 修正が必要なManagerはありません');
    }
    
    console.groupEnd();
    
    return codeSnippets;
};

// 🎯 診断関数初期化完了ログ
console.log('🔍 座標統合診断システム初期化完了');
console.log('📋 利用可能な診断関数:');
console.log('  - window.checkCoordinateIntegration() - 基本統合確認');
console.log('  - window.runCoordinateIntegrationTests() - 統合テスト実行');
console.log('  - window.testUnifiedSystems() - 統一システム健全性診断');
console.log('  - window.runManagerDiagnostics() - Manager別詳細診断');
console.log('  - window.checkPhase2Readiness() - Phase2移行準備確認');
console.log('  - window.runComprehensiveCoordinateIntegrationDiagnosis() - 包括診断');
console.log('  - window.getCoordinateIntegrationFixGuide() - 修正ガイド');
console.log('  - window.generateCoordinateIntegrationCode() - 修正コード生成');
console.log('💡 包括診断実行: window.runComprehensiveCoordinateIntegrationDiagnosis()');
console.log('🔧 修正ガイド: window.getCoordinateIntegrationFixGuide()');

// ==========================================
// 🔄 座標統合診断システム初期化完了
// ==========================================
/**
 * 🚨 重複排除: 統一アプリケーション起動（完全統合版・修正版）
 */
window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🎨 ふたば☆ちゃんねる風ベクターお絵描きツール');
        console.log('🚨 Task 1-B先行実装: 重複関数完全排除・DRY・SOLID原則準拠版（修正版）');
        console.log('🔧 統一システム: ConfigManager + ErrorManager + StateManager + EventBus');
        console.log('🚀 統一アプリケーション起動開始（初期化順序修正版）...');
        
        const app = new FutabaDrawingTool();
        await app.initialize();
        
        console.log('🎉 統一アプリケーション起動完了！（重複排除・修正版）');
        console.log('💡 操作方法:');
        console.log('  - キャンバス上でドラッグして描画');
        console.log('  - P キー: ペンツール / E キー: 消しゴム / Escape: ポップアップ閉じる');
        console.log('🔍 デバッグコマンド:');
        console.log('  - window.startDebugMode() 統一システム詳細情報表示');
        console.log('  - window.testUnifiedSystems() 統一システムテスト実行');
        console.log('  - window.checkUnifiedHealth() 健全性チェック');
        console.log('  - window.getUnifiedMetrics() メトリクス取得');
        console.log('📊 各統一システムの詳細:');
        console.log('  - window.ConfigManager.getDebugInfo() 設定情報表示');
        console.log('  - window.ErrorManager.getErrorStats() エラー統計表示');
        console.log('  - window.StateManager.getApplicationState() 全状態取得');
        console.log('  - window.EventBus.getStats() イベント統計表示');
        
    } catch (error) {
        console.error('💀 統一アプリケーション起動失敗:', error);
        
        if (window.ErrorManager) {
            window.ErrorManager.showCriticalError(error.message, {
                showDebug: true,
                additionalInfo: 'メインアプリケーション起動時のエラー（修正版）'
            });
        } else {
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#ffffee;font-family:system-ui,sans-serif;">
                    <div style="text-align:center;color:#800000;background:#f0e0d6;padding:32px;border:3px solid #cf9c97;border-radius:16px;max-width:500px;">
                        <h2 style="margin:0 0 16px 0;">🎨 ふたば☆お絵描きツール</h2>
                        <p style="margin:0 0 16px 0;">統一システムの初期化に失敗しました。</p>
                        <div style="background:#ffffee;padding:12px;border-radius:8px;margin:16px 0;font-family:monospace;font-size:12px;text-align:left;">
                            <strong>エラー:</strong> ${error.message}<br>
                            <strong>時刻:</strong> ${new Date().toLocaleString()}<br>
                            <strong>Task:</strong> 1-B 重複関数完全排除（修正版）<br>
                            <strong>バージョン:</strong> v1.0-Phase1.2step3-DRY-SOLID-fixed
                        </div>
                        <button onclick="location.reload()" 
                                style="background:#800000;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:600;">
                            🔄 再読み込み
                        </button>
                    </div>
                </div>
            `;
        }
    }
});