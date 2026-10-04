import assert from 'node:assert/strict';

import {
    buildBalloonParts,
    createBalloonContour,
    defaultBalloonParams,
    normalizeBalloonParams,
    sanitizeBalloonData
} from '../system/balloon-geometry.js';
import {
    assessBalloonTextBounds,
    balloonTextFrame,
    balloonTextFrameHandles,
    resetBalloonTextFrames,
    setBalloonTextFrame
} from '../system/balloon-text-layout.js';

const canvas = { width: 1200, height: 900 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const frameKeys = ['x', 'y', 'w', 'h'];
const frameOnly = frame => Object.fromEntries(frameKeys.map(key => [key, frame[key]]));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Invalid optional frames are omitted so old recipes retain their exact keys;
// finite values are bounded to the documented relative ranges.
{
    const legacy = normalizeBalloonParams(defaultBalloonParams(canvas), canvas);
    assert.equal(Object.hasOwn(legacy.text, 'frame'), false);
    assert.equal(Object.hasOwn(legacy, 'double'), false);

    const bounded = normalizeBalloonParams({
        ...legacy,
        text: { ...legacy.text, frame: { x: 99, y: -99, w: 0, h: 99 } }
    }, canvas);
    assert.deepEqual(bounded.text.frame, { x: 2, y: -2, w: 0.02, h: 3 });

    const invalid = normalizeBalloonParams({
        ...legacy,
        text: { ...legacy.text, frame: { x: 0, y: Number.NaN, w: 1, h: 1 } }
    }, canvas);
    assert.equal(Object.hasOwn(invalid.text, 'frame'), false);

    const double = normalizeBalloonParams({
        ...legacy,
        shape: 'double',
        double: { dx: 0, dy: 0.5, scale: 0.85, content: '2', frame: { x: -9, y: 9, w: 9, h: 0.001 } }
    }, canvas);
    assert.deepEqual(double.double.frame, { x: -2, y: 2, w: 3, h: 0.02 });
    const saved = sanitizeBalloonData({ v: 1, params: double }, canvas);
    assert.deepEqual(sanitizeBalloonData(JSON.parse(JSON.stringify(saved)), canvas), saved);
}

// set/get roundtrip is relative to the relevant body rect and does not mutate input.
{
    const base = defaultBalloonParams(canvas);
    const requested = { x: base.rect.x + 24, y: base.rect.y + 36, w: 84, h: 112 };
    const before = JSON.parse(JSON.stringify(base));
    const changed = setBalloonTextFrame(base, canvas, 0, requested);
    assert.deepEqual(base, before);
    const actual = balloonTextFrame(changed, canvas);
    for (const key of frameKeys) near(actual[key], requested[key]);
    assert.deepEqual(frameOnly(actual), frameOnly(balloonTextFrame(changed, canvas)));

    const translated = normalizeBalloonParams({
        ...changed,
        rect: { ...changed.rect, x: changed.rect.x + 51, y: changed.rect.y - 19 }
    }, canvas);
    const translatedFrame = balloonTextFrame(translated, canvas);
    near(translatedFrame.x - actual.x, 51);
    near(translatedFrame.y - actual.y, -19);

    const resized = normalizeBalloonParams({
        ...changed,
        rect: { ...changed.rect, w: changed.rect.w * 1.25, h: changed.rect.h * 0.8 }
    }, canvas);
    const resizedFrame = balloonTextFrame(resized, canvas);
    near(resizedFrame.w / actual.w, 1.25);
    near(resizedFrame.h / actual.h, 0.8);
}

// Reset creates a safe central frame. A custom contour deformation leaves the
// saved frame stable because the frame is relative to rect, not contour points.
{
    const base = defaultBalloonParams(canvas);
    const reset = resetBalloonTextFrames(base, canvas);
    assert.equal(Object.hasOwn(reset.text, 'frame'), true);
    const resetFrame = balloonTextFrame(reset, canvas);
    assert.deepEqual(assessBalloonTextBounds(reset, canvas, [resetFrame]), { outside: [], overlap: false });

    const custom = normalizeBalloonParams({
        ...base,
        shape: 'custom',
        tail: { ...base.tail, enabled: false },
        contour: createBalloonContour(8)
    }, canvas);
    const withFrame = setBalloonTextFrame(custom, canvas, 0, {
        x: custom.rect.x + 35, y: custom.rect.y + 44, w: 72, h: 88
    });
    const before = frameOnly(balloonTextFrame(withFrame, canvas));
    const deformed = normalizeBalloonParams({
        ...withFrame,
        contour: withFrame.contour.map((point, index) => index === 0 ? { ...point, radius: 0.25 } : point)
    }, canvas);
    assert.deepEqual(frameOnly(balloonTextFrame(deformed, canvas)), before);
}

// A default double's two safe areas are split along their dominant center axis.
{
    const base = normalizeBalloonParams({ ...defaultBalloonParams(canvas), shape: 'double' }, canvas);
    assert.equal(Object.hasOwn(base.text, 'frame'), false);
    assert.equal(Object.hasOwn(base.double, 'frame'), false);
    const reset = resetBalloonTextFrames(base, canvas);
    const frames = [balloonTextFrame(reset, canvas, 0), balloonTextFrame(reset, canvas, 1)];
    assert.equal(frames.length, 2);
    assert.equal(overlap(frames[0], frames[1]), false);
    assert.deepEqual(assessBalloonTextBounds(reset, canvas, frames), { outside: [], overlap: false });
    const handles = balloonTextFrameHandles(reset, canvas);
    assert.equal(handles.length, 2);
    assert.deepEqual(handles[0].center, { x: frames[0].cx, y: frames[0].cy });
    assert.deepEqual(handles[1].corners.br, { x: frames[1].x + frames[1].w, y: frames[1].y + frames[1].h });
}

// Bounds use only the body polygon: a centered box is inside, a tail-only box
// is outside, and positive-area overlap is distinguished from edge touching.
{
    const base = defaultBalloonParams(canvas);
    const noTail = { ...base, tail: { ...base.tail, enabled: false } };
    const center = { x: base.rect.x + base.rect.w / 2, y: base.rect.y + base.rect.h / 2 };
    const inside = { x: center.x - 18, y: center.y - 18, w: 36, h: 36 };
    const touching = { ...inside, x: inside.x + inside.w };
    const tailBox = { x: base.tail.tip.x - 5, y: base.tail.tip.y - 5, w: 10, h: 10 };
    const outside = { x: base.rect.x + base.rect.w - 3, y: center.y - 14, w: 48, h: 28 };
    assert.deepEqual(assessBalloonTextBounds(noTail, canvas, [inside]), { outside: [], overlap: false });
    assert.deepEqual(assessBalloonTextBounds(base, canvas, [tailBox]), { outside: [0], overlap: false });
    assert.deepEqual(assessBalloonTextBounds(noTail, canvas, [outside]), { outside: [0], overlap: false });
    assert.deepEqual(assessBalloonTextBounds(noTail, canvas, [inside, touching]), { outside: [], overlap: false });
    assert.deepEqual(assessBalloonTextBounds(noTail, canvas, [inside, { ...inside, x: inside.x + 8 }]), { outside: [], overlap: true });
    assert.deepEqual(assessBalloonTextBounds(noTail, canvas, null), { outside: [], overlap: false });
}

// A local custom indentation is rejected even when a broad bounding-box-only
// check could otherwise treat the text rectangle as central.
{
    const base = defaultBalloonParams(canvas);
    const dented = normalizeBalloonParams({
        ...base,
        shape: 'custom',
        tail: { ...base.tail, enabled: false },
        contour: createBalloonContour(8).map((point, index) => index === 0 ? { ...point, radius: 0.25 } : point)
    }, canvas);
    const dentBox = {
        x: dented.rect.x + dented.rect.w * 0.56,
        y: dented.rect.y + dented.rect.h * 0.37,
        w: dented.rect.w * 0.24,
        h: dented.rect.h * 0.26
    };
    assert.deepEqual(assessBalloonTextBounds(dented, canvas, [dentBox]).outside, [0]);
    assert.equal(buildBalloonParts(dented, canvas).body.length, 256);
}

// Large manga canvases remain deterministic and bounded to geometry sampling.
{
    const large = { width: 4960, height: 7016 };
    const params = resetBalloonTextFrames({ ...defaultBalloonParams(large), shape: 'double' }, large);
    const boxes = [balloonTextFrame(params, large, 0), balloonTextFrame(params, large, 1)];
    const first = assessBalloonTextBounds(params, large, boxes);
    assert.deepEqual(first, assessBalloonTextBounds(params, large, boxes));
    assert.deepEqual(boxes, [balloonTextFrame(params, large, 0), balloonTextFrame(params, large, 1)]);
    assert.deepEqual(first.outside, []);
}

console.log('balloon text layout verifier: optional frame compatibility / relative roundtrip / reset stability / body bounds / deterministic large canvas ok');

