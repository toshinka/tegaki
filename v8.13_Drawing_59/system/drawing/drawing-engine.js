// ===== drawing-engine.js - プレビュー累積描画修正版 =====
// PixiJS v8対応: プレビューGraphicsを累積描画に変更

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, historyManager) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.historyManager = historyManager;
        this.eventBus = window.TegakiEventBus;
        
        // 描画状態
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;
        this.currentStrokeStartTime = 0;
        
        // サブシステム初期化
        this.pressureHandler = new PressureHandler();
        
        // PressureHandlerに getPressure メソッドを追加（互換性対応）
        if (!this.pressureHandler.getPressure) {
            this.pressureHandler.getPressure = function(rawPressure) {
                if (this.getCalibratedPressure) {
                    return this.getCalibratedPressure(rawPressure);
                }
                return rawPressure || 0.5;
            };
        }
        
        this.curveInterpolator = new CurveInterpolator();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = null;
        this.eraserRenderer = null;
        this.brushSettings = null;
        
        // プレビュー用Graphics（累積描画用）
        this.previewGraphics = null;
        this.eraserPreviewGraphics = null;
        
        // 現在のストローク用プレビューGraphics
        this.currentStrokeGraphics = null;
        
        this.initializeRenderers();
    }
    
    initializeRenderers() {
        // ストロークレンダラー初期化
        if (window.StrokeRenderer) {
            this.strokeRenderer = new window.StrokeRenderer(
                this.app,
                this.layerSystem,
                this.cameraSystem
            );
        }
        
        // 消しゴムレンダラー初期化
        if (window.EraserMaskRenderer) {
            this.eraserRenderer = new window.EraserMaskRenderer(
                this.app,
                this.layerSystem
            );
        }
        
        // プレビューGraphics初期化
        if (!this.previewGraphics && this.cameraSystem?.worldContainer) {
            this.previewGraphics = new PIXI.Graphics();
            this.cameraSystem.worldContainer.addChild(this.previewGraphics);
        }
        
        if (!this.eraserPreviewGraphics && this.cameraSystem?.worldContainer) {
            this.eraserPreviewGraphics = new PIXI.Graphics();
            this.cameraSystem.worldContainer.addChild(this.eraserPreviewGraphics);
        }
    }
    
    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
    }
    
    setTool(toolName) {
        this.currentTool = toolName;
        
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
        
        if (toolName !== 'eraser') {
            this.clearEraserPreview();
        }
        
        // ツール切替通知
        if (this.eventBus) {
            this.eventBus.emit('tool:changed', { 
                component: 'drawing',
                action: 'tool-changed',
                data: { tool: toolName }
            });
            
            // 消しゴムツール切替時のサムネイル更新
            if (toolName === 'eraser') {
                const activeLayer = this.layerSystem?.getActiveLayer?.();
                if (activeLayer) {
                    const layerIndex = this.layerSystem?.getLayerIndex?.(activeLayer);
                    
                    this.eventBus.emit('thumbnail:layer-updated', {
                        component: 'drawing',
                        action: 'tool-switched',
                        data: {
                            layerIndex: layerIndex,
                            layerId: activeLayer.layerData?.id,
                            tool: toolName
                        }
                    });
                }
            }
        }
    }
    
    getCurrentSettings() {
        if (this.brushSettings) {
            return this.brushSettings.getCurrentSettings();
        }
        
        // デフォルト設定
        return {
            size: 5,
            opacity: 1.0,
            color: 0x000000,
            smoothing: 0.5
        };
    }
    
    startDrawing(x, y, nativeEvent) {
        if (this.layerSystem?.isLayerMoveMode) return;
        
        const activeLayer = this.layerSystem?.getActiveLayer?.();
        if (!activeLayer || activeLayer.layerData?.isBackground) return;
        
        this.isDrawing = true;
        this.currentLayer = activeLayer;
        this.currentSettings = this.getCurrentSettings();
        this.lastProcessedPointIndex = 0;
        this.currentStrokeStartTime = performance.now();
        
        // 現在のストローク用Graphicsを新規作成
        this.currentStrokeGraphics = new PIXI.Graphics();
        this.currentLayer.addChild(this.currentStrokeGraphics);
        
        // 座標変換: clientX/Y → localX/Y
        const { localX, localY } = this.getLocalCoordinates(nativeEvent, activeLayer);
        
        // 筆圧取得
        const rawPressure = nativeEvent.pressure || 0.5;
        let pressure = rawPressure;
        
        if (this.pressureHandler && typeof this.pressureHandler.getPressure === 'function') {
            pressure = this.pressureHandler.getPressure(rawPressure);
        } else if (this.pressureHandler && typeof this.pressureHandler.getCalibratedPressure === 'function') {
            pressure = this.pressureHandler.getCalibratedPressure(rawPressure);
        }
        
        // tiltデータ更新
        if (this.pressureHandler && typeof this.pressureHandler.updateTiltData === 'function') {
            this.pressureHandler.updateTiltData(nativeEvent);
        }
        
        // ストローク記録開始
        if (this.strokeRecorder && typeof this.strokeRecorder.startStroke === 'function') {
            this.strokeRecorder.startStroke(localX, localY, rawPressure);
        }
        
        // イベント発火
        if (this.eventBus) {
            this.eventBus.emit('stroke:started', {
                component: 'drawing',
                action: 'stroke-started',
                data: {
                    tool: this.currentTool,
                    layerId: activeLayer.layerData?.id,
                    x: localX,
                    y: localY,
                    pressure: pressure
                }
            });
        }
    }
    
    continueDrawing(x, y, nativeEvent) {
        if (!this.isDrawing || !this.currentLayer || !this.currentStrokeGraphics) return;
        
        // 座標変換
        const { localX, localY } = this.getLocalCoordinates(nativeEvent, this.currentLayer);
        
        // 筆圧取得
        const rawPressure = nativeEvent.pressure || 0.5;
        let pressure = rawPressure;
        
        if (this.pressureHandler && typeof this.pressureHandler.getPressure === 'function') {
            pressure = this.pressureHandler.getPressure(rawPressure);
        } else if (this.pressureHandler && typeof this.pressureHandler.getCalibratedPressure === 'function') {
            pressure = this.pressureHandler.getCalibratedPressure(rawPressure);
        }
        
        // tiltデータ更新
        if (this.pressureHandler && typeof this.pressureHandler.updateTiltData === 'function') {
            this.pressureHandler.updateTiltData(nativeEvent);
        }
        
        // ストローク記録
        if (this.strokeRecorder && typeof this.strokeRecorder.addPoint === 'function') {
            this.strokeRecorder.addPoint(localX, localY, rawPressure);
        }
        
        // リアルタイムプレビュー更新（累積描画）
        if (this.strokeRecorder && typeof this.strokeRecorder.getCurrentPoints === 'function') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            const newPoints = currentPoints.slice(this.lastProcessedPointIndex);
            
            if (newPoints.length > 0 && this.strokeRenderer && typeof this.strokeRenderer.renderPreview === 'function') {
                // 既存のGraphicsに累積描画（重要！）
                this.strokeRenderer.renderPreview(newPoints, this.currentSettings, this.currentStrokeGraphics);
                
                this.lastProcessedPointIndex = currentPoints.length;
            }
        }
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;

        // ストローク記録終了
        let strokeData = { points: [], isSingleDot: false };
        if (this.strokeRecorder && typeof this.strokeRecorder.endStroke === 'function') {
            strokeData = this.strokeRecorder.endStroke();
        }
        
        // 一時プレビューGraphicsをクリア
        if (this.currentStrokeGraphics) {
            this.currentStrokeGraphics.destroy();
            this.currentStrokeGraphics = null;
        }
        
        this.clearPreview();
        this.clearEraserPreview();
        
        const tool = this.currentTool;
        const currentLayer = this.currentLayer;
        const layerIndex = this.layerSystem?.getLayerIndex?.(this.currentLayer);

        // ストローク処理
        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            // 消しゴム処理
            const layerData = this.currentLayer.layerData;
            
            if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask()) {
                const radius = this.currentSettings?.size || 5;
                
                if (this.eraserRenderer && typeof this.eraserRenderer.applyEraserStroke === 'function') {
                    this.eraserRenderer.applyEraserStroke(
                        this.currentLayer,
                        strokeData.points,
                        radius,
                        this.currentSettings?.opacity || 1.0
                    );
                }
            }
        } else if (tool === 'pen' && this.currentLayer && strokeData.points.length > 0) {
            // ペン処理
            if (this.strokeRenderer && typeof this.strokeRenderer.renderStroke === 'function') {
                const pathData = this.strokeRenderer.renderStroke(
                    this.currentLayer,
                    strokeData,
                    this.currentSettings
                );
                
                if (pathData && this.layerSystem && typeof this.layerSystem.addPathToActiveLayer === 'function') {
                    this.layerSystem.addPathToActiveLayer(pathData);
                }
            }
        }

        // 状態リセット
        this.isDrawing = false;
        const finalizingLayer = this.currentLayer;
        const finalizingLayerId = finalizingLayer?.layerData?.id;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        // イベント統一
        if (finalizingLayer && strokeData.points.length > 0 && this.eventBus) {
            this.eventBus.emit('stroke:finalized', {
                component: 'drawing',
                action: 'stroke-finalized',
                data: {
                    tool: tool,
                    pointCount: strokeData.points.length,
                    layerId: finalizingLayerId,
                    layerIndex: layerIndex
                }
            });
            
            // サムネイル更新トリガー
            this.eventBus.emit('thumbnail:layer-updated', {
                component: 'drawing',
                action: 'stroke-finalized',
                data: {
                    layerIndex: layerIndex,
                    layerId: finalizingLayerId,
                    tool: tool,
                    pointCount: strokeData.points.length
                }
            });
        }
    }
    
    getLocalCoordinates(nativeEvent, layer) {
        if (!window.CoordinateSystem) {
            // フォールバック: 簡易座標変換
            const rect = this.app.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const canvasX = (nativeEvent.clientX - rect.left) * dpr;
            const canvasY = (nativeEvent.clientY - rect.top) * dpr;
            return { localX: canvasX, localY: canvasY };
        }
        
        const { canvasX, canvasY } = window.CoordinateSystem.screenClientToCanvas(
            nativeEvent.clientX,
            nativeEvent.clientY
        );
        
        const { worldX, worldY } = window.CoordinateSystem.canvasToWorld(
            canvasX,
            canvasY
        );
        
        const { localX, localY } = window.CoordinateSystem.worldToLocal(
            worldX,
            worldY,
            layer
        );
        
        return { localX, localY };
    }
    
    clearPreview() {
        if (this.previewGraphics) {
            this.previewGraphics.clear();
        }
    }
    
    clearEraserPreview() {
        if (this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics.clear();
        }
    }
    
    updatePreview(nativeEvent) {
        const activeLayer = this.layerSystem?.getActiveLayer?.();
        if (!activeLayer) return;
        
        const { localX, localY } = this.getLocalCoordinates(nativeEvent, activeLayer);
        const settings = this.getCurrentSettings();
        
        if (this.currentTool === 'pen') {
            this.updatePenPreview(localX, localY, settings);
        } else if (this.currentTool === 'eraser') {
            this.updateEraserPreview(localX, localY, settings);
        }
    }
    
    updatePenPreview(localX, localY, settings) {
        if (!this.previewGraphics) return;
        
        this.previewGraphics.clear();
        this.previewGraphics.circle(localX, localY, settings.size / 2);
        this.previewGraphics.fill({
            color: settings.color,
            alpha: settings.opacity * 0.3
        });
    }
    
    updateEraserPreview(localX, localY, settings) {
        if (!this.eraserPreviewGraphics) return;
        
        this.eraserPreviewGraphics.clear();
        this.eraserPreviewGraphics.circle(localX, localY, settings.size / 2);
        this.eraserPreviewGraphics.stroke({
            color: 0xFF0000,
            width: 2,
            alpha: 0.5
        });
    }
    
    destroy() {
        this.clearPreview();
        this.clearEraserPreview();
        
        if (this.previewGraphics) {
            this.previewGraphics.destroy();
        }
        if (this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics.destroy();
        }
        if (this.currentStrokeGraphics) {
            this.currentStrokeGraphics.destroy();
        }
    }
}

// グローバル登録
window.DrawingEngine = DrawingEngine;
console.log('✅ drawing-engine.js (プレビュー累積描画修正版) loaded');