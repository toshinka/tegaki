/**
 * ROLE: WP-035 Slice A の固定 quad/grid3 mesh profile model。
 * AUTHORITY: RML vertex/order/UV/triangle/weight profile の純粋な検証と四隅変換。
 * INVARIANTS: quad source bytes、grid3の8 outline + 1 center、公式Root/End packed weight、独自evaluatorなし。
 * RELATED: model.mjs、weight-model.mjs、WP-035-rive-grid-mesh-editing.md。
 */
import {
    assertEndWeights,
    decodePackedWeight,
    encodePackedWeight,
} from './weight-model.mjs';

export const MESH_PROFILES = Object.freeze({
    quad: 'quad',
    grid3: 'grid3',
});

export const QUAD_VERTEX_NAMES = Object.freeze(['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']);
export const GRID_VERTEX_NAMES = Object.freeze([
    'TopLeft',
    'TopCenter',
    'TopRight',
    'MiddleRight',
    'BottomRight',
    'BottomCenter',
    'BottomLeft',
    'MiddleLeft',
    'Center',
]);

export const QUAD_UV = Object.freeze([
    Object.freeze([0, 0]),
    Object.freeze([1, 0]),
    Object.freeze([1, 1]),
    Object.freeze([0, 1]),
]);

export const GRID_UV = Object.freeze([
    Object.freeze([0, 0]),
    Object.freeze([0.5, 0]),
    Object.freeze([1, 0]),
    Object.freeze([1, 0.5]),
    Object.freeze([1, 1]),
    Object.freeze([0.5, 1]),
    Object.freeze([0, 1]),
    Object.freeze([0, 0.5]),
    Object.freeze([0.5, 0.5]),
]);

export const QUAD_TRIANGLES = Object.freeze([
    Object.freeze([0, 1, 2]),
    Object.freeze([0, 2, 3]),
]);

export const GRID_TRIANGLES = Object.freeze([
    Object.freeze([0, 1, 8]),
    Object.freeze([1, 2, 8]),
    Object.freeze([2, 3, 8]),
    Object.freeze([3, 4, 8]),
    Object.freeze([4, 5, 8]),
    Object.freeze([5, 6, 8]),
    Object.freeze([6, 7, 8]),
    Object.freeze([7, 0, 8]),
]);

const PROFILE_DEFINITIONS = Object.freeze({
    quad: Object.freeze({
        profile: MESH_PROFILES.quad,
        meshName: 'QuadMesh',
        vertexNames: QUAD_VERTEX_NAMES,
        uvs: QUAD_UV,
        kinds: Object.freeze(['ContourMeshVertex', 'ContourMeshVertex', 'ContourMeshVertex', 'ContourMeshVertex']),
        triangles: QUAD_TRIANGLES,
    }),
    grid3: Object.freeze({
        profile: MESH_PROFILES.grid3,
        meshName: 'GridMesh3',
        vertexNames: GRID_VERTEX_NAMES,
        uvs: GRID_UV,
        kinds: Object.freeze([
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'ContourMeshVertex',
            'MeshVertex',
        ]),
        triangles: GRID_TRIANGLES,
    }),
});

function fail(message) {
    throw new Error(message);
}

function assertByte(value, label) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255) {
        fail(label + ' must be an integer between 0 and 255.');
    }
    return value;
}

function assertFiniteNumber(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(label + ' must be finite.');
    return value;
}

function sameNumber(left, right) {
    return Math.abs(left - right) <= 1e-9;
}

export function assertMeshProfile(value = MESH_PROFILES.quad) {
    if (value === undefined) return MESH_PROFILES.quad;
    if (typeof value !== 'string' || value.length === 0 || !Object.hasOwn(PROFILE_DEFINITIONS, value)) {
        fail('Unknown mesh profile: ' + String(value));
    }
    return value;
}

export function getMeshProfileDefinition(value = MESH_PROFILES.quad) {
    return PROFILE_DEFINITIONS[assertMeshProfile(value)];
}

export function meshProfileVertexCount(value = MESH_PROFILES.quad) {
    return getMeshProfileDefinition(value).vertexNames.length;
}

export function meshProfileTriangleCount(value = MESH_PROFILES.quad) {
    return getMeshProfileDefinition(value).triangles.length;
}

export function assertMeshWeights(profile, value) {
    const definition = getMeshProfileDefinition(profile);
    const expectedLength = definition.vertexNames.length;
    if (!(Array.isArray(value) || value instanceof Uint8Array) || value.length !== expectedLength) {
        fail(definition.profile + ' mesh weights must contain ' + expectedLength + ' bytes.');
    }
    return Array.from(value, (entry, index) => assertByte(entry, definition.profile + ' mesh weight ' + definition.vertexNames[index]));
}

export function encodeProfileWeightRecords(profile, value) {
    const definition = getMeshProfileDefinition(profile);
    const weights = assertMeshWeights(definition.profile, value);
    return weights.map((endByte, index) => ({
        name: definition.vertexNames[index],
        ...encodePackedWeight(endByte),
    }));
}

export function decodeProfileWeightRecords(profile, records) {
    const definition = getMeshProfileDefinition(profile);
    if (!Array.isArray(records) || records.length !== definition.vertexNames.length) {
        fail(definition.profile + ' mesh must contain ' + definition.vertexNames.length + ' Weight records.');
    }
    const expectedNames = definition.vertexNames;
    const weights = records.map((record, index) => {
        if (!record || record.name !== expectedNames[index]) fail('Unexpected ' + definition.profile + ' vertex name/order.');
        return decodePackedWeight(record.values, record.indices);
    });
    return assertMeshWeights(definition.profile, weights);
}

export function gridWeightsFromQuad(value) {
    const [topLeft, topRight, bottomRight, bottomLeft] = assertEndWeights(value);
    return assertMeshWeights(MESH_PROFILES.grid3, [
        topLeft,
        Math.round((topLeft + topRight) / 2),
        topRight,
        Math.round((topRight + bottomRight) / 2),
        bottomRight,
        Math.round((bottomRight + bottomLeft) / 2),
        bottomLeft,
        Math.round((bottomLeft + topLeft) / 2),
        Math.round((topLeft + topRight + bottomRight + bottomLeft) / 4),
    ]);
}

export function quadWeightsFromGrid(value) {
    const weights = assertMeshWeights(MESH_PROFILES.grid3, value);
    return assertEndWeights([weights[0], weights[2], weights[4], weights[6]]);
}

export function convertMeshWeights(value, fromProfile, toProfile) {
    const from = assertMeshProfile(fromProfile);
    const to = assertMeshProfile(toProfile);
    if (from === to) return assertMeshWeights(from, value);
    if (from === MESH_PROFILES.quad && to === MESH_PROFILES.grid3) return gridWeightsFromQuad(value);
    if (from === MESH_PROFILES.grid3 && to === MESH_PROFILES.quad) return quadWeightsFromGrid(value);
    fail('Unsupported mesh profile conversion: ' + from + ' -> ' + to);
}

function encodeVaruint(value) {
    let remaining = value;
    const bytes = [];
    do {
        let byte = remaining & 0x7f;
        remaining >>>= 7;
        if (remaining) byte |= 0x80;
        bytes.push(byte);
    } while (remaining);
    return bytes;
}

function decodeVaruint(bytes) {
    const values = [];
    let value = 0;
    let shift = 0;
    for (const byte of bytes) {
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
            values.push(value >>> 0);
            value = 0;
            shift = 0;
        } else {
            shift += 7;
            if (shift > 28) fail('Triangle varuint is too large.');
        }
    }
    if (shift !== 0) fail('Triangle varuint is truncated.');
    return values;
}

function base64Encode(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64Decode(value) {
    if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail('Triangle index bytes must be base64.');
    if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(value, 'base64'));
    const binary = atob(value);
    return Array.from(binary, character => character.charCodeAt(0));
}

export function encodeTriangleIndices(triangles) {
    const flat = [];
    for (const triangle of triangles) {
        if (!Array.isArray(triangle) || triangle.length !== 3) fail('Triangles must contain three vertex indices.');
        for (const index of triangle) {
            if (!Number.isInteger(index) || index < 0) fail('Triangle indices must be non-negative integers.');
            flat.push(...encodeVaruint(index));
        }
    }
    return base64Encode(flat);
}

export function decodeTriangleIndices(value) {
    return decodeVaruint(base64Decode(value));
}

export function assertTriangleIndices(profile, value) {
    const definition = getMeshProfileDefinition(profile);
    const bytes = typeof value === 'string' ? decodeTriangleIndices(value) : value;
    if (!Array.isArray(bytes) || bytes.length !== definition.triangles.length * 3) {
        fail(definition.profile + ' triangle index count is invalid.');
    }
    for (const index of bytes) {
        if (!Number.isInteger(index) || index < 0 || index >= definition.vertexNames.length) {
            fail(definition.profile + ' triangle index is out of range.');
        }
    }
    const expected = definition.triangles.flat();
    if (JSON.stringify(bytes) !== JSON.stringify(expected)) fail(definition.profile + ' triangle topology is unsupported.');
    return bytes;
}

export function triangleIndexBytesForProfile(profile) {
    const definition = getMeshProfileDefinition(profile);
    return encodeTriangleIndices(definition.triangles);
}

export function assertProfileTriangles(profile, triangles, uvs = getMeshProfileDefinition(profile).uvs) {
    const definition = getMeshProfileDefinition(profile);
    if (!Array.isArray(triangles) || triangles.length !== definition.triangles.length) fail(definition.profile + ' triangle count is invalid.');
    for (const [triangleIndex, triangle] of triangles.entries()) {
        if (!Array.isArray(triangle) || triangle.length !== 3) fail('Triangle must contain three indices.');
        const [a, b, c] = triangle;
        if (![a, b, c].every(index => Number.isInteger(index) && index >= 0 && index < uvs.length)) fail('Triangle index is out of range.');
        if (new Set(triangle).size !== 3) fail('Triangle cannot repeat a vertex.');
        const area = (uvs[b][0] - uvs[a][0]) * (uvs[c][1] - uvs[a][1])
            - (uvs[b][1] - uvs[a][1]) * (uvs[c][0] - uvs[a][0]);
        if (!(area > 0)) fail('Triangle ' + triangleIndex + ' has invalid winding or zero area.');
    }
    const encoded = encodeTriangleIndices(triangles);
    assertTriangleIndices(definition.profile, encoded);
    return triangles.map(triangle => [...triangle]);
}

export function createProfileVertices(profile, width, height, meshWeights) {
    const definition = getMeshProfileDefinition(profile);
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) fail('Mesh dimensions must be positive integers.');
    const weights = assertMeshWeights(definition.profile, meshWeights);
    return definition.uvs.map(([u, v], index) => ({
        kind: definition.kinds[index],
        name: definition.vertexNames[index],
        u,
        v,
        x: (u - 0.5) * width,
        y: (v - 0.5) * height,
        endWeight: weights[index],
    }));
}

export function assertProfileVertices(profile, vertices, width, height) {
    const definition = getMeshProfileDefinition(profile);
    if (!Array.isArray(vertices) || vertices.length !== definition.vertexNames.length) fail(definition.profile + ' vertex count is invalid.');
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) fail('Mesh dimensions must be positive integers.');
    for (const [index, vertex] of vertices.entries()) {
        if (!vertex || vertex.kind !== definition.kinds[index] || vertex.name !== definition.vertexNames[index]) fail(definition.profile + ' vertex kind/name/order is unsupported.');
        const [u, v] = definition.uvs[index];
        if (!sameNumber(vertex.u, u) || !sameNumber(vertex.v, v)) fail(definition.profile + ' UV is unsupported.');
        if (!sameNumber(vertex.x, (u - 0.5) * width) || !sameNumber(vertex.y, (v - 0.5) * height)) fail(definition.profile + ' vertex position is unsupported.');
        assertFiniteNumber(vertex.x, definition.profile + ' vertex x');
        assertFiniteNumber(vertex.y, definition.profile + ' vertex y');
        assertByte(vertex.endWeight, definition.profile + ' vertex End weight');
    }
    return vertices.map(vertex => ({ ...vertex }));
}

