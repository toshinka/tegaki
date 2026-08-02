import assert from 'node:assert/strict';
import {
    estimateBakeLayerRasterBytes,
    estimateStructuredBakeCapacity
} from '../system/animation/bake-capacity-estimator.js';

assert.equal(estimateBakeLayerRasterBytes({ type: 'folder', width: 400, height: 400 }), 0);
assert.equal(estimateBakeLayerRasterBytes({ type: 'raster', width: 400, height: 400 }), 640000);
assert.equal(estimateBakeLayerRasterBytes({ type: 'raster', pixelBytes: 160000 }), 160000);

const estimate = estimateStructuredBakeCapacity({
    frameCount: 24,
    layers: [
        { type: 'raster', width: 400, height: 400 },
        { type: 'folder', width: 400, height: 400 },
        { type: 'raster', width: 200, height: 200 }
    ],
    existingSnapshotBytes: 10000000,
    existingHistoryBytes: 5000000,
    previewTextureBytes: 2000000,
    workingCopyCount: 2,
    exportExpansionFactor: 8,
    memoryBudgetBytes: 300000000
});

assert.equal(estimate.rasterLayerCount, 2);
assert.equal(estimate.outputSnapshotCount, 48);
assert.equal(estimate.perFramePixelBytes, 800000);
assert.equal(estimate.outputPixelBytes, 19200000);
assert.equal(estimate.snapshotMetadataBytes, 12288);
assert.equal(estimate.residentBeforeBytes, 17000000);
assert.equal(estimate.generationWorkingBytes, 1600000);
assert.equal(estimate.generationPeakBytes, 37812288);
assert.equal(estimate.exportIntermediateBytes, 233600000);
assert.equal(estimate.checkpointPeakBytes, 269812288);
assert.equal(estimate.peakBytes, 269812288);
assert.equal(estimate.fitsBudget, true);
assert.equal(estimate.overflowed, false);

const rejected = estimateStructuredBakeCapacity({
    frameCount: 24,
    layers: [{ type: 'raster', width: 400, height: 400 }],
    existingSnapshotBytes: 10000000,
    exportExpansionFactor: 8,
    memoryBudgetBytes: 100000000
});
assert.equal(rejected.fitsBudget, false);

const unknownBudget = estimateStructuredBakeCapacity({
    frameCount: 1,
    layers: [{ type: 'raster', pixelBytes: 4 }]
});
assert.equal(unknownBudget.fitsBudget, null);

const twoGiB = 2 * 1024 * 1024 * 1024;
const createFullRasterLayers = (count, width, height) => Array.from(
    { length: count },
    () => ({ type: 'raster', width, height })
);
const capacityMatrix = {
    oneFrameSmall: estimateStructuredBakeCapacity({
        frameCount: 1,
        layers: createFullRasterLayers(1, 400, 400),
        memoryBudgetBytes: twoGiB
    }),
    twentyFourFrameSmall: estimateStructuredBakeCapacity({
        frameCount: 24,
        layers: createFullRasterLayers(8, 400, 400),
        memoryBudgetBytes: twoGiB
    }),
    twoHundredFortyFrameSmall: estimateStructuredBakeCapacity({
        frameCount: 240,
        layers: createFullRasterLayers(8, 400, 400),
        memoryBudgetBytes: twoGiB
    }),
    twentyFourFrameLarge: estimateStructuredBakeCapacity({
        frameCount: 24,
        layers: createFullRasterLayers(8, 4096, 4096),
        memoryBudgetBytes: twoGiB
    })
};

const calibratedOneLayer240 = estimateStructuredBakeCapacity({
    frameCount: 240,
    layers: createFullRasterLayers(1, 400, 400),
    memoryBudgetBytes: 1024 * 1024 * 1024
});

assert.equal(capacityMatrix.oneFrameSmall.outputSnapshotCount, 1);
assert.equal(capacityMatrix.oneFrameSmall.outputPixelBytes, 640000);
assert.equal(capacityMatrix.twentyFourFrameSmall.outputSnapshotCount, 192);
assert.equal(capacityMatrix.twentyFourFrameSmall.outputPixelBytes, 122880000);
assert.equal(capacityMatrix.twoHundredFortyFrameSmall.outputSnapshotCount, 1920);
assert.equal(capacityMatrix.twoHundredFortyFrameSmall.outputPixelBytes, 1228800000);
assert.equal(capacityMatrix.twentyFourFrameLarge.outputSnapshotCount, 192);
assert.equal(capacityMatrix.twentyFourFrameLarge.outputPixelBytes, 12884901888);
assert.ok(
    capacityMatrix.oneFrameSmall.peakBytes
        < capacityMatrix.twentyFourFrameSmall.peakBytes
);
assert.ok(
    capacityMatrix.twentyFourFrameSmall.peakBytes
        < capacityMatrix.twoHundredFortyFrameSmall.peakBytes
);
assert.ok(
    capacityMatrix.twentyFourFrameSmall.peakBytes
        < capacityMatrix.twentyFourFrameLarge.peakBytes
);
assert.equal(capacityMatrix.oneFrameSmall.fitsBudget, true);
assert.equal(capacityMatrix.twentyFourFrameSmall.fitsBudget, true);
assert.equal(capacityMatrix.twoHundredFortyFrameSmall.fitsBudget, false);
assert.equal(capacityMatrix.twentyFourFrameLarge.fitsBudget, false);
assert.ok(calibratedOneLayer240.peakBytes > 1024 * 1024 * 1024);
assert.equal(calibratedOneLayer240.fitsBudget, false);

console.log('verify-bake-capacity-estimator: 1/24/240 frame, small/large canvas, few/many layer, generation/checkpoint peaks, budget gate OK');
