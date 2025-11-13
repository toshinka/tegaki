/**
 * webgpu-geometry-layer.js
 * WebGPU Geometry Rendering Layer - PerfectFreehand → GPU Pipeline
 * 
 * 親依存: webgpu-drawing-layer.js (device, queue, format)
 * 子依存: stroke-renderer.js, earcut-triangulator.js
 * 
 * 責務:
 * - Polygon → VertexBuffer/IndexBuffer転送
 * - Pen/Eraser用RenderPipeline管理
 * - BlendMode切り替え (Pen: alpha合成 / Eraser: alpha減算)
 * - Transform/Color Uniform管理
 * - GPUTexture描画実行
 */

class WebGPUGeometryLayer {
  constructor() {
    this.device = null;
    this.queue = null;
    this.format = null;
    
    this.penPipeline = null;
    this.eraserPipeline = null;
    this.currentPipeline = null;
    this.currentMode = 'pen';
    
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    
    this.vertexCount = 0;
    this.indexCount = 0;
    this.maxVertices = 65536;
    this.maxIndices = 196608;
    
    this.initialized = false;
    
    this.shaderModule = null;
  }

  async initialize(device, format) {
    if (this.initialized) return;
    
    this.device = device;
    this.format = format;
    this.queue = device.queue;
    
    await this._createShaderModule();
    await this._createPipelines();
    this._createBuffers();
    
    this.currentPipeline = this.penPipeline;
    this.initialized = true;
    
    console.log('[WebGPU Geometry] Initialized - Pen/Eraser pipelines ready');
  }

  async _createShaderModule() {
    const shaderCode = `
      struct Uniforms {
        transform: mat3x3<f32>,
        color: vec4<f32>,
      };

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;

      struct VertexInput {
        @location(0) position: vec2<f32>,
      };

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
      };

      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        
        let pos = vec3<f32>(input.position, 1.0);
        let transformed = uniforms.transform * pos;
        
        output.position = vec4<f32>(transformed.xy, 0.0, 1.0);
        output.color = uniforms.color;
        
        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        return input.color;
      }
    `;

    this.shaderModule = this.device.createShaderModule({
      code: shaderCode,
      label: 'Geometry Shader Module'
    });
  }

  async _createPipelines() {
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this._createBindGroupLayout()],
      label: 'Geometry Pipeline Layout'
    });

    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0
      }]
    };

    const primitiveState = {
      topology: 'triangle-list',
      cullMode: 'none'
    };

    // Pen Pipeline (alpha blending)
    this.penPipeline = this.device.createRenderPipeline({
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
      primitive: primitiveState,
      label: 'Pen Pipeline'
    });

    // Eraser Pipeline (alpha subtraction)
    this.eraserPipeline = this.device.createRenderPipeline({
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
      primitive: primitiveState,
      label: 'Eraser Pipeline'
    });
  }

  _createBindGroupLayout() {
    return this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }],
      label: 'Geometry Bind Group Layout'
    });
  }

  _createBuffers() {
    this.vertexBuffer = this.device.createBuffer({
      size: this.maxVertices * 8,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      label: 'Vertex Buffer'
    });

    this.indexBuffer = this.device.createBuffer({
      size: this.maxIndices * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      label: 'Index Buffer'
    });

    this.uniformBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'Uniform Buffer'
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this._createBindGroupLayout(),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }],
      label: 'Geometry Bind Group'
    });
  }

  uploadPolygon(vertices, indices) {
    if (!this.initialized) {
      console.error('[WebGPU Geometry] Not initialized');
      return;
    }

    if (!vertices || vertices.length === 0) {
      console.warn('[WebGPU Geometry] Empty vertices');
      return;
    }

    this.vertexCount = vertices.length / 2;
    this.indexCount = indices ? indices.length : 0;

    this.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    
    if (indices && indices.length > 0) {
      this.queue.writeBuffer(this.indexBuffer, 0, indices);
    }
  }

  updateUniforms(transform, color) {
    if (!this.initialized) return;

    const uniformData = new Float32Array(16);
    
    // mat3x3 transform (9 floats + 3 padding)
    uniformData.set(transform, 0);
    
    // vec4 color (4 floats)
    uniformData.set(color, 12);

    this.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  setBlendMode(mode) {
    if (!this.initialized) return;
    
    this.currentMode = mode;
    this.currentPipeline = (mode === 'eraser') ? this.eraserPipeline : this.penPipeline;
  }

  render(encoder, texture, width, height) {
    if (!this.initialized || this.indexCount === 0) return;

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.currentPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.indexCount, 1, 0, 0, 0);
    renderPass.end();
  }

  destroy() {
    if (this.vertexBuffer) this.vertexBuffer.destroy();
    if (this.indexBuffer) this.indexBuffer.destroy();
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    
    this.initialized = false;
  }
}

// Global registration
if (typeof window !== 'undefined') {
  window.WebGPUGeometryLayer = new WebGPUGeometryLayer();
  console.log('[WebGPU Geometry] Class registered globally');
}