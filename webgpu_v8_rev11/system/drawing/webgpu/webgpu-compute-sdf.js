/**
 * ================================================================================
 * webgpu-compute-sdf.js - WebGPU SDF Generation (Phase 2対応版)
 * ================================================================================
 * 
 * 【責務】
 * - GPU Compute ShaderによるSDF生成
 * - ポリゴンからSDF距離場計算
 * - GPUTexture直接出力
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice)
 * 
 * 【依存Children】
 * - stroke-renderer.js (SDF利用)
 * 
 * ================================================================================
 */

class WebGPUComputeSDF {
    constructor() {
        this.device = null;
        this.pipeline = null;
        this.initialized = false;
    }

    /**
     * 初期化
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            if (!window.webgpuDrawingLayer?.isInitialized()) {
                throw new Error('WebGPUDrawingLayer not initialized');
            }

            this.device = window.webgpuDrawingLayer.getDevice();
            await this._createComputePipeline();

            this.initialized = true;
            console.log('✅ [WebGPUComputeSDF] Initialized');
            return true;

        } catch (error) {
            console.error('[WebGPUComputeSDF] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Compute Pipeline作成
     */
    async _createComputePipeline() {
        const shaderCode = `
            struct Params {
                width: u32,
                height: u32,
                radius: f32,
                pointCount: u32,
            }

            @group(0) @binding(0) var<uniform> params: Params;
            @group(0) @binding(1) var<storage, read> points: array<vec2<f32>>;
            @group(0) @binding(2) var<storage, read_write> output: array<f32>;

            @compute @workgroup_size(16, 16)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let x = global_id.x;
                let y = global_id.y;

                if (x >= params.width || y >= params.height) {
                    return;
                }

                let pos = vec2<f32>(f32(x), f32(y));
                var minDist = 999999.0;

                // 全ポイントとの最小距離計算
                for (var i = 0u; i < params.pointCount; i++) {
                    let dist = distance(pos, points[i]);
                    minDist = min(minDist, dist);
                }

                // 正規化 (0.0~1.0)
                let normalizedDist = clamp(minDist / params.radius, 0.0, 1.0);
                
                let index = y * params.width + x;
                output[index] = 1.0 - normalizedDist;
            }
        `;

        const shaderModule = this.device.createShaderModule({ code: shaderCode });

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });
    }

    /**
     * SDF生成 (Float32Array返却)
     */
    async generateSDF(points, width, height, radius) {
        if (!this.initialized) {
            await this.initialize();
        }

        const pointCount = points.length;
        const outputSize = width * height;

        // バッファ作成
        const paramsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const paramsData = new Uint32Array([width, height]);
        const paramsFloat = new Float32Array([radius, pointCount]);
        this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);
        this.device.queue.writeBuffer(paramsBuffer, 8, paramsFloat);

        const pointsBuffer = this.device.createBuffer({
            size: pointCount * 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        const pointsData = new Float32Array(pointCount * 2);
        for (let i = 0; i < pointCount; i++) {
            pointsData[i * 2] = points[i].x;
            pointsData[i * 2 + 1] = points[i].y;
        }
        this.device.queue.writeBuffer(pointsBuffer, 0, pointsData);

        const outputBuffer = this.device.createBuffer({
            size: outputSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const readBuffer = this.device.createBuffer({
            size: outputSize * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        // Bind Group
        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: paramsBuffer } },
                { binding: 1, resource: { buffer: pointsBuffer } },
                { binding: 2, resource: { buffer: outputBuffer } }
            ]
        });

        // Compute実行
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(
            Math.ceil(width / 16),
            Math.ceil(height / 16)
        );
        passEncoder.end();

        commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputSize * 4);
        this.device.queue.submit([commandEncoder.finish()]);

        // 結果読み取り
        await readBuffer.mapAsync(GPUMapMode.READ);
        const resultArray = new Float32Array(readBuffer.getMappedRange());
        const result = new Float32Array(resultArray);
        readBuffer.unmap();

        // クリーンアップ
        paramsBuffer.destroy();
        pointsBuffer.destroy();
        outputBuffer.destroy();
        readBuffer.destroy();

        return result;
    }

    /**
     * SDF生成 (GPUTexture返却) - Phase 2追加
     */
    async generateSDFTexture(points, width, height, radius) {
        const sdfData = await this.generateSDF(points, width, height, radius);

        // GPUTexture作成
        const texture = this.device.createTexture({
            size: { width, height, depthOrArrayLayers: 1 },
            format: 'r32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });

        // データ書き込み
        this.device.queue.writeTexture(
            { texture },
            sdfData,
            { bytesPerRow: width * 4, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 1 }
        );

        return texture;
    }
}

// グローバル公開
if (!window.webgpuComputeSDF) {
    window.webgpuComputeSDF = new WebGPUComputeSDF();
}