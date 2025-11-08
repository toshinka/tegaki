/**
 * @file brush-core.js - Phase 6完全版（DIP改善完了）
 * @description ブラシコア処理（依存性注入パターン採用）
 * 
 * 【親ファイル (このファイルが依存)】
 * - event-bus.js (イベント通信)
 * - coordinate-system.js (座標変換)
 * - pressure-handler.js (筆圧処理)
 * - stroke-recorder.js (ストローク記録)
 * - stroke-renderer.js (ストローク描画)
 * - layer-system.js (レイヤー管理)
 * - brush-settings.js (ブラシ設定)
 * 
 * 【子ファイル (このファイルに依存)】
 * - drawing-engine.js (描画制御)
 * - core-runtime.js (API公開)
 * 
 * 【Phase 6 改修内容】
 * ✅ init()でグローバル依存を取得（Constructor Injection準備）
 * ✅ window.brushSettings への直接参照を統一
 * ✅ グローバルシングルトン依存を明示化
 * ✅ 将来的なConstructor Injection への移行準備完了
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
            
            // 🔧 Phase 6: 依存性を明示的にプロパティ宣言
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
        
        /**
         * 🔧 Phase 6: 依存性注入の初期化
         * 現在はグローバルから取得、将来的にはConstructor Injectionに移行可能
         */
        init() {
            if (this.coordinateSystem) {
                console.warn('[BrushCore] Already initialized');
                return;
            }
            
            // 🔧 Phase 6: グローバル依存を明示的に取得
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            this.brushSettings = window.brushSettings;
            
            // 必須依存性チェック
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
            
            // オプショナル依存性の警告
            if (!this.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will use defaults');
            }
            if (!this.pressureHandler) {
                console.warn('[BrushCore] window.pressureHandler not found - pressure sensitivity disabled');
            }
            
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Phase 6 - DIP改善版)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - PressureHandler:', !!this.pressureHandler);
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
            
            this.eventListenersSetup = true;
        }
        
        /**
         * 🔧 Phase 6: BrushSettings取得を一元化
         * グローバル依存だがアクセスポイントは統一
         */
        _getCurrentSettings() {
            if (!this.brushSettings) {
                console.warn('[BrushCore] BrushSettings not available, using defaults');
                return {
                    size: 3,
                    opacity: 1.0,
                    color: 0x800000
                };
            }
            
            return this.brushSettings.getSettings();
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
            
            if (this.eventBus) {
                this.eventBus.emit('brush:mode-switched', {
                    component: 'brush',
                    action: 'mode-switched',
                    data: { mode, oldMode }
                });
            }
            
            console.log(`[BrushCore] Mode switched: ${oldMode} → ${mode}`);
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
                        mode: this.currentMode,
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
            
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-completed', {
                    component: 'drawing',
                    action: 'stroke-completed',
                    data: {
                        mode: this.currentMode,
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
        
        getMode() {
            return this.currentMode;
        }
    }
    
    window.BrushCore = new BrushCore();
    
    console.log('✅ brush-core.js (Phase 6完全版 - DIP改善) loaded');
    console.log('   ✓ 依存性注入パターン採用');
    console.log('   ✓ グローバル依存を明示的に管理');
    console.log('   ✓ Constructor Injection移行準備完了');

})();