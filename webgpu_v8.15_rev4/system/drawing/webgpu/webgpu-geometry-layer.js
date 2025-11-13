/**
 * ================================================================================
 * system/drawing/webgpu/webgpu-geometry-layer.js
 * Phase 6: MSAA + Eraser BlendMode 完全実装版
 * ================================================================================
 * 
 * 【責務】
 * - PerfectFreehand Polygon → GPU VertexBuffer 直接転送
 * - Earcut Triangulation 統合
 * - WebGPU Render Pipeline (Pen/Eraser統一)
 * - 4x MSAA対応（チラツキ解消）
 * - BlendMode切り替え（Pen/Eraser）
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

  class WebGPUGeometryLayer {
    constructor() {
      this.device = null;
      this.queue = null;
      this.format = null;
      
      // Pipelines
      this.penPipeline = null;
      this.eraserPipeline = null;
      this.currentPipeline = null;
      
      // Buffers
      this.vertexBuffer = null;
      this.indexBuffer = null;
      this.uniformBuffer = null;
      this.bindGroup = null;
      
      // MSAA Texture
      this.msaaTexture = null;
      this.msaaSampleCount = 4;
      
      // State
      this.initialized = false;
      this.currentVertexCount = 0;
      this.currentIndexCount = 0;
    }

    /**
     * 初期化
     */
    async initialize(device, format) {
      if (this.initialized) {
        console.warn('[WebGPUGeometryLayer] Already initialized');
        return;
      }

      this.device = device;
      this.queue = device.queue;
      this.format = format;

      try {
        // Shader Module作成
        const shaderModule = this._createShaderModule();
        
        // Pipeline作成
        this.penPipeline = this._createPipeline(shaderModule, 'pen');
        this.eraserPipeline = this._createPipeline(shaderModule, 'eraser');
        this.currentPipeline = this.penPipeline;
        
        // Buffer作成（初期サイズ）
        this._createBuffers(10000); // 初期10000頂点
        
        this.initialized = true;
        console.log('✅ [WebGPUGeometryLayer] Initialized (4x MSAA)');
        console.log('   📊 Pen Pipeline:', this.penPipeline);
        console.log('   📊 Eraser Pipeline:', this.eraserPipeline);
        
      } catch (error) {
        console.error('❌ [WebGPUGeometryLayer] Initialization failed:', error);
        throw error;
      }
    }

    /**
     * Shader Module作成
     */
    _createShaderModule() {
      const shaderCode = `
        struct VertexInput {
          @location(0) position: vec2<f32>,
        }
        
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
        }
        
        struct Uniforms {
          transform: mat3x3<f32>,
          color: vec4<f32>,
        }
        
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        
        @vertex
        fn vs_main(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          
          // Local → NDC変換
          let pos = uniforms.transform * vec3<f32>(input.position, 1.0);
          output.position = vec4<f32>(pos.xy, 0.0, 1.0);
          
          return output;
        }
        
        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
          return uniforms.color;
        }
      `;

      return this.device.createShaderModule({
        label: 'Geometry Shader',
        code: shaderCode
      });
    }

    /**
     * Pipeline作成
     */
    _createPipeline(shaderModule, mode) {
      const blendState = mode === 'eraser' ? {
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
      } : {
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
      };

      return this.device.createRenderPipeline({
        label: `${mode === 'eraser' ? 'Eraser' : 'Pen'} Pipeline`,
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 8, // vec2<f32> = 8 bytes
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2'
            }]
          }]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: this.format,
            blend: blendState
          }]
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none'
        },
        multisample: {
          count: this.msaaSampleCount
        }
      });
    }

    /**
     * Buffer作成
     */
    _createBuffers(maxVertices) {
      // Vertex Buffer
      this.vertexBuffer = this.device.createBuffer({
        label: 'Geometry Vertex Buffer',
        size: maxVertices * 8, // vec2<f32>
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      // Index Buffer
      this.indexBuffer = this.device.createBuffer({
        label: 'Geometry Index Buffer',
        size: maxVertices * 6 * 4, // 概算: 頂点数 * 2三角形 * 4bytes
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      // Uniform Buffer (transform 3x3 + color vec4 = 13 floats → 64 bytes aligned)
      this.uniformBuffer = this.device.createBuffer({
        label: 'Geometry Uniform Buffer',
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      // BindGroup作成
      this.bindGroup = this.device.createBindGroup({
        label: 'Geometry Bind Group',
        layout: this.currentPipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        }]
      });
    }

    /**
     * Polygon Upload
     */
    uploadPolygon(vertices, indices) {
      if (!this.initialized) {
        console.error('❌ [WebGPUGeometryLayer] Not initialized');
        return;
      }

      // Buffer拡張チェック
      const requiredVertexSize = vertices.byteLength;
      const requiredIndexSize = indices.byteLength;

      if (requiredVertexSize > this.vertexBuffer.size) {
        this.vertexBuffer.destroy();
        this.vertexBuffer = this.device.createBuffer({
          label: 'Geometry Vertex Buffer',
          size: requiredVertexSize * 2,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
      }

      if (requiredIndexSize > this.indexBuffer.size) {
        this.indexBuffer.destroy();
        this.indexBuffer = this.device.createBuffer({
          label: 'Geometry Index Buffer',
          size: requiredIndexSize * 2,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });
      }

      // Upload
      this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
      this.device.queue.writeBuffer(this.indexBuffer, 0, indices);

      this.currentVertexCount = vertices.length / 2;
      this.currentIndexCount = indices.length;
    }

    /**
     * Transform/Color更新
     */
    updateUniforms(transform, color) {
      if (!this.initialized) return;

      // Uniform Data (mat3x3 + vec4 = 13 floats)
      const uniformData = new Float32Array(16); // 64 bytes aligned
      
      // Transform (row-major)
      uniformData.set(transform, 0); // 9 floats
      
      // Color
      uniformData[12] = color[0];
      uniformData[13] = color[1];
      uniformData[14] = color[2];
      uniformData[15] = color[3];

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    /**
     * BlendMode切り替え
     */
    setBlendMode(mode) {
      if (mode === 'eraser') {
        this.currentPipeline = this.eraserPipeline;
      } else {
        this.currentPipeline = this.penPipeline;
      }

      // BindGroup再作成（Pipeline変更時に必要）
      this.bindGroup = this.device.createBindGroup({
        label: 'Geometry Bind Group',
        layout: this.currentPipeline.getBindGroupLayout(0),
        entries: [{
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        }]
      });
    }

    /**
     * MSAA Texture作成
     */
    _createMSAATexture(width, height) {
      if (this.msaaTexture) {
        this.msaaTexture.destroy();
      }

      this.msaaTexture = this.device.createTexture({
        label: 'MSAA Texture',
        size: { width, height },
        format: this.format,
        sampleCount: this.msaaSampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      return this.msaaTexture.createView();
    }

    /**
     * 描画実行
     */
    render(encoder, targetTexture, width, height) {
      if (!this.initialized || this.currentIndexCount === 0) {
        return;
      }

      // MSAA Texture作成
      const msaaView = this._createMSAATexture(width, height);
      const targetView = targetTexture.createView();

      // Render Pass
      const passDescriptor = {
        label: 'Geometry Render Pass',
        colorAttachments: [{
          view: msaaView,
          resolveTarget: targetView,
          loadOp: 'load',
          storeOp: 'store'
        }]
      };

      const pass = encoder.beginRenderPass(passDescriptor);
      pass.setPipeline(this.currentPipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setIndexBuffer(this.indexBuffer, 'uint32');
      pass.drawIndexed(this.currentIndexCount);
      pass.end();
    }

    /**
     * クリーンアップ
     */
    destroy() {
      if (this.vertexBuffer) this.vertexBuffer.destroy();
      if (this.indexBuffer) this.indexBuffer.destroy();
      if (this.uniformBuffer) this.uniformBuffer.destroy();
      if (this.msaaTexture) this.msaaTexture.destroy();
      
      this.initialized = false;
    }
  }

  // Global登録
  window.WebGPUGeometryLayer = new WebGPUGeometryLayer();

})();