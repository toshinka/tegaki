/**
 * 🎨 CanvasManager - レイヤー・ステージ管理専門
 * 🚫 DRAWING_PROHIBITION: 直接的な描画処理は禁止
 * ✅ LAYER_MANAGEMENT: レイヤー生成・管理・Graphics配置のみ
 * 🔄 TOOL_INTEGRATION: Toolが生成したオブジェクトの受け皿
 * 📋 RESPONSIBILITY: 「紙とレイヤー」の管理者
 * 
 * 📏 DESIGN_PRINCIPLE: Tool → Graphics生成, CanvasManager → レイヤー配置
 * 🎯 FUTURE_PROOF: レイヤーシステム・動画機能対応設計
 * 
 * 🔧 修正内容:
 * - addChild null参照エラー対策（stage初期化確認強化）
 * - PIXI.Application初期化順序保証
 * - レイヤー作成時のnullチェック追加
 * - エラーハンドリング強化
 * 
 * 座標バグ修正重要事項:
 * - CanvasManagerは描画処理を行わない（Tool委譲）
 * - Graphics配置・レイヤー管理に専念
 * - 座標変換はCoordinateManager経由でTool側が実行
 */

// Tegaki名前空間初期化（Phase1.4stepEX準拠）
window.Tegaki = window.Tegaki || {};

class CanvasManager {
    constructor() {
        this.app = null;
        this.stage = null;
        this.layers = new Map(); // レイヤー管理をMapで統一
        this.container = null;
        this.isInitialized = false;
        
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
            backgroundColor: 0xffffee, // ふたば背景色
            resolution: window.devicePixelRatio || 1
        };
        
        // ✅ 統一システム依存（Phase1.4stepEX準拠）
        // この段階では直接参照、レジストリ初期化後はTegaki経由に変更予定
    }

    /**
     * CanvasManagerを初期化（修正：PIXI初期化強化・null対策）
     * @param {HTMLElement} container - コンテナ要素
     * @param {object} options - 初期化オプション
     * @returns {boolean} 成功/失敗
     */
    initialize(container, options = {}) {
        try {
            if (this.isInitialized) {
                console.warn('[CanvasManager] 既に初期化済みです');
                return true;
            }

            // 修正：PIXI存在確認強化
            if (typeof PIXI === 'undefined') {
                throw new Error('PIXI.js が読み込まれていません');
            }

            if (!container) {
                throw new Error('コンテナ要素が提供されていません');
            }

            this.container = container;
            
            // オプション適用
            this._applyOptions(options);
            
            // PIXI.Application作成（修正：エラーハンドリング強化）
            const createResult = this._createPixiApp();
            if (!createResult) {
                throw new Error('PIXI.Application の作成に失敗しました');
            }
            
            // 修正：stage null チェック強化
            if (!this.app || !this.app.stage) {
                throw new Error('PIXI Stage の初期化に失敗しました');
            }

            this.stage = this.app.stage;
            
            // レイヤーシステム初期化
            this._initializeLayerSystem();
            
            // DOM追加（修正：view存在確認）
            if (!this.app.view) {
                throw new Error('PIXI Canvas view の作成に失敗しました');
            }

            // 既存のキャンバスがあれば削除
            const existingCanvas = container.querySelector('canvas');
            if (existingCanvas) {
                existingCanvas.remove();
            }

            container.appendChild(this.app.view);
            
            // 統一システム連携
            this._integrateWithUnifiedSystems();
            
            // イベント設定（レイヤー管理として必要なもののみ）
            this._setupLayerEvents();
            
            this.isInitialized = true;
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height
                });
            }
            
            console.log(`[CanvasManager] ✅ 初期化完了 - ${this.app.screen.width}x${this.app.screen.height}`);
            return true;
            
        } catch (error) {
            console.error('[CanvasManager] ❌ 初期化エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.initialize', 'error', true);
            }
            
            return false;
        }
    }

    /**
     * レイヤー追加（修正：null チェック強化）
     * @param {string} layerId - レイヤーID
     * @param {string} type - レイヤータイプ ('graphics', 'sprite', etc.)
     * @param {object} options - レイヤーオプション
     * @returns {PIXI.Container|null}
     */
    addLayer(layerId, type = 'graphics', options = {}) {
        try {
            // 修正：事前条件確認強化
            if (!this.stage) {
                console.error('[CanvasManager:CanvasManager.addLayer] Cannot read properties of null (reading \'addChild\')');
                throw new Error('Stage が初期化されていません - initialize() を先に実行してください');
            }

            if (this.layers.has(layerId)) {
                console.warn(`[CanvasManager] レイヤー ${layerId} は既に存在します`);
                return this.layers.get(layerId);
            }

            let layer;
            
            // レイヤータイプ別生成（修正：PIXI存在確認）
            if (typeof PIXI === 'undefined') {
                throw new Error('PIXI が利用できません');
            }

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

            if (!layer) {
                throw new Error(`レイヤー作成に失敗しました (type: ${type})`);
            }

            // レイヤー設定
            layer.name = layerId;
            layer.visible = options.visible !== false;
            layer.alpha = options.alpha || 1.0;
            layer.zIndex = options.zIndex || 0;

            // ステージに追加（修正：addChild確認）
            if (typeof this.stage.addChild !== 'function') {
                throw new Error('Stage.addChild が利用できません');
            }

            this.stage.addChild(layer);
            this.layers.set(layerId, layer);

            // zIndexでソート
            this.stage.sortableChildren = true;
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('layer:added', {
                    layerId,
                    type,
                    options
                });
            }

            console.log(`[CanvasManager] ✅ レイヤー追加完了: ${layerId} (${type})`);
            return layer;
            
        } catch (error) {
            console.error(`[CanvasManager] ❌ レイヤー追加エラー (${layerId}):`, error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.addLayer');
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
                throw new Error('Graphics オブジェクトが提供されていません');
            }

            let layer = this.layers.get(layerId);
            if (!layer) {
                // レイヤーが存在しない場合は自動作成
                console.log(`[CanvasManager] レイヤー ${layerId} を自動作成します`);
                layer = this.addLayer(layerId, 'graphics');
                
                if (!layer) {
                    throw new Error(`レイヤー ${layerId} の自動作成に失敗しました`);
                }
            }

            if (typeof layer.addChild !== 'function') {
                throw new Error(`レイヤー ${layerId} は addChild をサポートしていません`);
            }

            layer.addChild(graphics);
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('graphics:added', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
            
        } catch (error) {
            console.error(`[CanvasManager] ❌ Graphics配置エラー (${layerId}):`, error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.addGraphicsToLayer');
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
                console.warn(`[CanvasManager] レイヤー ${layerId} が存在しません`);
                return false;
            }

            if (typeof layer.removeChild !== 'function') {
                throw new Error(`レイヤー ${layerId} は removeChild をサポートしていません`);
            }

            layer.removeChild(graphics);
            
            // 統一システム経由での通知
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('graphics:removed', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
            
        } catch (error) {
            console.error(`[CanvasManager] ❌ Graphics削除エラー (${layerId}):`, error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.removeGraphicsFromLayer');
            }
            
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
                
                const eventBus = Tegaki.EventBusInstance || window.EventBus;
                if (eventBus) {
                    eventBus.emit('layer:visibility', {
                        layerId,
                        visible
                    });
                }
                
                console.log(`[CanvasManager] レイヤー ${layerId} 表示切り替え: ${visible}`);
            } else {
                console.warn(`[CanvasManager] レイヤー ${layerId} が見つかりません`);
            }
        } catch (error) {
            console.error('[CanvasManager] ❌ レイヤー表示切り替えエラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.setLayerVisibility');
            }
        }
    }

    /**
     * ツール用レイヤーを取得（Tool統合機能）
     * @param {string} toolName - ツール名
     * @returns {PIXI.Graphics|null}
     */
    getLayerForTool(toolName) {
        try {
            const layerId = `tool_${toolName}`;
            
            if (!this.layers.has(layerId)) {
                console.log(`[CanvasManager] ツール用レイヤー作成: ${layerId}`);
                const layer = this.addLayer(layerId, 'graphics', {
                    zIndex: 100 // ツールレイヤーは前面
                });
                
                if (!layer) {
                    throw new Error(`ツール用レイヤー ${layerId} の作成に失敗しました`);
                }
            }
            
            return this.layers.get(layerId);
            
        } catch (error) {
            console.error(`[CanvasManager] ❌ ツール用レイヤー取得エラー (${toolName}):`, error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.getLayerForTool');
            }
            
            return null;
        }
    }

    /**
     * 全レイヤークリア
     */
    clear() {
        try {
            this.layers.forEach((layer, layerId) => {
                if (layer && typeof layer.clear === 'function') {
                    layer.clear();
                } else if (layer && layer.children) {
                    layer.removeChildren();
                }
            });
            
            // 統一システム経由での状態更新
            const stateManager = Tegaki.StateManagerInstance || window.StateManager;
            if (stateManager) {
                stateManager.set?.('canvas.hasContent', false);
                stateManager.set?.('canvas.isDirty', false);
            }
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:cleared');
            }
            
            console.log('[CanvasManager] ✅ 全レイヤークリア完了');
            
        } catch (error) {
            console.error('[CanvasManager] ❌ レイヤークリアエラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.clear');
            }
        }
    }

    /**
     * ビュー操作：パン
     * @param {number} dx - X方向移動量
     * @param {number} dy - Y方向移動量
     */
    pan(dx, dy) {
        try {
            if (!this.stage) {
                console.warn('[CanvasManager] Stage が初期化されていません');
                return;
            }

            this.viewState.panX += dx;
            this.viewState.panY += dy;
            
            this.stage.x = this.viewState.panX;
            this.stage.y = this.viewState.panY;
            
            // CoordinateManagerに変換パラメーター通知
            const coordinateManager = Tegaki.CoordinateManagerInstance || window.CoordinateManager;
            if (coordinateManager && typeof coordinateManager.setTransform === 'function') {
                coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:pan', {
                    dx, dy,
                    panX: this.viewState.panX,
                    panY: this.viewState.panY
                });
            }
            
        } catch (error) {
            console.error('[CanvasManager] ❌ パン操作エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.pan');
            }
        }
    }

    /**
     * ビュー操作：ズーム
     * @param {number} scale - スケール値
     * @param {object} center - ズーム中心点 {x, y}（オプション）
     */
    setZoom(scale, center = null) {
        try {
            if (!this.stage) {
                console.warn('[CanvasManager] Stage が初期化されていません');
                return;
            }

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
            const coordinateManager = Tegaki.CoordinateManagerInstance || window.CoordinateManager;
            if (coordinateManager && typeof coordinateManager.setTransform === 'function') {
                coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:zoom', {
                    zoom: newZoom,
                    center
                });
            }
            
        } catch (error) {
            console.error('[CanvasManager] ❌ ズーム操作エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.setZoom');
            }
        }
    }

    /**
     * ビューリセット
     */
    resetView() {
        try {
            if (!this.stage) {
                console.warn('[CanvasManager] Stage が初期化されていません');
                return;
            }

            this.viewState.zoom = 1.0;
            this.viewState.panX = 0;
            this.viewState.panY = 0;
            
            this.stage.scale.set(1.0);
            this.stage.x = 0;
            this.stage.y = 0;
            
            const coordinateManager = Tegaki.CoordinateManagerInstance || window.CoordinateManager;
            if (coordinateManager && typeof coordinateManager.setTransform === 'function') {
                coordinateManager.setTransform(1.0, 0, 0);
            }
            
            this._updateViewState();
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:reset');
            }
            
            console.log('[CanvasManager] ✅ ビューリセット完了');
            
        } catch (error) {
            console.error('[CanvasManager] ❌ ビューリセットエラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.resetView');
            }
        }
    }

    /**
     * リサイズ処理
     */
    resize(width, height) {
        try {
            if (!this.app || !this.app.renderer) {
                throw new Error('PIXI Application またはRenderer が初期化されていません');
            }

            this.app.renderer.resize(width, height);
            
            const coordinateManager = Tegaki.CoordinateManagerInstance || window.CoordinateManager;
            if (coordinateManager && typeof coordinateManager.setTransform === 'function') {
                coordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            const eventBus = Tegaki.EventBusInstance || window.EventBus;
            if (eventBus) {
                eventBus.emit('canvas:resize', { width, height });
            }
            
            console.log(`[CanvasManager] ✅ リサイズ完了: ${width}x${height}`);
            
        } catch (error) {
            console.error('[CanvasManager] ❌ リサイズエラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager.resize');
            }
        }
    }

    // ========================================
    // アクセサメソッド（Tool統合用）
    // ========================================

    getPixiApp() { return this.app; }
    getStage() { return this.stage; }
    getLayer(layerId) { return this.layers.get(layerId); }
    
    getViewInfo() {
        return {
            zoom: this.viewState.zoom,
            panX: this.viewState.panX,
            panY: this.viewState.panY,
            canvasWidth: this.app?.screen.width || 0,
            canvasHeight: this.app?.screen.height || 0
        };
    }

    // ========================================
    // 内部メソッド（レイヤー管理専門）
    // ========================================

    /**
     * PIXI.Application作成（修正：エラーハンドリング強化）
     * @private
     * @returns {boolean}
     */
    _createPixiApp() {
        try {
            const config = (Tegaki.ConfigManagerInstance || window.ConfigManager)?.get?.('canvas') || {};
            
            const appConfig = {
                width: config.width || 400,
                height: config.height || 400,
                antialias: this.pixiSettings.antialias,
                backgroundColor: this.pixiSettings.backgroundColor,
                resolution: this.pixiSettings.resolution,
                autoDensity: true
            };

            console.log('[CanvasManager] PIXI.Application設定:', appConfig);

            this.app = new PIXI.Application(appConfig);
            
            if (!this.app) {
                throw new Error('PIXI.Application の作成に失敗しました');
            }

            if (!this.app.stage) {
                throw new Error('PIXI.Stage の初期化に失敗しました');
            }

            console.log('[CanvasManager] ✅ PIXI.Application作成完了');
            return true;
            
        } catch (error) {
            console.error('[CanvasManager] ❌ PIXI.Application作成エラー:', error);
            return false;
        }
    }

    /**
     * レイヤーシステム初期化
     * @private
     */
    _initializeLayerSystem() {
        try {
            // 基本レイヤーを作成
            const basicLayers = [
                { id: 'background', type: 'graphics', zIndex: 0 },
                { id: 'main_drawing', type: 'graphics', zIndex: 50 }
            ];

            let successCount = 0;
            basicLayers.forEach(({ id, type, zIndex }) => {
                const layer = this.addLayer(id, type, { zIndex });
                if (layer) {
                    successCount++;
                }
            });
            
            console.log(`[CanvasManager] ✅ レイヤーシステム初期化完了: ${successCount}/${basicLayers.length}レイヤー`);
            
        } catch (error) {
            console.error('[CanvasManager] ❌ レイヤーシステム初期化エラー:', error);
        }
    }

    /**
     * 統一システム統合
     * @private
     */
    _integrateWithUnifiedSystems() {
        try {
            // CoordinateManagerにキャンバス要素を設定
            const coordinateManager = Tegaki.CoordinateManagerInstance || window.CoordinateManager;
            if (coordinateManager && this.app && this.app.view) {
                if (typeof coordinateManager.setCanvasElement === 'function') {
                    coordinateManager.setCanvasElement(this.app.view);
                    console.log('[CanvasManager] ✅ CoordinateManager統合完了');
                }
            }
            
        } catch (error) {
            console.error('[CanvasManager] ❌ 統一システム統合エラー:', error);
        }
    }

    /**
     * レイヤーイベント設定
     * @private
     */
    _setupLayerEvents() {
        try {
            if (!this.app || !this.app.view) {
                console.warn('[CanvasManager] Canvas view が利用できません');
                return;
            }

            const canvas = this.app.view;
            
            // 基本イベントのみ（レイヤー管理に必要なもの）
            canvas.addEventListener('wheel', this._handleWheel.bind(this), { passive: false });
            canvas.addEventListener('contextmenu', (e) => e.preventDefault());

            console.log('[CanvasManager] ✅ レイヤーイベント設定完了');
            
        } catch (error) {
            console.error('[CanvasManager] ❌ レイヤーイベント設定エラー:', error);
        }
    }

    /**
     * オプション適用
     * @private
     */
    _applyOptions(options) {
        try {
            if (options.backgroundColor !== undefined) {
                // 色の形式を変換（CSS色 → PIXI色）
                if (typeof options.backgroundColor === 'string') {
                    if (options.backgroundColor.startsWith('#')) {
                        this.pixiSettings.backgroundColor = parseInt(options.backgroundColor.slice(1), 16);
                    } else {
                        // CSS色名の処理が必要な場合は追加
                        this.pixiSettings.backgroundColor = 0xffffee; // デフォルト
                    }
                } else {
                    this.pixiSettings.backgroundColor = options.backgroundColor;
                }
            }
            
            if (options.antialias !== undefined) {
                this.pixiSettings.antialias = options.antialias;
            }
            
            if (options.resolution !== undefined) {
                this.pixiSettings.resolution = options.resolution;
            }
            
        } catch (error) {
            console.error('[CanvasManager] ❌ オプション適用エラー:', error);
        }
    }

    /**
     * ビュー状態更新
     * @private
     */
    _updateViewState() {
        try {
            const stateManager = Tegaki.StateManagerInstance || window.StateManager;
            if (stateManager) {
                stateManager.set?.('canvas.zoom', this.viewState.zoom);
                stateManager.set?.('canvas.panX', this.viewState.panX);
                stateManager.set?.('canvas.panY', this.viewState.panY);
            }
        } catch (error) {
            console.error('[CanvasManager] ❌ ビュー状態更新エラー:', error);
        }
    }

    /**
     * ホイールイベント処理
     * @private
     */
    _handleWheel(event) {
        try {
            event.preventDefault();
            
            const config = (Tegaki.ConfigManagerInstance || window.ConfigManager)?.get?.('interaction') || {};
            const zoomSpeed = config.zoomSpeed || 0.1;
            const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            const newZoom = this.viewState.zoom * (1 + delta);
            
            const center = {
                x: event.clientX,
                y: event.clientY
            };
            
            this.setZoom(newZoom, center);
            
        } catch (error) {
            console.error('[CanvasManager] ❌ ホイールイベント処理エラー:', error);
            
            const errorManager = Tegaki.ErrorManagerInstance || window.ErrorManager;
            if (errorManager) {
                errorManager.handleError?.(error, 'CanvasManager._handleWheel');
            }
        }
    }

    /**
     * デバッグ情報取得
     * @returns {object}
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            hasApp: !!this.app,
            hasStage: !!this.stage,
            layerCount: this.layers.size,
            layers: Array.from(this.layers.keys()),
            viewState: { ...this.viewState },
            canvasSize: this.app ? {
                width: this.app.screen.width,
                height: this.app.screen.height
            } : null
        };
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.CanvasManager = CanvasManager;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.CanvasManagerInstance = new CanvasManager();
    console.log('[CanvasManager] ✅ Tegaki名前空間に登録完了');
});

// 🔄 PixiJS v8対応準備コメント
// - PIXI.Graphics.lineStyle() → PIXI.Graphics.stroke()
// - PIXI.BLEND_MODES → PIXI.BlendMode enum
// - レイヤーシステム強化対応準備済み

console.log('[CanvasManager] ✅ 読み込み完了（修正版）- レジストリ初期化待機中');