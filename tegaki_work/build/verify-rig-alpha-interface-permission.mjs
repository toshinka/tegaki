import assert from 'node:assert/strict';
import { createAlphaFitRasterBoneSetup } from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning, RASTER_MESH_MAX_VERTICES }
    from '../system/animation/raster-bone-skinning.js';
import { createDomainContext } from './hybrid-domain-patch-diagnostic.mjs';
import { createAlphaInterfacePermissionTopology }
    from './alpha-interface-permission-diagnostic.mjs';
import { createConstrainedHybridTopology } from './constrained-hybrid-topology-diagnostic.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { fixtures, snapshotFor, assetFor, motionClip, bindCoverage,
    evaluateMode, topologyChurn } from './verify-rig-hybrid-domain-patch.mjs';

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;
const signature = result => JSON.stringify({ ok: result.ok, reason: result.reason,
    detail: result.detail, ownershipBefore: result.diagnostic.ownershipBefore,
    ownershipAfter: result.diagnostic.ownershipAfter,
    pairs: result.diagnostic.pairs, graph: result.diagnostic.graph,
    meshDefinition: result.meshDefinition, skinBinding: result.skinBinding });
const classificationSignature = result => JSON.stringify({
    ownership: result.diagnostic.ownershipBefore,
    selected: result.diagnostic.pairs.map(pair => pair.selectedInterfaceComponent),
    allowed: result.diagnostic.pairs.map(pair => pair.allowedSharedBoundary) });

function micro(fixture, asset, snapshot, product, nominal) {
    const changes = [];
    for (const axis of ['x', 'rotation']) for (const amount of [0.25, 0.5, 1]) {
        const bones = fixture.bones.map(b => ({ ...b, bindTransform: { ...b.bindTransform } }));
        bones.find(b => b.boneId === fixture.movingBoneId).bindTransform[axis]
            += axis === 'rotation' ? degreesToRadians(amount) : amount;
        const changedAsset = { ...asset, rigDefinition: { ...asset.rigDefinition, bones } };
        const changedContext = createDomainContext(changedAsset, product);
        const next = createAlphaInterfacePermissionTopology(changedAsset, snapshot,
            product, changedContext);
        assert.equal(next.diagnostic.ownershipUnchanged, true,
            `${fixture.id}/${axis}${amount}: ownership immutable within generation`);
        const ownerChanges = nominal.diagnostic.ownershipBefore.reduce((sum, id, index) =>
            sum + (id !== next.diagnostic.ownershipBefore[index] ? 1 : 0), 0);
        const permissionChanged = classificationSignature(nominal)
            !== classificationSignature(next);
        const levelA = !permissionChanged && nominal.ok && next.ok
            ? JSON.stringify(nominal.meshDefinition) === JSON.stringify(next.meshDefinition)
            : !permissionChanged ? null : null;
        const churn = nominal.ok && next.ok ? topologyChurn(nominal, next, 0) : null;
        const changedCells = new Set();
        const oldCells = nominal.diagnostic.cells, newCells = next.diagnostic.cells;
        for (let i = 0; i < oldCells.length; i++) {
            if (oldCells[i].domain !== newCells[i].domain) {
                const centerX = (oldCells[i].bounds.x0 + oldCells[i].bounds.x1) / 2;
                const centerY = (oldCells[i].bounds.y0 + oldCells[i].bounds.y1) / 2;
                changedCells.add(`${Math.floor(centerX / 24)},${Math.floor(centerY / 24)}`);
            }
        }
        for (const [oldPair, newPair] of nominal.diagnostic.pairs.map((pair, i) =>
            [pair, next.diagnostic.pairs[i]])) {
            const delta = new Set([
                ...oldPair.allowedSharedBoundary.filter(id =>
                    !newPair.allowedSharedBoundary.includes(id)),
                ...newPair.allowedSharedBoundary.filter(id =>
                    !oldPair.allowedSharedBoundary.includes(id))]);
            for (const id of delta) {
                const [a, b] = id.split('>');
                for (const p of [a, b]) {
                    const [x, y] = p.split(',').map(Number);
                    changedCells.add(`${Math.floor(x / 24)},${Math.floor(y / 24)}`);
                }
            }
        }
        let levelB = null, outsideChanges = null;
        if (permissionChanged && nominal.ok && next.ok) {
            // The spatial scaffold is independent of Bone coordinates. Exact
            // geometry equality is stronger than the required one-ring bound.
            outsideChanges = JSON.stringify(nominal.meshDefinition)
                === JSON.stringify(next.meshDefinition) ? 0 : 'requires-local-diff';
            levelB = outsideChanges === 0;
        }
        changes.push({ axis, amount, reason: next.reason || null, ok: next.ok,
            ownerChanges, permissionChanged, changedTiles: [...changedCells].sort(),
            levelA, levelB, outsideChanges,
            topologyChurn: churn ? { removedVertices: churn.removedVertices,
                addedVertices: churn.addedVertices, removedEdges: churn.removedEdges,
                addedEdges: churn.addedEdges, removedTriangles: churn.removedTriangles,
                addedTriangles: churn.addedTriangles } : null });
    }
    return changes;
}

const results = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const asset = assetFor(fixture), snapshot = snapshotFor(fixture);
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot);
    assert.equal(product.ok, true);
    const context = createDomainContext(asset, product);
    assert.equal(context.ok, true);
    const previous = createConstrainedHybridTopology(asset, snapshot, product, context);
    const current = createAlphaInterfacePermissionTopology(asset, snapshot, product, context);
    assert.equal(current.diagnostic.alpha.components.length,
        fixture.expectedAlphaComponents);
    assert.equal(current.diagnostic.ownershipUnchanged, true);
    assert.deepEqual(current.diagnostic.ownershipBefore, current.diagnostic.ownershipAfter);
    const reference = signature(current);
    for (let repeat = 0; repeat < 20; repeat++) {
        assert.equal(signature(createAlphaInterfacePermissionTopology(asset, snapshot,
            product, context)), reference,
        `${fixture.id}: deterministic analysis #${repeat + 1}`);
    }
    const changed = micro(fixture, asset, snapshot, product, current);
    assert.ok(changed.every(row => row.levelA !== false && row.levelB !== false),
        `${fixture.id}: micro stability`);
    let pose = null, validation = null, coverage = null;
    if (current.ok) {
        assert.ok(current.meshDefinition.vertices.length <= RASTER_MESH_MAX_VERTICES);
        validation = validateRasterBoneSkinning([current.meshDefinition],
            [current.skinBinding], asset.internalLayers, asset.rigDefinition);
        assert.equal(validation.ok, true, `${fixture.id}: Mesh/Skin shape`);
        coverage = bindCoverage(snapshot, current.meshDefinition);
        assert.equal(coverage.uncovered, 0, `${fixture.id}: bind coverage`);
        assert.equal(coverage.multiple, 0, `${fixture.id}: duplicate coverage`);
        assert.equal(current.diagnostic.siblingContactCount, 0);
        assert.equal(current.diagnostic.componentCrossingCount, 0);
        const motion = fixture.id === 'simple-chain'
            ? { rotation: degreesToRadians(45) } : { x: 60 };
        const sample = evaluateMode(fixture, snapshot, asset, current,
            motionClip(fixture.movingBoneId, motion), coverage, context.gridDiagonal);
        const baselineCoverage = bindCoverage(snapshot, product.meshDefinition);
        const baseline = evaluateMode(fixture, snapshot, asset, product,
            motionClip(fixture.movingBoneId, motion), baselineCoverage, context.gridDiagonal);
        assert.equal(sample.valid, true, `${fixture.id}: runtime pose`);
        const target = fixture.movingBoneId;
        pose = { visibleInversion: sample.quality.visibleInverted,
            targetRetention: sample.regions[target].displacement
                / baseline.regions[target].displacement,
            targetAlphaAmount: sample.regions[target].alphaAreaRatio,
            unrelated: Object.fromEntries(fixture.regions.filter(r => r.id !== target)
                .map(r => [r.id, sample.regions[r.id].displacement])) };
    }
    const pairSummary = current.diagnostic.pairs.map(pair => ({
        pair: `${pair.parentDomainId}/${pair.childDomainId}`,
        seed: pair.jointSeed, L: pair.limit,
        candidates: pair.candidateInterfaceCount,
        selected: pair.selectedInterfaceComponent,
        associationCost: pair.associationCost,
        selectedBoundaryLength: pair.selectedBoundaryLength,
        remaining: pair.unassociatedRemainingContactCount,
        failure: pair.failureReason }));
    results.push({ fixture: fixture.id, alphaComponents: fixture.expectedAlphaComponents,
        old: { ok: previous.ok, reason: previous.reason || null },
        current: { ok: current.ok, reason: current.reason || null,
            detail: current.detail || null, vertices: current.meshDefinition?.vertices.length || null,
            triangles: current.meshDefinition?.triangles.length || null },
        frozenDomains: current.diagnostic.frozenDomainCounts,
        ownershipUnchanged: current.diagnostic.ownershipUnchanged,
        pairs: pairSummary,
        missingAncestors: current.diagnostic.missingAncestorDomains,
        siblingContactCount: current.diagnostic.siblingContactCount,
        componentCrossingCount: current.diagnostic.componentCrossingCount,
        graphEdges: current.diagnostic.graph.length,
        bindCoverage: coverage ? { uncovered: coverage.uncovered,
            duplicate: coverage.multiple } : null,
        runtimeValid: validation?.ok ?? null,
        pose, micro: changed, deterministic20: true });
}

const disconnected = results.find(row => row.fixture === 'disconnected-islands');
const connected = results.find(row => row.fixture === 'connected-humanoid');
const chain = results.find(row => row.fixture === 'simple-chain');
const branch = results.find(row => row.fixture === 'branched-skeleton');
assert.equal(disconnected.current.ok, true);
assert.equal(disconnected.frozenDomains.arm, 4);
assert.equal(disconnected.frozenDomains.head, 9);
assert.equal(disconnected.frozenDomains.leg, 9);
assert.equal(disconnected.componentCrossingCount, 0);
assert.equal(chain.current.ok, true);
assert.equal(chain.pairs.find(p => p.pair === 'upper/lower').candidates, 1);
assert.ok(chain.pairs.find(p => p.pair === 'upper/lower').associationCost <= 88);
assert.equal(chain.pairs.find(p => p.pair === 'upper/lower').remaining, 0);
const chainAsset = assetFor(fixtures.find(f => f.id === 'simple-chain'));
const chainSnapshot = snapshotFor(fixtures.find(f => f.id === 'simple-chain'));
const chainProduct = createAlphaFitRasterBoneSetup(chainAsset, 'art', chainSnapshot);
const chainContext = createDomainContext(chainAsset, chainProduct);
const chainInterface = createAlphaInterfacePermissionTopology(chainAsset,
    chainSnapshot, chainProduct, chainContext);
const lowerBoundary = chainInterface.diagnostic.pairs.find(p =>
    p.childDomainId === 'lower').allowedSharedBoundary;
// R-46B placed its lower-child portal at (124,50), radius 12. The selected
// real domain interface is at x=96, fully beyond that former contact cap.
assert.ok(lowerBoundary.length > 0 && lowerBoundary.every(id => {
    const [from, to] = id.split('>').map(point => point.split(',').map(Number));
    return Math.min(Math.abs(from[0] - 124), Math.abs(to[0] - 124)) > 12;
}), 'Chain interface lies beyond the former joint portal');
assert.equal(connected.current.reason, 'missing-ancestor-domain');
assert.equal(branch.current.reason, 'missing-ancestor-domain');
assert.equal(connected.frozenDomains.root, undefined);
assert.equal(branch.frozenDomains.root, undefined);
assert.equal(connected.pairs.find(p => p.pair === 'root/head').candidates, 0);

// The existing Chain artwork in a 512² raster supplies a bounded probe.
const sourceFixture = fixtures.find(f => f.id === 'simple-chain');
const source = snapshotFor(sourceFixture);
const pixels = new Uint8ClampedArray(512 * 512 * 4);
for (let y = 0; y < source.height; y++) {
    pixels.set(source.pixels.subarray(y * source.width * 4,
        (y + 1) * source.width * 4), y * 512 * 4);
}
const largeSnapshot = { ...source, width: 512, height: 512,
    rasterBounds: { x: 0, y: 0, width: 512, height: 512 }, pixels };
const largeAsset = assetFor(sourceFixture);
const largeProduct = createAlphaFitRasterBoneSetup(largeAsset, 'art', largeSnapshot);
const largeContext = createDomainContext(largeAsset, largeProduct);
const timings = [];
for (let i = 0; i < 20; i++) {
    const generated = createAlphaInterfacePermissionTopology(largeAsset,
        largeSnapshot, largeProduct, largeContext);
    assert.equal(generated.ok, true, '512² Chain geometry');
    timings.push(generated.diagnostic.timingMs);
}
const performance512 = Object.fromEntries(['ownership', 'extraction', 'association',
    'graph', 'triangulation', 'total'].map(stage => [stage,
    round(median(timings.map(value => value[stage])))]));

const classificationChanges = results.flatMap(row => row.micro.filter(m => m.permissionChanged));
const levelB = classificationChanges.length ? classificationChanges.every(m => m.levelB) ? 'PASS'
    : 'UNKNOWN' : 'UNKNOWN';
const classification = results.some(row => row.micro.some(m => m.levelA === false
    || m.levelB === false)) ? 'D. STABILITY FAILS'
    : !chain.current.ok || !disconnected.current.ok ? 'C. ALPHA-INTERFACE ASSOCIATION ITSELF FAILS'
        : connected.current.reason === 'missing-ancestor-domain'
            && branch.current.reason === 'missing-ancestor-domain'
            ? 'A. CONTACT SEMANTICS VALIDATED, ANCESTOR OWNERSHIP IS NEXT BLOCKER'
                : 'E. INCONCLUSIVE';
console.log('verify-rig-alpha-interface-permission: PASS (diagnostic executed; classification separate)');
console.log(JSON.stringify({ classification, levelB,
    performance512, fixtures: results }, null, 2));
