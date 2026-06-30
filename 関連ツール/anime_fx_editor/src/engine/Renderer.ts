/**
 * @file Renderer.ts
 * @description WebGPUを用いたレンダリングパイプラインと描画ループを管理します。
 * クリップの情報をもとに画像をキャンバスに描画します。
 * @relatedFiles src/engine/WebGPUContext.ts, src/engine/shaders/basic.wgsl, src/store/useTimelineStore.ts
 * @mainFunctions init(), renderLoop(), drawQuad()
 */

import { webGPUContext } from './WebGPUContext';
import { textureManager } from './TextureManager';
import { useTimelineStore } from '../store/useTimelineStore';
import { mat4 } from 'gl-matrix';

export class Renderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  
  private vertexBuffer: GPUBuffer | null = null;
  private cameraBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private cameraBindGroup: GPUBindGroup | null = null;

  private isRunning = false;

  public async init(canvas: HTMLCanvasElement): Promise<boolean> {
    const success = await webGPUContext.init(canvas);
    if (!success) return false;

    this.device = webGPUContext.device;
    this.context = webGPUContext.context;

    await this.createPipeline();
    this.createBuffers();

    this.isRunning = true;
    requestAnimationFrame(() => this.renderLoop());
    return true;
  }

  public destroy() {
    this.isRunning = false;
  }

  private async createPipeline() {
    if (!this.device) return;

    const basicShaderCode = (await import('./shaders/basic.wgsl?raw')).default;
    
    const shaderModule = this.device.createShaderModule({
      label: 'Basic Shader',
      code: basicShaderCode,
    });

    const vertexBuffers: Iterable<GPUVertexBufferLayout> = [{
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
        { shaderLocation: 1, offset: 12, format: 'float32x2' } // UV
      ],
      arrayStride: 20,
      stepMode: 'vertex'
    }];

    this.pipeline = this.device.createRenderPipeline({
      label: 'Basic Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: vertexBuffers,
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: webGPUContext.format!,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            }
          }
        }],
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'none',
      },
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  private createBuffers() {
    if (!this.device || !this.pipeline) return;

    // Quad (四角形ポリゴン) の頂点データ
    const vertices = new Float32Array([
      // X,   Y,    Z,   U,   V
      -1.0, -1.0, 0.0, 0.0, 1.0, // bottom-left
       1.0, -1.0, 0.0, 1.0, 1.0, // bottom-right
      -1.0,  1.0, 0.0, 0.0, 0.0, // top-left
       1.0,  1.0, 0.0, 1.0, 0.0, // top-right
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

    // カメラ(MVP)バッファ (mat4x4)
    this.cameraBuffer = this.device.createBuffer({
      size: 64, // 4x4 matrix = 16 floats = 64 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 正投影カメラの設定 (キャンバスの縦横比に合わせる)
    const viewProj = mat4.create();
    const aspect = this.context!.canvas.width / this.context!.canvas.height;
    // Yを-1~1として、Xをアス比に応じて広げる
    mat4.ortho(viewProj, -aspect, aspect, -1, 1, -1, 1);
    
    this.device.queue.writeBuffer(this.cameraBuffer, 0, viewProj as Float32Array);

    this.cameraBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } }
      ]
    });
  }

  private renderLoop() {
    if (!this.isRunning) return;
    this.render();
    requestAnimationFrame(() => this.renderLoop());
  }

  private render() {
    if (!this.device || !this.context || !this.pipeline || !this.vertexBuffer || !this.cameraBindGroup) return;

    const state = useTimelineStore.getState();
    const currentTime = state.currentTime;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.cameraBindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);

    // 現在の時間のクリップを描画
    // Z順を意識するため、下のトラックから順に描画する
    for (const track of state.tracks) {
      const activeClips = state.clips.filter(
        c => c.trackId === track.id && currentTime >= c.startAt && currentTime < c.startAt + c.duration
      );

      for (const clip of activeClips) {
        const asset = state.assets[clip.assetId];
        if (!asset) continue;

        // テクスチャの取得 (時間同期を含む)
        const localTime = currentTime - clip.startAt;
        const texInfo = textureManager.getTextureForTime(asset.id, localTime);
        if (!texInfo.texture) {
          textureManager.loadAsset(asset);
          continue;
        }

        // ModelMatrixとOpacityのバッファ作成
        const modelBuffer = this.device.createBuffer({
          size: 64 + 16, // mat4(64) + padding/opacity(16) -> 80 bytes
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const transform = mat4.create();
        // 画像のアスペクト比に合わせてスケールを調整（高さは1.0ベース）
        const texAspect = texInfo.height > 0 ? texInfo.width / texInfo.height : 1.0;
        
        // 画面に収まるように少し全体を縮小(例えば0.8倍)
        const baseScale = 0.8;
        mat4.scale(transform, transform, [texAspect * baseScale, baseScale, 1.0]);

        const modelData = new Float32Array(20); // 16 for mat4 + 4 for padding
        modelData.set(transform, 0);
        modelData[16] = 1.0; // opacity = 1.0

        this.device.queue.writeBuffer(modelBuffer, 0, modelData);

        const modelBindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(1),
          entries: [
            { binding: 0, resource: { buffer: modelBuffer } },
            { binding: 1, resource: this.sampler! },
            { binding: 2, resource: texInfo.texture.createView() }
          ]
        });

        passEncoder.setBindGroup(1, modelBindGroup);
        passEncoder.draw(4, 1, 0, 0);
      }
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
