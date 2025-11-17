/**
 * ================================================================================
 * webgpu-drawing-layer.js - Phase B-1: アダプタ取得問題修正版
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
 * 【Phase B-1改修内容】
 * 🔧 requestAdapter()をオプションなしで試行
 * 🔧 フォールバック処理の追加
 * 🔥 sampleCount: 1 (MSAA無効化維持)
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
        if (!navigator.gpu) {
          throw new Error('WebGPU not supported');
        }

        // 🔧 Phase B-1: まずオプションなしで試行
        this.adapter = await navigator.gpu.requestAdapter();

        // フォールバック: high-performanceを試行
        if (!this.adapter) {
          console.log('[WebGPU] Retrying with high-performance...');
          this.adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance'
          });
        }

        // フォールバック: low-powerを試行
        if (!this.adapter) {
          console.log('[WebGPU] Retrying with low-power...');
          this.adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'low-power'
          });
        }

        if (!this.adapter) {
          throw new Error('Failed to get WebGPU adapter after all attempts');
        }

        console.log('[WebGPU] Adapter obtained:', this.adapter);
        console.log('[WebGPU] Adapter limits:', this.adapter.limits);

        this.device = await this.adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {}
        });

        this.queue = this.device.queue;

        this.device.addEventListener('uncapturederror', (event) => {
          console.error('[WebGPU] Uncaptured error:', event.error);
          
          if (event.error.message && 
              (event.error.message.includes('Device') || 
               event.error.message.includes('lost') ||
               event.error.message.includes('DEVICE_HUNG'))) {
            this._handleDeviceLost('Uncaptured error indicates device loss');
          }
        });

        this.device.lost.then((info) => {
          console.error('[WebGPU] Device Lost:', info);
          this._handleDeviceLost(info.reason || 'Unknown reason');
        });

        this.initialized = true;
        this.isDeviceLost = false;
        this.reinitAttempts = 0;

        console.log('✅ [WebGPUDrawingLayer] Phase B-1 Initialized');
        console.log('   📊 Device:', this.device);
        console.log('   📊 Format:', this.format);
        console.log('   🔥 MSAA sampleCount: 1 (無効化)');

        return true;

      } catch (error) {
        console.error('❌ [WebGPUDrawingLayer] Initialization failed:', error);
        this.initialized = false;
        this.isDeviceLost = true;
        return false;
      }
    }

    _handleDeviceLost(reason) {
      console.error(`[WebGPU] Device Lost detected: ${reason}`);
      
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
        console.log(`[WebGPU] Auto-reinitialization attempt ${this.reinitAttempts}/${this.maxReinitAttempts}`);
        
        setTimeout(() => {
          this._attemptReinitialize();
        }, 2000 * this.reinitAttempts);
      } else {
        console.error('[WebGPU] Max reinit attempts reached. Manual page reload required.');
        this._showFatalError();
      }
    }

    async _attemptReinitialize() {
      console.log('[WebGPU] Attempting reinitialization...');
      
      if (this.device) {
        try {
          this.device.destroy();
        } catch (e) {
          console.warn('[WebGPU] Device destroy failed:', e);
        }
      }
      
      this.device = null;
      this.queue = null;
      this.adapter = null;
      
      const success = await this.initialize();
      
      if (success) {
        console.log('✅ [WebGPU] Reinitialization successful');
        
        this._reinitializeDependencies();
        
        if (window.TegakiEventBus) {
          window.TegakiEventBus.emit('webgpu:reinitialized', {
            attempt: this.reinitAttempts
          });
        }
      } else {
        console.error('❌ [WebGPU] Reinitialization failed');
      }
    }

    _reinitializeDependencies() {
      if (window.MSDFPipelineManager) {
        window.MSDFPipelineManager.initialized = false;
        window.MSDFPipelineManager.initialize(
          this.device,
          this.format,
          this.sampleCount
        );
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
      const message = `GPU rendering has been interrupted. Attempting to recover...`;
      
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('ui:show-notification', {
          message: message,
          type: 'warning',
          duration: 5000
        });
      }
    }

    _showFatalError() {
      const message = 
        'GPU rendering has failed and cannot be recovered automatically.\n' +
        'Please save your work and reload the page.\n\n' +
        'Press OK to reload now, or Cancel to continue without GPU acceleration.';
      
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('ui:show-error', {
          message: 'GPU rendering failed. Please reload the page.',
          fatal: true
        });
      }
      
      if (confirm(message)) {
        window.location.reload();
      }
    }

    getDevice() {
      if (!this.initialized || !this.device || this.isDeviceLost) {
        throw new Error('[WebGPUDrawingLayer] Device not available');
      }
      return this.device;
    }

    getQueue() {
      if (!this.initialized || !this.queue || this.isDeviceLost) {
        throw new Error('[WebGPUDrawingLayer] Queue not available');
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

    isDeviceHealthy() {
      if (!this.device || !this.initialized || this.isDeviceLost) {
        return false;
      }
      
      try {
        return this.device.lost !== undefined;
      } catch (e) {
        return false;
      }
    }

    destroy() {
      if (this.device) {
        try {
          this.device.destroy();
        } catch (e) {
          console.warn('[WebGPU] Device destroy failed:', e);
        }
        this.device = null;
      }
      this.queue = null;
      this.adapter = null;
      this.initialized = false;
      this.isDeviceLost = false;
    }
  }

  window.WebGPUDrawingLayer = new WebGPUDrawingLayer();

  console.log('✅ webgpu-drawing-layer.js Phase B-1 loaded');
  console.log('   🔧 アダプタ取得問題修正');

})();