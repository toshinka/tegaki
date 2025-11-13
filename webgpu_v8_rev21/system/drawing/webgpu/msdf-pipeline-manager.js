/**
 * ================================================================================
 * msdf-pipeline-manager.js - MSDF Pipeline統合管理
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - webgpu-drawing-layer.js (device/queue/format)
 *   - gpu-stroke-processor.js (EdgeBuffer)
 * 
 * 📄 子ファイル依存:
 *   - msdf-seed-init.wgsl
 *   - msdf-jfa-pass.wgsl
 *   - msdf-encode.wgsl
 *   - msdf-compose.wgsl
 *   - msdf-render.wgsl
 * 
 * 責務:
 *   - MSDF生成パイプライン統合管理
 *   - Seed初期化 → JFA → Encode → Compose → Render
 *   - Texture Ping-Pong管理
 *   - バインディング完全一致保証
 * 
 * Phase 2.3改修:
 *   - バインディング順序の完全一致
 *   - colorBuffer初期化追加
 *   - linear sampler設定
 *   - MSDF解像度の動的調整
 *   - デバッグログのクリーンアップ
 * ================================================================================
 */

(function() {
  'use strict';

  class MSDFPipelineManager {
    constructor() {
      this.device = null;
      this.format = null;
      
      // Compute Pipelines
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.composePipeline = null;
      
      // Render Pipeline
      this.renderPipeline = null;
      
      // Samplers
      this.msdfSampler = null;
      
      // Uniform Buffers
      this.colorBuffer = null; // ✅ 追加
      
      // Debug Flag
      this.debugMode = false;
    }

    /**
     * 初期化
     */
    async initialize(device, format) {
      this.device = device;
      this.format = format;

      // Sampler作成（linear filter + clamp）
      this.msdfSampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      });

      // Color Uniform Buffer作成（初期値: 赤）
      this.colorBuffer = this.device.createBuffer({
        size: 16, // vec4<f32>
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'MSDF Color Uniform'
      });

      // デフォルト色設定（赤: #800000）
      const defaultColor = new Float32Array([
        0x80 / 255, // r
        0x00 / 255, // g
        0x00 / 255, // b
        1.0         // a
      ]);
      this.device.queue.writeBuffer(this.colorBuffer, 0, defaultColor);

      await this._initializePipelines();

      console.log('✅ [MSDFPipelineManager] Phase 2.3初期化完了（バインディング修正版）');
    }

    /**
     * Pipeline初期化
     */
    async _initializePipelines() {
      // Seed Init Compute Pipeline
      const seedInitShader = this.device.createShaderModule({
        code: window.MSDF_SEED_INIT_WGSL,
        label: 'MSDF Seed Init Shader'
      });

      this.seedInitPipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: seedInitShader,
          entryPoint: 'main'
        },
        label: 'MSDF Seed Init Pipeline'
      });

      // JFA Compute Pipeline
      const jfaShader = this.device.createShaderModule({
        code: window.MSDF_JFA_PASS_WGSL,
        label: 'MSDF JFA Shader'
      });

      this.jfaPipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: jfaShader,
          entryPoint: 'main'
        },
        label: 'MSDF JFA Pipeline'
      });

      // Encode Compute Pipeline
      const encodeShader = this.device.createShaderModule({
        code: window.MSDF_ENCODE_WGSL,
        label: 'MSDF Encode Shader'
      });

      this.encodePipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: encodeShader,
          entryPoint: 'main'
        },
        label: 'MSDF Encode Pipeline'
      });

      // Render Pipeline
      const renderShader = this.device.createShaderModule({
        code: window.MSDF_RENDER_WGSL,
        label: 'MSDF Render Shader'
      });

      this.renderPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: renderShader,
          entryPoint: 'vertMain'
        },
        fragment: {
          module: renderShader,
          entryPoint: 'main',
          targets: [{
            format: this.format,
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
          topology: 'triangle-list'
        },
        label: 'MSDF Render Pipeline'
      });
    }

    /**
     * MSDF生成（メインメソッド）
     */
    async generateMSDF(edgeBuffer, bounds, brushSettings = {}) {
      const { minX, minY, maxX, maxY } = bounds;
      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);

      // MSDF解像度を動的調整（ブラシ太さに応じて）
      const brushSize = brushSettings.size || 32;
      const resolutionScale = Math.max(4, Math.ceil(brushSize / 8)); // 太いブラシほど高解像度
      const msdfWidth = width * resolutionScale;
      const msdfHeight = height * resolutionScale;

      if (this.debugMode) {
        console.log(`[MSDF] 解像度: ${msdfWidth}x${msdfHeight} (scale: ${resolutionScale}x)`);
      }

      // 1. Seed初期化
      const seedTexture = await this._seedInitPass(edgeBuffer, msdfWidth, msdfHeight);

      // 2. JFA Pass（Ping-Pong反復）
      const jfaResult = await this._jfaPassIterations(seedTexture, msdfWidth, msdfHeight);

      // 3. MSDF Encode
      const msdfTexture = await this._encodePass(jfaResult, edgeBuffer, msdfWidth, msdfHeight);

      // Cleanup
      seedTexture.destroy();
      jfaResult.destroy();

      return msdfTexture;
    }

    /**
     * Seed初期化Pass
     */
    async _seedInitPass(edgeBuffer, width, height) {
      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      // Uniform Buffer
      const uniformData = new Float32Array([width, height, edgeBuffer.edgeCount, 0]);
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Bind Group
      const bindGroup = this.device.createBindGroup({
        layout: this.seedInitPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: edgeBuffer.gpuBuffer } },
          { binding: 1, resource: seedTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } }
        ]
      });

      // Compute Pass実行
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.seedInitPipeline);
      passEncoder.setBindGroup(0, bindGroup);
      
      const workgroupCount = Math.ceil(edgeBuffer.edgeCount / 64);
      passEncoder.dispatchWorkgroups(workgroupCount);
      passEncoder.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Cleanup
      uniformBuffer.destroy();

      return seedTexture;
    }

    /**
     * JFA Pass反復実行
     */
    async _jfaPassIterations(srcTexture, width, height) {
      const maxDim = Math.max(width, height);
      const maxStep = Math.pow(2, Math.ceil(Math.log2(maxDim)));
      
      // JFA反復回数計算（log2 + 2回）
      const iterations = Math.ceil(Math.log2(maxStep)) + 2;

      let pingTexture = srcTexture;
      let pongTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      for (let i = 0; i < iterations; i++) {
        const step = maxStep >> i; // ステップ幅: maxStep, maxStep/2, maxStep/4, ...
        
        await this._jfaPass(pingTexture, pongTexture, width, height, step);

        // Ping-Pong入れ替え
        [pingTexture, pongTexture] = [pongTexture, pingTexture];
      }

      // 最終結果がpingTextureに入っている
      pongTexture.destroy();

      return pingTexture;
    }

    /**
     * JFA Pass（単一ステップ）
     */
    async _jfaPass(srcTexture, dstTexture, width, height, step) {
      // Uniform Buffer
      const uniformData = new Uint32Array([step, width, height, 0]);
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Bind Group
      const bindGroup = this.device.createBindGroup({
        layout: this.jfaPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: srcTexture.createView() },
          { binding: 1, resource: dstTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } }
        ]
      });

      // Compute Pass実行
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.jfaPipeline);
      passEncoder.setBindGroup(0, bindGroup);
      
      const workgroupX = Math.ceil(width / 8);
      const workgroupY = Math.ceil(height / 8);
      passEncoder.dispatchWorkgroups(workgroupX, workgroupY);
      passEncoder.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Cleanup
      uniformBuffer.destroy();
    }

    /**
     * MSDF Encode Pass
     */
    async _encodePass(seedTexture, edgeBuffer, width, height) {
      const msdfTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
      });

      // Uniform Buffer
      const uniformData = new Float32Array([width, height, edgeBuffer.edgeCount, 1.0]);
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // Bind Group
      const bindGroup = this.device.createBindGroup({
        layout: this.encodePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: seedTexture.createView() },
          { binding: 1, resource: { buffer: edgeBuffer.gpuBuffer } },
          { binding: 2, resource: msdfTexture.createView() },
          { binding: 3, resource: { buffer: uniformBuffer } }
        ]
      });

      // Compute Pass実行
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.encodePipeline);
      passEncoder.setBindGroup(0, bindGroup);
      
      const workgroupX = Math.ceil(width / 8);
      const workgroupY = Math.ceil(height / 8);
      passEncoder.dispatchWorkgroups(workgroupX, workgroupY);
      passEncoder.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Cleanup
      uniformBuffer.destroy();

      return msdfTexture;
    }

    /**
     * Render Pass（MSDF → Final Texture）
     */
    async renderToTexture(msdfTexture, width, height, brushSettings = {}) {
      // 出力テクスチャ作成
      const outputTexture = this.device.createTexture({
        size: [width, height],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
      });

      // Render Uniform Buffer（threshold/range/opacity）
      const threshold = brushSettings.threshold || 0.5;
      const range = brushSettings.range || 0.02; // 小さくするとシャープ
      const opacity = brushSettings.opacity || 1.0;
      
      const uRenderData = new Float32Array([threshold, range, opacity, 0.0]);
      const uRenderBuffer = this.device.createBuffer({
        size: uRenderData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(uRenderBuffer, 0, uRenderData);

      // Color設定（brushSettingsから取得）
      if (brushSettings.color) {
        const colorArray = new Float32Array([
          brushSettings.color.r / 255,
          brushSettings.color.g / 255,
          brushSettings.color.b / 255,
          brushSettings.color.a || 1.0
        ]);
        this.device.queue.writeBuffer(this.colorBuffer, 0, colorArray);
      }

      // Bind Group作成（WGSLと完全一致）
      const bindGroup = this.device.createBindGroup({
        layout: this.renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.msdfSampler },            // @binding(0) sampler
          { binding: 1, resource: msdfTexture.createView() },    // @binding(1) texture_2d
          { binding: 2, resource: { buffer: uRenderBuffer } },   // @binding(2) uRender
          { binding: 3, resource: { buffer: this.colorBuffer } } // @binding(3) uColor
        ]
      });

      // Render Pass実行
      const commandEncoder = this.device.createCommandEncoder();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: outputTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });

      renderPass.setPipeline(this.renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6, 1, 0, 0); // フルスクリーンクワッド（2三角形）
      renderPass.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // Cleanup
      uRenderBuffer.destroy();

      return outputTexture;
    }

    /**
     * ブラシ色更新
     */
    updateBrushColor(r, g, b, a = 1.0) {
      const colorArray = new Float32Array([r / 255, g / 255, b / 255, a]);
      this.device.queue.writeBuffer(this.colorBuffer, 0, colorArray);
    }

    /**
     * 破棄
     */
    destroy() {
      if (this.colorBuffer) {
        this.colorBuffer.destroy();
        this.colorBuffer = null;
      }
    }
  }

  // グローバル登録
  window.MSDFPipelineManager = MSDFPipelineManager;

  console.log('✅ msdf-pipeline-manager.js Phase 2.3 loaded (バインディング完全修正版)');

})();