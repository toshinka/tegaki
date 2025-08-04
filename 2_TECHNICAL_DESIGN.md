# 技術設計 v4.1

**ドキュメント**: アーキテクチャ・技術実装詳細  
**対象読者**: 開発者・Claude・技術レビュアー  
**最終更新**: 2025年8月4日 - PixiJS中心ライブラリ統合

## 🏗️ アーキテクチャ概要

### 基盤技術スタック（PixiJS v8中心最適化）
```
✅ Core Technology:
├─ PixiJS v8.11.0 - WebGPU統一基盤・GPU描画・Container階層（中核）
├─ TypeScript 5.0+ - 厳格型チェック・開発効率・エラー防止
├─ Vite - ESM・Tree Shaking・Hot Reload・最適化
└─ ESM Modules - モダンJS・依存関係最適化

✅ 補完ライブラリ（PixiJS非重複・段階導入）:
├─ FileSaver.js - ブラウザファイル保存（Phase1）
├─ Potrace - ベクター化・SVG出力（Phase2）
└─ 標準WebAPI - File System Access・OffscreenCanvas・Web Streams

❌ 採用見送り（PixiJS重複・競合リスク）:
├─ Fabric.js - PixiJS Containerと機能重複・統合複雑
├─ Konva.js - 2Dライブラリ重複・WebGPU非対応
├─ Paper.js - ベクター機能重複・学習コスト過大
└─ Canvas系ライブラリ - PixiJS Graphics機能で十分
```

### WebGPU対応戦略
```
🎯 段階的縮退戦略:
Tier 1: WebGPU + OffscreenCanvas + 標準WebAPI
 ├─ 目標: 60FPS安定、2048x2048キャンバス
 ├─ 対象: Chrome/Edge最新、高性能GPU、8GB+メモリ
 └─ 機能: 高度ブラシ・リアルタイム変形・GPU並列処理

Tier 2: WebGL2 + FileSaver.js + 基本WebAPI
 ├─ 目標: 30FPS安定、1024x1024キャンバス
 ├─ 対象: Firefox/Safari最新、中性能GPU、4GB+メモリ
 └─ 機能: 標準ブラシ・基本エフェクト・レイヤー合成

Tier 3: WebGL + 最小限ライブラリ
 ├─ 目標: 20FPS、512x512キャンバス
 ├─ 対象: 旧ブラウザ、低性能GPU、2GB+メモリ
 └─ 機能: 基本描画・最小限レイヤー・軽量化
```

## 📦 依存関係管理・段階的導入

### Phase1依存関係（最小限・確実動作）
```json
{
  "dependencies": {
    "pixi.js": "^8.11.0",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "eslint": "^8.55.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0"
  }
}
```

### Phase2追加ライブラリ（機能拡張）
```json
{
  "dependencies": {
    "potrace": "^2.1.8"
  },
  "devDependencies": {
    "@types/potrace": "^2.1.5"
  }
}
```

### Phase3検討ライブラリ（高度機能・慎重判断）
```json
{
  "dependencies": {
    "opencv-ts": "^1.3.4",
    "@tensorflow/tfjs": "^4.15.0"
  }
}
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
│   ├── LayerPanel.ts               # レイヤー・400px幅・64px項目
│   ├── PopupManager.ts             # ポップアップ制御・移動可能ウィンドウ
│   └── DraggableManager.ts         # ドラッグ&ドロップ・位置制御
├── export/                         # ファイル出力・Phase2
│   ├── ImageExporter.ts            # PNG・JPEG・WebP出力
│   ├── VectorExporter.ts           # SVG・ベクター出力（Potrace使用）
│   └── ProjectManager.ts           # プロジェクトファイル・保存/読込
├── constants/                      # 定数・設定・2.5K環境
│   ├── ui-constants.ts             # UI定数・サイズ・色・レイアウト
│   ├── drawing-constants.ts        # 描画定数・性能・ブラシサイズ
│   └── performance-constants.ts    # 性能定数・制限値・警告閾値
└── types/                          # 型定義・TypeScript
    ├── drawing.types.ts            # 描画関連・ツール・レイヤー型
    ├── ui.types.ts                # UI関連・イベント・状態型
    ├── performance.types.ts        # 性能関連・監視・メトリクス型
    └── index.ts                    # 型定義統合・再エクスポート
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
  'export:request': { format: 'png' | 'jpeg' | 'svg'; quality?: number };
}

export class EventBus {
  // 型安全リスナー登録・自動解除機能
  public on<K extends keyof IEventData>(event: K, callback: Function): () => void
  
  // 型安全イベント発火・データ検証
  public emit<K extends keyof IEventData>(event: K, data: IEventData[K]): void
}
```

### UI Layer（PixiJS統合UI）
```typescript
// PopupManager.ts - ポップアップ制御・移動可能
export class PopupManager {
  private pixiApp: PIXI.Application;
  private popups: Map<string, PopupWindow> = new Map();
  
  // PixiJS Container上でのポップアップ表示
  public showColorPicker(position: PIXI.Point): void {
    const popup = this.createPixiPopup('color-picker', position);
    this.pixiApp.stage.addChild(popup);
  }
  
  // HTML DOM併用・複雑UI用
  public showToolSettings(toolName: string): void {
    const htmlPopup = this.createHTMLPopup(toolName);
    // PixiJS Canvas上に絶対配置
  }
}

// DraggableManager.ts - PixiJS対応ドラッグ
export class DraggableManager {
  // PixiJS DisplayObject対応ドラッグ
  public makePixiDraggable(displayObject: PIXI.DisplayObject): void {
    displayObject.interactive = true;
    displayObject.on('pointerdown', this.onDragStart.bind(this));
  }
  
  // HTML要素ドラッグ（Canvas上ポップアップ用）
  public makeHTMLDraggable(element: HTMLElement): void {
    // Pointer Events使用・PixiJS座標系連携
  }
}
```

### Export Layer（ファイル出力・Phase2）
```typescript
// ImageExporter.ts - PixiJS RenderTexture使用
export class ImageExporter {
  private pixiApp: PIXI.Application;
  
  public async exportPNG(quality: number = 1.0): Promise<Blob> {
    // PixiJS RenderTexture→Canvas→Blob
    const renderTexture = PIXI.RenderTexture.create({
      width: this.pixiApp.screen.width,
      height: this.pixiApp.screen.height
    });
    
    this.pixiApp.renderer.render(this.pixiApp.stage, { renderTexture });
    return this.renderTextureToBlob(renderTexture, 'image/png');
  }
  
  public async exportJPEG(quality: number = 0.8): Promise<Blob> {
    // 同様の処理・JPEG形式
  }
}

// VectorExporter.ts - Potrace統合・Phase2
export class VectorExporter {
  public async exportSVG(): Promise<string> {
    // PixiJS Graphics→Path データ抽出
    const pathData = this.extractPathsFromPixi();
    
    // Potrace使用・ベクター化
    const potrace = new Potrace();
    return potrace.process(pathData);
  }
}
```

## 🚀 標準WebAPI活用・ブラウザ機能最大化

### File System Access API統合
```typescript
// ProjectManager.ts - ネイティブファイル操作
export class ProjectManager {
  public async saveProject(): Promise<void> {
    if ('showSaveFilePicker' in window) {
      // Chrome 86+ File System Access API
      const fileHandle = await window.showSaveFilePicker({
        types: [{
          description: 'Drawing Project',
          accept: { 'application/json': ['.dwg'] }
        }]
      });
      
      const writable = await fileHandle.createWritable();
      await writable.write(this.serializeProject());
      await writable.close();
    } else {
      // フォールバック・FileSaver.js使用
      const blob = new Blob([this.serializeProject()], 
        { type: 'application/json' });
      saveAs(blob, 'project.dwg');
    }
  }
}
```

### OffscreenCanvas統合（Phase3）
```typescript
// TextureManager.ts - バックグラウンド処理
export class TextureManager {
  private worker: Worker;
  
  public async generateThumbnails(layers: PIXI.Container[]): Promise<PIXI.Texture[]> {
    // Web Worker + OffscreenCanvas
    const offscreenCanvas = new OffscreenCanvas(64, 64);
    
    return new Promise((resolve) => {
      this.worker.postMessage({
        canvas: offscreenCanvas,
        layers: this.serializeLayers(layers)
      }, [offscreenCanvas]);
      
      this.worker.onmessage = (e) => {
        resolve(e.data.textures);
      };
    });
  }
}
```

## 🔧 開発環境・ビルド設定

### package.json（段階的依存関係）
```json
{
  "name": "modern-drawing-tool",
  "version": "4.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts --max-warnings 0",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "pixi.js": "^8.11.0",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "@types/file-saver": "^2.0.7",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "eslint": "^8.55.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "prettier": "^3.1.0"
  }
}
```

### vite.config.ts（PixiJS最適化）
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          ui: ['./src/ui/UIManager.ts', './src/ui/PopupManager.ts'],
          tools: ['./src/tools/ToolManager.ts', './src/tools/PenTool.ts'],
          export: ['./src/export/ImageExporter.ts', 'file-saver']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pixi.js', 'file-saver'],
    exclude: ['potrace'] // Phase2で追加
  },
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  }
});
```

### TypeScript設定（厳格モード）
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 📊 ライブラリ評価・採用判断基準

### 採用基準（PixiJS中心方針）
```
✅ 採用条件:
├─ PixiJS機能と重複なし・補完関係
├─ TypeScript完全対応・@types存在
├─ 軽量・最小限機能・性能影響小
├─ メンテナンス活発・セキュリティ更新
└─ 段階的導入可能・Phase別実装

❌ 除外条件:
├─ PixiJS機能重複・競合リスク
├─ 重い・複雑・学習コスト高
├─ TypeScript非対応・型定義不備
├─ メンテナンス停止・セキュリティリスク
└─ 全機能必須・段階導入困難
```

### 具体的評価結果
```
FileSaver.js: ✅ 採用
├─ 機能: ブラウザファイル保存のみ・PixiJS非重複
├─ サイズ: 4KB・軽量・性能影響なし
├─ TypeScript: 完全対応・@types/file-saver
└─ 実績: 広く使用・安定・セキュリティ良好

Potrace: ✅ Phase2採用
├─ 機能: ベクター化専用・PixiJS Graphics補完
├─ 用途: SVG出力・ベクター変換・エクスポート機能
├─ タイミング: Phase2エクスポート機能実装時
└─ リスク: 低・単機能・独立性高

Fabric.js: ❌ 採用見送り
├─ 重複: Canvas操作・オブジェクト管理・PixiJS Container重複
├─ 複雑: 独自API・学習コスト・統合困難
├─ サイズ: 300KB+・重い・性能影響
└─ 判断: PixiJS Graphics+Container で代替可能
```

---

**この技術設計書は、PixiJS v8中心のアーキテクチャとライブラリ選定により、実装効率と品質を最大化します。車輪の再発明を避けつつ、PixiJS機能と競合しない補完ライブラリの段階的導入で、確実な実装を実現します。**