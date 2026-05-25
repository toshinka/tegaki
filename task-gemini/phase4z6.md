# Phase 4z6 — ClipAsset Internal Layer Data Foundation

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z5_report.md`
5. `tegaki_work/system/animation/animation-data-model.js`
6. `tegaki_work/ui/animation-table-popup.js`
7. `tegaki_work/system/layer-system.js`

## 重要な注意

- 今回はClipAsset内部レイヤーの「データ基盤」だけを作る。
- Virtual Layer Panel、内部レイヤー編集UI、複数内部レイヤーの描画合成は今回しない。
- 現行Previewは引き続き `drawingSnapshotId` のSnapshot表示を正本にする。
- 背景レイヤーは共有のキャンバス下地であり、ClipAsset内部レイヤーに入れない。
- 通常レイヤーパネルの構造を変更しない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` は肥大化しているため、テンプレート文字列やCSSブロックを崩さない。
- `npm.cmd run build` が失敗した場合、今回触った箇所を優先して確認し、関係ない修正に広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z5で、アニメテーブルを開いた時にFrame 1へ初期ClipAssetを自動Seedできるようになった。

現在のClipAssetは主に `drawingSnapshotId` を持つ1枚ラスターAssetである。

しかし長期方針では、ClipAssetの中に独立した内部レイヤー構造が必要になる。

例:

- 犬ClipAssetの中に、線画Layer、塗りLayer、影Layerがある。
- 猫ClipAssetの中に、別の内部レイヤー構造がある。
- タイムライン上には犬ClipAssetを参照するClipInstanceが複数置かれる。
- ClipInstanceをクリックすると、そのClipAsset内部レイヤーだけを編集する。

Phase 4z6では、描画/編集UIには踏み込まず、ClipAssetが内部レイヤーを持てるデータ構造を正式化する。

## 背景レイヤーの扱い

Tegakiの背景レイヤーは共有のキャンバス下地であり、ClipAsset内部レイヤーには含めない。

理由:

- 透明キャンバスを見やすくするためのツール装置であり、描画物ではない。
- 全Clip共通の下地であり、各Clipの独立した絵ではない。
- 線だけのClipは下のClipが透ける。遮蔽が必要なら各Clip内部の塗りLayerで対応する。

「絵としての背景」は、ユーザーが通常レイヤーで描いたものだけをClipAsset内部レイヤー化する候補にする。

## 目的

`ClipAssetInternalLayerModel` を追加し、`ClipAssetModel.internalLayers` を純データモデルとして扱えるようにする。

目的は以下。

- ClipAssetが将来複数内部レイヤーを持つ前提を固める。
- 初期SeedやCAPTUREで作られたAssetにも、最低1つの内部Layerメタ情報を持たせる。
- Make Unique時に内部Layerを安全に複製できる足場を作る。
- 既存PreviewやSnapshot表示を壊さない。

## 今回やること

### 1. ClipAssetInternalLayerModel を追加

`animation-data-model.js` に純データクラスを追加する。

候補:

```js
export class ClipAssetInternalLayerModel {
    constructor(options = {}) {
        this.id = options.id || createId();
        this.name = options.name || 'Layer';
        this.type = options.type || 'raster'; // 'raster' | 'folder'
        this.visible = options.visible !== false;
        this.opacity = options.opacity ?? 1;
        this.blendMode = options.blendMode || 'normal';
        this.drawingSnapshotId = options.drawingSnapshotId || null;
        this.parentLayerId = options.parentLayerId || null;
        this.isBackground = options.isBackground === true;
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = options.updatedAt || Date.now();
    }

    serialize() { ... }
}
```

注意:

- `isBackground` は通常は false。共有背景は内部Layer化しない。
- `parentLayerId` は将来の内部フォルダ用。今回UIでは使わない。
- `drawingSnapshotId` は、その内部Layerの描画Snapshotを指す。

### 2. ClipAssetModel.internalLayers をモデル化

現在は配列をそのまま保持している。

変更後:

```js
this.internalLayers = (options.internalLayers || []).map(layer => new ClipAssetInternalLayerModel(layer));
```

`serialize()` では `layer.serialize()` を使う。

既存データで `internalLayers` が空なら空配列でよい。

### 3. helper: createInternalLayerForSnapshot

`TimelineModel` に、Snapshotから内部Layerを作る小ヘルパーを追加してよい。

候補:

```js
createClipAssetInternalLayer(options = {}) { ... }
```

ただし、単独リストへ保存する必要はない。
内部LayerはClipAssetの中に持つ。

### 4. createBlankClipAsset の内部Layer

`createBlankClipAsset(options = {})` で作る空Assetに、最低1つの内部Layerを入れる。

候補:

```js
internalLayers: [
    new ClipAssetInternalLayerModel({
        name: options.layerName || 'Layer 1',
        type: 'raster',
        drawingSnapshotId: snapshot.id,
        isBackground: false
    })
]
```

注意:

- 既存Previewは `asset.drawingSnapshotId` を使うため、`drawingSnapshotId` は従来通りAssetにも残す。
- 内部Layerにも同じ `drawingSnapshotId` を持たせる。
- 背景Layerは入れない。

### 5. CAPTURE / Auto-Seed / Make Unique の内部Layer

以下の経路でAssetが作られる/更新される時、内部Layerメタも整える。

- `createBlankClipAsset`
- `_captureSelectedClip` の新規Asset作成
- `_ensureInitialClipAssetSeed`
- `makeClipAssetUnique`

方針:

- Asset新規作成時、`internalLayers` が空なら1つ追加。
- 既存Asset更新時、内部Layerが空なら1つ補完。
- 既存Asset更新時、内部Layerがあるなら最初のraster内部Layerの `drawingSnapshotId` をAssetの `drawingSnapshotId` と同期する程度でよい。
- Make Unique時は内部Layerをディープコピーする。IDは新規発行し、`drawingSnapshotId` は複製後SnapshotのIDへ差し替える。

### 6. データ検証ヘルパー

`TimelineModel` に小さな整合性ヘルパーを追加してもよい。

候補:

```js
ensureClipAssetInternalLayer(assetId, options = {}) { ... }
```

役割:

- Assetが存在するか確認。
- internalLayersが空なら、Assetの `drawingSnapshotId` を使う内部Layerを1つ作る。
- 既にある場合は何もしない、または最初のrasterLayerを返す。

戻り値:

```js
{ ok: true, asset, layer }
{ ok: false, reason: 'asset-not-found' }
```

### 7. Asset Library表示

Asset LibraryのAsset行に、内部Layer数を小さく表示してよい。

例:

```text
Layers: 1
```

ただし、見た目は最小限。

必須ではないが、確認しやすくなるため推奨。

### 8. 互換性

既存Asset:

- `internalLayers` がない、または空でも読み込める。
- Previewは従来通り `drawingSnapshotId` で動く。
- 保存時は `internalLayers` がserializeされる。

## 今回やらないこと

- 内部Layerを実際に合成表示するPreview。
- 内部Layer編集UI。
- レイヤーパネルをClipAsset内部Layerへ切り替える処理。
- 通常Layer複数枚をまとめて1つのClipAsset内部Layer群へ変換する処理。
- ClipAsset内部フォルダUI。
- 背景レイヤーの内部Layer化。
- Asset LibraryでのLayer展開表示。
- Frame 2で前Frameを複製する機能。
- CAPTURE/AUTO/EDITの正式整理。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- `ClipAssetInternalLayerModel` が追加される。
- `ClipAssetModel.internalLayers` がモデル配列として扱われ、serializeされる。
- 新規Blank Assetに内部Layerが1つ作られる。
- 初期Seed Assetに内部Layerが1つ作られる。
- CAPTURE新規Assetに内部Layerが1つ作られる。
- Make Uniqueで内部Layerが参照共有されず複製される。
- 背景レイヤー由来の内部Layerは作られない。
- 既存Preview、ALL/LANE/SET、ONION、EDIT、AUTO、CAPTURE、UNIQUE、COPY/PASTE、D&D移動、Duration変更を壊さない。
- `dist/` の差分を成果物に含めない。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z6_report.md`

報告書には以下を必ず書く。

- 追加した内部Layerモデル。
- 新規Asset作成時のinternalLayers設定。
- CAPTURE / Auto-Seed / Make Uniqueでの扱い。
- 背景レイヤーを内部Layer化しない確認。
- 既存Previewとの互換性。
- 手元確認した操作。
- `npm.cmd run build` の結果。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z6 完了ログを追記する。

最低限、以下を書く。

- Phase 4z6 の目的。
- 変更ファイル。
- ビルド結果。
- 残った課題があれば、後続Phase向けに短く列挙。
