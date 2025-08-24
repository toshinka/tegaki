/**
 * 🎯 AppCore - アプリケーションコア統合システム (CanvasManager初期化引数修正版)
 * 🔄 CORE_FUNCTION: 統合管理・初期化・統一システム調整
 * 📋 RESPONSIBILITY: 「アプリケーション全体」の統合管理
 * 
 * 📏 DESIGN_PRINCIPLE: 統一システム基盤・Manager統合・Tool配信制御
 * 🚫 DRAWING_PROHIBITION: 直接描画処理は禁止 - CanvasManager/Tool委譲
 * ✅ INTEGRATION_AUTHORITY: Manager間統合・初期化順序制御
 * 
 * 🔧 CanvasManager初期化引数修正:
 * - CanvasManager.initialize()引数を正しい形式に修正
 * - AppCore参照の適切な渡し方を実装
 * - ConfigManager統合の確実な実行
 * - キャンバス要素の適切な渡し方を修正
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
        
        // 初期化状態管理
        this.initializationState = {
            unifiedSystems: false,
            specializedManagers: false,
            canvasIntegration: false,
            toolRegistration: false,
            complete: false
        };
        
        console.log('🎯 AppCore インスタンス作成完了');
    }

    /**
     * AppCore初期化（引数修正版）
     */
    async initialize() {
        try {
            console.log('🎯 AppCore初理化開始...');
            
            if (this.initializationAttempted) {
                console.warn('⚠️ AppCore初期化は既に試行済み');
                return this.initialized;
            }
            this.initializationAttempted = true;

            // STEP 1: 統一システム初期化
            await this.initializeUnifiedSystems();
            
            // STEP 2: 専門Manager初期化
            await this.initializeSpecializedManagers();
            
            // STEP 3: キャンバス統合（修正版）
            await this.integrateCanvas();
            
            // STEP 4: ツール登録
            await this.registerTools();
            
            // STEP 5: UI初期化
            await this.initializeUI();
            
            this.initialized = true;
            this.initializationState.complete = true;
            
            // 初期化完了通知
            if (this.eventBus?.safeEmit) {
                this.eventBus.safeEmit('appCore.initialized', {
                    managers: this.getManagerStatus()
                });
            }
            
            console.log('✅ AppCore初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ AppCore初期化失敗:', error);
            
            // エラー表示（ループ防止付き）
            if (this.errorManager?.showError && !this.errorLoopPrevention) {
                this.errorLoopPrevention = true;
                this.errorManager.showError('error', `AppCore初期化失敗: ${error.message}`, {
                    context: 'AppCore.initialize',
                    showReload: true
                });
                
                setTimeout(() => {
                    this.errorLoopPrevention = false;
                }, 5000);
            }
            
            return false;
        }
    }

    /**
     * STEP 1: 統一システム初期化
     */
    async initializeUnifiedSystems() {
        try {
            console.log('🔧 統一システム初期化中...');
            
            // ConfigManager（最優先）
            this.configManager = window.Tegaki?.ConfigManagerInstance;
            if (!this.configManager && window.Tegaki?.ConfigManager) {
                this.configManager = new window.Tegaki.ConfigManager();
                window.Tegaki.ConfigManagerInstance = this.configManager;
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
            this.coordinateManager = window.Tegaki?.CoordinateManagerInstance;
            if (!this.coordinateManager && window.Tegaki?.CoordinateManager) {
                this.coordinateManager = new window.Tegaki.CoordinateManager();
                window.Tegaki.CoordinateManagerInstance = this.coordinateManager;
            }

            // CanvasManager（インスタンス取得のみ、初期化は後で実行）
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
     * STEP 3: キャンバス統合（引数修正版）
     */
    async integrateCanvas() {
        try {
            console.log('🎨 キャンバス統合中...');

            // キャンバス要素取得
            let canvasElement = document.getElementById('canvas-container');
            
            if (!canvasElement) {
                console.warn('⚠️ canvas-container要素が見つかりません - 作成中');
                canvasElement = this.createCanvasContainer();
            }

            if (!canvasElement) {
                throw new Error('キャンバス要素の取得・作成に失敗しました');
            }

            // CanvasManager初期化（引数修正版）
            if (this.canvasManager && typeof this.canvasManager.initialize === 'function') {
                console.log('🔧 CanvasManager初期化開始 - 引数修正版');
                
                // 正しい引数形式でCanvasManager.initialize()を呼び出し
                const initOptions = {
                    appCore: this,                    // AppCore参照
                    canvasElement: canvasElement,     // キャンバス要素
                    config: {                         // 設定オブジェクト
                        configManager: this.configManager,  // ConfigManager参照
                        backgroundColor: '#ffffee',   // デフォルト背景色
                        antialias: true,              // アンチエイリアス
                        resolution: window.devicePixelRatio || 1
                    }
                };

                console.log('📋 CanvasManager初期化引数:', {
                    hasAppCore: !!initOptions.appCore,
                    hasCanvasElement: !!initOptions.canvasElement,
                    hasConfigManager: !!initOptions.config.configManager,
                    canvasElementId: canvasElement.id,
                    canvasElementTag: canvasElement.tagName
                });

                const success = await this.canvasManager.initialize(initOptions);

                if (!success) {
                    throw new Error('CanvasManager初期化がfalseを返しました');
                }
                
                console.log('✅ CanvasManager初期化完了');
            } else {
                console.error('❌ CanvasManagerが利用できません');
                throw new Error('CanvasManager.initialize メソッドが利用できません');
            }

            this.initializationState.canvasIntegration = true;
            console.log('✅ キャンバス統合完了');

        } catch (error) {
            console.error('❌ キャンバス統合エラー:', error);
            throw error; // 上位に再スロー
        }
    }

    /**
     * キャンバスコンテナ作成
     */
    createCanvasContainer() {
        try {
            console.log('🔧 キャンバスコンテナ作成中...');
            
            const container = document.createElement('div');
            container.id = 'canvas-container';
            container.className = 'canvas-container';
            container.style.cssText = `
                width: 400px;
                height: 400px;
                margin: 20px auto;
                background-color: #ffffee;
                border: 2px solid #800000;
                display: block;
                position: relative;
            `;
            
            // 最適な挿入場所を探す
            const targetParent = document.querySelector('.canvas-area') || 
                                document.querySelector('.main-container') ||
                                document.body;
            
            targetParent.appendChild(container);
            
            console.log('✅ キャンバスコンテナ作成完了');
            return container;
            
        } catch (error) {
            console.error('❌ キャンバスコンテナ作成失敗:', error);
            return null;
        }
    }

    /**
     * STEP 4: ツール登録
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
     * STEP 5: UI初期化
     */
    async initializeUI() {
        try {
            console.log('🎨 UI初期化中...');

            // UIManager初期化
            this.uiManager = window.Tegaki?.UIManagerInstance;
            if (!this.uiManager && window.Tegaki?.UIManager) {
                this.uiManager = new window.Tegaki.UIManager();
                window.Tegaki.UIManagerInstance = this.uiManager;
            }

            if (this.uiManager && typeof this.uiManager.initialize === 'function') {
                this.uiManager.initialize();
                console.log('✅ UIManager初期化完了');
            } else {
                console.warn('⚠️ UIManager利用不可');
            }

        } catch (error) {
            console.error('❌ UI初期化エラー:', error);
            // UI初期化は非致命的なので継続
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
            canvasManagerInitialized: !!(this.canvasManager?.initialized),
            toolManager: !!this.toolManager,
            uiManager: !!this.uiManager
        };
    }

    /**
     * 初期化状態取得
     */
    getInitializationState() {
        return { ...this.initializationState };
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
            canvasInfo: {
                containerExists: !!document.getElementById('canvas-container'),
                canvasExists: !!document.querySelector('canvas'),
                canvasVisible: (() => {
                    const canvas = document.querySelector('canvas');
                    return canvas ? canvas.offsetWidth > 0 && canvas.offsetHeight > 0 : false;
                })()
            },
            pixiInfo: {
                available: !!window.PIXI,
                canvasManagerApp: !!(this.canvasManager?.app)
            }
        };
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            // Manager破棄
            if (this.canvasManager?.destroy) {
                this.canvasManager.destroy();
            }

            // 参照クリア
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

// デバッグ用グローバル関数
window.debugAppCore = function() {
    const appCore = window.Tegaki?.AppCoreInstance;
    if (appCore) {
        console.log('🔍 AppCore診断:', appCore.getDiagnosticInfo());
        return appCore.getDiagnosticInfo();
    } else {
        console.error('❌ AppCoreInstanceが見つかりません');
        return null;
    }
};

console.log('🎯 AppCore (CanvasManager初期化引数修正版) Loaded');
console.log('✨ 修正完了: CanvasManager.initialize()引数形式修正・キャンバス要素渡し修正');
console.log('🔧 診断コマンド: window.debugAppCore()');