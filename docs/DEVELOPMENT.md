# AIへ渡す開発契約

状態: CURRENT。モデル名は担当能力の目安で、製品仕様や完了証拠ではない。

## 担当と権限

- Owner: 製品思想、優先順位、重大なUX/保存互換判断、最終制作受入、Git push。
- Architecture lead（現在Astra）: live code照合、重大判断点の整理、作業分割、返却差分の監査、状態更新。
- Implementer（Terra/Luna等）: READYカードの対象fileと契約内で実装・検証・報告。
- Reviewer/subagent: 指定領域の調査・反証・検証。報告を根拠なしに採用しない。

同一file/同じmodelを複数workerで同時変更しない。独立したread-only調査は並列化できる。
既存`.codex/agents/tegaki-luna-worker.toml`は旧Phase読む順序を含む設定のまま。今回configは変更していない。
workerへは新しい読む順序と対象カードを明示する。利用不能なら状態を報告し、別modelへ黙って切り替えない。
深いarchitecture判断はleadへ戻すが、既存契約内の技術修正で逐一Owner確認を求めない。

## 仕事の状態

作業カードの機械的状態は[harness.json](harness.json)のpackagesが所有する。

- READY: 目標、対象、禁止境界、検証、完了条件が揃っている。自動実行許可や作業中の意味ではない。
- BLOCKED: prerequisitesまたは重大判断が未解決。blockerを解消してからREADYへ。
- ACTIVE: STATUSで一つの書込み作業を指定する。
- VERIFIED: カードの技術検証が完了。Owner受入が必要なら別欄で未確認を残す。
- DONE: 定義した完了条件を満たし、leadが差分/証拠/文書を監査した。

旧Phaseのcloseは履歴として維持する。新しい不具合を「close済みだから無い」と扱わない。

## 最小の委任prompt

```text
WORK PACKAGE: docs/work/WP-xxx.md
ROLE: implementer / read-only reviewer
READ: AGENTS.md → docs/TECHNICAL.md → docs/STATUS.md → このカード → 指定architecture節
WRITE: exact file list（それ以外はread-only）
BASELINE: commit + 既存差分の扱い
RETURN: 変更理由、file、実行した検証、失敗/未確認、既知リスク
STOP: 新しい保存正本、既存データ削除、未決定UX、対象範囲拡大が必要なら根拠を返す
```

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
