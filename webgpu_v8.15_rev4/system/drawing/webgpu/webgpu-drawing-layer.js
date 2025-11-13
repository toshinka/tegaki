/**
 * ================================================================================
 * webgpu-drawing-layer.js - WebGPU Drawing Layer (Phase 2完全版)
 * ================================================================================
 * 
 * 【責務】
 * - WebGPU初期化・デバイス管理
 * - GPUDevice/Queue のグローバル公開
 * - WebGPUCapabilities統合
 * 
 * 【依存Parents】
 * - webgpu-capabilities.js (機能検出)
 * 
 * 【依存Children】
 * - webgpu-compute-sdf.js (SDF生成)
 * - webgpu-mask-layer.js (マスク管理)
 * - webgpu-texture-bridge.js (テクスチャ変換)
 * - stroke-renderer.js (描画処理)
 * 
 * ================================================================================
 */

class WebGPUDrawingLayer {
    constructor() {
        this.device = null;
        this.queue = null;
        this.adapter = null;
        this.context = null;
        this.initialized = false;
    }

    /**
     * WebGPU初期化
     */
    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            // WebGPU対応チェック
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported');
            }

            // アダプター取得
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!this.adapter) {
                throw new Error('Failed to get WebGPU adapter');
            }

            // デバイス取得
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

            // エラーハンドリング
            this.device.addEventListener('uncapturederror', (event) => {
                console.error('[WebGPU] Uncaptured error:', event.error);
            });

            this.initialized = true;

            console.log('✅ [WebGPUDrawingLayer] Initialized');
            console.log('   📊 Device:', this.device);
            console.log('   📊 Adapter:', this.adapter);

            return true;

        } catch (error) {
            console.error('[WebGPUDrawingLayer] Initialization failed:', error);
            this.initialized = false;
            return false;
        }
    }

    /**
     * GPUDevice取得
     */
    getDevice() {
        if (!this.initialized || !this.device) {
            throw new Error('[WebGPUDrawingLayer] Device not initialized');
        }
        return this.device;
    }

    /**
     * GPUQueue取得
     */
    getQueue() {
        if (!this.initialized || !this.queue) {
            throw new Error('[WebGPUDrawingLayer] Queue not initialized');
        }
        return this.queue;
    }

    /**
     * 初期化状態確認
     */
    isInitialized() {
        return this.initialized && this.device !== null;
    }

    /**
     * クリーンアップ
     */
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

// グローバル公開
if (!window.webgpuDrawingLayer) {
    window.webgpuDrawingLayer = new WebGPUDrawingLayer();
}