# Tegaki 次チャット引き継ぎ

更新日: 2026-09-05

状態: Phase 9pまでclose。現行Phase 9qはDrawing WARP Authority / Layer Transform Integration Gate、Gate 0=`GO — C: Raster Source Bake + CAF Layer Deformer`。Gate 1 Task A〜DとTask D前Owner Timeline follow-up完了、次はTask E。

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
14. `tegaki_work/system/animation/layer-warp-edit-transaction.js`
15. `tegaki_work/system/animation/folder-part-render-plan.js`
16. `tegaki_work/system/animation/timeline-frame-compositor.js`
17. `tegaki_work/system/animation/animation-data-model.js`
18. `tegaki_work/ui/animation-table-popup.js`
19. `tegaki_work/system/layer-system.js`
20. `tegaki_work/system/layer-transform.js`
21. `tegaki_work/build/verify-layer-warp-edit-transaction.mjs`
22. `tegaki_work/build/verify-layer-warp-preview-production.mjs`
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
- V close前のLayer Motion丸KEYだけは既存Transform transactionから淡色previewを投影し、確定後に濃い単色へ戻す。CAF internal Layer行はClip範囲内をcream grid、範囲外をBackground無地面に分け、選択薄茶も範囲内だけに限定した。格子なしblank面clickでもFrame seekでき、通常wheelは移動だけ、`Shift+wheel`だけ空きFrameのCAF生成を許可する。
- Pixi CAF previewは個別RasterでLayer WARPをRenderTexture Mesh bakeしてからLayer Motion matrixを適用する。Folder WARP内でも同じchild planと変形後boundsを使い、CPUと同じ順序を維持する。
- Simple 4x4 transactionは入場だけでは保存keyを作らず、最初のpoint変更だけをcurrent Frame候補として`layerDeformers`へpreviewする。confirmはTimeline History 1件、cancel / no-op / Frame変更 / Table closeはbaseline rollback・History 0件。非4x4 deformerはAdvancedへ送るため暗黙変換しない。
- 全147 verifier、production build、BrowserのAnimation Table展開、console 0件を確認した。Task EまでWARP tabは無効のままで、Task DはDOM / pointer UIを追加していない。

## 4. 次のtask

Phase 9q Gate 1 Task E、Layer Transform Simple 4x4 UI / solid marker / terminal実操作接続。

1. Layer Transform `WARP` tabを有効化し、active Raster描画範囲へauto-fitした16点Simple 4x4 overlayをCanvasへ出す。pen hit area、線と点のFutaba palette、BASICとの差を既存overlay grammarへ合わせる。
2. pointer gestureはTask D transactionへ接続し、pointerupはgestureだけ終了、pointercancel / capture喪失はgesture開始値へ戻してsession継続とする。
3. V close / Escape / Frame変更 / Table close / save terminalを実操作で確認し、SOURCE Raster bakeとANIMATE `layerDeformers`を混ぜない。変更後のBASIC / WARP暗黙切替は止める。
4. internal Layer行の同一FrameにLayer MotionまたはLayer WARPがあれば単色丸を一つだけ出す。両方あっても蛇の目や重複markerにしない。未確定WARP markerは既存preview色規則へ合わせる。
5. Browserで通常Raster SOURCE、Table閉鎖中CAF SOURCE、Table表示中CAF ANIMATE、Undo / Redo、save / reopen、console、生成物清掃まで確認する。

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

Gate 1 Task A〜Dでは`clip-layer-deformer.js`、`layer-warp-edit-transaction.js`と関連verifierを追加し、normalize / validate / target edit / sample / remap / terminal retime / one-Frame bake、ClipInstance / TimelineModel / Project JSON、delete / copy / duplicate、structured bake、duration retime、Timeline History、CPU / Pixi previewを接続しました。順序は`DrawingSnapshot → Layer WARP → Layer Motion → Folder WARP → root WARP → root Motion`です。Folder / Background、RIG Part、Mesh / Skin、internal clippingとの重複はmodel / plan境界で拒否し、既存非4x4 deformerもSimple UIへ暗黙変換しません。

Task D前Owner follow-upでは、V close前のLayer Motion丸KEYを淡色preview、確定後を濃い単色へ分けました。CAF internal Layer行はClip範囲内だけcream面＋縦grid（選択薄茶は内側だけ）、範囲外はBackground無地面です。Lane下の格子なしblank面clickでもFrameを移動でき、Timeline gridの通常wheelは移動だけ、`Shift+wheel`前進時だけ既存Auto Create設定に従ってCAFを生成します。全145 verifier、build、Browser、console 0件を通過しています。

Task Dでは個別RasterのPixi leaf Mesh preview、Folder WARP内child plan / bounds、入場時History 0・実変更preview・confirm 1件・rollback 0件のLayer WARP transactionを接続しました。全147 verifier、production build、BrowserのAnimation Table展開、console 0件を通過しています。WARP tabはまだ無効で、DOM / pointerはTask Eです。

次作業予告はGate 1 Task EのLayer Transform Simple 4x4 UI / solid Timeline marker / terminal実操作接続です。作業担当はSOL / MAX。Task DのtransactionとPixi previewを使い、SOURCE / ANIMATEを同じ見た目から正しいauthorityへrouteしてください。Antigravity2はproduction fixtureまたは実画面後のread-only UI比較に限定し、production writeは並走しないでください。
```
