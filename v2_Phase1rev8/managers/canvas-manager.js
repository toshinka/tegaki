/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門 (Phase1キャンバス出現確実化版)
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能対応設計
 * 
 * ✨ Phase1修正内容:
 * - ConfigManager統合問題の完全解消（warning解消）
 * - キャンバス出現の確実化
 * - AppCore統合の完全対応
 * - 基本責務分離の徹底
 * 
 * 🔧 キャンバス出現確実化:
 * - ConfigManager完全統合（警告解消）
 * - AppCore連携の修正
 * - 緊急フォールバック強化
 * 
 * 📋 参考定義:
 * - ルールブック: 1.1 責務分離の絶対原則 - CanvasManager
 * - シンボル辞典: CanvasManager系API - 許可されるAPI群
 * - 手順書: Phase 1: 緊急修復（基本動作復旧）
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
        
        console.log('🎨 CanvasManager インスタンス作成完了（Phase1キャンバス出現確実化版）');
    }

    /**
     * Phase1修正: 初期化メソッド統一（ConfigManager警告完全解消版）
     * CanvasManagerを初期化（ConfigManager統合・AppCore完全統合）
     * @param {object} options - 初期化オプション
     * @param {AppCore} options.appCore - AppCoreインスタンス（必須）
     * @param {HTMLElement} options.canvasElement - キャンバス要素
     * @param {object} options.config - 追加設定（ConfigManager統合）
     * @returns {Promise<boolean>} 成功/失敗
     */
    async initialize(options = {}) {
        try {
            console.log('🚀 CanvasManager初期化開始（Phase1キャンバス出現確実化版）...', options);
            
            if (this.initialized) {
                console.warn('⚠️ CanvasManager already initialized');
                return true;
            }

            // 引数検証・AppCore完全統合（警告解消）
            const validatedOptions = this._validateInitializationOptions(options);
            if (!validatedOptions) {
                throw new Error('Invalid initialization options - AppCore or canvasElement required');
            }

            // AppCore & ConfigManager完全参照保存（警告解消の核心）
            this.appCore = validatedOptions.appCore;
            this.configManager = validatedOptions.configManager; // 直接参照保存
            
            console.log('✅ AppCore & ConfigManager統合完了:', {
                appCoreProvided: !!this.appCore,
                configManagerIntegrated: !!this.configManager,
                hasGetCanvasConfig: !!(this.configManager?.getCanvasConfig),
                hasGetPixiConfig: !!(this.configManager?.getPixiConfig)
            });
            
            // 設定適用（ConfigManager統合強化・警告解消）
            this._applyOptionsWithConfigManager(validatedOptions.config || {});
            
            // PIXI.Application作成（レイヤー基盤として必要）
            await this._createPixiApp();
            
            // キャンバス要素への追加
            await this._attachToContainer(validatedOptions.canvasElement);
            
            // レイヤーシステム初期化
            this._initializeLayerSystem();
            
            // 統一システム連携
            this._integrateWithUnifiedSystems();
            
            // CoordinateManager統合
            this._initializeCoordinateIntegration();
            
            // イベント設定（レイヤー管理として必要なもののみ）
            this._setupEventHandlers();
            
            this.initialized = true;
            
            // 統一システム経由での通知
            const eventBus = this.appCore?.eventBus || window.Tegaki?.EventBusInstance;
            if (eventBus?.safeEmit) {
                eventBus.safeEmit('canvas.initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height,
                    layerCount: this.layers.size,
                    coordinateIntegrationEnabled: this.coordinateIntegrationEnabled,
                    appCoreIntegrated: !!this.appCore,
                    configManagerIntegrated: !!this.configManager
                });
            }
            
            console.log('✅ CanvasManager初期化完了（Phase1キャンバス出現確実化版） - Canvas visible and ready');
            
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化失敗:', error);
            
            const errorManager = this.appCore?.errorManager || 
                                 window.Tegaki?.ErrorManagerInstance;
            if (errorManager?.showError) {
                errorManager.showError('error', `CanvasManager初期化エラー: ${error.message}`, {
                    context: 'CanvasManager.initialize',
                    additionalInfo: 'キャンバス初期化失敗'
                });
            }
            
            // 緊急フォールバック実行
            await this._executeEmergencyCanvasFallback();
            return false;
        }
    }

    /**
     * Phase1修正: 引数検証・フォールバック処理（ConfigManager完全統合版）
     * @param {object} options - 初期化オプション
     * @returns {object|null} 検証済みオプション
     */
    _validateInitializationOptions(options) {
        try {
            // AppCore取得（完全統合対応）
            let appCore = options.appCore;
            
            if (!appCore) {
                // フォールバック1: グローバル参照
                appCore = window.Tegaki?.AppCoreInstance || window.appCore;
                
                if (!appCore) {
                    console.warn('⚠️ AppCore未提供 - 基本フォールバック実行');
                    // Phase1: AppCoreなしでも基本動作させる
                    appCore = null;
                }
            }

            // ConfigManager統合（Phase1最重要・警告解消）
            let configManager = null;
            
            // 優先順序1: options.config.configManager
            if (options.config?.configManager) {
                configManager = options.config.configManager;
                console.log('✅ ConfigManager取得: options.config経由');
            }
            // 優先順序2: AppCore経由
            else if (appCore?.configManager) {
                configManager = appCore.configManager;
                console.log('✅ ConfigManager取得: AppCore経由');
            }
            // 優先順序3: グローバル参照
            else {
                configManager = window.Tegaki?.ConfigManagerInstance || 
                               window.ConfigManager;
                if (configManager) {
                    console.log('✅ ConfigManager取得: グローバル参照経由');
                }
            }

            if (!configManager) {
                console.warn('⚠️ ConfigManager未取得 - options引数のみで動作');
            }

            // canvasElement取得（複数のフォールバック）
            let canvasElement = options.canvasElement;
            
            if (!canvasElement) {
                // フォールバック1: canvas-container
                canvasElement = document.getElementById('canvas-container');
                
                if (!canvasElement) {
                    // フォールバック2: AppCoreから取得
                    if (appCore?.app?.view) {
                        canvasElement = appCore.app.view.parentElement || appCore.app.view;
                    }
                    // フォールバック3: DOM検索
                    else {
                        canvasElement = document.getElementById('drawing-canvas') || 
                                       document.querySelector('.canvas-area') ||
                                       document.querySelector('canvas');
                    }
                }
            }

            if (!canvasElement) {
                console.warn('⚠️ canvasElement未取得 - 動的作成フォールバック');
                canvasElement = this._createFallbackCanvasContainer();
            }

            console.log('📋 初期化オプション検証完了:', {
                appCore: !!appCore,
                configManager: !!configManager,
                canvasElement: !!canvasElement,
                canvasElementType: canvasElement?.tagName || 'unknown'
            });

            return {
                appCore,
                configManager,
                canvasElement,
                config: options.config || {}
            };

        } catch (error) {
            console.error('❌ 引数検証エラー:', error);
            return null;
        }
    }

    /**
     * Phase1修正: 設定適用（ConfigManager警告完全解消版）
     * @param {object} options - 設定オプション
     */
    _applyOptionsWithConfigManager(options) {
        try {
            // ConfigManager統合チェック（警告解消の核心）
            if (this.configManager && 
                typeof this.configManager.getCanvasConfig === 'function' &&
                typeof this.configManager.getPixiConfig === 'function') {
                
                const canvasConfig = this.configManager.getCanvasConfig();
                const pixiConfig = this.configManager.getPixiConfig();
                
                // ConfigManager設定を基本とし、options引数で上書き
                this.pixiSettings.backgroundColor = options.backgroundColor || 
                                                   this._convertColorToHex(canvasConfig.backgroundColor) || 
                                                   this.pixiSettings.backgroundColor;
                this.pixiSettings.antialias = options.antialias !== undefined ? options.antialias : pixiConfig.antialias;
                this.pixiSettings.resolution = options.resolution || pixiConfig.resolution || this.pixiSettings.resolution;
                
                console.log('✅ ConfigManager設定適用完了（警告解消）:', {
                    backgroundColor: this.pixiSettings.backgroundColor,
                    antialias: this.pixiSettings.antialias,
                    resolution: this.pixiSettings.resolution
                });
            } else {
                // フォールバック: options引数のみ（警告表示）
                if (options.backgroundColor !== undefined) {
                    this.pixiSettings.backgroundColor = this._convertColorToHex(options.backgroundColor);
                }
                if (options.antialias !== undefined) {
                    this.pixiSettings.antialias = options.antialias;
                }
                if (options.resolution !== undefined) {
                    this.pixiSettings.resolution = options.resolution;
                }
                
                console.warn('⚠️ ConfigManager未利用 - options引数のみ適用');
                console.log('📋 フォールバック設定:', this.pixiSettings);
            }
            
            // ビュー設定
            if (options.minZoom !== undefined) {
                this.viewState.minZoom = Math.max(0.01, options.minZoom);
            }
            if (options.maxZoom !== undefined) {
                this.viewState.maxZoom = Math.min(10.0, options.maxZoom);
            }
            
        } catch (error) {
            console.warn('⚠️ 設定適用で問題発生:', error);
            // デフォルト設定で継続
        }
    }

    /**
     * 色を16進数に変換（ConfigManager連携用）
     */
    _convertColorToHex(color) {
        try {
            if (typeof color === 'string' && color.startsWith('#')) {
                // #rrggbb形式をPIXI形式（0xrrggbb）に変換
                return parseInt(color.substring(1), 16);
            } else if (typeof color === 'number') {
                return color;
            } else {
                return 0xffffee; // デフォルトふたば背景色
            }
        } catch (error) {
            console.warn('⚠️ 色変換エラー:', error);
            return 0xffffee;
        }
    }

    /**
     * Phase1修正: PIXI.Application作成（ConfigManager統合対応）
     */
    async _createPixiApp() {
        try {
            let config = {
                width: 400,
                height: 400
            };
            
            // ConfigManager統合での設定取得
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
                backgroundColor: this.pixiSettings.backgroundColor,
                antialias: this.pixiSettings.antialias
            });
            
        } catch (error) {
            console.error('❌ PIXI.Application作成エラー:', error);
            throw error;
        }
    }

    /**
     * Phase1修復: キャンバス要素への適切な追加（確実化版）
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    async _attachToContainer(canvasElement) {
        try {
            if (!canvasElement) {
                console.warn('⚠️ canvasElement未提供 - 緊急作成');
                canvasElement = this._createFallbackCanvasContainer();
            }

            // canvasElementがコンテナの場合
            if (canvasElement.tagName !== 'CANVAS') {
                // 既存のcanvas要素があれば削除
                const existingCanvas = canvasElement.querySelector('canvas');
                if (existingCanvas) {
                    existingCanvas.remove();
                    console.log('📋 既存canvas要素を削除');
                }
                
                // PIXIキャンバスを追加
                canvasElement.appendChild(this.app.view);
                this.container = canvasElement;
                console.log('✅ PIXIキャンバスをコンテナに追加完了');
            } 
            // canvasElementが既存のcanvas要素の場合
            else {
                // 親要素に追加し、既存要素は置き換え
                const parent = canvasElement.parentElement;
                if (parent) {
                    parent.replaceChild(this.app.view, canvasElement);
                    this.container = parent;
                    console.log('✅ PIXIキャンバスで既存canvas置き換え完了');
                } else {
                    // 親がない場合はbodyに追加
                    document.body.appendChild(this.app.view);
                    this.container = document.body;
                    console.log('✅ PIXIキャンバスをbodyに直接追加');
                }
            }

            // キャンバス要素の基本設定
            this.app.view.style.cursor = 'crosshair';
            this.app.view.style.touchAction = 'none';
            this.app.view.style.display = 'block';
            
            console.log('✅ キャンバス表示設定完了 - Canvas should now be visible');
            
        } catch (error) {
            console.error('❌ キャンバス要素追加エラー:', error);
            throw error;
        }
    }

    /**
     * フォールバック用キャンバスコンテナ作成（確実化版）
     */
    _createFallbackCanvasContainer() {
        try {
            const container = document.createElement('div');
            container.id = 'canvas-container-fallback';
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
            let targetParent = document.querySelector('.canvas-area') || 
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
     * Phase1修正: 緊急キャンバスフォールバック（確実化版）
     */
    async _executeEmergencyCanvasFallback() {
        try {
            console.log('🛡️ 緊急キャンバスフォールバック実行...');
            
            // 最小限のPixi Application作成
            if (!this.app && window.PIXI) {
                this.app = new PIXI.Application({
                    width: 400,
                    height: 400,
                    backgroundColor: 0xffffee,
                    antialias: true
                });
                this.stage = this.app.stage;
            }
            
            if (this.app) {
                // コンテナ検索・作成
                let container = document.getElementById('canvas-container') ||
                               document.getElementById('canvas-container-fallback') ||
                               this._createFallbackCanvasContainer();
                
                if (container && !container.querySelector('canvas')) {
                    container.appendChild(this.app.view);
                    this.app.view.style.cursor = 'crosshair';
                    this.app.view.style.display = 'block';
                    
                    this.container = container;
                    this.initialized = true; // 基本状態として設定
                    
                    console.log('✅ 緊急フォールバック完了 - Canvas displayed');
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

    _initializeLayerSystem() {
        try {
            // 基本レイヤーを作成
            this.addLayer('background', 'graphics', { zIndex: 0 });
            this.addLayer('main_drawing', 'graphics', { zIndex: 50 });
            
            console.log('✅ Layer system initialized');
        } catch (error) {
            console.error('❌ レイヤーシステム初期化エラー:', error);
        }
    }

    _integrateWithUnifiedSystems() {
        try {
            // StateManagerに初期状態を設定
            const stateManager = this.appCore?.stateManager || 
                                window.Tegaki?.StateManagerInstance;
            if (stateManager) {
                stateManager.updateComponentState('canvasManager', 'initialized', true);
                stateManager.updateComponentState('canvas', 'zoom', this.viewState.zoom);
                stateManager.updateComponentState('canvas', 'layerCount', this.layers.size);
            }
            
            console.log('✅ 統一システム連携完了');
        } catch (error) {
            console.warn('⚠️ 統一システム連携で問題発生:', error);
        }
    }

    _initializeCoordinateIntegration() {
        try {
            // CoordinateManager取得
            this.coordinateManager = this.appCore?.coordinateManager || 
                                    window.Tegaki?.CoordinateManagerInstance;
            
            if (this.coordinateManager) {
                // キャンバスサイズ情報を設定
                if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                    this.coordinateManager.updateCanvasSize(
                        this.app.screen.width, 
                        this.app.screen.height
                    );
                }
                
                this.coordinateIntegrationEnabled = true;
                console.log('✅ CoordinateManager統合完了');
            } else {
                console.warn('⚠️ CoordinateManager利用不可 - 基本座標処理で動作');
                this.coordinateIntegrationEnabled = false;
            }
        } catch (error) {
            console.error('❌ CoordinateManager統合エラー:', error);
            this.coordinateIntegrationEnabled = false;
        }
    }

    _setupEventHandlers() {
        try {
            const canvas = this.app.view;
            
            // レイヤー管理に必要な基本イベント
            canvas.addEventListener('wheel', this._handleWheel.bind(this));
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // Phase1: 基本的なインタラクション設定のみ
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
            
            console.log('✅ 基本イベントハンドラー設定完了');
        } catch (error) {
            console.error('❌ イベントハンドラー設定エラー:', error);
        }
    }

    // ========================================
    // レイヤー管理API（主責務）
    // ========================================

    /**
     * レイヤー追加（主責務）
     * @param {string} layerId - レイヤーID
     * @param {string} type - レイヤータイプ ('graphics', 'sprite', etc.)
     * @param {object} options - レイヤーオプション
     * @returns {PIXI.Container|null}
     */
    addLayer(layerId, type = 'graphics', options = {}) {
        try {
            if (this.layers.has(layerId)) {
                console.warn(`⚠️ Layer ${layerId} already exists - returning existing`);
                return this.layers.get(layerId);
            }

            let layer;
            
            // レイヤータイプ別生成
            switch (type) {
                case 'graphics':
                    layer = new PIXI.Graphics();
                    break;
                case 'container':
                    layer = new PIXI.Container();
                    break;
                case 'sprite':
                    layer = new PIXI.Container(); // Sprite用コンテナ
                    break;
                default:
                    layer = new PIXI.Graphics(); // デフォルトはGraphics
            }

            // レイヤー設定
            layer.name = layerId;
            layer.visible = options.visible !== false;
            layer.alpha = options.alpha || 1.0;
            layer.zIndex = options.zIndex || 0;

            // ステージに追加
            this.stage.addChild(layer);
            this.layers.set(layerId, layer);

            // zIndexでソート
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
     * @param {PIXI.Graphics|PIXI.DisplayObject} graphics - 配置するオブジェクト
     * @param {string} layerId - 配置先レイヤーID
     * @returns {boolean}
     */
    addGraphicsToLayer(graphics, layerId) {
        try {
            if (!graphics) {
                console.warn('⚠️ Graphics未提供 - addGraphicsToLayer スキップ');
                return false;
            }

            let layer = this.layers.get(layerId);
            if (!layer) {
                console.log(`📋 Layer ${layerId} 存在しません - 自動作成`);
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
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     */
    resize(width, height) {
        try {
            if (!this.app) {
                console.warn('⚠️ PIXI.Application未初期化 - リサイズスキップ');
                return false;
            }

            this.app.renderer.resize(width, height);
            
            // ステージのヒットエリア更新
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
            
            console.log(`📐 Canvas resized: ${width}x${height}`);
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスリサイズエラー:', error);
            return false;
        }
    }

    _handleWheel(event) {
        try {
            event.preventDefault();
            // 基本的なホイール処理（Phase1では最小限）
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
            initialized: this.initialized
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
     * 診断情報取得
     */
    getDiagnosticInfo() {
        return {
            initialized: this.initialized,
            appCoreIntegrated: !!this.appCore,
            configManagerIntegrated: !!this.configManager,
            configManagerHasGetCanvasConfig: !!(this.configManager?.getCanvasConfig),
            configManagerHasGetPixiConfig: !!(this.configManager?.getPixiConfig),
            coordinateIntegrationEnabled: this.coordinateIntegrationEnabled,
            pixiAppCreated: !!this.app,
            stageReady: !!this.stage,
            layerCount: this.layers.size,
            canvasVisible: !!(this.app?.view?.parentElement),
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
            // レイヤークリア
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
            
            // プロパティクリア
            this.stage = null;
            this.container = null;
            this.appCore = null;
            this.configManager = null;
            this.coordinateManager = null;
            this.initialized = false;
            
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

console.log('🎨 CanvasManager (Phase1キャンバス出現確実化版) Loaded');
console.log('✨ 修正完了: ConfigManager警告解消・キャンバス出現確実化');
console.log('🚀 Phase1目標: キャンバス基本表示・責務分離維持');
console.log('🔧 使用例: const cm = new CanvasManager(); await cm.initialize({appCore, canvasElement});');