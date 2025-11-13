/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-geometry-layer.js - MSAA対応版
 * ================================================================================
 * 
 * 【Phase 6 + MSAA改修】
 * ✅ 4x MSAA (アンチエイリアス) 対応
 * ✅ Uniform Buffer メモリレイアウト修正済み
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice/Queue)
 * - earcut-triangulator.js (Triangulation)
 * 
 * 【依存Children】
 * - stroke-renderer.js (呼び出し元)
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    const VERTEX_SHADER = `
struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct Uniforms {
    transform: mat3x3<f32>,
    padding: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    
    let pos = uniforms.transform * vec3<f32>(in.position, 1.0);
    out.position = vec4<f32>(pos.xy, 0.0, 1.0);
    out.uv = in.uv;
    
    return out;
}
`;

    const FRAGMENT_SHADER = `
struct VertexOutput {
    @location(0) uv: vec2<f32>,
};

struct Uniforms {
    transform: mat3x3<f32>,
    padding: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return uniforms.color;
}
`;

    class WebGPUGeometryLayer {
        constructor() {
            this.device = null;
            this.queue = null;
            this.format = 'rgba8unorm';
            
            this.penPipeline = null;
            this.eraserPipeline = null;
            this.currentPipeline = null;
            
            this.vertexBuffer = null;
            this.indexBuffer = null;
            this.uniformBuffer = null;
            this.bindGroup = null;
            
            this.vertexCount = 0;
            this.indexCount = 0;
            
            this.initialized = false;
            this.sampleCount = 4; // 4x MSAA
        }

        async initialize(device, format) {
            if (this.initialized) return;

            if (!device) {
                if (!window.webgpuDrawingLayer?.isInitialized()) {
                    throw new Error('[WebGPUGeometryLayer] WebGPU not initialized');
                }
                device = window.webgpuDrawingLayer.getDevice();
            }

            this.device = device;
            this.queue = device.queue;
            this.format = format || 'rgba8unorm';

            const vertexModule = device.createShaderModule({
                label: 'Vertex Shader',
                code: VERTEX_SHADER
            });

            const fragmentModule = device.createShaderModule({
                label: 'Fragment Shader',
                code: FRAGMENT_SHADER
            });

            this.uniformBuffer = device.createBuffer({
                label: 'Uniform Buffer',
                size: 80,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            const bindGroupLayout = device.createBindGroupLayout({
                label: 'Bind Group Layout',
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }]
            });

            const pipelineLayout = device.createPipelineLayout({
                label: 'Pipeline Layout',
                bindGroupLayouts: [bindGroupLayout]
            });

            const vertexBufferLayout = {
                arrayStride: 16,
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x2'
                    },
                    {
                        shaderLocation: 1,
                        offset: 8,
                        format: 'float32x2'
                    }
                ]
            };

            this.penPipeline = device.createRenderPipeline({
                label: 'Pen Pipeline',
                layout: pipelineLayout,
                vertex: {
                    module: vertexModule,
                    entryPoint: 'vs_main',
                    buffers: [vertexBufferLayout]
                },
                fragment: {
                    module: fragmentModule,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: this.format,
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha'
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha'
                            }
                        }
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none'
                },
                multisample: {
                    count: this.sampleCount
                }
            });

            this.eraserPipeline = device.createRenderPipeline({
                label: 'Eraser Pipeline',
                layout: pipelineLayout,
                vertex: {
                    module: vertexModule,
                    entryPoint: 'vs_main',
                    buffers: [vertexBufferLayout]
                },
                fragment: {
                    module: fragmentModule,
                    entryPoint: 'fs_main',
                    targets: [{
                        format: this.format,
                        blend: {
                            color: {
                                operation: 'add',
                                srcFactor: 'zero',
                                dstFactor: 'one'
                            },
                            alpha: {
                                operation: 'reverse-subtract',
                                srcFactor: 'one',
                                dstFactor: 'zero'
                            }
                        }
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none'
                },
                multisample: {
                    count: this.sampleCount
                }
            });

            this.currentPipeline = this.penPipeline;

            this.bindGroup = device.createBindGroup({
                label: 'Bind Group',
                layout: bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                }]
            });

            this.initialized = true;
            console.log('✅ [WebGPUGeometryLayer] Initialized (4x MSAA)');
            console.log('   📊 Pen Pipeline:', this.penPipeline);
            console.log('   📊 Eraser Pipeline:', this.eraserPipeline);
        }

        uploadPolygon(vertices, indices) {
            if (!this.initialized) {
                throw new Error('[WebGPUGeometryLayer] Not initialized');
            }

            const vertexCount = vertices.length / 2;
            const vertexData = new Float32Array(vertexCount * 4);

            for (let i = 0; i < vertexCount; i++) {
                vertexData[i * 4 + 0] = vertices[i * 2 + 0];
                vertexData[i * 4 + 1] = vertices[i * 2 + 1];
                vertexData[i * 4 + 2] = 0.0;
                vertexData[i * 4 + 3] = 0.0;
            }

            if (this.vertexBuffer) {
                this.vertexBuffer.destroy();
            }
            if (this.indexBuffer) {
                this.indexBuffer.destroy();
            }

            this.vertexBuffer = this.device.createBuffer({
                label: 'Vertex Buffer',
                size: vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            });

            this.indexBuffer = this.device.createBuffer({
                label: 'Index Buffer',
                size: indices.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
            });

            this.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
            this.queue.writeBuffer(this.indexBuffer, 0, indices);

            this.vertexCount = vertexCount;
            this.indexCount = indices.length;
        }

        updateTransform(transformMatrix, color) {
            if (!this.initialized) {
                throw new Error('[WebGPUGeometryLayer] Not initialized');
            }

            const uniformData = new Float32Array(20);
            
            uniformData[0] = transformMatrix[0];
            uniformData[1] = transformMatrix[1];
            uniformData[2] = transformMatrix[2];
            uniformData[3] = 0.0;
            
            uniformData[4] = transformMatrix[3];
            uniformData[5] = transformMatrix[4];
            uniformData[6] = transformMatrix[5];
            uniformData[7] = 0.0;
            
            uniformData[8] = transformMatrix[6];
            uniformData[9] = transformMatrix[7];
            uniformData[10] = transformMatrix[8];
            uniformData[11] = 0.0;
            
            uniformData[12] = 0.0;
            uniformData[13] = 0.0;
            uniformData[14] = 0.0;
            uniformData[15] = 0.0;
            
            if (color) {
                uniformData[16] = color[0];
                uniformData[17] = color[1];
                uniformData[18] = color[2];
                uniformData[19] = color[3];
            } else {
                uniformData[16] = 0.0;
                uniformData[17] = 0.0;
                uniformData[18] = 0.0;
                uniformData[19] = 1.0;
            }

            this.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        }

        setBlendMode(mode) {
            if (mode === 'eraser') {
                this.currentPipeline = this.eraserPipeline;
            } else {
                this.currentPipeline = this.penPipeline;
            }
        }

        render(passEncoder) {
            if (!this.initialized) {
                throw new Error('[WebGPUGeometryLayer] Not initialized');
            }

            if (!this.vertexBuffer || !this.indexBuffer) {
                console.warn('⚠️ [WebGPUGeometryLayer] No geometry uploaded');
                return;
            }

            passEncoder.setPipeline(this.currentPipeline);
            passEncoder.setBindGroup(0, this.bindGroup);
            passEncoder.setVertexBuffer(0, this.vertexBuffer);
            passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
            passEncoder.drawIndexed(this.indexCount, 1, 0, 0, 0);
        }

        destroy() {
            if (this.vertexBuffer) {
                this.vertexBuffer.destroy();
                this.vertexBuffer = null;
            }
            if (this.indexBuffer) {
                this.indexBuffer.destroy();
                this.indexBuffer = null;
            }
            if (this.uniformBuffer) {
                this.uniformBuffer.destroy();
                this.uniformBuffer = null;
            }
            this.initialized = false;
        }
    }

    window.WebGPUGeometryLayer = new WebGPUGeometryLayer();

    console.log('✅ webgpu-geometry-layer.js Phase 6 + MSAA loaded');
    console.log('   🔧 4x マルチサンプリング対応（チラツキ解消）');
    console.log('   🔧 消しゴムBlendMode修正');

})();