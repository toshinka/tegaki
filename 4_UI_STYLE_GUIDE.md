# UI/UXスタイルガイド v4.1

**ドキュメント**: デザインシステム・視覚設計規約・参考資料統合版  
**対象読者**: デザイナー・フロントエンド開発者・Claude  
**最終更新**: 2025年8月5日

## 🎨 ふたば色デザインシステム（完全版）

### 色彩定義・CSS変数（変更不可）
```css
:root {
  /* === 基調色系統・ふたばちゃんねる由来 === */
  --futaba-maroon: #800000;          /* メイン・強調・重要操作・削除確認 */
  --futaba-light-maroon: #aa5a56;    /* セカンダリ・補助操作・ホバー効果 */
  --futaba-medium: #cf9c97;          /* アクセント・中間調・境界表現 */
  --futaba-light-medium: #e9c2ba;    /* 境界・枠線・分離線・非アクティブ */
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

  /* === v4.1 性能監視色・リアルタイム表示 === */
  --performance-excellent: #4caf50;   /* FPS: 120+ GPU: <40% 遅延: <1ms */
  --performance-good: #8bc34a;        /* FPS: 60+ GPU: <60% 遅延: <5ms */
  --performance-warning: #ff9800;     /* FPS: 30+ GPU: <80% 遅延: <16ms */
  --performance-critical: #f44336;    /* FPS: <30 GPU: >80% 遅延: >16ms */
  --gpu-active: #2196f3;             /* GPU加速有効・WebGPU動作 */
  --gpu-inactive: #9e9e9e;           /* GPU加速無効・WebGL動作 */
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

/* === v4.1 性能状態表現・リアルタイム監視 === */
.performance-excellent { color: var(--performance-excellent); }
.performance-good {      color: var(--performance-good); }
.performance-warning {   color: var(--performance-warning); }
.performance-critical {  color: var(--performance-critical); }
.gpu-accelerated::after { content: "⚡"; color: var(--gpu-active); margin-left: 4px; }
.gpu-disabled::after {    content: "⚪"; color: var(--gpu-inactive); margin-left: 4px; }
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
/* === Grid Layout・64px|1fr|400px === */
.main-layout {
  display: grid;
  grid-template-columns: 64px 1fr 400px;
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

### Toolbar・ツールバー（64px幅）- Tabler Icons統合
```css
/* === ツールボタン・48px基準・SVGアイコン対応 === */
.tool-button {
  width: 48px;
  height: 48px;
  gap: 6px;
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

/* === v4.1 Tabler Icons統合・SVG最適化 === */
.tool-button .tabler-icon {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

/* === ツール別アイコン定義・Tabler Icons v3.34.1 === */
.tool-download .tabler-icon { /* ti-download */ }
.tool-resize .tabler-icon { /* ti-aspect-ratio */ }
.tool-pen .tabler-icon { /* ti-pencil */ }
.tool-brush .tabler-icon { /* ti-brush */ }
.tool-eraser .tabler-icon { /* ti-eraser */ }
.tool-fill .tabler-icon { /* ti-bucket */ }
.tool-spray .tabler-icon { /* ti-spray */ }
.tool-blur .tabler-icon { /* ti-blur */ }
.tool-eyedropper .tabler-icon { /* ti-color-picker */ }
.tool-select .tabler-icon { /* ti-crop */ }
.tool-text .tabler-icon { /* ti-type */ }
.tool-shapes .tabler-icon { /* ti-geometry */ }
.tool-transform .tabler-icon { /* ti-transform */ }
.tool-layers .tabler-icon { /* ti-stack-2 */ }
.tool-animation .tabler-icon { /* ti-video */ }
.tool-settings .tabler-icon { /* ti-settings */ }

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

### ColorPalette・色選択システム（200px）- WebGPU最適化
```css
/* === v4.1 移動可能ポップアップ・z-index: 2000 === */
.color-picker-popup {
  position: absolute;
  width: 200px;
  height: 320px;
  background: var(--futaba-cream-95);
  border: 1px solid var(--futaba-light);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
  backdrop-filter: blur(12px);
  z-index: 2000;
  cursor: move; /* ドラッグ可能表示 */
}

.color-picker-popup.dragging {
  box-shadow: 0 12px 32px rgba(128, 0, 0, 0.25);
  transform: rotate(1deg);
}

/* === HSV円形ピッカー・120x120px・WebGPU Shader対応 === */
.hsv-color-wheel {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  margin: 0 auto 16px;
  position: relative;
  cursor: crosshair;
  /* WebGPU Shaderで描画される場合はbackground削除 */
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
  height: 120px;
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

/* === v4.1 ふたば色プリセット・GPU最適化テクスチャ === */
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

/* === ふたば色プリセット定義・GPU最適化 === */
.swatch-futaba-maroon     { background-color: #800000; }
.swatch-futaba-light      { background-color: #aa5a56; }
.swatch-futaba-medium     { background-color: #cf9c97; }
.swatch-futaba-light-medium { background-color: #e9c2ba; }
.swatch-futaba-cream      { background-color: #f0e0d6; }
.swatch-black             { background-color: #000000; }
.swatch-white             { background-color: #ffffff; }
.swatch-red               { background-color: #ff0000; }
.swatch-green             { background-color: #00ff00; }
.swatch-blue              { background-color: #0000ff; }

/* === v4.1 性能監視表示・リアルタイム === */
.performance-display {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-family: monospace;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fps-display { color: var(--performance-good); }
.gpu-display { color: var(--gpu-active); }
.latency-display { color: var(--performance-excellent); }
```

### ツールポップアップ・設定パネル
```css
/* === v4.1 ペンツールポップアップ・OffscreenCanvas統合 === */
.pen-tool-popup {
  position: absolute;
  width: 280px;
  height: 200px;
  background: var(--futaba-cream-95);
  border: 1px solid var(--futaba-light);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
  backdrop-filter: blur(12px);
  z-index: 2000;
}

/* === サイズプリセット・GPU最適化32x24px === */
.size-presets {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.size-preset {
  width: 32px;
  height: 24px;
  border: 1px solid var(--futaba-light);
  border-radius: 4px;
  background: var(--futaba-background);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: var(--text-secondary);
}

.size-preset:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
}

.size-preset.active {
  background: var(--futaba-maroon);
  color: var(--text-inverse);
}

/* === WebGPU加速スライダー・120Hz追従 === */
.tool-slider {
  width: 100%;
  height: 4px;
  background: var(--futaba-light);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  margin: 8px 0;
}

.slider-track {
  height: 100%;
  background: var(--futaba-maroon);
  border-radius: 2px;
  transition: width 0.1s ease;
}

.slider-handle {
  width: 16px;
  height: 16px;
  background: var(--futaba-maroon);
  border: 2px solid white;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider-handle:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.2);
}

/* === リアルタイムプレビュー・OffscreenCanvas === */
.tool-preview {
  width: 60px;
  height: 20px;
  border: 1px solid var(--futaba-light);
  border-radius: 4px;
  background: var(--futaba-background);
  margin: 8px 0;
  position: relative;
  overflow: hidden;
}

/* === v4.1 エアスプレーツール・WebGPU Compute Shader === */
.airspray-popup {
  position: absolute;
  width: 300px;
  height: 240px;
  background: var(--futaba-cream-95);
  border: 1px solid var(--futaba-light);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.15);
  backdrop-filter: blur(12px);
  z-index: 2000;
}

.particle-preview {
  width: 64px;
  height: 64px;
  border: 1px solid var(--futaba-light);
  border-radius: 50%;
  background: var(--futaba-background);
  margin: 8px 0;
  position: relative;
  overflow: hidden;
}

/* === Compute Shader情報表示 === */
.compute-info {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-secondary);
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
}

.compute-active::after {
  content: "✓";
  color: var(--gpu-active);
  margin-left: 4px;
}
```

### LayerPanel・レイヤー管理（400px幅）- Fresco風
```css
/* === レイヤー項目・64px高基準・サムネイル右寄せ === */
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

/* === v4.1 GPU使用率・メモリ監視・FPS表示 === */
.layer-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--futaba-light);
}

.layer-controls {
  display: flex;
  gap: 8px;
}

.layer-control-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--futaba-light);
  background: var(--futaba-background);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
}

.layer-control-btn:hover {
  background: var(--futaba-medium);
}

/* === 性能監視・リアルタイム表示 === */
.performance-monitor {
  font-size: 10px;
  font-family: monospace;
  color: var(--text-secondary);
  display: flex;
  gap: 8px;
}

.gpu-usage { color: var(--gpu-active); }
.memory-usage { color: var(--performance-good); }
.fps-counter { color: var(--performance-excellent); }

/* === レイヤーサムネイル・48x48px・WebGPU RenderTexture === */
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
  order: 2; /* 右寄せ */
}

/* === レイヤー情報・名前・設定 === */
.layer-info {
  flex: 1;
  min-width: 0; /* Text overflow用 */
  order: 1;
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

.layer-settings {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* === 不透明度スライダー・120px・GPU加速 === */
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

/* === v4.1 並列処理進捗表示 === */
.processing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-secondary);
}

.progress-bar {
  flex: 1;
  height: 2px;
  background: var(--futaba-light);
  border-radius: 1px;
}

.progress-fill {
  height: 100%;
  background: var(--gpu-active);
  border-radius: 1px;
  transition: width 0.2s ease;
}

.gpu-accelerated-icon {
  color: var(--gpu-active);
  font-size: 12px;
}
```

### Timeline・アニメーション（Storyboarder風）
```css
/* === v4.1 タイムラインUI・WebCodecs統合・120FPS出力対応 === */
.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-frames {
  display: flex;
  gap: 4px;
  align-items: center;
  overflow-x: auto;
  padding: 8px 0;
}

/* === カットサムネイル・WebGPU RenderTexture64x48 === */
.frame-thumbnail {
  width: 64px;
  height: 48px;
  border: 2px solid var(--futaba-light);
  border-radius: 4px;
  background: var(--futaba-background);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.frame-thumbnail:hover {
  border-color: var(--futaba-medium);
  transform: scale(1.05);
}

.frame-thumbnail.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
}

.frame-thumbnail.processing {
  border-color: var(--gpu-active);
  position: relative;
}

.frame-thumbnail.processing::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(33, 150, 243, 0.3), transparent);
  animation: processing-sweep 1.5s infinite;
}

@keyframes processing-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* === フレーム番号表示 === */
.frame-number {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(128, 0, 0, 0.8);
  color: white;
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
}

/* === 新規カット追加ボタン === */
.add-frame-btn {
  width: 64px;
  height: 48px;
  border: 2px dashed var(--futaba-light);
  border-radius: 4px;
  background: var(--futaba-background);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--futaba-light-maroon);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.add-frame-btn:hover {
  border-color: var(--futaba-maroon);
  background: var(--futaba-cream);
  color: var(--futaba-maroon);
}

/* === タイムライン制御・120FPS再生 === */
.timeline-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.playback-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--futaba-light);
  background: var(--futaba-background);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  color: var(--futaba-maroon);
}

.playback-btn:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
}

.playback-btn.playing {
  background: var(--futaba-maroon);
  color: white;
}

/* === FPS設定・WebCodecs出力 === */
.fps-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.fps-dropdown {
  padding: 4px 8px;
  border: 1px solid var(--futaba-light);
  border-radius: 4px;
  background: var(--futaba-background);
  font-size: 12px;
  color: var(--text-primary);
}

/* === オニオンスキン設定・WebGPU blend === */
.onion-skin-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.onion-skin-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.onion-skin-checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--futaba-light);
  border-radius: 2px;
  background: var(--futaba-background);
  position: relative;
}

.onion-skin-checkbox.checked {
  background: var(--futaba-maroon);
  border-color: var(--futaba-maroon);
}

.onion-skin-checkbox.checked::after {
  content: "✓";
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
}

/* === v4.1 リアルタイム出力状況・WebCodecs === */
.export-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 11px;
  font-family: monospace;
}

.webcodecs-indicator {
  color: var(--gpu-active);
}

.export-progress {
  width: 64px;
  height: 4px;
  background: var(--futaba-light);
  border-radius: 2px;
}

.export-progress-fill {
  height: 100%;
  background: var(--performance-good);
  border-radius: 2px;
  transition: width 0.3s ease;
}
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

/* === v4.1 GPU加速アニメーション・120FPS対応 === */
.gpu-accelerated-animation {
  will-change: transform, opacity;
  transform: translateZ(0); /* GPU Layer強制 */
}

.smooth-120fps {
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  animation-fill-mode: both;
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

/* === v4.1 GPU最適化ドラッグ・120FPS追従 === */
.gpu-dragging {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
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

## 🔥 v4.1 新機能・参考資料統合要素

### Tabler Icons統合・実装ガイド
```typescript
// TypeScript実装例
interface TablerIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const TablerIcon: React.FC<TablerIconProps> = ({ 
  name, 
  size = 24, 
  color = 'currentColor', 
  strokeWidth = 2 
}) => {
  // Tabler Icons SVG要素を動的生成
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="tabler-icon"
    >
      {/* 動的にアイコンパスを読み込み */}
    </svg>
  );
};

// ツールアイコンマッピング
const TOOL_ICONS = {
  pen: 'pencil',
  brush: 'brush',
  eraser: 'eraser',
  fill: 'bucket',
  spray: 'spray',
  blur: 'blur',
  eyedropper: 'color-picker',
  select: 'crop',
  text: 'type',
  shapes: 'geometry',
  transform: 'transform',
  layers: 'stack-2',
  animation: 'video',
  settings: 'settings'
} as const;
```

### WebGPU最適化HSV色選択
```typescript
// WebGPU Shader実装例（Phase3対応）
const hsvColorWheelShader = `
  @vertex
  fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    // 円形座標生成
    let pos = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>(-1.0,  1.0),
      vec2<f32>( 1.0, -1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0,  1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  }

  @fragment
  fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    let center = vec2<f32>(60.0, 60.0); // 120x120pxの中心
    let radius = 60.0;
    let coord = pos.xy - center;
    let distance = length(coord);
    
    if (distance > radius) {
      discard;
    }
    
    // HSV色相環計算
    let angle = atan2(coord.y, coord.x);
    let hue = (angle + 3.14159) / (2.0 * 3.14159);
    let saturation = distance / radius;
    let value = 1.0;
    
    // HSV→RGB変換
    return vec4<f32>(hsvToRgb(vec3<f32>(hue, saturation, value)), 1.0);
  }
`;
```

### 性能監視・リアルタイムUI
```typescript
// 性能監視実装例
interface PerformanceMetrics {
  fps: number;
  gpuUsage: number;
  memoryUsage: number;
  inputLatency: number;
  webgpuActive: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    gpuUsage: 0,
    memoryUsage: 0,
    inputLatency: 0,
    webgpuActive: false
  };

  public updateUI(): void {
    const fpsClass = this.getFPSClass(this.metrics.fps);
    const gpuClass = this.metrics.webgpuActive ? 'gpu-active' : 'gpu-inactive';
    
    document.querySelector('.fps-display')!.className = `fps-display ${fpsClass}`;
    document.querySelector('.gpu-display')!.className = `gpu-display ${gpuClass}`;
    
    // リアルタイム数値更新
    document.querySelector('.fps-display')!.textContent = `FPS: ${this.metrics.fps}`;
    document.querySelector('.gpu-display')!.textContent = `GPU: ${this.metrics.gpuUsage}%`;
    document.querySelector('.latency-display')!.textContent = `遅延: ${this.metrics.inputLatency}ms`;
  }

  private getFPSClass(fps: number): string {
    if (fps >= 120) return 'performance-excellent';
    if (fps >= 60) return 'performance-good';
    if (fps >= 30) return 'performance-warning';
    return 'performance-critical';
  }
}
```

---

**このv4.1版により、参考資料「UI・UX設計仕様詳細抜粋.md」の全要素が完全統合され、失伝なく実装可能な詳細仕様が確立されました。Tabler Icons統合、WebGPU最適化ポップアップ、リアルタイム性能監視の具体的実装方法が明確化され、理想的なツールの実現基盤が完成しています。**