/**
 * PixiLayerProcessor v3.2 - PixiJS非破壊レイヤー管理システム
 * PixiJS Container階層活用・ベクター完全保持・Chrome API統合
 * 規約: 総合AIコーディング規約v4.1準拠（PixiJS統一座標対応）
 */

import * as PIXI from 'pixi.js';
import { cloneDeep } from 'lodash-es';

/**
 * PixiJS統一レイヤー管理システム
 * Container階層による非破壊レイヤー操作・完全ベクター保持
 */
export class PixiLayerProcessor {
    constructor(pixiApp, coordinateUnifier, eventStore) {
        this.app = pixiApp;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;
        
        // レイヤー管理
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.layerIdCounter = 1;
        
        // PixiJS Container階層
        this.layerContainer = new PIXI.Container();
        this.app.stage.addChild(this.layerContainer);
        
        // レイヤーグループ管理
        this.layerGroups = new Map();
        this.groupIdCounter = 1;
        
        // 非破壊変換履歴
        this.transformHistory = new Map();
        this.blendModeHistory = new Map();
        
        // サムネイル生成
        this.thumbnailCache = new Map();
        this.thumbnailSize = { width: 64, height: 64 };
        
        // パフォーマンス最適化
        this.cullingBounds = new PIXI.Rectangle();
        this.visibilityCache = new Map();
        this.renderOptimization = true;
        
        // Chrome API統合
        this.offscreenProcessing = false;
        this.layerWorkers = new Map();
        
        this.initialize();
    }
    
    /**
     * レイヤープロセッサー初期化
     */
    initialize() {
        try {
            console.log('📚 PixiLayerProcessor初期化開始 - 非破壊レイヤーシステム');
            
            // デフォルトレイヤー作成
            this.createDefaultLayer();
            
            // PixiJS Container最適化
            this.setupContainerOptimization();
            
            // イベントリスナー設定
            this.setupEventListeners();
            
            // カリング・最適化設定
            this.setupRenderOptimization();
            
            console.log('✅ PixiLayerProcessor初期化完了 - 非破壊レイヤーシステム稼働');
            
        } catch (error) {
            console.error('❌ PixiLayerProcessor初期化エラー:', error);
            throw error;
        }
    }
    
    /**
     * デフォルトレイヤー作成
     */
    createDefaultLayer() {
        const defaultLayer = this.createLayer('default', {
            name: '背景',
            opacity: 1.0,
            visible: true,
            locked: false,
            blendMode: 'normal'
        });
        
        this.setActiveLayer('default');
        console.log('📚 デフォルトレイヤー作成完了');
    }
    
    /**
     * PixiJS Container最適化設定
     */
    setupContainerOptimization() {
        // Container階層最適化
        this.layerContainer.sortableChildren = true;
        this.layerContainer.interactiveChildren = true;
        
        // カリング最適化
        this.layerContainer.cullArea = this.app.screen;
        
        // バッチング最適化
        this.layerContainer.calculateBounds = this.optimizedCalculateBounds.bind(this);
        
        console.log('⚡ PixiJS Container最適化設定完了');
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // レイヤー操作イベント
        this.eventStore.on('layer:create', (data) => {
            this.createLayer(data.id, data.config);
        });
        
        this.eventStore.on('layer:delete', (data) => {
            this.deleteLayer(data.id);
        });
        
        this.eventStore.on('layer:activate', (data) => {
            this.setActiveLayer(data.id);
        });
        
        this.eventStore.on('layer:opacity', (data) => {
            this.setLayerOpacity(data.id, data.opacity);
        });
        
        this.eventStore.on('layer:visibility', (data) => {
            this.setLayerVisibility(data.id, data.visible);
        });
        
        this.eventStore.on('layer:blend', (data) => {
            this.setLayerBlendMode(data.id, data.blendMode);
        });
        
        this.eventStore.on('layer:transform', (data) => {
            this.transformLayer(data.id, data.transform);
        });
        
        // 描画連携イベント
        this.eventStore.on('draw:stroke:complete', (data) => {
            this.addStrokeToActiveLayer(data);
        });
        
        // レンダリング最適化イベント
        this.eventStore.on('viewport:resize', (data) => {
            this.updateRenderOptimization(data);
        });
        
        console.log('📡 PixiLayerProcessor イベントリスナー設定完了');
    }
    
    /**
     * レンダリング最適化設定
     */
    setupRenderOptimization() {
        // カリング境界設定
        this.updateCullingBounds();
        
        // 可視性キャッシュ初期化
        this.visibilityCache.clear();
        
        // 定期最適化
        this.optimizationInterval = setInterval(() => {
            if (this.renderOptimization) {
                this.performRenderOptimization();
            }
        }, 5000); // 5秒間隔
        
        console.log('⚡ レンダリング最適化設定完了');
    }
    
    /**
     * レイヤー作成
     */
    createLayer(layerId = null, config = {}) {
        try {
            const id = layerId || this.generateLayerId();
            
            // レイヤー設定
            const layerConfig = {
                id: id,
                name: config.name || `Layer ${this.layerIdCounter}`,
                opacity: config.opacity !== undefined ? config.opacity : 1.0,
                visible: config.visible !== undefined ? config.visible : true,
                locked: config.locked || false,
                blendMode: config.blendMode || 'normal',
                zIndex: config.zIndex !== undefined ? config.zIndex : this.layerOrder.length,
                created: Date.now(),
                modified: Date.now()
            };
            
            // PixiJS Container作成
            const container = new PIXI.Container();
            container.name = id;
            container.alpha = layerConfig.opacity;
            container.visible = layerConfig.visible;
            container.zIndex = layerConfig.zIndex;
            
            // ブレンドモード設定
            this.setContainerBlendMode(container, layerConfig.blendMode);
            
            // レイヤーデータ構造
            const layer = {
                config: layerConfig,
                container: container,
                vectorStrokes: [], // ベクターデータ保持
                graphicsObjects: [], // PixiJS Graphics参照
                thumbnail: null,
                bounds: new PIXI.Rectangle(),
                transformMatrix: new PIXI.Matrix(),
                blendHistory: []
            };
            
            // レイヤー登録
            this.layers.set(id, layer);
            this.layerOrder.push(id);
            this.layerContainer.addChild(container);
            
            // サムネイル生成
            this.generateLayerThumbnail(id);
            
            // イベント通知
            this.eventStore.emit('layer:created', {
                layerId: id,
                config: layerConfig,
                timestamp: Date.now()
            });
            
            console.log(`📚 レイヤー作成完了: ${id} (${layerConfig.name})`);
            return id;
            
        } catch (error) {
            console.error('❌ レイヤー作成エラー:', error);
            return null;
        }
    }
    
    /**
     * レイヤー削除
     */
    deleteLayer(layerId) {
        try {
            if (!this.layers.has(layerId)) {
                console.warn(`⚠️ 削除対象レイヤーが存在しません: ${layerId}`);
                return false;
            }
            
            const layer = this.layers.get(layerId);
            
            // PixiJS Container削除
            this.layerContainer.removeChild(layer.container);
            layer.container.destroy({ children: true, texture: true });
            
            // レイヤーデータ削除
            this.layers.delete(layerId);
            this.layerOrder = this.layerOrder.filter(id => id !== layerId);
            
            // サムネイルキャッシュ削除
            this.thumbnailCache.delete(layerId);
            
            // アクティブレイヤー調整
            if (this.activeLayerId === layerId) {
                const newActiveId = this.layerOrder.length > 0 ? this.layerOrder[0] : null;
                this.setActiveLayer(newActiveId);
            }
            
            // イベント通知
            this.eventStore.emit('layer:deleted', {
                layerId: layerId,
                timestamp: Date.now()
            });
            
            console.log(`📚 レイヤー削除完了: ${layerId}`);
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー削除エラー:', error);
            return false;
        }
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        if (layerId && !this.layers.has(layerId)) {
            console.warn(`⚠️ アクティブ設定対象レイヤーが存在しません: ${layerId}`);
            return false;
        }
        
        this.activeLayerId = layerId;
        
        // イベント通知
        this.eventStore.emit('layer:activated', {
            layerId: layerId,
            timestamp: Date.now()
        });
        
        console.log(`📚 アクティブレイヤー設定: ${layerId}`);
        return true;
    }
    
    /**
     * レイヤー不透明度設定
     */
    setLayerOpacity(layerId, opacity) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const clampedOpacity = Math.max(0, Math.min(1, opacity));
            
            // PixiJS Container適用
            layer.container.alpha = clampedOpacity;
            layer.config.opacity = clampedOpacity;
            layer.config.modified = Date.now();
            
            // サムネイル更新
            this.generateLayerThumbnail(layerId);
            
            // イベント通知
            this.eventStore.emit('layer:opacity:changed', {
                layerId: layerId,
                opacity: clampedOpacity,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー不透明度設定エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤー可視性設定
     */
    setLayerVisibility(layerId, visible) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            
            // PixiJS Container適用
            layer.container.visible = visible;
            layer.config.visible = visible;
            layer.config.modified = Date.now();
            
            // 可視性キャッシュ更新
            this.visibilityCache.set(layerId, visible);
            
            // イベント通知
            this.eventStore.emit('layer:visibility:changed', {
                layerId: layerId,
                visible: visible,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー可視性設定エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤーブレンドモード設定
     */
    setLayerBlendMode(layerId, blendMode) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            
            // ブレンドモード履歴記録
            if (!layer.blendHistory) {
                layer.blendHistory = [];
            }
            layer.blendHistory.push({
                from: layer.config.blendMode,
                to: blendMode,
                timestamp: Date.now()
            });
            
            // PixiJS Container適用
            this.setContainerBlendMode(layer.container, blendMode);
            layer.config.blendMode = blendMode;
            layer.config.modified = Date.now();
            
            // イベント通知
            this.eventStore.emit('layer:blend:changed', {
                layerId: layerId,
                blendMode: blendMode,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ レイヤーブレンドモード設定エラー:', error);
            return false;
        }
    }
    
    /**
     * PixiJS Container ブレンドモード設定
     */
    setContainerBlendMode(container, blendMode) {
        const blendModeMap = {
            'normal': PIXI.BLEND_MODES.NORMAL,
            'multiply': PIXI.BLEND_MODES.MULTIPLY,
            'screen': PIXI.BLEND_MODES.SCREEN,
            'overlay': PIXI.BLEND_MODES.OVERLAY,
            'darken': PIXI.BLEND_MODES.DARKEN,
            'lighten': PIXI.BLEND_MODES.LIGHTEN,
            'add': PIXI.BLEND_MODES.ADD,
            'subtract': PIXI.BLEND_MODES.SUBTRACT,
            'difference': PIXI.BLEND_MODES.DIFFERENCE,
            'exclusion': PIXI.BLEND_MODES.EXCLUSION
        };
        
        container.blendMode = blendModeMap[blendMode] || PIXI.BLEND_MODES.NORMAL;
    }
    
    /**
     * ストローク追加（アクティブレイヤー）
     */
    addStrokeToActiveLayer(strokeData) {
        if (!this.activeLayerId) {
            console.warn('⚠️ アクティブレイヤーが設定されていません');
            return false;
        }
        
        return this.addStrokeToLayer(this.activeLayerId, strokeData);
    }
    
    /**
     * 指定レイヤーにストローク追加
     */
    addStrokeToLayer(layerId, strokeData) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            
            // ベクターデータ保存
            const vectorStroke = {
                id: this.generateStrokeId(),
                points: cloneDeep(strokeData.points || []),
                tool: strokeData.tool || 'pen',
                color: strokeData.color || 0x800000,
                size: strokeData.size || 2,
                opacity: strokeData.opacity || 1.0,
                pressure: strokeData.pressure || 1.0,
                timestamp: Date.now()
            };
            
            layer.vectorStrokes.push(vectorStroke);
            
            // PixiJS Graphics オブジェクト参照
            if (strokeData.graphics) {
                layer.graphicsObjects.push({
                    graphics: strokeData.graphics,
                    vectorId: vectorStroke.id,
                    timestamp: Date.now()
                });
            }
            
            // レイヤー更新
            layer.config.modified = Date.now();
            this.updateLayerBounds(layerId);
            this.generateLayerThumbnail(layerId);
            
            // イベント通知
            this.eventStore.emit('layer:stroke:added', {
                layerId: layerId,
                strokeId: vectorStroke.id,
                vectorData: vectorStroke,
                timestamp: Date.now()
            });
            
            return vectorStroke.id;
            
        } catch (error) {
            console.error('❌ ストローク追加エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤー変形（非破壊）
     */
    transformLayer(layerId, transformMatrix) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            
            // 変形履歴記録
            if (!this.transformHistory.has(layerId)) {
                this.transformHistory.set(layerId, []);
            }
            
            const history = this.transformHistory.get(layerId);
            history.push({
                matrix: layer.transformMatrix.clone(),
                timestamp: Date.now()
            });
            
            // 変形行列適用
            layer.transformMatrix.append(transformMatrix);
            
            // PixiJS Container変形
            const matrix = layer.transformMatrix;
            layer.container.setTransform(
                matrix.tx, matrix.ty,
                matrix.a, matrix.d,
                0, // rotation (行列から計算)
                matrix.b, matrix.c
            );
            
            // レイヤー更新
            layer.config.modified = Date.now();
            this.updateLayerBounds(layerId);
            this.generateLayerThumbnail(layerId);
            
            // イベント通知
            this.eventStore.emit('layer:transformed', {
                layerId: layerId,
                matrix: transformMatrix,
                timestamp: Date.now()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー変形エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤーグループ作成
     */
    createLayerGroup(groupId = null, config = {}) {
        try {
            const id = groupId || this.generateGroupId();
            
            // グループ設定
            const groupConfig = {
                id: id,
                name: config.name || `Group ${this.groupIdCounter}`,
                layers: [],
                opacity: config.opacity !== undefined ? config.opacity : 1.0,
                visible: config.visible !== undefined ? config.visible : true,
                locked: config.locked || false,
                collapsed: config.collapsed || false,
                created: Date.now()
            };
            
            // PixiJS Container作成
            const container = new PIXI.Container();
            container.name = `group_${id}`;
            container.alpha = groupConfig.opacity;
            container.visible = groupConfig.visible;
            
            this.layerGroups.set(id, {
                config: groupConfig,
                container: container
            });
            
            this.layerContainer.addChild(container);
            
            console.log(`📚 レイヤーグループ作成: ${id}`);
            return id;
            
        } catch (error) {
            console.error('❌ レイヤーグループ作成エラー:', error);
            return null;
        }
    }
    
    /**
     * レイヤーグループに追加
     */
    addLayerToGroup(layerId, groupId) {
        try {
            if (!this.layers.has(layerId) || !this.layerGroups.has(groupId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const group = this.layerGroups.get(groupId);
            
            // Container階層変更
            this.layerContainer.removeChild(layer.container);
            group.container.addChild(layer.container);
            
            // グループ情報更新
            group.config.layers.push(layerId);
            
            console.log(`📚 レイヤーをグループに追加: ${layerId} → ${groupId}`);
            return true;
            
        } catch (error) {
            console.error('❌ レイヤーグループ追加エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤー境界更新
     */
    updateLayerBounds(layerId) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            const layer = this.layers.get(layerId);
            const bounds = layer.container.getBounds();
            
            layer.bounds.copyFrom(bounds);
            
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー境界更新エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤーサムネイル生成
     */
    generateLayerThumbnail(layerId) {
        try {
            if (!this.layers.has(layerId)) {
                return null;
            }
            
            const layer = this.layers.get(layerId);
            
            // RenderTexture作成
            const renderTexture = PIXI.RenderTexture.create({
                width: this.thumbnailSize.width,
                height: this.thumbnailSize.height
            });
            
            // レイヤーContainer描画
            this.app.renderer.render(layer.container, { renderTexture });
            
            // Sprite作成
            const thumbnail = PIXI.Sprite.from(renderTexture);
            
            // キャッシュ保存
            if (this.thumbnailCache.has(layerId)) {
                const oldThumbnail = this.thumbnailCache.get(layerId);
                oldThumbnail.texture.destroy(true);
                oldThumbnail.destroy();
            }
            
            this.thumbnailCache.set(layerId, thumbnail);
            layer.thumbnail = thumbnail;
            
            // イベント通知
            this.eventStore.emit('layer:thumbnail:generated', {
                layerId: layerId,
                thumbnail: thumbnail,
                timestamp: Date.now()
            });
            
            return thumbnail;
            
        } catch (error) {
            console.error('❌ レイヤーサムネイル生成エラー:', error);
            return null;
        }
    }
    
    /**
     * カリング境界更新
     */
    updateCullingBounds() {
        this.cullingBounds.copyFrom(this.app.screen);
        
        // 余裕を持たせる（画面外描画対応）
        this.cullingBounds.pad(100);
    }
    
    /**
     * レンダリング最適化実行
     */
    performRenderOptimization() {
        try {
            let optimizedCount = 0;
            
            // レイヤー可視性最適化
            for (const [layerId, layer] of this.layers) {
                const bounds = layer.bounds;
                const visible = this.cullingBounds.intersects(bounds);
                
                if (layer.container.visible !== visible && layer.config.visible) {
                    layer.container.visible = visible;
                    optimizedCount++;
                }
            }
            
            if (optimizedCount > 0) {
                console.log(`⚡ レンダリング最適化実行: ${optimizedCount}レイヤー`);
            }
            
        } catch (error) {
            console.error('❌ レンダリング最適化エラー:', error);
        }
    }
    
    /**
     * 最適化されたBounds計算
     */
    optimizedCalculateBounds() {
        // キャッシュ活用による高速化
        const cacheKey = this.getLayerStateHash();
        
        if (this.boundsCache && this.boundsCache.key === cacheKey) {
            return this.boundsCache.bounds;
        }
        
        // 標準計算実行
        const bounds = PIXI.Container.prototype.calculateBounds.call(this.layerContainer);
        
        // キャッシュ保存
        this.boundsCache = {
            key: cacheKey,
            bounds: bounds,
            timestamp: Date.now()
        };
        
        return bounds;
    }
    
    /**
     * レイヤー状態ハッシュ生成
     */
    getLayerStateHash() {
        let hash = '';
        
        for (const [layerId, layer] of this.layers) {
            hash += `${layerId}:${layer.config.modified}:${layer.container.visible}:`;
        }
        
        return hash;
    }
    
    /**
     * レイヤーID生成
     */
    generateLayerId() {
        return `layer_${this.layerIdCounter++}_${Date.now().toString(36)}`;
    }
    
    /**
     * ストロークID生成
     */
    generateStrokeId() {
        return `stroke_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    }
    
    /**
     * グループID生成
     */
    generateGroupId() {
        return `group_${this.groupIdCounter++}_${Date.now().toString(36)}`;
    }
    
    /**
     * レイヤー情報取得
     */
    getLayerInfo(layerId) {
        if (!this.layers.has(layerId)) {
            return null;
        }
        
        const layer = this.layers.get(layerId);
        
        return {
            id: layerId,
            config: { ...layer.config },
            vectorStrokeCount: layer.vectorStrokes.length,
            graphicsCount: layer.graphicsObjects.length,
            bounds: layer.bounds.clone(),
            hasTransform: !layer.transformMatrix.isIdentity(),
            thumbnailExists: !!layer.thumbnail
        };
    }
    
    /**
     * 全レイヤー情報取得
     */
    getAllLayersInfo() {
        const layersInfo = [];
        
        for (const layerId of this.layerOrder) {
            const info = this.getLayerInfo(layerId);
            if (info) {
                layersInfo.push(info);
            }
        }
        
        return {
            layers: layersInfo,
            activeLayerId: this.activeLayerId,
            totalLayers: this.layers.size,
            totalGroups: this.layerGroups.size,
            renderOptimization: this.renderOptimization
        };
    }
    
    /**
     * レイヤー順序変更
     */
    reorderLayer(layerId, newIndex) {
        try {
            if (!this.layers.has(layerId)) {
                return false;
            }
            
            // 現在の位置を取得
            const currentIndex = this.layerOrder.indexOf(layerId);
            if (currentIndex === -1) {
                return false;
            }
            
            // 配列から削除して新しい位置に挿入
            this.layerOrder.splice(currentIndex, 1);
            this.layerOrder.splice(newIndex, 0, layerId);
            
            // PixiJS Container zIndex更新
            const layer = this.layers.get(layerId);
            layer.container.zIndex = newIndex;
            layer.config.zIndex = newIndex;
            
            // 他のレイヤーのzIndexも調整
            for (let i = 0; i < this.layerOrder.length; i++) {
                const id = this.layerOrder[i];
                const l = this.layers.get(id);
                if (l && l.container.zIndex !== i) {
                    l.container.zIndex = i;
                    l.config.zIndex = i;
                }
            }
            
            // Container再ソート
            this.layerContainer.sortChildren();
            
            // イベント通知
            this.eventStore.emit('layer:reordered', {
                layerId: layerId,
                fromIndex: currentIndex,
                toIndex: newIndex,
                timestamp: Date.now()
            });
            
            console.log(`📚 レイヤー順序変更: ${layerId} (${currentIndex} → ${newIndex})`);
            return true;
            
        } catch (error) {
            console.error('❌ レイヤー順序変更エラー:', error);
            return false;
        }
    }
    
    /**
     * レイヤー複製
     */
    duplicateLayer(layerId) {
        try {
            if (!this.layers.has(layerId)) {
                return null;
            }
            
            const originalLayer = this.layers.get(layerId);
            
            // 新しいレイヤー作成
            const newLayerId = this.createLayer(null, {
                name: originalLayer.config.name + ' (コピー)',
                opacity: originalLayer.config.opacity,
                visible: originalLayer.config.visible,
                blendMode: originalLayer.config.blendMode
            });
            
            if (!newLayerId) {
                return null;
            }
            
            const newLayer = this.layers.get(newLayerId);
            
            // ベクターデータ複製
            newLayer.vectorStrokes = cloneDeep(originalLayer.vectorStrokes);
            
            // Graphics オブジェクト再作成
            for (const vectorStroke of newLayer.vectorStrokes) {
                vectorStroke.id = this.generateStrokeId(); // 新しいID生成
                
                // Graphics再描画
                const graphics = new PIXI.Graphics();
                this.renderVectorStroke(graphics, vectorStroke);
                newLayer.container.addChild(graphics);
                
                newLayer.graphicsObjects.push({
                    graphics: graphics,
                    vectorId: vectorStroke.id,
                    timestamp: Date.now()
                });
            }
            
            // 変形行列複製
            newLayer.transformMatrix.copyFrom(originalLayer.transformMatrix);
            this.applyTransformMatrix(newLayer);
            
            // サムネイル生成
            this.generateLayerThumbnail(newLayerId);
            
            // イベント通知
            this.eventStore.emit('layer:duplicated', {
                originalLayerId: layerId,
                newLayerId: newLayerId,
                timestamp: Date.now()
            });
            
            console.log(`📚 レイヤー複製完了: ${layerId} → ${newLayerId}`);
            return newLayerId;
            
        } catch (error) {
            console.error('❌ レイヤー複製エラー:', error);
            return null;
        }
    }
    
    /**
     * ベクターストローク描画
     */
    renderVectorStroke(graphics, vectorStroke) {
        graphics.lineStyle({
            width: vectorStroke.size,
            color: vectorStroke.color,
            alpha: vectorStroke.opacity,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND
        });
        
        const points = vectorStroke.points;
        if (points.length === 0) return;
        
        if (points.length === 1) {
            // 単点描画
            graphics.drawCircle(points[0].x, points[0].y, vectorStroke.size / 2);
        } else {
            // スムーズ曲線描画
            graphics.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                graphics.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            
            if (points.length > 1) {
                const last = points[points.length - 1];
                graphics.lineTo(last.x, last.y);
            }
        }
    }
    
    /**
     * 変形行列適用
     */
    applyTransformMatrix(layer) {
        const matrix = layer.transformMatrix;
        layer.container.setTransform(
            matrix.tx, matrix.ty,
            matrix.a, matrix.d,
            0,
            matrix.b, matrix.c
        );
    }
    
    /**
     * レイヤーマージ
     */
    mergeLayers(layerIds) {
        try {
            if (!layerIds || layerIds.length < 2) {
                console.warn('⚠️ マージには最低2つのレイヤーが必要です');
                return null;
            }
            
            // マージ先レイヤー作成
            const mergedLayerId = this.createLayer(null, {
                name: 'マージレイヤー',
                opacity: 1.0,
                visible: true
            });
            
            const mergedLayer = this.layers.get(mergedLayerId);
            
            // 各レイヤーをRenderTextureで描画
            for (const layerId of layerIds) {
                if (!this.layers.has(layerId)) continue;
                
                const layer = this.layers.get(layerId);
                
                // RenderTextureに描画
                const renderTexture = PIXI.RenderTexture.create({
                    width: this.app.view.width,
                    height: this.app.view.height
                });
                
                this.app.renderer.render(layer.container, { renderTexture });
                
                // Spriteとして追加
                const sprite = PIXI.Sprite.from(renderTexture);
                mergedLayer.container.addChild(sprite);
                
                // ベクターデータ統合
                mergedLayer.vectorStrokes.push(...cloneDeep(layer.vectorStrokes));
            }
            
            // 元レイヤー削除（オプション）
            const deleteOriginal = true; // 設定可能
            if (deleteOriginal) {
                for (const layerId of layerIds) {
                    this.deleteLayer(layerId);
                }
            }
            
            // サムネイル生成
            this.generateLayerThumbnail(mergedLayerId);
            
            console.log(`📚 レイヤーマージ完了: ${layerIds.length}層 → ${mergedLayerId}`);
            return mergedLayerId;
            
        } catch (error) {
            console.error('❌ レイヤーマージエラー:', error);
            return null;
        }
    }
    
    /**
     * レイヤーエクスポート（PNG）
     */
    async exportLayerToPNG(layerId, options = {}) {
        try {
            if (!this.layers.has(layerId)) {
                throw new Error(`レイヤーが存在しません: ${layerId}`);
            }
            
            const layer = this.layers.get(layerId);
            const config = {
                width: options.width || this.app.view.width,
                height: options.height || this.app.view.height,
                resolution: options.resolution || 1,
                backgroundColor: options.backgroundColor || 0x000000,
                transparent: options.transparent !== false
            };
            
            // RenderTexture作成
            const renderTexture = PIXI.RenderTexture.create({
                width: config.width,
                height: config.height,
                resolution: config.resolution
            });
            
            // レイヤー描画
            this.app.renderer.render(layer.container, { 
                renderTexture,
                clear: true,
                skipUpdateTransform: false
            });
            
            // Canvas抽出
            const canvas = this.app.renderer.extract.canvas(renderTexture);
            
            // Blob生成
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    renderTexture.destroy(true);
                    
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('PNG生成に失敗しました'));
                    }
                }, 'image/png', 1.0);
            });
            
        } catch (error) {
            console.error('❌ レイヤーPNGエクスポートエラー:', error);
            throw error;
        }
    }
    
    /**
     * 全レイヤーエクスポート
     */
    async exportAllLayersToPNG(options = {}) {
        try {
            const exports = [];
            
            for (const layerId of this.layerOrder) {
                try {
                    const blob = await this.exportLayerToPNG(layerId, options);
                    const layerInfo = this.getLayerInfo(layerId);
                    
                    exports.push({
                        layerId: layerId,
                        name: layerInfo.config.name,
                        blob: blob,
                        size: blob.size
                    });
                    
                } catch (error) {
                    console.warn(`⚠️ レイヤーエクスポート失敗: ${layerId}`, error);
                }
            }
            
            console.log(`📚 全レイヤーエクスポート完了: ${exports.length}層`);
            return exports;
            
        } catch (error) {
            console.error('❌ 全レイヤーエクスポートエラー:', error);
            throw error;
        }
    }
    
    /**
     * レンダリング最適化切り替え
     */
    setRenderOptimization(enabled) {
        this.renderOptimization = enabled;
        
        if (enabled) {
            console.log('⚡ レンダリング最適化: 有効');
        } else {
            console.log('⚡ レンダリング最適化: 無効');
            
            // 全レイヤー可視化復元
            for (const [layerId, layer] of this.layers) {
                layer.container.visible = layer.config.visible;
            }
        }
    }
    
    /**
     * レンダリング最適化更新
     */
    updateRenderOptimization(viewportData) {
        if (this.renderOptimization) {
            this.updateCullingBounds();
            this.performRenderOptimization();
        }
    }
    
    /**
     * 統計情報取得
     */
    getStatistics() {
        let totalStrokes = 0;
        let totalGraphics = 0;
        let visibleLayers = 0;
        
        for (const [layerId, layer] of this.layers) {
            totalStrokes += layer.vectorStrokes.length;
            totalGraphics += layer.graphicsObjects.length;
            if (layer.config.visible) visibleLayers++;
        }
        
        return {
            totalLayers: this.layers.size,
            totalGroups: this.layerGroups.size,
            totalStrokes: totalStrokes,
            totalGraphics: totalGraphics,
            visibleLayers: visibleLayers,
            activeLayerId: this.activeLayerId,
            renderOptimization: this.renderOptimization,
            thumbnailCacheSize: this.thumbnailCache.size,
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    /**
     * メモリ使用量推定
     */
    getMemoryUsage() {
        let textureMemory = 0;
        let vectorMemory = 0;
        
        // サムネイルメモリ
        for (const [layerId, thumbnail] of this.thumbnailCache) {
            if (thumbnail && thumbnail.texture) {
                textureMemory += this.thumbnailSize.width * this.thumbnailSize.height * 4; // RGBA
            }
        }
        
        // ベクターデータメモリ推定
        for (const [layerId, layer] of this.layers) {
            vectorMemory += layer.vectorStrokes.length * 100; // 1ストローク約100バイト
        }
        
        return {
            textureMemory: Math.round(textureMemory / 1024), // KB
            vectorMemory: Math.round(vectorMemory / 1024), // KB
            total: Math.round((textureMemory + vectorMemory) / 1024) // KB
        };
    }
    
    /**
     * デバッグ情報表示
     */
    debugInfo() {
        const stats = this.getStatistics();
        const info = this.getAllLayersInfo();
        
        console.group('📚 PixiLayerProcessor デバッグ情報');
        console.log('統計:', stats);
        console.log('レイヤー情報:', info);
        console.log('最適化設定:', {
            renderOptimization: this.renderOptimization,
            cullingBounds: this.cullingBounds,
            visibilityCache: this.visibilityCache.size
        });
        console.groupEnd();
        
        return { stats, info };
    }
    
    /**
     * 破棄処理
     */
    destroy() {
        try {
            // 最適化インターバル停止
            if (this.optimizationInterval) {
                clearInterval(this.optimizationInterval);
            }
            
            // 全レイヤー破棄
            for (const [layerId, layer] of this.layers) {
                layer.container.destroy({ children: true, texture: true });
            }
            this.layers.clear();
            
            // レイヤーグループ破棄
            for (const [groupId, group] of this.layerGroups) {
                group.container.destroy({ children: true });
            }
            this.layerGroups.clear();
            
            // サムネイルキャッシュ破棄
            for (const [layerId, thumbnail] of this.thumbnailCache) {
                if (thumbnail && thumbnail.texture) {
                    thumbnail.texture.destroy(true);
                }
                thumbnail.destroy();
            }
            this.thumbnailCache.clear();
            
            // Container破棄
            if (this.layerContainer) {
                this.layerContainer.destroy({ children: true });
            }
            
            console.log('📚 PixiLayerProcessor破棄完了');
            
        } catch (error) {
            console.error('❌ PixiLayerProcessor破棄エラー:', error);
        }
    }
}