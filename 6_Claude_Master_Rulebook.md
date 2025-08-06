# Claude Master Rulebook v4.2

**ドキュメント**: 改修・追加実装用マスタールール集  
**対象読者**: 別チャットClaude・保守開発者・機能拡張者  
**適用フェーズ**: 実装完了後の改修・機能追加・バグ修正・最適化  
**最終更新**: 2025年8月6日

## 🎯 このルールブックの目的

### 使用場面・タイミング
```
✅ 以下の作業時に必須参照:
├─ 既存機能の改修・バグ修正・動作不良対応
├─ 新機能追加・Phase3以降・高度機能実装
├─ 性能最適化・メモリ効率化・描画速度向上
├─ UI/UX改善・レスポンシブ対応・アクセシビリティ強化
└─ コードリファクタリング・構造改善・保守性向上

📋 このルールブック単独で必要な情報:
├─ プロジェクト全体の技術制約・変更不可事項
├─ アーキテクチャ・設計思想・責任分界
├─ ディレクトリ構造・命名規則・シンボル定義
├─ コーディング規約・品質基準・禁止パターン
└─ 改修時の注意事項・テスト要件・品質保証
```

## 🚫 絶対変更禁止事項（プロジェクト憲章）

### 対象環境・技術制約（不変）
```
🎯 対象環境（成功の大前提・変更厳禁）:
デバイス環境:
├─ 2560×1440液晶タブレット環境特化設計
├─ マウス・ペンタブレット対応（筆圧・傾き・サイドボタン）
├─ 16GB+メモリ・高性能GPU環境前提
└─ デスクトップ・ワークステーション専用

ブラウザ環境:
├─ Chrome/Edge最新版WebGPU対応（Tier1・60%ユーザー）
├─ Firefox/Safari WebGL2対応（Tier2・35%ユーザー）  
├─ 旧ブラウザWebGL基本対応（Tier3・5%ユーザー）
└─ Internet Explorer・古いモバイルブラウザ完全非対応

❌ 完全非対応（開発効率・品質優先）:
├─ タッチ・ジェスチャー操作（Y軸問題・デバッグ困難）
├─ モバイル・スマートフォン（画面サイズ制約）
├─ 1920×1080以下UI（2.5K環境最適化優先）
└─ Canvas2D・WebGL v1（性能・機能制約）
```

### 技術スタック・基盤技術（不変）
```
🏗️ Core Technology Stack（変更禁止）:
描画エンジン:
├─ PixiJS v8.11.0統一基盤（個別パッケージ使用禁止）
├─ WebGPU優先・WebGL2フォールバック・段階的縮退戦略
├─ Container階層管理・Graphics最適化・GPU並列処理
└─ Compute Shader活用・OffscreenCanvas・WebCodecs統合

開発環境:
├─ TypeScript 5.0+厳格モード（noImplicitAny: true）
├─ Vite最新版（ESM・Tree Shaking・Hot Reload）
├─ ESModules統一（CommonJS使用禁止）
└─ Node.js 18+ LTS・npm/yarn・モダン開発環境

設計思想:
├─ EventBus中心疎結合アーキテクチャ（型安全通信）
├─ 単一責任原則厳守（1クラス1機能・Claude理解容易）
├─ インターフェース先行設計（契約明確・実装分離）
└─ 段階的実装戦略（Phase1-4・確実→理想）
```

### 色彩システム・UI設計（不変）
```
🎨 ふたば色デザインシステム（変更厳禁）:
基調色（ふたばちゃんねる由来）:
├─ --futaba-maroon: #800000（メイン・強調・重要操作）
├─ --futaba-light-maroon: #aa5a56（セカンダリ・ホバー効果）
├─ --futaba-medium: #cf9c97（アクセント・境界表現）
├─ --futaba-light: #e9c2ba（境界・分離線・非アクティブ）
├─ --futaba-cream: #f0e0d6（パネル背景・UI基調）
└─ --futaba-background: #ffffee（キャンバス・作業領域）

レイアウト構成（Grid・固定比率）:
├─ メインレイアウト: 80px（Toolbar）|1fr（Canvas）|400px（LayerPanel）
├─ ツールボタン: 56px×56px（2.5K環境最適化）
├─ レイヤー項目: 400px幅×64px高（一覧性・操作性）
└─ 色パレット: 200px円形HSV・32px色見本

アクセシビリティ（WCAG 2.1 AAA）:
├─ コントラスト比4.5:1以上確保・色覚バリアフリー
├─ キーボード操作全機能対応・スクリーンリーダー対応
├─ フォーカス表示明確・高コントラストモード対応
└─ 色のみ依存禁止・形状・位置・テキスト併用
```

## 🏗️ アーキテクチャ・設計原則

### ディレクトリ構成（確定版・変更不可）
```
src/
├── main.ts                         # エントリーポイント・アプリ起動統合
├── style.css                       # 基本CSS・ふたば色定義・2.5K最適化
├── core/                           # 基盤システム・アプリケーション中核
│   ├── PixiApplication.ts            # PixiJS初期化・WebGPU制御・フォールバック
│   ├── EventBus.ts                  # 型安全イベント通信・疎結合・デバッグ支援
│   ├── DrawingEngine.ts             # 描画統合・ツール制御・Graphics管理
│   └── PerformanceManager.ts        # 性能監視・メモリ管理・1GB制限・動的調整
├── rendering/                      # レンダリング層・GPU最適化・描画処理
│   ├── LayerManager.ts              # 20レイヤー管理・Container階層・Z-index
│   ├── WebGPURenderer.ts            # WebGPU専用処理・Compute Shader・並列
│   ├── CanvasManager.ts             # 4K対応・座標変換・Viewport・デバイス対応
│   └── TextureManager.ts            # GPUメモリ・Atlas統合・圧縮・効率化
├── input/                          # 入力処理・デバイス統合・高精度対応
│   ├── InputManager.ts              # 統合入力・Pointer Events・筆圧対応
│   ├── PointerProcessor.ts          # 筆圧・傾き・座標変換・2.5K精度・補正
│   └── ShortcutManager.ts           # キーボード・ペンサイドボタン・カスタム
├── tools/                          # ツールシステム・段階実装・機能拡張
│   ├── ToolManager.ts               # ツール統合・状態管理・設定永続化
│   ├── PenTool.ts                  # ペン・基本線描画・Phase1基盤
│   ├── BrushTool.ts                # 筆・テクスチャ・Phase2拡張
│   ├── EraserTool.ts               # 消しゴム・削除・Phase1基盤
│   ├── FillTool.ts                 # 塗りつぶし・フラッドフィル・Phase2
│   ├── ShapeTool.ts                # 図形・直線・矩形・円・Phase2
│   └──IDrawingTool.ts              # ツール統一インターフェース・契約定義・曖昧さ完全排除
├── ui/                             # UI制御・2.5K最適化・ふたば色統合
│   ├── UIManager.ts                 # UI統合・レスポンシブ・レイアウト管理
│   ├── Toolbar.ts                  # ツールバー・80px幅・56pxアイコン
│   ├── ColorPalette.ts             # HSV円形・200px・ふたば色プリセット
│   └── LayerPanel.ts               # レイヤー・400px幅・64px項目・階層表示
├── constants/                      # 定数・設定・環境依存値
│   ├── ui-constants.ts             # UI定数・サイズ・色・レイアウト比率
│   ├── drawing-constants.ts        # 描画定数・性能・ブラシサイズ・制限値
│   └── performance-constants.ts    # 性能定数・制限値・警告閾値・監視設定
└── types/                          # 型定義・TypeScript・契約定義
    ├── drawing.types.ts            # 描画関連・ツール・レイヤー型・インターフェース
    ├── ui.types.ts                # UI関連・イベント・状態型・コンポーネント
    └── performance.types.ts        # 性能関連・監視・メトリクス型・測定
```

### モジュール責任・責任分界明確化
```typescript
// ===== Core Layer - 基盤システム =====
// PixiApplication.ts - アプリケーション基盤・初期化制御
export class PixiApplication {
  // WebGPU検出・初期化・フォールバック処理・エラー処理
  public async initialize(container: HTMLElement): Promise<boolean>
  
  // 段階的縮退戦略・Tier1-3自動選択・性能適応
  private detectOptimalTier(): Promise<'webgpu'|'webgl2'|'webgl'>
  
  // 2560×1440対応・デバイスピクセル比・高解像度設定
  private getOptimalCanvasSize(): { width: number; height: number }
}

// EventBus.ts - 型安全イベント通信・疎結合アーキテクチャ
interface IEventData {
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  'tool:change': { toolName: string; settings: any };
  'layer:create': { layerId: string; name: string; index: number };
  'layer:delete': { layerId: string; index: number };
  'performance:warning': { type: string; current: number; limit: number };
  'ui:color-change': { color: number; alpha: number };
  'export:complete': { format: string; size: number; url: string };
}

export class EventBus {
  // 型安全リスナー登録・自動解除・メモリリーク防止
  public on<K extends keyof IEventData>(event: K, callback: Function): () => void
  
  // 型安全イベント発火・データ検証・エラーハンドリング
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void
  
  // イベント履歴・デバッグ支援・開発効率化
  public getEventHistory(): Array<{ event: string; timestamp: number }>
}

// ===== Rendering Layer - 描画・GPU最適化 =====
// LayerManager.ts - Container階層・20レイヤー管理・Z-index制御
export class LayerManager {
  // Container階層管理・動的Z-index・表示制御
  public createLayer(name: string, type: 'raster'|'vector'): string
  public moveLayer(layerId: string, newIndex: number): void
  public setLayerVisibility(layerId: string, visible: boolean): void
  
  // ブレンドモード・透明度・エフェクト
  public setLayerBlendMode(layerId: string, mode: PIXI.BlendModes): void
  public setLayerOpacity(layerId: string, opacity: number): void
}

// ===== Tools Layer - ツールシステム・機能拡張 =====
// 共通ツールインターフェース・統一API・拡張容易
interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  readonly phase: 1 | 2 | 3 | 4; // 実装Phase・段階判定
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  getSettings(): ToolSettings;
  updateSettings(settings: Partial<ToolSettings>): void;
}
```

### EventBus通信・疎結合設計
```typescript
// イベントフロー・責任分界・データ流れ
/*
Input Layer → EventBus → Drawing Engine → Rendering Layer
     ↓              ↓              ↓              ↓
UI Components → Tool Manager → Layer Manager → Canvas Display

疎結合原則:
├─ 直接参照禁止・EventBus経由通信必須
├─ 型安全・IEventData準拠・データ検証
├─ エラー伝播防止・try-catch・ログ出力
└─ デバッグ支援・イベント履歴・状態追跡
*/

// 典型的なイベントフロー例
class ExampleImplementation {
  constructor(eventBus: EventBus) {
    // リスナー登録・自動解除対応
    const unsubscribe = eventBus.on('drawing:start', (data) => {
      // 型安全・自動補完・エラー検出
      console.log(`Drawing started at: ${data.point.x}, ${data.point.y}`);
      console.log(`Pressure: ${data.pressure}, Type: ${data.pointerType}`);
    });
    
    // クリーンアップ時の解除
    this.cleanup = unsubscribe;
  }
  
  public startDrawing(): void {
    // イベント発火・データ検証・エラーハンドリング
    this.eventBus.emit('drawing:start', {
      point: new PIXI.Point(100, 100),
      pressure: 0.8,
      pointerType: 'pen'
    });
  }
}
```

## 📏 コーディング規約・品質基準

### 命名規則・シンボル規約（厳格遵守）
```typescript
// ===== クラス命名規則・責任明確化 =====
✅ 推奨命名パターン:
├─ *Manager.ts    - 複数リソース管理・統合制御（LayerManager, ToolManager）
├─ *Engine.ts     - 基盤処理・中核ロジック（DrawingEngine）
├─ *Processor.ts  - データ処理・変換・最適化（PointerProcessor）
├─ *Renderer.ts   - 描画・表示・GPU処理（WebGPURenderer）
├─ *Controller.ts - 制御・調整・状態管理（UIController）

❌ 禁止命名パターン:
├─ *Helper.ts     - 責任不明・目的曖昧
├─ *Util.ts       - 機能散漫・保守困難  
├─ *Service.ts    - DI以外で使用禁止
├─ *Handler.ts    - 処理内容不明確
└─ Base*.ts       - 継承階層複雑化

// ===== メソッド・変数命名 =====
✅ 推奨パターン:
├─ 動詞始まり: createLayer(), updateTool(), renderFrame()
├─ boolean: isActive, hasTexture, canRender
├─ 配列: layers, tools, events（複数形）
├─ 定数: MAX_LAYER_COUNT, DEFAULT_BRUSH_SIZE（UPPER_SNAKE_CASE）

❌ 禁止パターン:
├─ 省略形: mgr, ctrl, proc（理解困難）
├─ 数値終端: layer1, tool2（動的アクセス困難）
├─ 曖昧名: data, info, temp（内容不明）
└─ Hungarian記法: strName, intCount（TypeScript不要）
```

### TypeScript厳格設定（コンパイラ設定）
```json
// tsconfig.json - 厳格型チェック・エラー防止
{
  "compilerOptions": {
    "strict": true,                    // 厳格モード有効
    "noImplicitAny": true,            // any型禁止・明示的型指定必須
    "noImplicitReturns": true,        // 戻り値必須・undefined防止
    "noUnusedLocals": true,           // 未使用変数エラー・コード整理
    "noUnusedParameters": true,       // 未使用引数エラー・インターフェース整合
    "exactOptionalPropertyTypes": true, // オプション型厳格・undefined区別
    "noImplicitOverride": true,       // override明示必須・意図明確化
    "noPropertyAccessFromIndexSignature": true, // プロパティアクセス厳格

    // ES2022対応・最新機能活用
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // インポート・エクスポート設定
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}

// ESLint設定 - コード品質・一貫性確保
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "max-lines-per-function": ["warn", 50],
    "max-params": ["warn", 4],
    "complexity": ["warn", 10]
  }
}
```

### メソッド設計・関数品質（保守性優先）
```typescript
// ===== 推奨メソッド設計パターン =====
export class ExampleClass {
  // ✅ 推奨: 単一責任・明確な目的・戻り値型明示
  public async createNewLayer(
    name: string, 
    type: LayerType = 'raster',
    options: LayerOptions = {}
  ): Promise<LayerId> {
    // 入力検証・エラー処理・早期return
    if (!name || name.trim().length === 0) {
      throw new Error('Layer name is required and cannot be empty');
    }
    
    if (this.layers.length >= MAX_LAYER_COUNT) {
      throw new Error(`Maximum layer count (${MAX_LAYER_COUNT}) exceeded`);
    }
    
    try {
      // メイン処理・例外安全・ログ出力
      const layerId = this.generateLayerId();
      const layer = new Layer(layerId, name, type, options);
      
      this.layers.push(layer);
      this.eventBus.emit('layer:create', { layerId, name, index: this.layers.length - 1 });
      
      console.log(`Layer created: ${name} (${layerId})`);
      return layerId;
      
    } catch (error) {
      console.error('Failed to create layer:', error);
      throw new Error(`Layer creation failed: ${error.message}`);
    }
  }
  
  // ❌ 禁止: 複数責任・戻り値型不明・エラー処理なし
  public doLayerStuff(data: any) {
    // 複数機能混在・保守困難・エラー伝播
    const layer = data.layer;
    layer.name = data.name;
    this.updateUI();
    this.saveToStorage();
    return layer.id;
  }
}

// ===== 関数型・Pure Function推奨 =====
// ✅ Pure Function - 副作用なし・テスト容易・予測可能
export function calculateBrushSize(
  pressure: number, 
  baseSize: number, 
  pressureMultiplier: number = 0.8
): number {
  // 入力検証・範囲制限・数値安全
  const clampedPressure = Math.max(0, Math.min(1, pressure));
  const clampedBaseSize = Math.max(1, Math.min(200, baseSize));
  
  // 計算・戻り値保証
  return clampedBaseSize * (0.2 + clampedPressure * pressureMultiplier);
}

// ✅ 高階関数・関数合成・再利用性
export function createThrottledFunction<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCallTime = 0;
  
  return ((...args: Parameters<T>) => {
    const now = performance.now();
    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      fn(...args);
    }
  }) as T;
}
```

## 🛡️ 改修時の必須チェック項目

### 既存機能改修・影響範囲確認
```typescript
// ===== 改修前チェックリスト =====
/*
✅ 必須確認事項:
1. 影響範囲分析:
   ├─ EventBus依存関係・リスナー影響・データフロー変化
   ├─ 型定義変更・IEventData・インターフェース破綻
   ├─ パフォーマンス影響・メモリ使用量・FPS変化
   └─ UI/UX影響・操作性・視覚的変化・アクセシビリティ

2. 互換性確認:
   ├─ 既存ツール・レイヤー・描画機能動作継続性
   ├─ 設定・永続化データ・ユーザーデータ保持
   ├─ エクスポート・インポート機能・ファイル形式
   └─ キーボードショートカット・操作方法・学習コスト

3. 品質基準維持:
   ├─ 60FPS目標・1GB制限・5ms遅延以下維持
   ├─ TypeScript厳格・エラー0・警告0・ESLint準拠
   ├─ WCAG 2.1 AAA・アクセシビリティ・色覚バリアフリー
   └─ ふたば色システム・UI一貫性・視覚的整合性
*/

// ===== 改修時の安全パターン =====
export class SafeModificationExample {
  // ✅ 推奨: 既存メソッド拡張・後方互換性確保
  public updateTool(toolName: string, settings: ToolSettings, options?: UpdateOptions): void {
    // 入力検証・既存データ保護
    if (!this.validateToolName(toolName)) {
      console.warn(`Unknown tool: ${toolName}, skipping update`);
      return;
    }
    
    // 既存設定保持・マージ処理
    const currentSettings = this.getToolSettings(toolName);
    const mergedSettings = { ...currentSettings, ...settings };
    
    // 段階的更新・エラー回復機能
    try {
      this.applyToolSettings(toolName, mergedSettings);
      
      // 新機能・オプション処理
      if (options?.notifyUsers) {
        this.eventBus.emit('tool:setting-update', {
          toolName,
          setting: 'multiple',
          value: mergedSettings
        });
      }
      
    } catch (error) {
      // エラー時・既存設定復元
      console.error(`Tool update failed, reverting: ${error}`);
      this.applyToolSettings(toolName, currentSettings);
      throw error;
    }
  }
  
  // ❌ 危険: 既存メソッド完全置換・破綻リスク
  public updateTool(toolName: string, newCompleteSettings: ToolSettings): void {
    // 既存設定無視・データ消失・機能破綻
    this.tools[toolName] = newCompleteSettings;
  }
}
```

### 新機能追加・拡張方針
```typescript
// ===== 機能追加の安全パターン =====

// ✅ 推奨: インターフェース拡張・段階的追加
interface IDrawingTool {
  // 既存プロパティ・メソッド（変更禁止）
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  
  // 新機能・オプション追加（既存ツール影響なし）
  readonly supportsPressure?: boolean;        // Phase2機能・オプション
  readonly supportsRotation?: boolean;        // Phase3機能・オプション
  readonly supportsMultitouch?: boolean;      // 将来拡張・現在false固定
  
  // 新メソッド・オプション実装（デフォルト動作）
  onPressureChange?(pressure: number): void;          // 実装任意
  onRotationChange?(rotation: number): void;          // 実装任意
  getAdvancedSettings?(): AdvancedToolSettings;      // 実装任意
  setAdvancedSettings?(settings: AdvancedToolSettings): void; // 実装任意
}

// 新ツール実装・段階的機能追加
export class AdvancedBrushTool implements IDrawingTool {
  // 基本機能・Phase1互換
  public readonly name = 'advanced-brush';
  public readonly icon = 'ti-brush-plus';
  public readonly category = 'drawing' as const;
  
  // 新機能・段階的有効化
  public readonly supportsPressure = true;   // Phase2で有効
  public readonly supportsRotation = true;   // Phase3で有効
  public readonly supportsMultitouch = false; // 対象環境外・無効
  
  // 基本実装・既存ツールと同様
  public activate(): void {
    console.log('Advanced brush tool activated');
  }
  
  public deactivate(): void {
    console.log('Advanced brush tool deactivated');
  }
  
  // 新機能・オプション実装
  public onPressureChange(pressure: number): void {
    if (this.supportsPressure) {
      // Phase2実装・筆圧対応ブラシ変形
      this.adjustBrushShape(pressure);
    }
  }
  
  private adjustBrushShape(pressure: number): void {
    // 高度機能・GPU Compute Shader活用予定
    console.log(`Brush shape adjusted for pressure: ${pressure}`);
  }
}

## 📚 シンボル辞書・重要クラス一覧

### Core Layer（基盤システム）
```typescript
// ===== アプリケーション基盤 =====
class PixiApplication {
  // WebGPU初期化・デバイス検出・フォールバック制御
  initialize(container: HTMLElement): Promise<boolean>
  getRendererType(): 'webgpu' | 'webgl2' | 'webgl'
  getOptimalCanvasSize(): { width: number; height: number }
}

class EventBus {
  // 型安全イベント通信・疎結合アーキテクチャ
  on<K extends keyof IEventData>(event: K, callback: Function): () => void
  emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void
  getEventHistory(): Array<{ event: string; timestamp: number }>
}

class DrawingEngine {
  // 描画統合・ツール制御・Graphics管理
  startDrawing(data: IEventData['drawing:start']): void
  continueDrawing(data: IEventData['drawing:move']): void
  endDrawing(data: IEventData['drawing:end']): void
  setBrushSize(size: number): void
  setOpacity(opacity: number): void
}

class PerformanceManager {
  // 性能監視・メモリ管理・1GB制限・動的調整
  monitorFrameRate(): void
  checkMemoryUsage(): MemoryStatus
  forceGarbageCollection(): void
  getPerformanceMetrics(): PerformanceMetrics
}
```

### Rendering Layer（描画・GPU最適化）
```typescript
// ===== レンダリング・GPU処理 =====
class LayerManager {
  // 20レイヤー管理・Container階層・Z-index制御
  createLayer(name: string, type: 'raster'|'vector'): string
  deleteLayer(layerId: string): void
  moveLayer(layerId: string, newIndex: number): void
  setLayerVisibility(layerId: string, visible: boolean): void
  setLayerBlendMode(layerId: string, mode: PIXI.BlendModes): void
  setLayerOpacity(layerId: string, opacity: number): void
}

class WebGPURenderer {
  // WebGPU専用処理・Compute Shader・並列処理
  initializeWebGPU(): Promise<GPUDevice | null>
  createComputePipeline(shaderCode: string): GPURenderPipeline
  executeComputeShader(pipeline: GPURenderPipeline, data: Float32Array): void
  optimizeGPUMemory(): void
}

class CanvasManager {
  // 4K対応・座標変換・Viewport・デバイス対応
  resizeCanvas(width: number, height: number): void
  screenToCanvas(screenX: number, screenY: number): PIXI.Point
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number }
  setZoom(factor: number): void
  pan(deltaX: number, deltaY: number): void
}

class TextureManager {
  // GPUメモリ・Atlas統合・圧縮・効率化
  createTextureAtlas(textures: PIXI.Texture[]): PIXI.Texture
  compressTexture(texture: PIXI.Texture, format: string): PIXI.Texture
  cleanupUnusedTextures(): number
  getMemoryUsage(): number
}
```

### Input Layer（入力処理・デバイス対応）
```typescript
// ===== 入力・デバイス統合 =====
class InputManager {
  // 統合入力・Pointer Events・筆圧対応
  setupPointerEvents(): void
  screenToCanvas(screenX: number, screenY: number): PIXI.Point
  processPressure(rawPressure: number): number
  calculateVelocity(currentEvent: PointerEvent): number
}

class PointerProcessor {
  // 筆圧・傾き・座標変換・2.5K精度・補正
  calibratePressureCurve(deviceType: string): void
  processTiltData(tiltX: number, tiltY: number): { angle: number; intensity: number }
  smoothPressureData(pressureHistory: number[]): number
  detectPointerType(event: PointerEvent): 'mouse' | 'pen' | 'touch'
}

class ShortcutManager {
  // キーボード・ペンサイドボタン・カスタマイズ
  registerShortcut(key: string, callback: () => void): void
  unregisterShortcut(key: string): void
  handlePenSideButton(button: number): void
  saveShortcutSettings(settings: ShortcutSettings): void
}
```

### Tools Layer（ツールシステム・段階実装）
```typescript
// ===== ツール・機能拡張 =====
interface IDrawingTool {
  readonly name: string;
  readonly icon: string;
  readonly category: 'drawing' | 'editing' | 'selection';
  readonly phase: 1 | 2 | 3 | 4;
  
  activate(): void;
  deactivate(): void;
  onPointerDown(event: IEventData['drawing:start']): void;
  onPointerMove(event: IEventData['drawing:move']): void;
  onPointerUp(event: IEventData['drawing:end']): void;
  getSettings(): ToolSettings;
  updateSettings(settings: Partial<ToolSettings>): void;
}

class ToolManager {
  // ツール統合・状態管理・設定永続化
  registerTool(tool: IDrawingTool): void
  activateTool(toolName: string): void
  getActiveTool(): IDrawingTool | null
  getToolSettings(toolName: string): ToolSettings
  saveToolSettings(toolName: string, settings: ToolSettings): void
}

// Phase別ツール実装
class PenTool implements IDrawingTool {           // Phase1・基盤
class BrushTool implements IDrawingTool {         // Phase2・拡張
class EraserTool implements IDrawingTool {        // Phase1・基盤
class FillTool implements IDrawingTool {          // Phase2・拡張
class ShapeTool implements IDrawingTool {         // Phase2・拡張
class SelectionTool implements IDrawingTool {     // Phase3・高度
class TransformTool implements IDrawingTool {     // Phase3・高度
}
```

### UI Layer（インターフェース・2.5K最適化）
```typescript
// ===== UI・インターフェース =====
class UIManager {
  // UI統合・レスポンシブ・レイアウト管理・ふたば色
  initializeLayout(): void
  createToolbar(): void
  createColorPalette(): void
  createLayerPanel(): void
  updateUIForTier(tier: 'webgpu' | 'webgl2' | 'webgl'): void
}

class Toolbar {
  // ツールバー・64px幅・36pxアイコン・ふたば色
  addTool(tool: IDrawingTool): void
  setActiveTool(toolName: string): void
  updateToolIcon(toolName: string, icon: string): void
  showToolTooltip(toolName: string, message: string): void
}

class ColorPalette {
  // HSV円形・200px・ふたば色プリセット・アクセシビリティ
  createHSVWheel(): void
  addColorPreset(color: number, name: string): void
  setActiveColor(color: number): void
  getColorHistory(): number[]
  saveColorSettings(): void
}

class LayerPanel {
  // レイヤー・300px幅・64px項目・階層表示・ドラッグ&ドロップ
  addLayerItem(layer: LayerData): void
  removeLayerItem(layerId: string): void
  updateLayerThumbnail(layerId: string, thumbnail: ImageData): void
  reorderLayers(fromIndex: number, toIndex: number): void
  showLayerContextMenu(layerId: string): void
}
```

### Constants & Types（定数・型定義）
```typescript
// ===== 重要定数・設定値 =====
// ui-constants.ts
export const UI_CONSTANTS = {
  TOOLBAR_WIDTH: 64,           // ツールバー幅・固定
  TOOL_BUTTON_SIZE: 36,        // ツールボタンサイズ・2.5K最適化
  LAYER_PANEL_WIDTH: 300,      // レイヤーパネル幅・固定
  LAYER_ITEM_HEIGHT: 64,       // レイヤー項目高・操作性
  COLOR_PALETTE_SIZE: 200,     // カラーピッカー円直径
  COLOR_SWATCH_SIZE: 32,       // 色見本サイズ
  
  // ふたば色・変更禁止
  FUTABA_COLORS: {
    MAROON: 0x800000,          // #800000 - メイン
    LIGHT_MAROON: 0xaa5a56,    // #aa5a56 - セカンダリ
    MEDIUM: 0xcf9c97,          // #cf9c97 - アクセント
    LIGHT: 0xe9c2ba,           // #e9c2ba - 境界
    CREAM: 0xf0e0d6,           // #f0e0d6 - パネル背景
    BACKGROUND: 0xffffee       // #ffffee - キャンバス
  }
} as const;

// drawing-constants.ts
export const DRAWING_CONSTANTS = {
  MAX_LAYER_COUNT: 20,         // 最大レイヤー数
  MAX_BRUSH_SIZE: 200,         // 最大ブラシサイズ
  MIN_BRUSH_SIZE: 1,           // 最小ブラシサイズ
  DEFAULT_BRUSH_SIZE: 4,       // デフォルトブラシサイズ
  PRESSURE_SENSITIVITY: 0.8,   // 筆圧感度
  SMOOTHING_FACTOR: 0.5,       // スムージング係数
  
  // キャンバスサイズ・Tier別
  CANVAS_SIZE: {
    TIER1_WEBGPU: 2048,        // WebGPU・高性能
    TIER2_WEBGL2: 1024,        // WebGL2・標準
    TIER3_WEBGL: 512           // WebGL・基本
  }
} as const;

// performance-constants.ts
export const PERFORMANCE_CONSTANTS = {
  TARGET_FPS: 60,              // 目標フレームレート
  MEMORY_LIMIT_MB: 1024,       // メモリ制限・1GB
  MEMORY_WARNING_MB: 800,      // メモリ警告・800MB
  LOW_FPS_THRESHOLD: 30,       // 低FPS警告
  INPUT_LATENCY_MS: 5,         // 入力遅延目標・5ms以下
  
  // 性能監視間隔
  FPS_MONITOR_INTERVAL: 1000,  // FPS監視・1秒間隔
  MEMORY_CHECK_INTERVAL: 5000, // メモリチェック・5秒間隔
  PERFORMANCE_HISTORY_SIZE: 60 // 性能履歴サイズ・1分間
} as const;

// ===== 重要型定義・インターフェース =====
// drawing.types.ts
export interface LayerData {
  id: string;
  name: string;
  type: 'raster' | 'vector';
  visible: boolean;
  opacity: number;
  blendMode: PIXI.BlendModes;
  thumbnail: ImageData | null;
  pixiContainer: PIXI.Container;
}

export interface ToolSettings {
  size: number;
  opacity: number;
  color: number;
  pressureSensitive: boolean;
  smoothing: number;
  [key: string]: any;
}

export interface StrokeData {
  points: PIXI.Point[];
  pressures: number[];
  timestamps: number[];
  color: number;
  size: number;
  opacity: number;
}

// ui.types.ts
export interface UIState {
  activeTool: string;
  activeColor: number;
  activeLayer: string;
  zoom: number;
  panX: number;
  panY: number;
  showColorPalette: boolean;
  showLayerPanel: boolean;
}

// performance.types.ts
export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  inputLatency: number;
  renderTime: number;
  gpuUsage?: number;
  cpuUsage?: number;
}

export interface MemoryStatus {
  used: number;
  limit: number;
  percentage: number;
  status: 'normal' | 'warning' | 'critical';
}
```

# 6_Claude_Master_Rulebook.md 追記案

## 3. アーキテクチャ規約（新規追加）

### 3-1. インターフェース契約の強制
**原則**: クラス群に共通の役割を与える場合、必ず共有インターフェースを定義し実装させる
- すべての描画ツールは `IDrawingTool` インターフェースを実装必須
- これは「曖昧さの物理的排除」原則の具体的実践である
- クラスが遵守すべき「契約」をコードレベルで明示し、解釈の余地を完全に断つ

### 3-2. 責務分離の徹底
**PixiApplication**: Canvas・Stage・Renderer の器としての責務のみ
**DrawingEngine**: 描画データの最終確定・レイヤー管理のみ  
**各ツール**: 入力解釈・プレビュー表示・DrawingEngine委譲のみ
**ToolManager**: ツールライフサイクル管理・状態遷移制御のみ
**UIManager**: UI表示・更新・イベント発火のみ（アプリケーション状態管理は禁止）

### 3-3. EventBus使用制限
**許可**: コンポーネント階層横断の全体状態変更通知のみ
- 例: `tool:change`, `ui:color-change`, `performance:fps-low`
**禁止**: 親子関係・直接参照関係での通信
- 直接メソッド呼び出し・コールバック関数を使用すること
- スパゲッティコード防止・依存関係明確化

### 3-4. ファイル構成規約
**共通インターフェース**: 独立ファイル化必須（例: `IDrawingTool.ts`）
**循環インポート**: 物理的に不可能な構成にする
**型定義**: 実装から分離・純粋性保持

## 4. 実装パターン（新規追加）

### 4-1. ツール実装パターン
```typescript
// ✅ 正しい実装
import { IDrawingTool } from './IDrawingTool.js';

export class NewTool implements IDrawingTool {
  // 必須プロパティ・メソッドすべて実装
}

// ❌ 誤った実装
export class NewTool {
  // インターフェース無し = 契約違反
}
```

### 4-2. 状態管理パターン  
```typescript
// ✅ 正しいフロー
UIManager → EventBus → ToolManager → 各ツール

// ❌ 誤ったフロー  
UIManager → 各ツール直接操作（責務越境）
```


## 📋 改修チェックリスト・品質保証

### 必須確認項目（改修完了前）
```typescript
// ===== 改修完了チェックリスト =====
export const MODIFICATION_CHECKLIST = {
  // 📋 機能要件確認
  functional: [
    '✅ 改修対象機能が正常動作（基本機能・境界値・異常値）',
    '✅ 既存機能に影響なし（回帰テスト・動作確認）',
    '✅ 新機能がPhase段階に適合（Phase1基盤・Phase2拡張・Phase3高度）',
    '✅ EventBus通信が正常（型安全・エラー処理・リスナー解除）',
    '✅ エラーハンドリングが適切（try-catch・ログ・回復処理）',
    '✅ リソース管理が正常（メモリリーク無し・destroy()実装）'
  ],
  
  // 🎨 UI/UX要件確認
  userInterface: [
    '✅ ふたば色システム準拠（色定数使用・独自色禁止）',
    '✅ 2.5K環境最適化（64px Toolbar・300px LayerPanel・36px Button）',
    '✅ アクセシビリティ準拠（WCAG 2.1 AAA・色覚対応・キーボード操作）',
    '✅ 操作性維持・向上（学習コスト・一貫性・直感性）',
    '✅ レスポンシブ非対応確認（2.5K専用・警告表示）',
    '✅ フォーカス管理・タブ順序（論理的順序・視覚表示明確）'
  ],
  
  // ⚡ 性能要件確認
  performance: [
    '✅ 60FPS目標維持（WebGL2環境・測定確認）',
    '✅ メモリ使用量1GB以下（監視・警告・強制GC）',
    '✅ 入力遅延5ms以下（筆圧・座標・応答性）',
    '✅ 起動時間・操作応答性（LCP 2.5秒・FID 100ms）',
    '✅ 長時間動作安定性（15分連続・500ストローク・エラーなし）',
    '✅ GPU最適化・効率利用（WebGPU/WebGL2・Compute Shader）'
  ],
  
  // 🔧 技術要件確認
  technical: [
    '✅ TypeScript厳格準拠（エラー0・警告0・ESLint通過）',
    '✅ 命名規則準拠（禁止パターン無し・一貫性・理解容易）',
    '✅ アーキテクチャ整合（単一責任・インターフェース・疎結合）',
    '✅ 段階的縮退対応（WebGPU→WebGL2→WebGL・Tier戦略）',
    '✅ ブラウザ互換性（Chrome/Edge・Firefox/Safari・フォールバック）',
    '✅ セキュリティ考慮（XSS防止・入力検証・権限管理）'
  ],
  
  // 📝 ドキュメント要件
  documentation: [
    '✅ コード内コメント（複雑処理・設計意図・注意事項）',
    '✅ 型定義更新（IEventData・インターフェース・拡張）',
    '✅ 設定変更記録（constants更新・デフォルト値・制限値）',
    '✅ 既知問題・制限事項（README・トラブルシューティング）',
    '✅ パフォーマンス影響（測定結果・改善点・注意事項）',
    '✅ 使用方法・操作手順（新機能・変更点・移行方法）'
  ]

**このClaude Master Rulebook v4.2は、実装完了後の改修・追加実装作業において、別チャットのClaudeが一貫した品質とアーキテクチャを維持しながら開発を継続できるよう設計された包括的なガイドラインです。プロジェクトの成功を確実にするため、すべての改修作業前にこのルールブックを必ず参照し、チェックリストに従って品質を保証してください。**