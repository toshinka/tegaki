import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { areMotionTransformsEquivalent } from '../system/animation/motion-gesture-state.js';

const root = path.resolve(process.cwd());
const source = fs.readFileSync(path.join(root, 'ui/animation-table-popup.js'), 'utf8');
const base = {
    x: 10,
    y: 20,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    blendMode: 'normal',
    blendStrength: 1,
    rotation: 0
};

assert.equal(areMotionTransformsEquivalent(base, { ...base }), true);
assert.equal(areMotionTransformsEquivalent(base, { ...base, x: 10 + 1e-10 }), true);
assert.equal(areMotionTransformsEquivalent(base, { ...base, x: 11 }), false);
assert.equal(areMotionTransformsEquivalent(base, { ...base, blendMode: 'multiply' }), false);
assert.equal(areMotionTransformsEquivalent(null, base), false);

assert.match(source, /startClientX: event\.clientX,[\s\S]*moved: false,[\s\S]*mutated: false,[\s\S]*changed: false/);
assert.match(source, /gesture\.changed = !areMotionTransformsEquivalent\(/);
assert.match(source, /event\.type === 'pointercancel' \|\| event\.type === 'lostpointercapture'/);
assert.match(source, /else if \(this\._motionCanvasGesture\) \{[\s\S]*cancelled: true/);
assert.match(source, /const cancelled = event\.type === 'pointercancel';/);
assert.match(source, /if \(cancelled \|\| !finishedGesture\.changed\) \{[\s\S]*_restoreTimelineHistoryState/);
assert.match(source, /gesture\.changed = input\.value !== gesture\.startValue/);

console.log('verify-motion-gesture-history: no-move, actual-change, cancel rollback wiring OK');
