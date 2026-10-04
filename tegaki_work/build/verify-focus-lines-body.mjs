import assert from 'node:assert/strict';
import {
    FOCUS_BODY_LIMITS,
    buildFocusLines,
    buildFocusLinesBody,
    defaultFocusLinesParams,
    innerRadiusAt,
    normalizeFocusLinesParams,
    sanitizeFocusLinesData
} from '../system/focus-lines.js';

const canvas = { width: 800, height: 600 };
const legacy = defaultFocusLinesParams(canvas);

// Legacy recipes keep the old shape and do not gain a body key.
const legacyNormalized = normalizeFocusLinesParams(legacy, canvas);
assert.equal(Object.prototype.hasOwnProperty.call(legacyNormalized, 'body'), false);
assert.deepEqual(buildFocusLines(legacyNormalized, canvas), buildFocusLines(legacy, canvas));
assert.equal(buildFocusLinesBody(legacy, canvas), null, 'missing body keeps the legacy path explicit');

const recipe = {
    ...legacy,
    count: 600,
    center: { x: 360, y: 240 },
    outer: 230,
    angleJitter: 1,
    lengthJitter: 1,
    seed: 17,
    body: { kind: 'ring', lineWidth: 999, fillColor: '#000000', inset: 0.8 }
};
const clean = normalizeFocusLinesParams(recipe, canvas);
assert.deepEqual(clean.body, { kind: 'ring', lineWidth: 60, fillColor: '#000000', inset: 0.8 });
assert.equal(clean.count, FOCUS_BODY_LIMITS.count.max);

const a = buildFocusLinesBody(clean, canvas);
const b = buildFocusLinesBody(JSON.parse(JSON.stringify(clean)), canvas);
assert.deepEqual(a, b, 'body geometry is deterministic');
assert.equal(a.kind, 'ring');
assert.equal(a.outer.length, 512, 'body has two vertices per spike and caps spikes at 256');
assert.equal(a.inner.length, a.outer.length, 'ring keeps the same topology');

const cx = clean.center.x, cy = clean.center.y;
let previousAngle = -Infinity;
for (let i = 0; i < a.outer.length; i += 1) {
    const point = a.outer[i];
    assert(Number.isFinite(point.x) && Number.isFinite(point.y), 'outer points are finite');
    let angle = Math.atan2(point.y - cy, point.x - cx);
    if (angle < 0) angle += Math.PI * 2;
    while (i > 0 && angle <= previousAngle) angle += Math.PI * 2;
    if (i > 0) assert(angle > previousAngle, 'outer points stay angularly ordered');
    previousAngle = angle;
    const inner = a.inner[i];
    const outerRadius = Math.hypot(point.x - cx, point.y - cy);
    const innerRadius = Math.hypot(inner.x - cx, inner.y - cy);
    assert(Math.abs(innerRadius / outerRadius - (1 - clean.body.inset)) < 1e-8, 'ring is uniformly scaled about center');
}

// At zero jitter, each sector is exactly valley then tip.  Valleys follow the
// configured inner ellipse and tips follow the finite outer ellipse with the
// same aspect ratio; this guards against a merely rounded/elliptical body.
const zeroParams = normalizeFocusLinesParams({
    ...legacy,
    center: { x: 300, y: 260 },
    innerRx: 70,
    innerRy: 105,
    count: 7,
    outer: 150,
    angleJitter: 0,
    lengthJitter: 0,
    body: { kind: 'outline', lineWidth: 2, fillColor: null, inset: 0.25 }
}, canvas);
const zero = buildFocusLinesBody(zeroParams, canvas);
assert.equal(zero.outer.length, zeroParams.count * 2, 'count is the spike count');
const outerRx = zeroParams.outer;
const outerRy = outerRx * (zeroParams.innerRy / zeroParams.innerRx);
for (let i = 0; i < zeroParams.count; i += 1) {
    const valley = zero.outer[i * 2];
    const tip = zero.outer[i * 2 + 1];
    const valleyAngle = Math.atan2(valley.y - zeroParams.center.y, valley.x - zeroParams.center.x);
    const tipAngle = Math.atan2(tip.y - zeroParams.center.y, tip.x - zeroParams.center.x);
    const valleyRadius = Math.hypot(valley.x - zeroParams.center.x, valley.y - zeroParams.center.y);
    const tipRadius = Math.hypot(tip.x - zeroParams.center.x, tip.y - zeroParams.center.y);
    assert(Math.abs(valleyRadius - innerRadiusAt(zeroParams.innerRx, zeroParams.innerRy, valleyAngle)) < 1e-7, 'zero-jitter valley follows inner ellipse');
    assert(Math.abs(tipRadius - innerRadiusAt(outerRx, outerRy, tipAngle)) < 1e-7, 'zero-jitter tip follows outer ellipse');
    assert(tipRadius > valleyRadius, 'each tip is outside its valley');
}

// Maximum jitter must retain strict angular ordering and a positive valley to
// tip radial gap for every spike.
for (let i = 0; i < a.outer.length / 2; i += 1) {
    const valley = a.outer[i * 2];
    const tip = a.outer[i * 2 + 1];
    assert(Math.hypot(tip.x - cx, tip.y - cy) > Math.hypot(valley.x - cx, valley.y - cy), 'jitter keeps valley below tip');
}

const outline = buildFocusLinesBody({ ...legacy, count: 3, outer: 120, body: { kind: 'outline', lineWidth: 0.5, fillColor: null, inset: 0.05 } }, canvas);
assert.equal(outline.inner, null);
assert.equal(outline.outer.length, 6);
assert.equal(sanitizeFocusLinesData({ params: { ...legacy, body: { kind: 'outline', lineWidth: 2, fillColor: null, inset: 0.2 } } }, canvas).params.body.fillColor, null);

console.log('focus-lines body verifier: optional outline/ring recipe / deterministic nested contour / legacy compatibility / cap256 ok');
