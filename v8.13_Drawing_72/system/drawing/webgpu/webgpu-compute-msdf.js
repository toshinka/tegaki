/**
 * WebGPUComputeMSDF - Multi-channel SDF Compute Shader管理
 * 
 * Phase 4-B-4: WebGPUでMSDF生成（msdfgen.wasmの代替）
 * RGB 3チャンネルで距離場を並列計算
 * 
 * 責務:
 * - MSDF Compute Shaderのセットアップ
 * - バッファ管理（ポイント、出力、パラメータ）
 * - Compute Pipeline実行
 * - 結果読み取り
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
                // Shader読み込み
                const shaderCode = await this._loadShaderCode();
                
                // Shader Module作成
                this.shaderModule = this.device.createShaderModule({
                    label: 'MSDF Compute Shader',
                    code: shaderCode
                });

                // Bind Group Layout作成
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

                // Pipeline Layout作成
                const pipelineLayout = this.device.createPipelineLayout({
                    label: 'MSDF Pipeline Layout',
                    bindGroupLayouts: [this.bindGroupLayout]
                });

                // Compute Pipeline作成
                this.computePipeline = this.device.createComputePipeline({
                    label: 'MSDF Compute Pipeline',
                    layout: pipelineLayout,
                    compute: {
                        module: this.shaderModule,
                        entryPoint: 'computeMSDF'
                    }
                });

                this.initialized = true;
                console.log('[WebGPUComputeMSDF] Initialized');
            } catch (error) {
                console.error('[WebGPUComputeMSDF] Initialization failed:', error);
                throw error;
            }
        }

        /**
         * MSDF生成
         * @param {Array} points - ストロークポイント [{x, y}]
         * @param {number} width - 出力幅
         * @param {number} height - 出力高さ
         * @param {number} maxDistance - 最大距離
         * @param {number} range - MSDF range (default: 4.0)
         * @returns {Promise<Float32Array>} - RGBA データ
         */
        async generateMSDF(points, width, height, maxDistance, range = 4.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeMSDF not initialized');
            }

            if (points.length < 2) {
                console.warn('[WebGPUComputeMSDF] Not enough points');
                return null;
            }

            try {
                // バッファ作成
                const buffers = this._createBuffers(points, width, height, maxDistance, range);

                // Compute実行
                const commandEncoder = this.device.createCommandEncoder({
                    label: 'MSDF Compute Encoder'
                });

                const computePass = commandEncoder.beginComputePass({
                    label: 'MSDF Compute Pass'
                });

                computePass.setPipeline(this.computePipeline);
                computePass.setBindGroup(0, buffers.bindGroup);

                // Workgroup数計算
                const workgroupSizeX = 8;
                const workgroupSizeY = 8;
                const workgroupCountX = Math.ceil(width / workgroupSizeX);
                const workgroupCountY = Math.ceil(height / workgroupSizeY);

                computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY, 1);
                computePass.end();

                // コマンド送信
                this.device.queue.submit([commandEncoder.finish()]);

                // 結果読み取り
                const result = await this._readResult(buffers.outputBuffer, width * height * 4);

                // クリーンアップ
                buffers.pointsBuffer.destroy();
                buffers.outputBuffer.destroy();
                buffers.paramsBuffer.destroy();
                buffers.stagingBuffer.destroy();

                return result;
            } catch (error) {
                console.error('[WebGPUComputeMSDF] Generation failed:', error);
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
                label: 'MSDF Points Buffer',
                size: pointsData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(pointsBuffer, 0, pointsData);

            // Output Buffer
            const outputSize = width * height * 4 * Float32Array.BYTES_PER_ELEMENT;
            const outputBuffer = this.device.createBuffer({
                label: 'MSDF Output Buffer',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            // Params Buffer
            const paramsData = new Float32Array(8);
            paramsData[0] = width;
            paramsData[1] = height;
            paramsData[2] = points.length;
            paramsData[3] = maxDistance;
            paramsData[4] = range;

            const paramsBuffer = this.device.createBuffer({
                label: 'MSDF Params Buffer',
                size: paramsData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            // Bind Group作成
            const bindGroup = this.device.createBindGroup({
                label: 'MSDF Bind Group',
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: pointsBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            // Staging Buffer（結果読み取り用）
            const stagingBuffer = this.device.createBuffer({
                label: 'MSDF Staging Buffer',
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
         * 結果読み取り
         */
        async _readResult(outputBuffer, size) {
            // Staging Bufferにコピー
            const commandEncoder = this.device.createCommandEncoder({
                label: 'MSDF Copy Encoder'
            });

            const stagingBuffer = this.device.createBuffer({
                label: 'MSDF Staging Buffer',
                size: size * Float32Array.BYTES_PER_ELEMENT,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
            });

            commandEncoder.copyBufferToBuffer(
                outputBuffer, 0,
                stagingBuffer, 0,
                size * Float32Array.BYTES_PER_ELEMENT
            );

            this.device.queue.submit([commandEncoder.finish()]);

            // Map & Read
            await stagingBuffer.mapAsync(GPUMapMode.READ);
            const copyArrayBuffer = stagingBuffer.getMappedRange();
            const data = new Float32Array(copyArrayBuffer).slice();
            stagingBuffer.unmap();
            stagingBuffer.destroy();

            return data;
        }

        /**
         * Shader Code読み込み
         */
        async _loadShaderCode() {
            try {
                const response = await fetch('system/drawing/webgpu/processing/msdf-compute.wgsl');
                if (!response.ok) {
                    throw new Error(`Shader load failed: ${response.status}`);
                }
                return await response.text();
            } catch (error) {
                console.error('[WebGPUComputeMSDF] Shader load failed:', error);
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

    console.log('✅ system/drawing/webgpu/webgpu-compute-msdf.js loaded');

})();