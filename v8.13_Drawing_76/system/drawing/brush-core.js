/**
 * BrushCore - ペン/消しゴム共通コアロジック
 * Phase 2: drawing-engine.js統合版
 * 
 * 責務:
 * - PointerEvent → Local座標変換（coordinate-system.js経由）
 * - 筆圧処理（pressure-handler統合）
 * - 補間処理（curve-interpolator統合）
 * - ストローク記録制御（stroke-recorder呼び出し）
 * - ペン/消しゴムモード管理
 * 
 * 依存:
 * - window.CoordinateSystem
 * - window.pressureHandler
 * - window.curveInterpolator
 * - window.strokeRecorder
 * - window.layerManager
 * 
 * 禁止:
 * - レンダリングロジック（stroke-renderer.jsに分離済み）
 * - 座標変換の二重実装
 */

(function() {
    'use strict';

    class BrushCore {
        constructor() {
            this.isDrawing = false;
            this.currentMode = 'pen'; // 'pen' | 'eraser'
            this.currentStrokeId = null;
            this.lastLocalX = 0;
            this.lastLocalY = 0;
            this.lastPressure = 0;
            
            // 依存オブジェクト（初期化時に設定）
            this.coordinateSystem = null;
            this.pressureHandler = null;
            this.curveInterpolator = null;
            this.strokeRecorder = null;
            this.layerManager = null;
            this.strokeRenderer = null;
            this.eventBus = null;
            
            // ブラシ設定
            this.brushSettings = {
                size: 10,
                opacity: 1.0,
                color: 0x000000,
                pressureSensitivity: 0.5,
                smoothing: 0.3
            };
            
            // プレビュー用Graphics
            this.previewGraphics = null;
        }
        
        /**
         * 初期化
         */
        init() {
            if (this.coordinateSystem) {
                console.warn('BrushCore: Already initialized');
                return; // 二重初期化防止
            }
            
            // グローバル依存の取得
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
            this.curveInterpolator = window.CurveInterpolator;
            this.strokeRecorder = window.strokeRecorder;
            this.layerManager = window.layerManager;
            this.strokeRenderer = window.strokeRenderer;
            this.eventBus = window.eventBus || window.TegakiEventBus;
            
            // 必須依存チェック（明確なエラーメッセージ）
            if (!this.coordinateSystem) {
                throw new Error('BrushCore: window.CoordinateSystem not initialized - check coordinate-system.js');
            }
            if (!this.layerManager) {
                throw new Error('BrushCore: window.layerManager not initialized - check CoreEngine initialization order');
            }
            if (!this.strokeRecorder) {
                throw new Error('BrushCore: window.strokeRecorder not initialized - check CoreEngine.initialize() StrokeRecorder instantiation');
            }
            if (!this.strokeRenderer) {
                throw new Error('BrushCore: window.strokeRenderer not initialized - check CoreEngine.initialize() StrokeRenderer instantiation');
            }
            
            // 任意依存の警告
            if (!this.pressureHandler) {
                console.warn('BrushCore: window.pressureHandler not found - pressure sensitivity disabled');
            }
            if (!this.curveInterpolator) {
                console.warn('BrushCore: window.CurveInterpolator not found - curve interpolation disabled');
            }
            
            console.log('✅ BrushCore initialized (Phase 2)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - PressureHandler:', !!this.pressureHandler);
            console.log('   - CurveInterpolator:', !!this.curveInterpolator);
        }
        
        /**
         * モード切替
         * @param {'pen'|'eraser'} mode 
         */
        setMode(mode) {
            if (mode !== 'pen' && mode !== 'eraser') {
                throw new Error(`Invalid brush mode: ${mode}`);
            }
            
            const oldMode = this.currentMode;
            this.currentMode = mode;
            
            // StrokeRendererにモードを通知
            if (this.strokeRenderer) {
                this.strokeRenderer.setTool(mode);
            }
            
            // イベント発行
            this.eventBus?.emit('brush:mode-switched', {
                component: 'brush',
                action: 'mode-switched',
                data: { mode, oldMode }
            });
        }
        
        /**
         * ブラシ設定更新
         */
        updateSettings(settings) {
            Object.assign(this.brushSettings, settings);
            
            this.eventBus?.emit('brush:settings-updated', {
                component: 'brush',
                action: 'settings-updated',
                data: { settings: { ...this.brushSettings } }
            });
        }
        
        /**
         * ストローク開始
         * @param {number} clientX - PointerEvent.clientX
         * @param {number} clientY - PointerEvent.clientY
         * @param {number} pressure - 筆圧 (0.0-1.0)
         */
        startStroke(clientX, clientY, pressure) {
            if (this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            // 座標変換パイプライン: Screen → Canvas → World → Local
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(
                worldX, 
                worldY, 
                activeLayer.container
            );
            
            // 筆圧処理（既に補正済みの値として受け取る想定）
            const processedPressure = pressure;
            
            // ストローク記録開始（Local座標のみを渡す）
            this.strokeRecorder.startStroke(localX, localY, processedPressure);
            
            this.isDrawing = true;
            this.lastLocalX = localX;
            this.lastLocalY = localY;
            this.lastPressure = processedPressure;
            
            // プレビューGraphics初期化
            this.previewGraphics = new PIXI.Graphics();
            this.previewGraphics.label = 'strokePreview';
            activeLayer.container.addChild(this.previewGraphics);
            
            // 初回点を描画
            this.strokeRenderer.renderPreview(
                [{ x: localX, y: localY, pressure: processedPressure }],
                this.brushSettings,
                this.previewGraphics
            );
            
            // イベント発行
            this.eventBus?.emit('drawing:stroke-started', {
                component: 'drawing',
                action: 'stroke-started',
                data: {
                    mode: this.currentMode,
                    layerId: activeLayer.id,
                    localX,
                    localY,
                    pressure: processedPressure
                }
            });
        }
        
        /**
         * ストローク更新
         * @param {number} clientX 
         * @param {number} clientY 
         * @param {number} pressure 
         */
        updateStroke(clientX, clientY, pressure) {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // 座標変換
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            const { localX, localY } = this.coordinateSystem.worldToLocal(
                worldX, 
                worldY, 
                activeLayer.container
            );
            
            // 筆圧処理
            const processedPressure = pressure;
            
            // 補間処理（curve-interpolatorがあれば使用）
            if (this.curveInterpolator) {
                const interpolatedPoints = this.curveInterpolator.interpolate(
                    this.lastLocalX,
                    this.lastLocalY,
                    localX,
                    localY,
                    this.lastPressure,
                    processedPressure
                );
                
                // 補間点を全て記録
                interpolatedPoints.forEach(pt => {
                    this.strokeRecorder.addPoint(pt.x, pt.y, pt.pressure);
                });
            } else {
                // 補間なし、直接記録
                this.strokeRecorder.addPoint(localX, localY, processedPressure);
            }
            
            // プレビュー更新
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
        
        /**
         * ストローク確定
         */
        finalizeStroke() {
            if (!this.isDrawing) return;
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer) return;
            
            // ストローク記録終了
            const strokeData = this.strokeRecorder.endStroke();
            
            // プレビューGraphicsを削除
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            // 確定描画（stroke-renderer.jsに委譲）
            const pathData = this.strokeRenderer.renderStroke(
                activeLayer.container,
                strokeData,
                this.brushSettings
            );
            
            if (pathData && pathData.graphics) {
                // レイヤーに追加
                activeLayer.container.addChild(pathData.graphics);
                
                // pathsDataに記録
                if (!activeLayer.pathsData) {
                    activeLayer.pathsData = [];
                }
                activeLayer.pathsData.push(pathData);
                
                // 履歴に登録
                if (window.historyManager) {
                    window.historyManager.recordAction({
                        type: 'stroke',
                        layerId: activeLayer.id,
                        pathData: pathData
                    });
                }
            }
            
            this.isDrawing = false;
            
            // イベント発行
            this.eventBus?.emit('drawing:stroke-completed', {
                component: 'drawing',
                action: 'stroke-completed',
                data: {
                    mode: this.currentMode,
                    layerId: activeLayer.id,
                    pointCount: strokeData.points.length
                }
            });
        }
        
        /**
         * ストロークキャンセル
         */
        cancelStroke() {
            if (!this.isDrawing) return;
            
            // プレビューGraphicsを削除
            if (this.previewGraphics && this.previewGraphics.parent) {
                this.previewGraphics.parent.removeChild(this.previewGraphics);
                this.previewGraphics.destroy();
                this.previewGraphics = null;
            }
            
            this.isDrawing = false;
            
            // イベント発行
            this.eventBus?.emit('drawing:stroke-cancelled', {
                component: 'drawing',
                action: 'stroke-cancelled',
                data: {}
            });
        }
        
        /**
         * 描画中かどうか
         */
        isActive() {
            return this.isDrawing;
        }
        
        /**
         * 現在のモードを取得
         */
        getMode() {
            return this.currentMode;
        }
    }
    
    // グローバル登録
    window.BrushCore = new BrushCore();
    
    console.log('✅ system/drawing/brush-core.js loaded (Phase 2)');

})();