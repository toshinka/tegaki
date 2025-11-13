/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-geometry-layer.js
 * ================================================================================
 * 
 * 【責務】
 * - PerfectFreehand出力（Polygon頂点配列）をGPU VertexBufferに変換
 * - WebGPU Render Pipeline の構築・管理
 * - Vertex/Fragment Shader の実装
 * - ペン/消しゴム統一パイプライン（blendMode切り替え）
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

    // ====================================================================
    // WGSL Shaders
    // ====================================================================

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
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    
    // Local座標 → NDC変換
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
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return uniforms.color;
}
`;

    // ====================================================================
    // WebGPUGeometryLayer Class
    // ====================================================================

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
        }

        /**
         * WebGPU初期化
         */
        async initialize(device, format) {
            if (this.initialized) {
                console.log('✅ [WebGPUGeometryLayer] Already initialized');
                return;
            }

            if (!device) {
                // webgpu-drawing-layerから取得
                if (!window.webgpuDrawingLayer?.isInitialized()) {
                    throw new Error('[WebGPUGeometryLayer] WebGPU not initialized');
                }
                device = window.webgpuDrawingLayer.getDevice();
            }

            this.device = device;
            this.queue = device.queue;
            this.format = format || 'rgba8unorm';

            // Shader Module作成
            const vertexModule = device.createShaderModule({
                label: 'Vertex Shader',
                code: VERTEX_SHADER
            });

            const fragmentModule = device.createShaderModule({
                label: 'Fragment Shader',
                code: FRAGMENT_SHADER
            });

            // Uniform Buffer作成（transform 3x3 + color vec4 = 13 floats → 64 bytes）
            this.uniformBuffer = device.createBuffer({
                label: 'Uniform Buffer',
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // Pipeline Layout
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

            // Vertex Buffer Layout
            const vertexBufferLayout = {
                arrayStride: 16, // vec2 pos + vec2 uv = 4 floats
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x2' // position
                    },
                    {
                        shaderLocation: 1,
                        offset: 8,
                        format: 'float32x2' // uv
                    }
                ]
            };

            // ペン用Pipeline
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
                }
            });

            // 消しゴム用Pipeline
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
                                operation: 'subtract',
                                srcFactor: 'one',
                                dstFactor: 'zero'
                            }
                        }
                    }]
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'none'
                }
            });

            // デフォルトはペン
            this.currentPipeline = this.penPipeline;

            // BindGroup作成
            this.bindGroup = device.createBindGroup({
                label: 'Bind Group',
                layout: bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                }]
            });

            this.initialized = true;

            console.log('✅ [WebGPUGeometryLayer] Initialized');
            console.log('   📊 Pen Pipeline:', this.penPipeline);
            console.log('   📊 Eraser Pipeline:', this.eraserPipeline);
        }

        /**
         * Polygonデータをアップロード
         */
        uploadPolygon(vertices, indices) {
            if (!this.initialized) {
                throw new Error('[WebGPUGeometryLayer] Not initialized');
            }

            // 頂点バッファ作成（position + uv）
            const vertexCount = vertices.length / 2;
            const vertexData = new Float32Array(vertexCount * 4);

            for (let i = 0; i < vertexCount; i++) {
                vertexData[i * 4 + 0] = vertices[i * 2 + 0]; // x
                vertexData[i * 4 + 1] = vertices[i * 2 + 1]; // y
                vertexData[i * 4 + 2] = 0.0; // uv.x (placeholder)
                vertexData[i * 4 + 3] = 0.0; // uv.y (placeholder)
            }

            // 既存バッファ破棄
            if (this.vertexBuffer) {
                this.vertexBuffer.destroy();
            }
            if (this.indexBuffer) {
                this.indexBuffer.destroy();
            }

            // 新規バッファ作成
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

            // データ転送
            this.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
            this.queue.writeBuffer(this.indexBuffer, 0, indices);

            this.vertexCount = vertexCount;
            this.indexCount = indices.length;
        }

        /**
         * Transform Matrix更新
         */
        updateTransform(transformMatrix, color) {
            if (!this.initialized) {
                throw new Error('[WebGPUGeometryLayer] Not initialized');
            }

            // Uniform: mat3x3 (9 floats) + vec4 (4 floats) = 13 floats
            const uniformData = new Float32Array(16); // 64 bytes
            
            // Transform Matrix (3x3)
            uniformData.set(transformMatrix, 0);
            
            // Color (vec4)
            if (color) {
                uniformData[12] = color[0];
                uniformData[13] = color[1];
                uniformData[14] = color[2];
                uniformData[15] = color[3];
            } else {
                uniformData[12] = 0.0;
                uniformData[13] = 0.0;
                uniformData[14] = 0.0;
                uniformData[15] = 1.0;
            }

            this.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        }

        /**
         * BlendMode設定
         */
        setBlendMode(mode) {
            if (mode === 'eraser') {
                this.currentPipeline = this.eraserPipeline;
            } else {
                this.currentPipeline = this.penPipeline;
            }
        }

        /**
         * 描画実行
         */
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

        /**
         * クリーンアップ
         */
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

    // グローバル公開
    window.WebGPUGeometryLayer = new WebGPUGeometryLayer();

    console.log('✅ webgpu-geometry-layer.js loaded');

})();