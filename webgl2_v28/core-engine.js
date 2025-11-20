/**
 * ================================================================================
 * core-engine.js Phase 5修正版: DrawingEngine初期化統合
 * ================================================================================
 * 
 * 【Phase 5改修内容】
 * 🔧 DrawingEngine.initialize()呼び出し追加
 * 🔧 PointerHandlerインスタンス作成と接続
 * 🔧 WebGL2キャンバス参照の確実な受け渡し
 * 🔧 初期化順序の最適化
 * 
 * 【Phase 4-C改修内容】
 * 🔧 _renderLoop()にプレビュー更新追加
 * 🔧 BrushCore.renderPreview()呼び出し統合
 * 🔧 Master Loop完全統合維持
 * 
 * 【依存関係】
 * - system/camera-system.js (TegakiCameraSystem)
 * - system/layer-system.js (TegakiLayerSystem)
 * - system/drawing-clipboard.js (TegakiDrawingClipboard)
 * - system/drawing/brush-core.js (BrushCore)
 * - system/drawing/stroke-recorder.js (StrokeRecorder)
 * - system/drawing/stroke-renderer.js (StrokeRenderer)
 * - system/drawing/drawing-engine.js (DrawingEngine)
 * - system/drawing/pointer-handler.js (PointerHandler)
 * - system/event-bus.js (TegakiEventBus)
 * - system/export-manager.js (ExportManager)
 * - coordinate-system.js (CoordinateSystem)
 * 
 * ================================================================================
 */

(function() {
    'use strict';
    
    if (!window.TegakiCameraSystem) throw new Error('system/camera-system.js required');
    if (!window.TegakiLayerSystem) throw new Error('system/layer-system.js required');
    if (!window.TegakiDrawingClipboard) throw new Error('system/drawing-clipboard.js required');
    if (!window.TegakiEventBus) throw new Error('system/event-bus.js required');
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) throw new Error('config.js required');
    if (!CONFIG.animation) throw new Error('Animation configuration required');

    class UnifiedKeyHandler {
        constructor(cameraSystem, layerSystem, drawingEngine, eventBus, animationSystem) {
            this.cameraSystem = cameraSystem;
            this.layerSystem = layerSystem;
            this.drawingEngine = drawingEngine;
            this.eventBus = eventBus || window.TegakiEventBus;
            this.animationSystem = animationSystem;
            this.timelineUI = null;
            this.keymap = window.TEGAKI_KEYMAP;
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
                
                if (metaKey && (e.code === 'KeyZ' || e.code === 'KeyY')) {
                    if (e.code === 'KeyZ' && !e.shiftKey) {
                        if (window.History?.canUndo()) {
                            window.History.undo();
                            e.preventDefault();
                        }
                    } else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) {
                        if (window.History?.canRedo()) {
                            window.History.redo();
                            e.preventDefault();
                        }
                    }
                    return;
                }
                
                if (metaKey && e.code === 'Digit0') {
                    this.cameraSystem?.resetView();
                    e.preventDefault();
                    return;
                }
            });
            
            this.eventBus.on('tool:select', (data) => {
                this.switchTool(data.tool);
            });
            
            this.eventBus.on('camera:flip-horizontal', () => {
                if (this.cameraSystem?.flipHorizontal) {
                    this.cameraSystem.flipHorizontal();
                }
            });
            
            this.eventBus.on('camera:flip-vertical', () => {
                if (this.cameraSystem?.flipVertical) {
                    this.cameraSystem.flipVertical();
                }
            });
            
            this.eventBus.on('camera:reset', () => {
                if (this.cameraSystem?.resetView) {
                    this.cameraSystem.resetView();
                }
            });
            
            this.eventBus.on('ui:open-settings', () => {
                if (window.TegakiUI?.uiController) {
                    window.TegakiUI.uiController.closeAllPopups();
                    if (window.TegakiUI.uiController.settingsPopup) {
                        window.TegakiUI.uiController.settingsPopup.show();
                    }
                }
            });
            
            window.addEventListener('blur', () => this.resetAllKeyStates());
            window.addEventListener('focus', () => this.resetAllKeyStates());
        }
        
        switchTool(tool) {
            if (window.BrushCore) {
                window.BrushCore.setMode(tool);
            }
            
            if (this.cameraSystem) {
                this.cameraSystem.updateCursor();
            }
            
            this.eventBus.emit('tool:changed', { newTool: tool });
        }
        
        resetAllKeyStates() {
            if (this.cameraSystem?._resetAllKeyStates) {
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
        window.brushSettings = this.brushSettings;
        
        // 🔧 Phase 5: DrawingEngineは引数なしで生成（initialize()で依存注入）
        this.drawingEngine = new DrawingEngine();
        
        this.animationSystem = null;
        this.timelineUI = null;
        this.keyHandler = null;
        this.exportManager = null;
        this.batchAPI = null;
        
        this.renderLoopId = null;
        this.isRenderLoopRunning = false;
        
        this.setupCrossReferences();
        this.setupSystemEventIntegration();
    }
        
        setupCrossReferences() {
            this.cameraSystem.setLayerManager(this.layerSystem);
            this.cameraSystem.setDrawingEngine(this.drawingEngine);
            
            this.layerSystem.setCameraSystem(this.cameraSystem);
            this.layerSystem.setApp(this.app);
            
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
                            
                            this.eventBus.emit('thumbnail:layer-updated', {
                                component: 'core-engine',
                                action: 'clear-layer',
                                data: { layerIndex, layerId: activeLayer.layerData.id }
                            });
                            
                            this.eventBus.emit('layer:cleared', { 
                                layerIndex,
                                objectCount: childrenSnapshot.length 
                            });
                        },
                        undo: () => {
                            childrenSnapshot.forEach(child => {
                                activeLayer.addChild(child);
                            });
                            
                            this.eventBus.emit('thumbnail:layer-updated', {
                                component: 'core-engine',
                                action: 'restore-layer',
                                data: { layerIndex, layerId: activeLayer.layerData.id }
                            });
                            
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
        
        startRenderLoop() {
            if (this.isRenderLoopRunning) {
                console.warn('[CoreEngine] Render loop already running');
                return;
            }
            
            this.isRenderLoopRunning = true;
            this._renderLoop();
        }
        
        /**
         * 🔧 Phase 4-C改修: リアルタイムプレビュー統合
         */
        _renderLoop() {
            if (!this.isRenderLoopRunning) return;
            
            try {
                // 1. ポインタバッチ処理
                this.flushPointerBatch();
                
                // 🔧 Phase 4-C追加: リアルタイムプレビュー更新
                if (window.BrushCore && 
                    typeof window.BrushCore.renderPreview === 'function' &&
                    window.BrushCore.isDrawing) {
                    window.BrushCore.renderPreview();
                }
                
                // 2. WebGPU描画処理（将来実装予定）
                // this.gpuRender();
                
                // 3. Pixi UI手動レンダー
                if (this.app && this.app.renderer && this.app.stage) {
                    this.app.renderer.render(this.app.stage);
                }
                
            } catch (error) {
                console.error('[CoreEngine] Render loop error:', error);
            }
            
            this.renderLoopId = requestAnimationFrame(() => this._renderLoop());
        }
        
        flushPointerBatch() {
            if (this.drawingEngine && typeof this.drawingEngine.flushPendingPoints === 'function') {
                this.drawingEngine.flushPendingPoints();
            }
        }
        
        stopRenderLoop() {
            this.isRenderLoopRunning = false;
            if (this.renderLoopId) {
                cancelAnimationFrame(this.renderLoopId);
                this.renderLoopId = null;
            }
        }
        
        initializeExportManager() {
            if (this.exportManager) {
                return true;
            }
            
            if (!window.ExportManager) {
                console.warn('[CoreEngine] ExportManager class not loaded');
                return false;
            }
            
            if (!this.animationSystem) {
                console.warn('[CoreEngine] AnimationSystem not initialized yet');
                return false;
            }
            
            this.exportManager = new window.ExportManager(
                this.app,
                this.layerSystem,
                this.animationSystem,
                this.cameraSystem
            );
            
            if (window.PNGExporter) {
                this.exportManager.registerExporter('png', new window.PNGExporter(this.exportManager));
            }
            
            if (window.APNGExporter) {
                this.exportManager.registerExporter('apng', new window.APNGExporter(this.exportManager));
            }
            
            if (window.WEBPExporter) {
                this.exportManager.registerExporter('webp', new window.WEBPExporter(this.exportManager));
            }
            
            if (window.AnimatedWebPExporter) {
                this.exportManager.registerExporter('animated-webp', new window.AnimatedWebPExporter(this.exportManager));
            }
            
            if (window.GIFExporter) {
                this.exportManager.registerExporter('gif', new window.GIFExporter(this.exportManager));
            }
            
            if (window.MP4Exporter) {
                this.exportManager.registerExporter('mp4', new window.MP4Exporter(this.exportManager));
            }
            
            window.TEGAKI_EXPORT_MANAGER = this.exportManager;
            
            this.eventBus.emit('export:manager-initialized', { 
                timestamp: Date.now(),
                exporters: Object.keys(this.exportManager.exporters)
            });
            
            return true;
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
        
        _initializeLayerTransform() {
            let retryCount = 0;
            const maxRetries = 3;
            const retryDelay = 100;
            
            const trySetupFlipCallback = () => {
                if (!this.layerSystem?.transform) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(trySetupFlipCallback, retryDelay);
                    }
                    return;
                }
                
                const layerTransform = this.layerSystem.transform;
                
                layerTransform.onFlipRequest = (direction) => {
                    const activeLayer = this.layerSystem.getActiveLayer();
                    if (!activeLayer) return;
                    
                    layerTransform.flipLayer(activeLayer, direction);
                    
                    const layerIndex = this.layerSystem.activeLayerIndex;
                    if (this.eventBus) {
                        this.eventBus.emit('thumbnail:layer-updated', {
                            component: 'layer-transform',
                            action: 'flip-applied',
                            data: { layerIndex, layerId: activeLayer.layerData.id, immediate: true }
                        });
                    }
                };
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
                if (window.BrushCore) {
                    window.BrushCore.setMode(tool);
                }
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
            
            if (this.layerSystem.checkerPattern) {
                const oldChecker = this.layerSystem.checkerPattern;
                const wasVisible = oldChecker.visible;
                
                if (oldChecker.parent) {
                    oldChecker.parent.removeChild(oldChecker);
                }
                oldChecker.destroy();
                
                this.layerSystem.checkerPattern = this.layerSystem._createCheckerPatternBackground(newWidth, newHeight);
                this.layerSystem.checkerPattern.visible = wasVisible;
                
                if (this.cameraSystem.worldContainer) {
                    this.cameraSystem.worldContainer.addChildAt(this.layerSystem.checkerPattern, 0);
                }
            }
            
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
                this.eventBus.emit('thumbnail:layer-updated', {
                    component: 'core-engine',
                    action: 'canvas-resized',
                    data: { layerIndex: i, layerId: layers[i].layerData?.id }
                });
            }
            
            if (this.animationSystem) {
                setTimeout(() => {
                    const animData = this.animationSystem.getAnimationData();
                    if (animData && animData.frames) {
                        for (let i = 0; i < animData.frames.length; i++) {
                            if (this.animationSystem.generateFrameThumbnail) {
                                this.animationSystem.generateFrameThumbnail(i);
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
        
        destroy() {
            this.stopRenderLoop();
            
            if (this.app) {
                this.app.destroy(true, { children: true });
            }
            
            if (this.eventBus && this.eventBus.removeAllListeners) {
                this.eventBus.removeAllListeners();
            }
        }
        
        /**
         * ================================================================================
         * 🔧 Phase 5新規追加: DrawingEngine初期化メソッド
         * ================================================================================
         */
        _initializeDrawingEngine() {
            console.log('[CoreEngine] Initializing DrawingEngine...');

            // 1. WebGL2キャンバス取得
            const glCanvas = document.querySelector('#webgl2-canvas');
            if (!glCanvas) {
                console.error('[CoreEngine] ❌ WebGL2 canvas not found');
                console.log('[CoreEngine] 🔍 Available canvases:', 
                    Array.from(document.querySelectorAll('canvas')).map(c => c.id || c.className)
                );
                throw new Error('WebGL2 canvas (#webgl2-canvas) required for drawing');
            }
            console.log('[CoreEngine] ✅ WebGL2 canvas found:', {
                width: glCanvas.width,
                height: glCanvas.height,
                id: glCanvas.id
            });

            // 2. CoordinateSystem確認
            if (!window.CoordinateSystem) {
                console.error('[CoreEngine] ❌ CoordinateSystem not found');
                throw new Error('CoordinateSystem required');
            }
            if (!window.CoordinateSystem.initialized) {
                console.warn('[CoreEngine]⚠️ CoordinateSystem not initialized yet');
            }

            // 3. BrushCore確認
            if (!window.BrushCore) {
                console.error('[CoreEngine] ❌ BrushCore not found');
                throw new Error('BrushCore required');
            }

            // 4. PointerHandlerインスタンス作成
            if (!window.PointerHandler) {
                console.error('[CoreEngine] ❌ PointerHandler class not found');
                throw new Error('PointerHandler class required');
            }

            const pointerHandler = new window.PointerHandler(glCanvas, {
                preventDefault: true,
                capture: false
            });
            console.log('[CoreEngine] ✅ PointerHandler created');

            // 5. DrawingEngine初期化
            const engineInitSuccess = this.drawingEngine.initialize({
                coordSystem: window.CoordinateSystem,
                cameraSystem: this.cameraSystem,
                layerManager: this.layerSystem,
                brushCore: window.BrushCore,
                pointerHandler: pointerHandler,
                eventBus: this.eventBus,
                glCanvas: glCanvas
            });

            if (!engineInitSuccess) {
                console.error('[CoreEngine] ❌ DrawingEngine initialization failed');
                throw new Error('DrawingEngine initialization failed');
            }

            console.log('[CoreEngine] ✅ DrawingEngine initialized successfully');

            // 6. BrushSettingsをDrawingEngineに設定
            if (this.brushSettings) {
                this.drawingEngine.setBrushSettings(this.brushSettings);
                console.log('[CoreEngine] ✅ BrushSettings linked to DrawingEngine');
            }

            return true;
        }
        
        initialize() {
            console.log('[CoreEngine] ========================================');
            console.log('[CoreEngine] Starting initialization sequence...');
            console.log('[CoreEngine] ========================================');

            // 1. カメラシステム初期化
            console.log('[CoreEngine] [1/8] Initializing CameraSystem...');
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            console.log('[CoreEngine] ✅ CameraSystem initialized');

            // 2. レイヤーシステム初期化
            console.log('[CoreEngine] [2/8] Initializing LayerSystem...');
            this.layerSystem.init(this.cameraSystem.worldContainer, this.eventBus, CONFIG);
            console.log('[CoreEngine] ✅ LayerSystem initialized');

            // 3. クリップボードシステム初期化
            console.log('[CoreEngine] [3/8] Initializing ClipboardSystem...');
            this.clipboardSystem.init(this.eventBus, CONFIG);
            console.log('[CoreEngine] ✅ ClipboardSystem initialized');
            
            // 4. サムネイルシステム初期化（オプション）
            if (window.ThumbnailSystem) {
                console.log('[CoreEngine] [4/8] Initializing ThumbnailSystem...');
                window.ThumbnailSystem.app = this.app;
                window.ThumbnailSystem.init(this.eventBus);
                console.log('[CoreEngine] ✅ ThumbnailSystem initialized');
            } else {
                console.log('[CoreEngine] [4/8] ThumbnailSystem not available (optional)');
            }
            
            // 5. History設定
            console.log('[CoreEngine] [5/8] Setting up History...');
            if (window.History && typeof window.History.setLayerSystem === 'function') {
                window.History.setLayerSystem(this.layerSystem);
                console.log('[CoreEngine] ✅ History linked to LayerSystem');
            } else {
                console.log('[CoreEngine] ⚠️ History not available');
            }
            
            // グローバル参照設定
            window.layerManager = this.layerSystem;
            window.cameraSystem = this.cameraSystem;
            
            // 6. StrokeRecorder確認・作成
            console.log('[CoreEngine] [6/8] Checking StrokeRecorder...');
            if (!window.strokeRecorder) {
                if (!window.StrokeRecorder) {
                    throw new Error('[CoreEngine] StrokeRecorder class not loaded');
                }
                console.warn('[CoreEngine] Creating StrokeRecorder instance (should be pre-created)');
                window.strokeRecorder = new window.StrokeRecorder(
                    window.pressureHandler,
                    this.cameraSystem
                );
            }
            console.log('[CoreEngine] ✅ StrokeRecorder ready');
            
            // 7. StrokeRenderer確認・作成
            console.log('[CoreEngine] [7/8] Checking StrokeRenderer...');
            if (!window.strokeRenderer) {
                if (!window.StrokeRenderer) {
                    throw new Error('[CoreEngine] StrokeRenderer class not loaded');
                }
                console.warn('[CoreEngine] Creating StrokeRenderer instance (should be pre-created)');
                window.strokeRenderer = new window.StrokeRenderer(
                    this.app,
                    this.layerSystem,
                    this.cameraSystem
                );
            }
            console.log('[CoreEngine] ✅ StrokeRenderer ready');
            
            // 8. BrushCore初期化
            console.log('[CoreEngine] [8/8] Initializing BrushCore...');
            if (!window.BrushCore) {
                throw new Error('[CoreEngine] window.BrushCore not found');
            }
            
            if (!window.BrushCore.init) {
                throw new Error('[CoreEngine] window.BrushCore.init method not found');
            }
            
            window.BrushCore.init();
            
            if (!window.BrushCore.strokeRecorder || !window.BrushCore.layerManager) {
                throw new Error('[CoreEngine] BrushCore.init() failed - dependencies not set');
            }
            console.log('[CoreEngine] ✅ BrushCore initialized');
            
            // ========================================
            // 🔧 Phase 5追加: DrawingEngine初期化
            // ========================================
            console.log('[CoreEngine] ========================================');
            console.log('[CoreEngine] [Phase 5] Initializing DrawingEngine...');
            console.log('[CoreEngine] ========================================');
            
            try {
                this._initializeDrawingEngine();
                console.log('[CoreEngine] ✅ DrawingEngine initialization complete');
            } catch (error) {
                console.error('[CoreEngine] ❌ DrawingEngine initialization failed:', error);
                // 致命的エラーとして扱う
                throw error;
            }
            
            // ========================================
            // アニメーションシステム初期化
            // ========================================
            console.log('[CoreEngine] Initializing AnimationSystem...');
            this.initializeAnimationSystem();
            
            // エクスポートマネージャー初期化（遅延）
            setTimeout(() => {
                console.log('[CoreEngine] Initializing ExportManager...');
                this.initializeExportManager();
            }, 100);
            
            // レイヤートランスフォーム初期化（遅延）
            setTimeout(() => {
                console.log('[CoreEngine] Initializing LayerTransform...');
                this._initializeLayerTransform();
            }, 200);
            
            // BatchAPI初期化
            if (window.TegakiBatchAPI && this.animationSystem) {
                console.log('[CoreEngine] Initializing BatchAPI...');
                this.batchAPI = new window.TegakiBatchAPI(
                    this.layerSystem,
                    this.animationSystem
                );
                window.batchAPI = this.batchAPI;
                console.log('[CoreEngine] ✅ BatchAPI initialized');
            }
            
            // UnifiedKeyHandler初期化
            console.log('[CoreEngine] Initializing UnifiedKeyHandler...');
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
            console.log('[CoreEngine] ✅ UnifiedKeyHandler initialized');
            
            // イベントリスナー設定
            this.eventBus.on('animation:initial-cut-created', () => {
                this.layerSystem.updateLayerPanelUI();
                this.layerSystem.updateStatusDisplay();
            });
            
            // Sortable初期化（遅延）
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                setTimeout(() => {
                    window.TegakiUI.initializeSortable(this.layerSystem);
                }, 100);
            }
            
            // キャンバスイベント設定
            this.setupCanvasEvents();
            
            // グローバル参照
            window.drawingEngine = this.drawingEngine;
            
            // 初期化完了イベント発火
            this.eventBus.emit('core:initialized', {
                systems: [
                    'camera', 
                    'layer', 
                    'clipboard', 
                    'drawing', 
                    'drawing-engine',  // 🔧 Phase 5追加
                    'pointer-handler', // 🔧 Phase 5追加
                    'keyhandler', 
                    'animation', 
                    'history', 
                    'batchapi', 
                    'export', 
                    'render-loop', 
                    'preview'
                ]
            });
            
            console.log('[CoreEngine] ========================================');
            console.log('[CoreEngine] ✅ Initialization complete!');
            console.log('[CoreEngine] ========================================');
            
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

    console.log('✅ core-engine.js Phase 5 DrawingEngine初期化統合版 loaded');
    console.log('   🔧 DrawingEngine.initialize()呼び出し追加');
    console.log('   🔧 PointerHandlerインスタンス作成と接続');
    console.log('   🔧 WebGL2キャンバス参照の確実な受け渡し');
    console.log('   🔧 初期化フロー完全統合');
    console.log('   🔧 Phase 4-C: リアルタイムプレビュー統合維持');

})();