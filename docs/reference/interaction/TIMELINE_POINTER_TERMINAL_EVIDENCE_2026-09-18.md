STATUS: REFERENCE
DATE: 2026-09-18

This is a dated runtime/static interaction evidence record.
It is not an implementation Card.
It is not current product authority.
Current implementation state remains owned by STATUS / TECHNICAL / the current Work Package / production code.

---

# Timeline Pointer Terminal & Retime Performance Evidence

## 1. Metadata & Baseline

- **Date:** 2026-09-18
- **Baseline HEAD:** `9330b227 update` (verified against `3b952a2f update`)
- **Diagnostic Purpose:** Verify whether older Timeline / Layer pointer gestures treat abnormal termination (`pointercancel`) as successful completion (in contrast to newer WARP / Motion rollback semantics), and measure whether Retime performs uncoalesced render work during sub-frame pointer movements.
- **Production Files Touched:** NONE (verification and evidence only; no production code refactored or repaired).
- **Diagnostic Verifier Paths:**
  - Automated Node.js verifier: `tegaki_work/build/verify-timeline-pointer-terminal.mjs`
  - Browser diagnostic page: `tegaki_work/build/timeline-pointer-terminal-diagnostic.html`

---

## 2. Interaction Terminal Results

### Clip Move
- **normal pointerup:** Clip startFrame changed from 0 to 5; exactly 1 history command (`caf-clip-move`) committed; preview classes cleaned up.
- **pointercancel:** Clip startFrame changed from 0 to 5; exactly 1 history command (`caf-clip-move`) committed on cancel; preview classes cleaned up.
- **lost capture:** NOT TESTED (production Clip Move does not set pointer capture).
- **Escape:** NOT TESTED (Escape triggers table close; no gesture-level cancel hook exists).
- **Classification:** **RUNTIME CONFIRMED** (Static finding confirmed: `_onClipMoveMouseUp` handles both `pointerup` and `pointercancel` without inspecting `e.type`, executing drop and history on cancel).

### Retime / Trim
- **normal pointerup:** Duration updated from 4 to 8; exactly 1 history command (`caf-clip-retime`) committed; handles cleaned up.
- **pointercancel:** Duration remains 8 (original duration 4 was NOT restored); exactly 1 history command (`caf-clip-retime`) committed on cancel; no rollback executed.
- **lost capture:** NOT TESTED (production Retime does not set pointer capture).
- **Escape:** NOT TESTED (Escape triggers table close; no gesture rollback hook exists).
- **Classification:** **RUNTIME CONFIRMED** (Static finding confirmed: `_onRetimingMouseUp` does not inspect `e.type` and does not restore `laneSnapshot`, persisting live mutations and creating history on `pointercancel`).

### Old Motion Key Drag
- **normal pointerup (moved=true):** Target key frame 4 committed; exactly 1 history command (`caf-motion-key-move`) committed; gesture state cleaned up.
- **pointercancel (moved=true):** Target key frame 4 committed on cancel; exactly 1 history command committed; rollback NOT called.
- **lost capture:** NOT TESTED (production Motion Key Drag does not set pointer capture).
- **Escape:** NOT TESTED (no key drag Escape hook).
- **Classification:** **RUNTIME CONFIRMED** (Static finding confirmed: handler branches on `if (gesture.moved)` before evaluating `else if (upEvent.type === 'pointercancel')`, committing displacements $\ge 3\text{px}$ on cancellation).

### Layer Panel Card D&D
- **normal pointerup:** `onDrop` executed (reorder/reparent applied); exactly 1 history command recorded; ghost and indicators cleaned up.
- **pointercancel:** `onDrop` executed on cancel; exactly 1 history command recorded; ghost and indicators cleaned up.
- **lost capture:** NOT TESTED (production Layer Panel Card D&D does not set pointer capture).
- **Escape:** NOT TESTED (layer panel keydown only listens for F2 rename; no Escape cancel).
- **Classification:** **RUNTIME CONFIRMED** (Static finding confirmed: `_handleLayerPanelCardPointerUp` checks `if (drag.active)` without checking `e.type`, executing drop on cancel).

### Lane Reorder
- **Static Contract:**
  - Pointer capture: NONE (no `setPointerCapture` call).
  - `pointercancel` listener: NOT REGISTERED (only `pointermove` and `pointerup` are registered to `document`).
  - Terminal behavior on cancel: `pointercancel` is ignored; `onMove` and `onUp` listeners leak on `document`, and `.is-lane-drag-source` / `.lane-drop-*` indicators remain uncleaned.
- **Classification:** **STATIC CONFIRMED** (Runtime probe confirmed listener and visual state leaks on cancel).

---

## 3. Retime Performance & Semantic Coalescing Counters

Measured across a 4-movement sequence where clientX traverses within the same quantized frame delta before stepping into the next frame (`timelineCellWidth = 16px`):
- Move 1: clientX 164 (`deltaFrames = 4`, semantic delta change)
- Move 2: clientX 165 (`deltaFrames = 4`, sub-frame redundant)
- Move 3: clientX 166 (`deltaFrames = 4`, sub-frame redundant)
- Move 4: clientX 180 (`deltaFrames = 5`, semantic delta change)

```text
pointerMoves:          4
semanticFrameChanges:  2
previewUpdates:        4
renders:               4
render ratio:          2.0x
commits:               0 (during active drag)
cancels:               0
rowCount:              1
frameCount:            24
totalRenderDurationMs: 0.012 ms
maxRenderDurationMs:   0.006 ms
```

**Classification:** **RUNTIME CONFIRMED** (`_onRetimingMouseMove` invokes `_applyRetimingWithPush` and `this.render()` on every single pointer event, regardless of whether `Math.round(deltaX / timelineCellWidth)` produced a new frame delta).

---

## 4. Synthetic Event Limitation Note

A programmatically dispatched `PointerEvent("pointercancel")` verifies the application code contract and internal event routing. It proves what the code does when cancellation occurs. It does NOT measure how frequently real OS, browser, or hardware cancellation occurs under palm rejection, pen-tip lift, touch arbitration, or window blur. Real device trigger frequency is an environmental question outside this contract evidence.

---

## 5. Summary Table

| Gesture | Normal pointerup | pointercancel | Lost Capture | Escape | Status |
|---|---|---|---|---|---|
| **Clip Move** | Commits drop + history | **Commits drop + history** | Not tested | Not tested | **RUNTIME CONFIRMED** |
| **Retime / Trim** | Commits retime + history | **Retains mutation + history** | Not tested | Not tested | **RUNTIME CONFIRMED** |
| **Motion Key Drag** | Commits key move + history | **Commits if moved >= 3px** | Not tested | Not tested | **RUNTIME CONFIRMED** |
| **Layer Panel D&D** | Executes drop + history | **Executes drop + history** | Not tested | Not tested | **RUNTIME CONFIRMED** |
| **Lane Reorder** | Commits reorder | **Ignored; leaks listeners** | None | Not tested | **STATIC CONFIRMED** |
| **Retime Coalescing** | Renders every move | N/A | N/A | N/A | **RUNTIME CONFIRMED (2.0x)** |
