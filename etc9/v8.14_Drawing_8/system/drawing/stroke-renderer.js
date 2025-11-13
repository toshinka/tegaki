/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Phase 3: WebGPU完全版
 * ================================================================================
 * 
 * 【Phase 3改修内容】
 * ❌ Canvas2D完全削除
 * ❌ PixiJS Graphics完全削除
 * ✅ WebGPU専用レンダリング
 * ✅ GPUTexture → PixiJS Sprite
 * 
 * 【依存Parents】
 * - webgpu-compute-sdf.js (SDF生成)
 * - webgpu-texture-bridge.js (Texture変換)
 * - polygon-generator.js (ポリゴン生成)
 * 
 * 【依存Children】
 * - brush-core.js (renderPreview, renderFinalStroke呼び出し)
 * - core-engine.js (StrokeRendererクラス参照)
 * ================================================================================
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor() {
            this.activePreview = null;
            this.webgpuReady = false;
            this.webgpuComputeSDF = null;
            this.webgpuTextureBridge = null;
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

            // SDF Compute確認
            if (!window.webgpuComputeSDF) {
                throw new Error('[StrokeRenderer] WebGPU Compute SDF not available');
            }

            // Texture Bridge確認
            if (!window.webgpuTextureBridge) {
                throw new Error('[StrokeRenderer] WebGPU Texture Bridge not available');
            }

            this.webgpuComputeSDF = window.webgpuComputeSDF;
            this.webgpuTextureBridge = window.webgpuTextureBridge;

            // Compute SDF初期化
            if (!this.webgpuComputeSDF.initialized) {
                await this.webgpuComputeSDF.initialize();
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
         * 🔧 WebGPU専用レンダリング（Canvas2D不使用）
         */
        async _renderWithWebGPU(polygon, settings) {
            // 初期化確認
            if (!this.webgpuReady) {
                await this.initialize();
            }

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

            // 🔧 SDF生成（GPU Compute）→ GPUTexture
            const gpuTexture = await this.webgpuComputeSDF.generateSDFTexture(
                localPolygon,
                width,
                height,
                (settings.size || 16) / 2
            );

            // 🔧 GPUTexture → PixiJS Texture（Canvas2D不使用）
            const texture = await this.webgpuTextureBridge.createPixiTextureFromGPU(
                gpuTexture,
                width,
                height
            );

            // GPUTexture破棄（PixiJS Textureに変換済み）
            gpuTexture.destroy();

            // Sprite生成
            const sprite = new PIXI.Sprite(texture);
            sprite.x = bounds.minX - padding;
            sprite.y = bounds.minY - padding;

            return sprite;
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

    console.log('✅ stroke-renderer.js (Phase 3: WebGPU完全版) loaded');
    console.log('   ❌ Canvas2D完全削除');
    console.log('   ❌ PixiJS Graphics完全削除');
    console.log('   ✅ WebGPU専用レンダリング');

})();