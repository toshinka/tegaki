// ===== core-runtime.js v2.2 - window.drawingEngine追加版 =====
// 【改修 v2.2】setupLegacyCompatibility() に window.drawingEngine を追加
// 【Phase 12】PixiJS EventSystem統合版 + 設定API拡張
// PixiJS v8.13 対応

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
            settingsManager: null,
            initialized: false,
            pointerEventsSetup: false
        },
        
        init(options) {
            console.log('=== CoreRuntime v2.2 初期化開始 ===');
            
            Object.assign(this.internal, options);
            this.project.renderer = options.app?.renderer;
            this.project.stage = options.app?.stage;
            this.internal.initialized = true;
            
            this.setupCoordinateSystem();
            
            const defaultCut = this.createCut({ name: 'CUT1' });
            this.switchCut(defaultCut.id);
            
            // 🔧 改修: setupLegacyCompatibilityでwindow.drawingEngineを設定
            this.setupLegacyCompatibility();
            
            this.setupPointerEvents();
            
            console.log('✅ CoreRuntime v2.2 初期化完了');
            
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
            console.log('✅ PixiJS EventSystem設定完了');
        },
        
        handlePointerDown(event) {
            if (window.KeyboardHandler) {
                const debugState = window.KeyboardHandler.getDebugState?.();
                if (debugState && (debugState.pKeyPressed || debugState.eKeyPressed)) {
                    return;
                }
            }
            
            const screenX = event.global.x;
            const screenY = event.global.y;
            
            if (this.internal.drawingEngine && !this.internal.layerManager?.isLayerMoveMode) {
                this.internal.drawingEngine.startDrawing(screenX, screenY, event);
            }
        },
        
        handlePointerMove(event) {
            if (window.KeyboardHandler) {
                const debugState = window.KeyboardHandler.getDebugState?.();
                if (debugState && debugState.isDragging) {
                    return;
                }
            }
            
            const screenX = event.global.x;
            const screenY = event.global.y;
            
            if (this.internal.drawingEngine?.isDrawing) {
                this.internal.drawingEngine.continueDrawing(screenX, screenY, event);
            }
        },
        
        handlePointerUp(event) {
            if (window.KeyboardHandler) {
                const debugState = window.KeyboardHandler.getDebugState?.();
                if (debugState && debugState.isDragging) {
                    return;
                }
            }
            
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
        
        /**
         * 🔧 改修: window.drawingEngine を追加
         * ToolSizeManager対応のため
         */
        setupLegacyCompatibility() {
            window.drawingApp = {
                pixiApp: this.internal.app,
                cameraSystem: this.internal.cameraSystem,
                layerManager: this.internal.layerManager,
                drawingEngine: this.internal.drawingEngine,
                app: this.internal.app
            };
            
            // 🔧 追加: window.drawingEngine グローバル登録
            window.drawingEngine = this.internal.drawingEngine;
            
            window.drawingAppResizeCanvas = (w, h) => {
                return this.updateCanvasSize(w, h);
            };
            
            console.log('✅ Legacy Compatibility設定完了');
            console.log('   - window.drawingApp.drawingEngine');
            console.log('   - window.drawingEngine (NEW)');
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
            
            console.log(`✅ CUT作成: ${cut.name} (${w}x${h})`);
            return cut;
        },
        
        switchCut(cutId) {
            const newCut = this.getCutById(cutId);
            if (!newCut) {
                console.error('CUT not found:', cutId);
                return false;
            }
            
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
            
            console.log(`🔄 CUT切替: ${newCut.name}`);
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
            
            try {
                this.project.renderer.render({
                    container: cut.container,
                    target: cut.renderTexture
                });
                
                cut.needsThumbnailUpdate = false;
                return cut.renderTexture;
            } catch (error) {
                console.error('RenderTexture生成エラー:', error);
                return null;
            }
        },
        
        extractCutDataURL(cutId) {
            const renderTexture = this.renderCutToTexture(cutId);
            if (!renderTexture || !this.project.renderer) return '';
            
            try {
                const canvas = this.project.renderer.extract.canvas(renderTexture);
                return canvas.toDataURL('image/png');
            } catch (error) {
                console.error('dataURL取得エラー:', error);
                return '';
            }
        },
        
        updateBackgroundLayerSize(layer, width, height) {
            if (!layer?.layerData?.isBackground) return false;
            if (!layer.layerData.backgroundGraphics) return false;
            
            const bg = layer.layerData.backgroundGraphics;
            
            bg.clear();
            bg.rect(0, 0, width, height);
            bg.fill(CONFIG.background.color || 0xF0E0D6);
            
            return true;
        },
        
        updateCanvasSize(w, h) {
            console.log('CoreRuntime: キャンバスサイズ変更:', w, 'x', h);
            
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
            
            console.log('✅ 全CUTのRenderTexture再生成完了');
            console.log('✅ 背景レイヤー自動塗り完了');
            console.log('✅ タイムラインサムネイル更新開始');
            
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
        
        getDebugInfo() {
            return {
                initialized: this.internal.initialized,
                cutsCount: this.project.cuts.length,
                activeCutId: this.project.activeCutId,
                canvasSize: this.project.canvasSize,
                DPR: this.project.DPR,
                pointerEventsSetup: this.internal.pointerEventsSetup,
                settingsManagerInitialized: this.internal.settingsManager !== null,
                drawingEngineGlobal: !!window.drawingEngine, // 🔧 追加
                cuts: this.project.cuts.map(c => ({
                    id: c.id,
                    name: c.name,
                    layerCount: c.layers.length,
                    needsUpdate: c.needsThumbnailUpdate
                }))
            };
        },
        
        api: {
            setTool(toolName) {
                if (CoreRuntime.internal.drawingEngine?.setTool) {
                    CoreRuntime.internal.drawingEngine.setTool(toolName);
                    if (CoreRuntime.internal.cameraSystem?.switchTool) {
                        CoreRuntime.internal.cameraSystem.switchTool(toolName);
                    }
                    return true;
                }
                return false;
            },
            
            setBrushSize(size) {
                if (CoreRuntime.internal.drawingEngine?.setBrushSize) {
                    CoreRuntime.internal.drawingEngine.setBrushSize(size);
                    return true;
                }
                return false;
            },
            
            setBrushOpacity(opacity) {
                if (CoreRuntime.internal.drawingEngine?.setBrushOpacity) {
                    CoreRuntime.internal.drawingEngine.setBrushOpacity(opacity);
                    return true;
                }
                return false;
            },
            
            panCamera(dx, dy) {
                if (CoreRuntime.internal.cameraSystem) {
                    CoreRuntime.internal.cameraSystem.worldContainer.x += dx;
                    CoreRuntime.internal.cameraSystem.worldContainer.y += dy;
                    CoreRuntime.internal.cameraSystem.updateTransformDisplay();
                    return true;
                }
                return false;
            },
            
            zoomCamera(factor, centerX = null, centerY = null) {
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
            
            resizeCanvas(w, h) {
                return CoreRuntime.updateCanvasSize(w, h);
            },
            
            getActiveLayer() {
                return CoreRuntime.internal.layerManager?.getActiveLayer() || null;
            },
            
            createLayer(name, isBackground = false) {
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
            
            setActiveLayer(index) {
                if (CoreRuntime.internal.layerManager) {
                    CoreRuntime.internal.layerManager.setActiveLayer(index);
                    return true;
                }
                return false;
            },
            
            enterLayerMoveMode() {
                if (CoreRuntime.internal.layerManager?.enterLayerMoveMode) {
                    CoreRuntime.internal.layerManager.enterLayerMoveMode();
                    return true;
                }
                return false;
            },
            
            exitLayerMoveMode() {
                if (CoreRuntime.internal.layerManager?.exitLayerMoveMode) {
                    CoreRuntime.internal.layerManager.exitLayerMoveMode();
                    return true;
                }
                return true;
            },
            
            setPressureCorrection(value) {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return false;
                return manager.set('pressureCorrection', value);
            },
            
            setSmoothing(value) {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return false;
                return manager.set('smoothing', value);
            },
            
            setPressureCurve(curve) {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return false;
                return manager.set('pressureCurve', curve);
            },
            
            getSettings() {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return null;
                return manager.get();
            },
            
            updateSettings(updates) {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return false;
                return manager.update(updates);
            },
            
            resetSettings() {
                const manager = CoreRuntime.internal.settingsManager;
                if (!manager) return false;
                manager.reset();
                return true;
            },
            
            getSettingsManager() {
                return CoreRuntime.internal.settingsManager || null;
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
            console.error('[ExportInit] ExportManager or Exporters not loaded');
            return false;
        }
        
        if (!pixiApp || !this.internal.layerManager || !this.internal.cameraSystem) {
            console.error('[ExportInit] missing dependencies: app/layerManager/cameraSystem');
            return false;
        }
        
        if (!window.animationSystem) {
            console.error('[ExportInit] animationSystem not ready');
            return false;
        }
        
        try {
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
            
            if (window.WebPExporter) {
                mgr.registerExporter('webp', new window.WebPExporter(mgr));
            }
            
            if (window.ExportPopup && !window.TEGAKI_EXPORT_POPUP && !window._isBookmarkletMode) {
                window.TEGAKI_EXPORT_POPUP = new window.ExportPopup(mgr);
                
                const exportToolBtn = document.getElementById('export-tool');
                if (exportToolBtn) {
                    exportToolBtn.addEventListener('click', () => {
                        if (window.TEGAKI_EXPORT_POPUP.isVisible) {
                            window.TEGAKI_EXPORT_POPUP.hide();
                        } else {
                            window.TEGAKI_EXPORT_POPUP.show();
                        }
                    });
                }
            }
            
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('export:manager:initialized', { timestamp: Date.now() });
            }
            
            console.log('✅ ExportSystem initialized (PNG/APNG/GIF/WebP)');
            
            if (onSuccess) onSuccess();
            return true;
            
        } catch (error) {
            console.error('[ExportInit] initialization failed:', error);
            return false;
        }
    };
    
    window.CoreRuntime = CoreRuntime;
    
    window.startTegakiApp = async function(config = {}) {
        console.log('🚀 startTegakiApp() called');
        
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
            
            console.log('✅ ExportManager initialized with exporters');
        }
        
        console.log('✅ Tegaki App initialized successfully');
        
        return {
            app: app,
            coreEngine: coreEngine,
            exportManager: exportManager
        };
    };
    
    console.log('✅ core-runtime.js v2.2 loaded');
    console.log('  ✅ Phase 12: PixiJS EventSystem統合');
    console.log('  ✅ FederatedPointerEvent対応');
    console.log('  🔧 window.drawingEngine グローバル登録追加');
    console.log('  ✅ ToolSizeManager対応完了');
    console.log('  ✅ 設定関連API完備');
    console.log('  ✅ 既存機能完全維持');
})();