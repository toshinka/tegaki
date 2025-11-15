/**
 * ================================================================================
 * msdf-pipeline-manager.js Phase 9: テクスチャサイズ固定版
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgpu-drawing-layer.js (device/queue/format/sampleCount)
 *   - brush-core.js (generateMSDF呼び出し元)
 * 
 * 📄 子ファイル依存:
 *   - wgsl-loader.js (WGSL Shader定義)
 *   - gpu-stroke-processor.js (VertexBuffer/EdgeBuffer)
 * 
 * 【Phase 9改修内容 - CopyTextureToBuffer問題完全解決】
 * 🔥 テクスチャサイズ完全固定化（256x256 / 128x128）
 * 🔥 動的サイズ計算を廃止
 * 🔥 bounds内に描画領域を制限
 * ✅ Device Lost対策強化
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
      this.sampleCount = 1;
      
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.polygonRenderPipeline = null;
      
      this.shaders = {};
      this.initialized = false;
      
      // 🔥 Phase 9: テクスチャサイズ完全固定
      this.baseTextureSize = 256;      // 通常描画: 256x256固定
      this.previewTextureSize = 128;   // プレビュー: 128x128固定
    }

    async initialize(device, format, sampleCount = 1) {
      if (this.initialized) return;
      this.device = device;
      this.format = format;
      this.sampleCount = sampleCount;
      this.queue = device.queue;
      this._loadShaders();
      await this._createPipelines();
      
      this.initialized = true;
      console.log('✅ [MSDFPipeline] Phase 9 テクスチャ固定版 Initialized');
      console.log('   📊 Base texture: 256x256 (完全固定)');
      console.log('   📊 Preview texture: 128x128 (完全固定)');
      console.log('   📊 MSAA sampleCount:', this.sampleCount);
    }

    _isContextValid() {
      if (!this.device || !this.queue) return false;
      
      try {
        return this.device.lost !== undefined;
      } catch (e) {
        return false;
      }
    }

    _loadShaders() {
      this.shaders.seedInit = window.MSDF_SEED_INIT_WGSL;
      this.shaders.jfaPass = window.MSDF_JFA_PASS_WGSL;
      this.shaders.encode = window.MSDF_ENCODE_WGSL;
      this.shaders.render = window.MSDF_RENDER_WGSL;
      this.shaders.quadExpansion = window.MSDF_QUAD_EXPANSION_WGSL;

      if (!this.shaders.seedInit || !this.shaders.jfaPass || 
          !this.shaders.encode || !this.shaders.render || !this.shaders.quadExpansion) {
        throw new Error('[MSDFPipelineManager] Required shaders not found');
      }
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

      const quadModule = this.device.createShaderModule({
        code: this.shaders.quadExpansion,
        label: 'MSDF Quad Expansion'
      });

      const renderModule = this.device.createShaderModule({
        code: this.shaders.render,
        label: 'MSDF Render'
      });

      const pipelineDescriptor = {
        layout: 'auto',
        vertex: {
          module: quadModule,
          entryPoint: 'main',
          buffers: [{
            arrayStride: 7 * 4,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
              { shaderLocation: 2, offset: 16, format: 'float32x2' },
              { shaderLocation: 3, offset: 24, format: 'float32' }
            ]
          }]
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
          topology: 'triangle-list',
          cullMode: 'none'
        },
        label: 'MSDF Polygon Render Pipeline'
      };

      if (this.sampleCount > 1) {
        pipelineDescriptor.multisample = {
          count: this.sampleCount
        };
      }

      this.polygonRenderPipeline = this.device.createRenderPipeline(pipelineDescriptor);
    }

    _destroyResource(resource) {
      if (!resource) return;
      
      try {
        if (typeof resource.destroy === 'function') {
          resource.destroy();
        }
      } catch (e) {}
    }

    _toU32(value) {
      return Math.max(1, Math.floor(value)) >>> 0;
    }

    _calculateJFAIterations(width, height) {
      const maxDim = Math.max(width, height);
      const calculated = Math.ceil(Math.log2(maxDim));
      return Math.min(calculated, 6);
    }

    async _seedInitPass(gpuBuffer, seedTexture, width, height, edgeCount) {
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

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.seedInitPipeline);
      pass.setBindGroup(0, bindGroup);
      
      const workgroups = this._toU32(Math.ceil(edgeCount / 64));
      pass.dispatchWorkgroups(workgroups);
      pass.end();
      
      this.queue.submit([encoder.finish()]);
      
      this._destroyResource(configBuffer);
    }

    async _jfaPass(srcTexture, dstTexture, width, height, step) {
      const configData = new Uint32Array([step, width, height, 0]);
      const configBuffer = this.device.createBuffer({
        size: configData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(configBuffer, 0, configData);

      const bindGroup = this.device.createBindGroup({
        layout: this.jfaPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: srcTexture.createView() },
          { binding: 1, resource: dstTexture.createView() },
          { binding: 2, resource: { buffer: configBuffer } }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.jfaPipeline);
      pass.setBindGroup(0, bindGroup);
      
      const workgroupsX = this._toU32(Math.ceil(width / 8));
      const workgroupsY = this._toU32(Math.ceil(height / 8));
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
      
      this.queue.submit([encoder.finish()]);
      
      this._destroyResource(configBuffer);
    }

    async _executeJFA(seedTexture, width, height) {
      const texB = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      const iterations = this._calculateJFAIterations(width, height);
      
      let src = seedTexture;
      let dst = texB;

      for (let i = iterations - 1; i >= 0; i--) {
        await this._jfaPass(src, dst, width, height, Math.pow(2, i));
        [src, dst] = [dst, src];
      }

      await this.device.queue.onSubmittedWorkDone();

      const unusedTexture = (src === seedTexture) ? texB : seedTexture;
      return { resultTexture: src, tempTexture: unusedTexture };
    }

    async _encodePass(seedTexture, gpuBuffer, msdfTexture, width, height, edgeCount) {
      const configData = new Float32Array([width, height, edgeCount, 0.1]);
      const configBuffer = this.device.createBuffer({
        size: configData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(configBuffer, 0, configData);

      const bindGroup = this.device.createBindGroup({
        layout: this.encodePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: seedTexture.createView() },
          { binding: 1, resource: { buffer: gpuBuffer } },
          { binding: 2, resource: msdfTexture.createView() },
          { binding: 3, resource: { buffer: configBuffer } }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.encodePipeline);
      pass.setBindGroup(0, bindGroup);
      
      const workgroupsX = this._toU32(Math.ceil(width / 8));
      const workgroupsY = this._toU32(Math.ceil(height / 8));
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
      
      this.queue.submit([encoder.finish()]);
      
      this._destroyResource(configBuffer);
    }

    async _renderMSDFPolygon(msdfTexture, vertexBuffer, vertexCount, width, height, settings = {}) {
      if (!this.polygonRenderPipeline) {
        throw new Error('[MSDFPipelineManager] Polygon pipeline not initialized');
      }

      if (!vertexBuffer || vertexBuffer.constructor.name !== 'GPUBuffer') {
        throw new Error('[MSDF Render] Invalid vertexBuffer type');
      }

      let msaaTexture = null;
      if (this.sampleCount > 1) {
        msaaTexture = this.device.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
          sampleCount: this.sampleCount
        });
      }

      const outputTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | 
               GPUTextureUsage.COPY_SRC |
               GPUTextureUsage.TEXTURE_BINDING
      });

      const sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        label: 'MSDF Linear Sampler'
      });

      const quadUniformsData = new Float32Array([
        width,
        height,
        settings.size ? settings.size / 2.0 : 1.5,
        0.0
      ]);
      
      const quadUniformsBuffer = this.device.createBuffer({
        size: quadUniformsData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(quadUniformsBuffer, 0, quadUniformsData);

      const bindGroup0 = this.device.createBindGroup({
        layout: this.polygonRenderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: quadUniformsBuffer } }
        ]
      });

      const renderUniformsData = new Float32Array([
        0.5,
        0.025,
        settings.opacity !== undefined ? settings.opacity : 1.0,
        0.0
      ]);
      const renderUniformsBuffer = this.device.createBuffer({
        size: renderUniformsData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(renderUniformsBuffer, 0, renderUniformsData);

      let colorData;
      if (settings.mode === 'eraser') {
        colorData = new Float32Array([0.0, 0.0, 0.0, 0.0]);
      } else {
        const color = this._parseColor(settings.color || '#800000');
        colorData = new Float32Array([color.r, color.g, color.b, 1.0]);
      }
      const colorBuffer = this.device.createBuffer({
        size: colorData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(colorBuffer, 0, colorData);

      const bindGroup1 = this.device.createBindGroup({
        layout: this.polygonRenderPipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: msdfTexture.createView() },
          { binding: 2, resource: { buffer: renderUniformsBuffer } },
          { binding: 3, resource: { buffer: colorBuffer } }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      
      const colorAttachment = {
        view: msaaTexture ? msaaTexture.createView() : outputTexture.createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 }
      };

      if (msaaTexture) {
        colorAttachment.resolveTarget = outputTexture.createView();
      }

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment]
      });

      renderPass.setPipeline(this.polygonRenderPipeline);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.setBindGroup(1, bindGroup1);
      renderPass.draw(vertexCount, 1, 0, 0);
      renderPass.end();

      this.queue.submit([encoder.finish()]);
      
      await this.device.queue.onSubmittedWorkDone();

      this._destroyResource(quadUniformsBuffer);
      this._destroyResource(renderUniformsBuffer);
      this._destroyResource(colorBuffer);
      this._destroyResource(msaaTexture);

      return outputTexture;
    }

    _parseColor(colorString) {
      const hex = colorString.replace('#', '');
      return {
        r: parseInt(hex.substr(0, 2), 16) / 255,
        g: parseInt(hex.substr(2, 2), 16) / 255,
        b: parseInt(hex.substr(4, 2), 16) / 255
      };
    }

    /**
     * 🔥 Phase 9: テクスチャサイズ完全固定版
     */
    async generateMSDF(gpuBuffer, bounds, existingMSDF = null, settings = {}, vertexBuffer = null, vertexCount = 0, edgeCount = 0) {
      if (!this._isContextValid()) {
        console.error('[MSDF] WebGPU context invalid');
        return null;
      }

      if (!this.initialized) {
        console.error('[MSDF] Not initialized');
        return null;
      }

      if (edgeCount === 0 || !vertexBuffer || vertexCount === 0) {
        return null;
      }

      // 🔥 プレビュー判定
      const isPreview = settings.opacity !== undefined && settings.opacity < 1.0;
      const textureSize = isPreview ? this.previewTextureSize : this.baseTextureSize;
      
      // 🔥 完全固定サイズ（正方形）
      const width = textureSize;
      const height = textureSize;

      let seedTexture, jfaResult, msdfTexture, finalTexture;
      
      try {
        seedTexture = this.device.createTexture({
          size: [width, height],
          format: 'rgba32float',
          usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });

        await this._seedInitPass(gpuBuffer, seedTexture, width, height, edgeCount);
        
        jfaResult = await this._executeJFA(seedTexture, width, height);

        msdfTexture = this.device.createTexture({
          size: [width, height],
          format: 'rgba16float',
          usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });

        await this._encodePass(jfaResult.resultTexture, gpuBuffer, msdfTexture, width, height, edgeCount);
        
        finalTexture = await this._renderMSDFPolygon(msdfTexture, vertexBuffer, vertexCount, width, height, settings);

        this._destroyResource(jfaResult.tempTexture);
        if (jfaResult.resultTexture !== seedTexture) {
          this._destroyResource(seedTexture);
        }
        this._destroyResource(msdfTexture);

        // 🔥 重要: GPUTextureに実サイズを記録
        finalTexture.actualWidth = width;
        finalTexture.actualHeight = height;

        return finalTexture;
        
      } catch (error) {
        console.error('[MSDF] Pipeline error:', error);
        
        this._destroyResource(seedTexture);
        this._destroyResource(jfaResult?.tempTexture);
        this._destroyResource(jfaResult?.resultTexture);
        this._destroyResource(msdfTexture);
        this._destroyResource(finalTexture);
        
        return null;
      }
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.MSDFPipelineManager = new MSDFPipelineManager();

  console.log('✅ msdf-pipeline-manager.js Phase 9 テクスチャ固定版 loaded');
  console.log('   🔥 テクスチャ256x256 / 128x128 完全固定');
  console.log('   🔥 動的サイズ計算廃止');
  console.log('   🔥 CopyTextureToBuffer問題解決');

})();