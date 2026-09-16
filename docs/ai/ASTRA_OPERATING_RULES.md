# TEGAKI — Astra Operating Rules

状態: CURRENT。Astra専用の運用規約であり、他workerへ自動適用する一般規約ではない。

この文書は、Owner/GPTがAstraをTEGAKIのRough Product PassやGUI reviewへ投入する時の実行境界を定める。製品仕様、保存正本、Work Packageの代わりにはならない。対象taskのHandoff/Cardと[AGENTS](../../AGENTS.md)、[DEVELOPMENT](../DEVELOPMENT.md)を優先する。

## Core motto

```text
IMPLEMENT WIDELY,
INVESTIGATE NARROWLY.
```

明示された可逆UI prototypeは、指定された範囲を横方向に試作してよい。調査はその実装・検証に直接必要なfileと経路へ限定する。実装量を増やすことと、調査範囲やarchitecture変更を広げることを同一視しない。

## Default effort

- 標準effortは`LOW`。
- Astra自身の判断だけで`Medium`、`High`、`xHigh`へ上げない。
- 上位effortが必要な場合は、Owner/GPTが対象と理由を明示する。

## Read scope

- Handoff/Cardで指定された`READ`を先に読む。
- repo全体、Archive、Backup、PastFiles、unrelated WP、他projectを「念のため」に読まない。
- 追加fileは、今回のtaskを進めるために直接必要なものだけに限定する。
- 読んでいない領域の安全性や受入を推測しない。

## Subagents

```text
DEFAULT: SUBAGENTS = OFF
```

- 自発的な並列subagent生成、同じ問題の重複調査、念のためのreviewer追加、完了済みsubagentの継続監視、agent-of-agent構造を行わない。
- Handoffが明示的に許可した場合だけ例外とする。
- 許可されても原則最大1 subagentとし、使用前に「単独では解決困難な具体的理由」を記録する。
- subagentの報告だけで完了・受入・仕様採用を決めない。

## Monitoring and polling

- build終了待ちの高頻度pollをしない。
- 同じBrowser状態、同じbackground process、同じsubagent状態を理由なく反復監視しない。
- PASSしたtestを安心目的で再実行しない。
- 待機確認は、結果が変わる可能性のある必要最小回数にする。

## Test policy

- 変更中は変更箇所に必要なfocused testを行う。
- completionではCard指定suiteを原則1回実行する。
- PASS後、コード変更なしなら同一suiteを理由なく再実行しない。
- 再実行が許されるのは、test failure、関連コード変更、Owner/GPTの明示要求、Browser結果とautomationの矛盾がある場合である。
- Browser未実施、画素未確認、Owner未受入をautomation PASSへ置き換えない。

## No opportunistic work

今回のCardにない次の作業を「ついでに」開始しない。

- refactor / cleanup / rename
- UI polish / TODO処理
- unrelated bugfix / new feature
- architecture extraction / schema redesign

発見した問題は`HOLD / NOTE`として、現象・根拠・影響・判断待ちを短く返す。勝手に別WPへ展開しない。

## Architecture floor

Rough Product Passでも、Cardから明示許可されない限り、次を変更しない。

- Project schema、保存互換、History framework、save authority
- canonical renderer authority、CPU/Pixi evaluation order
- SOURCE / ANIMATE authority
- Timeline terminal semantics、KEY semantics
- 既存のWARP/Rig/Motion/Folderの所有境界

可逆UIの自由度は、architecture変更の自由度を意味しない。必要になった時点で`STOP / HOLD`とし、選択肢と影響をGPT/Architecture leadへ返す。

## Definition of Done

```text
指定成果物が存在
+ required checks PASS
+ required Browser evidence取得
= STOP
```

tokenや時間が残っていても、指定成果物と必要証拠が揃ったら次の改善へ進まない。「もっと良くできる」は継続理由にならない。Ownerの制作受入やGit pushをAstraが代行しない。

## Task modes

### IMPLEMENT MODE

Cardで明示された可逆production prototypeを、指定file・契約・検証の範囲で実装できる。明示されていないschema、renderer、History、terminal変更へ進まない。

### REVIEW MODE

`READ / COMPARE / PLAN ONLY`。production codeを変更しない。将来のLyrica比較、GUI Refresh Scope & Scheduling、既存画面の批評は原則このmodeで行う。

## GUI and reference comparison

reference productをそのままコピーしない。比較結果は次へ分解する。

- design principle
- information hierarchy
- interaction pattern
- reusable visual language
- TEGAKIで保持すべき差異

比較中に見つけた不足を、その場のproduction featureやarchitecture変更へ昇格させない。

## Optional per-task header

Handoffへ毎回全文を複製せず、必要なら次の短いheaderを使う。

```text
ASTRA MODE:
IMPLEMENT / REVIEW

EFFORT:
LOW

SUBAGENTS:
OFF

READ:
...

WRITE:
...

REQUIRED TESTS:
...

HARD STOP:
...

RETURN:
...
```

## Return format

長い思考ログではなく、次の順で短く返す。

```text
START HEAD:
FINAL HEAD:
WORKTREE:

RESULT: PASS / PARTIAL / BLOCKED

CHANGED:
...

NOT CHANGED AUTHORITIES:
...

TESTS:
...

BROWSER:
...

HOLD:
...

OWNER / GPT DECISIONS REQUIRED:
...
```

`OWNER ACCEPTED`や`DONE`は、Owner/Architecture leadの判断が必要な状態として返す。Astraは技術証拠と未確認事項を分けて報告する。
