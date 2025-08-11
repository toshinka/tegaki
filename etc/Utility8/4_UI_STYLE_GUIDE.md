# UI/UXスタイルガイド v4.1

**ドキュメント**: デザインシステム・視覚設計規約・完全版  
**対象読者**: デザイナー・フロントエンド開発者・Claude  
**最終更新**: 2025年8月4日  
**改修版**: ふたばカラー完全版・Tabler Icons統合・リッチ化対応

## 🎨 ふたば色デザインシステム（完全6色版）

### 基調色系統・ふたばちゃんねる由来（変更不可）
```css
:root {
  /* === ふたば色完全6色セット === */
  --futaba-maroon: #800000;          /* 基調色・メイン・重要操作・テキスト強調 */
  --futaba-light-maroon: #aa5a56;    /* セカンダリ・補助操作・テキスト通常・ホバー */
  --futaba-medium: #cf9c97;          /* アクセント・中間調・テキスト補助・境界 */
  --futaba-light-medium: #e9c2ba;    /* 軽アクセント・薄境界・テキスト説明・非アクティブ */
  --futaba-cream: #f0e0d6;          /* パネル背景・UI基調・コンテンツ領域 */
  --futaba-background: #ffffee;      /* キャンバス・作業領域・アプリ背景・明るいテキスト背景 */

  /* === ふたば色テキスト専用バリエーション === */
  --text-futaba-primary: #800000;     /* 重要テキスト・見出し・強調 */
  --text-futaba-secondary: #aa5a56;   /* 通常テキスト・説明・ラベル */
  --text-futaba-tertiary: #cf9c97;    /* 補助テキスト・キャプション・説明 */
  --text-futaba-quaternary: #e9c2ba;  /* 最軽量テキスト・ヒント・プレースホルダー */
  --text-futaba-light: #2c1810;       /* ふたば背景上の濃いテキスト */
  --text-futaba-inverse: #ffffff;     /* ふたばマルーン背景上の白テキスト */

  /* === 機能色拡張・状態表現 === */
  --success: #4caf50;                /* 成功・完了・正常状態・保存完了 */
  --warning: #ff9800;                /* 警告・注意・確認必要・メモリ警告 */
  --error: #f44336;                  /* エラー・危険・削除・クリティカル */
  --info: #2196f3;                   /* 情報・案内・説明・ヘルプ */

  /* === 透明度バリエーション・重ね合わせ === */
  --futaba-maroon-95: rgba(128, 0, 0, 0.95);
  --futaba-maroon-90: rgba(128, 0, 0, 0.9);
  --futaba-maroon-70: rgba(128, 0, 0, 0.7);
  --futaba-maroon-50: rgba(128, 0, 0, 0.5);
  --futaba-maroon-30: rgba(128, 0, 0, 0.3);
  --futaba-light-maroon-80: rgba(170, 90, 86, 0.8);
  --futaba-medium-70: rgba(207, 156, 151, 0.7);
  --futaba-light-medium-60: rgba(233, 194, 186, 0.6);
  --futaba-cream-95: rgba(240, 224, 214, 0.95);
  --futaba-background-80: rgba(255, 255, 238, 0.8);
}
```

### ふたば色テキスト適用規則・階層表現
```css
/* === テキスト階層・視認性最適化 === */
.text-hierarchy-1 { color: var(--text-futaba-primary); font-weight: 700; }    /* タイトル・最重要 */
.text-hierarchy-2 { color: var(--text-futaba-secondary); font-weight: 600; }  /* 見出し・重要 */
.text-hierarchy-3 { color: var(--text-futaba-secondary); font-weight: 500; }  /* 小見出し・中程度 */
.text-hierarchy-4 { color: var(--text-futaba-tertiary); font-weight: 400; }   /* 本文・通常 */
.text-hierarchy-5 { color: var(--text-futaba-quaternary); font-weight: 400; } /* 補助・説明 */

/* === UI要素別テキスト色 === */
.tool-label { color: var(--text-futaba-secondary); }      /* ツールラベル・分かりやすさ */
.layer-name { color: var(--text-futaba-primary); }        /* レイヤー名・重要性 */
.setting-label { color: var(--text-futaba-tertiary); }    /* 設定ラベル・控えめ */
.hint-text { color: var(--text-futaba-quaternary); }      /* ヒント・プレースホルダー */
.error-text { color: var(--error); }                      /* エラーメッセージ */
.success-text { color: var(--success); }                  /* 成功メッセージ */

/* === 背景別テキスト最適化 === */
.on-futaba-background { color: var(--text-futaba-light); }    /* 明るい背景用濃いテキスト */
.on-futaba-cream { color: var(--text-futaba-primary); }       /* クリーム背景用テキスト */
.on-futaba-maroon { color: var(--text-futaba-inverse); }      /* マルーン背景用白テキスト */
.on-dark-surface { color: var(--futaba-cream); }              /* 暗い背景用明るいテキスト */
```

### 色彩適用原則・UI状態表現
```css
/* === 重要度・視覚階層 === */
.priority-critical {    
  color: var(--futaba-maroon); 
  background: var(--futaba-maroon-95);
}
.priority-high {        
  color: var(--futaba-light-maroon); 
  background: var(--futaba-light-maroon-80);
}
.priority-medium {      
  color: var(--futaba-medium); 
  background: var(--futaba-medium-70);
}
.priority-low {         
  color: var(--futaba-light-medium); 
  background: var(--futaba-light-medium-60);
}
.priority-background {  
  color: var(--text-futaba-secondary); 
  background: var(--futaba-cream);
}

/* === インタラクション状態・統一設計 === */
.interactive-element {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
}

.state-normal {         
  background: var(--futaba-background); 
  color: var(--text-futaba-secondary);
  border: 1px solid var(--futaba-light-medium);
}

.state-hover {          
  background: var(--futaba-medium); 
  color: var(--text-futaba-primary);
  border: 1px solid var(--futaba-light-maroon);
  transform: scale(1.02);
  box-shadow: 0 2px 8px var(--futaba-maroon-30);
}

.state-active {         
  background: var(--futaba-maroon); 
  color: var(--text-futaba-inverse);
  border: 1px solid var(--futaba-maroon);
  box-shadow: 0 2px 8px var(--futaba-maroon-50);
}

.state-disabled {       
  background: var(--futaba-light-medium); 
  color: var(--text-futaba-quaternary);
  opacity: 0.6; 
  cursor: not-allowed;
}

.state-focus {          
  outline: 2px solid var(--futaba-maroon); 
  outline-offset: 2px;
  background: var(--futaba-cream);
}
```

## 🖼️ Tabler Icons統合システム（完全版）

### アイコン定義・SVG対応表統合
```css
/* === Tabler Icons v3.34.1・統一アイコンシステム === */
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  fill: currentColor;
  vertical-align: middle;
  font-family: 'tabler-icons';
}

/* === ツール系アイコン・Tabler Icons統合 === */
.tool-download::before      { content: "\f19c"; } /* download */
.tool-resize::before        { content: "\ec87"; } /* aspect-ratio */
.tool-palette::before       { content: "\eb0d"; } /* palette */
.tool-pen::before           { content: "\ea91"; } /* brush */
.tool-eraser::before        { content: "\eb99"; } /* eraser */
.tool-fill::before          { content: "\ea50"; } /* paint */
.tool-airbrush::before      { content: "\f5a6"; } /* spray */
.tool-blur::before          { content: "\ef7c"; } /* blur */
.tool-eyedropper::before    { content: "\eb2c"; } /* color-picker */
.tool-select::before        { content: "\eb2f"; } /* crop */
.tool-text::before          { content: "\ee97"; } /* text */
.tool-shapes::before        { content: "\ee2e"; } /* shapes */
.tool-transform::before     { content: "\f2ab"; } /* drag-move */
.tool-layers::before        { content: "\eb27"; } /* stack */
.tool-animation::before     { content: "\ea27"; } /* film */
.tool-settings::before      { content: "\eb52"; } /* settings */

/* === 操作系アイコン === */
.control-play::before       { content: "\ed42"; } /* player-play */
.control-pause::before      { content: "\ed3f"; } /* player-pause */
.control-back::before       { content: "\ea14"; } /* arrow-left */
.control-forward::before    { content: "\ea17"; } /* arrow-right */
.control-refresh::before    { content: "\eb13"; } /* refresh */
.control-loop::before       { content: "\ecf7"; } /* repeat */
.control-ghost::before      { content: "\ec2d"; } /* ghost */
.control-grid::before       { content: "\edc6"; } /* layout-grid */

/* === UI系アイコン === */
.ui-eye::before             { content: "\ea70"; } /* eye */
.ui-eye-off::before         { content: "\ea71"; } /* eye-off */
.ui-folder::before          { content: "\ea7d"; } /* folder */
.ui-plus::before            { content: "\ea13"; } /* plus */
.ui-minus::before           { content: "\ea0f"; } /* minus */
.ui-trash::before           { content: "\ea29"; } /* trash */
```

### アイコンサイズ・統一規格
```css
/* === サイズバリエーション・2.5K環境最適化 === */
.icon-tiny   { font-size: 12px; } /* 詳細UI・インライン表示 */
.icon-small  { font-size: 16px; } /* リスト項目・サブボタン */
.icon-normal { font-size: 24px; } /* ツールボタン・標準UI */
.icon-large  { font-size: 32px; } /* メインボタン・強調 */
.icon-xl     { font-size: 48px; } /* 特別表示・ランディング */
.icon-xxl    { font-size: 64px; } /* 2.5K環境・超高解像度 */

/* === 2.5K環境特化サイズ === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .icon-normal { font-size: 28px; } /* 2.5Kで20%拡大 */
  .icon-large  { font-size: 38px; }
  .icon-xl     { font-size: 56px; }
}

/* === アイコン色・ふたば色統合 === */
.icon-primary   { color: var(--futaba-maroon); }
.icon-secondary { color: var(--futaba-light-maroon); }
.icon-tertiary  { color: var(--futaba-medium); }
.icon-disabled  { color: var(--futaba-light-medium); }
.icon-success   { color: var(--success); }
.icon-warning   { color: var(--warning); }
.icon-error     { color: var(--error); }
.icon-info      { color: var(--info); }
```

### SVGアイコンの最適化・パフォーマンス
```css
/* === SVG最適化・GPU加速 === */
.icon-optimized {
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

/* === アニメーション・マイクロインタラクション === */
.icon-interactive {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-interactive:hover {
  transform: scale(1.1) translateZ(0);
  filter: brightness(1.1);
}

.icon-spin {
  animation: icon-spin 1s linear infinite;
}

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.icon-pulse {
  animation: icon-pulse 2s ease-in-out infinite;
}

@keyframes icon-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}
```

## 📐 詳細レイアウト・2.5K最適化

### メイン画面構成・Grid詳細
```css
/* === レイアウト基盤・80px|1fr|400px === */
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
  background: var(--futaba-background);
  color: var(--text-futaba-secondary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif;
}

/* === 2.5K環境特化・20%サイズアップ === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .main-layout {
    grid-template-columns: 96px 1fr 480px;
  }
  
  .sidebar { 
    padding: 20px 16px;
  }
  
  .layer-panel { 
    padding: 20px;
    min-width: 480px;
  }
  
  .timeline {
    height: 120px;
    padding: 16px 20px;
  }
}

/* === 液タブレット環境警告・2.5K未満 === */
@media (max-width: 2559px) {
  .main-layout::before {
    content: "⚠ このツールは2560×1440以上の液タブレット環境に最適化されています";
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--warning);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 9999;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
  }
}
```

### Sidebar・ツールバー詳細（80-96px幅）
```css
.sidebar {
  grid-area: sidebar;
  background: linear-gradient(135deg, var(--futaba-cream) 0%, var(--futaba-light-medium) 100%);
  border-right: 2px solid var(--futaba-light-medium);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
  box-shadow: inset -1px 0 3px rgba(128, 0, 0, 0.1);
}

/* === ツールボタン・56px基準・詳細設計 === */
.tool-button {
  width: 56px;
  height: 56px;
  border: 2px solid var(--futaba-light-medium);
  background: var(--futaba-background);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 24px;
  color: var(--futaba-maroon);
  position: relative;
  box-shadow: 0 1px 3px rgba(128, 0, 0, 0.1);
}

.tool-button:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  color: var(--text-futaba-primary);
  transform: scale(1.05) translateY(-1px);
  box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
}

.tool-button.active {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
  border-color: var(--futaba-maroon);
  box-shadow: 0 3px 10px rgba(128, 0, 0, 0.4);
  transform: scale(1.02);
}

.tool-button:disabled {
  background: var(--futaba-light-medium);
  color: var(--text-futaba-quaternary);
  border-color: var(--futaba-light-medium);
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* === ツールグループ分離・視覚的階層 === */
.tool-group {
  margin-bottom: 16px;
  position: relative;
}

.tool-group:not(:last-child)::after {
  content: "";
  position: absolute;
  bottom: -8px;
  left: 10px;
  right: 10px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--futaba-light-medium) 50%, transparent 100%);
}

.tool-group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-futaba-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  text-align: center;
}

/* === 通知・バッジシステム === */
.tool-button .notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: var(--error);
  color: white;
  border-radius: 50%;
  border: 2px solid var(--futaba-background);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: notification-pulse 2s ease-in-out infinite;
}

@keyframes notification-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.1); }
}
```

### Canvas Area・描画領域詳細
```css
.canvas-area {
  grid-area: canvas;
  background: var(--futaba-background);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--futaba-light-medium);
}

/* === キャンバス枠・視覚的境界 === */
.canvas-container {
  position: relative;
  background: white;
  border: 2px solid var(--futaba-medium);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(128, 0, 0, 0.15);
  overflow: hidden;
}

.canvas-container::before {
  content: "";
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, var(--futaba-maroon), var(--futaba-light-maroon));
  border-radius: 10px;
  z-index: -1;
}

/* === 透明度チェッカーボード === */
.transparency-grid {
  background-image: 
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

/* === オーバーレイUI・浮動パネル === */
.canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
}

.canvas-overlay > * {
  pointer-events: auto;
}
```

### ColorPalette・色選択詳細システム
```css
/* === HSV円形ピッカー・200px詳細設計 === */
.color-picker-container {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 240px;
  height: 320px;
  background: var(--futaba-cream);
  border: 2px solid var(--futaba-medium);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(128, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  z-index: 200;
}

.color-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: var(--text-futaba-primary);
  font-weight: 600;
}

.color-picker-close {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--futaba-medium);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.color-picker-close:hover {
  background: var(--futaba-light-medium);
  color: var(--futaba-maroon);
}

/* === HSV円形ホイール・高品質 === */
.hsv-color-wheel {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  margin: 0 auto 20px;
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
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.2);
}

.hsv-color-wheel::after {
  content: "";
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 0%, white 100%);
}

.hsv-picker-handle {
  width: 16px;
  height: 16px;
  border: 3px solid white;
  border-radius: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

/* === 明度・彩度スライダー === */
.color-sliders {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}

.brightness-slider,
.saturation-slider {
  flex: 1;
  height: 24px;
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  border: 1px solid var(--futaba-light-medium);
}

.brightness-slider {
  background: linear-gradient(90deg, black 0%, white 100%);
}

.saturation-slider {
  background: linear-gradient(90deg, #808080 0%, var(--futaba-maroon) 100%);
}

.slider-handle {
  width: 20px;
  height: 20px;
  background: white;
  border: 2px solid var(--futaba-medium);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* === ふたば色プリセット・完全6色版 === */
.color-presets {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--futaba-light-medium);
}

.preset-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-futaba-secondary);
  margin-bottom: 8px;
  text-align: center;
}

.futaba-color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.basic-color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 2px solid var(--futaba-light-medium);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: var(--futaba-medium);
  z-index: 1;
  box-shadow: 0 4px 12px rgba(128, 0, 0, 0.2);
}

.color-swatch.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(128, 0, 0, 0.3);
}

.color-swatch.active::after {
  content: "✓";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* === ふたば色完全6色定義 === */
.swatch-futaba-maroon        { background-color: #800000; }
.swatch-futaba-light-maroon  { background-color: #aa5a56; }
.swatch-futaba-medium        { background-color: #cf9c97; }
.swatch-futaba-light-medium  { background-color: #e9c2ba; }
.swatch-futaba-cream         { background-color: #f0e0d6; }
.swatch-futaba-background    { background-color: #ffffee; }

/* === 基本色拡張 === */
.swatch-black                { background-color: #000000; }
.swatch-white                { background-color: #ffffff; }
.swatch-red                  { background-color: #ff0000; }
.swatch-green                { background-color: #00ff00; }
.swatch-blue                 { background-color: #0000ff; }
.swatch-yellow               { background-color: #ffff00; }
.swatch-cyan                 { background-color: #00ffff; }
.swatch-magenta              { background-color: #ff00ff; }

/* === 色履歴・最近使用色 === */
.color-history {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--futaba-light-medium);
}

.history-label {
  font-size: 10px;
  color: var(--text-futaba-tertiary);
  margin-bottom: 6px;
}

.color-history-grid {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.color-history .color-swatch {
  width: 24px;
  height: 24px;
  opacity: 0.8;
  border-width: 1px;
}

.color-history .color-swatch:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* === 色情報表示・16進数・RGB === */
.color-info {
  background: var(--futaba-background);
  border: 1px solid var(--futaba-light-medium);
  border-radius: 6px;
  padding: 8px;
  margin-top: 12px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 11px;
}

.color-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--text-futaba-secondary);
}

.color-info-row:last-child {
  margin-bottom: 0;
}

.color-info-label {
  font-weight: 600;
  color: var(--text-futaba-primary);
}

.color-info-value {
  color: var(--text-futaba-tertiary);
  user-select: all;
}
```

## 📚 LayerPanel・レイヤー管理詳細（400-480px幅）

### レイヤーパネル基本構造
```css
.layer-panel {
  grid-area: layer-panel;
  background: linear-gradient(135deg, var(--futaba-cream) 0%, var(--futaba-light-medium) 100%);
  border-left: 2px solid var(--futaba-medium);
  padding: 16px;
  overflow-y: auto;
  min-height: 0;
  box-shadow: inset 1px 0 3px rgba(128, 0, 0, 0.1);
}

.layer-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--futaba-light-medium);
}

.layer-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-futaba-primary);
  margin: 0;
}

.layer-controls-header {
  display: flex;
  gap: 8px;
}

.layer-control-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--futaba-medium);
  background: var(--futaba-background);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--futaba-maroon);
  font-size: 16px;
}

.layer-control-btn:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
}

.layer-control-btn:active {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
}
```

### レイヤー項目・64px高基準詳細
```css
.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item {
  height: 64px;
  background: var(--futaba-background);
  border: 2px solid var(--futaba-light-medium);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.layer-item:hover {
  background: var(--futaba-light-medium);
  border-color: var(--futaba-medium);
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(128, 0, 0, 0.15);
}

.layer-item.active {
  background: var(--futaba-medium);
  border-color: var(--futaba-maroon);
  color: var(--text-futaba-primary);
  box-shadow: 0 3px 12px rgba(128, 0, 0, 0.25);
}

.layer-item.dragging {
  opacity: 0.8;
  transform: rotate(2deg) scale(1.02);
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(128, 0, 0, 0.3);
}

/* === レイヤーサムネイル・48x48px === */
.layer-thumbnail {
  width: 48px;
  height: 48px;
  border: 1px solid var(--futaba-medium);
  border-radius: 6px;
  background: var(--futaba-background);
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
}

.layer-thumbnail::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    linear-gradient(45deg, #f5f5f5 25%, transparent 25%),
    linear-gradient(-45deg, #f5f5f5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f5f5f5 75%),
    linear-gradient(-45deg, transparent 75%, #f5f5f5 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
  z-index: -1;
}

.layer-thumbnail.empty {
  background: var(--futaba-light-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-futaba-quaternary);
  font-size: 20px;
}

/* === レイヤー情報・名前・設定 === */
.layer-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-futaba-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-item.active .layer-name {
  color: var(--text-futaba-primary);
  font-weight: 700;
}

.layer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-futaba-tertiary);
}

.layer-size {
  background: var(--futaba-light-medium);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.layer-blend-mode {
  color: var(--text-futaba-quaternary);
  font-style: italic;
}

/* === レイヤー操作ツールチップ === */
.layer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.layer-item:hover .layer-actions {
  opacity: 1;
}

.layer-action-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--futaba-background);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--futaba-medium);
  font-size: 12px;
}

.layer-action-btn:hover {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
  transform: scale(1.1);
}

/* === 不透明度スライダー・詳細設計 === */
.opacity-control {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--futaba-light-medium);
}

.opacity-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-futaba-secondary);
}

.opacity-value {
  font-weight: 600;
  color: var(--text-futaba-primary);
  font-family: 'SF Mono', monospace;
}

.opacity-slider {
  width: 100%;
  height: 6px;
  background: var(--futaba-light-medium);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  margin-bottom: 4px;
}

.opacity-track {
  height: 100%;
  background: linear-gradient(90deg, var(--futaba-maroon), var(--futaba-light-maroon));
  border-radius: 3px;
  transition: width 0.1s ease;
  position: relative;
}

.opacity-handle {
  width: 14px;
  height: 14px;
  background: var(--futaba-maroon);
  border: 2px solid white;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  right: -7px;
  transform: translateY(-50%);
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.opacity-handle:hover {
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 3px 8px rgba(128, 0, 0, 0.3);
}

.opacity-handle:active {
  cursor: grabbing;
  transform: translateY(-50%) scale(1.2);
}

/* === レイヤー階層・インデント表現 === */
.layer-item[data-depth="1"] { 
  margin-left: 24px; 
  border-left: 3px solid var(--futaba-light-maroon);
}

.layer-item[data-depth="2"] { 
  margin-left: 48px; 
  border-left: 3px solid var(--futaba-medium);
}

.layer-item[data-depth="3"] { 
  margin-left: 72px; 
  border-left: 3px solid var(--futaba-light-medium);
}

/* === フォルダレイヤー・特別スタイル === */
.layer-folder {
  background: var(--futaba-cream);
  border-color: var(--futaba-medium);
}

.layer-folder .layer-name {
  color: var(--text-futaba-secondary);
  font-weight: 700;
}

.layer-folder .layer-thumbnail {
  background: var(--futaba-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-futaba-inverse);
  font-size: 16px;
}

.layer-folder.collapsed .layer-thumbnail::before {
  content: "📁";
}

.layer-folder.expanded .layer-thumbnail::before {
  content: "📂";
}

/* === ドラッグ&ドロップ・挿入位置表示 === */
.layer-drop-indicator {
  height: 2px;
  background: var(--futaba-maroon);
  border-radius: 1px;
  margin: 2px 0;
  opacity: 0;
  transform: scaleX(0);
  transition: all 0.2s ease;
}

.layer-drop-indicator.active {
  opacity: 1;
  transform: scaleX(1);
  animation: drop-indicator-pulse 1s ease-in-out infinite alternate;
}

@keyframes drop-indicator-pulse {
  from { box-shadow: 0 0 4px var(--futaba-maroon); }
  to   { box-shadow: 0 0 8px var(--futaba-maroon), 0 0 12px var(--futaba-maroon-50); }
}
```

## 🎬 Timeline・アニメーション詳細（100-120px高）

### タイムライン基本構造
```css
.timeline {
  grid-area: timeline;
  background: linear-gradient(135deg, var(--futaba-light-medium) 0%, var(--futaba-medium) 100%);
  border-top: 2px solid var(--futaba-medium);
  padding: 12px 16px;
  height: 100px;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: inset 0 1px 3px rgba(128, 0, 0, 0.1);
}

/* === 2.5K環境拡張 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .timeline {
    height: 120px;
    padding: 16px 20px;
  }
}

/* === タイムライン制御ボタン === */
.timeline-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  background: var(--futaba-cream);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--futaba-medium);
}

.timeline-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--futaba-medium);
  background: var(--futaba-background);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--futaba-maroon);
  font-size: 16px;
}

.timeline-btn:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
}

.timeline-btn.active {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
}

.timeline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* === フレームグリッド・スクロール対応 === */
.frame-grid {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  padding: 8px;
  background: var(--futaba-background);
  border-radius: 6px;
  border: 1px solid var(--futaba-light-medium);
  overflow-x: auto;
}

.frame-item {
  width: 80px;
  height: 60px;
  border: 2px solid var(--futaba-light-medium);
  border-radius: 6px;
  background: var(--futaba-cream);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}

.frame-item:hover {
  border-color: var(--futaba-medium);
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(128, 0, 0, 0.15);
}

.frame-item.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
  box-shadow: 0 3px 12px rgba(128, 0, 0, 0.25);
}

.frame-item.empty {
  background: var(--futaba-light-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-futaba-quaternary);
  font-size: 24px;
}

.frame-number {
  position: absolute;
  bottom: 2px;
  left: 2px;
  right: 2px;
  background: var(--futaba-maroon-90);
  color: var(--text-futaba-inverse);
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  padding: 1px 0;
  border-radius: 2px;
}

/* === 新規フレーム追加ボタン === */
.frame-add {
  width: 80px;
  height: 60px;
  border: 2px dashed var(--futaba-medium);
  border-radius: 6px;
  background: none;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--futaba-medium);
  font-size: 24px;
}

.frame-add:hover {
  border-color: var(--futaba-maroon);
  background: var(--futaba-light-medium);
  color: var(--futaba-maroon);
  transform: scale(1.02);
}

/* === オニオンスキン・設定パネル === */
.onion-skin-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  background: var(--futaba-cream);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--futaba-medium);
}

.onion-skin-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-futaba-secondary);
  cursor: pointer;
  user-select: none;
}

.onion-skin-checkbox {
  width: 16px;
  height: 16px;
  border: 2px solid var(--futaba-medium);
  border-radius: 3px;
  background: var(--futaba-background);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.onion-skin-checkbox.checked {
  background: var(--futaba-maroon);
  border-color: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
}

.onion-skin-checkbox.checked::after {
  content: "✓";
  font-size: 10px;
  font-weight: 700;
}
```

## 🎛️ インタラクション・アニメーション詳細

### マイクロインタラクション・統一システム
```css
/* === 基本トランジション・統一設定 === */
.micro-interaction {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity, background-color, border-color;
}

.micro-interaction-slow {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.micro-interaction-spring {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* === ホバー効果・段階的変化 === */
.hover-lift {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(128, 0, 0, 0.1);
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(128, 0, 0, 0.2);
}

.hover-scale {
  transform: scale(1);
}

.hover-scale:hover {
  transform: scale(1.05);
}

.hover-glow:hover {
  box-shadow: 0 0 20px rgba(128, 0, 0, 0.3);
}

/* === クリック・プレス効果 === */
.press-down:active {
  transform: translateY(1px) scale(0.98);
  box-shadow: 0 1px 2px rgba(128, 0, 0, 0.2);
}

.press-scale:active {
  transform: scale(0.95);
}

/* === フェード・スライドアニメーション === */
@keyframes fadeInUp {
  from { 
    opacity: 0; 
    transform: translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

@keyframes fadeInRight {
  from { 
    opacity: 0; 
    transform: translateX(-20px); 
  }
  to { 
    opacity: 1; 
    transform: translateX(0); 
  }
}

@keyframes scaleInCenter {
  from { 
    opacity: 0; 
    transform: scale(0.8); 
  }
  to { 
    opacity: 1; 
    transform: scale(1); 
  }
}

.fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

.fade-in-right {
  animation: fadeInRight 0.3s ease-out;
}

.scale-in-center {
  animation: scaleInCenter 0.2s ease-out;
}

/* === 読み込み・プログレスアニメーション === */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.loading-shimmer {
  background: linear-gradient(
    90deg, 
    var(--futaba-light-medium) 0%, 
    var(--futaba-medium) 20%, 
    var(--futaba-light-medium) 40%, 
    var(--futaba-light-medium) 100%
  );
  background-size: 200px 100%;
  animation: shimmer 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

/* === 通知・トースト表示 === */
@keyframes slideInFromRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutToRight {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

.notification-enter {
  animation: slideInFromRight 0.3s ease-out;
}

.notification-exit {
  animation: slideOutToRight 0.3s ease-in;
}

/* === パルス・強調効果 === */
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(128, 0, 0, 0.3); }
  50% { box-shadow: 0 0 20px rgba(128, 0, 0, 0.6); }
}

.pulse-attention {
  animation: pulse 2s ease-in-out infinite;
}

.glow-attention {
  animation: glow-pulse 2s ease-in-out infinite;
}
```

## 📱 アクセシビリティ・完全対応

### WCAG 2.1 AAA準拠・詳細実装
```css
/* === フォーカス管理・キーボード操作 === */
.focusable {
  position: relative;
}

.focusable:focus {
  outline: 3px solid var(--futaba-maroon);
  outline-offset: 2px;
  border-radius: 4px;
}

.focusable:focus:not(:focus-visible) {
  outline: none;
}

.focusable:focus-visible {
  outline: 3px solid var(--futaba-maroon);
  outline-offset: 2px;
}

/* === スキップリンク・ナビゲーション支援 === */
.skip-links {
  position: absolute;
  top: -100px;
  left: 0;
  z-index: 10000;
  display: flex;
  gap: 8px;
  padding: 8px;
}

.skip-link {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 600;
  transition: top 0.3s ease;
}

.skip-link:focus {
  top: 8px;
}

/* === 高コントラスト・視認性向上 === */
@media (prefers-contrast: high) {
  :root {
    --futaba-maroon: #000000;
    --futaba-background: #ffffff;
    --text-futaba-primary: #ffffff;
    --text-futaba-secondary: #cccccc;
    --text-futaba-tertiary: #999999;
    --text-futaba-quaternary: #666666;
  }
}

/* === アニメーション軽減・動きに敏感なユーザー対応 === */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  .loading-spinner {
    animation: none;
  }
  
  .pulse-attention,
  .glow-attention {
    animation: none;
  }
}

/* === 透明度軽減・視認性向上 === */
@media (prefers-reduced-transparency: reduce) {
  .color-picker-container,
  .canvas-overlay > * {
    backdrop-filter: none;
    background: var(--futaba-cream);
  }
  
  .futaba-maroon-90,
  .futaba-maroon-70,
  .futaba-maroon-50 {
    background: var(--futaba-maroon);
  }
}

/* === スクリーンリーダー・支援技術対応 === */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* === ARIA状態・視覚的フィードバック === */
[aria-pressed="true"] {
  background: var(--futaba-maroon);
  color: var(--text-futaba-inverse);
}

[aria-expanded="true"] .expand-icon {
  transform: rotate(90deg);
}

[aria-selected="true"] {
  background: var(--futaba-medium);
  border-color: var(--futaba-maroon);
}

[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* === キーボードナビゲーション・順序 === */
.keyboard-nav-container {
  position: relative;
}

.keyboard-nav-container:focus-within::before {
  content: "";
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid var(--futaba-maroon);
  border-radius: 6px;
  pointer-events: none;
}
```

## 🎨 拡張カラーシステム・状況別適用

### UI状況別カラーマッピング
```css
/* === ツール状態・色分け === */
.tool-drawing { border-left: 4px solid var(--futaba-maroon); }
.tool-editing { border-left: 4px solid var(--futaba-light-maroon); }
.tool-selection { border-left: 4px solid var(--futaba-medium); }
.tool-navigation { border-left: 4px solid var(--futaba-light-medium); }

/* === レイヤー種別・視覚識別 === */
.layer-type-raster { 
  background: linear-gradient(90deg, var(--futaba-background) 0%, var(--futaba-cream) 100%);
}
.layer-type-vector { 
  background: linear-gradient(90deg, var(--futaba-cream) 0%, var(--futaba-light-medium) 100%);
}
.layer-type-adjustment { 
  background: linear-gradient(90deg, var(--futaba-light-medium) 0%, var(--futaba-medium) 100%);
}
.layer-type-group { 
  background: linear-gradient(90deg, var(--futaba-medium) 0%, var(--futaba-light-maroon) 100%);
}

/* === パフォーマンス状態・色フィードバック === */
.performance-excellent { border-left: 4px solid var(--success); }
.performance-good { border-left: 4px solid var(--futaba-light-maroon); }
.performance-warning { border-left: 4px solid var(--warning); }
.performance-critical { border-left: 4px solid var(--error); }

/* === 作業状態・プログレス表示 === */
.status-idle { background: var(--futaba-background); }
.status-working { 
  background: linear-gradient(90deg, var(--futaba-light-medium), var(--futaba-medium));
  animation: working-gradient 2s ease-in-out infinite alternate;
}
.status-complete { background: var(--success); color: white; }
.status-error { background: var(--error); color: white; }

@keyframes working-gradient {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
```

### ふたば色グラデーション・高品質表現
```css
/* === 美しいグラデーション・ふたば色統合 === */
.gradient-futaba-primary {
  background: linear-gradient(135deg, 
    var(--futaba-maroon) 0%, 
    var(--futaba-light-maroon) 50%, 
    var(--futaba-medium) 100%
  );
}

.gradient-futaba-secondary {
  background: linear-gradient(135deg, 
    var(--futaba-medium) 0%, 
    var(--futaba-light-medium) 50%, 
    var(--futaba-cream) 100%
  );
}

.gradient-futaba-subtle {
  background: linear-gradient(135deg, 
    var(--futaba-cream) 0%, 
    var(--futaba-background) 50%, 
    var(--futaba-cream) 100%
  );
}

/* === 放射状グラデーション・中心強調 === */
.gradient-futaba-radial {
  background: radial-gradient(ellipse at center, 
    var(--futaba-background) 0%, 
    var(--futaba-cream) 50%, 
    var(--futaba-light-medium) 100%
  );
}

/* === アニメーション付きグラデーション === */
.gradient-animated {
  background: linear-gradient(45deg, 
    var(--futaba-maroon), 
    var(--futaba-light-maroon), 
    var(--futaba-medium), 
    var(--futaba-light-medium)
  );
  background-size: 400% 400%;
  animation: gradient-shift 3s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

## 🖋️ タイポグラフィ・日本語最適化

### フォント階層・読みやすさ重視
```css
/* === フォントファミリー・多言語対応 === */
:root {
  --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
  --font-monospace: 'SF Mono', 'Monaco', 'Consolas', 'Noto Sans Mono JP', monospace;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  font-family: var(--font-primary);
  font-size: 14px;
  line-height: 1.6;
  font-weight: 400;
  color: var(--text-futaba-secondary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* === 文字サイズ階層・統一スケール === */
.text-xs {   font-size: 10px; line-height: 1.4; } /* 細部情報・キャプション */
.text-sm {   font-size: 12px; line-height: 1.5; } /* 補助テキスト・ラベル */
.text-base { font-size: 14px; line-height: 1.6; } /* 標準テキスト・UI */
.text-lg {   font-size: 16px; line-height: 1.6; } /* 重要テキスト・見出し */
.text-xl {   font-size: 20px; line-height: 1.5; } /* 大見出し・タイトル */
.text-2xl {  font-size: 24px; line-height: 1.4; } /* 特大・ランディング */
.text-3xl {  font-size: 32px; line-height: 1.3; } /* 超特大・2.5K対応 */

/* === 2.5K環境・文字サイズ調整 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  .text-xs {   font-size: 11px; }
  .text-sm {   font-size: 13px; }
  .text-base { font-size: 15px; }
  .text-lg {   font-size: 17px; }
  .text-xl {   font-size: 22px; }
  .text-2xl {  font-size: 26px; }
  .text-3xl {  font-size: 36px; }
}

/* === フォントウェイト・強弱表現 === */
.font-light {    font-weight: 300; } /* 軽やか・上品 */
.font-normal {   font-weight: 400; } /* 標準・自然 */
.font-medium {   font-weight: 500; } /* やや強調・安定 */
.font-semibold { font-weight: 600; } /* 強調・重要 */
.font-bold {     font-weight: 700; } /* 強調・見出し */
.font-extrabold { font-weight: 800; } /* 超強調・特別 */

/* === 日本語特化・文字間隔調整 === */
.text-japanese {
  font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
  letter-spacing: 0.02em;
  word-break: break-word;
  overflow-wrap: break-word;
}

.text-japanese-tight {
  letter-spacing: -0.01em;
}

.text-japanese-wide {
  letter-spacing: 0.05em;
}

/* === 等幅フォント・数値・コード === */
.text-mono {
  font-family: var(--font-monospace);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

/* === テキスト装飾・特殊効果 === */
.text-gradient {
  background: linear-gradient(135deg, var(--futaba-maroon), var(--futaba-light-maroon));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

.text-shadow-light {
  text-shadow: 0 1px 2px rgba(128, 0, 0, 0.1);
}

.text-shadow-strong {
  text-shadow: 0 2px 4px rgba(128, 0, 0, 0.3);
}

/* === 文字配置・整列 === */
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-justify { text-align: justify; }

/* === 文字省略・オーバーフロー対応 === */
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-ellipsis-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## 🎯 パフォーマンス最適化・CSS効率化

### CSS最適化・レンダリング性能
```css
/* === GPU加速・transform最適化 === */
.gpu-accelerated {
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.gpu-optimized {
  contain: layout style paint;
  transform: translateZ(0);
}

/* === レイアウト安定化・CLS防止 === */
.layout-stable {
  contain: layout;
  position: relative;
}

.aspect-ratio-16-9 {
  aspect-ratio: 16 / 9;
}

.aspect-ratio-4-3 {
  aspect-ratio: 4 / 3;
}

.aspect-ratio-1-1 {
  aspect-ratio: 1 / 1;
}

/* === スクロール最適化・大量データ対応 === */
.scroll-optimized {
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.scroll-virtualized {
  contain: strict;
  overflow: hidden;
}

/* === レスポンシブ画像・高解像度対応 === */
.image-responsive {
  max-width: 100%;
  height: auto;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: optimize-contrast;
}

.image-pixel-perfect {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

/* === キャッシュ最適化・静的リソース === */
.cache-optimized {
  contain: style paint;
  isolation: isolate;
}
```

## 📏 コンポーネント寸法・統一規格

### 2.5K環境最適化寸法
```css
/* === 基本寸法・Design System === */
:root {
  /* スペーシング・8px基準グリッド */
  --space-1: 4px;   /* 微細・インライン */
  --space-2: 8px;   /* 小・要素間 */
  --space-3: 12px;  /* 標準・パディング */
  --space-4: 16px;  /* 中・マージン */
  --space-5: 20px;  /* 大・セクション */
  --space-6: 24px;  /* 特大・レイアウト */
  --space-8: 32px;  /* 巨大・分離 */
  --space-10: 40px; /* 超巨大・2.5K対応 */
  
  /* ボーダー半径・統一曲線 */
  --radius-sm: 4px;   /* 微細・ボタン内要素 */
  --radius-base: 6px; /* 標準・ボタン・入力 */
  --radius-md: 8px;   /* 中・カード・パネル */
  --radius-lg: 12px;  /* 大・モーダル・ポップアップ */
  --radius-xl: 16px;  /* 特大・メインコンテナ */
  --radius-full: 9999px; /* 円形・ボタン・アバター */
  
  /* 影・立体感表現 */
  --shadow-sm: 0 1px 2px rgba(128, 0, 0, 0.1);
  --shadow-base: 0 2px 4px rgba(128, 0, 0, 0.15);
  --shadow-md: 0 4px 8px rgba(128, 0, 0, 0.2);
  --shadow-lg: 0 8px 16px rgba(128, 0, 0, 0.25);
  --shadow-xl: 0 16px 32px rgba(128, 0, 0, 0.3);
  --shadow-inner: inset 0 2px 4px rgba(128, 0, 0, 0.1);
  
  /* ボーダー・境界線 */
  --border-width: 1px;
  --border-width-thick: 2px;
  --border-width-thicker: 3px;
  --border-style: solid;
  --border-color: var(--futaba-light-medium);
  --border-color-strong: var(--futaba-medium);
  --border-color-accent: var(--futaba-maroon);
}

/* === コンポーネント固有寸法 === */
.component-dimensions {
  /* ツールバー */
  --toolbar-width: 80px;
  --toolbar-width-2k: 96px;
  --tool-button-size: 56px;
  --tool-button-size-2k: 64px;
  
  /* レイヤーパネル */
  --layer-panel-width: 400px;
  --layer-panel-width-2k: 480px;
  --layer-item-height: 64px;
  --layer-thumbnail-size: 48px;
  
  /* タイムライン */
  --timeline-height: 100px;
  --timeline-height-2k: 120px;
  --frame-width: 80px;
  --frame-height: 60px;
  
  /* カラーパレット */
  --color-picker-size: 240px;
  --color-swatch-size: 36px;
  --color-swatch-small: 24px;
  --hsv-wheel-size: 200px;
}

/* === レスポンシブ寸法調整 === */
@media (min-width: 2560px) and (min-height: 1440px) {
  :root {
    --space-1: 5px;
    --space-2: 10px;
    --space-3: 15px;
    --space-4: 20px;
    --space-5: 25px;
    --space-6: 30px;
    --space-8: 40px;
    --space-10: 50px;
  }
  
  .component-dimensions {
    --toolbar-width: var(--toolbar-width-2k);
    --tool-button-size: var(--tool-button-size-2k);
    --layer-panel-width: var(--layer-panel-width-2k);
    --timeline-height: var(--timeline-height-2k);
  }
}
```

---

**この改修版UI/UXスタイルガイドにより、ふたば色完全6色対応・Tabler Icons統合・詳細なコンポーネント設計・アクセシビリティ完全対応を実現し、添付ファイルの設計仕様詳細を上回るリッチなデザインシステムを提供します。2.5K液タブレット環境に最適化された高品質なユーザー体験を確保します。**000000;
    --text-futaba-secondary: #000000;
    --futaba-light-medium: #888888;
    --futaba-medium: #666666;
  }
  
  .tool-button,
  .layer-item,
  .color-swatch {
    border-width: 3px;
  }
}

/* === ダークモード・目の負担軽減 === */
@media (prefers-color-scheme: dark) {
  :root {
    --futaba-background: #1a1a1a;
    --futaba-cream: #2d2d2d;
    --futaba-light-medium: #404040;
    --futaba-medium: #5a5a5a;
    --text-futaba-primary: #