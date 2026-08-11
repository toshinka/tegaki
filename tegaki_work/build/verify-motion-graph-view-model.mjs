import assert from 'node:assert/strict';

import { sampleClipTransform } from '../system/animation/clip-transform-sampler.js';
import {
    createMotionGraphViewModel,
    MOTION_GRAPH_GROUPS,
    normalizeMotionGraphGroup
} from '../system/animation/motion-graph-view-model.js';

assert.deepEqual(Object.keys(MOTION_GRAPH_GROUPS), ['position', 'scale', 'rotation', 'opacity', 'blend']);
assert.equal(normalizeMotionGraphGroup(' ROTATION '), 'rotation');
assert.equal(normalizeMotionGraphGroup('unknown'), 'position');

const clip = {
    id: 'clip-motion-graph',
    startFrame: 10,
    duration: 5,
    transform: {
        x: 2,
        y: -4,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        blendMode: 'normal',
        blendStrength: 1
    },
    transformKeyframes: [
        { frame: -1, x: 999 },
        { frame: 1, interpolation: 'linear', x: 12, y: 6, scaleX: -1, scaleY: 2, opacity: 0.5, blendMode: 'add', blendStrength: 0.4 },
        { frame: 1, interpolation: 'linear', x: 22, y: 16, scaleX: -2, scaleY: 3, opacity: 0.6, blendMode: 'add', blendStrength: 0.5 },
        { frame: 3, interpolation: 'hold', x: 42, y: 26, scaleX: 2, scaleY: 4, opacity: 0.25, blendMode: 'multiply', blendStrength: 0.2 },
        { frame: 5, x: 999 }
    ]
};
const before = JSON.stringify(clip);

for (const group of Object.keys(MOTION_GRAPH_GROUPS)) {
    const view = createMotionGraphViewModel(clip, 12, { group });
    assert.equal(view.duration, 5);
    assert.equal(view.samples.length, 5);
    view.samples.forEach((sample, localFrame) => {
        assert.deepEqual(sample.transform, sampleClipTransform(clip, clip.startFrame + localFrame));
        assert.equal(sample.localFrame, localFrame);
        assert.equal(sample.projectFrame, clip.startFrame + localFrame + 1);
    });
    assert.equal(view.cursor.localFrame, 2);
    assert.equal(view.cursor.projectFrame, 13);
    assert.equal(view.cursor.inRange, true);
}

const position = createMotionGraphViewModel(clip, 4, { group: 'position' });
assert.deepEqual(position.channels.map(channel => channel.id), ['x', 'y']);
assert.deepEqual(position.keyPoints.map(point => point.localFrame), [1, 3]);
assert.deepEqual(position.implicitBoundaryFrames.map(point => point.localFrame), [0, 4]);
assert.deepEqual(position.segments.map(segment => [segment.startLocalFrame, segment.endLocalFrame, segment.interpolation]), [
    [0, 1, 'linear'],
    [1, 3, 'linear'],
    [3, 4, 'hold']
]);
assert.equal(position.keyPoints[0].values.x, 22, 'duplicate Frame keeps the last key like the sampler');
assert.equal(position.cursor.localFrame, 0);
assert.equal(position.cursor.inRange, false);
assert.ok(position.range.min < Math.min(...position.channels.flatMap(channel => channel.values)));
assert.ok(position.range.max > Math.max(...position.channels.flatMap(channel => channel.values)));

const scale = createMotionGraphViewModel(clip, 20, { group: 'scale', rangePaddingRatio: 0.1 });
assert.deepEqual(scale.channels.map(channel => channel.id), ['scaleX', 'scaleY']);
assert.equal(scale.cursor.localFrame, 4);
assert.equal(scale.cursor.inRange, false);
assert.ok(scale.range.min < -2);
assert.ok(scale.range.max > 4);

const opacity = createMotionGraphViewModel(clip, 12, { group: 'opacity' });
assert.deepEqual(opacity.range, { min: 0, max: 100 });
assert.equal(opacity.channels[0].values[1], 60);

const blend = createMotionGraphViewModel(clip, 13, { group: 'blend' });
assert.deepEqual(blend.range, { min: 0, max: 100 });
assert.deepEqual(blend.blendModeRuns, [
    { mode: 'normal', startLocalFrame: 0, endLocalFrame: 0, startProjectFrame: 11, endProjectFrame: 11 },
    { mode: 'add', startLocalFrame: 1, endLocalFrame: 2, startProjectFrame: 12, endProjectFrame: 13 },
    { mode: 'multiply', startLocalFrame: 3, endLocalFrame: 3, startProjectFrame: 14, endProjectFrame: 14 },
    { mode: 'normal', startLocalFrame: 4, endLocalFrame: 4, startProjectFrame: 15, endProjectFrame: 15 }
]);
assert.equal(blend.cursor.blendMode, 'multiply');

const rotationClip = {
    startFrame: 0,
    duration: 5,
    transform: { rotation: 0 },
    transformKeyframes: [
        { frame: 0, interpolation: 'linear', rotation: 0 },
        { frame: 4, interpolation: 'linear', rotation: Math.PI * 4 }
    ]
};
const rotation = createMotionGraphViewModel(rotationClip, 2, { group: 'rotation' });
assert.deepEqual(rotation.channels[0].values.map(value => Math.round(value)), [0, 180, 360, 540, 720]);
assert.equal(Math.round(rotation.cursor.values.rotation), 360);

const easingClip = {
    startFrame: 4,
    duration: 3,
    transform: { x: 0 },
    transformKeyframes: [
        { frame: 0, interpolation: 'linear', easing: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 }, x: 0 },
        { frame: 2, interpolation: 'linear', x: 100 }
    ]
};
const easing = createMotionGraphViewModel(easingClip, 5, { group: 'position' });
assert.equal(easing.channels[0].values[1], sampleClipTransform(easingClip, 5).x);
assert.deepEqual(easing.segments[0].easing, easingClip.transformKeyframes[0].easing);

const constant = createMotionGraphViewModel({ startFrame: -2, duration: 1, transform: { x: 4, y: 4 } }, -2, {
    group: 'position',
    rangePaddingRatio: 0
});
assert.equal(constant.startFrame, -2, 'viewer does not rewrite the sampler timeline origin');
assert.ok(constant.range.max > constant.range.min, 'constant curve keeps a drawable range');

assert.equal(JSON.stringify(clip), before, 'view projection does not mutate ClipInstance');

console.log('verify-motion-graph-view-model: sampler parity, groups, range, keys, implicit boundaries, segments, cursor, blend runs and 720deg rotation OK');
