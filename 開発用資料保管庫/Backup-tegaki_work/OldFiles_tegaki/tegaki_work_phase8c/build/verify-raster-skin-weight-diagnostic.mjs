import assert from 'node:assert/strict';
import { createRasterSkinWeightDiagnosticProjection } from '../system/animation/raster-skin-weight-diagnostic.js';

const asset = {
    internalLayers: [{ id: 'raster-arm', type: 'raster' }],
    rigDefinition: {
        version: 1,
        parts: [],
        rigidBindings: [],
        bones: [
            { boneId: 'shoulder', parentBoneId: null, bindX: 0, bindY: 0, bindRotation: 0, length: 20 },
            { boneId: 'elbow', parentBoneId: 'shoulder', bindX: 20, bindY: 0, bindRotation: 0, length: 20 },
            { boneId: 'hand', parentBoneId: 'elbow', bindX: 20, bindY: 0, bindRotation: 0, length: 16 },
            { boneId: 'head', parentBoneId: 'shoulder', bindX: 0, bindY: -20, bindRotation: 0, length: 16 }
        ]
    },
    meshDefinitions: [{
        version: 1,
        meshId: 'mesh-arm',
        targetInternalLayerId: 'raster-arm',
        vertices: [
            { vertexId: 'v1', x: 0, y: 0 },
            { vertexId: 'v2', x: 20, y: 0 },
            { vertexId: 'v3', x: 20, y: 20 },
            { vertexId: 'v4', x: 0, y: 20 }
        ],
        triangles: [['v1', 'v2', 'v3'], ['v1', 'v3', 'v4']]
    }],
    skinBindings: [{
        version: 1,
        meshId: 'mesh-arm',
        vertexWeights: [
            { vertexId: 'v1', influences: [{ boneId: 'elbow', weight: 1 }] },
            { vertexId: 'v2', influences: [{ boneId: 'shoulder', weight: 0.5 }, { boneId: 'elbow', weight: 0.5 }] },
            { vertexId: 'v3', influences: [{ boneId: 'elbow', weight: 0.02 }, { boneId: 'hand', weight: 0.98 }] },
            { vertexId: 'v4', influences: [{ boneId: 'hand', weight: 1 }] }
        ]
    }]
};

const before = structuredClone(asset);
const projection = createRasterSkinWeightDiagnosticProjection(asset, 'raster-arm', 'elbow', {
    meshResult: {
        meshId: 'mesh-arm',
        vertices: [
            { vertexId: 'v1', x: 1, y: 2 },
            { vertexId: 'v2', x: 21, y: 2 },
            { vertexId: 'v3', x: 18, y: 22 },
            { vertexId: 'v4', x: -1, y: 20 }
        ]
    }
});

assert.equal(projection.ok, true);
assert.equal(projection.status, 'ready');
assert.equal(projection.meshId, 'mesh-arm');
assert.equal(projection.parentBoneId, 'shoulder');
assert.deepEqual(projection.childBoneIds, ['hand']);
assert.deepEqual(projection.vertices.map(vertex => vertex.weight), [1, 0.5, 0.02, 0]);
assert.deepEqual(projection.vertices.map(vertex => vertex.weightClass), ['rigid', 'blend', 'blend', 'none']);
assert.deepEqual(
    projection.vertices.map(vertex => [vertex.x, vertex.y]),
    [[1, 2], [21, 2], [18, 22], [-1, 20]],
    'Frame evaluatorの座標だけを表示projectionへ借りる'
);
assert.deepEqual(projection.triangles.map(triangle => triangle.weightClass), ['blend', 'blend']);
assert.deepEqual(projection.stats, {
    vertexCount: 4,
    triangleCount: 2,
    weightedVertexCount: 3,
    noneVertexCount: 1,
    blendVertexCount: 2,
    rigidVertexCount: 1,
    maxWeight: 1
});
assert.deepEqual(asset, before, 'read-only projectionはMesh / Skin / Rig正本を変更しない');

const unrelated = createRasterSkinWeightDiagnosticProjection(asset, 'raster-arm', 'head');
assert.equal(unrelated.ok, true);
assert.equal(unrelated.status, 'unweighted');
assert.equal(unrelated.stats.weightedVertexCount, 0);
assert.equal(unrelated.stats.maxWeight, 0);

assert.equal(
    createRasterSkinWeightDiagnosticProjection(asset, 'missing', 'elbow').reason,
    'mesh-not-found'
);
assert.equal(
    createRasterSkinWeightDiagnosticProjection(asset, 'raster-arm', 'missing').reason,
    'bone-not-found'
);

console.log('verify-raster-skin-weight-diagnostic: selected Bone projection / frame coords / nonmutation OK');

