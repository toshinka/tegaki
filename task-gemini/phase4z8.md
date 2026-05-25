# Phase 4z8 — ClipAsset Internal Layer CRUD MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z6.md`
5. `task-gemini/phase4z7.md`
6. `task-gemini/phase4z7_report.md`
7. `tegaki_work/system/animation/animation-data-model.js`
8. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回はClipAsset内部Layerの最小CRUDだけを行う。
- 内部Layerを合成してPreview表示する処理は今回しない。
- Virtual Layer Panelは今回しない。
- 通常レイヤーパネルの構造を変更しない。
- 現行Previewは引き続き `ClipAsset.drawingSnapshotId` / `TimelineModel.getSnapshotForCel()` を正本にする。
- 背景レイヤーは共有キャンバス下地であり、ClipAsset内部Layerとして扱わない。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `animation-table-popup.js` は肥大化しているため、テンプレート文字列とCSS注入ブロックを崩さない。
- `npm.cmd run build` が失敗した場合、今回触った箇所を優先して確認し、関係ない修正に広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z7で、Asset Library内にClipAsset内部Layer Inspectorが入った。

次に必要なのは、ClipAsset内部に複数Layerを持てることをUIから安全に確認するための最小操作である。

ただし、ここで描画経路まで切り替えると大きな改修になる。今回は内部Layerの「データ操作」と「Inspector上の見た目」だけを整える。

## 目的

選択中ClipAssetの内部Layerを、Asset Library内のInspectorで追加・削除・リネーム・表示切替できるようにする。

目的は以下。

- ClipAssetが複数内部Layerを持てることを実操作で確認する。
- 内部Layerの基本メタ情報を保存/復元できる形にする。
- Virtual Layer Panelへ進む前に、内部Layerデータの破綻を減らす。
- 現行Preview/EDIT/AUTO/CAPTUREを壊さない。

## 今回やること

### 1. TimelineModelに内部Layer操作ヘルパーを追加

`animation-data-model.js` に、ClipAsset内部Layerを操作する純データヘルパーを追加する。

候補:

```js
addClipAssetInternalLayer(assetId, options = {}) { ... }
renameClipAssetInternalLayer(assetId, layerId, name) { ... }
removeClipAssetInternalLayer(assetId, layerId) { ... }
toggleClipAssetInternalLayerVisibility(assetId, layerId) { ... }
```

戻り値は既存ヘルパーに合わせて、失敗理由を返せる形が望ましい。

例:

```js
{ ok: true, asset, layer }
{ ok: false, reason: 'asset-not-found' }
```

### 2. 削除ガード

内部Layerが1枚しかないAssetでは削除を禁止する。

理由:

- ClipAssetが空のLayer配列になると、Inspector/後続編集の前提が崩れる。
- 最低1枚のraster内部Layerを持つ設計に寄せる。

戻り値例:

```js
{ ok: false, reason: 'last-layer' }
```

### 3. 新規内部Layer作成

Inspector上の `+` ボタンなどから、選択中Assetへ新しいraster内部Layerを追加できるようにする。

方針:

- 名前は `Layer 2`、`Layer 3` のような自動名でよい。
- `drawingSnapshotId` は当面 `null` でよい。
- 背景Layerは作らない。
- 追加後、そのLayerを `selectedInternalLayerId` にする。

### 4. 内部Layerリネーム

最小UIでよい。

候補:

- ダブルクリックで `prompt()` を使う。
- または小さなRenameボタンで `prompt()` を使う。

今回はMVPなので、凝ったインライン編集は不要。

注意:

- 空名は拒否する。
- 前後空白はtrimする。
- HTML表示では必ずescapeする。

### 5. visible切替

内部Layer行に小さな表示ボタンを置き、`visible` を切り替える。

ただし今回、Previewには反映しない。

理由:

- 現行PreviewはAsset本体の `drawingSnapshotId` を正本にしているため。
- 内部Layer合成Previewは後続Phaseで扱う。

UI上では visible/hidden 表示だけ更新する。

### 6. 内部Layer削除

内部Layer行に小さな削除ボタンを置く。

注意:

- 最後の1枚は削除不可。
- 選択中Layerを削除した場合は、近いLayerか先頭Layerを選択する。
- `drawingSnapshotId` があるLayerを削除しても、今回はDrawingSnapshot本体は削除しない。参照整理/GCは後続扱い。

### 7. UIはInspector内に閉じる

操作UIはAsset LibraryのInternal Layers Inspector内に限定する。

通常レイヤーパネルやアニメテーブル本体のClip操作には影響させない。

候補:

- Inspectorヘッダーに `+` ボタン
- Layer行に `eye` / `rename` / `delete` 相当の小ボタン

既存UIと合う最小表示でよい。

## 今回やらないこと

- 内部Layerへの実描画。
- 内部LayerごとのSnapshot作成/差し替え。
- 内部Layerを合成したPreview。
- Virtual Layer Panel。
- 通常レイヤーパネルをClipAsset内部Layerへ切り替える処理。
- 内部LayerのD&D並び替え。
- 内部Layerフォルダ。
- DrawingSnapshotの参照カウント/GC。
- CAPTURE/AUTO/EDITの名称整理や正式再設計。

## 受け入れ条件

- Asset LibraryのInternal Layers Inspectorで、内部Layerを追加できる。
- 内部Layer名を変更でき、空名は拒否される。
- 内部Layerのvisibleを切り替えられ、Inspector表示に反映される。
- 内部Layerを削除できる。ただし最後の1枚は削除できない。
- 操作後も `selectedInternalLayerId` が存在するLayerを指す、または安全にクリア/再選択される。
- Preview、EDIT、AUTO、CAPTURE、通常レイヤーパネルの挙動は変わらない。
- 保存/シリアライズ上、内部Layerの追加・名前・visible変更が保持される。
- `npm.cmd run build` が成功する。
- 作業後に `task-gemini/phase4z8_report.md` を作成し、`tegaki_work/PROGRESS.md` を更新する。

## 報告に含めること

- 変更ファイル一覧。
- 追加したモデルヘルパー一覧。
- Inspector上で追加した操作。
- 最後のLayer削除ガードの挙動。
- Preview等へ影響させていない範囲。
- ビルド結果。
