# Phase 1i — 保守性と小型UI操作の整備

> Phase 1h で、アルバム保管、アルバムからの PNG ダウンロード、アルバム復帰、エクスポート PNG、DEL 消去とサムネイル整合は実機確認で良好。
> Phase 1i は大きな新機能へ進む前に、AI が読み取りやすく改修しやすい構造整理と、既存 UI の小型改善を行う。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0/` は参照のみ。通常作業では編集しない。
`dist/` は成果物として必要ない限り差分に残さない。

---

## 前提

- 標準描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- レイヤーは `Container + Sprite(RenderTexture)`。
- `animationSystem.init()` は現行描画へ副作用が出るため Phase 1i では使わない。
- アニメボタンは入口表示のみ維持。フレームコピー、アニメプレビュー、APNG/GIF 自動判定は後続。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。
- 内部 2 倍化、`resolution: 2` は使わない。
- ペン、消しゴム、バケツ、履歴、リサイズ、アルバム、PNG エクスポートを退行させない。

---

## 目的

1. AI が読みやすいファイル構造・責務・ヘッダー・EventBus 契約を棚卸しする。
2. 古いフェーズ表記、重複責務、未接続モジュールを危険度別に整理する。
3. ステータスの History カウントが現行履歴と同期しているか確認し、軽微なら修正する。
4. V キー変形パネルの小型改善を行う。
5. レイヤー不透明度の数値ドラッグ操作を検討・実装する。
6. クリップボード画像貼り付けとレイヤーコピー系ショートカットを棚卸しし、低リスクな範囲だけ実装する。

---

## 優先タスク

### 1. 保守性棚卸し

対象候補：

- `tegaki_work/core-engine.js`
- `tegaki_work/system/layer-system.js`
- `tegaki_work/system/drawing/brush-core.js`
- `tegaki_work/system/drawing/drawing-engine.js`
- `tegaki_work/system/drawing/thumbnail-system.js`
- `tegaki_work/system/project-manager.js`
- `tegaki_work/system/export-manager.js`
- `tegaki_work/ui/ui-panels.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/ui/keyboard-handler.js`
- `tegaki_work/ui/resize-popup.js`
- `tegaki_work/system/layer-transform.js`
- `tegaki_work/system/drawing-clipboard.js`

確認すること：

- ファイルヘッダーの責務、依存、被依存、イベント、グローバル登録が現状と合っているか。
- 同じ責務の処理が複数箇所にないか。
- 古い `vector` / `frame` / `cut` / `phase1a` / `ベクター` 表記が現行方針とズレていないか。
- 未接続だが残しているファイルが、後続予定なのか削除候補なのか。

成果物：

- すぐ直せるヘッダーや表記ズレは修正してよい。
- 大きな移動、削除、責務分割は実装せず、`PROGRESS.md` に「Codex 判断へ戻す」として候補を書く。

### 2. History ステータス確認

受け入れ条件：

- 起動直後、描画後、DEL 消去後、Undo/Redo 後、アルバムロード後で `History:` 表示が破綻しない。
- 既に正しく動いている場合はコード変更しない。
- 軽微な購読漏れや初期表示だけなら修正してよい。

### 3. V キー変形パネル改善

対象候補：

- `tegaki_work/system/layer-transform.js`
- `tegaki_work/ui/keyboard-handler.js`
- `tegaki_work/styles/main.css`

受け入れ条件：

- V モード中に `H` でアクティブレイヤー水平反転。
- V モード中に `Shift+H` でアクティブレイヤー垂直反転。
- 通常描画モードの `H` / `Shift+H` と衝突しない。実質 `V+H` / `V+Shift+H` として扱う。
- 回転は 180 度止めではなく 360 度範囲で扱う。
- V パネルの各数値はダブルクリックで直接入力できる。
- 実装が transform bake や履歴に深く食い込む場合は、途中で止めて Codex 判断へ戻す。

### 4. レイヤー不透明度の数値ドラッグ

対象候補：

- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/system/layer-system.js`

受け入れ条件：

- 既存の左右ボタン調整を壊さない。
- 不透明度の数値部分を横ドラッグして 0〜100% を変更できる。
- ドラッグ中にレイヤー表示とサムネイルが必要以上に重くならない。
- 操作後に `PROGRESS.md` へ残す。

### 5. クリップボードとレイヤーコピー棚卸し

対象候補：

- `tegaki_work/system/drawing-clipboard.js`
- `tegaki_work/ui/keyboard-handler.js`
- `tegaki_work/system/layer-system.js`

確認すること：

- `Ctrl+C` / `Ctrl+V` が現在どの責務に割り当たっているか。
- クリップボード画像をブラウザから読める実装が既にあるか。
- アクティブレイヤーコピーと新規コピーレイヤー作成が既存 API で実装可能か。

初期受け入れ条件：

- 低リスクなら、`Ctrl+C` でアクティブレイヤーコピー、`Ctrl+V` で新規コピーレイヤー作成を実装。
- 画像ペーストはブラウザ Clipboard API と権限が絡むため、既存実装が使える場合だけ実装。
- 既存のテキスト入力欄や OS ショートカットを邪魔しない。
- 難しい場合は棚卸し結果と実装案を `PROGRESS.md` に書いて止める。

---

## 実装しないで止めるもの

- `animationSystem.init()` の再有効化。
- APNG/GIF 自動判定、アニメプレビュー、フレームコピーの本格復旧。
- レイヤー構造の大幅変更。
- クリッピング/フォルダ/複数レイヤー選択の本実装。
- 無限キャンバス、V 変形時のキャンバス外保持の本実装。
- 囲い塗り、エアブラシ、ぼかし、図形、定規。
- WebGPU / SDF / MSDF / WebGL2 Mesh の復活。
- 大規模リネームやファイル移動。必要なら提案だけで止める。

---

## 受け入れ条件

- `npm.cmd run build` が成功する。
- 通常ペン描画に遅延や `No renderTexture` エラーが再発しない。
- アルバム保管/復帰、PNG エクスポート、Undo/Redo、リサイズが退行しない。
- V パネル改善やレイヤー不透明度改善を入れた場合、ブラウザで最低限の実操作確認を行う。
- `tegaki_work/PROGRESS.md` を更新する。

---

## PROGRESS 更新に書くこと

- 変更ファイル
- 棚卸し結果
- すぐ直したヘッダー/表記ズレ
- Codex 判断へ戻す構造整理候補
- 実装した UI 改善
- 実装しなかった項目と理由
- `npm.cmd run build` 結果
- ブラウザ確認結果
- 残った問題
