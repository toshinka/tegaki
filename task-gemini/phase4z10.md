# Phase 4z10 — ClipAsset Internal Layer Composite Preview Foundation

## 最初に読むこと

作業前に必ず以下を読む。

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/PHASE4Z_HANDOFF.md`
5. `task-gemini/phase4n_preview_scope_note.md`
6. `task-gemini/phase4z6.md`
7. `task-gemini/phase4z6_report.md`
8. `task-gemini/phase4z7.md`
9. `task-gemini/phase4z7_report.md`
10. `task-gemini/phase4z8.md`
11. `task-gemini/phase4z8_report.md`
12. `task-gemini/phase4z9.md`
13. `task-gemini/phase4z9_report.md`
14. `tegaki_work/system/animation/animation-data-model.js`
15. `tegaki_work/ui/animation-table-popup.js`

## 重要な注意

- 今回は **ClipAsset内部LayerをPreviewへ反映するための最小基盤** だけを作る。
- Virtual Layer Panel、内部Layerへの実描画、通常レイヤーパネル切替、内部Layer D&D、Export連携は今回しない。
- 現行の単一Snapshot Previewを壊さない。内部Layer合成に失敗した場合は、従来通り `ClipAsset.drawingSnapshotId` / `TimelineModel.getSnapshotForCel()` の表示へ戻れること。
- 背景レイヤーは共有キャンバス下地であり、ClipAsset内部Layerに含めない。
- `animation-table-popup.js` は肥大化している。DOM/CSSの大規模置換やテンプレート文字列の丸ごと再構成は禁止。
- JSファイルの丸ごと置換は禁止。必要箇所だけ差分編集する。
- `npm.cmd run build` が失敗した場合、今回触ったPreview/内部Layer周辺を優先して確認し、関係ないファイルへ修正を広げない。
- `dist/` は成果物に含めない。

## 背景

Phase 4z6〜4z9で、ClipAssetは内部Layerを持てるようになった。

現在できていること:

- `ClipAssetInternalLayerModel`
- `ClipAssetModel.internalLayers`
- Internal Layers Inspector
- 内部Layerの追加、削除、リネーム、visible切替
- 内部Layerの上下順序変更

しかし、キャンバス上のアニメPreviewはまだ主に `ClipAsset.drawingSnapshotId` の単一Snapshotを表示している。

そのため、Inspectorで内部Layerを複数作っても、以下はまだPreviewへ反映されない。

- 内部Layerの順序
- visible
- opacity
- blendMode
- 内部Layerごとの `drawingSnapshotId`

Phase 4z10では、いきなり本格編集へ行かず、Preview表示の中だけで「内部Layerを合成対象として読める」足場を作る。

## 目的

ClipAsset内部Layerの配列を使って、Preview用の合成表示を行える最小基盤を作る。

目的は以下。

- 内部Layerが複数あるAssetで、Preview時に各LayerのSnapshotを積める。
- `visible === false` の内部LayerはPreviewに出ない。
- `opacity` はPreview sprite の alpha に反映される。
- `blendMode` は可能な範囲でPreview sprite に反映される。
- 内部Layerの順序方針を、Preview実装上も分かる形にする。
- 単一Snapshotしかない既存Assetや古いAssetは、従来Previewで表示できる。

## 現在のPreview経路

主に `animation-table-popup.js` の以下を読む。

- `_applyVisibilityPreview()`
- `_renderFrameComposite(frameIndex, layers, options)`
- `_renderOnionSkins(currentFrame, layers, options)`
- `_renderOnionFrame(frameIndex, layers, options)`
- `_renderCelPreview(track, cel, layers, options)`
- `_getTextureFromSnapshot(snapshot)`

現在は `_renderCelPreview()` が `this.model.getSnapshotForCel(cel)` を呼び、1枚のSnapshotからTextureを作って `animationPreviewContainer` に `Sprite` として追加している。

## 今回やること

### 1. 内部Layer合成対象の解決ヘルパーを追加

`animation-data-model.js` または `animation-table-popup.js` に、Clip/CelからPreview用内部Layer一覧を解決する小ヘルパーを追加する。

候補:

```js
getPreviewInternalLayersForCel(cel) { ... }
```

または `AnimationTablePopup` 側の private helper でもよい。

戻り値の候補:

```js
{
    ok: true,
    asset,
    layers: [...]
}
```

方針:

- `cel.assetId` がない場合は内部Layer合成しない。
- Assetがない場合は内部Layer合成しない。
- `asset.internalLayers` が空なら、既存の `ensureClipAssetInternalLayer()` で最低1枚を補完してよい。
- 内部Layerのうち、`type === 'raster'` かつ `drawingSnapshotId` があるものをPreview対象にする。
- Snapshotが取得できないLayerはスキップする。
- 有効な内部Layer Snapshotが1枚もない場合は、従来の `getSnapshotForCel(cel)` 経路へfallbackする。

### 2. `_renderCelPreview()` を小さく分岐する

`_renderCelPreview()` の冒頭付近で、内部Layer合成Previewを試す。

候補:

```js
const renderedInternalLayers = this._renderClipAssetInternalLayerPreview(track, cel, layers, options);
if (renderedInternalLayers) return;
```

注意:

- 既存の単一Snapshot表示処理は削除しない。
- Snapshot未取得の選択セルで `allowSourceLayerFallback` する挙動も残す。
- `_renderCelPreview()` を巨大化させず、内部Layer描画は別メソッドへ分ける。

### 3. 内部Layerの描画順

Inspector表示では、配列先頭が上/前面という扱いになっている。

Previewでは以下の順で描画する。

- `asset.internalLayers` の末尾から先頭へ描画する。
- つまり配列末尾が背面、配列先頭が前面。
- これにより、Inspector上で上にあるLayerがPreviewでも前面に見える。

この方針を短いコメントで残す。

### 4. 内部LayerごとのSprite生成

内部Layerごとに以下を行う。

- `layer.drawingSnapshotId` から `DrawingSnapshotModel` を取得。
- `_getTextureFromSnapshot(snapshot)` でTexture化。
- `Sprite(texture)` を作る。
- `sprite.alpha` は以下を掛け合わせる。
  - sourceLayer側のopacity
  - 内部Layerの `opacity`
  - Onion Skinなど `options.alpha`
- `sprite.blendMode` は内部Layerの `blendMode` を優先する。
  - 未設定なら sourceLayer の `blendMode`
  - それもなければ `'normal'`
- `options.tint` があれば従来通り適用する。
- `animationPreviewContainer.addChild(sprite)` へ追加する。

注意:

- PixiJS v8.17.0 では `BlendMode` を named import しない。
- `sprite.blendMode = 'normal'` / `'multiply'` など、既存方針と同じ文字列指定にする。

### 5. visible / opacity / blendMode の扱い

- `visible === false` の内部Layerは描画しない。
- `opacity` が数値でない場合は `1` として扱う。
- `opacity <= 0` は描画しなくてよい。
- `blendMode` は内部Layerが持つ値を使う。ただし存在しない/空なら `'normal'`。
- 今回、Inspector上で opacity / blendMode を編集するUIは作らない。既存データに値がある場合だけ反映する。

### 6. Texture cache の扱い

既存の `_snapshotTextureCache` は Snapshot object を key にしている。

今回は以下でよい。

- 各内部Layerの `DrawingSnapshotModel` を `_getTextureFromSnapshot()` に渡し、既存cacheを利用する。
- 新しいcache機構を増やさない。
- CAPTUREで既存Snapshotを更新する時の既存cache破棄処理は維持する。

### 7. Inspector確認用の最小フィードバック

必須ではないが、内部Layer合成Previewが使われたことを確認しやすいように、Asset LibraryのAsset行やInspectorに大きなUIを増やさない。

必要なら報告書に「確認方法」を書く。

例:

- 内部Layerを2枚作る。
- 片方の `visible` をOFFにする。
- PreviewでそのLayerが出ないことを確認する。

ただし、opacity/blendMode編集UIは今回作らないため、手動データ変更なしで見えない場合はコードレベル確認でよい。

## 今回やらないこと

- 内部Layerへの実描画。
- Internal Layers Inspectorでの opacity / blendMode 編集UI。
- 内部LayerごとのSnapshot差し替えUI。
- 通常レイヤーパネルをClipAsset内部Layerへ切り替える処理。
- Clip Edit View / Virtual Layer Panel。
- Frame Compositeをレイヤーパネルへ展開する処理。
- DrawingSnapshotの参照カウント/GC。
- Assetサムネイル生成。
- Export/APNG/GIF連携。
- CAPTURE/AUTO/EDITの名称整理。
- 内部Layer D&D。
- 背景レイヤーの内部Layer化。

## 受け入れ条件

- `npm.cmd run build` が成功する。
- 既存の単一Snapshot ClipAssetは従来通りPreview表示される。
- 内部Layerが複数あるClipAssetでは、Preview時に内部LayerのSnapshotが描画対象になる。
- `visible === false` の内部LayerはPreviewに出ない。
- 内部Layerの `opacity` がPreview sprite alpha に反映される。
- 内部Layerの `blendMode` がPreview sprite blendMode に反映される。
- Inspectorの順序とPreviewの前後関係が矛盾しない。
  - 配列先頭がInspector上/前面。
  - Preview描画は末尾から先頭。
- Frame Composite Preview、Clip選択時の単独Preview、Onion Skin、ALL/LANE/SET Scopeの既存挙動を壊さない。
- Snapshotがない内部LayerだけのAssetでもエラーにならず、従来Previewまたは何も描かない安全な挙動になる。
- 背景レイヤー由来の内部Layerを作らない。
- `dist/` の差分を成果物に含めない。

## 確認手順

最低限、以下を確認する。

1. `npm.cmd run build`
2. アプリ起動後、アニメテーブルを開く。
3. 既存のClip/Auto Seed Clipが従来通りPreviewされる。
4. ASSETSを開き、Internal LayersでLayerを追加する。
5. Layerの表示ON/OFFを切り替え、Previewに反映されることを確認する。
6. Layerの上下順序を変えてもエラーが出ないことを確認する。
7. PREVIEW / ONION / SCOPE: ALL / LANE / SET の主要操作でConsoleエラーがないことを確認する。

opacity / blendMode は編集UIがないため、今回の通常操作だけで確認しづらい場合は、コードレベル確認として報告してよい。

## 報告書

作業後に以下を作成する。

- `task-gemini/phase4z10_report.md`

報告書には以下を必ず書く。

- 変更ファイル一覧。
- 追加したPreview用ヘルパー。
- 内部Layer描画順の解釈。
- visible / opacity / blendMode の扱い。
- 従来Previewへのfallback方針。
- 確認した操作。
- `npm.cmd run build` の結果。
- 残った課題。

## PROGRESS.md更新

作業後に `tegaki_work/PROGRESS.md` の最上部へ Phase 4z10 完了ログを追記する。

最低限、以下を書く。

- Phase 4z10 の目的。
- 変更ファイル。
- ビルド結果。
- Previewに反映できた内部Layer項目。
- 後続Phaseへ残すこと。

