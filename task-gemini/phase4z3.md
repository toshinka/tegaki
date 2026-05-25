# Phase 4z3 — ClipAsset Folder Data Foundation

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z2_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/system/layer-system.js`

## 重要な注意

- 今回は見た目の完成を狙わない。フォルダアイコン、色分け、レイヤーパネル表示、SVG装飾、Clipごとの枠色などは後続。
- `ClipAssetFolder` は通常レイヤーフォルダより上位の概念である。通常の `LayerFolder` と混ぜない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` のテンプレート文字列崩れに注意。大きなHTML組み替えはしない。
- `npm.cmd run build` が失敗した場合、今回触ったファイルに原因を絞る。
- `dist/` は成果物に含めない。

## 背景

Phase 4z2までで、アニメテーブルは `ALL / LANE / SET` の再生対象切替を持った。

一方で、ここまでの暫定UI追加により、これ以上 `AUTO` / `EDIT` / `CAPTURE` / `UNIQUE` / `SET` 周辺を細かく整えると、後でLane独立管理やClipAssetフォルダを入れた時に二重整備が増える気配が強い。

次に必要なのは、UI装飾ではなく、ClipAssetを保管・分類するためのデータ上の置き場所である。

オーナー構想では、将来「犬」「猫」「雲」などのClipAssetを保管庫に保存し、アニメテーブル上へ再利用配置できるようにしたい。

この保管庫のフォルダは、通常レイヤーパネルのフォルダとは次元が違う。

- 通常レイヤーフォルダ: 現在の絵のレイヤーをまとめる。
- ClipAssetフォルダ: 再利用可能なClipAsset素材をまとめる。

Phase 4z3では、この差を明確にしつつ、まず純データモデルだけを作る。

## 目的

`ClipAssetFolderModel` を導入し、`ClipAssetModel` が所属フォルダを参照できるようにする。

目的は以下。

- ClipAssetを保管庫的に分類する足場を作る。
- 将来のAsset Library UI、ClipAssetフォルダ表示、Clip内部レイヤー化へ進む前提を整える。
- 既存Preview、EDIT、AUTO、CAPTURE、UNIQUE、COPY/PASTEを壊さない。

## 今回やること

### 1. ClipAssetFolderModel を追加

`animation-data-model.js` に純データクラスを追加する。

候補:

```js
export class ClipAssetFolderModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'Assets';
        this.parentFolderId = options.parentFolderId || null;
        this.colorTag = options.colorTag || null;
        this.expanded = options.expanded !== false;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            parentFolderId: this.parentFolderId,
            colorTag: this.colorTag,
            expanded: this.expanded,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}
```

注意:

- まだ通常Layerフォルダとは接続しない。
- `parentFolderId` は将来の入れ子用。MVPでは1階層だけでもよいが、データ項目は持ってよい。
- `colorTag` は将来UI用。今回の見た目反映は不要。

### 2. ClipAssetModel に folderId を追加

`ClipAssetModel` に以下を追加する。

```js
this.folderId = options.folderId || null;
```

`serialize()` にも含める。

既存Assetは `folderId: null` でよい。

### 3. TimelineModel に clipAssetFolders を追加

`TimelineModel` constructor で読み込む。

```js
this.clipAssetFolders = (options.clipAssetFolders || []).map(folder => new ClipAssetFolderModel(folder));
```

`serialize()` にも含める。

```js
clipAssetFolders: this.clipAssetFolders.map(folder => folder.serialize())
```

### 4. デフォルトフォルダを作るヘルパー

将来UIで使いやすくするため、`TimelineModel` に小さなヘルパーを追加する。

候補:

```js
getClipAssetFolder(folderId) { ... }

ensureDefaultClipAssetFolder() {
    let folder = this.clipAssetFolders.find(f => f.name === 'Default Assets' && !f.parentFolderId);
    if (!folder) {
        folder = new ClipAssetFolderModel({ name: 'Default Assets' });
        this.clipAssetFolders.push(folder);
    }
    return folder;
}
```

ただし、既存データの全Assetを勝手にDefaultへ移す必要はない。

### 5. 新規ClipAsset作成時の所属

以下の作成経路では、`folderId` を付けられるようにする。

- `createBlankClipAsset(options = {})`
- `makeClipAssetUnique(clipId)`
- `captureSelectedCel()` 内の新規Asset作成フロー

方針:

- `options.folderId` が渡されたら使う。
- 渡されなければ `null` のままでよい。
- 今回は勝手にDefaultフォルダへ入れない。まず互換性を優先する。

例:

```js
const asset = new ClipAssetModel({
    name: options.name || 'Blank Clip',
    type: 'raster',
    drawingSnapshotId: snapshot.id,
    folderId: options.folderId || null
});
```

### 6. フォルダ操作ヘルパー

MVPとして、以下の純データ操作を `TimelineModel` に追加する。

```js
createClipAssetFolder(options = {}) { ... }
renameClipAssetFolder(folderId, name) { ... }
moveClipAssetToFolder(assetId, folderId) { ... }
getClipAssetsInFolder(folderId) { ... }
```

注意:

- `folderId` が存在しない場合は失敗扱いにする。ただし `null` は「未分類」として許可する。
- UIからはまだ呼ばれなくてよい。
- 戻り値は `{ ok: true, ... }` / `{ ok: false, reason: '...' }` の形だと後続で使いやすい。

### 7. 互換性

既存の保存データに `clipAssetFolders` や `folderId` がなくても起動すること。

既存Asset:

- `folderId` は `null`。
- PreviewやCOPY/PASTEやUNIQUEで壊れない。

### 8. 最小UI確認

今回はAsset Library本体を作らない。

ただし、開発確認用に小さな内部メソッドや報告書で以下を確認する。

- `createClipAssetFolder()` でフォルダが作れる。
- `moveClipAssetToFolder()` でAssetの `folderId` が変わる。
- `serialize()` に `clipAssetFolders` と `folderId` が出る。

UIボタンや画面表示は不要。

## 今回やらないこと

- レイヤーパネルへのClipAssetフォルダ表示。
- ClipAssetフォルダアイコンの色分け。
- Clipごとの枠色ループ。
- SVG下の小文字表示。
- Asset Library popup。
- ClipAssetドラッグ移動UI。
- Clip内部レイヤーの実装。
- ClipAssetフォルダの永続的な開閉UI。
- 通常Layerフォルダとの相互変換。
- `AUTO` / `EDIT` / `CAPTURE` / `UNIQUE` の整理。

## 将来UIメモ

今回実装しないが、後続判断用に以下を意識する。

- ClipAssetフォルダは通常フォルダより上位概念なので、通常フォルダと同じ見た目だけだと混乱しやすい。
- 表示候補:
  - フォルダアイコンを一段濃い色にする。
  - アイコン下に小さく `CLIP` または短い記号を入れる。
  - ClipAsset単位で枠色を4色程度ループさせる。
  - Lane/ClipInstance側にはAsset由来の色タグを薄く反映する。
- ただし、これらは修飾であり、まずは `ClipAssetFolderModel` と `folderId` の正本化を優先する。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- 既存アニメテーブルが起動する。
- 既存のPreview、ALL/LANE/SET、ONION、EDIT、AUTO、CAPTURE、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- `TimelineModel.serialize()` に `clipAssetFolders` が含まれる。
- `ClipAssetModel.serialize()` に `folderId` が含まれる。
- 既存データに `clipAssetFolders` / `folderId` がなくても読み込める。
- `createClipAssetFolder()` / `moveClipAssetToFolder()` / `getClipAssetsInFolder()` が純データ操作として成立する。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z3_report.md`

報告書には以下を必ず書く。

- 追加したデータモデル。
- `folderId` の扱い。
- 追加した `TimelineModel` ヘルパー。
- 既存Assetとの互換性。
- 今回あえて作らなかったUI。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z3 完了ログを追記する。

最低限、以下を書く。

- Phase 4z3 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
