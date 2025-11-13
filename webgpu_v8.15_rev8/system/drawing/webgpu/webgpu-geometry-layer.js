/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-geometry-layer.js
 * Phase 1: 基盤実装完成版
 * ================================================================================
 * 
 * 【責務】
 * - PerfectFreehand出力（Polygon）をGPU VertexBufferに変換
 * - WebGPU Render Pipeline構築・管理（Pen/Eraser統一）
 * - Vertex/Fragment Shader実装（WGSL）
 * - Triangulated Polygon描画
 * - BlendMode切り替え（pen/eraser）
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (GPUDevice/Queue/Format)
 * - earcut-triangulator.js (Triangulation)
 * 
 * 【依存Children】
 * - stroke-renderer.js (描画要求元)
 * 
 * 【グローバル公開】
 * - window.WebGPUGeometryLayer
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  class WebGPUGeometryLayer {
    constructor() {
      this.device = null;
      this.queue = null;
      this.format = null;

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

    async initialize(device, format) {
      if (this.initialized) return;

      this.device = device;
      this.queue = device.queue;
      this.format = format;

      try {
        await this._createShaderModule();
        await this._createPipelines();
        this._createBuffers();
        
        this.currentPipeline = this.penPipeline;
        this.initialized = true;

        console.log('✅ [WebGPUGeometryLayer] Phase 1初期化完了');
      } catch (error) {
        console.error('❌ [WebGPUGeometryLayer] 初期化失敗:', error);
        throw error;
      }
    }

    async _createShaderModule() {
      const shaderCode = `
        struct VertexInput {
          @location(0) position: vec2<f32>,
        };

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
        };

        struct Uniforms {
          transform: mat3x3<f32>,
          color: vec4<f32>,
        };

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        @vertex
        fn vs_main(in: VertexInput) -> VertexOutput {
          var out: VertexOutput;
          let pos = uniforms.transform * vec3<f32>(in.position, 1.0);
          out.position = vec4<f32>(pos.xy, 0.0, 1.0);
          return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
          return uniforms.color;
        }
      `;

      this.shaderModule = this.device.createShaderModule({
        label: 'Geometry Shader',
        code: shaderCode
      });
    }

    async _createPipelines() {
      const vertexBufferLayout = {
        arrayStride: 8, // vec2 (x, y)
        attributes: [{
          format: 'float32x2',
          offset: 0,
          shaderLocation: 0
        }]
      };

      const pipelineLayout = this.device.createPipelineLayout({
        label: 'Geometry Pipeline Layout',
        bindGroupLayouts: [this._createBindGroupLayout()]
      });

      // Pen Pipeline
      this.penPipeline = this.device.createRenderPipeline({
        label: 'Pen Pipeline',
        layout: pipelineLayout,
        vertex: {
          module: this.shaderModule,
          entryPoint: 'vs_main',
          buffers: [vertexBufferLayout]
        },
        fragment: {
          module: this.shaderModule,
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
          topology: 'triangle-list'
        }
      });

      // Eraser Pipeline
      this.eraserPipeline = this.device.createRenderPipeline({
        label: 'Eraser Pipeline',
        layout: pipelineLayout,
        vertex: {
          module: this.shaderModule,
          entryPoint: 'vs_main',
          buffers: [vertexBufferLayout]
        },
        fragment: {
          module: this.shaderModule,
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
          topology: 'triangle-list'
        }
      });
    }

    _createBindGroupLayout() {
      return this.device.createBindGroupLayout({
        label: 'Geometry Bind Group Layout',
        entries: [{
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }]
      });
    }

    _createBuffers() {
      // Vertex Buffer (最大10000頂点)
      this.vertexBuffer = this.device.createBuffer({
        label: 'Vertex Buffer',
        size: 10000 * 8, // vec2
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      // Index Buffer (最大30000インデックス)
      this.indexBuffer = this.device.createBuffer({
        label: 'Index Buffer',
        size: 30000 * 4, // uint32
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      // Uniform Buffer (transform: mat3x3 + color: vec4 = 13 floats → 52 bytes → align 256)
      this.uniformBuffer = this.device.createBuffer({
        label: 'Uniform Buffer',
        size: 256,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
    }

    uploadPolygon(vertices, indices) {
      if (!this.initialized) {
        console.warn('[WebGPUGeometryLayer] Not initialized');
        return;
      }

      this.vertexCount = vertices.length / 2;
      this.indexCount = indices.length;

      this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
      this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
    }

    updateUniforms(transform, color) {
      if (!this.initialized) return;

      // mat3x3 (9 floats) + padding (3 floats) + vec4 (4 floats) = 16 floats
      const uniformData = new Float32Array(16);
      
      // Transform matrix (column-major)
      uniformData.set(transform, 0);
      
      // Color
      uniformData.set(color, 12);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

      // BindGroup作成/更新
      this.bindGroup = this.device.createBindGroup({
        label: 'Geometry Bind Group',
        layout: this.currentPipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        }]
      });
    }

    setBlendMode(mode) {
      if (mode === 'eraser') {
        this.currentPipeline = this.eraserPipeline;
      } else {
        this.currentPipeline = this.penPipeline;
      }
    }

    render(encoder, texture, width, height) {
      if (!this.initialized || !this.bindGroup || this.indexCount === 0) {
        return;
      }

      const renderPass = encoder.beginRenderPass({
        label: 'Geometry Render Pass',
        colorAttachments: [{
          view: texture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });

      renderPass.setPipeline(this.currentPipeline);
      renderPass.setBindGroup(0, this.bindGroup);
      renderPass.setVertexBuffer(0, this.vertexBuffer);
      renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
      renderPass.drawIndexed(this.indexCount);
      renderPass.end();
    }

    destroy() {
      if (this.vertexBuffer) this.vertexBuffer.destroy();
      if (this.indexBuffer) this.indexBuffer.destroy();
      if (this.uniformBuffer) this.uniformBuffer.destroy();
      this.initialized = false;
    }
  }

  window.WebGPUGeometryLayer = new WebGPUGeometryLayer();

  console.log('✅ webgpu-geometry-layer.js Phase 1 loaded');

})();