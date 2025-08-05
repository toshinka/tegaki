# UIスタイルガイド v2.0

**最終更新**: 2025年8月6日  
**コンセプト**: Adobe Fresco風 × ふたば☆ちゃんねるカラー デザインシステム  
**対象解像度**: 2.5K主体（2K-4K対応）・36pxアイコン最適化

## 🎨 ふたば☆ちゃんねるカラーシステム

### 基本カラーパレット（Adobe Fresco風適用）
```css
:root {
  /* ふたば色システム完全定義（16進数値厳密） */
  --futaba-maroon: #800000;        /* 主線・基調色・RGB(128,0,0) */
  --futaba-light-maroon: #aa5a56;  /* セカンダリ・ボタン・RGB(170,90,86) */
  --futaba-medium: #cf9c97;        /* アクセント・ホバー・RGB(207,156,151) */
  --futaba-light-medium: #e9c2ba;  /* 境界線・分離線・RGB(233,194,186) */
  --futaba-cream: #f0e0d6;         /* キャンバス背景・RGB(240,224,214) */
  --futaba-background: #ffffee;    /* アプリ背景・RGB(255,255,238) */
  
  /* アイコンサイズ（2.5K解像度最適化） */
  --icon-size-small: 24px;         /* 補助アイコン */
  --icon-size-medium: 36px;        /* メインツール（Phase1基本） */
  --icon-size-large: 48px;         /* 強調表示（Phase2拡張） */
  
  /* レイアウト基本単位 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* 角丸・影効果 */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
  --shadow-sm: 0 2px 4px rgba(128, 0, 0, 0.1);
  --shadow-md: 0 4px 8px rgba(128, 0, 0, 0.15);
  --shadow-lg: 0 8px 16px rgba(128, 0, 0, 0.2);
}
```

### 色の使い分け・心理効果
```typescript
interface ColorUsage {
  // 主要色（描画・強調）
  primary: {
    color: '--futaba-maroon'; // #800000
    usage: ['主線描画', 'アクティブ状態', '重要ボタン'];
    emotion: '安定感・伝統・集中';
  };
  
  // セカンダリ色（UI要素）
  secondary: {
    color: '--futaba-light-maroon'; // #aa5a56
    usage: ['ツールボタン', 'セカンダリUI', 'ホバー前状態'];
    emotion: '親しみやすさ・アクセシビリティ';
  };
  
  // 背景色（環境・雰囲気）
  background: {
    app: '--futaba-background'; // #ffffee - 温かみのある白
    canvas: '--futaba-cream'; // #f0e0d6 - 紙の質感
    emotion: '集中環境・目に優しい・長時間作業対応';
  };
}
```

## 🏗️ レイアウトシステム（Adobe Fresco風）

### Grid Layout基本構成
```css
/* Phase1: 基本2列レイアウト */
.main-layout {
  display: grid;
  grid-template-columns: 64px 1fr; /* ツールバー | メインエリア */
  grid-template-rows: 1fr;
  height: 100vh;
  width: 100vw;
  gap: 0;
}

/* Phase2拡張: 3列レイアウト準備 */
.main-layout-expanded {
  grid-template-columns: 64px 1fr 320px; /* ツールバー | キャンバス | パネル */
}

/* Phase3完全版: 4列レイアウト */
.main-layout-full {
  grid-template-columns: 64px 280px 1fr 320px; /* ツール | カラー | キャンバス | レイヤー */
}
```

### レスポンシブ対応（2K-4K）
```css
/* 2K解像度（1920x1080）最小保証 */
@media (max-width: 1920px) {
  :root {
    --icon-size-medium: 32px; /* アイコン縮小 */
    --spacing-md: 12px;
  }
  
  .main-layout {
    grid-template-columns: 56px 1fr; /* ツールバー縮小 */
  }
}

/* 4K解像度（3840x2160）最適化 */
@media (min-width: 3840px) {
  :root {
    --icon-size-medium: 42px; /* アイコン拡大 */
    --spacing-md: 20px;
  }
  
  .main-layout-full {
    grid-template-columns: 80px 320px 1fr 400px; /* 全体拡大 */
  }
}
```

## 🔧 ツールバー設計（Adobe Fresco準拠）

### 基本ツールボタン（36px・Phase1）
```css
.tool-button {
  width: var(--icon-size-medium); /* 36px */
  height: var(--icon-size-medium);
  border: 1px solid var(--futaba-light-medium);
  background: var(--futaba-background);
  border-radius: var(--border-radius-md); /* 8px */
  
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  /* Adobe Fresco風トランジション */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  font-size: 18px; /* 36px内で適切なアイコンサイズ */
  color: var(--futaba-maroon);
  position: relative;
}

/* インタラクション状態 */
.tool-button:hover {
  background: var(--futaba-medium);
  border-color: var(--futaba-light-maroon);
  transform: scale(1.05);
  box-shadow: var(--shadow-sm);
}

.tool-button.active {
  background: var(--futaba-maroon);
  color: white;
  border-color: var(--futaba-maroon);
  box-shadow: var(--shadow-md);
}

.tool-button:active {
  transform: scale(0.98);
}
```

### ツールバー配置・階層
```css
.toolbar {
  background: var(--futaba-cream);
  border-right: 1px solid var(--futaba-light-medium);
  
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md) 12px;
  gap: var(--spacing-sm);
  
  /* Adobe Fresco風影効果 */
  box-shadow: 2px 0 8px rgba(128, 0, 0, 0.08);
  
  /* ツールグループ分離（Phase2） */
  .tool-group {
    border-bottom: 1px solid var(--futaba-light-medium);
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }
  
  .tool-group:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
}
```

## 🎨 カラーシステム・パレット

### ふたば色パレット（Phase1基本）
```css
.futaba-color-palette {
  position: absolute;
  top: 20px;
  right: 20px;
  
  background: var(--futaba-cream);
  border: 1px solid var(--futaba-light-medium);
  border-radius: var(--border-radius-lg); /* 12px */
  padding: var(--spacing-md);
  
  display: flex;
  gap: var(--spacing-sm);
  
  /* Adobe Fresco風浮遊効果 */
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px); /* 背景ぼかし */
  
  /* Phase2で移動可能準備 */
  cursor: move;
  user-select: none;
}

/* 32px色スウォッチ */
.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-sm); /* 6px */
  border: 2px solid var(--futaba-light-medium);
  cursor: pointer;
  
  transition: all 0.2s ease-out;
  position: relative;
  
  /* 色名ツールチップ準備 */
  &::before {
    content: attr(title);
    position: absolute;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }
  
  &:hover::before {
    opacity: 1;
  }
}

.color-swatch:hover {
  transform: scale(1.15);
  border-color: var(--futaba-maroon);
  box-shadow: var(--shadow-sm);
}

.color-swatch.active {
  border-color: var(--futaba-maroon);
  border-width: 3px;
  box-shadow: 0 0 12px rgba(128, 0, 0, 0.4);
  transform: scale(1.1);
}
```

### HSV円形カラーピッカー（Phase2準備）
```css
.hsv-color-picker {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  position: relative;
  cursor: crosshair;
  
  /* WebGL2シェーダー背景（Phase1は簡易版） */
  background: conic-gradient(
    from 0deg,
    hsl(0deg 100% 50%),
    hsl(60deg 100% 50%),
    hsl(120deg 100% 50%),
    hsl(180deg 100% 50%),
    hsl(240deg 100% 50%),
    hsl(300deg 100% 50%),
    hsl(360deg 100% 50%)
  );
  
  /* 明度グラデーション重ね */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      circle,
      transparent 0%,
      rgba(0, 0, 0, 0.8) 100%
    );
  }
  
  /* 選択インジケーター */
  .color-indicator {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
}
```

## 📚 レイヤーパネル（Adobe Fresco風・Phase2準備）

### レイヤーパネル基本構造
```css
.layer-panel {
  width: 320px;
  background: var(--futaba-cream);
  border-left: 1px solid var(--futaba-light-medium);
  
  display: flex;
  flex-direction: column;
  
  /* ヘッダー・コンテンツ・フッター */
  .panel-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--futaba-light-medium);
    background: var(--futaba-background);
    
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    h3 {
      margin: 0;
      color: var(--futaba-maroon);
      font-size: 14px;
      font-weight: 600;
    }
    
    .panel-controls {
      display: flex;
      gap: var(--spacing-xs);
      
      button {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--futaba-maroon);
        cursor: pointer;
        border-radius: var(--border-radius-sm);
        
        &:hover {
          background: var(--futaba-light-medium);
        }
      }
    }
  }
  
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm);
    
    /* カスタムスクロールバー */
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: var(--futaba-light-medium);
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--futaba-medium);
      border-radius: 4px;
      
      &:hover {
        background: var(--futaba-light-maroon);
      }
    }
  }
}
```

### レイヤー項目デザイン
```css
.layer-item {
  background: var(--futaba-background);
  border: 1px solid var(--futaba-light-medium);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-sm);
  padding: var(--spacing-sm);
  
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--futaba-medium);
    background: rgba(207, 156, 151, 0.1);
  }
  
  &.active {
    border-color: var(--futaba-maroon);
    background: rgba(128, 0, 0, 0.05);
  }
  
  /* 表示/非表示アイコン */
  .visibility-toggle {
    width: 20px;
    height: 20px;
    color: var(--futaba-maroon);
    cursor: pointer;
    
    &.hidden {
      opacity: 0.3;
    }
  }
  
  /* 64x64pxサムネイル */
  .layer-thumbnail {
    width: 48px;
    height: 48px;
    border: 1px solid var(--futaba-light-medium);
    border-radius: var(--border-radius-sm);
    background: var(--futaba-cream);
    flex-shrink: 0;
    
    /* Photoshop風市松模様（透明時） */
    &.transparent {
      background-image: 
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    }
  }
  
  /* レイヤー情報 */
  .layer-info {
    flex: 1;
    min-width: 0; /* テキスト省略対応 */
    
    .layer-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--futaba-maroon);
      margin-bottom: 2px;
      
      /* 長い名前の省略 */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .layer-type {
      font-size: 11px;
      color: var(--futaba-medium);
    }
  }
  
  /* 不透明度スライダー（Phase2） */
  .opacity-control {
    width: 60px;
    height: 4px;
    background: var(--futaba-light-medium);
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    
    .opacity-fill {
      height: 100%;
      background: var(--futaba-maroon);
      border-radius: inherit;
      transition: width 0.1s ease;
    }
    
    .opacity-handle {
      position: absolute;
      top: -4px;
      width: 12px;
      height: 12px;
      background: white;
      border: 2px solid var(--futaba-maroon);
      border-radius: 50%;
      transform: translateX(-50%);
      cursor: grab;
      
      &:active {
        cursor: grabbing;
      }
    }
  }
}
```

## 🎬 アニメーション・トランジション

### 基本アニメーション原則
```css
/* Adobe Fresco風イージング */
:root {
  --ease-out-cubic: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in-cubic: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out-cubic: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* アニメーション時間 */
  --duration-fast: 0.15s;
  --duration-normal: 0.2s;
  --duration-slow: 0.3s;
}

/* ホバー効果（統一） */
.interactive-element {
  transition: all var(--duration-normal) var(--ease-out-cubic);
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  &:active {
    transform: translateY(0px);
    transition-duration: var(--duration-fast);
  }
}

/* フェードイン・アウト */
.fade-enter {
  opacity: 0;
  transform: translateY(8px);
}

.fade-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all var(--duration-normal) var(--ease-out-cubic);
}

/* スケール効果（ツールアクティブ時） */
.scale-active {
  animation: scaleUp var(--duration-normal) var(--ease-out-cubic);
}

@keyframes scaleUp {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
```

### ポップアップ・モーダル（Phase2準備）
```css
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  z-index: 1000;
  
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* アニメーション */
  opacity: 0;
  animation: fadeInOverlay var(--duration-normal) var(--ease-out-cubic) forwards;
}

.popup-content {
  background: var(--futaba-cream);
  border: 1px solid var(--futaba-light-medium);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  
  max-width: 90vw;
  max-height: 90vh;
  
  /* アニメーション */
  transform: scale(0.9) translateY(20px);
  animation: popupEnter var(--duration-normal) var(--ease-out-cubic) forwards;
}

@keyframes fadeInOverlay {
  to { opacity: 1; }
}

@keyframes popupEnter {
  to { 
    transform: scale(1) translateY(0);
  }
}
```

## 📱 アクセシビリティ・ユーザビリティ

### カラーアクセシビリティ
```css
/* ハイコントラストモード対応 */
@media (prefers-contrast: high) {
  :root {
    --futaba-maroon: #600000; /* より濃い赤 */
    --futaba-background: #ffffff; /* 純白背景 */
  }
  
  .tool-button {
    border-width: 2px; /* 境界線強化 */
  }
}

/* 色盲対応（色だけに依存しない設計） */
.active-indicator {
  /* 色だけでなく形状・アイコンでも状態表示 */
  &::after {
    content: '●';
    position: absolute;
    top: -2px;
    right: -2px;
    color: var(--futaba-maroon);
    font-size: 8px;
  }
}
```

### キーボードナビゲーション
```css
/* フォーカス表示（統一） */
.focusable {
  outline: none;
  
  &:focus-visible {
    outline: 2px solid var(--futaba-maroon);
    outline-offset: 2px;
  }
}

/* タブオーダー視覚化（開発時） */
.debug-focus {
  &:focus-visible::before {
    content: attr(data-tab-index);
    position: absolute;
    top: -20px;
    left: 0;
    background: var(--futaba-maroon);
    color: white;
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 10px;
  }
}
```

## 🔧 開発者ツール・デバッグUI

### 性能監視UI（Phase1基本）
```css
.performance-monitor {
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  font-family: monospace;
  font-size: 11px;
  z-index: 9999;
  
  /* 開発モードでのみ表示 */
  display: none;
  
  &.dev-mode {
    display: block;
  }
  
  .metric {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    
    .label { color: #ccc; }
    .value { color: #4ade80; }
    
    &.warning .value { color: #fbbf24; }
    &.critical .value { color: #ef4444; }
  }
}
```

### グリッド・ガイド表示（開発用）
```css
.debug-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10000;
  
  /* Grid Layout可視化 */
  background-image: 
    linear-gradient(rgba(128, 0, 0, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(128, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  
  /* 主要ブレークポイント表示 */
  &::after {
    content: '2.5K Mode';
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--futaba-maroon);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
}

@media (max-width: 1920px) {
  .debug-grid::after { content: '2K Mode'; }
}

@media (min-width: 3840px) {
  .debug-grid::after { content: '4K Mode'; }
}
```

## 📏 サイズ・スペーシング仕様

### アイコンサイズ基準（解像度対応）
```typescript
interface IconSizes {
  '2K': {
    small: '20px';
    medium: '32px'; // Phase1メインツール
    large: '40px';
  };
  '2.5K': {
    small: '24px';
    medium: '36px'; // Phase1メインツール（基準）
    large: '48px';
  };
  '4K': {
    small: '28px';
    medium: '42px'; // Phase1メインツール
    large: '56px';
  };
}
```

### コンポーネントサイズ仕様
```css
/* ツールバー */
.toolbar {
  width: 64px; /* 2.5K基準 */
  min-height: 100vh;
}

/* カラーパレット */
.futaba-color-palette {
  min-width: 240px; /* 6色 × 32px + spacing */
  height: auto;
}

/* レイヤーパネル */
.layer-panel {
  width: 320px; /* 2.5K基準 */
  min-width: 280px;
  max-width: 400px;
}

/* キャンバス領域 */
.canvas-area {
  min-width: 768px; /* 最小キャンバスサイズ保証 */
  min-height: 768px;
}
```

## 🎨 テーマ・バリエーション（将来拡張）

### ライト・ダークテーマ準備
```css
/* ライトテーマ（デフォルト） */
[data-theme="light"] {
  --background-primary: var(--futaba-background);
  --background-secondary: var(--futaba-cream);
  --text-primary: var(--futaba-maroon);
  --text-secondary: var(--futaba-medium);
}

/* ダークテーマ（Phase3実装予定） */
[data-theme="dark"] {
  --background-primary: #1a1a1a;
  --background-secondary: #2d2d2d;
  --text-primary: #e9c2ba; /* ふたばライト */
  --text-secondary: #cf9c97; /* ふたばミディアム */
  
  /* ふたば色はそのまま維持 */
  --futaba-maroon: #aa5a56; /* 少し明るく調整 */
}
```

このUIスタイルガイドにより、Adobe Frescoの洗練されたUXとふたば☆ちゃんねるの親しみやすいカラーリングが融合した、統一感のある美しいデザインシステムを実現します。36pxアイコンを基準とした2.5K最適化により、現代的な高解像度環境で最適な視認性と操作性を提供します。