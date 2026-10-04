# AIへ渡す開発契約

状態: CURRENT。モデル名は担当能力の目安で、製品仕様や完了証拠ではない。

## 担当と権限

- Owner: 製品思想、優先順位、重大なUX/保存互換判断、最終制作受入、Git push。
- Local Commander（このプロジェクトでOwnerが指定する司令チャット）: live checkout照合、scope確定、作業割当、競合防止、結果統合、差分/証拠の監査。通常SOL中、重大判断の整理はSOL高を使う。
- Web Subcommander（Ownerが指定するWeb GPT SOL）: Ownerとの会話から目的・制作条件を整理し、外部調査、設計候補、反証、依頼Card案をLocal Commanderへ返す。実装割当・live checkout判断・closeを独立して行わない。就任入口は[Web Subcommander Card](ai/WEB_SUBCOMMANDER_CARD.md)。
- Architecture review（明示召喚時のAstra等）: live code照合、重大判断点の整理、限定された設計レビュー（常任のプロジェクトマネージャーや既定の実装者ではない）。
- Implementer / Investigator（Luna / Gemini等）: 確定Cardの対象fileと契約内で限定された実装・調査・検証・報告。
- Reviewer: 指定領域の調査・反証・検証。報告を根拠なしに採用しない。

同一file/同じmodelを複数workerで同時変更しない。独立したread-only調査は並列化できる。

### 漫画文字とRIG proofの並行導線

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
