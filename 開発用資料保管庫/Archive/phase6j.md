# Phase 6j: CAF Part Registry・rigid FK基盤

更新日: 2026-07-28

## 現在地

- Phase 6i Gate 0は`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6i.md`。
- CAF内部Layer / Folderのstable IDはPart identityとして再利用できる。
- 表示親`parentLayerId`、配列の表示順、clipping source、rig親`parentPartId`は別契約とする。
- 本Phaseは描画UIへ進む前に、optional schema、validation、ID remap、純粋transform sampling / rigid FKを固定入力で成立させる。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6i.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
9. `tegaki_work/system/animation/animation-data-model.js`
10. `tegaki_work/system/animation/clip-transform-sampler.js`
11. `tegaki_work/system/transform-math.js`
12. `tegaki_work/system/animation/clip-bake-sampler.js`
13. `tegaki_work/ui/animation-table-popup.js`
14. `tegaki_work/system/project-manager.js`
15. `tegaki_work/build/verify-structured-bake-model.mjs`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`も通常は読まない。

## 目的

CAF内部Layer / Folder IDをPart identityとして参照する最小Rig schemaをoptionalに追加し、旧Projectの結果を変えずに、save / load、History、CAF複製、共通sampling、2段rigid FKを純粋データ上で成立させる。Phase 6jではPixi / Canvas描画、Animation Table子行、Canvas handle、BONE UIは追加しない。

## Slice 0: 変更前固定入力とschema契約

最初に既存の次を固定入力化する。

1. Rig fieldなしClipAsset / ClipInstanceのserialize round-tripが従来shapeと結果を維持する。
2. nested内部Folder、clipping、display order、asset / subtree duplicateの現行ID mapを記録する。
3. root MotionのHOLD / LINEAR / cubic-bezier、anchor、position / scale / rotation sampling結果を固定する。
4. `duplicateClipAsset()`、CAF copy / paste、asset-scoped History、timeline-scoped Historyのclone地点を列挙する。

schema候補は次を第一案とし、実装前の固定入力で命名衝突があれば本書へ理由を記録して修正する。

```text
ClipAsset.rigDefinition? = {
  version: 1,
  parts: [{
    partId,             # 対象internal Layer / Folderのidと同じ値
    parentPartId,       # rig親。parentLayerIdとは別
    bindTransform       # local position / rotation / optional scale / pivot
  }]
}

ClipInstance.rigMotion? = {
  version: 1,
  partTracks: [{
    partId,
    keyframes           # Clip-local Frame。root Motionと同じ補間契約を再利用
  }]
}
```

- `partId`と`targetLayerId`を同義で二重保存しない。
- `rigDefinition` / `rigMotion`欠損はidentityであり、旧Project serializeへ空objectを強制追加しない。
- Clip root Motionは既存`transform` / `transformKeyframes`だけが所有する。
- Bind値とAnimate keyを同じfieldへ混ぜない。

## Slice 1: pure model / validation / remap

1. Rig schemaのclone / normalize / serializeをPixi、DOM、global stateへ依存しないmoduleへ置く。
2. 次を無言修復せずvalidation errorとして返す。
   - dangling `partId` / `parentPartId`
   - duplicate Part
   - self parent / cycle
   - 非finite transform
   - Clip duration外key
3. `duplicateClipAsset()`と内部subtree duplicate / pasteが使う共通ID remap helperを作る。
4. `duplicateClipAsset()`は旧call siteを壊さず、内部Layer ID mapを結果へ返せるようにする。
5. asset複製時は静的Part参照、CAF paste時はClipInstanceの`rigMotion.partId`を同じmapで更新する。
6. Part付き内部subtreeの単独copy / paste semanticsが確定しない間は、既存Raster / Folderを壊さず明示的に操作拒否できる境界を用意する。暗黙にrig fieldだけ落とさない。

## Slice 2: transform-track sampler / rigid FK proof

1. 既存`sampleClipTransform()`の補間coreを純粋なtransform-track samplerとして再利用可能にする。root Motionの出力を変えない。
2. affine matrix compose / multiply / inverseと有限値validationを`transform-math.js`または限定moduleへ追加する。
3. `sampleRigInstanceMotion()`とstateless `evaluateRigidParts()`を一つの純粋評価経路として作る。
4. root → childの2段で、bind local transformとsampled local deltaからworld matrixを得る。
5. 配列順やDOM順ではなくrig parent forestのtopological orderで評価する。
6. random seekと0からの順次sampleが同じ結果になることを固定入力で確認する。runtime cacheはまだ持たない。

## History / save / copyの契約

- `ClipAssetModel.serialize()`、`ClipInstanceModel.serialize()`、constructor normalizeを同時に更新する。
- `ProjectManager`はmodel serializeの収集者に留め、別Rig保存正本を追加しない。
- Animation Tableのmanual Clip cloneへ`rigMotion`を追加し、asset History / timeline Historyの双方でIDとkeyを維持する。
- CAF copy / pasteはsource assetごとに一度だけassetを複製する既存共有規則を維持する。
- 1 command = 1 History。validation失敗またはcancel時はmodel、snapshot、Historyを変更しない。
- Project load時にinvalid Rigを見つけた場合、Raster / CAFの読み込みまで破壊せず、Rigだけを有効化しない明示結果を設計する。無言でparentやkeyを削除しない。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- preview staging交換と`background -> back preview -> currentFrameContainer -> front preview`順。
- 上側Laneが前面。
- Lane / Timeline onionはdisplay-only。
- PSD recordは背面から前面。
- animation working Layerは保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのadapter境界。
- Clip Motion、WARP mask、Control Mesh、physicsの正本を重複実装しない。
- root Motionの既存固定入力と旧Project pixelを変えない。

## このPhaseで行わないこと

- Pixi preview / Canvas compositorへのPart transform適用
- Animation Table子行、Rig Inspector、Canvas handle
- BONE UI、Bind Pose編集UI、IK、constraint
- Triangle Mesh、SkinWeight、ControlHandle、Perform、Draw Order、Dynamics、physics
- clipping owner / sourceを跨ぐPartの自動RenderIsland生成
- CAF内部Folderの実Lane化、mini TimelineModel
- Text、Deformer SELECT、WebGPU / SDF / MSDF
- Pixel Selection横断リファクタリング

## 停止条件

- Rigなしserializeまたはroot Motion sampleが変わる。
- 表示親、表示順、clippingをrig親へ暗黙同期しないと成立しない。
- asset / CAF copyで同じID mapを使えずdangling参照が残る。
- History restoreとProject reloadで異なるRig ID / poseになる。
- pure evaluatorがPixi、Canvas、working Layerのいずれかへ依存する。
- Part transformとClip root transformが同じ値を所有する。

停止条件に達した場合はUIや描画へ進まず、`REVISE`としてPhase 6jへ原因と縮退案を記録する。

## 検証

- 変更JSすべてへ`node --check`。
- 既存`verify-clip-bake-sampler.mjs`、`verify-structured-bake-model.mjs`、`verify-warp-placement.mjs`。
- 新規fixed-input verifyでoptional field欠損、round-trip、cycle / dangling拒否、asset / CAF copy ID再map、Undo / Redo state、2段FK、random seek一致を確認する。
- `npm.cmd run build`。
- このPhaseは描画UI非変更のためBrowser受入は回帰確認に限定する。Animation Table open / close、CAF選択、通常描画、console errorを確認する。
- build後は`tegaki_work/dist/`の生成差分を残さない。稼働中dev server由来の`tegaki_work/node_modules/.vite/`既存差分は維持する。

## 最初の作業

1. scoped `git status`で既存差分を維持する。
2. Slice 0のfixed-input verifyを先に追加する。
3. schema名とID remap表を本書へ追記する。
4. pure model / validation / remapだけを実装し、描画やUIへ接続しない。

## 完了結果

完了日: 2026-07-28  
判定: `GO`。Phase 6kのpreview / compositor接続へ進める。

### 確定schemaとID map

| 保存先 | field | ID契約 | 欠損時 |
|---|---|---|---|
| `ClipAsset` | `rigDefinition.version = 1` | schema version | field自体をserializeしない |
| `ClipAsset` | `rigDefinition.parts[].partId` | 対象internal Layer / Folderの`id` | Partなし |
| `ClipAsset` | `rigDefinition.parts[].parentPartId` | rig親Partの`partId`。`parentLayerId`とは独立 | root Part |
| `ClipAsset` | `rigDefinition.parts[].bindTransform` | local bindのposition / scale / rotation / pivot | identity補完 |
| `ClipInstance` | `rigMotion.version = 1` | schema version | field自体をserializeしない |
| `ClipInstance` | `rigMotion.partTracks[].partId` | 同じasset内Partの`partId` | trackなし |
| `ClipInstance` | `rigMotion.partTracks[].keyframes` | Clip-local Frame。root Motion samplerと補間coreを共有 | identity motion |

`duplicateClipAsset()`が返す`internalLayerIdMap`を、静的`rigDefinition`とCAF paste / structured Bakeの`rigMotion`へ共通利用する。Part付き内部subtreeのduplicate / copy / delete / mergeは、cross-asset semantics確定前には`rig-part-subtree-unsupported`で無変更拒否する。

### 実装

- `part-rig.js`へoptional schema normalize / serialize、cycle / dangling / duplicate / 非finite / duration外key validator、Rig参照remap、stateless rigid FKを追加した。
- `clip-transform-sampler.js`から`sampleTransformTrack()`を抽出し、root MotionのHOLD / LINEAR / cubic-bezier / anchor結果を維持した。
- `transform-math.js`へpivot対応affine生成とmatrix multiplyを追加し、既存inverse point経路と併用する。
- `ClipAssetModel` / `ClipInstanceModel`のconstructor / serialize、asset / timeline History clone、CAF copy / paste、retime、structured Bake、Project load検証へRig fieldを接続した。ProjectManagerは保存正本を持たず、invalid Rigを警告してRaster / CAF読込を維持する。
- pure evaluatorはPixi、Canvas、DOM、working Layer、Historyへ依存しない。Phase 6jでは描画へ接続していない。

### 検証

- `node --check`: 変更JSと新規verify成功。
- `node build/verify-part-rig-core.mjs`: optional field欠損、root Motion固定入力、validation、同一ID map、Project / History round-trip、2段FK、random seek、Bake成功。
- `verify-clip-bake-sampler.mjs`、`verify-structured-bake-model.mjs`、`verify-warp-placement.mjs`: 成功。
- `npm.cmd run build`: 成功。既知の`ag-psd` externalizeとchunk size warningのみ。
- Browser: 通常Layer描画、QTP、Animation Table open / close、CAF選択、Table閉鎖後のCAF選択維持、console warning / errorなし。
- build生成`dist/`差分は除去し、稼働中dev server由来の既存`.vite`差分は維持した。
