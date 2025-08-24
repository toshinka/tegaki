/**
 * 🎯 AppCore - アプリケーションコア統合システム (Phase1キャンバス要素修正版)
 * 🔄 CORE_FUNCTION: 統合管理・初期化・統一システム調整
 * 📋 RESPONSIBILITY: 「アプリケーション全体」の統合管理
 * 
 * 📏 DESIGN_PRINCIPLE: 統一システム基盤・Manager統合・Tool配信制御
 * 🚫 DRAWING_PROHIBITION: 直接描画処理は禁止 - CanvasManager/Tool委譲
 * ✅ INTEGRATION_AUTHORITY: Manager間統合・初期化順序制御
 * 
 * ✨ 修正内容:
 * - drawing-canvas → canvas-container 要素名修正
 * - エラーループ防止機能追加
 * - 基本フォールバック強化
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
        this.initializationAttempted = false; // エラーループ防止フラグ
        
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
        
        console.log('🎯 AppCore インスタンス作成完了（Phase1修正版）');
    }

    /**
     * AppCore初期化（Phase1集中修正版）
     */
    async initialize() {
        try {
            console.log('🎯 AppCore初期化開始（Phase1修正版）...');
            
            if (this.initializationAttempted) {
                console.warn('⚠️ AppCore初期化は既に試行済み - 重複実行防止');
                return this.initialized;
            }
            this.initializationAttempted = true;

            // STEP 1: 統一システム初期化
            await this.initializeUnifiedSystems();
            
            // STEP 2: 専門Manager初理化
            await this.initializeSpecializedManagers();
            
            // STEP 3: PixiJS Application作成（修正版）
            await this.initializePixiApplication();
            
            // STEP 4: キャンバス統合（要素名修正版）
            await this.integrateCanvas();
            
            // STEP 5: ツール登録
            await this.registerTools();
            
            this.initialized = true;
            this.initializationState.complete = true;
            
            // 初期化完了通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('appCore.initialized', {
                    managers: this.getManagerStatus(),
                    pixiApp: !!this.app
                });
            }
            
            console.log('✅ AppCore初期化完了（Phase1修正版）');
            return true;
            
        } catch (error) {
            console.error('❌ AppCore初期化失敗:', error);
            
            // エラー表示（ループ防止付き）
            if (this.errorManager?.showError && !this._errorLoopPrevention) {
                this._errorLoopPrevention = true;
                this.errorManager.showError('error', `AppCore初期化失敗: ${error.message}`, {
                    context: 'AppCore.initialize',
                    showReload: true
                });
                
                // 5秒後にループ防止フラグをリセット
                setTimeout(() => {
                    this._errorLoopPrevention = false;
                }, 5000);
            }
            
            // 基本フォールバック実行
            await this.executeEmergencyFallback();
            return false;
        }
    }

    /**
     * STEP 1: 統一システム初期化
     */
    async initializeUnifiedSystems() {
        try {
            console.log('🔧 統一システム初期化中...');
            
            // ConfigManager
            this.configManager = window.Tegaki?.ConfigManagerInstance || window.ConfigManagerInstance;
            if (!this.configManager) {
                const ConfigManagerCtor = window.Tegaki?.ConfigManager || window.ConfigManager;
                if (ConfigManagerCtor) {
                    this.configManager = new ConfigManagerCtor();
                }
            }

            // ErrorManager
            this.errorManager = window.Tegaki?.ErrorManagerInstance || window.ErrorManagerInstance;
            if (!this.errorManager) {
                const ErrorManagerCtor = window.Tegaki?.ErrorManager || window.ErrorManager;
                if (ErrorManagerCtor) {
                    this.errorManager = new ErrorManagerCtor();
                }
            }

            // StateManager
            this.stateManager = window.Tegaki?.StateManagerInstance || window.StateManagerInstance;
            if (!this.stateManager) {
                const StateManagerCtor = window.Tegaki?.StateManager || window.StateManager;
                if (StateManagerCtor) {
                    this.stateManager = new StateManagerCtor();
                }
            }

            // EventBus
            this.eventBus = window.Tegaki?.EventBusInstance || window.EventBusInstance;
            if (!this.eventBus) {
                const EventBusCtor = window.Tegaki?.EventBus || window.EventBus;
                if (EventBusCtor) {
                    this.eventBus = new EventBusCtor();
                }
            }

            this.initializationState.unifiedSystems = true;
            console.log('✅ 統一システム初期化完了:', {
                configManager: !!this.configManager,
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
     * STEP 2: 専門Manager初期化
     */
    async initializeSpecializedManagers() {
        try {
            console.log('🎯 専門Manager初期化中...');

            // CoordinateManager
            this.coordinateManager = window.Tegaki?.CoordinateManagerInstance || window.CoordinateManagerInstance;
            if (!this.coordinateManager) {
                const CoordinateManagerCtor = window.Tegaki?.CoordinateManager || window.CoordinateManager;
                if (CoordinateManagerCtor) {
                    this.coordinateManager = new CoordinateManagerCtor();
                }
            }

            // CanvasManager（後で統合するため、インスタンスのみ取得）
            this.canvasManager = window.Tegaki?.CanvasManagerInstance || window.CanvasManagerInstance;
            if (!this.canvasManager) {
                const CanvasManagerCtor = window.Tegaki?.CanvasManager || window.CanvasManager;
                if (CanvasManagerCtor) {
                    this.canvasManager = new CanvasManagerCtor();
                }
            }

            // ToolManager
            this.toolManager = window.Tegaki?.ToolManagerInstance || window.ToolManagerInstance;
            if (!this.toolManager) {
                const ToolManagerCtor = window.Tegaki?.ToolManager || window.ToolManager;
                if (ToolManagerCtor) {
                    this.toolManager = new ToolManagerCtor();
                }
            }

            // UIManager
            this.uiManager = window.Tegaki?.UIManagerInstance || window.UIManagerInstance;
            if (!this.uiManager) {
                const UIManagerCtor = window.Tegaki?.UIManager || window.UIManager;
                if (UIManagerCtor) {
                    this.uiManager = new UIManagerCtor();
                }
            }

            this.initializationState.specializedManagers = true;
            console.log('✅ 専門Manager初期化完了:', {
                coordinateManager: !!this.coordinateManager,
                canvasManager: !!this.canvasManager,
                toolManager: !!this.toolManager,
                uiManager: !!this.uiManager
            });

        } catch (error) {
            console.error('❌ 専門Manager初期化エラー:', error);
            throw new Error(`専門Manager初期化失敗: ${error.message}`);
        }
    }

    /**
     * STEP 3: PixiJS Application初期化（修正版）
     */
    async initializePixiApplication() {
        try {
            console.log('🎨 PixiJS Application初期化中...');

            if (!window.PIXI) {
                throw new Error('PIXIライブラリが利用できません');
            }

            // 設定取得
            let config = {
                width: 400,
                height: 400,
                backgroundColor: 0xffffee, // ふたば風背景
                antialias: true
            };

            if (this.configManager?.getCanvasConfig) {
                const canvasConfig = this.configManager.getCanvasConfig();
                config = { ...config, ...canvasConfig };
            }

            // PIXI.Application作成
            this.app = new PIXI.Application({
                width: config.width,
                height: config.height,
                backgroundColor: config.backgroundColor,
                antialias: config.antialias,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            this.initializationState.pixiApplication = true;
            console.log('✅ PixiJS Application作成完了:', {
                width: this.app.screen.width,
                height: this.app.screen.height
            });

        } catch (error) {
            console.error('❌ PixiJS Application初期化エラー:', error);
            throw new Error(`PixiJS Application初期化失敗: ${error.message}`);
        }
    }

    /**
     * STEP 4: キャンバス統合（要素名修正版）
     */
    async integrateCanvas() {
        try {
            console.log('🎨 キャンバス統合中...');

            // ✨ 修正: canvas-container要素を使用
            let canvasElement = document.getElementById('canvas-container') || 
                               document.getElementById('drawing-canvas') || // フォールバック
                               document.querySelector('canvas') ||
                               document.querySelector('.canvas-area');

            if (!canvasElement) {
                console.warn('⚠️ キャンバス要素が見つかりません - 動的作成');
                // 動的要素作成
                canvasElement = this.createFallbackCanvasContainer();
            }

            if (!canvasElement) {
                throw new Error('キャンバス要素の作成に失敗しました');
            }

            // CanvasManager初期化（修正版）
            if (this.canvasManager && typeof this.canvasManager.initialize === 'function') {
                const success = await this.canvasManager.initialize({
                    appCore: this, // AppCore参照を提供
                    canvasElement: canvasElement,
                    config: {
                        configManager: this.configManager
                    }
                });

                if (!success) {
                    throw new Error('CanvasManager初期化に失敗しました');
                }
            } else {
                console.warn('⚠️ CanvasManager利用不可 - 基本キャンバス作成');
                // 基本フォールバック
                canvasElement.appendChild(this.app.view);
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
            container.style.width = '400px';
            container.style.height = '400px';
            container.style.margin = '0 auto';
            container.style.backgroundColor = '#ffffee';
            container.style.border = '1px solid #ccc';
            
            // メイン領域を探して挿入
            const canvasArea = document.querySelector('.canvas-area') || document.body;
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
    async executeCanvasEmergencyFallback() {
        try {
            console.log('🛡️ キャンバス緊急フォールバック実行...');
            
            // 最小限のキャンバス表示
            let container = document.getElementById('canvas-container') || 
                           this.createFallbackCanvasContainer();
            
            if (container && this.app) {
                // PIXIキャンバスを直接追加
                container.appendChild(this.app.view);
                this.app.view.style.cursor = 'crosshair';
                
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
            if (window.PenTool) {
                const penTool = new window.PenTool();
                if (typeof this.toolManager.registerTool === 'function') {
                    this.toolManager.registerTool('pen', penTool);
                    console.log('✅ ペンツール登録完了');
                }
            }

            // 消しゴムツール登録
            if (window.EraserTool) {
                const eraserTool = new window.EraserTool();
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
     * 緊急フォールバック実行
     */
    async executeEmergencyFallback() {
        try {
            console.log('🛡️ 緊急フォールバック実行...');
            
            // 最小限のキャンバス表示のみ実行
            if (window.PIXI && !this.app) {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
            }
            
            if (this.app) {
                const container = document.getElementById('canvas-container') || 
                                 this.createFallbackCanvasContainer();
                
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
     * 座標統合状態取得
     */
    getCoordinateIntegrationState() {
        return {
            appCoreInitialized: this.initialized,
            coordinateManagerAvailable: !!this.coordinateManager,
            canvasManagerIntegrated: !!this.canvasManager,
            pixiApplicationReady: !!this.app,
            canvasElementAttached: !!document.querySelector('canvas'),
            coordinateIntegrationEnabled: !!(this.coordinateManager && this.canvasManager)
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
            coordinateIntegration: this.getCoordinateIntegrationState(),
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

console.log('🎯 AppCore (Phase1キャンバス要素修正版) Loaded');
console.log('✨ 修正完了: drawing-canvas → canvas-container 要素名対応');
console.log('🛡️ エラーループ防止機能追加');
console.log('🔧 使用例: const appCore = new AppCore(); await appCore.initialize();');