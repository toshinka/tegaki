# Phase 7h — Auto Shape alpha contour foundation

更新日: 2026-08-10
担当: Sol High / XHigh（Gate 0・pure geometry・review）、LUNA / MAX（GO後の限定UI adapter候補）
状態: CLOSED（Stage A〜E、SOL review 1〜5=`A`、Owner軽量実機受入済み）

## 1. Goal

一枚RasterをLayer分割せず複数BONEで動かすAuto Shape Meshへ進む前に、alpha実内容をdeterministicなisland / hole / contourへ変換する共有pure foundationを固定する。

Phase 7hはWARP PoseとSkin Bone Poseを統合しない。輪郭解析結果だけを将来のAuto Shape WARP / Skin Mesh generatorが別々に入力できるようにし、保存topology、weight、Frame Poseを共有しない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase7g.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/raster-bounds.js`
11. `tegaki_work/system/animation/raster-bone-auto-setup.js`
12. `tegaki_work/system/animation/raster-bone-skinning.js`
13. `tegaki_work/system/animation/raster-skin-render-plan.js`
14. `tegaki_work/system/animation/control-mesh-topology.js`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. SOL Gate 0候補比較

| 候補 | 判定理由 | 判定 |
|---|---|---|
| Auto Shape WARPを先に完成 | 既存POINT変形は活かせるが、複数PIVOTで一枚絵を動かすOwner本命へ直結せず、WARP Pose所有を先に増やす | 後順位 |
| Skin Meshへ直接Auto FILL保存 | 既存`meshDefinitions / skinBindings`へ接続できるが、輪郭、hole / island、vertex上限、再生成を同時に決める必要がある | Stage A後に再Gate |
| alpha輪郭解析だけを共有pure data化 | WARP / Skinの保存shapeを変更せず、LINE / FILL比較の入力とfixtureを先に固定できる | **Stage A選定** |
| Skin MeshとWARPのstatic topology共有 | stable vertex ID、再生成、手動修正、二重変形の所有が未確定 | `HOLD` |
| LINE Ribbonを先行 | 中心線、幅、分岐、主線判定がalphaだけでは一意でない | FILL比較後 |

### 判定: `GO`

- Stage AはRaster alphaを4-connected componentとpixel-cell境界loopへ変換するpure analyzerだけを追加する。
- outputはProject座標points、pixel座標points、outer / hole、winding、bounds、pixel / edge count。Projectへ保存しない。
- 4-connectedを採用し、角だけ接するpixelを別islandとする。alphaだけでLINE / FILLを自動決定しない。
- WARP / Mesh schema、SkinWeight、Bone、UI、History、renderer、STALE source signatureを変更しない。

## 4. Stage A — deterministic alpha contour analyzer

### 対象

- 新規`tegaki_work/system/animation/raster-alpha-contours.js`
- 新規`tegaki_work/build/verify-raster-alpha-contours.mjs`

### 契約

1. `alpha > threshold`だけをopaqueとし、4-neighborでislandを分ける。
2. opaque pixel cellの外周edgeを、opaqueを右側に保つ向きで接続する。outerは正、holeは負のscreen-space signed areaとする。
3. 連続する直線edgeはturn pointだけへ縮約し、各loopを上端・左端のcanonical pointから開始する。
4. Raster surface座標と`rasterBounds`からProject座標へ一度だけ写す。入力pixelとsnapshotを変更しない。
5. surface pixel数とboundary edge数に上限を持ち、巨大またはノイズ過多Rasterを理由付きで拒否する。
6. outputを保存正本、Mesh vertex ID、WARP point、SkinWeightとして扱わない。

### fixture

- rectangle、concave L、donut hole、複数island、diagonal-only contact、alpha threshold。
- Project offset / scale、outer / hole winding、area、canonical point順、非mutation、同一入力完全一致。
- invalid / empty / surface-too-large / boundary-too-complex。
- 4×4全65535 binary maskでopen boundaryなし、全contour signed area合計がopaque pixel数と一致する。

## 5. Stage A結果 / SOL review 1

### 判定: `A`

- 4-connected labelingとcomponent別edge traceを実装し、diagonal-only contactを混線させない。
- turn優先順位を固定し、holeを含む境界を閉loopとしてdeterministicに抽出する。
- 専用verifierの全fixtureに加え、4×4全65535 maskの面積不変条件を通過した。
- 保存field、EventBus、DOM、Canvas、Pixi、WARP / Skin evaluatorへ変更はない。
- 変更36 JS / mjsの`node --check`、全40 verifier、`npm.cmd run build`を通過した。build生成差分は清掃済み。

## 6. Stage B Gate

次は一枚の太い腕または髪束に対する`FILL` topology候補をpure dataで比較する。

- 候補A: contourだけをEarcut。透明外triangleは防げるが、内部support不足と長いtriangleで曲げ品質が低い。
- 候補B: contour + deterministic interior support。品質は上がるがhole回避、最小角、vertex 256上限が必要。
- 候補C: alpha-fit rect Gridを輪郭でclip。既存基盤を再利用できるが、輪郭supportとtriangle切断でstable vertex IDが増える。

Stage Bは保存・UIへ接続する前に、少なくとも太い腕FILL、donut hole、複数islandでvertex / triangle数、透明外triangle、最小角、既存Mesh schema受理を比較する。比較なしに`AUTO SHAPE` buttonを追加しない。

## 7. Stage B結果 / SOL review 2

### 対象

- 新規`tegaki_work/system/animation/auto-shape-fill-topology.js`
- 新規`tegaki_work/build/verify-auto-shape-fill-topology.mjs`

### 比較結果

| 候補 | fixture結果 | 判定 |
|---|---|---|
| contour-only Earcut | outer / hole / islandの面積と透明外除外は正確。太い腕24pxを4 vertex / 2 triangleで覆い、内部supportが不足 | 基準候補 |
| contour + interior support | Earcut triangle内部だけへgrid候補を挿入し、coverageを変えず最大triangle面積を縮小。256 vertex capを維持 | **次段選定** |
| alpha-fit rect Grid | donut 25px boundsのうち9透明px、concave形状のbbox外余白を覆う | Auto Shape FILLでは不採用 |

### 判定: `A`

- contourはcomponentごとにEarcutし、hole indexと複数islandを別triangle集合として維持する。
- interior supportは既存triangleの厳密な内部だけへpointを追加し、一triangleを三分割する。polygon外、hole、別islandへpointを追加しない。
- 太い腕ではcoverage 24を維持して最大triangle面積を縮小し、donutは期待面積16、複数islandは期待面積10と一致した。
- proof topologyをIDへ写した時、既存`meshDefinitions` validatorが新しい保存fieldなしで受理することを確認した。
- contour-only / interior-supportの両方を4×4全65535 binary maskへ適用し、失敗0、coverage error 0、vertex 256以下を確認した。
- 変更38 JS / mjsの`node --check`、全41 verifier、`npm.cmd run build`を通過し、build生成差分を清掃した。

ただし選定はproduction接続の`GO`ではない。pixel境界をそのままvertex化すると256上限へ達し、透明guard ringがない状態では変形時のedge sampling品質を保証できない。Stage Cでdeterministic contour reductionとguard ringを比較するまで保存・UIへ接続しない。

## 8. Stage C Gate

- outer / holeのtopologyを壊さないcontour reduction。RDP距離だけでself-intersectionやhole消失を起こさないこと。
- outer透明側とhole透明側のguard support。alpha輪郭とguardを同じvertex列として混同しないこと。
- boundary + guard + interiorを合計256 vertex内へbudget配分し、超過時は理由付きで拒否すること。
- source変更時は既存Alpha-fit Gridと同じ`STALE`原則を使い、明示再生成まで既存Meshを上書きしないこと。

Stage C review `A`後にだけ、既存Skin Mesh保存shapeへstable vertex IDとgenerator metadataを付けるpure factoryを検討する。Model mutation、History、UI接続はその次のGateとする。

## 9. Stage C結果 / SOL review 3

### 対象

- 新規`tegaki_work/system/animation/auto-shape-contour-budget.js`
- `tegaki_work/system/animation/auto-shape-fill-topology.js`
- 新規`tegaki_work/build/verify-auto-shape-contour-budget.mjs`

### 判定: `A`

- contour point削減は各候補ごとにwinding、simple polygon、hole包含、contour交差、総面積誤差を検査し、canonical startを維持する。RDP距離だけでは削減しない。
- outerは外側透明域へ、holeは内側透明域へguard contourを作り、miter上限、Raster bounds、source / guard交差、island間overlapを検査する。要求距離で成立しない場合は半減し、最小距離でも不成立なら理由付きで拒否する。
- boundary + 同数guard + reserved interiorを既存256 vertex上限へ配分し、guardとalpha境界を別vertex列・別triangle regionとして保持する。
- donut fixtureでopaque FILL面積16を維持し、guard triangle面積が外周拡張とhole縮小の幾何面積に一致する。既存Mesh validatorも受理した。
- padding不足、近接islandのguard overlap、不正budget、unsafe contour削減を明示拒否する。
- padding付き4×4全65535 mask監査はguarded topology成立23857、保守的`guard-overlap`拒否39338、`invalid-contour-topology`拒否2340で、成立ケースに予期しない失敗はない。

guard拒否時にguardなしMeshへ暗黙fallbackしない。self-touching境界を無言修復せず、今段階では理由付き拒否を正とする。

## 10. Stage D結果 / SOL review 4

### 対象

- 新規`tegaki_work/system/animation/auto-shape-raster-bone-setup.js`
- `tegaki_work/system/animation/raster-bone-auto-setup.js`の既存pure helper公開
- 新規`tegaki_work/build/verify-auto-shape-raster-bone-setup.mjs`

### 判定: `A`

- guarded FILL topologyを既存`meshDefinitions / skinBindings` shapeへ写すpure factoryを追加した。新しい保存field、Model mutation、History、EventBus、UI、renderer、Frame Poseは追加していない。
- stable vertex ID、既存最大2 distance influence、既存Bind Bone segmentを再利用し、既存Mesh / Skin validatorとinverse-bind LBS identityを通過した。
- 既存optional `generator` metadataへsource signature、content bounds、threshold、guard距離、boundary / guard / interior数、area errorを保持し、既存normalize / serialize round-tripで欠落しない。
- source signature一致は`current`、Raster更新は`stale`、別generatorは`manual`として判別する。STALE時に既存Meshを自動上書きしない。
- 固定`idFactory`で完全一致するdeterministic出力、Raster以外、missing layer、Mesh Boneなしの理由付き拒否を確認した。
- 変更43 JS / mjsの`node --check`、全43 verifier、`npm.cmd run build`を通過し、build生成差分を清掃した。Stage C / DはUI未接続のためBrowser対象操作はまだない。

Stage Dはproduction保存ではなく、保存shape候補を返すpure factoryまでである。Stage Eは既存Alpha-fit Gridを維持したまま、Model setter / History / Setup青UI / 明示再生成を一つの限定adapterとして接続できるか再Gateする。

## 11. Stage E契約

- Raster対象の既存`AUTO GRID`を残し、`AUTO SHAPE`を明示的な別生成modeとして追加する。既存Meshを開いただけで再生成しない。
- 初回生成と`STALE`後の再生成は、既存Mesh / Skinを一操作で置換し、Undo / Redoも一件にする。失敗時は既存Setupを維持する。
- `generator.type=auto-shape-fill-v1`だけをAuto Shapeとして扱い、manual / Alpha-fit Gridを暗黙移行しない。
- Setup青semantic、狭幅、touch hit areaを既存MESH導線で確認し、独立tab追加が過密ならRIG内submodeを優先する。
- Browserでは太い腕2 BONEで生成、Motion曲げ、STALE、明示再生成、Undo / Redo、Project reload、preview / playback / onion / Bake / export一致、console errorを確認する。

Stage EのModel / UI接続前に、現行setter、History境界、Alpha-fit status表示、Project serialize経路をSOLで監査する。監査結果が限定adapterへ収まる場合だけ実装を開始する。

## 12. Stage E結果 / SOL review 5

### 判定: `A`

- 既存`generateClipAssetRasterBoneSetup()`の既定Alpha-fit Gridを維持し、`generatorMode=auto-shape`の限定分岐と`generateClipAssetAutoShapeBoneSetup()`を追加した。対象RasterのMesh / Skin置換、validator、unsupported render boundary rollbackは既存経路を共有する。
- `getClipAssetRasterMeshStatus()`は`alpha-fit-grid-v1`と`auto-shape-fill-v1`を識別し、両方でCURRENT / STALEを返す。CAF複製、内部Raster複製、Project round-tripでもsourceを正しくrebaseする。
- CLIP MOTIONの既存Setup青RIG内へ`AUTO SHAPE`を追加し、独立MESH tabは増やしていない。`AUTO GRID`と並存し、現在modeだけ`GRID再生成` / `SHAPE再生成`へ変わる。statusは`GRID n×m`、`SHAPE FILL`、mode別`STALE`、`MANUAL MESH`を区別する。
- generationは既存CAF asset Historyへ一操作一件で記録する。History runtime stateへcapture時CURRENTだったRaster Mesh target IDだけを持ち、Undo / Redo後はCURRENTを復元する一方、編集済みの意図的STALEは無言で解除しない。Project保存fieldは追加していない。
- Browserで太い一筆Raster、2 Mesh Boneに対し`SHAPE FILL → GRID 4×8 → Undo SHAPE FILL → Redo GRID 4×8`を確認した。Raster追記は`SHAPE STALE`となり、`SHAPE再生成`でCURRENTへ戻った。
- 同fixtureでMesh Bone rotation key、playback、Timeline onionを操作し、console errorは0件。Model verifierではProject round-trip、CAF / Raster複製、LBS identity、normalize / serializeを通過した。
- 変更43 JS / mjsの`node --check`、全43 verifier、`npm.cmd run build`を通過し、`dist/` / `.vite/`生成差分とdev server logを清掃した。

### Owner軽量確認

- 透明余白のある一枚Rasterへ2本以上のMesh BONEを置き、`AUTO SHAPE`で見た目が欠けないこと。
- `AUTO GRID`との切替、Undo / Redo、Raster追記後`SHAPE STALE`、明示再生成。
- Motion PIVOTで曲げ、preview / playback / onion、Table close / reopen、console error。
- 可能ならProject save / reloadとBake / GIF / APNGを一件。Model / 共通render pathは検証済みだが、Owner制作Projectの実出力は未確認。

Ownerは2026-08-10に軽量確認`OK`を明示した。Phase 7hをcloseし、本書をArchiveへ移す。深い制作Projectの実出力は継続監視とし、LINE、manual topology / weight、WARP共有へclose条件を拡張しない。

## 13. 非対象

- WARP向けAuto Shape保存、Skin Meshとのtopology参照共有。
- weight brush、manual weight、複数BONE authoring変更。
- LINE / AUTO分類、centerline、Ribbon、線幅constraint。
- contour / guard手動編集、smoothing、physics。
- WARPとSkin Meshのtopology共有、WARP Pose / Bone Pose統合。
- clipping、Folder WARP、Rigid Partとの同時適用解禁。

## 14. 停止条件

- hole / islandを保つために解析段階から保存IDが必要になる。
- alpha scanだけで主線 / FILL分類を保存決定しないと進めない。
- 4-connected境界が通常Rasterで不安定となり、source pixel以外の正本が必要になる。
- contour出力をWARP / Skinへ同時保存しないと描画できない。

該当時はStage Bを止め、SOL Gate 0へ戻す。UIやschemaを先に追加しない。

## 15. 共通検証

```powershell
node --check tegaki_work/system/animation/raster-alpha-contours.js
node --check tegaki_work/build/verify-raster-alpha-contours.mjs
node tegaki_work/build/verify-raster-alpha-contours.mjs
node --check tegaki_work/system/animation/auto-shape-fill-topology.js
node --check tegaki_work/build/verify-auto-shape-fill-topology.mjs
node tegaki_work/build/verify-auto-shape-fill-topology.mjs
node --check tegaki_work/system/animation/auto-shape-contour-budget.js
node --check tegaki_work/build/verify-auto-shape-contour-budget.mjs
node tegaki_work/build/verify-auto-shape-contour-budget.mjs
node --check tegaki_work/system/animation/auto-shape-raster-bone-setup.js
node --check tegaki_work/build/verify-auto-shape-raster-bone-setup.mjs
node tegaki_work/build/verify-auto-shape-raster-bone-setup.mjs
Set-Location tegaki_work
npm.cmd run build
```

- 全`build/verify-*.mjs`。
- UI接続後はBrowser実操作とconsole error。
- build後に`git status --short --untracked-files=all`。
- `dist/`と`node_modules/.vite/`の生成差分を残さない。
