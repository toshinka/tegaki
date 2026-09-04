# Phase 9q — Drawing WARP Authority / Layer Transform Integration Gate

更新日: 2026-09-04  
状態: ACTIVE — Gate 0 選定開始  
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

既存`clip-deformer.js`、`animation-table-popup.js`、WARP overlay / rasterizer、Timeline compositor、Project serialize / validateをread-only監査し、再利用できるauthorityと不足するauthorityを表にする。その後、Layer Transform `WARP`の入口案を比較fixtureまたは同等の静的資料で選定する。

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

次taskはGate 0の既存WARP authority監査です。作業担当はSOL / MAX。監査表が固まった後にだけAntigravity2のread-only比較観点を取り込み、入口案の選定へ進みます。
