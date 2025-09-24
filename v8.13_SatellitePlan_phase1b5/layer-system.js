// ===== layer-system.js - レイヤー管理システム（PixiJS v8.13対応） =====
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
- init(app, worldContainer): 初期化
- createLayer(name, isBackground): レイヤー作成
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
    class LayerSystem {
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
            this.layersContainer.label = 'layersContainer';
            this.worldContainer.addChild(this.layersContainer);
            
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
         * @param {string} name - レイヤー名
         * @param {boolean} isBackground - 背景レイヤーかどうか
         * @returns {Object} { layerId, index }
         */
        createLayer(name, isBackground = false) {
            const layerId = `layer_${this.layerCounter++}`;
            
            // PixiContainerを作成
            const layer = new PIXI.Container();
            layer.label = layerId;
            
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
         * レイヤー変形更新
         * @param {string} layerId - レイヤーID
         * @param {Object} partialTransform - 変形データ（部分更新）
         */
        updateTransform(layerId, partialTransform) {
            if (!this.layers.has(layerId)) {
                console.warn(`Layer ${layerId} not found for transform`);
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            // 変形データを更新
            Object.assign(layerState.transform, partialTransform);
            layerState.meta.lastModified = Date.now();
            
            // PixiContainerに変形を適用
            this.applyTransformToLayer(layer, layerState.transform);
            
            // サムネイル更新をキューに追加
            this.requestThumbnailUpdate(layerId);
            
            // イベント発火
            this.eventBus.emit('layer-transformed', { layerId, transform: layerState.transform });
            
            debug(`Layer transform updated: ${layerId}`, partialTransform);
            return true;
        }
        
        /**
         * PixiContainerに変形を適用
         * @param {PIXI.Container} layer - レイヤーコンテナ
         * @param {Object} transform - 変形データ
         */
        applyTransformToLayer(layer, transform) {
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // ピボット設定
            layer.pivot.set(centerX, centerY);
            layer.position.set(centerX + transform.x, centerY + transform.y);
            layer.rotation = transform.rotation;
            
            // スケール（反転も考慮）
            const scaleX = transform.scaleX * (transform.flipH ? -1 : 1);
            const scaleY = transform.scaleY * (transform.flipV ? -1 : 1);
            layer.scale.set(scaleX, scaleY);
        }
        
        /**
         * レイヤー変形の確定（パス座標に変形を適用）
         * @param {string} layerId - レイヤーID
         */
        confirmTransform(layerId) {
            if (!this.layers.has(layerId)) {
                console.warn(`Layer ${layerId} not found for transform confirmation`);
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            // デフォルト変形でない場合のみ処理
            if (this.isTransformDefault(layerState.transform)) {
                debug(`Transform already at default for layer ${layerId}`);
                return true;
            }
            
            debug(`Starting transform confirmation for layer ${layerId}`);
            
            try {
                // パス座標に変形を適用
                this.applyTransformToPaths(layerState);
                
                // レイヤーの表示変形をリセット
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
                layer.pivot.set(0, 0);
                
                // 変形データをリセット
                layerState.transform = {
                    x: 0, y: 0,
                    rotation: 0,
                    scaleX: 1, scaleY: 1,
                    flipH: false, flipV: false
                };
                layerState.meta.lastModified = Date.now();
                
                // レイヤーを再構築
                this.rebuildLayerGraphics(layerId);
                
                // サムネイル更新
                this.requestThumbnailUpdate(layerId);
                
                // イベント発火
                this.eventBus.emit('layer-confirmed', { layerId });
                
                debug(`Transform confirmed for layer ${layerId}`);
                return true;
                
            } catch (error) {
                console.error(`Transform confirmation failed for layer ${layerId}:`, error);
                return false;
            }
        }
        
        /**
         * パス座標に変形を適用
         * @param {LayerState} layerState - レイヤー状態
         */
        applyTransformToPaths(layerState) {
            if (!layerState.paths || layerState.paths.length === 0) {
                return;
            }
            
            const centerX = CONFIG.canvas.width / 2;
            const centerY = CONFIG.canvas.height / 2;
            
            // 変形行列作成
            const matrix = CoordinateSystem.createTransformMatrix(layerState.transform, centerX, centerY);
            
            // パスごとに座標変形
            layerState.paths.forEach(path => {
                if (path.points && path.points.length > 0) {
                    path.points = path.points.map(point => {
                        try {
                            return CoordinateSystem.applyMatrix(point, matrix);
                        } catch (error) {
                            console.warn('Point transform failed:', error);
                            return point;
                        }
                    });
                }
            });
        }
        
        /**
         * レイヤーグラフィックスの再構築
         * @param {string} layerId - レイヤーID
         */
        rebuildLayerGraphics(layerId) {
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            if (!layer || !layerState) return;
            
            // 既存のパスグラフィックスを削除（背景は保護）
            const childrenToRemove = [];
            for (let child of layer.children) {
                if (child !== layerState.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            }
            
            childrenToRemove.forEach(child => {
                layer.removeChild(child);
                if (child.destroy) {
                    child.destroy();
                }
            });
            
            // パスグラフィックスを再生成
            layerState.paths.forEach(path => {
                const graphics = this.createPathGraphics(path);
                path.graphics = graphics;
                layer.addChild(graphics);
            });
            
            debug(`Layer graphics rebuilt: ${layerId}`);
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
         * レイヤー順序の変更
         * @param {string} layerId - レイヤーID
         * @param {number} newIndex - 新しいインデックス
         */
        reorderLayer(layerId, newIndex) {
            const currentIndex = this.layerOrder.indexOf(layerId);
            if (currentIndex === -1 || newIndex < 0 || newIndex >= this.layerOrder.length) {
                return false;
            }
            
            // 配列から削除して新しい位置に挿入
            this.layerOrder.splice(currentIndex, 1);
            this.layerOrder.splice(newIndex, 0, layerId);
            
            // Pixiコンテナの順序も更新
            const layer = this.layers.get(layerId);
            this.layersContainer.removeChild(layer);
            this.layersContainer.addChildAt(layer, newIndex);
            
            // レイヤー状態の順序を更新
            this.reorderLayers();
            
            // イベント発火
            this.eventBus.emit('layers-reordered', { layerOrder: [...this.layerOrder] });
            
            debug(`Layer reordered: ${layerId} to index ${newIndex}`);
            return true;
        }
        
        /**
         * レイヤー可視性切り替え
         * @param {string} layerId - レイヤーID
         */
        toggleVisibility(layerId) {
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            if (!layer || !layerState) return false;
            
            layerState.visible = !layerState.visible;
            layer.visible = layerState.visible;
            layerState.meta.lastModified = Date.now();
            
            // イベント発火
            this.eventBus.emit('layer-visibility-changed', { layerId, visible: layerState.visible });
            
            debug(`Layer visibility toggled: ${layerId} -> ${layerState.visible}`);
            return true;
        }
        
        /**
         * レイヤー不透明度設定
         * @param {string} layerId - レイヤーID
         * @param {number} alpha - 不透明度（0-1）
         */
        setAlpha(layerId, alpha) {
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            if (!layer || !layerState) return false;
            
            alpha = Math.max(0, Math.min(1, alpha));
            layerState.alpha = alpha;
            layer.alpha = alpha;
            layerState.meta.lastModified = Date.now();
            
            // イベント発火
            this.eventBus.emit('layer-alpha-changed', { layerId, alpha });
            
            debug(`Layer alpha set: ${layerId} -> ${alpha}`);
            return true;
        }
        
        /**
         * サムネイル更新要求
         * @param {string} layerId - レイヤーID
         */
        requestThumbnailUpdate(layerId) {
            this.thumbnailUpdateQueue.add(layerId);
        }
        
        /**
         * サムネイル更新処理
         */
        processThumbnailUpdates() {
            if (!this.app?.renderer || this.thumbnailUpdateQueue.size === 0) {
                return;
            }
            
            this.thumbnailUpdateQueue.forEach(layerId => {
                this.updateThumbnail(layerId);
            });
            
            this.thumbnailUpdateQueue.clear();
        }
        
        /**
         * レイヤーサムネイルの更新
         * @param {string} layerId - レイヤーID
         */
        updateThumbnail(layerId) {
            // 実装はUI層との協調が必要なため、イベントを発火
            this.eventBus.emit('thumbnail-update-requested', { layerId });
        }
        
        /**
         * Transform Panelの設定
         */
        setupTransformPanel() {
            // 実装はUI層との協調が必要なため、イベントで通知
            this.eventBus.emit('transform-panel-setup-requested');
        }
        
        /**
         * Transform Panelの表示
         */
        showTransformPanel() {
            this.transformPanelVisible = true;
            
            // アクティブレイヤーの変形値でパネルを更新
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.updateTransformPanelValues(activeLayer.layerState.transform);
            }
            
            this.eventBus.emit('transform-panel-show', {
                layerId: this.activeLayerId,
                transform: activeLayer?.layerState.transform
            });
        }
        
        /**
         * Transform Panelの非表示
         */
        hideTransformPanel() {
            this.transformPanelVisible = false;
            this.eventBus.emit('transform-panel-hide');
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
         * 変形モードの開始
         */
        enterTransformMode() {
            this.transformMode = true;
            this.showTransformPanel();
            
            this.eventBus.emit('transform-mode-entered', { layerId: this.activeLayerId });
            debug('Transform mode entered');
        }
        
        /**
         * 変形モードの終了（変形確定）
         */
        exitTransformMode() {
            if (!this.transformMode) return;
            
            // アクティブレイヤーの変形を確定
            if (this.activeLayerId) {
                this.confirmTransform(this.activeLayerId);
            }
            
            this.transformMode = false;
            this.hideTransformPanel();
            
            this.eventBus.emit('transform-mode-exited', { layerId: this.activeLayerId });
            debug('Transform mode exited');
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
         * レイヤーデータの取得
         * @param {string} layerId - レイヤーID
         * @returns {LayerState|null}
         */
        getLayerState(layerId) {
            return this.layerStates.get(layerId) || null;
        }
        
        /**
         * レイヤー名の変更
         * @param {string} layerId - レイヤーID
         * @param {string} newName - 新しい名前
         */
        renameLayer(layerId, newName) {
            const layerState = this.layerStates.get(layerId);
            if (!layerState) return false;
            
            const oldName = layerState.name;
            layerState.name = newName;
            layerState.meta.lastModified = Date.now();
            
            this.eventBus.emit('layer-renamed', { layerId, oldName, newName });
            debug(`Layer renamed: ${layerId} -> ${newName}`);
            return true;
        }
        
        /**
         * レイヤー合成モードの設定
         * @param {string} layerId - レイヤーID
         * @param {string} blendMode - 合成モード
         */
        setBlendMode(layerId, blendMode) {
            const layer = this.layers.get(layerId);
            const layerState = this.layerStates.get(layerId);
            
            if (!layer || !layerState) return false;
            
            // PixiJS v8.13の合成モード設定
            const blendModeMapping = {
                'normal': PIXI.BLEND_MODES.NORMAL,
                'add': PIXI.BLEND_MODES.ADD,
                'multiply': PIXI.BLEND_MODES.MULTIPLY,
                'screen': PIXI.BLEND_MODES.SCREEN,
                'overlay': PIXI.BLEND_MODES.OVERLAY
            };
            
            if (blendModeMapping[blendMode]) {
                layer.blendMode = blendModeMapping[blendMode];
                layerState.blendMode = blendMode;
                layerState.meta.lastModified = Date.now();
                
                this.eventBus.emit('layer-blend-mode-changed', { layerId, blendMode });
                debug(`Layer blend mode set: ${layerId} -> ${blendMode}`);
                return true;
            }
            
            return false;
        }
        
        /**
         * レイヤーの複製
         * @param {string} layerId - 複製元レイヤーID
         * @returns {string|null} 新しいレイヤーID
         */
        duplicateLayer(layerId) {
            const sourceLayerState = this.layerStates.get(layerId);
            if (!sourceLayerState) {
                console.warn(`Layer ${layerId} not found for duplication`);
                return null;
            }
            
            // 新しい名前を生成
            const newName = `${sourceLayerState.name}_copy`;
            
            // レイヤーを作成
            const { layerId: newLayerId } = this.createLayer(newName, false);
            const newLayerState = this.layerStates.get(newLayerId);
            
            // 元レイヤーの設定をコピー
            newLayerState.alpha = sourceLayerState.alpha;
            newLayerState.blendMode = sourceLayerState.blendMode;
            
            // パスデータをディープコピー
            newLayerState.paths = sourceLayerState.paths.map(path => ({
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: path.points.map(point => ({ x: point.x, y: point.y })),
                color: path.color,
                size: path.size,
                opacity: path.opacity,
                isComplete: path.isComplete
            }));
            
            // グラフィックスを再構築
            this.rebuildLayerGraphics(newLayerId);
            
            // Pixiレイヤーにコピーした設定を適用
            const newLayer = this.layers.get(newLayerId);
            newLayer.alpha = newLayerState.alpha;
            this.setBlendMode(newLayerId, newLayerState.blendMode);
            
            // サムネイル更新
            this.requestThumbnailUpdate(newLayerId);
            
            debug(`Layer duplicated: ${layerId} -> ${newLayerId}`);
            return newLayerId;
        }
        
        /**
         * 全レイヤーデータのシリアライズ
         * @returns {Object} JSON形式のレイヤーデータ
         */
        serialize() {
            return {
                version: '1.0',
                layerOrder: [...this.layerOrder],
                activeLayerId: this.activeLayerId,
                layers: Object.fromEntries(
                    Array.from(this.layerStates.entries()).map(([id, state]) => [
                        id, state.serialize()
                    ])
                ),
                meta: {
                    exportedAt: Date.now(),
                    layerCount: this.layerOrder.length
                }
            };
        }
        
        /**
         * シリアライズデータからレイヤーを復元
         * @param {Object} data - シリアライズされたデータ
         */
        deserialize(data) {
            if (!data.version || !data.layerOrder || !data.layers) {
                throw new Error('Invalid layer data format');
            }
            
            // 既存レイヤーをクリア
            this.clearAllLayers();
            
            // レイヤーを復元
            data.layerOrder.forEach(layerId => {
                const layerData = data.layers[layerId];
                if (!layerData) return;
                
                const layerState = LayerState.deserialize(layerData);
                
                // PixiContainerを作成
                const layer = new PIXI.Container();
                layer.label = layerId;
                
                // 背景レイヤーの復元
                if (layerState.isBackground) {
                    const bg = new PIXI.Graphics();
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(CONFIG.background.color);
                    layer.addChild(bg);
                    layerState.backgroundGraphics = bg;
                }
                
                // システムに登録
                this.layers.set(layerId, layer);
                this.layerStates.set(layerId, layerState);
                this.layersContainer.addChild(layer);
                
                // グラフィックス復元
                this.rebuildLayerGraphics(layerId);
                
                // 設定適用
                layer.alpha = layerState.alpha;
                layer.visible = layerState.visible;
                this.setBlendMode(layerId, layerState.blendMode);
                
                // 変形適用
                this.applyTransformToLayer(layer, layerState.transform);
            });
            
            this.layerOrder = [...data.layerOrder];
            this.activeLayerId = data.activeLayerId;
            
            // レイヤー順序調整
            this.reorderLayers();
            
            debug('Layers deserialized successfully');
        }
        
        /**
         * 全レイヤーのクリア
         */
        clearAllLayers() {
            // 全てのPixiレイヤーを削除
            this.layers.forEach((layer, layerId) => {
                const layerState = this.layerStates.get(layerId);
                
                // パスのリソース解放
                if (layerState?.paths) {
                    layerState.paths.forEach(path => {
                        if (path.graphics && path.graphics.destroy) {
                            path.graphics.destroy();
                        }
                    });
                }
                
                // Pixiレイヤー削除
                this.layersContainer.removeChild(layer);
                layer.destroy({ children: true });
            });
            
            // データクリア
            this.layers.clear();
            this.layerStates.clear();
            this.layerOrder = [];
            this.activeLayerId = null;
            this.thumbnailUpdateQueue.clear();
            
            debug('All layers cleared');
        }
        
        /**
         * レイヤーキャンバスサイズ変更対応
         * @param {number} newWidth - 新しい幅
         * @param {number} newHeight - 新しい高さ
         */
        resizeCanvas(newWidth, newHeight) {
            debug(`Resizing canvas: ${newWidth}x${newHeight}`);
            
            // 背景レイヤーのサイズを更新
            this.layerStates.forEach((layerState, layerId) => {
                if (layerState.isBackground && layerState.backgroundGraphics) {
                    layerState.backgroundGraphics.clear();
                    layerState.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layerState.backgroundGraphics.fill(CONFIG.background.color);
                }
                
                // 現在変形中のレイヤーは変形を再適用
                if (!this.isTransformDefault(layerState.transform)) {
                    const layer = this.layers.get(layerId);
                    this.applyTransformToLayer(layer, layerState.transform);
                }
                
                // サムネイル更新
                this.requestThumbnailUpdate(layerId);
            });
            
            this.eventBus.emit('canvas-resized', { width: newWidth, height: newHeight });
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

    // === グローバル公開 ===
    window.LayerSystem = LayerSystem;
    window.LayerState = LayerState;

    debug('LayerSystem module loaded');

})();