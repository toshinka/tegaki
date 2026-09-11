# TEGAKI Local Handoff V0

`TEGAKI-HANDOFF-V0` is a small, local-only Card/Report return path between
Web-GPT/SOL and Codex/LUNA. It is deliberately manual:

```text
CONSULTATION != CARD
CARD = explicit envelope + explicit user staging + explicit LUNA start
```

The tools do not watch conversations, start agents, run Card text, call a
localhost service, or push Git refs. Card and Report files are local plaintext
and must not contain secrets.

## Runtime layout

The tools create this ignored runtime directory at the repository root:

```text
.tegaki-handoff/
  to_luna/current_card.md
  from_luna/latest_report.md
  archive/cards/
  archive/reports/
  state.json
```

Only one current Card and one latest Report are active. Older material is
archived when a new valid Card is staged. `.tegaki-handoff/` is ignored and is
never a tracked IPC or product-source change.

## Tracked tools

Run these from the repository root with Windows PowerShell or PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/init_handoff.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/stage_card_from_clipboard.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/show_handoff_status.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/copy_report_to_clipboard.ps1
```

`-RepoRoot <path>` is available for a controlled local test repository. The
default resolves the Git root from the tool location.

`init_handoff.ps1` is idempotent. It creates directories and an `IDLE` state
only when no current Card or Report exists; it never overwrites active state.
`show_handoff_status.ps1` is read-only and warns when the current HEAD differs
from the Card BASE_SHA.

## Card envelope

The staging helper accepts only a Card whose first line and near-top fields are
all present:

```text
TEGAKI_CARD_V1
CARD_ID: EXAMPLE-001
TARGET: LUNA
BASE_SHA: <full 40-character SHA>
EXECUTION: EXPLICIT_HUMAN_START
PUSH: FORBIDDEN
AUTO_RUN: FORBIDDEN

Card body follows here as text only.
```

It rejects consultation text, missing or duplicate fields, non-LUNA targets,
non-human execution, AUTO_RUN enabled, non-forbidden PUSH, malformed BASE_SHA,
and a BASE_SHA that does not exactly match the current repository HEAD. It
fails closed before replacing the current Card and never rebase/pull/reset or
interprets embedded commands.

The manual LUNA start phrase is:

```text
handoffを読んで実行
```

Its meaning is to read only `.tegaki-handoff/to_luna/current_card.md`, verify
the envelope, Card ID, BASE_SHA, `READY` state, and current repository safety,
then execute only that Card. Do not execute archive files or infer work from
earlier conversation text.

## Report return contract

After executing a staged Card, LUNA preserves the normal bounded completion
report in chat and also writes:

```text
.tegaki-handoff/from_luna/latest_report.md
```

The Report begins with:

```text
TEGAKI_REPORT_V1
CARD_ID: <same Card ID>
RESULT: PASS | PASS WITH LIMIT | BLOCKED | FAILED
```

LUNA updates `state.json` to `REPORTED`. The copy helper validates the Report
envelope, allowed result, and exact CARD_ID match with state, then copies the
whole Report to the Owner clipboard without deleting it. A mismatch is
rejected.

## Human workflow

V0 intentionally still requires the Owner to:

1. copy an explicitly issued SOL Card;
2. run the staging helper;
3. tell LUNA `handoffを読んで実行`;
4. after completion, run the report-copy helper;
5. paste the Report into SOL.

This removes repetitive long-form transfer work but does not remove human
authorization. LUNA may edit files, run tests, and create one local commit
after successful validation. LUNA must not push, update remote refs, create a
PR, or force push. The Owner reviews and pushes manually.

## Safety and scope

This V0 has no workflow engine, queue, daemon, watcher, localhost HTTP service,
native messaging, Chrome extension, GUI, tray app, or automatic Codex
execution. It does not modify H3, Manga, workflows, runtime/backend/model
files, or output directories. `PUSH NOT PERFORMED — OWNER ACTION REQUIRED` is
the required publication statement for a Handoff V0 completion report.
