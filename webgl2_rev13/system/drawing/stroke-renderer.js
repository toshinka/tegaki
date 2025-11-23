/**
 * ============================================================
 * stroke-renderer.js - Phase 4: 流量統合版
 * ============================================================
 * 【親依存】
 *   - PixiJS v8.14
 *   - gl-stroke-processor.js (GLStrokeProcessor)
 *   - brush-settings.js (window.brushSettings)
 *   - settings-manager.js (flow設定取得)
 *   - config.js
 * 
 * 【子依存】
 *   - brush-core.js
 *   - layer-transform.js
 * 
 * 【Phase 4改修内容】
 * ✅ 流量（フロー）反映実装
 * ✅ 流量感度による筆圧連動透明度
 * ✅ 蓄積モード（加算合成）対応
 * ✅ Phase 3機能完全継承
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
            console.log('[StrokeRenderer] ✅ WebGL2 pipeline connected');
            
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

        /**
         * Phase 4: 流量設定取得
         * @returns {Object} {opacity, sensitivity, accumulation}
         */
        _getFlowSettings() {
            let flowOpacity = 1.0;
            let flowSensitivity = 1.0;
            let flowAccumulation = false;
            
            // SettingsManagerから取得
            if (this.settingsManager && typeof this.settingsManager.get === 'function') {
                const settings = this.settingsManager.get();
                flowOpacity = settings.flowOpacity !== undefined ? settings.flowOpacity : 1.0;
                flowSensitivity = settings.flowSensitivity !== undefined ? settings.flowSensitivity : 1.0;
                flowAccumulation = settings.flowAccumulation !== undefined ? settings.flowAccumulation : false;
            }
            // configから取得（フォールバック）
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

        /**
         * Phase 4: 平均筆圧計算
         * @param {Array} points - ストロークポイント配列
         * @returns {number} 平均筆圧（0.0～1.0）
         */
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

        /**
         * Phase 4: 流量による最終透明度計算
         * @param {number} baseOpacity - ブラシ基本透明度
         * @param {Array} points - ストロークポイント配列
         * @returns {number} 最終透明度（0.0～1.0）
         */
        _calculateFlowOpacity(baseOpacity, points) {
            const flow = this._getFlowSettings();
            
            // 流量透明度
            const flowOpacity = flow.opacity;
            
            // 平均筆圧
            const avgPressure = this._calculateAveragePressure(points);
            
            // 流量感度による筆圧調整
            // sensitivity = 1.0: 標準（筆圧そのまま）
            // sensitivity > 1.0: 軽い筆圧で濃くなる
            // sensitivity < 1.0: 強い筆圧が必要
            const pressureAdjusted = Math.pow(avgPressure, 1.0 / flow.sensitivity);
            
            // 最終透明度 = 基本透明度 × 流量透明度 × 筆圧調整値
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

        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);

            if (points.length === 0) {
                return graphics;
            }

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
                    // Phase 4: プレビューも流量反映
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
                    // Phase 4: プレビューも流量反映
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

        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            if (mode === 'eraser') {
                return this._renderEraserStroke(strokeData, settings);
            }
            
            // WebGL2 独自リボン生成使用
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
            
            // Legacy fallback
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        /**
         * Phase 4: 独自ポリゴン生成 + 流量反映版
         * 
         * 🎯 目的:
         * - ユーザーが描いた線をそのままベクター化
         * - 流量による透明度調整
         * - 蓄積モード対応
         */
        _renderWithPolygon(strokeData, settings) {
            const points = strokeData.points;
            
            if (!points || points.length < 2) {
                return null;
            }

            // 座標フォーマット
            const formattedPoints = points.map(p => ({
                x: p.localX !== undefined ? p.localX : (p.x || 0),
                y: p.localY !== undefined ? p.localY : (p.y || 0),
                pressure: p.pressure !== undefined ? p.pressure : 0.5
            }));

            // 独自リボン生成でポリゴン生成
            const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                formattedPoints,
                settings.size
            );
            
            if (!vertexBuffer || !vertexBuffer.buffer || vertexBuffer.vertexCount === 0) {
                return null;
            }

            const graphics = new PIXI.Graphics();
            graphics.label = `stroke_vector_${Date.now()}`;

            // Float32Arrayから頂点座標を取得
            const vertices = new Float32Array(vertexBuffer.buffer);
            
            if (vertices.length < 6) {
                return null;
            }

            // Phase 4: 流量による最終透明度計算
            const baseOpacity = settings.opacity || 1.0;
            const finalOpacity = this._calculateFlowOpacity(baseOpacity, formattedPoints);

            // 三角形ごとに個別に描画
            graphics.context.fillStyle = {
                color: settings.color,
                alpha: finalOpacity
            };

            for (let i = 0; i < vertices.length; i += 6) {
                if (i + 5 >= vertices.length) break;

                const x1 = vertices[i];
                const y1 = vertices[i + 1];
                const x2 = vertices[i + 2];
                const y2 = vertices[i + 3];
                const x3 = vertices[i + 4];
                const y3 = vertices[i + 5];

                graphics.poly([x1, y1, x2, y2, x3, y3]);
            }

            graphics.fill({
                color: settings.color,
                alpha: finalOpacity
            });

            // Phase 4: 蓄積モード（加算合成）
            const flow = this._getFlowSettings();
            if (flow.accumulation) {
                graphics.blendMode = 'add';
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.visible = true;
            graphics.renderable = true;

            // メタデータ保存（Phase 3で使用）
            graphics.userData = {
                strokePoints: formattedPoints,
                settings: { ...settings },
                flowSettings: { ...flow },
                createdAt: Date.now(),
                renderType: 'vector-graphics'
            };

            return graphics;
        }

        /**
         * Phase 3: レイヤー変形時のメッシュ再生成
         * @param {PIXI.Graphics} graphics - 再生成対象のグラフィックス
         * @param {number} scaleFactor - スケール係数（デフォルト: 1.0）
         * @returns {PIXI.Graphics|null}
         */
        regenerateMesh(graphics, scaleFactor = 1.0) {
            if (!graphics || !graphics.userData || !graphics.userData.strokePoints) {
                console.warn('[StrokeRenderer] Cannot regenerate: missing userData');
                return null;
            }

            const { strokePoints, settings } = graphics.userData;
            
            // スケール係数を反映した新設定
            const newSettings = {
                ...settings,
                size: settings.size * scaleFactor
            };

            // 新しいメッシュを生成
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

            // Phase 4: Legacy描画も流量反映
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

            // Phase 4: ドット描画も流量反映
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

    console.log('✅ stroke-renderer.js Phase 4 loaded (流量統合版)');

})();