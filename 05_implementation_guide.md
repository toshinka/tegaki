# 実装ガイド・段階的開発 v4.0

**ドキュメント**: 実装手順・作業指示書  
**バージョン**: v4.0.0  
**最終更新**: 2025年8月4日  
**対象読者**: 実装担当者・Claude・プロジェクトマネージャー

## 🎯 実装戦略・Phase展開

### 全体方針・2.5K液タブレット最適化

#### **段階的品質保証・確実実装**
```
Phase1: 基盤構築・MVP実装 (2-3週間)
✅ WebGPU初期化・フォールバック・120FPS基盤
✅ 基本描画・ペン・消しゴム・色選択
✅ 2.5K UI・ふたば色・56px アイコン
✅ マウス・ペンタブレット・基本入力処理

Phase2: 機能拡充・実用化 (3-4週間)
🔵 高度ツール・筆・図形・塗りつぶし
🔵 レイヤー強化・50枚・ブレンドモード
🔵 エクスポート・PNG/JPEG・4K対応
🔵 設定・カスタマイズ・2.5K最適化

Phase3: 高性能化・最適化 (2-3週間)
🔵 WebGPU Compute Shader・GPU並列処理
🔵 4K対応・大容量メモリ・2GB管理
🔵 120FPS安定・遅延最小化・液タブレット最適化
🔵 パフォーマンス監視・自動調整

Phase4: 完成度・先進機能 (4-5週間)
🔵 高度エフェクト・フィルター・GPU加速
🔵 アニメーション・オニオンスキン・タイムライン
🔵 UI完成度・カスタマイズ・アクセシビリティ
🔵 プラグイン・拡張性・API公開
```

#### **Claude協業・実装効率化**
```
責任分界明確化:
├─ システム設計: インターフェース定義・契約明確化
├─ コア実装: 基盤クラス・重要機能・品質優先
├─ UI実装: 見た目・操作性・ユーザビリティ
└─ 統合・テスト: 動作確認・性能測定・調整

段階的詳細化:
├─ Phase毎仕様確定: 実装前詳細設計
├─ インターフェース先行: API・イベント定義
├─ 実装・テスト・統合: 品質確保・動作確認
└─ フィードバック・改善: 継続的品質向上
```

## 🚀 Phase1実装・基盤構築

### 実装優先順序・依存関係

#### **Step 1.1: プロジェクト基盤・環境構築**
```bash
# プロジェクト初期化・Vite + TypeScript
npm create vite@latest modern-drawing-tool -- --template vanilla-ts
cd modern-drawing-tool

# 依存関係インストール・PixiJS v8統合
npm install pixi.js@8.11.0
npm install @types/node
npm install --save-dev typescript@5.0+

# 開発環境・品質ツール
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier
npm install --save-dev vite-plugin-checker

# 2.5K液タブレット対応・設定
# vite.config.ts - 高解像度・最適化設定
```

#### **Step 1.2: ディレクトリ構成・ファイル作成**
```
src/
├── main.ts                     # エントリーポイント・アプリ起動
├── style.css                   # 基本CSS・ふたば色定義
├── core/                       # 基盤システム
│   ├── PixiApplication.ts        # PixiJS初期化・WebGPU制御
│   ├── EventBus.ts              # イベント管理・型安全通信
│   ├── DrawingEngine.ts         # 描画統合・ツール制御
│   └── PerformanceManager.ts    # 性能監視・メモリ管理
├── input/                      # 入力処理・デバイス対応
│   ├── InputManager.ts          # マウス・ペンタブレット統合
│   └── ShortcutManager.ts       # キーボード・ペンボタン
├── tools/                      # ツールシステム
│   ├── ToolManager.ts           # ツール管理・切り替え
│   ├── PenTool.ts              # ペンツール・基本線描画
│   └── EraserTool.ts           # 消しゴムツール・削除
├── ui/                         # UI制御・2.5K最適化
│   ├── UIManager.ts             # UI統合管理・ふたば色
│   ├── Toolbar.ts              # ツールバー・56pxアイコン
│   └── ColorPalette.ts         # 色選択・HSV円形ピッカー
├── constants/                  # 定数・設定
│   ├── ui-constants.ts         # UI定数・2.5K サイズ
│   └── drawing-constants.ts    # 描画定数・性能設定
└── types/                      # 型定義・TypeScript
    ├── drawing.types.ts        # 描画関連・インターフェース
    └── ui.types.ts            # UI関連・イベント定義
```

### Step 1.3: 基盤システム実装

#### **PixiApplication.ts - WebGPU初期化・フォールバック**
```typescript
// 実装指示: WebGPU優先・段階的縮退・2.5K対応
export class PixiApplication {
  private pixiApp: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: 'webgpu' | 'webgl2' | 'webgl' = 'webgpu';
  
  // 初期化・WebGPU検出・フォールバック処理
  public async initialize(container: HTMLElement): Promise<boolean>
  
  // 2560×1440対応・高解像度・デバイスピクセル比
  private getOptimalSize(): { width: number; height: number }
  
  // レンダラー種別取得・性能調整・品質設定
  public getRendererType(): string
  
  // WebGPUフォールバック・自動切り替え・エラー処理
  private async initializeWebGL2(): Promise<void>
  
  // Canvas取得・DOM統合・イベント設定
  public getCanvas(): HTMLCanvasElement | null
  
  // アプリケーション取得・PixiJS操作・統合制御
  public getApp(): PIXI.Application | null
  
  // 破棄・クリーンアップ・メモリ解放
  public destroy(): void
}

// 実装例・基本構造:
/*
const pixiApp = new PixiApplication();
await pixiApp.initialize(document.getElementById('app'));
console.log('Renderer:', pixiApp.getRendererType()); // 'webgpu' or 'webgl2'
*/
```

#### **EventBus.ts - イベント管理・型安全通信**
```typescript
// 実装指示: 型安全・疎結合・高性能イベントシステム
export interface IEventData {
  // 描画イベント
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  
  // ツールイベント
  'tool:change': { toolName: string; settings: any };
  'tool:setting-update': { setting: string; value: any };
  
  // UI イベント
  'ui:toolbar-click': { tool: string };
  'ui:color-change': { color: number };
  'ui:show-panel': { panel: string };
  
  // 性能イベント・2GB制限対応
  'performance:low-fps': number;
  'performance:memory-warning': { used: number; limit: number };
  'performance:memory-critical': { used: number; limit: number };
}

export class EventBus {
  private listeners: Map<keyof IEventData, Set<Function>> = new Map();
  private eventHistory: Array<{ event: string; timestamp: number }> = [];
  
  // イベント登録・型安全・リスナー管理
  public on<K extends keyof IEventData>(
    event: K, 
    callback: (data: IEventData[K]) => void
  ): () => void
  
  // イベント発火・型安全・データ検証
  public emit<K extends keyof IEventData>(
    event: K, 
    data: IEventData[K]
  ): void
  
  // イベント削除・メモリリーク防止
  public off<K extends keyof IEventData>(
    event: K, 
    callback: (data: IEventData[K]) => void
  ): void
  
  // 履歴取得・デバッグ支援・監視
  public getEventHistory(): Array<{ event: string; timestamp: number }>
  
  // クリーンアップ・メモリ解放
  public destroy(): void
}
```

#### **DrawingEngine.ts - 描画統合・ツール制御**
```typescript
// 実装指示: PixiJS Graphics活用・120FPS描画・メモリ効率
export class DrawingEngine {
  private pixiApp: PIXI.Application;
  private eventBus: EventBus;
  private currentTool: IDrawingTool | null = null;
  private isDrawing: boolean = false;
  private currentStroke: PIXI.Graphics | null = null;
  
  // 初期化・PixiJS統合・イベント設定
  constructor(pixiApp: PIXI.Application, eventBus: EventBus)
  
  // 描画開始・ストローク初期化・GPU最適化
  public startDrawing(data: IEventData['drawing:start']): void
  
  // 描画継続・点追加・スムージング・ベジエ曲線補間
  public continueDrawing(data: IEventData['drawing:move']): void
  
  // 描画終了・ストローク確定・メモリ最適化
  public endDrawing(data: IEventData['drawing:end']): void
  
  // ツール設定・切り替え・状態管理
  public setCurrentTool(tool: IDrawingTool): void
  
  // スムージング処理・手ブレ軽減・自然な線
  private applySmoothingToStroke(points: PIXI.Point[]): PIXI.Point[]
  
  // GPU最適化・Batch処理・Draw Call削減
  private optimizeGraphicsForGPU(graphics: PIXI.Graphics): void
  
  // メモリ管理・古いストローク削除・GC対応
  private cleanupOldStrokes(): void
}
```

### Step 1.4: 入力システム実装

#### **InputManager.ts - マウス・ペンタブレット統合**
```typescript
// 実装指示: Pointer Events・高精度・2.5K座標系対応
export class InputManager {
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement;
  private isPointerDown: boolean = false;
  private lastPointer: PointerEvent | null = null;
  private pressureHistory: number[] = []; // 筆圧スムージング
  
  // 初期化・イベント設定・デバイス検出
  constructor(eventBus: EventBus, canvas: HTMLCanvasElement)
  
  // Pointer Events設定・統合処理・デバイス抽象化
  private setupPointerEvents(): void
  
  // ポインター開始・描画開始・筆圧取得
  private onPointerDown(event: PointerEvent): void
  
  // ポインター移動・描画継続・座標変換・フィルタリング
  private onPointerMove(event: PointerEvent): void
  
  // ポインター終了・描画終了・後処理
  private onPointerUp(event: PointerEvent): void
  
  // 座標変換・スクリーン→キャンバス・2.5K対応・サブピクセル精度
  private screenToCanvas(screenX: number, screenY: number): PIXI.Point
  
  // 筆圧処理・スムージング・自然な変化
  private processPressure(rawPressure: number): number
  
  // 速度計算・描画表現・動的効果
  private calculateVelocity(currentEvent: PointerEvent): number
  
  // デバイス判別・マウス・ペン・設定調整
  private getPointerDeviceType(pointerType: string): 'mouse' | 'pen'
}
```

### Step 1.5: ツールシステム実装

#### **ToolManager.ts - ツール管理・切り替え制御**
```typescript
// 実装指示: ツール統合・状態管理・設定永続化
export interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  // ツールアクティブ化・設定適用・UI更新
  activate(): void;
  
  // ツール非アクティブ化・状態保存・クリーンアップ
  deactivate(): void;
  
  // 描画イベント処理・ツール固有ロジック
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  
  // 設定取得・UI表示・カスタマイズ
  getSettings(): any;
  
  // 設定更新・即座反映・永続化
  updateSettings(settings: Partial<any>): void;
}

export class ToolManager {
  private eventBus: EventBus;
  private tools: Map<string, IDrawingTool> = new Map();
  private currentTool: IDrawingTool | null = null;
  private toolHistory: string[] = []; // ツール履歴
  
  // 初期化・イベント登録・デフォルトツール
  constructor(eventBus: EventBus)
  
  // ツール登録・プラグイン対応・動的追加
  public registerTool(tool: IDrawingTool): void
  
  // ツール切り替え・状態管理・UI更新
  public switchTool(toolName: string): boolean
  
  // 現在ツール取得・状態確認
  public getCurrentTool(): IDrawingTool | null
  
  // ツール一覧取得・UI構築・カテゴリ分類
  public getAvailableTools(): Array<{ name: string; icon: string; category: string }>
  
  // 設定保存・LocalStorage・永続化
  private saveToolSettings(): void
  
  // 設定読み込み・起動時復元・デフォルト値
  private loadToolSettings(): void
}
```

#### **PenTool.ts - ペンツール・基本線描画**
```typescript
// 実装指示: 基本描画・PixiJS Graphics・スムージング
export class PenTool implements IDrawingTool {
  public readonly name = 'pen';
  public readonly icon = 'ti ti-pencil';
  public readonly category = 'drawing' as const;
  
  private settings = {
    size: 4,           // ペンサイズ・1-200px
    opacity: 0.8,      // 不透明度・0.0-1.0
    color: 0x800000,   // ふたば maroon
    smoothing: true,   // スムージング有効
    pressureSensitive: true // 筆圧感度
  };
  
  private currentGraphics: PIXI.Graphics | null = null;
  private strokePoints: PIXI.Point[] = [];
  
  // ツールアクティブ化・UI更新・カーソル変更
  public activate(): void
  
  // ツール非アクティブ化・状態保存
  public deactivate(): void
  
  // 描画開始・Graphics作成・初期点設定
  public onPointerDown(event: IEventData['drawing:start']): void
  
  // 描画継続・点追加・リアルタイム描画・120FPS対応
  public onPointerMove(event: IEventData['drawing:move']): void
  
  // 描画終了・ストローク確定・最適化
  public onPointerUp(event: IEventData['drawing:end']): void
  
  // 設定取得・UI表示用
  public getSettings(): typeof this.settings
  
  // 設定更新・即座反映・プレビュー更新
  public updateSettings(newSettings: Partial<typeof this.settings>): void
  
  // 筆圧対応サイズ計算・自然な変化
  private calculateBrushSize(pressure: number): number
  
  // スムージング適用・ベジエ曲線・手ブレ軽減
  private applySmoothingToPoints(points: PIXI.Point[]): PIXI.Point[]
}
```

### Step 1.6: UI システム実装

#### **UIManager.ts - UI統合管理・ふたば色システム**
```typescript
// 実装指示: 2.5K最適化・ふたば色・レスポンシブ対応
export class UIManager {
  private eventBus: EventBus;
  private rootElement: HTMLElement;
  private toolbar: Toolbar | null = null;
  private colorPalette: ColorPalette | null = null;
  private panels: Map<string, HTMLElement> = new Map();
  
  // 初期化・DOM構築・2.5K レイアウト
  constructor(eventBus: EventBus, rootElement: HTMLElement)
  
  // 基本UI初期化・Phase1必要最小限
  public async initializeBasicUI(): Promise<void>
  
  // ツールバー作成・56px アイコン・縦配置
  private createToolbar(): void
  
  // カラーパレット作成・200px HSV・ふたば色プリセット
  private createColorPalette(): void
  
  // キャンバス領域作成・中央配置・描画領域
  private createCanvasArea(): void
  
  // CSS適用・ふたば色変数・2.5K最適化
  private applyCSSVariables(): void
  
  // レスポンシブ対応・画面サイズ変更・レイアウト調整
  private handleResize(): void
  
  // パネル表示・非表示・Z-index管理
  public showPanel(panelName: string): void
  public hidePanel(panelName: string): void
  
  // テーマ適用・ふたば色・ダークモード対応
  public applyTheme(theme: 'futaba' | 'dark' | 'light'): void
}
```

#### **Toolbar.ts - ツールバー・56pxアイコン・縦配置**
```typescript
// 実装指示: 大型アイコン・2.5K表示・視覚的階層・ホバー効果
export class Toolbar {
  private eventBus: EventBus;
  private element: HTMLElement;
  private toolButtons: Map<string, HTMLButtonElement> = new Map();
  private activeToolName: string = 'pen';
  
  // 初期化・DOM作成・イベント設定
  constructor(eventBus: EventBus, container: HTMLElement)
  
  // ToolManager連携・利用可能ツール取得・ボタン生成
  public updateAvailableTools(tools: Array<{ name: string; icon: string; category: string }>): void
  
  // ツールボタン作成・56px・ホバー効果・アクティブ状態
  private createToolButton(tool: { name: string; icon: string; category: string }): HTMLButtonElement
  
  // アクティブツール変更・視覚的フィードバック・状態更新
  public setActiveTool(toolName: string): void
  
  // ボタンクリック処理・ツール切り替え・イベント発火
  private onToolButtonClick(toolName: string): void
  
  // アイコン設定・Tabler Icons・CSS適用
  private setButtonIcon(button: HTMLButtonElement, iconClass: string): void
  
  // グループ分離線・視覚的分類・カテゴリ別配置
  private addGroupSeparator(): void
  
  // CSS クラス適用・ふたば色・2.5K最適化
  private applyToolbarStyles(): void
}

// CSS 例 (style.css に追加):
/*
.toolbar {
  width: 80px;
  background: var(--futaba-cream);
  border-right: 1px solid var(--futaba-light);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
}

.toolbar-button {
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
}

.toolbar-button:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
}

.toolbar-button.active {
  background: var(--futaba-maroon);
  color: white;
  border-color: var(--futaba-maroon);
}

.toolbar-button i {
  font-size: 24px;
}
*/
```

#### **ColorPalette.ts - 色選択・HSV円形・200px**
```typescript
// 実装指示: HSV円形ピッカー・PixiJS描画・ふたば色プリセット・2.5K対応
export class ColorPalette {
  private eventBus: EventBus;
  private element: HTMLElement;
  private pixiApp: PIXI.Application | null = null;
  private colorWheel: PIXI.Graphics | null = null;
  private currentColor: number = 0x800000; // ふたば maroon
  private isSelecting: boolean = false;
  
  // 初期化・DOM作成・PixiJS統合・HSVピッカー
  constructor(eventBus: EventBus, container: HTMLElement)
  
  // HSV カラーホイール作成・PixiJS Graphics・GPU描画
  private createColorWheel(): void
  
  // ふたば色プリセット作成・32px スウォッチ・クリック対応
  private createFutabaPresets(): void
  
  // 色選択処理・マウス・座標変換・HSV計算
  private onColorWheelClick(event: PIXI.FederatedPointerEvent): void
  
  // HSV→RGB変換・色空間変換・精密計算
  private hsvToRgb(h: number, s: number, v: number): number
  
  // RGB→HSV変換・逆変換・現在色表示
  private rgbToHsv(color: number): { h: number; s: number; v: number }
  
  // 現在色更新・UI反映・イベント発火
  public setCurrentColor(color: number): void
  
  // 色履歴管理・最近使用色・20色保存
  private addToColorHistory(color: number): void
  
  // プリセット色定義・ふたば色系統
  private getFutabaColorPresets(): number[]
}

// HSV カラー計算・実装例:
/*
private hsvToRgb(h: number, s: number, v: number): number {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  
  return (red << 16) | (green << 8) | blue;
}
*/
```

## 🔧 実装チェックリスト・品質保証

### Phase1完了基準・動作確認

#### **機能要件チェック**
```
✅ 基盤システム動作確認:
├─ WebGPU初期化成功・フォールバック動作・エラー処理
├─ PixiJS Application起動・Canvas表示・2560×1440対応
├─ EventBus通信・型安全・イベント発火/受信
└─ PerformanceManager監視・FPS計測・メモリ警告

✅ 入力システム動作確認:
├─ マウス入力・座標取得・描画開始/継続/終了
├─ ペンタブレット・筆圧取得・傾き検出・サイドボタン
├─ キーボードショートカット・ツール切り替え・操作
└─ 座標変換精度・2.5K対応・サブピクセル精度

✅ 描画システム動作確認:
├─ ペンツール描画・滑らかな線・スムージング
├─ 消しゴムツール・削除機能・透明化処理
├─ 色変更反映・リアルタイム・視覚確認
└─ Graphics最適化・GPU活用・60FPS以上

✅ UI システム動作確認:
├─ ツールバー表示・56pxアイコン・クリック反応
├─ カラーパレット・HSV選択・ふたば色プリセット
├─ レイアウト適用・2.5K表示・ふたば色統合
└─ レスポンシブ対応・画面サイズ変更・レイアウト調整
```

#### **性能要件チェック・2.5K環境**
```
🎯 120FPS目標・パフォーマンス確認:
├─ WebGPU環境: 120FPS安定・遅延3ms以下
├─ WebGL2環境: 60FPS安定・遅延8ms以下
├─ メモリ使用量: 500MB以下・警告システム動作
└─ CPU使用率: 平均40%以下・最大70%以下

🎯 液タブレット最適化確認:
├─ 筆圧感度: 0-1.0範囲・自然な太さ変化
├─ 座標精度: サブピクセル・正確な位置
├─ 遅延最小化: 入力→描画3ms以内
└─ サイドボタン: ツール切り替え・ショートカット

🎯 メモリ効率・安定性確認:
├─ 長時間描画: 30分連続・メモリリークなし
├─ 大量ストローク: 1000ストローク・性能維持
├─ ガベージコレクション: 自動実行・メモリ回収
└─ エラー処理: 例外捕捉・安定動作・復旧機能
```

### Phase1→Phase2移行判断

#### **移行可否判定基準**
```
✅ 必須クリア項目:
├─ 基本描画機能: ペン・消しゴム・色選択・動作確認
├─ 入力処理安定: マウス・ペンタブレット・エラーなし
├─ UI基本動作: ツールバー・カラーパレット・操作可能
├─ 性能基準達成: 60FPS以上・メモリ500MB以下
└─ エラー処理: 例外処理・安定動作・復旧機能

🔵 推奨クリア項目:
├─ WebGPU対応: 正常動作・120FPS達成・GPU活用
├─ 2.5K最適化: 高解像度表示・UI適正サイズ・視認性
├─ コード品質: TypeScript厳格・ESLint準拠・可読性
├─ ドキュメント: 実装記録・設計意図・継承情報
└─ テスト実装: 基本テスト・動作確認・品質保証

⚠️ 移行延期判断:
├─ 重大バグ: 描画不能・クラッシュ・データ損失
├─ 性能不足: 30FPS未満・応答遅延500ms以上
├─ メモリリーク: 継続的増加・GC効果なし・不安定
└─ 基本機能欠如: ペン描画不可・色選択不可・UI操作不可
```

---

**このPhase1実装ガイドに従って、確実で高品質な基盤システムを構築します。各実装項目は段階的に検証し、次フェーズへの確実な移行を保証します。**