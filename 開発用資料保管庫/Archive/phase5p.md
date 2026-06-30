# Phase 5p — 無限キャンバス / 欄外ラスター保持

更新日: 2026-06-28

## 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `開発用資料保管庫/proposals/06_無限キャンバス.md`
5. `tegaki_work/PHASE5P_HANDOFF.md`
6. `tegaki_work/config.js`
7. `tegaki_work/system/data-models.js`
8. `tegaki_work/system/layer-system.js`
9. `tegaki_work/system/layer-transform.js`
10. `tegaki_work/system/image-importer.js`
11. `tegaki_work/system/pixel-selection-system.js`
12. `tegaki_work/system/animation/animation-data-model.js`
13. `tegaki_work/ui/animation-table-popup.js`
14. `tegaki_work/system/project-manager.js`
15. `tegaki_work/system/animation/timeline-frame-compositor.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## 目的

Layer全体移動、画像import、CAF working Layer編集で、Project frame外へ出たRaster pixelが確定・保存・Undo/Redo・CAF複製の過程で消えないようにする。

今回の「無限キャンバス」は、Project frameや出力範囲を無限化する意味ではない。400x400などの作品フレームは維持し、Raster Layerごとの保存矩形だけを必要に応じて広げる。

## 最初のSlice

最初のsliceは実装を広げすぎず、固定キャンバス前提のcontractを崩さない形で足場を作る。

1. `RasterBounds` helperを追加する。
2. `LayerModel`、`LayerSystem.createLayerRasterSnapshot()`、`LayerSystem.restoreLayerRasterSnapshot()`、`DrawingSnapshotModel` がboundsなし旧データとboundsあり新データを同じ正規化経路で扱えるようにする。
3. 既定挙動はProject frame固定のまま維持する。
4. debug時だけ、RenderTexture寸法、snapshot寸法、rasterBoundsの不一致を確認できるようにする。
5. まだV移動、画像import、CAF、selectionの挙動を変えない。

このsliceの目的は、後続の整数V移動bounds commit化を安全に差し込める状態にすること。

## 実装順の推奨

### Slice 1 — contract追加

- `system/raster-bounds.js` を追加する。
- `LayerModel` に `rasterBounds` を追加する。
- `createLayerRasterSnapshot()` が `rasterBounds` を返す。
- `restoreLayerRasterSnapshot()` がboundsを復元し、`layerSprite.position` をboundsへ同期する。ただし初期値は既存同等の `{ x: 0, y: 0, width, height }`。
- `DrawingSnapshotModel` と `_createRasterSnapshotCompat()` がboundsをclone / serializeする。
- 旧データはboundsなしを正規化する。

### Slice 2 — 通常Layerの整数移動

- `confirmLayerTransform()` の純粋な整数平行移動はpixel shiftではなく `rasterBounds.x/y` 更新で確定する。
- Undo / Redoはboundsごと復元する。
- Project保存復元で通常Layerのboundsを保持する。

### Slice 3 — import / duplicate / merge

- `image-importer.js` は合成先をcurrent boundsとplacement rectのunionにする。
- Layer duplicateはboundsをcloneする。
- merge downはProject coordinates上でbottom boundsを必要に応じて拡張する。

### Slice 4 — CAF

- DrawingSnapshotのboundsをCAF保存正本へ入れる。
- working Layer restore / captureをbounds対応する。
- CAF raster History、ClipAsset duplicate、CAF copy/paste、Frame compositorをbounds対応する。

### Slice 5 — drawing / selection / fill

- bounds originが0でないLayerへ追加strokeしても位置がずれないように、Project coordinates -> Raster coordinates変換をRenderTexture描画経路へ入れる。
- selection extract / clear / pasteをbounds対応する。
- fillはactive Layer参照のbounds対応を行い、all layers参照はProject frame cropを維持する。

### Slice 6 — clipping / thumbnail / export回帰

- source/targetのboundsが違う通常・逆clippingをProject coordinatesで一致させる。
- Frame export / Album thumbnail / Export previewはProject frame cropを維持する。
- Layer panelやCAF internal previewは欄外データを見失いにくい表示を検討する。

## 受け入れ条件

### 通常Layer

- 400x400でpen描画したLayerを `V` で `+450px` または `-450px` 欄外へ移動してconfirmしても、反対方向へ戻した時にpixelが欠けない。
- Undo / Redoでboundsとpixelが一緒に戻る。
- 欄外移動後にProject JSON保存復元しても戻せる。
- PNG / Export previewは従来通りProject frame範囲だけを出力する。

### 画像import

- 外部画像をアクティブRaster Layerへ貼り付けた後、`V` で欄外へ逃がして戻しても欠けない。
- 内部Layer clipboard、selection clipboard、CAF clipboardの優先順位を壊さない。

### CAF

- Animation Table / CAF working Layerでpen描画または画像貼り付け後、`V` で欄外へ移動して戻しても欠けない。
- CAF copy / paste、Frame移動、Undo / Redo、保存復元でboundsが維持される。
- 通常Layer HistoryへCAF編集を誤記録しない。

### 互換

- boundsなし旧Projectが読み込める。
- boundsなし旧DrawingSnapshotが読み込める。
- 背景LayerはProject frame固定のまま。
- mouse入力や既存pen描画の通常ケースを変えない。

## 対象外

- Project frame自体の無限化。
- full tiled canvas。
- WebGPU有効化。
- SDF/MSDF。
- WebGL2 Mesh。
- DPR 2倍化。
- 内部2倍RenderTexture。
- Canvas2D本番stroke混入。
- PSD import。
- 複数Layer画像import。
- ClipInstance transform / keyframe。
- TimelineModel / LayerSystem / CAF Historyの全面再構成。
- 保存形式の破壊的変更。

## 注意点

- Sprite位置だけ変えると、表示は合ってもstroke / fill / selectionがずれる。bounds originが0でないLayerへの追加編集を必ず確認する。
- `restoreLayerRasterSnapshot()` は多くのHistory / CAF / import経路から呼ばれるため、正規化をここへ寄せる。
- Exportは全boundsではなくProject frame cropを維持する。
- 無制限にRenderTextureを広げない。max texture size、History byteSize、CAF memory profilerを確認する。
- `dist/`、`node_modules/.vite/` の生成差分を残さない。

## 検証

変更規模に応じて実行する。

```powershell
node --check tegaki_work/system/raster-bounds.js
node --check tegaki_work/system/data-models.js
node --check tegaki_work/system/layer-system.js
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/ui/animation-table-popup.js
Set-Location tegaki_work
npm.cmd run build
```

UI/描画変更を含むsliceではブラウザで次を確認する。

- pen / eraser / airbrush。
- `V` 欄外移動、戻し、Undo / Redo。
- 画像import / clipboard画像paste。
- CAF working Layer上の描画、`V`、Undo / Redo。
- 保存復元。
- Export previewまたはPNG保存。
- console errorなし。

build後は `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。
