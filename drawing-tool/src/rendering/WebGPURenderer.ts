// WebGPURenderer.ts - Phase2 WebGPU専用レンダリング
// WebGPU専用処理・Compute Shader・GPU並列処理・高性能化

import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from '../core/EventBus.js';

export interface IWebGPUCapabilities {
  maxTextureSize: number;
  maxBufferSize: number;
  maxComputeWorkgroupSize: number;
  supportsCompute: boolean;
  supportsTimestamp: boolean;
}

export interface IWebGPUEventData extends IEventData {
  'webgpu:initialized': { capabilities: IWebGPUCapabilities };
  'webgpu:error': { error: string; fallback: boolean };
  'webgpu:compute-complete': { operation: string; duration: number };
}

/**
 * WebGPU専用レンダリングシステム・Phase2実装
 * - WebGPU Compute Shader統合・GPU並列処理
 * - 高性能フィルター・エフェクト・リアルタイム処理
 * - GPU メモリ管理・効率最適化
 * - フォールバック機能・WebGL2自動切り替え
 */
export class WebGPURenderer {
  private eventBus: EventBus;
  private pixiApp: PIXI.Application;
  private device: GPUDevice | null = null;
  private queue: GPUQueue | null = null;
  private capabilities: IWebGPUCapabilities | null = null;
  
  // Compute Pipeline管理
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  private bufferPool: Map<string, GPUBuffer> = new Map();
  
  // パフォーマンス監視
  private operationTimings: Map<string, number> = new Map();
  private isInitialized = false;

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    console.log('⚡ WebGPURenderer初期化開始');
  }

  /**
   * WebGPU初期化・デバイス取得・機能検証
   * @returns 初期化成功かどうか
   */
  public async initialize(): Promise<boolean> {
    try {
      // WebGPU対応チェック
      if (!navigator.gpu) {
        console.warn('⚠️ WebGPU未対応・WebGL2フォールバック');
        this.eventBus.emit('webgpu:error', {
          error: 'WebGPU not supported',
          fallback: true
        });
        return false;
      }

      // GPUアダプター取得
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        console.warn('⚠️ GPUアダプター取得失敗');
        this.eventBus.emit('webgpu:error', {
          error: 'GPU adapter not available',
          fallback: true
        });
        return false;
      }

      // GPUデバイス取得・機能要求
      this.device = await adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {
          maxTextureDimension2D: 2048,
          maxBufferSize: 256 * 1024 * 1024 // 256MB
        }
      });

      this.queue = this.device.queue;

      // 機能情報取得
      this.capabilities = await this.detectCapabilities(adapter);
      
      // エラーハンドリング設定
      this.setupErrorHandling();

      this.isInitialized = true;

      // 初期化完了イベント
      this.eventBus.emit('webgpu:initialized', {
        capabilities: this.capabilities
      });

      console.log('✅ WebGPU初期化完了', this.capabilities);
      return true;

    } catch (error) {
      console.error('❌ WebGPU初期化エラー:', error);
      this.eventBus.emit('webgpu:error', {
        error: `WebGPU initialization failed: ${error}`,
        fallback: true
      });
      return false;
    }
  }

  /**
   * Compute Shaderパイプライン作成・登録
   * @param name パイプライン名
   * @param shaderCode WGSL Compute Shader
   * @param workgroupSize ワークグループサイズ
   */
  public async createComputePipeline(
    name: string,
    shaderCode: string,
    workgroupSize: [number, number, number] = [64, 1, 1]
  ): Promise<void> {
    if (!this.device || !this.isInitialized) {
      throw new Error('WebGPU not initialized');
    }

    try {
      // Compute Shaderモジュール作成
      const shaderModule = this.device.createShaderModule({
        label: `${name}-compute-shader`,
        code: shaderCode
      });

      // Compute Pipeline作成
      const pipeline = this.device.createComputePipeline({
        label: `${name}-compute-pipeline`,
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main'
        }
      });

      this.computePipelines.set(name, pipeline);
      console.log(`🔧 Compute Pipeline作成: ${name} (${workgroupSize.join('x')})`);

    } catch (error) {
      console.error(`❌ Compute Pipeline作成エラー (${name}):`, error);
      throw error;
    }
  }

  /**
   * GPU バッファー作成・管理
   * @param name バッファー名
   * @param size バイトサイズ
   * @param usage GPUBufferUsage
   * @returns GPUBuffer
   */
  public createBuffer(name: string, size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    if (!this.device) {
      throw new Error('WebGPU device not available');
    }

    // 既存バッファー削除
    const existingBuffer = this.bufferPool.get(name);
    if (existingBuffer) {
      existingBuffer.destroy();
    }

    // 新バッファー作成
    const buffer = this.device.createBuffer({
      label: name,
      size,
      usage
    });

    this.bufferPool.set(name, buffer);
    console.log(`💾 GPU Buffer作成: ${name} (${(size / 1024).toFixed(1)}KB)`);
    
    return buffer;
  }

  /**
   * Compute Shader実行・GPU並列処理
   * @param pipelineName パイプライン名
   * @param buffers バッファー配列
   * @param workgroups ワークグループ数
   */
  public async executeComputeShader(
    pipelineName: string,
    buffers: { name: string; data?: Float32Array | Uint8Array }[],
    workgroups: [number, number, number] = [1, 1, 1]
  ): Promise<void> {
    if (!this.device || !this.queue) {
      throw new Error('WebGPU not available');
    }

    const pipeline = this.computePipelines.get(pipelineName);
    if (!pipeline) {
      throw new Error(`Compute pipeline not found: ${pipelineName}`);
    }

    const startTime = performance.now();

    try {
      // コマンドエンコーダー作成
      const commandEncoder = this.device.createCommandEncoder({
        label: `${pipelineName}-compute-command`
      });

      // バインドグループ作成・バッファー設定
      const bindGroupEntries: GPUBindGroupEntry[] = [];
      
      buffers.forEach((bufferSpec, index) => {
        let buffer = this.bufferPool.get(bufferSpec.name);
        
        // バッファーが存在しない場合は作成
        if (!buffer && bufferSpec.data) {
          const size = bufferSpec.data.byteLength;
          buffer = this.createBuffer(
            bufferSpec.name,
            size,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
          );
          
          // データ書き込み
          this.queue.writeBuffer(buffer, 0, bufferSpec.data);
        }

        if (buffer) {
          bindGroupEntries.push({
            binding: index,
            resource: { buffer }
          });
        }
      });

      const bindGroup = this.device.createBindGroup({
        label: `${pipelineName}-bind-group`,
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries
      });

      // Compute Pass実行
      const computePass = commandEncoder.beginComputePass({
        label: `${pipelineName}-compute-pass`
      });

      computePass.setPipeline(pipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
      computePass.end();

      // コマンド実行
      const commands = commandEncoder.finish();
      this.queue.submit([commands]);

      // GPU処理完了待機
      await this.device.queue.onSubmittedWorkDone();

      const duration = performance.now() - startTime;
      this.operationTimings.set(pipelineName, duration);

      this.eventBus.emit('webgpu:compute-complete', {
        operation: pipelineName,
        duration
      });

      console.log(`⚡ Compute Shader実行完了: ${pipelineName} (${duration.toFixed(2)}ms)`);

    } catch (error) {
      console.error(`❌ Compute Shader実行エラー (${pipelineName}):`, error);
      throw error;
    }
  }

  /**
   * GPU バッファーデータ読み取り
   * @param bufferName バッファー名
   * @returns Float32Array
   */
  public async readBuffer(bufferName: string): Promise<Float32Array> {
    if (!this.device) {
      throw new Error('WebGPU device not available');
    }

    const buffer = this.bufferPool.get(bufferName);
    if (!buffer) {
      throw new Error(`Buffer not found: ${bufferName}`);
    }

    // 読み取り用バッファー作成
    const readBuffer = this.device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // コピーコマンド実行
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
    const commands = commandEncoder.finish();
    this.queue!.submit([commands]);

    // マップして読み取り
    await readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readBuffer.getMappedRange();
    const result = new Float32Array(arrayBuffer.slice(0));
    
    // リソース解放
    readBuffer.unmap();
    readBuffer.destroy();

    return result;
  }

  /**
   * 基本フィルター・エフェクト実装
   */
  public async initializeBasicFilters(): Promise<void> {
    if (!this.isInitialized) return;

    // ガウシアンブラーShader
    const blurShader = `
      @group(0) @binding(0) var<storage, read_write> input_data: array<f32>;
      @group(0) @binding(1) var<storage, read_write> output_data: array<f32>;
      @group(0) @binding(2) var<uniform> params: BlurParams;

      struct BlurParams {
        width: u32,
        height: u32,
        radius: f32,
        sigma: f32,
      }

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let x = global_id.x;
        let y = global_id.y;
        
        if (x >= params.width || y >= params.height) {
          return;
        }
        
        // ガウシアンブラー計算
        var sum = vec4<f32>(0.0);
        var weight_sum = 0.0;
        
        let radius_i = i32(params.radius);
        
        for (var dy = -radius_i; dy <= radius_i; dy++) {
          for (var dx = -radius_i; dx <= radius_i; dx++) {
            let sample_x = clamp(i32(x) + dx, 0, i32(params.width) - 1);
            let sample_y = clamp(i32(y) + dy, 0, i32(params.height) - 1);
            
            let distance = sqrt(f32(dx * dx + dy * dy));
            let weight = exp(-(distance * distance) / (2.0 * params.sigma * params.sigma));
            
            let index = u32(sample_y) * params.width + u32(sample_x);
            sum += vec4<f32>(
              input_data[index * 4],
              input_data[index * 4 + 1],
              input_data[index * 4 + 2],
              input_data[index * 4 + 3]
            ) * weight;
            
            weight_sum += weight;
          }
        }
        
        if (weight_sum > 0.0) {
          sum /= weight_sum;
        }
        
        let output_index = y * params.width + x;
        output_data[output_index * 4] = sum.x;
        output_data[output_index * 4 + 1] = sum.y;
        output_data[output_index * 4 + 2] = sum.z;
        output_data[output_index * 4 + 3] = sum.w;
      }
    `;

    // 色調整Shader
    const colorAdjustShader = `
      @group(0) @binding(0) var<storage, read_write> image_data: array<f32>;
      @group(0) @binding(1) var<uniform> params: ColorParams;

      struct ColorParams {
        width: u32,
        height: u32,
        brightness: f32,
        contrast: f32,
        saturation: f32,
        hue: f32,
      }

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let x = global_id.x;
        let y = global_id.y;
        
        if (x >= params.width || y >= params.height) {
          return;
        }
        
        let index = (y * params.width + x) * 4;
        
        var color = vec4<f32>(
          image_data[index],
          image_data[index + 1],
          image_data[index + 2],
          image_data[index + 3]
        );
        
        // 明度調整
        color = vec4<f32>(color.rgb + params.brightness, color.a);
        
        // コントラスト調整
        color = vec4<f32>((color.rgb - 0.5) * params.contrast + 0.5, color.a);
        
        // 彩度調整（簡易実装）
        let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
        color = vec4<f32>(mix(vec3<f32>(gray), color.rgb, params.saturation), color.a);
        
        // 結果書き込み
        image_data[index] = clamp(color.r, 0.0, 1.0);
        image_data[index + 1] = clamp(color.g, 0.0, 1.0);
        image_data[index + 2] = clamp(color.b, 0.0, 1.0);
        image_data[index + 3] = clamp(color.a, 0.0, 1.0);
      }
    `;

    // フィルターパイプライン作成
    await this.createComputePipeline('gaussian-blur', blurShader, [8, 8, 1]);
    await this.createComputePipeline('color-adjust', colorAdjustShader, [8, 8, 1]);

    console.log('🎨 基本フィルター初期化完了');
  }

  /**
   * 機能検出・性能測定
   */
  private async detectCapabilities(adapter: GPUAdapter): Promise<IWebGPUCapabilities> {
    const features = Array.from(adapter.features);
    const limits = adapter.limits;

    return {
      maxTextureSize: limits.maxTextureDimension2D || 2048,
      maxBufferSize: limits.maxBufferSize || 256 * 1024 * 1024,
      maxComputeWorkgroupSize: limits.maxComputeWorkgroupSizeX || 256,
      supportsCompute: true, // WebGPUなら基本対応
      supportsTimestamp: features.includes('timestamp-query')
    };
  }

  /**
   * エラーハンドリング設定
   */
  private setupErrorHandling(): void {
    if (!this.device) return;

    this.device.addEventListener('uncapturederror', (event) => {
      console.error('🚨 WebGPU Uncaptured Error:', event.error);
      this.eventBus.emit('webgpu:error', {
        error: `Uncaptured error: ${event.error.message}`,
        fallback: false
      });
    });

    // デバイスロスト検出
    this.device.lost.then((info) => {
      console.warn(`🔌 WebGPU Device Lost: ${info.reason} - ${info.message}`);
      this.eventBus.emit('webgpu:error', {
        error: `Device lost: ${info.reason}`,
        fallback: true
      });
    });
  }

  /**
   * パフォーマンス統計取得
   */
  public getPerformanceStats(): Record<string, number> {
    return Object.fromEntries(this.operationTimings);
  }

  /**
   * 機能情報取得
   */
  public getCapabilities(): IWebGPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * 初期化状態確認
   */
  public isWebGPUReady(): boolean {
    return this.isInitialized && !!this.device;
  }

  /**
   * リソース解放・アプリケーション終了時
   */
  public destroy(): void {
    console.log('🔄 WebGPURenderer終了処理開始...');

    // バッファープール解放
    this.bufferPool.forEach((buffer, name) => {
      console.log(`💾 Buffer解放: ${name}`);
      buffer.destroy();
    });
    this.bufferPool.clear();

    // パイプライン情報クリア
    this.computePipelines.clear();
    this.operationTimings.clear();

    // デバイス情報クリア
    this.device = null;
    this.queue = null;
    this.capabilities = null;
    this.isInitialized = false;

    console.log('✅ WebGPURenderer終了処理完了');
  }
}