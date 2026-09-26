// R-48 same-topology W0/W1 attribution against the production evaluator.
import assert from 'node:assert/strict';
import { validateRasterBoneSkinning } from '../system/animation/raster-bone-skinning.js';
import { fixtures, bindCoverage, evaluateMode, motionClip }
    from './verify-rig-hybrid-domain-patch.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { preparePoseAttribution, analyzePoseAttribution }
    from './pose-failure-attribution-diagnostic.mjs';

const round = n => Number.isFinite(n) ? Number(n.toFixed(3)) : n;
const report = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const prepared = preparePoseAttribution(fixture);
    const frozenMesh = JSON.stringify(prepared.mesh);
    const frozenRoles = JSON.stringify(prepared.topology.diagnostic.geometryRoles);
    const frozenWeights = Object.fromEntries(['W0', 'W1'].map(name =>
        [name, JSON.stringify(prepared.modes[name])]));
    assert.equal(prepared.coverage.uncovered, 0);
    assert.equal(prepared.coverage.multiple, 0);
    const modes = {};
    for (const name of ['W0', 'W1']) {
        const binding = prepared.modes[name];
        const validation = validateRasterBoneSkinning([prepared.mesh],
            [binding], prepared.asset.internalLayers, prepared.asset.rigDefinition);
        assert.equal(validation.ok, true, `${fixture.id}/${name}: SkinBinding`);
        const analysis = analyzePoseAttribution(prepared, name);
        assert.equal(JSON.stringify(prepared.mesh), frozenMesh, 'Mesh frozen');
        assert.equal(JSON.stringify(prepared.topology.diagnostic.geometryRoles),
            frozenRoles, 'Junction roles frozen');
        assert.equal(JSON.stringify(prepared.modes[name]), frozenWeights[name],
            `${fixture.id}/${name}: Weight source frozen`);
        assert.equal(analysis.topology.ownershipUnchanged, true);
        assert.equal(analysis.topology.vertices, prepared.mesh.vertices.length);
        assert.equal(analysis.topology.triangles, prepared.mesh.triangles.length);
        const roleTotal = Object.values(analysis.triangleRoleCounts)
            .reduce((sum, n) => sum + n, 0);
        assert.equal(roleTotal, prepared.mesh.triangles.length);
        for (const row of analysis.canonical) {
            assert.equal(row.raster.visibleInversion,
                row.visibleInverted.length + row.mixedInverted.length,
                `${fixture.id}/${name}/${row.kind}${row.magnitude}: runtime inversion parity`);
            assert.equal(row.raster.allInversion, row.inverted.length);
        }
        if (analysis.analytic) {
            assert.equal(analysis.analytic.linear, true,
                `${fixture.id}/${name}: translation linearity`);
            assert.ok(analysis.analytic.maxThresholdDifference <= 0.1,
                `${fixture.id}/${name}: analytic/runtime threshold parity`);
        }
        const baselineCoverage = bindCoverage(prepared.snapshot,
            prepared.product.meshDefinition);
        const retention = analysis.canonical.map(row => {
            const motion = row.kind === 'translation' ? { x: row.magnitude }
                : { rotation: degreesToRadians(row.magnitude) };
            const baseline = evaluateMode(fixture, prepared.snapshot, prepared.asset,
                prepared.product, motionClip(fixture.movingBoneId, motion),
                baselineCoverage, prepared.context.gridDiagonal);
            assert.equal(baseline.valid, true);
            return { kind: row.kind, magnitude: row.magnitude,
                retention: round(row.raster.targetDisplacement
                    / baseline.regions[fixture.movingBoneId].displacement) };
        });
        modes[name] = { ...analysis, retention };
    }
    assert.notDeepEqual(prepared.modes.W0, prepared.modes.W1,
        `${fixture.id}: Weight sources must differ`);
    const maximum = name => modes[name].canonical.find(row =>
        row.kind === 'translation' && row.magnitude === 60);
    const W0 = maximum('W0'), W1 = maximum('W1');
    const first = name => modes[name].threshold?.translation.first
        .filter(value => value !== null).sort((a, b) => a - b)[0] ?? null;
    const bad0 = new Set(W0.visibleInverted), bad1 = new Set(W1.visibleInverted);
    const sharedBad = [...bad0].filter(id => bad1.has(id));
    const sensitivity = name => Object.values(modes[name].packets || {})
        .flat().flatMap(packet => packet.sensitivity.map(row => ({
            triangle: packet.id, ...row })));
    const feasible = name => sensitivity(name).filter(row => row.feasible
        && Number.isFinite(row.requiredDelta));
    const roleInversions = name => {
        const packet = modes[name].canonical.find(row => row.kind === 'translation'
            && row.magnitude === 60);
        return Object.fromEntries(Object.entries(packet.byRole)
            .map(([role, data]) => [role, data.inverted]));
    };
    report.push({ fixture: fixture.id, mesh: { vertices: prepared.mesh.vertices.length,
        triangles: prepared.mesh.triangles.length,
        junctionCells: prepared.topology.diagnostic.junctions.map(j => j.finalCount),
        ownershipUnchanged: prepared.topology.diagnostic.ownershipUnchanged,
        coverage: [prepared.coverage.uncovered, prepared.coverage.multiple],
        sameTopology: true },
        comparison: { W0W1SharedVisibleFailures60: sharedBad,
            W0FirstTranslation: first('W0'), W1FirstTranslation: first('W1'),
            W0RoleInversions60: roleInversions('W0'),
            W1RoleInversions60: roleInversions('W1'),
            W0FeasibleLocalChanges: feasible('W0').sort((a, b) =>
                Math.abs(a.requiredDelta) - Math.abs(b.requiredDelta)).slice(0, 12),
            W1FeasibleLocalChanges: feasible('W1').sort((a, b) =>
                Math.abs(a.requiredDelta) - Math.abs(b.requiredDelta)).slice(0, 12) },
        modes });
}

for (const fixture of ['connected-humanoid', 'branched-skeleton']) {
    const item = report.find(row => row.fixture === fixture);
    const maximum = item.modes.W1.canonical.find(row =>
        row.kind === 'translation' && row.magnitude === 60);
    assert.ok(maximum.visibleInverted.length > 0);
    assert.ok(maximum.raster.targetAlpha < 0.6);
}
const branch = report.find(row => row.fixture === 'branched-skeleton');
const connected = report.find(row => row.fixture === 'connected-humanoid');
assert.equal(branch.mesh.vertices, 61);
assert.equal(branch.mesh.triangles, 80);
assert.equal(connected.mesh.vertices, 91);
assert.equal(connected.mesh.triangles, 132);
console.log('verify-rig-pose-failure-attribution: PASS (W0/W1 same Mesh; runtime authoritative)');
console.log(JSON.stringify({ fixtures: report }, null, 2));
