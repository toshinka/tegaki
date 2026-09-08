/**
 * WP-005: keep the committed Layer WARP key congruent across a full V/WARP
 * teardown and re-entry. The fixture intentionally starts with a stale active
 * working Layer while the Animation Table selection points at the keyed
 * internal Raster, which was the production failure shape.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };

const {
    LayerSystem
} = await import('../system/layer-system.js');
const {
    createRectControlMeshDeformer
} = await import('../system/animation/control-mesh-deformer.js');
const {
    getClipLayerDeformer,
    setClipLayerDeformerTarget
} = await import('../system/animation/clip-layer-deformer.js');
const {
    getClipDeformerKeyAtFrame
} = await import('../system/animation/clip-deformer.js');
const {
    createFolderEffectRenderPlan
} = await import('../system/animation/folder-part-render-plan.js');
const {
    getClipLayerTransformTrack,
    sampleClipLayerTransform
} = await import('../system/animation/clip-layer-transform.js');
const {
    normalizeRasterBounds
} = await import('../system/raster-bounds.js');
const {
    projectTransformEditContext,
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} = await import('../system/animation/transform-edit-context.js');
const {
    planLayerWarpEditTransactionFinish,
    planLayerWarpEditTransactionPreview,
    planLayerWarpEditTransactionStart,
    LAYER_WARP_TRANSACTION_ACTION,
    LAYER_WARP_TRANSACTION_INTENT
} = await import('../system/animation/layer-warp-edit-transaction.js');
const {
    planTransformEditTransactionStart,
    isTransformTimelineKeyTarget,
    TRANSFORM_EDIT_TRANSACTION_TARGET
} = await import('../system/animation/transform-edit-transaction.js');

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

const getContext = compileMethod(
    popupSource,
    'getTransformEditContext',
    'createLayerTransformEditAdapter',
    { projectTransformEditContext }
);
const resolveWorkingForInternal = compileMethod(
    popupSource,
    '_resolveWorkingLayerIdForInternalLayer',
    '_captureDrawingLayerToSelectedClip'
);
const resolveInternalForWorking = compileMethod(
    popupSource,
    '_resolveInternalLayerIdForWorkingLayer',
    '_resolveWorkingLayerIdForInternalLayer'
);
const selectedLayerMotionFrame = compileMethod(
    popupSource,
    '_getSelectedClipLayerMotionFrame',
    '_getSelectedClipFolderMotionFrame',
    { getClipLayerTransformTrack, normalizeRasterBounds, sampleClipLayerTransform }
);
const createLayerTransformKeyGuide = compileMethod(
    popupSource,
    '_createLayerTransformKeyGuide',
    '_createLayerWarpKeyGuide',
    { isTransformTimelineKeyTarget }
);
const createLayerWarpKeyGuide = compileMethod(
    popupSource,
    '_createLayerWarpKeyGuide',
    '_createLayerWarpProjection'
);
const createLayerWarpProjection = compileMethod(
    popupSource,
    '_createLayerWarpProjection',
    '_projectLayerTransformBridgeStart'
);
const projectLayerTransformBridgeStart = compileMethod(
    popupSource,
    '_projectLayerTransformBridgeStart',
    '_beginLayerTransformBridge',
    {
        TRANSFORM_EDIT_AUTHORITY,
        TRANSFORM_EDIT_CONTEXT_MODE,
        TRANSFORM_EDIT_TRANSACTION_TARGET,
        isTransformTimelineKeyTarget,
        planTransformEditTransactionStart,
        createLayerTransformKeyGuide
    }
);
const projectLayerWarpBridgeStart = compileMethod(
    popupSource,
    '_projectLayerWarpBridgeStart',
    '_beginLayerWarpBridge',
    {
        TRANSFORM_EDIT_AUTHORITY,
        getClipLayerDeformer,
        getClipDeformerKeyAtFrame,
        planLayerWarpEditTransactionStart,
        setClipLayerDeformerTarget,
        createFolderEffectRenderPlan,
        createLayerWarpProjection
    }
);
const beginLayerWarpBridge = compileMethod(
    popupSource,
    '_beginLayerWarpBridge',
    '_restoreLayerWarpBridgePreview'
);
const restoreLayerWarpBridgePreview = compileMethod(
    popupSource,
    '_restoreLayerWarpBridgePreview',
    '_previewLayerWarpBridge'
);
const previewLayerWarpBridge = compileMethod(
    popupSource,
    '_previewLayerWarpBridge',
    '_finishLayerWarpBridge',
    { LAYER_WARP_TRANSACTION_ACTION, planLayerWarpEditTransactionPreview }
);
const finishLayerWarpBridge = compileMethod(
    popupSource,
    '_finishLayerWarpBridge',
    'updateClipDeformerFromExternal',
    {
        LAYER_WARP_TRANSACTION_ACTION,
        LAYER_WARP_TRANSACTION_INTENT,
        planLayerWarpEditTransactionFinish
    }
);

const bounds = { x: 0, y: 0, width: 16, height: 16 };
const snapshot = {
    id: 'snapshot-a',
    width: 16,
    height: 16,
    rasterBounds: { ...bounds }
};
const layerA = {
    id: 'internal-a',
    type: 'raster',
    isBackground: false,
    parentLayerId: null,
    drawingSnapshotId: snapshot.id
};
const layerB = {
    id: 'internal-b',
    type: 'raster',
    isBackground: false,
    parentLayerId: null,
    drawingSnapshotId: snapshot.id
};
const asset = {
    id: 'asset-1',
    internalLayers: [layerA, layerB],
    rigDefinition: null,
    meshDefinitions: null
};
const workingA = {
    layerData: {
        id: 'working-a',
        isAnimationWorkingLayer: true,
        isBackground: false,
        isFolder: false,
        renderTexture: { width: 16, height: 16 },
        rasterBounds: { ...bounds }
    }
};
const workingB = {
    layerData: {
        id: 'working-b',
        isAnimationWorkingLayer: true,
        isBackground: false,
        isFolder: false,
        renderTexture: { width: 16, height: 16 },
        rasterBounds: { ...bounds }
    }
};

const keyedDeformer = createRectControlMeshDeformer({
    columns: 4,
    rows: 4,
    bindBounds: bounds
});
const pointsA = keyedDeformer.points.map((point, index) => ({
    x: point.x + (index === 5 ? 0.125 : 0),
    y: point.y + (index === 5 ? 0.0625 : 0)
}));
keyedDeformer.keyframes = [{
    frame: 1,
    interpolation: 'hold',
    points: pointsA
}];
keyedDeformer.points = pointsA.map(point => ({ ...point }));

const clip = {
    id: 'clip-1',
    assetId: asset.id,
    startFrame: 0,
    duration: 3,
    layerTransformTracks: [],
    folderTransformTracks: [],
    layerDeformers: setClipLayerDeformerTarget(
        setClipLayerDeformerTarget(null, layerA.id, keyedDeformer),
        layerB.id,
        createRectControlMeshDeformer({ columns: 4, rows: 4, bindBounds: bounds })
    )
};
const entry = { clip, lane: { id: 'lane-1' } };
const model = {
    playback: { currentFrame: 1 },
    findClipEntry(id) { return id === clip.id ? entry : null; },
    getClipAsset(id) { return id === asset.id ? asset : null; },
    getDrawingSnapshot(id) { return id === snapshot.id ? snapshot : null; },
    preflightClipLayerEffectTarget() { return { ok: true }; },
    setClipLayerDeformer(clipId, internalLayerId, deformer) {
        if (clipId !== clip.id) return { ok: false, reason: 'clip-missing' };
        clip.layerDeformers = setClipLayerDeformerTarget(
            clip.layerDeformers,
            internalLayerId,
            deformer
        );
        return { ok: true };
    }
};

const popupHost = {
    model,
    selectedCelId: clip.id,
    selectedCelIds: new Set([clip.id]),
    selectedInternalLayerId: layerA.id,
    selectedRigBoneId: null,
    isVisible: true,
    isPlaying: false,
    layerSystem: null,
    config: { canvas: { width: 16, height: 16 } },
    _layerWarpBridgeSession: null,
    _layerTransformBridgeSession: null,
    _getDrawableInternalLayers(currentAsset) {
        return (currentAsset?.internalLayers || []).filter(layer => (
            layer?.type !== 'folder' && layer?.isBackground !== true
        ));
    },
    _getRasterWorkingLayers() {
        return [workingA, workingB];
    },
    _resolveWorkingLayerIdForInternalLayer: resolveWorkingForInternal,
    _resolveInternalLayerIdForWorkingLayer: resolveInternalForWorking,
    getTransformEditContext: getContext,
    _getSelectedClipLayerMotionFrame: selectedLayerMotionFrame,
    _createLayerTransformKeyGuide: createLayerTransformKeyGuide,
    _createLayerWarpKeyGuide: createLayerWarpKeyGuide,
    _createLayerWarpProjection: createLayerWarpProjection,
    canEditSelectedWorkingLayer(layerId) {
        return ['working-a', 'working-b'].includes(layerId);
    },
    _getSelectedClipMotionFrame() { return null; },
    _getSelectedClipFolderMotionFrame() { return null; },
    _getWorkingLayerIdsForClipAsset() { return ['working-a', 'working-b']; },
    _captureTimelineHistoryState() { return { layerDeformers: structuredClone(clip.layerDeformers) }; },
    _recordTimelineHistory() { this.historyCount = (this.historyCount || 0) + 1; },
    _scheduleLayerTransformBridgeRender() {},
    render() {},
    _projectLayerTransformBridgeStart: projectLayerTransformBridgeStart,
    _projectLayerWarpBridgeStart: projectLayerWarpBridgeStart,
    _beginLayerWarpBridge: beginLayerWarpBridge,
    _restoreLayerWarpBridgePreview: restoreLayerWarpBridgePreview,
    _previewLayerWarpBridge: previewLayerWarpBridge,
    _finishLayerWarpBridge: finishLayerWarpBridge
};

const layerHost = Object.create(LayerSystem.prototype);
let activeIndex = 0; // working-b is stale on purpose; selected internal is A.
const layers = [workingB, workingA];
popupHost.layerSystem = layerHost;
layerHost.config = { canvas: { width: 16, height: 16 } };
layerHost.coordAPI = { clearCache() {} };
layerHost._layerTransformSession = null;
layerHost._layerWarpEditSession = null;
layerHost.getLayers = () => layers;
layerHost.getActiveLayer = () => layers[activeIndex];
layerHost.getLayerIndex = layer => layers.indexOf(layer);
layerHost.setActiveLayer = index => { activeIndex = index; };
layerHost.getLayerMoveCommitState = () => ({ active: true, hasPendingTransform: false });
layerHost._isFolderWithRasterTargets = () => false;
layerHost._resolveLayerTransformSourceBounds = () => ({ ...bounds });
layerHost._getRasterTransformSourceBounds = () => ({ ...bounds });
layerHost._captureTransformTargetState = () => ({});
layerHost._restoreTransformTargetState = () => {};
layerHost._captureFolderTargetTransformState = () => ({});
layerHost._emitPanelUpdateRequest = () => {};
layerHost.eventBus = { emit() {} };
layerHost.transform = {
    _initializeTransformForActiveLayer() {},
    getTransform() { return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }; },
    setTransform() {},
    applyTransform() {},
    setEditContextProjection() {},
    enterMoveMode() {},
    exitMoveMode() {},
    syncBasicOverlay() {},
    warpController: {
        begin: () => layerHost.beginLayerWarpEditSession().ok === true,
        deactivate() {}
    }
};

function bridgeBeginWarp(request) {
    const start = beginLayerWarpBridge.call(popupHost, request);
    return start;
}
function bridgeFinishWarp(request) {
    return finishLayerWarpBridge.call(popupHost, request);
}
layerHost._transformEditAdapter = {
    begin: request => projectLayerTransformBridgeStart.call(popupHost, request),
    beginWarp: bridgeBeginWarp,
    previewWarp: request => previewLayerWarpBridge.call(popupHost, request),
    finishWarp: bridgeFinishWarp,
    finish: () => ({ ok: true, commit: false })
};

function summarize(label, transaction = null) {
    const modelDeformer = getClipLayerDeformer(clip.layerDeformers, layerA.id);
    const markerKey = getClipDeformerKeyAtFrame(modelDeformer, 1, clip.duration);
    return {
        label,
        workingLayerId: layers[activeIndex].layerData.id,
        selectedInternalLayerId: popupHost.selectedInternalLayerId,
        transactionInternalLayerId: transaction?.internalLayerId || null,
        transactionLayerId: transaction?.layerId || null,
        localFrame: transaction?.localFrame ?? null,
        modelHasExplicitKey: markerKey !== null,
        modelPoint: markerKey?.points?.[5] || null,
        keyGuideHasExplicitKey: transaction?.hadExplicitKey === true
    };
}

const checkpoints = [];
// Baseline proof: the pre-fix active-layer lookup would have selected B while
// the timeline marker/selection already pointed at the committed A target.
const legacyActiveInternalLayerId = popupHost._resolveInternalLayerIdForWorkingLayer(
    asset,
    workingB.layerData.id
);
assert.equal(legacyActiveInternalLayerId, layerB.id, 'baseline active lookup points at the stale B target');
assert.notEqual(
    legacyActiveInternalLayerId,
    popupHost.selectedInternalLayerId,
    'baseline marker selection and WARP active lookup diverge'
);
assert.equal(layerHost.enterLayerMoveMode(), true, 'P0 V entry succeeds');
assert.equal(activeIndex, 1, 'V entry synchronizes stale active layer to selected internal Raster');
const p0 = layerHost.beginLayerWarpEditSession();
assert.equal(p0.ok, true, 'P0 WARP entry succeeds');
assert.equal(p0.transaction.internalLayerId, layerA.id, 'P0 transaction uses selected internal Raster');
assert.equal(p0.transaction.hadExplicitKey, true, 'P0 reads the committed F1 key');
checkpoints.push(summarize('P0', p0.transaction));

const pointsA2 = p0.points.map((point, index) => ({
    x: point.x + (index === 6 ? 0.1 : 0),
    y: point.y
}));
const p1 = layerHost.previewLayerWarpEditSession(pointsA2);
assert.equal(p1.ok, true, 'P1 drag preview succeeds');
assert.equal(getClipDeformerKeyAtFrame(
    getClipLayerDeformer(clip.layerDeformers, layerA.id), 1, clip.duration
)?.points?.[6]?.x, pointsA2[6].x, 'P1 candidate targets the same internal Raster');
checkpoints.push(summarize('P1', p0.transaction));

assert.equal(layerHost._commitLayerWarpTimelineKeyAndContinue(), true, 'P2 explicit KEY confirm commits and resumes');
assert.equal(popupHost.historyCount, 1, 'P2 creates exactly one History entry');
assert.ok(layerHost._layerWarpEditSession, 'P2 starts a fresh same-Frame WARP session');
assert.equal(layerHost._layerWarpEditSession.transaction.internalLayerId, layerA.id, 'P2 fresh session keeps target identity');
assert.equal(layerHost._layerWarpEditSession.transaction.hadExplicitKey, true, 'P2 fresh session sees committed key');
checkpoints.push(summarize('P2', layerHost._layerWarpEditSession.transaction));

const p3Session = layerHost.getLayerWarpEditSession();
const pointsB = p3Session.points.map((point, index) => ({
    x: point.x + (index === 10 ? 0.08 : 0),
    y: point.y
}));
assert.equal(layerHost.previewLayerWarpEditSession(pointsB).ok, true, 'P3 second drag preview succeeds');
checkpoints.push(summarize('P3', p3Session.transaction));

assert.equal(layerHost.finishLayerWarpEditSession({ cancelled: true }).commit, false, 'P4 Esc rolls back pending B');
assert.equal(popupHost.historyCount, 1, 'P4 Esc does not add History');
assert.equal(getClipDeformerKeyAtFrame(
    getClipLayerDeformer(clip.layerDeformers, layerA.id), 1, clip.duration
)?.points?.[6]?.x, pointsA2[6].x, 'P4 committed A remains after rollback');
layerHost._layerWarpEditSession = null;
layerHost._layerTransformSession = null;
popupHost._layerWarpBridgeSession = null;
checkpoints.push(summarize('P4', null));

// Full teardown followed by the stale-active re-entry shape from the report.
activeIndex = 0;
assert.equal(layerHost.enterLayerMoveMode(), true, 'P5 V re-entry succeeds after full teardown');
assert.equal(activeIndex, 1, 'P5 re-entry re-synchronizes active working Layer');
checkpoints.push(summarize('P5', layerHost._layerTransformSession?.transaction));
const p6 = layerHost.beginLayerWarpEditSession();
assert.equal(p6.ok, true, 'P6 WARP re-entry succeeds');
assert.equal(p6.transaction.internalLayerId, layerA.id, 'P6 WARP target matches marker target');
assert.equal(p6.transaction.hadExplicitKey, true, 'P6 key guide remains KEYED');
assert.deepEqual(p6.transaction.baselinePoints, pointsA2, 'P6 baseline restores committed A shape');
checkpoints.push(summarize('P6', p6.transaction));

assert.equal(checkpoints[0].selectedInternalLayerId, checkpoints[0].transactionInternalLayerId);
assert.ok(checkpoints.every(checkpoint => checkpoint.modelHasExplicitKey), 'committed model key survives P0-P6');
assert.ok(checkpoints.every(checkpoint => checkpoint.transactionInternalLayerId === null
    || checkpoint.transactionInternalLayerId === layerA.id), 'transaction identity stays congruent');

console.log(JSON.stringify({
    verifier: 'layer-transform-warp-reentry-congruence',
    baselineDivergence: {
        selectedInternalLayerId: popupHost.selectedInternalLayerId,
        legacyActiveInternalLayerId,
        patchedActiveLayerId: layers[activeIndex].layerData.id
    },
    checkpoints,
    history: popupHost.historyCount,
    finalActiveLayerId: layers[activeIndex].layerData.id,
    finalModelTarget: getClipLayerDeformer(clip.layerDeformers, layerA.id)?.keyframes?.map(key => key.frame)
}, null, 2));
console.log('WP-005 WARP re-entry congruence passed: committed key, marker target, active working Layer, and fresh WARP baseline remain aligned through P0-P6.');
