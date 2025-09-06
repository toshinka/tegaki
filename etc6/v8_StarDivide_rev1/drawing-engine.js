/**
 * Drawing Engine Satellite
 * PixiJS描画エンジン・キャンバス管理・ベクター描画処理の責務を担う衛星モジュール
 */

window.FutabaDrawingEngine = (function() {
    'use strict';
    
    class VectorPenEngine {
        constructor() {
            this.currentPath = null;
            this.tempGraphics = null;
            this.settings = {
                size: 16.0,
                color: 0x800000,
                opacity: 0.85
            };
        }
        
        startPath(x, y, settings = {}) {
            this.settings = { ...this.settings, ...settings };
            
            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: [{ x, y }],
                graphics: new PIXI.Graphics(),
                settings: { ...this.settings },
                isComplete: false
            };
            
            // Draw initial point
            this.currentPath.graphics.circle(x, y, this.settings.size / 2);
            this.currentPath.graphics.fill({ 
                color: this.settings.color, 
                alpha: this.settings.opacity 
            });
            
            return this.currentPath;
        }
        
        extendPath(x, y) {
            if (!this.currentPath || this.currentPath.points.length === 0) return false;
            
            const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            if (distance < 1.5) return false;
            
            // Smooth line drawing with interpolation
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (x - lastPoint.x) * t;
                const py = lastPoint.y + (y - lastPoint.y) * t;
                
                this.currentPath.graphics.circle(px, py, this.settings.size / 2);
                this.currentPath.graphics.fill({ 
                    color: this.settings.color, 
                    alpha: this.settings.opacity 
                });
            }
            
            this.currentPath.points.push({ x, y });
            return true;
        }
        
        completePath() {
            if (this.currentPath) {
                this.currentPath.isComplete = true;
                const completedPath = this.currentPath;
                this.currentPath = null;
                return completedPath;
            }
            return null;
        }
        
        cancelPath() {
            if (this.currentPath) {
                if (this.currentPath.graphics && this.currentPath.graphics.destroy) {
                    this.currentPath.graphics.destroy();
                }
                this.currentPath = null;
            }
        }
        
        updateSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
        }
    }
    
    class EraserEngine {
        constructor() {
            this.settings = {
                size: 16.0,
                color: 0xf0e0d6, // Background color for erasing
                opacity: 1.0
            };
        }
        
        startErase(x, y, settings = {}) {
            this.settings = { ...this.settings, ...settings };
            
            const erasePath = {
                id: `erase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: [{ x, y }],
                graphics: new PIXI.Graphics(),
                settings: { ...this.settings },
                isComplete: false,
                isEraser: true
            };
            
            // Draw eraser circle
            erasePath.graphics.circle(x, y, this.settings.size / 2);
            erasePath.graphics.fill({ 
                color: this.settings.color, 
                alpha: this.settings.opacity 
            });
            
            return erasePath;
        }
        
        continueErase(path, x, y) {
            if (!path || !path.isEraser || path.points.length === 0) return false;
            
            const lastPoint = path.points[path.points.length - 1];
            const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);
            
            if (distance < 1.5) return false;
            
            const steps = Math.max(1, Math.ceil(distance / 1.5));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const px = lastPoint.x + (x - lastPoint.x) * t;
                const py = lastPoint.y + (y - lastPoint.y) * t;
                
                path.graphics.circle(px, py, this.settings.size / 2);
                path.graphics.fill({ 
                    color: this.settings.color, 
                    alpha: this.settings.opacity 
                });
            }
            
            path.points.push({ x, y });
            return true;
        }
    }
    
    class DrawingEngine {
        constructor() {
            this.mainAPI = null;
            this.app = null;
            this.containers = {
                camera: null,
                world: null,
                ui: null
            };
            
            this.penEngine = new VectorPenEngine();
            this.eraserEngine = new EraserEngine();
            
            this.currentTool = 'pen';
            this.drawingState = {
                active: false,
                currentPath: null
            };
            
            this.paths = new Map(); // Track all paths for management
        }
        
        async register(mainAPI) {
            this.mainAPI = mainAPI;
            
            try {
                await this.initializePixiApp();
                this.setupContainers();
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
        
        // Public API for main controller
        startDrawing(payload) {
            const { point, tool } = payload;
            
            if (this.drawingState.active) {
                this.cancelDrawing(); // Cancel previous if any
            }
            
            this.currentTool = tool || 'pen';
            this.drawingState.active = true;
            
            if (this.currentTool === 'pen') {
                this.drawingState.currentPath = this.penEngine.startPath(point.x, point.y);
            } else if (this.currentTool === 'eraser') {
                this.drawingState.currentPath = this.eraserEngine.startErase(point.x, point.y);
            }
            
            // Add to temporary container (not committed to layer yet)
            if (this.drawingState.currentPath && this.drawingState.currentPath.graphics) {
                this.containers.world.addChild(this.drawingState.currentPath.graphics);
            }
        }
        
        continueDrawing(payload) {
            const { point } = payload;
            
            if (!this.drawingState.active || !this.drawingState.currentPath) return;
            
            if (this.currentTool === 'pen') {
                this.penEngine.extendPath(point.x, point.y);
            } else if (this.currentTool === 'eraser') {
                this.eraserEngine.continueErase(this.drawingState.currentPath, point.x, point.y);
            }
        }
        
        endDrawing() {
            if (!this.drawingState.active || !this.drawingState.currentPath) return null;
            
            let completedPath;
            
            if (this.currentTool === 'pen') {
                completedPath = this.penEngine.completePath();
            } else if (this.currentTool === 'eraser') {
                this.drawingState.currentPath.isComplete = true;
                completedPath = this.drawingState.currentPath;
            }
            
            // Remove from world temporarily (will be added to layer)
            if (completedPath && completedPath.graphics) {
                this.containers.world.removeChild(completedPath.graphics);
                this.paths.set(completedPath.id, completedPath);
            }
            
            this.drawingState.active = false;
            this.drawingState.currentPath = null;
            
            return completedPath;
        }
        
        cancelDrawing() {
            if (this.drawingState.currentPath) {
                if (this.drawingState.currentPath.graphics) {
                    this.containers.world.removeChild(this.drawingState.currentPath.graphics);
                    this.drawingState.currentPath.graphics.destroy();
                }
            }
            
            this.drawingState.active = false;
            this.drawingState.currentPath = null;
        }
        
        updateToolSettings(tool, settings) {
            if (tool === 'pen') {
                this.penEngine.updateSettings(settings);
            } else if (tool === 'eraser') {
                this.eraserEngine.settings = { ...this.eraserEngine.settings, ...settings };
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
                
                // Clear all paths
                this.paths.forEach(path => {
                    if (path.graphics && path.graphics.destroy) {
                        path.graphics.destroy();
                    }
                });
                this.paths.clear();
                
                // Clear world container
                this.containers.world.removeChildren();
                
            } catch (error) {
                this.mainAPI.notifyError('ERR_DRAWING_CLEAR', 'Failed to clear canvas', error);
            }
        }
        
        getEngine() {
            return this;
        }
        
        getPath(pathId) {
            return this.paths.get(pathId);
        }
        
        removePath(pathId) {
            const path = this.paths.get(pathId);
            if (path) {
                if (path.graphics && path.graphics.destroy) {
                    path.graphics.destroy();
                }
                this.paths.delete(pathId);
                return true;
            }
            return false;
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
        }
    }
    
    return DrawingEngine;
})();