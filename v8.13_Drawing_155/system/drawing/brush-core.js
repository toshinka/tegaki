/**
 * ================================================================================
 * system/drawing/brush-core.js - Phase 3-D: BrushSettings統合版
 * ================================================================================
 * 
 * 【Phase 3-D 改修内容 - mode 統合】
 * ✅ setMode() で BrushSettings.setMode() を呼び出し
 * ✅ 二重管理を排除（BrushSettings が唯一の情報源）
 * ✅ currentMode は BrushSettings から取得
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
 * 【依存関係 - Children (このファイルに依存)】
 *   - drawing-engine.js (描画制御)
 *   - core-runtime.js (API公開)
 * 
 * 【責務】
 *   - ストローク開始/更新/完了処理
 *   - 座標変換パイプライン統合
 *   - プレビュー表示管理
 *   - ツールモード切り替えの BrushSettings への委譲
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
            
            // 依存性プロパティ
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
         * 依存性注入の初期化
         */
        init() {
            if (this.coordinateSystem) {
                console.warn('[BrushCore] Already initialized');
                return;
            }
            
            // グローバル依存を取得
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
            
            console.log('✅ [BrushCore] Initialized (Phase 3-D - BrushSettings統合版)');
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
            
            // 🆕 Phase 3-D: mode 変更イベントをリッスン
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) {
                    console.log(`[BrushCore] Mode changed: ${data.oldMode} → ${data.mode}`);
                    
                    // StrokeRenderer に mode を通知
                    if (this.strokeRenderer && this.strokeRenderer.setTool) {
                        this.strokeRenderer.setTool(data.mode);
                    }
                }
            });
            
            this.eventListenersSetup = true;
        }
        
        /**
         * BrushSettings取得を一元化
         */
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
        
        /**
         * 🔧 Phase 3-D: ツールモード設定を BrushSettings に委譲
         * @param {string} mode - 'pen' | 'eraser'
         */
        setMode(mode) {
            if (mode !== 'pen' && mode !== 'eraser') {
                console.error(`[BrushCore] Invalid brush mode: ${mode}`);
                return;
            }
            
            // 🔧 BrushSettings に委譲（唯一の情報源）
            if (this.brushSettings) {
                this.brushSettings.setMode(mode);
            } else {
                console.warn('[BrushCore] BrushSettings not available, cannot set mode');
            }
            
            // StrokeRenderer にも直接通知（イベント前の即時対応）
            if (this.strokeRenderer && this.strokeRenderer.setTool) {
                this.strokeRenderer.setTool(mode);
            }
        }
        
        /**
         * 🔧 Phase 3-D: 現在のモードを BrushSettings から取得
         * @returns {string} 'pen' | 'eraser'
         */
        getMode() {
            if (this.brushSettings) {
                return this.brushSettings.getMode();
            }
            return 'pen'; // fallback
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
                        mode: this.getMode(), // 🔧 BrushSettings から取得
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
                        mode: this.getMode(), // 🔧 BrushSettings から取得
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
    
    console.log('✅ brush-core.js (Phase 3-D - BrushSettings統合版) loaded');
    console.log('   ✓ setMode() を BrushSettings に委譲');
    console.log('   ✓ getMode() は BrushSettings から取得');
    console.log('   ✓ 二重管理を排除');
    console.log('   ✓ brush:mode-changed イベントをリッスン');

})();