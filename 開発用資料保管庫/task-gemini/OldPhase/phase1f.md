# Phase 1f — 履歴・リサイズ・座標整合の安定化

> Phase 1e は、筆圧ペン、消しゴム筆圧、低速描画の途切れ対策、ステータス/UI同期まで完了扱い。
> Phase 1f は、保存・出力・編集拡張へ進む前に、アンドゥ/リドゥとキャンバスリサイズ、Vキー変形後の描画座標を安定させる。

---

## 作業対象

```text
tegaki_work/
```

`PastFiles/` と `tegaki_phase0/` は参照のみ。通常作業では編集しない。

---

## 前提

- 標準描画は PixiJS v8.17.0 + RenderTexture へのライブラスター焼き込み。
- WebGPU / SDF / MSDF / WebGL2 Mesh 経路は凍結継続。
- Canvas2D を本番描画へ混ぜない。
- DPR は 1 倍固定。内部 2 倍化や `resolution: 2` は採用しない。
- `toLocal()` / `toGlobal()` 依存を描画座標の主経路へ戻さない。
- ペン、消しゴム、基本バケツ、サムネイル、筆圧切替、ステータス表示を壊さない。
- 保存、エクスポート、レイヤー複製/結合/フォルダ、範囲選択は Phase 1g へ送る。
- `dist/` は成果物として必要ない限り差分に残さない。

---

## 報告された症状

再現性はまだ低いが、以下の問題がある。

- 時々、アンドゥで描画座標がズレる。
- アンドゥ単体で起きるのか、リサイズ後のアンドゥで起きるのか未確定。
- Vキーモードでアクティブレイヤーを少し移動すると、描画可能座標がキャンバスと一致して元に戻ることがある。

この挙動から、履歴復元後に以下のどれかが古い状態のまま残っている可能性がある。

- `RenderTexture` / `layerSprite.texture`
- `TEGAKI_CONFIG.canvas.width/height`
- `camera-system` / `coordinate-system` のキャッシュ
- `layer-transform` の transform map
- レイヤーコンテナの `position/scale/rotation/pivot`
- リサイズ undo 時の alignment / offset
- サムネイルや pathsData と実際の raster texture の不一致

---

## 目的

1. アンドゥ/リドゥの履歴コマンドが、描画状態と座標状態を同時に正しく戻すか調査する。
2. リサイズ実行・リサイズ undo/redo 後に、描画可能座標、RenderTexture サイズ、レイヤー表示、サムネイルが一致するようにする。
3. Vキー変形の enter/exit や軽い移動で座標ズレが直る理由を切り分ける。
4. 再現が難しい場合でも、診断ログを debug 限定で追加し、次の再現時に原因が絞れる状態にする。
5. Phase 1g の保存・出力・編集基盤へ進めるだけの履歴安定性を確保する。

---

## 優先タスク

### 1. 事前棚卸し

対象候補：

- `system/history.js`
- `ui/keyboard-handler.js`
- `ui/resize-popup.js`
- `ui/resize-slider.js`
- `system/camera-system.js`
- `coordinate-system.js`
- `system/layer-system.js`
- `system/layer-transform.js`
- `system/drawing/brush-core.js`
- `system/drawing/fill-tool.js`
- `system/drawing/stroke-renderer.js`
- `system/drawing/thumbnail-system.js`

確認すること：

- 描画 stroke の undo/redo が存在するか。存在しない場合、現状の `History` は何を戻しているか。
- ペン、消しゴム、バケツ、リサイズ、レイヤー変形がどの形式の history command を push しているか。
- `resize-popup.js` と `resize-slider.js` のどちらが現行 UI で使われているか。二重実装が残っている場合は、現行経路を特定する。
- リサイズ undo が旧サイズへ戻すとき、描画レイヤーの `RenderTexture` 内容とサイズも戻しているか。
- リサイズ時の `alignOptions` が do/undo で逆方向の offset として扱えているか。
- `camera:resized` 後に `coordinate-system.clearCache()`、レイヤー transform 状態、サムネイル更新が十分に呼ばれているか。
- Vキー変形モードの enter/exit が、座標ズレを直している副作用を持っていないか。

棚卸し結果は `tegaki_work/PROGRESS.md` に追記する。

### 2. 再現手順を作る

最低限、以下を試す。

1. 起動直後 400x400 で線を描く。
2. `Ctrl+Z` / `Ctrl+Y` を数回行う。
3. リサイズする。
4. リサイズ後に線を描く。
5. `Ctrl+Z` / `Ctrl+Y` を数回行う。
6. Vキーでアクティブレイヤーを少し移動し、描画座標が直るか見る。
7. 消しゴム、バケツでも同じ流れを軽く確認する。

再現しない場合でも、どの手順では再現しなかったかを記録する。

### 3. 安全に直せる範囲だけ実装

実装してよい候補：

- `resize-popup.js` の undo/redo が `RenderTexture` サイズ・内容・表示 sprite を正しく戻すための小修正。
- リサイズ履歴コマンドに、旧キャンバスサイズ、旧レイヤー texture 状態、alignment offset を明確に保持する小修正。
- `camera:resized` 後に coordinate/cache/thumbnail/transform 表示を同期する小修正。
- 履歴適用中に描画・変形・サムネイル更新が不完全にならないようにする小修正。
- `TEGAKI_CONFIG.debug === true` のときだけ、history command 名、canvas size、active layer id、RenderTexture size、layer transform を出す診断ログを追加する。
- 現行で使われていない古い resize 経路が混乱を招く場合は、削除ではなく「非現行」とコメント・PROGRESS に明記する。

実装せず Codex 判断へ戻すもの：

- history command 形式の大幅変更。
- RenderTexture の履歴スナップショットを毎回保存する大規模設計。
- レイヤー構造そのものの変更。
- Vキー変形 bake の全面再設計。
- 保存・エクスポート・レイヤー編集機能の追加。
- WebGPU / SDF / MSDF / WebGL2 Mesh の復活。

---

## 受け入れ条件

- 起動直後、描画、消しゴム、バケツが従来どおり動く。
- `Ctrl+Z` / `Ctrl+Y` 後に、描画座標がキャンバスからズレない。
- リサイズ後、リサイズ undo/redo 後に、描画可能範囲と見た目のキャンバスが一致する。
- Vキーで少し動かさないと座標が直らない、という状態が解消または原因候補まで絞れている。
- `History:` 表示が極端に壊れない。
- Console に通常操作ログが過剰に増えない。
- `npm.cmd run build` が成功する。

---

## 作業後の報告

必ず `tegaki_work/PROGRESS.md` に追記する。

- 変更ファイル
- 変更理由
- 現行 resize 経路
- 現行 history command 一覧
- アンドゥ座標ズレの再現手順と結果
- 原因候補
- 実装した修正
- `npm.cmd run build` 結果
- ブラウザ確認結果
- 残った問題
- Codex / Claude に判断してほしい点
