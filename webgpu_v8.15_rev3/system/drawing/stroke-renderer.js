/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - MSAA対応版
 * ================================================================================
 * 
 * 【Phase 3 + MSAA改修】
 * ✅ 4x MSAA対応（チラツキ解消）
 * ✅ mode設定の確実な伝達
 * 
 * 【依存Parents】
 * - webgpu-geometry-layer.js (直接描画)
 * - webgpu-texture-bridge.js (GPUTexture → Pixi変換)
 * - earcut-triangulator.js (Triangulation)
 * - polygon-generator.js (Polygon生成)
 * 
 * 【依存Children】
 * - brush-core.js (renderPreview, renderFinalStroke呼び出し)
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor() {
            this.activePreview = null;
            this.webgpuReady = false;
            this.geometryLayer = null;
            this.textureBridge = null;
            this.triangulator = null;
            this.sampleCount = 4; // 4x MSAA
        }

        async initialize() {
            if (this.webgpuReady) return;

            if (!window.webgpuDrawingLayer?.isInitialized()) {
                throw new Error('[StrokeRenderer] WebGPU not initialized');
            }

            if (!window.WebGPUGeometryLayer) {
                throw new Error('[StrokeRenderer] WebGPU Geometry Layer not available');
            }

            if (!window.webgpuTextureBridge) {
                throw new Error('[StrokeRenderer] WebGPU Texture Bridge not available');
            }

            if (!window.EarcutTriangulator) {
                throw new Error('[StrokeRenderer] Earcut Triangulator not available');
            }

            this.geometryLayer = window.WebGPUGeometryLayer;
            this.textureBridge = window.webgpuTextureBridge;
            this.triangulator = window.EarcutTriangulator;

            if (!this.geometryLayer.initialized) {
                const device = window.webgpuDrawingLayer.getDevice();
                const format = 'rgba8unorm';
                await this.geometryLayer.initialize(device, format);
            }

            this.webgpuReady = true;
        }

        async renderPreview(polygon, settings, container) {
            if (!polygon || polygon.length < 6) return null;

            this.clearPreview();

            try {
                const sprite = await this._renderWithWebGPU(polygon, settings);
                
                if (sprite && container) {
                    container.addChild(sprite);
                }

                this.activePreview = sprite;
                return sprite;

            } catch (error) {
                console.warn('[StrokeRenderer] Preview rendering failed:', error);
                return null;
            }
        }

        clearPreview() {
            if (this.activePreview) {
                this.activePreview.destroy({ 
                    children: true, 
                    texture: true, 
                    baseTexture: true 
                });
                this.activePreview = null;
            }
        }

        async renderFinalStroke(strokeData, settings, layerContainer) {
            this.clearPreview();

            if (!strokeData) {
                console.warn('[StrokeRenderer] No strokeData provided');
                return null;
            }

            let polygon = strokeData.polygon;
            if (!polygon && strokeData.points && strokeData.points.length > 0) {
                polygon = window.PolygonGenerator.generate(strokeData.points);
            }

            if (!polygon || polygon.length < 6) {
                console.warn('[StrokeRenderer] Invalid polygon data');
                return null;
            }

            try {
                const sprite = await this._renderWithWebGPU(polygon, settings);

                if (sprite && layerContainer) {
                    layerContainer.addChild(sprite);
                }

                return sprite;

            } catch (error) {
                console.error('[StrokeRenderer] Final stroke rendering failed:', error);
                return null;
            }
        }

        async _renderWithWebGPU(polygon, settings) {
            if (!this.webgpuReady) {
                await this.initialize();
            }

            const device = window.webgpuDrawingLayer.getDevice();

            const bounds = this._calculateBounds(polygon);
            const padding = Math.ceil((settings.size || 16) / 2);
            
            const width = Math.ceil(bounds.maxX - bounds.minX) + padding * 2;
            const height = Math.ceil(bounds.maxY - bounds.minY) + padding * 2;

            if (width < 1 || height < 1) {
                console.warn('[StrokeRenderer] Invalid dimensions');
                return null;
            }

            const localPolygon = new Float32Array(polygon.length);
            for (let i = 0; i < polygon.length; i += 2) {
                localPolygon[i] = polygon[i] - bounds.minX + padding;
                localPolygon[i + 1] = polygon[i + 1] - bounds.minY + padding;
            }

            const indices = this.triangulator.triangulate(localPolygon);

            if (!indices || indices.length === 0) {
                console.warn('[StrokeRenderer] Triangulation failed');
                return null;
            }

            this.geometryLayer.uploadPolygon(localPolygon, indices);

            const transformMatrix = this._createTransformMatrix(width, height);
            const color = this._parseColor(settings.color, settings.opacity);

            // 🔧 mode を確実に設定
            const mode = settings.mode || 'pen';
            this.geometryLayer.setBlendMode(mode);
            this.geometryLayer.updateTransform(transformMatrix, color);

            // MSAA用テクスチャ作成
            const msaaTexture = device.createTexture({
                label: 'MSAA Render Target',
                size: [width, height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
                sampleCount: this.sampleCount
            });

            const resolveTexture = device.createTexture({
                label: 'Resolve Target',
                size: [width, height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | 
                       GPUTextureUsage.COPY_SRC |
                       GPUTextureUsage.TEXTURE_BINDING
            });

            const encoder = device.createCommandEncoder({ label: 'Stroke Encoder' });

            const pass = encoder.beginRenderPass({
                label: 'Stroke Render Pass (MSAA)',
                colorAttachments: [{
                    view: msaaTexture.createView(),
                    resolveTarget: resolveTexture.createView(),
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'discard'
                }]
            });

            this.geometryLayer.render(pass);

            pass.end();
            device.queue.submit([encoder.finish()]);

            const pixiTexture = await this.textureBridge.createPixiTextureFromGPU(
                resolveTexture,
                width,
                height
            );

            msaaTexture.destroy();
            resolveTexture.destroy();

            const sprite = new PIXI.Sprite(pixiTexture);
            sprite.x = bounds.minX - padding;
            sprite.y = bounds.minY - padding;

            return sprite;
        }

        _createTransformMatrix(width, height) {
            const scaleX = 2.0 / width;
            const scaleY = -2.0 / height;
            const translateX = -1.0;
            const translateY = 1.0;

            return new Float32Array([
                scaleX, 0, 0,
                0, scaleY, 0,
                translateX, translateY, 1
            ]);
        }

        _parseColor(color, opacity = 1.0) {
            if (typeof color === 'number') {
                const r = ((color >> 16) & 0xFF) / 255.0;
                const g = ((color >> 8) & 0xFF) / 255.0;
                const b = (color & 0xFF) / 255.0;
                return [r, g, b, opacity];
            }
            
            return [0.0, 0.0, 0.0, opacity];
        }

        _calculateBounds(polygon) {
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            for (let i = 0; i < polygon.length; i += 2) {
                minX = Math.min(minX, polygon[i]);
                maxX = Math.max(maxX, polygon[i]);
                minY = Math.min(minY, polygon[i + 1]);
                maxY = Math.max(maxY, polygon[i + 1]);
            }

            return { minX, minY, maxX, maxY };
        }
    }

    window.StrokeRenderer = StrokeRenderer;
    window.strokeRenderer = new StrokeRenderer();

    console.log('✅ stroke-renderer.js (Phase 3 + MSAA) loaded');
    console.log('   🔧 4x マルチサンプリング対応');
    console.log('   🔧 mode設定の確実な伝達');

})();