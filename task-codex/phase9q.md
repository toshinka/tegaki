# Phase 9q — Drawing WARP Authority / Layer Transform Integration Gate

更新日: 2026-09-05
状態: ACTIVE — Gate 1 Task C＋Task D前Owner Timeline follow-up 完了、次はTask D
担当: SOL / MAX

## 1. 目的

Layer Transformの`WARP`を、絵を直接変形するFocus Lensとして接続する。ただし既存のClip WARP、Folder WARP、RIG Mesh / Skinを一つの機能へ混ぜず、最初に対象、保存正本、History、時間key、compositor順序を一意化する。

中心語彙はPhase 9pから継承する。

- WHAT = active normal Raster / CAF internal Raster
- HOW = Layer Transform `WARP`
- WHEN = SOURCEまたはAnimation Tableのactive Frame
- DO = Canvas direct manipulation

## 2. 最初に読む

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. `tegaki_work/NEXT_CHAT_HANDOFF.md`
5. 本書
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
8. `開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md`
9. `開発用資料保管庫/Archive/phase9p.md`
10. 既存WARP / deformer / compositor / save / History実装

## 3. Gate 0で決めること

1. normal RasterのSOURCE WARPをRaster bakeとするか、非破壊Layer authorityを新設するか。
2. CAF internal RasterのFrame-local WARPを既存Clip / Folder deformerで表せるか、Layer ID単位authorityが必要か。
3. Layer Transform `WARP` tabと既存`WARP WORKSPACE`の役割。二重authoring UIにしない。
4. Canvas control points、mesh density、確定 / Escape、Undo / Redo、Frame変更、Table closeのterminal grammar。
5. CPU preview / Pixi preview / export / bakeの一致と、RIG Part / Mesh / clippingとの排他順序。

選ばれなかった案は再試行条件と共にproposalへ保持する。Gate 0の判断前にproduction UI、Project schema、History commandを変更しない。

## 4. 最初のtask

既存`clip-deformer.js`、`animation-table-popup.js`、WARP overlay / rasterizer、Timeline compositor、Project serialize / validateのread-only監査を完了した。監査表、採用案、不採用案の再試行条件は`開発用資料保管庫/proposals/Tegaki_Drawing_WARP_Authority_Gate_2026-09-05.md`を正本とする。

Gate 0判断:

- normal RasterとTable閉鎖中CAF internal RasterのSOURCE WARPは、既存Layer Transformと同じ確定時Raster bakeとする。
- Table表示中CAF internal RasterのFrame-local WARPだけ、active internal Layer ID単位の`ClipInstance.layerDeformers`を新設する。
- root `deformer`と`folderDeformers`は対象範囲が違うため流用しない。
- Layer Transform `WARP`はSimple 4x4 direct manipulationを第一水位、既存WARP WORKSPACEはroot / Folderおよび将来のAdvanced handoffとして保持する。
- initial SliceではRIG Part / Mesh / Skin / internal clippingとの重複を理由付きで拒否する。

Gate 1 Task A完了:

- `system/animation/clip-layer-deformer.js`を追加し、optional `layerDeformers`のnormalize / serialize / validate / get / set / remove / sample / remap / retime / one-Frame bakeをpureに固定した。
- 既存`warp-grid` / `control-mesh` dispatcherだけを再利用し、DrawingSnapshot、working Layer、Project、History、DOMは変更していない。
- `build/verify-clip-layer-deformer.mjs`でold Project no-field、Raster target、Folder / Background / missing / duplicate拒否、Frame範囲、target edit、sample、ID remap、terminal retime、bakeを固定した。
- 新規2 fileの`node --check`、新規verifier、既存Folder deformer / Layer Motion / Clip bake verifier、`git diff --check`を通過した。

Gate 1 Task B完了:

- `ClipInstance` constructor / serializeと`TimelineModel.setClipLayerDeformer()` / `validateLayerDeformers()`へoptional `layerDeformers`を接続した。Project復元はinvalid optional dataを警告し、Raster / CAF本体を失敗させない。
- active internal Rasterだけを許可し、Folder / Background、RIG Part、Mesh / Skin、internal clippingとの重複はmodel境界で理由付き拒否する。
- internal Layer削除cascade、Layer複製時target remap、Clip copy / paste、Asset copy、structured one-Frame bake、duration terminal retime、Timeline History capture / restoreへ同じfieldを通した。
- `build/verify-clip-layer-deformer-model.mjs`を追加し、old Project no-field、TimelineModel / ProjectManager JSON round-trip、invalid source診断、copy / remap、delete、bake、retime、History配線を固定した。
- 変更JS / mjsの`node --check`、新規2 verifier、既存Folder deformer / Project round-trip / Layer Motion / Clip bake verifier、production build、`git diff --check`、生成物清掃を通過した。Task Bは描画・pointer UIをまだ変更していない。

Gate 1 Task C完了:

- `createFolderEffectRenderPlan()`へindividual Layer WARP effectを追加し、既存Layer Motion RenderIslandと同じtargetで併用可能にした。適用順は正本どおり`DrawingSnapshot → Layer WARP → Layer Motion → Folder composition / WARP → Folder Part / Bone → root WARP → root Motion`。
- CPU `TimelineFrameCompositor`はRaster surfaceを先にWARPし、その後にLayer Motion affineを適用する。Folder WARP内部ではLayer WARP / Layer Motionだけをchild planへ通し、Folder Part matrixを外側で一度だけ適用する。
- boundsも同じ順序で評価し、Layer WARP / Motionの拡張領域をFolder surfaceで切り落とさない。root / Folder WARPとLayer WARPは対象範囲が異なるため併用を維持する。
- RIG Part所属、Mesh / Skin、internal clipping owner / sourceとの重複はmodel / render plan双方で理由付き停止し、Layer WARPを無言で落としてexportしない。
- `build/verify-clip-layer-deformer-render-plan.mjs`を追加し、Layer WARP → Layer Motionのbounds、Folder / root併用、RIG / Mesh / clipping拒否、CPU compositor配線を固定した。全145 verifier、production build、`git diff --check`、生成物清掃を通過した。Task CはPixi previewとpointer UIをまだ変更していない。

Gate 1 Task D前Owner Timeline follow-up完了:

- Layer Transform ANIMATE session中に生成・更新されたLayer Motion丸KEYは、既存transactionの`previewApplied / changed / target identity`からだけ未確定状態を投影し、Futaba茶38%の淡色へ下げる。V close後は従来の濃い単色丸、Escape rollback後は消失する。保存fieldや別preview stateは追加しない。
- CAF internal Layer行はClip範囲内をcream 8%の面＋縦grid、範囲外を`--futaba-background`の無地面＋border 0へ分ける。選択行の薄茶26%はClip範囲内だけへ重ね、active / inactive双方でClip範囲を線の錯視だけに依存せず示す。親Timeline grid自体の反復線は除き、全内部行を囲う追加枠は面分離で十分なため採用しない。
- Lane行より下の格子なしblank面clickもX位置からFrameを求めてseekできる。CAF作成は行わない。
- Timeline gridの通常wheelはFrame移動だけとし、空きFrameでのCAF作成は`Shift+wheel`の前進時だけ既存Auto Create設定に従って許可する。`Ctrl/Cmd+wheel` zoom、Lane名領域wheelの縦scroll、keyboard / button経路は維持する。
- 更新verifierを含む全145 verifier、production build、Browserで選択行内側の薄茶＋grid、外側のBackground無地面、blank click F27、通常wheel F26・CAF非生成、console error 0件を確認した。

## 5. NO-GO

- Drawing WARPとRIG Mesh / Skin authoringを同時に実装しない。
- root Clip WARPをactive internal Raster WARPとして黙って使わない。
- working Layer、Canvas overlay、evaluated meshを保存正本にしない。
- History / save / export / compositor順序が未確定のままpointer UIを先行しない。
- Animation Table / Layer Panel全体の再配置を並走しない。

## 6. model分担候補

- SOL / MAX: live code照合、authority / History / save / compositor境界、Gate採否、production実装、全diff監査、Phase close。
- Antigravity2: Gate入力が固定した後のread-only比較、他ツールとの操作文法・視線誘導評価、fixtureや実画面に対する懸念列挙。提案は実コード照合前の実装契約にしない。
- LUNA / MAX: 対象file、既存契約、Acceptance Criteria、verifier、停止条件が一つに確定したpure helperまたは限定fixture Sliceだけ。
- 同一production fileへの複数write担当は置かず、順に進める。

## 7. close条件

- Drawing WARP対象とauthorityがnormal Raster / CAF internal Raster / root Clip / Folderで一意に説明できる。
- SOURCE / ANIMATE、confirm / cancel、History、save / reload、preview / exportの境界が固定される。
- RIG / Mesh / clippingとの排他または合成順序が理由付きで決まる。
- 採用案と不採用案の再試行条件を文書へ残す。
- productionへ進む場合は対象verifier、build、Browser実操作、console、生成物清掃を通過する。

## 8. 次作業予告

次taskはGate 1 Task D、Pixi preview proxyとLayer Transform WARP transaction接続です。作業担当はSOL / MAX。CPU planと同じsample / bounds / triangle順を使うleaf Mesh表示proxy、active internal Raster一枚だけのANIMATE preview / rollback / Timeline History境界を先に固定し、Simple 4x4の最終UI装飾とsolid markerはTask Eへ残します。
