/**
 * ================================================================================
 * msdf-pipeline-manager.js - Phase 2完全版（描画実装）
 * MSDF生成パイプライン統合管理
 * ================================================================================
 * 
 * 【責務】
 * - Compute Pipeline統合管理
 * - Seed初期化Pass実行 (Phase 1)
 * - JFA Pass実行 (Phase 2)
 * - MSDF Encode Pass実行 (Phase 2)
 * - 簡易Render Pass実行 (Phase 2)
 * - Texture Ping-Pong管理
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue, format)
 * - gpu-stroke-processor.js (EdgeBuffer)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * 
 * 【Phase 2実装範囲】
 * ✅ Seed初期化Pass
 * ✅ JFA Pass（Jump Flood Algorithm）
 * ✅ MSDF Encode Pass（距離計算）
 * ✅ 簡易Render Pass（描画出力）
 * ⏳ Compose Pass (Phase 3)
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // WGSL Shader Code
  // ============================================================================

  const MSDF_SEED_INIT_WGSL = `
struct EdgeData {
  x0: f32, y0: f32, x1: f32, y1: f32,
  edgeId: f32, channelId: f32, insideFlag: f32, padding: f32,
}

@group(0) @binding(0) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let edgeIdx = globalId.x;
  if (edgeIdx >= arrayLength(&edges)) { return; }

  let edge = edges[edgeIdx];
  let texSize = textureDimensions(seedTex);
  
  // 端点・中点書き込み
  let p0 = vec2<i32>(i32(edge.x0), i32(edge.y0));
  let p1 = vec2<i32>(i32(edge.x1), i32(edge.y1));
  let pMid = vec2<i32>(i32((edge.x0 + edge.x1) * 0.5), i32((edge.y0 + edge.y1) * 0.5));
  
  if (p0.x >= 0 && p0.x < i32(texSize.x) && p0.y >= 0 && p0.y < i32(texSize.y)) {
    textureStore(seedTex, p0, vec4<f32>(edge.x0, edge.y0, edge.edgeId, 0.0));
  }
  if (p1.x >= 0 && p1.x < i32(texSize.x) && p1.y >= 0 && p1.y < i32(texSize.y)) {
    textureStore(seedTex, p1, vec4<f32>(edge.x1, edge.y1, edge.edgeId, 0.0));
  }
  if (pMid.x >= 0 && pMid.x < i32(texSize.x) && pMid.y >= 0 && pMid.y < i32(texSize.y)) {
    textureStore(seedTex, pMid, vec4<f32>((edge.x0 + edge.x1) * 0.5, (edge.y0 + edge.y1) * 0.5, edge.edgeId, 0.0));
  }
}
`;

  const MSDF_JFA_PASS_WGSL = `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> uStep: u32;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let pos = vec2<i32>(i32(globalId.x), i32(globalId.y));
  let texSize = textureDimensions(srcTex);
  
  if (pos.x >= i32(texSize.x) || pos.y >= i32(texSize.y)) { return; }

  var bestSeed = textureLoad(srcTex, pos, 0);
  var bestDist = 99999.0;
  
  if (bestSeed.z >= 0.0) {
    let dx = bestSeed.x - f32(pos.x);
    let dy = bestSeed.y - f32(pos.y);
    bestDist = dx * dx + dy * dy;
  }

  let step = i32(uStep);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let samplePos = pos + vec2<i32>(dx * step, dy * step);
      if (samplePos.x < 0 || samplePos.x >= i32(texSize.x) || 
          samplePos.y < 0 || samplePos.y >= i32(texSize.y)) {
        continue;
      }

      let seed = textureLoad(srcTex, samplePos, 0);
      if (seed.z < 0.0) { continue; }

      let vx = seed.x - f32(pos.x);
      let vy = seed.y - f32(pos.y);
      let dist = vx * vx + vy * vy;

      if (dist < bestDist) {
        bestDist = dist;
        bestSeed = seed;
      }
    }
  }

  textureStore(dstTex, pos, vec4<f32>(bestSeed.xy, bestSeed.z, bestDist));
}
`;

  const MSDF_ENCODE_WGSL = `
struct EdgeData {
  x0: f32, y0: f32, x1: f32, y1: f32,
  edgeId: f32, channelId: f32, insideFlag: f32, padding: f32,
}

@group(0) @binding(0) var seedTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(2) var msdfTex: texture_storage_2d<rgba16float, write>;

fn pointToSegmentDistance(px: f32, py: f32, x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let len2 = dx * dx + dy * dy;
  
  if (len2 < 0.0001) {
    let vx = px - x0;
    let vy = py - y0;
    return sqrt(vx * vx + vy * vy);
  }

  let t = clamp(((px - x0) * dx + (py - y0) * dy) / len2, 0.0, 1.0);
  let closestX = x0 + t * dx;
  let closestY = y0 + t * dy;
  let vx = px - closestX;
  let vy = py - closestY;
  
  return sqrt(vx * vx + vy * vy);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let pos = vec2<i32>(i32(globalId.x), i32(globalId.y));
  let texSize = textureDimensions(seedTex);
  
  if (pos.x >= i32(texSize.x) || pos.y >= i32(texSize.y)) { return; }

  let seed = textureLoad(seedTex, pos, 0);
  let edgeIdx = u32(seed.z);
  
  var dist = 99999.0;
  if (edgeIdx < arrayLength(&edges)) {
    let edge = edges[edgeIdx];
    dist = pointToSegmentDistance(f32(pos.x), f32(pos.y), edge.x0, edge.y0, edge.x1, edge.y1);
    dist *= edge.insideFlag;
  }

  // 単一チャンネルモード（Phase 2簡易版）
  textureStore(msdfTex, pos, vec4<f32>(dist, dist, dist, 1.0));
}
`;

  const MSDF_RENDER_WGSL = `
@group(0) @binding(0) var msdfSampler: sampler;
@group(0) @binding(1) var msdfTex: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
  );
  
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let d = textureSample(msdfTex, msdfSampler, input.uv).r;
  let alpha = smoothstep(-0.5, 0.5, d);
  return vec4<f32>(0.5, 0.0, 0.0, alpha); // 赤色で描画
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

      // Pipelines
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.renderPipeline = null;

      // Layouts
      this.seedInitLayout = null;
      this.jfaLayout = null;
      this.encodeLayout = null;
      this.renderLayout = null;

      // Shaders
      this.seedInitShader = null;
      this.jfaShader = null;
      this.encodeShader = null;
      this.renderShader = null;
    }

    async initialize(device, format) {
      if (!device) throw new Error('[MSDFPipelineManager] Device is required');

      this.device = device;
      this.queue = device.queue;
      this.format = format;

      try {
        this._createShaders();
        await this._createPipelines();
        this.initialized = true;
        console.log('✅ [MSDFPipelineManager] Phase 2初期化完了（描画実装）');
      } catch (error) {
        console.error('❌ [MSDFPipelineManager] 初期化失敗:', error);
        throw error;
      }
    }

    _createShaders() {
      this.seedInitShader = this.device.createShaderModule({
        label: 'msdf-seed-init',
        code: MSDF_SEED_INIT_WGSL
      });

      this.jfaShader = this.device.createShaderModule({
        label: 'msdf-jfa-pass',
        code: MSDF_JFA_PASS_WGSL
      });

      this.encodeShader = this.device.createShaderModule({
        label: 'msdf-encode',
        code: MSDF_ENCODE_WGSL
      });

      this.renderShader = this.device.createShaderModule({
        label: 'msdf-render',
        code: MSDF_RENDER_WGSL
      });
    }

    async _createPipelines() {
      // Seed Init Pipeline
      this.seedInitLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } }
        ]
      });

      this.seedInitPipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.seedInitLayout] }),
        compute: { module: this.seedInitShader, entryPoint: 'main' }
      });

      // JFA Pipeline
      this.jfaLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
        ]
      });

      this.jfaPipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.jfaLayout] }),
        compute: { module: this.jfaShader, entryPoint: 'main' }
      });

      // Encode Pipeline
      this.encodeLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } }
        ]
      });

      this.encodePipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.encodeLayout] }),
        compute: { module: this.encodeShader, entryPoint: 'main' }
      });

      // Render Pipeline
      this.renderLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }
        ]
      });

      this.renderPipeline = this.device.createRenderPipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.renderLayout] }),
        vertex: { module: this.renderShader, entryPoint: 'vs_main' },
        fragment: {
          module: this.renderShader,
          entryPoint: 'fs_main',
          targets: [{ format: this.format, blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
          }}]
        }
      });
    }

    generateMSDF(edgeBuffer, bounds, existingMSDF = null) {
      if (!this.initialized) throw new Error('[MSDFPipelineManager] Not initialized');

      const width = Math.ceil(bounds.maxX - bounds.minX);
      const height = Math.ceil(bounds.maxY - bounds.minY);

      // Textures作成
      const seedTex1 = this._createTexture(width, height, 'rgba32float', 'Seed1');
      const seedTex2 = this._createTexture(width, height, 'rgba32float', 'Seed2');
      const msdfTex = this._createTexture(width, height, 'rgba16float', 'MSDF');
      const renderTex = this._createTexture(width, height, this.format, 'Render');

      // Phase A: Seed初期化
      this._seedInitPass(edgeBuffer, seedTex1);

      // Phase B: JFA
      this._jfaMultiPass(seedTex1, seedTex2, width, height);

      // Phase C: MSDF Encode
      this._encodePass(seedTex1, edgeBuffer, msdfTex);

      // Phase D: Render
      this._renderPass(msdfTex, renderTex, width, height);

      // 一時テクスチャ破棄
      seedTex1.destroy();
      seedTex2.destroy();
      msdfTex.destroy();

      return renderTex;
    }

    _createTexture(width, height, format, label) {
      const usage = GPUTextureUsage.STORAGE_BINDING | 
                    GPUTextureUsage.TEXTURE_BINDING | 
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC; // Sprite生成用に必須

      return this.device.createTexture({
        size: [width, height],
        format: format,
        usage: usage,
        label: label
      });
    }

    _seedInitPass(edgeBuffer, seedTex) {
      const bindGroup = this.device.createBindGroup({
        layout: this.seedInitLayout,
        entries: [
          { binding: 0, resource: { buffer: edgeBuffer } },
          { binding: 1, resource: seedTex.createView() }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.seedInitPipeline);
      pass.setBindGroup(0, bindGroup);
      
      const edgeCount = edgeBuffer.size / 32;
      pass.dispatchWorkgroups(Math.ceil(edgeCount / 64));
      pass.end();
      
      this.queue.submit([encoder.finish()]);
    }

    _jfaMultiPass(srcTex, dstTex, width, height) {
      const maxDim = Math.max(width, height);
      const steps = [];
      for (let step = Math.pow(2, Math.floor(Math.log2(maxDim))); step >= 1; step = Math.floor(step / 2)) {
        steps.push(step);
      }

      let currentSrc = srcTex;
      let currentDst = dstTex;

      for (const step of steps) {
        this._jfaPass(currentSrc, currentDst, step, width, height);
        [currentSrc, currentDst] = [currentDst, currentSrc];
      }
    }

    _jfaPass(srcTex, dstTex, step, width, height) {
      const uniformData = new Uint32Array([step]);
      const uniformBuffer = this.device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      this.queue.writeBuffer(uniformBuffer, 0, uniformData);

      const bindGroup = this.device.createBindGroup({
        layout: this.jfaLayout,
        entries: [
          { binding: 0, resource: srcTex.createView() },
          { binding: 1, resource: dstTex.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.jfaPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();

      this.queue.submit([encoder.finish()]);
      uniformBuffer.destroy();
    }

    _encodePass(seedTex, edgeBuffer, msdfTex) {
      const bindGroup = this.device.createBindGroup({
        layout: this.encodeLayout,
        entries: [
          { binding: 0, resource: seedTex.createView() },
          { binding: 1, resource: { buffer: edgeBuffer } },
          { binding: 2, resource: msdfTex.createView() }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.encodePipeline);
      pass.setBindGroup(0, bindGroup);
      
      const [width, height] = [msdfTex.width, msdfTex.height];
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();

      this.queue.submit([encoder.finish()]);
    }

    _renderPass(msdfTex, renderTex, width, height) {
      const sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

      const bindGroup = this.device.createBindGroup({
        layout: this.renderLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: msdfTex.createView() }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: renderTex.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });

      pass.setPipeline(this.renderPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
      pass.end();

      this.queue.submit([encoder.finish()]);
    }

    destroy() {
      this.initialized = false;
    }
  }

  window.MSDFPipelineManager = MSDFPipelineManager;

  console.log('✅ msdf-pipeline-manager.js Phase 2完全版 loaded');
  console.log('   ✅ JFA Pass実装完了');
  console.log('   ✅ MSDF Encode実装完了');
  console.log('   ✅ 簡易Render実装完了');

})();