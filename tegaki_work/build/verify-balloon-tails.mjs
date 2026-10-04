import assert from 'node:assert/strict';

import {
    balloonBounds,
    balloonHandles,
    buildBalloonParts,
    defaultBalloonParams,
    normalizeBalloonParams,
    sanitizeBalloonData
} from '../system/balloon-geometry.js';

const canvas = { width: 800, height: 1000 };
const bbox = points => ({
    x0: Math.min(...points.map(point => point.x)),
    x1: Math.max(...points.map(point => point.x)),
    y0: Math.min(...points.map(point => point.y)),
    y1: Math.max(...points.map(point => point.y))
});
const pointInPolygon = (poly, point) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i];
        const b = poly[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
};

// Legacy recipes retain their exact optional keys and deterministic body/tail
// polygons when extraTails is absent.
{
    const base = defaultBalloonParams(canvas);
    const normalized = normalizeBalloonParams(base, canvas);
    const roundTrip = normalizeBalloonParams(JSON.parse(JSON.stringify(normalized)), canvas);
    assert.equal(Object.hasOwn(normalized, 'extraTails'), false);
    assert.equal(Object.hasOwn(balloonHandles(normalized, canvas), 'extraTips'), false);
    assert.deepEqual(buildBalloonParts(normalized, canvas), buildBalloonParts(roundTrip, canvas));
    assert.equal(buildBalloonParts(normalized, canvas).tails.length, 1);
}

// Missing, empty, and malformed optional arrays do not add a saved key. Finite
// entries are clamped and valid entries are capped at three.
{
    const base = defaultBalloonParams(canvas);
    assert.equal(Object.hasOwn(normalizeBalloonParams({ ...base, extraTails: [] }, canvas), 'extraTails'), false);
    const malformed = normalizeBalloonParams({
        ...base,
        extraTails: [
            null,
            { enabled: true, style: 'unknown', tip: { x: 1, y: 2 }, width: 10, curve: 0 },
            { enabled: true, style: 'pointed', tip: { x: Number.NaN, y: 2 }, width: 10, curve: 0 }
        ]
    }, canvas);
    assert.equal(Object.hasOwn(malformed, 'extraTails'), false);

    const validEntry = index => ({
        enabled: index !== 2,
        style: index % 2 ? 'thought' : 'pointed',
        tip: { x: 1e9 - index, y: -1e9 + index },
        width: 999,
        curve: -999
    });
    const bounded = normalizeBalloonParams({ ...base, extraTails: [0, 1, 2, 3, 4].map(validEntry) }, canvas);
    assert.equal(bounded.extraTails.length, 3);
    assert.equal(bounded.extraTails[0].tip.x, canvas.width * 5);
    assert.equal(bounded.extraTails[0].tip.y, -canvas.height * 4);
    assert.equal(bounded.extraTails[0].width, 400);
    assert.equal(bounded.extraTails[0].curve, -1);
}

// Four mixed tails: primary stays enabled, extra pointed/thought tails render,
// disabled tails remain selectable but render nothing, and an inside tip is
// rejected by the same body-root rule as the primary tail.
{
    const base = defaultBalloonParams(canvas);
    const cx = base.rect.x + base.rect.w / 2;
    const cy = base.rect.y + base.rect.h / 2;
    const params = normalizeBalloonParams({
        ...base,
        extraTails: [
            { enabled: true, style: 'pointed', tip: { x: 55, y: cy }, width: 18, curve: 0.2 },
            { enabled: true, style: 'thought', tip: { x: 745, y: cy }, width: 22, curve: -0.3 },
            { enabled: false, style: 'pointed', tip: { x: cx, y: 60 }, width: 16, curve: 0 }
        ]
    }, canvas);
    assert.equal(params.extraTails.length, 3, 'three optional entries plus the primary tail');
    const parts = buildBalloonParts(params, canvas);
    assert.equal(parts.tails.length, 5, 'primary + extra pointed + three thought circles');
    assert.equal(parts.body.length, 96, 'legacy ellipse body sampling remains unchanged');
    const handles = balloonHandles(params, canvas);
    assert.deepEqual(handles.extraTips, [
        { x: 55, y: cy },
        { x: 745, y: cy },
        null
    ]);
    assert.equal(pointInPolygon(parts.body, parts.tails[1][0]), true, 'extra pointed tail keeps its root inside the body');
    assert.equal(pointInPolygon(parts.body, parts.tails[parts.tails.length - 1][0]), false, 'thought tail remains an outside auxiliary polygon');

    const inside = normalizeBalloonParams({
        ...base,
        extraTails: [{ enabled: true, style: 'pointed', tip: { x: cx, y: cy }, width: 20, curve: 0 }]
    }, canvas);
    assert.equal(buildBalloonParts(inside, canvas).tails.length, 1, 'inside extra tip does not create a tail polygon');
}

// All four pointed tips remain represented by balloonBounds when their tips
// are within the canvas. The bounds include tails, not just the body.
{
    const base = defaultBalloonParams(canvas);
    const cx = base.rect.x + base.rect.w / 2;
    const cy = base.rect.y + base.rect.h / 2;
    const params = normalizeBalloonParams({
        ...base,
        tail: { ...base.tail, tip: { x: cx, y: 40 } },
        extraTails: [
            { enabled: true, style: 'pointed', tip: { x: 40, y: cy }, width: 16, curve: 0 },
            { enabled: true, style: 'pointed', tip: { x: 760, y: cy }, width: 16, curve: 0 },
            { enabled: true, style: 'pointed', tip: { x: cx, y: 960 }, width: 16, curve: 0 }
        ]
    }, canvas);
    const parts = buildBalloonParts(params, canvas);
    assert.equal(parts.tails.length, 4);
    const bounds = balloonBounds(params, canvas);
    const tips = [params.tail.tip, ...params.extraTails.map(tail => tail.tip)];
    for (const tip of tips) {
        assert.ok(tip.x >= bounds.x && tip.x <= bounds.x + bounds.width, `tip x ${tip.x} is inside bounds`);
        assert.ok(tip.y >= bounds.y && tip.y <= bounds.y + bounds.height, `tip y ${tip.y} is inside bounds`);
    }
    assert.ok(bbox(parts.tails.flat()).y1 > base.rect.y + base.rect.h);
}

// Frames are unrelated optional data and survive extra-tail sanitization and
// sanitizeBalloonData persistence unchanged.
{
    const base = defaultBalloonParams(canvas);
    const raw = {
        ...base,
        text: { ...base.text, frame: { x: 0.1, y: 0.2, w: 0.6, h: 0.5 } },
        shape: 'double',
        double: {
            dx: 0,
            dy: 0.5,
            scale: 0.85,
            content: 'second',
            frame: { x: 0.2, y: 0.3, w: 0.5, h: 0.4 }
        },
        extraTails: [
            { enabled: true, style: 'pointed', tip: { x: 40, y: 40 }, width: 18, curve: 0.1 }
        ]
    };
    const saved = sanitizeBalloonData({ v: 1, params: raw }, canvas);
    const roundTrip = sanitizeBalloonData(JSON.parse(JSON.stringify(saved)), canvas);
    assert.deepEqual(roundTrip, saved);
    assert.deepEqual(buildBalloonParts(roundTrip.params, canvas), buildBalloonParts(saved.params, canvas));
    assert.deepEqual(roundTrip.params.text.frame, saved.params.text.frame);
    assert.deepEqual(roundTrip.params.double.frame, saved.params.double.frame);
    assert.deepEqual(roundTrip.params.extraTails, saved.params.extraTails);
}

console.log('balloon tails verifier: legacy compatibility / mixed pointed-thought tails / disabled-inside roots / sanitize cap / bounds / frame roundtrip ok');

