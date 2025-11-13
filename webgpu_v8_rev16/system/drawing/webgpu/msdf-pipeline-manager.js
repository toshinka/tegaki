/**
 * ================================================================================
 * msdf-pipeline-manager.js - Phase 1完全版 (CORS修正)
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
 * 
 * 【Phase 1実装範囲】
 * ✅ Seed初期化Pass (WGSLインライン化でCORS解決)
 * ⏳ JFA Pass (Phase 2)
 * ⏳ MSDF Encode Pass (Phase 3)
 * ⏳ Compose Pass (Phase 4)
 * ⏳ Render Pass (Phase 4)
 * 
 * 【変更履歴】
 * - v1.1: WGSLコードをインライン化してfile://対応
 * - v1.0: Phase 1初期実装
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // WGSL Shader Code (インライン定義)
  // ============================================================================

  const MSDF_SEED_INIT_WGSL = `
// ============================================================================
// msdf-seed-init.wgsl (インライン版)
// WebGPU MSDF - Seed初期化 Compute Shader
// ============================================================================

struct EdgeData {
  x0: f32,
  y0: f32,
  x1: f32,
  y1: f32,
  edgeId: f32,
  channelId: f32,
  insideFlag: f32,
  padding: f32,
}

@group(0) @binding(0) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uCanvasSize: vec2<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let edgeIdx = globalId.x;
  let edgeCount = arrayLength(&edges);
  
  if (edgeIdx >= edgeCount) {
    return;
  }

  let edge = edges[edgeIdx];
  let texSize = textureDimensions(seedTex);
  
  // 端点0
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  if (p0.x >= 0 && p0.x < i32(texSize.x) && p0.y >= 0 && p0.y < i32(texSize.y)) {
    textureStore(seedTex, p0, vec4<f32>(edge.x0, edge.y0, edge.edgeId, 0.0));
  }
  
  // 端点1
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));
  if (p1.x >= 0 && p1.x < i32(texSize.x) && p1.y >= 0 && p1.y < i32(texSize.y)) {
    textureStore(seedTex, p1, vec4<f32>(edge.x1, edge.y1, edge.edgeId, 0.0));
  }
  
  // 中点
  let midX = (edge.x0 + edge.x1) * 0.5;
  let midY = (edge.y0 + edge.y1) * 0.5;
  let pMid = vec2<i32>(i32(midX), i32(midY));
  if (pMid.x >= 0 && pMid.x < i32(texSize.x) && pMid.y >= 0 && pMid.y < i32(texSize.y)) {
    textureStore(seedTex, pMid, vec4<f32>(midX, midY, edge.edgeId, 0.0));
  }
}
`;

  // ============================================================================
  // MSDF Pipeline Manager Class
  // ============================================================================

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

      try {
        // Shader Module作成 (インライン版)
        this._createSeedInitShader();

        // Pipeline作成
        await this._createSeedInitPipeline();

        this.initialized = true;
        console.log('✅ [MSDFPipelineManager] Phase 1初期化完了 (CORS修正版)');
      } catch (error) {
        console.error('❌ [MSDFPipelineManager] 初期化失敗:', error);
        throw error;
      }
    }

    /**
     * Seed初期化Shader作成 (インライン版)
     */
    _createSeedInitShader() {
      this.seedInitShader = this.device.createShaderModule({
        label: 'msdf-seed-init',
        code: MSDF_SEED_INIT_WGSL
      });
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

      // Seed Texture作成 (rgba32float)
      const seedTexture = this.device.createTexture({
        size: [width, height],
        format: 'rgba32float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        label: 'seedTexture'
      });

      // Seed初期化Pass実行
      this._seedInitPass(edgeBuffer, seedTexture, width, height);

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
    }
  }

  // グローバル公開
  window.MSDFPipelineManager = MSDFPipelineManager;

  console.log('✅ msdf-pipeline-manager.js Phase 1完全版 (CORS修正) loaded');
  console.log('   🔧 WGSLインライン化でfile://対応');
  console.log('   ⏳ Phase 2: JFA Pass 実装予定');

})();