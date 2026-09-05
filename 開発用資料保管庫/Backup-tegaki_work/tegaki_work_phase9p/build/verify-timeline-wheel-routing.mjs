import assert from 'node:assert/strict';
import {
    getDominantTimelineWheelDelta,
    resolveTimelineViewportWheelAction
} from '../system/animation/timeline-wheel-routing.js';

assert.equal(getDominantTimelineWheelDelta(0, 48), 48);
assert.equal(getDominantTimelineWheelDelta(-31, 4), -31);
assert.equal(
    getDominantTimelineWheelDelta(0.25, 72),
    72,
    'trackpadの微小な横ぶれで縦wheel量を失わない'
);

assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: 0.25, deltaY: 72 }),
    { type: 'frame-step', delta: 72 }
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: -31, deltaY: 4 }),
    { type: 'frame-step', delta: -31 },
    'Timeline表本体のwheelは左右キー相当のFrame移動へ送る'
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: 0, deltaY: 72, overTrackList: true }),
    { type: 'vertical-scroll', delta: 72 }
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: -40, deltaY: 2, shiftKey: true }),
    { type: 'frame-step-create', delta: -40 },
    'Shift+wheelはCAF生成を許可したFrame移動へ送る'
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: -40, deltaY: 2, shiftKey: true, overTrackList: true }),
    { type: 'vertical-scroll', delta: -40 },
    'Lane名領域のwheelはShift中も縦scrollを維持する'
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: 0, deltaY: -72, ctrlKey: true }),
    { type: 'zoom', delta: -72 }
);
assert.deepEqual(
    resolveTimelineViewportWheelAction({ deltaX: 0, deltaY: 0 }),
    { type: 'none', delta: 0 }
);

console.log('verify-timeline-wheel-routing: header zoom / grid frame-step / Shift create / lane scroll routing OK');
