# Phase 4z17 — Selected ClipAsset Internal Layer Mirror

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z15.md`
6. `task-gemini/phase4z15_report.md`
7. `task-gemini/phase4z16.md`
8. `task-gemini/phase4z16_report.md`
9. `tegaki_work/ui/layer-panel-renderer.js`
10. `tegaki_work/ui/animation-table-popup.js`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/styles/main.css`

## 重要な注意

- 今回は **選択中ClipAssetの内部Layerをレイヤーパネル側へ読み取り専用ミラー表示する** だけを行う。
- Virtual Layer Panelとして通常Layer一覧を置換しない。
- 内部Layerへの直接描画、内部LayerのD&D、内部LayerのCRUDはしない。
- CAF/ClipAsset/InternalLayerを `LayerSystem` へ投入しない。
- 通常Layer/通常FolderのDOM構造やSortableJS設定を壊さない。
- CAF/Internal Layer表示に `.layer-item` / `.folder-item` を使わない。
- CAF/Internal Layer表示に `data-layer-index` / `data-is-folder` を使わない。
- Timeline Y軸変更、Laneデータモデル変更、保存/復元形式変更、Export連携はしない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z15で、レイヤーパネル上部に現在FrameのCAF/ClipAsset概要を表示した。

Phase 4z16で、CAFヘッダー内のAssetをクリックすると、アニメテーブル側の `selectedCelId` / `selectedAssetId` / `selectedAssetFolderId` が同期するようになった。

次の安全な段階は、通常Layer一覧を差し替える前に、選択中ClipAssetの内部Layer構造をレイヤーパネル側で見えるようにすること。

これは最終的なVirtual Layer Panelではなく、**選択中ClipAssetの内部Layerミラー表示** である。

## 目的

レイヤーパネル上部のCAFヘッダーの下に、選択中ClipAssetの内部Layer一覧を読み取り専用で表示する。

目的は以下。

- CAFヘッダーで選択したClipAssetの中身が、レイヤーパネル側でも分かる。
- 通常Layer/通常FolderとClipAsset内部Layerを視覚的に区別する。
- 後続のVirtual Layer Panelで必要になる「選択Asset -> 内部Layer表示」の接続を確認する。
- 通常レイヤー操作、D&D、サムネイル、opacity、clippingへ副作用を出さない。

## 今回やること

### 1. 選択中ClipAssetを解決するヘルパーを追加する

`layer-panel-renderer.js` に、AnimationTablePopupから現在選択中のClipAssetを安全に取得するヘルパーを追加する。

メソッド名候補:

```js
_getSelectedClipAssetForLayerPanel()
```

取得方針:

1. `window.PopupManager?.get?.('animationTable')` でAnimationTablePopupを取得する。
2. `animationTable.selectedCelId` があれば `model.findClipEntry(selectedCelId)` からClipを解決する。
3. Clipに `assetId` があれば `model.getClipAsset(assetId)` を返す。
4. それが無理なら `animationTable.selectedAssetId` から `model.getClipAsset(selectedAssetId)` を返してよい。
5. どれも取れなければ `null`。

注意:

- 取得できない場合はミラー表示を出さず、通常レイヤーパネルを壊さない。
- ModelやPopupが未初期化の場合も例外を出さない。

### 2. Internal Layerミラー表示を追加する

`LayerPanelRenderer.render()` 内で、CAFヘッダーの直後、通常Layer行の前にInternal Layerミラーをappendする。

候補:

```js
const cafHeader = this.createCafReadonlyHeader();
if (cafHeader) this.container.appendChild(cafHeader);

const internalMirror = this.createSelectedClipAssetLayerMirror();
if (internalMirror) this.container.appendChild(internalMirror);
```

メソッド名候補:

```js
createSelectedClipAssetLayerMirror()
```

表示内容:

- title: `CLIP LAYERS`
- Asset名
- 内部Layer行:
  - visible状態
  - layer名
  - opacity
  - blendMode
  - snapshot状態（snapshot / blank / none 程度）

表示順:

- `ClipAsset.internalLayers` の配列順。
- 既存方針通り、配列先頭が上/前面に見えるように表示する。

空状態:

- 選択中ClipAssetがない場合は非表示。
- internalLayersがない/空の場合も非表示、または薄い `No internal layers` 表示。
- 推奨は、Assetがあるが内部Layerがない場合のみ薄いempty表示。

### 3. 専用DOM/classだけを使う

通常Layer用のclassやdatasetを流用しない。

候補class:

- `.clip-layer-mirror`
- `.clip-layer-mirror-title`
- `.clip-layer-mirror-asset`
- `.clip-layer-mirror-row`
- `.clip-layer-mirror-row.is-selected`
- `.clip-layer-mirror-row.is-hidden`
- `.clip-layer-mirror-visibility`
- `.clip-layer-mirror-name`
- `.clip-layer-mirror-meta`
- `.clip-layer-mirror-empty`

dataset候補:

- `data-internal-layer-id`
- `data-asset-id`

禁止:

- `.layer-item`
- `.folder-item`
- `data-layer-index`
- `data-is-folder`

### 4. 読み取り専用だが、内部Layer選択だけは同期してよい

今回の主目的は表示MVPだが、クリックで `AnimationTablePopup.selectedInternalLayerId` を同期する程度は入れてよい。

実装する場合:

1. `clip-layer-mirror-row` クリックで `selectedInternalLayerId` を該当IDにする。
2. `animationTable.render()` を呼び、Asset Library側Inspectorの選択表示も更新する。
3. `eventBus.emit('layer:panel-update-requested')` でレイヤーパネル側のselected表示も更新する。

注意:

- visible切替、rename、delete、order変更は今回はしない。
- クリック選択を入れる場合も、通常Layer選択とは別物として扱う。
- 通常Layerのactive layerは変更しない。

### 5. 選択中表示を追加する

`animationTable.selectedInternalLayerId` と一致する行へ `.is-selected` を付ける。

未選択の場合:

- 何もselected表示しない。
- ただしAssetに内部Layerがあるなら表示自体は行う。

不可視Layer:

- `visible === false` の場合は `.is-hidden` を付ける。
- 文字を薄くする程度に留める。

### 6. CSSを追加する

`main.css` に専用classを追加する。

方針:

- CAFヘッダーより少し小さく、通常Layer行とは違う見た目にする。
- 通常フォルダや通常Layerと混同しない配色にする。
- UIが大きくなりすぎないよう、行高はコンパクトにする。
- JSで大量のinline styleを追加しない。

## 今回やらないこと

- 通常Layer一覧を内部Layer一覧に置換する。
- 内部Layerへ直接描画する。
- 内部Layerのvisible切替、rename、delete、order変更。
- 内部LayerのD&D。
- ClipAsset/CAFのD&D。
- ClipAssetをTimelineへ配置するUI。
- Timeline Y軸をLane1/Lane2表示へ変える。
- Laneを通常Layer依存から切り離す。
- 保存/復元形式変更。
- Export連携。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- CAFヘッダーでAssetを選択すると、レイヤーパネル上部にそのClipAssetの内部Layer一覧が表示される。
- 内部Layerの表示順が `asset.internalLayers` の配列順に従う。
- visible / opacity / blendMode / snapshot状態が少なくとも読み取れる。
- 内部Layerクリック選択を実装した場合、Asset Library側Inspectorの選択表示と同期する。
- CAF/Internal Layerミラーに `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていない。
- SortableJSの通常レイヤーD&Dが従来通り動く。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、サムネイルが壊れない。
- 選択中ClipAssetがない場合にエラーが出ない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z17_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開き、Frame 1にClipAssetを配置する。
3. Asset LibraryまたはCAFヘッダーからClipAssetを選択する。
4. レイヤーパネル上部に `CLIP LAYERS` が表示されることを確認する。
5. 内部Layer名、visible、opacity、blendMode、snapshot状態が表示されることを確認する。
6. 内部Layerを複数作り、表示順がInspectorの前面/背面方針と矛盾しないことを確認する。
7. 内部Layerクリック選択を実装した場合、Inspector側の選択表示が同期することを確認する。
8. 通常Layer行のクリック、表示切替、D&Dが従来通り動くことを確認する。
9. ClipAssetがないFrame、または選択中ClipAssetがない状態でエラーが出ないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z17_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 選択中ClipAssetの解決方法。
- 追加したInternal LayerミラーDOM/class/dataset。
- 内部Layerクリック選択を入れたかどうか。
- SortableJS対象外を維持した方法。
- 表示順、visible、opacity、blendMode、snapshot状態の扱い。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z17 完了ログを追記する。

最低限、以下を書く。

- Phase 4z17 の目的。
- 変更ファイル。
- 選択中ClipAssetの内部Layerミラー表示内容。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
