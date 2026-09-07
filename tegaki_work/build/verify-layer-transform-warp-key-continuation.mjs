/**
 * WP-005: execute the WARP continuation helpers with an isolated production
 * host. The pure transaction checks keep the committed model baseline and the
 * host checks keep panel/V ownership outside the explicit KEY terminal.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
import {
    isTransformTimelineKeyTarget,
    TRANSFORM_EDIT_TRANSACTION_TARGET
} from '../system/animation/transform-edit-transaction.js';

const layerSystemSource = readFileSync(new URL('../system/layer-system.js', import.meta.url), 'utf8');
const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');

function methodSource(source, name, next) {
    const start = source.indexOf(`\n    ${name}(`);
    const end = source.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source boundary`);
    return source.slice(start, end);
}

function compileMethod(source, name, next, dependencies = {}) {
    const names = Object.keys(dependencies);
    return new Function(...names, `return ({${methodSource(source, name, next)}}).${name};`)(
        ...names.map(name => dependencies[name])
    );
}

const resumeWarp = compileMethod(
    layerSystemSource,
    '_resumeLayerWarpTimelineSession',
    '_commitLayerWarpTimelineKeyAndContinue',
    { isTransformTimelineKeyTarget }
);
const commitWarp = compileMethod(
    layerSystemSource,
    '_commitLayerWarpTimelineKeyAndContinue',
    'commitLayerTransformTimelineKeyAndContinue'
);
const stepWarp = compileMethod(
    layerSystemSource,
    '_stepLayerWarpTimelineFrame',
    'refreshLayerTransformTimelineSessionAfterHistory'
);
const refreshWarp = compileMethod(
    layerSystemSource,
    'refreshLayerWarpTimelineSessionAfterHistory',
    'exitLayerMoveMode'
);
const abandonWarp = compileMethod(
    popupSource,
    '_abandonLayerWarpBridgeAfterHistory',
    '_createLayerTransformKeyGuide'
);

const target = TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_LAYER_TRANSFORM_KEY;
const warpTarget = 'clip-layer-deformer-key';

function makeTransaction(frame = 1) {
    return {
        kind: 'layer-warp-edit-transaction',
        target: warpTarget,
        layerId: 'working-raster',
        clipId: 'clip-1',
        internalLayerId: 'internal-raster',
        timelineFrame: frame,
        localFrame: frame,
        duration: 3
    };
}

function makeHost({ changed = true } = {}) {
    const events = [];
    const committedPoints = [{ x: 0, y: 0 }];
    const host = {
        events,
        history: 0,
        finishCalls: 0,
        stepCalls: 0,
        warpBegins: 0,
        overlayDeactivations: 0,
        modeFallbacks: 0,
        panelExitCalls: 0,
        committedPoints,
        _layerTransformSession: {
            layerId: 'working-raster',
            transaction: { target },
            previewResult: { changed: false }
        },
        _layerWarpEditSession: {
            kind: 'animate',
            layerId: 'working-raster',
            transaction: makeTransaction(),
            changed,
            points: changed ? [{ x: 0.25, y: 0.5 }] : committedPoints.map(point => ({ ...point }))
        },
        finishLayerWarpEditSession({ cancelled } = {}) {
            this.finishCalls += 1;
            const session = this._layerWarpEditSession;
            assert(session, 'finish only releases the current WARP session');
            this._layerWarpEditSession = null;
            if (!cancelled && session.changed === true) {
                this.committedPoints = session.points.map(point => ({ ...point }));
                this.history += 1;
                return { ok: true, commit: true, target: warpTarget };
            }
            return { ok: true, commit: false, target: warpTarget };
        },
        _resumeLayerWarpTimelineSession: resumeWarp,
        _emitPanelUpdateRequest() {
            this.panelUpdates = (this.panelUpdates || 0) + 1;
        },
        eventBus: {
            emit(name, payload) {
                events.push({ name, payload });
            }
        },
        transform: {
            warpController: {
                begin() {
                    host.warpBegins += 1;
                    host._layerWarpEditSession = {
                        kind: 'animate',
                        layerId: 'working-raster',
                        transaction: {
                            ...makeTransaction(host.timelineFrame ?? 1),
                            baselinePoints: host.committedPoints.map(point => ({ ...point }))
                        },
                        changed: false,
                        points: host.committedPoints.map(point => ({ ...point }))
                    };
                    return true;
                }
            },
            deactivateWarpOverlay() {
                host.overlayDeactivations += 1;
            },
            setTransformMode(mode) {
                if (mode === 'basic') host.modeFallbacks += 1;
            }
        }
    };
    return host;
}

// New-key commit remains one History record and does not use the V terminal.
const confirmed = makeHost({ changed: true });
confirmed._commitLayerWarpTimelineKeyAndContinue = commitWarp;
assert.equal(commitWarp.call(confirmed), true);
assert.equal(confirmed.history, 1);
assert.equal(confirmed.finishCalls, 1);
assert.equal(confirmed.warpBegins, 1);
assert.equal(confirmed.panelExitCalls, 0);
assert.equal(confirmed._layerWarpEditSession.changed, false);
assert.deepEqual(confirmed._layerWarpEditSession.transaction.baselinePoints, confirmed.committedPoints);
assert.equal(confirmed.events.filter(event => event.name === 'layer:transform-key-committed').length, 1);

// A stable state cannot manufacture a key or History entry.
const noop = makeHost({ changed: false });
assert.equal(commitWarp.call(noop), false);
assert.equal(noop.finishCalls, 0);
assert.equal(noop.history, 0);

// Stable WARP releases the old transaction, uses the existing WP-003 mover,
// and starts a fresh target-Frame WARP transaction. Pending WARP cannot move.
const frameHost = makeHost({ changed: false });
frameHost.timelineFrame = 1;
frameHost.stepLayerTransformTimelineFrame = delta => {
    frameHost.stepCalls += 1;
    frameHost.timelineFrame += delta;
    return true;
};
assert.equal(stepWarp.call(frameHost, 1), true);
assert.equal(frameHost.finishCalls, 1);
assert.equal(frameHost.history, 0);
assert.equal(frameHost.stepCalls, 1);
assert.equal(frameHost.warpBegins, 1);
assert.equal(frameHost._layerWarpEditSession.transaction.timelineFrame, 2);
const pendingFrameHost = makeHost({ changed: true });
pendingFrameHost.stepLayerTransformTimelineFrame = () => {
    throw new Error('pending WARP must not delegate Frame movement');
};
assert.equal(stepWarp.call(pendingFrameHost, 1), false);
assert.equal(pendingFrameHost.finishCalls, 0);
assert.equal(pendingFrameHost.history, 0);

// The pure transaction baseline proves that Esc after a second edit restores
// the just-confirmed key, not the WARP-entry state.
const context = {
    mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
    authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY,
    writable: true,
    clipId: 'clip-1',
    timelineFrame: 1,
    localFrame: 1,
    internalLayerId: 'internal-raster'
};
const first = planLayerWarpEditTransactionStart({
    context,
    layerId: 'working-raster',
    internalLayerId: 'internal-raster',
    sourceBounds: { x: 0, y: 0, width: 10, height: 10 },
    duration: 3
});
const pointsA = first.baselinePoints.map((point, index) => ({
    x: point.x + (index === 5 ? 0.1 : 0),
    y: point.y
}));
const previewA = planLayerWarpEditTransactionPreview({ transaction: first, context, points: pointsA });
assert.equal(previewA.changed, true);
const confirmedStart = planLayerWarpEditTransactionStart({
    context: { ...context, mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED },
    layerId: 'working-raster',
    internalLayerId: 'internal-raster',
    sourceBounds: { x: 0, y: 0, width: 10, height: 10 },
    existingDeformer: previewA.deformer,
    duration: 3
});
assert.equal(confirmedStart.hadExplicitKey, true);
assert.deepEqual(confirmedStart.baselinePoints, pointsA);
const pointsB = confirmedStart.baselinePoints.map((point, index) => ({
    x: point.x + (index === 6 ? 0.1 : 0),
    y: point.y
}));
const previewB = planLayerWarpEditTransactionPreview({
    transaction: confirmedStart,
    context: { ...context, mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED },
    points: pointsB
});
assert.equal(previewB.changed, true);
const cancelB = planLayerWarpEditTransactionFinish({
    transaction: confirmedStart,
    context: { ...context, mode: TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED },
    intent: LAYER_WARP_TRANSACTION_INTENT.CANCEL,
    changed: true,
    previewApplied: true
});
assert.equal(cancelB.commit, false);
assert.deepEqual(confirmedStart.baselinePoints, pointsA);

// Undo/Redo must abandon the old stable bridge without restoring it, then use
// the restored model as the fresh WARP baseline.
const historyHost = makeHost({ changed: false });
let abandonedTransaction = null;
historyHost._transformEditAdapter = {
    abandonWarpAfterHistory({ transaction }) {
        abandonedTransaction = transaction;
        return true;
    }
};
assert.equal(refreshWarp.call(historyHost), true);
assert.equal(abandonedTransaction.kind, 'layer-warp-edit-transaction');
assert.equal(historyHost.overlayDeactivations, 1);
assert.equal(historyHost.warpBegins, 1);
assert.equal(historyHost.history, 0);

const popupHost = {
    _layerWarpBridgeSession: { transaction: { id: 'warp-1' }, changed: false },
    _animationPreviewKey: 'cached'
};
assert.equal(abandonWarp.call(popupHost, { transaction: popupHost._layerWarpBridgeSession.transaction }), true);
assert.equal(popupHost._layerWarpBridgeSession, null);
assert.equal(popupHost._animationPreviewKey, null);

console.log('WP-005 WARP KEY continuation: commit/refresh/baseline/frame-step/pending guard passed (isolated production host).');
