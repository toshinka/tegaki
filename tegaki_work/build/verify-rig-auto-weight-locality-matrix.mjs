import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
    createAlphaFitRasterBoneSetup,
    createRasterBoneBindSegments
} from '../system/animation/raster-bone-auto-setup.js';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';
import { assertCanonicalRigGeometry, canonicalHumanoidBones, canonicalChainBones,
    canonicalBranchBones, degreesToRadians } from './verify-rig-canonical-geometry.mjs';

const WIDTH = 200;
const HEIGHT = 200;
const UNIT = { scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
const COLORS = {
    arm: [255, 0, 0, 255],
    head: [0, 255, 0, 255],
    leg: [0, 0, 255, 255],
    torso: [0, 0, 0, 255]
};

function makeSnapshot(id, rectangles) {
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (const { x0, y0, x1, y1, color } of rectangles) {
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                pixels.set(COLORS[color], (y * WIDTH + x) * 4);
            }
        }
    }
    return {
        id, updatedAt: 1, width: WIDTH, height: HEIGHT,
        rasterBounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        pixels
    };
}

function countOpaqueComponents(snapshot) {
    const visited = new Uint8Array(snapshot.width * snapshot.height);
    let components = 0;
    for (let index = 0; index < visited.length; index++) {
        if (visited[index] || snapshot.pixels[index * 4 + 3] === 0) continue;
        components++;
        const queue = [index];
        visited[index] = 1;
        for (let head = 0; head < queue.length; head++) {
            const point = queue[head];
            const x = point % snapshot.width;
            const y = Math.floor(point / snapshot.width);
            const neighbors = [
                x > 0 ? point - 1 : -1,
                x + 1 < snapshot.width ? point + 1 : -1,
                y > 0 ? point - snapshot.width : -1,
                y + 1 < snapshot.height ? point + snapshot.width : -1
            ];
            for (const next of neighbors) {
                if (next < 0 || visited[next] || snapshot.pixels[next * 4 + 3] === 0) continue;
                visited[next] = 1;
                queue.push(next);
            }
        }
    }
    return components;
}

function bone(boneId, parentBoneId, length, x, y, rotation = 0) {
    return {
        boneId, parentBoneId, length,
        bindTransform: { ...UNIT, x, y, rotation }
    };
}

const humanoidRegions = [
    { id: 'arm', x0: 0, y0: 92, x1: 40, y1: 108, channel: 0 },
    { id: 'head', x0: 70, y0: 10, x1: 120, y1: 55, channel: 1 },
    { id: 'leg', x0: 70, y0: 140, x1: 120, y1: 190, channel: 2 }
];

const fixtures = [
    {
        id: 'disconnected-islands',
        expectedAlphaComponents: 3,
        bones: canonicalHumanoidBones(),
        rectangles: [
            { x0: 0, y0: 92, x1: 40, y1: 108, color: 'arm' },
            { x0: 70, y0: 10, x1: 120, y1: 55, color: 'head' },
            { x0: 70, y0: 140, x1: 120, y1: 190, color: 'leg' }
        ],
        regions: humanoidRegions,
        movingBoneId: 'arm',
        rootBoneId: 'root'
    },
    {
        id: 'connected-humanoid',
        expectedAlphaComponents: 1,
        bones: canonicalHumanoidBones(),
        rectangles: [
            { x0: 35, y0: 50, x1: 81, y1: 151, color: 'torso' },
            { x0: 0, y0: 92, x1: 40, y1: 108, color: 'arm' },
            { x0: 70, y0: 10, x1: 120, y1: 55, color: 'head' },
            { x0: 70, y0: 140, x1: 120, y1: 190, color: 'leg' }
        ],
        regions: humanoidRegions,
        movingBoneId: 'arm',
        rootBoneId: 'root'
    },
    {
        id: 'simple-chain',
        expectedAlphaComponents: 1,
        bones: canonicalChainBones(),
        rectangles: [
            { x0: 20, y0: 44, x1: 100, y1: 56, color: 'arm' },
            { x0: 100, y0: 44, x1: 180, y1: 56, color: 'head' }
        ],
        regions: [
            { id: 'upper', x0: 20, y0: 44, x1: 100, y1: 56, channel: 0 },
            { id: 'lower', x0: 100, y0: 44, x1: 180, y1: 56, channel: 1 }
        ],
        movingBoneId: 'lower',
        rootBoneId: 'root',
        joint: { x: 100, y: 50, parentBoneId: 'upper', childBoneId: 'lower' },
        motion: { x: 0, y: 0, rotation: degreesToRadians(45) }
    },
    {
        id: 'branched-skeleton',
        expectedAlphaComponents: 1,
        bones: canonicalBranchBones(),
        rectangles: [
            { x0: 90, y0: 84, x1: 110, y1: 116, color: 'torso' },
            { x0: 20, y0: 92, x1: 101, y1: 108, color: 'torso' },
            { x0: 100, y0: 92, x1: 180, y1: 108, color: 'torso' },
            { x0: 92, y0: 20, x1: 108, y1: 100, color: 'torso' },
            { x0: 20, y0: 92, x1: 70, y1: 108, color: 'arm' },
            { x0: 130, y0: 92, x1: 180, y1: 108, color: 'head' },
            { x0: 92, y0: 20, x1: 108, y1: 70, color: 'leg' }
        ],
        regions: [
            { id: 'left', x0: 20, y0: 92, x1: 70, y1: 108, channel: 0 },
            { id: 'right', x0: 130, y0: 92, x1: 180, y1: 108, channel: 1 },
            { id: 'center', x0: 92, y0: 20, x1: 108, y1: 70, channel: 2 }
        ],
        movingBoneId: 'left',
        rootBoneId: 'root'
    }
];

function makeAsset(fixture) {
    return {
        id: fixture.id,
        internalLayers: [{ id: 'art', type: 'raster', parentLayerId: null }],
        rigDefinition: { version: 1, parts: [], bones: fixture.bones }
    };
}

function motionClip(boneId, motion = { x: 60, y: 0, rotation: 0 }) {
    return {
        startFrame: 0, duration: 2,
        rigMotion: {
            version: 1, partTracks: [],
            boneTracks: [{
                boneId,
                keyframes: [{
                    frame: 0, interpolation: 'hold',
                    x: motion.x, y: motion.y,
                    scaleX: 1, scaleY: 1, rotation: motion.rotation
                }]
            }]
        }
    };
}

function segmentDistance(point, segment) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared > 1e-12
        ? Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx
            + (point.y - segment.start.y) * dy) / lengthSquared))
        : 0;
    return Math.hypot(point.x - segment.start.x - ratio * dx,
        point.y - segment.start.y - ratio * dy);
}

function rankedSegments(point, segments) {
    return segments.map(segment => ({
        boneId: segment.boneId,
        segment,
        distance: segmentDistance(point, segment),
        length: Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
    })).sort((left, right) => left.distance - right.distance
        || left.boneId.localeCompare(right.boneId));
}

function inverseDistanceWeights(ranked) {
    const nearest = ranked.slice(0, 2);
    if (nearest.length === 0) return [];
    if (nearest[0].distance <= 1e-6) return [{ boneId: nearest[0].boneId, weight: 1 }];
    const scores = nearest.map(candidate => 1 / Math.max(1e-12, candidate.distance ** 2));
    const total = scores.reduce((sum, score) => sum + score, 0);
    return nearest.map((candidate, index) => ({
        boneId: candidate.boneId, weight: scores[index] / total
    }));
}

function rootAncestor(boneId, parentById) {
    let current = boneId;
    const seen = new Set();
    while (parentById.get(current) && !seen.has(current)) {
        seen.add(current);
        current = parentById.get(current);
    }
    return current;
}

function gateRadius(candidate, gridDiagonal, gridFactor = 0.75) {
    return Math.max(candidate.length * 0.5, gridDiagonal * gridFactor);
}

function relatedJointWeights(point, anchor, ranked, parentById, childrenById) {
    const relatives = new Set([
        parentById.get(anchor.boneId),
        ...(childrenById.get(anchor.boneId) || [])
    ].filter(Boolean));
    const candidates = ranked.filter(candidate => relatives.has(candidate.boneId));
    let closest = null;
    for (const candidate of candidates) {
        const child = parentById.get(anchor.boneId) === candidate.boneId
            ? anchor : candidate;
        const parent = child === anchor ? candidate : anchor;
        const band = 0.3 * Math.min(child.length, parent.length);
        if (!(band > 0)) continue;
        const jointDistance = Math.hypot(point.x - child.segment.start.x,
            point.y - child.segment.start.y);
        if (!(jointDistance < band)) continue;
        if (!closest || jointDistance / band < closest.ratio) {
            closest = { candidate, ratio: jointDistance / band };
        }
    }
    if (!closest) return [{ boneId: anchor.boneId, weight: 1 }];
    const t = closest.ratio;
    const smooth = t * t * (3 - 2 * t);
    const companionWeight = 0.5 * (1 - smooth);
    return [
        { boneId: anchor.boneId, weight: 1 - companionWeight },
        { boneId: closest.candidate.boneId, weight: companionWeight }
    ];
}

function policyWeights(policy, point, context) {
    const ranked = rankedSegments(point, context.segments);
    const anchor = ranked[0];
    if (!anchor) return [];
    const gridFactor = policy === 'D-gated-joint-tight'
        ? 0.5 : policy === 'D-gated-joint-wide' ? 1 : 0.75;
    const eligible = ranked.filter(candidate => (
        candidate.distance <= gateRadius(candidate, context.gridDiagonal, gridFactor)
    ));
    if (policy === 'A-gate-root' || policy === 'A-gate-bind' || policy === 'A-gate-nearest') {
        if (eligible.length > 0) return inverseDistanceWeights(eligible);
        if (policy === 'A-gate-bind') return [];
        const fallbackId = policy === 'A-gate-root'
            ? rootAncestor(anchor.boneId, context.parentById)
            : anchor.boneId;
        return [{ boneId: fallbackId, weight: 1 }];
    }
    if (policy === 'B-skeleton') {
        const relativeIds = new Set([
            anchor.boneId,
            context.parentById.get(anchor.boneId),
            ...(context.childrenById.get(anchor.boneId) || [])
        ].filter(Boolean));
        return inverseDistanceWeights(ranked.filter(candidate => relativeIds.has(candidate.boneId)));
    }
    if (policy === 'C-joint') {
        return relatedJointWeights(point, anchor, ranked,
            context.parentById, context.childrenById);
    }
    if (policy.startsWith('D-gated-joint')) {
        if (eligible.length === 0) {
            return [{ boneId: rootAncestor(anchor.boneId, context.parentById), weight: 1 }];
        }
        return relatedJointWeights(point, eligible[0], eligible,
            context.parentById, context.childrenById);
    }
    throw new Error(`unknown policy ${policy}`);
}

function colorCentroid(image, channel) {
    let mass = 0;
    let xMoment = 0;
    let yMoment = 0;
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const value = image.pixels[(y * image.width + x) * 4 + channel] / 255;
            if (!(value > 0)) continue;
            mass += value;
            xMoment += (image.bounds.x + x + 0.5) * value;
            yMoment += (image.bounds.y + y + 0.5) * value;
        }
    }
    return mass > 0 ? { x: xMoment / mass, y: yMoment / mass, mass } : null;
}

function signedArea2(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function getJointMetric(vertexWeights, vertices, joint) {
    if (!joint) return null;
    const byId = new Map(vertexWeights.map(row => [row.vertexId, row.influences]));
    const near = vertices.filter(vertex => Math.abs(vertex.x - joint.x) < 32);
    const blend = near.filter(vertex => {
        const influences = byId.get(vertex.vertexId) || [];
        const parent = influences.find(item => item.boneId === joint.parentBoneId)?.weight || 0;
        const child = influences.find(item => item.boneId === joint.childBoneId)?.weight || 0;
        return parent > 0.05 && child > 0.05;
    });
    const rows = new Map();
    for (const vertex of vertices) {
        if (!rows.has(vertex.y)) rows.set(vertex.y, []);
        rows.get(vertex.y).push(vertex);
    }
    let maxAdjacentParentWeightStep = 0;
    for (const row of rows.values()) {
        row.sort((left, right) => left.x - right.x);
        for (let index = 1; index < row.length; index++) {
            const left = byId.get(row[index - 1].vertexId) || [];
            const right = byId.get(row[index].vertexId) || [];
            const leftWeight = left.find(item => item.boneId === joint.parentBoneId)?.weight || 0;
            const rightWeight = right.find(item => item.boneId === joint.parentBoneId)?.weight || 0;
            maxAdjacentParentWeightStep = Math.max(maxAdjacentParentWeightStep,
                Math.abs(rightWeight - leftWeight));
        }
    }
    return { nearVertexCount: near.length, blendVertexCount: blend.length,
        maxAdjacentParentWeightStep };
}

function evaluatePolicy(fixture, snapshot, baseAsset, setup, context, policy) {
    const vertexWeights = policy === 'current'
        ? setup.skinBinding.vertexWeights
        : setup.meshDefinition.vertices.map(vertex => ({
            vertexId: vertex.vertexId,
            influences: policyWeights(policy, vertex, context)
        }));
    const asset = {
        ...baseAsset,
        meshDefinitions: [setup.meshDefinition],
        skinBindings: [{ ...setup.skinBinding, vertexWeights }]
    };
    const meshId = setup.meshDefinition.meshId;
    const bind = evaluateRasterBoneSkinning(asset, null, 0);
    const posed = evaluateRasterBoneSkinning(asset,
        motionClip(fixture.movingBoneId, fixture.motion), 0);
    const rootPosed = evaluateRasterBoneSkinning(asset,
        motionClip(fixture.rootBoneId, { x: 20, y: 0, rotation: 0 }), 0);
    assert.equal(bind.ok, true, `${fixture.id}/${policy} bind Skin valid`);
    assert.equal(posed.ok, true, `${fixture.id}/${policy} posed Skin valid`);
    assert.equal(rootPosed.ok, true, `${fixture.id}/${policy} root Skin valid`);
    const bindMesh = bind.resultByMeshId.get(meshId);
    const posedMesh = posed.resultByMeshId.get(meshId);
    const rootMesh = rootPosed.resultByMeshId.get(meshId);
    assert.ok(bindMesh && posedMesh && rootMesh);
    const bindImage = deformRasterSnapshotWithSkin(snapshot, bindMesh);
    const posedImage = deformRasterSnapshotWithSkin(snapshot, posedMesh);
    assert.ok(bindImage && posedImage, `${fixture.id}/${policy} CPU raster valid`);

    const weightsById = new Map(vertexWeights.map(row => [row.vertexId, row.influences]));
    const unrelated = fixture.regions.filter(region => region.id !== fixture.movingBoneId)
        .map(region => {
            const regionVertices = setup.meshDefinition.vertices.filter(vertex => (
                vertex.x >= region.x0 && vertex.x <= region.x1
                && vertex.y >= region.y0 && vertex.y <= region.y1
            ));
            const weights = regionVertices.map(vertex => (
                weightsById.get(vertex.vertexId)?.find(item => item.boneId === fixture.movingBoneId)?.weight || 0
            ));
            const before = colorCentroid(bindImage, region.channel);
            const after = colorCentroid(posedImage, region.channel);
            assert.ok(before && after, `${fixture.id}/${policy}/${region.id} region visible`);
            return {
                id: region.id,
                vertexCount: weights.length,
                positiveWeightCount: weights.filter(weight => weight > 0).length,
                maxWeight: Math.max(0, ...weights),
                meanWeight: weights.length > 0
                    ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length : 0,
                pixelCentroidDx: after.x - before.x,
                pixelCentroidDy: after.y - before.y
            };
        });
    const movingRegion = fixture.regions.find(region => region.id === fixture.movingBoneId);
    const movingBefore = colorCentroid(bindImage, movingRegion.channel);
    const movingAfter = colorCentroid(posedImage, movingRegion.channel);
    let flippedTriangleCount = 0;
    let collapsedTriangleCount = 0;
    let minimumAreaRatio = Infinity;
    for (const triangle of bindMesh.triangleIndices) {
        const bindArea = signedArea2(...triangle.map(index => bindMesh.vertices[index]));
        const posedArea = signedArea2(...triangle.map(index => posedMesh.vertices[index]));
        const ratio = Math.abs(posedArea) / Math.abs(bindArea);
        minimumAreaRatio = Math.min(minimumAreaRatio, ratio);
        if (bindArea * posedArea < 0) flippedTriangleCount++;
        if (ratio < 0.1) collapsedTriangleCount++;
    }
    let rootMaxDeltaError = 0;
    for (let index = 0; index < rootMesh.vertices.length; index++) {
        const vertex = rootMesh.vertices[index];
        const source = setup.meshDefinition.vertices[index];
        rootMaxDeltaError = Math.max(rootMaxDeltaError,
            Math.abs(vertex.x - source.x - 20), Math.abs(vertex.y - source.y));
    }
    let unweightedVertexCount = 0;
    let maxInfluenceCount = 0;
    let invalidSumCount = 0;
    let movingBonePositiveVertexCount = 0;
    for (const row of vertexWeights) {
        const influences = row.influences || [];
        if (influences.length === 0) unweightedVertexCount++;
        maxInfluenceCount = Math.max(maxInfluenceCount, influences.length);
        if (influences.some(item => item.boneId === fixture.movingBoneId && item.weight > 0)) {
            movingBonePositiveVertexCount++;
        }
        const sum = influences.reduce((total, item) => total + item.weight, 0);
        if (influences.length > 0 && Math.abs(sum - 1) > 1e-9) invalidSumCount++;
    }
    const finiteResult = posedMesh.vertices.every(vertex => (
        Number.isFinite(vertex.x) && Number.isFinite(vertex.y)
    ));
    return {
        fixture: fixture.id, policy,
        meshVertices: setup.meshDefinition.vertices.length,
        triangles: setup.meshDefinition.triangles.length,
        movingBonePositiveVertexCount,
        unrelated,
        movingRegionCentroidDx: movingAfter.x - movingBefore.x,
        movingRegionCentroidDy: movingAfter.y - movingBefore.y,
        movingRegionColorMassRatio: movingAfter.mass / movingBefore.mass,
        flippedTriangleCount, collapsedTriangleCount, minimumAreaRatio,
        joint: getJointMetric(vertexWeights, setup.meshDefinition.vertices, fixture.joint),
        invalidSumCount, maxInfluenceCount, unweightedVertexCount,
        rootMaxDeltaError, finiteResult
    };
}

const policies = [
    'current', 'A-gate-root', 'A-gate-bind', 'A-gate-nearest',
    'B-skeleton', 'C-joint', 'D-gated-joint-tight', 'D-gated-joint',
    'D-gated-joint-wide'
];
const results = [];
const fixtureInfo = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const snapshot = makeSnapshot(fixture.id, fixture.rectangles);
    const alphaComponents = countOpaqueComponents(snapshot);
    assert.equal(alphaComponents, fixture.expectedAlphaComponents,
        `${fixture.id} alpha connectedness matches fixture purpose`);
    const asset = makeAsset(fixture);
    let nextId = 0;
    const setup = createAlphaFitRasterBoneSetup(asset, 'art', snapshot, {
        idFactory: kind => `${fixture.id}-${kind}-${nextId++}`
    });
    assert.equal(setup.ok, true, `${fixture.id} AUTO GRID setup valid`);
    const bind = createRasterBoneBindSegments(asset);
    assert.equal(bind.ok, true, `${fixture.id} bind segments valid`);
    const gridDiagonal = Math.hypot(
        setup.bindBounds.width / (setup.dimensions.columns - 1),
        setup.bindBounds.height / (setup.dimensions.rows - 1)
    );
    const parentById = new Map(fixture.bones.map(item => [item.boneId, item.parentBoneId]));
    const childrenById = new Map(fixture.bones.map(item => [item.boneId, []]));
    for (const item of fixture.bones) {
        if (item.parentBoneId) childrenById.get(item.parentBoneId).push(item.boneId);
    }
    const context = { segments: bind.segments, gridDiagonal, parentById, childrenById };
    fixtureInfo.push({ fixture: fixture.id, alphaComponents,
        grid: setup.dimensions, gridDiagonal, boneCount: bind.segments.length });
    for (const policy of policies) {
        results.push(evaluatePolicy(fixture, snapshot, asset, setup, context, policy));
    }
}

const currentDisconnected = results.find(row => (
    row.fixture === 'disconnected-islands' && row.policy === 'current'
));
assert.equal(currentDisconnected.meshVertices, 32);
assert.equal(currentDisconnected.triangles, 42);
assert.ok(Math.abs(currentDisconnected.unrelated.find(row => row.id === 'head').pixelCentroidDx
    - 5.48062213156553) < 1e-6, 'canonical R-43 Head baseline matches');
assert.ok(Math.abs(currentDisconnected.unrelated.find(row => row.id === 'leg').pixelCentroidDx
    - 6.23890214797136) < 1e-6, 'canonical R-43 Leg baseline matches');
assert.equal(currentDisconnected.movingBonePositiveVertexCount, 28);

function benchmarkGenerator(boneCount) {
    const width = 512;
    const height = 512;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 32; y < 480; y++) {
        for (let x = 32; x < 480; x++) {
            pixels[(y * width + x) * 4 + 3] = 255;
        }
    }
    const snapshot = {
        id: `benchmark-${boneCount}`, updatedAt: 1, width, height,
        rasterBounds: { x: 0, y: 0, width, height }, pixels
    };
    const bones = [bone('root', null, 0, 256, 256)];
    for (let index = 1; index < boneCount; index++) {
        bones.push(bone(`branch-${index}`, 'root', 120, 0, 0,
            degreesToRadians(360 * (index - 1) / (boneCount - 1))));
    }
    const asset = makeAsset({ id: snapshot.id, bones });
    const parentById = new Map(bones.map(item => [item.boneId, item.parentBoneId]));
    const childrenById = new Map(bones.map(item => [item.boneId, []]));
    for (const item of bones) {
        if (item.parentBoneId) childrenById.get(item.parentBoneId).push(item.boneId);
    }
    const generateCurrent = () => {
        let nextId = 0;
        return createAlphaFitRasterBoneSetup(asset, 'art', snapshot, {
            idFactory: kind => `${kind}-${nextId++}`
        });
    };
    const generateCandidateUpperBound = () => {
        const setup = generateCurrent();
        const segmentResult = createRasterBoneBindSegments(asset);
        const gridDiagonal = Math.hypot(
            setup.bindBounds.width / (setup.dimensions.columns - 1),
            setup.bindBounds.height / (setup.dimensions.rows - 1)
        );
        const context = {
            segments: segmentResult.segments, gridDiagonal, parentById, childrenById
        };
        for (const vertex of setup.meshDefinition.vertices) {
            policyWeights('D-gated-joint', vertex, context);
        }
        return setup;
    };
    assert.equal(generateCurrent().ok, true);
    assert.equal(generateCandidateUpperBound().ok, true);
    for (let index = 0; index < 5; index++) {
        generateCurrent();
        generateCandidateUpperBound();
    }
    const currentSamples = [];
    const candidateSamples = [];
    for (let index = 0; index < 40; index++) {
        let start = performance.now();
        generateCurrent();
        currentSamples.push(performance.now() - start);
        start = performance.now();
        generateCandidateUpperBound();
        candidateSamples.push(performance.now() - start);
    }
    const summarize = samples => {
        const sorted = [...samples].sort((left, right) => left - right);
        return {
            medianMs: sorted[Math.floor(sorted.length / 2)],
            p95Ms: sorted[Math.floor(sorted.length * 0.95)]
        };
    };
    return {
        raster: '512x512', boneCount, vertices: generateCurrent().meshDefinition.vertices.length,
        samplesPerMode: 40,
        current: summarize(currentSamples),
        candidateUpperBound: summarize(candidateSamples)
    };
}

console.log('verify-rig-auto-weight-locality-matrix: PASS');
if (process.argv.includes('--benchmark')) {
    console.log(JSON.stringify({ benchmark: [benchmarkGenerator(2), benchmarkGenerator(8)] }, null, 2));
} else {
    console.log(JSON.stringify({ policies, fixtureInfo, results }, null, 2));
}
