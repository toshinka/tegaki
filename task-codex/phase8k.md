# Phase 8k — Manual Raster Mesh Topology Boundary Gate

更新日: 2026-08-20
担当: SOL / XHigh（ownership、topology mutation、weight再map、History / STALE、Gate選定）。pure fixtureが固定した限定実装だけLUNA / MAX候補
状態: OPEN — Gate 1=`GO — A: Existing vertex rest-position move only`、Stage B pure / Model完了、Gate 2待ち

## 1. Goal

一枚RasterのAUTO GRID / AUTO SHAPEが作ったMeshを、絵の輪郭・関節・線幅へ合わせて後から最適化するための最小安全単位を選ぶ。

Phase 8jのWeight brushは既存固定vertexへのweight編集として完結した。本PhaseはMesh形状を変える操作を別Gateに保ち、最初からpoint追加、triangle切断、自由再triangulationを一括実装しない。

## 2. Authority / preservation contract

- Raster画素 / snapshot、`ClipAsset.meshDefinitions / skinBindings / rigDefinition`、`ClipInstance.rigMotion`の既存所有を維持する。
- Mesh topology変更後もpreview / playback / onion / random seek / Bake / GIF / APNG / Project reloadは既存Skin evaluatorとrender planを共有する。
- stable `vertexId`、triangle winding、UV / source座標、最大2 normalized influence、generator lineage、CURRENT / STALE、CAF asset Historyを同時に監査する。
- WARP Control MeshとRaster Skin Meshは似たUIを再利用できても、保存topology、Bind / Pose、評価順を統合しない。
- AUTO GRID / AUTO SHAPE / AUTO LINEの既存再生成、Phase 8c CORRECT、Phase 8j BRUSHを無言で上書き・解除しない。

## 3. Stage A — read-only boundary audit

次を現行コードと固定fixtureで比較し、production mutationの前にGateを出す。

1. Raster Skin Meshのvertex / triangle / UV / source signature / generator / skin bindingの実shapeとvalidation。
2. AUTO GRID / AUTO SHAPE / AUTO LINEでstable IDと再生成lineageがどう違うか。
3. WARPのPOINT / SELECT / Control Mesh helperから再利用できるscreen hit / runtime selectionと、再利用してはいけない保存・Pose処理。
4. 既存vertexのBind位置移動だけで成立する最小案、point追加＋局所triangle分割、edge切断／再接続、全面manual topologyの四案。
5. topology mutation時のweight補間、UV / Raster bounds、winding / overlap / degenerate、Undo / Redo、duplicate / reload、STALE / regenerate確認。

## 4. Gate候補

### A. Existing vertex rest-position move only

既存`vertexId`とtriangle indexを維持し、Bind位置／UVの対応だけを安全範囲で動かす。関節周辺のtriangle密度は増やせないが、輪郭fitの限定補正として最小。

### B. Add point + local triangle split

既存triangle内へpointを一つ追加し、triangleを3分割する。新しいstable ID、barycentric UV、既存3頂点からのweight補間を固定し、削除・edge切断は後送する。

### C. Full manual topology editor

point追加／移動／削除、edge切断／接続、triangle編集を同時に扱う。自由度は高いが、invalid intermediate、weight再map、selection / History、touch導線が大きいため初期候補にしない。

### D. HOLD

Owner制作fixtureで固定topology + Weight brushが十分なら、manual topologyを開かずAuto Shape / generator品質の限定改善へ戻す。

## 5. Gate acceptance

- 選んだ最小操作が一つのpure plan、対象Mesh一つ、CAF asset History一件へ閉じる。
- failure時はinput asset非mutation。未知ID、stale source、unsupported generator、active WARP / rigid / clipping conflictを理由付きで拒否する。
- topology変更後の全vertexに一意stable ID、finite position / UV、valid triangles、既存Skin validationを満たす。
- Weight brush / CORRECT済みlineageを無言破棄しない。必要なら明示確認と、変更対象だけの決定的weight移送を定義する。
- Mouseに加えpen / touchで到達できる明示modeを持ち、modifierだけを唯一導線にしない。

## 6. Non-goals / stop conditions

- Multiple Mesh自動分割、Shape zone第二正本、DQS、stretch、physics、Attachment、Mesh Bone IK。
- WARPとSkin Meshの保存統合、WARP PoseをSkin Bindへ流用、Motion中topology authoring。
- 自動再triangulationが既存weightを推測で全置換する案。
- 新しい評価正本、solver、GPU Skinを要求する場合は`HOLD / REPLAN`。

## 7. First work

SOL / XHighで`raster-bone-skinning.js`、三generator、Model adapter、WARP point / selection helper、render plan、既存verifierをread-only監査する。最初の成果物はownership表、候補A〜D比較、固定fixture、Gate判定であり、Gate前にDOM / pointer / CSS /保存schemaを変更しない。

## 8. Stage A audit / Gate 1（2026-08-20）

| 領域 | 現行正本 | Gate結論 |
|---|---|---|
| Raster画素 / bounds | internal Rasterの`drawingSnapshotId` → `DrawingSnapshot.pixels / rasterBounds` | vertexはsource bounds内だけ移動可能 |
| Mesh | `ClipAsset.meshDefinitions[]`の`vertexId / x / y / triangles / generator` | x / yは独立UVではなくBind位置とsource sampling位置を兼ねる |
| Weight | `ClipAsset.skinBindings[].vertexWeights` | 既存vertex移動では変更しない |
| Pose | `ClipInstance.rigMotion` | Setup中のTopology編集へ混ぜない |
| Render | `raster-skin-render-plan.js` → CPU / Pixi共通triangle adapter | Mesh結果を変えず既存surfaceへ到達する |
| WARP | `ClipInstance.folderDeformers` / normalized Control Mesh Bind・Pose | hit / selection発想だけ再利用可。保存topology / Poseは共有不可 |

- validatorはstable ID、finite座標、triangle参照、degenerate、Skin参照を検査するが、winding維持とtriangle間overlapは保証しない。
- AUTO GRID / AUTO SHAPE / AUTO LINEの再生成は新しいIDを作り、source rebaseは既存topology / weightを維持する。手動編集lineageは再生成警告だけに使い、評価正本を増やさない。
- Candidate AはID / triangle / weightを維持したまま輪郭fitを補正できる。Candidate Bは新規IDとbarycentric weight補間を要し、Cはinvalid intermediateとtouch導線が大きい。
- Gate 1=`GO — A: AUTO GRID / AUTO SHAPEの既存vertex位置だけを編集`。BはAの制作結果後、CはHOLD、DはOwner fixtureでAが不要と判明した場合の停止候補とする。

## 9. Stage B — pure / Model mutation（2026-08-20）

- `raster-mesh-vertex-position-edit.js`を追加し、absoluteな`vertexId / x / y`更新を一Raster / 一Meshへ確定するpure planを実装した。
- stable vertex ID、triangle順、Skin weight、generator sourceを維持し、変更時だけ`topologyEditMode: fixed-vertex-position-v1`を再生成警告lineageとして付ける。
- snapshot `rasterBounds`外、unknown / duplicate / non-finite、winding反転 / degenerate、既存不正topology、triangle交差 / 内包をmutation前に理由付き拒否する。
- `TimelineModel.applyClipAssetRasterMeshVertexPositionEdit()`はCURRENTだけを受け、STALEを拒否し、snapshot boundsをpure planへ渡す。no-op / failureはasset非mutation。
- 既存GRID / SHAPE再生成は`topologyEditMode`を検知し、Mesh位置編集単独またはweight補正との併存を明示確認する。Setup statusは`EDITED`を表示し、手動位置を無言破棄しない。
- 固定verifierでpure非mutation、GRID / SHAPE、LINE拒否、bounds、winding、overlap、stable topology / weight、Project round-trip、STALEを確認した。
- Gate 2前はproduction DOM / pointer / CSSへ接続しない。次は1 gesture 1 History / cancel rollbackを担うpointer非依存gesture helperと、Canvas上の明示`MESH EDIT` mode設計を比較する。

## 10. Source

- `開発用資料保管庫/Archive/phase8i.md`
- `開発用資料保管庫/Archive/phase8j.md`
- `開発用資料保管庫/proposals/15_キャラクターRig・Mesh・Perform統合ロードマップ.md`
- `tegaki_work/system/animation/raster-bone-skinning.js`
- `tegaki_work/system/animation/raster-bone-auto-setup.js`
- `tegaki_work/system/animation/auto-shape-raster-bone-setup.js`
- `tegaki_work/system/animation/line-ribbon-raster-bone-setup.js`
- `tegaki_work/system/animation/raster-skin-render-plan.js`
- `tegaki_work/system/animation/raster-mesh-vertex-position-edit.js`
- `tegaki_work/build/verify-raster-mesh-vertex-position-edit.mjs`
- `tegaki_work/build/verify-raster-mesh-vertex-position-edit-ui.mjs`
- `tegaki_work/ui/animation-table-popup.js`
