/**
 * ================================================================
 * [PART 1/2] Core Classes & Initialization
 * ================================================================
 * ⚠️ このファイルは2パートに分割されています
 * ⚠️ 各パートを順番にコピペして結合してください
 * ================================================================
 */

/**
 * ============================================================
 * brush-core.js - Phase 3.2: ラスター対応版
 * ============================================================
 * 【親依存】
 * - drawing-engine.js (呼び出し元)
 * - system/event-bus.js
 * - coordinate-system.js
 * - system/drawing/pressure-handler.js
 * - system/drawing/stroke-recorder.js
 * - system/drawing/raster/raster-brush-core.js (新規)
 * - system/layer-system.js
 * - system/drawing/brush-settings.js
 * - system/drawing/fill-tool.js
 * - system/history.js
 * 
 * 【Phase 3.2改修内容】
 * ✅ strokeRenderer → rasterBrushCore に変更
 * ✅ ラスター描画パイプライン統合
 * ✅ History登録ロジック維持
 * ✅ Phase C-2.1全機能継承
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
            this.rasterBrushCore = null;  // 変更: strokeRenderer → rasterBrushCore
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
            this.rasterBrushCore = window.RasterBrushCore;  // 変更
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
            if (!this.rasterBrushCore) {
                throw new Error('[BrushCore] window.RasterBrushCore not initialized');
            }
            
            if (!this.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will use defaults');
            }
            
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Raster mode)');
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
                    // ラスター方式ではモード変更のみ記録
                    console.log('[BrushCore] Mode changed:', data.mode);
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
                    mode: 'pen',
                    hardness: 1.0
                };
            }
            
            const settings = this.brushSettings.getSettings();
            
            // ラスター設定を追加
            const rasterConfig = window.TEGAKI_CONFIG?.brush?.raster;
            if (rasterConfig) {
                settings.hardness = rasterConfig.stamp?.hardness || 1.0;
                settings.tilt = rasterConfig.tilt;
                settings.twist = rasterConfig.twist;
            }
            
            return settings;
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
            
            // ラスターブラシコア開始
            if (this.rasterBrushCore.startStroke) {
                this.rasterBrushCore.startStroke(
                    localX, localY, 
                    processedPressure, 
                    tiltX, tiltY, twist,
                    settings
                );
            }
            
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
            
            // stroke-recorderに記録（変更なし）
            this.strokeRecorder.addPoint(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            // ラスターブラシコアに送信
            if (this.rasterBrushCore.addStrokePoint) {
                this.rasterBrushCore.addStrokePoint(
                    localX, localY,
                    processedPressure,
                    tiltX, tiltY, twist
                );
            }
            
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            this.lastTiltX = tiltX;
            this.lastTiltY = tiltY;
            this.lastTwist = twist;
        }

/**
 * ================================================================
 * [END PART 1] - 次は PART 2 をこの下に貼り付けてください
 * ================================================================
 */

/**
 * ================================================================
 * [PART 2/2] Finalization & Helper Functions
 * ================================================================
 * ⚠️ PART 1 の下にこのコードを貼り付けてください
 * ================================================================
 */

        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            // ラスターブラシコア終了
            const graphics = this.rasterBrushCore.finalizeStroke();
            
            if (graphics) {
                // レイヤーに追加
                activeLayer.addChild(graphics);
                
                if (window.pixiApp && window.pixiApp.renderer) {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                }
                
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.rasterStrokes) {
                        activeLayer.layerData.rasterStrokes = [];
                    }
                    
                    const strokeRecord = {
                        id: `raster_stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        graphics: graphics,
                        points: strokeData.points,
                        tool: mode,
                        settings: { ...settings },
                        color: settings.color,
                        size: settings.size,
                        opacity: settings.opacity,
                        timestamp: Date.now()
                    };
                    
                    // 配列に追加（History.push前に完了）
                    activeLayer.layerData.rasterStrokes.push(strokeRecord);
                    
                    // History登録
                    if (window.History && !window.History._manager?.isApplying) {
                        const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                        const layerId = activeLayer.layerData.id;
                        
                        const strokeRef = strokeRecord;
                        const graphicsRef = graphics;
                        const strokesArrayRef = activeLayer.layerData.rasterStrokes;
                        
                        const entry = {
                            name: 'raster-stroke-draw',
                            do: () => {
                                // Redo時のみ実行
                                if (!activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.addChild(graphicsRef);
                                }
                                if (!strokesArrayRef.includes(strokeRef)) {
                                    strokesArrayRef.push(strokeRef);
                                }
                                
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            undo: () => {
                                if (activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.removeChild(graphicsRef);
                                }
                                
                                const strokeIndex = strokesArrayRef.indexOf(strokeRef);
                                if (strokeIndex !== -1) {
                                    strokesArrayRef.splice(strokeIndex, 1);
                                }
                                
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            meta: {
                                type: 'raster-stroke',
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
            
            if (this.rasterBrushCore && this.rasterBrushCore.cancelStroke) {
                this.rasterBrushCore.cancelStroke();
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
    
    console.log('✅ brush-core.js Phase 3.2 loaded (ラスター対応版)');
    console.log('   ✅ strokeRenderer → rasterBrushCore 変更');
    console.log('   ✅ pathsData → rasterStrokes 変更');
    console.log('   ✅ History登録ロジック維持');
    console.log('   ✅ Phase C-2.1全機能継承');

})();

/**
 * ================================================================
 * [END PART 2] - ファイル完成！
 * ================================================================
 */