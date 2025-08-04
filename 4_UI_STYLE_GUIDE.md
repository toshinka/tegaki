# UI/UXスタイルガイド v4.2

**ドキュメント**: PixiV8Chrome統合デザインシステム・責任分界・Claude実装効率最大化  
**対象読者**: Claude・フロントエンド開発者・デザイナー  
**最終更新**: 2025年8月5日

## 🎨 PixiV8Chrome統合デザインシステム

### ふたば色システム・PixiV8Chrome対応（変更不可）
```css
:root {
  /* === PixiV8Chrome基調色・ふたばちゃんねる由来 === */
  --futaba-maroon: #800000;          /* メイン・強調・Tier1表示・重要操作 */
  --futaba-light-maroon: #aa5a56;    /* セカンダリ・Tier2表示・補助操作 */
  --futaba-medium: #cf9c97;          /* アクセント・Tier3表示・中間調 */
  --futaba-light: #e9c2ba;          /* 境界・枠線・分離線・非アクティブ */
  --futaba-cream: #f0e0d6;          /* パネル背景・UI基調・コンテンツ領域 */
  --futaba-background: #ffffee;      /* キャンバス・作業領域・アプリ背景 */

  /* === PixiV8Chrome機能色・Tier対応 === */
  --pixiv8-tier1: #4caf50;          /* Tier1: WebGPU最高性能・緑 */
  --pixiv8-tier2: #ff9800;          /* Tier2: WebGL2標準・オレンジ */
  --pixiv8-tier3: #f44336;          /* Tier3: WebGL基本・赤 */
  --pixiv8-chrome-api: #2196f3;     /* Chrome API対応・青 */

  /* === 状態表現・インタラクション === */
  --success: var(--pixiv8-tier1);
  --warning: var(--pixiv8-tier2);
  --error: var(--pixiv8-tier3);
  --info: var(--pixiv8-chrome-api);

  /* === PixiV8Chrome透明度・重ね合わせ === */
  --futaba-maroon-90: rgba(128, 0, 0, 0.9);
  --futaba-maroon-70: rgba(128, 0, 0, 0.7);
  --futaba-maroon-50: rgba(128, 0, 0, 0.5);
  --pixiv8-tier1-80: rgba(76, 175, 80, 0.8);
  --pixiv8-tier2-80: rgba(255, 152, 0, 0.8);
  --pixiv8-tier3-80: rgba(244, 67, 54, 0.8);

  /* === テキスト色・可読性WCAG AAA準拠 === */
  --text-primary: #2c1810;           /* 主要テキスト・コントラスト比7:1 */
  --text-secondary: #5d4037;         /* 補助テキスト・コントラスト比4.5:1 */
  --text-disabled: #8d6e63;          /* 無効状態・視覚的無効化 */
  --text-inverse: #ffffff;           /* 反転テキスト・アクティブ状態 */
}
```

### PixiV8Chrome命名規約・CSS統一
```css
/* === 必須プレフィックス・技術スタック明示 === */
.pixiv8-chrome-* { /* 全UI要素・統一プレフィックス必須 */ }

/* === 責任分界・コンポーネント別 === */
.pixiv8-chrome-main-layout { /* レイアウト制御・Grid構成 */ }
.pixiv8-chrome-toolbar { /* ツール制御・ボタン配置 */ }
.pixiv8-chrome-canvas-area { /* キャンバス制御・描画領域 */ }
.pixiv8-chrome-color-palette { /* 色制御・選択UI */ }
.pixiv8-chrome-tier-indicator { /* Tier表示・性能状況 */ }

/* === 状態表現・インタラクション === */
.pixiv8-chrome-tool-button { /* ツールボタン・基本状態 */ }
.pixiv8-chrome-tool-button:hover { /* ホバー状態・視覚フィードバック */ }
.pixiv8-chrome-tool-button.active { /* アクティブ状態・選択表示 */ }
.pixiv8-chrome-color-swatch { /* 色スウォッチ・選択要素 */ }
```

## 📐 PixiV8Chrome統合レイアウト・2.5K最適化

### メイン画面構成・Grid 80px|1fr配置
```css
/* === PixiV8Chrome主要レイアウト・責任分界明確 === */
.pixiv8-chrome-main-layout {
  display: grid;
  grid-template-columns: 80px 1fr;           /* ツールバー80px・キャンバス可変 */
  grid-template-rows: 1fr;                   /* 単一行・シンプル構成 */
  grid-template-areas: "toolbar canvas";     /* 領域名明示・理解容易 */
  height: 100vh;
  width: 100vw;
  gap: 0;
  overflow: hidden;
}

/* === 2.5K環境特化・高解像度対応 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .pixiv8-chrome-main-layout {
    grid-template-columns: 96px 1fr;         /* 20%サイズアップ・2.5K最適化 */
  }
  
  .pixiv8-chrome-toolbar { 
    padding: 20px 16px;                      /* パディング拡大・操作性向上 */
  }
  
  .pixiv8-chrome-tool-button {
    width: 67px;                             /* 56px→67px・20%拡大 */
    height: 67px;
    font-size: 29px;                         /* 24px→29px・視認性向上 */
  }
}

/* === 2.5K未満環境・警告表示 === */
@media (max-width: 2559px), (max-height: 1439px) {
  .pixiv8-chrome-main-layout::before {
    content: "⚠ このPixiV8Chromeツールは2560×1440以上の環境に最適化されています";
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--pixiv8-tier2);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    white-space: nowrap;
  }
}
```

### 領域責任・機能分界明確化
```css
/* === PixiV8Chrome Toolbar・ツール制御（80-96px） === */
.pixiv8-chrome-toolbar {
  grid-area: toolbar;
  background: var(--futaba-cream);
  border-right: 1px solid var(--futaba-light);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--futaba-medium) var(--futaba-light);
}

/* === PixiV8Chrome Canvas Area・描画領域（可変） === */
.pixiv8-chrome-canvas-area {
  grid-area: canvas;
  background: var(--futaba-background);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;                             /* Grid Overflow修正 */
}

/* === PixiV8Chrome Tier Indicator・性能表示 === */
.pixiv8-chrome-tier-indicator {
  position: fixed;
  top: 10px;
  left: 100px;                               /* ツールバー右側配置 */
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 1000;
  transition: all 0.3s ease;
  cursor: help;
}

.pixiv8-chrome-tier-indicator.tier1 {
  background: var(--pixiv8-tier1);
  color: white;
}

.pixiv8-chrome-tier-indicator.tier2 {
  background: var(--pixiv8-tier2);
  color: white;
}

.pixiv8-chrome-tier-indicator.tier3 {
  background: var(--pixiv8-tier3);
  color: white;
}

/* === Chrome API対応状況・追加表示 === */
.pixiv8-chrome-api-status {
  position: fixed;
  top: 40px;
  left: 100px;
  display: flex;
  gap: 4px;
  z-index: 999;
}

.pixiv8-chrome-api-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  background: var(--futaba-light);
  color: var(--text-secondary);
}

.pixiv8-chrome-api-badge.supported {
  background: var(--pixiv8-tier1);
  color: white;
}

.pixiv8-chrome-api-badge.webgpu::after { content: "WebGPU"; }
.pixiv8-chrome-api-badge.offscreen::after { content: "OffscreenCanvas"; }
.pixiv8-chrome-api-badge.webcodecs::after { content: "WebCodecs"; }
.pixiv8-chrome-api-badge.performance::after { content: "PerformanceObserver"; }
```

## 🔧 PixiV8Chrome統合コンポーネント

### Toolbar・ツールバー（56-67px基準）
```css
/* === PixiV8Chrome ツールボタン・統一設計 === */
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 24px;
  color: var(--futaba-maroon);
  position: relative;
  user-select: none;
}

.pixiv8-chrome-tool-button:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
}

.pixiv8-chrome-tool-button.active {
  background: var(--futaba-maroon);
  color: var(--text-inverse);
  border-color: var(--futaba-maroon);
  box-shadow: 0 2px 8px rgba(128, 0, 0, 0.3);
  transform: scale(1.02);
}

.pixiv8-chrome-tool-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pixiv8-chrome-tool-button:focus-visible {
  outline: 2px solid var(--futaba-maroon);
  outline-offset: 2px;
}

/* === ツール種別・視覚的分類 === */
.pixiv8-chrome-tool-button[data-tool="pen"]::before {
  content: "✏️";
}

.pixiv8-chrome-tool-button[data-tool="brush"]::before {
  content: "🖌️";
}

.pixiv8-chrome-tool-button[data-tool="eraser"]::before {
  content: "🗑️";
}

.pixiv8-chrome-tool-button[data-tool="fill"]::before {
  content: "🪣";
}

/* === グループ分離線・視覚的整理 === */
.pixiv8-chrome-tool-separator {
  height: 1px;
  background: var(--futaba-light);
  margin: 8px 12px;
  flex-shrink: 0;
}

/* === ツール設定インジケーター === */
.pixiv8-chrome-tool-button .setting-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: var(--pixiv8-chrome-api);
  border-radius: 50%;
  border: 1px solid var(--futaba-background);
}
```

### ColorPalette・PixiV8Chrome色選択（200px基準）
```css
/* === PixiV8Chrome色パレット・統合設計 === */
.pixiv8-chrome-color-palette {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 200px;
  background: var(--futaba-cream);
  border: 1px solid var(--futaba-light);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
  z-index: 500;
}

/* === HSV円形ピッカー・168px基準 === */
.pixiv8-chrome-hsv-wheel {
  width: 168px;
  height: 168px;
  border-radius: 50%;
  margin: 0 auto 16px;
  position: relative;
  cursor: crosshair;
  background: conic-gradient(
    hsl(0, 100%, 50%),
    hsl(60, 100%, 50%),
    hsl(120, 100%, 50%),
    hsl(180, 100%, 50%),
    hsl(240, 100%, 50%),
    hsl(300, 100%, 50%),
    hsl(360, 100%, 50%)
  );
}

.pixiv8-chrome-hsv-picker-handle {
  width: 12px;
  height: 12px;
  border: 2px solid white;
  border-radius: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

/* === 明度スライダー・縦配置20px === */
.pixiv8-chrome-brightness-slider {
  width: 20px;
  height: 168px;
  background: linear-gradient(to bottom, white, black);
  border-radius: 10px;
  position: absolute;
  right: 16px;
  top: 16px;
  cursor: pointer;
}

.pixiv8-chrome-brightness-handle {
  width: 24px;
  height: 8px;
  background: white;
  border: 1px solid var(--futaba-medium);
  border-radius: 4px;
  position: absolute;
  left: -2px;
  transform: translateY(-50%);
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* === ふたば色プリセット・32px基準 === */
.pixiv8-chrome-color-presets {
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 6px;
  margin-top: 12px;
  justify-content: center;
}

.pixiv8-chrome-color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid var(--futaba-light);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.pixiv8-chrome-color-swatch:hover {
  transform: scale(1.1);
  border-color: var(--futaba-medium);
  z-index: 1;
}

.pixiv8-chrome-color-swatch.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
  transform: scale(1.05);
}

.pixiv8-chrome-color-swatch:focus-visible {
  outline: 2px solid var(--futaba-maroon);
  outline-offset: 2px;
}

/* === ふたば色定義・プリセット === */
.pixiv8-swatch-futaba-maroon { background-color: #800000; }
.pixiv8-swatch-futaba-light { background-color: #aa5a56; }
.pixiv8-swatch-futaba-medium { background-color: #cf9c97; }
.pixiv8-swatch-futaba-cream { background-color: #f0e0d6; }
.pixiv8-swatch-black { background-color: #000000; }
.pixiv8-swatch-white { background-color: #ffffff; }
.pixiv8-swatch-red { background-color: #ff0000; }
.pixiv8-swatch-green { background-color: #00ff00; }
.pixiv8-swatch-blue { background-color: #0000ff; }
.pixiv8-swatch-yellow { background-color: #ffff00; }

/* === 色履歴・最近使用色 === */
.pixiv8-chrome-color-history {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--futaba-light);
}

.pixiv8-chrome-color-history .pixiv8-chrome-color-swatch {
  width: 24px;
  height: 24px;
  opacity: 0.8;
}

.pixiv8-chrome-color-history .pixiv8-chrome-color-swatch:hover {
  opacity: 1;
}
```

### Performance・Tier表示システム
```css
/* === PixiV8Chrome性能監視・リアルタイム表示 === */
.pixiv8-chrome-performance-panel {
  position: fixed;
  top: 70px;
  left: 100px;
  background: var(--futaba-cream);
  border: 1px solid var(--futaba-light);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  z-index: 900;
  min-width: 120px;
  opacity: 0.9;
}

.pixiv8-chrome-fps-meter {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.pixiv8-chrome-fps-value {
  font-weight: 500;
  color: var(--text-primary);
}

.pixiv8-chrome-fps-value.good { color: var(--pixiv8-tier1); }
.pixiv8-chrome-fps-value.warning { color: var(--pixiv8-tier2); }
.pixiv8-chrome-fps-value.poor { color: var(--pixiv8-tier3); }

.pixiv8-chrome-memory-meter {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.pixiv8-chrome-memory-bar {
  width: 60px;
  height: 4px;
  background: var(--futaba-light);
  border-radius: 2px;
  overflow: hidden;
}

.pixiv8-chrome-memory-fill {
  height: 100%;
  background: var(--pixiv8-tier1);
  transition: width 0.3s ease;
}

.pixiv8-chrome-memory-fill.warning { background: var(--pixiv8-tier2); }
.pixiv8-chrome-memory-fill.critical { background: var(--pixiv8-tier3); }

/* === GPU使用率・WebGPU対応 === */
.pixiv8-chrome-gpu-meter {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
}

.pixiv8-chrome-renderer-type {
  font-weight: 500;
  text-transform: uppercase;
}

.pixiv8-chrome-renderer-type.webgpu { color: var(--pixiv8-tier1); }
.pixiv8-chrome-renderer-type.webgl2 { color: var(--pixiv8-tier2); }
.pixiv8-chrome-renderer-type.webgl { color: var(--pixiv8-tier3); }
```

## 🎛️ PixiV8Chrome統合アニメーション

### インタラクション・マイクロアニメーション
```css
/* === PixiV8Chrome統一トランジション === */
.pixiv8-chrome-interactive {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.pixiv8-chrome-interactive-slow {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === ツールボタン・クリック効果 === */
.pixiv8-chrome-tool-button {
  transform: translateY(0);
}

.pixiv8-chrome-tool-button:hover {
  transform: translateY(-1px) scale(1.05);
}

.pixiv8-chrome-tool-button:active {
  transform: translateY(0) scale(1.02);
  transition-duration: 0.1s;
}

/* === Tier変更・アニメーション === */
@keyframes pixiv8-tier-change {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.pixiv8-chrome-tier-indicator.changing {
  animation: pixiv8-tier-change 0.6s ease-out;
}

/* === パフォーマンス警告・パルス効果 === */
@keyframes pixiv8-performance-warning {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.pixiv8-chrome-performance-warning {
  animation: pixiv8-performance-warning 1s ease-in-out infinite;
}

/* === Chrome API検出・フェードイン === */
@keyframes pixiv8-api-detected {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.pixiv8-chrome-api-badge.detected {
  animation: pixiv8-api-detected 0.4s ease-out;
}
```

### 描画フィードバック・視覚効果
```css
/* === 描画開始・視覚フィードバック === */
.pixiv8-chrome-drawing-cursor {
  position: fixed;
  pointer-events: none;
  z-index: 10000;
  width: 24px;
  height: 24px;
  border: 2px solid var(--futaba-maroon);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.1s ease;
}

.pixiv8-chrome-drawing-cursor.active {
  opacity: 0.8;
}

.pixiv8-chrome-drawing-cursor.pressure-high {
  transform: translate(-50%, -50%) scale(1.5);
  border-width: 3px;
}

/* === ツール切り替え・スムーズ遷移 === */
@keyframes pixiv8-tool-switch {
  0% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(0.9) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.pixiv8-chrome-tool-button.switching {
  animation: pixiv8-tool-switch 0.3s ease-out;
}
```

## 📱 アクセシビリティ・ユーザビリティ

### キーボード操作・フォーカス管理
```css
/* === PixiV8Chrome統一フォーカス表示 === */
.pixiv8-chrome-focusable:focus-visible {
  outline: 2px solid var(--futaba-maroon);
  outline-offset: 2px;
  border-radius: 4px;
}

.pixiv8-chrome-focusable:focus:not(:focus-visible) {
  outline: none;
}

/* === スキップリンク・アクセシビリティ === */
.pixiv8-chrome-skip-link {
  position: absolute;
  top: -40px;
  left: 8px;
  background: var(--futaba-maroon);
  color: white;
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 10000;
  font-size: 14px;
}

.pixiv8-chrome-skip-link:focus {
  top: 8px;
}

/* === 高コントラスト・視認性向上 === */
@media (prefers-contrast: high) {
  :root {
    --futaba-maroon: #000000;
    --futaba-background: #ffffff;
    --text-primary: #000000;
    --futaba-light: #808080;
  }
  
  .pixiv8-chrome-tool-button {
    border-width: 2px;
  }
}

/* === 動き制限・アクセシビリティ配慮 === */
@media (prefers-reduced-motion: reduce) {
  .pixiv8-chrome-interactive,
  .pixiv8-chrome-interactive-slow,
  .pixiv8-chrome-tool-button {
    transition: none !important;
  }
  
  .pixiv8-chrome-tier-indicator.changing,
  .pixiv8-chrome-performance-warning,
  .pixiv8-chrome-api-badge.detected {
    animation: none !important;
  }
}

/* === ダークモード・システム設定対応 === */
@media (prefers-color-scheme: dark) {
  :root {
    --futaba-background: #1a1a1a;
    --futaba-cream: #2d2d2d;
    --futaba-light: #404040;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
  }
  
  .pixiv8-chrome-canvas-area {
    background: #1a1a1a;
  }
}
```

### 多言語・テキスト最適化
```css
/* === PixiV8Chrome統一フォント設定 === */
.pixiv8-chrome-text {
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
.pixiv8-chrome-text-japanese {
  font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  letter-spacing: 0.02em;
}

/* === 等幅フォント・数値表示 === */
.pixiv8-chrome-text-monospace {
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-variant-numeric: tabular-nums;
}

/* === テキストサイズ・階層表現 === */
.pixiv8-chrome-text-xs { font-size: 10px; } /* 性能表示・補助情報 */
.pixiv8-chrome-text-sm { font-size: 12px; } /* Tier表示・状態情報 */
.pixiv8-chrome-text-base { font-size: 14px; } /* 標準UI・ボタンテキスト */
.pixiv8-chrome-text-lg { font-size: 16px; } /* 強調・警告メッセージ */
```

## 🔧 Claude実装ガイドライン

### CSS命名・責任分界
```css
/* === 必須命名パターン・Claude理解最適化 === */

/* ❌ 規約違反・削除対象 */
.tool-button { /* 一般的すぎ・技術不明 */ }
.color-picker { /* プレフィックスなし */ }
.main-layout { /* 統一性なし */ }

/* ✅ 規約準拠・推奨 */
.pixiv8-chrome-tool-button { /* 技術明示・責任明確 */ }
.pixiv8-chrome-color-palette { /* 統一プレフィックス・機能明確 */ }
.pixiv8-chrome-main-layout { /* 一貫した命名・理解容易 */ }

/* === 責任分界・機能別分類 === */
.pixiv8-chrome-* { /* 全体統一・技術スタック明示 */ }
  ├─ *-layout { /* レイアウト制御・Grid・Flexbox */ }
  ├─ *-control { /* 制御要素・ボタン・入力 */ }
  ├─ *-display { /* 表示要素・情報・状態 */ }
  ├─ *-feedback { /* フィードバック・アニメーション */ }
  └─ *-state { /* 状態変化・インタラクション */ }
```

### 実装効率・Claude最適化
```css
/* === コンパクト設計・冗長性排除 === */
.pixiv8-chrome-common {
  /* 共通プロパティ・継承活用 */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
  font-family: inherit;
}

/* === 状態管理・BEM風命名 === */
.pixiv8-chrome-element { /* ベース */ }
.pixiv8-chrome-element--modifier { /* バリエーション */ }
.pixiv8-chrome-element__part { /* 部品 */ }
.pixiv8-chrome-element.is-active { /* 状態 */ }

/* === Tier対応・動的調整 === */
.pixiv8-chrome-adaptive {
  /* Tier1-3共通 */
}

.tier1 .pixiv8-chrome-adaptive {
  /* 高品質設定 */
}

.tier2 .pixiv8-chrome-adaptive {
  /* 標準品質設定 */
}

.tier3 .pixiv8-chrome-adaptive {
  /* 軽量設定 */
}
```

---

**このPixiV8Chrome統合UIスタイルガイドにより、技術スタック明示、責任分界明確化、Claude実装効率最大化、アクセシビリティ準拠、2.5K環境最適化を実現します。**