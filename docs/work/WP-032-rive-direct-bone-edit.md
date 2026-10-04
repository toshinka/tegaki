# WP-032 — 新RIGの骨を画面上で直接編集

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerの「操作できるまとまりまで実装続行、レビューは後段」に基づく。main/871c51ed、WP030漫画/文字と既存dirtyを保持。native編集/独立保存再build/透明PNG、通常Raster追加/UndoRedoを司令実測。一般RasterのProject往復HOLDはOwner続行に基づく[WP033](WP-033-raster-project-alpha-roundtrip.md)の限定保存修正で解消し、同じ56°/progress1のRaster/Export画素差0を[追加監査](../ai/WP-033-raster-project-alpha-audit.md)で確認した。以前のHOLDとnative範囲は[先行監査](../ai/WP-032-rive-bone-audit.md)に保持。

READ: AGENTS → STATUS → TECHNICAL → 本Card → DEVELOPMENT「漫画文字とRIG proofの並行導線」。対象file headers、WP031 Completion。全旧RIG・他engineの調査を再開しない。

## Goal

一枚のPNGと既存Root/End二本の骨という現行モデルで、画面上のEnd骨をつかんで角度を変えられる。ドラッグ中の画像変形は公式runtimeの骨プロパティで即時表示し、指を離すと既存公式CLI経路で一度だけsourceを更新する。数値入力/スクラブ/保存/Raster受渡しを保持する。直接編集を独立moduleにし、AIが選択対象・編集中・角度・確定状態を読める。

## Scope

既存LUNA `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2` WRITE:

- `tegaki_work/advanced/rive-editor/bone-editor.js` NEW: 独立pointer/keyboard gesture controller、表示用overlay、取消/破棄。
- `tegaki_work/advanced/rive-editor/bone-projection.mjs` NEW: nativeからコピーした座標・行列の表示投影/逆投影、角度制約。画像変形を実装しない。
- `tegaki_work/advanced/rive-editor/runtime.js`: native End.rotationの一時previewと、同じ描画alignmentによる骨の表示座標取得。既存load/seek/resource lifetimeを保持し、小さなmethod追加/共通draw抽出に限る。
- `tegaki_work/advanced/rive-editor/editor.js`: gesture→native preview→既存compileAngleの限定接続、snapshot、ready/frame guard。既存serverAPIは変更しない。
- `tegaki_work/advanced/rive-editor/editor.html`: editor内だけの骨overlay、短い日本語導線、独立scoped style、data-testid/ARIA。共通CSSを触らない。
- `tegaki_work/advanced/rive-editor/server.mjs`: 司令監査追補に限り、固定static配信表に `/bone-editor.js` と `/bone-projection.mjs` の二件を追加する。API/保存/CLI/health/security/任意path配信は変更しない。module読込を成立させる薄い登録のみ。
- `tegaki_work/build/verify-rive-bone-editor.mjs` NEW: 投影・逆投影、gesture cancel/commit数、未確定frame拒否等の意味のある限定検証。
- `tegaki_work/build/wp032-rive-bone-browser.html` NEW: 実runtime/CLIへの操作を公開buttonと可視結果で検証するfixture。隠れた自作変形やsyntheticをtrusted操作証拠にしない。
- `docs/ai/WP-032-rive-bone-editor-result.md`、cache `.cache/rive-editor/` のみ。

司令WRITE: 本Card、STATUS RIG節、manifest/登録/案内、必要なhost verifier追補、`docs/ai/WP-032-rive-bone-audit.md`。workerは司令filesを変更しない。worker filesに司令が並列writeしない。

LUNAは一人で作業せず、漫画/字体leadも同checkoutを変更中。他者差分を巻き戻さず合わせる。font/文字/balloon/keyboard共通/CSS共通/Layer/Project/History/Export/Pixi/core/index/Vite/package/lock/model.mjs/dev-companion/HTTP bridgeは今回writeしない。server.mjsは上記static登録二件だけ例外であり、共通製品や保存仕様の拡張ではない。

## Contract

- 固定CLI1.3.0/runtime2.44.0とWP031で実測したhashを継承。SDK/cacheの第二版、SDK本体patch、install/network無し。`artboard.bone('End')`、`Bone.rotation/length`、`worldTransform()`、`rive.computeAlignment()`が固定local SDKの実在API。型定義は `.cache/rive-authoring-proof/runtime-2.44.0/package/rive_advanced.mjs.d.ts`。実行できなければ明示HOLDし、自作mesh変形へ代替しない。
- 対象は既存Endの終点角だけ。rest30°/end -90..90°、PNG実寸・4vertex/2triangle/既存weights/source templateを維持。骨追加・root移動・mesh編集・IK・物理・多素材・Timelineは後段。
- overlayのpivot/tipはnative bone行列/lengthと同じnative描画alignmentから投影する。pointerはCSS表示寸法とnative1x座標を逆投影する。手書き画像頂点やrendererによる見かけの変形を作らない。native行列はコピーして扱い、所有/借用を確認し借用native objectをdeleteしない。
- ドラッグ開始時に現在progress/角度/dirty/良好native状態を捕捉し、EndPoseの終点progress1を編集する。native End.rotationに候補角を設定→artboard.advance(0)→既存描画、pointermoveでCLI/saveを呼ばない。候補は有限かつ-90..90°に制限。画面位置が変わっても骨とハンドルが一致する。
- 編集中は既存protocolで `status:'building'`、reason `bone-edit-preview` 等を送信し、hostのframeボタンとnative frame/PNG/save/他operationを拒否する。sourceHash/buildId/確定angleを一時候補へ偽更新しない。native snapshotに `selectedBone:'End'`、`editPhase`、`previewAngle` を投影できるが、これは診断で保存正本ではない。
- pointerupで既存 `/api/compile` を一回だけ使用し、成功後fresh native runtimeをprogress1へseekしてreadyへ。指を離しても保存は明示Saveのみ。source/imageが編集正本、rivは派生、previewだけをsave/receiptしない。失敗時は良好source/runtime/元poseを保持し、失敗理由を表示。重複pointerup/操作は二重compileしない。
- Escape/pointercancel/lostpointercapture/blur/teardownでpreviewを撤回し、元progress/確定angle/dirty/native描画を復元、compile/save/History0。captureを解除し、遅れて返る応答が取消後の状態を復活させない。取り扱えないnative状態は操作を無効にして理由を示す。
- Endハンドルはpointerとkeyboardで操作できる。矢印1°/Shift5°でnative候補preview、Enterで一回compile、Escape/フォーカス離脱で取消。ARIA nameと現在角、最小24pxのhit area、`data-testid=rive-bone-end`。全体shortcutを変更しない。ドラッグ中の補助線/ハンドルはPNG/nativeframeへ混入しない。
- 操作の説明は「骨を動かす → 保存 → 現在フレームを追加」の短い順序。SDK/nonce/内部実装を主操作面へ増やさない。AI snapshot/detailsと安定testidは保持。PNG範囲外は現行artboardでclipする方針を表示し、canvas寸法やschemaを独自変更しない。
- model/gesture/projection/runtime/hostの責務を分け、巨大互換層/旧RIG移行は作らない。frame受渡しは既存通常Raster一件/History一件で保持。

## Tasks

対象の重複責務/event/testidをrgしてから追加。既存CLI/native経路の一件だけを拡張し、gesture/表示投影/runtimeの責務を分ける。

## Acceptance

数値指定と直接編集で同角度のnative描画が一致し、終点編集→保存→session破棄→source再build→新instanceでも再現する。取消と破損で良好sceneを維持。技術BrowserとOwner制作受入を分ける。

## Verification

構文、関連rig-editor verifier、harness check、diff、製品build。固定SDK/hashと実CLIログ/行数を報告。専用editor18729と必要な独立product18832、own processだけ停止。司令監査前に全own processを止め、reuseしたserverは停止しない。

実Browser: fixture PNG300x180または別実寸を使用し、native開始/直接角変更/数値同角一致、取消/一回compile、補助線非混入、保存→破棄→再読込、透明native1xPNG、通常Raster/UndoRedo/Projectを一経路で確認。CSS縮小時の投影と狭い画面の到達性を確認。fixtureによるsynthetic eventはstatic証拠、trusted mouse/touch/penは別にする。測れない箇所はUNVERIFIED。未確定preview receiptをnative proof PASSにしない。

## Stop

SDK/CLI/evaluator修復、第二version/backend/platform、system install/PATH、login/cloud/publish/CLI再配布、新保存正本/production schema/History/renderer/SOURCE変更、旧RIG移行、他project/他者process停止、commit/push禁止。native API不足なら具体的根拠と残る接続量をHOLDとして返し、無制限探索しない。

## Completion

狭幅実測追補: 360×640でeditor-gridの1frが診断hash等のmin-content幅に引かれ、native canvas表示幅399.6pxと横scrollを確認。editor-local CSSのminmax(0,1fr)/grid子min-width:0/診断長文字折返しだけで横幅を収める。投影座標やnative原寸は変更しない。SVG overlayはrole=groupで子End sliderをAXへ公開する。診断pointerdownはhandle focusを保持し、通常focusout取消に例外を作らない。

司令実測追補: Browser toolのread-only DOMはcanvas.getContextを公開しないため、editor-localの状態detailsへ「native画素を記録」buttonとread-only診断preを追加してよい（editor.js/editor.html、既存LUNA所有）。実表示canvasのgetImageDataからRGBA SHA256、width/height、透明pixel数、現在angle/progress/editPhase/previewAngle/sourceHashを記録する。preview中も測定可能だがCLI/save/frame/Historyを呼ばずsceneを書き換えない。診断は保存正本ではなく画素比較証拠。ボタンはtrusted操作、表示結果を司令がDOMで読む。通常native frameの補助線非混入を確認するためoverlay canvas合成をしない。

司令Browser監査追補（14:10 UTC）: SVGElementのhidden property代入では初期hidden属性が解除されず、補助線は描かれるのにAX treeからEndハンドルが欠落する実差を確認。bone-editor.jsのoverlay表示切替を属性の明示追加/削除へ修正し、editor.htmlのeditor-local CSSでhidden時display:noneを保証する。ready時のhidden属性解除とARIA slider可視を司令が実Browserで確認する。既存LUNAはsource/限定verifier/reportだけを更新し、司令が所有して監査中の18729/18832へprocess/API/Browser mutationを行わない。

VERIFIED。[担当結果](../ai/WP-032-rive-bone-editor-result.md)を[先行監査](../ai/WP-032-rive-bone-audit.md)でsource/固定hash/CLI/native画素/実Browser/実Projectまで限定監査した。直接preview56°→公式CLI→明示保存→tab破棄→保存source再build→新instance→数値同角度がRGBA SHA256一致。取消/破損PNG維持、透明native1xPNG、AX slider/状態診断、360px横scroll修正も実測。通常Raster一件/History一件/元絵不変/UndoRedoはPASS。当初56°/progress1のProject再読込で1,018 pixels差を再現し、このCardの共通保存STOPでHOLDした。Owner続行後の別契約[WP033](WP-033-raster-project-alpha-roundtrip.md)で保存PNG採取だけを修正し、同じ開始hashのRaster/Export差0を[追加監査](../ai/WP-033-raster-project-alpha-audit.md)で実測した。監視はPAUSED。Ownerレビューを急がせず、採用/最終受入/pushは自己承認しない。未測定は監査へ分離し、次の多部品/mesh等のSliceは自動実行しない。

司令監査追補（2026-10-04）: 最初の実装でserver配信表の制約を迂回するinline controller/projectionが入り、実Browserは独立module verifierと別の経路を使用していた。static配信二件を上記例外として追加し、editor/runtimeを独立moduleの直接importへ統一する。fallback/重複実装は除去する。開始native終点progress1と、確定compile/新instance表示progress1を保持する（取消は捕捉元progressへ）。lostpointercaptureで実際にcaptureを失ったgesture、handleからのkeyboardフォーカス離脱、window blur/teardownを取消する。pointerup自分でreleaseしたイベントは確定を取消しない。computeAlignmentで作る所有Mat2Dとboneから借用する行列を区別し、所有allocationをコピー後解放する。取消済みcompile応答のstale guardと実frame拒否も、実際に配信するmodule経路で限定検証する。担当初報の32pure PASS/Browser操作はこの追補の実native画素一致・製品接続のPASSに広げない。
