import assert from 'node:assert/strict';

import {
    LAYER_WARP_TRANSACTION_ACTION,
    LAYER_WARP_TRANSACTION_INTENT,
    planLayerWarpEditTransactionFinish,
    planLayerWarpEditTransactionPreview,
    planLayerWarpEditTransactionStart
} from '../system/animation/layer-warp-edit-transaction.js';
import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} from '../system/animation/transform-edit-context.js';

const context = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
    authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY,
    writable: true,
    clipId: 'clip-1',
    timelineFrame: 12,
    localFrame: 4,
    internalLayerId: 'raster-1'
};

const start = planLayerWarpEditTransactionStart({
    context,
    layerId: 'working-raster-1',
    internalLayerId: 'raster-1',
    sourceBounds: { x: 40, y: 50, width: 120, height: 80 },
    duration: 16
});
assert.equal(start.ok, true);
assert.equal(start.candidateDeformer.type, 'control-mesh');
assert.equal(start.candidateDeformer.columns, 4);
assert.equal(start.candidateDeformer.rows, 4);
assert.equal(start.candidateDeformer.bindPoints.length, 16);
assert.equal(start.baselineDeformer, null);
assert.equal(start.candidateDeformer.keyframes.length, 0, 'entry must stay History/key free');

const noChange = planLayerWarpEditTransactionPreview({
    transaction: start,
    context,
    points: start.baselinePoints
});
assert.equal(noChange.action, LAYER_WARP_TRANSACTION_ACTION.PREVIEW_NOOP);
assert.equal(noChange.deformer, null, 'no-op must not materialize the runtime candidate');

const changedPoints = start.baselinePoints.map(point => ({ ...point }));
changedPoints[5].x += 0.1;
const preview = planLayerWarpEditTransactionPreview({
    transaction: start,
    context,
    points: changedPoints
});
assert.equal(preview.ok, true);
assert.equal(preview.action, LAYER_WARP_TRANSACTION_ACTION.PREVIEW);
assert.equal(preview.deformer.keyframes.length, 1);
assert.equal(preview.deformer.keyframes[0].frame, 4);
assert.equal(preview.deformer.keyframes[0].points[5].x, changedPoints[5].x);

const contextChanged = planLayerWarpEditTransactionPreview({
    transaction: start,
    context: { ...context, timelineFrame: 13, localFrame: 5 },
    points: changedPoints
});
assert.equal(contextChanged.ok, false);
assert.equal(contextChanged.reason, 'edit-context-changed');

const commit = planLayerWarpEditTransactionFinish({
    transaction: start,
    context,
    changed: true,
    previewApplied: true
});
assert.equal(commit.action, LAYER_WARP_TRANSACTION_ACTION.COMMIT);
assert.equal(commit.commit, true);

const cancel = planLayerWarpEditTransactionFinish({
    transaction: start,
    context,
    intent: LAYER_WARP_TRANSACTION_INTENT.CANCEL,
    changed: true,
    previewApplied: true
});
assert.equal(cancel.action, LAYER_WARP_TRANSACTION_ACTION.ROLLBACK);
assert.equal(cancel.commit, false);

const noOpFinish = planLayerWarpEditTransactionFinish({
    transaction: start,
    context,
    changed: false,
    previewApplied: false
});
assert.equal(noOpFinish.action, LAYER_WARP_TRANSACTION_ACTION.CLOSE_NOOP);

const invalidStart = planLayerWarpEditTransactionStart({
    context: { ...context, authority: TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY },
    layerId: 'working-raster-1',
    internalLayerId: 'raster-1',
    sourceBounds: { x: 40, y: 50, width: 120, height: 80 },
    duration: 16
});
assert.equal(invalidStart.ok, false);

const advancedDeformer = {
    ...start.candidateDeformer,
    columns: null,
    rows: null
};
const advancedStart = planLayerWarpEditTransactionStart({
    context,
    layerId: 'working-raster-1',
    internalLayerId: 'raster-1',
    sourceBounds: { x: 40, y: 50, width: 120, height: 80 },
    existingDeformer: advancedDeformer,
    duration: 16
});
assert.equal(advancedStart.ok, false);
assert.equal(advancedStart.reason, 'advanced-layer-warp-required');

console.log('Layer WARP edit transaction verifier passed.');
