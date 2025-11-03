// system/layer-system.js - Phase 2, 5, 6 完全実装版
// Phase 2: 背景チェックパターン実装（拡大リサイズ対応）
// Phase 5: 背景レイヤー色変更機能
// Phase 6: レイヤー透明度設定メソッド

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
            this.cameraSystem = null;
            this.animationSystem = null;
            this.coordAPI = window.CoordinateSystem;
            this.transform = null;
            this.isInitialized = false;
            
            this.checkerPattern = null;
        }

        init(canvasContainer, eventBus, config) {
            this.eventBus = eventBus;
            this.config = config || window.TEGAKI_CONFIG;
            if (!this.eventBus) throw new Error('EventBus required for LayerSystem');
            
            if (window.TegakiLayerTransform) {
                this.transform = new window.TegakiLayerTransform(this.config, this.coordAPI);
            } else {
                this.transform = null;
            }
            
            this.currentFrameContainer = new PIXI.Container();
            this.currentFrameContainer.label = 'temporary_frame_container';
            
            // Phase 2: 大きめのチェッカーパターン生成（拡大リサイズ対応）
            const patternSize = Math.max(this.config.canvas.width, this.config.canvas.height) * 4;
            this.checkerPattern = this._createCheckerPatternBackground(patternSize, patternSize);
            this.checkerPattern.visible = false;
            
            // 初期背景レイヤー作成
            const bgLayer = new PIXI.Container();
            const bgLayerModel = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_bg_' + Date.now(),
                name: '背景',
                isBackground: true
            });
            bgLayer.label = bgLayerModel.id;
            bgLayer.layerData = bgLayerModel;
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
            bg.fill({ color: this.config.background.color });
            bgLayer.addChild(bg);
            bgLayer.layerData.backgroundGraphics = bg;
            this.currentFrameContainer.addChild(bgLayer);
            
            // 初期レイヤー1作成
            const layer1 = new PIXI.Container();
            const layer1Model = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_1_' + Date.now(),
                name: 'レイヤー1'
            });
            layer1.label = layer1Model.id;
            layer1.layerData = layer1Model;
            if (this.transform) {
                this.transform.setTransform(layer1Model.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
            }
            this.currentFrameContainer.addChild(layer1);
            this.activeLayerIndex = 1;
            
            this._setupLayerOperations();
            this._setupAnimationSystemIntegration();
            this._setupVKeyEvents();
            this._setupTransformEventListeners();
            this._setupResizeListener();
            this.isInitialized = true;
        }

        // Phase 2: リサイズ監視
        _setupResizeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('camera:resized', ({ width, height }) => {
                this._resizeCheckerPattern(width, height);
            });
        }

        // Phase 2: チェッカーパターン生成
        _createCheckerPatternBackground(width, height) {
            const g = new PIXI.Graphics();
            const color1 = 0xf0e0d6;
            const color2 = 0xffffee;
            const squareSize = 16;
            
            // 大きめに生成（中央配置のため負の座標も含む）
            const startX = -width / 2;
            const startY = -height / 2;
            
            for (let y = startY; y < startY + height; y += squareSize) {
                for (let x = startX; x < startX + width; x += squareSize) {
                    const isEvenX = Math.floor((x - startX) / squareSize) % 2 === 0;
                    const isEvenY = Math.floor((y - startY) / squareSize) % 2 === 0;
                    const color = (isEvenX === isEvenY) ? color1 : color2;
                    g.rect(x, y, squareSize, squareSize);
                    g.fill({ color });
                }
            }
            
            g.label = 'checkerPattern';
            return g;
        }

        // Phase 2: チェッカーパターンリサイズ
        _resizeCheckerPattern(newWidth, newHeight) {
            if (!this.checkerPattern) return;
            
            const wasVisible = this.checkerPattern.visible;
            const parent = this.checkerPattern.parent;
            
            if (parent) {
                parent.removeChild(this.checkerPattern);
            }
            
            this.checkerPattern.destroy({ children: true });
            
            const patternSize = Math.max(newWidth, newHeight) * 4;
            this.checkerPattern = this._createCheckerPatternBackground(patternSize, patternSize);
            this.checkerPattern.visible = wasVisible;
            
            if (parent) {
                parent.addChildAt(this.checkerPattern, 0);
            }
            
            // 背景レイヤーが非表示の場合はチェッカーを表示
            const layers = this.getLayers();
            const bgLayer = layers.find(l => l.layerData?.isBackground);
            if (bgLayer && !bgLayer.layerData.visible) {
                this.checkerPattern.visible = true;
            }
        }

        // Phase 2: チェッカーパターンをワールドに配置
        attachCheckerPatternToWorld(canvasContainer) {
            if (!this.checkerPattern || !canvasContainer) return;
            canvasContainer.addChildAt(this.checkerPattern, 0);
        }

        // Phase 5: 背景レイヤー色変更
        changeBackgroundLayerColor(layerIndex, layerId) {
            const layers = this.getLayers();
            const layer = layers[layerIndex];
            
            if (!layer?.layerData?.isBackground) return;
            
            const color = window.brushSettings?.getColor() || 0xf0e0d6;
            
            const bg = layer.layerData.backgroundGraphics;
            if (bg) {
                bg.clear();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill({ color });
            }
            
            this.requestThumbnailUpdate(layerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:background-color-changed', {
                    layerIndex,
                    layerId,
                    color
                });
            }
        }

        // Phase 6: レイヤー透明度設定
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
            
            this.requestThumbnailUpdate(layerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('layer:opacity-changed', {
                    layerIndex,
                    layerId: layer.layerData?.id,
                    opacity
                });
            }
        }
        
        _setupVKeyEvents() {
            if (!this.eventBus) return;
            this.eventBus.on('keyboard:vkey-pressed', function() {
                if (!this.transform) return;
                if (!this.transform.app && this.app && this.cameraSystem) {
                    this.initTransform();
                }
                if (this.transform.isVKeyPressed) {
                    const activeLayer = this.getActiveLayer();
                    this.transform.exitMoveMode(activeLayer);
                } else {
                    this.transform.enterMoveMode();
                    const activeLayer = this.getActiveLayer();
                    if (activeLayer) {
                        this.transform.updateTransformPanelValues(activeLayer);
                    }
                }
            }.bind(this));
            this.eventBus.on('keyboard:vkey-released', function() {}.bind(this));
        }
        
        _setupTransformEventListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:transform-updated', ({ data }) => {
                const { layerIndex, layerId } = data || {};
                
                if (layerIndex !== undefined) {
                    this.requestThumbnailUpdate(layerIndex);
                } else if (layerId) {
                    const layers = this.getLayers();
                    const index = layers.findIndex(l => l.layerData?.id === layerId);
                    if (index >= 0) {
                        this.requestThumbnailUpdate(index);
                    }
                }
            });
        }
        
        initTransform() {
            if (!this.transform || !this.app) return;
            this.transform.init(this.app, this.cameraSystem);
            this.transform.onTransformComplete = (layer) => {
                this.requestThumbnailUpdate(this.getLayerIndex(layer));
                this.eventBus.emit('layer:transform-confirmed', {layerId: layer.layerData.id});
                if (this.animationSystem?.generateFrameThumbnail) {
                    const frameIndex = this.animationSystem.getCurrentFrameIndex();
                    setTimeout(() => {
                        this.animationSystem.generateFrameThumbnail(frameIndex);
                    }, 100);
                }
            };
            this.transform.onTransformUpdate = (layer, transform) => {
                if (!this.transform.isDragging) {
                    this.requestThumbnailUpdate(this.getLayerIndex(layer));
                }
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
            };
            this.transform.onFlipRequest = (direction) => {
                this.flipActiveLayer(direction);
            };
            this.transform.onDragRequest = (dx, dy, shiftKey) => {
                this._handleLayerDrag(dx, dy, shiftKey);
            };
            this.transform.onGetActiveLayer = () => {
                return this.getActiveLayer();
            };
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
        
        flipActiveLayer(direction) {
            if (!this.transform) return;
            const activeLayer = this.getActiveLayer();
            if (activeLayer) {
                this.transform.flipLayer(activeLayer, direction);
                this.requestThumbnailUpdate(this.activeLayerIndex);
                if (this.eventBus) {
                    this.eventBus.emit('layer:transform-updated', { 
                        layerId: activeLayer.layerData.id 
                    });
                }
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
                const rebuildSuccess = this.safeRebuildLayer(activeLayer, activeLayer.layerData.paths);
                if (rebuildSuccess && window.History && !window.History._manager.isApplying) {
                    const pathsAfter = structuredClone(activeLayer.layerData.paths);
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
            this.requestThumbnailUpdate(this.activeLayerIndex);
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
            }
        }

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
                layer.layerData.paths = [];
                let addedCount = 0;
                for (let i = 0; i < newPaths.length; i++) {
                    const path = newPaths[i];
                    try {
                        const rebuildSuccess = this.rebuildPathGraphics(path);
                        if (rebuildSuccess && path.graphics) {
                            if (layer.layerData && layer.layerData.maskSprite) {
                                path.graphics.mask = layer.layerData.maskSprite;
                            }
                            layer.layerData.paths.push(path);
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
                            this.updateLayerPanelUI();
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
                            this.updateLayerPanelUI();
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
                    this.updateLayerPanelUI();
                    if (this.eventBus) {
                        this.eventBus.emit('layer:reordered', { fromIndex, toIndex, activeIndex: this.activeLayerIndex, movedLayerId: movedLayer.layerData?.id });
                    }
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        setCurrentFrameContainer(frameContainer) {
            this.currentFrameContainer = frameContainer;
            const layers = this.getLayers();
            if (layers.length > 0) {
                this.activeLayerIndex = layers.length - 1;
            }
            this.updateLayerPanelUI();
            this.updateStatusDisplay();
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
        
        _setupAnimationSystemIntegration() {
            if (!this.eventBus) return;
            this.eventBus.on('animation:system-ready', () => {
                this._establishAnimationSystemConnection();
            });
            this.eventBus.on('animation:frame-applied', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
                    if (this.isLayerMoveMode) {
                        this.updateLayerTransformPanelValues();
                    }
                }, 100);
            });
            this.eventBus.on('animation:frame-created', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
                }, 100);
            });
            this.eventBus.on('animation:frame-deleted', () => {
                setTimeout(() => {
                    this.updateLayerPanelUI();
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
            document.addEventListener('keydown', (e) => {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                    return;
                }
                const keymap = window.TEGAKI_KEYMAP;
                if (!keymap) return;
                const context = { vMode: this.vKeyPressed };
                const action = keymap.getAction(e, context);
                if (!action) return;
                switch(action) {
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
                        this.updateLayerPanelUI();
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
                        this.updateLayerPanelUI();
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
                this.updateLayerPanelUI();
                if (this.eventBus) {
                    this.eventBus.emit('layer:hierarchy-moved', { direction, oldIndex: currentIndex, newIndex, layerId: activeLayer.layerData?.id });
                }
            }
        }

        createLayer(name, isBackground = false) {
            if (!this.currentFrameContainer) return null;
            
            const layers = this.getLayers();
            const nonBackgroundCount = layers.filter(l => !l.layerData?.isBackground).length;
            const layerName = name || (isBackground ? '背景' : `レイヤー${nonBackgroundCount + 1}`);
            
            const layerModel = new window.TegakiDataModels.LayerModel({
                name: layerName,
                isBackground: isBackground
            });
            
            const layer = new PIXI.Container();
            layer.label = layerModel.id;
            layer.layerData = layerModel;
            
            if (this.app && this.app.renderer) {
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
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, this.config.canvas.width, this.config.canvas.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            if (window.History && !window.History._manager.isApplying) {
                const entry = {
                    name: 'layer-create',
                    do: () => {
                        this.currentFrameContainer.addChild(layer);
                        const layers = this.getLayers();
                        this.setActiveLayer(layers.length - 1);
                        this.updateLayerPanelUI();
                        this.updateStatusDisplay();
                    },
                    undo: () => {
                        if (layer.layerData) {
                            layer.layerData.destroyMask();
                        }
                        this.currentFrameContainer.removeChild(layer);
                        const layers = this.getLayers();
                        if (this.activeLayerIndex >= layers.length) {
                            this.activeLayerIndex = Math.max(0, layers.length - 1);
                        }
                        this.updateLayerPanelUI();
                        this.updateStatusDisplay();
                    },
                    meta: { layerId: layerModel.id, name: layerModel.name }
                };
                window.History.push(entry);
            } else {
                this.currentFrameContainer.addChild(layer);
                const layers = this.getLayers();
                this.setActiveLayer(layers.length - 1);
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
            }
            if (this.eventBus) {
                this.eventBus.emit('layer:created', { layerId: layerModel.id, name: layerModel.name, isBackground });
            }
            const finalLayers = this.getLayers();
            return { layer, index: finalLayers.length - 1 };
        }
        
        setActiveLayer(index) {
            const layers = this.getLayers();
            if (index >= 0 && index < layers.length) {
                const oldIndex = this.activeLayerIndex;
                this.activeLayerIndex = index;
                this.updateLayerPanelUI();
                this.updateStatusDisplay();
                if (this.isLayerMoveMode) {
                    this.updateLayerTransformPanelValues();
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:activated', { layerIndex: index, oldIndex: oldIndex, layerId: layers[index]?.layerData?.id });
                }
            }
        }

        toggleLayerVisibility(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                layer.layerData.visible = !layer.layerData.visible;
                layer.visible = layer.layerData.visible;
                
                // Phase 2: 背景レイヤー非表示時にチェッカーパターン表示
                if (layer.layerData?.isBackground && this.checkerPattern) {
                    this.checkerPattern.visible = !layer.layerData.visible;
                }
                
                this.updateLayerPanelUI();
                this.requestThumbnailUpdate(layerIndex);
                if (this.eventBus) {
                    this.eventBus.emit('layer:visibility-changed', { layerIndex, visible: layer.layerData.visible, layerId: layer.layerData.id });
                }
            }
        }

        insertClipboard(data) {
            if (this.eventBus) {
                this.eventBus.emit('layer:clipboard-inserted', data);
            }
        }

        requestThumbnailUpdate(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex < 0 || layerIndex >= layers.length) return;
            
            const layer = layers[layerIndex];
            const layerId = layer.layerData?.id;
            
            if (this.eventBus) {
                this.eventBus.emit('thumbnail:layer-updated', {
                    layerIndex, 
                    layerId,
                    immediate: false 
                });
            }
        }

        updateLayerPanelUI() {
            if (this.eventBus) {
                this.eventBus.emit('layer:panel-update-requested', {
                    layers: this.getLayers(),
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        updateStatusDisplay() {
            const statusElement = document.getElementById('current-layer');
            const layers = this.getLayers();
            if (statusElement && this.activeLayerIndex >= 0) {
                const layer = layers[this.activeLayerIndex];
                statusElement.textContent = layer.layerData.name;
            }
            if (this.eventBus) {
                this.eventBus.emit('ui:status-updated', {
                    currentLayer: this.activeLayerIndex >= 0 ? layers[this.activeLayerIndex].layerData.name : 'なし',
                    layerCount: layers.length,
                    activeIndex: this.activeLayerIndex
                });
            }
        }

        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            if (this.transform && this.app && !this.transform.app) {
                this.initTransform();
            }
        }

        setApp(app) {
            this.app = app;
            if (this.transform && !this.transform.app) {
                if (this.cameraSystem) {
                    this.initTransform();
                }
            }
            
            if (app && app.renderer) {
                const layers = this.getLayers();
                for (const layer of layers) {
                    if (layer.layerData && !layer.layerData.hasMask()) {
                        const success = layer.layerData.initializeMask(
                            this.config.canvas.width,
                            this.config.canvas.height,
                            app.renderer
                        );
                        if (success && layer.layerData.maskSprite) {
                            layer.addChildAt(layer.layerData.maskSprite, 0);
                            this._applyMaskToLayerGraphics(layer);
                        }
                    }
                }
            }
        }

        setAnimationSystem(animationSystem) {
            this.animationSystem = animationSystem;
            if (animationSystem && animationSystem.layerSystem !== this) {
                animationSystem.layerSystem = this;
            }
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
            try {
                const previousActiveIndex = this.activeLayerIndex;
                if (window.History && !window.History._manager.isApplying) {
                    const entry = {
                        name: 'layer-delete',
                        do: () => {
                            if (layer.layerData) {
                                layer.layerData.destroyMask();
                            }
                            this.currentFrameContainer.removeChild(layer);
                            if (layerId && this.transform) {
                                this.transform.deleteTransform(layerId);
                            }
                            const remainingLayers = this.getLayers();
                            if (remainingLayers.length === 0) {
                                this.activeLayerIndex = -1;
                            } else if (this.activeLayerIndex >= remainingLayers.length) {
                                this.activeLayerIndex = remainingLayers.length - 1;
                            }
                            this.updateLayerPanelUI();
                            this.updateStatusDisplay();
                            if (this.eventBus) {
                                this.eventBus.emit('layer:deleted', { layerId, layerIndex });
                            }
                        },
                        undo: () => {
                            if (layer.layerData && this.app && this.app.renderer) {
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
                            this.currentFrameContainer.addChildAt(layer, layerIndex);
                            this.activeLayerIndex = previousActiveIndex;
                            this.updateLayerPanelUI();
                            this.updateStatusDisplay();
                        },
                        meta: { layerId, layerIndex }
                    };
                    window.History.push(entry);
                } else {
                    if (layer.layerData) {
                        layer.layerData.destroyMask();
                    }
                    this.currentFrameContainer.removeChild(layer);
                    if (layerId && this.transform) {
                        this.transform.deleteTransform(layerId);
                    }
                    const remainingLayers = this.getLayers();
                    if (remainingLayers.length === 0) {
                        this.activeLayerIndex = -1;
                    } else if (this.activeLayerIndex >= remainingLayers.length) {
                        this.activeLayerIndex = remainingLayers.length - 1;
                    }
                    this.updateLayerPanelUI();
                    this.updateStatusDisplay();
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

        processThumbnailUpdates() {
            if (window.ThumbnailSystem && window.ThumbnailSystem.processPendingUpdates) {
                window.ThumbnailSystem.processPendingUpdates();
            }
        }
    }

    window.TegakiLayerSystem = LayerSystem;
    window.layerManager = null;

})();

console.log('✅ layer-system.js (Phase 2, 5, 6 完全実装版) loaded');