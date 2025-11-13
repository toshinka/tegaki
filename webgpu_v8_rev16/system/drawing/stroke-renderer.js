/**
 * ================================================================================
 * system/drawing/stroke-renderer.js
 * Phase 1: Legacy/MSDF併存版
 * ================================================================================
 * 
 * 【責務】
 * - Polygon → 描画（Legacy/MSDF自動切替）
 * - Preview/Final描画統合
 * - BlendMode管理（Pen/Eraser）
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice/Queue)
 * - [Legacy] webgpu-geometry-layer.js (オプショナル)
 * - [Legacy] earcut-triangulator.js (オプショナル)
 * - [MSDF] msdf-pipeline-manager.js (Phase 2以降)
 * - webgpu-texture-bridge.js (共通)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 1改修】
 * ✅ Legacy依存をオプショナル化
 * ✅ WebGPUGeometryLayer未初期化でもエラー回避
 * ✅ MSDF Pipeline対応準備（Phase 2で実装）
 * 
 * 【変更履歴】
 * - v2.1: Legacy/MSDF併存対応（初期化エラー修正）
 * - v2.0: MSAA対応・同期強化版
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class StrokeRenderer {
    constructor() {
      this.webgpuDrawingLayer = null;
      
      // Legacy Components (オプショナル)
      this.webgpuGeometryLayer = null;
      this.triangulator = null;
      
      // MSDF Components (Phase 2以降)
      this.msdfPipelineManager = null;
      
      // 共通
      this.textureBridge = null;
      
      this.initialized = false;
      this.initializationPromise = null;
      this.legacyMode = false;
      this.msdfMode = false;
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

          // Legacy Components (オプショナル)
          this.webgpuGeometryLayer = window.WebGPUGeometryLayer;
          this.triangulator = window.EarcutTriangulator;

          // MSDF Components (Phase 2以降)
          this.msdfPipelineManager = window.msdfPipelineManager;

          // 最低限の依存チェック
          if (this.webgpuDrawingLayer?.initialized &&
              this.textureBridge?.initialized) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        // 必須コンポーネント確認
        if (!this.webgpuDrawingLayer?.initialized) {
          throw new Error('WebGPUDrawingLayer not initialized');
        }
        if (!this.textureBridge?.initialized) {
          throw new Error('WebGPUTextureBridge not initialized');
        }

        // モード判定
        this.legacyMode = this.webgpuGeometryLayer?.initialized && this.triangulator;
        this.msdfMode = this.msdfPipelineManager?.initialized;

        this.initialized = true;

        console.log('✅ [StrokeRenderer] Phase 1初期化完了');
        console.log(`   📊 Legacy Mode: ${this.legacyMode}`);
        console.log(`   📊 MSDF Mode: ${this.msdfMode}`);

        if (!this.legacyMode && !this.msdfMode) {
          console.warn('⚠️ [StrokeRenderer] 描画エンジン未初期化 - Phase 2実装待ち');
        }

      })();

      return this.initializationPromise;
    }

    async renderPreview(polygon, settings, container) {
      if (!this.initialized) return null;
      if (!polygon || polygon.length < 6) return null;

      // Legacy Mode使用可能ならLegacy優先
      if (this.legacyMode) {
        return await this._renderPreviewLegacy(polygon, settings, container);
      }

      // MSDF Mode（Phase 2以降実装）
      if (this.msdfMode) {
        console.warn('[StrokeRenderer] MSDF Preview未実装 - Phase 2予定');
        return null;
      }

      console.warn('[StrokeRenderer] 描画エンジン利用不可');
      return null;
    }

    /**
     * ✅ Legacy描画フロー（Phase 1維持）
     */
    async _renderPreviewLegacy(polygon, settings, container) {
      try {
        const mode = settings?.mode || 'pen';
        this.webgpuGeometryLayer.setBlendMode(mode);

        const indices = this.triangulator.triangulate(polygon);
        if (!indices || indices.length === 0) return null;

        const bounds = this._calculateBounds(polygon);
        const width = Math.ceil(bounds.maxX - bounds.minX) + 4;
        const height = Math.ceil(bounds.maxY - bounds.minY) + 4;

        if (width <= 0 || height <= 0) return null;

        const normalizedPolygon = this._normalizePolygon(polygon, bounds);
        const transform = this._createTransformMatrix(width, height);
        
        const color = mode === 'eraser' 
          ? new Float32Array([1, 1, 1, 1.0])
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

        const msaaTexture = device.createTexture({
          size: { width, height },
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          sampleCount: 4
        });

        const encoder = device.createCommandEncoder({ label: 'Preview Render' });

        const clearPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 }
          }]
        });
        clearPass.end();

        this.webgpuGeometryLayer.render(encoder, texture, width, height, msaaTexture);
        
        device.queue.submit([encoder.finish()]);
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
        msaaTexture.destroy();

        return sprite;

      } catch (error) {
        console.error('❌ [StrokeRenderer] Legacy render failed:', error);
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

  console.log('✅ stroke-renderer.js (Phase 1: Legacy/MSDF併存版) loaded');
  console.log('   🔧 WebGPUGeometryLayer依存をオプショナル化');
  console.log('   ✅ 初期化エラー回避');

})();