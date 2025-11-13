/**
 * ================================================================================
 * system/drawing/brush-core.js - Phase 7-FIX3: strokeData完全対応
 * ================================================================================
 * 
 * 【Phase 7-FIX3 改修内容】
 * 🔧 strokeData.polygon を正しく渡す
 * 🔧 プレビュー更新でPolygonGeneratorを正しく使用
 * 
 * 【依存Parents】
 *   - coordinate-system.js (座標変換)
 *   - stroke-recorder.js (ストローク記録)
 *   - stroke-renderer.js (ストローク描画・プレビュー管理)
 *   - layer-system.js (レイヤー管理)
 *   - brush-settings.js (ブラシ設定)
 *   - history.js (Undo/Redo)
 *   - polygon-generator.js (ポリゴン生成)
 * 
 * 【依存Children】
 *   - drawing-engine.js (ストローク開始/更新/完了呼び出し)
 * ================================================================================
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
            
            this.coordinateSystem = null;
            this.pressureHandler = null;
            this.strokeRecorder = null;
            this.layerManager = null;
            this.strokeRenderer = null;
            this.eventBus = null;
            this.brushSettings = null;
            this.fillTool = null;
            
            this.eventListenersSetup = false;
        }
        
        init() {
            if (this.coordinateSystem) {
                return;
            }
            
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            this.brushSettings = window.brushSettings;
            this.fillTool = window.FillTool;
            
            if (!this.coordinateSystem) {
                throw new Error('[BrushCore] window.CoordinateSystem not initialized');
            }
            if (!this.layerManager) {
                throw new Error('[BrushCore] window.layerManager not initialized');
            }
            if (!this.strokeRecorder) {
                throw new Error('[BrushCore] window.strokeRecorder not initialized');
            }
            if (!this.strokeRenderer) {
                throw new Error('[BrushCore] window.strokeRenderer not initialized');
            }
            
            this._setupEventListeners();
        }
        
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) {
                return;
            }
            
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) {
                    if (this.strokeRenderer && this.strokeRenderer.setTool) {
                        this.strokeRenderer.setTool(data.mode);
                    }
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
                    mode: 'pen'
                };
            }
            
            return this.brushSettings.getSettings();
        }
        
        setMode(mode) {
            const validModes = ['pen', 'eraser', 'fill'];
            
            if (!validModes.includes(mode)) {
                console.error(`[BrushCore] Invalid brush mode: ${mode}`);
                return;
            }
            
            if (this.brushSettings) {
                this.brushSettings.setMode(mode);
            }
            
            if (mode !== 'fill' && this.strokeRenderer && this.strokeRenderer.setTool) {
                this.strokeRenderer.setTool(mode);
            }
        }
        
        getMode() {
            if (this.brushSettings) {
                return this.brushSettings.getMode();
            }
            return 'pen';
        }
        
        startStroke(clientX, clientY, pressure) {
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
            
            const processedPressure = pressure;
            
            this.strokeRecorder.startStroke(localX, localY, processedPressure);
            
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            
            const settings = this._getCurrentSettings();
            
            // 🔧 初期ポイントのポリゴン生成
            const initialPoints = [{x: localX, y: localY, pressure: processedPressure}];
            const initialPolygon = window.PolygonGenerator ? 
                window.PolygonGenerator.generate(initialPoints) : 
                new Float32Array([localX, localY, localX + 0.1, localY + 0.1, localX, localY + 0.1]);
            
            this.strokeRenderer.renderPreview(initialPolygon, settings, activeLayer);
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-started', {
                    component: 'drawing',
                    action: 'stroke-started',
                    data: {
                        mode: currentMode,
                        layerId: activeLayer.layerData?.id,
                        localX,
                        localY,
                        pressure: processedPressure
                    }
                });
            }
        }
        
        updateStroke(clientX, clientY, pressure) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = pressure;
            
            const dx = localX - this.lastLocalX;
            const dy = localY - this.lastLocalY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.max(1, Math.floor(distance / 5));
            
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                const interpX = this.lastLocalX + dx * t;
                const interpY = this.lastLocalY + dy * t;
                const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;
                
                this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
            }
            
            this.strokeRecorder.addPoint(localX, localY, processedPressure);
            
            // 🔧 プレビュー更新
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            if (currentPoints.length > 0 && window.PolygonGenerator) {
                const polygon = window.PolygonGenerator.generate(currentPoints);
                if (polygon && polygon.length >= 6) {
                    const settings = this._getCurrentSettings();
                    this.strokeRenderer.renderPreview(polygon, settings, activeLayer);
                }
            }
            
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
        }
        
        /**
         * 🔧 Phase 7-FIX3: strokeDataを正しく渡す
         */
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // 🔧 strokeRecorderから完全なstrokeDataを取得
            const strokeData = this.strokeRecorder.endStroke();
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            // 🔧 strokeDataを直接渡す（polygon含む）
            const graphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                activeLayer
            );
            
            if (graphics) {
                // History登録
                if (window.History && !window.History._manager?.isApplying) {
                    const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                    const layerId = activeLayer.layerData.id;
                    
                    window.History.push({
                        name: 'stroke-drawing',
                        do: () => {
                            if (graphics.parent !== activeLayer) {
                                activeLayer.addChild(graphics);
                            }
                            
                            if (this.eventBus) {
                                this.eventBus.emit('thumbnail:layer-updated', {
                                    layerIndex,
                                    layerId,
                                    immediate: true
                                });
                            }
                        },
                        undo: () => {
                            if (graphics.parent === activeLayer) {
                                activeLayer.removeChild(graphics);
                            }
                            
                            if (this.eventBus) {
                                this.eventBus.emit('thumbnail:layer-updated', {
                                    layerIndex,
                                    layerId,
                                    immediate: true
                                });
                            }
                        },
                        meta: {
                            type: 'stroke',
                            layerId,
                            layerIndex,
                            mode,
                            pointCount: strokeData.points.length
                        }
                    });
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
            }
            
            this.isDrawing = false;
            
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
            
            // プレビュー削除をstroke-rendererに委譲
            if (this.strokeRenderer) {
                this.strokeRenderer.clearPreview();
            }
            
            this.isDrawing = false;
            
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
    
    console.log('✅ brush-core.js Phase 7-FIX3 loaded');
    console.log('   🔧 strokeData.polygon完全対応');

})();