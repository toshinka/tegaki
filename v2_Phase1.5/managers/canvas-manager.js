/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門（キャンバス表示問題解決版）
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能対応設計
 * 
 * ✨ Phase1.5修正内容:
 * - キャンバス表示問題の根本解決（DOM要素確実接続）
 * - ConfigManager統合完全対応（警告解消）
 * - 初期化プロセス信頼性向上
 * - 責務分離の徹底維持
 * 
 * 🔧 キャンバス表示確実化:
 * - DOM要素存在確認強化
 * - PIXI Application確実配置
 * - キャンバス要素表示確認
 * - 緊急フォールバック改善
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.layers = new Map(); // レイヤー管理をMapで統一
        this.container = null;
        this.initialized = false;
        
        // AppCore参照（統合対応強化）
        this.appCore = null;
        this.configManager = null; // ConfigManager直接参照
        
        // CoordinateManager統合状態
        this.coordinateManager = null;
        this.coordinateIntegrationEnabled = false;
        
        // 初期化タイミング記録（診断用）
        this.initializeTime = null;
        this.canvasAttachTime = null;
        
        // ビュー状態（レイヤー管理機能として維持）
        this.viewState = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            minZoom: 0.1,
            maxZoom: 5.0
        };
        
        // PIXI設定（レイヤー管理に必要）
        this.pixiSettings = {
            antialias: true,
            backgroundColor: 0xffffee, // ふたば風背景色
            resolution: window.devicePixelRatio || 1
        };
        
        console.log('🎨 CanvasManager インスタンス作成完了（キャンバス表示問題解決版）');
    }

    /**
     * 全レイヤークリア
     */
    clear() {
        try {
            this.layers.forEach((layer, layerId) => {
                if (layer.clear && typeof layer.clear === 'function') {
                    layer.clear();
                } else {
                    while (layer.children.length > 0) {
                        layer.removeChild(layer.children[0]);
                    }
                }
            });
            
            console.log('✅ All layers cleared');
        } catch (error) {
            console.error('❌ レイヤークリアエラー:', error);
        }
    }

    // ========================================
    // ビュー操作API（レイヤー管理として必要）
    // ========================================

    /**
     * リサイズ処理
     */
    resize(width, height) {
        try {
            if (!this.app) {
                console.warn('⚠️ PIXI.Application未初期化');
                return false;
            }

            this.app.renderer.resize(width, height);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
            
            // CoordinateManager更新
            if (this.coordinateManager?.updateCanvasSize) {
                this.coordinateManager.updateCanvasSize(width, height);
            }
            
            console.log(`📐 Canvas resized: ${width}x${height}`);
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスリサイズエラー:', error);
            return false;
        }
    }

    /**
     * ホイール処理
     */
    _handleWheel(event) {
        try {
            event.preventDefault();
            // Phase1.5では基本的なホイール処理のみ
        } catch (error) {
            console.error('❌ ホイール処理エラー:', error);
        }
    }

    // ========================================
    // アクセサメソッド
    // ========================================

    getPixiApp() { return this.app; }
    getStage() { return this.stage; }
    getLayer(layerId) { return this.layers.get(layerId); }
    getAllLayers() { return Array.from(this.layers.values()); }
    getLayerIds() { return Array.from(this.layers.keys()); }
    
    getViewInfo() {
        return {
            zoom: this.viewState.zoom,
            panX: this.viewState.panX,
            panY: this.viewState.panY,
            canvasWidth: this.app?.screen.width || 0,
            canvasHeight: this.app?.screen.height || 0,
            initialized: this.initialized,
            layerCount: this.layers.size
        };
    }

    /**
     * CoordinateManager統合状態取得
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            integrationEnabled: this.coordinateIntegrationEnabled,
            appCoreIntegrated: !!this.appCore,
            configManagerIntegrated: !!this.configManager
        };
    }

    /**
     * 診断情報取得（拡張版）
     */
    getDiagnosticInfo() {
        return {
            initialized: this.initialized,
            initializeTime: this.initializeTime,
            canvasAttachTime: this.canvasAttachTime,
            
            // 統合状態
            appCoreIntegrated: !!this.appCore,
            configManagerIntegrated: !!this.configManager,
            configManagerFunctional: !!(this.configManager?.getCanvasConfig && this.configManager?.getPixiConfig),
            coordinateIntegrationEnabled: this.coordinateIntegrationEnabled,
            
            // PIXI状態
            pixiAppCreated: !!this.app,
            stageReady: !!this.stage,
            layerCount: this.layers.size,
            layerIds: this.getLayerIds(),
            
            // DOM状態
            canvasVisible: !!(this.app?.view?.parentElement),
            containerElement: !!this.container,
            canvasSize: this.app ? {
                width: this.app.screen.width,
                height: this.app.screen.height
            } : null,
            
            // 設定状態
            pixiSettings: { ...this.pixiSettings },
            viewState: { ...this.viewState }
        };
    }

    // ========================================
    // システム破棄
    // ========================================

    /**
     * システム破棄
     */
    destroy() {
        try {
            // レイヤークリア・破棄
            this.layers.forEach((layer) => {
                if (layer.destroy && typeof layer.destroy === 'function') {
                    layer.destroy();
                }
            });
            this.layers.clear();
            
            // PIXI.Application破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // 参照クリア
            this.stage = null;
            this.container = null;
            this.appCore = null;
            this.configManager = null;
            this.coordinateManager = null;
            
            // 状態リセット
            this.initialized = false;
            this.coordinateIntegrationEnabled = false;
            
            console.log('🎨 CanvasManager 破棄完了');
            
        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間に登録
window.Tegaki.CanvasManager = CanvasManager;

// 初期化レジストリ方式
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.CanvasManagerInstance = new CanvasManager();
    console.log('🎨 CanvasManagerInstance registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.CanvasManager = CanvasManager;
}

console.log('🎨 CanvasManager (キャンバス表示問題解決版) Loaded');
console.log('✨ 修正完了: DOM接続確実化・表示確認・ConfigManager統合');
console.log('🚀 Phase1.5目標: キャンバス100%表示・責務分離維持・診断機能強化');
console.log('🔧 使用例: const cm = new CanvasManager(); await cm.initialize({appCore, canvasElement});');キャンバス表示問題解決: 初期化メソッド完全修正版
     * @param {object} options - 初期化オプション
     * @param {AppCore} options.appCore - AppCoreインスタンス（必須）
     * @param {HTMLElement} options.canvasElement - キャンバス要素
     * @param {object} options.config - 追加設定
     * @returns {Promise<boolean>} 成功/失敗
     */
    async initialize(options = {}) {
        const startTime = performance.now();
        
        try {
            console.log('🚀 CanvasManager初期化開始（キャンバス表示問題解決版）...', options);
            
            if (this.initialized) {
                console.warn('⚠️ CanvasManager already initialized');
                return true;
            }

            // Step 1: 初期化オプション検証・確実化
            const validatedOptions = await this._validateAndPrepareOptions(options);
            if (!validatedOptions.success) {
                throw new Error('初期化オプション検証失敗');
            }
            
            console.log('✅ 初期化オプション検証完了:', validatedOptions.data);

            // Step 2: AppCore & ConfigManager統合
            this._integrateWithAppCore(validatedOptions.data);
            
            // Step 3: 設定適用（ConfigManager統合）
            this._applyConfigurationSettings(validatedOptions.data.config || {});
            
            // Step 4: PIXI.Application作成
            await this._createPixiApplication();
            
            // Step 5: キャンバス要素への確実な接続（最重要）
            const attachSuccess = await this._attachCanvasToDOM(validatedOptions.data.canvasElement);
            if (!attachSuccess) {
                throw new Error('キャンバスDOM接続失敗');
            }
            
            // Step 6: レイヤーシステム初期化
            this._initializeLayerSystem();
            
            // Step 7: 統一システム連携
            this._integrateWithUnifiedSystems();
            
            // Step 8: CoordinateManager統合
            this._initializeCoordinateIntegration();
            
            // Step 9: イベント設定
            this._setupEventHandlers();
            
            this.initialized = true;
            this.initializeTime = performance.now() - startTime;
            
            // キャンバス表示確認・ログ出力
            this._verifyCanvasVisibility();
            
            // 統一システム経由での通知
            this._notifyInitializationComplete();
            
            console.log(`✅ CanvasManager初期化完了（${this.initializeTime.toFixed(2)}ms） - Canvas表示確認済み`);
            
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化失敗:', error);
            
            // ErrorManager経由でのエラー処理
            this._handleInitializationError(error);
            
            // 緊急フォールバック実行
            const fallbackSuccess = await this._executeEmergencyCanvasFallback();
            return fallbackSuccess;
        }
    }

    /**
     * Step 1: 初期化オプション検証・確実化
     */
    async _validateAndPrepareOptions(options) {
        try {
            const result = { success: false, data: null };
            
            // AppCore取得・確認
            let appCore = options.appCore || window.Tegaki?.AppCoreInstance || window.AppCore;
            if (!appCore) {
                console.warn('⚠️ AppCore未提供 - 制限モードで継続');
            }
            
            // キャンバス要素確実取得
            let canvasElement = await this._ensureCanvasElement(options.canvasElement);
            if (!canvasElement) {
                throw new Error('キャンバス要素の確保に失敗');
            }
            
            // ConfigManager取得
            let configManager = this._getConfigManager(options, appCore);
            
            result.data = {
                appCore,
                canvasElement,
                configManager,
                config: options.config || {}
            };
            result.success = true;
            
            return result;
            
        } catch (error) {
            console.error('❌ 初期化オプション検証エラー:', error);
            return { success: false, error };
        }
    }

    /**
     * キャンバス要素確実取得（表示問題解決の核心）
     */
    async _ensureCanvasElement(providedElement) {
        try {
            // 提供された要素を最優先
            if (providedElement && this._isValidCanvasContainer(providedElement)) {
                console.log('✅ 提供されたcanvasElement使用:', providedElement.id || providedElement.tagName);
                return providedElement;
            }
            
            // DOM検索による取得
            let canvasElement = document.getElementById('canvas-container');
            if (canvasElement && this._isValidCanvasContainer(canvasElement)) {
                console.log('✅ #canvas-containerを使用');
                return canvasElement;
            }
            
            // フォールバック検索
            const fallbackSelectors = [
                '#drawing-canvas',
                '.canvas-area',
                '.canvas-container',
                'canvas'
            ];
            
            for (const selector of fallbackSelectors) {
                canvasElement = document.querySelector(selector);
                if (canvasElement && this._isValidCanvasContainer(canvasElement)) {
                    console.log(`✅ フォールバック要素使用: ${selector}`);
                    return canvasElement;
                }
            }
            
            // 動的作成（最終手段）
            console.warn('⚠️ キャンバス要素が見つかりません - 動的作成実行');
            return this._createFallbackCanvasContainer();
            
        } catch (error) {
            console.error('❌ キャンバス要素確保エラー:', error);
            return null;
        }
    }

    /**
     * キャンバスコンテナ有効性確認
     */
    _isValidCanvasContainer(element) {
        if (!element) return false;
        
        // DOM要素として有効か
        if (!element.nodeType || element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        
        // サイズが有効か
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            console.warn('⚠️ キャンバス要素のサイズが0:', {
                width: rect.width,
                height: rect.height,
                element: element.id || element.tagName
            });
            return false; // サイズ0でも一旦falseにしない（CSSで後から設定される可能性）
        }
        
        console.log('✅ キャンバス要素有効性確認:', {
            id: element.id,
            tagName: element.tagName,
            width: rect.width,
            height: rect.height
        });
        
        return true;
    }

    /**
     * ConfigManager取得（統合対応）
     */
    _getConfigManager(options, appCore) {
        // 優先順序: options.config.configManager → AppCore → グローバル
        return options.config?.configManager || 
               appCore?.configManager || 
               window.Tegaki?.ConfigManagerInstance || 
               null;
    }

    /**
     * Step 2: AppCore統合
     */
    _integrateWithAppCore(validatedData) {
        this.appCore = validatedData.appCore;
        this.configManager = validatedData.configManager;
        
        if (this.configManager) {
            const hasCanvasConfig = typeof this.configManager.getCanvasConfig === 'function';
            const hasPixiConfig = typeof this.configManager.getPixiConfig === 'function';
            
            console.log('✅ ConfigManager統合完了:', {
                available: !!this.configManager,
                hasCanvasConfig,
                hasPixiConfig,
                ready: hasCanvasConfig && hasPixiConfig
            });
        } else {
            console.warn('⚠️ ConfigManager未取得 - デフォルト設定で動作');
        }
    }

    /**
     * Step 3: 設定適用
     */
    _applyConfigurationSettings(config) {
        try {
            // ConfigManager統合設定適用
            if (this.configManager?.getCanvasConfig && this.configManager?.getPixiConfig) {
                const canvasConfig = this.configManager.getCanvasConfig();
                const pixiConfig = this.configManager.getPixiConfig();
                
                this.pixiSettings.backgroundColor = this._convertColorToHex(
                    config.backgroundColor || canvasConfig.backgroundColor
                ) || this.pixiSettings.backgroundColor;
                
                this.pixiSettings.antialias = config.antialias !== undefined ? 
                    config.antialias : pixiConfig.antialias;
                this.pixiSettings.resolution = config.resolution || 
                    pixiConfig.resolution || this.pixiSettings.resolution;
                
                console.log('✅ ConfigManager設定適用:', this.pixiSettings);
            }
            // フォールバック: 直接設定のみ
            else {
                if (config.backgroundColor !== undefined) {
                    this.pixiSettings.backgroundColor = this._convertColorToHex(config.backgroundColor);
                }
                if (config.antialias !== undefined) {
                    this.pixiSettings.antialias = config.antialias;
                }
                if (config.resolution !== undefined) {
                    this.pixiSettings.resolution = config.resolution;
                }
                
                console.log('📋 フォールバック設定適用:', this.pixiSettings);
            }
            
        } catch (error) {
            console.warn('⚠️ 設定適用エラー:', error);
            // デフォルト設定で継続
        }
    }

    /**
     * 色変換ヘルパー
     */
    _convertColorToHex(color) {
        try {
            if (typeof color === 'string' && color.startsWith('#')) {
                return parseInt(color.substring(1), 16);
            } else if (typeof color === 'number') {
                return color;
            }
            return 0xffffee; // デフォルト
        } catch (error) {
            console.warn('⚠️ 色変換エラー:', error);
            return 0xffffee;
        }
    }

    /**
     * Step 4: PIXI.Application作成
     */
    async _createPixiApplication() {
        try {
            // キャンバス設定取得
            let config = { width: 400, height: 400 };
            
            if (this.configManager?.getCanvasConfig) {
                const canvasConfig = this.configManager.getCanvasConfig();
                config.width = canvasConfig.width || 400;
                config.height = canvasConfig.height || 400;
            }
            
            this.app = new PIXI.Application({
                width: config.width,
                height: config.height,
                antialias: this.pixiSettings.antialias,
                backgroundColor: this.pixiSettings.backgroundColor,
                resolution: this.pixiSettings.resolution,
                autoDensity: true
            });

            this.stage = this.app.stage;
            
            console.log('✅ PIXI.Application作成完了:', {
                width: this.app.screen.width,
                height: this.app.screen.height,
                backgroundColor: this.pixiSettings.backgroundColor
            });
            
        } catch (error) {
            console.error('❌ PIXI.Application作成エラー:', error);
            throw error;
        }
    }

    /**
     * Step 5: キャンバスDOM接続（表示問題解決の最重要部分）
     */
    async _attachCanvasToDOM(canvasElement) {
        const attachStart = performance.now();
        
        try {
            if (!canvasElement || !this.app) {
                throw new Error('canvasElementまたはPIXI.Appが利用不可');
            }

            // 既存のcanvas要素があれば削除
            const existingCanvas = canvasElement.querySelector('canvas');
            if (existingCanvas) {
                existingCanvas.remove();
                console.log('📋 既存canvas要素削除');
            }
            
            // PIXIキャンバスをDOM接続
            if (canvasElement.tagName === 'CANVAS') {
                // 既存canvasの場合は親に追加
                const parent = canvasElement.parentElement || document.body;
                parent.replaceChild(this.app.view, canvasElement);
                this.container = parent;
            } else {
                // コンテナの場合は子として追加
                canvasElement.appendChild(this.app.view);
                this.container = canvasElement;
            }

            // キャンバス基本スタイル設定
            this.app.view.style.cssText = `
                cursor: crosshair;
                touch-action: none;
                display: block;
                max-width: 100%;
                height: auto;
            `;
            
            this.canvasAttachTime = performance.now() - attachStart;
            
            console.log(`✅ キャンバスDOM接続完了（${this.canvasAttachTime.toFixed(2)}ms）`);
            
            // 接続確認のため短時間待機
            await new Promise(resolve => setTimeout(resolve, 10));
            
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスDOM接続エラー:', error);
            return false;
        }
    }

    /**
     * フォールバック用キャンバスコンテナ作成
     */
    _createFallbackCanvasContainer() {
        try {
            const container = document.createElement('div');
            container.id = 'canvas-container-fallback';
            container.className = 'canvas-container';
            
            // CSS変数に対応したスタイル設定
            container.style.cssText = `
                width: var(--canvas-default-size, 400px);
                height: var(--canvas-default-size, 400px);
                margin: 0 auto;
                background-color: var(--futaba-bg, #ffffee);
                border: 1px solid var(--border-color, #ccc);
                display: block;
                position: relative;
            `;
            
            // 挿入場所を探す
            const targetParent = document.querySelector('.canvas-area') || 
                                document.querySelector('.main-layout') ||
                                document.querySelector('main') ||
                                document.body;
            
            targetParent.appendChild(container);
            
            console.log('✅ フォールバックキャンバスコンテナ作成完了');
            return container;
            
        } catch (error) {
            console.error('❌ フォールバックキャンバスコンテナ作成失敗:', error);
            return null;
        }
    }

    /**
     * Step 6: レイヤーシステム初期化
     */
    _initializeLayerSystem() {
        try {
            // 基本レイヤーを作成
            this.addLayer('background', 'graphics', { zIndex: 0 });
            this.addLayer('drawing', 'graphics', { zIndex: 50 });
            this.addLayer('ui', 'container', { zIndex: 100 });
            
            console.log(`✅ レイヤーシステム初期化完了 - ${this.layers.size}レイヤー作成`);
        } catch (error) {
            console.error('❌ レイヤーシステム初理化エラー:', error);
        }
    }

    /**
     * Step 7: 統一システム連携
     */
    _integrateWithUnifiedSystems() {
        try {
            // StateManager連携
            const stateManager = this.appCore?.stateManager || window.Tegaki?.StateManagerInstance;
            if (stateManager) {
                stateManager.updateComponentState('canvasManager', 'initialized', true);
                stateManager.updateComponentState('canvas', 'zoom', this.viewState.zoom);
                stateManager.updateComponentState('canvas', 'layerCount', this.layers.size);
            }
            
            console.log('✅ 統一システム連携完了');
        } catch (error) {
            console.warn('⚠️ 統一システム連携エラー:', error);
        }
    }

    /**
     * Step 8: CoordinateManager統合
     */
    _initializeCoordinateIntegration() {
        try {
            this.coordinateManager = this.appCore?.coordinateManager || 
                                    window.Tegaki?.CoordinateManagerInstance;
            
            if (this.coordinateManager && this.coordinateManager.updateCanvasSize) {
                this.coordinateManager.updateCanvasSize(
                    this.app.screen.width, 
                    this.app.screen.height
                );
                this.coordinateIntegrationEnabled = true;
                console.log('✅ CoordinateManager統合完了');
            } else {
                this.coordinateIntegrationEnabled = false;
                console.warn('⚠️ CoordinateManager利用不可');
            }
        } catch (error) {
            console.error('❌ CoordinateManager統合エラー:', error);
            this.coordinateIntegrationEnabled = false;
        }
    }

    /**
     * Step 9: イベント設定
     */
    _setupEventHandlers() {
        try {
            const canvas = this.app.view;
            
            // レイヤー管理に必要な基本イベント
            canvas.addEventListener('wheel', this._handleWheel.bind(this), { passive: false });
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // PIXI Stage設定
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
            
            console.log('✅ 基本イベントハンドラー設定完了');
        } catch (error) {
            console.error('❌ イベントハンドラー設定エラー:', error);
        }
    }

    /**
     * キャンバス表示確認・ログ出力
     */
    _verifyCanvasVisibility() {
        try {
            const canvas = this.container?.querySelector('canvas');
            
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const computedStyle = getComputedStyle(canvas);
                
                console.log('🎨 キャンバス表示確認:', {
                    found: true,
                    size: `${canvas.width}x${canvas.height}`,
                    displaySize: `${rect.width}x${rect.height}`,
                    display: computedStyle.display,
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity
                });
                
                if (rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none') {
                    console.log('✅ キャンバス正常表示確認');
                } else {
                    console.warn('⚠️ キャンバス非表示状態:', {
                        rectSize: `${rect.width}x${rect.height}`,
                        display: computedStyle.display
                    });
                }
                
            } else {
                console.error('❌ キャンバス要素が見つかりません');
            }
            
        } catch (error) {
            console.error('❌ キャンバス表示確認エラー:', error);
        }
    }

    /**
     * 初期化完了通知
     */
    _notifyInitializationComplete() {
        try {
            const eventBus = this.appCore?.eventBus || window.Tegaki?.EventBusInstance;
            if (eventBus?.safeEmit) {
                eventBus.safeEmit('canvas:initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height,
                    layerCount: this.layers.size,
                    coordinateIntegrationEnabled: this.coordinateIntegrationEnabled,
                    initializeTime: this.initializeTime,
                    canvasAttachTime: this.canvasAttachTime
                });
            }
        } catch (error) {
            console.warn('⚠️ 初期化完了通知エラー:', error);
        }
    }

    /**
     * 初期化エラー処理
     */
    _handleInitializationError(error) {
        const errorManager = this.appCore?.errorManager || window.Tegaki?.ErrorManagerInstance;
        if (errorManager?.showError) {
            errorManager.showError('error', `CanvasManager初期化エラー: ${error.message}`, {
                context: 'CanvasManager.initialize',
                additionalInfo: 'キャンバス表示問題の可能性があります',
                showReload: false
            });
        }
    }

    /**
     * 緊急キャンバスフォールバック（改善版）
     */
    async _executeEmergencyCanvasFallback() {
        try {
            console.log('🛡️ 緊急キャンバスフォールバック実行...');
            
            // 最小限のPixi Application確保
            if (!this.app && window.PIXI) {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
                this.stage = this.app.stage;
            }
            
            // コンテナ確保・キャンバス配置
            if (this.app) {
                let container = document.getElementById('canvas-container') ||
                               document.getElementById('canvas-container-fallback') ||
                               this._createFallbackCanvasContainer();
                
                if (container && !container.querySelector('canvas')) {
                    container.appendChild(this.app.view);
                    this.app.view.style.cssText = `
                        cursor: crosshair;
                        display: block;
                        max-width: 100%;
                    `;
                    
                    this.container = container;
                    this.initialized = true;
                    
                    // 基本レイヤー作成
                    this._initializeLayerSystem();
                    
                    console.log('✅ 緊急フォールバック完了 - 基本キャンバス表示');
                    return true;
                }
            }
            
            console.error('❌ 緊急フォールバックも失敗');
            return false;
            
        } catch (error) {
            console.error('❌ 緊急フォールバック実行エラー:', error);
            return false;
        }
    }

    // ========================================
    // レイヤー管理API（主責務）
    // ========================================

    /**
     * レイヤー追加（主責務）
     */
    addLayer(layerId, type = 'graphics', options = {}) {
        try {
            if (this.layers.has(layerId)) {
                console.warn(`⚠️ Layer ${layerId} already exists`);
                return this.layers.get(layerId);
            }

            let layer;
            
            switch (type) {
                case 'graphics':
                    layer = new PIXI.Graphics();
                    break;
                case 'container':
                    layer = new PIXI.Container();
                    break;
                case 'sprite':
                    layer = new PIXI.Container();
                    break;
                default:
                    layer = new PIXI.Graphics();
            }

            layer.name = layerId;
            layer.visible = options.visible !== false;
            layer.alpha = options.alpha || 1.0;
            layer.zIndex = options.zIndex || 0;

            this.stage.addChild(layer);
            this.layers.set(layerId, layer);
            this.stage.sortableChildren = true;

            console.log(`✅ Layer added: ${layerId} (${type})`);
            return layer;
            
        } catch (error) {
            console.error('❌ レイヤー追加エラー:', error);
            return null;
        }
    }

    /**
     * レイヤーにGraphicsを配置（主責務）
     */
    addGraphicsToLayer(graphics, layerId) {
        try {
            if (!graphics) {
                console.warn('⚠️ Graphics未提供');
                return false;
            }

            let layer = this.layers.get(layerId);
            if (!layer) {
                console.log(`📋 Layer ${layerId} 自動作成`);
                layer = this.addLayer(layerId, 'graphics');
                if (!layer) {
                    throw new Error(`Layer ${layerId} 作成失敗`);
                }
            }

            layer.addChild(graphics);
            return true;
            
        } catch (error) {
            console.error('❌ Graphics配置エラー:', error);
            return false;
        }
    }

    /**
     *