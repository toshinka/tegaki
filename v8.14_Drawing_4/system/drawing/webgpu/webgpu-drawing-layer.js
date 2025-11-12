/**
 * WebGPUDrawingLayer - WebGPU基盤・SDF/MSDF Compute統合
 * Phase 4-A-1 + 4-B-4: WebGPU基盤構築 + MSDF統合
 * 
 * 責務:
 * - WebGPUデバイス/アダプター管理
 * - SDF/MSDF Compute Shader統合
 * - リソース管理
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
            
            // Compute Shader管理
            this.sdfCompute = null;
            this.msdfCompute = null;
        }

        /**
         * WebGPU初期化
         */
        async initialize() {
            if (this.initialized) {
                return true;
            }

            if (!navigator.gpu) {
                console.error('[WebGPU] Not supported');
                return false;
            }

            try {
                this.adapter = await navigator.gpu.requestAdapter({
                    powerPreference: 'high-performance'
                });

                if (!this.adapter) {
                    throw new Error('Adapter not available');
                }

                this.device = await this.adapter.requestDevice();
                
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

                // SDF Compute初期化
                if (window.WebGPUComputeSDF) {
                    this.sdfCompute = new WebGPUComputeSDF(this);
                    await this.sdfCompute.initialize();
                }

                // MSDF Compute初期化
                if (window.WebGPUComputeMSDF) {
                    this.msdfCompute = new WebGPUComputeMSDF(this);
                    await this.msdfCompute.initialize();
                }

                this.initialized = true;

                return true;

            } catch (error) {
                console.error('[WebGPU] Init failed:', error);
                return false;
            }
        }

        /**
         * SDF生成（シングルチャンネル）
         */
        async generateSDF(points, width, height, maxDistance = 64) {
            if (!this.sdfCompute) {
                throw new Error('SDF Compute not initialized');
            }
            return await this.sdfCompute.generateSDF(points, width, height, maxDistance);
        }

        /**
         * MSDF生成（マルチチャンネル）
         */
        async generateMSDF(points, width, height, maxDistance = 64, range = 4.0) {
            if (!this.msdfCompute) {
                throw new Error('MSDF Compute not initialized');
            }
            return await this.msdfCompute.generateMSDF(points, width, height, maxDistance, range);
        }

        /**
         * Compute Pipeline作成
         */
        createComputePipeline(shaderCode, entryPoint = 'main', bindGroupLayouts = []) {
            if (!this.device) {
                throw new Error('Device not initialized');
            }

            const shaderModule = this.device.createShaderModule({
                code: shaderCode
            });

            const pipelineLayout = this.device.createPipelineLayout({
                bindGroupLayouts: bindGroupLayouts
            });

            return this.device.createComputePipeline({
                layout: pipelineLayout,
                compute: {
                    module: shaderModule,
                    entryPoint: entryPoint
                }
            });
        }

        /**
         * Render Pipeline作成
         */
        createRenderPipeline(vertexShader, fragmentShader, vertexBuffers = [], format = null) {
            if (!this.device) {
                throw new Error('Device not initialized');
            }

            const targetFormat = format || this.format || 'bgra8unorm';

            const vertexModule = this.device.createShaderModule({ code: vertexShader });
            const fragmentModule = this.device.createShaderModule({ code: fragmentShader });

            return this.device.createRenderPipeline({
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
        }

        /**
         * Buffer作成
         */
        createBuffer(size, usage) {
            if (!this.device) {
                throw new Error('Device not initialized');
            }
            return this.device.createBuffer({ size, usage });
        }

        /**
         * Texture作成
         */
        createTexture(width, height, format = 'rgba8unorm', usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST) {
            if (!this.device) {
                throw new Error('Device not initialized');
            }
            return this.device.createTexture({
                size: { width, height },
                format,
                usage
            });
        }

        /**
         * Command Encoder作成
         */
        createCommandEncoder() {
            if (!this.device) {
                throw new Error('Device not initialized');
            }
            return this.device.createCommandEncoder();
        }

        /**
         * 初期化状態チェック
         */
        isInitialized() {
            return this.initialized && this.device !== null;
        }

        /**
         * MSDF対応チェック
         */
        isMSDFSupported() {
            return this.initialized && this.msdfCompute !== null;
        }

        /**
         * リソース破棄
         */
        destroy() {
            if (this.sdfCompute) {
                this.sdfCompute.destroy();
                this.sdfCompute = null;
            }

            if (this.msdfCompute) {
                this.msdfCompute.destroy();
                this.msdfCompute = null;
            }

            if (this.device) {
                this.device.destroy();
                this.device = null;
            }

            this.adapter = null;
            this.context = null;
            this.initialized = false;
        }
    }

    window.WebGPUDrawingLayer = WebGPUDrawingLayer;

})();