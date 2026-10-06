# WP-034 — 新RIG四隅ウェイトと再生

状態: VERIFIED / A・B限定技術監査成立、OWNER ACCEPTANCE PENDING。A実UI適用/保存/再build・新instance/通常host・実Projectに加え、更新serverでB実再生/停止/同progress native画素と通常Raster受渡しを監査済み。開始main/e0f353ed90d839d2b6785cca2e5c6221e8b73c44、再開時main/4760db9c。WP033保存修正維持。現行checkpointはSTATUS、根拠・未測定は司令監査。未確定Cardへ進めない。

READ: AGENTS→STATUS→TECHNICAL→本Card→DEVELOPMENT並行導線→対象header。固定CLI1.3.0 `rive docs --search Weight` / `rive docs rigging` がpacked Weightの根拠。補足は[公式Weight実装](https://github.com/rive-app/rive-runtime/blob/master/src/bones/weight.cpp)。masterは可変参考であり、固定SDKで実CLI/nativeを測る。

## Goal

一枚PNG/既存Root・End/四頂点二三角形の四隅ごとに二骨への追従割合を編集し、source＋PNG保存/新session再buildを再現する。その後、既存EndPoseの再生/停止/先頭/終点を追加する。UI/model/native/再生を独立moduleにし、AIが確定値・未適用draft・再生状態を区別できる。

## Scope

既存TEGAKI｜実装 LUNA `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2`のみ。新chat/agent無し。他leadと同checkoutを共有し、他者の編集を巻き戻さず合わせる。

Slice A exact WRITE:

- `tegaki_work/advanced/rive-editor/weight-model.mjs` NEW: browser/Node共通のpure四隅weights検証/percentage変換/公式packed encode/decode。画像変形無し。
- `tegaki_work/advanced/rive-editor/weight-editor.js` NEW: controls/draft/apply/discard controller。native/APIはcallbacksへ返す。
- `tegaki_work/advanced/rive-editor/model.mjs`: createSource/parseSourceMetadata/makeSnapshotのweights接続、既定source bytes維持。
- `tegaki_work/advanced/rive-editor/server.mjs`: 既存compile/image/promoteへweights接続、上記static二module配信。Origin/nonce/health/save/CLI args維持。
- `tegaki_work/advanced/rive-editor/editor.js` / `editor.html`: controller接続、native build/load、editor-local controls/CSS/AI snapshot。
- `tegaki_work/build/verify-rive-editor-weights.mjs` NEW、`build/wp034-rive-weights-browser.html` NEW。
- `docs/ai/WP-034-rive-weights-playback-result.md` NEW、cache `tegaki_work/.cache/rive-editor/`のみ。

Slice BはAの司令監査後に同担当へ明示割当。追加WRITE: `advanced/rive-editor/playback-controller.js` NEW、上記editor.js/editor.html/server.mjs（static一件だけ）、`build/verify-rive-editor-playback.mjs` NEW、`build/wp034-rive-playback-browser.html` NEW、同report/cache。runtime.jsは既存seekを使うためread-only。

司令: Card/STATUS RIG/DEVELOPMENT対象行/manifest/登録/案内、`docs/ai/WP-034-rive-weights-playback-audit.md`、必要な既存host fixture測定/cache。worker filesへの並列write無し。font/漫画/keyboard/共通CSS/Layer/Project/History/Export/Pixi/core/index/Vite/package/lock/bridge/dev-companionは双方read-only。共有docsは対象行再読で直列patch。

## Contract

### A — fixed quad / two tendons

- 固定CLI1.3.0/runtime2.44.0/hash gate、一枚PNG/Root・End/rest30°/end -90..90°/四隅順TopLeft,TopRight,BottomRight,BottomLeft/UV/topology/bind geometryを維持。独自evaluatorを作らない。
- 公式Weightはone-based tendon番号と8bit slotのpacked uint。Root index1 / End index2。End byte eは整数0..255、Root=255-e、中間indices513 / values=(255-e)|(e<<8)。全Rootは255/1、全Endは255/2として旧source bytes維持。既定[0,255,255,0]。CLI inspectで割合/合計255を確認。
- 主UIは「四隅の骨への追従」「Endへ追従 %」とRoot補数。percentage0..100を一度byteへ量子化し実割合を表示。初期/Rootのみ/Endのみ/均等presetはdraftだけ。「適用」「変更を戻す」を明示。byte/SDK概念を主操作へ露出しない。360px横overflowを増やさない。
- sourceがweights唯一の保存正本。snapshot.meshWeightsはsourceから導く確定byte array。meta.jsonにweights第二正本無し。旧valid四隅source読込、angle数値/直接bone確定と画像置換で既存確定weights保持。reopen/cancelもsourceから復元する。省略body.weightsは確定値維持。四隅名/order/UVとWeight限定profileをparseし、未対応sourceを既定値へ黙って修復しない。汎用RML parserは作らない。
- input/presetはCLI/save/Project History0、良好native画素保持。「未適用」、AI weightEditPhase/weightDraft/selectedVertex/testidsを追加。draft中status building/reason weights-draftを親へ送信しframe/PNG/save/画像/角/骨/再生を拒否。draft controlsとapply/discardは操作可能。discardは確定値/status/dirty/画素へ戻しCLI0。
- applyで既存/api/compile一回。空/NaN/Infinity/範囲外/不正array/packed/合計255以外はCLI前に拒否。成功だけcandidate promote→fresh公式runtime load。失敗はsource/build/dirty/良好scene保持。成功は明示Saveまでdirty、既存source＋PNG保存。二重適用/stale/teardownを既存操作境界で保護。実頂点を独自変形してoverlayを作らない。

### B — native playback only

- model/source/compile/save不変。既存EndPose一秒をruntime.seekで再生。毎tick getImageData/PNG encode/CLI/API/save/History0。autoplay無し、loop checkbox runtime-only既定OFF。RAF一chain/描画上限30fps、表示/親snapshot最大10Hz程度＋停止時。終点からPlayは先頭へ、one-shot終了progress1。
- 再生/停止/先頭/終点のbuttonとscrub/AI playbackState/progressを表示。scrub、bone、weight draft、compile/image/save/reopen/cancel/PNG/frame request前に停止し、同じprogressのnative frameを採取。hidden/blur/pagehide/teardown/scene loadで停止し古いRAFを持ち越さず、自動resume無し。共通Space/keyboard grammar変更無し。
- controllerはclock/RAF/cancel/seek/status callbacks注入で限定検証。nativeは既存runtime、独自補間/evaluator無し。frame receiptのposeとsnapshot一致。

## Tasks

今の割当は確定B（A司令監査成立後の明示依頼）。重複責務/event/testidをrg、既存runtime.seek/操作境界へ薄く接続。既存saved bundleは専用cacheに一回backupし上書きしない。Owner制作レビューを要求せず司令が実動作まで確認する。現在18729はOwner起動の同installation PID43016をreuse、停止しない。static新routeは起動時固定表なので、更新前serverへ新moduleを試し続けない。既存profile配信を確認し、更新serverが必要なら具体的差を報告する。並行cache mutationとなる第二serverや無断停止で回避しない。実Browser未実施でもcontroller/static/buildを完了し、未測定を明記する。

## Acceptance

A: default旧source/画素一致、中間weightsの公式inspect期待値、56°/progress1 native画素変化、保存→旧session破棄→source再build→新instanceで再現。角/PNG置換weights保持、draft撤回/不正入力良好scene維持、frame拒否、新Raster/History各一件/元絵不変/UndoRedo/実Project画素差0。

B: native再生の進行/停止/終点、scrub/編集排他、破棄RAF0、frame/save前停止、同progress native一致。static/mock/Browser/Owner/性能を分ける。

## Verification

再開時の共有runtime境界: Ownerはsceneを制作中ではないと明示。漫画側最新turnは集中線の調査/改修計画、現行CardもRIG read-onlyと照合。司令がAの18729/API/Saveを単独検証中、他担当の製品tab/processを操作しない。専用product18834/一時tabを使用。serverは同installation PID43016をreuseし停止しない。saved既存bundleと検証開始時snapshotを専用cacheに保全し、完了時は開始の保存内容/default weightsと90°未保存状態へ可能な限り通常APIで復元する。sourceHash/buildIdが予期せず変わった場合は並行mutationとして止まり、他者変更を巻き戻さない。共有STATUS/manifestの他lead行は再読して限定patch。

syntax、関連rig-editor verifier、harness/diff/build。CLI verify/once/inspect実ログ/packed値、固定hash/version、native画素をreportへ。限定verifierは実関数/取消/compile数等の意味ある境界、全旧RIG比較不要。

専用editor18729、司令product18834（B18835）/tab。worker検証中に司令は同companionへmutationしない。worker終了/own cleanup後に司令がsource差分/CLI/実Browser/通常host受渡しを監査。二重iframe tool failureは独立nativeと実hostを区別。own PID/executable/starttime/listener/installation receipt照合後だけownを停止、reuse/他process停止無し。LUNAのcompact確認は15分ごと一回、全文log反復無し。

## Stop

SDK/CLI/runtime/evaluator本体patch、第二version/platform/backend、system install/PATH、login/cloud/publish/CLI再配布、新Project/History/save/renderer/SOURCE authority、旧RIG移行、骨追加/多PNG/自由mesh topology/IK/物理/Timeline、他project/他者process停止、commit/push禁止。固定SDKで成立しなければ根拠付きHOLD、他backendへ継続しない。未確定Cardへ拡大しない。

## Completion

2026-10-05: Owner再起動後に配信HOLD解消。通常入口lazy起動→新module200/hash一致→独立編集画面の実Play/Loop/Pause/終端1を確認。終端native画素は明示終端操作と一致、停止中間progressの二回採取も一致。weight draft/PNG保存が再生を停止し、draft中の操作拒否を確認。再生中のserver snapshot/saved/CLI log/artifact件数不変とtick readback無しのsource監査を区別。実host56°/progress1の透明native1x追加→Raster/History各一件→元絵不変→UndoRedo→実Project Raster/Export画素差0。試験後は通常取消でsaved56°/progress0/dirty false、saved4files hash維持。own検証server正常終了後、通常5174から更新editor/native readyを確認。48 checks/製品build/harness成功。二重iframeの全編集click・全停止境界のtrusted操作・性能・液タブ・Owner制作受入はUNVERIFIED。360px再生欄は収まり、既存全ページoverflowは残る。詳細は[司令監査](../ai/WP-034-rive-weights-playback-audit.md)。下記配信HOLDは解消前の履歴。

2026-10-05 09:01 JST: B修正後の司令実controller再実行で終端runtime/controllerとも1、seeks[0,0.99,1]、旧callback後の新RAF所有保持/pause pending0を確認。限定verifier48 checks・固定cache gate PASS、overlay追従配線確認。担当syntax/weights/model/bone/buildと司令harness90 docs/342 links/diff検査PASS。runtime/model/共通authority変更無し、SDK patch0、server変更はstatic一件だけ。B実配信はOwner/reuse18729 PID43016で新module404、通常終了可否の回答未着。無断停止/第二cache共有serverを行わず、具体的HOLDとして監視PAUSED。再開は起動元の通常終了とport/cache空き確認→更新server→B native進行/停止/編集排他/同progress画素/通常host受渡しの限定監査。5174停止やOwner制作レビューは不要。採用/最終受入/push未。

### B司令監査追補（2026-10-05 08:46 JST）

初回B completed後、pure42 checksだけでは捉えない二件を実controllerで再現。確定B exact files内の修正を同LUNAへ返す。

- clock0→990→1000msでは最後のRAFが30fps間隔未満となりseekをskip、controller ended/progress1なのにruntime progress0.99。終了時は実nativeを必ずprogress1へ揃え、失敗をendedと表示しない。通常tick上限を維持し、終端同期は明示terminalとして扱う。verifierは最後のseek/runtime progressとsnapshotが一致する近接終端ケースを追加。
- stop→start後に旧RAF callbackを呼ぶと、世代判定より前のrafId=nullにより新RAF所有権を失い、pause後もpending一件残る。旧世代callbackは現行rafIdを変更しない。cancel/restart→旧callback→pause/disposeで新RAFまで取消し、pending0/新chain一本を確認。
- onPlaybackStateでnative姿勢が進む際、骨overlayの投影も既存boneController.refreshで追従する（最大10Hzと停止時、PNG/readback/API0を維持）。停止した画素とoverlayの位置が違うままにならないよう、配線と実測層を区別する。

18729の新 `/playback-controller.js` は司令の限定GETで404、Owner/reuse PID43016のまま。無断停止/第二cache共有serverを行わず、まずこの修正のstatic/controller/buildを完了する。配信復帰は司令が別途段取りを返す。初報completedを修正完了/native Browser PASSにしない。

2026-10-05 08:10 JST: A技術確認済み、B割当へ。実UIで56°/四隅[128,64,192,32]適用→Save→公式再build→旧tab破棄→新native instanceのRGBA一致、PNG hash一致。PNG差替え・数値/直接骨編集のweights保持、API不正weights五件/壊れたPNG拒否とCLI log/artifacts/良好scene不変、取消再現を実測。通常入口から新Raster/History各一件、元絵不変、UndoRedo、実ProjectManager.loadProject後Raster/Export差0。saved source/PNG/rivを開始時hashへ通常APIで復元、90°/progress1/dirty true/native画素も復元。own18834正常終了、reuse18729/5174停止無し。詳細と未測定は司令監査。下記旧HOLDは再起動前の履歴。

### A司令監査追補（2026-10-04 16:35 UTC以後）

A turn `01a107a7-ec8a-7ef3-86db-0f164a6211fe` completed、cursor `3dd52516-1c76-4546-b09a-6bd66c10b380:26`。pure/static成功はnative/Browser成功ではない。18729はA開始前のPID32532（health installation一致、Get-Process executable/starttimeとnetstat listener一致）が稼働中で、新static `/weight-model.mjs`は404。司令own spawnの証拠無しのため停止/再起動しない。現行server経路は未検証、Bは未割当。

同A exact files内の限定修正を同LUNAへ戻す。`wp034-controller-audit.mjs`の実controller測定で、入力`5`が即`5.1`へ書き換わり、空欄TopLeftが別欄TopRight入力後に以前の`5.1`へ無言復元され、apply callback一回に到達した。

- input中のraw表示を維持し、他欄の空/不正値を無言復元しない。四欄全体のvalidityを保ち、apply直前にも確認。確定byte/実割合の表示は成功/preset/discardと補助表示で区別。focusだけではdraft/compile/dirtyを発生させず、selectedVertexの観測は維持する。
- `applyState`のnative load終了から非同期record終了まで、weight draft/pendingが残る間にstatus readyを送らない。handleFrameRequestにもdraft/pending拒否を明示。draftの間は画像/角/scrub/save等のcontrolsをdisabledにし、controller四欄/apply/discardだけ操作可能。拒否時は良好scene/dirty/draft保持。
- verifierに連続数値入力、空欄→別欄正常入力→apply拒否、focusだけ、deferred commit中のframe拒否を意味ある範囲で追加。root cache reproducerや司令docsはworkerが書かない。既存saved bundleを変えず、18729の他者processへmutation/停止しない。CLI/native測定の準備は専用cacheで続行可能。Bは修正＋A監査後の明示割当まで行わない。

HOLD / A限定修正completed、実controller再実行でraw保持/空欄apply拒否callback0、weights verifier63 PASS。最新turn/cursorはSTATUS。[担当証拠](../ai/WP-034-rive-weights-playback-result.md)と[司令監査](../ai/WP-034-rive-weights-playback-audit.md)を区別する。独立公式CLI＋新native instanceでdefault画素維持、中間weights差、保存source再build/new instance再現差0まで実測。現行UI/保存API/今回の中間weights host受渡しは未。更新前18729 PID32532/新module404を修正後にも再確認、own根拠無しのため停止せず、cache並行mutationとなる第二serverも起動しない。独立進行不能として監視PAUSED。再開は起動元の通常終了でport/cacheが空いた確認、または所有/停止範囲が確定した別Card。fresh serverでA実動作が成立してからBを同担当へ明示割当する。Owner制作レビューを再開条件にせず、採用/pushはOwner。
