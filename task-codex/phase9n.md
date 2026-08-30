# Phase 9n — RIG / Motion Responsibility / Contextual Right RIG Inspector Gate

作成日: 2026-08-29
更新日: 2026-08-30

状態: ACTIVE — Gate 0=`GO — D: Dedicated Right RIG + Motion handoff`。Stage A / B / C1 / C2 / C3 / C4 / C5 / C6 checkpoint完了、次はStage D Animation Table static RIG cleanup Gate

## 1. 目的

Animation Table、右Layer Panel、Canvasへ分散したRIG入口を、既存の保存・History・solver正本を変えずに再配置する。`Layer = 対象`、`RIG = 時間に依存しない身体構造`、`Animation Table = 時間変化`、`Canvas = 直接操作`へ責務を分ける。

一枚Rasterの曲げRIG / 全体PIVOTと、Folder配下の頭・体・腕等を親子で動かすRIGの入口を、選択対象に応じた右RIG Inspectorへ集約する。WARPはBind / topologyをRIG、key / interpolation / Frame poseをMotionへ分ける。

## 2. 読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `開発用資料保管庫/proposals/17_RIG・Motion責務再配置Architecture Gate.md`
7. `開発用資料保管庫/Archive/phase9m.md`
8. `開発用資料保管庫/Archive/phase9l.md`
9. `開発用資料保管庫/Archive/phase8d.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
12. `tegaki_work/system/animation/rig-authoring-status-projection.js`
13. `tegaki_work/ui/layer-panel-renderer.js`
14. `tegaki_work/ui/animation-table-popup.js`

## 3. 現行実装監査

- Animation TableがFolder `+RIG`、Raster `RIG設定`、BONE、AUTO GRID / SHAPE / LINE、MESH EDIT、WEIGHT、Motion、WARP setup / keyを同時に所有する巨大surfaceになっている。
- 右Layer属性Popupにも`+RIG`と`ROOT BONEを作成`があるが、mutationは`registerInternalRigPartFromExternal()`等でAnimation Tableへ委譲される。入口は二重だがauthorityはTable寄り。
- 右Panelは`right-panel > layer-panel-container`一つで、通常35px rail＋約132px contentのcontext dock。第二列を常設するとCanvasをさらに狭める。
- Phase 9lにより、Table visibilityとは独立したCAF editing contextと`selectedInternalLayerId`共有が既に成立している。RIG tabもTable open / closedへ依存させない。
- static正本は`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、temporal正本は`ClipInstance.rigMotion`。UI分離は既存データ分離と一致する。

## 4. Gate 0比較と判定

| 案 | 配置 | 判定 |
|---|---|---|
| A Current | Animation Table内へRIG / Mesh / Motionを同居 | HOLD。既存fallbackとして保持 |
| B Layer-integrated | 各Layer card / 属性Popupへ全RIG操作 | HOLD。visibility等と専門操作が競合 |
| C Dedicated left | Animation Tableと同じ左launcher側にRIG surface | Plan Bとして保持。Setup / Motionの並びは説明しやすいが、対象Layerが右、編集面が左となり視線とpen移動が往復する |
| D Dedicated right + Motion handoff | 右の同一dockを`LAYERS / RIG`で切替、TableはMotion中心 | **GO** |

### Dを選ぶ根拠

- Layer選択、描画修正、Mesh / Weight再確認が同じobject contextで循環する。
- 左sidebarはpopup launcher / temporary modeの低幅railであり、専門Inspectorの恒常content ownerではない。
- SpineのSetup / Animate分離、Live2DのModeling / Animation分離、ToonSquidのLayer→Inspector→Canvas→Timeline key導線と整合する。
- Adobe AnimateのTimeline parentingは`Layer = Timeline row`が強く一致する場合の有効な反例だが、Tegakiのnormal Layer / CAF internal Layer / Table lane / mirror構造へ直輸入すると正本が曖昧になる。
- 右へ第二列を増やさず、同じ幅のcontentを切り替える。wide split / pinは実測後の将来候補。

公式資料確認日: 2026-08-29

- Spine UI: https://en.esotericsoftware.com/spine-ui
- Live2D Modeling Menu: https://docs.live2d.com/en/cubism-editor-manual/modeling-menu/
- Live2D Timeline: https://docs.live2d.com/en/cubism-editor-manual/timeline-basic-operation-timelinepalette/
- ToonSquid Inspector / Effects / Bones / Mesh: https://toonsquid.com/handbook/layers/inspector/ / https://toonsquid.com/handbook/effects/effects/ / https://toonsquid.com/handbook/effects/bones/ / https://toonsquid.com/handbook/effects/mesh/

## 5. 選ばなかった案の保管

- A / B / CとDの切替条件はproposal 17へ残し、実装済みDへ不満が出た場合の再比較元とする。
- C leftを再検討する条件は、right dock切替回数が多い、Canvas直操作中にLayer構造を同時参照できない、narrowでright dockが手を隠す等が実測された時。
- Bを再検討する場合もLayer Panelへ詳細を埋めず、status / handoff以上を増やす理由をfixtureで証明する。
- rejected案をArchiveへ隠さず、未実装の比較proposalとして保持する。production Phase指示書へはGO案だけを限定契約化する。

## 6. Stage A — shared status projection（checkpoint完了）

対象:

- `tegaki_work/system/animation/rig-authoring-status-projection.js`
- `tegaki_work/ui/layer-panel-renderer.js`
- `tegaki_work/styles/main.css`
- `tegaki_work/build/verify-rig-authoring-status-projection.mjs`

Acceptance Criteria:

- `none / parent / bend / whole / conflict / stale`をClipAsset static正本からpure導出する。
- DrawingSnapshot鮮度は既存Model adapterが導出し、projectionへ表示入力として渡す。第二Snapshot / Mesh正本を作らない。
- Folder Partは`親子`、Mesh Rasterは`曲げ`、Raster Partは`全体`として右Layer badgeに出す。
- conflict / staleは意味のある警告状態として区別し、色だけでなく文字とtooltipを持つ。
- selection、ClipInstance.rigMotion、History、save、solver / evaluator、Table open / closedを変更しない。

Checkpoint（2026-08-30）:

- projectionの6状態、背景拒否、root Bone / Skin binding、conflict優先、renderer / CSS接続を限定verifierで固定した。
- 全119 verifier、対象JSの`node --check`、production buildを通過し、build生成差分を清掃した。
- Browserで一枚Rasterの`全体PIVOT`を設定し、右badge=`全体` / `data-rig-status=whole` / tooltip、Table open / closedでの継続、480×800での右dock内収まり、console warning / error 0件を確認した。
- 追監査で、空Folderは既存model契約上も有効な将来のPart containerとして登録可能と確認した。Stage Aでは登録action自体を露出せず、対象を作らず状態だけ偽装する変更は入れていない。parent / bend / stale / conflictはpure fixtureで固定した。

## 7. Stage B — read-only RIG Panel shell（checkpoint完了）

- `right-panel`を二列にせず、CAF editing context時だけ同一dockへ`LAYERS / RIG`切替を出す。
- `selectedInternalLayerId`を共有し、第二selection stateを作らない。
- RIG headerはStage Aと同じprojectionを使う。最初は対象名、kind、status、method説明だけのread-only。
- Tableを閉じてもCAF contextがactiveならRIGを表示できる。
- normal drawing contextではRIG tabを露出しない。

限定契約（2026-08-30）:

- 対象は`ui/layer-panel-renderer.js`、`styles/components/layer-panel-surface.css`、新規限定verifierだけ。`dom-builder.js`とAnimation Table DOMは変更しない。
- `LayerPanelRenderer`へ保存しないview lens `layers | rig`だけを持たせる。target / asset / clipの第二stateは作らず、毎renderで`selectedCelId / selectedInternalLayerId`とClipAssetから再導出する。
- 132px content columnと右railのfootprintを維持する。RIG view中はLayer mutation railをaccessibility treeごと隠すが、列幅を畳んでCanvas上の位置を動かさない。
- switchはnative button＋`aria-pressed`、RIG bodyは`role=region`。対象未選択 / 対象外 / none / parent / bend / whole / stale / conflictを文字で読めるようにする。
- 外枠を増やさず、resting tabはquiet、active tabだけ橙surface / indicator、focus-visibleは橙outlineとする。Setup青はmutation actionがまだ無いため使わない。

Checkpoint（2026-08-30）:

- 既存132px content columnへCAF選択時だけ`LAYERS / RIG`を投影し、right Panel DOM ownerと172px footprintを増やしていない。
- RIG viewは`selectedCelId / selectedInternalLayerId`、ClipAsset、Stage A projectionから対象名 / kind / status / methodを毎renderで再導出する。view lensはruntime-onlyで、normal drawingへ戻ると`layers`へresetする。
- RIG view中のLayer mutation railは`visibility: hidden`でaccessibility treeから外し、列幅は維持する。`LAYERS`へ戻すと同じrailとinternal Layer mirrorを復帰する。
- 全120 verifier、対象JSの`node --check`、production buildを通過した。Browserでnormal drawing非露出、CAF pointer / Enter / Space往復、RIG未設定Raster、Table close後の継続、480×800で172px内、console warning / error 0件を確認した。

## 7.1 Stage C1 — RIG対象登録（checkpoint完了）

- Stage Bの`RIG 未設定`だけへ明示Setup actionを追加し、既存`registerInternalRigPartFromExternal(assetId, layerId)`を再利用する。
- 最初の一SliceはFolder / RasterをClipAssetの`parts[]`へ登録するsurfaceだけ。ROOT BONE、全体PIVOT、Mesh BONE、AUTO GRID / SHAPE / LINE、Weight、Mesh editはまだ移さない。
- 成功 / no-op / 対象外 / clipping・target rejectを既存adapter結果から表示し、右Panel側でClipAssetやHistoryを直接mutationしない。空Folderは既存model契約どおり登録可能で、新しい拒否条件を作らない。
- Setup青はこの明示mutation buttonだけへ使い、status、tab、read-only cardへ拡散しない。

Checkpoint（2026-08-30）:

- `RIG 未設定`かつeligibleな対象だけへSetup青actionを出し、Folder=`親子RIGを開始`、Raster=`全体PIVOTを開始`として結果の方法を明示した。Rasterの`曲げRIG`はまだ移管せず、現行Animation Table `RIG設定`へのhandoffを残す。
- clickはfreshなCAF / internal Layer一致を再確認し、既存`registerInternalRigPartFromExternal()`だけへ委譲する。右Panelは`rigDefinition` / Historyを直接変更しない。
- 全121 verifier、対象JSの`node --check`、production buildを通過した。BrowserでRaster登録、status `none -> whole`、History `0 -> 1`、Undo / Redo、Table閉鎖後継続、wide / 480×800、console warning / error 0件を確認した。

## 7.2 Stage C2 — Raster method fork Gate（checkpoint完了）

- 一枚Rasterの入口を`曲げRIG`と`全体PIVOT`へ明示分岐し、現在の汎用`RIG設定`とC1 actionの意味差を同じ右RIG面で読めるようにする。
- 最初は既存の曲げRIG setupを開くhandoff / adapterを監査し、新しいMesh / Bone / Weight mutationやmode flagを作らない。
- Folderの`親子RIG`、Rasterの`曲げRIG / 全体PIVOT`を同じ情報階層で比較し、選択後の戻り先、Table open / closed、空target、既存Rigありを固定してから一actionずつ移す。

Checkpoint（2026-08-30）:

- RIG未設定Rasterへ同じSetup青・枠なしsurfaceの`曲げRIG / 全体PIVOT`を二等分配置し、Folderは`親子RIGを開始`一経路のまま維持した。汎用`RIG設定`一語ではなく、変形方式を選択前から読める。
- `曲げRIG`は新規mutationを作らず、freshなCAF / asset / root Raster / rigid conflictを確認する`openInternalRasterRigSetupFromExternal()`から既存`_selectRigRasterProjectionTarget()`へ委譲する。Table閉鎖時もTableと既存RIG Setupを再表示し、結果は`changed: false`、Historyは増やさない。
- `全体PIVOT`はC1の既存登録adapterを維持する。BrowserでHistory `0 -> 1`、Undoで未設定、Redoで全体PIVOTへ復帰することを再確認した。
- 全122 verifier、対象JSの`node --check`、production buildを通過した。Browserでwide二等分、Table閉鎖からの曲げRIG復帰、480×800で横overflowなし・button下端とTable headerに2pxの非重複gap・各button centerのhit target、console warning / error 0件を確認し、build生成差分を清掃した。

## 7.3 Stage C3 — Rigid Part root PIVOT completion Gate（checkpoint完了）

- C1 / C2の`親子RIGを開始` / `全体PIVOT`は、実装監査上はFolder / RasterをRigid Partへ登録する第一段階であり、ROOT BONE / PIVOT自体はまだ作成しない。Folderだけを対象にするとRasterの`全体PIVOT`も未完成のまま残るため、両者へ同じ第二段階を投影する。
- `parent / whole`かつPart登録済み・root Bone未接続の対象だけへ`PIVOTを作成`を出し、既存`registerInternalRootBoneFromExternal()`が所有するROOT BONE生成へ委譲する。右RIG側でClipAsset / Historyを直接mutationしない。
- 内容ありFolder / Raster、空Folder / Raster、root Bone接続済み、child Folder、clipping境界を固定する。空FolderはPart登録可能というC1契約を維持する一方、PIVOT生成時の`empty-part`拒否を表示し、`allowEmptyTarget`やfallback boundsをUI都合で追加しない。
- 成功は既存adapterの一Historyを維持し、接続後はactionを消して`PIVOT接続済み`と調整先を示す。Table open / closedとUndo / Redoで同じprojectionから再導出する。
- Bone hierarchy、Canvas接続gesture、Animation Table static RIG DOM撤去は同じSliceへ混ぜない。

Checkpoint（2026-08-30）:

- C1 / C2の登録actionがRigid Partだけを作り、root Boneは未作成だった意味差を監査した。`parent / whole`かつPart登録済み・root Bone未接続へ、Folder / Raster共通の枠なしSetup青`PIVOTを作成`を第二段階として追加した。
- click時はfreshなCAF / internal Layer / projectionを再照合し、既存`registerInternalRootBoneFromExternal()`だけへ委譲する。空対象へ`allowEmptyTarget`を渡さず、Folder / Raster別の`描画が必要`を表示し、Historyを増やさない。
- 成功後はactionを消して`PIVOT接続済み`とAnimation Tableへの調整handoffを表示する。右RIGはClipAsset / Historyを直接mutationせず、新しいBone / bounds / fallback正本を作っていない。
- 全123 verifier、対象JSの`node --check`、production buildを通過した。Browserで描画済みFolder / Raster、空Folder / Raster、Table閉鎖後、History各1件、Undo / Redo、480×800の非重複（action下端421px / Table上端434px）、console warning / error 0件を確認し、build生成差分を清掃した。

## 7.4 Stage C4 — Bone hierarchy / parent-link handoff Gate（checkpoint完了）

- root PIVOT作成後に、頭・体・腕等のFolder / RasterがどのBoneへ接続されているか、次にどこで親子関係を設定するかを右RIG面から読めるようにする。
- 既存Animation Tableの親BONE dropdown、Canvas PIVOT長押し / 接続線drag、`parentBoneId` setterを先に監査し、同じ接続を表す第二stateや第二mutationを作らない。
- 最初は選択対象のroot Bone名、親接続状態、既存編集面へのhandoffをread-only projectionとして比較する。接続変更actionを移す場合も、既存external adapter一操作へ限定する。
- cycle、解除、child Folder、Raster Skin Boneとの意味差、Table open / closedを固定し、Mesh / Weight、Canvas gesture再設計、static RIG DOM撤去を同じSliceへ混ぜない。

限定契約（2026-08-30）:

- 監査で、Rigid binding先Boneへ`parentBoneId`を設定すると、共有status projectionが`parentBoneId == null`だけをroot Boneと判定し、作成済みPIVOTを未作成として再投影する不整合を確認した。Partのbinding先BoneとRig全体のROOTを分離し、接続後も`hasRootBoneBinding`を維持する。
- shared projectionは`boundBone / parentBone / parentLayer / parentLinkState`をClipAsset static正本からpure導出する。`root / linked / broken / missing`は表示状態であり保存しない。
- 右RIGはPIVOT名と親名または`なし（ROOT）`を枠なしのread-only hierarchyとして表示する。接続済みactionは新しいsetterを作らず、既存Animation Tableの親BONE dropdownを開く非破壊handoffだけとする。
- linked child、ROOT、壊れた参照、Folder / rigid Raster、Table open / closed、History非増加を固定する。Mesh Bone自体の詳細移管やCanvas gesture変更は行わない。

Checkpoint（2026-08-30）:

- Rigid Partのbinding先BoneをRig全体のROOTと誤認していたprojectionを修正し、`parentBoneId`接続後も`hasRootBoneBinding`とPIVOT済み状態を維持する。`boundBone / parentBone / parentLayer / parentLinkState`はClipAssetからpure導出し、保存schemaを増やしていない。
- 右RIGへ枠なしの`PIVOT / PARENT`要約とquietな`接続を編集`を置いた。actionはfreshなCAF / Layer / binding Boneを再照合し、既存Animation Table RIG inspectorを開く`changed: false` adapterだけへ委譲する。親変更、cycle拒否、解除、Historyは従来の`setClipAssetRigBoneParent()`一正本を維持する。
- 全124 verifier、対象JSの`node --check`、production buildを通過した。BrowserでFolder2→Folder1接続を1 History、Undo / Redo、ROOT / linked要約、Table閉鎖からの無履歴handoff、480×800の非重複（action下端433.75px / Table上端434px）と横overflowなしを確認し、build生成差分を清掃した。

## 7.5 Stage C5 — Raster bend setup progress / Mesh-Bone handoff Gate（checkpoint完了）

- 一枚Rasterの`曲げRIG`で、Bone / Mesh / Skin Weightのどこまで設定済みかと、次に行う一操作を右RIGから読めるようにする。C2の単一`曲げRIG`handoffを、第二stateを作らない段階要約へ進める。
- 最初に既存Raster RIG inspector、`meshDefinitions / skinBindings`、Mesh freshness、AUTO GRID / SHAPE / LINE、BONE / WEIGHTの到達条件を監査し、共有projectionで表せるstatic setupだけを固定する。
- 最初のproduction Sliceはread-only進捗と既存Animation Table該当面へのhandoff候補に限定する。Mesh生成、Weight編集、Bone追加、solver / evaluator、History semantic、Canvas gesture、Table内static DOM撤去を同時変更しない。
- bend / stale / conflict、未Mesh / Mesh済み / Skin済み、Table open / closed、wide / 480×800を比較し、単一RasterとFolder rigid hierarchyの語彙を混同しない。

限定契約（2026-08-30）:

- Bone正本は`rigDefinition.bones`、対象Meshは`meshDefinitions[].targetInternalLayerId`、Weight接続は`skinBindings[].vertexWeights[].influences`、鮮度は既存`getClipAssetRasterMeshStatus()`とする。右RIGはこれらを再計算・保存しない。
- Mesh生成前のunbound BoneにはRaster ownerがない。右RIGはこれを特定Rasterの接続済みBoneと誤表示せず`候補`としてpure projectionへ分離する。対象Boneと確定するのはSkin influenceから参照できる場合だけとする。
- production Sliceは`bend / stale / conflict`へ枠なし`BONE / MESH / WEIGHT`進捗を表示し、`設定を確認 / Meshを更新 / Weightを確認`等の次actionを既存`openInternalRasterRigSetupFromExternal()`へ委譲する。右RIGはMesh生成・Weight編集・Historyを所有しない。
- `conflict`は進捗をread-only表示するが、既存adapterがRigid Part混在を拒否するため新しい解消mutationを追加しない。方式解消のaction移管は別Sliceとする。

Checkpoint（2026-08-30）:

- shared projectionへ`bendSetup`を追加し、unbound Bone候補とSkin influenceで対象確定したBoneを分離した。Mesh generatorは`GRID / SHAPE / LINE / MANUAL`、鮮度は`missing / current / manual / stale`、Weightは`未接続 / 接続済み / 要確認`としてpure導出する。
- 右RIGの`bend / stale / conflict`へ枠なし`BONE / MESH / WEIGHT`進捗と、状態別`Weightを確認 / Meshを更新 / 設定を確認`を追加した。actionは既存Raster RIG inspectorを開くだけで、Mesh / Weight / Historyをmutationしない。
- BrowserでMesh生成後RasterがFolder候補列から外れ、Table閉鎖後handoffが失敗する既存resolver不整合を検出した。external adapterを`_getRasterRigProjectionContext()`へ補正し、Mesh前後の同一Rasterを再解決する。
- 全125 verifier、対象JSの`node --check`、production buildを通過した。Browserで`BONE追加`1 History、`AUTO GRID`1 History、右進捗、描画後STALE、無履歴`Weightを確認 / Meshを更新`、Table閉鎖復帰、480×800非重複（action下端433.75px / Table上端434px）と横overflowなし、Vite error overlayなしを確認し、build生成差分を清掃した。

## 7.6 Stage C6 — Pre-Mesh Bone candidate focus / Raster onboarding Gate（checkpoint完了）

- `曲げRIG`を開いてBONEだけ追加した段階では、保存上そのBoneにRaster ownerがなく、右RIGは依然`RIG 未設定`の方式選択を表示する。この中間状態を、別Rasterへ誤帰属させず制作手順として見せる方法を比較する。
- 監査で既存`selectedInternalLayerId / selectedRigBoneId / _motionInspectorTargetKind='raster'`だけでは、右Layer行から別Rasterを選んだ瞬間に「どのRasterでそのunbound Boneを明示選択したか」を復元できないと判定した。保存ownerは作らず、明示的なBone追加・選択時だけ`asset / Raster / Bone`三点を持つruntime-only focus tokenを採用する。
- Table close / reopen、Raster切替、複数Raster、Bone複数、CAF切替で候補表示が漏れないことを先に固定する。保存ownerが必要なら実装せずArchitecture Gateへ戻す。
- Bone登録、Mesh生成、History、selection authority、schema、solver / evaluatorは変更しない。

Checkpoint（2026-08-30）:

- 右RIGはruntime focusが現在の`selectedAssetId / selectedInternalLayerId / selectedRigBoneId / internal raster scope`と全一致し、root Raster・Partなし・Meshなし・unbound Bone実在をfreshに確認できる時だけ`曲げRIG 準備中`と`BONE候補 / MESH未生成 / WEIGHT未接続`を表示する。Project / History / Rig定義へfocusを保存しない。
- Layer Panel行、別Clip / CAF、Folder、Mesh生成、Rigid化、Bone消失でtokenを破棄する。Mesh前Rasterを開く時は同じtokenのBoneだけを復帰し、global unbound Boneを別Rasterへ一意候補として自動継承しない。Mesh生成後のSkin接続済みBone復帰は従来どおり。
- 明示Bone選択後の右Panel同期漏れと、Table閉鎖後handoffでlast-used MOTION tabへ戻る不整合をBrowserで検出した。既存Layer Panel syncを追加し、右RIGのstatic Setup handoffだけ既存RIG tabをopen後に再確定する。Bone / Mesh mutation、History semantic、save schemaは変更していない。
- 全126 verifier、対象JSの`node --check`、production buildを通過した。BrowserでBone追加直後、別Raster非漏出、元Rasterへの非自動復帰、明示Bone選択での復帰、Table閉鎖中、`Meshを作成`からRIG tab復帰、AUTO GRID 1 History、生成後の`BONE接続 / GRID設定済み / WEIGHT接続済み`、480×800のaction下端433.75px / Table上端434px・document横overflow 0、console warning / error 0件を確認した。

## 8. 後続Stage

- Stage C: C1のRIG対象登録から、既存Animation Table external adapterを再利用してsetup mutationのsurfaceだけを右RIGへ一操作ずつ移す。model logicを一括移動しない。
- Stage D（次task）: 右経路がproductionで成立したため、Animation Table内のstatic RIG DOMとtemporal Motion DOMを先にinventory化する。右経路で代替済みと実操作で確認できた一surfaceずつ段階撤去し、Motionと`RIGを設定 >` handoffを残す。inventory / parity確認前に削除しない。
- WARP: Bind / GRID / topology / child pivot bindingはRIG、key / interpolation / current Frame poseはAnimation Table。

## 9. 非対象 / STOP

- ClipAsset / ClipInstance / Project schema、History semantic、solver、Skin / Weight algorithm、WARP key schemaを変更しない。
- LayerSystemとCAF modelを統合しない。
- right Layer rendererやAnimation Tableを全面置換しない。
- 第二selection、第二Rig model、Table visibility依存のauthorityを作らない。
- right二列常設、width永続化、wide splitを同時実装しない。
- Clip Focus、dark top / bottom、Lane濃淡、Animation Table枠削減を本Phaseへ混ぜない。

## 10. 検証

```powershell
node tegaki_work/build/verify-rig-authoring-status-projection.mjs
node tegaki_work/build/verify-right-rig-pre-mesh-candidate-focus.mjs
node --check tegaki_work/system/animation/rig-authoring-status-projection.js
node --check tegaki_work/ui/layer-panel-renderer.js
Set-Location tegaki_work
npm.cmd run build
```

UI Sliceではnormal drawing / CAF、Folder parent / Raster bend / Raster whole / stale、Table open / closed、wide / narrow、console errorをBrowserで確認する。build後は生成`dist/`差分を残さない。

## 11. model分担

- Gate、left / right判断、projection contract、Phase closeはSOL / MAX。
- Stage B / C1 / C2 / C3 / C4 / C5 / C6はcheckpoint完了。Stage Dのstatic / temporal DOM inventory、右経路parity、撤去単位、Phase close判断はSOL / MAX。
- mutation、History、selection、schema判断が必要になったらLUNAは変更せずSOLへ返す。

## 12. Owner UI follow-up / 後続Gateへ保留

- 右Frame stripの二つのghostは、OFF時からTimeline=淡色、Lane=茶色として軸の違いを示し、ON時はどちらも枠なし橙surfaceへ上げる。onion state / wheel / click / ARIAは変更しない。
- `Frame + Timeline onion + Lane onion`、`CAF / Lane identity`、Animation Table本体が上下に分かれ、同じ時間文脈が別Panelに見える懸念を後続UI/UX Gateへ残す。Phase 9nではRIG責務再配置へ集中し、選択・Frame・Lane・Timelineの正本を統合しない。
- 後続Gateでは、同一alignment / connector band / context label / Table dock連続化をfixture比較し、右CAF情報をTimelineへ単純移設する案と、現行分離を保つ案の両方を保存する。

## 13. Phase 9n close時の外部Web AI review handoff

- Phase close時に`tegaki_work/GitHubURL.txt`を、ローカルfileへ直接アクセスできないWeb AIが単独でRIG導線を理解・精査できるreview indexへ更新する。途中Stageごとの追記だけでcloseしない。
- `Layer=対象 / 右RIG=static構造 / Animation Table=時間 / Canvas=直接操作`、Folder親子RIG、一枚Raster全体PIVOT、一枚Raster曲げRIG、PIVOT / parent、Bone / Mesh / Weight / STALE、Motion handoffの最終導線を一続きで説明する。
- 第一採用D案だけでなく、proposal 17に保存したA current / B Layer統合 / C left RIGと再試行条件、CAF / Lane情報とTable分断の後続懸念、Phase 9nで触らなかった範囲も示す。
- 現行Phase Archive、proposal 17、projection、right renderer、external adapter、主要verifier、Browser acceptance記録へraw GitHub URLで到達可能にし、Web AIへ評価してほしい論点（入口発見性、誤操作、focus、right / left配置、熟練移行、複数Raster）を明記する。
- `verify-github-url-index.mjs`で重複・欠損を確認し、外部AIが古いPhase記述を現行仕様と誤認しないことをclose条件とする。
