// ===== system/animation-system.js - Phase 1/2改修版 =====
// CUT・レイヤー2次元マトリクス修正計画書 Phase 1/2実装
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
            
            this.cutClipboard = {
                cutData: null,
                timestamp: null,
                sourceId: null
            };
            
            this.cutLayerIdCounters = new Map();
            this.coordAPI = window.CoordinateSystem;
        }
        
        init(layerSystem, app) {
            if (this.hasInitialized) return;
            
            this.layerSystem = layerSystem;
            this.app = app;
            
            if (!this.eventBus || !this.layerSystem?.layers) {
                console.error('❌ EventBus or LayerSystem not available');
                return;
            }
            
            this.layerSystem.animationSystem = this;
            this.setupCutClipboardEvents();
            this.hasInitialized = true;
            
            setTimeout(() => {
                if (!this.initialCutCreated && !this.isInitializing) {
                    this.createInitialCutIfNeeded();
                }
            }, 100);
            
            setTimeout(() => {
                if (this.eventBus) {
                    this.eventBus.emit('animation:system-ready');
                }
            }, 150);
            
            this.eventBus.emit('animation:initialized');
        }
        
        setupCutClipboardEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('cut:copy-current', () => this.copyCurrent());
            this.eventBus.on('cut:paste-right-adjacent', () => this.pasteRightAdjacent());
            this.eventBus.on('cut:paste-new', () => this.pasteAsNew());
        }
        
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
            
            const copiedLayers = cutData.layers ? cutData.layers.map(layerData => ({
                id: layerData.id,
                name: layerData.name,
                visible: layerData.visible,
                opacity: layerData.opacity,
                isBackground: layerData.isBackground,
                transform: layerData.transform ? { ...layerData.transform } : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                paths: layerData.paths ? layerData.paths.map(pathData => ({
                    id: pathData.id,
                    points: pathData.points ? pathData.points.map(point => ({ ...point })) : [],
                    size: pathData.size,
                    color: pathData.color,
                    opacity: pathData.opacity,
                    tool: pathData.tool
                })) : []
            })) : [];
            
            return {
                name: cutData.name,
                duration: cutData.duration,
                layers: copiedLayers,
                thumbnail: null,
                originalId: cutData.id
            };
        }
        
        createCutFromClipboard(clipboardData) {
            if (!clipboardData?.layers) return null;
            
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const cut = {
                id: cutId,
                name: clipboardData.name + '_copy',
                duration: clipboardData.duration,
                layers: clipboardData.layers.map(layerData => ({
                    ...layerData,
                    id: this.generateUniqueCutLayerId(cutId)
                })),
                thumbnail: null
            };
            
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
            } finally {
                this.isInitializing = false;
            }
        }
        
        createDefaultAnimation() {
            const config = window.TEGAKI_CONFIG.animation;
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
        
        generateUniqueCutLayerId(cutId) {
            if (!this.cutLayerIdCounters.has(cutId)) {
                this.cutLayerIdCounters.set(cutId, 0);
            }
            const counter = this.cutLayerIdCounters.get(cutId);
            this.cutLayerIdCounters.set(cutId, counter + 1);
            return `${cutId}_layer_${counter}`;
        }
        
        createNewCutFromCurrentLayers() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const cutLayers = this.copyCurrentLayersForCutIndependent(cutId);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: cutLayers,
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            this.switchToActiveCutSafely(this.animationData.cuts.length - 1, false);
            
            setTimeout(() => {
                this.generateCutThumbnailOptimized(this.animationData.cuts.length - 1);
            }, 100);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-created', { 
                    cutId: cut.id, 
                    cutIndex: this.animationData.cuts.length - 1 
                });
            }
            
            return cut;
        }
        
        createNewBlankCut() {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const cut = {
                id: cutId,
                name: `CUT${this.animationData.cuts.length + 1}`,
                duration: window.TEGAKI_CONFIG.animation.defaultCutDuration,
                layers: [],
                thumbnail: null
            };
            
            this.animationData.cuts.push(cut);
            const newIndex = this.animationData.cuts.length - 1;
            
            this.switchToActiveCutSafely(newIndex, false);
            
            if (this.layerSystem) {
                const bgLayer = this.layerSystem.createLayer('背景', true);
                if (bgLayer) {
                    this.layerSystem.createLayer('レイヤー1', false);
                    this.saveCutLayerStates();
                }
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
        
        copyCurrentLayersForCutIndependent(cutId) {
            const copiedLayers = [];
            
            if (!this.layerSystem?.layers) return copiedLayers;
            
            this.layerSystem.layers.forEach(originalLayer => {
                if (!originalLayer?.layerData) return;
                
                const newLayerId = this.generateUniqueCutLayerId(cutId);
                
                const transform = this.layerSystem.layerTransforms.get(originalLayer.layerData.id) || {
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1
                };
                
                const pathsData = originalLayer.layerData.paths ? 
                    originalLayer.layerData.paths.map(path => ({
                        id: path.id || ('path_' + Date.now() + Math.random()),
                        points: path.points ? path.points.map(point => ({ ...point })) : [],
                        size: path.size || 16,
                        color: path.color || 0x000000,
                        opacity: path.opacity || 1.0,
                        tool: path.tool || 'pen'
                    })) : [];
                
                const cutLayerData = {
                    id: newLayerId,
                    name: originalLayer.layerData.name,
                    visible: originalLayer.layerData.visible !== false,
                    opacity: originalLayer.layerData.opacity || 1.0,
                    isBackground: originalLayer.layerData.isBackground || false,
                    transform: { ...transform },
                    paths: pathsData
                };
                
                copiedLayers.push(cutLayerData);
            });
            
            return copiedLayers;
        }
        
        copyCurrentLayersForCut() {
            const cutId = 'temp_' + Date.now();
            return this.copyCurrentLayersForCutIndependent(cutId);
        }
        
        switchToActiveCutSafely(cutIndex, resetTransform = true) {
            if (this.cutSwitchInProgress) {
                setTimeout(() => this.switchToActiveCutSafely(cutIndex, resetTransform), 50);
                return;
            }
            
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            this.cutSwitchInProgress = true;
            this.saveCutLayerStatesBeforeSwitch();
            this.animationData.playback.currentCutIndex = cutIndex;
            this.setActiveCut(cutIndex, resetTransform);
            this.cutSwitchInProgress = false;
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-applied', { cutIndex });
            }
        }
        
        switchToActiveCut(cutIndex) {
            return this.switchToActiveCutSafely(cutIndex, true);
        }
        
        saveCutLayerStatesBeforeSwitch() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const currentLayers = this.copyCurrentLayersForCutIndependent(currentCut.id);
            currentCut.layers = currentLayers;
        }
        
        setActiveCut(cutIndex, resetTransform = true) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            this.clearLayerSystemLayers();
            this.rebuildLayersFromCutData(cut.layers, resetTransform);
            
            if (this.layerSystem.updateLayerPanelUI) {
                this.layerSystem.updateLayerPanelUI();
            }
        }
        
        clearLayerSystemLayers() {
            if (!this.layerSystem?.layers) return;
            
            const layersToDestroy = [...this.layerSystem.layers];
            
            layersToDestroy.forEach(layer => {
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
                        layer.destroy();
                    }
                } catch (error) {}
            });
            
            this.layerSystem.layers = [];
            this.layerSystem.layerTransforms.clear();
            this.layerSystem.activeLayerIndex = -1;
        }
        
        rebuildLayersFromCutData(cutLayers, resetTransform = true) {
            if (!cutLayers || !Array.isArray(cutLayers)) return;
            
            cutLayers.forEach((cutLayerData) => {
                try {
                    const layer = new PIXI.Container();
                    layer.label = cutLayerData.id;
                    layer.layerData = {
                        id: cutLayerData.id,
                        name: cutLayerData.name,
                        visible: cutLayerData.visible,
                        opacity: cutLayerData.opacity,
                        isBackground: cutLayerData.isBackground,
                        paths: []
                    };
                    
                    const transform = {
                        x: cutLayerData.transform?.x || 0,
                        y: cutLayerData.transform?.y || 0,
                        rotation: cutLayerData.transform?.rotation || 0,
                        scaleX: cutLayerData.transform?.scaleX || 1,
                        scaleY: cutLayerData.transform?.scaleY || 1
                    };
                    this.layerSystem.layerTransforms.set(cutLayerData.id, transform);
                    
                    if (cutLayerData.isBackground) {
                        const bg = new PIXI.Graphics();
                        bg.rect(0, 0, this.layerSystem.config.canvas.width, this.layerSystem.config.canvas.height);
                        bg.fill(this.layerSystem.config.background.color);
                        layer.addChild(bg);
                        layer.layerData.backgroundGraphics = bg;
                    }
                    
                    cutLayerData.paths.forEach(pathData => {
                        const path = this.rebuildPathFromData(pathData);
                        if (path) {
                            layer.layerData.paths.push(path);
                            layer.addChild(path.graphics);
                        }
                    });
                    
                    layer.visible = cutLayerData.visible;
                    layer.alpha = cutLayerData.opacity;
                    
                    if (!resetTransform && (transform.x !== 0 || transform.y !== 0 || 
                        transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                        Math.abs(transform.scaleY) !== 1)) {
                        this.applyTransformToLayerFixed(layer, transform);
                    } else {
                        layer.position.set(0, 0);
                        layer.pivot.set(0, 0);
                        layer.rotation = 0;
                        layer.scale.set(1, 1);
                    }
                    
                    this.layerSystem.layers.push(layer);
                    this.layerSystem.layersContainer.addChild(layer);
                } catch (error) {}
            });
            
            if (this.layerSystem.layers.length > 0) {
                this.layerSystem.activeLayerIndex = this.layerSystem.layers.length - 1;
            }
        }
        
        applyTransformToLayerFixed(layer, transform) {
            if (!transform || !layer) return;
            
            const centerX = this.layerSystem.config.canvas.width / 2;
            const centerY = this.layerSystem.config.canvas.height / 2;
            
            if (transform.rotation !== 0 || Math.abs(transform.scaleX) !== 1 || 
                Math.abs(transform.scaleY) !== 1) {
                layer.pivot.set(centerX, centerY);
                layer.position.set(centerX + (transform.x || 0), centerY + (transform.y || 0));
                layer.rotation = transform.rotation || 0;
                layer.scale.set(transform.scaleX || 1, transform.scaleY || 1);
            } else if (transform.x !== 0 || transform.y !== 0) {
                layer.pivot.set(0, 0);
                layer.position.set(transform.x || 0, transform.y || 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            } else {
                layer.pivot.set(0, 0);
                layer.position.set(0, 0);
                layer.rotation = 0;
                layer.scale.set(1, 1);
            }
            
            if (this.layerSystem && layer.layerData) {
                this.layerSystem.layerTransforms.set(layer.layerData.id, { ...transform });
            }
        }
        
        rebuildPathFromData(pathData) {
            if (!pathData?.points || pathData.points.length === 0) return null;
            
            try {
                const graphics = new PIXI.Graphics();
                
                pathData.points.forEach(point => {
                    graphics.circle(point.x, point.y, pathData.size / 2);
                    graphics.fill({
                        color: pathData.color,
                        alpha: pathData.opacity
                    });
                });
                
                return {
                    id: pathData.id,
                    points: pathData.points,
                    size: pathData.size,
                    color: pathData.color,
                    opacity: pathData.opacity,
                    tool: pathData.tool,
                    graphics: graphics
                };
            } catch (error) {
                return null;
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
        
        togglePlayPause() {
            if (this.animationData.playback.isPlaying) {
                this.pause();
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
                layerCount: cut.layers.length,
                thumbnail: cut.thumbnail,
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
        
        deleteCut(cutIndex) {
            if (cutIndex < 0 || cutIndex >= this.animationData.cuts.length) return;
            if (this.animationData.cuts.length <= 1) return false;
            
            const cut = this.animationData.cuts[cutIndex];
            
            if (cut.thumbnail) {
                cut.thumbnail.destroy();
            }
            
            this.cutLayerIdCounters.delete(cut.id);
            this.animationData.cuts.splice(cutIndex, 1);
            
            if (this.animationData.playback.currentCutIndex >= cutIndex) {
                this.animationData.playback.currentCutIndex = Math.max(0, 
                    this.animationData.playback.currentCutIndex - 1
                );
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-deleted', { cutIndex });
            }
            
            return true;
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
        
        updateCurrentCutLayer(layerIndex, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const layer = this.layerSystem.layers[layerIndex];
            if (!layer?.layerData) return;
            
            const layerId = layer.layerData.id;
            const cutLayerIndex = currentCut.layers.findIndex(cutLayer => cutLayer.id === layerId);
            
            if (cutLayerIndex === -1) return;
            
            const cutLayer = currentCut.layers[cutLayerIndex];
            
            if (updateData.transform) {
                cutLayer.transform = {
                    x: updateData.transform.x !== undefined ? updateData.transform.x : cutLayer.transform.x,
                    y: updateData.transform.y !== undefined ? updateData.transform.y : cutLayer.transform.y,
                    rotation: updateData.transform.rotation !== undefined ? updateData.transform.rotation : cutLayer.transform.rotation,
                    scaleX: updateData.transform.scaleX !== undefined ? updateData.transform.scaleX : cutLayer.transform.scaleX,
                    scaleY: updateData.transform.scaleY !== undefined ? updateData.transform.scaleY : cutLayer.transform.scaleY
                };
            }
            
            if (updateData.visible !== undefined) {
                cutLayer.visible = updateData.visible;
            }
            
            if (updateData.opacity !== undefined) {
                cutLayer.opacity = updateData.opacity;
            }
            
            if (updateData.paths) {
                cutLayer.paths = updateData.paths;
            }
            
            if (this.eventBus) {
                this.eventBus.emit('animation:current-cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex: cutLayerIndex,
                    layerId: layerId
                });
            }
            
            setTimeout(() => {
                this.generateCutThumbnailOptimized(this.animationData.playback.currentCutIndex);
            }, 100);
            
            return cutLayer;
        }
        
        saveLayerTransformToCurrentCut(layerId, transform) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return;
            
            const layerIndex = currentCut.layers.findIndex(layer => layer.id === layerId);
            if (layerIndex === -1) return;
            
            currentCut.layers[layerIndex].transform = {
                x: transform.x || 0,
                y: transform.y || 0,
                rotation: transform.rotation || 0,
                scaleX: transform.scaleX || 1,
                scaleY: transform.scaleY || 1
            };
            
            setTimeout(() => {
                this.generateCutThumbnailOptimized(this.animationData.playback.currentCutIndex);
            }, 50);
        }
        
        addLayerToCurrentCut(layerData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const existingLayer = currentCut.layers.find(layer => layer.id === layerData.id);
            if (existingLayer) return existingLayer;
            
            const cutLayerId = this.generateUniqueCutLayerId(currentCut.id);
            
            const cutLayerData = {
                id: cutLayerId,
                name: layerData.name,
                visible: layerData.visible !== false,
                opacity: layerData.opacity || 1.0,
                isBackground: layerData.isBackground || false,
                transform: layerData.transform || { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                paths: layerData.paths || []
            };
            
            currentCut.layers.push(cutLayerData);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:layer-added-to-cut', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerId: cutLayerId
                });
            }
            
            return cutLayerData;
        }
        
        updateLayerInCurrentCut(layerId, updateData) {
            const currentCut = this.getCurrentCut();
            if (!currentCut) return null;
            
            const layerIndex = currentCut.layers.findIndex(layer => layer.id === layerId);
            if (layerIndex === -1) return null;
            
            Object.assign(currentCut.layers[layerIndex], updateData);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-layer-updated', {
                    cutIndex: this.animationData.playback.currentCutIndex,
                    layerIndex,
                    layerId
                });
            }
            
            return currentCut.layers[layerIndex];
        }
        
        saveCutLayerStates() {
            const currentCut = this.getCurrentCut();
            if (!currentCut || !this.layerSystem) return;
            
            const savedLayers = this.copyCurrentLayersForCutIndependent(currentCut.id);
            currentCut.layers = savedLayers;
            
            setTimeout(() => {
                this.generateCutThumbnailOptimized(this.animationData.playback.currentCutIndex);
            }, 100);
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cut-updated', { 
                    cutIndex: this.animationData.playback.currentCutIndex,
                    cutId: currentCut.id
                });
            }
        }
        
        async generateCutThumbnailOptimized(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut || !this.layerSystem) return;
            
            try {
                const currentCutIndex = this.animationData.playback.currentCutIndex;
                
                if (cutIndex !== currentCutIndex) {
                    await this.temporarilyApplyCutState(cutIndex);
                }
                
                const thumbnailCanvas = await this.generateLayerCompositeCanvasOptimized();
                
                if (thumbnailCanvas) {
                    const texture = PIXI.Texture.from(thumbnailCanvas);
                    
                    if (cut.thumbnail) {
                        cut.thumbnail.destroy();
                    }
                    
                    cut.thumbnail = texture;
                }
                
                if (cutIndex !== currentCutIndex) {
                    this.switchToActiveCutSafely(currentCutIndex);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-generated', { cutIndex });
                }
                
            } catch (error) {
                if (this.eventBus) {
                    this.eventBus.emit('animation:thumbnail-failed', { cutIndex, error });
                }
            }
        }
        
        async temporarilyApplyCutState(cutIndex) {
            const cut = this.animationData.cuts[cutIndex];
            if (!cut) return;
            
            this.clearLayerSystemLayers();
            this.rebuildLayersFromCutData(cut.layers);
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        async generateLayerCompositeCanvasOptimized() {
            try {
                const thumbWidth = 46;
                const thumbHeight = 34;
                
                const compositeCanvas = document.createElement('canvas');
                compositeCanvas.width = thumbWidth;
                compositeCanvas.height = thumbHeight;
                const ctx = compositeCanvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, thumbWidth, thumbHeight);
                
                for (let i = 0; i < this.layerSystem.layers.length; i++) {
                    const layer = this.layerSystem.layers[i];
                    
                    if (!layer.visible || !layer.layerData.visible) continue;
                    
                    const layerCanvas = await this.renderLayerToCanvasOptimized(layer);
                    
                    if (layerCanvas) {
                        const opacity = layer.alpha * (layer.layerData.opacity || 1.0);
                        ctx.globalAlpha = opacity;
                        ctx.drawImage(layerCanvas, 0, 0, thumbWidth, thumbHeight);
                        ctx.globalAlpha = 1.0;
                    }
                }
                
                return compositeCanvas;
                
            } catch (error) {
                return null;
            }
        }
        
        async renderLayerToCanvasOptimized(layer) {
            try {
                if (!this.app?.renderer) return null;
                
                const width = this.layerSystem.config.canvas.width;
                const height = this.layerSystem.config.canvas.height;
                
                const renderTexture = PIXI.RenderTexture.create({ width, height });
                const tempContainer = new PIXI.Container();
                tempContainer.addChild(layer);
                
                this.app.renderer.render(tempContainer, { renderTexture });
                const canvas = this.app.renderer.extract.canvas(renderTexture);
                
                tempContainer.removeChild(layer);
                this.layerSystem.layersContainer.addChild(layer);
                
                renderTexture.destroy();
                tempContainer.destroy();
                
                return canvas;
                
            } catch (error) {
                return null;
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
        
        clearAnimation() {
            this.stop();
            
            this.animationData.cuts.forEach(cut => {
                if (cut.thumbnail) {
                    cut.thumbnail.destroy();
                }
            });
            
            this.animationData = this.createDefaultAnimation();
            this.initialCutCreated = false;
            this.isInitializing = false;
            this.cutSwitchInProgress = false;
            this.hasInitialized = false;
            this.lastStoppedCutIndex = 0;
            
            this.cutLayerIdCounters.clear();
            this.clearCutClipboard();
            
            if (this.eventBus) {
                this.eventBus.emit('animation:cleared');
            }
        }
        
        checkCoordinateSystem() {
            if (this.coordAPI) {
                return this.coordAPI.diagnoseReferences ? this.coordAPI.diagnoseReferences() : { status: 'available' };
            } else {
                return { status: 'not_available' };
            }
        }
        
        checkLayerSystemAPI() {
            if (!this.layerSystem) {
                return { status: 'not_available' };
            }
            
            return {
                hasLayers: !!this.layerSystem.layers,
                hasTransforms: !!this.layerSystem.layerTransforms,
                hasContainer: !!(this.layerSystem.layersContainer || this.layerSystem.worldContainer),
                layerCount: this.layerSystem.layers ? this.layerSystem.layers.length : 0,
                hasAnimationSystemRef: !!this.layerSystem.animationSystem
            };
        }
        
        debugInfo() {
            const info = {
                isAnimationMode: this.isAnimationMode,
                cutsCount: this.animationData.cuts.length,
                initialCutCreated: this.initialCutCreated,
                isPlaying: this.animationData.playback.isPlaying,
                currentCut: this.animationData.playback.currentCutIndex,
                cutClipboard: this.getCutClipboardInfo(),
                cutLayerIdCountersSize: this.cutLayerIdCounters.size
            };
            
            return info;
        }
    }
    
    window.TegakiAnimationSystem = AnimationSystem;
    console.log('✅ animation-system.js loaded (Phase 1/2改修版)');

})();