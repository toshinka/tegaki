/**
 * ============================================================
 * brush-core.js - Phase 3.3: ラスター対応版（完全修正）
 * ============================================================
 * 【親依存】
 * - drawing-engine.js (呼び出し元)
 * - system/event-bus.js
 * - coordinate-system.js
 * - system/drawing/pressure-handler.js
 * - system/drawing/stroke-recorder.js
 * - system/drawing/raster/raster-brush-core.js (インスタンス: window.rasterBrushCore)
 * - system/layer-system.js
 * - system/drawing/brush-settings.js
 * - system/drawing/fill-tool.js
 * - system/history.js
 * 
 * 【Phase 3.3改修内容】
 * 🔧 window.RasterBrushCore (クラス) → window.rasterBrushCore (インスタンス) に修正
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
            this.rasterBrushCore = null;
            this.eventBus = null;
            this.brushSettings = null;
            this.fillTool = null;
            this.previewGraphics = null;
            this.eventListenersSetup = false;
        }
        
        init() {
            if (this.coordinateSystem) return;
            
            this.coordinateSystem = window.CoordinateSystem;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerSystem || window.layerManager;
            this.rasterBrushCore = window.rasterBrushCore;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            this.brushSettings = window.brushSettings;
            this.fillTool = window.FillTool;
            
            this._initializePressureHandler();
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Raster mode)');
        }
        
        _initializePressureHandler() {
            if (window.pressureHandler) {
                this.pressureHandler = window.pressureHandler;
                return;
            }
            if (window.PressureHandler) {
                window.pressureHandler = new window.PressureHandler();
                this.pressureHandler = window.pressureHandler;
            }
        }
        
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) return;
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) console.log('[BrushCore] Mode changed:', data.mode);
            });
            this.eventListenersSetup = true;
        }
        
        _getCurrentSettings() {
            if (!this.brushSettings) {
                return { size: 10, opacity: 1.0, color: 0x000000, mode: 'pen', hardness: 0.8 };
            }
            const settings = this.brushSettings.getSettings();
            const rasterConfig = window.TEGAKI_CONFIG?.brush?.raster;
            if (rasterConfig) {
                settings.hardness = rasterConfig.stamp?.hardness || 0.8;
                settings.flow = rasterConfig.flow || 1.0;
            }
            return settings;
        }
        
        setMode(mode) {
            if (this.brushSettings) this.brushSettings.setMode(mode);
        }
        
        getMode() {
            return this.brushSettings ? this.brushSettings.getMode() : 'pen';
        }
        
        startStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            if (this.isDrawing || this.getMode() === 'fill') return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = this.pressureHandler ? this.pressureHandler.process(pressure) : pressure;
            this.strokeRecorder.startStroke(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            
            const settings = this._getCurrentSettings();
            if (this.rasterBrushCore) {
                this.rasterBrushCore.startStroke(localX, localY, processedPressure, tiltX, tiltY, twist, settings);
            }
        }
        
        updateStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = this.pressureHandler ? this.pressureHandler.process(pressure) : pressure;
            this.strokeRecorder.addPoint(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            if (this.rasterBrushCore) {
                this.rasterBrushCore.addStrokePoint(localX, localY, processedPressure, tiltX, tiltY, twist);
            }
        }

        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            this.strokeRecorder.endStroke();
            if (this.pressureHandler?.reset) this.pressureHandler.reset();
            
            let rasterSuccess = false;
            if (this.rasterBrushCore) {
                rasterSuccess = await this.rasterBrushCore.finalizeStroke();
            }
            
            if (rasterSuccess) {
                console.log('[BrushCore] ✅ Raster stroke finalized');
                const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                if (this.layerManager.requestThumbnailUpdate && layerIndex !== -1) {
                    this.layerManager.requestThumbnailUpdate(layerIndex);
                }
            }
            
            this.isDrawing = false;
        }
        
        cancelStroke() {
            if (!this.isDrawing) return;
            if (this.pressureHandler?.reset) this.pressureHandler.reset();
            if (this.rasterBrushCore?.cancelStroke) this.rasterBrushCore.cancelStroke();
            this.isDrawing = false;
        }
        
        isActive() { return this.isDrawing; }
    }
    
    window.BrushCore = new BrushCore();
    console.log('✅ brush-core.js Phase 3.3 loaded (Fixed)');
})();
