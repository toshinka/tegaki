import assert from 'node:assert/strict';

import {
    AUTO_SHAPE_LINE_RIBBON_GENERATOR,
    createLineRibbonRasterBoneSetup,
    getLineRibbonRasterMeshStatus,
    rebaseLineRibbonRasterMeshSource
} from '../system/animation/line-ribbon-raster-bone-setup.js';
import { createAutoShapeRasterBoneSetup } from '../system/animation/auto-shape-raster-bone-setup.js';
import {
    analyzeRasterLineRibbonDeformation
} from '../system/animation/raster-line-ribbon-topology.js';
import {
    evaluateRasterBoneSkinning,
    normalizeRasterMeshDefinitions,
    normalizeRasterSkinBindings,
    serializeRasterMeshDefinitions,
    serializeRasterSkinBindings,
    validateRasterBoneSkinning
} from '../system/animation/raster-bone-skinning.js';

function makeSnapshot(rows, options = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const pixels = new Uint8ClampedArray(width * height * 4);
    rows.forEach((row, y) => {
        assert.equal(row.length, width, 'fixture width');
        [...row].forEach((value, x) => {
            pixels[(y * width + x) * 4 + 3] = value === '#' ? 255 : 0;
        });
    });
    return {
        id: options.id || 'snapshot-line-ribbon',
        width,
        height,
        pixels,
        rasterBounds: options.rasterBounds || { x: 0, y: 0, width, height },
        updatedAt: options.updatedAt ?? 100
    };
}

const identityTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

function createClip(rotation, frame = 0) {
    return {
        startFrame: 0,
        duration: 3,
        rigMotion: {
            version: 1,
            partTracks: [],
            boneTracks: [{
                boneId: 'lower',
                keyframes: [
                    { frame: 0, interpolation: 'hold', ...identityTransform, rotation },
                    { frame: 2, interpolation: 'hold', ...identityTransform, rotation }
                ]
            }]
        },
        frame
    };
}

const snapshot = makeSnapshot([
    '.....................',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '..#################..',
    '.....................'
]);
const rigDefinition = {
    version: 1,
    parts: [],
    bones: [{
        boneId: 'upper',
        parentBoneId: null,
        name: 'Upper',
        bindTransform: { x: 2, y: 3.5, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 8
    }, {
        boneId: 'lower',
        parentBoneId: 'upper',
        name: 'Lower',
        bindTransform: { x: 8, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0 },
        length: 8
    }]
};
const asset = {
    id: 'asset-line-ribbon',
    internalLayers: [{
        id: 'stroke-raster',
        name: 'Stroke',
        type: 'raster',
        drawingSnapshotId: snapshot.id
    }],
    rigDefinition
};
const options = {
    boneIds: ['upper', 'lower'],
    stationSpacing: 2,
    idFactory: kind => `line-${kind}`
};

const generated = createLineRibbonRasterBoneSetup(asset, 'stroke-raster', snapshot, options);
assert.equal(generated.ok, true, generated.reason);
assert.equal(generated.meshDefinition.generator.type, AUTO_SHAPE_LINE_RIBBON_GENERATOR);
assert.equal(generated.meshDefinition.generator.mode, 'line');
assert.equal(generated.meshDefinition.generator.weightMode, 'longitudinal-linear');
assert.equal(generated.meshDefinition.vertices.length, generated.topology.vertices.length);
assert.equal(generated.meshDefinition.triangles.length, generated.topology.triangles.length);
assert.equal(generated.boneCount, 2);
assert.deepEqual(generated.anchors.map(anchor => anchor.boneId), ['upper', 'lower']);
assert.equal(generated.stationInfluences.length, generated.topology.metrics.stationCount);

for (let stationIndex = 0; stationIndex < generated.stationInfluences.length; stationIndex++) {
    const triplet = generated.skinBinding.vertexWeights.slice(stationIndex * 3, stationIndex * 3 + 3);
    assert.equal(triplet.length, 3);
    assert.deepEqual(triplet[0].influences, triplet[1].influences);
    assert.deepEqual(triplet[1].influences, triplet[2].influences);
    assert.ok(triplet[0].influences.length >= 1 && triplet[0].influences.length <= 2);
    const total = triplet[0].influences.reduce((sum, influence) => sum + influence.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-10, `station ${stationIndex} weights normalize`);
}
assert.equal(validateRasterBoneSkinning(
    [generated.meshDefinition],
    [generated.skinBinding],
    asset.internalLayers,
    rigDefinition
).ok, true, 'LINE factory output validates against existing Mesh / Skin schema');
assert.deepEqual(
    serializeRasterMeshDefinitions(normalizeRasterMeshDefinitions([generated.meshDefinition])),
    [generated.meshDefinition],
    'LINE generator provenance survives existing Mesh normalize / serialize'
);
assert.deepEqual(
    serializeRasterSkinBindings(normalizeRasterSkinBindings([generated.skinBinding])),
    [generated.skinBinding],
    'longitudinal weights survive existing Skin normalize / serialize'
);
assert.deepEqual(
    JSON.parse(JSON.stringify({
        meshDefinitions: [generated.meshDefinition],
        skinBindings: [generated.skinBinding]
    })),
    { meshDefinitions: [generated.meshDefinition], skinBindings: [generated.skinBinding] },
    'existing Project JSON shape round-trips without a new authority'
);

const evaluationAsset = {
    ...asset,
    meshDefinitions: [generated.meshDefinition],
    skinBindings: [generated.skinBinding]
};

function evaluateAndAnalyze(rotation, frame = 0) {
    const evaluated = evaluateRasterBoneSkinning(evaluationAsset, createClip(rotation), frame);
    assert.equal(evaluated.ok, true, `LBS evaluates ${rotation} at Frame ${frame}`);
    const result = evaluated.meshResults[0];
    const analysis = analyzeRasterLineRibbonDeformation(generated.topology, result.vertices);
    return { evaluated, result, analysis };
}

const identity = evaluateAndAnalyze(0);
assert.equal(identity.analysis.ok, true);
assert.ok(identity.result.vertices.every((vertex, index) => (
    Math.abs(vertex.x - generated.meshDefinition.vertices[index].x) < 1e-10
    && Math.abs(vertex.y - generated.meshDefinition.vertices[index].y) < 1e-10
)));
assert.ok(Math.abs(identity.analysis.metrics.minWidthRatio - 1) < 1e-10);
assert.ok(Math.abs(identity.analysis.metrics.maxWidthRatio - 1) < 1e-10);

const bend45 = evaluateAndAnalyze(Math.PI / 4);
assert.equal(bend45.analysis.ok, true, bend45.analysis.reason);
assert.ok(bend45.analysis.metrics.maximumWidthError < 0.1, '45 degree bend keeps width within 10%');

const bend90 = evaluateAndAnalyze(Math.PI / 2);
assert.equal(bend90.analysis.ok, true, bend90.analysis.reason);
assert.ok(bend90.analysis.metrics.minWidthRatio >= 0.65);
assert.equal(bend90.analysis.metrics.invertedTriangleCount, 0);
assert.equal(bend90.analysis.metrics.selfIntersects, false);

const seek90A = evaluateAndAnalyze(Math.PI / 2, 2);
evaluateAndAnalyze(0, 1);
const seek90B = evaluateAndAnalyze(Math.PI / 2, 2);
assert.deepEqual(seek90A.result.vertices, seek90B.result.vertices, 'random seek is stateless and deterministic');

const strictWidth = analyzeRasterLineRibbonDeformation(
    generated.topology,
    bend90.result.vertices,
    { minimumDeformedWidthRatio: 0.9 }
);
assert.equal(strictWidth.reason, 'deformed-width-ratio-out-of-range');

const fillGenerated = createAutoShapeRasterBoneSetup(asset, 'stroke-raster', snapshot, {
    boneIds: ['upper', 'lower'],
    maxVertices: 128,
    maxBoundaryVertices: 48,
    reservedInteriorVertices: 16,
    maxAreaError: 1,
    guardDistance: 0.5,
    idFactory: kind => `fill-${kind}`
});
assert.equal(fillGenerated.ok, true, `Phase 7h FILL remains available as the explicit baseline: ${fillGenerated.reason}`);
const fillEvaluation = evaluateRasterBoneSkinning({
    ...asset,
    meshDefinitions: [fillGenerated.meshDefinition],
    skinBindings: [fillGenerated.skinBinding]
}, createClip(Math.PI / 2), 0);
assert.equal(fillEvaluation.ok, true, 'FILL and LINE use the same existing inverse-bind LBS evaluator');
assert.equal(fillEvaluation.meshResults.length, 1);

assert.equal(getLineRibbonRasterMeshStatus(generated.meshDefinition, snapshot).state, 'current');
assert.equal(
    getLineRibbonRasterMeshStatus(generated.meshDefinition, { ...snapshot, updatedAt: 101 }).state,
    'stale'
);
assert.equal(
    getLineRibbonRasterMeshStatus({ ...generated.meshDefinition, generator: { type: 'manual' } }, snapshot).state,
    'manual'
);
const rebased = rebaseLineRibbonRasterMeshSource(generated.meshDefinition, { ...snapshot, updatedAt: 101 });
assert.equal(getLineRibbonRasterMeshStatus(rebased, { ...snapshot, updatedAt: 101 }).state, 'current');
assert.deepEqual(rebased.vertices, generated.meshDefinition.vertices, 'source rebase does not alter topology');

const deterministicA = createLineRibbonRasterBoneSetup(asset, 'stroke-raster', snapshot, options);
const deterministicB = createLineRibbonRasterBoneSetup(asset, 'stroke-raster', snapshot, options);
assert.deepEqual(deterministicA, deterministicB, 'fixed idFactory makes complete LINE setup deterministic');

assert.equal(createLineRibbonRasterBoneSetup({ internalLayers: [] }, 'missing', snapshot).reason, 'layer-not-found');
assert.equal(createLineRibbonRasterBoneSetup({
    internalLayers: [{ id: 'folder', type: 'folder' }]
}, 'folder', snapshot).reason, 'raster-required');
assert.equal(createLineRibbonRasterBoneSetup({
    ...asset,
    rigDefinition: { version: 1, parts: [], bones: [rigDefinition.bones[0]] }
}, 'stroke-raster', snapshot, { boneIds: ['upper'] }).reason, 'line-ribbon-bone-count');
assert.equal(createLineRibbonRasterBoneSetup({
    ...asset,
    rigDefinition: {
        version: 1,
        parts: [],
        bones: [
            rigDefinition.bones[0],
            { ...rigDefinition.bones[1], boneId: 'left' },
            { ...rigDefinition.bones[1], boneId: 'right' }
        ]
    }
}, 'stroke-raster', snapshot, { boneIds: ['upper', 'left', 'right'] }).reason, 'line-ribbon-bone-chain-required');

console.log('verify-line-ribbon-raster-bone-setup: longitudinal triplet weights, existing Mesh/Skin/Project shape, identity/45/90 LBS width gates, FILL baseline, random seek, STALE/rebase and rejection gates OK');
