/**
 * DrawingEngine - ペン描画統合制御クラス (マスク消しゴム対応完全版)
 * Phase 1: RenderTextureマスクベース消しゴム実装完了
 */

class DrawingEngine {
    constructor(app, layerSystem, cameraSystem, history) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.history = history;
        this.eventBus = window.TegakiEventBus;

        this.pressureHandler = new PressureHandler();
        this.strokeRecorder = new StrokeRecorder(this.pressureHandler, this.cameraSystem);
        this.strokeRenderer = new StrokeRenderer(app);
        this.eraserRenderer = new EraserMaskRenderer(app); // Phase 1追加

        this.brushSettings = null;
        this.isDrawing = false;
        this.currentPreview = null;
        this.currentLayer = null;
        this.currentSettings = null;
        this.currentTool = 'pen';
        
        this.eraserPreviewGraphics = null;
        this.lastProcessedPointIndex = 0;
        
        this._syncBrushSettingsToRuntime();
        this._syncToolSelection();
    }

    setBrushSettings(brushSettings) {
        this.brushSettings = brushSettings;
        this._syncBrushSettingsToRuntime();
    }

    _syncBrushSettingsToRuntime() {
        if (!this.eventBus) return;
        this.eventBus.on('brush:size-changed', ({ size }) => {});
        this.eventBus.on('brush:alpha-changed', ({ alpha }) => {});
        this.eventBus.on('brush:color-changed', ({ color }) => {});
    }

    _syncToolSelection() {
        if (!this.eventBus) return;
        this.eventBus.on('tool:select', ({ tool }) => {
            this.setTool(tool);
        });
    }

    startDrawing(x, y, event) {
        this.currentLayer = this.layerSystem.getActiveLayer();
        if (!this.currentLayer || this.currentLayer.layerData?.locked) {
            return;
        }

        this.currentSettings = this.getBrushSettings();

        if (event && event.pointerType) {
            this.strokeRecorder.startStrokeFromEvent(event);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.startStroke(x, y, pressure);
        }

        this.isDrawing = true;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:start', {
                layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }

        this.updatePreview();
        
        if (this.currentTool === 'eraser') {
            const points = this.strokeRecorder.getCurrentPoints();
            if (points.length > 0) {
                this.updateEraserPreview(points[0]);
            }
        }
    }

    continueDrawing(x, y, event) {
        if (!this.isDrawing) return;

        if (event && event.pointerType) {
            const pressure = event.pressure || 0.5;
            this.strokeRecorder.addPointFromEvent(event, pressure);
        } else {
            const pressure = event?.pressure || 0.5;
            this.strokeRecorder.addPoint(x, y, pressure);
        }

        this.currentSettings = this.getBrushSettings();
        this.updatePreview();

        if (this.currentTool === 'eraser') {
            const currentPoints = this.strokeRecorder.getCurrentPoints();
            
            if (currentPoints.length > 0) {
                this.updateEraserPreview(currentPoints[currentPoints.length - 1]);
            }
        }

        if (this.eventBus) {
            this.eventBus.emit('stroke:point', {
                points: this.strokeRecorder.getCurrentPoints(),
                settings: this.currentSettings,
                tool: this.currentTool
            });
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;

        const strokeData = this.strokeRecorder.endStroke();
        this.clearPreview();
        this.clearEraserPreview();
        const tool = this.currentTool;

        // ===== Phase 1: 消しゴムツール処理 =====
        if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
            const layerData = this.currentLayer.layerData;
            
            if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask()) {
                const radius = this.currentSettings.size / 2;
                
                // before スナップショット取得
                const beforeSnapshot = this.eraserRenderer.captureMaskSnapshot(layerData);
                
                // マスクに消しゴム描画
                const ok = this.eraserRenderer.renderEraserToMask(
                    layerData,
                    strokeData.points,
                    radius
                );
                
                if (ok) {
                    // after スナップショット取得
                    const afterSnapshot = this.eraserRenderer.captureMaskSnapshot(layerData);
                    
                    // History記録
                    const entry = {
                        name: 'Erase',
                        do: async () => {
                            if (afterSnapshot) {
                                await this.eraserRenderer.restoreMaskSnapshot(layerData, afterSnapshot);
                            }
                            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                        },
                        undo: async () => {
                            if (beforeSnapshot) {
                                await this.eraserRenderer.restoreMaskSnapshot(layerData, beforeSnapshot);
                            }
                            this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                        },
                        meta: { 
                            type: 'erase', 
                            layerId: layerData.id, 
                            tool: 'eraser' 
                        }
                    };
                    
                    if (this.history) {
                        this.history.push(entry);
                    }
                    
                    if (this.eventBus) {
                        this.eventBus.emit('layer:erased', { layerId: layerData.id });
                    }
                    
                    this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                }
            }
        } else {
            // ===== ペンツール: 通常の確定描画 =====
            this.finalizeStroke(strokeData, tool);
        }

        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:end', {
                strokeData: strokeData,
                tool: tool
            });
        }
    }

    updatePreview() {
        if (!this.currentLayer) return;
        this.clearPreview();

        const points = this.strokeRecorder.getCurrentPoints();
        if (points.length === 0) return;

        this.currentPreview = this.strokeRenderer.renderPreview(points, this.currentSettings);
        this.currentLayer.addChild(this.currentPreview);
    }

    clearPreview() {
        if (this.currentPreview) {
            this.currentPreview.destroy({ children: true });
            this.currentPreview = null;
        }
    }

    updateEraserPreview(worldPos) {
        if (!this.currentLayer) return;
        
        if (!this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics = new PIXI.Graphics();
            this.currentLayer.addChild(this.eraserPreviewGraphics);
        }
        
        const radius = this.currentSettings.size / 2;
        
        this.eraserPreviewGraphics.clear();
        this.eraserPreviewGraphics.circle(worldPos.x, worldPos.y, radius);
        this.eraserPreviewGraphics.stroke({ width: 1, color: 0xFF0000, alpha: 0.5 });
    }
    
    clearEraserPreview() {
        if (this.eraserPreviewGraphics) {
            this.eraserPreviewGraphics.destroy({ children: true });
            this.eraserPreviewGraphics = null;
        }
    }

    finalizeStroke(strokeData, tool = null) {
        if (!this.currentLayer || strokeData.points.length === 0) {
            return;
        }

        const activeTool = tool || this.currentTool || 'pen';
        const originalTool = this.strokeRenderer.currentTool;
        this.strokeRenderer.setTool(activeTool);

        const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, this.currentSettings);
        this.strokeRenderer.setTool(originalTool);

        // ===== Phase 1: 新規ストロークへのマスク適用 =====
        const layerData = this.currentLayer.layerData;
        if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask() && layerData.maskSprite) {
            strokeObject.mask = layerData.maskSprite;
        }

        strokeObject._strokePoints = strokeData.points;
        strokeObject._strokeOptions = {
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha
        };

        const strokeModel = new window.TegakiDataModels.StrokeData({
            points: strokeData.points,
            isSingleDot: strokeData.isSingleDot,
            color: this.currentSettings.color,
            size: this.currentSettings.size,
            alpha: this.currentSettings.alpha,
            layerId: this.currentLayer.layerData?.id || this.currentLayer.label,
            tool: activeTool
        });

        const targetLayer = this.currentLayer;
        const layerId = targetLayer.layerData?.id || targetLayer.label;

        const addStrokeCommand = {
            name: activeTool === 'eraser' ? 'Erase' : 'Add Stroke',
            do: () => {
                if (targetLayer && targetLayer.addChild) {
                    targetLayer.addChild(strokeObject);
                }
            },
            undo: () => {
                if (targetLayer && targetLayer.removeChild) {
                    targetLayer.removeChild(strokeObject);
                    strokeObject.destroy({ children: true });
                }
            },
            meta: {
                type: activeTool === 'eraser' ? 'erase' : 'stroke',
                layerId: layerId,
                strokeData: strokeModel
            }
        };

        if (this.history && this.history.push) {
            this.history.push(addStrokeCommand);
        }

        if (this.eventBus) {
            this.eventBus.emit('layer:modified', {
                layerId: layerId,
                tool: activeTool
            });
        }
    }

    getBrushSettings() {
        if (this.brushSettings) {
            return this.brushSettings.getCurrentSettings();
        }

        if (window.brushSettings) {
            return {
                color: window.brushSettings.getColor(),
                size: window.brushSettings.getSize(),
                alpha: window.brushSettings.getAlpha ? window.brushSettings.getAlpha() : 1.0
            };
        }

        if (window.TegakiSettingsManager) {
            return {
                color: window.TegakiSettingsManager.get('pen.color') || 0x800000,
                size: window.TegakiSettingsManager.get('pen.size') || 3,
                alpha: window.TegakiSettingsManager.get('pen.opacity') || 1.0
            };
        }

        return {
            color: 0x800000,
            size: 3,
            alpha: 1.0
        };
    }

    setTool(toolName) {
        this.currentTool = toolName;
        if (this.strokeRenderer) {
            this.strokeRenderer.setTool(toolName);
        }
        
        if (toolName !== 'eraser') {
            this.clearEraserPreview();
        }
    }

    cancelStroke() {
        if (!this.isDrawing) return;

        this.clearPreview();
        this.clearEraserPreview();
        this.isDrawing = false;
        this.currentLayer = null;
        this.currentSettings = null;
        this.lastProcessedPointIndex = 0;

        if (this.eventBus) {
            this.eventBus.emit('stroke:cancel');
        }
    }

    updateResolution() {
        this.strokeRenderer.updateResolution();
    }

    destroy() {
        this.clearPreview();
        this.clearEraserPreview();
    }
}