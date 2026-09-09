import assert from 'node:assert/strict';
import {
    inspectLayerTransformKeyBundle,
    moveLayerTransformKeyBundle,
    removeLayerTransformComponentKey
} from '../system/animation/clip-layer-key-bundle.js';

const points = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));
const warp = keyframes => ({
    version: 1,
    targets: [{
        internalLayerId: 'layer-1',
        deformer: {
            type: 'warp-grid',
            version: 1,
            columns: 4,
            rows: 4,
            bindBounds: { x: 0, y: 0, width: 100, height: 100 },
            bindPoints: points,
            points,
            keyframes
        }
    }]
});
const basic = frame => [{
    internalLayerId: 'layer-1',
    pivotX: 50,
    pivotY: 50,
    keyframes: [{ frame, interpolation: 'linear', x: frame, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
}];
const warpKey = frame => ({ frame, interpolation: 'hold', points });
const bothTracks = [{
    internalLayerId: 'layer-1', pivotX: 50, pivotY: 50,
    keyframes: [0, 2].map(frame => ({ frame, interpolation: 'linear', x: frame, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }))
}];
const bothDeformers = warp([warpKey(0), warpKey(2)]);

assert.deepEqual(inspectLayerTransformKeyBundle({
    layerTransformTracks: basic(0), layerDeformers: null, internalLayerId: 'layer-1', localFrame: 0
}).components, ['basic']);
assert.deepEqual(inspectLayerTransformKeyBundle({
    layerTransformTracks: null, layerDeformers: warp([warpKey(1)]), internalLayerId: 'layer-1', localFrame: 1
}).components, ['warp']);
assert.deepEqual(inspectLayerTransformKeyBundle({
    layerTransformTracks: bothTracks, layerDeformers: bothDeformers, internalLayerId: 'layer-1', localFrame: 0
}).components, ['basic', 'warp']);

const removeBasic = removeLayerTransformComponentKey({
    layerTransformTracks: bothTracks, layerDeformers: bothDeformers,
    internalLayerId: 'layer-1', localFrame: 0, duration: 4, component: 'basic'
});
assert.equal(removeBasic.ok, true);
assert.deepEqual(removeBasic.bundle.components, ['warp']);
assert.equal(removeBasic.layerDeformers.targets[0].deformer.keyframes.length, 2);

const removeWarp = removeLayerTransformComponentKey({
    layerTransformTracks: bothTracks, layerDeformers: bothDeformers,
    internalLayerId: 'layer-1', localFrame: 0, duration: 4, component: 'warp'
});
assert.equal(removeWarp.ok, true);
assert.deepEqual(removeWarp.bundle.components, ['basic']);

const removeLast = removeLayerTransformComponentKey({
    layerTransformTracks: basic(0), layerDeformers: null,
    internalLayerId: 'layer-1', localFrame: 0, duration: 4, component: 'basic'
});
assert.equal(removeLast.ok, true);
assert.deepEqual(removeLast.bundle.components, []);
assert.deepEqual(removeLast.tracks, []);

for (const fixture of [
    { tracks: basic(0), deformers: null, expected: ['basic'] },
    { tracks: null, deformers: warp([warpKey(0)]), expected: ['warp'] },
    { tracks: bothTracks, deformers: bothDeformers, expected: ['basic', 'warp'] }
]) {
    const moved = moveLayerTransformKeyBundle({
        layerTransformTracks: fixture.tracks,
        layerDeformers: fixture.deformers,
        internalLayerId: 'layer-1', sourceLocalFrame: 0, destinationLocalFrame: 3, duration: 4
    });
    assert.equal(moved.ok, true);
    assert.deepEqual(moved.bundle.components, fixture.expected);
    assert.deepEqual(inspectLayerTransformKeyBundle({
        layerTransformTracks: moved.tracks,
        layerDeformers: moved.layerDeformers,
        internalLayerId: 'layer-1', localFrame: 0
    }).components, []);
    assert.deepEqual(inspectLayerTransformKeyBundle({
        layerTransformTracks: moved.tracks,
        layerDeformers: moved.layerDeformers,
        internalLayerId: 'layer-1', localFrame: 3
    }).components, fixture.expected);
}

const collision = moveLayerTransformKeyBundle({
    layerTransformTracks: bothTracks, layerDeformers: bothDeformers,
    internalLayerId: 'layer-1', sourceLocalFrame: 0, destinationLocalFrame: 2, duration: 4
});
assert.equal(collision.ok, false);
assert.equal(collision.reason, 'layer-transform-destination-occupied');
assert.deepEqual(collision.bundle.components, ['basic', 'warp']);

for (const args of [
    { sourceLocalFrame: 0, destinationLocalFrame: 0, duration: 4 },
    { sourceLocalFrame: 0, destinationLocalFrame: 4, duration: 4 },
    { sourceLocalFrame: 4, destinationLocalFrame: 1, duration: 4 }
]) {
    const result = moveLayerTransformKeyBundle({
        layerTransformTracks: basic(0), layerDeformers: null,
        internalLayerId: 'layer-1', ...args
    });
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
}

console.log('verify-layer-transform-key-bundle-model: PASS');
