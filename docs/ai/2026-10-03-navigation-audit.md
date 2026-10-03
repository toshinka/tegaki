# 外部Webサブコマンダー就任・導線監査

状態: REFERENCE。確認日: 2026-10-03。
対象は就任入口、文書案内、委任契約、URL対応。製品コード・全機能・過去のRIG受入を再検証した報告ではない。

## Baseline

- checkout: `D:\GitHub\tegaki` / `main` / HEAD `2165a6010f2d64a100ee33efc927637af83c8cc1`。
- 開始時dirty: AGENTS.md、docs/TECHNICAL.md、Claude_GPT_Review/GITHUB.txt。既存差分を保持した。
- ローカルorigin/mainは同じSHA。`git ls-remote origin refs/heads/main`はGitHubへの接続失敗。Web取得も対象commitのDEVELOPMENT.mdを取得できず、公開先との一致はUNKNOWN。
- 正式案内は[Claude_GPT_Review/GITHUB.txt](../../Claude_GPT_Review/GITHUB.txt)。GITHUB.mdは対象checkoutに無し。

## Findings and corrections

| 確認した問題 | 今回の処置 |
|---|---|
| 新規Webチャットが役割・製品語彙・哲学を最短で学ぶ就任入口が無い | [就任カード](WEB_SUBCOMMANDER_CARD.md)を作成し、README / DEVELOPMENT / GITHUB / 登録簿から条件付きで案内 |
| DEVELOPMENTの委任READがTECHNICAL → STATUSでAGENTSと不一致 | STATUS → TECHNICALへ統一 |
| READMEが古いWP-002引継ぎを既定案内にし、workerにWP選択を促す | 新規役割と指定Cardの読む順序へ変更。旧handoffは保持 |
| GITHUBのTimeline経路がREFERENCE二件を常に先読みさせる | 現行architecture / 指定Cardから開始し、REFERENCEは明示選択時だけ |
| GITHUBが開始worktree cleanと記載 | 実観測の既存dirtyを記載し、dated snapshotと現在状態を分離 |
| GITHUBのR-71記述をSTATUSで確認できない | 継承された過去記録／未再検証と明記。現在の欠陥・受入完了を断定しない |
| DEVELOPMENTがLUNA configを旧Phase読む順序と説明 | 実ファイルの現行読む順序とgpt-5.6-luna / maxへ訂正。設定自体は変更無し |
| Web Commanderとローカル司令の実行割当が曖昧 | DEVELOPMENTでLocal Commander / Web Subcommander / Executor / Worker / Investigatorの範囲を明記 |
| WP一覧がWP-006とWP-010〜018を落とす | work/READMEへ存在するCardの入口を追加。未登録packageの状態を推測で割り当てない |
| STATUSに古いCURRENT見出しと開始clean baselineが残る | 今回の現在地を先頭に置き、古い目的/Sliceを過去記録と明記。過去証拠を削除しない |

## Verification scope

- 変更前: `development-harness.mjs check`は38 documents / 162 local links / 25 proposals / 9 packagesでPASS。
- 変更前のGITHUB.txt raw URL 84件は、全件に対応するローカルfileあり。これはGitHub上の公開・取得成功の証拠ではない。
- 最終確認はharnessの文書/相対link検査、GITHUB raw URLのローカル対応検査、`git diff --check`、最終HEAD/worktree/scope確認。結果はSTATUSへ記載する。
- 文書のみのため製品build・Browser・画素比較は今回の検証対象外。以前のPASSを今回再実施したとは扱わない。

## Remaining limits

- 本就任カードと今回の更新はローカル成果。公開確認まではOwnerの貼付/添付でWebへ渡す。pushは行わない。
- GITHUBは目的別の索引であり、全ファイル一覧ではない。今回の検査はリンク先の存在とrouting。各領域のsource説明が全て最新かを全件監査していない。
- docs/harness.jsonのpackagesはWP-001〜009。WP-010〜018は存在するがpackageとして未登録。今回は文書検査対象と索引へ追加するだけで、依存・機械状態を新たに確定しない。
- ROADMAPとSTATUSには以前のWP順序・履歴が残る。今回の先頭checkpointを優先し、次の製品Cardは司令が実態とOwner優先順位を照合して確定する。旧NEXTから自動実行しない。
- R-71の現在のProject save/load受入、外部backendのbrowser編集/保存、Public/Advancedのbuild分離は未検証。本監査で完了へ昇格させない。
- チャット名は運用提案。実際のチャット作成・改名、model設定変更、外部Gemini送信は行っていない。

## Role recommendation basis

二系統の実行担当は十分で、通常は一系統だけ稼働させる。未知の原因やadapter境界を扱うSOL Executorと、仕様確定済みの小さなSliceを扱うLUNA Workerを使い分ける。Geminiは必要時のread-only調査に限定する。
これはOwnerの希望と本repoの競合防止からの運用判断。モデルの優劣・費用を実測した比較ではない。
OpenAIの[Multi-agent公式説明](https://developers.openai.com/api/docs/guides/responses-multi-agent)も、独立したsubtaskには利点がある一方、追加tokenや共有stateへの頻繁なwrite、直列依存では利点が小さいと説明している。APIの説明をこのWebチャットのツール利用権限へ読み替えない。
