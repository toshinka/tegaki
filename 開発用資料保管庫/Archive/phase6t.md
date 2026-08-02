# Phase 6t: rigid Folder fixed-length 2-Bone IK

作成日: 2026-08-01  
状態: 完了（SOL review 3判定A、Owner実機受入）  
推奨分担: SOL High / XHighで設計・review、LUNA MAXで指定Stageだけを実装、Ownerが描画付き実機判定

## 1. 目的

現行の親から子へ伝播するrigid FKを維持したまま、Motion tabで末端Folder / BONEのPIVOTを動かすと、
直上二つの親BONEが回転して末端rootへ追従する固定長2-Bone IKを追加する。

最初の対象は`ARM2 -> ARM1 -> HAND`のような一直線の三世代chainである。選択末端BONEのrootをtargetとし、
parentとgrandparentのrotationだけを解く。伸縮、Mesh変形、weight、回転制限、肩より上の自動参加は混ぜない。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6s.md`
6. `開発用資料保管庫/Archive/phase6q.md`
7. `開発用資料保管庫/Archive/phase6p.md`
8. `開発用資料保管庫/proposals/00_計画索引.md`
9. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `tegaki_work/system/animation/part-rig.js`
12. `tegaki_work/system/animation/animation-data-model.js`
13. `tegaki_work/system/animation/folder-part-render-plan.js`
14. `tegaki_work/system/transform-math.js`
15. `tegaki_work/ui/rig-pivot-overlay.js`
16. `tegaki_work/ui/animation-table-popup.js`
17. `tegaki_work/styles/main.css`

## 3. Gate 0監査結果

### 3.1 既存正本

- static chainは`ClipAsset.rigDefinition.bones[].parentBoneId`。
- Bind Poseと表示用長さは同じBone定義の`bindTransform`と`length`。
- 時間変化するPoseは`ClipInstance.rigMotion.boneTracks`。
- keyの追加・更新は`AnimationDataModel.setClipRigBoneKey()`から`upsertRigBoneKey()`へ一本化済み。
- samplingと親子評価は`sampleBoneInstanceMotion()`と`evaluateRigidBones()`。
- Folder描画は`createFolderEffectRenderPlan()`が既存Bone world matrixをCPU / Pixi / Bake / exportへ共有する。
- CanvasとCAF Project座標の変換は、既存`_screenToRigProject()`と`transform-math.js`を再利用できる。
- Motion PIVOT、pointer capture、cancel、Timeline Historyのgesture骨格は既存`rig-pivot-overlay.js`と
  `animation-table-popup.js`に存在する。

### 3.2 解くchain

選択中の末端Boneを`effector`、その`parentBoneId`を`joint`、さらに親を`root`とする。

```text
root Bone root (肩) ---- joint Bone root (肘) ---- effector Bone root (手)
        solve rotation           solve rotation          target only
```

- IKが更新するのは`root`と`joint`の二本のrotation keyだけ。
- `effector`自身のtranslation / rotation / scale keyは変更しない。
- segment長は現在評価した三つのBone root間距離を使う。
- 保存済み`bone.length`はPIVOTの尻尾 / Folder代表寸法であり、親子root間距離と一致する契約ではないため、
  IK segment長へ流用しない。
- targetはCanvas pointerをroot Motion逆変換したCAF Project座標。保存用target trackは作らない。

### 3.3 第一保存方式

proposal 15の`A Pose Bake`をPhase 6tの第一方式とする。

- drag中はpure solverの結果を既存2本のBone Poseへpreview適用する。
- pointerupで同じFrameの既存`boneTracks`へrotation keyを確定する。
- 1 gestureでTimeline Historyを一件だけ記録する。
- Escape、pointercancel、popup closeではgesture前のTimeline stateへ戻す。
- reopen / playback / onion / random seek / Bake / exportは現行`evaluateRigidBones()`だけを評価する。
- `ikTargets`、Constraint track、solver version、UI target cacheをProjectへ保存しない。

Effector Target正本と非破壊Constraintは、Pose Bakeの実制作制約が確認された後の別Gateとする。

### 3.4 純粋solver契約

Stage Aは副作用を持たない`solveFixedLengthTwoBoneIk()`を追加する。入力は少なくとも次を持つ。

```js
{
  root: { x, y },
  joint: { x, y },
  effector: { x, y },
  target: { x, y },
  bendSign: -1 | 1
}
```

出力はworld angleと現在Poseへ加算するrotation deltaを返す。Clip、Asset、DOM、Historyは受け取らない。

- `lengthA = distance(root, joint)`、`lengthB = distance(joint, effector)`。
- 到達不能な外側targetは`lengthA + lengthB`へ、内側targetは`abs(lengthA - lengthB)`へ固定長clampする。
- targetとrootが同一点、zero-length segment、non-finite入力はerror codeで拒否し、NaNを返さない。
- bend側は現在Poseのcross productを維持し、直線に近い時はBind Pose、さらに曖昧なら明示`bendSign`を使う。
- world angleから現在world segment angleとの差を求め、root rotation deltaとjoint local rotation deltaへ変換する。
- 角度は`[-PI, PI]`へ正規化し、pointer移動ごとの2PI jumpを避ける。
- 入力objectや既存Poseを変更しない。同じ入力は常に同じ結果を返す。

### 3.5 初期eligible境界

次を満たす時だけIK入口を有効にする。

- 選択末端Bone、parent、grandparentがすべて存在しcycleがない。
- 三つのBoneが既存rigid Folder bindingを持つ。
- 二つのsegment長がepsilonより大きい。
- solver対象chainにmirror、skew相当、非一様scaleがない。uniform positive scaleは評価済みroot距離へ含めてよい。
- 現在Frameが選択Clip内で、再生中ではない。

不適合時は既存FK操作を維持し、Futaba tooltipへ一つの理由を表示する。chainの自動修復、暗黙の親変更、
scale初期化、Folder flattenはしない。

## 4. 変更後のOwner操作

- RIG tabで従来どおりPIVOT位置と`parentBoneId`を設定する。
- Motion tabで末端Folder / BONEを選び、Inspectorの`IK` authoring toggleを有効にする。
- Canvas上の選択末端PIVOT中心をdragすると、直上二つの親が回転し末端rootがpointerへ追従する。
- 通常のFK PIVOT操作は残す。IK toggleがoffなら現在のmove / rotate操作を変更しない。
- `曲げ反転`は現在Frameの反対解を選ぶ明示buttonとし、勝手に肘側を反転しない。
- active Motion PIVOTは既存の橙、RIG Setupは既存の青。白黒灰色のcontrolやnative `title`は追加しない。
- pen / touchでも押下中に描画へ漏らさず、pointer capture外れはcancelとして扱う。

`IK`と`曲げ反転`はPhase 6tではruntime authoring modeであり保存正本ではない。再open時はFKへ戻ってよい。
最後のtab復帰、対象Folder選択、既存Motion keyはそのまま維持する。

## 5. 維持する契約

- stroke中working Layer表示。
- preview staging交換とpreview container順。
- 上側Laneが前面。
- Lane / Timeline onionのdisplay-only境界。
- PSD record順。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clippingとFolder RenderIsland境界。
- `Folder subtree -> Folder WARP -> Part/Bone matrix -> Folder opacity/blend -> root WARP -> root Motion -> Lane`。
- RIG static Setup、Motion Bone Pose、WARPの正本分離。
- `parentBoneId` dropdownとCanvas link gesture。
- 既存FK move / rotate、KEY複数選択、tab復帰、PopupManager、shortcut。
- 新しいMotion、WARP、Mesh、physics正本を重複実装しない。

## 6. LUNA MAX実装Stage

各StageはLUNA MAXが指定範囲だけを実装し、SOL reviewを通してから次へ進む。

### Stage A — pure fixed-length solver

対象:

- 新規`tegaki_work/system/animation/two-bone-ik.js`。
- 新規`tegaki_work/build/verify-two-bone-ik.mjs`。
- 必要な場合だけ`part-rig.js`からpure geometryを読むadapter。既存FKの評価順は変更しない。

fixture:

- 3-4-5、左右bend、内外到達不能clamp、root同一点、zero length、non-finite。
- 現在Poseが回転済み、rootより上のancestorが回転済み、negative Project座標。
- world deltaを既存二本のrotationへ足した後、`evaluateRigidBones()`のeffector rootが期待targetと一致する。
- random target順で同じFrameをseekしても結果が一致する。
- 入力不変、NaNなし、角度jumpなし。

実装完了（2026-08-01）: `system/animation/two-bone-ik.js`へ副作用のない
`solveFixedLengthTwoBoneIk()`と角度正規化を追加し、`build/verify-two-bone-ik.mjs`で上記fixtureを固定した。
既存`evaluateRigidBones()`へroot / jointのrotation deltaだけを適用する検証、表示用`bone.length`非使用、
到達不能clamp、error code、既存Rig verifier 4本、`node --check`、`npm.cmd run build`を通過した。
UI、model setter、保存schema、target track、既存FK評価器は変更していない。

SOL review 1（2026-08-01）は判定`A`。world角度から二本目のlocal deltaへの変換、明示bend側、
fixed-length contract、既存FKへのrotation-only適用を確認した。有限の巨大角でも停止する定数時間の角度wrapへ補強し、
入力object不変、非ゼロroot Bind位置、ancestor rotationを含むfixtureを通過した。Stage Bは記載対象ファイル境界のまま開始できる。

停止条件:

- `bone.length`を親子距離の正本へ変更する必要がある。
- `rigDefinition` / `rigMotion`へIK field追加が必要になる。
- 既存`evaluateRigidBones()`をsolver内へ複製する必要がある。
- 非一様scale / mirrorを無言で近似しないとfixtureが通らない。

### Stage B — Motion tab authoring

対象:

- `animation-table-popup.js`の既存Motion Inspector / gesture / History。
- `rig-pivot-overlay.js`の既存選択末端PIVOT drag routing。
- 必要最小限の`main.css`。既存semantic変数と共通tooltipを再利用する。
- UI gesture verifier。

実装:

- chain eligibilityを一箇所で解決し、InspectorとCanvas overlayが同じ結果を使う。
- IK toggle on時だけ選択末端root dragを2-Bone solverへ送る。
- drag開始時にTimeline stateと二本のsampled Bone transformを一度採取する。
- pointermoveは二本のrotation keyを既存`setClipRigBoneKey()`で更新し、previewを遅延refreshする。
- pointerupで一つのTimeline History、cancelで完全rollback。
- `曲げ反転`は同じsolverの`bendSign`だけを変え、別solverや別key正本を作らない。
- 通常FK drag、wheel、Shift操作、PIVOT link、KEY D&Dを変更しない。

実装完了（2026-08-01）: `animation-table-popup.js`へ既存Motion Inspector / PIVOT overlayを使った
runtime-only IK authoringを追加した。選択末端BONEから親・祖父母とrigid Folder bindingを一箇所で解決し、
Inspectorの`IK追従`を有効にした時だけ末端PIVOTのmove dragをpure solverへ送る。各pointermoveは現在Poseを
再評価して既存`setClipRigBoneKey()`でroot / jointのrotation keyだけを更新し、pointerupは一件のTimeline
History、cancelは開始時stateへrollbackする。`曲げ反転`は同じsolverのbend signを切り替える。target track、
Constraint、保存schema、effectorのtranslation / rotation / scale、通常FK / wheel / Shift操作は追加・変更していない。
構文検査、Stage Aと既存Rig verifier、build、BrowserのTable / QTP / V shortcutとconsole error smokeを通過した。
3本のrigid Folderを持つOwner fixtureでのIK drag、Undo / Redo、save / reopen、pen / touchの深い受入れはStage Cへ残す。

SOL review 2（2026-08-01）は初回判定`B`。保存正本とrotation-only Pose Bakeは契約どおりだったが、
zero-length / world skewをInspector入口で拒否していない点、`曲げ反転`がbend sign表示だけを変えて現在Poseへ
反対解を適用していない点、IK tooltip class欠落、Table close cancelがoverlayの次回RAF待ちだった点を限定補正した。
drag開始時の二本のsampled transformと三点をbaselineとして固定し、二本目key失敗時のrigMotion rollbackも追加した。
新規`build/verify-two-bone-ik-authoring.mjs`でeligibility、rotation-only二本書込み、原子的rollback、
1 gesture 1 History、cancel、現在targetを保つbend flipを固定した。全verifier 23本、build、Browser smokeを再通過し、
再reviewは判定`A`。Stage Cへ進める。

停止条件:

- 新popup、第二PIVOT overlay、第二selected Bone stateが必要になる。
- pointermoveごとにHistoryを積む必要がある。
- effector translation keyやFolder Part trackも同時変更しないと成立しない。
- Canvas描画inputをglobalに無効化しないと漏れを止められない。

### Stage C — round-trip・回帰・close

対象:

- 既存Rig / Part / Folder WARP / Project / Bake verifierへの限定fixture追加。
- Browser smokeとOwner描画付き実機判定。
- `PROGRESS.md`、proposal、Phase close。

受入れ:

- Frame 1でHAND targetをdragし、ARM1 / ARM2の二本だけにkeyができる。
- FK modeへ戻して親回転、子回転が従来どおり動く。
- unreachable targetで伸縮せず、Folder画像の長さとscaleが変わらない。
- Undo / Redo、save / reopen、random seek、preview / playback / onion、flatten / structured Bake、GIF / APNGが一致する。
- Folder別WARP併存時も評価順と対象Folder境界を維持する。
- Table open / close、CLIP MOTION再open、Popup重なり、pen / touch、console errorなし。
- `dist/`と`node_modules/.vite/`に生成差分を残さない。

Stage C固定fixture実装（2026-08-01）: `build/verify-two-bone-ik-stage-c.mjs`を追加した。
既存`TimelineModel`へ3本のrigid Folder / Boneを登録し、reachable targetとouter clampを既存
`setClipRigBoneKey()`へPose Bakeし、root / jointのみのkey、effector無変更、segment固定、FK親回転、
random seek、`sampleRigMotionForBake()`、Project JSON round-trip、Folder RenderIslandのscale / 境界を
固定検証する。既存のFolder WARP / structured Bake / export verifierを置き換えず、保存schemaや再生solverは追加しない。
Browserの描画付きOwner fixture（IK drag、Undo / Redo、save / reopen、preview / playback / onion、
pen / touch、GIF / APNG）は引き続き未判定である。

SOL review 3（2026-08-01）はStage C固定fixtureを判定`A`とした。既存model setterのimmutable更新、
root / joint二本だけのrotation key、effector / scale / Bind Pose非変更、固定長clamp、通常FK、Project round-trip、
random seek、Pose Bake sample、Folder RenderIslandを確認した。Stage Cは新しいtarget / Constraint保存schemaや
再生solverを追加していない。添付実機では同一CAFのMotion keyとFolder別WARPの併存を確認できるが、
Undo / Redo、save / reopen、preview / playback / onion、pen / touch、GIF / APNGはOwner最終判定を待つ。

Owner close（2026-08-01）: 実機を軽く操作した範囲で問題なしとして受入れた。深い描画fixtureは制作中の
継続観察へ戻し、Phase 6tをcloseする。新しいIK target / Constraint正本、stretch、Mesh、weightは追加していない。

制作中に出た「WARP変形へ子PIVOTを追従」「物体を手放すFrameで追従解除」はPhase 6tへ追加実装しない。
前者はWARP anchor constraint、後者はAttachment / Space Switchとしてproposal 15へ別Gateを記録した。

## 7. LUNA MAXへ渡す共通実行指示

```text
あなたはPhase 6tから切り出された指定Stageの実装担当です。
指定Stageと明記された対象ファイルだけを変更してください。
Gate 0のPose Bake方式、固定長、chain定義、eligible条件、正本、対象外を変更しないでください。
既存APIを先に検索し、同じ責務のclass / event / state / solverを追加しないでください。
計画外のschema、target track、stretch、Mesh、既存test期待値変更が必要なら実装を止めて報告してください。
完了時は変更ファイル、実装内容、node --check、verifier、build、Browser確認、未解決、計画との差異を報告してください。
build後はdist/とnode_modules/.vite/の生成差分を残さないでください。
```

## 8. SOLレビュー項目

- target trackやruntime Constraint正本を追加せず、既存Bone rotation keyへだけ確定している。
- `bone.length`と親子root間segment長を混同していない。
- solverがDOM / model / Historyを持たず、同一入力で決定的である。
- root Motion逆変換、CAF Project座標、world angle、Bone local rotation deltaが二重変換されていない。
- clamp、bend側、zero length、non-finite、角度wrapが明示されている。
- selected effector自身、scale、translation、Bind Pose、parentBoneIdを変更していない。
- 1 gesture = 1 History、cancel / Escape / popup closeが完全rollbackする。
- 既存FK、Folder WARP、preview / playback / Bake / exportが同じ`evaluateRigidBones()`を使う。
- tooltip、button、icon、disabled / activeがFutaba paletteに従う。
- pen / touch hit areaとdrawing input leakがBrowserで確認されている。

レビュー判定:

- `A`: 計画どおり。次Stageへ進める。
- `B`: SOLが計画を補足し、LUNAへ限定修正を返す。
- `C`: chain geometryまたは保存方式に矛盾があり、Gate 0へ戻す。

## 9. このPhaseで行わないこと

- Effector target / Constraintの保存schema、非破壊IK playback solver。
- stretch、squash、Folder scale、腕の自動延長。
- rotation limit、chain length UI、ancestor参加toggle、Pin、Follow。
- pole vector、multi-chain、分岐chain、複数effector同時solve。
- Auto Mesh、Triangle Mesh、SkinWeight、周辺画素の曲げ、Morph。
- Perform、Dynamics、physics、Collider。
- Text、Deformer SELECT、Motion Graph、通常Layer選択系リファクタリング。
- 外部paste / Canvas resize / V save残件の修正。
- WARP anchorによる子PIVOT追従、Attachment / Space Switch、物体release track。
- WebGPU / SDF / MSDF。

## 10. 検証

- 変更した全JS / mjsへ`node --check`。
- `node tegaki_work/build/verify-two-bone-ik.mjs`。
- 既存`verify-nested-bone-fk.mjs`、`verify-rig-pivot-link-authoring.mjs`、
  `verify-root-bone-authoring.mjs`、Folder render / WARP / Project round-trip verifier。
- `npm.cmd run build`。
- BrowserでStageごとの対象操作、Undo / Redo、save / reopen、Table open / close、Popup、console error。
- build後は`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
