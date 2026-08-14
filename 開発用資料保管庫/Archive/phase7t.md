# Phase 7t — Codex Multi-Model / External Web Review Workflow

更新日: 2026-08-13  
担当: SOL / XHigh（設計・導入Gate・監査）、LUNA workerはOwner承認後の限定pilotのみ  
状態: CLOSED — Stage 0〜2、LUNA probe / pilot、全60 verifier、build、SOL最終review=`A`

## 1. Goal

Ownerが主taskをSOL / LUNAへ毎回手動変更する運用を、SOL主taskが限定SliceだけLUNA subagentへ委譲する監督付きworkflowへ置き換える。外部Web GPTは`GitHubURL.txt`を入口にOwner経由で使い、依頼準備と返却後の採否整理だけを半自動化する。

## 2. Source of truth

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. 本Phase
5. `tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`
6. OpenAI公式Codex Subagents / AGENTS.md / Models資料

外部Web GPT原案は`開発用資料保管庫/Archive/Tegaki_Codex_マルチモデル開発・外部Webレビュー半自動化_原案_2026-08-13.md`へ保存し、実装契約にはしない。

## 3. Stage 0調査結果

- OpenAI公式仕様では、local Codexは直接指示または適用される`AGENTS.md` / skillに基づきsubagentを起動できる。
- project-scoped custom agentは`.codex/agents/*.toml`。`name` / `description` / `developer_instructions`が必須で、`model` / `model_reasoning_effort` / `sandbox_mode`等を上書きできる。
- SOLは曖昧・複数段階・計画・検証向け、LUNAは明確・限定・反復作業向けという原案の役割分担は公式model guidanceと整合する。
- repoの`.codex/`は存在するが空で、`.codex/agents/`は未作成。project設定はまだない。
- global configは`gpt-5.6-sol` / `xhigh`。CLIは`C:\Users\MAX\AppData\Roaming\npm\codex.cmd`の`codex-cli 0.141.0`。PowerShell shimはexecution policyで実行不能だが`.cmd`は利用できる。
- `CODEX_CLI_PATH` / process-level `CODEX_HOME`は未設定。DesktopはWindowsApps同梱`codex.exe`を使用する。Desktopとnpm CLIのbinaryは同一ではないため、CLI設定だけでDesktop挙動を断定しない。
- 現sessionのspawn model override表示はSOL / TerraのみでLUNAを列挙していない。公式にはLUNA custom agentを指定できるが、導入後の新taskでread-only probeを行い、実際の利用可否を確認してからwrite pilotへ進む。

## 4. Gate判定

判定: `GO WITH OWNER GATE`

workflow設計は採用可能。ただし「現在の主taskを自動でSOL⇄LUNAへ切替」は採用しない。SOL主taskを責任主体として固定し、custom LUNA subagentへ限定作業を委譲する。

## 5. Stage 1 — 最小導入（Owner承認済み）

### In scope

- `.codex/agents/tegaki-luna-worker.toml`を1件だけ追加する。
- modelは`gpt-5.6-luna`、reasoningは`max`を第一試験値とする。利用不能なら勝手に別modelへfallbackせずSOLへ戻す。
- `AGENTS.md`へ、SOLの委譲判定、LUNAの設計変更禁止、BLOCKED返却、SOL再監査必須という短い永続規則だけを追加する。
- 詳細手順を`tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`へ分離する。
- 最初にread-only probeを行い、agent名・model・reasoning・権限継承・結果回収を確認する。
- write pilotはproduction codeでなく、`GitHubURL.txt`のlocal URL鮮度verifierのような機械的・限定的・rollback容易な1 Sliceを候補とする。

### Out of scope

- 複数write agentの並列実行。
- LUNAによるPhase設計、正本更新、close、次Phase開始。
- global `C:\Users\MAX\.codex\config.toml`の変更。
- Ownerのcomposer modelを自動操作すること。
- LUNA利用不能時のTerra等への暗黙fallback。
- production codeを最初のpilotにすること。

## 6. Delegation contract

LUNAへ渡せるのは、対象file、既存契約、実装手順、Acceptance Criteria、verifier、停止条件が確定したSliceだけ。Architecture、保存schema、History、Layer / CAF / Rig / Mesh境界の判断が新たに必要になれば変更せず`BLOCKED`でSOLへ返す。

SOLは返却後にdiff、対象外変更、History / persistence、verifier / build、生成物、文書整合を監査し、`A / B / BLOCKED / REPLAN`を判定する。LUNAの完了報告だけでcloseしない。

## 7. Stage 2 — External Web Review Gate

- `GitHubURL.txt`の更新日、現在地、current Phase、重要source / verifier、重複・local欠損を機械検査する。
- external review requestを定型生成し、branch / commit SHA / push確認状態を明記する。
- Ownerがcommit / pushとWeb GPTへの送受信を担当する。未pushのlocal差分をWeb GPTが読めるとは扱わない。
- 返却reportは外部参考資料として保存し、SOLが`ACCEPT / ACCEPT WITH MODIFICATION / HOLD / REJECT / OWNER DECISION`へ分類する。
- Web GPTの指摘を直接production code、現行Phase、proposal正本へ昇格しない。

## 8. Acceptance criteria

- Ownerが主taskをLUNAへ切り替えず、SOLが1件のcustom workerへ限定Sliceを委譲できる。
- model / reasoning / sandboxが実taskで確認でき、利用不能時はSOLへ安全に戻る。
- LUNAはPhase外を変更せず、設計判断が必要なら`BLOCKED`を返す。
- SOL監査とOwner Gateが必ず残る。
- External Review GateはGitHub上の対象commitを明示し、未push状態を誤ってレビューさせない。
- 既存Phase優先、1 Owner指示=原則1 Phase、Archiveを暗黙再OPENしない規則を維持する。

## 9. Verification

- TOML parse / Codex agent discovery。
- read-only probeで実model / reasoning / sandbox / result routing確認。
- write pilotで対象外diff 0、指定verifier / build、SOL再監査。
- `GitHubURL.txt` local mappingのURL件数、missing 0、duplicate 0。
- workflow文書とAGENTSの重複・矛盾監査。

## 10. Rollback

- project追加物だけを対象に、`.codex/agents/tegaki-luna-worker.toml`とAGENTSの限定規則を個別に戻せる構成にする。
- global config、Ownerのcomposer設定、既存Phase / production codeはrollback対象へ巻き込まない。
- pilot失敗時はcustom workerを無効化し、従来のOwner手動切替またはSOL単独運用へ戻す。

## 11. Owner Gate

2026-08-13、OwnerがStage 1を承認した。`.codex/agents/tegaki-luna-worker.toml`、`AGENTS.md`の短い永続規則、`tegaki_work/CODEX_MULTI_MODEL_WORKFLOW.md`を導入し、read-only probeを行う。write pilotへのsandbox昇格と実装はread-only probeのSOL判定後に別Gateとして扱う。

read-only probeはLUNA / MAX / read-onlyで実起動し、現行Phase、URL集計181 / Raw 174 / 重複0 / local欠損0、変更0、fallbackなしを返した。SOL判定`A`。続いてworkspace-writeへ昇格し、`GitHubURL.txt` local URL verifierだけの限定write pilotへ進む。

write pilotは`tegaki_work/build/verify-github-url-index.mjs`新規1fileだけをLUNAへ委譲した。nested CLI親は240秒でtimeoutしたが、childは直後にtarget fileを完了して終了した。SOLは最終fileのrepo root containment、excluded path拒否、current Phase一件 / Raw URL確認、重複 / local欠損検査を再監査し、node checkと実行成功を確認した。timeout時点の中間状態を完成扱いにしない。

Stage 2の依頼定型は`tegaki_work/EXTERNAL_WEB_REVIEW_REQUEST_TEMPLATE.md`。対象branch / commit SHA / push state、質問、必読URL、非対象、返却形式を固定し、未pushなら送信しないOwner Gateを残す。

## 12. Model decision

- 現在: SOL / XHighを維持。
- Stage 1設定・read-only probe・初回監査: SOL / XHigh。
- 利用可能性確認後の限定write pilot: LUNA / MAX。
- pilot後のdiff監査とStage 1 close: SOL / XHigh。

## 13. 最終結果

- `tegaki_luna_worker`をproject-scoped custom agentとして導入し、主taskのcomposer model自動変更なしでLUNA / MAXへ限定Sliceを委譲できることを実証した。
- read-only probeはLUNA / MAX / read-only、fallbackなし、変更0。write pilotはworkspace-writeで新規verifier一件だけを対象とし、SOLが対象外diff 0を再監査した。
- nested CLI親の初回probeはinput 83,940 token（cache 62,464）で、常用には重い。新runのCodex appからproject agentを直接spawnする運用を基本とし、nested CLIは導入・再現検査に限定する。
- npm Codex CLIはGPT-5.6要求を満たさない0.141.0から0.147.0へ更新した。Desktop app、global config、Ownerのcomposer設定は変更していない。
- `verify-github-url-index.mjs`、External Web Review依頼template、GitHubURL navigationを同期した。Phase 7u立上げまで反映した最終URL集計はHTTPS 186 / Raw 179 / 重複0 / local欠損0。
- 変更mjsのnode check、全60 verifier、`npm.cmd run build`、project-owned `git diff --check`を通過し、`dist/` / `.vite/`生成差分を清掃した。UI / runtime production source変更はないためBrowser操作は非対象。
- 2026-08-13、SOL最終review=`A`で技術close。外部reviewの送受信、commit / push、最終採否はOwner Gateとして維持する。
