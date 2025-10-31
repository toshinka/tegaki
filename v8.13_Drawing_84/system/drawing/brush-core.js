/**
 * BrushCore - Phase 3: イベント統一版
 * Phase 2: Container参照誤り + CurveInterpolator不整合解消
 * Phase 3: layer:path-added イベント発火追加
 */

(function() {
    'use strict';

    class BrushCore {
        constructor() {
            this.isDrawing = false;
            this.currentMode = 'pen';
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
            
            this.brushSettings = {
                size: 10,
                opacity: 1.0,
                color: 0x000000,
                pressureSensitivity: 0.5,
                smoothing: 0.3
            };
            
            this.previewGraphics = null;
        }
        
        init() {
            if (this.coordinateSystem) {
                console.warn('BrushCore: Already initialized');
                return;
            }
            
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            
            if (!this.coordinateSystem) {
                throw new Error('BrushCore: window.CoordinateSystem not initialized');
            }
            if (!this.layerManager) {
                throw new Error('BrushCore: window.layerManager not initialized');
            }
            if (!this.strokeRecorder) {
                throw new Error('BrushCore: window.strokeRecorder not initialized');
            }
            if (!this.strokeRenderer) {
                throw new Error('BrushCore: window.strokeRenderer not initialized');
            }
            
            if (!this.pressureHandler) {
                console.warn('BrushCore: window.pressureHandler not found - pressure sensitivity disabled');
            }
            
            console.log('✅ BrushCore initialized (Phase 3: イベント統一版)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - PressureHandler:', !!this.pressureHandler);
        }
        
        setMode(mode) {
            if (mode !== 'pen' && mode !== 'eraser') {
                throw new Error(`Invalid brush mode: ${mode}`);
            }
            
            const oldMode = this.currentMode;
            this.currentMode = mode;
            
            if (this.strokeRenderer) {
                this.strokeRenderer.setTool(mode);
            }
            
            this.eventBus?.emit('brush:mode-switched', {
                component: 'brush',
                action: 'mode-switched',
                data: { mode, oldMode }
            });
        }
        
        updateSettings(settings) {
            Object.assign(this.brushSettings, settings);
            
            this.eventBus?.emit('brush:settings-updated', {
                component: 'brush',
                action: 'settings-updated',
                data: { settings: { ...this.brushSettings } }
            });
        }
        
        startStroke(clientX, clientY, pressure) {
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
            
            this.previewGraphics = new PIXI.Graphics();
            this.previewGraphics.label = 'strokePreview';
            activeLayer.addChild(this.previewGraphics);
            
            this.strokeRenderer.renderPreview(
                [{ x: localX, y: localY, pressure: processedPressure }],
                this.brushSettings,
                this.previewGraphics
            );
            
            this.eventBus?.emit('drawing:stroke-started', {
                component: 'drawing',
                action: 'stroke-started',
                data: {
                    mode: this.currentMode,
                    layerId: activeLayer.layerData?.id,
                    localX,
                    localY,
                    pressure: processedPressure
                }
            });
        }
        
        updateStroke(clientX, clientY, pressure) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            const processedPressure = pressure;
            
            // 線形補間
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
            
            if (this.previewGraphics) {
                const currentPoints = this.strokeRecorder.getCurrentPoints();
                this.previewGraphics.clear();
                this.strokeRenderer.renderPreview(
                    currentPoints,
                    this.brushSettings,
                    this.previewGraphics
                );
            }
            
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
        }
        
        // ★★★ Phase 3修正: layer:path-added イベント追加 ★★★
        finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            const pathData = this.strokeRenderer.renderStroke(
                activeLayer,
                strokeData,
                this.brushSettings
            );
            
            if (pathData && pathData.graphics) {
                activeLayer.addChild(pathData.graphics);
                
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.pathsData) {
                        activeLayer.layerData.pathsData = [];
                    }
                    activeLayer.layerData.pathsData.push(pathData);
                }
                
                if (window.historyManager) {
                    window.historyManager.recordAction({
                        type: 'stroke',
                        layerId: activeLayer.layerData?.id,
                        pathData: pathData
                    });
                }
                
                // ★★★ Phase 3追加: layer:path-added イベント発火 ★★★
                const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                
                if (this.eventBus && layerIndex !== -1) {
                    console.log(`✏️ [BrushCore] Stroke completed - emitting layer:path-added for layer ${layerIndex}`);
                    
                    // LayerPanelRenderer が購読しているイベント
                    this.eventBus.emit('layer:path-added', {
                        component: 'drawing',
                        action: 'path-added',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            pathId: pathData.id
                        }
                    });
                    
                    // タイムライン用イベント
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'drawing',
                        action: 'stroke-completed',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            immediate: true  // 即座更新フラグ
                        }
                    });
                }
            }
            
            this.isDrawing = false;
            
            // 既存の完了イベント（互換性維持）
            this.eventBus?.emit('drawing:stroke-completed', {
                component: 'drawing',
                action: 'stroke-completed',
                data: {
                    mode: this.currentMode,
                    layerId: activeLayer.layerData?.id,
                    pointCount: strokeData.points.length
                }
            });
        }
        
        cancelStroke() {
            if (!this.isDrawing) return;
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            this.isDrawing = false;
            
            this.eventBus?.emit('drawing:stroke-cancelled', {
                component: 'drawing',
                action: 'stroke-cancelled',
                data: {}
            });
        }
        
        isActive() {
            return this.isDrawing;
        }
        
        getMode() {
            return this.currentMode;
        }
    }
    
    window.BrushCore = new BrushCore();
    
    console.log('✅ system/drawing/brush-core.js loaded (Phase 3: イベント統一版)');
    console.log('   ✓ Phase 2: Container参照誤り修正 + 線形補間実装');
    console.log('   ✓ Phase 3: layer:path-added イベント発火追加');
    console.log('   ✓ Phase 3: thumbnail:layer-updated に immediate=true フラグ追加');

})();