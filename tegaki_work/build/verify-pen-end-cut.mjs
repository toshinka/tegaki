import assert from 'node:assert/strict';
import { computeStrokeEndCuts } from '../system/drawing/pen-end-cut.js';

const line = (x0, y0, x1, y1, n = 20) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }));
const W = 10;

// 右向きの横線: 入りは始点より左を、抜きは終点より右を切る(どちらも垂直な線で)
let cuts = computeStrokeEndCuts(line(0, 50, 100, 50), W);
assert.equal(cuts.length, 2);
const [start, end] = cuts;
assert.equal(start.x + start.width, 0, 'start cut ends at the start point (removes x<0)');
assert.equal(end.x, 100, 'end cut starts at the end point (removes x>100)');
assert.ok(start.height >= W * 2 && end.height >= W * 2, 'wide enough to remove the round cap');
// 下向きの縦線: 入りは始点より上、抜きは終点より下を切る(水平な線で)
cuts = computeStrokeEndCuts(line(50, 0, 50, 100), W);
assert.equal(cuts[0].y + cuts[0].height, 0);
assert.equal(cuts[1].y, 100);
// 左向き・上向きも対称
cuts = computeStrokeEndCuts(line(100, 50, 0, 50), W);
assert.equal(cuts[0].x, 100, 'leftward: start removes x>100');
assert.equal(cuts[1].x + cuts[1].width, 0, 'leftward: end removes x<0');
// 斜め(横寄り)は垂直、(縦寄り)は水平の線で切る = 必ず軸に平行
cuts = computeStrokeEndCuts(line(0, 0, 100, 30), W);
assert.ok(cuts[1].height > cuts[1].width, 'mostly horizontal: vertical cut (tall rect)');
cuts = computeStrokeEndCuts(line(0, 0, 30, 100), W);
assert.ok(cuts[1].width > cuts[1].height, 'mostly vertical: horizontal cut (wide rect)');
// 短すぎる線・不正な入力は切らない
assert.deepEqual(computeStrokeEndCuts(line(0, 0, 5, 0), W), []);
assert.deepEqual(computeStrokeEndCuts([{ x: 0, y: 0 }], W), []);
assert.deepEqual(computeStrokeEndCuts(line(0, 0, 100, 0), 0), []);
assert.deepEqual(computeStrokeEndCuts(null, W), []);
console.log('pen end cut verifier: horizontal / vertical / diagonal axis choice / short strokes ok');
