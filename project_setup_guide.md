# PixiJS v8プロジェクト完全セットアップガイド
**モダンお絵かきツール v3.2対応 - ESM・WebGPU・最新技術統合**

## 🚀 プロジェクト初期化手順

### 1. 既存ファイル削除・初期化
```bash
# 既存のnode_modules、package.json等を完全削除
rm -rf node_modules
rm -f package.json package-lock.json
rm -f vite.config.js
rm -f yarn.lock pnpm-lock.yaml

# 新しいプロジェクト初期化
npm init -y
```

### 2. PixiJS v8 ESMコアライブラリインストール
```bash
# PixiJS v8 ESMモジュール（コア機能）
npm install @pixi/app@^8.0.0
npm install @pixi/graphics@^8.0.0
npm install @pixi/text@^8.0.0
npm install @pixi/sprite@^8.0.0
npm install @pixi/display@^8.0.0
npm install @pixi/events@^8.0.0
npm install @pixi/math@^8.0.0
npm install @pixi/utils@^8.0.0

# または一括インストール（推奨）
npm install pixi.js@^8.0.0
```

### 3. PixiJS v8拡張ライブラリ（段階的）
```bash
# Phase2: 実用機能拡張
npm install @pixi/filters@^8.0.0
npm install @pixi/mesh@^8.0.0

# Phase3: 高度機能拡張
npm install @pixi/particle-emitter@^5.0.8
npm install @pixi/gif@^2.1.3

# Phase4: Live2D・アニメーション拡張
npm install pixi-spine@^4.0.4
npm install pixi-sound@^6.0.1
npm install pixi-projection@^1.0.8
npm install @pixi/tilemap@^4.2.0
```

### 4. モダン支援ライブラリ
```bash
# イベント・データ処理
npm install mitt@^3.0.1
npm install lodash-es@^4.17.21
npm install chroma-js@^3.1.2

# UI・アイコン
npm install @phosphor-icons/core@^2.1.1

# データ管理・圧縮
npm install lz-string@^1.5.0
```

### 5. 開発環境・ビルドツール
```bash
# Vite（ESM最適化・高速開発）
npm install -D vite@^5.0.0
npm install -D @vitejs/plugin-legacy@^5.0.0

# TypeScript支援（オプション）
npm install -D typescript@^5.0.0
npm install -D @types/node@^20.0.0

# 開発用ユーティリティ
npm install -D concurrently@^8.0.0
npm install -D cross-env@^7.0.3
```

## 📦 package.json 最適化版

```json
{
  "name": "modern-drawing-tool-v32",
  "version": "3.2.0",
  "description": "PixiJS v8統一基盤モダンお絵かきツール - WebGPU・ESM・Chrome API統合",
  "type": "module",
  "main": "src/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "serve": "vite preview --port 3000",
    "clean": "rm -rf dist node_modules",
    "reinstall": "npm run clean && npm install",
    "type-check": "tsc --noEmit",
    "lint": "echo 'Linting with PixiJS v8 ESM standards'"
  },
  "dependencies": {
    "pixi.js": "^8.0.0",
    "@pixi/filters": "^8.0.0",
    "@pixi/mesh": "^8.0.0",
    "@pixi/particle-emitter": "^5.0.8",
    "@pixi/gif": "^2.1.3",
    "pixi-spine": "^4.0.4",
    "pixi-sound": "^6.0.1",
    "pixi-projection": "^1.0.8",
    "@pixi/tilemap": "^4.2.0",
    "mitt": "^3.0.1",
    "lodash-es": "^4.17.21",
    "chroma-js": "^3.1.2",
    "@phosphor-icons/core": "^2.1.1",
    "lz-string": "^1.5.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-legacy": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "concurrently": "^8.0.0",
    "cross-env": "^7.0.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "browserslist": [
    "> 1%",
    "last 2 versions",
    "not dead",
    "not ie 11"
  ],
  "keywords": [
    "pixijs",
    "pixijs-v8",
    "webgpu",
    "canvas",
    "drawing-tool",
    "graphics",
    "esm",
    "chrome-api",
    "futaba"
  ],
  "author": "PixiJS v8 Drawing Tool Project",
  "license": "MIT"
}
```

## ⚙️ vite.config.js PixiJS v8最適化版

```javascript
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // PixiJS v8 ESM最適化設定
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  // PixiJS v8最適化ビルド設定
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        // PixiJS v8チャンク最適化
        manualChunks: {
          'pixi-core': ['pixi.js'],
          'pixi-extensions': [
            '@pixi/filters',
            '@pixi/mesh',
            '@pixi/particle-emitter'
          ],
          'pixi-advanced': [
            'pixi-spine',
            'pixi-sound',
            'pixi-projection',
            '@pixi/tilemap'
          ],
          'utilities': [
            'mitt',
            'lodash-es',
            'chroma-js',
            'lz-string'
          ]
        }
      }
    },
    // WebGPU・Chrome API対応
    assetsInclude: ['**/*.wgsl', '**/*.glsl']
  },
  
  // 開発サーバー設定
  server: {
    host: true,
    port: 3000,
    open: true,
    cors: true,
    // PixiJS v8開発用ヘッダー
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // PixiJS v8 ESM最適化
  optimizeDeps: {
    include: [
      'pixi.js',
      '@pixi/filters',
      '@pixi/mesh',
      'mitt',
      'lodash-es',
      'chroma-js'
    ],
    exclude: [
      // WebWorker用ファイルは最適化から除外
      '**/worker.js',
      '**/*.worker.js'
    ]
  },
  
  // エイリアス設定（開発効率化）
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@pixiv8': new URL('./src/pixi-v8', import.meta.url).pathname,
      '@stores': new URL('./src/stores', import.meta.url).pathname,
      '@utils': new URL('./src/utils', import.meta.url).pathname,
      '@assets': new URL('./src/assets', import.meta.url).pathname
    }
  },
  
  // WebGPU・モダンブラウザ対応
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    '__PIXIJS_VERSION__': JSON.stringify('8.0.0'),
    '__WEBGPU_ENABLED__': true,
    '__CHROME_API_ENABLED__': true
  },
  
  // CSS設定（ふたば色統合）
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          $futaba-maroon: #800000;
          $futaba-light-maroon: #aa5a56;
          $futaba-medium: #cf9c97;
          $futaba-light-medium: #e9c2ba;
          $futaba-cream: #f0e0d6;
          $futaba-background: #ffffee;
        `
      }
    }
  }
});
```

## 📁 推奨ディレクトリ構造

```
drawing-tool/
├── public/
│   ├── icons/              # Phosphor Icons SVG
│   │   ├── pencil.svg
│   │   ├── paintbrush.svg
│   │   └── ...
│   └── index.html
├── src/
│   ├── main.js            # PixiJS v8統合エントリーポイント
│   ├── pixi-v8/           # PixiJS v8統一システム
│   │   ├── PixiV8UnifiedRenderer.js
│   │   ├── PixiV8InputController.js
│   │   ├── PixiV8CoordinateUnifier.js
│   │   ├── PixiV8ToolProcessor.js
│   │   ├── PixiV8LayerProcessor.js
│   │   ├── PixiV8OffscreenProcessor.js
│   │   └── PixiV8ModernExporter.js
│   ├── stores/            # 状態管理
│   │   ├── EventStore.js
│   │   ├── ProjectStore.js
│   │   └── HistoryStore.js
│   ├── utils/             # ユーティリティ
│   │   ├── ColorProcessor.js
│   │   ├── ShortcutController.js
│   │   └── DataProcessor.js
│   ├── workers/           # WebWorker（PixiJS v8連携）
│   │   ├── pixiV8LayerProcessor.worker.js
│   │   └── pixiV8ExportProcessor.worker.js
│   ├── assets/            # アセット
│   │   ├── fonts/
│   │   ├── textures/
│   │   └── shaders/
│   └── styles/            # CSS（ふたば色統合）
│       ├── main.css
│       ├── futaba-colors.css
│       └── pixijs-ui.css
├── package.json
├── vite.config.js
├── tsconfig.json          # TypeScript設定（オプション）
└── README.md
```

## 🎨 main.css（ふたば色統合・PixiJS v8対応）

```css
/* PixiJS v8統一基盤CSS */
:root {
  /* ふたば色系統（v3.2拡張版） */
  --futaba-maroon: #800000;
  --futaba-light-maroon: #aa5a56;
  --futaba-medium: #cf9c97;
  --futaba-light-medium: #e9c2ba; /* v3.2新規追加 */
  --futaba-cream: #f0e0d6;
  --futaba-background: #ffffee;
  
  /* PixiJS v8統一座標系設定 */
  --pixi-v8-coordinate-origin: 0 0;
  --pixi-v8-coordinate-y-direction: 1; /* 下向き正 */
  --pixi-v8-coordinate-scale: 1;
  --pixi-v8-webgpu-enabled: true;
  --pixi-v8-esm-enabled: true; /* ESMモジュール対応 */
  
  /* Chrome API最適化 */
  --gpu-acceleration: translateZ(0);
  --will-change-transform: transform;
  --will-change-opacity: opacity;
  --contain-layout: layout style paint;
  
  /* UI基本色（ふたば light medium 追加） */
  --ui-bg-primary: rgba(128,0,0,0.96);
  --ui-bg-secondary: rgba(170,90,86,0.92);
  --ui-bg-light-medium: rgba(233,194,186,0.85); /* 新規追加 */
  --ui-text-primary: #f0e0d6;
  --ui-text-secondary: #ffffff;
  --ui-border: rgba(240,224,214,0.3);
  --ui-accent: #ffffee;
  
  /* サイズ系統（PixiJS v8統一座標対応） */
  --sidebar-width: 72px;
  --layer-panel-width: 300px;
  --icon-size-normal: 44px;
  --icon-size-active: 48px;
  --border-radius: 16px;
  
  /* Chrome最適化アニメーション */
  --transition-fast: 200ms ease-out;
  --transition-normal: 300ms ease-out;
  --transition-slow: 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* グローバルリセット・PixiJS v8最適化 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--futaba-background);
  color: var(--ui-text-primary);
}

/* PixiJS v8キャンバス統一設定 */
#pixi-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--futaba-background);
  cursor: crosshair;
  touch-action: none; /* タッチイベント最適化 */
}

/* アプリ全体レイアウト（PixiJS v8統一） */
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--layer-panel-width);
  grid-template-rows: 1fr auto;
  grid-template-areas: 
    "sidebar canvas layer-panel"
    "sidebar timeline layer-panel";
  height: 100vh;
  
  /* PixiJS v8統一座標基盤 */
  position: relative;
  overflow: hidden;
  
  /* Chrome最適化 */
  will-change: var(--will-change-transform);
  contain: var(--contain-layout);
}

/* サイドバー（ふたば色統合） */
.sidebar { 
  grid-area: sidebar;
  background: linear-gradient(135deg, var(--futaba-maroon) 0%, var(--futaba-light-maroon) 100%);
  border-right: 1px solid var(--ui-border);
  
  /* GPU加速 */
  transform: var(--gpu-acceleration);
  will-change: var(--will-change-transform);
}

/* キャンバス領域 */
.canvas { 
  grid-area: canvas;
  /* PixiJS v8統一座標系キャンバス領域 */
  position: relative;
  overflow: hidden;
  transform: var(--gpu-acceleration);
}

/* レイヤーパネル（ふたば light medium 活用） */
.layer-panel { 
  grid-area: layer-panel;
  background: linear-gradient(135deg, var(--ui-bg-primary) 0%, var(--ui-bg-secondary) 100%);
  border-left: 1px solid var(--ui-border);
  
  transform: translateX(0);
  transition: transform var(--transition-normal);
  will-change: var(--will-change-transform);
}

.layer-panel.hidden {
  transform: translateX(100%);
}

/* レイヤー項目（ふたば light medium 追加） */
.layer-item {
  padding: 8px 12px;
  margin: 2px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  
  /* GPU加速 */
  will-change: var(--will-change-transform), background-color;
  transform: var(--gpu-acceleration);
}

.layer-item:hover {
  background: var(--ui-bg-light-medium); /* 新色活用 */
  border-color: var(--futaba-light-medium);
  transform: var(--gpu-acceleration) translateX(2px);
}

.layer-item.active {
  background: var(--ui-bg-light-medium);
  border-color: var(--ui-accent);
  color: var(--ui-accent);
}

/* ポップアップパネル（ふたば light medium 活用） */
.popup-panel {
  background: linear-gradient(135deg, var(--ui-bg-primary) 0%, var(--ui-bg-secondary) 100%);
  border-radius: var(--border-radius);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(128,0,0,0.6);
  border: 1px solid var(--ui-border);
  
  /* Chrome API最適化 */
  will-change: var(--will-change-transform), var(--will-change-opacity);
  transform: var(--gpu-acceleration);
  contain: var(--contain-layout);
}

.popup-panel.secondary {
  background: linear-gradient(135deg, var(--ui-bg-light-medium) 0%, var(--ui-bg-secondary) 100%);
}

/* タイムライン */
.timeline { 
  grid-area: timeline;
  height: 0; /* 通常時非表示 */
  background: linear-gradient(135deg, var(--ui-bg-primary) 0%, var(--ui-bg-light-medium) 100%);
  border-top: 1px solid var(--ui-border);
  
  transform: translateY(100%);
  transition: height var(--transition-slow), transform var(--transition-slow);
  will-change: height, var(--will-change-transform);
}

.timeline.active {
  height: 30vh; /* アニメモード時表示 */
  transform: translateY(0);
}

/* Chrome最適化動作軽減対応 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    will-change: auto !important;
  }
}

/* 高解像度対応 */
@media (min-resolution: 2dppx) {
  .layer-thumbnail {
    image-rendering: -webkit-optimize-contrast;
  }
  
  .color-swatch {
    border-width: 1px; /* 高解像度で調整 */
  }
}
```

## 🚀 開発開始手順

### 1. プロジェクトセットアップ実行
```bash
# 1. 既存削除・初期化
rm -rf node_modules package.json package-lock.json vite.config.js

# 2. 新規初期化
npm init -y

# 3. package.jsonを上記内容で更新

# 4. 依存関係一括インストール
npm install

# 5. vite.config.jsを上記内容で作成

# 6. ディレクトリ構造作成
mkdir -p src/pixi-v8 src/stores src/utils src/workers src/assets src/styles public/icons

# 7. main.cssを上記内容で作成
```

### 2. 開発サーバー起動
```bash
# 開発モード起動
npm run dev

# ブラウザでhttp://localhost:3000が開く
# PixiJS v8統一基盤での開発開始
```

### 3. ビルド・デプロイ
```bash
# プロダクションビルド
npm run build

# プレビュー確認
npm run preview

# 配布用ファイルはdist/フォルダに生成
```

## ⚠️ 重要注意事項

### PixiJS v8統一基盤準拠
- **ESMモジュール必須**: `import`文のみ使用・`require`禁止
- **WebGPU優先**: `preference: 'webgpu'`設定必須
- **単一エンジン**: PixiJS v8以外の描画ライブラリ完全禁止
- **Container活用**: 全レイヤー管理をPixiJS v8 Container経由
- **非破壊性保証**: 元データをPixiJS v8 Container内で保持

### ふたば色統合活用
- **新色活用**: `--futaba-light-medium: #e9c2ba`を積極活用
- **グラデーション**: ふたば色系統でのlinear-gradient多用
- **ホバーエフェクト**: light-medium色でのインタラクション表現

### Chrome API最適化
- **GPU加速**: `transform: translateZ(0)`・`will-change`必須
- **OffscreenCanvas**: Worker統合での並列処理活用
- **WebCodecs**: 高速出力・動画生成機能活用

この完全セットアップにより、PixiJS v8統一基盤・モダンエコシステム・ふたば色統合・Chrome API活用を完全統合した最高品質開発環境を構築できます。
  