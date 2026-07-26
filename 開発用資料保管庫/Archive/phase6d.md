# Phase 6d: Warp GRID Setup / Lens配置animation

完了日: 2026-07-26

## 現在地

- Phase 6cはオーナー実機でGRID / POINT / BRUSH、B / N、GIF / APNGを受入れ、完了記録を`開発用資料保管庫/Archive/phase6c.md`へ移した。
- 現行GRIDは全Frame共通の`bindBounds / bindPoints`を編集するSetupであり、Warp keyやClip Motionではない。POINT / BRUSHはFrameごとのdestination pose keyを編集する。
- Phase 6d Slice 0として、新規固定4×4 / 可変GRIDの初期BindをProject Canvas枠へ変更した。既存Project、既存GRID、再設定時の現在Boundsには遡及しない。
- Slice 1で既存Warp keyへ省略可能な`placement { x, y, scale, rotation }`を追加した。旧keyの欠損は保存上も欠損のまま、sampling時だけidentityとして扱う。固定4×4 / 可変GRID、HOLD / LINEAR、Project round-trip、copy / paste、terminal retiming相当の固定入力を通過した。
- Slice 2でplacementをCPU reference rasterizerへ接続した。source erase Bindとdestination Poseは`resolveWarpPlacementGeometry()`の同じBind重心affineで解決し、identityは旧経路とbyte一致、移動だけでは絵を動かさず、pose併用時だけ移動先の部分WARPへ作用する。
- Slice 3でPixi previewへ同じ配置済みsampleを接続した。source texture bounds、erase mesh、source UV、destination meshは`resolveWarpPlacementSample()`の一組のgeometryだけを使い、placementを二重適用しない。
- Slice 4でWARP toolへ`LENS`を追加し、現在Frame keyのplacementだけをCanvas上で移動・uniform拡縮・回転できるようにした。POINT / BRUSHは配置後の表示座標を逆変換して既存pose keyへ書き戻す。
- Slice 5でTimelineModel全体のProject JSON round-tripを固定入力へ追加した。BrowserではLENS移動＋POINT変形した5 Frame ClipをBakeし、Bake前後のCanvas cropがPNG byte一致、最上段Lane生成、元Clip非表示保持、APNG / GIF 5 Frame preview Blob生成、console warning / errorなしを確認した。
- Animation Table初期化途中のstatus warningと、`gif.js`の反復Canvas readback warningをアプリ側境界で抑制した。依存packageは変更していない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6c.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `tegaki_work/system/animation/clip-deformer.js`
10. `tegaki_work/system/animation/warp-placement.js`
11. `tegaki_work/system/animation/control-mesh-deformer.js`
12. `tegaki_work/system/animation/warp-grid-rasterizer.js`
13. `tegaki_work/ui/animation-table-popup.js`
14. `tegaki_work/ui/warp-grid-overlay.js`

## 目的

全Frame共通のSetupと、Warp key内で部分変形場を移動するLens placementを明示分離する。固定Raster上を移動する歪みレンズのように、source Bind triangleとdestination pose triangleを同じaffine placementで動かす。

## 最初の実装Slice

1. 現行deformer sampling、copy / paste、retiming、History、Project round-tripを固定入力化する。
2. Warp keyへ省略可能な`placement { x, y, scale, rotation }`を加える純粋normalization / samplingを先行する。欠損時はidentity。
3. placementはBind centroidをpivotにsource Bindとdestination poseへ同じ変換を掛け、Clip MotionやRaster全体を動かさない。
4. rotationはscalar補間し、point座標のlinear補間による中間Frame縮みを避ける。
5. CPU rasterizer固定入力を通した後だけPixi previewとCanvas gestureへ接続する。

## Slice 1-4実装結果 / 次の入口

- `warp-placement.js`を純粋helperとし、欠損identity、正のuniform scale、radian rotation、scalar LINEAR補間、Bind点のProject座標重心をpivotとするaffine変換を定義した。
- 固定4×4 Warp v1と可変`control-mesh`のkey normalization / list / samplingが同じplacement契約を共有する。旧keyへ保存時にidentity fieldを付け足さない。
- POINT / BRUSH key更新、Warp key copy / paste、reset、retiming、`ClipInstanceModel.serialize()`はplacementを同じkey metadataとして維持し、専用trackを作らない。
- `node tegaki_work/build/verify-warp-placement.mjs`でlegacy欠損、identity、移動、拡縮、回転、HOLD / LINEAR、中心affine、4×4 / 可変GRID、Project round-trip、copy / paste、retime相当を固定した。
- `node tegaki_work/build/verify-warp-placement-rasterizer.mjs`でsampled key、identity byte一致、移動、拡縮、回転、pose併用、透明境界、Raster外、source / destination部分重複、固定4×4 / 同Topology可変GRIDのCPU byte一致を固定した。
- CPU/export側は`TimelineFrameCompositor -> sampleClipDeformer() -> warpRgbaWithTriangles()`の既存一経路でplacementを評価する。
- Pixi previewは`resolveWarpPlacementSample()`でruntime sampleを一度だけ解決し、texture範囲、source erase triangle、UV逆写像、destination triangleへ同じ配置後Bind / Poseを渡す。`verify-warp-placement-preview.mjs`でidentity、移動、source UV、erase Bind、destination Pose、固定4×4 / 同Topology可変GRID一致を固定した。
- `invertWarpPlacementPoint()`を純粋helperとして追加し、LENS移動後もPOINT / BRUSHが配置前pose座標へ確定されるようにした。LENS操作は空の現在Frameなら既存Warp keyを自動作成し、pointerup / wheel burstごとにTimeline History 1件、cancel時は自動keyを含めて開始deformerへ戻す。
- BrowserでLENS移動40×20px、wheel拡縮、rotation handle回転、POINT 18×9px編集、各Undo / Redo、再生中overlay維持、595px panel横溢れなし、console warning / errorなしを確認した。
- Browserでplacement＋poseのBake前後400×400 cropが同一PNG byte列となること、Bake列が最上段Laneへ入り元Clipを非表示保持すること、APNG / GIFが各5 Frameのpreview Blobを生成することを確認した。Projectは`TimelineModel.serialize() -> JSON -> new TimelineModel()`の全体round-tripでplacement / pose / interpolationを固定した。
- 外部Projectファイルの実保存・再読込と、オーナー実機pen操作・部分WARP境界をオーナー側で確認し、Phase 6dを完了した。新しいtrackやmask正本は追加していない。

## 維持する契約

- 旧Project、key無しCAF、固定4×4 Warp v1、既存可変GRIDはplacement欠損をidentityとして読む。
- GRID SetupだけではRasterを動かさない。POINT / BRUSH poseとLENS placementだけがWARP結果を変える。
- 元Rasterを維持し、配置後Bind triangleを消去して配置後destination triangleをsource-over合成する。
- 新しいMotion track、mask正本、placement専用trackを作らない。
- preview、playback、Bake、GIF / APNGは既存deformer samplingと`TimelineFrameCompositor`を共有する。
- working Layer、preview staging交換、preview container順、上側Lane前面、PSD record順、Lane / Timeline onion、Folder clippingに触れない。

## 後続gate

- `EDGE LOCK`は移動レンズpresetの境界候補。通常Warpの外周自由変形を壊さず、fuzzy maskや保存maskを追加しない形で別Slice判断する。
- Layer構造保持Bakeと大Canvas・多数Frame・多数内部Layerの容量耐性はPhase 6dへ混ぜず、proposal 01 / 09の独立Phaseへ送る。
- 自由point、Bezier handle、Bone、physics、WebGPU renderer、追加選択UIはplacement一致後まで開始しない。

## 検証

- identity / 移動 / 拡縮 / 回転placement、pose併用、透明境界、Raster外、source / destination部分重複。
- CPU / Pixi preview / playback / Bake / GIF / APNG一致。
- Project round-trip、copy / paste、reset、HOLD / LINEAR、retiming、Undo / Redo。
- 変更JSの`node --check`、固定入力、`npm.cmd run build`、Browser実操作、console error確認。
- build後に`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
