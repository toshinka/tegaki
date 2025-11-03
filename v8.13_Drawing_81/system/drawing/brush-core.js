/**
 * BrushCore - Phase 1: BrushSettings統一版
 * グローバルwindow.brushSettingsを参照し、ローカル変数を削除
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
            
            // ★Phase 1修正: ローカルbrusSettings変数を削除
            // window.brushSettingsを参照する
            
            this.previewGraphics = null;
            
            // ★Phase 1追加: EventBus購読フラグ
            this.eventListenersSetup = false;
        }
        
        init() {
            if (this.coordinateSystem) {
                console.warn('[BrushCore] Already initialized');
                return;
            }
            
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            
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
            
            // ★Phase 1追加: window.brushSettingsの確認
            if (!window.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will retry on first draw');
            } else {
                console.log('[BrushCore] window.brushSettings reference:', !!window.brushSettings);
            }
            
            if (!this.pressureHandler) {
                console.warn('[BrushCore] window.pressureHandler not found - pressure sensitivity disabled');
            }
            
            // ★Phase 1追加: EventBus購読設定
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Phase 1: BrushSettings統一版)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - PressureHandler:', !!this.pressureHandler);
            console.log('   - BrushSettings:', !!window.brushSettings);
        }
        
        // ★Phase 1追加: EventBusリスナー設定
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) {
                return;
            }
            
            // ペンサイズ変更イベント
            this.eventBus.on('brush:size-changed', ({ data }) => {
                console.log(`[BrushCore] Size changed event received: ${data.size}`);
            });
            
            // 色変更イベント
            this.eventBus.on('brush:color-changed', ({ data }) => {
                console.log(`[BrushCore] Color changed event received: 0x${data.color.toString(16)}`);
            });
            
            // 不透明度変更イベント
            this.eventBus.on('brush:opacity-changed', ({ data }) => {
                console.log(`[BrushCore] Opacity changed event received: ${(data.opacity * 100).toFixed(0)}%`);
            });
            
            this.eventListenersSetup = true;
            console.log('✅ [BrushCore] EventBus listeners setup complete');
        }
        
        // ★Phase 1修正: window.brushSettingsから設定取得
        _getCurrentSettings() {
            if (!window.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not available, using defaults');
                return {
                    size: 3,
                    opacity: 1.0,
                    color: 0x800000
                };
            }
            
            return window.brushSettings.getSettings();
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
            
            console.log(`[BrushCore] Mode switched: ${oldMode} → ${mode}`);
        }
        
        // ★Phase 1: このメソッドは不要（window.brushSettingsが直接管理）
        // 互換性のため残すが、内部では何もしない
        updateSettings(settings) {
            console.warn('[BrushCore] updateSettings() is deprecated. Use window.brushSettings directly.');
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
            
            // ★Phase 1修正: window.brushSettingsから設定取得
            const settings = this._getCurrentSettings();
            
            this.strokeRenderer.renderPreview(
                [{ x: localX, y: localY, pressure: processedPressure }],
                settings,
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
                
                // ★Phase 1修正: window.brushSettingsから設定取得
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
            
            // ★Phase 1修正: window.brushSettingsから設定取得
            const settings = this._getCurrentSettings();
            
            const pathData = this.strokeRenderer.renderStroke(
                activeLayer,
                strokeData,
                settings
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
                
                const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                
                if (this.eventBus && layerIndex !== -1) {
                    console.log(`✏️ [BrushCore] Stroke completed - emitting layer:path-added for layer ${layerIndex}`);
                    
                    this.eventBus.emit('layer:path-added', {
                        component: 'drawing',
                        action: 'path-added',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            pathId: pathData.id
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
    
    console.log('✅ brush-core.js (Phase 1: BrushSettings統一版) loaded');
    console.log('   ✓ Removed local brushSettings variable');
    console.log('   ✓ Using global window.brushSettings');
    console.log('   ✓ EventBus listeners for real-time settings update');

})();