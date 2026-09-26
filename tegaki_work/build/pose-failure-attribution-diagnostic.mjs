// R-48 diagnostic only. R-47 topology and both existing Weight sources are frozen.
import { createAlphaFitRasterBoneSetup, createRasterBoneBindSegments,
    createRasterBoneDistanceInfluences } from '../system/animation/raster-bone-auto-setup.js';
import { evaluateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { evaluateRigidBones } from '../system/animation/part-rig.js';
import { applyTransformMatrix, invertTransformMatrix,
    multiplyTransformMatrices } from '../system/transform-math.js';
import { createDomainContext } from './hybrid-domain-patch-diagnostic.mjs';
import { createNeutralJunctionTopology } from './neutral-junction-topology-diagnostic.mjs';
import { assetFor, snapshotFor, bindCoverage, evaluateMode, motionClip }
    from './verify-rig-hybrid-domain-patch.mjs';
import { degreesToRadians } from './verify-rig-canonical-geometry.mjs';

const EPS = 1e-9;
const round = n => Number.isFinite(n) ? Number(n.toFixed(4)) : n;
const area2 = (a, b, c) => (b.x - a.x) * (c.y - a.y)
    - (b.y - a.y) * (c.x - a.x);
const percentile = (values, p) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return round(sorted[Math.ceil(p * (sorted.length - 1))]);
};
const stats = values => ({ count: values.length, max: percentile(values, 1),
    median: percentile(values, 0.5), p90: percentile(values, 0.9) });
const xy = vertex => `${vertex.x},${vertex.y}`;
const edgeKey = (a, b) => [a, b].sort().join('|');
const nodeById = mesh => new Map(mesh.vertices.map(v => [v.vertexId, v]));
const weightById = skin => new Map(skin.vertexWeights.map(v => [v.vertexId,
    v.influences.map(i => ({ boneId: i.boneId, weight: i.weight
        / v.influences.reduce((sum, x) => sum + x.weight, 0) }))]));

function visiblePixels(snapshot, a, b, c) {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(snapshot.width, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(snapshot.height, Math.ceil(Math.max(a.y, b.y, c.y)));
    const bindArea = area2(a, b, c);
    let count = 0;
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
        if (!snapshot.pixels[(y * snapshot.width + x) * 4 + 3]) continue;
        const p = { x: x + 0.5, y: y + 0.5 };
        const z = [area2(a, b, p), area2(b, c, p), area2(c, a, p)];
        if (bindArea > 0 ? z.every(v => v >= -EPS) : z.every(v => v <= EPS)) count++;
    }
    return count;
}

export function roleMetadata(mesh, diagnostic) {
    const byId = nodeById(mesh);
    const interfaceEdges = new Set(diagnostic.interfaces.flatMap(i => i.boundaryIds)
        .map(id => {
            const [a, b] = id.split('>').map(point => point.split(',').map(Number));
            return edgeKey(`${a[0]},${a[1]}`, `${b[0]},${b[1]}`);
        }));
    const triangleRoles = mesh.triangles.map((triangle, index) => {
        const face = diagnostic.faceRoles[index];
        const edges = [[triangle[0], triangle[1]], [triangle[1], triangle[2]],
            [triangle[2], triangle[0]]];
        const adjacent = edges.some(([a, b]) => interfaceEdges.has(
            edgeKey(xy(byId.get(a)), xy(byId.get(b)))));
        return { id: index, baseRole: face.role,
            kind: adjacent ? 'INTERFACE_ADJACENT'
                : face.role.startsWith('JUNCTION:') ? 'JUNCTION_INTERIOR'
                    : face.role.startsWith('CHILD:') ? 'CHILD_INTERIOR' : 'OTHER',
            cell: face.cell };
    });
    const edgeMap = new Map(), vertexTriangles = new Map();
    for (const [i, triangle] of mesh.triangles.entries()) {
        for (const id of triangle) {
            if (!vertexTriangles.has(id)) vertexTriangles.set(id, []);
            vertexTriangles.get(id).push(i);
        }
        for (const [a, b] of [[triangle[0], triangle[1]],
            [triangle[1], triangle[2]], [triangle[2], triangle[0]]]) {
            const key = edgeKey(a, b);
            if (!edgeMap.has(key)) edgeMap.set(key, { a, b, triangles: [] });
            edgeMap.get(key).triangles.push(i);
        }
    }
    const edges = [...edgeMap.values()].map(e => {
        const interfaceEdge = interfaceEdges.has(edgeKey(xy(byId.get(e.a)),
            xy(byId.get(e.b))));
        const kinds = new Set(e.triangles.map(i => triangleRoles[i].baseRole));
        return { ...e, kind: interfaceEdge ? 'CHILD_JUNCTION_INTERFACE'
            : kinds.size === 1 && [...kinds][0].startsWith('JUNCTION:')
                ? 'JUNCTION_INTERIOR' : 'CHILD_INTERIOR' };
    });
    return { triangleRoles, edges, vertexTriangles };
}

export function gradients(metadata, skin, targetId) {
    const weights = weightById(skin), byKind = {};
    for (const edge of metadata.edges) {
        const a = new Map(weights.get(edge.a).map(i => [i.boneId, i.weight]));
        const b = new Map(weights.get(edge.b).map(i => [i.boneId, i.weight]));
        const ids = new Set([...a.keys(), ...b.keys()]);
        const row = { target: Math.abs((a.get(targetId) || 0) - (b.get(targetId) || 0)),
            root: Math.abs((a.get('root') || 0) - (b.get('root') || 0)),
            maxBone: Math.max(...[...ids].map(id =>
                Math.abs((a.get(id) || 0) - (b.get(id) || 0)))) };
        (byKind[edge.kind] ||= []).push(row);
        edge.gradient = row;
    }
    return Object.fromEntries(Object.entries(byKind).map(([kind, rows]) =>
        [kind, Object.fromEntries(['target', 'root', 'maxBone'].map(field =>
            [field, stats(rows.map(row => row[field]))]))]));
}

export function overlapPixelCenters(meshResult) {
    const vertices = meshResult.vertices;
    const hits = new Map();
    for (const [a, b, c] of meshResult.triangleIndices) {
        const p = vertices[a], q = vertices[b], r = vertices[c];
        const left = Math.floor(Math.min(p.x, q.x, r.x));
        const right = Math.ceil(Math.max(p.x, q.x, r.x));
        const top = Math.floor(Math.min(p.y, q.y, r.y));
        const bottom = Math.ceil(Math.max(p.y, q.y, r.y));
        const sign = area2(p, q, r);
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
            const point = { x: x + 0.5, y: y + 0.5 };
            const z = [area2(p, q, point), area2(q, r, point), area2(r, p, point)];
            if (!(sign > 0 ? z.every(v => v > EPS) : z.every(v => v < -EPS))) continue;
            const id = `${x},${y}`;
            hits.set(id, (hits.get(id) || 0) + 1);
        }
    }
    return { covered: hits.size,
        multiple: [...hits.values()].filter(n => n > 1).length,
        excess: [...hits.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0) };
}

export function summaryAtPose(prepared, skin, metadata, kind, magnitude) {
    const { fixture, asset, snapshot, mesh, coverage, context } = prepared;
    const setup = { meshDefinition: mesh, skinBinding: skin };
    const motion = kind === 'translation' ? { x: magnitude }
        : { rotation: degreesToRadians(magnitude) };
    const clip = motionClip(fixture.movingBoneId, motion);
    const modeAsset = { ...asset, meshDefinitions: [mesh], skinBindings: [skin] };
    const evaluation = evaluateRasterBoneSkinning(modeAsset, clip, 0);
    if (!evaluation.ok) throw new Error(`${fixture.id}: runtime pose invalid`);
    const posed = evaluation.resultByMeshId.get(mesh.meshId);
    const poseFixture = prepared.topology.diagnostic.junctions.length
        ? { ...fixture, joint: context.segmentById.get('root').start } : fixture;
    const raster = evaluateMode(poseFixture, snapshot, asset, setup,
        clip, coverage, context.gridDiagonal);
    if (!raster.valid) throw new Error(`${fixture.id}: runtime raster invalid`);
    const byVertex = new Map(posed.vertices.map(v => [v.vertexId, v]));
    const byBind = nodeById(mesh);
    const byRole = {}, inverted = [], visibleInverted = [], mixedInverted = [];
    const areas = mesh.triangles.map((tri, index) => {
        const before = tri.map(id => byBind.get(id)), after = tri.map(id => byVertex.get(id));
        const bind = area2(...before), current = area2(...after);
        const role = metadata.triangleRoles[index];
        const area = { id: index, bind, current, ratio: current / bind,
            support: coverage.support[index], ...role };
        const aggregate = byRole[role.baseRole] ||= { bind: 0, signed: 0, absolute: 0,
            count: 0, inverted: 0 };
        aggregate.bind += bind; aggregate.signed += current;
        aggregate.absolute += Math.abs(current); aggregate.count++;
        // Runtime inversion is strict sign reversal; zero-area thresholds are
        // tracked separately by thresholdSearch (signed area <= 0).
        if (current < 0) {
            inverted.push(index); aggregate.inverted++;
            if (coverage.support[index] === 'visible-supporting') visibleInverted.push(index);
            if (coverage.support[index] === 'mixed') mixedInverted.push(index);
        }
        return area;
    });
    for (const item of Object.values(byRole)) {
        item.signedRatio = round(item.signed / item.bind);
        item.absoluteRatio = round(item.absolute / item.bind);
        item.bind = round(item.bind); item.signed = round(item.signed);
        item.absolute = round(item.absolute);
    }
    const target = fixture.movingBoneId;
    const targetMetric = raster.regions[target];
    return { kind, magnitude, clip, posed, areas, byRole,
        inverted, visibleInverted, mixedInverted,
        raster: { targetDisplacement: targetMetric?.displacement,
            targetAlpha: targetMetric?.alphaAreaRatio,
            alphaTotal: raster.alphaRaster.alphaAreaRatio,
            visibleInversion: raster.quality.visibleInverted,
            allInversion: raster.quality.allInverted,
            remote: Object.fromEntries(fixture.regions.filter(r => r.id !== target)
                .map(r => [r.id, raster.regions[r.id]?.displacement])),
            junctionAlpha: raster.junction?.alphaAreaRatio ?? null },
        overlap: magnitude === 60 && kind === 'translation'
            ? overlapPixelCenters(posed) : null };
}

export function thresholdSearch(prepared, skin, kind, maxMagnitude) {
    const { asset, mesh, fixture } = prepared;
    const modeAsset = { ...asset, meshDefinitions: [mesh], skinBindings: [skin] };
    const cache = new Map();
    const values = magnitude => {
        const key = magnitude.toFixed(8);
        if (cache.has(key)) return cache.get(key);
        const clip = motionClip(fixture.movingBoneId, kind === 'translation'
            ? { x: magnitude } : { rotation: degreesToRadians(magnitude) });
        const evaluation = evaluateRasterBoneSkinning(modeAsset, clip, 0);
        if (!evaluation.ok) throw new Error('threshold runtime failure');
        const vertices = evaluation.resultByMeshId.get(mesh.meshId).vertices;
        const indexed = new Map(vertices.map(v => [v.vertexId, v]));
        const areas = mesh.triangles.map(tri => area2(...tri.map(id => indexed.get(id))));
        cache.set(key, areas);
        return areas;
    };
    const first = new Array(mesh.triangles.length).fill(null);
    const step = 0.25;
    let previous = values(0), previousAt = 0;
    for (let n = 1; n <= Math.round(maxMagnitude / step); n++) {
        const at = Math.min(maxMagnitude, n * step), current = values(at);
        for (let i = 0; i < current.length; i++) {
            if (first[i] !== null || previous[i] <= 0 || current[i] > 0) continue;
            let lo = previousAt, hi = at;
            while (hi - lo > 0.05) {
                const mid = (lo + hi) / 2;
                if (values(mid)[i] <= 0) hi = mid; else lo = mid;
            }
            first[i] = round(hi);
        }
        previous = current; previousAt = at;
    }
    return { first, runtimeEvaluations: cache.size, step, precision: 0.05 };
}

function translationAnalytic(prepared, skin, observed) {
    const { asset, mesh, fixture } = prepared;
    const modeAsset = { ...asset, meshDefinitions: [mesh], skinBindings: [skin] };
    const poses = [0, 5, 30, 60].map(t => {
        const evaluation = evaluateRasterBoneSkinning(modeAsset,
            motionClip(fixture.movingBoneId, { x: t }), 0);
        if (!evaluation.ok) throw new Error('analytic runtime failure');
        return new Map(evaluation.resultByMeshId.get(mesh.meshId).vertices
            .map(v => [v.vertexId, v]));
    });
    let maxLinearityError = 0;
    for (const vertex of mesh.vertices) {
        const a = poses[0].get(vertex.vertexId), d = poses[3].get(vertex.vertexId);
        for (const [index, t] of [[1, 5], [2, 30]]) {
            const v = poses[index].get(vertex.vertexId);
            maxLinearityError = Math.max(maxLinearityError,
                Math.hypot(v.x - a.x - (d.x - a.x) * t / 60,
                    v.y - a.y - (d.y - a.y) * t / 60));
        }
    }
    const linear = maxLinearityError <= 1e-7;
    const predictions = mesh.triangles.map(tri => {
        if (!linear) return null;
        const p = tri.map(id => poses[0].get(id));
        const v = tri.map(id => ({ x: (poses[3].get(id).x - poses[0].get(id).x) / 60,
            y: (poses[3].get(id).y - poses[0].get(id).y) / 60 }));
        const cross = (a, b) => a.x * b.y - a.y * b.x;
        const e1 = { x: p[1].x - p[0].x, y: p[1].y - p[0].y };
        const e2 = { x: p[2].x - p[0].x, y: p[2].y - p[0].y };
        const f1 = { x: v[1].x - v[0].x, y: v[1].y - v[0].y };
        const f2 = { x: v[2].x - v[0].x, y: v[2].y - v[0].y };
        const a = cross(e1, e2), b = cross(f1, e2) + cross(e1, f2), c = cross(f1, f2);
        const roots = Math.abs(c) < EPS ? Math.abs(b) < EPS ? [] : [-a / b]
            : (() => { const discriminant = b * b - 4 * c * a;
                return discriminant < 0 ? [] : [(-b - Math.sqrt(discriminant)) / (2 * c),
                    (-b + Math.sqrt(discriminant)) / (2 * c)]; })();
        const first = roots.filter(t => t >= 0 && t <= 60)
            .sort((x, y) => x - y)[0] ?? null;
        return { coefficients: [round(a), round(b), round(c)], first: round(first) };
    });
    const differences = predictions.flatMap((prediction, i) => prediction?.first !== null
        && observed.first[i] !== null ? [Math.abs(prediction.first - observed.first[i])] : []);
    return { linear, maxLinearityError: round(maxLinearityError),
        predictedCrossings: predictions.filter(p => p?.first !== null).length,
        observedCrossings: observed.first.filter(t => t !== null).length,
        maxThresholdDifference: round(Math.max(0, ...differences)), predictions };
}

function matrixContributions(prepared, pose, triangle, skin) {
    const { asset, mesh } = prepared;
    const modeAsset = { ...asset, meshDefinitions: [mesh], skinBindings: [skin] };
    const bind = evaluateRigidBones(modeAsset, null, 0);
    const current = evaluateRigidBones(modeAsset, pose.clip, 0);
    const weights = weightById(skin), vertices = nodeById(mesh);
    return triangle.map(vertexId => {
        const point = vertices.get(vertexId);
        return { vertexId, components: weights.get(vertexId).map(influence => {
            const b = bind.poseByBoneId.get(influence.boneId).worldMatrix;
            const c = current.poseByBoneId.get(influence.boneId).worldMatrix;
            const matrix = multiplyTransformMatrices(c, invertTransformMatrix(b));
            const transformed = applyTransformMatrix(matrix, point.x, point.y);
            return { boneId: influence.boneId, weight: round(influence.weight),
                dx: round(transformed.x - point.x), dy: round(transformed.y - point.y) };
        }) };
    });
}

function localSensitivity(prepared, skin, triangleId, pose) {
    const { asset, mesh, fixture } = prepared;
    const tri = mesh.triangles[triangleId], target = fixture.movingBoneId;
    const baselineArea = pose.areas[triangleId].current;
    const rows = [];
    for (const vertexId of tri) {
        const binding = skin.vertexWeights.find(v => v.vertexId === vertexId);
        const normalized = new Map(weightById(skin).get(vertexId)
            .map(i => [i.boneId, i.weight]));
        const originalTarget = normalized.get(target) || 0;
        let partner = [...normalized.keys()].filter(id => id !== target).sort()[0];
        if (!partner) {
            const other = tri.flatMap(id => weightById(skin).get(id)
                .map(i => i.boneId)).filter(id => id !== target).sort();
            partner = other[0] || prepared.context.parentById.get(target) || null;
        }
        if (!partner) continue;
        const deltas = originalTarget <= EPS ? [0.01]
            : originalTarget >= 1 - EPS ? [-0.01] : [-0.01, 0.01];
        for (const delta of deltas) {
            const next = new Map(normalized);
            next.set(target, (next.get(target) || 0) + delta);
            next.set(partner, (next.get(partner) || 0) - delta);
            if ([...next.values()].some(value => value < -EPS)) continue;
            const nextWeights = skin.vertexWeights.map(v => v.vertexId !== vertexId ? v : {
                vertexId, influences: [...next].filter(([, weight]) => weight > EPS)
                    .map(([boneId, weight]) => ({ boneId, weight })) });
            const nextSkin = { ...skin, vertexWeights: nextWeights };
            const modeAsset = { ...asset, meshDefinitions: [mesh], skinBindings: [nextSkin] };
            const evaluation = evaluateRasterBoneSkinning(modeAsset, pose.clip, 0);
            if (!evaluation.ok) continue;
            const meshResult = evaluation.resultByMeshId.get(mesh.meshId);
            const byId = new Map(meshResult.vertices.map(v => [v.vertexId, v]));
            const nextArea = area2(...tri.map(id => byId.get(id)));
            const derivative = (nextArea - baselineArea) / delta;
            const requiredDelta = derivative ? -baselineArea / derivative : null;
            rows.push({ vertexId, partner, delta, areaDelta: round(nextArea - baselineArea),
                derivative: round(derivative), requiredDelta: round(requiredDelta),
                feasible: requiredDelta !== null && Math.sign(requiredDelta) === Math.sign(delta)
                    && originalTarget + requiredDelta >= 0
                    && originalTarget + requiredDelta <= 1 });
        }
    }
    return rows;
}

export function preparePoseAttribution(fixture) {
    const asset = assetFor(fixture), snapshot = snapshotFor(fixture);
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot);
    if (!product.ok) throw new Error(`${fixture.id}: AUTO GRID baseline failed`);
    const context = createDomainContext(asset, product);
    const topology = createNeutralJunctionTopology(asset, snapshot, product,
        context, { corePolicy: 'residual-child-connectivity' });
    if (!topology.ok) throw new Error(`${fixture.id}: R-47 topology failed: ${topology.reason}`);
    const mesh = topology.meshDefinition;
    const segments = createRasterBoneBindSegments(asset);
    if (!segments.ok) throw new Error(`${fixture.id}: production bind segments failed`);
    const W0 = { version: topology.skinBinding.version, meshId: mesh.meshId,
        vertexWeights: mesh.vertices.map(v => ({ vertexId: v.vertexId,
            influences: createRasterBoneDistanceInfluences(v, segments.segments) })) };
    const W1 = topology.skinBinding;
    const coverage = bindCoverage(snapshot, mesh);
    return { fixture, asset, snapshot, product, context, topology,
        mesh, coverage, modes: { W0, W1 } };
}

export function analyzePoseAttribution(prepared, modeName) {
    const { fixture, snapshot, mesh, coverage, topology } = prepared;
    const skin = prepared.modes[modeName], target = fixture.movingBoneId;
    const metadata = roleMetadata(mesh, topology.diagnostic);
    const gradientSummary = gradients(metadata, skin, target);
    const canonical = [];
    for (const kind of ['translation', 'rotation'])
        for (const magnitude of [5, 15, 30, kind === 'translation' ? 60 : 45])
            canonical.push(summaryAtPose(prepared, skin, metadata, kind, magnitude));
    const primary = fixture.id === 'connected-humanoid'
        || fixture.id === 'branched-skeleton';
    const threshold = primary ? {
        translation: thresholdSearch(prepared, skin, 'translation', 60),
        rotation: thresholdSearch(prepared, skin, 'rotation', 45) } : null;
    const analytic = primary ? translationAnalytic(prepared, skin,
        threshold.translation) : null;
    const translationMax = canonical.find(p => p.kind === 'translation' && p.magnitude === 60);
    const rotationMax = canonical.find(p => p.kind === 'rotation' && p.magnitude === 45);
    const packets = {};
    if (primary) for (const [kind, pose] of [['translation', translationMax],
        ['rotation', rotationMax]]) {
        const firsts = threshold[kind].first;
        packets[kind] = pose.visibleInverted.map(id => {
            const triangle = mesh.triangles[id];
            const bindVertices = triangle.map(vertexId => nodeById(mesh).get(vertexId));
            const area = pose.areas[id];
            const weights = weightById(skin);
            const targetWeights = triangle.map(vertexId => weights.get(vertexId)
                .find(i => i.boneId === target)?.weight || 0);
            const gradientsOnEdges = metadata.edges.filter(e => triangle.includes(e.a)
                && triangle.includes(e.b)).map(e => e.gradient?.target || 0);
            return { id, role: area.kind, baseRole: area.baseRole,
                cell: area.cell, bindVertices: bindVertices.map(v => [v.x, v.y]),
                bindArea2: round(area.bind), posedArea2: round(area.current),
                areaRatio: round(area.ratio), firstInversion: firsts[id],
                weights: triangle.map(vertexId => ({ vertexId,
                    influences: weights.get(vertexId).map(i => ({
                        boneId: i.boneId, weight: round(i.weight) })) })),
                targetWeightRange: [round(Math.min(...targetWeights)),
                    round(Math.max(...targetWeights))],
                maxTargetGradient: round(Math.max(...gradientsOnEdges)),
                interfaceAdjacent: area.kind === 'INTERFACE_ADJACENT',
                visibleAlphaPixels: visiblePixels(snapshot, ...bindVertices),
                transformContributions: matrixContributions(prepared, pose,
                    triangle, skin),
                sensitivity: localSensitivity(prepared, skin, id, pose) };
        }).sort((a, b) => (a.firstInversion ?? Infinity)
            - (b.firstInversion ?? Infinity) || a.id - b.id).slice(0, 10);
    }
    const sets = kind => canonical.filter(p => p.kind === kind)
        .map(p => ({ magnitude: p.magnitude,
            ids: p.visibleInverted }));
    const persistence = Object.fromEntries(['translation', 'rotation'].map(kind => {
        const rows = sets(kind);
        return [kind, rows.map((row, i) => ({ magnitude: row.magnitude,
            count: row.ids.length, overlapWithMax: row.ids.filter(id =>
                rows.at(-1).ids.includes(id)).length,
            newFromPrior: i ? row.ids.filter(id => !rows[i - 1].ids.includes(id)).length
                : row.ids.length }))];
    }));
    const weights = weightById(skin);
    const junctionVertices = [...metadata.vertexTriangles].filter(([, ids]) => ids.some(id =>
        metadata.triangleRoles[id].kind === 'INTERFACE_ADJACENT'
        || metadata.triangleRoles[id].baseRole.startsWith('JUNCTION:')));
    const rootAtJunction = junctionVertices.map(([id]) => weights.get(id)
        .find(i => i.boneId === 'root')?.weight || 0);
    const triangleRoleCounts = Object.fromEntries([...new Set(metadata.triangleRoles
        .map(r => r.kind))].sort().map(kind => [kind, metadata.triangleRoles
        .filter(r => r.kind === kind).length]));
    const vertexPacket = mesh.vertices.map(v => {
        const influences = weights.get(v.vertexId);
        const incident = metadata.vertexTriangles.get(v.vertexId) || [];
        return { id: v.vertexId, x: v.x, y: v.y,
            geometryRoles: [...new Set(incident.map(i =>
                metadata.triangleRoles[i].baseRole))].sort(),
            incidentTriangles: incident, influences,
            dominant: [...influences].sort((a, b) => b.weight - a.weight
                || a.boneId.localeCompare(b.boneId))[0]?.boneId || null,
            targetWeight: influences.find(i => i.boneId === target)?.weight || 0,
            rootWeight: influences.find(i => i.boneId === 'root')?.weight || 0,
            influenceCount: influences.length };
    });
    return { mode: modeName, fixture: fixture.id,
        topology: { vertices: mesh.vertices.length, triangles: mesh.triangles.length,
            junctionCells: topology.diagnostic.junctions.map(j => j.finalCount),
            ownershipUnchanged: topology.diagnostic.ownershipUnchanged,
            coverage: [coverage.uncovered, coverage.multiple] },
        triangleRoleCounts, gradientSummary, vertexPacket,
        rootAtJunction: { vertices: rootAtJunction.length,
            nonzero: rootAtJunction.filter(w => w > EPS).length,
            max: round(Math.max(0, ...rootAtJunction)),
            median: percentile(rootAtJunction, 0.5) },
        canonical: canonical.map(p => ({ kind: p.kind, magnitude: p.magnitude,
            raster: Object.fromEntries(Object.entries(p.raster).map(([k, v]) =>
                [k, v === null ? null : typeof v === 'number' ? round(v) : Object.fromEntries(
                    Object.entries(v).map(([id, value]) => [id, round(value)]))])),
            inverted: p.inverted, visibleInverted: p.visibleInverted,
            mixedInverted: p.mixedInverted, byRole: p.byRole,
            overlap: p.overlap })),
        threshold, analytic, packets, persistence };
}
