# TEGAKI Local Handoff GUI V1B

`TEGAKI-HANDOFF-GUI-V1B` is a small, local-only Owner palette around the
existing Handoff V0.1 Card/Report path. It deliberately keeps H3 and Manga
independent:

```text
H3 / CODEX       [H3 -> CODEX]       [H3 -> WEBGPT]
MANGA / GEMINI   [MANGA -> GEMINI]   [MANGA -> WEBGPT]
```

There is no clipboard watcher, auto-poll, agent execution, browser automation,
Enter/Ctrl+Enter, Send-button click, localhost service, Chrome extension, or
push. An explicit route button prepares the clipboard and may foreground one
uniquely matched configured window for Ctrl+V only. Missing or ambiguous targets
leave the valid text on the clipboard and require manual paste.

## Normal Owner flow

H3:

1. Cardをコピー
2. `カードを取り込む`
3. `Codexへ渡す`
4. Ownerが手動で送信
5. Agent完了後に `結果をH3 WebGPTへ戻す`
6. Ownerが手動で送信

Manga:

1. Cardをコピー
2. `カードを取り込む`
3. `Geminiへ渡す`
4. Ownerが手動で送信
5. Agent完了後に `結果をManga WebGPTへ戻す`
6. Ownerが手動で送信

明示的な操作以外でクリップボードは変更されません。`NO AUTO SEND` は
常時の安全条件です。

## GUI

Double-click:

```text
tools/tegaki-handoff/TEGAKI_HANDOFF_GUI.cmd
```

The normal palette exposes exactly three actions per lane. `接続先設定...`
opens the four simple window-title substring settings:

```text
Codexウィンドウ
H3 WebGPTウィンドウ
Geminiウィンドウ
Manga WebGPTウィンドウ
```

The palette is a normal movable, minimizable, closable window. `常に手前に
表示` defaults to ON and can be toggled immediately. The repository root is
visible and `変更...` accepts only a path validated by `git rev-parse
--show-toplevel`.

Settings are stored outside Git at
`%LOCALAPPDATA%\TEGAKI-Handoff\settings.json`. Only the repository root,
window position, TopMost state, and non-secret title tokens are stored.

## Safe transfer contracts

Run transfers include the route prefix and explicit safety text. H3 uses only
the current validated H3 Card, does not infer from earlier chat, does not run
Manga work, does not push, and requires human send. Manga uses only the current
validated Manga Card, does not resume older Manga Cards, retains
`M3B_PRODUCTION_CLOSED` as authoritative unless the current Card changes it,
does not run H3 work, does not push, and requires human send.

Return transfers retain the complete validated Report text and append a route
specific audit instruction. H3 asks WebGPT to confirm GitHub/main when
publication is expected and independently audit diff, implementation,
evidence, limitations, and scope. Manga asks for an independent GitHub/main
and Manga SSOT/boundary review, keeps product implementation HOLD unless
explicitly authorized, and does not resume unrelated history.

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

H3 preserves the V0.1 paths and accepts both `TEGAKI_CARD_V1` with
`TARGET: LUNA` and `TEGAKI_CARD_V2` with `CHANNEL: H3`, `TARGET: LUNA`. Manga
accepts only V2 with `CHANNEL: MANGA`, `TARGET: GEMINI`, and a `MANGA-` Card ID.
Each lane validates its own BASE_SHA and archives only its own prior state.

## Tracked tools and verification

The older console menu remains available at
`tools/tegaki-handoff/TEGAKI_HANDOFF.cmd` for V0.1-compatible manual use. The
underlying helpers are:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/init_handoff.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/stage_card_from_clipboard.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/show_handoff_status.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tegaki-handoff/copy_report_to_clipboard.ps1
```

The deterministic verifier exercises generated Run/Return strings and actual
isolated H3 V1, H3 V2, and Manga V2 staging, including a native WinForms
runtime smoke and the completed-Report/HEAD-drift contract:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -STA -File tools/tegaki-handoff/verify_handoff_gui.ps1
```

`PUSH NOT PERFORMED — OWNER ACTION REQUIRED` is the required publication
statement for a Handoff completion report. Owner reviews and pushes manually.
