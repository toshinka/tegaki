> 状態: ARCHIVED — 2026-09-05再構成前の記録。元の場所: `tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`。本文中の「現行」「次の作業」は当時のもの。現在の入口は `docs/README.md`。

# Codex Multi-Model / External Web Review Workflow

更新日: 2026-08-13
状態: ACTIVE — Phase 7tでprobe / pilot受入・技術close済み

## 1. 目的

Ownerが主taskをSOL / LUNAへ手動で切り替え続ける代わりに、主taskはSOL / XHighを維持し、SOLが仕様確定済みの限定Sliceだけを`tegaki_luna_worker`へ委譲する。外部Web GPTはGitHubへpush済みの節目にsecond opinionとして使用し、Codexは依頼準備と返却後の採否整理を担当する。

## 2. 責任分担

### SOL main task

- live正本、Phase境界、Architecture、保存・History・Layer / CAF / Rig / Mesh境界を判断する。
- LUNAへ渡せる粒度までSliceを確定する。
- worker返却後にdiff、対象外変更、verifier、build、生成物、文書を再監査する。
- Phaseの開始、`A / B / BLOCKED / REPLAN`判定、close、次Phase選定を行う。

### `tegaki_luna_worker`

- 対象file、既存契約、Acceptance Criteria、検証、停止条件が確定した一つのSliceだけを処理する。
- 新しい設計判断、保存schema、History正本、Layer / CAF / Rig / Mesh境界が必要なら変更せず`BLOCKED`を返す。
- Phase設計、proposalの採否、close、次Phase選定、Git push、Owner受入判定は行わない。
- 初期導入の`read-only`能力probeは`A`。workspace-writeへ昇格後も親が列挙した対象file以外を変更しない。

### Owner

- 優先順位、Stage Gate、実機受入、Git commit / push、外部Web GPTへの送受信と最終判断を担当する。

## 3. 委譲判定

次をすべて満たす時だけLUNAへ委譲する。

1. 一つのPhase内の一つのStageまたは限定verifier作業である。
2. 対象fileと変更してよい範囲が列挙されている。
3. 実装方法が既存契約から一意に近く、新しいArchitecture判断がない。
4. Acceptance Criteriaと実行するcheckが列挙されている。
5. 想定外依存、対象外差分、保存・History境界への波及時に停止できる。
6. SOLが返却後に全差分を監査できる規模である。

曖昧な要求整理、原因不明bug、複数候補の比較、Phase横断変更、制作Project受入はSOLで扱う。

## 4. 委譲promptの必須項目

```text
ROLE: tegaki_luna_worker
PHASE / STAGE:
GOAL:
READ ORDER:
TARGET FILES:
EXISTING CONTRACT:
IMPLEMENTATION STEPS:
ACCEPTANCE CRITERIA:
VERIFICATION:
STOP / BLOCKED CONDITIONS:
EXCLUSIONS:
RETURN FORMAT:
```

`TARGET FILES`外の変更、新規設計、依存更新が必要になった場合は実装を続けず、根拠付き`BLOCKED`とする。

## 5. Stage 1 read-only probe

agent fileは`.codex/agents/tegaki-luna-worker.toml`。project agent / AGENTSはCodex run開始時に読み込まれるため、追加前から動いているtaskへ遡及適用したと扱わない。

新しいCodex processで次を確認する。

1. `tegaki_luna_worker`がproject custom agentとして認識される。
2. LUNA指定を拒否せず起動できる。利用不能ならTerra等へfallbackせず`BLOCKED`。
3. reasoning指定と`read-only` sandboxが受理される。
4. `AGENTS.md`、`TEGAKI.md`、PROGRESS、現行Phaseの順序を報告できる。
5. repoの現行Phase名と`GitHubURL.txt`のRaw URL件数をread-onlyで報告できる。
6. probe前後の`git status`が同一である。

同じtask内のparent agentが新agentを列挙できない場合は失敗ではなく「新runで再確認」と記録する。CLI probeがDesktopと同一binaryでない場合も、CLI結果だけでDesktop成功と断定しない。

## 6. write pilotへの昇格Gate

2026-08-13、read-only probeは`tegaki_luna_worker`、`gpt-5.6-luna`、reasoning `max`、sandbox `read-only`で起動した。URL集計181 / Raw 174 / 重複0 / local欠損0、変更0、fallbackなしを確認し、SOL判定`A`。Owner承認済みStage 1の限定pilot用にsandboxを`workspace-write`へ変更する。最初のpilotはproduction codeではなく、`GitHubURL.txt`のlocal Raw URL鮮度を検査するverifierとする。

別CLI内にSOL親を新設してからcustom workerをspawnした初回probeは、総input 83,940 token（cache 62,464）だった。通常運用ではCodex appの新taskがproject agentを直接spawnできる時はそちらを優先し、nested CLIは導入probeや再現調査に限定する。

write pilotの必須条件:

- 対象は新規verifierと必要最小限のscript登録だけ。
- raw.githubusercontent.comのrepo prefixだけをlocal pathへdecodeする。
- URL総数、Raw URL数、重複、local欠損を決定的に報告する。
- 外部URLのnetwork到達性は検査しない。
- Backup / PastFiles / excluded proposalを探索しない。
- production source、保存schema、History、UIを変更しない。
- SOLがdiff、node check、全verifier、build要否を再判定する。

probeまたはpilotが失敗したらagentを拡張せず、SOL単独運用へ戻す。

## 7. External Web Review Gate

外部reviewは大きな機能群、Architecture境界、数Phase後のロードマップ再点検、Owner要求時に限定する。

Codexが準備する情報:

- review目的と質問。
- 現行Phase、対象branch、commit SHA、push済みか。
- `GitHubURL.txt`の更新日、Raw URL件数、重複0、local欠損0。
- 必読URL、対象source / verifier、非対象、Owner判断項目。

Ownerがcommit / pushとWeb GPTへの送受信を行う。未pushのlocal差分をWeb GPTが閲覧できるとは扱わない。返却reportは参考資料として保存し、SOLが次へ分類する。

- `ACCEPT`
- `ACCEPT WITH MODIFICATION`
- `HOLD`
- `REJECT`
- `OWNER DECISION`

外部reportからproduction code、Phase指示、proposal正本へ直接転記しない。

## 8. 禁止事項

- Ownerのcomposer modelを自動操作する。
- LUNA利用不能時に別modelへ暗黙fallbackする。
- 複数write agentを並列に走らせる。
- LUNAの完了報告だけでPhaseをcloseする。
- global `C:\Users\MAX\.codex\config.toml`を変更する。
- Browser未確認を通過扱いにする。
- 既存差分、`dist/`追跡基準、`.vite/`追跡基準を一括削除・巻き戻しする。

## 9. 公式仕様

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://developers.openai.com/api/docs/models
