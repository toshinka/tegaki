/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門 (初期化修復版)
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能対応設計
 * 
 * 🔧 PHASE1修復:
 * - 初期化メソッドの引数統一（options形式）
 * - AppCore連携の修正
 * - CoordinateManager統合強化
 * - エラー処理の統一システム完全準拠
 * 
 * 📋 参考定義:
 * - ルールブック: 1.1 責務分離の絶対原則 - CanvasManager
 * - シンボル辞典: CanvasManager系API - 許可されるAPI群
 */

// Tegaki名前空間初期化（Phase1.4stepEX準拠）
window.Tegaki = window.Tegaki || {};

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.layers = new Map(); // レイヤー管理をMapで統一
        this.container = null;
        this.initialized = false; // ← renamed from isInitialized for consistency
        
        // AppCore参照（統合対応）
        this.appCore = null;
        
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
            backgroundColor: 0xf0e0d6, // ふたば風背景色
            resolution: window.devicePixelRatio || 1
        };
        
        console.log('🎨 CanvasManager インスタンス作成完了（初期化修復版）');
    }

    /**
     * 🔧 PHASE1修復: 初期化メソッド統一
     * CanvasManagerを初期化（引数統一・エラー処理強化）
     * @param {object} options - 初期化オプション
     * @param {AppCore} options.appCore - AppCoreインスタンス
     * @param {HTMLElement} options.canvasElement - キャンバス要素
     * @param {object} options.config - 追加設定（オプション）
     * @returns {Promise<boolean>} 成功/失敗
     */
    async initialize(options = {}) {
        try {
            console.log('🚀 CanvasManager初期化開始（修復版）...', options);
            
            if (this.initialized) {
                window.ErrorManager?.showWarning('CanvasManager already initialized', { 
                    context: 'CanvasManager.initialize' 
                });
                return true;
            }

            // 🔧 修正1: 引数検証・フォールバック処理
            const validatedOptions = this._validateInitializationOptions(options);
            if (!validatedOptions) {
                throw new Error('Invalid initialization options provided');
            }

            // AppCore参照を保存
            this.appCore = validatedOptions.appCore;
            
            // 設定適用
            this._applyOptions(validatedOptions.config || {});
            
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
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height,
                    layerCount: this.layers.size,
                    coordinateIntegrationEnabled: this.coordinateIntegrationEnabled
                });
            }
            
            console.log('✅ CanvasManager初期化完了（修復版） - Layer management ready');
            return true;
            
        } catch (error) {
            console.error('❌ CanvasManager初期化失敗:', error);
            
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('error', `CanvasManager初期化エラー: ${error.message}`, {
                    context: 'CanvasManager.initialize',
                    additionalInfo: 'キャンバス初期化失敗',
                    showReload: true
                });
            }
            return false;
        }
    }

    /**
     * 🔧 PHASE1修復: 引数検証・フォールバック処理
     * @param {object} options - 初期化オプション
     * @returns {object|null} 検証済みオプション
     */
    _validateInitializationOptions(options) {
        try {
            // AppCore取得（複数のフォールバック）
            let appCore = options.appCore || options.appCoreInstance || window.appCore;
            if (!appCore) {
                console.warn('⚠️ AppCore未提供 - 基本機能のみで動作');
            }

            // canvasElement取得（複数のフォールバック）
            let canvasElement = options.canvasElement;
            
            if (!canvasElement) {
                // フォールバック1: AppCoreから取得
                if (appCore?.app?.view) {
                    canvasElement = appCore.app.view;
                    console.log('✅ canvasElement取得: AppCore.app.view経由');
                } 
                // フォールバック2: DOM検索
                else {
                    canvasElement = document.getElementById('drawing-canvas') || 
                                   document.querySelector('canvas') ||
                                   document.getElementById('canvas-container');
                    
                    if (canvasElement) {
                        console.log('✅ canvasElement取得: DOM検索経由');
                    }
                }
            }

            if (!canvasElement) {
                console.error('❌ canvasElement取得失敗 - 基本的なcanvas要素またはコンテナが必要');
                return null;
            }

            return {
                appCore,
                canvasElement,
                config: options.config || {}
            };

        } catch (error) {
            console.error('❌ 引数検証エラー:', error);
            return null;
        }
    }

    /**
     * 🔧 PHASE1修復: キャンバス要素への適切な追加
     * @param {HTMLElement} canvasElement - キャンバス要素
     */
    async _attachToContainer(canvasElement) {
        try {
            // canvasElementがコンテナの場合（drawing-canvasなど）
            if (canvasElement.tagName !== 'CANVAS') {
                // コンテナに追加
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
                    throw new Error('既存canvas要素に親要素が存在しません');
                }
            }

            // キャンバス要素の基本設定
            this.app.view.style.cursor = 'crosshair';
            this.app.view.style.touchAction = 'none'; // タッチスクロール防止
            
        } catch (error) {
            console.error('❌ キャンバス要素追加エラー:', error);
            throw error;
        }
    }

    /**
     * 🆕 PHASE1修復: CoordinateManager統合初期化
     */
    _initializeCoordinateIntegration() {
        try {
            if (window.CoordinateManager) {
                // AppCore経由でCoordinateManagerを取得
                this.coordinateManager = this.appCore?.coordinateManager || 
                                        window.CoordinateManagerInstance ||
                                        new window.CoordinateManager();
                
                if (this.coordinateManager) {
                    // キャンバスサイズ情報を設定
                    if (typeof this.coordinateManager.updateCanvasSize === 'function') {
                        this.coordinateManager.updateCanvasSize(
                            this.app.screen.width, 
                            this.app.screen.height
                        );
                    }
                    
                    // キャンバス要素を設定
                    if (typeof this.coordinateManager.setCanvasElement === 'function') {
                        this.coordinateManager.setCanvasElement(this.app.view);
                    }
                    
                    this.coordinateIntegrationEnabled = true;
                    console.log('✅ CoordinateManager統合完了');
                }
            } else {
                console.warn('⚠️ CoordinateManager利用不可 - 基本座標処理で動作');
                this.coordinateIntegrationEnabled = false;
            }
        } catch (error) {
            console.error('❌ CoordinateManager統合エラー:', error);
            this.coordinateIntegrationEnabled = false;
        }
    }

    /**
     * 🆕 PHASE1修復: CoordinateManager統合状態取得
     */
    getCoordinateIntegrationState() {
        return {
            coordinateManagerAvailable: !!this.coordinateManager,
            integrationEnabled: this.coordinateIntegrationEnabled,
            duplicateElimination: this.coordinateIntegrationEnabled && 
                                  !!this.coordinateManager?.extractPointerCoordinates
        };
    }

    /**
     * 🔧 PHASE1修復: イベントハンドラー設定（描画処理をToolに委譲）
     */
    _setupEventHandlers() {
        try {
            const canvas = this.app.view;
            
            // レイヤー管理に必要な基本イベント
            canvas.addEventListener('wheel', this._handleWheel.bind(this));
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());
            
            // 🔧 PHASE1修復: 描画イベントはToolManagerに委譲
            // Stage上でのマウス/タッチイベントを設定し、ToolManagerに転送
            this.app.stage.interactive = true;
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
            
            // PointerEventをToolManagerに委譲
            this.app.stage.on('pointerdown', this._delegateToToolManager.bind(this, 'pointerdown'));
            this.app.stage.on('pointermove', this._delegateToToolManager.bind(this, 'pointermove'));
            this.app.stage.on('pointerup', this._delegateToToolManager.bind(this, 'pointerup'));
            this.app.stage.on('pointerupoutside', this._delegateToToolManager.bind(this, 'pointerup'));
            
            console.log('✅ イベントハンドラー設定完了（ToolManager委譲方式）');
            
        } catch (error) {
            console.error('❌ イベントハンドラー設定エラー:', error);
        }
    }

    /**
     * 🔧 PHASE1修復: ToolManagerへのイベント委譲
     * @param {string} eventType - イベントタイプ
     * @param {PIXI.FederatedEvent} event - PIXIイベント
     */
    _delegateToToolManager(eventType, event) {
        try {
            // ToolManager取得
            let toolManager = this.appCore?.toolManager || 
                            window.ToolManagerInstance ||
                            (window.Tegaki && window.Tegaki.ToolManagerInstance);
            
            if (!toolManager) {
                console.warn('⚠️ ToolManager利用不可 - イベント処理スキップ');
                return;
            }

            // 座標情報の統合処理
            let coords = null;
            
            if (this.coordinateManager && typeof this.coordinateManager.extractPointerCoordinates === 'function') {
                // CoordinateManager経由での座標取得（統合版）
                coords = this.coordinateManager.extractPointerCoordinates(
                    event.data.originalEvent, 
                    this.app.view.getBoundingClientRect(), 
                    this.app
                );
            } else {
                // フォールバック座標処理
                coords = this._extractCoordinatesFallback(event);
            }

            if (!coords) {
                console.warn('⚠️ 座標取得失敗 - イベント処理スキップ');
                return;
            }

            // ToolManagerのメソッド呼び出し
            const methodMap = {
                'pointerdown': 'startDrawing',
                'pointermove': 'continueDrawing',
                'pointerup': 'stopDrawing'
            };

            const method = methodMap[eventType];
            if (method && typeof toolManager[method] === 'function') {
                if (method === 'startDrawing' || method === 'stopDrawing') {
                    toolManager[method](coords.canvas.x, coords.canvas.y, coords.pressure || 0.5);
                } else if (method === 'continueDrawing') {
                    toolManager[method](coords.canvas.x, coords.canvas.y, coords.pressure || 0.5);
                }
            }

        } catch (error) {
            console.error(`❌ ToolManager委譲エラー (${eventType}):`, error);
        }
    }

    /**
     * 🔧 フォールバック座標処理（CoordinateManager未使用時）
     * @param {PIXI.FederatedEvent} event - PIXIイベント
     */
    _extractCoordinatesFallback(event) {
        try {
            const rect = this.app.view.getBoundingClientRect();
            const originalEvent = event.data.originalEvent;
            
            return {
                canvas: {
                    x: originalEvent.clientX - rect.left,
                    y: originalEvent.clientY - rect.top
                },
                pressure: originalEvent.pressure || 0.5,
                pointerId: originalEvent.pointerId || 1
            };
        } catch (error) {
            console.error('❌ フォールバック座標処理エラー:', error);
            return null;
        }
    }

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
            
            // 統一システム経由での通知
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('layer.added', {
                    layerId,
                    type,
                    options
                });
            }

            console.log(`✅ Layer added: ${layerId} (${type})`);
            return layer;
            
        } catch (error) {
            console.error('❌ レイヤー追加エラー:', error);
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('warning', `Layer追加エラー: ${error.message}`, {
                    context: 'CanvasManager.addLayer',
                    layerId, type
                });
            }
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
            
            // 統一システム経由での通知
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('graphics.added', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
            
        } catch (error) {
            console.error('❌ Graphics配置エラー:', error);
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('warning', `Graphics配置エラー: ${error.message}`, {
                    context: 'CanvasManager.addGraphicsToLayer',
                    layerId
                });
            }
            return false;
        }
    }

    /**
     * レイヤーからGraphicsを削除
     * @param {PIXI.Graphics|PIXI.DisplayObject} graphics - 削除するオブジェクト
     * @param {string} layerId - レイヤーID
     * @returns {boolean}
     */
    removeGraphicsFromLayer(graphics, layerId) {
        try {
            const layer = this.layers.get(layerId);
            if (!layer) {
                console.warn(`⚠️ Layer ${layerId} not found`);
                return false;
            }

            if (!graphics) {
                console.warn('⚠️ Graphics未提供 - removeGraphicsFromLayer スキップ');
                return false;
            }

            layer.removeChild(graphics);
            
            // 統一システム経由での通知
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('graphics.removed', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
            
        } catch (error) {
            console.error('❌ Graphics削除エラー:', error);
            return false;
        }
    }

    /**
     * レイヤー表示切り替え
     * @param {string} layerId - レイヤーID
     * @param {boolean} visible - 表示/非表示
     */
    setLayerVisibility(layerId, visible) {
        try {
            const layer = this.layers.get(layerId);
            if (layer) {
                layer.visible = visible;
                
                if (window.EventBus?.safeEmit) {
                    window.EventBus.safeEmit('layer.visibility', {
                        layerId,
                        visible
                    });
                }
                
                console.log(`📋 Layer ${layerId} visibility: ${visible}`);
            }
        } catch (error) {
            console.error('❌ レイヤー表示切り替えエラー:', error);
        }
    }

    /**
     * ツール用レイヤーを取得（Tool統合機能）
     * @param {string} toolName - ツール名
     * @returns {PIXI.Graphics|null}
     */
    getLayerForTool(toolName) {
        const layerId = `tool_${toolName}`;
        
        if (!this.layers.has(layerId)) {
            this.addLayer(layerId, 'graphics', {
                zIndex: 100 // ツールレイヤーは前面
            });
        }
        
        return this.layers.get(layerId);
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
                    // Container の場合は子要素をすべて削除
                    while (layer.children.length > 0) {
                        layer.removeChild(layer.children[0]);
                    }
                }
            });
            
            // 統一システム経由での状態更新
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvas', 'hasContent', false);
                window.StateManager.updateComponentState('canvas', 'isDirty', false);
            }
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.cleared', {
                    layerCount: this.layers.size
                });
            }
            
            console.log('✅ All layers cleared');
        } catch (error) {
            console.error('❌ レイヤークリアエラー:', error);
        }
    }

    /**
     * リサイズ処理（AppCoreとの統合対応）
     * @param {number} width - 新しい幅
     * @param {number} height - 新しい高さ
     * @param {boolean} centerContent - コンテンツを中央寄せするか
     */
    resize(width, height, centerContent = false) {
        try {
            if (!this.app) {
                console.warn('⚠️ PIXI.Application未初期化 - リサイズスキップ');
                return false;
            }

            const oldWidth = this.app.screen.width;
            const oldHeight = this.app.screen.height;

            this.app.renderer.resize(width, height);
            
            // ステージのヒットエリア更新
            this.app.stage.hitArea = new PIXI.Rectangle(0, 0, width, height);
            
            if (centerContent) {
                const deltaX = (width - oldWidth) / 2;
                const deltaY = (height - oldHeight) / 2;
                this.pan(deltaX, deltaY);
            }

            // CoordinateManager更新
            if (this.coordinateManager && typeof this.coordinateManager.updateCanvasSize === 'function') {
                this.coordinateManager.updateCanvasSize(width, height);
            }
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.resized', { 
                    width, height, centerContent,
                    oldWidth, oldHeight
                });
            }
            
            console.log(`📐 Canvas resized: ${width}x${height} (center: ${centerContent})`);
            return true;
            
        } catch (error) {
            console.error('❌ キャンバスリサイズエラー:', error);
            if (window.ErrorManager?.showError) {
                window.ErrorManager.showError('error', `キャンバスリサイズエラー: ${error.message}`, {
                    context: 'CanvasManager.resize',
                    width, height
                });
            }
            return false;
        }
    }

    /**
     * ビュー操作：パン
     * @param {number} dx - X方向移動量
     * @param {number} dy - Y方向移動量
     */
    pan(dx, dy) {
        try {
            this.viewState.panX += dx;
            this.viewState.panY += dy;
            
            this.stage.x = this.viewState.panX;
            this.stage.y = this.viewState.panY;
            
            // CoordinateManagerに変換パラメーター通知
            if (this.coordinateManager && typeof this.coordinateManager.setTransform === 'function') {
                this.coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.pan', {
                    dx, dy,
                    panX: this.viewState.panX,
                    panY: this.viewState.panY
                });
            }
        } catch (error) {
            console.error('❌ パン操作エラー:', error);
        }
    }

    /**
     * ビュー操作：ズーム
     * @param {number} scale - スケール値
     * @param {object} center - ズーム中心点 {x, y}（オプション）
     */
    setZoom(scale, center = null) {
        try {
            const newZoom = Math.max(this.viewState.minZoom, Math.min(this.viewState.maxZoom, scale));
            
            if (center) {
                const oldZoom = this.viewState.zoom;
                const zoomRatio = newZoom / oldZoom;
                
                this.viewState.panX = center.x - (center.x - this.viewState.panX) * zoomRatio;
                this.viewState.panY = center.y - (center.y - this.viewState.panY) * zoomRatio;
                
                this.stage.x = this.viewState.panX;
                this.stage.y = this.viewState.panY;
            }
            
            this.viewState.zoom = newZoom;
            this.stage.scale.set(newZoom);
            
            // CoordinateManagerに変換パラメーター通知
            if (this.coordinateManager && typeof this.coordinateManager.setTransform === 'function') {
                this.coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.zoom', {
                    zoom: newZoom,
                    center
                });
            }
        } catch (error) {
            console.error('❌ ズーム操作エラー:', error);
        }
    }

    /**
     * ビューリセット
     */
    resetView() {
        try {
            this.viewState.zoom = 1.0;
            this.viewState.panX = 0;
            this.viewState.panY = 0;
            
            this.stage.scale.set(1.0);
            this.stage.x = 0;
            this.stage.y = 0;
            
            if (this.coordinateManager && typeof this.coordinateManager.setTransform === 'function') {
                this.coordinateManager.setTransform(1.0, 0, 0);
            }
            
            this._updateViewState();
            
            if (window.EventBus?.safeEmit) {
                window.EventBus.safeEmit('canvas.reset');
            }
            
            console.log('📐 View reset to default');
        } catch (error) {
            console.error('❌ ビューリセットエラー:', error);
        }
    }

    // ========================================
    // アクセサメソッド（Tool統合用）
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

    // ========================================
    // 内部メソッド（レイヤー管理専門）
    // ========================================

    async _createPixiApp() {
        try {
            const config = window.ConfigManager?.getCanvasConfig() || {};
            
            this.app = new PIXI.Application({
                width: config.width || 400,
                height: config.height || 400,
                antialias: this.pixiSettings.antialias,
                backgroundColor: this.pixiSettings.backgroundColor,
                resolution: this.pixiSettings.resolution,
                autoDensity: true
            });

            this.stage = this.app.stage;
            console.log('✅ PIXI.Application created for layer management');
            
        } catch (error) {
            console.error('❌ PIXI.Application作成エラー:', error);
            throw error;
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
            throw error;
        }
    }

    _integrateWithUnifiedSystems() {
        try {
            // StateManagerに初期状態を設定
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvasManager', 'initialized', true);
                window.StateManager.updateComponentState('canvas', 'zoom', this.viewState.zoom);
                window.StateManager.updateComponentState('canvas', 'layerCount', this.layers.size);
            }
            
            console.log('✅ 統一システム連携完了');
        } catch (error) {
            console.warn('⚠️ 統一システム連携で問題発生:', error);
        }
    }

    _applyOptions(options) {
        try {
            if (options.backgroundColor !== undefined) {
                this.pixiSettings.backgroundColor = options.backgroundColor;
            }
            if (options.antialias !== undefined) {
                this.pixiSettings.antialias = options.antialias;
            }
            if (options.resolution !== undefined) {
                this.pixiSettings.resolution = options.resolution;
            }
            
            // ビュー設定
            if (options.minZoom !== undefined) {
                this.viewState.minZoom = Math.max(0.01, options.minZoom);
            }
            if (options.maxZoom !== undefined) {
                this.viewState.maxZoom = Math.min(10.0, options.maxZoom);
            }
            
        } catch (error) {
            console.warn('⚠️ オプション適用で問題発生:', error);
        }
    }

    _updateViewState() {
        try {
            if (window.StateManager) {
                window.StateManager.updateComponentState('canvas', 'zoom', this.viewState.zoom);
                window.StateManager.updateComponentState('canvas', 'panX', this.viewState.panX);
                window.StateManager.updateComponentState('canvas', 'panY', this.viewState.panY);
            }
        } catch (error) {
            console.warn('⚠️ ビュー状態更新で問題発生:', error);
        }
    }

    _handleWheel(event) {
        try {
            event.preventDefault();
            
            const config = window.ConfigManager?.get('interaction') || {};
            const zoomSpeed = config.zoomSpeed || 0.1;
            const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            const newZoom = this.viewState.zoom * (1 + delta);
            
            const rect = this.app.view.getBoundingClientRect();
            const center = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            
            this.setZoom(newZoom, center);
        } catch (error) {
            console.error('❌ ホイール処理エラー:', error);
        }
    }

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
            this.coordinateManager = null;
            this.initialized = false;
            
            console.log('🎨 CanvasManager 破棄完了');
            
        } catch (error) {
            console.error('❌ CanvasManager破棄エラー:', error);
        }
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
window.Tegaki.CanvasManager = CanvasManager;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
window.Tegaki._registry = window.Tegaki._registry || [];
window.Tegaki._registry.push(() => {
    window.Tegaki.CanvasManagerInstance = new CanvasManager();
    console.log('🎨 CanvasManager registered to Tegaki namespace');
});

// グローバル登録（下位互換）
if (typeof window !== 'undefined') {
    window.CanvasManager = CanvasManager;
}

// 🔄 PixiJS v8対応準備コメント
// - PIXI.Graphics.lineStyle() → PIXI.Graphics.stroke()
// - PIXI.BLEND_MODES → PIXI.BlendMode enum
// - レイヤーシステム強化対応準備済み

console.log('🎨 CanvasManager (Phase1修復版) Loaded - 初期化引数統一・CoordinateManager統合・ToolManager委譲対応');