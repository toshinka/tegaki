import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    applyMotionEasingClipboardPayload,
    createMotionEasingClipboardPayload
} from '../system/animation/motion-easing-clipboard.js';

const custom = { type: 'cubic-bezier', x1: 0.2, y1: 0.4, x2: 0.7, y2: 0.9 };
const backOut = { type: 'cubic-bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 };
const payload = createMotionEasingClipboardPayload({ interpolation: 'linear', easing: custom, x: 99 });
assert.deepEqual(payload, {
    kind: 'tegaki-motion-easing',
    version: 1,
    interpolation: 'linear',
    easing: custom
});
assert.equal('x' in payload, false, 'Motion values never enter the easing clipboard');
assert.deepEqual(
    createMotionEasingClipboardPayload({ interpolation: 'linear', easing: backOut }).easing,
    backOut,
    'Back easing stays raw in the dedicated clipboard'
);

const source = [
    { frame: 0, x: 10, interpolation: 'hold' },
    { frame: 4, x: 40, interpolation: 'linear' },
    { frame: 9, x: 90, interpolation: 'linear' }
];
const applied = applyMotionEasingClipboardPayload({
    keyframes: source,
    frames: [0, 4, 4],
    payload,
    duration: 10
});
assert.equal(applied.ok, true);
assert.equal(applied.changed, true);
assert.deepEqual(applied.frames, [0, 4]);
assert.deepEqual(applied.keyframes[0].easing, custom);
assert.deepEqual(applied.keyframes[1].easing, custom);
assert.equal(applied.keyframes[0].x, 10, 'Motion values are preserved');
assert.equal(applied.keyframes[1].x, 40, 'Motion values are preserved for every target');
assert.equal(applied.keyframes[2], source[2], 'Untargeted terminal key keeps its identity');
assert.equal(source[0].interpolation, 'hold', 'Source keyframes are not mutated');

const holdPayload = createMotionEasingClipboardPayload({ interpolation: 'hold', easing: custom });
const held = applyMotionEasingClipboardPayload({
    keyframes: applied.keyframes,
    frames: [4],
    payload: holdPayload,
    duration: 10
});
assert.equal(held.ok, true);
assert.equal(held.keyframes[1].interpolation, 'hold');
assert.equal('easing' in held.keyframes[1], false, 'HOLD removes stale cubic data');

for (const rejected of [
    { frames: [9], payload, reason: 'terminal-key' },
    { frames: [0, 9], payload, reason: 'terminal-key' },
    { frames: [3], payload, reason: 'key-not-found' },
    { frames: [0], payload: { ...payload, kind: 'tegaki-motion-key' }, reason: 'invalid-clipboard' }
]) {
    const result = applyMotionEasingClipboardPayload({
        keyframes: source,
        duration: 10,
        ...rejected
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, rejected.reason);
    assert.equal(result.keyframes, source, 'Rejection is atomic');
}

const ui = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
assert.match(ui, /_motionEasingClipboard = null/);
assert.match(ui, /_copySelectedMotionEasing\(\)/);
assert.match(ui, /_pasteSelectedMotionEasing\(\)/);
assert.match(ui, /source: 'animation-motion-easing-clipboard'/);
assert.match(ui, /id="anim-motion-easing-copy-btn"/);
assert.match(ui, /id="anim-motion-easing-paste-btn"/);
assert.match(ui, /state\.editable \|\| canUseClipboard/);

console.log('verify-motion-easing-clipboard: tagged payload, value preservation, atomic multi-key apply, and UI wiring OK');
