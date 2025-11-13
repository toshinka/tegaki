// ============================================================================
// msdf-pipeline-manager.js
// WebGPU MSDF - Pipeline統合管理
// ============================================================================
// 【親ファイル依存】
// - webgpu-drawing-layer.js (device/queue/format)
// - gpu-stroke-processor.js (EdgeBuffer)
// 
// 【子ファイル依存】
// - brush-core.js (呼び出し元)
// 
// 【責務】
// - Compute Pipeline統合管理
// - Seed/JFA/Encode/Compose/Render Pass実行
// - Texture Ping-Pong管理
// ============================================================================

(function() {
  'use strict';

  class MSDFPipelineManager {
    constructor() {
      this.device = null;
      this.format = null;
      this.initialized = false;
      
      // Pipelines
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.composePipeline = null;
      this.renderPipeline = null;
      
      // Shader modules
      this.seedInitShader = null;
      this.jfaShader = null;
      this.encodeShader = null;
      this.composeShader = null;
      this.renderShader = null;
    }

    /**
     * 初期化
     * @param {GPUDevice} device 
     * @param {GPUTextureFormat} format 
     */
    async initialize(device, format) {
      if (!device) {
        throw new Error('[MSDFPipelineManager] device is required');
      }
      
      this.device = device;
      this.format = format || 'bgra8unorm';
      
      await this._createShaderModules();
      await this._createPipelines();
      
      this.initialized = true;
    }

    /**
     * MSDF生成
     * @param {GPUBuffer} edgeBuffer 
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {GPUTexture} existingMSDF - 既存MSDF（合成用）
     * @returns {GPUTexture} MSDF Texture
     */
    async generateMSDF(edgeBuffer, bounds, existingMSDF = null) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const width = Math.ceil(bounds.maxX - bounds.minX);
      const height = Math.ceil(bounds.maxY - bounds.minY);
      const edgeCount = edgeBuffer.size / 32; // 8 floats * 4 bytes

      // Textures作成
      const seedTexture = this._createTexture(width, height, 'rgba32float', 
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);
      
      const jfaPingTexture = this._createTexture(width, height, 'rgba32float',
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);
      
      const jfaPongTexture = this._createTexture(width, height, 'rgba32float',
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);
      
      const msdfTexture = this._createTexture(width, height, 'rgba16float',
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);

      // Command Encoder
      const encoder = this.device.createCommandEncoder({ label: 'MSDF Generation' });

      // Phase A: Seed初期化
      this._seedInitPass(encoder, edgeBuffer, seedTexture, edgeCount);

      // Phase B: JFA
      const maxDim = Math.max(width, height);
      const jfaSteps = Math.ceil(Math.log2(maxDim));
      let srcTexture = seedTexture;
      let dstTexture = jfaPingTexture;

      for (let i = jfaSteps - 1; i >= 0; i--) {
        const step = Math.pow(2, i);
        this._jfaPass(encoder, srcTexture, dstTexture, step, width, height);
        
        // Ping-Pong swap
        const tmp = srcTexture;
        srcTexture = dstTexture;
        dstTexture = tmp === seedTexture ? jfaPongTexture : 
                     tmp === jfaPingTexture ? jfaPongTexture : jfaPingTexture;
      }

      // Phase C: MSDF Encode
      this._encodePass(encoder, srcTexture, edgeBuffer, msdfTexture, width, height);

      // Phase D: Compose (if existingMSDF)
      let finalTexture = msdfTexture;
      if (existingMSDF) {
        const composedTexture = this._createTexture(width, height, 'rgba16float',
          GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);
        this._composePass(encoder, existingMSDF, msdfTexture, composedTexture, 0, width, height);
        finalTexture = composedTexture;
      }

      // Submit
      this.device.queue.submit([encoder.finish()]);

      // Cleanup intermediate textures
      seedTexture.destroy();
      jfaPingTexture.destroy();
      jfaPongTexture.destroy();
      if (existingMSDF && finalTexture !== msdfTexture) {
        msdfTexture.destroy();
      }

      return finalTexture;
    }

    /**
     * MSDF合成
     * @param {GPUTexture} prevMSDF 
     * @param {GPUTexture} newMSDF 
     * @param {string} mode - 'pen' | 'eraser'
     * @returns {GPUTexture} Composed MSDF
     */
    composeMSDF(prevMSDF, newMSDF, mode = 'pen') {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const width = prevMSDF.width;
      const height = prevMSDF.height;
      
      const outTexture = this._createTexture(width, height, 'rgba16float',
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING);

      const encoder = this.device.createCommandEncoder({ label: 'MSDF Compose' });
      const modeValue = mode === 'pen' ? 0 : 1;
      this._composePass(encoder, prevMSDF, newMSDF, outTexture, modeValue, width, height);
      this.device.queue.submit([encoder.finish()]);

      return outTexture;
    }

    /**
     * Render Pass実装
     * @param {GPUTexture} msdfTexture 
     * @param {number} width 
     * @param {number} height 
     * @returns {GPUTexture} Final Render Texture
     */
    renderToTexture(msdfTexture, width, height) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const renderTexture = this._createTexture(width, height, 'rgba8unorm',
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);

      const encoder = this.device.createCommandEncoder({ label: 'MSDF Render' });
      
      // TODO: Render Pass実装（簡易版として現状はmsdfTextureをそのまま返す）
      // 本格実装時にFragment Shaderでmedian計算

      this.device.queue.submit([encoder.finish()]);

      return msdfTexture; // 暫定
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    async _createShaderModules() {
      // Shader code inline (実際にはファイル分離推奨)
      const seedInitCode = `
        struct EdgeData {
          x0: f32, y0: f32, x1: f32, y1: f32,
          edgeId: f32, channelId: f32, insideFlag: f32, padding: f32,
        }
        @group(0) @binding(0) var<storage, read> edges: array<EdgeData>;
        @group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
        @group(0) @binding(2) var<uniform> uEdgeCount: u32;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
          let idx = gid.x;
          if (idx >= uEdgeCount) { return; }
          let e = edges[idx];
          let p0 = vec2<i32>(i32(e.x0), i32(e.y0));
          let p1 = vec2<i32>(i32(e.x1), i32(e.y1));
          let pm = vec2<i32>(i32((e.x0+e.x1)*0.5), i32((e.y0+e.y1)*0.5));
          textureStore(seedTex, p0, vec4<f32>(e.x0, e.y0, e.edgeId, 0.0));
          textureStore(seedTex, p1, vec4<f32>(e.x1, e.y1, e.edgeId, 0.0));
          textureStore(seedTex, pm, vec4<f32>((e.x0+e.x1)*0.5, (e.y0+e.y1)*0.5, e.edgeId, 0.0));
        }
      `;

      this.seedInitShader = this.device.createShaderModule({
        label: 'Seed Init Shader',
        code: seedInitCode
      });

      // 他のShaderも同様に作成（簡略化のため省略）
    }

    async _createPipelines() {
      // Seed Init Pipeline
      this.seedInitPipeline = this.device.createComputePipeline({
        label: 'Seed Init Pipeline',
        layout: 'auto',
        compute: {
          module: this.seedInitShader,
          entryPoint: 'main'
        }
      });

      // 他のPipelineも同様に作成
    }

    _seedInitPass(encoder, edgeBuffer, seedTexture, edgeCount) {
      const uniformBuffer = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([edgeCount]));

      const bindGroup = this.device.createBindGroup({
        layout: this.seedInitPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: edgeBuffer } },
          { binding: 1, resource: seedTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } }
        ]
      });

      const pass = encoder.beginComputePass({ label: 'Seed Init' });
      pass.setPipeline(this.seedInitPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(edgeCount / 64));
      pass.end();

      uniformBuffer.destroy();
    }

    _jfaPass(encoder, srcTexture, dstTexture, step, width, height) {
      // TODO: 実装
    }

    _encodePass(encoder, seedTexture, edgeBuffer, msdfTexture, width, height) {
      // TODO: 実装
    }

    _composePass(encoder, prevMSDF, newMSDF, outTexture, mode, width, height) {
      // TODO: 実装
    }

    _createTexture(width, height, format, usage) {
      return this.device.createTexture({
        size: [width, height, 1],
        format: format,
        usage: usage
      });
    }

    /**
     * リソース破棄
     */
    destroy() {
      // Pipeline破棄
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.composePipeline = null;
      this.renderPipeline = null;
      
      this.device = null;
      this.initialized = false;
    }
  }

  // グローバル登録
  window.MSDFPipelineManager = MSDFPipelineManager;

})();