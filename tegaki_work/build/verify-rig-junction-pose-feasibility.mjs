// R-50 diagnostic-only existence audit on the R-47 Mesh and R-49 boundaries.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { evaluateRasterBoneSkinning, validateRasterBoneSkinning,
    RASTER_MESH_MAX_INFLUENCES } from '../system/animation/raster-bone-skinning.js';
import { ALPHA_FIT_GRID_GENERATOR, createRasterMeshSourceSignature }
    from '../system/animation/raster-bone-auto-setup.js';
import { createSkinWeightBrushPlan } from '../system/animation/skin-weight-brush.js';
import { fixtures, evaluateMode, motionClip, bindCoverage }
    from './verify-rig-hybrid-domain-patch.mjs';
import { preparePoseAttribution, analyzePoseAttribution, thresholdSearch }
    from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights, HARMONIC_LENGTH_EPSILON }
    from './junction-harmonic-weight-diagnostic.mjs';

const AREA_EPSILON = 1e-8, MODEL_TOLERANCE = 1e-7;
const WEIGHT_TOLERANCE = 1e-8, MARGIN_TOLERANCE = 1e-7;
const solverPath = fileURLToPath(new URL('./junction-pose-feasibility-lp.py', import.meta.url));
const frozen = {
    'disconnected-islands': '2eda38c39b4e42f298a1e1bdca46d73aa65eb0c14c7609b2bbbf2eb4fbf86136',
    'connected-humanoid': 'cff2fc82bbf1e9efefe901ac60150760fc10f9e491fb42bc7ebbcc0e9ce325e9',
    'simple-chain': '2c9a21ed8573fb545bd19ea49b062ddfec7c90994101be9a38e0e5a1f5c20fe1',
    'branched-skeleton': '50dd7032f8a1e3ce2c7bf0b00e88508dc4e5311d562678fda5a7f84d41027eb3'
};
const round = n => Number.isFinite(n) ? Number(n.toFixed(6)) : n;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const area2 = (a, b, c) => cross({ x: b.x - a.x, y: b.y - a.y },
    { x: c.x - a.x, y: c.y - a.y });
const weight = (skin, vertexId, boneId) => {
    const row = skin.vertexWeights.find(v => v.vertexId === vertexId);
    const sum = row.influences.reduce((a, b) => a + b.weight, 0);
    return (row.influences.find(i => i.boneId === boneId)?.weight || 0) / sum;
};
const meshHash = p => createHash('sha256').update(JSON.stringify({
    vertices: p.mesh.vertices, triangles: p.mesh.triangles,
    geometryRoles: p.topology.diagnostic.geometryRoles,
    faceRoles: p.topology.diagnostic.faceRoles,
    interfaces: p.topology.diagnostic.interfaces.map(i => ({ parent: i.parent,
        child: i.child, component: i.component, boundaryIds: i.boundaryIds }))
})).digest('hex');
const makeAsset = (p, skin) => ({ ...p.asset, meshDefinitions: [p.mesh],
    skinBindings: [skin] });
function posedVertices(p, skin, clip) {
    const evaluation = evaluateRasterBoneSkinning(makeAsset(p, skin), clip, 0);
    assert.equal(evaluation.ok, true, `${p.fixture.id}: runtime evaluator`);
    return new Map(evaluation.resultByMeshId.get(p.mesh.meshId).vertices
        .map(v => [v.vertexId, v]));
}
const triangleAt = (p, skin, id, t) => area2(...p.mesh.triangles[id]
    .map(vertexId => posedVerticesCache(p, skin, t).get(vertexId)));
const poseCache = new WeakMap();
function posedVerticesCache(p, skin, t) {
    let cache = poseCache.get(skin);
    if (!cache) { cache = new Map(); poseCache.set(skin, cache); }
    if (!cache.has(t)) cache.set(t, posedVertices(p, skin,
        motionClip(p.fixture.movingBoneId, { x: t })));
    return cache.get(t);
}
const percentile = (values, fraction) => values.length
    ? round([...values].sort((a, b) => a - b)[Math.ceil(fraction * (values.length - 1))])
    : null;
const stats = values => ({ count: values.length, median: percentile(values, 0.5),
    p90: percentile(values, 0.9), max: percentile(values, 1) });

function verifyTranslationModel(p, skins) {
    const target = p.fixture.movingBoneId;
    const bind = posedVertices(p, skins.W1, null);
    const pure = skins.W1.vertexWeights.find(row =>
        weight(skins.W1, row.vertexId, target) === 1);
    assert.ok(pure, 'pure target vertex required for translation vector');
    const purePose = posedVerticesCache(p, skins.W1, 60);
    const d = { x: purePose.get(pure.vertexId).x - bind.get(pure.vertexId).x,
        y: purePose.get(pure.vertexId).y - bind.get(pure.vertexId).y };
    let maxVertexError = 0, maxAreaError = 0;
    for (const [name, skin] of Object.entries(skins)) {
        const posed = posedVerticesCache(p, skin, 60);
        for (const vertex of p.mesh.vertices) {
            const b = bind.get(vertex.vertexId), actual = posed.get(vertex.vertexId);
            const w = weight(skin, vertex.vertexId, target);
            maxVertexError = Math.max(maxVertexError,
                Math.hypot(actual.x - b.x - w * d.x,
                    actual.y - b.y - w * d.y));
        }
        for (const tri of p.mesh.triangles) {
            const points = tri.map(id => bind.get(id));
            const ws = tri.map(id => weight(skin, id, target));
            const predicted = area2(...points) + triangleCoefficients(points, d)
                .reduce((sum, coefficient, i) => sum + coefficient * ws[i], 0);
            maxAreaError = Math.max(maxAreaError,
                Math.abs(predicted - area2(...tri.map(id => posed.get(id)))));
        }
        assert.ok(maxVertexError <= MODEL_TOLERANCE,
            `${p.fixture.id}/${name}: translation model vertex parity`);
        assert.ok(maxAreaError <= MODEL_TOLERANCE,
            `${p.fixture.id}/${name}: translation model area parity`);
    }
    return { displacement60: d, maxVertexError, maxAreaError,
        tolerance: MODEL_TOLERANCE };
}

function triangleCoefficients([a, b, c], d) {
    const u = { x: b.x - a.x, y: b.y - a.y };
    const v = { x: c.x - a.x, y: c.y - a.y };
    const dv = cross(d, v), ud = cross(u, d);
    return [-dv - ud, dv, ud];
}

function buildSystem(p, W2, displacement60) {
    const started = performance.now(), vertexById = new Map(p.mesh.vertices.map(v =>
        [v.vertexId, v]));
    const byCoord = new Map(p.mesh.vertices.map(v => [`${v.x},${v.y}`, v.vertexId]));
    const junctionByVertex = new Map(), boundary = new Map();
    for (const junction of W2.junctions) {
        const active = new Set(p.mesh.triangles.flatMap((tri, i) =>
            p.topology.diagnostic.faceRoles[i].role === `JUNCTION:${junction.ancestor}`
                ? tri : []));
        for (const id of active) {
            assert.equal(junctionByVertex.has(id), false, 'Junction graph overlap');
            junctionByVertex.set(id, junction);
        }
        for (const row of p.topology.diagnostic.interfaces.filter(item =>
            item.parent === junction.ancestor)) for (const edge of row.boundaryIds)
            for (const point of edge.split('>')) {
                const id = byCoord.get(point);
                assert.ok(active.has(id), 'legal boundary on active graph');
                if (boundary.has(id)) assert.equal(boundary.get(id), row.child,
                    'one-hot sibling boundary conflict');
                boundary.set(id, row.child);
            }
    }
    const variables = [], vertices = [], variableIndex = new Map();
    for (const vertex of p.mesh.vertices) {
        const junction = junctionByVertex.get(vertex.vertexId);
        if (!junction) continue;
        assert.ok(junction.children.length <= RASTER_MESH_MAX_INFLUENCES);
        const indices = [];
        for (const boneId of junction.children) {
            const index = variables.length;
            variables.push({ vertexId: vertex.vertexId, boneId,
                w2: weight(W2.skinBinding, vertex.vertexId, boneId),
                fixed: boundary.has(vertex.vertexId)
                    ? Number(boundary.get(vertex.vertexId) === boneId) : null });
            variableIndex.set(`${vertex.vertexId}|${boneId}`, index);
            indices.push(index);
        }
        vertices.push({ id: vertex.vertexId, x: vertex.x, y: vertex.y,
            indices, ancestor: junction.ancestor });
    }
    const triangles = [];
    for (const [id, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[id].role.startsWith('JUNCTION:')
            || !['visible-supporting', 'mixed'].includes(p.coverage.support[id])) continue;
        const points = tri.map(key => vertexById.get(key));
        const bind = area2(...points);
        assert.ok(bind > 0, 'positive R-47 triangle orientation');
        const coefficients = [], components = triangleCoefficients(points, displacement60);
        let constant = bind;
        tri.forEach((vertexId, i) => {
            const variable = variableIndex.get(`${vertexId}|${p.fixture.movingBoneId}`);
            if (variable === undefined) constant += components[i]
                * weight(W2.skinBinding, vertexId, p.fixture.movingBoneId);
            else coefficients.push([variable, components[i]]);
        });
        triangles.push({ id, bind, constant, coefficients });
    }
    assert.ok(triangles.length > 0);
    return { variables, vertices, triangles, junctionByVertex, boundary,
        constructionMs: performance.now() - started };
}

function runLp(system) {
    const payload = { variables: system.variables, vertices: system.vertices,
        triangles: system.triangles };
    const process = spawnSync('python', [solverPath], { input: JSON.stringify(payload),
        encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    assert.equal(process.status, 0, process.stderr || 'SciPy solver failed');
    return JSON.parse(process.stdout);
}

function skinFromSolution(p, W2, system, values) {
    assert.equal(values.length, system.variables.length);
    const byVertex = new Map();
    let maximumRawViolation = 0;
    for (let i = 0; i < values.length; i++) {
        const variable = system.variables[i], raw = values[i];
        maximumRawViolation = Math.max(maximumRawViolation, Math.max(0, -raw, raw - 1));
        assert.ok(Number.isFinite(raw) && raw >= -WEIGHT_TOLERANCE
            && raw <= 1 + WEIGHT_TOLERANCE);
        if (!byVertex.has(variable.vertexId)) byVertex.set(variable.vertexId, []);
        byVertex.get(variable.vertexId).push({ boneId: variable.boneId,
            weight: Math.max(0, Math.min(1, raw)) });
    }
    const skinBinding = { ...W2.skinBinding,
        vertexWeights: W2.skinBinding.vertexWeights.map(row => {
            if (!byVertex.has(row.vertexId)) return row;
            const raw = byVertex.get(row.vertexId);
            const sum = raw.reduce((a, b) => a + b.weight, 0);
            assert.ok(Math.abs(sum - 1) <= WEIGHT_TOLERANCE);
            const influences = raw.map(item => ({ boneId: item.boneId,
                weight: item.weight / sum })).filter(item => item.weight > 0);
            assert.ok(influences.length <= RASTER_MESH_MAX_INFLUENCES);
            return { vertexId: row.vertexId, influences };
        }) };
    const validation = validateRasterBoneSkinning([p.mesh], [skinBinding],
        p.asset.internalLayers, p.asset.rigDefinition);
    assert.equal(validation.ok, true, JSON.stringify(validation.errors));
    for (const row of skinBinding.vertexWeights) {
        if (system.junctionByVertex.has(row.vertexId)) continue;
        assert.deepEqual(row, p.modes.W1.vertexWeights.find(item =>
            item.vertexId === row.vertexId));
    }
    for (const [id, boneId] of system.boundary) {
        const row = skinBinding.vertexWeights.find(item => item.vertexId === id);
        assert.equal(weight(skinBinding, id, boneId), 1);
        assert.equal(row.influences.length, 1);
    }
    return { skinBinding, maximumRawViolation };
}

function areasAt60(system, values) {
    return system.triangles.map(tri => ({ id: tri.id, bind: tri.bind,
        posed: tri.constant + tri.coefficients.reduce((sum, [i, coefficient]) =>
            sum + coefficient * values[i], 0) }));
}

function graphEdges(p, system) {
    const vertices = new Map(p.mesh.vertices.map(v => [v.vertexId, v]));
    const edges = new Map();
    for (const [i, tri] of p.mesh.triangles.entries()) {
        if (!p.topology.diagnostic.faceRoles[i].role.startsWith('JUNCTION:')) continue;
        for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
            const key = [a, b].sort().join('|');
            if (edges.has(key)) continue;
            const v = vertices.get(a), w = vertices.get(b);
            edges.set(key, { a, b, conductance: 1 / Math.max(
                Math.hypot(v.x - w.x, v.y - w.y), HARMONIC_LENGTH_EPSILON) });
        }
    }
    assert.ok([...edges.values()].every(edge =>
        system.junctionByVertex.has(edge.a) && system.junctionByVertex.has(edge.b)));
    return [...edges.values()];
}
function energy(skin, system, edges) {
    let value = 0;
    for (const edge of edges) {
        const children = system.junctionByVertex.get(edge.a).children;
        for (const child of children) {
            const delta = weight(skin, edge.a, child) - weight(skin, edge.b, child);
            value += 0.5 * edge.conductance * delta * delta;
        }
    }
    return round(value);
}

function interfaceDistances(system, edges) {
    const distance = new Map([...system.boundary.keys()].map(id => [id, 0]));
    const pending = new Set(system.junctionByVertex.keys());
    while (pending.size) {
        const id = [...pending].sort((a, b) => (distance.get(a) ?? Infinity)
            - (distance.get(b) ?? Infinity) || a.localeCompare(b))[0];
        const best = distance.get(id) ?? Infinity;
        pending.delete(id);
        if (!Number.isFinite(best)) break;
        for (const edge of edges.filter(row => row.a === id || row.b === id)) {
            const next = edge.a === id ? edge.b : edge.a;
            if (!pending.has(next)) continue;
            const candidate = best + 1 / edge.conductance;
            if (candidate < (distance.get(next) ?? Infinity)) distance.set(next, candidate);
        }
    }
    return distance;
}
function deviation(system, values, distances) {
    let total = 0, maximum = 0, changed = 0;
    const bones = {}, byVertex = new Map();
    for (const [i, value] of values.entries()) {
        const variable = system.variables[i], delta = value - variable.w2;
        const absolute = Math.abs(delta);
        total += absolute; maximum = Math.max(maximum, absolute);
        if (absolute > WEIGHT_TOLERANCE) changed++;
        bones[variable.boneId] = (bones[variable.boneId] || 0) + absolute;
        if (!byVertex.has(variable.vertexId)) byVertex.set(variable.vertexId, 0);
        byVertex.set(variable.vertexId, byVertex.get(variable.vertexId) + absolute);
    }
    const locations = [...byVertex].map(([id, l1]) => {
        const vertex = system.vertices.find(row => row.id === id);
        return { id, x: vertex.x, y: vertex.y, l1: round(l1),
            distanceFromInterface: round(distances.get(id) ?? Infinity) };
    }).sort((a, b) => b.l1 - a.l1 || a.id.localeCompare(b.id));
    return { totalL1: round(total), maxSingleWeightChange: round(maximum),
        meanChangedWeight: round(changed ? total / changed : 0),
        verticesAbove: Object.fromEntries([0.01, 0.05, 0.10]
            .map(limit => [limit, locations.filter(row => row.l1 > limit).length])),
        boneL1: Object.fromEntries(Object.entries(bones)
            .map(([id, value]) => [id, round(value)])),
        changedLocations: locations.filter(row => row.l1 > 0.01) };
}

function susceptibility(system, W2, FW) {
    const before = areasAt60(system, system.variables.map(v => v.w2));
    const after = areasAt60(system, FW);
    const rows = before.map((row, i) => {
        const next = after[i];
        const derivativeW2 = (row.posed - row.bind) / 60;
        const derivativeFW = (next.posed - next.bind) / 60;
        return { id: row.id, bind: row.bind,
            W2: { derivative: round(derivativeW2),
                collapseAt: derivativeW2 < 0 ? round(-row.bind / derivativeW2) : null,
                condition: Math.abs(derivativeW2) / row.bind },
            FW: { derivative: round(derivativeFW),
                collapseAt: derivativeFW < 0 ? round(-next.bind / derivativeFW) : null,
                condition: Math.abs(derivativeFW) / next.bind },
            failedW2: row.posed <= 0 };
    });
    return { failedW2: stats(rows.filter(row => row.failedW2)
        .map(row => row.W2.condition)),
    survivedW2: stats(rows.filter(row => !row.failedW2)
        .map(row => row.W2.condition)),
    failedW2UnderFW: stats(rows.filter(row => row.failedW2)
        .map(row => row.FW.condition)), rows };
}

function rootMotion(p, skin) {
    const result = posedVertices(p, skin, motionClip(p.fixture.rootBoneId, { x: 20 }));
    const maximumError = Math.max(...p.mesh.vertices.flatMap(v => {
        const q = result.get(v.vertexId);
        return [Math.abs(q.x - v.x - 20), Math.abs(q.y - v.y)];
    }));
    const raster = evaluateMode(p.fixture, p.snapshot, p.asset,
        { meshDefinition: p.mesh, skinBinding: skin },
        motionClip(p.fixture.rootBoneId, { x: 20 }), p.coverage,
        p.context.gridDiagonal);
    assert.equal(raster.valid, true);
    assert.ok(maximumError < MODEL_TOLERANCE);
    return { maximumError: round(maximumError),
        alpha: round(raster.alphaRaster.alphaAreaRatio),
        visibleInversion: raster.quality.visibleInverted };
}

function brushCheck(p, skin, system) {
    const choice = system.vertices.find(v => {
        const target = weight(skin, v.id, p.fixture.movingBoneId);
        return target > 0.05 && target < 0.95;
    });
    assert.ok(choice, 'FW mixed Junction vertex for data-level Weight Brush');
    const asset = { ...makeAsset(p, skin), meshDefinitions: [{ ...p.mesh,
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

const report = [];
for (const fixture of fixtures) {
    const p = preparePoseAttribution(fixture);
    assert.equal(meshHash(p), frozen[fixture.id], `${fixture.id}: R-49 fingerprint`);
    assert.deepEqual([p.coverage.uncovered, p.coverage.multiple], [0, 0]);
    const W2 = createJunctionHarmonicWeights(p.topology, p.context);
    assert.equal(W2.ok, true);
    if (!W2.junctions.length) {
        assert.deepEqual(W2.skinBinding, p.modes.W1, 'no-Junction control');
        report.push({ fixture: fixture.id, control: 'W2 == W1 exactly',
            fingerprint: frozen[fixture.id] });
        continue;
    }
    const skins = { ...p.modes, W2: W2.skinBinding };
    const model = verifyTranslationModel(p, skins);
    p.modes.W2 = W2.skinBinding;
    const system = buildSystem(p, W2, model.displacement60);
    const solve = runLp(system), repeated = runLp(system);
    assert.equal(solve.ok, true, `${fixture.id}: ${solve.stage}: ${solve.message}`);
    assert.equal(repeated.ok, true);
    assert.ok(Math.abs(solve.mStar - repeated.mStar) <= MARGIN_TOLERANCE);
    assert.ok(Math.abs(solve.dual.normalization - 1) <= MARGIN_TOLERANCE,
        `${fixture.id}: dual normalization`);
    assert.ok(Math.abs(solve.dual.upperBound - solve.mStar) <= MARGIN_TOLERANCE,
        `${fixture.id}: dual upper-bound certificate`);
    const common = { fixture: fixture.id, fingerprint: frozen[fixture.id],
        model, lp: { variables: system.variables.length,
            activeVertices: system.vertices.length, boundaryVertices: system.boundary.size,
            constrainedTriangles: system.triangles.length,
            mStar: solve.mStar, repeatMStar: repeated.mStar,
            dual: solve.dual,
            tolerance: { area: AREA_EPSILON, model: MODEL_TOLERANCE,
                weight: WEIGHT_TOLERANCE, margin: MARGIN_TOLERANCE },
            timingMs: { ...solve.timingMs, jsConstruction: system.constructionMs } } };
    if (solve.mStar <= AREA_EPSILON) {
        const raw = areasAt60(system, solve.rawMarginWeights);
        const diagnosticSkin = skinFromSolution(p, W2, system,
            solve.rawMarginWeights).skinBinding;
        const runtimeAreas = system.triangles.map(tri => ({ id: tri.id,
            bind: tri.bind, posed: triangleAt(p, diagnosticSkin, tri.id, 60) }));
        const maximumRuntimeError = Math.max(...raw.map((row, i) =>
            Math.abs(row.posed - runtimeAreas[i].posed)));
        assert.ok(maximumRuntimeError <= MODEL_TOLERANCE,
            `${fixture.id}: impossible-case runtime parity`);
        report.push({ ...common, classification: 'D',
            maximumRuntimeError,
            activeTriangles: raw.map(row => ({ id: row.id,
                ratio: row.posed / row.bind })).filter(row =>
                Math.abs(row.ratio - solve.mStar) <= MARGIN_TOLERANCE) });
        continue;
    }
    const FW = skinFromSolution(p, W2, system, solve.witness);
    const FWmin = skinFromSolution(p, W2, system, solve.minimumDeviation);
    p.modes.FW = FW.skinBinding;
    p.modes.FWmin = FWmin.skinBinding;
    const runtimeStart = performance.now();
    const analyses = Object.fromEntries(['W0', 'W1', 'W2', 'FW', 'FWmin']
        .map(name => [name, analyzePoseAttribution(p, name)]));
    const runtimeMs = performance.now() - runtimeStart;
    const edges = graphEdges(p, system);
    const distances = interfaceDistances(system, edges);
    const marginAreas = areasAt60(system, solve.witness);
    const active = marginAreas.map(row => ({ id: row.id,
        ratio: row.posed / row.bind, bindArea2: row.bind,
        posedArea2: row.posed })).filter(row =>
            Math.abs(row.ratio - solve.mStar) <= 2 * MARGIN_TOLERANCE)
        .sort((a, b) => a.ratio - b.ratio || a.id - b.id);
    const baselineCoverage = bindCoverage(p.snapshot, p.product.meshDefinition);
    const baseline = evaluateMode(p.fixture, p.snapshot, p.asset, p.product,
        motionClip(p.fixture.movingBoneId, { x: 60 }), baselineCoverage,
        p.context.gridDiagonal);
    assert.equal(baseline.valid, true);
    const at = (analysis, kind, magnitude) => analysis.canonical.find(row =>
        row.kind === kind && row.magnitude === magnitude);
    const max = at(analyses.FW, 'translation', 60);
    const first120 = thresholdSearch(p, FW.skinBinding, 'translation', 120);
    const firstVisible120 = system.triangles.map(row => first120.first[row.id])
        .filter(value => value !== null).sort((a, b) => a - b)[0] ?? null;
    const early = fixture.id === 'connected-humanoid' ? [97, 108] : [56, 72];
    const susceptibilityReport = susceptibility(system, W2, solve.witness);
    const failingTriangles = early.map(id => {
        const triangle = p.mesh.triangles[id];
        const bind = area2(...triangle.map(key => p.mesh.vertices.find(v =>
            v.vertexId === key)));
        return { id, area30: round(triangleAt(p, FW.skinBinding, id, 30)),
            area60: round(triangleAt(p, FW.skinBinding, id, 60)),
            firstZero: first120.first[id],
            areaMargin: round(triangleAt(p, FW.skinBinding, id, 60) / bind),
            vertexWeights: triangle.map(vertexId => ({ vertexId,
                influences: FW.skinBinding.vertexWeights.find(row =>
                    row.vertexId === vertexId).influences })) };
    });
    const modeBrief = name => ({ gradient: analyses[name].gradientSummary
        .JUNCTION_INTERIOR?.target,
        t60: { visibleInversion: at(analyses[name], 'translation', 60)
            .raster.visibleInversion,
            targetAlpha: at(analyses[name], 'translation', 60).raster.targetAlpha,
            alphaTotal: at(analyses[name], 'translation', 60).raster.alphaTotal,
            remote: at(analyses[name], 'translation', 60).raster.remote,
            junction: at(analyses[name], 'translation', 60).byRole['JUNCTION:root'],
            overlap: at(analyses[name], 'translation', 60).overlap },
        rotations: [5, 15, 30, 45].map(degrees => ({ degrees,
            visibleInversion: at(analyses[name], 'rotation', degrees)
                .raster.visibleInversion })) });
    const modes = Object.fromEntries(['W0', 'W1', 'W2', 'FW', 'FWmin']
        .map(name => [name, modeBrief(name)]));
    const translationSafe = analyses.FW.canonical.filter(row =>
        row.kind === 'translation').every(row => row.raster.visibleInversion === 0);
    const rotationSafe = modes.FW.rotations.every(row => row.visibleInversion === 0);
    const retention = max.raster.targetDisplacement
        / baseline.regions[fixture.movingBoneId].displacement;
    const strictRuntime = marginAreas.every(row => row.posed > AREA_EPSILON);
    assert.ok(strictRuntime, `${fixture.id}: FW LP margin`);
    const brush = fixture.id === 'connected-humanoid'
        ? brushCheck(p, FW.skinBinding, system) : null;
    report.push({ ...common, classification: !translationSafe ? 'E'
        : !rotationSafe ? 'C'
            : max.raster.targetAlpha < 0.85 || max.raster.targetAlpha > 1.15
                ? 'B' : 'A',
    numerical: { FWMaxRawViolation: FW.maximumRawViolation,
        FWminMaxRawViolation: FWmin.maximumRawViolation,
        witnessMinimumRatio: solve.witnessMinimumRatio,
        minimumDeviationArea: solve.minimumArea },
    mStarActiveTriangles: active,
    FWminDeviation: deviation(system, solve.minimumDeviation, distances),
    FWfromW2L1: round(solve.witnessL1FromW2),
    modes,
    energy: Object.fromEntries(['W2', 'FW', 'FWmin']
        .map(name => [name, energy(p.modes[name], system, edges)])),
    runtime: { series: analyses.FW.canonical.map(row => ({ kind: row.kind,
        magnitude: row.magnitude,
        visibleInversion: row.raster.visibleInversion,
        targetAlpha: row.raster.targetAlpha })),
        retention: round(retention), firstVisibleTranslation120: firstVisible120,
        root: rootMotion(p, FW.skinBinding), brush },
    failingTriangles, susceptibility: susceptibilityReport,
    timingMs: { ...common.lp.timingMs, runtimeValidation: runtimeMs } });
}
console.log('verify-rig-junction-pose-feasibility: PASS');
console.log(JSON.stringify({ fixtures: report }, null, 2));
