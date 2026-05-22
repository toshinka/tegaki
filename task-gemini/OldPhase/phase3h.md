# Phase 3h — バケツ設定タブと消しバケツの下地（完了）

## 概要

バケツツールの詳細調整を QAP へ詰め込まず、設定ポップアップに「バケツ」タブを追加して受け皿を作る。
そのうえで、通常バケツの短期固定値を安全に調整できるようにし、「消しバケツ」MVP まで実装した。

Phase 3g の CPU gap close / underpaint は短期的には及第点。WebGPU / SDF / JFA 系の高品質バケツは正式設計フェーズへ回し、3h では復活させない。

## 実装計画

### 1. 状態管理の拡張 (`system/settings-manager.js`) — Gemini 向き

- [x] `bucketGapClose` (0-3px, 初期値 1) を追加
- [x] `bucketUnderpaint` (0-4px, 初期値 1) を追加
- [x] `bucketReferenceAllLayers` (boolean, 初期値 true) を追加
- [x] バリデーターとデフォルト値の更新

注意:

- `bucketGapClose` は漏れ防止用なので 3px までに留める。
- `bucketUnderpaint` は主線レイヤーを上に置くワークフローなら多少はみ出しても隠せるため、4px まで実用候補にする。

### 2. UI の拡張 (`ui/settings-popup.js`) — Gemini 向き

- [x] 「バケツ」タブの追加
- [x] 隙間閉じ（Gap Close）段階ボタンの実装
- [x] 潜り込ませ量（Underpaint）段階ボタンの実装
- [x] 表示中レイヤー参照のトグル追加
- [x] 設定ポップアップの `Ctrl + K` トグル動作の確認・修正（開きっぱなし対応）

補足:

- QAP は即時操作用の面積資産として残し、細かいスライダーは設定ポップアップへ逃がす。
- 設定ポップアップは閉じるボタンと `Ctrl + K` で閉じられること。置いたまま作業できること。
- 既存のペン調整・ショートカットタブを壊さない。

### 3. バケツ設定の同期 (`system/drawing/fill-tool.js`) — Gemini 向き

- [x] `SettingsManager` の `bucketGapClose` / `bucketUnderpaint` を `FillTool.settings` へ同期
- [x] `bucketReferenceAllLayers` と既存 QAP トグルの状態を矛盾させない
- [x] 値変更後、次回バケツ実行時に即反映されることを確認

注意:

- `fill-tool.js` 全体を書き換えない。
- flood fill 本体のアルゴリズムは Phase 3g の短期完成形として維持する。

### 4. 消しバケツの設計確認 — Gemini 向き

実装前に、以下を `PROGRESS.md` へ短く整理する。

- 通常バケツの mask 作成処理を消しバケツでも再利用できるか。
- `brush-core.js` の消しゴムと同じく `blendMode = 'erase'` で RenderTexture へ焼き込めるか。
- 履歴名、サムネイル更新、`layer:filled` イベントをどう扱うか。
- 背景レイヤー・フォルダを対象外にできるか。

### 5. 消しバケツ MVP (`system/drawing/fill-tool.js` / `brush-core.js`) — Codex 向き

- [x] `eraser-fill` モードのサポート
- [x] `validModes` に `eraser-fill` を追加
- [x] ツール切り替え時の整合性確保
- [x] Undo / Redo / サムネイル更新の確認

実装する場合の最小方針:

- 既存 flood fill mask を再利用する。
- 塗り色を透明色扱いにせず、最終実装では flood fill マスク内の alpha を直接 0 にして透明化する。
- 保存形式や履歴形式の大改造はしない。

実装順:

1. `fill-tool.js` の flood fill mask 作成と RenderTexture 焼き込みを、塗り色焼き込み / erase 焼き込みで分けられる小関数へ切り出す。
2. `currentMode === 'eraser-fill'` のときだけ、同じ mask を使って対象ピクセルの alpha を直接 0 にする。
3. 履歴名は `fill-layer-eraser-fill` など通常バケツと区別する。
4. サムネイル更新、Undo / Redo、背景・フォルダ対象外ガードを通常バケツと同じ条件で確認する。
5. UI 導線は最初から広げすぎず、まずは `G` 循環か QAP サブツールのどちらが自然か Codex が判断する。

### 6. キーボード操作 (`ui/keyboard-handler.js`) — Codex 判断

- [x] `G` キー (`TOOL_FILL`) 押下時の挙動を、`fill` と `eraser-fill` の循環切り替えにするか確認
- [x] `lasso-fill` は既存どおり `L` を維持し、初回は `G` 循環へ含めない

注意:

- `G` 循環は便利だが、通常バケツへ戻れない・状態が見えない事故が起きやすい。
- 先に UI 表示またはステータス表示で `消しバケツ` と分かる状態を作る。
- 迷う場合は、消しバケツ実装後に Codex 判断へ戻す。

## 確認事項
- [x] `G` キーで塗りつぶしと消しバケツが切り替わるか
- [x] 設定ポップアップで値を変更した際、即座にバケツの挙動（隙間閉じ等）に反映されるか
- [x] 消しバケツで正常に透明化されるか（背景色で塗られていないか）
- [x] 設定ポップアップが作業中に邪魔にならず、かつ開きっぱなしで調整できるか
- [x] 通常バケツ、投げ縄塗り、表示中レイヤー参照トグルが退行しないか
- [x] `npm.cmd run build` が成功するか

## 禁止事項

- WebGPU / SDF / MSDF / JFA 経路の復活。
- `bucketGapClose` を 4px 以上へ広げる通常 UI。
- `bucketUnderpaint` を 5px 以上へ広げる通常 UI。
- QAP へのスライダー追加。
- `fill-tool.js` の全面書き換え。
- 保存形式、レイヤー構造、履歴形式の大きな変更。
