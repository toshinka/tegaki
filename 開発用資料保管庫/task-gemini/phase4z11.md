# Phase 4z11 — ClipAsset Folder UI MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z3.md`
7. `task-gemini/phase4z3_report.md`
8. `task-gemini/phase4z6.md`
9. `task-gemini/phase4z10.md`
10. `task-gemini/phase4z10_report.md`
11. `tegaki_work/system/animation/animation-data-model.js`
12. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回は **ClipAssetFolderをAsset Library上で使えるようにする最小UI** だけを作る。
- 通常レイヤーフォルダとClipAssetFolderを混同しない。
- LaneはまだLayerSystemの実レイヤーに対応した暫定足場であり、今回Lane構造は変更しない。
- Virtual Layer Panel、内部Layerへの実描画、Lane独立管理、ClipAssetをタイムラインへドラッグ配置、Asset/Folder D&Dは今回しない。
- `animation-table-popup.js` は肥大化している。DOM/CSSの大規模置換やテンプレート文字列の丸ごと再構成は禁止。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `npm.cmd run build` が失敗した場合、今回触ったAsset Library / ClipAssetFolder UI周辺を優先して確認し、関係ないファイルへ修正を広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z3で `ClipAssetFolderModel`、`ClipAssetModel.folderId`、`TimelineModel.clipAssetFolders`、フォルダ操作ヘルパーは入っている。

現在あるもの:

- `ClipAssetFolderModel`
- `TimelineModel.createClipAssetFolder()`
- `TimelineModel.renameClipAssetFolder()`
- `TimelineModel.moveClipAssetToFolder()`
- `TimelineModel.getClipAssetsInFolder()`
- Asset Library左列のフォルダ表示
- Asset Library中央列のフォルダ別Asset表示

しかし、ユーザー体験としてはまだ「ClipAssetFolderがある」と言いにくい。

不足していること:

- Asset Library上でフォルダを新規作成できない。
- フォルダ名を変更できない。
- 選択Assetを別フォルダへ移動できない。
- ClipAssetFolderが「通常レイヤーフォルダとは別の保管庫」であることがUI上で見えにくい。

長期方針では、通常レイヤー/通常フォルダをLaneへ直接置き続けるのではなく、ClipAssetFolder内のClipAsset/内部Layerを時間軸に配置する方向へ進む。

例:

- `犬` フォルダ
  - `走る犬` ClipAsset
  - `座る犬` ClipAsset
  - 各ClipAsset内部に、線画/塗り/影Layer
- `猫` フォルダ
  - `歩く猫` ClipAsset

今回のPhaseは、この2次元マトリクス設計へ進むための「保管庫UIの最小操作」を整える。

## 目的

Asset Library内でClipAssetFolderを作成・リネームし、ClipAssetをフォルダ間で移動できるようにする。

目的は以下。

- ClipAssetFolderが実際にユーザー操作で増やせる。
- フォルダ名を整理できる。
- Assetをフォルダへ移動できる。
- `Uncategorized` と任意フォルダの表示切替が実用的になる。
- ClipAssetFolderは通常レイヤーフォルダと別概念であることを、実装上もUI文言上も保つ。

## 今回やること

### 1. Asset LibraryのFolder列に最小操作を追加

`animation-table-popup.js` の Asset Library 表示に、フォルダ操作ボタンを追加する。

候補:

- FOLDERS見出し右側に `+` ボタン。
- 選択中フォルダに対して `✎` ボタン。

最小でよい。

操作:

- `+`: `prompt()` でフォルダ名を入力し、`TimelineModel.createClipAssetFolder({ name })` を呼ぶ。
- `✎`: 選択中フォルダを `prompt()` でリネームし、`renameClipAssetFolder()` を呼ぶ。

注意:

- `Uncategorized` は実フォルダではないため、リネーム不可。
- 空名は拒否する。
- HTML表示は必ずescapeする。
- インラインstyleを増やさず、既存CSS注入ブロック内のクラスで管理する。

候補メソッド:

```js
createAssetFolder()
renameSelectedAssetFolder()
```

### 2. 選択Assetをフォルダへ移動する最小UI

Asset LibraryのAsset列に、選択Assetを別フォルダへ移動できる操作を追加する。

候補:

- Asset行に小さな `MOVE` ボタン。
- またはASSETS見出し右側に `MOVE` ボタンを置き、現在選択中Assetを対象にする。

MVPでは `prompt()` または `select` 相当の簡易UIでよい。

推奨:

- `MOVE` ボタンを押す。
- 移動先候補を番号付きで `prompt()` に表示する。
- `0` は `Uncategorized`。
- `1..n` は `clipAssetFolders` の順。
- 入力された番号を検証し、`moveClipAssetToFolder(assetId, folderId)` を呼ぶ。

注意:

- 選択Assetがない場合は何もしない、または短い `alert()` で知らせる。
- 存在しない番号は拒否する。
- 移動後は移動先フォルダを選択して、そのAssetが見える状態にしてよい。
- Assetの `folderId` だけを変える。ClipInstanceの参照や内部Layerは触らない。

候補メソッド:

```js
moveSelectedAssetToFolder()
```

### 3. フォルダごとのAsset数表示

Folder行に、そのフォルダ内のAsset数を小さく表示する。

例:

```text
Uncategorized  3
Dog            2
Cat            1
```

注意:

- 表示だけ。集計は `getClipAssetsInFolder(folderId).length` でよい。
- 見た目は既存のAsset metaに合わせ、過剰に装飾しない。

### 4. selectedAssetId / selectedAssetFolderId の整合

フォルダ切替やAsset移動後に、存在しないAsset選択が残らないようにする。

方針:

- フォルダを切り替えた時、そのフォルダに `selectedAssetId` が存在しないなら、`selectedAssetId` と `selectedInternalLayerId` をクリアする。
- Asset移動後は、移動先フォルダを選択し、移動したAssetを `selectedAssetId` にする。
- 選択中Clipが参照するAsset表示は、既存の優先順位を壊さない。

### 5. UI文言で概念を分ける

大きな説明文は不要だが、ツールチップや見出しで通常レイヤーフォルダと混同しにくくする。

候補:

- 見出しは `ASSET FOLDERS` に変更してよい。
- `Uncategorized` はそのままでもよい。
- ボタンtitleに `Create asset folder` / `Rename asset folder` / `Move asset to folder` を入れる。

## 今回やらないこと

- ClipAssetFolderのD&D並び替え。
- Assetをドラッグでフォルダへ移動する処理。
- フォルダ削除。
- 階層フォルダUI。
- フォルダ色タグ編集UI。
- ClipAssetをフォルダからTimelineへ配置する処理。
- Laneを通常Layer依存から切り離す処理。
- Virtual Layer Panel。
- 内部Layerへの直接描画。
- 通常レイヤー/通常フォルダをClipAssetFolderへ一括変換する処理。
- 保存/ロード/Export形式の本格見直し。
- CAPTURE/AUTO/EDITの名称整理。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- Asset LibraryでAsset Folderを作成できる。
- 作成したFolderが左列に表示される。
- `Uncategorized` はリネーム不可。
- 作成したFolderはリネームでき、空名は拒否される。
- Assetを任意Folderへ移動できる。
- 移動後、Folder切替でAsset表示が正しく変わる。
- Folder行にAsset数が表示される。
- フォルダ切替やAsset移動後に、存在しない `selectedAssetId` / `selectedInternalLayerId` が残らない。
- ClipInstanceの `assetId` 参照、内部Layer、Preview、ONION、ALL/LANE/SET Scope、CAPTURE、UNIQUE、COPY/PASTEの既存挙動を壊さない。
- 通常レイヤーフォルダやレイヤーパネル構造を変更しない。
- `dist/` の差分を成果物に含めない。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アニメテーブルを開く。
3. `ASSETS` を開く。
4. `ASSET FOLDERS` で新規フォルダを作成する。
5. 作成フォルダをリネームする。
6. `Uncategorized` のリネームができないことを確認する。
7. Assetを新規フォルダへ移動する。
8. `Uncategorized` と新規フォルダを切り替え、Asset表示と件数が合うことを確認する。
9. 移動したAssetを選択して、Internal Layers InspectorとPreviewが壊れないことを確認する。
10. PREVIEW / ONION / SCOPE: ALL / LANE / SET の主要操作でConsoleエラーがないことを確認する。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z11_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加したAsset Folder UI。
- Asset移動UIの操作方法。
- `selectedAssetId` / `selectedInternalLayerId` の整合方針。
- ClipAssetFolderと通常レイヤーフォルダを混同しないための扱い。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z11 完了ログを追記する。

最低限、以下を書く。

- Phase 4z11 の目的。
- 変更ファイル。
- ビルド結果。
- Asset Folderでできるようになったこと。
- 後続Phaseへ残すこと。

