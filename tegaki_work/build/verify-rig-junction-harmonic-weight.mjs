// R-49 diagnostic acceptance. R-47 geometry and production behavior are frozen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateRasterBoneSkinning, evaluateRasterBoneSkinning }
    from '../system/animation/raster-bone-skinning.js';
import { ALPHA_FIT_GRID_GENERATOR, createRasterMeshSourceSignature }
    from '../system/animation/raster-bone-auto-setup.js';
import { createSkinWeightBrushPlan }
    from '../system/animation/skin-weight-brush.js';
import { fixtures, evaluateMode, motionClip, bindCoverage }
    from './verify-rig-hybrid-domain-patch.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { preparePoseAttribution, analyzePoseAttribution }
    from './pose-failure-attribution-diagnostic.mjs';
import { createJunctionHarmonicWeights, medianHarmonicTimings,
    HARMONIC_LENGTH_EPSILON, HARMONIC_WEIGHT_TOLERANCE }
    from './junction-harmonic-weight-diagnostic.mjs';

const round = n => typeof n === 'number' && Number.isFinite(n)
    ? Number(n.toFixed(4)) : n;
// Fingerprints from the R-47-verified Mesh arrays, roles, and legal interfaces.
const R47_FROZEN = {
    'disconnected-islands': '2eda38c39b4e42f298a1e1bdca46d73aa65eb0c14c7609b2bbbf2eb4fbf86136',
    'connected-humanoid': 'cff2fc82bbf1e9efefe901ac60150760fc10f9e491fb42bc7ebbcc0e9ce325e9',
    'simple-chain': '2c9a21ed8573fb545bd19ea49b062ddfec7c90994101be9a38e0e5a1f5c20fe1',
    'branched-skeleton': '50dd7032f8a1e3ce2c7bf0b00e88508dc4e5311d562678fda5a7f84d41027eb3'
};
const r47Fingerprint = prepared => createHash('sha256').update(JSON.stringify({
    vertices: prepared.mesh.vertices, triangles: prepared.mesh.triangles,
    geometryRoles: prepared.topology.diagnostic.geometryRoles,
    faceRoles: prepared.topology.diagnostic.faceRoles,
    interfaces: prepared.topology.diagnostic.interfaces.map(item => ({
        parent: item.parent, child: item.child, component: item.component,
        boundaryIds: item.boundaryIds })) })).digest('hex');
const maxPose = (mode, kind, magnitude) => mode.canonical.find(row =>
    row.kind === kind && row.magnitude === magnitude);
const first = (mode, kind) => mode.threshold?.[kind].first.filter(x => x !== null)
    .sort((a, b) => a - b)[0] ?? null;
const area2 = (a, b, c) => (b.x - a.x) * (c.y - a.y)
    - (b.y - a.y) * (c.x - a.x);
const poseTriangle = (prepared, skin, id, kind, magnitude) => {
    const clip = motionClip(prepared.fixture.movingBoneId, kind === 'translation'
        ? { x: magnitude } : { rotation: degreesToRadians(magnitude) });
    const asset = { ...prepared.asset, meshDefinitions: [prepared.mesh],
        skinBindings: [skin] };
    const posed = evaluateRasterBoneSkinning(asset, clip, 0);
    assert.equal(posed.ok, true);
    const vertex = new Map(posed.resultByMeshId.get(prepared.mesh.meshId).vertices
        .map(v => [v.vertexId, v]));
    return round(area2(...prepared.mesh.triangles[id].map(key => vertex.get(key))));
};
const gradient = (mode, kind) => mode.gradientSummary[kind] || null;
const present = mode => ({ firstTranslation: first(mode, 'translation'),
    firstRotation: first(mode, 'rotation'),
    t60: maxPose(mode, 'translation', 60), r45: maxPose(mode, 'rotation', 45) });
const metric = row => ({ visibleInversion: row.raster.visibleInversion,
    targetDisplacement: row.raster.targetDisplacement,
    targetAlpha: row.raster.targetAlpha, alphaTotal: row.raster.alphaTotal,
    junctionAlpha: row.raster.junctionAlpha, remote: row.raster.remote,
    junction: row.byRole['JUNCTION:root'], overlap: row.overlap });

const report = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const prepared = preparePoseAttribution(fixture);
    assert.equal(r47Fingerprint(prepared), R47_FROZEN[fixture.id],
        `${fixture.id}: frozen R-47 Mesh and roles before W2`);
    const frozenMesh = JSON.stringify(prepared.mesh);
    const frozenRoles = JSON.stringify({ geometryRoles: prepared.topology.diagnostic.geometryRoles,
        faceRoles: prepared.topology.diagnostic.faceRoles,
        interfaces: prepared.topology.diagnostic.interfaces });
    const frozenW1 = JSON.stringify(prepared.modes.W1);
    const W2 = createJunctionHarmonicWeights(prepared.topology, prepared.context);
    assert.equal(W2.ok, true, `${fixture.id}: ${W2.reason} ${JSON.stringify(W2.detail)}`);
    assert.equal(JSON.stringify(prepared.mesh), frozenMesh);
    assert.equal(JSON.stringify({ geometryRoles: prepared.topology.diagnostic.geometryRoles,
        faceRoles: prepared.topology.diagnostic.faceRoles,
        interfaces: prepared.topology.diagnostic.interfaces }), frozenRoles);
    assert.equal(JSON.stringify(prepared.modes.W1), frozenW1);
    assert.deepEqual([prepared.coverage.uncovered, prepared.coverage.multiple], [0, 0]);
    const bindingValidation = validateRasterBoneSkinning([prepared.mesh],
        [W2.skinBinding], prepared.asset.internalLayers, prepared.asset.rigDefinition);
    assert.equal(bindingValidation.ok, true, `${fixture.id}: ordinary SkinBinding`);
    const active = new Set(W2.activeVertexIds), W1ById = new Map(prepared.modes.W1
        .vertexWeights.map(row => [row.vertexId, row]));
    for (const row of W2.skinBinding.vertexWeights) {
        if (!active.has(row.vertexId)) assert.deepEqual(row, W1ById.get(row.vertexId),
            `${fixture.id}: non-Junction W1 equality`);
        assert.ok(row.influences.length <= 4);
        assert.ok(Math.abs(row.influences.reduce((sum, item) => sum + item.weight, 0)
            - 1) <= HARMONIC_WEIGHT_TOLERANCE);
    }
    if (['disconnected-islands', 'simple-chain'].includes(fixture.id)) {
        assert.equal(active.size, 0);
        assert.deepEqual(W2.skinBinding, prepared.modes.W1,
            `${fixture.id}: no-Junction exact control`);
    }
    if (fixture.id === 'connected-humanoid') {
        assert.deepEqual([prepared.mesh.vertices.length, prepared.mesh.triangles.length,
            prepared.topology.diagnostic.junctions[0].finalCount], [91, 132, 34]);
    }
    if (fixture.id === 'branched-skeleton') {
        assert.deepEqual([prepared.mesh.vertices.length, prepared.mesh.triangles.length,
            prepared.topology.diagnostic.junctions[0].finalCount], [61, 80, 24]);
    }
    prepared.modes.W2 = W2.skinBinding;
    const modes = Object.fromEntries(['W0', 'W1', 'W2'].map(name =>
        [name, analyzePoseAttribution(prepared, name)]));
    for (const mode of Object.values(modes)) {
        for (const row of mode.canonical) {
            assert.equal(row.raster.visibleInversion,
                row.visibleInverted.length + row.mixedInverted.length);
            assert.equal(row.raster.allInversion, row.inverted.length);
        }
    }
    if (modes.W2.analytic) {
        assert.equal(modes.W2.analytic.linear, true);
        assert.ok(modes.W2.analytic.maxThresholdDifference <= 0.1);
    }
    const rootAsset = { ...prepared.asset, meshDefinitions: [prepared.mesh],
        skinBindings: [W2.skinBinding] };
    const rootEval = evaluateRasterBoneSkinning(rootAsset,
        motionClip(fixture.rootBoneId, { x: 20 }), 0);
    assert.equal(rootEval.ok, true);
    const rootVertices = rootEval.resultByMeshId.get(prepared.mesh.meshId).vertices;
    const rootErrors = rootVertices.map((v, i) => ({
        x: v.x - prepared.mesh.vertices[i].x - 20,
        y: v.y - prepared.mesh.vertices[i].y }));
    const rootRaster = evaluateMode(fixture, prepared.snapshot, prepared.asset,
        { meshDefinition: prepared.mesh, skinBinding: W2.skinBinding },
        motionClip(fixture.rootBoneId, { x: 20 }), prepared.coverage,
        prepared.context.gridDiagonal);
    assert.equal(rootRaster.valid, true);
    const rootMotion = { maximumCoordinateError: round(Math.max(...rootErrors
        .flatMap(row => [Math.abs(row.x), Math.abs(row.y)]))),
        alpha: round(rootRaster.alphaRaster.alphaAreaRatio),
        visibleInversion: rootRaster.quality.visibleInverted };
    assert.ok(rootMotion.maximumCoordinateError < 1e-7);
    assert.ok(Math.abs(rootMotion.alpha - 1) < 0.01);
    assert.equal(rootMotion.visibleInversion, 0);

    let brush = null;
    if (fixture.id === 'connected-humanoid') {
        const choice = W2.skinBinding.vertexWeights.find(row => active.has(row.vertexId)
            && row.influences.some(item => item.boneId === fixture.movingBoneId
                && item.weight > 0.05 && item.weight < 0.95));
        assert.ok(choice, 'W2 mixed Junction vertex for Weight Brush');
        const brushAsset = { ...rootAsset, meshDefinitions: [{ ...prepared.mesh,
            generator: { type: ALPHA_FIT_GRID_GENERATOR,
                source: createRasterMeshSourceSignature(prepared.snapshot) } }] };
        const before = JSON.stringify(brushAsset);
        const plan = createSkinWeightBrushPlan(brushAsset, 'art', fixture.movingBoneId,
            [{ vertexId: choice.vertexId, delta: 0.01 }]);
        assert.equal(plan.ok, true, `Weight Brush: ${plan.reason}`);
        assert.equal(plan.changed, true);
        assert.equal(JSON.stringify(brushAsset), before, 'Brush plan pure');
        assert.deepEqual(plan.meshDefinitions[0].vertices, prepared.mesh.vertices);
        assert.deepEqual(plan.meshDefinitions[0].triangles, prepared.mesh.triangles);
        brush = { ok: plan.ok, changed: plan.changed, vertexId: choice.vertexId };
    }
    const performanceSamples = [];
    if (['connected-humanoid', 'branched-skeleton'].includes(fixture.id)) {
        const reference = JSON.stringify(W2.skinBinding);
        for (let i = 0; i < 20; i++) {
            const repeat = createJunctionHarmonicWeights(prepared.topology, prepared.context);
            assert.equal(repeat.ok, true);
            assert.equal(JSON.stringify(repeat.skinBinding), reference,
                `${fixture.id}: deterministic repeat ${i + 1}`);
            performanceSamples.push(repeat.timings);
        }
    }
    const baselineCoverage = bindCoverage(prepared.snapshot,
        prepared.product.meshDefinition);
    const retention = Object.fromEntries(['W0', 'W1', 'W2'].map(name => {
        const row = maxPose(modes[name], 'translation', 60);
        const baseline = evaluateMode(fixture, prepared.snapshot, prepared.asset,
            prepared.product, motionClip(fixture.movingBoneId, { x: 60 }),
            baselineCoverage, prepared.context.gridDiagonal);
        assert.equal(baseline.valid, true);
        return [name, round(row.raster.targetDisplacement
            / baseline.regions[fixture.movingBoneId].displacement)];
    }));
    const sameTriangleId = fixture.id === 'connected-humanoid' ? 51
        : fixture.id === 'branched-skeleton' ? 17 : null;
    const sameTriangle = sameTriangleId === null ? null : {
        id: sameTriangleId,
        atW1FailurePose: Object.fromEntries(['W0', 'W1', 'W2'].map(name =>
            [name, poseTriangle(prepared, prepared.modes[name], sameTriangleId,
                'translation', fixture.id === 'connected-humanoid' ? 9 : 2)])),
        firstTranslation: Object.fromEntries(['W0', 'W1', 'W2'].map(name =>
            [name, modes[name].threshold.translation.first[sameTriangleId]])),
        targetGradient: Object.fromEntries(['W0', 'W1', 'W2'].map(name => {
            const weights = new Map(prepared.modes[name].vertexWeights.map(row =>
                [row.vertexId, row.influences.find(item =>
                    item.boneId === fixture.movingBoneId)?.weight || 0]));
            const tri = prepared.mesh.triangles[sameTriangleId];
            return [name, round(Math.max(...[[0, 1], [1, 2], [2, 0]]
                .map(([a, b]) => Math.abs(weights.get(tri[a]) - weights.get(tri[b])))))];
        })) };
    const packets = Object.fromEntries(['translation', 'rotation'].map(kind =>
        [kind, (modes.W2.packets?.[kind] || []).slice(0, 20).map(packet => ({
            id: packet.id, role: packet.role, bindArea2: packet.bindArea2,
            posedArea2: packet.posedArea2, firstInversion: packet.firstInversion,
            weights: packet.weights, maxTargetGradient: packet.maxTargetGradient,
            W0Area2: poseTriangle(prepared, prepared.modes.W0, packet.id, kind,
                kind === 'translation' ? 60 : 45),
            W1Area2: poseTriangle(prepared, prepared.modes.W1, packet.id, kind,
                kind === 'translation' ? 60 : 45) }))]));
    report.push({ fixture: fixture.id,
        frozen: { vertices: prepared.mesh.vertices.length,
            triangles: prepared.mesh.triangles.length,
            junctionCells: prepared.topology.diagnostic.junctions.map(j => j.finalCount),
            ownershipUnchanged: prepared.topology.diagnostic.ownershipUnchanged },
        graph: W2.junctions, activeVertices: active.size,
        outsideW1Identical: true, rootMotion, brush,
        harmonic: { lengthEpsilon: HARMONIC_LENGTH_EPSILON,
            weightTolerance: HARMONIC_WEIGHT_TOLERANCE,
            timingMedianMs: performanceSamples.length
                ? medianHarmonicTimings(performanceSamples) : null,
            deterministicRuns: performanceSamples.length },
        gradient: Object.fromEntries(['W0', 'W1', 'W2'].map(name =>
            [name, { child: gradient(modes[name], 'CHILD_INTERIOR'),
                interface: gradient(modes[name], 'CHILD_JUNCTION_INTERFACE'),
                junction: gradient(modes[name], 'JUNCTION_INTERIOR') }])),
        comparison: Object.fromEntries(['W0', 'W1', 'W2'].map(name => {
            const p = present(modes[name]);
            return [name, { firstTranslation: p.firstTranslation,
                firstRotation: p.firstRotation,
                t60: metric(p.t60), r45: metric(p.r45),
                series: modes[name].canonical.map(row => ({ kind: row.kind,
                    magnitude: row.magnitude, visibleInversion: row.raster.visibleInversion,
                    targetAlpha: row.raster.targetAlpha })) }];
        })), retention, sameTriangle, packets,
        analytic: modes.W2.analytic ? { linear: modes.W2.analytic.linear,
            maxLinearityError: modes.W2.analytic.maxLinearityError,
            predictedCrossings: modes.W2.analytic.predictedCrossings,
            observedCrossings: modes.W2.analytic.observedCrossings,
            maxThresholdDifference: modes.W2.analytic.maxThresholdDifference } : null });
}
console.log('verify-rig-junction-harmonic-weight: PASS');
console.log(JSON.stringify({ fixtures: report }, null, 2));
