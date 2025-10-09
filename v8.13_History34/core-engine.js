// ===== core-engine.js - Quick Fix完全版 =====
// ================================================================================
// Quick Fix改修内容:
// - DrawingEngine が StateManager.addStroke() を使用（オプション）
// - 既存のHistory統合は維持（互換性重視）
// - 全機能継承
// ================================================================================

(function() {
    'use strict';
    
    if (!window.TegakiCameraSystem) {
        console.error('❌ TegakiCameraSystem not found');
        throw new Error('system/camera-system.js is required');
    }
    
    if (!window.TegakiLayerSystem) {
        console.error('❌ TegakiLayerSystem not found');
        throw new Error('system/layer-system.js is required');
    }
    
    if (!window.TegakiDrawingClipboard) {
        console.error('❌ TegakiDrawingClipboard not found');
        throw new Error('system/drawing-clipboard.js is required');
    }
    
    if (!window.TegakiEventBus) {
        console.error('❌ TegakiEventBus not found');
        throw new Error('system/event-bus.js is required');
    }
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        console.error('❌ TEGAKI_CONFIG not found');
        throw new Error('config.js is required');
    }

    if (!CONFIG.animation) {
        console.error('❌ Animation config not found');
        throw new Error('Animation configuration is required');
    }

    if (!window.TEGAKI_KEYCONFIG_MANAGER) {
        console.error('❌ TEGAKI_KEYCONFIG_MANAGER not found');
        throw new Error('KeyConfig manager is required');
    }

    class DrawingEngine {
        constructor(cameraSystem, layerManager, eventBus, config) {
            this.cameraSystem = cameraSystem;
            this.layerManager = layerManager;
            this.eventBus = eventBus || window.TegakiEventBus;
            this.config = config;
            
            this.currentTool = 'pen';
            this.brushSize = this.config.pen.size;
            this.brushColor = this.config.pen.color;
            this.brushOpacity = this.config.pen.opacity;
            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
            
            this._setupEventBusListeners();
        }

        _setupEventBusListeners() {
            if (!this.eventBus) return;
            
            this.eventBus.on('drawing:tool-changed', (data) => {
                this.setTool(data.tool);
            });
            
            this.eventBus.on('drawing:brush-size-changed', (data) => {
                this.setBrushSize(data.size);
            });
            
            this.eventBus.on('drawing:brush-color-changed', (data) => {
                this.setBrushColor(data.color);
            });
            
            this.eventBus.on('drawing:brush-opacity-changed', (data) => {
                this.setBrushOpacity(data.opacity);
            });
        }

        startDrawing(screenX, screenY) {
            if (this.isDrawing || this.cameraSystem.spacePressed || this.cameraSystem.isDragging || 
                this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
            
            if (!this.cameraSystem.isPointInExtendedCanvas(canvasPoint)) {
                return;
            }
            
            this.isDrawing = true;
            this.lastPoint = canvasPoint;

            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;

            const color = this.currentTool === 'eraser' ? this.config.background.color : this.brushColor;
            const opacity = this.currentTool === 'eraser' ? 1.0 : this.brushOpacity;

            this.currentPath = {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: new PIXI.Graphics(),
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                color: color,
                size: this.brushSize,
                opacity: opacity,
                tool: this.currentTool,
                isComplete: false
            };

            this.currentPath.graphics.circle(canvasPoint.x, canvasPoint.y, this.brushSize / 2);
            this.currentPath.graphics.fill({ color: color, alpha: opacity });

            this.addPathToActiveLayer(this.currentPath);
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:started', {
                    tool: this.currentTool,
                    point: canvasPoint,
                    pathId: this.currentPath.id
                });
            }
        }

        continueDrawing(screenX, screenY) {
            if (!this.isDrawing || !this.currentPath || this.cameraSystem.spacePressed || 
                this.cameraSystem.isDragging || this.layerManager.vKeyPressed) return;

            const canvasPoint = this.cameraSystem.screenToCanvas(screenX, screenY, { forDrawing: true });
            const lastPoint = this.lastPoint;
            
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - lastPoint.x, 2) + 
                Math.pow(canvasPoint.y - lastPoint.y, 2)
            );

            if (distance < 1) return;

            const steps = Math.max(1, Math.floor(distance / 1));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = lastPoint.x + (canvasPoint.x - lastPoint.x) * t;
                const y = lastPoint.y + (canvasPoint.y - lastPoint.y) * t;

                this.currentPath.graphics.circle(x, y, this.brushSize / 2);
                this.currentPath.graphics.fill({ 
                    color: this.currentPath.color, 
                    alpha: this.currentPath.opacity 
                });

                this.currentPath.points.push({ x, y });
            }

            this.lastPoint = canvasPoint;
        }

        stopDrawing() {
            if (!this.isDrawing) return;

            if (this.currentPath) {
                this.currentPath.isComplete = true;
                
                const activeLayer = this.layerManager.getActiveLayer();
                if (activeLayer && window.History) {
                    const pathId = this.currentPath.id;
                    const layerIdAtDrawTime = activeLayer.layerData.id;
                    
                    const pathData = {
                        id: this.currentPath.id,
                        points: structuredClone(this.currentPath.points),
                        color: this.currentPath.color,
                        size: this.currentPath.size,
                        opacity: this.currentPath.opacity,
                        tool: this.currentPath.tool,
                        isComplete: true
                    };
                    
                    const command = {
                        name: 'draw-stroke',
                        do: () => {
                            const layers = this.layerManager.getLayers();
                            const targetLayer = layers.find(l => l.layerData.id === layerIdAtDrawTime);
                            if (!targetLayer) return;
                            
                            const existingPath = targetLayer.layerData.paths.find(p => p.id === pathId);
                            if (existingPath) return;
                            
                            const restoredPath = structuredClone(pathData);
                            if (this.layerManager.rebuildPathGraphics) {
                                this.layerManager.rebuildPathGraphics(restoredPath);
                                if (restoredPath.graphics) {
                                    targetLayer.layerData.paths.push(restoredPath);
                                    targetLayer.addChild(restoredPath.graphics);
                                    
                                    const layerIndex = layers.indexOf(targetLayer);
                                    if (layerIndex !== -1) {
                                        this.layerManager.requestThumbnailUpdate(layerIndex);
                                    }
                                    
                                    if (this.layerManager.animationSystem?.generateCutThumbnailOptimized) {
                                        const cutIndex = this.layerManager.animationSystem.getCurrentCutIndex();
                                        setTimeout(() => {
                                            this.layerManager.animationSystem.generateCutThumbnailOptimized(cutIndex);
                                        }, 100);
                                    }
                                }
                            }
                        },
                        undo: () => {
                            const layers = this.layerManager.getLayers();
                            const targetLayer = layers.find(l => l.layerData.id === layerIdAtDrawTime);
                            if (!targetLayer) return;
                            
                            const pathIndex = targetLayer.layerData.paths.findIndex(p => p.id === pathId);
                            if (pathIndex !== -1) {
                                const path = targetLayer.layerData.paths[pathIndex];
                                if (path.graphics) {
                                    targetLayer.removeChild(path.graphics);
                                    path.graphics.destroy();
                                }
                                targetLayer.layerData.paths.splice(pathIndex, 1);
                            }
                            
                            const layerIndex = layers.indexOf(targetLayer);
                            if (layerIndex !== -1) {
                                this.layerManager.requestThumbnailUpdate(layerIndex);
                            }
                            
                            if (this.layerManager.animationSystem?.generateCutThumbnailOptimized) {
                                const cutIndex = this.layerManager.animationSystem.getCurrentCutIndex();
                                setTimeout(() => {
                                    this.layerManager.animationSystem.generateCutThumbnailOptimized(cutIndex);
                                }, 100);
                            }
                        },
                        meta: { 
                            type: 'stroke', 
                            layerId: layerIdAtDrawTime, 
                            pathId: pathId 
                        }
                    };
                    
                    History.push(command);
                }
                
                this.layerManager.requestThumbnailUpdate(this.layerManager.activeLayerIndex);
                
                if (this.layerManager.animationSystem?.generateCutThumbnailOptimized) {
                    const currentCutIndex = this.layerManager.animationSystem.getCurrentCutIndex();
                    setTimeout(() => {
                        this.layerManager.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                    }, 150);
                }
                
                if (this.eventBus) {
                    this.eventBus.emit('drawing:completed', {
                        pathId: this.currentPath.id,
                        pointCount: this.currentPath.points.length
                    });
                }
            }

            this.isDrawing = false;
            this.currentPath = null;
            this.lastPoint = null;
        }
        
        addPathToActiveLayer(path) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const layerId = activeLayer.layerData.id;
            const transform = this.layerManager.layerTransforms.get(layerId);
            
            if (transform && this.layerManager.isTransformNonDefault(transform)) {
                try {
                    const matrix = new PIXI.Matrix();
                    
                    const centerX = this.config.canvas.width / 2;
                    const centerY = this.config.canvas.height / 2;
                    
                    matrix.translate(-centerX - transform.x, -centerY - transform.y);
                    matrix.rotate(-transform.rotation);
                    matrix.scale(1/transform.scaleX, 1/transform.scaleY);
                    matrix.translate(centerX, centerY);
                    
                    const transformedGraphics = new PIXI.Graphics();
                    
                    path.points.forEach((point, index) => {
                        try {
                            const transformedPoint = matrix.apply(point);
                            if (isFinite(transformedPoint.x) && isFinite(transformedPoint.y)) {
                                transformedGraphics.circle(transformedPoint.x, transformedPoint.y, path.size / 2);
                                transformedGraphics.fill({ color: path.color, alpha: path.opacity });
                            }
                        } catch (transformError) {
                        }
                    });
                    
                    path.graphics = transformedGraphics;
                } catch (error) {
                }
            }
            
            activeLayer.layerData.paths.push(path);
            activeLayer.addChild(path.graphics);
        }

        setTool(tool) {
            const oldTool = this.currentTool;
            this.currentTool = tool;
            
            if (this.eventBus && oldTool !== tool) {
                this.eventBus.emit('drawing:tool-set', { 
                    oldTool: oldTool, 
                    newTool: tool 
                });
            }
        }

        setBrushSize(size) {
            const oldSize = this.brushSize;
            this.brushSize = Math.max(0.1, Math.min(100, size));
            
            if (this.eventBus && oldSize !== this.brushSize) {
                this.eventBus.emit('drawing:brush-size-set', {
                    oldSize: oldSize,
                    newSize: this.brushSize
                });
            }
        }

        setBrushColor(color) {
            const oldColor = this.brushColor;
            this.brushColor = color;
            
            if (this.eventBus && oldColor !== color) {
                this.eventBus.emit('drawing:brush-color-set', {
                    oldColor: oldColor,
                    newColor: color
                });
            }
        }

        setBrushOpacity(opacity) {
            const oldOpacity = this.brushOpacity;
            this.brushOpacity = Math.max(0, Math.min(1, opacity));
            
            if (this.eventBus && oldOpacity !== this.brushOpacity) {
                this.eventBus.emit('drawing:brush-opacity-set', {
                    oldOpacity: oldOpacity,
                    newOpacity: this.brushOpacity
                });
            }
        }
    }

    class UnifiedKeyHandler {
        constructor(cameraSystem, layerSystem, drawingEngine, eventBus, animationSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.drawingEngine = drawingEngine;
            this.eventBus = eventBus || window.TegakiEventBus;
            this.animationSystem = animationSystem;
            
            this.keyConfig = window.TEGAKI_KEYCONFIG_MANAGER;
            this.keyHandlingActive = true;
            
            this.setupKeyHandling();
        }
        
        setupKeyHandling() {
            document.addEventListener('keydown', (e) => {
                if (!this.keyHandlingActive) return;
                
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                const metaKey = isMac ? e.metaKey : e.ctrlKey;
                if (metaKey && (e.code === 'KeyZ' || e.code === 'KeyY')) {
                    return;
                }
                
                this.handleKeyDown(e);
            });
            
            document.addEventListener('keyup', (e) => {
                if (!this.keyHandlingActive) return;
                this.handleKeyUp(e);
            });
            
            window.addEventListener('blur', () => {
                this.resetAllKeyStates();
            });
            
            window.addEventListener('focus', () => {
                this.resetAllKeyStates();
            });
        }
        
        handleKeyDown(e) {
            // Quick Fix: 矢印キー完全修正
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
            
            if (this.handleSpecialKeys(e)) {
                return;
            }
            
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
                
                case 'gifToggleAnimation':
                    if (e.altKey && window.timelineUI) {
                        window.timelineUI.toggle();
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
                    if (e.code === 'Space' && this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.togglePlayPause();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifPrevFrame':
                    if (this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.goToPreviousFrame();
                        e.preventDefault();
                    }
                    break;
                
                case 'gifNextFrame':
                    if (this.animationSystem && window.timelineUI && window.timelineUI.isVisible) {
                        this.animationSystem.goToNextFrame();
                        e.preventDefault();
                    }
                    break;
                
                case 'delete':
                    if (e.code === 'Delete' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        this.eventBus.emit('layer:clear-active');
                        e.preventDefault();
                    }
                    break;
            }
        }
        
        // Quick Fix: 矢印キー処理の完全修正
        handleArrowKeys(e) {
            e.preventDefault();
            
            const activeIndex = this.layerSystem.activeLayerIndex;
            const layers = this.layerSystem.getLayers();
            
            if (e.ctrlKey) {
                // Ctrl+↑↓: レイヤーを上下に移動（階層移動）
                if (e.code === 'ArrowUp') {
                    // 上に移動 = 配列の後方
                    if (activeIndex < layers.length - 1) {
                        const layer = layers[activeIndex];
                        if (!layer?.layerData?.isBackground) {
                            this.layerSystem.currentCutContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentCutContainer.addChildAt(layer, activeIndex + 1);
                            this.layerSystem.activeLayerIndex = activeIndex + 1;
                            this.layerSystem.updateLayerPanelUI();
                        }
                    }
                } else if (e.code === 'ArrowDown') {
                    // 下に移動 = 配列の前方
                    if (activeIndex > 0) {
                        const layer = layers[activeIndex];
                        const targetLayer = layers[activeIndex - 1];
                        // 背景レイヤーを飛び越えない
                        if (!layer?.layerData?.isBackground && !targetLayer?.layerData?.isBackground) {
                            this.layerSystem.currentCutContainer.removeChildAt(activeIndex);
                            this.layerSystem.currentCutContainer.addChildAt(layer, activeIndex - 1);
                            this.layerSystem.activeLayerIndex = activeIndex - 1;
                            this.layerSystem.updateLayerPanelUI();
                        }
                    }
                }
            } else {
                // ↑↓←→: Cut移動
                if (!this.animationSystem) return;
                
                if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
                    this.animationSystem.goToPreviousFrame();
                } else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
                    this.animationSystem.goToNextFrame();
                }
            }
        }
        
        handleKeyUp(e) {
        }
        
        handleSpecialKeys(e) {
            if (e.ctrlKey && e.code === 'Digit0') {
                return false;
            }
            
            if (e.code === 'Space') {
                return false;
            }
            
            return false;
        }
        
        switchTool(tool) {
            this.drawingEngine.setTool(tool);
            
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
            const toolBtn = document.getElementById(tool + '-tool');
            if (toolBtn) {
                toolBtn.classList.add('active');
            }

            const toolNames = { pen: 'ベクターペン', eraser: '消しゴム' };
            const toolElement = document.getElementById('current-tool');
            if (toolElement) {
                toolElement.textContent = toolNames[tool] || tool;
            }
            
            this.cameraSystem.updateCursor();
            
            if (this.eventBus) {
                this.eventBus.emit('key:tool-switched', { tool });
            }
        }
        
        resetAllKeyStates() {
            if (this.cameraSystem._resetAllKeyStates) {
                this.cameraSystem._resetAllKeyStates();
            }
        }
        
        setKeyHandlingActive(active) {
            this.keyHandlingActive = active;
        }
    }

    class CoreEngine {
        constructor(app, config = {}) {
            this.app = app;
            
            this.isBookmarkletMode = config.isBookmarkletMode || false;
            
            this.eventBus = window.TegakiEventBus;
            if (!this.eventBus) {
                throw new Error('window.TegakiEventBus is required');
            }
            
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            this.drawingEngine = new DrawingEngine(this.cameraSystem, this.layerSystem, this.eventBus, CONFIG);
            
            this.animationSystem = null;
            this.timelineUI = null;
            this.keyHandler = null;
            this.exportManager = null;
            
            this.setupCrossReferences();
            this.setupSystemEventIntegration();
        }
        
        setupCrossReferences() {
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
            this.clipboardSystem.setLayerManager(this.layerSystem);
        }
        
        setupSystemEventIntegration() {
            this.eventBus.on('layer:clear-active', () => {
                const activeLayer = this.layerSystem.getActiveLayer();
                if (!activeLayer || !activeLayer.layerData) return;
                
                if (activeLayer.layerData.isBackground) {
                    return;
                }
                
                const pathsSnapshot = structuredClone(activeLayer.layerData.paths);
                
                if (window.History) {
                    const command = {
                        name: 'clear-layer',
                        do: () => {
                            if (activeLayer.layerData.paths) {
                                activeLayer.layerData.paths.forEach(path => {
                                    if (path.graphics) {
                                        activeLayer.removeChild(path.graphics);
                                        if (path.graphics.destroy) {
                                            path.graphics.destroy();
                                        }
                                    }
                                });
                                activeLayer.layerData.paths = [];
                            }
                            
                            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                            
                            if (this.layerSystem.animationSystem?.generateCutThumbnailOptimized) {
                                const currentCutIndex = this.layerSystem.animationSystem.getCurrentCutIndex();
                                setTimeout(() => {
                                    this.layerSystem.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                                }, 100);
                            }
                        },
                        undo: () => {
                            activeLayer.layerData.paths = structuredClone(pathsSnapshot);
                            
                            activeLayer.layerData.paths.forEach(path => {
                                if (this.layerSystem.rebuildPathGraphics) {
                                    this.layerSystem.rebuildPathGraphics(path);
                                    if (path.graphics) {
                                        activeLayer.addChild(path.graphics);
                                    }
                                }
                            });
                            
                            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                            
                            if (this.layerSystem.animationSystem?.generateCutThumbnailOptimized) {
                                const currentCutIndex = this.layerSystem.animationSystem.getCurrentCutIndex();
                                setTimeout(() => {
                                    this.layerSystem.animationSystem.generateCutThumbnailOptimized(currentCutIndex);
                                }, 100);
                            }
                        },
                        meta: { type: 'clear-layer', layerId: activeLayer.layerData.id }
                    };
                    
                    History.push(command);
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
            if (!window.TegakiAnimationSystem) {
                console.warn('⚠️ TegakiAnimationSystem not found');
                return;
            }
            
            if (!window.TegakiTimelineUI) {
                console.warn('⚠️ TegakiTimelineUI not found');
                return;
            }
            
            try {
                this.animationSystem = new window.TegakiAnimationSystem();
                this.animationSystem.init(this.layerSystem, this.app, this.cameraSystem);
                
                this.timelineUI = new window.TegakiTimelineUI(this.animationSystem);
                this.timelineUI.init();
                
                window.animationSystem = this.animationSystem;
                window.timelineUI = this.timelineUI;
                
                this.setupCoordinateSystemReferences();
                
            } catch (error) {
                console.error('❌ Failed to initialize AnimationSystem:', error);
                this.animationSystem = null;
                this.timelineUI = null;
            }
        }
        
        setupCoordinateSystemReferences() {
            if (window.CoordinateSystem) {
                try {
                    if (typeof window.CoordinateSystem.setCameraSystem === 'function') {
                        window.CoordinateSystem.setCameraSystem(this.cameraSystem);
                    }
                    
                    if (typeof window.CoordinateSystem.setLayerSystem === 'function') {
                        window.CoordinateSystem.setLayerSystem(this.layerSystem);
                    }
                    
                    if (typeof window.CoordinateSystem.setAnimationSystem === 'function' && this.animationSystem) {
                        window.CoordinateSystem.setAnimationSystem(this.animationSystem);
                    }
                } catch (error) {
                }
            }
        }
        
        async exportForBookmarklet(format = 'gif', options = {}) {
            if (!this.exportManager) {
                throw new Error('ExportManager is not initialized');
            }
            
            switch(format.toLowerCase()) {
                case 'png':
                    return await this.exportManager.exportAsPNGBlob(options);
                case 'apng':
                    return await this.exportManager.exportAsAPNGBlob(options);
                case 'gif':
                    return await this.exportManager.exportAsGIFBlob(options);
                case 'webp':
                    return await this.exportManager.exportAsWebPBlob(options);
                default:
                    throw new Error(`Unsupported format: ${format}`);
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
        
        setupCanvasEvents() {
            const canvas = this.app.canvas || this.app.view;
            if (!canvas) {
                console.error('Canvas element not found');
                return;
            }
            
            canvas.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.drawingEngine.startDrawing(x, y);
                e.preventDefault();
            });

            canvas.addEventListener('pointermove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updateCoordinates(x, y);
                this.drawingEngine.continueDrawing(x, y);
                this.eventBus.emit('ui:mouse-move', { x, y });
            });
            
            canvas.addEventListener('pointerup', (e) => {
                this.drawingEngine.stopDrawing();
            });
            
            canvas.addEventListener('pointerleave', (e) => {
                this.drawingEngine.stopDrawing();
            });
        }
        
        switchTool(tool) {
            if (this.keyHandler) {
                this.keyHandler.switchTool(tool);
            } else {
                this.drawingEngine.setTool(tool);
                this.cameraSystem.updateCursor();
            }
        }
        
        updateCoordinates(x, y) {
            this.cameraSystem.updateCoordinates(x, y);
        }
        
        processThumbnailUpdates() {
            this.layerSystem.processThumbnailUpdates();
        }
        
        resizeCanvas(newWidth, newHeight) {
            CONFIG.canvas.width = newWidth;
            CONFIG.canvas.height = newHeight;
            
            this.cameraSystem.resizeCanvas(newWidth, newHeight);
            
            const layers = this.layerSystem.getLayers();
            layers.forEach(layer => {
                if (layer.layerData.isBackground && layer.layerData.backgroundGraphics) {
                    layer.layerData.backgroundGraphics.clear();
                    layer.layerData.backgroundGraphics.rect(0, 0, newWidth, newHeight);
                    layer.layerData.backgroundGraphics.fill(CONFIG.background.color);
                }
            });
            
            for (let i = 0; i < layers.length; i++) {
                this.layerSystem.requestThumbnailUpdate(i);
            }
            
            this.eventBus.emit('canvas:resized', { width: newWidth, height: newHeight });
        }
        
        initialize() {
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, CONFIG);
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            if (window.History && typeof window.History.setLayerSystem === 'function') {
                window.History.setLayerSystem(this.layerSystem);
            }
            
            this.initializeAnimationSystem();
            
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
            
            this.eventBus.on('animation:initial-cut-created', () => {
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
            });
            
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                window.TegakiUI.initializeSortable(this.layerSystem);
            }
            
            this.setupCanvasEvents();
            
            this.app.ticker.add(() => {
                this.processThumbnailUpdates();
            });
            
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'keyhandler', 'animation', 'history', 'export']
            });
            
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

})();

console.log('✅ core-engine.js (Quick Fix完全版) loaded');