# Phase 4z14 — Frame Asset Tree Helper

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z12_report.md`
7. `task-gemini/phase4z13.md`
8. `task-gemini/phase4z13_report.md`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回は **現在FrameのClipAsset/CAFツリーを返す純データヘルパー** だけを実装する。
- UI変更はしない。
- レイヤーパネルDOM変更はしない。
- `layer-panel-renderer.js` / `layer-system.js` は今回触らない。
- Timeline Y軸表示変更はしない。
- Laneデータモデル変更はしない。
- ClipAssetのTimeline配置、Virtual Layer Panel、内部Layerへの直接描画はしない。
- D&D、保存/復元形式、Export連携は変更しない。
- `animation-table-popup.js` に表示UIを足さない。必要ならデバッグ確認だけに留める。
- `dist/` は成果物に含めない。

## 背景

Phase 4z13で、CAF相当の上位概念をレイヤーパネルへ将来表示する前に、現在FrameにあるClipAsset/CAFを解決する純データ入力が必要だと確認した。

今後の用途:

- レイヤーパネル上部のCAF読み取り専用ヘッダー。
- CAF専用行の表示。
- Virtual Layer Panelの表示対象解決。
- ExportやFrame Compositeの補助。

このPhaseでは、まずUIから独立したデータヘルパーを作る。

## 目的

`TimelineModel` に、指定FrameのClipAsset/CAF構造をタイムラインY軸順で返す純データヘルパーを追加する。

目的は以下。

- 現在Frameに存在するClipInstanceを取得できる。
- ClipInstanceからClipAssetを取得できる。
- ClipAssetの `folderId` からClipAssetFolderを取得できる。
- CAF/FolderごとにClipAssetをgroup化できる。
- 表示順は初期実装では **タイムラインY軸順** を優先する。
- UI変更なしで、後続Phaseの共通入力にする。

## 今回やること

### 1. `TimelineModel.getFrameAssetTree(frameIndex, options = {})` を追加

`tegaki_work/system/animation/animation-data-model.js` に純データヘルパーを追加する。

候補シグネチャ:

```js
getFrameAssetTree(frameIndex = this.playback.currentFrame, options = {}) { ... }
```

戻り値候補:

```js
{
    frameIndex,
    groups: [
        {
            folderId,
            folderName,
            isUncategorized,
            laneIds: [],
            clips: [
                {
                    clipId,
                    laneId,
                    laneName,
                    laneIndex,
                    assetId,
                    assetName,
                    folderId,
                    internalLayerCount,
                    visibleInternalLayerCount,
                    isBlank,
                    startFrame,
                    duration
                }
            ]
        }
    ],
    clips: [...], // flat list. groups内と同じclip entryでよい
    missingAssets: [
        { clipId, laneId, laneName, reason }
    ]
}
```

必要に応じて名前は調整してよいが、意味が分かる命名にする。

### 2. 表示順

初期実装では、Clipの並び順は **TimelineのY軸順** とする。

方針:

- `this.tracks` を配列順に走査する。
- `lane.getCelAtFrame(frameIndex)` でそのFrameのClipを取る。
- 取得順を維持して `clips` flat list に入れる。
- `groups` 内の `clips` も、最初に出現したY軸順を維持する。
- `groups` 自体も、最初にそのFolderが出現したY軸順を維持する。

注意:

- Asset LibraryのFolder順では並べない。
- これはFrame上の見た目・Previewと対応しやすくするため。

### 3. Uncategorizedの扱い

`asset.folderId` がない、または存在しないFolder IDの場合は、`Uncategorized` groupへ入れる。

候補:

```js
{
    folderId: null,
    folderName: 'Uncategorized',
    isUncategorized: true,
    ...
}
```

存在しないFolder IDを持つAssetは、`missingAssets` ではなく `Uncategorized` 扱いでよい。

ただし、報告書にはその理由を書く。

### 4. Missing Assetの扱い

ClipInstanceに `assetId` がない、または `assetId` が壊れている場合は、`missingAssets` に入れる。

例:

```js
{ clipId, laneId, laneName, reason: 'no-asset-id' }
{ clipId, laneId, laneName, reason: 'asset-not-found' }
```

エラーを投げない。

Previewや既存操作を止めない。

### 5. Clip entryに含める情報

最低限、以下を含める。

- `clipId`
- `laneId`
- `laneName`
- `laneIndex`
- `assetId`
- `assetName`
- `folderId`
- `internalLayerCount`
- `visibleInternalLayerCount`
- `isBlank`
- `startFrame`
- `duration`

`isBlank` は `asset.drawingSnapshotId` から `getDrawingSnapshot()` して `snapshot.isBlank === true` を見る。

内部Layer数:

- `internalLayerCount`: `asset.internalLayers.length`
- `visibleInternalLayerCount`: `asset.internalLayers.filter(layer => layer.visible !== false).length`

### 6. 互換性

- 既存の `getSnapshotForCel()`、`getPreviewInternalLayersForCel()`、`syncWithLayers()` は壊さない。
- 既存メソッドの戻り値を変更しない。
- `serialize()` に新フィールドを増やさない。
- データは読み取り専用に扱う。AssetやClipを変更しない。

### 7. 確認用の最小デバッグ

UIは増やさない。

確認は、以下のようなコードレベル/コンソールレベルでよい。

```js
window.animationTablePopup?.model?.getFrameAssetTree?.()
```

または該当インスタンスにアクセスできない場合、報告書に確認できた範囲を書く。

一時的な `console.log` は残さない。

## 今回やらないこと

- レイヤーパネルへのCAF表示。
- CAF Header表示。
- CAF専用CSS class定義。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- Timeline Y軸表示変更。
- Lane追加/削除UI。
- ClipAssetをTimelineへ配置するUI。
- D&D。
- 保存/復元形式変更。
- Export連携。

## 受け入れ条件

- `TimelineModel.getFrameAssetTree(frameIndex, options = {})` または同等の明確な名前のヘルパーが追加される。
- ヘルパーはUIに依存しない純データ関数である。
- 指定FrameのClipInstanceをTimeline Y軸順で抽出できる。
- ClipAssetFolderごとにgroup化できる。
- `Uncategorized` groupを扱える。
- Missing Assetをエラーにせず `missingAssets` へ記録できる。
- 戻り値にflat listとgroup listが含まれる。
- 既存Preview、CAPTURE、AUTO、EDIT、UNIQUE、COPY/PASTE、Asset Library操作を壊さない。
- `npm.cmd run build` が成功する。
- `dist/` の差分を成果物に含めない。
- `task-gemini/phase4z14_report.md` を作成する。
- `tegaki_work/PROGRESS.md` を更新する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z14_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加したヘルパー名と戻り値構造。
- Timeline Y軸順をどう維持したか。
- Uncategorizedの扱い。
- Missing Assetの扱い。
- 確認方法。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z14 完了ログを追記する。

最低限、以下を書く。

- Phase 4z14 の目的。
- 変更ファイル。
- 追加したヘルパー。
- ビルド結果。
- 後続Phaseへ残すこと。

