# Phase 6u: WARP target auto-fit / point-map foundation

作成日: 2026-08-01  
状態: 完了（SOL review 2 `A`、Stage A / B close、Stage Cは後続Phase候補）
推奨分担: SOL XHighでGate設計・各Stage review、LUNA MAXで指定Stageだけを実装、Ownerが描画付き実機判定

## 1. 目的

WARP GRIDを新規作成した時、選択CAFまたはFolder配下の実描画alpha boundsへ初期GRIDの中心と大きさを合わせる。
続いて、同じWARP triangle代数でBind上の一点をPose上の一点へ写すpure point-mapを共有化し、将来の
「前腕WARPの手首へHAND PIVOTを追従」の保存Constraintを二重WARP正本なしで実装できるところまで基礎を固める。

Phase 6uで無条件に保存Constraintまで作らない。Stage B後のSOL Gate 1で評価順・保存場所・cycle境界が一意に
定まった場合だけStage Cへ進み、定まらなければStage A / BをcloseしてConstraintをPhase 6vへ再Phase化する。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6t.md`
6. `開発用資料保管庫/Archive/phase6s.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/raster-bounds.js`
11. `tegaki_work/system/animation/warp-grid-deformer.js`
12. `tegaki_work/system/animation/control-mesh-deformer.js`
13. `tegaki_work/system/animation/warp-placement.js`
14. `tegaki_work/system/animation/warp-grid-rasterizer.js`
15. `tegaki_work/system/animation/folder-part-render-plan.js`
16. `tegaki_work/system/animation/clip-deformer.js`
17. `tegaki_work/system/animation/animation-data-model.js`
18. `tegaki_work/ui/animation-table-popup.js`
19. `tegaki_work/styles/main.css`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの
`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. Gate 0監査結果

### 3.1 GRID初期bounds

- `_getWarpGridAssetBounds(entry)`は選択CAF / Folder subtreeとeffective visibilityを既に解決するが、
  alpha実内容ではなく各DrawingSnapshotの保存`rasterBounds`をunionする。
- `_getWarpGridInitialBounds(entry)`はRaster存在を確認した後、通常はCanvas全体`0,0,width,height`を返す。
  そのため小さいFolder描画でも初期GRIDがCanvas全体へ張られる。
- alpha実内容のProject boundsは既存`calculateOpaqueRasterBounds()`と
  `_getDrawingSnapshotContentBounds()`のcache経路があり、Rig PIVOT候補でも利用済みである。
- Folder対象は`collectInternalLayerSubtreeIds()`、visibility、unsupported nested target判定が既にある。
  新しいFolder探索、selected target state、bounds cacheを作らない。

### 3.2 WARP正本とpoint-map

- root WARP正本は`ClipInstance.deformer`、Folder WARP正本は`ClipInstance.folderDeformers`。
- topologyは`warp-grid-topology.js` / `control-mesh-topology.js`、Frame sampleとplacementは既存deformer samplerと
  `resolveWarpPlacementGeometry()`、Raster変形は`warp-grid-rasterizer.js`を使う。
- rasterizer内にtriangle / barycentric判定があるが、外部PIVOT用に同じ式をコピーしてはならない。
  Stage BではRasterとpoint-mapが共用する小さいpure helperへ抽出する。
- 現行順は`Folder subtree合成 -> Folder WARP -> Part/Bone matrix -> Folder opacity/blend -> root WARP -> root Motion -> Lane`。
  anchor追従はこの順を暗黙変更し、Rig評価器とFolder effect planの循環を作る可能性があるためGate 1が必要。

## 4. Stage A — 描画alpha boundsへの初期GRID auto-fit

対象:

- `tegaki_work/system/animation/warp-grid-deformer.js`または既存bounds moduleへ、DOM / model非依存の
  `fitWarpGridBindBoundsToContent()`相当を一つ追加する。
- `tegaki_work/ui/animation-table-popup.js`の既存target解決とsnapshot content-bounds cacheから呼ぶ。
- fixed 4x4 WARPと可変Control Meshの新規作成を同じ初期boundsへ接続する。
- 既存の明示的なBind再fitも同じcontent boundsを使う。GRIDを開いただけでは再fitしない。

初期bounds契約:

1. 選択CAFならeffective-visibleな全Raster internal Layer、Folderならそのsubtreeだけを対象にする。
2. 各DrawingSnapshotは保存`rasterBounds`ではなくalpha `> 0`のtight Project boundsを使い、既存cacheを再利用する。
3. union後、X / Yそれぞれ`max(4 Project px, ceil(axis length * 0.05))`の余白を足す。
4. 左上はfloor、右下はceilして決定的な整数Project boundsにする。negative boundsをCanvasへclampしない。
5. alpha実内容が空なら対象Rasterの保存`rasterBounds` unionへfallbackし、それも無ければ現行Canvas boundsを使う。
6. 既存surface limitで拒否し、巨大boundsを無言clampしない。

受入れ:

- 小さいFolderのGRID作成直後、GRID中心と外枠がそのFolderの描画物＋余白へ合う。
- CAF対象はCAF全体、Folder対象は選択subtreeだけを使い、別Folderの描画を含めない。
- hidden Layerを含めず、negative bounds、1px描画、空Folder、clippingを含むfixtureが決定的である。
- GRID SetupだけではRasterを動かさず、作成FrameのPose key、1 History、Undo / Redoを維持する。
- 既存GRID / key / placementはopen時に変更しない。明示再fitだけが既存Bindをrebaseする。
- Project schema、root / Folder WARP正本、key shapeを変更しない。

固定検証:

- `build/verify-warp-grid-auto-fit.mjs`を追加し、tight bounds、5% / 4px padding、negative、empty fallback、
  CAF / Folder target分離、fixed GRID / Control Meshの同一boundsを検証する。
- 既存Folder WARP、Project round-trip、partial composition、structured Bake verifierを再実行する。

Stage A実装（2026-08-01）: `warp-grid-deformer.js`へpureな
`fitWarpGridBindBoundsToContent()`を追加し、`animation-table-popup.js`の既存CAF / Folder target解決、
snapshot alpha bounds cache、surface validationへ接続した。新規fixed GRID、Control Mesh、明示refitは
描画内容＋5%または4px余白へfitし、empty targetは保存Raster bounds、最後にCanvas boundsへfallbackする。
既存GRIDのopen、Pose / LENS、deformer schema、key形状、保存正本は変更していない。
`build/verify-warp-grid-auto-fit.mjs`を追加し、tight / negative / 1px / empty fallback、fixed / Control Meshの
同一boundsを固定した。全25 verifier、node --check、build、Animation Table Browser smoke、console error 0件を通過した。

Stage A限定修正（2026-08-01）: `_getWarpGridBounds()`のraw unionと最終fit後surface validationを分離し、
surface上限超過をCanvas boundsへfallbackしないようにした。`verify-warp-grid-auto-fit.mjs`は既存
AnimationTablePopupのtarget / visibility adapterをDOMなしstubから直接呼び、CAF / Folder分離、clipped可視子、
hidden Raster / ancestor、巨大bounds拒否を固定した。全25 verifier、変更JSの`node --check`、build、生成物清掃を再実施した。

停止条件:

- content bounds取得のためにFrameをRaster合成し直す必要がある。
- DrawingSnapshot、ClipAsset、Folderに新しいbounds保存fieldが必要になる。
- 作成時auto-fitのために既存GRIDや別Folder targetを無言更新する必要がある。

## 5. SOL review 1

- target subtreeとvisibilityが既存adapterに一本化されている。
- alpha scan cacheを再利用し、pointermove / renderごとに全pixel scanしていない。
- padding / rounding / empty fallbackがpure helperとverifierで固定されている。
- Bind SetupとPose / LENSの正本境界、部分置換、root / Folder target境界を変えていない。
- `node --check`、関連verifier、build、Browser smoke、生成物清掃が完了している。

判定`A`でStage B、`B`で限定修正、保存shapeや合成順が必要なら`C`でGate 0へ戻す。

### SOL review 1結果（2026-08-01）: `B`

基本経路は契約どおりである。既存のFolder subtree / effective visibility adapter、snapshot alpha bounds cache、
新規fixed GRID / Control Meshの共通fit、既存GRIDをopenしただけでは変更しない境界を確認した。
ただしStage Bへ進む前に、LUNA MAXで次の2点だけを限定修正する。

1. `_getWarpGridBounds()`がunion後にsurface validationを行い、上限超過と「対象boundsなし」を同じ`null`へ
   潰している。その結果、巨大content / 保存Raster boundsがCanvas boundsへfallbackし得る。raw unionと
   最終fit後のsurface validationを分離し、上限超過は`_getWarpGridInitialBounds()`で明示的に拒否する。
   巨大boundsをCanvasへfallback / clampしてはならない。
2. `verify-warp-grid-auto-fit.mjs`はpure padding / fallback / fixed・Control Mesh同値を固定したが、計画した
   CAF / Folder target分離、hidden ancestor / hidden Raster、clippingを含むtarget fixtureが未固定である。
   既存target解決を第二正本へ移さず、AnimationTablePopupの既存adapterをstub fixtureから直接検証するか、
   同等に実経路を固定できる最小fixtureを追加する。少なくとも巨大bounds拒否も回帰検証へ加える。

限定修正では保存schema、WARP key、Control Mesh topology、合成順、UI DOMを変更しない。修正後は同じ
SOL review 1へ戻り、判定`A`までStage Bへ進まない。

### SOL review 1再判定（2026-08-01）: `A`

- raw unionをemptyとsurface上限超過で区別し、最終fit後の既存surface validationだけで巨大boundsを拒否する。
- verifierはproductionのAnimationTablePopup target / visibility adapterをstubから直接通し、CAF / Folder分離、
  clipped可視子、hidden Raster / ancestor、巨大bounds拒否を固定した。
- Stage A固有verifier、Folder WARP RenderPlan / Project round-trip、partial composition preview / CPU、
  structured Bakeを再実行し、node --check、全25 verifier、build、Browser smoke、生成物清掃の証跡と整合した。
- 保存schema、WARP key、Control Mesh topology、合成順、UI DOMへの追加変更はない。

Stage Aを受入れ、次はStage Bのpure point-mapだけをLUNA MAXへ渡す。

## 6. Stage B — WARP triangle point-map共有化

対象:

- Bind Project点から、既存topology上のtriangle indexとbarycentric weightを求めるpure helper。
- sampled deformer、既存placement、同じtriangle descriptorからPose Project点を返すpure helper。
- fixed GRIDとControl Meshの両方で、Raster pathと同じtopology / placement / epsilonを使う。
- rasterizerの既存triangle判定を小さく抽出し、Raster結果を変更せず共有する。

### SOL実コード監査による実装指定

- 現行の共通化対象は`warp-grid-rasterizer.js` privateの`TRIANGLE_EPSILON = 1e-8`と
  `getBarycentric()`である。`forEachTrianglePixel()`の半開pixel coverage、`ownsDirectedBoundaryEdge()`、
  premultiplied sampling / source-over合成はRaster専用のまま維持し、出力pixelを変更しない。
- 新規pure moduleは一つだけとし、triangle barycentric計算とBind Project点→Pose Project点mapを同居させる。
  `warp-grid-rasterizer.js`も同moduleの低水準barycentric helper / epsilonをimportし、同じ式を二重保持しない。
- point-map入力はplacement適用前のBind Project点、sampled deformerの`bindBounds` / `bindPoints` / `points` /
  `placement`、既存topologyの`triangles`とする。`resolveWarpPlacementGeometry()`でBind / Pose双方へ同じplacementを
  適用し、Bind側で得たtriangle index / barycentric weightsをPose側の同indicesへ適用する。
- fixed GRIDのtrianglesは`createRectGridTopology()`、Control Meshは保存済み`deformer.triangles`をそのまま使う。
  topology再生成、nearest triangle、outside clampを行わない。
- 成功結果は少なくとも`triangleIndex / indices / weights / point`を返す。失敗は`non-finite`、`invalid-topology`、
  `degenerate`、`outside`を呼出側が区別できるpureな明示結果とし、DOM / Timeline / Historyへ依存しない。
- triangle共有edge / vertexは保存triangle配列の先頭一致を採用し決定的にする。Rasterの半開pixel ownershipは
  seam防止の別責務なのでpoint-mapへ移さないが、barycentric式とepsilonは必ず共有する。

受入れ:

- identity、単一点移動、複数点移動、placement移動 / 拡縮 / 回転で既知点が一致する。
- triangle境界上のtie-breakが決定的で、outside / degenerate / non-finiteを明示結果で拒否する。
- DOM、Canvas overlay、TimelineModel、History、PIVOT、保存schemaを持たない。
- CPU Raster / Pixi mesh / Bake / exportの既存fixtureを一切弱めない。

固定検証:

- `build/verify-warp-point-map.mjs`を追加する。
- Raster fixtureと同じtriangle / placement入力を使い、point-mapだけ別の近似式になっていないことを固定する。
- identity、単一点 / 複数点Pose、vertex / 共有edge、outside / degenerate / non-finite、placementの
  移動 / 拡縮 / 回転、fixed GRID / Control Meshを固定する。

Stage B実装（2026-08-01）: `warp-triangle-point-map.js`へ`TRIANGLE_EPSILON`、
`getBarycentricWeights()`、`mapWarpBindPointToPose()`を追加した。既存`resolveWarpPlacementGeometry()`と
`applyWarpPlacementToPoints()`を使い、placement適用前のBind Project点をsampled Bind geometryへ合わせて
triangle index / barycentric weightsを決め、同じindicesのPose Project点へ写す。共有edge / vertexは保存triangle
配列の先頭一致、outside / degenerate / non-finite / invalid-topologyは明示結果とした。
`warp-grid-rasterizer.js`の既存private式はこのhelperへ移し、半開pixel coverage、edge ownership、premultiplied
合成は変更していない。`verify-warp-point-map.mjs`でidentity、単一点 / 複数点Pose、tie-break、失敗理由、
placementの移動 / 拡縮 / 回転、fixed GRID、Control Mesh、同一Raster fixtureを固定した。保存schema、DOM、
Timeline、History、PIVOT、anchor Constraintは未接続である。

### SOL review 2結果（2026-08-01）: `A`

- `warp-grid-rasterizer.js`はpoint-map moduleの`getBarycentricWeights()`と`TRIANGLE_EPSILON`を直接importし、
  旧private式を重複保持していない。
- Raster専用の半開pixel coverage、directed edge ownership、premultiplied sampling / source-over合成は差分がなく、
  既存Raster fixtureのbyte結果を維持した。
- point-mapはplacement適用前のBind Project点へ既存Bind重心placementを一度適用し、sampled Bindで決めた
  triangle index / weightsを同じsampled Pose indicesへ使う。topology再生成、nearest、outside clampはない。
- identity、単一点 / 複数点Pose、vertex / 共有edge先頭一致、明示失敗理由、placement、fixed GRID、
  Control Mesh、Raster同一triangle fixtureを固定した。
- DOM、TimelineModel、History、保存schema、PIVOT overlay、Constraintへの接続はない。
- 変更JS / mjsの`node --check`、全26 verifier、`npm.cmd run build`、生成物清掃を通過した。

Stage Bを受入れる。

## 7. SOL Gate 1 — anchor Constraintを同Phaseで続行する条件

次をすべて満たす時だけStage Cへ進む。

- source Folder WARPとdestination direct-child BONEがstable IDで一意に解ける。
- constraintのstatic relationを`ClipAsset.rigDefinition`へ置くか、ClipInstance固有関係として置くかを、
  CAF複製 / Clip複製 / asset共有の実コードに照らして一つに決められる。
- Folder WARP sample後のanchor pointをchild Bone worldへ渡しても、Bone評価とRenderIsland計画にcycleがない。
- root WARP / root Motion、別Folder WARP、既存FK / IK Pose Bakeとの適用順をpure fixtureで表現できる。
- copy / paste ID remap、削除拒否またはcascade、History、Project validationを既存helperへ接続できる。

一つでも満たさない場合、Phase 6uはStage A / Bでcloseし、Stage Cは設計を補ってPhase 6vへ送る。

### SOL Gate 1結果（2026-08-01）: `HOLD` — Phase 6u close

- source FolderはClipAsset内部Layer ID、destination BONEはrig IDで一意に参照できるが、source deformerは
  `ClipInstance.folderDeformers`、static Rigは`ClipAsset.rigDefinition`に分かれている。CAF asset共有・Clip複製時の
  Constraint所有を一つに決めるには、保存shapeと複製時意味論の追加Gateが必要である。
- 現行`createFolderEffectRenderPlan()`は`createFolderPartRenderPlan()`でBone worldを先に評価してからFolder WARPを
  sampleする。WARP後anchorでchild Bone worldを変えるには評価passを明示再設計する必要があり、同Phaseの小変更ではない。
- root WARP / root Motion、別Folder target、既存FK / IK Pose Bakeとの適用順を共有fixtureでまだ表現できず、
  sourceの子孫から祖先へ戻る参照やnested target cycleの拒否契約も未確定である。
- Constraint用のvalidation、copy / paste ID remap、削除境界、History setterは現行schemaに存在しない。

以上によりStage CはPhase 6uへ接続しない。Stage A / Bを完成成果としてcloseし、WARP anchor Constraintは
保存所有・評価順・cycle・remapを先に確定する後続Phase候補としてproposal 15へ残す。

## 8. Stage C候補 — 一つのFolder WARP anchorから直下子PIVOTへ追従

Gate 1が`GO`の場合だけ実装する。

- 一つのsource Folder WARP、Bind内の一anchor、一つのdirect-child BONEだけを対象にする。
- UIはWARP tabの明示的な`子PIVOT追従`から対象名を選び、Canvasへanchorと接続線を表示する。
- nearest PIVOT自動選択、複数子、祖先戻り、cross-CAF、nested WARP target、weight animationは実装しない。
- sampled pointはStage B helperだけを使い、PIVOT overlay専用座標や第二deformerを保存しない。
- playback / onion / random seek / save / reload / flatten / structured Bake / GIF / APNGで同じ評価結果を使う。
- 1操作1 History、CAF copy / paste ID remap、source / destination削除境界、cycle拒否を固定する。

## 9. LUNA MAXへ渡す共通実行指示

```text
あなたはPhase 6uから切り出された指定Stageの実装担当です。
指定Stageと明記された対象ファイルだけを変更してください。
先に既存target解決、content-bounds cache、deformer sampler、topology、placement、triangle代数を検索してください。
同義のbounds cache、selected target state、WARP正本、barycentric helper、PIVOT overlayを追加しないでください。
Stage Aでは保存schemaと既存GRIDを変更せず、新規作成と明示refitだけをcontent boundsへ接続してください。
Stage BではDOM / model / History / 保存schemaへ触れず、pure point-mapと固定fixtureだけを実装してください。
Stage CはSOL Gate 1のGOが明記されるまで着手しないでください。
計画外の合成順変更、Rig evaluator再構成、nested WARP対応が必要なら実装を止めて報告してください。
完了時は変更ファイル、node --check、全関連verifier、build、Browser確認、未解決、計画との差異を報告してください。
build後はdist/とnode_modules/.vite/の生成差分を残さないでください。
```

## 10. このPhaseで行わないこと

- WARP topology自動生成、Auto Mesh、SkinWeight、関節周辺の滑らかな曲げ。
- Deformer SELECT、soft selection、矩形 / 円 / lasso point選択。
- Effector target保存、non-destructive IK、stretch、rotation limit、Attachment / Space Switch。
- 複数anchor、constraint weight key、Pin、Follow、physics、Collider。
- nested Folder WARP、cross-boundary clippingの自動修復。
- 通常Layer選択 / V transform、外部paste / Canvas resize残件。
- Text、Motion Graph、WebGPU / SDF / MSDF。

## 11. 検証

- 変更した全JS / mjsへ`node --check`。
- Stage固有verifierと既存Folder WARP / Project / Bake / export verifier。
- `npm.cmd run build`。
- BrowserでCAF / Folder GRID作成、中心と大きさ、GRID再open、明示refit、POINT / BRUSH / LENS、
  Undo / Redo、save / reopen、preview / playback / onion、Animation Table同時使用、popup重なり、console error。
- 可能ならpen / touchでGRID handleと描画input leakを確認する。
- build後は`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
