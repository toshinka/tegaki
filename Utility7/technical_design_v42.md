# 技術設計 v4.2 - PixiV8Chrome統合規約準拠版

**ドキュメント**: アーキテクチャ・技術実装詳細  
**対象読者**: 開発者・Claude・技術レビュアー  
**最終更新**: 2025年8月4日  
**v4.2対応**: Chrome最新API統合・段階的縮退戦略・責任分界明確化

## 🏗️ アーキテクチャ概要

### 基盤技術スタック（v4.2統合）
```
✅ Core Technology:
├─ PixiJS v8.11.0 - 統合パッケージ・WebGPU優先・段階的縮退
├─ Chrome最新API - WebGPU・OffscreenCanvas・WebCodecs・PerformanceObserver
├─ TypeScript 5.0+ - 厳格型チェック・開発効率・エラー防止
├─ Vite - ESM・Tree Shaking・Hot Reload・最適化
└─ ESM Modules - モダンJS・依存関係最適化

✅ 設計思想（v4.2革新）:
├─ PixiV8Chrome統合 - 命名で技術・責任明示・AI理解容易
├─ 段階的縮退戦略 - Tier1-3自動選択・確実性保証
├─ Chrome最新API活用 - WebGPU・OffscreenCanvas・WebCodecs統合
├─ EventBus中心疎結合 - 型安全通信・デバッグ支援
├─ 単一責任原則 - 1クラス1機能・Claude理解容易
├─ インターフェース先行 - 契約明確・実装分離
└─ 非破壊型Container - PixiJS v8.11.0 Container活用・元データ保持
```

### 段階的縮退戦略（Tier1-3・PROJECT_SPEC準拠）
```
🎯 段階的縮退戦略（確実性保証）:
Tier 1: WebGPU + Chrome最新API完全統合（理想環境）
 ├─ 要件: WebGPU・OffscreenCanvas・WebCodecs・PerformanceObserver対応
 ├─ 目標: 60FPS安定、2048x2048キャンバス、120Hz入力対応
 ├─ 対象: Chrome/Edge最新、高性能GPU、8GB+メモリ
 └─ 機能: 高度ブラシ・リアルタイム変形・GPU並列処理・WebCodecs出力

Tier 2: WebGL2 + Chrome基本API活用（標準環境）
 ├─ 要件: WebGL2・OffscreenCanvas・PerformanceObserver対応
 ├─ 目標: 30-60FPS安定、1024x1024キャンバス、標準入力処理
 ├─ 対象: Firefox/Safari最新、中性能GPU、4GB+メモリ
 └─ 機能: 標準ブラシ・基本エフェクト・レイヤー合成・PNG出力

Tier 3: WebGL + 基本機能（後方互換）
 ├─ 要件: WebGL・基本Canvas API対応
 ├─ 目標: 20-30FPS、512x512キャンバス、基本機能保証
 ├─ 対象: 旧ブラウザ、低性能GPU、2GB+メモリ
 └─ 機能: 基本描画・最小限レイヤー・軽量化・基本出力
```

## 📁 ディレクトリ構成（v4.2規約準拠・責任分界明確化）

```
src/
├── main.ts                         # エントリーポイント・アプリ起動
├── style.css                       # 基本CSS・ふたば色定義
├── core/                           # 基盤システム・Chrome API統合
│   ├── PixiV8ChromeAPIApplication.ts    # PixiJS初期化・Chrome API検出・段階的縮退
│   ├── PixiV8ChromeEventBus.ts          # 型安全イベント通信・Chrome API イベント
│   ├── PixiV8ChromeDrawingProcessor.ts  # 描画統合・ツール制御・WebGPU最適化
│   └── PixiV8ChromePerformanceMonitor.ts # 性能監視・PerformanceObserver・自動最適化
├── rendering/                      # レンダリング層・GPU最適化
│   ├── PixiV8ChromeLayerController.ts   # 20レイヤー管理・Container階層・非破壊型
│   ├── PixiV8WebGPURenderer.ts          # WebGPU専用処理・Compute Shader・Tier1機能
│   ├── PixiV8ChromeCanvasController.ts  # 4K対応・座標変換・Viewport・画面管理
│   └── PixiV8ChromeTextureProcessor.ts  # GPU メモリ・Atlas・圧縮・WebGPU最適化
├── input/                          # 入力処理・マウス+ペン特化
│   ├── PixiV8ChromeInputController.ts   # 統合入力・Pointer Events・Chrome Scheduler
│   ├── PixiV8ChromePointerProcessor.ts  # 筆圧・傾き・座標変換・2.5K精度・120Hz対応
│   └── PixiV8ChromeShortcutController.ts # キーボード・ペンサイドボタン・設定管理
├── tools/                          # ツールシステム・段階実装
│   ├── PixiV8ChromeToolController.ts    # ツール統合・状態管理・設定永続化
│   ├── PixiV8ChromePenTool.ts           # ペン・基本線描画・Phase1
│   ├── PixiV8ChromeBrushTool.ts         # 筆・テクスチャ・Phase2・WebGPU最適化
│   ├── PixiV8ChromeEraserTool.ts        # 消しゴム・削除・Phase1・非破壊処理
│   ├── PixiV8ChromeFillTool.ts          # 塗りつぶし・フラッドフィル・Phase2
│   └── PixiV8ChromeShapeTool.ts         # 図形・直線・矩形・円・Phase2
├── ui/                             # UI制御・2.5K最適化
│   ├── PixiV8ChromeUIController.ts      # UI統合・ふたば色・レスポンシブ・Chrome API表示
│   ├── PixiV8ChromeToolbar.ts           # ツールバー・80px幅・56pxアイコン
│   ├── PixiV8ChromeColorPalette.ts      # HSV円形・200px・ふたば色プリセット
│   └── PixiV8ChromeLayerPanel.ts        # レイヤー・400px幅・64px項目
├── export/                         # 出力機能・Chrome API統合
│   ├── PixiV8ChromeExportController.ts  # 出力統合・形式選択・品質管理
│   ├── PixiV8WebCodecsExporter.ts       # WebCodecs活用・動画出力・リアルタイムエンコード
│   └── PixiV8ChromeImageExporter.ts     # 静止画出力・PNG・JPEG・WebP・2K対応
├── workers/                        # OffscreenCanvas・並列処理
│   ├── PixiV8OffscreenWorker.ts         # OffscreenCanvas Worker・並列描画
│   └── PixiV8ComputeWorker.ts           # WebGPU Compute・GPU並列処理
├── constants/                      # 定数・設定・2.5K環境
│   ├── ui-constants.ts             # UI定数・サイズ・色・レイアウト
│   ├── drawing-constants.ts        # 描画定数・性能・ブラシサイズ
│   ├── performance-constants.ts    # 性能定数・制限値・警告閾値
│   └── chrome-api-constants.ts     # Chrome API制約・対応状況・Tier設定
└── types/                          # 型定義・TypeScript
    ├── drawing.types.ts            # 描画関連・ツール・レイヤー型
    ├── ui.types.ts                # UI関連・イベント・状態型
    ├── performance.types.ts        # 性能関連・監視・メトリクス型
    └── chrome-api.types.ts         # Chrome API関連・機能検出・Tier型
```

## 🎨 モジュール設計・責任分界（v4.2準拠）

### Core Layer（基盤システム・Chrome API統合）
```typescript
// PixiV8ChromeAPIApplication.ts - Chrome API検出・PixiJS初期化・段階的縮退
export class PixiV8ChromeAPIApplication {
  private chromeAPICapabilities: ChromeAPICapabilities;
  private selectedTier: 'tier1' | 'tier2' | 'tier3';
  
  // Chrome API機能検出・段階的縮退戦略
  public async detectChromeAPISupport(): Promise<ChromeAPICapabilities>
  
  // Tier自動選択・最適環境判定
  private selectOptimalTier(capabilities: ChromeAPICapabilities): TierConfig
  
  // PixiJS初期化・WebGPU優先・確実フォールバック
  public async initialize(container: HTMLElement): Promise<boolean>
  
  // 2560×1440対応・デバイスピクセル比・高解像度
  private getOptimalCanvasSize(): { width: number; height: number }
  
  // レンダラー種別取得・性能調整・Tier判定
  public getRendererInfo(): { type: string; tier: string; capabilities: string[] }
}

// PixiV8ChromeEventBus.ts - 型安全イベント通信・Chrome API統合
interface IPixiV8ChromeEventData {
  // 描画イベント（従来）
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  
  // Chrome API統合イベント（v4.2新設）
  'chrome-api:webgpu-initialized': { adapter: GPUAdapter; device: GPUDevice };
  'chrome-api:offscreen-worker-ready': { workerId: string; capabilities: string[] };
  'chrome-api:webcodecs-encoder-ready': { codec: string; maxFrameRate: number };
  'chrome-api:tier-changed': { fromTier: string; toTier: string; reason: string };
  
  // 性能監視イベント（PerformanceObserver統合）
  'performance:fps-changed': { current: number; target: number; trend: string };
  'performance:memory-usage': { used: number; limit: number; percentage: number };
  'performance:threshold-exceeded': { metric: string; current: number; threshold: number };
}

export class PixiV8ChromeEventBus {
  // 型安全リスナー登録・自動解除機能
  public on<K extends keyof IPixiV8ChromeEventData>(
    event: K, 
    callback: (data: IPixiV8ChromeEventData[K]) => void
  ): () => void
  
  // Chrome API統合イベント発火・データ検証
  public emit<K extends keyof IPixiV8ChromeEventData>(
    event: K, 
    data: IPixiV8ChromeEventData[K]
  ): void
  
  // 性能監視・Chrome API連携デバッグ
  public getEventHistory(): Array<{ event: string; timestamp: number; tier?: string }>
}

// PixiV8ChromeDrawingProcessor.ts - 描画統合・Chrome API最適化
export class PixiV8ChromeDrawingProcessor {
  private webgpuProcessor: PixiV8WebGPUProcessor | null = null;
  private offscreenProcessor: PixiV8OffscreenProcessor | null = null;
  private currentTier: TierConfig;
  
  // Chrome API統合プロセッサー初期化
  private async initializeChromeAPIProcessors(): Promise<void>
  
  // WebGPU最適化描画・Compute Shader活用
  private async processWithWebGPU(strokeData: StrokeData): Promise<void>
  
  // OffscreenCanvas並列処理・メインスレッド最適化
  private async processWithOffscreenCanvas(layerData: LayerData): Promise<void>
  
  // 段階的縮退処理・Tier適応描画
  private async processWithTierAdaptation(drawingData: DrawingData): Promise<void>
  
  // ベクターデータ非破壊保持・Container階層管理
  private createNonDestructiveLayer(strokeData: StrokeData): PIXI.Container
}

// PixiV8ChromePerformanceMonitor.ts - PerformanceObserver統合・自動最適化
export class PixiV8ChromePerformanceMonitor {
  private performanceObserver: PerformanceObserver | null = null;
  private metrics: PerformanceMetrics;
  private currentTier: TierConfig;
  
  // PerformanceObserver初期化・リアルタイム監視
  public startMonitoring(): void
  
  // FPS・メモリ・入力遅延・描画時間監視
  private monitorPerformanceMetrics(): void
  
  // 閾値超過時自動最適化・Tier調整
  private handlePerformanceThresholdExceeded(metric: string, value: number): void
  
  // 段階的品質調整・動的最適化
  private adjustQualityForPerformance(direction: 'up' | 'down'): void
}
```

### Rendering Layer（GPU最適化・Chrome API統合）
```typescript
// PixiV8ChromeLayerController.ts - Container階層・非破壊レイヤー管理
export class PixiV8ChromeLayerController {
  // PixiJS v8.11.0 Container階層・20レイヤー管理・非破壊型
  public createLayer(name: string, type: LayerType): string
  
  // 非破壊変形・新Container生成・元データ保持
  public transformLayer(layerId: string, transform: PIXI.Matrix): string
  
  // WebGPU最適化合成・ブレンドモード・透明度制御
  private compositeLayersWithWebGPU(layers: LayerData[]): Promise<PIXI.RenderTexture>
  
  // OffscreenCanvas並列処理・レイヤー処理最適化
  private processLayerWithOffscreen(layerId: string): Promise<void>
}

// PixiV8WebGPURenderer.ts - WebGPU専用・Compute Shader・Tier1機能
export class PixiV8WebGPURenderer {
  private gpu: GPU;
  private device: GPUDevice;
  private computeShaders: Map<string, GPUComputePipeline>;
  
  // WebGPU初期化・アダプター選択・デバイス作成
  public async initializeWebGPU(): Promise<boolean>
  
  // Compute Shader作成・GPU並列処理・フィルター効果
  public async createComputeShader(shaderCode: string, name: string): Promise<GPUComputePipeline>
  
  // GPU並列描画・大量ストローク対応
  public async processStrokesParallel(strokes: StrokeData[]): Promise<void>
  
  // GPU メモリプール・効率管理・最適化
  private manageGPUMemoryPool(): void
}

// PixiV8ChromeTextureProcessor.ts - GPU メモリ・WebGPU最適化
export class PixiV8ChromeTextureProcessor {
  // WebGPU最適化テクスチャ作成・圧縮・効率化
  public createOptimizedTexture(source: ImageSource): Promise<PIXI.Texture>
  
  // テクスチャAtlas・WebGPU対応・メモリ効率
  public createWebGPUTextureAtlas(textures: PIXI.Texture[]): Promise<PIXI.Texture>
  
  // ガベージコレクション・WebGPU リソース管理
  public cleanupWebGPUTextures(): void
}
```

### Input Layer（デバイス対応・Chrome API統合）
```typescript
// PixiV8ChromeInputController.ts - 統合入力・Chrome Scheduler API
export class PixiV8ChromeInputController {
  private schedulerAPI: Scheduler | null = null;
  private currentTier: TierConfig;
  
  // Chrome Scheduler API活用・高優先度入力処理
  private setupChromeSchedulerAPI(): void
  
  // 120Hz対応・高頻度入力処理・Tier1機能
  private setupHighFrequencyInput(): void
  
  // 段階的入力処理・Tier適応・品質調整
  private processInputWithTierAdaptation(event: PointerEvent): void
  
  // WebGPU座標変換・GPU加速・精度向上
  private transformCoordinatesWithWebGPU(screenPoint: Point): Promise<PIXI.Point>
}

// PixiV8ChromePointerProcessor.ts - 筆圧最適化・Chrome API統合
export class PixiV8ChromePointerProcessor {
  // 120Hz筆圧処理・Chrome Pointer Events・高精度
  public processHighFrequencyPressure(events: PointerEvent[]): ProcessedPressureData
  
  // Chrome API最適化・入力遅延最小化
  private optimizeInputLatencyWithChromeAPI(): void
  
  // WebGPU筆圧カーブ処理・GPU加速補間
  private processPressureCurveWithWebGPU(rawData: number[]): Promise<number[]>
}
```

### Tools Layer（ツールシステム・Chrome API最適化）
```typescript
// PixiV8Chrome統一ツールインターフェース
interface IPixiV8ChromeDrawingTool {
  readonly name: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  readonly chromeAPIFeatures: string[]; // WebGPU・OffscreenCanvas等
  readonly supportedTiers: ('tier1' | 'tier2' | 'tier3')[];
  
  // Chrome API統合初期化
  initializeWithChromeAPI(capabilities: ChromeAPICapabilities): Promise<void>;
  
  // Tier適応処理・段階的機能調整
  adaptToTier(tier: TierConfig): void;
  
  // 従来インターフェース継承
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IPixiV8ChromeEventData['drawing:start']): void;
  onPointerMove(event: IPixiV8ChromeEventData['drawing:move']): void;
  onPointerUp(event: IPixiV8ChromeEventData['drawing:end']): void;
}

// PixiV8ChromePenTool.ts - Chrome API最適化ペンツール
export class PixiV8ChromePenTool implements IPixiV8ChromeDrawingTool {
  public readonly chromeAPIFeatures = ['webgpu', 'offscreen-canvas'];
  public readonly supportedTiers = ['tier1', 'tier2', 'tier3'];
  
  // WebGPU最適化描画・GPU加速ストローク
  private drawWithWebGPU(strokeData: StrokeData): Promise<void>
  
  // OffscreenCanvas並列処理・メインスレッド最適化
  private processWithOffscreenCanvas(points: PIXI.Point[]): Promise<ProcessedStroke>
  
  // Tier適応描画・段階的品質調整
  private drawWithTierAdaptation(strokeData: StrokeData, tier: TierConfig): void
}
```

### Export Layer（出力機能・Chrome API統合）
```typescript
// PixiV8WebCodecsExporter.ts - WebCodecs活用・動画出力
export class PixiV8WebCodecsExporter {
  private videoEncoder: VideoEncoder | null = null;
  private currentTier: TierConfig;
  
  // WebCodecs初期化・120FPS対応・Tier1機能
  public async initializeWebCodecs(): Promise<boolean>
  
  // リアルタイムエンコード・PixiJS描画→動画
  public async startRealTimeEncoding(targetFPS: number): Promise<void>
  
  // Tier適応出力・品質調整・フォールバック
  private exportWithTierAdaptation(canvas: HTMLCanvasElement): Promise<Blob>
}
```

## 🚀 Chrome最新API統合・段階的縮退実装

### Chrome API機能検出・Tier自動選択
```typescript
// Chrome API対応状況検出・段階的縮退準備
export class PixiV8ChromeAPIDetector {
  public static async detectChromeAPICapabilities(): Promise<ChromeAPICapabilities> {
    const capabilities: ChromeAPICapabilities = {
      // WebGPU検出・アダプター性能評価
      webgpu: await this.detectWebGPUSupport(),
      
      // OffscreenCanvas検出・Worker対応確認
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      
      // WebCodecs検出・エンコーダー対応確認
      webCodecs: typeof VideoEncoder !== 'undefined',
      
      // PerformanceObserver検出・監視機能確認
      performanceObserver: typeof PerformanceObserver !== 'undefined',
      
      // Chrome Scheduler API検出・高優先度処理
      schedulerAPI: !!navigator.scheduling?.postTask,
      
      // GPU性能推定・メモリ容量・処理能力
      gpuTier: await this.estimateGPUTier(),
      
      // システムメモリ・ブラウザメモリ制限
      systemMemory: await this.estimateSystemMemory()
    };
    
    console.log('Chrome API Capabilities detected:', capabilities);
    return capabilities;
  }
  
  private static async detectWebGPUSupport(): Promise<WebGPUSupport> {
    if (!navigator.gpu) return { supported: false };
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return { supported: false };
      
      const device = await adapter.requestDevice();
      return {
        supported: true,
        adapter,
        device,
        features: Array.from(adapter.features),
        limits: adapter.limits
      };
    } catch (error) {
      console.warn('WebGPU detection failed:', error);
      return { supported: false };
    }
  }
}

// Tier自動選択・最適環境判定
export class PixiV8ChromeTierSelector {
  public static selectOptimalTier(capabilities: ChromeAPICapabilities): TierConfig {
    // Tier1判定: WebGPU + OffscreenCanvas + WebCodecs + 高性能GPU
    if (capabilities.webgpu.supported && 
        capabilities.offscreenCanvas && 
        capabilities.webCodecs && 
        capabilities.gpuTier >= 3) {
      return {
        id: 'tier1',
        name: 'Chrome最新API完全統合',
        features: ['webgpu', 'offscreen-canvas', 'webcodecs', 'performance-observer'],
        performance: {
          targetFPS: 60,
          canvasSize: 2048,
          maxLayers: 20,
          inputFrequency: 120, // 120Hz
          memoryLimit: 1024 // 1GB
        }
      };
    }
    
    // Tier2判定: WebGL2 + OffscreenCanvas + PerformanceObserver
    if (capabilities.offscreenCanvas && 
        capabilities.performanceObserver && 
        capabilities.gpuTier >= 2) {
      return {
        id: 'tier2',
        name: 'Chrome基本API活用',
        features: ['webgl2', 'offscreen-canvas', 'performance-observer'],
        performance: {
          targetFPS: 30,
          canvasSize: 1024,
          maxLayers: 10,
          inputFrequency: 60, // 60Hz
          memoryLimit: 512 // 512MB
        }
      };
    }
    
    // Tier3判定: WebGL + 基本機能
    return {
      id: 'tier3',
      name: '基本機能・後方互換',
      features: ['webgl', 'basic-canvas'],
      performance: {
        targetFPS: 20,
        canvasSize: 512,
        maxLayers: 5,
        inputFrequency: 30, // 30Hz
        memoryLimit: 256 // 256MB
      }
    };
  }
}
```

### WebGPU統合・Compute Shader実装
```typescript
// WebGPU Compute Pipeline・GPU並列処理
export class PixiV8WebGPUComputeProcessor {
  private device: GPUDevice;
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  
  public async createStrokeProcessingPipeline(): Promise<GPUComputePipeline> {
    const shaderCode = `
      @group(0) @binding(0) var<storage, read_write> strokes: array<vec4<f32>>;
      @group(0) @binding(1) var<storage, read_write> processed: array<vec4<f32>>;
      
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= arrayLength(&strokes)) { return; }
        
        // GPU並列ストローク処理・スムージング・最適化
        let stroke = strokes[index];
        let smoothed = smoothStroke(stroke);
        processed[index] = smoothed;
      }
      
      fn smoothStroke(stroke: vec4<f32>) -> vec4<f32> {
        // ベジエ曲線スムージング・GPU最適化
        return stroke; // 簡略化
      }
    `;
    
    const pipeline = await this.device.createComputePipeline({
      label: 'Stroke Processing Pipeline',
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: shaderCode }),
        entryPoint: 'main'
      }
    });
    
    this.computePipelines.set('stroke-processing', pipeline);
    return pipeline;
  }
  
  public async processStrokesParallel(strokes: StrokeData[]): Promise<ProcessedStroke[]> {
    const pipeline = this.computePipelines.get('stroke-processing');
    if (!pipeline) throw new Error('Stroke processing pipeline not initialized');
    
    // GPU バッファ作成・データ転送
    const inputBuffer = this.createStrokeBuffer(strokes);
    const outputBuffer = this.createOutputBuffer(strokes.length);
    
    // Compute Pass実行・GPU並列処理
    const commandEncoder = this.device.createCommandEncoder();
    const compute