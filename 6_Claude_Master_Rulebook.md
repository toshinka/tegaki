# Claude統合開発規約書 v4.1

**ドキュメント**: 別チャットClaude向け・統合実装規約  
**対象読者**: Claude（他チャット）・実装継続・修正追加  
**最終更新**: 2025年8月6日

## 🎯 プロジェクト概要・即座理解

### プロジェクト本質
**「Procreateクラスの高品質お絵かきツールをWebブラウザで実現」**

- **目標**: 2.5K液タブレット環境でProcreate並みの描画体験
- **戦略**: 戦略B+理想要素（確実基盤→段階的高性能化）
- **技術**: PixiJS v8.11.0統一・WebGPU対応・TypeScript厳格
- **UI**: ふたば色システム・親しみやすさ・アクセシビリティ完全対応

### 現在状況・2025年8月6日
```
📊 開発状況:
Phase1: 基盤構築（実装中・WebGL2・60FPS・基本描画）
Phase2: 機能拡充（準備中・レイヤー・高度ツール・エクスポート）  
Phase3: 高性能化（設計中・WebGPU・GPU並列・4K対応）
Phase4: 完成度（構想中・UX・アニメーション・プラグイン）

🎯 次回実装:
1. PixiApplication.ts - WebGL2初期化・2560×1440対応
2. EventBus.ts - 型安全イベント通信・疎結合
3. InputManager.ts - マウス・ペンタブレット・筆圧対応
4. DrawingEngine.ts - 基本描画・スムージング・GPU最適化
5. 基本UI - ツールバー・色選択・2.5Kレイアウト
```

## 🚫 絶対遵守・変更禁止ルール

### 対象環境制約（厳守・例外なし）
```
✅ 対応必須:
├─ 2560×1440液タブレット環境（2.5K特化）
├─ マウス・ペンタブレット（筆圧・傾き・サイドボタン）
├─ Chrome/Edge WebGPU優先・Firefox/Safari WebGL2対応
└─ 高性能デスクトップ・16GB+メモリ・専用GPU

❌ 対応禁止（開発効率・品質集中）:
├─ タッチ・ジェスチャー操作（Y軸問題・デバッグ困難）
├─ モバイル・スマートフォン（画面・性能制約）
├─ 1920×1080以下UI（2.5K最適化必須）
├─ Canvas2D・WebGL v1（品質・性能不足）
└─ 古いブラウザ対応（IE・古いSafari等）
```

### 技術スタック制約（変更禁止）
```
✅ 必須技術・バージョン固定:
├─ PixiJS v8.11.0統一基盤（WebGPU対応・Container階層）
├─ TypeScript 5.0+厳格モード（型安全・開発効率）
├─ Vite最新版（ESM・Tree Shaking・Hot Reload）
├─ ESMモジュール（モダンJS・依存関係最適化）
└─ 段階的縮退戦略（WebGPU→WebGL2→WebGL自動切替）

❌ 禁止技術・ライブラリ:
├─ React・Vue・Angular等（軽量・直接DOM制御優先）
├─ jQuery・lodash等（ESM・Tree Shaking最適化）
├─ Canvas2D直接操作（PixiJS統一・GPU活用）
├─ WebGL v1（WebGL2最低基準・性能確保）
└─ 非ESMライブラリ（モダン開発環境統一）
```

### デザインシステム制約（厳守）
```
✅ ふたば色システム（変更禁止）:
├─ --futaba-maroon: #800000（メイン色・重要操作）
├─ --futaba-background: #ffffee（背景色・作業領域）
├─ --futaba-cream: #f0e0d6（パネル背景・UI基調）
├─ --futaba-light: #e9c2ba（境界・枠線・非アクティブ）
└─ WCAG 2.1 AAA準拠・コントラスト比4.5:1以上

✅ レイアウト制約:
├─ Grid Layout: 80px|1fr|400px（ツールバー・キャンバス・レイヤー）
├─ 56pxアイコン・64px項目高・2.5K最適化
├─ レスポンシブ無効・2.5K環境専用設計
└─ ツールバー80px幅・レイヤーパネル400px幅固定
```

### 性能目標制約（必達基準）
```
✅ Tier1目標（WebGPU・高性能環境）:
├─ フレームレート: 60FPS安定維持（理想120FPS）
├─ 入力遅延: 5ms以下（筆圧感知含む）  
├─ メモリ使用量: 1GB以下（警告800MB）
├─ キャンバスサイズ: 2048x2048px
└─ レイヤー数: 20枚まで

✅ Tier2目標（WebGL2・標準環境）:
├─ フレームレート: 30FPS安定維持
├─ 入力遅延: 16ms以下
├─ メモリ使用量: 512MB以下（警告400MB）
├─ キャンバスサイズ: 1024x1024px  
└─ レイヤー数: 10枚まで
```

## 📁 ディレクトリ構造（確定版・変更不可）

```
src/
├── main.ts                         # エントリーポイント・アプリ起動
├── style.css                       # 基本CSS・ふたば色定義・v4.1拡張
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

### ディレクトリ責任分界
```
📂 core/ - アプリケーション基盤・生命周期管理
├─ PixiJS初期化制御・WebGPU/WebGL2切り替え
├─ 型安全イベント通信・疎結合アーキテクチャ
├─ 描画エンジン統合・ツール制御・Graphics管理
└─ 性能監視・メモリ管理・品質保証

📂 rendering/ - GPU描画・最適化レンダリング
├─ レイヤー階層管理・Container制御・Z-index
├─ WebGPU専用処理・Compute Shader・並列計算
├─ 座標変換・Viewport制御・4K対応
└─ テクスチャメモリ・Atlas統合・圧縮最適化

📂 input/ - デバイス入力・高精度処理
├─ マウス・ペンタブレット統合・Pointer Events
├─ 筆圧・傾き・速度処理・2.5K精度サブピクセル
└─ キーボードショートカット・ペンサイドボタン

📂 tools/ - 描画ツール・段階的実装
├─ ツール状態管理・設定永続化・プロファイル
├─ Phase1: ペン・消しゴム基本ツール
├─ Phase2: 筆・塗りつぶし・図形高度ツール
└─ Phase3: エフェクト・フィルター・GPU加速

📂 ui/ - ユーザーインターフェース・2.5K最適化
├─ レイアウト管理・Grid 80px|1fr|400px
├─ ツールバー・56pxアイコン・視覚フィードバック
├─ 色選択・HSV円形・ふたば色プリセット
└─ レイヤーパネル・400px幅・64px項目・ドラッグ
```

## 🎨 技術実装規約・コーディング標準

### TypeScript厳格設定（必須遵守）
```json
// tsconfig.json - 厳格モード・品質保証
{
  "compilerOptions": {
    "strict": true,                    // 厳格モード必須
    "noImplicitAny": true,             // any型禁止
    "noImplicitReturns": true,         // 戻り値必須
    "noUnusedLocals": true,            // 未使用変数検出
    "noUnusedParameters": true,        // 未使用引数検出
    "exactOptionalPropertyTypes": true, // Optional型厳格
    "noImplicitOverride": true,        // override明示必須
    "target": "ES2022",                // モダンJS活用
    "module": "ESNext",                // ESM必須
    "moduleResolution": "bundler"      // Vite最適化
  }
}
```

### クラス設計原則（単一責任・疎結合）
```typescript
// ✅ 正しいクラス設計例
export class PixiApplication {
  private app: PIXI.Application | null = null;
  private rendererType: 'webgpu' | 'webgl2' | 'webgl' = 'webgl';
  
  // 単一責任: PixiJS初期化のみ
  public async initialize(container: HTMLElement): Promise<boolean> {
    try {
      // WebGPU検出・段階的フォールバック
      this.rendererType = await this.detectBestRenderer();
      
      // PixiJS v8.11.0統一基盤
      this.app = new PIXI.Application();
      await this.app.init({
        preference: this.rendererType,
        width: 2560,  // 2.5K対応
        height: 1440,
        backgroundColor: 0xffffee, // ふたば背景色
        antialias: true,
        autoDensity: true,
        powerPreference: 'high-performance'
      });
      
      container.appendChild(this.app.canvas);
      return true;
      
    } catch (error) {
      console.error('PixiJS initialization failed:', error);
      return false;
    }
  }
  
  private async detectBestRenderer(): Promise<'webgpu' | 'webgl2' | 'webgl'> {
    // WebGPU対応検出
    if (navigator.gpu) { return 'webgpu'; }
    
    // WebGL2フォールバック
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) { return 'webgl2'; }
    
    // WebGL基本対応
    return 'webgl';
  }
  
  // Getter: 外部アクセス制御
  public get application(): PIXI.Application | null {
    return this.app;
  }
  
  public get renderer(): 'webgpu' | 'webgl2' | 'webgl' {
    return this.rendererType;
  }
}

// ❌ 避けるべき設計例（複数責任・密結合）
export class BadApplicationManager {
  // 複数責任: 初期化+描画+UI+イベント処理
  public initializeEverything() {
    this.initPixi();
    this.setupUI();
    this.bindEvents();
    this.startDrawing();
    // 責任混在・保守困難・テスト困難
  }
}
```

### EventBus型安全設計（疎結合必須）
```typescript
// 型安全イベント定義・インターフェース先行
interface IEventData {
  // 描画関連イベント
  'drawing:start': { 
    point: PIXI.Point; 
    pressure: number; 
    pointerType: 'mouse' | 'pen' | 'touch';
    timestamp: number;
  };
  'drawing:move': { 
    point: PIXI.Point; 
    pressure: number; 
    velocity: number;
    timestamp: number;
  };
  'drawing:end': { 
    point: PIXI.Point;
    totalPoints: number;
    duration: number;
  };
  
  // ツール関連イベント
  'tool:change': { 
    previousTool: string; 
    currentTool: string; 
    settings: any;
  };
  'tool:settings': { 
    toolName: string; 
    property: string; 
    value: any;
  };
  
  // 性能関連イベント
  'performance:warning': { 
    type: 'memory' | 'fps' | 'latency';
    current: number; 
    limit: number; 
    severity: 'low' | 'medium' | 'high';
  };
  'performance:critical': { 
    type: 'memory' | 'fps' | 'latency';
    action: 'reduce_quality' | 'force_gc' | 'warn_user';
  };
}

// EventBus実装・メモリリーク防止
export class EventBus {
  private listeners = new Map<keyof IEventData, Set<Function>>();
  private history: Array<{ event: string; data: any; timestamp: number }> = [];
  private maxHistorySize = 100;
  
  // 型安全リスナー登録・自動解除機能
  public on<K extends keyof IEventData>(
    event: K, 
    callback: (data: IEventData[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 自動解除関数返却・メモリリーク防止
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
  
  // 型安全イベント発火・データ検証
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void {
    // イベント履歴記録・デバッグ支援
    this.history.push({
      event: event as string,
      data: structuredClone(data),
      timestamp: performance.now()
    });
    
    // 履歴サイズ制限
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    // リスナー実行・エラーハンドリング
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`EventBus error in ${event} listener:`, error);
        }
      });
    }
  }
  
  // デバッグ支援・開発効率化
  public getEventHistory(eventType?: keyof IEventData): typeof this.history {
    if (eventType) {
      return this.history.filter(entry => entry.event === eventType);
    }
    return [...this.history];
  }
  
  // メモリクリーンアップ
  public cleanup(): void {
    this.listeners.clear();
    this.history.length = 0;
  }
}
```

### 性能監視・メモリ管理（必須実装）
```typescript
// PerformanceManager - 性能監視・自動最適化
export class PerformanceManager {
  private readonly MAX_MEMORY_MB = 1024;  // 1GB制限
  private readonly WARNING_MEMORY_MB = 800; // 警告800MB
  private readonly TARGET_FPS = 60;        // 目標60FPS
  private readonly MIN_FPS = 30;           // 最低30FPS
  
  private currentFPS = 0;
  private frameHistory: number[] = [];
  private lastFrameTime = 0;
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    // FPS監視・動的品質調整
    this.monitorFrameRate();
    
    // メモリ監視・1GB制限
    this.monitorMemoryUsage();
  }
  
  private monitorFrameRate(): void {
    const monitor = (timestamp: number) => {
      // FPS計算・移動平均
      if (this.lastFrameTime > 0) {
        const deltaTime = timestamp - this.lastFrameTime;
        const fps = 1000 / deltaTime;
        
        this.frameHistory.push(fps);
        if (this.frameHistory.length > 60) { // 1秒間の履歴
          this.frameHistory.shift();
        }
        
        // 平均FPS計算
        this.currentFPS = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
        
        // 性能低下検出・警告発行
        if (this.currentFPS < this.MIN_FPS) {
          this.eventBus.emit('performance:critical', {
            type: 'fps',
            action: 'reduce_quality'
          });
        } else if (this.currentFPS < this.TARGET_FPS * 0.8) {
          this.eventBus.emit('performance:warning', {
            type: 'fps',
            current: this.currentFPS,
            limit: this.TARGET_FPS,
            severity: 'medium'
          });
        }
      }
      
      this.lastFrameTime = timestamp;
      requestAnimationFrame(monitor);
    };
    
    requestAnimationFrame(monitor);
  }
  
  private monitorMemoryUsage(): void {
    const checkMemory = () => {
      // Chrome専用・performance.memory利用
      const memory = (performance as any).memory;
      if (!memory) return;
      
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      
      // 1GB制限・強制GC
      if (usedMB > this.MAX_MEMORY_MB) {
        this.forceGarbageCollection();
        this.eventBus.emit('performance:critical', {
          type: 'memory',
          action: 'force_gc'
        });
      }
      
      // 800MB警告
      if (usedMB > this.WARNING_MEMORY_MB) {
        this.eventBus.emit('performance:warning', {
          type: 'memory',
          current: usedMB,
          limit: this.MAX_MEMORY_MB,
          severity: 'high'
        });
      }
      
      setTimeout(checkMemory, 5000); // 5秒間隔
    };
    
    checkMemory();
  }
  
  private forceGarbageCollection(): void {
    // PixiJSテクスチャキャッシュクリア
    PIXI.Texture.removeFromCache();
    
    // 未使用Graphics削除
    this.cleanupUnusedGraphics();
    
    // 手動GC（開発環境）
    if (window.gc) {
      window.gc();
    }
    
    console.warn('Forced garbage collection executed');
  }
  
  private cleanupUnusedGraphics(): void {
    // 実装: Container階層走査・未使用Graphics削除
    // Phase1では基本実装・Phase2で詳細最適化
  }
  
  // 性能取得API・UI表示用
  public getPerformanceMetrics() {
    const memory = (performance as any).memory;
    const memoryUsage = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    
    return {
      fps: Math.round(this.currentFPS),
      memoryMB: Math.round(memoryUsage),
      memoryPercent: Math.round((memoryUsage / this.MAX_MEMORY_MB) * 100),
      status: this.getPerformanceStatus()
    };
  }
  
  private getPerformanceStatus(): 'excellent' | 'good' | 'warning' | 'critical' {
    const memory = (performance as any).memory;
    const memoryUsage = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    
    if (this.currentFPS >= this.TARGET_FPS * 0.9 && memoryUsage < this.WARNING_MEMORY_MB) {
      return 'excellent';
    } else if (this.currentFPS >= this.TARGET_FPS * 0.7 && memoryUsage < this.MAX_MEMORY_MB) {
      return 'good';
    } else if (this.currentFPS >= this.MIN_FPS && memoryUsage < this.MAX_MEMORY_MB) {
      return 'warning';
    } else {
      return 'critical';
    }
  }
}
```

## 📚 シンボル辞書・命名規則

### クラス命名規則（責任明確化）
```typescript
// ✅ 推奨命名パターン
class PixiApplication      // PixiJS初期化・制御
class EventBus            // イベント通信・疎結合
class DrawingEngine       // 描画統合・ツール制御
class InputManager        // 入力統合・デバイス抽象化
class PerformanceManager  // 性能監視・最適化
class LayerManager        // レイヤー管理・Container制御
class ToolManager         // ツール状態・設定管理
class UIManager           // UI統合・レイアウト制御

// ❌ 避けるべき命名（曖昧・責任不明）
class Manager             // 何を管理？不明
class Handler             // 何を処理？不明  
class Helper              // 何を支援？不明
class Service             // 何のサービス？不明
class Utils               // 何のユーティリティ？不明
```

### ファイル・ディレクトリ命名
```
✅ 明確・一貫した命名:
├─ PixiApplication.ts         // クラス名一致・Pascal Case
├─ drawing.types.ts           // 機能.用途.拡張子
├─ ui-constants.ts            // 機能-用途.拡張子（kebab-case）
├─ performance-constants.ts   // 長い名前はkebab-case
└─ IEventData.ts              // インターフェースはI接頭辞

❌ 避けるべき命名:
├─ pixi.ts                    // 機能不明・短縮名
├─ helpers.ts                 // 曖昧・複数機能混在
├─ common.ts                  // 何が共通？不明
└─ index.ts                   // 再エクスポート以外禁止
```

### 変数・関数命名規則
```typescript
// ✅ 明確・自己説明的命名
const CANVAS_WIDTH = 2560;              // 定数・SCREAMING_SNAKE_CASE
const DEFAULT_BRUSH_SIZE = 5;           // 設定値・意味明確
let currentPressure = 0.0;              // 状態変数・camelCase
let isDrawing = false;                  // boolean・is/has接頭辞

// 関数・動詞+目的語
function initializePixiApplication(): Promise<boolean>
function detectBestRenderer(): Promise<string>
function calculateBrushSize(pressure: number): number
function convertScreenToCanvas(point: PIXI.Point): PIXI.Point

// ❌ 避けるべき命名
let data;                               // 何のデータ？不明
let temp;                               // 一時的な何？不明
let x, y;                               // 何の座標？不明
function process();                     // 何を処理？不明
function handle();                      // 何を扱う？不明
```

### イベント命名規則（型安全・明確）
```typescript
// ✅ 階層的・意味明確なイベント名
'drawing:start'           // 描画開始・ドメイン:アクション
'drawing:move'            // 描画継続・座標更新
'drawing:end'             // 描画終了・ストローク完了

'tool:change'             // ツール変更・設定切り替え
'tool:settings'           // ツール設定・パラメータ更新

'layer:create'            // レイヤー作成・階層管理
'layer:delete'            // レイヤー削除・確認必要
'layer:reorder'           // レイヤー順序・ドラッグ操作

'performance:warning'     // 性能警告・品質調整検討
'performance:critical'    // 性能危機・即座対応必要

'ui:layout:change'        // UI レイアウト変更・画面調整
'ui:theme:update'         // テーマ更新・色システム変更

// ❌ 避けるべきイベント名
'click'                   // 何のクリック？不明
'update'                  // 何を更新？不明
'change'                  // 何が変更？不明
'event'                   // 何のイベント？不明
```

## 🎨 UI実装規約・ふたば色システム

### CSS変数定義（変更禁止・厳守）
```css
:root {
  /* === ふたば色基調系統 === */
  --futaba-maroon: #800000;          /* メイン・重要操作・削除確認 */
  --futaba-light-maroon: #aa5a56;    /* セカンダリ・ホバー・アクティブ */
  --futaba-medium: #cf9c97;          /* アクセント・境界・フォーカス */
  --futaba-light: #e9c2ba;          /* 境界線・枠線・非アクティブ */
  --futaba-cream: #f0e0d6;          /* パネル背景・UI基調 */
  --futaba-background: #ffffee;      /* キャンバス・作業領域・アプリ背景 */

  /* === 機能色・状態表現 === */
  --success: #4caf50;                /* 成功・完了・保存完了 */
  --warning: #ff9800;                /* 警告・注意・メモリ警告 */
  --error: #f44336;                  /* エラー・危険・削除操作 */
  --info: #2196f3;                   /* 情報・案内・ヘルプ */

  /* === テキスト色・可読性保証 === */
  --text-primary: #2c1810;           /* 主要テキスト・WCAG AAA準拠 */
  --text-secondary: #5d4037;         /* 補助テキスト・説明文 */
  --text-disabled: #8d6e63;          /* 無効状態・グレーアウト */
  --text-inverse: #ffffff;           /* 反転テキスト・白文字 */
}
```

### Grid Layout設計（2.5K最適化・固定）
```css
/* === メイン画面・Grid Layout === */
.main-layout {
  display: grid;
  grid-template-columns: 80px 1fr 400px;  /* ツールバー・キャンバス・レイヤー */
  grid-template-rows: 1fr auto;           /* メイン・タイムライン */
  grid-template-areas: 
    "sidebar canvas layer-panel"
    "sidebar timeline layer-panel";
  height: 100vh;
  width: 100vw;
  gap: 0;
  background: var(--futaba-background);
}

/* === 2.5K環境特化・最適化 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .main-layout {
    grid-template-columns: 96px 1fr 480px; /* 20%サイズアップ */
  }
  
  .toolbar { padding: 20px 16px; }
  .layer-panel { padding: 20px; }
  .tool-button { width: 64px; height: 64px; } /* 56px→64px */
}

/* === レスポンシブ無効・2.5K専用警告 === */
@media (max-width: 2559px) {
  .main-layout::before {
    content: "⚠ このツールは2560×1440以上の環境に最適化されています";
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--warning);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 9999;
    font-size: 14px;
  }
}
```

### コンポーネント設計規約
```css
/* === ツールバー・80px幅固定 === */
.toolbar {
  grid-area: sidebar;
  width: 80px;
  background: var(--futaba-cream);
  border-right: 1px solid var(--futaba-light);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
}

.tool-button {
  width: 56px;
  height: 56px;
  border: 1px solid var(--futaba-light);
  background: var(--futaba-background);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 24px;
  color: var(--futaba-maroon);
}

.tool-button:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
}

.tool-button.active {
  background: var(--futaba-maroon);
  color: var(--text-inverse);
  border-color: var(--futaba-maroon);
}

/* === レイヤーパネル・400px幅固定 === */
.layer-panel {
  grid-area: layer-panel;
  width: 400px;
  background: var(--futaba-cream);
  border-left: 1px solid var(--futaba-light);
  padding: 16px;
  overflow-y: auto;
}

.layer-item {
  height: 64px;
  background: var(--futaba-background);
  border: 1px solid var(--futaba-light);
  border-radius: 6px;
  margin-bottom: 4px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.layer-item:hover {
  background: var(--futaba-light);
  border-color: var(--futaba-medium);
}

.layer-item.active {
  background: var(--futaba-medium);
  border-color: var(--futaba-maroon);
}

/* === 色選択・HSV円形・200px === */
.color-picker-container {
  width: 200px;
  height: 280px;
  background: var(--futaba-cream);
  border: 1px solid var(--futaba-light);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
}

.hsv-color-wheel {
  width: 168px;
  height: 168px;
  border-radius: 50%;
  margin: 0 auto 16px;
  position: relative;
  cursor: crosshair;
}
```

## 🚀 Phase別実装規約

### Phase1: 基盤構築（現在実装中）
```typescript
// Phase1必須実装・品質基準
interface Phase1Requirements {
  // 基盤システム・必須完了
  core: {
    pixiInitialization: boolean;     // PixiJS v8.11.0初期化成功
    webgl2Support: boolean;          // WebGL2確実動作・2560×1440
    eventBusReady: boolean;          // 型安全イベント通信・疎結合
    performanceMonitoring: boolean;  // 基本監視・FPS・メモリ
  };
  
  // 入力システム・デバイス対応
  input: {
    mouseSupport: boolean;           // マウス入力・座標変換・クリック
    penSupport: boolean;             // ペンタブレット・筆圧0.1-1.0
    pressureDetection: boolean;      // 筆圧検出・自然な線幅変化
    coordinateTransform: boolean;    // 画面→キャンバス座標変換
  };
  
  // 描画システム・基本機能
  drawing: {
    basicStrokes: boolean;           // 基本線描画・スムージング
    colorSelection: boolean;         // 色選択・ふたば色・HSV
    brushSizeControl: boolean;       // ブラシサイズ・筆圧連動
    eraserTool: boolean;             // 消しゴム・削除機能
  };
  
  // UI システム・2.5K最適化
  ui: {
    gridLayout: boolean;             // Grid 80px|1fr|400px
    toolbar: boolean;                // ツールバー・56pxボタン
    colorPalette: boolean;           // 基本色選択・ふたば色プリセット
    performanceDisplay: boolean;     // FPS・メモリ表示
  };
  
  // 性能基準・必達目標
  performance: {
    fps: number;                     // 60FPS以上・WebGL2環境
    memoryMB: number;                // 300MB以下・Phase1
    latencyMs: number;               // 8ms以下・入力遅延
    stability: boolean;              // 15分連続動作・エラーなし
  };
}

// Phase1完了判定・チェック関数
export function validatePhase1Completion(): Phase1Requirements {
  return {
    core: {
      pixiInitialization: checkPixiApp(),
      webgl2Support: checkWebGL2(),
      eventBusReady: checkEventBus(),
      performanceMonitoring: checkPerformanceManager()
    },
    input: {
      mouseSupport: checkMouseInput(),
      penSupport: checkPenInput(),
      pressureDetection: checkPressureDetection(),
      coordinateTransform: checkCoordinateTransform()
    },
    drawing: {
      basicStrokes: checkBasicDrawing(),
      colorSelection: checkColorPicker(),
      brushSizeControl: checkBrushSize(),
      eraserTool: checkEraserTool()
    },
    ui: {
      gridLayout: checkGridLayout(),
      toolbar: checkToolbar(),
      colorPalette: checkColorPalette(),
      performanceDisplay: checkPerformanceUI()
    },
    performance: {
      fps: measureAverageFPS(),
      memoryMB: getCurrentMemoryUsage(),
      latencyMs: measureInputLatency(),
      stability: checkStabilityTest()
    }
  };
}
```

### Phase2: 機能拡充（準備中）
```typescript
// Phase2実装準備・設計要件
interface Phase2Requirements {
  // レイヤーシステム・階層管理
  layers: {
    multipleLayers: boolean;         // 20レイヤー管理・Container階層
    layerBlending: boolean;          // ブレンドモード・透明度
    layerReordering: boolean;        // ドラッグ&ドロップ・順序変更
    layerEffects: boolean;           // 基本エフェクト・フィルター
  };
  
  // 高度ツール・描画機能
  tools: {
    advancedBrush: boolean;          // 筆・テクスチャ・自然な表現
    shapeTool: boolean;              // 図形・直線・矩形・円・多角形
    fillTool: boolean;               // 塗りつぶし・フラッドフィル
    selectionTool: boolean;          // 選択・移動・変形・コピー
  };
  
  // エクスポート・ファイル操作
  export: {
    pngExport: boolean;              // PNG出力・透明度対応
    jpegExport: boolean;             // JPEG出力・品質設定
    resolutionOptions: boolean;      // 解像度選択・2K/4K対応
    fileNaming: boolean;             // ファイル名設定・自動生成
  };
  
  // 設定・カスタマイズ
  settings: {
    toolSettings: boolean;           // ツール設定・永続化
    keyboardShortcuts: boolean;      // ショートカット・カスタマイズ
    performanceSettings: boolean;    // 性能設定・品質調整
    uiCustomization: boolean;        // UI カスタマイズ・レイアウト
  };
}
```

### Phase3: 高性能化（設計中）
```typescript
// Phase3高性能化・WebGPU活用
interface Phase3Requirements {
  // WebGPU最適化・GPU並列処理
  webgpu: {
    computeShaders: boolean;         // Compute Shader・並列描画
    gpuParallelProcessing: boolean;  // GPU並列処理・大量ストローク
    memoryOptimization: boolean;     // GPU メモリ最適化・効率化
    realTimeEffects: boolean;        // リアルタイムエフェクト・フィルター
  };
  
  // 4K対応・大容量処理
  performance: {
    fps120Support: boolean;          // 120FPS対応・高リフレッシュレート
    canvas4K: boolean;               // 4096×4096キャンバス・大容量
    memory2GB: boolean;              // 2GB効率メモリ管理
    multiThreading: boolean;         // Worker並列処理・メインスレッド最適化
  };
  
  // 高度描画・表現力
  rendering: {
    advancedBrushes: boolean;        // 高度ブラシ・物理シミュレーション
    vectorSupport: boolean;          // ベクター描画・拡大縮小無劣化
    animationSupport: boolean;       // アニメーション・オニオンスキン
    3dEffects: boolean;              // 3Dエフェクト・立体表現
  };
}
```

## 📋 品質保証・チェックリスト

### 実装前チェック（必須確認）
```
🔍 実装開始前・必須確認項目:
□ ドキュメント理解・PROJECT_SPEC.md全体把握
□ 技術制約確認・PixiJS v8.11.0・TypeScript厳格
□ 対象環境確認・2560×1440液タブレット・タッチ非対応
□ 性能目標確認・60FPS・1GB・5ms遅延以下
□ ふたば色確認・#800000メイン・#ffffee背景
□ Phase1範囲確認・基盤構築のみ・機能追加禁止
□ 単一責任確認・1クラス1機能・疎結合設計
□ EventBus活用・型安全イベント・直接参照禁止
```

### 実装中チェック（継続監視）
```
🔄 実装中・継続確認項目:
□ TypeScript厳格・エラー0・警告0・型安全
□ 単一責任維持・クラス肥大化防止・機能分離
□ EventBus活用・疎結合維持・直接参照回避
□ 性能監視・FPS測定・メモリ監視・警告対応
□ エラーハンドリング・try-catch・ログ出力・復旧
□ ふたば色適用・CSS変数使用・独自色禁止
□ 2.5K最適化・Grid Layout・56pxアイコン・適切サイズ
□ コメント記述・Claude理解用・機能説明・注意事項
```

### 実装完了チェック（品質保証）
```
✅ 実装完了・品質保証チェック:
□ 全機能動作確認・正常動作・エラーなし・期待通り
□ 性能基準達成・60FPS・300MB・8ms遅延・安定動作
□ UI/UX確認・2.5K表示・視認性・操作性・疲労なし
□ アクセシビリティ・WCAG AAA・キーボード・色覚対応
□ エラー処理・異常系・復旧・ユーザーフレンドリー
□ メモリリーク・長時間動作・メモリ増加なし・安定性
□ ドキュメント更新・実装記録・設計変更・コメント
□ 次Phase準備・移行可能・技術的準備・計画確認
```

### よくある違反・修正方法
```
🚨 頻出違反・予防策:

1. 複数責任クラス（Manager症候群）
❌ 違反例: class DrawingManager { initPixi(), setupUI(), handleInput(), ... }
✅ 修正: class PixiApplication, class UIManager, class InputManager 分離

2. EventBus無視（密結合）
❌ 違反例: toolManager.setCurrentTool(penTool); // 直接参照
✅ 修正: eventBus.emit('tool:change', { currentTool: 'pen' }); // 疎結合

3. ふたば色無視（独自色使用）
❌ 違反例: background-color: #ff0000; // 独自色
✅ 修正: background-color: var(--futaba-maroon); // ふたば色

4. 性能監視欠如（測定なし）
❌ 違反例: 実装後、性能測定・監視なし
✅ 修正: PerformanceManager統合・継続監視・警告対応

5. TypeScript緩い（any使用）
❌ 違反例: function process(data: any): any { ... }
✅ 修正: function process(data: DrawingData): DrawingResult { ... }

6. エラー処理欠如（例外無視）
❌ 違反例: const result = riskyOperation(); // エラー処理なし
✅ 修正: try { const result = riskyOperation(); } catch (error) { handleError(error); }

7. Phase飛ばし（段階無視）
❌ 違反例: Phase1でWebGPU・レイヤー・アニメーション実装
✅ 修正: Phase1は基盤のみ・WebGL2・基本描画・UI

8. 制約無視（タッチ対応）
❌ 違反例: touchstart/touchmove イベント実装
✅ 修正: pointer events のみ・マウス・ペン対応
```

## 🎯 成功パターン・失敗回避

### 技術的成功パターン
```
🏆 成功要因・必須実践:

1. 段階的実装厳守
├─ Phase1完了まで他機能着手禁止
├─ 品質基準達成確認後、次Phase移行
├─ 基盤安定化優先・機能追加は後回し
└─ 確実性重視・リスク分散・成功率向上

2. 単一責任原則徹底
├─ 1クラス1機能・明確な役割分担
├─ Claude理解容易・保守性向上・デバッグ効率
├─ テスト容易・品質保証・バグ局所化
└─ 拡張性確保・機能追加・変更容易

3. EventBus疎結合設計
├─ 直接参照禁止・イベント通信必須
├─ 型安全保証・TypeScript活用・エラー防止
├─ デバッグ支援・イベント履歴・追跡容易
└─ 拡張性・新機能追加・既存影響最小

4. 性能監視継続
├─ 実装中・継続測定・基準遵守・品質保証
├─ 早期発見・問題対応・最適化・満足度向上
├─ 自動警告・閾値設定・予防的対応
└─ ユーザー体験・快適性・競合優位性
```

### 失敗パターン・回避策
```
⚠️ 失敗要因・予防必須:

1. 機能過多症候群
症状: Phase1でレイヤー・アニメーション・WebGPU実装
原因: 早期実装欲求・段階無視・リスク軽視
対策: Phase1範囲厳守・基盤完成優先・我慢
予防: チェックリスト確認・定期レビュー・方針遵守

2. 性能軽視症候群
症状: FPS測定なし・メモリ監視なし・最適化後回し
原因: 機能実装優先・性能軽視・UX無視
対策: PerformanceManager必須統合・継続監視
予防: 実装前性能目標確認・測定基盤準備

3. 密結合症候群
症状: 直接参照・Manager肥大化・EventBus無視
原因: 疎結合理解不足・実装効率優先・設計軽視
対策: EventBus必須活用・単一責任厳守
予防: 設計レビュー・結合度チェック・リファクタリング

4. 制約無視症候群
症状: タッチ対応・モバイル対応・Canvas2D使用
原因: 汎用性欲求・制約理解不足・対象曖昧
対策: 制約文書化・定期確認・変更禁止
予防: 実装前制約確認・チェックリスト活用

5. 品質軽視症候群
症状: TypeScript any使用・エラー処理なし・テストなし
原因: 実装速度優先・品質軽視・保守性無視
対策: 厳格設定・エラー処理必須・品質チェック
予防: 品質基準確認・継続レビュー・自動化
```

## 🔄 継続改善・メンテナンス規約

### 定期レビュー・品質維持
```
📅 週次レビュー・継続改善:
毎週金曜日・品質確認:
├─ 性能指標確認・FPS・メモリ・遅延・安定性
├─ TypeScript品質・エラー0・警告0・型安全
├─ 実装進捗確認・Phase1完了率・残課題
├─ 設計一貫性・単一責任・疎結合・EventBus活用
├─ UI/UX確認・ふたば色・2.5K最適化・アクセシビリティ
├─ ドキュメント更新・実装記録・変更反映
└─ 次週計画・優先度・リスク・対策

📅 Phase完了レビュー・移行判定:
Phase完了時・全項目確認:
├─ チェックリスト全項目クリア・品質基準達成
├─ 性能テスト・負荷テスト・長時間動作・安定性確認
├─ ユーザビリティテスト・操作性・視認性・疲労度
├─ アクセシビリティテスト・WCAG AAA・キーボード・色覚
├─ 技術的負債確認・リファクタリング・最適化
├─ ドキュメント完全更新・実装詳細・設計変更
└─ 次Phase準備・技術調査・リスク評価・計画
```

### コード品質・継続向上
```
🔧 品質向上・自動化:

ESLint設定・厳格ルール:
{
  "extends": ["@typescript-eslint/recommended-requiring-type-checking"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",           // any禁止
    "@typescript-eslint/no-unused-vars": "error",            // 未使用変数禁止
    "@typescript-eslint/explicit-function-return-type": "warn", // 戻り値型必須
    "max-lines-per-function": ["error", 50],                 // 関数行数制限
    "max-params": ["error", 4],                              // 引数数制限
    "complexity": ["error", 10]                              // 複雑度制限
  }
}

Git Hooks・品質保証:
pre-commit:
├─ TypeScript型チェック・エラー0必須
├─ ESLint実行・警告0必須・品質保証
├─ Prettier実行・コード整形・一貫性
└─ テスト実行・基本動作確認・回帰防止

pre-push:
├─ 全テスト実行・品質保証・回帰テスト
├─ ビルド成功確認・本番環境対応
├─ 性能テスト・FPS・メモリ・基準達成
└─ ドキュメント更新確認・実装記録
```

### 技術的負債・管理
```
📊 技術的負債・継続管理:

負債分類・優先度管理:
高優先度（即座対応）:
├─ 性能問題・FPS低下・メモリリーク・使用困難
├─ セキュリティ問題・XSS・CSRF・データ漏洩
├─ アクセシビリティ違反・WCAG・キーボード・色覚
└─ 重大バグ・クラッシュ・データ損失・復旧不可

中優先度（計画的対応）:
├─ コード重複・関数肥大化・可読性低下
├─ 型安全性・any使用・型定義不備
├─ テストカバレッジ・未テスト・品質不安
└─ ドキュメント不整合・実装・設計・ズレ

低優先度（時間許可時）:
├─ パフォーマンス最適化・微細改善・効率化
├─ UI/UX改善・使いやすさ・見た目・操作性
├─ 新技術導入・ライブラリ更新・機能追加
└─ リファクタリング・設計改善・保守性向上

負債対応・計画化:
├─ 週次10%時間・技術的負債対応・継続改善
├─ Phase間・まとまった時間・大規模リファクタリング
├─ 緊急対応・即座修正・品質保証・安定性確保
└─ 予防策・設計改善・品質向上・負債削減
```

---

**この統合規約書により、別チャットClaude間での一貫した開発継続と、プロジェクト成功への確実な道筋を確保します。すべての実装判断はこの規約に基づいて行い、変更時は必ずこのファイルを更新します。**