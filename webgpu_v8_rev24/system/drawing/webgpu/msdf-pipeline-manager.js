/**
 * ================================================================================
 * msdf-pipeline-manager.js Phase 3.4完全版
 * ================================================================================
 * 📁 Parents: webgpu-drawing-layer.js, gpu-stroke-processor.js, wgsl-loader.js
 * 📄 Children: brush-core.js, webgpu-texture-bridge.js
 * 
 * 🔧 Phase 3.4修正:
 *   - Texture破棄タイミング修正（使用完了後に破棄）
 *   - リソース管理の適正化
 * ================================================================================
 */

(function() {
  'use strict';

  class MSDFPipelineManager {
    constructor() {
      this.device = null;
      this.queue = null;
      this.format = null;
      
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      
      this.shaders = {};
      this.initialized = false;
    }

    async initialize(device, format) {
      if (this.initialized) {
        console.warn('[MSDFPipelineManager] Already initialized');
        return;
      }

      this.device = device;
      this.format = format;
      this.queue = device.queue;

      this._loadShaders();
      await this._createPipelines();

      this.initialized = true;
      console.log('✅ [MSDFPipelineManager] Phase 3.4初期化完了');
    }

    _loadShaders() {
      this.shaders.seedInit = window.MSDF_SEED_INIT_WGSL;
      this.shaders.jfaPass = window.MSDF_JFA_PASS_WGSL;
      this.shaders.encode = window.MSDF_ENCODE_WGSL;

      if (!this.shaders.seedInit) throw new Error('MSDF_SEED_INIT_WGSL not found');
      if (!this.shaders.jfaPass) throw new Error('MSDF_JFA_PASS_WGSL not found');
      if (!this.shaders.encode) throw new Error('MSDF_ENCODE_WGSL not found');
    }

    async _createPipelines() {
      const seedInitModule = this.device.createShaderModule({
        code: this.shaders.seedInit,
        label: 'MSDF Seed Init'
      });

      this.seedInitPipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: seedInitModule, entryPoint: 'main' },
        label: 'MSDF Seed Init Pipeline'
      });

      const jfaModule = this.device.createShaderModule({
        code: this.shaders.jfaPass,
        label: 'MSDF JFA Pass'
      });

      this.jfaPipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: jfaModule, entryPoint: 'main' },
        label: 'MSDF JFA Pipeline'
      });

      const encodeModule = this.device.createShaderModule({
        code: this.shaders.encode,
        label: 'MSDF Encode'
      });

      this.encodePipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: encodeModule, entryPoint: 'main' },
        label: 'MSDF Encode Pipeline'
      });
    }

    _toU32(value) {
      return Math.max(1, Math.floor(value)) >>> 0;
    }

    _seedInitPass(edgeBuffer, seedTexture, width, height) {
      try {
        const edgeCount = Math.ceil(edgeBuffer.byteLength / 32);
        
        const configData = new Float32Array([width, height, edgeCount, 0]);
        const configBuffer = this.device.createBuffer({
          size: configData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Seed Init Config'
        });
        this.queue.writeBuffer(configBuffer, 0, configData);

        const bindGroup = this.device.createBindGroup({
          layout: this.seedInitPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: edgeBuffer } },
            { binding: 1, resource: seedTexture.createView() },
            { binding: 2, resource: { buffer: configBuffer } }
          ],
          label: 'Seed Init BindGroup'
        });

        const encoder = this.device.createCommandEncoder({ label: 'Seed Init Encoder' });
        const pass = encoder.beginComputePass({ label: 'Seed Init Pass' });
        pass.setPipeline(this.seedInitPipeline);
        pass.setBindGroup(0, bindGroup);
        
        const workgroups = this._toU32(Math.ceil(edgeCount / 64));
        pass.dispatchWorkgroups(workgroups);
        
        pass.end();
        this.queue.submit([encoder.finish()]);
        
        configBuffer.destroy();
      } catch (error) {
        console.error('[MSDFPipelineManager] Seed Init failed:', error);
        throw error;
      }
    }

    _jfaPass(srcTexture, dstTexture, width, height, step) {
      try {
        const configData = new Uint32Array([step, width, height, 0]);
        const configBuffer = this.device.createBuffer({
          size: configData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'JFA Config'
        });
        this.queue.writeBuffer(configBuffer, 0, configData);

        const bindGroup = this.device.createBindGroup({
          layout: this.jfaPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: srcTexture.createView() },
            { binding: 1, resource: dstTexture.createView() },
            { binding: 2, resource: { buffer: configBuffer } }
          ],
          label: 'JFA BindGroup'
        });

        const encoder = this.device.createCommandEncoder({ label: 'JFA Encoder' });
        const pass = encoder.beginComputePass({ label: 'JFA Pass' });
        pass.setPipeline(this.jfaPipeline);
        pass.setBindGroup(0, bindGroup);
        
        const workgroupsX = this._toU32(Math.ceil(width / 8));
        const workgroupsY = this._toU32(Math.ceil(height / 8));
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        
        pass.end();
        this.queue.submit([encoder.finish()]);
        
        configBuffer.destroy();
      } catch (error) {
        console.error('[MSDFPipelineManager] JFA Pass failed:', error);
        throw error;
      }
    }

    _executeJFA(seedTexture, width, height) {
      const texB = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'JFA Ping-Pong B'
      });

      const maxDim = Math.max(width, height);
      const steps = Math.ceil(Math.log2(maxDim));
      
      let src = seedTexture;
      let dst = texB;

      for (let i = steps - 1; i >= 0; i--) {
        this._jfaPass(src, dst, width, height, Math.pow(2, i));
        [src, dst] = [dst, src];
      }

      // 🔧 修正: 使用されなかったテクスチャを破棄（最終結果はsrcに入っている）
      const unusedTexture = (src === seedTexture) ? texB : seedTexture;
      
      // 戻り値はJFA結果と、破棄すべきテクスチャ
      return { resultTexture: src, tempTexture: unusedTexture };
    }

    _encodePass(seedTexture, edgeBuffer, msdfTexture, width, height) {
      try {
        const edgeCount = Math.ceil(edgeBuffer.byteLength / 32);
        
        const configData = new Float32Array([width, height, edgeCount, 0.1]);
        const configBuffer = this.device.createBuffer({
          size: configData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Encode Config'
        });
        this.queue.writeBuffer(configBuffer, 0, configData);

        const bindGroup = this.device.createBindGroup({
          layout: this.encodePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: seedTexture.createView() },
            { binding: 1, resource: { buffer: edgeBuffer } },
            { binding: 2, resource: msdfTexture.createView() },
            { binding: 3, resource: { buffer: configBuffer } }
          ],
          label: 'Encode BindGroup'
        });

        const encoder = this.device.createCommandEncoder({ label: 'Encode Encoder' });
        const pass = encoder.beginComputePass({ label: 'Encode Pass' });
        pass.setPipeline(this.encodePipeline);
        pass.setBindGroup(0, bindGroup);
        
        const workgroupsX = this._toU32(Math.ceil(width / 8));
        const workgroupsY = this._toU32(Math.ceil(height / 8));
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        
        pass.end();
        this.queue.submit([encoder.finish()]);
        
        configBuffer.destroy();
      } catch (error) {
        console.error('[MSDFPipelineManager] Encode Pass failed:', error);
        throw error;
      }
    }

    _simpleRender(msdfTexture, width, height) {
      const outputTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | 
               GPUTextureUsage.COPY_SRC |
               GPUTextureUsage.TEXTURE_BINDING,
        label: 'MSDF Output'
      });

      const encoder = this.device.createCommandEncoder({ label: 'Render Encoder' });
      const renderPass = encoder.beginRenderPass({
        label: 'Simple Render Pass',
        colorAttachments: [{
          view: outputTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });
      renderPass.end();

      this.queue.submit([encoder.finish()]);

      return outputTexture;
    }

    async generateMSDF(edgeBuffer, bounds, existingMSDF = null) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const width = this._toU32(Math.ceil(bounds.maxX - bounds.minX));
      const height = this._toU32(Math.ceil(bounds.maxY - bounds.minY));

      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'Seed Texture'
      });

      this._seedInitPass(edgeBuffer, seedTexture, width, height);
      
      // 🔧 修正: JFA結果と一時テクスチャを分離
      const jfaResult = this._executeJFA(seedTexture, width, height);

      const msdfTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'MSDF Texture'
      });

      this._encodePass(jfaResult.resultTexture, edgeBuffer, msdfTexture, width, height);
      
      // 🔧 修正: Encode完了後に一時テクスチャを破棄
      jfaResult.tempTexture.destroy();
      
      const finalTexture = this._simpleRender(msdfTexture, width, height);

      // 使用済みテクスチャを破棄
      if (jfaResult.resultTexture !== seedTexture) {
        seedTexture.destroy();
      }
      msdfTexture.destroy();

      return finalTexture;
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.MSDFPipelineManager = new MSDFPipelineManager();
  
  console.log('✅ msdf-pipeline-manager.js Phase 3.4完全版 loaded');
  console.log('   🔧 Texture破棄タイミング修正');

})();