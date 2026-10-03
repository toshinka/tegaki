# WP-020 — 新RIG入口の接点

状態: INVESTIGATION COMPLETE / COMMANDER REVIEW。write owner: TEGAKI｜実行 SOL。
契約: [WP-020](../work/WP-020-rig-renewal-first-path.md)。2026-10-03、Slice Bの限定source調査。
START / FINAL HEAD: `main` / `386d71877bd6bd237416cca13f72c16be713e874`。
製品改修・schema決定・採用判断は行っていない。Browser / native engine / Owner受入は未実測。

## 結果

新入口は右workspaceのRIG入口列に置き、旧`_enterRigLens()`とは別のhandlerから独立sessionへ渡す位置が最小。旧GUIの良い操作意味は残せるが、Part/Bone setter・AUTO GRID・旧Pose draftを新engineの互換APIとして包む案は避ける。

現行の`rig-part-projection.js`でいう「new RIG Lens」も、保存元は旧`rigDefinition.parts`である。WP-020の新engine入口と同一視しない。`rig-workspace-focus-shell.js`は既存MOTION windowの折りたたみ表示であり、独立editorのmodel入口ではない。

## PROVEN — sourceで確認した接点

以下は静的配線の証拠。実操作成功や画素一致の証拠ではない。参照行は上記HEADの製品file。

| 位置 / API | 確認した境界 | 新系で扱う範囲 |
| --- | --- | --- |
| [layer-panel-renderer.js](../../tegaki_work/ui/layer-panel-renderer.js) `_getContextInspectorTarget()`、997–1040 | 選択CAFの`assetId/internalLayerId`と名称、root Raster eligibilityを右workspaceへ投影。ここでRigを生成しない | 対象表示とID取得だけ利用可能。root限定は初回Sliceの制限でありengineの恒久制限にしない |
| [right-workspace-frame.js](../../tegaki_work/ui/right-workspace-frame.js) 159–178、`_enterRigLens()` 752–854 | `RIGを編集`→旧Lens。selection、未確定Transform、旧Poseを確認し、必要なら既存V terminalで退出。その後、旧Part/Bone/Meshの有無で`part/deform`を選ぶ | 入口の位置と拒否の意味は残す。方式判定・既存Rigからの自動入場は新系へコピーしない |
| 同file `_returnToTransform()` 893、`_requireRigPoseResolution()` 950、`sync()` 4261、`destroy()` 4376 | 未確定Poseの解決、表示/inert、listener解放を担当。RIG lens stateはruntime | 新sessionは自分のclose/abort/disposeを持つ。旧`sync()`のsurface分岐や旧Canvas gestureへ新engineを混ぜない |
| [rig-part-projection.js](../../tegaki_work/system/animation/rig-part-projection.js) `projectRigPartStructure()` 41、[rig-static-authoring.js](../../tegaki_work/system/animation/rig-static-authoring.js) 29 / 80 / 117 | 前者は旧Partのread-only構造投影。後者は旧Bone初回/Bind調整のpreflightで、Mesh/Skin/rigid/warp-anchorと結合 | 構造を見せる意味は残すが、新engine編集可否をこれらで判定しない |
| [rig-workspace-focus-shell.js](../../tegaki_work/system/animation/rig-workspace-focus-shell.js) `createRigWorkspaceFocusShellPlan()`、[animation-table-popup.js](../../tegaki_work/ui/animation-table-popup.js) `_getMotionWorkspaceShellPlan()` 16873 | `rig/motion`のCANVAS/DETAIL表示だけ導出。WARPは詳細固定。保存stateを持たない | Canvas優先・詳細展開という意味のみ再利用対象 |
| [animation-data-model.js](../../tegaki_work/system/animation/animation-data-model.js) `ClipAssetModel` 325 / `ClipInstanceModel` 378、[part-rig.js](../../tegaki_work/system/animation/part-rig.js) header | staticはAssetの`rigDefinition/meshDefinitions/skinBindings`、時間PoseはInstanceの`rigMotion`。Part IDはinternal Layer ID、Bone IDは別identity | 新engineのparameter/keyformを旧Bone KEYへ押し込まない。新保存位置は未決定 |
| 同Popup `getRigLensPartTarget()` 3679、`setRigLensPartPivot()` 3887 / `setRigLensPartParent()` 3911、`generateRigLensArtworkBinding()` 5030 | UI→旧Timeline setter→旧CAF History。Artwork接続は`_generateRasterBoneSetupForTarget(..., 'alpha-fit-grid', {requireHistory:true})` | 旧mutationを新engineの第二編集経路にしない |
| 同Popup `previewRigLensPartPose()` 4112 / `previewRigLensBonePose()` 4489、`_getRigLensPreviewClip()` 4452、`commitRigLensPartPoseFrame()` 4192 / `commitRigLensBoneKey()` 4549 | draftはruntime。対象asset/clip/frameを確認して旧`rigMotion`へ確定、Timeline Historyを一回記録 | preview→明示確定/取消、対象固定の意味を残す。旧draft Mapと旧KEY setterは置換対象 |

### 残す操作の意味と作り直す内部

| 操作の意味 | 現行の代表API | 新系の責務 |
| --- | --- | --- |
| 素材と編集中対象が見える | 右workspaceの対象名称、Layer ID | detached素材と新sessionの対象identity。旧Part登録は不要 |
| 構造・名前・親・pivotを編集できる | `setRigLensStaticBoneName/Parent`、`setRigLensPartPivot/Parent` | 新engineが実際に持つnode/parameter/bindingへの操作。旧骨格schemaの維持を前提にしない |
| Canvasで移動/回転、詳細で数値調整 | 右Lens pointer gesture→`previewRigLens*`、static Bind gesture | 新engine座標・評価・撤回のadapterを作る。旧FK/skin evaluatorを重ねない |
| 編集準備と時間変化を区別する | SETUP/MOTION、Artwork接続、Motion KEY | static編集と時間サンプル/確定の意味を維持。AUTO GRIDや旧KEY形式の互換は要求しない |
| 未確定の編集を解決してから対象変更/退出 | `_requireRigPoseResolution()`、CAF/Frame照合 | 新sessionの確定/取消/拒否。一操作を一Historyにする。入場/選択だけでは記録しない |

### 素材の最小接点

`TimelineModel.getClipAsset(assetId)` / `findClipEntry(clipId)` / `getDrawingSnapshot(snapshotId)`を通じ、`ClipAsset.internalLayers[].drawingSnapshotId`が参照する原画を取れる。`DrawingSnapshotModel`（220–248）は`width/height/rasterBounds/pixels`を持つ。新入口にはRGBAとboundsを複製して渡し、Asset/Snapshot/working Layerへの参照を渡さない。

注意: Popup `_handleDrawingCompleted()`（9586）は描画完了時に既存captureとCAF Raster Historyを行う。一方`_saveSelectedClipFromWorkingLayers()`（9517）はdirty判定後にcaptureし、モデルを更新する。read-only素材入口がこのsetterを呼ぶと、入場でmutationが起きる。最初は`_hasDirtyWorkingLayersForClip()`（9563）、`isSelectedWorkingRestoreBlocked()`（9534）、live stroke/Transform状態を確認し、未同期素材は拒否する。未確定状態を黙ってsave/capture/取消しない。

### History / 保存 / 出力の最小接点

| 接点 | 実file / API | 接続時に必要な条件 |
| --- | --- | --- |
| History | Popup `_captureInternalLayerHistoryState()` 12236 → `_recordInternalLayerHistoryFromStates()` 12261 → `_restoreInternalLayerHistoryState()` 12639。時間変更は`_captureTimelineHistoryState()` 12413 / `_recordTimelineHistory()` 12502。[history.js](../../tegaki_work/system/history.js) `record/undo/redo` 77 / 100 / 126 | 既存HistoryManagerを維持。現行captureはAsset.serialize/旧Timelineに依存するので新engine stateを自動には保持しない。新canonical payloadとrestoreを決めたCardで一commandの前後値・byteSize・失敗rollbackを実装する。engine内部undoを第二正本にしない |
| Project | [project-manager.js](../../tegaki_work/system/project-manager.js) `exportProject()` 49 → `_serializeAnimationForProject()` 408、`loadProject()` 581 → `_restoreAnimationProjectData()` 864。Asset.serialize 351、Instance.serialize 446、`validatePartRigs()` 2787 | 現行serializerは列挙式で新任意propertyを自動保存しない。旧Rig validatorに新engine payloadを入れない。追加保存schema/validate/新instance再構築は別Card。ProjectManagerの外部Project JSON ownershipを維持 |
| Final output | [export-manager.js](../../tegaki_work/system/export-manager.js) `_getTimelineSource()` 71 → [timeline-frame-compositor.js](../../tegaki_work/system/animation/timeline-frame-compositor.js) `renderFrame()` 126 / `_renderClipEntry()` 287 / `renderClipFrameSurface()` 154 | evaluated原画をroot WARP→root Motion→Lane合成の前に置く接点。新engine評価adapterは未存在。exportとSOURCE bakeで同じsurface入力を使うCardが必要。preview画像をProject/Export正本にしない |
| 旧effect plan | [folder-part-render-plan.js](../../tegaki_work/system/animation/folder-part-render-plan.js) `createRigPartRenderPlan()` 278 / `createFolderEffectRenderPlan()` 453 | 旧FK/Folder WARP/Layer Motion/重複/clipping判定のplan。新engineを既存旧planへ無条件追加せず、初回は通常blend・1 Raster・effect無しの入力を別adapterへ渡す |

現行Project saveはselection/Transformの既存terminalを通すが、Exportには`_assertExportTerminalReady()`がある。両者の未確定Transform処理が同一とは扱わない（ARCHITECTUREの未検証事項を維持）。

## INFERRED — 次の一件のexact diff案

**一件: 確定済み1 Rasterを、新RIGの独立した素材確認入口へdetached handoffする。** 実装提案のみ。engineの編集UI/Browser bridge成立を先取りしない。実行可能なnative proofとBrowser接続の可否はSlice Aの担当証拠で別判定する。

提案writeは以下の4fileに固定。新schema、既存History/setter、renderer/evaluator、package、CSSへの変更は含めない。

| exact file | 差分の位置と内容 |
| --- | --- |
| `tegaki_work/system/animation/rig-renewal-input.js`（新規） | 純関数`captureRigRenewalMaterial({ clip, asset, internalLayerId, snapshot, projectSize, frame })`をexport。snapshotのRGBA/boundsとsource identityを複製する。DOM/Pixi/History/engine importを持たない。失敗は`{ok:false, reason}`、成功は下記payload。入力を変えない |
| `tegaki_work/ui/animation-table-popup.js` | import節に上記helper。`getRigLensPartTarget()`の直前に`getRigRenewalMaterial(assetId, internalLayerId)`を追加。選択Clip/Asset/Layer一致とcurrent frame範囲、下記terminal gateを確認し、既存model getterだけでhelperへ渡す。旧Lensのgetterやsetterを新入口の実装に使わない |
| `tegaki_work/ui/rig-renewal-entry.js`（新規） | `openRigRenewalMaterialView({ material, mount, onClose })`をexport。受取済み素材だけを扱う独立runtime DOM。原画1枚・対象名・閉じるを表示し、close/disposeで自分のDOM/listener/RGBA参照を解放。既存`gui-control`/共通paletteを使用。Canvas2Dは素材の読み取り表示だけでstroke/保存/outputには使わない。engine unavailable時に旧Lensへfallbackしない |
| `tegaki_work/ui/right-workspace-frame.js` | 159–178の入口列に別button「新RIG（素材確認）」を追加し、専用`_openRigRenewalMaterial()`へ接続。既存`_enterRigLens()`を呼ばず、tableの新getter成功後だけ新viewを開く。未確定操作中は理由を既存status領域へ表示。`destroy()`で新viewをdispose。headerに独立素材viewのruntime限定を追記 |

新helper APIの受渡し値（**Project schemaではない**）:

```js
{ ok: true, material: {
    source: { assetId, clipId, internalLayerId, snapshotId, frame },
    label: { assetName, layerName },
    projectSize: { width, height },
    raster: { width, height, bounds: { x, y, width, height }, pixels }
} }
```

`pixels`は新しい`Uint8ClampedArray`、各objectも新規。sourceは表示/照合tokenだけで、素材から本体へ書き戻す権限を与えない。受領後のCAF/Frame変更は素材を自動差替えせず、素材viewは閉じて再入場する。初回viewは編集を持たないため取消で失う制作変更も無い。

固定gate:

1. selection/Transform session、`getLayerMoveCommitState().hasPendingTransform`、旧Lens操作/Structure drag/Pose draft、再生、live stroke、working restore block、dirty working Layerがあれば拒否。新入口はV切替・stop・capture・KEY・取消を代行しない。
2. 選択ClipがAssetを参照し、選択internal Layerが一致し、current frameがClip範囲内。通常blend/opacity 1/visible、背景でないroot Raster一枚、Folder/clipping無しに限定する。
3. 旧static Rig/Mesh/Skin、旧`rigMotion`、Layer/Folder/root WARP・Motionが存在する入力は`unsupported-existing-effects`で拒否。既存作品の自動移行ではなく、初回は新しい単純素材を対象にする。
4. snapshotが存在し、正の整数寸法、`pixels.length === width * height * 4`、finite boundsと寸法一致を確認。既存`validateRasterSurfaceSize()`（`system/raster-bounds.js` 193）を使い、既存既定値`maxAxis:8192, maxPixels:16*1024*1024`に固定。複製前に拒否し、巨大bufferや破損素材を黙って縮小しない。

次Cardの検証条件: helperの入力不変/複製/破損拒否、Browserで新入口の原画とbounds確認、close/再入場、dirty/未確定拒否、入場前後のTimeline serialize・History index不変、旧入口への回帰、build。これらは**今回未実施**。新viewには制作保存・出力の成功表示を出さない。

この一件の後に残る自作量は、native APIからBrowserへ届くbridge、engine固有node/parameter/keyform編集とgesture、canonical payload/History restore、Project往復、共有評価surfaceとpreview/export adapter。旧Part/Bone GUIの薄い互換層だけでこれらが成立する証拠は無い。

## UNKNOWN / HOLD

- 新engineのBrowser実行費用、WASM/binding、native proof結果はこのSliceでは未確認。
- 新canonical保存payloadと時間owner、失敗時atomic restore、engineからCPU final surfaceへの接続は未決定。上表の候補位置は採用決定ではない。
- 新素材入口のBrowser動作、Pixi preview、GPU/CPU画素、実Project save/load、Owner操作感は未実測。
- production切替、旧RIG隔離のUI名称/常設可否、最終制作受入は司令/Ownerへ返す。

## 検証・終了

- source read / `rg`で上記入口、送受信、model setter、History、Project/Export経路を照合。旧々退避物・別project・全機能棚卸しは未探索。
- commands: `git status --short --untracked-files=all`、`git branch --show-current`、`git rev-parse HEAD`、`node tegaki_work/build/development-harness.mjs check`、`git diff --check`。
- docs harness: **PASS**（55 documents / 210 local links / 25 proposals / 11 packages）。`git diff --check`: **PASS**。未trackedの本reportの`git diff --no-index --check -- /dev/null docs/ai/WP-020-rig-entry-boundary.md`も**PASS**。自分の製品JS変更無しのため構文確認/build/製品suite/Browserは実施していない。
- 自分の変更は本report一file。開始時の司令文書差分、WP-020 Card、LUNA結果fileを保持。最終確認時に他者のUI文書3fileとCSS3fileの追加差分を観測し、保持した。Slice B作業中のcommit/push、新chat/agent、追加worker指示は行っていない。
