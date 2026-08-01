# Phase 6k: Folder Part rigid render adapter・Preview / Export一致

更新日: 2026-07-28

## 現在地

- Phase 6jは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6j.md`。
- optional `rigDefinition` / `rigMotion`、validation、共通ID remap、root Motionと共有するtransform-track sampler、stateless rigid FKは純粋データ上で成立した。
- 現在はRig poseを描画へ接続していない。Phase 6kは一つのFolder Partに限定し、同じ評価結果をPixi previewとCanvas compositorへ渡す。
- BONE / Part編集UIへ進む前に、Folder subtree、clipping、bounds、root Motion / WARPとの評価順をpixel固定入力で確定する。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6j.md`
6. `開発用資料保管庫/Archive/phase6i.md`
7. `開発用資料保管庫/proposals/00_計画索引.md`
8. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
9. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
10. `tegaki_work/system/animation/part-rig.js`
11. `tegaki_work/system/animation/timeline-frame-compositor.js`
12. `tegaki_work/ui/animation-table-popup.js`
13. `tegaki_work/system/animation/internal-layer-clipping-contract.js`
14. `tegaki_work/system/animation/clip-transform-sampler.js`
15. `tegaki_work/system/animation/clip-deformer.js`
16. `tegaki_work/build/verify-structured-bake-model.mjs`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`も通常は読まない。

## 目的

Clip-local Frameごとに一度だけ得たFolder Partのevaluated affine matrixを、Pixi preview / playback / onionとCanvas compositor / Bake / exportへ同じadapter契約で適用する。旧Project、RigなしCAF、root Motion、WARP、Folder clippingの結果を変えず、後続Phase 6lのPart key UIが書き込める描画経路を先に完成させる。

## Slice 0: 変更前固定入力とRenderIsland境界

実装前に次を固定入力化する。

1. Rigなしnested FolderのPixi / Canvas合成順、bounds、normal / inverse clipping、opacity / blend。
2. root Motionだけ、WARPだけ、root Motion + WARPの既存sampleと出力bounds。
3. Folder subtree内にclipping owner / sourceが完結する最小asset。
4. Folder境界を跨いでclipping owner / sourceが分断される拒否asset。
5. Folder Partのidentity / translation / rotation / scale、Frame 0 / 中間 / 末尾pose。

初期RenderIslandは次に限定する。

- Part対象は一つの内部Folder。
- そのFolderのdisplay subtree全体を一つのRenderIslandとして同じworld matrixで動かす。
- subtree内へ別Partを入れない。root → childの描画接続はFolder Part受入後へ送る。
- clipping owner / sourceの片方だけがsubtree内にある構成はvalidation errorとして描画適用を拒否し、RigなしRaster表示へfallbackする。
- display `parentLayerId`、表示順、clipping sourceを`parentPartId`へ同期しない。

## Slice 1: shared render plan

1. `evaluateRigidParts()`の結果から、`partId → world matrix`と対象display subtreeを解決する純粋render planを一つ作る。
2. RenderIsland境界とclipping分断を共通helperで検証し、Pixi / Canvas側へ別判定を作らない。
3. identity / invalid / unsupported Rigは明示結果を返す。invalid dataを修復、削除、保存し直さない。
4. cacheを保存正本にしない。最初はFrameごとのstateless planで成立させる。
5. root Motion matrix、deformer、Part matrixを同じfieldへ畳み込まず、適用順を明示する。

## Slice 2: Pixi preview adapter

1. `AnimationTablePopup`の内部Layer previewでFolder Part subtreeの各Rasterへ同じevaluated matrixを適用する。
2. preview staging交換とcontainer順を変えない。
3. playback / onionも通常previewと同じrender planを使う。
4. working Layerの永続transformやDrawingSnapshotへposeを焼き込まない。
5. Table表示中 / Table閉鎖後CAFで同じFrame poseを表示する。

## Slice 3: Canvas compositor / Bake / export adapter

1. `TimelineFrameCompositor`がPixiと同じrender planを受け取り、Folder subtree合成へmatrixを適用する。
2. transformed boundsを共通affineで計算し、off-canvas / negative boundsを維持する。
3. Part適用後に既存CAF全体WARP / Control Mesh、最後にClip root Motionを適用する現行順を固定する。
4. flatten Bake、Layer構造保持Bake、GIF / APNG exportは既存compositor / samplerを再利用する。
5. structured BakeはPhase 6jでFrame 0 HOLDへ静止化した`rigMotion`と複製asset ID mapを使い、別Bake pose schemaを作らない。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-only。
- PSD recordは背面から前面。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのdata adapter境界。
- Clip root Motion、WARP mask、Control Mesh、physicsの正本を重複実装しない。
- Pixi / Canvas / Bake / exportで別FK、別RenderIsland判定、別motion samplerを作らない。

## このPhaseで行わないこと

- Animation Table Part子行、Rig Inspector、Canvas handle
- Part / BONE作成、親変更、Bind Pose編集UI
- 複数Part / nested Partの描画接続
- clippingを跨ぐ自動RenderIsland再編成
- BONE chain、IK、constraint、Mesh、SkinWeight、Perform、Draw Order、Dynamics、physics
- CAF内部FolderのLane化、mini TimelineModel
- Text、Deformer SELECT、WebGPU / SDF / MSDF
- Pixel Selection横断リファクタリング

## 停止条件

- PixiとCanvasで別のpose / RenderIsland判定が必要になる。
- Folder subtreeを一つのmatrixで動かすだけでclipping owner / sourceが壊れる。
- root MotionまたはWARPと二重transformになる。
- RigなしProjectのpixel / bounds / save shapeが変わる。
- working LayerまたはUI stateをRig描画正本へ昇格しないと成立しない。

停止条件に達した場合はUIへ進まず、`REVISE`として固定入力、原因、fallback境界を本書へ記録する。

## 検証

- 変更JSすべてへ`node --check`。
- `verify-part-rig-core.mjs`、`verify-clip-bake-sampler.mjs`、`verify-structured-bake-model.mjs`、`verify-warp-placement.mjs`。
- 新規fixed-inputでFolder Part identity / translation / rotation / scale、clipping内包 / 分断拒否、negative bounds、random seek、Pixi / Canvas matrix / pixel一致を確認する。
- `npm.cmd run build`。
- Browserで通常描画、Animation Table open / close、CAF選択、Table表示中 / 閉鎖後のPart pose、playback / onion、console errorを確認する。
- build後は`tegaki_work/dist/`生成差分を残さない。稼働中dev server由来の既存`tegaki_work/node_modules/.vite/`差分は維持する。

## 最初の作業

1. scoped `git status`で既存差分を維持する。
2. `TimelineFrameCompositor`とPixi内部Layer previewの現行tree / clipping / boundsを固定入力化する。
3. 一つのFolder Part用render planとclipping分断validatorを純粋moduleとして先に作る。
4. Canvas fixed-inputを先に通し、その同じplanをPixiへ接続する。

## 完了結果

判定は`GO`。Phase 6kを完了する。

- `evaluateRigidParts()`の結果から、一つのCAF内部Folder subtreeとworld matrixを解決する純粋`folder-part-render-plan.js`を追加した。
- clipping owner / sourceがFolder Part境界を跨ぐ構成は共通validatorで`invalid`とし、既存Raster表示へfallbackする。複数PartとRaster PartはPhase 6kの`unsupported`として同じfallbackを使う。
- Pixi内部Layer preview、playback、onionとCanvas compositor / Bake / exportが同じrender planを使う。Folder Part適用後に既存WARP、最後にClip root Motionを適用する順を維持した。
- transformed / negative boundsは共有affine bounds helperで計算する。working Layer、DrawingSnapshot、保存正本へposeを焼き込まない。
- Table表示中だけでなく、Tableを閉じた選択CAFでもactive FrameのFolder Part poseを既存preview adapterで表示する。stroke / transform中は既存working Layer表示へ戻す。
- Project読込直後のpreview更新はLayer / working adapter復元後に一度だけ行い、raw working表示との二重表示を避けた。

検証結果:

- 変更JSの`node --check`はすべて成功した。
- `verify-folder-part-render-plan.mjs`で一つのRenderIsland、clipping内包 / 双方向の分断拒否、identity / translation / rotation / scale、negative bounds、random seek、Canvas matrix適用を確認した。
- `verify-part-rig-core.mjs`、`verify-clip-bake-sampler.mjs`、`verify-structured-bake-model.mjs`、`verify-warp-placement.mjs`はすべて成功した。
- BrowserでProject読込直後とTable閉鎖後のF1 / F3 pose、Table表示中のF1 / F2 / F3、playback loop、Timeline onion、通常Layer描画、console errorなしを確認した。
- `npm.cmd run build`は成功した。既知の`ag-psd` externalize警告とchunk size警告だけを維持する。

Phase 6lではPlan Aの選択CAF Part子行、Folder Part登録、Part key編集、Canvas handleを一つのFolder Partへ限定して接続する。BONE chain、Mesh、複数 / nested Partはまだ開始しない。
