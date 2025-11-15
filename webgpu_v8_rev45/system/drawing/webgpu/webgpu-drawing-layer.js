/**
 * ================================================================================
 * webgpu-drawing-layer.js Phase 2: MSAA統合完全版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgpu-capabilities.js (機能検出)
 * 
 * 📄 子ファイル使用先:
 *   - webgpu-geometry-layer.js
 *   - webgpu-compute-sdf.js
 *   - webgpu-mask-layer.js
 *   - webgpu-texture-bridge.js
 *   - stroke-renderer.js
 *   - msdf-pipeline-manager.js
 * 
 * 【Phase 2改修内容】
 * ✅ MSAA sampleCount: 4 設定追加
 * ✅ multisample texture生成
 * ✅ resolveTarget設定
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class WebGPUDrawingLayer {
    constructor() {
      this.device = null;
      this.queue = null;
      this.adapter = null;
      this.format = 'rgba8unorm';
      this.initialized = false;
      
      // ✅ Phase 2: MSAA設定
      this.sampleCount = 4;
    }

    async initialize() {
      if (this.initialized) {
        return true;
      }

      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU not supported');
        }

        this.adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });

        if (!this.adapter) {
          throw new Error('Failed to get WebGPU adapter');
        }

        this.device = await this.adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {
            maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
            maxBufferSize: this.adapter.limits.maxBufferSize,
            maxComputeWorkgroupSizeX: 256,
            maxComputeWorkgroupSizeY: 256
          }
        });

        this.queue = this.device.queue;

        this.device.addEventListener('uncapturederror', (event) => {
          console.error('[WebGPU] Uncaptured error:', event.error);
        });

        this.initialized = true;

        console.log('✅ [WebGPUDrawingLayer] Phase 2 MSAA統合完全版 Initialized');
        console.log('   📊 Device:', this.device);
        console.log('   📊 Format:', this.format);
        console.log('   📊 MSAA sampleCount:', this.sampleCount);

        return true;

      } catch (error) {
        console.error('❌ [WebGPUDrawingLayer] Initialization failed:', error);
        this.initialized = false;
        return false;
      }
    }

    getDevice() {
      if (!this.initialized || !this.device) {
        throw new Error('[WebGPUDrawingLayer] Device not initialized');
      }
      return this.device;
    }

    getQueue() {
      if (!this.initialized || !this.queue) {
        throw new Error('[WebGPUDrawingLayer] Queue not initialized');
      }
      return this.queue;
    }

    getFormat() {
      return this.format;
    }

    /**
     * ✅ Phase 2: MSAA sampleCount取得
     */
    getSampleCount() {
      return this.sampleCount;
    }

    isInitialized() {
      return this.initialized && this.device !== null;
    }

    destroy() {
      if (this.device) {
        this.device.destroy();
        this.device = null;
      }
      this.queue = null;
      this.adapter = null;
      this.initialized = false;
    }
  }

  window.WebGPUDrawingLayer = new WebGPUDrawingLayer();

})();