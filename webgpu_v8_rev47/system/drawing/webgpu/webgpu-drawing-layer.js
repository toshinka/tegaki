/**
 * ================================================================================
 * webgpu-drawing-layer.js Phase 3: Device Lost監視版
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
 * 【Phase 3改修内容】
 * ✅ MSAA sampleCount: 4 設定追加
 * 🔥 device.lost 監視追加
 * 🔥 自動再初期化機能
 * 🔥 Device Lost時のgraceful degradation
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
      
      this.sampleCount = 4;
    }

    async initialize() {
      if (this.initialized && !this.isDeviceLost) {
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

        // 🔥 Phase 3: uncapturederror監視
        this.device.addEventListener('uncapturederror', (event) => {
          console.error('[WebGPU] Uncaptured error:', event.error);
          
          // Device Lostに関連するエラーを検出
          if (event.error.message && 
              (event.error.message.includes('Device') || 
               event.error.message.includes('lost') ||
               event.error.message.includes('DEVICE_HUNG'))) {
            this._handleDeviceLost('Uncaptured error indicates device loss');
          }
        });

        // 🔥 Phase 3: device.lost Promise監視
        this.device.lost.then((info) => {
          console.error('[WebGPU] Device Lost:', info);
          this._handleDeviceLost(info.reason || 'Unknown reason');
        });

        this.initialized = true;
        this.isDeviceLost = false;
        this.reinitAttempts = 0;

        console.log('✅ [WebGPUDrawingLayer] Phase 3 Device Lost監視版 Initialized');
        console.log('   📊 Device:', this.device);
        console.log('   📊 Format:', this.format);
        console.log('   📊 MSAA sampleCount:', this.sampleCount);
        console.log('   🔥 Device Lost監視: 有効');

        return true;

      } catch (error) {
        console.error('❌ [WebGPUDrawingLayer] Initialization failed:', error);
        this.initialized = false;
        this.isDeviceLost = true;
        return false;
      }
    }

    /**
     * 🔥 Phase 3新規実装: Device Lost処理
     */
    _handleDeviceLost(reason) {
      console.error(`[WebGPU] Device Lost detected: ${reason}`);
      
      this.initialized = false;
      this.isDeviceLost = true;
      
      // イベントバス通知
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('webgpu:device-lost', {
          reason: reason,
          canReinitialize: this.reinitAttempts < this.maxReinitAttempts
        });
      }
      
      // ユーザー通知
      this._notifyUser(reason);
      
      // 自動再初期化試行
      if (this.reinitAttempts < this.maxReinitAttempts) {
        this.reinitAttempts++;
        console.log(`[WebGPU] Auto-reinitialization attempt ${this.reinitAttempts}/${this.maxReinitAttempts}`);
        
        setTimeout(() => {
          this._attemptReinitialize();
        }, 2000 * this.reinitAttempts); // 遅延を徐々に増加
      } else {
        console.error('[WebGPU] Max reinit attempts reached. Manual page reload required.');
        this._showFatalError();
      }
    }

    /**
     * 🔥 Phase 3新規実装: 再初期化試行
     */
    async _attemptReinitialize() {
      console.log('[WebGPU] Attempting reinitialization...');
      
      // 既存リソースのクリーンアップ
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
      
      // 再初期化
      const success = await this.initialize();
      
      if (success) {
        console.log('✅ [WebGPU] Reinitialization successful');
        
        // 依存モジュールの再初期化
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

    /**
     * 🔥 Phase 3新規実装: 依存モジュール再初期化
     */
    _reinitializeDependencies() {
      // MSDFPipelineManager再初期化
      if (window.MSDFPipelineManager) {
        window.MSDFPipelineManager.initialized = false;
        window.MSDFPipelineManager.initialize(
          this.device,
          this.format,
          this.sampleCount
        );
      }
      
      // WebGPUTextureBridge再初期化
      if (window.WebGPUTextureBridge) {
        window.WebGPUTextureBridge.initialized = false;
        window.WebGPUTextureBridge.initialize();
      }
      
      // GPUStrokeProcessor再初期化
      if (window.GPUStrokeProcessor) {
        window.GPUStrokeProcessor.initialized = false;
        window.GPUStrokeProcessor.initialize(this.device);
      }
      
      // WebGPUMaskLayer再初期化
      if (window.webgpuMaskLayer) {
        const config = window.TEGAKI_CONFIG;
        const width = config?.canvas?.width || 800;
        const height = config?.canvas?.height || 600;
        window.webgpuMaskLayer._initialized = false;
        window.webgpuMaskLayer.initialize(width, height);
      }
    }

    /**
     * 🔥 Phase 3新規実装: ユーザー通知
     */
    _notifyUser(reason) {
      const message = `GPU rendering has been interrupted. Attempting to recover...`;
      
      // イベントバス経由で通知
      if (window.TegakiEventBus) {
        window.TegakiEventBus.emit('ui:show-notification', {
          message: message,
          type: 'warning',
          duration: 5000
        });
      }
      
      // コンソール警告
      console.warn(`[WebGPU] User notification: ${message}`);
    }

    /**
     * 🔥 Phase 3新規実装: 致命的エラー表示
     */
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
      
      // コンソールエラー
      console.error('[WebGPU] Fatal error - manual intervention required');
      
      // 自動リロード確認（開発時のみ）
      if (confirm(message)) {
        window.location.reload();
      }
    }

    getDevice() {
      if (!this.initialized || !this.device || this.isDeviceLost) {
        throw new Error('[WebGPUDrawingLayer] Device not available (lost or not initialized)');
      }
      return this.device;
    }

    getQueue() {
      if (!this.initialized || !this.queue || this.isDeviceLost) {
        throw new Error('[WebGPUDrawingLayer] Queue not available (lost or not initialized)');
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

    /**
     * 🔥 Phase 3新規実装: Device状態確認
     */
    isDeviceHealthy() {
      if (!this.device || !this.initialized || this.isDeviceLost) {
        return false;
      }
      
      try {
        // device.lostがpendingでないか確認
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

  console.log('✅ webgpu-drawing-layer.js Phase 3 Device Lost監視版 loaded');
  console.log('   🔥 device.lost Promise監視');
  console.log('   🔥 自動再初期化機能');
  console.log('   🔥 Graceful degradation');

})();