// R-51 diagnostic-only audit: child-dominant soft interface on frozen R-47 Mesh.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { evaluateRasterBoneSkinning, validateRasterBoneSkinning,
    RASTER_MESH_MAX_INFLUENCES } from '../system/animation/raster-bone-skinning.js';
import { ALPHA_FIT_GRID_GENERATOR, createRasterMeshSourceSignature }
    from '../system/animation/raster-bone-auto-setup.js';
import { createSkinWeightBrushPlan }
    from '../system/animation/skin-weight-brush.js';
import { fixtures, evaluateMode, motionClip, bindCoverage }
    from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution, analyzePoseAttribution, thresholdSearch }
    from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights, HARMONIC_LENGTH_EPSILON }
    from './junction-harmonic-weight-diagnostic.mjs';

const AREA_EPSILON = 1e-8, MODEL_TOLERANCE = 1e-7;
const WEIGHT_TOLERANCE = 1e-8, SOLVE_TOLERANCE = 1e-7;
const solverPath = fileURLToPath(new URL('./junction-pose-feasibility-lp.py', import.meta.url));
const FINGERPRINTS = {
    'disconnected-islands': '2eda38c39b4e42f298a1e1bdca46d73aa65eb0c14c7609b2bbbf2eb4fbf86136',
    'connected-humanoid': 'cff2fc82bbf1e9efefe901ac60150760fc10f9e491fb42bc7ebbcc0e9ce325e9',
    'simple-chain': '2c9a21ed8573fb545bd19ea49b062ddfec7c90994101be9a38e0e5a1f5c20fe1',
    'branched-skeleton': '50dd7032f8a1e3ce2c7bf0b00e88508dc4e5311d562678fda5a7f84d41027eb3'
};
const round = n => Number.isFinite(n) ? Number(n.toFixed(6)) : n;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const area2 = (a, b, c) => cross({ x: b.x - a.x, y: b.y - a.y },
    { x: c.x - a.x, y: c.y - a.y });
const percentile = (values, fraction) => values.length
    ? round([...values].sort((a, b) => a - b)[Math.ceil(fraction * (values.length - 1))])
    : null;
const stats = values => ({ count: values.length, min: percentile(values, 0),
    p10: percentile(values, 0.1), median: percentile(values, 0.5),
    p90: percentile(values, 0.9), max: percentile(values, 1) });
const fingerprint = p => createHash('sha256').update(JSON.stringify({
    vertices: p.mesh.vertices, triangles: p.mesh.triangles,
    geometryRoles: p.topology.diagnostic.geometryRoles,
    faceRoles: p.topology.diagnostic.faceRoles,
    interfaces: p.topology.diagnostic.interfaces.map(i => ({ parent: i.parent,
        child: i.child, component: i.component, boundaryIds: i.boundaryIds }))
})).digest('hex');
const skinWeight = (skin, vertexId, boneId) => {
    const row = skin.vertexWeights.find(v => v.vertexId === vertexId);
    const sum = row.influences.reduce((a, b) => a + b.weight, 0);
    return (row.influences.find(i => i.boneId === boneId)?.weight || 0) / sum;
};
const meshAsset = (p, skin) => ({ ...p.asset, meshDefinitions: [p.mesh],
    skinBindings: [skin] });
function runtimeVertices(p, skin, clip) {
    const evaluation = evaluateRasterBoneSkinning(meshAsset(p, skin), clip, 0);
    assert.equal(evaluation.ok, true);
    return new Map(evaluation.resultByMeshId.get(p.mesh.meshId).vertices
        .map(v => [v.vertexId, v]));
}
function coefficients([a, b, c], d) {
    const u = { x: b.x - a.x, y: b.y - a.y };
    const v = { x: c.x - a.x, y: c.y - a.y };
    const dv = cross(d, v), ud = cross(u, d);
    return [-dv - ud, dv, ud];
}
function verifyModel(p, W2) {
    const bind = runtimeVertices(p, W2.skinBinding, null);
    const posed = runtimeVertices(p, W2.skinBinding,
        motionClip(p.fixture.movingBoneId, { x: 60 }));
    const d = { x: 60, y: 0 };
    let vertexError = 0, areaError = 0;
    for (const vertex of p.mesh.vertices) {
        const w = skinWeight(W2.skinBinding, vertex.vertexId, p.fixture.movingBoneId);
        const b = bind.get(vertex.vertexId), q = posed.get(vertex.vertexId);
        vertexError = Math.max(vertexError,
            Math.hypot(q.x - b.x - w * d.x, q.y - b.y - w * d.y));
    }
    for (const tri of p.mesh.triangles) {
        const points = tri.map(id => bind.get(id));
        const predicted = area2(...points) + coefficients(points, d)
            .reduce((sum, value, i) => sum + value * skinWeight(
                W2.skinBinding, tri[i], p.fixture.movingBoneId), 0);
        areaError = Math.max(areaError,
            Math.abs(predicted - area2(...tri.map(id => posed.get(id)))));
    }
    assert.ok(vertexError < MODEL_TOLERANCE && areaError < MODEL_TOLERANCE);
    return { d, vertexError, areaError };
}
function systemFor(p, W2, d) {
    const started = performance.now();
    const byId = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const byCoord = new Map(p.mesh.vertices.map(v => [`${v.x},${v.y}`, v.vertexId]));
    const active = new Map(), boundary = new Map();
    for (const junction of W2.junctions) {
        const ids = new Set(p.mesh.triangles.flatMap((tri, i) =>
            p.topology.diagnostic.faceRoles[i].role === `JUNCTION:${junction.ancestor}`
                ? tri : []));
        for (const id of ids) {
            assert.ok(!active.has(id)); active.set(id, junction);
        }
        for (const row of p.topology.diagnostic.interfaces.filter(item =>
            item.parent === junction.ancestor && item.component ===
                p.topology.diagnostic.junctions.find(j =>
                    j.ancestor === junction.ancestor).component))
            for (const edge of row.boundaryIds)
                for (const point of edge.split('>')) {
                    const id = byCoord.get(point);
                    assert.ok(ids.has(id));
                    if (boundary.has(id)) assert.equal(boundary.get(id), row.child);
                    boundary.set(id, row.child);
                }
    }
    const variables = [], vertices = [], index = new Map();
    for (const vertex of p.mesh.vertices) {
        const junction = active.get(vertex.vertexId);
        if (!junction) continue;
        assert.ok(junction.children.length <= RASTER_MESH_MAX_INFLUENCES);
        const indices = [];
        for (const boneId of junction.children) {
            const i = variables.length;
            variables.push({ vertexId: vertex.vertexId, boneId,
                w2: skinWeight(W2.skinBinding, vertex.vertexId, boneId),
                fixed: boundary.has(vertex.vertexId)
                    ? Number(boundary.get(vertex.vertexId) === boneId) : null });
            indices.push(i); index.set(`${vertex.vertexId}|${boneId}`, i);
        }
        vertices.push({ id: vertex.vertexId, indices, x: vertex.x, y: vertex.y });
    }
    const triangles = [];
    for (const [id, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[id].role.startsWith('JUNCTION:')
            || !['visible-supporting', 'mixed'].includes(p.coverage.support[id])) continue;
        const points = tri.map(key => byId.get(key));
        const bind = area2(...points), coeff = coefficients(points, d);
        assert.ok(bind > 0);
        let constant = bind;
        const entries = [];
        tri.forEach((vertexId, i) => {
            const v = index.get(`${vertexId}|${p.fixture.movingBoneId}`);
            if (v === undefined) constant += coeff[i] * skinWeight(W2.skinBinding,
                vertexId, p.fixture.movingBoneId);
            else entries.push([v, coeff[i]]);
        });
        triangles.push({ id, bind, constant, coefficients: entries });
    }
    return { variables, vertices, triangles, active, boundary,
        constructionMs: performance.now() - started };
}
function runLp(system, mode) {
    const { variables, vertices, triangles } = system;
    const result = spawnSync('python', [solverPath], { input: JSON.stringify({
        variables, vertices, triangles, mode }), encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || 'SciPy solver failed');
    return JSON.parse(result.stdout);
}
function skinFrom(p, W2, system, values) {
    assert.equal(values.length, system.variables.length);
    const byVertex = new Map();
    let maxRawViolation = 0;
    for (const [i, raw] of values.entries()) {
        const variable = system.variables[i];
        maxRawViolation = Math.max(maxRawViolation, Math.max(0, -raw, raw - 1));
        assert.ok(Number.isFinite(raw) && raw >= -WEIGHT_TOLERANCE
            && raw <= 1 + WEIGHT_TOLERANCE);
        if (!byVertex.has(variable.vertexId)) byVertex.set(variable.vertexId, []);
        byVertex.get(variable.vertexId).push({ boneId: variable.boneId,
            weight: Math.max(0, Math.min(1, raw)) });
    }
    const skin = { ...W2.skinBinding, vertexWeights: W2.skinBinding.vertexWeights
        .map(row => {
            if (!byVertex.has(row.vertexId)) return row;
            const raw = byVertex.get(row.vertexId);
            const sum = raw.reduce((a, b) => a + b.weight, 0);
            assert.ok(Math.abs(sum - 1) < WEIGHT_TOLERANCE);
            return { vertexId: row.vertexId,
                influences: raw.map(item => ({ boneId: item.boneId,
                    weight: item.weight / sum })).filter(item => item.weight > 0) };
        }) };
    const validation = validateRasterBoneSkinning([p.mesh], [skin],
        p.asset.internalLayers, p.asset.rigDefinition);
    assert.equal(validation.ok, true, JSON.stringify(validation.errors));
    for (const row of skin.vertexWeights) {
        if (!system.active.has(row.vertexId)) assert.deepEqual(row,
            p.modes.W1.vertexWeights.find(v => v.vertexId === row.vertexId));
        assert.ok(row.influences.length <= RASTER_MESH_MAX_INFLUENCES);
    }
    for (const [id, child] of system.boundary) {
        const own = skinWeight(skin, id, child);
        for (const sibling of system.active.get(id).children)
            assert.ok(own + WEIGHT_TOLERANCE >= skinWeight(skin, id, sibling));
    }
    return { skin, maxRawViolation };
}
function interfaceDistanceMap(p, system) {
    const result = new Map();
    for (const row of p.topology.diagnostic.interfaces) {
        const graph = new Map();
        for (const edge of row.boundaryIds) {
            const [a, b] = edge.split('>');
            const [ax, ay] = a.split(',').map(Number);
            const [bx, by] = b.split(',').map(Number);
            const distance = Math.hypot(ax - bx, ay - by);
            if (!graph.has(a)) graph.set(a, []);
            if (!graph.has(b)) graph.set(b, []);
            graph.get(a).push([b, distance]); graph.get(b).push([a, distance]);
        }
        const pending = new Set(graph.keys()), distances = new Map();
        const start = [...pending].sort()[0];
        if (!start) continue;
        distances.set(start, 0);
        while (pending.size) {
            const at = [...pending].sort((a, b) => (distances.get(a) ?? Infinity)
                - (distances.get(b) ?? Infinity) || a.localeCompare(b))[0];
            pending.delete(at);
            for (const [next, length] of graph.get(at))
                distances.set(next, Math.min(distances.get(next) ?? Infinity,
                    (distances.get(at) ?? Infinity) + length));
        }
        for (const [point, distance] of distances) {
            const vertex = system.vertices.find(v => `${v.x},${v.y}` === point);
            if (vertex) result.set(vertex.id, { child: row.child,
                distanceAlongInterface: round(distance), interfaceLength: row.length });
        }
    }
    return result;
}
function boundaryMetrics(p, system, skin, dualTriangleIds) {
    const interfaceDistance = interfaceDistanceMap(p, system);
    const byId = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const dualCentroids = dualTriangleIds.map(id => {
        const tri = p.mesh.triangles[id].map(key => byId.get(key));
        return { id, x: tri.reduce((s, v) => s + v.x, 0) / 3,
            y: tri.reduce((s, v) => s + v.y, 0) / 3 };
    });
    const rows = [...system.boundary].map(([id, child]) => {
        const vertex = byId.get(id), own = skinWeight(skin, id, child);
        const siblings = system.active.get(id).children.filter(b => b !== child);
        const nearestDual = dualCentroids.map(t => ({ id: t.id,
            distance: round(Math.hypot(vertex.x - t.x, vertex.y - t.y)) }))
            .sort((a, b) => a.distance - b.distance || a.id - b.id)[0] || null;
        return { id, x: vertex.x, y: vertex.y, child,
            own: round(own), delta: round(1 - own),
            maxSibling: round(Math.max(...siblings.map(b => skinWeight(skin, id, b)))),
            ...interfaceDistance.get(id), nearestDual };
    }).sort((a, b) => a.child.localeCompare(b.child) || a.id.localeCompare(b.id));
    const summarize = subset => ({ own: stats(subset.map(row => row.own)),
        maxSibling: round(Math.max(0, ...subset.map(row => row.maxSibling))),
        softened: subset.filter(row => row.delta > WEIGHT_TOLERANCE).length,
        deltaAbove: Object.fromEntries([0.01, 0.05, 0.10, 0.25]
            .map(limit => [limit, subset.filter(row => row.delta > limit).length])) });
    return { overall: summarize(rows), byChild: Object.fromEntries(
        [...new Set(rows.map(row => row.child))].map(child => [child,
            summarize(rows.filter(row => row.child === child))])), rows };
}
function energy(p, skin) {
    const byId = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const edges = new Map();
    for (const [i, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[i].role.startsWith('JUNCTION:')) continue;
        for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
            const key = [a, b].sort().join('|');
            if (!edges.has(key)) edges.set(key, [a, b]);
        }
    }
    let sum = 0;
    for (const [a, b] of edges.values()) {
        const u = byId.get(a), v = byId.get(b);
        const conductance = 1 / Math.max(Math.hypot(u.x - v.x, u.y - v.y),
            HARMONIC_LENGTH_EPSILON);
        const bones = new Set([...skin.vertexWeights.find(w => w.vertexId === a)
            .influences.map(w => w.boneId), ...skin.vertexWeights.find(w =>
                w.vertexId === b).influences.map(w => w.boneId)]);
        for (const child of bones) {
            const difference = skinWeight(skin, a, child) - skinWeight(skin, b, child);
            sum += 0.5 * conductance * difference * difference;
        }
    }
    return round(sum);
}
function interfaceChildGradients(p, system, skin) {
    const rows = [], seen = new Set();
    for (const [i, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[i].role.startsWith('CHILD:')) continue;
        for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
            const [interfaceId, interiorId] = system.boundary.has(a) &&
                !system.active.has(b) ? [a, b] : system.boundary.has(b) &&
                !system.active.has(a) ? [b, a] : [];
            if (!interfaceId) continue;
            const key = [interfaceId, interiorId].join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            const own = system.boundary.get(interfaceId);
            const ids = system.active.get(interfaceId).children;
            rows.push({ interfaceId, interiorId, child: own,
                targetGradient: round(Math.abs(skinWeight(skin, interfaceId,
                    p.fixture.movingBoneId) - skinWeight(skin, interiorId,
                    p.fixture.movingBoneId))),
                maxBoneGradient: round(Math.max(...ids.map(child => Math.abs(
                    skinWeight(skin, interfaceId, child)
                    - skinWeight(skin, interiorId, child))))) });
        }
    }
    return { target: stats(rows.map(row => row.targetGradient)),
        maxBone: stats(rows.map(row => row.maxBoneGradient)), rows };
}
function rootMotion(p, skin) {
    const posed = runtimeVertices(p, skin, motionClip(p.fixture.rootBoneId, { x: 20 }));
    const coordinateError = Math.max(...p.mesh.vertices.flatMap(v => {
        const q = posed.get(v.vertexId);
        return [Math.abs(q.x - v.x - 20), Math.abs(q.y - v.y)];
    }));
    const raster = evaluateMode(p.fixture, p.snapshot, p.asset,
        { meshDefinition: p.mesh, skinBinding: skin },
        motionClip(p.fixture.rootBoneId, { x: 20 }), p.coverage,
        p.context.gridDiagonal);
    assert.equal(raster.valid, true);
    assert.ok(coordinateError < MODEL_TOLERANCE);
    return { coordinateError: round(coordinateError),
        alpha: round(raster.alphaRaster.alphaAreaRatio),
        inversion: raster.quality.visibleInverted };
}
function brushCheck(p, system, skin) {
    const choice = system.vertices.find(v => {
        const target = skinWeight(skin, v.id, p.fixture.movingBoneId);
        return target > 0.05 && target < 0.95;
    });
    assert.ok(choice, 'mixed SBW vertex for data-level Brush');
    const asset = { ...meshAsset(p, skin), meshDefinitions: [{ ...p.mesh,
        generator: { type: ALPHA_FIT_GRID_GENERATOR,
            source: createRasterMeshSourceSignature(p.snapshot) } }] };
    const before = JSON.stringify(asset);
    const plan = createSkinWeightBrushPlan(asset, 'art', p.fixture.movingBoneId,
        [{ vertexId: choice.id, delta: 0.01 }]);
    assert.equal(plan.ok, true, JSON.stringify(plan));
    assert.equal(plan.changed, true);
    assert.equal(JSON.stringify(asset), before);
    assert.deepEqual(plan.meshDefinitions[0].vertices, p.mesh.vertices);
    assert.deepEqual(plan.meshDefinitions[0].triangles, p.mesh.triangles);
    return { ok: true, vertexId: choice.id };
}
function roleFor(p, id) {
    const role = p.topology.diagnostic.faceRoles[id].role;
    const edgeIds = new Set(p.topology.diagnostic.interfaces.flatMap(row =>
        row.boundaryIds).map(edge => {
        const [a, b] = edge.split('>');
        return [a, b].sort().join('|');
    }));
    const byId = new Map(p.mesh.vertices.map(v => [v.vertexId, `${v.x},${v.y}`]));
    const tri = p.mesh.triangles[id];
    const adjacent = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]
        .some(([a, b]) => edgeIds.has([byId.get(a), byId.get(b)].sort().join('|')));
    return adjacent ? 'interface-adjacent' : role.startsWith('JUNCTION:')
        ? 'JUNCTION interior' : 'CHILD interior';
}
const report = [];
for (const fixture of fixtures) {
    const p = preparePoseAttribution(fixture);
    assert.equal(fingerprint(p), FINGERPRINTS[fixture.id]);
    const W2 = createJunctionHarmonicWeights(p.topology, p.context);
    assert.equal(W2.ok, true);
    if (!W2.junctions.length) {
        assert.deepEqual(W2.skinBinding, p.modes.W1);
        report.push({ fixture: fixture.id, control: 'W2 == W1; no LP' });
        continue;
    }
    assert.deepEqual([p.coverage.uncovered, p.coverage.multiple], [0, 0]);
    const model = verifyModel(p, W2), system = systemFor(p, W2, model.d);
    const strict = runLp(system, 'strict');
    assert.equal(strict.ok, true);
    assert.ok(Math.abs(strict.mStar - (fixture.id === 'branched-skeleton'
        ? -0.25 : 1)) < SOLVE_TOLERANCE, 'R-50 strict parity');
    const soft = runLp(system, 'soft'), repeat = runLp(system, 'soft');
    assert.equal(soft.ok, true, `${fixture.id}: ${soft.stage} ${soft.message}`);
    assert.equal(repeat.ok, true);
    assert.ok(Math.abs(soft.mSoft - repeat.mSoft) < SOLVE_TOLERANCE);
    if (soft.mSoft <= 0) {
        report.push({ fixture: fixture.id, strictMargin: strict.mStar,
            F1: { mSoft: soft.mSoft, active: soft.F1Active,
                dualTriangles: soft.F1DualTriangleSupport,
                dualDominance: soft.F1DualDominanceSupport },
            classification: 'C', timingMs: soft.timingMs });
        continue;
    }
    assert.ok(Math.abs(soft.deltaMin - repeat.deltaMin) < SOLVE_TOLERANCE);
    assert.ok(Math.max(...soft.SBW.map((value, i) =>
        Math.abs(value - repeat.SBW[i]))) < SOLVE_TOLERANCE);
    if (fixture.id === 'connected-humanoid')
        assert.ok(Math.abs(soft.deltaMin) < SOLVE_TOLERANCE,
            'CONNECTED should not require soft boundary');
    const F1Skin = skinFrom(p, W2, system, soft.F1Weights).skin;
    const F1Pose = runtimeVertices(p, F1Skin,
        motionClip(p.fixture.movingBoneId, { x: 60 }));
    const F1RuntimeMinimumRatio = Math.min(...system.triangles.map(row => {
        const tri = p.mesh.triangles[row.id];
        return area2(...tri.map(key => F1Pose.get(key))) / row.bind;
    }));
    assert.ok(Math.abs(F1RuntimeMinimumRatio - soft.mSoft) < MODEL_TOLERANCE,
        `${fixture.id}: F1 runtime margin parity`);
    const SBW = skinFrom(p, W2, system, soft.SBW);
    p.modes.W2 = W2.skinBinding; p.modes.SBW = SBW.skin;
    const runtimeStart = performance.now();
    const modes = Object.fromEntries(['W0', 'W1', 'W2', 'SBW']
        .map(name => [name, analyzePoseAttribution(p, name)]));
    const runtimeMs = performance.now() - runtimeStart;
    const brief = name => {
        const mode = modes[name], t60 = mode.canonical.find(row =>
            row.kind === 'translation' && row.magnitude === 60);
        return { gradients: Object.fromEntries(['CHILD_INTERIOR',
            'CHILD_JUNCTION_INTERFACE', 'JUNCTION_INTERIOR']
            .map(kind => [kind, mode.gradientSummary[kind]?.target || null])),
        t60: { inversion: t60.raster.visibleInversion,
            targetDisplacement: t60.raster.targetDisplacement,
            targetAlpha: t60.raster.targetAlpha,
            totalAlpha: t60.raster.alphaTotal,
            junctionArea: t60.byRole['JUNCTION:root'],
            overlap: t60.overlap, remote: t60.raster.remote },
        series: mode.canonical.map(row => ({ kind: row.kind,
            magnitude: row.magnitude, inversion: row.raster.visibleInversion,
            failureIds: [...row.visibleInverted, ...row.mixedInverted],
            failureRoles: [...row.visibleInverted, ...row.mixedInverted]
                .reduce((acc, id) => {
                    const role = roleFor(p, id);
                    acc[role] = (acc[role] || 0) + 1; return acc;
                }, {}) })) };
    };
    const summaries = Object.fromEntries(['W0', 'W1', 'W2', 'SBW']
        .map(name => [name, brief(name)]));
    const dualIds = [31, 33, 35, 37, 39, 41];
    const bindById = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const w2At = runtimeVertices(p, W2.skinBinding,
        motionClip(p.fixture.movingBoneId, { x: 60 }));
    const sbwAt = runtimeVertices(p, SBW.skin,
        motionClip(p.fixture.movingBoneId, { x: 60 }));
    const dualTriangles = fixture.id === 'branched-skeleton' ? dualIds.map(id => {
        const tri = p.mesh.triangles[id];
        return { id, bind: round(area2(...tri.map(key => bindById.get(key)))),
            W2: round(area2(...tri.map(key => w2At.get(key)))),
            strictMaxMarginRatio: -0.25,
            SBW: area2(...tri.map(key => sbwAt.get(key))),
            interfaceWeights: tri.filter(key => system.boundary.has(key))
                .map(key => ({ vertexId: key, child: system.boundary.get(key),
                    influences: SBW.skin.vertexWeights.find(v =>
                        v.vertexId === key).influences })) };
    }) : [];
    const boundary = boundaryMetrics(p, system, SBW.skin, dualIds);
    const minimumRuntimeArea = Math.min(...system.triangles.map(row => area2(
        ...p.mesh.triangles[row.id].map(key => sbwAt.get(key)))));
    assert.ok(minimumRuntimeArea > 0 && Math.abs(minimumRuntimeArea
        - soft.SBWMinimumArea) < MODEL_TOLERANCE);
    const first120 = thresholdSearch(p, SBW.skin, 'translation', 120);
    const firstVisible = system.triangles.map(row => first120.first[row.id])
        .filter(v => v !== null).sort((a, b) => a - b)[0] ?? null;
    const baselineCoverage = bindCoverage(p.snapshot, p.product.meshDefinition);
    const baseline = evaluateMode(p.fixture, p.snapshot, p.asset, p.product,
        motionClip(p.fixture.movingBoneId, { x: 60 }), baselineCoverage,
        p.context.gridDiagonal);
    assert.equal(baseline.valid, true);
    const retention = summaries.SBW.t60.targetDisplacement
        / baseline.regions[fixture.movingBoneId].displacement;
    const childGradients = interfaceChildGradients(p, system, SBW.skin);
    const regression = summaries.SBW.series.some(row => row.kind === 'rotation'
        && row.inversion > 0);
    const translationFailure = summaries.SBW.series.some(row =>
        row.kind === 'translation' && row.inversion > 0);
    const childFailure = summaries.SBW.series.some(row =>
        row.inversion > 0 && row.failureRoles['CHILD interior'] > 0);
    report.push({ fixture: fixture.id,
        frozen: { vertices: p.mesh.vertices.length, triangles: p.mesh.triangles.length,
            fingerprint: FINGERPRINTS[fixture.id] }, model,
        strictMargin: strict.mStar,
        F1: { mSoft: soft.mSoft, runtimeMinimumRatio: F1RuntimeMinimumRatio,
            active: soft.F1Active,
            dualTriangles: soft.F1DualTriangleSupport,
            dualDominance: soft.F1DualDominanceSupport },
        F2: { deltaMin: soft.deltaMin, SBWDelta: soft.SBWDelta,
            L1FromW2: soft.SBWL1, minimumArea: soft.SBWMinimumArea,
            minimumRuntimeArea },
        boundary, dualTriangles, maxRawViolation: SBW.maxRawViolation,
        modes: summaries, interfaceChildGradients: childGradients,
        energies: { W2: energy(p, W2.skinBinding), SBW: energy(p, SBW.skin) },
        runtime: { retention: round(retention), firstVisibleTranslation120: firstVisible,
            root: rootMotion(p, SBW.skin),
            brush: fixture.id === 'branched-skeleton'
                ? brushCheck(p, system, SBW.skin) : null },
        flags: { translationFailure, regression, childFailure },
        timingMs: { strict: strict.timingMs, ...soft.timingMs,
            JSConstruction: system.constructionMs, runtimeValidation: runtimeMs } });
}
console.log('verify-rig-soft-interface-feasibility: PASS');
console.log(JSON.stringify({ fixtures: report }, null, 2));
