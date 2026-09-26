// R-47 selected Policy C verification; A/B remain comparison measurements.
import assert from 'node:assert/strict';
import { createAlphaFitRasterBoneSetup, ALPHA_FIT_GRID_GENERATOR,
    createRasterMeshSourceSignature } from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning, RASTER_MESH_MAX_VERTICES }
    from '../system/animation/raster-bone-skinning.js';
import { createSkinWeightBrushPlan } from '../system/animation/skin-weight-brush.js';
import { createDomainContext } from './hybrid-domain-patch-diagnostic.mjs';
import { createNeutralJunctionTopology } from './neutral-junction-topology-diagnostic.mjs';
import { inspectChildCore } from './child-core-policy-diagnostic.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { fixtures, assetFor, snapshotFor, bindCoverage, evaluateMode,
    motionClip, topologyChurn } from './verify-rig-hybrid-domain-patch.mjs';

const POLICY = { corePolicy: 'residual-child-connectivity' };
const round = n => Number.isFinite(n) ? Number(n.toFixed(3)) : n;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const coreSignature = result => JSON.stringify({ ok: result.ok, reason: result.reason,
    ownership: result.diagnostic.ownershipBefore,
    junctions: result.diagnostic.junctions.map(j => ({ candidate: j.candidateCells,
        final: j.finalCount, core: Object.fromEntries(Object.entries(j.coreByChild)
            .map(([id, c]) => [id, { seed: c.distalSeed,
                remainingCells: c.remainingCells, remainingAlpha: c.remainingAlpha,
                connectedAlpha: c.connectedAlpha, reason: c.reason }])) })),
    roles: result.diagnostic.geometryRoles,
    interfaces: result.diagnostic.interfaces.map(i => i.boundaryIds),
    constraints: result.diagnostic.constraints,
    mesh: result.meshDefinition, skin: result.skinBinding });
const classification = result => JSON.stringify({
    ownership: result.diagnostic.ownershipBefore,
    junction: result.diagnostic.junctions.map(j => j.candidateCells),
    core: result.diagnostic.junctions.map(j => Object.fromEntries(
        Object.entries(j.coreByChild).map(([id, c]) => [id,
            [c.distalSeed, c.remainingCells, c.remainingAlpha, c.connectedAlpha]]))),
    roles: result.diagnostic.geometryRoles,
    interfaces: result.diagnostic.interfaces.map(i => i.boundaryIds) });

function constraintCrossings(constraints) {
    const segments = constraints.map(e => {
        const [a, b] = e.id.split('>').map(point => point.split(',').map(Number));
        return { a, b };
    });
    let crossings = 0;
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i], b = segments[j];
        const av = a.a[0] === a.b[0], bv = b.a[0] === b.b[0];
        if (av === bv) continue;
        const v = av ? a : b, h = av ? b : a;
        if (v.a[0] > Math.min(h.a[0], h.b[0])
            && v.a[0] < Math.max(h.a[0], h.b[0])
            && h.a[1] > Math.min(v.a[1], v.b[1])
            && h.a[1] < Math.max(v.a[1], v.b[1])) crossings++;
    }
    return crossings;
}

function poseRow(fixture, snapshot, asset, setup, coverage, context, bone, motion) {
    const poseFixture = setup.diagnostic.junctions.length
        ? { ...fixture, joint: context.segmentById.get(
            setup.diagnostic.junctions[0].ancestor).start } : fixture;
    return evaluateMode(poseFixture, snapshot, asset, setup,
        motionClip(bone, motion), coverage, context.gridDiagonal);
}

const results = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const asset = assetFor(fixture), snapshot = snapshotFor(fixture);
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot);
    assert.equal(product.ok, true);
    const context = createDomainContext(asset, product);
    assert.equal(context.ok, true);
    const audit = inspectChildCore(asset, snapshot, product, context);
    const baseline = createNeutralJunctionTopology(asset, snapshot, product, context);
    const selected = createNeutralJunctionTopology(asset, snapshot, product, context, POLICY);
    const d = selected.diagnostic;
    assert.equal(d.alpha.components.length, fixture.expectedAlphaComponents);
    assert.equal(d.ownershipUnchanged, true);
    assert.deepEqual(d.ownershipBefore, d.ownershipAfter);
    assert.equal(selected.ok, true, `${fixture.id}: Policy C geometry`);
    assert.equal(d.siblingSharedEdges, 0);
    assert.equal(d.siblingSharedVertices, 0);
    assert.equal(constraintCrossings(d.constraints), 0);
    assert.ok(selected.meshDefinition.vertices.length <= RASTER_MESH_MAX_VERTICES);
    assert.equal(new Set(selected.meshDefinition.vertices.map(v => `${v.x},${v.y}`)).size,
        selected.meshDefinition.vertices.length, `${fixture.id}: no duplicate vertex coordinates`);
    const runtime = validateRasterBoneSkinning([selected.meshDefinition],
        [selected.skinBinding], asset.internalLayers, asset.rigDefinition);
    assert.equal(runtime.ok, true, `${fixture.id}: generic Mesh/Skin`);
    const coverage = bindCoverage(snapshot, selected.meshDefinition);
    assert.equal(coverage.uncovered, 0);
    assert.equal(coverage.multiple, 0);
    let brushDataLevel = null;
    if (fixture.id === 'branched-skeleton') {
        // The marker is transient test setup; the diagnostic Mesh output stays generic.
        const brushAsset = { ...asset,
            meshDefinitions: [{ ...selected.meshDefinition, generator: {
                type: ALPHA_FIT_GRID_GENERATOR,
                source: createRasterMeshSourceSignature(snapshot) } }],
            skinBindings: [selected.skinBinding] };
        const beforeBrush = structuredClone(brushAsset);
        const plan = createSkinWeightBrushPlan(brushAsset, 'art', 'left', [{
            vertexId: selected.meshDefinition.vertices[0].vertexId, delta: 0.1 }]);
        assert.equal(plan.ok, true, 'generated Branch SkinBinding accepts data-level brush');
        assert.deepEqual(brushAsset, beforeBrush, 'pure brush plan leaves input intact');
        brushDataLevel = { ok: plan.ok, changed: plan.changed };
    }
    const deterministic = coreSignature(selected);
    for (let i = 0; i < 20; i++) assert.equal(coreSignature(
        createNeutralJunctionTopology(asset, snapshot, product, context, POLICY)),
    deterministic, `${fixture.id}: repeat ${i + 1}`);
    for (const junction of d.junctions) {
        for (const core of Object.values(junction.coreByChild)) {
            assert.equal(core.ok, true);
            assert.equal(core.seedRepresented, true);
            assert.equal(core.connectedAlpha, core.remainingAlpha);
            assert.ok(core.distalSeed.distance <= 24);
        }
    }
    const perturbations = [];
    for (const axis of ['x', 'rotation']) for (const amount of [0.25, 0.5, 1]) {
        const bones = fixture.bones.map(b => ({ ...b,
            bindTransform: { ...b.bindTransform } }));
        bones.find(b => b.boneId === fixture.movingBoneId).bindTransform[axis]
            += axis === 'rotation' ? degreesToRadians(amount) : amount;
        const changedAsset = { ...asset, rigDefinition: { ...asset.rigDefinition, bones } };
        const changedContext = createDomainContext(changedAsset, product);
        const next = createNeutralJunctionTopology(changedAsset, snapshot,
            product, changedContext, POLICY);
        assert.equal(next.diagnostic.ownershipUnchanged, true);
        const ownerChanged = d.ownershipBefore.reduce((sum, id, i) =>
            sum + (id !== next.diagnostic.ownershipBefore[i] ? 1 : 0), 0);
        const oldCore = d.junctions.map(j => Object.values(j.coreByChild)
            .map(c => [c.distalSeed, c.remainingCells, c.remainingAlpha]));
        const newCore = next.diagnostic.junctions.map(j => Object.values(j.coreByChild)
            .map(c => [c.distalSeed, c.remainingCells, c.remainingAlpha]));
        const coreChanged = JSON.stringify(oldCore) !== JSON.stringify(newCore);
        const junctionChanged = JSON.stringify(d.junctions.map(j => j.candidateCells))
            !== JSON.stringify(next.diagnostic.junctions.map(j => j.candidateCells));
        const interfacesChanged = JSON.stringify(d.interfaces.map(i => i.boundaryIds))
            !== JSON.stringify(next.diagnostic.interfaces.map(i => i.boundaryIds));
        const same = classification(selected) === classification(next);
        const levelA = same && next.ok
            ? JSON.stringify(selected.meshDefinition) === JSON.stringify(next.meshDefinition)
            : null;
        const levelB = !same && next.ok
            ? JSON.stringify(selected.meshDefinition) === JSON.stringify(next.meshDefinition)
            : null;
        const churn = next.ok ? topologyChurn(selected, next, 0) : null;
        assert.notEqual(levelA, false, `${fixture.id}: Level A`);
        assert.notEqual(levelB, false, `${fixture.id}: Level B`);
        perturbations.push({ axis, amount, ok: next.ok, reason: next.reason || null,
            ownerChanged, distalSeedChanged: JSON.stringify(oldCore.map(j =>
                j.map(c => c[0]))) !== JSON.stringify(newCore.map(j => j.map(c => c[0]))),
            coreChanged, junctionChanged, interfacesChanged,
            levelA, levelB, churn: churn ? {
                removedVertices: churn.removedVertices, addedVertices: churn.addedVertices,
                removedEdges: churn.removedEdges, addedEdges: churn.addedEdges,
                removedTriangles: churn.removedTriangles,
                addedTriangles: churn.addedTriangles } : null });
    }
    const pose = [];
    if (fixture.id === 'branched-skeleton') {
        const baselineCoverage = bindCoverage(snapshot, product.meshDefinition);
        for (const kind of ['translation', 'rotation']) for (const amount of
            [5, 15, 30, kind === 'translation' ? 60 : 45]) {
            const motion = kind === 'translation'
                ? { x: amount } : { rotation: degreesToRadians(amount) };
            const sample = poseRow(fixture, snapshot, asset, selected, coverage,
                context, fixture.movingBoneId, motion);
            const production = evaluateMode(fixture, snapshot, asset, product,
                motionClip(fixture.movingBoneId, motion), baselineCoverage,
                context.gridDiagonal);
            assert.equal(sample.valid, true);
            assert.equal(production.valid, true);
            const target = fixture.movingBoneId;
            pose.push({ kind, amount,
                targetDisplacement: round(sample.regions[target]?.displacement),
                retention: round(sample.regions[target]?.displacement
                    / production.regions[target]?.displacement),
                targetAlpha: round(sample.regions[target]?.alphaAreaRatio),
                visibleInversion: sample.quality.visibleInverted,
                allInversion: sample.quality.allInverted,
                remote: Object.fromEntries(fixture.regions.filter(r => r.id !== target)
                    .map(r => [r.id, round(sample.regions[r.id]?.displacement)])),
                junctionAlpha: round(sample.junction?.alphaAreaRatio),
                junctionComponents: [sample.junction?.bind.components,
                    sample.junction?.posed.components] });
        }
    }
    let connectedPose = null;
    if (fixture.id === 'connected-humanoid') {
        const motion = { x: 60 };
        const beforeCoverage = bindCoverage(snapshot, baseline.meshDefinition);
        const before = poseRow(fixture, snapshot, asset, baseline,
            beforeCoverage, context, fixture.movingBoneId, motion);
        const after = poseRow(fixture, snapshot, asset, selected,
            coverage, context, fixture.movingBoneId, motion);
        assert.equal(before.valid, true);
        assert.equal(after.valid, true);
        assert.deepEqual(after.regions, before.regions,
            'Policy C does not change Connected pose');
        assert.deepEqual(after.quality, before.quality);
        assert.deepEqual(selected.meshDefinition.vertices, baseline.meshDefinition.vertices);
        assert.deepEqual(selected.meshDefinition.triangles, baseline.meshDefinition.triangles);
        connectedPose = { displacement: round(after.regions.arm.displacement),
            targetAlpha: round(after.regions.arm.alphaAreaRatio),
            visibleInversion: after.quality.visibleInverted };
    }
    results.push({ fixture: fixture.id, policyA: { ok: baseline.ok,
        reason: baseline.reason || null }, policyB: audit.children.map(row => ({
        child: row.child, protectedPixels: row.B.protectedPixels,
        protectedCells: row.B.protectedCells,
        collisionCells: row.B.collisionCells })),
        policyC: { ok: selected.ok, roles: d.roleCounts,
            junctionCells: d.junctions.map(j => j.finalCount),
            cores: d.junctions.map(j => j.coreByChild) },
        audit: { children: audit.children, conflicts: fixture.id === 'branched-skeleton'
            ? audit.conflicts : [] },
        ownership: d.frozenDomainCounts, sibling: [d.siblingSharedVertices,
            d.siblingSharedEdges], coverage: [coverage.uncovered, coverage.multiple],
        crossings: constraintCrossings(d.constraints), quality: d.quality,
        vertices: selected.meshDefinition.vertices.length,
        triangles: selected.meshDefinition.triangles.length,
        interfaces: d.interfaces.map(i => ({ child: i.child,
            length: i.length, cost: round(i.cost), remaining: i.remaining })),
        pose, connectedPose, perturbations, deterministic20: true,
        runtime: runtime.ok, brushDataLevel });
}

const disconnected = results.find(r => r.fixture === 'disconnected-islands');
const connected = results.find(r => r.fixture === 'connected-humanoid');
const chain = results.find(r => r.fixture === 'simple-chain');
const branch = results.find(r => r.fixture === 'branched-skeleton');
assert.equal(disconnected.policyC.junctionCells.length, 0);
assert.equal(chain.policyC.junctionCells.length, 0);
assert.deepEqual(connected.policyC.junctionCells, [34]);
assert.equal(connected.ownership.root, undefined);
assert.deepEqual(branch.policyC.junctionCells, [24]);
assert.equal(branch.ownership.root, undefined);
assert.equal(branch.policyA.reason, 'junction-overflow');

const f = fixtures.find(row => row.id === 'branched-skeleton');
const original = snapshotFor(f), pixels = new Uint8ClampedArray(512 * 512 * 4);
for (let y = 0; y < original.height; y++) pixels.set(original.pixels.subarray(
    y * original.width * 4, (y + 1) * original.width * 4), y * 512 * 4);
const large = { ...original, width: 512, height: 512,
    rasterBounds: { x: 0, y: 0, width: 512, height: 512 }, pixels };
const largeAsset = assetFor(f), largeProduct = createAlphaFitRasterBoneSetup(
    largeAsset, 'art', large), largeContext = createDomainContext(largeAsset, largeProduct);
const timings = [];
for (let i = 0; i < 20; i++) {
    const run = createNeutralJunctionTopology(largeAsset, large,
        largeProduct, largeContext, POLICY);
    assert.equal(run.ok, true, `512² Branch ${i + 1}`);
    timings.push(run.diagnostic.timingMs);
}
const performance512 = Object.fromEntries(['distalSupport', 'coreValidation',
    'junction', 'total'].map(stage => [stage,
    round(median(timings.map(t => t[stage])))]));
const changes = results.flatMap(r => r.perturbations.filter(p => p.ownerChanged
    || p.distalSeedChanged || p.coreChanged || p.junctionChanged || p.interfacesChanged));
const levelB = changes.length && changes.every(p => p.levelB === true)
    ? 'PASS' : 'UNKNOWN';
console.log('verify-rig-child-core-junction: PASS (Policy C diagnostic)');
console.log(JSON.stringify({ classification: 'B. REFINED CHILD CORE VALID, POSE QUALITY IS NEXT BLOCKER',
    levelB, changedMicroCases: changes.length, performance512, fixtures: results }, null, 2));
