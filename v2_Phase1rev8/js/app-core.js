/**
 * 🎯 AppCore - アプリケーションコア統合システム (Phase1 ConfigManager統合確実化版)
 * 🔄 CORE_FUNCTION: 統合管理・初期化・統一システム調整
 * 📋 RESPONSIBILITY: 「アプリケーション全体」の統合管理
 * 
 * 📏 DESIGN_PRINCIPLE: 統一システム基盤・Manager統合・Tool配信制御
 * 🚫 DRAWING_PROHIBITION: 直接描画処理は禁止 - CanvasManager/Tool委譲
 * ✅ INTEGRATION_AUTHORITY: Manager間統合・初期化順序制御
 * 
 * ✨ Phase1修正内容:
 * - ConfigManager → CanvasManager 統合の確実化
 * - キャンバス出現警告の完全解消
 * - 初期化順序の最適化
 * - エラーループ防止機能強化
 * 
 * 📋 参考定義:
 * - ルールブック: 統合システム運用規約
 * - シンボル辞典: Manager系API - 統合制御API群
 * - 手順書: Phase 1: 緊急修復（基本動作復旧）
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class AppCore {
    constructor() {
        this.initialized = false;
        this.initializationAttempted = false;
        this.errorLoopPrevention = false;
        
        // 統一システム参照
        this.configManager = null;
        this.errorManager = null;
        this.stateManager = null;
        this.eventBus = null;
        
        // 専門Manager参照
        this.coordinateManager = null;
        this.canvasManager = null;
        this.toolManager = null;
        this.uiManager = null;
        
        // PixiJS Application参照
        this.app = null;
        
        // 初期化状態管理
        this.initializationState = {
            unifiedSystems: false,
            specializedManagers: false,
            pixiApplication: false,
            canvasIntegration: false,
            toolRegistration: false,
            complete: false
        };
        
        console.log('🎯 AppCore インスタンス作成完了（Phase1 ConfigManager統合確実化版）');
    }

    /**
     * AppCore初期化（Phase1修正版）
     */
    async initialize() {
        try {
            console.log('🎯 AppCore初期化開始（Phase1 ConfigManager統合確実化版）...');
            
            if (this.initializationAttempted) {
                console.warn('⚠️ AppCore初期化は既に試行済み - 重複実行防止');
                return this.initialized;
            }
            this.initializationAttempted = true;

            // STEP 1: 統一システム初期化（ConfigManager優先）
            await this.initializeUnifiedSystems();
            
            // STEP 2: 専門Manager初期化（UIManagerを後回しに）
            await this.initializeSpecializedManagers();
            
            // STEP 3: PixiJS Application作成
            await this.initializePixiApplication();
            
            // STEP 4: キャンバス統合（ConfigManager統合確実化）
            await this.integrateCanvas();
            
            // STEP 5: ツール登録
            await this.registerTools();
            
            // STEP 6: UI初期化（最後に実行）
            await this.initializeUI();
            
            this.initialized = true;
            this.initializationState.complete = true;
            
            // 初期化完了通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('appCore.initialized', {
                    managers: this.getManagerStatus(),
                    pixiApp: !!this.app
                });
            }
            
            console.log('✅ AppCore初期化完了（Phase1 ConfigManager統合確実化版）');
            return true;
            
        } catch (error) {
            console.error('❌ AppCore初期化失敗:', error);
            
            // エラー表示（ループ防止付き）
            if (this.errorManager?.showError && !this.errorLoopPrevention) {
                this.errorLoopPrevention = true;
                this.errorManager.showError('error', `AppCore初期化失敗: ${error.message}`, {
                    context: 'AppCore.initialize',
                    showReload: true,
                    nonCritical: false
                });
                
                // 5秒後にループ防止フラグをリセット
                setTimeout(() => {
                    this.errorLoopPrevention = false;
                }, 5000);
            }
            
            // 基本フォールバック実行
            await this.executeEmergencyFallback();
            return false;
        }
    }

    /**
     * STEP 1: 統一システム初期化（ConfigManager優先強化版）
     */
    async initializeUnifiedSystems() {
        try {
            console.log('🔧 統一システム初期化中...');
            
            // ConfigManager（最優先・確実な初期化）
            this.configManager = window.Tegaki?.ConfigManagerInstance;
            if (!this.configManager && window.Tegaki?.ConfigManager) {
                this.configManager = new window.Tegaki.ConfigManager();
                window.Tegaki.ConfigManagerInstance = this.configManager;
                console.log('✅ ConfigManager新規作成完了');
            } else if (this.configManager) {
                console.log('✅ ConfigManager既存インスタンス取得');
            }

            // ConfigManager機能確認（Phase1重要）
            if (this.configManager) {
                const hasCanvasConfig = typeof this.configManager.getCanvasConfig === 'function';
                const hasPixiConfig = typeof this.configManager.getPixiConfig === 'function';
                
                console.log('🔧 ConfigManager機能確認:', {
                    hasCanvasConfig,
                    hasPixiConfig,
                    ready: hasCanvasConfig && hasPixiConfig
                });
            }

            // ErrorManager
            this.errorManager = window.Tegaki?.ErrorManagerInstance;
            if (!this.errorManager && window.Tegaki?.ErrorManager) {
                this.errorManager = new window.Tegaki.ErrorManager();
                window.Tegaki.ErrorManagerInstance = this.errorManager;
            }

            // StateManager
            this.stateManager = window.Tegaki?.StateManagerInstance;
            if (!this.stateManager && window.Tegaki?.StateManager) {
                this.stateManager = new window.Tegaki.StateManager();
                window.Tegaki.StateManagerInstance = this.stateManager;
            }

            // EventBus
            this.eventBus = window.Tegaki?.EventBusInstance;
            if (!this.eventBus && window.Tegaki?.EventBus) {
                this.eventBus = new window.Tegaki.EventBus();
                window.Tegaki.EventBusInstance = this.eventBus;
            }

            this.initializationState.unifiedSystems = true;
            console.log('✅ 統一システム初期化完了:', {
                configManager: !!this.configManager,
                configManagerFunctions: !!(this.configManager?.getCanvasConfig && this.configManager?.getPixiConfig),
                errorManager: !!this.errorManager,
                stateManager: !!this.stateManager,
                eventBus: !!this.eventBus
            });

        } catch (error) {
            console.error('❌ 統一システム初期化エラー:', error);
            throw new Error(`統一システム初期化失敗: ${error.message}`);
        }
    }

    /**
     * STEP 2: 専門Manager初期化（UIManager除く）
     */
    async initializeSpecializedManagers() {
        try {
            console.log('🎯 専門Manager初期化中...');

            // CoordinateManager
            this.coordinateManager = window.Tegaki?.CoordinateManagerInstance;
            if (!this.coordinateManager && window.Tegaki?.CoordinateManager) {
                this.coordinateManager = new window.Tegaki.CoordinateManager();
                window.Tegaki.CoordinateManagerInstance = this.coordinateManager;
            }

            // CanvasManager（後で統合するため、インスタンスのみ取得）
            this.canvasManager = window.Tegaki?.CanvasManagerInstance;
            if (!this.canvasManager && window.Tegaki?.CanvasManager) {
                this.canvasManager = new window.Tegaki.CanvasManager();
                window.Tegaki.CanvasManagerInstance = this.canvasManager;
            }

            // ToolManager
            this.toolManager = window.Tegaki?.ToolManagerInstance;
            if (!this.toolManager && window.Tegaki?.ToolManager) {
                this.toolManager = new window.Tegaki.ToolManager();
                window.Tegaki.ToolManagerInstance = this.toolManager;
            }

            // UIManagerは後で初期化（STEP 6）

            this.initializationState.specializedManagers = true;
            console.log('✅ 専門Manager初期化完了:', {
                coordinateManager: !!this.coordinateManager,
                canvasManager: !!this.canvasManager,
                toolManager: !!this.toolManager
            });

        } catch (error) {
            console.error('❌ 専門Manager初期化エラー:', error);
            throw new Error(`専門Manager初期化失敗: ${error.message}`);
        }
    }

    /**
     * STEP 3: PixiJS Application初期化
     */
    async initializePixiApplication() {
        try {
            console.log('🎨 PixiJS Application初期化中...');

            if (!window.PIXI) {
                throw new Error('PIXIライブラリが利用できません');
            }

            // ConfigManagerから設定取得（Phase1重要）
            let config = {
                width: 400,
                height: 400,
                backgroundColor: 0xffffee, // ふたば風背景
                antialias: true
            };

            if (this.configManager?.getCanvasConfig) {
                const canvasConfig = this.configManager.getCanvasConfig();
                const pixiConfig = this.configManager.getPixiConfig();
                
                config = {
                    width: canvasConfig.width || 400,
                    height: canvasConfig.height || 400,
                    backgroundColor: pixiConfig.backgroundColor || 0xffffee,
                    antialias: pixiConfig.antialias !== undefined ? pixiConfig.antialias : true,
                    resolution: pixiConfig.resolution || window.devicePixelRatio || 1,
                    autoDensity: pixiConfig.autoDensity !== undefined ? pixiConfig.autoDensity : true
                };
                
                console.log('✅ ConfigManager設定適用:', config);
            } else {
                console.warn('⚠️ ConfigManager設定取得不可 - デフォルト設定使用');
            }

            // PIXI.Application作成
            this.app = new PIXI.Application(config);

            this.initializationState.pixiApplication = true;
            console.log('✅ PixiJS Application作成完了:', {
                width: this.app.screen.width,
                height: this.app.screen.height,
                backgroundColor: config.backgroundColor
            });

        } catch (error) {
            console.error('❌ PixiJS Application初理化エラー:', error);
            throw new Error(`PixiJS Application初期化失敗: ${error.message}`);
        }
    }

    /**
     * STEP 4: キャンバス統合（ConfigManager統合確実化版）
     */
    async integrateCanvas() {
        try {
            console.log('🎨 キャンバス統合中（ConfigManager統合確実化版）...');

            // canvas-container要素を優先使用
            let canvasElement = document.getElementById('canvas-container');
            
            if (!canvasElement) {
                // フォールバック検索
                canvasElement = document.getElementById('drawing-canvas') ||
                               document.querySelector('canvas') ||
                               document.querySelector('.canvas-area');
            }

            if (!canvasElement) {
                console.warn('⚠️ キャンバス要素が見つかりません - 動的作成');
                canvasElement = this.createFallbackCanvasContainer();
            }

            if (!canvasElement) {
                throw new Error('キャンバス要素の作成に失敗しました');
            }

            // CanvasManager初期化（ConfigManager統合確実化）
            if (this.canvasManager && typeof this.canvasManager.initialize === 'function') {
                console.log('🔧 CanvasManager初期化開始 - ConfigManager統合付き');
                
                const success = await this.canvasManager.initialize({
                    appCore: this,                    // AppCore参照
                    canvasElement: canvasElement,     // キャンバス要素
                    config: {
                        configManager: this.configManager,  // ConfigManager直接渡し（重要）
                        // 追加設定があれば here
                    }
                });

                if (!success) {
                    throw new Error('CanvasManager初期化に失敗しました');
                }
                
                console.log('✅ CanvasManager初理化完了 - ConfigManager統合済み');
            } else {
                console.warn('⚠️ CanvasManager利用不可 - 緊急フォールバック実行');
                await this.executeCanvasEmergencyFallback(canvasElement);
            }

            this.initializationState.canvasIntegration = true;
            console.log('✅ キャンバス統合完了');

        } catch (error) {
            console.error('❌ キャンバス統合エラー:', error);
            
            // 緊急フォールバック実行
            await this.executeCanvasEmergencyFallback();
        }
    }

    /**
     * フォールバック用キャンバスコンテナ作成
     */
    createFallbackCanvasContainer() {
        try {
            const container = document.createElement('div');
            container.id = 'canvas-container';
            container.style.cssText = `
                width: 400px;
                height: 400px;
                margin: 0 auto;
                background-color: #ffffee;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            `;
            
            // メイン領域を探して挿入
            const canvasArea = document.querySelector('.canvas-area') || 
                              document.querySelector('.main-layout') ||
                              document.body;
            canvasArea.appendChild(container);
            
            console.log('✅ フォールバックキャンバスコンテナ作成完了');
            return container;
            
        } catch (error) {
            console.error('❌ フォールバックキャンバスコンテナ作成失敗:', error);
            return null;
        }
    }

    /**
     * キャンバス緊急フォールバック
     */
    async executeCanvasEmergencyFallback(targetElement = null) {
        try {
            console.log('🛡️ キャンバス緊急フォールバック実行...');
            
            // 最小限のキャンバス表示
            let container = targetElement || 
                           document.getElementById('canvas-container') || 
                           this.createFallbackCanvasContainer();
            
            if (container && this.app) {
                // 既存のcanvasがあれば削除
                const existingCanvas = container.querySelector('canvas');
                if (existingCanvas) {
                    existingCanvas.remove();
                }
                
                // PIXIキャンバスを直接追加
                container.appendChild(this.app.view);
                this.app.view.style.cursor = 'crosshair';
                this.app.view.style.display = 'block';
                
                this.initializationState.canvasIntegration = true;
                console.log('✅ キャンバス緊急フォールバック完了');
            } else {
                throw new Error('緊急フォールバックも失敗しました');
            }
            
        } catch (error) {
            console.error('❌ キャンバス緊急フォールバック失敗:', error);
        }
    }

    /**
     * STEP 5: ツール登録
     */
    async registerTools() {
        try {
            console.log('🔧 ツール登録中...');

            if (!this.toolManager) {
                console.warn('⚠️ ToolManager利用不可 - ツール登録スキップ');
                return;
            }

            // ペンツール登録
            if (window.Tegaki?.PenTool || window.PenTool) {
                const PenToolClass = window.Tegaki?.PenTool || window.PenTool;
                const penTool = new PenToolClass();
                
                if (typeof this.toolManager.registerTool === 'function') {
                    this.toolManager.registerTool('pen', penTool);
                    console.log('✅ ペンツール登録完了');
                }
            }

            // 消しゴムツール登録
            if (window.Tegaki?.EraserTool || window.EraserTool) {
                const EraserToolClass = window.Tegaki?.EraserTool || window.EraserTool;
                const eraserTool = new EraserToolClass();
                
                if (typeof this.toolManager.registerTool === 'function') {
                    this.toolManager.registerTool('eraser', eraserTool);
                    console.log('✅ 消しゴムツール登録完了');
                }
            }

            // デフォルトツール設定
            if (typeof this.toolManager.setTool === 'function') {
                this.toolManager.setTool('pen');
            }

            this.initializationState.toolRegistration = true;
            console.log('✅ ツール登録完了');

        } catch (error) {
            console.error('❌ ツール登録エラー:', error);
            // ツール登録は非致命的なので継続
        }
    }

    /**
     * STEP 6: UI初期化（最後に実行）
     */
    async initializeUI() {
        try {
            console.log('🎨 UI初期化中...');

            // UIManager初期化（依存関係が整った後に実行）
            this.uiManager = window.Tegaki?.UIManagerInstance;
            if (!this.uiManager && window.Tegaki?.UIManager) {
                this.uiManager = new window.Tegaki.UIManager();
                window.Tegaki.UIManagerInstance = this.uiManager;
            }

            if (this.uiManager && typeof this.uiManager.initialize === 'function') {
                this.uiManager.initialize();
                console.log('✅ UIManager初期化完了');
            } else {
                console.warn('⚠️ UIManager利用不可 - 基本UI機能のみ');
            }

        } catch (error) {
            console.error('❌ UI初期化エラー:', error);
            // UI初期化は非致命的なので継続
        }
    }

    /**
     * 緊急フォールバック実行
     */
    async executeEmergencyFallback() {
        try {
            console.log('🛡️ 緊急フォールバック実行...');
            
            // 最小限のPixi Applicationとキャンバス表示のみ実行
            if (window.PIXI && !this.app) {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
            }
            
            if (this.app) {
                let container = document.getElementById('canvas-container');
                if (!container) {
                    container = this.createFallbackCanvasContainer();
                }
                
                if (container && !container.querySelector('canvas')) {
                    container.appendChild(this.app.view);
                    this.app.view.style.cursor = 'crosshair';
                    console.log('✅ 緊急フォールバック - 基本キャンバス表示完了');
                }
            }
            
        } catch (error) {
            console.error('❌ 緊急フォールバック失敗:', error);
        }
    }

    // ========================================
    // アクセサ・診断メソッド
    // ========================================

    /**
     * Manager状態取得
     */
    getManagerStatus() {
        return {
            configManager: !!this.configManager,
            configManagerFunctions: !!(this.configManager?.getCanvasConfig && this.configManager?.getPixiConfig),
            errorManager: !!this.errorManager,
            stateManager: !!this.stateManager,
            eventBus: !!this.eventBus,
            coordinateManager: !!this.coordinateManager,
            canvasManager: !!this.canvasManager,
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager,
            pixiApp: !!this.app
        };
    }

    /**
     * 初期化状態取得
     */
    getInitializationState() {
        return { ...this.initializationState };
    }

    /**
     * ConfigManager統合状態取得（Phase1診断）
     */
    getConfigManagerIntegrationState() {
        return {
            configManagerAvailable: !!this.configManager,
            hasGetCanvasConfig: !!(this.configManager?.getCanvasConfig),
            hasGetPixiConfig: !!(this.configManager?.getPixiConfig),
            canvasManagerIntegrated: !!this.canvasManager,
            integrationReady: !!(this.configManager?.getCanvasConfig && 
                                this.configManager?.getPixiConfig && 
                                this.canvasManager),
            pixiAppWithConfigApplied: !!(this.app && this.configManager?.getCanvasConfig)
        };
    }

    /**
     * 診断情報取得
     */
    getDiagnosticInfo() {
        return {
            initialized: this.initialized,
            initializationAttempted: this.initializationAttempted,
            initializationState: this.getInitializationState(),
            managerStatus: this.getManagerStatus(),
            configManagerIntegration: this.getConfigManagerIntegrationState(),
            pixiInfo: {
                available: !!window.PIXI,
                appCreated: !!this.app,
                canvasAttached: !!document.querySelector('canvas')
            }
        };
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            // PixiJS破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }

            // Manager参照クリア
            this.configManager = null;
            this.errorManager = null;
            this.stateManager = null;
            this.eventBus = null;
            this.coordinateManager = null;
            this.canvasManager = null;
            this.toolManager = null;
            this.uiManager = null;

            // 状態リセット
            this.initialized = false;
            this.initializationAttempted = false;
            this.errorLoopPrevention = false;
            
            console.log('🎯 AppCore破棄完了');

        } catch (error) {
            console.error('❌ AppCore破棄エラー:', error);
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.AppCore = AppCore;

// 初期化レジストリ方式
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.AppCoreInstance = new AppCore();
    console.log('🎯 AppCore registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.AppCore = AppCore;
}

console.log('🎯 AppCore (Phase1 ConfigManager統合確実化版) Loaded');
console.log('✨ 修正完了: ConfigManager → CanvasManager統合確実化・キャンバス出現警告解消');
console.log('🛡️ エラーループ防止機能強化・緊急フォールバック改善');
console.log('🔧 使用例: const appCore = new AppCore(); await appCore.initialize();');