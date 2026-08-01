# Phase 6s: Folder別WARP GRID Gate 0

推奨モデル:

- Gate 0設計: `gpt-5.6-sol / high〜xhigh`
- GO後の限定実装: `gpt-5.6-terra / max`（LUNA MAX）
- 各Stageの最終レビュー: `gpt-5.6-sol / high〜xhigh`

## 1. 目的

CAF全体一件の`ClipInstance.deformer`を、CAF配下Folderごとにも適用できる構造へ拡張する。髪だけをWARPして顔を変形しない操作を実現する一方、既存CAF全体WARP、Motion、BONE / Folder RenderIsland、保存、History、Bake、exportの正本を重複させない。

Phase 6sは設計判断を確定するGate 0である。SOLが現行コードを監査し、GO時には後続のLUNA MAX実装Stageを迷いなく実行できる粒度まで契約を固定する。Gate 0中は製品コードへFolder別WARPを実装しない。

## 2. 現状

- WARP正本はClipInstance単位の`deformer`一件で、Bind、Pose、placement、key samplingを所有する。
- CAF内部Folder / Raster Layerはstable internal Layer IDを持つ。Rig / Part / BoneもこのIDと共通remapを使う。
- Folder subtreeは`folder-part-render-plan.js`で排他的RenderIslandとして解決され、Pixi previewとCanvas compositor / Bake / exportで共有される。
- CLIP MOTIONの対象tabにはFolder候補が表示されるが、WARPはCAF全体だけが有効である。UI tabを有効化するだけでは保存正本が存在しない。
- animation working Layerは表示・入力adapterであり、TimelineModel / ClipAsset / DrawingSnapshotが保存正本である。

## 3. 変更後の利用者仕様

Gate 0後の実装では、次を満たす。

- WARP tabで`CAF`またはCAF配下の対象Folderを選べる。
- Folderを選んで作成したGRID / keyは、そのFolder RenderIslandだけへ適用される。兄弟Folderや親CAF全体を変形しない。
- 対象切替後も、対象ごとのBind、Pose、placement、keyが復帰する。
- CAF全体WARPとFolder別WARPは併存でき、同一評価順でpreview / playback / onion / Bake / exportへ反映される。
- Folder削除、CAF copy / paste、Project save / load、Undo / Redoでdangling参照や別Folderへの誤適用を起こさない。
- 未設定Folder、旧Project、従来のCAF全体WARPは従来結果を維持する。

## 4. 不変条件

- stroke中working Layer表示。
- preview staging交換と`background -> back preview -> currentFrameContainer -> front preview`順。
- 上側Laneが前面、Lane / Timeline onionはdisplay-only。
- PSD record順、Folder clipping、clipping owner / sourceを分断しないRenderIsland境界。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- 既存`ClipInstance.transformKeyframes`、root `deformer`、RigDefinition、Rig Motionを並行再実装しない。
- random seekで同じFrameは同じ結果となり、preview / playback / Bake / exportで別solverを作らない。
- 1 gesture = 1 History。cancelは正本・cache・Historyへ残さない。
- PopupManager、既存shortcut、RIG / MOTION / WARP last-used tabを壊さない。

## 5. Gate 0で読む実装

- `tegaki_work/system/animation/animation-data-model.js`
- `tegaki_work/system/animation/clip-transform-sampler.js`
- `tegaki_work/system/animation/folder-part-render-plan.js`
- `tegaki_work/system/animation/timeline-frame-compositor.js`
- `tegaki_work/system/animation/clip-bake-sampler.js`
- WARPのnormalizer / sampler / rasterizer / Pixi adapter一式
- `tegaki_work/system/project-manager.js`
- `tegaki_work/ui/animation-table-popup.js`
- CAF duplicate / pasteでinternal Layer ID mapを作る経路
- 関連するProject / History / WARP / Bake verifier

新規field、event、setterを提案する前に、同じ責務の既存実装を`rg`で全検索する。EventBusを変更する場合は同名eventの送受信とpayloadを全検索する。

## 6. Gate 0で決める設計

### 6.1 所有shape

次の案を実コードと比較し、一つに決める。

- 第一候補: ClipInstanceにoptionalなFolder target collectionを追加し、各entryがstable Folder IDと既存deformer shapeを所有する。
- 代替案: 既存root `deformer`をtarget付きcollectionへ一般化する。

判定基準は、旧Project互換、CAF copy ID remap、History差分、root WARP無変更、空集合identity、JSON容量である。UI selectionやworking Layerへ正本を置く案は採用しない。

### 6.2 評価順

第一候補を次とする。

```text
Folder subtreeをRenderIslandへ合成
  -> Folder-local WARP
  -> Bone / Part world matrix
  -> CAF内部を再合成
  -> 既存CAF root WARP
  -> root Motion
  -> Lane合成
```

Folder-local WARPをBone / Partの前後どちらに置くかは、Bind座標、Canvas overlay座標、structured Bake結果を固定入力で比較して確定する。CPUとPixiで順序を分けない。

### 6.3 ライフサイクル

- Folder削除時のtarget entry削除またはdangling validation。
- Folder / CAF duplicate時のtarget Folder ID remap。
- Duration変更時のkey範囲処理。
- Undo / Redo snapshot、Project serialize / deserialize、Album外部snapshot。
- cache keyとdispose条件。Runtime mesh / textureをProject JSONへ入れない。

### 6.4 UI境界

- 既存のCAF / Folder対象tabと単一Inspectorを再利用する。
- WARP tabで対象Folderが未設定なら`GRIDを作成`を表示し、作成後はその対象のtool / keyへ切り替える。
- 複数Folderの数値欄を同時展開するUIは採用しない。
- UIはtarget IDを選ぶだけで、deformer copyを保持しない。

## 7. Gate 0成果物

SOLは実装前に次を本書へ追記する。

1. 採用shapeとfield名、旧JSON例、新JSON例。
2. normalize / validate / sample / set / remove APIと所有ファイル。
3. 評価順と座標系。Folder-local、CAF-local、Canvas座標の変換式。
4. copy remap、Folder削除、Duration変更、History、Project round-trip契約。
5. 固定fixtureと期待値。
6. `GO / REVISE / STOP`判定。
7. GO時は下記LUNA Stageを、確定した関数名・変更箇所・テスト名で更新する。

### 7.1 監査結果（2026-08-01）

実コード監査の結果、第一候補を採用し、`GO — Stage A`とする。既存root
`ClipInstance.deformer`は変更せず、同じClipInstanceへoptionalなFolder target collectionを
追加する。root WARPをtarget collectionへ移行する案は、旧Project、既存UI、Bake、verifierへ
不要な移行を発生させるため採用しない。

監査根拠:

- `ClipInstanceModel`はconstructor / `serialize()`の双方でroot `deformer`を
  `normalizeClipDeformer()`へ通し、ProjectManagerもTimelineのserialize結果をそのまま保存する。
- root WARPのtype dispatch、normalize、sampleは`clip-deformer.js`へ集約済みである。
- CPU compositorとPixi previewはともに、Folder Part / Bone matrixをCAF内部Rasterへ適用後、
  CAF全体root WARP、最後にroot Motionを適用している。
- `duplicateClipAsset()`はstable internal Layer IDの`internalLayerIdMap`を既に返し、Rigも同じmapを
  拡張してremapしている。Folder targetもこのmapを共有できる。
- Timeline HistoryはClip metadataを明示cloneするため、新fieldをclone / retime snapshotへ追加する必要がある。
  Internal Layer HistoryはClip metadataを含まないため、Folder targetを複製する操作には使わない。
- Project loadは`new TimelineModel(animationData)`へ集約される。runtime texture / meshを保存shapeへ入れる必要はない。

### 7.2 採用保存shape

field名は`ClipInstance.folderDeformers`とする。空または未設定は`null`とし、serialize時はfield自体を
省略する。target順は保存上の意味を持たず、normalize時に`folderLayerId`昇順へ固定する。

旧JSON:

```json
{
  "id": "clip-1",
  "assetId": "asset-1",
  "deformer": { "type": "warp-grid", "version": 1, "keyframes": [] }
}
```

新JSON:

```json
{
  "id": "clip-1",
  "assetId": "asset-1",
  "deformer": { "type": "warp-grid", "version": 1, "keyframes": [] },
  "folderDeformers": {
    "version": 1,
    "targets": [
      {
        "folderLayerId": "internal-folder-hair",
        "deformer": { "type": "control-mesh", "version": 1, "keyframes": [] }
      }
    ]
  }
}
```

契約:

- `folderLayerId`は同じClipが参照するClipAsset内のstable internal Layer IDで、対象は`type:'folder'`だけ。
- 各`deformer`はrootと同じ`normalizeClipDeformer()` / `sampleClipDeformer()`を使う。Folder専用の
  WARP schema、key sampler、placement schemaを作らない。
- 同一`folderLayerId`の重複、存在しないID、Raster Layer ID、未知version、invalid deformerはvalidation error。
- invalid Folder targetはFolder WARPだけを無効化し、Raster、既存Rig、root WARP、root Motionは読める状態を維持する。
- collectionが空ならidentity。旧Projectはfield欠損のままbyte互換の表示結果を維持する。

### 7.3 純粋APIと所有ファイル

`system/animation/clip-deformer.js`へ、既存root dispatcherを利用するcollection APIを置く。

- `normalizeClipFolderDeformers(value)`
- `serializeClipFolderDeformers(value)`
- `validateClipFolderDeformers(value, internalLayers)`
- `getClipFolderDeformer(value, folderLayerId)`
- `setClipFolderDeformerTarget(value, folderLayerId, deformer)`
- `removeClipFolderDeformerTarget(value, folderLayerId)`
- `sampleClipFolderDeformers(value, localFrame, duration)` — runtime `Map<folderLayerId, sample>`を返す
- `remapClipFolderDeformers(value, internalLayerIdMap)`

`system/animation/animation-data-model.js`は保存正本と参照validationだけを所有する。

- `ClipInstanceModel` constructor / `serialize()`へ`folderDeformers`を追加する。
- `TimelineModel.setClipFolderDeformer(clipId, folderLayerId, deformer)`
- `TimelineModel.removeClipFolderDeformer(clipId, folderLayerId)`
- `TimelineModel.validateFolderDeformers()`
- setterはClip、Asset、Folder型を検証してから一回でcollectionを交換し、UI stateを受け取らない。

`ProjectManager._restoreAnimationProjectData()`は`validatePartRigs()`と同様に
`validateFolderDeformers()`を呼び、invalid optional dataだけを警告する。

### 7.4 評価順とRenderIsland境界

共有評価順を次で確定する。

```text
対象Folderのexclusive Raster / clippingをCAF Project座標で合成
  -> sampled Folder deformer（既存CPU / Pixi WARP adapter）
  -> owning Bone delta / Part world matrixを一度適用
  -> Folder opacity / blendを含めCAF内部へ再合成
  -> 既存CAF root deformer
  -> 既存root Motion
  -> Lane合成
```

`folder-part-render-plan.js`へ`createFolderEffectRenderPlan(asset, clip, timelineFrame)`を追加する。
これは既存`createFolderPartRenderPlan()`、`evaluateRigidParts()`、`evaluateRigidBones()`を再利用し、
Folder targetを含むexclusive RenderIslandを返す。既存exportは互換維持する。

各Folder effect islandは最低限次を持つ。

```text
folderId / layerIds / sampledDeformer
partWorldMatrix / boneDeltaMatrix / worldMatrix
```

- target自身がPartならその`worldMatrix`、Part配下の通常Folderなら最も近いowning Partの`worldMatrix`、
  Part外ならidentityを使う。
- target Folder配下の通常Folder / Rasterは同じislandへ含める。
- target配下に別の登録Part、別のFolder WARP targetがある非線形nested境界は初期Sliceではunsupported。
  親WARPを子Partへ暗黙伝播したり二重適用したりしない。
- clipping owner / sourceがisland境界を跨ぐ場合も既存契約どおりunsupported。Folder WARPだけを適用せず、
  既存Raster / Rig表示へfallbackする。
- sibling Folder targetsは独立islandとして許可する。

CPUは`TimelineFrameCompositor`、Pixiは`AnimationTablePopup`が同じplanを消費する。両adapterとも
target Folder subtreeを一度だけoffscreen合成し、既存WARP rendererで変形後、island matrixを一度だけ
適用する。root WARP用の`_deformAssetSurface()` / `_createDeformerPreviewNode()`相当処理を共有可能な
private helperへ抽出してよいが、新しいsolverは作らない。

### 7.5 座標系

Folder deformerの`bindBounds`は、RenderIsland matrix適用前のCAF Project座標pxで保存する。
正規化点`p=(u,v)`からProject点`P`への式は既存root WARPと同じである。

```text
P.x = bindBounds.x + u * bindBounds.width
P.y = bindBounds.y + v * bindBounds.height
Q   = island.worldMatrix * FolderWarp(P)
R   = RootWarp(Q)
C   = RootMotion(R)
```

- Raster surface localは`local = project - surfaceBounds.xy`だけとし、保存正本へlocal座標を入れない。
- Canvas / screen座標は既存camera / Pixi world transform adapterで変換し、DOM倍率を式へ混ぜない。
- Folder target初期`bindBounds`は、そのexclusive islandに属する表示中Raster boundsのunionとする。
- integer output boundsは既存`Math.floor(min)` / `Math.ceil(max)`、premultiplied bilinear、半開triangle edgeを使う。
- Folder WARP編集時にroot WARPも存在する場合、初期Sliceでは選択Clipのroot WARP表示を一時bypassして
  pre-root座標でauthoringする。保存済みroot WARPは変更せず、playback / Bake / exportでは両方を順に適用する。

### 7.6 copy / delete / duration / History / Project契約

- Clip copyで同じAssetを参照する場合は`folderDeformers`をdeep cloneし、IDは維持する。
- CAF Asset duplicate / pasteは`duplicateClipAsset()`の`internalLayerIdMap`で全targetをremapする。
- structured Bakeは`sampleClipBakeState()`で各targetをFrame 0 HOLD一件へfreezeし、複製Assetのmapでremapする。
- internal Folder duplicateは、対象subtree内のFolder targetを、そのAssetを参照する各Clip上で新IDへcloneする。
  Clip metadataも変わるため、UIはInternal Layer HistoryではなくTimeline History一件で記録する。
- Folder targetまたはその祖先subtreeの削除 / mergeは、初期Sliceでは
  `folder-deformer-target-subtree-unsupported`として拒否する。WARPを削除後にFolderを削除する。
- rename / reorder / reparentはstable IDが変わらないためremapしない。
- 右端duration変更は、root deformerと同じ`_retimeTerminalKeyframes()`を全targetへ適用する。
  左端retimeは現行root WARPの挙動を維持する。
- Timeline History clone、retime lane snapshot、Clip clipboard、paste、rollbackへ`folderDeformers`を追加する。
- Project / AlbumはTimeline serializeだけを正本とし、working Layer、RenderTexture、Mesh、Map cacheを保存しない。

### 7.7 固定fixture

Stage A verifierは`build/verify-folder-deformer-model.mjs`とする。

- 旧Project field欠損identity、新shape normalize / serialize / round-trip。
- sibling 2 target、target順のcanonical化、duplicate / missing / Raster ID rejection。
- Clip clone ID維持、CAF duplicate / paste ID remap、internal Folder duplicate target clone。
- Folder削除 / merge rejection、duration terminal key retime、random seek。
- structured Bakeで全targetがFrame 0 HOLD一件となり、複製Asset IDへremapされる。

Stage B verifierは`build/verify-folder-deformer-render-plan.mjs`とする。

- 2色のsibling Folderの片側だけを変形し、他方のpixel hashが不変。
- target内nested通常Folder、normal / inverse clipping、opacity / blend、negative bounds。
- identity / translation / rotation / scaleのPart、Bone binding後へFolder WARPを一度だけ適用。
- root WARP、root Motionとの合成順、random seek、CPU / Pixi mesh data / structured Bake一致。
- nested target、target配下registered Part、cross-boundary clippingは明示unsupportedで既存表示へfallback。

### 7.8 Gate判定

判定は`GO — Stage A`。

LUNA MAXはStage Aだけを開始してよい。Stage Aでroot `deformer`のshape変更、別WARP sampler、
working Layer正本化、Internal Layer HistoryだけでClip metadataを変更する必要が出た場合は`STOP`して
SOLレビューへ戻す。

## 8. GO後のLUNA MAX実装Stage

Gate 0がGOになるまで開始しない。各StageはLUNA MAXが実装し、SOLが差分レビューしてから次へ進む。

### Stage A — 保存shapeと純粋API

- 対象: `clip-deformer.js`、`animation-data-model.js`、`clip-bake-sampler.js`、Clip / Asset copy-remap、
  `verify-folder-deformer-model.mjs`。
- UI authoring、Pixi、compositorは変更しない。ただし保存正本を落とさないため、
  `animation-table-popup.js`のTimeline History、Clip clipboard、paste、structured Bake、retime snapshotと、
  Internal Folder duplicateのTimeline Historyへ`folderDeformers`を追加する最小metadata transportは許可する。
- 完了（2026-08-01）: 7.2〜7.3、7.6の純粋API、Project restore validation、Folder duplicate ID clone、
  Folder target付き削除拒否、Frame 0 HOLD Bake、`verify-folder-deformer-model.mjs`が通過。
- 停止: public APIやroot deformer shapeの破壊的変更、既存test期待値変更、第二のWARP samplerが必要になった時。
- 推奨: LUNA MAX。完了後にSOL review 1を必須とする。

### Stage B — 共通RenderIsland評価

- 対象: `folder-part-render-plan.js`の`createFolderEffectRenderPlan()`、CPU compositor、Pixi preview adapter、
  Bake / exportが共有する純粋plan、`verify-folder-deformer-render-plan.mjs`。
- UI authoringは変更しない。
- 完了: 7.4〜7.5と、7.7 Stage B fixtureが一致する。
- 停止: preview専用分岐、export専用solver、clipping owner / source分断、working Layer正本化が必要になった時。
- 推奨: LUNA MAX。完了後にSOL review 2を必須とする。

### Stage C — CLIP MOTION UI authoring

- 対象: 既存対象tab、WARP Inspector、overlay、PopupManager内の既存windowだけ。
- 完了: CAF / Folder切替、対象ごとのGRID作成・key編集・再open、last-used tab、wheel / pen / touch、cancel、1 History、Futaba palette tooltip、console errorなし。
- 停止: 新popup、新selection正本、別deformer copy、RIG / MOTION eventの再設計が必要になった時。
- 推奨: LUNA MAX。完了後にSOL review 3とOwner実機判定を必須とする。

### Stage D — 回帰・容量・文書close

- 対象: verifier追加、Project / Album round-trip、容量と操作遅延、PROGRESS / proposal同期。
- 完了: 既存CAF全体WARP、旧Project、複数Folder、連続save / reopen、Undo / Redo、flatten / structured Bake、GIF / APNG、console errorを受入れる。
- 推奨: LUNA MAXで検証補助、SOLで最終diff / 契約レビュー、Ownerでclose判定。

## 9. LUNA MAXへ渡す共通実行指示

```text
あなたはPhase 6sから切り出された指定Stageの実装担当です。
指定Stageと明記された対象ファイルだけを変更してください。
設計、field名、評価順、正本、対象外を変更しないでください。
既存APIを先に検索し、同じ責務のclass / event / stateを追加しないでください。
計画にない対象外ファイル、公開API変更、既存test期待値変更、第二案の選択が必要なら実装を止めて報告してください。
完了時は変更ファイル、実装内容、node --check、verifier、build、Browser確認、未解決、計画との差異を報告してください。
build後はdist/とnode_modules/.vite/の生成差分を残さないでください。
```

## 10. SOLレビュー項目

- 計画とdiffが一致し、対象外変更がない。
- root WARPとFolder WARPの保存正本・sampler・setterが重複していない。
- stable Folder ID、copy remap、削除、Duration変更、History、旧Project互換が一貫する。
- Folder-local / CAF-local / Canvas座標とroundingがCPU / Pixiで一致する。
- pointer capture、pointercancel、Escape、popup close後にgesture / overlay / preview stateが残らない。
- 1 gesture = 1 History、Undo / Redo、save / reopen、random seekが一致する。
- clipping、Lane順、preview staging、PSD順、Bake / exportを壊さない。
- cache invalidation、RenderTexture dispose、JSON容量、連続操作の遅延に退行がない。
- tooltip、slider、icon、disabled / active色がFutaba paletteに従う。

レビュー判定:

- `A`: LUNAへ限定修正を返す。
- `B`: SOLが計画を補足してからLUNAへ返す。
- `C`: 設計矛盾があるためSOLがGate 0へ戻す。

## 11. このPhaseで行わないこと

- IK、Stretch、Follow、Pin、rotation limit。
- Auto Mesh、Triangle Mesh、SkinWeight、Morph、Perform、physics。
- Text、Deformer SELECT、階層Motionの新正本。
- WebGPU / SDF / MSDF。
- LayerSystemとTimelineModelの統合、Panel DOM全面置換、既存Popup / shortcutの再設計。

## 12. 検証

- 変更JSへ`node --check`。
- 既存Rig / Part / WARP / Bake / Project round-trip verifierと、各Stageで指定した新fixture。
- `npm.cmd run build`。
- Browserで既存CAF全体WARP、対象切替、key編集、再open、Undo / Redo、Popup重なり、pen / touch可能範囲、console error。
- build後は`tegaki_work/dist/`と`tegaki_work/node_modules/.vite/`の生成差分を残さない。
