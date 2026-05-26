# Phase 4z16 — CAF Header Selection Bridge

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z15.md`
6. `task-gemini/phase4z15_report.md`
7. `tegaki_work/ui/layer-panel-renderer.js`
8. `tegaki_work/ui/animation-table-popup.js`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/styles/main.css`

## 重要な注意

- 今回は **CAFヘッダーから現在Frame上のClip/Assetを選択する橋渡し** だけを行う。
- Virtual Layer Panel、内部Layerへの直接描画、Timeline Y軸変更、Laneデータモデル変更はしない。
- CAF/ClipAsset/InternalLayerを `LayerSystem` へ投入しない。
- CAF表示に `.layer-item` / `.folder-item` を使わない。
- CAF表示に `data-layer-index` / `data-is-folder` を使わない。
- 通常Layer/通常FolderのDOM構造やD&D処理を変更しない。
- 保存/復元形式、Export連携、ClipAsset配置UIは変更しない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z15で、レイヤーパネル上部に現在FrameのCAF/ClipAsset概要を表示する `FRAME ASSETS` ヘッダーが入った。

ただし現状は完全な読み取り専用で、表示されたAssetからアニメテーブル側のClip/Asset選択へ移動できない。

次は、CAFヘッダーを通常レイヤー一覧へ混ぜる前に、**表示されているFrame Assetをクリックすると、アニメテーブル側の選択状態と同期する** 小さな橋渡しを作る。

これは最終UIではなく、後続のCAF行表示 / Virtual Layer Panel / ClipAsset編集対象切替のための接続確認である。

## 目的

レイヤーパネル上部のCAFヘッダー内でAsset名をクリックすると、該当する現在Frame上のClipを選択し、Asset Library / Internal Layer Inspector がそのAssetを表示できる状態にする。

目的は以下。

- レイヤーパネル側から「今見えている素材」を選択できる。
- `selectedCelId` / `selectedAssetId` / `selectedAssetFolderId` の同期経路を明確にする。
- 後続のVirtual Layer Panelへ進む前に、Layer Panel -> AnimationTable の安全な参照・選択経路を確認する。
- 通常レイヤーD&Dや通常レイヤー選択へ副作用を出さない。

## 今回やること

### 1. AnimationTablePopupに外部選択用メソッドを追加

`animation-table-popup.js` に、レイヤーパネルなど外部UIから呼べる選択メソッドを追加する。

メソッド名候補:

```js
selectClipAssetFromExternal(clipId, options = {})
```

または:

```js
selectFrameAssetClip(clipId, options = {})
```

処理内容:

1. `this.model.findClipEntry(clipId)` でClipを解決する。
2. 見つからなければ `{ ok: false, reason: 'clip-not-found' }` を返す。
3. `selectedCelId` に `clip.id` をセットする。
4. `clip.assetId` があればAssetを解決する。
5. Assetが見つかれば:
   - `selectedAssetId = asset.id`
   - `selectedAssetFolderId = asset.folderId || null`
   - `selectedInternalLayerId = null`
6. Assetが見つからない場合は:
   - `selectedAssetId = null`
   - `selectedInternalLayerId = null`
   - folder選択は必要以上に動かさない。迷う場合は `null` にする。
7. `this.render()` を呼び、タイムライン選択・Asset Library・Inspectorを更新する。
8. 必要なら `eventBus.emit('layer:panel-update-requested')` でCAFヘッダー側の選択表示も更新する。
9. `{ ok: true, clip, asset }` 相当を返す。

注意:

- 外部選択用メソッドは、Clip作成・削除・移動をしない。
- 現在Frameは原則変更しない。CAFヘッダーは現在FrameのClipだけを表示しているため、クリック時にFrameを飛ばす必要はない。
- ただし将来の拡張を考え、`options.focusFrame === true` のような引数を入れる場合は、今回は使わなくてよい。

### 2. CAFヘッダーのAsset行をクリック可能にする

`layer-panel-renderer.js` の `createCafReadonlyHeader()` を更新する。

現在はgroup単位のAsset名サマリーだけだが、クリック対象にするため、各ClipEntryを小さな行またはボタンとして出す。

候補DOM:

```html
<div class="caf-readonly-group">
  <span class="caf-readonly-badge">CAF</span>
  <span class="caf-readonly-name">Dog</span>
  <span class="caf-readonly-count">2</span>
</div>
<button class="caf-readonly-asset" data-clip-id="..." data-asset-id="...">
  Run
</button>
```

注意:

- `.layer-item` を使わない。
- `data-layer-index` を付けない。
- `data-clip-id` / `data-asset-id` はCAF専用DOMにだけ付ける。
- Asset名は `_escapeHtml()` でエスケープする。
- `innerHTML` を使う場合、dataset値も安全な値だけを入れる。迷う場合は `createElement()` で組み立てる。

表示件数:

- 初期MVPでは、各groupあたり最大3件表示でよい。
- 4件以上ある場合は `+N more` のような薄い表示を追加してよい。
- クリック可能なのは実表示されているAssetだけでよい。

### 3. pointer-events の扱いを見直す

Phase 4z15では `.caf-readonly-header { pointer-events: none; }` だった。

今回クリック可能にするため、CSSを以下のどちらかに変更する。

推奨:

- `.caf-readonly-header` は `pointer-events: auto`
- `.caf-readonly-asset` をbutton化し、クリック可能にする
- SortableJS側はすでに `draggable: '.layer-item'` なのでCAFヘッダーはD&D対象外

または:

- headerは `pointer-events: none`
- asset buttonだけ `pointer-events: auto`

どちらでもよいが、実装後に通常レイヤーD&Dへ影響しないことを確認する。

### 4. LayerPanelRenderer側でクリックイベントを処理する

CAFヘッダー内の `.caf-readonly-asset` クリック時に、AnimationTablePopupの外部選択メソッドを呼ぶ。

候補:

```js
const animationTable = window.PopupManager?.get?.('animationTable');
const result = animationTable?.selectClipAssetFromExternal?.(clipId, { source: 'layer-panel-caf-header' });
```

注意:

- `click` handlerはCAFヘッダー内だけに付けるか、container上でCAF専用classを判定する。
- 通常Layer/Folderのクリック処理と混ぜない。
- 選択失敗時は何もしない。`console.log` は残さない。
- クリック時にアニメテーブルpopupを強制表示するかどうかは、今回は原則しない。
  - 既に開いていれば選択状態が見える。
  - 閉じていても内部状態だけ更新できればよい。
  - 強制表示が必要と判断した場合は理由を報告書に書く。

### 5. 選択中表示を追加する

現在選択中のClip/AssetがCAFヘッダーにも分かるように、該当Asset buttonへselected classを付ける。

候補class:

- `.caf-readonly-asset.is-selected`

判定:

- `animationTable.selectedCelId === clipEntry.clipId`
- または `animationTable.selectedAssetId === clipEntry.assetId`

推奨は `selectedCelId` 優先。

## 今回やらないこと

- CAFヘッダーからInternal Layerを直接選択する。
- CAFヘッダーを通常レイヤー一覧へ混ぜる。
- CAF/ClipAsset/InternalLayerのD&D。
- ClipAssetをTimelineへ配置するUI。
- Timeline Y軸をLane1/Lane2表示へ変える。
- Laneを通常Layer依存から切り離す。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- 保存/復元形式変更。
- Export連携。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- CAFヘッダー内のAsset名をクリックできる。
- クリックしたAssetに対応する現在Frame上のClipが `selectedCelId` になる。
- Asset Library側で対応Assetが選択状態になり、Internal Layer InspectorがそのAssetを表示する。
- CAFヘッダー上にも選択中表示が出る。
- `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` をCAF表示に使っていない。
- SortableJSの通常レイヤーD&Dが従来通り動く。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、サムネイルが壊れない。
- ClipAssetがないFrameでエラーが出ない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z16_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開き、Frame 1にClipAssetを複数配置する。
3. Asset Libraryを表示しておく。
4. レイヤーパネル上部の `FRAME ASSETS` にAsset名が出ることを確認する。
5. CAFヘッダー内のAsset名をクリックする。
6. アニメテーブル上の該当Clipが選択状態になることを確認する。
7. Asset Libraryで該当Assetが選択され、Internal Layer Inspectorが表示されることを確認する。
8. CAFヘッダー内のクリックしたAssetにselected表示が付くことを確認する。
9. 通常レイヤー行のクリック、表示切替、D&Dが従来通り動くことを確認する。
10. ClipAssetがないFrameへ移動してもエラーが出ないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z16_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加した外部選択メソッド名と処理内容。
- LayerPanelRendererからAnimationTablePopupへ渡す参照経路。
- CAFヘッダーで追加したDOM/class/dataset。
- SortableJS対象外を維持した方法。
- pointer-eventsの扱い。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z16 完了ログを追記する。

最低限、以下を書く。

- Phase 4z16 の目的。
- 変更ファイル。
- CAFヘッダークリックで同期する選択状態。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
