// ===== system/drawing/brush-core.js - Phase 4-A: WebGPU対応版 =====
// BrushCore - ペン/消しゴム統合処理（WebGPU非同期描画対応）

(function() {
    'use strict';

    class BrushCore {
        constructor(app, layerSystem, cameraSystem, config) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.config = config || window.TEGAKI_CONFIG;

            this.brushSettings = null;
            this.currentTool = 'pen';
            this.isDrawing = false;
            this.currentStroke = null;
            this.currentPointerId = null;
            this.previewGraphics = null;
            this.previewContainer = null;
            this.strokeRecorder = null;
            this.strokeRenderer = null;
            
            if (window.StrokeRecorder && window.PressureHandler) {
                const pressureHandler = new window.PressureHandler();
                this.strokeRecorder = new window.StrokeRecorder(pressureHandler, this.cameraSystem);
            }
            
            if (window.StrokeRenderer) {
                this.strokeRenderer = new window.StrokeRenderer(this.app, this.layerSystem, this.cameraSystem);
            }
            
            this.coordSystem = window.CoordinateSystem;
            this._subscribeToEvents();
        }

        _subscribeToEvents() {
            if (!window.TegakiEventBus) return;

            window.TegakiEventBus.on('brush:size-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.size = data.size;
                    this._updatePreview();
                }
            });

            window.TegakiEventBus.on('brush:color-changed', (data) => {
                if (this.currentStroke && this.currentTool === 'pen') {
                    this.currentStroke.color = data.color;
                    this._updatePreview();
                }
            });

            window.TegakiEventBus.on('brush:opacity-changed', (data) => {
                if (this.currentStroke) {
                    this.currentStroke.opacity = data.opacity;
                    this._updatePreview();
                }
            });
        }

        setBrushSettings(settings) {
            this.brushSettings = settings;
        }

        setTool(tool) {
            if (tool !== 'pen' && tool !== 'eraser') {
                return;
            }
            this.currentTool = tool;
            if (this.strokeRenderer) {
                this.strokeRenderer.setTool(tool);
            }
            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('tool:changed', { tool });
            }
        }

        _getCurrentSettings() {
            let size = 10;
            let color = 0x800000;
            let opacity = 1.0;

            if (this.brushSettings) {
                if (typeof this.brushSettings.size === 'number') {
                    size = this.brushSettings.size;
                } else if (typeof this.brushSettings.getSize === 'function') {
                    size = this.brushSettings.getSize();
                }

                if (this.currentTool === 'pen') {
                    if (typeof this.brushSettings.color === 'number') {
                        color = this.brushSettings.color;
                    } else if (typeof this.brushSettings.getColor === 'function') {
                        color = this.brushSettings.getColor();
                    }
                } else {
                    color = 0x000000;
                }

                if (typeof this.brushSettings.opacity === 'number') {
                    opacity = this.brushSettings.opacity;
                } else if (typeof this.brushSettings.getAlpha === 'function') {
                    opacity = this.brushSettings.getAlpha();
                } else if (typeof this.brushSettings.alpha === 'number') {
                    opacity = this.brushSettings.alpha;
                }
            }

            if (this.config?.brush) {
                size = this.config.brush.defaultSize || size;
                if (this.currentTool === 'pen') {
                    color = this.config.brush.defaultColor || color;
                }
                opacity = this.config.brush.defaultOpacity || opacity;
            }

            return { size, color, opacity };
        }

        startStroke(localX, localY, pressure, pointerId) {
            if (this.isDrawing) return;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) return;
            if (activeLayer.layerData.isBackground) return;
            if (isNaN(localX) || isNaN(localY)) return;

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            const settings = this._getCurrentSettings();
            this.currentStroke = {
                ...settings,
                tool: this.currentTool
            };

            this._initPreviewContainer(activeLayer);

            if (this.strokeRecorder) {
                this.strokeRecorder.startStroke(localX, localY, pressure);
            }
        }

        _initPreviewContainer(layer) {
            this._clearPreview();
            this.previewGraphics = new PIXI.Graphics();
            layer.addChild(this.previewGraphics);
            this.previewContainer = layer;
        }

        addPoint(localX, localY, pressure, pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;
            if (isNaN(localX) || isNaN(localY)) return;

            if (this.strokeRecorder) {
                this.strokeRecorder.addPoint(localX, localY, pressure);
            }

            this._updatePreview();
        }

        _updatePreview() {
            if (!this.previewGraphics || !this.strokeRecorder) return;

            const points = this.strokeRecorder.points || [];
            if (points.length === 0) return;

            this.previewGraphics.clear();

            if (this.strokeRenderer && this.currentStroke) {
                const settings = {
                    color: this.currentStroke.color,
                    size: this.currentStroke.size,
                    alpha: this.currentStroke.opacity
                };

                this.strokeRenderer.renderPreview(
                    points,
                    settings,
                    this.previewGraphics
                );
            }
        }

        _clearPreview() {
            if (this.previewGraphics) {
                if (this.previewContainer && this.previewContainer.children.includes(this.previewGraphics)) {
                    this.previewContainer.removeChild(this.previewGraphics);
                }
                this.previewGraphics.destroy({ children: true });
                this.previewGraphics = null;
            }
            this.previewContainer = null;
        }

        /**
         * ストローク終了（Phase 4-A: 非同期対応）
         */
        async endStroke(pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            if (!this.strokeRecorder) {
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            const strokeData = this.strokeRecorder.endStroke();
            
            if (strokeData && strokeData.points && strokeData.points.length > 0) {
                // 非同期描画（WebGPU対応）
                await this._renderStroke(activeLayer, strokeData);
            }

            this._clearPreview();
            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;
        }

        cancelStroke(pointerId) {
            if (!this.isDrawing) return;
            if (pointerId !== undefined && pointerId !== this.currentPointerId) return;

            if (this.strokeRecorder && this.strokeRecorder.isRecording) {
                this.strokeRecorder.isRecording = false;
                this.strokeRecorder.points = [];
            }

            this._clearPreview();
            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;
        }

        /**
         * ストローク描画（Phase 4-A: 非同期対応）
         */
        async _renderStroke(layer, strokeData) {
            if (!this.strokeRenderer || !this.currentStroke) return;

            const settings = {
                color: this.currentStroke.color,
                size: this.currentStroke.size,
                alpha: this.currentStroke.opacity
            };

            // WebGPU/Legacy自動選択（非同期）
            const strokeGraphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                null
            );

            if (!strokeGraphics) return;

            layer.addChild(strokeGraphics);

            if (!layer.layerData.paths) {
                layer.layerData.paths = [];
            }
            
            layer.layerData.paths.push({
                id: `path_${Date.now()}_${Math.random()}`,
                points: strokeData.points,
                size: this.currentStroke.size,
                color: this.currentStroke.color,
                opacity: this.currentStroke.opacity,
                tool: this.currentTool,
                graphics: strokeGraphics,
                timestamp: Date.now()
            });

            const layerIndex = this.layerSystem.getLayerIndex(layer);
            if (layerIndex >= 0) {
                this.layerSystem.requestThumbnailUpdate(layerIndex);
            }

            if (window.TegakiEventBus) {
                window.TegakiEventBus.emit('layer:stroke-added', {
                    layerIndex,
                    layerId: layer.layerData.id,
                    tool: this.currentTool
                });
            }

            if (window.History && (!window.History._manager || !window.History._manager.isApplying)) {
                this._recordHistory(layer, strokeGraphics);
            }
        }

        _recordHistory(layer, graphics) {
            const layerIndex = this.layerSystem.getLayerIndex(layer);
            
            const command = {
                name: 'draw-stroke',
                do: () => {
                    if (!layer.children.includes(graphics)) {
                        layer.addChild(graphics);
                    }
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                undo: () => {
                    if (layer.children.includes(graphics)) {
                        layer.removeChild(graphics);
                    }
                    if (graphics.destroy) {
                        graphics.destroy({ children: true });
                    }
                    this.layerSystem.requestThumbnailUpdate(layerIndex);
                },
                meta: {
                    type: 'stroke',
                    tool: this.currentTool,
                    layerId: layer.layerData.id,
                    timestamp: Date.now()
                }
            };

            window.History.push(command);
        }

        getTool() {
            return this.currentTool;
        }

        getIsDrawing() {
            return this.isDrawing;
        }
    }

    window.BrushCore = BrushCore;

    console.log('✅ brush-core.js (Phase 4-A: WebGPU非同期対応版) loaded');
})();