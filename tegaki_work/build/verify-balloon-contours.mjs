import assert from 'node:assert/strict';
import {
    balloonBounds,
    balloonHandles,
    balloonTextArea,
    buildBalloonParts,
    createBalloonContour,
    defaultBalloonParams,
    insertBalloonContourPoint,
    moveBalloonContourPoint,
    normalizeBalloonParams,
    removeBalloonContourPoint,
    sanitizeBalloonData,
    secondaryBalloonRect
} from '../system/balloon-geometry.js';

const canvas = { width: 1200, height: 900 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const sorted = points => points.every((point, index) => index === 0 || point.angle >= points[index - 1].angle);
const ellipseValue = (point, rect) => {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    return ((point.x - cx) / (rect.w / 2)) ** 2 + ((point.y - cy) / (rect.h / 2)) ** 2;
};

// The legacy four shapes keep their exact optional-key and geometry contract.
{
    const legacy = normalizeBalloonParams(defaultBalloonParams(canvas), canvas);
    assert.equal(Object.hasOwn(legacy, 'contour'), false);
    assert.equal(Object.hasOwn(legacy, 'secondary'), false);
    const again = JSON.parse(JSON.stringify(legacy));
    assert.deepEqual(buildBalloonParts(again, canvas), buildBalloonParts(legacy, canvas));
}

// Contour construction and editing stay within the bounded saved form.
{
    assert.deepEqual(createBalloonContour(), Array.from({ length: 8 }, (_, i) => ({ angle: i / 8, radius: 1 })));
    assert.equal(createBalloonContour(4).length, 4);
    assert.equal(createBalloonContour(99).length, 24);
    assert.equal(createBalloonContour(1).length, 4);

    const raw = {
        ...defaultBalloonParams(canvas),
        shape: 'custom',
        tail: { ...defaultBalloonParams(canvas).tail, enabled: false },
        contour: [
            { angle: 0.75, radius: 0.5 },
            { angle: 0.1, radius: 1.5 },
            { angle: 0.45, radius: 0.25 },
            { angle: 0.25, radius: 1.1 },
            { angle: 0.9, radius: 1.25 }
        ]
    };
    const custom = normalizeBalloonParams(raw, canvas);
    assert.equal(custom.contour.length, 5);
    assert.equal(sorted(custom.contour), true);
    assert.deepEqual(custom.contour.map(point => point.angle), [0.1, 0.25, 0.45, 0.75, 0.9]);
    assert.equal(buildBalloonParts(custom, canvas).body.length, 256);
    assert.deepEqual(buildBalloonParts(custom, canvas), buildBalloonParts(custom, canvas));

    const inserted = insertBalloonContourPoint(custom, 2);
    assert.equal(inserted.contour.length, 6);
    assert.equal(sorted(inserted.contour), true);
    const removed = removeBalloonContourPoint(inserted, 2);
    assert.equal(removed.contour.length, 5);
    const minimum = normalizeBalloonParams({ ...raw, contour: createBalloonContour(4) }, canvas);
    assert.equal(removeBalloonContourPoint(minimum, 0).contour.length, 4);

    const moved = moveBalloonContourPoint(custom, 2, { x: custom.rect.x + custom.rect.w * 2, y: custom.rect.y }, canvas);
    assert.equal(sorted(moved.contour), true);
    assert.ok(moved.contour[1].angle <= moved.contour[2].angle && moved.contour[2].angle <= moved.contour[3].angle);
    assert.equal(moved.contour[2].radius, 1.5);
    const seam = normalizeBalloonParams({ ...custom, contour: createBalloonContour() }, canvas);
    const atSeam = moveBalloonContourPoint(seam, 0, { x: seam.rect.x + seam.rect.w, y: seam.rect.y + seam.rect.h * 0.49 }, canvas);
    assert.ok(atSeam.contour[0].angle < 0.01, 'drag across 0/1 does not jump to the next point');
    assert.ok(moved.contour[2].angle > moved.contour[1].angle && moved.contour[2].angle < moved.contour[3].angle, 'neighbor angles remain distinct');
    assert.equal(Object.hasOwn(balloonHandles(custom, canvas), 'contour'), true);
    assert.equal(Object.hasOwn(balloonHandles(custom, canvas), 'secondary'), false);
    const customArea = balloonTextArea(custom, canvas);
    assert.ok(customArea.w < custom.rect.w * 0.74 && customArea.h < custom.rect.h * 0.74, 'custom text area follows the inward contour minimum');
    const tinyCustom = normalizeBalloonParams({ ...custom, rect: { ...custom.rect, w: 16, h: 16 }, lineWidth: 0.5, contour: createBalloonContour(4).map(point => ({ ...point, radius: 0.25 })) }, canvas);
    const tinyArea = balloonTextArea(tinyCustom, canvas);
    assert.ok(tinyArea.w <= tinyCustom.rect.w * 0.74 * 0.25 + 1e-6 && tinyArea.h <= tinyCustom.rect.h * 0.74 * 0.25 + 1e-6, 'custom minimum text box stays inside a deeply indented body');

    const translated = normalizeBalloonParams({ ...custom, rect: { ...custom.rect, x: custom.rect.x + 37, y: custom.rect.y - 19 } }, canvas);
    const originalBody = buildBalloonParts(custom, canvas).body;
    const translatedBody = buildBalloonParts(translated, canvas).body;
    originalBody.forEach((point, i) => {
        near(translatedBody[i].x - point.x, 37);
        near(translatedBody[i].y - point.y, -19);
    });
    const resized = normalizeBalloonParams({ ...custom, rect: { ...custom.rect, w: custom.rect.w * 1.25, h: custom.rect.h * 0.8 } }, canvas);
    const resizedBody = buildBalloonParts(resized, canvas).body;
    resizedBody.forEach((point, i) => {
        const a = originalBody[i];
        near((point.x - (resized.rect.x + resized.rect.w / 2)) / (resized.rect.w / 2), (a.x - (custom.rect.x + custom.rect.w / 2)) / (custom.rect.w / 2));
        near((point.y - (resized.rect.y + resized.rect.h / 2)) / (resized.rect.h / 2), (a.y - (custom.rect.y + custom.rect.h / 2)) / (custom.rect.h / 2));
    });
}

// Double body is the sampled farthest-ray union of two overlapping ellipses.
{
    const d = defaultBalloonParams(canvas);
    const double = normalizeBalloonParams({
        ...d,
        shape: 'double',
        tail: { ...d.tail, tip: { x: d.rect.x + d.rect.w / 2, y: d.rect.y + d.rect.h * 3 } },
        double: { dx: 99, dy: -99, scale: 0.1, content: 'A\r\nB' }
    }, canvas);
    assert.equal(double.double.scale, 0.4);
    assert.equal(double.double.content, 'A\nB');
    near(Math.hypot(double.double.dx, double.double.dy), 0.8 * (1 + double.double.scale) / 2);
    const secondary = secondaryBalloonRect(double);
    const parts = buildBalloonParts(double, canvas);
    assert.equal(parts.body.length, 256);
    assert.equal(parts.tails.length, 1);
    assert.deepEqual(parts, buildBalloonParts(double, canvas));
    for (const point of parts.body) {
        const primaryValue = ellipseValue(point, double.rect);
        const secondaryValue = ellipseValue(point, secondary);
        assert.ok(Math.min(Math.abs(primaryValue - 1), Math.abs(secondaryValue - 1)) < 1e-6, 'union boundary point is not internal');
    }
    const handles = balloonHandles(double, canvas);
    assert.equal(Object.hasOwn(handles, 'contour'), false);
    assert.deepEqual(handles.secondary.center, { x: secondary.x + secondary.w / 2, y: secondary.y + secondary.h / 2 });
    assert.deepEqual(handles.secondary.corners.br, { x: secondary.x + secondary.w, y: secondary.y + secondary.h });
    const secondaryArea = balloonTextArea(double, canvas, 1);
    near(secondaryArea.cx, handles.secondary.center.x);
    near(secondaryArea.cy, handles.secondary.center.y);
    assert.ok(balloonBounds(double, canvas).height > double.rect.h);

    // A tip inside either lobe is inside the union and must not create a tail.
    const insideTip = normalizeBalloonParams({ ...double, tail: { ...double.tail, tip: handles.secondary.center } }, canvas);
    assert.equal(buildBalloonParts(insideTip, canvas).tails.length, 0);

    const saved = sanitizeBalloonData({ v: 1, params: double }, canvas);
    const roundTrip = sanitizeBalloonData(JSON.parse(JSON.stringify(saved)), canvas);
    assert.deepEqual(roundTrip, saved);
    assert.deepEqual(buildBalloonParts(roundTrip.params, canvas), parts);
}

console.log('balloon contour verifier: custom edits / radial samples / double union / tail scope / translation / rescale / sanitize roundtrip ok');
