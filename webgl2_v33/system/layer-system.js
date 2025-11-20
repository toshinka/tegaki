/**
 * @file layer-system.js - Phase 9: setCameraSystem親子関係確立版
 * @description レイヤー管理・操作の中核システム
 * 
 * 【Phase 9 改修内容】
 * ✅ setCameraSystem() メソッド改修（座標変換エラー解消）
 * ✅ currentFrameContainer → worldContainer 親子関係確立
 * ✅ verifyParentChain() デバッグメソッド追加
 * ✅ Phase 8完全継承（getLayerById実装継承）
 * 
 * 【親ファイル依存】
 * - event-bus.js (イベント通信)
 * - data-models.js (LayerModel定義)
 * - layer-transform.js (変形処理委譲)
 * - coordinate-system.js (座標変換)
 * - camera-system.js (worldContainer提供)
 * - config.js (設定値)
 * - history.js (Undo/Redo)
 * 
 * 【子ファイル依存このファイルに】
 * - layer-panel-renderer.js (UI描画 - EventBus経由のみ)
 * - keyboard-handler.js (ショートカット)
 * - thumbnail-update-manager.js (サムネイル更新)
 * - brush-core.js (描画系History登録の責任者)
 * - drawing-engine.js (activeLayer取得・座標変換)
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
            
            const layer1 = new PIXI.Container();
            const layer1Model = new window.TegakiDataModels.LayerModel({
                id: 'temp_layer_1_' + Date.now(),
                name: 'レイヤー1'
            });
            layer1.label = layer1Model.id;
            layer1.layerData = layer1Model;
            layer1.id = layer1Model.id;
            
            if (this.transform) {
                this.transform.setTransform(layer1Model.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
            }
            this.currentFrameContainer.addChild(layer1);
            this.activeLayerIndex = 1;
            
            this._setupLayerOperations();
            this._setupAnimationSystemIntegration();
            this._setupVKeyEvents();
            this._setupResizeEvents();
            
            this.isInitialized = true;
        }

        /**
         * ✅ Phase 8: レイヤーID検索メソッド（継承）
         */
        getLayerById(layerId) {
            if (!layerId) return null;
            
            const layers = this.getLayers();
            return layers.find(layer => {
                return layer.id === layerId || 
                       layer.label === layerId || 
                       layer.layerData?.id === layerId;
            }) || null;
        }

        _createSolidBackground(width, height, color = 0xf0e0d6) {
            const g = new PIXI.Graphics();
            g.rect(0, 0, width, height);
            g.fill({ color: color, alpha: 1.0 });
            g.label = 'backgroundFill';
            return g;
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

        getActiveLayerIndex() {
            return this.activeLayerIndex;
        }
        
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
            
            if (activeLayer.layerData?.isBackground) return;
            
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
            
            if (this.eventBus) {
                this.eventBus.emit('layer:stroke-added', { path, layerIndex, layerId: activeLayer.label });
                this.requestThumbnailUpdate(layerIndex);
            }
        }

        addPathToLayer(layerIndex, path) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
                const layer = layers[layerIndex];
                
                if (layer.layerData?.isBackground) return;
                
                layer.layerData.paths.push(path);
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
            if (activeLayer.layerData.isBackground) return;
            
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
            
            if (this.eventBus) {
                this.eventBus.emit('layer:updated', { layerId, transform });
                this.requestThumbnailUpdate(this.activeLayerIndex);
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
        
        getLayers() {
            return this.currentFrameContainer ? this.currentFrameContainer.children : [];
        }
        
        getActiveLayer() {
            const layers = this.getLayers();
            return this.activeLayerIndex >= 0 && this.activeLayerIndex < layers.length ? layers[this.activeLayerIndex] : null;
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

        _generateNextLayerName() {
            const layers = this.getLayers();
            const layerNames = layers
                .filter(l => l.layerData && !l.layerData.isBackground)
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

        toggleLayerVisibility(layerIndex) {
            const layers = this.getLayers();
            if (layerIndex >= 0 && layerIndex < layers.length) {
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

        /**
         * ================================================================================
         * 🔧 Phase 9: setApp() メソッド追加（core-engine連携用）
         * ================================================================================
         */
        setApp(app) {
            this.app = app;
            
            // appがセットされたら、まだ初期化されていないLayerTransformを初期化
            if (this.transform && !this.transform.app && this.cameraSystem) {
                this.initTransform();
            }
        }

        /**
         * ================================================================================
         * 🔧 Phase 9: setCameraSystem() 親子関係確立版
         * ================================================================================
         */
        setCameraSystem(cameraSystem) {
            this.cameraSystem = cameraSystem;
            
            // 🔧 Phase 9: currentFrameContainerをworldContainerの子として追加
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
            
            // 🔧 Phase 9: checkerPattern配置をworldContainer直下に修正
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

        /**
         * ================================================================================
         * 🔧 Phase 9: verifyParentChain() デバッグメソッド追加
         * ================================================================================
         */
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
        
        requestThumbnailUpdate(layerIndex) {
            if (this.eventBus) {
                const layer = this.getLayers()[layerIndex];
                this.eventBus.emit('thumbnail:layer-updated', {
                    layerIndex,
                    layerId: layer?.layerData?.id
                });
            }
        }
    }

    window.TegakiLayerSystem = LayerSystem;
    
    if (!window.layerSystem && !window.layerManager) {
        const instance = new LayerSystem();
        window.layerSystem = instance;
        window.layerManager = instance;
    }

})();

console.log('✅ layer-system.js Phase 9完成版 loaded');
console.log('   ✅ setCameraSystem() 親子関係確立実装');
console.log('   ✅ currentFrameContainer → worldContainer 確立');
console.log('   ✅ verifyParentChain() デバッグメソッド追加');
console.log('   ✅ Phase 8完全継承（getLayerById実装）');