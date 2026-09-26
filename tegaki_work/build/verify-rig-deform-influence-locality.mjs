import assert from 'node:assert/strict';

import {
    ALPHA_FIT_GRID_GENERATOR,
    ALPHA_FIT_GRID_MAX_INFLUENCES,
    createAlphaFitRasterBoneSetup
} from '../system/animation/raster-bone-auto-setup.js';
import {
    evaluateRasterBoneSkinning,
    RASTER_MESH_MAX_INFLUENCES
} from '../system/animation/raster-bone-skinning.js';
import { evaluateRigidBones } from '../system/animation/part-rig.js';
import { applyTransformMatrix, invertTransformMatrix, multiplyTransformMatrices } from '../system/transform-math.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';
import { assertCanonicalRigGeometry, canonicalHumanoidBones } from './verify-rig-canonical-geometry.mjs';

const WIDTH = 200;
const HEIGHT = 200;
const ARM_MOTION_X = 60;
const WEIGHT_REPORT_EPSILON = 1e-6;
const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);

function fillRect(x0, y0, x1, y1, rgba) {
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            pixels.set(rgba, (y * WIDTH + x) * 4);
        }
    }
}

// Three separated opaque islands: Arm (left), Head (upper right), Leg (lower right).
const artworkRegions = [
    { color: 'arm', x0: 0, y0: 92, x1: 40, y1: 108 },
    { color: 'head', x0: 70, y0: 10, x1: 120, y1: 55 },
    { color: 'leg', x0: 70, y0: 140, x1: 120, y1: 190 }
];
const regionColor = { arm: [255, 0, 0, 255], head: [0, 255, 0, 255], leg: [0, 0, 255, 255] };
for (const region of artworkRegions) {
    fillRect(region.x0, region.y0, region.x1, region.y1, regionColor[region.color]);
}

const snapshot = {
    id: 'deform-influence-locality-fixture',
    updatedAt: 1,
    width: WIDTH,
    height: HEIGHT,
    rasterBounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    pixels
};

const baseAsset = {
    id: 'deform-influence-locality-fixture',
    internalLayers: [{ id: 'art', type: 'raster', parentLayerId: null }],
    rigDefinition: {
        version: 1,
        parts: [],
        bones: canonicalHumanoidBones()
    }
};
assertCanonicalRigGeometry('disconnected-islands', baseAsset.rigDefinition.bones, artworkRegions);

const bindAsset = JSON.stringify(baseAsset);
let nextId = 0;
const setup = createAlphaFitRasterBoneSetup(baseAsset, 'art', snapshot, {
    idFactory: kind => `${kind}-${nextId++}`
});
assert.equal(setup.ok, true, 'AUTO GRID fixture setup succeeds');
assert.equal(JSON.stringify(baseAsset), bindAsset, 'AUTO GRID setup leaves its source fixture immutable');
assert.equal(setup.meshDefinition.generator.type, ALPHA_FIT_GRID_GENERATOR);

const asset = {
    ...baseAsset,
    meshDefinitions: [setup.meshDefinition],
    skinBindings: [setup.skinBinding]
};
const clip = {
    startFrame: 0,
    duration: 2,
    rigMotion: {
        version: 1,
        partTracks: [],
        boneTracks: [{
            boneId: 'arm',
            keyframes: [{
                frame: 0,
                interpolation: 'hold',
                x: ARM_MOTION_X,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0
            }]
        }]
    }
};

const bindSkeleton = evaluateRigidBones(asset, null, 0);
const posedSkeleton = evaluateRigidBones(asset, clip, 0);
assert.equal(bindSkeleton.ok, true, 'bind hierarchy evaluates');
assert.equal(posedSkeleton.ok, true, 'Arm Motion hierarchy evaluates');
for (const boneId of ['root', 'head', 'leg']) {
    assert.deepEqual(
        posedSkeleton.poseByBoneId.get(boneId)?.worldMatrix,
        bindSkeleton.poseByBoneId.get(boneId)?.worldMatrix,
        `${boneId} sibling world transform is unchanged by Arm Motion`
    );
}
assert.notDeepEqual(
    posedSkeleton.poseByBoneId.get('arm')?.worldMatrix,
    bindSkeleton.poseByBoneId.get('arm')?.worldMatrix,
    'Arm world transform changes'
);

const bindSkin = evaluateRasterBoneSkinning(asset, null, 0);
const posedSkin = evaluateRasterBoneSkinning(asset, clip, 0);
assert.equal(bindSkin.ok, true, 'bind Skin evaluates');
assert.equal(posedSkin.ok, true, 'posed Skin evaluates');
const bindMesh = bindSkin.resultByMeshId.get(setup.meshDefinition.meshId);
const posedMesh = posedSkin.resultByMeshId.get(setup.meshDefinition.meshId);
assert.ok(bindMesh && posedMesh, 'both frame results contain the target Mesh');

const weightsByVertexId = new Map(setup.skinBinding.vertexWeights.map(row => [row.vertexId, row.influences]));
const boneIds = asset.rigDefinition.bones.map(bone => bone.boneId);
const perBone = Object.fromEntries(boneIds.map(boneId => [boneId, {
    positiveVertexCount: 0,
    reportThresholdVertexCount: 0,
    maxWeight: 0,
    influencedBounds: null
}]));
const vertexRows = [];
const influenceCountHistogram = {};
const bindPoseByBoneId = bindSkeleton.poseByBoneId;
const posedPoseByBoneId = posedSkeleton.poseByBoneId;
const skinMatrixByBoneId = new Map();
for (const boneId of boneIds) {
    const bindMatrix = bindPoseByBoneId.get(boneId)?.worldMatrix;
    const posedMatrix = posedPoseByBoneId.get(boneId)?.worldMatrix;
    skinMatrixByBoneId.set(
        boneId,
        multiplyTransformMatrices(posedMatrix, invertTransformMatrix(bindMatrix))
    );
}

for (const vertex of setup.meshDefinition.vertices) {
    const influences = weightsByVertexId.get(vertex.vertexId) || [];
    const weightSum = influences.reduce((sum, influence) => sum + influence.weight, 0);
    const strongest = [...influences].sort((left, right) => right.weight - left.weight)[0] || null;
    influenceCountHistogram[influences.length] = (influenceCountHistogram[influences.length] || 0) + 1;
    assert.ok(influences.length <= ALPHA_FIT_GRID_MAX_INFLUENCES, 'AUTO GRID does not exceed its two-influence cap');
    assert.ok(influences.length <= RASTER_MESH_MAX_INFLUENCES, 'generated weights satisfy runtime validation cap');
    assert.ok(influences.every(influence => influence.weight > 0), 'generated influences are strictly positive');
    assert.ok(Math.abs(weightSum - 1) <= 1e-9, 'generated influence weights sum to one');

    let expectedX = 0;
    let expectedY = 0;
    let expectedArmDx = 0;
    for (const influence of influences) {
        const normalizedWeight = influence.weight / weightSum;
        const transformed = applyTransformMatrix(
            skinMatrixByBoneId.get(influence.boneId),
            vertex.x,
            vertex.y
        );
        expectedX += transformed.x * normalizedWeight;
        expectedY += transformed.y * normalizedWeight;
        if (influence.boneId === 'arm') {
            expectedArmDx += (transformed.x - vertex.x) * normalizedWeight;
        }
        const stats = perBone[influence.boneId];
        stats.positiveVertexCount += 1;
        if (influence.weight > WEIGHT_REPORT_EPSILON) stats.reportThresholdVertexCount += 1;
        stats.maxWeight = Math.max(stats.maxWeight, influence.weight);
        const bounds = stats.influencedBounds || {
            minX: vertex.x, minY: vertex.y, maxX: vertex.x, maxY: vertex.y
        };
        bounds.minX = Math.min(bounds.minX, vertex.x);
        bounds.minY = Math.min(bounds.minY, vertex.y);
        bounds.maxX = Math.max(bounds.maxX, vertex.x);
        bounds.maxY = Math.max(bounds.maxY, vertex.y);
        stats.influencedBounds = bounds;
    }

    const runtimeVertex = posedMesh.vertices.find(candidate => candidate.vertexId === vertex.vertexId);
    assert.ok(runtimeVertex, `runtime result includes ${vertex.vertexId}`);
    assert.ok(Math.abs(runtimeVertex.x - expectedX) <= 1e-9, `${vertex.vertexId} runtime X matches weighted matrix contribution`);
    assert.ok(Math.abs(runtimeVertex.y - expectedY) <= 1e-9, `${vertex.vertexId} runtime Y matches weighted matrix contribution`);
    assert.ok(Math.abs((runtimeVertex.x - vertex.x) - expectedArmDx) <= 1e-9,
        `${vertex.vertexId} runtime Arm contribution matches its normalized weight`);

    vertexRows.push({
        vertexId: vertex.vertexId,
        position: { x: vertex.x, y: vertex.y },
        influences: influences.map(influence => ({ boneId: influence.boneId, weight: influence.weight })),
        weightSum,
        strongestBoneId: strongest?.boneId || null,
        strongestWeight: strongest?.weight || 0,
        influenceCount: influences.length,
        armMotionDeltaX: runtimeVertex.x - vertex.x,
        runtime: { x: runtimeVertex.x, y: runtimeVertex.y }
    });
}

const meshVertexById = new Map(setup.meshDefinition.vertices.map(vertex => [vertex.vertexId, vertex]));
function highestArmWeightInside({ x0, y0, x1, y1 }) {
    return setup.meshDefinition.vertices
        .filter(vertex => vertex.x >= x0 && vertex.x <= x1 && vertex.y >= y0 && vertex.y <= y1)
        .map(vertex => ({
            vertex,
            armInfluence: (weightsByVertexId.get(vertex.vertexId) || [])
                .find(influence => influence.boneId === 'arm') || null,
            posed: posedMesh.vertices.find(candidate => candidate.vertexId === vertex.vertexId)
        }))
        .sort((left, right) => (right.armInfluence?.weight || 0) - (left.armInfluence?.weight || 0))[0] || null;
}

const headSample = highestArmWeightInside({ x0: 70, y0: 10, x1: 120, y1: 55 });
const legSample = highestArmWeightInside({ x0: 70, y0: 140, x1: 120, y1: 190 });
assert.ok(headSample?.armInfluence?.weight > 0, 'Arm has non-zero influence on a Head-region vertex');
assert.ok(legSample?.armInfluence?.weight > 0, 'Arm has non-zero influence on a Leg-region vertex');

function connectedComponentCount(mesh) {
    const parent = new Map(mesh.vertices.map(vertex => [vertex.vertexId, vertex.vertexId]));
    const find = id => {
        const current = parent.get(id);
        if (current === id) return id;
        const root = find(current);
        parent.set(id, root);
        return root;
    };
    for (const triangle of mesh.triangles) {
        const [first, ...rest] = triangle;
        for (const vertexId of rest) parent.set(find(vertexId), find(first));
    }
    return new Set([...parent.keys()].map(find)).size;
}

function isOpaqueAt(x, y) {
    const px = Math.max(0, Math.min(WIDTH - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(HEIGHT - 1, Math.floor(y)));
    return pixels[(py * WIDTH + px) * 4 + 3] > 0;
}
const transparentInteriorTriangleCount = setup.meshDefinition.triangles.filter(triangle => {
    const points = triangle.map(vertexId => meshVertexById.get(vertexId));
    const centroid = {
        x: points.reduce((sum, point) => sum + point.x, 0) / 3,
        y: points.reduce((sum, point) => sum + point.y, 0) / 3
    };
    return !isOpaqueAt(centroid.x, centroid.y);
}).length;
const meshComponentCount = connectedComponentCount(setup.meshDefinition);
assert.equal(meshComponentCount, 1, 'AUTO GRID creates one connected rectangular topology');
assert.ok(transparentInteriorTriangleCount > 0, 'AUTO GRID topology spans transparent space between artwork islands');

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

const bindImage = deformRasterSnapshotWithSkin(snapshot, bindMesh);
const posedImage = deformRasterSnapshotWithSkin(snapshot, posedMesh);
assert.ok(bindImage && posedImage, 'CPU triangle skin rasterizer returns bind and posed images');
const regionPixels = {
    head: {
        bind: colorCentroid(bindImage, 1),
        posed: colorCentroid(posedImage, 1)
    },
    leg: {
        bind: colorCentroid(bindImage, 2),
        posed: colorCentroid(posedImage, 2)
    }
};
regionPixels.head.deltaX = regionPixels.head.posed.x - regionPixels.head.bind.x;
regionPixels.leg.deltaX = regionPixels.leg.posed.x - regionPixels.leg.bind.x;
assert.ok(regionPixels.head.deltaX > 0.5, 'Arm Motion shifts Head artwork pixels through Skin weights and the connected grid');
assert.ok(regionPixels.leg.deltaX > 0.5, 'Arm Motion shifts Leg artwork pixels through Skin weights and the connected grid');

console.log('verify-rig-deform-influence-locality: PASS');
console.log(JSON.stringify({
    fixture: {
        opaqueIslands: ['Arm', 'Head', 'Leg'],
        bounds: setup.contentBounds,
        grid: setup.dimensions,
        meshVertexCount: setup.meshDefinition.vertices.length,
        triangleCount: setup.meshDefinition.triangles.length,
        connectedMeshComponents: meshComponentCount,
        trianglesWithTransparentCentroid: transparentInteriorTriangleCount,
        armMotionX: ARM_MOTION_X
    },
    influenceCaps: {
      autoGridMax: ALPHA_FIT_GRID_MAX_INFLUENCES,
      runtimeValidatorMax: RASTER_MESH_MAX_INFLUENCES
    },
    influenceCountHistogram,
    perBone,
    headSample: {
        vertexId: headSample.vertex.vertexId,
        position: { x: headSample.vertex.x, y: headSample.vertex.y },
        armWeight: headSample.armInfluence.weight,
        movedX: headSample.posed.x - headSample.vertex.x
    },
    legSample: {
        vertexId: legSample.vertex.vertexId,
        position: { x: legSample.vertex.x, y: legSample.vertex.y },
        armWeight: legSample.armInfluence.weight,
        movedX: legSample.posed.x - legSample.vertex.x
    },
    artworkPixelCentroids: regionPixels,
    vertexInfluences: vertexRows
}, null, 2));
