# Phase 7d — 表示階層とRIGの分離・Rig Part安全Gate

更新日: 2026-08-09
担当: Sol High / XHigh（境界設計、共有RenderPlan、pure Gate、限定UI接続、各review、最終判定）
状態: CLOSED（実装・SOL final review=`A`・Owner受入完了）

## 1. Goal

CAF内部Layerの表示階層とRig親子を別の関係として維持し、単純な一枚絵にもFolder作成を強制せずRigを設定できるようにする。同時に、表示階層移動でRigが動かす描画所属を無言変更しない安全Gateを置く。

本Phaseの初期対象は次の二種類だけ。

- `Folder Part`: 明示登録したFolderと、その排他的な描画subtreeを一つのGroup Partとして扱う。
- `Root Raster Part`: `parentLayerId == null`のCAF直下Raster一枚だけをLeaf Partとして扱う。

Folder内の通常RasterはFolder Partの描画内容であり、個別Rigノードとして自動登録しない。表示階層を根拠に`parentPartId` / `parentBoneId`を作成、解除、再接続しない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase7c.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
9. `tegaki_work/system/animation/part-rig.js`
10. `tegaki_work/system/animation/folder-part-render-plan.js`
11. `tegaki_work/system/animation/raster-skin-render-plan.js`
12. `tegaki_work/system/animation/animation-data-model.js`
13. `tegaki_work/system/animation/internal-layer-clipping-contract.js`
14. `tegaki_work/system/animation/timeline-frame-compositor.js`
15. `tegaki_work/ui/animation-table-popup.js`
16. `tegaki_work/ui/layer-panel-renderer.js`
17. `tegaki_work/styles/main.css`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. SOL Gate 0改訂結果: `GO`

### 3.1 分離する三つの関係

1. 表示階層
   - 正本は`ClipAsset.internalLayers[].parentLayerId`と配列順。
   - 描画順、Folder整理、visibility / opacity / blend、clippingを決める。
2. Rigグラフ
   - 正本は`rigDefinition.parts[].parentPartId`、`bones[].parentBoneId`、`rigidBindings`。
   - Bone / Part Motionの伝播だけを決める。
   - 表示階層D&Dでは変更しない。
3. 描画所属
   - Folder Partは表示subtreeから排他的RenderIslandを派生する。
   - Root Raster Partは自分一枚だけをRenderIslandとする。
   - reparent前後でこの所属が変わる場合は、Rigリンクが同じでも制作結果が変わるため安全Gate対象とする。

### 3.2 現行コード監査

- `partId`はすでにCAF internal Layer IDであり、`parts` schema自体はFolder種別を保存していない。
- `animation-data-model.js`の`registerClipAssetFolderPart()` / `registerClipAssetRootBoneBinding()`がFolderを明示必須にしている。
- `folder-part-render-plan.js`はPart targetをFolderに限定し、Folder subtreeを排他的RenderIslandへ割り当てる。
- preview / compositorは主に`islandByLayerId`を読むため、一枚だけのRaster islandへ一般化できる。ただしFolder WARP、clipping、Raster Skinningとの二重適用を同じ共有planで固定する必要がある。
- Raster Mesh / SkinはすでにRasterをtargetにするが、これはper-vertex変形であり、Rigid Leaf Partとは別modeである。

結論: 新しい`targetKind`、`isRigged`、Layer path、Rig group IDを保存せず、参照先Layerのtypeと`parentLayerId`からPart target kindを導出する。

### 3.3 初期Part target契約

#### Folder Part

- targetは`type == 'folder'`。
- 現行どおり最も近い登録PartへRasterを排他的に割り当て、nested Partの二重変形を防ぐ。
- Folder自身の表示親が変わっても、`parentPartId` / `parentBoneId`は変えない。

#### Root Raster Part

- targetは`type == 'raster'`、`parentLayerId == null`、backgroundではない一枚。
- RenderIslandは`Set([partId])`で、自分以外のLayerを所有しない。
- rigid binding、Bone Motion、Part Motionは既存schema / evaluatorを再利用する。
- RasterをFolderへ入れる操作はRoot Raster Part契約を外れるため、初期Phaseでは理由付き拒否する。自動Folder Part化や自動Rig解除は行わない。
- 同じRasterをRigid Leaf PartとMesh / Skin targetへ同時登録しない。初期Phaseでは`rig-mode-conflict`として拒否する。

#### 複数キャラクター

- 同一CAF内に複数root Bone / Part treeを持てる現行forestを維持する。
- 表示Folderをキャラクター識別子にしない。接続されていないRigグラフの連結成分はUIで将来グループ表示できるが、本Phaseでは保存`rigGroupId`を追加しない。
- Timelineや再利用単位も独立させる場合は別CAFを使う。

## 4. 階層移動の新しい判定

「Rig済みLayerなら拒否」ではなく、移動前後の有効描画所属を比較する。

### 許可

- 同一親内のbefore / after並べ替え。
- unrigged subtreeのreparentで、全Rasterの有効Part owner、Folder WARP owner、clipping contractが移動前後で同じ。
- Folder Part自体のreparentで、そのPart islandとnested exclusive island、clipping contractが変わらない。
- 許可時もRig親子、binding、Motion keyは一切変更しない。

### 初期拒否

- Root Raster PartをFolderへ入れる。
- Raster / subtreeがFolder Partへ入る、またはFolder Partから出て、有効Part ownerが変わる。
- Folder WARP targetへの出入りでdeformer対象が変わる。
- clipping owner / sourceの関係またはRenderIsland分断状態が変わる。
- Raster rigid PartとMesh / Skin modeが衝突する。
- source subtree内drop、cycle、missing target等の既存invalid move。

拒否はAsset、Clip、working Layer、snapshot、selection、`updatedAt`、Historyを変更する前に行う。表示移動を理由にRigリンクを解除・再接続しない。

## 5. 実装分担と順序

### SOL Batch 1 — Part target一般化と共有RenderPlan

担当: `gpt-5.6-sol / xhigh`

同じ正本・行列・render consumerを連続して判断するため、ここはLUNAへ分割しない。pure target helperだけを別担当にすると、引き継ぎ確認コストが実装量と同等になるためSOLがまとめて処理してよい。

対象:

- 必要なら新規`tegaki_work/system/animation/rig-part-target.js`
  - `resolveRigPartTarget(asset, partId)`。
  - Folder / Root Raster / unsupported / conflictをpureに分類する。
- `tegaki_work/system/animation/part-rig.js`
  - schemaを増やさず、既存Part / Bone評価を共有する。
- `tegaki_work/system/animation/animation-data-model.js`
  - Folder専用setterを互換wrapperとして残し、Folder / Root Raster共通の登録adapterを追加する。
- `tegaki_work/system/animation/folder-part-render-plan.js`
  - 一つのgeneric Rig Part planを正本にする。
  - Folderは排他的subtree、Root Rasterは一枚の`layerIds`を返す。
  - `islandByPartId` / `islandByLayerId`を共通mapとし、`islandByFolderId`と既存exportはFolder互換adapterとして維持する。
  - Folder / Rasterでworld matrix式を分岐実装しない。
- `tegaki_work/system/animation/timeline-frame-compositor.js`
- `tegaki_work/ui/animation-table-popup.js`のpreview consumer
- 必要なCPU / Pixi / Bake consumer
- 新規`tegaki_work/build/verify-raster-rigid-part-render-plan.mjs`

固定検証:

- 旧Folder Part fixtureと全既存verifierが不変。
- CAF直下Raster一枚をPart + root Boneへbindingし、identity / translation / rotation / scaleがpreview planとCPU compositorで一致。
- playback / onion / random seek / structured Bake / save-reload / CAF copyで同じmatrix。
- root Motion / root WARPは後段で一度だけ適用。
- Root Raster Partは他Layerを所有せず、Folder Partとのnested二重変形を起こさない。
- Mesh / Skin、Folder WARP、clipping競合は無言fallbackせず明示unsupported。
- 旧ProjectとRig無しProjectの保存shapeを変更しない。

### SOL review 1

判定`A`まで階層移動GateとUIへ進まない。

- 新規保存field / schema versionを追加していない。
- Folder / Rasterで別matrix evaluatorを作っていない。
- preview / compositor / Bakeが同じislandを使う。
- Raster Skinningとの二重適用を黙認していない。
- 既存Folder Part / Folder WARP / WARP anchorを壊していない。

結果（2026-08-09）: `A`

- `rig-part-target.js`でFolder / CAF直下Rasterを保存fieldなしに分類し、Folder専用登録APIは互換wrapperとして維持した。
- generic Rig Part planはFolderの排他的subtreeとRoot Raster一枚を同じPart / Bone world matrixで`islandByPartId` / `islandByLayerId`へ返す。既存Folder export、preview、Canvas compositorは同じplanを消費する。
- Root Raster rigidとMesh / Skinの競合は登録順の両方向で`rig-mode-conflict`をmutation前に返し、Project読込済み競合もrender planで明示`unsupported`にする。
- `verify-raster-rigid-part-render-plan.mjs`でidentity / translation / rotation / scale、Bone binding、random seek、Bake、bounds、CPU compositor、save / reload、CAF copy、Mesh競合を固定した。
- 変更JS / mjsの`node --check`、全34 `verify-*.mjs`、`npm.cmd run build`を通過し、build生成差分を個別清掃した。UI入口はBatch 2まで追加していないため、このreviewではBrowser操作を行っていない。

### LUNA Batch 1 — pure reparent preflight

担当: `LUNA / MAX`

SOL review 1=`A`後の限定実装。

対象:

- 新規`tegaki_work/system/animation/internal-layer-reparent-gate.js`
- 新規`tegaki_work/build/verify-rigged-internal-layer-reparent-gate.mjs`
- 必要な場合だけ`animation-data-model.js`のread-only adapter

契約:

- DOM / History / EventBusへ依存しない。
- `asset`、参照ClipInstance群、source / target / placementを入力に、移動後parent mapをmutation無しで仮構築する。
- 各Rasterの有効Part owner、Folder WARP owner、clipping contractをbefore / afterで比較する。
- `display-only`、`rig-render-owner-change`、`raster-part-root-required`、`folder-warp-scope-change`、`clipping-contract-change`、`rig-mode-conflict`、既存invalid moveを安定したreason codeで返す。
- 同一親reorderと安全なunrigged reparentを許可する。
- 拒否時non-mutationを固定する。

LUNAは自動Rig解除、確認dialog、schema追加、render plan変更へ広げない。必要になった場合は停止してSOLへ返す。

### SOL review 2

- effective owner比較が表示祖先だけをRig親と誤認していない。
- 全参照ClipInstanceのFolder WARPを検査している。
- clippingだけの通常移動を過剰拒否していない。
- reason codeと利用者文言を分離している。
- reject前にmodel mutationが無い。

結果（2026-08-09）: `A`

- `internal-layer-reparent-gate.js`は現行moveと同じ配列順・parent結果をclone上に構築し、入力Asset / Clipを変更しない。
- 同一親reorderを先に許可し、reparentだけ全RasterのPart owner、全参照ClipのFolder WARP owner、clipping contractをbefore / after比較する。
- `display-only`と各拒否reason codeをUI文言から分離し、TimelineModelにはread-only preflight adapterだけを追加した。
- 分担境界を再説明するコストが実装量と同等だったため、Owner許可に従いSOLがBatch 1相当を続けて実装した。

### LUNA Batch 2 — 限定UI接続

担当: `LUNA / MAX`

SOL review 2=`A`後に進む。

対象:

- `tegaki_work/ui/animation-table-popup.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- 必要な場合だけ`tegaki_work/ui/ui-icons.js`
- `tegaki_work/styles/main.css`

接続:

- D&Dと上下移動を同じpreflightへ通す。preflightはworking Layer保存、History capture、`updatedAt`変更より前。
- 許可時だけ既存move / History経路を使う。拒否理由は既存feedback toastで表示する。
- CAF直下RasterへFolderを作らず`+RIG`できる最小入口を追加する。
- 明示登録されたFolder Part / Root Raster PartだけにSetup青の連結node icon + `RIG` chipを表示する。
- Folder内の通常Rasterへchipを並べない。保存flagではなく既存正本から導出する。
- tooltipは`Folder Part` / `Raster Part` / `Mesh Rig`の内訳を`ui-help-tooltip` + `data-tooltip` + `aria-label`で示す。単独`R`、native `title`、black / white / neutral grayを追加しない。
- 新Event、modal、大幅DOM置換を行わない。

### SOL final review

- Stage外変更、正本重複、History、matrix、RenderIsland、clipping、copy / save互換をreviewする。
- Browser受入と全verifier後、Owner実機へ渡す。

結果（2026-08-09）: `A`

- Root Raster / Folder共通`+RIG`入口、root Bone binding、Rig track、Part canvas geometryを既存Rig正本とgeneric RenderPlanへ接続した。
- D&D / 上下移動はworking Layer保存・History capture前に同じpure Gateを通り、拒否時は安定reason codeを日本語toastへ変換する。許可時だけ既存1 History経路を使う。
- Layer Panelは明示PartだけにSetup青の連結node icon + `RIG` chipを表示し、Folder内通常Raster、保存`isRigged` flag、単独`R`を追加していない。
- BrowserでFolder無しRoot Raster RIG、chip、Root RasterのFolder内drop拒否（History不変）、同一親reorder（1 History）、Undo / Redo、Table close / reopen、playback、Timeline / Lane onion、console errorなしを確認した。
- Root Raster / Folder plan、random seek、CPU compositor、Bake、save / reload、CAF copy、Mesh競合、display-only reparent、全Clip WARP scan、reject non-mutationはverifierで固定した。変更JS / mjsの`node --check`、全35 `verify-*.mjs`、`npm.cmd run build`を通過し、build生成差分を個別清掃した。
- unrigged Rasterの通常Folder間D&D、GIF / APNG、深い制作Project、pen / touchはOwner実機側の残受入とする。Owner受入前なのでPhaseはcloseしない。

Owner限定追補（2026-08-09）:

- CLIP MotionのCanvas captureは、他のMotion / Part / Bone / WARP gestureが未開始でmodifierも無いplain Space + left pointerだけを既存`CameraSystem`へ委譲する。新しいCamera state、座標計算、History、保存fieldは追加しない。
- Spaceなしの通常Canvas dragはMotion X / YとHistoryを更新し、Undoで復元する既存経路をBrowserで確認した。Browser CUAはdrag中に非modifierのSpaceを保持できないため、Space分岐、modifier、button、開始済みgestureの競合条件は`verify-clip-motion-canvas-camera-yield.mjs`で固定し、実Space + dragはOwner実機確認へ残す。console errorは0件。
- 変更JS / mjsの`node --check`、全36 `verify-*.mjs`、`npm.cmd run build`を通過した。PhaseはOwner受入待ちのままcloseしない。
- Owner実機でplain Space + dragのCanvas移動を受入れた。残受入はPhase 7d本体のunrigged display-only D&D、深い制作Project、save / reload、CAF copy、GIF / APNG、可能ならpen / touchとし、この確認だけではPhase全体をcloseしない。

### Close判定（2026-08-09）

- Ownerが既存発展を了承し、Phase 7dを締めて次Phaseへ進むよう明示したためcloseする。
- SOL final review=`A`、全36 verifier、build、限定Browser、plain Space + drag実機受入を完了した。保存field追加、Rigリンク自動解除、暗黙再接続は行っていない。
- 深い制作Project、unrigged display-only D&D、save / reload、CAF copy、GIF / APNG、pen / touchは継続監視とし、再現時だけ限定回帰Phaseへ戻す。これらを理由にPhase 7dをOPENへ戻さない。

## 6. Browser受入

- 単純なCAF直下Raster一枚へFolder無しでRIG登録し、PIVOT / Bone Motionが反映される。
- Folder PartとRoot Raster Partを同じCAFで使い、別root treeとして独立操作できる。
- Root Raster Partの同一親reorderは成功し、Rig参照を維持する。
- Root Raster PartをFolderへ入れるdropは理由付き拒否され、Asset / Clip / selection / Historyが不変。
- unrigged Rasterを通常Folder間で移し、有効Part / WARP / clipping ownerが変わらない場合は1 Historyで成功しUndo / Redoできる。
- Folder Partへの出入りで描画所属が変わるdropは理由付き拒否する。
- Animation Table表示中 / 閉鎖後CAFでPanel順、active / selected / working IDが一致する。
- save / reload、CAF copy後もRIG chipを既存正本から再導出する。
- preview / playback / onion / random seek / Bake / GIF / APNGでFolder / Raster Partが一致する。
- 通常Layer D&D、name編集、visibility、clipping、Folder開閉を壊さずconsole errorなし。可能ならpen / touchも確認する。

## 7. 非対象

- Folder内Rasterを独立Rigid Partとして登録する任意nested Raster Rig。
- 一つのRasterへRigid PartとMesh / Skinを同時適用する複合mode。
- Raster登録時の自動Folder作成、移動時の自動Folder Part化。
- Rigリンクの自動解除、暗黙再接続、表示親への同期。
- `表示階層だけ移動` / `RIGを解除して移動`等の確認dialog。
- 保存`rigGroupId`、キャラクター専用Folder、専用Rig Tree UI。
- 自由anchor drag、orientation、weight、複数anchor、Attachment / Space Switch。
- manual weight、physics、Text、Deformer SELECT Stage 2、Motion Graph、Camera Track / Camera animation。既存Canvas navigationへのSpace + drag委譲は含めてよい。

## 8. 停止条件

- Root Raster Partのために新しい保存target kind / schema versionが必要になる。
- Raster一枚でもFolder用とは別のmatrix evaluatorが必要になる。
- preview / compositor / Bakeで共有できない。
- Raster SkinningまたはFolder WARPとの競合を明示拒否できず、二重変形が避けられない。
- 全ClipInstanceの有効ownerをmutation前に検査できない。
- Rig解除 / 再接続、主要class再構成、DOM大幅置換、100行超一括削除が同時に必要になる。

該当時は推測実装を止め、SOL Gate 0へ戻す。

## 9. 共通検証

```powershell
node --check <変更したJSファイル>
node --check <変更したmjsファイル>
Set-Location tegaki_work
npm.cmd run build
```

- Stage固有verifierと全`build/verify-*.mjs`。
- UI変更時はBrowserで関連実操作とconsole errorを確認する。
- build後に`git status --short --untracked-files=all`を確認する。
- `tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## 10. 実装報告形式

- 実装したSOL / LUNA Batchと変更ファイル。
- Folder / Root Rasterのtarget解決と、保存fieldを増やしていない根拠。
- same-parent reorder、display-only reparent、owner変更拒否の固定fixture。
- reject non-mutation、許可時1 Historyの根拠。
- preview / compositor / Bake / exportの共有plan。
- node check、Stage verifier、全verifier、build、Browser確認結果。
- 計画との差異、未解決、停止条件への該当有無。
