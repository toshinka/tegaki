import assert from 'node:assert/strict';

import {
    estimateRasterHistoryPairBytes,
    summarizePathCollectionMemory,
    summarizeRasterSnapshotMemory
} from '../system/raster-snapshot-memory.js';

const empty = summarizePathCollectionMemory(null);
assert.equal(empty.pathCount, 0);
assert.equal(empty.pointCount, 0);
assert.ok(empty.estimatedBytes > 0);

const shortPath = [{
    id: 'path-1',
    tool: 'pen',
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
}];
const longPath = [{
    id: 'path-1',
    tool: 'airbrush',
    points: Array.from({ length: 102 }, (_, index) => ({ x: index, y: index }))
}];

const shortSummary = summarizePathCollectionMemory(shortPath);
const longSummary = summarizePathCollectionMemory(longPath);
assert.equal(shortSummary.pathCount, 1);
assert.equal(shortSummary.pointCount, 2);
assert.equal(longSummary.pointCount, 102);
assert.ok(longSummary.estimatedBytes > shortSummary.estimatedBytes);

const beforeSnapshot = {
    pixels: new Uint8ClampedArray(16),
    pathsData: shortPath,
    paths: []
};
const afterSnapshot = {
    pixels: new Uint8ClampedArray(16),
    pathsData: longPath,
    paths: []
};
const afterMemory = summarizeRasterSnapshotMemory(afterSnapshot);
const pair = estimateRasterHistoryPairBytes(beforeSnapshot, afterSnapshot);

assert.equal(afterMemory.pixelBytes, 16);
assert.equal(afterMemory.pathsData.pointCount, 102);
assert.ok(afterMemory.metadataBytes > afterMemory.pixelBytes);
assert.equal(
    pair.estimatedBytes,
    pair.before.estimatedBytes + pair.after.estimatedBytes
);

console.log('verify-raster-snapshot-memory: pixel bytes and cumulative path metadata estimate OK');
