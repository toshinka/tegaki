import assert from 'node:assert/strict';

import {
    createRectControlMeshDeformer,
    normalizeControlMeshDeformer,
    sampleControlMeshDeformer
} from '../system/animation/control-mesh-deformer.js';
import {
    createWarpGridDeformer,
    listWarpGridKeyframes,
    normalizeWarpGridDeformer,
    sampleWarpGridDeformer
} from '../system/animation/warp-grid-deformer.js';
import {
    applyWarpPlacementToPoints,
    interpolateWarpPlacement,
    invertWarpPlacementPoint,
    normalizeWarpPlacement,
    resolveWarpPlacementGeometry,
    resolveWarpPlacementSample
} from '../system/animation/warp-placement.js';

globalThis.window = {};
const { ClipInstanceModel, TimelineModel } = await import('../system/animation/animation-data-model.js');

const closeTo = (actual, expected, message) => {
    assert.ok(Math.abs(actual - expected) <= 1e-9, `${message}: ${actual} !== ${expected}`);
};

const bounds = { x: 100, y: 200, width: 100, height: 50 };
const base = createWarpGridDeformer({ bindBounds: bounds });
assert.ok(base);

// 旧Project: placement欠損を保存上は増やさず、sampling時だけidentityとして扱う。
const legacy = normalizeWarpGridDeformer({
    ...base,
    keyframes: [{ frame: 0, interpolation: 'linear', points: base.points }]
});
assert.equal('placement' in legacy.keyframes[0], false);
assert.deepEqual(sampleWarpGridDeformer(legacy, 0, 5).placement, {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
});
assert.deepEqual(
    applyWarpPlacementToPoints(base.bindPoints, base.bindPoints, bounds),
    base.bindPoints
);
assert.deepEqual(
    resolveWarpPlacementGeometry(base.bindPoints, base.points, bounds),
    { bindPoints: base.bindPoints, points: base.points }
);
assert.deepEqual(resolveWarpPlacementSample(base, bounds), {
    ...base,
    placement: { x: 0, y: 0, scale: 1, rotation: 0 }
});

const placed = normalizeWarpGridDeformer({
    ...base,
    keyframes: [
        {
            frame: 0,
            interpolation: 'linear',
            points: base.points,
            placement: { x: 0, y: 0, scale: 1, rotation: 0 }
        },
        {
            frame: 4,
            interpolation: 'linear',
            points: base.points,
            placement: { x: 40, y: 20, scale: 2, rotation: Math.PI / 2 }
        }
    ]
});
const middle = sampleWarpGridDeformer(placed, 2, 5);
assert.deepEqual(middle.points, base.points);
closeTo(middle.placement.x, 20, 'linear x');
closeTo(middle.placement.y, 10, 'linear y');
closeTo(middle.placement.scale, 1.5, 'linear scale');
closeTo(middle.placement.rotation, Math.PI / 4, 'scalar rotation');

const held = normalizeWarpGridDeformer({
    ...placed,
    keyframes: placed.keyframes.map((key, index) => ({
        ...key,
        interpolation: index === 0 ? 'hold' : key.interpolation
    }))
});
assert.deepEqual(sampleWarpGridDeformer(held, 2, 5).placement, held.keyframes[0].placement);

// Bind重心pivotのProject座標アフィン。source/destination双方が同じ関数を使う。
const transformed = applyWarpPlacementToPoints(
    [{ x: 0, y: 0 }],
    base.bindPoints,
    bounds,
    { x: 10, y: 20, scale: 2, rotation: Math.PI / 2 }
);
closeTo(transformed[0].x, 1.1, 'centroid affine x');
closeTo(transformed[0].y, -1.1, 'centroid affine y');
const restoredPoint = invertWarpPlacementPoint(
    transformed[0],
    base.bindPoints,
    bounds,
    { x: 10, y: 20, scale: 2, rotation: Math.PI / 2 }
);
closeTo(restoredPoint.x, 0, 'inverse placement x');
closeTo(restoredPoint.y, 0, 'inverse placement y');
assert.deepEqual(normalizeWarpPlacement({ scale: 0, rotation: Number.NaN }), {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
});
assert.deepEqual(interpolateWarpPlacement({}, { rotation: Math.PI }, 0.5).rotation, Math.PI / 2);

// 可変Control Meshも同じplacement契約を共有する。
const meshBase = createRectControlMeshDeformer({
    columns: 3,
    rows: 3,
    bindBounds: bounds
});
const mesh = normalizeControlMeshDeformer({
    ...meshBase,
    keyframes: placed.keyframes.map(key => ({
        ...key,
        points: meshBase.points
    }))
});
assert.deepEqual(sampleControlMeshDeformer(mesh, 2, 5).placement, middle.placement);

// Project serialize/restoreと、UI copy/paste・terminal retime相当のplain-data複製で保持する。
const clip = new ClipInstanceModel({ duration: 5, deformer: placed });
const serialized = clip.serialize();
const restored = new ClipInstanceModel(serialized);
assert.deepEqual(restored.deformer, placed);

// ProjectManagerが保存するTimelineModel全体をJSON化し、constructor復元後も
// placement / pose / 補間を同じClip keyとして保持する。
const projectModel = new TimelineModel({
    fps: 8,
    totalFrames: 5,
    tracks: [{
        id: 'lane-placement-round-trip',
        name: 'Lane 1',
        cels: [{
            id: 'clip-placement-round-trip',
            assetId: 'asset-placement-round-trip',
            startFrame: 0,
            duration: 5,
            deformer: placed
        }]
    }],
    clipAssets: [{ id: 'asset-placement-round-trip', name: 'Placement Asset' }]
});
const projectJson = JSON.stringify({
    version: 2,
    app: 'tegaki',
    animation: projectModel.serialize()
});
const reopenedProject = JSON.parse(projectJson);
const reopenedModel = new TimelineModel(reopenedProject.animation);
const reopenedClip = reopenedModel.findClipEntry('clip-placement-round-trip')?.clip;
assert.ok(reopenedClip);
assert.deepEqual(reopenedClip.deformer, placed);
assert.deepEqual(sampleWarpGridDeformer(reopenedClip.deformer, 2, 5), middle);

const copiedKey = structuredClone(listWarpGridKeyframes(restored.deformer, 5)[1]);
const pasted = normalizeWarpGridDeformer({
    ...restored.deformer,
    keyframes: restored.deformer.keyframes.concat({ ...copiedKey, frame: 2 })
});
assert.deepEqual(listWarpGridKeyframes(pasted, 5).find(key => key.frame === 2).placement, copiedKey.placement);

const retimed = normalizeWarpGridDeformer({
    ...restored.deformer,
    keyframes: restored.deformer.keyframes.map(key => (
        key.frame === 4 ? { ...structuredClone(key), frame: 6 } : structuredClone(key)
    ))
});
assert.deepEqual(listWarpGridKeyframes(retimed, 7).find(key => key.frame === 6).placement, copiedKey.placement);

console.log('verify-warp-placement: 4x4/control-mesh/legacy/interpolation/affine/round-trip OK');
