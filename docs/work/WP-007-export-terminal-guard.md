# WP-007 — Export Terminal Guard

状態: DONE — technical guard complete（2026-09-07）。Owner制作操作感とCAF SOURCE / Folder自身のANIMATE V UI受入は未確認。WP-004のHD-005 `MIXED`決定を製品runtimeへ限定実装した。

## Goal

未確定Layer Transform中のExport / Preview / Sequenceを、sessionとmodelを変更せず明示停止する。Selectionの既存auto commitとProject Save terminalは維持する。

## Scope

対象はproductionの`ExportManager`出力入口、実Export toolbar / popup入口、必要な公開Blob/sequence入口、および限定Verifier・Browser診断・docs。対象sessionは通常SOURCE、CAF SOURCE、ANIMATE Layer、ANIMATE Folderのactive Layer Transform。Layer/FolderやSOURCE/ANIMATEの表示名を個別に四重実装せず、既存LayerSystem session stateを読む。

対象外は保存schema、History形式、Transform session正本、Layer Panel、WARP、F-007、RenderPlan、Project Save、Selection terminal、preview one-shot sampling、大規模Popup分割。

## Contract

- `pending-layer-transform`を共通block reasonとする。
- block前後でsession、target、transform/model、History、frame、selection、preview candidateを同一に保つ。confirm / cancel / exitLayerMoveMode / bridge finish / KEY確定 / bake / serialize mutationを行わない。
- Selection Transformは既存`_commitFloatingSelection()`を通り、auto commitとHistory semanticsを維持する。
- Project Saveはactive Layer Transformを確定してserializeする既存契約を維持する。
- UIのExport toolbar/popup開始前にもread-only preflightを通し、Animation Tableを先に隠してsessionをcancelする順序を許さない。
- block後は`変形を確定（V）またはキャンセル（Esc）してから出力してください`を既存toastで一度だけ通知する。

## Tasks

1. ExportManagerの共通preflightで`export`、`generatePreview`、`exportSequencePNG`、公開Blob入口をguardする。
2. UIController / ExportPopupでpopup開始・実行前のpreflightとblock feedbackを接続する。
3. production callerを呼ぶ限定VerifierでSOURCE、CAF SOURCE、ANIMATE Layer、ANIMATE Folderのzero mutation、Selection auto commit、retryを固定する。
4. 実BrowserのCanvas/PNGでconfirm / cancel outputのhash・bbox差、sequence/download境界を確認する。
5. 実UIは隔離fixtureでSOURCE、CAF SOURCE、ANIMATE Layer、ANIMATE Folderを最小確認し、Browser環境情報とOwner受入を分離記録する。

## Acceptance

- SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderのpending ExportがblockしsessionとHistoryを維持する。
- toolbar clickだけでANIMATE sessionをcancelしない。
- V確定後とEscキャンセル後にExportを再試行できる。confirmed / cancelled outputはpixel/hash/bboxで区別できる。
- sequence/download生成へpending stateが迂回しない。
- Selection auto commit、Project Save、unsupported Motion描画前拒否に回帰がない。

## Verification

`verify-export-pending-transform-guard.mjs`、Browser診断`wp007-export-guard-diagnostic.html`、関連harness、構文確認、Vite build、`git diff --check`を実行する。Browser実UIは隔離タブで必要な代表操作だけを行い、viewport / DPR / console errorとOwner制作受入を別に記録する。

## Stop

保存schema・History形式・session authorityの変更、Project Save/Selection terminalの変更、AnimationTablePopup大規模再構成、Layer Panel/WARP/F-007/RenderPlanへの展開が必要になった場合は実装せずArchitecture Lead判断へ返す。

## Progress

### 2026-09-07 — manager/UI guard and production verifier

- `ExportManager`に`pending-layer-transform`の共通read-only preflightを追加し、export / preview / sequence / PNG・APNG・WebP・PSD Blob入口を描画・download前に停止するようにした。
- `UIController`はExport popupを開く前、`ExportPopup`は実行前とcatch時に同じguardを参照し、Animation Tableの先行hide/cancelを許さずtoastを表示する。
- `verify-export-pending-transform-guard.mjs`で4 pending targetのexport / preview / sequence / Blob拒否、zero mutation、Selection auto commit、明示retryをproduction ExportManagerで確認した。
- 既存`verify-output-terminal-audit.mjs`もpassし、F-003のunsupported描画前拒否とWP-004のSave/Export監査証拠を維持した。

### 2026-09-07 — Browser / UI evidence

- Browser Canvas診断はChrome 152、viewport `1280x720`、DPR `2.25`、consoleErrors `[]`でPASS。Selection auto commitはHistory +1。SOURCE / CAF SOURCE / ANIMATE Layer / ANIMATE Folderは`pending-layer-transform`でblockし、session/model unchanged、render/download 0。V確定後とEscキャンセル後のPNG bytes/hash/bboxを区別した。sequence/downloadもrender/download 0でblockした。
- Canvas/PNGの固定証拠は、confirmedが`135 bytes / 0x4e42a905 / nonTransparent 4 / bbox {x:1,y:1,width:5,height:5}`、cancelledが`127 bytes / 0x90b24161 / nonTransparent 2 / bbox {x:5,y:5,width:2,height:1}`。Selection auto commitは`0x90b24161`、History `+1`。
- 隔離実UIでは通常SOURCEのtoolbar blockとV確定/Preview、Escキャンセル/Preview、ANIMATE Layerのtoolbar blockとV確定/Previewを確認した。block時はV/sessionとHistoryを維持し、Animation Tableを先に閉じなかった。通常Folder SOURCEでも同じtoolbar block→V確定→Previewを確認した。
- Folderは隔離UIでFolderと子Rasterを作成し、Animation ContextにFolder targetが表示されることを確認した。Folder自身のANIMATE V開始はこのfixtureの実UIでは開かず、Folder output/zero-mutationはproduction Browser Canvas診断で確認した。CAF SOURCE UIとFolder自身のANIMATE V操作は未受入として残す。

## Completion

技術検証は、上記Verifier・Browser Canvas・限定実UI・近隣回帰・buildが揃った時点でDONE候補とする。Owner制作操作感、既存Projectの実出力、CAF SOURCE / Folder自身の実UI V受入は別途未確認として明記する。

## Completion record — 2026-09-07

WP-007のruntime guard、限定Verifier、Browser Canvas evidence、限定実UI確認、文書・harness更新を完了した。技術状態はDONE。Owner受入は未確認、WP-005は依存によりBLOCKEDのまま。
