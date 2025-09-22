# Phase2準備作業計画 - Engine Star分割前の必須修正

## 🔍 現状分析結果

### ✅ Phase1完了済み項目
- **座標系統一**: `coordinate-system.js` が実装済み、統一API提供中
- **座標コメント追加**: `// coord: source -> destination` 形式で明示化済み
- **二重実装統一**: `screenToCanvasForDrawing`/`screenToCanvas` 統合済み
- **UI更新**: `ui-panels.js` がEngine参照を期待する形で準備済み

### ⚠️ 発見された問題（GPT5指摘通り）

#### 🔥 重大問題1: Engine Starの不在
- `core-engine.js` は統合実装だが、分割準備ができていない
- `window.CoreRuntime` ファサードが存在しない
- UI層との明確な結合点が未定義

#### 🔥 重大問題2: 座標系参照の脆弱性
```javascript
// 現在のCoordinateSystem内の脆弱な参照
const worldContainer = app.stage.children.find(child => child.label === 'worldContainer');
```
- Label文字列検索による参照（GPT5指摘通り）
- 構造変更・順序変更に脆弱
- パフォーマンス問題（毎回検索実行）

#### 🔥 重大問題3: index.html内の緊急修正の非効率性
- `coordinate-system.js` がインライン重複実装されている
- 外部ファイルと重複により混乱の原因
- 緊急修正コードが本格実装を妨げている

## 📋 Phase2分割前の必須準備作業

### 🚀 Step1: CoreRuntime最小ファサードの実装（即日対応）

**目的**: UI層との明確な結合点を確立

#### 1.1 `core-runtime.js` 作成
```javascript
// 最小限のファサード実装
window.CoreRuntime = {
  // 内部参照を明示的に保持
  internal: {
    app: null,
    worldContainer: null,
    canvasContainer: null,
    cameraSystem: null,
    layerManager: null,
    drawingEngine: null
  },
  
  // 初期化関数（index.htmlから呼び出し）
  init(components) {
    Object.assign(this.internal, components);
    console.log('CoreRuntime initialized with unified coordinate system');
  },
  
  // 統一座標系API
  coord: window.CoordinateSystem,
  
  // 公開API（UIから使用）
  api: {
    panCamera: (dx, dy) => CoreRuntime.internal.cameraSystem?.pan(dx, dy),
    zoomCamera: (factor, cx, cy) => CoreRuntime.internal.cameraSystem?.zoom(factor, cx, cy),
    setTool: (tool) => CoreRuntime.internal.drawingEngine?.setTool(tool),
    resizeCanvas: (w, h) => CoreRuntime.internal.cameraSystem?.resizeCanvas(w, h)
  }
};
```

#### 1.2 座標系の明示的参照設定
```javascript
// CoordinateSystemに安全な参照設定機能追加
window.CoordinateSystem.setContainers = function(containers) {
  this._worldContainer = containers.worldContainer;
  this._canvasContainer = containers.canvasContainer;
  console.log('CoordinateSystem: Safe container references set');
};
```

### 🔧 Step2: 座標系参照の安全化（短期対応）

#### 2.1 Label検索の置換
**変更前（脆弱）**:
```javascript
const worldContainer = app.stage.children.find(child => child.label === 'worldContainer');
```

**変更後（安全）**:
```javascript
const worldContainer = this._worldContainer || app.stage.children.find(child => child.label === 'worldContainer');
```

#### 2.2 パフォーマンス最適化
- 参照キャッシュの実装
- 検索コストの削減
- 構造変更時の自動再設定

### 🧹 Step3: index.html緊急修正コードの整理

#### 3.1 インライン重複コードの削除
- `coordinate-system.js` の外部ファイル化徹底
- 緊急修正用インラインコードの削除
- 依存関係の明確化

#### 3.2 読み込み順序の最適化
```html
<!-- 最適化された読み込み順序 -->
<script src="config.js"></script>
<script src="coordinate-system.js"></script>
<script src="core-runtime.js"></script>
<script src="ui-panels.js"></script>
<script src="core-engine.js"></script>
```

## 🎯 準備作業の実行計画

### 即日実行（必須）
1. **core-runtime.js最小実装** - UI結合点確立
2. **座標系安全参照** - 構造依存度低減
3. **index.html整理** - 重複コード削除

### 短期実行（推奨）
1. **参照キャッシュ実装** - パフォーマンス向上
2. **エラーハンドリング強化** - 開発時問題発見向上
3. **デバッグ機能整備** - Phase2作業効率向上

## ✅ Phase2分割開始の前提条件

### 必須条件
- [ ] `window.CoreRuntime` ファサード動作確認
- [ ] Label検索の安全参照置換完了
- [ ] UI層→CoreRuntime→Engine の結合テスト成功

### 推奨条件  
- [ ] 座標変換精度テスト通過
- [ ] パフォーマンス劣化なし確認
- [ ] 既存機能の完全継承確認

## 🚨 重要な注意事項

### フォールバック絶対禁止の徹底
- 準備作業でもフォールバック処理は一切実装しない
- 問題発生時は明確にエラーとして表面化させる
- 半端な互換性処理は Phase2分割を困難にする

### 機能継承の完全性
- 現在動作している全機能の継承を最優先
- UI操作（レイヤー変形、描画、コピペ）の完全再現
- 座標変換精度の維持

### Phase2分割への影響考慮
- 準備作業は分割作業を容易にすることが目的
- 過度な改修は避け、最小限の安全化に留める
- 分割後の各モジュールの独立性を妨げない設計

## 📊 作業時間見積もり

| 項目 | 予想時間 | 優先度 |
|------|----------|--------|
| CoreRuntime最小実装 | 2-3時間 | 🔥必須 |
| 座標系安全参照 | 1-2時間 | 🔥必須 |
| index.html整理 | 1時間 | 🔥必須 |
| パフォーマンス最適化 | 2-3時間 | ⚡推奨 |
| デバッグ機能強化 | 1-2時間 | ⚡推奨 |

**合計**: 必須作業 4-6時間、推奨作業 3-5時間

## 🎉 準備完了後の期待効果

### Phase2分割作業の円滑化
- 明確なモジュール境界の確立
- UI層との結合点の安定化
- 座標系の安全性向上

### 開発効率の向上
- デバッグ作業の効率化  
- Claude/AI改修時の見通し向上
- 機能追加時の影響範囲明確化

### コード品質向上
- 循環依存の回避
- 責任範囲の明確化
- テスタビリティの向上

---

**結論**: GPT5の指摘は正確で、Phase2分割前の準備作業が必要です。特に CoreRuntimeファサードの実装と座標系参照の安全化は必須です。