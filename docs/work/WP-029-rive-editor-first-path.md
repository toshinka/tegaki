# WP-029 — 新RIGの試作編集入口と通常Rasterへの受渡し

状態: ACTIVE / ROUGH PRODUCT PASS。2026-10-04 Ownerが触れる移植を先に、改修しやすいモジュールとAI可視性を意識して裁量で実装するよう指示。main/f245c354開始、既存WP023〜028等のdirty保持。製品採用・最終制作受入・pushは未。

READ: AGENTS → STATUS → TECHNICAL → 本Card → DEVELOPMENT「漫画文字とRIG proofの並行導線」→ ARCHITECTURE「起動と接続」「データの所有」「LayerとCAF編集」。[WP026結果](../ai/WP-026-rive-proof-result.md)の固定CLI/runtimeと実RML構造を継承。旧proof4filesは変更しない。

## Goal

通常Canvasから独立Rive編集を開き、PNG一枚を二bone/四頂点のnative画像meshで動かし、source+画像を独立保存、現在フレームの透明1x PNGを明示操作で新規通常Rasterへ追加する。最初は画像読込・終点角・scrub・保存/再読込/取消・フレーム追加。旧RIG内部互換、Timeline/CAF直接接続、多部品editorは先取りしない。

## Exact files / ownership

既存LUNA `01a0ff17-48d3-7f51-93b9-c1df1dfc7ae2`, gpt-5.6-luna/maxのwrite:

- `tegaki_work/advanced/rive-editor/model.mjs`: PNG境界、固定native RML template、angle/sourceモデル。
- `tegaki_work/advanced/rive-editor/server.mjs`: 専用companion、CLI build、独立source bundle。
- `tegaki_work/advanced/rive-editor/runtime.js`: 公式Web runtime load/seek/render/dispose/1x PNG。
- `tegaki_work/advanced/rive-editor/editor.js`: GUI/state、iframe protocol。
- `tegaki_work/advanced/rive-editor/editor.html`: 最小Futaba編集面。
- `tegaki_work/advanced/rive-editor/run-editor.ps1`: 固定hash/version確認、専用server起動。自動install無し。
- `tegaki_work/build/verify-rive-editor-model.mjs`: modelの限定検証。
- `docs/ai/WP-029-rive-editor-result.md`: 担当結果のみ。
- cache `tegaki_work/.cache/rive-editor/`。WP026の公式CLI/runtime cacheはread-only依存。

司令write（workerはread-only）:

- `tegaki_work/ui/rive-editor-entry.js`: runtime-only host/iframe adapter、PNG decode、既存Raster追加API。
- `tegaki_work/ui/right-workspace-frame.js`: Drawing側の独立「新RIG（試作）」入口、destroyでadapter解放。
- 本Card/STATUS RIG節/登録/案内、新規限定host verifier/Browser fixture。

同時writeしない。文字WP028のmodel/UI/renderer/keyboard/CSS等、共通Layer/Project/History/Export/Pixi/core/index/package/lock/Viteはwriteしない。LayerSystemの既存`createRasterLayerFromSnapshot`だけ利用。right-workspace-frameから新host moduleをimportし、共有bootstrapを変更しない。

## Native editor契約

- CLI1.3.0 / canvas-advanced2.44.0のWP026固定hashを検査し既存cacheをread-only参照。system install/PATH、login/publish/cloud、CLI再配布、SDK patch無し。
- 専用127.0.0.1:18729、CORS無し、API mutationはsame-origin＋起動nonce、CLI同時一件。占有port/他processは停止せずHOLD。RIVE_HOMEは本cache、analytics off。自分のprocessだけ停止。
- PNG一軸1024px以下/1MP以下、8MiB以下binary upload。control JSON64KiB。Browser native decodeで破損拒否、serverはPNG header/sizeと公式compilerで確認。任意URL/path/CLI args/RML uploadは受けない。
- 一画像、四頂点/二triangle、Root/End二bone、left vertices Root/right Endの固定weight。rest30°、終点角-90..90°、一秒timeline、scrub0..1。実PNG寸法のartboardとmesh、通常blend。WP026 native schemaの寸法展開だけで、変形/skin/rendererは公式runtime。
- outputはartboard全体の原寸透明PNG。表示zoom/DPRを焼かず、素材を無言縮小しない。上限外は理由付き拒否、frame外の変形部分がcropされることを表示。
- source+画像が独立authoring正本、rivは派生物。製品Projectに新property無し。read/rebuild失敗では良好scene保持。壊れた保存の起動を初期fixtureで成功扱いにしない。save/reopen/cancelは保存PNGを実使用。
- engine/runtime、model/template、GUIを分け、汎用plugin framework/旧GUI互換層を作らない。

## AI可視性 / UI

日本語入口「PNG素材」「変形」「保存」とhostの「現在フレームを新レイヤーへ」。role/label/data-testidを安定させる。snapshotは`{schema:'tegaki.rive-editor.state.v1',status,documentId,buildId,sourceHash,image:{name,width,height},angle,progress,dirty,reason}`、status loading/ready/building/error。一つのsnapshotをJSON inspectorと`data-editor-status`へ投影、nonce/巨大PNGを混ぜない。未接続・未保存・拒否reasonを明示。診断は折畳み、Futaba cream/maroon/orange。close/reopenで良好draftを保持し、明示保存だけを永続保存と説明。AI snapshotはProject/Historyの第二正本ではない。

## iframe protocol

URL `http://127.0.0.1:18729/?embed=1#session=<uuid>&parent=<encoded-origin>`。host/editorともorigin・event.source・sessionId・versionを照合、送信先に`*`を使わない。parentはhttp loopback originのみ。

- editor→parent: `{type:'tegaki:rive-editor:state',version:1,sessionId,state:<snapshot>}`、初期native load完了と変更時。
- parent→editor: `{type:'tegaki:rive-editor:request-frame',version:1,sessionId,requestId}`、host footerの明示操作のみ。
- editor→parent: `{type:'tegaki:rive-editor:frame',version:1,sessionId,requestId,buildId,documentId,width,height,progress,png:<ArrayBuffer>}`、同じnative runtimeの1x PNG8MiB以下。重複requestは一度だけ処理。
- busy/error: `{type:'tegaki:rive-editor:error',version:1,sessionId,requestId,reason}`。

親はnormal Drawing context、frameContainer identity、Canvas寸法、未確定Transform/live stroke/selection transform、History適用中、request/build identityをdecode前後で照合。frame/context変更は拒否。PNGをdecodeし既存`createRasterLayerFromSnapshot({width,height,pixels,rasterBounds,paths:[],pathsData:[]},{name,historyName:'rive-frame-import',source:'rive-editor'})`へ一回。新Layer/原寸/Project Canvas中央配置、一command/一History、原Layer上書き無し。Undo/RedoとProjectは既存Raster経路。

## Acceptance / Verification

worker: model verifier、JS/PowerShell構文、CLI verify/build/inspect、専用BrowserでPNG読込→angle→scrub→save/dispose/rebuild/reopen→cancel→透明原寸PNG。WP026と異なる寸法のPNGも使う。破損/超過/未接続/保存asset欠落で成功を偽装せず、source/hash/log/PNG/snapshot/行数をreportへ。

司令: hostのorigin/source/token/重複/stale拒否、実TEGAKI Drawing Canvasで入口→編集→新Raster追加→Undo/Redo→Project往復、追加一Historyと元絵不変、旧入口保持、構文/build/関連verifier/harness/diff check。文字差分を保持、対象外回帰を無限に広げない。専用Browser/own processのみ。static/Browser/Owner受入は別記。

## Stop / Completion

system install、SDK/CLI/renderer/evaluator修復、第二version/platform/別backend、旧RIG自動移行、production保存schema/History/renderer authority変更、文字共有filesのwrite、他project、commit/pushは禁止。frame返却以上のProject統合・多部品/IK/physics/Timelineは次Card。失敗はcommand/input/logを返す。

Owner指示により発行。独立editorを既存LUNA、製品hostと接続/監査を司令が担当。worker報告だけでcloseせず、制作受入前の技術検証を進める。
