# 実装ガイド v4.0

**ドキュメント**: 段階的実装手順・作業指示書  
**対象読者**: 実装担当者・Claude・開発者  
**最終更新**: 2025年8月7日

## 🎯 実装戦略・Phase展開

### 戦略B+理想要素アプローチ
```
確実な基盤構築 → 段階的高性能化

Phase1: 基盤構築・確実実装（成功率95%）
├─ WebGL2基盤・60FPS目標・確実動作
├─ 基本描画・ペン・消しゴム・色選択
├─ 2.5K UI・ふたば色・操作性確保
└─ 動作するMVP・フィードバック可能

Phase2: 機能拡充・実用化（成功率85%）
├─ 基盤安定後・高度ツール追加
├─ レイヤー・エクスポート・実用機能
├─ WebGPU準備・対応環境検出
└─ 実用的ツール・日常使用可能

Phase3: 高性能化・理想実現（成功率75%）
├─ WebGPU最適化・GPU並列処理
├─ 60FPS安定・4K対応・メモリ最適化
├─ 高度エフェクト・Compute Shader
└─ 理想目標達成・差別化実現
```

## 🚀 Phase1: 基盤構築（2-3週間）

### 実装優先順序・依存関係
```
Week 1: 基盤システム
1. プロジェクト初期化・環境構築
2. PixiApplication.ts - WebGPU初期化・フォールバック
3. EventBus.ts - 型安全イベント通信
4. PerformanceManager.ts - 性能監視基盤

Week 2: 描画・入力システム
5. InputManager.ts - マウス・ペンタブレット対応
6. DrawingEngine.ts - 基本描画・Graphics管理
7. PenTool.ts - 基本ペンツール実装
8. EraserTool.ts - 消しゴムツール実装

Week 3: UI・統合
9. UIManager.ts - 2.5K レイアウト・ふたば色
10. Toolbar.ts - ツールバー・56pxアイコン
11. ColorPalette.ts - HSV色選択・プリセット
12. 統合テスト・調整・Phase1完了確認
```

### Step 1: プロジェクト初期化（30分）

#### 環境構築
```bash
# 1. Vite + TypeScript プロジェクト作成
npm create vite@latest modern-drawing-tool -- --template vanilla-ts
cd modern-drawing-tool

# 2. PixiJS v8依存関係インストール
npm install pixi.js@8.11.0
npm install @types/node

# 3. 開発・品質ツール
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier
npm install --save-dev @types/w3c-web-usb

# 4. ディレクトリ構造作成
mkdir -p src/core src/rendering src/input src/tools src/ui src/constants src/types

# 5. 開発サーバー起動確認
npm run dev
```

#### 基本設定ファイル
```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['pixi.js']
  }
});

// tsconfig.json（重要部分）
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true
  }
}
```

### Step 2: PixiApplication.ts実装（60分）

#### 基本クラス構造
```typescript
// src/core/PixiApplication.ts
import * as PIXI from 'pixi.js';

export class PixiApplication {
  private pixiApp: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: 'webgpu' | 'webgl2' | 'webgl' = 'webgl2'; // Phase1はWebGL2確実

  public async initialize(container: HTMLElement): Promise<boolean> {
    try {
      console.log('PixiJS初期化開始...');
      
      // Phase1: WebGL2確実実装・WebGPU準備
      this.pixiApp = new PIXI.Application();
      await this.pixiApp.init({
        preference: 'webgl2', // Phase1確実動作
        powerPreference: 'high-performance',
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0xffffee, // ふたば背景色
        width: this.getOptimalWidth(),
        height: this.getOptimalHeight()
      });

      this.canvas = this.pixiApp.canvas;
      container.appendChild(this.canvas);
      
      this.renderer = 'webgl2';
      console.log('WebGL2初期化成功');
      return true;
      
    } catch (error) {
      console.error('初期化失敗:', error);
      return false;
    }
  }

  // 2560×1440最適化・画面サイズ適応
  private getOptimalWidth(): number {
    return Math.min(window.innerWidth, 2560);
  }
  
  private getOptimalHeight(): number {
    return Math.min(window.innerHeight, 1440);
  }

  public getApp(): PIXI.Application | null {
    return this.pixiApp;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public getRendererType(): string {
    return this.renderer;
  }

  public destroy(): void {
    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
    }
  }
}
```

### Step 3: EventBus.ts実装（45分）

#### 型安全イベントシステム
```typescript
// src/core/EventBus.ts
export interface IEventData {
  // 描画イベント
  'drawing:start': { 
    point: PIXI.Point; 
    pressure: number; 
    pointerType: 'mouse' | 'pen';
    button: number;
  };
  'drawing:move': { 
    point: PIXI.Point; 
    pressure: number; 
    velocity: number; 
  };
  'drawing:end': { 
    point: PIXI.Point; 
  };
  
  // ツールイベント
  'tool:change': { 
    toolName: string; 
    previousTool: string; 
  };
  'tool:setting-update': { 
    toolName: string;
    setting: string; 
    value: any; 
  };
  
  // UIイベント
  'ui:color-change': { 
    color: number; 
    previousColor: number; 
  };
  'ui:toolbar-click': { 
    tool: string; 
  };
  
  // 性能イベント
  'performance:fps-low': { 
    currentFPS: number; 
    targetFPS: number; 
  };
  'performance:memory-warning': { 
    used: number; 
    limit: number; 
    percentage: number; 
  };
}

export class EventBus {
  private listeners: Map<keyof IEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number; data?: any }> = [];
  private maxHistorySize = 1000;

  public on<K extends keyof IEventData>(
    event: K,
    callback: (data: IEventData[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 自動解除関数返却
    return () => {
      this.off(event, callback);
    };
  }

  public emit<K extends keyof IEventData>(
    event: K,
    data: IEventData[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`EventBus error in ${event}:`, error);
        }
      });
    }

    // イベント履歴記録・デバッグ支援
    this.eventHistory.push({
      event: event as string,
      timestamp: performance.now(),
      data: __DEV__ ? data : undefined // 開発時のみデータ保存
    });

    // 履歴サイズ制限
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  public off<K extends keyof IEventData>(
    event: K,
    callback: (data: IEventData[K]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  public getEventHistory(): Array<{ event: string; timestamp: number }> {
    return this.eventHistory.map(({ event, timestamp }) => ({ event, timestamp }));
  }

  public destroy(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}
```

### Step 4: InputManager.ts実装（90分）

#### マウス・ペンタブレット統合処理
```typescript
// src/input/InputManager.ts
import { EventBus, IEventData } from '../core/EventBus';
import * as PIXI from 'pixi.js';

export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement;
  private isPointerDown = false;
  private lastPointer: PointerEvent | null = null;
  private pressureHistory: number[] = [];

  constructor(eventBus: EventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.setupPointerEvents();
  }

  private setupPointerEvents(): void {
    // Pointer Events統一処理・デバイス抽象化
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
    
    // コンテキストメニュー無効化
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return; // 主ポインターのみ

    event.preventDefault();
    this.isPointerDown = true;
    this.lastPointer = event;

    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);

    const drawingData: IEventData['drawing:start'] = {
      point: canvasPoint,
      pressure,
      pointerType: event.pointerType === 'pen' ? 'pen' : 'mouse',
      button: event.button
    };

    this.eventBus.emit('drawing:start', drawingData);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!event.isPrimary) return;

    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);

    if (this.isPointerDown) {
      // 移動量フィルタリング・不要イベント削減
      if (this.lastPointer) {
        const distance = Math.hypot(
          event.clientX - this.lastPointer.clientX,
          event.clientY - this.lastPointer.clientY
        );
        
        if (distance < 1) return; // 1px未満無視
      }

      const pressure = this.processPressure(event.pressure || 0.5);
      const velocity = this.calculateVelocity(event);

      const drawingData: IEventData['drawing:move'] = {
        point: canvasPoint,
        pressure,
        velocity
      };

      this.eventBus.emit('drawing:move', drawingData);
    }

    this.lastPointer = event;
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.isPointerDown || !event.isPrimary) return;

    this.isPointerDown = false;
    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);

    const drawingData: IEventData['drawing:end'] = {
      point: canvasPoint
    };

    this.eventBus.emit('drawing:end', drawingData);
    this.lastPointer = null;
    this.pressureHistory = [];
  }

  // 座標変換・スクリーン→キャンバス・2.5K対応
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return new PIXI.Point(
      (screenX - rect.left) * scaleX,
      (screenY - rect.top) * scaleY
    );
  }

  // 筆圧処理・スムージング・自然な変化
  private processPressure(rawPressure: number): number {
    // 筆圧履歴でスムージング
    this.pressureHistory.push(rawPressure);
    if (this.pressureHistory.length > 5) {
      this.pressureHistory.shift();
    }

    // 移動平均でスムース化
    const smoothPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
    
    // 筆圧曲線補正・0.1-1.0範囲
    return Math.max(0.1, Math.min(1.0, smoothPressure));
  }

  // 速度計算・描画表現用
  private calculateVelocity(currentEvent: PointerEvent): number {
    if (!this.lastPointer) return 0;

    const distance = Math.hypot(
      currentEvent.clientX - this.lastPointer.clientX,
      currentEvent.clientY - this.lastPointer.clientY
    );

    const timeDelta = currentEvent.timeStamp - this.lastPointer.timeStamp;
    return timeDelta > 0 ? distance / timeDelta : 0;
  }

  public destroy(): void {
    // イベントリスナー削除
    this.canvas.removeEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.removeEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.removeEventListener('pointerup', this.onPointerUp.bind(this));
  }
}
```

### Step 5: DrawingEngine.ts実装（75分）

#### 描画統合・ツール制御
```typescript
// src/core/DrawingEngine.ts
import * as PIXI from 'pixi.js';
import { EventBus, IEventData } from './EventBus';

export class DrawingEngine {
  private pixiApp: PIXI.Application;
  private eventBus: EventBus;
  private currentGraphics: PIXI.Graphics | null = null;
  private strokePoints: PIXI.Point[] = [];
  private drawingContainer: PIXI.Container;
  
  // 描画設定
  private currentColor = 0x800000; // ふたば maroon
  private currentSize = 4;
  private currentOpacity = 0.8;

  constructor(pixiApp: PIXI.Application, eventBus: EventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // 描画用Container作成
    this.drawingContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.drawingContainer);
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on('drawing:start', this.startDrawing.bind(this));
    this.eventBus.on('drawing:move', this.continueDrawing.bind(this));
    this.eventBus.on('drawing:end', this.endDrawing.bind(this));
    this.eventBus.on('ui:color-change', this.onColorChange.bind(this));
  }

  private startDrawing(data: IEventData['drawing:start']): void {
    // 新しいGraphics作成・GPU最適化
    this.currentGraphics = new PIXI.Graphics();
    this.strokePoints = [data.point];

    // 描画設定適用
    this.currentGraphics.lineStyle({
      width: this.calculateBrushSize(data.pressure),
      color: this.currentColor,
      alpha: this.currentOpacity,
      cap: PIXI.LINE_CAP.ROUND,
      join: PIXI.LINE_JOIN.ROUND
    });

    // 開始点設定
    this.currentGraphics.moveTo(data.point.x, data.point.y);
    this.drawingContainer.addChild(this.currentGraphics);
  }

  private continueDrawing(data: IEventData['drawing:move']): void {
    if (!this.currentGraphics) return;

    this.strokePoints.push(data.point);

    // スムージング適用・3点以上で処理
    if (this.strokePoints.length >= 3) {
      const smoothPoint = this.calculateSmoothPoint(
        this.strokePoints[this.strokePoints.length - 3],
        this.strokePoints[this.strokePoints.length - 2],
        this.strokePoints[this.strokePoints.length - 1]
      );

      // 筆圧対応・線幅動的変更
      this.currentGraphics.lineStyle({
        width: this.calculateBrushSize(data.pressure),
        color: this.currentColor,
        alpha: this.currentOpacity
      });

      this.currentGraphics.lineTo(smoothPoint.x, smoothPoint.y);
    } else {
      // 点が少ない場合は直線
      this.currentGraphics.lineTo(data.point.x, data.point.y);
    }
  }

  private endDrawing(data: IEventData['drawing:end']): void {
    if (!this.currentGraphics) return;

    // 最終点追加
    this.currentGraphics.lineTo(data.point.x, data.point.y);
    
    // GPU最適化・Batch処理準備
    this.optimizeGraphics(this.currentGraphics);
    
    // 描画完了・リセット
    this.currentGraphics = null;
    this.strokePoints = [];
  }

  // ベジエ曲線スムージング・手ブレ軽減
  private calculateSmoothPoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point): PIXI.Point {
    const smoothFactor = 0.5;
    return new PIXI.Point(
      p2.x + (p3.x - p1.x) * smoothFactor * 0.25,
      p2.y + (p3.y - p1.y) * smoothFactor * 0.25
    );
  }

  // 筆圧対応サイズ計算
  private calculateBrushSize(pressure: number): number {
    const minSize = this.currentSize * 0.3;
    const maxSize = this.currentSize * 1.5;
    return minSize + (maxSize - minSize) * pressure;
  }

  // Graphics最適化・GPU効率化
  private optimizeGraphics(graphics: PIXI.Graphics): void {
    // バッチング最適化
    graphics.finishPoly();
    
    // 複雑度チェック・簡略化
    if (this.strokePoints.length > 500) {
      // 点数削減・性能優先
      this.simplifyStroke();
    }
  }

  // ストローク簡略化・性能最適化
  private simplifyStroke(): void {
    // Douglas-Peucker簡略化アルゴリズム（簡易版）
    const simplified: PIXI.Point[] = [];
    const tolerance = 2.0; // 許容誤差

    for (let i = 0; i < this.strokePoints.length; i += 2) {
      simplified.push(this.strokePoints[i]);
    }

    this.strokePoints = simplified;
  }

  // 色変更イベント処理
  private onColorChange(data: IEventData['ui:color-change']): void {
    this.currentColor = data.color;
  }

  // 公開設定メソッド
  public setBrushSize(size: number): void {
    this.currentSize = Math.max(1, Math.min(200, size));
  }

  public setOpacity(opacity: number): void {
    this.currentOpacity = Math.max(0, Math.min(1, opacity));
  }

  public getCurrentColor(): number {
    return this.currentColor;
  }

  public destroy(): void {
    if (this.drawingContainer) {
      this.drawingContainer.destroy({ children: true });
    }
  }
}
```

### Step 6: PenTool.ts実装（45分）

#### 基本ペンツール・Phase1
```typescript
// src/tools/PenTool.ts
import { IEventData } from '../core/EventBus';

export interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  getSettings(): any;
  updateSettings(settings: Partial<any>): void;
}

export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;

  private settings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたば maroon
    smoothing: true,
    pressureSensitive: true
  };

  private isActive = false;

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('ペンツール有効化');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
  }

  public onPointerDown(event: IEventData['drawing:start']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public onPointerMove(event: IEventData['drawing:move']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public onPointerUp(event: IEventData['drawing:end']): void {
    if (!this.isActive) return;
    // DrawingEngineが処理・ツール固有処理なし
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('ペンツール設定更新:', this.settings);
  }
}
```

### Step 7: UIManager.ts・基本UI実装（60分）

#### 2.5K最適化・ふたば色統合
```typescript
// src/ui/UIManager.ts
import { EventBus } from '../core/EventBus';

export class UIManager {
  private eventBus: EventBus;
  private rootElement: HTMLElement;

  constructor(eventBus: EventBus, rootElement: HTMLElement) {
    this.eventBus = eventBus;
    this.rootElement = rootElement;
    this.initializeCSS();
  }

  public async initializeBasicUI(): Promise<void> {
    // 基本レイアウト作成
    this.createMainLayout();
    
    // ツールバー作成
    this.createToolbar();
    
    // キャンバス領域作成
    this.createCanvasArea();
    
    // 基本色パレット作成
    this.createBasicColorPalette();

    console.log('基本UI初期化完了');
  }

  private initializeCSS(): void {
    // ふたば色CSS変数定義
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --futaba-maroon: #800000;
        --futaba-light-maroon: #aa5a56;
        --futaba-medium: #cf9c97;
        --futaba-light: #e9c2ba;
        --futaba-cream: #f0e0d6;
        --futaba-background: #ffffee;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--futaba-background);
        overflow: hidden;
      }
      
      .main-layout {
        display: grid;
        grid-template-columns: 80px 1fr;
        grid-template-rows: 1fr;
        height: 100vh;
        width: 100vw;
      }
      
      .toolbar {
        background: var(--futaba-cream);
        border-right: 1px solid var(--futaba-light);
        display: flex;
        flex-direction: column;
        padding: 16px 12px;
        gap: 8px;
      }
      
      .canvas-area {
        background: var(--futaba-background);
        position: relative;
        overflow: hidden;
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
        transition: all 0.2s ease;
        font-size: 24px;
        color: var(--futaba-maroon);
      }
      
      .tool-button:hover {
        background: var(--futaba-medium);
        border-color: var(--futaba-light-maroon);
        transform: scale(1.05);
      }
      
      .tool-button.active {
        background: var(--futaba-maroon);
        color: white;
        border-color: var(--futaba-maroon);
      }
      
      .color-palette {
        position: absolute;
        top: 20px;
        right: 20px;
        background: var(--futaba-cream);
        border: 1px solid var(--futaba-light);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        gap: 8px;
      }
      
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 2px solid var(--futaba-light);
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      
      .color-swatch:hover {
        transform: scale(1.1);
      }
      
      .color-swatch.active {
        border-color: var(--futaba-maroon);
        border-width: 3px;
      }