// ===== core-engine.js - CoordinateUnification統合完全版 =====

(function() {
    'use strict';
    
    if (!window.TegakiCameraSystem) throw new Error('system/camera-system.js required');
    if (!window.TegakiLayerSystem) throw new Error('system/layer-system.js required');
    if (!window.TegakiDrawingClipboard) throw new Error('system/drawing-clipboard.js required');
    if (!window.TegakiEventBus) throw new Error('system/event-bus.js required');
    if (!window.TegakiCoordinateUnification) throw new Error('system/coordinate-unification.js required');
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) throw new Error('config.js required');
    if (!CONFIG.animation) throw new Error('Animation configuration required');
    if (!window.TEGAKI_KEYCONFIG_MANAGER) throw new Error('KeyConfig manager required');

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
                            this.layerSystem.currentFrameContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentFrameContainer.addChildAt(layer, activeIndex + 1);
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
                            this.layerSystem.currentFrameContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentFrameContainer.addChildAt(layer, activeIndex - 1);
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
            
            // ✅ CoordinateUnification インスタンス作成
            this.coordinateUnification = new window.TegakiCoordinateUnification(
                CONFIG,
                this.eventBus
            );
            
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
            
            // ✅ CoordinateUnificationを LayerSystem に設定
            this.layerSystem.coordinateUnification = this.coordinateUnification;
            
            // ✅ LayerSystem初期化時にCoordinateUnificationが準備される
            if (this.layerSystem.initTransform) {
                this.layerSystem.initTransform();
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
            // ✅ CoordinateUnification を各システムに提供
            if (this.coordinateUnification) {
                this.coordinateUnification.init(
                    this.layerSystem,
                    this.cameraSystem,
                    this.cameraSystem.canvasContainer
                );
            }
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
        getCoordinateUnification() { return this.coordinateUnification; }
        getExportManager() { return this.exportManager; }
        
        async initialize() {
            if (!this.app?.stage || !this.app.stage.parent) {
                throw new Error('PIXI App not properly initialized');
            }
            
            const cameraContainer = this.app.stage.parent;
            
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, CONFIG);
            
            // ✅ CoordinateUnification初期化
            this.setupCoordinateSystemReferences();
            
            if (window.TegakiExportManager) {
                this.exportManager = new window.TegakiExportManager(
                    this.app,
                    this.layerSystem,
                    this.cameraSystem
                );
                this.exportManager.init();
            }
            
            this.initializeAnimationSystem();
            
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
            
            if (window.CoreRuntime) {
                window.CoreRuntime.init({
                    app: this.app,
                    worldContainer: this.cameraSystem.worldContainer,
                    canvasContainer: this.cameraSystem.canvasContainer,
                    cameraSystem: this.cameraSystem,
                    layerManager: this.layerSystem,
                    drawingEngine: this.drawingEngine
                });
            }
            
            this.eventBus.emit('engine:initialized', {
                cameraSystem: this.cameraSystem,
                layerSystem: this.layerSystem,
                drawingEngine: this.drawingEngine,
                coordinateUnification: this.coordinateUnification
            });
            
            return this;
        }

        destroy() {
            if (this.animationSystem) {
                this.animationSystem.destroy();
            }
            if (this.layerSystem) {
                this.layerSystem.destroy();
            }
            if (this.coordinateUnification) {
                this.coordinateUnification.destroy();
            }
            if (this.drawingEngine) {
                this.drawingEngine.destroy();
            }
        }
    }

    window.TegakiCoreEngine = CoreEngine;

})();