/**
 * StrokeRenderer - ストローク描画専用クラス
 * Phase 5: 消しゴム修正版（DST_OUT使用）
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * 
 * 描画方式優先順位:
 * 1. WebGPU MSDF（最高品質・RGB 3チャンネル）
 * 2. WebGPU SDF（高品質・シングルチャンネル）
 * 3. Legacy Graphics（フォールバック・互換性）
 * 
 * 消しゴム: PIXI.BLEND_MODES.DST_OUT（レイヤー内アルファのみ削除）
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
            
            // WebGPU関連
            this.webgpuLayer = null;
            this.webgpuComputeSDF = null;
            this.webgpuComputeMSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
            
            // MSDF関連
            this.msdfBrushShader = null;
            this.msdfEnabled = false;
            
            // 設定
            this.config = window.TEGAKI_CONFIG?.webgpu || {};
        }

        /**
         * WebGPUレイヤー設定
         */
        async setWebGPULayer(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            
            if (webgpuLayer && webgpuLayer.isInitialized()) {
                // WebGPU Compute SDF初期化
                if (this.config.sdf?.enabled !== false) {
                    this.webgpuComputeSDF = new window.WebGPUComputeSDF(webgpuLayer);
                    await this.webgpuComputeSDF.initialize();
                }
                
                // WebGPU Compute MSDF初期化
                if (this.config.msdf?.enabled !== false) {
                    this.webgpuComputeMSDF = new window.WebGPUComputeMSDF(webgpuLayer);
                    await this.webgpuComputeMSDF.initialize();
                    this.msdfEnabled = true;
                }
                
                // Texture Bridge初期化
                this.textureBridge = new window.WebGPUTextureBridge(webgpuLayer);
                
                // MSDF Shader初期化
                if (this.msdfEnabled) {
                    this.msdfBrushShader = new window.MSDFBrushShader();
                    this.msdfBrushShader.initialize(this.app.renderer);
                }
                
                this.webgpuEnabled = true;
                console.log('[StrokeRenderer] WebGPU + MSDF integration enabled');
            }
        }

        /**
         * ツール設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }

        /**
         * 幅計算（共通）
         */
        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * リアルタイムプレビュー描画
         * Phase 5修正: 消しゴムはDST_OUT使用
         */
        renderPreview(points, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (points.length === 0) {
                return graphics;
            }

            // ★修正: 消しゴムはDST_OUTモード（レイヤー内アルファのみ削除）
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                // DST_OUTモードでは黒（不透明）で描画→対象のアルファを削る
                if (this.currentTool === 'eraser') {
                    graphics.fill({ color: 0x000000, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
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
                
                // DST_OUTモードでは黒（不透明）で描画
                if (this.currentTool === 'eraser') {
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        /**
         * 確定ストローク描画（優先順位: MSDF → SDF → Legacy）
         */
        async renderFinalStroke(strokeData, settings, targetGraphics = null) {
            console.log('🎨 [StrokeRenderer] renderFinalStroke called:', {
                pointCount: strokeData.points?.length || 0,
                isSingleDot: strokeData.isSingleDot,
                tool: this.currentTool
            });

            const minPoints = this.config.sdf?.minPointsForGPU || 5;

            // 1. WebGPU MSDF（最優先）
            if (this.msdfEnabled && this.webgpuComputeMSDF && strokeData.points.length > minPoints) {
                try {
                    console.log('  → Trying MSDF...');
                    return await this._renderFinalStrokeMSDF(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU MSDF failed, fallback to SDF:', error);
                }
            }

            // 2. WebGPU SDF（次点）
            if (this.webgpuEnabled && this.webgpuComputeSDF && strokeData.points.length > minPoints) {
                try {
                    console.log('  → Trying SDF...');
                    return await this._renderFinalStrokeWebGPU(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU SDF failed, fallback to legacy:', error);
                }
            }

            // 3. Legacy Graphics（フォールバック）
            console.log('  → Using Legacy Graphics');
            const result = this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
            console.log('✅ [StrokeRenderer] Legacy rendering completed:', result);
            return result;
        }

        /**
         * WebGPU MSDF描画
         */
        async _renderFinalStrokeMSDF(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            
            // Bounding Box計算
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            // ローカル座標に変換
            const localPoints = points.map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            // WebGPU Compute ShaderでMSDF生成
            const msdfConfig = this.config.msdf || {};
            const msdfData = await this.webgpuComputeMSDF.generateMSDF(
                localPoints,
                width,
                height,
                settings.size * 2,
                msdfConfig.range || 4.0
            );

            if (!msdfData) {
                throw new Error('MSDF generation failed');
            }

            // MSDF → PixiJS Texture
            const msdfTexture = await this.textureBridge.msdfToPixiTexture(
                msdfData,
                width,
                height
            );

            if (!msdfTexture) {
                throw new Error('MSDF texture conversion failed');
            }

            // MSDF Sprite作成
            const sprite = new PIXI.Sprite(msdfTexture);
            sprite.position.set(minX, minY);

            // MSDF Shader適用
            const msdfShader = this.msdfBrushShader.getMSDFShader({
                threshold: msdfConfig.threshold || 0.5,
                smoothness: msdfConfig.smoothness || 0.05
            });
            sprite.shader = msdfShader;

            // ★修正: 消しゴムはDST_OUT
            if (this.currentTool === 'eraser') {
                sprite.blendMode = 'erase';
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.alpha || 1.0;
            }

            return sprite;
        }

        /**
         * WebGPU SDF描画
         */
        async _renderFinalStrokeWebGPU(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            
            // Bounding Box計算
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            // ローカル座標に変換
            const localPoints = points.map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            // WebGPU Compute ShaderでSDF生成
            const sdfData = await this.webgpuComputeSDF.generateSDF(
                localPoints,
                width,
                height,
                settings.size * 2
            );

            if (!sdfData) {
                throw new Error('SDF generation failed');
            }

            // SDF → PixiJS Texture
            const sdfTexture = await this.textureBridge.sdfToPixiTexture(
                sdfData,
                width,
                height
            );

            if (!sdfTexture) {
                throw new Error('SDF texture conversion failed');
            }

            // SDF Sprite作成
            const sprite = new PIXI.Sprite(sdfTexture);
            sprite.position.set(minX, minY);

            // ★修正: 消しゴムはDST_OUT
            if (this.currentTool === 'eraser') {
                sprite.blendMode = 'erase';
            } else {
                sprite.tint = settings.color;
                sprite.alpha = settings.alpha || 1.0;
            }

            return sprite;
        }

        /**
         * Legacy Graphics描画（フォールバック）
         * Phase 5修正: 消しゴムはDST_OUT使用
         */
        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            // ★修正: 消しゴムは'erase'
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, graphics);
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
                
                // DST_OUTモードでは黒（不透明）で描画
                if (this.currentTool === 'eraser') {
                    graphics.stroke({
                        width: avgWidth,
                        color: 0x000000,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        /**
         * 単独点描画
         * Phase 5修正: 消しゴムはDST_OUT使用
         */
        renderDot(point, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const width = this.calculateWidth(point.pressure, settings.size);

            // ★修正: 消しゴムは'erase'
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.circle(point.x, point.y, width / 2);
            
            // eraseモードでは白で描画
            if (this.currentTool === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
            }

            return graphics;
        }

        /**
         * 解像度更新
         */
        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Phase 5: 消しゴム修正版) loaded');
    console.log('   ✓ Eraser uses "erase" blend mode (PIXI v8 compatible)');
    console.log('   ✓ Eraser only affects current layer alpha');

})();