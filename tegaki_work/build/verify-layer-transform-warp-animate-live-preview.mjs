import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    LAYER_WARP_TRANSACTION_INTENT,
    planLayerWarpEditTransactionFinish,
    planLayerWarpEditTransactionPreview,
    planLayerWarpEditTransactionStart
} from '../system/animation/layer-warp-edit-transaction.js';
import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} from '../system/animation/transform-edit-context.js';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');
const popup = read('ui/animation-table-popup.js');
const layerSystem = read('system/layer-system.js');

function methodSource(source, name, next) {
    const start = source.indexOf(`\n    ${name}(`);
    const end = source.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source boundary`);
    return source.slice(start, end);
}

const warpGuide = new Function(`return ({${methodSource(
    popup,
    '_createLayerWarpKeyGuide',
    '_createLayerWarpProjection'
)}})._createLayerWarpKeyGuide;`)();
const warpProjection = new Function(`return ({${methodSource(
    popup,
    '_createLayerWarpProjection',
    '_projectLayerTransformBridgeStart'
)}})._createLayerWarpProjection;`)();

const transactionBase = {
    kind: 'layer-warp-edit-transaction',
    layerId: 'working-layer',
    clipId: 'clip-1',
    internalLayerId: 'raster-1',
    timelineFrame: 4,
    localFrame: 4,
    duration: 8
};
const guide = warpGuide({ transaction: transactionBase, hasExplicitKey: false, pending: true });
assert.deepEqual(guide, {
    visible: true,
    timelineFrame: 4,
    localFrame: 4,
    hasExplicitKey: false,
    pending: true,
    canMovePrevious: false,
    canMoveNext: false
});
const projectionHost = { _createLayerWarpKeyGuide: warpGuide };
const pendingProjection = warpProjection.call(projectionHost, {
    transaction: transactionBase,
    hasExplicitKey: false,
    pending: true
});
assert.equal(pendingProjection.label, 'ANIMATE · F5 WARP 未確定');
assert.equal(pendingProjection.keyGuide.pending, true);
const keyedProjection = warpProjection.call(projectionHost, {
    transaction: transactionBase,
    hasExplicitKey: true,
    pending: true
});
assert.equal(keyedProjection.label, 'ANIMATE · F5 WARP KEYED · 未確定変更');
assert.equal(keyedProjection.keyGuide.hasExplicitKey, true);

const context = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
    authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY,
    writable: true,
    clipId: 'clip-1',
    timelineFrame: 4,
    localFrame: 4,
    internalLayerId: 'raster-1'
};
const start = planLayerWarpEditTransactionStart({
    context,
    layerId: 'working-layer',
    internalLayerId: 'raster-1',
    sourceBounds: { x: 0, y: 0, width: 16, height: 16 },
    duration: 8
});
assert.equal(start.ok, true);
assert.equal(start.hadExplicitKey, false);
const points = start.baselinePoints.map((point, index) => ({
    x: point.x + (index === 5 ? 2 : 0),
    y: point.y
}));
const preview = planLayerWarpEditTransactionPreview({
    transaction: start,
    context,
    points
});
assert.equal(preview.ok, true);
assert.equal(preview.changed, true);
assert.equal(start.hadExplicitKey, false, 'candidate preview must not rewrite key provenance');
const finish = planLayerWarpEditTransactionFinish({
    transaction: start,
    context,
    intent: LAYER_WARP_TRANSACTION_INTENT.CONFIRM,
    changed: true,
    previewApplied: true
});
assert.equal(finish.commit, true);
const cancel = planLayerWarpEditTransactionFinish({
    transaction: start,
    context,
    intent: LAYER_WARP_TRANSACTION_INTENT.CANCEL,
    changed: true,
    previewApplied: true
});
assert.equal(cancel.commit, false);

assert.match(popup, /isAnimateLayerWarpPreview[\s\S]*?_applyVisibilityPreview\(\)/,
    'active ANIMATE WARP must use the existing Pixi preview path');
assert.match(popup, /_createLayerWarpKeyGuide/);
assert.match(popup, /transaction\.hadExplicitKey === true/);
assert.match(popup, /KEYED · 未確定変更/);
assert.match(popup, /layerWarpMarkerDeformer[\s\S]*?baselineLayerDeformers/);
assert.match(layerSystem, /_commitLayerWarpTimelineKeyAndContinue\(\)[\s\S]*?finishLayerWarpEditSession\(\{ cancelled: false \}\)[\s\S]*?_resumeLayerWarpTimelineSession\(\)/,
    'explicit WARP confirm must finish the transaction and start a fresh same-Frame session');
assert.doesNotMatch(methodSource(layerSystem, 'commitLayerTransformTimelineKeyAndContinue', 'stepLayerTransformTimelineFrame'),
    /exitLayerMoveMode\(\{ cancelled: false \}\)/,
    'explicit WARP confirm must not use the V terminal');
assert.match(layerSystem, /_stepLayerWarpTimelineFrame\(delta\)[\s\S]*?finishLayerWarpEditSession\(\{ cancelled: false \}\)[\s\S]*?stepLayerTransformTimelineFrame\(direction\)[\s\S]*?_resumeLayerWarpTimelineSession\(\)/,
    'stable WARP Frame step must release, move through WP-003, and resume WARP');
assert.match(layerSystem, /refreshLayerWarpTimelineSessionAfterHistory\(\)[\s\S]*?abandonWarpAfterHistory[\s\S]*?_resumeLayerWarpTimelineSession\(\)/,
    'Undo/Redo refresh must abandon the old WARP bridge before starting a fresh session');

console.log('ANIMATE Layer WARP live preview/status/explicit-confirm verifier passed.');
