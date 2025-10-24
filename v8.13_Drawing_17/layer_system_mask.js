// ===== system/layer-system.js - マスク統合完了版 =====

(function() {
    'use strict';

    class LayerSystem {
        constructor() {
            this.app = null;
            this.config = null;
            this.eventBus = null;
            this.currentCutContainer = null;
            this.activeLayerIndex = -1;
            this.cutRenderTextures = new Map();
            this.cutThumbnailDirty = new Map();
            this.thumbnailUpdateQueue = new Set();
            this.thumbnailUpdateTimer = null;
            this.cameraSystem = null;
            this.animationSystem = null;
            this.coordAPI = window.CoordinateSystem;
            this.transform = null;
            this.isInitialized = false;
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
            
            this.currentCutContainer = new PIXI.Container();
            this.currentCutContainer.label = 'temporary_cut_container';
            
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
            this.currentCutContainer.addChild(bgLayer);
            
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
            this.currentCutContainer.addChild(layer1);
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
        
        initTransform() {
            if (!this.transform || !this.app) return;
            this.transform.init(this.app, this.cameraSystem);
            this.transform.onTransformComplete = (layer) => {
                this.requestThumbnailUpdate(this.getLayerIndex(layer));
                this.eventBus.emit('layer:transform-confirmed', {layerId: layer.layerData.id});
                if (this.animationSystem?.generateCutThumbnail) {
                    const cutIndex = this.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.animationSystem.generateCutThumbnail(cutIndex);
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
                if (this.animationSystem?.generateCutThumbnail) {
                    const cutIndex = this.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.animationSystem.generateCutThumbnail(cutIndex);
                    }, 100);
                }
                if (this.eventBus) {
                    this.eventBus.emit('layer:path-added', { layerIndex, pathId: path.id, layerId: layer.layerData.id });
                }
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
                let