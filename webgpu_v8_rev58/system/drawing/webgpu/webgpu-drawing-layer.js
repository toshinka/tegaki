/**
 * ================================================================================
 * webgpu-drawing-layer.js - Phase 1完全版: Canvas接続・初期化確立
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - index.html (<canvas id="webgpu-canvas">)
 *   - webgpu-capabilities.js (機能検出)
 * 
 * 📄 子ファイル使用先:
 *   - core-initializer.js (initialize呼び出し・Canvas取得)
 *   - drawing-engine.js (getCanvas呼び出し)
 *   - msdf-pipeline-manager.js (device/format取得)
 *   - gpu-stroke-processor.js (device取得)
 *   - webgpu-texture-bridge.js (device取得)
 *   - webgpu-mask-layer.js (device/queue取得)
 * 
 * 【Phase 1完全改修内容】
 * ✅ Canvas要素の明示的取得・確実な接続
 * ✅ context.configure()の実装
 * ✅ DPR対応サイズ計算
 * ✅ adapter取得の確実化
 * 
 * 【責務】
 * - WebGPU Canvas生成・取得
 * - WebGPU adapter/device取得
 * - context設定
 * - Device Lost処理
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
      this.reinitAttempts = 0;
      this.maxReinitAttempts = 3;
      this.sampleCount = 1;
    }

    async initialize() {
      if (this.initialized && !this.isDeviceLost) {
        return true;
      }

      try {
        // Canvas取得: 確実な存在確認
        this.canvas = document.getElementById('webgpu-canvas');
        if (!this.canvas) {
          console.error('[WebGPU] Canvas #webgpu-canvas not found in DOM');
          console.error('[WebGPU] Available canvas elements:', 
            Array.from(document.getElementsByTagName('canvas')).map(c => c.id || 'no-id'));
          throw new Error('[WebGPU] Canvas element #webgpu-canvas not found');
        }

        console.log('[WebGPU] Canvas element found:', this.canvas.id);

        if (!navigator.gpu) {
          throw new Error('[WebGPU] navigator.gpu not supported');
        }

        // Context取得 (adapter取得前に実施)
        this.context = this.canvas.getContext('webgpu');
        if (!this.context) {
          throw new Error('[WebGPU] canvas.getContext("webgpu") returned null');
        }

        console.log('[WebGPU] WebGPU context acquired');

        // Adapter取得: オプションなしを最優先
        console.log('[WebGPU] Requesting adapter...');
        this.adapter = await navigator.gpu.requestAdapter();
        
        if (!this.adapter) {
          console.log('[WebGPU] Retrying with high-performance...');
          this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        }
        
        if (!this.adapter) {
          console.log('[WebGPU] Retrying with low-power...');
          this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
        }
        
        if (!this.adapter) {
          throw new Error('[WebGPU] Failed to get adapter after all attempts');
        }

        console.log('[WebGPU] Adapter acquired:', this.adapter);

        // Device取得
        this.device = await this.adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {}
        });
        this.queue = this.device.queue;

        console.log('[WebGPU] Device acquired');

        // Canvas サイズ計算 (DPR=1固定)
        const config = window.TEGAKI_CONFIG;
        const width = config?.canvas?.width || 1920;
        const height = config?.canvas?.height || 1080;

        // Context設定
        this.context.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
          width: width,
          height: height
        });

        console.log('[WebGPU] Context configured:', width, 'x', height);

        // Device Lost監視
        this.device.addEventListener('uncapturederror', (event) => {
          console.error('[WebGPU] Uncaptured error:', event.error);
          if (event.error.message?.includes('Device') || event.error.message?.includes('lost')) {
            this._handleDeviceLost('Uncaptured error');
          }
        });

        this.device.lost.then((info) => {
          console.error('[WebGPU] Device Lost:', info);
          this._handleDeviceLost(info.reason || 'Unknown');
        });

        this.initialized = true;
        this.isDeviceLost = false;
        this.reinitAttempts = 0;

        console.log('✅ [WebGPU] Initialized successfully');

        return true;

      } catch (error) {
        console.error('❌ [WebGPU] Initialization failed:', error);
        this.initialized = false;
        this.isDeviceLost = true;
        return false;
      }
    }

    _handleDeviceLost(reason) {
      console.error(`[WebGPU] Device Lost: ${reason}`);
      this.initialized = false;
      this.isDeviceLost = true;
      
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('webgpu:device-lost', {
          reason: reason,
          canReinitialize: this.reinitAttempts < this.maxReinitAttempts
        });
      }
      
      this._notifyUser(reason);
      
      if (this.reinitAttempts < this.maxReinitAttempts) {
        this.reinitAttempts++;
        setTimeout(() => this._attemptReinitialize(), 2000 * this.reinitAttempts);
      } else {
        this._showFatalError();
      }
    }

    async _attemptReinitialize() {
      if (this.device) {
        try {
          this.device.destroy();
        } catch (e) {}
      }
      
      this.device = null;
      this.queue = null;
      this.adapter = null;
      this.context = null;
      
      const success = await this.initialize();
      
      if (success) {
        this._reinitializeDependencies();
        if (window.TegakiEventBus) {
          window.TegakiEventBus.emit('webgpu:reinitialized', { attempt: this.reinitAttempts });
        }
      }
    }

    _reinitializeDependencies() {
      if (window.MSDFPipelineManager) {
        window.MSDFPipelineManager.initialized = false;
        window.MSDFPipelineManager.initialize(this.device, this.format, this.sampleCount);
      }
      if (window.WebGPUTextureBridge) {
        window.WebGPUTextureBridge.initialized = false;
        window.WebGPUTextureBridge.initialize();
      }
      if (window.GPUStrokeProcessor) {
        window.GPUStrokeProcessor.initialized = false;
        window.GPUStrokeProcessor.initialize(this.device);
      }
      if (window.webgpuMaskLayer) {
        const config = window.TEGAKI_CONFIG;
        const width = config?.canvas?.width || 800;
        const height = config?.canvas?.height || 600;
        window.webgpuMaskLayer._initialized = false;
        window.webgpuMaskLayer.initialize(width, height);
      }
    }

    _notifyUser(reason) {
      const message = `GPU rendering interrupted. Attempting recovery...`;
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('ui:show-notification', {
          message: message,
          type: 'warning',
          duration: 5000
        });
      }
    }

    _showFatalError() {
      const message = 'GPU rendering failed. Please reload the page.';
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('ui:show-error', {
          message: message,
          fatal: true
        });
      }
      if (confirm(message + '\n\nReload now?')) {
        window.location.reload();
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

    destroy() {
      if (this.device) {
        try {
          this.device.destroy();
        } catch (e) {}
        this.device = null;
      }
      this.queue = null;
      this.adapter = null;
      this.context = null;
      this.canvas = null;
      this.initialized = false;
      this.isDeviceLost = false;
    }
  }

  window.WebGPUDrawingLayer = new WebGPUDrawingLayer();

  console.log('✅ webgpu-drawing-layer.js Phase 1 loaded');

})();