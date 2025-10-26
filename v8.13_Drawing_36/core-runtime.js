// ===== core-runtime.js - ツール切り替え強化版 =====
// 改修3: 消しゴムツール切り替えを確実に伝播

(function() {
    'use strict';
    
    if (!window.CoordinateSystem) {
        throw new Error('coordinate-system.js dependency missing');
    }
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) {
        throw new Error('config.js dependency missing');
    }
    
    const CoreRuntime = {
        project: {
            canvasSize: { w: CONFIG.canvas.width, h: CONFIG.canvas.height },
            DPR: window.devicePixelRatio || 1,
            renderer: null,
            stage: null,
            cuts: [],
            activeCutId: null
        },
        
        internal: {
            app: null,
            worldContainer: null,
            canvasContainer: null,
            cameraSystem: null,
            layerManager: null,
            drawingEngine: null,
            initialized: false,
            pointerEventsSetup: false
        },
        
        init(options) {
            Object.assign(this.internal, options);
            this.project.renderer = options.app?.renderer;
            this.project.stage = options.app?.stage;
            this.internal.initialized = true;
            
            this.setupCoordinateSystem();
            
            const defaultCut = this.createCut({ name: 'CUT1' });
            this.switchCut(defaultCut.id);
            
            this.setupLegacyCompatibility();
            this.setupPointerEvents();
            
            return this;
        },
        
        setupPointerEvents() {
            if (!this.internal.app?.stage || this.internal.pointerEventsSetup) return;
            
            const stage = this.internal.app.stage;
            
            stage.eventMode = 'static';
            stage.hitArea = this.internal.app.screen;
            
            stage.on('pointerdown', (event) => {
                this.handlePointerDown(event);
            });
            
            stage.on('pointermove', (event) => {
                this.handlePointerMove(event);
            });
            
            stage.on('pointerup', (event) => {
                this.handlePointerUp(event);
            });
            
            stage.on('pointerupoutside', (event) => {
                this.handlePointerUp(event);
            });
            
            this.internal.pointerEventsSetup = true;
        },
        
        handlePointerDown(event) {
            const currentTool = this.internal.drawingEngine?.currentTool || 'pen';
            const isDrawingTool = currentTool === 'pen' || currentTool === 'eraser';
            
            if (this.internal.drawingEngine && 
                !this.internal.layerManager?.isLayerMoveMode && 
                isDrawingTool) {
                this.internal.drawingEngine.startDrawing(event.global.x, event.global.y, event);
            }
        },
        
        handlePointerMove(event) {
            if (this.internal.drawingEngine?.isDrawing) {
                this.internal.drawingEngine.continueDrawing(event.global.x, event.global.y, event);
            }
        },
        
        handlePointerUp(event) {
            if (this.internal.drawingEngine?.isDrawing) {
                this.internal.drawingEngine.stopDrawing();
            }
        },
        
        setupCoordinateSystem() {
            if (window.CoordinateSystem.setContainers) {
                window.CoordinateSystem.setContainers({
                    worldContainer: this.internal.worldContainer,
                    canvasContainer: this.internal.canvasContainer,
                    app: this.internal.app
                });
            }
        },
        
        setupLegacyCompatibility() {
            window.drawingApp = {
                pixiApp: this.internal.app,
                cameraSystem: this.internal.cameraSystem,
                layerManager: this.internal.layerManager,
                drawingEngine: this.internal.drawingEngine,
                app: this.internal.app
            };
            
            window.drawingAppResizeCanvas = (w, h) => {
                return this.updateCanvasSize(w, h);
            };
        },
        
        createCut(opts = {}) {
            const cutId = 'cut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const w = Math.round(this.project.canvasSize.w);
            const h = Math.round(this.project.canvasSize.h);
            
            const cut = {
                id: cutId,
                name: opts.name || `CUT${this.project.cuts.length + 1}`,
                width: w,
                height: h,
                container: new PIXI.Container(),
                layers: [],
                renderTexture: PIXI.RenderTexture.create({
                    width: Math.round(w * this.project.DPR),
                    height: Math.round(h * this.project.DPR)
                }),
                needsThumbnailUpdate: false
            };
            
            cut.container.label = cutId;
            this.project.cuts.push(cut);
            
            return cut;
        },
        
        switchCut(cutId) {
            const newCut = this.getCutById(cutId);
            if (!newCut) return false;
            
            const oldCut = this.getActiveCut();
            
            if (oldCut && this.project.stage) {
                this.project.stage.removeChild(oldCut.container);
            }
            
            if (this.project.stage) {
                this.project.stage.addChild(newCut.container);
            }
            
            this.project.activeCutId = cutId;
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('cut:switched', { cutId, cutName: newCut.name });
            }
            
            return true;
        },
        
        getCutById(cutId) {
            return this.project.cuts.find(c => c.id === cutId);
        },
        
        getActiveCut() {
            return this.project.activeCutId ? 
                this.getCutById(this.project.activeCutId) : null;
        },
        
        renderCutToTexture(cutId) {
            const cut = this.getCutById(cutId);
            if (!cut || !this.project.renderer) return null;
            
            this.project.renderer.render({
                container: cut.container,
                target: cut.renderTexture
            });
            
            cut.needsThumbnailUpdate = false;
            return cut.renderTexture;
        },
        
        extractCutDataURL(cutId) {
            const renderTexture = this.renderCutToTexture(cutId);
            if (!renderTexture || !this.project.renderer) return '';
            
            const canvas = this.project.renderer.extract.canvas(renderTexture);
            return canvas.toDataURL('image/png');
        },
        
        updateBackgroundLayerSize(layer, width, height) {
            if (!layer?.layerData?.isBackground) return false;
            if (!layer.layerData.backgroundGraphics) return false;
            
            const bg = layer.layerData.backgroundGraphics;
            
            bg.clear();
            
            const color1 = 0xe9c2ba;
            const color2 = 0xf0e0d6;
            const squareSize = 16;
            
            for (let y = 0; y < height; y += squareSize) {
                for (let x = 0; x < width; x += squareSize) {
                    const isEvenX = (x / squareSize) % 2 === 0;
                    const isEvenY = (y / squareSize) % 2 === 0;
                    const color = (isEvenX === isEvenY) ? color1 : color2;
                    bg.rect(x, y, squareSize, squareSize);
                    bg.fill({ color: color });
                }
            }
            
            return true;
        },
        
        updateCanvasSize(w, h) {
            this.project.canvasSize = { w, h };
            
            const animationSystem = window.animationSystem || window.TegakiAnimationSystem;
            const currentCutIndex = animationSystem?.getCurrentCutIndex?.() ?? 0;
            
            this.project.cuts.forEach(cut => {
                if (cut.renderTexture) {
                    cut.renderTexture.destroy(true);
                }
                
                cut.width = w;
                cut.height = h;
                cut.renderTexture = PIXI.RenderTexture.create({
                    width: Math.round(w * this.project.DPR),
                    height: Math.round(h * this.project.DPR)
                });
                cut.needsThumbnailUpdate = true;
            });
            
            if (animationSystem?.animationData?.cuts) {
                animationSystem.animationData.cuts.forEach((cut, cutIndex) => {
                    if (cut.container && cut.container.children) {
                        cut.container.children.forEach(layer => {
                            if (layer.layerData?.isBackground) {
                                this.updateBackgroundLayerSize(layer, w, h);
                            }
                        });
                    }
                    
                    if (this.internal.layerManager?.renderCutToTexture) {
                        this.internal.layerManager.renderCutToTexture(cut.id, cut.container);
                    }
                    
                    if (cutIndex === currentCutIndex) {
                        setTimeout(() => {
                            if (animationSystem.generateCutThumbnail) {
                                animationSystem.generateCutThumbnail(cutIndex);
                            }
                        }, 50);
                    } else {
                        setTimeout(() => {
                            if (animationSystem.generateCutThumbnail) {
                                animationSystem.generateCutThumbnail(cutIndex);
                            }
                        }, 100 + cutIndex * 50);
                    }
                });
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('camera:resized', { width: w, height: h });
                
                setTimeout(() => {
                    window.TegakiEventBus.emit('animation:thumbnails-need-update');
                }, 200);
            }
            
            CONFIG.canvas.width = w;
            CONFIG.canvas.height = h;
            
            if (this.internal.cameraSystem?.resizeCanvas) {
                this.internal.cameraSystem.resizeCanvas(w, h);
            }
            
            if (this.internal.layerManager?.updateLayerPanelUI) {
                setTimeout(() => {
                    this.internal.layerManager.updateLayerPanelUI();
                }, 100);
            }
            
            return true;
        },
        
        updateThumbnails() {
            this.project.cuts.forEach((cut, index) => {
                if (cut.needsThumbnailUpdate) {
                    this.renderCutToTexture(cut.id);
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('cut:thumbnail-updated', { 
                            cutId: cut.id, 
                            cutIndex: index 
                        });
                    }
                }
            });
        },
        
        markCutDirty(cutId) {
            const cut = cutId ? this.getCutById(cutId) : this.getActiveCut();
            if (cut) {
                cut.needsThumbnailUpdate = true;
            }
        },
        
        api: {
            draw: {
                clear: () => {
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('layer:clear-active');
                        return true;
                    }
                    return false;
                },
                
                undo: () => {
                    if (window.History) {
                        window.History.undo();
                        return true;
                    }
                    return false;
                },
                
                redo: () => {
                    if (window.History) {
                        window.History.redo();
                        return true;
                    }
                    return false;
                }
            },
            
            tool: {
                // ✅改修3: ツール切り替えを確実に伝播
                set: (toolName) => {
                    const engine = CoreRuntime.internal.drawingEngine;
                    if (!engine) return false;
                    
                    // 1. DrawingEngineに直接設定
                    if (engine.setTool) {
                        engine.setTool(toolName);
                    }
                    
                    // 2. StrokeRendererに伝播
                    if (engine.strokeRenderer && engine.strokeRenderer.setTool) {
                        engine.strokeRenderer.setTool(toolName);
                    }
                    
                    // 3. カーソル更新
                    if (CoreRuntime.internal.cameraSystem?.updateCursor) {
                        CoreRuntime.internal.cameraSystem.updateCursor();
                    }
                    
                    // 4. EventBus通知
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('tool:select', { tool: toolName });
                    }
                    
                    console.log(`🔧 Tool set to: ${toolName}`);
                    
                    return true;
                },
                
                get: () => {
                    return CoreRuntime.internal.drawingEngine?.currentTool || null;
                },
                
                setPen: () => {
                    return CoreRuntime.api.tool.set('pen');
                },
                
                setEraser: () => {
                    return CoreRuntime.api.tool.set('eraser');
                }
            },
            
            brush: {
                setSize: (size) => {
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('brush:size-changed', { size });
                        return true;
                    }
                    return false;
                },
                
                getSize: () => {
                    const brushSettings = CoreRuntime.internal.drawingEngine?.brushSettings;
                    return brushSettings?.getSize() || CONFIG.pen.size || 3;
                },
                
                setColor: (color) => {
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('brush:color-changed', { color });
                        return true;
                    }
                    return false;
                },
                
                getColor: () => {
                    const brushSettings = CoreRuntime.internal.drawingEngine?.brushSettings;
                    return brushSettings?.getColor() || CONFIG.pen.color || 0x800000;
                },
                
                setOpacity: (opacity) => {
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('brush:alpha-changed', { alpha: opacity });
                        return true;
                    }
                    return false;
                },
                
                getOpacity: () => {
                    const brushSettings = CoreRuntime.internal.drawingEngine?.brushSettings;
                    return brushSettings?.getAlpha() || CONFIG.pen.opacity || 1.0;
                }
            },
            
            camera: {
                pan: (dx, dy) => {
                    if (CoreRuntime.internal.cameraSystem) {
                        CoreRuntime.internal.cameraSystem.worldContainer.x += dx;
                        CoreRuntime.internal.cameraSystem.worldContainer.y += dy;
                        CoreRuntime.internal.cameraSystem.updateTransformDisplay();
                        return true;
                    }
                    return false;
                },
                
                zoom: (factor, centerX = null, centerY = null) => {
                    if (!CoreRuntime.internal.cameraSystem) return false;
                    
                    const currentScale = CoreRuntime.internal.cameraSystem.worldContainer.scale.x;
                    const newScale = currentScale * factor;
                    
                    if (newScale >= CONFIG.camera.minScale && newScale <= CONFIG.camera.maxScale) {
                        const cx = centerX !== null ? centerX : CONFIG.canvas.width / 2;
                        const cy = centerY !== null ? centerY : CONFIG.canvas.height / 2;
                        
                        const worldCenter = window.CoordinateSystem.localToGlobal(
                            CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
                        );
                        
                        CoreRuntime.internal.cameraSystem.worldContainer.scale.set(newScale);
                        
                        const newWorldCenter = window.CoordinateSystem.localToGlobal(
                            CoreRuntime.internal.cameraSystem.worldContainer, { x: cx, y: cy }
                        );
                        
                        CoreRuntime.internal.cameraSystem.worldContainer.x += worldCenter.x - newWorldCenter.x;
                        CoreRuntime.internal.cameraSystem.worldContainer.y += worldCenter.y - newWorldCenter.y;
                        CoreRuntime.internal.cameraSystem.updateTransformDisplay();
                        
                        return true;
                    }
                    return false;
                },
                
                reset: () => {
                    if (CoreRuntime.internal.cameraSystem?.resetView) {
                        CoreRuntime.internal.cameraSystem.resetView();
                        return true;
                    }
                    return false;
                },
                
                getZoom: () => {
                    return CoreRuntime.internal.cameraSystem?.worldContainer?.scale?.x || 1;
                },
                
                getPosition: () => {
                    if (!CoreRuntime.internal.cameraSystem?.worldContainer) return { x: 0, y: 0 };
                    return {
                        x: CoreRuntime.internal.cameraSystem.worldContainer.x,
                        y: CoreRuntime.internal.cameraSystem.worldContainer.y
                    };
                },
                
                resize: (w, h) => {
                    return CoreRuntime.updateCanvasSize(w, h);
                }
            },
            
            layer: {
                getActive: () => {
                    return CoreRuntime.internal.layerManager?.getActiveLayer() || null;
                },
                
                getActiveIndex: () => {
                    return CoreRuntime.internal.layerManager?.activeLayerIndex ?? -1;
                },
                
                getAll: () => {
                    return CoreRuntime.internal.layerManager?.getLayers() || [];
                },
                
                getCount: () => {
                    return CoreRuntime.internal.layerManager?.getLayers()?.length || 0;
                },
                
                create: (name, isBackground = false) => {
                    if (CoreRuntime.internal.layerManager) {
                        const result = CoreRuntime.internal.layerManager.createLayer(name, isBackground);
                        if (result) {
                            CoreRuntime.internal.layerManager.updateLayerPanelUI();
                            CoreRuntime.internal.layerManager.updateStatusDisplay();
                        }
                        return result;
                    }
                    return null;
                },
                
                delete: (index) => {
                    if (CoreRuntime.internal.layerManager?.deleteLayer) {
                        return CoreRuntime.internal.layerManager.deleteLayer(index);
                    }
                    return false;
                },
                
                setActive: (index) => {
                    if (CoreRuntime.internal.layerManager) {
                        CoreRuntime.internal.layerManager.setActiveLayer(index);
                        return true;
                    }
                    return false;
                },
                
                setVisible: (index, visible) => {
                    const layers = CoreRuntime.internal.layerManager?.getLayers();
                    if (layers && layers[index]) {
                        layers[index].visible = visible;
                        CoreRuntime.internal.layerManager.updateLayerPanelUI();
                        return true;
                    }
                    return false;
                },
                
                setOpacity: (index, opacity) => {
                    const layers = CoreRuntime.internal.layerManager?.getLayers();
                    if (layers && layers[index]) {
                        layers[index].alpha = Math.max(0, Math.min(1, opacity));
                        CoreRuntime.internal.layerManager.updateLayerPanelUI();
                        return true;
                    }
                    return false;
                },
                
                enterMoveMode: () => {
                    if (CoreRuntime.internal.layerManager?.enterLayerMoveMode) {
                        CoreRuntime.internal.layerManager.enterLayerMoveMode();
                        return true;
                    }
                    return false;
                },
                
                exitMoveMode: () => {
                    if (CoreRuntime.internal.layerManager?.exitLayerMoveMode) {
                        CoreRuntime.internal.layerManager.exitLayerMoveMode();
                        return true;
                    }
                    return true;
                }
            },
            
            settings: {
                get: (key) => {
                    if (!key) {
                        const bs = CoreRuntime.internal.drawingEngine?.brushSettings;
                        return bs?.getCurrentSettings() || {};
                    }
                    
                    if (key === 'pen.size') {
                        return CoreRuntime.api.brush.getSize();
                    } else if (key === 'pen.color') {
                        return CoreRuntime.api.brush.getColor();
                    } else if (key === 'pen.opacity') {
                        return CoreRuntime.api.brush.getOpacity();
                    }
                    return null;
                },
                
                set: (key, value) => {
                    if (key === 'pen.size') {
                        return CoreRuntime.api.brush.setSize(value);
                    } else if (key === 'pen.color') {
                        return CoreRuntime.api.brush.setColor(value);
                    } else if (key === 'pen.opacity') {
                        return CoreRuntime.api.brush.setOpacity(value);
                    }
                    return false;
                },
                
                update: (updates) => {
                    for (const [key, value] of Object.entries(updates)) {
                        CoreRuntime.api.settings.set(key, value);
                    }
                    return true;
                },
                
                reset: () => {
                    const bs = CoreRuntime.internal.drawingEngine?.brushSettings;
                    if (bs?.resetToDefaults) {
                        bs.resetToDefaults();
                    }
                    return true;
                },
                
                getAll: () => {
                    return CoreRuntime.api.settings.get();
                }
            },
            
            popup: {
                show: (name) => {
                    if (!window.PopupManager) return false;
                    return window.PopupManager.show(name);
                },
                
                hide: (name) => {
                    if (!window.PopupManager) return false;
                    return window.PopupManager.hide(name);
                },
                
                toggle: (name) => {
                    if (!window.PopupManager) return false;
                    return window.PopupManager.toggle(name);
                },
                
                hideAll: (exceptName = null) => {
                    if (!window.PopupManager) return;
                    window.PopupManager.hideAll(exceptName);
                },
                
                isVisible: (name) => {
                    if (!window.PopupManager) return false;
                    return window.PopupManager.isVisible(name);
                }
            },
            
            animation: {
                getCutCount: () => {
                    return window.animationSystem?.getAnimationData()?.cuts?.length || 0;
                },
                
                getCurrentCutIndex: () => {
                    return window.animationSystem?.getCurrentCutIndex?.() ?? -1;
                },
                
                createCut: () => {
                    if (window.animationSystem?.createCutFromCurrentState) {
                        window.animationSystem.createCutFromCurrentState();
                        return true;
                    }
                    return false;
                },
                
                deleteCut: (index) => {
                    if (window.animationSystem?.deleteCut) {
                        return window.animationSystem.deleteCut(index);
                    }
                    return false;
                },
                
                goToCut: (index) => {
                    if (window.animationSystem?.switchToCut) {
                        window.animationSystem.switchToCut(index);
                        return true;
                    }
                    return false;
                },
                
                play: () => {
                    if (window.timelineUI?.playAnimation) {
                        window.timelineUI.playAnimation();
                        return true;
                    }
                    return false;
                },
                
                stop: () => {
                    if (window.timelineUI?.stopAnimation) {
                        window.timelineUI.stopAnimation();
                        return true;
                    }
                    return false;
                },
                
                isPlaying: () => {
                    return window.timelineUI?.isPlaying || false;
                }
            }
        },
        
        coord: window.CoordinateSystem,
        
        getEngines() {
            return {
                camera: this.internal.cameraSystem,
                layer: this.internal.layerManager,
                drawing: this.internal.drawingEngine
            };
        },
        
        getCameraSystem() { return this.internal.cameraSystem; },
        getLayerManager() { return this.internal.layerManager; },
        getDrawingEngine() { return this.internal.drawingEngine; },
        
        isInitialized() { return this.internal.initialized; }
    };
    
CoreRuntime.initializeExportSystem = function(pixiApp, onSuccess) {
    if (window.TEGAKI_EXPORT_MANAGER) {
        return true;
    }
    
    if (!window.ExportManager || !window.PNGExporter || !window.APNGExporter || !window.GIFExporter) {
        return false;
    }
    
    if (!pixiApp || !this.internal.layerManager || !this.internal.cameraSystem) {
        return false;
    }
    
    if (!window.animationSystem) {
        return false;
    }
    
    window.TEGAKI_EXPORT_MANAGER = new window.ExportManager(
        pixiApp,
        this.internal.layerManager,
        window.animationSystem,
        this.internal.cameraSystem
    );
    
    const mgr = window.TEGAKI_EXPORT_MANAGER;
    
    mgr.registerExporter('png', new window.PNGExporter(mgr));
    mgr.registerExporter('apng', new window.APNGExporter(mgr));
    mgr.registerExporter('gif', new window.GIFExporter(mgr));
    
    // PDFエクスポーター登録を追加
    if (window.PDFExporter) {
        mgr.registerExporter('pdf', new window.PDFExporter(mgr));
    }
    
    if (window.WebPExporter) {
        mgr.registerExporter('webp', new window.WebPExporter(mgr));
    }
    
    if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('export:manager:initialized', { timestamp: Date.now() });
    }
    
    if (onSuccess) onSuccess();
    return true;
};
    
    window.CoreRuntime = CoreRuntime;
    
    window.startTegakiApp = async function(config = {}) {
        const isBookmarkletMode = config.isBookmarkletMode || false;
        window._isBookmarkletMode = isBookmarkletMode;
        
        const container = config.container || document.getElementById('canvas-container');
        if (!container) {
            throw new Error('Canvas container not found');
        }
        
        const app = new PIXI.Application();
        
        const appWidth = config.width || window.innerWidth;
        const appHeight = config.height || window.innerHeight;
        
        await app.init({
            width: appWidth,
            height: appHeight,
            backgroundColor: 0x1a1a1a,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        container.appendChild(app.canvas);
        
        if (!window.TegakiCore || !window.TegakiCore.CoreEngine) {
            throw new Error('TegakiCore.CoreEngine not found');
        }
        
        const coreEngine = new window.TegakiCore.CoreEngine(app, config);
        coreEngine.initialize();
        
        const layerSystem = coreEngine.getLayerManager();
        const animationSystem = coreEngine.getAnimationSystem();
        const cameraSystem = coreEngine.getCameraSystem();
        
        let exportManager = null;
        if (window.ExportManager && animationSystem) {
            exportManager = new window.ExportManager(
                app,
                layerSystem,
                animationSystem,
                cameraSystem
            );
            
            if (window.PNGExporter) {
                exportManager.registerExporter('png', new window.PNGExporter(exportManager));
            }
            if (window.APNGExporter) {
                exportManager.registerExporter('apng', new window.APNGExporter(exportManager));
            }
            if (window.GIFExporter) {
                exportManager.registerExporter('gif', new window.GIFExporter(exportManager));
            }
            if (window.WebPExporter) {
                exportManager.registerExporter('webp', new window.WebPExporter(exportManager));
            }
        }
        
        return {
            app: app,
            coreEngine: coreEngine,
            exportManager: exportManager
        };
    };
    
})();

console.log('✅ core-runtime.js (ツール切り替え強化版) loaded');