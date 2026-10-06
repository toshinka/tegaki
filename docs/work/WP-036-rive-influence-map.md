# WP-036 — 新RIG 素材上の点選択と追従の可視化

状態: VERIFIED / TECHNICAL COMPLETE / OWNER ACCEPTANCE PENDING。Ownerの2026-10-05「特に無ければロングランの制作を続けてください」に基づく限定Slice。現在地/担当/turn/cursorはSTATUSのみが所有する。最終制作受入/採用/pushはOwner。

## Goal

既存quad/grid3の数値欄で編集する点を、PNGの変形前の位置とRoot/End追従率から選べるようにする。点選択→対応数値欄→既存Apply/Discardという動線を明確化し、AIが選択・draft・不正入力を読み取れるようにする。これは固定素材上の案内図であり、変形後頂点を独自計算しない。native preview/出力は既存公式runtimeだけを使う。

READ: AGENTS→STATUS→TECHNICAL→本Card→DEVELOPMENT「漫画文字とRIG proofの並行導線」→ARCHITECTURE「データの所有」→対象header。前件WP035の監査全文をpreloadしない。profile/order/UVと原画像URLは現行mesh-profile/editor/serverが根拠。

## Scope

開始main/4760db9c16f2af50345916381d45559cec7b1733、liveで再照合。既存漫画/文字/WP034/035/司令dirtyを保持。他者がいるcheckoutであり差分を巻き戻さず調整する。新chat/agent無し、既存TEGAKI｜実装 LUNA thread01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2/localだけへ割当。

LUNA exact WRITE:

- `tegaki_work/advanced/rive-editor/influence-map.js` NEW: fixed UV/profileを使う素材案内図controller、SVG pointと選択・比率表示、dispose/stale image処理。
- `tegaki_work/advanced/rive-editor/weight-editor.js`: 選択専用public method/派生view取得、選択の持続/有効性、既存draft/raw/Applyは維持。
- `tegaki_work/advanced/rive-editor/editor.js`: 上記controllerの薄い接続・image/profile/confirmed/draft/selected同期、snapshotのruntime-only派生可視性、dispose。
- `tegaki_work/advanced/rive-editor/editor.html`: local styleと素材案内図、比率凡例/選択点情報/選択欄強調、既存native面と分離。
- `tegaki_work/advanced/rive-editor/server.mjs`: 固定static表 `/influence-map.js` 一件追加だけ。API/CLI/health/security/savedの変更なし。
- `tegaki_work/build/verify-rive-influence-map.mjs` NEW: 実controller/weight-controllerの境界、focus/raw/選択副作用/破棄/配列順の限定検証。
- `tegaki_work/build/wp036-rive-influence-browser.html` NEW: 実modules/実native runtimeを使う可視fixture。既存WP035のfixture/証拠はwriteしない。
- `docs/ai/WP-036-rive-influence-result.md` NEW、cache `tegaki_work/.cache/rive-editor/wp036/` のみ。

司令WRITE: 本Card/STATUS RIG/DEVELOPMENT対象節/登録/harness/work索引/GITHUB案内/司令audit/cache、限定実UI/既存host監査。同file並列writeなし。runtime/model/mesh-profile/weight-model/bone/playback/bridge/dev-companion、漫画/font/共通keyboard/CSS/Layer/Project/History/Export/Pixi/core/index/Vite/package/lockは双方read-only。

## Contract

1. 既存native previewは変更しない。独立した小さい素材案内図に既存snapshotの原PNGを表示し、その上に固定UVの4/9点を置く。「素材上の点（変形前）」を常時明記。画像比率維持、SVG viewBoxを原画像寸法へ合わせる。変形後の点位置/heatmap補間/独自skinning evaluatorを作らない。
2. 固定点name/indexはmesh-profileの正本から導出し、grid UIの3×3順とsource outline順の違いを保持する。クリック・button Enter/Space・既存数値欄focusは同じ点選択へ。選択後対応inputへfocusできるが値は書き換えない。数値欄の不正raw/空欄も保持し、選択だけでdraft/compile/API/save/History/native pose変更0。既存再生を選択だけで停止しない。
3. 初回/profile変更で無効になった選択はTopLeftへ、共通点があれば保持。load/Discard/Apply後も有効な選択を保持し、選択はruntime-only。busy/pending/teardown時は選択を無効化、listenerを解除。UI focus循環/二重callbackを防ぐ。
4. 点を選択状態の橙枠、非選択をmaroon系で区別。比率はEnd橙・Root maroonの二分表示＋数値/凡例で色だけに依存しない。点名の日本語位置と内部nameが読める。draftは「未適用」を明記、不正欄は「未確定」で古い値を候補値として表示しない。native previewは適用前確定状態のままと説明する。中央回転中心の既存注記を維持。
5. WeightEditorControllerからprofile/confirmed/draft/raw/valid/selectedの派生viewを一経路で読ませる。別の保存正本/別draftを作らない。snapshotはselectedVertex/selectionSpace=source-uv/selectionProfile/selectedEndPercent/selectedWeightValid/weightDraftActiveなど必要なruntime-only派生を追加可能。確定とdraftを明記し、nonce/native object/画像base64を診断へ出さない。testidは点name別で安定。
6. Source/image/load変更時は最後の良好sceneとnative状態を保持。案内画像はsnapshot.imageUrl相当の既存URLを使い、世代token/buildIdで古いload/errorを捨てる。loading/errorは明示し、不一致の点図を操作させない。同sourceのseek/playbackでは画像再fetch/DOM全再作成なし。PNG/Frameはnative canvasのみ採取し案内図を混ぜない。
7. 360pxの閉じた診断で案内図/点ボタン/数値欄/Apply/Discardが横overflowを増やさない。既存全ページoverflow修復や共通CSS再設計を混ぜない。指/液タブの実機受入は未測定を明記。

## Tasks

実model/controllerを先に実装→薄いeditor接続→限定verifier/可視fixture→syntax/関連検証/build→結果report。workerは稼働18729 PID34004とOwner5174 PID14348を停止・再起動・API mutationしない。専用18838/別wp036 cacheのactual editor runnerだけ使用可。runnerではport/cache/HERE/importの解決だけを分離し、製品API/runtime/authoring実装を代替しない。worker own processをidentity/receipt/health/listener照合後既存正常終了経路でcleanup、未知/reuse/他者processを止めない。副作用計測にsource/buildId/saved/CLI logを前後比較、秘密nonceは報告に載せない。Browserツール不能ならstatic/native/実UIを分けて返す。

## Acceptance

- quad/gridの全点位置/name/source index、異方画像300×180とCSS縮小、画像切替/stale/破棄を検証。入力5は5のまま、空欄→別点選択/入力でも空欄保持、focus/選択でdraft0、Apply不正はcallback0。
- 実UIで案内図点click/Enter/Space↔input focus→raw保持→draft比率表示→Discard/Apply、profile9→4無効選択復元、再読込時の案内同期を確認。未適用状態のframe/save拒否は既存経路を維持。
- native RGBA/透明1xPNGは案内表示・選択前後同値。適用による変化は公式CLI/nativeだけ、元source/savedの扱いを保全。Play/seekで案内原画像は静止・再fetch0、選択のみnative poseを変えない。
- 司令はsourceと証拠を監査後、実editorのtrust操作/診断・native同画素・既存host frame追加が成立する一経路へ限定確認。WP035の全A/Project試験は反復しない。通常入口更新が必要なら未保存/saved退避、live source変更照合、owned identity、正常終了/通常bridge復帰/未保存復元を行う。外部変更や識別不足なら停止せず具体的HOLD。

## Verification

`node --check` 対象JS、`node tegaki_work/build/verify-rive-influence-map.mjs`、既存grid/weights/playback関連verifier、`npm.cmd run build`（cwd tegaki_work）、harness check、diff check。並行漫画anchor不一致は他lead対象として分離。実UI/native/Ownerの証拠は上記Acceptanceの階層で分ける。

## Stop

SDK/CLI/runtime/evaluator本体patch、第二version/platform/backend、system install/PATH/login/cloud/publish/CLI再配布、production保存/History/renderer/SOURCE authority、旧RIG移行、自由頂点/骨追加/多PNG/IK/物理/Timeline、新shortcut/共通CSS、他project/他者process停止、commit/push禁止。未確定の後続機能を混ぜない。技術完了とOwner制作受入を区別する。

## Completion

限定技術目標を司令監査済み。[司令証拠](../ai/WP-036-rive-influence-audit.md)にactual editorの点選択/raw/診断/確定状態説明・native画素不変、未保存保全更新、通常Raster/History一件と実Project画素差0を記録。46 checks、修正後syntax/関連回帰/build、文書check成功。画像error/stale/disposeは実controller回帰、画像再fetch0はcontrollerとsource/実URL維持の証拠でありBrowser network実測ではない。液タブ/性能/全embedded編集操作/制作受入は未。既存quadの狭い数値欄は後述の別候補として分離し、全UI可読性のPASSへ広げない。未確定の後続Cardは実装しない。

## Commander audit correction — 2026-10-05

初報27 checks/関連回帰/build報告の後、司令が独立18838のactual editor/nativeで点click/Enter/Space/inputとrawを検証。選択前後native RGBA/透明画素一致、source/buildId/dirty不変、raw5と空欄保持は成立。一方、以下の確定Card内不足を修正してからcloseする。exact WRITE/STOPは上記のまま、司令cache commander-*と既存liveはread-only。

1. **AI snapshotの派生情報を現在viewへ同期**。実UIでTopRight100→input5の直後、weightDraftはEnd13/percent5.1なのにtop-level selectedEndPercent100/weightDraftActivefalseを観測。quad→grid3 draftもselectionProfilequad/activefalse/選択TopLeftなのにpercent100へ残る。spreadした旧snapshotの派生fieldを新しいselection viewより優先しない。draft開始/input/invalid/profile/Discard/Apply/load/sceneにおける現在profile/valid/percent/active/選択の一致を単一派生viewから保証し、nativeのconfirmed meshProfileとselectionProfileは明確に分離。明示null不正percentも保持。エディタ実snapshotを通す回帰でfirst input/profile transitionを検証し、単なるstring includes検査を証拠にしない。
2. **profile再作成時の点listenerを解除**。_renderProfileがpoints.clear/replaceChildrenする一方、旧SVG groupのclick/keydownが汎用listenersへ蓄積してdisposeまで保持される。point listenerを別所有して再作成前にremove、全disposeでも解除。quad/grid反復でdetached group/listener所有数が増えず、旧点はcallback0、新点は一回を実controllerで検証。同profile/seek/playでは点DOMを作り直さない。
3. **素材案内図の表記・点の境界を整える**。契約の「素材上の点（変形前）」を見える日本語見出しへ。source UVは診断へ置き、利用者の主説明は変形前の素材を指す。実案内図幅228pxに対し左右のSVG textが図の外へはみ出す（左端706px対図739px、右1000px対図967px）、文字は8〜9.8px。点の位置は固定UVを保持し、SVG内は点/短い位置案内へ限定、フルname/比率は既存ボタンと選択欄へ集約する等で図の外にラベルが飛び出さない形にする。点のedge clippingを表示専用margin/viewBox等で避けても元UV座標/原画像比率は変えない。360px/縮小でも各点の押下と説明を確認する。profileの既存数値入力やcommon CSSを改造しない。

修正後は限定verifier/構文/必要関連回帰/buildを実行しreportへ追記。native/shared live/保存正本を変更せず、Browser未測定はそのまま分離。司令は修正後に同actual editor経路を再監査する。

### Follow-up: confirmed status text

修正後のactual editor監査でAI snapshotの同期、raw5/空欄、profile/Apply、実SVG click中のnative再生継続と選択前後RGBA一致は成立。一件だけ表示状態の不足を確認: `sync()` の画像ready/weightDraftActive=false側がstatusを更新せず、grid Apply後も見える説明が「未適用draftの追従率を表示中です」と残る。Discard後も同じ旧表示を残し得る。influence-mapの現在viewから、確定時は確定追従率、draft時は未適用、不正raw時は未確定を正しく表示する。画像loading/errorの状態を正しく維持し、seek/play/選択だけで同じ確定説明が誤ってdraftへ戻らないようにする。actual controllerのdraft→confirmed/Discard/profile Applyにおけるvisible status回帰を追加。exact WRITEとSTOPは変えず、既存liveへのmutationは行わない。

### Next narrow candidate — not assigned

editor-local数値欄の可読性を一件に絞る。既存quadでは幅228pxのcontrols内で数値inputが約15.78pxへ縮み、値が読みにくい。HEADにもある二列weight-rowのauto幅outputが原因候補で、今回の素材図とは別責務。次Cardの案はeditor.htmlのlocal weight-row配置だけで、入力幅を確保しEnd/Root説明を折り返す。四隅/9点、228px/360px、0/5/50.2/100/空欄、点選択→focus→入力→Apply/Discardを検証し、raw/派生view/CLI/保存/History/native/共通CSSを変更しない。新Cardを確定してから割当し、現Cardで既存数値layoutを改造しない。骨追加等の機能拡張を混ぜない。
