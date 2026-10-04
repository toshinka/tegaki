# WP-031 — 新RIG編集入口の起動と復帰

状態: VERIFIED / TECHNICAL ENTRY PASS / OWNER ACCEPTANCE PENDING。2026-10-04 Ownerが接続失敗画像を提示し、操作可能なまとまりまで実装続行、レビューは後でよいと指示。main/871c51ed開始。WP030漫画/字体と既存dirtyを保持。

READ: AGENTS → STATUS → TECHNICAL → 本Card → DEVELOPMENT「漫画文字とRIG proofの並行導線」。WP029の既存editor/host headersとCompletionを継承。

## Goal

通常のlocalhost開発Canvasで「新RIG」を開くだけで、固定SDKを検査し独立editorへ接続する。手動PowerShell起動を通常操作の必須にしない。壊れたiframeと無期限待機を避け、起動中/失敗/再試行を日本語とAI snapshotで読める。接続が使えるようにした後、次の直接編集UIを確定して進める。今回のSliceは起動/復帰に限定する。

## Scope

既存LUNA `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2`（gpt-5.6-luna/max）WRITE:

- `tegaki_work/advanced/rive-editor/dev-companion.mjs` NEW: 固定cache hash/version確認、同一installation health、lazy single-flight起動、own child lifecycle。
- `tegaki_work/build/rive-editor-dev-bridge.mjs` NEW: Vite dev専用same-origin middleware、bootstrap nonce、status/ensure。
- `tegaki_work/advanced/rive-editor/server.mjs`: GET /healthの識別JSONだけ（既存nonce/保存/CLI/rendererは変更しない）。
- `tegaki_work/build/verify-rive-editor-dev-bridge.mjs` NEW: 意味のあるHTTP/process境界の限定検証。fake server/childによるstatic証拠とnative証拠を分ける。
- `docs/ai/WP-031-rive-dev-entry-result.md`、cache `.cache/rive-editor/`だけ。

司令WRITE（worker read-only）:

- `tegaki_work/vite.config.js`: 既存font pluginを保持し、serve && !isPreviewのpluginsへ一件追加する薄いimport/登録だけ。WP030現在sliceはこのfileを所有しないことを照合済み。
- `tegaki_work/ui/rive-editor-entry.js`: lazy bootstrap、接続中placeholder/再試行、close/stale response guard。既存frame/Raster境界保持。
- `tegaki_work/build/verify-rive-editor-entry.mjs`、`build/wp029-rive-browser.html`の必要な限定追補。
- 当Card/STATUS RIG節/DEVELOPMENTの対象境界/manifest/案内、`docs/ai/WP-031-rive-entry-audit.md`。

他者のfont/文字/keyboard/共通CSS/Layer/Project/History/Export/Pixi/core/index/package/lockはwriteしない。新chat/agent無し。同file/model並列write無し。

## Contract

固定HTTP contract（司令hostが使用する）:

- `GET /__tegaki/rive-editor/status` → JSON `{schema:'tegaki.rive-editor.connection.v1',phase:'idle'|'starting'|'ready'|'error',reason,nonce}`。nonceはdev bridge startup固有・host診断snapshotには含めない。idleは未起動。status読みだけではspawnしない。
- `POST /__tegaki/rive-editor/ensure`、header `x-tegaki-rive-nonce: <status.nonce>`、空body、exact same Origin → 同じschemaのJSON、ready時`editorOrigin:'http://127.0.0.1:18729'`。入力でport/path/command/source/argsを受けない。
- middlewareはsocket loopback、Host localhost/127.0.0.1/::1と有効port、Origin exact host origin、nonceを照合。query拒否、405/403/413等を明示。body上限1024bytes。CORS追加無し。build/previewにはmiddlewareもnonce defineも導入しない。font bridgeをreuse/変更しない。
- healthは`{app:'tegaki.rive-editor',protocol:1,installationId,pid}`。installationIdはrealpath(WORK)のSHA256、raw filesystem pathは返さない。port18729の他installation/別app/legacy識別不能healthは占有として理由付き拒否し、stop/kill/restartしない。同じinstallationの既存識別済みserverは再利用できるが、所有は取得しない。
- ensureはsingle flight、外部CLI引数無し。公式CLI1.3.0/runtime2.44.0のWP029 hash（実CLI/archive/runtime archive/served三files）とCLI versionを起動前に検査。missing/mismatchでspawnしない。system install/PATH/network/login/publish/SDK patch無し。
- childは`process.execPath`と固定server.mjsで直接spawn、windowsHide。cache/log/RIVE_HOMEは既存rive-editorだけ。既存serverのanalytics off環境を維持。有限timeout（30秒以下）、health.readyとspawn object.pid/installationを照合後にready。timeout/errorで自分のchildだけ停止、連続自動restart無し。
- Vite終了時に自分が作ったchildだけ停止。再利用したserverは停止しない。child object/creation token/healthの所有根拠をcache receiptに残す。GET status/ensure responseにnonce以外のOS秘密やrawpath/logを混ぜない。
- editor iframe origin/source/session/versionのWP029照合は維持。hostはbridge.readyの後だけiframe.srcを設定し、native snapshot readyでだけframe追加。close/reopen/destroyが非同期応答を受けてもstale iframeを復活させない。再試行は同じ明示操作、無限poll無し。起動失敗の原因は短い日本語とstable reasonで表示。
- 公開build/previewやbridge不在は理由付きunsupported表示。公式CLIを公開buildへ同梱しない。技術proofと公開利用条件/製品採用は分ける。

## Tasks

LUNAは固定contractのdev companion / HTTP bridge / health識別を実装・検証。司令は独立hostと薄いVite登録を実装し、実開発serverでserver停止→入口→lazy起動→native編集→frame追加→Undo/Project、閉じる/再開、失敗表示を確認する。shared Vite登録はworker module完成後に直列で行う。

## Acceptance

起動済みcompanionを前提にせず「新RIG」を開いて編集画面が表示される。起動/接続失敗はbroken iframeと永久待機にならない。good draft/source/通常Rasterの保存/History契約を保持。AIからconnection phase/reasonとnative stateを読める。Ownerレビューは要求せず司令が操作する。

## Verification

worker: JS構文、fixed cache hash/version実測、HTTP loopback/Origin/nonce/body/query拒否、single flight、一致health reuse/他installation占有拒否/close ownだけ、SDK欠落時spawn0。限定verifierにSDKやcacheが無ければnativeはHOLDを明示。

司令: 関連verifier/harness/diff/build、専用product18831/tab。実native Browserでcompanion停止状態→入口起動→素材/角/scrub/保存→native frame一件→Undo/Redo/実Project。起動中close/stale応答、再開/再試行、preview bridge不在表示、font bridge登録が保持されていることを確認。自分のprocessだけ終了。static/Browser/Owner受入を分ける。

## Stop

SDK/CLI本体修復、第二version/platform/backend、system install/PATH、login/cloud/publish/CLI再配布、production保存/History/renderer/SOURCE変更、他project、他者process停止、旧RIG移行、commit/push禁止。直接bone/mesh編集、多素材、IK/物理/TimelineはこのSliceへ混ぜない。ここでblockerが出たら具体的根拠を返す。

## Completion

2026-10-04司令監査で、停止状態からの通常入口→固定cache検査→own child起動→native画面表示、close/reopen、bridge不在/previewの理由とsrc未設定、font plugin保持を確認。担当のreceipt並列writeを司令再実行で検出し、直列化＋temporary renameへ限定修正後、41 checks / native PASSを司令で再確認。実Browserの独立native面でPNG/55°/scrub/保存/再読込、通常製品hostの新規Raster/History各一件、元絵不変、Undo/Redoと実Project/Export画素一致を再実測した。[司令監査](../ai/WP-031-rive-entry-audit.md)、[担当結果](../ai/WP-031-rive-dev-entry-result.md)。embedded面の全編集clickは検証toolがtargetを失うためUNVERIFIED、独立native操作と製品受渡しを分けて記録。35秒上限はsource/static確認で実時間timeoutは未実測。Owner制作/液タブ/性能/公開配布条件は未受入。後続は[WP-032](WP-032-rive-direct-bone-edit.md)の限定直接編集で進める。
