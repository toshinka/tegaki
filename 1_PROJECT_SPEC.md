# プロジェクト仕様書 v2.0

**最終更新**: 2025年8月6日  
**対象**: Adobe Fresco風 ふたば☆ちゃんねるカラー お絵描きツール  
**技術基盤**: PixiJS v8.11.0 + WebGL2 + TypeScript 5.0+

## 🎨 プロジェクト概要

### コンセプト
Adobe Frescoの優れたUXにふたば☆ちゃんねるの親しみやすいカラーリングを融合した、直感的で高性能なベクター描画ツール

### 核心価値
- **ベクターペン至上主義**: 滑らかで美しい線質を最優先
- **ふたば色の温かみ**: #800000主線、#ffffee背景の親しみやすさ  
- **段階的成長**: Phase1基盤→Phase4高度機能の確実な発展
- **車輪の再発明防止**: 実績あるライブラリとの適切な統合

### 対象環境
- **解像度**: 2.5K主体（2560×1440）・2K-4K対応
- **デバイス**: デスクトップ・タブレット（マウス・タッチ・ペン入力）
- **ブラウザ**: Chrome/Edge最新版・Firefox・Safari v16+

## 🏗️ 技術アーキテクチャ概要

### 基盤技術スタック
```typescript
interface TechFoundation {
  // 描画・レンダリング
  engine: 'PixiJS v8.11.0';
  graphics: 'WebGL2' | 'WebGPU'; // 段階対応
  
  // 開発環境
  language: 'TypeScript 5.0+';
  bundler: 'Vite 5.0+';
  
  // UI・デザイン
  icons: '@tabler/icons v3.34.1'; // 36px SVGアイコン
  colors: 'ふたば色システム'; // #800000, #f0e0d6等
  
  // 入力・処理
  input: 'Pointer Events API'; // 120Hz対応準備
  performance: 'PerformanceObserver'; // 監視・最適化
}
```

### ライブラリ戦略（車輪の再発明防止）
```json
{
  "必須ライブラリ": {
    "pixi.js": "^8.11.0",
    "@tabler/icons": "^3.34.1"
  },
  "Phase2検討": {
    "color-convert": "HSV↔RGB変換",
    "bezier-js": "ベジエ曲線最適化"
  },
  "除外": [
    "jQuery系（現代的でない）",
    "React/Vue（PixiJSと競合）",
    "Canvas系（用途重複）"
  ]
}
```

## 🎯 Phase別機能定義

### Phase1: 基盤構築（2-3週間）
**目標**: 確実に動作する描画基盤・デバッグ可能な状態

#### 実装機能
- ✅ **PixiJS v8基盤構築**
  - 768x768初期サイズ→動的リサイズ対応
  - WebGL2確実動作・WebGPU準備完了
  - ふたば背景システム（#ffffee, #f0e0d6）

- ✅ **ベクターペンツール**
  - #800000主線・滑らかベジエ曲線
  - 筆圧対応準備（0.1-1.0範囲）
  - 120Hz入力対応準備

- ✅ **2レイヤーシステム**
  - 背景レイヤー（#f0e0d6塗りつぶし）
  - アクティブ透明レイヤー1（描画対象）
  - 背景削除→Photoshop風市松模様表示

- ✅ **基本UI（36pxアイコン）**
  - ツールバー（ペン・消しゴムアイコン）
  - ふたば色パレット（マルーン・クリーム）
  - レスポンシブレイアウト（2K-4K対応）

#### 技術仕様
```typescript
interface Phase1Specs {
  canvas: {
    initialSize: '768x768px';
    background: '#ffffee'; // アプリ背景
    layerBackground: '#f0e0d6'; // キャンバス背景
    transparency: 'checkered-pattern'; // 市松模様
  };
  
  drawing: {
    primaryColor: '#800000'; // ふたばマルーン主線
    brushSizes: [2, 4, 8, 16, 32, 64]; // ピクセル
    smoothing: 'bezier-curve';
    vectorBased: true;
  };
  
  ui: {
    iconSize: '36px'; // 2.5K最適化
    colorSystem: 'futaba-palette';
    layout: 'fresco-inspired';
    responsive: '2K-4K';
  };
}
```

### Phase2: UI/UX充実（2-3週間）
**目標**: Adobe Fresco風の完全なUI体験

#### 実装機能
- ✅ **多機能ツールセット**
  - 消しゴム・塗りつぶし・図形ツール
  - エアスプレー・ボカシ基本機能
  - ツール切り替えアニメーション

- ✅ **HSV円形カラーピッカー**
  - 移動可能ポップアップ（120x120px）
  - ふたば色プリセット統合
  - リアルタイム色反映

- ✅ **レイヤーパネル（Fresco風）**
  - ドラッグ&ドロップ階層管理
  - 64x64pxサムネイル表示
  - フォルダ・グループ機能

- ✅ **ツール設定パネル**
  - サイズ・不透明度・筆圧感度
  - プリセット保存・呼び出し
  - リアルタイムプレビュー

### Phase3: 高度機能（3-4週間）
**目標**: プロレベルの描画・アニメーション機能

#### 実装機能
- ✅ **WebGPU対応・120FPS描画**
  - Compute Shader統合
  - GPU並列処理最適化
  - Chrome最新API活用

- ✅ **アニメーション機能**
  - タイムライン・キーフレーム
  - オニオンスキン（前後フレーム表示）
  - WebCodecs動画出力

- ✅ **高度描画機能**
  - エアスプレー（パーティクル）
  - ボカシ・変形・フィルター
  - ベクター→ラスター変換

### Phase4: 最適化・拡張（2-3週間）
**目標**: プロダクション品質・将来拡張準備

#### 実装機能
- ✅ **性能最適化**
  - OffscreenCanvas並列処理
  - メモリ効率化・ガベージコレクション
  - GPU負荷分散・60FPS保証

- ✅ **拡張機能準備**
  - Live2D統合基盤
  - AI補完機能（TensorFlow.js）
  - WebRTC協調作業準備

## 🎨 ふたば☆ちゃんねるカラーシステム

### 基本カラーパレット
```css
:root {
  /* Adobe Fresco風ふたば色定義 */
  --futaba-maroon: #800000;        /* 主線・基調色・ふたばカラーパレット1 */
  --futaba-light-maroon: #aa5a56;  /* セカンダリ・ボタン・ふたばカラーパレット2 */
  --futaba-medium: #cf9c97;        /* アクセント・ホバー・ふたばカラーパレット3 */
  --futaba-light-medium: #e9c2ba;  /* 境界線・分離線 ・ふたばカラーパレット4*/
  --futaba-cream: #f0e0d6;         /* キャンバス背景・ふたばカラーパレット5 */
  --futaba-background: #ffffee;    /* アプリ背景 */
}
```

### 色の使い分け
- **主線描画**: #800000（ふたばマルーン）
- **アプリ背景**: #ffffee（ふたば背景）
- **キャンバス**: #f0e0d6（ふたばクリーム）
- **UI要素**: #aa5a56（ライトマルーン）
- **アクセント**: #cf9c97（ミディアム）



## 🔧 開発方針・品質基準

### 開発優先順位
1. **安定性**: エラーゼロ・確実動作
2. **ベクター品質**: 滑らか・美しい線質
3. **ふたば色統一**: 一貫したカラー体験
4. **段階拡張**: Phase間の確実な成長

### Phase1成功基準
- [ ] PixiJS v8.11.0エラーなし初期化
- [ ] ふたば色正確表示（#800000主線、#f0e0d6キャンバス）
- [ ] 36pxアイコン適切表示
- [ ] ベクターペン滑らか描画
- [ ] 2レイヤー正常動作
- [ ] 60FPS以上安定維持
- [ ] 2.5K解像度完全対応

### 品質保証
```typescript
interface QualityStandards {
  performance: {
    fps: '60+ minimum';
    memory: '<1GB usage';
    latency: '<16ms input';
  };
  
  compatibility: {
    browsers: ['Chrome 100+', 'Firefox 100+', 'Safari 16+'];
    devices: ['Desktop', 'Tablet', 'Touch'];
    inputs: ['Mouse', 'Touch', 'Stylus'];
  };
  
  code: {
    typescript: 'Strict mode';
    testing: 'Unit + Integration';
    documentation: 'TSDoc comments';
  };
}
```

## 🚀 将来拡張性・競争力

### 技術的優位性
- **最新技術基盤**: PixiJS v8 + WebGPU対応
- **高性能描画**: 120FPS対応・GPU最適化
- **柔軟アーキテクチャ**: プラグイン・拡張対応

### 差別化要因
- **ふたば色の親しみやすさ**: 他にない独自カラー体験
- **ベクター描画品質**: プロレベルの線質・滑らかさ
- **段階的成長**: 確実な機能拡張・安定性

この仕様により、Adobe Frescoの優れたUXとふたば☆ちゃんねるの温かいカラーリングを融合した、唯一無二のお絵描きツールを段階的に構築していきます。