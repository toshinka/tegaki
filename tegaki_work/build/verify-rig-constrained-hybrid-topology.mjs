import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createAlphaFitRasterBoneSetup } from '../system/animation/raster-bone-auto-setup.js';
import { validateRasterBoneSkinning, RASTER_MESH_MAX_VERTICES }
    from '../system/animation/raster-bone-skinning.js';
import { createDomainContext, createHybridDomainPatch, withFixedWeights }
    from './hybrid-domain-patch-diagnostic.mjs';
import { createConstrainedHybridTopology } from './constrained-hybrid-topology-diagnostic.mjs';
import { assertCanonicalRigGeometry, degreesToRadians }
    from './verify-rig-canonical-geometry.mjs';
import { fixtures, snapshotFor, assetFor, motionClip, bindCoverage,
    evaluateMode, topologyChurn } from './verify-rig-hybrid-domain-patch.mjs';

const allReasons = new Set(['invalid-input', 'multiple-root-unsupported',
    'no-valid-domain-partition', 'impossible-joint-portal',
    'invalid-constrained-polygon', 'vertex-limit', 'triangle-quality-failure',
    'coverage-failure', 'stability-failure']);
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;

function signature(result) {
    if (!result.ok) return JSON.stringify(result);
    const d = result.diagnostic;
    return JSON.stringify({ mesh: result.meshDefinition, vertexKeys: d.vertexKeys,
        graph: d.graph, domains: d.cells.map(c => [c.component, c.domain]),
        portals: d.portals.map(p => [p.childId, p.cells]) });
}

function compactMotion(result) {
    return result?.valid ? { regions: result.regions, quality: result.quality,
        alphaRaster: result.alphaRaster, junction: result.junction,
        runtime: { finite: result.finite, maxInfluences: result.maxInfluences,
            invalidWeightSums: result.invalidWeightSums } }
        : { valid: false, errors: result?.errors || [] };
}

function seriesFor(fixture) {
    const translation = fixture.id === 'simple-chain' ? [] : [5, 15, 30, 60]
        .map(x => ({ type: 'translation', x, rotation: 0 }));
    const rotation = fixture.id === 'simple-chain' || fixture.id === 'branched-skeleton'
        ? [5, 15, 30, 45].map(degrees => ({ type: 'rotation', x: 0,
            rotation: degreesToRadians(degrees), degrees })) : [];
    return [...translation, ...rotation];
}

function classifyChange(before, after, snapshot) {
    const a = before.diagnostic, b = after.diagnostic;
    const altered = new Set();
    let domainPixels = 0, portalPixels = 0, rawNearestPixels = 0;
    for (let i = 0; i < a.pixelDomains.length; i++) {
        if (snapshot.pixels[i * 4 + 3] === 0) continue;
        if (a.pixelDomains[i] !== b.pixelDomains[i]) rawNearestPixels++;
    }
    for (let i = 0; i < a.cells.length; i++) {
        const old = a.cells[i], next = b.cells[i];
        assert.deepEqual(old.bounds, next.bounds);
        const domainChanged = old.domain !== next.domain;
        const portalChanged = JSON.stringify(old.portalIds) !== JSON.stringify(next.portalIds);
        if (domainChanged || portalChanged) {
            for (let y = old.bounds.y0; y < old.bounds.y1; y++)
                for (let x = old.bounds.x0; x < old.bounds.x1; x++) {
                    const index = y * snapshot.width + x;
                    if (snapshot.pixels[index * 4 + 3] === 0) continue;
                    if (domainChanged) domainPixels++;
                    if (portalChanged) portalPixels++;
                }
            altered.add(`${Math.floor(old.center.x / 24)},${Math.floor(old.center.y / 24)}`);
        }
    }
    return { rawNearestPixels, domainPixels, portalPixels,
        changedTiles: [...altered].sort() };
}

function geometrySignature(result) {
    const vertices = new Map(result.meshDefinition.vertices.map(v => [v.vertexId, `${v.x},${v.y}`]));
    const edges = new Set(), triangles = new Set();
    for (const triangle of result.meshDefinition.triangles) {
        const points = triangle.map(id => vertices.get(id));
        triangles.add([...points].sort().join('|'));
        for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
            edges.add([points[a], points[b]].sort().join('|'));
        }
    }
    return { vertices: new Set(vertices.values()), edges, triangles };
}

function outsideLocalChange(before, after, changedTiles) {
    const allowed = new Set();
    for (const tile of changedTiles) {
        const [x, y] = tile.split(',').map(Number);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            allowed.add(`${x + dx},${y + dy}`);
        }
    }
    const old = geometrySignature(before), next = geometrySignature(after);
    const forbidden = [];
    for (const kind of ['vertices', 'edges', 'triangles']) {
        for (const value of old[kind]) if (!next[kind].has(value)) {
            const tiles = value.split('|').map(point => point.split(',').map(Number))
                .map(([x, y]) => `${Math.floor(x / 24)},${Math.floor(y / 24)}`);
            if (tiles.every(tile => !allowed.has(tile))) forbidden.push({ kind, value, side: 'removed' });
        }
        for (const value of next[kind]) if (!old[kind].has(value)) {
            const tiles = value.split('|').map(point => point.split(',').map(Number))
                .map(([x, y]) => `${Math.floor(x / 24)},${Math.floor(y / 24)}`);
            if (tiles.every(tile => !allowed.has(tile))) forbidden.push({ kind, value, side: 'added' });
        }
    }
    return forbidden;
}

function microSeries(fixture, asset, snapshot, product, nominal) {
    if (!nominal.ok) return { state: 'UNKNOWN', reason: nominal.reason };
    const results = [];
    for (const axis of ['x', 'rotation']) for (const amount of [0.25, 0.5, 1]) {
        const bones = fixture.bones.map(b => ({ ...b, bindTransform: { ...b.bindTransform } }));
        bones.find(b => b.boneId === fixture.movingBoneId).bindTransform[axis]
            += axis === 'rotation' ? degreesToRadians(amount) : amount;
        const changedAsset = { ...asset, rigDefinition: { ...asset.rigDefinition, bones } };
        const context = createDomainContext(changedAsset, product);
        const next = createConstrainedHybridTopology(changedAsset, snapshot, product, context);
        if (!next.ok) {
            results.push({ axis, amount, state: 'FAILED', reason: next.reason,
                detail: next.detail });
            continue;
        }
        const changed = classifyChange(nominal, next, snapshot);
        const churn = topologyChurn(nominal, next, 0);
        const sameGeometry = JSON.stringify(nominal.meshDefinition)
            === JSON.stringify(next.meshDefinition);
        const levelA = changed.domainPixels === 0 && changed.portalPixels === 0
            ? sameGeometry : null;
        const outside = outsideLocalChange(nominal, next, changed.changedTiles);
        results.push({ axis, amount, state: 'CHECKED', ...changed,
            ...churn, levelA, levelB: outside.length === 0,
            changesOutsideAllowed: outside.slice(0, 3) });
    }
    return { state: 'CHECKED', results };
}

const report = [];
for (const fixture of fixtures) {
    const geometry = assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const snapshot = snapshotFor(fixture), asset = assetFor(fixture);
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot);
    assert.equal(product.ok, true);
    const context = createDomainContext(asset, product);
    assert.equal(context.ok, true);
    const rectangular = { meshDefinition: product.meshDefinition,
        skinBinding: withFixedWeights(product.meshDefinition, context) };
    const hybrid = createHybridDomainPatch(asset, snapshot, product, context);
    const constrained = createConstrainedHybridTopology(asset, snapshot, product, context);
    if (!constrained.ok) assert.ok(allReasons.has(constrained.reason));
    const repeatSignatures = [], timings = [], elapsed = [];
    for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const generated = createConstrainedHybridTopology(asset, snapshot, product, context);
        elapsed.push(performance.now() - start);
        repeatSignatures.push(signature(generated));
        if (generated.ok) timings.push(generated.diagnostic.timingMs);
    }
    assert.ok(repeatSignatures.every(value => value === signature(constrained)),
        `${fixture.id}: 20-generation deterministic signature`);
    const modes = { production: product, rectangular };
    if (hybrid.ok) modes.hybrid = hybrid;
    if (constrained.ok) modes.constrained = constrained;
    const modeResults = {};
    for (const [name, setup] of Object.entries(modes)) {
        const coverage = bindCoverage(snapshot, setup.meshDefinition);
        const motions = seriesFor(fixture).map(motion => ({ motion,
            result: compactMotion(evaluateMode(fixture, snapshot, asset, setup,
                motionClip(fixture.movingBoneId, motion), coverage, context.gridDiagonal)) }));
        const root = compactMotion(evaluateMode(fixture, snapshot, asset, setup,
            motionClip(fixture.rootBoneId, { x: 20 }), coverage, context.gridDiagonal));
        modeResults[name] = { vertices: setup.meshDefinition.vertices.length,
            triangles: setup.meshDefinition.triangles.length,
            coverage: { ...coverage, support: undefined }, motions, root };
    }
    const selected = modeResults.constrained?.motions.findLast(m =>
        fixture.id === 'simple-chain' ? m.motion.type === 'rotation'
            : m.motion.type === 'translation')?.result;
    const productionSelected = modeResults.production.motions.findLast(m =>
        fixture.id === 'simple-chain' ? m.motion.type === 'rotation'
            : m.motion.type === 'translation')?.result;
    const target = fixture.movingBoneId;
    const retention = selected && productionSelected
        ? selected.regions[target]?.displacement / productionSelected.regions[target]?.displacement
        : null;
    const validation = constrained.ok ? validateRasterBoneSkinning(
        [constrained.meshDefinition], [constrained.skinBinding],
        asset.internalLayers, asset.rigDefinition) : null;
    const micro = microSeries(fixture, asset, snapshot, product, constrained);
    if (constrained.ok) {
        assert.ok(constrained.meshDefinition.vertices.length <= RASTER_MESH_MAX_VERTICES);
        assert.equal(validation.ok, true, `${fixture.id}: generic Mesh/Skin validation`);
        assert.equal(modeResults.constrained.coverage.uncovered, 0,
            `${fixture.id}: alpha pixel coverage`);
        assert.equal(modeResults.constrained.coverage.multiple, 0,
            `${fixture.id}: effective duplicate coverage`);
        assert.ok(constrained.diagnostic.quality.maxAspect <= 30);
        assert.equal(constrained.diagnostic.faceOwners.length,
            constrained.meshDefinition.triangles.length);
        assert.ok(constrained.diagnostic.graph.every(edge =>
            !edge.permission.startsWith('DISALLOWED')),
        `${fixture.id}: forbidden graph contact`);
        for (const region of Object.values(modeResults.constrained.root.regions)) {
            assert.ok(region && Math.abs(region.dx - 20) <= 0.1
                && Math.abs(region.dy) <= 0.1
                && Math.abs(region.alphaAreaRatio - 1) <= 0.01,
            `${fixture.id}: Root Motion follows all visible regions`);
        }
        assert.ok(micro.results.every(row => row.state === 'CHECKED'
            && row.levelA !== false && row.levelB),
        `${fixture.id}: Level A/B micro stability`);
    }
    report.push({ fixture: fixture.id, canonicalBones: geometry.geometry.length,
        alphaComponents: constrained.ok ? constrained.diagnostic.alpha.components.length
            : hybrid.diagnostic?.alpha.components.length,
        constrained: constrained.ok ? { ok: true,
            cells: constrained.diagnostic.cells.length,
            domains: Object.fromEntries([...new Set(constrained.diagnostic.cells.map(c => c.domain))]
                .map(domain => [domain, constrained.diagnostic.cells.filter(c => c.domain === domain).length])),
            portals: constrained.diagnostic.portals.map(p => ({ child: p.childId,
                radius: p.r, snappedCells: p.cells.length })),
            routes: constrained.diagnostic.routes.map(r => ({ child: r.childId,
                length: r.length, limit: r.limit, cells: r.cells.length,
                disconnectedComponent: r.disconnectedComponent || false })),
            graphEdges: constrained.diagnostic.graph.length,
            boundaries: constrained.diagnostic.boundaryKinds,
            quality: constrained.diagnostic.quality,
            validation: { ok: validation.ok, errors: validation.errors },
            timingMedianMs: Object.fromEntries(['alphaDomain', 'graph', 'triangulation', 'total']
                .map(stage => [stage, round(median(timings.map(t => t[stage])))])) }
            : { ok: false, reason: constrained.reason, detail: constrained.detail,
                totalMedianMs: round(median(elapsed)) },
        modes: modeResults, retention, micro, deterministic20: true });
}

// One capacity case. Every island needs four distinct corners.
const stress = { ...fixtures[0], id: 'capacity-stress', rectangles: [] };
for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
    stress.rectangles.push({ x0: col * 20, y0: row * 20,
        x1: col * 20 + 4, y1: row * 20 + 4, color: 'arm' });
}
const stressAsset = assetFor(stress), stressSnapshot = snapshotFor(stress);
const stressProduct = createAlphaFitRasterBoneSetup(stressAsset, 'art', stressSnapshot);
const stressContext = createDomainContext(stressAsset, stressProduct);
const stressResult = createConstrainedHybridTopology(stressAsset, stressSnapshot,
    stressProduct, stressContext);
assert.equal(stressResult.ok, false);
assert.equal(stressResult.reason, 'vertex-limit');

// Performance probe with the same four-Bone branch artwork in a 512² raster.
const branch = fixtures.find(f => f.id === 'branched-skeleton');
const branchSource = snapshotFor(branch);
const largePixels = new Uint8ClampedArray(512 * 512 * 4);
for (let y = 0; y < branchSource.height; y++) {
    largePixels.set(branchSource.pixels.subarray(y * branchSource.width * 4,
        (y + 1) * branchSource.width * 4), y * 512 * 4);
}
const largeSnapshot = { ...branchSource, width: 512, height: 512,
    rasterBounds: { x: 0, y: 0, width: 512, height: 512 }, pixels: largePixels };
const largeAsset = assetFor(branch);
const largeProduct = createAlphaFitRasterBoneSetup(largeAsset, 'art', largeSnapshot);
const largeContext = createDomainContext(largeAsset, largeProduct);
const largeTimings = [];
for (let i = 0; i < 20; i++) {
    const generated = createConstrainedHybridTopology(largeAsset, largeSnapshot,
        largeProduct, largeContext);
    assert.equal(generated.ok, true, '512² performance fixture remains generatable');
    largeTimings.push(generated.diagnostic.timingMs);
}
const performance512 = Object.fromEntries(['alphaDomain', 'graph', 'triangulation', 'total']
    .map(stage => [stage, round(median(largeTimings.map(t => t[stage])))]));

const connected = report.find(r => r.fixture === 'connected-humanoid');
const classification = !connected.constrained.ok
    && connected.constrained.reason === 'impossible-joint-portal'
    ? 'D. CONSTRAINED PARTITION CANNOT REPRESENT FIXTURES'
    : report.some(r => !r.constrained.ok) ? 'E. IMPLEMENTATION INCONCLUSIVE'
        : report.some(r => r.micro.results.some(m => m.levelA === false || m.levelB === false))
            ? 'C. STABILITY MODEL BLOCKED' : 'E. IMPLEMENTATION INCONCLUSIVE';
console.log('verify-rig-constrained-hybrid-topology: PASS (diagnostic executed; viability separate)');
console.log(JSON.stringify({ classification, performance512,
    stress: { reason: stressResult.reason, detail: stressResult.detail },
    fixtures: report }, null, 2));
