# Phase 4z — Blank Clip Asset on Cel Create MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4w_report.md`
5. `task-gemini/phase4x_report.md`
6. `task-gemini/phase4y_report.md`
7. `tegaki_work/system/animation/animation-data-model.js`
8. `tegaki_work/ui/animation-table-popup.js`
9. `tegaki_work/system/layer-system.js`

## 背景

Phase 4w で `AUTO`、Phase 4x で `EDIT`、Phase 4y で `UNIQUE` が入った。

しかし、現状の新規セルはクリックした時点では `assetId` を持たない場合がある。

この状態だと、以下が起きやすい。

- UNIQUE が無効。
- 共有/独立の概念が見えにくい。
- EDIT + AUTO の最初の描画で初めてAssetが作られるため、内部状態が少し遅れて成立する。
- 将来のAsset LibraryやClip内部編集へ進む時に「Asset未作成セル」の扱いが増える。

Phase 4zでは、新規セル作成時に空の `DrawingSnapshot` / `ClipAsset` を自動で作る。

## 目的

セルを置いた時点で、そのセルが編集対象としての空Assetを持つようにする。

目的は以下。

- 新規セル作成直後から `assetId` がある状態にする。
- EDIT / AUTO / UNIQUE の前提を単純にする。
- Asset Library / Clip内部レイヤー化へ向けて、ClipInstanceは必ずClipAssetを参照する方向へ寄せる。

## 基本仕様

- 空スロットをクリックして新規セルを作った時、同時に空Assetを作る。
- Pasteで新規セルを作る場合は、既存どおりコピー元Assetを参照する。空Assetは作らない。
- MoveではAssetを変更しない。
- CAPTURE / AUTOは、既存AssetのDrawingSnapshotを更新する。
- 空AssetのSnapshotは透明ピクセルでよい。
- Snapshotサイズはキャンバスサイズに合わせる。
- Previewでは透明なので見た目は変わらない。
- Snapshotマークは「Assetがある」だけで出すか、「非空描画がある」時だけ出すかを整理する。

## 重要な表示方針

現状の小白丸 `.anim-snapshot-icon` は「Snapshotあり」の印。

Phase 4zで空AssetにもSnapshotが付くと、全セルに白丸が出て「描画済み」と誤解しやすい。

そのため、以下のどちらかにする。

推奨:

- 空Assetには `isBlank: true` 相当の情報を持たせる。
- `.anim-snapshot-icon` は `!isBlank` の時だけ表示する。

簡易案:

- `DrawingSnapshotModel` に `isBlank` を追加する。
- `serialize()` に `isBlank` を含める。
- CAPTURE / AUTOで描画内容を入れたら `isBlank = false` にする。
- Blank作成時は `isBlank = true`。

## 実装方針

### 1. DrawingSnapshotModelにisBlankを追加

`animation-data-model.js`:

```js
this.isBlank = options.isBlank === true;
```

`serialize()` にも含める。

既存Snapshotは `options.isBlank` がないため false 扱いでよい。

### 2. TimelineModelに空Asset作成ヘルパーを追加

候補:

```js
createBlankClipAsset(options = {}) {
    const width = options.width || 1;
    const height = options.height || 1;
    const pixelCount = width * height * 4;
    const pixels = new Uint8ClampedArray(pixelCount);

    const snapshot = new DrawingSnapshotModel({
        width,
        height,
        pixels,
        isBlank: true
    });
    this.drawingSnapshots.push(snapshot);

    const asset = new ClipAssetModel({
        name: options.name || 'Blank Clip',
        type: 'raster',
        drawingSnapshotId: snapshot.id
    });
    this.clipAssets.push(asset);

    return { asset, snapshot };
}
```

### 3. TimelineModelにセル作成ヘルパーを追加してもよい

UI側で `track.addCel()` とAsset作成を散らさないため、余力があれば以下を作る。

```js
addBlankClipToLane(laneId, startFrame, options = {})
```

ただし既存 `LaneModel.addCel()` を大きく変えないこと。

MVPでは `AnimationTablePopup` 側で `this.model.createBlankClipAsset()` を呼び、その `asset.id` を `track.addCel()` に渡してよい。

### 4. キャンバスサイズの取得

空Snapshotサイズはキャンバスサイズに合わせる。

候補順:

1. `this.layerSystem.canvasWidth` / `canvasHeight`
2. `this.layerSystem.getCanvasSize()` があれば使う。
3. 背景レイヤーや任意レイヤーの `layerData.width` / `height`
4. 最後のfallbackは `1 x 1`

既存実装を `rg` で確認し、推測で未知APIを呼ばない。

`AnimationTablePopup` に小メソッドを作る候補:

```js
_getCanvasSnapshotSize() {
    return {
        width: this.layerSystem?.canvasWidth || 1,
        height: this.layerSystem?.canvasHeight || 1
    };
}
```

### 5. 新規セル作成時の接続

対象箇所:

- 空スロットクリックで `track.addCel(...)` している箇所。

変更方針:

1. 空Assetを作る。
2. `track.addCel()` に `assetId` と `rasterSnapshot` を渡す。
3. 作成した新規セルを選択する。

例:

```js
const { width, height } = this._getCanvasSnapshotSize();
const blank = this.model.createBlankClipAsset({
    width,
    height,
    name: `${track.name} blank`
});
const newCel = track.addCel({
    sourceLayerId: track.sourceLayerId,
    layerId: track.layerId,
    assetId: blank.asset.id,
    rasterSnapshot: {
        width: blank.snapshot.width,
        height: blank.snapshot.height,
        pixels: new Uint8ClampedArray(blank.snapshot.pixels)
    },
    startFrame: frameIndex,
    duration: 1
});
```

注意:

- `track.addCel()` が失敗した場合、先に作ったAsset/Snapshotが孤立する。
- それを避けるため、先に `track.canPlaceCel(frameIndex, 1)` を確認してから空Assetを作る。

### 6. CAPTURE / AUTO時にisBlankをfalseへ

既存Snapshot更新時:

```js
snapshot.isBlank = false;
```

新規Snapshot作成時:

```js
isBlank: false
```

Make Unique時:

- 元Snapshotが `isBlank` なら複製先も `isBlank: true`。
- 元Snapshotが非Blankなら `false`。

### 7. Snapshotアイコン表示

現在:

```js
const hasSnapshot = cel && !!this.model.getSnapshotForCel(cel);
```

変更候補:

```js
const snapshot = cel ? this.model.getSnapshotForCel(cel) : null;
const hasSnapshot = !!snapshot && snapshot.isBlank !== true;
```

これにより、空Assetだけでは白丸を出さない。

### 8. UNIQUEボタンの扱い

空Assetがある新規セルでも `UNIQUE` は押せるようになる。

ただし共有されていない空AssetをUNIQUEしても意味が薄い。

MVPでは以下のどちらでもよい。

推奨:

- `UNIQUE` は `assetId` があり、かつ `isAssetShared(assetId)` の時だけ有効。

理由:

- 共有されていないClipをUNIQUEしても無駄なAssetが増える。

## このPhaseでやらないこと

- Asset Library UI。
- ClipAssetフォルダ。
- Lane独自作成/削除UI。
- Clip内部レイヤー構造。
- Blank Clipのサムネイル生成。
- Blank/NonBlankの高度な差分検出。
- Undo/Redo統合。
- 複数Clip一括処理。
- D&Dペン操作改善。

## 注意点

- 空Asset作成前に `canPlaceCel()` を確認し、孤立Assetを作らない。
- 透明ピクセル配列はキャンバスサイズ次第で大きい。必要以上に何度も作らない。
- `pixels` は参照共有しない。
- Paste/Copy/Moveの既存Asset参照を壊さない。
- Snapshotアイコンが全Blankセルに出ないようにする。
- `console.log` を残さない。
- `dist/` は作業対象にしない。

## 動作確認

最低限以下を確認する。

1. `npm.cmd run build` が成功する。
2. 空スロットクリックで新規セルが作成され、内部的に `assetId` を持つ。
3. 新規セルは透明なのでPreview表示は変わらない。
4. 空Assetだけのセルには描画済み白丸が出ない。
5. EDIT + AUTOで描画すると、そのセルのSnapshotが更新され、白丸が出る。
6. CAPTUREでも `isBlank` が false になる。
7. COPY/PASTEは従来通り同じAsset参照を共有する。
8. UNIQUEは共有Assetの時だけ有効、または少なくとも不要な破壊をしない。
9. Move / duration / Delete / PREVIEW / ONION / EDIT / AUTO が壊れていない。

## 完了条件

- [ ] `DrawingSnapshotModel.isBlank` がある。
- [ ] 空Asset作成ヘルパーがある。
- [ ] 新規セル作成時に空Assetが紐付く。
- [ ] CAPTURE / AUTOで `isBlank` が false になる。
- [ ] Make Uniqueで `isBlank` が維持される。
- [ ] 空Assetだけのセルに描画済みSnapshotアイコンが出ない。
- [ ] `npm.cmd run build` が成功する。
- [ ] `task-gemini/phase4z_report.md` を作成し、Blank Asset仕様、制限、次に必要なAsset Library/Clip内部レイヤーを書く。
- [ ] `tegaki_work/PROGRESS.md` を更新する。
