import assert from 'node:assert/strict';
import {
    createCurvePreset,
    curveSegments,
    evaluateCubic,
    splitCurveAt,
    moveCurveNode,
    deleteCurveNode,
    curveLengthTable,
    curvePointAtDistance,
    nearestCurvePoint,
    snapEditorPoint,
    mapEnvelopePoint,
    letteringLocalToWorld,
    letteringWorldToLocal
} from '../system/editable-curve-geometry.js';
import {
    defaultLetteringParams,
    normalizeLetteringParams,
    sanitizeLetteringData
} from '../system/lettering-model.js';

const near = (actual, expected, message, epsilon = 1e-5) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`);
};
const nearPoint = (actual, expected, message, epsilon = 1e-5) => {
    near(actual.x, expected.x, `${message} x`, epsilon);
    near(actual.y, expected.y, `${message} y`, epsilon);
};
const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
};

// Presets expose only a few editable nodes while still producing useful cubic segments.
{
    const straight = createCurvePreset('straight', 240, 80);
    const wave = createCurvePreset('wave', 240, 80);
    const arc = createCurvePreset('arc', 240, 80);
    const ellipse = createCurvePreset('ellipse', 240, 80);
    assert.equal(straight.closed, false);
    assert.equal(curveSegments(straight).length, 1);
    assert.equal(curveSegments(wave).length, 4);
    assert.equal(ellipse.closed, true);
    assert.equal(curveSegments(ellipse).length, 4);
    assert.equal(createCurvePreset('none').nodes.length, 0);
    const arcs = curveSegments(arc);
    assert.equal(arc.closed, false);
    assert.equal(arcs.length, 2);
    nearPoint(arcs[0].p0, { x: 0, y: 80 }, 'half arc left');
    nearPoint(arcs[0].p3, { x: 120, y: 0 }, 'half arc top');
    nearPoint(arcs[1].p3, { x: 240, y: 80 }, 'half arc right');
    nearPoint({ x: arcs[0].p3.x - arcs[0].p2.x, y: arcs[0].p3.y - arcs[0].p2.y },
        { x: arcs[1].p1.x - arcs[1].p0.x, y: arcs[1].p1.y - arcs[1].p0.y }, 'half arc smooth seam');
    for (const segment of arcs) for (let i = 0; i <= 20; i++) {
        const point = evaluateCubic(segment, i / 20);
        near(((point.x - 120) / 120) ** 2 + ((point.y - 80) / 80) ** 2, 1, 'half ellipse shape', 0.001);
    }
    for (const path of [straight, arc, wave, ellipse, createCurvePreset('polyline'), createCurvePreset('free')]) {
        for (const segment of curveSegments(path)) {
            for (const point of [segment.p0, segment.p1, segment.p2, segment.p3]) {
                assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), 'preset control point finite');
            }
        }
    }
}

// De Casteljau split: every point on both child cubics agrees with the source cubic.
{
    const path = {
        closed: false,
        nodes: [
            { id: 'a', x: 0, y: 0, in: { x: 0, y: 0 }, out: { x: 60, y: 90 }, smooth: true },
            { id: 'b', x: 180, y: 20, in: { x: -45, y: 80 }, out: { x: 0, y: 0 }, smooth: true }
        ]
    };
    const original = curveSegments(path)[0];
    const ratio = 0.37;
    const split = splitCurveAt(path, 0, ratio);
    assert.equal(split.nodes.length, 3);
    const children = curveSegments(split);
    for (let i = 0; i <= 20; i += 1) {
        const u = i / 20;
        nearPoint(evaluateCubic(children[0], u), evaluateCubic(original, ratio * u), 'left split invariance', 1e-8);
        nearPoint(evaluateCubic(children[1], u), evaluateCubic(original, ratio + (1 - ratio) * u), 'right split invariance', 1e-8);
    }
    assert.deepEqual(path.nodes[0].out, { x: 60, y: 90 }, 'split does not mutate source');
    assert.equal(splitCurveAt(path, 0, 0).nodes.length, 2, 'endpoint split is a no-op');

    const closed = createCurvePreset('ellipse', 240, 80);
    const closedSource = curveSegments(closed)[3];
    const closedSplit = splitCurveAt(closed, 3, 0.4);
    const closedChildren = curveSegments(closedSplit);
    for (let i = 0; i <= 10; i += 1) {
        const u = i / 10;
        nearPoint(evaluateCubic(closedChildren[3], u), evaluateCubic(closedSource, 0.4 * u), 'closed seam left split', 1e-8);
        nearPoint(evaluateCubic(closedChildren[4], u), evaluateCubic(closedSource, 0.4 + 0.6 * u), 'closed seam right split', 1e-8);
    }
}

// Editing is pure, and deleting an inserted corner leaves a valid path.
{
    const path = createCurvePreset('polyline');
    const before = structuredClone(path);
    deepFreeze(path);
    const moved = moveCurveNode(path, 'node-1', { x: 120, y: 12 });
    const deleted = deleteCurveNode(path, 'node-1');
    assert.deepEqual(path, before, 'move/delete do not mutate input');
    assert.equal(moved.nodes[1].x, 120);
    assert.equal(deleted.nodes.length, 2);
    assert.equal(deleteCurveNode(path, 'missing').nodes.length, path.nodes.length);
}

// Arc table has finite length, unit tangents, and approximately even distance samples.
{
    const table = curveLengthTable(createCurvePreset('ellipse', 240, 80), 0.05);
    assert.ok(table.length > 0 && table.samples.length > 8);
    for (const sample of table.samples) near(Math.hypot(sample.tangent.x, sample.tangent.y), 1, 'unit tangent', 1e-6);
    const points = [];
    for (let i = 0; i <= 8; i += 1) points.push(curvePointAtDistance(table, (table.length * i) / 8).point);
    const gaps = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < average * 0.22, 'arc spacing is close to even');
}

// Corner and degenerate paths remain finite and project to the expected segment.
{
    const corner = {
        closed: false,
        nodes: [
            { id: 'left', x: 0, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
            { id: 'corner', x: 40, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
            { id: 'right', x: 40, y: 40, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false }
        ]
    };
    const nearest = nearestCurvePoint(corner, { x: 40, y: 8 });
    assert.equal(nearest.segmentIndex, 1);
    nearPoint(nearest.point, { x: 40, y: 8 }, 'nearest vertical corner projection');
    near(nearest.distance, 0, 'point lies on corner segment');
    const degenerate = { closed: false, nodes: [{ id: 'a', x: 5, y: 5, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false }, { id: 'b', x: 5, y: 5, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false }] };
    assert.equal(curveLengthTable(degenerate).length, 0);
    near(nearestCurvePoint(degenerate, { x: 8, y: 9 }).distance, 5, 'degenerate nearest distance');
    assert.equal(curveLengthTable({ closed: false, nodes: [] }).length, 0);
}

// Candidate and grid snaps are thresholded and do not mutate the candidate list.
{
    const candidates = [{ id: 'anchor', point: { x: 10, y: 10 } }];
    const original = structuredClone(candidates);
    const candidate = snapEditorPoint({ x: 12, y: 11 }, { grid: 8, candidates, threshold: 4 });
    assert.equal(candidate.kind, 'candidate');
    nearPoint(candidate.point, { x: 10, y: 10 }, 'candidate snap');
    const grid = snapEditorPoint({ x: 19, y: 18 }, { grid: 10, threshold: 3 });
    assert.equal(grid.kind, 'grid');
    nearPoint(grid.point, { x: 20, y: 20 }, 'grid snap');
    assert.equal(snapEditorPoint({ x: 15, y: 17 }, { grid: 10, threshold: 1 }).snapped, false);
    assert.deepEqual(candidates, original, 'snap does not mutate candidates');
}

// Preset envelopes are finite; a nine-point envelope hits all supplied grid points.
{
    const bounds = { x: 10, y: 20, width: 100, height: 60 };
    const points = [];
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) points.push({ x: column / 2, y: row / 2 + (column === 1 ? 0.1 : 0) });
    }
    nearPoint(mapEnvelopePoint({ x: 10, y: 20 }, bounds, { kind: 'points', amount: 0, points }), { x: 10, y: 20 }, 'nine point top-left');
    nearPoint(mapEnvelopePoint({ x: 60, y: 50 }, bounds, { kind: 'points', amount: 0, points }), { x: 60, y: 56 }, 'nine point center');
    for (const kind of ['none', 'skew', 'perspective', 'arc', 'wave', 'bulge', 'taper']) {
        const mapped = mapEnvelopePoint({ x: 60, y: 50 }, bounds, { kind, amount: 0.4 });
        assert.ok(Number.isFinite(mapped.x) && Number.isFinite(mapped.y), `${kind} envelope finite`);
    }
}

// Placement is affine and invertible for finite nonzero scales.
{
    const placement = { x: 120, y: -30, rotation: 0.63, scaleX: -1.4, scaleY: 0.75 };
    const local = { x: 17, y: -8 };
    const world = letteringLocalToWorld(local, placement);
    nearPoint(letteringWorldToLocal(world, placement), local, 'affine roundtrip', 1e-8);
    assert.equal(letteringWorldToLocal(world, { ...placement, scaleX: 0 }), null, 'singular affine rejected');
}

// Normalize is forgiving for editor controls but save sanitization is strict.
{
    const canvas = { width: 800, height: 600 };
    const defaults = defaultLetteringParams(canvas);
    assert.equal(defaults.placement.x, 400);
    assert.equal(defaults.baseline.path.nodes.length, 0);
    const normalized = normalizeLetteringParams({
        text: 'a\r\nb\n'.repeat(40),
        fontKind: 'unsupported',
        fontSize: 9999,
        placement: { x: Infinity, scaleX: 0 }
    }, canvas);
    assert.equal(normalized.fontKind, 'imported');
    assert.equal(normalized.fontSize, 512);
    assert.ok(normalized.text.split('\n').length <= 32);
    assert.ok(Number.isFinite(normalized.placement.x));
    assert.equal(normalizeLetteringParams({ text: '一\r\n二' }, canvas).text, '一\n二', 'CRLF normalized while line breaks remain');
    const validParams = { ...defaults, text: '一\r\n二' };
    const valid = {
        version: 1,
        params: validParams,
        fingerprint: { hash: 'sha256:fixture', width: 800, height: 600, rasterBounds: { x: 0, y: 0, width: 128, height: 64 } }
    };
    const sanitized = sanitizeLetteringData(valid, canvas);
    assert.equal(sanitized.version, 1);
    assert.deepEqual(sanitized.fingerprint, valid.fingerprint);
    assert.equal(sanitized.params.text, '一\n二', 'strict save keeps normalized multiline text');
    const arcParams = { ...defaults, baseline: { ...defaults.baseline, kind: 'arc', path: createCurvePreset('arc') } };
    const savedArc = sanitizeLetteringData({ ...valid, params: arcParams }, canvas);
    assert.equal(savedArc.params.baseline.kind, 'arc', 'half arc survives recipe save');
    assert.deepEqual(savedArc.params.baseline.path, arcParams.baseline.path);
    assert.equal(sanitizeLetteringData({ ...valid, version: 2 }, canvas), null);
    assert.equal(sanitizeLetteringData({ ...valid, fingerprint: { ...valid.fingerprint, hash: '' } }, canvas), null);
    assert.equal(sanitizeLetteringData({ ...valid, params: { ...defaults, placement: { ...defaults.placement, x: NaN } } }, canvas), null);
    assert.equal(sanitizeLetteringData({ ...valid, params: { ...defaults, baseline: { ...defaults.baseline, path: { closed: false, nodes: new Float32Array() } } } }, canvas), null);
    const invalidEnum = sanitizeLetteringData({
        ...valid,
        params: { ...defaults, fontKind: 'legacy', baseline: { ...defaults.baseline, kind: 'legacy' }, envelope: { ...defaults.envelope, kind: 'legacy' } }
    }, canvas);
    assert.equal(invalidEnum.params.fontKind, 'imported');
    assert.equal(invalidEnum.params.baseline.kind, 'none');
    assert.equal(invalidEnum.params.envelope.kind, 'none');
    assert.equal(typeof invalidEnum.params.baseline.path.nodes, 'object');
    assert.equal(sanitizeLetteringData({ ...valid, params: null }, canvas), null);
}

console.log('verify-editable-lettering-geometry: split / arc table / corners / purity / degenerate / snap / envelope / affine / normalize ok');

