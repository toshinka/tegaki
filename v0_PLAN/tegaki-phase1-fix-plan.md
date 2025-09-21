# TEGAKI Phase 1 問題修正・俯瞰的改修計画書

## 🚨 現在の緊急問題分析

### ❌ 座標系API不整合エラー
- **エラー1**: `window.CoordinateSystem.globalToLocal is not a function`
- **エラー2**: `window.CoordinateSystem.localToGlobal is not a function`
- **原因**: core-engine.jsで呼び出しているAPIが coordinate-system.js に存在しない

### ❌ 描画機能完全停止
- **問題**: ペン・マウス描画が全く動作しない
- **原因**: 座標変換エラーによりDrawingEngineが機能停止

### ❌ キャンバス操作制限
- **問題**: Space+Shift+ドラッグ・方向キーでの拡縮回転が不能
- **原因**: 座標変換エラーによりCameraSystemが部分的に機能停止

### ❌ ショートカットキー競合
- **問題**: Space+Shift+方向キーがレイヤー階層移動になっている
- **正解**: 上下のみレイヤー移動、左右は将来のカット移動用に温存

---

## 📋 ファイル構造・依存関係マトリックス

### 現在のファイル構成
```
Phase 1 現在状態:
├── index.html (main.js統合)
├── config.js ✅ 完成
├── coordinate-system.js ⚠️ API不整合
├── ui-panels.js ✅ 完成
└── core-engine.js ⚠️ 座標変換エラー
```

### 依存関係マトリックス
| ファイル | 依存先 | 提供API | 問題点 |
|---------|-------|---------|---------|
| index.html | config.js, coordinate-system.js, ui-panels.js, core-engine.js | main.js統合部分 | 正常 |
| config.js | なし | TEGAKI_CONFIG | ✅ 正常 |
| coordinate-system.js | config.js | CoordinateSystem | ❌ API不足 |
| ui-panels.js | config.js | UIController, TegakiUI | ✅ 正常 |
| core-engine.js | 全ファイル | TegakiCore | ❌ 座標API不整合 |

---

## 🔧 緊急修正計画 (Phase 1.1)

### Step 1: coordinate-system.js API補完
**緊急度: 🔥 最高**

#### 追加必須メソッド
```javascript
// core-engine.jsで呼び出されているが存在しないメソッド
- globalToLocal(container, globalPoint)  
- localToGlobal(container, localPoint)   
- createTransformMatrix(transform, centerX, centerY)
- createInverseTransformMatrix(transform, centerX, centerY)
- applyMatrix(point, matrix)
```

#### 修正対象箇所
- **ファイル**: coordinate-system.js
- **追加場所**: CoordinateSystemオブジェクト内
- **互換性**: 既存APIを維持しつつ追加

### Step 2: core-engine.js 座標変換呼び出し修正
**緊急度: 🔥 最高**

#### 修正箇所リスト
| 行番号 | 現在の呼び出し | 正しい呼び出し | 場所 |
|--------|---------------|---------------|-------|
| ~593 | CoordinateSystem.localToGlobal | CoordinateSystem.layerToWorld | CameraSystem |
| ~805 | CoordinateSystem.globalToLocal | CoordinateSystem.worldToLayer | CameraSystem |
| ~其他 | CoordinateSystem.createTransformMatrix | 新規実装必要 | LayerManager |

#### 修正戦略
1. **既存API活用**: coordinate-system.jsの既存メソッドを使用
2. **メソッド名統一**: core-engine.jsの呼び出しをcoordinate-system.jsの実装に合わせる
3. **段階的修正**: エラー箇所を1つずつ確実に修正

### Step 3: ショートカットキー競合解決
**緊急度: 🟡 中**

#### 修正対象
- **ファイル**: core-engine.js > LayerManager > setupLayerOperations()
- **問題**: Space+Shift+左右キーがレイヤー移動になっている
- **修正**: 上下のみレイヤー移動、左右は無効化（将来のカット移動用に温存）

---

## 📈 段階的修復ロードマップ

### 🚀 Phase 1.1: 緊急修正 (1-2時間)
1. **coordinate-system.js API補完** (30分)
   - 不足メソッドの追加実装
   - 既存APIとの整合性確保
   
2. **core-engine.js 座標変換修正** (60分)
   - エラー箇所の特定と修正
   - 座標変換呼び出しの統一化
   
3. **基本機能動作確認** (30分)
   - ペン描画復旧確認
   - キャンバス操作復旧確認

### 🎯 Phase 1.2: 機能改善 (2-3時間)
1. **ショートカットキー整理** (60分)
   - Space+Shift+方向キー修正
   - 正しい操作系統への復旧
   
2. **座標変換精度向上** (90分)
   - 描画位置ズレ修正
   - 変形操作精度向上
   
3. **完全動作確認** (30分)
   - 全機能テスト
   - エラーゼロ確認

### 📦 Phase 2準備: 分割基盤整備 (後日)
1. **core-runtime.js ファサード作成**
2. **個別システム分離**
3. **UI層参照統一**

---

## 🔍 各ファイルの修正ポイント詳細

### coordinate-system.js 修正内容

#### 追加実装必須メソッド
```javascript
// グローバル⇔ローカル変換（PixiJSのtoLocal/toGlobalのラッパー）
globalToLocal(container, globalPoint)
localToGlobal(container, localPoint)

// 行列関連処理（レイヤー変形用）
createTransformMatrix(transform, centerX, centerY)
createInverseTransformMatrix(transform, centerX, centerY)  
applyMatrix(point, matrix)
```

#### 既存メソッドとの整合性
- **保持**: 既存の`screenToCanvas`, `screenToWorld`等は維持
- **拡張**: 新規メソッドを追加することで後方互換性を保つ
- **統一**: すべてのメソッドで座標空間コメント（coord:）を使用

### core-engine.js 修正内容

#### CameraSystemクラス修正箇所
```javascript
// line ~593 付近
- window.CoordinateSystem.localToGlobal(this.worldContainer, {...})
+ window.CoordinateSystem.layerToWorld(this.worldContainer, ...)

// line ~805 付近  
- window.CoordinateSystem.globalToLocal(this.canvasContainer, {...})
+ window.CoordinateSystem.worldToLayer(this.canvasContainer, ...)
```

#### LayerManagerクラス修正箇所
```javascript
// createTransformMatrix関連
- window.CoordinateSystem.createTransformMatrix(...)
+ 新規実装されたCoordinateSystem.createTransformMatrix()を使用

// setupLayerOperations内ショートカット修正
- V + Shift + 左右キー → レイヤー移動 (❌)
+ V + Shift + 上下キー → レイヤー移動 (✅)
+ V + Shift + 左右キー → 無効化（将来のカット移動用）
```

#### DrawingEngineクラス修正箇所
```javascript
// 座標変換メソッド名統一
- this.cameraSystem.screenToDrawingCanvas(...)
+ this.cameraSystem.screenToCanvas(...) または CoordinateSystem.screenToCanvas(...)
```

---

## ⚙️ 修正作業の優先順位

### 🔥 Priority 1: 座標変換エラー解決
**目標**: 基本描画機能の復旧
1. coordinate-system.js にglobalToLocal/localToGlobalメソッド追加
2. core-engine.js のエラー箇所を正しいAPI呼び出しに修正
3. 描画機能・カメラ操作の動作確認

### 🟡 Priority 2: 操作系統修正  
**目標**: 正しいショートカット動作
1. レイヤー移動キーを上下のみに限定
2. カメラ操作キーとの競合解決
3. 将来のカット移動用に左右キー温存

### 🟢 Priority 3: 機能最適化
**目標**: 描画精度向上・Phase 2準備
1. 座標変換精度の向上
2. レイヤー変形操作の改善  
3. 次期分割作業の基盤整備

---

## 📝 作業時のチェックリスト

### coordinate-system.js 追加実装時
- [ ] globalToLocal/localToGlobalメソッド追加
- [ ] createTransformMatrix系メソッド追加  
- [ ] 既存メソッドとの命名一貫性確保
- [ ] デバッグモード対応（座標空間検証）
- [ ] エラーハンドリング追加

### core-engine.js 修正時
- [ ] 全座標変換呼び出しを正しいAPIに修正
- [ ] エラーコンソールをゼロに
- [ ] ショートカットキー競合解決
- [ ] 描画機能の完全復旧確認
- [ ] カメラ操作の完全復旧確認

### 動作確認時
- [ ] ペン描画可能
- [ ] 消しゴム動作確認
- [ ] Space+ドラッグ移動
- [ ] Space+Shift+ドラッグ拡縮回転
- [ ] V+方向キーレイヤー移動（上下のみ）
- [ ] キャンバスリサイズ正常動作
- [ ] レイヤー階層ドラッグ入れ替え正常動作

---

## 🎯 成功指標

### Phase 1.1 完了条件
- [ ] コンソールエラー: 0件
- [ ] ペン描画: 正常動作
- [ ] 基本キャンバス操作: 正常動作

### Phase 1.2 完了条件  
- [ ] 全ショートカットキー: 正常動作
- [ ] 座標精度: 描画位置ズレなし
- [ ] レイヤー変形: スムーズ動作

### Phase 2 準備完了条件
- [ ] 座標系API: 完全統一
- [ ] コードベース: 分割準備完了
- [ ] 依存関係: 明確化完了

---

この計画書により、他の作業Claudeも現在の問題点と修正手順を明確に把握し、効率的に作業を進められます。まずはPriority 1の座標変換エラー解決から始めることを推奨します。