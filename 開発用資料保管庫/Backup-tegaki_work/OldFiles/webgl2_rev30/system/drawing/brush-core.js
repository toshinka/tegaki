/**
 * ============================================================
 * brush-core.js - Phase C-2.1: History登録修正版
 * ============================================================
 * 【親依存】
 * - drawing-engine.js (呼び出し元)
 * - system/event-bus.js
 * - coordinate-system.js
 * - system/drawing/pressure-handler.js
 * - system/drawing/stroke-recorder.js
 * - system/drawing/stroke-renderer.js
 * - system/layer-system.js
 * - system/drawing/brush-settings.js
 * - system/drawing/fill-tool.js
 * - system/history.js
 * 
 * 【Phase C-2.1改修内容】
 * ✅ History登録時の二重追加問題を修正
 * ✅ do()内での配列操作を削除（History.push前に完了）
 * ✅ Undo/Redo安定化
 * ✅ Phase B-3全機能継承
 * ============================================================
 */

(function() {
    'use strict';

    class BrushCore {
        constructor() {
            this.isDrawing = false;
            this.currentStrokeId = null;
            this.lastLocalX = 0;
            this.lastLocalY = 0;
            this.lastPressure = 0;
            
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            this.coordinateSystem = null;
            this.pressureHandler = null;
            this.strokeRecorder = null;
            this.layerManager = null;
            this.strokeRenderer = null;
            this.eventBus = null;
            this.brushSettings = null;
            this.fillTool = null;
            
            this.previewGraphics = null;
            this.eventListenersSetup = false;
        }
        
        init() {
            if (this.coordinateSystem) {
                console.warn('[BrushCore] Already initialized');
                return;
            }
            
            this.coordinateSystem = window.CoordinateSystem;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            this.brushSettings = window.brushSettings;
            this.fillTool = window.FillTool;
            
            this._initializePressureHandler();
            
            if (!this.coordinateSystem) {
                throw new Error('[BrushCore] window.CoordinateSystem not initialized');
            }
            if (!this.layerManager) {
                throw new Error('[BrushCore] window.layerManager not initialized');
            }
            if (!this.strokeRecorder) {
                throw new Error('[BrushCore] window.strokeRecorder not initialized');
            }
            if (!this.strokeRenderer) {
                throw new Error('[BrushCore] window.strokeRenderer not initialized');
            }
            
            if (!this.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will use defaults');
            }
            
            this._setupEventListeners();
        }
        
        _initializePressureHandler() {
            if (window.pressureHandler) {
                this.pressureHandler = window.pressureHandler;
                return;
            }
            
            if (!window.PressureHandler) {
                console.error('[BrushCore] window.PressureHandler not available!');
                return;
            }
            
            try {
                window.pressureHandler = new window.PressureHandler();
                this.pressureHandler = window.pressureHandler;
            } catch (error) {
                console.error('[BrushCore] Failed to initialize PressureHandler:', error);
            }
        }
        
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) {
                return;
            }
            
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) {
                    if (this.strokeRenderer && this.strokeRenderer.setTool) {
                        this.strokeRenderer.setTool(data.mode);
                    }
                }
            });
            
            this.eventListenersSetup = true;
        }
        
        _getCurrentSettings() {
            if (!this.brushSettings) {
                return {
                    size: 3,
                    opacity: 1.0,
                    color: 0x800000,
                    mode: 'pen'
                };
            }
            
            return this.brushSettings.getSettings();
        }
        
        setMode(mode) {
            const validModes = ['pen', 'eraser', 'fill'];
            
            if (!validModes.includes(mode)) {
                console.error(`[BrushCore] Invalid brush mode: ${mode}`);
                return;
            }
            
            if (this.brushSettings) {
                this.brushSettings.setMode(mode);
            } else {
                console.warn('[BrushCore] BrushSettings not available, cannot set mode');
            }
            
            if (mode !== 'fill' && this.strokeRenderer && this.strokeRenderer.setTool) {
                this.strokeRenderer.setTool(mode);
            }
        }
        
        getMode() {
            if (this.brushSettings) {
                return this.brushSettings.getMode();
            }
            return 'pen';
        }
        
        startStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            const currentMode = this.getMode();
            
            if (currentMode === 'fill') {
                return;
            }
            
            if (this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
            this.strokeRecorder.startStroke(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            this.lastTiltX = tiltX;
            this.lastTiltY = tiltY;
            this.lastTwist = twist;
            
            const settings = this._getCurrentSettings();
            if (this.strokeRenderer.startStroke) {
                this.strokeRenderer.startStroke(settings);
            }
            
            if (this.strokeRenderer.currentStroke) {
                this.previewGraphics = this.strokeRenderer.currentStroke;
                activeLayer.addChild(this.previewGraphics);
            } else {
                this.previewGraphics = new PIXI.Graphics();
                this.previewGraphics.label = 'strokePreview';
                activeLayer.addChild(this.previewGraphics);
            }
            
            this.strokeRenderer.renderPreview(
                [{
                    x: localX,
                    y: localY,
                    pressure: processedPressure,
                    tiltX: tiltX,
                    tiltY: tiltY,
                    twist: twist
                }],
                settings,
                this.previewGraphics
            );
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-started', {
                    component: 'drawing',
                    action: 'stroke-started',
                    data: {
                        mode: currentMode,
                        layerId: activeLayer.layerData?.id,
                        localX,
                        localY,
                        pressure: processedPressure,
                        tiltX,
                        tiltY,
                        twist
                    }
                });
            }
        }
        
        updateStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
            const dx = localX - this.lastLocalX;
            const dy = localY - this.lastLocalY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.max(1, Math.floor(distance / 5));
            
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                const interpX = this.lastLocalX + dx * t;
                const interpY = this.lastLocalY + dy * t;
                const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;
                const interpTiltX = this.lastTiltX + (tiltX - this.lastTiltX) * t;
                const interpTiltY = this.lastTiltY + (tiltY - this.lastTiltY) * t;
                const interpTwist = this.lastTwist + (twist - this.lastTwist) * t;
                
                this.strokeRecorder.addPoint(interpX, interpY, interpPressure, interpTiltX, interpTiltY, interpTwist);
            }
            
            this.strokeRecorder.addPoint(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            if (this.previewGraphics) {
                const currentPoints = this.strokeRecorder.getCurrentPoints();
                const settings = this._getCurrentSettings();
                
                if (!this.strokeRenderer.currentStroke) {
                    this.previewGraphics.clear();
                }
                
                this.strokeRenderer.renderPreview(
                    currentPoints,
                    settings,
                    this.previewGraphics
                );
            }
            
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            this.lastTiltX = tiltX;
            this.lastTiltY = tiltY;
            this.lastTwist = twist;
        }
        
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            const isIncrementalStroke = this.strokeRenderer.currentStroke === this.previewGraphics;
            
            if (this.previewGraphics && this.previewGraphics.parent && !isIncrementalStroke) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
            }
            
            this.previewGraphics = null;
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            const graphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings
            );
            
            if (graphics) {
                // Phase C-2.1: History.push前に追加完了
                if (!isIncrementalStroke) {
                    activeLayer.addChild(graphics);
                }
                
                if (window.pixiApp && window.pixiApp.renderer) {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                }
                
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.pathsData) {
                        activeLayer.layerData.pathsData = [];
                    }
                    
                    if (!activeLayer.layerData.paths) {
                        activeLayer.layerData.paths = [];
                    }
                    
                    const pathData = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        graphics: graphics,
                        points: strokeData.points,
                        tool: mode,
                        settings: { ...settings },
                        color: settings.color,
                        size: settings.size,
                        opacity: settings.opacity
                    };
                    
                    // Phase C-2.1: 配列に追加（History.push前に完了）
                    activeLayer.layerData.pathsData.push(pathData);
                    activeLayer.layerData.paths.push(pathData);
                    
                    // Phase C-2.1: History登録（do()は既に追加済みなので重複追加しない）
                    if (window.History && !window.History._manager?.isApplying) {
                        const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                        const layerId = activeLayer.layerData.id;
                        
                        const pathDataRef = pathData;
                        const graphicsRef = graphics;
                        const pathsArrayRef = activeLayer.layerData.paths;
                        const pathsDataArrayRef = activeLayer.layerData.pathsData;
                        
                        const entry = {
                            name: 'stroke-draw',
                            do: () => {
                                // Phase C-2.1: 既に追加済みなので、Redo時のみ実行
                                if (!activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.addChild(graphicsRef);
                                }
                                if (!pathsArrayRef.includes(pathDataRef)) {
                                    pathsArrayRef.push(pathDataRef);
                                }
                                if (!pathsDataArrayRef.includes(pathDataRef)) {
                                    pathsDataArrayRef.push(pathDataRef);
                                }
                                
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            undo: () => {
                                if (activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.removeChild(graphicsRef);
                                }
                                
                                const pathIndex = pathsArrayRef.indexOf(pathDataRef);
                                if (pathIndex !== -1) {
                                    pathsArrayRef.splice(pathIndex, 1);
                                }
                                
                                const pathDataIndex = pathsDataArrayRef.indexOf(pathDataRef);
                                if (pathDataIndex !== -1) {
                                    pathsDataArrayRef.splice(pathDataIndex, 1);
                                }
                                
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            meta: {
                                type: 'stroke',
                                layerId: layerId,
                                layerIndex: layerIndex,
                                mode: mode,
                                pointCount: strokeData.points.length
                            }
                        };
                        
                        window.History.push(entry);
                    }
                }
                
                const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                
                if (this.eventBus && layerIndex !== -1) {
                    this.eventBus.emit('layer:path-added', {
                        component: 'drawing',
                        action: 'path-added',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            mode: mode
                        }
                    });
                    
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'drawing',
                        action: 'stroke-completed',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            immediate: true
                        }
                    });
                }
            } else {
                console.warn('[BrushCore] Graphics rendering failed');
            }
            
            this.isDrawing = false;
            
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-completed', {
                    component: 'drawing',
                    action: 'stroke-completed',
                    data: {
                        mode: mode,
                        layerId: activeLayer.layerData?.id,
                        pointCount: strokeData.points.length
                    }
                });
            }
        }
        
        cancelStroke() {
            if (!this.isDrawing) return;
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            if (this.strokeRenderer && this.strokeRenderer.cancelStroke) {
                this.strokeRenderer.cancelStroke();
            }
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            this.isDrawing = false;
            
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-cancelled', {
                    component: 'drawing',
                    action: 'stroke-cancelled',
                    data: {}
                });
            }
        }
        
        isActive() {
            return this.isDrawing;
        }
    }
    
    window.BrushCore = new BrushCore();
    
    console.log('✅ brush-core.js Phase C-2.1 loaded (History登録修正版)');
    console.log('   ✅ History.push前に配列追加完了（二重追加防止）');
    console.log('   ✅ do()は既に追加済みを前提（Redo時のみ実行）');
    console.log('   ✅ Undo/Redo安定化');
    console.log('   ✅ Phase B-3全機能継承');

})();