import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    CUBIC_BEZIER_OVERSHOOT_Y_MAX,
    CUBIC_BEZIER_OVERSHOOT_Y_MIN,
    normalizeCubicBezierEasing,
    sampleEasingRatio,
    sampleRawEasingRatio,
    splitCubicBezierEasing
} from '../system/animation/cubic-bezier-easing.js';
import {
    sampleClipTransform,
    sampleTransformTrack
} from '../system/animation/clip-transform-sampler.js';
import { planMotionGraphKeyInsertion } from '../system/animation/motion-graph-key-insert.js';
import {
    curvePointToGraphPoint,
    getEasingCurveYRange,
    graphPointToCurvePoint,
    isEasingCurveOvershoot,
    normalizeEditableEasingCurve
} from '../system/animation/easing-curve-editor-model.js';
import {
    applyMotionKeyClipboardPayload,
    createMotionKeyClipboardPayload
} from '../system/animation/motion-key-clipboard.js';

globalThis.window = globalThis.window || {};
const { ClipInstanceModel } = await import('../system/animation/animation-data-model.js');

const BACK_IN = Object.freeze({
    type: 'cubic-bezier', x1: 0.36, y1: 0, x2: 0.66, y2: -0.56
});
const BACK_OUT = Object.freeze({
    type: 'cubic-bezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1
});
const BACK_IN_OUT = Object.freeze({
    type: 'cubic-bezier', x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6
});
const LEGACY_CURVES = Object.freeze([
    Object.freeze({ type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }),
    Object.freeze({ type: 'cubic-bezier', x1: 0.22, y1: 1, x2: 0.36, y2: 1 }),
    Object.freeze({ type: 'cubic-bezier', x1: 0.85, y1: 0, x2: 0.15, y2: 1 })
]);
const BASE = Object.freeze({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 0,
    blendMode: 'normal',
    blendStrength: 0,
    anchorX: 0.5,
    anchorY: 0.5
});

function assertClose(actual, expected, label, epsilon = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: expected ${expected}, got ${actual}`);
}

function reconstructSplitRatio(split, ratio) {
    return ratio <= split.ratio
        ? split.easedRatio * sampleRawEasingRatio(ratio / split.ratio, split.left)
        : split.easedRatio + (1 - split.easedRatio) * sampleRawEasingRatio(
            (ratio - split.ratio) / (1 - split.ratio),
            split.right
        );
}

assert.equal(CUBIC_BEZIER_OVERSHOOT_Y_MIN, -1);
assert.equal(CUBIC_BEZIER_OVERSHOOT_Y_MAX, 2);
assert.deepEqual(normalizeCubicBezierEasing({
    type: 'cubic-bezier', x1: -3, y1: -0.6, x2: 4, y2: 1.6
}), {
    type: 'cubic-bezier', x1: 0, y1: -0.6, x2: 1, y2: 1.6
});
assert.equal(normalizeCubicBezierEasing({ ...BACK_IN, y2: -1.001 }), null);
assert.equal(normalizeCubicBezierEasing({ ...BACK_OUT, y1: 2.001 }), null);
assert.equal(normalizeCubicBezierEasing({ ...BACK_OUT, y1: Number.NaN }), null);
assert.equal(normalizeEditableEasingCurve(BACK_OUT), null, 'standard editor rejects hidden overshoot');
assert.deepEqual(normalizeEditableEasingCurve(BACK_OUT, { allowOvershoot: true }), BACK_OUT);
assert.equal(normalizeEditableEasingCurve({ ...BACK_OUT, x1: -0.01 }, { allowOvershoot: true }), null);
assert.equal(isEasingCurveOvershoot(BACK_OUT), true);
assert.equal(isEasingCurveOvershoot(LEGACY_CURVES[0]), false);
assert.deepEqual(getEasingCurveYRange(false), { yMin: 0, yMax: 1 });
assert.deepEqual(getEasingCurveYRange(true), { yMin: -1, yMax: 2 });
const graphBounds = { width: 220, height: 220, padding: 14, ...getEasingCurveYRange(true) };
for (const point of [{ x: 0.34, y: 1.56 }, { x: 0.66, y: -0.56 }]) {
    const restored = graphPointToCurvePoint(curvePointToGraphPoint(point, graphBounds), graphBounds);
    assertClose(restored.x, point.x, 'overshoot graph x round-trip');
    assertClose(restored.y, point.y, 'overshoot graph y round-trip');
}

for (const curve of LEGACY_CURVES) {
    for (const ratio of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        assert.equal(
            sampleRawEasingRatio(ratio, curve),
            sampleEasingRatio(ratio, curve),
            `legacy curve changed at ${ratio}`
        );
    }
}

assert.ok(sampleRawEasingRatio(0.4, BACK_IN) < 0, 'BACK IN must undershoot');
assert.equal(sampleEasingRatio(0.4, BACK_IN), 0, 'legacy clamped API remains bounded');
assert.ok(sampleRawEasingRatio(0.5, BACK_OUT) > 1, 'BACK OUT must overshoot');
assert.equal(sampleEasingRatio(0.5, BACK_OUT), 1, 'legacy clamped API remains bounded');

const clip = {
    startFrame: 0,
    duration: 11,
    transform: BASE,
    transformKeyframes: [
        { frame: 0, interpolation: 'linear', easing: BACK_OUT, ...BASE },
        {
            frame: 10,
            interpolation: 'linear',
            ...BASE,
            x: 100,
            scaleX: 2,
            rotation: 1,
            opacity: 1,
            blendStrength: 1
        }
    ]
};
const clipMiddle = sampleClipTransform(clip, 5);
assert.ok(clipMiddle.x > 100, 'Clip position uses raw easing ratio');
assert.ok(clipMiddle.scaleX > 2, 'Clip scale uses raw easing ratio');
assert.ok(clipMiddle.rotation > 1, 'Clip rotation uses raw easing ratio');
assert.equal(clipMiddle.opacity, 1, 'Clip opacity clamps after interpolation');
assert.equal(clipMiddle.blendStrength, 1, 'Clip blend strength clamps after interpolation');

const clampedTrackMiddle = sampleTransformTrack(BASE, clip.transformKeyframes, 5, 11);
assert.equal(clampedTrackMiddle.x, 100, 'generic Part / Bone track keeps clamped easing');
assert.equal(clampedTrackMiddle.opacity, 1);

for (const [curve, splitRatio] of [[BACK_IN, 0.4], [BACK_OUT, 0.5], [BACK_IN_OUT, 0.5]]) {
    const split = splitCubicBezierEasing(splitRatio, curve);
    assert.equal(split.ok, true, `Back split ${splitRatio} should be exact`);
    for (const ratio of [0.05, 0.2, 0.39, 0.5, 0.7, 0.9, 0.95]) {
        assertClose(
            reconstructSplitRatio(split, ratio),
            sampleRawEasingRatio(ratio, curve),
            `Back split reconstruction ${splitRatio}/${ratio}`,
            3e-6
        );
    }
}
assert.equal(splitCubicBezierEasing(0.3, BACK_OUT).reason, 'split-control-out-of-range');

const flatBoundedKeys = [
    {
        frame: 0,
        interpolation: 'linear',
        easing: BACK_OUT,
        ...BASE,
        opacity: 1,
        blendStrength: 1
    },
    {
        frame: 10,
        interpolation: 'linear',
        ...BASE,
        x: 100,
        opacity: 1,
        blendStrength: 1
    }
];
const insert = planMotionGraphKeyInsertion({
    baseTransform: { ...BASE, opacity: 1, blendStrength: 1 },
    keyframes: flatBoundedKeys,
    frame: 5,
    duration: 11,
    channel: 'x',
    storedValue: 140
});
assert.equal(insert.ok, true);
assert.equal(insert.insertedKey.x, 140);
assert.equal(insert.insertedKey.opacity, 1);
assert.equal(insert.insertedKey.blendStrength, 1);

const changingBoundedKeys = flatBoundedKeys.map((key, index) => ({
    ...key,
    opacity: index,
    blendStrength: index
}));
const boundedRejection = planMotionGraphKeyInsertion({
    baseTransform: BASE,
    keyframes: changingBoundedKeys,
    frame: 5,
    duration: 11,
    channel: 'x',
    storedValue: 140
});
assert.equal(boundedRejection.ok, false);
assert.equal(boundedRejection.reason, 'split-bounded-channel-clamp');
assert.equal(changingBoundedKeys.length, 2, 'rejection keeps input non-mutated');

const motionClipboard = createMotionKeyClipboardPayload({
    ...BASE,
    frame: 0,
    interpolation: 'linear',
    easing: BACK_IN_OUT
});
assert.deepEqual(motionClipboard.easing, BACK_IN_OUT, 'Motion value clipboard preserves Back easing');
const pastedMotion = applyMotionKeyClipboardPayload([], 3, motionClipboard);
assert.deepEqual(pastedMotion[0].easing, BACK_IN_OUT);

const storedClip = new ClipInstanceModel({
    startFrame: 4,
    duration: 11,
    transform: BASE,
    transformKeyframes: clip.transformKeyframes
});
const restoredClip = new ClipInstanceModel(JSON.parse(JSON.stringify(storedClip.serialize())));
assert.deepEqual(restoredClip.transformKeyframes[0].easing, BACK_OUT, 'Project round-trip preserves Back easing');
assertClose(
    sampleClipTransform(restoredClip, 9).x,
    clipMiddle.x,
    'Project round-trip keeps raw Back sample'
);

const ui = await readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
assert.match(ui, /id="anim-motion-curve-overshoot-btn"/);
assert.match(ui, /normalizeEditableEasingCurve\(curve,[\s\S]*?allowOvershoot: this\._motionCurveAllowOvershoot/);
assert.match(ui, /getEasingCurveYRange\(this\._motionCurveAllowOvershoot\)/);
assert.match(ui, /split-bounded-channel-clamp/);
assert.match(css, /\.anim-motion-curve-overshoot-btn/);
assert.match(css, /\.anim-motion-curve-standard-range/);

console.log('verify-motion-easing-overshoot: bounded Y, opt-in editor, Back clipboard, raw Clip ratio, exact split, and guarded insertion OK');
