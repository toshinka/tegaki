/**
 * 🎨 ふたば☆ちゃんねる風ベクターお絵描きツール v1rev13
 * LayerManager - @pixi/layers導入版 (Phase4: レイヤー機能実装)
 * 
 * 📝 Phase4新規実装内容:
 * - @pixi/layers使用の本格的レイヤーシステム実装
 * - 非破壊的レイヤー移動・変形機能
 * - RenderTexture + @pixi/layers統合
 * - レイヤー管理UI連携
 * 
 * 🔧 使用ライブラリ:
 * - @pixi/layers: 高度なレイヤー管理・Z-order制御
 * - PixiJS v7標準API: Container・RenderTexture
 * 
 * 責務: レイヤー作成・管理・非破壊的操作・UI連携
 * 依存: PixiJS v7, @pixi/layers (オプション), window.PixiExtensions
 */

console.log('🎨 LayerManager @pixi/layers導入版 読み込み開始...');

class LayerManager {
    constructor(app, config = {}) {
        this.app = app;
        this.config = {
            maxLayers: window.LIBRARY_CONFIG?.LAYER_MAX_COUNT || 10,
            defaultLayerNames: window.LIBRARY_CONFIG?.LAYER_DEFAULT_NAMES || ['background', 'drawing', 'ui'],
            zIndexStep: window.LIBRARY_CONFIG?.LAYER_Z_INDEX_STEP || 10,
            ...config
        };
        
        // レイヤー管理
        this.layers = new Map();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.layerCounter = 0;
        
        // @pixi/layers関連
        this.layersAvailable = false;
        this.layerClass = null;
        this.groupClass = null;
        
        // レンダーテクスチャプール
        this.renderTexturePool = [];
        this.maxPoolSize = window.LIBRARY_CONFIG?.RENDER_TEXTURE_POOL_SIZE || 10;
        
        // UI連携
        this.uiCallbacks = new Map();
        
        console.log('🎨 LayerManager @pixi/layers導入版 構築完了');
    }
    
    /**
     * Phase4: @pixi/layers使用初期化
     */
    async init() {
        console.log('🎨 LayerManager @pixi/layers導入版 初期化開始...');
        
        try {
            // @pixi/layers 可用性チェック
            this.checkLayersAvailability();
            
            // レイヤークラス決定
            this.determineLayerClasses();
            
            // レンダーテクスチャプール初期化
            this.initRenderTexturePool();
            
            // デフォルトレイヤー作成
            await this.createDefaultLayers();
            
            // UI連携設定
            this.setupUIIntegration();
            
            console.log('✅ LayerManager @pixi/layers導入版 初期化完了');
            return true;
            
        } catch (error) {
            console.error('❌ LayerManager初期化失敗:', error);
            return false;
        }
    }
    
    /**
     * @pixi/layers可用性チェック
     */
    checkLayersAvailability() {
        this.layersAvailable = !!(
            window.PixiExtensions?.hasFeature('layers') ||
            (window.PIXI && window.PIXI.display?.Layer) ||
            window.pixiLayers
        );
        
        console.log(`📊 @pixi/layers利用可能性: ${this.layersAvailable ? '✅' : '❌'}`);
        
        if (this.layersAvailable) {
            console.log('🎉 @pixi/layers使用で高度なレイヤー機能を実装します');
        } else {
            console.log('📦 フォールバック: 通常Container使用でレイヤー機能を提供');
        }
    }
    
    /**
     * レイヤークラス決定
     */
    determineLayerClasses() {
        if (this.layersAvailable) {
            // @pixi/layers使用
            this.layerClass = window.PixiExtensions?.Layers?.Layer ||
                             window.PIXI?.display?.Layer ||
                             window.pixiLayers?.Layer;
                             
            this.groupClass = window.PixiExtensions?.Layers?.Group ||
                             window.PIXI?.display?.Group ||
                             window.pixiLayers?.Group;
            
            if (this.layerClass && this.groupClass) {
                console.log('✅ @pixi/layers Layer・Groupクラス使用');
            } else {
                console.warn('⚠️ @pixi/layers クラス取得失敗、通常Containerを使用');
                this.layerClass = PIXI.Container;
                this.layersAvailable = false;
            }
        } else {
            // 通常Container使用
            this.layerClass = PIXI.Container;
            console.log('📦 通常Containerクラス使用');
        }
    }
    
    /**
     * レンダーテクスチャプール初期化
     */
    initRenderTexturePool() {
        const canvasSize = {
            width: this.app.screen.width,
            height: this.app.screen.height
        };
        
        // プール作成
        for (let i = 0; i < this.maxPoolSize; i++) {
            const renderTexture = PIXI.RenderTexture.create(canvasSize);
            this.renderTexturePool.push({
                texture: renderTexture,
                inUse: false,
                id: `pool_${i}`
            });
        }
        
        console.log(`📦 RenderTextureプール初期化完了: ${this.maxPoolSize}個`);
    }
    
    /**
     * デフォルトレイヤー作成
     */
    async createDefaultLayers() {
        console.log('🏗️ デフォルトレイヤー作成開始...');
        
        for (const [index, layerName] of this.config.defaultLayerNames.entries()) {
            const layer = await this.createLayer(layerName, {
                zIndex: index * this.config.zIndexStep,
                isDefault: true
            });
            
            if (index === 1) { // 'drawing'レイヤーをデフォルトアクティブに
                this.setActiveLayer(layer.id);
            }
        }
        
        console.log('✅ デフォルトレイヤー作成完了');
    }
    
    /**
     * レイヤー作成
     */
    async createLayer(name, options = {}) {
        const {
            zIndex = this.layerOrder.length * this.config.zIndexStep,
            visible = true,
            opacity = 1.0,
            blendMode = PIXI.BLEND_MODES.NORMAL,
            isDefault = false
        } = options;
        
        // レイヤー数制限チェック
        if (this.layers.size >= this.config.maxLayers) {
            throw new Error(`レイヤー数上限（${this.config.maxLayers}）に達しています`);
        }
        
        // 一意なID生成
        const layerId = this.generateLayerId(name);
        
        // レイヤーオブジェクト作成
        let layerContainer;
        
        if (this.layersAvailable) {
            // @pixi/layers使用
            layerContainer = new this.layerClass();
            layerContainer.group.enableSort = true;
        } else {
            // 通常Container使用
            layerContainer = new PIXI.Container();
            layerContainer.sortableChildren = true;
        }
        
        // レイヤー設定
        layerContainer.name = name;
        layerContainer.zIndex = zIndex;
        layerContainer.visible = visible;
        layerContainer.alpha = opacity;
        layerContainer.blendMode = blendMode;
        
        // レイヤー管理オブジェクト
        const layerData = {
            id: layerId,
            name: name,
            container: layerContainer,
            zIndex: zIndex,
            visible: visible,
            opacity: opacity,
            blendMode: blendMode,
            isDefault: isDefault,
            renderTexture: null,
            isLocked: false,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        
        // マップ・配列に追加
        this.layers.set(layerId, layerData);
        this.layerOrder.push(layerId);
        
        // ステージに追加
        this.app.stage.addChild(layerContainer);
        
        // ソート実行
        this.sortLayers();
        
        // UI更新通知
        this.notifyUIUpdate('layerCreated', layerData);
        
        console.log(`📝 レイヤー作成完了: ${name} (ID: ${layerId})`);
        return layerData;
    }
    
    /**
     * レイヤーID生成
     */
    generateLayerId(name) {
        this.layerCounter++;
        const baseName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `layer_${baseName}_${this.layerCounter}`;
    }
    
    /**
     * レイヤー取得
     */
    getLayer(layerId) {
        return this.layers.get(layerId);
    }
    
    /**
     * レイヤー名で取得
     */
    getLayerByName(name) {
        for (const layer of this.layers.values()) {
            if (layer.name === name) {
                return layer;
            }
        }
        return null;
    }
    
    /**
     * アクティブレイヤー設定
     */
    setActiveLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`レイヤーが見つかりません: ${layerId}`);
            return false;
        }
        
        if (layer.isLocked) {
            console.warn(`ロックされたレイヤーです: ${layer.name}`);
            return false;
        }
        
        const previousActive = this.activeLayerId;
        this.activeLayerId = layerId;
        
        // UI更新通知
        this.notifyUIUpdate('activeLayerChanged', {
            previous: previousActive,
            current: layerId,
            layer: layer
        });
        
        console.log(`🎯 アクティブレイヤー設定: ${layer.name} (${layerId})`);
        return true;
    }
    
    /**
     * アクティブレイヤー取得
     */
    getActiveLayer() {
        return this.activeLayerId ? this.layers.get(this.activeLayerId) : null;
    }
    
    /**
     * Phase4: レイヤー順序変更（非破壊的）
     */
    moveLayer(layerId, newZIndex) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`レイヤーが見つかりません: ${layerId}`);
            return false;
        }
        
        if (layer.isLocked) {
            console.warn(`ロックされたレイヤーです: ${layer.name}`);
            return false;
        }
        
        const oldZIndex = layer.zIndex;
        
        // zIndex更新
        layer.zIndex = newZIndex;
        layer.container.zIndex = newZIndex;
        layer.modifiedAt = Date.now();
        
        // ソート実行
        this.sortLayers();
        
        // UI更新通知
        this.notifyUIUpdate('layerMoved', {
            layerId,
            layer,
            oldZIndex,
            newZIndex
        });
        
        console.log(`📐 レイヤー移動: ${layer.name} (${oldZIndex} → ${newZIndex})`);
        return true;
    }
    
    /**
     * レイヤーソート実行
     */
    sortLayers() {
        if (this.layersAvailable) {
            // @pixi/layers使用時は自動ソート
            this.app.stage.sortChildren();
        } else {
            // 通常Container使用時は手動ソート
            this.layerOrder.sort((a, b) => {
                const layerA = this.layers.get(a);
                const layerB = this.layers.get(b);
                return layerA.zIndex - layerB.zIndex;
            });
            
            // 実際のコンテナ順序を調整
            this.layerOrder.forEach((layerId, index) => {
                const layer = this.layers.get(layerId);
                if (layer && layer.container.parent) {
                    layer.container.parent.setChildIndex(layer.container, index);
                }
            });
        }
    }
    
    /**
     * レイヤー表示/非表示切り替え
     */
    toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        layer.visible = !layer.visible;
        layer.container.visible = layer.visible;
        layer.modifiedAt = Date.now();
        
        // UI更新通知
        this.notifyUIUpdate('layerVisibilityChanged', {
            layerId,
            layer,
            visible: layer.visible
        });
        
        console.log(`👁️ レイヤー表示切り替え: ${layer.name} → ${layer.visible ? '表示' : '非表示'}`);
        return true;
    }
    
    /**
     * レイヤー透明度設定
     */
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        layer.opacity = clampedOpacity;
        layer.container.alpha = clampedOpacity;
        layer.modifiedAt = Date.now();
        
        // UI更新通知
        this.notifyUIUpdate('layerOpacityChanged', {
            layerId,
            layer,
            opacity: clampedOpacity
        });
        
        console.log(`🌫️ レイヤー透明度設定: ${layer.name} → ${Math.round(clampedOpacity * 100)}%`);
        return true;
    }
    
    /**
     * レイヤーロック/解除
     */
    toggleLayerLock(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return false;
        
        layer.isLocked = !layer.isLocked;
        layer.modifiedAt = Date.now();
        
        // アクティブレイヤーがロックされた場合は別のレイヤーに変更
        if (layer.isLocked && this.activeLayerId === layerId) {
            const nextActive = this.findNextUnlockedLayer(layerId);
            if (nextActive) {
                this.setActiveLayer(nextActive.id);
            }
        }
        
        // UI更新通知
        this.notifyUIUpdate('layerLockChanged', {
            layerId,
            layer,
            isLocked: layer.isLocked
        });
        
        console.log(`🔒 レイヤーロック切り替え: ${layer.name} → ${layer.isLocked ? 'ロック' : '解除'}`);
        return true;
    }
    
    /**
     * 次のアンロックレイヤー検索
     */
    findNextUnlockedLayer(excludeLayerId) {
        for (const layer of this.layers.values()) {
            if (layer.id !== excludeLayerId && !layer.isLocked) {
                return layer;
            }
        }
        return null;
    }
    
    /**
     * Phase4: 非破壊的レイヤー変形
     */
    async createLayerSnapshot(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            throw new Error(`レイヤーが見つかりません: ${layerId}`);
        }
        
        // レンダーテクスチャ取得
        const renderTexture = this.getRenderTextureFromPool();
        if (!renderTexture) {
            throw new Error('レンダーテクスチャプールが満杯です');
        }
        
        // レイヤーをレンダーテクスチャに描画
        this.app.renderer.render(layer.container, renderTexture.texture);
        
        // レイヤーデータに関連付け
        layer.renderTexture = renderTexture;
        
        console.log(`📸 レイヤースナップショット作成: ${layer.name}`);
        return renderTexture;
    }
    
    /**
     * レンダーテクスチャプールから取得
     */
    getRenderTextureFromPool() {
        const available = this.renderTexturePool.find(item => !item.inUse);
        if (available) {
            available.inUse = true;
            return available;
        }
        return null;
    }
    
    /**
     * レンダーテクスチャプールに返却
     */
    returnRenderTextureToPool(renderTexture) {
        const poolItem = this.renderTexturePool.find(item => item === renderTexture);
        if (poolItem) {
            poolItem.inUse = false;
            
            // テクスチャクリア
            this.app.renderer.render(new PIXI.Container(), poolItem.texture);
        }
    }
    
    /**
     * レイヤー削除
     */
    async deleteLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) {
            console.warn(`レイヤーが見つかりません: ${layerId}`);
            return false;
        }
        
        if (layer.isDefault) {
            console.warn(`デフォルトレイヤーは削除できません: ${layer.name}`);
            return false;
        }
        
        // レンダーテクスチャクリーンアップ
        if (layer.renderTexture) {
            this.returnRenderTextureToPool(layer.renderTexture);
            layer.renderTexture = null;
        }
        
        // ステージから削除
        if (layer.container.parent) {
            layer.container.parent.removeChild(layer.container);
        }
        
        // コンテナクリーンアップ
        layer.container.destroy({ children: true });
        
        // マップ・配列から削除
        this.layers.delete(layerId);
        this.layerOrder = this.layerOrder.filter(id => id !== layerId);
        
        // アクティブレイヤー調整
        if (this.activeLayerId === layerId) {
            const nextActive = this.layers.values().next().value;
            this.activeLayerId = nextActive ? nextActive.id : null;
        }
        
        // UI更新通知
        this.notifyUIUpdate('layerDeleted', {
            layerId,
            layerName: layer.name
        });
        
        console.log(`🗑️ レイヤー削除完了: ${layer.name}`);
        return true;
    }
    
    /**
     * 全レイヤー取得
     */
    getAllLayers() {
        return Array.from(this.layers.values()).sort((a, b) => a.zIndex - b.zIndex);
    }
    
    /**
     * レイヤー数取得
     */
    getLayerCount() {
        return this.layers.size;
    }
    
    /**
     * UI連携設定
     */
    setupUIIntegration() {
        // UI更新コールバック初期化
        this.uiCallbacks.set('layerCreated', []);
        this.uiCallbacks.set('layerDeleted', []);
        this.uiCallbacks.set('activeLayerChanged', []);
        this.uiCallbacks.set('layerMoved', []);
        this.uiCallbacks.set('layerVisibilityChanged', []);
        this.uiCallbacks.set('layerOpacityChanged', []);
        this.uiCallbacks.set('layerLockChanged', []);
        
        console.log('🔗 UI連携設定完了');
    }
    
    /**
     * UI更新通知
     */
    notifyUIUpdate(event, data) {
        const callbacks = this.uiCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`UI更新通知エラー (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * UIコールバック登録
     */
    onUIUpdate(event, callback) {
        const callbacks = this.uiCallbacks.get(event);
        if (callbacks) {
            callbacks.push(callback);
        } else {
            this.uiCallbacks.set(event, [callback]);
        }
    }
    
    /**
     * UIコールバック削除
     */
    offUIUpdate(event, callback) {
        const callbacks = this.uiCallbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * 統計情報取得
     */
    getStats() {
        return {
            layersAvailable: this.layersAvailable,
            layerClass: this.layerClass?.name || 'Unknown',
            totalLayers: this.layers.size,
            maxLayers: this.config.maxLayers,
            activeLayerId: this.activeLayerId,
            renderTexturePool: {
                total: this.renderTexturePool.length,
                inUse: this.renderTexturePool.filter(item => item.inUse).length,
                available: this.renderTexturePool.filter(item => !item.inUse).length
            },
            layers: this.getAllLayers().map(layer => ({
                id: layer.id,
                name: layer.name,
                zIndex: layer.zIndex,
                visible: layer.visible,
                opacity: layer.opacity,
                isLocked: layer.isLocked,
                isDefault: layer.isDefault,
                hasRenderTexture: !!layer.renderTexture
            }))
        };
    }
    
    /**
     * クリーンアップ
     */
    async destroy() {
        console.log('🧹 LayerManager クリーンアップ開始...');
        
        // 全レイヤー削除
        const layerIds = Array.from(this.layers.keys());
        for (const layerId of layerIds) {
            await this.deleteLayer(layerId);
        }
        
        // レンダーテクスチャプールクリーンアップ
        this.renderTexturePool.forEach(item => {
            if (item.texture) {
                item.texture.destroy();
            }
        });
        this.renderTexturePool = [];
        
        // UIコールバッククリア
        this.uiCallbacks.clear();
        
        // 状態リセット
        this.layers.clear();
        this.layerOrder = [];
        this.activeLayerId = null;
        this.layerCounter = 0;
        
        console.log('✅ LayerManager クリーンアップ完了');
    }
}

// グローバル公開
if (typeof window !== 'undefined') {
    window.LayerManager = LayerManager;
    
    // デバッグ関数
    window.testLayerManager = function() {
        console.group('🧪 LayerManager @pixi/layers導入版 テスト');
        
        if (window.app) {
            const layerManager = new LayerManager(window.app);
            
            layerManager.init().then(async success => {
                if (success) {
                    console.log('✅ 初期化成功');
                    console.log('📊 統計:', layerManager.getStats());
                    
                    // レイヤー作成テスト
                    try {
                        const testLayer = await layerManager.createLayer('テストレイヤー', {
                            zIndex: 50,
                            opacity: 0.8
                        });
                        console.log('📝 レイヤー作成テスト成功:', testLayer.name);
                        
                        // アクティブ切り替えテスト
                        layerManager.setActiveLayer(testLayer.id);
                        console.log('🎯 アクティブレイヤー切り替えテスト完了');
                        
                        // 透明度変更テスト
                        layerManager.setLayerOpacity(testLayer.id, 0.5);
                        console.log('🌫️ 透明度変更テスト完了');
                        
                        // 最終統計表示
                        setTimeout(() => {
                            console.log('📊 最終統計:', layerManager.getStats());
                        }, 1000);
                        
                    } catch (error) {
                        console.error('❌ レイヤー操作テスト失敗:', error);
                    }
                } else {
                    console.error('❌ 初期化失敗');
                }
            });
        } else {
            console.warn('⚠️ PixiJS app が利用できません');
        }
        
        console.groupEnd();
    };
    
    console.log('✅ LayerManager @pixi/layers導入版 読み込み完了');
    console.log('📦 Phase4新機能:');
    console.log('  ✅ @pixi/layers使用の本格的レイヤーシステム');
    console.log('  ✅ 非破壊的レイヤー移動・変形機能');
    console.log('  ✅ RenderTexture + @pixi/layers統合');
    console.log('  ✅ レイヤー管理UI連携システム');
    console.log('  ✅ @pixi/layers + フォールバックのハイブリッド対応');
    console.log('🧪 テスト関数: window.testLayerManager()');
}