# Phase 6o: root BONE → Folder Part rigid binding proof

更新日: 2026-07-29

## 完了状態

- Phase 6nは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6n.md`。
- optional Bone schema、validation、共有Rig ID remap、3段stateless FK、Project / History round-trip、Frame 0 HOLD Bakeは成立した。
- Phase 6oは`GO`で完了した。一つのroot BONEと一つのFolder Partのstatic binding、inverse bind delta、既存Folder RenderIslandへの合成を実装した。
- selected CAFの非working previewでも同じClipをonion対象へ含め、Bone変形のTimeline onionを表示できるようにした。stroke中working Layer除外は維持する。

## 目的

一つのroot BONEと一つのCAF内部Folder Partを明示的なstatic bindingで接続し、Bind Pose差分から得る一つのrigid delta matrixをPhase 6kの共通Folder RenderIslandへ渡す。Pixi preview / playback / onionとCanvas compositor / Bake / exportが同じbinding評価を使うことを固定する。

## Slice 0: binding / inverse bind境界監査

1. Part bind / Part Motion、Bone Bind / Bone Motion、Clip root Motion、WARPの適用順を固定入力化する。
2. Bone current worldとBone bind worldから`current * inverse(bind)`のdeltaを純粋計算する。
3. static bindingは`ClipAsset.rigDefinition`だけが所有し、Bone / Part定義へ相互参照を重複保存しない。
4. 一つのBoneと一つのFolder Partだけを許可し、複数binding、child Bone、nested Partは明示`unsupported`とする。

## Slice 1: shared rigid binding plan

1. `boneId → partId`の一方向bindingをvalidation / remapへ接続する。
2. Bone deltaと既存Part world matrixの合成順を純粋planで一度だけ解決する。
3. clipping分断、Raster Part、複数PartはPhase 6kと同じfallbackを使う。
4. invalid / unsupported bindingを修復・削除せず、BoneなしRaster表示を維持する。

## Slice 2: Pixi / Canvas adapter

1. Phase 6kのFolder Part render planを拡張し、別RenderIsland判定や別FKを作らない。
2. preview / playback / onionとcompositor / Bake / exportへ同じmatrixを渡す。
3. working Layer、DrawingSnapshot、Part key、Bone keyへ評価結果を焼き込まない。
4. random seek、Table open / close、Project reloadで同じposeを表示する。

## 維持する契約

- stroke中working Layer表示、preview staging交換とcontainer順、上側Lane前面。
- Lane / Timeline onionはdisplay-only。
- PSD record順、animation working Layerは保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのadapter境界。
- Part Motion、Bone Motion、Clip root Motion、WARPを別fieldとして維持し、合成結果を保存正本にしない。
- Pixi / Canvas / Bake / exportで別binding評価器を作らない。

## このPhaseで行わないこと

- BONE作成、parent、Bind Pose編集、Animation Table子行、Canvas handle UI
- child / grandchild BONEの描画binding、複数Part / nested Part
- IK、Pin、Follow、Stretch、Constraint
- Mesh、SkinWeight、Morph、Perform、Draw Order、Dynamics、physics
- CAF内部FolderのLane化、Text、Deformer SELECT、WebGPU / SDF / MSDF

## 停止条件

- Bone deltaのためにPart MotionまたはBone Motionを上書きする必要がある。
- previewとexportで異なるinverse bind / matrix順が必要になる。
- binding参照をPart定義とBone定義の双方へ重複保存しないと成立しない。
- clipping境界を変更しないと一つのFolder RenderIslandを動かせない。
- Rigなし / BoneなしProjectのpixelまたはserialize shapeが変わる。

## 検証

- 変更JSすべてへ`node --check`。
- fixed-inputでidentity、translation、rotation、scale、Part Motion併用、root Motion / WARP順、negative bounds、invalid / unsupported fallback、random seekを確認する。
- Phase 6n以前の全Rig verifierを再実行する。
- `npm.cmd run build`。
- BrowserでTable表示中 / 閉鎖後、playback / onion、通常描画、console errorを確認する。
- build後は`tegaki_work/dist/`生成差分を残さない。

## 最初の作業

1. `transform-math.js`のinverse affineとFolder Part render planの合成位置を監査する。
2. binding schema名、参照方向、matrix式を固定入力へ先に記述する。
3. pure binding planをCanvas固定入力へ接続してからPixiへ渡す。

## 実装結果

- `rigDefinition.rigidBindings`をoptional fieldとして追加し、`boneId → partId`の一方向参照、duplicate / dangling / 非finiteをvalidation対象にした。
- Part / Boneと同じRig ID mapでbinding参照をremapする。Part定義やBone定義へ逆参照を保存しない。
- `invertTransformMatrix()`と`currentBoneWorld × inverse(bindBoneWorld)`を純粋評価し、既存Part world matrixへ合成した一つのFolder RenderIsland planをPixi / Canvas / Bake / exportで共有する。
- 一つのroot Bone、一つのFolder Part、一つのbindingだけを受理する。child Bone、複数binding、singular bind、参照不一致は`unsupported` / `invalid`としてRig適用せず、既存Raster / CAF表示へfallbackする。
- `verify-bone-folder-binding.mjs`へidentity、translation、rotation、scale、Part Motion合成、negative bounds、random seek、unsupported fallback、Canvas matrixを固定した。

## 検証結果

- 変更JSの`node --check`成功。
- Bone / Part / Folder RenderIsland / authoring / Bake / WARPの既存verifierと新規binding verifierがすべて成功。
- `npm.cmd run build`成功。
- BrowserでF1 bind pose、F2 translation、F3 rotation、Table開閉、playback、Timeline onion、通常Layer描画、console errorなしを確認した。
- 次Phaseは一つのroot BONEの作成・binding・key編集に限定したauthoring UIとする。
