// ===== system/animation-system.js - サムネイルアスペクト比完全修正版 + リサイズ対応 =====
// 【改修】キャンバスリサイズ時の全カットサムネイル更新対応
// 【完全修正】サムネイルサイズ動的計算＋timeline-thumbnail-utils.js完全活用
// 【維持】全既存機能（リサイズ対応+再生時間+RETIME+座標系修正+CUTフォルダ方式）
// PixiJS v8.13 対応

(function() {
    'use strict';
    
    // ===== Cutクラス: CUTフォルダの実体 =====
    class Cut {
        constructor(id, name, config) {
            this.id = id;
            this.name = name || `CUT${Date.now()}`;
            this.duration = config?.animation?.defaultCutDuration || 0.5;
            
            this.container = new PIXI.Container();
            this.container.label = `cut_${id}`;
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
            const cut = new Cut(data.id, data.name, config);
            cut.duration = data.duration;
            
            if (data.layers && Array.isArray(data.layers)) {
                data.layers.forEach(layerData => {
                    const layer = cut._deserializeLayer(layerData);
                    if (layer) {
                        cut.addLayer(layer);
                    }
                });
            }
            
            return cut;
        }
        
        _deserializeLayer(layerData) {
            const layer = new PIXI.Container();
            layer.label = layerData.id;
            
            layer.layerData = {
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false,
                paths: []
            };
            
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
                layer.layerData.backgroundGraphics = bg;
            }
            
            if (layerData.paths && Array.isArray(layerData.paths)) {
                layerData.paths.forEach(pathData => {
                    const path = this._rebuildPath(pathData);
                    if (path) {
                        layer.layerData.paths.push(path);
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
    
    // ===== AnimationSystem: サムネイル完全修正版 + リサイズ対応 =====
    
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
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            this.cutClipboard = {
                cutData: null,
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
            if (!this.animationData?.cuts || this.animationData.cuts.length === 0) return;
            
            setTimeout(() => {
                this.regenerateAllThumbnails();
            }, 200);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:thumbnails-need-update');
            }
        }
        
        async regenerateAllThumbnails() {
            if (!this.animationData?.cuts) return;
            
            for (let i = 0; i < this.animationData.cuts.length; i++) {
                await this.generateCutThumbnail(i);
                
                if (i < this.animationData.cuts.length - 1) {
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
            
            if (this.canvasContainer && this.layerSystem.currentCutContainer) {
                this.canvasContainer.addChild(this.layerSystem.currentCutContainer);
            }
            
            this.setupCutClipboardEvents();
            this.setupLayerChangeListener();
            this.hasInitialized = true;
            
            setTimeout(() => {
                if (!this.initialCutCreated && !this.isInitializing) {
                    this.createInitialCutIfNeeded();
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
                const currentCut = this.getCurrentCut();
                if (currentCut) {
                    setTimeout(() => {
                        this.generateCutThumbnail(this.getCurrentCutIndex());
                    }, 100);
                }
            });
        }
        
        setupCutClipboardEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('cut:copy-current', () => this.copyCurrent());
            this.eventBus.on('cut:paste-right-adjacent', () => this.pasteRightAdjacent());
            this.eventBus.on('cut:paste-new', () => this.pasteAsNew());
        }
        
        createDefaultAnimation() {
            return {
                cuts: [],
                settings: {
                    loop: true
                },
                playback: {
                    isPlaying: false,
                    currentCutIndex: 0,
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
        
        createNewCutFromCurrentLayers() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cut = new Cut(cutId, `CUT${this.animationData.cuts.length + 1}`, this.config);
            
            if (this.layerSystem?.currentCutContainer) {
                const currentLayers = this.layerSystem.currentCutContainer.children;
                
                currentLayers.forEach(originalLayer => {
                    const copiedLayer = this._deepCopyLayer(originalLayer);
                    cut.addLayer(copiedLayer);
                });
            }
            
            this.animationData.cuts.push(cut);
            const newCutIndex = this.animationData.cuts.length - 1;
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(cut.container);
                cut.container.visible = false;
            }
            
            if (this.layerSystem?.createCutRenderTexture) {
                this.layerSystem.createCutRenderTexture(cutId);
            }
            
            this.switchToActiveCut(newCutIndex);
            
            setTimeout(async () => {
                await this.generateCutThumbnail(newCutIndex);
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-created', { 
                        cutId: cut.id, 
                        cutIndex: newCutIndex 
                    });
                }
            }, 100);
            
            return cut;
        }
        
        createNewBlankCut() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cut = new Cut(cutId, `CUT${this.animationData.cuts.length + 1}`, this.config);
            
            const bgLayer = this._createBackgroundLayer(cutId);
            const layer1 = this._createBlankLayer(cutId, 'レイヤー1');
            
            cut.addLayer(bgLayer);
            cut.addLayer(layer1);
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(cut.container);
                cut.container.visible = false;
            }
            
            if (this.layerSystem?.createCutRenderTexture) {
                this.layerSystem.createCutRenderTexture(cutId);
            }
            
            this.switchToActiveCut(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: newIndex 
                });
            }
            
            return cut;
        }
        
        createNewEmptyCut() {
            return this.createNewBlankCut();
        }
        
        _createBackgroundLayer(cutId) {
            const layer = new PIXI.Container();
            layer.label = `${cutId}_layer_bg`;
            layer.layerData = {
                id: `${cutId}_layer_bg_${Date.now()}`,
                name: '背景',
                visible: true,
                opacity: 1.0,
                isBackground: true,
                paths: []
            };
            
            const canvasSize = this.getCurrentCanvasSize();
            const bg = new PIXI.Graphics();
            bg.rect(0, 0, canvasSize.width, canvasSize.height);
            bg.fill(this.config.background.color);
            layer.addChild(bg);
            layer.layerData.backgroundGraphics = bg;
            
            return layer;
        }
        
        _createBlankLayer(cutId, name) {
            const layer = new PIXI.Container();
            layer.label = `${cutId}_layer_${Date.now()}`;
            layer.layerData = {
                id: layer.label,
                name: name,
                visible: true,
                opacity: 1.0,
                isBackground: false,
                paths: []
            };
            
            return layer;
        }
        
        _deepCopyLayer(originalLayer) {
            const layer = new PIXI.Container();
            layer.label = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            layer.layerData = {
                id: layer.label,
                name: originalLayer.layerData?.name || 'Layer',
                visible: originalLayer.visible,
                opacity: originalLayer.alpha,
                isBackground: originalLayer.layerData?.isBackground || false,
                paths: []
            };
            
            layer.position.copyFrom(originalLayer.position);
            layer.rotation = originalLayer.rotation;
            layer.scale.copyFrom(originalLayer.scale);
            layer.pivot.copyFrom(originalLayer.pivot);
            layer.visible = originalLayer.visible;
            layer.alpha = originalLayer.alpha;
            
            if (originalLayer.layerData?.isBackground) {
                const canvasSize = this.getCurrentCanvasSize();
                const bg = new PIXI.Graphics();
                bg.rect(0, 0, canvasSize.width, canvasSize.height);
                bg.fill(this.config.background.color);
                layer.addChild(bg);
                layer.layerData.backgroundGraphics = bg;
            }
            
            if (originalLayer.layerData?.paths) {
                originalLayer.layerData.paths.forEach(originalPath => {
                    const copiedPath = this._deepCopyPath(originalPath);
                    if (copiedPath) {
                        layer.layerData.paths.push(copiedPath);
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
        
        switchToActiveCut(cutIndex) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCut(cutIndex), 50);
                return;
            }
            
            const targetCut = this.animationData.cuts[cutIndex];
            if (!targetCut || !this.layerSystem) return;
            
            this.cutSwitchInProgress = true;
            
            this.animationData.cuts.forEach(cut => {
                cut.container.visible = false;
            });
            
            targetCut.container.visible = true;
            
            this.layerSystem.setCurrentCutContainer(targetCut.container);
            
            this.animationData.playback.currentCutIndex = cutIndex;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: targetCut.id });
            }
            
            this.cutSwitchInProgress = false;
        }
        
        switchToActiveCutSafely(cutIndex, resetTransform) {
            this.switchToActiveCut(cutIndex);
        }
        
        async generateCutThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem || !this.app?.renderer) return;
            
            if (this.layerSystem.renderCutToTexture) {
                this.layerSystem.renderCutToTexture(cut.id, cut.container);
            }
            
            const renderTexture = this.layerSystem?.getCutRenderTexture?.(cut.id);
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
                
                cut.thumbnailCanvas = thumbCanvas;
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
                
                cut.thumbnailCanvas = thumbCanvas;
            }
            
            if (this.layerSystem.clearCutThumbnailDirty) {
                this.layerSystem.clearCutThumbnailDirty(cut.id);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:thumbnail-generated', { 
                    cutIndex,
                    thumbSize: { width: thumbDisplayW, height: thumbDisplayH }
                });
            }
        }
        
        async generateCutThumbnailOptimized(cutIndex) {
            return this.generateCutThumbnail(cutIndex);
        }
        
        copyCurrent() {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return false;
            
            this.cutClipboard.cutData = currentCut.serialize();
            this.cutClipboard.timestamp = Date.now();
            this.cutClipboard.sourceId = currentCut.id;
            
            if (this.eventBus) {
                this.eventBus.emit('cut:copied', {
                    cutId: currentCut.id,
                    cutName: currentCut.name
                });
            }
            
            return true;
        }
        
        pasteRightAdjacent() {
            if (!this.cutClipboard.cutData) return false;
            
            const insertIndex = this.animationData.playback.currentCutIndex + 1;
            const pastedCut = this.createCutFromClipboard(this.cutClipboard.cutData);
            if (!pastedCut) return false;
            
            this.animationData.cuts.splice(insertIndex, 0, pastedCut);
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(pastedCut.container);
            }
            
            if (this.layerSystem?.createCutRenderTexture) {
                this.layerSystem.createCutRenderTexture(pastedCut.id);
            }
            
            this.switchToActiveCut(insertIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:pasted-right-adjacent', {
                    cutId: pastedCut.id,
                    cutIndex: insertIndex
                });
            }
            
            return true;
        }
        
        pasteAsNew() {
            if (!this.cutClipboard.cutData) return false;
            
            const pastedCut = this.createCutFromClipboard(this.cutClipboard.cutData);
            if (!pastedCut) return false;
            
            this.animationData.cuts.push(pastedCut);
            const newIndex = this.animationData.cuts.length - 1;
            
            if (this.canvasContainer) {
                this.canvasContainer.addChild(pastedCut.container);
            }
            
            if (this.layerSystem?.createCutRenderTexture) {
                this.layerSystem.createCutRenderTexture(pastedCut.id);
            }
            
            this.switchToActiveCut(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:pasted-new', {
                    cutId: pastedCut.id,
                    cutIndex: newIndex
                });
            }
            
            return true;
        }
        
        createCutFromClipboard(clipboardData) {
            if (!clipboardData) return null;
            
            const baseName = clipboardData.name.replace(/_copy$/, '').replace(/\(\d+\)$/, '');
            
            let copyCount = 0;
            for (const cut of this.animationData.cuts) {
                const cutBaseName = cut.name.replace(/\(\d+\)$/, '');
                if (cutBaseName === baseName) {
                    const match = cut.name.match(/\((\d+)\)$/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > copyCount) copyCount = num;
                    }
                }
            }
            
            const newName = `${baseName}(${copyCount + 1})`;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cut = Cut.deserialize({
                id: cutId,
                name: newName,
                duration: clipboardData.duration,
                layers: clipboardData.layers
            }, this.config);
            
            setTimeout(() => {
                const cutIndex = this.animationData.cuts.findIndex(c => c.id === cut.id);
                if (cutIndex !== -1) {
                    this.generateCutThumbnail(cutIndex);
                }
            }, 200);
            
            return cut;
        }
        
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0 || this.isInitializing) {
                return;
            }
            
            if (!this.layerSystem?.currentCutContainer) {
                return;
            }
            
            this.isInitializing = true;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cut = new Cut(cutId, 'CUT1', this.config);
            
            const tempLayers = this.layerSystem.currentCutContainer.children.slice();
            tempLayers.forEach(tempLayer => {
                const copiedLayer = this._deepCopyLayer(tempLayer);
                cut.addLayer(copiedLayer);
            });
            
            this.animationData.cuts.push(cut);
            
            if (this.canvasContainer) {
                if (this.layerSystem.currentCutContainer.parent === this.canvasContainer) {
                    this.canvasContainer.removeChild(this.layerSystem.currentCutContainer);
                }
                
                this.canvasContainer.addChild(cut.container);
                cut.container.visible = true;
            }
            
            if (this.layerSystem.createCutRenderTexture) {
                this.layerSystem.createCutRenderTexture(cutId);
            }
            
            this.layerSystem.setCurrentCutContainer(cut.container);
            
            this.animationData.playback.currentCutIndex = 0;
            this.initialCutCreated = true;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:initial-cut-created', { 
                    cutId: cut.id,
                    cutIndex: 0
                });
            }
            
            setTimeout(() => {
                this.generateCutThumbnail(0);
            }, 200);
            
            this.isInitializing = false;
        }
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return false;
            if (this.animationData.cuts.length <= 1) return false;
            
            const cut = this.animationData.cuts[cutIndex];
            
            if (this.layerSystem?.destroyCutRenderTexture) {
                this.layerSystem.destroyCutRenderTexture(cut.id);
            }
            
            if (this.canvasContainer && cut.container.parent === this.canvasContainer) {
                this.canvasContainer.removeChild(cut.container);
            }
            
            cut.container.destroy({ children: true, texture: false, baseTexture: false });
            
            this.animationData.cuts.splice(cutIndex, 1);
            
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            if (this.animationData.cuts.length > 0) {
                const newIndex = Math.min(cutIndex, this.animationData.cuts.length - 1);
                this.switchToActiveCut(newIndex);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
        }
        
        reorderCuts(oldIndex, newIndex) {
            if (oldIndex === newIndex) return;
            if (oldIndex < 0 || oldIndex >= this.animationData.cuts.length) return;
            if (newIndex < 0 || newIndex >= this.animationData.cuts.length) return;
            
            const [movedCut] = this.animationData.cuts.splice(oldIndex, 1);
            this.animationData.cuts.splice(newIndex, 0, movedCut);
            
            if (this.animationData.playback.currentCutIndex === oldIndex) {
                this.animationData.playback.currentCutIndex = newIndex;
            } else if (oldIndex < this.animationData.playback.currentCutIndex && 
                       newIndex >= this.animationData.playback.currentCutIndex) {
                this.animationData.playback.currentCutIndex--;
            } else if (oldIndex > this.animationData.playback.currentCutIndex && 
                       newIndex <= this.animationData.playback.currentCutIndex) {
                this.animationData.playback.currentCutIndex++;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cuts-reordered', { 
                    oldIndex, 
                    newIndex,
                    currentCutIndex: this.animationData.playback.currentCutIndex
                });
            }
        }
        
        renameCutsSequentially() {
            if (!this.animationData.cuts || this.animationData.cuts.length === 0) return;
            
            this.animationData.cuts.forEach((cut, index) => {
                cut.name = `CUT${index + 1}`;
            });
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cuts-renamed-sequentially');
            }
        }
        
        updateCutDuration(cutIndex, duration) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            cut.duration = Math.max(0.01, Math.min(10, duration));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-duration-changed', { 
                    cutIndex, 
                    duration: cut.duration 
                });
            }
        }
        
        retimeAllCuts(newDuration) {
            if (!this.animationData.cuts || this.animationData.cuts.length === 0) return;
            if (isNaN(newDuration) || newDuration <= 0) return;
            
            const clampedDuration = Math.max(0.01, Math.min(10, newDuration));
            
            this.animationData.cuts.forEach(cut => {
                cut.duration = clampedDuration;
            });
            
            if (this.eventBus) {
                this.eventBus.emit('animation:all-cuts-retimed', {
                    newDuration: clampedDuration,
                    cutCount: this.animationData.cuts.length
                });
            }
        }
        
        play() {
            if (this.animationData.cuts.length === 0) return;
            
            this.animationData.playback.isPlaying = true;
            this.animationData.playback.startTime = Date.now();
            this.startPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-started');
            }
        }
        
        pause() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.animationData.playback.currentCutIndex;
            this.stopPlaybackLoop();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:playback-paused');
            }
        }
        
        stop() {
            this.animationData.playback.isPlaying = false;
            this.lastStoppedCutIndex = this.animationData.playback.currentCutIndex;
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
            
            const currentCut = this.animationData.cuts[this.animationData.playback.currentCutIndex];
            if (!currentCut) return;
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            if (elapsed >= currentCut.duration) {
                this.animationData.playback.currentCutIndex++;
                
                if (this.animationData.playback.currentCutIndex >= this.animationData.cuts.length) {
                    if (this.animationData.settings.loop) {
                        this.animationData.playback.currentCutIndex = 0;
                    } else {
                        this.stop();
                        return;
                    }
                }
                
                this.animationData.playback.startTime = Date.now();
                this.switchToActiveCut(this.animationData.playback.currentCutIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-changed', { 
                        cutIndex: this.animationData.playback.currentCutIndex 
                    });
                }
            }
        }
        
        goToPreviousFrame() {
            if (this.animationData.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentCutIndex - 1;
            if (newIndex < 0) {
                newIndex = this.animationData.cuts.length - 1;
            }
            
            this.animationData.playback.currentCutIndex = newIndex;
            this.switchToActiveCut(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
                    direction: 'previous' 
                });
            }
        }
        
        goToNextFrame() {
            if (this.animationData.cuts.length === 0) return;
            
            this.stopPlaybackLoop();
            this.animationData.playback.isPlaying = false;
            
            let newIndex = this.animationData.playback.currentCutIndex + 1;
            if (newIndex >= this.animationData.cuts.length) {
                newIndex = 0;
            }
            
            this.animationData.playback.currentCutIndex = newIndex;
            this.switchToActiveCut(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
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
        
        getCurrentCutIndex() { 
            return this.animationData.playback.currentCutIndex; 
        }
        
        getCutCount() { 
            return this.animationData.cuts.length; 
        }
        
        getCurrentCut() { 
            return this.animationData.cuts[this.animationData.playback.currentCutIndex] || null; 
        }
        
        getCurrentCutLayers() {
            const currentCut = this.getCurrentCut();
            return currentCut ? currentCut.getLayers() : [];
        }
        
        hasInitialCut() { 
            return this.animationData.cuts.length > 0; 
        }
        
        getAllCuts() { 
            return this.animationData.cuts; 
        }
        
        getCutInfo(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return null;
            
            return {
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.getLayerCount(),
                thumbnailCanvas: cut.thumbnailCanvas,
                isActive: cutIndex === this.animationData.playback.currentCutIndex
            };
        }
        
        getPlaybackTime() {
            if (!this.animationData.playback.isPlaying) {
                return 0;
            }
            
            const elapsed = (Date.now() - this.animationData.playback.startTime) / 1000;
            
            let totalTime = 0;
            for (let i = 0; i < this.animationData.playback.currentCutIndex; i++) {
                totalTime += this.animationData.cuts[i]?.duration || 0;
            }
            
            return totalTime + elapsed;
        }
        
        getPlaybackState() {
            return {
                isPlaying: this.animationData.playback.isPlaying,
                currentCutIndex: this.animationData.playback.currentCutIndex,
                loop: this.animationData.settings.loop,
                cutsCount: this.animationData.cuts.length
            };
        }
        
        isInAnimationMode() { 
            return this.isAnimationMode; 
        }
        
        toggleAnimationMode() {
            this.isAnimationMode = !this.isAnimationMode;
            
            if (this.isAnimationMode) {
                this.createInitialCutIfNeeded();
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
        
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const layer = this._createBlankLayer(currentCut.id, layerData.name || 'New Layer');
            layer.visible = layerData.visible !== false;
            layer.alpha = layerData.opacity || 1.0;
            
            currentCut.addLayer(layer);
            
            return layer.layerData;
        }
        
        updateCurrentCutLayer(layerIndex, updateData) {
            const currentCut = this.getCurrentCut();
            return currentCut;
        }
        
        saveCutLayerStates() {
            // 互換性のため空実装
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    window.TegakiCut = Cut;

})();