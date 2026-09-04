# Tegaki 次チャット引き継ぎ

更新日: 2026-09-05

状態: Phase 9pまでclose。現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate、Gate 0=`GO — C: Raster Source Bake + CAF Layer Deformer`。Gate 1 Task A〜CとTask D前Owner Timeline follow-up完了、次はTask D。

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
11. `tegaki_work/system/animation/clip-layer-deformer.js`
12. `tegaki_work/system/animation/transform-edit-context.js`
13. `tegaki_work/system/animation/transform-edit-transaction.js`
14. `tegaki_work/system/animation/folder-part-render-plan.js`
15. `tegaki_work/system/animation/timeline-frame-compositor.js`
16. `tegaki_work/system/animation/animation-data-model.js`
17. `tegaki_work/ui/animation-table-popup.js`
18. `tegaki_work/system/layer-system.js`
19. `tegaki_work/system/layer-transform.js`
20. `tegaki_work/build/verify-clip-layer-deformer.mjs`
21. `tegaki_work/build/verify-clip-layer-deformer-model.mjs`
22. `tegaki_work/build/verify-clip-layer-transform-render-plan.mjs`
23. 既存WARP rasterizer / compositor / Project save / History実装

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

既存差分を維持する。`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。`ComfyUIPortable`、`EasyReforgeExtension`、`RegionalLoRALab`は別Projectなので対象外。

## 3. 現在の実装境界

- Transform edit contextはTable / primary Clip / current Frameから`SOURCE / ANIMATE READY / ANIMATE KEYED / BLOCKED`をruntime projectionし、保存しない。
- LayerSystemはinput session / SOURCE、AnimationTablePopupはANIMATE preview / rollback / Timeline Historyを所有する。Raster Bake後のeventへ時間keyを後付けしない。
- CAF全体Motionは既存`ClipInstance.transformKeyframes`。active internal RasterだけのMotionは`ClipInstance.layerTransformTracks[]`で、同じTimeline Historyを使う。
- Owner実機確認により、root Clip Motionを内部Layer行へechoしてworking Rasterを一括proxyにする案を廃止した。Layer Transformは選択中のworking Raster一枚だけをtargetとし、兄弟Layerへ影響しない。
- Layer Motion trackは`internalLayerId / pivotX / pivotY / keyframes`だけを保存し、working Layer、DrawingSnapshot、RIG、Meshをauthorityにしない。
- compositorは対象Raster一枚をRenderIsland化する。同じRasterがRIG Part、Mesh / Skin、clipping splitにも属する場合は二重変形せず`unsupported`で停止する。
- Project serialize / validate、internal Layer削除、Clip copy / paste、structured bake、duration retime、Timeline History capture / restoreへtrackを接続済み。
- KEYは対象internal Layer行だけへ7pxの単色丸で表示する。外周ring / box-shadowはなく、Part / Bone菱形、WARP key、cell clickは変更していない。
- V close前のLayer Motion丸KEYだけは既存Transform transactionから淡色previewを投影し、確定後に濃い単色へ戻す。CAF internal Layer行はClip範囲内をcream grid、範囲外を無地面に分けた。格子なしblank面clickでもFrame seekでき、通常wheelは移動だけ、`Shift+wheel`だけ空きFrameのCAF生成を許可する。
- BrowserでLayer 2だけのF1 / F10位置、Layer 1非干渉、Frame往復、Undo / Redo、computed style、console 0件を確認した。
- 全141 verifier、production build、生成物清掃を通過した。GitHubURLの旧`ClaudeReview` 7件は実在する`Claude_GPT_Review`へ補正済み。

## 4. 次のtask

Phase 9q Gate 1 Task D、Pixi preview proxyとLayer Transform WARP transaction接続。

1. existing WARP Mesh preview adapterを監査し、CPU planと同じbind points / pose points / triangle順 / boundsを消費するactive Raster一枚のleaf表示proxyを固定する。
2. Layer Transform `WARP` tabのANIMATE sessionを`ClipInstance.layerDeformers`へ接続し、preview candidateをProject正本にしない。
3. V closeでTimeline History 1件、Escape / Frame変更 / Table closeでbaseline rollback、no-opでHistory 0を固定する。
4. SOURCEはnormal Raster / Table閉鎖中CAF Rasterの既存confirm-time bakeへ留め、ANIMATE schemaと混ぜない。
5. Task Dではtransaction / previewを優先し、Simple 4x4の最終UI skin、solid marker、Browser受入はTask Eへ残す。

Drawing WARP実装、static RIG、Animation Table / Layer Panel全体再配置は監査と並走しない。

## 5. model分担候補

- SOL / MAX: live code照合、authority / History / save / compositor境界、Gate採否、production実装、全diff監査、Phase close。
- Antigravity2: 境界入力が固まった後のread-only比較、他ツール操作文法・視線誘導・fixture / 実画面レビュー。外部提案をそのまま実装契約にしない。
- LUNA / MAX: 対象file、既存契約、Acceptance Criteria、verifier、停止条件が一つに確定した限定Sliceだけ。
- 同一production fileを複数agentで並走編集しない。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9pまでclose済みです。現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate、Gate 0=`GO — C: Raster Source Bake + CAF Layer Deformer`です。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9q.md、開発用資料保管庫/proposals/Tegaki_Drawing_WARP_Authority_Gate_2026-09-05.md、tegaki_work/TRANSFORM_SESSION_BOUNDARY.md、開発用資料保管庫/Archive/phase9p.md、clip-deformer.js、warp-grid-deformer.js、control-mesh-deformer.js、clip-bake-sampler.js、folder-part-render-plan.js、animation-data-model.js、timeline-frame-compositor.js、animation-table-popup.js、layer-system.js、layer-transform.js、関連verifierを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更を維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。ComfyUIPortable、EasyReforgeExtension、RegionalLoRALabは別Projectなので無視してください。

Phase 9pではCAF全体MotionのtransformKeyframesと、active internal RasterだけのlayerTransformTracksを分離しました。Layer Transformから選択Layer一枚だけへF1 / F10 keyを設定でき、兄弟Layerは動きません。KEYは対象Layer行の単色丸です。Timeline History、Project serialize、delete / copy / bake / retime、RenderIsland、Undo / Redo、Browser、全141 verifier、buildを通過しています。

Gate 0ではnormal Raster / Table閉鎖中CAF Rasterを確定時bake、Table表示中active internal Rasterだけを新規`ClipInstance.layerDeformers`、root / Folderは既存authority維持としました。Layer Transform WARPはSimple 4x4が第一水位、既存WARP WORKSPACEはroot / Folderと将来Advanced用です。initial SliceではRIG / Mesh / Skin / clipping重複を拒否します。

Gate 1 Task A〜Cでは`clip-layer-deformer.js`と3本のverifierを追加し、normalize / validate / target edit / sample / remap / terminal retime / one-Frame bake、ClipInstance / TimelineModel / Project JSON、delete / copy / duplicate、structured bake、duration retime、Timeline History、render plan / CPU compositorを接続しました。順序は`DrawingSnapshot → Layer WARP → Layer Motion → Folder WARP → root WARP → root Motion`です。Folder / Background、RIG Part、Mesh / Skin、internal clippingとの重複はmodel / plan境界で拒否します。全145 verifierとproduction buildを通過し、Pixi previewとpointer UIはまだ変更していません。

Task D前Owner follow-upでは、V close前のLayer Motion丸KEYを淡色preview、確定後を濃い単色へ分けました。CAF internal Layer行はClip範囲内だけcream面＋縦grid、範囲外は無地面です。Lane下の格子なしblank面clickでもFrameを移動でき、Timeline gridの通常wheelは移動だけ、`Shift+wheel`前進時だけ既存Auto Create設定に従ってCAFを生成します。全145 verifier、build、Browser、console 0件を通過しています。

次作業予告はGate 1 Task DのPixi preview proxy / Layer Transform WARP transaction接続です。作業担当はSOL / MAX。CPUと同じsample / topologyを使うleaf Mesh、V close / Escape / Frame変更 / Table close / no-opのsession terminalを固定し、Simple 4x4の最終UIはTask Eへ残してください。Antigravity2はproduction fixtureまたは実画面後のread-only UI比較に限定し、production writeは並走しないでください。
```
