/**
 * ============================================================
 * brush-core.js - Phase 7.6 History登録修正版
 * ============================================================
 * 【Phase 7.6 改修内容】
 * ✅ ストローク描画のHistory登録実装
 * ✅ window.historyManager → window.History に修正
 * ✅ recordAction() → push() に変更
 * ✅ do/undo 形式でストローク追加/削除を実装
 * ✅ Phase 4.0C 全機能継承
 * 
 * 親ファイル: drawing-engine.js
 * 依存ファイル:
 *   - system/event-bus.js (イベント通信)
 *   - coordinate-system.js (座標変換)
 *   - system/drawing/pressure-handler.js (筆圧処理)
 *   - system/drawing/stroke-recorder.js (ストローク記録)
 *   - system/drawing/stroke-renderer.js Phase 4.0C (ストローク描画)
 *   - system/layer-system.js (レイヤー管理)
 *   - system/drawing/brush-settings.js (ブラシ設定)
 *   - system/drawing/fill-tool.js (FillTool)
 *   - system/history.js (History管理) ← Phase 7.6: 追加
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
        
        /**
         * Phase 4.0C: ストローク開始
         */
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
            
            // Phase 4.0C: StrokeRenderer にストローク開始を通知
            const settings = this._getCurrentSettings();
            if (this.strokeRenderer.startStroke) {
                this.strokeRenderer.startStroke(settings);
            }
            
            // Phase 4.0C: currentStroke をプレビューとして使用
            if (this.strokeRenderer.currentStroke) {
                this.previewGraphics = this.strokeRenderer.currentStroke;
                activeLayer.addChild(this.previewGraphics);
            } else {
                // フォールバック: 通常のプレビュー
                this.previewGraphics = new PIXI.Graphics();
                this.previewGraphics.label = 'strokePreview';
                activeLayer.addChild(this.previewGraphics);
            }
            
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
        
        /**
         * Phase 4.0C: ストローク更新
         */
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
            
            // Phase 4.0C: インクリメンタルレンダリング
            if (this.previewGraphics) {
                const currentPoints = this.strokeRecorder.getCurrentPoints();
                const settings = this._getCurrentSettings();
                
                // Phase 4.0C: currentStroke の場合は clear 不要
                if (!this.strokeRenderer.currentStroke) {
                    this.previewGraphics.clear();
                }
                
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
         * Phase 7.6: ストローク終了 - History登録修正版
         */
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            // Phase 4.0C: プレビュー削除（currentStroke の場合は保持）
            const isIncrementalStroke = this.strokeRenderer.currentStroke === this.previewGraphics;
            
            if (this.previewGraphics && this.previewGraphics.parent && !isIncrementalStroke) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
            }
            
            this.previewGraphics = null;
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            const graphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings
            );
            
            if (graphics) {
                // Phase 4.0C: インクリメンタルストロークの場合は既に追加済み
                if (!isIncrementalStroke) {
                    activeLayer.addChild(graphics);
                }
                
                // Pixi手動レンダリングトリガー
                if (window.pixiApp && window.pixiApp.renderer) {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                }
                
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.pathsData) {
                        activeLayer.layerData.pathsData = [];
                    }
                    
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
                    
                    // Phase 7.6: 正しいHistory登録実装
                    if (window.History && !window.History._manager?.isApplying) {
                        const layerIndex = this.layerManager.getLayerIndex(activeLayer);
                        const layerId = activeLayer.layerData.id;
                        
                        // pathData と graphics の参照を保持
                        const pathDataRef = pathData;
                        const graphicsRef = graphics;
                        const pathsArrayRef = activeLayer.layerData.paths;
                        const pathsDataArrayRef = activeLayer.layerData.pathsData;
                        
                        const entry = {
                            name: 'stroke-draw',
                            do: () => {
                                // ストローク追加（初回は既に追加済みなので何もしない）
                                if (!activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.addChild(graphicsRef);
                                }
                                if (!pathsArrayRef.includes(pathDataRef)) {
                                    pathsArrayRef.push(pathDataRef);
                                }
                                if (!pathsDataArrayRef.includes(pathDataRef)) {
                                    pathsDataArrayRef.push(pathDataRef);
                                }
                                
                                // サムネイル更新
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            undo: () => {
                                // ストローク削除
                                if (activeLayer.children.includes(graphicsRef)) {
                                    activeLayer.removeChild(graphicsRef);
                                }
                                
                                const pathIndex = pathsArrayRef.indexOf(pathDataRef);
                                if (pathIndex !== -1) {
                                    pathsArrayRef.splice(pathIndex, 1);
                                }
                                
                                const pathDataIndex = pathsDataArrayRef.indexOf(pathDataRef);
                                if (pathDataIndex !== -1) {
                                    pathsDataArrayRef.splice(pathDataIndex, 1);
                                }
                                
                                // サムネイル更新
                                if (this.layerManager.requestThumbnailUpdate) {
                                    this.layerManager.requestThumbnailUpdate(layerIndex);
                                }
                            },
                            meta: {
                                type: 'stroke',
                                layerId: layerId,
                                layerIndex: layerIndex,
                                mode: mode,
                                pointCount: strokeData.points.length
                            }
                        };
                        
                        window.History.push(entry);
                        console.log('[BrushCore] ✅ Stroke registered to History');
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
        
        /**
         * Phase 4.0C: ストロークキャンセル
         */
        cancelStroke() {
            if (!this.isDrawing) return;
            
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            // Phase 4.0C: StrokeRenderer にキャンセル通知
            if (this.strokeRenderer && this.strokeRenderer.cancelStroke) {
                this.strokeRenderer.cancelStroke();
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
    
    console.log('✅ brush-core.js Phase 7.6 loaded (History登録修正版)');
    console.log('   ✅ ストローク描画のHistory登録実装');
    console.log('   ✅ window.History.push() で正しく登録');
    console.log('   ✅ Undo/Redo 完全対応');
    console.log('   ✅ Phase 4.0C 全機能継承');

})();