// R-46F canonical, diagnostic-only acceptance. No production registration.
import assert from 'node:assert/strict';
import { createAlphaFitRasterBoneSetup } from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning, RASTER_MESH_MAX_VERTICES }
    from '../system/animation/raster-bone-skinning.js';
import { createDomainContext } from './hybrid-domain-patch-diagnostic.mjs';
import { createNeutralJunctionTopology } from './neutral-junction-topology-diagnostic.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { fixtures, assetFor, snapshotFor, bindCoverage, evaluateMode,
    motionClip, topologyChurn } from './verify-rig-hybrid-domain-patch.mjs';

const round = n => Number.isFinite(n) ? Number(n.toFixed(3)) : n;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const geometry = r => JSON.stringify(r.meshDefinition || null);
const classification = r => JSON.stringify({
    ownership: r.diagnostic.ownershipBefore,
    junctions: r.diagnostic.junctions.map(j => j.candidateCells),
    roles: r.diagnostic.geometryRoles,
    interfaces: r.diagnostic.interfaces.map(i => i.boundaryIds) });
const signature = r => JSON.stringify({ ok: r.ok, reason: r.reason,
    detail: r.detail, classification: classification(r),
    mesh: r.meshDefinition, skin: r.skinBinding,
    sibling: [r.diagnostic.siblingSharedVertices, r.diagnostic.siblingSharedEdges] });
const summary = [];

for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const asset = assetFor(fixture), snapshot = snapshotFor(fixture);
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot);
    assert.equal(product.ok, true, `${fixture.id}: rectangular baseline`);
    const context = createDomainContext(asset, product);
    assert.equal(context.ok, true);
    const result = createNeutralJunctionTopology(asset, snapshot, product, context);
    const d = result.diagnostic;
    assert.equal(d.alpha.components.length, fixture.expectedAlphaComponents);
    assert.equal(d.ownershipUnchanged, true, `${fixture.id}: frozen ownership`);
    assert.deepEqual(d.ownershipBefore, d.ownershipAfter);
    const reference = signature(result);
    for (let i = 0; i < 20; i++) assert.equal(signature(createNeutralJunctionTopology(
        asset, snapshot, product, context)), reference,
    `${fixture.id}: deterministic repeat ${i + 1}`);

    const perturbations = [];
    for (const axis of ['x', 'rotation']) for (const amount of [0.25, 0.5, 1]) {
        const bones = fixture.bones.map(b => ({ ...b,
            bindTransform: { ...b.bindTransform } }));
        bones.find(b => b.boneId === fixture.movingBoneId).bindTransform[axis]
            += axis === 'rotation' ? degreesToRadians(amount) : amount;
        const changedAsset = { ...asset, rigDefinition: { ...asset.rigDefinition, bones } };
        const changedContext = createDomainContext(changedAsset, product);
        assert.equal(changedContext.ok, true);
        const next = createNeutralJunctionTopology(changedAsset, snapshot, product, changedContext);
        assert.equal(next.diagnostic.ownershipUnchanged, true);
        const ownerChanged = d.ownershipBefore.reduce((sum, id, i) => sum
            + (id !== next.diagnostic.ownershipBefore[i] ? 1 : 0), 0);
        const oldJunctions = JSON.stringify(d.junctions.map(j => j.candidateCells));
        const newJunctions = JSON.stringify(next.diagnostic.junctions.map(j => j.candidateCells));
        const junctionChanged = oldJunctions !== newJunctions;
        const rolesChanged = JSON.stringify(d.geometryRoles)
            !== JSON.stringify(next.diagnostic.geometryRoles);
        const interfaceChanged = JSON.stringify(d.interfaces.map(i => i.boundaryIds))
            !== JSON.stringify(next.diagnostic.interfaces.map(i => i.boundaryIds));
        const sameClassification = classification(result) === classification(next);
        const levelA = sameClassification && result.ok && next.ok
            ? geometry(result) === geometry(next) : null;
        const churn = result.ok && next.ok ? topologyChurn(result, next, 0) : null;
        // A fixed scaffold yields an exact mesh when both geometry runs succeed.
        // That is stronger than locality to changed tile + one ring.
        const levelB = !sameClassification && result.ok && next.ok
            ? geometry(result) === geometry(next) : null;
        assert.notEqual(levelA, false, `${fixture.id}: Level A ${axis}${amount}`);
        assert.notEqual(levelB, false, `${fixture.id}: Level B ${axis}${amount}`);
        perturbations.push({ axis, amount, ownerChanged, junctionChanged,
            rolesChanged, interfaceChanged, reason: next.reason || null,
            levelA, levelB, churn: churn ? {
                vertices: [churn.removedVertices, churn.addedVertices],
                edges: [churn.removedEdges, churn.addedEdges],
                triangles: [churn.removedTriangles, churn.addedTriangles] } : null });
    }

    let coverage = null, runtime = null, pose = [], rootPose = null;
    if (result.ok) {
        assert.ok(result.meshDefinition.vertices.length <= RASTER_MESH_MAX_VERTICES);
        assert.equal(d.siblingSharedVertices, 0);
        assert.equal(d.siblingSharedEdges, 0);
        runtime = validateRasterBoneSkinning([result.meshDefinition],
            [result.skinBinding], asset.internalLayers, asset.rigDefinition);
        assert.equal(runtime.ok, true, `${fixture.id}: generic Mesh/Skin`);
        coverage = bindCoverage(snapshot, result.meshDefinition);
        assert.equal(coverage.uncovered, 0, `${fixture.id}: uncovered Alpha`);
        assert.equal(coverage.multiple, 0, `${fixture.id}: duplicate Alpha coverage`);
        const baselineCoverage = bindCoverage(snapshot, product.meshDefinition);
        const junctionPoint = d.junctions.length
            ? context.segmentById.get(d.junctions[0].ancestor).start : null;
        const poseFixture = junctionPoint ? { ...fixture, joint: junctionPoint } : fixture;
        for (const kind of ['translation', 'rotation']) for (const amount of
            [5, 15, 30, kind === 'translation' ? 60 : 45]) {
            const motion = kind === 'translation'
                ? { x: amount } : { rotation: degreesToRadians(amount) };
            const clip = motionClip(fixture.movingBoneId, motion);
            const sample = evaluateMode(poseFixture, snapshot, asset, result,
                clip, coverage, context.gridDiagonal);
            const baseline = evaluateMode(poseFixture, snapshot, asset, product,
                clip, baselineCoverage, context.gridDiagonal);
            assert.equal(sample.valid, true, `${fixture.id}: ${kind}${amount} runtime`);
            assert.equal(baseline.valid, true, `${fixture.id}: production baseline`);
            const target = fixture.movingBoneId;
            pose.push({ kind, amount, targetDisplacement: round(sample.regions[target]?.displacement),
                retention: round(sample.regions[target]?.displacement
                    / baseline.regions[target]?.displacement),
                targetAlpha: round(sample.regions[target]?.alphaAreaRatio),
                unrelated: Object.fromEntries(fixture.regions.filter(r => r.id !== target)
                    .map(r => [r.id, round(sample.regions[r.id]?.displacement)])),
                visibleInversion: sample.quality.visibleInverted,
                allInversion: sample.quality.allInverted,
                alpha: round(sample.alphaRaster.alphaAreaRatio),
                alphaComponents: [sample.alphaRaster.bind.components,
                    sample.alphaRaster.posed.components],
                junctionAlpha: round(sample.junction?.alphaAreaRatio),
                junctionComponents: [sample.junction?.bind.components,
                    sample.junction?.posed.components] });
        }
        const root = evaluateMode(poseFixture, snapshot, asset, result,
            motionClip(fixture.rootBoneId, { x: 20 }), coverage, context.gridDiagonal);
        assert.equal(root.valid, true, `${fixture.id}: root motion`);
        rootPose = { finite: root.finite, alpha: round(root.alphaRaster.alphaAreaRatio),
            components: [root.alphaRaster.bind.components, root.alphaRaster.posed.components],
            visibleInversion: root.quality.visibleInverted,
            allInversion: root.quality.allInverted };
    }
    summary.push({ fixture: fixture.id, ok: result.ok, reason: result.reason || null,
        detail: result.detail || null, ownership: d.frozenDomainCounts,
        ownershipUnchanged: d.ownershipUnchanged, roles: d.roleCounts,
        junctions: d.junctions, interfaces: d.interfaces.map(i => ({
            parent: i.parent, child: i.child, length: i.length, cost: round(i.cost),
            limit: round(i.limit), remaining: i.remaining,
            boundaryCount: i.boundaryIds.length })),
        siblingSharedVertices: d.siblingSharedVertices,
        siblingSharedEdges: d.siblingSharedEdges,
        quality: d.quality, scaffoldVertices: d.scaffoldVertexCount,
        vertices: result.meshDefinition?.vertices.length || null,
        triangles: result.meshDefinition?.triangles.length || null,
        coverage: coverage ? { uncovered: coverage.uncovered,
            duplicate: coverage.multiple } : null,
        runtime: runtime?.ok ?? null, pose, rootPose,
        perturbations, deterministic20: true });
}

const disconnected = summary.find(r => r.fixture === 'disconnected-islands');
const connected = summary.find(r => r.fixture === 'connected-humanoid');
const chain = summary.find(r => r.fixture === 'simple-chain');
const branch = summary.find(r => r.fixture === 'branched-skeleton');
assert.equal(disconnected.ok, true);
assert.equal(disconnected.junctions.length, 0);
assert.equal(chain.ok, true);
assert.equal(chain.junctions.length, 0);
assert.equal(connected.ok, true);
assert.ok(connected.junctions[0].finalCount > 0);
assert.equal(connected.ownership.root, undefined);
assert.equal(branch.reason, 'junction-overflow');
assert.equal(branch.detail.cause, 'distal-protection');

// Fixed 512² Connected artwork, retaining its actual Junction work.
const sourceFixture = fixtures.find(f => f.id === 'connected-humanoid');
const source = snapshotFor(sourceFixture);
const pixels = new Uint8ClampedArray(512 * 512 * 4);
for (let y = 0; y < source.height; y++) pixels.set(source.pixels.subarray(
    y * source.width * 4, (y + 1) * source.width * 4), y * 512 * 4);
const large = { ...source, width: 512, height: 512,
    rasterBounds: { x: 0, y: 0, width: 512, height: 512 }, pixels };
const largeAsset = assetFor(sourceFixture);
const largeProduct = createAlphaFitRasterBoneSetup(largeAsset, 'art', large);
const largeContext = createDomainContext(largeAsset, largeProduct);
const timings = [];
for (let i = 0; i < 20; i++) {
    const generated = createNeutralJunctionTopology(largeAsset, large,
        largeProduct, largeContext);
    assert.equal(generated.ok, true, `512² representative #${i + 1}`);
    timings.push(generated.diagnostic.timingMs);
}
const performance512 = Object.fromEntries(Object.keys(timings[0]).map(stage =>
    [stage, round(median(timings.map(t => t[stage])))]));
const naturalLevelB = summary.flatMap(r => r.perturbations.filter(p =>
    p.ownerChanged || p.junctionChanged || p.rolesChanged || p.interfaceChanged));
const levelB = naturalLevelB.length && naturalLevelB.every(p => p.levelB === true)
    ? 'PASS' : 'UNKNOWN';
const classificationResult = 'C. JUNCTION REGION CANNOT REPRESENT CANONICAL BRANCHES';
console.log('verify-rig-neutral-junction-topology: PASS (diagnostic executed; classification separate)');
console.log(JSON.stringify({ classification: classificationResult, levelB,
    naturalLevelBCases: naturalLevelB.length, performance512, fixtures: summary }, null, 2));
