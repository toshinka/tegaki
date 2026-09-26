import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRasterBoneBindSegments } from '../system/animation/raster-bone-auto-setup.js';

const UNIT = { scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
const EPS = 1e-8;

export const degreesToRadians = degrees => degrees * Math.PI / 180;

function rootBone(boneId, x, y) {
    return { boneId, parentBoneId: null, length: 0,
        bindTransform: { ...UNIT, x, y, rotation: 0 } };
}

// The caller supplies the intended local segment endpoints. The saved angle
// is derived in radians; parent rotations in these canonical fixtures are 0.
function childBone(boneId, parentBoneId, base, tip) {
    const dx = tip.x - base.x, dy = tip.y - base.y;
    return { boneId, parentBoneId, length: Math.hypot(dx, dy),
        bindTransform: { ...UNIT, x: base.x, y: base.y, rotation: Math.atan2(dy, dx) } };
}

export function canonicalHumanoidBones() {
    return [rootBone('root', 20, 100),
        childBone('arm', 'root', { x: 20, y: 0 }, { x: -20, y: 0 }),
        childBone('head', 'root', { x: 80, y: -40 }, { x: 80, y: -90 }),
        childBone('leg', 'root', { x: 80, y: 40 }, { x: 80, y: 90 })];
}

export function canonicalChainBones() {
    return [rootBone('root', 20, 50),
        childBone('upper', 'root', { x: 0, y: 0 }, { x: 80, y: 0 }),
        childBone('lower', 'upper', { x: 80, y: 0 }, { x: 160, y: 0 })];
}

export function canonicalBranchBones() {
    return [rootBone('root', 100, 100),
        childBone('left', 'root', { x: 0, y: 0 }, { x: -80, y: 0 }),
        childBone('right', 'root', { x: 0, y: 0 }, { x: 80, y: 0 }),
        childBone('center', 'root', { x: 0, y: 0 }, { x: 0, y: -80 })];
}

const HUMANOID = {
    root: [[20, 100], [20, 100]], arm: [[40, 100], [0, 100]],
    head: [[100, 60], [100, 10]], leg: [[100, 140], [100, 190]]
};
const CHAIN = {
    root: [[20, 50], [20, 50]], upper: [[20, 50], [100, 50]],
    lower: [[100, 50], [180, 50]]
};
const BRANCH = {
    root: [[100, 100], [100, 100]], left: [[100, 100], [20, 100]],
    right: [[100, 100], [180, 100]], center: [[100, 100], [100, 20]]
};
const EXPECTED = {
    'disconnected-islands': HUMANOID,
    'connected-humanoid': HUMANOID,
    'simple-chain': CHAIN,
    'branched-skeleton': BRANCH
};
const ARTWORK = {
    'disconnected-islands': {
        arm: [0, 92, 40, 108], head: [70, 10, 120, 55], leg: [70, 140, 120, 190]
    },
    'connected-humanoid': {
        arm: [0, 92, 40, 108], head: [70, 10, 120, 55], leg: [70, 140, 120, 190]
    },
    'simple-chain': {
        upper: [20, 44, 100, 56], lower: [100, 44, 180, 56]
    },
    'branched-skeleton': {
        left: [20, 92, 70, 108], right: [130, 92, 180, 108],
        center: [92, 20, 108, 70]
    }
};
const COLOR = {
    'disconnected-islands': { arm: 'arm', head: 'head', leg: 'leg' },
    'connected-humanoid': { arm: 'arm', head: 'head', leg: 'leg' },
    'simple-chain': { upper: 'arm', lower: 'head' },
    'branched-skeleton': { left: 'arm', right: 'head', center: 'leg' }
};

function near(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= EPS, `${label}: ${actual} != ${expected}`);
}

function crossesArtwork(start, end, bounds) {
    const [x0, y0, x1, y1] = bounds;
    for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
    }
    return false;
}

export function assertCanonicalRigGeometry(fixtureId, bones, rectangles) {
    const expected = EXPECTED[fixtureId];
    assert.ok(expected, `unknown canonical fixture: ${fixtureId}`);
    const asset = { id: fixtureId, internalLayers: [{ id: 'art', type: 'raster', parentLayerId: null }],
        rigDefinition: { version: 1, parts: [], bones } };
    const evaluated = createRasterBoneBindSegments(asset);
    assert.equal(evaluated.ok, true, `${fixtureId} bind geometry evaluates`);
    assert.deepEqual(evaluated.segments.map(s => s.boneId).sort(), Object.keys(expected).sort());
    const geometry = [];
    for (const segment of evaluated.segments) {
        const [base, tip] = expected[segment.boneId];
        near(segment.start.x, base[0], `${fixtureId}/${segment.boneId} base.x`);
        near(segment.start.y, base[1], `${fixtureId}/${segment.boneId} base.y`);
        near(segment.end.x, tip[0], `${fixtureId}/${segment.boneId} tip.x`);
        near(segment.end.y, tip[1], `${fixtureId}/${segment.boneId} tip.y`);
        const length = Math.hypot(segment.end.x - segment.start.x,
            segment.end.y - segment.start.y);
        const expectedLength = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
        near(length, expectedLength, `${fixtureId}/${segment.boneId} length`);
        if (length > EPS) {
            near((segment.end.x - segment.start.x) / length,
                (tip[0] - base[0]) / expectedLength, `${fixtureId}/${segment.boneId} direction.x`);
            near((segment.end.y - segment.start.y) / length,
                (tip[1] - base[1]) / expectedLength, `${fixtureId}/${segment.boneId} direction.y`);
        }
        const region = ARTWORK[fixtureId][segment.boneId];
        if (region) {
            const color = COLOR[fixtureId][segment.boneId];
            assert.ok(rectangles?.some(r => r.color === color
                && [r.x0, r.y0, r.x1, r.y1].every((value, i) => value === region[i])),
            `${fixtureId}/${segment.boneId} artwork region bounds`);
            assert.ok(crossesArtwork(segment.start, segment.end, region),
                `${fixtureId}/${segment.boneId} segment intersects its artwork`);
        }
        geometry.push({ boneId: segment.boneId,
            base: [segment.start.x, segment.start.y], tip: [segment.end.x, segment.end.y],
            length, direction: length > EPS ? [
                (segment.end.x - segment.start.x) / length,
                (segment.end.y - segment.start.y) / length] : null,
            segmentBounds: [Math.min(segment.start.x, segment.end.x),
                Math.min(segment.start.y, segment.end.y),
                Math.max(segment.start.x, segment.end.x),
                Math.max(segment.start.y, segment.end.y)],
            artworkBounds: region || null });
    }
    return { fixture: fixtureId, geometry };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const humanoid = canonicalHumanoidBones();
    const chain = canonicalChainBones();
    const branch = canonicalBranchBones();
    const rectangles = id => Object.entries(ARTWORK[id]).map(([boneId, b]) => ({
        color: COLOR[id][boneId], x0: b[0], y0: b[1], x1: b[2], y1: b[3]
    }));
    const results = [
        assertCanonicalRigGeometry('disconnected-islands', humanoid, rectangles('disconnected-islands')),
        assertCanonicalRigGeometry('connected-humanoid', humanoid, rectangles('connected-humanoid')),
        assertCanonicalRigGeometry('simple-chain', chain, rectangles('simple-chain')),
        assertCanonicalRigGeometry('branched-skeleton', branch, rectangles('branched-skeleton'))
    ];
    console.log('verify-rig-canonical-geometry: PASS');
    console.log(JSON.stringify(results, null, 2));
}
