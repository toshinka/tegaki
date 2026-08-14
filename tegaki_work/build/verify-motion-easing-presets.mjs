import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    applyMotionEasingPresetToKeyframes,
    identifyMotionEasingPreset,
    MOTION_EASING_PRESET_GROUPS,
    resolveMotionEasingPreset
} from '../system/animation/motion-easing-presets.js';
import {
    CUBIC_BEZIER_OVERSHOOT_Y_MAX,
    CUBIC_BEZIER_OVERSHOOT_Y_MIN
} from '../system/animation/cubic-bezier-easing.js';

const groupLabels = MOTION_EASING_PRESET_GROUPS.map(group => group.label);
assert.deepEqual(groupLabels, ['SOFT EASE', 'STRONG EASE', 'SINE', 'CIRCULAR', 'BACK']);
assert.equal(MOTION_EASING_PRESET_GROUPS.flatMap(group => group.entries).length, 15);

for (const group of MOTION_EASING_PRESET_GROUPS) {
    for (const entry of group.entries) {
        const resolved = resolveMotionEasingPreset(entry.value);
        assert.equal(resolved.interpolation, 'linear');
        assert.equal(identifyMotionEasingPreset(resolved), entry.value);
        for (const coordinate of ['x1', 'x2']) {
            assert.ok(resolved.easing[coordinate] >= 0 && resolved.easing[coordinate] <= 1);
        }
        for (const coordinate of ['y1', 'y2']) {
            assert.ok(resolved.easing[coordinate] >= CUBIC_BEZIER_OVERSHOOT_Y_MIN);
            assert.ok(resolved.easing[coordinate] <= CUBIC_BEZIER_OVERSHOOT_Y_MAX);
            if (group.label !== 'BACK') {
                assert.ok(resolved.easing[coordinate] >= 0 && resolved.easing[coordinate] <= 1);
            }
        }
    }
}

assert.deepEqual(resolveMotionEasingPreset('back-in').easing,
    { type: 'cubic-bezier', x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 });
assert.deepEqual(resolveMotionEasingPreset('back-out').easing,
    { type: 'cubic-bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 });
assert.deepEqual(resolveMotionEasingPreset('back-in-out').easing,
    { type: 'cubic-bezier', x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 });

const source = [
    { frame: 0, x: 0, interpolation: 'hold', note: 'keep' },
    { frame: 4, x: 40, interpolation: 'linear' },
    { frame: 9, x: 90, interpolation: 'linear' }
];
const applied = applyMotionEasingPresetToKeyframes({
    keyframes: source,
    frames: [0, 4, 4],
    preset: 'sine-in-out',
    duration: 10
});
assert.equal(applied.ok, true);
assert.equal(applied.changed, true);
assert.deepEqual(applied.frames, [0, 4]);
assert.equal(identifyMotionEasingPreset(applied.keyframes[0]), 'sine-in-out');
assert.equal(identifyMotionEasingPreset(applied.keyframes[1]), 'sine-in-out');
assert.equal(applied.keyframes[0].note, 'keep');
assert.equal(applied.keyframes[2], source[2], 'untargeted terminal key keeps its identity');
assert.equal(source[0].interpolation, 'hold', 'source keyframes are not mutated');

const linear = applyMotionEasingPresetToKeyframes({
    keyframes: applied.keyframes,
    frames: [4],
    preset: 'linear',
    duration: 10
});
assert.equal(linear.ok, true);
assert.equal(identifyMotionEasingPreset(linear.keyframes[1]), 'linear');
assert.equal('easing' in linear.keyframes[1], false, 'linear removes stale cubic data');

const holdWithStaleCurve = applyMotionEasingPresetToKeyframes({
    keyframes: [{ frame: 0, interpolation: 'hold', easing: resolveMotionEasingPreset('ease-in').easing }],
    frames: [0],
    preset: 'hold',
    duration: 2
});
assert.equal(holdWithStaleCurve.ok, true);
assert.equal(holdWithStaleCurve.changed, true);
assert.equal('easing' in holdWithStaleCurve.keyframes[0], false, 'hold removes stale cubic data');

for (const rejected of [
    { frames: [9], preset: 'ease-in', reason: 'terminal-key' },
    { frames: [0, 9], preset: 'ease-out', reason: 'terminal-key' },
    { frames: [3], preset: 'ease-in-out', reason: 'key-not-found' },
    { frames: [0], preset: 'custom', reason: 'invalid-preset' }
]) {
    const result = applyMotionEasingPresetToKeyframes({
        keyframes: source,
        duration: 10,
        ...rejected
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, rejected.reason);
    assert.equal(result.keyframes, source, 'rejection is atomic and returns the original array');
}

const ui = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
assert.match(ui, /MOTION_EASING_PRESET_GROUPS\.map/);
assert.match(ui, /_applySelectedMotionEasingPreset\(preset\)/);
assert.match(ui, /filter\(key => key\.kind === 'motion'\)/);
assert.match(ui, /currentIsSelected[\s\S]*?selected\.map\(key => key\.frame\)[\s\S]*?\[state\.localFrame\]/);
assert.match(ui, /source: 'animation-motion-easing-preset'/);
assert.match(ui, /if \(e\.target\.closest\('#anim-motion-interpolation'\)\)/);

console.log('verify-motion-easing-presets: catalog, atomic multi-key apply, terminal rejection, and UI wiring OK');
