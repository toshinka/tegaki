// ===== layer-system.js - レイヤー管理システム（PixiJS v8.13対応） + 静的互換ラッパー =====
// core-engine.jsから分割 - レイヤー編集・変形・サムネイル生成を担当
// 将来のトラック化・タイムライン統合に向けた設計

/*
=== LayerSystemの責務 ===
- レイヤー作成・削除・選択
- レイヤー変形（移動・回転・拡縮・反転）
- レイヤー可視性・不透明度・合成モード
- レイヤー順序（Zオーダー）
- サムネイル生成・更新
- 非破壊的な変形確定処理
- レイヤーTransformUI連携

=== APIデザイン ===
- init(options): 初期化（静的メソッド）
- createLayer(options): レイヤー作成
- deleteLayer(layerId): レイヤー削除
- setActiveLayer(layerId): アクティブレイヤー設定
- updateTransform(layerId, transform): レイヤー変形
- confirmTransform(layerId): 変形確定（パス座標に適用）
- serialize(): レイヤーデータのJSON化
- on/off(eventName, callback): イベント通知

=== EventBus統合 ===
- layer-created: { layer, index }
- layer-deleted: { layerId }
- layer-selected: { layer, index }
- layer-transformed: { layerId, transform }
- layer-confirmed: { layerId }
*/

(function() {
    'use strict';
    
    // === 設定とユーティリティ ===
    const CONFIG = window.TEGAKI_CONFIG;
    const CoordinateSystem = window.CoordinateSystem;
    
    if (!CONFIG) {
        throw new Error('TEGAKI_CONFIG is required for LayerSystem');
    }
    
    const debug = (message, ...args) => {
        if (CONFIG.debug) {
            console.log(`[LayerSystem] ${message}`, ...args);
        }
    };

    // === EventBusシンプル実装 ===
    class SimpleEventBus {
        constructor() {
            this.listeners = new Map();
        }
        
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, []);
            }
            this.listeners.get(eventName).push(callback);
        }
        
        off(eventName, callback) {
            if (!this.listeners.has(eventName)) return;
            const listeners = this.listeners.get(eventName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        
        emit(eventName, payload) {
            if (!this.listeners.has(eventName)) return;
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`EventBus error in ${eventName}:`, error);
                }
            });
        }
    }

    // === レイヤー状態管理 ===
    class LayerState {
        constructor(id, name, isBackground = false) {
            this.id = id;
            this.name = name;
            this.visible = true;
            this.alpha = 1.0;
            this.blendMode = 'normal';
            this.isBackground = isBackground;
            this.paths = [];
            this.backgroundGraphics = null;
            this.transform = {
                x: 0, y: 0,
                rotation: 0,
                scaleX: 1, scaleY: 1,
                flipH: false, flipV: false
            };
            this.order = 0;
            this.meta = {
                createdAt: Date.now(),
                lastModified: Date.now()
            };
        }
        
        /**
         * レイヤー状態をJSON形式にシリアライズ
         * @returns {Object} JSON互換オブジェクト
         */
        serialize() {
            return {
                id: this.id,
                name: this.name,
                visible: this.visible,
                alpha: this.alpha,
                blendMode: this.blendMode,
                transform: { ...this.transform },
                order: this.order,
                isBackground: this.isBackground,
                paths: this.paths.map(path => ({
                    id: path.id,
                    points: [...path.points],
                    color: path.color,
                    size: path.size,
                    opacity: path.opacity,
                    isComplete: path.isComplete
                })),
                meta: { ...this.meta }
            };
        }
        
        /**
         * JSON形式からレイヤー状態を復元
         */
        static deserialize(data) {
            const layer = new LayerState(data.id, data.name, data.isBackground);
            layer.visible = data.visible;
            layer.alpha = data.alpha;
            layer.blendMode = data.blendMode;
            layer.transform = { ...data.transform };
            layer.order = data.order;
            layer.paths = data.paths || [];
            layer.meta = data.meta || { createdAt: Date.now(), lastModified: Date.now() };
            return layer;
        }
    }

    // === メインLayerSystemクラス ===
    class LayerSystemInstance {
        constructor() {
            this.app = null;
            this.worldContainer = null;
            this.layersContainer = null;
            
            this.layers = new Map(); // layerId -> PixiContainer
            this.layerStates = new Map(); // layerId -> LayerState
            this.layerOrder = []; // レイヤー順序（下から上）
            this.activeLayerId = null;
            this.layerCounter = 0;
            
            this.eventBus = new SimpleEventBus();
            
            // サムネイル更新キュー
            this.thumbnailUpdateQueue = new Set();
            
            // 変形モード管理
            this.transformMode = false;
            this.transformPanelVisible = false;
        }
        
        /**
         * LayerSystemの初期化
         * @param {Object} options - 初期化オプション
         * @param {PIXI.Application} options.app - PixiJSアプリケーション
         * @param {PIXI.Container} options.worldContainer - ワールドコンテナ
         */
        init(options) {
            this.app = options.app;
            this.worldContainer = options.worldContainer;
            
            // レイヤーコンテナ作成
            this.layersContainer = new PIXI.Container();
            this.layersContainer.name = 'layersContainer';
            this.worldContainer.addChild(this.layersContainer);
            
            // デフォルトレイヤーを作成
            this.createLayer({
                name: 'レイヤー0',
                id: 'layer_0'
            });
            
            // UI要素の初期化
            this.initializeUI();
            
            debug('LayerSystem initialized');
            return this;
        }
        
        /**
         * UI要素の初期化
         */
        initializeUI() {
            // Transform Panel の設定
            this.setupTransformPanel();
        }
        
        /**
         * レイヤー作成
         * @param {Object} options - 作成オプション
         * @param {string} options.name - レイヤー名
         * @param {string} options.id - レイヤーID（オプション）
         * @param {boolean} options.isBackground - 背景レイヤーかどうか
         * @returns {Object} { layerId, index }
         */
        createLayer(options) {
            const name = options.name || `レイヤー${this.layerCounter}`;
            const layerId = options.id || `layer_${this.layerCounter++}`;
            const isBackground = options.isBackground || false;
            
            // PixiContainerを作成
            const layer = new PIXI.Container();
            layer.name = layerId;
            
            // レイヤー状態を作成
            const layerState = new LayerState(layerId, name, isBackground);
            layerState.order = this.layerOrder.length;
            
            // 背景レイヤーの場合、背景グラフィックを作成
            if (isBackground) {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                bg.fill(CONFIG.background.color);
                layer.addChild(bg);
                layerState.backgroundGraphics = bg;
            }
            
            // レイヤーをシステムに登録
            this.layers.set(layerId, layer);
            this.layerStates.set(layerId, layerState);
            this.layerOrder.push(layerId);
            this.layersContainer.addChild(layer);
            
            // アクティブレイヤー設定（最初のレイヤーの場合）
            if (this.layerOrder.length === 1) {
                this.activeLayerId = layerId;
            }
            
            const index = this.layerOrder.length - 1;
            
            // イベント発火
            this.eventBus.emit('layer-created', { layerId, layer, layerState, index });
            
            debug(`Layer created: ${name} (${layerId})`);
            
            return { layerId, index };
        }
        
        /**
         * レイヤー削除
         * @param {string} layerId - レイヤーID
         */
        deleteLayer(layerId) {
            if (!this.layers.has(layerId)) {
                console.warn(`Layer ${layerId} not found for deletion`);
                return false;
            }
            
            // 最後のレイヤーは削除しない
            if (this.layerOrder.length <= 1) {
                console.warn('Cannot delete the last layer');
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            // パスのリソース解放
            if (layerState.paths) {
                layerState.paths.forEach(path => {
                    if (path.graphics && path.graphics.destroy) {
                        path.graphics.destroy();
                    }
                });
            }
            
            // PixiContainerの削除
            this.layersContainer.removeChild(layer);
            layer.destroy({ children: true });
            
            // データ構造からの削除
            this.layers.delete(layerId);
            this.layerStates.delete(layerId);
            
            const index = this.layerOrder.indexOf(layerId);
            if (index > -1) {
                this.layerOrder.splice(index, 1);
            }
            
            // アクティブレイヤーの調整
            if (this.activeLayerId === layerId) {
                const newIndex = Math.min(index, this.layerOrder.length - 1);
                this.setActiveLayer(this.layerOrder[newIndex]);
            }
            
            // レイヤー順序の再調整
            this.reorderLayers();
            
            // イベント発火
            this.eventBus.emit('layer-deleted', { layerId });
            
            debug(`Layer deleted: ${layerId}`);
            return true;
        }
        
        /**
         * アクティブレイヤーの設定
         * @param {string} layerId - レイヤーID
         */
        setActiveLayer(layerId) {
            if (!layerId || !this.layers.has(layerId)) {
                console.warn(`Invalid layer ID: ${layerId}`);
                return false;
            }
            
            this.activeLayerId = layerId;
            const layerState = this.layerStates.get(layerId);
            const index = this.layerOrder.indexOf(layerId);
            
            // Transform Panel が開いている場合、値を更新
            if (this.transformPanelVisible) {
                this.updateTransformPanelValues(layerState.transform);
            }
            
            // イベント発火
            this.eventBus.emit('layer-selected', { layerId, layerState, index });
            
            debug(`Active layer set: ${layerId}`);
            return true;
        }
        
        /**
         * アクティブレイヤー取得
         * @returns {Object|null} { layer, layerState }
         */
        getActiveLayer() {
            if (!this.activeLayerId || !this.layers.has(this.activeLayerId)) {
                return null;
            }
            
            return {
                layer: this.layers.get(this.activeLayerId),
                layerState: this.layerStates.get(this.activeLayerId)
            };
        }
        
        /**
         * 全レイヤーのリスト取得
         * @returns {Array} レイヤー情報の配列
         */
        listLayers() {
            return this.layerOrder.map(layerId => {
                const layerState = this.layerStates.get(layerId);
                const layer = this.layers.get(layerId);
                return {
                    layerId,
                    layerState: layerState.serialize(),
                    layer,
                    isActive: layerId === this.activeLayerId
                };
            });
        }
        
        /**
         * パスをレイヤーに追加
         * @param {string} layerId - レイヤーID
         * @param {Object} path - パスデータ
         */
        addPath(layerId, path) {
            const layerState = this.layerStates.get(layerId);
            const layer = this.layers.get(layerId);
            
            if (!layerState || !layer) {
                console.warn(`Layer ${layerId} not found for path addition`);
                return;
            }
            
            // 現在のレイヤー変形を考慮してパス座標を逆変換
            if (!this.isTransformDefault(layerState.transform)) {
                path = this.applyInverseTransformToPath(path, layerState.transform);
            }
            
            // パスにグラフィックスを作成
            path.graphics = this.createPathGraphics(path);
            
            // レイヤーに追加
            layerState.paths.push(path);
            layer.addChild(path.graphics);
            layerState.meta.lastModified = Date.now();
            
            // サムネイル更新
            this.requestThumbnailUpdate(layerId);
            
            debug(`Path added to layer ${layerId}`);
        }
        
        /**
         * パスからPixiGraphicsを作成
         * @param {Object} path - パスデータ
         * @returns {PIXI.Graphics}
         */
        createPathGraphics(path) {
            const graphics = new PIXI.Graphics();
            
            if (path.points && path.points.length > 0) {
                path.points.forEach(point => {
                    graphics.circle(point.x, point.y, (path.size || 16) / 2);
                    graphics.fill({
                        color: path.color || CONFIG.pen.color,
                        alpha: path.opacity || 1.0
                    });
                });
            }
            
            return graphics;
        }
        
        /**
         * 変形がデフォルト状態かチェック
         * @param {Object} transform - 変形データ
         * @returns {boolean}
         */
        isTransformDefault(transform) {
            return transform.x === 0 && transform.y === 0 &&
                   transform.rotation === 0 &&
                   Math.abs(transform.scaleX) === 1 && Math.abs(transform.scaleY) === 1 &&
                   !transform.flipH && !transform.flipV;
        }
        
        /**
         * パスに逆変形を適用
         * @param {Object} path - パスデータ
         * @param {Object} transform - 変形データ
         * @returns {Object} 逆変形を適用したパス
         */
        applyInverseTransformToPath(path, transform) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            const matrix = CoordinateSystem.createInverseTransformMatrix(transform, centerX, centerY);
            
            return {
                ...path,
                points: path.points.map(point => CoordinateSystem.applyMatrix(point, matrix))
            };
        }
        
        /**
         * レイヤー順序の再調整
         */
        reorderLayers() {
            this.layerOrder.forEach((layerId, index) => {
                const layerState = this.layerStates.get(layerId);
                if (layerState) {
                    layerState.order = index;
                }
            });
        }
        
        /**
         * サムネイル更新要求
         * @param {string} layerId - レイヤーID
         */
        requestThumbnailUpdate(layerId) {
            this.thumbnailUpdateQueue.add(layerId);
        }
        
        /**
         * Transform Panelの設定
         */
        setupTransformPanel() {
            // 実装はUI層との協調が必要なため、イベントで通知
            this.eventBus.emit('transform-panel-setup-requested');
        }
        
        /**
         * Transform Panel値の更新
         * @param {Object} transform - 変形データ
         */
        updateTransformPanelValues(transform) {
            if (!this.transformPanelVisible) return;
            
            this.eventBus.emit('transform-panel-values-update', { transform });
        }
        
        /**
         * イベントリスナー追加
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        on(eventName, callback) {
            this.eventBus.on(eventName, callback);
        }
        
        /**
         * イベントリスナー削除
         * @param {string} eventName - イベント名
         * @param {Function} callback - コールバック関数
         */
        off(eventName, callback) {
            this.eventBus.off(eventName, callback);
        }
        
        /**
         * デバッグ情報取得
         * @returns {Object} デバッグ情報
         */
        getDebugInfo() {
            return {
                layerCount: this.layerOrder.length,
                activeLayerId: this.activeLayerId,
                transformMode: this.transformMode,
                thumbnailQueueSize: this.thumbnailUpdateQueue.size,
                layers: this.listLayers().map(l => ({
                    id: l.layerId,
                    name: l.layerState.name,
                    visible: l.layerState.visible,
                    pathCount: l.layerState.paths.length,
                    isActive: l.isActive
                }))
            };
        }
    }

    // === 静的LayerSystem（シングルトンパターン） ===
    let layerSystemInstance = null;
    
    const LayerSystem = {
        /**
         * 静的初期化メソッド（互換性ラッパー）
         * @param {Object} options - 初期化オプション
         * @returns {Promise<LayerSystemInstance>}
         */
        async init(options) {
            if (layerSystemInstance) {
                console.warn('LayerSystem already initialized');
                return layerSystemInstance;
            }
            
            layerSystemInstance = new LayerSystemInstance();
            await layerSystemInstance.init(options);
            
            debug('LayerSystem static wrapper initialized');
            return layerSystemInstance;
        },
        
        /**
         * インスタンス取得
         * @returns {LayerSystemInstance|null}
         */
        getInstance() {
            return layerSystemInstance;
        },
        
        /**
         * レイヤー作成（静的メソッド）
         * @param {Object} options - 作成オプション
         */
        createLayer(options) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return null;
            }
            return layerSystemInstance.createLayer(options);
        },
        
        /**
         * 全レイヤーのリスト取得（静的メソッド）
         * @returns {Array}
         */
        listLayers() {
            if (!layerSystemInstance) {
                return [];
            }
            return layerSystemInstance.listLayers();
        },
        
        /**
         * アクティブレイヤー設定（静的メソッド）
         * @param {string} layerId
         */
        setActiveLayer(layerId) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return false;
            }
            return layerSystemInstance.setActiveLayer(layerId);
        },
        
        /**
         * レイヤー削除（静的メソッド）
         * @param {string} layerId
         */
        deleteLayer(layerId) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return false;
            }
            return layerSystemInstance.deleteLayer(layerId);
        },
        
        /**
         * パス追加（静的メソッド）
         * @param {string} layerId
         * @param {Object} path
         */
        addPath(layerId, path) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return;
            }
            layerSystemInstance.addPath(layerId, path);
        },
        
        /**
         * イベントリスナー追加（静的メソッド）
         * @param {string} eventName
         * @param {Function} callback
         */
        on(eventName, callback) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return;
            }
            layerSystemInstance.on(eventName, callback);
        },
        
        /**
         * イベントリスナー削除（静的メソッド）
         * @param {string} eventName
         * @param {Function} callback
         */
        off(eventName, callback) {
            if (!layerSystemInstance) {
                console.error('LayerSystem not initialized');
                return;
            }
            layerSystemInstance.off(eventName, callback);
        }
    };

    // === グローバル公開 ===
    window.LayerSystem = LayerSystem;
    window.LayerSystemInstance = LayerSystemInstance;
    window.LayerState = LayerState;

    debug('LayerSystem module loaded (with static compatibility wrapper)');

})();