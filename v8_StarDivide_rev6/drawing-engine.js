/**
 * Drawing Engine Satellite - Pen/Eraser Separated Architecture
 * PixiJS描画エンジン・ペン/消しゴム分離・非破壊履歴対応
 * 
 * @module DrawingEngine
 * @role Canvas描画の仲介・Pen/Eraser振る舞い管理
 * @depends MainController, LayerManager, PositionManager
 * @provides EngineBridge(drawTemporaryStroke, commitStroke, clearLayer, takeSnapshot)
 */

window.FutabaDrawingEngine = (function() {
    'use strict';
    
    /**
     * PenEngine - ペン描画専用エンジン
     */
    class PenEngine {
        constructor(stage) {
            this.stage = stage;
            this.tempGraphics = null;
            this.settings = {
                size: 16.0,
                color: 0x800000,
                opacity: 0.85
            };
        }
        
        drawTemp(points) {
            this._clearTemp();
            
            if (points.length === 0) return;
            
            this.tempGraphics = new PIXI.Graphics();
            this.tempGraphics.alpha = this.settings.opacity;
            // No blend mode needed for pen - default is normal
            
            // Draw smooth line with circles for better quality
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                this.tempGraphics.circle(point.x, point.y, this.settings.size / 2);
                this.tempGraphics.fill({ 
                    color: this.settings.color,
                    alpha: 1.0 // Alpha is set on container level
                });
                
                // Connect points with line segments
                if (i > 0) {
                    const prevPoint = points[i - 1];
                    const distance = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                    const steps = Math.max(1, Math.ceil(distance / 1.5));
                    
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const px = prevPoint.x + (point.x - prevPoint.x) * t;
                        const py = prevPoint.y + (point.y - prevPoint.y) * t;
                        
                        this.tempGraphics.circle(px, py, this.settings.size / 2);
                        this.tempGraphics.fill({ 
                            color: this.settings.color,
                            alpha: 1.0
                        });
                    }
                }
            }
            
            this.stage.addChild(this.tempGraphics);
        }
        
        commit(strokeData) {
            const layerContainer = this.stage.getChildByName(strokeData.layerId?.toString());
            if (!layerContainer) {
                console.warn('[PenEngine] Layer container not found:', strokeData.layerId);
                return null;
            }
            
            const graphics = new PIXI.Graphics();
            graphics.alpha = this.settings.opacity;
            // No blend mode needed for pen - default is normal
            
            const points = strokeData.points || [];
            if (points.length > 0) {
                // Create permanent pen stroke
                for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    graphics.circle(point.x, point.y, this.settings.size / 2);
                    graphics.fill({ 
                        color: this.settings.color,
                        alpha: 1.0
                    });
                    
                    // Connect points for smooth line
                    if (i > 0) {
                        const prevPoint = points[i - 1];
                        const distance = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                        const steps = Math.max(1, Math.ceil(distance / 1.5));
                        
                        for (let s = 1; s <= steps; s++) {
                            const t = s / steps;
                            const px = prevPoint.x + (point.x - prevPoint.x) * t;
                            const py = prevPoint.y + (point.y - prevPoint.y) * t;
                            
                            graphics.circle(px, py, this.settings.size / 2);
                            graphics.fill({ 
                                color: this.settings.color,
                                alpha: 1.0
                            });
                        }
                    }
                }
            }
            
            layerContainer.addChild(graphics);
            this._clearTemp();
            
            return {
                id: strokeData.id || `pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: points,
                settings: { ...this.settings },
                toolId: 'pen'
            };
        }
        
        _clearTemp() {
            if (this.tempGraphics) {
                this.stage.removeChild(this.tempGraphics);
                this.tempGraphics.destroy();
                this.tempGraphics = null;
            }
        }
        
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
        }
    }
    
    /**
     * EraserEngine - 消しゴム描画専用エンジン
     */
    class EraserEngine {
        constructor(stage) {
            this.stage = stage;
            this.tempGraphics = null;
            this.settings = {
                size: 20.0,
                opacity: 1.0
            };
        }
        
        drawTemp(points) {
            this._clearTemp();
            
            if (points.length === 0) return;
            
            this.tempGraphics = new PIXI.Graphics();
            // Critical: Set erase blend mode for temporary preview
            this.tempGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            // Draw eraser preview
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                this.tempGraphics.circle(point.x, point.y, this.settings.size / 2);
                this.tempGraphics.fill({ 
                    color: 0xffffff, // White for erasing
                    alpha: this.settings.opacity
                });
                
                // Connect points with line segments
                if (i > 0) {
                    const prevPoint = points[i - 1];
                    const distance = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                    const steps = Math.max(1, Math.ceil(distance / 2.0));
                    
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const px = prevPoint.x + (point.x - prevPoint.x) * t;
                        const py = prevPoint.y + (point.y - prevPoint.y) * t;
                        
                        this.tempGraphics.circle(px, py, this.settings.size / 2);
                        this.tempGraphics.fill({ 
                            color: 0xffffff,
                            alpha: this.settings.opacity
                        });
                    }
                }
            }
            
            this.stage.addChild(this.tempGraphics);
        }
        
        commit(strokeData) {
            const layerContainer = this.stage.getChildByName(strokeData.layerId?.toString());
            if (!layerContainer) {
                console.warn('[EraserEngine] Layer container not found:', strokeData.layerId);
                return null;
            }
            
            const graphics = new PIXI.Graphics();
            // Critical: Set ERASE blend mode for actual erasing
            graphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            const points = strokeData.points || [];
            if (points.length > 0) {
                // Create permanent eraser stroke
                for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    graphics.circle(point.x, point.y, this.settings.size / 2);
                    graphics.fill({ 
                        color: 0xffffff, // White color for erasing
                        alpha: this.settings.opacity
                    });
                    
                    // Connect points for smooth erasing
                    if (i > 0) {
                        const prevPoint = points[i - 1];
                        const distance = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                        const steps = Math.max(1, Math.ceil(distance / 2.0));
                        
                        for (let s = 1; s <= steps; s++) {
                            const t = s / steps;
                            const px = prevPoint.x + (point.x - prevPoint.x) * t;
                            const py = prevPoint.y + (point.y - prevPoint.y) * t;
                            
                            graphics.circle(px, py, this.settings.size / 2);
                            graphics.fill({ 
                                color: 0xffffff,
                                alpha: this.settings.opacity
                            });
                        }
                    }
                }
            }
            
            layerContainer.addChild(graphics);
            this._clearTemp();
            
            return {
                id: strokeData.id || `eraser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: points,
                settings: { ...this.settings },
                toolId: 'eraser',
                isEraser: true
            };
        }
        
        _clearTemp() {
            if (this.tempGraphics) {
                this.stage.removeChild(this.tempGraphics);
                this.tempGraphics.destroy();
                this.tempGraphics = null;
            }
        }
        
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
        }
    }
    
    /**
     * DrawingEngine - 統合描画エンジン（Pen/Eraser分離アーキテクチャ）
     */
    class DrawingEngine {
        constructor() {
            this.mainAPI = null;
            this.app = null;
            this.containers = {
                camera: null,
                world: null,
                ui: null
            };
            
            // Pen/Eraser engines - Will be initialized after stage setup
            this._penEngine = null;
            this._eraserEngine = null;
            
            // 現在のツールを管理する変数（改修案実装）
            this.currentTool = 'pen';
            
            this.drawingState = {
                active: false,
                currentStroke: null,
                strokePoints: []
            };
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                await this.initializePixiApp();
                this.setupContainers();
                this.setupEngines();
                this.setupInteraction();
                
                this.mainAPI.notify('drawing.ready');
                return true;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_INIT_FAILED', 'Drawing engine initialization failed', error);
                throw error;
            }
        }
        
        async initializePixiApp() {
            if (!window.PIXI) {
                throw new Error('PIXI library not found');
            }
            
            const config = this.mainAPI.getConfig();
            
            this.app = new PIXI.Application();
            await this.app.init({
                width: config.canvas.width,
                height: config.canvas.height,
                background: 0xf0e0d6,
                backgroundAlpha: 1,
                antialias: config.rendering.antialias,
                resolution: config.rendering.resolution,
                autoDensity: false
            });
            
            const container = document.getElementById('drawing-canvas');
            if (!container) {
                throw new Error('Canvas container not found');
            }
            
            container.appendChild(this.app.canvas);
        }
        
        setupContainers() {
            this.containers.camera = new PIXI.Container();
            this.containers.world = new PIXI.Container();
            this.containers.ui = new PIXI.Container();
            
            // Create mask for camera
            const config = this.mainAPI.getConfig();
            const maskGraphics = new PIXI.Graphics();
            maskGraphics.rect(0, 0, config.canvas.width, config.canvas.height);
            maskGraphics.fill(0x000000);
            this.app.stage.addChild(maskGraphics);
            this.containers.camera.mask = maskGraphics;
            
            // Build hierarchy
            this.containers.camera.addChild(this.containers.world);
            this.app.stage.addChild(this.containers.camera);
            this.app.stage.addChild(this.containers.ui);
            
            // Initialize world transform
            this.containers.world.x = 0;
            this.containers.world.y = 0;
            this.containers.world.scale.set(1);
        }
        
        setupEngines() {
            // Initialize separated engines after stage is ready
            this._penEngine = new PenEngine(this.containers.world);
            this._eraserEngine = new EraserEngine(this.containers.world);
        }
        
        setupInteraction() {
            const config = this.mainAPI.getConfig();
            
            this.containers.camera.eventMode = "static";
            this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, config.canvas.width, config.canvas.height);
            
            this.containers.camera.on('pointerdown', (e) => this.onPointerDown(e));
            this.containers.camera.on('pointermove', (e) => this.onPointerMove(e));
            this.containers.camera.on('pointerup', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointerupoutside', (e) => this.onPointerUp(e));
            this.containers.camera.on('pointercancel', (e) => this.onPointerUp(e));
        }
        
        onPointerDown(event) {
            const originalEvent = event.data.originalEvent;
            
            // Skip if pen with no pressure
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return;
            }
            
            // Skip if space is pressed (panning mode)
            if (this.isSpacePressed()) {
                event.stopPropagation();
                return;
            }
            
            const point = { x: event.global.x, y: event.global.y };
            this.mainAPI.notify('drawing.strokeStart', { point, tool: this.currentTool });
        }
        
        onPointerMove(event) {
            const originalEvent = event.data.originalEvent;
            
            // Always update coordinates
            const point = { x: event.global.x, y: event.global.y };
            this.mainAPI.notify('drawing.coordinatesUpdate', { point });
            
            // Skip drawing if pen with no pressure
            if (originalEvent.pointerType === 'pen' && originalEvent.pressure === 0) {
                return;
            }
            
            // Skip drawing if space is pressed
            if (this.isSpacePressed()) {
                return;
            }
            
            if (this.drawingState.active) {
                this.mainAPI.notify('drawing.strokeMove', { point });
            }
        }
        
        onPointerUp(event) {
            if (this.isSpacePressed()) return;
            
            if (this.drawingState.active) {
                this.mainAPI.notify('drawing.strokeEnd');
            }
        }
        
        isSpacePressed() {
            // Check with main controller
            try {
                const spaceState = this.mainAPI.requestConfirm('spaceState');
                return spaceState && spaceState.pressed;
            } catch {
                return false;
            }
        }
        
        // ツールの切り替え関数（改修案実装）
        setTool(tool) {
            if (tool === 'pen' || tool === 'eraser') {
                this.currentTool = tool;
            } else {
                console.error('[DrawingEngine] 無効なツールが指定されました:', tool);
            }
        }
        
        // 描画処理の関数（改修案実装）
        drawStroke(strokePoints) {
            if (this.currentTool === 'pen') {
                // ペンの描画処理
                this.drawWithPen(strokePoints);
            } else if (this.currentTool === 'eraser') {
                // 消しゴムの描画処理
                this.eraseWithEraser(strokePoints);
            }
        }
        
        // ペンによる描画処理（改修案実装）
        drawWithPen(strokePoints) {
            this._penEngine.drawTemp(strokePoints);
        }
        
        // 消しゴムによる描画処理（改修案実装）
        eraseWithEraser(strokePoints) {
            this._eraserEngine.drawTemp(strokePoints);
        }
        
        // API Methods for EngineBridge compatibility
        drawTemporaryStroke(toolId, strokePoints) {
            try {
                // 改修案に従い、現在のツールに応じて描画処理を分岐
                switch (toolId) {
                    case 'pen':
                        this._penEngine.drawTemp(strokePoints);
                        break;
                    case 'eraser':
                        this._eraserEngine.drawTemp(strokePoints);
                        break;
                    default:
                        console.warn(`[DrawingEngine] Unknown toolId: ${toolId}`);
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_TEMP', 'Temporary stroke drawing failed', error);
            }
        }
        
        commitStroke(toolId, strokeData) {
            try {
                let result = null;
                
                // 改修案に従い、現在のツールに応じて描画処理を分岐
                switch (toolId) {
                    case 'pen':
                        result = this._penEngine.commit(strokeData);
                        break;
                    case 'eraser':
                        result = this._eraserEngine.commit(strokeData);
                        break;
                    default:
                        console.warn(`[DrawingEngine] Unknown toolId: ${toolId}`);
                        return null;
                }
                
                // Send completed stroke to LayerManager for placement
                if (result) {
                    const layerProxy = this.mainAPI.getSatellite('layerManager');
                    if (layerProxy) {
                        try {
                            layerProxy.request('addPathToActiveLayer', result);
                        } catch (error) {
                            console.warn('[DrawingEngine] Failed to add path to layer:', error);
                        }
                    }
                }
                
                // Record to history with World coordinates
                if (result && this.mainAPI) {
                    const worldStroke = this._convertToWorldCoordinates(result);
                    if (this.mainAPI.getSatellite) {
                        const historyProxy = this.mainAPI.getSatellite('historyService');
                        if (historyProxy) {
                            try {
                                historyProxy.request('record', {
                                    type: 'stroke',
                                    payload: worldStroke,
                                    meta: { 
                                        requestId: crypto.randomUUID(), 
                                        origin: 'DrawingEngine',
                                        toolId: toolId
                                    }
                                });
                            } catch (error) {
                                console.warn('[DrawingEngine] History recording failed:', error);
                            }
                        }
                    }
                }
                
                return result;
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_COMMIT', 'Stroke commit failed', error);
                return null;
            }
        }
        
        clearLayer(layerId) {
            try {
                const layerContainer = this.containers.world.getChildByName(layerId?.toString());
                if (layerContainer) {
                    layerContainer.removeChildren();
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_CLEAR_LAYER', 'Layer clear failed', error);
            }
        }
        
        takeSnapshot(layerId) {
            try {
                const layerContainer = this.containers.world.getChildByName(layerId?.toString());
                if (layerContainer) {
                    return layerContainer.generateCanvasTexture ? layerContainer.generateCanvasTexture() : null;
                }
                return null;
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_SNAPSHOT', 'Snapshot failed', error);
                return null;
            }
        }
        
        _convertToWorldCoordinates(strokeData) {
            // PositionManager を介して canvas→world座標に変換
            try {
                const positionProxy = this.mainAPI.getSatellite('positionManager');
                if (positionProxy && strokeData.points) {
                    const convertedPoints = strokeData.points.map(p => {
                        const worldPos = positionProxy.request('canvasToWorld', p);
                        return worldPos || p;
                    });
                    
                    return {
                        ...strokeData,
                        points: convertedPoints,
                        worldCoordinates: true
                    };
                }
            } catch (error) {
                console.warn('[DrawingEngine] World coordinate conversion failed:', error);
            }
            
            return strokeData;
        }
        
        // Legacy API for main controller compatibility
        startDrawing(payload) {
            const { point, tool } = payload;
            
            if (this.drawingState.active) {
                this.cancelDrawing(); // Cancel previous if any
            }
            
            // 改修案に従い現在のツールを設定
            this.setTool(tool || 'pen');
            this.drawingState.active = true;
            this.drawingState.strokePoints = [point];
            
            // Draw temporary stroke immediately
            this.drawTemporaryStroke(this.currentTool, this.drawingState.strokePoints);
        }
        
        continueDrawing(payload) {
            const { point } = payload;
            
            if (!this.drawingState.active) return;
            
            // Add point to stroke
            this.drawingState.strokePoints.push(point);
            
            // Update temporary stroke using current tool
            this.drawTemporaryStroke(this.currentTool, this.drawingState.strokePoints);
        }
        
        endDrawing() {
            if (!this.drawingState.active || this.drawingState.strokePoints.length === 0) {
                this.drawingState.active = false;
                return null;
            }
            
            // Get active layer from layer manager
            const layerProxy = this.mainAPI.getSatellite('layerManager');
            let activeLayerId = 'default';
            
            if (layerProxy) {
                try {
                    const activeLayer = layerProxy.request('getActiveLayer');
                    if (activeLayer && activeLayer.id !== undefined) {
                        activeLayerId = activeLayer.id;
                    }
                } catch (error) {
                    console.warn('[DrawingEngine] Could not get active layer:', error);
                }
            }
            
            // Create stroke data
            const strokeData = {
                id: `${this.currentTool}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                layerId: activeLayerId,
                points: [...this.drawingState.strokePoints],
                toolId: this.currentTool,
                settings: this.currentTool === 'pen' ? 
                    { ...this._penEngine.settings } : 
                    { ...this._eraserEngine.settings }
            };
            
            // Commit stroke using current tool
            const result = this.commitStroke(this.currentTool, strokeData);
            
            // Reset drawing state
            this.drawingState.active = false;
            this.drawingState.strokePoints = [];
            
            return result;
        }
        
        cancelDrawing() {
            // Clear temporary graphics
            if (this._penEngine) {
                this._penEngine._clearTemp();
            }
            if (this._eraserEngine) {
                this._eraserEngine._clearTemp();
            }
            
            this.drawingState.active = false;
            this.drawingState.strokePoints = [];
        }
        
        updateToolSettings(tool, settings) {
            try {
                if (tool === 'pen' && this._penEngine) {
                    this._penEngine.updateSettings(settings);
                } else if (tool === 'eraser' && this._eraserEngine) {
                    this._eraserEngine.updateSettings(settings);
                }
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_TOOL_SETTINGS', 'Tool settings update failed', error);
            }
        }
        
        resize(width, height) {
            try {
                this.app.renderer.resize(width, height);
                
                // Update mask
                if (this.containers.camera.mask) {
                    this.containers.camera.mask.clear();
                    this.containers.camera.mask.rect(0, 0, width, height);
                    this.containers.camera.mask.fill(0x000000);
                }
                
                // Update hit area
                this.containers.camera.hitArea = new PIXI.Rectangle(0, 0, width, height);
                
                return true;
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_RESIZE', 'Failed to resize canvas', error);
                return false;
            }
        }
        
        clear() {
            try {
                // Cancel current drawing
                this.cancelDrawing();
                
                // Clear world container
                this.containers.world.removeChildren();
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_CLEAR', 'Failed to clear canvas', error);
            }
        }
        
        getEngine() {
            return this;
        }
        
        // Cleanup
        destroy() {
            this.clear();
            
            if (this.app) {
                this.app.destroy(true);
            }
            
            this.mainAPI = null;
            this.app = null;
            this.containers = null;
            this._penEngine = null;
            this._eraserEngine = null;
        }
    }
    
    /**
     * EngineBridge Factory - Legacy compatibility layer
     */
    function createEngineBridge(app, mainApi) {
        const engine = new DrawingEngine();
        // Note: This would need async initialization in real usage
        return {
            app: engine.app,
            drawTemporaryStroke: (toolId, points) => engine.drawTemporaryStroke(toolId, points),
            commitStroke: (toolId, strokeData) => engine.commitStroke(toolId, strokeData),
            clearLayer: layerId => engine.clearLayer(layerId),
            takeSnapshot: layerId => engine.takeSnapshot(layerId)
        };
    }
    
    // Export both the main class and bridge factory for compatibility
    DrawingEngine.createEngineBridge = createEngineBridge;
    
    return DrawingEngine;
})();