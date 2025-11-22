/**
 * ============================================================
 * brush-core.js - v2.4.1 メッシュ追加確認版
 * ============================================================
 * 親ファイル: drawing-engine.js
 * 依存ファイル:
 *   - system/event-bus.js (イベント通信)
 *   - coordinate-system.js (座標変換)
 *   - system/drawing/pressure-handler.js (筆圧処理)
 *   - system/drawing/stroke-recorder.js (ストローク記録)
 *   - system/drawing/stroke-renderer.js (ストローク描画)
 *   - system/layer-system.js (レイヤー管理)
 *   - system/drawing/brush-settings.js (ブラシ設定)
 *   - system/drawing/fill-tool.js (FillTool)
 * ============================================================
 * 【v2.4.1 改修内容】
 * ✅ メッシュ追加後の確認ログ追加
 * ✅ レイヤーへの追加を確実化
 * ✅ Pixi renderの手動トリガー追加
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
            
            this.coordinateSystem = null;
            this.pressureHandler = null;
            this.strokeRecorder = null;
            this.layerManager = null;
            this.strokeRenderer = null;
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
            this.strokeRenderer = window.strokeRenderer;
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
            if (!this.strokeRenderer) {
                throw new Error('[BrushCore] window.strokeRenderer not initialized');
            }
            
            if (!this.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will use defaults');
            }
            
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (v2.4.1 メッシュ追加確認版)');
            console.log('   ✅ PressureHandler:', !!this.pressureHandler);
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
            } else {
                console.warn('[BrushCore] BrushSettings not available, cannot set mode');
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
            
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
            this.strokeRecorder.startStroke(localX, localY, processedPressure);
            
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            
            this.previewGraphics = new PIXI.Graphics();
            this.previewGraphics.label = 'strokePreview';
            activeLayer.addChild(this.previewGraphics);
            
            const settings = this._getCurrentSettings();
            
            this.strokeRenderer.renderPreview(
                [{ x: localX, y: localY, pressure: processedPressure }],
                settings,
                this.previewGraphics
            );
            
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
            
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
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
                const settings = this._getCurrentSettings();
                
                this.previewGraphics.clear();
                this.strokeRenderer.renderPreview(
                    currentPoints,
                    settings,
                    this.previewGraphics
                );
            }
            
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
        }
        
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            const graphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings
            );
            
            if (graphics) {
                // メッシュをレイヤーに追加
                activeLayer.addChild(graphics);
                
                console.log('[BrushCore] ✅ Mesh added to layer:', {
                    label: graphics.label || 'unknown',
                    layerId: activeLayer.layerData?.id,
                    layerChildren: activeLayer.children.length,
                    meshVisible: graphics.visible,
                    meshRenderable: graphics.renderable
                });
                
                // 🔧 Pixi手動レンダリングトリガー
                if (window.pixiApp && window.pixiApp.renderer) {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                    console.log('[BrushCore] 🔄 Manual Pixi render triggered');
                }
                
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.pathsData) {
                        activeLayer.layerData.pathsData = [];
                    }
                    
                    // pathsDataにも追加（後方互換）
                    if (!activeLayer.layerData.paths) {
                        activeLayer.layerData.paths = [];
                    }
                    
                    const pathData = {
                        id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        graphics: graphics,
                        points: strokeData.points,
                        tool: mode,
                        settings: { ...settings },
                        color: settings.color,
                        size: settings.size,
                        opacity: settings.opacity
                    };
                    
                    activeLayer.layerData.pathsData.push(pathData);
                    activeLayer.layerData.paths.push(pathData);
                    
                    if (window.historyManager) {
                        window.historyManager.recordAction({
                            type: 'stroke',
                            layerId: activeLayer.layerData?.id,
                            pathData: pathData
                        });
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
                console.warn('[BrushCore] ❌ Graphics is null!');
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
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
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
    
    console.log('✅ brush-core.js v2.4.1 loaded (メッシュ追加確認版)');
    console.log('   ✅ レイヤー追加後の確認ログ実装');
    console.log('   ✅ Pixi手動レンダリングトリガー追加');

})();