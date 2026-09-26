import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createAlphaFitRasterBoneSetup } from '../system/animation/raster-bone-auto-setup.js';
import { evaluateRasterBoneSkinning, RASTER_MESH_MAX_VERTICES } from '../system/animation/raster-bone-skinning.js';
import { deformRasterSnapshotWithSkin } from '../system/animation/raster-skin-render-plan.js';
import { alphaComponents, createDomainContext, createHybridDomainPatch, withFixedWeights }
    from './hybrid-domain-patch-diagnostic.mjs';
import { assertCanonicalRigGeometry, canonicalHumanoidBones, canonicalChainBones,
    canonicalBranchBones, degreesToRadians } from './verify-rig-canonical-geometry.mjs';

const SIZE = 200;
const COLORS = { arm: [255, 0, 0, 255], head: [0, 255, 0, 255],
    leg: [0, 0, 255, 255], torso: [0, 0, 0, 255] };
const humanoidRegions = [
    { id: 'arm', channel: 0 }, { id: 'head', channel: 1 }, { id: 'leg', channel: 2 }
];
// Same four geometry, Bone, region, and motion fixtures as the R-44 matrix.
export const fixtures = [
    { id: 'disconnected-islands', expectedAlphaComponents: 3, bones: canonicalHumanoidBones(),
        rectangles: [
            { x0: 0, y0: 92, x1: 40, y1: 108, color: 'arm' },
            { x0: 70, y0: 10, x1: 120, y1: 55, color: 'head' },
            { x0: 70, y0: 140, x1: 120, y1: 190, color: 'leg' }
        ], regions: humanoidRegions, movingBoneId: 'arm', rootBoneId: 'root' },
    { id: 'connected-humanoid', expectedAlphaComponents: 1, bones: canonicalHumanoidBones(),
        rectangles: [
            { x0: 35, y0: 50, x1: 81, y1: 151, color: 'torso' },
            { x0: 0, y0: 92, x1: 40, y1: 108, color: 'arm' },
            { x0: 70, y0: 10, x1: 120, y1: 55, color: 'head' },
            { x0: 70, y0: 140, x1: 120, y1: 190, color: 'leg' }
        ], regions: humanoidRegions, movingBoneId: 'arm', rootBoneId: 'root' },
    { id: 'simple-chain', expectedAlphaComponents: 1,
        bones: canonicalChainBones(),
        rectangles: [{ x0: 20, y0: 44, x1: 100, y1: 56, color: 'arm' },
            { x0: 100, y0: 44, x1: 180, y1: 56, color: 'head' }],
        regions: [{ id: 'upper', channel: 0 }, { id: 'lower', channel: 1 }],
        movingBoneId: 'lower', rootBoneId: 'root', joint: { x: 100, y: 50,
            parentBoneId: 'upper', childBoneId: 'lower' } },
    { id: 'branched-skeleton', expectedAlphaComponents: 1,
        bones: canonicalBranchBones(),
        rectangles: [
            { x0: 90, y0: 84, x1: 110, y1: 116, color: 'torso' },
            { x0: 20, y0: 92, x1: 101, y1: 108, color: 'torso' },
            { x0: 100, y0: 92, x1: 180, y1: 108, color: 'torso' },
            { x0: 92, y0: 20, x1: 108, y1: 100, color: 'torso' },
            { x0: 20, y0: 92, x1: 70, y1: 108, color: 'arm' },
            { x0: 130, y0: 92, x1: 180, y1: 108, color: 'head' },
            { x0: 92, y0: 20, x1: 108, y1: 70, color: 'leg' }
        ], regions: [{ id: 'left', channel: 0 }, { id: 'right', channel: 1 },
            { id: 'center', channel: 2 }], movingBoneId: 'left', rootBoneId: 'root' }
];

export function snapshotFor(fixture) {
    const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (const { x0, y0, x1, y1, color } of fixture.rectangles) {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            pixels.set(COLORS[color], (y * SIZE + x) * 4);
        }
    }
    return { id: fixture.id, updatedAt: 1, width: SIZE, height: SIZE,
        rasterBounds: { x: 0, y: 0, width: SIZE, height: SIZE }, pixels };
}

export function assetFor(fixture) {
    return { id: fixture.id, internalLayers: [{ id: 'art', type: 'raster', parentLayerId: null }],
        rigDefinition: { version: 1, parts: [], bones: fixture.bones } };
}

export function motionClip(boneId, motion) {
    return { startFrame: 0, duration: 2, rigMotion: { version: 1, partTracks: [],
        boneTracks: [{ boneId, keyframes: [{ frame: 0, interpolation: 'hold',
            x: motion.x || 0, y: 0, scaleX: 1, scaleY: 1, rotation: motion.rotation || 0 }] }] } };
}

function signedArea2(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function inside(px, py, a, b, c) {
    const area = signedArea2(a, b, c);
    const s1 = signedArea2(a, b, { x: px, y: py });
    const s2 = signedArea2(b, c, { x: px, y: py });
    const s3 = signedArea2(c, a, { x: px, y: py });
    const contained = area > 0 ? s1 >= -1e-7 && s2 >= -1e-7 && s3 >= -1e-7
        : s1 <= 1e-7 && s2 <= 1e-7 && s3 <= 1e-7;
    if (!contained) return 0;
    return Math.min(Math.abs(s1), Math.abs(s2), Math.abs(s3)) <= 1e-7 ? 1 : 2;
}

// Pixel-center coverage for source alpha>0. Geometry boundary ambiguity is
// reported separately; it does not silently become a product alpha threshold.
export function bindCoverage(snapshot, mesh) {
    const interior = new Uint16Array(snapshot.width * snapshot.height);
    const boundary = new Uint16Array(snapshot.width * snapshot.height);
    const support = [];
    const byId = new Map(mesh.vertices.map(v => [v.vertexId, v]));
    for (const triangle of mesh.triangles) {
        const points = triangle.map(id => byId.get(id));
        const x0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))));
        const x1 = Math.min(snapshot.width, Math.ceil(Math.max(...points.map(p => p.x))));
        const y0 = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
        const y1 = Math.min(snapshot.height, Math.ceil(Math.max(...points.map(p => p.y))));
        let opaque = 0, transparent = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const inclusion = inside(x + 0.5, y + 0.5, ...points);
            if (!inclusion) continue;
            const index = y * snapshot.width + x;
            if (snapshot.pixels[index * 4 + 3] > 0) {
                if (inclusion === 2) interior[index]++; else boundary[index]++;
                opaque++;
            }
            else transparent++;
        }
        support.push(opaque && transparent ? 'mixed' : opaque ? 'visible-supporting' : 'transparent-only');
    }
    let alphaPixels = 0, covered = 0, uncovered = 0, multiple = 0;
    for (let i = 0; i < interior.length; i++) {
        if (snapshot.pixels[i * 4 + 3] === 0) continue;
        alphaPixels++;
        if (interior[i] || boundary[i]) covered++; else uncovered++;
        // A pixel center exactly on a shared edge/diagonal is covered once.
        if (interior[i] > 1 || (interior[i] > 0 && boundary[i] > 0)
            || boundary[i] > 2) multiple++;
    }
    return { alphaPixels, covered, uncovered, multiple,
        uncoveredRatio: uncovered / alphaPixels, multipleRatio: multiple / alphaPixels,
        support, supportCounts: { visible: support.filter(s => s === 'visible-supporting').length,
            mixed: support.filter(s => s === 'mixed').length,
            transparentOnly: support.filter(s => s === 'transparent-only').length } };
}

function imageRegion(image, channel) {
    if (!image) return null;
    let mass = 0, xMoment = 0, yMoment = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const index = (y * image.width + x) * 4;
        const alpha = image.pixels[index + 3] / 255;
        const marker = image.pixels[index + channel] / 255;
        const value = alpha * marker;
        mass += value;
        xMoment += (image.bounds.x + x + 0.5) * value;
        yMoment += (image.bounds.y + y + 0.5) * value;
    }
    return mass > 0 ? { x: xMoment / mass, y: yMoment / mass, mass } : null;
}

function junctionAlpha(image, point, radius) {
    const x0 = Math.floor(point.x - radius), x1 = Math.ceil(point.x + radius);
    const y0 = Math.floor(point.y - radius), y1 = Math.ceil(point.y + radius);
    let mass = 0, occupied = 0;
    const active = new Set();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const ix = x - image.bounds.x, iy = y - image.bounds.y;
        if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) continue;
        const alpha = image.pixels[(iy * image.width + ix) * 4 + 3] / 255;
        mass += alpha;
        if (alpha > 0) { occupied++; active.add(`${x},${y}`); }
    }
    let components = 0;
    while (active.size) {
        components++;
        const first = active.values().next().value;
        const queue = [first]; active.delete(first);
        for (let head = 0; head < queue.length; head++) {
            const [x, y] = queue[head].split(',').map(Number);
            for (const key of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]) {
                if (active.delete(key)) queue.push(key);
            }
        }
    }
    return { mass, occupied, components };
}

function rasterAlphaSummary(image) {
    const { width, height, pixels } = image;
    const visited = new Uint8Array(width * height);
    let components = 0, occupied = 0, mass = 0;
    for (let index = 0; index < visited.length; index++) {
        const alpha = pixels[index * 4 + 3] / 255;
        mass += alpha;
        if (alpha > 0) occupied++;
        if (visited[index] || alpha === 0) continue;
        components++;
        const queue = [index]; visited[index] = 1;
        for (let head = 0; head < queue.length; head++) {
            const pixel = queue[head], x = pixel % width, y = Math.floor(pixel / width);
            for (const next of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1,
                y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
                if (next < 0 || visited[next] || pixels[next * 4 + 3] === 0) continue;
                visited[next] = 1; queue.push(next);
            }
        }
    }
    return { components, occupied, mass };
}

function triangleQuality(bindMesh, posedMesh, support) {
    let allInverted = 0, visibleInverted = 0, minAreaRatio = Infinity,
        maxAspect = 0, degenerate = 0;
    for (let i = 0; i < bindMesh.triangleIndices.length; i++) {
        const triangle = bindMesh.triangleIndices[i];
        const before = triangle.map(index => bindMesh.vertices[index]);
        const after = triangle.map(index => posedMesh.vertices[index]);
        const bindArea = signedArea2(...before), posedArea = signedArea2(...after);
        const areaRatio = Math.abs(posedArea / bindArea);
        minAreaRatio = Math.min(minAreaRatio, areaRatio);
        const edges2 = [0, 1, 2].map(k => (before[k].x - before[(k + 1) % 3].x) ** 2
            + (before[k].y - before[(k + 1) % 3].y) ** 2);
        maxAspect = Math.max(maxAspect, Math.max(...edges2) / Math.abs(bindArea));
        if (areaRatio < 0.1) degenerate++;
        if (bindArea * posedArea < 0) {
            allInverted++;
            if (support[i] !== 'transparent-only') visibleInverted++;
        }
    }
    return { allInverted, visibleInverted, minAreaRatio, maxAspect, degenerate };
}

export function evaluateMode(fixture, snapshot, baseAsset, setup, clip, coverage, gridDiagonal) {
    const asset = { ...baseAsset, meshDefinitions: [setup.meshDefinition],
        skinBindings: [setup.skinBinding] };
    const bind = evaluateRasterBoneSkinning(asset, null, 0);
    const posed = evaluateRasterBoneSkinning(asset, clip, 0);
    if (!bind.ok || !posed.ok) return { valid: false, errors: [...bind.errors, ...posed.errors] };
    const bindMesh = bind.resultByMeshId.get(setup.meshDefinition.meshId);
    const posedMesh = posed.resultByMeshId.get(setup.meshDefinition.meshId);
    const bindImage = deformRasterSnapshotWithSkin(snapshot, bindMesh);
    const posedImage = deformRasterSnapshotWithSkin(snapshot, posedMesh);
    if (!bindImage || !posedImage) return { valid: false, errors: ['rasterizer-failed'] };
    const regions = Object.fromEntries(fixture.regions.map(region => {
        const before = imageRegion(bindImage, region.channel), after = imageRegion(posedImage, region.channel);
        return [region.id, before && after ? { dx: after.x - before.x, dy: after.y - before.y,
            displacement: Math.hypot(after.x - before.x, after.y - before.y),
            alphaAreaRatio: after.mass / before.mass } : null];
    }));
    const junction = fixture.joint || (fixture.id === 'branched-skeleton'
        ? { x: 100, y: 100 } : null);
    const junctionRadius = gridDiagonal * 0.3;
    const beforeJunction = junction ? junctionAlpha(bindImage, junction, junctionRadius) : null;
    const afterJunction = junction ? junctionAlpha(posedImage, junction, junctionRadius) : null;
    const bindRaster = rasterAlphaSummary(bindImage), posedRaster = rasterAlphaSummary(posedImage);
    const sums = setup.skinBinding.vertexWeights.map(row => row.influences.reduce((sum, i) => sum + i.weight, 0));
    return { valid: true, regions, quality: triangleQuality(bindMesh, posedMesh, coverage.support),
        finite: posedMesh.vertices.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)),
        maxInfluences: Math.max(...setup.skinBinding.vertexWeights.map(row => row.influences.length)),
        invalidWeightSums: sums.filter(sum => Math.abs(sum - 1) > 1e-9).length,
        bindImageSize: [bindImage.width, bindImage.height],
        alphaRaster: { bind: bindRaster, posed: posedRaster,
            alphaAreaRatio: posedRaster.mass / bindRaster.mass },
        junction: beforeJunction && afterJunction ? {
            radius: junctionRadius, bind: beforeJunction, posed: afterJunction,
            alphaAreaRatio: afterJunction.mass / beforeJunction.mass } : null };
}

export function topologyChurn(before, after, tolerance = 1.01) {
    const oldVertices = before.meshDefinition.vertices;
    const newVertices = after.meshDefinition.vertices;
    const pairs = [];
    for (let oldIndex = 0; oldIndex < oldVertices.length; oldIndex++) {
        for (let newIndex = 0; newIndex < newVertices.length; newIndex++) {
            const distance = Math.hypot(oldVertices[oldIndex].x - newVertices[newIndex].x,
                oldVertices[oldIndex].y - newVertices[newIndex].y);
            if (distance <= tolerance) pairs.push({ oldIndex, newIndex, distance });
        }
    }
    pairs.sort((a, b) => a.distance - b.distance || a.oldIndex - b.oldIndex
        || a.newIndex - b.newIndex);
    const match = new Map(), used = new Set();
    for (const pair of pairs) {
        if (match.has(pair.oldIndex) || used.has(pair.newIndex)) continue;
        match.set(pair.oldIndex, pair.newIndex);
        used.add(pair.newIndex);
    }
    const topology = mesh => {
        const byId = new Map(mesh.vertices.map((vertex, index) => [vertex.vertexId, index]));
        const triangles = mesh.triangles.map(triangle => triangle.map(id => byId.get(id)));
        const edges = new Set();
        for (const [a, b, c] of triangles) {
            for (const [left, right] of [[a, b], [b, c], [c, a]]) {
                edges.add([left, right].sort((x, y) => x - y).join(':'));
            }
        }
        return { triangles, edges };
    };
    const oldTopology = topology(before.meshDefinition);
    const newTopology = topology(after.meshDefinition);
    let retainedEdges = 0, retainedTriangles = 0;
    for (const key of oldTopology.edges) {
        const [a, b] = key.split(':').map(Number);
        if (!match.has(a) || !match.has(b)) continue;
        if (newTopology.edges.has([match.get(a), match.get(b)].sort((x, y) => x - y).join(':'))) {
            retainedEdges++;
        }
    }
    const newTriangleKeys = new Set(newTopology.triangles.map(triangle =>
        [...triangle].sort((a, b) => a - b).join(':')));
    for (const triangle of oldTopology.triangles) {
        if (triangle.some(index => !match.has(index))) continue;
        const key = triangle.map(index => match.get(index)).sort((a, b) => a - b).join(':');
        if (newTriangleKeys.has(key)) retainedTriangles++;
    }
    return {
        matchTolerancePx: tolerance,
        retainedVertices: match.size,
        addedVertices: newVertices.length - match.size,
        removedVertices: oldVertices.length - match.size,
        retainedEdges,
        removedEdges: oldTopology.edges.size - retainedEdges,
        addedEdges: newTopology.edges.size - retainedEdges,
        retainedTriangles,
        removedTriangles: oldTopology.triangles.length - retainedTriangles,
        addedTriangles: newTopology.triangles.length - retainedTriangles
    };
}

function changedOwnershipPixels(before, after, snapshot) {
    const rasterize = result => {
        const domains = new Array(snapshot.width * snapshot.height).fill(null);
        const components = new Int32Array(domains.length).fill(-1);
        for (const cell of result.diagnostic.cells) {
            const { x0, y0, x1, y1 } = cell.bounds;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const index = y * snapshot.width + x;
                domains[index] = cell.domain;
                components[index] = cell.component;
            }
        }
        return { domains, components };
    };
    const old = rasterize(before), next = rasterize(after);
    let domainPixels = 0, componentPixels = 0;
    for (let index = 0; index < old.domains.length; index++) {
        if (snapshot.pixels[index * 4 + 3] === 0) continue;
        if (old.domains[index] !== next.domains[index]) domainPixels++;
        if (old.components[index] !== next.components[index]) componentPixels++;
    }
    return { changedDomainPixels: domainPixels, changedComponentPixels: componentPixels };
}

function perturbation(fixture, snapshot, baseSetup, nominal) {
    if (!nominal.ok) return { state: 'UNKNOWN', reason: nominal.reason };
    const signature = result => JSON.stringify({ mesh: result.meshDefinition,
        binding: result.skinBinding,
        cells: result.diagnostic.cells.map(cell => [cell.xi, cell.yi, cell.component, cell.domain]) });
    const baseline = signature(nominal);
    for (let repeat = 0; repeat < 20; repeat++) {
        const context = createDomainContext(assetFor(fixture), baseSetup);
        const next = createHybridDomainPatch(assetFor(fixture), snapshot, baseSetup, context);
        assert.equal(signature(next), baseline,
            `${fixture.id} deterministic generation #${repeat + 1}`);
    }
    const changes = [];
    for (const axis of ['x', 'rotation']) for (const amount of [0.25, 0.5, 1]) {
        const bones = fixture.bones.map(b => ({ ...b, bindTransform: { ...b.bindTransform } }));
        bones.find(b => b.boneId === fixture.movingBoneId).bindTransform[axis]
            += axis === 'rotation' ? amount * Math.PI / 180 : amount;
        const asset = { ...assetFor(fixture), rigDefinition: { ...assetFor(fixture).rigDefinition, bones } };
        const context = createDomainContext(asset, baseSetup);
        const next = createHybridDomainPatch(asset, snapshot, baseSetup, context);
        const ownership = next.ok ? changedOwnershipPixels(nominal, next, snapshot) : null;
        const churn = next.ok ? topologyChurn(nominal, next) : null;
        changes.push({ axis, amount, ok: next.ok, reason: next.reason || null,
            vertexCount: next.meshDefinition?.vertices.length || next.vertexCount || 0,
            triangleOrderingSame: next.ok && JSON.stringify(next.meshDefinition.triangles)
                === JSON.stringify(nominal.meshDefinition.triangles),
            vertexOrderingSame: next.ok && JSON.stringify(next.meshDefinition.vertices)
                === JSON.stringify(nominal.meshDefinition.vertices),
            ...ownership, ...churn });
    }
    return { state: 'CHECKED', deterministic20: true, changes };
}

export function runHybridDiagnostic() {
const report = [];
for (const fixture of fixtures) {
    assertCanonicalRigGeometry(fixture.id, fixture.bones, fixture.rectangles);
    const snapshot = snapshotFor(fixture);
    const alpha = alphaComponents(snapshot);
    assert.equal(alpha.components.length, fixture.expectedAlphaComponents);
    const asset = assetFor(fixture);
    let nextId = 0;
    const product = createAlphaFitRasterBoneSetup(asset, 'art', snapshot,
        { idFactory: kind => `${fixture.id}-${kind}-${nextId++}` });
    assert.equal(product.ok, true);
    const context = createDomainContext(asset, product);
    assert.equal(context.ok, true);
    const rectangular = { meshDefinition: product.meshDefinition,
        skinBinding: withFixedWeights(product.meshDefinition, context) };
    const hybrid = createHybridDomainPatch(asset, snapshot, product, context);
    const series = fixture.id === 'simple-chain'
        ? [5, 15, 30, 45].map(rotationDegrees => ({ x: 0,
            rotation: degreesToRadians(rotationDegrees), rotationDegrees }))
        : [5, 15, 30, 60].map(x => ({ x, rotation: 0 }));
    const modes = { production: product, rectangular };
    if (hybrid.ok) modes.hybrid = hybrid;
    const modeReports = {};
    for (const [name, setup] of Object.entries(modes)) {
        const coverage = bindCoverage(snapshot, setup.meshDefinition);
        const motionResults = series.map(motion => ({ motion,
            ...evaluateMode(fixture, snapshot, asset, setup,
                motionClip(fixture.movingBoneId, motion), coverage, context.gridDiagonal) }));
        const root = evaluateMode(fixture, snapshot, asset, setup,
            motionClip(fixture.rootBoneId, { x: 20 }), coverage, context.gridDiagonal);
        assert.equal(root.valid, true, `${fixture.id}/${name} root Bone Motion evaluates`);
        for (const [regionId, region] of Object.entries(root.regions)) {
            assert.ok(region && Math.abs(region.dx - 20) <= 0.1
                && Math.abs(region.dy) <= 0.1
                && Math.abs(region.alphaAreaRatio - 1) <= 0.01,
            `${fixture.id}/${name}/${regionId} follows Root Bone Motion`);
        }
        modeReports[name] = { vertices: setup.meshDefinition.vertices.length,
            triangles: setup.meshDefinition.triangles.length,
            coverage: { ...coverage, support: undefined }, series: motionResults,
            rootRegions: root.regions };
    }
    const micro = perturbation(fixture, snapshot, product, hybrid);
    const main = modeReports.hybrid?.series.at(-1);
    const baseline = modeReports.production.series.at(-1);
    const target = fixture.movingBoneId;
    const retention = main && baseline ? main.regions[target]?.displacement
        / baseline.regions[target]?.displacement : null;
    const unrelated = fixture.regions.filter(r => r.id !== target).map(r => ({ id: r.id,
        production: baseline?.regions[r.id]?.displacement,
        rectangular: modeReports.rectangular.series.at(-1)?.regions[r.id]?.displacement,
        hybrid: main?.regions[r.id]?.displacement }));
    const issues = [];
    if (!hybrid.ok) issues.push(hybrid.reason);
    if (hybrid.ok) {
        if (hybrid.diagnostic.siblingEdges.length) issues.push('direct-sibling-domain-edge');
        if (modeReports.hybrid.coverage.uncovered > 0) issues.push('bind-coverage-hole');
        if (modeReports.hybrid.coverage.multiple > 0) issues.push('bind-multiple-coverage');
        if (retention < 0.85) issues.push('target-retention-under-85-percent');
        if ((main?.quality.visibleInverted || 0) > (baseline?.quality.visibleInverted || 0)) {
            issues.push('visible-inversion-regression');
        }
        if (fixture.id === 'disconnected-islands' || fixture.id === 'connected-humanoid') {
            for (const row of unrelated) {
                if (row.production > 0.1 && row.hybrid > 0.2 * row.production) {
                    issues.push(`unrelated-motion-${row.id}`);
                }
            }
        }
        if (main?.junction && (main.junction.posed.components > main.junction.bind.components
            || main.junction.alphaAreaRatio < 0.85)) issues.push('joint-or-branch-junction-continuity');
        if (Object.values(modeReports.hybrid.rootRegions || {}).some(region =>
            !region || Math.abs(region.dx - 20) > 0.1 || Math.abs(region.dy) > 0.1)) {
            issues.push('root-follow');
        }
        if (!main?.valid || !main?.finite || main?.invalidWeightSums || main?.maxInfluences > 4) {
            issues.push('runtime-or-weight-invalid');
        }
        if (micro.changes.some(row => !row.ok || !row.triangleOrderingSame)) {
            issues.push('micro-topology-churn');
        }
    }
    report.push({ fixture: fixture.id, alphaComponents: alpha.components.length,
        componentPixels: alpha.components.map(c => c.pixels),
        bindSegments: context.segments.map(s => ({ boneId: s.boneId,
            start: s.start, end: s.end })),
        gridDiagonal: context.gridDiagonal, hybridGeneration: hybrid.ok ? 'ok' : hybrid.reason,
        hybridSiblingEdges: hybrid.diagnostic?.siblingEdges.length ?? null,
        hybridDomainCounts: hybrid.diagnostic ? Object.fromEntries(
            [...new Set(hybrid.diagnostic.cells.map(c => c.domain))].map(id =>
                [id, hybrid.diagnostic.cells.filter(c => c.domain === id).length])) : null,
        transitionBand: hybrid.diagnostic?.transitionBand || null,
        modes: modeReports, retention, unrelated, micro, issues });
}

// One optional capacity stress case: 81 separated opaque patches require at
// least 324 distinct corner vertices, so failure must be explicit.
const stressFixture = { id: 'capacity-stress', bones: canonicalHumanoidBones(), rectangles: [],
    movingBoneId: 'arm' };
for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
    stressFixture.rectangles.push({ x0: col * 20, y0: row * 20,
        x1: col * 20 + 4, y1: row * 20 + 4, color: 'arm' });
}
const stressSnapshot = snapshotFor(stressFixture);
const stressAsset = assetFor(stressFixture);
const stressRect = createAlphaFitRasterBoneSetup(stressAsset, 'art', stressSnapshot);
assert.equal(stressRect.ok, true);
const stressContext = createDomainContext(stressAsset, stressRect);
const stress = createHybridDomainPatch(stressAsset, stressSnapshot, stressRect, stressContext);
assert.equal(stress.ok, false);
assert.equal(stress.reason, 'vertex-limit');

const viable = report.every(row => row.issues.length === 0);
console.log('verify-rig-hybrid-domain-patch: PASS (diagnostic executed; viability is separate)');
console.log(JSON.stringify({ viability: viable ? 'HYBRID VIABLE FOR PRODUCTION PROTOTYPE'
    : 'HYBRID NOT YET VIABLE', threshold: { alpha: 0, connectivity: 4,
        coverage: 'source pixel center, alpha > 0, inclusive barycentric edges',
        motionRetentionWarning: 0.85 }, weight: 'R-44 D-gated-joint, tree-root fallback',
    vertexLimit: RASTER_MESH_MAX_VERTICES,
    stress: { alphaComponents: 81, result: stress.reason, vertexCount: stress.vertexCount },
    fixtures: report }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runHybridDiagnostic();
}
