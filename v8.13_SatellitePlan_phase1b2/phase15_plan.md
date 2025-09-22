# Phase1.5 改修計画 - Phase2分割前の重要整理

## 🎯 目的
Phase2でのEngine分割をスムーズに行うための基盤整理

## ⚠️ GPT5指摘問題点の確認と対応

### 1. 座標変換の完全統合 🔧
**問題**: core-engine.js内で直接 toLocal/toGlobal 呼び出しが残存
**対応**: CoordinateSystem経由への完全置換

**具体的作業**:
```javascript
// 変更前（問題のあるコード）
const canvasPoint = container.toLocal(screenPoint);

// 変更後（統一API）
const canvasPoint = window.CoordinateSystem.globalToLocal(container, screenPoint);
```

### 2. 冗長関数の削除 🗑️
**問題**: screenToCanvasForDrawing と screenToCanvas が分離している
**対応**: CoordinateSystem.screenToCanvas() に統合

**削除対象**:
- `screenToCanvasForDrawing()`
- 重複する座標変換メソッド群
- core-runtime.js と core-engine.js の重複メソッド

### 3. PixiJS v8.13 完全統一 ⚡
**問題**: ui-panels.js で古いイベント処理API使用
**対応**: PixiJS v8.13 の正規APIに統一

**修正例**:
```javascript
// 変更前（v6/v7系）
container.interactive = true;

// 変更後（v8.13系）
container.eventMode = 'static';
```

### 4. API責務の明確化 📋
**問題**: core-engine.js と core-runtime.js で責務競合
**対応**: core-runtime.js を公開窓口に一本化

## 🚀 実装ステップ

### Step1: 座標変換完全統合 (15分)
1. core-engine.js 内の全 `toLocal/toGlobal` を検索
2. CoordinateSystem API に置換
3. 座標コメント追加

### Step2: 重複API整理 (10分)  
1. `screenToCanvasForDrawing` 削除
2. core-runtime.js にAPIを一本化
3. core-engine.js の直接呼び出し削除

### Step3: PixiJS v8.13統一 (10分)
1. ui-panels.js のイベント処理更新
2. 古い `interactive = true` 削除
3. `eventMode = 'static'` に変更

### Step4: 責務コメント追加 (5分)
1. core-engine.js に「Phase2分割予定」コメント
2. core-runtime.js に「公開窓口専用」コメント

## ✅ 期待される効果

### 即座の改善
- 座標変換バグの根絶
- パフォーマンス向上（統一API使用）
- PixiJS v8.13完全対応

### Phase2への準備
- 責務境界の明確化
- 分割作業の簡素化
- API依存の見える化

## 📋 作業優先度

### 🔴 最優先 - 機能継承に影響
1. 座標変換の完全統合
2. core-runtime.js API一本化

### 🟡 重要 - Phase2準備
1. PixiJS v8.13統一
2. 責務コメント追加

### 🟢 推奨 - 保守性向上
1. 冗長関数削除
2. デバッグ情報整理

## ⚠️ 注意事項

### フォールバック処理禁止
- エラー隠蔽・暗黙修復は一切行わない
- 問題発生時は明確にエラーログ出力

### 機能継承の保証
- 既存機能の完全な動作継続
- UIイベントの正常動作確認
- レイヤー操作の完全性維持

### Phase2分割準備
- 明確なAPI境界の確立
- 循環依存の排除
- モジュール間の疎結合確保

## 🎯 成功判定基準

1. **座標変換精度**: 往復変換誤差 < 0.001px
2. **API一貫性**: core-runtime.js経由のみでUI操作完結  
3. **PixiJS対応**: v8.13 APIのみ使用
4. **機能継承**: 既存の全機能が正常動作

## 次のPhase2への橋渡し

Phase1.5完了後、以下の分割が可能になります：
- `camera-system.js` (カメラ操作)
- `layer-system.js` (レイヤー管理)  
- `drawing-engine.js` (描画処理)
- `transform-utils.js` (変形処理)

---

**このPhase1.5は約40分で完了予定です。**
**Phase2分割作業の成功率を大幅に向上させる重要な基盤整理です。**