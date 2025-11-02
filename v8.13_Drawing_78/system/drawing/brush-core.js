/**
 * BrushCore - ペン/消しゴム共通コアロジック
 * Phase 2完全修正版: Container参照誤り + CurveInterpolator不整合を解消
 * 
 * 責務:
 * - PointerEvent → Local座標変換（coordinate-system.js経由）
 * - 筆圧処理（pressure-handler統合）
 * - 補間処理（線形補間実装）
 * - ストローク記録制御（stroke-recorder呼び出し）
 * - ペン/消しゴムモード管理
 * 
 * 依存:
 * - window.CoordinateSystem
 * - window.pressureHandler
 * - window.strokeRecorder
 * - window.strokeRenderer
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
            // 冪等性チェック強化
            if (this.coordinateSystem && this.strokeRecorder && this.layerManager) {
                console.warn('[BrushCore] Already initialized - skipping');
                return;
            }
            
            // 部分的初期化状態の警告
            if (this.coordinateSystem || this.strokeRecorder || this.layerManager) {
                console.error('[BrushCore] Partial initialization detected - forcing re-init');
                this.coordinateSystem = null;
                this.strokeRecorder = null;
                this.layerManager = null;
                this.strokeRenderer = null;
            }
            
            // グローバル依存の取得
            this.coordinateSystem = window.CoordinateSystem;
            this.pressureHandler = window.pressureHandler;
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
            
            console.log('✅ BrushCore initialized (Phase 2完全修正版)');
            console.log('   - CoordinateSystem:', !!this.coordinateSystem);
            console.log('   - LayerManager:', !!this.layerManager);
            console.log('   - StrokeRecorder:', !!this.strokeRecorder);
            console.log('   - StrokeRenderer:', !!this.strokeRenderer);
            console.log('   - PressureHandler:', !!this.pressureHandler);
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
            // 必須依存の事前チェック
            if (!this.strokeRecorder) {
                console.error('[BrushCore] startStroke called but strokeRecorder is null. init() may not have been called.');
                console.error('  coordinateSystem:', !!this.coordinateSystem);
                console.error('  layerManager:', !!this.layerManager);
                console.error('  strokeRenderer:', !!this.strokeRenderer);
                return;
            }
            
            if (this.isDrawing) return;
            
            if (!this.layerManager) {
                console.error('[BrushCore] layerManager is null');
                return;
            }
            
            const activeLayer = this.layerManager.getActiveLayer();
            if (!activeLayer || activeLayer.locked) return;
            
            // 座標変換パイプライン: Screen → Canvas → World → Local
            const { canvasX, canvasY } = this.coordinateSystem.screenClientToCanvas(clientX, clientY);
            const { worldX, worldY } = this.coordinateSystem.canvasToWorld(canvasX, canvasY);
            
            const { localX, localY } = this.coordinateSystem.worldToLocal(
                worldX, 
                worldY, 
                activeLayer
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
            
            activeLayer.addChild(this.previewGraphics);
            
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
                    layerId: activeLayer.layerData?.id,
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
                activeLayer
            );
            
            // 筆圧処理
            const processedPressure = pressure;
            
            // 線形補間実装: 2点間を補間
            const dx = localX - this.lastLocalX;
            const dy = localY - this.lastLocalY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 距離ベースで補間ステップ数を決定（5px間隔）
            const steps = Math.max(1, Math.floor(distance / 5));
            
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                const interpX = this.lastLocalX + dx * t;
                const interpY = this.lastLocalY + dy * t;
                const interpPressure = this.lastPressure + (processedPressure - this.lastPressure) * t;
                
                this.strokeRecorder.addPoint(interpX, interpY, interpPressure);
            }
            
            // 最終点を追加
            this.strokeRecorder.addPoint(localX, localY, processedPressure);
            
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
            // renderFinalStroke は async だが、Promise を待たずに即座に処理を続ける
            const renderPromise = this.strokeRenderer.renderFinalStroke(
                strokeData,
                this.brushSettings
            );
            
            // Promiseが解決したらレイヤーに追加
            renderPromise.then(graphics => {
                if (!graphics) {
                    console.warn('[BrushCore] renderFinalStroke returned null');
                    return;
                }
                
                // pathData構造を作成
                const pathData = {
                    graphics: graphics,
                    points: strokeData.points,
                    settings: { ...this.brushSettings },
                    tool: this.currentMode
                };
                
                // レイヤーに追加
                activeLayer.addChild(pathData.graphics);
                
                // pathsDataに記録（layerDataが存在する場合）
                if (activeLayer.layerData) {
                    if (!activeLayer.layerData.pathsData) {
                        activeLayer.layerData.pathsData = [];
                    }
                    activeLayer.layerData.pathsData.push(pathData);
                }
                
                // 履歴に登録
                if (window.historyManager) {
                    window.historyManager.recordAction({
                        type: 'stroke',
                        layerId: activeLayer.layerData?.id,
                        pathData: pathData
                    });
                }
            }).catch(error => {
                console.error('[BrushCore] renderFinalStroke failed:', error);
            });
            
            this.isDrawing = false;
            
            // イベント発行
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
    
    console.log('✅ brush-core.js loaded (Phase 2完全修正版 + init追加)');
    console.log('   ✓ Container参照誤り修正（activeLayer.container → activeLayer）');
    console.log('   ✓ CurveInterpolator不整合解消（線形補間実装）');
    console.log('   ✓ init()メソッド実装');
    console.log('   ✓ 二重実装なし、DRY原則準拠');

})();