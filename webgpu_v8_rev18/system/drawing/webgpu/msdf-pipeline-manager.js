/**
 * ================================================================================
 * msdf-pipeline-manager.js - Phase 2完全版（座標系統一修正版）
 * MSDF生成パイプライン統合管理
 * ================================================================================
 * 
 * 【責務】
 * - Compute Pipeline統合管理
 * - Seed初期化Pass実行
 * - JFA Pass実行
 * - MSDF Encode Pass実行
 * - 簡易Render Pass実行
 * - Texture Ping-Pong管理
 * 
 * 【依存Parents】
 * - webgpu-drawing-layer.js (device, queue, format)
 * - gpu-stroke-processor.js (EdgeBuffer)
 * 
 * 【依存Children】
 * - brush-core.js (呼び出し元)
 * 
 * 【重大修正】
 * ✅ 座標系統一: bounds offset適用で絶対座標→相対座標変換
 * ✅ Uniform Buffer追加でbounds情報をShaderに渡す
 * ✅ Seed Clear/Init/Encode全てで座標変換実装
 * ✅ デバッグログ追加で各Pass動作確認
 * 
 * ================================================================================
 */

(function() {
  'use strict';

  // ============================================================================
  // WGSL Shader Code
  // ============================================================================

  const MSDF_SEED_CLEAR_WGSL = `
@group(0) @binding(0) var seedTex: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let pos = vec2<i32>(i32(globalId.x), i32(globalId.y));
  let texSize = textureDimensions(seedTex);
  
  if (pos.x >= i32(texSize.x) || pos.y >= i32(texSize.y)) { return; }
  
  textureStore(seedTex, pos, vec4<f32>(0.0, 0.0, -1.0, 99999.0));
}
`;

  const MSDF_SEED_INIT_WGSL = `
struct EdgeData {
  x0: f32, y0: f32, x1: f32, y1: f32,
  edgeId: f32, channelId: f32, insideFlag: f32, padding: f32,
}

struct Bounds {
  minX: f32, minY: f32, maxX: f32, maxY: f32,
}

@group(0) @binding(0) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(1) var seedTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> bounds: Bounds;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let edgeIdx = globalId.x;
  if (edgeIdx >= arrayLength(&edges)) { return; }

  let edge = edges[edgeIdx];
  let texSize = textureDimensions(seedTex);
  
  // 絶対座標 → 相対座標変換
  let x0_rel = i32(edge.x0 - bounds.minX);
  let y0_rel = i32(edge.y0 - bounds.minY);
  let x1_rel = i32(edge.x1 - bounds.minX);
  let y1_rel = i32(edge.y1 - bounds.minY);
  let xMid_rel = i32((edge.x0 + edge.x1) * 0.5 - bounds.minX);
  let yMid_rel = i32((edge.y0 + edge.y1) * 0.5 - bounds.minY);
  
  // 端点・中点書き込み（相対座標）
  let p0 = vec2<i32>(x0_rel, y0_rel);
  let p1 = vec2<i32>(x1_rel, y1_rel);
  let pMid = vec2<i32>(xMid_rel, yMid_rel);
  
  if (p0.x >= 0 && p0.x < i32(texSize.x) && p0.y >= 0 && p0.y < i32(texSize.y)) {
    textureStore(seedTex, p0, vec4<f32>(f32(p0.x), f32(p0.y), edge.edgeId, 0.0));
  }
  if (p1.x >= 0 && p1.x < i32(texSize.x) && p1.y >= 0 && p1.y < i32(texSize.y)) {
    textureStore(seedTex, p1, vec4<f32>(f32(p1.x), f32(p1.y), edge.edgeId, 0.0));
  }
  if (pMid.x >= 0 && pMid.x < i32(texSize.x) && pMid.y >= 0 && pMid.y < i32(texSize.y)) {
    textureStore(seedTex, pMid, vec4<f32>(f32(pMid.x), f32(pMid.y), edge.edgeId, 0.0));
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

struct Bounds {
  minX: f32, minY: f32, maxX: f32, maxY: f32,
}

@group(0) @binding(0) var seedTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeData>;
@group(0) @binding(2) var msdfTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> bounds: Bounds;

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
  
  if (seed.z < 0.0 || edgeIdx >= arrayLength(&edges)) {
    textureStore(msdfTex, pos, vec4<f32>(99999.0, 99999.0, 99999.0, 1.0));
    return;
  }
  
  let edge = edges[edgeIdx];
  
  // 相対座標に変換してから距離計算
  let px = f32(pos.x);
  let py = f32(pos.y);
  let x0_rel = edge.x0 - bounds.minX;
  let y0_rel = edge.y0 - bounds.minY;
  let x1_rel = edge.x1 - bounds.minX;
  let y1_rel = edge.y1 - bounds.minY;
  
  var dist = pointToSegmentDistance(px, py, x0_rel, y0_rel, x1_rel, y1_rel);
  dist *= edge.insideFlag;

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
  let alpha = smoothstep(1.0, -1.0, d);
  return vec4<f32>(1.0, 0.0, 0.0, alpha);
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

      this.seedClearPipeline = null;
      this.seedInitPipeline = null;
      this.jfaPipeline = null;
      this.encodePipeline = null;
      this.renderPipeline = null;

      this.seedClearLayout = null;
      this.seedInitLayout = null;
      this.jfaLayout = null;
      this.encodeLayout = null;
      this.renderLayout = null;

      this.seedClearShader = null;
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
        console.log('✅ [MSDFPipelineManager] Phase 2初期化完了（座標系統一版）');
      } catch (error) {
        console.error('❌ [MSDFPipelineManager] 初期化失敗:', error);
        throw error;
      }
    }

    _createShaders() {
      this.seedClearShader = this.device.createShaderModule({
        label: 'msdf-seed-clear',
        code: MSDF_SEED_CLEAR_WGSL
      });

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
      // Seed Clear Pipeline
      this.seedClearLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } }
        ]
      });

      this.seedClearPipeline = this.device.createComputePipeline({
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.seedClearLayout] }),
        compute: { module: this.seedClearShader, entryPoint: 'main' }
      });

      // Seed Init Pipeline (Uniform追加)
      this.seedInitLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
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

      // Encode Pipeline (Uniform追加)
      this.encodeLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
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

      console.log(`[MSDF] Generating: ${width}x${height}, bounds:`, bounds);

      // Textures作成
      const seedTex1 = this._createTexture(width, height, 'rgba32float', 'Seed1');
      const seedTex2 = this._createTexture(width, height, 'rgba32float', 'Seed2');
      const msdfTex = this._createTexture(width, height, 'rgba16float', 'MSDF');
      const renderTex = this._createTexture(width, height, this.format, 'Render');

      // Uniform Buffer作成
      const boundsUniform = this._createBoundsUniform(bounds);

      // Phase 0: Seed初期化
      this._seedClearPass(seedTex1, width, height);

      // Phase A: Seed書き込み
      this._seedInitPass(edgeBuffer, seedTex1, boundsUniform);

      // Phase B: JFA
      const finalSeedTex = this._jfaMultiPass(seedTex1, seedTex2, width, height);

      // Phase C: MSDF Encode
      this._encodePass(finalSeedTex, edgeBuffer, msdfTex, boundsUniform);

      // Phase D: Render
      this._renderPass(msdfTex, renderTex, width, height);

      // クリーンアップ
      seedTex1.destroy();
      seedTex2.destroy();
      msdfTex.destroy();
      boundsUniform.destroy();

      console.log('[MSDF] Generation complete');

      return renderTex;
    }

    _createTexture(width, height, format, label) {
      const usage = GPUTextureUsage.STORAGE_BINDING | 
                    GPUTextureUsage.TEXTURE_BINDING | 
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC;

      return this.device.createTexture({
        size: [width, height],
        format: format,
        usage: usage,
        label: label
      });
    }

    _createBoundsUniform(bounds) {
      const boundsData = new Float32Array([
        bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
      ]);

      const buffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'BoundsUniform'
      });

      this.queue.writeBuffer(buffer, 0, boundsData);
      return buffer;
    }

    _seedClearPass(seedTex, width, height) {
      const bindGroup = this.device.createBindGroup({
        layout: this.seedClearLayout,
        entries: [
          { binding: 0, resource: seedTex.createView() }
        ]
      });

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.seedClearPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
      
      this.queue.submit([encoder.finish()]);
    }

    _seedInitPass(edgeBuffer, seedTex, boundsUniform) {
      const bindGroup = this.device.createBindGroup({
        layout: this.seedInitLayout,
        entries: [
          { binding: 0, resource: { buffer: edgeBuffer } },
          { binding: 1, resource: seedTex.createView() },
          { binding: 2, resource: { buffer: boundsUniform } }
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
      console.log(`[MSDF] Seed Init: ${edgeCount} edges`);
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

      console.log(`[MSDF] JFA: ${steps.length} passes`);
      return currentSrc;
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

    _encodePass(seedTex, edgeBuffer, msdfTex, boundsUniform) {
      const bindGroup = this.device.createBindGroup({
        layout: this.encodeLayout,
        entries: [
          { binding: 0, resource: seedTex.createView() },
          { binding: 1, resource: { buffer: edgeBuffer } },
          { binding: 2, resource: msdfTex.createView() },
          { binding: 3, resource: { buffer: boundsUniform } }
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
      console.log(`[MSDF] Encode: ${width}x${height}`);
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
  window.msdfPipelineManager = null;

  console.log('✅ msdf-pipeline-manager.js Phase 2完全版（座標系統一版） loaded');

})();