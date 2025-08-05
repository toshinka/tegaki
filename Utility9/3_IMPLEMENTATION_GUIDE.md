# 実装ガイド v4.0

**ドキュメント**: 段階的実装手順・作業指示書  
**対象読者**: 実装担当者・Claude・開発者  
**最終更新**: 2025年8月5日

## 🎯 実装戦略・Phase展開

### 戦略B+理想要素アプローチ
```
確実な基盤構築 → 段階的高性能化

Phase1: 基盤構築・確実実装（成功率95%）
├─ WebGL2基盤・60FPS目標・確実動作
├─ 基本描画・ペン・消しゴム・色選択
├─ 2.5K UI・ふたば色・操作性確保
└─ 動作するMVP・フィードバック可能

Phase2: 機能拡充・実用化（成功率85%）
├─ レイヤー・エクスポート・実用機能
├─ 高度ツール・WebGPU準備
└─ 実用的ツール・日常使用可能

Phase3: 高性能化・理想実現（成功率75%）
├─ WebGPU最適化・GPU並列処理
└─ 理想目標達成・差別化実現
```

## 🚀 Phase1: 基盤構築（2-3週間）

### 実装優先順序・依存関係
```
Week 1: 基盤システム
1. 環境構築（30分）
2. 型定義ファイル（15分）
3. 基盤システム（90分）

Week 2: 描画・入力システム  
4. 入力システム（60分）
5. 描画エンジン（75分）
6. ツールシステム（45分）

Week 3: UI・統合
7. UIシステム（90分）
8. アプリケーション統合（30分）
```

**詳細な実装手順・コード例・注意点は Phase1実装順序ガイド v1.0.txt を参照**

### 核心実装ポイント

#### 1. 基盤システム設計
```typescript
// EventBus - 型安全イベント通信
interface IEventData {
  'drawing:start': { point: PIXI.Point; pressure: number; pointerType: string };
  'drawing:move': { point: PIXI.Point; pressure: number; velocity: number };
  'drawing:end': { point: PIXI.Point };
  'tool:change': { toolName: string; settings: any };
  'ui:color-change': { color: number; previousColor: number };
}

// PixiApplication - WebGL2確実初期化
const config = {
  preference: 'webgl2', // Phase1確実動作
  backgroundColor: 0xffffee, // ふたば背景色
  width: Math.min(window.innerWidth, 2560),
  height: Math.min(window.innerHeight, 1440)
};
```

#### 2. 描画・入力統合
```typescript
// InputManager - Pointer Events統合
private setupPointerEvents(): void {
  this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
  this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
  this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
}

// DrawingEngine - Graphics描画・スムージング
private calculateSmoothPoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point): PIXI.Point {
  const smoothFactor = 0.5;
  return new PIXI.Point(
    p2.x + (p3.x - p1.x) * smoothFactor * 0.25,
    p2.y + (p3.y - p1.y) * smoothFactor * 0.25
  );
}
```

#### 3. UI・ふたば色適用
```css
:root {
  --futaba-maroon: #800000;
  --futaba-background: #ffffee;
  --futaba-cream: #f0e0d6;
}

.main-layout {
  display: grid;
  grid-template-columns: 64px 1fr;
  height: 100vh;
}

.tool-button {
  width: 48px;
  height: 48px;
  background: var(--futaba-background);
}
```

## 🔄 Phase2: 機能拡充（3-4週間）

### 実装概要・準備事項
```
レイヤーシステム:
├─ LayerManager.ts - Container階層・20枚管理
├─ LayerPanel.ts - 400px幅・64px項目・サムネイル
└─ ブレンドモード・透明度・表示制御

高度ツール:
├─ BrushTool.ts - テクスチャブラシ・GPU最適化
├─ FillTool.ts - フラッドフィル・境界検出
├─ ShapeTool.ts - 図形・ベクター・パス
└─ EraserTool強化 - アルファマスク・削除効果

エクスポート機能:
├─ ExportManager.ts - PNG・JPEG・2K対応
├─ RenderTexture - オフスクリーン描画
└─ ファイル保存・ダウンロード・設定永続化

WebGPU準備:
├─ WebGPUDetector.ts - 対応検出・Tier判定
├─ 段階的縮退準備・Phase3移行基盤
└─ Compute Shader準備・並列処理基盤
```

## 🚀 Phase3: 高性能化（2-3週間）

### WebGPU統合・GPU最適化
```
WebGPU本格導入:
├─ WebGPURenderer.ts - Compute Shader・並列処理
├─ TextureManager.ts - GPU メモリ・Atlas統合
├─ 60FPS安定・4K対応・メモリ効率
└─ 高度エフェクト・リアルタイム処理

アイコンシステム完成:
├─ Tabler Icons v3.34.1統合
├─ WebGPU Sprite最適化
├─ 動的アイコン・状態表示
└─ SVGアイコン・GPU最適化

ポップアップシステム:
├─ HSV円形ピッカー・WebGPU Shader
├─ 移動可能ポップアップ・z-index: 2000
├─ GPU最適化・120FPS更新
└─ リアルタイム色選択・遅延0ms

性能監視UI:
├─ リアルタイムFPS・GPU使用率・遅延表示
├─ Chrome Performance API統合
├─ v3.4性能設定パネル・自動調整
└─ メモリ効率・1GB制限・警告システム
```

## ✅ Phase完了チェックリスト

### Phase1基盤構築
```
✅ 機能要件:
├─ [ ] WebGL2初期化・Canvas表示・2560×1440対応
├─ [ ] EventBus通信・型安全・イベント確認
├─ [ ] 基本描画・ペン・スムージング・色変更
├─ [ ] UI表示・48pxボタン・ふたば色適用
└─ [ ] 15分連続描画・エラーなし・性能維持

✅ 性能要件:
├─ [ ] 60FPS以上・遅延8ms以下・安定動作  
├─ [ ] メモリ300MB以下・リーク防止
├─ [ ] TypeScript厳格・エラー0・警告0
└─ [ ] Claude理解容易・保守性確保
```

### Phase2実用化
```
✅ 機能拡充:
├─ [ ] レイヤー20枚・階層管理・ブレンドモード
├─ [ ] 高度ツール・筆・図形・塗りつぶし
├─ [ ] エクスポート・PNG/JPEG・2K対応
└─ [ ] 設定保存・ユーザー設定・永続化

✅ WebGPU準備:
├─ [ ] 対応検出・Tier判定・段階縮退
├─ [ ] Compute Shader基盤・並列処理準備
└─ [ ] Phase3移行基盤・技術実証
```

### Phase3高性能化
```
✅ 理想実現:
├─ [ ] WebGPU最適化・60FPS安定・4K対応
├─ [ ] Tabler Icons統合・SVG GPU最適化
├─ [ ] HSV円形ピッカー・WebGPU Shader
├─ [ ] リアルタイム性能監視・自動調整
└─ [ ] Procreateクラス機能・UX達成
```

## ⚠️ 重要な実装制約

### 必須遵守事項
```
🚫 変更禁止:
├─ ふたば色システム・#800000/#ffffee等
├─ 2.5K液タブレット特化・タッチ非対応
├─ 48pxアイコン・64px幅ツールバー・400px幅レイヤー
└─ EventBus疎結合・TypeScript厳格・単一責任

✅ 品質基準:
├─ 60FPS安定・1GB以下・5ms遅延以下
├─ WCAG 2.1 AAA・色覚バリアフリー対応
├─ Claude理解容易・保守性・可読性
└─ 段階実装厳守・Phase完了→次Phase移行
```

### Claude実装時注意点
```
⚠️ 実装ポイント:
├─ インポート文.js拡張子必須・ESM対応
├─ PIXI統一インポート・import * as PIXI from 'pixi.js'
├─ エラー処理必須・try-catch・ログ出力
├─ 型安全性確保・any型禁止・interface活用
└─ 性能監視・requestAnimationFrame・FPS計測

📋 コード品質:
├─ Cyclomatic Complexity 10以下
├─ メソッド20行以内・引数3個以内
├─ 変数名簡潔・i,j,e,el等・可読性維持
└─ コメント適切・Claude理解支援・保守性
```

---

**この実装ガイドは技術実装の方針を示します。詳細な手順・コード例・注意点は「Phase1実装順序ガイド v1.0.txt」を参照し、段階的確実実装を行います。**