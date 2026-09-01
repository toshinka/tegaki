import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} from '../system/animation/transform-edit-context.js';
import {
    TRANSFORM_EDIT_TRANSACTION_ACTION,
    TRANSFORM_EDIT_TRANSACTION_INTENT,
    TRANSFORM_EDIT_TRANSACTION_OWNER,
    planTransformEditTransactionFinish,
    planTransformEditTransactionPreview,
    planTransformEditTransactionStart,
    validateTransformEditTransactionContext
} from '../system/animation/transform-edit-transaction.js';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

const sourceContext = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.SOURCE,
    authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE,
    writable: true,
    reason: null,
    timelineFrame: 4
};
const readyContext = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
    authority: TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY,
    writable: true,
    reason: null,
    clipId: 'clip-a',
    timelineFrame: 14,
    localFrame: 4,
    keyIndex: -1,
    hasExplicitKey: false
};
const keyedContext = {
    ...readyContext,
    mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED,
    keyIndex: 0,
    hasExplicitKey: true
};
const blockedContext = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.BLOCKED,
    authority: TRANSFORM_EDIT_AUTHORITY.NONE,
    writable: false,
    reason: 'playback-active'
};

const source = planTransformEditTransactionStart({ context: sourceContext, layerId: 'layer-a' });
assert.equal(source.ok, true);
assert.equal(source.owner, TRANSFORM_EDIT_TRANSACTION_OWNER.LAYER_SYSTEM);
assert.equal(source.historyOwner, 'layer-source');

assert.equal(planTransformEditTransactionStart({
    context: blockedContext,
    layerId: 'working-a'
}).reason, 'playback-active');

const layerStart = {
    x: 10,
    y: -5,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    anchorX: 0.45,
    anchorY: 0.55
};
const clipSample = {
    x: 100,
    y: 80,
    scaleX: 1.5,
    scaleY: -0.5,
    rotation: 0.2,
    opacity: 0.8,
    blendMode: 'multiply',
    blendStrength: 0.6,
    anchorX: 0.45,
    anchorY: 0.55
};
const keyframes = [{
    frame: 1,
    interpolation: 'hold',
    x: 90,
    y: 80,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 0.8,
    blendMode: 'normal',
    blendStrength: 1
}];
const beforeKeys = JSON.stringify(keyframes);
const beforeClipSample = JSON.stringify(clipSample);

const animate = planTransformEditTransactionStart({
    context: readyContext,
    layerId: 'working-a',
    clipSample,
    keyframes,
    duration: 8
});
assert.equal(animate.ok, true);
assert.equal(animate.owner, TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE);
assert.equal(animate.clipId, 'clip-a');
assert.equal(animate.localFrame, 4);
assert.equal(animate.baselinePolicy, 'implicit-sampler-until-first-change');
assert.equal(animate.hadExplicitKey, false);
assert.equal(animate.duration, 8);
assert.deepEqual(animate.baselineTransform, clipSample);
assert.notEqual(animate.baselineTransform, clipSample);
assert.deepEqual(animate.baselineKeyframes, keyframes);
assert.notEqual(animate.baselineKeyframes, keyframes);
assert.equal(JSON.stringify(clipSample), beforeClipSample);
assert.equal(JSON.stringify(keyframes), beforeKeys);

assert.equal(planTransformEditTransactionStart({
    context: readyContext,
    layerId: 'working-a',
    activeTransaction: animate,
    clipSample,
    duration: 8
}).reason, 'transform-transaction-active');
assert.equal(planTransformEditTransactionStart({
    context: readyContext,
    layerId: 'working-a',
    clipSample,
    duration: 1
}).reason, 'animated-duration-required');
assert.equal(planTransformEditTransactionStart({
    context: readyContext,
    layerId: 'working-a',
    duration: 8
}).reason, 'clip-transform-baseline-required');

assert.equal(validateTransformEditTransactionContext(animate, keyedContext).ok, true,
    'READY to KEYED transition on the same Clip Frame must remain in one transaction');
assert.equal(validateTransformEditTransactionContext(animate, {
    ...keyedContext,
    clipId: 'clip-b'
}).reason, 'clip-target-changed');
assert.equal(validateTransformEditTransactionContext(animate, {
    ...keyedContext,
    timelineFrame: 15,
    localFrame: 5
}).reason, 'frame-target-changed');
assert.equal(validateTransformEditTransactionContext(animate, blockedContext).reason, 'edit-context-changed');

const noChangePreview = planTransformEditTransactionPreview({
    transaction: animate,
    context: readyContext,
    layerStart,
    layerCurrent: { ...layerStart }
});
assert.equal(noChangePreview.ok, true);
assert.equal(noChangePreview.action, TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_ANIMATE_NOOP);
assert.equal(noChangePreview.changed, false);
assert.deepEqual(noChangePreview.keyframes, keyframes);
assert.notEqual(noChangePreview.keyframes, keyframes, 'no-op preview must not expose the live keyframe array');

const changedPreview = planTransformEditTransactionPreview({
    transaction: animate,
    context: readyContext,
    layerStart,
    layerCurrent: {
        ...layerStart,
        x: 35,
        y: 10,
        scaleX: -0.5,
        scaleY: 2,
        rotation: 0.5
    }
});
assert.equal(changedPreview.ok, true);
assert.equal(changedPreview.action, TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_ANIMATE);
assert.equal(changedPreview.changed, true);
assert.deepEqual(changedPreview.delta, {
    x: 25,
    y: 15,
    scaleX: -0.5,
    scaleY: 2,
    rotation: 0.5
});
assert.equal(changedPreview.key.frame, 4);
assert.equal(changedPreview.transform.x, 125);
assert.equal(changedPreview.transform.y, 95);
assert.equal(changedPreview.transform.scaleX, -0.75);
assert.equal(changedPreview.transform.scaleY, -1);
assert.equal(changedPreview.transform.opacity, clipSample.opacity);
assert.equal(changedPreview.transform.blendMode, clipSample.blendMode);
assert.equal(JSON.stringify(keyframes), beforeKeys, 'preview planner must not mutate stored Clip keys');
const repeatedPreview = planTransformEditTransactionPreview({
    transaction: animate,
    context: keyedContext,
    layerStart,
    layerCurrent: {
        ...layerStart,
        x: 35,
        y: 10,
        scaleX: -0.5,
        scaleY: 2,
        rotation: 0.5
    }
});
assert.deepEqual(repeatedPreview.keyframes, changedPreview.keyframes,
    'repeated preview must recompute from the fixed baseline instead of accumulating live samples');

const anchorBlocked = planTransformEditTransactionPreview({
    transaction: animate,
    context: readyContext,
    layerStart,
    layerCurrent: { ...layerStart, anchorX: 0.5 }
});
assert.equal(anchorBlocked.reason, 'anchor-edit-not-frame-local');
assert.equal(anchorBlocked.rollback, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE);

const sourcePreview = planTransformEditTransactionPreview({
    transaction: source,
    context: sourceContext,
    layerStart,
    layerCurrent: { ...layerStart, x: layerStart.x + 2 }
});
assert.equal(sourcePreview.action, TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_SOURCE);
assert.equal(sourcePreview.changed, true);

assert.equal(planTransformEditTransactionPreview({
    transaction: animate,
    context: { ...readyContext, timelineFrame: 15, localFrame: 5 },
    layerStart,
    layerCurrent: { ...layerStart, x: 20 }
}).rollback, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE);

const animateCommit = planTransformEditTransactionFinish({
    transaction: animate,
    context: keyedContext,
    intent: TRANSFORM_EDIT_TRANSACTION_INTENT.CONFIRM,
    changed: true,
    previewApplied: true
});
assert.equal(animateCommit.action, TRANSFORM_EDIT_TRANSACTION_ACTION.COMMIT_ANIMATE);
assert.equal(animateCommit.commit, true);
assert.equal(animateCommit.historyOwner, 'timeline');

const animateCancel = planTransformEditTransactionFinish({
    transaction: animate,
    context: keyedContext,
    intent: TRANSFORM_EDIT_TRANSACTION_INTENT.CANCEL,
    changed: true,
    previewApplied: true
});
assert.equal(animateCancel.action, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE);
assert.equal(animateCancel.commit, false);

const returnedToStart = planTransformEditTransactionFinish({
    transaction: animate,
    context: keyedContext,
    changed: false,
    previewApplied: true
});
assert.equal(returnedToStart.action, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE);
assert.equal(returnedToStart.reason, 'returned-to-start');

assert.equal(planTransformEditTransactionFinish({
    transaction: animate,
    context: readyContext,
    changed: false,
    previewApplied: false
}).action, TRANSFORM_EDIT_TRANSACTION_ACTION.CLOSE_ANIMATE_NOOP);
assert.equal(planTransformEditTransactionFinish({
    transaction: animate,
    context: { ...readyContext, clipId: 'clip-b' },
    changed: true,
    previewApplied: true
}).action, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE);
assert.equal(planTransformEditTransactionFinish({
    transaction: source,
    context: sourceContext,
    changed: true,
    previewApplied: true
}).action, TRANSFORM_EDIT_TRANSACTION_ACTION.CONFIRM_SOURCE);
assert.equal(planTransformEditTransactionFinish({
    transaction: source,
    context: sourceContext,
    intent: TRANSFORM_EDIT_TRANSACTION_INTENT.CANCEL,
    changed: true,
    previewApplied: true
}).action, TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_SOURCE);

const helperSource = read('system/animation/transform-edit-transaction.js');
assert.doesNotMatch(helperSource, /historyManager|eventBus|localStorage|setClipTransformKeyframes|render\(/);
assert.match(helperSource, /planClipTransformFromLayerGesture/);
assert.match(helperSource, /planClipTransformKeyUpsert/);

console.log('Phase 9p Transform edit transaction verifier passed.');
