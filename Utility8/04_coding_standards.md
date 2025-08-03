# コーディング規約・品質基準 v4.0

**ドキュメント**: コーディング規約・開発標準  
**バージョン**: v4.0.0  
**最終更新**: 2025年8月4日  
**対象読者**: 開発者・Claude・コードレビュアー

## 🎯 規約方針・Claude協業最適化

### 基本原則・2.5K液タブレット環境開発

#### **Claude協業最適化設計**
```
単一責任原則・理解容易性:
✅ 1クラス1機能・責任分界明確・デバッグ容易
✅ メソッド20行以内・複雑度10以下・可読性優先
✅ 引数3個以内・戻り値型明確・予測可能動作
✅ 副作用最小・純粋関数優先・テスト容易

段階的実装・Phase対応:
✅ Phase毎モジュール分離・依存関係最小化
✅ インターフェース先行定義・契約明確化
✅ 漸進的詳細化・MVP→拡張・品質保証
✅ 後方互換性維持・アップデート安全
```

#### **2.5K環境・高性能開発基準**
```
WebGPU・120FPS最適化:
✅ GPU並列処理・Compute Shader活用・高効率
✅ メモリプール管理・2GB制限・リーク防止
✅ 60FPS最低保証・120FPS目標・遅延最小化
✅ 4K対応・2560×1440表示最適化・高精度

マウス・ペンタブレット特化:
✅ Pointer Events統合・デバイス抽象化
✅ 筆圧・傾き・サイドボタン対応・自然操作
✅ 座標変換精密・サブピクセル精度・高解像度
❌ タッチ・ジェスチャー非対応・集中開発
```

## 🏗️ ESM・TypeScript統合規約

### モジュール構成・インポート規約

#### **ESM統一・Tree Shaking最適化**
```javascript
// ✅ 推奨: 名前付きエクスポート・Tree Shaking対応
export class DrawingEngine {
  constructor(pixiApp, eventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
  }
}

export const DRAWING_CONSTANTS = {
  MAX_BRUSH_SIZE: 200,
  MIN_BRUSH_SIZE: 1,
  DEFAULT_OPACITY: 0.8
};

// ✅ 推奨: インポート順序・グループ化
import * as PIXI from 'pixi.js';
import { EventBus } from '../core/EventBus.js';
import { InputManager } from '../input/InputManager.js';
import { TOOL_TYPES, UI_CONSTANTS } from '../constants/index.js';

// ❌ 避ける: default export・Bundle肥大化
export default class DrawingEngine { /* ... */ }
```

#### **TypeScript統合・型安全性確保**
```typescript
// ✅ 推奨: インターフェース先行定義・契約明確
interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  activate(): void;
  deactivate(): void;
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
}

interface ILayerData {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  container: PIXI.Container;
}

// ✅ 推奨: 型安全・Null安全・エラー防止
class PenTool implements IDrawingTool {
  private currentStroke: PIXI.Graphics | null = null;
  
  public onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return;
    
    this.currentStroke = new PIXI.Graphics();
    this.currentStroke.lineStyle({
      width: this.brushSize,
      color: this.currentColor,
      alpha: this.opacity
    });
  }
}
```

### ファイル命名・構成規約

#### **2.5K環境・階層構成**
```
src/
├── core/                        # 基盤システム・Phase1
│   ├── PixiApplication.ts          # アプリ初期化・WebGPU制御
│   ├── EventBus.ts                # イベント統合・型安全通信
│   ├── DrawingEngine.ts           # 描画統合・ツール制御
│   └── PerformanceManager.ts      # 性能監視・2GB管理

├── rendering/                   # レンダリング・GPU最適化
│   ├── WebGPURenderer.ts          # WebGPU専用・120FPS対応
│   ├── LayerManager.ts            # 50レイヤー管理・階層制御
│   ├── CanvasManager.ts           # 4K対応・座標変換
│   └── TextureManager.ts          # GPU メモリ・効率管理

├── input/                       # 入力処理・マウス・ペン特化
│   ├── InputManager.ts            # 統合入力・デバイス抽象化
│   ├── PointerProcessor.ts        # 筆圧・傾き・精密処理
│   └── ShortcutManager.ts         # キーボード・ペンボタン

├── tools/                       # ツールシステム・段階実装
│   ├── ToolManager.ts             # ツール統合・状態管理
│   ├── PenTool.ts                # ペン・基本描画・Phase1
│   ├── BrushTool.ts              # 筆・テクスチャ・Phase2
│   └── EraserTool.ts             # 消しゴム・削除・Phase1

├── ui/                          # UI制御・2.5K最適化
│   ├── UIManager.ts               # UI統合・ふたば色管理
│   ├── Toolbar.ts                # ツールバー・56px アイコン
│   ├── ColorPalette.ts           # 色選択・200px ピッカー
│   └── LayerPanel.ts             # レイヤー・96px 項目

├── constants/                   # 定数・設定・2.5K環境
│   ├── ui-constants.ts           # UI定数・サイズ・色定義
│   ├── drawing-constants.ts      # 描画定数・性能設定
│   └── performance-constants.ts  # 性能定数・制限値

└── types/                       # 型定義・TypeScript
    ├── drawing.types.ts          # 描画関連型・インターフェース
    ├── ui.types.ts              # UI関連型・イベント定義
    └── performance.types.ts      # 性能関連型・監視指標
```

## 🎨 PixiJS v8統合・WebGPU規約

### PixiJS活用・高性能化規約

#### **Container階層・レイヤー管理**
```typescript
// ✅ 推奨: Container階層・Z-index管理・50レイヤー対応
class LayerManager {
  private readonly rootContainer: PIXI.Container;
  private readonly layers: Map<string, ILayerData> = new Map();
  private readonly layerOrder: string[] = [];
  
  constructor(pixiApp: PIXI.Application) {
    this.rootContainer = new PIXI.Container();
    this.rootContainer.sortableChildren = true; // Z-index有効化
    pixiApp.stage.addChild(this.rootContainer);
  }
  
  public createLayer(name: string): string {
    const layerId = crypto.randomUUID();
    const container = new PIXI.Container();
    container.zIndex = this.layerOrder.length; // 階層順序
    
    const layerData: ILayerData = {
      id: layerId,
      name,
      visible: true,
      opacity: 1.0,
      blendMode: PIXI.BLEND_MODES.NORMAL,
      container
    };
    
    this.layers.set(layerId, layerData);
    this.layerOrder.push(layerId);
    this.rootContainer.addChild(container);
    
    return layerId;
  }
  
  // ✅ 推奨: メモリ効率・ガベージコレクション対応
  public deleteLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (!layer) return;
    
    // Container階層から削除
    this.rootContainer.removeChild(layer.container);
    
    // GPU テクスチャ解放
    layer.container.destroy({ children: true, texture: true });
    
    // メモリから削除
    this.layers.delete(layerId);
    this.layerOrder.splice(this.layerOrder.indexOf(layerId), 1);
    
    // Z-index再計算
    this.reorderLayers();
  }
}
```

#### **WebGPU最適化・GPU活用規約**
```typescript
// ✅ 推奨: WebGPU検出・フォールバック・段階的縮退
class PixiApplication {
  private pixiApp: PIXI.Application | null = null;
  private renderer: 'webgpu' | 'webgl2' | 'webgl' = 'webgpu';
  
  public async initialize(): Promise<void> {
    try {
      // WebGPU優先・120FPS対応
      this.pixiApp = new PIXI.Application();
      await this.pixiApp.init({
        preference: 'webgpu',
        powerPreference: 'high-performance',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0xffffee, // ふたば背景色
        width: 2560,  // 2.5K幅
        height: 1440, // 2.5K高
      });
      
      this.renderer = 'webgpu';
      console.log('WebGPU初期化成功:', this.pixiApp.renderer.type);
      
    } catch (error) {
      console.warn('WebGPU失敗、WebGL2にフォールバック:', error);
      await this.initializeWebGL2();
    }
  }
  
  private async initializeWebGL2(): Promise<void> {
    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init({
      preference: 'webgl2',
      powerPreference: 'high-performance',
      antialias: false, // 性能優先
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundColor: 0xffffee,
      width: 1920,  // WebGL2制限
      height: 1080,
    });
    
    this.renderer = 'webgl2';
  }
}
```

### Graphics・描画最適化規約

#### **高効率描画・120FPS維持**
```typescript
// ✅ 推奨: Batch処理・Draw Call削減・GPU最適化
class DrawingEngine {
  private currentGraphics: PIXI.Graphics | null = null;
  private strokePoints: PIXI.Point[] = [];
  private readonly maxPointsPerBatch: number = 1000; // GPU制限考慮
  
  public startStroke(point: PIXI.Point, pressure: number): void {
    this.currentGraphics = new PIXI.Graphics();
    this.strokePoints = [point];
    
    // GPU最適化・Batch設定
    this.currentGraphics.batchMode = true;
    this.currentGraphics.lineStyle({
      width: this.calculateBrushSize(pressure),
      color: this.currentColor,
      alpha: this.opacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });
    
    this.currentGraphics.moveTo(point.x, point.y);
    this.getCurrentLayer().container.addChild(this.currentGraphics);
  }
  
  public addStrokePoint(point: PIXI.Point, pressure: number): void {
    if (!this.currentGraphics) return;
    
    this.strokePoints.push(point);
    
    // ✅ 推奨: スムージング・ベジエ曲線・自然な線
    if (this.strokePoints.length >= 3) {
      const smoothPoint = this.calculateSmoothPoint(
        this.strokePoints[this.strokePoints.length - 3],
        this.strokePoints[this.strokePoints.length - 2],
        this.strokePoints[this.strokePoints.length - 1]
      );
      
      this.currentGraphics.lineStyle({
        width: this.calculateBrushSize(pressure)
      });
      this.currentGraphics.lineTo(smoothPoint.x, smoothPoint.y);
    }
    
    // ✅ 推奨: Batch制限・メモリ効率
    if (this.strokePoints.length > this.maxPointsPerBatch) {
      this.flushStrokeBatch();
    }
  }
  
  private calculateSmoothPoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point): PIXI.Point {
    // ベジエ曲線補間・手ブレ軽減
    const smoothFactor = 0.5;
    return new PIXI.Point(
      p2.x + (p3.x - p1.x) * smoothFactor * 0.25,
      p2.y + (p3.y - p1.y) * smoothFactor * 0.25
    );
  }
}
```

## 🖱️ 入力処理・デバイス対応規約

### Pointer Events・マウス・ペンタブレット特化

#### **入力統合・高精度処理**
```typescript
// ✅ 推奨: Pointer Events統合・デバイス抽象化
class InputManager {
  private readonly eventBus: EventBus;
  private readonly canvas: HTMLCanvasElement;
  private isDrawing: boolean = false;
  private lastPointer: PointerEvent | null = null;
  
  constructor(eventBus: EventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.setupPointerEvents();
  }
  
  private setupPointerEvents(): void {
    // ✅ 推奨: Pointer Events・統一処理・デバイス横断
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    
    // ペンタブレット専用イベント
    this.canvas.addEventListener('pointerenter', this.onPointerEnter.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerLeave.bind(this));
    
    // ❌ タッチ非対応・集中開発
    // this.canvas.addEventListener('touchstart', ...);
    // this.canvas.addEventListener('touchmove', ...);
  }
  
  private onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return; // マルチポインター無視
    
    event.preventDefault();
    this.isDrawing = true;
    this.lastPointer = event;
    
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    const drawingData = {
      point: canvasPoint,
      pressure: event.pressure || 0.5, // 筆圧対応
      tiltX: (event as any).tiltX || 0,  // 傾き対応
      tiltY: (event as any).tiltY || 0,
      pointerType: event.pointerType,    // mouse/pen判別
      button: event.button,              // ボタン判別
      buttons: event.buttons             // 複数ボタン
    };
    
    this.eventBus.emit('drawing:start', drawingData);
  }
  
  private onPointerMove(event: PointerEvent): void {
    if (!event.isPrimary || !this.isDrawing) return;
    
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    
    // ✅ 推奨: 移動量フィルタ・不要イベント削減
    if (this.lastPointer) {
      const distance = Math.hypot(
        event.clientX - this.lastPointer.clientX,
        event.clientY - this.lastPointer.clientY
      );
      
      if (distance < 1) return; // 1px未満は無視
    }
    
    this.lastPointer = event;
    
    const drawingData = {
      point: canvasPoint,
      pressure: event.pressure || 0.5,
      tiltX: (event as any).tiltX || 0,
      tiltY: (event as any).tiltY || 0,
      velocity: this.calculateVelocity(event)
    };
    
    this.eventBus.emit('drawing:move', drawingData);
  }
  
  // ✅ 推奨: 座標変換・2.5K対応・サブピクセル精度
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return new PIXI.Point(
      (screenX - rect.left) * scaleX,
      (screenY - rect.top) * scaleY
    );
  }
}
```

### キーボード・ペンサイドボタン統合

#### **ショートカット・効率操作**
```typescript
// ✅ 推奨: キーボード・ペンボタン統合・2.5K環境最適化
class ShortcutManager {
  private readonly eventBus: EventBus;
  private readonly shortcuts: Map<string, () => void> = new Map();
  private pressedKeys: Set<string> = new Set();
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupShortcuts();
    this.setupKeyboardEvents();
  }
  
  private setupShortcuts(): void {
    // ツール切り替え・液タブレット最適化
    this.shortcuts.set('KeyB', () => this.switchTool('brush'));
    this.shortcuts.set('KeyP', () => this.switchTool('pen'));
    this.shortcuts.set('KeyE', () => this.switchTool('eraser'));
    this.shortcuts.set('KeyI', () => this.switchTool('eyedropper'));
    
    // 操作系・頻繁使用
    this.shortcuts.set('Control+KeyZ', () => this.eventBus.emit('action:undo'));
    this.shortcuts.set('Control+KeyY', () => this.eventBus.emit('action:redo'));
    this.shortcuts.set('Control+Shift+KeyZ', () => this.eventBus.emit('action:redo'));
    
    // レイヤー操作・大容量対応
    this.shortcuts.set('Control+Shift+KeyN', () => this.eventBus.emit('layer:create'));
    this.shortcuts.set('Delete', () => this.eventBus.emit('layer:delete'));
    
    // 表示制御・2.5K表示
    this.shortcuts.set('Control+Equal', () => this.eventBus.emit('canvas:zoom-in'));
    this.shortcuts.set('Control+Minus', () => this.eventBus.emit('canvas:zoom-out'));
    this.shortcuts.set('Control+Digit0', () => this.eventBus.emit('canvas:zoom-fit'));
  }
  
  private setupKeyboardEvents(): void {
    document.addEventListener('keydown', (event) => {
      this.pressedKeys.add(event.code);
      
      const shortcutKey = this.buildShortcutKey(event);
      const handler = this.shortcuts.get(shortcutKey);
      
      if (handler) {
        event.preventDefault();
        handler();
      }
    });
    
    document.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.code);
    });
  }
  
  private buildShortcutKey(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    if (event.ctrlKey) parts.push('Control');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    
    parts.push(event.code);
    
    return parts.join('+');
  }
}
```

## 🎯 性能・品質管理規約

### パフォーマンス監視・2GB制限

#### **メモリ管理・GPU最適化**
```typescript
// ✅ 推奨: 性能監視・メモリ制限・2.5K環境対応
class PerformanceManager {
  private readonly maxMemoryMB: number = 2048; // 2GB制限
  private readonly warningMemoryMB: number = 1536; // 警告閾値
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private averageFPS: number = 0;
  
  private readonly memoryCheckInterval: number = 5000; // 5秒毎
  private memoryCheckTimer: number = 0;
  
  constructor(private eventBus: EventBus) {
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    // フレームレート監視・120FPS目標
    const monitorFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const deltaTime = timestamp - this.lastFrameTime;
        const currentFPS = 1000 / deltaTime;
        
        // 移動平均・安定計算
        this.averageFPS = this.averageFPS * 0.9 + currentFPS * 0.1;
        
        // 性能警告・品質調整
        if (this.averageFPS < 30) {
          this.eventBus.emit('performance:low-fps', this.averageFPS);
        }
      }
      
      this.lastFrameTime = timestamp;
      this.frameCount++;
      requestAnimationFrame(monitorFrame);
    };
    
    requestAnimationFrame(monitorFrame);
    
    // メモリ監視・定期チェック
    this.memoryCheckTimer = window.setInterval(() => {
      this.checkMemoryUsage();
    }, this.memoryCheckInterval);
  }
  
  private checkMemoryUsage(): void {
    // @ts-ignore - performance.memory は Chrome専用
    const memory = (performance as any).memory;
    if (!memory) return;
    
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const totalMB = memory.totalJSHeapSize / (1024 * 1024);
    
    console.log(`Memory: ${usedMB.toFixed(1)}MB / ${totalMB.toFixed(1)}MB`);
    
    // 警告閾値チェック
    if (usedMB > this.warningMemoryMB) {
      this.eventBus.emit('performance:memory-warning', {
        used: usedMB,
        limit: this.maxMemoryMB,
        percentage: (usedMB / this.maxMemoryMB) * 100
      });
    }
    
    // 制限値チェック・強制GC
    if (usedMB > this.maxMemoryMB) {
      this.eventBus.emit('performance:memory-critical', {
        used: usedMB,
        limit: this.maxMemoryMB
      });
      
      this.forceGarbageCollection();
    }
  }
  
  private forceGarbageCollection(): void {
    // テクスチャキャッシュクリア
    PIXI.Texture.removeFromCache();
    
    // 未使用Container破棄
    this.eventBus.emit('system:cleanup-unused');
    
    // 手動GC（Chrome DevTools環境）
    if (window.gc) {
      window.gc();
    }
  }
  
  public getMetrics() {
    return {
      fps: Math.round(this.averageFPS),
      frameCount: this.frameCount,
      renderer: 'webgpu', // TODO: 動的取得
      memoryUsage: this.getCurrentMemoryUsage()
    };
  }
}
```

### コード品質・テスト規約

#### **TypeScript厳格・エラー防止**
```typescript
// ✅ 推奨: 厳格型チェック・Null安全・エラー防止
interface IDrawingToolSettings {
  readonly size: number;
  readonly opacity: number;
  readonly color: number;
  readonly pressure: boolean;
  readonly smoothing: boolean;
}

class DrawingTool {
  protected settings: IDrawingToolSettings;
  protected isActive: boolean = false;
  
  constructor(initialSettings: IDrawingToolSettings) {
    // ✅ 推奨: 防御的プログラミング・値検証
    this.settings = this.validateSettings(initialSettings);
  }
  
  private validateSettings(settings: IDrawingToolSettings): IDrawingToolSettings {
    return {
      size: Math.max(1, Math.min(200, settings.size)),
      opacity: Math.max(0, Math.min(1, settings.opacity)),
      color: settings.color & 0xFFFFFF, // RGB範囲制限
      pressure: Boolean(settings.pressure),
      smoothing: Boolean(settings.smoothing)
    };
  }
  
  // ✅ 推奨: Null安全・Optional Chaining・安全アクセス
  public updateSettings(partial: Partial<IDrawingToolSettings>): void {
    const newSettings = {
      ...this.settings,
      ...partial
    };
    
    this.settings = this.validateSettings(newSettings);
    this.onSettingsChanged?.(this.settings);
  }
  
  // ✅ 推奨: エラーハンドリング・Promise・非同期安全
  public async saveToFile(filename: string): Promise<boolean> {
    try {
      const canvas = this.getCanvas();
      if (!canvas) {
        throw new Error('Canvas not available');
      }
      
      const blob = await this.canvasToBlob(canvas);
      await this.downloadBlob(blob, filename);
      
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      this.showErrorMessage('保存に失敗しました: ' + error.message);
      return false;
    }
  }
}
```

## 🚀 実装指針・Phase対応

### Phase1実装・基盤優先

#### **MVP機能・安定性重視**
```typescript
// Phase1: 基盤実装・確実動作
const PHASE1_FEATURES = {
  core: [
    'PixiApplication',    // WebGPU初期化・フォールバック
    'EventBus',          // イベント統合・型安全通信
    'DrawingEngine',     // 基本描画・ペンツール
    'InputManager',      // マウス・ペンタブレット基本
  ],
  ui: [
    'Toolbar',           // ツール選択・56pxアイコン
    'ColorPalette',      // 基本色選択・ふたば色
    'LayerPanel',        // 基本レイヤー・5枚制限
  ],
  tools: [
    'PenTool',           // 基本ペン・線描画
    'EraserTool',        // 消しゴム・基本削除
    'ColorPicker',       // 色選択・HSV基本
  ]
};

// ✅ 推奨: 段階的実装・依存関係管理
class Phase1Implementation {
  public async initializePhase1(): Promise<void> {
    console.log('Phase1 初期化開始...');
    
    // 1. 基盤システム初期化
    const pixiApp = new PixiApplication();
    await pixiApp.initialize();
    
    const eventBus = new EventBus();
    const performanceManager = new PerformanceManager(eventBus);
    
    // 2. 入力システム初期化
    const inputManager = new InputManager(eventBus, pixiApp.view);
    
    // 3. 描画システム初期化
    const drawingEngine = new DrawingEngine(pixiApp, eventBus);
    
    // 4. UI システム初期化
    const uiManager = new UIManager(eventBus);
    await uiManager.initializeBasicUI();
    
    // 5. 基本ツール初期化
    const toolManager = new ToolManager(eventBus);
    toolManager.registerTool(new PenTool());
    toolManager.registerTool(new EraserTool());
    
    console.log('Phase1 初期化完了');
  }
}
```

---

**このコーディング規約は、Claude協業による高品質・高性能な2.5K液タブレット対応お絵かきツール開発の基盤となります。段階的実装・品質保証・120FPS性能を両立する実装指針として活用します。**