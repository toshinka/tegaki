/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 7: 完全初期化版
 * ================================================================================
 * 
 * 【責務】
 * - Polygon → WebGPU Geometry Layer経由描画
 * - Preview/Final描画統合
 * - BlendMode管理（Pen/Eraser）
 * 
 * 【依存Parents】
 * - webgpu-geometry-layer.js
 * - earcut-triangulator.js
 * - webgpu-drawing-layer.js
 * - webgpu-texture-bridge.js
 * 
 * 【依存Children】
 * - brush-core.js
 * 
 * 【Phase 7改修】
 * - WebGPU初期化完了確認強化
 * - チラつき解消（Clear pass削除）
 * - エラーハンドリング強化
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class StrokeRenderer {
    constructor() {
      this.webgpuDrawingLayer = null;
      this.webgpuGeometryLayer = null;
      this.textureBridge = null;
      this.triangulator = null;
      
      this.initialized = false;
      this.initializationPromise = null;
    }

    /**
     * 初期化
     */
    async initialize() {
      if (this.initialized) {
        return;
      }

      if (this.initializationPromise) {
        return this.initializationPromise;
      }

      this.initializationPromise = (async () => {
        // WebGPU Components待機取得
        let retries = 0;
        while (retries < 50) {
          this.webgpuDrawingLayer = window.WebGPUDrawingLayer;
          this.webgpuGeometryLayer = window.WebGPUGeometryLayer;
          this.textureBridge = window.WebGPUTextureBridge;
          this.triangulator = window.EarcutTriangulator;

          if (this.webgpuDrawingLayer?.initialized &&
              this.webgpuGeometryLayer?.initialized &&
              this.textureBridge?.initialized &&
              this.triangulator) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (!this.webgpuDrawingLayer?.initialized) {
          throw new Error('WebGPUDrawingLayer not initialized after timeout');
        }

        if (!this.webgpuGeometryLayer?.initialized) {
          throw new Error('WebGPUGeometryLayer not initialized after timeout');
        }

        if (!this.textureBridge?.initialized) {
          throw new Error('WebGPUTextureBridge not initialized after timeout');
        }

        if (!this.triangulator) {
          throw new Error('EarcutTriangulator not found after timeout');
        }

        this.initialized = true;
        console.log('✅ stroke-renderer.js Phase 7 loaded');
        console.log('   🔧 完全初期化確認');
        console.log('   🔧 チラつき解消');
      })();

      return this.initializationPromise;
    }

    /**
     * Preview描画
     */
    async renderPreview(polygon, settings, container) {
      if (!this.initialized) {
        console.warn('[StrokeRenderer] Not initialized');
        return null;
      }

      if (!polygon || polygon.length < 6) {
        return null;
      }

      try {
        // BlendMode設定
        const mode = settings?.mode || 'pen';
        this.webgpuGeometryLayer.setBlendMode(mode);

        // Triangulation
        const indices = this.triangulator.triangulate(polygon);
        if (!indices || indices.length === 0) {
          console.warn('[StrokeRenderer] Triangulation failed');
          return null;
        }

        // Bounds計算
        const bounds = this._calculateBounds(polygon);
        const width = Math.ceil(bounds.maxX - bounds.minX) + 4;
        const height = Math.ceil(bounds.maxY - bounds.minY) + 4;

        if (width <= 0 || height <= 0) {
          return null;
        }

        // Local座標正規化
        const normalizedPolygon = this._normalizePolygon(polygon, bounds);

        // Transform Matrix生成
        const transform = this._createTransformMatrix(width, height);

        // Color設定
        const color = this._getColor(settings);

        // Uniform更新
        this.webgpuGeometryLayer.updateUniforms(transform, color);

        // Polygon Upload
        this.webgpuGeometryLayer.uploadPolygon(normalizedPolygon, indices);

        // Texture作成
        const device = this.webgpuDrawingLayer.device;
        const texture = device.createTexture({
          size: { width, height },
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
        });

        // 描画実行（Clear pass不要 - MSAA側でload）
        const encoder = device.createCommandEncoder({ label: 'Preview Render' });
        this.webgpuGeometryLayer.render(encoder, texture, width, height);
        device.queue.submit([encoder.finish()]);

        // GPU完了待機
        await device.queue.onSubmittedWorkDone();

        // Pixi Sprite作成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(texture, width, height);
        
        if (sprite) {
          sprite.x = bounds.minX - 2;
          sprite.y = bounds.minY - 2;
          container.addChild(sprite);
        }

        // Texture破棄
        texture.destroy();

        return sprite;

      } catch (error) {
        console.error('❌ [StrokeRenderer] Preview render failed:', error);
        return null;
      }
    }

    /**
     * Final描画
     */
    async renderFinalStroke(strokeData, settings, layerContainer) {
      if (!strokeData?.polygon || strokeData.polygon.length < 6) {
        return null;
      }

      return this.renderPreview(strokeData.polygon, settings, layerContainer);
    }

    /**
     * Bounds計算
     */
    _calculateBounds(polygon) {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (let i = 0; i < polygon.length; i += 2) {
        const x = polygon[i];
        const y = polygon[i + 1];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      return { minX, minY, maxX, maxY };
    }

    /**
     * Polygon正規化（0,0起点）
     */
    _normalizePolygon(polygon, bounds) {
      const normalized = new Float32Array(polygon.length);
      const offsetX = bounds.minX - 2;
      const offsetY = bounds.minY - 2;

      for (let i = 0; i < polygon.length; i += 2) {
        normalized[i] = polygon[i] - offsetX;
        normalized[i + 1] = polygon[i + 1] - offsetY;
      }

      return normalized;
    }

    /**
     * Transform Matrix生成
     */
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

    /**
     * Color取得
     */
    _getColor(settings) {
      const color = settings?.color || window.config?.defaultColor || '#800000';
      
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      const a = settings?.opacity || 1.0;

      return new Float32Array([r, g, b, a]);
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.StrokeRenderer = StrokeRenderer;
  window.strokeRenderer = new StrokeRenderer();

})();