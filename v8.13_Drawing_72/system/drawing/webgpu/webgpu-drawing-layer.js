/**
 * WebGPUDrawingLayer - WebGPU初期化・デバイス管理・コンテキスト設定
 * Phase 4-A-1: WebGPU基盤構築
 * 
 * 責務:
 * - WebGPUデバイス/アダプターの取得
 * - Canvas WebGPUコンテキスト設定
 * - Render/Compute Pipeline管理
 * - リソース破棄
 */

(function() {
    'use strict';

    class WebGPUDrawingLayer {
        constructor(canvas = null) {
            this.canvas = canvas;
            this.adapter = null;
            this.device = null;
            this.context = null;
            this.format = null;
            this.initialized = false;
            this.pipelines = new Map();
        }

        /**
         * WebGPU初期化
         * @returns {Promise<boolean>}
         */
        async initialize() {
            if (this.initialized) {
                console.warn('[WebGPU] Already initialized');
                return true;
            }

            if (!navigator.gpu) {
                console.error('[WebGPU] WebGPU not supported');
                return false;
            }

            try {
                // Adapter取得
                this.adapter = await navigator.gpu.requestAdapter({
                    powerPreference: 'high-performance'
                });

                if (!this.adapter) {
                    console.error('[WebGPU] Failed to get adapter');
                    return false;
                }

                // Device取得
                this.device = await this.adapter.requestDevice();
                
                if (!this.device) {
                    console.error('[WebGPU] Failed to get device');
                    return false;
                }

                // デバイスロストハンドリング
                this.device.lost.then((info) => {
                    console.error('[WebGPU] Device lost:', info.message);
                    this.initialized = false;
                });

                // Canvasコンテキスト設定（オプション）
                if (this.canvas) {
                    this.context = this.canvas.getContext('webgpu');
                    this.format = navigator.gpu.getPreferredCanvasFormat();
                    
                    this.context.configure({
                        device: this.device,
                        format: this.format,
                        alphaMode: 'premultiplied'
                    });
                }

                this.initialized = true;
                console.log('[WebGPU] Initialized successfully', {
                    adapter: this.adapter.info || 'info not available',
                    limits: this.device.limits,
                    features: Array.from(this.adapter.features)
                });

                return true;

            } catch (error) {
                console.error('[WebGPU] Initialization failed:', error);
                return false;
            }
        }

        /**
         * Compute Pipeline作成
         * @param {string} shaderCode - WGSL shader code
         * @param {string} entryPoint - エントリーポイント名
         * @param {Array} bindGroupLayouts - Bind Group Layouts
         * @returns {GPUComputePipeline}
         */
        createComputePipeline(shaderCode, entryPoint = 'main', bindGroupLayouts = []) {
            if (!this.device) {
                throw new Error('[WebGPU] Device not initialized');
            }

            const shaderModule = this.device.createShaderModule({
                code: shaderCode
            });

            const pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: bindGroupLayouts
            });

            const pipeline = this.device.createComputePipeline({
                layout: pipelineLayout,
                compute: {
                    module: shaderModule,
                    entryPoint: entryPoint
                }
            });

            return pipeline;
        }

        /**
         * Render Pipeline作成（将来の拡張用）
         * @param {string} vertexShader - Vertex shader WGSL
         * @param {string} fragmentShader - Fragment shader WGSL
         * @param {GPUVertexBufferLayout[]} vertexBuffers
         * @param {GPUTextureFormat} format
         * @returns {GPURenderPipeline}
         */
        createRenderPipeline(vertexShader, fragmentShader, vertexBuffers = [], format = null) {
            if (!this.device) {
                throw new Error('[WebGPU] Device not initialized');
            }

            const targetFormat = format || this.format || 'bgra8unorm';

            const vertexModule = this.device.createShaderModule({ code: vertexShader });
            const fragmentModule = this.device.createShaderModule({ code: fragmentShader });

            const pipeline = this.device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: vertexModule,
                    entryPoint: 'main',
                    buffers: vertexBuffers
                },
                fragment: {
                    module: fragmentModule,
                    entryPoint: 'main',
                    targets: [{
                        format: targetFormat
                    }]
                },
                primitive: {
                    topology: 'triangle-list'
                }
            });

            return pipeline;
        }

        /**
         * Buffer作成
         * @param {number} size - バイトサイズ
         * @param {GPUBufferUsageFlags} usage - 使用方法
         * @returns {GPUBuffer}
         */
        createBuffer(size, usage) {
            if (!this.device) {
                throw new Error('[WebGPU] Device not initialized');
            }

            return this.device.createBuffer({
                size: size,
                usage: usage,
                mappedAtCreation: false
            });
        }

        /**
         * Texture作成
         * @param {number} width
         * @param {number} height
         * @param {GPUTextureFormat} format
         * @param {GPUTextureUsageFlags} usage
         * @returns {GPUTexture}
         */
        createTexture(width, height, format = 'rgba8unorm', usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST) {
            if (!this.device) {
                throw new Error('[WebGPU] Device not initialized');
            }

            return this.device.createTexture({
                size: { width, height },
                format: format,
                usage: usage
            });
        }

        /**
         * Command Encoder作成
         * @returns {GPUCommandEncoder}
         */
        createCommandEncoder() {
            if (!this.device) {
                throw new Error('[WebGPU] Device not initialized');
            }
            return this.device.createCommandEncoder();
        }

        /**
         * 初期化状態チェック
         * @returns {boolean}
         */
        isInitialized() {
            return this.initialized && this.device !== null;
        }

        /**
         * デバイス取得
         * @returns {GPUDevice}
         */
        getDevice() {
            return this.device;
        }

        /**
         * Adapter取得
         * @returns {GPUAdapter}
         */
        getAdapter() {
            return this.adapter;
        }

        /**
         * リソース破棄
         */
        destroy() {
            if (this.device) {
                this.device.destroy();
                this.device = null;
            }

            this.adapter = null;
            this.context = null;
            this.initialized = false;
            this.pipelines.clear();

            console.log('[WebGPU] Resources destroyed');
        }
    }

    // グローバル登録
    window.WebGPUDrawingLayer = WebGPUDrawingLayer;

    console.log('✅ system/drawing/webgpu/webgpu-drawing-layer.js loaded');

})();