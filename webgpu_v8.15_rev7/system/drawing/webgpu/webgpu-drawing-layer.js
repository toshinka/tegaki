/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-drawing-layer.js
 * Phase 3: 命名統一・エラーハンドリング強化版
 * ================================================================================
 * 
 * 【責務】
 * - WebGPU初期化・デバイス管理
 * - GPUDevice/Queue のグローバル公開（大文字統一）
 * - WebGPUCapabilities統合
 * 
 * 【依存Parents】
 * - webgpu-capabilities.js (機能検出)
 * 
 * 【依存Children】
 * - webgpu-geometry-layer.js (Polygon描画)
 * - webgpu-compute-sdf.js (SDF生成)
 * - webgpu-mask-layer.js (マスク管理)
 * - webgpu-texture-bridge.js (テクスチャ変換)
 * - stroke-renderer.js (描画処理)
 * 
 * 【Phase 3改修】
 * ✅ グローバルシンボル統一: window.WebGPUDrawingLayer (大文字)
 * ✅ エラーハンドリング強化
 * ✅ 初期化状態の明示
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

        console.log('✅ [WebGPUDrawingLayer] Phase 3 Initialized');
        console.log('   📊 Device:', this.device);
        console.log('   📊 Format:', this.format);

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

  // グローバル公開（大文字統一）
  window.WebGPUDrawingLayer = new WebGPUDrawingLayer();

})();