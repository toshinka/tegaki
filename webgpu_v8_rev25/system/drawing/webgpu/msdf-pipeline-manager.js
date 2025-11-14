/**
 * ================================================================================
 * msdf-pipeline-manager.js Phase 3.5 - Render統合版
 * ================================================================================
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device/queue/format)
 * - gpu-stroke-processor.js (EdgeBuffer)
 * - wgsl-loader.js (Shader読み込み)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * - webgpu-texture-bridge.js (Texture→Sprite変換)
 * 
 * 【Phase 3.5改修】
 * ✅ msdf-render.wgsl統合（Fragment Shader描画）
 * ✅ RenderPipeline実装
 * ✅ 実際の描画処理追加
 * 
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
      this.renderPipeline = null;
      
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
      console.log('✅ [MSDFPipelineManager] Phase 3.5初期化完了 (Render統合版)');
    }

    _loadShaders() {
      this.shaders.seedInit = window.MSDF_SEED_INIT_WGSL;
      this.shaders.jfaPass = window.MSDF_JFA_PASS_WGSL;
      this.shaders.encode = window.MSDF_ENCODE_WGSL;
      this.shaders.render = window.MSDF_RENDER_WGSL;

      if (!this.shaders.seedInit) throw new Error('MSDF_SEED_INIT_WGSL not found');
      if (!this.shaders.jfaPass) throw new Error('MSDF_JFA_PASS_WGSL not found');
      if (!this.shaders.encode) throw new Error('MSDF_ENCODE_WGSL not found');
      if (!this.shaders.render) throw new Error('MSDF_RENDER_WGSL not found');
    }

    async _createPipelines() {
      // Compute Pipelines
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

      // Render Pipeline
      const renderModule = this.device.createShaderModule({
        code: this.shaders.render,
        label: 'MSDF Render'
      });

      this.renderPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: renderModule,
          entryPoint: 'vertMain'
        },
        fragment: {
          module: renderModule,
          entryPoint: 'main',
          targets: [{
            format: 'rgba8unorm',
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              }
            }
          }]
        },
        primitive: {
          topology: 'triangle-strip',
          stripIndexFormat: undefined
        },
        label: 'MSDF Render Pipeline'
      });
    }

    _toU32(value) {
      return Math.max(1, Math.floor(value)) >>> 0;
    }

    _seedInitPass(gpuBuffer, seedTexture, width, height, edgeCount) {
      try {
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
            { binding: 0, resource: { buffer: gpuBuffer } },
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

      const unusedTexture = (src === seedTexture) ? texB : seedTexture;
      
      return { resultTexture: src, tempTexture: unusedTexture };
    }

    _encodePass(seedTexture, gpuBuffer, msdfTexture, width, height, edgeCount) {
      try {
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
            { binding: 1, resource: { buffer: gpuBuffer } },
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

    /**
     * MSDF Textureを最終レンダリング
     * @param {GPUTexture} msdfTexture - MSDFテクスチャ
     * @param {number} width - 幅
     * @param {number} height - 高さ
     * @param {Object} settings - ブラシ設定
     * @returns {GPUTexture} 最終出力テクスチャ
     */
    _renderMSDF(msdfTexture, width, height, settings = {}) {
      try {
        // 出力テクスチャ作成
        const outputTexture = this.device.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | 
                 GPUTextureUsage.COPY_SRC |
                 GPUTextureUsage.TEXTURE_BINDING,
          label: 'MSDF Output'
        });

        // Sampler作成
        const sampler = this.device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge'
        });

        // Uniform Buffers作成
        const renderUniformsData = new Float32Array([
          0.5,  // threshold
          0.05, // range（より細く）
          settings.opacity !== undefined ? settings.opacity : 1.0,
          0.0   // padding
        ]);
        const renderUniformsBuffer = this.device.createBuffer({
          size: renderUniformsData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Render Uniforms'
        });
        this.queue.writeBuffer(renderUniformsBuffer, 0, renderUniformsData);

        // カラー設定（消しゴムは白）
        let colorData;
        if (settings.mode === 'eraser') {
          colorData = new Float32Array([1.0, 1.0, 1.0, 1.0]); // 白
        } else {
          // ブラシカラーをRGBAに変換
          const color = this._parseColor(settings.color || '#800000');
          colorData = new Float32Array([color.r, color.g, color.b, 1.0]);
        }
        
        const colorBuffer = this.device.createBuffer({
          size: colorData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Color Uniform'
        });
        this.queue.writeBuffer(colorBuffer, 0, colorData);

        // BindGroup作成
        const bindGroup = this.device.createBindGroup({
          layout: this.renderPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: msdfTexture.createView() },
            { binding: 2, resource: { buffer: renderUniformsBuffer } },
            { binding: 3, resource: { buffer: colorBuffer } }
          ],
          label: 'Render BindGroup'
        });

        // レンダーパス実行
        const encoder = this.device.createCommandEncoder({ label: 'Render Encoder' });
        const renderPass = encoder.beginRenderPass({
          label: 'MSDF Render Pass',
          colorAttachments: [{
            view: outputTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 }
          }]
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(4, 1, 0, 0); // フルスクリーンクワッド（4頂点）
        renderPass.end();

        this.queue.submit([encoder.finish()]);

        // Buffer解放
        renderUniformsBuffer.destroy();
        colorBuffer.destroy();

        return outputTexture;

      } catch (error) {
        console.error('[MSDFPipelineManager] Render failed:', error);
        throw error;
      }
    }

    /**
     * カラー文字列をRGBA値に変換
     * @private
     */
    _parseColor(colorString) {
      const hex = colorString.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16) / 255,
        g: parseInt(hex.substr(2, 2), 16) / 255,
        b: parseInt(hex.substr(4, 2), 16) / 255
      };
    }

    /**
     * MSDF生成メインエントリーポイント
     * @param {GPUBuffer} gpuBuffer - GPU EdgeBuffer
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {GPUTexture} existingMSDF - 既存MSDF（未実装）
     * @param {Object} settings - ブラシ設定
     */
    async generateMSDF(gpuBuffer, bounds, existingMSDF = null, settings = {}) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const width = this._toU32(Math.ceil(bounds.maxX - bounds.minX));
      const height = this._toU32(Math.ceil(bounds.maxY - bounds.minY));

      // edgeCount計算（GPUBuffer.size から）
      const edgeCount = Math.floor(gpuBuffer.size / (8 * 4)); // 8 floats * 4 bytes = 32 bytes per edge

      if (edgeCount === 0) {
        console.warn('[MSDFPipelineManager] edgeCount is 0');
        return null;
      }

      // 1. Seed初期化
      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'Seed Texture'
      });

      this._seedInitPass(gpuBuffer, seedTexture, width, height, edgeCount);
      
      // 2. JFA実行
      const jfaResult = this._executeJFA(seedTexture, width, height);

      // 3. MSDF Encode
      const msdfTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'MSDF Texture'
      });

      this._encodePass(jfaResult.resultTexture, gpuBuffer, msdfTexture, width, height, edgeCount);
      
      // 4. 最終レンダリング（settings渡す）
      const finalTexture = this._renderMSDF(msdfTexture, width, height, settings);

      // 5. リソース解放
      jfaResult.tempTexture.destroy();
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
  
  console.log('✅ msdf-pipeline-manager.js Phase 3.5 loaded');
  console.log('   📊 Render Pipeline統合完了');

})();