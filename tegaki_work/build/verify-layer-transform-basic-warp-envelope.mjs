import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createWarpAuthoringEnvelopeBounds } from '../system/animation/layer-warp-authoring-envelope.js';
import { createTransformBoundsWorldCorners } from '../system/transform-overlay-geometry.js';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };
const { LayerSystem } = await import('../system/layer-system.js');

const sourceBounds = { x: 20, y: 30, width: 120, height: 80 };
const fallbackBounds = { ...sourceBounds };
const gridPoints = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));

const sameBounds = (left, right) => assert.deepEqual(left, right);

// No evaluated WARP (or an invalid sample) keeps the existing source bounds.
sameBounds(
    createWarpAuthoringEnvelopeBounds({ fallbackBounds }),
    fallbackBounds
);
sameBounds(
    createWarpAuthoringEnvelopeBounds({ bindBounds: sourceBounds, points: gridPoints, fallbackBounds }),
    sourceBounds
);
sameBounds(
    createWarpAuthoringEnvelopeBounds({
        bindBounds: sourceBounds,
        points: gridPoints.slice(0, 15),
        fallbackBounds
    }),
    fallbackBounds
);

// Expanded, compressed, and interior-point protrusion all use all 16 points.
const expandedPoints = gridPoints.map(point => ({
    x: point.x * 1.25,
    y: point.y * 1.1
}));
sameBounds(
    createWarpAuthoringEnvelopeBounds({ bindBounds: sourceBounds, points: expandedPoints, fallbackBounds }),
    { x: sourceBounds.x, y: sourceBounds.y, width: 150, height: 88 }
);

const compressedPoints = gridPoints.map(point => ({
    x: 0.2 + point.x * 0.6,
    y: 0.25 + point.y * 0.5
}));
sameBounds(
    createWarpAuthoringEnvelopeBounds({ bindBounds: sourceBounds, points: compressedPoints, fallbackBounds }),
    { x: 44, y: 50, width: 72, height: 40 }
);

const interiorProtrusion = gridPoints.map(point => ({ ...point }));
interiorProtrusion[5] = { x: -0.25, y: 0.55 };
const protrusionBounds = createWarpAuthoringEnvelopeBounds({
    bindBounds: sourceBounds,
    points: interiorProtrusion,
    fallbackBounds
});
assert.equal(protrusionBounds.x, -10, 'interior point must expand the left edge');
assert.equal(protrusionBounds.width, 150, 'interior point must be included in the envelope');

// Removing a WARP component falls back immediately; restoring its sampled points restores it.
sameBounds(
    createWarpAuthoringEnvelopeBounds({ bindBounds: null, points: null, fallbackBounds }),
    fallbackBounds
);
sameBounds(
    createWarpAuthoringEnvelopeBounds({
        bindBounds: sourceBounds,
        points: expandedPoints,
        fallbackBounds
    }),
    { x: 20, y: 30, width: 150, height: 88 }
);

for (const transform of [
    { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { x: 24, y: -11, scaleX: 1, scaleY: 1, rotation: 0 },
    { x: 0, y: 0, scaleX: 1.2, scaleY: 0.7, rotation: Math.PI / 6 },
    { x: -13, y: 18, scaleX: -0.8, scaleY: 1.1, rotation: -Math.PI / 4 }
]) {
    const corners = createTransformBoundsWorldCorners(protrusionBounds, transform, {
        width: 400,
        height: 300
    });
    assert.equal(corners.length, 4);
    assert.ok(corners.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
}

// Exercise the production LayerSystem boundary: the adapter supplies the current
// envelope, while an unavailable projection returns the original source bounds.
const layerSystem = Object.create(LayerSystem.prototype);
layerSystem.config = { canvas: { width: 400, height: 300 } };
layerSystem._layerTransformSession = {
    layerId: 'working-layer',
    sourceBounds: { ...sourceBounds },
    transaction: {
        target: 'clip-layer-transform-key',
        clipId: 'clip-a',
        internalLayerId: 'internal-a',
        timelineFrame: 2
    },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
};
layerSystem.transform = {
    getTransform() {
        return { ...layerSystem._layerTransformSession.transform };
    }
};
layerSystem._transformEditAdapter = {
    getWarpAuthoringBounds() {
        return {
            ok: true,
            bindBounds: { ...sourceBounds },
            points: expandedPoints.map(point => ({ ...point }))
        };
    }
};
const projectedEnvelope = layerSystem._getLayerTransformAuthoringBounds();
sameBounds(projectedEnvelope, { x: 20, y: 30, width: 150, height: 88 });
const projectedCorners = layerSystem._getLayerTransformWorldCorners();
assert.deepEqual(projectedCorners, [
    { x: 20, y: 30 },
    { x: 170, y: 30 },
    { x: 170, y: 118 },
    { x: 20, y: 118 }
]);
layerSystem._transformEditAdapter = {
    getWarpAuthoringBounds() {
        return { ok: false, reason: 'component-deleted' };
    }
};
sameBounds(layerSystem._getLayerTransformAuthoringBounds(), sourceBounds);

const layerSystemSource = await readFile(new URL('../system/layer-system.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
assert.match(layerSystemSource, /getWarpAuthoringBounds/);
assert.match(layerSystemSource, /createWarpAuthoringEnvelopeBounds/);
assert.match(popupSource, /getWarpAuthoringBounds: request => this\._getLayerWarpAuthoringBounds/);
assert.match(popupSource, /_getLayerWarpAuthoringBounds\(\{ transaction, layerId \} = \{\}\)/);
assert.match(popupSource, /deformer\.columns !== 4/);
assert.match(popupSource, /sampleClipDeformer\(/);

console.log('Layer Transform BASIC WARP envelope verifier passed: all 16 evaluated points, fallback/delete restore, and Motion geometry remain bounded without schema mutation.');
