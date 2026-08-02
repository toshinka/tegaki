# Phase 6v: static Raster Mesh / Bone Skinning core

作成日: 2026-08-01  
状態: 完了（2026-08-02、SOL最終判定 A）  
実施分担: SOLでGate / schema review、LUNAで限定実装、SOLでPhase 6v〜6y統合diff review

## 1. 目的

一つのCAF内部Rasterへ複数BONE PIVOTを置き、同じRasterのTriangle MeshをBone回転へ追従させる将来機能のうち、
最初の責務だけを実装する。

Phase 6vの到達点は次に限定する。

- ClipAssetに属するoptionalなstatic Mesh / SkinWeight正本を一つ定義する。
- 既存`evaluateRigidBones()`のBind / current world matrixから、2D linear blend skinning結果を返すpure evaluatorを一つ作る。
- 一枚の固定入力Raster相当のMeshと三つのBoneで、identity、親子回転、weight境界、random seekを証明する。
- 旧Project、MeshなしProject、現行Rigid Folder、WARPのpixel / 保存shapeを変えない。

Canvas描画、Pixi Mesh、CPU rasterizer、RIG UI、自動Mesh生成はPhase 6vへ混ぜない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/GOAL_LEDGER.md`
6. `開発用資料保管庫/Archive/phase6u.md`
7. `開発用資料保管庫/Archive/phase6t.md`
8. `開発用資料保管庫/Archive/phase6s.md`
9. `開発用資料保管庫/proposals/00_計画索引.md`
10. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
11. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
12. `tegaki_work/system/animation/animation-data-model.js`
13. `tegaki_work/system/animation/part-rig.js`
14. `tegaki_work/system/animation/control-mesh-topology.js`
15. `tegaki_work/system/animation/warp-grid-topology.js`
16. `tegaki_work/system/animation/warp-grid-rasterizer.js`
17. `tegaki_work/system/animation/control-mesh-rasterizer.js`
18. `tegaki_work/system/animation/folder-part-render-plan.js`
19. `tegaki_work/system/animation/timeline-frame-compositor.js`
20. `tegaki_work/system/animation/internal-layer-clipping-contract.js`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの
`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. Gate 0結果

判定は`GO`。ただし`task-codex/goal-next-checkpoint.md`の停止条件に従い、Gate 0を行ったGoal内では製品実装を開始しない。

### 3.1 現行構造

```text
ClipAsset
  internalLayers[] ---------------------- Raster / Folderの保存正本
  rigDefinition
    parts[]
    bones[] ----------------------------- static Bind Pose / hierarchy
    rigidBindings[] --------------------- 一つのFolder Partを剛体追従

ClipInstance
  transform / transformKeyframes -------- CAF root Motion
  rigMotion.boneTracks[] ---------------- BoneのFrame Pose key
  deformer / folderDeformers ------------ WARP Bind / Pose / placement

evaluateRigidBones()
  -> bind/current Bone world matrix

Control Mesh / WARP
  -> topology生成、triangle raster adapterは存在
  -> static Skin Mesh / SkinWeight正本は存在しない
```

### 3.2 目標構造

```text
ClipAsset
  internalLayers[]
  rigDefinition.bones[]
  meshDefinitions[]? -------------------- Raster target / bind vertices / triangles
  skinBindings[]? ----------------------- Mesh vertex -> Bone weight

ClipInstance
  rigMotion.boneTracks[] ---------------- 既存のまま

evaluateRigidBones()
  -> currentWorld * inverse(bindWorld)
  -> evaluateSkinnedMeshVertices() ------- pure、Frame stateを保存しない
```

`meshDefinitions` / `skinBindings`は最終名ではない。Stage A開始時にClipAsset直下のoptional static Setup正本として
確定し、`rigDefinition`、Control Mesh deformer、WARP keyへ同じ値を複製しない。

## 4. 再利用するmodule

| 既存module | 再利用する責務 | 再利用しない責務 |
| --- | --- | --- |
| `part-rig.js` | Bone normalize / validation / remap、`evaluateRigidBones()` | Mesh / weightを`rigidBindings`へ詰めない |
| `animation-data-model.js` | ClipAsset serialize、asset duplicate、subtree ID map | UI selectionを保存しない |
| `transform-math.js` | affine invert / multiply / point変換 | 第二のmatrix型を作らない |
| `control-mesh-topology.js` | deterministic Delaunay、rect topology | ClipInstance Pose正本をSkin Meshへ流用しない |
| `warp-grid-rasterizer.js` | 後続Phaseのtriangle data / CPU raster adapter | Phase 6vでは描画接続しない |
| `folder-part-render-plan.js` | 後続PhaseのBone current / bind評価 | Raster MeshをFolder rigid bindingへ偽装しない |

## 5. Plan A / Plan B

### Plan A — ClipAsset static Mesh + SkinWeight（採用）

- Meshは一つのCAF内部Rasterのstable `internalLayerId`をtargetにする。
- Bind vertexとtriangle topologyはClipAssetのstatic Setup。Frameごとの変形頂点を保存しない。
- SkinWeightもClipAssetのstatic Setup。Bone Poseは既存`ClipInstance.rigMotion.boneTracks`だけが所有する。
- 各Boneのskin matrixは`currentWorld * inverse(bindWorld)`。各bind vertexをweight付きで合成する。
- 0 influenceはbind位置、weightはfiniteかつ0以上、合計は1へ正規化できる値だけを受け入れる。
- Mesh / Bone / Raster参照、vertex / triangle topologyをvalidationとcopy / paste remapで明示的に扱う。

長所: Setup / Animateが分かれ、同じCAF Assetを複数ClipInstanceで別演技に使える。Control Mesh / WARPと正本が重ならない。  
短所: 新しいoptional保存shapeとHistory / remap / validationが必要。

### Plan B — 既存Control Mesh PoseをBoneで駆動（不採用）

- 既存`ClipInstance.deformer` / `folderDeformers`のPose pointへBone結果を書き込む。

不採用理由:

- static Bind MeshとFrame PoseがClipInstance側へ混ざる。
- 手動WARP keyとBone Skinningが同じpointを二重所有する。
- 同じAssetを複数ClipInstanceへ置いた時、Setup共有と演技分離が成立しない。
- preview / exportで評価順を分岐しやすい。

### 縮退案

schema / clipping / remapを一意にできない場合は、現行のFolder分割＋rigid BONEを維持する。
Control MeshやWARPへSkinWeight相当を仮保存して進めない。

## 6. Stage A — static modelとpure evaluatorだけ

### 6.1 保存候補の最小形

Stage A開始時に実コードへ合わせて命名を確定する。最低限、次の関係を保持する。

```text
MeshDefinition
  meshId
  targetInternalLayerId       # Rasterだけ
  vertices[]                  # vertexId + bind Project x/y
  triangles[]                 # stable vertex参照3個
  generator                   # optional。UI stateやalpha cacheではない

SkinBinding
  meshId
  vertexWeights[]
    vertexId
    influences[]              # boneId + weight
```

制約:

- 一つのRasterへPhase 6vでは最大一Mesh。一つのMeshは一Rasterだけをtargetにする。
- `targetInternalLayerId`はRasterでなければ拒否する。
- duplicate ID、dangling vertex / Bone、退化triangle、非finite座標、負weight、全0 weightを無言修復しない。
- 0 influenceのvertexはidentityとしてbind位置へ残す。influenceがある場合は正規化後の合計を1とする。
- 最大influence数はStage Aで4。超過は切り捨てずvalidation errorにする。
- optional field欠損はMeshなしとして読み、serialize時も空配列を旧Projectへ強制追加しない。
- topology / weight変更はAsset Setup History。Bone Pose keyやWARP Historyへ混ぜない。

### 6.2 pure skinning代数

```text
bindWorld(bone)    = evaluateRigidBones(asset, null, frame).worldMatrix
currentWorld(bone) = evaluateRigidBones(asset, clip, frame).worldMatrix
skinMatrix(bone)   = currentWorld(bone) * inverse(bindWorld(bone))
poseVertex         = sum(weight * transformPoint(skinMatrix, bindVertex))
```

- evaluatorはDOM、Pixi、Canvas、TimelineModelを変更しない。
- random seek可能なstateless評価とする。前Frame結果、dense vertex sample、GPU bufferを正本にしない。
- exact opposite rotationでの2D linear blend collapseはMVPの既知特性とし、別補間方式を同時実装しない。

### 6.3 固定入力

`build/verify-raster-bone-skinning.mjs`相当を追加し、少なくとも次を固定する。

1. Mesh field欠損assetは旧serialize形状とrigid FK結果を変えない。
2. 4列×2行のstrip Mesh、一枚Raster target、肩・肘・手首の3 Boneを使う。
3. bind == currentでは全vertexがbit-levelでidentity。
4. 肩90度で子・孫領域が同じ階層worldへ追従する。
5. 肘だけの回転では肩側weight 1のvertexが不動、境界weight 0.5が両Bone結果の中間になる。
6. 手首回転は手首側vertexだけへ効き、別Raster / 別Meshへ漏れない。
7. 0 influence、weight正規化、最大4 influence、dangling Bone、NaN、負weightを検証する。
8. 順次Frame評価とrandom seekが一致する。
9. Asset duplicate / subtree copyでRaster target、mesh、vertex、Bone参照が同じID mapにより整合する。
10. normalize -> serialize -> restoreのProject round-tripでstatic Mesh / SkinWeightと既存Bone Poseを保持する。

## 7. Phase 6vの非対象

- Raster / Pixi / CanvasへのMesh描画接続
- preview / playback / onion / thumbnail / Bake / export接続
- RIG tabへのMesh、Bone、weight編集UI
- 同一Rasterへ複数Mesh、Folder target、nested Mesh
- alpha解析による自動生成、Auto Contour、LINE / FILL判定、Ribbon
- 自動weight、weight brush、manual smooth / mirror
- WARP anchor constraint、Attachment / Space Switch
- IK target track、stretch、rotation limit
- MeshとWARPの同時適用順
- WebGPU、SDF / MSDF、Perform、Dynamics、physics

## 8. 後続Phase分割

### Phase 6w候補 — fixed Raster Mesh render proof

- Phase 6vの一Meshを一つの非clipped Rasterへ限定して描画する。
- `createTriangleMeshData()` / `warpRgbaWithTriangles()`をadapterとして再利用する。
- `Raster Skinning -> 現行clipping -> Folder WARP -> Bone / Part -> root WARP -> root Motion`を候補順とする。
- Pixi preview / playback / onionとCPU compositor / Bake / exportへ同じevaluated vertexを渡す。
- clipping owner / sourceに参加するRasterは最初のproofで明示unsupported。無言で未変形描画しない。

### Phase 6x候補 — one Raster / multi-PIVOT authoring

- RIG tabでRaster targetへPart rigid bindingなしの複数Boneを作る。
- Canvas上で肩・肘・手首等のPIVOTを配置し、既存parent接続とBone Pose keyを再利用する。
- Mesh binding対象名を明示し、Folder PIVOTとMesh BoneをUI上で混同しない。

### Phase 6y候補 — Alpha-fit Auto Grid / auto distance weight

- 既存alpha content boundsへdeterministic rect / strip gridを生成する。
- 初期MVPは`Alpha-fit Grid`と呼び、輪郭外triangle除去やhole対応を行う`Auto Contour`と偽らない。
- Bone segment距離から最大2 influenceの初期weightを生成し、結果確定後はstatic Setupとして固定する。
- source Raster変更時は`STALE`表示だけを行い、明示再生成までtopology / weightを上書きしない。

### 後続研究

- LINE向け3列Ribbon、FILL向け輪郭 / island / hole保持、Poisson / 六角格子比較。
- weight brush、smooth、lock、mirror、joint volume維持。
- WARPとの合成順、Mesh上のWARP anchor、limited stretch。

## 9. SOL review項目

- ClipAsset static SetupとClipInstance Frame Poseが分離されている。
- `rigidBindings`、Control Mesh、WARPへMesh / weightを重複保存していない。
- optional field欠損で旧Project pixel / serialize形状を変えない。
- normalize / validation / serialize / Project / History / duplicate / subtree copyが同じschemaを扱う。
- bind/current Bone matrixの順序とProject座標が既存`evaluateRigidBones()`と一致する。
- invalid topology / ID / weightを無言修復しない。
- verifierがidentity、親子回転、weight境界、random seek、round-tripを固定する。
- Stage Aに描画adapter、UI、自動生成が混入していない。

判定`A`でPhase 6v close後にPhase 6w Gateへ進む。`B`はStage A内の限定修正、`C`はGate 0へ戻す。

## 10. 検証

Stage A実装時:

```powershell
node --check tegaki_work/system/animation/<new-static-mesh-module>.js
node --check tegaki_work/system/animation/animation-data-model.js
node --check tegaki_work/build/verify-raster-bone-skinning.mjs
Set-Location tegaki_work
node build/verify-raster-bone-skinning.mjs
npm.cmd run build
```

加えて既存Part / Bone / Project round-trip / CAF copy verifierを再実行する。build後は`dist/`と
`node_modules/.vite/`の生成差分を残さない。Phase 6vはUIを変えないためBrowser実機は不要だが、Phase 6wでは必須とする。

## 11. 停止条件

- Mesh / SkinWeightをControl Mesh、WARP、rigid bindingへ重複保存しないと進められない。
- Raster stable ID、Bone ID、Mesh / vertex IDのremapを一意にできない。
- optional field欠損をMeshなしとして扱えない。
- current / bind matrixの順序をCPU / Pixi共通にできない。
- topology変更が既存Animation / manual weightを無言破壊する。
- Phase 6v内で描画接続、clipping解決、Auto Contour、UI実装が必要になる。
- 新しい依存package、WebGPU、外部serviceが必要になる。
- 無関係な既存差分と安全に分離できない。

停止時は推測実装せず、`GOAL_LEDGER.md`と`PROGRESS.md`へ完了点・未完了・必要判断を記録する。

## 12. Owner確認項目（Phase 6w以降）

- 一枚腕Rasterへ肩・肘・手首PIVOTを置く操作が、三枚Folder方式より明確か。
- 親回転と子回転の境界で腕の太さ・線幅・関節の折れが許容できるか。
- `Alpha-fit Grid`の初期密度で曲げが十分か、より細かいGrid / Ribbonが必要か。
- 自動weight後に手動修正が必要な頻度。
- pen / touchでPIVOT配置、親接続、対象切替が誤操作なく行えるか。

## 13. Closeout

Phase 6vは指示書のStage Aを満たし、後続Phase 6w〜6yも同一Goal内で限定実装してcloseした。

- Phase 6v: `ClipAsset.meshDefinitions / skinBindings`、validation、serialize / restore、duplicate / subtree remap、pure inverse-bind LBS。
- Phase 6w: 一つの非clipped Rasterへ共通`raster-skin-render-plan.js`を介してPixi preview系とCPU compositor / Bake / exportを接続。
- Phase 6x: RIG / MOTIONのRaster target、Part / rigid bindingを持たない複数Mesh BONE、Canvas PIVOT、既存parent接続とBone key。
- Phase 6y: alpha内容boundsのdeterministic Grid、最大2 distance influence、`STALE`表示、明示`GRID再生成`、duplicate時source rebase。

SOL reviewではstatic Setup / Frame Pose分離、旧Project optional形、ID remap、Project round-trip、random seek、
CPU / Pixi共通頂点、unsupported境界を確認した。全29 verifier、変更JS / mjsの`node --check`、
`npm.cmd run build`、BrowserでAnimation Table開閉、未設定Raster初回RIG、Raster target / `＋ BONE` / `AUTO GRID`導線、
空Raster拒否、console errorなしを受入れた。実機テストによる一時HistoryはUndoで0/500へ戻した。

初期proofのため、clipping owner / source参加Raster、active Folder WARP / rigid RenderIsland内Rasterは明示unsupported。
manual weight、weight brush、Auto Contour、LINE Ribbon、Mesh Bone IK、SkinとWARPの同時適用は後続Goalが開くまで非対象とする。
