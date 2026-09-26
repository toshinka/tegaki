// R-49 diagnostic only: one fixed harmonic candidate on the frozen R-47 Mesh.
import { performance } from 'node:perf_hooks';
import { RASTER_MESH_MAX_INFLUENCES }
    from '../system/animation/raster-bone-skinning.js';

export const HARMONIC_LENGTH_EPSILON = 1e-9;
export const HARMONIC_WEIGHT_TOLERANCE = 1e-8;
const PIVOT_TOLERANCE = 1e-12;
const order = values => [...values].sort((a, b) => a.localeCompare(b));
const edgeKey = (a, b) => order([a, b]).join('|');
const coordinate = v => `${v.x},${v.y}`;
const median = rows => [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)];

function directSolve(matrix, right) {
    const n = matrix.length, columns = right[0]?.length || 0;
    const rows = matrix.map((row, i) => [...row, ...right[i]]);
    for (let column = 0; column < n; column++) {
        let pivot = column;
        for (let i = column + 1; i < n; i++)
            if (Math.abs(rows[i][column]) > Math.abs(rows[pivot][column])) pivot = i;
        if (!(Math.abs(rows[pivot][column]) > PIVOT_TOLERANCE))
            return null;
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let j = column; j < n + columns; j++) rows[column][j] /= divisor;
        for (let i = 0; i < n; i++) {
            if (i === column) continue;
            const scale = rows[i][column];
            for (let j = column; j < n + columns; j++)
                rows[i][j] -= scale * rows[column][j];
        }
    }
    return rows.map(row => row.slice(n));
}

export function createJunctionHarmonicWeights(topology, context) {
    const started = performance.now();
    const { meshDefinition: mesh, skinBinding: W1, diagnostic } = topology;
    const byId = new Map(mesh.vertices.map(v => [v.vertexId, v]));
    const byCoord = new Map(mesh.vertices.map(v => [coordinate(v), v.vertexId]));
    const replacement = new Map(), junctions = [];
    const timings = { graph: 0, matrix: 0, solve: 0, conversion: 0, total: 0 };
    const fail = (reason, detail) => ({ ok: false, reason, detail, timings });

    for (const junction of diagnostic.junctions) {
        const graphStart = performance.now();
        const ancestor = junction.ancestor;
        const faces = mesh.triangles.filter((_, i) =>
            diagnostic.faceRoles[i]?.role === `JUNCTION:${ancestor}`);
        const ids = order(new Set(faces.flat()));
        const edgeMap = new Map();
        for (const tri of faces) for (const [a, b] of [[tri[0], tri[1]],
            [tri[1], tri[2]], [tri[2], tri[0]]]) {
            const key = edgeKey(a, b);
            if (!edgeMap.has(key)) edgeMap.set(key, order([a, b]));
        }
        const children = order(diagnostic.interfaces.filter(row =>
            row.parent === ancestor && row.component === junction.component)
            .map(row => row.child));
        if (children.length > RASTER_MESH_MAX_INFLUENCES)
            return fail('junction-influence-limit', { ancestor, children });
        if (!faces.length || !children.length)
            return fail('harmonic-system-singular', { ancestor, cause: 'empty-graph-or-boundary' });
        const labels = new Map();
        for (const row of diagnostic.interfaces.filter(item =>
            item.parent === ancestor && item.component === junction.component)) {
            if (context.parentById.get(row.child) !== ancestor)
                return fail('junction-weight-boundary-conflict', { ancestor,
                    cause: 'non-direct-child', child: row.child });
            for (const edge of row.boundaryIds) {
                const endpoints = edge.split('>');
                if (endpoints.length !== 2) return fail('junction-weight-boundary-conflict',
                    { ancestor, cause: 'invalid-interface-edge', edge });
                for (const point of endpoints) {
                    const id = byCoord.get(point);
                    if (!id || !ids.includes(id)) return fail('junction-weight-boundary-conflict',
                        { ancestor, cause: 'boundary-outside-junction', edge, point });
                    if (labels.has(id) && labels.get(id) !== row.child)
                        return fail('junction-weight-boundary-conflict',
                            { ancestor, vertexId: id, children: [labels.get(id), row.child] });
                    labels.set(id, row.child);
                }
            }
        }
        if (children.some(child => ![...labels.values()].includes(child)))
            return fail('harmonic-system-singular', { ancestor, cause: 'missing-child-boundary' });
        const neighbors = new Map(ids.map(id => [id, []]));
        for (const [a, b] of edgeMap.values()) {
            const p = byId.get(a), q = byId.get(b);
            const conductance = 1 / Math.max(Math.hypot(p.x - q.x, p.y - q.y),
                HARMONIC_LENGTH_EPSILON);
            neighbors.get(a).push([b, conductance]);
            neighbors.get(b).push([a, conductance]);
        }
        const interior = ids.filter(id => !labels.has(id));
        timings.graph += performance.now() - graphStart;

        const matrixStart = performance.now();
        const index = new Map(interior.map((id, i) => [id, i]));
        const matrix = interior.map(() => new Array(interior.length).fill(0));
        const right = interior.map(() => new Array(children.length).fill(0));
        for (const [i, id] of interior.entries()) for (const [next, conductance]
            of neighbors.get(id)) {
            matrix[i][i] += conductance;
            if (index.has(next)) matrix[i][index.get(next)] -= conductance;
            else right[i][children.indexOf(labels.get(next))] += conductance;
        }
        timings.matrix += performance.now() - matrixStart;
        const solveStart = performance.now();
        const values = directSolve(matrix, right);
        timings.solve += performance.now() - solveStart;
        if (!values) return fail('harmonic-system-singular', { ancestor });
        let maximumLaplacianResidual = 0;
        for (let i = 0; i < interior.length; i++)
            for (let child = 0; child < children.length; child++) {
                const lhs = matrix[i].reduce((sum, value, j) =>
                    sum + value * values[j][child], 0);
                maximumLaplacianResidual = Math.max(maximumLaplacianResidual,
                    Math.abs(lhs - right[i][child]));
            }
        if (maximumLaplacianResidual > HARMONIC_WEIGHT_TOLERANCE)
            return fail('harmonic-weight-invalid', { ancestor,
                cause: 'laplacian-residual', maximumLaplacianResidual });

        const conversionStart = performance.now();
        const nonzeroByChild = Object.fromEntries(children.map(child => [child, 0]));
        let maximumOvershoot = 0, maximumSumError = 0;
        for (const id of ids) {
            const raw = labels.has(id) ? children.map(child =>
                Number(child === labels.get(id))) : values[index.get(id)];
            const sum = raw.reduce((a, b) => a + b, 0);
            maximumSumError = Math.max(maximumSumError, Math.abs(sum - 1));
            maximumOvershoot = Math.max(maximumOvershoot,
                ...raw.map(value => Math.max(0, -value, value - 1)));
            if (!raw.every(Number.isFinite) || Math.abs(sum - 1) > HARMONIC_WEIGHT_TOLERANCE
                || raw.some(value => value < -HARMONIC_WEIGHT_TOLERANCE
                    || value > 1 + HARMONIC_WEIGHT_TOLERANCE))
                return fail('harmonic-weight-invalid', { ancestor, vertexId: id, raw });
            // Only numerical drift is clamped and normalized. Boundary values are one-hot.
            const corrected = raw.map(value => Math.max(0, Math.min(1, value)));
            const correctedSum = corrected.reduce((a, b) => a + b, 0);
            const influences = corrected.map((weight, i) => ({ boneId: children[i],
                weight: weight / correctedSum })).filter(item => item.weight > 0);
            for (const influence of influences) nonzeroByChild[influence.boneId]++;
            if (replacement.has(id)) return fail('junction-weight-boundary-conflict',
                { ancestor, vertexId: id, cause: 'multiple-junctions' });
            replacement.set(id, influences);
        }
        timings.conversion += performance.now() - conversionStart;
        junctions.push({ ancestor, faces: faces.length, vertices: ids.length,
            edges: edgeMap.size, boundaryVertices: labels.size,
            interiorVertices: interior.length, children, nonzeroByChild,
            maximumOvershoot, maximumSumError, maximumLaplacianResidual });
    }
    const conversionStart = performance.now();
    const skinBinding = { ...W1, vertexWeights: W1.vertexWeights.map(item =>
        replacement.has(item.vertexId) ? { vertexId: item.vertexId,
            influences: replacement.get(item.vertexId) } : item) };
    timings.conversion += performance.now() - conversionStart;
    timings.total = performance.now() - started;
    return { ok: true, skinBinding, activeVertexIds: order(replacement.keys()),
        junctions, timings };
}

export function medianHarmonicTimings(samples) {
    return Object.fromEntries(Object.keys(samples[0]).map(key =>
        [key, median(samples.map(row => row[key]))]));
}
