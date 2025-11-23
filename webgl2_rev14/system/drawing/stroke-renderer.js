/**
 * ============================================================
 * stroke-renderer.js - Phase 4.0C: インクリメンタルレンダリング版
 * ============================================================
 * 【親依存】
 *   - PixiJS v8.14
 *   - gl-stroke-processor.js Phase 4.0B Optimized
 *   - brush-settings.js (window.brushSettings)
 *   - settings-manager.js (flow設定取得)
 *   - config.js
 * 
 * 【子依存】
 *   - brush-core.js
 *   - layer-transform.js
 * 
 * 【Phase 4.0C改修内容】
 * ✅ リアルタイムポリゴン追加（変形なし）
 * ✅ インクリメンタルレンダリング実装
 * ✅ ストローク終了時の変形排除
 * ✅ 筆圧グラデーション保持
 * ✅ 重なり部分の欠け防止
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
            
            // WebGL2統合
            this.glStrokeProcessor = null;
            this.glMSDFPipeline = null;
            this.textureBridge = null;
            this.webgl2Enabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
            this.settingsManager = window.TegakiSettingsManager;
            
            // Phase 4.0C: インクリメンタルレンダリング用
            this.currentStroke = null;
            this.lastProcessedIndex = 0;
            this.incrementalThreshold = 5; // 5ポイントごとに更新
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
            }
            
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
            }
            
            this.webgl2Enabled = true;
            console.log('[StrokeRenderer] ✅ WebGL2 pipeline connected (Phase 4.0C)');
            
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
            
            if (this.settingsManager && typeof this.settingsManager.get === 'function') {
                const settings = this.settingsManager.get();
                flowOpacity = settings.flowOpacity !== undefined ? settings.flowOpacity : 1.0;
                flowSensitivity = settings.flowSensitivity !== undefined ? settings.flowSensitivity : 1.0;
                flowAccumulation = settings.flowAccumulation !== undefined ? settings.flowAccumulation : false;
            }
            else if (window.TEGAKI_CONFIG?.brush?.flow) {
                const flow = window.TEGAKI_CONFIG.brush.flow;
                flowOpacity = flow.opacity !== undefined ? flow.opacity : 1.0;
                flowSensitivity = flow.sensitivity !== undefined ? flow.sensitivity : 1.0;
                flowAccumulation = flow.accumulation !== undefined ? flow.accumulation : false;
            }
            
            return {
                opacity: flowOpacity,
                sensitivity: flowSensitivity,
                accumulation: flowAccumulation
            };
        }

        _calculateAveragePressure(points) {
            if (!points || points.length === 0) return 0.5;
            
            let sum = 0;
            let count = 0;
            
            for (const p of points) {
                const pressure = p.pressure !== undefined ? p.pressure : 0.5;
                sum += pressure;
                count++;
            }
            
            return count > 0 ? sum / count : 0.5;
        }

        _calculateFlowOpacity(baseOpacity, points) {
            const flow = this._getFlowSettings();
            const flowOpacity = flow.opacity;
            const avgPressure = this._calculateAveragePressure(points);
            const pressureAdjusted = Math.pow(avgPressure, 1.0 / flow.sensitivity);
            const finalOpacity = baseOpacity * flowOpacity * pressureAdjusted;
            return Math.max(0.0, Math.min(1.0, finalOpacity));
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const validPressure = Math.max(0.0, Math.min(1.0, pressure || 0.5));
            return brushSize * validPressure;
        }

        /**
         * Phase 4.0C: インクリメンタルプレビュー
         * ストローク中にリアルタイムでポリゴン追加
         */
        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);

            if (points.length === 0) {
                return graphics;
            }

            // Phase 4.0C: WebGL2有効時はインクリメンタルレンダリング
            if (this.webgl2Enabled && this.glStrokeProcessor && mode !== 'eraser') {
                const newPointsCount = points.length - this.lastProcessedIndex;
                
                // 閾値に達したら追加レンダリング
                if (newPointsCount >= this.incrementalThreshold) {
                    this._renderIncrementalSegment(points, settings, graphics);
                    this.lastProcessedIndex = points.length;
                    return graphics;
                }
            }

            // Legacy描画（消しゴム・WebGL2無効時）
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

        /**
         * Phase 4.0C: インクリメンタルセグメント描画
         * 新しいポイントのみをポリゴン化して追加
         */
        _renderIncrementalSegment(points, settings, graphics) {
            // 最後のN個のポイントのみ処理
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
                const stride = vertexBuffer.hasPressure ? 3 : 2;
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

        /**
         * Phase 4.0C: 最終ストローク描画
         * ストローク終了時は変形しない（既にレンダリング済み）
         */
        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            // Phase 4.0C: インクリメンタルレンダリング済みの場合
            if (this.currentStroke && this.webgl2Enabled && mode !== 'eraser') {
                const graphics = this.currentStroke;
                
                // 蓄積モード設定
                const flow = this._getFlowSettings();
                if (flow.accumulation) {
                    graphics.blendMode = 'add';
                } else {
                    graphics.blendMode = 'normal';
                }

                graphics.visible = true;
                graphics.renderable = true;

                // メタデータ保存
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

                // リセット
                this.currentStroke = null;
                this.lastProcessedIndex = 0;

                return graphics;
            }
            
            // 消しゴム
            if (mode === 'eraser') {
                return this._renderEraserStroke(strokeData, settings);
            }
            
            // フォールバック: 一括レンダリング
            if (this.webgl2Enabled && this.glStrokeProcessor) {
                try {
                    const graphics = this._renderWithPolygon(strokeData, settings);
                    if (graphics) {
                        return graphics;
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] Polygon rendering failed:', error);
                }
            }
            
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        /**
         * Phase 4.0C: ストローク開始
         */
        startStroke(settings) {
            if (this.webgl2Enabled) {
                this.currentStroke = new PIXI.Graphics();
                this.currentStroke.label = `stroke_incremental_${Date.now()}`;
                this.lastProcessedIndex = 0;
            }
        }

        /**
         * Phase 4.0C: ストロークキャンセル
         */
        cancelStroke() {
            if (this.currentStroke) {
                this.currentStroke.destroy();
                this.currentStroke = null;
            }
            this.lastProcessedIndex = 0;
        }

        _renderWithPolygon(strokeData, settings) {
            const points = strokeData.points;
            
            if (!points || points.length < 2) {
                return null;
            }

            const formattedPoints = points.map(p => ({
                x: p.localX !== undefined ? p.localX : (p.x || 0),
                y: p.localY !== undefined ? p.localY : (p.y || 0),
                pressure: p.pressure !== undefined ? p.pressure : 0.5
            }));

            const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                formattedPoints,
                settings.size
            );
            
            if (!vertexBuffer || !vertexBuffer.buffer || vertexBuffer.vertexCount === 0) {
                return null;
            }

            const vertices = new Float32Array(vertexBuffer.buffer);
            
            if (vertices.length < 9) {
                return null;
            }

            const graphics = new PIXI.Graphics();
            graphics.label = `stroke_vector_${Date.now()}`;

            const baseOpacity = settings.opacity || 1.0;
            const finalOpacity = this._calculateFlowOpacity(baseOpacity, formattedPoints);

            graphics.context.fillStyle = {
                color: settings.color,
                alpha: finalOpacity
            };

            const stride = vertexBuffer.hasPressure ? 3 : 2;

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
                createdAt: Date.now(),
                renderType: 'vector-graphics'
            };

            return graphics;
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

            const newGraphics = this._renderWithPolygon(
                { points: strokePoints },
                newSettings
            );

            if (newGraphics) {
                console.log('[StrokeRenderer] ✅ Graphics regenerated with scale:', scaleFactor);
            }

            return newGraphics;
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
                return graphics;
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

            return graphics;
        }

        _renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            graphics.blendMode = 'normal';

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, mode, graphics);
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return graphics;
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

            return graphics;
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

            return graphics;
        }

        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            let graphics;
            if (mode === 'eraser') {
                graphics = this._renderEraserStroke(strokeData, settings);
            } else {
                graphics = this._renderFinalStrokeLegacy(strokeData, settings, mode);
            }
            
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: strokeData.points,
                tool: mode,
                settings: { ...settings }
            };
        }

        updateResolution() {
            this.resolution = 1;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js Phase 4.0C loaded');
    console.log('   ✅ インクリメンタルレンダリング実装');
    console.log('   ✅ ストローク後の変形排除');
    console.log('   ✅ 筆圧グラデーション保持');

})();