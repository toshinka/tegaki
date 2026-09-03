# Tegaki 次チャット引き継ぎ

更新日: 2026-09-01

状態: Phase 9oまでclose。現行Phase 9pはTransform-to-Clip Key Bridge / Interaction Context Gate。Gate 0=`GO — C`、Gate 1=`GO — B: Transform-local indicator`、Gate 2=`GO — B: split owner + synchronous adapter`、Stage B4進行中。

## 1. 最初に読む順序

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本書
5. `task-codex/phase9p.md`
6. `tegaki_work/TRANSFORM_SESSION_BOUNDARY.md`
7. `開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md`
8. `開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md`
9. `開発用資料保管庫/Archive/phase9o.md`
10. `tegaki_work/system/animation/transform-edit-context.js`
11. `tegaki_work/system/animation/clip-transform-key-upsert.js`
12. `tegaki_work/system/animation/clip-transform-layer-gesture.js`
13. `tegaki_work/system/animation/transform-edit-transaction.js`
14. `tegaki_work/system/animation/clip-transform-sampler.js`
15. `tegaki_work/system/animation/animation-data-model.js`
16. `tegaki_work/ui/animation-table-popup.js`
17. `tegaki_work/system/layer-system.js`
18. `tegaki_work/system/layer-transform.js`
19. `tegaki_work/ui/keyboard-handler.js`
20. `tegaki_work/core-engine.js`
21. `tegaki_work/build/phase9p-transform-edit-target-placement-fixture.html`
22. `tegaki_work/build/verify-phase9p-transform-edit-context.mjs`
23. `tegaki_work/build/verify-clip-transform-key-upsert.mjs`
24. `tegaki_work/build/verify-clip-transform-layer-gesture.mjs`
25. `tegaki_work/build/verify-phase9p-transform-edit-transaction.mjs`
26. `tegaki_work/build/verify-phase9p-transform-bridge-production.mjs`

## 2. 作業開始時の確認

```powershell
git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
```

既存差分を維持する。`Backup/`、`PastFiles/`、`開発用資料保管庫/Backup-tegaki_work/`は調査・編集しない。

## 3. 現在地

- Phase 9oはOwnerがD hybridとStage B1〜B4を受入し、2026-09-01にcloseした。Layer TransformのMove / corner Scale / Rotate / side Scale / content-center Anchor / flip / last-touched入力 / capture喪失transaction / exact-pixel previewを固定した。
- Phase 9pの時間変形正本は既存`ClipInstance.transformKeyframes`、Historyは既存Timeline History。第二key schema / Historyは作らない。
- Layer TransformのSOURCEは従来どおりpreview後にRaster sourceをBakeする。ANIMATEだけをStage B3の同期adapterがBake前にClip keyへ分岐する。
- Gate 0比較はA=現行CLIP MOTIONのみ、B=Table OPENを無条件ANIMATE、C=eligible primary Clip / current Frameから明示projection、D=Transform panel Add Key。CをGOとした。A / Dはfallback、Bは現段階NO-GO。
- Stage A1で`projectTransformEditContext()`を追加した。Table閉=`SOURCE`。Table開かつ一つのClip、duration > 1、範囲内Frame、停止中なら`ANIMATE READY / KEYED`。再生中、未選択、複数選択、duration 1、範囲外は`BLOCKED`。
- `AnimationTablePopup.getTransformEditContext()`は既存`selectedCelId / selectedCelIds / playback.currentFrame / isVisible / isPlaying`をprojectionへ渡すread-only API。
- ContextはProject / localStorage / Historyへ保存しない。Clip / key / working Layer / EventBusを変更しない。
- `animate-ready`への入場だけではkeyを作らない。最初の実gestureだけが固定baselineからpreview keyを作る。
- Stage A2はTop Bar / Transform-local / Dual / Canvasを比較し、B Transform-localを選定した。Stage B3で実transactionと同時に`SOURCE · 原画 / ANIMATE · F# READY|KEYED`をproduction接続した。
- Stage B0で現CLIP MOTIONのfull composite key upsertをpure plannerへ抽出した。同一Frame末尾keyのhold / easing継承、full key shape、入力不変を将来Bridgeと共有する。baseline keyは作らない。
- Stage B1でLayer Transform開始→現在のx / y / rotation加算差分と符号付きscale比率だけをsampled Clip transformへ合成するpure plannerを追加した。source Layerの絶対値やRasterはkeyへ混ぜず、Anchor edit / context不一致は理由付き拒否する。
- 任意matrix分解は、非等方scale＋回転でClip schemaにないshearを生み得るため採用しない。Anchorはstatic / global authoring候補として後続へ送る。
- Stage B2 Gate 2=`GO — B: split owner + synchronous adapter`。LayerSystemはinput / SOURCE、AnimationTablePopupはANIMATE preview / Timeline rollback / Historyを所有する。Raster Bake後の`layer:transform-exit`へANIMATEを後付けしない。
- ANIMATE開始時のsampled Clip transform / keyframes / duration / Clip・Frame identityをclone固定し、各previewは同じbaselineからB1→B0を再計算する。READY→KEYEDは許可し、Clip / Frame / authority変更はretargetせずrollbackする。
- V confirmは変更ありでTimeline History 1、Escape /開始位置復帰はrollbackでHistory 0。handle pointercancelはhandle gestureだけを戻してV sessionは維持する。
- Stage B3はPopup初期化後にoptional adapterをLayerSystemへ注入し、選択Clipのworking Raster群をroot Clip表示proxyとして扱う。SOURCEのRaster / CAF source Historyは変更しない。
- ANIMATEのMove / corner・one-axis Scale / Rotate / flip、V確定1 History、Escape、Frame変更、Table close、Undo / RedoをBrowserで確認した。rollbackは対象Clip keyだけを戻すため、新しく選んだFrameを巻き戻さない。ANIMATE Anchorはstatic Clip authorityを維持してdisabled。
- Stage B4の最初に、選択中のCAF内部Layer行へ既存Clip Motion keyを同一Frameの丸として読み取り専用投影した。親CAF帯と同じ`ClipInstance.transformKeyframes`のechoで、Layer固有key / click action / schema / Historyは増やしていない。F2作成、Undoで消失、Redoで復帰、console 0件をBrowser確認した。
- 全137 verifier、production build、Browser fixture / production、console 0件、生成物清掃を通過した。

## 4. 次のtask

Phase 9p Stage B4のproduction hardening / close Gate。

1. 既存explicit key更新、READY no-op、開始位置復帰を固定する。
2. 複数Clip選択、playback、duration 1、範囲外をBLOCKEDのままmutation 0で確認する。
3. normal Layer / CAF SOURCEのMove / Scale / Rotate / flip、confirm / Escape / Historyを退行監査する。
4. Clip keyのProject save / reloadとcompositor / Timeline marker一致を確認する。
5. 全Gate通過後にPhase 9p close可否を判定し、外部Web AIが`GitHubURL.txt`から導線を精査できる状態へ整える。
6. 次Phase候補はLayer Transform内のDrawing WARP。static RIG parent relationはその後に分離する。

Auto Key、baseline永続化、Drawing WARP、static RIG ownership、閉じる／決定button、virtual grid / Motion Pathは開始しない。

## 5. model分担

- Gate判断、History / CAF / save境界、Phase closeはSOL / MAX。
- pure projection / fixtureの契約が確定した一つの限定SliceだけLUNA / MAX候補。
- 現Stageは小さく、並走しない。

## 6. 新チャットへ貼る文面

```text
D:\GitHub\tegaki の作業を継続してください。

Phase 9oまでclose済みです。現行Phase 9pはTransform-to-Clip Key Bridge / Interaction Context Gate、Gate 0=`GO — C`、Gate 1=`GO — B: Transform-local indicator`、Gate 2=`GO — B: split owner + synchronous adapter`、Stage B4進行中です。

最初にAGENTS.md、TEGAKI.md、tegaki_work/PROGRESS.md、tegaki_work/NEXT_CHAT_HANDOFF.md、task-codex/phase9p.md、tegaki_work/TRANSFORM_SESSION_BOUNDARY.md、開発用資料保管庫/proposals/Tegaki_Transform_Centric_Flow_Purification_Addendum_2026-09-01.md、開発用資料保管庫/proposals/Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md、開発用資料保管庫/Archive/phase9o.md、system/animation/transform-edit-context.js、system/animation/clip-transform-key-upsert.js、system/animation/clip-transform-layer-gesture.js、system/animation/transform-edit-transaction.js、system/animation/clip-transform-sampler.js、system/animation/animation-data-model.js、ui/animation-table-popup.js、system/layer-system.js、system/layer-transform.js、ui/keyboard-handler.js、core-engine.js、build/phase9p-transform-edit-target-placement-fixture.html、build/verify-phase9p-transform-edit-context.mjs、build/verify-clip-transform-key-upsert.mjs、build/verify-clip-transform-layer-gesture.mjs、build/verify-phase9p-transform-edit-transaction.mjs、build/verify-phase9p-transform-bridge-production.mjsを順に読んでください。

git status --short --untracked-files=all -- tegaki_work task-codex 開発用資料保管庫/proposals 開発用資料保管庫/Archive
を最初に確認し、既存変更を維持してください。Backup/、PastFiles/、開発用資料保管庫/Backup-tegaki_work/は調査・編集しないでください。

Stage A1はTable / primary Clip / current FrameからSOURCE / ANIMATE READY / ANIMATE KEYED / BLOCKEDを保存しないpure projectionにしました。Stage A2はB Transform-local表示、Stage B0はshared Clip key upsert、B1はLayer gesture delta、B2はsplit owner transactionを固定しました。Stage B3でoptional同期adapterをproduction接続し、ANIMATEだけをRaster Bake前に既存ClipInstance.transformKeyframes / Timeline Historyへ分岐しました。入場だけではkeyを作らず、Move / Scale / Rotate / flip、確定、Escape、Frame変更、Table close、Undo / Redoを通過しています。Stage B4の最初に、選択CAF内部Layer行へ既存Clip Motion keyを読み取り専用の丸で同一Frame投影しました。

次作業予告はStage B4の既存key更新 / no-op / BLOCKED監査です。作業担当はSOL / MAXです。その後にnormal Layer / CAF SOURCE、Project save / reloadを順に固定し、Phase close可否と次PhaseのDrawing WARP入口を選定してください。Drawing WARP実装、static RIG、global Auto Key、baseline永続化はこのStageへ並走しないでください。
```
