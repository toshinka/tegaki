# Phase 5z7: Animation Table欄外Raster整合性

更新日: 2026-07-14

## 目的

Phase 5pで導入した可変 `rasterBounds` とPhase 5w以降のClip Motionを、capture・CAF合成・animation exportの全経路で同じ順序へ戻す。保存RasterをProject frameへ早期cropせず、Clip transform後の最終表示 / 出力でだけframe cropする。

Phase 5z6のSegment Easing Editorは完了済みであり、本Phaseでは変更しない。Canvas ResizeとCameraのtransaction再設計はPhase 5z8へ分離する。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/proposals/00_計画索引.md`
6. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
7. `開発用資料保管庫/proposals/11_Animation_Table欄外Raster・Canvas_Resize整合性監査.md`
8. `開発用資料保管庫/Archive/phase5p.md`
9. `開発用資料保管庫/Archive/PHASE5P_HANDOFF.md`
10. `tegaki_work/system/raster-bounds.js`
11. `tegaki_work/system/layer-system.js`
12. `tegaki_work/system/animation/timeline-frame-compositor.js`
13. `tegaki_work/ui/animation-table-popup.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Slice 0 — 初回CAF captureのV変形確定gate

ユーザー報告の「通常表示では拡大済みなのにAnimation Tableでは縮小したように見える」最短再現を先に閉じる。

1. Animation Table初回open / seedと、通常LayerからCAFをcaptureする全入口を検索する。
2. `show()` 冒頭の `_saveSelectedClipFromWorkingLayers()`、panel表示、`render()` より前へpreflight gateを置く。V変形がactiveなら、未確定working表示を先にcaptureしない。
3. one-shot `layer:transform-exit` listenerを登録してから既存 `exitLayerMoveMode()` を呼ぶ。Folderの遅延確定は同期returnで判定せずeventを待ち、`confirmed === true` の時だけshow / seedを再開する。
4. pending tokenで連打による二重listener / 二重seedを防ぐ。失敗、cancel、対象Layer消失ではpanelを開かず理由を表示し、pending stateを必ず解除する。
5. 変形確定は既存 `confirmLayerTransform()` / `bakeTransform()` を唯一の正本とし、未確定Container transformを別capture実装へ混ぜない。
6. 100px角、2倍scale + 移動、整数移動、回転、負bounds、複数Layer Folder変形、show連打で「V確定後normal snapshot」と「初回CAF DrawingSnapshot」のbounds / alpha bbox / hashを比較する。

このSliceではcompositor、Resize、Cameraを変更しない。

## Slice 1 — compositorをtransform後cropへ戻す

1. visible internal DrawingSnapshotのProject座標unionを計算するpure helperを追加する。既存 `normalizeRasterBounds()` を正規化入口とする。
2. ClipAsset内部LayerをProject frame寸法ではなくunion surface `{ canvas, bounds }` へ合成する。
3. Folder opacity / blend / clipping、内部Layer順は現行と同じにする。
4. `_drawTransformedClip()` はProject anchorを維持し、source surfaceをbounds origin付きでtransformする。
5. Project frame cropは最終出力で一度だけ行う。Clip blend用Project寸法中間はtransform後のため維持する。
6. keyframe無し、boundsなし旧Projectは従来表示と一致させる。
7. union surface確保前にaxis上限とsafe pixel countを検査する。既存Layer bakeのmax texture / 16MP判定を共通pure helperへ寄せ、超過時はexportを理由付き中止する。無言crop、OOM、tiled canvasへのscope拡張を行わない。

最小固定入力は400x400、snapshot x=450 / width=40、Clip x=-450で最終左端40pxが復帰するケースと、その鏡像とする。anchor、scale、rotation、opacity、Clip blend、Folder clippingを追加する。さらに1px Rasterを数千万px離した入力で、巨大surfaceを確保せず明示失敗することを確認する。

## Slice 2 — CAF mergeのunion bounds

1. `_applyInternalLayerMergeDown()` と `_createInternalFolderCompositeSnapshot()` の全read / writeを監査する。
2. 共通union boundsへ各snapshotを相対配置し、出力boundsを0へ潰さない。
3. source / targetのopacity、blend、normal / inverse clipping、Folder階層を現行順序で合成する。
4. merge、Folder merge、Undo / Redo、Project round-tripでbounds / pixel hashを維持する。
5. compositorと同じsurface size preflightをmergeにも使い、上限超過時は元Layerを維持したまま操作全体を中止する。

## Slice 3 — oversized working restoreの非破壊guard

- working Layer restoreがtexture / pixel safety上限を超える場合、runtimeのinvalid-adapter / blocked stateを立て、DrawingSnapshot正本をblank adapterで上書きしない。
- `_saveSelectedClipFromWorkingLayers()`、stroke完了、transform-exit、自動captureの全入口でblocked adapterをgateする。Clip切替だけでは正本を変更せず、正常restoreした別Clipへ移った時だけblocked stateを解除する。
- 本Phaseでは正本逆流guardを必須とする。対象CAFをread-onlyとする理由表示が大きい場合は後続UIへ分離してよいが、無言blankを編集可能状態にしない。
- Frame切替、Table開閉、stroke / V入力拒否、Undo / Redo、save / loadで元DrawingSnapshotのID / bounds / pixel hashを維持する固定入力を置く。

## 対象外

- Canvas-only / content / both Resize実装、Camera center / reset。Phase 5z8で扱う。
- Segment Easing Editor、Motion Graph、preset追加。
- Folder group blend完全合成の再設計。
- Project frame自体の無限化、破壊的pixel trim、tiled canvas。
- mesh、morph、Bone、physics、WebGPU。

## 維持する契約

- `ClipInstance.transform / transformKeyframes` と `sampleClipTransform()` が唯一のMotion正本。
- stroke中working Layer、preview staging交換、preview container順、上側Lane前面を変更しない。
- PSD record順、Lane / Timeline onionのdisplay-only境界を変更しない。
- Folder clippingのowner / source解決と二値alpha契約を変更しない。
- 通常PNG / thumbnailはProject frame cropを維持する。

## 検証

- 変更JSを `node --check` する。
- bounds union、transform後crop、merge、旧boundsなし互換を固定入力で確認する。
- `npm.cmd run build` を行う。
- BrowserでV変形未確定からの初回Table open、通常 / CAF Folder、preview、閉Table再生、Timeline onion、GIF / APNG、Undo / Redo、save / load、console errorなしを確認する。
- 整数移動・NORMAL・再sampleなしはlive previewとcompositor outputの厳密pixel hashを比較する。
- rotation / scale / blendはrenderer差を考慮し、alpha bboxの各辺差1px以内と透明RGBを除外した明示的なRGBA許容差で比較する。目視だけ、または全case一律の厳密hashを合格条件にしない。
- build後に `tegaki_work/dist/` と `tegaki_work/node_modules/.vite/` の生成差分を残さない。

## 完了条件

- V変形表示と初回CAF snapshotが一致する。
- 欄外RasterをClip Motionでframe内へ戻した時、Table previewとanimation exportが一致する。
- CAF merge / Folder mergeが負originと右下欄外pixelを失わない。
- oversized working restore失敗時もDrawingSnapshot正本をblankへ上書きしない。
- 旧Project、keyframe無しCAF、boundsなしDrawingSnapshotが従来表示と一致する。
