# TEGAKI GUI Sensei Research — Research Bank index

**Suggested repository location:** `docs/reference/gui-sensei/README.md`  
**Status:** REFERENCE / Research Bank / Not production authority / Not an implementation Card.  
**Read selectively.** This folder is not a required context load for every implementation task. The current Work Package, STATUS/TECHNICAL, product code, and scoped Card govern implementation. Older study hypotheses do not override explicit later Owner decisions.

## Browser drawing WebSOL handoff

For a new WebSOL chat taking over the browser drawing tool (not ComfyUIPortable/Manga/H3), read [the browser drawing handoff](TEGAKI_BROWSER_DRAWING_WEBSOL_HANDOFF.md), then the [GUI component conventions](TEGAKI_GUI_COMPONENT_CONVENTIONS.md). Check the latest Codex report and live HEAD/worktree before choosing one next Card. The component conventions describe current Transform practice, not a permanent app-wide style specification.

## Reading map

| Task | Read first | Optional background |
|---|---|---|
| Drawing/Transform/WARP compact GUI | `TEGAKI_GUI_SENSEI_RESEARCH_03_2026-09-20.md` to `_05_...md` | `_01_...md`, `_02_...md` |
| Animation UI / playback mental model | `_06_...md`, `_07_...md` | `_01_...md`, `_02_...md` |
| Existing frame indicator and navigation guard | `_11_...md` | `_08_...md` to `_10_...md`; use current source and latest Luna evidence for actual state |
| Visual references and example screenshots | `_12_...md` | official screenshots/manual links within it; companion PNGs in this folder |
| Bottom Dock, right-hand controls, status | `_15_...md` and `_14_...md` | `_13_...md`, `_12_...md` |
| Future Left preset | `_13_...md` §5 | Revalidate against the future Bottom Dock implementation |

## Files and media

The complete filenames retain the prefix `TEGAKI_GUI_SENSEI_RESEARCH_` and ascending two-digit sequence `01`–`15`. The shorthand `_05_...md` above means the complete matching filename, not a literal path. Keep these existing local references working when moving the series:

- `TEGAKI_GUI_CURRENT_TRANSFORM_TABLE_2026-09-20.png`
- `TEGAKI_GUI_CURRENT_RIG_TABLE_2026-09-20.png`
- `TEGAKI_GUI_CURRENT_TABLE_DRAWING_2026-09-20.png`

They are Owner-provided comparison images, not official teacher-app screenshots. The distribution ZIP bundles are optional and need not be checked into the repository. External teacher URLs remain in each research document; their content/version can change. Older absolute storage-path text in research01–14 describes the former `docs/` location and should be normalized in a **separate documentation-only task** after moving. Cross-references elsewhere in the repo may also need update.

## Current constraints carried forward

- Canvas first, Single Right Workspace replaces rather than adds another side panel.
- Bottom Animation Table Dock first; Collapsed/Compact/Expanded; Left preset later.
- One visible playback/Frame-control group across table states. KEY commit remains a distinct terminal.
- Timeline zoom `33%` belongs to the timeline; preserve existing wheel behavior, display compact zoom controls at the Dock's bottom right; left bottom for information.
- Common Status keeps one owner and is allotted real layout space, not merely raised with z-index.
- Futaba maroon/cream via `tegaki_work/styles/main.css` semantic tokens.
- Legacy RIG Workspace remains as a capability reservoir until replacement operations have been proven.

## Current next evidence gap

Read-only local extraction of `animation-table-popup.js` Zoom/wheel/footer/transport/drag/resize and browser geometry; see research15 §3. Research15's external code evidence is pinned to public commit `ebdf0efdc5da6e292879e4fb48aa8d59b49f987b`; verify actual local HEAD/worktree before implementing. Do not represent this folder as verified current production behavior.
