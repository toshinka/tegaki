/**
 * ================================================================================
 * webgpu-geometry-layer.js - Phase 1 完全実装版
 * ================================================================================
 * 
 * 【責務】
 * - PerfectFreehandポリゴン → GPU VertexBuffer転送
 * - Pen/Eraser用のRenderPipeline管理
 * - Shader実行とBlendMode制御
 * 
 * 【親ファイル依存】
 * - webgpu-drawing-layer.js: GPUDevice, Queue, Format供給
 * - earcut-triangulator.js: ポリゴン三角形分割
 * 
 * 【子ファイル呼び出し】
 * - stroke-renderer.js: レンダリング統合
 * 
 * 【グローバル公開】
 * - window.WebGPUGeometryLayer (シングルトンインスタンス)
 * 
 * 【禁止事項】
 * 🚫 Canvas2D API使用
 * 🚫 PixiJS Graphics使用
 * 🚫 CPU側ラスタライズ
 * 
 * ================================================================================
 */

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

  /**
   * 初期化
   * @param {GPUDevice} device 
   * @param {string} format - 'rgba8unorm'
   */
  async initialize(device, format) {
    if (this.initialized) return;

    this.device = device;
    this.format = format;
    this.queue = device.queue;

    // Shader Module作成
    const shaderModule = device.createShaderModule({
      label: 'Geometry Shader',
      code: this._getShaderCode()
    });

    // Pipeline Layout
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        }
      ]
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    // Pen Pipeline
    this.penPipeline = device.createRenderPipeline({
      label: 'Pen Pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 16, // vec2 position + vec2 uv
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' }
          ]
        }]
      },
      fragment: {
        module: shaderModule,
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
        count: 1
      }
    });

    // Eraser Pipeline
    this.eraserPipeline = device.createRenderPipeline({
      label: 'Eraser Pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x2' }
          ]
        }]
      },
      fragment: {
        module: shaderModule,
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
        count: 1
      }
    });

    this.currentPipeline = this.penPipeline;

    // Uniform Buffer作成 (transform mat3x3 + color vec4 = 48 bytes)
    this.uniformBuffer = device.createBuffer({
      size: 64, // 16バイトアラインメント考慮
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // BindGroup作成
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    });

    this.initialized = true;
    console.log('✅ webgpu-geometry-layer.js Phase 1 完全実装版 loaded');
  }

  /**
   * ポリゴンアップロード
   * @param {Float32Array} vertices - [x, y, u, v, ...]
   * @param {Uint32Array} indices 
   */
  uploadPolygon(vertices, indices) {
    if (!this.initialized) {
      throw new Error('[WebGPUGeometryLayer] Not initialized');
    }

    // VertexBuffer作成
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
    }
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    // IndexBuffer作成
    if (this.indexBuffer) {
      this.indexBuffer.destroy();
    }
    this.indexBuffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.indexBuffer, 0, indices);

    this.vertexCount = vertices.length / 4; // vec2 + vec2
    this.indexCount = indices.length;
  }

  /**
   * Uniform更新
   * @param {Float32Array} transform - 3x3 matrix (9 floats)
   * @param {Float32Array} color - RGBA (4 floats)
   */
  updateUniforms(transform, color) {
    if (!this.initialized) return;

    const uniformData = new Float32Array(16); // 64 bytes
    uniformData.set(transform, 0); // 9 floats
    uniformData.set(color, 12);    // 4 floats (48バイト目から)

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * BlendMode設定
   * @param {string} mode - 'pen' or 'eraser'
   */
  setBlendMode(mode) {
    if (mode === 'eraser') {
      this.currentPipeline = this.eraserPipeline;
    } else {
      this.currentPipeline = this.penPipeline;
    }
  }

  /**
   * レンダリング実行
   * @param {GPUCommandEncoder} encoder 
   * @param {GPUTexture} targetTexture 
   * @param {number} width 
   * @param {number} height 
   */
  render(encoder, targetTexture, width, height) {
    if (!this.initialized || !this.vertexBuffer || this.indexCount === 0) {
      return;
    }

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetTexture.createView(),
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.currentPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.indexCount);
    renderPass.end();
  }

  /**
   * Shader Code取得
   */
  _getShaderCode() {
    return `
struct Uniforms {
  transform: mat3x3<f32>,
  color: vec4<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // Transform適用
  let pos = uniforms.transform * vec3<f32>(input.position, 1.0);
  output.position = vec4<f32>(pos.xy, 0.0, 1.0);
  output.uv = input.uv;
  
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return uniforms.color;
}
`;
  }

  /**
   * 破棄
   */
  destroy() {
    if (this.vertexBuffer) this.vertexBuffer.destroy();
    if (this.indexBuffer) this.indexBuffer.destroy();
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    this.initialized = false;
  }
}

// ================================================================================
// グローバル登録
// ================================================================================

if (!window.WebGPUGeometryLayer) {
  window.WebGPUGeometryLayer = new WebGPUGeometryLayer();
} else {
  console.warn('⚠️ WebGPUGeometryLayer already initialized');
}