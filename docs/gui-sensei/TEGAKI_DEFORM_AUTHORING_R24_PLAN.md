# TEGAKI DEFORM Rig Authoring — R-24 Design Reset

状態: Owner review前の設計提案。制作受入済み仕様ではない。
Card: R-24 / 調査基準日: 2026-09-24
実装・Browser・build: 未実施（本Cardでは禁止／不要）。

本文中の区分:

- **CONFIRMED** — 現行コード、verifier、指定公式資料で確認した事実。
- **PROPOSAL** — 後続実装へ提案する操作・画面契約。
- **UNKNOWN** — 限定調査で確定していない事項またはOwner判断。

## A. BASELINE

- **開始時:** branch `main`、HEAD `141ad8675c8c344f0c80750c0655a353fcd18b8b`、`git status --short --untracked-files=all` はclean。HEADは`origin/main`と一致していた。
- 前回報告HEAD `0d94073fd8f1377fe321d34ba7baa31fb633f0a5`は現HEADの祖先。現HEADの`141ad867`にはR-23関連3ファイル（`right-workspace-frame.js`、`layer-panel-surface.css`、`verify-right-workspace-rig-lens.mjs`）の変更が含まれている。未commit差分はなく、保護対象の作業ツリー差分もなかった。
- 現行確認owner: `tegaki_work/ui/right-workspace-frame.js`、`ui/animation-table-popup.js`、`system/animation/rig-static-authoring.js`、`system/animation/animation-data-model.js`、`system/animation/part-rig.js`、`styles/components/layer-panel-surface.css`。
- 関連verifierの現行sourceを確認: `verify-rig-static-authoring.mjs`、`verify-right-workspace-rig-lens.mjs`、`verify-rig-lens-multi-bone.mjs`、`verify-rig-lens-motion.mjs`、`verify-rig-lens-part-production.mjs`。このCardでは実行していない。
- R-24依頼文は、R-23で実Browser上のBone作成・分岐を確認済みと引き継いでいる。本Cardはその操作を再実行せず、Browser証拠を新たに追加していない。
- `docs/STATUS.md`は2026-09-18時点のWP checkpointで、R-20〜R-23の現在地を記録していない。今回のRIGの実装事実はCard・現行owner・限定verifierを正本として扱った。`docs/TECHNICAL.md`、Browser Drawing WebSOL引継ぎ、GUI作法辞典を参照した。
- 同名のR-24設計書は開始時に存在しなかった。本Cardではこの文書1点のみを作成する。

## B. CURRENT FAILURE ANALYSIS

**CONFIRMED — 実装はRoot/Bone作成と分岐を持つが、操作の意味がCanvasと右Workspaceで分離して見えない。**

1. `Rootを配置`は現在、Canvas上の配置モードを開始せず、選択Rasterの不透明範囲中心へRootを直ちに登録する。Root位置を後から動かせるが、最初の操作は「置く」より自動作成に近い。
2. `子Boneを追加`はplacement modeをarmする。選択中Boneが親となり、Canvas gestureの`start`と`end`がRight Workspaceから登録bridgeへ渡る。しかし`planStaticRigBone()`は子Boneの`start`を幾何に使わず、親Bindの`length`位置を子Boneの基点に固定する。現行Canvas入力は親先端から始めるよう案内する一方、空Canvasからもgestureが始まり得るため、利用者がどの点を配置したか予測しにくい。
3. 複数の子Bone・枝は作成可能。枝を作るには共通親を選び直してから追加する。親変更用selectもあるが、選択Bone、次に作るBoneの親、Canvas上の配置点が同じ一連の操作に詰まっている。
4. Setup overlayはBoneの実線に、頭markerと選択Boneの先端markerを表示する。Root・関節点・ドラッグ用handleは似た円形で、Root専用記号ではない。child placement中も既存markerが生成され、CSSは主に先端cursorを変えるだけで、編集handleと配置toolの同時表示を解消していない。
5. R-23はpointer競合を局所修正し、Canvas capture、drag preview、pointerupでの登録、cancel/短いclickでの非登録を持つ。関連verifierは1 gestureにつき1 Bone、pointermove中は未登録、cancelでは未登録を確認する。R-24はこの基盤を保持し、失敗した操作の意味表示を再設計する。
6. 作成後のBase位置と方向は既存static Bind handleで編集できるが、先端dragはrotationのみで、Bone lengthを確定変更するsetterやGUI操作は今回確認できなかった。モデルに`length` fieldはあるが、既存`setClipAssetRigBoneBindTransform()`はBind transform fieldのみを更新する。従って、作成後に骨端＝関節位置を自由に直せるという受入条件は、現状のままでは満たせない。
7. CanvasはRIG Lens active中に通常描画を開始させない。placement/selection/editは`RightWorkspaceFrame`が持つruntime gestureとoverlayで処理される。描画漏れを直すための新Canvas input state machineは不要。

**PROPOSAL:** 「親を選ぶ」と「BoneをCanvasへ配置する」を二つの見える操作にし、Canvas placement中は既存Bind編集handleを非interactiveにする。親先端から始めることを要求しない。Bone geometryとhierarchyは別々に表示する。

## C. LEGACY CAPABILITY REUSE

対象は現行の旧RIG UI/handlerが残る`ui/animation-table-popup.js`に限定した。退避Backup全体は探索していない。旧Workspace DOMをRight Workspaceへ複製せず、モデル・History ownerを優先して再利用する。

| 能力 | 確認した既存owner / 現状 | 分類・新Workspaceへの扱い |
| --- | --- | --- |
| 01 初回Root配置 | Lensは`createRigLensStaticRootAtArtworkCenter()`を呼び、不透明範囲中心にRootを作る。旧UIのRaster `1. BONE追加`はRaster中心近傍に親なしBoneを登録する。`planStaticRigBone()`はRootのstart/endと長さを扱える。 | **ADAPT** — 新しいCanvas配置toolから既存登録・History bridgeへ渡す。Artwork中心への暗黙配置を主操作にしない。 |
| 02 Rootの位置修正 | Lens overlayのBone-head dragからBind x/yを更新し、pointer terminalでCAF Historyを記録する。legacy `rigPivotOverlay`にもstatic Bind move経路がある。 | **REUSE + ADAPT** — Bind setter/transactionを再利用し、Root markerを操作handleから形で区別する。 |
| 03 Bone作成・選択 | legacy UIにRaster Bone selectと`1. BONE追加`があり、`registerInternalRasterBoneFromExternal()`→`registerClipAssetRasterBone()`を通る。LensはBone一覧とCanvas markerで`rigSelectedBoneId`を投影する。 | **REUSE + ADAPT** — 同じ`rigDefinition.bones`と登録/history経路を使い、旧DOMや旧selection UIは移植しない。登録bridgeがlegacy inspector focus fieldも更新するため、Lens表示との副作用は後続で回帰確認する。 |
| 04 関節 / Bone根元・先端 | 永続modelはJointではなくBone。`bindTransform`が基点・方向等、別fieldの`length`が先端を表す。Lensは根元移動と先端回転を持つ。 | **ADAPT / UNKNOWN** — 根元移動・方向変更は利用可能。既存length fieldを編集するmodel API/GUIは限定調査で見つからず、後述のOwner確認付きsliceで追加可否を決める。Jointデータを捏造しない。 |
| 05 初回の親子関係 | `parentBoneId`はBone登録時に設定される。Lens child plannerは選択親を使い、子基点を親の先端に置く。 | **REUSE + ADAPT** — 既存親IDを登録時に使う。Canvas上の基点配置を親先端固定から切り離し、選択親と登録parentを画面に表示する。 |
| 06 作成後の親変更 | legacyの親Bone selectとLensの親Bone selectは、`setClipAssetRigBoneParent()`→`updateRigBoneParent()`を呼ぶ。cycle/self/missing parentを拒否し、Bind World matrixを保つ。両UI側で既存CAF Historyへ記録する。 | **REUSE** — 現行setter、拒否条件、world-position保持、Historyを使用する。新しいreparent gestureは追加しない。 |
| 07 複数Boneの分岐 | modelは`parentBoneId`階層を評価し、Lensで共通親を再選択して複数の子を追加できる。R-23 handoffは実Browserで分岐作成を確認したと報告する。 | **REUSE** — `rigSelectedBoneId`で共通親を選び直す。新しいrootは追加せず、単一Rootの下に枝を作る。 |
| 08 Canvas handles | legacy `rigPivotOverlay`はCAF/Folder/Mesh Bone screen itemsと選択・Bind/Motion gestureを持つ。Lens active時はlegacy overlay callbackを上書きしないguardがあり、LensのBone overlayはRightWorkspaceFrameが所有する。 | **ADAPT** — 新Workspaceは現overlay ownerを維持し、marker形状・placement時のhit-testだけを分離する。legacy handlerの擬似click再利用はしない。 |
| 09 選択とmode表示 | Lensはruntime `rigSelectedBoneId`、`rigPlacementMode`、`rigLensMode`（SETUP/MOTION）を持ち、DOM/CSSへ投影する。保存正本ではない。 | **REUSE + ADAPT** — 既存stateを投影に使い、別Joint selectionや別mode state machineを新設しない。parentの選択結果とactive toolをラベル化する。 |
| 10 AUTO Mesh/Skin接続 | Lens `絵をBoneへ接続`から`generateRigLensArtworkBinding()`、既存Raster `alpha-fit-grid` generatorへ進む。legacy UIは`2. AUTO GRID`と追加generator/weight controlsを持つ。 | **REUSE** — 既存AUTO GRID actionとMesh/Skin正本を使う。AUTO SHAPE/LINE、Weight、generator変更は本設計の範囲外。 |

## D. TEACHER COMPARISON

公式資料で明記された操作だけを事実として記し、TEGAKIへ適用する内容は提案と分ける。参照日: 2026-09-24。

| 項目 | 公式資料で確認した操作（事実） | TEGAKIへの提案（模倣ではない） |
| --- | --- | --- |
| ToonSquid — 初回配置 | Bones effectを選び、Add Bones ToolでCanvasをtouch-drag。最初の点がbase、drag先がtip。選択中Boneが新規Boneの親となり、Rootを追加する時は選択解除する。 | 親選択をCanvas dragと別に示し、base→tipで配置する基本語彙を参考にする。TEGAKIはtarget固有のsingle-root guardを維持する。 |
| ToonSquid — 編集・階層 | 選択中Boneは色で区別。別Transform Bones Toolでbase近くをdragして移動、tip近くで長さ変更、他所で回転する。選択親はInspectorの階層編集でも変更できる。FX offはBind Pose編集、FX onはBone animation/keyframe編集。 | Root/joint glyphと操作handleを分ける。SETUP/MOTIONを既存Lens modeへ対応づける。FXの方式や複数root/階層UI全体は移植しない。 |
| Spine — 初回配置 | Create toolはSetup mode専用。親Boneを先に選び、clickでzero-length、dragで長さを指定できる。新規Boneが親先端から始まる制約はない。作成後の新Boneが選択される。 | 親とgeometryの基点を別々に扱う根拠とする。TEGAKIではzero-lengthを保存せず、既存の最小有効長guardを保つ。 |
| Spine — 編集・階層 | 親はSet ParentまたはTree/Viewport操作で変更可能。Bone toolsはrotate/translate/scale等に分かれ、Bone length toolもある。CreateはSetup modeのみ。 | 親変更を明示的な親欄へ集約し、Canvas dragは現在tool一つだけを所有する。Spineの複数tool・任意root・IK等を追加しない。 |
| Callipeg — secondary | 対象公式資料はTransformation Layerがchild layerを持つhierarchy、global pivotと複数pivotの切替、Canvas transform box/Sidebar操作を説明する。Bone作成・skeleton authoring資料ではない。 | Pivot/transform layerの話をBone/Jointsの根拠に転用しない。階層関係とCanvas操作対象をUIで明示するという一般的比較に留める。 |

公式資料: [ToonSquid Bones](https://toonsquid.com/handbook/effects/bones/)、[ToonSquid Animate With Bones](https://toonsquid.com/handbook/guides/animate_with_bones/)、[Spine Bones](https://esotericsoftware.com/spine-bones)、[Spine Tools](https://esotericsoftware.com/spine-tools)、[Callipeg Transformation Layer](https://callipeg.com/learn-transformation-layer/)。

## E. AUTHORING MODEL COMPARISON

今回のStoryはRoot 1本と子Bone 9本（胴体Root、頭頸部、左右の上腕・前腕、左右の腿・すね）で成立する例に固定する。

| 観点 | Plan A — Select Parent → Create Child | Plan B — Place Joints → Connect | Plan C — Legacy GUI Reuse |
| --- | --- | --- | --- |
| 手順 / 人型 | Rootを1 gestureで置く。各childは親Boneを選択→Add tool→Canvas base-to-tip drag。親を選び直してbranch。追加9本ならRoot作成1、各childのtool+drag18、共通親へ戻る選択4、計約23の主要入力（誤操作修正・再配置は別）。 | Root/joint候補を先に複数配置し、後から各edgeをconnect。最低でも置くgestureと接続gestureの二巡になり、接続ごとに両端/parentを選ぶ。候補数と操作数はUI詳細で変わる。 | 旧UIでBoneを追加し、Raster上で位置調整、親selectで階層接続、AUTO GRIDへ進む。操作は可能だが、popup内の多数のMesh/Weight controlsからDEFORM初回制作だけを分離しにくい。 |
| 視覚の理解 | selected parentを追加前に表示。solid Bone geometryとdashed parent linkを分ける。 | 置いたjointと未接続/接続済みを明快に区別できるが、candidateとpersistent Boneの違いを説明する必要がある。 | 既存UIにはBone選択、親、AUTO GRID statusがある。Root/handleの区別と配置tool表示は新Workspaceの不足を解消しない。 |
| model / schema | 既存Bone ID・`parentBoneId`・`bindTransform`・`length`を使用。親は既存Boneで、未接続Jointを保存しない。現plannerの親先端固定だけは調整する。 | 現行正本には独立Jointがない。runtime候補だけならschemaは不要だが、candidate IDs、座標保持、edge-to-Bone変換、cancel/undo後の対応を新設する。候補は保存/再訪できず、未接続Jointを保存する仕様にはschemaが必要。 | 既存modelを使うが、旧UIの選択/target stateとDOM依存が残る。UI全移植は二重Workspaceになる。 |
| History / save | Bone drag pointerupごとに既存Asset snapshot Historyを1件。reparentとgeometry editも各1 transaction。既存serializationを維持。 | 置くだけではHistoryなし、接続時にBoneを作る等のdraft lifecycleが必要。各edgeのUndo/Redoでruntime候補との対応を決めなければならない。 | 既存CAF Historyを再利用できる。現legacy event/UI経路を別surfaceから呼ぶと選択表示やfocus副作用がある。 |
| 入力競合 / 実装 | 一つのRoot/Bone placement modeをCanvasが所有し、編集中handleを非interactiveにすれば小さい。親選択は既存tree DOMで行う。 | Placementとconnectの2 mode/候補選択が必要。candidate線、取り消し、mode switch、undo整合まで責務が増える。 | Legacy `rigPivotOverlay`/popupは既存操作を多く持つが、Lens自身のoverlay/selectionと同時所有させられない。 |
| Mesh/Skin接続 | 構造確定後に既存AUTO GRIDへ進む。Bone IDsを保つ。 | 接続後のBone graph生成が既存generator/APIへ正しく渡るmappingが必要。 | AUTO GRIDは最もそのまま使えるが、新Workspaceの制作導線は残らない。 |

Plan Bのruntime-only candidate構成は理論上検討可能だが、現行`planStaticRigBone()`は既存parent Boneを要求し、子の基点は親末端に固定する。candidate graphを既存Boneへ変換する実用経路・履歴境界は本調査で確認できなかった。独立Jointの保存正本は採用しない。

## F. SELECTED DESIGN

**PROPOSAL — Plan A***: 親Boneを先に選択し、Root/Bone geometryはCanvas上のbase-to-tip gestureで配置する。親選択とCanvas placementを別操作として明示し、子Boneのbaseを親先端から切り離す。親子関係は既存`parentBoneId`で登録する。

1. **Root:** 初回だけ`Rootを配置`toolをarmする。Canvas dragの開始点をRoot BoneのBind base、終了点をtipとする。Root iconは通常joint/handleと別形状。短いclickだけではBoneを登録しない。
2. **Child:** Bone一覧でparentを選択し、操作欄に`親: <Bone名>`を表示してから`Boneを配置`をarmする。Canvas dragの開始点・終了点は任意のProject座標。両点をBind parent world matrixのinverseでparent-localへ変換し、child `bindTransform.x/y/rotation`と既存`length`を作成する。初回registrationは既存CAF Asset History wrapperを通る。
3. **Branch:** 共通parentを一覧から選び直し、同じ追加toolでsiblingを配置する。作成したBoneの親はdragした近接Boneから推定しない。
4. **Edit:** 選択Boneのbase handleは既存Bind x/yを移動する。tip handleはrotationとlengthを同じ一gestureで更新する。長さ変更には既存`length` fieldを使う狭いmodel mutation APIが必要。保存schema、evaluator、History command semanticsは変更しない。Geometry dragをpointerupで一つのCAF Historyへまとめ、cancel時は既存snapshotをrestoreする。
5. **Parent correction:** 選択Boneの`親`selectで既存setterを使う。候補は自身と子孫を除外する。world Bind positionを維持し、既存のcycle/non-invertible拒否を表示する。
6. **Visible relation:** 実線はBone base-to-tip geometry、破線は`parentBoneId`を示す関係線（親tipからchild base）。この2線種は意味を混同させない。Rootは一つ、枝は複数可。
7. **Binding / Motion:** 全Bind構造を確認した後に既存`AUTO GRIDで絵を接続`を明示実行。その後既存MOTIONへ進む。Mesh/Skin作成後のstatic Setup edit guardは維持する。

**モデル適合:** `createRootBoneDefinition()` / `registerRigBoneDefinition()`は既存`bindTransform`と`length`を受け取り、`parentBoneId`を保存する。validatorはBind transformと非負finite lengthを検証し、evaluatorは親world matrixとlocal transformを合成する。従って、schema上は任意の親local base/lengthを表せる。現在の制約は新しいJoint schemaではなく、Lens planner/UIの親先端固定とlength mutation API欠如にある。

**適用範囲:** RIG Lensのstatic target guardが受け入れる、一Rootの未binding CAF Rasterに適用する。既存Mesh/Skin作成、Motion KEY、PART、保存schemaを再設計しない。

## G. FINAL RIGHT WORKSPACE BLUEPRINT

194px程度の細い右Workspaceでは一列構成とし、既存単一Right WorkspaceのDOM・Frame ownerを維持する。header/footerは固定、中央だけを一つのscroll ownerにする。横並びの説明カードや別Inspectorを作らない。

| 順序 / 領域 | 表示・条件 | 操作と結果 |
| --- | --- | --- |
| 1. Primary switch | 既存`LAYER / TRANSFORM`をWorkspace最上部で維持。 | 既存切替のみ。RIG用の別main switchを作らない。 |
| 2. RIG方式 | 既存`PART / DEFORM` compact row。 | DEFORMを選ぶとこの設計のSETUP/MOTION面を表示。PART DOM/handlerは変更しない。 |
| 3. Target header | `CAF · Lane`と実対象Raster名を短い2行以内で表示。長い名前はellipsis + `title`/accessible label。 | 対象名は既存`rigLensTarget`/選択CAF projectionから読む。選択stateを新設しない。 |
| 4. Frame row | 既存prev / `F n` / next controlsを固定表示。 | 現在Frameと既存Frame navigationを維持。static SetupではFrame変更によりBone保存先を変えない。 |
| 5. Scroll content — Structure | `構造`見出しと階層順のBone tree。Rootは`R` glyph/`Root` label、子はindentと短い名称。全行は一行ellipsis。選択は既存active border。 | 行clickで既存`rigSelectedBoneId`を選択。長い一覧だけ中央領域で縦scroll。 |
| 6. Scroll content — Author | tree直下に現在toolの短いラベルとprimary action。Root未設定: `Rootを配置`。Rootあり・Bone選択あり: `Boneを配置`。selected parentを同じ行の上または横に`親: <name>`として常時示す。 | button clickはruntime toolをarmするだけでmodel/Historyを変えない。arm中はbutton `aria-pressed=true`、短い`Canvasでbaseからtipへdrag · Escで取消` status。 |
| 7. Scroll content — Selected | Bone選択時のみ、`親`label + existing parent select。Rootは`Root · 親なし`でselect不可。現在のBone名、Bind lengthはread-only statusとして必要なら一行表示。 | select changeで既存parent setterを1 transaction。self/descendantはoption除外、失敗理由はexisting live statusへ出す。 |
| 8. Scroll content — Artwork link | Boneが一つ以上、対象がstatic-edit-allowed、未bindingの場合のみ`AUTO GRIDで絵を接続` buttonと`未接続`status。Binding済みの場合は操作を隠し、`Mesh/Skin接続済み`を表示。 | existing `generateRigLensArtworkBinding()`へ委譲。generator、weight、mesh settingsは追加しない。binding後は現行static edit guardを維持。 |
| 9. Fixed footer | `SETUP / MOTIONへ進む`または`MOTION / SETUPへ戻る`既存mode action。MOTION時の既存Motion KEY/未確定Pose取消buttonはfooter内の既存terminal slot。 | modeを変える操作とKEY/取消を視覚分離。未確定Pose guardを迂回しない。SETUP中にKEY controlを出さない。 |

Action優先順は「構造確認 → 次の作成tool → 選択Boneの親 → Artwork接続」。主要ボタンはworkspace幅内でfull-width、button textは短く、説明をparagraphで積み上げない。既存`.gui-control` S/M、Futaba semantic token、focus/disabled状態を使う。fixed footer以外にscrollbarを増やさない。Status DOM、PART/DEFORM、Frame row、MOTION KEYの既存ownerを奪わない。

## H. CANVAS SYMBOL / INPUT BLUEPRINT

### Symbols

- **Root:** Root baseにだけ使用する、Bone bodyやhandleと異なるdiamond markと`R` label。Rootは一つ。Root labelはzoom/pan後も選択識別でき、操作中心から少しずらしてhandleと重ねない。
- **Bone geometry:** base-to-tipのsolid line。通常のbase/tip joint pointは小さな丸。selected Boneのみorange outlineで強調し、既存Futaba active tokenを使う。
- **Edit handles:** selected SETUP Boneのみ。baseの移動handleはsquare/cross、tipの回転・長さhandleはhollow ring + direction/length cue。joint dotとは別glyph。未選択Boneにdrag handleを出さない。
- **Hierarchy:** dashed/dotted relation connectorをparent tip→child baseに描く。solid geometryと色/線種/ARIA labelを区別し、これは「接続Bone」ではなくparent relationshipと伝える。
- **Placement preview:** gesture中はsolid provisional Boneと、parent選択時のdashed relation preview。Root tool時はRoot glyphも仮表示。すべてpointer-eventsを持たない。
- **MOTION:** Bind edit handlesとplacement previewを出さない。既存Motion pose overlay/選択/KEY経路だけを表示する。

### Input ownership and terminals

| 状態 | click / drag | pointerup | cancel / Esc / selection・mode change |
| --- | --- | --- | --- |
| SETUP idle / selection | Bone glyph/body clickはBoneを選択。空Canvas clickは選択をclearするだけ。Canvas入力はDrawingへ渡らない。 | 選択投影だけを更新し、History/KEYは増やさない。 | tree selectionは`rigSelectedBoneId`一つを更新。別state machineを作らない。 |
| Root placement armed | Canvas drag開始点＝Root base、移動中はghostのみ。minimum valid length未満の短いclickは作成せずstatusを表示する。 | 有効長なら既存Root planner/CAF登録bridgeでRootを作成し、1 History。Pointer captureを解放しtoolをdisarm。 | pointercancel/window blur/Escはpreview/toolだけ破棄し、model/Historyを変えない。SETUPからのtarget切替もarmed toolを破棄する。 |
| Child placement armed | 先にtreeでparentを選択し、buttonでtoolをarm。Canvas dragの開始点はparent tipに限定しない。開始時にasset/layer/parent IDsをgestureへ固定。既存editable handlesは非interactive。 | project座標を既存camera/zoom/pan経由で得て、parent Bind world inverseへstart/endを変換。長さguard通過後、`parentBoneId`とgeometryを一度登録。1 History、作成Boneを選択してdisarm。 | pointercancel/Esc/window blur/無効長は作成なし。target/parentが変わった場合はgestureをreject/cancelする。 |
| Selected Bone geometry edit | selected base drag＝Bind base translation。selected tip drag＝Bind angle+length preview。parent-child relation previewは同時更新。 | 既存CAF snapshotで一つのstatic geometry History。子孫は現行evaluatorの親継承で追従。 | pointercancel/Escはgesture開始前snapshotへrollback。tool切替・Frame/target変更はgesture中に許さず、完了か取消を要求。 |
| Parent correction | treeの`親`selectだけが所有。Canvas dragで親を推定しない。 | 既存`setRigLensStaticBoneParent()`経由で一件History。Bind World positionは保持。 | invalid/cycle/non-invertibleは拒否し、既存parentと正本を維持。 |
| MOTION | 既存Pose gestureだけを許可。SETUP placement/Bind handlesはhit-testしない。 | explicit既存KEY terminalのみ保存。 | 既存Pose cancel、Esc、Frame guardを維持。 |

Canvas pointerdown時に`RightWorkspaceFrame`だけがactive toolを所有し、Pixi drawing handlerへ同じgestureを配送しない。pointer capture後のmove/up/cancelは既存契約を維持する。表示markerと操作handleを別DOM/SVG要素として扱い、配置中に別Boneの編集gestureを開始しない。

## I. ACCEPTANCE STORYBOARD

以下は後続Browser Cardが使用する提案手順であり、本Cardでは未実行。

| # | GUI / Canvas 操作 | 直後の表示・正本・Undo |
| --- | --- | --- |
| 01 | Animation Dock内で対象CAF Rasterを選択し、右Workspaceを`TRANSFORM → DEFORM → SETUP`へ。 | HeaderにCAF/LaneとRaster名、Frame row、空の構造tree。入場・選択だけではHistory/KEY 0。 |
| 02 | `Rootを配置`を押し、Canvasで骨盤位置から胸位置へdrag。 | Root diamondとsolid torso Bone preview。pointerupでRootがtreeへ1件追加される。1 CAF History、Motion KEYなし。Esc/cancelなら空構造のまま。 |
| 03 | Rootを選択し、`親: Root`を確認して`Boneを配置`。胸上部から頭頂へdrag。 | Root-child dashed connectorとhead/neck Bone。親子はRoot→neck/head、Rootを再選択せずに追加Boneは新Bone selectedとなる。1 History。 |
| 04a | Rootをtreeで選び、`Boneを配置`。左肩から左肘へdrag。 | 左上腕BoneのgeometryとRootからのdashed parent relation。 |
| 04b | 左上腕をparentにして左肘から左手首へdrag。 | 左前腕が上腕の子となる。 |
| 04c | Rootを再選択し、右肩→右肘をdrag。右上腕を選択して右肘→右手首をdrag。 | 右腕が左腕と同じRoot下の兄弟branchとして並ぶ。Canvas lineとtree indentationが一致。 |
| 04d | Rootを選択し、左腰→左膝、左腿を選択して左膝→左足首をdrag。右側も同様に右腰→右膝、右膝→右足首。 | 左右脚がRoot下でbranchし、各shinは対応thighの子。全体10 Bone。 |
| 05 | TreeとCanvasのsolid Bone / dashed relationを確認。 | Root 1個、neck、左右のupper/forearm、左右のthigh/shinが同じCAF Rasterの一つの`rigDefinition.bones`で識別できる。Clip order/Layer orderは不変。 |
| 06 | 位置を間違えたBoneを選びbase handleで移動。joint位置を直す場合はtip handleをdragしてangle/lengthを合わせる。 | preview中にparent/children位置が追従。pointerupでgeometry変更1 History。Esc/cancelは開始時のBind geometryへ戻る。 |
| 07 | 間違ったchildを選び、`親`selectから正しいparentへ変更。 | dashed connectorとtree indentだけが移り、model setterがBind World positionを保持。1 History。cycle/self/descendant選択は拒否。 |
| 08 | 全Bone名、Root icon、branch、Canvas lineを確認し、Undo/Redoで最後の変更を往復。 | ID/parent/Bind transform/lengthが復元。KEY、Mesh、Skinは未変更。Project serialize/revisitでもBone構造を保持。 |
| 09 | `AUTO GRIDで絵を接続`を明示実行。 | 既存Mesh/Skin generatorが対象Rasterへ接続。現在Mesh/Skin状態を表示。static Setupは既存guardに従い編集不可。Bone登録だけでKEYは作らない。 |
| 10 | `MOTIONへ進む`。必要なPose操作をした場合のみ既存の明示KEY確定を実行。 | 既存`ClipInstance.rigMotion`/Motion KEY ownerへ移行。SETUP Bind変更とFrame Poseを混同しない。Dock開閉はtarget/structureを失わせない。 |

**簡単な2-Bone腕:** 対象Raster→DEFORM SETUP→Rootを肩/胴の基点から肘側へ配置→Rootをparentとして上腕を肩から肘へdrag→上腕をparentとして前腕を肘から手首へdrag→必要ならbase/tipを修正→tree/破線を確認→必要な時点でAUTO GRID。ユーザーは親tipからのdragを要求されず、各追加時の`親:`表示で階層が分かる。

## J. IMPLEMENTATION SLICES

### R-25 — DEFORM Placement Mode / Root + Child Vertical Slice

- **責務:** Root/child placementを明示toolへ変更し、Root・一段child・branch候補をCanvas上で作成する。parent選択とbase-to-tip geometry placementを別gestureにする。placement中のBind handlesを非interactive化する。
- **Own files:** `ui/right-workspace-frame.js`、`system/animation/rig-static-authoring.js`、`ui/animation-table-popup.js`（既存registration/history bridgeの狭いadapterのみ）、`styles/components/layer-panel-surface.css`、`build/verify-right-workspace-rig-lens.mjs`、`build/verify-rig-static-authoring.mjs`。
- **再利用:** `rigSelectedBoneId`、`rigPlacementMode`、Canvas coordinate projection、CAF Bone registration、既存History/ID/serialization。
- **Do not touch:** PART、Motion solver/KEY、mesh generator、schema、旧RIG入口、全Canvas/camera authority。
- **技術 / Browser:** Root drag、child arbitrary base/end、branch、短click、長さguard、pointer capture/cancel/Esc/window blur、描画非配送、History 1/0、save/revisitをtargeted verifierと一時実Artworkで確認。
- **STOP:** 親local conversionが現在のevaluator/Canvas座標と一致しない、または登録時のlegacy focus副作用がselected targetをずらす場合はgestureを拡張せず返す。

### R-26 — Static Bone Endpoint / Length Correction and Parent Repair

- **責務:** 作成後にjoint位置を直せるselected base/tip操作を完成し、既存parent selectを階層修正の明確な操作として見せる。tip操作はBind angle+existing lengthを一つのtransactionで更新。
- **Own files:** `system/animation/part-rig.js`、`system/animation/animation-data-model.js`、`ui/animation-table-popup.js`、`ui/right-workspace-frame.js`、必要なCanvas overlay CSSとrig verifier。
- **再利用:** existing `length` data/validation/evaluation、`updateRigBoneParent()` world transform preservation、CAF Asset snapshot History。
- **Do not touch:** length schema/serialization形式、Bone evaluator mathematics、Motion KEY、既にbinding済みMesh/Skinでのstatic edit。
- **技術 / Browser:** base/tip edit、parent/cycle rejection、descendant follow、1 gesture/1 History、cancel/Undo/Redo/save-revisit、Canvas drawing isolation。Mesh/Skin後は既存static edit guardを確認。
- **STOP:** length変更がweight/skin evaluationの互換を壊す、または新しいHistory semanticsが必要ならAPI実装を止めてOwner/Commanderへ戻す。

### R-27 — Compact Tree / AUTO GRID → MOTION Production Story

- **責務:** 本BlueprintのWorkspace orderingとtarget name、tree/parent relation、既存AUTO GRID→MOTIONのprogressive displayを統合し、2-Boneと一枚人型StoryboardをBrowserで通す。
- **Own files:** `ui/right-workspace-frame.js`、`styles/components/layer-panel-surface.css`、`build/verify-right-workspace-rig-lens.mjs`。AUTO GRID/MOTIONの接続不備が実証された場合だけ`ui/animation-table-popup.js`を追加ownerとして確定する。
- **再利用:** 既存CAF target resolution、AUTO GRID、MOTION entry、Frame/KEY、Status、Dock。
- **Do not touch:** generator/evaluator、Dock全面再設計、PART/IK、storage/History contract。
- **技術 / Browser:** 194px viewportの一scroll reachability、tree/Canvas一致、AUTO GRID後のguard、Dock open/closeでtarget維持、2-Boneと10-Bone branching storyboard、保存再訪。
- **STOP:** Existing multi-root targetやbound Rasterを安全表示できない場合、読み取り表示と編集不可状態の扱いをOwner判断前に推測実装しない。

各SliceはそのCardの開始時にbranch/HEAD/worktreeとproduction file ownershipを再確認し、指定targeted checks・変更JS構文・`git diff --check`・buildを実施する。R-24ではいずれのSliceも開始していない。

## K. UNRESOLVED / OWNER DECISIONS

1. **方式承認:** Plan A*（親選択→任意Canvas base/tip配置）を第一案とする。Plan Bの未接続Joint stagingやlegacy GUI全移植を要件にするか、Ownerの確認が必要。
2. **既存複数Root:** general validatorは複数Rootを必ず拒否するわけではないが、`inspectStaticRigAuthoringTarget()`はBoneが複数Rootなら新Lensで編集対象外にする。既存legacy複数Root Rigを新Lensで読み取り表示/編集する要求があるか。既存データを自動統合しない。
3. **Bone length edit:** `length`は現行保存fieldだがLens static edit用setterが見つからない。existing fieldへの限定mutation APIをR-26で追加してよいか。承認・targeted weight/skin互換確認までは完成済み機能と扱わない。
4. **Canvas hierarchy connector:** parent tip→child baseの破線を、Bone bodyの実線と別意味で表示する提案。小画面/重なり時の視認性をprototypeでOwner確認する。Root glyphの最終見た目とAUTO GRIDボタンの短いlabelもprototype review対象。

## R-24 Closeout

- 成果物: 本計画書1点。製品コード、保存データ、Browser、build、verifierは変更・実行していない。
- 提案はOwner review前であり、`OWNER ACCEPTED`ではない。
- 次の候補はR-25だが、このCardでは開始しない。
