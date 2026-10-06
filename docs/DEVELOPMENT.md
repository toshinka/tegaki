# AIへ渡す開発契約

状態: CURRENT。モデル名は担当能力の目安で、製品仕様や完了証拠ではない。

## 担当と権限

- Owner: 製品思想、優先順位、重大なUX/保存互換判断、最終制作受入、Git push。
- Local Commander（このプロジェクトでOwnerが指定する司令チャット）: live checkout照合、scope確定、作業割当、競合防止、結果統合、差分/証拠の監査。通常SOL中、重大判断の整理はSOL高を使う。
- Web Subcommander（Ownerが指定するWeb GPT SOL）: Ownerとの会話から目的・制作条件を整理し、外部調査、設計候補、反証、依頼Card案をLocal Commanderへ返す。実装割当・live checkout判断・closeを独立して行わない。就任入口は[Web Subcommander Card](ai/WEB_SUBCOMMANDER_CARD.md)。
- dot（Ownerが指定する継続管理）: 既存担当のcompact状態と承認済みCardを読み、必要な継続連絡をLocal Commanderへ返す。初回はread-only接続確認。直接実装割当・新規担当作成・共有docs更新・closeは行わず、監視をheartbeatと二重起動しない。[dot就任カード](ai/DOT_COORDINATOR_CARD.md)が初期導線。
- Architecture review（明示召喚時のAstra等）: live code照合、重大判断点の整理、限定された設計レビュー（常任のプロジェクトマネージャーや既定の実装者ではない）。
- Implementer / Investigator（SOL6.1 / Luna / Gemini等）: 確定Cardの対象fileと契約内で限定された実装・調査・検証・報告。
- Reviewer: 指定領域の調査・反証・検証。報告を根拠なしに採用しない。

同一file/同じmodelを複数workerで同時変更しない。独立したread-only調査は並列化できる。

### RIGの複数agent運用（Owner追加承認、2026-10-05）

OwnerはLUNA以外のagent利用を明示承認。司令がCard/設計/統合を所有し、SOL6.1中〜高へ複雑なmoduleの限定実装・接点調査・独立監査、LUNA MAXへ確定Sliceの実装を割り当てる。Geminiは外部棚卸し等の必要がある場合だけ受渡しCardを用意する。モデル名だけで完了や採用を判断しない。

独立した責務を2〜3担当に分けることを目安とし、同じfileへのwriteは直列にする。共通controller・source生成・server保存へ接続する前にexact files/ownerをCardで確定する。調査agentはread-only、実装agentは限定write、結果を司令が監査する。担当の追加は常設チャット増設や全履歴の複製を目的にせず、compact確認の10〜15分間隔と無変化時の無通知を維持する。個別Cardの停止境界、process所有、保存/描画正本を継承し、未確定の次Cardは自動実行しない。dotの初回接続確認・新規タスク制限は別契約のまま。

PC接続によるlocal実装と、別途設定するCodex Cloud環境は別の実行場所。現行dirty/Windows固定toolchain/native Browser検証はlocalを継続し、cloudへ自動同期したものと仮定しない。GitHub案内やcloud調査結果だけでlocal現在地を更新しない。

### 漫画文字とRIG proofの並行導線

WP-039（Owner多関節/parameter/warp道具化、2026-10-06）は新detached workbenchと2〜8骨/45点meshを一つの制作区切りで実装。SOL backendはchain-model/model/server、LUNA UIは新workbench/controllerだけを所有、司令は契約/共有案内/統合/代表native保存と通常Raster監査。旧editor/controllersと共通Project/History/renderer/漫画/fontを保持。source+PNG正本、既存EndPose native補間、frame protocolを維持する。engine網羅再試験は行わず新しいauthoring接続と一代表制作操作を検証。live18729/18842はworker操作禁止、司令のowned identity/未保存/saved再照合後だけ配信更新する。exact filesとAPIはWP039、現在地はSTATUS。

WP-038（Ownerシームレス制作続行、2026-10-05）は原PNG上のEnd回転中心配置と一枚素材の土台一巡。backend SOL6.1高はpivot-model/model/serverと専用verifier、UI LUNA MAXはpivot-editor/editor.js/htmlと中央注記接点、司令は契約/共有文書/native/host監査を所有。exact filesはCard、同file並列write無し。workerはlive18729/5174を変更せず独立cacheで実装し、司令がowned identity/未保存保全付き配信更新だけを判断する。製品buildは統合後司令が一回実行。dot接続は前提にせず、確定Sliceは制作受入待ちで止めない。限定土台の技術完了または独立進行不能HOLDで大きな区切りとして返す。

WP-037（Owner続行、2026-10-05）はeditor.html内のweight-row数値欄配置だけ。LUNAはlocal CSSと限定report/cache、司令はCard/文書/実Browser監査を所有。JS/model/runtime/保存/共通CSS/漫画/fontはread-only。workerは18729/5174の停止・再起動・API mutationをしない。CSS配信にserver再起動は不要。初回10分以後、以後10〜15分のcompact確認。Ownerの編集・制作レビュー待ちで止めない。

WP-036（Ownerロングラン続行、2026-10-05）はeditor-local素材上の点選択/追従可視化。exact filesは同Card、LUNA単独write、司令は契約/文書/監査。runtime/evaluator/保存/共通filesはread-only、workerは18729/5174を変更せず専用18838/独立cacheで実装検証。司令は報告後に未保存保全付き配信更新を限定判断。初回10分以後、実測に応じ10〜15分、長処理20分まで。Ownerの編集操作・制作レビューは待たない。

WP-035（Owner実装続行、2026-10-05）は旧quadを保持する9点grid source/native（A）→追従UI/server接続（B）。exact filesは同Card、LUNA単独write、司令は契約/文書/監査。Aは稼働editorとsaved/sessionへmutationせず専用cacheで実行。BはA監査後に明示割当。漫画/font/共通renderer/Project/History/Vite/packageは双方read-only。進捗は初回10分後、以後実測に応じ10〜15分、長い既知処理は20分まで。Ownerレビュー待ちで次の確定実装を止めない。

WP-034（Owner就寝中ロングラン、2026-10-05）はeditor-local四隅weight→既存EndPose再生のA/B。LUNAはCardのmodel/controller/editor/server接続/verifier/fixture/reportを単独所有。司令はCard/STATUS RIG/登録/案内/監査、worker検証中同companionへmutation無し。開始main/e0f353ed、漫画index/focus-lines/QTP dirty保持、共通Layer/Project/History/renderer/Vite/packageは双方read-only。A監査後にBを同担当へ割当。重大保存/描画仕様は自動実装しない。

WP-033（Owner続行、2026-10-05）はWP032で実測した一般RasterのProject再読込色差を修正する例外Slice。最新WP030の入力先/吹き出し操作WRITEにproject-managerは含まないとlive Card/diffを照合済み。project-manager.jsのexportProject PNG採取blockだけを既存LUNAの単独writeとし、漫画向けの既存dirtyを保持する。司令はCard/STATUS RIG/登録/実Browser fixtureを所有。保存schema/load/Layer/renderer/Historyは変更せず、より広い修正が必要ならHOLD。司令専用product18833、native18729、workerはserver/API/process/Browserを操作しない。

Ownerは2026-10-04、漫画/フォント作業と独立RIG proofの並行を承認。現在の分担は次の通り。現在地はSTATUS、exact write filesはそれぞれのCardが所有する。

| 担当 | WRITE | 共有部分の扱い |
|---|---|---|
| 漫画/文字側leadと確定worker | WP-023/024/025のfont/lettering/漫画UIと確定した接続file | 通常Raster/Project/History/Exportへの変更は文字側Cardの限定契約内 |
| RIG側LUNA | 現在のWP-029 `advanced/rive-editor/`指定modules、model verifier、専用report/cache。WP026はread-only証拠 | 製品のfont/lettering/WARP/Layer/Project/History/renderer/packageはread-only。editorは独立source保存 |
| RIG司令 | WP029の`ui/rive-editor-entry.js`、`ui/right-workspace-frame.js`の入口、限定host verifier/fixture、Card/STATUS RIG節/案内/package登録 | 既存Raster追加APIを呼び共通Layerをwriteしない。共通文書反映は他leadと直列、対象節だけpatch |

文字の独自envelopeと既存Anime WARPは現在接続されていない。engineが別でも、保存・History・出力の接続を共有すれば競合し得る。`editable-curve-geometry.js`等の文字用幾何をRIG proofへ共通化/importしない。文字側が既存WARPを触っても、独立proofはその変更へ追従する作業を混ぜない。

後続で共通WARP、`layer-system.js`、`project-manager.js`、`export-manager.js`、History、`core-engine.js`、`index.html`、共通CSS、package/lockを変更する場合は、実行前にlive差分とCardを突き合わせ一つのwrite ownerと順番を決める。同名event/model/propertyの追加もこの接続判断に含む。shared fileが必要になったworkerは結果reportへ必要な接点を返し、自己拡張しない。

各workerは自分の結果reportへ書き、STATUS/TECHNICAL/ARCHITECTURE/登録簿/harness/案内を直接更新しない。共通文書に他leadの進行中変更が見えた場合は差分を保持し、対象行を再読して短いpatchだけを直列反映する。競合したpatchは再読して調整し、他者段落の置換/restore/stashで解決しない。

WP-026は既存Vite/漫画Browserのprocess/tabを共用しない。専用`127.0.0.1:18726`と専用Browser tabを使い、portが占有されていたら停止して返す。既存serviceをkill/restartしない。stopできるのは自分が起動しPIDを記録したproof processだけ。
WP-029 editorは専用`127.0.0.1:18729`。司令の製品接続確認は新規専用tab/自己起動の開発serverで行い、漫画側process/tabは共用・停止しない。WP028の文字/keyboard/rendererとRIG hostに同時writeを作らない。
WP-031の起動/復帰SliceはLUNAが専用dev-companion/bridge/healthだけを所有し、司令がhostと`vite.config.js`の薄いplugin登録を所有する。WP030共通書体窓のcurrent sliceはViteを変更しないとCard照合済み。font bridge/keyboard/共通bootstrapを変更しない。bridgeはdev loopbackのみ、固定SDK検査、single-flight起動、同一installationの再利用、own childだけの終了。実製品検証は司令専用18831/tab。
WP-032は既存End骨の直接編集。LUNAはCard指定のeditor-local gesture/投影/native preview/GUI/verifier/reportを所有し、司令はCard/STATUS/登録/限定監査を所有。serverは独立moduleの固定static配信二件追加だけCard追補で許可し、API/保存/CLI/health/securityを変更しない。model/bridge/Viteと漫画/共通filesは変更しない。native18729と専用product18832、cache rive-editorのみ。worker検証中は司令が同じcompanionへmutationしない。共有checkoutのHMRは他leadの途中writeでreloadし得るため、検証用cache runnerに限るHMR抑止と製品設定変更を区別する。
既存`.codex/agents/tegaki-luna-worker.toml`は`gpt-5.6-luna` / `max`で、AGENTS → STATUS → TECHNICAL → 指定WPの順を持つ。LUNAの世代は割当時に明示し、チャット名の「LUNA MAX」だけから別世代へ切り替えない。configの変更は別の明示作業で行う。
workerへは新しい読む順序と対象カードを明示する。利用不能なら状態を報告し、別modelへ黙って切り替えない。
深いarchitecture判断はCommander / Architecture reviewへ戻すが、既存契約内の技術修正で逐一Owner確認を求めない。

### 実行担当の使い分け

- Executor（SOL6.1中〜高）: 探索を伴う実装、原因調査、adapter境界の照合、複数fileの限定Slice。未決定の契約は司令へ返す。
- Worker（LUNA max）: Goal・対象file・契約・Acceptance・検証・Stopが確定した小さなSlice。設計権限や最終受入をmodel名から得ない。
- Investigator（外部Gemini、Owner指定の3.8 medium等）: 必要なときだけ棚卸し・長時間read-only調査。利用可否と正確なmodel名は依頼時に確認し、候補名を製品保証にしない。

ExecutorとWorkerは役割名であり、二つの常時稼働チャットを必須にしない。通常は一件を一担当へ渡す。独立read-only調査だけ必要に応じて並列化し、同じfile/modelのwrite ownerは一つにする。短い直列作業を分割しすぎず、同じ調査を複数担当へ重複依頼しない。
急ぎの指定がない確定SliceはLUNAのロングランを既定とする。必要な思考・未決定契約はSOL/司令が整える。完了通知を優先し、進捗巡回は10〜15分間隔、短い間隔の全文log再読や同じ状態の確認を繰り返さない。失敗・完了・Owner入力は必要時に対応する。
モデル名とreasoningはOwnerの運用希望。性能順位・料金比較を証明する記述ではない。
個別CardにあるOwnerの明示的な権限委譲は、その担当・範囲に限って扱う。他チャットへ自動継承しない。

チャット名の推奨: `TEGAKI｜司令`、`TEGAKI｜相談・設計`、`TEGAKI｜実行 SOL`、`TEGAKI｜実装 LUNA`。外部調査は`TEGAKI｜調査 <案件>`。担当model/reasoningは依頼に記し、名前から権限を推測しない。

## 仕事の状態

登録済み作業カードの機械的状態は[harness.json](harness.json)のpackagesが所有する。未登録の追加WPを一覧に載っていないだけで未実装と扱わない。状態は対象CardとSTATUSで確認し、登録移行では実態を照合してから状態を決める。

- READY: 目標、対象、禁止境界、検証、完了条件が揃っている。自動実行許可や作業中の意味ではない。
- BLOCKED: prerequisitesまたは重大判断が未解決。blockerを解消してからREADYへ。
- ACTIVE: STATUSでCardとwrite ownerを指定する。Ownerが並行を承認した独立Cardは同時ACTIVE可。同一file/modelの並列writeは許可しない。
- VERIFIED: カードの技術検証が完了。Owner受入が必要なら別欄で未確認を残す。
- DONE: 定義した完了条件を満たし、leadが差分/証拠/文書を監査した。

旧Phaseのcloseは履歴として維持する。新しい不具合を「close済みだから無い」と扱わない。

## 最小の委任prompt

```text
WORK PACKAGE: docs/work/WP-xxx.md
ROLE: implementer / read-only reviewer
READ: AGENTS.md → docs/STATUS.md → docs/TECHNICAL.md → このカード → 指定architecture節
WRITE: exact file list（それ以外はread-only）
BASELINE: commit + 既存差分の扱い
RETURN: 変更理由、file、実行した検証、失敗/未確認、既知リスク
STOP: 新しい保存正本、既存データ削除、未決定UX、対象範囲拡大が必要なら根拠を返す
```

委任Cardは`WORK PACKAGE / ROLE / READ / WRITE / BASELINE / RETURN / STOP`を基本形とする。変更範囲に必要な検証を行い、同じ状態・同じcommitへの同一testは理由なく反復しない。ただし変更後のregression suite、失敗後の再実行、Owner/leadが明示した最終suiteは別扱いとする。

Completion reportは、`START / FINAL HEAD`、worktree、changed files、result、tests、Browser evidence、unchanged authorities、HOLD、next human decisionを短く示す。技術PASS、Browser確認、Owner受入を同じ判定へまとめない。

カードは一つの変更理由へ絞る。未決定の全将来機能を詳細仕様へ展開しない。
親はworkerの報告だけでDONEにせず、diff、入力/終了/失敗、History、関連保存境界を確認する。

## ファイルheader

役割は「局所契約＋必要な探索先」。新規file、または責務を変更したfileだけ更新する。
context windowが短いAIにも、正本、変更禁止境界、検証入口が短く伝わることを優先する。

```js
/**
 * ROLE: このfileだけが担当する処理。
 * AUTHORITY: 保存/History正本。何がruntime派生物か。
 * INVARIANTS: 編集時に落としやすい2〜3条件。
 * RELATED: 危険な境界を共有するfile、docsの対象節、検証suite。
 */
```

import/全関数/全callerを再掲しない。存在しない依存名、完了バッジ、長い変更日誌は残さない。
headerとコードが違う時はbugか古い説明かを区別し、コードを説明へ無理に合わせない。
責務が同じなら行数だけで細分化しない。24k行Popupの問題は長さに加えて、UIとmodel mutation/History/previewが同居すること。

## 検証の選び方

```powershell
node tegaki_work/build/development-harness.mjs check
node tegaki_work/build/development-harness.mjs list transform
node tegaki_work/build/development-harness.mjs test transform
node tegaki_work/build/development-harness.mjs test all
```

runnerは実在する`build/verify-*.mjs`を列挙し、CWDを`tegaki_work`へ固定、失敗時は非0で終了する。
任意のshell文字列や保存された外部命令は実行しない。fixture生成opt-in引数は渡さない。
Node構文確認とVite buildは製品JS/CSS変更時に行う。文書のみならlink/route検査が基本。
close時の全件検証は広い境界変更や未把握の影響がある場合に行う。単純修正で無関係な全探索を繰り返さない。

| 証拠の種類 | 分かること | 分からないこと |
|---|---|---|
| source-contract / document | 文字列、配線、文書契約が存在 | 実際にその経路が成功するか |
| pure-behavior | 実helperの入力→出力 | DOM/Pixi/保存との接続 |
| adapter-mock | 呼出順、渡す値、bounds等 | 実rendererのalpha/blend/pixel |
| cpu-pixel | CPU固定入力の画素/透明RGB | GPU側が同じ結果か |
| Browser integration | productionの操作/DOM/History/console | 未試験端末・長尺・全組合せ |
| Owner production | 指定した制作条件での操作感/受入 | 他条件の一般保証 |

runnerのsource-only判定はimport等に基づく粗い案内。実コード実行候補もmockを含むのでintegrationとは表示しない。
既存testの中にはtest内simulationがある。単なる同じコードの写しを増やさず、実production経路を使った再現へ置き換える。

## 優先する実機3シナリオ

1. 通常Raster/CAF各2Layerで描画→Undo/Redo→save/reopen。bounds拡張、無変更saveのSnapshot ID、兄弟不変を確認。
2. 2Layer/2Frame以上のCAFでV変形→KEY確定→panel保持→次Frame→別変形→cancel。KEY対象、History件数、toolbar、再入場を横断確認。
3. 固定透明Rasterの局所WARPをCPU/Pixi preview/Bake/exportで比較。clippingやRig競合は拒否理由と旧pixel保持を確認。

2と3は未完成の機能を完成扱いにするためのchecklistではなく、WPの受入条件。未実施は未実施と記録する。

## 完了の証拠

結果は、対象commit/差分、入力、期待値、実測結果、実行command、Browser/viewport/DPR、console、Owner受入の有無を短く記録する。
`全N件pass`だけ、自己採点`A`だけ、メソッド名の存在だけでは完了しない。
不具合修正の最小条件は再現、修正前失敗、修正後成功、近隣退行なし、保存/History影響の確認。
未知のdrawing品質を文書編集だけで保証しない。

## Checkpoint

[STATUS](STATUS.md)を一つの現在地とし、まとまりごとに更新する。
CURRENT OBJECTIVE / COMPLETED / CURRENT STATE / IMPORTANT DECISIONS / OPEN QUESTIONS / HUMAN DECISION NEEDED / NEXT / RISKS / BLOCKERSを維持する。
議事録を積まず、根拠はAUDIT/カード/Archiveへリンクする。前回証拠を引き継ぎ、baselineが変わった部分だけ再確認する。

## 外部Web AI

[GITHUB.txt](../Claude_GPT_Review/GITHUB.txt)は現在のdocs入口と対象fileを案内する。
Ownerがcommit/pushして初めてWeb側から最新差分が読める。`main`は可変なのでreview時に対象SHAを併記する。
質問、必読文書、対象source、非対象、未解決判断を限定する。返却はACCEPT / MODIFIED / HOLD / REJECT / OWNER DECISIONへ分類し、実コード根拠を照合する。
外部reportをそのまま保存schemaや作業指示へ転記しない。
