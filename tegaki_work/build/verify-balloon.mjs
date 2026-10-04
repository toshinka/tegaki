import assert from 'node:assert/strict';
import {
    BALLOON_DEFAULT_FILL_COLOR,
    BALLOON_DEFAULT_LINE_COLOR,
    BALLOON_SHAPES,
    balloonBounds,
    balloonHandles,
    balloonTextArea,
    buildBalloonParts,
    defaultBalloonParams,
    normalizeBalloonParams,
    sanitizeBalloonData
} from '../system/balloon-geometry.js';

const canvas = { width: 800, height: 1000 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const bbox = (pts) => {
    const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
function inside(poly, pt) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i]; const b = poly[j];
        if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
}

// 既定はふたば配色(maroon線 + background塗り)で、白・灰・黒ではない
{
    const d = defaultBalloonParams(canvas);
    assert.equal(d.lineColor, '#800000');
    assert.equal(d.fillColor, '#ffffee');
    assert.equal(BALLOON_DEFAULT_LINE_COLOR, '#800000');
    assert.equal(BALLOON_DEFAULT_FILL_COLOR, '#ffffee');
    assert.equal(d.text.color, '#800000');
    assert.equal(d.text.vertical, true, '縦書きが既定');
    assert.equal(normalizeBalloonParams({ lineColor: 'black', fillColor: 'white' }, canvas).lineColor, '#800000');
}

// 全形状: 多角形が作れ、本体は矩形の範囲内(ギザギザは外へ少し出る)で中心を含む。しっぽは本体の外へ伸びる
// Custom/double have their own extent/union invariants in verify-balloon-contours.
for (const shape of BALLOON_SHAPES.filter(shape => ['ellipse', 'roundrect', 'cloud', 'burst'].includes(shape.id))) {
    const p = { ...defaultBalloonParams(canvas), shape: shape.id };
    const { body, tails } = buildBalloonParts(p, canvas);
    assert.ok(body.length >= 4, shape.id);
    const b = bbox(body);
    const { x, y, w, h } = p.rect;
    assert.ok(b.x0 >= x - w * 0.12 && b.x1 <= x + w * 1.12 && b.y0 >= y - h * 0.12 && b.y1 <= y + h * 1.12, `${shape.id} within rect`);
    assert.ok(inside(body, { x: x + w / 2, y: y + h / 2 }), `${shape.id} contains center`);
    assert.equal(tails.length, 1, `${shape.id} tail`);
    const tip = bbox(tails[0]);
    assert.ok(tip.y1 > y + h, `${shape.id} tail reaches below the body`);
}

// 決定性: 同じseedなら同じ、違うseedなら違う(ギザギザ)
{
    const p = { ...defaultBalloonParams(canvas), shape: 'burst', seed: 5 };
    assert.deepEqual(buildBalloonParts(p, canvas), buildBalloonParts(p, canvas));
    assert.notDeepEqual(buildBalloonParts(p, canvas).body, buildBalloonParts({ ...p, seed: 6 }, canvas).body);
}

// しっぽ: 先端が本体の中にあれば出さない。OFFで無し。丸(考え)は小さい円が3つ
{
    const d = defaultBalloonParams(canvas);
    const c = { x: d.rect.x + d.rect.w / 2, y: d.rect.y + d.rect.h / 2 };
    assert.equal(buildBalloonParts({ ...d, tail: { ...d.tail, tip: c } }, canvas).tails.length, 0);
    assert.equal(buildBalloonParts({ ...d, tail: { ...d.tail, enabled: false } }, canvas).tails.length, 0);
    const thought = buildBalloonParts({ ...d, tail: { ...d.tail, style: 'thought' } }, canvas);
    assert.equal(thought.tails.length, 3);
    const radii = thought.tails.map(t => { const b = bbox(t); return (b.x1 - b.x0) / 2; });
    assert.ok(radii[0] > radii[1] && radii[1] > radii[2], 'circles shrink toward the tip');
    // 先端の方向: 右下に向ければしっぽのbboxも右下に伸びる
    const right = buildBalloonParts({ ...d, tail: { ...d.tail, tip: { x: d.rect.x + d.rect.w + 120, y: c.y } } }, canvas);
    assert.ok(bbox(right.tails[0]).x1 >= d.rect.x + d.rect.w + 100);
}

// 文字領域: 本体と同心で、形ごとの比率だけ内側。ギザギザは雲より小さい
{
    const d = defaultBalloonParams(canvas);
    const a = balloonTextArea(d, canvas);
    near(a.cx, d.rect.x + d.rect.w / 2);
    near(a.cy, d.rect.y + d.rect.h / 2);
    assert.ok(a.w < d.rect.w && a.h < d.rect.h);
    assert.ok(balloonTextArea({ ...d, shape: 'burst' }, canvas).w < balloonTextArea({ ...d, shape: 'cloud' }, canvas).w);
    assert.ok(balloonTextArea({ ...d, shape: 'roundrect' }, canvas).w > a.w);
}

// ハンドル・外接矩形(キャンバス内へ丸める、線幅分の余白)
{
    const d = defaultBalloonParams(canvas);
    const h = balloonHandles(d, canvas);
    assert.deepEqual(h.tip, d.tail.tip);
    assert.equal(balloonHandles({ ...d, tail: { ...d.tail, enabled: false } }, canvas).tip, null);
    assert.deepEqual(h.corners.br, { x: d.rect.x + d.rect.w, y: d.rect.y + d.rect.h });
    const b = balloonBounds(d, canvas);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= canvas.width && b.y + b.height <= canvas.height);
    assert.ok(b.height > d.rect.h, 'tail extends the bounds');
    const edge = balloonBounds({ ...d, rect: { ...d.rect, x: -50 }, tail: { ...d.tail, enabled: false } }, canvas);
    assert.equal(edge.x, 0, 'clamped to canvas');
}

// 正規化・保存境界
{
    const n = normalizeBalloonParams({ shape: 'x', rect: { x: 1e9, y: 0, w: -5, h: 99999 }, lineWidth: 999, bumps: 1, spikes: 1000, tail: { style: 'weird', width: -3, curve: 9, tip: { x: NaN, y: 5 } }, text: { fontSize: 1, content: 'a\r\nb', lineHeight: 99, align: 'x', fontKind: 'x' } }, canvas);
    assert.equal(n.shape, 'ellipse');
    assert.ok(n.rect.w >= 16 && n.rect.h <= 4000 && n.rect.x <= canvas.width * 5);
    assert.equal(n.lineWidth, 24);
    assert.equal(n.bumps, 5);
    assert.equal(n.spikes, 60);
    assert.equal(n.tail.style, 'pointed');
    assert.equal(n.tail.curve, 1);
    assert.equal(n.text.fontSize, 8);
    assert.equal(n.text.content, 'a\nb');
    assert.equal(n.text.lineHeight, 3);
    assert.equal(n.text.align, 'center');
    assert.equal(n.text.fontKind, 'system');
    const clean = sanitizeBalloonData({ v: 1, params: { ...defaultBalloonParams(canvas), shape: 'cloud', seed: 77 } }, canvas);
    const again = sanitizeBalloonData(JSON.parse(JSON.stringify(clean)), canvas);
    assert.deepEqual(buildBalloonParts(again.params, canvas), buildBalloonParts(clean.params, canvas));
    assert.equal(sanitizeBalloonData(null, canvas), null);
    assert.equal(sanitizeBalloonData({ params: 1 }, canvas), null);
}

console.log('balloon verifier: futaba defaults / shapes / tails / seed / text area / handles / bounds / persistence ok');
