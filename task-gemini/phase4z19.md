# Phase 4z19 — Clip Layer Mirror Rename Bridge

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z17.md`
6. `task-gemini/phase4z17_report.md`
7. `task-gemini/phase4z18.md`
8. `task-gemini/phase4z18_report.md`
9. `tegaki_work/ui/layer-panel-renderer.js`
10. `tegaki_work/ui/animation-table-popup.js`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/styles/main.css`

## 重要な注意

- 今回は **CLIP LAYERSミラー上から内部Layer名をリネームする橋渡し** だけを行う。
- Virtual Layer Panelとして通常Layer一覧を置換しない。
- 内部Layerへの直接描画、D&D、追加、削除、順序変更はしない。
- opacity / blendMode の編集はしない。
- CAF/ClipAsset/InternalLayerを `LayerSystem` へ投入しない。
- 通常Layer/通常FolderのDOM構造やSortableJS設定を壊さない。
- CAF/Internal Layer表示に `.layer-item` / `.folder-item` を使わない。
- CAF/Internal Layer表示に `data-layer-index` / `data-is-folder` を使わない。
- Timeline Y軸変更、Laneデータモデル変更、保存/復元形式変更、Export連携はしない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z17で、選択中ClipAssetの内部Layerをレイヤーパネル上部に `CLIP LAYERS` としてミラー表示できるようになった。

Phase 4z18で、ミラー上から内部Layerのvisible切替ができるようになった。

次は、Virtual Layer Panelへ進む前に、ミラー上からの低リスクな編集操作として **内部Layer名のリネーム** を追加する。

既に `AnimationTablePopup` / `TimelineModel` には内部Layerリネーム機能があり、Asset Library Inspectorでも使われている。今回はそれをレイヤーパネル側ミラーから安全に呼び出す。

## 目的

`CLIP LAYERS` ミラー内の内部Layer名をダブルクリック、または小さなリネームボタンから変更できるようにする。

目的は以下。

- レイヤーパネル側からClipAsset内部Layerの基本編集を行える。
- Mirror / Inspector / Asset model の名前表示を同期する。
- 通常LayerのリネームUIと混同しない独立したイベント経路を作る。
- 通常レイヤー操作、D&D、サムネイル、opacity、clippingへ副作用を出さない。

## 今回やること

### 1. AnimationTablePopupに外部リネームメソッドを追加する

`animation-table-popup.js` に、レイヤーパネルなど外部UIから内部Layer名を変更するためのメソッドを追加する。

メソッド名候補:

```js
renameInternalLayerFromExternal(assetId, layerId, name = null, options = {})
```

処理内容:

1. `assetId` / `layerId` を受け取る。
2. `model.getClipAsset(assetId)` でAssetを解決する。
3. Assetがない、Layerがない場合は `{ ok: false, reason: ... }` を返す。
4. `name` が `null` / `undefined` の場合は、既存のLayer名を初期値にして `prompt()` を出す。
5. `name` が文字列の場合はそれを使う。
6. 空白だけの名前は既存の `renameClipAssetInternalLayer()` 側の `invalid-name` に従って失敗扱いにする。
7. 成功時:
   - `selectedAssetId = asset.id`
   - `selectedAssetFolderId = asset.folderId || null`
   - `selectedInternalLayerId = layerId`
   - `render()`
   - `eventBus.emit('layer:panel-update-requested')`
8. `{ ok: true, asset, layer }` 相当を返す。

注意:

- 既存の `renameInternalLayer(layerId)` はAsset Library Inspector用として維持してよい。
- 重複を減らせるなら、Inspector用メソッドから外部用メソッドへ委譲してもよい。
- `console.log` は残さない。
- リネーム失敗時に通常レイヤーパネルを壊さない。

### 2. CLIP LAYERSミラーにリネームUIを追加する

`layer-panel-renderer.js` の `createSelectedClipAssetLayerMirror()` を更新する。

候補:

```html
<button class="clip-layer-mirror-rename-btn"
        data-asset-id="..."
        data-internal-layer-id="..."
        title="Rename internal layer">
  ✎
</button>
```

配置:

- 行の右端、metaの近くに小さく置く。
- 既存のvisibleボタンとは別ボタンにする。
- あるいはレイヤー名のダブルクリックでもよい。

推奨:

- まずは小さな `✎` ボタンで実装する。
- ダブルクリックは後続でもよい。

注意:

- `.layer-item` を使わない。
- `data-layer-index` を付けない。
- `data-asset-id` / `data-internal-layer-id` は `_escapeHtml()` へ通す。
- リネームボタンクリックが行クリック選択や通常Layerクリックへ流れないよう、クリック判定順を先にする。

### 3. LayerPanelRenderer側のクリック委譲を更新する

既存のcontainer click handlerに、リネームボタン判定を追加する。

処理順の推奨:

1. `.clip-layer-mirror-visibility-btn`
2. `.clip-layer-mirror-rename-btn`
3. `.caf-readonly-asset`
4. `.clip-layer-mirror-row`

リネーム処理:

```js
const result = animationTable.renameInternalLayerFromExternal(assetId, layerId, null, {
    source: 'layer-panel-clip-layer-mirror'
});
```

注意:

- promptをキャンセルした場合は何もしない。
- 成功時はMirror / Inspectorの名前が更新されること。
- 失敗時は通常レイヤーパネルを壊さない。

### 4. CSSを追加・調整する

`main.css` にリネームボタン用classを追加する。

候補class:

- `.clip-layer-mirror-rename-btn`

方針:

- 小さく、通常LayerのリネームUIと混同しすぎない見た目にする。
- hover/focus状態を最低限入れる。
- 行の情報量が増えすぎる場合は、hover時だけ少し目立つようにしてよい。
- JSで大量のinline styleを追加しない。

## 今回やらないこと

- 内部Layerへの直接描画。
- 内部Layerの追加。
- 内部Layerの削除。
- 内部Layerの順序変更。
- 内部LayerのD&D。
- opacity / blendMode の編集。
- 通常Layer一覧を内部Layer一覧に置換する。
- ClipAsset/CAFのD&D。
- ClipAssetをTimelineへ配置するUI。
- Timeline Y軸をLane1/Lane2表示へ変える。
- Laneを通常Layer依存から切り離す。
- 保存/復元形式変更。
- Export連携。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- `CLIP LAYERS` ミラー内のリネームボタンから内部Layer名を変更できる。
- Asset Library側Internal Layer Inspectorの名前表示も同期して更新される。
- Mirror側の名前表示も同期して更新される。
- 空白名は受け付けない。
- promptキャンセル時に状態が変わらない。
- リネームボタンクリックで通常Layerの選択やD&Dが誤作動しない。
- 行クリックによる内部Layer選択、可視ボタンによるvisible切替は従来通り動く。
- CAF/Internal Layerミラーに `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていない。
- SortableJSの通常レイヤーD&Dが従来通り動く。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、サムネイルが壊れない。
- 選択中ClipAssetがない場合にエラーが出ない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z19_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開き、Frame 1にClipAssetを配置する。
3. ClipAssetに内部Layerを複数作る。
4. CAFヘッダーまたはTimelineからClipAssetを選択し、`CLIP LAYERS` を表示する。
5. `CLIP LAYERS` のリネームボタンから内部Layer名を変更する。
6. Mirror上の名前が更新されることを確認する。
7. Asset Library側Inspectorの名前も更新されることを確認する。
8. 空白名を試し、拒否されることを確認する。
9. promptをキャンセルし、状態が変わらないことを確認する。
10. 可視ボタン、行クリック選択、通常Layer行のクリック、通常Layer D&Dが従来通り動くことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z19_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加した外部リネームメソッド名と処理内容。
- LayerPanelRendererからAnimationTablePopupへ渡す参照経路。
- 追加したDOM/class/dataset。
- クリックイベントの判定順と二重発火防止方法。
- 空白名 / キャンセル時の扱い。
- SortableJS対象外を維持した方法。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z19 完了ログを追記する。

最低限、以下を書く。

- Phase 4z19 の目的。
- 変更ファイル。
- `CLIP LAYERS` ミラーからのリネーム内容。
- Inspector / Mirror の同期結果。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
