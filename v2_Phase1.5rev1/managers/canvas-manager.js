/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門 (キャンバス消失問題解決版)
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能対応設計
 * 
 * 🔧 キャンバス消失問題解決:
 * - 既存canvas要素の削除処理を修正
 * - 初期化競合状態の解消
 * - Canvas要素の確実な永続化
 * - 重複初期化の防止強化
 */

// Tegaki名前空間初期化
window.Tegaki = window.Tegaki || {};

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.layers = new Map();
        this.container = null;
        this.initialized = false;
        
        // 初期化制御フラグ（重複初期化防止）
        this.initializationInProgress = false;
        this.canvasElementAttached = false;
        
        // AppCore参照
        this.appCore = null;
        this.configManager = null;
        
        // CoordinateManager統合状態
        this.coordinateManager = null;
        this.coordinateIntegrationEnabled = false;
        
        // ビュー状態
        this.viewState = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            minZoom: 0.1,
            maxZoom: 5.0
        };
        
        // PIXI設定
        this.pixiSettings = {
            antialias: true,
            backgroundColor: 0xffffee,
            resolution: window.devicePixelRatio || 1
        };
        
        console.log('🎨 CanvasManager インスタンス作成完了');
    }

    /**
     * キャンバス消失問題解決版初期化
     */
    async initialize(options = {}) {
        try {
            console.log('🚀 CanvasManager初期化開始...', options);
            
            // 重複初期化防止
            if (this.initialized) {
                console.warn('⚠️ CanvasManager already initialized');
                return true;
            }
            
            if (this.initializationInProgress) {
                console.warn('⚠️ CanvasManager initialization in progress');
                return false;
            }
            
            this.initializationInProgress = true;

            // 引数検証
            const validatedOptions = this._validateInitializationOptions(options);
            if (!validatedOptions) {
                throw new Error('Invalid initialization options');
            }

            // AppCore & ConfigManager参照保存
            this.appCore = validatedOptions.appCore;
            this.configManager = validatedOptions.configManager;
            
            console.log('✅ 参照統合完了:', {
                appCore: !!this.appCore,
                configManager: !!this.configManager
            });
            
            // 設定適用
            this._applyConfiguration(validatedOptions.config || {});
            
            // PIXI.Application作成
            await this._createPixiApplication();
            
            // キャンバス要素への追加（消失問題解決版）
            await this._attachCanvasToContainer(validatedOptions.canvasElement);
            
            // レイヤーシステム初期化
            this._initializeLayerSystem();
            
            // 統合システム連携
            this._integrateWithUnifiedSystems();
            
            // CoordinateManager統合
            this._initializeCoordinateIntegration();
            
            // イベント設定
            this._setupEventHandlers();
            
            this.initialized = true;
            this.initializationInProgress = false;
            
            // 初期化完了通知
            const eventBus = this.appCore?.eventBus || window.Tegaki?.EventBusInstance;
            if (eventBus?.safeEmit) {
                eventBus.safeEmit('canvas.initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height,
                    layerCount: this.layers.size
                });
            }
            
            console.log('✅ CanvasManager初期化完了');
            
            // 初期化完了後の検証
            this._verifyCanvasIntegrity();
            
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化失敗:', error);
            this.initializationInProgress = false;
            
            // ErrorManager委譲
            if (window.Tegaki?.ErrorManagerInstance) {
                window.Tegaki.ErrorManagerInstance.showError('error', 
                    `CanvasManager初期化エラー: ${error.message}`, {
                    context: 'CanvasManager.initialize'
                });
            }
            
            return false;
        }
    }

    /**
     * 引数検証（簡潔版）
     */
    _validateInitializationOptions(options) {
        try {
            // AppCore取得
            const appCore = options.appCore || 
                           window.Tegaki?.AppCoreInstance || 
                           window.appCore || 
                           null;

            // ConfigManager取得
            const configManager = options.config?.configManager ||
                                 appCore?.configManager ||
                                 window.Tegaki?.ConfigManagerInstance ||
                                 null;

            // canvasElement取得
            let canvasElement = options.canvasElement || 
                               document.getElementById('canvas-container');
            
            if (!canvasElement) {
                canvasElement = this._createCanvasContainer();
            }

            console.log('📋 初期化オプション検証完了:', {
                appCore: !!appCore,
                configManager: !!configManager,
                canvasElement: !!canvasElement
            });

            return { appCore, configManager, canvasElement, config: options.config || {} };

        } catch (error) {
            console.error('❌ 引数検証エラー:', error);
            return null;
        }
    }

    /**
     * 設定適用（簡潔版）
     */
    _applyConfiguration(config) {
        try {
            // ConfigManager統合設定取得
            if (this.configManager?.getCanvasConfig) {
                const canvasConfig = this.configManager.getCanvasConfig();
                const pixiConfig = this.configManager.getPixiConfig ? 
                                  this.configManager.getPixiConfig() : {};
                
                this.pixiSettings.backgroundColor = this._convertColorToHex(
                    config.backgroundColor || canvasConfig.backgroundColor
                );
                this.pixiSettings.antialias = config.antialias !== undefined ? 
                                             config.antialias : pixiConfig.antialias;
                this.pixiSettings.resolution = config.resolution || 
                                              pixiConfig.resolution || 
                                              this.pixiSettings.resolution;
                
                console.log('✅ ConfigManager設定適用完了');
            } else {
                // フォールバック設定
                if (config.backgroundColor !== undefined) {
                    this.pixiSettings.backgroundColor = this._convertColorToHex(config.backgroundColor);
                }
                if (config.antialias !== undefined) {
                    this.pixiSettings.antialias = config.antialias;
                }
                
                console.warn('⚠️ ConfigManager未利用 - デフォルト設定適用');
            }
            
        } catch (error) {
            console.warn('⚠️ 設定適用エラー:', error);
        }
    }

    /**
     * 色変換ユーティリティ
     */
    _convertColorToHex(color) {
        try {
            if (typeof color === 'string' && color.startsWith('#')) {
                return parseInt(color.substring(1), 16);
            } else if (typeof color === 'number') {
                return color;
            } else {
                return 0xffffee;
            }
        } catch (error) {
            return 0xffffee;
        }
    }

    /**
     * PIXI.Application作成
     */
    async _createPixiApplication() {
        try {
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
                backgroundColor: `0x${this.pixiSettings.backgroundColor.toString(16)}`
            });
            
        } catch (error) {
            console.error('❌ PIXI.Application作成エラー:', error);
            throw error;
        }
    }

    /**
     * キャンバス要素への追加（消失問題解決版）
     */
    async _attachCanvasToContainer(canvasElement) {
        try {
            if (!canvasElement) {
                throw new Error('canvasElement is null');
            }

            console.log('🔧 キャンバス要素追加開始:', {
                elementType: canvasElement.tagName,
                hasChildren: canvasElement.children.length,
                currentDisplay: getComputedStyle(canvasElement).display
            });

            // 既存のcanvas要素確認（消失問題の核心）
            const existingCanvas = canvasElement.querySelector('canvas');
            if (existingCanvas) {
                console.log('⚠️ 既存canvas要素検出 - 削除せずに置き換え');
                // 削除ではなく置き換えで対処
                canvasElement.replaceChild(this.app.view, existingCanvas);
            } else {
                // 新規追加
                canvasElement.appendChild(this.app.view);
            }
            
            this.container = canvasElement;
            this.canvasElementAttached = true;

            // Canvas要素の基本設定（確実な表示保証）
            this.app.view.style.display = 'block';
            this.app.view.style.cursor = 'crosshair';
            this.app.view.style.touchAction = 'none';
            this.app.view.style.userSelect = 'none';
            
            // 親要素の表示確保
            if (canvasElement.style.display === 'none') {
                canvasElement.style.display = 'block';
            }
            
            console.log('✅ キャンバス要素追加完了 - Canvas should be visible');
            
            // 即座に表示確認
            setTimeout(() => {
                this._immediateVisibilityCheck();
            }, 100);
            
        } catch (error) {
            console.error('❌ キャンバス要素追加エラー:', error);
            throw error;
        }
    }

    /**
     * 即座表示確認（消失問題診断）
     */
    _immediateVisibilityCheck() {
        try {
            const canvas = this.app?.view;
            if (!canvas) {
                console.error('❌ 即座確認: canvas要素なし');
                return;
            }

            const isVisible = canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
            const parentExists = !!canvas.parentElement;
            const displayStyle = getComputedStyle(canvas).display;
            const visibilityStyle = getComputedStyle(canvas).visibility;

            console.log('🔍 即座表示確認:', {
                canvasExists: !!canvas,
                parentExists,
                isVisible,
                displayStyle,
                visibilityStyle,
                dimensions: `${canvas.offsetWidth}x${canvas.offsetHeight}`,
                parentId: canvas.parentElement?.id
            });

            if (!isVisible || !parentExists) {
                console.warn('⚠️ キャンバス表示問題検出 - 緊急修復実行');
                this._executeEmergencyVisibilityFix();
            } else {
                console.log('✅ キャンバス表示確認完了');
            }

        } catch (error) {
            console.error('❌ 即座表示確認エラー:', error);
        }
    }

    /**
     * 緊急表示修復（消失問題対策）
     */
    _executeEmergencyVisibilityFix() {
        try {
            console.log('🚨 緊急表示修復実行...');
            
            const canvas = this.app?.view;
            if (!canvas) {
                console.error('❌ canvas要素が存在しません');
                return false;
            }

            // 親要素の再確認・修復
            if (!canvas.parentElement) {
                let container = document.getElementById('canvas-container');
                if (!container) {
                    container = this._createCanvasContainer();
                }
                container.appendChild(canvas);
                this.container = container;
                console.log('🔧 親要素の再設定完了');
            }

            // スタイル強制設定
            canvas.style.display = 'block !important';
            canvas.style.visibility = 'visible !important';
            canvas.style.opacity = '1';
            canvas.style.position = 'relative';
            
            // 親要素のスタイル確認・修復
            if (canvas.parentElement) {
                const parent = canvas.parentElement;
                parent.style.display = 'block';
                parent.style.visibility = 'visible';
                
                // 親のサイズがゼロの場合の修復
                if (parent.offsetWidth === 0 || parent.offsetHeight === 0) {
                    parent.style.width = '400px';
                    parent.style.height = '400px';
                    console.log('🔧 親要素サイズ修復');
                }
            }

            console.log('✅ 緊急表示修復完了');
            return true;

        } catch (error) {
            console.error('❌ 緊急表示修復エラー:', error);
            return false;
        }
    }

    /**
     * キャンバスコンテナ作成
     */
    _createCanvasContainer() {
        try {
            const container = document.createElement('div');
            container.id = 'canvas-container-auto';
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
            
            const targetParent = document.querySelector('.canvas-area') || 
                                document.querySelector('main') ||
                                document.body;
            
            targetParent.appendChild(container);
            
            console.log('✅ 自動キャンバスコンテナ作成完了');
            return container;
            
        } catch (error) {
            console.error('❌ キャンバスコンテナ作成エラー:', error);
            return null;
        }
    }

    /**
     * レイヤーシステム初期化
     */
    _initializeLayerSystem() {
        try {
            this.addLayer('background', 'graphics', { zIndex: 0 });
            this.addLayer('main_drawing', 'graphics', { zIndex: 50 });
            console.log('✅ レイヤーシステム初期化完了');
        } catch (error) {
            console.error('❌ レイヤーシステム初期化エラー:', error);
        }
    }

    /**
     * 統一システム連携
     */
    _integrateWithUnifiedSystems() {
        try {
            const stateManager = this.appCore?.stateManager || 
                                window.Tegaki?.StateManagerInstance;
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
     * CoordinateManager統合初期化
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
                console.warn('⚠️ CoordinateManager利用不可');
                this.coordinateIntegrationEnabled = false;
            }
        } catch (error) {
            console.error('❌ CoordinateManager統合エラー:', error);
            this.coordinateIntegrationEnabled = false;
        }
    }

    /**
     * イベントハンドラー設定
     */
    _setupEventHandlers() {
        try {
            const canvas = this.app.view;
            
            canvas.addEventListener('wheel', this._handleWheel.bind(this));
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
            
            console.log('✅ イベントハンドラー設定完了');
        } catch (error) {
            console.error('❌ イベントハンドラー設定エラー:', error);
        }
    }

    /**
     * 初期化完了後の整合性検証
     */
    _verifyCanvasIntegrity() {
        try {
            console.log('🔍 キャンバス整合性検証...');
            
            const canvas = this.app?.view;
            const issues = [];
            
            if (!canvas) issues.push('Canvas要素なし');
            if (!canvas.parentElement) issues.push('親要素なし');
            if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) issues.push('サイズゼロ');
            if (getComputedStyle(canvas).display === 'none') issues.push('display:none');
            if (getComputedStyle(canvas).visibility === 'hidden') issues.push('visibility:hidden');
            
            if (issues.length === 0) {
                console.log('✅ キャンバス整合性検証: 正常');
            } else {
                console.warn('⚠️ キャンバス整合性検証: 問題あり', issues);
                // 即座に修復試行
                this._executeEmergencyVisibilityFix();
            }
            
        } catch (error) {
            console.error('❌ キャンバス整合性検証エラー:', error);
        }
    }

    // ========================================
    // レイヤー管理API（主責務）
    // ========================================

    addLayer(layerId, type = 'graphics', options = {}) {
        try {
            if (this.layers.has(layerId)) {
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

            return layer;
            
        } catch (error) {
            console.error('❌ レイヤー追加エラー:', error);
            return null;
        }
    }

    addGraphicsToLayer(graphics, layerId) {
        try {
            if (!graphics) return false;

            let layer = this.layers.get(layerId);
            if (!layer) {
                layer = this.addLayer(layerId, 'graphics');
                if (!layer) return false;
            }

            layer.addChild(graphics);
            return true;
            
        } catch (error) {
            console.error('❌ Graphics配置エラー:', error);
            return false;
        }
    }

    clear() {
        try {
            this.layers.forEach((layer) => {
                if (layer.clear) {
                    layer.clear();
                } else {
                    while (layer.children.length > 0) {
                        layer.removeChild(layer.children[0]);
                    }
                }
            });
        } catch (error) {
            console.error('❌ レイヤークリアエラー:', error);
        }
    }

    resize(width, height) {
        try {
            if (!this.app) return false;

            this.app.renderer.resize(width, height);
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
            
            return true;
        } catch (error) {
            console.error('❌ リサイズエラー:', error);
            return false;
        }
    }

    _handleWheel(event) {
        try {
            event.preventDefault();
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
            canvasVisible: this.app?.view ? 
                          (this.app.view.offsetWidth > 0 && this.app.view.offsetHeight > 0) : 
                          false
        };
    }

    /**
     * 診断情報取得（消失問題用）
     */
    getDiagnosticInfo() {
        const canvas = this.app?.view;
        
        return {
            initialized: this.initialized,
            initializationInProgress: this.initializationInProgress,
            canvasElementAttached: this.canvasElementAttached,
            pixiAppCreated: !!this.app,
            stageReady: !!this.stage,
            layerCount: this.layers.size,
            canvasExists: !!canvas,
            canvasVisible: canvas ? (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) : false,
            canvasParent: canvas ? !!canvas.parentElement : false,
            canvasParentId: canvas?.parentElement?.id || null,
            canvasDimensions: canvas ? `${canvas.offsetWidth}x${canvas.offsetHeight}` : null,
            canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
            canvasVisibility: canvas ? getComputedStyle(canvas).visibility : null,
            appCoreIntegrated: !!this.appCore,
            configManagerIntegrated: !!this.configManager,
            coordinateIntegrationEnabled: this.coordinateIntegrationEnabled
        };
    }

    /**
     * 強制表示確認・修復（デバッグ用）
     */
    forceVisibilityCheck() {
        console.log('🔍 強制表示確認実行...');
        this._immediateVisibilityCheck();
        return this.getDiagnosticInfo();
    }

    /**
     * システム破棄
     */
    destroy() {
        try {
            // レイヤークリア
            this.layers.forEach((layer) => {
                if (layer.destroy) {
                    layer.destroy();
                }
            });
            this.layers.clear();
            
            // PIXI.Application破棄
            if (this.app) {
                this.app.destroy(true);
                this.app = null;
            }
            
            // プロパティクリア
            this.stage = null;
            this.container = null;
            this.appCore = null;
            this.configManager = null;
            this.coordinateManager = null;
            this.initialized = false;
            this.initializationInProgress = false;
            this.canvasElementAttached = false;
            
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
    console.log('🎨 CanvasManager registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.CanvasManager = CanvasManager;
}

// デバッグ用グローバル関数
window.debugCanvasManager = function() {
    const cm = window.Tegaki?.CanvasManagerInstance;
    if (cm) {
        console.log('🔍 CanvasManager診断:', cm.getDiagnosticInfo());
        return cm.getDiagnosticInfo();
    } else {
        console.error('❌ CanvasManagerInstanceが見つかりません');
        return null;
    }
};

window.fixCanvasVisibility = function() {
    const cm = window.Tegaki?.CanvasManagerInstance;
    if (cm && cm._executeEmergencyVisibilityFix) {
        console.log('🚨 緊急修復実行...');
        return cm._executeEmergencyVisibilityFix();
    } else {
        console.error('❌ CanvasManagerまたは修復メソッドが見つかりません');
        return false;
    }
};

console.log('🎨 CanvasManager (キャンバス消失問題解決版) Loaded');
console.log('✨ 修正完了: キャンバス消失問題対策・重複初期化防止・緊急修復機能');
console.log('🔧 診断コマンド: window.debugCanvasManager(), window.fixCanvasVisibility()');