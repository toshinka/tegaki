# Phase 4z9 — ClipAsset Internal Layer Order MVP

## 最初に読むこと

作業前に必ず以下を読む。

1. `TEGAKI.md`
2. `tegaki_work/PROGRESS.md`
3. `task-gemini/phase4n_preview_scope_note.md`
4. `task-gemini/phase4z6.md`
5. `task-gemini/phase4z7.md`
6. `task-gemini/phase4z8.md`
7. `task-gemini/phase4z8_report.md`
8. `tegaki_work/system/animation/animation-data-model.js`
9. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回はClipAsset内部Layerの「順序管理」だけを行う。
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

Phase 4z8で、ClipAsset内部Layerの追加・削除・リネーム・visible切替ができるようになった。

次に必要なのは、内部Layerの重なり順を正本データとして扱えるようにすること。後続の内部Layer合成PreviewやVirtual Layer Panelでは、この配列順が描画順・表示順の基準になる。

今回は描画合成には踏み込まず、Inspector内で内部Layerを上下に移動できる最小UIとモデルヘルパーを作る。

## 目的

選択中ClipAssetの内部Layer順序を、Asset Library内のInspectorから安全に変更できるようにする。

目的は以下。

- `ClipAssetModel.internalLayers` の配列順をユーザー操作で変更できる。
- 内部Layerの重なり順の正本をデータ上で固める。
- 保存/シリアライズ時に順序が保持される。
- 後続の内部Layer合成Preview、Virtual Layer Panel、内部Layer D&Dへつなげる。

## 今回やること

### 1. TimelineModelに順序操作ヘルパーを追加

`animation-data-model.js` に、内部Layerの順序を変更する純データヘルパーを追加する。

候補:

```js
moveClipAssetInternalLayer(assetId, layerId, direction) { ... }
moveClipAssetInternalLayerToIndex(assetId, layerId, targetIndex) { ... }
```

最低限、上下1つずつ移動できればよい。

戻り値例:

```js
{ ok: true, asset, layer, index }
{ ok: false, reason: 'asset-not-found' }
{ ok: false, reason: 'layer-not-found' }
{ ok: false, reason: 'out-of-range' }
```

### 2. 上下移動UI

Internal Layers Inspectorの各Layer行に、上/下ボタンを追加する。

候補:

- `▲` / `▼`
- `↑` / `↓`

注意:

- 先頭Layerの上ボタンは無効、または押しても何もしない。
- 最後Layerの下ボタンは無効、または押しても何もしない。
- ボタンは小さく、既存の `eye` / `rename` / `delete` と並べる。
- インラインstyleは使わず、クラスで制御する。

### 3. 移動後の選択維持

Layerを上下移動しても、同じ `selectedInternalLayerId` を維持する。

移動後にInspectorを再描画し、選択ハイライトが移動後の行に残ること。

### 4. 表示順と将来の描画順メモ

Inspector上の表示順は `internalLayers` 配列順と一致させる。

将来の合成Previewでは、この順序を「下から上」または「上から下」のどちらで解釈するかを決める必要がある。今回は実装しないが、報告書に現在の表示順の解釈案を書いておく。

推奨:

- 配列の先頭を下、末尾を上として扱う。
- Inspector表示は上から順に、上位Layerが上に見えるほうがユーザー感覚に近い可能性がある。

ただし、今回コードで合成解釈を固定しない。報告書に「未確定」として残す。

### 5. D&Dは今回しない

D&Dはレイヤーパネル側の課題もあり、ここで急いで入れると二重整備になりやすい。

今回は上下ボタンで十分。

## 今回やらないこと

- 内部LayerのD&D並び替え。
- 内部Layerを合成したPreview。
- 内部Layerへの実描画。
- Virtual Layer Panel。
- 通常レイヤーパネルをClipAsset内部Layerへ切り替える処理。
- 内部Layerフォルダ。
- blendMode/opacityの編集UI。
- DrawingSnapshotの参照カウント/GC。
- CAPTURE/AUTO/EDITの名称整理や正式再設計。

## 受け入れ条件

- Internal Layers Inspectorで、内部Layerを上/下へ移動できる。
- 先頭Layerを上へ、最後Layerを下へ移動しても壊れない。
- 移動後も同じ内部Layerが選択されたままになる。
- `ClipAssetModel.internalLayers` の配列順が実際に変わる。
- 保存/シリアライズで順序が保持される。
- Preview、EDIT、AUTO、CAPTURE、通常レイヤーパネルの挙動は変わらない。
- `npm.cmd run build` が成功する。
- 作業後に `task-gemini/phase4z9_report.md` を作成し、`tegaki_work/PROGRESS.md` を更新する。

## 報告に含めること

- 変更ファイル一覧。
- 追加した順序操作ヘルパー。
- Inspector上で追加した操作。
- 境界条件（先頭/末尾）の扱い。
- 移動後の選択維持の確認。
- 将来の内部Layer合成時に、配列順をどう解釈するのがよさそうかの短い所感。
- ビルド結果。
