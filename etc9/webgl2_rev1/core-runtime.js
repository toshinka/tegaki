/**
 * @file core-runtime.js - Phase 6: updateLayerPanelUI完全削除版
 * @description 外部APIレイヤー・レガシー互換性
 * 
 * 【Phase 6 改修内容】
 * ✅ updateLayerPanelUI 完全削除（EventBus駆動に統一）
 * ✅ _updateLayerPanelUI() 内部メソッド削除
 * ✅ layer.create 時のパネル更新をEventBusに委譲
 * 
 * 【親ファイル (このファイルが依存)】
 * - core-engine.js (内部システム)
 * - event-bus.js (イベント駆動)
 * 
 * 【子ファイル (このファイルに依存)】
 * - ui-panels.js (UI制御)
 */

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
            coreEngine: null,
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
            
            if (window.ThumbnailSystem && options.app) {
                window.ThumbnailSystem.app = options.app;
                window.ThumbnailSystem.init(options.eventBus || window.TegakiEventBus);
            }
            
            this.setupLegacyCompatibility();
            
            return this;
        },
        
        setupPointerEvents() {
            this.internal.pointerEventsSetup = true;
        },
        
        handlePointerDown(event) {},
        handlePointerMove(event) {},
        handlePointerUp(event) {},
        
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
        
        updateCanvasSize(w, h, options = {}) {
            const coreEngine = this.internal.coreEngine || window.coreEngine;
            
            if (!coreEngine || !coreEngine.resizeCanvas) {
                console.error('[CoreRuntime] CoreEngine not available for canvas resize');
                return false;
            }
            
            coreEngine.resizeCanvas(w, h, options);
            this.project.canvasSize = { w, h };
            
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
                set: (toolName) => {
                    if (!window.BrushCore) {
                        console.error('[CoreRuntime] BrushCore not available');
                        return false;
                    }
                    
                    const validTools = ['pen', 'eraser', 'fill'];
                    if (!validTools.includes(toolName)) {
                        console.warn(`[CoreRuntime] Invalid tool: ${toolName}`);
                        return false;
                    }
                    
                    window.BrushCore.setMode(toolName);
                    
                    if (CoreRuntime.internal.cameraSystem?.updateCursor) {
                        CoreRuntime.internal.cameraSystem.updateCursor();
                    }
                    
                    if (window.TegakiEventBus) {
                        window.TegakiEventBus.emit('tool:select', { tool: toolName });
                        window.TegakiEventBus.emit('tool:changed', { tool: toolName });
                    }
                    
                    return true;
                },
                
                get: () => {
                    return window.BrushCore?.getMode() || null;
                },
                
                setPen: () => CoreRuntime.api.tool.set('pen'),
                setEraser: () => CoreRuntime.api.tool.set('eraser'),
                setFill: () => CoreRuntime.api.tool.set('fill')
            },
            
            brush: {
                setSize: (size) => {
                    if (window.brushSettings) {
                        window.brushSettings.setSize(size);
                        return true;
                    }
                    return false;
                },
                
                getSize: () => {
                    return window.brushSettings?.getSize() || CONFIG.pen.size || 3;
                },
                
                setColor: (color) => {
                    if (window.brushSettings) {
                        window.brushSettings.setColor(color);
                        return true;
                    }
                    return false;
                },
                
                getColor: () => {
                    return window.brushSettings?.getColor() || CONFIG.pen.color || 0x800000;
                },
                
                setOpacity: (opacity) => {
                    if (window.brushSettings) {
                        window.brushSettings.setOpacity(opacity);
                        return true;
                    }
                    return false;
                },
                
                getOpacity: () => {
                    return window.brushSettings?.getOpacity() || CONFIG.pen.opacity || 1.0;
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
                getZoom: () => CoreRuntime.internal.cameraSystem?.worldContainer?.scale?.x || 1,
                getPosition: () => {
                    if (!CoreRuntime.internal.cameraSystem?.worldContainer) return { x: 0, y: 0 };
                    return {
                        x: CoreRuntime.internal.cameraSystem.worldContainer.x,
                        y: CoreRuntime.internal.cameraSystem.worldContainer.y
                    };
                },
                resize: (w, h) => CoreRuntime.updateCanvasSize(w, h)
            },
            layer: {
                getActive: () => CoreRuntime.internal.layerManager?.getActiveLayer() || null,
                getActiveIndex: () => CoreRuntime.internal.layerManager?.activeLayerIndex ?? -1,
                getAll: () => CoreRuntime.internal.layerManager?.getLayers() || [],
                getCount: () => CoreRuntime.internal.layerManager?.getLayers()?.length || 0,
                create: (name, isBackground = false) => {
                    if (CoreRuntime.internal.layerManager) {
                        const result = CoreRuntime.internal.layerManager.createLayer(name, isBackground);
                        // 🔧 Phase 6: EventBus駆動に統一（updateLayerPanelUI削除）
                        return result;
                    }
                    return null;
                },
                delete: (index) => CoreRuntime.internal.layerManager?.deleteLayer(index) || false,
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
                        // 🔧 Phase 6: EventBus経由で更新
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('layer:panel-update-requested');
                        }
                        return true;
                    }
                    return false;
                },
                setOpacity: (index, opacity) => {
                    const layers = CoreRuntime.internal.layerManager?.getLayers();
                    if (layers && layers[index]) {
                        layers[index].alpha = Math.max(0, Math.min(1, opacity));
                        // 🔧 Phase 6: EventBus経由で更新
                        if (window.TegakiEventBus) {
                            window.TegakiEventBus.emit('layer:panel-update-requested');
                        }
                        return true;
                    }
                    return false;
                },
                flipActiveLayer: (direction, bypassVKeyCheck = false) => {
                    if (CoreRuntime.internal.layerManager?.flipActiveLayer) {
                        CoreRuntime.internal.layerManager.flipActiveLayer(direction, bypassVKeyCheck);
                        return true;
                    }
                    return false;
                },
                enterMoveMode: () => CoreRuntime.internal.layerManager?.enterLayerMoveMode() || false,
                exitMoveMode: () => CoreRuntime.internal.layerManager?.exitLayerMoveMode() || true
            },
            settings: {
                get: (key) => {
                    if (!key) {
                        return window.brushSettings?.getSettings() || {};
                    }
                    
                    if (key === 'pen.size') return CoreRuntime.api.brush.getSize();
                    else if (key === 'pen.color') return CoreRuntime.api.brush.getColor();
                    else if (key === 'pen.opacity') return CoreRuntime.api.brush.getOpacity();
                    return null;
                },
                set: (key, value) => {
                    if (key === 'pen.size') return CoreRuntime.api.brush.setSize(value);
                    else if (key === 'pen.color') return CoreRuntime.api.brush.setColor(value);
                    else if (key === 'pen.opacity') return CoreRuntime.api.brush.setOpacity(value);
                    return false;
                },
                update: (updates) => {
                    for (const [key, value] of Object.entries(updates)) {
                        CoreRuntime.api.settings.set(key, value);
                    }
                    return true;
                },
                reset: () => {
                    if (window.brushSettings) {
                        window.brushSettings.setSize(CONFIG.pen.size || 3);
                        window.brushSettings.setColor(CONFIG.pen.color || 0x800000);
                        window.brushSettings.setOpacity(CONFIG.pen.opacity || 1.0);
                        return true;
                    }
                    return false;
                },
                getAll: () => CoreRuntime.api.settings.get()
            },
            popup: {
                show: (name) => window.PopupManager?.show(name) || false,
                hide: (name) => window.PopupManager?.hide(name) || false,
                toggle: (name) => window.PopupManager?.toggle(name) || false,
                hideAll: (exceptName = null) => window.PopupManager?.hideAll(exceptName),
                isVisible: (name) => window.PopupManager?.isVisible(name) || false
            },
            animation: {
                getCutCount: () => window.animationSystem?.getAnimationData()?.cuts?.length || 0,
                getCurrentCutIndex: () => window.animationSystem?.getCurrentCutIndex?.() ?? -1,
                createCut: () => {
                    if (window.animationSystem?.createCutFromCurrentState) {
                        window.animationSystem.createCutFromCurrentState();
                        return true;
                    }
                    return false;
                },
                deleteCut: (index) => window.animationSystem?.deleteCut(index) || false,
                goToCut: (index) => {
                    if (window.animationSystem?.switchToCut) {
                        window.animationSystem.switchToCut(index);
                        return true;
                    }
                    return false;
                },
                play: () => window.timelineUI?.playAnimation() || false,
                stop: () => window.timelineUI?.stopAnimation() || false,
                isPlaying: () => window.timelineUI?.isPlaying || false
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
    
    window.CoreRuntime = CoreRuntime;
    
    window.startTegakiApp = async function(config = {}) {
        const isBookmarkletMode = config.isBookmarkletMode || false;
        window._isBookmarkletMode = isBookmarkletMode;
        
        const container = config.container || document.getElementById('canvas-container');
        if (!container) throw new Error('Canvas container not found');
        
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
        
        CoreRuntime.internal.coreEngine = coreEngine;
        window.coreEngine = coreEngine;
        
        const layerSystem = coreEngine.getLayerManager();
        const animationSystem = coreEngine.getAnimationSystem();
        const cameraSystem = coreEngine.getCameraSystem();
        const exportManager = coreEngine.getExportManager();
        
        return {
            app: app,
            coreEngine: coreEngine,
            exportManager: exportManager
        };
    };
    
})();

console.log('✅ core-runtime.js (Phase 6 - updateLayerPanelUI完全削除版) loaded');
console.log('   ✅ EventBus駆動に完全統一');
console.log('   ✅ 存在しないメソッド呼び出し削除');