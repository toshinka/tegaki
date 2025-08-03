# 技術設計 v4.0

**ドキュメント**: アーキテクチャ・技術実装詳細  
**対象読者**: 開発者・Claude・技術レビュアー  
**最終更新**: 2025年8月4日

## 🏗️ アーキテクチャ概要

### 基盤技術スタック
```
✅ Core Technology:
├─ PixiJS v8.11.0 - WebGPU統一基盤・GPU描画・Container階層
├─ TypeScript 5.0+ - 厳格型チェック・開発効率・エラー防止
├─ Vite - ESM・Tree Shaking・Hot Reload・最適化
└─ ESM Modules - モダンJS・依存関係最適化

✅ 設計思想:
├─ EventBus中心疎結合 - 型安全通信・デバッグ支援
├─ 単一責任原則 - 1クラス1機能・Claude理解容易
├─ インターフェース先行 - 契約明確・実装分離
└─ 段階的縮退戦略 - WebGPU→WebGL2→WebGL自動切り替え
```

### WebGPU対応戦略
```
🎯 段階的縮退戦略:
Tier 1: WebGPU + OffscreenCanvas
 ├─ 目標: 60FPS安定、2048x2048キャンバス
 ├─ 対象: Chrome/Edge最新、高性能GPU、8GB+メモリ
 └─ 機能: 高度ブラシ・リアルタイム変形・GPU並列処理

Tier 2: WebGL2 + 最適化描画
 ├─ 目標: 30FPS安定、1024x1024キャンバス
 ├─ 対象: Firefox/Safari最新、中性能GPU、4GB+メモリ
 └─ 機能: 標準ブラシ・基本エフェクト・レイヤー合成

Tier 3: WebGL + 基本機能
 ├─ 目標: 20FPS、512x512キャンバス
 ├─ 対象: 旧ブラウザ、低性能GPU、2GB+メモリ
 └─ 機能: 基本描画・最小限レイヤー・軽量化
```

## 📁 ディレクトリ構成（確定版・変更不可）

```
src/
├── main.ts                         # エントリーポイント・アプリ起動
├── style.css                       # 基本CSS・ふたば色定義
├── core/                           # 基盤システム
│   ├── PixiApplication.ts            # PixiJS初期化・WebGPU制御・2.5K対応
│   ├── EventBus.ts                  # 型安全イベント通信・履歴・デバッグ
│   ├── DrawingEngine.ts             # 描画統合・ツール制御・Graphics管理
│   └── PerformanceManager.ts        # 性能監視・メモリ管理・1GB制限
├── rendering/                      # レンダリング層・GPU最適化
│   ├── LayerManager.ts              # 20レイヤー管理・Container階層
│   ├── WebGPURenderer.ts            # WebGPU専用処理・Compute Shader
│   ├── CanvasManager.ts             # 4K対応・座標変換・Viewport
│   └── TextureManager.ts            # GPU メモリ・Atlas・圧縮
├── input/                          # 入力処理・マウス+ペン特化
│   ├── InputManager.ts              # 統合入力・Pointer Events・筆圧対応
│   ├── PointerProcessor.ts          # 筆圧・傾き・座標変換・2.5K精度
│   └── ShortcutManager.ts           # キーボード・ペンサイドボタン
├── tools/                          # ツールシステム・段階実装
│   ├── ToolManager.ts               # ツール統合・状態管理・設定永続化
│   ├── PenTool.ts                  # ペン・基本線描画・Phase1
│   ├── BrushTool.ts                # 筆・テクスチャ・Phase2
│   ├── EraserTool.ts               # 消しゴム・削除・Phase1
│   ├── FillTool.ts                 # 塗りつぶし・フラッドフィル・Phase2
│   └── ShapeTool.ts                # 図形・直線・矩形・円・Phase2
├── ui/                             # UI制御・2.5K最適化
│   ├── UIManager.ts                 # UI統合・ふたば色・レスポンシブ
│   ├── Toolbar.ts                  # ツールバー・80px幅・56pxアイコン
│   ├── ColorPalette.ts             # HSV円形・200px・ふたば色プリセット
│   └── LayerPanel.ts               # レイヤー・400px幅・64px項目
├── constants/                      # 定数・設定・2.5K環境
│   ├── ui-constants.ts             # UI定数・サイズ・色・レイアウト
│   ├── drawing-constants.ts        # 描画定数・性能・ブラシサイズ
│   └── performance-constants.ts    # 性能定数・制限値・警告閾値
└── types/                          # 型定義・TypeScript
    ├── drawing.types.ts            # 描画関連・ツール・レイヤー型
    ├── ui.types.ts                # UI関連・イベント・状態型
    └── performance.types.ts        # 性能関連・監視・メトリクス型
```

## 🎨 モジュール設計・責任分界

### Core Layer（基盤システム）
```typescript
// PixiApplication.ts - WebGPU初期化・レンダラー制御
export class PixiApplication {
  // WebGPU検出・初期化・フォールバック処理
  public async initialize(container: HTMLElement): Promise<boolean>
  
  // 2560×1440対応・デバイスピクセル比・高解像度
  private getOptimalCanvasSize(): { width: number; height: number }
  
  // レンダラー種別取得・性能調整・Tier判定
  public getRendererType(): 'webgpu' | 'webgl2' | 'webgl'
}

// EventBus.ts - 型安全イベント通信・疎結合
interface IEventData {
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  'tool:change': { toolName: string; settings: any };
  'performance:warning': { used: number; limit: number; type: string };
}

export class EventBus {
  // 型安全リスナー登録・自動解除機能
  public on<K extends keyof IEventData>(event: K, callback: Function): () => void
  
  // 型安全イベント発火・データ検証
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void
}

// DrawingEngine.ts - 描画統合・ツール制御
export class DrawingEngine {
  // ツール統合・描画ロジック・Graphics最適化
  public startDrawing(data: IEventData['drawing:start']): void
  public continueDrawing(data: IEventData['drawing:move']): void
  public endDrawing(data: IEventData['drawing:end']): void
  
  // スムージング・ベジエ曲線・手ブレ軽減
  private applySmoothingToStroke(points: PIXI.Point[]): PIXI.Point[]
}

// PerformanceManager.ts - 性能監視・メモリ管理
export class PerformanceManager {
  // 1GB制限・警告800MB・強制GC
  private checkMemoryUsage(): void
  
  // 60FPS監視・動的品質調整
  private monitorFrameRate(): void
}
```

### Rendering Layer（GPU最適化）
```typescript
// LayerManager.ts - Container階層・20レイヤー管理
export class LayerManager {
  // PixiJS Container階層・Z-index動的制御
  public createLayer(name: string): string
  public deleteLayer(layerId: string): void
  public reorderLayers(): void
  
  // ブレンドモード・透明度・表示制御
  public setLayerBlendMode(layerId: string, mode: PIXI.BlendModes): void
}

// WebGPURenderer.ts - WebGPU専用・Compute Shader
export class WebGPURenderer {
  // GPU並列処理・Compute Shader・フィルター効果
  public applyComputeShader(shader: string, data: Float32Array): void
  
  // GPU メモリプール・効率管理
  private manageGPUMemory(): void
}

// TextureManager.ts - テクスチャ最適化・Atlas統合
export class TextureManager {
  // テクスチャAtlas・メモリ効率・圧縮
  public createTextureAtlas(textures: PIXI.Texture[]): PIXI.Texture
  
  // ガベージコレクション・メモリリーク防止
  public cleanupUnusedTextures(): void
}
```

### Input Layer（デバイス対応）
```typescript
// InputManager.ts - Pointer Events統合
export class InputManager {
  // マウス・ペンタブレット・デバイス抽象化
  private setupPointerEvents(): void
  
  // 座標変換・2560×1440対応・サブピクセル精度
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point
  
  // 筆圧処理・4096レベル・自然な変化
  private processPressure(rawPressure: number): number
}

// PointerProcessor.ts - 高精度処理・筆圧最適化
export class PointerProcessor {
  // 筆圧曲線補正・デバイス差異・調整
  public calibratePressureCurve(deviceType: string): void
  
  // 傾き検出・ペン表現・自然な描画
  public processTiltData(tiltX: number, tiltY: number): { angle: number; intensity: number }
}
```

### Tool Layer（ツールシステム）
```typescript
// ツール共通インターフェース・Claude理解容易
interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
}

// PenTool.ts - 基本線描画・Phase1実装
export class PenTool implements IDrawingTool {
  // PixiJS Graphics・基本描画・スムージング
  public onPointerMove(event: IEventData['drawing:move']): void
  
  // 筆圧対応サイズ・自然な太さ変化
  private calculateBrushSize(pressure: number): number
}
```

## 🚀 WebGPU統合・高性能化

### WebGPU検出・初期化
```typescript
// WebGPU対応検出・段階的フォールバック
export class WebGPUDetector {
  public static async detectSupport(): Promise<'webgpu' | 'webgl2' | 'webgl'> {
    // WebGPU対応チェック・GPU性能評価
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
    
    // WebGL2フォールバック
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) return 'webgl2';
    
    // WebGL基本対応
    const gl = canvas.getContext('webgl');
    return gl ? 'webgl' : 'webgl';
  }
}

// PixiJS WebGPU設定・最適化
const pixiConfig = {
  preference: 'webgpu',
  fallback: ['webgl2', 'webgl'],
  powerPreference: 'high-performance',
  antialias: true, // Tier1のみ
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  backgroundColor: 0xffffee, // ふたば背景色
  width: 2560,  // 2.5K対応
  height: 1440
};
```

### GPU並列処理・Compute Shader
```typescript
// Phase3実装予定・GPU並列描画
export class ComputeShaderManager {
  // 並列描画処理・大量ストローク対応
  public async processStrokes(strokes: StrokeData[]): Promise<void> {
    const computeShader = `
      @group(0) @binding(0) var<storage, read_write> strokes: array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        // GPU並列処理・ストローク最適化
      }
    `;
    
    // WebGPU Compute Pipeline実行
    await this.executeComputePipeline(computeShader, strokes);
  }
}
```

## 💾 パフォーマンス・メモリ管理

### メモリ監視・1GB制限
```typescript
// メモリ使用量監視・警告・強制GC
export class MemoryManager {
  private readonly MAX_MEMORY_MB = 1024;  // 1GB制限
  private readonly WARNING_MEMORY_MB = 800; // 警告800MB
  
  public checkMemoryUsage(): MemoryStatus {
    // Chrome専用・performance.memory利用
    const memory = (performance as any).memory;
    if (!memory) return { status: 'unknown' };
    
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    
    if (usedMB > this.MAX_MEMORY_MB) {
      this.forceGarbageCollection();
      return { status: 'critical', used: usedMB };
    }
    
    if (usedMB > this.WARNING_MEMORY_MB) {
      return { status: 'warning', used: usedMB };
    }
    
    return { status: 'normal', used: usedMB };
  }
  
  private forceGarbageCollection(): void {
    // テクスチャキャッシュクリア
    PIXI.Texture.removeFromCache();
    
    // 未使用Container破棄
    this.cleanupUnusedContainers();
    
    // 手動GC（開発環境）
    if (window.gc) window.gc();
  }
}
```

### フレームレート監視・動的調整
```typescript
// 60FPS監視・品質自動調整
export class FrameRateManager {
  private targetFPS = 60;
  private currentFPS = 0;
  private frameHistory: number[] = [];
  
  public monitorFrameRate(): void {
    const monitor = (timestamp: number) => {
      // FPS計算・移動平均
      this.calculateFPS(timestamp);
      
      // 性能不足検出・品質調整
      if (this.currentFPS < 30) {
        this.adjustQuality('lower');
      } else if (this.currentFPS > 55) {
        this.adjustQuality('higher');
      }
      
      requestAnimationFrame(monitor);
    };
    
    requestAnimationFrame(monitor);
  }
  
  private adjustQuality(direction: 'higher' | 'lower'): void {
    // 動的品質調整・アンチエイリアス・解像度
    const renderer = this.pixiApp.renderer;
    
    if (direction === 'lower') {
      // 品質下げる・性能優先
      renderer.antialias = false;
      this.reduceCanvasResolution();
    } else {
      // 品質上げる・視覚優先
      renderer.antialias = true;
      this.increaseCanvasResolution();
    }
  }
}
```

## 🔧 開発環境・ビルド設定

### Vite設定・2.5K最適化
```typescript
// vite.config.ts - 開発環境・最適化
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true, // ネットワークアクセス
    https: false // 必要に応じてHTTPS
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
          tools: ['./src/tools/ToolManager.ts']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pixi.js'],
    exclude: []
  },
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  }
});
```

### TypeScript厳格設定
```json
// tsconfig.json - 型安全・厳格モード
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
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
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

**この技術設計書は、実装の技術的基盤となる重要ドキュメントです。アーキテクチャ変更時は必ずこのファイルを更新し、全体整合性を維持します。**