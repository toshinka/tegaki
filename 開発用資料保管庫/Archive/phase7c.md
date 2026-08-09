# Phase 7c — WARP anchor / 子PIVOT追従

更新日: 2026-08-09
担当: Sol High / XHigh（Gate設計・各Stage review・最終判定）、Luna MAX（GO済みStageの限定実装）
状態: 完了（Stage A / B、LUNA限定修正、SOL review 5=A、Owner軽量実機受入、2026-08-09 close）

## 1. Goal

前腕等のCAF内部FolderをFolder WARPで変形した時、変形後の手首anchorへ直下子BONEのPIVOTとその子孫を追従させる。

最初のproofは`一つのsource Folder WARP → 一つのdirect-child BONE`だけとする。既存WARP、Part / Bone FK、Motion key、RenderIslandを再利用し、新しいWARP正本、Motion track、IK target、Attachment正本を作らない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6u.md`
6. `開発用資料保管庫/Archive/phase6t.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/animation/warp-triangle-point-map.js`
11. `tegaki_work/system/animation/clip-deformer.js`
12. `tegaki_work/system/animation/part-rig.js`
13. `tegaki_work/system/animation/folder-part-render-plan.js`
14. `tegaki_work/system/animation/animation-data-model.js`
15. `tegaki_work/system/animation/clip-bake-sampler.js`
16. `tegaki_work/system/animation/raster-bone-skinning.js`
17. `tegaki_work/ui/animation-table-popup.js`
18. `tegaki_work/styles/main.css`

通常作業では`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`、proposalの
`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`を読まない。

## 3. SOL Gate 0監査結果: `GO`

### 3.1 再利用する現行正本

- static Part / Bone / Bind Pose / rigid bindingは`ClipAsset.rigDefinition`。
- FrameごとのBone Poseは`ClipInstance.rigMotion`。
- Folder WARPは`ClipInstance.folderDeformers`。targetはCAF内部Folderのstable ID。
- `warp-triangle-point-map.js`は、既存topology / placement / barycentric代数だけでBind Project点をPose Project点へ写すpure helperを提供済み。
- `evaluateRigidBones()`はCanvas PIVOT、Folder RenderIsland、Raster Skinningから共有される。追従結果をoverlayだけへ足してはならない。
- CAF複製時の既存`rigIdMap`はinternal Layer IDとBone IDを同じmapでremapする。

### 3.2 保存所有

staticな追従関係は`ClipAsset.rigDefinition.warpAnchorConstraints`のoptional配列へ置く。

理由:

- source Folderとdestination Boneは同じClipAsset内のstable IDであり、Rig SetupとしてClip間で共有すべき関係である。
- Frameごとの変形量は既存`ClipInstance.folderDeformers`からsampleできる。Constraintへpose、triangle、weight、Motion keyを複製しない。
- CAF複製では既存のLayer / Bone共通ID mapへ明示的なremapを追加できる。

最小保存shape:

```js
{
    sourceFolderLayerId: '...',
    targetBoneId: '...',
    bindPoint: { x: 0, y: 0 },
    enabled: true
}
```

契約:

- `bindPoint`はplacement適用前のCAF Project座標。
- `sourceFolderLayerId`は登録済みFolder Partであり、一つの`rigidBinding`からsource Boneを解けること。
- `targetBoneId`の`parentBoneId`はsource Bone IDと完全一致すること。最初はdirect childだけ。
- 一つのtarget Boneへ一つまで。duplicate、dangling、self / ancestor戻りはvalidation error。
- triangle index、indices、barycentric weights、topology signatureは保存しない。Folder deformer topologyはClipInstanceごとに異なり得るため、各sampleで既存point-mapから派生する。
- source ClipにFolder WARPが無い時はConstraintをdormantとして通常FKを維持する。anchorが現在topology外なら無言clampせずruntime `stale-anchor`診断と通常FK fallbackにする。

### 3.3 評価順

既存順を次の明示的なoptional passで拡張する。

1. Part poseと通常Bone FKをsampleする。
2. source Folder deformerを既存samplerでsampleする。
3. `mapWarpBindPointToPose()`で、同じplacementを適用したbaseline anchorとdeformed anchorを求める。
4. source Folderの既存Part / Bone world matrixの線形成分でanchor deltaをProjectからworldへ写す。
5. direct-child Bone worldへtranslation deltaを一度だけ加え、その子孫を通常FKで再評価する。Boneのrotation / scale keyとBind Poseは変更しない。
6. 更新済みBone poseをFolder RenderIsland、Raster Skinning、Canvas PIVOTが共有する。
7. root WARP → root Motion → Laneは従来どおり後段で一度だけ適用する。

source Part / Bone world matrixの合成式を`part-rig.js`と`folder-part-render-plan.js`へ二重実装しない。必要なら現行RenderIsland内の小さいrigid binding matrix計算をpure helperへ抽出し、双方から共有する。

### 3.4 cycle境界

Stage A / Bでは次をすべて満たす構成だけを許可する。

- source Folder Partがsource Boneへrigid bind済み。
- destinationはsource Boneのdirect child。
- source Folder subtree内に別登録Partまたは別Folder WARP targetがない既存supported構成。
- cross-CAF、child / descendant Folderからancestor Boneへ戻る参照、複数anchor、複数source blendは拒否。

この制限により、anchor passはsourceの確定poseだけを読み、destination subtreeだけを後段更新する一方向DAGになる。

## 4. Stage A — schema / evaluator / fixed verifier

Luna MAXへ渡す最初の限定実装。UIは変更しない。

### 対象

- `tegaki_work/system/animation/part-rig.js`
  - optional Constraint normalize / serialize / validate / remap
  - static relationのpure register / remove helper
  - base FKとderived translation passを分離し、`evaluateRigidBones()`の全consumerへ同じ結果を返す
- 必要な場合だけ、`tegaki_work/system/animation/warp-anchor-constraint.js`
  - DOM / History / modelに依存しないanchor delta計算
  - 既存`mapWarpBindPointToPose()`とFolder deformer samplerを使用
- `tegaki_work/system/animation/animation-data-model.js`
  - Asset更新setter、Project round-trip、CAF複製remap
- `tegaki_work/system/animation/folder-part-render-plan.js`
  - rigid binding matrix式を共有helperへ寄せる場合だけ変更
- `tegaki_work/build/verify-warp-anchor-constraint.mjs`

### 固定検証

- schema normalize / serialize / Project reloadで同値。
- CAF複製でsource Folder IDとtarget Bone IDが複製先へremapされる。
- duplicate target、dangling Folder / Bone、非Folder source、非direct-child、非finite bind pointを明示拒否する。
- Folder WARP無しでは通常FKとpixel / matrixが不変。
- fixed GRIDとControl Meshの双方で、placement込みanchor deltaに子PIVOTが一致する。
- source Bone、兄弟Boneは不変。target Boneと子孫だけが同じtranslationを一度受ける。
- Bone Motionのrotation / scale、Phase 6tのPose Bake IK keyを変更しない。
- random seek、save / reload、structured Bakeで同じmatrixになる。
- anchor outside / degenerate / invalid topologyは通常FK fallbackと診断を返し、NaNやProject mutationを起こさない。
- 既存Bone Rig、nested FK、Folder WARP RenderPlan、Raster Skinningのverifierを回帰実行する。

### SOL review 1

判定`A`までStage Bへ進まない。

- static relationとFrame poseがAsset / Instanceへ正しく分離されている。
- topology / barycentric / placement / source matrix式を複製していない。
- `evaluateRigidBones()`以外にoverlay専用またはexport専用の追従計算がない。
- dormant / stale / invalidの違いを無言修復していない。
- target subtreeへdeltaを二重適用していない。
- copy / paste、Project validation、Bake、Skinningが同じ評価結果を使う。

### Stage A実装結果（2026-08-08）

- `system/animation/warp-anchor-constraint.js`を追加し、static relationのnormalize / serialize / validation / remap、rigid binding matrix共有、Folder WARP sampled anchor deltaをpure helperへ分離した。
- `part-rig.js`へoptional `warpAnchorConstraints`を接続し、`evaluateRigidBones()`のbase FK後にdirect-child translationだけを一度注入する。rotation / scale key、Bind Pose、Pose Bake keyは変更しない。
- `folder-part-render-plan.js`は同じrigid binding matrix helperを使い、RenderIsland側の行列式を二重保持しない。
- `animation-data-model.js`へAsset register / remove setterとProject schema / copy remap経路を接続した。UIは未変更。
- fixed GRID / Control Mesh、dormant、stale outside、duplicate / remove、direct-child validation、ID remapを`build/verify-warp-anchor-constraint.mjs`へ固定した。
- 全33件の`build/verify-*.mjs`、変更JS / mjsの`node --check`、`npm.cmd run build`を通過した。build生成物は清掃済み。
- Browser authoring UI、WARP tabのtoggle、実描画を伴うOwner確認はStage Bへ残す。Stage AではSOL review 3の判定待ち。

### LUNA MAX修正（2026-08-08）

- `enabled`の明示値を無言でboolean化せず、非booleanをvalidation errorへ送るよう修正した。
- 最初のproofを単一anchorへ固定し、複数anchor、source subtree内の別登録Part、nested Folder WARP targetを拒否または通常FKへfallbackする境界を追加した。
- `evaluateRigidBones()`のbase / bind / derived passへ同じvalidation済みRigDefinitionを渡すよう修正した。
- 子孫の一度だけの継承、兄弟不変、invalid値、Project round-trip、random seek、structured Bakeを専用verifierへ追加した。
- 33 verifier、変更JS / mjsの`node --check`、buildを通過した。build生成物は既存状態へ清掃済み。

## 5. Stage B — 最小authoring UI

SOL review 2が`A`の場合だけStage Bの最小authoring UIへ進む。

- WARP tabで選択中Folderが登録済みPartかつrigid bind済みで、direct-child Boneが存在する時だけ`子PIVOT追従`を表示する。
- 複数direct childがある場合は対象名を明示選択する。checkboxだけで最寄りPIVOTへ暗黙接続しない。
- ON時の初期anchorはtarget BoneのBind PIVOTをsource Folderのplacement前Project座標へ逆変換して使う。変換不能、GRID外、unsupported nested構成は保存せず理由を表示する。
- OFFは該当static Constraintを削除する。ON / OFFはFrame keyではなくRig Setup変更で、1操作 = 1 History。
- Canvasには選択中だけanchor、対象PIVOT、接続線をdisplay-only表示する。通常はふたば茶、activeは橙、Setup状態は既存青、接続成立は必要なら既存緑を使う。black / white / neutral grayやnative `title`を使わない。
- Table reopen、最後に使ったRIG / MOTION / WARP tab、Folder target選択を壊さない。
- pointercancel / Escapeで未確定Setupを残さない。pen / touchでhoverを必須にしない。

Stage Bではanchor自由drag、orientation follow、weight、複数anchorを追加しない。自動初期位置の実制作評価後に別Stageで判断する。

### Stage B実装結果（2026-08-08）

- `animation-table-popup.js`の既存WARP target stripへ、選択Folderのdirect-child Boneを明示選択する`子PIVOT追従` UIを追加した。ON時は既存`TimelineModel.registerClipAssetWarpAnchorConstraint()`、OFF時はremove setterへ接続し、CAF asset Historyを1操作1件で記録する。
- ONの`bindPoint`は既存`evaluateRigidParts()` / `evaluateRigidBones()`と`resolveRigidBindingWorldMatrix()`でtarget Bind PIVOTをsource Folderのplacement前Project座標へ逆変換する。現在GRIDのbindBounds外は保存せず理由を表示する。
- WARP tabでは既存`rigPivotOverlay`を表示専用modeで再利用し、選択中anchor、target PIVOT、接続線をCanvasへ表示する。overlayはpointer入力を遮らず、GRIDの編集を維持する。既存RIG / MOTION overlayと新規保存正本は分離した。
- constraint無し、unsupported Folder、直下子Bone無しではUIを暗黙表示せず、自由anchor drag、orientation、weight、複数anchorは未実装のまま維持する。
- 変更JSの`node --check`、Stage verifier、全`build/verify-*.mjs`、`npm.cmd run build`、local Browser起動・native title 0件・console error 0件を確認した。生成物は清掃対象として残さない。

### SOL review 4（2026-08-08）: `B`

Stage Bの保存正本、History、display-only overlay、既存WARP入力の分離は維持されている。一方、次の2点はauthoring成立表示とStage A runtime診断が食い違うため、Owner受入前にLUNA MAXで限定修正する。

1. `_resolveWarpAnchorBindPoint()`は現在の`bindBounds`だけを検査している。WARP未作成時はbounds無しのままConstraintを保存でき、Control Meshでは矩形bounds内でも実triangle外の点を保存できる。選択Folderのdeformerが存在することを必須にし、既存`mapWarpBindPointToPose()`へcurrent sampled topology / placementとBind poseを渡して、実triangle内部まで確認する。失敗時は保存せず、`WARP GRIDが必要`と`GRID外／topology外`を区別して表示する。
2. `_getWarpAnchorOverlayItems()`はpoint-map失敗時にraw `bindPoint`へ戻し、statusも接続成立を表示し続ける。`evaluateRigidBones()`の既存`anchorDiagnostics`を参照し、`dormant` / `stale` / unsupported時にactiveな接続線を表示しない。新しい診断正本は作らず、UIへ既存codeの理由を反映する。

追加固定確認は`WARP未作成でON拒否`、`bounds内だがtriangle外でON拒否`、`設定後のGRID再構成でstale表示かつ通常FK fallback`。修正後は変更JSの`node --check`、anchor verifier、全verifier、build、Browser smokeを行い、SOL review 5へ戻す。

### LUNA MAX限定修正（2026-08-09）

- `_resolveWarpAnchorBindPoint()`は選択Folderの実deformerが無い場合に保存を拒否し、既存`mapWarpBindPointToPose()`へsampled topology / placementを渡してtriangle外・退化topologyを保存しない。WARP未作成、GRID外、topology不正を別理由で表示する。
- `_getWarpAnchorOverlayItems()`とoverlay active判定は既存`evaluateRigidBones().anchorDiagnostics`の`warp-anchor-applied`だけを成立条件とし、dormant / stale / unsupportedでは接続線を表示しない。WARP panel statusも同じ診断codeを表示する。
- `verify-warp-anchor-constraint.mjs`へ「矩形bounds内だがtriangle外」のpoint-map拒否を追加した。新しい保存正本・topology診断正本は追加していない。
- 変更JS / verifierの`node --check`、anchor verifier、全`build/verify-*.mjs`、`npm.cmd run build`を通過した。build生成物は清掃済み。Browserの深い制作確認を残す。

### SOL review 5（2026-08-09）: `A`

- SOL review 4の指摘1は、WARP未作成を明示拒否し、矩形boundsではなく既存triangle point-mapで実topology内部を確認してからConstraintを保存することで閉じた。
- 指摘2は、既存`evaluateRigidBones().anchorDiagnostics`の`warp-anchor-applied`だけを成立表示とし、dormant / stale / unsupported時に接続線とactive表示を抑止することで閉じた。
- 保存schema、History正本、WARP topology、Bone evaluatorを増やしていない。拒否操作はAsset / Clip / Historyを変更せず、通常FK fallbackを維持する。
- 変更JS / verifierの`node --check`とanchor verifierをSOLで再確認した。LUNA実装報告の全verifier、build、Browser smoke、生成物清掃も受入れ、コードreview上の追加修正は不要と判定する。
- Ownerは2026-08-09に、懸念と段階状況を把握した上で軽量確認後のcloseを許可した。自由anchor drag、orientation、weight、複数anchor、RIG済み階層移動は本Phaseへ追加しない。

### Owner実機

- 前腕Folder WARPで手首を変形するとHAND PIVOTとHAND配下が追従する。
- OFFで同じProjectの通常FKへ戻る。
- preview / playback / onion / random seek / Bake / GIF / APNG / Project reloadで同じ位置。
- POINT / BRUSH / SELECT、Folder別WARP、Motion、2-Bone IK Pose Bake、Animation Table同時使用が壊れていない。
- Undo / Redo、CAF複製、source / target削除、Table close / reopen、console errorを確認する。
- 可能ならpen / touchでtoggleとWARP変形を確認する。

### Close確認（2026-08-09）

- 軽量Browser fixtureで、WARP未作成時のON拒否、対象PIVOTがGRID外の時の保存拒否、Folder WARP BRUSH変形に対するanchorとdirect-child PIVOTの同量追従、OFF時の通常FK復帰を確認した。
- ON / OFFのUndo / Redo、Animation Table close / reopen後の設定維持、onion切替、playback後の再選択、console error 0件を確認した。
- stale / unsupported時の通常FK fallback、random seek、Project round-trip、CAF複製remap、structured Bake、既存Motion / 2-Bone IK / Folder別WARPとの境界は固定verifierとSOL review 5で受入れた。GIF / APNG、source / target削除、実制作Project、pen / touchの深い組合せは継続監視とし、再現時だけ限定Sliceを開く。
- 変更対象20件のJS / mjsで`node --check`、全33件の`build/verify-*.mjs`、`npm.cmd run build`を通過した。build生成差分は清掃し、既存差分を維持した。
- Ownerの軽量確認後close許可に基づきPhase 7cを完了とする。自由anchor drag、orientation、weight、複数anchor、Attachment、Mesh、physics、Textは未実装のまま後続Gateへ分離する。

## 6. 維持する契約

- stroke中working Layer表示、preview staging交換とcontainer順、上側Lane前面。
- Lane / Timeline onionのdisplay-only境界、PSD record順。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clippingと既存RenderIsland境界。
- Folder WARPは`ClipInstance.folderDeformers`、Bone Poseは`ClipInstance.rigMotion`、static Rigは`ClipAsset.rigDefinition`。
- preview / playback / onion / Bake / exportの同一sample。
- 1 gesture = 1 History、cancel rollback、旧ProjectとConstraint無しProjectの互換。

## 7. 非対象

- Attachment / Space Switch、ボールrelease、IK target track、constraint weight animation。
- orientation / tangent follow、rotation follow、stretch、rotation limit、Pin、複数anchor / target blend。
- nested Folder WARP、cross-CAF、cross-boundary clipping自動修復。
- Mesh / SkinWeight変更、自動Mesh、manual weight、physics。
- Deformer SELECT Stage 2、Text、Motion Graph、Camera、Layer Panel、Emergency Recovery。
- 通常Layer V transformと外部paste / Canvas resize残件。
- WebGPU / SDF / MSDF。

## 8. 停止条件

- static relationをAssetではなくClipごとに複製しないと成立しない。
- triangle / weight / poseをConstraintへ保存しないと成立しない。
- direct-child限定でもBone評価とFolder RenderIslandが循環する。
- preview、Skinning、Bake / exportで別の追従評価器が必要になる。
- nested target、複数anchor、orientation follow、IK target正本を同時実装しないと成立しない。
- 主要class再構成、DOM大幅置換、100行超の一括削除が必要になる。

該当時は推測実装を止め、SOL Gate 0へ戻す。

## 9. 共通検証

```powershell
node --check <変更したJSファイル>
node --check <変更したmjsファイル>
Set-Location tegaki_work
npm.cmd run build
```

- Stage固有verifierと全`build/verify-*.mjs`。
- build後に`git status --short --untracked-files=all`を確認する。
- `tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。

## 10. LUNA MAX実装報告形式

- 実装したStageと変更ファイル。
- 既存helperを再利用した箇所と、新規正本を作っていない根拠。
- node check、Stage verifier、全verifier、build、Browser確認結果。
- cancel / History / Project / copy / Bake / export境界。
- 計画との差異、未解決、停止条件への該当有無。
