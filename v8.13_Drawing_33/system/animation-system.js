// ================================================================================
// system/animation-system.js - Phase 1改修版
// ================================================================================
// 【Phase 1改修】フレーム名表記をFRAMEx → xF形式に統一
// - renameFramesSequentially(): FRAME形式 → xF形式
// - createNewBlankFrame(): 初期名表記を修正
// - createInitialFrameIfNeeded(): 初期フレーム名を修正
// - CUT→FRAME変換完了状態を継承

(function() {
    'use strict';
    
    class Frame {
        constructor(id, name, config) {
            this.id = id;
            this.name = name || `${Date.now()}F`;
            this.duration = config?.animation?.defaultCutDuration || 0.5;
            
            this.container = new PIXI.Container();
            this.container.label = `frame_${id}`;
            this.container.sortableChildren = true;
            
            this.thumbnailCanvas = null;
            this.createdAt = Date.now();
            this.config = config;
        }
        
        getLayers() {
            return this.container.children;
        }
        
        addLayer(layer) {
            this.container.addChild(layer);
            return layer;
        }
        
        removeLayer(layer) {
            if (layer.parent === this.container) {
                this.container.removeChild(layer);
            }
        }
        
        getLayer(index) {
            return this.container.children[index] || null;
        }
        
        getLayerCount() {
            return this.container.children.length;
        }
        
        serialize() {
            return {
                id: this.id,
                name: this.name,
                duration: this.duration,
                layers: this.container.children.map(layer => this._serializeLayer(layer))
            };
        }
        
        _serializeLayer(layer) {
            return {
                id: layer.layerData?.id || layer.label,
                name: layer.layerData?.name || 'Layer',
                visible: layer.visible,
                opacity: layer.alpha,
                isBackground: layer.layerData?.isBackground || false,
                transform: {
                    x: layer.position.x,
                    y: layer.position.y,
                    rotation: layer.rotation,
                    scaleX: layer.scale.x,
                    scaleY: layer.scale.y,
                    pivotX: layer.pivot.x,
                    pivotY: layer.pivot.y
                },
                paths: layer.layerData?.paths ? layer.layerData.paths.map(path => ({
                    id: path.id,
                    points: path.points.map(p => ({ x: p.x, y: p.y })),
                    size: path.size,
                    color: path.color,
                    opacity: path.opacity,
                    tool: path.tool
                })) : []
            };
        }
        
        static deserialize(data, config) {
            const frame = new Frame(data.id, data.name, config);
            frame.duration = data.duration;
            
            if (data.layers && Array.isArray(data.layers)) {
                data.layers.forEach(layerData => {
                    const layer = frame._deserializeLayer(layerData);
                    if (layer) {
                        frame.addLayer(layer);
                    }
                });
            }
            
            return frame;
        }
        
        _deserializeLayer(layerData) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            
            const layerModel = new window.TegakiDataModels.LayerModel({
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false
            });
            layerModel.paths = [];
            
            layer.layerData = layerModel;
            
            if (layerData.transform) {
                layer.position.set(layerData.transform.x || 0, layerData.transform.y || 0);
                layer.rotation = layerData.transform.rotation || 0;
                layer.scale.set(layerData.transform.scaleX || 1, layerData.transform.scaleY || 1);
                layer.pivot.set(layerData.transform.pivotX || 0, layerData.transform.pivotY || 0);
            }
            
            layer.visible = layerData.visible !== false;
            layer.alpha = layerData.opacity || 1.0;
            
            if (layerData.isBackground) {
                const bg = new PIXI.Graphics();
                const canvasWidth = this.config?.canvas?.width || 800;
                const canvasHeight = this.config?.canvas?.height || 600;
                const bgColor = this.config?.background?.color || 0xF0E0D6;
                
                bg.rect(0, 0, canvasWidth, canvasHeight);
                bg.fill(bgColor);
                layer.addChild(bg);
                layerModel.backgroundGraphics = bg;
            }
            
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const path = this._rebuildPath(pathData);
                    if (path) {
                        layerModel.paths.push(path);
                        layer.addChild(path.graphics);
                    }
                });
            }
            
            return layer;
        }
        
        _rebuildPath(pathData) {
            if (!pathData?.points || pathData.points.length === 0) return null;
            
            const graphics = new PIXI.Graphics();
            
            pathData.points.forEach(point => {
                if (typeof point.x === 'number' && typeof point.y === 'number' &&
                    isFinite(point.x) && isFinite(point.y)) {
                    graphics.circle(point.x, point.y, (pathData.size || 16) / 2);
                    graphics.fill({
                        color: pathData.color || 0x800000,
                        alpha: pathData.opacity || 1.0
                    });
                }
            });
            
            return {
                id: pathData.id,
                points: pathData.points.map(p => ({ x: p.x, y: p.y })),
                size: pathData.size || 16,
                color: pathData.color || 0x800000,
                opacity: pathData.opacity || 1.0,
                tool: pathData.tool || 'pen',
                graphics: graphics
            };
        }
    }
    
    class AnimationSystem {
        constructor() {
            this.animationData = this.createDefaultAnimation();
            this.layerSystem = null;
            this.cameraSystem = null;
            this.app = null;
            this.stage = null;
            this.canvasContainer = null;
            this.eventBus = window.TegakiEventBus;
            this.config = window.TEGAKI_CONFIG;
            
            this.playbackTimer = null;
            this.isAnimationMode = false;
            this.initialFrameCreated = false;
            this.isInitializing = false;
            this.frameSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedFrameIndex = 0;
            
            this.frameClipboard = {
                frameData: null,
                timestamp: null,
                sourceId: null
            };
            
            this.coordAPI = window.CoordinateSystem;
            
            this.setupCanvasResizeListener();
        }
        
        setupCanvasResizeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('camera:resized', (data) => {
                this.handleCanvasResize(data.width, data.height);
            });
        }
        
handleCanvasResize(newWidth, newHeight) {
    if (!this.animationData?.frames || this.animationData.frames.length === 0) return;
    
    // ★ Phase 2修正: リサイズ時に全フレームの古いテクスチャを削除
    this.animationData.frames.forEach(frame => {
        if (this.layerSystem?.destroyFrameRenderTexture) {
            this.layerSystem.destroyFrameRenderTexture(frame.id);
        }
    });
    
    // ★ その後、新しいサイズで再生成
    setTimeout(() => {
        this.regenerateAllThumbnails();
    }, 200);
    
    if (this.eventBus) {
        this.eventBus.emit('animation:thumbnails-need-update');
    }
}
        
        async regenerateAllThumbnails() {
            if (!this.animationData?.frames) return;
            
            for (let i = 0; i < this.animationData.frames.length; i++) {
                await this.generateFrameThumbnail(i);
                
                if (i < this.animationData.frames.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
        
        init(layerSystem, app, cameraSystem) {
            if (this.hasInitialized) return;
            
            this.layerSystem = layerSystem;
            this.app = app;
            this.stage = app?.stage;
            this.cameraSystem = cameraSystem;
            
            if (!this.cameraSystem?.canvasContainer) return;
            
            this.canvasContainer = this.cameraSystem.canvasContainer;
            
            if (!this.eventBus || !this.layerSystem) return;
            
            this.layerSystem.animationSystem = this;
            
            if (this.canvasContainer && this.layerSystem.currentFrameContainer) {
                this.canvasContainer.addChild(this.layerSystem.currentFrameContainer);
            }
            
            this.setupFrameClipboardEvents();
            this.setupLayerChangeListener();
            this.hasInitialized = true;
            
            setTimeout(() => {
                if (!this.initialFrameCreated && !this.isInitializing) {
                    this.createInitialFrameIfNeeded();
                }
            }, 150);
            
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:system-ready');
                    this.eventBus.emit('animation:initialized');
                }
            }, 200);
        }
        
        setupLayerChangeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:path-added', () => {
                const currentFrame = this.getCurrentFrame();
                if (currentFrame) {
                    setTimeout(() => {
                        this.generateFrameThumbnail(this.getCurrentFrameIndex());
                    }, 100);
                }
            });
        }
        
        setupFrameClipboardEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('frame:copy-current', () => this.copyCurrent());
            this.eventBus.on('frame:paste-right-adjacent', () => this.pasteRightAdjacent());
            this.eventBus.on('frame:paste-new', () => this.pasteAsNew());
        }
        
        createDefaultAnimation() {
            return {
                frames: [],
                settings: {
                    loop: true
                },
                playback: {
                    isPlaying: false,
                    currentFrameIndex: 0,
                    startTime: 0
                }
            };
        }
        
        getCurrentCanvasSize() {
            if (this.layerSystem?.config?.canvas) {
                return {
                    width: this.layerSystem.config.canvas.width,
                    height: this.layerSystem.config.canvas.height
                };
            }
            
            return {
                width: this.config?.canvas?.width || 800,
                height: this.config?.canvas?.height || 600
            };
        }
        
        calculateThumbnailSize(canvasWidth, canvasHeight) {
            const aspectRatio = canvasWidth / canvasHeight;
            
            const MAX_THUMB_WIDTH = 72;
            const MAX_THUMB_HEIGHT = 54;
            
            let thumbDisplayW, thumbDisplayH;
            
            if (aspectRatio >= MAX_THUMB_WIDTH / MAX_THUMB_HEIGHT) {
                thumbDisplayW = MAX_THUMB_WIDTH;
                thumbDisplayH = Math.round(MAX_THUMB_WIDTH / aspectRatio);
            } else {
                thumbDisplayH = MAX_THUMB_HEIGHT;
                thumbDisplayW = Math.round(MAX_THUMB_HEIGHT * aspectRatio);
            }
            
            return { thumbDisplayW, thumbDisplayH };
        }
        
        createNewFrameFromCurrentLayers() {
            const frameId = 'frame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const frame = new Frame(frameId, `${this.animationData.frames.length + 1}F`, this.config);
            
            if (this.layerSystem?.currentFrameContainer) {
                const currentLayers = this.layerSystem.currentFrameContainer.children;
                
                currentLayers.forEach(originalLayer => {
                    const copiedLayer = this._deepCopyLayer(originalLayer);
                    frame.addLayer(copiedLayer);
                });
            }
            
            this.animationData.frames.push(frame);
            const newFrameIndex = this.animationData.frames.length - 1;
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(frame.container);
                frame.container.visible = false;
            }
            
            if (this.layerSystem?.createFrameRenderTexture) {
                this.layerSystem.createFrameRenderTexture(frameId);
            }
            
            this.switchToActiveFrame(newFrameIndex);
            
            setTimeout(async () => {
                await this.generateFrameThumbnail(newFrameIndex);
                if (this.eventBus) {
                    this.eventBus.emit('animation:frame-created', { 
                        frameId: frame.id, 
                        frameIndex: newFrameIndex 
                    });
                }
            }, 100);
            
            return frame;
        }
        
        createNewBlankFrame() {
            const frameId = 'frame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const frame = new Frame(frameId, `TEMP_${frameId}`, this.config);
            
            const bgLayer = this._createBackgroundLayer(frameId);
            const layer1 = this._createBlankLayer(frameId, 'レイヤー1');
            
            frame.addLayer(bgLayer);
            frame.addLayer(layer1);
            
            const newIndex = this.animationData.frames.length;
            
            if (window.History && !window.History._manager.isApplying) {
                const command = {
                    name: 'create-frame',
                    do: () => {
                        this.animationData.frames.push(frame);
                        this.renameFramesSequentially();
                        
                        if (this.canvasContainer) {
                            this.canvasContainer.addChild(frame.container);
                            frame.container.visible = false;
                        }
                        
                        if (this.layerSystem?.createFrameRenderTexture) {
                            this.layerSystem.createFrameRenderTexture(frameId);
                        }
                        
                        this.switchToActiveFrame(newIndex);
                        
                        if (this.eventBus) {
                            this.eventBus.emit('animation:frame-created', { 
                                frameId: frame.id, 
                                frameIndex: newIndex 
                            });
                        }
                    },
                    undo: () => {
                        const frameIndex = this.animationData.frames.findIndex(f => f.id === frameId);
                        if (frameIndex !== -1) {
                            const removedFrame = this.animationData.frames[frameIndex];
                            
                            if (this.layerSystem?.destroyFrameRenderTexture) {
                                this.layerSystem.destroyFrameRenderTexture(removedFrame.id);
                            }
                            
                            if (this.canvasContainer && removedFrame.container.parent === this.canvasContainer) {
                                this.canvasContainer.removeChild(removedFrame.container);
                            }
                            
                            this.animationData.frames.splice(frameIndex, 1);
                            this.renameFramesSequentially();
                            
                            if (this.animationData.frames.length > 0) {
                                const newActiveIndex = Math.min(frameIndex, this.animationData.frames.length - 1);
                                this.switchToActiveFrame(newActiveIndex);
                            }
                            
                            if (this.eventBus) {
                                this.eventBus.emit('animation:frame-deleted', { frameIndex });
                            }
                        }
                    },
                    meta: { type: 'frame-create', frameId, frameIndex: newIndex }
                };
                
                window.History.push(command);
            } else {
                this.animationData.frames.push(frame);
                this.renameFramesSequentially();
                
                if (this.canvasContainer) {
                    this.canvasContainer.addChild(frame.container);
                    frame.container.visible = false;
                }
                
                if (this.layerSystem?.createFrameRenderTexture) {
                    this.layerSystem.createFrameRenderTexture(frameId);
                }
                
                this.switchToActiveFrame(newIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:frame-created', { 
                        frameId: frame.id, 
                        frameIndex: newIndex 
                    });
                }
            }
            
            return frame;
        }
        
        createNewEmptyFrame() {
            return this.createNewBlankFrame();
        }
        
        _createBackgroundLayer(frameId) {
            const layer = new PIXI.Container();
            const layerModel = new window.TegakiDataModels.LayerModel({
                id: `${frameId}_layer_bg_${Date.now()}`,
                name: '背景',
                visible: true,
                opacity: 1.0,
                isBackground: true
            });
            layerModel.paths = [];
            
            layer.label = layerModel.id;
            layer.layerData = layerModel;
            
            const canvasSize = this.getCurrentCanvasSize();
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, canvasSize.width, canvasSize.height);
            bg.fill(this.config.background.color);
            layer.addChild(bg);
            layerModel.backgroundGraphics = bg;
            
            return layer;
        }
        
        _createBlankLayer(frameId, name) {
            const layer = new PIXI.Container();
            const layerModel = new window.TegakiDataModels.LayerModel({
                id: `${frameId}_layer_${Date.now()}`,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: false
            });
            layerModel.paths = [];
            
            layer.label = layerModel.id;
            layer.layerData = layerModel;
            
            return layer;
        }
        
        _deepCopyLayer(originalLayer) {
            const layer = new PIXI.Container();
            const layerModel = new window.TegakiDataModels.LayerModel({
                id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: originalLayer.layerData?.name || 'Layer',
                visible: originalLayer.visible,
                opacity: originalLayer.alpha,
                isBackground: originalLayer.layerData?.isBackground || false
            });
            layerModel.paths = [];
            
            layer.label = layerModel.id;
            layer.layerData = layerModel;
            
            layer.position.set(originalLayer.position.x, originalLayer.position.y);
            layer.rotation = originalLayer.rotation;
            layer.scale.set(originalLayer.scale.x, originalLayer.scale.y);
            layer.pivot.set(originalLayer.pivot.x, originalLayer.pivot.y);
            layer.visible = originalLayer.visible;
            layer.alpha = originalLayer.alpha;
            
            if (originalLayer.layerData?.isBackground) {
                const canvasSize = this.getCurrentCanvasSize();
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, canvasSize.width, canvasSize.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layerModel.backgroundGraphics = bg;
            }
            
            if (originalLayer.layerData?.paths && Array.isArray(originalLayer.layerData.paths)) {
                originalLayer.layerData.paths.forEach(originalPath => {
                    const copiedPath = this._deepCopyPath(originalPath);
                    if (copiedPath) {
                        layerModel.paths.push(copiedPath);
                        layer.addChild(copiedPath.graphics);
                    }
                });
            }
            
            return layer;
        }
        
        _deepCopyPath(originalPath) {
            if (!originalPath?.points || originalPath.points.length === 0) return null;
            
            const graphics = new PIXI.Graphics();
            
            const copiedPoints = originalPath.points.map(p => ({ x: p.x, y: p.y }));
            
            copiedPoints.forEach(point => {
                graphics.circle(point.x, point.y, (originalPath.size || 16) / 2);
                graphics.fill({
                    color: originalPath.color || 0x800000,
                    alpha: originalPath.opacity || 1.0
                });
            });
            
            return {
                id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                points: copiedPoints,
                size: originalPath.size || 16,
                color: originalPath.color || 0x800000,
                opacity: originalPath.opacity || 1.0,
                tool: originalPath.tool || 'pen',
                graphics: graphics
            };
        }
        
        captureAllLayerStates() {
            if (!this.layerSystem) {
                throw new Error('AnimationSystem: layerSystem is not assigned');
            }
            const layers = this.layerSystem.getLayers();
            return layers.map(layer => ({
                layerId: layer.layerData?.id ?? null,
                visible: !!layer.visible,
                alpha: typeof layer.alpha === 'number' ? layer.alpha : (layer.layerData?.opacity ?? 1.0),
                x: layer.x ?? 0,
                y: layer.y ?? 0,
                scaleX: layer.scale?.x ?? 1,
                scaleY: layer.scale?.y ?? 1,
                rotation: layer.rotation ?? 0
            }));
        }
        
        restoreFromSnapshots(snapshots) {
            if (!this.layerSystem) {
                throw new Error('AnimationSystem: layerSystem is not assigned');
            }
            const layers = this.layerSystem.getLayers();
            snapshots.forEach((snap, index) => {
                const layer = layers.find(l => (l.layerData?.id ?? null) === snap.layerId) || layers[index];
                if (!layer) return;
                if (typeof snap.visible === 'boolean') layer.visible = snap.visible;
                if (typeof snap.alpha === 'number') layer.alpha = snap.alpha;
                if (typeof snap.x === 'number') layer.x = snap.x;
                if (typeof snap.y === 'number') layer.y = snap.y;
                if (typeof snap.scaleX === 'number') layer.scale.x = snap.scaleX;
                if (typeof snap.scaleY === 'number') layer.scale.y = snap.scaleY;
                if (typeof snap.rotation === 'number') layer.rotation = snap.rotation;
            });
        }
        
        applyFrameToLayers(frameIndex) {
            const frame = this.animationData.frames[frameIndex];
            if (!frame) {
                throw new Error(`AnimationSystem: frame ${frameIndex} not found`);
            }
            this.switchToActiveFrame(frameIndex);
        }
        
        switchToActiveFrame(frameIndex) {
            if (this.frameSwitchInProgress) {
                setTimeout(() => this.switchToActiveFrame(frameIndex), 50);
                return;
            }
            
            const targetFrame = this.animationData.frames[frameIndex];
            if (!targetFrame || !this.layerSystem) return;
            
            this.frameSwitchInProgress = true;
            
            this.animationData.frames.forEach(frame => {
                frame.container.visible = false;
            });
            
            targetFrame.container.visible = true;
            
            this.layerSystem.setCurrentFrameContainer(targetFrame.container);
            
            if (this.app && this.app.renderer) {
                setTimeout(() => {
                    this._ensureMasksInitialized(targetFrame.container);
                }, 50);
            }
            
            this.animationData.playback.currentFrameIndex = frameIndex;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-applied', { frameIndex, frameId: targetFrame.id });
            }
            
            this.frameSwitchInProgress = false;
        }
        
        _ensureMasksInitialized(container) {
            if (!container || !this.app?.renderer || !this.config) return;
            
            const layers = container.children;
            for (const layer of layers) {
                if (!layer.layerData) continue;
                
                if (!(layer.layerData instanceof window.TegakiDataModels.LayerModel)) continue;
                
                if (!layer.layerData.hasMask()) {
                    const success = layer.layerData.initializeMask(
                        this.config.canvas.width,
                        this.config.canvas.height,
                        this.app.renderer
                    );
                    
                    if (success && layer.layerData.maskSprite) {
                        layer.addChildAt(layer.layerData.maskSprite, 0);
                        this._applyMaskToLayerGraphics(layer);
                    }
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
        
        switchToActiveFrameSafely(frameIndex, resetTransform) {
            this.switchToActiveFrame(frameIndex);
        }
        
        async generateFrameThumbnail(frameIndex) {
            const frame = this.animationData.frames[frameIndex];
            if (!frame || !this.layerSystem || !this.app?.renderer) return;
            
            if (this.layerSystem.renderFrameToTexture) {
                this.layerSystem.renderFrameToTexture(frame.id, frame.container);
            }
            
            const renderTexture = this.layerSystem?.getFrameRenderTexture?.(frame.id);
            if (!renderTexture) return;
            
            const canvasSize = this.getCurrentCanvasSize();
            
            const { thumbDisplayW, thumbDisplayH } = this.calculateThumbnailSize(
                canvasSize.width, 
                canvasSize.height
            );
            
            if (window.TegakiThumbnailUtils?.resizeCanvasWithAspect) {
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                
                const thumbCanvas = window.TegakiThumbnailUtils.resizeCanvasWithAspect(
                    sourceCanvas, 
                    thumbDisplayW, 
                    thumbDisplayH
                );
                
                frame.thumbnailCanvas = thumbCanvas;
            } else {
                const sourceCanvas = this.app.renderer.extract.canvas(renderTexture);
                
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = thumbDisplayW;
                thumbCanvas.height = thumbDisplayH;
                
                const ctx = thumbCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                const srcAspect = sourceCanvas.width / sourceCanvas.height;
                const dstAspect = thumbDisplayW / thumbDisplayH;
                
                let drawW, drawH, offsetX = 0, offsetY = 0;
                
                if (srcAspect > dstAspect) {
                    drawW = thumbDisplayW;
                    drawH = thumbDisplayW / srcAspect;
                    offsetY = (thumbDisplayH - drawH) / 2;
                } else {
                    drawH = thumbDisplayH;
                    drawW = thumbDisplayH * srcAspect;
                    offsetX = (thumbDisplayW - drawW) / 2;
                }
                
                ctx.clearRect(0, 0, thumbDisplayW, thumbDisplayH);
                ctx.drawImage(
                    sourceCanvas, 
                    0, 0, sourceCanvas.width, sourceCanvas.height,
                    offsetX, offsetY, drawW, drawH
                );
                
                frame.thumbnailCanvas = thumbCanvas;
            }
            
            if (this.layerSystem.clearFrameThumbnailDirty) {
                this.layerSystem.clearFrameThumbnailDirty(frame.id);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:thumbnail-generated', { 
                    frameIndex,
                    thumbSize: { width: thumbDisplayW, height: thumbDisplayH }
                });
            }
        }
        
        async generateFrameThumbnailOptimized(frameIndex) {
            return this.generateFrameThumbnail(frameIndex);
        }
        
        copyCurrent() {
            const currentFrame = this.getCurrentFrame();
            if (!currentFrame) return false;
            
            this.frameClipboard.frameData = currentFrame.serialize();
            this.frameClipboard.timestamp = Date.now();
            this.frameClipboard.sourceId = currentFrame.id;
            
            if (this.eventBus) {
                this.eventBus.emit('frame:copied', {
                    frameId: currentFrame.id,
                    frameName: currentFrame.name
                });
            }
            
            return true;
        }
        
        pasteRightAdjacent() {
            if (!this.frameClipboard.frameData) return false;
            
            const insertIndex = this.animationData.playback.currentFrameIndex + 1;
            const pastedFrame = this.createFrameFromClipboard(this.frameClipboard.frameData);
            if (!pastedFrame) return false;
            
            this.animationData.frames.splice(insertIndex, 0, pastedFrame);
            this.renameFramesSequentially();
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(pastedFrame.container);
            }
            
            if (this.layerSystem?.createFrameRenderTexture) {
                this.layerSystem.createFrameRenderTexture(pastedFrame.id);
            }
            
            this.switchToActiveFrame(insertIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('frame:pasted-right-adjacent', {
                    frameId: pastedFrame.id,
                    frameIndex: insertIndex
                });
            }
            
            return true;
        }
        
        pasteAsNew() {
            if (!this.frameClipboard.frameData) return false;
            
            const pastedFrame = this.createFrameFromClipboard(this.frameClipboard.frameData);
            if (!pastedFrame) return false;
            
            this.animationData.frames.push(pastedFrame);
            const newIndex = this.animationData.frames.length - 1;
            
            this.renameFramesSequentially();
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(pastedFrame.container);
            }
            
            if (this.layerSystem?.createFrameRenderTexture) {
                this.layerSystem.createFrameRenderTexture(pastedFrame.id);
            }
            
            this.switchToActiveFrame(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('frame:pasted-new', {
                    frameId: pastedFrame.id,
                    frameIndex: newIndex
                });
            }
            
            return true;
        }
        
        createFrameFromClipboard(clipboardData) {
            if (!clipboardData) return null;
            
            const baseName = clipboardData.name.replace(/\(\d+\)$/, '');
            
            let copyCount = 0;
            for (const frame of this.animationData.frames) {
                const frameBaseName = frame.name.replace(/\(\d+\)$/, '');
                if (frameBaseName === baseName) {
                    const match = frame.name.match(/\((\d+)\)$/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > copyCount) copyCount = num;
                    }
                }
            }
            
            const newName = `${baseName}(${copyCount + 1})`;
            
            const frameId = 'frame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const frame = Frame.deserialize({
                id: frameId,
                name: newName,
                duration: clipboardData.duration,
                layers: clipboardData.layers
            }, this.config);
            
            setTimeout(() => {
                const frameIndex = this.animationData.frames.findIndex(f => f.id === frame.id);
                if (frameIndex !== -1) {
                    this.generateFrameThumbnail(frameIndex);
                }
            }, 200);
            
            return frame;
        }
        
        createInitialFrameIfNeeded() {
            if (this.initialFrameCreated || this.animationData.frames.length > 0 || this.isInitializing) {
                return;
            }
            
            if (!this.layerSystem?.currentFrameContainer) {
                return;
            }
            
            this.isInitializing = true;
            
            const frameId = 'frame_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const frame = new Frame(frameId, '1F', this.config);
            
            const tempLayers = this.layerSystem.currentFrameContainer.children.slice();
            tempLayers.forEach(tempLayer => {
                const copiedLayer = this._deepCopyLayer(tempLayer);
                frame.addLayer(copiedLayer);
            });
            
            this.animationData.frames.push(frame);
            
            if (this.canvasContainer) {
                if (this.layerSystem.currentFrameContainer.parent === this.canvasContainer) {
                    this.canvasContainer.removeChild(this.layerSystem.currentFrameContainer);
                }
                
                this.canvasContainer.addChild(frame.container);
                frame.container.visible = true;
            }
            
            if (this.layerSystem.createFrameRenderTexture) {
                this.layerSystem.createFrameRenderTexture(frameId);
            }
            
            this.layerSystem.setCurrentFrameContainer(frame.container);
            
            this.animationData.playback.currentFrameIndex = 0;
            this.initialFrameCreated = true;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:initial-frame-created', { 
                    frameId: frame.id,
                    frameIndex: 0
                });
            }
            
            setTimeout(() => {
                this.generateFrameThumbnail(0);
            }, 200);
            
            this.isInitializing = false;
        }
        
        deleteFrame(frameIndex) {
            if (frameIndex < 0 || frameIndex >= this.animationData.frames.length) return false;
            if (this.animationData.frames.length <= 1) return false;
            
            const frame = this.animationData.frames[frameIndex];
            const frameSnapshot = frame.serialize();
            const oldCurrentIndex = this.animationData.playback.currentFrameIndex;
            
            if (window.History && !window.History._manager.isApplying) {
                const command = {
                    name: 'delete-frame',
                    do: () => {
                        if (this.layerSystem?.destroyFrameRenderTexture) {
                            this.layerSystem.destroyFrameRenderTexture(frame.id);
                        }
                        
                        if (this.canvasContainer && frame.container.parent === this.canvasContainer) {
                            this.canvasContainer.removeChild(frame.container);
                        }
                        
                        this.animationData.frames.splice(frameIndex, 1);
                        this.renameFramesSequentially();
                        
                        if (this.animationData.playback.currentFrameIndex >= frameIndex) {
                            this.animationData.playback.currentFrameIndex = Math.max(0, 
                                this.animationData.playback.currentFrameIndex - 1
                            );
                        }
                        
                        if (this.animationData.frames.length > 0) {
                            const newIndex = Math.min(frameIndex, this.animationData.frames.length - 1);
                            this.switchToActiveFrame(newIndex);
                        }
                        
                        if (this.eventBus) {
                            this.eventBus.emit('animation:frame-deleted', { frameIndex });
                        }
                    },
                    undo: () => {
                        const restoredFrame = Frame.deserialize(frameSnapshot, this.config);
                        this.animationData.frames.splice(frameIndex, 0, restoredFrame);
                        this.renameFramesSequentially();
                        
                        if (this.canvasContainer) {
                            this.canvasContainer.addChild(restoredFrame.container);
                            restoredFrame.container.visible = false;
                        }
                        
                        if (this.layerSystem?.createFrameRenderTexture) {
                            this.layerSystem.createFrameRenderTexture(restoredFrame.id);
                        }
                        
                        this.animationData.playback.currentFrameIndex = oldCurrentIndex;
                        this.switchToActiveFrame(oldCurrentIndex);
                        
                        setTimeout(() => {
                            this.generateFrameThumbnail(frameIndex);
                        }, 100);
                        
                        if (this.eventBus) {
                            this.eventBus.emit('animation:frame-restored', { 
                                frameId: restoredFrame.id, 
                                frameIndex 
                            });
                        }
                    },
                    meta: { type: 'frame-delete', frameId: frame.id, frameIndex }
                };
                
                window.History.push(command);
            } else {
                if (this.layerSystem?.destroyFrameRenderTexture) {
                    this.layerSystem.destroyFrameRenderTexture(frame.id);
                }
                
                if (this.canvasContainer && frame.container.parent === this.canvasContainer) {
                    this.canvasContainer.removeChild(frame.container);
                }
                
                this.animationData.frames.splice(frameIndex, 1);
                this.renameFramesSequentially();
                
                if (this.animationData.playback.currentFrameIndex >= frameIndex) {
                    this.animationData.playback.currentFrameIndex = Math.max(0, 
                        this.animationData.playback.currentFrameIndex - 1
                    );
                }
                
                if (this.animationData.frames.length > 0) {
                    const newIndex = Math.min(frameIndex, this.animationData.frames.length - 1);
                    this.switchToActiveFrame(newIndex);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:frame-deleted', { frameIndex });
                }
            }
            
            return true;
        }
        
        reorderFrames(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            if (oldIndex < 0 || oldIndex >= this.animationData.frames.length) return;
            if (newIndex < 0 || newIndex >= this.animationData.frames.length) return;
            
            const oldCurrentIndex = this.animationData.playback.currentFrameIndex;
            
            if (window.History && !window.History._manager.isApplying) {
                const command = {
                    name: 'reorder-frames',
                    do: () => {
                        const [movedFrame] = this.animationData.frames.splice(oldIndex, 1);
                        this.animationData.frames.splice(newIndex, 0, movedFrame);
                        this.renameFramesSequentially();
                        
                        if (this.animationData.playback.currentFrameIndex === oldIndex) {
                            this.animationData.playback.currentFrameIndex = newIndex;
                        } else if (oldIndex < this.animationData.playback.currentFrameIndex && 
                                   newIndex >= this.animationData.playback.currentFrameIndex) {
                            this.animationData.playback.currentFrameIndex--;
                        } else if (oldIndex > this.animationData.playback.currentFrameIndex && 
                                   newIndex <= this.animationData.playback.currentFrameIndex) {
                            this.animationData.playback.currentFrameIndex++;
                        }
                        
                        if (this.eventBus) {
                            this.eventBus.emit('animation:frames-reordered', { 
                                oldIndex, 
                                newIndex
                            });
                        }
                    },
                    undo: () => {
                        const [movedFrame] = this.animationData.frames.splice(newIndex, 1);
                        this.animationData.frames.splice(oldIndex, 0, movedFrame);
                        this.renameFramesSequentially();
                        
                        this.animationData.playback.currentFrameIndex = oldCurrentIndex;
                        
                        if (this.eventBus) {
                            this.eventBus.emit('animation:frames-reordered', { 
                                oldIndex: newIndex, 
                                newIndex: oldIndex
                            });
                        }
                    },
                    meta: { type: 'frame-reorder', oldIndex, newIndex }
                };
                
                window.History.push(command);
            } else {
                const [movedFrame] = this.animationData.frames.splice(oldIndex, 1);
                this.animationData.frames.splice(newIndex, 0, movedFrame);
                this.renameFramesSequentially();
                
                if (this.animationData.playback.currentFrameIndex === oldIndex) {
                    this.animationData.playback.currentFrameIndex = newIndex;
                } else if (oldIndex < this.animationData.playback.currentFrameIndex && 
                           newIndex >= this.animationData.playback.currentFrameIndex) {
                    this.animationData.playback.currentFrameIndex--;
                } else if (oldIndex > this.animationData.playback.currentFrameIndex && 
                           newIndex <= this.animationData.playback.currentFrameIndex) {
                    this.animationData.playback.currentFrameIndex++;
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:frames-reordered', { 
                        oldIndex, 
                        newIndex
                    });
                }
            }
        }
        
        renameFramesSequentially() {
            if (!this.animationData.frames || this.animationData.frames.length === 0) return;
            
            this.animationData.frames.forEach((frame, index) => {
                frame.name = `${index + 1}F`;
            });
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frames-renamed-sequentially');
            }
        }
        
        updateFrameDuration(frameIndex, duration) {
            const frame = this.animationData.frames[frameIndex];
            if (!frame) return;
            
            frame.duration = Math.max(0.01, Math.min(10, duration));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-duration-changed', { 
                    frameIndex, 
                    duration: frame.duration 
                });
            }
        }
        
        retimeAllFrames(newDuration) {
            if (!this.animationData.frames || this.animationData.frames.length === 0) return;
            if (isNaN(newDuration) || newDuration <= 0) return;
            
            const clampedDuration = Math.max(0.01, Math.min(10, newDuration));
            
            this.animationData.frames.forEach(frame => {
                frame.duration = clampedDuration;
            });
            
            if (this.eventBus) {
                this.eventBus.emit('animation:all-frames-retimed', {
                    newDuration: clampedDuration,
                    frameCount: this.animationData.frames.length
                });
            }
        }
        
        play() {
            if (this.animationData.frames.length === 0) return;
            
            this.animationData.playback.isPlaying = true;
            this.animationData.playback.startTime = Date.now();
            this.startPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-started');
            }
        }
        
        pause() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedFrameIndex = this.animationData.playback.currentFrameIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-paused');
            }
        }
        
        stop() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedFrameIndex = this.animationData.playback.currentFrameIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-stopped');
            }
        }
        
        togglePlayStop() {
            if (this.animationData.playback.isPlaying) {
                this.stop();
            } else {
                this.play();
            }
        }
        
        togglePlayPause() {
            this.togglePlayStop();
        }
        
        startPlaybackLoop() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
            }
            
            const frameTime = 1000 / 12;
            
            this.playbackTimer = setInterval(() => {
                this.updatePlayback();
            }, frameTime);
        }
        
        stopPlaybackLoop() {
            if (this.playbackTimer) {
                clearInterval(this.playbackTimer);
                this.playbackTimer = null;
            }
        }
        
        updatePlayback() {
            if (!this.animationData.playback.isPlaying) return;
            
            const currentFrame = this.animationData.frames[this.animationData.playback.currentFrameIndex];
            if (!currentFrame) return;
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            if (elapsed >= currentFrame.duration) {
                this.animationData.playback.currentFrameIndex++;
                
                if (this.animationData.playback.currentFrameIndex >= this.animationData.frames.length) {
                    if (this.animationData.settings.loop) {
                        this.animationData.playback.currentFrameIndex = 0;
                    } else {
                        this.stop();
                        return;
                    }
                }
                
                this.animationData.playback.startTime = Date.now();
                this.switchToActiveFrame(this.animationData.playback.currentFrameIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:frame-changed', { 
                        frameIndex: this.animationData.playback.currentFrameIndex 
                    });
                }
            }
        }
        
        goToPreviousFrame() {
            if (this.animationData.frames.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentFrameIndex - 1;
            if (newIndex < 0) {
                newIndex = this.animationData.frames.length - 1;
            }
            
            this.animationData.playback.currentFrameIndex = newIndex;
            this.switchToActiveFrame(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    frameIndex: newIndex, 
                    direction: 'previous' 
                });
            }
        }
        
        goToNextFrame() {
            if (this.animationData.frames.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentFrameIndex + 1;
            if (newIndex >= this.animationData.frames.length) {
                newIndex = 0;
            }
            
            this.animationData.playback.currentFrameIndex = newIndex;
            this.switchToActiveFrame(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    frameIndex: newIndex, 
                    direction: 'next' 
                });
            }
        }
        
        updateSettings(settings) {
            if (!settings) return;
            Object.assign(this.animationData.settings, settings);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        getAnimationData() { 
            return this.animationData; 
        }
        
        getCurrentFrameIndex() { 
            return this.animationData.playback.currentFrameIndex; 
        }
        
        getFrameCount() { 
            return this.animationData.frames.length; 
        }
        
        getCurrentFrame() { 
            return this.animationData.frames[this.animationData.playback.currentFrameIndex] || null; 
        }
        
        getCurrentFrameLayers() {
            const currentFrame = this.getCurrentFrame();
            return currentFrame ? currentFrame.getLayers() : [];
        }
        
        hasInitialFrame() { 
            return this.animationData.frames.length > 0; 
        }
        
        getAllFrames() { 
            return this.animationData.frames; 
        }
        
        getFrameInfo(frameIndex) {
            const frame = this.animationData.frames[frameIndex];
            if (!frame) return null;
            
            return {
                id: frame.id,
                name: frame.name,
                duration: frame.duration,
                layerCount: frame.getLayerCount(),
                thumbnailCanvas: frame.thumbnailCanvas,
                isActive: frameIndex === this.animationData.playback.currentFrameIndex
            };
        }
        
        getPlaybackTime() {
            if (!this.animationData.playback.isPlaying) {
                return 0;
            }
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            let totalTime = 0;
            for (let i = 0; i < this.animationData.playback.currentFrameIndex; i++) {
                totalTime += this.animationData.frames[i]?.duration || 0;
            }
            
            return totalTime + elapsed;
        }
        
        getPlaybackState() {
            return {
                isPlaying: this.animationData.playback.isPlaying,
                currentFrameIndex: this.animationData.playback.currentFrameIndex,
                loop: this.animationData.settings.loop,
                framesCount: this.animationData.frames.length
            };
        }
        
        isInAnimationMode() { 
            return this.isAnimationMode; 
        }
        
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            if (this.isAnimationMode) {
                this.createInitialFrameIfNeeded();
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-entered');
                }
            } else {
                if (this.animationData.playback.isPlaying) {
                    this.stop();
                }
                if (this.eventBus) {
                    this.eventBus.emit('animation:mode-exited');
                }
            }
            
            return this.isAnimationMode;
        }
        
        addLayerToCurrentFrame(layerData) {
            const currentFrame = this.getCurrentFrame();
            if (!currentFrame) return null;
            
            const layer = this._createBlankLayer(currentFrame.id, layerData.name || 'New Layer');
            layer.visible = layerData.visible !== false;
            layer.alpha = layerData.opacity || 1.0;
            
            currentFrame.addLayer(layer);
            
            return layer.layerData;
        }
        
        updateCurrentFrameLayer(layerIndex, updateData) {
            const currentFrame = this.getCurrentFrame();
            return currentFrame;
        }
        
        saveFrameLayerStates() {
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    window.TegakiFrame = Frame;
    window.animationSystem = new AnimationSystem();

})();

console.log('✅ animation-system.js (Phase 1改修版・フレーム名統一: xF形式) loaded');