# Phase 4z22 — Lane / CAF Dependency Audit

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_BOUNDARY.md`
5. `tegaki_work/PHASE4Z_HANDOFF.md`
6. `task-gemini/phase4z20.md`
7. `task-gemini/phase4z21.md`
8. `tegaki_work/system/animation/animation-data-model.js`
9. `tegaki_work/ui/animation-table-popup.js`
10. `tegaki_work/ui/layer-panel-renderer.js`
11. `tegaki_work/ui/timeline-ui.js`

## 重要な方針

今回は実装を行わない。

Phase 4z20/4z21で、Timeline Y軸の見た目は `Lane 1`, `Lane 2` に寄せた。しかし内部構造はまだ通常Layer由来であり、`syncWithLayers()` や `sourceLayerId` 依存が残っている。

次の本実装へ進む前に、どこを切り離す必要があるかを棚卸しする。

Layer Panelはまだ過渡表示であり、今回触らない。CAF表示のデザイン調整、DOM構造変更、内部Layerミラー追加改修はしない。

## 目的

Laneを通常Layerの鏡から独立したアニメテーブルのY軸へ移行するため、現行コードの依存点を正確に洗い出す。

特に確認すること:

- `syncWithLayers()` が何を生成・更新しているか。
- `sourceLayerId` がどの操作で必要になっているか。
- Clip作成、Capture、Preview、移動、コピー、削除が通常Layerにどれだけ依存しているか。
- `Lane 1` 表示と内部データのズレがどこに残っているか。
- 次にCodexが直接実装すべき危険箇所と、Geminiへ任せられる小作業を分ける。

## 今回やること

### 1. `syncWithLayers()` の棚卸し

`animation-data-model.js` の `syncWithLayers()` を読む。

報告書に以下を書く。

- 入力として参照しているLayerSystem情報。
- Lane/Trackへコピーしている値。
- 既存Laneを維持している条件。
- 通常Layerが削除・追加・リネームされた時の影響。
- ここを変更すると壊れそうな後続メソッド。

### 2. `sourceLayerId` 依存の全検索

`rg "sourceLayerId" tegaki_work` を実行し、使われ方を分類する。

分類例:

- Lane識別。
- Clip作成元Layer。
- Snapshot取得。
- Preview表示。
- Capture対象。
- Layer表示切替。
- UI表示名。

報告書では、ファイル名・メソッド名・用途を表にする。

### 3. アニメテーブル側操作の通常Layer依存を整理する

`animation-table-popup.js` を中心に、以下の操作を確認する。

- 空セルクリックによるClip作成。
- CAPTURE。
- AUTO。
- PREVIEW。
- Clip移動。
- COPY / PASTE。
- UNIQUE。
- duration変更。
- Frame移動。
- Lane表示名。

それぞれについて、通常Layer依存の有無を書く。

### 4. 次の移行案を小さく分ける

実装案を最低3段階に分ける。

例:

- Phase 4z23候補: LaneModelに独立表示名を持たせ、UI表示だけを通常Layer名から完全に切り離す。
- Phase 4z24候補: Clip作成時の初期Asset生成を通常Layer依存から弱める。
- Phase 4z25候補: Capture/Previewの`sourceLayerId`依存をClipAsset/Snapshot中心へ寄せる。

各候補について、Codex担当かGemini担当かを書く。

判断基準:

- モデル責務、保存形式、EventBus、LayerSystem、SortableJS、RenderTextureに触るものはCodex担当。
- 調査、表作成、既存名の表示変更、限定CSS程度はGemini担当可。

## 今回やらないこと

- コード変更。
- CSS変更。
- Layer Panelの見た目変更。
- CAF表示のDOM変更。
- 内部Layerミラーの追加改修。
- `syncWithLayers()` の実装修正。
- `sourceLayerId` の削除。
- Lane独立化の本実装。
- 保存形式変更。
- EventBusイベント追加。
- SortableJS設定変更。
- CAF/内部LayerのD&D。
- 内部Layerへの直接描画。
- Virtual Layer Panel化。

## 受け入れ条件

- `task-gemini/phase4z22_report.md` が作成されている。
- `syncWithLayers()` の依存関係が整理されている。
- `sourceLayerId` の使用箇所が分類されている。
- アニメテーブル主要操作ごとの通常Layer依存が表になっている。
- 次の小Phase候補が3つ以上あり、Codex担当/Gemini担当が分かれている。
- コード差分がない。
- `tegaki_work/PROGRESS.md` に調査完了ログが追加されている。
- `npm.cmd run build` は任意。実行した場合は結果を書く。実行しない場合は、今回は調査のみのため未実行と書く。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z22_report.md`

報告書には以下を必ず書く。

- 読んだファイル一覧。
- `syncWithLayers()` の現状。
- `sourceLayerId` 使用箇所一覧。
- アニメテーブル操作ごとの通常Layer依存表。
- Lane独立化へ向けたリスク。
- 次Phase候補。
- Codexに判断してほしい点。
- コード変更なしで終えたこと。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z22 完了ログを追記する。

最低限、以下を書く。

- Phase 4z22が調査専用であること。
- `syncWithLayers()` / `sourceLayerId` の棚卸し結果要約。
- 次Phase候補。
- コード変更なし。

