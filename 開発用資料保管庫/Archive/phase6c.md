# Phase 6c: Warp GRID変形brush

更新日: 2026-07-22

## 緊急引継ぎ（2026-07-18）

Phase 6cは未完了。チャット移行時点で、GRID Bind枠をRasterから独立して移動するために導入した「元Rasterを維持し、Bind三角形領域を消去してWarp結果へ差し替える」部分WARP合成にマスキング不具合が残っている。直前までのBrowser確認だけで受入済みと扱わず、次チャットでは新機能追加より先にこの合成契約を再現・監査する。

### 次チャットの最優先

1. 既存差分を維持したまま、identity GRID、Bind枠移動、拡縮、回転、POINT変形、透明境界、枠がRaster外へ出る入力を小さな固定入力で再現する。
2. CPU/export側 `system/animation/warp-grid-rasterizer.js` と、Table preview側 `ui/animation-table-popup.js` の結果を比較する。
3. source領域の消去mask、destination mesh、三角形edge coverage、premultiplied alpha、Pixi RenderTexture上のerase blend、source/destination boundsのどこで不一致が生じるかを切り分ける。
4. GRID Bind編集は絵を動かさず、POINT / BRUSH poseだけが絵を変形する契約を守る。新しい運動正本や別mask正本を重複実装しない。
5. maskingがpreview、再生、Bake/exportで一致するまで、自由point、Bezier handle、Bone、physics、WebGPU化、追加UIへ広げない。

### 移行時の状態

- GRID内drag移動、四隅等比拡縮、上部handle回転、wheel拡縮、Shift＋wheel回転のUI経路は実装済みだが、マスキング不具合の影響範囲を再確認する。
- POINT / BRUSH、MOVE / INFLATE / PINCH / SMOOTH、B / N保持drag、局所P / M shortcutは既存差分として維持する。
- 変更JSの`node --check`、固定入力、`npm.cmd run build`は直前まで通過していたが、オーナー実機でのマスキング報告を優先し、視覚受入は未完了とする。
- `tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

### 部分WARP監査結果（2026-07-19）

- 白矩形と座標ずれの主因は、PixiJSの`renderer.render()`へsource Sprite / erase Graphicsをrootとして直接渡していたこと。render root自身の`position`と`erase` blendは通常のscene childと同じ形では評価されず、source copyは原点へずれ、erase用白fillは通常描画として残っていた。
- source copy、Bind triangle erase、destination meshをそれぞれ空Containerのchildとして描画し、同じProject座標transformへ統一した。mask色や別mask正本は追加していない。
- BindがRaster外へ出る場合はCPU sampleを透明とし、Pixi previewもsource RasterとBind範囲のunionへ透明1px paddingを持つtextureを作ってUV基準を揃えた。
- 固定入力でidentity、GRID移動、拡縮、回転は元Rasterと視覚一致した。POINT変形のCPU / Pixi差は最大2 channelで、移動・回転時の差はalpha 0 pixel下のRGBだけ。Raster外Bindと三角形edge seamで可視alpha差はない。
- 2026-07-22の追加固定入力で、透明／半透明sourceがBind外に残る不透明destinationへ重なる場合だけ、Pixi previewはsource-over、CPU/Bakeは直接上書きという差を検出した。CPUをsource-overへ統一し、共有triangle edgeは半開coverageで片側だけへ帰属させて半透明の濃い継ぎ目を防いだ。triangle内部の実際のself-overlapは複数回合成する。透明sourceはdestinationを消去せず、半透明赤128→不透明青は`[128, 0, 127, 255]`、identityはbyte一致する。
- Browserで局所GRIDの透明領域を既存図形へ重ね、preview・再生・5 Frame Bakeで下絵と外周を保持した。再生中overlay、B→BRUSH、Local F3操作による2個目の自動key、WARP tab再表示、console errorなしも確認した。animation exportはBakeと同じ`TimelineFrameCompositor` CPU経路を使う。Phase 6cの残りはB / N保持drag、pointercancel強制発生、各brush modeとGIF / APNG外周alphaのオーナー実機感触であり、自由point等へはまだ広げない。

### オーナー実機追記: GRID Setupと動くレンズ案（2026-07-19）

- 白mask消失と縮小GRID内の細密変形はオーナー実機確認済み。現在の`GRID`移動はClip Motionではなく、全Frame共通の`bindBounds / bindPoints`を変更し、static poseと全keyのpx変形差分をrebaseするSetup操作である。そのためWarp keyを削除してもGRIDの設定位置は残り、Tableを閉じるとidentity部分WARPなので元Rasterだけに見える。
- GRID中は青いBind格子、POINT / BRUSH中は橙のsampled pose格子だけを表示するため、画像5→6では歪みが消えたのではなく、表示対象だけがBindへ切り替わっている。現行コードの純粋固定入力でも、Bindを-200px移動後に80px / -40pxのkey差分を維持し、key全削除後はidentityへ戻る一方でBind位置は-200pxのまま残ることを確認した。
- 透明1px paddingはUV端clampを防ぐsampling面で、effect maskの余白ではない。見える境界はBind source triangle、pose destination triangle、外周point変形、bilinear alphaを分けて監査する。
- オーナー指示によりPhase 6d準備Sliceだけを先行し、Setup中は青いsource / Bind格子と橙のsampled destination格子を同時表示する。可変GRIDはWarp key 0件でもSetup編集を維持し、POINT / BRUSHは現在Frame keyがある時だけ有効にした。最後のkey削除／全key削除後はTopologyを消さずGRID Setupへ戻る。保存schema、Clip Motion、mask正本は増やしていない。
- 固定入力でBind移動後のProject px pose差分維持、zero-key sampling、4×4 dual overlayの16点 / 24 edgeと青Bind・橙pose座標分離を確認し、変更JSの`node --check`とbuildを通過した。Browser実操作はlocalhost URL policyで拒否されたため、key削除→Setup継続、B / N、pointercancel、consoleは受入未完了として維持する。
- 動くレンズのFrame配置はoptional placementを含むschema / sampling変更になるため未実装。`01_短中期ロードマップ.md`とproposal 09のPhase 6d後続候補を正本にする。

### オーナー実機追記: 局所Raster原点と操作境界（2026-07-22）

- `proposals/13_WarpGRID_CLIPMotion_座標系ズレ原因調査報告書.md`の指摘どおり、cropped `outputTexture` Spriteへ`outputBounds`位置を設定した後、Clip Motion適用がSprite自身をProject原点nodeとして上書きしていた。Warp SpriteをProject原点`Container`で包み、childだけを`outputBounds.x / y`へ置く。RenderTextureの所有印もwrapperへ移し、破棄契約を維持する。
- WARP選択中にoverlayが一時停止・選択解除されても、Canvas gestureをMotionへfallthroughさせない。再選択した`GRID / POINT / BRUSH`はoverlayを再構築し、Motion Canvas操作はMotion tabに限定する。GRID Setupは従来どおり全Frame共通Bind編集であり、Clip Motion keyを暗黙作成しない。
- Warp keyが1件以上あるSAMPLED FrameではPOINT / BRUSHを表示し、最初の実gesture開始時にsample poseから現在Frame keyを自動作成する。tabを開く／toolを切り替えるだけではkeyを作らず、pointercancel時は自動作成も含めgesture開始前のdeformerへ戻す。
- WARP tabの再生中もoverlayを表示し、eye buttonで表示だけを切り替える。編集入力は再生中無効のまま。`B`はWARP contextではBRUSH切替を優先し、B保持dragのSIZE変更契約は維持する。
- POWERは変形量の二重倍率ではなく0〜100のfalloff hardnessとする。0は中心から端へ強く減衰し、100はbrush内をほぼ均等に動かす。MODE説明はnative tooltip依存をやめ、control右側に表示する。
- 固定入力ではidentity CPU rasterizer最大差0、Bind負方向rebaseの全point差分維持、POWER 0で中心/半径50%/90%が`1 / 0.5 / 0.028`、POWER 100で`1 / 1 / 1`。BrowserではGRID作成、B切替、F3自動key、再生中overlay/eye、停止後GRID左上dragでMotion key 0維持、console error 0を確認した。
- 残る受入は、オーナー実データの局所Rasterと透明境界を使い、Table preview・再生・GIF/APNG/Bakeの位置と外周alphaが一致すること。動くレンズ用placement schema、自由point、Bone等へはこの受入前に広げない。

### オーナー受入追記（2026-07-22）

- GRID作成・移動時の座標ずれ解消をオーナー実機で確認した。残るWARP受入は透明境界、Raster外、source / destination部分重複、preview / playback / Bake / animation exportの外周alpha一致へ絞る。
- CLIP MOTIONを閉じても最後に選んだMotion / WARP tabをruntime中は保持し、再表示時に同じtabと既存overlayへ戻る。Project正本や設定保存へは追加せず、popup session stateだけで扱う。Browserで両tabのclose / reopen往復、WARPのまま再生 / 停止、overlay復帰、console errorなしを確認した。
- Layer構造保持Bakeと容量耐性はPhase 6cへ混ぜず、`01_短中期ロードマップ.md`とproposal 09の独立後続gateへ記録する。
- destination部分重複の追加監査では、CPU/Bakeだけが透明sampleを直接上書きしていたため、Pixi previewと同じsource-overへ修正した。局所GRIDの透明域を既存図形へ重ねるBrowser入力でpreview・再生・5 Frame Bakeの下絵保持を確認した。
- Warp / Motion Bakeは書き換え・付け足し用途を優先し、空いている既存Laneを再利用せず、専用のCAF列を最上段へ挿入する。元Clipは直下以降で非表示保持し、作成・順序変更・元Clip非表示を1 Historyに含める。Browserで5 Frame Bake後の上段新Lane／下段元Lane、Undoで新Lane消失、Redoで同じ順序へ復帰、console errorなしを確認した。
- Animation Tableの旧shortcutは旧Timeline UIへ送られていたため、現行popupと同じtoggle経路へ統一し、単押し`A`を割り当てた。`Ctrl/Cmd+A`はCanvas全選択として維持し、入力欄focus中とkey repeatではTableを切り替えない。将来のAnchor Pointへは未実装のままキーを予約せず、その機能を開くPhaseでWARP context限定または修飾keyを決める。
- Motion / WARP pointermoveが入力eventごとにPixi preview全合成とTable全DOM renderを同期実行していたため、previewだけをdisplay Frame単位へcoalesceし、DOM renderとHistory確定をpointerupへ送った。GRID / pose overlayはモデル値を毎Frame読むため追従性を維持する。WARP付き2 Frame CAFを3個へ複製して順次CLIP MOTIONを開閉し、最後のWARP tabと64点overlayが各CAFで復帰することを確認した。
- 初回Animation Table表示時は、未初期化Projectで既存LayerをClipAsset / DrawingSnapshotへseedする同期処理があり、単なるmodule初回読込だけではない。複数CAF crashの再現は未成立であり、512MB texture cache上限を根拠なく縮小せず、既存`getCafMemoryProfile({ force: true })`でDrawingSnapshot、clip raster、History、RenderTexture、texture cacheを計測してから独立容量gateで上限・GC・段階生成を判断する。
- 追加の資源寿命監査で、`removeChildren()`後の旧preview nodeはPixi RenderGroup都合で2描画cycle保持する一方、そのnodeが参照するsnapshot textureはlive containerだけを基準に即時破棄され得る不一致を確認した。遅延破棄queueもtexture保護集合へ含め、旧node破棄後にpending cache破棄をflushする。preview order、staging交換、上側Lane前面、保存正本は変更しない。
- 容量profilerへpending snapshot texture、WARP等のowned preview RenderTexture、preview build時間・state-key skip・最大遅延node数を追加した。8×8 WARPで30回のFrame切替／PREVIEW往復、Table・CLIP MOTION再表示3往復、POINT drag、64点overlay維持、console error 0をBrowser確認した。これは資源寿命経路の確認であり、複数CAF crash解消の受入ではない。次は大Canvas・多数Frame・多数内部Layerを固定した実データstressでCPU時間、hot runtime、History、texture cacheの増減を採取する。
- B / N保持dragとpose / Bind gestureの取消処理を共通rollbackへ集約した。popup終了、Motion tab切替、window blur、`pointercancel`、`lostpointercapture`で、gesture開始時のdeformerまたはSIZE / POWERへ戻し、取消操作をHistoryへ残さない。pointer capture解放は保持中だけ行う。
- 4 mode固定入力はPOWER 0 / 100、MOVE、INFLATE、PINCH、SMOOTHを通過した。Browserの8×8 GRIDでも各modeが実変形し、24 WARP CAF（8 Lane×3 Clip）を順次開閉して全てWARP tab / 64点overlayへ入り、72回Frame切替でcrashしないことを確認した。Clip範囲外へ移動後に戻るとtab / eyeだけ残りoverlayが復帰しない経路を検出し、停止中の有効Frameへ戻ったrenderで既存overlayへ再入場するよう修正した。
- 容量固定入力では400×400、24 Snapshot / 24 Asset / 8 Track×3 Clipとtexture cache / pending / owned preview RenderTextureをprofilerへ与え、hot runtime概算20.1 MBと全分類の集計を確認した。これは大Canvas・多数内部Layerの実制作上限を受入れた値ではない。
- GIF / APNG exporterはどちらも`TimelineFrameCompositor.renderFrames()`のCanvas列を使い、Warpやmaskの別正本を持たない。最終overlay再入場修正後のBrowser full reload / console再確認はBrowser側localhost URL policyで拒否されたため、オーナー実データのGIF / APNG外周alpha、B / Nペン感触、強制cancelとともに最終受入へ残す。
- 選択形状、sidebar / Quick Tool Panel整理、Text、CAF内部の階層Motion案は`proposals/14_UIツール導線・Text・階層Motion将来設計.md`へ分離した。Phase 6c masking / brush受入前には実装せず、selection shapeをWARP mask正本へ混ぜず、CAF内部へ再帰的なTimelineModelを作らない。

### 完了判定（2026-07-22）

- オーナー実機でGRID、POINT、BRUSH、B / Nを含む操作感に問題がないことを確認した。GIF / APNGも生成完了し、WARP由来のconsole error、白mask、座標ずれ、外周alpha欠損は再現しなかったためPhase 6cを完了とする。
- Consoleの`Popup "animationTable" not registered / not ready`は初期化途中にstatus表示が先行参照した警告で、その後`ready`へ到達していた。status表示はPopupManagerの登録Mapを副作用なしで参照し、未登録／初期化途中に`get()`の警告や再初期化を発生させない。
- `gif.js`の`willReadFrequently`警告は、複数Frameで同じ内部Canvasからreadbackする依存側経路だった。exporterで各Frameを`ImageData`へ一度だけ取得して渡し、依存packageを改変せず同じRGBA入力をWorkerへ送る。
- 新規GRIDをProject Canvas枠へ初期配置する要望はPhase 6dの最初のSetup改善として扱う。既存Project、既存GRID、再設定中のGRID、Raster正本は変更しない。

## 目的

Phase 6bで確定した固定4×4 Warp / 可変Warp GRIDのpose key正本へ、複数点をfalloff付きで操作する変形brushを追加する。直接point dragは既定操作として維持し、BRUSHは明示切替時だけ有効にする。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6b.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `tegaki_work/system/animation/warp-grid-topology.js`
10. `tegaki_work/system/animation/clip-deformer.js`
11. `tegaki_work/ui/warp-grid-overlay.js`
12. `tegaki_work/ui/animation-table-popup.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/` は調査・編集しない。

## Slice 0 — pure brush math

- screen-spaceのbrush center / radius / hardnessと各pointのscreen座標から0..1の決定的weightを返す。zoomによってProject上の見た目が変わらないよう、hit radiusはscreen-spaceを正本にする。
- `deform`はpointerdownからのProject座標deltaへweightを乗じる。毎pointermoveで直前結果へ加算せず、gesture開始poseから再計算する。
- `inflate / pinch`はbrush中心または影響点の加重重心をpivot候補とし、距離0、weight 0、全点範囲外を有限値で処理する。
- `smooth`は矩形Grid topologyのedge adjacencyを参照する。DOM順やoverlay線からneighborを推測しない。
- pure関数はClip、History、DOMを参照しない。固定4×4、4×8、最小2×2、radius境界、hardness 0/1、負originを固定入力化する。

### 実装状況

- `system/animation/warp-grid-brush.js` にscreen-space weight、開始pose基準の移動、加重重心、膨張 / 絞り、topology neighborによる整形を純粋関数として追加した。
- radius外、hardness 0 / 1、weight合計0、pivot上の点、負origin、4×8 GRIDを固定入力で確認した。Project正本、History、DOM、rendererには未接続。
- 次はSlice 1のPOINT / BRUSH明示切替とgesture controllerへ進む。pointerup 1 Historyとcancel復元を先に閉じ、brush種類の追加はその後とする。

## Slice 1 — POINT / BRUSH UIとgesture

- WARP下段に`POINT / BRUSH`を明示切替する。SELECTは複数点契約と同時に別Sliceで追加し、最初から空buttonを置かない。
- 通常POINTSはふたば橙を維持する。BRUSH cursor / influence previewはふたばpalette内の別調子とし、青緑・白黒・browser既定focusを追加しない。
- brush sizeはvisible controlとwheelを先行し、`B`保持dragはCanvas pan / Raster brush shortcutとの競合監査後に追加判断する。
- pointerdown時に開始poseと対象keyを固定し、pointermoveはpreview、pointerupは既存deformer keyへ1 History、pointercancel / capture喪失は開始poseへ復元する。
- SAMPLED Frameでは暗黙keyを作らない。keyなし、再生中、popup close、Motion tab切替ではbrushを開始しない／終了する。

### 実装状況

- `POINT / BRUSH`をWARP contextへ追加し、POINTは従来の単点drag、BRUSHはscreen-space円形weightによる複数点移動へ接続した。半径は12〜240pxのvisible inputとwheelで変更する。
- `GRID`はRaster transformではなく局所Bind範囲編集とする。元Rasterを維持し、Bind mesh領域だけを消去してWarp結果へ差し替えるため、枠の移動・拡縮・回転だけでは絵を動かさない。枠内dragは移動、四隅handleは等比拡縮、上部handleは回転、wheelは拡縮、Shift＋wheelは5°回転とし、各gesture / wheel burstを1 Historyへまとめる。
- BRUSHはpointerdown時のpose / weightを固定し、pointermoveごとに開始poseから再計算する。pointerupだけを1 History、pointercancel / capture喪失は開始poseへ復元する。
- keyを全削除した可変GRIDは、再設定UIと既存status / 補間 / Bake actionを同時表示せず、540pxのcompactな再設定状態へ切り替える。
- Browserで8×8 GRID、POINT / BRUSH切替、80px円形cursor、key削除後の540px再設定表示、key再追加後の64点overlay復帰を確認した。次は実dragのUndo / Redoとcancelを実機確認し、inflate / pinch / smoothのUIを順次追加する。
- BRUSH時だけ`MOVE / INFLATE / PINCH / SMOOTH`を展開し、SIZE 12〜240px、POWER 5〜100%をvisible controlへ接続した。`B`保持dragはSIZE、`N`保持dragはPOWERを横方向で調整し、WARP BRUSH外では既存shortcutへ介入しない。
- 4 modeともgesture開始poseから再計算し、pointerup 1 History、cancel復元を共通にする。ToonSquid型POINT曲線handleは別deformer Phase候補としてproposalへ送り、矩形GRID schemaへ混ぜない。
- Live2Dの重み可視化を参考に、BRUSH cursorは不透明塗りを廃止して外周ring＋中心点とし、操作中だけ各GRID pointのweightをふたば赤系の濃淡で示す。MOVEはpointer経路へ追従する逐次変形、Shift＋横dragは開始中心を固定して右を膨張・左を収縮とする。
- `P`（POINT）と`M`（BRUSH mode切替）は既存pen等と競合するため、WARP key編集中だけ先取りする局所shortcutに限定する。
- Browserの8×8 GRIDで4 modeを実dragし、各1 History、MOVEのUndo / Redo、mode切替、key全削除後のoverlay終了とcompact再設定表示を確認した。B / N保持dragのペン実機感触とpointercancel強制発生はオーナー確認へ継続する。
- 高密度GRIDは縁なしの小さな橙pointと淡い格子線へ変更し、weight可視化はpointごとの大円ではなく連続した薄い赤field＋小点濃淡とする。各mode selectは選択内容に同期するtooltip / ARIA説明を持つ。
- Table previewのWarp GPU Meshは表示sceneへ残さず、一時Meshから通常Sprite用RenderTextureへ同期bakeする。source Mesh / Textureは二描画周期後に破棄し、WARP編集後のstrokeでPixiJS `GlMeshAdaptor`が破棄済みresourceを参照してCanvas tickerを止めない。
- `GRID / POINT / BRUSH`を明示切替する。GRIDは局所CAFのWarp対象を絞るBind枠編集で、青系表示、drag移動、Shift＋横drag回転、Shift＋縦drag等比拡縮とする。Bind変更はstatic pose / 全keyのProject px変形量を維持して1 gesture 1 Historyへ閉じる。枠外Rasterを無変形で合成し直す部分effectは本Sliceへ混ぜず、顔・眼球等を別CAFにした局所Warpを対象とする。
- Table closeは先に`isVisible=false`へ遷移し、Motion window cleanupのrenderでPREVIEWを再適用しない。Motion / Warp設定後のworking Layerを復元したまま閉じ、thumbnailだけ残ってCanvas表示が消える状態を作らない。

## 維持する境界

- 保存するのは確定後のWarp GRID pose keyだけ。stroke列、weight配列、brush cursor、size / hardness設定をProject正本にしない。
- Raster pen / eraser / airbrush、Motion X/Y、Layer Transformへ代理書込みしない。
- 固定4×4 Warp v1、可変GRID内部`control-mesh`互換、Project / Bake / exportを変更しない。
- working Layer、preview staging交換、preview container順、上側Lane前面、PSD record順、Lane / Timeline onion display-only境界、Folder clippingに触れない。
- 自動三角Mesh、Bone、physics、Shape Morph、WebGPU rendererはPhase 6cへ混ぜない。

## 検証

- 変更JSの`node --check`。
- pure brush固定入力とcancel / 1 Historyを確認する。
- BrowserでPOINT直接drag、BRUSH変形、Undo / Redo、Frame移動、再生、popup close、Project復元、Bake / export、console errorなしを確認する。
- `npm.cmd run build`後、`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
