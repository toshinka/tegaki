# Phase 6n: BONE Gate 0・optional schema・純粋FK

更新日: 2026-07-29

## 現在地

- Phase 6mは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6m.md`。
- Phase 6j〜6lでPart optional schema、共通ID remap、pure rigid FK、Folder RenderIsland、Plan A子行とCanvas handleを一つのFolder Partへ接続した。
- BONE、Bind Pose、Bone Motion、Part bindingは未実装。Mesh、SkinWeight、IK、Constraintも未実装。

## 目的

BONEを既存Rig正本へ追加できるかGate 0で確定し、`ClipAsset.rigDefinition`の静的Bone定義と`ClipInstance.rigMotion`のBone trackをoptional fieldとして保存・検証・複製・純粋評価へ接続する。最初のPhaseでは描画やUIへ接続せず、後続adapterが同じ評価結果を使える基盤を作る。

## Gate 0判定

判定は`GO`。

- 静的BONE / Bind Poseは既存`ClipAsset.rigDefinition`が所有する。
- 時間変化するBONE Poseは既存`ClipInstance.rigMotion`が所有する。
- `sampleTransformTrack()`、affine生成、matrix multiply、Project validation、History serializeをPartと共有できる。
- `boneId`はinternal Layer IDと別のasset-local stable IDとする。asset複製時はinternal Layer / Part IDと同じ共有Rig ID mapでBone IDも再mapする。
- BONE hierarchyはdisplay `parentLayerId`、Part `parentPartId`と独立した`parentBoneId`を持つ。
- Bone→Part / RenderIslandのbindingはこのPhaseで決め打ちせず、純粋Bone Pose受入後の別Phaseで定義する。

## Slice 1: optional schema

1. `rigDefinition.bones[]`へ`boneId`、`parentBoneId`、`bindTransform`、`length`を保存する。
2. `rigMotion.boneTracks[]`へ`boneId`とClip-local Frame keyを保存する。
3. optional field欠損時は既存Project serialize shapeを変えない。
4. position / rotation / optional scaleだけを対象とし、Partと同じtransform samplerを使う。

## Slice 2: validation / remap / pure FK

1. duplicate / dangling / self parent / cyclic hierarchy、非finite Bind、負のlength、duration外 / 非finite keyを明示拒否する。
2. asset / CAF copyは一つのRig ID mapでPart、Bone、各track参照を同時に再mapする。
3. parent → child → grandchildのBone FKをstatelessに評価し、random seekと順次評価を一致させる。
4. structured Bakeは現在FrameのBone PoseをFrame 0 HOLDへ静止化する。

## 維持する契約

- stroke中working Layer表示、preview staging交換とcontainer順、上側Lane前面。
- Lane / Timeline onionはdisplay-only。
- PSD record順、animation working Layerは保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのadapter境界。
- Clip root Motion、Part Motion、WARP mask、Mesh、physicsの正本を重複実装しない。
- BONE FKはPixi / Canvas / DOM / working Layer / Historyへ依存しない。

## このPhaseで行わないこと

- Bone→Part / RenderIsland bindingと描画接続
- Animation Table BONE子行、Rig Inspector、Canvas bone handle
- Setup / Animate切替UI、BONE作成・parent編集UI
- IK、Pin、Follow、Stretch、Constraint
- Mesh、SkinWeight、Morph、Perform、Draw Order、Dynamics、physics
- CAF内部FolderのLane化、Text、Deformer SELECT、WebGPU / SDF / MSDF

## 停止条件

- BONE用の別Project正本、別Timeline、別transform samplerが必要になる。
- Part ID mapとBone ID mapをcopy / pasteで共有できない。
- Bind PoseとAnimate Poseを分離できない。
- random seekと順次評価が一致しない。
- Rigなし / BoneなしProjectのserialize shapeが変わる。

## 検証

- 変更JSすべてへ`node --check`。
- fixed-inputでoptional欠損、round-trip、validation、共通ID remap、3段FK、random seek、Frame 0 HOLD Bakeを確認する。
- Phase 6j〜6lの既存verifierを再実行する。
- `npm.cmd run build`。
- 描画UI非変更のためBrowserは次の描画adapter Phaseで本受入する。
- build後は`tegaki_work/dist/`生成差分を残さず、既存`tegaki_work/node_modules/.vite/`差分を維持する。

## 最初の作業

1. `part-rig.js`をRig schemaの単一ownerとして維持したままoptional Bone fieldを追加する。
2. asset duplicate / CAF paste / structured Bakeを共有Rig ID mapへ拡張する。
3. Bone専用fixed-inputを先に通し、描画・UIへは接続しない。

## 進捗（2026-07-29）

- `rigDefinition.bones`と`rigMotion.boneTracks`をoptional fieldとして追加した。field欠損時は既存serialize shapeを維持する。
- `boneId`、`parentBoneId`、Bind transform、lengthとBone keyをvalidationへ接続した。duplicate、internal Layer / Part IDとの衝突、dangling、self parent、cycle、非finite、負length、duration外keyを明示拒否する。
- Part / Bone hierarchyは共通の順序解決、transform sampler、affine生成、matrix multiplyを使う。3段Bone FKとrandom seekはstatelessに一致した。
- asset duplicateはinternal Layer / Part / Boneを一つの`rigIdMap`で再mapする。CAF pasteとstructured Bakeも同じmapを使用する。
- Bone Motionのstructured Bakeは現在FrameのsampleをFrame 0 HOLDへ静止化する。
- `verify-bone-rig-core.mjs`でoptional shape、validation、共有ID remap、Project round-trip、CAF copy、3段FK、random seek、Bakeを受入れた。Phase 6j〜6lとMotion / WARPの既存verifierも通過した。

## 完了判定（2026-07-29）

- 判定は`GO`。変更JSの構文確認、BONE固定入力、Phase 6j〜6lとMotion / WARP回帰、production buildが成功した。
- 描画・UIへ新経路を作らず、既存Rig正本と共有評価器上で完了した。
- 次は一つのroot BONEを一つのFolder Partへ接続するrigid binding proofへ進む。
