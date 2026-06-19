/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 2完成版: MSDF Pipeline統合
 * ================================================================================
 * 
 * 【責務】
 * - Polygon/EdgeBuffer → 描画（MSDF専用）
 * - Preview/Final描画統合
 * - BlendMode管理（Pen/Eraser）
 * 
 * 【親ファイル依存】
 * - webgpu-drawing-layer.js (GPUDevice/Queue/Format)
 * - msdf-pipeline-manager.js (MSDF生成)
 * - webgpu-texture-bridge.js (Texture→Sprite変換)
 * 
 * 【子ファイル依存】
 * - brush-core.js (呼び出し元)
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class StrokeRenderer {
    constructor() {
      this.webgpuDrawingLayer = null;
      this.msdfPipelineManager = null;
      this.textureBridge = null;
      
      this.initialized = false;
      this.initializationPromise = null;
      this.msdfMode = false;
      this.pipelineInfo = null;
    }

    async initialize() {
      if (this.initialized) return;
      if (this.initializationPromise) return this.initializationPromise;

      this.initializationPromise = (async () => {
        let retries = 0;
        const maxRetries = 50;

        while (retries < maxRetries) {
          this.webgpuDrawingLayer = window.WebGPUDrawingLayer;
          this.textureBridge = window.WebGPUTextureBridge;
          this.msdfPipelineManager = window.msdfPipelineManager;

          if (this.webgpuDrawingLayer?.initialized &&
              this.textureBridge?.initialized) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (!this.webgpuDrawingLayer?.initialized) {
          throw new Error('WebGPUDrawingLayer not initialized');
        }
        if (!this.textureBridge?.initialized) {
          throw new Error('WebGPUTextureBridge not initialized');
        }

        this.initialized = true;

      })();

      return this.initializationPromise;
    }

    /**
     * 🔧 Phase 2: MSDF Mode 初期化
     * @param {GPURenderPipeline} pipeline - Render Pipeline
     * @param {GPUDevice} device - GPU Device
     * @param {string} format - Texture Format
     */
    initMSDFMode(pipeline, device, format) {
      this.msdfMode = true;
      this.pipelineInfo = {
        pipeline: pipeline,
        device: device,
        format: format
      };
      console.log('✅ [StrokeRenderer] MSDF Mode enabled');
    }

    /**
     * 🔧 Phase 2: MSDF Preview描画
     * @param {GPUTexture} msdfTexture - MSDF Texture
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {Object} settings - {mode, color, opacity}
     * @param {PIXI.Container} container - Layer Container
     */
    async renderMSDFPreview(msdfTexture, bounds, settings, container) {
      if (!this.msdfMode || !msdfTexture) {
        console.error('[StrokeRenderer] MSDF mode not enabled or invalid texture');
        return null;
      }

      try {
        const width = Math.ceil(bounds.maxX - bounds.minX) + 4;
        const height = Math.ceil(bounds.maxY - bounds.minY) + 4;

        if (width <= 0 || height <= 0) return null;

        const sprite = await this.textureBridge.createSpriteFromGPUTexture(
          msdfTexture,
          width,
          height
        );

        if (sprite) {
          sprite.x = bounds.minX - 2;
          sprite.y = bounds.minY - 2;
          container.addChild(sprite);
        }

        return sprite;

      } catch (error) {
        console.error('❌ [StrokeRenderer] MSDF preview render failed:', error);
        return null;
      }
    }

    async renderPreview(polygon, settings, container) {
      console.warn('[StrokeRenderer] renderPreview deprecated - use renderMSDFPreview');
      return null;
    }

    async renderFinalStroke(strokeData, settings, layerContainer) {
      console.warn('[StrokeRenderer] renderFinalStroke deprecated - use renderMSDFPreview');
      return null;
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

    destroy() {
      this.initialized = false;
      this.msdfMode = false;
      this.pipelineInfo = null;
    }
  }

  window.StrokeRenderer = StrokeRenderer;
  window.strokeRenderer = new StrokeRenderer();

  console.log('✅ stroke-renderer.js (Phase 2完成版) loaded');

})();