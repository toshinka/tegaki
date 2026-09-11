# TEGAKI Local Handoff GUI V1

`TEGAKI-HANDOFF-GUI-V1` is a small, local-only Card/Report palette around the
existing Handoff V0.1 path. It has two visually separate, independently stored
lanes:

```text
H3 / CODEX    [H3 -> CODEX]     [H3 -> WEBGPT]
MANGA / GEMINI [MANGA -> GEMINI] [MANGA -> WEBGPT]
```

The GUI is deliberately manual:

```text
CONSULTATION != CARD
CARD = explicit envelope + explicit user staging + explicit LUNA start
```

The tools do not watch conversations, start agents, run Card text, call a
localhost service, press Enter, navigate a browser, or push Git refs. A button
press may prepare clipboard text. Optional `Focus + paste` performs only a
fail-closed window-title match and explicit Ctrl+V; it never sends Enter or
Ctrl+Enter. Card and Report files are local plaintext and must not contain
secrets.

## Owner flow

1. Double-click `tools/tegaki-handoff/TEGAKI_HANDOFF_GUI.cmd`.
2. Select the intended lane and press its explicit `Stage ... Card` button.
3. In the intended agent say `handoffを読んで実行`.
4. Use `Copy ... Report` or `Paste Return` only when the report is ready.
5. Paste into the intended WebGPT window manually.

The older console menu remains available at
`tools/tegaki-handoff/TEGAKI_HANDOFF.cmd` for V0.1-compatible operation.

Copying surrounding SOL prose is safe only when the Card uses the explicit
`<<<TEGAKI_CARD_BEGIN>>>` / `<<<TEGAKI_CARD_END>>>` wrapper. A pure Card
clipboard remains supported, but surrounding prose without that wrapper is
rejected.

## Runtime layout

The tools create this ignored runtime directory at the repository root:

```text
.tegaki-handoff/
  to_luna/current_card.md
  from_luna/latest_report.md
  archive/cards/
  archive/reports/
  state.json
  manga/
    to_gemini/current_card.md
    from_gemini/latest_report.md
    archive/cards/
    archive/reports/
    state.json
```

The H3 lane preserves the existing V0.1 storage and validation. Manga accepts
only a valid `TEGAKI_CARD_V2` with `CHANNEL: MANGA`, `TARGET: GEMINI`, and a
`MANGA-` Card ID. Only one current Card and one latest Report are active per
lane. Older material is archived when a new valid Card is staged.
`.tegaki-handoff/` is ignored and is never a tracked IPC or product-source
change.

GUI settings are persisted outside the repository at
`%LOCALAPPDATA%\TEGAKI-Handoff\settings.json`. They contain only the selected
repo root, window position, Always-on-top state, and four non-secret target
window title tokens.

## Tracked tools

The normal Owner entry point is the double-clickable palette:

```text
tools/tegaki-handoff/TEGAKI_HANDOFF_GUI.cmd
```

The underlying V0.1 helpers can still be run from the repository root with
Windows PowerShell or PowerShell:

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

The deterministic GUI verifier is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -STA -File tools/tegaki-handoff/verify_handoff_gui.ps1
```

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

Handoff intentionally still requires the Owner to:

1. copy an explicitly issued SOL Card;
2. stage it in the matching GUI lane;
3. tell LUNA `handoffを読んで実行`;
4. after completion, prepare the matching report transfer;
5. paste the Report into SOL.

This removes repetitive long-form transfer work but does not remove human
authorization. LUNA may edit files, run tests, and create one local commit
after successful validation. LUNA must not push, update remote refs, create a
PR, or force push. The Owner reviews and pushes manually.

## Safety and scope

This GUI V1 has no workflow engine, queue, daemon, clipboard watcher, localhost
HTTP service, native messaging, Chrome extension, tray app, or automatic Codex
execution. It does not modify H3, Manga, workflows, runtime/backend/model
files, or output directories. `PUSH NOT PERFORMED — OWNER ACTION REQUIRED` is
the required publication statement for the completion report.
