// ===== core-engine.js - Phase 2+3修正版: processThumbnailUpdates削除 =====
// Phase2改修: リサイズ時のレイヤー座標シフト実装 + 背景色修正
// Phase3改修: processThumbnailUpdates() 呼び出し削除（ThumbnailSystemに統一）
// Phase4改修: onFlipRequestコールバック設定（タイミング修正・確実接続）
// Phase5改修: GSAP Ticker統合（レンダリング競合回避・リロード安定化）

(function() {
    'use strict';
    
    if (!window.TegakiCameraSystem) throw new Error('system/camera-system.js required');
    if (!window.TegakiLayerSystem) throw new Error('system/layer-system.js required');
    if (!window.TegakiDrawingClipboard) throw new Error('system/drawing-clipboard.js required');
    if (!window.TegakiEventBus) throw new Error('system/event-bus.js required');
    
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
            
            // Phase 5: GSAP availability check
            this.gsapAvailable = typeof gsap !== 'undefined';
            if (this.gsapAvailable) {
                console.log('[CoreEngine] GSAP detected - Ticker統合 available');
            } else {
                console.warn('[CoreEngine] GSAP not found - using PixiJS Ticker');
            }
            
            this.setupCrossReferences();
            this.setupSystemEventIntegration();
        }
        
        setupCrossReferences() {
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
            // ★★★ Phase 4完全修正: LayerTransform初期化を確実に実行 ★★★
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
        
        // ★★★ Phase 4完全修正: onFlipRequestコールバック設定（タイミング修正）★★★
        _initializeLayerTransform() {
            // 最大3回まで再試行（LayerTransform初期化待ち）
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 100; // 100ms
            
            const trySetupFlipCallback = () => {
                if (!this.layerSystem?.transform) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.warn(`[CoreEngine] layerSystem.transform not ready - retry ${retryCount}/${maxRetries}`);
                        setTimeout(trySetupFlipCallback, retryDelay);
                    } else {
                        console.error('[CoreEngine] layerSystem.transform initialization failed after retries');
                    }
                    return;
                }
                
                const layerTransform = this.layerSystem.transform;
                
                // Phase 4完全修正: onFlipRequest コールバック設定
                layerTransform.onFlipRequest = (direction) => {
                    const activeLayer = this.layerSystem.getActiveLayer();
                    if (!activeLayer) {
                        console.warn('[CoreEngine] No active layer for flip request');
                        return;
                    }
                    
                    console.log(`[CoreEngine] Flip request: ${direction}, layer:`, activeLayer.layerData?.id);
                    
                    // Transform反転実行
                    layerTransform.flipLayer(activeLayer, direction);
                    
                    // サムネイル更新トリガー（immediate=trueで即座更新）
                    const layerIndex = this.layerSystem.activeLayerIndex;
                    if (this.eventBus) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'layer-transform',
                            action: 'flip-applied',
                            data: { layerIndex, layerId: activeLayer.layerData.id, immediate: true }
                        });
                    }
                    
                    console.log(`✓ Flip applied: ${direction}, layerIndex=${layerIndex}`);
                };
                
                console.log('✅ [CoreEngine] onFlipRequest callback configured (retry: ' + retryCount + ')');
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
        
        _setupGSAPTicker() {
            if (!this.gsapAvailable) {
                console.log('[CoreEngine] GSAP Ticker統合 skipped - using PixiJS Ticker');
                return;
            }
            
            console.log('[CoreEngine] Setting up GSAP Ticker integration...');
            
            if (this.app.ticker) {
                this.app.ticker.stop();
                console.log('  ✓ PixiJS Ticker stopped');
            }
            
            this.gsapTickerCallback = () => {
                if (this.app?.renderer && this.app?.stage) {
                    this.app.renderer.render(this.app.stage);
                }
            };
            
            gsap.ticker.add(this.gsapTickerCallback);
            console.log('  ✓ GSAP Ticker registered');
            console.log('✅ GSAP Ticker integration complete');
        }
        
        destroy() {
            console.log('[CoreEngine] Destroying...');
            
            if (this.gsapAvailable) {
                if (this.gsapTickerCallback) {
                    gsap.ticker.remove(this.gsapTickerCallback);
                    console.log('  ✓ GSAP Ticker removed');
                }
                
                gsap.killTweensOf("*");
                gsap.globalTimeline.clear();
                console.log('  ✓ GSAP Tweens cleared');
            }
            
            if (this.app) {
                this.app.destroy(true, { children: true });
                console.log('  ✓ PixiJS app destroyed');
            }
            
            if (this.eventBus && this.eventBus.removeAllListeners) {
                this.eventBus.removeAllListeners();
                console.log('  ✓ EventBus cleared');
            }
            
            console.log('✅ CoreEngine destroyed');
        }
        
        initialize() {
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.canvasContainer, this.eventBus, CONFIG);
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            // ★★★ ThumbnailSystem初期化（重要）★★★
            if (window.ThumbnailSystem) {
                window.ThumbnailSystem.app = this.app;
                window.ThumbnailSystem.init(this.eventBus);
                console.log('✅ ThumbnailSystem initialized in CoreEngine');
            } else {
                console.warn('⚠️ ThumbnailSystem not found');
            }
            
            if (window.History && typeof window.History.setLayerSystem === 'function') {
                window.History.setLayerSystem(this.layerSystem);
            }
            
            this.initializeAnimationSystem();
            
            // ★★★ Phase 4完全修正: onFlipRequestコールバック設定（初期化後に実行）★★★
            // LayerSystem初期化完了後、200ms後に再試行メカニズムで設定
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
            
            // ★★★ Phase 3修正: processThumbnailUpdates()削除 - ThumbnailSystemに統一 ★★★
            // PixiJS Tickerは標準レンダリングのみ使用（サムネイル更新はEventBus経由）
            
            window.drawingEngine = this.drawingEngine;
            window.layerManager = this.layerSystem;
            window.cameraSystem = this.cameraSystem;
            
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'keyhandler', 'animation', 'history', 'batchapi', 'export']
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

    console.log('✅ core-engine.js (Phase 2+3修正版) loaded');
    console.log('   ✓ Phase 2: リサイズ時レイヤー座標シフト + 背景色修正');
    console.log('   ✓ Phase 3: processThumbnailUpdates() 削除（ThumbnailSystemに統一）');
    console.log('   ✓ Phase 4: onFlipRequest再試行メカニズム実装（確実接続）');
    console.log('   ✓ Phase 5: GSAP Ticker統合準備完了');
    console.log('   ✓ destroy()メソッド追加（リロード安定化）');
})();