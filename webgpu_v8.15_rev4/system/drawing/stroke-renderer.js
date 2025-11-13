/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 6: Geometry Layer + MSAA統合版
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
    }

    /**
     * 初期化
     */
    async initialize() {
      if (this.initialized) {
        return;
      }

      // WebGPU Components取得
      this.webgpuDrawingLayer = window.WebGPUDrawingLayer;
      this.webgpuGeometryLayer = window.WebGPUGeometryLayer;
      this.textureBridge = window.WebGPUTextureBridge;
      this.triangulator = window.EarcutTriangulator;

      if (!this.webgpuDrawingLayer?.initialized) {
        console.error('❌ [StrokeRenderer] WebGPUDrawingLayer not initialized');
        return;
      }

      if (!this.webgpuGeometryLayer?.initialized) {
        console.error('❌ [StrokeRenderer] WebGPUGeometryLayer not initialized');
        return;
      }

      this.initialized = true;
      console.log('✅ stroke-renderer.js (Phase 6 + MSAA) loaded');
    }

    /**
     * Preview描画
     */
    async renderPreview(polygon, settings, container) {
      if (!this.initialized || !polygon || polygon.length < 6) {
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

        // 描画実行
        const encoder = device.createCommandEncoder({ label: 'Preview Render' });
        
        // Clear pass
        const clearPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'store'
          }]
        });
        clearPass.end();

        // Geometry描画
        this.webgpuGeometryLayer.render(encoder, texture, width, height);

        device.queue.submit([encoder.finish()]);

        // Pixi Sprite作成
        const sprite = await this.textureBridge.createSpriteFromGPUTexture(texture, width, height);
        
        if (sprite) {
          sprite.x = bounds.minX - 2;
          sprite.y = bounds.minY - 2;
          container.addChild(sprite);
        }

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
      // Local → NDC変換
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
     * Color取得
     */
    _getColor(settings) {
      const color = settings?.color || window.config?.defaultColor || '#800000';
      
      // Hex → RGBA
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      const a = settings?.opacity || 1.0;

      return new Float32Array([r, g, b, a]);
    }

    /**
     * クリーンアップ
     */
    destroy() {
      this.initialized = false;
    }
  }

  // Global登録（クラスとインスタンス両方）
  window.StrokeRenderer = StrokeRenderer;
  window.strokeRenderer = new StrokeRenderer();

})();