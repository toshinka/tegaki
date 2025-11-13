/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 3: WebGPU Direct Rendering
 * ================================================================================
 * 
 * 【Phase 3改修内容】
 * ❌ SDF Compute削除
 * ✅ WebGPU Geometry Layer統合
 * ✅ Direct Polygon Rendering
 * ✅ ペン/消しゴム統一パイプライン
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
        }

        /**
         * WebGPU初期化確認
         */
        async initialize() {
            if (this.webgpuReady) return;

            // WebGPU基盤確認
            if (!window.webgpuDrawingLayer?.isInitialized()) {
                throw new Error('[StrokeRenderer] WebGPU not initialized');
            }

            // Geometry Layer確認
            if (!window.WebGPUGeometryLayer) {
                throw new Error('[StrokeRenderer] WebGPU Geometry Layer not available');
            }

            // Texture Bridge確認
            if (!window.webgpuTextureBridge) {
                throw new Error('[StrokeRenderer] WebGPU Texture Bridge not available');
            }

            // Triangulator確認
            if (!window.EarcutTriangulator) {
                throw new Error('[StrokeRenderer] Earcut Triangulator not available');
            }

            this.geometryLayer = window.WebGPUGeometryLayer;
            this.textureBridge = window.webgpuTextureBridge;
            this.triangulator = window.EarcutTriangulator;

            // Geometry Layer初期化
            if (!this.geometryLayer.initialized) {
                const device = window.webgpuDrawingLayer.getDevice();
                const format = 'rgba8unorm';
                await this.geometryLayer.initialize(device, format);
            }

            this.webgpuReady = true;
        }

        /**
         * プレビューレンダリング（描画中）
         */
        async renderPreview(polygon, settings, container) {
            if (!polygon || polygon.length < 6) return null;

            // 既存プレビュー削除
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

        /**
         * プレビュー削除
         */
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

        /**
         * 最終ストローク描画
         */
        async renderFinalStroke(strokeData, settings, layerContainer) {
            // プレビュー削除
            this.clearPreview();

            // strokeData検証
            if (!strokeData) {
                console.warn('[StrokeRenderer] No strokeData provided');
                return null;
            }

            // polygon取得
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

        /**
         * ✅ WebGPU Direct Rendering（SDF不使用）
         */
        async _renderWithWebGPU(polygon, settings) {
            // 初期化確認
            if (!this.webgpuReady) {
                await this.initialize();
            }

            const device = window.webgpuDrawingLayer.getDevice();

            // バウンディングボックス計算
            const bounds = this._calculateBounds(polygon);
            const padding = Math.ceil((settings.size || 16) / 2);
            
            const width = Math.ceil(bounds.maxX - bounds.minX) + padding * 2;
            const height = Math.ceil(bounds.maxY - bounds.minY) + padding * 2;

            if (width < 1 || height < 1) {
                console.warn('[StrokeRenderer] Invalid dimensions');
                return null;
            }

            // ローカル座標変換
            const localPolygon = new Float32Array(polygon.length);
            for (let i = 0; i < polygon.length; i += 2) {
                localPolygon[i] = polygon[i] - bounds.minX + padding;
                localPolygon[i + 1] = polygon[i + 1] - bounds.minY + padding;
            }

            // ✅ Triangulation
            const indices = this.triangulator.triangulate(localPolygon);

            if (!indices || indices.length === 0) {
                console.warn('[StrokeRenderer] Triangulation failed');
                return null;
            }

            // ✅ Geometry Layer にアップロード
            this.geometryLayer.uploadPolygon(localPolygon, indices);

            // ✅ Transform Matrix生成（Local → NDC）
            const transformMatrix = this._createTransformMatrix(width, height);

            // ✅ Color設定
            const color = this._parseColor(settings.color, settings.opacity);

            // ✅ BlendMode設定
            this.geometryLayer.setBlendMode(settings.mode || 'pen');

            // ✅ Uniform更新
            this.geometryLayer.updateTransform(transformMatrix, color);

            // ✅ Render Texture作成
            const texture = device.createTexture({
                label: 'Stroke Render Target',
                size: [width, height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | 
                       GPUTextureUsage.COPY_SRC |
                       GPUTextureUsage.TEXTURE_BINDING
            });

            // ✅ Render Pass
            const encoder = device.createCommandEncoder({ label: 'Stroke Encoder' });

            const pass = encoder.beginRenderPass({
                label: 'Stroke Render Pass',
                colorAttachments: [{
                    view: texture.createView(),
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'store'
                }]
            });

            // ✅ 描画実行
            this.geometryLayer.render(pass);

            pass.end();
            device.queue.submit([encoder.finish()]);

            // ✅ GPUTexture → PixiJS Texture
            const pixiTexture = await this.textureBridge.createPixiTextureFromGPU(
                texture,
                width,
                height
            );

            // GPUTexture破棄
            texture.destroy();

            // Sprite生成
            const sprite = new PIXI.Sprite(pixiTexture);
            sprite.x = bounds.minX - padding;
            sprite.y = bounds.minY - padding;

            return sprite;
        }

        /**
         * Transform Matrix生成（Local → NDC）
         */
        _createTransformMatrix(width, height) {
            // NDC: x,y ∈ [-1, 1]
            const scaleX = 2.0 / width;
            const scaleY = -2.0 / height; // Y軸反転
            const translateX = -1.0;
            const translateY = 1.0;

            return new Float32Array([
                scaleX, 0, 0,
                0, scaleY, 0,
                translateX, translateY, 1
            ]);
        }

        /**
         * Color解析
         */
        _parseColor(color, opacity = 1.0) {
            if (typeof color === 'number') {
                const r = ((color >> 16) & 0xFF) / 255.0;
                const g = ((color >> 8) & 0xFF) / 255.0;
                const b = (color & 0xFF) / 255.0;
                return [r, g, b, opacity];
            }
            
            // デフォルト: 黒
            return [0.0, 0.0, 0.0, opacity];
        }

        /**
         * バウンディングボックス計算
         */
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

    // クラスとインスタンス両方を公開
    window.StrokeRenderer = StrokeRenderer;
    window.strokeRenderer = new StrokeRenderer();

    console.log('✅ stroke-renderer.js (Phase 3: Direct Rendering) loaded');
    console.log('   ❌ SDF Compute削除');
    console.log('   ✅ WebGPU Geometry Layer統合');
    console.log('   ✅ ペン/消しゴム統一パイプライン');

})();