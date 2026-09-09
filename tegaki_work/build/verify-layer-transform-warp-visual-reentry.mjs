/**
 * WP-005: the ANIMATE Layer Transform entry must keep the current canonical
 * evaluated visual visible before a WARP transaction is started.
 *
 * This verifier executes the production re-entry decision method and the
 * shared Folder Effect render plan. It deliberately does not call previewWarp
 * or mutate a Clip/History object: opening the editor is a view hydration
 * boundary, not an edit terminal.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };

const { createRectControlMeshDeformer } = await import(
    '../system/animation/control-mesh-deformer.js'
);
const {
    getClipLayerDeformer,
    setClipLayerDeformerTarget
} = await import('../system/animation/clip-layer-deformer.js');
const { createFolderEffectRenderPlan } = await import(
    '../system/animation/folder-part-render-plan.js'
);
const {
    getClipDeformerKeyAtFrame,
    sampleClipDeformer
} = await import('../system/animation/clip-deformer.js');
const {
    sampleClipLayerTransform,
    getClipLayerTransformTrack
} = await import('../system/animation/clip-layer-transform.js');
const {
    TRANSFORM_EDIT_AUTHORITY
} = await import('../system/animation/transform-edit-context.js');

const popupSource = readFileSync(
    new URL('../ui/animation-table-popup.js', import.meta.url),
    'utf8'
);

function methodSource(source, name, next) {
    const start = source.indexOf(`\n    ${name}(`);
    const end = source.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source boundary`);
    return source.slice(start, end);
}

function compileMethod(source, name, next, dependencies = {}) {
    const names = Object.keys(dependencies);
    return new Function(
        ...names,
        `return ({${methodSource(source, name, next)}}).${name};`
    )(...names.map(key => dependencies[key]));
}

const shouldRenderCanonicalTransformPreview = compileMethod(
    popupSource,
    '_shouldRenderCanonicalTransformPreview',
    '_exitTransformEditPreviewMode',
    { TRANSFORM_EDIT_AUTHORITY }
);

assert.match(
    popupSource,
    /shouldRenderCanonicalTransformPreview[\s\S]*_applyVisibilityPreview\(\{ force: true \}\)/,
    'render must route the re-entry decision through canonical preview'
);

const bounds = { x: 0, y: 0, width: 16, height: 16 };
const snapshot = {
    id: 'snapshot-visual-reentry',
    width: 16,
    height: 16,
    rasterBounds: { ...bounds },
    pixels: new Uint8ClampedArray(16 * 16 * 4)
};
const internalLayer = {
    id: 'internal-visual-reentry',
    type: 'raster',
    isBackground: false,
    visible: true,
    parentLayerId: null,
    drawingSnapshotId: snapshot.id
};
const asset = {
    id: 'asset-visual-reentry',
    internalLayers: [internalLayer],
    rigDefinition: null,
    meshDefinitions: null
};

const deformer = createRectControlMeshDeformer({
    columns: 4,
    rows: 4,
    bindBounds: bounds
});
const committedPoints = deformer.points.map((point, index) => ({
    x: point.x + (index === 5 ? 0.2 : 0),
    y: point.y + (index === 5 ? 0.1 : 0)
}));
deformer.points = committedPoints.map(point => ({ ...point }));
deformer.keyframes = [{
    frame: 1,
    interpolation: 'hold',
    points: committedPoints.map(point => ({ ...point }))
}];

const clip = {
    id: 'clip-visual-reentry',
    assetId: asset.id,
    startFrame: 0,
    duration: 3,
    layerDeformers: setClipLayerDeformerTarget(null, internalLayer.id, deformer),
    layerTransformTracks: [{
        internalLayerId: internalLayer.id,
        keyframes: [{
            frame: 1,
            transform: {
                x: 3,
                y: -2,
                scaleX: 1.1,
                scaleY: 0.9,
                rotation: 0.125,
                anchorX: 0.5,
                anchorY: 0.5
            }
        }]
    }],
    folderTransformTracks: []
};

const modelSnapshot = structuredClone(clip);
const runtimeState = { history: 17 };

function makeHost({ suspended = true, authority, session = null } = {}) {
    return {
        isTransformPreviewSuspended: suspended,
        _transformPreviewAuthority: authority,
        runtimeState,
        layerSystem: {
            getLayerWarpEditSession: () => session
        }
    };
}

// R1: committed WARP only. V entry must use the canonical path before WARP
// begin, and the shared plan must expose the committed sampled deformer.
const warpOnlyPlan = createFolderEffectRenderPlan(asset, {
    ...clip,
    layerTransformTracks: []
}, 1);
assert.equal(warpOnlyPlan.status, 'ready', 'WARP-only canonical plan is ready');
assert.equal(warpOnlyPlan.layerEffects.length, 1, 'WARP-only plan has one Layer effect');
const warpEffect = warpOnlyPlan.layerEffectByLayerId.get(internalLayer.id);
assert(warpEffect?.sampledDeformer, 'WARP-only plan samples the committed deformer');
assert.deepEqual(
    warpEffect.sampledDeformer.points,
    committedPoints,
    'WARP-only plan uses the committed current-frame points'
);
assert.equal(
    shouldRenderCanonicalTransformPreview.call(makeHost({
        authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY
    })),
    true,
    'WARP-only ANIMATE Layer entry hydrates canonical preview without WARP begin'
);

// R2: BASIC + WARP. The same canonical plan contains both the sampled Layer
// WARP and the evaluated Layer Motion matrix; the entry decision is unchanged.
const combinedPlan = createFolderEffectRenderPlan(asset, clip, 1);
assert.equal(combinedPlan.status, 'ready', 'BASIC + WARP canonical plan is ready');
const combinedEffect = combinedPlan.layerEffectByLayerId.get(internalLayer.id);
assert(combinedEffect?.sampledDeformer, 'combined plan keeps WARP');
const motionIsland = combinedPlan.rigRenderPlan.islandByLayerId.get(internalLayer.id);
assert.equal(motionIsland?.targetKind, 'layer-motion', 'combined plan keeps Layer Motion');
const sampledMotion = sampleClipLayerTransform(clip, internalLayer.id, 1);
assert.deepEqual(
    motionIsland.worldMatrix,
    {
        a: Math.cos(sampledMotion.rotation) * sampledMotion.scaleX,
        b: Math.sin(sampledMotion.rotation) * sampledMotion.scaleX,
        c: -Math.sin(sampledMotion.rotation) * sampledMotion.scaleY,
        d: Math.cos(sampledMotion.rotation) * sampledMotion.scaleY,
        tx: sampledMotion.x,
        ty: sampledMotion.y
    },
    'combined plan evaluates Layer Motion after the Layer WARP island'
);
assert.equal(
    shouldRenderCanonicalTransformPreview.call(makeHost({
        authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY
    })),
    true,
    'BASIC + WARP re-entry uses canonical preview'
);

// R3: opening and switching tabs are no-op model boundaries. The production
// decision method is side-effect free; preserve the same Clip and History.
const runtimeSnapshot = structuredClone(runtimeState);
assert.equal(
    shouldRenderCanonicalTransformPreview.call(makeHost({
        authority: TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY
    })),
    true,
    'Clip Motion ANIMATE entry also uses canonical preview'
);
assert.equal(
    shouldRenderCanonicalTransformPreview.call(makeHost({
        authority: TRANSFORM_EDIT_AUTHORITY.CLIP_FOLDER_TRANSFORM_KEY
    })),
    true,
    'Folder Motion ANIMATE entry remains within the canonical path'
);
assert.deepEqual(clip, modelSnapshot, 're-entry decision does not mutate Clip model');
assert.deepEqual(runtimeState, runtimeSnapshot, 're-entry decision has no History terminal');

// R4: once an animate WARP transaction exists, keep the pre-existing route.
assert.equal(
    shouldRenderCanonicalTransformPreview.call(makeHost({
        authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE,
        session: { transaction: { kind: 'layer-warp-edit-transaction' } }
    })),
    true,
    'active ANIMATE WARP session keeps canonical preview'
);

// R5: source, closed, and unsupported/no-authority states remain on their old
// working-layer path; this prevents a generic V or SOURCE scope leak.
for (const host of [
    makeHost({ authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE }),
    makeHost({ authority: TRANSFORM_EDIT_AUTHORITY.NONE }),
    makeHost({ suspended: false, authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY }),
    makeHost({ authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE, session: {
        transaction: { kind: 'layer-warp-source-transaction' }
    } })
]) {
    assert.equal(
        shouldRenderCanonicalTransformPreview.call(host),
        false,
        'SOURCE/closed/non-ANIMATE state does not force canonical preview'
    );
}

// Keep the direct production deformer/key reads in this verifier so a stale
// overlay or key cannot make the render-plan assertion vacuous.
assert.equal(getClipLayerDeformer(clip.layerDeformers, internalLayer.id)?.type, 'control-mesh');
assert.equal(getClipDeformerKeyAtFrame(deformer, 1, clip.duration)?.frame, 1);
assert.equal(sampleClipDeformer(deformer, 1, clip.duration)?.points.length, 16);
assert.equal(getClipLayerTransformTrack(clip.layerTransformTracks, internalLayer.id)?.internalLayerId, internalLayer.id);

console.log('verify-layer-transform-warp-visual-reentry: PASS (R1 WARP, R2 BASIC+WARP, R3 no-op, R4 active WARP, R5 source guards)');
