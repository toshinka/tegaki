// ============================================================================
// system/drawing/drawing-engine.js - Phase 2 完全実装版
// ============================================================================

class DrawingEngine {
        constructor(app, layerSystem, cameraSystem, history) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.history = history;
            this.eventBus = window.TegakiEventBus;
            this.config = window.TEGAKI_CONFIG;
            
            this.pressureHandler = new window.TegakiPressureHandler();
            this.strokeRecorder = new window.TegakiStrokeRecorder(this.pressureHandler, cameraSystem);
            this.strokeRenderer = new window.TegakiStrokeRenderer(app);
            this.eraserRenderer = new window.EraserMaskRenderer(app);
            this.strokeTransformer = window.TegakiStrokeTransformer ? new window.TegakiStrokeTransformer() : null;
            
            this.isDrawing = false;
            this.currentLayer = null;
            this.currentTool = 'pen';
            this.currentSettings = {
                size: 16,
                color: 0x000000,
                opacity: 1.0,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5
            };
            
            this.previewGraphics = null;
            this.eraserPreviewGraphics = null;
            this.lastPreviewTime = 0;
            this.previewThrottleMs = 16;
            this.eraserSnapshotCache = new Map();
            
            this._setupToolEvents();
            this._setupSettingsEvents();
        }

        _setupToolEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('tool:select', ({ tool }) => {
                this.currentTool = tool;
                if (this.strokeRenderer) {
                    this.strokeRenderer.setTool(tool);
                }
            });
            
            this.eventBus.on('layer:activated', ({ layerIndex }) => {
                const layers = this.layerSystem.getLayers();
                this.currentLayer = layers[layerIndex] || null;
            });
        }

        _setupSettingsEvents() {
            if (!this.eventBus) return;
            
            this.eventBus.on('brush:size-changed', ({ size }) => {
                this.currentSettings.size = size;
            });
            
            this.eventBus.on('brush:color-changed', ({ color }) => {
                this.currentSettings.color = color;
            });
            
            this.eventBus.on('brush:opacity-changed', ({ opacity }) => {
                this.currentSettings.opacity = opacity;
            });
        }

        setBrushSettings(brushSettings) {
            this.brushSettings = brushSettings;
        }

        startDrawing(worldX, worldY, pressure = 1.0) {
            if (this.isDrawing) return;
            
            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer) return;
            
            this.currentLayer = activeLayer;
            this.isDrawing = true;
            
            this.strokeRecorder.startStroke(worldX, worldY, pressure);
            
            if (this.currentTool === 'pen') {
                this.strokeRenderer.startPreview();
            } else if (this.currentTool === 'eraser') {
                this._startEraserPreview();
            }
        }

        continueDrawing(worldX, worldY, pressure = 1.0) {
            if (!this.isDrawing) return;
            
            this.strokeRecorder.addPoint(worldX, worldY, pressure);
            
            const now = Date.now();
            if (now - this.lastPreviewTime < this.previewThrottleMs) return;
            this.lastPreviewTime = now;
            
            if (this.currentTool === 'pen') {
                this.updatePreview();
            } else if (this.currentTool === 'eraser') {
                const newPoints = this.strokeRecorder.getRecentPoints(2);
                this.updateEraserMaskPreview(newPoints);
            }
        }

        stopDrawing() {
            if (!this.isDrawing) return;
            
            const strokeData = this.strokeRecorder.endStroke();
            this.clearPreview();
            this.clearEraserPreview();
            const tool = this.currentTool;
            
            if (tool === 'eraser' && this.currentLayer && strokeData.points.length > 0) {
                const layerData = this.currentLayer.layerData;
                
                if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask()) {
                    const radius = this.currentSettings.size / 2;
                    
                    const beforeSnapshot = this.eraserRenderer.captureMaskSnapshot(layerData);
                    const success = this.eraserRenderer.renderEraserToMask(layerData, strokeData.points, radius);
                    
                    if (success) {
                        const afterSnapshot = this.eraserRenderer.captureMaskSnapshot(layerData);
                        
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
                                tool: 'eraser',
                                snapshots: { before: beforeSnapshot, after: afterSnapshot }
                            }
                        };
                        
                        if (this.history) {
                            this.history.push(entry);
                        }
                        
                        if (this.eventBus) {
                            this.eventBus.emit('layer:erased', { 
                                layerId: layerData.id,
                                pointCount: strokeData.points.length
                            });
                        }
                        
                        this.layerSystem.requestThumbnailUpdate(this.layerSystem.activeLayerIndex);
                    }
                }
            } else if (tool === 'pen') {
                this.finalizeStroke(strokeData, tool);
            }
            
            this.isDrawing = false;
            this.currentLayer = null;
        }

        updateEraserMaskPreview(newPoints) {
            if (!this.currentLayer || 
                !this.currentLayer.layerData || 
                typeof this.currentLayer.layerData.hasMask !== 'function' || 
                !this.currentLayer.layerData.hasMask()) {
                return;
            }
            
            if (!newPoints || newPoints.length < 2) return;
            
            const layerData = this.currentLayer.layerData;
            const radius = this.currentSettings.size / 2;
            
            const incrementalGraphics = new PIXI.Graphics();
            incrementalGraphics.blendMode = PIXI.BLEND_MODES.ERASE;
            
            for (let i = 0; i < newPoints.length - 1; i++) {
                const p1 = newPoints[i];
                const p2 = newPoints[i + 1];
                incrementalGraphics.moveTo(p1.x, p1.y);
                incrementalGraphics.lineTo(p2.x, p2.y);
            }
            incrementalGraphics.stroke({ width: radius * 2, color: 0x000000 });
            
            this.app.renderer.render({
                container: incrementalGraphics,
                target: layerData.maskTexture,
                clear: false
            });
            
            incrementalGraphics.destroy();
        }

        updatePreview() {
            if (!this.isDrawing || this.currentTool !== 'pen') return;
            
            const points = this.strokeRecorder.getCurrentPoints();
            if (points.length < 2) return;
            
            this.strokeRenderer.updatePreview(points, this.currentSettings);
        }

        clearPreview() {
            if (this.strokeRenderer) {
                this.strokeRenderer.clearPreview();
            }
        }

        _startEraserPreview() {
            if (!this.eraserPreviewGraphics) {
                this.eraserPreviewGraphics = new PIXI.Graphics();
                this.eraserPreviewGraphics.label = 'eraser_preview';
                
                const previewLayer = this.layerSystem.getActiveLayer();
                if (previewLayer) {
                    previewLayer.addChild(this.eraserPreviewGraphics);
                }
            }
        }

        clearEraserPreview() {
            if (this.eraserPreviewGraphics) {
                this.eraserPreviewGraphics.clear();
                
                if (this.eraserPreviewGraphics.parent) {
                    this.eraserPreviewGraphics.parent.removeChild(this.eraserPreviewGraphics);
                }
                
                this.eraserPreviewGraphics.destroy();
                this.eraserPreviewGraphics = null;
            }
        }

        finalizeStroke(strokeData, tool = null) {
            if (!this.currentLayer || strokeData.points.length === 0) return;
            
            const settings = { ...this.currentSettings };
            const strokeObject = this.strokeRenderer.renderFinalStroke(strokeData, settings);
            
            if (!strokeObject) return;
            
            const layerData = this.currentLayer.layerData;
            if (layerData && typeof layerData.hasMask === 'function' && layerData.hasMask() && layerData.maskSprite) {
                strokeObject.mask = layerData.maskSprite;
            }
            
            const layerIndex = this.layerSystem.activeLayerIndex;
            const layer = this.currentLayer;
            
            if (this.history && !window.History._manager?.isApplying) {
                const entry = {
                    name: 'Draw',
                    do: () => {
                        if (!strokeObject.parent) {
                            layer.addChild(strokeObject);
                        }
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                    },
                    undo: () => {
                        if (strokeObject.parent) {
                            strokeObject.parent.removeChild(strokeObject);
                        }
                        this.layerSystem.requestThumbnailUpdate(layerIndex);
                    },
                    meta: { 
                        type: 'draw', 
                        tool: tool || 'pen',
                        layerId: layerData?.id,
                        strokeId: strokeData.id
                    }
                };
                
                this.history.push(entry);
            } else {
                layer.addChild(strokeObject);
            }
            
            this.layerSystem.requestThumbnailUpdate(layerIndex);
            
            if (this.eventBus) {
                this.eventBus.emit('stroke:finalized', {
                    strokeData,
                    layerIndex,
                    tool: tool || 'pen'
                });
            }
        }

        destroy() {
            this.clearPreview();
            this.clearEraserPreview();
            
            if (this.strokeRecorder) {
                this.strokeRecorder = null;
            }
            
            if (this.strokeRenderer) {
                this.strokeRenderer = null;
            }
            
            if (this.eraserRenderer) {
                this.eraserRenderer = null;
            }
            
            if (this.eraserSnapshotCache) {
                for (const [key, snapshot] of this.eraserSnapshotCache) {
                    if (snapshot && snapshot.destroy) {
                        snapshot.destroy(true);
                    }
                }
                this.eraserSnapshotCache.clear();
            }
        }
    }
}

window.TegakiDrawingEngine = DrawingEngine;
console.log('✅ drawing-engine.js (Phase2完全版) loaded');