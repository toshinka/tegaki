# UI/UXスタイルガイド v4.0

**ドキュメント**: デザインシステム・視覚設計規約  
**対象読者**: デザイナー・フロントエンド開発者・Claude  
**最終更新**: 2025年8月4日

## 🎨 ふたば色デザインシステム（完全版）

### 色彩定義・CSS変数（変更不可）
```css
:root {
  /* === 基調色系統・ふたばちゃんねる由来 === */
  --futaba-maroon: #800000;          /* メイン・強調・重要操作・削除確認 */
  --futaba-light-maroon: #aa5a56;    /* セカンダリ・補助操作・ホバー効果 */
  --futaba-medium: #cf9c97;          /* アクセント・中間調・境界表現 */
  --futaba-light: #e9c2ba;          /* 境界・枠線・分離線・非アクティブ */
  --futaba-cream: #f0e0d6;          /* パネル背景・UI基調・コンテンツ領域 */
  --futaba-background: #ffffee;      /* キャンバス・作業領域・アプリ背景 */

  /* === 機能色拡張・状態表現 === */
  --success: #4caf50;                /* 成功・完了・正常状態・保存完了 */
  --warning: #ff9800;                /* 警告・注意・確認必要・メモリ警告 */
  --error: #f44336;                  /* エラー・危険・削除・クリティカル */
  --info: #2196f3;                   /* 情報・案内・説明・ヘルプ */

  /* === 透明度バリエーション・重ね合わせ === */
  --futaba-maroon-90: rgba(128, 0, 0, 0.9);
  --futaba-maroon-70: rgba(128, 0, 0, 0.7);
  --futaba-maroon-50: rgba(128, 0, 0, 0.5);
  --futaba-light-maroon-80: rgba(170, 90, 86, 0.8);
  --futaba-medium-70: rgba(207, 156, 151, 0.7);
  --futaba-light-60: rgba(233, 194, 186, 0.6);
  --futaba-cream-95: rgba(240, 224, 214, 0.95);

  /* === テキスト色・可読性最適化 === */
  --text-primary: #2c1810;           /* 主要テキスト・高コントラスト */
  --text-secondary: #5d4037;         /* 補助テキスト・説明文 */
  --text-disabled: #8d6e63;          /* 無効状態・グレーアウト */
  --text-inverse: #ffffff;           /* 反転テキスト・白文字 */
}
```

### 色彩適用原則・階層表現
```css
/* === 重要度・視覚階層 === */
.priority-critical {    color: var(--futaba-maroon); }      /* 最重要・削除・確定 */
.priority-high {        color: var(--futaba-light-maroon); } /* 重要・選択・アクティブ */
.priority-medium {      color: var(--futaba-medium); }       /* 中程度・ホバー・フォーカス */
.priority-low {         color: var(--futaba-light); }        /* 軽微・境界・非アクティブ */
.priority-background {  color: var(--futaba-cream); }        /* 背景・土台・基調 */

/* === 状態表現・インタラクション === */
.state-normal {         background: var(--futaba-background); }
.state-hover {          background: var(--futaba-medium); transform: scale(1.05); }
.state-active {         background: var(--futaba-maroon); color: var(--text-inverse); }
.state-disabled {       background: var(--futaba-light); opacity: 0.5; cursor: not-allowed; }
.state-focus {          outline: 2px solid var(--futaba-maroon); outline-offset: 2px; }
```

### アクセシビリティ・色覚対応
```css
/* === コントラスト比・WCAG 2.1 AAA準拠 === */
.contrast-aa {          /* 4.5:1以上確保 */
  color: var(--text-primary);
  background: var(--futaba-background);
}

.contrast-aaa {         /* 7:1以上確保 */
  color: var(--text-primary);
  background: var(--futaba-cream);
}

/* === 色覚バリアフリー・形状併用 === */
.status-success::before { content: "✓"; color: var(--success); }
.status-warning::before { content: "⚠"; color: var(--warning); }
.status-error::before   { content: "✗"; color: var(--error); }
.status-info::before    { content: "ℹ"; color: var(--info); }

/* === 高コントラストモード対応 === */
@media (prefers-contrast: high) {
  :root {
    --futaba-maroon: #000000;
    --futaba-background: #ffffff;
    --text-primary: #000000;
  }
}
```

## 📐 レイアウト・グリッドシステム

### メイン画面構成・2560×1440最適化
```css
/* === Grid Layout・80px|1fr|400px === */
.main-layout {
  display: grid;
  grid-template-columns: 80px 1fr 400px;
  grid-template-rows: 1fr auto;
  grid-template-areas: 
    "sidebar canvas layer-panel"
    "sidebar timeline layer-panel";
  height: 100vh;
  width: 100vw;
  gap: 0;
}

/* === 2.5K環境特化・高解像度対応 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .main-layout {
    grid-template-columns: 96px 1fr 480px; /* 20%サイズアップ */
  }
  
  .toolbar { padding: 20px 16px; }
  .layer-panel { padding: 20px; }
}

/* === レスポンシブ無効・2.5K環境専用 === */
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
  }
}
```

### 領域責任・機能分界
```css
/* === Sidebar・ツールバー（80-96px） === */
.sidebar {
  grid-area: sidebar;
  background: var(--futaba-cream);
  border-right: 1px solid var(--futaba-light);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
}

/* === Canvas Area・描画領域（可変） === */
.canvas-area {
  grid-area: canvas;
  background: var(--futaba-background);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* === Layer Panel・レイヤー管理（400-480px） === */
.layer-panel {
  grid-area: layer-panel;
  background: var(--futaba-cream);
  border-left: 1px solid var(--futaba-light);
  padding: 16px;
  overflow-y: auto;
  min-height: 0; /* Grid Overflow修正 */
}

/* === Timeline・アニメーション（下部100-120px） === */
.timeline {
  grid-area: timeline;
  background: var(--futaba-light);
  border-top: 1px solid var(--futaba-medium);
  padding: 12px 16px;
  height: 100px;
  overflow-x: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
```

## 🔧 コンポーネント仕様・詳細設計

### Toolbar・ツールバー（80px幅）
```css
/* === ツールボタン・56px基準 === */
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
  position: relative; /* 通知バッジ用 */
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
  box-shadow: 0 2px 8px rgba(128, 0, 0, 0.3);
}

.tool-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* === グループ分離線・視覚的分類 === */
.tool-separator {
  height: 1px;
  background: var(--futaba-light);
  margin: 8px 12px;
}

/* === 通知バッジ・アクション必要 === */
.tool-button .notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  background: var(--error);
  border-radius: 50%;
  border: 2px solid var(--futaba-background);
}
```

### ColorPalette・色選択システム（200px）
```css
/* === HSV円形ピッカー・200px基準 === */
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

.hsv-picker-handle {
  width: 12px;
  height: 12px;
  border: 2px solid white;
  border-radius: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* === 明度スライダー・縦配置 === */
.brightness-slider {
  width: 20px;
  height: 168px;
  background: linear-gradient(to bottom, white, black);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  margin-left: 12px;
}

.brightness-handle {
  width: 24px;
  height: 8px;
  background: white;
  border: 1px solid var(--futaba-medium);
  border-radius: 4px;
  position: absolute;
  left: -2px;
  transform: translateY(-50%);
  pointer-events: none;
}
```

### ふたば色プリセット・スウォッチ
```css
/* === カラープリセット・32px基準 === */
.color-presets {
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 6px;
  margin-top: 12px;
  justify-content: center;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid var(--futaba-light);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: var(--futaba-medium);
  z-index: 1;
}

.color-swatch.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
  transform: scale(1.05);
}

/* === ふたば色プリセット定義 === */
.swatch-futaba-maroon     { background-color: #800000; }
.swatch-futaba-light      { background-color: #aa5a56; }
.swatch-futaba-medium     { background-color: #cf9c97; }
.swatch-futaba-cream      { background-color: #f0e0d6; }
.swatch-black             { background-color: #000000; }
.swatch-white             { background-color: #ffffff; }
.swatch-red               { background-color: #ff0000; }
.swatch-green             { background-color: #00ff00; }
.swatch-blue              { background-color: #0000ff; }
.swatch-yellow            { background-color: #ffff00; }

/* === 色履歴・最近使用色 === */
.color-history {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--futaba-light);
}

.color-history .color-swatch {
  width: 24px;
  height: 24px;
  opacity: 0.8;
}

.color-history .color-swatch:hover {
  opacity: 1;
}
```

### LayerPanel・レイヤー管理（400px幅）
```css
/* === レイヤー項目・64px高基準 === */
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

.layer-item.dragging {
  opacity: 0.7;
  transform: rotate(2deg);
  z-index: 100;
}

/* === レイヤーサムネイル・48x48px === */
.layer-thumbnail {
  width: 48px;
  height: 48px;
  border: 1px solid var(--futaba-medium);
  border-radius: 4px;
  background: var(--futaba-background);
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* === レイヤー情報・名前・設定 === */
.layer-info {
  flex: 1;
  min-width: 0; /* Text overflow用 */
}

.layer-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* === 不透明度スライダー・120px === */
.opacity-slider {
  width: 120px;
  height: 4px;
  background: var(--futaba-light);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}

.opacity-track {
  height: 100%;
  background: var(--futaba-maroon);
  border-radius: 2px;
  transition: width 0.1s ease;
}

.opacity-handle {
  width: 12px;
  height: 12px;
  background: var(--futaba-maroon);
  border: 2px solid white;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
}

.opacity-handle:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.2);
}

/* === レイヤー階層・インデント表現 === */
.layer-item[data-depth="1"] { margin-left: 24px; }
.layer-item[data-depth="2"] { margin-left: 48px; }
.layer-item[data-depth="3"] { margin-left: 72px; }

.layer-item[data-depth="1"]::before,
.layer-item[data-depth="2"]::before,
.layer-item[data-depth="3"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--futaba-light);
}
```

### アイコンシステム・Tabler Icons統合
```css
/* === Tabler Icons・統一サイズ === */
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  fill: currentColor;
  vertical-align: middle;
}

/* === サイズバリエーション === */
.icon-small  { font-size: 16px; } /* UI詳細・ボタン内 */
.icon-normal { font-size: 24px; } /* ツールボタン・標準 */
.icon-large  { font-size: 32px; } /* 強調・ヘッダー */
.icon-xl     { font-size: 48px; } /* 特別・ランディング */

/* === ツール別アイコン定義 === */
.tool-pen::before        { content: "✏️"; } /* ti-pencil */
.tool-brush::before      { content: "🖌️"; } /* ti-brush */
.tool-eraser::before     { content: "🗑️"; } /* ti-eraser */
.tool-fill::before       { content: "🪣"; } /* ti-bucket */
.tool-eyedropper::before { content: "💧"; } /* ti-color-picker */
.tool-select::before     { content: "⬚"; } /* ti-crop */
.tool-text::before       { content: "📝"; } /* ti-type */
.tool-shapes::before     { content: "⭕"; } /* ti-geometry */

/* === パネル・機能アイコン === */
.panel-colors::before    { content: "🎨"; } /* ti-palette */
.panel-layers::before    { content: "📚"; } /* ti-stack-2 */
.panel-animation::before { content: "🎬"; } /* ti-video */
.panel-settings::before  { content: "⚙️"; } /* ti-settings */
```

## 🎛️ インタラクション・アニメーション

### ホバー効果・マイクロアニメーション
```css
/* === 滑らかなトランジション・統一設定 === */
.interactive {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.interactive-slow {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === ボタンホバー・クリック効果 === */
.button-hover {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(128, 0, 0, 0.1);
}

.button-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
}

.button-hover:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(128, 0, 0, 0.2);
}

/* === フェードイン・アニメーション === */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* === スケール・強調アニメーション === */
@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

.scale-in {
  animation: scaleIn 0.2s ease-out;
}

/* === 通知・トースト出現 === */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.notification {
  animation: slideInRight 0.3s ease-out;
}
```

### ドラッグ&ドロップ・視覚フィードバック
```css
/* === ドラッグ可能要素 === */
.draggable {
  cursor: grab;
  user-select: none;
}

.draggable:active {
  cursor: grabbing;
}

.draggable.dragging {
  opacity: 0.7;
  transform: rotate(2deg) scale(1.05);
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3);
}

/* === ドロップゾーン・挿入位置表示 === */
.drop-zone {
  position: relative;
}

.drop-zone.drag-over::before {
  content: "";
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--futaba-maroon);
  border-radius: 2px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
```

## 📱 アクセシビリティ・ユーザビリティ

### キーボード操作・フォーカス管理
```css
/* === フォーカス表示・明確な境界 === */
.focusable:focus {
  outline: 2px solid var(--futaba-maroon);
  outline-offset: 2px;
  border-radius: 4px;
}

.focusable:focus:not(:focus-visible) {
  outline: none;
}

/* === スキップリンク・アクセシビリティ === */
.skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  background: var(--futaba-maroon);
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 10000;
}

.skip-link:focus {
  top: 8px;
}

/* === 高コントラスト・視認性向上 === */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --futaba-background: #1a1a1a;
    --futaba-cream: #2d2d2d;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
  }
}
```

### 多言語対応・テキスト設定
```css
/* === フォント設定・読みやすさ優先 === */
body {
  font-family: 
    -apple-system, BlinkMacSystemFont, 
    "Segoe UI", "Noto Sans JP", "Hiragino Sans", 
    "Yu Gothic UI", sans-serif;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* === 日本語最適化・文字間隔 === */
.text-japanese {
  font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  letter-spacing: 0.02em;
}

/* === 英数字最適化・等幅フォント === */
.text-monospace {
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-variant-numeric: tabular-nums;
}

/* === テキストサイズ・階層 === */
.text-xs   { font-size: 12px; } /* 補助情報・キャプション */
.text-sm   { font-size: 14px; } /* 標準テキスト・UI */
.text-base { font-size: 16px; } /* 本文・読みやすさ重視 */
.text-lg   { font-size: 18px; } /* 強調・見出し */
.text-xl   { font-size: 24px; } /* タイトル・重要情報 */
```

---

**このスタイルガイドは、UI実装の視覚的基準となる重要ドキュメントです。デザイン変更時は必ずこのファイルを更新し、一貫したユーザー体験を維持します。**