# 技術設計 v4.1

**ドキュメント**: アーキテクチャ・技術実装詳細・参考資料統合版  
**対象読者**: 開発者・Claude・技術レビュアー  
**最終更新**: 2025年8月5日

## 🏗️ アーキテクチャ概要

### 基盤技術スタック
```
✅ Core Technology:
├─ PixiJS v8.11.0 - WebGPU統一基盤・GPU描画・Container階層
├─ TypeScript 5.0+ - 厳格型チェック・開発効率・エラー防止
├─ Vite - ESM・Tree Shaking・Hot Reload・最適化
├─ Tabler Icons v3.34.1 - SVGアイコン統一・WebGPU Sprite最適化
└─ ESM Modules - モダンJS・依存関係最適化

✅ 設計思想:
├─ EventBus中心疎結合 - 型安全通信・デバッグ支援
├─ 単一責任原則 - 1クラス1機能・Claude理解容易
├─ インターフェース先行 - 契約明確・実装分離
├─ 段階的縮退戦略 - WebGPU→WebGL2→WebGL自動切り替え
└─ v4.1: GPU最適化UI・120FPS描画・リアルタイム監視
```

### WebGPU対応戦略・v4.1拡張
```
🎯 段階的縮退戦略・性能監視統合:
Tier 1: WebGPU + OffscreenCanvas + Compute Shader
 ├─ 目標: 120FPS安定、4K キャンバス、GPU並列描画
 ├─ 対象: Chrome/Edge最新、高性能GPU、16GB+メモリ
 ├─ 機能: Compute Shader描画・WebGPU HSV色選択・GPU加速UI
 └─ v4.1: リアルタイム性能監視・GPU使用率表示・遅延1ms以下

Tier 2: WebGL2 + GPU最適化描画 + 基本監視
 ├─ 目標: 60FPS安定、2048x2048キャンバス、GPU効率活用
 ├─ 対象: Firefox/Safari最新、中性能GPU、8GB+メモリ
 ├─ 機能: GPU最適化Graphics・WebGL2 Shader・レイヤー合成
 └─ v4.1: 基本性能監視・メモリ警告・品質自動調整

Tier 3: WebGL + 基本機能 + 最小監視
 ├─ 目標: 30FPS、1024x1024キャンバス、安定動作
 ├─ 対象: 旧ブラウザ、低性能GPU、4GB+メモリ
 ├─ 機能: 基本描画・最小限レイヤー・軽量化
 └─ v4.1: 最小性能監視・警告表示・機能制限
```

## 📁 ディレクトリ構成（v4.1統合版・変更不可）

```
src/
├── main.ts                         # エントリーポイント・アプリ起動
├── style.css                       # 基本CSS・ふたば色定義・v4.1拡張
├── core/                           # 基盤システム
│   ├── PixiApplication.ts            # PixiJS初期化・WebGPU制御・2.5K対応
│   ├── EventBus.ts                  # 型安全イベント通信・履歴・デバッグ
│   ├── DrawingEngine.ts             # 描画統合・ツール制御・Graphics管理
│   ├── PerformanceManager.ts        # v4.1: 性能監視・GPU使用率・遅延測定
│   └── TablerIconManager.ts         # v4.1: SVGアイコン管理・WebGPU Sprite
├── rendering/                      # レンダリング層・GPU最適化
│   ├── LayerManager.ts              # 20レイヤー管理・Container階層
│   ├── WebGPURenderer.ts            # WebGPU専用処理・Compute Shader
│   ├── CanvasManager.ts             # 4K対応・座標変換・Viewport
│   ├── TextureManager.ts            # GPU メモリ・Atlas・圧縮
│   └── HSVColorRenderer.ts          # v4.1: WebGPU色選択・Shader実装
├── input/                          # 入力処理・マウス+ペン特化
│   ├── InputManager.ts              # 統合入力・Pointer Events・筆圧対応
│   ├── PointerProcessor.ts          # 筆圧・傾き・座標変換・2.5K精度
│   ├── ShortcutManager.ts           # キーボード・ペンサイドボタン
│   └── LatencyMeasurer.ts           # v4.1: 入力遅延測定・1ms精度
├── tools/                          # ツールシステム・段階実装
│   ├── ToolManager.ts               # ツール統合・状態管理・設定永続化
│   ├── PenTool.ts                  # ペン・基本線描画・Phase1
│   ├── BrushTool.ts                # 筆・テクスチャ・Phase2
│   ├── EraserTool.ts               # 消しゴム・削除・Phase1
│   ├── FillTool.ts                 # 塗りつぶし・フラッドフィル・Phase2
│   ├── ShapeTool.ts                # 図形・直線・矩形・円・Phase2
│   ├── AirsprayTool.ts             # v4.1: エアスプレー・Compute Shader
│   └── BlurTool.ts                 # v4.1: ボカシ・GPU並列処理
├── ui/                             # UI制御・2.5K最適化・v4.1拡張
│   ├── UIManager.ts                 # UI統合・ふたば色・レスポンシブ
│   ├── Toolbar.ts                  # ツールバー・64px幅・48pxアイコン・Tabler統合
│   ├── ColorPalette.ts             # v4.1: HSV円形・WebGPU・移動可能
│   ├── LayerPanel.ts               # レイヤー・400px幅・64px項目・性能表示
│   ├── PopupManager.ts             # v4.1: z-index:2000・移動可能・GPU最適化
│   ├── PerformanceDisplay.ts       # v4.1: リアルタイム監視UI・FPS・GPU
│   └── TimelinePanel.ts            # v4.1: アニメーション・WebCodecs・120FPS
├── constants/                      # 定数・設定・2.5K環境
│   ├── ui-constants.ts             # UI定数・サイズ・色・レイアウト
│   ├── drawing-constants.ts        # 描画定数・性能・ブラシサイズ
│   ├── performance-constants.ts    # v4.1: 性能定数・監視閾値・GPU制限
│   └── icon-constants.ts           # v4.1: Tabler Icons マッピング・SVG定義
└── types/                          # 型定義・TypeScript
    ├── drawing.types.ts            # 描画関連・ツール・レイヤー型
    ├── ui.types.ts                # UI関連・イベント・状態型
    ├── performance.types.ts        # v4.1: 性能関連・監視・メトリクス型
    └── webgpu.types.ts            # v4.1: WebGPU・Shader・GPU型定義
```

## 🎨 モジュール設計・責任分界・v4.1拡張

### Core Layer（基盤システム）- 性能監視統合
```typescript
// PixiApplication.ts - WebGPU初期化・レンダラー制御・v4.1拡張
export class EventBus {
  // 型安全リスナー登録・自動解除機能・性能監視対応
  public on<K extends keyof IEventData>(event: K, callback: Function): () => void
  
  // 型安全イベント発火・データ検証・性能測定
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void
  
  // v4.1: 性能イベント履歴・監視・分析
  public getPerformanceHistory(): PerformanceEvent[]
}

// DrawingEngine.ts - 描画統合・ツール制御・GPU最適化
export class DrawingEngine {
  // ツール統合・描画ロジック・Graphics最適化・性能監視
  public startDrawing(data: IEventData['drawing:start']): void
  public continueDrawing(data: IEventData['drawing:move']): void
  public endDrawing(data: IEventData['drawing:end']): void
  
  // スムージング・ベジエ曲線・手ブレ軽減・GPU加速
  private applySmoothingToStroke(points: PIXI.Point[]): PIXI.Point[]
  
  // v4.1: GPU並列描画・Compute Shader・大量ストローク処理
  private processStrokesParallel(strokes: StrokeData[]): Promise<void>
}

// v4.1: PerformanceManager.ts - 包括的性能監視・GPU・メモリ・遅延
export class PerformanceManager {
  private metrics: PerformanceMetrics = {
    fps: { current: 0, average: 0, target: 60, history: [] },
    gpu: { usage: 0, memory: 0, temperature: 0, webgpuActive: false },
    memory: { used: 0, available: 0, limit: 1024, leakDetected: false },
    latency: { input: 0, render: 0, total: 0, target: 16 },
    tier: { current: 'webgl2', capabilities: null, autoAdjust: true }
  };

  // 1GB制限・警告800MB・強制GC・メモリリーク検出
  private checkMemoryUsage(): MemoryStatus
  
  // 120FPS監視・動的品質調整・Tier切り替え
  private monitorFrameRate(): void
  
  // v4.1: GPU使用率監視・WebGPU・温度・メモリ使用量
  private monitorGPUUsage(): void
  
  // v4.1: 入力遅延測定・1ms精度・Pointer Events→描画
  private measureInputLatency(): void
  
  // v4.1: 自動品質調整・Tier降格・機能制限
  private adjustQualityTier(direction: 'up' | 'down'): void
  
  // v4.1: リアルタイムUI更新・性能表示
  public updatePerformanceDisplay(): void
}

// v4.1: TablerIconManager.ts - SVGアイコン統合・WebGPU Sprite最適化
export class TablerIconManager {
  private iconCache: Map<string, PIXI.Texture> = new Map();
  private spriteAtlas: PIXI.Texture | null = null;
  
  // Tabler Icons v3.34.1 読み込み・SVG→Texture変換・GPU最適化
  public async loadIcon(name: string): Promise<PIXI.Texture>
  
  // スプライトアトラス生成・GPU効率・バッチ描画
  public async createSpriteAtlas(iconNames: string[]): Promise<void>
  
  // アイコン取得・キャッシュ・GPU メモリ効率
  public getIcon(name: string): PIXI.Texture | null
  
  // ツールアイコンマッピング・統一管理
  public getToolIcon(toolName: string): PIXI.Texture | null
}
```

### Rendering Layer（GPU最適化）- v4.1 Compute Shader統合
```typescript
// LayerManager.ts - Container階層・20レイヤー管理・性能監視
export class LayerManager {
  // PixiJS Container階層・Z-index動的制御・GPU最適化
  public createLayer(name: string): string
  public deleteLayer(layerId: string): void
  public reorderLayers(): void
  
  // ブレンドモード・透明度・表示制御・WebGPU対応
  public setLayerBlendMode(layerId: string, mode: PIXI.BlendModes): void
  
  // v4.1: レイヤー並列処理・OffscreenCanvas・サムネイル生成
  public generateLayerThumbnails(): Promise<Map<string, PIXI.Texture>>
  
  // v4.1: メモリ効率監視・大容量レイヤー・制限管理
  private monitorLayerMemoryUsage(): void
}

// WebGPURenderer.ts - WebGPU専用・Compute Shader・v4.1完全対応
export class WebGPURenderer {
  private device: GPUDevice | null = null;
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  
  // GPU並列処理・Compute Shader・フィルター効果・大量データ
  public async executeComputeShader(
    shaderName: string, 
    inputData: Float32Array,
    outputSize: number
  ): Promise<Float32Array>
  
  // v4.1: エアスプレー・パーティクル生成・GPU並列
  public async renderAirsprayParticles(
    position: { x: number; y: number },
    intensity: number,
    particleCount: number
  ): Promise<void>
  
  // v4.1: ボカシ・ガウシアンブラー・高品質・リアルタイム
  public async applyGaussianBlur(
    texture: PIXI.Texture,
    radius: number
  ): Promise<PIXI.Texture>
  
  // GPU メモリプール・効率管理・制限監視
  private manageGPUMemory(): void
  
  // v4.1: GPU温度監視・スロットリング・安定性確保
  private monitorGPUTemperature(): void
}

// v4.1: HSVColorRenderer.ts - WebGPU色選択・Shader実装
export class HSVColorRenderer {
  private colorWheelPipeline: GPURenderPipeline | null = null;
  private colorWheelTexture: PIXI.Texture | null = null;
  
  // HSV円形ピッカー・WebGPU Shader・120x120px・リアルタイム
  public async renderColorWheel(): Promise<PIXI.Texture>
  
  // 色相環Shader・高品質・GPU最適化
  private createColorWheelShader(): string
  
  // 色選択・座標→HSV変換・リアルタイム
  public screenToHSV(x: number, y: number): { h: number; s: number; v: number }
  
  // HSV→RGB変換・GPU並列・高精度
  public hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number }
}

// TextureManager.ts - テクスチャ最適化・Atlas統合・v4.1メモリ監視
export class TextureManager {
  // テクスチャAtlas・メモリ効率・圧縮・GPU最適化
  public createTextureAtlas(textures: PIXI.Texture[]): PIXI.Texture
  
  // ガベージコレクション・メモリリーク防止・自動管理
  public cleanupUnusedTextures(): void
  
  // v4.1: 大容量テクスチャ・4K対応・ストリーミング
  public async loadLargeTexture(
    url: string, 
    maxSize: number
  ): Promise<PIXI.Texture>
  
  // v4.1: GPU メモリ監視・使用量・制限・警告
  private monitorGPUTextureMemory(): GPUMemoryStatus
}
```

### Input Layer（デバイス対応）- v4.1 遅延測定統合
```typescript
// InputManager.ts - Pointer Events統合・遅延測定
export class InputManager {
  // マウス・ペンタブレット・デバイス抽象化・120Hz対応
  private setupPointerEvents(): void
  
  // 座標変換・2560×1440対応・サブピクセル精度・GPU変換
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point
  
  // 筆圧処理・4096レベル・自然な変化・デバイス補正
  private processPressure(rawPressure: number): number
  
  // v4.1: 入力遅延測定・Pointer Event→描画反映・1ms精度
  private measureInputLatency(event: PointerEvent): void
}

// PointerProcessor.ts - 高精度処理・筆圧最適化・v4.1液タブレット特化
export class PointerProcessor {
  // 筆圧曲線補正・デバイス差異・調整・プロファイル管理
  public calibratePressureCurve(deviceType: string): void
  
  // 傾き検出・ペン表現・自然な描画・角度計算
  public processTiltData(tiltX: number, tiltY: number): { angle: number; intensity: number }
  
  // v4.1: サイドボタン・ショートカット・カスタマイズ
  public processSideButtons(buttons: number): string[]
  
  // v4.1: 120Hz入力・高頻度更新・スムージング
  public processHighFrequencyInput(events: PointerEvent[]): ProcessedInput[]
}

// v4.1: LatencyMeasurer.ts - 遅延測定・1ms精度・最適化指標
export class LatencyMeasurer {
  private measurements: LatencyMeasurement[] = [];
  private targetLatency = 16; // 60FPS基準
  
  // 入力→描画遅延測定・E2E・高精度
  public measureE2ELatency(inputEvent: PointerEvent): Promise<number>
  
  // 描画→表示遅延・GPU→ディスプレイ・V-Sync考慮
  public measureRenderLatency(): Promise<number>
  
  // 遅延履歴・統計・改善指標
  public getLatencyStatistics(): LatencyStats
  
  // 自動最適化・設定調整・遅延改善
  public optimizeForLatency(): void
}
```

### Tool Layer（ツールシステム）- v4.1 GPU加速ツール
```typescript
// ツール共通インターフェース・Claude理解容易・v4.1拡張
interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  readonly gpuAccelerated: boolean; // v4.1: GPU対応フラグ
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  
  // v4.1: GPU設定・Compute Shader対応
  configureGPUAcceleration(enabled: boolean): void;
  getPerformanceMetrics(): ToolPerformanceMetrics;
}

// PenTool.ts - 基本線描画・Phase1実装・GPU最適化
export class PenTool implements IDrawingTool {
  public readonly gpuAccelerated = true;
  
  // PixiJS Graphics・基本描画・スムージング・GPU加速
  public onPointerMove(event: IEventData['drawing:move']): void
  
  // 筆圧対応サイズ・自然な太さ変化・補間
  private calculateBrushSize(pressure: number): number
  
  // v4.1: GPU並列描画・大量点処理・Batch最適化
  private renderStrokeGPU(points: PIXI.Point[]): void
}

// v4.1: AirsprayTool.ts - Compute Shader・パーティクル・GPU並列
export class AirsprayTool implements IDrawingTool {
  public readonly gpuAccelerated = true;
  private computeShader: string = `
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index >= arrayLength(&particles)) { return; }
      
      // パーティクル生成・位置・速度・色・寿命
      particles[index] = generateParticle(
        sprayPosition,
        sprayIntensity,
        sprayRadius,
        random(index)
      );
    }
  `;
  
  // エアスプレー描画・GPU並列・リアルタイム・2048粒子
  public async renderAirspray(
    position: PIXI.Point,
    intensity: number,
    radius: number
  ): Promise<void>
  
  // パーティクル設定・密度・拡散・GPU最適化
  public configureParticles(density: number, spread: number): void
}

// v4.1: BlurTool.ts - ガウシアンブラー・GPU並列・高品質
export class BlurTool implements IDrawingTool {
  public readonly gpuAccelerated = true;
  
  // リアルタイムブラー・GPU並列・高品質・60FPS
  public async applyBlur(
    area: PIXI.Rectangle,
    radius: number
  ): Promise<void>
  
  // ガウシアンカーネル・GPU最適化・メモリ効率
  private createGaussianKernel(radius: number): Float32Array
}
```

### UI Layer（ユーザーインターフェース）- v4.1 GPU最適化UI
```typescript
// UIManager.ts - UI統合・ふたば色・レスポンシブ・v4.1性能表示
export class UIManager {
  // 基本UI初期化・2.5K最適化・Grid Layout・GPU加速
  public async initializeUI(): Promise<void>
  
  // v4.1: 性能監視UI・リアルタイム・FPS・GPU・メモリ
  public initializePerformanceDisplay(): void
  
  // v4.1: ポップアップ管理・z-index:2000・移動可能
  public showPopup(type: string, position: { x: number; y: number }): void
  
  // 動的レイアウト・画面サイズ・DPR対応
  private adjustLayoutForDisplay(): void
}

// v4.1: PopupManager.ts - z-index:2000・移動可能・GPU最適化
export class PopupManager {
  private activePopups: Map<string, PopupInstance> = new Map();
  private dragState: DragState | null = null;
  
  // ポップアップ作成・移動可能・GPU加速・backdrop-filter
  public createPopup(config: PopupConfig): string
  
  // ドラッグ&ドロップ・GPU加速・120FPS・範囲制限
  public enableDragging(popupId: string): void
  
  // 重ね順管理・z-index・フォーカス・自動調整
  private manageZIndex(): void
  
  // GPU最適化・transform・will-change・Composite Layer
  private optimizeForGPU(element: HTMLElement): void
}

// v4.1: PerformanceDisplay.ts - リアルタイム監視UI・数値表示
export class PerformanceDisplay {
  private updateInterval: number = 100; // 10fps更新
  
  // FPS表示・色分け・excellent/good/warning/critical
  public updateFPSDisplay(fps: number): void
  
  // GPU使用率・WebGPU・温度・メモリ使用量
  public updateGPUDisplay(metrics: GPUMetrics): void
  
  // メモリ使用量・1GB制限・警告・グラフ表示
  public updateMemoryDisplay(used: number, limit: number): void
  
  // 入力遅延・1ms精度・目標値・改善指標
  public updateLatencyDisplay(latency: number): void
  
  // 設定・表示切り替え・位置・透明度
  public configureDisplay(config: PerformanceDisplayConfig): void
}

// v4.1: TimelinePanel.ts - アニメーション・WebCodecs・120FPS
export class TimelinePanel {
  private frames: AnimationFrame[] = [];
  private webCodecsEncoder: VideoEncoder | null = null;
  
  // フレーム管理・64x48px・WebGPU RenderTexture・並列生成
  public addFrame(): string
  public deleteFrame(frameId: string): void
  public reorderFrames(fromIndex: number, toIndex: number): void
  
  // 120FPS再生・WebCodecs・リアルタイム・オニオンスキン
  public startPlayback(fps: number): void
  public stopPlayback(): void
  
  // 動画出力・H.264・VP9・AV1・リアルタイムエンコード
  public async exportVideo(format: VideoFormat): Promise<Blob>
  
  // オニオンスキン・WebGPU blend・前後フレーム表示
  public configureOnionSkin(settings: OnionSkinSettings): void
}
```

## 🚀 WebGPU統合・高性能化・v4.1完全対応

### WebGPU検出・初期化・Compute Shader管理
```typescript
// v4.1: WebGPU完全対応・Compute Shader・GPU並列処理
export class WebGPUManager {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  private renderPipelines: Map<string, GPURenderPipeline> = new Map();
  
  public static async detectAndInitialize(): Promise<WebGPUCapabilities> {
    // WebGPU対応検出・アダプター要求・デバイス初期化
    if (!navigator.gpu) {
      return { supported: false, reason: 'WebGPU not available' };
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
        forceFallbackAdapter: false
      });
      
      if (!adapter) {
        return { supported: false, reason: 'No suitable adapter' };
      }
      
      const device = await adapter.requestDevice({
        requiredFeatures: [
          'timestamp-query',
          'pipeline-statistics-query'
        ] as GPUFeatureName[],
        requiredLimits: {
          maxComputeWorkgroupStorageSize: 32768,
          maxComputeInvocationsPerWorkgroup: 1024
        }
      });
      
      return {
        supported: true,
        device,
        adapter,
        capabilities: {
          maxTextureSize: adapter.limits.maxTextureDimension2D,
          maxComputeWorkgroups: adapter.limits.maxComputeWorkgroupsPerDimension,
          maxStorageBufferSize: adapter.limits.maxStorageBufferBindingSize
        }
      };
      
    } catch (error) {
      return { 
        supported: false, 
        reason: `WebGPU initialization failed: ${error}` 
      };
    }
  }
  
  // Compute Shader管理・登録・実行・最適化
  public async registerComputeShader(
    name: string,
    shaderCode: string,
    workgroupSize: number = 64
  ): Promise<void> {
    const shaderModule = this.device!.createShaderModule({
      code: shaderCode
    });
    
    const pipeline = this.device!.createComputePipeline({
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      }
    });
    
    this.computePipelines.set(name, pipeline);
  }
  
  // GPU並列実行・大量データ処理・エアスプレー・ブラー
  public async executeComputeShader(
    name: string,
    inputData: Float32Array,
    outputSize: number
  ): Promise<Float32Array> {
    const pipeline = this.computePipelines.get(name);
    if (!pipeline) throw new Error(`Compute shader ${name} not found`);
    
    // GPU バッファ作成・データ転送・実行・結果取得
    const inputBuffer = this.device!.createBuffer({
      size: inputData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    
    const outputBuffer = this.device!.createBuffer({
      size: outputSize * 4, // Float32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    
    this.device!.queue.writeBuffer(inputBuffer, 0, inputData);
    
    const bindGroup = this.device!.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } }
      ]
    });
    
    const commandEncoder = this.device!.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(outputSize / 64));
    computePass.end();
    
    // 結果読み取り・非同期・効率的
    const readBuffer = this.device!.createBuffer({
      size: outputSize * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputSize * 4);
    this.device!.queue.submit([commandEncoder.finish()]);
    
    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange());
    const output = new Float32Array(result);
    
    readBuffer.unmap();
    inputBuffer.destroy();
    outputBuffer.destroy();
    readBuffer.destroy();
    
    return output;
  }
}
```

### Shader実装・エアスプレー・ブラー・色選択
```typescript
// v4.1: 専用Shader実装・GPU最適化・高品質
export const WEBGPU_SHADERS = {
  // エアスプレー・パーティクル生成・2048粒子並列
  AIRSPRAY_PARTICLES: `
    struct Particle {
      position: vec2<f32>,
      velocity: vec2<f32>,
      color: vec4<f32>,
      life: f32,
      size: f32
    }
    
    @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
    @group(0) @binding(1) var<uniform> sprayParams: SprayParams;
    
    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let index = global_id.x;
      if (index >= arrayLength(&particles)) { return; }
      
      let angle = random(index) * 2.0 * 3.14159;
      let distance = random(index + 1000u) * sprayParams.radius;
      let speed = random(index + 2000u) * sprayParams.intensity;
      
      particles[index].position = sprayParams.center + vec2<f32>(
        cos(angle) * distance,
        sin(angle) * distance
      );
      
      particles[index].velocity = vec2<f32>(
        cos(angle) * speed,
        sin(angle) * speed
      );
      
      particles[index].color = sprayParams.color;
      particles[index].life = 1.0;
      particles[index].size = random(index + 3000u) * sprayParams.maxSize;
    }
  `,
  
  // ガウシアンブラー・高品質・リアルタイム
  GAUSSIAN_BLUR: `
    @group(0) @binding(0) var inputTexture: texture_2d<f32>;
    @group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;
    @group(0) @binding(2) var<uniform> blurParams: BlurParams;
    
    @compute @workgroup_size(8, 8)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let coords = vec2<i32>(global_id.xy);
      let texSize = textureDimensions(inputTexture);
      
      if (coords.x >= texSize.x || coords.y >= texSize.y) { return; }
      
      var color = vec4<f32>(0.0);
      var weightSum = 0.0;
      
      // ガウシアンカーネル適用・高品質ブラー
      for (var i = -blurParams.radius; i <= blurParams.radius; i++) {
        for (var j = -blurParams.radius; j <= blurParams.radius; j++) {
          let sampleCoords = coords + vec2<i32>(i, j);
          if (sampleCoords.x >= 0 && sampleCoords.x < texSize.x &&
              sampleCoords.y >= 0 && sampleCoords.y < texSize.y) {
            
            let weight = gaussianWeight(f32(i), f32(j), blurParams.sigma);
            color += textureLoad(inputTexture, sampleCoords, 0) * weight;
            weightSum += weight;
          }
        }
      }
      
      textureStore(outputTexture, coords, color / weightSum);
    }
  `,
  
  // HSV色選択・色相環・高品質
  HSV_COLOR_WHEEL: `
    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
      let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
      );
      return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    }
    
    @fragment
    fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
      let center = vec2<f32>(60.0, 60.0); // 120x120pxの中心
      let coord = pos.xy - center;
      let distance = length(coord);
      
      if (distance > 60.0) { discard; }
      
      let angle = atan2(coord.y, coord.x);
      let hue = (angle + 3.14159) / (2.0 * 3.14159);
      let saturation = distance / 60.0;
      let value = 1.0;
      
      return vec4<f32>(hsvToRgb(vec3<f32>(hue, saturation, value)), 1.0);
    }
  `
};
```

## 💾 パフォーマンス・メモリ管理・v4.1完全監視

### 包括的性能監視・GPU・メモリ・遅延
```typescript
// v4.1: 包括的性能監視・すべてのメトリクス統合
export interface PerformanceMetrics {
  fps: {
    current: number;
    average: number;
    target: number;
    history: number[];
    stability: number; // FPS安定性指標
  };
  
  gpu: {
    usage: number;           // GPU使用率 0-100%
    memory: number;          // GPU メモリ使用量 MB
    temperature: number;     // GPU温度 °C
    webgpuActive: boolean;   // WebGPU動作状況
    computeActive: boolean;  // Compute Shader動作
    throttled: boolean;      // スロットリング状態
  };
  
  memory: {
    used: number;            // 使用メモリ MB
    available: number;       // 利用可能メモリ MB
    limit: number;           // 制限値 1024MB
    leakDetected: boolean;   // メモリリーク検出
    gcTriggered: boolean;    // GC実行状況
  };
  
  latency: {
    input: number;           // 入力遅延 ms
    render: number;          // 描画遅延 ms
    total: number;           // 総遅延 ms
    target: number;          // 目標遅延 16ms (60FPS)
    jitter: number;          // 遅延ジッター ms
  };
  
  tier: {
    current: 'webgpu' | 'webgl2' | 'webgl';
    capabilities: GPUCapabilities | null;
    autoAdjust: boolean;     // 自動品質調整
    degradationCount: number; // 品質劣化回数
  };
  
  canvas: {
    size: { width: number; height: number };
    resolution: number;      // デバイスピクセル比
    layerCount: number;      // レイヤー数
    strokeCount: number;     // ストローク数
    complexity: number;      // 描画複雑度 0-1
  };
}

export class PerformanceManager {
  private metrics: PerformanceMetrics;
  private monitoring = false;
  private updateInterval: number = 100; // 10fps更新
  private eventBus: EventBus;
  
  // 包括的監視開始・全メトリクス・リアルタイム
  public startMonitoring(): void {
    this.monitoring = true;
    
    // FPS監視・requestAnimationFrame
    this.monitorFrameRate();
    
    // メモリ監視・100ms間隔
    setInterval(() => this.checkMemoryUsage(), this.updateInterval);
    
    // GPU監視・WebGPU対応
    if (this.metrics.gpu.webgpuActive) {
      setInterval(() => this.monitorGPUUsage(), this.updateInterval);
    }
    
    // 遅延監視・入力イベント連動
    this.setupLatencyMonitoring();
    
    // 自動品質調整・性能低下検出
    this.setupAutoQualityAdjustment();
  }
  
  // FPS監視・安定性計算・動的調整
  private monitorFrameRate(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const measureFrame = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      const currentFPS = 1000 / deltaTime;
      
      // FPS履歴更新・移動平均
      this.metrics.fps.history.push(currentFPS);
      if (this.metrics.fps.history.length > 60) {
        this.metrics.fps.history.shift();
      }
      
      this.metrics.fps.current = currentFPS;
      this.metrics.fps.average = this.metrics.fps.history.reduce((a, b) => a + b, 0) / this.metrics.fps.history.length;
      
      // FPS安定性計算・標準偏差
      const variance = this.metrics.fps.history.reduce((sum, fps) => sum + Math.pow(fps - this.metrics.fps.average, 2), 0) / this.metrics.fps.history.length;
      this.metrics.fps.stability = 1 / (1 + Math.sqrt(variance));
      
      // 性能イベント発火
      this.eventBus.emit('performance:fps-update', {
        fps: currentFPS,
        target: this.metrics.fps.target,
        timestamp: currentTime
      });
      
      // 低FPS警告
      if (currentFPS < this.metrics.fps.target * 0.8) {
        this.eventBus.emit('performance:fps-low', {
          currentFPS,
          targetFPS: this.metrics.fps.target
        });
      }
      
      lastTime = currentTime;
      if (this.monitoring) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    requestAnimationFrame(measureFrame);
  }
  
  // GPU使用率監視・WebGPU・温度・メモリ
  private async monitorGPUUsage(): Promise<void> {
    try {
      // WebGPU デバイス情報取得
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return;
      
      // GPU メモリ使用量推定・テクスチャ・バッファ
      const estimatedMemory = this.estimateGPUMemoryUsage();
      this.metrics.gpu.memory = estimatedMemory;
      
      // GPU使用率推定・描画負荷・Compute Shader
      const usage = this.estimateGPUUsage();
      this.metrics.gpu.usage = usage;
      
      // スロットリング検出・性能低下・温度推定
      this.metrics.gpu.throttled = this.detectGPUThrottling();
      
      // GPU情報イベント発火
      this.eventBus.emit('performance:gpu-usage', {
        usage: this.metrics.gpu.usage,
        memory: this.metrics.gpu.memory,
        temperature: this.metrics.gpu.temperature
      });
      
    } catch (error) {
      console.warn('GPU monitoring failed:', error);
    }
  }
  
  // メモリ使用量監視・1GB制限・リーク検出
  private checkMemoryUsage(): void {
    const memory = (performance as any).memory;
    if (!memory) return;
    
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const totalMB = memory.totalJSHeapSize / (1024 * 1024);
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
    
    this.metrics.memory.used = usedMB;
    this.metrics.memory.available = limitMB - usedMB;
    this.metrics.memory.limit = Math.min(limitMB, 1024); // 1GB制限
    
    // メモリリーク検出・継続的増加
    this.detectMemoryLeak(usedMB);
    
    // 警告・強制GC判定
    if (usedMB > this.metrics.memory.limit * 0.8) {
      this.eventBus.emit('performance:memory-warning', {
        used: usedMB,
        limit: this.metrics.memory.limit,
        percentage: (usedMB / this.metrics.memory.limit) * 100
      });
      
      if (usedMB > this.metrics.memory.limit * 0.9) {
        this.forceGarbageCollection();
      }
    }
  }
  
  // 入力遅延監視・E2E・1ms精度
  private setupLatencyMonitoring(): void {
    let inputStartTime = 0;
    
    // 入力開始タイムスタンプ記録
    this.eventBus.on('drawing:start', () => {
      inputStartTime = performance.now();
    });
    
    // 描画完了・遅延計算
    this.eventBus.on('drawing:rendered', () => {
      const totalLatency = performance.now() - inputStartTime;
      
      this.metrics.latency.total = totalLatency;
      this.metrics.latency.input = totalLatency * 0.3; // 推定
      this.metrics.latency.render = totalLatency * 0.7; // 推定
      
      // 遅延ジッター計算
      const previousLatency = this.metrics.latency.total;
      this.metrics.latency.jitter = Math.abs(totalLatency - previousLatency);
      
      // 遅延イベント発火
      this.eventBus.emit('performance:latency-measured', {
        input: this.metrics.latency.input,
        render: this.metrics.latency.render,
        total: totalLatency
      });
    });
  }
  
  // 自動品質調整・Tier切り替え・機能制限
  private setupAutoQualityAdjustment(): void {
    let adjustmentCooldown = 0;
    
    setInterval(() => {
      if (adjustmentCooldown > 0) {
        adjustmentCooldown--;
        return;
      }
      
      const shouldDegrade = 
        this.metrics.fps.current < this.metrics.fps.target * 0.7 ||
        this.metrics.gpu.usage > 90 ||
        this.metrics.memory.used > this.metrics.memory.limit * 0.9 ||
        this.metrics.latency.total > this.metrics.latency.target * 2;
      
      const shouldUpgrade = 
        this.metrics.fps.current > this.metrics.fps.target * 1.2 &&
        this.metrics.gpu.usage < 60 &&
        this.metrics.memory.used < this.metrics.memory.limit * 0.6 &&
        this.metrics.latency.total < this.metrics.latency.target * 0.5;
      
      if (shouldDegrade && this.metrics.tier.autoAdjust) {
        this.degradeQuality();
        adjustmentCooldown = 50; // 5秒クールダウン
      } else if (shouldUpgrade && this.metrics.tier.degradationCount > 0) {
        this.upgradeQuality();
        adjustmentCooldown = 100; // 10秒クールダウン
      }
      
    }, this.updateInterval);
  }
  
  // 品質劣化・Tier降格・機能制限
  private degradeQuality(): void {
    const currentTier = this.metrics.tier.current;
    let newTier = currentTier;
    
    switch (currentTier) {
      case 'webgpu':
        newTier = 'webgl2';
        this.disableComputeShaders();
        break;
      case 'webgl2':
        newTier = 'webgl';
        this.disableAdvancedFeatures();
        break;
      case 'webgl':
        this.reduceCanvasResolution();
        this.limitLayerCount();
        break;
    }
    
    if (newTier !== currentTier) {
      this.metrics.tier.current = newTier;
      this.metrics.tier.degradationCount++;
      
      this.eventBus.emit('performance:tier-changed', {
        from: currentTier,
        to: newTier,
        reason: 'performance degradation'
      });
    }
  }
  
  // 品質向上・Tier昇格・機能復帰
  private upgradeQuality(): void {
    const currentTier = this.metrics.tier.current;
    let newTier = currentTier;
    
    switch (currentTier) {
      case 'webgl':
        newTier = 'webgl2';
        this.enableAdvancedFeatures();
        break;
      case 'webgl2':
        if (this.metrics.gpu.webgpuActive) {
          newTier = 'webgpu';
          this.enableComputeShaders();
        }
        break;
    }
    
    if (newTier !== currentTier) {
      this.metrics.tier.current = newTier;
      this.metrics.tier.degradationCount = Math.max(0, this.metrics.tier.degradationCount - 1);
      
      this.eventBus.emit('performance:tier-changed', {
        from: currentTier,
        to: newTier,
        reason: 'performance improvement'
      });
    }
  }
  
  // 強制ガベージコレクション・メモリ解放
  private forceGarbageCollection(): void {
    // PixiJS テクスチャキャッシュクリア
    PIXI.Texture.removeFromCache();
    
    // 未使用Container破棄
    this.cleanupUnusedContainers();
    
    // 手動GC（開発環境）
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
    
    this.metrics.memory.gcTriggered = true;
    
    setTimeout(() => {
      this.metrics.memory.gcTriggered = false;
    }, 1000);
  }
  
  // GPU メモリ使用量推定
  private estimateGPUMemoryUsage(): number {
    let totalMemory = 0;
    
    // テクスチャメモリ推定
    const textures = PIXI.Texture.getAllTextures();
    textures.forEach(texture => {
      if (texture.source && texture.source.resource) {
        const width = texture.source.pixelWidth || 0;
        const height = texture.source.pixelHeight || 0;
        totalMemory += width * height * 4; // RGBA
      }
    });
    
    return totalMemory / (1024 * 1024); // MB変換
  }
  
  // GPU使用率推定・描画負荷
  private estimateGPUUsage(): number {
    const baseUsage = this.metrics.fps.target / Math.max(this.metrics.fps.current, 1) * 50;
    const layerUsage = this.metrics.canvas.layerCount * 5;
    const complexityUsage = this.metrics.canvas.complexity * 30;
    
    return Math.min(100, baseUsage + layerUsage + complexityUsage);
  }
  
  // GPUスロットリング検出・温度・性能低下
  private detectGPUThrottling(): boolean {
    // FPS急激低下・GPU使用率高・継続的性能劣化
    return this.metrics.fps.stability < 0.7 && 
           this.metrics.gpu.usage > 85 &&
           this.metrics.fps.current < this.metrics.fps.target * 0.6;
  }
  
  // メモリリーク検出・継続的増加
  private detectMemoryLeak(currentUsage: number): void {
    // 実装簡略化・継続的増加検出
    const threshold = this.metrics.memory.limit * 0.1; // 10%増加
    static let previousUsage = currentUsage;
    
    if (currentUsage > previousUsage + threshold) {
      this.metrics.memory.leakDetected = true;
    } else {
      this.metrics.memory.leakDetected = false;
    }
    
    previousUsage = currentUsage;
  }
  
  // 公開API・メトリクス取得
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  public getCurrentFPS(): number {
    return this.metrics.fps.current;
  }
  
  public getGPUUsage(): number {
    return this.metrics.gpu.usage;
  }
  
  public getMemoryUsage(): { used: number; limit: number; percentage: number } {
    return {
      used: this.metrics.memory.used,
      limit: this.metrics.memory.limit,
      percentage: (this.metrics.memory.used / this.metrics.memory.limit) * 100
    };
  }
  
  public getTotalLatency(): number {
    return this.metrics.latency.total;
  }
}
```

## 🔧 開発環境・ビルド設定・v4.1最適化

### Vite設定・2.5K最適化・WebGPU対応
```typescript
// vite.config.ts - 開発環境・最適化・v4.1拡張
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true, // ネットワークアクセス
    https: false, // WebGPU開発時はHTTPS推奨
    headers: {
      // WebGPU CORS対応
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          ui: ['./src/ui/UIManager.ts', './src/ui/Toolbar.ts'],
          tools: ['./src/tools/ToolManager.ts'],
          webgpu: ['./src/rendering/WebGPURenderer.ts'], // v4.1
          performance: ['./src/core/PerformanceManager.ts'] // v4.1
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pixi.js', '@tabler/icons'], // v4.1: Tabler Icons
    exclude: []
  },
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __WEBGPU_ENABLED__: true, // v4.1: WebGPU機能フラグ
    __PERFORMANCE_MONITORING__: true // v4.1: 性能監視フラグ
  },
  // v4.1: WebGPU Shader読み込み対応
  assetsInclude: ['**/*.wgsl', '**/*.glsl']
});
```

### TypeScript厳格設定・v4.1型定義
```json
// tsconfig.json - 型安全・厳格モード・v4.1拡張
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker", "WebGPU"], // v4.1: WebGPU追加
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    // v4.1: パス解決・絶対パス
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/core/*": ["core/*"],
      "@/ui/*": ["ui/*"],
      "@/tools/*": ["tools/*"],
      "@/types/*": ["types/*"]
    }
  },
  "include": [
    "src/**/*",
    "src/**/*.wgsl", // v4.1: WebGPU Shader
    "types/**/*"     // v4.1: 型定義ディレクトリ
  ],
  "exclude": ["node_modules", "dist"]
}
```

### ESLint設定・コード品質・v4.1ルール
```json
// .eslintrc.json - コード品質・v4.1拡張
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "rules": {
    // v4.1: 性能・品質ルール
    "max-lines-per-function": ["error", 30],
    "max-params": ["error", 4],
    "complexity": ["error", 10],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/no-unused-vars": "error",
    
    // v4.1: WebGPU・GPU最適化ルール
    "no-sync": "warn", // 非同期処理推奨
    "prefer-const": "error",
    "no-var": "error"
  },
  "globals": {
    "__DEV__": "readonly",
    "__WEBGPU_ENABLED__": "readonly",
    "__PERFORMANCE_MONITORING__": "readonly"
  }
}
```

---

**この技術設計v4.1版により、参考資料「UI・UX設計仕様詳細抜粋.md」の全技術要素が完全統合され、実装可能な詳細設計が確立されました。WebGPU Compute Shader、リアルタイム性能監視、GPU最適化UI、Tabler Icons統合の具体的実装設計が明確化され、理想的な高性能描画ツールの技術基盤が完成しています。** class PixiApplication {
  // WebGPU検出・初期化・フォールバック処理・性能測定
  public async initialize(container: HTMLElement): Promise<boolean>
  
  // 2560×1440対応・デバイスピクセル比・高解像度・GPU最適化
  private getOptimalCanvasSize(): { width: number; height: number }
  
  // レンダラー種別取得・性能調整・Tier判定・GPU能力評価
  public getRendererType(): 'webgpu' | 'webgl2' | 'webgl'
  
  // v4.1: GPU情報取得・メモリ・性能・制限値
  public getGPUCapabilities(): GPUCapabilities
}

// EventBus.ts - 型安全イベント通信・疎結合・v4.1性能イベント
interface IEventData {
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  'tool:change': { toolName: string; settings: any };
  
  // v4.1: 性能監視イベント・リアルタイム
  'performance:fps-update': { fps: number; target: number; timestamp: number };
  'performance:gpu-usage': { usage: number; memory: number; temperature?: number };
  'performance:latency-measured': { input: number; render: number; total: number };
  'performance:warning': { type: 'memory' | 'fps' | 'gpu'; value: number; limit: number };
  'performance:tier-changed': { from: string; to: string; reason: string };
  
  // v4.1: UI・ポップアップイベント
  'ui:popup-show': { type: string; position: { x: number; y: number } };
  'ui:popup-move': { id: string; position: { x: number; y: number } };
  'ui:popup-hide': { id: string };
}

export