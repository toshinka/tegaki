/**
 * WebGPUComputeMSDF - Multi-channel SDF Compute Shader管理
 * Phase 4-B-4: WebGPUでMSDF生成（完全版）
 * 
 * 責務:
 * - RGB 3チャンネル距離場の並列計算
 * - エッジ精度向上（角・交差部の完璧な表現）
 * - Compute Pipeline管理
 */

(function() {
    'use strict';

    class WebGPUComputeMSDF {
        constructor(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            this.device = webgpuLayer.device;
            this.shaderModule = null;
            this.computePipeline = null;
            this.bindGroupLayout = null;
            this.initialized = false;
        }

        /**
         * 初期化: Compute Pipeline作成
         */
        async initialize() {
            try {
                const shaderCode = await this._loadShaderCode();
                
                this.shaderModule = this.device.createShaderModule({
                    label: 'MSDF Compute Shader',
                    code: shaderCode
                });

                this.bindGroupLayout = this.device.createBindGroupLayout({
                    label: 'MSDF Bind Group Layout',
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.COMPUTE,
                            buffer: { type: 'read-only-storage' }
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.COMPUTE,
                            buffer: { type: 'storage' }
                        },
                        {
                            binding: 2,
                            visibility: GPUShaderStage.COMPUTE,
                            buffer: { type: 'uniform' }
                        }
                    ]
                });

                const pipelineLayout = this.device.createPipelineLayout({
                    label: 'MSDF Pipeline Layout',
                    bindGroupLayouts: [this.bindGroupLayout]
                });

                this.computePipeline = this.device.createComputePipeline({
                    label: 'MSDF Compute Pipeline',
                    layout: pipelineLayout,
                    compute: {
                        module: this.shaderModule,
                        entryPoint: 'computeMSDF'
                    }
                });

                this.initialized = true;

            } catch (error) {
                console.error('[MSDF] Init failed:', error);
                throw error;
            }
        }

        /**
         * MSDF生成
         * @param {Array} points - [{x, y}]
         * @param {number} width - 出力幅
         * @param {number} height - 出力高さ
         * @param {number} maxDistance - 最大距離
         * @param {number} range - MSDF range (default: 4.0)
         * @returns {Promise<Float32Array>} RGBA データ
         */
        async generateMSDF(points, width, height, maxDistance = 64, range = 4.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeMSDF not initialized');
            }

            if (points.length < 2) {
                console.warn('[MSDF] Insufficient points');
                return null;
            }

            try {
                const buffers = this._createBuffers(points, width, height, maxDistance, range);

                const commandEncoder = this.device.createCommandEncoder({
                    label: 'MSDF Compute Encoder'
                });

                const computePass = commandEncoder.beginComputePass({
                    label: 'MSDF Compute Pass'
                });

                computePass.setPipeline(this.computePipeline);
                computePass.setBindGroup(0, buffers.bindGroup);

                const workgroupCountX = Math.ceil(width / 8);
                const workgroupCountY = Math.ceil(height / 8);
                computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
                computePass.end();

                // Staging bufferへコピー
                commandEncoder.copyBufferToBuffer(
                    buffers.outputBuffer, 0,
                    buffers.stagingBuffer, 0,
                    buffers.outputBuffer.size
                );

                this.device.queue.submit([commandEncoder.finish()]);

                // 結果読み取り
                await buffers.stagingBuffer.mapAsync(GPUMapMode.READ);
                const data = new Float32Array(buffers.stagingBuffer.getMappedRange()).slice();
                buffers.stagingBuffer.unmap();

                // クリーンアップ
                buffers.pointsBuffer.destroy();
                buffers.outputBuffer.destroy();
                buffers.paramsBuffer.destroy();
                buffers.stagingBuffer.destroy();

                return data;

            } catch (error) {
                console.error('[MSDF] Generation failed:', error);
                return null;
            }
        }

        /**
         * バッファ作成
         */
        _createBuffers(points, width, height, maxDistance, range) {
            // Points Buffer
            const pointsData = new Float32Array(points.length * 2);
            points.forEach((p, i) => {
                pointsData[i * 2] = p.x;
                pointsData[i * 2 + 1] = p.y;
            });

            const pointsBuffer = this.device.createBuffer({
                label: 'MSDF Points',
                size: Math.max(pointsData.byteLength, 16),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(pointsBuffer, 0, pointsData);

            // Output Buffer
            const outputSize = width * height * 4 * Float32Array.BYTES_PER_ELEMENT;
            const outputBuffer = this.device.createBuffer({
                label: 'MSDF Output',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            // Params Buffer (32バイト境界アライン)
            const paramsData = new Float32Array(16);
            const view = new Uint32Array(paramsData.buffer);
            view[0] = width;
            view[1] = height;
            view[2] = points.length;
            paramsData[3] = maxDistance;
            paramsData[4] = range;

            const paramsBuffer = this.device.createBuffer({
                label: 'MSDF Params',
                size: paramsData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            // Bind Group
            const bindGroup = this.device.createBindGroup({
                label: 'MSDF Bind Group',
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: pointsBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            // Staging Buffer
            const stagingBuffer = this.device.createBuffer({
                label: 'MSDF Staging',
                size: outputSize,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
            });

            return {
                pointsBuffer,
                outputBuffer,
                paramsBuffer,
                bindGroup,
                stagingBuffer
            };
        }

        /**
         * Shader読み込み
         */
        async _loadShaderCode() {
            try {
                const response = await fetch('system/drawing/webgpu/shaders/msdf-compute.wgsl');
                if (!response.ok) {
                    throw new Error(`Shader load failed: ${response.status}`);
                }
                return await response.text();
            } catch (error) {
                console.error('[MSDF] Shader load failed:', error);
                throw error;
            }
        }

        /**
         * クリーンアップ
         */
        destroy() {
            this.shaderModule = null;
            this.computePipeline = null;
            this.bindGroupLayout = null;
            this.initialized = false;
        }
    }

    window.WebGPUComputeMSDF = WebGPUComputeMSDF;

})();