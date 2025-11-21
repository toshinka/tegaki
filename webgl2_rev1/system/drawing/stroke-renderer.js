/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 2.0 Perfect-Freehand統合版
 * ================================================================================
 * 
 * 【Phase 2.0 改修内容】
 * ✅ Perfect-Freehand → WebGL2 パイプライン接続完了
 * ✅ gl-stroke-processor.js 統合
 * ✅ ポリゴン化による高品質ベクター描画
 * ✅ Phase 1-FIX の全機能を完全継承
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - PixiJS v8.13 (Graphics, Sprite, Mesh)
 *   - system/drawing/webgl2/webgl2-drawing-layer.js (WebGL2Context)
 *   - system/drawing/webgl2/gl-stroke-processor.js (GLStrokeProcessor)
 *   - system/drawing/webgl2/gl-msdf-pipeline.js (MSDF生成)
 *   - system/drawing/webgl2/gl-texture-bridge.js (テクスチャ変換)
 *   - system/drawing/sdf-brush-shader.js (統合shader - PEN専用)
 *   - system/drawing/brush-settings.js (settings取得)
 *   - libs/perfect-freehand-1.2.0.min.js (間接依存)
 *   - system/earcut-triangulator.js (間接依存)
 * 
 * 【依存関係 - Children (このファイルを使用)】
 *   - system/drawing/brush-core.js (ストローク描画)
 *   - system/layer-system.js (レイヤー追加)
 * 
 * 【責務】
 *   - ストロークの視覚化（プレビュー・最終描画）
 *   - ペン: Perfect-Freehand → ポリゴン → Pixi.Mesh
 *   - 消しゴム: 通常Graphics + blendMode='erase'
 *   - WebGL2/Legacy描画パイプライン管理
 * 
 * 【描画フロー】
 *   1. strokeData.points を受け取る
 *   2. GLStrokeProcessor.createPolygonVertexBuffer() 呼び出し
 *   3. Perfect-Freehand でポリゴン化
 *   4. Earcut で三角形分割
 *   5. Pixi.Mesh に変換
 *   6. レイヤーに追加
 * ================================================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
            this.currentTool = 'pen';
            
            // WebGL2統合
            this.glStrokeProcessor = null;
            this.glMSDFPipeline = null;
            this.textureBridge = null;
            this.webgl2Enabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
        }

        /**
         * WebGL2初期化
         * @param {WebGL2DrawingLayer} webgl2Layer - WebGL2レイヤー
         */
        async setWebGLLayer(webgl2Layer) {
            // GLStrokeProcessor取得（Singleton）
            this.glStrokeProcessor = window.GLStrokeProcessor;
            
            if (!this.glStrokeProcessor) {
                console.warn('[StrokeRenderer] GLStrokeProcessor not available');
                return;
            }
            
            // 初期化確認
            if (!this.glStrokeProcessor.isInitialized()) {
                console.warn('[StrokeRenderer] GLStrokeProcessor not initialized');
                return;
            }
            
            // MSDF Pipeline（オプション）
            if (window.GLMSDFPipeline && this.config.msdf?.enabled !== false) {
                this.glMSDFPipeline = window.GLMSDFPipeline;
            }
            
            // Texture Bridge（オプション）
            if (window.GLTextureBridge) {
                this.textureBridge = window.GLTextureBridge;
            }
            
            this.webgl2Enabled = true;
            console.log('✅ [StrokeRenderer] WebGL2 pipeline connected');
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
            const mode = settings?.mode || this.currentTool || 'pen';
            return mode;
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * ========================================================================
         * プレビュー描画（リアルタイム）
         * ========================================================================
         */
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

        /**
         * ========================================================================
         * 🆕 Phase 2.0: Perfect-Freehand統合 - 最終描画
         * ========================================================================
         */
        async renderFinalStroke(strokeData, providedSettings = null, targetGraphics = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            // 消しゴムは従来通り
            if (mode === 'eraser') {
                return this._renderEraserStroke(strokeData, settings);
            }
            
            // 🆕 Perfect-Freehand → WebGL2 パイプライン
            if (this.webgl2Enabled && this.glStrokeProcessor) {
                try {
                    const mesh = await this._renderWithPerfectFreehand(strokeData, settings);
                    if (mesh) {
                        return mesh;
                    }
                } catch (error) {
                    console.warn('[StrokeRenderer] Perfect-Freehand failed, fallback to legacy:', error);
                }
            }
            
            // Fallback: Legacy描画
            return this._renderFinalStrokeLegacy(strokeData, settings, mode, targetGraphics);
        }

        /**
         * ========================================================================
         * 🆕 Phase 2.0: Perfect-Freehand → Pixi.Mesh 変換
         * ========================================================================
         */
        async _renderWithPerfectFreehand(strokeData, settings) {
            const points = strokeData.points;
            
            if (!points || points.length < 2) {
                console.warn('[StrokeRenderer] Insufficient points for Perfect-Freehand');
                return null;
            }

            // 1. Perfect-Freehand でポリゴン化
            const vertexBuffer = this.glStrokeProcessor.createPolygonVertexBuffer(
                points,
                settings.size
            );
            
            if (!vertexBuffer || !vertexBuffer.buffer) {
                console.warn('[StrokeRenderer] Polygon vertex buffer creation failed');
                return null;
            }

            // 2. Pixi.Geometry 生成
            const geometry = new PIXI.Geometry();
            
            // Float32Array → Pixi.Buffer
            const buffer = new PIXI.Buffer({
                data: vertexBuffer.buffer,
                static: true
            });

            // 頂点属性設定
            geometry.addAttribute('aPosition', buffer, 3, false, PIXI.TYPES.FLOAT, 28, 0);
            geometry.addAttribute('aUV', buffer, 2, false, PIXI.TYPES.FLOAT, 28, 12);
            geometry.addAttribute('aNormal', buffer, 2, false, PIXI.TYPES.FLOAT, 28, 20);

            // 3. Pixi.Mesh 生成
            const shader = this._createPenShader(settings);
            const mesh = new PIXI.Mesh({ geometry, shader });

            // 4. 位置・ブレンド設定
            if (vertexBuffer.bounds) {
                mesh.position.set(0, 0); // boundsは既にLocal座標
            }
            
            mesh.blendMode = 'normal';
            mesh.alpha = settings.opacity || 1.0;

            console.log('[StrokeRenderer] Perfect-Freehand mesh created:', {
                vertexCount: vertexBuffer.vertexCount,
                bounds: vertexBuffer.bounds
            });

            return mesh;
        }

        /**
         * ペン用Shader生成
         * @private
         */
        _createPenShader(settings) {
            // シンプルなカラーシェーダー
            const vertexSrc = `
                precision highp float;
                
                attribute vec3 aPosition;
                attribute vec2 aUV;
                attribute vec2 aNormal;
                
                uniform mat3 translationMatrix;
                uniform mat3 projectionMatrix;
                
                varying vec2 vUV;
                
                void main() {
                    vec3 position = translationMatrix * vec3(aPosition.xy, 1.0);
                    gl_Position = vec4((projectionMatrix * position).xy, 0.0, 1.0);
                    vUV = aUV;
                }
            `;

            const fragmentSrc = `
                precision highp float;
                
                uniform vec4 uColor;
                varying vec2 vUV;
                
                void main() {
                    gl_FragColor = uColor;
                }
            `;

            // カラー変換 (0x800000 → vec4)
            const r = ((settings.color >> 16) & 0xFF) / 255.0;
            const g = ((settings.color >> 8) & 0xFF) / 255.0;
            const b = (settings.color & 0xFF) / 255.0;
            const a = settings.opacity || 1.0;

            return PIXI.Shader.from(vertexSrc, fragmentSrc, {
                uColor: [r, g, b, a]
            });
        }

        /**
         * ========================================================================
         * Phase 1-FIX: 消しゴム専用描画（Shader不使用）
         * ========================================================================
         */
        _renderEraserStroke(strokeData, settings) {
            const graphics = new PIXI.Graphics();
            
            // BlendModeを先に設定
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

        /**
         * ========================================================================
         * Legacy描画（ペン専用・Fallback）
         * ========================================================================
         */
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
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 2.0 Perfect-Freehand統合版) loaded');
    console.log('   🆕 Perfect-Freehand → WebGL2 パイプライン接続完了');
    console.log('   ✅ ポリゴン化による高品質ベクター描画');
    console.log('   ✅ Phase 1-FIX 全機能継承');

})();