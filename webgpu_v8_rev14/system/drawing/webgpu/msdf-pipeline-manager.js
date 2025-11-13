/**
 * ================================================================================
 * msdf-pipeline-manager.js - Phase 1: Seed初期化版
 * MSDF生成パイプライン統合管理
 * ================================================================================
 * 
 * 【責務】
 * - Compute Pipeline統合管理
 * - Seed初期化Pass実行 (Phase 1)
 * - JFA/Encode/Compose/Render Pass (Phase 2-4で実装)
 * - Texture Ping-Pong管理
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue, format)
 * - gpu-stroke-processor.js (EdgeBuffer)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * - msdf-seed-init.wgsl (Compute Shader)
 * 
 * 【Phase 1実装範囲】
 * ✅ Seed初期化Pass
 * ⏳ JFA Pass (Phase 2)
 * ⏳ MSDF Encode Pass (Phase 3)
 * ⏳ Compose Pass (Phase 4)
 * ⏳ Render Pass (Phase 4)
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
      this.initialized = false;

      // Compute Pipelines
      this.seedInitPipeline = null;

      // Bind Group Layouts
      this.seedInitLayout = null;

      // Shader Modules
      this.seedInitShader = null;
    }

    /**
     * 初期化
     * @param {GPUDevice} device - WebGPU Device
     * @param {GPUTextureFormat} format - Texture Format
     */
    async initialize(device, format) {
      if (!device) {
        throw new Error('[MSDFPipelineManager] Device is required');
      }

      this.device = device;
      this.queue = device.queue;
      this.format = format;

      console.log('[MSDFPipelineManager] Phase 1初期化開始...');

      try {
        // Seed初期化Shader読み込み
        await this._loadSeedInitShader();

        // Pipeline作成
        await this._createSeedInitPipeline();

        this.initialized = true;
        console.log('✅ [MSDFPipelineManager] Phase 1初期化完了');
        console.log('   ✓ Seed初期化Pipeline生成');
      } catch (error) {
        console.error('❌ [MSDFPipelineManager] 初期化失敗:', error);
        throw error;
      }
    }

    /**
     * Seed初期化Shader読み込み
     */
    async _loadSeedInitShader() {
      const shaderPath = 'system/drawing/msdf/msdf-seed-init.wgsl';
      
      try {
        const response = await fetch(shaderPath);
        if (!response.ok) {
          throw new Error(`Shader読み込み失敗: ${shaderPath}`);
        }

        const code = await response.text();
        this.seedInitShader = this.device.createShaderModule({
          label: 'msdf-seed-init',
          code: code
        });

        console.log('   ✓ msdf-seed-init.wgsl 読み込み完了');
      } catch (error) {
        console.error('❌ Seed初期化Shader読み込み失敗:', error);
        throw error;
      }
    }

    /**
     * Seed初期化Pipeline作成
     */
    async _createSeedInitPipeline() {
      // BindGroupLayout作成
      this.seedInitLayout = this.device.createBindGroupLayout({
        label: 'seedInit-layout',
        entries: [
          {
            // @binding(0) edges: storage buffer
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' }
          },
          {
            // @binding(1) seedTex: storage texture
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              access: 'write-only',
              format: 'rgba32float'
            }
          },
          {
            // @binding(2) uniforms (canvas size等)
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
          }
        ]
      });

      // PipelineLayout作成
      const pipelineLayout = this.device.createPipelineLayout({
        label: 'seedInit-pipeline-layout',
        bindGroupLayouts: [this.seedInitLayout]
      });

      // ComputePipeline作成
      this.seedInitPipeline = this.device.createComputePipeline({
        label: 'seedInit-pipeline',
        layout: pipelineLayout,
        compute: {
          module: this.seedInitShader,
          entryPoint: 'main'
        }
      });

      console.log('   ✓ Seed初期化Pipeline作成完了');
    }

    /**
     * Seed初期化Pass実行
     * @param {GPUBuffer} edgeBuffer - EdgeBuffer
     * @param {GPUTexture} seedTexture - Seed Texture (rgba32float)
     * @param {Number} width - Canvas幅
     * @param {Number} height - Canvas高さ
     */
    _seedInitPass(edgeBuffer, seedTexture, width, height) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      // Uniform Buffer作成 (canvas size)
      const uniformData = new Float32Array([width, height]);
      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'seedInit-uniforms'
      });
      this.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // BindGroup作成
      const bindGroup = this.device.createBindGroup({
        label: 'seedInit-bindGroup',
        layout: this.seedInitLayout,
        entries: [
          { binding: 0, resource: { buffer: edgeBuffer } },
          { binding: 1, resource: seedTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } }
        ]
      });

      // CommandEncoder作成
      const commandEncoder = this.device.createCommandEncoder({
        label: 'seedInit-encoder'
      });

      const computePass = commandEncoder.beginComputePass({
        label: 'seedInit-pass'
      });

      computePass.setPipeline(this.seedInitPipeline);
      computePass.setBindGroup(0, bindGroup);

      // エッジ数に応じてDispatch (64 threads/workgroup)
      const edgeCount = edgeBuffer.size / (8 * 4); // 8要素 * 4bytes
      const workgroupCount = Math.ceil(edgeCount / 64);
      computePass.dispatchWorkgroups(workgroupCount);

      computePass.end();

      // Submit
      this.queue.submit([commandEncoder.finish()]);

      console.log(`✅ [MSDFPipelineManager] Seed初期化Pass実行: ${edgeCount}エッジ`);

      // Uniform Buffer破棄
      uniformBuffer.destroy();
    }

    /**
     * MSDF生成 (Phase 1: Seed初期化のみ)
     * @param {GPUBuffer} edgeBuffer - EdgeBuffer
     * @param {Object} bounds - {minX, minY, maxX, maxY}
     * @param {GPUTexture} existingMSDF - 既存MSDF (Phase 4で使用)
     * @returns {GPUTexture} Seed Texture (Phase 1では可視化用)
     */
    generateMSDF(edgeBuffer, bounds, existingMSDF = null) {
      if (!this.initialized) {
        throw new Error('[MSDFPipelineManager] Not initialized');
      }

      const width = Math.ceil(bounds.maxX - bounds.minX);
      const height = Math.ceil(bounds.maxY - bounds.minY);

      console.log(`[MSDFPipelineManager] MSDF生成開始: ${width}x${height}`);

      // Seed Texture作成 (rgba32float)
      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'seedTexture'
      });

      // Seed初期化Pass実行
      this._seedInitPass(edgeBuffer, seedTexture, width, height);

      console.log('✅ [MSDFPipelineManager] Phase 1完了: Seed初期化のみ');
      console.log('   ⏳ Phase 2: JFA Pass 未実装');

      return seedTexture;
    }

    /**
     * リソース破棄
     */
    destroy() {
      this.seedInitPipeline = null;
      this.seedInitLayout = null;
      this.seedInitShader = null;
      this.device = null;
      this.queue = null;
      this.initialized = false;
      console.log('🗑️ [MSDFPipelineManager] 破棄完了');
    }
  }

  // グローバル公開
  window.MSDFPipelineManager = MSDFPipelineManager;

  console.log('✅ msdf-pipeline-manager.js Phase 1 Seed初期化版 loaded');
  console.log('   ✓ _seedInitPass() 実装完了');
  console.log('   ⏳ JFA/Encode/Compose/Render Phase 2-4実装予定');

})();