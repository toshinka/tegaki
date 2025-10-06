// ===== system/layer-system.js - Phase 3: StateManager完全連携版 =====
// 
// ========== Phase 3: 改修内容 START ==========
// 改修方針:
// 1. レイヤー操作は全てStateManager経由に変更
// 2. PixiJSオブジェクト管理はLayerSystemが担当
// 3. 履歴記録はStateManagerが自動的に行う
// 
// 主要変更点:
// - createLayer() → StateManager.addLayer() + PixiJS同期
// - deleteLayer() → StateManager.removeLayer() + PixiJS同期
// - reorderLayers() → StateManager経由の履歴記録
// - exitLayerMoveMode() → StateManager経由の変形確定
// 
// イベント連携:
// - layer:created → PixiJSコンテナ生成
// - layer:removed → PixiJSコンテナ破棄
// - layer:restored → PixiJSコンテナ復元
// ========== Phase 3: 改修内容 END ==========

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.stateManager = null;  // ========== Phase 3: 追加 ==========
            
            this.currentCutContainer = null;
            
            // ========== Phase 3: 削除 - StateManagerが管理 ==========
            // this.activeLayerIndex は StateManager.state.ui.activeLayerIndex を使用
            
            this.cutRenderTextures = new Map();
            this.cutThumbnailDirty = new Map();
            
            this.layerTransforms = new Map();
            
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            
            this.vKeyPressed = false;
            this.isLayerMoveMode = false;
            this.isLayerDragging = false;
            this.layerDragLastPoint = { x: 0, y: 0 };
            
            this.layerTransformPanel = null;
            
            this.cameraSystem = null;
            this.animationSystem = null;
            
            this.coordAPI = window.CoordinateSystem;
            if (!this.coordAPI) {
                console.warn('[LayerSystem] CoordinateSystem not available - fallback to basic transforms');
            }
            
            // ========== Phase 3: PixiJSオブジェクトマップ追加 ==========
            // layerId → PIXI.Container のマッピング
            this.pixiLayers = new Map();
        }

        init(canvasContainer, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            this.stateManager = window.StateManager;  // ========== Phase 3: 追加 ==========
            
            if (!this.eventBus) {
                throw new Error('[LayerSystem] EventBus required');
            }
            
            if (!this.stateManager) {
                throw new Error('[LayerSystem] StateManager required - ensure state-manager.js is loaded first');
            }
            
            // ========== Phase 3: 改修 - 初期レイヤーをStateManagerから取得 ==========
            this.currentCutContainer = new PIXI.Container();
            this.currentCutContainer.label = 'current_cut_container';
            
            // StateManagerの初期frameから全レイヤーを構築
            this._syncPixiFromState();
            
            this._setupLayerOperations();
            this._setupLayerTransformPanel();
            this._setupStateManagerIntegration();  // ========== Phase 3: 追加 ==========
            this._setupAnimationSystemIntegration();
            this._startThumbnailUpdateProcess();
        }

        // ========== Phase 3: 新規メソッド - StateManager連携 START ==========
        
        /**
         * StateManagerのイベントをリスンしてPixiJSを同期
         */
        _setupStateManagerIntegration() {
            if (!this.eventBus) return;
            
            // レイヤー作成時
            this.eventBus.on('layer:created', (data) => {
                const { frameId, layer } = data;
                const currentFrame = this.stateManager.getCurrentFrame();
                
                if (currentFrame && currentFrame.id === frameId) {
                    this._createPixiLayer(layer);
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                }
            });
            
            // レイヤー削除時
            this.eventBus.on('layer:removed', (data) => {
                const { frameId, layerId } = data;
                const currentFrame = this.stateManager.getCurrentFrame();
                
                if (currentFrame && currentFrame.id === frameId) {
                    this._destroyPixiLayer(layerId);
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                }
            });
            
            // レイヤー復元時（Undo対応）
            this.eventBus.on('layer:restored', (data) => {
                const { frameId, layer } = data;
                const currentFrame = this.stateManager.getCurrentFrame();
                
                if (currentFrame && currentFrame.id === frameId) {
                    this._createPixiLayer(layer);
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                }
            });
            
            // ストローク追加時
            this.eventBus.on('stroke:added', (data) => {
                const { layerId, stroke } = data;
                this._addStrokeToPixiLayer(layerId, stroke);
                this._requestThumbnailUpdateByLayerId(layerId);
            });
            
            // ストローク削除時（Undo対応）
            this.eventBus.on('stroke:removed', (data) => {
                const { layerId, strokeId } = data;
                this._removeStrokeFromPixiLayer(layerId, strokeId);
                this._requestThumbnailUpdateByLayerId(layerId);
            });
            
            // アクティブレイヤー変更時
            this.eventBus.on('layer:active-changed', (data) => {
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
            });
        }
        
        /**
         * State全体からPixiJSコンテナを再構築
         */
        _syncPixiFromState() {
            const currentFrame = this.stateManager.getCurrentFrame();
            if (!currentFrame) return;
            
            // 既存のPixiJSレイヤーをクリア
            this.currentCutContainer.removeChildren();
            this.pixiLayers.clear();
            
            // Stateから全レイヤーを構築
            currentFrame.layers.forEach((layer, index) => {
                this._createPixiLayer(layer, index);
            });
        }
        
        /**
         * State layerからPixiJSコンテナを生成
         */
        _createPixiLayer(layerData, insertIndex = null) {
            const pixiLayer = new PIXI.Container();
            pixiLayer.label = layerData.id;
            pixiLayer.visible = layerData.visible;
            pixiLayer.alpha = layerData.opacity;
            
            // 背景レイヤーの場合
            if (layerData.id === 'layer_bg' || layerData.name === '背景') {
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                pixiLayer.addChild(bg);
            }
            
            // 既存ストロークを描画
            if (layerData.strokes && layerData.strokes.length > 0) {
                layerData.strokes.forEach(stroke => {
                    this._createStrokeGraphics(pixiLayer, stroke);
                });
            }
            
            // transform適用
            if (layerData.transform) {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                this._applyTransformDirect(pixiLayer, layerData.transform, centerX, centerY);
            }
            
            // コンテナに追加
            if (insertIndex !== null) {
                this.currentCutContainer.addChildAt(pixiLayer, insertIndex);
            } else {
                this.currentCutContainer.addChild(pixiLayer);
            }
            
            // マップに登録
            this.pixiLayers.set(layerData.id, pixiLayer);
            
            // 変形情報の初期化
            this.layerTransforms.set(layerData.id, {
                x: layerData.transform?.x || 0,
                y: layerData.transform?.y || 0,
                rotation: layerData.transform?.rotation || 0,
                scaleX: layerData.transform?.scaleX || 1,
                scaleY: layerData.transform?.scaleY || 1
            });
        }
        
        /**
         * PixiJSレイヤーを破棄
         */
        _destroyPixiLayer(layerId) {
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            this.currentCutContainer.removeChild(pixiLayer);
            pixiLayer.destroy({ children: true, texture: false, baseTexture: false });
            this.pixiLayers.delete(layerId);
            this.layerTransforms.delete(layerId);
        }
        
        /**
         * PixiJSレイヤーにストローク追加
         */
        _addStrokeToPixiLayer(layerId, strokeData) {
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            this._createStrokeGraphics(pixiLayer, strokeData);
        }
        
        /**
         * PixiJSレイヤーからストローク削除
         */
        _removeStrokeFromPixiLayer(layerId, strokeId) {
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            // strokeId でグラフィックスを検索して削除
            for (let i = pixiLayer.children.length - 1; i >= 0; i--) {
                const child = pixiLayer.children[i];
                if (child.strokeId === strokeId) {
                    pixiLayer.removeChild(child);
                    child.destroy();
                    break;
                }
            }
        }
        
        /**
         * ストロークのGraphicsオブジェクトを生成
         */
        _createStrokeGraphics(pixiLayer, strokeData) {
            const graphics = new PIXI.Graphics();
            graphics.strokeId = strokeData.id;  // 削除用にIDを保持
            
            if (strokeData.points && strokeData.points.length > 0) {
                const color = this._parseColor(strokeData.color);
                const size = strokeData.width || 2;
                const opacity = strokeData.opacity || 1.0;
                
                strokeData.points.forEach(point => {
                    if (typeof point.x === 'number' && typeof point.y === 'number' &&
                        isFinite(point.x) && isFinite(point.y)) {
                        graphics.circle(point.x, point.y, size / 2);
                        graphics.fill({ color: color, alpha: opacity });
                    }
                });
            }
            
            pixiLayer.addChild(graphics);
        }
        
        /**
         * カラー文字列をPixiJS数値に変換
         */
        _parseColor(colorStr) {
            if (typeof colorStr === 'number') return colorStr;
            if (typeof colorStr === 'string' && colorStr.startsWith('#')) {
                return parseInt(colorStr.substring(1), 16);
            }
            return 0x000000;
        }
        
        /**
         * layerIdでサムネイル更新をリクエスト
         */
        _requestThumbnailUpdateByLayerId(layerId) {
            const currentFrame = this.stateManager.getCurrentFrame();
            if (!currentFrame) return;
            
            const layerIndex = currentFrame.layers.findIndex(l => l.id === layerId);
            if (layerIndex >= 0) {
                this.requestThumbnailUpdate(layerIndex);
            }
        }
        
        // ========== Phase 3: 新規メソッド END ==========

        // ========== Phase 3: 既存メソッドの改修 START ==========

        /**
         * レイヤー取得 - StateManagerから取得
         */
        getLayers() {
            const currentFrame = this.stateManager?.getCurrentFrame();
            if (!currentFrame) return [];
            return currentFrame.layers;
        }
        
        /**
         * アクティブレイヤー取得 - StateManagerから取得
         */
        getActiveLayer() {
            return this.stateManager?.getCurrentLayer() || null;
        }
        
        /**
         * アクティブレイヤーのindex取得
         */
        get activeLayerIndex() {
            return this.stateManager?.state.ui.activeLayerIndex ?? -1;
        }
        
        /**
         * アクティブレイヤーのindex設定
         */
        set activeLayerIndex(value) {
            if (this.stateManager) {
                this.stateManager.setActiveLayerIndex(value);
            }
        }

        /**
         * レイヤー作成 - StateManager経由
         */
        createLayer(name, isBackground = false) {
            if (!this.stateManager) return null;
            
            const layerName = name || `レイヤー${this.getLayers().length + 1}`;
            const layer = this.stateManager.addLayer(layerName);
            
            if (!layer) return null;
            
            // PixiJSコンテナは layer:created イベントで自動生成される
            
            return { 
                layer: layer, 
                index: this.getLayers().length - 1 
            };
        }
        
        /**
         * レイヤー削除 - StateManager経由
         */
        deleteLayer(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return false;
            
            const layer = layers[layerIndex];
            if (!layer) return false;
            
            // 背景レイヤーは削除不可
            if (layer.id === 'layer_bg' || layer.name === '背景') {
                return false;
            }
            
            const success = this.stateManager.removeLayer(layer.id);
            
            // PixiJSコンテナは layer:removed イベントで自動破棄される
            
            if (success && this.animationSystem?.generateCutThumbnail) {
                const cutIndex = this.animationSystem.getCurrentCutIndex();
                setTimeout(() => {
                    this.animationSystem.generateCutThumbnail(cutIndex);
                }, 100);
            }
            
            return success;
        }
        
        /**
         * レイヤー並び替え - StateManager経由
         */
        reorderLayers(fromIndex, toIndex) {
            const layers = this.getLayers();
            
            if (fromIndex < 0 || fromIndex >= layers.length || 
                toIndex < 0 || toIndex >= layers.length || 
                fromIndex === toIndex) {
                return false;
            }
            
            try {
                const movedLayer = layers[fromIndex];
                const oldActiveIndex = this.activeLayerIndex;
                
                // ========== Phase 3: History記録のみ実施 ==========
                if (window.History && !window.History.isApplying) {
                    const command = {
                        name: 'layer-reorder',
                        do: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(fromIndex, 1);
                            layers.splice(toIndex, 0, layer);
                            
                            // PixiJS同期
                            const pixiLayer = this.pixiLayers.get(layer.id);
                            if (pixiLayer) {
                                this.currentCutContainer.removeChild(pixiLayer);
                                this.currentCutContainer.addChildAt(pixiLayer, toIndex);
                            }
                            
                            // アクティブindex調整
                            if (this.activeLayerIndex === fromIndex) {
                                this.activeLayerIndex = toIndex;
                            } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                                this.activeLayerIndex--;
                            } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                                this.activeLayerIndex++;
                            }
                            
                            this.updateLayerPanelUI();
                            
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { 
                                    fromIndex, 
                                    toIndex, 
                                    activeIndex: this.activeLayerIndex,
                                    movedLayerId: layer.id
                                });
                            }
                        },
                        undo: () => {
                            const layers = this.getLayers();
                            const [layer] = layers.splice(toIndex, 1);
                            layers.splice(fromIndex, 0, layer);
                            
                            // PixiJS同期
                            const pixiLayer = this.pixiLayers.get(layer.id);
                            if (pixiLayer) {
                                this.currentCutContainer.removeChild(pixiLayer);
                                this.currentCutContainer.addChildAt(pixiLayer, fromIndex);
                            }
                            
                            this.activeLayerIndex = oldActiveIndex;
                            this.updateLayerPanelUI();
                            
                            if (this.eventBus) {
                                this.eventBus.emit('layer:reordered', { 
                                    fromIndex: toIndex, 
                                    toIndex: fromIndex, 
                                    activeIndex: this.activeLayerIndex,
                                    movedLayerId: layer.id
                                });
                            }
                        },
                        meta: { type: 'layer-reorder', fromIndex, toIndex }
                    };
                    window.History.push(command);
                } else {
                    // 直接実行
                    const [layer] = layers.splice(fromIndex, 1);
                    layers.splice(toIndex, 0, layer);
                    
                    const pixiLayer = this.pixiLayers.get(layer.id);
                    if (pixiLayer) {
                        this.currentCutContainer.removeChild(pixiLayer);
                        this.currentCutContainer.addChildAt(pixiLayer, toIndex);
                    }
                    
                    if (this.activeLayerIndex === fromIndex) {
                        this.activeLayerIndex = toIndex;
                    } else if (this.activeLayerIndex > fromIndex && this.activeLayerIndex <= toIndex) {
                        this.activeLayerIndex--;
                    } else if (this.activeLayerIndex < fromIndex && this.activeLayerIndex >= toIndex) {
                        this.activeLayerIndex++;
                    }
                    
                    this.updateLayerPanelUI();
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:reordered', { 
                            fromIndex, 
                            toIndex, 
                            activeIndex: this.activeLayerIndex,
                            movedLayerId: movedLayer.id
                        });
                    }
                }
                
                return true;
                
            } catch (error) {
                return false;
            }
        }

        /**
         * レイヤー変形モード終了 - 変形確定してHistory記録
         */
        exitLayerMoveMode() {
            if (!this.isLayerMoveMode) return;
            
            const activeLayer = this.getActiveLayer();
            const layerId = activeLayer?.id;
            const transformBefore = layerId ? structuredClone(this.layerTransforms.get(layerId)) : null;
            
            this.isLayerMoveMode = false;
            this.vKeyPressed = false;
            this.isLayerDragging = false;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(false);
                this.cameraSystem.hideGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.remove('show');
            }
            
            this.updateCursor();
            
            // ========== Phase 3: 変形確定処理 ==========
            if (activeLayer && layerId && transformBefore && this.isTransformNonDefault(transformBefore)) {
                // 変形をパスに適用
                const pixiLayer = this.pixiLayers.get(layerId);
                if (pixiLayer) {
                    const success = this.safeApplyTransformToPaths(pixiLayer, transformBefore, activeLayer);
                    
                    if (success && window.History && !window.History.isApplying) {
                        const strokesAfter = structuredClone(activeLayer.strokes);
                        const transformAfter = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
                        
                        const command = {
                            name: 'layer-transform',
                            do: () => {
                                // 変形後の状態を適用
                                activeLayer.strokes = structuredClone(strokesAfter);
                                activeLayer.transform = { ...transformAfter };
                                this.layerTransforms.set(layerId, transformAfter);
                                
                                // PixiJS再構築
                                this._destroyPixiLayer(layerId);
                                this._createPixiLayer(activeLayer);
                                this.requestThumbnailUpdate(this.activeLayerIndex);
                            },
                            undo: () => {
                                // 変形前の状態に戻す
                                // 注: 完全なUndo実装には変形前のstrokesも保存が必要
                                activeLayer.transform = structuredClone(transformBefore);
                                this.layerTransforms.set(layerId, transformBefore);
                                
                                const centerX = this.config.canvas.width / 2;
                                const centerY = this.config.canvas.height / 2;
                                const pixiLayer = this.pixiLayers.get(layerId);
                                if (pixiLayer) {
                                    this._applyTransformDirect(pixiLayer, transformBefore, centerX, centerY);
                                }
                                this.requestThumbnailUpdate(this.activeLayerIndex);
                            },
                            meta: { type: 'layer-transform', layerId }
                        };
                        window.History.push(command);
                    }
                }
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-exited');
            }
        }

        /**
         * パスに変形を適用（State更新）
         */
        safeApplyTransformToPaths(pixiLayer, transform, layerData) {
            if (!layerData.strokes || layerData.strokes.length === 0) {
                // ストロークがない場合は変形をリセット
                pixiLayer.position.set(0, 0);
                pixiLayer.rotation = 0;
                pixiLayer.scale.set(1, 1);
                pixiLayer.pivot.set(0, 0);
                this.layerTransforms.set(layerData.id, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
                return true;
            }
            
            try {
                const centerX = this.config.canvas.width / 2;
                const centerY = this.config.canvas.height / 2;
                
                const matrix = this.createTransformMatrix(transform, centerX, centerY);
                
                // 各ストロークのポイントを変形
                layerData.strokes.forEach(stroke => {
                    if (stroke.points && Array.isArray(stroke.points)) {
                        stroke.points = this.safeTransformPoints(stroke.points, matrix);
                    }
                });
                
                // PixiJS再構築
                this._destroyPixiLayer(layerData.id);
                this._createPixiLayer(layerData);
                
                // 変形情報をリセット
                layerData.transform = {
                    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0
                };
                this.layerTransforms.set(layerData.id, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
                
                return true;
                
            } catch (error) {
                return false;
            }
        }

        // ========== Phase 3: 既存メソッドの改修 END ==========

        // 以下、既存のメソッド群（最小限の改修のみ） ==========

        setCurrentCutContainer(cutContainer) {
            this.currentCutContainer = cutContainer;
            
            const layers = this.getLayers();
            if (layers.length > 0 && this.activeLayerIndex === -1) {
                this.activeLayerIndex = layers.length - 1;
            }
            
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
            
            if (this.isLayerMoveMode) {
                this.updateLayerTransformPanelValues();
            }
        }
        
        createCutRenderTexture(cutId) {
            if (!this.app?.renderer) return null;
            
            const renderTexture = PIXI.RenderTexture.create({
                width: this.config.canvas.width,
                height: this.config.canvas.height
            });
            
            this.cutRenderTextures.set(cutId, renderTexture);
            this.cutThumbnailDirty.set(cutId, true);
            
            return renderTexture;
        }
        
        renderCutToTexture(cutId, cutContainer) {
            if (!this.app?.renderer) return;
            
            const renderTexture = this.cutRenderTextures.get(cutId);
            if (!renderTexture) return;
            
            const container = cutContainer || this.currentCutContainer;
            if (!container) return;
            
            this.app.renderer.render({
                container: container,
                target: renderTexture,
                clear: true
            });
            
            this.markCutThumbnailDirty(cutId);
        }
        
        markCutThumbnailDirty(cutId) {
            this.cutThumbnailDirty.set(cutId, true);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:updated', { cutId: cutId });
            }
        }
        
        getCutRenderTexture(cutId) {
            return this.cutRenderTextures.get(cutId);
        }
        
        destroyCutRenderTexture(cutId) {
            const renderTexture = this.cutRenderTextures.get(cutId);
            if (renderTexture) {
                renderTexture.destroy(true);
                this.cutRenderTextures.delete(cutId);
                this.cutThumbnailDirty.delete(cutId);
            }
        }
        
        isCutThumbnailDirty(cutId) {
            return this.cutThumbnailDirty.get(cutId) || false;
        }
        
        clearCutThumbnailDirty(cutId) {
            this.cutThumbnailDirty.set(cutId, false);
        }
        
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            
            this.eventBus.on('animation:cut-applied', (data) => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            
            this.eventBus.on('animation:cut-created', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                }, 100);
            });
            
            this.eventBus.on('animation:cut-deleted', () => {
                setTimeout(() => {
                    this.updateLayerPanel

UI();
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
                    if (instance && typeof instance.getCurrentCut === 'function') {
                        this.animationSystem = instance;
                        break;
                    }
                }
                
                if (this.animationSystem && this.animationSystem.layerSystem !== this) {
                    this.animationSystem.layerSystem = this;
                }
            }
        }

        _setupLayerTransformPanel() {
            this.layerTransformPanel = document.getElementById('layer-transform-panel');
            
            if (!this.layerTransformPanel) return;
            
            this._setupLayerSlider('layer-x-slider', this.config.layer.minX, this.config.layer.maxX, 0, (value) => {
                this.updateActiveLayerTransform('x', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-y-slider', this.config.layer.minY, this.config.layer.maxY, 0, (value) => {
                this.updateActiveLayerTransform('y', value);
                return Math.round(value) + 'px';
            });
            
            this._setupLayerSlider('layer-rotation-slider', this.config.layer.minRotation, this.config.layer.maxRotation, 0, (value) => {
                this.updateActiveLayerTransform('rotation', value * Math.PI / 180);
                return Math.round(value) + '°';
            });
            
            this._setupLayerSlider('layer-scale-slider', this.config.layer.minScale, this.config.layer.maxScale, 1.0, (value) => {
                this.updateActiveLayerTransform('scale', value);
                return value.toFixed(2) + 'x';
            });
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('horizontal');
                });
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.addEventListener('click', () => {
                    this.flipActiveLayer('vertical');
                });
            }
        }

        _setupLayerSlider(sliderId, min, max, initial, callback) {
            const container = document.getElementById(sliderId);
            if (!container) return;

            const track = container.querySelector('.slider-track');
            const handle = container.querySelector('.slider-handle');
            const valueDisplay = container.parentNode.querySelector('.slider-value');

            if (!track || !handle || !valueDisplay) return;

            let value = initial;
            let dragging = false;

            const update = (newValue, fromSlider = false) => {
                value = Math.max(min, Math.min(max, newValue));
                const percentage = ((value - min) / (max - min)) * 100;
                
                track.style.width = percentage + '%';
                handle.style.left = percentage + '%';
                valueDisplay.textContent = callback(value, fromSlider);
            };

            const getValue = (clientX) => {
                const rect = container.getBoundingClientRect();
                const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return min + (percentage * (max - min));
            };

            container.addEventListener('mousedown', (e) => {
                dragging = true;
                update(getValue(e.clientX), true);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (dragging) update(getValue(e.clientX), true);
            });

            document.addEventListener('mouseup', () => {
                dragging = false;
            });

            container.updateValue = (newValue) => {
                update(newValue, false);
            };

            update(initial);
        }
        
        updateActiveLayerTransform(property, value) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.id;
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(property) {
                case 'x':
                    transform.x = value;
                    break;
                case 'y':
                    transform.y = value;
                    break;
                case 'rotation':
                    transform.rotation = value;
                    break;
                case 'scale':
                    const hFlipped = transform.scaleX < 0;
                    const vFlipped = transform.scaleY < 0;
                    transform.scaleX = hFlipped ? -value : value;
                    transform.scaleY = vFlipped ? -value : value;
                    break;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(pixiLayer, transform, centerX, centerY);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }
        
        _applyTransformDirect(layer, transform, centerX, centerY) {
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + transform.x, centerY + transform.y);
                layer.rotation = transform.rotation;
                layer.scale.set(transform.scaleX, transform.scaleY);
            } else if (transform.x !== 0 || transform.y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(transform.x, transform.y);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
        }

        flipActiveLayer(direction) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.id;
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (direction === 'horizontal') {
                transform.scaleX *= -1;
            } else if (direction === 'vertical') {
                transform.scaleY *= -1;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(pixiLayer, transform, centerX, centerY);
            }
            
            this.updateFlipButtons();
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        updateFlipButtons() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const pixiLayer = this.pixiLayers.get(activeLayer.id);
            if (!pixiLayer) return;
            
            const flipHorizontalBtn = document.getElementById('flip-horizontal-btn');
            const flipVerticalBtn = document.getElementById('flip-vertical-btn');
            
            if (flipHorizontalBtn) {
                flipHorizontalBtn.classList.toggle('active', pixiLayer.scale.x < 0);
            }
            
            if (flipVerticalBtn) {
                flipVerticalBtn.classList.toggle('active', pixiLayer.scale.y < 0);
            }
        }

        updateLayerTransformPanelValues() {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.id;
            const transform = this.layerTransforms.get(layerId) || {
                x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
            };
            
            ['x', 'y', 'rotation', 'scale'].forEach(prop => {
                const slider = document.getElementById(`layer-${prop}-slider`);
                if (slider?.updateValue) {
                    let value = transform[prop];
                    if (prop === 'rotation') value = value * 180 / Math.PI;
                    if (prop === 'scale') value = Math.abs(transform.scaleX);
                    slider.updateValue(value);
                }
            });
            
            this.updateFlipButtons();
        }

        _setupLayerOperations() {
            document.addEventListener('keydown', (e) => {
                const activeElement = document.activeElement;
                if (activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                )) {
                    return;
                }

                const keymap = window.TEGAKI_KEYMAP;
                if (!keymap) return;

                const context = { vMode: this.vKeyPressed };
                const action = keymap.getAction(e, context);
                
                if (!action) return;

                switch(action) {
                    case 'LAYER_MOVE_MODE_TOGGLE':
                        this.toggleLayerMoveMode();
                        e.preventDefault();
                        break;

                    case 'GIF_PREV_FRAME':
                        if (this.animationSystem?.goToPreviousFrame) {
                            this.animationSystem.goToPreviousFrame();
                        }
                        if (this.eventBus) {
                            this.eventBus.emit('gif:prev-frame-requested');
                        }
                        e.preventDefault();
                        break;

                    case 'GIF_NEXT_FRAME':
                        if (this.animationSystem?.goToNextFrame) {
                            this.animationSystem.goToNextFrame();
                        }
                        if (this.eventBus) {
                            this.eventBus.emit('gif:next-frame-requested');
                        }
                        e.preventDefault();
                        break;

                    case 'LAYER_HIERARCHY_UP':
                        this.moveActiveLayerHierarchy('up');
                        e.preventDefault();
                        break;

                    case 'LAYER_HIERARCHY_DOWN':
                        this.moveActiveLayerHierarchy('down');
                        e.preventDefault();
                        break;

                    case 'TOOL_PEN':
                    case 'TOOL_ERASER':
                        if (this.isLayerMoveMode) {
                            this.exitLayerMoveMode();
                        }
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_UP':
                        this.moveActiveLayer('ArrowUp');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_DOWN':
                        this.moveActiveLayer('ArrowDown');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_LEFT':
                        this.moveActiveLayer('ArrowLeft');
                        e.preventDefault();
                        break;

                    case 'LAYER_MOVE_RIGHT':
                        this.moveActiveLayer('ArrowRight');
                        e.preventDefault();
                        break;

                    case 'LAYER_SCALE_UP':
                        this.transformActiveLayer('ArrowUp');
                        e.preventDefault();
                        break;

                    case 'LAYER_SCALE_DOWN':
                        this.transformActiveLayer('ArrowDown');
                        e.preventDefault();
                        break;

                    case 'LAYER_ROTATE_LEFT':
                        this.transformActiveLayer('ArrowLeft');
                        e.preventDefault();
                        break;

                    case 'LAYER_ROTATE_RIGHT':
                        this.transformActiveLayer('ArrowRight');
                        e.preventDefault();
                        break;

                    case 'LAYER_FLIP_HORIZONTAL':
                        this.flipActiveLayer('horizontal');
                        e.preventDefault();
                        break;

                    case 'LAYER_FLIP_VERTICAL':
                        this.flipActiveLayer('vertical');
                        e.preventDefault();
                        break;
                }
            });
            
            window.addEventListener('blur', () => {
                if (this.vKeyPressed) {
                    this.exitLayerMoveMode();
                }
            });
            
            this._setupLayerDragEvents();
        }

        toggleLayerMoveMode() {
            if (this.isLayerMoveMode) {
                this.exitLayerMoveMode();
            } else {
                this.enterLayerMoveMode();
            }
        }

        moveActiveLayerHierarchy(direction) {
            const layers = this.getLayers();
            if (layers.length <= 1) return;
            
            const currentIndex = this.activeLayerIndex;
            let newIndex;
            
            if (direction === 'up') {
                newIndex = Math.min(currentIndex + 1, layers.length - 1);
            } else if (direction === 'down') {
                newIndex = Math.max(currentIndex - 1, 0);
            } else {
                return;
            }
            
            if (newIndex !== currentIndex) {
                this.reorderLayers(currentIndex, newIndex);
                this.setActiveLayer(newIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { 
                        direction, 
                        oldIndex: currentIndex, 
                        newIndex 
                    });
                }
            }
        }

        _setupLayerDragEvents() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;
            
            canvas.addEventListener('pointerdown', (e) => {
                if (this.vKeyPressed && e.button === 0) {
                    this.isLayerDragging = true;
                    this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'move';
                    e.preventDefault();
                }
            });
            
            canvas.addEventListener('pointermove', (e) => {
                if (this.isLayerDragging && this.vKeyPressed) {
                    this._handleLayerDrag(e);
                }
            });
            
            canvas.addEventListener('pointerup', (e) => {
                if (this.isLayerDragging) {
                    this.isLayerDragging = false;
                    this.updateCursor();
                }
            });
        }

        _getSafeCanvas() {
            if (this.app?.canvas) return this.app.canvas;
            if (this.app?.view) return this.app.view;
            const canvasElements = document.querySelectorAll('canvas');
            if (canvasElements.length > 0) return canvasElements[0];
            return null;
        }

        _handleLayerDrag(e) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;

            const dx = e.clientX - this.layerDragLastPoint.x;
            const dy = e.clientY - this.layerDragLastPoint.y;
            
            const worldScale = this.cameraSystem ? this.cameraSystem.worldContainer.scale.x : 1;
            const adjustedDx = dx / worldScale;
            const adjustedDy = dy / worldScale;
            
            const layerId = activeLayer.id;
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (e.shiftKey) {
                if (Math.abs(dy) > Math.abs(dx)) {
                    const scaleFactor = 1 + (dy * -0.01);
                    const currentScale = Math.abs(transform.scaleX);
                    const newScale = Math.max(this.config.layer.minScale, 
                        Math.min(this.config.layer.maxScale, currentScale * scaleFactor));
                    
                    transform.scaleX = transform.scaleX < 0 ? -newScale : newScale;
                    transform.scaleY = transform.scaleY < 0 ? -newScale : newScale;
                    
                    const scaleSlider = document.getElementById('layer-scale-slider');
                    if (scaleSlider?.updateValue) {
                        scaleSlider.updateValue(newScale);
                    }
                } else {
                    transform.rotation += (dx * 0.02);
                    
                    const rotationSlider = document.getElementById('layer-rotation-slider');
                    if (rotationSlider?.updateValue) {
                        rotationSlider.updateValue(transform.rotation * 180 / Math.PI);
                    }
                }
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
                } else {
                    pixiLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            } else {
                transform.x += adjustedDx;
                transform.y += adjustedDy;
                
                if (this.coordAPI?.applyLayerTransform) {
                    this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
                } else {
                    pixiLayer.position.set(centerX + transform.x, centerY + transform.y);
                }
                
                const xSlider = document.getElementById('layer-x-slider');
                const ySlider = document.getElementById('layer-y-slider');
                if (xSlider?.updateValue) xSlider.updateValue(transform.x);
                if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            }
            
            this.layerDragLastPoint = { x: e.clientX, y: e.clientY };
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        enterLayerMoveMode() {
            if (this.isLayerMoveMode) return;
            
            this.isLayerMoveMode = true;
            this.vKeyPressed = true;
            
            if (this.cameraSystem?.setVKeyPressed) {
                this.cameraSystem.setVKeyPressed(true);
                this.cameraSystem.showGuideLines();
            }
            
            if (this.layerTransformPanel) {
                this.layerTransformPanel.classList.add('show');
                this.updateLayerTransformPanelValues();
            }
            
            this.updateCursor();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:move-mode-entered');
            }
        }

        moveActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.id;
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const moveAmount = 5;
            
            switch(keyCode) {
                case 'ArrowUp':    transform.y -= moveAmount; break;
                case 'ArrowDown':  transform.y += moveAmount; break;
                case 'ArrowLeft':  transform.x -= moveAmount; break;
                case 'ArrowRight': transform.x += moveAmount; break;
            }
            
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
            } else {
                pixiLayer.position.set(centerX + transform.x, centerY + transform.y);
            }
            
            const xSlider = document.getElementById('layer-x-slider');
            const ySlider = document.getElementById('layer-y-slider');
            if (xSlider?.updateValue) xSlider.updateValue(transform.x);
            if (ySlider?.updateValue) ySlider.updateValue(transform.y);
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        transformActiveLayer(keyCode) {
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.id;
            const pixiLayer = this.pixiLayers.get(layerId);
            if (!pixiLayer) return;
            
            if (!this.layerTransforms.has(layerId)) {
                this.layerTransforms.set(layerId, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            const transform = this.layerTransforms.get(layerId);
            const centerX = this.config.canvas.width / 2;
            const centerY = this.config.canvas.height / 2;
            
            switch(keyCode) {
                case 'ArrowUp':
                    const scaleUpFactor = 1.1;
                    const currentScaleUp = Math.abs(transform.scaleX);
                    const newScaleUp = Math.min(this.config.layer.maxScale, currentScaleUp * scaleUpFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleUp : newScaleUp;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleUp : newScaleUp;
                    
                    const scaleSliderUp = document.getElementById('layer-scale-slider');
                    if (scaleSliderUp?.updateValue) {
                        scaleSliderUp.updateValue(newScaleUp);
                    }
                    break;
                    
                case 'ArrowDown':
                    const scaleDownFactor = 0.9;
                    const currentScaleDown = Math.abs(transform.scaleX);
                    const newScaleDown = Math.max(this.config.layer.minScale, currentScaleDown * scaleDownFactor);
                    transform.scaleX = transform.scaleX < 0 ? -newScaleDown : newScaleDown;
                    transform.scaleY = transform.scaleY < 0 ? -newScaleDown : newScaleDown;
                    
                    const scaleSliderDown = document.getElementById('layer-scale-slider');
                    if (scaleSliderDown?.updateValue) {
                        scaleSliderDown.updateValue(newScaleDown);
                    }
                    break;
                    
                case 'ArrowLeft':
                    transform.rotation -= (15 * Math.PI) / 180;
                    
                    const rotationSliderLeft = document.getElementById('layer-rotation-slider');
                    if (rotationSliderLeft?.updateValue) {
                        rotationSliderLeft.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
                    
                case 'ArrowRight':
                    transform.rotation += (15 * Math.PI) / 180;
                    
                    const rotationSliderRight = document.getElementById('layer-rotation-slider');
                    if (rotationSliderRight?.updateValue) {
                        rotationSliderRight.updateValue(transform.rotation * 180 / Math.PI);
                    }
                    break;
            }
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(pixiLayer, transform, centerX, centerY);
            } else {
                this._applyTransformDirect(pixiLayer, transform, centerX, centerY);
            }
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

        createTransformMatrix(transform, centerX, centerY) {
            const matrix = new PIXI.Matrix();
            
            matrix.translate(-centerX, -centerY);
            matrix.scale(transform.scaleX, transform.scaleY);
            matrix.rotate(transform.rotation);
            matrix.translate(centerX + transform.x, centerY + transform.y);
            
            return matrix;
        }

        safeTransformPoints(points, matrix) {
            const transformedPoints = [];
            
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                if (typeof point.x !== 'number' || typeof point.y !== 'number' ||
                    !isFinite(point.x) || !isFinite(point.y)) {
                    continue;
                }
                
                try {
                    const transformed = matrix.apply(point);
                    
                    if (typeof transformed.x === 'number' && typeof transformed.y === 'number' &&
                        isFinite(transformed.x) && isFinite(transformed.y)) {
                        transformedPoints.push({
                            x: transformed.x,
                            y: transformed.y
                        });
                    }
                } catch (transformError) {
                    continue;
                }
            }
            
            return transformedPoints;
        }

        isTransformNonDefault(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || Math.abs(transform.scaleY) !== 1);
        }

        updateCursor() {
            const canvas = this._getSafeCanvas();
            if (!canvas) return;

            if (this.vKeyPressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
        
        setActiveLayer(index) {
            const layers = this.getLayers();
            if (index >= 0 && index < layers.length) {
                this.stateManager.setActiveLayerIndex(index);
            }
        }

        toggleLayerVisibility(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            layer.visible = !layer.visible;
            
            const pixiLayer = this.pixiLayers.get(layer.id);
            if (pixiLayer) {
                pixiLayer.visible = layer.visible;
            }
            
            this.updateLayerPanelUI();
            this.requestThumbnailUpdate(layerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:visibility-changed', { 
                    layerIndex, 
                    visible: layer.visible,
                    layerId: layer.id
                });
            }
        }

        addPathToLayer(layerIndex, path) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            const pixiLayer = this.pixiLayers.get(layer.id);
            if (!pixiLayer) return;
            
            layer.strokes.push(path);
            this._createStrokeGraphics(pixiLayer, path);
            
            this.requestThumbnailUpdate(layerIndex);
            
            if (this.animationSystem?.generateCutThumbnail) {
                const cutIndex = this.animationSystem.getCurrentCutIndex();
                setTimeout(() => {
                    this.animationSystem.generateCutThumbnail(cutIndex);
                }, 100);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('layer:path-added', { 
                    layerIndex, 
                    pathId: path.id,
                    layerId: layer.id
                });
            }
        }

        addPathToActiveLayer(path) {
            if (this.activeLayerIndex >= 0) {
                this.addPathToLayer(this.activeLayerIndex, path);
            }
        }

        insertClipboard(data) {
            if (this.eventBus) {
                this.eventBus.emit('layer:clipboard-inserted', data);
}
}


requestThumbnailUpdate(layerIndex) {
        const layers = this.getLayers();
        if (layerIndex >= 0 && layerIndex < layers.length) {
            this.thumbnailUpdateQueue.add(layerIndex);
            
            if (!this.thumbnailUpdateTimer) {
                this.thumbnailUpdateTimer = setTimeout(() => {
                    this.processThumbnailUpdates();
                    this.thumbnailUpdateTimer = null;
                }, 100);
            }
        }
    }

    _startThumbnailUpdateProcess() {
        setInterval(() => {
            if (this.thumbnailUpdateQueue.size > 0) {
                this.processThumbnailUpdates();
            }
        }, 500);
    }

    processThumbnailUpdates() {
        if (this.thumbnailUpdateQueue.size === 0) return;

        const toUpdate = Array.from(this.thumbnailUpdateQueue);
        toUpdate.forEach(layerIndex => {
            this.updateThumbnail(layerIndex);
            this.thumbnailUpdateQueue.delete(layerIndex);
        });
    }

    updateThumbnail(layerIndex) {
        if (!this.app?.renderer) return;
        
        const layers = this.getLayers();
        if (layerIndex < 0 || layerIndex >= layers.length) return;

        const layer = layers[layerIndex];
        const pixiLayer = this.pixiLayers.get(layer.id);
        if (!pixiLayer) return;
        
        const layerItems = document.querySelectorAll('.layer-item');
        const panelIndex = layers.length - 1 - layerIndex;
        
        if (panelIndex < 0 || panelIndex >= layerItems.length) return;
        
        const thumbnail = layerItems[panelIndex].querySelector('.layer-thumbnail');
        if (!thumbnail) return;

        try {
            const canvasAspectRatio = this.config.canvas.width / this.config.canvas.height;
            let thumbnailWidth, thumbnailHeight;
            const maxHeight = 48;
            const maxWidth = 72;

            if (canvasAspectRatio >= 1) {
                if (maxHeight * canvasAspectRatio <= maxWidth) {
                    thumbnailWidth = maxHeight * canvasAspectRatio;
                    thumbnailHeight = maxHeight;
                } else {
                    thumbnailWidth = maxWidth;
                    thumbnailHeight = maxWidth / canvasAspectRatio;
                }
            } else {
                thumbnailWidth = Math.max(24, maxHeight * canvasAspectRatio);
                thumbnailHeight = maxHeight;
            }
            
            thumbnail.style.width = Math.round(thumbnailWidth) + 'px';
            thumbnail.style.height = Math.round(thumbnailHeight) + 'px';
            
            const renderScale = this.config.thumbnail?.RENDER_SCALE || 2;
            const renderTexture = PIXI.RenderTexture.create({
                width: this.config.canvas.width * renderScale,
                height: this.config.canvas.height * renderScale,
                resolution: renderScale
            });
            
            const tempContainer = new PIXI.Container();
            
            const originalState = {
                pos: { x: pixiLayer.position.x, y: pixiLayer.position.y },
                scale: { x: pixiLayer.scale.x, y: pixiLayer.scale.y },
                rotation: pixiLayer.rotation,
                pivot: { x: pixiLayer.pivot.x, y: pixiLayer.pivot.y }
            };
            
            pixiLayer.position.set(0, 0);
            pixiLayer.scale.set(1, 1);
            pixiLayer.rotation = 0;
            pixiLayer.pivot.set(0, 0);
            
            tempContainer.addChild(pixiLayer);
            tempContainer.scale.set(renderScale);
            
            this.app.renderer.render({
                container: tempContainer,
                target: renderTexture
            });
            
            pixiLayer.position.set(originalState.pos.x, originalState.pos.y);
            pixiLayer.scale.set(originalState.scale.x, originalState.scale.y);
            pixiLayer.rotation = originalState.rotation;
            pixiLayer.pivot.set(originalState.pivot.x, originalState.pivot.y);
            
            tempContainer.removeChild(pixiLayer);
            this.currentCutContainer.addChildAt(pixiLayer, layerIndex);
            
            const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
            const targetCanvas = document.createElement('canvas');
            targetCanvas.width = Math.round(thumbnailWidth);
            targetCanvas.height = Math.round(thumbnailHeight);
            
            const ctx = targetCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = this.config.thumbnail?.QUALITY || 'high';
            ctx.drawImage(sourceCanvas, 0, 0, Math.round(thumbnailWidth), Math.round(thumbnailHeight));
            
            let img = thumbnail.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                thumbnail.innerHTML = '';
                thumbnail.appendChild(img);
            }
            img.src = targetCanvas.toDataURL();
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            renderTexture.destroy();
            tempContainer.destroy();
            
        } catch (error) {
        }
    }

    updateLayerPanelUI() {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;

        layerList.innerHTML = '';
        
        const layers = this.getLayers();

        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const isActive = (i === this.activeLayerIndex);
            
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            layerItem.dataset.layerIndex = i;

            layerItem.innerHTML = `
                <div class="layer-visibility ${layer.visible ? '' : 'hidden'}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${layer.visible ? 
                            '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>' :
                            '<path d="m15 18-.722-3.25"/><path d="m2 2 20 20"/><path d="M6.71 6.71C3.4 8.27 2 12 2 12s3 7 10 7c1.59 0 2.84-.3 3.79-.73"/><path d="m8.5 10.5 7 7"/><path d="M9.677 4.677C10.495 4.06 11.608 4 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-.64.77"/>'}
                    </svg>
                </div>
                <div class="layer-opacity">${Math.round((layer.opacity || 1.0) * 100)}%</div>
                <div class="layer-name">${layer.name}</div>
                <div class="layer-thumbnail">
                    <div class="layer-thumbnail-placeholder"></div>
                </div>
                <div class="layer-delete-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m18 6-12 12"/><path d="m6 6 12 12"/>
                    </svg>
                </div>
            `;

            layerItem.addEventListener('click', (e) => {
                const target = e.target.closest('[class*="layer-"]');
                if (target) {
                    const action = target.className;
                    if (action.includes('layer-visibility')) {
                        this.toggleLayerVisibility(i);
                        e.stopPropagation();
                    } else if (action.includes('layer-delete')) {
                        if (confirm(`レイヤー "${layer.name}" を削除しますか？`)) {
                            this.deleteLayer(i);
                        }
                        e.stopPropagation();
                    } else {
                        this.setActiveLayer(i);
                    }
                } else {
                    this.setActiveLayer(i);
                }
            });

            layerList.appendChild(layerItem);
        }
        
        for (let i = 0; i < layers.length; i++) {
            this.requestThumbnailUpdate(i);
        }
        
        if (window.TegakiUI?.initializeSortable) {
            setTimeout(() => {
                window.TegakiUI.initializeSortable(this);
            }, 50);
        }
    }

    updateStatusDisplay() {
        const statusElement = document.getElementById('current-layer');
        const layers = this.getLayers();
        
        if (statusElement && this.activeLayerIndex >= 0) {
            const layer = layers[this.activeLayerIndex];
            statusElement.textContent = layer.name;
        }
        
        if (this.eventBus) {
            this.eventBus.emit('ui:status-updated', {
                currentLayer: this.activeLayerIndex >= 0 ? 
                    layers[this.activeLayerIndex].name : 'なし',
                layerCount: layers.length,
                activeIndex: this.activeLayerIndex
            });
        }
    }

    setCameraSystem(cameraSystem) {
        this.cameraSystem = cameraSystem;
    }

    setApp(app) {
        this.app = app;
    }

    setAnimationSystem(animationSystem) {
        this.animationSystem = animationSystem;
        
        if (animationSystem && animationSystem.layerSystem !== this) {
            animationSystem.layerSystem = this;
        }
    }
}

window.TegakiLayerSystem = LayerSystem;})();


