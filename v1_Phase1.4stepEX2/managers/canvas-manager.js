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
            backgroundColor: 0xffffff,
            resolution: window.devicePixelRatio || 1
        };
        
        // ✅ 統一システム依存（Phase1.4stepEX準拠）
        // この段階では直接参照、レジストリ初期化後はTegaki経由に変更予定
    }

    /**
     * CanvasManagerを初期化
     * @param {HTMLElement} container - コンテナ要素
     * @param {object} options - 初期化オプション
     * @returns {boolean} 成功/失敗
     */
    initialize(container, options = {}) {
        try {
            if (this.isInitialized) {
                // 統一エラー処理経由（Phase1.4stepEX準拠）
                window.ErrorManager?.warn('CanvasManager already initialized', 'CanvasManager.initialize');
                return true;
            }

            this.container = container;
            
            // オプション適用
            this._applyOptions(options);
            
            // PIXI.Application作成（レイヤー基盤として必要）
            this._createPixiApp();
            
            // レイヤーシステム初期化
            this._initializeLayerSystem();
            
            // DOM追加
            container.appendChild(this.app.view);
            
            // 統一システム連携
            this._integrateWithUnifiedSystems();
            
            // イベント設定（レイヤー管理として必要なもののみ）
            this._setupLayerEvents();
            
            this.isInitialized = true;
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('canvas:initialized', {
                    width: this.app.screen.width,
                    height: this.app.screen.height
                });
            }
            
            console.log('[CanvasManager] Successfully initialized - Layer management ready');
            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.initialize', 'error', true);
            return false;
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
                window.ErrorManager?.warn(`Layer ${layerId} already exists`, 'CanvasManager.addLayer');
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
            if (window.EventBus) {
                window.EventBus.emit('layer:added', {
                    layerId,
                    type,
                    options
                });
            }

            console.log(`[CanvasManager] Layer added: ${layerId} (${type})`);
            return layer;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.addLayer');
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
            const layer = this.layers.get(layerId);
            if (!layer) {
                // レイヤーが存在しない場合は自動作成
                this.addLayer(layerId, 'graphics');
                return this.addGraphicsToLayer(graphics, layerId);
            }

            layer.addChild(graphics);
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('graphics:added', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.addGraphicsToLayer');
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
                return false;
            }

            layer.removeChild(graphics);
            
            // 統一システム経由での通知
            if (window.EventBus) {
                window.EventBus.emit('graphics:removed', {
                    layerId,
                    graphicsType: graphics.constructor.name
                });
            }

            return true;
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.removeGraphicsFromLayer');
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
                
                if (window.EventBus) {
                    window.EventBus.emit('layer:visibility', {
                        layerId,
                        visible
                    });
                }
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.setLayerVisibility');
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
                layer.clear();
            });
            
            // 統一システム経由での状態更新
            if (window.StateManager) {
                window.StateManager.set('canvas.hasContent', false);
                window.StateManager.set('canvas.isDirty', false);
            }
            
            if (window.EventBus) {
                window.EventBus.emit('canvas:cleared');
            }
            
            console.log('[CanvasManager] All layers cleared');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.clear');
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
            if (window.CoordinateManager) {
                window.CoordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            if (window.EventBus) {
                window.EventBus.emit('canvas:pan', {
                    dx, dy,
                    panX: this.viewState.panX,
                    panY: this.viewState.panY
                });
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.pan');
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
            if (window.CoordinateManager) {
                window.CoordinateManager.setTransform(
                    this.viewState.zoom,
                    this.viewState.panX,
                    this.viewState.panY
                );
            }
            
            this._updateViewState();
            
            if (window.EventBus) {
                window.EventBus.emit('canvas:zoom', {
                    zoom: newZoom,
                    center
                });
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.setZoom');
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
            
            if (window.CoordinateManager) {
                window.CoordinateManager.setTransform(1.0, 0, 0);
            }
            
            this._updateViewState();
            
            if (window.EventBus) {
                window.EventBus.emit('canvas:reset');
            }
            
            console.log('[CanvasManager] View reset to default');
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.resetView');
        }
    }

    /**
     * リサイズ処理
     */
    resize(width, height) {
        try {
            if (this.app) {
                this.app.renderer.resize(width, height);
                
                if (window.CoordinateManager) {
                    window.CoordinateManager.setTransform(
                        this.viewState.zoom,
                        this.viewState.panX,
                        this.viewState.panY
                    );
                }
                
                if (window.EventBus) {
                    window.EventBus.emit('canvas:resize', { width, height });
                }
                
                console.log(`[CanvasManager] Canvas resized to ${width}x${height}`);
            }
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager.resize');
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

    _createPixiApp() {
        const config = window.ConfigManager?.get('canvas') || {};
        
        this.app = new PIXI.Application({
            width: config.width || 1920,
            height: config.height || 1080,
            antialias: this.pixiSettings.antialias,
            backgroundColor: this.pixiSettings.backgroundColor,
            resolution: this.pixiSettings.resolution,
            autoDensity: true
        });

        this.stage = this.app.stage;
        console.log('[CanvasManager] PIXI.Application created for layer management');
    }

    _initializeLayerSystem() {
        // 基本レイヤーを作成
        this.addLayer('background', 'graphics', { zIndex: 0 });
        this.addLayer('main_drawing', 'graphics', { zIndex: 50 });
        
        console.log('[CanvasManager] Layer system initialized');
    }

    _integrateWithUnifiedSystems() {
        // CoordinateManagerにキャンバス要素を設定
        if (window.CoordinateManager) {
            window.CoordinateManager.setCanvasElement(this.app.view);
        }
    }

    _setupLayerEvents() {
        const canvas = this.app.view;
        
        // 基本イベントのみ（レイヤー管理に必要なもの）
        canvas.addEventListener('wheel', this._handleWheel.bind(this));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('[CanvasManager] Layer management events setup');
    }

    _applyOptions(options) {
        if (options.backgroundColor !== undefined) {
            this.pixiSettings.backgroundColor = options.backgroundColor;
        }
        if (options.antialias !== undefined) {
            this.pixiSettings.antialias = options.antialias;
        }
        if (options.resolution !== undefined) {
            this.pixiSettings.resolution = options.resolution;
        }
    }

    _updateViewState() {
        if (window.StateManager) {
            window.StateManager.set('canvas.zoom', this.viewState.zoom);
            window.StateManager.set('canvas.panX', this.viewState.panX);
            window.StateManager.set('canvas.panY', this.viewState.panY);
        }
    }

    _handleWheel(event) {
        try {
            event.preventDefault();
            
            const config = window.ConfigManager?.get('interaction') || {};
            const zoomSpeed = config.zoomSpeed || 0.1;
            const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            const newZoom = this.viewState.zoom * (1 + delta);
            
            const center = {
                x: event.clientX,
                y: event.clientY
            };
            
            this.setZoom(newZoom, center);
        } catch (error) {
            window.ErrorManager?.handleError(error, 'CanvasManager._handleWheel');
        }
    }
}

// Tegaki名前空間に登録（Phase1.4stepEX準拠）
Tegaki.CanvasManager = CanvasManager;

// 初期化レジストリ方式（Phase1.4stepEX準拠）
Tegaki._registry = Tegaki._registry || [];
Tegaki._registry.push(() => {
    Tegaki.CanvasManagerInstance = new CanvasManager();
    console.log('[CanvasManager] Registered to Tegaki namespace');
});

// 🔄 PixiJS v8対応準備コメント
// - PIXI.Graphics.lineStyle() → PIXI.Graphics.stroke()
// - PIXI.BLEND_MODES → PIXI.BlendMode enum
// - レイヤーシステム強化対応準備済み

console.log('[CanvasManager] Loaded and ready for registry initialization');