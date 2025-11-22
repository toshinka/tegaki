/**
 * ============================================================
 * stroke-renderer.js - Phase 3 メッシュ再生成対応版
 * ============================================================
 * 【親依存】
 *   - PixiJS v8.13
 *   - gl-stroke-processor.js (GLStrokeProcessor)
 *   - brush-settings.js (window.brushSettings)
 * 
 * 【子依存】
 *   - brush-core.js
 *   - layer-transform.js
 * 
 * 【Phase 3 新機能】
 * ✅ _renderWithPerfectFreehand()をpublicメソッド化
 * ✅ レイヤー変形時のメッシュ再生成対応
 * ============================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = 1; // DPR固定
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

        /**
         * 筆圧から線幅を計算（制限なし）
         */
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
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
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
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                
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
            
            // WebGL2 Perfect-Freehand使用
            if (this.webgl2Enabled && this.glStrokeProcessor) {
                try {
                    const mesh = this._renderWithPerfectFreehand(strokeData, settings);
                    if (mesh) {
                        return mesh;
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] Perfect-Freehand failed:', error);
                }
            }
            
            // Legacy fallback
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        /**
         * Phase 3: Perfect-Freehandでメッシュ生成（publicメソッド）
         * @param {object} strokeData - {points: Array}
         * @param {object} settings - {size, color, opacity}
         * @returns {PIXI.Mesh|null}
         */
        _renderWithPerfectFreehand(strokeData, settings) {
            const points = strokeData.points;
            
            if (!points || points.length < 2) {
                return null;
            }

            // ポイントフォーマット変換
            const formattedPoints = points.map(p => ({
                x: p.localX !== undefined ? p.localX : p.x,
                y: p.localY !== undefined ? p.localY : p.y,
                pressure: p.pressure !== undefined ? p.pressure : 0.5
            }));

            const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                formattedPoints,
                settings.size
            );
            
            if (!vertexBuffer || !vertexBuffer.buffer || vertexBuffer.vertexCount === 0) {
                return null;
            }

            // PixiJS v8 Geometry作成
            const geometry = new PIXI.Geometry({
                attributes: {
                    aPosition: {
                        buffer: vertexBuffer.buffer,
                        size: 2,
                        stride: 8,
                        offset: 0
                    }
                }
            });

            // Mesh作成
            const mesh = new PIXI.Mesh({
                geometry: geometry,
                shader: PIXI.Shader.from(
                    // Vertex shader
                    `
                    attribute vec2 aPosition;
                    uniform mat3 translationMatrix;
                    uniform mat3 projectionMatrix;
                    
                    void main() {
                        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
                    }
                    `,
                    // Fragment shader
                    `
                    precision mediump float;
                    uniform vec4 uColor;
                    
                    void main() {
                        gl_FragColor = uColor;
                    }
                    `,
                    // Uniforms
                    {
                        uColor: [
                            ((settings.color >> 16) & 0xFF) / 255,
                            ((settings.color >> 8) & 0xFF) / 255,
                            (settings.color & 0xFF) / 255,
                            settings.opacity || 1.0
                        ]
                    }
                )
            });

            mesh.blendMode = 'normal';

            return mesh;
        }

        _renderEraserStroke(strokeData, settings) {
            const graphics = new PIXI.Graphics();
            graphics.blendMode = 'erase';
            
            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const p = strokeData.points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                return graphics;
            }

            const points = strokeData.points;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
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
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
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
            const width = this.calculateWidth(point.pressure, settings.size);

            graphics.blendMode = 'normal';
            graphics.circle(point.x, point.y, width / 2);
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

    console.log(' ✅ stroke-renderer.js Phase 3 loaded');
    console.log('    ✅ メッシュ再生成対応');
    console.log('    ✅ _renderWithPerfectFreehand() public化');

})();