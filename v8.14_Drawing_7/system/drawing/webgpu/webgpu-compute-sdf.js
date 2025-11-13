/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-compute-sdf.js - Phase 1拡張版
 * ================================================================================
 * 
 * 【Phase 1拡張内容】
 * ✅ generateSDFTexture() 追加（GPUTexture直接出力）
 * ✅ Float32Array出力とGPUTexture出力の両対応
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue)
 * - config.js (TEGAKI_CONFIG)
 * 
 * 【依存Children】
 * - stroke-renderer.js (generateSDFTexture呼び出し)
 * - fill-tool.js (computeFloodFillMask呼び出し)
 * ================================================================================
 */

(function() {
    'use strict';

    class WebGPUComputeSDF {
        constructor(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            this.device = webgpuLayer.device;
            this.sdfPipeline = null;
            this.fillPipeline = null;
            this.bindGroupLayout = null;
            this.fillBindGroupLayout = null;
            this.shaderModule = null;
            this.fillShaderModule = null;
            this.initialized = false;
            this.sdfCache = new Map();
        }

        async initialize() {
            if (this.initialized) return;

            await this._initializeSDFPipeline();
            await this._initializeFillPipeline();

            this.initialized = true;
        }

        async _initializeSDFPipeline() {
            const shaderCode = await this._loadSDFShaderCode();
            
            this.shaderModule = this.device.createShaderModule({
                label: 'SDF Compute Shader',
                code: shaderCode
            });

            this.bindGroupLayout = this.device.createBindGroupLayout({
                label: 'SDF Bind Group Layout',
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
                ]
            });

            const pipelineLayout = this.device.createPipelineLayout({
                label: 'SDF Pipeline Layout',
                bindGroupLayouts: [this.bindGroupLayout]
            });

            this.sdfPipeline = this.device.createComputePipeline({
                label: 'SDF Compute Pipeline',
                layout: pipelineLayout,
                compute: { module: this.shaderModule, entryPoint: 'main' }
            });
        }

        async _initializeFillPipeline() {
            const fillShaderCode = await this._loadFillShaderCode();
            
            this.fillShaderModule = this.device.createShaderModule({
                label: 'FloodFill Compute Shader',
                code: fillShaderCode
            });

            this.fillBindGroupLayout = this.device.createBindGroupLayout({
                label: 'FloodFill Bind Group Layout',
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
                ]
            });

            const pipelineLayout = this.device.createPipelineLayout({
                label: 'FloodFill Pipeline Layout',
                bindGroupLayouts: [this.fillBindGroupLayout]
            });

            this.fillPipeline = this.device.createComputePipeline({
                label: 'FloodFill Compute Pipeline',
                layout: pipelineLayout,
                compute: { module: this.fillShaderModule, entryPoint: 'main' }
            });
        }

        async _loadSDFShaderCode() {
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

    let idx = id.y * params.width + id.x;
    sdfOutput[idx] = minDist;
}
            `;
        }

        async _loadFillShaderCode() {
            return `
struct FloodFillParams {
    seedDistance: f32,
    threshold: f32,
    width: u32,
    height: u32,
}

@group(0) @binding(0) var<storage, read> sdfField: array<f32>;
@group(0) @binding(1) var<storage, read_write> maskOutput: array<u32>;
@group(0) @binding(2) var<uniform> params: FloodFillParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let idx = id.y * params.width + id.x;
    let distance = sdfField[idx];
    
    let distDiff = abs(distance - params.seedDistance);
    
    if (distDiff < params.threshold && distance < 999998.0) {
        maskOutput[idx] = 1u;
    } else {
        maskOutput[idx] = 0u;
    }
}
            `;
        }

        /**
         * 🔧 Phase 1新規: SDF生成 → GPUTexture出力
         */
        async generateSDFTexture(polygon, width, height, radius = 16) {
            if (!this.initialized) {
                await this.initialize();
            }

            // ポリゴン → ポイント配列変換
            const points = [];
            for (let i = 0; i < polygon.length; i += 2) {
                points.push({ x: polygon[i], y: polygon[i + 1] });
            }

            // SDF生成（Float32Array）
            const sdfData = await this.generateSDF(points, width, height, radius * 2);

            // GPUTexture作成
            const texture = this.device.createTexture({
                label: 'SDF Texture',
                size: { width, height, depthOrArrayLayers: 1 },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING |
                       GPUTextureUsage.COPY_DST |
                       GPUTextureUsage.COPY_SRC |
                       GPUTextureUsage.RENDER_ATTACHMENT
            });

            // Float32Array → RGBA変換
            const pixelData = new Uint8Array(width * height * 4);
            for (let i = 0; i < sdfData.length; i++) {
                const distance = sdfData[i];
                const alpha = distance < 1.0 ? 255 : Math.max(0, 255 - distance * 10);
                
                const idx = i * 4;
                pixelData[idx] = 128;     // R
                pixelData[idx + 1] = 0;   // G
                pixelData[idx + 2] = 0;   // B
                pixelData[idx + 3] = alpha; // A
            }

            // データをGPUTextureに書き込み
            this.device.queue.writeTexture(
                { texture },
                pixelData,
                { bytesPerRow: width * 4, rowsPerImage: height },
                { width, height, depthOrArrayLayers: 1 }
            );

            return texture;
        }

        /**
         * 既存: Float32Array出力（互換性維持）
         */
        async generateSDF(points, width, height, maxDistance = 256.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeSDF not initialized');
            }

            const pointCount = points.length;
            if (pointCount === 0) {
                throw new Error('No points provided');
            }

            const buffers = this._createSDFBuffers(points, width, height, maxDistance);
            const commandEncoder = this.device.createCommandEncoder({ label: 'SDF Compute Encoder' });
            const passEncoder = commandEncoder.beginComputePass({ label: 'SDF Compute Pass' });

            passEncoder.setPipeline(this.sdfPipeline);
            passEncoder.setBindGroup(0, buffers.bindGroup);
            
            const workgroupX = Math.ceil(width / 8);
            const workgroupY = Math.ceil(height / 8);
            passEncoder.dispatchWorkgroups(workgroupX, workgroupY, 1);
            passEncoder.end();

            commandEncoder.copyBufferToBuffer(
                buffers.outputBuffer, 0, buffers.readBuffer, 0, buffers.outputSize
            );

            this.device.queue.submit([commandEncoder.finish()]);

            const result = await this._readResult(buffers.readBuffer, buffers.outputSize);

            buffers.pointBuffer.destroy();
            buffers.outputBuffer.destroy();
            buffers.paramsBuffer.destroy();
            buffers.readBuffer.destroy();

            return result;
        }

        // 以下、既存メソッド（変更なし）

        async computeFloodFillMask(layer, clickLocalX, clickLocalY, threshold = 5.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeSDF not initialized');
            }

            const CONFIG = window.TEGAKI_CONFIG;
            const width = CONFIG.canvas.width;
            const height = CONFIG.canvas.height;

            const sdfBuffer = await this.getOrCreateSDFBuffer(layer, width, height);
            const seedDistance = await this.readDistanceAtPoint(sdfBuffer, clickLocalX, clickLocalY, width, height);
            const adjustedThreshold = Math.max(threshold, seedDistance * 0.1);
            const maskBuffer = await this.runFloodFillShader(sdfBuffer, seedDistance, adjustedThreshold, width, height);
            const maskTexture = await this.bufferToTexture(maskBuffer, width, height);

            return maskTexture;
        }

        async getOrCreateSDFBuffer(layer, width, height) {
            const layerId = layer.layerData?.id;
            if (!layerId) {
                throw new Error('Invalid layer: no layerData.id');
            }

            if (this.sdfCache.has(layerId)) {
                return this.sdfCache.get(layerId);
            }

            const points = this._collectLayerPoints(layer);
            if (points.length === 0) {
                const emptyBuffer = new Float32Array(width * height).fill(999999.0);
                this.sdfCache.set(layerId, emptyBuffer);
                return emptyBuffer;
            }

            const sdfBuffer = await this.generateSDF(points, width, height);
            this.sdfCache.set(layerId, sdfBuffer);

            return sdfBuffer;
        }

        _collectLayerPoints(layer) {
            const points = [];
            const pathsData = layer.layerData?.pathsData || [];

            for (const pathData of pathsData) {
                if (pathData.points && Array.isArray(pathData.points)) {
                    for (const pt of pathData.points) {
                        points.push({ x: pt.x, y: pt.y });
                    }
                }
            }

            return points;
        }

        async readDistanceAtPoint(sdfBuffer, localX, localY, width, height) {
            const x = Math.floor(localX);
            const y = Math.floor(localY);

            if (x < 0 || x >= width || y < 0 || y >= height) {
                return 999999.0;
            }

            const idx = y * width + x;
            return sdfBuffer[idx];
        }

        async runFloodFillShader(sdfBuffer, seedDistance, threshold, width, height) {
            const buffers = this._createFillBuffers(sdfBuffer, seedDistance, threshold, width, height);

            const commandEncoder = this.device.createCommandEncoder({ label: 'FloodFill Compute Encoder' });
            const passEncoder = commandEncoder.beginComputePass({ label: 'FloodFill Compute Pass' });

            passEncoder.setPipeline(this.fillPipeline);
            passEncoder.setBindGroup(0, buffers.bindGroup);
            
            const workgroupX = Math.ceil(width / 8);
            const workgroupY = Math.ceil(height / 8);
            passEncoder.dispatchWorkgroups(workgroupX, workgroupY, 1);
            passEncoder.end();

            commandEncoder.copyBufferToBuffer(
                buffers.outputBuffer, 0, buffers.readBuffer, 0, buffers.outputSize
            );

            this.device.queue.submit([commandEncoder.finish()]);

            const result = await this._readResult(buffers.readBuffer, buffers.outputSize);

            buffers.sdfBuffer.destroy();
            buffers.outputBuffer.destroy();
            buffers.paramsBuffer.destroy();
            buffers.readBuffer.destroy();

            return result;
        }

        _createFillBuffers(sdfBuffer, seedDistance, threshold, width, height) {
            const sdfGPUBuffer = this.device.createBuffer({
                label: 'SDF Input Buffer',
                size: sdfBuffer.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(sdfGPUBuffer, 0, sdfBuffer);

            const outputSize = width * height * 4;
            const outputBuffer = this.device.createBuffer({
                label: 'FloodFill Output Buffer',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            const paramsData = new Float32Array([seedDistance, threshold, 0, 0]);
            const paramsUint = new Uint32Array(paramsData.buffer);
            paramsUint[2] = width;
            paramsUint[3] = height;

            const paramsBuffer = this.device.createBuffer({
                label: 'FloodFill Params Buffer',
                size: 16,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            const readBuffer = this.device.createBuffer({
                label: 'FloodFill Read Buffer',
                size: outputSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            const bindGroup = this.device.createBindGroup({
                label: 'FloodFill Bind Group',
                layout: this.fillBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: sdfGPUBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            return {
                sdfBuffer: sdfGPUBuffer,
                outputBuffer,
                paramsBuffer,
                readBuffer,
                bindGroup,
                outputSize
            };
        }

        async bufferToTexture(maskBuffer, width, height) {
            const pixelData = new Uint8Array(width * height * 4);
            const maskUint = new Uint32Array(maskBuffer.buffer);

            for (let i = 0; i < maskUint.length; i++) {
                const value = maskUint[i] ? 255 : 0;
                const idx = i * 4;
                pixelData[idx] = value;
                pixelData[idx + 1] = value;
                pixelData[idx + 2] = value;
                pixelData[idx + 3] = value;
            }

            const resource = new PIXI.BufferResource(pixelData, { width, height });
            const baseTexture = new PIXI.BaseTexture(resource, {
                width, height,
                format: PIXI.FORMATS.RGBA,
                type: PIXI.TYPES.UNSIGNED_BYTE
            });

            return new PIXI.Texture(baseTexture);
        }

        _createSDFBuffers(points, width, height, maxDistance) {
            const pointCount = points.length;
            
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

            const outputSize = width * height * 4;
            const outputBuffer = this.device.createBuffer({
                label: 'SDF Output Buffer',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            const paramsData = new Uint32Array([width, height, pointCount, 0]);
            const paramsFloat = new Float32Array(paramsData.buffer);
            paramsFloat[3] = maxDistance;

            const paramsBuffer = this.device.createBuffer({
                label: 'SDF Params Buffer',
                size: 16,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            const readBuffer = this.device.createBuffer({
                label: 'SDF Read Buffer',
                size: outputSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            const bindGroup = this.device.createBindGroup({
                label: 'SDF Bind Group',
                layout: this.bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: pointBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });

            return { pointBuffer, outputBuffer, paramsBuffer, readBuffer, bindGroup, outputSize };
        }

        async _readResult(readBuffer, size) {
            await readBuffer.mapAsync(GPUMapMode.READ);
            const arrayBuffer = readBuffer.getMappedRange(0, size);
            const result = new Float32Array(arrayBuffer.slice(0));
            readBuffer.unmap();
            return result;
        }

        clearCache() {
            this.sdfCache.clear();
        }

        destroy() {
            this.sdfPipeline = null;
            this.fillPipeline = null;
            this.bindGroupLayout = null;
            this.fillBindGroupLayout = null;
            this.shaderModule = null;
            this.fillShaderModule = null;
            this.initialized = false;
            this.sdfCache.clear();
        }
    }

    window.WebGPUComputeSDF = WebGPUComputeSDF;

    console.log('✅ webgpu-compute-sdf.js (Phase 1拡張版) loaded');
    console.log('   🔧 generateSDFTexture() 追加');
    console.log('   🔧 GPUTexture直接出力対応');

})();