/**
 * ============================================================
 * stroke-renderer.js - Phase A-1.1: bounds保存修正版
 * ============================================================
 * 【親依存】
 *   - PixiJS v8.14
 *   - gl-stroke-processor.js Phase B-4
 *   - gl-msdf-pipeline.js Phase B-4.5
 *   - webgl2-drawing-layer.js Phase 3.6
 *   - brush-settings.js
 *   - settings-manager.js
 *   - config.js Phase 7.5
 * 
 * 【子依存】
 *   - brush-core.js
 *   - layer-transform.js
 * 
 * 【Phase A-1.1改修内容】
 * ✅ bounds保存修正（左上フリッカー解消）
 * ✅ _renderWithPolygon() → Sprite/Graphics に bounds 保存
 * ✅ renderStroke() → 返り値に bounds 追加
 * ✅ Phase A-1全機能継承
 * ============================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = 1;
            this.currentTool = 'pen';
            
            this.glStrokeProcessor = null;
            this.glMSDFPipeline = null;
            this.textureBridge = null;
            this.webgl2Enabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
            this.settingsManager = window.TegakiSettingsManager;
            
            this.currentStroke = null;
            this.lastProcessedIndex = 0;
            this.incrementalThreshold = 5;
        }

        async setWebGLLayer(webgl2Layer) {
            this.glStrokeProcessor = window.WebGLContext?.glStrokeProcessor;
            
            if (!this.glStrokeProcessor) {
                console.warn('[StrokeRenderer] GLStrokeProcessor not available');
                return false;
            }
            
            if (!this.glStrokeProcessor.initialized) {
                console.warn('[StrokeRenderer] GLStrokeProcessor not initialized');
                return false;
            }
            
            if (window.GLMSDFPipeline && this.config.msdf?.enabled !== false) {
                this.glMSDFPipeline = window.GLMSDFPipeline;
                
                if (!this.glMSDFPipeline.initialized) {
                    const gl = window.WebGL2DrawingLayer?.gl;
                    if (gl) {
                        await this.glMSDFPipeline.initialize(gl);
                    }
                }
            }
            
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
            }
            
            this.webgl2Enabled = true;
            
            return true;
        }

        _getSettings(providedSettings = null) {
            if (providedSettings) {
                return providedSettings;
            }
            
            if (window.brushSettings) {
                return window.brushSettings.getSettings();
            }
            
            return {
                size: 3,
                opacity: 1.0,
                color: 0x800000,
                mode: 'pen'
            };
        }

        _getCurrentMode(settings) {
            return settings?.mode || this.currentTool || 'pen';
        }

        _getFlowSettings() {
            let flowOpacity = 1.0;
            let flowSensitivity = 1.0;
            let flowAccumulation = false;
            let flowPressureMode = 'auto';
            let highSpeedCompensation = true;
            let minOpacityGuarantee = 0.9;
            let speedThreshold = 2.0;
            
            if (this.settingsManager && typeof this.settingsManager.get === 'function') {
                const settings = this.settingsManager.get();
                flowOpacity = settings.flowOpacity !== undefined ? settings.flowOpacity : 1.0;
                flowSensitivity = settings.flowSensitivity !== undefined ? settings.flowSensitivity : 1.0;
                flowAccumulation = settings.flowAccumulation !== undefined ? settings.flowAccumulation : false;
                flowPressureMode = settings.flowPressureMode !== undefined ? settings.flowPressureMode : 'auto';
            }
            else if (window.TEGAKI_CONFIG?.brush?.flow) {
                const flow = window.TEGAKI_CONFIG.brush.flow;
                flowOpacity = flow.opacity !== undefined ? flow.opacity : 1.0;
                flowSensitivity = flow.sensitivity !== undefined ? flow.sensitivity : 1.0;
                flowAccumulation = flow.accumulation !== undefined ? flow.accumulation : false;
                flowPressureMode = flow.pressureMode !== undefined ? flow.pressureMode : 'auto';
                highSpeedCompensation = flow.highSpeedCompensation !== undefined ? flow.highSpeedCompensation : true;
                minOpacityGuarantee = flow.minOpacityGuarantee !== undefined ? flow.minOpacityGuarantee : 0.9;
                speedThreshold = flow.speedThreshold !== undefined ? flow.speedThreshold : 2.0;
            }
            
            return {
                opacity: flowOpacity,
                sensitivity: flowSensitivity,
                accumulation: flowAccumulation,
                pressureMode: flowPressureMode,
                highSpeedCompensation: highSpeedCompensation,
                minOpacityGuarantee: minOpacityGuarantee,
                speedThreshold: speedThreshold
            };
        }

        _detectInputDevice(points) {
            if (!points || points.length === 0) return 'mouse';
            
            let minPressure = 1.0;
            let maxPressure = 0.0;
            
            for (const p of points) {
                const pressure = p.pressure !== undefined ? p.pressure : 0.5;
                minPressure = Math.min(minPressure, pressure);
                maxPressure = Math.max(maxPressure, pressure);
            }
            
            const variation = maxPressure - minPressure;
            return variation > 0.1 ? 'pen' : 'mouse';
        }

        _calculateAverageSpeed(points) {
            if (!points || points.length < 2) return 0;
            
            let totalSpeed = 0;
            let count = 0;
            
            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                
                const x1 = p1.localX !== undefined ? p1.localX : (p1.x || 0);
                const y1 = p1.localY !== undefined ? p1.localY : (p1.y || 0);
                const x2 = p2.localX !== undefined ? p2.localX : (p2.x || 0);
                const y2 = p2.localY !== undefined ? p2.localY : (p2.y || 0);
                
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const timeDelta = (p2.time !== undefined && p1.time !== undefined) 
                    ? (p2.time - p1.time) 
                    : 1;
                
                if (timeDelta > 0) {
                    totalSpeed += dist / timeDelta;
                    count++;
                }
            }
            
            return count > 0 ? totalSpeed / count : 0;
        }

        _calculateFlowOpacity(baseOpacity, points) {
            const flow = this._getFlowSettings();
            const flowOpacity = flow.opacity;
            
            let usePressure = false;
            if (flow.pressureMode === 'pen') {
                usePressure = true;
            } else if (flow.pressureMode === 'ignore') {
                usePressure = false;
            } else {
                const device = this._detectInputDevice(points);
                usePressure = (device === 'pen');
            }
            
            let pressureFactor = 1.0;
            
            if (usePressure && points && points.length > 0) {
                let maxPressure = 0.0;
                for (const p of points) {
                    const pressure = p.pressure !== undefined ? p.pressure : 0.5;
                    maxPressure = Math.max(maxPressure, pressure);
                }
                
                const pressureAdjusted = Math.pow(maxPressure, 1.0 / flow.sensitivity);
                pressureFactor = pressureAdjusted;
            }
            
            let finalOpacity = baseOpacity * flowOpacity * pressureFactor;
            
            if (flow.highSpeedCompensation && points && points.length >= 2) {
                const avgSpeed = this._calculateAverageSpeed(points);
                const isHighSpeed = avgSpeed > flow.speedThreshold;
                
                if (isHighSpeed) {
                    finalOpacity = Math.max(finalOpacity, flow.minOpacityGuarantee * baseOpacity);
                }
            }
            
            return Math.max(0.0, Math.min(1.0, finalOpacity));
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const validPressure = Math.max(0.0, Math.min(1.0, pressure || 0.5));
            return brushSize * validPressure;
        }

        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);

            if (points.length === 0) {
                return graphics;
            }

            if (this.webgl2Enabled && this.glStrokeProcessor && mode !== 'eraser') {
                const newPointsCount = points.length - this.lastProcessedIndex;
                
                if (newPointsCount >= this.incrementalThreshold) {
                    this._renderIncrementalSegment(points, settings, graphics);
                    this.lastProcessedIndex = points.length;
                    return graphics;
                }
            }

            graphics.clear();
            graphics.blendMode = 'normal';

            if (points.length === 1) {
                const p = points[0];
                const x = p.localX !== undefined ? p.localX : p.x;
                const y = p.localY !== undefined ? p.localY : p.y;
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(x, y, width / 2);
                
                if (mode === 'eraser') {
                    graphics.fill({ color: 0xFFFFFF, alpha: 0.5 });
                } else {
                    const flowOpacity = this._calculateFlowOpacity(settings.opacity || 1.0, points);
                    graphics.fill({ color: settings.color, alpha: flowOpacity });
                }
                return graphics;
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const x1 = p1.localX !== undefined ? p1.localX : p1.x;
                const y1 = p1.localY !== undefined ? p1.localY : p1.y;
                const x2 = p2.localX !== undefined ? p2.localX : p2.x;
                const y2 = p2.localY !== undefined ? p2.localY : p2.y;
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(x1, y1);
                graphics.lineTo(x2, y2);
                
                if (mode === 'eraser') {
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 0.5,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    const flowOpacity = this._calculateFlowOpacity(settings.opacity || 1.0, points);
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: flowOpacity,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        _renderIncrementalSegment(points, settings, graphics) {
            const segmentStart = Math.max(0, this.lastProcessedIndex - 2);
            const segmentPoints = points.slice(segmentStart);

            if (segmentPoints.length < 2) return;

            const formattedPoints = segmentPoints.map(p => ({
                x: p.localX !== undefined ? p.localX : (p.x || 0),
                y: p.localY !== undefined ? p.localY : (p.y || 0),
                pressure: p.pressure !== undefined ? p.pressure : 0.5
            }));

            try {
                const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                    formattedPoints,
                    settings.size
                );
                
                if (!vertexBuffer || !vertexBuffer.buffer || vertexBuffer.vertexCount === 0) {
                    return;
                }

                const vertices = new Float32Array(vertexBuffer.buffer);
                const stride = vertexBuffer.stride || 3;
                const baseOpacity = settings.opacity || 1.0;
                const finalOpacity = this._calculateFlowOpacity(baseOpacity, formattedPoints);

                graphics.context.fillStyle = {
                    color: settings.color,
                    alpha: finalOpacity
                };

                for (let i = 0; i < vertices.length; i += stride * 3) {
                    if (i + stride * 2 + (stride - 1) >= vertices.length) break;

                    const x1 = vertices[i];
                    const y1 = vertices[i + 1];
                    const x2 = vertices[i + stride];
                    const y2 = vertices[i + stride + 1];
                    const x3 = vertices[i + stride * 2];
                    const y3 = vertices[i + stride * 2 + 1];

                    graphics.poly([x1, y1, x2, y2, x3, y3]);
                }

                graphics.fill({
                    color: settings.color,
                    alpha: finalOpacity
                });

            } catch (error) {
                console.warn('[StrokeRenderer] Incremental rendering failed:', error);
            }
        }

        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            if (this.currentStroke && this.webgl2Enabled && mode !== 'eraser') {
                const graphics = this.currentStroke;
                
                const flow = this._getFlowSettings();
                if (flow.accumulation) {
                    graphics.blendMode = 'add';
                } else {
                    graphics.blendMode = 'normal';
                }

                graphics.visible = true;
                graphics.renderable = true;

                const formattedPoints = strokeData.points.map(p => ({
                    x: p.localX !== undefined ? p.localX : (p.x || 0),
                    y: p.localY !== undefined ? p.localY : (p.y || 0),
                    pressure: p.pressure !== undefined ? p.pressure : 0.5
                }));

                graphics.userData = {
                    strokePoints: formattedPoints,
                    settings: { ...settings },
                    flowSettings: { ...flow },
                    createdAt: Date.now(),
                    renderType: 'incremental-vector'
                };

                this.currentStroke = null;
                this.lastProcessedIndex = 0;

                return graphics;
            }
            
            if (mode === 'eraser') {
                return this._renderEraserStroke(strokeData, settings);
            }
            
            if (this.webgl2Enabled && this.glStrokeProcessor) {
                try {
                    const result = await this._renderWithPolygon(strokeData, settings);
                    if (result) {
                        return result;
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] Polygon rendering failed:', error);
                }
            }
            
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        startStroke(settings) {
            if (this.webgl2Enabled) {
                this.currentStroke = new PIXI.Graphics();
                this.currentStroke.label = `stroke_incremental_${Date.now()}`;
                this.lastProcessedIndex = 0;
            }
        }

        cancelStroke() {
            if (this.currentStroke) {
                this.currentStroke.destroy();
                this.currentStroke = null;
            }
            this.lastProcessedIndex = 0;
        }

        /**
         * Phase B-5: 傾き対応版
         */
        async _renderWithPolygon(strokeData, settings) {
            const points = strokeData.points;
            
            if (!points || points.length < 2) {
                return null;
            }

            const formattedPoints = points.map(p => ({
                x: p.localX !== undefined ? p.localX : (p.x || 0),
                y: p.localY !== undefined ? p.localY : (p.y || 0),
                pressure: p.pressure !== undefined ? p.pressure : 0.5,
                tiltX: p.tiltX !== undefined ? p.tiltX : 0,
                tiltY: p.tiltY !== undefined ? p.tiltY : 0,
                twist: p.twist !== undefined ? p.twist : 0,
                time: p.time
            }));

            // Phase B-5: 傾きベース幅調整（オプション）
            let adjustedSize = settings.size;
            if (settings.tilt && settings.tilt.affectsWidth && formattedPoints.length > 0) {
                // 最初のポイントの傾きで代表サイズを計算
                adjustedSize = this._calculateTiltWidth(formattedPoints[0], settings.size, settings);
            }

            const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                formattedPoints,
                adjustedSize
            );
            
            if (!vertexBuffer || !vertexBuffer.buffer || vertexBuffer.vertexCount === 0) {
                return null;
            }

            // Phase A-1.1: bounds保存
            const bounds = vertexBuffer.bounds;

            const baseOpacity = settings.opacity || 1.0;
            const finalOpacity = this._calculateFlowOpacity(baseOpacity, formattedPoints);

            const msdfEnabled = this.config.msdf?.enabled !== false;
            
            if (msdfEnabled && this.glMSDFPipeline && this.glMSDFPipeline.initialized) {
                try {
                    const msdfResult = await this.glMSDFPipeline.generateMSDF(
                        null,
                        bounds,
                        null,
                        {
                            color: this._colorToHex(settings.color),
                            opacity: finalOpacity
                        },
                        vertexBuffer.buffer,
                        vertexBuffer.vertexCount,
                        0
                    );

                    if (msdfResult && msdfResult.texture) {
                        const gl = window.WebGL2DrawingLayer?.gl;
                        if (!gl) {
                            console.warn('[StrokeRenderer] WebGL2 context not available');
                            return this._renderWithGraphicsFallback(vertexBuffer, settings, formattedPoints, finalOpacity, bounds);
                        }

                        const baseTexture = PIXI.BaseTexture.from(msdfResult.texture);
                        const texture = new PIXI.Texture(baseTexture);
                        const sprite = new PIXI.Sprite(texture);

                        sprite.position.set(bounds.minX, bounds.minY);
                        sprite.width = bounds.maxX - bounds.minX;
                        sprite.height = bounds.maxY - bounds.minY;

                        const flow = this._getFlowSettings();
                        if (flow.accumulation) {
                            sprite.blendMode = 'add';
                        } else {
                            sprite.blendMode = 'normal';
                        }

                        sprite.visible = true;
                        sprite.renderable = true;
                        sprite.label = `stroke_msdf_${Date.now()}`;

                        sprite.userData = {
                            strokePoints: formattedPoints,
                            settings: { ...settings },
                            flowSettings: { ...flow },
                            bounds: { ...bounds },
                            createdAt: Date.now(),
                            renderType: 'msdf-sprite'
                        };

                        return { graphics: sprite, bounds: bounds };
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] MSDF generation failed, fallback to Graphics:', error);
                }
            }

            return this._renderWithGraphicsFallback(vertexBuffer, settings, formattedPoints, finalOpacity, bounds);
        }

        /**
         * Phase A-1.1: bounds保存対応
         */
        _renderWithGraphicsFallback(vertexBuffer, settings, formattedPoints, finalOpacity, bounds) {
            const vertices = new Float32Array(vertexBuffer.buffer);
            
            if (vertices.length < 9) {
                return null;
            }

            const graphics = new PIXI.Graphics();
            graphics.label = `stroke_vector_${Date.now()}`;

            graphics.context.fillStyle = {
                color: settings.color,
                alpha: finalOpacity
            };

            const stride = vertexBuffer.stride || 3;

            for (let i = 0; i < vertices.length; i += stride * 3) {
                if (i + stride * 2 + (stride - 1) >= vertices.length) break;

                const x1 = vertices[i];
                const y1 = vertices[i + 1];
                const x2 = vertices[i + stride];
                const y2 = vertices[i + stride + 1];
                const x3 = vertices[i + stride * 2];
                const y3 = vertices[i + stride * 2 + 1];

                graphics.poly([x1, y1, x2, y2, x3, y3]);
            }

            graphics.fill({
                color: settings.color,
                alpha: finalOpacity
            });

            const flow = this._getFlowSettings();
            if (flow.accumulation) {
                graphics.blendMode = 'add';
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.visible = true;
            graphics.renderable = true;

            graphics.userData = {
                strokePoints: formattedPoints,
                settings: { ...settings },
                flowSettings: { ...flow },
                bounds: { ...bounds },
                createdAt: Date.now(),
                renderType: 'vector-graphics'
            };

            return { graphics: graphics, bounds: bounds };
        }

        /**
         * Phase B-5: 傾きベース幅変調
         * @param {Object} point - {tiltX, tiltY, pressure}
         * @param {number} baseWidth - 基本幅
         * @param {Object} settings - {tiltSensitivity, tiltAffectsWidth}
         * @returns {number} 調整後の幅
         */
        _calculateTiltWidth(point, baseWidth, settings) {
            // 傾き設定がない場合はそのまま返す
            const tiltSettings = settings.tilt || {};
            
            if (!tiltSettings.affectsWidth) {
                return baseWidth;
            }
            
            const tiltX = point.tiltX !== undefined ? point.tiltX : 0;
            const tiltY = point.tiltY !== undefined ? point.tiltY : 0;
            
            // 傾き角度を計算（0〜1の範囲）
            const tiltMagnitude = Math.sqrt(tiltX * tiltX + tiltY * tiltY);
            
            // 感度適用（デフォルト: 0.5）
            const sensitivity = tiltSettings.sensitivity !== undefined ? tiltSettings.sensitivity : 0.5;
            
            // 幅変調範囲（デフォルト: 0.5〜1.5）
            const widthMin = tiltSettings.widthMin !== undefined ? tiltSettings.widthMin : 0.5;
            const widthMax = tiltSettings.widthMax !== undefined ? tiltSettings.widthMax : 1.5;
            
            // 傾きに基づく幅の倍率を計算
            const widthModulation = 1.0 + (tiltMagnitude * sensitivity * (widthMax - 1.0));
            const finalModulation = Math.max(widthMin, Math.min(widthMax, widthModulation));
            
            return baseWidth * finalModulation;
        }

        _colorToHex(color) {
            if (typeof color === 'string' && color.startsWith('#')) {
                return color;
            }
            
            const hex = color.toString(16).padStart(6, '0');
            return `#${hex}`;
        }

        regenerateMesh(graphics, scaleFactor = 1.0) {
            if (!graphics || !graphics.userData || !graphics.userData.strokePoints) {
                console.warn('[StrokeRenderer] Cannot regenerate: missing userData');
                return null;
            }

            const { strokePoints, settings } = graphics.userData;
            
            const newSettings = {
                ...settings,
                size: settings.size * scaleFactor
            };

            const result = this._renderWithPolygon(
                { points: strokePoints },
                newSettings
            );

            if (result && result.graphics) {
                console.log('[StrokeRenderer] ✅ Graphics regenerated with scale:', scaleFactor);
                return result.graphics;
            }

            return null;
        }

        _renderEraserStroke(strokeData, settings) {
            const graphics = new PIXI.Graphics();
            graphics.blendMode = 'erase';
            
            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const p = strokeData.points[0];
                const x = p.localX !== undefined ? p.localX : p.x;
                const y = p.localY !== undefined ? p.localY : p.y;
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(x, y, width / 2);
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                
                const bounds = {
                    minX: x - width / 2,
                    minY: y - width / 2,
                    maxX: x + width / 2,
                    maxY: y + width / 2,
                    width: width,
                    height: width
                };
                
                return { graphics: graphics, bounds: bounds };
            }

            const points = strokeData.points;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const x1 = p1.localX !== undefined ? p1.localX : p1.x;
                const y1 = p1.localY !== undefined ? p1.localY : p1.y;
                const x2 = p2.localX !== undefined ? p2.localX : p2.x;
                const y2 = p2.localY !== undefined ? p2.localY : p2.y;
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(x1, y1);
                graphics.lineTo(x2, y2);
                graphics.stroke({
                    width: avgWidth,
                    color: 0xFFFFFF,
                    alpha: 1.0,
                    cap: 'round',
                    join: 'round'
                });
            }

            const calculatedBounds = this.glStrokeProcessor?.calculateBounds(points);
            
            return { graphics: graphics, bounds: calculatedBounds || null };
        }

        _renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            graphics.blendMode = 'normal';

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const result = this.renderDot(strokeData.points[0], settings, mode, graphics);
                return result;
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return { graphics: graphics, bounds: null };
            }

            const flowOpacity = this._calculateFlowOpacity(settings.opacity || 1.0, points);

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const x1 = p1.localX !== undefined ? p1.localX : p1.x;
                const y1 = p1.localY !== undefined ? p1.localY : p1.y;
                const x2 = p2.localX !== undefined ? p2.localX : p2.x;
                const y2 = p2.localY !== undefined ? p2.localY : p2.y;
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(x1, y1);
                graphics.lineTo(x2, y2);
                graphics.stroke({
                    width: avgWidth,
                    color: settings.color,
                    alpha: flowOpacity,
                    cap: 'round',
                    join: 'round'
                });
            }

            const calculatedBounds = this.glStrokeProcessor?.calculateBounds(points);

            return { graphics: graphics, bounds: calculatedBounds || null };
        }

        renderDot(point, providedSettings = null, mode = 'pen', targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const x = point.localX !== undefined ? point.localX : point.x;
            const y = point.localY !== undefined ? point.localY : point.y;
            const width = this.calculateWidth(point.pressure, settings.size);

            const flowOpacity = this._calculateFlowOpacity(settings.opacity || 1.0, [point]);

            graphics.blendMode = 'normal';
            graphics.circle(x, y, width / 2);
            graphics.fill({ color: settings.color, alpha: flowOpacity });

            const bounds = {
                minX: x - width / 2,
                minY: y - width / 2,
                maxX: x + width / 2,
                maxY: y + width / 2,
                width: width,
                height: width
            };

            return { graphics: graphics, bounds: bounds };
        }

        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            let result;
            if (mode === 'eraser') {
                result = this._renderEraserStroke(strokeData, settings);
            } else {
                result = this._renderFinalStrokeLegacy(strokeData, settings, mode);
            }
            
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: result.graphics,
                points: strokeData.points,
                tool: mode,
                settings: { ...settings },
                bounds: result.bounds
            };
        }

        updateResolution() {
            this.resolution = 1;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js Phase B-5 loaded (傾きベース幅変調版)');
    console.log('   ✅ _calculateTiltWidth() メソッド追加');
    console.log('   ✅ 傾きベース幅変調実装');
    console.log('   ✅ Phase A-1.1全機能継承');

})();