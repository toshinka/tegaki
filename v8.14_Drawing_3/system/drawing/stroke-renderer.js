/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 3: SDF+マスク統合版
 * ================================================================================
 * 
 * 【Phase 3 改修内容】
 * ✅ ペン/消しゴムをマスクベースで統合
 * ✅ blendMode完全排除
 * ✅ Legacy描画(_renderEraserStroke, _renderFinalStrokeLegacy)削除
 * ✅ SDF+マスク合成で統一描画
 * 
 * 【依存関係 - Parents】
 *   - PixiJS v8.13 (Graphics, Sprite, Mesh)
 *   - webgpu-mask-layer.js (マスクレイヤー) ★Phase 2
 *   - webgpu-compute-sdf.js (SDF生成)
 *   - webgpu-compute-msdf.js (MSDF生成)
 *   - webgpu-texture-bridge.js (テクスチャ変換)
 *   - sdf-brush-shader.js (統合shader)
 *   - msdf-brush-shader.js (MSDF shader)
 *   - brush-settings.js (settings取得)
 * 
 * 【依存関係 - Children】
 *   - brush-core.js (ストローク描画)
 *   - layer-system.js (レイヤー追加)
 * 
 * 【責務】
 *   - ストロークの視覚化（プレビュー・最終描画）
 *   - ペン/消しゴム: マスク加算/減算（統一パイプライン）
 *   - WebGPU完全移行
 * ================================================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = 1;  // DPR=1固定
            this.minPhysicalWidth = 1.0;
            this.currentTool = 'pen';
            
            this.webgpuLayer = null;
            this.webgpuMaskLayer = null;  // ★Phase 3追加
            this.webgpuComputeSDF = null;
            this.webgpuComputeMSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
            
            this.msdfBrushShader = null;
            this.msdfEnabled = false;
            
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
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

        async setWebGPULayer(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            
            if (webgpuLayer && webgpuLayer.isInitialized()) {
                // ★Phase 3: WebGPUMaskLayer初期化
                if (window.WebGPUMaskLayer) {
                    const canvasConfig = window.TEGAKI_CONFIG?.canvas || {};
                    const width = canvasConfig.width || 400;
                    const height = canvasConfig.height || 400;
                    
                    this.webgpuMaskLayer = new window.WebGPUMaskLayer(webgpuLayer);
                    await this.webgpuMaskLayer.initialize(width, height);
                }
                
                if (this.config.sdf?.enabled !== false) {
                    this.webgpuComputeSDF = new window.WebGPUComputeSDF(webgpuLayer);
                    await this.webgpuComputeSDF.initialize();
                }
                
                if (this.config.msdf?.enabled !== false) {
                    this.webgpuComputeMSDF = new window.WebGPUComputeMSDF(webgpuLayer);
                    await this.webgpuComputeMSDF.initialize();
                    this.msdfEnabled = true;
                }
                
                this.textureBridge = new window.WebGPUTextureBridge(webgpuLayer);
                
                if (this.msdfEnabled) {
                    this.msdfBrushShader = new window.MSDFBrushShader();
                    this.msdfBrushShader.initialize(this.app.renderer);
                }
                
                this.webgpuEnabled = true;
                console.log('✅ [StrokeRenderer] WebGPU + MaskLayer initialized');
            }
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = 0.3;
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * ========================================================================
         * プレビュー描画（リアルタイム）- 軽量Graphics描画
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
         * ★Phase 3: 最終描画統合（ペン/消しゴム共通パイプライン）
         * ========================================================================
         */
        async renderFinalStroke(strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            // ★Phase 3: ポリゴンベース描画
            if (strokeData.polygon && strokeData.polygon.length > 0) {
                return await this._renderWithPolygon(strokeData, settings, mode);
            }
            
            // フォールバック: points のみの場合
            return await this._renderWithPoints(strokeData, settings, mode);
        }

        /**
         * ★Phase 3 新規: ポリゴンベース描画（マスク統合）
         */
        async _renderWithPolygon(strokeData, settings, mode) {
            const { polygon } = strokeData;
            
            // マスクレイヤー更新
            if (this.webgpuMaskLayer && this.webgpuMaskLayer.isInitialized()) {
                const maskMode = mode === 'eraser' ? 'subtract' : 'add';
                await this.webgpuMaskLayer.addPolygonToMask(polygon, maskMode);
            }
            
            // SDF生成（視覚化用）
            const sdfSprite = await this._generateSDFFromPolygon(polygon, settings, mode);
            
            return sdfSprite;
        }

        /**
         * SDF生成（ポリゴンから）
         */
        async _generateSDFFromPolygon(polygon, settings, mode) {
            // Bounding Box計算
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const point of polygon) {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            // Local座標化
            const localPoints = polygon.map(p => ({
                x: p[0] - minX,
                y: p[1] - minY
            }));

            // SDF生成
            if (!this.webgpuComputeSDF) {
                // フォールバック: 簡易Graphics
                return this._createFallbackGraphics(polygon, settings, mode);
            }

            try {
                const sdfData = await this.webgpuComputeSDF.generateSDF(
                    localPoints,
                    width,
                    height,
                    settings.size * 2
                );

                if (!sdfData) {
                    throw new Error('SDF generation failed');
                }

                const sdfTexture = await this.textureBridge.sdfToPixiTexture(
                    sdfData,
                    width,
                    height
                );

                if (!sdfTexture) {
                    throw new Error('SDF texture conversion failed');
                }

                const sprite = new PIXI.Sprite(sdfTexture);
                sprite.position.set(minX, minY);
                
                // Shader適用
                const shader = window.SDFBrushShader?.create({
                    radius: settings.size,
                    hardness: 0.8,
                    color: settings.color,
                    opacity: settings.opacity || 1.0,
                    isErase: mode === 'eraser'
                });
                
                if (shader) {
                    sprite.shader = shader;
                }
                
                sprite.blendMode = 'normal';
                sprite.tint = mode === 'eraser' ? 0xFFFFFF : settings.color;
                sprite.alpha = settings.opacity || 1.0;

                return sprite;

            } catch (error) {
                console.warn('[StrokeRenderer] SDF generation failed:', error);
                return this._createFallbackGraphics(polygon, settings, mode);
            }
        }

        /**
         * フォールバック: Graphicsでポリゴン描画
         */
        _createFallbackGraphics(polygon, settings, mode) {
            const graphics = new PIXI.Graphics();
            
            if (polygon.length < 3) {
                return graphics;
            }

            graphics.moveTo(polygon[0][0], polygon[0][1]);
            for (let i = 1; i < polygon.length; i++) {
                graphics.lineTo(polygon[i][0], polygon[i][1]);
            }
            graphics.closePath();

            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }

            return graphics;
        }

        /**
         * Points描画（ポリゴン未生成時のフォールバック）
         */
        async _renderWithPoints(strokeData, settings, mode) {
            const graphics = new PIXI.Graphics();
            const points = strokeData.points;

            if (strokeData.isSingleDot || points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
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

        /**
         * ★Phase 3: Legacy描画削除
         * ❌ _renderEraserStroke() 削除
         * ❌ _renderFinalStrokeLegacy() 削除
         * ❌ renderDot() 削除
         */

        renderStroke(layer, strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            
            const graphics = this._createFallbackGraphics(
                strokeData.polygon || [],
                settings,
                mode
            );
            
            return {
                id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                graphics: graphics,
                points: strokeData.points,
                polygon: strokeData.polygon,
                tool: mode,
                settings: { ...settings }
            };
        }

        updateResolution() {
            this.resolution = 1;  // DPR=1固定
            this.minPhysicalWidth = 1.0;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 3 統合版) loaded');
    console.log('   ✅ ペン/消しゴムマスク統合');
    console.log('   ✅ blendMode完全排除');
    console.log('   ❌ Legacy描画削除');

})();