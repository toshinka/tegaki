/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 9: 完全動作・消しゴム実装版
 * ================================================================================
 * 
 * 【責務】
 * - Polygon → WebGPU Geometry Layer経由描画
 * - Preview/Final描画統合
 * - BlendMode管理（Pen/Eraser）
 * - 座標変換（Local → NDC）
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice/Queue)
 * - webgpu-geometry-layer.js (描画処理)
 * - earcut-triangulator.js (Triangulation)
 * - webgpu-texture-bridge.js (Texture → Sprite)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 9改修】
 * ✅ 消しゴム: color.a = 1.0 で完全不透明軌跡（Blend側で減算）
 * ✅ チラつき解消: await onSubmittedWorkDone()
 * ✅ 初期化待機: 最大5秒リトライ
 * 
 * 【GPT5アドバイス対応】
 * ✅ SDF Compute経由削除
 * ✅ Polygon → VertexBuffer 直接転送
 * ✅ Transform Matrix でNDC変換
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

    async initialize() {
      if (this.initialized) return;
      if (this.initializationPromise) return this.initializationPromise;

      this.initializationPromise = (async () => {
        let retries = 0;
        const maxRetries = 50; // 5秒

        while (retries < maxRetries) {
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
          throw new Error('WebGPUDrawingLayer not initialized');
        }
        if (!this.webgpuGeometryLayer?.initialized) {
          throw new Error('WebGPUGeometryLayer not initialized');
        }
        if (!this.textureBridge?.initialized) {
          throw new Error('WebGPUTextureBridge not initialized');
        }
        if (!this.triangulator) {
          throw new Error('EarcutTriangulator not found');
        }

        this.initialized = true;
        console.log('✅ [StrokeRenderer] Phase 9完全版初期化完了');
      })();

      return this.initializationPromise;
    }

    async renderPreview(polygon, settings, container) {
      if (!this.initialized) {
        console.warn('[StrokeRenderer] Not initialized');
        return null;
      }

      if (!polygon || polygon.length < 6) {
        return null;
      }

      try {
        const mode = settings?.mode || 'pen';
        this.webgpuGeometryLayer.setBlendMode(mode);

        const indices = this.triangulator.triangulate(polygon);
        if (!indices || indices.length === 0) {
          console.warn('[StrokeRenderer] Triangulation failed');
          return null;
        }

        const bounds = this._calculateBounds(polygon);
        const width = Math.ceil(bounds.maxX - bounds.minX) + 4;
        const height = Math.ceil(bounds.maxY - bounds.minY) + 4;

        if (width <= 0 || height <= 0) {
          return null;
        }

        const normalizedPolygon = this._normalizePolygon(polygon, bounds);
        const transform = this._createTransformMatrix(width, height);
        
        // 消しゴム: color.a = 1.0（完全不透明）でBlend側で減算
        const color = mode === 'eraser' 
          ? new Float32Array([1, 1, 1, 1.0])  // 白色・完全不透明
          : this._getColor(settings);

        this.webgpuGeometryLayer.updateUniforms(transform, color);
        this.webgpuGeometryLayer.uploadPolygon(normalizedPolygon, indices);

        const device = this.webgpuDrawingLayer.device;
        const texture = device.createTexture({
          size: { width, height },
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | 
                 GPUTextureUsage.COPY_SRC | 
                 GPUTextureUsage.TEXTURE_BINDING
        });

        const encoder = device.createCommandEncoder({ label: 'Preview Render' });
        this.webgpuGeometryLayer.render(encoder, texture, width, height);
        device.queue.submit([encoder.finish()]);

        // GPU完了待機（チラつき防止）
        await device.queue.onSubmittedWorkDone();

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          texture, 
          width, 
          height
        );
        
        if (sprite) {
          sprite.x = bounds.minX - 2;
          sprite.y = bounds.minY - 2;
          container.addChild(sprite);
        }

        texture.destroy();

        return sprite;

      } catch (error) {
        console.error('❌ [StrokeRenderer] Preview render failed:', error);
        return null;
      }
    }

    async renderFinalStroke(strokeData, settings, layerContainer) {
      if (!strokeData?.polygon || strokeData.polygon.length < 6) {
        return null;
      }

      return this.renderPreview(strokeData.polygon, settings, layerContainer);
    }

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

    _createTransformMatrix(width, height) {
      // Local Canvas座標 → NDC座標系変換
      // NDC: x,y ∈ [-1, 1], Y軸反転
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

    _getColor(settings) {
      const colorHex = settings?.color || window.config?.defaultColor || '#800000';
      
      const hex = colorHex.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      const a = settings?.opacity !== undefined ? settings.opacity : 1.0;

      return new Float32Array([r, g, b, a]);
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.StrokeRenderer = StrokeRenderer;
  window.strokeRenderer = new StrokeRenderer();

})();