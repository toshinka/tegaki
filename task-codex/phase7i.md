# Phase 7i — Auto Shape LINE / Ribbon foundation

更新日: 2026-08-10
担当: SOL / XHigh（Gate 0・pure geometry・review）、LUNA / MAX（GO後の限定Model / UI adapter候補）
状態: OPEN（Stage A〜C完了、SOL review 1〜3=`A`、Stage D LUNA限定adapter準備済み）

## 1. Goal

Phase 7hのAuto Shape FILLを維持したまま、細長い腕・髪束・主線で曲げ時の線痩せ / 膨張を抑えるLINE / Ribbon候補を比較できるpure foundationを作る。

Phase 7iはRaster alphaからLINEを無言自動分類しない。`LINE`は将来の明示生成mode候補であり、Stage Aでは一つの単純なalpha islandからdeterministicなcenterline候補を抽出するだけとする。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `tegaki_work/GitHubURL.txt`（Web外部AIの入口。仕様正本ではない）
6. `開発用資料保管庫/Archive/phase7h.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/09_変形アニメーション・メッシュ・GPU画材ロードマップ.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `tegaki_work/system/animation/raster-alpha-contours.js`
12. `tegaki_work/system/animation/auto-shape-fill-topology.js`
13. `tegaki_work/system/animation/auto-shape-raster-bone-setup.js`
14. `tegaki_work/system/animation/raster-bone-auto-setup.js`
15. `tegaki_work/system/animation/raster-bone-skinning.js`
16. `tegaki_work/system/animation/raster-line-centerline.js`
17. `tegaki_work/system/animation/raster-line-ribbon-topology.js`
18. `tegaki_work/system/animation/line-ribbon-raster-bone-setup.js`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. SOL Gate 0候補比較

| 候補 | 判定理由 | 判定 |
|---|---|---|
| Deformer SELECT Stage 2 | runtime UIだけへ限定しやすいが、一枚Rasterの線幅保持というOwner本命への依存ではない | 後順位 |
| Text to Raster | 独立価値は高いが、Rig / Mesh系列を一度切る別機能 | 後順位 |
| Motion Graph read-only | 既存key正本で開始できるが、Auto Shape FILL受入直後のgeometry比較を中断する | 後順位 |
| Auto Shape LINE / Ribbon | Phase 7hで保留した中心線＋両側supportを同じalpha contour入力から比較できる | **選定** |
| manual topology / weight | History、選択、normalize、既存Animation保護を同時に決める必要がある | LINE topology後 |
| WARP / Skin topology共有 | Pose所有と二重変形が未解決 | `HOLD` |

### 判定: `GO`

- Stage Aは保存・Model・History・UI・rendererへ触れないpure centerline analyzerだけを追加する。
- 一つの4-connected component、holeなし、分岐なし、open pathだけを初期proofとして受理する。
- 複数island、hole、分岐、閉loop、点 / 短すぎるpathは理由付きで拒否する。自動FILL fallbackはしない。
- Stage Bでcenterline＋左右rail、幅sample、triangle品質を固定fixture比較するまではMesh保存へ接続しない。

## 4. Stage A — deterministic centerline candidate

### 対象

- 新規`tegaki_work/system/animation/raster-line-centerline.js`
- 新規`tegaki_work/build/verify-raster-line-centerline.mjs`

### 契約

1. alpha thresholdと4-connected island / hole判定はPhase 7hの`analyzeRasterAlphaContours()`を再利用する。
2. pixel maskをpadding付き作業bufferへ複製し、deterministicな二段thinningで1-pixel skeleton候補を作る。入力snapshotを変更しない。
3. graphはorthogonal edgeを優先し、同じ角を迂回できる冗長diagonalを採用しない。
4. endpoint 2、全node degree 1〜2、全skeleton node到達を満たすopen pathだけを受理する。
5. pathは上端・左端側endpointから順序化し、pixel centerとProject座標を返す。保存ID、Bone、weight、Mesh vertexとして扱わない。
6. thinning反復、surface pixel、centerline pointに上限を持ち、超過は理由付きで拒否する。

### fixture

- horizontal / vertical bar、L / bent stroke、Project offset / scale。
- branch、donut、multiple island、solid dot / square、empty / invalid、complexity limit。
- deterministic、non-mutation、endpoint、connectivity、Project mapping。

### Stage A結果 / SOL review 1

- padding付き複製maskへの決定的二段thinning、orthogonal優先graph、canonical endpoint順のopen pathをpure実装した。
- horizontal / vertical / bent stroke、Project offset / scale、非破壊、同一入力の決定性を固定した。
- multiple island、hole、明瞭なbranch、closed / too-short、empty / invalid、point / thinning上限を理由付きで拒否する。
- 保存shape、Model、History、UI、renderer、FILL / WARP出力は変更していない。
- 変更中の全50 JS / mjs `node --check`、全46 `verify-*.mjs`、`npm.cmd run build`を通過し、`dist/`生成差分を清掃した。Stage AはUI未接続のためBrowser対象外。

SOL review 1=`A`。Stage Bの三列Ribbon比較へ進める。ただし短く太い突起はthinningで消える場合があるため、Stage Bでrail交差・幅変化・形状coverageを受入Gateにし、Stage A単独結果を保存Meshへ接続しない。

## 5. Stage B — center + left / right rail topology

### 対象

- 新規`tegaki_work/system/animation/raster-line-ribbon-topology.js`
- 新規`tegaki_work/build/verify-raster-line-ribbon-topology.mjs`

### 契約と結果

- centerlineを均等stationへ再sampleし、両endpointを接線方向のalpha端まで延長してcapを作る。
- 各stationの法線両方向をalpha外までray走査し、`left / center / right`三列supportを明示する。
- 隣接stationごとに4 triangleを作り、全triangleを同じwindingへ正規化する。既存Meshの`vertices[] / triangles[]`shapeと互換で、新しい保存fieldを作らない。
- vertex budgetは三列単位で最大85 station / 255 vertex。長い線はstation間隔を決定的に広げ、256を超えない。
- cap / bent stroke、幅急変、rail outline自己交差、degenerate / 最小角、Project面積coverageを保存前Gateにする。失敗時にFILLへ自動fallbackしない。
- 同一RasterでPhase 7h FILLと同じProject-space alpha面積を比較基準にし、LINE / FILLをalphaから自動分類しない。
- static Mesh schema互換、非破壊、決定性を固定した。`meshDefinitions / skinBindings`、generator metadata、STALE、UI、rendererは変更していない。
- 変更中の全52 JS / mjs `node --check`、全47 `verify-*.mjs`、`npm.cmd run build`を通過し、`dist/`生成差分を清掃した。Stage BもUI未接続のためBrowser対象外。

SOL review 2=`A`。hard bendはrail自己交差、急な太さ変化は幅Gateとして理由付き拒否する。Stage B topologyだけでは曲げ後の線幅保持を受入れず、Stage CのRibbon専用weight / LBS比較前にproduction接続しない。

## 6. Stage C — longitudinal weight / LBS proof

### 対象

- 新規`tegaki_work/system/animation/line-ribbon-raster-bone-setup.js`
- 新規`tegaki_work/build/verify-line-ribbon-raster-bone-setup.mjs`
- 追補`analyzeRasterLineRibbonDeformation()`

### 契約と結果

- 2〜3本のdirect-chain BONEだけを受理し、branch、欠損、順序不明、centerlineから離れたBindを理由付きで拒否する。
- 各Bone segment midpointをRibbon centerlineの長手距離へ射影し、隣接anchor間をlinear blendする。各stationの`left / center / right`は同じ最大2 influenceを共有する。
- `AUTO_SHAPE_LINE_RIBBON_GENERATOR`候補を既存`MeshDefinition / SkinBinding`shapeへ写し、generator source、CURRENT / STALE、複製source rebaseもpure helperに留める。Modelへは未接続。
- 既存inverse-bind LBSで0° / 45° / 90°、2 / 3 BONE、random seekを固定した。45°は線幅誤差10%未満、90°は通常LBSの均一縮小を明示して最小幅ratio `0.65`をGateとする。
- 変形後のwidth collapse / 許容外ratio、triangle degenerate / inversion、outline自己交差をpure検査する。失敗時にFILLへ自動fallbackしない。
- FILL / LINEは同じ既存LBS evaluatorとProject保存shapeを使い、新しいPose、weight、Frame vertex正本を作らない。
- Stage C関連JS / mjsの`node --check`、全48 `verify-*.mjs`、`npm.cmd run build`を通過し、`dist/`生成差分を清掃した。UI未接続のためBrowser対象外。

SOL review 3=`A`。Stage Cはpure factory / evaluator proofまでで、`animation-data-model.js`、History、UI、rendererは未変更。通常LBSの90°中央縮小は既知の明示Gateであり、別evaluatorや補正Poseへ広げない。

## 7. Stage D — LUNA / MAX限定Model / UI adapter

### 対象候補

- `tegaki_work/system/animation/animation-data-model.js`
- `tegaki_work/ui/animation-table-popup.js`
- 関連verifier。pure Stage A〜Cファイルは原則変更しない。

### 実装契約

1. 既存`generateClipAssetRasterBoneSetup()`へ明示mode `auto-shape-line`を追加し、`createLineRibbonRasterBoneSetup()`だけを選ぶ。LINE / FILLを自動分類しない。
2. status / duplicate rebaseの既存dispatchへLINE generatorを追加する。新しい保存field、`isRigged`、第二Mesh / Skin collectionを作らない。
3. Setup青RIGの既存`AUTO GRID` / `AUTO SHAPE`を維持し、同じcontrols内へ明示`AUTO LINE`を追加する。LINEを単独tabやWARP modeにしない。
4. 2〜3 direct-chain BONE必須、branch / hole / multiple island / hard bend等のpure失敗理由をtoastへ限定表示する。失敗時は既存Meshを変更しない。
5. 生成 / 再生成は既存render-boundary rollback、一操作一History、CURRENT / STALE、CAF / Raster複製、Project round-tripを維持する。
6. preview / playback / onion / random seek / Table close-reopen、Undo / Redo、GRID / SHAPE / LINE相互再生成、console errorをBrowser確認する。

### 禁止

- pure閾値の調整、manual topology / weight、weight brush、Mesh専用tab、WARP共有、orientation補正、別LBS evaluator。
- UI都合でLINE失敗をFILL成功として扱うこと。

Stage DはLUNA / MAX向け限定adapter。実装後のaccept / close reviewはSOL / XHighで行う。

### Web外部AI向けhandoff

- `tegaki_work/GitHubURL.txt`を2026-08-10時点へ更新し、現行Phase、Stage D境界、Phase 6v〜7h経緯、Phase 7i pure実装 / verifier / 接続先をRaw URLで辿れるようにした。
- 全137 URLをローカル正本へ照合し、欠損0、重複0を確認した。URLは`main`を指すため、Webから新規Phase 7i fileを読むにはOwnerのcommit / push後であることを明記した。
- `GitHubURL.txt`はnavigationであり、判断が衝突する場合は`TEGAKI.md`、`PROGRESS.md`、本書、実コードを優先する。

## 8. 非対象

- LINE / FILL自動分類、人物全身・分岐骨格の自動解釈。
- branch graph、closed loop、複数islandを一つのRibbonへ結合する処理。
- manual topology / weight、weight brush、ControlHandle。
- WARP topology保存、WARP Pose / Bone Pose共有。
- physics、Text、Attachment、orientation / weightの新UI。

## 9. 停止条件

- simple open strokeでもdeterministicな単一路を得られない。
- 線幅保持にRaster解析とは別の保存正本がStage Aから必要になる。
- FILL Mesh、WARP、Skin Meshを同時変更しないと比較できない。
- branch / loopを無言切断しないと通常fixtureが成立しない。

該当時はStage Aを止め、LINE Ribbonを`HOLD`として別候補へ戻る。

## 10. 共通検証

```powershell
node --check tegaki_work/system/animation/raster-line-centerline.js
node --check tegaki_work/build/verify-raster-line-centerline.mjs
node tegaki_work/build/verify-raster-line-centerline.mjs
node --check tegaki_work/system/animation/raster-line-ribbon-topology.js
node --check tegaki_work/build/verify-raster-line-ribbon-topology.mjs
node tegaki_work/build/verify-raster-line-ribbon-topology.mjs
node --check tegaki_work/system/animation/line-ribbon-raster-bone-setup.js
node --check tegaki_work/build/verify-line-ribbon-raster-bone-setup.mjs
node tegaki_work/build/verify-line-ribbon-raster-bone-setup.mjs
Set-Location tegaki_work
npm.cmd run build
```

- 全`build/verify-*.mjs`。
- UI接続後だけBrowser実操作とconsole error。
- build後に`git status --short --untracked-files=all`。
- `dist/`と`node_modules/.vite/`の生成差分を残さない。
