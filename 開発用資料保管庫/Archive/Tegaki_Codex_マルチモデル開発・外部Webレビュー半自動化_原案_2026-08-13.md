# Tegaki Codex マルチモデル開発・外部Webレビュー半自動化 提案書

- Status: Proposal
- Date: 2026-08-13
- Target repository: `toshinka/tegaki`
- Primary target: Codex Desktop / Codex CLI
- Proposed workflow: **SOL 計画 → LUNA 実装 → SOL 監査 → Owner Gate**
- Optional workflow: **External Web Review Gate（Owner経由の半自動運用）**

---

## 1. 目的

Tegaki の現在の Phase 開発方式、正本ドキュメント、verifier、Browser確認、SOL review、Owner確認を維持したまま、Codex 内でのモデル切替を可能な範囲で自動化する。

主目的は以下。

1. Owner が毎回 SOL / LUNA を手動で切り替える負担と切替忘れを減らす。
2. SOL を設計・計画・監査の責任主体として維持する。
3. 明確で限定された実装のみを LUNA subagent に委譲し、トークン消費を抑える。
4. 難しい・曖昧・高リスクな作業は SOL に残す。
5. 必要な節目のみ、Web版 GPT を外部レビュー／地均し役として使用する。
6. Web版 GPT との連携は当面 **半自動** とし、Owner Gate を残す。
7. 外部レビュー前には `tegaki_work/GitHubURL.txt` を同期・更新し、Web側が古い状態を参照しないようにする。
8. 外部AIの提案を自動的に仕様・正本へ昇格させない。

---

## 2. 現状認識

Tegaki はすでに次の開発構造を持つ。

- `AGENTS.md` にAI共通ガイドがある。
- `TEGAKI.md` が技術方針・禁止事項の正本である。
- `tegaki_work/PROGRESS.md` が最新開発進捗・現在地を持つ。
- `task-codex/phase*.md` が現行Phaseの実装契約として機能している。
- `開発用資料保管庫/proposals/` にロードマップ・将来設計・要望整理がある。
- Phaseごとに verifier / build / Browser確認が蓄積されている。
- 完了Phaseは `開発用資料保管庫/Archive/` に記録される。
- 外部AIレビューについても `ClaudeReview/` に「提案であり正本ではない」先例がある。
- `tegaki_work/GitHubURL.txt` は、ローカルFSへアクセスできない外部AIが GitHub 上の必要資料へ到達するためのナビゲーションとして既に運用されている。

したがって、本提案では新しい開発方式を作り直すのではなく、**既存Phase方式にCodexのsubagent委譲と外部レビューGateを追加する**。

---

## 3. 基本原則

### 3.1 役割と権限をモデル能力ではなく職務として固定する

#### SOL MAIN

責任:

- 正本確認
- 現在地確認
- 要望・proposalの整理
- 次Phase候補の選定
- 実コード調査
- Phase計画作成
- 対象 / 対象外 / Acceptance Criteria の確定
- verifier / build / Browser確認項目の設計
- LUNAへ委譲可能かの判定
- 実装後のdiff・テスト・設計境界監査
- 外部Webレビューの採否判定
- Phase close候補の判定
- Ownerへ最終報告

SOL は **設計変更権限を持つ唯一のAI主体** とする。

#### LUNA WORKER

責任:

- SOL が確定したPhase計画のうち、明確かつ限定された実装
- 既存コードの局所調査
- 定型的な修正
- verifier追加または既存verifier実行
- build / 構文確認
- 変更内容・検証結果・残存懸念の報告

LUNA は以下を禁止する。

- Phase目的の変更
- 対象外領域への拡張
- 保存schema、History境界、Architecture境界等の独自変更
- 新しい仕様の独自決定
- 不明点を推測で埋めて大きく進めること
- 外部AIレポートを直接仕様として採用すること
- 次Phaseを自動開始すること

想定外の設計判断が必要になった場合、LUNA は **BLOCKED** として SOL MAIN に返す。

#### Owner

責任:

- 最終的な優先順位判断
- Owner確認が必要なBrowser・制作実測
- 外部Webレビューの送信・受領
- 重大な設計変更の承認
- Phase closeの最終運用判断
- 自動化範囲の拡大・縮小判断

---

## 4. モデル選択方針

初期方針:

- SOL MAIN: `gpt-5.6-sol`
- LUNA WORKER: `gpt-5.6-luna`

ただし「実装工程だから常にLUNA」とはしない。

SOL MAIN は委譲前に次を判定する。

### LUNAへ委譲可能

- 仕様が明確
- 対象ファイル・責務が限定されている
- 完了条件が明確
- 既存設計内の変更
- verifierまたは明確な検証方法がある
- 独自のArchitecture判断を必要としない
- 失敗時に局所的にrollbackできる

### SOL自身で実装または再計画

- 仕様が曖昧
- 複数のArchitecture境界にまたがる
- 保存schemaを変更する
- History / Layer / CAF / Rig / Mesh 等の基盤契約を変更する
- 原因不明の複雑なバグ
- Proposal自体の解釈・採否が必要
- 既存設計の変更が必要
- LUNAがBLOCKEDを返した
- 完了条件を機械的に定義できない

重要:

> SOL が LUNA でも安全に実装できる粒度まで仕事を加工してから委譲する。

---

## 5. 通常開発フロー

1回のOwner指示につき、原則 **1 Phaseのみ** を進める。

```text
Owner
  ↓
SOL MAIN
  ├─ AGENTS.md
  ├─ TEGAKI.md
  ├─ PROGRESS.md
  ├─ OPEN phase
  └─ 関連proposal / source
      を確認
  ↓
現在のOPEN Phaseを判定
  ↓
[OPEN Phaseあり]
  ├─ 進行可能 → 続行
  └─ 外部条件待ち → BLOCKEDとして報告
       ※勝手に別Phaseへ移動しない
  ↓
[OPEN Phaseなし]
  ↓
SOLがproposal / roadmap / 要望から次候補を選定
  ↓
実コード確認・既実装確認・凍結領域確認
  ↓
Phase計画を作成
  ↓
LUNA委譲判定
  ├─ YES → LUNA WORKER
  └─ NO  → SOL MAINが実装
  ↓
verifier / build
  ↓
SOL MAIN監査
  ├─ NG → 限定した修正指示をLUNAへ
  ├─ 設計問題 → SOLが再計画
  └─ OK
  ↓
Browser / Owner確認
  ↓
PROGRESS / Archive更新候補
  ↓
Owner Gate
```

---

## 6. 次Phase選定ルール

Codex が「何か実装して」と言われた際の優先順位を固定する。

1. 現在OPENの `task-codex/phase*.md`
2. `PROGRESS.md` に明記された次の入口・比較候補
3. Ownerから今回明示された要望
4. 未実装proposal索引 / 短中期ロードマップ
5. `実装したいことメモ.txt`
6. その他の将来提案

禁止:

- OPEN Phaseを無視して別機能へ勝手に移る。
- Owner確認待ちを「未実装」と誤認して新しいコードを足す。
- Archive済みPhaseを再オープンする。
- Proposalの大項目を一度に実装する。
- 複数Phaseを無断で連続消化する。

---

## 7. Phase計画に必須とする項目

SOL MAIN が LUNA に渡す前に、少なくとも以下を確定する。

```text
# Phase X

## Goal

## Context / Reason

## Source of truth

## In scope

## Out of scope

## Existing contracts to preserve

## Files likely involved

## Implementation steps

## Acceptance criteria

## Verifier / build

## Browser verification

## History / Undo / Redo considerations

## Persistence / schema considerations

## Rollback / cancel behavior

## Known risks

## Owner verification

## Delegation decision
- LUNA / SOL
- reason
```

既存Phaseフォーマットがこれより厳密な場合は既存形式を優先する。

---

## 8. SOL監査

LUNAの「完了しました」をそのままPhase完了としない。

SOL MAINは最低限以下を確認する。

- diffがPhase対象内か
- 無関係な変更がないか
- 既存API / event / class / utilityを再利用できているか
- 新しい重複実装を作っていないか
- History境界を壊していないか
- cancel / no-move / invalid input等の境界
- 保存schema変更の有無
- reload / exportへの影響
- Layer / CAF / Motion / Rig / Mesh等の既存責務境界
- verifier結果
- build結果
- Browser確認項目
- 生成asset・log・一時ファイルの清掃
- PROGRESSと実装の整合

監査結果:

- `A`: 技術close候補
- `B`: 限定修正後に再監査
- `BLOCKED`: Ownerまたは外部条件待ち
- `REPLAN`: Phase設計から再検討

既存の評価方式がある場合は既存方式を優先する。

---

# 9. External Web Review Gate

## 9.1 目的

Codexだけで全調査・全監査を継続するとトークン消費が大きくなる場合がある。

そこで毎Phaseではなく、**価値の高い節目だけ** Web版 GPT を外部レビュー／地均し役として使用する。

Web版 GPT は実装担当にしない。

役割:

- Proposalと現在実装の横断整理
- 大きな機能領域へ入る前の地均し
- 設計前提の別視点チェック
- 複数Phase終了後のロードマップ再点検
- 実装とドキュメントの乖離検査
- 技術負債・取りこぼし候補の整理
- 次Phase候補の材料作成

---

## 9.2 半自動方式を採用する理由

当面、CodexからWeb版GPTを自動起動・会話回収することを前提としない。

代わりに次を半自動化する。

### Codexが自動で行う

- External Review Gateが有効かを判定・提案
- `GitHubURL.txt` の同期必要性確認
- `GitHubURL.txt` 更新案または更新
- 外部レビュー依頼書 `.md` 作成
- レビュー対象commit / branchの記録
- 外部GPTに読ませる優先資料の指定
- 返却されたレビュー `.md` の読解
- 提案ごとの採用 / 保留 / 却下判定
- 採用内容を正式Phase候補へ変換

### Ownerが行う

- commit / pushの確認
- Web版GPTへ `GitHubURL.txt` と依頼書を渡す
- Web版GPTに調査を実行させる
- Web版GPTが提出した `.md` をリポジトリまたはCodexへ渡す

このOwner Gateは意図的に残す。

---

## 9.3 External Review Gate 発動条件

以下のいずれかを満たす場合、SOL MAINは外部レビューを**提案できる**。

- 大きな新機能群へ入る前
- 新しいRoadmap段階へ移る前
- Architecture境界変更の可能性がある
- 保存schema / History / Layer / CAF / Rig / Mesh 等に広く触れる
- 数Phaseを完了し、方向を再評価する価値がある
- Proposalと実装の乖離が疑われる
- 似た概念・重複実装が増えた疑いがある
- SOL内で広範な再読が必要になり、トークン消費が大きい
- 既存判断への自己追従を避け、別コンテキストの検査が有効
- Ownerが外部レビューを要求した

原則として不要:

- CSS微調整
- 既存契約内の単純bug fix
- 小さなUI変更
- verifier追加
- 明確な局所リファクタ
- 直前に同領域の外部レビューを行ったばかり

---

# 10. External Reviewの2種類

## 10.1 PRE-IMPLEMENTATION GROUNDING

大きな実装に入る前の地均し。

Web GPTへ期待する成果:

- 関連正本・proposalの整理
- 現在実装とのギャップ
- 既実装 / 未実装 / 後送項目の区別
- 前提となる既存契約
- 注意すべきArchitecture境界
- 依存順序
- Phase分割候補
- 実装前に決めるべき質問
- 触るべきでない範囲

提出例:

`ExternalReview/YYYY-MM-DD_<topic>_grounding.md`

## 10.2 POST-IMPLEMENTATION AUDIT

複数Phaseまたは大きな節目の後の外部監査。

Web GPTへ期待する成果:

- Proposal / roadmap と現行実装の整合
- 取りこぼし
- 意図せぬ仕様化
- 重複責務
- 技術負債
- verifier不足
- 将来Phaseへの影響
- 次に見直すべき候補

提出例:

`ExternalReview/YYYY-MM-DD_<topic>_audit.md`

※ 実際の保存先は既存リポジトリ構造との整合をSOLが確認して決める。
※ 新しいディレクトリ追加が不要なら、既存の外部レビュー保管方式を優先する。

---

# 11. GitHubURL.txt Sync Gate

外部Webレビュー前には必ず `tegaki_work/GitHubURL.txt` の鮮度を確認する。

## 11.1 更新確認項目

SOL MAINは以下を確認する。

1. 更新日
2. 「現在地」
3. OPEN Phase
4. 完了Phase
5. `PROGRESS.md`
6. 新しい重要proposal
7. 新規・移動・削除された重要source
8. 新しいverifier
9. 新しい外部レビュー資料
10. 凍結 / 後送 / Owner確認待ちの記述
11. 現行Phaseに必要なファイルへの導線
12. 既に古くなった「最優先」「現行」「直前」の記述
13. Raw URLが `main` の実在ファイルを指すか

## 11.2 GitHubURL.txtの原則

`GitHubURL.txt` は巨大な全ファイル一覧へ膨張させない。

外部AIが、

1. 正本を読む
2. 現在地を把握する
3. 対象機能に必要なsourceだけ読む

という順序を維持する。

追加対象:

- 正本
- 現行Phase
- 重要proposal
- 現行実装の主要source
- verifier
- 外部レビュー対象に必要な資料

通常は追加しない:

- 無関係な全source
- 生成物
- build artifact
- 一時log
- Archiveの全ファイルを無条件で最優先化すること

---

# 12. External Review Request の標準形式

CodexはOwnerへ渡す依頼書を自動生成する。

例:

```markdown
# Tegaki External Web Review Request

## Review type
PRE-IMPLEMENTATION GROUNDING

## Target
- Repository: toshinka/tegaki
- Branch: main
- Commit: <commit SHA>
- GitHubURL.txt updated: <date>
- Current Phase: <phase>

## Required first reads
1. tegaki_work/GitHubURL.txt
2. AGENTS.md
3. TEGAKI.md
4. tegaki_work/PROGRESS.md
5. current task-codex phase
6. related proposal(s)

## Question
<今回調査したいこと>

## Required checks
- current implementation vs proposal
- already implemented / not implemented / deferred
- architecture boundaries
- risks
- phase decomposition candidates
- contradictions or stale documents

## Do not
- treat proposal as implemented fact
- treat old Archive as current specification
- propose unrelated redesign
- write production code
- silently promote your suggestion to specification

## Output
Return one Markdown report with:
- Executive summary
- Facts confirmed from repository
- Gaps / risks
- Recommended options
- Suggested next Phase boundaries
- Items requiring Owner decision
- Files actually inspected
```

---

# 13. 外部Web GPTの権限

外部Web GPTのレポートは **参考資料** とする。

正本順位:

```text
1. Ownerの明示指示
2. TEGAKI.md 等の正本
3. 現行 PROGRESS.md / task-codex Phase
4. 現行ソースコード / verifier / 実測
5. SOL MAIN の採否判断
6. 外部Web GPT review
7. 古いArchive / 過去レビュー
```

※ 既存リポジトリに明示された正本優先順位が異なる場合は、既存規定を優先し、この表を修正する。

外部Web GPTは以下をしてはならない。

- 直接production codeを変更する
- Phaseを正式closeする
- Proposalを書き換えて採用済みにする
- 保存schemaを決める
- 既存正本を上書きする
- 「推奨」を「仕様」に読み替える

---

# 14. 外部レビュー返却後のSOL採否フロー

```text
Web GPT report.md
  ↓
SOL MAIN
  ↓
各指摘を分類
  ├─ ACCEPT
  ├─ ACCEPT WITH MODIFICATION
  ├─ HOLD
  ├─ REJECT
  └─ OWNER DECISION
  ↓
現行sourceと再照合
  ↓
必要なものだけ
proposal / Phase候補へ反映
  ↓
Ownerへ採否理由を報告
```

SOLは採用時に必ず、

- どの指摘を採用したか
- なぜ採用したか
- どの正本・実装と整合するか
- どのPhaseに落とすか

を示す。

---

# 15. Commit / Push Gate

`GitHubURL.txt` は `main` のRaw URLを外部AIへ渡すため、外部Webレビュー直前には **レビュー対象状態がGitHubから読めること** を確認する。

最低限、External Review Requestに以下を記録する。

```text
Repository:
Branch:
Commit SHA:
PROGRESS state:
Current Phase:
GitHubURL.txt updated date:
Review type:
```

ローカルだけに存在する変更がある場合:

- Webレビュー対象に含めない、または
- Ownerがcommit / pushした後に実行する。

Web GPTが一世代前のコードをレビューする状態を避ける。

---

# 16. トークン消費抑制方針

## 16.1 Codex内

- SOLは毎回リポジトリ全体を読み直さない。
- `AGENTS.md` / `TEGAKI.md` / `PROGRESS.md` / current Phase から対象を絞る。
- 探索・定型処理はLUNAへ委譲可能。
- Phaseは小さく切る。
- LUNAへは必要な範囲だけ渡す。
- 完了PhaseはArchiveを正本代わりに毎回全文再読しない。
- 必要な契約だけ現行文書へ残す。

## 16.2 Web GPT

- 毎Phase呼ばない。
- `GitHubURL.txt` を入口にする。
- Required first readsを限定する。
- Review Requestで対象質問を限定する。
- 「全プロジェクトを自由研究」させない。
- 外部レビュー結果はSOLが要約・採否し、次工程で何度も全文再読しなくて済む形へ変換する。

---

# 17. 推奨Codex構成案

実装前に現在のCodex CLI / Desktopの正式仕様を確認すること。

候補:

```text
/
├─ AGENTS.md
├─ .codex/
│  ├─ config.toml
│  └─ agents/
│     └─ tegaki-luna-worker.toml
├─ task-codex/
├─ tegaki_work/
└─ 開発用資料保管庫/
```

LUNA custom agentの概念案:

```toml
name = "tegaki_luna_worker"
description = "Approved Tegaki Phase slices の限定実装を担当するworker"
model = "gpt-5.6-luna"
model_reasoning_effort = "medium"

developer_instructions = """
Follow the approved Phase contract from the SOL parent.

Do not redesign the Phase.
Do not expand scope.
Do not change architecture, persistence schema, or cross-system contracts
without returning BLOCKED to the SOL parent.

Inspect existing implementations before adding new ones.
Run the Phase-specified verifiers and build checks.
Return changed files, validation results, and unresolved risks.
"""
```

sandbox / approval設定は現行Tegaki運用とCodexの現在仕様を調査して決める。

---

# 18. AGENTS.md への追加方針

既存 `AGENTS.md` を大規模に肥大化させない。

AGENTS.mdには短い永続ルールだけを置く。

例:

- SOL MAINが計画と監査を担当する。
- 明確な限定Sliceのみ `tegaki_luna_worker` に委譲できる。
- LUNAは設計変更禁止。
- OPEN Phaseを優先する。
- 1 Owner指示 = 原則1 Phase。
- External Web ReviewはOwner経由の半自動Gate。
- 外部レビュー前に `GitHubURL.txt` syncを行う。
- 外部レビューは正本ではない。
- 詳細運用は専用workflow文書を参照する。

詳細ルールは別Markdownへ切り出すことを推奨する。

候補:

`tegaki_work/CODEX_MULTI_AGENT_WORKFLOW.md`

または既存の開発資料構造により適切な場所。

---

# 19. 導入フェーズ

## Stage 0 — 調査のみ

Codexに以下を確認させる。

- 実際に使用中のCodex CLI path
- CLI version
- `CODEX_CLI_PATH`
- Desktop / CLIのconfig共有状態
- subagent利用可否
- `.codex/agents/` の現行仕様
- project `AGENTS.md` の読み込み状況
- 現在のmodel設定
- 現行Tegaki `AGENTS.md` との競合

**変更は行わず報告のみ。**

## Stage 1 — LUNA worker導入

- 1種類だけ作る
- 並列write agentは作らない
- SOL MAIN → LUNA worker → SOL MAIN
- 小さな低リスクPhaseで試験する

## Stage 2 — 監査ループ安定化

- BLOCKED運用
- SOL再監査
- verifier/build
- Owner Gate
- token / 品質 / 手戻りを比較

## Stage 3 — External Web Review Gate導入

- GitHubURL Sync Gate
- External Review Requestテンプレート
- Web GPT report受領
- SOL採否テンプレート
- PRE-IMPLEMENTATION GROUNDINGを1回試験

## Stage 4 — 必要なら拡張

実績が良い場合のみ検討。

- read-only explorer agent
- verifier / test専用agent
- reviewer subagent
- Terraの利用
- External Reviewの定型化

最初から多数のagentを導入しない。

---

# 20. 成功条件

この提案の導入成功を以下で評価する。

1. OwnerがSOL/LUNAを毎工程手動で切り替えなくてよい。
2. LUNAへの誤委譲時にBLOCKEDでSOLへ戻れる。
3. LUNAがPhase範囲を勝手に拡張しない。
4. SOL監査が必ず入る。
5. 既存verifier/build/Browser確認方式を維持できる。
6. OPEN Phaseの優先順位が崩れない。
7. 1回の指示で無断の複数Phase連続実装をしない。
8. 外部Web GPTを毎回呼ばず、必要な節目だけ利用する。
9. 外部レビュー前の `GitHubURL.txt` 更新漏れを防げる。
10. Web GPTの提案が自動的に正本化されない。
11. Ownerが最終Gateを維持できる。
12. Codex内の不要な広域再読と高コストモデル利用を減らせる。

---

# 21. 失敗時の停止条件

以下の場合、自動的に次へ進まずOwnerへ報告する。

- 正本同士が矛盾する
- OPEN Phaseが複数あり優先順位不明
- 保存schema変更が必要
- Phase外の大きな修正が必要
- verifierが失敗し原因がPhase外
- Browser確認不能でそれがclose条件
- `GitHubURL.txt` とGitHub実体が一致しない
- 外部レビュー対象commitが不明
- LUNAが2回以上同じ原因でBLOCKED
- SOL監査でArchitecture再設計が必要
- 外部Web GPTの提案と現行正本が衝突
- Owner判断が明示的に必要

---

# 22. Codexへの初回依頼

この提案書を受け取ったCodexは、**即座に設定変更や実装を始めず**、まず現状調査と導入設計を行うこと。

初回タスク:

```text
この提案書をTegakiの現行リポジトリに照らしてレビューしてください。

まず変更は行わないでください。

確認事項:
1. 現行AGENTS.md / TEGAKI.md / PROGRESS.md / current Phaseとの整合
2. 現在のCodex Desktop / CLIでsubagentが利用可能か
3. 現在使用中のCLI path / version / CODEX_CLI_PATH
4. .codex/agents custom agentの現行正式仕様
5. SOL MAIN + LUNA worker構成の実現可否
6. 現行AGENTS.mdに追加すべき最小ルール
7. 詳細workflowを別mdへ分離すべきか
8. External Web Review Gateの保存場所と命名
9. GitHubURL.txt Sync Gateで現行構造上不足している項目
10. Stage 1を試すのに適した低リスクPhase候補

提出:
- 現状調査結果
- 提案書との矛盾
- 採用可能項目
- 修正推奨項目
- 実装ファイル案
- 最小導入手順
- rollback手順

Owner承認前には設定・AGENTS.md・agent fileを変更しないでください。
```

---

# 23. Codex実装時の注意

この提案書に含まれるcustom agent設定例・ファイル位置・設定キーは、導入時点のCodex公式仕様を再確認して確定すること。

特に以下は固定知識として扱わない。

- Codex CLI version
- Desktopが実際に使うCLI path
- subagent設定構文
- model ID
- reasoning effort
- sandbox / approval設定
- `CODEX_CLI_PATH` の必要性

実環境を調査したうえで、最小変更で導入する。

---

# 24. 参考となる現行Codex公式方針

2026-08-13時点のOpenAI公式Codex資料では、以下が確認できる。

- Codexはsubagentのspawn、follow-up routing、結果待ち、thread終了をオーケストレーションする。
- local Codexは、直接依頼または適用されるproject / skill instructionに基づきsubagentを起動できる。
- custom subagentごとにmodelとreasoning effortを指定できる。
- `gpt-5.6-sol` は曖昧・複数段階・計画・検証を要する仕事向け。
- `gpt-5.6-luna` は明確・限定的・反復的・高頻度な仕事向け。
- `AGENTS.md` はCodexが作業前に読み込むproject guidanceとして利用できる。
- 複雑なタスクではplan first、完了条件・検証方法を明示することが推奨される。

導入時には必ず最新公式資料を再確認する。

参考:
- OpenAI Codex — Subagents
- OpenAI Codex — Custom instructions with AGENTS.md
- OpenAI Codex — Models
- OpenAI Codex — Best practices

---

# 25. 最終提案

Tegakiでは、以下を初期完成形とする。

```text
Owner
  ↓
SOL MAIN
  │
  ├─ 正本 / 現在地確認
  ├─ 1 Phase計画
  └─ 委譲可否判定
       ↓
   LUNA WORKER
       ↓
   verifier / build
       ↓
SOL MAIN
  ├─ diff監査
  ├─ 設計境界監査
  └─ close候補判定
       ↓
Owner Gate
```

必要な節目のみ:

```text
SOL MAIN
  ↓
External Review Gate提案
  ↓
GitHubURL.txt Sync
  ↓
review request.md 作成
  ↓
commit / push確認
  ↓
Owner
  ↓
Web GPT
  ↓
external review.md
  ↓
SOL MAIN
  ↓
ACCEPT / HOLD / REJECT / OWNER DECISION
  ↓
正式Phaseへ必要なものだけ反映
```

この構成により、

- 日常実装のモデル切替忘れを減らす
- SOLの高コスト利用を設計・監査へ集中させる
- LUNAを明確な実装workerとして利用する
- 必要な節目だけWeb GPTへ広域調査を逃がす
- 外部AIによる仕様暴走を防ぐ
- Ownerの最終統制を維持する

ことを目標とする。

---

## Appendix A — 採用しない初期構成

初期導入では以下を行わない。

- 複数LUNA write agentの並列編集
- Web GPTへの完全自動送信
- Web GPTからCodexへの完全自動回収
- 外部レビューの自動採用
- 複数Phaseの連続自動消化
- Owner Gateの除去
- 全ての実装をLUNAへ固定
- 全レビューをSOL subagentへ分散
- GitHubURL.txtの無制限巨大化

---

## Appendix B — 設計思想

本提案の自動化対象は「判断そのもの」ではなく、主として次の手作業である。

- モデル切替
- 明確な実装の委譲
- 結果回収
- verifier / buildの定型確認
- 外部レビュー用文書準備
- GitHubURL同期確認
- レビュー結果の分類

一方で以下は残す。

- SOLによる設計判断
- Ownerによる最終判断
- 外部レビュー送受信のOwner Gate
- 実制作でしか確認できない項目
- 重大な境界変更時の停止

したがって本提案は「全自動開発」ではなく、**Tegakiの既存Phase開発を維持した、監督付き半自動オーケストレーション**を目的とする。
