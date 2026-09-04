import assert from 'node:assert/strict';

import {
    CLIP_LAYER_DEFORMERS_VERSION,
    getClipLayerDeformer,
    normalizeClipLayerDeformers,
    remapClipLayerDeformers,
    removeClipLayerDeformerTarget,
    removeClipLayerDeformerTargets,
    retimeClipLayerDeformers,
    sampleClipLayerDeformers,
    sampleClipLayerDeformersForBake,
    serializeClipLayerDeformers,
    setClipLayerDeformerTarget,
    validateClipLayerDeformers
} from '../system/animation/clip-layer-deformer.js';
import { createRectControlMeshDeformer } from '../system/animation/control-mesh-deformer.js';
import { createWarpGridDeformer } from '../system/animation/warp-grid-deformer.js';

const layers = [
    { id: 'raster-a', type: 'raster' },
    { id: 'raster-b', type: 'raster' },
    { id: 'folder-a', type: 'folder' },
    { id: 'background-a', type: 'raster', isBackground: true }
];

function createWarp(offset = 0) {
    const deformer = createWarpGridDeformer({
        bindBounds: { x: 10, y: 20, width: 80, height: 60 }
    });
    deformer.keyframes = [
        {
            frame: 0,
            interpolation: 'hold',
            points: deformer.points.map(point => ({ ...point }))
        },
        {
            frame: 4,
            interpolation: 'linear',
            points: deformer.points.map(point => ({ x: point.x + offset, y: point.y })),
            placement: { x: 2, y: -1, scaleX: 1, scaleY: 1, rotation: 0 }
        }
    ];
    return deformer;
}

const control = createRectControlMeshDeformer({
    columns: 3,
    rows: 3,
    bindBounds: { x: 0, y: 0, width: 40, height: 40 }
});
control.keyframes = [{
    frame: 2,
    interpolation: 'linear',
    points: control.points.map(point => ({ x: point.x, y: point.y + 0.1 }))
}];

const unordered = {
    version: CLIP_LAYER_DEFORMERS_VERSION,
    targets: [
        { internalLayerId: 'raster-b', deformer: control },
        { internalLayerId: 'raster-a', deformer: createWarp(0.25) }
    ]
};
const normalized = normalizeClipLayerDeformers(unordered);
assert.deepEqual(
    normalized.targets.map(target => target.internalLayerId),
    ['raster-a', 'raster-b'],
    'targets normalize into stable internal Layer ID order'
);
assert.deepEqual(serializeClipLayerDeformers(unordered), normalized);
assert.equal(normalizeClipLayerDeformers(null), null, 'old Project without the optional field stays null');

const valid = validateClipLayerDeformers(unordered, layers, 5);
assert.equal(valid.ok, true, JSON.stringify(valid.errors));
assert.equal(getClipLayerDeformer(normalized, 'raster-a')?.type, 'warp-grid');
assert.equal(getClipLayerDeformer(normalized, 'missing'), null);

const invalid = validateClipLayerDeformers({
    version: 2,
    targets: [
        { internalLayerId: 'folder-a', deformer: createWarp() },
        { internalLayerId: 'background-a', deformer: createWarp() },
        { internalLayerId: 'missing', deformer: createWarp() },
        { internalLayerId: 'raster-a', deformer: createWarp() },
        { internalLayerId: 'raster-a', deformer: createWarp() },
        {
            internalLayerId: 'raster-b',
            deformer: { ...createWarp(), keyframes: [{ frame: 5, points: [] }] }
        }
    ]
}, layers, 5);
assert.equal(invalid.ok, false);
const invalidCodes = new Set(invalid.errors.map(error => error.code));
assert.equal(invalidCodes.has('layer-deformers-version'), true);
assert.equal(invalidCodes.has('layer-deformer-target-missing'), true);
assert.equal(invalidCodes.has('layer-deformer-duplicate'), true);
assert.equal(invalidCodes.has('layer-deformer-key-out-of-range'), true);

let edited = setClipLayerDeformerTarget(null, 'raster-a', createWarp(0.5));
edited = setClipLayerDeformerTarget(edited, 'raster-b', control);
assert.deepEqual(edited.targets.map(target => target.internalLayerId), ['raster-a', 'raster-b']);
edited = removeClipLayerDeformerTarget(edited, 'raster-a');
assert.deepEqual(edited.targets.map(target => target.internalLayerId), ['raster-b']);
assert.equal(removeClipLayerDeformerTarget(edited, 'raster-b'), null);
assert.deepEqual(
    removeClipLayerDeformerTargets(normalized, ['raster-b']).targets.map(target => target.internalLayerId),
    ['raster-a']
);

const sampled = sampleClipLayerDeformers(normalized, 4, 5);
assert.deepEqual([...sampled.keys()], ['raster-a', 'raster-b']);
assert.equal(sampled.get('raster-a').type, 'warp-grid');
assert.equal(sampled.get('raster-a').placement.x, 2);

const remapped = remapClipLayerDeformers(normalized, new Map([
    ['raster-a', 'copy-a'],
    ['raster-b', 'copy-b']
]));
assert.deepEqual(remapped.targets.map(target => target.internalLayerId), ['copy-a', 'copy-b']);

const retimed = retimeClipLayerDeformers(normalized, 5, 8);
assert.deepEqual(
    getClipLayerDeformer(retimed, 'raster-a').keyframes.map(key => key.frame),
    [0, 7],
    'explicit terminal key follows the new duration terminal'
);
assert.deepEqual(
    getClipLayerDeformer(retimed, 'raster-b').keyframes.map(key => key.frame),
    [2],
    'non-terminal keys remain in range'
);

const baked = sampleClipLayerDeformersForBake(normalized, 4, 5);
assert.deepEqual(baked.targets.map(target => target.internalLayerId), ['raster-a', 'raster-b']);
baked.targets.forEach(target => {
    assert.equal(target.deformer.keyframes.length, 1);
    assert.equal(target.deformer.keyframes[0].frame, 0);
    assert.equal(target.deformer.keyframes[0].interpolation, 'hold');
});
assert.equal(getClipLayerDeformer(baked, 'raster-a').keyframes[0].placement.x, 2);

console.log('verify-clip-layer-deformer: normalize, validate, target edits, sample, remap, retime, bake OK');
