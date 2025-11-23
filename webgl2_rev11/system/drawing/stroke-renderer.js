/**
 * ============================================================
 * stroke-renderer.js - Perfect-Freehand形状補正ゼロ対応版
 * ============================================================
 * 【親依存】
 *   - PixiJS v8.14
 *   - gl-stroke-processor.js (GLStrokeProcessor)
 *   - brush-settings.js (window.brushSettings)
 *   - config.js (perfectFreehand設定)
 * 
 * 【子依存】
 *   - brush-core.js
 *   - layer-transform.js
 * 
 * 【改修内容】
 * ✅ Perfect-Freehandを"ポリゴン化専用"として使用
 * ✅ 形状補正（smoothing/streamline/thinning）を完全無効化
 * ✅ 三角形描画でメッシュ生成
 * ✅ Phase 3: レイヤー変形時の再生成対応
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
                    graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
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
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.opacity || 1.0,
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
            
            // WebGL2 Perfect-Freehand使用（形状補正ゼロ）
            if (this.webgl2Enabled && this.glStrokeProcessor) {
                try {
                    const graphics = this._renderWithPerfectFreehand(strokeData, settings);
                    if (graphics) {
                        return graphics;
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] Perfect-Freehand failed:', error);
                }
            }
            
            // Legacy fallback
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        /**
         * Perfect-Freehand: ポリゴン化専用・形状補正ゼロ
         * 
         * 🎯 目的:
         * - ユーザーが描いた線をそのままベクター化
         * - 形状変形を一切行わない
         * - メッシュ生成の入口としてのみ機能
         */
        _renderWithPerfectFreehand(strokeData, settings) {
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

            // Perfect-Freehandでポリゴン生成（形状補正なし）
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

            // 三角形ごとに個別に描画（自己交差防止）
            graphics.context.fillStyle = {
                color: settings.color,
                alpha: settings.opacity || 1.0
            };

            // 三角形リストとして描画
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
                alpha: settings.opacity || 1.0
            });

            graphics.blendMode = 'normal';
            graphics.visible = true;
            graphics.renderable = true;

            // メタデータ保存（Phase 3で使用）
            graphics.userData = {
                strokePoints: formattedPoints,
                settings: { ...settings },
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
            const newGraphics = this._renderWithPerfectFreehand(
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
                    alpha: settings.opacity || 1.0,
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

            graphics.blendMode = 'normal';
            graphics.circle(x, y, width / 2);
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });

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

    console.log('✅ stroke-renderer.js - Perfect-Freehand形状補正ゼロ対応版 loaded');
    console.log('   ✅ smoothing/streamline/thinning完全無効化');
    console.log('   ✅ ユーザーが描いた線をそのまま保持');
    console.log('   ✅ Phase 3: レイヤー変形時の再生成対応');

})();