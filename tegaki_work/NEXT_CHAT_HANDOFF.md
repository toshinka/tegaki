# Tegaki 次チャット引き継ぎ

更新日: 2026-09-04

状態: Phase 9pまでclose。現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate、Gate 0の既存WARP authority監査から開始する。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9q.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/Archive/phase9p.md`
8. `開発用資料保管庫/proposals/Tegaki_Transform_Warp_Animation_Rig_FocusLens_Proposal_for_CODEX_2026-08-31.md`
9. `開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md`
10. `tegaki_work/system/animation/clip-layer-transform.js`
11. `tegaki_work/system/animation/transform-edit-context.js`
12. `tegaki_work/system/animation/transform-edit-transaction.js`
13. `tegaki_work/system/animation/folder-part-render-plan.js`
14. `tegaki_work/system/animation/animation-data-model.js`
15. `tegaki_work/ui/animation-table-popup.js`
16. `tegaki_work/system/layer-system.js`
17. `tegaki_work/system/layer-transform.js`
18. `tegaki_work/build/verify-clip-layer-transform.mjs`
19. `tegaki_work/build/verify-clip-layer-transform-render-plan.mjs`
20. 既存WARP / deformer / compositor / Project save / History実装

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

既存差分を維持する。`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。`ComfyUIPortable`、`EasyReforgeExtension`、`RegionalLoRALab`は別Projectなので対象外。

## 3. Phase 9p close時点

- Transform edit contextはTable / primary Clip / current Frameから`SOURCE / ANIMATE READY / ANIMATE KEYED / BLOCKED`をruntime projectionし、保存しない。
- LayerSystemはinput session / SOURCE、AnimationTablePopupはANIMATE preview / rollback / Timeline Historyを所有する。Raster Bake後のeventへ時間keyを後付けしない。
- CAF全体Motionは既存`ClipInstance.transformKeyframes`。active internal RasterだけのMotionは`ClipInstance.layerTransformTracks[]`で、同じTimeline Historyを使う。
- Owner実機確認により、root Clip Motionを内部Layer行へechoしてworking Rasterを一括proxyにする案を廃止した。Layer Transformは選択中のworking Raster一枚だけをtargetとし、兄弟Layerへ影響しない。
- Layer Motion trackは`internalLayerId / pivotX / pivotY / keyframes`だけを保存し、working Layer、DrawingSnapshot、RIG、Meshをauthorityにしない。
- compositorは対象Raster一枚をRenderIsland化する。同じRasterがRIG Part、Mesh / Skin、clipping splitにも属する場合は二重変形せず`unsupported`で停止する。
- Project serialize / validate、internal Layer削除、Clip copy / paste、structured bake、duration retime、Timeline History capture / restoreへtrackを接続済み。
- KEYは対象internal Layer行だけへ7pxの単色丸で表示する。外周ring / box-shadowはなく、Part / Bone菱形、WARP key、cell clickは変更していない。
- BrowserでLayer 2だけのF1 / F10位置、Layer 1非干渉、Frame往復、Undo / Redo、computed style、console 0件を確認した。
- 全141 verifier、production build、生成物清掃を通過した。GitHubURLの旧`ClaudeReview` 7件は実在する`Claude_GPT_Review`へ補正済み。

## 4. 次のtask

Phase 9q Gate 0の既存WARP authority監査。

1. normal Raster / CAF internal Raster / root Clip / FolderのWARP保存正本を一覧化する。
2. SOURCE / ANIMATE、History、save / reload、preview / export / bakeの接続順を確認する。
3. RIG Part / Mesh / Skin / clippingとの排他または合成順序を固定する。
4. Layer Transform `WARP`と既存`WARP WORKSPACE`を二重authoring UIにしない入口案を比較する。
5. Gate 0の採否後にだけproduction実装Sliceを立てる。

Drawing WARP実装、static RIG、Animation Table / Layer Panel全体再配置は監査と並走しない。

## 5. model分担候補

- SOL / MAX: live code照合、authority / History / save / compositor境界、Gate採否、production実装、全diff監査、Phase close。
- Antigravity2: 境界入力が固まった後のread-only比較、他ツール操作文法・視線誘導・fixture / 実画面レビュー。外部提案をそのまま実装契約にしない。
- LUNA / MAX: 対象file、既存契約、Acceptance Criteria、verifier、停止条件が一つに確定した限定Sliceだけ。
- 同一production fileを複数agentで並走編集しない。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9pまでclose済みです。現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate、Gate 0の既存WARP authority監査から開始します。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9q.md、tegaki_work/TRANSFORM_SESSION_BOUNDARY.md、開発用資料保管庫/Archive/phase9p.md、Transform / WARP関連proposal、clip-layer-transform.js、transform-edit-context.js、transform-edit-transaction.js、folder-part-render-plan.js、animation-data-model.js、animation-table-popup.js、layer-system.js、layer-transform.js、関連verifierを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更を維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。ComfyUIPortable、EasyReforgeExtension、RegionalLoRALabは別Projectなので無視してください。

Phase 9pではCAF全体MotionのtransformKeyframesと、active internal RasterだけのlayerTransformTracksを分離しました。Layer Transformから選択Layer一枚だけへF1 / F10 keyを設定でき、兄弟Layerは動きません。KEYは対象Layer行の単色丸です。Timeline History、Project serialize、delete / copy / bake / retime、RenderIsland、Undo / Redo、Browser、全141 verifier、buildを通過しています。

次作業予告はPhase 9q Gate 0の既存WARP authority監査です。作業担当はSOL / MAX。監査表が固まった後にAntigravity2のread-only比較観点を使う候補とし、production writeは並走しないでください。
```
