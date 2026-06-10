# Phase 4z18 — Clip Layer Mirror Visibility Toggle

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4z17.md`
6. `task-gemini/phase4z17_report.md`
7. `tegaki_work/ui/layer-panel-renderer.js`
8. `tegaki_work/ui/animation-table-popup.js`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/styles/main.css`

## 重要な注意

- 今回は **CLIP LAYERSミラー上で内部Layerのvisible切替だけを行う**。
- Virtual Layer Panelとして通常Layer一覧を置換しない。
- 内部Layerへの直接描画、D&D、追加、削除、リネーム、順序変更はしない。
- CAF/ClipAsset/InternalLayerを `LayerSystem` へ投入しない。
- 通常Layer/通常FolderのDOM構造やSortableJS設定を壊さない。
- CAF/Internal Layer表示に `.layer-item` / `.folder-item` を使わない。
- CAF/Internal Layer表示に `data-layer-index` / `data-is-folder` を使わない。
- Timeline Y軸変更、Laneデータモデル変更、保存/復元形式変更、Export連携はしない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z17で、選択中ClipAssetの内部Layerをレイヤーパネル上部に `CLIP LAYERS` としてミラー表示できるようになった。

次は、通常Layer一覧を差し替える前に、ミラー上から最小の編集操作だけを通す。

既に `AnimationTablePopup` / `TimelineModel` には内部Layerのvisible切替があり、Previewにも反映されるため、最初の操作MVPは **可視/不可視切替** に限定する。

## 目的

`CLIP LAYERS` ミラー内の可視アイコンをクリックすると、選択中ClipAssetの該当内部Layerの `visible` を切り替え、Preview / Asset Library Inspector / Layer Panel Mirror が同期して更新されるようにする。

目的は以下。

- レイヤーパネル側からClipAsset内部Layerの最小編集操作を行える。
- 内部Layer操作を通常Layer操作と混同しないイベント経路で実装する。
- Virtual Layer Panel本体へ進む前に、Layer Panel -> ClipAsset内部Layer model -> Preview更新の経路を検証する。
- 通常レイヤー操作、D&D、サムネイル、opacity、clippingへ副作用を出さない。

## 今回やること

### 1. AnimationTablePopupに外部visible切替メソッドを追加する

`animation-table-popup.js` に、レイヤーパネルなど外部UIから内部Layer visibleを切り替えるためのメソッドを追加する。

メソッド名候補:

```js
toggleInternalLayerVisibilityFromExternal(assetId, layerId, options = {})
```

処理内容:

1. `assetId` / `layerId` を受け取る。
2. `model.getClipAsset(assetId)` でAssetを解決する。
3. Assetがない、Layerがない場合は `{ ok: false, reason: ... }` を返す。
4. 既存の `model.toggleClipAssetInternalLayerVisibility(asset.id, layerId)` を使う。
5. 成功時:
   - `selectedAssetId = asset.id`
   - `selectedAssetFolderId = asset.folderId || null`
   - `selectedInternalLayerId = layerId`
   - `render()`
   - `eventBus.emit('layer:panel-update-requested')`
6. `{ ok: true, asset, layer }` 相当を返す。

注意:

- 既存の `toggleInternalLayerVisibility(layerId)` はAsset Library Inspector用として維持してよい。
- 重複を減らせるなら、Inspector用メソッドから外部用メソッドへ委譲してもよい。
- `console.log` は残さない。

### 2. CLIP LAYERSミラーの可視アイコンをボタン化する

`layer-panel-renderer.js` の `createSelectedClipAssetLayerMirror()` を更新する。

現在:

```html
<span class="clip-layer-mirror-visibility">...</span>
```

候補:

```html
<button class="clip-layer-mirror-visibility-btn"
        data-asset-id="..."
        data-internal-layer-id="..."
        title="Toggle internal layer visibility">
  ...
</button>
```

注意:

- `.layer-item` を使わない。
- `data-layer-index` を付けない。
- `data-asset-id` / `data-internal-layer-id` は `_escapeHtml()` へ通す。
- 行クリックによる内部Layer選択と、可視ボタンクリックによるvisible切替が二重発火しないよう `e.stopPropagation()` または先にbutton判定でreturnする。

### 3. LayerPanelRenderer側のクリック委譲を更新する

既存のcontainer click handlerに、可視ボタン判定を追加する。

処理順:

1. `.clip-layer-mirror-visibility-btn` を先に判定。
2. 該当したら `toggleInternalLayerVisibilityFromExternal(assetId, layerId, { source: 'layer-panel-clip-layer-mirror' })` を呼ぶ。
3. 成功/失敗に関わらず通常Layerクリック処理へ流さない。
4. 次に `.caf-readonly-asset`。
5. 次に `.clip-layer-mirror-row` の選択同期。

注意:

- 可視ボタンクリック時にも、該当内部Layerを選択状態にしてよい。
- AnimationTablePopupが未初期化なら何もしない。
- エラー時も通常レイヤーパネルを壊さない。

### 4. Preview更新を確認する

内部Layerのvisibleは、Phase 4z10の内部Layer合成Previewで反映される。

実装後、以下が必要か確認する。

- `animationTable.render()` だけでPreviewが更新されるか。
- 必要なら既存のPreview更新経路に沿って最小限で更新する。

注意:

- 新しいPreviewイベントを増やす前に、既存の `render()` / `layer:panel-update-requested` / animation render経路を確認する。
- EventBus payloadを増やす場合は、同じイベント名の受信側を全検索して整合させる。

### 5. CSSを追加・調整する

`main.css` に可視ボタン用classを追加する。

候補class:

- `.clip-layer-mirror-visibility-btn`
- `.clip-layer-mirror-visibility-btn.is-hidden`

方針:

- 既存の `.clip-layer-mirror-visibility` 表示をbuttonへ置換または併用する。
- ボタンは小さく、通常Layerの可視ボタンと混同しすぎない見た目にする。
- hover/focus状態を最低限入れる。
- JSで大量のinline styleを追加しない。

## 今回やらないこと

- 内部Layerへの直接描画。
- 内部Layerのリネーム。
- 内部Layerの削除。
- 内部Layerの追加。
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
- `CLIP LAYERS` ミラー内の可視ボタンをクリックすると、該当内部Layerの `visible` が切り替わる。
- Asset Library側Internal Layer Inspectorの可視状態も同期して更新される。
- Canvas Previewでも内部Layerのvisible反映が確認できる。
- 可視ボタンクリックで通常Layerの選択やD&Dが誤作動しない。
- 行クリックによる内部Layer選択は従来通り動く。
- CAF/Internal Layerミラーに `.layer-item` / `.folder-item` / `data-layer-index` / `data-is-folder` を使っていない。
- SortableJSの通常レイヤーD&Dが従来通り動く。
- 通常Layer/通常Folderの選択、可視性、opacity、clipping、サムネイルが壊れない。
- 選択中ClipAssetがない場合にエラーが出ない。
- Consoleにエラーが出ない。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z18_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開き、Frame 1にClipAssetを配置する。
3. ClipAssetに内部Layerを複数作る。
4. CAFヘッダーまたはTimelineからClipAssetを選択し、`CLIP LAYERS` を表示する。
5. `CLIP LAYERS` の可視ボタンをクリックする。
6. ミラー上のアイコン/行の見た目が更新されることを確認する。
7. Asset Library側Inspectorでも同じ内部Layerのvisible状態が更新されることを確認する。
8. Preview上で該当内部Layerの表示/非表示が反映されることを確認する。
9. 通常Layer行のクリック、表示切替、D&Dが従来通り動くことを確認する。
10. ClipAsset未選択状態でエラーが出ないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z18_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加した外部visible切替メソッド名と処理内容。
- LayerPanelRendererからAnimationTablePopupへ渡す参照経路。
- 追加したDOM/class/dataset。
- クリックイベントの判定順と二重発火防止方法。
- Preview更新確認の結果。
- SortableJS対象外を維持した方法。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z18 完了ログを追記する。

最低限、以下を書く。

- Phase 4z18 の目的。
- 変更ファイル。
- `CLIP LAYERS` ミラーからのvisible切替内容。
- Preview / Inspector / Mirror の同期結果。
- 通常レイヤーD&Dへ影響しないこと。
- ビルド結果。
- 後続Phaseへ残すこと。
