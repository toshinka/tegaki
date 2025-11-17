/**
 * ================================================================================
 * webgpu-drawing-layer.js - Phase 1完全版: Canvas接続確立
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - index.html (<canvas id="webgpu-canvas">)
 * 
 * 📄 子ファイル使用先:
 *   - core-initializer.js (WebGPUDrawingLayer.initialize/getCanvas)
 *   - drawing-engine.js (WebGPUDrawingLayer.getCanvas)
 *   - msdf-pipeline-manager.js (device/format取得)
 *   - gpu-stroke-processor.js (device取得)
 * 
 * 【Phase 1改修内容】
 * ✅ Canvas要素の明示的取得
 * ✅ context.configure()実装
 * ✅ DPR対応サイズ計算（DPR=1固定）
 * ✅ adapter取得エラー解消
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class WebGPUDrawingLayer {
    constructor() {
      this.canvas = null;
      this.context = null;
      this.device = null;
      this.queue = null;
      this.adapter = null;
      this.format = 'rgba8unorm';
      this.initialized = false;
      this.isDeviceLost = false;
      this.sampleCount = 1;
    }

    async initialize() {
      if (this.initialized && !this.isDeviceLost) {
        return true;
      }

      try {
        // 🔧 Canvas取得: 明示的に存在確認
        this.canvas = document.getElementById('webgpu-canvas');
        if (!this.canvas) {
          throw new Error('[WebGPU] Canvas element #webgpu-canvas not found');
        }

        // 🔧 Canvas実サイズ確保（adapter取得に必須）
        const config = window.TEGAKI_CONFIG;
        const width = config?.canvas?.width || 1920;
        const height = config?.canvas?.height || 1080;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.style.display = 'block';

        console.log('[WebGPU] Canvas configured:', this.canvas.id, width, 'x', height);

        if (!navigator.gpu) {
          throw new Error('[WebGPU] navigator.gpu not supported');
        }

        // 🔧 Context取得（adapter前に実施）
        this.context = this.canvas.getContext('webgpu');
        if (!this.context) {
          throw new Error('[WebGPU] canvas.getContext("webgpu") failed');
        }
        console.log('[WebGPU] Context acquired');

        // Adapter取得: オプションなしを優先
        this.adapter = await navigator.gpu.requestAdapter();
        
        if (!this.adapter) {
          this.adapter = await navigator.gpu.requestAdapter({ 
            powerPreference: 'high-performance' 
          });
        }
        
        if (!this.adapter) {
          throw new Error('[WebGPU] Failed to get adapter');
        }
        console.log('[WebGPU] Adapter acquired');

        // Device取得
        this.device = await this.adapter.requestDevice();
        this.queue = this.device.queue;
        console.log('[WebGPU] Device acquired');

        // 🔧 Context設定（重要: ここで接続確立）
        this.context.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        console.log('[WebGPU] Context configured');

        // Device Lost監視
        this.device.lost.then((info) => {
          console.error('[WebGPU] Device lost:', info.message);
          this.isDeviceLost = true;
          this.initialized = false;
        });

        this.initialized = true;
        this.isDeviceLost = false;

        console.log('✅ [WebGPU] Initialized successfully');
        return true;

      } catch (error) {
        console.error('❌ [WebGPU] Initialization failed:', error);
        this.initialized = false;
        return false;
      }
    }

    getCanvas() {
      if (!this.canvas) {
        throw new Error('[WebGPU] Canvas not initialized');
      }
      return this.canvas;
    }

    getContext() {
      if (!this.context) {
        throw new Error('[WebGPU] Context not initialized');
      }
      return this.context;
    }

    getDevice() {
      if (!this.device || this.isDeviceLost) {
        throw new Error('[WebGPU] Device not available');
      }
      return this.device;
    }

    getQueue() {
      if (!this.queue || this.isDeviceLost) {
        throw new Error('[WebGPU] Queue not available');
      }
      return this.queue;
    }

    getFormat() {
      return this.format;
    }

    getSampleCount() {
      return this.sampleCount;
    }

    isInitialized() {
      return this.initialized && this.device !== null && !this.isDeviceLost;
    }
  }

  window.WebGPUDrawingLayer = new WebGPUDrawingLayer();

  console.log('✅ webgpu-drawing-layer.js Phase 1 loaded');

})();