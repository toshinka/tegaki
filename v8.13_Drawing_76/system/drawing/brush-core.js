// ===== system/drawing/brush-core.js - デバッグ版 =====
// BrushCore - ペン/消しゴム統合処理（デバッグログ追加）

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
            
            console.log('🔧 [BrushCore] Initializing...');
            
            if (window.StrokeRecorder && window.PressureHandler) {
                const pressureHandler = new window.PressureHandler();
                this.strokeRecorder = new window.StrokeRecorder(pressureHandler, this.cameraSystem);
                console.log('✅ [BrushCore] StrokeRecorder initialized');
            } else {
                console.error('❌ [BrushCore] StrokeRecorder or PressureHandler not available');
            }
            
            if (window.StrokeRenderer) {
                this.strokeRenderer = new window.StrokeRenderer(this.app, this.layerSystem, this.cameraSystem);
                console.log('✅ [BrushCore] StrokeRenderer initialized');
            } else {
                console.error('❌ [BrushCore] StrokeRenderer not available');
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
            console.log('🔧 [BrushCore] setTool:', tool);
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
            console.log('🎨 [BrushCore] startStroke:', {
                localX, localY, pressure, pointerId,
                isDrawing: this.isDrawing
            });

            if (this.isDrawing) {
                console.warn('⚠️ [BrushCore] Already drawing, ignoring');
                return;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('❌ [BrushCore] No active layer');
                return;
            }
            if (activeLayer.layerData.isBackground) {
                console.warn('⚠️ [BrushCore] Cannot draw on background layer');
                return;
            }
            if (isNaN(localX) || isNaN(localY)) {
                console.error('❌ [BrushCore] Invalid coordinates');
                return;
            }

            this.isDrawing = true;
            this.currentPointerId = pointerId;

            const settings = this._getCurrentSettings();
            console.log('  Settings:', settings);
            
            this.currentStroke = {
                ...settings,
                tool: this.currentTool
            };

            this._initPreviewContainer(activeLayer);

            if (this.strokeRecorder) {
                this.strokeRecorder.startStroke(localX, localY, pressure);
                console.log('✅ [BrushCore] StrokeRecorder started');
            } else {
                console.error('❌ [BrushCore] No strokeRecorder');
            }
        }

        _initPreviewContainer(layer) {
            this._clearPreview();
            this.previewGraphics = new PIXI.Graphics();
            layer.addChild(this.previewGraphics);
            this.previewContainer = layer;
            console.log('✅ [BrushCore] Preview container initialized');
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
         * ストローク終了（デバッグ版）
         */
        async endStroke(pointerId) {
            console.log('🎨 [BrushCore] endStroke:', {
                pointerId,
                isDrawing: this.isDrawing,
                currentPointerId: this.currentPointerId
            });

            if (!this.isDrawing) {
                console.warn('⚠️ [BrushCore] Not drawing, ignoring endStroke');
                return;
            }
            if (pointerId !== undefined && pointerId !== this.currentPointerId) {
                console.warn('⚠️ [BrushCore] PointerId mismatch, ignoring endStroke');
                return;
            }

            const activeLayer = this.layerSystem.getActiveLayer();
            if (!activeLayer || !activeLayer.layerData) {
                console.error('❌ [BrushCore] No active layer in endStroke');
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            if (!this.strokeRecorder) {
                console.error('❌ [BrushCore] No strokeRecorder in endStroke');
                this._clearPreview();
                this.isDrawing = false;
                return;
            }

            console.log('  Calling strokeRecorder.endStroke...');
            const strokeData = this.strokeRecorder.endStroke();
            console.log('  strokeData:', {
                pointCount: strokeData?.points?.length || 0,
                isSingleDot: strokeData?.isSingleDot
            });
            
            if (strokeData && strokeData.points && strokeData.points.length > 0) {
                console.log('  Calling _renderStroke...');
                await this._renderStroke(activeLayer, strokeData);
                console.log('✅ [BrushCore] _renderStroke completed');
            } else {
                console.warn('⚠️ [BrushCore] No points to render');
            }

            this._clearPreview();
            this.isDrawing = false;
            this.currentPointerId = null;
            this.currentStroke = null;
            console.log('✅ [BrushCore] endStroke completed');
        }

        cancelStroke(pointerId) {
            console.log('🎨 [BrushCore] cancelStroke');
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
         * ストローク描画（デバッグ版）
         */
        async _renderStroke(layer, strokeData) {
            console.log('🖌️ [BrushCore] _renderStroke:', {
                layerId: layer.layerData.id,
                pointCount: strokeData.points.length,
                tool: this.currentTool
            });

            if (!this.strokeRenderer || !this.currentStroke) {
                console.error('❌ [BrushCore] No strokeRenderer or currentStroke');
                return;
            }

            const settings = {
                color: this.currentStroke.color,
                size: this.currentStroke.size,
                alpha: this.currentStroke.opacity
            };
            console.log('  Render settings:', settings);

            // WebGPU/Legacy自動選択（非同期）
            console.log('  Calling strokeRenderer.renderFinalStroke...');
            const strokeGraphics = await this.strokeRenderer.renderFinalStroke(
                strokeData,
                settings,
                null
            );
            console.log('  strokeGraphics:', strokeGraphics);

            if (!strokeGraphics) {
                console.error('❌ [BrushCore] renderFinalStroke returned null');
                return;
            }

            console.log('  Adding graphics to layer...');
            layer.addChild(strokeGraphics);
            console.log('✅ [BrushCore] Graphics added to layer');

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
            
            console.log('✅ [BrushCore] _renderStroke fully completed');
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

    console.log('✅ brush-core.js (デバッグ版) loaded');
    console.log('   ✓ Detailed logging enabled');
})();