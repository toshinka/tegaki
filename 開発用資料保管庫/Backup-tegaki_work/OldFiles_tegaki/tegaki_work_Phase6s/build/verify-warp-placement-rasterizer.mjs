import assert from 'node:assert/strict';

import {
    createRectControlMeshDeformer,
    normalizeControlMeshDeformer
} from '../system/animation/control-mesh-deformer.js';
import { warpRgbaWithControlMesh } from '../system/animation/control-mesh-rasterizer.js';
import {
    createWarpGridDeformer,
    normalizeWarpGridDeformer,
    sampleWarpGridDeformer
} from '../system/animation/warp-grid-deformer.js';
import { warpRgbaWithGrid } from '../system/animation/warp-grid-rasterizer.js';

const width = 12;
const height = 10;
const sourceBounds = { x: 0, y: 0, width, height };
const pixels = new Uint8ClampedArray(width * height * 4);

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const alpha = x === 0 || y === 0
            ? 0
            : (x === 1 || y === 1 ? 128 : 255);
        pixels[offset] = 30 + x * 12;
        pixels[offset + 1] = 20 + y * 16;
        pixels[offset + 2] = 180 - x * 5;
        pixels[offset + 3] = alpha;
        if (alpha === 0) {
            pixels[offset] = 0;
            pixels[offset + 1] = 0;
            pixels[offset + 2] = 0;
        }
    }
}

const renderGrid = deformer => warpRgbaWithGrid({
    pixels,
    width,
    height,
    sourceBounds,
    deformer,
    maxAxis: 256,
    maxPixels: 256 * 256
});

const base = createWarpGridDeformer({ bindBounds: sourceBounds });
assert.ok(base);

// identityはplacement欠損とbyte / bounds単位で一致する。
const legacyResult = renderGrid(base);
const identityResult = renderGrid({
    ...base,
    placement: { x: 0, y: 0, scale: 1, rotation: 0 }
});
assert.deepEqual(identityResult, legacyResult);
assert.deepEqual(identityResult.bounds, sourceBounds);
assert.deepEqual(identityResult.pixels, pixels);

// source Bind / destination Poseが同じなら、Lensを動かしても絵自体は動かない。
const movedIdentity = renderGrid({
    ...base,
    placement: { x: 4, y: 2, scale: 1, rotation: 0 }
});
assert.deepEqual(movedIdentity.bounds, { x: 0, y: 0, width: 16, height: 12 });
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const sourceOffset = (y * width + x) * 4;
        const outputOffset = (y * movedIdentity.width + x) * 4;
        assert.deepEqual(
            [...movedIdentity.pixels.slice(outputOffset, outputOffset + 4)],
            [...pixels.slice(sourceOffset, sourceOffset + 4)]
        );
    }
}

// pose変形を持つLensを移動し、移動前領域を消さず新しいsource領域だけを差し替える。
const posePoints = base.points.map(point => ({ ...point }));
for (const index of [5, 6, 9, 10]) {
    posePoints[index].x += index % 4 === 1 ? 0.12 : -0.08;
    posePoints[index].y += index < 8 ? 0.14 : -0.1;
}
const movedPose = renderGrid({
    ...base,
    points: posePoints,
    placement: { x: 5, y: 1, scale: 0.85, rotation: Math.PI / 10 }
});
const sampledMovedPose = sampleWarpGridDeformer(normalizeWarpGridDeformer({
    ...base,
    keyframes: [{
        frame: 0,
        interpolation: 'linear',
        points: posePoints,
        placement: { x: 5, y: 1, scale: 0.85, rotation: Math.PI / 10 }
    }]
}), 0, 1);
assert.deepEqual(renderGrid(sampledMovedPose), movedPose);
let changedInsideLens = false;
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const sourceOffset = (y * width + x) * 4;
        const outputX = x - movedPose.bounds.x;
        const outputY = y - movedPose.bounds.y;
        const outputOffset = (outputY * movedPose.width + outputX) * 4;
        const actual = [...movedPose.pixels.slice(outputOffset, outputOffset + 4)];
        const expected = [...pixels.slice(sourceOffset, sourceOffset + 4)];
        if (x <= 2) assert.deepEqual(actual, expected);
        if (x >= 5 && actual.some((value, channel) => value !== expected[channel])) {
            changedInsideLens = true;
        }
    }
}
assert.equal(changedInsideLens, true);

// 透明境界・Raster外でも透明pixelへRGB ghostを作らない。
for (let offset = 0; offset < movedPose.pixels.length; offset += 4) {
    if (movedPose.pixels[offset + 3] !== 0) continue;
    assert.deepEqual([...movedPose.pixels.slice(offset, offset + 3)], [0, 0, 0]);
}

// 可変GRIDは同じ4x4 topology入力で固定Warpとbyte一致する。
const controlBase = createRectControlMeshDeformer({
    columns: 4,
    rows: 4,
    bindBounds: sourceBounds
});
const control = {
    ...normalizeControlMeshDeformer({
    ...controlBase,
        points: posePoints
    }),
    placement: { x: 5, y: 1, scale: 0.85, rotation: Math.PI / 10 }
};
const controlResult = warpRgbaWithControlMesh({
    pixels,
    width,
    height,
    sourceBounds,
    deformer: control,
    maxAxis: 256,
    maxPixels: 256 * 256
});
assert.deepEqual(controlResult, movedPose);

console.log('verify-warp-placement-rasterizer: identity/move/scale/rotate/pose/alpha/outside/overlap OK');
