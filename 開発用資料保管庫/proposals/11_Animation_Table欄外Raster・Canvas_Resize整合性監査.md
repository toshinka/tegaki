# Animation Table欄外Raster・Canvas Resize整合性監査

更新日: 2026-07-14

## 監査結果

Ultra推論でPhase 5p以降の `rasterBounds`、CAF正本 / working adapter、Clip Motion、Frame compositor、Canvas Resize、Cameraを横断監査した。

現象は一つではない。少なくとも次の経路を分離して直す必要がある。

1. V変形の表示だけを、確定前に初回CAFへ取り込む経路。
2. Clip Motionより前にProject frameへcropするexport compositor。
3. CAF merge / Folder mergeがunion boundsを作らず恒久cropする経路。
4. Canvas Resizeが保存Rasterを新frame寸法へ焼き直して破壊する経路。
5. CAF DrawingSnapshot正本とanimation working Layer adapterのresize後不一致。
6. Camera viewの無条件再中心化とreset基準の古さ。
7. oversized DrawingSnapshotのworking restore失敗後にblank adapterがdirty扱いされる経路。

Phase 5z7は1〜3と7、Phase 5z8は4〜6を扱う。Resize修正を欄外export修正へ混ぜない。

## 正しい処理順

```text
保存Raster + rasterBounds
        ↓
内部Layer / Folder / clipping合成（欄外を保持）
        ↓
Clip transform / easing sample
        ↓
Project frameへ最終crop
        ↓
preview / playback / export
```

Project frameは作品の表示・出力範囲であり、通常Raster Layer / CAF DrawingSnapshotの保存寸法ではない。Canvas-only resizeはcamera frameの変更であって、保存pixelのtrim操作ではない。破壊的trimが必要なら将来の明示commandとして分ける。

## Finding A — 初回CAF seed前のV変形未確定

重要度: P0。状態: 強い再現仮説。

`AnimationTablePopup.show()` はV modeを確定せず `render()` へ進む。初回 `_ensureInitialClipAssetSeed()` は `createLayerRasterSnapshot()` でRenderTextureだけを取り込むため、Pixi Container上にだけ存在する未確定scale / rotation / positionはsnapshotへ入らない。

その結果、Tableを開く直前には拡大表示でも、初回CAFは変形前Rasterとなり「縮小した」ように見える。CLIP MOTIONを開く経路は先に `exitLayerMoveMode()` を呼ぶため、Table初回seedと契約が揃っていない。

修正方針:

- Table `show()` 冒頭のworking保存、panel表示、`render()` より前にV確定preflightを置く。未確定Containerを先にworking Layerからcaptureしない。
- transform active時はone-shot `layer:transform-exit` listenerを登録してから既存exitを呼び、Folder変形の `requestAnimationFrame + setTimeout` を含めevent完了までshow / seedを保留する。同期return値を完了判定に使わない。
- pending tokenで二重show / 二重seedを防ぎ、`confirmed !== true`、例外、対象Layer消失時はseedを中止して理由を表示する。
- bake失敗時はseedを中止し、理由を表示する。表示Container transformをsnapshotへ別実装で混ぜない。
- 変形確定は既存 `confirmLayerTransform()` / `bakeTransform()` を唯一の正本にする。

## Finding B — TimelineFrameCompositorの早期crop

重要度: P0。状態: 確定。

`TimelineFrameCompositor._renderAsset()` は最初からProject width / heightのCanvasを作り、各DrawingSnapshotを `rasterBounds.x/y` へ描く。この時点でProject frame外のpixelが消え、その後に `_drawTransformedClip()` が実行される。

Live Pixi previewはfull snapshotをbounds位置へ置いてからClip Motionを適用し、camera maskが最後にcropする。したがって「欄外RasterをMotionで画面内へ戻す」ケースで、Table previewには見えるがGIF / APNG等のcompositor出力はblankになり得る。

修正方針:

- visible internal snapshotのProject座標unionを計算し、`{ canvas, bounds }` のtight surfaceへ合成する。
- Clip transform時はProject anchorを使い、source canvasを `bounds.x / bounds.y` のProject座標へ置く。
- Project frameへのcropはtransform後の最終出力で一度だけ行う。
- Clip blend用Project寸法中間Canvasはtransform後なので維持できる。
- Folder opacity / blend / clippingはunion surface上で現在と同じ順序を維持する。
- union surfaceは離れた小Rasterだけでも巨大化するため、axis上限とsafe pixel countを確保前に検査する。既存Layer transform bakeのmax texture / 16MP判定を共通pure helperへ寄せ、超過時はexportを理由付き中止する。tiled compositorを本Phaseへ暗黙導入せず、無言cropやOOMへ進まない。

最小固定入力:

- 400x400、snapshot `{x:450,y:100,width:40,height:40}`、Clip `x=-450` で最終 `(0..39,100..139)` が不透明。
- snapshot `{x:-40,...}`、Clip `x=+40` の鏡像。
- anchor 0 / 0.5 / 1、scale、rotation、複数disjoint internal Layer、Folder clippingを追加する。
- live previewとcompositorのalpha bbox / pixel hashを比較する。
- 整数移動・NORMAL・再sampleなしは厳密pixel hashを要求する。rotation / scale / blendはPixiとCanvas2Dの丸め・premultiply差を考慮し、alpha bboxの各辺差1px以内と、透明RGBを除外した明示的なRGBA許容差を固定入力側へ記録する。目視だけを合格条件にしない。
- 1px Rasterを数千万px離した入力で、巨大Canvasを確保せず理由付き失敗になることも確認する。

## Finding C — CAF mergeのunion bounds欠落

重要度: P1。状態: 確定。

- `_createInternalFolderCompositeSnapshot()` はProject寸法Canvasへ描き、出力boundsを常に `{0,0,ProjectW,ProjectH}` にする。
- `_applyInternalLayerMergeDown()` はsnapshot幅のmaxだけを使い、負originや `x + width` を考慮しない。
- `_mergeInternalLayerSnapshots()` はbounds位置へ描いた後、出力originを0へ戻す。

これらは編集操作として欄外pixelを恒久破棄する。

修正方針:

- pure `unionRasterBounds()` を共通入口にする。
- 各sourceを `(bounds.x - union.x, bounds.y - union.y)` へ描く。
- 出力snapshotはunionのx/y/width/heightを保持する。
- Folder merge、merge down、clipping maskで同じprimitiveを使う。

固定入力はA `{-80,10,100,20}`、B `{350,15,100,20}` からunion `{-80,10,530,25}` を得て、両端alphaをmerge / Undo / Redo / save / loadで維持する。

## Finding C2 — oversized working restore後のblank capture

重要度: P1。状態: 確定経路、実機上限への到達条件はGPUごとに確認する。

`_syncClipAssetToWorkingLayers()` はoversized snapshotをworking RenderTextureへrestoreできない場合、adapterをblankへ戻し、`animationSnapshotId = null` とする。一方、`_hasDirtyWorkingLayersForClip()` は正本snapshot IDとの不一致を編集済みと判定するため、Frame切替等の保存入口でblank adapterを新しいDrawingSnapshotとしてcaptureし得る。

修正方針:

- restore不能状態をruntimeの明示的なblocked stateとし、dirty編集と区別する。
- blocked中はworking adapterから正本へcaptureせず、Canvas描画もread-onlyにする。
- DrawingSnapshot正本、ClipAsset参照、元のsnapshot IDを変更しない。
- UIへ「表示用texture上限のため原画編集不可」と理由を表示し、preview / exportは保存snapshotから継続する。
- Frame切替、Table開閉、Undo / Redo、save / loadで正本のbounds / pixel hashが変わらない固定入力を置く。

## Finding D — Canvas-only resizeがpixelを破壊する

重要度: P0。状態: 確定。

`CameraSystem.resizeCanvas()` の `camera:resized` を受けた `LayerSystem.resizeLayerTextures()` は、全Rasterを新しいProject frame寸法のRenderTextureへ再確保する。旧RTをoffset付きで描き、新RT外をcropして旧RTを破棄する。

これはPhase 5pの `rasterBounds` を迂回する。frame縮小では欄外pixelを実消去し、奇数差の中央揃えでは0.5px offsetによる不要な再サンプルも起こり得る。maskTextureも全塗り状態へ初期化される。

Canvas-only resizeの正しい契約:

- pixel buffer / RenderTexture寸法を変えない。
- 既存alignmentから整数 `offsetX / offsetY` を一度だけ解決する。
- 通常Layerと全参照中DrawingSnapshotの `rasterBounds.x/y` を同じoffsetで平行移動する。
- animation working Layerは正本として別更新せず、更新後にDrawingSnapshotからforce restoreする。
- compatibility用 `clip.rasterSnapshot` も同じ座標へ揃える。
- vector path等のProject座標metadataも同じoffsetへ揃える。

## Finding E — `both` とCAF working adapterの分裂

重要度: P0。状態: 確定。

現行 `both` は次の順である。

1. before state取得。
2. `camera.resizeCanvas()`。
3. 通常Layer / working Layerを新frameへ破壊的resize。
4. `_scaleProjectContent()` がsourceを再収集。
5. after state取得。

通常Layerはcrop後Raster、CAF DrawingSnapshot正本はresize前Rasterからscaleされる。同じProjectで異なる入力を使う。

Canvas-onlyでも選択中CAFのworking RTだけが変更され、DrawingSnapshot正本と未選択CAFは変わらない。`animationSnapshotId` は同じため自動restoreされず、Frame切替、Table開閉、Undo / Redo、次の描画確定で表示や正本が突然変わり得る。

`content / both` はresize前のimmutable sourceを一度だけcaptureし、同じAffine変換を通常Layer、DrawingSnapshot、legacy snapshotへ原子的に適用する。working Layerを入力・History重複対象にしない。

## Resize時のClip anchor契約

Canvas-onlyでProject座標を `d = (offsetX, offsetY)` 平行移動する場合、Clip anchorの絶対pivotも同じdだけ動かす。これによりrotation / scale / x/y keyを変更せず、変形後の見た目も同じdだけ移動する。

```text
newAnchorX = (oldWidth  * oldAnchorX + offsetX) / newWidth
newAnchorY = (oldHeight * oldAnchorY + offsetY) / newHeight
```

anchorはCanvas外値を許容する現行契約を維持する。これを行わずnormalized anchorを同じ値のままにすると、非中央anchor + rotation / scaleでpivotだけが別量移動し、絵や回転軸が飛ぶ。

Content scaleを `p' = scale * p + translation` とする場合は、pivotへ同じAffine変換を適用し、Motionの `x/y` はscale倍する。rotationとscale倍率は相対値として維持する。

## Finding F — Camera viewとProject frame mutationの混在

重要度: P1。状態: 確定経路、見え方への寄与は実機再現で確定する。

`CameraSystem.resizeCanvas()` はconfig、guide/mask、cache、view center、content resize eventを一つのAPIで行う。さらに毎回 `centerCanvasOnScreen()` を無条件実行する。

Cameraへ保持されるapp参照は `{ stage }` だけなのでrenderer screenを取得できず、Animation Tableやsidebarで隠れる領域を含む `window.innerWidth / innerHeight` 中央へ移動する。`resetCanvas()` のinitial positionも初期canvas寸法のままである。

修正方針:

- Project frame geometry変更とCamera view変更を別APIにする。
- resize前後で選択したframe anchorのscreen位置を保存する。
- resizeで無条件window中央へ飛ばさない。
- 明示「中央へ戻す」だけ実描画viewportの中央を使う。
- reset基準は現在frame寸法から動的計算するか、resize後に正しく更新する。
- Resize HistoryでCamera pan / zoom / rotationをどう扱うか先に固定する。

## Memory / Historyリスク

- Resize Historyは通常Layerと全CAF snapshotのbefore / after pixelを保持する。
- 1000x1000の100 snapshotではpixel bufferだけでbefore + after約800MBとなる。
- preview cache、before、apply入力、afterが同時に存在し、peakはHistory表示値より大きい。
- 単一巨大commandはmemory上限を超えても最後の1件が残る現行History契約がある。

Canvas-only Historyはframe寸法、bounds、anchor等のmetadataだけを保持する。Content scaleはSnapshot ID単位でdedupeし、未参照snapshotとworking adapterを除外する。実行前にbyte estimateと安全な中止を行い、GPU context lossを画像欠落と誤認しないようにする。

## 再現マトリクス

| ID | 入力 | 操作 | 判定 |
|---|---|---|---|
| O1 | 100px角をVで2倍、Vを閉じない | Animation Table初回open | 確定後normal snapshotと初回CAFが一致 |
| O2 | bounds x=450のCAF + Motion x=-450 | preview / GIF / APNG | alpha bbox / hash一致 |
| O3 | 負originと右欄外のCAF internal Layer | merge / Folder merge | union boundsと両端alpha維持 |
| R1 | 欄外へ出した通常Layer | Canvas縮小→再拡大 | pixel hash不変 |
| R2 | 選択 / 未選択の同一CAF | Canvas-only→Frame切替 | working / 正本表示一致 |
| R3 | 通常Layer + CAF | `both`縮小 | 同じpre-resize sourceから変換 |
| R4 | 400→401中央 | Canvas-only | pixel hash不変、再サンプルなし |
| R5 | 非中央anchor + rotation key | 片側resize | 絵、pivot、Motion相対位置維持 |
| R6 | 多数CAF / internal Layer | content / both→Undo / Redo | byte estimate、停止時間、context lossなし |
| R7 | assetless旧CAF | content resize | compatibility snapshotも一致 |
| R8 | Camera pan後 | resize→reset | 定義したviewport policyと一致 |
| R9 | R1 / R2後 | save / load | 一時adapter差、正本破壊ともになし |

## Phase分割

### Phase 5z7 — 欄外Rasterのcapture / composite順序

1. 初回CAF seed前のV変形確定gate。
2. compositorをunion surface + transform後cropへ変更。
3. CAF merge / Folder mergeをunion boundsへ変更。
4. oversized working restore時の正本非破壊guard。
5. preview / playback / exportのbbox / hash一致。

### Phase 5z8 — Canvas Resize transaction / Camera分離

1. Canvas-onlyをbounds / anchor metadataだけの非破壊transactionへ変更。
2. working adapterを入力から除外し、DrawingSnapshot正本から再同期。
3. Project frame geometryとCamera viewを分離。
4. content / bothをpre-resize source一回のAffine transactionへ変更。
5. History dedupe、memory preflight、import / Project load残差を整理。

## 維持する契約

- stroke中working Layer表示、preview staging交換、preview container順を変更しない。
- 上側Lane前面、PSD record順、Lane / Timeline onionのdisplay-only境界を変更しない。
- Folder clippingのowner / source解決と二値alpha契約を変更しない。
- Project frame cropを廃止しない。cropする時点だけを最終出力へ戻す。
- WebGPU、tiled canvas、mesh、bone、physicsを混ぜない。
