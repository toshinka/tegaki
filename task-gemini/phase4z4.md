# Phase 4z4 — Asset Library Skeleton MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z3_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/core-engine.js`
8. `tegaki_work/system/popup-manager.js`

## 重要な注意

- 今回はAsset Libraryの完成版を作らない。「保管庫が見える」「Assetがどのフォルダにいるか分かる」骨格だけ。
- 見た目の装飾、Clipごとの枠色、SVGアイコン加工、レイヤーパネルへの統合は後続。
- `ClipAssetFolder` は通常レイヤーフォルダとは別概念。通常レイヤーパネルのフォルダUIに混ぜない。
- `AUTO`、`EDIT`、現行 `CAPTURE`、`UNIQUE` の整理は今回しない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` のテンプレート文字列崩れに注意。HTML/CSSを大きく組み替えない。
- `npm.cmd run build` が失敗した場合、今回触ったファイルを優先して確認し、関係ない修正に広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z3で `ClipAssetFolderModel` と `ClipAssetModel.folderId` が入った。

次に必要なのは、Asset Libraryの完成UIではなく、最低限以下を確認できる画面である。

- ClipAssetフォルダ一覧が見える。
- 未分類Assetが見える。
- 各Assetの名前、共有状態、Blank状態が見える。
- 選択中ClipのAssetがどれか分かる。
- 将来、Assetをフォルダへ移動したり、タイムラインへ再配置したりする入口になる。

Phase 4z4では、アニメテーブル内に小さなAsset Libraryパネルを追加する。

## 目的

`AnimationTablePopup` 内で `TimelineModel.clipAssetFolders` / `clipAssets` を読み取り、Asset Libraryの最小一覧を表示する。

目的は以下。

- Phase 4z3の純データが実際に見える状態にする。
- ClipAssetが「保管庫にある素材」であることをUI上で確認できるようにする。
- 後続のAsset移動、フォルダ作成、ClipAsset再利用、Clip内部レイヤー化の足場にする。

## 今回やること

### 1. Asset Library表示の置き場所

MVPでは `animation-table-popup.js` 内に折りたたみ可能な小パネルを置く。

候補:

- アニメテーブルのヘッダー右寄りに `ASSETS` ボタンを追加。
- 押すとテーブル内の右側または下部に小さな `.anim-asset-library` 領域を表示/非表示。

推奨:

- 既存PopupManagerへ新Popupを登録するより、今回はAnimationTablePopup内のサブパネルでよい。
- 理由: Asset Libraryは当面アニメテーブルのモデルを直接見るだけで、独立Popupにすると配線が増える。

### 2. 状態

`AnimationTablePopup` に状態を追加する。

候補:

```js
this.isAssetLibraryVisible = false;
this.selectedAssetId = null;
this.selectedAssetFolderId = null;
```

保存/読み込み対象にしなくてよい。

### 3. 表示内容

Asset Libraryには以下を表示する。

#### フォルダ一覧

- `Uncategorized` 固定行
- `clipAssetFolders` の一覧

表示項目:

- フォルダ名
- フォルダ内Asset数
- 選択中フォルダの強調

#### Asset一覧

選択中フォルダのAssetを表示する。

- `Uncategorized`: `folderId === null`
- 任意フォルダ: `folderId === selectedAssetFolderId`

表示項目:

- Asset名
- `Blank` かどうか
- 共有数
- 選択中Clipが参照しているAssetなら強調

共有数は既存の `countAssetReferences(asset.id)` を使う。

Blank判定は `asset.drawingSnapshotId` から `getDrawingSnapshot()` を引き、`snapshot.isBlank === true` で判断する。

### 4. UI操作

MVPで許可する操作は最小限にする。

必須:

- `ASSETS` ボタンで表示/非表示。
- フォルダ行クリックでAsset一覧を切り替える。
- Asset行クリックで `selectedAssetId` を更新する。

任意:

- 選択中Clipがある時、Asset行クリックでそのAssetへ差し替える操作は今回は入れない。

今回やらない:

- Assetをタイムラインへ追加。
- AssetのD&D。
- Assetのフォルダ移動。
- フォルダ作成/削除/リネームUI。
- Asset名リネームUI。

理由:

- まだUI操作を増やすと二重整備になる。
- まず保管庫の中身を可視化するだけで十分。

### 5. データ取得ヘルパー

`AnimationTablePopup` に小メソッドを追加してよい。

候補:

```js
_getAssetFoldersForLibrary()
_getAssetsForSelectedFolder()
_getAssetSnapshot(asset)
_getAssetStatus(asset)
```

ただし、複雑な抽象化は不要。今回の目的は可視化。

### 6. 表示更新

以下の操作後にAsset Library表示も更新されること。

- 新規セル作成による空Asset生成
- CAPTURE/AUTOでSnapshot更新
- UNIQUEでAsset複製
- COPY/PASTEで共有Asset参照が増える
- Clip削除

既存 `render()` の中でAsset Libraryも再描画する形でよい。

### 7. 見た目

最低限でよい。

推奨:

- `.anim-asset-library` はアニメテーブル内の小さな横長/右側パネル。
- フォルダ列とAsset列の2カラム。
- 文字は小さめ。
- 選択中ClipのAssetには `current` クラス。
- 選択中Assetには `selected` クラス。

色やアイコンは仮でよい。

禁止:

- 通常レイヤーパネルと同じフォルダアイコンを無理に流用しない。
- インラインstyle大量追加をしない。

## 今回やらないこと

- ClipAssetフォルダの見た目完成。
- ClipAssetフォルダをレイヤーパネルへ表示。
- 通常Layerフォルダとの連携。
- AssetのD&D移動。
- Assetをタイムラインへ配置する操作。
- Assetのリネーム/削除。
- フォルダ作成/リネーム/削除UI。
- Clip内部レイヤー。
- Assetサムネイル生成。
- `CAPTURE` / `AUTO` / `EDIT` / `UNIQUE` の正式整理。

## 将来メモ

Asset Libraryの見た目候補:

- ClipAssetフォルダは通常フォルダより一段濃い色。
- `CLIP` の小ラベルや小アイコンを付ける。
- Assetごとに4色程度の枠色をループさせる。
- タイムライン上のClipInstanceにもAsset由来の色タグを薄く反映する。

ただし、今回は一切決め切らない。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- アニメテーブルに `ASSETS` ボタンが出る。
- `ASSETS` ボタンでAsset Library骨格を表示/非表示できる。
- `Uncategorized` と `clipAssetFolders` が表示される。
- 選択フォルダ内のAsset一覧が表示される。
- Assetごとに名前、Blank状態、共有数が分かる。
- 選択中Clipが参照しているAssetが強調される。
- Asset行クリックで `selectedAssetId` が変わり、表示上も選択状態が分かる。
- 既存のPreview、ALL/LANE/SET、ONION、EDIT、AUTO、CAPTURE、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z4_report.md`

報告書には以下を必ず書く。

- Asset Libraryの表示場所。
- 表示しているフォルダ/Asset情報。
- 選択中ClipのAsset強調方法。
- 今回あえて実装しなかった操作。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z4 完了ログを追記する。

最低限、以下を書く。

- Phase 4z4 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
