# Phase 6l: Folder Part authoring UI・Plan A子行・Canvas handle

更新日: 2026-07-29

## 現在地

- Phase 6kは`GO`で完了した。完了記録は`開発用資料保管庫/Archive/phase6k.md`。
- 一つのCAF内部Folder Partは、共通render planを通じてPixi preview / playback / onionとCanvas compositor / Bake / exportへ同じposeで描画できる。
- 現状はProject dataまたはfixtureにRigを用意しないと使えず、通常操作からFolder Partを登録・選択・key編集する導線がない。
- Phase 6lはUI Plan Aを一つのFolder Partへ限定して接続する。BONE chainやMeshへ進む前に、選択、入力、History、Table開閉を既存正本上で確定する。

## 最初に読むもの

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `開発用資料保管庫/Archive/phase6k.md`
6. `開発用資料保管庫/Archive/phase6j.md`
7. `開発用資料保管庫/Archive/phase6i.md`
8. `開発用資料保管庫/proposals/00_計画索引.md`
9. `開発用資料保管庫/proposals/01_短中期ロードマップ.md`
10. `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
11. `tegaki_work/ui/animation-table-popup.js`
12. `tegaki_work/ui/layer-panel-renderer.js`
13. `tegaki_work/system/animation/animation-data-model.js`
14. `tegaki_work/system/animation/part-rig.js`
15. `tegaki_work/system/animation/folder-part-render-plan.js`
16. `tegaki_work/system/animation/clip-transform-sampler.js`
17. `tegaki_work/system/history.js`
18. `tegaki_work/styles/main.css`

`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。proposalの`過去計画（アイデアのサルベージ時に使う。基本読み込まない）/`も通常は読まない。

## 目的

選択CAFの一つの内部FolderをPartとして登録し、そのPartをAnimation Table子行で選択してposition / scale / rotation keyを編集できるようにする。Canvas direct manipulationは既存`rigMotion.partTracks`へcommitし、preview中の一時状態と保存正本を分離して1 gesture = 1 Historyを維持する。

## Slice 0: 現行入力・History・投影境界監査

実装前に次を確認する。

1. Animation TableのLane / CAF行、Motion / WARP行、行選択、折りたたみ、Frame cellを作る既存経路。
2. CAF内部Folderの選択正本と、通常Layer / CAF内部Layerのdata adapter境界。
3. Layer属性、Clip Motion / WARP handle、Layer Transformのpointer capture、screen → Canvas → Clip local座標、preview / commit / cancel。
4. `rigMotion.partTracks`の追加・key upsert / deleteに再利用できるmodel helperと、History transactionの既存単位。
5. Table open / close、playback / onion、Project load、CAF copy / pasteで選択とpreviewを再同期する既存event。

新しいEventBus event、History正本、座標変換helper、motion samplerを作る前に同名・同用途を`rg`で全検索する。

## Slice 1: 一つのFolder Part登録

1. 選択CAF内部Folderに対し、明示操作でPart登録できる最小入口を追加する。
2. Part identityはFolderのstable `id`を再利用し、別の同義IDを作らない。
3. 初期`bindTransform`はidentity。表示親`parentLayerId`、表示順、clipping sourceを`parentPartId`へ流用しない。
4. Phase 6lではRig定義内Partを一つに限定する。別Partが既にある場合は追加せず、理由をUIへ明示する。
5. 解除時に既存trackを無言削除しない。解除仕様が曖昧なら登録だけを実装し、解除は後続へ送る。

## Slice 2: Animation Table Plan A子行

1. 選択CAFだけにPart子行を投影し、親CAF行の開閉と連動する。
2. 既存TimelineとFrame列を共有し、mini TimelineModelやUI専用key配列を作らない。
3. 子行選択はruntime UI state。保存正本は`rigDefinition.parts`と`rigMotion.partTracks`のまま維持する。
4. Frame cellは既存Part keyの有無と選択を表示し、key追加 / 更新 / 削除を既存trackへ委譲する。
5. CAF / Laneが多い時の縦占有、名称幅、touch hit areaをBrowserで確認する。Plan BのRig Inspectorは本Phaseで実装しない。

## Slice 3: Part key入力とCanvas handle

1. position / scale / rotationだけを対象とし、既存transform-track fieldとsamplerを使う。
2. Canvas handleのdrag中はruntime poseでpreviewし、pointer up時にcurrent Clip-local Frameへkeyを一度だけcommitする。
3. cancel時はcapture前poseへ戻し、Project / Historyへ書き込まない。
4. 一つのgestureは一つのHistory。drag中のmoveごとにProject checkpointやHistoryを作らない。
5. Tableを閉じても選択CAFのactive poseを表示する。描画stroke開始時はPhase 6kのworking Layer adapterへ戻す。
6. `A`、`Q`、`V`、`M`など既存shortcutを変更しない。新shortcutはこのPhaseの必須条件にしない。

## 維持する契約

- stroke中の選択CAFはworking Layerで表示する。
- previewは非表示stagingで完成後に一括交換する。
- preview container順は`background -> back preview -> currentFrameContainer -> front preview`。
- Animation Tableでは上側LaneをCanvas前面とする。
- Lane / Timeline onionはdisplay-only。
- PSD recordは背面から前面。
- animation working Layerは表示・入力adapterであり保存正本ではない。
- Folder clipping、通常Layer / CAF内部Layerのdata adapter境界。
- Part identityはCAF内部Folderのstable `id`。表示親とrig親を混同しない。
- Clip root Motion、WARP mask、Control Mesh、Part FK、physicsの正本を重複実装しない。
- Pixi / Canvas / Bake / exportはPhase 6kの共通render planを使い続ける。

## このPhaseで行わないこと

- BONE chain、joint、IK、constraint
- Mesh、SkinWeight、Morph、Perform、Draw Order、Dynamics、physics
- 複数Part / nested Partの描画接続と自動RenderIsland
- Rig Inspector Plan B、常設tree、Setup / Animate全体UI
- CAF内部FolderのLane化、mini CAF / mini TimelineModel
- Text、Deformer SELECT、WebGPU / SDF / MSDF
- Pixel Selection横断リファクタリング

## 停止条件

- UI専用Part ID、key配列、motion samplerが必要になる。
- Folder Part登録がdisplay hierarchyやclippingを変更しないと成立しない。
- drag previewのためにDrawingSnapshotやworking Layerへposeを焼き込む必要がある。
- Table open / closeで別のkey編集・座標変換経路が必要になる。
- 1 gesture = 1 History、cancel無変更、random seekのいずれかを維持できない。

停止条件に達した場合はBONEへ進まず、`REVISE`として固定入力、原因、代替UI境界を本書へ記録する。

## 検証

- 変更JSすべてへ`node --check`。
- Phase 6j / 6kの全verifierを再実行する。
- 新規fixed-inputでPart登録、重複拒否、key add / update / delete、HOLD / LINEAR、Frame 0 / 中間 / 末尾、random seek、save / load、CAF copy / paste、1 gesture = 1 History、cancel無変更を確認する。
- `npm.cmd run build`。
- Browserで通常描画、CAF内部Folder選択、Part登録、子行開閉 / 選択、key表示、Canvas move / scale / rotate、確定 / cancel、Undo / Redo、Table open / close、playback / onion、Project再読込、console errorを確認する。
- 可能ならpen / touchのhit areaとpointer cancelを確認する。
- build後は`tegaki_work/dist/`生成差分を残さない。稼働中dev server由来の既存`tegaki_work/node_modules/.vite/`差分は維持する。

## 最初の作業

1. scoped `git status`で既存差分を維持する。
2. Animation Table行、CAF内部Folder選択、既存Motion / WARP handle、History transactionを監査する。
3. 一つのFolder Part登録と子行投影に必要な既存model helper / event / CSSを列挙する。
4. 新しい正本を追加せず成立する最小Sliceを決め、固定入力を先に作る。

## 進捗（2026-07-29）

- Slice 0監査を完了した。Part選択は既存`selectedInternalLayerId`、登録はCAF asset履歴、key編集はTimeline履歴を使い、新しいUI正本・EventBus event・samplerを追加しない方針で固定した。
- CAF内部FolderのLayer属性へ`PARTとして登録`を追加した。Folder stable ID、identity bind、一つのPart上限、共通clipping境界validatorを維持し、解除は未確定のため実装していない。
- 選択CAFのLane直下へPlan Aの22px Part子行を追加し、既存Frame Gridへkey表示、現在Frameの`◆`追加 / 削除、Frame cell double-clickを接続した。
- display-only `part-transform-overlay`を追加した。枠内dragはposition、四隅は等比scale、上部handleはrotationへ解決し、Clip root Motion / cameraの既存座標変換と`rigMotion.partTracks`を使用する。scale / rotationはFolder Raster unionの見た目中心を固定する純粋代数を`part-rig.js`へ集約した。
- Canvas gestureはmove中だけpreviewを更新し、pointer upで一件のTimeline Historyへcommitする。Esc、pointer cancel、lost captureは開始前stateへ戻し、key / Historyを残さない。
- fixed-inputはFolder登録、重複 / 2件目 / Raster拒否、Frame 0 / 中間 / 末尾、key add / update / delete、HOLD / LINEAR、random seek、round-trip、中心固定scale / rotationを受入れた。Phase 6j / 6k verifierも通過した。
- BrowserではFolder登録、22px子行、key add / delete / double-click、Undo / Redo、Table再開、Preview併用、console errorなしを確認した。Canvas handleのmove / scale / rotate、Esc / pointer cancel、playback / onionの最終実操作は次の受入入口として残す。

## 完了判定（2026-07-29）

- オーナー実機でCanvas handleの操作を含むPhase 6lに問題なしとの受入を得た。
- 一つのFolder Partに限定した登録、Plan A子行、既存Part trackへのkey編集、Canvas move / scale / rotationを完了した。
- Phase 6lを`GO`でcloseする。後続はUI密度の小修正をPhase 6mへ隔離し、その受入後にBONE境界へ進む。
