// ===== system/layer-system.js - CoordinateUnification統合完全版 =====

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.currentFrameContainer = null;
            this.activeLayerIndex = -1;
            this.frameRenderTextures = new Map();
            this.frameThumbnailDirty = new Map();
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            this.cameraSystem = null;
            this.animationSystem = null;
            
            // ✅ CoordinateUnification統合
            this.coordinateUnification = null;
            this.layerTransform = null;
            
            this.isInitialized = false;
        }

        init(canvasContainer, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            if (!this.eventBus) throw new Error('EventBus required for LayerSystem');
            
            // ✅ CoordinateUnificationが利用可能か確認
            if (window.TegakiCoordinateUnification) {
                this.coordinateUnification = new window.TegakiCoordinateUnification(
                    this.config,
                    this.eventBus
                );
            }
            
            // ✅ LayerTransform（統合版）の初期化
            if (window.TegakiLayerTransform) {
                this.layerTransform = new window.TegakiLayerTransform(
                    this.config,
                    this.coordinateUnification
                );
            }
            
            this.currentFrameContainer = new PIXI.Container();
            this.currentFrameContainer.label = 'temporary_frame_container';
            
            const bgLayer = new PIXI.Container();
            const bgLayerModel = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_bg_' + Date.now(),
                name: '背景',
                isBackground: true
            });
            bgLayer.label = bgLayerModel.id;
            bgLayer.layerData = bgLayerModel;
            const bg = this._createCheckerPatternBackground(this.config.canvas.width, this.config.canvas.height);
            bgLayer.addChild(bg);
            bgLayer.layerData.backgroundGraphics = bg;
            this.currentFrameContainer.addChild(bgLayer);
            
            const layer1 = new PIXI.Container();
            const layer1Model = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_1_' + Date.now(),
                name: 'レイヤー1'
            });
            layer1.label = layer1Model.id;
            layer1.layerData = layer1Model;
            
            // ✅ CoordinateUnificationに変形状態を初期化
            if (this.coordinateUnification) {
                this.coordinateUnification.setTransform(layer1Model.id, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            this.currentFrameContainer.addChild(layer1);
            this.activeLayerIndex = 1;
            
            this._setupLayerOperations();
            this._setupAnimationSystemIntegration();
            this._setupVKeyEvents();
            this._startThumbnailUpdateProcess();
            this.isInitialized = true;
        }

        _createCheckerPatternBackground(width, height) {
            const g = new PIXI.Graphics();
            const color1 = 0xe9c2ba;
            const color2 = 0xf0e0d6;
            const squareSize = 16;
            
            for (let y = 0; y < height; y += squareSize) {
                for (let x = 0; x < width; x += squareSize) {
                    const isEvenX = (x / squareSize) % 2 === 0;
                    const isEvenY = (y / squareSize) % 2 === 0;
                    const color = (isEvenX === isEvenY) ? color1 : color2;
                    g.rect(x, y, squareSize, squareSize);
                    g.fill({ color: color });
                }
            }
            return g;
        }
        
        _setupVKeyEvents() {
            if (!this.eventBus) return;
            this.eventBus.on('keyboard:vkey-pressed', () => {
                if (!this.layerTransform) return;
                
                if (!this.layerTransform.app && this.app && this.cameraSystem) {
                    this.initTransform();
                }
                
                if (this.layerTransform.isVKeyPressed) {
                    const activeLayer = this.getActiveLayer();
                    this.layerTransform.exitMoveMode();
                } else {
                    this.layerTransform.enterMoveMode();
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        this.layerTransform.updateTransformPanelValues(activeLayer);
                    }
                }
            });
            this.eventBus.on('keyboard:vkey-released', () => {});
        }
        
        initTransform() {
            if (!this.layerTransform || !this.app) return;
            
            this.layerTransform.init(this.app, this.cameraSystem);
            
            this.layerTransform.onTransformComplete = (layer) => {
                this.requestThumbnailUpdate(this.getLayerIndex(layer));
                this.eventBus.emit('layer:transform-confirmed', { layerId: layer.layerData.id });
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
            };
            
            this.layerTransform.onTransformUpdate = (layer, transform) => {
                if (!this.layerTransform.isDragging) {
                    this.requestThumbnailUpdate(this.getLayerIndex(layer));
                }
                this.eventBus.emit('layer:updated', { layerId: layer.layerData.id, transform });
            };
            
            this.layerTransform.onSliderChange = (sliderId, value) => {
                const activeLayer = this.getActiveLayer();
                if (!activeLayer) return;
                const property = sliderId.replace('layer-', '').replace('-slider', '');
                if (property === 'rotation') {
                    value = value * Math.PI / 180;
                }
                this.layerTransform.updateTransform(activeLayer, property, value);
            };
            
            this.layerTransform.onFlipRequest = (direction) => {
                this.flipActiveLayer(direction);
            };
            
            this.layerTransform.onDragRequest = (dx, dy, shiftKey) => {
                this._handleLayerDrag(dx, dy, shiftKey);
            };
            
            this.layerTransform.onGetActiveLayer = () => {
                return this.getActiveLayer();
            };
        }

        _handleLayerDrag(dx, dy, shiftKey) {
            if (!this.layerTransform || !this.coordinateUnification) return;
            
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            if (shiftKey) {
                // Shift+ドラッグ: 回転
                const rotationDelta = dx * 0.01;
                this.coordinateUnification.rotateLayer(activeLayer, rotationDelta, true);
            } else {
                // 通常ドラッグ: 移動
                this.coordinateUnification.moveLayer(activeLayer, dx, dy);
            }
            
            this.layerTransform.updateTransformPanelValues(activeLayer);
        }

        flipActiveLayer(direction) {
            if (!this.layerTransform || !this.coordinateUnification) return;
            
            const activeLayer = this.getActiveLayer();
            if (!activeLayer?.layerData) return;
            
            this.coordinateUnification.flipLayer(activeLayer, direction);
            this.layerTransform.updateFlipButtons(activeLayer);
            
            this.requestThumbnailUpdate(this.activeLayerIndex);
        }

        getLayerIndex(layer) {
            const layers = this.getLayers();
            return layers.indexOf(layer);
        }

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

        addPathToActiveLayer(path) {
            if (!this.getActiveLayer()) return;
            const activeLayer = this.getActiveLayer();
            const layerIndex = this.activeLayerIndex;
            if (activeLayer.layerData && activeLayer.layerData.paths) {
                activeLayer.layerData.paths.push(path);
            }
            if (!activeLayer.layerData) {
                activeLayer.paths = activeLayer.paths || [];
                activeLayer.paths.push(path);
            }
            this.rebuildPathGraphics(path);
            if (path.graphics) {
                if (activeLayer.layerData && activeLayer.layerData.maskSprite) {
                    path.graphics.mask = activeLayer.layerData.maskSprite;
                }
                activeLayer.addChild(path.graphics);
            }
            this.requestThumbnailUpdate(layerIndex);
            if (this.eventBus) {
                this.eventBus.emit('layer:stroke-added', { path, layerIndex, layerId: activeLayer.label });
            }
        }

        addPathToLayer(layerIndex, path) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                layer.layerData.paths.push(path);
                layer.addChild(path.graphics);
                this.requestThumbnailUpdate(layerIndex);
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:path-added', { layerIndex, pathId: path.id, layerId: layer.layerData.id });
                }
            }
        }

        enterLayerMoveMode() {
            if (this.layerTransform) this.layerTransform.enterMoveMode();
        }
        
        exitLayerMoveMode() {
            if (!this.layerTransform) return;
            this.layerTransform.exitMoveMode();
        }
        
        toggleLayerMoveMode() {
            if (!this.layerTransform) return;
            this.layerTransform.toggleMoveMode();
        }
        
        get isLayerMoveMode() {
            return this.layerTransform?.isVKeyPressed || false;
        }
        
        get vKeyPressed() {
            return this.layerTransform?.isVKeyPressed || false;
        }
        
        updateActiveLayerTransform(property, value) {
            if (!this.layerTransform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.layerTransform.updateTransform(activeLayer, property, value);
            }
        }

        confirmActiveLayerTransform() {
            if (!this.layerTransform) return false;
            const activeLayer = this.getActiveLayer();
            if (!activeLayer) return false;
            return this.layerTransform.confirmTransform(activeLayer);
        }

        createLayer(name = 'Layer', isBackground = false) {
            if (!this.currentFrameContainer) return null;
            
            const newLayer = new PIXI.Container();
            const newLayerModel = new window.TegakiDataModels.LayerModel({
                id: 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: name,
                isBackground: isBackground
            });
            
            newLayer.label = newLayerModel.id;
            newLayer.layerData = newLayerModel;
            
            // ✅ CoordinateUnificationに変形状態を初期化
            if (this.coordinateUnification) {
                this.coordinateUnification.setTransform(newLayerModel.id, {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                });
            }
            
            this.currentFrameContainer.addChild(newLayer);
            this.activeLayerIndex = this.currentFrameContainer.children.length - 1;
            
            this.updateLayerPanelUI();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:created', {
                    layerId: newLayerModel.id,
                    layerIndex: this.activeLayerIndex,
                    layerName: name
                });
            }
            
            return newLayer;
        }

        deleteLayer(index) {
            const layers = this.getLayers();
            if (index < 0 || index >= layers.length) return false;
            if (layers[index].layerData?.isBackground) return false;
            if (layers.length <= 2) return false;
            
            const layerToDelete = layers[index];
            this.currentFrameContainer.removeChild(layerToDelete);
            
            // ✅ CoordinateUnificationから変形状態を削除
            if (this.coordinateUnification) {
                this.coordinateUnification.deleteTransform(layerToDelete.layerData.id);
            }
            
            if (this.activeLayerIndex >= layers.length - 1) {
                this.activeLayerIndex = layers.length - 2;
            }
            
            this.updateLayerPanelUI();
            
            if (this.eventBus) {
                this.eventBus.emit('layer:deleted', { layerId: layerToDelete.layerData.id });
            }
            
            return true;
        }

        getLayers() {
            if (!this.currentFrameContainer) return [];
            return this.currentFrameContainer.children;
        }

        getActiveLayer() {
            const layers = this.getLayers();
            if (this.activeLayerIndex >= 0 && this.activeLayerIndex < layers.length) {
                return layers[this.activeLayerIndex];
            }
            return null;
        }

        setApp(app) {
            this.app = app;
        }

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
        }

        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
        }

        _setupLayerOperations() {
            if (!this.eventBus) return;
        }

        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
        }

        _startThumbnailUpdateProcess() {
            this.thumbnailUpdateTimer = setInterval(() => {
                if (this.thumbnailUpdateQueue.size > 0) {
                    const indexes = Array.from(this.thumbnailUpdateQueue);
                    this.thumbnailUpdateQueue.clear();
                    
                    indexes.forEach(index => {
                        if (this.frameThumbnailDirty.get(index)) {
                            this.frameThumbnailDirty.set(index, false);
                            if (this.eventBus) {
                                this.eventBus.emit('layer:thumbnail-updated', { layerIndex: index });
                            }
                        }
                    });
                }
            }, 100);
        }

        requestThumbnailUpdate(layerIndex) {
            this.frameThumbnailDirty.set(layerIndex, true);
            this.thumbnailUpdateQueue.add(layerIndex);
        }

        updateLayerPanelUI() {
            if (this.eventBus) {
                this.eventBus.emit('ui:update-layer-panel');
            }
        }

        updateStatusDisplay() {
            if (this.eventBus) {
                this.eventBus.emit('ui:update-status');
            }
        }

        renderCutToTexture(cutId, container) {
            if (this.eventBus) {
                this.eventBus.emit('cut:render-to-texture', { cutId, container });
            }
        }

        destroy() {
            if (this.thumbnailUpdateTimer) {
                clearInterval(this.thumbnailUpdateTimer);
            }
            if (this.coordinateUnification) {
                this.coordinateUnification.destroy();
            }
            this.currentFrameContainer = null;
            this.layerTransform = null;
            this.coordinateUnification = null;
        }
    }

    window.TegakiLayerSystem = LayerSystem;

})();