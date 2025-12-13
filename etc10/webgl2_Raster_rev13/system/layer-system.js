/**
 * ============================================================================
 * ファイル名: system/layer-system.js - Phase B-Emergency-4: 転送受信実装
 * 責務: レイヤー管理・操作の中核システム（WebGL2分離アーキテクチャ対応）
 * 
 * 【Phase B-Emergency-4 改修内容】
 * 🚨 BE-4: 転送イベントリスナー登録（layer:texture-updated）
 * 🚨 BE-4: _receiveTransferredTexture() 実装
 * 🚨 BE-4: _updateLayerSprite() 実装
 * 🚨 BE-4: レイヤーSprite自動生成・管理
 * ✅ Phase 3 ラスター機能完全継承
 * ✅ Phase 2 フォルダ機能完全継承
 * 
 * 【親ファイル依存】
 * - event-bus.js (イベント通信)
 * - data-models.js (LayerModel定義)
 * - layer-transform.js (変形処理委譲)
 * - coordinate-system.js (座標変換)
 * - camera-system.js (worldContainer提供)
 * - config.js (設定値)
 * - history.js (Undo/Redo)
 * - gl-texture-bridge.js (Texture転送) 🆕
 * 
 * 【子ファイル依存このファイルに】
 * - layer-panel-renderer.js (UI描画 - EventBus経由のみ)
 * - keyboard-handler.js (ショートカット)
 * - thumbnail-system.js (サムネイル更新)
 * - brush-core.js (描画系History登録の責任者)
 * - raster-brush-core.js (ラスター描画)
 * - drawing-engine.js (activeLayer取得・座標変換)
 * ============================================================================
 */

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.currentFrameContainer = null;
            this.activeLayerIndex = -1;
            
            // フレーム管理
            this.frameRenderTextures = new Map();
            this.frameThumbnailDirty = new Map();
            
            // 🆕 BE-4: レイヤーSprite管理（WebGL2分離アーキテクチャ）
            this.layerSprites = new Map(); // layerId → PIXI.Sprite
            
            // システム参照
            this.cameraSystem = null;
            this.animationSystem = null;
            this.coordAPI = window.CoordinateSystem;
            this.transform = null;
            
            // 状態
            this.isInitialized = false;
            this.checkerPattern = null;
            
            // ラスターレイヤー管理（Phase 3）
            this.rasterLayerManager = null;
        }

        // ================================================================================
        // 初期化
        // ================================================================================

        init(canvasContainer, eventBus, config) {
            console.log('[LayerSystem] 🔍 init() called');
            console.log('[LayerSystem]   canvasContainer:', canvasContainer);
            
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            if (!this.eventBus) throw new Error('EventBus required for LayerSystem');
            
            // Transform初期化
            if (window.TegakiLayerTransform) {
                this.transform = new window.TegakiLayerTransform(this.config, this.coordAPI);
            } else {
                this.transform = null;
            }
            
            // currentFrameContainerの初期化
            if (!this.currentFrameContainer) {
                this.currentFrameContainer = new PIXI.Container();
                this.currentFrameContainer.label = 'frame_container_init';
                console.log('[LayerSystem]   ✅ New currentFrameContainer created');
            } else {
                console.log('[LayerSystem]   ✅ Reusing existing currentFrameContainer');
            }
            
            // 背景レイヤー作成
            const bgLayer = new PIXI.Container();
            const bgLayerModel = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_bg_' + Date.now(),
                name: '背景',
                isBackground: true
            });
            bgLayer.label = bgLayerModel.id;
            bgLayer.layerData = bgLayerModel;
            bgLayer.id = bgLayerModel.id;
            
            const bg = this._createSolidBackground(
                this.config.canvas.width, 
                this.config.canvas.height,
                0xf0e0d6
            );
            bgLayer.addChild(bg);
            bgLayer.layerData.backgroundGraphics = bg;
            bgLayer.layerData.backgroundColor = 0xf0e0d6;
            this.currentFrameContainer.addChild(bgLayer);
            console.log('[LayerSystem]   ✅ Background layer added');
            
            // レイヤー1作成
            const layer1 = new PIXI.Container();
            const layer1Model = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_1_' + Date.now(),
                name: 'レイヤー1'
            });
            layer1.label = layer1Model.id;
            layer1.layerData = layer1Model;
            layer1.id = layer1Model.id;
            
            // 🆕 BE-4: レイヤーSprite生成・登録
            this._createLayerSprite(layer1Model.id, layer1);
            
            if (this.transform) {
                this.transform.setTransform(layer1Model.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
            }
            this.currentFrameContainer.addChild(layer1);
            this.activeLayerIndex = 1;
            console.log('[LayerSystem]   ✅ Layer 1 added, activeLayerIndex set to 1');
            
            this._setupLayerOperations();
            this._setupAnimationSystemIntegration();
            this._setupVKeyEvents();
            this._setupResizeEvents();
            
            // 🚨 BE-4: 転送イベントリスナー登録
            this._setupTextureTransferListener();
            
            this.isInitialized = true;
            console.log('[LayerSystem]   ✅ init() completed successfully');
            console.log('[LayerSystem]   currentFrameContainer.children.length:', this.currentFrameContainer.children.length);
            
            // イベント発火でUI側に初期化完了を通知
            if (this.eventBus) {
                this.eventBus.emit('layer:system-initialized', {
                    layerCount: this.currentFrameContainer.children.length,
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        // ================================================================================
        // 🚨 BE-4: WebGL2分離アーキテクチャ - Texture転送受信
        // ================================================================================

        /**
         * 転送イベントリスナーセットアップ
         * 
         * gl-texture-bridge.jsからの'layer:texture-updated'イベントを受信
         */
        _setupTextureTransferListener() {
            if (!this.eventBus) {
                console.warn('[LayerSystem] ⚠️ EventBus not available for texture transfer');
                return;
            }

            this.eventBus.on('layer:texture-updated', (data) => {
                this._receiveTransferredTexture(data.layerId, data.texture);
            });

            console.log('[LayerSystem] 📡 BE-4: Texture transfer listener registered');
        }

        /**
         * 転送されたTextureを受信してSprite更新
         * 
         * @param {string} layerId - レイヤーID
         * @param {PIXI.Texture} texture - 転送されたTexture
         */
        _receiveTransferredTexture(layerId, texture) {
            console.log('[LayerSystem] 📥 BE-4: Receiving transferred texture:', layerId);

            if (!texture) {
                console.warn('[LayerSystem] ⚠️ Texture is null/undefined');
                return;
            }

            // Sprite更新
            const success = this._updateLayerSprite(layerId, texture);

            if (success) {
                console.log('[LayerSystem] ✅ BE-4: Sprite updated successfully');
                
                // サムネイル更新リクエスト
                const layer = this.getLayerById(layerId);
                if (layer) {
                    const layerIndex = this.getLayerIndex(layer);
                    this.requestThumbnailUpdate(layerIndex);
                }
            } else {
                console.warn('[LayerSystem] ⚠️ BE-4: Sprite update failed');
            }
        }

        /**
         * レイヤーSpriteにTextureを適用
         * 
         * @param {string} layerId - レイヤーID
         * @param {PIXI.Texture} texture - 適用するTexture
         * @returns {boolean} 成功/失敗
         */
        _updateLayerSprite(layerId, texture) {
            // Sprite取得
            let sprite = this.layerSprites.get(layerId);

            if (!sprite) {
                console.warn('[LayerSystem] ⚠️ Sprite not found, creating new:', layerId);
                
                // Spriteが存在しない場合は新規作成
                const layer = this.getLayerById(layerId);
                if (!layer) {
                    console.error('[LayerSystem] ❌ Layer not found:', layerId);
                    return false;
                }

                sprite = this._createLayerSprite(layerId, layer);
                if (!sprite) {
                    console.error('[LayerSystem] ❌ Failed to create sprite');
                    return false;
                }
            }

            // Texture適用
            sprite.texture = texture;

            console.log('[LayerSystem] 🖼️ BE-4: Texture applied to sprite:', {
                layerId: layerId,
                textureSize: `${texture.width}x${texture.height}`,
                spritePosition: `(${sprite.x}, ${sprite.y})`
            });

            return true;
        }

        /**
         * レイヤー用Sprite生成
         * 
         * @param {string} layerId - レイヤーID
         * @param {PIXI.Container} layerContainer - レイヤーContainer
         * @returns {PIXI.Sprite} 生成されたSprite
         */
        _createLayerSprite(layerId, layerContainer) {
            console.log('[LayerSystem] 🆕 BE-4: Creating layer sprite:', layerId);

            // 空Textureで初期化（後で転送Textureで置き換え）
            const emptyTexture = PIXI.Texture.EMPTY;
            const sprite = new PIXI.Sprite(emptyTexture);

            // Sprite設定
            sprite.label = `sprite_${layerId}`;
            sprite.x = 0;
            sprite.y = 0;

            // レイヤーContainerに追加
            layerContainer.addChild(sprite);

            // Sprite登録
            this.layerSprites.set(layerId, sprite);

            console.log('[LayerSystem] ✅ BE-4: Layer sprite created and registered');

            return sprite;
        }

        /**
         * レイヤーSprite削除
         * 
         * @param {string} layerId - レイヤーID
         */
        _destroyLayerSprite(layerId) {
            const sprite = this.layerSprites.get(layerId);

            if (sprite) {
                // Containerから削除
                if (sprite.parent) {
                    sprite.parent.removeChild(sprite);
                }

                // Sprite破棄
                sprite.destroy({
                    children: true,
                    texture: false, // Textureは別管理
                    baseTexture: false
                });

                // 登録削除
                this.layerSprites.delete(layerId);

                console.log('[LayerSystem] 🗑️ BE-4: Layer sprite destroyed:', layerId);
            }
        }

        // ================================================================================
        // フォルダ管理機能（Phase 2継承）
        // ================================================================================

        /**
         * フォルダ作成
         */
        createFolder(name) {
            if (!this.currentFrameContainer) {
                console.error('[LayerSystem] ❌ currentFrameContainer is null/undefined');
                return null;
            }
            
            const folderName = name || this._generateNextFolderName();
            
            // モデル作成
            const folderModel = new window.TegakiDataModels.LayerModel({
                name: folderName,
                isFolder: true,
                folderExpanded: true
            });
            
            // PIXI.Container作成
            const folder = new PIXI.Container();
            folder.label = folderModel.id;
            folder.layerData = folderModel;
            folder.id = folderModel.id;
            
            // Transform初期化
            if (this.transform) {
                this.transform.setTransform(folderModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
            }
            
            // History登録またはフォルダ追加
            if (window.History && !window.History._manager.isApplying) {
                try {
                    const entry = {
                        name: 'folder-create',
                        do: () => {
                            this.currentFrameContainer.addChild(folder);
                            const layers = this.getLayers();
                            this.setActiveLayer(layers.length - 1);
                            this._emitPanelUpdateRequest();
                        },
                        undo: () => {
                            this.currentFrameContainer.removeChild(folder);
                            const layers = this.getLayers();
                            if (this.activeLayerIndex >= layers.length) {
                                this.activeLayerIndex = Math.max(0, layers.length - 1);
                            }
                            this._emitPanelUpdateRequest();
                        },
                        meta: { folderId: folderModel.id, name: folderName }
                    };
                    
                    window.History.push(entry);
                    
                } catch (error) {
                    console.error('[LayerSystem] ❌ History registration failed:', error);
                    
                    // エラー時はフォールバック
                    this.currentFrameContainer.addChild(folder);
                    const layers = this.getLayers();
                    this.setActiveLayer(layers.length - 1);
                    this._emitPanelUpdateRequest();
                }
            } else {
                this.currentFrameContainer.addChild(folder);
                const layers = this.getLayers();
                this.setActiveLayer(layers.length - 1);
                this._emitPanelUpdateRequest();
            }
            
            // イベント発火
            if (this.eventBus) {
                this.eventBus.emit('folder:created', { 
                    folderId: folderModel.id, 
                    name: folderName 
                });
            }
            
            const layers = this.getLayers();
            
            return { layer: folder, index: layers.length - 1 };
        }

        /**
         * レイヤーをフォルダに追加
         */
        addLayerToFolder(layerId, folderId) {
            const layers = this.getLayers();
            const layer = layers.find(l => l.layerData?.id === layerId);
            const folder = layers.find(l => l.layerData?.id === folderId);
            
            if (!layer || !folder || !folder.layerData?.isFolder) return false;
            if (layer.layerData?.isBackground) return false;
            
            if (!folder.layerData.addChild(layerId)) return false;
            
            layer.layerData.parentId = folderId;
            
            this._emitPanelUpdateRequest();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:added-to-folder', { 
                    layerId, 
                    folderId 
                });
            }
            
            return true;
        }

        /**
         * レイヤーをフォルダから取り出す
         */
        removeLayerFromFolder(layerId) {
            const layers = this.getLayers();
            const layer = layers.find(l => l.layerData?.id === layerId);
            
            if (!layer || !layer.layerData?.parentId) return false;
            
            const folder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
            if (!folder || !folder.layerData?.isFolder) return false;
            
            if (!folder.layerData.removeChild(layerId)) return false;
            
            layer.layerData.parentId = null;
            
            this._emitPanelUpdateRequest();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:removed-from-folder', { 
                    layerId, 
                    folderId: folder.layerData.id 
                });
            }
            
            return true;
        }

        /**
         * フォルダの開閉状態を切り替え
         */
        toggleFolderExpand(folderId) {
            const layers = this.getLayers();
            const folder = layers.find(l => l.layerData?.id === folderId);
            
            if (!folder || !folder.layerData?.isFolder) return false;
            
            folder.layerData.toggleExpanded();
            
            this._emitPanelUpdateRequest();
            
            if (this.eventBus) {
                this.eventBus.emit('folder:toggled', { 
                    folderId, 
                    expanded: folder.layerData.folderExpanded 
                });
            }
            
            return true;
        }

        /**
         * 表示されるレイヤーのみ取得（閉じたフォルダ内を除外）
         */
        getVisibleLayers() {
            const layers = this.getLayers();
            const visibleLayers = [];
            
            for (const layer of layers) {
                // 親フォルダが閉じている場合はスキップ
                if (layer.layerData?.parentId) {
                    const parentFolder = layers.find(l => l.layerData?.id === layer.layerData.parentId);
                    if (parentFolder && parentFolder.layerData?.isFolder && !parentFolder.layerData.folderExpanded) {
                        continue;
                    }
                }
                visibleLayers.push(layer);
            }
            
            return visibleLayers;
        }

        /**
         * フォルダ内のレイヤーを取得
         */
        getFolderChildren(folderId) {
            const layers = this.getLayers();
            const folder = layers.find(l => l.layerData?.id === folderId);
            
            if (!folder || !folder.layerData?.isFolder) return [];
            
            return layers.filter(l => l.layerData?.parentId === folderId);
        }

        /**
         * 次のフォルダ名生成
         */
        _generateNextFolderName() {
            const layers = this.getLayers();
            const folderNames = layers
                .filter(l => l.layerData?.isFolder)
                .map(l => l.layerData.name);
            
            const numbers = folderNames
                .map(name => {
                    const match = name.match(/^フォルダ(\d+)$/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(n => n > 0);
            
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            return `フォルダ${maxNumber + 1}`;
        }

        // ================================================================================
        // レイヤー基本操作
        // ================================================================================

        getLayerById(layerId) {
            if (!layerId) return null;
            
            const layers = this.getLayers();
            return layers.find(layer => {
                return layer.id === layerId || 
                       layer.label === layerId || 
                       layer.layerData?.id === layerId;
            }) || null;
        }

        getLayers() {
            return this.currentFrameContainer ? this.currentFrameContainer.children : [];
        }
        
        getActiveLayer() {
            const layers = this.getLayers();
            return this.activeLayerIndex >= 0 && this.activeLayerIndex < layers.length ? layers[this.activeLayerIndex] : null;
        }

        getActiveLayerIndex() {
            return this.activeLayerIndex;
        }

        getLayerIndex(layer) {
            const layers = this.getLayers();
            return layers.indexOf(layer);
        }

        setActiveLayer(index) {
            const layers = this.getLayers();
            if (index >= 0 && index < layers.length) {
                const layer = layers[index];
                if (layer?.layerData?.isBackground) {
                    return;
                }
                
                const oldIndex = this.activeLayerIndex;
                this.activeLayerIndex = index;
                this._emitPanelUpdateRequest();
                this._emitStatusUpdateRequest();
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:activated', { layerIndex: index, oldIndex: oldIndex, layerId: layers[index]?.layerData?.id });
                }
            }
        }

        // ================================================================================
        // レイヤー作成・削除
        // ================================================================================

        /**
         * 次のレイヤー名生成
         */
        _generateNextLayerName() {
            const layers = this.getLayers();
            const layerNames = layers
                .filter(l => l.layerData && !l.layerData.isBackground && !l.layerData.isFolder)
                .map(l => l.layerData.name);
            
            const numbers = layerNames
                .map(name => {
                    const match = name.match(/^レイヤー(\d+)$/);
                    return match ? parseInt(match[1], 10) : 0;
                })
                .filter(n => n > 0);
            
            const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
            const nextNumber = maxNumber + 1;
            
            return `レイヤー${nextNumber}`;
        }

        createLayer(name, isBackground = false) {
            if (!this.currentFrameContainer) return null;
            
            const layerModel = new window.TegakiDataModels.LayerModel({
                name: name || (isBackground ? '背景' : this._generateNextLayerName()),
                isBackground: isBackground
            });
            const layer = new PIXI.Container();
            layer.label = layerModel.id;
            layer.layerData = layerModel;
            layer.id = layerModel.id;
            
            // 🆕 BE-4: 通常レイヤーの場合はSpriteを生成
            if (!isBackground) {
                this._createLayerSprite(layerModel.id, layer);
            }
            
            // マスク初期化（将来的にフレームバッファに置き換え）
            if (this.app && this.app.renderer && !isBackground) {
                const success = layerModel.initializeMask(
                    this.config.canvas.width,
                    this.config.canvas.height,
                    this.app.renderer
                );
                if (success && layerModel.maskSprite) {
                    layer.addChild(layerModel.maskSprite);
                }
            }
            
            if (this.transform) {
                this.transform.setTransform(layerModel.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
            }
            
            if (isBackground) {
                const bg = this._createSolidBackground(
                    this.config.canvas.width, 
                    this.config.canvas.height,
                    0xf0e0d6
                );
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
                layer.layerData.backgroundColor = 0xf0e0d6;
            }
            
            if (window.History && !window.History._manager.isApplying) {
                const entry = {
                    name: 'layer-create',
                    do: () => {
                        this.currentFrameContainer.addChild(layer);
                        const layers = this.getLayers();
                        this.setActiveLayer(layers.length - 1);
                        this._emitPanelUpdateRequest();
                        this._emitStatusUpdateRequest();
                    },
                    undo: () => {
                        if (layer.layerData) {
                            layer.layerData.destroyMask();
                        }
                        // 🆕 BE-4: Sprite削除
                        this._destroyLayerSprite(layerModel.id);
                        
                        this.currentFrameContainer.removeChild(layer);
                        const layers = this.getLayers();
                        if (this.activeLayerIndex >= layers.length) {
                            this.activeLayerIndex = Math.max(0, layers.length - 1);
                        }
                        this._emitPanelUpdateRequest();
                        this._emitStatusUpdateRequest();
                    },
                    meta: { layerId: layerModel.id, name: layerModel.name }
                };
                window.History.push(entry);
            } else {
                this.currentFrameContainer.addChild(layer);
                const layers = this.getLayers();
                this.setActiveLayer(layers.length - 1);
                this._emitPanelUpdateRequest();
                this._emitStatusUpdateRequest();
            }
            if (this.eventBus) {
                this.eventBus.emit('layer:created', { layerId: layerModel.id, name: layerModel.name, isBackground });
            }
            const layers = this.getLayers();
            return { layer, index: layers.length - 1 };
        }

        deleteLayer(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) {
                return false;
            }
            const layer = layers[layerIndex];
            const layerId = layer.layerData?.id;
            if (layer.layerData?.isBackground) {
                return false;
            }
            
            // フォルダの場合、子レイヤーも削除
            if (layer.layerData?.isFolder) {
                const children = this.getFolderChildren(layerId);
                children.forEach(child => {
                    const childIndex = this.getLayerIndex(child);
                    if (childIndex >= 0) {
                        this.deleteLayer(childIndex);
                    }
                });
            }
            
            try {
                const previousActiveIndex = this.activeLayerIndex;
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-delete',
                        do: () => {
                            if (layer.layerData) {
                                layer.layerData.destroyMask();
                            }
                            // 🆕 BE-4: Sprite削除
                            this._destroyLayerSprite(layerId);
                            
                            this.currentFrameContainer.removeChild(layer);
                            if (layerId && this.transform) {
                                this.transform.clearTransform(layerId);
                            }
                            const remainingLayers = this.getLayers();
                            if (remainingLayers.length === 0) {
                                this.activeLayerIndex = -1;
                            } else if (this.activeLayerIndex >= remainingLayers.length) {
                                this.activeLayerIndex = remainingLayers.length - 1;
                            }
                            this._emitPanelUpdateRequest();
                            this._emitStatusUpdateRequest();
                            if (this.eventBus) {
                                this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                            }
                        },
                        undo: () => {
                            if (layer.layerData && this.app && this.app.renderer && !layer.layerData.isFolder) {
                                layer.layerData.initializeMask(
                                    this.config.canvas.width,
                                    this.config.canvas.height,
                                    this.app.renderer
                                );
                                if (layer.layerData.maskSprite) {
                                    layer.addChildAt(layer.layerData.maskSprite, 0);
                                    this._applyMaskToLayerGraphics(layer);
                                }
                            }
                            // 🆕 BE-4: Sprite復元
                            if (!layer.layerData.isBackground && !layer.layerData.isFolder) {
                                this._createLayerSprite(layerId, layer);
                            }
                            
                            this.currentFrameContainer.addChildAt(layer, layerIndex);
                            this.activeLayerIndex = previousActiveIndex;
                            this._emitPanelUpdateRequest();
                            this._emitStatusUpdateRequest();
                        },
                        meta: { layerId, layerIndex }
                    };
                    window.History.push(entry);
                } else {
                    if (layer.layerData) {
                        layer.layerData.destroyMask();
                    }
                    // 🆕 BE-4: Sprite削除
                    this._destroyLayerSprite(layerId);
                    
                    this.currentFrameContainer.removeChild(layer);
                    if (layerId && this.transform) {
                        this.transform.clearTransform(layerId);
                    }
                    const remainingLayers = this.getLayers();
                    if (remainingLayers.length === 0) {
                        this.activeLayerIndex = -1;
                    } else if (this.activeLayerIndex >= remainingLayers.length) {
                        this.activeLayerIndex = remainingLayers.length - 1;
                    }
                    this._emitPanelUpdateRequest();
                    this._emitStatusUpdateRequest();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                    }
                }
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        // ================================================================================
        // レイヤープロパティ操作
        // ================================================================================

        toggleLayerVisibility(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            layer.layerData.visible = !layer.layerData.visible;
            layer.visible = layer.layerData.visible;
            
            if (layer.layerData?.isBackground && this.checkerPattern) {
                this.checkerPattern.visible = !layer.layerData.visible;
            }
            
            this._emitPanelUpdateRequest();
            if (this.eventBus) {
                this.eventBus.emit('layer:visibility-changed', { layerIndex, visible: layer.layerData.visible, layerId: layer.layerData.id });
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        setLayerOpacity(layerIndex, opacity) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            if (layer.layerData?.isBackground) return;
            
            opacity = Math.max(0, Math.min(1, opacity));
            
            layer.alpha = opacity;
            if (layer.layerData) {
                layer.layerData.opacity = opacity;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:opacity-changed', {
                    layerIndex,
                    layerId: layer.layerData?.id,
                    opacity
                });
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        changeBackgroundLayerColor(layerIndex, layerId) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            if (!layer?.layerData?.isBackground) return;
            
            const color = window.brushSettings?.getColor() || 0xf0e0d6;
            
            layer.layerData.backgroundColor = color;
            
            const bg = layer.layerData.backgroundGraphics;
            if (bg) {
                bg.clear();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill({ color: color, alpha: 1.0 });
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:background-color-changed', {
                    layerIndex,
                    layerId,
                    color
                });
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        // ================================================================================
        // Phase 3: ラスターストローク管理（ベクターpaths互換インターフェース維持）
        // ================================================================================

        /**
         * アクティブレイヤーにパス追加（ラスター互換）
         */
        addPathToActiveLayer(path) {
            if (!this.getActiveLayer()) return;
            const activeLayer = this.getActiveLayer();
            const layerIndex = this.activeLayerIndex;
            
            if (activeLayer.layerData?.isBackground || activeLayer.layerData?.isFolder) return;
            
            // Phase 3: rasterStrokes配列に追加（paths互換性維持）
            if (activeLayer.layerData && activeLayer.layerData.rasterStrokes) {
                activeLayer.layerData.rasterStrokes.push(path);
            } else if (activeLayer.layerData && activeLayer.layerData.paths) {
                activeLayer.layerData.paths.push(path);
            }
            
            if (!activeLayer.layerData) {
                activeLayer.paths = activeLayer.paths || [];
                activeLayer.paths.push(path);
            }
            
            // Graphics再構築（ラスター方式では不要になる予定）
            this.rebuildPathGraphics(path);
            if (path.graphics) {
                if (activeLayer.layerData && activeLayer.layerData.maskSprite) {
                    path.graphics.mask = activeLayer.layerData.maskSprite;
                }
                activeLayer.addChild(path.graphics);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:stroke-added', { path, layerIndex, layerId: activeLayer.label });
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        /**
         * レイヤーにパス追加（ラスター互換）
         */
        addPathToLayer(layerIndex, path) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                
                if (layer.layerData?.isBackground || layer.layerData?.isFolder) return;
                
                // Phase 3: rasterStrokes配列に追加
                if (layer.layerData.rasterStrokes) {
                    layer.layerData.rasterStrokes.push(path);
                } else if (layer.layerData.paths) {
                    layer.layerData.paths.push(path);
                }
                
                layer.addChild(path.graphics);
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:path-added', { layerIndex, pathId: path.id, layerId: layer.layerData.id });
                    this.requestThumbnailUpdate(layerIndex);
                }
            }
        }

        /**
         * パスGraphics再構築（ラスター方式では段階的に廃止予定）
         */
        rebuildPathGraphics(path) {
            try {
                if (path.graphics) {
                    try {
                        if (path.graphics.destroy && typeof path.graphics.destroy === 'function') {
                            path.graphics.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (destroyError) {}
                    path.graphics = null;
                }
                path.graphics = new PIXI.Graphics();
                if (!path.points || !Array.isArray(path.points) || path.points.length === 0) {
                    return true;
                }
                if (path.strokeOptions && typeof getStroke !== 'undefined') {
                    try {
                        const renderSize = path.size;
                        const options = {
                            ...path.strokeOptions,
                            size: renderSize,
                            color: path.color,
                            alpha: path.opacity
                        };
                        const outlinePoints = getStroke(path.points, options);
                        if (outlinePoints && outlinePoints.length > 0) {
                            path.graphics.poly(outlinePoints);
                            path.graphics.fill({ color: path.color || 0x000000, alpha: path.opacity || 1.0 });
                            return true;
                        }
                    } catch (pfError) {}
                }
                for (let point of path.points) {
                    if (typeof point.x === 'number' && typeof point.y === 'number' &&
                        isFinite(point.x) && isFinite(point.y)) {
                        path.graphics.circle(point.x, point.y, (path.size || 16) / 2);
                        path.graphics.fill({ color: path.color || 0x800000, alpha: path.opacity || 1.0 });
                    }
                }
                return true;
            } catch (error) {
                path.graphics = null;
                return false;
            }
        }

        /**
         * レイヤー再構築（ラスター方式では段階的に廃止予定）
         */
        safeRebuildLayer(layer, newPaths) {
            try {
                const childrenToRemove = [];
                for (let child of layer.children) {
                    if (child !== layer.layerData.backgroundGraphics &&
                        child !== layer.layerData.maskSprite) {
                        childrenToRemove.push(child);
                    }
                }
                childrenToRemove.forEach(child => {
                    try {
                        layer.removeChild(child);
                        if (child.destroy && typeof child.destroy === 'function') {
                            child.destroy({ children: true, texture: false, baseTexture: false });
                        }
                    } catch (removeError) {}
                });
                
                // Phase 3: rasterStrokes配列をクリア
                if (layer.layerData.rasterStrokes) {
                    layer.layerData.rasterStrokes = [];
                } else {
                    layer.layerData.paths = [];
                }
                
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    try {
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        if (rebuildSuccess && path.graphics) {
                            if (layer.layerData && layer.layerData.maskSprite) {
                                path.graphics.mask = layer.layerData.maskSprite;
                            }
                            // Phase 3: rasterStrokes配列に追加
                            if (layer.layerData.rasterStrokes) {
                                layer.layerData.rasterStrokes.push(path);
                            } else {
                                layer.layerData.paths.push(path);
                            }
                            layer.addChild(path.graphics);
                            addedCount++;
                        }
                    } catch (pathError) {}
                }
                return addedCount > 0 || newPaths.length === 0;
            } catch (error) {
                return false;
            }
        }

        // ================================================================================
        // レイヤー順序操作
        // ================================================================================

        reorderLayers(fromIndex, toIndex) {
            const layers = this.getLayers();
            if (fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length || fromIndex === toIndex) {
                return false;
            }
            try {
                const movedLayer = layers[fromIndex];
                const oldActiveIndex = this.activeLayerIndex;
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-reorder',
                        do: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(fromIndex, 1);
                            layers.splice(toIndex, 0, layer);
                            this.currentFrameContainer.removeChild(layer);
                            this.currentFrameContainer.addChildAt(layer, toIndex);
                            if (this.activeLayerIndex === fromIndex) {
                                this.activeLayerIndex = toIndex;
                            } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                                this.activeLayerIndex--;
                            } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                                this.activeLayerIndex++;
                            }
                            this._emitPanelUpdateRequest();
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: layer.layerData?.id });
                            }
                        },
                        undo: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(toIndex, 1);
                            layers.splice(fromIndex, 0, layer);
                            this.currentFrameContainer.removeChild(layer);
                            this.currentFrameContainer.addChildAt(layer, fromIndex);
                            this.activeLayerIndex = oldActiveIndex;
                            this._emitPanelUpdateRequest();
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { fromIndex: toIndex, toIndex: fromIndex, activeIndex: this.activeLayerIndex, movedLayerId: layer.layerData?.id });
                            }
                        },
                        meta: { fromIndex, toIndex }
                    };
                    window.History.push(entry);
                } else {
                    const [layer] = layers.splice(fromIndex, 1);
                    layers.splice(toIndex, 0, layer);
                    this.currentFrameContainer.removeChild(layer);
                    this.currentFrameContainer.addChildAt(layer, toIndex);
                    if (this.activeLayerIndex === fromIndex) {
                        this.activeLayerIndex = toIndex;
                    } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                        this.activeLayerIndex--;
                    } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                        this.activeLayerIndex++;
                    }
                    this._emitPanelUpdateRequest();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: movedLayer.layerData?.id });
                    }
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        moveActiveLayerHierarchy(direction) {
            const layers = this.getLayers();
            if (layers.length <= 1) return;
            const currentIndex = this.activeLayerIndex;
            const activeLayer = layers[currentIndex];
            if (activeLayer?.layerData?.isBackground) return;
            let newIndex;
            if (direction === 'up') {
                newIndex = currentIndex + 1;
                if (newIndex >= layers.length) return;
            } else if (direction === 'down') {
                newIndex = currentIndex - 1;
                if (newIndex < 0) return;
                const targetLayer = layers[newIndex];
                if (targetLayer?.layerData?.isBackground) return;
            } else {
                return;
            }
            if (window.History && !window.History._manager.isApplying) {
                const oldIndex = currentIndex;
                const entry = {
                    name: 'layer-hierarchy-move',
                    do: () => {
                        const layers = this.getLayers();
                        const layer = layers[oldIndex];
                        this.currentFrameContainer.removeChildAt(oldIndex);
                        this.currentFrameContainer.addChildAt(layer, newIndex);
                        this.activeLayerIndex = newIndex;
                        this._emitPanelUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:hierarchy-moved', { direction, oldIndex, newIndex, layerId: layer.layerData?.id });
                        }
                    },
                    undo: () => {
                        const layers = this.getLayers();
                        const layer = layers[newIndex];
                        this.currentFrameContainer.removeChildAt(newIndex);
                        this.currentFrameContainer.addChildAt(layer, oldIndex);
                        this.activeLayerIndex = oldIndex;
                        this._emitPanelUpdateRequest();
                        if (this.eventBus) {
                            this.eventBus.emit('layer:hierarchy-moved', { direction: direction === 'up' ? 'down' : 'up', oldIndex: newIndex, newIndex: oldIndex, layerId: layer.layerData?.id });
                        }
                    },
                    meta: { direction, oldIndex, newIndex }
                };
                window.History.push(entry);
            } else {
                this.currentFrameContainer.removeChildAt(currentIndex);
                this.currentFrameContainer.addChildAt(activeLayer, newIndex);
                this.activeLayerIndex = newIndex;
                this._emitPanelUpdateRequest();
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { direction, oldIndex: currentIndex, newIndex, layerId: activeLayer.layerData?.id });
                }
            }
        }

        selectNextLayer() {
            const layers = this.getLayers();
            if (layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex = currentIndex + 1;
            
            if (newIndex >= layers.length) return;
            
            const targetLayer = layers[newIndex];
            if (targetLayer?.layerData?.isBackground) return;
            
            this.setActiveLayer(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:selection-changed', {
                    oldIndex: currentIndex,
                    newIndex: newIndex,
                    layerId: targetLayer?.layerData?.id
                });
            }
        }

        selectPrevLayer() {
            const layers = this.getLayers();
            if (layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex = currentIndex - 1;
            
            if (newIndex < 0) return;
            
            const targetLayer = layers[newIndex];
            if (targetLayer?.layerData?.isBackground) return;
            
            this.setActiveLayer(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:selection-changed', {
                    oldIndex: currentIndex,
                    newIndex: newIndex,
                    layerId: targetLayer?.layerData?.id
                });
            }
        }

        // ================================================================================
        // レイヤー変形処理
        // ================================================================================

        enterLayerMoveMode() {
            if (this.transform) this.transform.enterMoveMode();
        }
        
        exitLayerMoveMode() {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            this.transform.exitMoveMode(activeLayer);
        }
        
        toggleLayerMoveMode() {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            this.transform.toggleMoveMode(activeLayer);
        }
        
        get isLayerMoveMode() {
            return this.transform?.isVKeyPressed || false;
        }
        
        get vKeyPressed() {
            return this.transform?.isVKeyPressed || false;
        }
        
        updateActiveLayerTransform(property, value) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.transform.updateTransform(activeLayer, property, value);
            }
        }
        
        flipActiveLayer(direction, bypassVKeyCheck = false) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            if (activeLayer.layerData.isBackground || activeLayer.layerData.isFolder) return;
            
            if (!bypassVKeyCheck && !this.isLayerMoveMode) return;
            
            const layerId = activeLayer.layerData.id;
            const layerIndex = this.activeLayerIndex;
            
            if (window.History && !window.History._manager.isApplying) {
                const transformBefore = structuredClone(this.transform.getTransform(layerId) || 
                    { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
                
                const transform = this.transform.getTransform(layerId) || 
                    { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                
                if (direction === 'horizontal') {
                    transform.scaleX *= -1;
                } else if (direction === 'vertical') {
                    transform.scaleY *= -1;
                }
                
                this.transform.setTransform(layerId, transform);
                
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                this.transform.applyTransform(activeLayer, transform, centerX, centerY);
                
                const transformAfter = structuredClone(transform);
                
                window.History.push({
                    name: `layer-flip-${direction}`,
                    do: () => {
                        this.transform.setTransform(layerId, transformAfter);
                        this.transform.applyTransform(activeLayer, transformAfter, centerX, centerY);
                        if (this.transform.updateFlipButtons) {
                            this.transform.updateFlipButtons(activeLayer);
                        }
                        this.requestThumbnailUpdate(layerIndex);
                    },
                    undo: () => {
                        this.transform.setTransform(layerId, transformBefore);
                        this.transform.applyTransform(activeLayer, transformBefore, centerX, centerY);
                        if (this.transform.updateFlipButtons) {
                            this.transform.updateFlipButtons(activeLayer);
                        }
                        this.requestThumbnailUpdate(layerIndex);
                    },
                    meta: {
                        layerId,
                        layerIndex,
                        direction
                    }
                });
            } else {
                this.transform.flipLayer(activeLayer, direction, true);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:transform-updated', { 
                    layerId: activeLayer.layerData.id 
                });
                this.requestThumbnailUpdate(this.activeLayerIndex);
            }
        }
        
        moveActiveLayer(keyCode) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.transform.moveLayer(activeLayer, keyCode);
                this.requestThumbnailUpdate(this.activeLayerIndex);
            }
        }
        
        transformActiveLayer(keyCode) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            if (keyCode === 'ArrowUp' || keyCode === 'ArrowDown') {
                this.transform.scaleLayer(activeLayer, keyCode);
            } else if (keyCode === 'ArrowLeft' || keyCode === 'ArrowRight') {
                this.transform.rotateLayer(activeLayer, keyCode);
            }
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }
        
        confirmLayerTransform() {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            const layerId = activeLayer.layerData.id;
            const transformBefore = structuredClone(this.transform.getTransform(layerId));
            if (this.transform._isTransformNonDefault(transformBefore)) {
                this.transform.confirmTransform(activeLayer);
                
                // Phase 3: rasterStrokes配列を使用
                const paths = activeLayer.layerData.rasterStrokes || activeLayer.layerData.paths;
                const rebuildSuccess = this.safeRebuildLayer(activeLayer, paths);
                
                if (rebuildSuccess && window.History && !window.History._manager.isApplying) {
                    const pathsAfter = activeLayer.layerData.rasterStrokes ? 
                        structuredClone(activeLayer.layerData.rasterStrokes) :
                        structuredClone(activeLayer.layerData.paths);
                    const transformAfter = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                    const entry = {
                        name: 'layer-transform',
                        do: () => {
                            this.safeRebuildLayer(activeLayer, pathsAfter);
                            this.transform.setTransform(layerId, transformAfter);
                            activeLayer.position.set(0, 0);
                            activeLayer.rotation = 0;
                            activeLayer.scale.set(1, 1);
                            activeLayer.pivot.set(0, 0);
                            this.requestThumbnailUpdate(this.activeLayerIndex);
                        },
                        undo: () => {
                            this.transform.setTransform(layerId, transformBefore);
                            const centerX = this.config.canvas.width / 2;
                            const centerY = this.config.canvas.height / 2;
                            this.transform.applyTransform(activeLayer, transformBefore, centerX, centerY);
                            this.requestThumbnailUpdate(this.activeLayerIndex);
                        },
                        meta: { layerId, type: 'transform' }
                    };
                    window.History.push(entry);
                }
            }
        }
        
        updateLayerTransformPanelValues() {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.transform.updateTransformPanelValues(activeLayer);
            }
        }
        
        updateFlipButtons() {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.transform.updateFlipButtons(activeLayer);
            }
        }
        
        updateCursor() {
            if (this.transform) {
                this.transform._updateCursor();
            }
        }
        
        _handleLayerDrag(dx, dy, shiftKey) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;
            const layerId = activeLayer.layerData.id;
            let transform = this.transform.getTransform(layerId);
            if (!transform) {
                transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                this.transform.setTransform(layerId, transform);
            }
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            if (shiftKey) {
                if (Math.abs(dy) > Math.abs(dx)) {
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.config.layer.minScale, Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                } else {
                    transform.rotation += (dx * 0.02);
                }
            } else {
                transform.x += adjustedDx;
                transform.y += adjustedDy;
            }
            this.transform.applyTransform(activeLayer, transform, centerX, centerY);
            this.transform.updateTransformPanelValues(activeLayer);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
                this.requestThumbnailUpdate(this.activeLayerIndex);
            }
        }

        // ================================================================================
        // フレーム管理
        // ================================================================================

        setCurrentFrameContainer(frameContainer) {
            this.currentFrameContainer = frameContainer;
            const layers = this.getLayers();
            if (layers.length > 0) {
                this.activeLayerIndex = layers.length - 1;
            }
            
            this._emitPanelUpdateRequest();
            this._emitStatusUpdateRequest();
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
        }
        
        createFrameRenderTexture(frameId) {
            if (!this.app?.renderer) return null;
            const renderTexture = PIXI.RenderTexture.create({
                width: this.config.canvas.width,
                height: this.config.canvas.height
            });
            this.frameRenderTextures.set(frameId, renderTexture);
            this.frameThumbnailDirty.set(frameId, true);
            return renderTexture;
        }
        
        renderFrameToTexture(frameId, frameContainer) {
            if (!this.app?.renderer) return;
            
            const currentWidth = this.config.canvas.width;
            const currentHeight = this.config.canvas.height;
            
            const oldTexture = this.frameRenderTextures.get(frameId);
            if (oldTexture) {
                oldTexture.destroy(true);
            }
            
            const renderTexture = PIXI.RenderTexture.create({
                width: currentWidth,
                height: currentHeight
            });
            
            this.frameRenderTextures.set(frameId, renderTexture);
            
            const container = frameContainer || this.currentFrameContainer;
            if (!container) return;
            
            this.app.renderer.render({
                container: container,
                target: renderTexture,
                clear: true
            });
            
            this.markFrameThumbnailDirty(frameId);
        }
        
        markFrameThumbnailDirty(frameId) {
            this.frameThumbnailDirty.set(frameId, true);
            if (this.eventBus) {
                this.eventBus.emit('frame:updated', { frameId: frameId });
            }
        }
        
        getFrameRenderTexture(frameId) {
            return this.frameRenderTextures.get(frameId);
        }
        
        destroyFrameRenderTexture(frameId) {
            const renderTexture = this.frameRenderTextures.get(frameId);
            if (renderTexture) {
                renderTexture.destroy(true);
                this.frameRenderTextures.delete(frameId);
                this.frameThumbnailDirty.delete(frameId);
            }
        }
        
        isFrameThumbnailDirty(frameId) {
            return this.frameThumbnailDirty.get(frameId) || false;
        }
        
        clearFrameThumbnailDirty(frameId) {
            this.frameThumbnailDirty.set(frameId, false);
        }

        // ================================================================================
        // システム統合
        // ================================================================================

        _setupVKeyEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('keyboard:vkey-state-changed', ({ pressed }) => {
                if (!this.transform) return;
                if (!this.transform.app && this.app && this.cameraSystem) {
                    this.initTransform();
                }
                
                if (pressed) {
                    this.transform.enterMoveMode();
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        this.transform.updateTransformPanelValues(activeLayer);
                    }
                } else {
                    const activeLayer = this.getActiveLayer();
                    this.transform.exitMoveMode(activeLayer);
                }
            });
        }
        
        initTransform() {
            if (!this.transform || !this.app) return;
            this.transform.init(this.app, this.cameraSystem);
            this.transform.onTransformComplete = (layer) => {
                this.eventBus.emit('layer:transform-confirmed', {layerId: layer.layerData.id});
                this.requestThumbnailUpdate(this.getLayerIndex(layer));
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
            };
            this.transform.onTransformUpdate = (layer, transform) => {
                this.requestThumbnailUpdate(this.getLayerIndex(layer));
                this.eventBus.emit('layer:updated', {layerId: layer.layerData.id, transform});
            };
            this.transform.onSliderChange = (sliderId, value) => {
                const activeLayer = this.getActiveLayer();
                if (!activeLayer) return;
                const property = sliderId.replace('layer-', '').replace('-slider', '');
                if (property === 'rotation') {
                    value = value * Math.PI / 180;
                }
                this.transform.updateTransform(activeLayer, property, value);
                this.requestThumbnailUpdate(this.activeLayerIndex);
            };
            this.transform.onFlipRequest = (direction) => {
                this.flipActiveLayer(direction, false);
            };
            this.transform.onDragRequest = (dx, dy, shiftKey) => {
                this._handleLayerDrag(dx, dy, shiftKey);
            };
            this.transform.onGetActiveLayer = () => {
                return this.getActiveLayer();
            };
            this.transform.onRebuildRequired = (layer, paths) => {
                this.safeRebuildLayer(layer, paths);
            };
        }

        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            this.eventBus.on('animation:frame-applied', () => {
                setTimeout(() => {
                    this._emitPanelUpdateRequest();
                    this._emitStatusUpdateRequest();
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            this.eventBus.on('animation:frame-created', () => {
                setTimeout(() => {
                    this._emitPanelUpdateRequest();
                }, 100);
            });
            this.eventBus.on('animation:frame-deleted', () => {
                setTimeout(() => {
                    this._emitPanelUpdateRequest();
                }, 100);
            });
        }
        
        _establishAnimationSystemConnection() {
            if (window.TegakiAnimationSystem && !this.animationSystem) {
                const possibleInstances = [
                    window.animationSystem,
                    window.coreEngine?.animationSystem,
                    window.TegakiCoreEngine?.animationSystem
                ];
                for (let instance of possibleInstances) {
                    if (instance && typeof instance.getCurrentFrame === 'function') {
                        this.animationSystem = instance;
                        break;
                    }
                }
                if (this.animationSystem && this.animationSystem.layerSystem !== this) {
                    this.animationSystem.layerSystem = this;
                }
            }
        }

        _setupLayerOperations() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:copy-request', () => {
                if (window.drawingClipboard) {
                    window.drawingClipboard.copyActiveLayer();
                }
            });
            
            this.eventBus.on('layer:paste-request', () => {
                if (window.drawingClipboard) {
                    window.drawingClipboard.pasteLayer();
                }
            });
            
            this.eventBus.on('layer:flip-by-key', ({ direction }) => {
                this.flipActiveLayer(direction, false);
            });
            
            this.eventBus.on('layer:move-by-key', ({ direction }) => {
                this.moveActiveLayer(direction);
            });
            
            this.eventBus.on('layer:scale-by-key', ({ direction }) => {
                this.transformActiveLayer(direction);
            });
            
            this.eventBus.on('layer:rotate-by-key', ({ direction }) => {
                this.transformActiveLayer(direction);
            });
            
            this.eventBus.on('layer:select-next', () => {
                this.selectNextLayer();
            });
            
            this.eventBus.on('layer:select-prev', () => {
                this.selectPrevLayer();
            });
            
            this.eventBus.on('layer:order-up', () => {
                const layers = this.getLayers();
                const currentIndex = this.activeLayerIndex;
                const activeLayer = layers[currentIndex];
                
                if (!activeLayer || activeLayer.layerData?.isBackground) return;
                if (currentIndex >= layers.length - 1) return;
                
                this.reorderLayers(currentIndex, currentIndex + 1);
            });
            
            this.eventBus.on('layer:order-down', () => {
                const layers = this.getLayers();
                const currentIndex = this.activeLayerIndex;
                const activeLayer = layers[currentIndex];
                
                if (!activeLayer || activeLayer.layerData?.isBackground) return;
                if (currentIndex <= 0) return;
                
                const targetLayer = layers[currentIndex - 1];
                if (targetLayer?.layerData?.isBackground) return;
                
                this.reorderLayers(currentIndex, currentIndex - 1);
            });
            
            this.eventBus.on('layer:toggle-move-mode', () => {
                this.toggleLayerMoveMode();
            });
            
            this.eventBus.on('tool:select', () => {
                if (this.isLayerMoveMode) {
                    this.exitLayerMoveMode();
                }
            });
            
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    this.exitLayerMoveMode();
                }
            });
        }

        _setupResizeEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('camera:resized', (data) => {
                if (this.checkerPattern && this.checkerPattern.parent && window.checkerUtils) {
                    const wasVisible = this.checkerPattern.visible;
                    
                    this.checkerPattern = window.checkerUtils.resizeCanvasChecker(
                        this.checkerPattern,
                        data.width,
                        data.height
                    );
                    
                    if (this.cameraSystem?.worldContainer && !this.checkerPattern.parent) {
                        this.cameraSystem.worldContainer.addChildAt(this.checkerPattern, 0);
                    }
                    
                    const bgLayer = this.getLayers()[0];
                    const isBackgroundVisible = bgLayer?.layerData?.visible !== false;
                    this.checkerPattern.visible = !isBackgroundVisible;
                }
                
                const bgLayer = this.getLayers()[0];
                if (bgLayer?.layerData?.isBackground && bgLayer.layerData.backgroundGraphics) {
                    const bg = bgLayer.layerData.backgroundGraphics;
                    const currentColor = bgLayer.layerData.backgroundColor || 0xf0e0d6;
                    
                    bg.clear();
                    bg.rect(0, 0, data.width, data.height);
                    bg.fill({ color: currentColor, alpha: 1.0 });
                }
                
                this.requestThumbnailUpdate(0);
                this._emitPanelUpdateRequest();
            });
        }

        // ================================================================================
        // ヘルパー関数
        // ================================================================================

        _createSolidBackground(width, height, color = 0xf0e0d6) {
            const g = new PIXI.Graphics();
            g.rect(0, 0, width, height);
            g.fill({ color: color, alpha: 1.0 });
            g.label = 'backgroundFill';
            return g;
        }

        _applyMaskToLayerGraphics(layer) {
            if (!layer.layerData || !layer.layerData.maskSprite) return;
            
            for (const child of layer.children) {
                if (child === layer.layerData.maskSprite || 
                    child === layer.layerData.backgroundGraphics) {
                    continue;
                }
                
                if (child instanceof PIXI.Graphics) {
                    child.mask = layer.layerData.maskSprite;
                }
            }
        }

        insertClipboard(data) {
            if (this.eventBus) {
                this.eventBus.emit('layer:clipboard-inserted', data);
            }
        }

        _emitPanelUpdateRequest() {
            if (this.eventBus) {
                this.eventBus.emit('layer:panel-update-requested', {
                    timestamp: Date.now(),
                    layers: this.getLayers(),
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        _emitStatusUpdateRequest() {
            const layers = this.getLayers();
            const currentLayerName = this.activeLayerIndex >= 0 ? layers[this.activeLayerIndex]?.layerData?.name : 'なし';
            
            if (this.eventBus) {
                this.eventBus.emit('layer:status-update-requested', {
                    currentLayer: currentLayerName,
                    layerCount: layers.length,
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        requestThumbnailUpdate(layerIndex) {
            if (this.eventBus) {
                const layer = this.getLayers()[layerIndex];
                this.eventBus.emit('thumbnail:layer-updated', {
                    layerIndex,
                    layerId: layer?.layerData?.id
                });
            }
        }

        // ================================================================================
        // システムセットアップ
        // ================================================================================

        setApp(app) {
            this.app = app;
            
            if (this.transform && !this.transform.app && this.cameraSystem) {
                this.initTransform();
            }
        }

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            
            if (cameraSystem?.worldContainer && this.currentFrameContainer) {
                const currentParent = this.currentFrameContainer.parent;
                
                if (!currentParent) {
                    cameraSystem.worldContainer.addChildAt(this.currentFrameContainer, 0);
                } else if (currentParent !== cameraSystem.worldContainer) {
                    currentParent.removeChild(this.currentFrameContainer);
                    cameraSystem.worldContainer.addChildAt(this.currentFrameContainer, 0);
                }
                
                const isChild = this.currentFrameContainer.parent === cameraSystem.worldContainer;
                if (!isChild) {
                    console.error('[LayerSystem] ❌ Failed to establish parent-child relationship');
                }
            }
            
            if (cameraSystem?.worldContainer && window.checkerUtils) {
                this.checkerPattern = window.checkerUtils.createCanvasChecker(
                    this.config.canvas.width,
                    this.config.canvas.height
                );
                
                const bgLayer = this.getLayers()[0];
                const isBackgroundVisible = bgLayer?.layerData?.visible !== false;
                this.checkerPattern.visible = !isBackgroundVisible;
                
                cameraSystem.worldContainer.addChildAt(this.checkerPattern, 0);
                cameraSystem.worldContainer.setChildIndex(this.currentFrameContainer, 0);
            }
            
            if (this.transform && this.app && !this.transform.app) {
                this.initTransform();
            }
        }

        verifyParentChain() {
            if (!this.currentFrameContainer) {
                console.error('[LayerSystem] currentFrameContainer not found');
                return false;
            }
            
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) {
                console.error('[LayerSystem] No active layer');
                return false;
            }
            
            console.log('[LayerSystem] Parent Chain Verification:');
            
            let current = activeLayer;
            let depth = 0;
            let foundWorldContainer = false;
            
            while (current && depth < 10) {
                const label = current.label || current.constructor.name;
                console.log(`  [${depth}] ${label}`);
                
                if (current === this.cameraSystem?.worldContainer) {
                    foundWorldContainer = true;
                    console.log('  ✅ worldContainer found in chain at depth', depth);
                    break;
                }
                
                current = current.parent;
                depth++;
            }
            
            if (!foundWorldContainer) {
                console.error('  ❌ worldContainer NOT found in chain');
                console.error('  Chain ended at:', current ? (current.label || current.constructor.name) : 'null');
                return false;
            }
            
            console.log('[LayerSystem] ✅ Parent chain is valid');
            return true;
        }
    }

    // ================================================================================
    // グローバル登録
    // ================================================================================

    window.TegakiLayerSystem = LayerSystem;
    
    if (!window.layerSystem && !window.layerManager) {
        const instance = new LayerSystem();
        window.layerSystem = instance;
        window.layerManager = instance;
    }

})();

console.log('✅ layer-system.js Phase B-Emergency-4 loaded');
console.log('   🚨 BE-4: 転送イベントリスナー登録完了');
console.log('   🚨 BE-4: _receiveTransferredTexture() 実装');
console.log('   🚨 BE-4: _updateLayerSprite() 実装');
console.log('   🚨 BE-4: レイヤーSprite自動生成・管理');
console.log('   ✅ Phase 3 ラスター機能完全継承');
console.log('   ✅ Phase 2 フォルダ機能完全継承');