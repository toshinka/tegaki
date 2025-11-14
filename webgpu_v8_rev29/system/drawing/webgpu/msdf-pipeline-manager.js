/**
 * ================================================================================
 * msdf-pipeline-manager.js Phase 2完全版 - GPU同期 + 解像度向上
 * ================================================================================
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device/queue/format)
 * - gpu-stroke-processor.js (VertexBuffer/EdgeBuffer + edgeCount)
 * - wgsl-loader.js (Shader読み込み)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * - webgpu-texture-bridge.js (Texture→Sprite変換)
 * 
 * 【Phase 2改修完了】
 * ✅ edgeCount引数化（gpuBuffer.size依存排除）
 * ✅ GPU同期待ち（device.queue.onSubmittedWorkDone）
 * ✅ DPR + オーバーサンプリング（2倍）
 * ✅ 過剰ログ削除
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
      this.polygonRenderPipeline = null;
      
      this.shaders = {};
      this.initialized = false;
    }

    async initialize(device, format) {
      if (this.initialized) return;
      this.device = device;
      this.format = format;
      this.queue = device.queue;
      this._loadShaders();
      await this._createPipelines();
      this.initialized = true;
    }

    _loadShaders() {
      this.shaders.seedInit = window.MSDF_SEED_INIT_WGSL;
      this.shaders.jfaPass = window.MSDF_JFA_PASS_WGSL;
      this.shaders.encode = window.MSDF_ENCODE_WGSL;
      this.shaders.render = window.MSDF_RENDER_WGSL;
      this.shaders.quadExpansion = window.MSDF_QUAD_EXPANSION_WGSL;

      if (!this.shaders.seedInit || !this.shaders.jfaPass || 
          !this.shaders.encode || !this.shaders.render) {
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
          topology: 'triangle-strip'
        },
        label: 'MSDF Render Pipeline'
      });

      if (this.shaders.quadExpansion) {
        const quadModule = this.device.createShaderModule({
          code: this.shaders.quadExpansion,
          label: 'MSDF Quad Expansion'
        });

        this.polygonRenderPipeline = this.device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: quadModule,
            entryPoint: 'main',
            buffers: [{
              arrayStride: 7 * 4,
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
            topology: 'triangle-strip'
          },
          label: 'MSDF Polygon Render Pipeline'
        });
      }
    }

    _toU32(value) {
      return Math.max(1, Math.floor(value)) >>> 0;
    }

    /**
     * Seed初期化パス（Phase 2: GPU同期待ち）
     */
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
      await this.device.queue.onSubmittedWorkDone();
      
      configBuffer.destroy();
    }

    /**
     * JFAパス（Phase 2: GPU同期待ち）
     */
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
      await this.device.queue.onSubmittedWorkDone();
      
      configBuffer.destroy();
    }

    async _executeJFA(seedTexture, width, height) {
      const texB = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      const maxDim = Math.max(width, height);
      const steps = Math.ceil(Math.log2(maxDim));
      
      let src = seedTexture;
      let dst = texB;

      for (let i = steps - 1; i >= 0; i--) {
        await this._jfaPass(src, dst, width, height, Math.pow(2, i));
        [src, dst] = [dst, src];
      }

      const unusedTexture = (src === seedTexture) ? texB : seedTexture;
      return { resultTexture: src, tempTexture: unusedTexture };
    }

    /**
     * エンコードパス（Phase 2: GPU同期待ち）
     */
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
      await this.device.queue.onSubmittedWorkDone();
      
      configBuffer.destroy();
    }

    async _renderMSDF(msdfTexture, width, height, settings = {}) {
      const outputTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | 
               GPUTextureUsage.COPY_SRC |
               GPUTextureUsage.TEXTURE_BINDING
      });

      const sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
      });

      const renderUniformsData = new Float32Array([
        0.5, 0.05, settings.opacity !== undefined ? settings.opacity : 1.0, 0.0
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

      const bindGroup = this.device.createBindGroup({
        layout: this.renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: msdfTexture.createView() },
          { binding: 2, resource: { buffer: renderUniformsBuffer } },
          { binding: 3, resource: { buffer: colorBuffer } }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: outputTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });

      renderPass.setPipeline(this.renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(4, 1, 0, 0);
      renderPass.end();

      this.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();

      renderUniformsBuffer.destroy();
      colorBuffer.destroy();

      return outputTexture;
    }

    async _renderMSDFPolygon(msdfTexture, vertexBuffer, vertexCount, width, height, settings = {}) {
      if (!this.polygonRenderPipeline) {
        return await this._renderMSDF(msdfTexture, width, height, settings);
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
        minFilter: 'linear'
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
        0.5, 0.05, settings.opacity !== undefined ? settings.opacity : 1.0, 0.0
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
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: outputTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });

      renderPass.setPipeline(this.polygonRenderPipeline);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.setBindGroup(1, bindGroup1);
      renderPass.draw(vertexCount, 1, 0, 0);
      renderPass.end();

      this.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();

      quadUniformsBuffer.destroy();
      renderUniformsBuffer.destroy();
      colorBuffer.destroy();

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
     * MSDF生成メイン（Phase 2: edgeCount引数化 + 解像度向上）
     */
    async generateMSDF(gpuBuffer, bounds, existingMSDF = null, settings = {}, vertexBuffer = null, vertexCount = 0, edgeCount = 0) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      if (edgeCount === 0) {
        console.warn('[MSDFPipelineManager] edgeCount is 0');
        return null;
      }

      const DPR = 1.0;
      const oversample = 2;
      
      const rawWidth = bounds.maxX - bounds.minX;
      const rawHeight = bounds.maxY - bounds.minY;
      
      const width = this._toU32(Math.ceil(rawWidth * DPR * oversample));
      const height = this._toU32(Math.ceil(rawHeight * DPR * oversample));

      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      await this._seedInitPass(gpuBuffer, seedTexture, width, height, edgeCount);
      
      const jfaResult = await this._executeJFA(seedTexture, width, height);

      const msdfTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      await this._encodePass(jfaResult.resultTexture, gpuBuffer, msdfTexture, width, height, edgeCount);
      
      let finalTexture;
      if (vertexBuffer && vertexCount > 0) {
        finalTexture = await this._renderMSDFPolygon(msdfTexture, vertexBuffer, vertexCount, width, height, settings);
      } else {
        finalTexture = await this._renderMSDF(msdfTexture, width, height, settings);
      }

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

})();