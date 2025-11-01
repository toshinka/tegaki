// ================================================================================
// WebGPU Compute SDF Generator - Phase 4-A-2
// ================================================================================
// 役割: Compute ShaderによるSDF距離場生成
// 実装: シェーダー管理・バッファ作成・Dispatch実行・結果取得
// ================================================================================

(function() {
    'use strict';

    class WebGPUComputeSDF {
        constructor(device) {
            this.device = device;
            this.pipeline = null;
            this.bindGroupLayout = null;
            this.shaderModule = null;
            this.initialized = false;
        }

        async initialize() {
            if (this.initialized) return;

            // シェーダーコードを読み込み
            const shaderCode = await this._loadShaderCode();
            
            // シェーダーモジュール作成
            this.shaderModule = this.device.createShaderModule({
                label: 'SDF Compute Shader',
                code: shaderCode
            });

            // Bind Group Layout作成
            this.bindGroupLayout = this.device.createBindGroupLayout({
                label: 'SDF Bind Group Layout',
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
                label: 'SDF Pipeline Layout',
                bindGroupLayouts: [this.bindGroupLayout]
            });

            // Compute Pipeline作成
            this.pipeline = this.device.createComputePipeline({
                label: 'SDF Compute Pipeline',
                layout: pipelineLayout,
                compute: {
                    module: this.shaderModule,
                    entryPoint: 'main'
                }
            });

            this.initialized = true;
        }

        async _loadShaderCode() {
            // WGSLシェーダーコードをインライン定義
            return `
struct SDFParams {
    width: u32,
    height: u32,
    pointCount: u32,
    maxDistance: f32,
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> sdfOutput: array<f32>;
@group(0) @binding(2) var<uniform> params: SDFParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let pixelCoord = vec2f(f32(id.x), f32(id.y));
    var minDist = 999999.0;

    for (var i = 0u; i < params.pointCount; i++) {
        let point = strokePoints[i];
        let dist = distance(pixelCoord, point);
        minDist = min(minDist, dist);
    }

    let normalized = clamp(minDist / params.maxDistance, 0.0, 1.0);
    
    let idx = id.y * params.width + id.x;
    sdfOutput[idx] = normalized;
}
            `;
        }

        async generateSDF(points, width, height, maxDistance = 256.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeSDF not initialized');
            }

            const pointCount = points.length;
            if (pointCount === 0) {
                throw new Error('No points provided');
            }

            // バッファ作成
            const buffers = this._createBuffers(points, width, height, maxDistance);

            // Compute実行
            const commandEncoder = this.device.createCommandEncoder({
                label: 'SDF Compute Encoder'
            });

            const passEncoder = commandEncoder.beginComputePass({
                label: 'SDF Compute Pass'
            });

            passEncoder.setPipeline(this.pipeline);
            passEncoder.setBindGroup(0, buffers.bindGroup);
            
            const workgroupX = Math.ceil(width / 8);
            const workgroupY = Math.ceil(height / 8);
            passEncoder.dispatchWorkgroups(workgroupX, workgroupY, 1);
            
            passEncoder.end();

            // 結果読み取り用バッファにコピー
            commandEncoder.copyBufferToBuffer(
                buffers.outputBuffer,
                0,
                buffers.readBuffer,
                0,
                buffers.outputSize
            );

            this.device.queue.submit([commandEncoder.finish()]);

            // 結果読み取り
            const result = await this._readResult(buffers.readBuffer, buffers.outputSize);

            // クリーンアップ
            buffers.pointBuffer.destroy();
            buffers.outputBuffer.destroy();
            buffers.paramsBuffer.destroy();
            buffers.readBuffer.destroy();

            return result;
        }

        _createBuffers(points, width, height, maxDistance) {
            const pointCount = points.length;
            
            // Points Buffer
            const pointData = new Float32Array(pointCount * 2);
            for (let i = 0; i < pointCount; i++) {
                pointData[i * 2] = points[i].x;
                pointData[i * 2 + 1] = points[i].y;
            }

            const pointBuffer = this.device.createBuffer({
                label: 'Stroke Points Buffer',
                size: pointData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(pointBuffer, 0, pointData);

            // Output Buffer
            const outputSize = width * height * 4; // Float32
            const outputBuffer = this.device.createBuffer({
                label: 'SDF Output Buffer',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            // Params Buffer
            const paramsData = new Uint32Array([
                width,
                height,
                pointCount,
                0 // maxDistanceをFloat32で書き込むためのパディング
            ]);
            const paramsFloat = new Float32Array(paramsData.buffer);
            paramsFloat[3] = maxDistance;

            const paramsBuffer = this.device.createBuffer({
                label: 'SDF Params Buffer',
                size: 16, // 4 * 4 bytes
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            // Read Buffer
            const readBuffer = this.device.createBuffer({
                label: 'SDF Read Buffer',
                size: outputSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            // Bind Group作成
            const bindGroup = this.device.createBindGroup({
                label: 'SDF Bind Group',
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: pointBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            return {
                pointBuffer,
                outputBuffer,
                paramsBuffer,
                readBuffer,
                bindGroup,
                outputSize
            };
        }

        async _readResult(readBuffer, size) {
            await readBuffer.mapAsync(GPUMapMode.READ);
            const arrayBuffer = readBuffer.getMappedRange(0, size);
            const result = new Float32Array(arrayBuffer.slice(0));
            readBuffer.unmap();
            return result;
        }

        destroy() {
            this.pipeline = null;
            this.bindGroupLayout = null;
            this.shaderModule = null;
            this.initialized = false;
        }
    }

    window.WebGPUComputeSDF = WebGPUComputeSDF;

})();