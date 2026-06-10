/**
 * ============================================================================
 * ファイル名: core-engine.js Phase 3.3 (ラスター対応完全版)
 * 責務: システム統合管理・コア機能実装
 * 
 * 【Phase 3.3 改修内容】
 * 🔧 StrokeRenderer → RasterBrushCore への切り替え
 * 🔧 window.rasterBrushCore インスタンスのグローバル登録追加
 * 🔧 ベクター方式への参照を削除
 * 🔧 ラスターブラシシステム初期化
 * ✅ v8.33.0 全機能継承
 * 
 * 【依存関係 - Parents】
 * - system/camera-system.js (TegakiCameraSystem)
 * - system/layer-system.js (TegakiLayerSystem)
 * - system/drawing-clipboard.js (TegakiDrawingClipboard)
 * - system/drawing/brush-core.js (BrushCore)
 * - system/drawing/drawing-engine.js (DrawingEngine)
 * - system/drawing/raster/raster-brush-core.js (RasterBrushCore) ← 🆕 Phase 3.3
 * - system/event-bus.js (TegakiEventBus)
 * - system/export-manager.js (ExportManager)
 * - system/exporters/*.js (各エクスポーター)
 * 
 * 【依存関係 - Children】
 * - core-initializer.js (初期化元)
 * ============================================================================
 */

(function() {
    'use strict';
    
    // 必須システムチェック
    if (!window.TegakiCameraSystem) throw new Error('system/camera-system.js required');
    if (!window.TegakiLayerSystem) throw new Error('system/layer-system.js required');
    if (!window.TegakiDrawingClipboard) throw new Error('system/drawing-clipboard.js required');
    if (!window.TegakiEventBus) throw new Error('system/event-bus.js required');
    
    const CONFIG = window.TEGAKI_CONFIG;
    if (!CONFIG) throw new Error('config.js required');
    if (!CONFIG.animation) throw new Error('Animation configuration required');

    // ================================================================================
    // 統合キーハンドラー
    // ================================================================================

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
                
                // Undo/Redo
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
                
                // カメラリセット
                if (metaKey && e.code === 'Digit0') {
                    this.cameraSystem?.resetView();
                    e.preventDefault();
                    return;
                }
            });
            
            // ツール選択イベント
            this.eventBus.on('tool:select', (data) => {
                this.switchTool(data.tool);
            });
            
            // カメラ操作イベント
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
            
            // UI操作イベント
            this.eventBus.on('ui:open-settings', () => {
                if (window.TegakiUI?.uiController) {
                    window.TegakiUI.uiController.closeAllPopups();
                    if (window.TegakiUI.uiController.settingsPopup) {
                        window.TegakiUI.uiController.settingsPopup.show();
                    }
                }
            });
            
            // ウィンドウフォーカスイベント
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

    // ================================================================================
    // コアエンジン
    // ================================================================================

    class CoreEngine {
        constructor(app, config = {}) {
            this.app = app;
            this.isBookmarkletMode = config.isBookmarkletMode || false;
            this.eventBus = window.TegakiEventBus;
            if (!this.eventBus) throw new Error('window.TegakiEventBus required');
            
            // システム初期化
            this.cameraSystem = new window.TegakiCameraSystem();
            this.layerSystem = new window.TegakiLayerSystem();
            this.clipboardSystem = new window.TegakiDrawingClipboard();
            
            // ブラシ設定
            this.brushSettings = new BrushSettings(CONFIG, this.eventBus);
            window.brushSettings = this.brushSettings;
            
            // 描画エンジン
            this.drawingEngine = new DrawingEngine(
                this.app,
                this.layerSystem,
                this.cameraSystem,
                window.History
            );
            
            this.drawingEngine.setBrushSettings(this.brushSettings);
            
            // その他のシステム
            this.animationSystem = null;
            this.timelineUI = null;
            this.keyHandler = null;
            this.exportManager = null;
            this.batchAPI = null;
            
            this.setupCrossReferences();
            this.setupSystemEventIntegration();
        }
        
        // ================================================================================
        // システム相互参照
        // ================================================================================
        
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
        
        // ================================================================================
        // システムイベント統合
        // ================================================================================
        
        setupSystemEventIntegration() {
            // レイヤークリアイベント
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
            
            // レイヤー選択イベント
            this.eventBus.on('layer:activated', (data) => {
                this.eventBus.emit('clipboard:get-info-request');
            });
            
            // 描画完了イベント
            this.eventBus.on('drawing:completed', (data) => {
                this.eventBus.emit('ui:drawing-completed', data);
            });
        }
        
        // ================================================================================
        // エクスポートマネージャー
        // ================================================================================
        
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
            
            // エクスポーター登録
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
        
        // ================================================================================
        // アニメーションシステム
        // ================================================================================
        
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
        
        // ================================================================================
        // レイヤー変形
        // ================================================================================
        
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
        
        // ================================================================================
        // Getter メソッド
        // ================================================================================
        
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
        
        // ================================================================================
        // Undo/Redo
        // ================================================================================
        
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
        
        // ================================================================================
        // キャンバス操作
        // ================================================================================
        
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
            
            // 🔧 Phase 3.3: rasterStrokes配列にも対応
            const frames = this.animationSystem?.animationData?.frames || [];
            frames.forEach(frame => {
                const layers = frame.getLayers();
                layers.forEach(layer => {
                    if (layer.layerData?.isBackground) return;
                    
                    // rasterStrokes または paths 配列を処理
                    const strokes = layer.layerData?.rasterStrokes || layer.layerData?.paths;
                    if (strokes) {
                        strokes.forEach(stroke => {
                            if (stroke.points) {
                                stroke.points.forEach(point => {
                                    point.x += offsetX;
                                    point.y += offsetY;
                                });
                            }
                            
                            if (stroke.graphics) {
                                stroke.graphics.clear();
                                stroke.points.forEach(p => {
                                    stroke.graphics.circle(p.x, p.y, stroke.size / 2);
                                    stroke.graphics.fill({
                                        color: stroke.color,
                                        alpha: stroke.opacity
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
            if (this.app) {
                this.app.destroy(true, { children: true });
            }
            
            if (this.eventBus && this.eventBus.removeAllListeners) {
                this.eventBus.removeAllListeners();
            }
        }
        
        // ================================================================================
        // 🔧 Phase 3.3: ラスター方式初期化（完全修正版）
        // ================================================================================
        
        initialize() {
            console.log('[CoreEngine] 🚀 Starting initialization...');
            
            // 基本システム初期化
            this.cameraSystem.init(this.app.stage, this.eventBus, CONFIG);
            this.layerSystem.init(this.cameraSystem.worldContainer, this.eventBus, CONFIG);
            this.clipboardSystem.init(this.eventBus, CONFIG);
            
            // サムネイルシステム
            if (window.ThumbnailSystem) {
                window.ThumbnailSystem.app = this.app;
                window.ThumbnailSystem.init(this.eventBus);
            }
            
            // History統合
            if (window.History && typeof window.History.setLayerSystem === 'function') {
                window.History.setLayerSystem(this.layerSystem);
            }
            
            // グローバル登録
            window.layerManager = this.layerSystem;
            window.cameraSystem = this.cameraSystem;
            
            // StrokeRecorder初期化
            if (!window.StrokeRecorder) {
                throw new Error('[CoreEngine] StrokeRecorder class not loaded');
            }
            
            window.strokeRecorder = new window.StrokeRecorder(
                window.pressureHandler,
                this.cameraSystem
            );
            console.log('✅ [CoreEngine] StrokeRecorder initialized');
            
            // 🔧 Phase 3.3: RasterBrushCore インスタンス作成
            if (!window.RasterBrushCore) {
                throw new Error('[CoreEngine] RasterBrushCore class not loaded');
            }
            
            // インスタンス作成してグローバル登録
            window.rasterBrushCore = new window.RasterBrushCore(
                this.app,
                this.layerSystem,
                this.cameraSystem
            );
            
            console.log('✅ [CoreEngine] RasterBrushCore instance created and registered');
            console.log('   window.rasterBrushCore:', window.rasterBrushCore);
            
            // 🔧 Phase 3.3: DrawingEngine に RasterBrushCore を設定
            if (this.drawingEngine && this.drawingEngine.setRasterBrushCore) {
                this.drawingEngine.setRasterBrushCore(window.rasterBrushCore);
                console.log('✅ [CoreEngine] RasterBrushCore set to DrawingEngine');
            }
            
            // BrushCore初期化
            if (!window.BrushCore) {
                throw new Error('[CoreEngine] window.BrushCore not found');
            }
            
            if (!window.BrushCore.init) {
                throw new Error('[CoreEngine] window.BrushCore.init method not found');
            }
            
            window.BrushCore.init();
            console.log('✅ [CoreEngine] BrushCore initialized');
            
            if (!window.BrushCore.strokeRecorder || !window.BrushCore.layerManager) {
                throw new Error('[CoreEngine] BrushCore.init() failed - dependencies not set');
            }
            
            // アニメーションシステム初期化
            this.initializeAnimationSystem();
            
            // エクスポートマネージャー初期化
            setTimeout(() => {
                this.initializeExportManager();
            }, 100);
            
            // レイヤー変形初期化
            setTimeout(() => {
                this._initializeLayerTransform();
            }, 200);
            
            // BatchAPI初期化
            if (window.TegakiBatchAPI && this.animationSystem) {
                this.batchAPI = new window.TegakiBatchAPI(
                    this.layerSystem,
                    this.animationSystem
                );
                window.batchAPI = this.batchAPI;
            }
            
            // キーハンドラー初期化
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
            
            // イベント登録
            this.eventBus.on('animation:initial-cut-created', () => {
                this.layerSystem._emitPanelUpdateRequest();
                this.layerSystem._emitStatusUpdateRequest();
            });
            
            // UI初期化
            if (window.TegakiUI && window.TegakiUI.initializeSortable) {
                setTimeout(() => {
                    window.TegakiUI.initializeSortable(this.layerSystem);
                }, 100);
            }
            
            this.setupCanvasEvents();
            
            window.drawingEngine = this.drawingEngine;
            
            // 初期化完了イベント
            this.eventBus.emit('core:initialized', {
                systems: ['camera', 'layer', 'clipboard', 'drawing', 'raster-brush', 'keyhandler', 'animation', 'history', 'batchapi', 'export']
            });
            
            console.log('✅ [CoreEngine] Initialization complete!');
            
            return this;
        }
    }

    // ================================================================================
    // グローバル登録
    // ================================================================================

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

    console.log('✅ core-engine.js Phase 3.3 loaded (ラスター対応完全版)');
    console.log('   🔧 StrokeRenderer → RasterBrushCore 切り替え完了');
    console.log('   🔧 window.rasterBrushCore インスタンス登録完了');
    console.log('   🔧 ベクター方式への依存を削除');
    console.log('   ✅ ラスターブラシシステム初期化完了');
    console.log('   ✅ v8.33.0 全機能継承');

})();