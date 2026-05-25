# Phase 4z7 — ClipAsset Internal Layer Inspector Skeleton

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z6.md`
5. `task-gemini/phase4z6_report.md`
6. `tegaki_work/system/animation/animation-data-model.js`
7. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回はClipAsset内部Layerの「見える化」だけを行う。
- 内部Layerの追加、削除、リネーム、表示切替、不透明度変更、描画合成は今回しない。
- Virtual Layer Panelは今回しない。
- 通常レイヤーパネルの構造を変更しない。
- 現行Previewは引き続き `ClipAsset.drawingSnapshotId` / `TimelineModel.getSnapshotForCel()` を正本にする。
- 背景レイヤーは共有キャンバス下地であり、ClipAsset内部Layerとして扱わない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` は肥大化しているため、テンプレート文字列とCSS注入ブロックを崩さない。
- `npm.cmd run build` が失敗した場合、今回触った箇所を優先して確認し、関係ない修正に広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z6で、ClipAssetが内部Layerを持つ純データ基盤が入った。

ただし現状では、内部LayerはAsset Libraryの `L:n` 表示以外ではほぼ見えない。次にVirtual Layer PanelやClip内部編集へ進む前に、選択中Assetの内部Layer構造をUI上で確認できる最小のInspectorを用意する。

このPhaseは、内部Layerを編集するためではなく、データが正しく作られ、選択中Clip/Assetと対応していることを安全に確認するための足場である。

## 目的

Asset Library内に、選択中ClipAssetの内部Layer一覧を表示するInspectorを追加する。

目的は以下。

- 選択中Clipが参照しているAssetの内部Layerを確認できる。
- 内部Layer数、名前、種別、表示状態、不透明度、合成モード、Snapshot有無を確認できる。
- 内部Layerをクリックして「選択状態」にできる。
- ただし、選択はUI上の状態管理だけに留め、描画や通常レイヤーパネルには影響させない。

## 今回やること

### 1. 選択状態を追加

`AnimationTablePopup` に内部Layer選択状態を追加する。

候補:

```js
this.selectedInternalLayerId = null;
```

AssetやClip選択が変わった時、存在しない内部Layer IDを保持し続けないようにする。

### 2. selected Asset の解決ヘルパー

Asset Library表示用に、選択中Assetを解決する小ヘルパーを追加してよい。

候補:

```js
_getSelectedAssetForInspector()
```

優先順:

1. 選択中Clipの `assetId`
2. Asset Library内で最後にクリックしたAsset
3. なし

既に同等の状態やヘルパーがある場合はそれを使う。

### 3. Asset LibraryにInternal Layers領域を追加

`ASSETS` パネル内に、選択中Assetの内部Layer一覧を表示する。

表示例:

```text
INTERNAL LAYERS
Layer 1      raster   visible   100%   normal   snapshot
```

最低限表示したい情報:

- Layer名
- type (`raster` / `folder`)
- visible状態
- opacity
- blendMode
- drawingSnapshotIdの有無
- blank Snapshotかどうかが簡単に分かる表示

UI文言は英語でよい。既存のアニメテーブルUIに合わせる。

### 4. 内部Layerクリックで選択

内部Layer行をクリックすると `selectedInternalLayerId` を更新し、その行を強調表示する。

この選択は今回、以下へ影響させない。

- キャンバスPreview
- EDIT/AUTO/CAPTURE
- 通常レイヤーパネル
- 再生範囲

純粋に「今どの内部Layerを見ているか」のUI状態だけにする。

### 5. 内部Layer補完

Inspector表示時、選択中Assetに `internalLayers` が空なら `ensureClipAssetInternalLayer()` で補完してよい。

ただし、補完は最小限に留める。

- Assetの `drawingSnapshotId` を持つ raster Layerを1つ作る。
- 背景Layerは作らない。
- 既に内部Layerがある場合は勝手に増やさない。

### 6. CSSはクラス管理

インラインstyleを増やさない。

必要な見た目は、既存のCSS注入ブロックまたは既存方針に沿ったクラスで管理する。

候補クラス:

- `.anim-internal-layer-inspector`
- `.anim-internal-layer-list`
- `.anim-internal-layer-row`
- `.anim-internal-layer-row.is-selected`
- `.anim-internal-layer-meta`

## 今回やらないこと

- 内部Layerの追加/削除/リネーム。
- visible/opacity/blendModeの編集。
- 内部Layerごとの描画Snapshot差し替え。
- 内部Layerを合成してPreview表示する処理。
- ClipAsset内部Layerを通常レイヤーパネルに表示する処理。
- Clipをクリックした時に通常レイヤーパネルをClip内部へ切り替える処理。
- CAPTURE/AUTO/EDITの名称整理。
- Asset Libraryの本格的なD&Dやフォルダ操作UI。

## 受け入れ条件

- `ASSETS` パネルを開くと、選択中Clip/Assetの内部Layer一覧が見える。
- Blank ClipAsset、新規CAPTURE済みAsset、Auto-Seed Asset、Make Unique後Assetで、最低1つの内部Layerが表示される。
- 内部Layer行をクリックすると選択表示が付く。
- 内部Layer選択によって、Preview、EDIT、AUTO、CAPTURE、通常レイヤーパネルの挙動が変わらない。
- 背景レイヤーが内部Layerとして表示されない。
- `npm.cmd run build` が成功する。
- 作業後に `task-gemini/phase4z7_report.md` を作成し、`tegaki_work/PROGRESS.md` を更新する。

## 報告に含めること

- 変更ファイル一覧。
- Inspectorで表示している項目。
- 内部Layer選択が影響しない範囲。
- 既存Assetで `internalLayers` が空だった場合の補完方針。
- ビルド結果。
