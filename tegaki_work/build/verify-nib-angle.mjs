import assert from 'node:assert/strict';
import { computeNibAngles, targetNibAngle, lerpNibAngle } from '../system/drawing/nib-angle.js';

const line = (x0, y0, x1, y1, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }));
const maxAbs = (a) => Math.max(...a.map(Math.abs));

assert.equal(targetNibAngle(0), 0);
assert.equal(targetNibAngle(90), 0);
assert.equal(targetNibAngle(180), 0);
assert.equal(targetNibAngle(5), 0, 'near-axis stays flat');
assert.ok(Math.abs(Math.abs(targetNibAngle(45)) - 45) < 1e-6, '45deg heading aligns the nib edge with the stroke');
assert.ok(Math.abs(targetNibAngle(30) - 30) < 8);

assert.ok(maxAbs(computeNibAngles(line(0, 0, 200, 0), 20)) < 1, 'horizontal stroke keeps 0deg');
assert.ok(maxAbs(computeNibAngles(line(0, 0, 0, 200), 20)) < 1, 'vertical stroke keeps 0deg');
const diag = computeNibAngles(line(0, 0, 200, 200), 20);
assert.ok(diag.every(a => Math.abs(Math.abs(a) - 45) < 2), 'diagonal stroke follows from the first point to the last');
const down = computeNibAngles(line(200, 0, 0, 200), 20);
assert.ok(down.every(a => Math.abs(Math.abs(a) - 45) < 2));
assert.ok(computeNibAngles([{ x: 0, y: 0 }, { x: 1, y: 1 }], 20).every(a => a === 0), 'tiny stroke stays fixed');
assert.equal(computeNibAngles([{ x: 0, y: 0 }], 20).length, 1);
// 横線→斜めに曲がっても角度は急変しない
const bend = computeNibAngles([...line(0, 0, 100, 0, 30), ...line(100, 0, 200, 100, 30).slice(1)], 20);
let maxStep = 0;
for (let i = 1; i < bend.length; i++) { let d = Math.abs(bend[i] - bend[i - 1]); d = Math.min(d, 90 - d); maxStep = Math.max(maxStep, d); }
assert.ok(maxStep < 12, 'angle changes gradually through a bend: ' + maxStep);
assert.ok(Math.abs(lerpNibAngle(44, -44, 0.5) - 45) < 1e-9, 'interpolates across the 90deg symmetry seam');
console.log('verify-nib-angle: ok');
