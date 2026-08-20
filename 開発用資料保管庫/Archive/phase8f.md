# Phase 8f — Canvas-first Rig Workspace Stage 2 / Reversible Shell Gate

更新日: 2026-08-20
担当: SOL / XHigh（UI authority、復帰契約、DOM / CSS境界、review / close）。限定projection / CSS Sliceが固定した後だけLUNA / MAX候補
状態: CLOSED — Gate 0=`GO (A / CLIP MOTION detail fold)`、SOL final review=`A`

## 1. Goal

Phase 8dで選定したCanvas-first段階導入と、Phase 8eで成立したRIG / Motion共有runtime projectionを、Canvasを覆いにくい可逆Workspace shellへ進める。第一判断は「新しい大画面を作る」ことではなく、Animation TableとCLIP MOTIONの情報量を制作水位に合わせて畳み、通常描画へ確実に戻せる最小表示境界を固定することである。

Bone solver、Mesh、Skin、Motion key、History、save schemaは変更しない。GUI大規模改修やClaudeReview提案は、現行code / event / stateと照合して一つずつ採否を決める。

## 2. Authority / restoration contract

- static正本は既存`ClipAsset.rigDefinition / meshDefinitions / skinBindings`、Frame正本は既存`ClipInstance.rigMotion`。Workspace専用Rig / Mesh / selection / History /保存flagを作らない。
- 現行`AnimationTablePopup`とCLIP MOTIONのtarget / tab / selected Boneをruntime authorityとして維持し、shellは表示projectionだけを持つ。
- 通常描画へ戻る時は、CAF working Layer、active Layer / CAF、Frame、selected Bone、Table scroll / Timeline zoom、Canvas pan / zoom、Q / V / H、Space + drag、wheel三領域を壊さない。
- 既存floating popupはfallbackとして維持する。最初から常設dock、全面Inspector、top-level MESH tabへ置換しない。

## 3. Gate 0 — shell comparison

固定fixtureは1280×720とnarrow、Animation Table + CLIP MOTION + 一枚Raster / 6〜11 Bone / WEIGHT ONとする。

1. `A: Focus shell` — Rig制作中だけTableをcompact stripへ畳み、CLIP MOTIONの現在作業行だけを残す。Canvasを主面とし、必要時にTable / 詳細Setupを展開する。
2. `B: Dedicated workspace mode` — 既存popupを一時的に所定位置へ整列するが、DOM ownerとpopup復帰位置を維持する。通常描画への明示exitを持つ。
3. `C: Permanent dock / Inspector` — 常設dockと大規模DOM再構成。第一候補にせず、A / BよりCanvas面積、到達段数、復帰安定性で明確に優れる場合だけ再検討する。

SOLはA / Bを、Canvas可視面積、Setup到達段数、Motion key操作、名前密集、contrast、narrow / pen・touch、close / reopen復帰で比較する。最初のproduction候補はAとし、既存popupのposition保存を上書きせずruntimeだけで成立するか監査する。

### Gate 0 result（2026-08-20 / SOL）

- `A: Focus shell`を`GO`とする。最初のSliceはAnimation Table compact化ではなく、既存CLIP MOTION内の詳細折りたたみへ限定する。
- Table rootはLane / Timeline gridのwheel三領域、scroll、resize、Bone group、current Frame / key選択を同時に所有しており、最初のcompact対象にすると復帰検証面が広い。
- CLIP MOTIONは既存`_motionEditorMode / _motionInspectorScope / selectedInternalLayerId / selectedRigBoneId`から表示を導出できる。新しいProject flag、selection、History、popup ownerは不要で、既存drag位置も変更しない。
- runtimeのcompact要求だけを持ち、RIG / MOTIONでは適用、操作列を省略できないWARPではexpandedを固定する。WARPから戻ればruntime要求を再適用できる。
- compact中もmode、target、BONE追加、AUTO GRID / SHAPE / LINE、Motion canvas操作 / key header、WEIGHTを残す。数値bind / parent / secondary transform fieldsだけを詳細側に畳む。
- `B: Dedicated workspace mode`と`C: Permanent dock`はHOLD。Focus shellのCanvas可視面積と復帰をOwner fixtureで評価した後だけ再比較する。

## 4. Stage A — read-only architecture audit

- `animation-table-popup.js`のTable root、motion panel、drag / resize、open / close、Panel位置、render / sync入口を列挙する。
- compact化に必要な表示stateが既存open / selected / editor modeから導出できるか確認する。新しいProject flagが必要なら`HOLD / REPLAN`。
- 同名Bone経路、11 Bone密集、Bone group、WEIGHT ON、未接続AUTO GRID、generator別actionを、常時表示 / 必要時表示 / tooltipへ分類する。
- Setup青、Motion橙、通常茶、disabled、focus ringをCSS変数で確認し、通常文字4.5:1、large text 3:1、control境界 / focusをfixture化する。
- ClaudeReviewのUI / file整理提案は、現在残る問題だけを採用する。巨大class一括分割、utility一括統合、未計測GPU / resource変更は混ぜない。

## 5. Stage B candidate — smallest reversible Slice

Gate 0が`GO`の場合だけ、次のうち一つへ限定する。

- Rig / Motion編集中のAnimation Tableを、Lane名、current Frame、選択CAF、必要なkey行、展開buttonだけのcompact stripへ一時表示する。
- またはCLIP MOTION内のSetup詳細を折りたたみ、対象 / mode / 次action / statusを一行目、generator / diagnosticを展開部へ分ける。

両方を同時に作らない。対象file、既存event、Acceptance Criteria、Browser fixtureが固定した一つのSliceだけLUNA / MAXへ委譲できる。

## 6. Non-goals

- Mesh contour最適化、Topology編集、point追加 / triangle切断、自由Weight brush、DQS、stretch、複数Mesh。
- Animation Table / `animation-table-popup.js`の全面置換、100行超DOM一括削除、主要class再構成、既存class一括rename。
- Workspace layoutのProject保存、別selection / History、solver / evaluator / export変更。
- WebGPU renderer、GPU Skin、performance仮説のproduction反映、Video / Audio / physics / Attachment / Text。

## 7. Acceptance Criteria

- Rig制作中にCanvas可視面が現行fixtureより増え、BONE / AUTO GRID / Motion / WEIGHTの到達段数を増やさない。
- compact / expanded / normal drawingを往復してもactive CAF / Layer、Frame、selected Bone、Motion key、Table zoom / scroll、Canvas pan / zoomが維持される。
- Q / V / H、Space + drag、header / Lane / Timeline gridのwheel契約が変わらない。
- RIG Setup青、Motion橙、通常茶、disabled / focusを文字・icon・境界で識別でき、色だけに依存しない。
- preview / playback / onion / Bake / GIF / APNG、save / reload / Undo / Redoの評価結果とHistory件数を変えない。
- 1280×720 / narrowのBrowser実操作、console warning / error 0件。可能ならpen / touchを確認する。

## 8. Verification

- Gate 0のDOM / state / restoration inventoryを先行し、production変更前にSOL判定を記録する。
- 表示projectionをpure helperへ切れる場合は限定verifierを先行する。
- 変更JS / mjsへ`node --check`、関連verifier、全`build/verify-*.mjs`、`npm.cmd run build`。
- Browserでnormal drawing → Table → RIG / Motion → compact / expand → playback → close / reopen → normal drawingを確認する。
- build後は`dist/`と`node_modules/.vite/`の生成差分だけを個別清掃する。

## 9. Stop conditions

- compact化にWorkspace保存flag、第二selection、第二History、別popup ownerが必要になる。
- Animation Table / CLIP MOTIONの主要DOM全面置換や100行超削除が前提になる。
- Layout変更がCanvas pointer座標、CAF working Layer、popup position保存、wheel / shortcut契約を変える。
- GUI Gateの途中でTopology / Weight編集、solver、GPU、file全面分割へ範囲が広がる。

## 10. Source

- `開発用資料保管庫/Archive/phase8d.md`
- `開発用資料保管庫/Archive/phase8e.md`
- `開発用資料保管庫/proposals/16_制作Workspace・UI・外部Handoff構造ロードマップ.md`
- `開発用資料保管庫/proposals/UI_CSSスタイルガイド.md`
- `tegaki_work/OWNER_VERIFICATION_BACKLOG.md`

## 11. Stage B result / SOL final review（2026-08-20）

- pure `rig-workspace-focus-shell.js`で既存editor modeとruntime compact要求から表示だけを導出した。RIG / MOTIONはcompact可能、WARPはexpanded固定とし、WARP往復後はcompact要求を復帰する。
- CLIP MOTION headerへ通常茶の`CANVAS / DETAIL` toggleを追加した。compact中もmode / target / BONE追加 / AUTO GRID・SHAPE・LINE / Motion key header / WEIGHTを残し、bind数値、親select、secondary Motion数値だけを畳む。
- popup位置、Project、History、Rig / Mesh / Motion正本は変更していない。viewport変更時の既存floating popupだけを4px margin内へclampし、通常位置は維持する。
- BrowserではRIG panel高を約180.9px→134.9px、Motionを約95.3pxへ縮小した。1280×720と720×720、RIG / Motion compact、WARP詳細固定、CLIP MOTION close / reopen、Table close→通常ペン→再open、mode / target / compact復帰、console error / warning 0件を確認した。
- 変更JS / mjsの`node --check`、限定verifier、全80 `build/verify-*.mjs`、`npm.cmd run build`を通過した。生成物はclose清掃で追跡済み基準へ戻す。
- SOL final review=`A`。Gate /実装境界 / state復帰 / palette / narrowに追加修正なしで技術closeする。Ownerの一枚人物Raster / 6〜11 Bone / WEIGHT / pen・touch確認は台帳へ分離し、問題時はPhase 8fを暗黙に再OPENしない。
