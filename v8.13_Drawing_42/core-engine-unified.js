// ===== core-engine.js - CoordinateUnification統合完全版（修正版） =====

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
        getBrushSettings() { return this.brushSettings; }
        
        async initialize() {
            // ✅ 修正: app.stage と app.stage.parent の存在確認
            if (!this.app) {
                throw new Error('PIXI App not provided');
            }
            
            if (!this.app.stage) {
                throw new Error('PIXI App stage not initialized');
            }
            
            if (!this.app.canvas) {
                throw new Error('PIXI App canvas not initialized');
            }
            
            // ✅ CameraSystem初期化
            try {
                this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            } catch (err) {
                console.error('❌ CameraSystem initialization failed:', err);
                throw err;
            }
            
            // ✅ LayerSystem初期化
            try {
                this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, CONFIG);
            } catch (err) {
                console.error('❌ LayerSystem initialization failed:', err);
                throw err;
            }
            
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
            
            // ✅ DrawingEngine に CoordinateUnification を設定
            if (this.drawingEngine.setCoordinateUnification) {
                this.drawingEngine.setCoordinateUnification(this.coordinateUnification);
            }
            
            console.log('✅ CoreEngine initialization complete');
            
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

console.log('✅ core-engine-unified.js (修正版) loaded');