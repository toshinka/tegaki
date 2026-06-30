# Phase 5p Handoff — 無限キャンバス / 欄外ラスター保持

更新日: 2026-06-28

## 現在の入口

Phase 5pは、Project frame外へ移動したRaster内容を失わないための設計・実装Phase。

直前のPhase 5nで `V` 単独キーによる通常Layer / CAF working LayerのLayer全体変形入口を修正し、Phase 5oで外部画像import / OS clipboard画像pasteをアクティブRaster Layerへ接続した。これにより、アニメ素材や貼り付け画像を欄外へ逃がす操作が増えるが、現行の固定RenderTexture契約では確定時に欄外pixelが消える。

## 正本

- 詳細設計: `開発用資料保管庫/proposals/06_無限キャンバス.md`
- 実行指示: `task-codex/phase5p.md`
- 現在状態: `tegaki_work/PROGRESS.md`
- 技術境界: `TEGAKI.md`

## 重要な結論

- Project frameは無限化しない。
- 出力範囲、背景Layer、Timeline frameは現行のProject frameを維持する。
- 無限化するのは通常Raster Layer / CAF internal Raster Layerの保存矩形。
- 実装上は `rasterBounds = { x, y, width, height }` をLayer snapshot / DrawingSnapshot / Project保存へ持たせる。
- boundsなし旧データは `{ x: 0, y: 0, width, height }` として読む。
- まずは整数平行移動でpixelを動かさずboundsだけを動かすのが最小価値。

## 最初に触る候補

1. `system/raster-bounds.js` を追加する。
2. `system/data-models.js` の `LayerModel` に `rasterBounds` を追加する。
3. `system/layer-system.js` の `createLayerRasterSnapshot()` / `restoreLayerRasterSnapshot()` をbounds対応する。
4. `system/animation/animation-data-model.js` の `DrawingSnapshotModel` をbounds対応する。
5. `ui/animation-table-popup.js` の `_createRasterSnapshotCompat()` / clone系をbounds対応する。

最初のsliceでは挙動を変えず、既定boundsをProject frame固定にする。

## その次の価値

`system/layer-system.js` の `confirmLayerTransform()` で、純粋な整数平行移動を `translateRgbaPixels()` ではなく `rasterBounds.x/y` 更新で確定する。これにより、欄外へ出たpixelを最初に失わなくなる。

## 現在の実装メモ

- `system/raster-bounds.js` を追加し、通常Layer snapshot / DrawingSnapshot / Project保存 / CAF互換snapshotへ `rasterBounds` を通した。
- 通常LayerとCAF working Layerの整数V移動はpixel shiftではなくbounds移動で確定する。
- 非0 boundsのLayerへ追描画する時は、stroke開始時に `current bounds ∪ Project frame` へRenderTextureを拡張し、焼き込み時に `-rasterBounds.x/y` を適用する。
- CAF working Layerも同じ拡張経路を使う。V移動後にProject frame内の描画可能範囲が描画物と一緒にずれないことが狙い。
- 通常Layer / CAF内部LayerのサムネはProject frame cropを維持し、Project frame外にalpha pixelが残る場合だけ欄外バッジを表示する。
- 欄外バッジはサムネ右下へ統一する。サムネ視認性より、対象ラスターとの関連が明確なことを優先した。
- CAF working Layer上のbucket fillはCAF raster History境界へ接続済み。通常Layer Historyへ混ぜない。
- CAF working Layer上のbucket fillは、boundary snapshot取得前に `drawing:stroke-started` を発火してworking Layerを表示対象へ戻す。snapshot取得後に発火すると、CAF preview中の非表示状態を読んで線内塗りが全体塗りになる。
- bucket fill開始時もpenと同じく `current bounds ∪ Project frame` へRenderTextureを拡張する。V移動後にpenを一度入れた時だけfill範囲が広がる状態は、この拡張漏れが原因。
- Project frame内クリックのbucket fillはboundary snapshotをProject frameへcropしてBFSする。欄外保持でRTが大きくなった場合の探索コストを抑える。
- 描画中PreviewでもOnion skinを維持する。選択中Clip本体は除外し、working Layerと前後フレームを同時に見せる。
- 選択範囲制限はbefore / after snapshotのbounds差をProject座標で照合する。RT拡張後も選択外pen / fillをbefore pixelsへ戻す。
- BrushCoreでは通常History用beforeとselection制限用beforeを分離する。CAF working Layerは通常Historyを記録しないが、selection制限用beforeだけは保持する。
- BrushCore / FillTool / PixelSelectionSystem のヘッダーにPhase 5p共通契約を明記済み。今後の描画系追加はこの3点を確認する。
- V移動 / selection V変形中は描画入力を受け付けない。pen / eraser / fill / airbrush等へ切り替える時は、進行中のLayer transform / selection transformを先に確定してから切り替える。
- selection paste / paste as new layerはコピー元Project座標を維持し、貼り付け先Layerのboundsを必要に応じて拡張する。Undo / cancelは拡張前snapshotへ戻す。
- lasso fillは投げ縄点群のProject座標範囲までboundsを拡張し、RT描画時に `rasterBounds.x/y` を差し引く。CAF working Layerでもstroke-completedを発火する。
- 通常Layer / CAF内部Layerの「外」バッジは欄外データ回収UIを兼ね、対象RasterをProject frame中央へ戻す。通常Layerは通常History、CAF working LayerはCAF raster Historyへ記録する。
- Timeline compositor / CAF preview / internal clipping / merge down / image import / fill / eraser-fill / 通常selection / lasso fillはbounds対応済み。

## 警戒点

- `layerSprite.position` だけをboundsへ合わせると、追加stroke / fill / selectionがずれる。
- bounds originが0でないLayerへ描く時は、Project coordinatesからRaster coordinatesへ変換する必要がある。
- clipping maskはsource / target bounds差で位置ずれしやすい。
- CAF working Layerは通常Layer Historyへ記録しない。
- Layer transform / selection transform中に描画系ツールへ入る場合は、描画開始前に必ずtransformを確定またはキャンセルする。変形中のRasterへ直接stroke / fillを混ぜない。
- Exportは全boundsではなくProject frame cropを維持する。
- RenderTextureを無制限に拡張しない。
- 欄外データ回収UIは「外」バッジからの中央回収として接続済み。Project frame外の常時表示、全bounds export、tiled canvasは後続Phase候補。

## 固定確認の最小セット

- 400x400通常Layerにpenで短い線を描く。
- `V` でLayerを +450px 欄外へ移動してconfirm。
- 反対方向へ戻してpixel欠けなしを確認。
- Undo / Redo。
- 保存復元。
- 同じ操作をCAF working Layerで確認。

## 対象外

WebGPU、SDF/MSDF、WebGL2 Mesh、DPR 2倍化、内部2倍RenderTexture、Project frame自体の無限化、tiled canvas本格導入、PSD import、ClipInstance transform / keyframeはPhase 5pへ混ぜない。
