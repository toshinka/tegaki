# Phase 5q CAF PREVIEW stroke hit/miss: failed attempts report

Date: 2026-07-03

Repository: `D:\GitHub\tegaki`

Base commit previously reviewed: `418f72913ece74db342380ef0058f8bb05a6f146`

Related files:

- `task-codex/tegaki_phase5q_caf_preview_diagnosis.md`
- `task-codex/phase5q_external_ai_diagnostic_request.md`
- `task-codex/phase5q_external_ai_followup_after_diagnosis.md`
- `task-codex/phase5q_external_ai_GitHubURL.txt`

This report is intended for another external AI review. The attempted fixes below are local working-tree changes and may not exist in GitHub unless separately pushed. Please treat the code snippets and result notes here as the source of truth for the failed attempts.

## Symptom Still Remaining

Animation Table open + `PREVIEW` ON + drawing on active CAF still has "hit / miss" behavior:

- Hit: realtime stroke is visible while drawing.
- Miss: active CAF stroke is not visible during drawing and appears after stroke completion.
- User reports the miss pattern remains "basically the same" after all attempts below.
- This means simple layer/container visibility forcing did not resolve the root cause.

Stable / comparatively stable paths:

- Animation Table closed + Lane onion.
- `PREVIEW` OFF.
- Timeline onion only after previous stabilization.

Important constraints:

- Do not mix preview/onion display-only content into save, export, Layer visibility model state, ClipAsset, DrawingSnapshot, Undo/Redo.
- Do not redesign into WebGPU, SDF/MSDF, WebGL2 Mesh, tiled canvas, Lane full independence, working Layer removal, or LayerSystem/TimelineModel merge.

## Attempt 1: Do Not Restore Visibility On Empty Composite During Stroke

Target file:

- `tegaki_work/ui/animation-table-popup.js`
- Function: `_applyVisibilityPreview()`

Change:

```js
- if (renderedCount === 0 && onionRenderedCount === 0) {
+ if (renderedCount === 0 && onionRenderedCount === 0 && !showSelectedWorkingLayer) {
      this._destroyAnimationPreviewStagingContainers(staging);
      this._restoreVisibility();
      return;
  }
```

Rationale:

- During PREVIEW stroke, selected CAF is intentionally excluded from current-frame preview composite to avoid double display / thickening.
- If there are no other CAF or onion frames to draw, the correct state should still be valid: empty preview + selected CAF working Layer visible.
- Calling `_restoreVisibility()` in this case could produce asymmetric visibility state during stroke.

Validation:

- `node --check tegaki_work\ui\animation-table-popup.js`: passed.
- `npm.cmd run build`: passed.

User result:

- No visible improvement.
- Hit/miss remained effectively unchanged.

Conclusion:

- The previous zero-rendered composite diagnosis was plausible but incomplete or not the root cause.

## Attempt 2: Do Not Rebuild PREVIEW During Stroke-Time Render

Target file:

- `tegaki_work/ui/animation-table-popup.js`

Added helper:

```js
_keepDrawingPreviewWorkingLayerVisible(layerId = null) {
    if (!this.layerSystem) return false;
    this._showSelectedClipWorkingLayers();
    const targetLayerId = layerId || this.layerSystem.getActiveLayer?.()?.layerData?.id || null;
    if (!targetLayerId || !this._isAnimationWorkingLayerId(targetLayerId)) return false;
    return this._forceAnimationWorkingLayerVisible(targetLayerId);
}
```

Changed:

- `_handleBeforeStrokeStart()` calls `_keepDrawingPreviewWorkingLayerVisible(activeLayer.layerData?.id || null)` after `_applyVisibilityPreview()`.
- `_handleDrawingStarted()` calls `_keepDrawingPreviewWorkingLayerVisible(layerId)` after optional preview preparation.
- `render()` path now handles `isDrawingPreviewSuspended && isPreviewActive` by calling `_keepDrawingPreviewWorkingLayerVisible()` instead of entering `_applyVisibilityPreview()` again.

Rationale:

- If Animation Table `render()` fires during stroke, it may rebuild preview and re-hide working Layers.
- Stroke start should prepare the preview state once.
- Stroke-time render should only maintain active CAF working Layer visibility.

Validation:

- `node --check tegaki_work\ui\animation-table-popup.js`: passed.
- `npm.cmd run build`: passed.

User result:

- No visible improvement.
- Hit/miss remained effectively unchanged.

Conclusion:

- Re-entering `_applyVisibilityPreview()` during stroke is probably not the main cause, or another path is making the stroke invisible.

## Attempt 3: Force Stroke Preview Children Visible

Target file:

- `tegaki_work/ui/animation-table-popup.js`
- Function: `_ensureWorkingLayerDisplaySurface(layer)`

Change:

```js
for (const child of layer.children || []) {
    if (!child || (child.label !== 'strokePreview' && child.label !== 'penOpacityStrokePreview')) continue;
    child.visible = true;
    if ('renderable' in child) {
        child.renderable = true;
    }
    if ('culled' in child) {
        child.culled = false;
    }
}
```

Rationale:

- Pen opacity below 100% uses a temporary `penOpacityStrokePreview` sprite during stroke and commits it to the layer RenderTexture only at stroke end.
- The user symptom "stroke appears after completion" looked compatible with the preview child being hidden while the final commit succeeds.
- This attempt explicitly keeps `strokePreview` / `penOpacityStrokePreview` visible without touching unrelated layer children.

Validation:

- `node --check tegaki_work\ui\animation-table-popup.js`: passed.
- `npm.cmd run build`: passed.

User result:

- No visible improvement.
- Hit/miss remained effectively unchanged.

Conclusion:

- It is probably not just `layer.visible`, `layerSprite.visible`, `strokePreview.visible`, or `penOpacityStrokePreview.visible`.
- The stroke may not be rendering into the visible target, may be rendering into a target not connected to the displayed layer, or the displayed layer may be covered / swapped after rendering.

## Current Local Diff Summary

Current uncommitted code changes:

- `tegaki_work/ui/animation-table-popup.js`
  - Attempt 1, 2, and 3 code changes are present.
- `tegaki_work/PROGRESS.md`
  - Notes for Attempt 1, 2, and 3 are present.

Untracked diagnostic documents:

- `task-codex/phase5q_external_ai_GitHubURL.txt`
- `task-codex/phase5q_external_ai_diagnostic_request.md`
- `task-codex/phase5q_external_ai_followup_after_diagnosis.md`
- `task-codex/tegaki_phase5q_caf_preview_diagnosis.md`
- this file

Generated build/cache differences were cleaned after builds:

- `tegaki_work/dist/`: no remaining diff intended.
- `tegaki_work/node_modules/.vite/`: no remaining diff intended.

## Stronger Hypotheses After Failed Attempts

Please inspect these next. The failed attempts suggest the cause is deeper than direct visibility flags.

### Hypothesis A: BrushCore Draws To A Different Layer Than AnimationTable Keeps Visible

Relevant areas:

- `tegaki_work/system/drawing/drawing-engine.js`
  - `_handlePointerDown()`
  - `drawing:before-stroke-start`
  - active layer lookup before `brushCore.startStroke()`
- `tegaki_work/system/drawing/brush-core.js`
  - `startStroke()`
  - `this.strokeTargetLayer = activeLayer`
  - `_renderRealtimePenSegment()`
  - `_commitPenOpacityStroke()`
- `tegaki_work/ui/animation-table-popup.js`
  - `_handleBeforeStrokeStart()`
  - `_syncActiveWorkingLayerToSelectedInternalLayer()`
  - `_getRasterWorkingLayers()`
  - `_getWorkingLayerIdsForClipAsset()`

What to verify:

- Is `BrushCore.strokeTargetLayer.layerData.id` always equal to the working Layer that `_keepDrawingPreviewWorkingLayerVisible()` preserves?
- Can `_syncActiveWorkingLayerToSelectedInternalLayer()` select one working Layer, while the pointer event local coordinate or BrushCore target still uses a previous active Layer?
- Does `_getRasterWorkingLayers()` reverse order ever mismatch the `asset.internalLayers` order after lane/cell switches?

### Hypothesis B: Realtime RenderTexture Updates Succeed But The Displayed Sprite Uses A Different Texture Or Bounds

Relevant areas:

- `BrushCore._renderRealtimePenSegment()`
- `BrushCore._applyLayerRasterRenderOffset()`
- `LayerSystem.restoreLayerRasterSnapshot()`
- `LayerSystem.ensureLayerRasterBoundsForRect()`
- `layer.layerData.renderTexture`
- `layer.layerData.layerSprite.texture`
- `layer.layerData.rasterBounds`

What to verify:

- During a miss, is realtime stroke rendering into `activeLayer.layerData.renderTexture` but the visible `layerSprite.texture` is no longer that same RenderTexture?
- Is `penOpacityState.texture` committed into one RenderTexture while the visible sprite references another?
- Does bounds expansion at stroke start replace or move `layerSprite` / `renderTexture` after AnimationTable has fixed visibility?

### Hypothesis C: PREVIEW Overlay Covers The Active Working Layer

Relevant areas:

- `AnimationTablePopup._ensurePreviewContainer()`
- `animationPreviewBackContainer`
- `animationPreviewContainer`
- `layerSystem.currentFrameContainer`

Current order intended by code:

- background preview before current frame
- back preview before current frame
- current frame container
- front preview after current frame

Current frame composite is generally drawn into back preview, so front should often be empty. But verify:

- During a miss, does `animationPreviewContainer` contain an opaque or same-CAF child above the working Layer?
- Does onion or previous preview state leave front children that cover the active CAF?

### Hypothesis D: Clipping Mask State Makes Realtime Stroke Invisible

Relevant areas:

- `LayerSystem.refreshClippingMasks()`
- `LayerSystem._findClippingSourceLayer()`
- `LayerSystem._applyClippingMaskToLayerChildren()`
- `BrushCore._beginPenOpacityStroke()`

What to verify:

- In a miss, does `penOpacityStrokePreview` or `strokePreview` get a mask that clips it fully away?
- Does `activeLayer.layerData.clippingMaskSprite` exist and match the correct source layer?
- Does `refreshClippingMasks()` run after preview child creation and leave a stale/incorrect mask on that child?

### Hypothesis E: Stroke Is Not Realtime-Applied Until Pointerup In Some Runs

Relevant areas:

- `BrushCore._renderRealtimeStrokePoint()`
- `BrushCore.updateStroke()`
- `BrushCore.updateStrokeBatch()`
- `this.realtimePenApplied`
- `this.penOpacityState`

What to verify:

- In a miss, are `_renderRealtimePenSegment()` calls happening during pointermove?
- Is `realtimePenApplied` false until pointerup?
- Are pointermove/coalesced events being ignored because `brushCore.isActive()` or `activePointers` state differs after table/cell switching?

## Recommended Instrumentation

Please add instrumentation only behind:

```js
window.TEGAKI_CONFIG?.debug === true
```

Suggested log points:

1. `DrawingEngine._handlePointerDown()` after `drawing:before-stroke-start` and before `brushCore.startStroke()`:
   - selected cel id if accessible
   - active layer id/name
   - `isAnimationWorkingLayer`

2. `BrushCore.startStroke()`:
   - `strokeTargetLayer.layerData.id`
   - `renderTexture.uid` or comparable object identity
   - `layerSprite.texture` identity
   - mode, opacity, `penOpacityIsolation`

3. `BrushCore._renderRealtimePenSegment()`:
   - target layer id
   - render target identity
   - whether `penOpacityState` is active
   - segment count
   - set `realtimePenApplied`

4. `AnimationTablePopup._keepDrawingPreviewWorkingLayerVisible()`:
   - target layer id
   - active layer id
   - layer visible/renderable/culled
   - layerSprite visible/renderable/culled
   - child labels and visible/renderable/culled for `strokePreview` / `penOpacityStrokePreview`
   - parent container index relative to preview containers

5. `BrushCore.finalizeStroke()` before commit:
   - `hasRealtimeApplied`
   - `penOpacityState` present
   - target layer id

Expected useful comparison:

- One "hit" stroke log.
- One "miss" stroke log.
- Diff the active layer id, render target identity, child visibility, mask state, and realtime render calls.

## Requested Output From External AI

Please return a downloadable Markdown report containing:

- Whether the failed attempts eliminate the original `_restoreVisibility()` hypothesis.
- The most likely remaining root cause.
- Exact file/function/line-area references.
- A minimal patch proposal.
- Risk notes around save/export/Layer visibility/ClipAsset/DrawingSnapshot/Undo/Redo.
- Suggested debug instrumentation if a patch cannot be justified yet.

