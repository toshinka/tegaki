# TEGAKI Local Handoff GUI V1C

`TEGAKI-HANDOFF-GUI-V1C` is a small, local-only, return-only Owner palette.
It deliberately keeps H3 and Manga independent:

```text
H3 / CODEX       latest Report -> [H3 -> WEBGPT]
MANGA / GEMINI   latest Report -> [MANGA -> WEBGPT]
```

There is no clipboard watcher, auto-poll, agent execution, browser automation,
Enter/Ctrl+Enter, Send-button click, localhost service, Chrome extension, or
push. The GUI only returns a new valid local Report. It may foreground one
uniquely matched configured WebGPT window for Ctrl+V only; missing or ambiguous
targets leave the complete valid payload on the clipboard for manual paste.

## Normal Owner flow

H3:

1. H3 WebGPTからCardをコピー
2. Cardを直接Codex/LUNAへ貼り付け、Ownerが手動で送信
3. LUNAが`.tegaki-handoff/from_luna/latest_report.md`へReportを書く
4. 新しい結果が表示されたら`結果をH3 WebGPTへ戻す`
5. OwnerがWebGPTで手動送信

Manga:

1. Manga WebGPTからCardをコピー
2. Cardを直接Antigravity/Geminiへ貼り付け、Ownerが手動で送信
3. Geminiが`.tegaki-handoff/manga/from_gemini/latest_report.md`へReportを書く
4. 新しい結果が表示されたら`結果をManga WebGPTへ戻す`
5. OwnerがWebGPTで手動送信

通常のForward経路にHandoff GUIのStage/Agent転送は不要です。Cardの
`CARD_ID`、`TARGET`/`CHANNEL`、`BASE_SHA`、`PUSH: FORBIDDEN`、
`AUTO_RUN: FORBIDDEN`はAgent側で検証します。明示的な操作以外で
クリップボードは変更されません。`NO AUTO SEND`は常時の安全条件です。

## GUI

Double-click:

```text
tools/tegaki-handoff/TEGAKI_HANDOFF_GUI.cmd
```

The normal palette exposes exactly one primary Return action per lane. `接続先設定...`
opens only the two WebGPT window-title substring settings:

```text
H3 WebGPTウィンドウ
Manga WebGPTウィンドウ
```

The palette is a normal movable, minimizable, closable window. `常に手前に
表示` defaults to ON and can be toggled immediately. The repository root is
visible and `変更...` accepts only a path validated by `git rev-parse
--show-toplevel`.

Settings are stored outside Git at
`%LOCALAPPDATA%\TEGAKI-Handoff\settings.json`. The file stores the repository
root, window position, TopMost state, non-secret WebGPT title tokens, and the
SHA-256/card ID of the last Report explicitly prepared for return. A valid
Report with a different exact digest is shown as `新しい結果あり`; the same
digest is `返却済み` and its button is disabled.

## Safe transfer contracts

Return transfers retain the complete validated Report text and append a route
specific audit instruction. H3 asks WebGPT to confirm GitHub/main when
publication is expected and independently audit diff, implementation, evidence,
limitations, and scope. Manga asks for an independent GitHub/main and Manga
SSOT/boundary review, keeps product implementation HOLD unless explicitly
authorized, and does not resume unrelated history.

The Return button is enabled only for `新しい結果あり`. `結果なし`,
`返却済み`, and `報告ファイル不正` are disabled. A duplicate direct helper
call fails with `REPORT ALREADY RETURNED`. The digest is recorded only after
the Owner explicitly invokes Return and the complete payload is placed on the
clipboard; a clipboard failure does not mark the Report returned. If the target
window is missing or ambiguous, the payload remains ready for manual paste and
may still be marked returned.

## Runtime layout

The tools create this ignored local directory at the repository root:

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

The old Handoff V0.1 paths remain available for legacy/debug use. The
return-only GUI does not require `current_card.md`, staged `READY` state, or a
matching `BASE_SHA`; it principally validates the Report envelope and exact
Report digest. H3 Reports use `.tegaki-handoff/from_luna/latest_report.md` and
Manga Reports use `.tegaki-handoff/manga/from_gemini/latest_report.md`.

## Tracked tools and verification

Legacy/debug helpers remain available, but they are not part of the normal
GUI flow. The older console menu is at `tools/tegaki-handoff/TEGAKI_HANDOFF.cmd`
and the underlying helpers are:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/init_handoff.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/stage_card_from_clipboard.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/show_handoff_status.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/copy_report_to_clipboard.ps1
```

The deterministic verifier exercises an isolated return-only matrix for both
lanes: no-result, new-result detection, digest tracking, duplicate blocking,
same-Card changed Reports, malformed/invalid Reports, manual target fallback,
clipboard failure, and native WinForms control/enablement smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -STA -File tools/tegaki-handoff/verify_handoff_gui.ps1
```

`PUSH NOT PERFORMED — OWNER ACTION REQUIRED` is the required publication
statement for a Handoff completion report. Owner reviews and pushes manually.
