# Phase 6i: CAF内部Part / Folder・Rig Gate 0

更新日: 2026-07-28

## 現在地

- Phase 6hまで完了した。完了記録は`開発用資料保管庫/Archive/phase6h.md`。
- UIはBrowser 100%のまま従来80%相当へ整理済み。Canvas / pointer座標は変更していない。
- 次の関心はCAF内FolderのLane投影とBONE系列だが、保存・評価正本を増やす前にproposal 15のGate 0を独立して行う。
- 正式名称は`BONE`。過去の`BORN`表記は誤記として復活させない。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6h.md`
6. `開発用資料保管庫/proposals/00_計画索引.md`
7. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
8. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
9. `開発用資料保管庫/proposals/14_UIツール導線・Text・階層Motion将来設計.md`
10. `tegaki_work/system/animation/animation-data-model.js`
11. `tegaki_work/ui/animation-table-popup.js`
12. `tegaki_work/ui/timeline-ui.js`
13. `tegaki_work/ui/layer-panel-renderer.js`
14. `tegaki_work/system/layer-system.js`
15. `tegaki_work/system/project-manager.js`
16. `tegaki_work/system/drawing-clipboard.js`
17. `tegaki_work/system/animation/motion-key-clipboard.js`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`も、現行正本で情報不足になった場合だけ参照する。

## 目的

CAF内部Raster / Folderを将来のPartとして扱い、少数BONEのrigid FKへ進める前に、所有・stable ID・評価順・操作・UI投影の契約を実コードで固定する。Gate 0では機能を実装せず、既存正本の再利用点、不足契約、重複実装になる案を明示する。

## Slice 0: 現行正本と変換境界の監査

次を同じIDとデータの流れで追跡する。

1. `TimelineModel`、`ClipAsset`、`ClipInstance`、`DrawingSnapshot`が何を所有し、serialize / restoreでどこへ戻るか。
2. CAF内部Layer / Folderのstable ID、parent、表示順、clipping source、working Layer IDの対応。
3. 通常LayerとCAF内部Layerを共有UIへ渡すdata adapter、選択CAFとcurrent Frameの同期方向。
4. Clip Motion、WARP、内部Layer合成、Folder clipping、preview、playback、onion、Bake、exportの評価順と共通sampler。
5. Layer / Folderのadd、delete、move、rename、visibility、copy / paste、Undo / Redo、Project save / loadで再利用できるcommandと不足点。
6. Animation Table親CAF行からPart子行を投影するPlan Aと、Rig Inspectorへ分離するPlan BのDOM / event / narrow-width境界。

## Gate成果物

本書へ次を追記し、実装Phaseを分ける。

- 現行構造図と所有表
- stable ID / parent / display order / rig hierarchyの区別
- preview / playback / onion / Bake / exportの評価順
- History / copy / paste / save / load操作表
- 再利用module、重複候補、不足契約、risk
- UI Plan A / B比較と切替条件
- 最小prototypeの対象と対象外
- 次Phase分割案
- `GO / REVISE / STOP`判定

第一候補は、静的なPart / RigDefinitionをClipAsset側、時間変化するrig poseをClipInstance側に置き、既存Clip-local Frameとtransform samplerを拡張する案。ただしGate 0の実コード照合前には確定しない。Folderの表示親子・clippingとrig hierarchyを同一fieldへ暗黙統合しない。

## 最初の作業

1. 次の既存差分を確認し、すべて維持する。

   `git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive`

2. class、event、serialize field、ID生成、copy / paste、History commandを`rg`で全検索する。
3. Slice 0の所有表と評価順を本書へ追記する。schemaやUIはまだ変更しない。
4. 不足が見つかった場合も、実装候補と停止条件を先に記述し、Gate判定まで新しい正本を追加しない。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-onlyであり、保存画像、export、Layer visibility、ClipAsset / DrawingSnapshot、Historyへ混ぜない。
- PSD recordは背面から前面。CAF内部Layerの前面から背面という保持順だけを必要地点で反転する。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clippingと通常Layer / CAF内部Layerのdata adapter境界を維持する。
- Motion、WARP mask、Mesh、physicsの正本を重複実装しない。
- preview / playback / onion / Bake / exportで別solverや別samplerを作らない。

## 停止条件

- Clip Motionとrig motionが同じtransformを重複所有する。
- Folder parent / display order / clippingとrig hierarchyを安全に分離できない。
- stable IDをcopy / paste、Undo / Redo、save / loadで維持または再mapできない。
- previewとexportで評価器が分裂する。
- working Layerを保存正本へ昇格しないと成立しない。
- 通常 / Table表示中 / Table閉鎖後CAFで、同じ固定入力のRaster確定位置、Undo / Redo、保存 / 再open結果が異なる。

停止条件に達した場合は機能追加を止め、原因とPlan Bを記録して`REVISE`または`STOP`とする。

## このPhaseで行わないこと

- BONE UI、Bind Pose、FK solver、constraintの実装
- Triangle Mesh、SkinWeight、Quick Rig、IK、Perform、Draw Order、Dynamics、physics
- CAF内部Folderを実際にLane化すること
- 階層ごとのmini CAF / TimelineModel追加
- Text、Deformer SELECT、Camera、WebGPU / SDF / MSDF
- Pixel Selection主要classの再構成や全状態の一括リファクタリング
- proposal過去案の再整理

## 検証

- Gate 0だけならコード変更を行わず、検索結果、所有表、操作表、評価順の相互参照を確認する。
- JSを変更する必要が生じた場合は対象を局所化し、変更JSへ`node --check`、`npm.cmd run build`、関連するBrowser実操作、console error確認を行う。
- build後は`tegaki_work/dist/`の生成差分を残さない。稼働中dev server由来の`tegaki_work/node_modules/.vite/`既存差分は維持する。

## Gate 0監査結果

監査日: 2026-07-28

### 判定

`GO`。ただし次の3条件を、描画UIより先にPhase 6jの実装契約として満たす。

1. CAF内部Layer / Folderの`id`をPart参照IDとして再利用してよいが、表示親`parentLayerId`とrig親`parentPartId`を同じfieldにしない。
2. ClipAsset / 内部subtreeの複製・paste時に、Layer ID、Part参照、rig motion参照を同じID mapで再mapする。各commandで個別置換しない。
3. Part pose / rigid FKは純粋評価器を1つだけ持ち、Pixi previewとCanvas compositorへ同じ評価結果を渡す。UI、Bake、export専用solverを作らない。

既存正本だけでこの3条件を満たす場所は確保できる。停止条件には達していない。一方、現在のcopy helperと内部Layer合成はrig参照を知らないため、schemaだけ先に追加してUIから書き込む実装は不可とする。

### 現行構造図

```text
TimelineModel
├─ tracks[] / LaneModel
│  └─ cels[] / ClipInstanceModel
│     ├─ assetId ───────────────────────────────┐
│     ├─ transform / transformKeyframes         │ Clip root Motion
│     └─ deformer                               │ WARP / Control Mesh
├─ clipAssets[] / ClipAssetModel ◀──────────────┘
│  ├─ drawingSnapshotId                         primary互換参照
│  └─ internalLayers[] / ClipAssetInternalLayerModel
│     ├─ id / parentLayerId / array index        表示treeと前後順
│     └─ drawingSnapshotId ───────────────────┐
└─ drawingSnapshots[] / DrawingSnapshotModel ◀┘ Raster正本

LayerSystem
└─ animation working Layer                      表示・入力adapterのみ
   └─ animationSnapshotId                        選択CAF snapshotへのruntime対応

LayerPanelRenderer / AnimationTablePopup
└─ selectedCelId / selectedInternalLayerIdから投影。保存正本を持たない
```

### 所有表

| データ | 現行所有者 | save / restore | Gate判断 |
|---|---|---|---|
| Raster pixels / bounds | `DrawingSnapshotModel` | `TimelineModel.serialize()` → `ProjectManager` → `new TimelineModel()` | 維持する |
| CAF内部Raster / Folderの構造 | `ClipAssetModel.internalLayers[]` | `ClipAssetModel.serialize()` | 静的Part定義の所有先に使える |
| CAF配置、時間、root Motion | `ClipInstanceModel` | `LaneModel.serialize()`経由 | 時間変化するPart poseの所有先に使える |
| WARP / Control Mesh pose | `ClipInstanceModel.deformer` | ClipInstance serialize | Rig fieldへ複製しない |
| `physics` | `ClipInstanceModel.physics`の既存予約field | ClipInstance serialize | Rig / Dynamics正本へ流用しない。正式Phaseまでopaque互換field |
| working Layer | `LayerSystem` runtime | 通常Project Layerとしては保存しない | adapterのまま維持する |
| CAF内部選択 / Folder開閉 | Animation Table / Layer Panel runtime UI | 選択の一部だけ`animationState`、折りたたみはruntime | RigDefinitionに保存しない |

### ID、親、順序、rig hierarchy

| 概念 | 現行契約 | Part導入後の契約 |
|---|---|---|
| 内部Layer / Folder ID | `crypto.randomUUID()`等で生成し、save / load、asset Historyでは維持 | Part identityとして再利用する。別の同義Part IDを作らない |
| snapshot ID | Layerとは別ID。Raster更新時に新Snapshotへ差し替わる | Part参照に使わない |
| 表示親 | `parentLayerId`。Folder表示、visibility、opacity、blend、clippingに使用 | rig親子変更では変更しない |
| 表示順 | `internalLayers[]`の先頭が前面。描画時だけ逆順に合成 | rig階層順へ並べ替えない |
| clipping source | 同じ表示親の次の要素を`internal-layer-clipping-contract.js`で解決 | rig親をclipping source判定へ使わない |
| rig親 | 現在なし | `parentPartId`を明示し、単一親forest・cycle拒否とする |
| working Layer ID | drawable内部Layerの配列indexからruntime working Layerへ対応 | Part IDとして保存しない |

内部Layer / Folderのduplicate、subtree copy / paste、ClipAsset複製は新IDを生成し、`parentLayerId`だけを現在再mapする。whole Project save / loadとUndo / Redoは同じIDを維持する。したがって将来の`rigDefinition.parts[]`は内部Layer IDをPart IDとして使えるが、既存duplicate結果はID mapを返さずrig参照も更新しない。この不足をPhase 6jで先に解消する。

### adapterと同期方向

1. 選択CAFは`selectedCelId → ClipInstance.assetId → ClipAsset.internalLayers`で解決する。
2. `selectedInternalLayerId`はClipAsset内部IDであり、Layer Panel mirrorとAnimation Table inspectorが共有する。
3. `AnimationTablePopup._syncClipAssetToWorkingLayers()`がdrawable内部Layerをflatなworking Layerへ復元し、名前、opacity、blend、effective visibility、clipping adapter情報を付与する。
4. 描画確定はworking LayerのRasterを新しい`DrawingSnapshotModel`へcaptureし、内部Layerの`drawingSnapshotId`を差し替える。
5. Layer PanelのCAF card adapterはrename、visibility、clipping、moveをAnimation Tableへ委譲する。Layer Panel側へ別commandや別modelを追加しない。

Folderはworking Layerを持たず、選択Folderのtransformは子孫drawable working Layerへ一時投影して確定する。rigid Part previewをworking Layerの永続transformへ載せると保存正本と二重になるため禁止する。

### 現行評価順とPart挿入点

```text
Project Frame
→ Clip-local Frame
→ CAF内部treeを背面から前面へ合成
   → Raster snapshot
   → clipping owner/source mask
   → Layer opacity / blend
   → Folder子合成
   → Folder opacity / blend
→ ClipInstance.deformerをsampleし、CAF全体へWARP / Control Mesh
→ ClipInstance root Motionをsample
→ Lane合成（上側Laneが前面）
→ preview staging交換 または Canvas export出力
```

- 通常preview、playback、onionは`AnimationTablePopup._renderCelPreview()`系を使う。
- GIF / APNG等のAnimation exportとflatten Bakeは`TimelineFrameCompositor`を使う。
- root Motionは`sampleClipTransform()`、WARP / Control Meshは`sampleClipDeformer()`、clipping owner/sourceは`internal-layer-clipping-contract.js`を両backendで共有する。
- 内部tree traversalとgroup合成自体はPixi版とCanvas版の2 adapterに分かれている。ここへ別々のFKを実装してはならない。

Part rigid FKの初期挿入点は、Clip-local Frame変換後、内部tree合成中のPart境界、CAF全体WARPより前とする。純粋評価器が`partId → local/world affine matrix`を一度計算し、Pixi / Canvas adapterが同じmatrixを適用する。Clip root Motionは従来通り最後に適用する。

clipping ownerとsourceを異なるPart transformへ分離すると現行mask空間が壊れる。最小prototypeでは、Part境界がclipping owner/sourceを分断する構成を明示拒否し、同一Folder subtreeを一つのRenderIslandとして扱う。自動RenderIsland再編成とDraw Orderは後続Phaseへ送る。

### 操作・History・copy / paste・保存表

| 操作 | 現行再利用点 | Part導入前の不足 / 方針 |
|---|---|---|
| add Folder / Layer | TimelineModelの既存作成API、asset-scoped History | Part化は別の明示操作。作成だけで暗黙Part化しない |
| rename / visibility / clipping | Layer Panel adapterからAnimation Table commandへ委譲 | rig定義を変更しない |
| display move / Folder移動 | complete subtreeを移す`moveInternalLayerToPosition()` | `parentPartId`とPart track順を変更しない |
| delete | subtree削除、last drawable保護、asset History | rig参照 / keyがあるPartは無言削除しない。初期は明示解除または操作拒否 |
| 内部subtree duplicate | Layer / Snapshotを新ID化し表示親を再map | Part定義と全参照用の共通ID mapが必要。対応前はPart付きsubtreeを拒否 |
| 内部subtree clipboard | runtime clipboard、paste時に新ID化 | 表示親とrig親を別々に再map。外部rig親を表示親へ代入しない |
| CAF copy / paste | source assetごとに一度`duplicateClipAsset()`し、Clip metadataを複製 | `duplicateClipAsset()`からID mapを返し、asset静的参照と貼付Clipのrig motionを同じmapで更新 |
| Undo / Redo | asset-scoped stateとtimeline-scoped stateを`new ClipAssetModel()` / `new TimelineModel()`で復元 | `serialize()`とmanual cloneへrig fieldを追加し、1 gesture = 1 Historyを維持 |
| Project save / load | ClipAsset / ClipInstance serializeをProjectManagerが収集 | optional field欠損はidentity。dangling / cycleは無言修復せず明示validation結果を返す |
| structured Bake | `sampleClipBakeState()`でroot Motion / deformerを1 Frame化しassetを複製 | 将来はrig poseもFrame 0のhold stateへsampleする。別Bake motion schemaは作らない |
| flatten Bake / export | `TimelineFrameCompositor` | shared evaluated Part matrixを内部合成へ適用すれば自動追従させる |

### 再利用module

- `animation-data-model.js`: ClipAsset / ClipInstance / stable ID / serialize / duplicateの所有場所。
- `clip-transform-sampler.js`: Clip-local Frame、HOLD / LINEAR / easing、position / scale / rotationの共通sampling。Part用に純粋transform-track coreを抽出し、root Motionからも呼ぶ。
- `transform-math.js`: affine生成、point変換、inverse、anchor rebase。hierarchy合成用matrix multiplyとvalidationだけを純粋追加する。
- `internal-layer-clipping-contract.js`: clipping owner / source / Folder descendantの唯一の解決契約。
- `timeline-frame-compositor.js`: export / flatten BakeのCanvas reference backend。
- `animation-table-popup.js`: Pixi preview、selected Clip / Frame、asset / timeline History、working Layer同期のcommand owner。
- `layer-panel-renderer.js`: 既存の1 UI engine / 2 data adapterを維持する構造編集projection。
- `control-mesh-topology.js` / `control-mesh-deformer.js`: 後続Mesh proofの候補。rigid Part FKの正本へ流用しない。
- `coordinateSystem.screenClientToWorld()`、既存pointer capture、gesture History: 後続Canvas handle入力で再利用する。

### 重複禁止と不足契約

重複禁止:

- `parentLayerId`をrig親として兼用すること。
- working Layer transform、DOM child row、selected stateをRig保存正本にすること。
- `ClipInstance.transformKeyframes`と同じroot運動を`rigMotion`へ複製すること。
- WARP / Control MeshをPart MeshまたはSkinningとして再命名コピーすること。
- Pixi、Canvas、Bake、exportごとのFK / constraint solver。

Phase 6jで先に必要な契約:

1. optional `ClipAsset.rigDefinition`と`ClipInstance.rigMotion`のnormalize / serialize / validate。
2. 内部Layer IDをPart identityとする明文化と、別fieldの`parentPartId`。
3. cycle、dangling ID、duplicate Part、非finite transformを拒否する純粋validator。
4. asset / subtree複製の共通ID remap helperと、操作側へ返すID map。
5. root Motionと共有するtransform-track sampler、およびstateless rigid FK evaluator。
6. current previewとcompositorが同じ評価結果を受け取れるadapter contract。

### risk

- 現行内部Layer constructorはdangling / cyclic `parentLayerId`を読め、各traversalは`visited`で停止するだけである。Rigはこれを暗黙修復の先例にしない。
- previewとCanvas compositorは内部合成を別実装している。shared samplerだけでなく、Part境界 / RenderIsland判定も共有しないと見た目が分裂する。
- ClipAssetは複数ClipInstanceから共有される。内部Part構造変更時、全Instanceのrig motion参照を検査しないとdangling trackが生じる。
- 現在のstructured Bakeはroot Motion / deformerだけを静止化する。rig導入後に未対応のまま通すと出力CAFが動かない。
- `physics`既存fieldを短絡的にrig motionへ流用すると、将来Dynamicsと所有が衝突する。
- Part数に比例してAnimation Table子行が増える。DOM全Frameセルを各Part分常時作る案は、大規模Rigで縦横双方の負荷になる。

### UI Plan A / B

| 比較 | Plan A: Animation Table子行 | Plan B: Rig Inspector / Tree |
|---|---|---|
| 初期採用 | 採用 | fallbackとして設計だけ維持 |
| 正本 | 選択Clipの`rigDefinition` / `rigMotion`から一時projection | 同じ正本からprojection |
| 時間軸 | 親CAFと既存Frame / currentFrame / zoomを共有 | Timelineは選択Part trackだけ表示 |
| DOM | 親CAF行を開いた時だけ、label行とframe行を同じ`rowProjection[]`から生成 | 専用tree。Animation Tableへ別Timelineを作らない |
| 最初の操作 | expand / collapse、Part選択、key表示 | parent変更、constraint、weight等のSetup操作 |
| touch / narrow | 既存26px visual row、coarse時32px hit areaを維持。indent後の名称幅を計測 | 下部sheetまたはContextual Inspector候補 |

Plan AからPlan Bへ切り替える条件:

- 展開子行がAnimation Table表示高の40%を継続して超える。
- indent後のPart名表示幅が48px未満となり、識別不能になる。
- Setup / Animate、parent変更、constraint等をTimeline行へ詰める必要が出る。
- pen / touchで親CAF選択とPart選択が誤操作になる。

Plan Aの初期実装では、選択CAF一件だけを展開し、子行D&D、parent変更、複数CAF同時展開、mini TimelineModel、全Partの常時DOM化を行わない。

### 最小prototype

対象:

- 一つのClipAsset内にroot Part 1、child Part 1。
- Part identityは既存内部Folder / Raster ID。
- 表示親と異なる明示`parentPartId`。
- bind local transformと、ClipInstance側のClip-local position / rotation / optional scale key。
- stateless rigid FK、random seekと順次sampleの一致。
- Project round-trip、asset / CAF copyのID再map、Undo / Redo。
- 固定入力でPixi previewとCanvas compositorのbounds / pixel一致。

対象外:

- BONE UI、IK、constraint、SkinWeight、Triangle Mesh、ControlHandle、Draw Order、Dynamics、physics。
- clipping owner/sourceを異なるPartへ分離する構成。
- Part付き内部subtreeのcross-asset clipboard。
- multiple Rig version migration、GPU cache、generator。

### 次Phase分割

1. Phase 6j: Part registry、optional schema、validation、共通ID remap、純粋transform-track / rigid FK fixed-input proof。描画UIはまだ追加しない。
2. Phase 6k: 一つのFolder PartをPixi previewとCanvas compositorへ接続し、clipping境界、Bake、export、旧Project無変更を確認する。
3. Phase 6l: Plan Aの選択CAF子行、Part key編集、Canvas handle、1 gesture = 1 History。実測でPlan B切替を判定する。
4. Phase 6m以降: Bind Pose / BONE chainを同じPart evaluatorへ接続する。Mesh / SkinWeightはrigid Part受入後に別Gateとする。

### 監査検証

- `node build/verify-clip-bake-sampler.mjs`: Motion、WARP GRID placement、Control Mesh静的sampling成功。
- `node build/verify-structured-bake-model.mjs`: nested Folder、normal / inverse clipping、blend / opacity / visibility、off-canvas bounds、Frame別Motion / WARP、独立編集、Project round-trip成功。
- `node build/verify-warp-placement.mjs`: 4x4 / Control Mesh / legacy / interpolation / affine / round-trip成功。
- Gate 0は文書変更だけであり、JS変更、build、Browser変更は行っていない。稼働中dev serverと既存`.vite`差分を維持した。

Phase 6iはGate成果物と`GO`条件を確定して完了した。次の現行指示書は`task-codex/phase6j.md`。
