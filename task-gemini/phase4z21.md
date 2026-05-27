# Phase 4z21 — CAF Operation Authority Boundary

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z20.md`
6. `task-gemini/phase4z20_report.md`
7. `tegaki_work/ui/animation-table-popup.js`
8. `tegaki_work/ui/layer-panel-renderer.js`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/styles/main.css`

## 重要な方針

Phase 4z20で、CAF / Lane / Layer Panelの見え方を最終思想に寄せた。

次は、見た目をさらに増やすのではなく、操作権限を明確にする。

- CAF自体の移動、コピー、削除、Frame移動、Lane移動はアニメテーブルで行う。
- Layer Panelは、現在Frameに存在するCAFの中身を表示・編集する場所。
- Layer Panel側でCAF自体を移動/コピー/削除できるUIを作らない。
- アニメテーブルでCAF操作を行った結果は、Layer Panel側に反映される。

今回のPhaseは、この責務境界をコード上で確認し、必要な最小更新だけを入れる。

## 目的

アニメテーブルをCAF操作の正本にし、Layer Panelは反映表示とCAF内部編集に限定する。

目的は以下。

- アニメテーブル側のClip/CAF操作後にLayer Panelが必ず更新される。
- Layer Panel側にCAF自体の移動/コピー/削除に見える操作が残っていないことを確認する。
- CAF/Clip操作と内部Layer操作を混同しない。
- 次のLane/CAFデータ整理へ進む前に、操作責務のブレをなくす。

## 今回やること

### 1. アニメテーブル側のCAF操作を棚卸しする

`animation-table-popup.js` と `animation-data-model.js` を調査し、現在あるClip/CAF相当操作を一覧化する。

最低限、以下を確認する。

- FrameセルクリックによるClip作成。
- Alt/Shiftクリック等によるClip削除。
- Clip移動。
- Clip duration変更。
- COPY / PASTE。
- UNIQUE。
- Asset移動。
- Frame移動。

報告書に、各操作がどのメソッド/イベントで実行されているかを書く。

### 2. アニメテーブル操作後のLayer Panel更新を保証する

現在FrameのCAF表示はLayer Panel側で `getFrameAssetTree()` や選択中Assetを読んでいる。

そのため、アニメテーブル側で以下の操作をした後、Layer Panelが更新される必要がある。

- Clip作成。
- Clip削除。
- Clip移動。
- Clip duration変更。
- COPY / PASTE。
- UNIQUE。
- Frame変更。
- Asset/Folder移動。
- 内部Layer visible / rename。

作業:

- 既存の `this.render()` だけでLayer Panelが更新されるか確認する。
- 不足している箇所では、既存の `eventBus.emit('layer:panel-update-requested')` を最小限追加する。
- 重複emitが多すぎる場合は、小さなヘルパーにまとめてよい。

候補ヘルパー:

```js
_requestLayerPanelSync() {
    this.eventBus?.emit?.('layer:panel-update-requested');
    window.timelineUI?.updateLayerPanelIndicator?.();
}
```

注意:

- 新しいイベント名を増やす前に既存イベントで済ませる。
- EventBus payloadを増やす場合は同名イベントの受信側を全検索する。
- 無関係な通常Layerイベントへ混ぜない。

### 3. Layer Panel側にCAF自体の操作UIがないことを確認する

`layer-panel-renderer.js` を確認する。

確認対象:

- CAF行/CAF簡易表示に、CAF自体の移動/コピー/削除ボタンがないこと。
- CAF行/CAF簡易表示がSortableJS対象になっていないこと。
- CAF表示に `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていないこと。
- CAF内部Layer操作は、visible / rename / row select程度に限定されていること。

必要なら、紛らわしいボタン/カーソル/hoverを弱める。

注意:

- Layer Panel側でCAF自体のD&Dを実装しない。
- Layer Panel側でCAFコピー/削除を実装しない。
- 今回はCAF内部Layerの追加/削除/順序変更も行わない。

### 4. 用語を軽く整理する

ユーザーに見える表示で、CAF自体と内部Layerが混同される箇所があれば軽く直す。

例:

- `FRAME ASSETS` のような独立カード語は避ける。
- CAF行ではCAF名とLane補助表示を分ける。
- 内部Layer行はCAF配下に見えるようにする。

注意:

- 大きなデザイン変更はしない。
- Phase 4z20で整えたシンプル方向を維持する。

## 今回やらないこと

- Laneデータモデルの独立化。
- `syncWithLayers()` の根本変更。
- CAFの保存形式変更。
- CAF/内部LayerのD&D。
- 内部Layerの追加/削除/順序変更。
- 内部Layerへの直接描画。
- Virtual Layer Panelとして通常Layer一覧を完全置換すること。
- ClipAssetをTimelineへ配置する新UI。
- Export連携。
- レイヤーパネルの大幅デザイン変更。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- アニメテーブル側でClip/CAF作成・削除・移動・COPY/PASTE・Frame変更をした時、Layer Panel側のCAF表示が更新される。
- CAF自体の移動/コピー/削除/別Lane移動はLayer Panel側からできない。
- CAF表示がSortableJS対象になっていない。
- CAF/Internal Layer表示に `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていない。
- 内部Layerの選択、visible切替、renameは従来通り動く。
- Timeline Y軸の `Lane 1`, `Lane 2` 表示は維持される。
- Frame表示の `Frame 1` 同期は維持される。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、D&D、サムネイルが壊れない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z21_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開く。
3. Frame 1でClip/CAFを作成し、Layer PanelのCAF表示が出ることを確認する。
4. Frameを移動し、Layer PanelのCAF表示とFrame表示が同期することを確認する。
5. Clipを移動し、Layer Panel表示が新しいFrame/Lane状態へ反映されることを確認する。
6. COPY / PASTE後にLayer Panel表示が更新されることを確認する。
7. Clip削除後にLayer Panel表示が消える、または現在Frameの状態へ更新されることを確認する。
8. Layer Panel側でCAF自体をD&D/コピー/削除できないことを確認する。
9. 内部Layerの選択、visible切替、renameが従来通り動くことを確認する。
10. 通常Layer行のクリック、表示切替、D&Dが従来通り動くことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z21_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 棚卸ししたアニメテーブル側Clip/CAF操作一覧。
- Layer Panel更新を追加/確認した箇所。
- CAF自体の操作をLayer Panel側へ持たせていない確認結果。
- SortableJS対象外を維持した方法。
- 既存の内部Layer選択/visible/renameを維持した確認結果。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z21 完了ログを追記する。

最低限、以下を書く。

- Phase 4z21 の目的。
- アニメテーブル側Clip/CAF操作の棚卸し結果。
- Layer Panel更新同期の補強内容。
- CAF自体の操作権限をアニメテーブル側に限定した確認。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
