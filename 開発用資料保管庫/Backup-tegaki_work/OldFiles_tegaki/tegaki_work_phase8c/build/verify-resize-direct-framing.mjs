import assert from 'node:assert/strict';
import {
    resolveResizeContentTransform,
    resolveResizePreviewDragOffset,
    resolveResizeWheelScalePercent
} from '../system/resize-direct-framing.js';

const centered = resolveResizeContentTransform(
    { width: 100, height: 50 },
    { width: 200, height: 200 },
    { fitMode: 'fit', frameSize: { width: 200, height: 200 } }
);
assert.deepEqual(centered, {
    x: 0,
    y: 50,
    width: 200,
    height: 100,
    scale: 2
});

const offset = resolveResizeContentTransform(
    { width: 100, height: 50 },
    { width: 200, height: 200 },
    {
        fitMode: 'fit',
        horizontalAlign: 'center',
        verticalAlign: 'center',
        frameSize: { width: 200, height: 200 },
        offsetX: 25,
        offsetY: -10
    }
);
assert.equal(offset.x, 25);
assert.equal(offset.y, 40);

assert.deepEqual(
    resolveResizePreviewDragOffset({ x: 10, y: -5 }, { x: 12, y: -6 }, 0.5),
    { x: 34, y: -17 }
);

assert.equal(resolveResizeWheelScalePercent(100, -1), 105);
assert.equal(resolveResizeWheelScalePercent(100, 1), 95);
assert.equal(resolveResizeWheelScalePercent(798, -1), 800);
assert.equal(resolveResizeWheelScalePercent(6, 1), 5);
assert.equal(resolveResizeWheelScalePercent(100, 0), 100);

console.log('verify-resize-direct-framing: ok');
