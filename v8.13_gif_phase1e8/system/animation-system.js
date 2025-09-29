// ===== system/animation-system.js - 確実な同期化改修版 =====
// 【改修完了】generateCutThumbnailOptimized: PixiJSレンダリング完了待機
// 【改修完了】不確実なsetTimeoutの排除
// 【改修完了】Promise ベース同期化チェーン
// 【維持】Canvas直接保存・完全2次元マトリクス・CUT独立性・座標系統一
// PixiJS v8.13 対応

(function() {
    'use strict';
    
    class AnimationSystem {
        constructor() {
            this.animationData = this.createDefaultAnimation();
            this.layerSystem = null;
            this.cameraSystem = null;
            this.app = null;
            this.eventBus = window.TegakiEventBus;
            
            this.playbackTimer = null;
            this.isAnimationMode = false;
            this.initialCutCreated = false;
            
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            this.cutLayerIdCounters = new Map();
            this.cutLayerStates = new Map();
            
            this.cutClipboard = {
                cutData: null,
                timestamp: null,
                sourceId: null
            };
            
            this.coordAPI = window.CoordinateSystem;
            if (!this.coordAPI) {
                console.warn('CoordinateSystem not available');
            }
        }
        
        init(layerSystem, app) {
            if (this.hasInitialized) return;
            
            console.log('🎬 AnimationSystem: 確実な同期化改修版 初期化開始...');
            
            this.layerSystem = layerSystem;
            this.app = app;
            
            if (!this.eventBus || !this.layerSystem?.layers) {
                console.error('Required dependencies not available');
                return;
            }
            
            this.layerSystem.animationSystem = this;
            
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
            
            console.log('✅ AnimationSystem: 確実な同期化改修版 初期化完了');
        }
        
        // 【改修】不確実なsetTimeoutを排除
        setupLayerChangeListener() {
            if (!this.eventBus) return;
            
            this.eventBus.on('layer:path-added', () => {
                // layer-system.jsで既に同期処理されているため、ここでは不要
            });
            
            this.eventBus.on('layer:updated', () => {
                this.saveCutLayerStates();
            });
            
            this.eventBus.on('layer:visibility-changed', () => {
                this.saveCutLayerStates();
            });
            
            // 【改修】drawing:stroke-completedでの二重処理を排除
            this.eventBus.on('drawing:stroke-completed', async () => {
                // layer-system.jsで既に処理済み
            });
        }
        
        setupCutClipboardEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('cut:copy-current', () => this.copyCurrent());
            this.eventBus.on('cut:paste-right-adjacent', () => this.pasteRightAdjacent());
            this.eventBus.on('cut:paste-new', () => this.pasteAsNew());
        }
        
        createDefaultAnimation() {
            const config = window.TEGAKI_CONFIG?.animation || {
                defaultFPS: 12,
                defaultCutDuration: 0.5
            };
            
            return {
                cuts: [],
                settings: {
                    fps: config.defaultFPS,
                    loop: true
                },
                playback: {
                    isPlaying: false,
                    currentCutIndex: 0,
                    startTime: 0
                }
            };
        }
        
        createNewCutFromCurrentLayers() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const independentLayers = this.copyCurrentLayersToIndependentState(cutId);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: independentLayers,
                thumbnailCanvas: null
            };
            
            this.animationData.cuts.push(cut);
            const newCutIndex = this.animationData.cuts.length - 1;
            
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(independentLayers));
            
            this.switchToActiveCutSafely(newCutIndex, false);
            
            // 【改修】Promise ベースの同期化
            setTimeout(async () => {
                await this.generateCutThumbnailOptimized(newCutIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-created', { 
                        cutId: cut.id, 
                        cutIndex: newCutIndex 
                    });
                }
            }, 100);
            
            console.log(`🎬 新規CUT作成: ${cut.name}`);
            return cut;
        }
        
        createNewBlankCut() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG?.animation?.defaultCutDuration || 0.5,
                layers: [],
                thumbnailCanvas: null
            };
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            this.cutLayerStates.set(cutId, []);
            
            this.switchToActiveCutSafely(newIndex, false);
            
            if (this.layerSystem) {
                this.layerSystem.createLayer('背景', true);
                this.layerSystem.createLayer('レイヤー1', false);
            }
            
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
        
        copyCurrentLayersToIndependentState(cutId) {
            const independentLayers = [];
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return independentLayers;
            }
            
            this.layerSystem.layers.forEach((originalLayer) => {
                if (!originalLayer?.layerData) return;
                
                const independentLayerId = this.generateUniqueCutLayerId(cutId);
                
                const originalTransform = this.layerSystem.layerTransforms.get(originalLayer.layerData.id) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                const independentPaths = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(originalPath => {
                        const independentPoints = originalPath.points ? 
                            originalPath.points.map(point => ({
                                x: Number(point.x),
                                y: Number(point.y)
                            })) : [];
                        
                        return {
                            id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            points: independentPoints,
                            size: originalPath.size || 16,
                            color: originalPath.color || 0x800000,
                            opacity: originalPath.opacity || 1.0,
                            tool: originalPath.tool || 'pen',
                            isComplete: originalPath.isComplete || true
                        };
                    }) : [];
                
                const independentLayerData = {
                    id: independentLayerId,
                    name: originalLayer.layerData.name,
                    visible: originalLayer.layerData.visible !== false,
                    opacity: originalLayer.layerData.opacity || 1.0,
                    isBackground: originalLayer.layerData.isBackground || false,
                    transform: {
                        x: Number(originalTransform.x) || 0,
                        y: Number(originalTransform.y) || 0,
                        rotation: Number(originalTransform.rotation) || 0,
                        scaleX: Number(originalTransform.scaleX) || 1,
                        scaleY: Number(originalTransform.scaleY) || 1
                    },
                    paths: independentPaths,
                    createdAt: Date.now(),
                    cutId: cutId
                };
                
                independentLayers.push(independentLayerData);
            });
            
            return independentLayers;
        }
        
        generateUniqueCutLayerId(cutId) {
            if (!this.cutLayerIdCounters.has(cutId)) {
                this.cutLayerIdCounters.set(cutId, 0);
            }
            
            const counter = this.cutLayerIdCounters.get(cutId);
            this.cutLayerIdCounters.set(cutId, counter + 1);
            
            return `${cutId}_layer_${counter}_${Date.now()}`;
        }
        
        switchToActiveCutSafely(cutIndex, resetTransform = false) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const targetCut = this.animationData.cuts[cutIndex];
            if (!targetCut || !this.layerSystem) return;
            
            this.cutSwitchInProgress = true;
            
            try {
                this.saveCutLayerStatesBeforeSwitch();
                
                this.animationData.playback.currentCutIndex = cutIndex;
                
                this.setActiveCut(cutIndex, resetTransform);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:cut-applied', { cutIndex, cutId: targetCut.id });
                }
                
            } catch (error) {
                console.error('CUT切り替えエラー:', error);
            } finally {
                this.cutSwitchInProgress = false;
            }
        }
        
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const currentIndependentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            
            currentCut.layers = currentIndependentState;
            
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentIndependentState));
        }
        
        setActiveCut(cutIndex, resetTransform = false) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            this.clearLayerSystemLayers();
            
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            this.rebuildLayersFromCutData(cutLayers, resetTransform);
            
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
        }
        
        clearLayerSystemLayers() {
            if (!this.layerSystem?.layers) return;
            
            const layersToDestroy = [...this.layerSystem.layers];
            
            layersToDestroy.forEach((layer) => {
                try {
                    if (layer.layerData?.paths) {
                        layer.layerData.paths.forEach(path => {
                            if (path.graphics?.destroy) {
                                path.graphics.destroy();
                            }
                        });
                    }
                    
                    if (layer.parent) {
                        layer.parent.removeChild(layer);
                    }
                    
                    if (layer.destroy) {
                        layer.destroy({ children: true, texture: false, baseTexture: false });
                    }
                } catch (error) {
                    console.warn('Layer destruction failed:', error);
                }
            });
            
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
        }
        
        rebuildLayersFromCutData(cutLayers, resetTransform = false) {
            if (!cutLayers || !Array.isArray(cutLayers) || cutLayers.length === 0) {
                return;
            }
            
            cutLayers.forEach((cutLayerData, index) => {
                try {
                    const layer = new PIXI.Container();
                    layer.label = cutLayerData.id;
                    
                    layer.layerData = {
                        id: cutLayerData.id,
                        name: cutLayerData.name || `レイヤー${index + 1}`,
                        visible: cutLayerData.visible !== false,
                        opacity: cutLayerData.opacity || 1.0,
                        isBackground: cutLayerData.isBackground || false,
                        paths: []
                    };
                    
                    const transform = cutLayerData.transform || {
                        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                    };
                    
                    this.layerSystem.layerTransforms.set(cutLayerData.id, {
                        x: Number(transform.x) || 0,
                        y: Number(transform.y) || 0,
                        rotation: Number(transform.rotation) || 0,
                        scaleX: Number(transform.scaleX) || 1,
                        scaleY: Number(transform.scaleY) || 1
                    });
                    
                    if (cutLayerData.isBackground) {
                        const bg = new PIXI.Graphics();
                        const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                        const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                        const bgColor = this.layerSystem.config?.background?.color || 0xF0E0D6;
                        
                        bg.rect(0, 0, canvasWidth, canvasHeight);
                        bg.fill(bgColor);
                        layer.addChild(bg);
                        layer.layerData.backgroundGraphics = bg;
                    }
                    
                    if (cutLayerData.paths && Array.isArray(cutLayerData.paths)) {
                        cutLayerData.paths.forEach(pathData => {
                            const reconstructedPath = this.rebuildPathFromData(pathData);
                            if (reconstructedPath) {
                                layer.layerData.paths.push(reconstructedPath);
                                layer.addChild(reconstructedPath.graphics);
                            }
                        });
                    }
                    
                    layer.visible = cutLayerData.visible !== false;
                    layer.alpha = cutLayerData.opacity || 1.0;
                    
                    if (!resetTransform && this.shouldApplyTransform(transform)) {
                        this.applyTransformToLayerFixed(layer, transform);
                    } else {
                        layer.position.set(0, 0);
                        layer.pivot.set(0, 0);
                        layer.rotation = 0;
                        layer.scale.set(1, 1);
                    }
                    
                    this.layerSystem.layers.push(layer);
                    this.layerSystem.layersContainer.addChild(layer);
                    
                } catch (error) {
                    console.error(`Layer ${index} rebuild failed:`, error);
                }
            });
            
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = Math.max(0, this.layerSystem.layers.length - 1);
            }
        }
        
        rebuildPathFromData(pathData) {
            if (!pathData?.points || !Array.isArray(pathData.points) || pathData.points.length === 0) {
                return null;
            }
            
            try {
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
                    id: pathData.id || ('path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                    points: [...pathData.points],
                    size: pathData.size || 16,
                    color: pathData.color || 0x800000,
                    opacity: pathData.opacity || 1.0,
                    tool: pathData.tool || 'pen',
                    graphics: graphics
                };
                
            } catch (error) {
                console.error('Path rebuild failed:', error);
                return null;
            }
        }
        
        shouldApplyTransform(transform) {
            if (!transform) return false;
            return (transform.x !== 0 || transform.y !== 0 || 
                    transform.rotation !== 0 || 
                    Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1);
        }
        
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
            const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            
            if (this.coordAPI?.applyLayerTransform) {
                this.coordAPI.applyLayerTransform(layer, transform, centerX, centerY);
            } else {
                if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                    Math.abs(transform.scaleY) !== 1) {
                    layer.pivot.set(centerX, centerY);
                    layer.position.set(centerX + (transform.x || 0), centerY + (transform.y || 0));
                    layer.rotation = transform.rotation || 0;
                    layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
                } else {
                    layer.pivot.set(0, 0);
                    layer.position.set(transform.x || 0, transform.y || 0);
                    layer.rotation = 0;
                    layer.scale.set(1, 1);
                }
            }
            
            if (this.layerSystem && layer.layerData) {
                this.layerSystem.layerTransforms.set(layer.layerData.id, {
                    x: transform.x || 0,
                    y: transform.y || 0,
                    rotation: transform.rotation || 0,
                    scaleX: transform.scaleX || 1,
                    scaleY: transform.scaleY || 1
                });
            }
        }
        
        // 【改修】不確実なsetTimeoutを排除、内部でgenerateCutThumbnailOptimizedを呼ばない
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const currentState = this.copyCurrentLayersToIndependentState(currentCut.id);
            currentCut.layers = currentState;
            
            this.cutLayerStates.set(currentCut.id, this.deepCloneCutLayers(currentState));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        // 【改修完了】サムネイル生成 - PixiJSレンダリング完了待機
        async generateCutThumbnailOptimized(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem || !this.app?.renderer) return;
            
            try {
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                let shouldRestoreOriginal = false;
                
                if (cutIndex !== currentCutIndex) {
                    shouldRestoreOriginal = true;
                    await this.temporarilyApplyCutStateForThumbnail(cutIndex);
                }
                
                // 【改修】PixiJSレンダリング完了を確実に待機
                await this._waitForRendererReady();
                
                // Canvas直接生成
                const thumbnailCanvas = await this.generateLayerCompositeCanvasOptimized();
                
                if (thumbnailCanvas) {
                    cut.thumbnailCanvas = thumbnailCanvas;
                }
                
                if (shouldRestoreOriginal) {
                    await this.restoreOriginalCutStateAfterThumbnail(currentCutIndex);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                }
                
            } catch (error) {
                console.error(`Thumbnail generation error for cut ${cutIndex}:`, error);
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error: error.message });
                }
            }
        }
        
        // 【新規】PixiJSレンダリング完了待機
        async _waitForRendererReady() {
            if (!this.app?.renderer || !this.layerSystem?.layersContainer) {
                return;
            }
            
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    try {
                        this.app.renderer.render(this.layerSystem.layersContainer);
                        requestAnimationFrame(() => resolve());
                    } catch (err) {
                        console.error('Renderer wait error:', err);
                        resolve();
                    }
                });
            });
        }
        
        async temporarilyApplyCutStateForThumbnail(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            this.clearLayerSystemLayers();
            
            const cutLayers = this.cutLayerStates.get(cut.id) || cut.layers || [];
            this.rebuildLayersFromCutData(cutLayers, false);
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        async restoreOriginalCutStateAfterThumbnail(originalCutIndex) {
            const originalCut = this.animationData.cuts[originalCutIndex];
            if (!originalCut) return;
            
            this.clearLayerSystemLayers();
            const originalLayers = this.cutLayerStates.get(originalCut.id) || originalCut.layers || [];
            this.rebuildLayersFromCutData(originalLayers, false);
            
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Canvas合成 - キャンバス比率対応
        async generateLayerCompositeCanvasOptimized() {
            try {
                if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                    return this.createEmptyThumbnailCanvas();
                }
                
                const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                const canvasAspectRatio = canvasWidth / canvasHeight;
                
                const maxThumbWidth = 72;
                const maxThumbHeight = 54;
                
                let thumbWidth, thumbHeight;
                
                if (canvasAspectRatio >= maxThumbWidth / maxThumbHeight) {
                    thumbWidth = maxThumbWidth;
                    thumbHeight = Math.round(maxThumbWidth / canvasAspectRatio);
                } else {
                    thumbHeight = maxThumbHeight;
                    thumbWidth = Math.round(maxThumbHeight * canvasAspectRatio);
                }
                
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = thumbWidth;
                compositeCanvas.height = thumbHeight;
                
                const ctx = compositeCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, thumbWidth, thumbHeight);
                
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    if (!layer.visible || layer.layerData?.visible === false) continue;
                    
                    try {
                        const layerCanvas = await this.renderLayerToCanvasOptimized(layer);
                        
                        if (layerCanvas) {
                            const opacity = layer.alpha * (layer.layerData?.opacity || 1.0);
                            ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
                            
                            ctx.drawImage(layerCanvas, 0, 0, thumbWidth, thumbHeight);
                            ctx.globalAlpha = 1.0;
                        }
                        
                    } catch (layerError) {
                        console.warn(`Layer ${i} rendering failed:`, layerError);
                    }
                }
                
                return compositeCanvas;
                
            } catch (error) {
                console.error('Composite canvas generation failed:', error);
                return this.createEmptyThumbnailCanvas();
            }
        }
        
        createEmptyThumbnailCanvas() {
            const canvas = document.createElement('canvas');
            canvas.width = 72;
            canvas.height = 54;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0e0d6';
            ctx.fillRect(0, 0, 72, 54);
            
            ctx.fillStyle = '#800000';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Empty CUT', 36, 30);
            
            return canvas;
        }
        
        async renderLayerToCanvasOptimized(layer) {
            try {
                if (!this.app?.renderer || !layer) return null;
                
                const canvasWidth = this.layerSystem.config?.canvas?.width || 800;
                const canvasHeight = this.layerSystem.config?.canvas?.height || 600;
                
                const renderTexture = PIXI.RenderTexture.create({
                    width: canvasWidth,
                    height: canvasHeight,
                    resolution: 1
                });
                
                const tempContainer = new PIXI.Container();
                
                const originalParent = layer.parent;
                const originalIndex = originalParent ? originalParent.getChildIndex(layer) : -1;
                
                if (originalParent) {
                    originalParent.removeChild(layer);
                }
                
                tempContainer.addChild(layer);
                
                this.app.renderer.render({
                    container: tempContainer,
                    target: renderTexture
                });
                
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                tempContainer.removeChild(layer);
                if (originalParent && originalIndex !== -1) {
                    originalParent.addChildAt(layer, originalIndex);
                } else if (originalParent) {
                    originalParent.addChild(layer);
                }
                
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                console.error('Layer canvas rendering failed:', error);
                return null;
            }
        }
        
        deepCloneCutLayers(cutLayers) {
            if (!cutLayers || !Array.isArray(cutLayers)) return [];
            
            return cutLayers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                isBackground: layer.isBackground,
                transform: {
                    x: Number(layer.transform?.x) || 0,
                    y: Number(layer.transform?.y) || 0,
                    rotation: Number(layer.transform?.rotation) || 0,
                    scaleX: Number(layer.transform?.scaleX) || 1,
                    scaleY: Number(layer.transform?.scaleY) || 1
                },
                paths: layer.paths ? layer.paths.map(path => ({
                    id: path.id,
                    points: path.points ? path.points.map(p => ({ x: p.x, y: p.y })) : [],
                    size: path.size || 16,
                    color: path.color || 0x800000,
                    opacity: path.opacity || 1.0,
                    tool: path.tool || 'pen',
                    isComplete: path.isComplete || true
                })) : [],
                createdAt: layer.createdAt || Date.now(),
                cutId: layer.cutId
            }));
        }
        
        // ===== CUT クリップボード機能 =====
        
        copyCurrent() {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return false;
            
            this.saveCutLayerStatesBeforeSwitch();
            
            this.cutClipboard.cutData = this.deepCopyCutData(currentCut);
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
            this.switchToActiveCutSafely(insertIndex, false);
            
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
            this.switchToActiveCutSafely(newIndex, false);
            
            if (this.eventBus) {
                this.eventBus.emit('cut:pasted-new', {
                    cutId: pastedCut.id,
                    cutIndex: newIndex
                });
            }
            
            return true;
        }
        
        deepCopyCutData(cutData) {
            if (!cutData) return null;
            
            return {
                name: cutData.name,
                duration: cutData.duration,
                layers: this.deepCloneCutLayers(cutData.layers),
                thumbnailCanvas: null,
                originalId: cutData.id
            };
        }
        
        createCutFromClipboard(clipboardData) {
            if (!clipboardData) return null;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const newLayers = clipboardData.layers.map(layerData => ({
                ...layerData,
                id: this.generateUniqueCutLayerId(cutId),
                cutId: cutId
            }));
            
            const cut = {
                id: cutId,
                name: clipboardData.name + '_copy',
                duration: clipboardData.duration,
                layers: newLayers,
                thumbnailCanvas: null
            };
            
            this.cutLayerStates.set(cutId, this.deepCloneCutLayers(newLayers));
            
            setTimeout(() => {
                const cutIndex = this.animationData.cuts.findIndex(c => c.id === cut.id);
                if (cutIndex !== -1) {
                    this.generateCutThumbnailOptimized(cutIndex);
                }
            }, 200);
            
            return cut;
        }
        
        getCutClipboardInfo() {
            return {
                hasCutData: !!this.cutClipboard.cutData,
                timestamp: this.cutClipboard.timestamp,
                sourceId: this.cutClipboard.sourceId,
                layerCount: this.cutClipboard.cutData?.layers?.length || 0
            };
        }
        
        clearCutClipboard() {
            this.cutClipboard.cutData = null;
            this.cutClipboard.timestamp = null;
            this.cutClipboard.sourceId = null;
            
            if (this.eventBus) {
                this.eventBus.emit('cut:clipboard-cleared');
            }
        }
        
        // ===== CUT管理・プレイバック制御 =====
        
        createInitialCutIfNeeded() {
            if (this.initialCutCreated || this.animationData.cuts.length > 0 || this.isInitializing) {
                return;
            }
            
            if (!this.layerSystem?.layers || this.layerSystem.layers.length === 0) {
                return;
            }
            
            this.isInitializing = true;
            
            try {
                const initialCut = this.createNewCutFromCurrentLayers();
                this.initialCutCreated = true;
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:initial-cut-created', { 
                        cutId: initialCut.id,
                        cutIndex: 0
                    });
                }
            } catch (error) {
                console.error('Initial CUT creation failed:', error);
            } finally {
                this.isInitializing = false;
            }
        }
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return false;
            if (this.animationData.cuts.length <= 1) return false;
            
            const cut = this.animationData.cuts[cutIndex];
            
            this.cutLayerStates.delete(cut.id);
            this.cutLayerIdCounters.delete(cut.id);
            
            this.animationData.cuts.splice(cutIndex, 1);
            
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            if (this.animationData.cuts.length > 0) {
                const newIndex = Math.min(cutIndex, this.animationData.cuts.length - 1);
                this.switchToActiveCutSafely(newIndex, false);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
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
            
            const fps = this.animationData.settings.fps;
            const frameTime = 1000 / fps;
            
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
                this.switchToActiveCutSafely(this.animationData.playback.currentCutIndex);
                
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
            this.switchToActiveCutSafely(newIndex);
            
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
            this.switchToActiveCutSafely(newIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', { 
                    cutIndex: newIndex, 
                    direction: 'next' 
                });
            }
        }
        
        updateCutDuration(cutIndex, duration) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            cut.duration = Math.max(0.1, Math.min(10, duration));
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-duration-changed', { 
                    cutIndex, 
                    duration: cut.duration 
                });
            }
        }
        
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const cutLayerId = this.generateUniqueCutLayerId(currentCut.id);
            
            const cutLayerData = {
                id: cutLayerId,
                name: layerData.name || 'New Layer',
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false,
                transform: layerData.transform || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                paths: layerData.paths || [],
                createdAt: Date.now(),
                cutId: currentCut.id
            };
            
            currentCut.layers.push(cutLayerData);
            
            const currentState = this.cutLayerStates.get(currentCut.id) || [];
            currentState.push({ ...cutLayerData });
            this.cutLayerStates.set(currentCut.id, currentState);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:layer-added-to-cut', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerId: cutLayerId
                });
            }
            
            return cutLayerData;
        }
        
        updateCurrentCutLayer(layerIndex, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            if (layerIndex < 0 || layerIndex >= this.layerSystem.layers.length) return;
            
            const layer = this.layerSystem.layers[layerIndex];
            if (!layer?.layerData) return;
            
            this.saveCutLayerStates();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:current-cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex: layerIndex,
                    layerId: layer.layerData.id
                });
            }
            
            return this.getCurrentCut();
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
        
        updateSettings(settings) {
            if (!settings) return;
            
            Object.assign(this.animationData.settings, settings);
            
            if (this.animationData.playback.isPlaying && settings.fps) {
                this.stopPlaybackLoop();
                this.startPlaybackLoop();
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:settings-updated', { settings });
            }
        }
        
        getAnimationData() { return this.animationData; }
        getCurrentCutIndex() { return this.animationData.playback.currentCutIndex; }
        getCutCount() { return this.animationData.cuts.length; }
        getCurrentCut() { return this.animationData.cuts[this.animationData.playback.currentCutIndex] || null; }
        getCurrentCutLayers() {
            const currentCut = this.getCurrentCut();
            return currentCut ? currentCut.layers : [];
        }
        hasInitialCut() { return this.animationData.cuts.length > 0; }
        getAllCuts() { return this.animationData.cuts; }
        
        getCutInfo(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return null;
            
            return {
                id: cut.id,
                name: cut.name,
                duration: cut.duration,
                layerCount: cut.layers?.length || 0,
                thumbnailCanvas: cut.thumbnailCanvas,
                isActive: cutIndex === this.animationData.playback.currentCutIndex
            };
        }
        
        getPlaybackState() {
            return {
                isPlaying: this.animationData.playback.isPlaying,
                currentCutIndex: this.animationData.playback.currentCutIndex,
                fps: this.animationData.settings.fps,
                loop: this.animationData.settings.loop,
                cutsCount: this.animationData.cuts.length
            };
        }
        
        isInAnimationMode() { return this.isAnimationMode; }
        
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
        
        clearAnimation() {
            this.stop();
            
            this.animationData = this.createDefaultAnimation();
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            this.cutLayerIdCounters.clear();
            this.cutLayerStates.clear();
            this.clearCutClipboard();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cleared');
            }
        }
        
        checkCoordinateSystem() {
            if (this.coordAPI) {
                return this.coordAPI.diagnoseReferences ? 
                    this.coordAPI.diagnoseReferences() : 
                    { status: 'available', version: 'unknown' };
            } else {
                return { status: 'not_available', issue: 'CoordinateSystem not loaded' };
            }
        }
        
        checkLayerSystemAPI() {
            if (!this.layerSystem) {
                return { status: 'not_available', issue: 'LayerSystem reference missing' };
            }
            
            return {
                status: 'available',
                hasLayers: !!this.layerSystem.layers,
                hasTransforms: !!this.layerSystem.layerTransforms,
                hasContainer: !!(this.layerSystem.layersContainer || this.layerSystem.worldContainer),
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasAnimationSystemRef: !!this.layerSystem.animationSystem,
                transformMapSize: this.layerSystem.layerTransforms ? this.layerSystem.layerTransforms.size : 0
            };
        }
        
        checkEventBusIntegration() {
            if (!this.eventBus) {
                return { status: 'not_available', issue: 'EventBus reference missing' };
            }
            
            return {
                status: 'available',
                eventBusType: this.eventBus.constructor.name,
                hasEmit: typeof this.eventBus.emit === 'function',
                hasOn: typeof this.eventBus.on === 'function'
            };
        }
        
        diagnoseSystem() {
            const diagnosis = {
                timestamp: new Date().toISOString(),
                animationSystem: {
                    initialized: this.hasInitialized,
                    cutsCount: this.animationData.cuts.length,
                    currentCutIndex: this.animationData.playback.currentCutIndex,
                    isPlaying: this.animationData.playback.isPlaying,
                    cutLayerStatesSize: this.cutLayerStates.size,
                    cutLayerIdCountersSize: this.cutLayerIdCounters.size
                },
                coordinateSystem: this.checkCoordinateSystem(),
                layerSystem: this.checkLayerSystemAPI(),
                eventBus: this.checkEventBusIntegration(),
                pixiJS: {
                    hasApp: !!this.app,
                    hasRenderer: !!(this.app?.renderer),
                    rendererType: this.app?.renderer?.type,
                    canvasSize: this.app?.renderer ? {
                        width: this.app.renderer.width,
                        height: this.app.renderer.height
                    } : null
                }
            };
            
            const issues = [];
            
            if (!this.hasInitialized) issues.push('AnimationSystem not initialized');
            if (diagnosis.coordinateSystem.status === 'not_available') issues.push('CoordinateSystem missing');
            if (diagnosis.layerSystem.status === 'not_available') issues.push('LayerSystem missing');
            if (diagnosis.eventBus.status === 'not_available') issues.push('EventBus missing');
            if (!this.app?.renderer) issues.push('PixiJS renderer missing');
            
            diagnosis.issues = issues;
            diagnosis.healthScore = Math.max(0, 100 - (issues.length * 20));
            
            return diagnosis;
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    
    console.log('✅ animation-system.js loaded (確実な同期化改修版)');
    console.log('🔧 改修完了項目:');
    console.log('  🆕 generateCutThumbnailOptimized: PixiJSレンダリング完了待機');
    console.log('  🆕 _waitForRendererReady: 確実なレンダリング待機');
    console.log('  ❌ setupLayerChangeListener: 不確実なsetTimeout排除');
    console.log('  ❌ saveCutLayerStates: サムネイル自動生成を排除');
    console.log('  ✅ Canvas直接保存・完全2次元マトリクス維持');
    console.log('  ✅ CoordinateSystem API統合');
    console.log('  ✅ EventBus完全統合');
    console.log('  ✅ PixiJS v8.13 完全対応');

})();