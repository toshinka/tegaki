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

    // ============================================================
    // BrushCore クラス - 描画管理
    // ============================================================
    
    class BrushCore {
        constructor() {
            // 描画状態
            this.isDrawing = false;
            this.currentStrokeId = null;
            
            // 最終座標・筆圧・傾きキャッシュ
            this.lastLocalX = 0;
            this.lastLocalY = 0;
            this.lastPressure = 0;
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            // システム参照
            this.coordinateSystem = null;
            this.pressureHandler = null;
            this.strokeRecorder = null;
            this.layerManager = null;
            this.rasterBrushCore = null;  // 🔧 Phase 3.3: インスタンス参照
            this.eventBus = null;
            this.brushSettings = null;
            this.fillTool = null;
            
            this.previewGraphics = null;
            this.eventListenersSetup = false;
        }
        
        // ============================================================
        // 初期化 - システム統合
        // ============================================================
        
        init() {
            if (this.coordinateSystem) {
                console.warn('[BrushCore] Already initialized');
                return;
            }
            
            // グローバルシステム取得
            this.coordinateSystem = window.CoordinateSystem;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.rasterBrushCore = window.rasterBrushCore;  // 🔧 インスタンス取得
            this.eventBus = window.eventBus || window.TegakiEventBus;
            this.brushSettings = window.brushSettings;
            this.fillTool = window.FillTool;
            
            this._initializePressureHandler();
            
            // 必須システムチェック
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
                throw new Error('[BrushCore] window.rasterBrushCore not initialized');
            }
            
            if (!this.brushSettings) {
                console.warn('[BrushCore] window.brushSettings not found - will use defaults');
            }
            
            this._setupEventListeners();
            
            console.log('✅ [BrushCore] Initialized (Raster mode)');
            console.log('   ✅ rasterBrushCore:', this.rasterBrushCore ? 'OK' : 'NG');
        }
        
        // ============================================================
        // 筆圧ハンドラー初期化
        // ============================================================
        
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
        
        // ============================================================
        // イベントリスナー設定
        // ============================================================
        
        _setupEventListeners() {
            if (this.eventListenersSetup || !this.eventBus) {
                return;
            }
            
            this.eventBus.on('brush:mode-changed', (data) => {
                if (data && data.mode) {
                    console.log('[BrushCore] Mode changed:', data.mode);
                }
            });
            
            this.eventListenersSetup = true;
        }
        
        // ============================================================
        // 設定取得 - ブラシ設定統合
        // ============================================================
        
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
        
        // ============================================================
        // ブラシモード設定
        // ============================================================
        
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
        
        // ============================================================
        // ストローク開始 - Phase B-2: 傾き対応
        // ============================================================
        
        startStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            const currentMode = this.getMode();
            
            // 塗りつぶしモード無視
            if (currentMode === 'fill') {
                return;
            }
            
            // 二重描画防止
            if (this.isDrawing) return;
            
            // アクティブレイヤー取得
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            // 座標変換: Screen → Canvas → World → Local
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            // 筆圧処理
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
            // StrokeRecorderに記録
            this.strokeRecorder.startStroke(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            // 状態更新
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            this.lastTiltX = tiltX;
            this.lastTiltY = tiltY;
            this.lastTwist = twist;
            
            // 現在の設定取得
            const settings = this._getCurrentSettings();
            
            // 🔧 Phase 3.3: RasterBrushCore開始
            if (this.rasterBrushCore && this.rasterBrushCore.startStroke) {
                this.rasterBrushCore.startStroke(
                    localX, localY, 
                    processedPressure, 
                    tiltX, tiltY, twist,
                    settings
                );
            } else {
                console.error('❌ [BrushCore] rasterBrushCore.startStroke not available');
            }
            
            // イベント発火
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
        
        // ============================================================
        // ストローク更新 - Phase B-2: 傾き対応
        // ============================================================
        
        updateStroke(clientX, clientY, pressure, tiltX = 0, tiltY = 0, twist = 0) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // 座標変換
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(worldX, worldY, activeLayer);
            
            // 筆圧処理
            const processedPressure = this.pressureHandler 
                ? this.pressureHandler.process(pressure) 
                : pressure;
            
            // StrokeRecorderに記録
            this.strokeRecorder.addPoint(localX, localY, processedPressure, tiltX, tiltY, twist);
            
            // 🔧 Phase 3.3: RasterBrushCoreに送信
            if (this.rasterBrushCore && this.rasterBrushCore.addStrokePoint) {
                this.rasterBrushCore.addStrokePoint(
                    localX, localY,
                    processedPressure,
                    tiltX, tiltY, twist
                );
            }
            
            // 状態更新
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            this.lastTiltX = tiltX;
            this.lastTiltY = tiltY;
            this.lastTwist = twist;
        }

        // ============================================================
        // ストローク終了 - History統合
        // Phase C-2.1: 二重配列追加防止
        // ============================================================
        
        async finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // StrokeRecorder終了
            const strokeData = this.strokeRecorder.endStroke();
            
            // 筆圧ハンドラーリセット
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            const settings = this._getCurrentSettings();
            const mode = settings.mode || 'pen';
            
            // 🔧 Phase 3.3: RasterBrushCore終了
            const graphics = this.rasterBrushCore ? this.rasterBrushCore.finalizeStroke() : null;
            
            if (graphics) {
                // レイヤーに追加
                activeLayer.addChild(graphics);
                
                // 即座にレンダリング
                if (window.pixiApp && window.pixiApp.renderer) {
                    window.pixiApp.renderer.render(window.pixiApp.stage);
                }
                
                // レイヤーデータに記録
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
                    
                    // 🔧 Phase C-2.1: History.push前に配列追加完了
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
                                // Redo時のみ実行（初回は既に追加済み）
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
                
                // イベント発火
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
            
            // 状態リセット
            this.isDrawing = false;
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            // イベント発火
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
        
        // ============================================================
        // ストロークキャンセル
        // ============================================================
        
        cancelStroke() {
            if (!this.isDrawing) return;
            
            // 筆圧ハンドラーリセット
            if (this.pressureHandler && this.pressureHandler.reset) {
                this.pressureHandler.reset();
            }
            
            // RasterBrushCoreキャンセル
            if (this.rasterBrushCore && this.rasterBrushCore.cancelStroke) {
                this.rasterBrushCore.cancelStroke();
            }
            
            // プレビューGraphics削除
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            // 状態リセット
            this.isDrawing = false;
            this.lastTiltX = 0;
            this.lastTiltY = 0;
            this.lastTwist = 0;
            
            // イベント発火
            if (this.eventBus) {
                this.eventBus.emit('drawing:stroke-cancelled', {
                    component: 'drawing',
                    action: 'stroke-cancelled',
                    data: {}
                });
            }
        }
        
        // ============================================================
        // 状態確認
        // ============================================================
        
        isActive() {
            return this.isDrawing;
        }
    }
    
    // ============================================================
    // グローバル登録
    // ============================================================
    
    window.BrushCore = new BrushCore();
    
    console.log('✅ brush-core.js Phase 3.3 loaded (ラスター対応完全版)');
    console.log('   🔧 window.rasterBrushCore インスタンス参照に修正');
    console.log('   ✅ strokeRenderer → rasterBrushCore 変更');
    console.log('   ✅ pathsData → rasterStrokes 変更');
    console.log('   ✅ History登録ロジック維持');
    console.log('   ✅ Phase C-2.1全機能継承');

})();