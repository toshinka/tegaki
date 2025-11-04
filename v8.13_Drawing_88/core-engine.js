// ===== core-engine.js - Phase 2対応: チェッカーパターン配置 =====

(function() {
    'use strict';
    
    if (!window.TegakiCameraSystem) throw new Error('system/camera-system.js required');
    if (!window.TegakiLayerSystem) throw new Error('system/layer-system.js required');
    if (!window.TegakiDrawingClipboard) throw new Error('system/drawing-clipboard.js required');
    if (!window.TegakiEventBus) throw new Error('system/event-bus.js required');
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) throw new Error('config.js required');
    if (!CONFIG.animation) throw new Error('Animation configuration required');

    class UnifiedKeyHandler {
        constructor(cameraSystem, layerSystem, drawingEngine, eventBus, animationSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.drawingEngine = drawingEngine;
            this.eventBus = eventBus || window.TegakiEventBus;
            this.animationSystem = animationSystem;
            this.timelineUI = null;
            this.keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
            this.keyHandlingActive = true;
            
            this.setupKeyHandling();
        }
        
        setTimelineUI(timelineUI) {
            this.timelineUI = timelineUI;
        }
        
        setupKeyHandling() {
            document.addEventListener('keydown', (e) => {
                if (!this.keyHandlingActive) return;
                
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                const metaKey = isMac ? e.metaKey : e.ctrlKey;
                if (metaKey && (e.code === 'KeyZ' || e.code === 'KeyY')) return;
                
                this.handleKeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                if (!this.keyHandlingActive) return;
                this.handleKeyUp(e);
            });
            
            window.addEventListener('blur', () => this.resetAllKeyStates());
            window.addEventListener('focus', () => this.resetAllKeyStates());
        }
        
        handleKeyDown(e) {
            if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || 
                e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                this.handleArrowKeys(e);
                return;
            }
            
            const action = this.keyConfig.getActionForKey(e.code, {
                vPressed: this.layerSystem.vKeyPressed,
                shiftPressed: e.shiftKey,
                altPressed: e.altKey
            });
            
            if (this.handleSpecialKeys(e)) return;
            if (!action) return;
            
            switch(action) {
                case 'pen':
                    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.switchTool('pen');
                        if (this.layerSystem.isLayerMoveMode) {
                            this.layerSystem.exitLayerMoveMode();
                        }
                        e.preventDefault();
                    }
                    break;
                    
                case 'eraser':
                    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.switchTool('eraser');
                        if (this.layerSystem.isLayerMoveMode) {
                            this.layerSystem.exitLayerMoveMode();
                        }
                        e.preventDefault();
                    }
                    break;
                
                case 'layerMoveMode':
                    if (e.code === 'KeyV' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.layerSystem.toggleLayerMoveMode();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifToggleAnimation':
                    if (e.altKey && this.timelineUI) {
                        this.timelineUI.toggle();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifAddCut':
                    if (e.altKey && this.animationSystem) {
                        this.animationSystem.createCutFromCurrentState();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifPlayPause':
                    if (e.code === 'Space' && e.ctrlKey && this.timelineUI && this.timelineUI.isVisible) {
                        this.timelineUI.togglePlayStop();
                        e.preventDefault();
                    }
                    break;
                
                case 'delete':
                case 'LAYER_DELETE_DRAWINGS':
                    if ((e.code === 'Delete' || e.code === 'Backspace') && 
                        !e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.deleteActiveLayerDrawings();
                        e.preventDefault();
                    }
                    break;
            }
        }
        
        deleteActiveLayerDrawings() {
            if (!this.layerSystem) return;
            
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) return;
            
            if (activeLayer.layerData.isBackground) return;
            
            const layerIndex = this.layerSystem.activeLayerIndex;
            
            const childrenToRemove = [];
            for (let child of activeLayer.children) {
                if (child !== activeLayer.layerData.backgroundGraphics) {
                    childrenToRemove.push(child);
                }
            }
            
            if (childrenToRemove.length === 0) return;
            
            if (window.History && !window.History._manager?.isApplying) {
                const command = {
                    name: 'clear-layer-drawings',
                    do: () => {
                        childrenToRemove.forEach(child => {
                            activeLayer.removeChild(child);
                            if (child.destroy) {
                                child.destroy({ children: true });
                            }
                        });
                        
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:cleared', { 
                                layerIndex,
                                objectCount: childrenToRemove.length 
                            });
                        }
                    },
                    undo: () => {
                        childrenToRemove.forEach(child => {
                            activeLayer.addChild(child);
                        });
                        
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:restored', { 
                                layerIndex,
                                objectCount: childrenToRemove.length 
                            });
                        }
                    },
                    meta: { 
                        type: 'clear-layer-drawings',
                        layerId: activeLayer.layerData.id,
                        objectCount: childrenToRemove.length
                    }
                };
                
                window.History.push(command);
            } else {
                childrenToRemove.forEach(child => {
                    activeLayer.removeChild(child);
                    if (child.destroy) {
                        child.destroy({ children: true });
                    }
                });
                
                this.layerSystem.requestThumbnailUpdate(layerIndex);
                
                if (this.eventBus) {
                    this.eventBus.emit('layer:cleared', { 
                        layerIndex,
                        objectCount: childrenToRemove.length 
                    });
                }
            }
        }
        
        handleArrowKeys(e) {
            e.preventDefault();
            
            if (this.layerSystem?.vKeyPressed) return;
            
            const activeIndex = this.layerSystem.activeLayerIndex;
            const layers = this.layerSystem.getLayers();
            
            if (e.ctrlKey) {
                if (e.code === 'ArrowUp') {
                    if (activeIndex < layers.length - 1) {
                        const layer = layers[activeIndex];
                        const targetLayer = layers[activeIndex + 1];
                        
                        if (!layer?.layerData?.isBackground && !targetLayer?.layerData?.isBackground) {
                            this.layerSystem.currentCutContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentCutContainer.addChildAt(layer, activeIndex + 1);
                            this.layerSystem.activeLayerIndex = activeIndex + 1;
                            this.layerSystem.updateLayerPanelUI();
                            
                            this.eventBus.emit('layer:order:changed', {
                                oldIndex: activeIndex,
                                newIndex: activeIndex + 1,
                                direction: 'up'
                            });
                        }
                    }
                } else if (e.code === 'ArrowDown') {
                    if (activeIndex > 0) {
                        const layer = layers[activeIndex];
                        const targetLayer = layers[activeIndex - 1];
                        
                        if (!layer?.layerData?.isBackground && !targetLayer?.layerData?.isBackground) {
                            this.layerSystem.currentCutContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentCutContainer.addChildAt(layer, activeIndex - 1);
                            this.layerSystem.activeLayerIndex = activeIndex - 1;
                            this.layerSystem.updateLayerPanelUI();
                            
                            this.eventBus.emit('layer:order:changed', {
                                oldIndex: activeIndex,
                                newIndex: activeIndex - 1,
                                direction: 'down'
                            });
                        }
                    }
                }
                else if (e.code === 'ArrowLeft' && this.timelineUI && this.timelineUI.isVisible) {
                    this.timelineUI.goToPreviousCutSafe();
                } else if (e.code === 'ArrowRight' && this.timelineUI && this.timelineUI.isVisible) {
                    this.timelineUI.goToNextCutSafe();
                }
            } else {
                if (e.code === 'ArrowUp') {
                    if (activeIndex < layers.length - 1) {
                        const oldIndex = activeIndex;
                        this.layerSystem.activeLayerIndex = activeIndex + 1;
                        this.layerSystem.updateLayerPanelUI();
                        
                        this.eventBus.emit('layer:selection:changed', {
                            oldIndex,
                            newIndex: activeIndex + 1
                        });
                    }
                } else if (e.code === 'ArrowDown') {
                    if (activeIndex > 0) {
                        const oldIndex = activeIndex;
                        this.layerSystem.activeLayerIndex = activeIndex - 1;
                        this.layerSystem.updateLayerPanelUI();
                        
                        this.eventBus.emit('layer:selection:changed', {
                            oldIndex,
                            newIndex: activeIndex - 1
                        });
                    }
                }
            }
        }
        
        handleKeyUp(e) {}
        
        handleSpecialKeys(e) {
            if (e.ctrlKey && e.code === 'Digit0') return false;
            if (e.code === 'Space') return false;
            return false;
        }
        
        switchTool(tool) {
            if (this.drawingEngine) {
                this.drawingEngine.setTool(tool);
            }
            
            this.cameraSystem.updateCursor();
            
            this.eventBus.emit('tool:changed', { newTool: tool });
        }
        
        resetAllKeyStates() {
            if (this.cameraSystem._resetAllKeyStates) {
                this.cameraSystem._resetAllKeyStates();
            }
        }
        
        setKeyHandlingActive(active) {
            this.keyHandlingActive = active;
            this.eventBus.emit('keyboard:handling:changed', { active });
        }
    }

    class CoreEngine {
        constructor(app, config = {}) {
            this.app = app;
            this.isBookmarkletMode = config.isBookmarkletMode || false;
            this.eventBus = window.TegakiEventBus;
            if (!this.eventBus) throw new Error('window.TegakiEventBus required');
            
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            
            this.brushSettings = new BrushSettings(CONFIG, this.eventBus);
            
            this.drawingEngine = new DrawingEngine(
                this.app,
                this.layerSystem,
                this.cameraSystem,
                window.History
            );
            
            this.drawingEngine.setBrushSettings(this.brushSettings);
            
            this.animationSystem = null;
            this.timelineUI = null;
            this.keyHandler = null;
            this.exportManager = null;
            this.batchAPI = null;
            
            this.setupCrossReferences();
            this.setupSystemEventIntegration();
        }
        
        setupCrossReferences() {
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
            if (this.layerSystem.transform && !this.layerSystem.transform.app) {
                if (this.layerSystem.initTransform) {
                    this.layerSystem.initTransform();
                }
            }
            
            this.clipboardSystem.setLayerManager(this.layerSystem);
        }
        
        setupSystemEventIntegration() {
            this.eventBus.on('layer:clear-active', () => {
                const activeLayer = this.layerSystem.getActiveLayer();
                if (!activeLayer || !activeLayer.layerData) return;
                if (activeLayer.layerData.isBackground) return;
                
                const layerIndex = this.layerSystem.activeLayerIndex;
                const childrenSnapshot = [...activeLayer.children];
                
                if (window.History) {
                    const command = {
                        name: 'clear-layer',
                        do: () => {
                            activeLayer.removeChildren();
                            childrenSnapshot.forEach(child => {
                                if (child.destroy) child.destroy({ children: true });
                            });
                            
                            this.layerSystem.requestThumbnailUpdate(layerIndex);
                            
                            this.eventBus.emit('layer:cleared', { 
                                layerIndex,
                                objectCount: childrenSnapshot.length 
                            });
                        },
                        undo: () => {
                            childrenSnapshot.forEach(child => {
                                activeLayer.addChild(child);
                            });
                            
                            this.layerSystem.requestThumbnailUpdate(layerIndex);
                            
                            this.eventBus.emit('layer:restored', { 
                                layerIndex,
                                objectCount: childrenSnapshot.length 
                            });
                        },
                        meta: { type: 'clear-layer', layerId: activeLayer.id }
                    };
                    
                    window.History.push(command);
                }
            });
            
            this.eventBus.on('layer:activated', (data) => {
                this.eventBus.emit('clipboard:get-info-request');
            });
            
            this.eventBus.on('drawing:completed', (data) => {
                this.eventBus.emit('ui:drawing-completed', data);
            });
        }
        
        initializeAnimationSystem() {
            if (!window.TegakiAnimationSystem || !window.TegakiTimelineUI) return;
            
            this.animationSystem = new window.TegakiAnimationSystem();
            this.animationSystem.init(this.layerSystem, this.app, this.cameraSystem);
            
            this.timelineUI = new window.TegakiTimelineUI(this.animationSystem);
            this.timelineUI.init();
            
            window.animationSystem = this.animationSystem;
            window.timelineUI = this.timelineUI;
            
            this.setupCoordinateSystemReferences();
        }
        
        setupCoordinateSystemReferences() {
            if (!window.CoordinateSystem) return;
            
            if (typeof window.CoordinateSystem.setCameraSystem === 'function') {
                window.CoordinateSystem.setCameraSystem(this.cameraSystem);
            }
            
            if (typeof window.CoordinateSystem.setLayerSystem === 'function') {
                window.CoordinateSystem.setLayerSystem(this.layerSystem);
            }
            
            if (typeof window.CoordinateSystem.setAnimationSystem === 'function' && this.animationSystem) {
                window.CoordinateSystem.setAnimationSystem(this.animationSystem);
            }
        }
        
        _initializeLayerTransform() {
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 100;
            
            const trySetupFlipCallback = () => {
                if (!this.layerSystem?.transform) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(trySetupFlipCallback, retryDelay);
                    }
                    return;
                }
                
                const layerTransform = this.layerSystem.transform;
                
                layerTransform.onFlipRequest = (direction) => {
                    const activeLayer = this.layerSystem.getActiveLayer();
                    if (!activeLayer) return;
                    
                    layerTransform.flipLayer(activeLayer, direction);
                    
                    const layerIndex = this.layerSystem.activeLayerIndex;
                    if (this.eventBus) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'layer-transform',
                            action: 'flip-applied',
                            data: { layerIndex, layerId: activeLayer.layerData.id, immediate: true }
                        });
                    }
                };
            };
            
            trySetupFlipCallback();
        }
        
        async exportForBookmarklet(format = 'gif', options = {}) {
            if (!this.exportManager) throw new Error('ExportManager not initialized');
            
            switch(format.toLowerCase()) {
                case 'png': return await this.exportManager.exportAsPNGBlob(options);
                case 'apng': return await this.exportManager.exportAsAPNGBlob(options);
                case 'gif': return await this.exportManager.exportAsGIFBlob(options);
                case 'webp': return await this.exportManager.exportAsWebPBlob(options);
                default: throw new Error(`Unsupported format: ${format}`);
            }
        }
        
        getCameraSystem() { return this.cameraSystem; }
        getLayerManager() { return this.layerSystem; }
        getDrawingEngine() { return this.drawingEngine; }
        getClipboardSystem() { return this.clipboardSystem; }
        getAnimationSystem() { return this.animationSystem; }
        getTimelineUI() { return this.timelineUI; }
        getKeyHandler() { return this.keyHandler; }
        getEventBus() { return this.eventBus; }
        getExportManager() { return this.exportManager; }
        getBatchAPI() { return this.batchAPI; }
        getBrushSettings() { return this.brushSettings; }
        
        undo() {
            if (window.History) {
                window.History.undo();
                this.eventBus.emit('history:undo', { timestamp: Date.now() });
            }
        }
        
        redo() {
            if (window.History) {
                window.History.redo();
                this.eventBus.emit('history:redo', { timestamp: Date.now() });
            }
        }
        
        setupCanvasEvents() {
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) return;
            
            canvas.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updateCoordinates(x, y);
                this.eventBus.emit('ui:mouse-move', { x, y });
            }, true);
        }
        
        switchTool(tool) {
            if (this.keyHandler) {
                this.keyHandler.switchTool(tool);
            } else {
                this.cameraSystem.updateCursor();
                this.eventBus.emit('tool:changed', { newTool: tool });
            }
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        processThumbnailUpdates() {
            this.layerSystem.processThumbnailUpdates();
        }
        
        resizeCanvas(newWidth, newHeight, options = {}) {
            const oldWidth = CONFIG.canvas.width;
            const oldHeight = CONFIG.canvas.height;
            
            const horizontalAlign = options.horizontalAlign || 'center';
            const verticalAlign = options.verticalAlign || 'center';
            
            let offsetX = 0;
            let offsetY = 0;
            
            const widthDiff = newWidth - oldWidth;
            const heightDiff = newHeight - oldHeight;
            
            if (horizontalAlign === 'left') {
                offsetX = 0;
            } else if (horizontalAlign === 'center') {
                offsetX = widthDiff / 2;
            } else if (horizontalAlign === 'right') {
                offsetX = widthDiff;
            }
            
            if (verticalAlign === 'top') {
                offsetY = 0;
            } else if (verticalAlign === 'center') {
                offsetY = heightDiff / 2;
            } else if (verticalAlign === 'bottom') {
                offsetY = heightDiff;
            }
            
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            // Phase 2: チェッカーパターンも再生成
            if (this.layerSystem.checkerPattern) {
                const oldChecker = this.layerSystem.checkerPattern;
                const wasVisible = oldChecker.visible;
                
                if (oldChecker.parent) {
                    oldChecker.parent.removeChild(oldChecker);
                }
                oldChecker.destroy();
                
                this.layerSystem.checkerPattern = this.layerSystem._createCheckerPatternBackground(newWidth, newHeight);
                this.layerSystem.checkerPattern.visible = wasVisible;
                
                if (this.cameraSystem.canvasContainer) {
                    this.cameraSystem.canvasContainer.addChildAt(this.layerSystem.checkerPattern, 0);
                }
            }
            
            const frames = this.animationSystem?.animationData?.frames || [];
            frames.forEach(frame => {
                const layers = frame.getLayers();
                layers.forEach(layer => {
                    if (layer.layerData?.isBackground) return;
                    
                    if (layer.layerData?.paths) {
                        layer.layerData.paths.forEach(path => {
                            if (path.points) {
                                path.points.forEach(point => {
                                    point.x += offsetX;
                                    point.y += offsetY;
                                });
                            }
                            
                            if (path.graphics) {
                                path.graphics.clear();
                                path.points.forEach(p => {
                                    path.graphics.circle(p.x, p.y, path.size / 2);
                                    path.graphics.fill({
                                        color: path.color,
                                        alpha: path.opacity
                                    });
                                });
                            }
                        });
                    }
                });
            });
            
            const layers = this.layerSystem.getLayers();
            layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill({
                        color: CONFIG.background.color
                    });
                }
            });
            
            for (let i = 0; i < layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            if (this.animationSystem) {
                setTimeout(() => {
                    const animData = this.animationSystem.getAnimationData();
                    if (animData && animData.cuts) {
                        for (let i = 0; i < animData.cuts.length; i++) {
                            if (this.animationSystem.generateCutThumbnail) {
                                this.animationSystem.generateCutThumbnail(i);
                            } else if (this.animationSystem.generateCutThumbnailOptimized) {
                                this.animationSystem.generateCutThumbnailOptimized(i);
                            }
                        }
                    }
                }, 500);
            }
            
            const canvasInfoElement = document.getElementById('canvas-info');
            if (canvasInfoElement) {
                canvasInfoElement.textContent = `${newWidth}×${newHeight}px`;
            }
            
            const resizeSettings = document.getElementById('resize-settings');
            if (resizeSettings) resizeSettings.classList.remove('show');
            
            this.eventBus.emit('canvas:resized', { 
                width: newWidth, 
                height: newHeight,
                oldWidth,
                oldHeight,
                offsetX,
                offsetY,
                horizontalAlign,
                verticalAlign
            });
        }
        
        destroy() {
            if (this.app) {
                this.app.destroy(true, { children: true });
            }
            
            if (this.eventBus && this.eventBus.removeAllListeners) {
                this.eventBus.removeAllListeners();
            }
        }
        
        initialize() {
            console.log('🚀 [CoreEngine] Starting initialization...');
            
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, CONFIG);
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            // ★★★ Phase 2: チェッカーパターンをcanvasContainerに配置 ★★★
            if (this.layerSystem.checkerPattern && this.cameraSystem.canvasContainer) {
                this.layerSystem.attachCheckerPatternToWorld(this.cameraSystem.canvasContainer);
                console.log('✅ [CoreEngine] Checker pattern attached to canvasContainer');
            }
            
            if (window.ThumbnailSystem) {
                window.ThumbnailSystem.app = this.app;
                window.ThumbnailSystem.init(this.eventBus);
            }
            
            if (window.History && typeof window.History.setLayerSystem === 'function') {
                window.History.setLayerSystem(this.layerSystem);
            }
            
            window.layerManager = this.layerSystem;
            window.cameraSystem = this.cameraSystem;
            console.log('✅ [CoreEngine] Global references set');
            
            if (!window.StrokeRecorder) {
                throw new Error('[CoreEngine] StrokeRecorder class not loaded - check script load order in index.html');
            }
            
            window.strokeRecorder = new window.StrokeRecorder(
                window.pressureHandler,
                this.cameraSystem
            );
            console.log('✅ [CoreEngine] window.strokeRecorder created');
            
            if (!window.StrokeRenderer) {
                throw new Error('[CoreEngine] StrokeRenderer class not loaded - check script load order in index.html');
            }
            
            window.strokeRenderer = new window.StrokeRenderer(
                this.app,
                this.layerSystem,
                this.cameraSystem
            );
            console.log('✅ [CoreEngine] window.strokeRenderer created');
            
            if (!window.BrushCore) {
                throw new Error('[CoreEngine] window.BrushCore not found - check brush-core.js load order');
            }
            
            if (!window.BrushCore.init) {
                throw new Error('[CoreEngine] window.BrushCore.init method not found');
            }
            
            window.BrushCore.init();
            
            if (!window.BrushCore.strokeRecorder || !window.BrushCore.layerManager) {
                console.error('[CoreEngine] BrushCore dependencies check:');
                console.error('  - strokeRecorder:', window.BrushCore.strokeRecorder);
                console.error('  - layerManager:', window.BrushCore.layerManager);
                console.error('  - strokeRenderer:', window.BrushCore.strokeRenderer);
                console.error('  - coordinateSystem:', window.BrushCore.coordinateSystem);
                throw new Error('[CoreEngine] BrushCore.init() failed - dependencies not set');
            }
            
            console.log('✅ [CoreEngine] BrushCore initialized and validated');
            
            this.initializeAnimationSystem();
            
            setTimeout(() => {
                this._initializeLayerTransform();
            }, 200);
            
            if (window.TegakiBatchAPI && this.animationSystem) {
                this.batchAPI = new window.TegakiBatchAPI(
                    this.layerSystem,
                    this.animationSystem
                );
                window.batchAPI = this.batchAPI;
            }
            
            if (window.ExportManager && this.animationSystem) {
                this.exportManager = new window.ExportManager(
                    this.app,
                    this.layerSystem,
                    this.animationSystem,
                    this.cameraSystem
                );
            }
            
            this.keyHandler = new UnifiedKeyHandler(
                this.cameraSystem,
                this.layerSystem,
                this.drawingEngine,
                this.eventBus,
                this.animationSystem
            );
            
            if (this.timelineUI) {
                this.keyHandler.setTimelineUI(this.timelineUI);
            }
            
            this.eventBus.on('animation:initial-cut-created', () => {
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
            });
            
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                setTimeout(() => {
                    window.TegakiUI.initializeSortable(this.layerSystem);
                }, 100);
            }
            
            this.setupCanvasEvents();
            
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            window.drawingEngine = this.drawingEngine;
            
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'keyhandler', 'animation', 'history', 'batchapi', 'export']
            });
            
            console.log('✅ [CoreEngine] Initialization complete');
            console.log('   Phase 2: Checker pattern configured');
            console.log('   Phase 3: Eraser transparency ready');
            
            return this;
        }
    }

    window.TegakiCore = {
        CoreEngine: CoreEngine,
        CameraSystem: window.TegakiCameraSystem,
        LayerManager: window.TegakiLayerSystem,
        LayerSystem: window.TegakiLayerSystem,
        DrawingEngine: DrawingEngine,
        ClipboardSystem: window.TegakiDrawingClipboard,
        DrawingClipboard: window.TegakiDrawingClipboard,
        AnimationSystem: window.TegakiAnimationSystem,
        TimelineUI: window.TegakiTimelineUI,
        UnifiedKeyHandler: UnifiedKeyHandler
    };

    console.log('✅ core-engine.js (Phase 2&3対応版) loaded');
    console.log('   Phase 2: チェッカーパターン配置処理追加');
    console.log('   Phase 3: 消しゴム透明化対応完了');

})();