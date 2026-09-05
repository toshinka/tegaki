# Tegaki External Web Review Request

このtemplateはWeb版GPT / Claude等へsecond opinionを依頼する時に複製して使う。外部AIはlocal未commit差分を閲覧できないため、Ownerが対象commitのpushを確認してから送る。

## 1. Review identity

- Request ID: `YYYY-MM-DD_phase_or_topic_review_N`
- Review purpose:
- Target branch: `main` / `<branch>`
- Target commit SHA:
- Push state: `PUSHED AND WEB-READABLE` / `NOT PUSHED — DO NOT REVIEW`
- Current Phase:
- Owner decision needed:

`Push state`が`PUSHED AND WEB-READABLE`でない場合は依頼を送らない。

## 2. Read order

1. `AGENTS.md`
2. `TEGAKI.md`
3. `tegaki_work/PROGRESS.md`
4. current `task-codex/phase*.md`
5. review対象に必要なproposal / source / verifierだけ

URL入口:

https://raw.githubusercontent.com/toshinka/tegaki/refs/heads/main/tegaki_work/GitHubURL.txt

GitHubURLはnavigationであり、上記正本の優先順位を上書きしない。記載URLはbranch固定ではなくmainを指すため、review対象が別branchの場合は対象commitのGitHub URLを別途列挙する。

## 3. Scope

### Review questions

1.
2.
3.

### Required source / verifier URLs

- 

### Known constraints

- 既存差分、保存正本、History、Layer / CAF / Rig / Mesh境界を推測で変更しない。
- 完了済みArchiveを暗黙に再OPENしない。
- 実在するfile・event・classと照合できない提案は仮説と明記する。
- `GitHubURL.txt`に無いlocal変更を読めたと扱わない。

### Out of scope

- 

## 4. Requested response

指摘を重要度順に、各項目について次を返す。

- Finding ID
- Severity: `BLOCKER / HIGH / MEDIUM / LOW / NOTE`
- Evidence: file / symbol / URL
- Why it matters
- Minimal recommendation
- Boundary impact: save / History / Layer / CAF / Rig / Mesh / export / Browser / none
- Confidence: high / medium / low
- Owner decision needed: yes / no

最後に全体判定を一つ返す。

- `ACCEPT`
- `ACCEPT WITH MODIFICATION`
- `HOLD`
- `REJECT`
- `OWNER DECISION`

外部AIはコードを直接変更せず、review reportだけを返す。

## 5. Codex return Gate

Ownerがreportをrepoへ保存した後、SOLが実コードへ照合して各Findingを次に分類する。

- 採用
- 修正して採用
- 保留
- 不採用
- Owner判断待ち

採用項目も現行Phaseへ自動投入せず、対象Phase・根拠・検証を明記してから実装する。
