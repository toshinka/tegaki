# Phase 5q CAF preview stroke hit/miss follow-up request

## Context

Repository: `D:\GitHub\tegaki`

Base commit inspected by the previous diagnosis: `418f72913ece74db342380ef0058f8bb05a6f146`

Target symptom:

- Animation Table open
- `PREVIEW` ON
- Multiple CAF/Lane cases, but sometimes even simple cases
- Drawing on the active CAF sometimes shows realtime stroke correctly
- Sometimes the active CAF drawing disappears during stroke and appears only after stroke end
- Other CAF preview generally remains visible
- User describes this as "当たり / ハズレ"

Known good-ish cases:

- Animation Table closed + Lane onion: no comparable flicker
- `PREVIEW` OFF paths are much more stable
- Timeline onion only path was previously stabilized

## Previous external diagnosis

File: `task-codex/tegaki_phase5q_caf_preview_diagnosis.md`

Main hypothesis was:

`AnimationTablePopup._applyVisibilityPreview()` returned through `_restoreVisibility()` when `renderedCount === 0 && onionRenderedCount === 0`, even during stroke where the selected CAF is intentionally excluded from the preview composite and should instead be displayed as working Layer.

## Fixes attempted after that diagnosis

### Attempt 1

Changed:

```js
if (renderedCount === 0 && onionRenderedCount === 0) {
```

to:

```js
if (renderedCount === 0 && onionRenderedCount === 0 && !showSelectedWorkingLayer) {
```

Rationale:

- During PREVIEW stroke, selected CAF is excluded from composite to avoid double-thick preview + working Layer.
- If there are no other CAF/onion items, this should still be a valid empty-preview + selected working Layer display state.
- It should not call `_restoreVisibility()` during stroke.

Result reported by user:

- Hit/miss remained basically unchanged.

### Attempt 2

Added `AnimationTablePopup._keepDrawingPreviewWorkingLayerVisible(layerId = null)`.

The helper:

- calls `_showSelectedClipWorkingLayers()`
- resolves active / provided animation working Layer ID
- calls `_forceAnimationWorkingLayerVisible()`

Then:

- `_handleBeforeStrokeStart()` uses the helper after `_applyVisibilityPreview()`
- `_handleDrawingStarted()` uses the helper after optional preview prep
- `render()` path now does this during `isDrawingPreviewSuspended && isPreviewActive`:

```js
this._keepDrawingPreviewWorkingLayerVisible();
```

instead of re-entering `_applyVisibilityPreview()`.

Rationale:

- If an Animation Table render happens during stroke, it should not rebuild preview composition and risk hiding the active working Layer.
- Stroke start prepares preview once; stroke-time render should only maintain the selected working Layer visibility.

Result:

- Not yet validated by user at the time this follow-up was written.

## Current question for review

If Attempt 2 still does not fix the hit/miss behavior, please inspect these likely remaining causes:

1. Whether the active working Layer that `BrushCore.strokeTargetLayer` holds is always the same layer that `AnimationTablePopup` preserves and makes visible.
2. Whether `DrawingEngine._handlePointerDown()` computing `localCoords` before `drawing:before-stroke-start` can leave any stale active-layer state that later affects stroke routing or coordinate conversion.
3. Whether `BrushCore.startStroke()` emits `drawing:stroke-started` before `previewGraphics` / `penOpacityStrokePreview` is added, and whether a second post-preview-ready event is needed for AnimationTable to force visibility after those children exist.
4. Whether `LayerSystem.refreshClippingMasks()` can set `layerData.layerSprite.visible = false` for animation working Layers and leave the active layer visually blank even though the layer container is visible.
5. Whether `animationPreviewContainer` / `animationPreviewBackContainer` ordering can cover the active working Layer in some frame, especially when front container is non-empty due to onion/other preview state.
6. Whether `_getRasterWorkingLayers()` reverse-order mapping can mismatch `asset.internalLayers` order after lane/cell switches, causing the preserved working Layer IDs to refer to a different internal layer than the actual stroke target.

## Requested output

Please return a downloadable Markdown report containing:

- whether Attempt 1 and Attempt 2 are logically sound
- the most likely remaining root cause
- exact file/function/line-area references
- a minimal patch proposal
- risk notes around save/export/Layer visibility/ClipAsset/DrawingSnapshot/Undo/Redo
- any instrumentation logs to add behind `window.TEGAKI_CONFIG.debug === true`

