# Phase 6p: root BONE authoring UI / one-binding workflow（完了）

更新日: 2026-07-30

## 現在地

- Phase 6oは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6o.md`。
- 一つのroot BONE → 一つのFolder Partは、optional schema、validation、共有ID remap、inverse bind delta、共通RenderIsland、preview / playback / onion / Bake / exportまで成立している。
- 現状はProject fixtureまたはJSON経由でしかBoneとbindingを作れず、制作導線がない。

## 目的

選択CAF内の登録済みFolder Part一つに対し、root BONE一つの作成、static binding、rotation中心のPose key編集を既存Animation TableとCanvasへ接続する。加えて、CAF内部Folderを候補子Laneとして投影し、CLIP MOTION内の単一RIG Inspectorへ選択連動させる。保存正本は`ClipAsset.rigDefinition`と`ClipInstance.rigMotion`のままにし、UI専用Bone treeや別trackを作らない。

## Slice 0: 現行authoring導線監査

1. Phase 6lのFolder Part登録、Part子行、key編集、Canvas handle、History commitを再利用可能箇所ごとに分ける。
2. `rigDefinition.bones` / `rigidBindings`と`rigMotion.boneTracks`のmutation入口、validation、copy / paste、save / loadを全検索する。
3. Animation Tableの選択CAF投影、PopupManager、keyboard、pointer capture、screen → Clip local座標を確認する。
4. Setup操作とAnimate操作を混同せず、作成・bindはstatic、Pose keyはFrame-local motionとして境界を固定する。

## Slice 1: 最小root BONE作成とbinding

1. 選択CAF内でPart登録済みFolder一つだけを対象に、明示操作でroot Boneを一つ作成する。
2. Boneのstable IDは既存Rig ID mapへ参加させ、Part IDを流用しない。
3. Bone bind position / rotation / scaleと`boneId → partId` bindingを一つのHistory操作でcommitする。
4. 既にBoneまたはbindingがある場合、複数Part、nested Part、invalid Rigは作成を拒否し、既存描画を維持する。

## Slice 2: Animation Table子行とCanvas handle

1. 選択CAFに限り、一つのroot Boneを既存Lane配下へ子行投影する。
2. Bone子行は既存`rigMotion.boneTracks`へposition / scale / rotation keyを追加・更新・削除する。別TimelineModelを作らない。
3. 初期の主操作はrotationとし、position / scaleは既存transform editorを再利用できる場合だけ同じSliceへ含める。
4. Canvas handleはruntime previewだけを更新し、pointer確定時に`1 gesture = 1 History`でcommitする。
5. Table開閉、random seek、playback、onion、Project reloadで同じposeを維持する。

## Slice 3: owner-visible Rig navigator / Inspector

1. 選択CAFの内部Folderを登録前から既存Lane配下の候補子Laneへ投影する。実行可能Part数は現行の一つを維持する。
2. 子Lane選択は`selectedInternalLayerId` / `selectedRigBoneId`へ接続し、別のRig選択正本を作らない。
3. CLIP MOTIONへ`RIG`モードを追加し、全Folder分の数値欄を並べず、選択中のFolder PartまたはBone一つだけのX / Y / Scale / Rotationを表示する。
4. Folderごとの操作PIVOTは選択対象だけCanvasとInspectorへ表示する。全PIVOT同時表示とstatic pivot編集は次Phaseで判断する。
5. 未登録Folderから最初のPart作成、Partからroot Bone作成、Part / Bone key追加・削除を同じInspectorへ集約する。

### UI判断の参照

- Procreate Dreams 2のContentに紐づくkey track、選択ContentだけのStage操作、compound trackを必要時に展開する考え方を採用する。
- ToonSquid 2の選択Layerとpivot / crosshairを一対一にする考え方を採用する。
- TegakiではAnimation Tableの子Laneをnavigator、CLIP MOTIONのRIGモードを単一Inspectorとする。Rig専用別windowは増やさない。

## 維持する契約

- stroke中working Layer表示、preview staging交換とcontainer順、上側Lane前面。
- Lane / Timeline onionはdisplay-only。
- PSD record順、animation working Layerは保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのadapter境界。
- static Bone / bindingはClipAsset、Bone PoseはClipInstanceが所有する。
- Part Motion、Bone Motion、Clip root Motion、WARPの合成結果を保存正本にしない。
- Pixi / Canvas / Bake / exportで別binding評価器を作らない。

## このPhaseで行わないこと

- child / grandchild BONE、複数Bone、複数binding、複数 / nested Part
- IK、Pin、Follow、Stretch、Constraint
- Mesh、SkinWeight、Morph、Perform、Draw Order、Dynamics、physics
- 複数 / nested Partの同時RenderIsland、全FolderのMotion実行、Text、Deformer SELECT、WebGPU / SDF / MSDF
- 全PIVOT同時表示、Folder / Bone bind PIVOTのstatic編集、汎用Rig schema再設計、toolbarカスタマイズ

## 停止条件

- UIのために`rigDefinition` / `rigMotion`以外のBone正本が必要になる。
- static Setup変更とFrame-local Pose keyを同じmutationとして保存しないと成立しない。
- 一つのroot Bone UIのためにAnimation Table DOMまたは主要classの大幅置換が必要になる。
- working Layer、onion、Bake、exportで異なるBone sampleが必要になる。
- Rigなし旧Project、通常描画、Part-only CAFの表示またはserialize shapeが変わる。

## 検証

- 変更JSすべてへ`node --check`。
- fixed-inputでroot Bone作成、binding、key add / update / delete、History、save / load、CAF copy / pasteを確認する。
- Phase 6o以前の全Rig verifierを再実行する。
- `npm.cmd run build`。
- Browserで作成・binding、Table子行、Canvas操作、確定 / cancel、random seek、playback / onion、Table開閉、console errorを確認する。
- build後は`tegaki_work/dist/`生成差分を残さない。

## 最初の作業

1. Phase 6lのPart authoring mutationとUI投影を関数単位で監査する。
2. Bone作成 / binding / key編集で再利用する既存関数と不足する最小adapterを表にする。
3. UIより先にroot Bone authoring mutationの固定入力を追加する。

## Slice 0監査結果

- 再利用するdata mutationは`TimelineModel.registerClipAssetFolderPart()`、`setClipRigPartKey()`、`removeClipRigPartKey()`と同じ層に置く。UIから`rigDefinition` / `rigMotion`を直接書き換えない。
- 再利用するUI境界は`_getSelectedFolderPartTimelineContext()`、選択CAFだけの子行投影、Timeline History、snapshot cache invalidation、Lane preview更新、Canvas pointer capture / Escape cancelである。
- static Setupはinternal Layer History、Frame-local PoseはTimeline Historyを使い分ける。作成とbindingは一つのstatic commitとする。
- Bone固有の不足はroot Bone + binding登録、Bone key add / update / deleteのmutation APIだった。UI専用treeやtrackは不要。

## 開始済み実装

- `registerRootBoneRigidBinding()`と`TimelineModel.registerClipAssetRootBoneBinding()`を追加し、一つのroot Bone作成と`boneId → partId` bindingを同時にvalidationする。
- `upsertRigBoneKey()` / `removeRigBoneKey()`とTimelineModel adapterを追加し、Bind Poseを変更せず既存`rigMotion.boneTracks`だけを更新する。
- Part keyとBone keyが同居する時、片方の最終key削除で他方のtrackを失わないよう空track整理境界を補正した。
- `verify-root-bone-authoring.mjs`で登録の冪等性、key追加 / 削除、Part / Bone混在track維持、Project round-tripを固定した。

## Slice 1 / 2実装結果

- CAF内部Folderの属性popupへ、Part登録後だけ有効になる`ROOT BONEを作成`入口を追加した。作成後は`BONE 接続済み`となり、同じFolderへ重複作成しない。
- root BoneのBind位置はFolder Part内Raster bounds中心、長さはboundsから上限付きで決める。Bone作成と`boneId → partId` bindingは一つのinternal Layer Historyとしてcommitする。
- 選択CAFのLane配下へFolder Part子行とroot Bone子行を投影し、Bone行と各Frame cellから既存`rigMotion.boneTracks`のkeyを追加 / 削除できる。
- root Bone選択時だけCanvasへ茶系のBone線分、root、tipをdisplay-only表示する。tip dragはrotation Pose keyだけをruntime previewし、pointer確定で`1 gesture = 1 History`へcommitする。
- Bone rotation drag代数を`resolveBoneRotationHandleDrag()`へ分離し、角度の`-PI / PI`跨ぎを固定入力化した。
- Layer Panelのpopup再描画でactive内部Layerが変わっても、popupが表示対象として保持したasset / Folder IDへPart / Bone登録を行うよう統一した。

## 現在の検証状態

- 変更JSの`node --check`、全Rig verifier、structured Bake / WARP回帰、`npm.cmd run build`は成功。
- BrowserでPart登録、root Bone作成 / binding、Bone子行、key追加 / 削除、Canvas回転、1 gestureのHistory増分、Undo / Redo、Table close / reopen、playback、Timeline onion、console errorなしを確認した。
- Escape cancelは既存Partと同じHistory restore経路へ接続済み。自動Browser操作ではdrag途中のkey割込みを再現できなかったため、オーナー実機確認を残す。
- root Boneの見た目、tip hit area、回転操作感とEscape cancelの実機受入後にPhase 6pをcloseする。

## Slice 3実装結果

- 選択CAF内の全Folderを既存Lane配下へコンパクトな候補子Laneとして投影した。Part未登録でも名前と選択PIVOTを確認でき、最初の一件だけ`+PART`から既存登録mutationへ入る。
- CLIP MOTIONへ`RIG`モードを追加した。選択子Laneに連動してFolder / Boneを切り替え、X / Y / Scale X / Scale Y / Rotation keyを既存`rigMotion.partTracks` / `boneTracks`へ記録する。
- Part登録済みFolderではroot Bone作成をRIG Inspectorへ露出した。Layer属性popupの既存入口も互換導線として維持する。
- Folderごとの操作PIVOTは、Folder内容bounds中心またはBone bind rootをInspectorへ表示し、Canvas overlayは選択対象一つだけを維持する。
- 複数Folderを表示しても、二つ目以降は未接続候補のままとし、現行の単一RenderIsland契約を越えない。

## Slice 4: RIG-first HMI整理

- CLIP MOTIONのタブ順を`RIG → MOTION → WARP`へ変更した。Folderを持つ未設定CAFを初めて開いた時だけRIGへ案内し、以後は最後に使ったタブを維持する。毎回RIGを強制しない。
- `CAF / 内部Folder`の対象タブをCLIP MOTION内へ常設した。ボタンとホイールで切り替え、全Folder分の数値行を同時に並べず、選択対象一件だけをInspectorへ表示する。
- 既存CAF共通anchorの`PIVOT配置`をMOTION headerからRIGのCAF Setupへ移した。保存正本とrebase代数は既存`ClipInstance.transform`経路を維持する。
- RIGはstatic Setup、MOTIONはFrame-local keyとして画面を分離した。MOTIONでCAFを選ぶと既存Clip root Motion、登録済みFolderを選ぶと既存Part / Bone Motionを編集する。
- WARPは現行正本がCAF全体なので、Folder対象タブを見せたまま無効化し、Folder別WARPを偽装しない。
- 未登録FolderのPIVOTは内容bounds中心の導出表示に留める。3 Folderすべてへ実PIVOT / BONEを保存するには複数Part / 複数RenderIsland契約が必要なため、次Phaseで描画・clipping・Bake / export境界から開く。
- RIG数値入力とhover説明を`--futaba-*`変数へ統一し、ブラウザ既定の白黒inputを残さない。

### Slice 4検証

- Browserで未設定CAFの初回RIG、CAF / Folderボタン、対象stripのホイール循環、CAF PIVOT表示 / edit mode、Folder Part登録、Folder Motion key入力、WARPのFolder無効化、close / reopen時のWARP維持を確認した。
- inputは背景`rgb(255, 255, 238)`、文字`rgb(128, 0, 0)`、hover説明はcream / maroon系を確認した。
- 全Rig fixed-input verifier、`node --check`、buildは成功。console errorは0件。

## Closeout

- オーナー提示のRIG-first操作案を次Phaseの入力として受け、root Bone単体操作とRIG / MOTION / WARP導線をPhase 6pの完了範囲とした。
- 全PIVOT同時表示、直接Bind操作、複数兄弟RenderIsland、親子接続線は`task-codex/phase6q.md`へ分離した。
