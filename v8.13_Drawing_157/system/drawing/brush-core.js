/**
 * ================================================================================
 * system/drawing/brush-core.js - Phase 1-3: 消しゴム対応版
 * ================================================================================
 * 
 * 【Phase 1-3 改修内容 - renderFinalStroke統合】
 * ✅ finalizeStroke() で renderFinalStroke() を使用
 * ✅ 消しゴムモード時の RenderTexture 処理を正しく実行
 * ✅ renderStroke() は legacy 専用のため使用しない
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - event-bus.js (イベント通信)
 *   - coordinate-system.js (座標変換)
 *   - pressure-handler.js (筆圧処理)
 *   - stroke-recorder.js (ストローク記録)
 *   - stroke-renderer.js (ストローク描画)
 *   - layer-system.js (レイヤー管理)
 *   - brush-settings.js (ブラシ設定 - mode 情報源)
 * 
 * 【責務】
 *   - ストローク開始/更新/完了処理
 *   - 座標変換パイプライン統合
 *   - プレビュー表示管理
 *   - ペン/消しゴムモードの正しい描画処理
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
            
            this.previewGraphics = null;
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
            this.brushSettings = window.brushSettings;
            
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
            if (!this.pressureHandler) {
                console.warn('[BrushCore] window.pressureHandler not found - pressure sensitivity disabled');
            }
            
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Phase 1-3 - 消しゴム対応版)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - BrushSettings:', !!this.brushSettings);
        }
        
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) {
                return;
            }
            
            this.eventBus.on('brush:size-changed', (data) => {
                if (data && typeof data.size === 'number') {
                    console.log(`[BrushCore] Size changed: ${data.size}`);
                }
            });
            
            this.eventBus.on('brush:color-changed', (data) => {
                if (data && typeof data.color === 'number') {
                    console.log(`[BrushCore] Color changed: 0x${data.color.toString(16)}`);
                }
            });
            
            this.eventBus.on('brush:opacity-changed', (data) => {
                if (data && typeof data.opacity === 'number') {
                    console.log(`[BrushCore] Opacity changed: ${(data.opacity * 100).toFixed(0)}%`);
                }
            });
            
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) {
                    console.log(`[BrushCore] Mode changed: ${data.oldMode} → ${data.mode}`);
                    
                    if (this.strokeRenderer && this.strokeRenderer.setTool) {
                        this.strokeRenderer.setTool(data.mode);
                    }
                }
            });
            
            this.eventListenersSetup = true;
        }
        
        _getCurrentSettings() {
            if (!this.brushSettings) {
                console.warn('[BrushCore] BrushSettings not available, using defaults');
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
            if (mode !== 'pen' && mode !== 'eraser') {
                console.error(`[BrushCore] Invalid brush mode: ${mode}`);
                return;
            }
            
            if (this.brushSettings) {
                this.brushSettings.setMode(mode);
            } else {
                console.warn('[BrushCore] BrushSettings not available, cannot set mode');
            }
            
            if (this.strokeRenderer && this.strokeRenderer.setTool) {
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
                        mode: this.getMode(),
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
        
        /**
         * 🔧 Phase 1-3: renderFinalStroke() を使用
         * renderStroke() は legacy 専用のため、消しゴムモードに対応していない
         */
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            console.log(`[BrushCore] Finalizing stroke in mode: ${mode}`);
            
            // 🔧 renderFinalStroke() を使用（消しゴム対応）
            const graphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings
            );
            
            if (graphics) {
                // 消しゴムの場合、既にレイヤーに適用済み（_applyEraserMask内で）
                if (mode === 'eraser') {
                    console.log('[BrushCore] Eraser stroke applied');
                } else {
                    // ペンの場合は追加
                    activeLayer.addChild(graphics);
                    
                    // pathsData に記録
                    if (activeLayer.layerData) {
                        if (!activeLayer.layerData.pathsData) {
                            activeLayer.layerData.pathsData = [];
                        }
                        
                        const pathData = {
                            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            graphics: graphics,
                            points: strokeData.points,
                            tool: mode,
                            settings: { ...settings }
                        };
                        
                        activeLayer.layerData.pathsData.push(pathData);
                        
                        if (window.historyManager) {
                            window.historyManager.recordAction({
                                type: 'stroke',
                                layerId: activeLayer.layerData?.id,
                                pathData: pathData
                            });
                        }
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
    
    console.log('✅ brush-core.js (Phase 1-3 - 消しゴム対応版) loaded');
    console.log('   ✓ renderFinalStroke() を使用');
    console.log('   ✓ 消しゴムモードの RenderTexture 処理に対応');
    console.log('   ✓ renderStroke() は使用しない');

})();