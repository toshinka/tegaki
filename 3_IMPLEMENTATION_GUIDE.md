# 実装ガイド v4.2

**ドキュメント**: PixiV8Chrome統合・責任分界・Claude実装効率最大化  
**対象読者**: Claude・実装担当者・開発継続者  
**最終更新**: 2025年8月5日

## 🎯 v4.2命名規約準拠・実装戦略

### PixiV8Chrome統合命名・責任分界明確化
```
✅ 統一命名規則:
├─ PixiV8Chrome* プレフィックス必須（技術スタック明示）
├─ *Controller（制御統合）・*Processor（処理実行）・*Monitor（監視）
├─ 責任単一化・1クラス1機能・Claude理解容易
└─ Tier1-3対応・段階的縮退戦略・環境適応

❌ 規約違反命名・削除済み:
├─ *Manager（責務曖昧）→ *Controller（制御明確）
├─ *Handler（処理不明）→ *Processor（処理実行）
├─ 一般的名前 → PixiV8Chrome*（技術明示）
└─ 複数責任混在 → 単一責任分離
```

### Tier戦略・段階的実装（1_PROJECT_SPEC.md準拠）
```
Tier 1: WebGPU + OffscreenCanvas（最高性能）
 ├─ 目標: 60FPS安定・2048x2048・5ms遅延以下
 ├─ 対象: Chrome/Edge最新・高性能GPU・8GB+メモリ
 └─ 機能: 高度ブラシ・GPU並列・リアルタイム変形

Tier 2: WebGL2 + 最適化描画（標準性能）
 ├─ 目標: 30FPS安定・1024x1024・16ms遅延以下
 ├─ 対象: Firefox/Safari・中性能GPU・4GB+メモリ
 └─ 機能: 標準ブラシ・基本エフェクト・レイヤー合成

Tier 3: WebGL + 基本機能（最小限）
 ├─ 目標: 20FPS・512x512・50ms遅延許容
 ├─ 対象: 旧ブラウザ・低性能GPU・2GB+メモリ
 └─ 機能: 基本描画・最小限レイヤー・軽量化
```

## 🚀 Phase1: PixiV8Chrome基盤構築

### Step 1: プロジェクト初期化・PixiV8Chrome環境（30分）
```bash
# 1. Vite + TypeScript + PixiJS v8統合環境
npm create vite@latest modern-drawing-tool -- --template vanilla-ts
cd modern-drawing-tool

# 2. PixiJS v8統合パッケージ・必須依存関係
npm install pixi.js@^8.11.0
npm install @types/node

# 3. 開発効率・品質ツール
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier

# 4. PixiV8Chrome統合ディレクトリ構成
mkdir -p src/core src/rendering src/input src/tools src/ui src/constants src/types

# 5. 開発サーバー起動・基盤確認
npm run dev
```

### Step 2: PixiV8ChromeAPIApplication.ts・統合基盤（60分）
```typescript
// src/core/PixiV8ChromeAPIApplication.ts
import * as PIXI from 'pixi.js';

/**
 * PixiV8ChromeAPIApplication
 * 
 * 責任: PixiJS v8統合初期化・Chrome API検出・Tier自動選択
 * 非責任: 描画処理・UI制御・入力処理
 */
export class PixiV8ChromeAPIApplication {
  private pixiApp: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private currentTier: 'tier1' | 'tier2' | 'tier3' = 'tier3';
  private chromeAPISupport = {
    webgpu: false,
    offscreenCanvas: false,
    webCodecs: false,
    performanceObserver: false
  };

  public async initialize(container: HTMLElement): Promise<boolean> {
    try {
      console.log('PixiV8Chrome統合初期化開始...');
      
      // Chrome API対応検出・Tier自動選択
      await this.detectChromeAPICapabilities();
      this.currentTier = this.selectOptimalTier();
      
      // PixiJS v8統合パッケージ初期化
      this.pixiApp = new PIXI.Application();
      await this.pixiApp.init({
        preference: this.getTierPreference(),
        powerPreference: 'high-performance',
        antialias: this.currentTier === 'tier1',
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0xffffee, // ふたば背景色
        width: this.getTierCanvasSize(),
        height: this.getTierCanvasSize()
      });

      this.canvas = this.pixiApp.canvas;
      container.appendChild(this.canvas);
      
      console.log(`PixiV8Chrome初期化成功: ${this.currentTier}・${this.pixiApp.renderer.type}`);
      return true;
      
    } catch (error) {
      console.error('PixiV8Chrome初期化失敗:', error);
      return false;
    }
  }

  private async detectChromeAPICapabilities(): Promise<void> {
    // WebGPU検出
    this.chromeAPISupport.webgpu = !!navigator.gpu;
    
    // OffscreenCanvas検出
    this.chromeAPISupport.offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
    
    // WebCodecs検出
    this.chromeAPISupport.webCodecs = typeof VideoEncoder !== 'undefined';
    
    // PerformanceObserver検出
    this.chromeAPISupport.performanceObserver = typeof PerformanceObserver !== 'undefined';
    
    console.log('Chrome API対応状況:', this.chromeAPISupport);
  }

  private selectOptimalTier(): 'tier1' | 'tier2' | 'tier3' {
    // Tier1: WebGPU + OffscreenCanvas
    if (this.chromeAPISupport.webgpu && this.chromeAPISupport.offscreenCanvas) {
      return 'tier1';
    }
    
    // Tier2: WebGL2 + PerformanceObserver
    if (this.chromeAPISupport.performanceObserver) {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      if (gl2) return 'tier2';
    }
    
    // Tier3: 基本WebGL
    return 'tier3';
  }

  private getTierPreference(): 'webgpu' | 'webgl2' | 'webgl' {
    switch (this.currentTier) {
      case 'tier1': return 'webgpu';
      case 'tier2': return 'webgl2';
      default: return 'webgl';
    }
  }

  private getTierCanvasSize(): number {
    switch (this.currentTier) {
      case 'tier1': return Math.min(2048, window.innerWidth, window.innerHeight);
      case 'tier2': return Math.min(1024, window.innerWidth, window.innerHeight);
      default: return Math.min(512, window.innerWidth, window.innerHeight);
    }
  }

  public getApp(): PIXI.Application | null { return this.pixiApp; }
  public getCanvas(): HTMLCanvasElement | null { return this.canvas; }
  public getCurrentTier(): string { return this.currentTier; }
  public getChromeAPISupport() { return { ...this.chromeAPISupport }; }

  public destroy(): void {
    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
    }
  }
}
```

### Step 3: PixiV8ChromeEventBus.ts・型安全通信（45分）
```typescript
// src/core/PixiV8ChromeEventBus.ts
/**
 * PixiV8ChromeEventBus
 * 
 * 責任: 型安全イベント通信・Chrome API対応・履歴管理
 * 非責任: 描画処理・UI制御・入力変換
 */
export interface IPixiV8ChromeEventData {
  // 描画イベント・ピクセル精度・筆圧対応
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: 'mouse' | 'pen'; button: number; };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number; };
  'drawing:end': { point: PIXI.Point; };
  
  // ツールイベント・状態管理
  'tool:change': { toolName: string; previousTool: string; };
  'tool:setting-update': { toolName: string; setting: string; value: any; };
  
  // UI イベント・ふたば色対応
  'ui:color-change': { color: number; previousColor: number; };
  'ui:toolbar-click': { tool: string; };
  
  // Tier・Chrome API イベント
  'tier:changed': { newTier: 'tier1' | 'tier2' | 'tier3'; reason: string; };
  'chrome-api:webgpu-ready': { adapter: string; device: string; };
  'chrome-api:performance-warning': { metric: string; current: number; threshold: number; };
}

export class PixiV8ChromeEventBus {
  private listeners: Map<keyof IPixiV8ChromeEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number }> = [];
  private maxHistorySize = 1000;

  public on<K extends keyof IPixiV8ChromeEventData>(
    event: K,
    callback: (data: IPixiV8ChromeEventData[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // 自動解除関数返却・メモリリーク防止
    return () => { this.off(event, callback); };
  }

  public emit<K extends keyof IPixiV8ChromeEventData>(
    event: K,
    data: IPixiV8ChromeEventData[K]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`PixiV8ChromeEventBus error in ${event}:`, error);
        }
      });
    }

    // イベント履歴記録・Chrome API監視対応
    this.eventHistory.push({
      event: event as string,
      timestamp: performance.now()
    });

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  public off<K extends keyof IPixiV8ChromeEventData>(
    event: K,
    callback: (data: IPixiV8ChromeEventData[K]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) listeners.delete(callback);
  }

  public destroy(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}
```

### Step 4: PixiV8ChromeInputController.ts・統合入力（90分）
```typescript
// src/input/PixiV8ChromeInputController.ts
import { PixiV8ChromeEventBus, IPixiV8ChromeEventData } from '../core/PixiV8ChromeEventBus.js';
import * as PIXI from 'pixi.js';

/**
 * PixiV8ChromeInputController
 * 
 * 責任: マウス・ペンタブレット統合・座標変換・筆圧処理・Chrome API活用
 * 非責任: 描画処理・ツール制御・UI更新
 */
export class PixiV8ChromeInputController {
  private eventBus: PixiV8ChromeEventBus;
  private canvas: HTMLCanvasElement;
  private isPointerDown = false;
  private lastPointer: PointerEvent | null = null;
  private pressureHistory: number[] = [];

  constructor(eventBus: PixiV8ChromeEventBus, canvas: HTMLCanvasElement) {
    this.eventBus = eventBus;
    this.canvas = canvas;
    this.setupPointerEvents();
  }

  private setupPointerEvents(): void {
    // Pointer Events統一・Chrome API最適化
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary) return;

    event.preventDefault();
    this.isPointerDown = true;
    this.lastPointer = event;

    const canvasPoint = this.screenToCanvas(event.clientX, event.clientY);
    const pressure = this.processPressure(event.pressure || 0.5);

    const drawingData: IPixiV8ChromeEventData['drawing:start'] = {
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

      const drawingData: IPixiV8ChromeEventData['drawing:move'] = {
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

    const drawingData: IPixiV8ChromeEventData['drawing:end'] = {
      point: canvasPoint
    };

    this.eventBus.emit('drawing:end', drawingData);
    this.lastPointer = null;
    this.pressureHistory = [];
  }

  // 座標変換・2.5K対応・サブピクセル精度
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return new PIXI.Point(
      (screenX - rect.left) * scaleX,
      (screenY - rect.top) * scaleY
    );
  }

  // 筆圧処理・履歴スムージング・Tier対応
  private processPressure(rawPressure: number): number {
    this.pressureHistory.push(rawPressure);
    if (this.pressureHistory.length > 5) {
      this.pressureHistory.shift();
    }

    const smoothPressure = this.pressureHistory.reduce((sum, p) => sum + p, 0) / this.pressureHistory.length;
    return Math.max(0.1, Math.min(1.0, smoothPressure));
  }

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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.removeEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.removeEventListener('pointerup', this.onPointerUp.bind(this));
  }
}
```

### Step 5: PixiV8ChromeDrawingProcessor.ts・描画統合（75分）
```typescript
// src/core/PixiV8ChromeDrawingProcessor.ts
import * as PIXI from 'pixi.js';
import { PixiV8ChromeEventBus, IPixiV8ChromeEventData } from './PixiV8ChromeEventBus.js';

/**
 * PixiV8ChromeDrawingProcessor
 * 
 * 責任: PixiJS v8描画統合・Graphics最適化・Tier対応スムージング
 * 非責任: 入力処理・UI制御・ファイル操作
 */
export class PixiV8ChromeDrawingProcessor {
  private pixiApp: PIXI.Application;
  private eventBus: PixiV8ChromeEventBus;
  private currentGraphics: PIXI.Graphics | null = null;
  private strokePoints: PIXI.Point[] = [];
  private drawingContainer: PIXI.Container;
  
  // Tier対応描画設定
  private currentTier: 'tier1' | 'tier2' | 'tier3' = 'tier3';
  private currentColor = 0x800000; // ふたば maroon
  private currentSize = 4;
  private currentOpacity = 0.8;

  constructor(pixiApp: PIXI.Application, eventBus: PixiV8ChromeEventBus) {
    this.pixiApp = pixiApp;
    this.eventBus = eventBus;
    
    // PixiJS v8 Container階層・描画分離
    this.drawingContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.drawingContainer);
    
    this.setupEventListeners();
    this.detectTier();
  }

  private setupEventListeners(): void {
    this.eventBus.on('drawing:start', this.startDrawing.bind(this));
    this.eventBus.on('drawing:move', this.continueDrawing.bind(this));
    this.eventBus.on('drawing:end', this.endDrawing.bind(this));
    this.eventBus.on('ui:color-change', this.onColorChange.bind(this));
    this.eventBus.on('tier:changed', this.onTierChanged.bind(this));
  }

  private detectTier(): void {
    // WebGPU対応確認・Tier1判定
    if (this.pixiApp.renderer.type === 'webgpu') {
      this.currentTier = 'tier1';
    } else if (this.pixiApp.renderer.type === 'webgl2') {
      this.currentTier = 'tier2';
    } else {
      this.currentTier = 'tier3';
    }
    console.log(`PixiV8Chrome描画プロセッサー: ${this.currentTier}対応`);
  }

  private startDrawing(data: IPixiV8ChromeEventData['drawing:start']): void {
    // PixiJS v8 Graphics作成・Tier最適化
    this.currentGraphics = new PIXI.Graphics();
    this.strokePoints = [data.point];

    // Tier対応描画品質設定
    const lineWidth = this.calculateBrushSize(data.pressure);
    const smoothness = this.getTierSmoothness();

    // PixiJS v8 stroke API・統一描画
    this.currentGraphics
      .moveTo(data.point.x, data.point.y)
      .stroke({
        width: lineWidth,
        color: this.currentColor,
        alpha: this.currentOpacity,
        cap: 'round',
        join: 'round'
      });

    this.drawingContainer.addChild(this.currentGraphics);
  }

  private continueDrawing(data: IPixiV8ChromeEventData['drawing:move']): void {
    if (!this.currentGraphics) return;

    this.strokePoints.push(data.point);

    // Tier対応スムージング・品質調整
    if (this.strokePoints.length >= 3) {
      const smoothPoint = this.calculateSmoothPoint(
        this.strokePoints[this.strokePoints.length - 3],
        this.strokePoints[this.strokePoints.length - 2],
        this.strokePoints[this.strokePoints.length - 1]
      );

      // 筆圧対応線幅・リアルタイム調整
      this.currentGraphics.stroke({
        width: this.calculateBrushSize(data.pressure),
        color: this.currentColor,
        alpha: this.currentOpacity
      });

      this.currentGraphics.lineTo(smoothPoint.x, smoothPoint.y);
    } else {
      this.currentGraphics.lineTo(data.point.x, data.point.y);
    }
  }

  private endDrawing(data: IPixiV8ChromeEventData['drawing:end']): void {
    if (!this.currentGraphics) return;

    this.currentGraphics.lineTo(data.point.x, data.point.y);
    
    // PixiJS v8最適化・GPU効率化
    this.optimizeGraphics(this.currentGraphics);
    
    this.currentGraphics = null;
    this.strokePoints = [];
  }

  // Tier対応スムージング・品質調整
  private calculateSmoothPoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point): PIXI.Point {
    const smoothFactor = this.getTierSmoothness();
    return new PIXI.Point(
      p2.x + (p3.x - p1.x) * smoothFactor * 0.25,
      p2.y + (p3.y - p1.y) * smoothFactor * 0.25
    );
  }

  private getTierSmoothness(): number {
    switch (this.currentTier) {
      case 'tier1': return 0.8; // 高品質スムージング
      case 'tier2': return 0.6; // 標準スムージング
      default: return 0.4; // 軽量スムージング
    }
  }

  private calculateBrushSize(pressure: number): number {
    const minSize = this.currentSize * 0.3;
    const maxSize = this.currentSize * 1.5;
    return minSize + (maxSize - minSize) * pressure;
  }

  // PixiJS v8 Graphics最適化・GPU効率
  private optimizeGraphics(graphics: PIXI.Graphics): void {
    graphics.finishPoly();
    
    // Tier対応複雑度管理
    const maxPoints = this.getMaxPoints();
    if (this.strokePoints.length > maxPoints) {
      this.simplifyStroke();
    }
  }

  private getMaxPoints(): number {
    switch (this.currentTier) {
      case 'tier1': return 1000; // 高精度描画
      case 'tier2': return 500;  // 標準精度
      default: return 250; // 軽量描画
    }
  }

  private simplifyStroke(): void {
    const simplified: PIXI.Point[] = [];
    const step = Math.ceil(this.strokePoints.length / this.getMaxPoints());
    
    for (let i = 0; i < this.strokePoints.length; i += step) {
      simplified.push(this.strokePoints[i]);
    }
    
    this.strokePoints = simplified;
  }

  private onColorChange(data: IPixiV8ChromeEventData['ui:color-change']): void {
    this.currentColor = data.color;
  }

  private onTierChanged(data: IPixiV8ChromeEventData['tier:changed']): void {
    this.currentTier = data.newTier;
    console.log(`描画プロセッサーTier変更: ${data.newTier} - ${data.reason}`);
  }

  public setBrushSize(size: number): void {
    this.currentSize = Math.max(1, Math.min(200, size));
  }

  public setOpacity(opacity: number): void {
    this.currentOpacity = Math.max(0, Math.min(1, opacity));
  }

  public destroy(): void {
    if (this.drawingContainer) {
      this.drawingContainer.destroy({ children: true });
    }
  }
}
```

### Step 6: PixiV8ChromeUIController.ts・統合UI（60分）
```typescript
// src/ui/PixiV8ChromeUIController.ts
import { PixiV8ChromeEventBus } from '../core/PixiV8ChromeEventBus.js';

/**
 * PixiV8ChromeUIController
 * 
 * 責任: 2.5K UI制御・ふたば色統合・Tier表示・Chrome API状態表示
 * 非責任: 描画処理・入力処理・ファイル操作
 */
export class PixiV8ChromeUIController {
  private eventBus: PixiV8ChromeEventBus;
  private rootElement: HTMLElement;
  private currentTier: 'tier1' | 'tier2' | 'tier3' = 'tier3';

  constructor(eventBus: PixiV8ChromeEventBus, rootElement: HTMLElement) {
    this.eventBus = eventBus;
    this.rootElement = rootElement;
    this.initializePixiV8ChromeCSS();
    this.setupEventListeners();
  }

  public async initializeUI(): Promise<void> {
    this.createMainLayout();
    this.createPixiV8ChromeToolbar();
    this.createCanvasArea();
    this.createPixiV8ChromeColorPalette();
    this.createTierIndicator();

    console.log('PixiV8Chrome UI初期化完了');
  }

  private initializePixiV8ChromeCSS(): void {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --futaba-maroon: #800000;
        --futaba-light-maroon: #aa5a56;
        --futaba-medium: #cf9c97;
        --futaba-light: #e9c2ba;
        --futaba-cream: #f0e0d6;
        --futaba-background: #ffffee;
        --success: #4caf50;
        --warning: #ff9800;
        --error: #f44336;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--futaba-background);
        overflow: hidden;
      }
      
      .pixiv8-chrome-main-layout {
        display: grid;
        grid-template-columns: 80px 1fr;
        grid-template-rows: 1fr;
        height: 100vh;
        width: 100vw;
      }
      
      .pixiv8-chrome-toolbar {
        background: var(--futaba-cream);
        border-right: 1px solid var(--futaba-light);
        display: flex;
        flex-direction: column;
        padding: 16px 12px;
        gap: 8px;
      }
      
      .pixiv8-chrome-canvas-area {
        background: var(--futaba-background);
        position: relative;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .pixiv8-chrome-tool-button {
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
      
      .pixiv8-chrome-tool-button:hover {
        background: var(--futaba-medium);
        border-color: var(--futaba-light-maroon);
        transform: scale(1.05);
      }
      
      .pixiv8-chrome-tool-button.active {
        background: var(--futaba-maroon);
        color: white;
        border-color: var(--futaba-maroon);
      }
      
      .pixiv8-chrome-color-palette {
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
      
      .pixiv8-chrome-color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 2px solid var(--futaba-light);
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      
      .pixiv8-chrome-color-swatch:hover {
        transform: scale(1.1);
      }
      
      .pixiv8-chrome-color-swatch.active {
        border-color: var(--futaba-maroon);
        border-width: 3px;
      }
      
      .pixiv8-chrome-tier-indicator {
        position: fixed;
        top: 10px;
        left: 100px;
        background: var(--success);
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
      }
      
      .tier2 { background: var(--warning); }
      .tier3 { background: var(--error); }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    this.eventBus.on('tier:changed', (data) => {
      this.currentTier = data.newTier;
      this.updateTierIndicator();
    });
  }

  private createMainLayout(): void {
    this.rootElement.innerHTML = `
      <div class="pixiv8-chrome-main-layout">
        <div class="pixiv8-chrome-toolbar" id="pixiv8-toolbar"></div>
        <div class="pixiv8-chrome-canvas-area" id="pixiv8-canvas-area"></div>
      </div>
    `;
  }

  private createPixiV8ChromeToolbar(): void {
    const toolbar = document.getElementById('pixiv8-toolbar');
    if (!toolbar) return;

    const tools = [
      { name: 'pen', icon: '✏️', title: 'PixiV8Chrome ペンツール' },
      { name: 'eraser', icon: '🗑️', title: 'PixiV8Chrome 消しゴム' }
    ];

    tools.forEach(tool => {
      const button = document.createElement('button');
      button.className = 'pixiv8-chrome-tool-button';
      button.innerHTML = tool.icon;
      button.title = tool.title;
      button.dataset.tool = tool.name;
      
      if (tool.name === 'pen') {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        this.onToolButtonClick(tool.name);
      });

      toolbar.appendChild(button);
    });
  }

  private createCanvasArea(): void {
    const canvasArea = document.getElementById('pixiv8-canvas-area');
    if (!canvasArea) return;
    // PixiJS キャンバスがここに挿入される
  }

  private createPixiV8ChromeColorPalette(): void {
    const canvasArea = document.getElementById('pixiv8-canvas-area');
    if (!canvasArea) return;

    const palette = document.createElement('div');
    palette.className = 'pixiv8-chrome-color-palette';

    const colors = [
      { color: '#800000', name: 'ふたばマルーン' },
      { color: '#000000', name: '黒' },
      { color: '#FF0000', name: '赤' },
      { color: '#00FF00', name: '緑' },
      { color: '#0000FF', name: '青' }
    ];

    colors.forEach((colorData, index) => {
      const swatch = document.createElement('div');
      swatch.className = 'pixiv8-chrome-color-swatch';
      swatch.style.backgroundColor = colorData.color;
      swatch.title = colorData.name;
      
      if (index === 0) {
        swatch.classList.add('active');
      }

      swatch.addEventListener('click', () => {
        this.onColorSwatchClick(colorData.color, swatch);
      });

      palette.appendChild(swatch);
    });

    canvasArea.appendChild(palette);
  }

  private createTierIndicator(): void {
    const indicator = document.createElement('div');
    indicator.id = 'pixiv8-tier-indicator';
    indicator.className = 'pixiv8-chrome-tier-indicator';
    this.updateTierIndicatorContent(indicator);
    document.body.appendChild(indicator);
  }

  private updateTierIndicator(): void {
    const indicator = document.getElementById('pixiv8-tier-indicator');
    if (indicator) {
      this.updateTierIndicatorContent(indicator);
    }
  }

  private updateTierIndicatorContent(indicator: HTMLElement): void {
    const tierNames = {
      tier1: 'Tier1: WebGPU最高性能',
      tier2: 'Tier2: WebGL2標準',
      tier3: 'Tier3: WebGL基本'
    };
    
    indicator.textContent = tierNames[this.currentTier];
    indicator.className = `pixiv8-chrome-tier-indicator ${this.currentTier}`;
  }

  private onToolButtonClick(toolName: string): void {
    document.querySelectorAll('.pixiv8-chrome-tool-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const clickedButton = document.querySelector(`[data-tool="${toolName}"]`);
    if (clickedButton) {
      clickedButton.classList.add('active');
    }

    this.eventBus.emit('ui:toolbar-click', { tool: toolName });
  }

  private onColorSwatchClick(colorHex: string, swatchElement: HTMLElement): void {
    document.querySelectorAll('.pixiv8-chrome-color-swatch').forEach(swatch => {
      swatch.classList.remove('active');
    });
    swatchElement.classList.add('active');

    const colorNumber = parseInt(colorHex.replace('#', ''), 16);
    this.eventBus.emit('ui:color-change', { 
      color: colorNumber, 
      previousColor: 0x800000 
    });
  }

  public getCanvasContainer(): HTMLElement | null {
    return document.getElementById('pixiv8-canvas-area');
  }
}
```

### Step 7: PixiV8ChromePenTool.ts・基本ツール（45分）
```typescript
// src/tools/PixiV8ChromePenTool.ts
import { IPixiV8ChromeEventData } from '../core/PixiV8ChromeEventBus.js';

/**
 * IPixiV8ChromeDrawingTool - ツール統一インターフェース
 */
export interface IPixiV8ChromeDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IPixiV8ChromeEventData['drawing:start']): void;
  onPointerMove(event: IPixiV8ChromeEventData['drawing:move']): void;
  onPointerUp(event: IPixiV8ChromeEventData['drawing:end']): void;
  getSettings(): any;
  updateSettings(settings: Partial<any>): void;
}

/**
 * PixiV8ChromePenTool
 * 
 * 責任: 基本ペン描画・設定管理・Tier対応品質調整
 * 非責任: 描画実行・UI制御・入力処理
 */
export class PixiV8ChromePenTool implements IPixiV8ChromeDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;

  private settings = {
    size: 4,
    opacity: 0.8,
    color: 0x800000, // ふたば maroon
    smoothing: true,
    pressureSensitive: true,
    tierOptimized: true
  };

  private isActive = false;

  public activate(): void {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    console.log('PixiV8Chrome ペンツール有効化');
  }

  public deactivate(): void {
    this.isActive = false;
    document.body.style.cursor = 'default';
  }

  public onPointerDown(event: IPixiV8ChromeEventData['drawing:start']): void {
    if (!this.isActive) return;
    // DrawingProcessorが実際の描画処理を担当
  }

  public onPointerMove(event: IPixiV8ChromeEventData['drawing:move']): void {
    if (!this.isActive) return;
    // DrawingProcessorが実際の描画処理を担当
  }

  public onPointerUp(event: IPixiV8ChromeEventData['drawing:end']): void {
    if (!this.isActive) return;
    // DrawingProcessorが実際の描画処理を担当
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('PixiV8Chrome ペンツール設定更新:', this.settings);
  }
}
```

### Step 8: main.ts統合・PixiV8Chrome基盤完成（30分）
```typescript
// src/main.ts
import { PixiV8ChromeAPIApplication } from './core/PixiV8ChromeAPIApplication.js';
import { PixiV8ChromeEventBus } from './core/PixiV8ChromeEventBus.js';
import { PixiV8ChromeDrawingProcessor } from './core/PixiV8ChromeDrawingProcessor.js';
import { PixiV8ChromeInputController } from './input/PixiV8ChromeInputController.js';
import { PixiV8ChromeUIController } from './ui/PixiV8ChromeUIController.js';
import { PixiV8ChromePenTool } from './tools/PixiV8ChromePenTool.js';

/**
 * ModernDrawingApp v4.2
 * PixiV8Chrome統合・責任分界・Tier戦略・Claude最適化
 */
class ModernDrawingApp {
  private pixiApp: PixiV8ChromeAPIApplication;
  private eventBus: PixiV8ChromeEventBus;
  private drawingProcessor: PixiV8ChromeDrawingProcessor | null = null;
  private inputController: PixiV8ChromeInputController | null = null;
  private uiController: PixiV8ChromeUIController;
  private penTool: PixiV8ChromePenTool;

  constructor() {
    this.eventBus = new PixiV8ChromeEventBus();
    this.pixiApp = new PixiV8ChromeAPIApplication();
    this.uiController = new PixiV8ChromeUIController(this.eventBus, document.getElementById('app')!);
    this.penTool = new PixiV8ChromePenTool();
  }

  public async initialize(): Promise<boolean> {
    try {
      console.log('🎨 ModernDrawingApp v4.2 - PixiV8Chrome統合起動...');

      // UI初期化・ふたば色・2.5K最適化
      await this.uiController.initializeUI();
      
      // PixiV8Chrome基盤初期化・Tier自動選択
      const canvasContainer = this.uiController.getCanvasContainer();
      if (!canvasContainer) {
        throw new Error('PixiV8Chrome Canvas container not found');
      }

      const success = await this.pixiApp.initialize(canvasContainer);
      if (!success) {
        throw new Error('PixiV8Chrome APIApplication初期化失敗');
      }

      // 描画プロセッサー初期化・PixiJS v8統合
      const app = this.pixiApp.getApp();
      if (!app) {
        throw new Error('PixiV8Chrome App not available');
      }

      this.drawingProcessor = new PixiV8ChromeDrawingProcessor(app, this.eventBus);

      // 入力コントローラー初期化・統合処理
      const canvas = this.pixiApp.getCanvas();
      if (!canvas) {
        throw new Error('PixiV8Chrome Canvas not available');
      }

      this.inputController = new PixiV8ChromeInputController(this.eventBus, canvas);

      // ツール初期化・基本ペン
      this.penTool.activate();

      // PixiV8Chrome統合イベント設定
      this.setupPixiV8ChromeEvents();

      // Tier情報表示
      const tierInfo = this.pixiApp.getCurrentTier();
      const chromeAPI = this.pixiApp.getChromeAPISupport();
      
      console.log('✅ PixiV8Chrome基盤構築完了！');
      console.log(`📊 Tier: ${tierInfo} | Chrome API:`, chromeAPI);
      console.log(`🎯 Renderer: ${app.renderer.type} | Canvas: ${canvas.width}x${canvas.height}`);
      
      // Tier変更イベント発火・UI更新
      this.eventBus.emit('tier:changed', { 
        newTier: tierInfo as any, 
        reason: 'Initial detection' 
      });
      
      return true;

    } catch (error) {
      console.error('❌ PixiV8Chrome初期化エラー:', error);
      return false;
    }
  }

  private setupPixiV8ChromeEvents(): void {
    // UI→ツール連携・統合制御
    this.eventBus.on('ui:toolbar-click', (data) => {
      console.log(`🔧 PixiV8Chrome ツール切り替え: ${data.tool}`);
      // Phase1では基本ペンツールのみ
    });

    // 色変更連携・リアルタイム反映
    this.eventBus.on('ui:color-change', (data) => {
      console.log(`🎨 色変更: #${data.color.toString(16).padStart(6, '0')}`);
    });

    // Tier変更監視・動的最適化
    this.eventBus.on('tier:changed', (data) => {
      console.log(`📊 Tier変更: ${data.newTier} - ${data.reason}`);
    });

    // Chrome API監視・パフォーマンス警告
    this.eventBus.on('chrome-api:performance-warning', (data) => {
      console.warn(`⚠️ 性能警告: ${data.metric} = ${data.current} > ${data.threshold}`);
    });
  }

  public destroy(): void {
    this.inputController?.destroy();
    this.drawingProcessor?.destroy();
    this.pixiApp.destroy();
    this.eventBus.destroy();
  }
}

// PixiV8Chrome統合アプリケーション起動
async function main() {
  const app = new ModernDrawingApp();
  
  const success = await app.initialize();
  if (success) {
    console.log('🎉 Phase1: PixiV8Chrome基盤構築完了 - 描画テスト開始可能');
    console.log('📝 次回: Phase2レイヤーシステム・高度ツール・エクスポート機能');
  } else {
    console.error('💥 PixiV8Chrome初期化失敗 - 環境・設定確認が必要');
  }

  // 開発支援・グローバル参照
  if (import.meta.env.DEV) {
    (window as any).pixiV8ChromeApp = app;
  }
}

main().catch(console.error);
```

## ✅ Phase1完了チェックリスト（v4.2準拠）

### PixiV8Chrome統合確認
```
✅ 命名規約準拠・責任分界:
├─ [ ] 全クラスPixiV8Chrome*プレフィックス統一
├─ [ ] *Controller/*Processor役割明確・単一責任
├─ [ ] *Manager命名完全排除・責務明確化
└─ [ ] Claude理解容易・技術スタック明示

✅ Tier戦略・段階的縮退:
├─ [ ] Tier1-3自動検出・WebGPU/WebGL2/WebGL対応
├─ [ ] Chrome API対応状況表示・機能適応
├─ [ ] 性能目標Tier別設定・品質動的調整
└─ [ ] フォールバック安定・エラー処理完備

✅ PixiJS v8統合基盤:
├─ [ ] 統合パッケージ使用・WebGPU対応・Container階層
├─ [ ] 2560×1440対応・デバイスピクセル比・サブピクセル精度
├─ [ ] Graphics最適化・GPU効率・メモリ管理
└─ [ ] EventBus型安全・疎結合・履歴管理
```

### 機能動作確認
```
✅ 基盤システム:
├─ [ ] PixiV8Chrome初期化・Tier検出・Canvas表示・正常動作
├─ [ ] EventBus通信・型安全・イベント発火受信・履歴記録
├─ [ ] 入力処理・マウス・ペン・座標変換・筆圧処理
└─ [ ] 描画処理・Graphics・スムージング・色反映

✅ UI システム:
├─ [ ] ふたば色適用・2.5K最適化・Grid 80px|1fr レイアウト
├─ [ ] ツールバー・56pxボタン・クリック反応・アクティブ状態
├─ [ ] 色パレット・ふたば色・選択反映・リアルタイム更新
└─ [ ] Tier表示・Chrome API状況・視覚的フィードバック

✅ 性能・品質基準:
├─ [ ] Tier1: 60FPS・WebGPU・高品質スムージング
├─ [ ] Tier2: 30FPS・WebGL2・標準品質・安定動作
├─ [ ] Tier3: 20FPS・WebGL・基本品質・最小限機能
└─ [ ] メモリ効率・300MB以下・リーク防止・長時間安定
```

## 🔄 Phase1→Phase2移行準備

### Phase2実装予定・PixiV8Chrome拡張
```
📋 Phase2: 機能拡充・実用化（3-4週間）:
1. PixiV8ChromeLayerController.ts - Container階層・20レイヤー管理
2. PixiV8ChromeToolController.ts - ツール統合・設定永続化
3. PixiV8ChromeBrushTool.ts - 筆ツール・テクスチャ描画
4. PixiV8ChromeEraserTool.ts - 消しゴム強化・選択削除
5. PixiV8ChromeFillTool.ts - 塗りつぶし・フラッドフィル
6. PixiV8ChromeShapeTool.ts - 図形ツール・幾何描画
7. PixiV8ChromeExportProcessor.ts - PNG/JPEG・2K対応
8. PixiV8ChromeSettingsStore.ts - 設定永続化・ユーザー設定

📊 Phase2成功基準:
├─ 実用的描画ツール・日常使用可能・基本機能完備
├─ レイヤー階層管理・表示制御・透明度・ブレンドモード
├─ ファイル保存読み込み・エクスポート・PNG/JPEG対応
└─ 設定保存・ツール設定・UI設定・永続化・復元
```

### 継続的品質保証・Claude協業
```
✅ 開発効率最大化:
├─ 責任分界明確・1クラス1機能・Claude理解容易
├─ 命名規約統一・PixiV8Chrome*・技術スタック明示
├─ インターフェース先行・API設計→実装・契約明確
└─ 段階的実装・Phase完了確認→次Phase・品質優先

✅ 技術的一貫性:
├─ PixiJS v8統合パッケージ・WebGPU対応・Container活用
├─ Tier戦略・段階的縮退・環境適応・Chrome API統合
├─ ふたば色システム・2.5K最適化・アクセシビリティ
└─ TypeScript厳格・ESM・Vite・モダン開発環境
```

---

**このv4.2実装ガイドにより、PixiV8Chrome統合基盤の確実な構築と、Claude実装効率の最大化、責任分界の明確化を実現します。Phase1完了後、品質確認を経てPhase2機能拡充に進みます。**