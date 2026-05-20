# Phase 3h — バケツツールの更なる高度化

## 概要
バケツツール（塗りつぶし）に「消しバケツ」モードを追加し、Gキーでの循環切り替えを実装する。また、隙間閉じ（Gap Close）や潜り込ませ量（Underpaint/Dilation）の調整を設定ポップアップの新規「バケツ」タブで行えるようにする。

## 実装計画

### 1. 状態管理の拡張 (`system/settings-manager.js`)
- [ ] `bucketGapClose` (0-5px, 初期値 1) を追加
- [ ] `bucketUnderpaint` (0-5px, 初期値 1) を追加
- [ ] `referenceAllLayers` (boolean, 初期値 true) を追加
- [ ] バリデーターとデフォルト値の更新

### 2. UIの拡張 (`ui/settings-popup.js`)
- [ ] 「バケツ」タブの追加
- [ ] 隙間閉じ（Gap Close）調整スライダーの実装
- [ ] 潜り込ませ量（Underpaint）調整スライダーの実装
- [ ] (任意) 表示中レイヤー参照のトグル追加
- [ ] 設定ポップアップの `Ctrl + K` トグル動作の確認・修正（開きっぱなし対応）

### 3. キーボード操作の高度化 (`ui/keyboard-handler.js`)
- [ ] `G` キー (`TOOL_FILL`) 押下時の挙動を、`fill` と `eraser-fill` の循環切り替えに変更
- [ ] 必要に応じて `lasso-fill` も循環に含めるか検討（一旦は `fill` ↔ `eraser-fill` を優先）

### 4. バケツツールのロジック更新 (`system/drawing/fill-tool.js`)
- [ ] `eraser-fill` モードのサポート（`erase` ブレンドモードの使用）
- [ ] `SettingsManager` からの設定値同期

### 5. 描画エンジンの更新 (`system/drawing/brush-core.js`)
- [ ] `validModes` に `eraser-fill` を追加
- [ ] ツール切り替え時の整合性確保

## 確認事項
- [ ] `G` キーで塗りつぶしと消しバケツが切り替わるか
- [ ] 設定ポップアップで値を変更した際、即座にバケツの挙動（隙間閉じ等）に反映されるか
- [ ] 消しバケツで正常に透明化されるか（背景色で塗られていないか）
- [ ] 設定ポップアップが作業中に邪魔にならず、かつ開きっぱなしで調整できるか
