// ================================================================================
// WebGPU Compute MSDF Generator - Phase 4-B-4
// ================================================================================
// 役割: Multi-channel Signed Distance Field生成
// 実装: RGB 3チャンネル距離場をCompute Shaderで並列計算
// ================================================================================

(function() {
    'use strict';

    class WebGPUComputeMSDF {
        constructor(device) {
            this.device = device;
            this.pipeline = null;
            this.bindGroupLayout = null;
            this.shaderModule = null;
            this.initialized = false;
        }

        async initialize() {
            if (this.initialized) return;

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

            this.pipeline = this.device.createComputePipeline({
                label: 'MSDF Compute Pipeline',
                layout: pipelineLayout,
                compute: {
                    module: this.shaderModule,
                    entryPoint: 'computeMSDF'
                }
            });

            this.initialized = true;
        }

        async _loadShaderCode() {
            return `
struct MSDFParams {
    width: u32,
    height: u32,
    pointCount: u32,
    maxDistance: f32,
    range: f32,
    padding: vec3<f32>,
}

@group(0) @binding(0) var<storage, read> strokePoints: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> msdfOutput: array<vec4f>;
@group(0) @binding(2) var<uniform> params: MSDFParams;

fn closestPointOnSegment(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    return a + t * ab;
}

fn signedDistance(p: vec2f, segStart: vec2f, segEnd: vec2f) -> f32 {
    let closest = closestPointOnSegment(p, segStart, segEnd);
    let dist = distance(p, closest);
    
    let edge = segEnd - segStart;
    let toPoint = p - segStart;
    let cross = edge.x * toPoint.y - edge.y * toPoint.x;
    
    return select(dist, -dist, cross < 0.0);
}

fn computeMultiChannelDistance(pixel: vec2f) -> vec3f {
    let pointCount = params.pointCount;
    
    if (pointCount < 2u) {
        return vec3f(1.0);
    }
    
    var distances = array<f32, 3>(999999.0, 999999.0, 999999.0);
    
    for (var i = 0u; i < pointCount - 1u; i++) {
        let segStart = strokePoints[i];
        let segEnd = strokePoints[i + 1u];
        
        let signedDist = signedDistance(pixel, segStart, segEnd);
        let absDist = abs(signedDist);
        
        if (absDist < abs(distances[0])) {
            distances[2] = distances[1];
            distances[1] = distances[0];
            distances[0] = signedDist;
        } else if (absDist < abs(distances[1])) {
            distances[2] = distances[1];
            distances[1] = signedDist;
        } else if (absDist < abs(distances[2])) {
            distances[2] = signedDist;
        }
    }
    
    let r = 0.5 + (distances[0] / params.range);
    let g = 0.5 + (distances[1] / params.range);
    let b = 0.5 + (distances[2] / params.range);
    
    return clamp(vec3f(r, g, b), vec3f(0.0), vec3f(1.0));
}

@compute @workgroup_size(8, 8, 1)
fn computeMSDF(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= params.width || id.y >= params.height) {
        return;
    }

    let pixel = vec2f(f32(id.x), f32(id.y));
    let msdf = computeMultiChannelDistance(pixel);
    
    let idx = id.y * params.width + id.x;
    msdfOutput[idx] = vec4f(msdf, 1.0);
}
            `;
        }

        async generateMSDF(points, width, height, range = 8.0, maxDistance = 256.0) {
            if (!this.initialized) {
                throw new Error('WebGPUComputeMSDF not initialized');
            }

            const pointCount = points.length;
            if (pointCount < 2) {
                throw new Error('At least 2 points required for MSDF');
            }

            const buffers = this._createBuffers(points, width, height, range, maxDistance);

            const commandEncoder = this.device.createCommandEncoder({
                label: 'MSDF Compute Encoder'
            });

            const passEncoder = commandEncoder.beginComputePass({
                label: 'MSDF Compute Pass'
            });

            passEncoder.setPipeline(this.pipeline);
            passEncoder.setBindGroup(0, buffers.bindGroup);
            
            const workgroupX = Math.ceil(width / 8);
            const workgroupY = Math.ceil(height / 8);
            passEncoder.dispatchWorkgroups(workgroupX, workgroupY, 1);
            
            passEncoder.end();

            commandEncoder.copyBufferToBuffer(
                buffers.outputBuffer,
                0,
                buffers.readBuffer,
                0,
                buffers.outputSize
            );

            this.device.queue.submit([commandEncoder.finish()]);

            const result = await this._readResult(buffers.readBuffer, buffers.outputSize);

            buffers.pointBuffer.destroy();
            buffers.outputBuffer.destroy();
            buffers.paramsBuffer.destroy();
            buffers.readBuffer.destroy();

            return result;
        }

        _createBuffers(points, width, height, range, maxDistance) {
            const pointCount = points.length;
            
            const pointData = new Float32Array(pointCount * 2);
            for (let i = 0; i < pointCount; i++) {
                pointData[i * 2] = points[i].x;
                pointData[i * 2 + 1] = points[i].y;
            }

            const pointBuffer = this.device.createBuffer({
                label: 'Stroke Points Buffer (MSDF)',
                size: pointData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(pointBuffer, 0, pointData);

            const outputSize = width * height * 16; // vec4f = 16 bytes
            const outputBuffer = this.device.createBuffer({
                label: 'MSDF Output Buffer',
                size: outputSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            // MSDFParams: width, height, pointCount, maxDistance, range, padding[3]
            const paramsData = new Float32Array(8);
            paramsData[0] = width;
            paramsData[1] = height;
            paramsData[2] = pointCount;
            paramsData[3] = maxDistance;
            paramsData[4] = range;
            // padding[5-7] = 0

            const paramsBuffer = this.device.createBuffer({
                label: 'MSDF Params Buffer',
                size: 32, // 8 * 4 bytes
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

            const readBuffer = this.device.createBuffer({
                label: 'MSDF Read Buffer',
                size: outputSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            const bindGroup = this.device.createBindGroup({
                label: 'MSDF Bind Group',
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

    window.WebGPUComputeMSDF = WebGPUComputeMSDF;

})();