import assert from 'node:assert/strict';

import {
    sampleEasingRatio,
    sampleRawEasingRatio,
    splitCubicBezierEasing
} from '../system/animation/cubic-bezier-easing.js';
import {
    MOTION_ANIMATED_PARAMETERS,
    sampleTransformTrack
} from '../system/animation/clip-transform-sampler.js';
import { planMotionGraphKeyInsertion } from '../system/animation/motion-graph-key-insert.js';
import {
    MOTION_EASING_PRESET_GROUPS,
    resolveMotionEasingPreset
} from '../system/animation/motion-easing-presets.js';

const EPSILON = 3e-6;
const TRACK_RELATIVE_EPSILON = 1e-5;
const INTEGER_FRAME_RELATIVE_EPSILON = 2e-6;
const baseTransform = Object.freeze({
    x: 4,
    y: -3,
    scaleX: 1,
    scaleY: -1,
    rotation: 0.25,
    opacity: 0.9,
    blendMode: 'normal',
    blendStrength: 0.75,
    anchorX: 0.4,
    anchorY: 0.6
});

function assertClose(actual, expected, message, epsilon = EPSILON) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`);
}

function assertTrackParity(beforeKeys, afterKeys, duration, label) {
    for (let frame = 0; frame <= duration - 1; frame += 0.125) {
        const before = sampleTransformTrack(baseTransform, beforeKeys, frame, duration);
        const after = sampleTransformTrack(baseTransform, afterKeys, frame, duration);
        MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
            const scale = Math.max(1, Math.abs(before[parameter]), Math.abs(after[parameter]));
            assertClose(
                after[parameter],
                before[parameter],
                `${label} frame ${frame} ${parameter}`,
                TRACK_RELATIVE_EPSILON * scale
            );
        });
        assert.equal(after.blendMode, before.blendMode, `${label} frame ${frame} blendMode`);
    }
    for (let frame = 0; frame < duration; frame++) {
        const before = sampleTransformTrack(baseTransform, beforeKeys, frame, duration);
        const after = sampleTransformTrack(baseTransform, afterKeys, frame, duration);
        MOTION_ANIMATED_PARAMETERS.forEach(parameter => {
            const scale = Math.max(1, Math.abs(before[parameter]), Math.abs(after[parameter]));
            assertClose(
                after[parameter],
                before[parameter],
                `${label} integer Frame ${frame} ${parameter}`,
                INTEGER_FRAME_RELATIVE_EPSILON * scale
            );
        });
        assert.equal(after.blendMode, before.blendMode, `${label} integer Frame ${frame} blendMode`);
    }
}

function assertNonActiveTrackParity(beforeKeys, afterKeys, duration, activeChannel, label) {
    for (let frame = 0; frame <= duration - 1; frame += 0.125) {
        const before = sampleTransformTrack(baseTransform, beforeKeys, frame, duration);
        const after = sampleTransformTrack(baseTransform, afterKeys, frame, duration);
        MOTION_ANIMATED_PARAMETERS
            .filter(parameter => parameter !== activeChannel)
            .forEach(parameter => {
                const scale = Math.max(1, Math.abs(before[parameter]), Math.abs(after[parameter]));
                assertClose(
                    after[parameter],
                    before[parameter],
                    `${label} frame ${frame} ${parameter}`,
                    TRACK_RELATIVE_EPSILON * scale
                );
            });
        assert.equal(after.blendMode, before.blendMode, `${label} frame ${frame} blendMode`);
    }
}

const legacyCurve = Object.freeze({
    type: 'cubic-bezier',
    x1: 0.42,
    y1: 0,
    x2: 0.58,
    y2: 1
});
const legacyExpected = Object.freeze([
    0.03111403690961987,
    0.1291619005687877,
    0.5,
    0.8708380994312122,
    0.9688859630903801
]);
[0.125, 0.25, 0.5, 0.75, 0.875].forEach((ratio, index) => {
    assertClose(sampleEasingRatio(ratio, legacyCurve), legacyExpected[index], `legacy ${ratio}`, 1e-15);
});

for (const splitRatio of [0.1, 0.4, 0.5, 0.8, 0.95]) {
    const split = splitCubicBezierEasing(splitRatio, legacyCurve);
    assert.equal(split.ok, true, `split ${splitRatio}`);
    for (let step = 0; step <= 100; step++) {
        const ratio = step / 100;
        const expected = sampleEasingRatio(ratio, legacyCurve);
        const actual = ratio <= splitRatio
            ? split.easedRatio * sampleEasingRatio(ratio / splitRatio, split.left)
            : split.easedRatio + (1 - split.easedRatio) * sampleEasingRatio(
                (ratio - splitRatio) / (1 - splitRatio),
                split.right
            );
        assertClose(actual, expected, `split ${splitRatio} ratio ${ratio}`);
    }
}

const rejectedPresetSplits = [];
let supportedPresetSplitCount = 0;
for (const group of MOTION_EASING_PRESET_GROUPS) {
    for (const preset of group.entries) {
        const easing = resolveMotionEasingPreset(preset.value).easing;
        for (const splitRatio of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) {
            const split = splitCubicBezierEasing(splitRatio, easing);
            if (!split.ok) {
                assert.equal(split.reason, 'split-control-out-of-range');
                rejectedPresetSplits.push(`${preset.value}:${splitRatio}`);
                continue;
            }
            supportedPresetSplitCount += 1;
            for (let step = 0; step <= 100; step++) {
                const ratio = step / 100;
                const expected = sampleRawEasingRatio(ratio, easing);
                const actual = ratio <= splitRatio
                    ? split.easedRatio * sampleRawEasingRatio(ratio / splitRatio, split.left)
                    : split.easedRatio + (1 - split.easedRatio) * sampleRawEasingRatio(
                        (ratio - splitRatio) / (1 - splitRatio),
                        split.right
                    );
                assertClose(actual, expected, `${preset.value} split ${splitRatio} ratio ${ratio}`);
            }
        }
    }
}
assert.ok(supportedPresetSplitCount > 0);
assert.ok(rejectedPresetSplits.includes('strong-in-out:0.4'));
assert.ok(rejectedPresetSplits.includes('strong-in-out:0.6'));
assert.ok(rejectedPresetSplits.includes('circular-in-out:0.4'));
assert.ok(rejectedPresetSplits.includes('circular-in-out:0.6'));

const cubicKeys = [
    {
        frame: 2,
        interpolation: 'linear',
        easing: { type: 'cubic-bezier', x1: 0.83, y1: 0, x2: 0.17, y2: 1 },
        x: -20,
        y: 10,
        scaleX: 1.5,
        scaleY: -0.75,
        rotation: -1,
        opacity: 0.2,
        blendMode: 'multiply',
        blendStrength: 0.1
    },
    {
        frame: 11,
        interpolation: 'linear',
        x: 50,
        y: -30,
        scaleX: -2,
        scaleY: -0.75,
        rotation: 3,
        opacity: 1,
        blendMode: 'overlay',
        blendStrength: 0.8
    }
];
const cubicInputSnapshot = structuredClone(cubicKeys);
const cubicPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: cubicKeys,
    frame: 7,
    duration: 14
});
assert.equal(cubicPlan.ok, true);
assert.equal(cubicPlan.interpolation, 'linear');
assert.deepEqual(cubicPlan.materializedBoundaryFrames, []);
assert.deepEqual(cubicKeys, cubicInputSnapshot, 'planner must not mutate input');
assert.equal(cubicPlan.insertedKey.blendMode, 'multiply');
assertTrackParity(cubicKeys, cubicPlan.keyframes, 14, 'explicit cubic');

const activeEditPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: cubicKeys,
    frame: 7,
    duration: 14,
    channel: 'x',
    storedValue: 123
});
assert.equal(activeEditPlan.ok, true);
assert.equal(activeEditPlan.insertedKey.x, 123);
assert.equal(
    sampleTransformTrack(baseTransform, activeEditPlan.keyframes, 7, 14).x,
    123
);
assertNonActiveTrackParity(cubicKeys, activeEditPlan.keyframes, 14, 'x', 'active channel edit');

const partialKeys = [
    {
        frame: 3,
        interpolation: 'linear',
        easing: { type: 'cubic-bezier', x1: 0.12, y1: 0, x2: 0.39, y2: 0 },
        x: 25,
        blendMode: 'add'
    },
    { frame: 9, y: 40, opacity: 0.35 }
];
const partialPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: partialKeys,
    frame: 5,
    duration: 12
});
assert.equal(partialPlan.ok, true);
assertTrackParity(partialKeys, partialPlan.keyframes, 12, 'partial cubic');

const holdKeys = [
    {
        frame: 2,
        interpolation: 'hold',
        x: 80,
        y: 25,
        opacity: 0.4,
        blendMode: 'subtract'
    },
    { frame: 9, x: -40, y: -25, opacity: 1, blendMode: 'overlay' }
];
const holdPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: holdKeys,
    frame: 6,
    duration: 12
});
assert.equal(holdPlan.ok, true);
assert.equal(holdPlan.insertedKey.interpolation, 'hold');
assert.equal(holdPlan.insertedKey.blendMode, 'subtract');
assertTrackParity(holdKeys, holdPlan.keyframes, 12, 'hold');

const implicitPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: [],
    frame: 5,
    duration: 11
});
assert.equal(implicitPlan.ok, true);
assert.deepEqual(implicitPlan.materializedBoundaryFrames, [0, 10]);
assert.deepEqual(implicitPlan.keyframes.map(key => key.frame), [0, 5, 10]);
assertTrackParity([], implicitPlan.keyframes, 11, 'implicit boundaries');

const implicitEndKeys = [{
    frame: 2,
    interpolation: 'linear',
    easing: { type: 'cubic-bezier', x1: 0, y1: 0.55, x2: 0.45, y2: 1 },
    x: 60,
    y: -20,
    blendMode: 'multiply'
}];
const implicitEndPlan = planMotionGraphKeyInsertion({
    baseTransform,
    keyframes: implicitEndKeys,
    frame: 7,
    duration: 13
});
assert.equal(implicitEndPlan.ok, true);
assert.deepEqual(implicitEndPlan.materializedBoundaryFrames, [12]);
assertTrackParity(implicitEndKeys, implicitEndPlan.keyframes, 13, 'implicit end cubic');

assert.deepEqual(
    planMotionGraphKeyInsertion({ baseTransform, keyframes: [], frame: 0, duration: 12 }),
    { ok: false, reason: 'frame-out-of-range' }
);
assert.deepEqual(
    planMotionGraphKeyInsertion({
        baseTransform,
        keyframes: [],
        frame: 4,
        duration: 12,
        channel: 'blendMode',
        storedValue: 1
    }),
    { ok: false, reason: 'channel-invalid' }
);
assert.deepEqual(
    planMotionGraphKeyInsertion({
        baseTransform,
        keyframes: [],
        frame: 4,
        duration: 12,
        channel: 'opacity',
        storedValue: Number.NaN
    }),
    { ok: false, reason: 'value-invalid' }
);
assert.deepEqual(
    planMotionGraphKeyInsertion({ baseTransform, keyframes: [{ frame: 4 }], frame: 4, duration: 12 }),
    { ok: false, reason: 'frame-occupied' }
);
assert.deepEqual(
    planMotionGraphKeyInsertion({
        baseTransform,
        keyframes: [{ frame: 4 }, { frame: 4 }],
        frame: 6,
        duration: 12
    }),
    { ok: false, reason: 'keyframe-duplicate' }
);
assert.deepEqual(splitCubicBezierEasing(0, legacyCurve), {
    ok: false,
    reason: 'split-ratio-out-of-range'
});
assert.equal(splitCubicBezierEasing(0.5, { type: 'cubic-bezier', x1: 'bad' }).reason, 'easing-invalid');

console.log('verify-motion-graph-key-insert: legacy sampler, cubic split, explicit/implicit, partial, flat/descending, HOLD and blendMode parity OK');
