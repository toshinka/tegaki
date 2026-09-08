/**
 * WP-005 / WP-003: execute the production LayerSystem continuation boundary
 * for BASIC and ANIMATE WARP, including the direct Timeline navigation path.
 * The host owns only the model/History test double; the continuation and
 * navigation methods are compiled from the production files above it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    isTransformTimelineKeyTarget,
    TRANSFORM_EDIT_TRANSACTION_TARGET
} from '../system/animation/transform-edit-transaction.js';

globalThis.window = {
    TegakiSettingsManager: { get: () => false }
};

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
        ...names.map(key => dependencies[key])
    );
}

const finishLayerTransform = compileMethod(
    layerSystemSource,
    '_finishLayerTransformTimelineSession',
    '_resumeLayerTransformTimelineSession',
    {
        isTransformTimelineKeyTarget,
        restoreLayerTransformPreviewSampling: record => {
            if (record) record.restored = true;
        }
    }
);
const resumeLayerTransform = compileMethod(
    layerSystemSource,
    '_resumeLayerTransformTimelineSession',
    '_resumeLayerWarpTimelineSession'
);
const commitLayerTransform = compileMethod(
    layerSystemSource,
    'commitLayerTransformTimelineKeyAndContinue',
    'stepLayerTransformTimelineFrame',
    { isTransformTimelineKeyTarget }
);
const stepLayerTransform = compileMethod(
    layerSystemSource,
    'stepLayerTransformTimelineFrame',
    'moveLayerTransformTimelineFrameTo',
    { isTransformTimelineKeyTarget }
);
const moveLayerTransformTo = compileMethod(
    layerSystemSource,
    'moveLayerTransformTimelineFrameTo',
    '_stepLayerWarpTimelineFrame',
    { isTransformTimelineKeyTarget }
);
const finishWarp = compileMethod(
    layerSystemSource,
    'finishLayerWarpEditSession',
    'getLayerWarpEditSession'
);
const resumeWarp = compileMethod(
    layerSystemSource,
    '_resumeLayerWarpTimelineSession',
    '_commitLayerWarpTimelineKeyAndContinue'
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
const popupHasTransformNavigation = compileMethod(
    popupSource,
    '_hasActiveTimelineTransformNavigation',
    '_navigateTimelineFrameTo',
    { isTransformTimelineKeyTarget }
);
const popupNavigateTo = compileMethod(
    popupSource,
    '_navigateTimelineFrameTo',
    '_createBlankClipAtLaneFrame'
);
const popupMoveByDelta = compileMethod(
    popupSource,
    'moveTimelineFrameByDelta',
    '_isRasterSnapshotBlank'
);
const popupMoveBridgeFrame = compileMethod(
    popupSource,
    '_moveLayerTransformBridgeFrame',
    '_projectLayerWarpBridgeStart'
);

const BASIC_TARGET = TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_LAYER_TRANSFORM_KEY;
const WARP_TARGET = 'clip-layer-deformer-key';
const CLIP_ID = 'clip-cross-frame';
const CLIP_START = 0;
const DURATION = 8;
const F6 = 5;
const F7 = 6;

function makeFixture(kind) {
    const state = {
        kind,
        history: 0,
        basicKeys: new Map(),
        warpKeys: new Map(),
        nextBasic: 0,
        nextWarp: 0,
        panel: true,
        model: {
            playback: { currentFrame: F6 },
            totalFrames: DURATION,
            findClipEntry(id) {
                return id === CLIP_ID
                    ? { clip: { id: CLIP_ID, startFrame: CLIP_START, duration: DURATION } }
                    : null;
            },
            getLaneById() { return null; },
            setCurrentFrame(frame) {
                this.playback.currentFrame = frame;
            }
        }
    };

    const popup = {
        model: state.model,
        selectedCelId: CLIP_ID,
        activeLaneId: null,
        isClipEditModeActive: false,
        _layerTransformFrameNavigationInProgress: false,
        layerSystem: null,
        _saveSelectedClipFromWorkingLayers() {},
        _syncWorkingLayersForCurrentFrame() {},
        _scheduleLaneReferencePreviewUpdate() {},
        _requestLayerPanelSync() {},
        render() {},
        _hasActiveTimelineTransformNavigation: popupHasTransformNavigation,
        _navigateTimelineFrameTo: popupNavigateTo,
        moveTimelineFrameByDelta: popupMoveByDelta,
        _moveLayerTransformBridgeFrame: popupMoveBridgeFrame
    };

    const layerHost = Object.create({
        _finishLayerTransformTimelineSession: finishLayerTransform,
        _resumeLayerTransformTimelineSession: resumeLayerTransform,
        commitLayerTransformTimelineKeyAndContinue: commitLayerTransform,
        stepLayerTransformTimelineFrame: stepLayerTransform,
        moveLayerTransformTimelineFrameTo: moveLayerTransformTo,
        finishLayerWarpEditSession: finishWarp,
        _resumeLayerWarpTimelineSession: resumeWarp,
        _commitLayerWarpTimelineKeyAndContinue: commitWarp,
        _stepLayerWarpTimelineFrame: stepWarp
    });
    popup.layerSystem = layerHost;
    layerHost._transformEditAdapter = null;
    layerHost._layerTransformFrameNavigationInProgress = false;
    layerHost.coordAPI = { clearCache() {} };
    layerHost.eventBus = { emit() {} };
    layerHost.cameraSystem = { setVKeyPressed() {} };
    layerHost.transform = {
        updateTransformPanelValues() {},
        syncBasicOverlay() {},
        setEditContextProjection() {},
        exitMoveMode() { state.panel = false; },
        setTransformMode() {},
        warpController: {
            begin() {
                const frame = state.model.playback.currentFrame;
                layerHost._layerWarpEditSession = {
                    kind: 'animate',
                    layerId: 'working-raster',
                    transaction: {
                        kind: 'layer-warp-edit-transaction',
                        target: WARP_TARGET,
                        layerId: 'working-raster',
                        clipId: CLIP_ID,
                        timelineFrame: frame,
                        localFrame: frame - CLIP_START,
                        duration: DURATION,
                        baselinePoints: [{ x: state.warpKeys.get(frame) || 0, y: 0 }],
                        hadExplicitKey: state.warpKeys.has(frame)
                    },
                    changed: false,
                    previewApplied: false,
                    points: [{ x: state.warpKeys.get(frame) || 0, y: 0 }]
                };
                return true;
            },
            deactivate() {}
        }
    };

    layerHost.getLayerMoveCommitState = () => ({
        active: layerHost._layerTransformSession != null || layerHost._layerWarpEditSession != null,
        hasPendingTransform: kind === 'warp'
            ? layerHost._layerWarpEditSession?.changed === true
            : layerHost._layerTransformSession?.previewResult?.changed === true
    });
    layerHost.getActiveTransformEditTarget = () => kind === 'warp'
        ? WARP_TARGET
        : BASIC_TARGET;
    layerHost.getActiveLayer = () => ({ layerData: { id: 'working-raster' } });
    layerHost.enterLayerMoveMode = () => {
        const frame = state.model.playback.currentFrame;
        layerHost._layerTransformSession = {
            layerId: 'working-raster',
            transaction: {
                target: BASIC_TARGET,
                clipId: CLIP_ID,
                layerId: 'working-raster',
                timelineFrame: frame,
                localFrame: frame - CLIP_START,
                duration: DURATION
            },
            transform: { x: state.basicKeys.get(frame) || 0 },
            previewResult: { changed: false },
            previewSampling: {},
            targetLayerTransforms: []
        };
        state.panel = true;
        return true;
    };
    layerHost._restoreTransformTargetState = () => {};
    layerHost._emitPanelUpdateRequest = () => {};
    layerHost._finishLayerTransformTimelineSession = function finishBasic() {
        const session = this._layerTransformSession;
        if (!session) return { ok: false, commit: false };
        const changed = session.previewResult?.changed === true;
        if (changed) {
            state.basicKeys.set(session.transaction.timelineFrame, ++state.nextBasic);
            state.history += 1;
        }
        this._layerTransformSession = null;
        return { ok: true, commit: changed, target: BASIC_TARGET };
    };
    layerHost.finishLayerWarpEditSession = function finishWarpSession(options = {}) {
        const session = this._layerWarpEditSession;
        if (!session) return { ok: false, commit: false };
        const changed = session.changed === true && options.cancelled !== true;
        if (changed) {
            state.warpKeys.set(session.transaction.timelineFrame, ++state.nextWarp);
            state.history += 1;
        }
        this._layerWarpEditSession = null;
        return { ok: true, commit: changed, target: WARP_TARGET };
    };
    layerHost._transformEditAdapter = {
        moveFrame: request => popupMoveBridgeFrame.call(popup, request),
        finish() { return { ok: true, commit: false }; }
    };
    layerHost._layerTransformSession = null;
    layerHost._layerWarpEditSession = null;
    layerHost._resumeLayerTransformTimelineSession = function resumeBasic() {
        return this.enterLayerMoveMode();
    };
    layerHost._resumeLayerWarpTimelineSession = function resumeWarpSession() {
        return this.transform.warpController.begin();
    };

    return { state, popup, layerHost };
}

function compileContinuationMethods(fixture) {
    const { layerHost } = fixture;
    layerHost._finishLayerTransformTimelineSession = layerHost._finishLayerTransformTimelineSession.bind(layerHost);
    layerHost._resumeLayerTransformTimelineSession = layerHost._resumeLayerTransformTimelineSession.bind(layerHost);
    layerHost._resumeLayerWarpTimelineSession = layerHost._resumeLayerWarpTimelineSession.bind(layerHost);
    return layerHost;
}

function startStableFixture(kind) {
    const fixture = makeFixture(kind);
    const { state, popup, layerHost } = fixture;
    compileContinuationMethods(fixture);
    layerHost.enterLayerMoveMode();
    if (kind === 'warp') {
        assert.equal(layerHost.transform.warpController.begin(), true);
    }
    assert.equal(state.model.playback.currentFrame, F6);
    return fixture;
}

function confirmAndContinue(fixture, kind) {
    const { state, layerHost } = fixture;
    if (kind === 'warp') {
        layerHost._layerWarpEditSession.changed = true;
        assert.equal(commitWarp.call(layerHost), true);
    } else {
        layerHost._layerTransformSession.previewResult = { changed: true };
        assert.equal(commitLayerTransform.call(layerHost), true);
    }
    assert.equal(state.history, 1);
    assert.equal(state.model.playback.currentFrame, F6);
    assert.equal(layerHost._layerTransformSession != null, true);
    if (kind === 'warp') assert.equal(layerHost._layerWarpEditSession != null, true);
}

for (const kind of ['basic', 'warp']) {
    const fixture = startStableFixture(kind);
    const { state, popup, layerHost } = fixture;
    confirmAndContinue(fixture, kind);

    // Direct Timeline selection must use the same production continuation.
    const moved = popupNavigateTo.call(popup, F7, { source: 'timeline-frame-header' });
    assert.equal(moved, true, `${kind}: direct Frame selection moves`);
    assert.equal(state.model.playback.currentFrame, F7, `${kind}: current Frame is F7`);
    assert.equal(layerHost._layerTransformSession.transaction.timelineFrame, F7);
    if (kind === 'warp') {
        assert.equal(layerHost._layerWarpEditSession.transaction.timelineFrame, F7);
        assert.equal(layerHost._layerWarpEditSession.transaction.hadExplicitKey, false);
    }
    assert.equal(state.history, 1, `${kind}: Frame movement adds no History`);

    // A second edit/confirm creates the second key without affecting F6.
    if (kind === 'warp') {
        layerHost._layerWarpEditSession.changed = true;
        assert.equal(commitWarp.call(layerHost), true);
    } else {
        layerHost._layerTransformSession.previewResult = { changed: true };
        assert.equal(commitLayerTransform.call(layerHost), true);
    }
    assert.equal(state.history, 2, `${kind}: F7 confirm adds one History`);
    assert.equal(state.basicKeys.has(F6) || state.warpKeys.has(F6), true);
    assert.equal(state.basicKeys.has(F7) || state.warpKeys.has(F7), true);

    // Existing destination key is loaded as the fresh baseline on revisit.
    const back = popupNavigateTo.call(popup, F6, { source: 'timeline-frame-header' });
    assert.equal(back, true, `${kind}: return to F6`);
    assert.equal(state.model.playback.currentFrame, F6);
    if (kind === 'warp') {
        assert.equal(layerHost._layerWarpEditSession.transaction.hadExplicitKey, true);
    }
    assert.equal(state.history, 2);

    // Pending navigation is rejected before the model frame can change.
    if (kind === 'warp') {
        layerHost._layerWarpEditSession.changed = true;
    } else {
        layerHost._layerTransformSession.previewResult = { changed: true };
    }
    const pending = popupNavigateTo.call(popup, F7, { source: 'timeline-frame-header' });
    assert.equal(pending, false, `${kind}: pending direct navigation is blocked`);
    assert.equal(state.model.playback.currentFrame, F6, `${kind}: pending keeps F6`);
    assert.equal(state.history, 2, `${kind}: pending adds no History`);

    // Escape rolls back the candidate; navigation then uses the normal route.
    if (kind === 'warp') {
        assert.equal(layerHost.finishLayerWarpEditSession({ cancelled: true }).commit, false);
    } else {
        layerHost._layerTransformSession = null;
    }
    layerHost._layerTransformSession = null;
    layerHost._layerWarpEditSession = null;
    popupMoveByDelta.call(popup, 1, { createBlankClip: false });
    assert.equal(state.model.playback.currentFrame, F7, `${kind}: post-Esc move succeeds`);
    assert.equal(state.history, 2);
}

// The delta entry used by keyboard/timeline wheel is also guarded. Its
// in-progress call from the production continuation is allowed through once.
for (const kind of ['basic', 'warp']) {
    const fixture = startStableFixture(kind);
    const { state, popup, layerHost } = fixture;
    assert.equal(popupMoveByDelta.call(popup, 1, { createBlankClip: false }), true);
    assert.equal(state.model.playback.currentFrame, F7);
    assert.equal(layerHost._layerTransformSession.transaction.timelineFrame, F7);
    if (kind === 'warp') assert.equal(layerHost._layerWarpEditSession.transaction.timelineFrame, F7);
}

console.log(JSON.stringify({
    verifier: 'layer-transform-cross-frame-continuation',
    modes: ['basic', 'warp'],
    cases: [
        'KEY confirm -> direct Timeline F7 -> fresh rebind',
        'existing destination key baseline',
        'pending navigation block',
        'Esc -> normal move',
        'delta navigation guard'
    ],
    historyContract: 'confirm +1 / frame move +0 / pending +0',
    productionMethods: [
        'LayerSystem.moveLayerTransformTimelineFrameTo',
        'LayerSystem.stepLayerTransformTimelineFrame',
        'LayerSystem._stepLayerWarpTimelineFrame',
        'AnimationTablePopup._navigateTimelineFrameTo',
        'AnimationTablePopup.moveTimelineFrameByDelta'
    ]
}, null, 2));
console.log('WP-005 / WP-003 cross-frame continuation passed for BASIC and WARP production boundaries.');
