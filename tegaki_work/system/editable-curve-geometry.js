/**
 * ============================================================================
 * ファイル名: system/editable-curve-geometry.js
 * 責務: 文字配置線の純粋なBezier評価、点編集、弧長、吸着、envelope、配置変換。
 * 依存: なし（DOM / Pixi / Canvas / Project / History 非依存）
 * 被依存: system/lettering-model.js, lettering UI/renderer, build verifier
 * 公開API: createCurvePreset, curveSegments, evaluateCubic, splitCurveAt,
 *          moveCurveNode, deleteCurveNode, curveLengthTable,
 *          curvePointAtDistance, nearestCurvePoint, snapEditorPoint,
 *          mapEnvelopePoint, letteringLocalToWorld, letteringWorldToLocal
 * 保存: なし。path は文字metadataへ渡される純粋な編集値で、length table はruntime値。
 *
 * path.nodes の in/out は anchor からの相対offsetである。区間は
 * node.out -> 次node.in の cubic として評価する。分割は de Casteljau
 * をそのまま node の in/out へ戻すため、点の追加時に元の曲線を変えない。
 * ============================================================================
 */

const EPSILON = 1e-9;
const DEFAULT_PRESET_WIDTH = 240;
const DEFAULT_PRESET_HEIGHT = 80;
const MAX_TABLE_DEPTH = 18;

const BASELINE_PRESETS = new Set(['none', 'straight', 'arc', 'wave', 'ellipse', 'polyline', 'free']);

function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function finitePoint(value, fallback = { x: 0, y: 0 }) {
    return {
        x: finite(value?.x, fallback.x),
        y: finite(value?.y, fallback.y)
    };
}

function clonePoint(point) {
    return { x: point.x, y: point.y };
}

function cloneOffset(value) {
    return { x: finite(value?.x), y: finite(value?.y) };
}

function sameId(left, right) {
    return left === right || (left != null && right != null && String(left) === String(right));
}

function normalizeNodeId(value, index) {
    if (typeof value === 'string' || typeof value === 'number') return value;
    return `node-${index}`;
}

function cloneNode(node, index) {
    const anchor = finitePoint(node);
    return {
        id: normalizeNodeId(node?.id, index),
        x: anchor.x,
        y: anchor.y,
        in: cloneOffset(node?.in),
        out: cloneOffset(node?.out),
        smooth: node?.smooth === true
    };
}

function clonePath(path) {
    const nodes = Array.isArray(path?.nodes) ? path.nodes.map(cloneNode) : [];
    return { closed: path?.closed === true, nodes };
}

function lerpPoint(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

function addOffset(point, offset) {
    return { x: point.x + offset.x, y: point.y + offset.y };
}

function subPoint(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeVector(vector, fallback = { x: 0, y: 0 }) {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= EPSILON) return clonePoint(fallback);
    return { x: vector.x / length, y: vector.y / length };
}

function nodeAt(path, index) {
    return path.nodes[index];
}

function segmentAt(path, index) {
    const segments = curveSegments(path);
    return segments[index] || null;
}

function segmentPoint(segment, key, fallback) {
    const value = segment?.[key];
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return value;
    return fallback;
}

function cubicDerivative(segment, t) {
    const p0 = segmentPoint(segment, 'p0', { x: 0, y: 0 });
    const p1 = segmentPoint(segment, 'p1', p0);
    const p2 = segmentPoint(segment, 'p2', p1);
    const p3 = segmentPoint(segment, 'p3', p2);
    const u = 1 - t;
    return {
        x: 3 * (u * u * (p1.x - p0.x) + 2 * u * t * (p2.x - p1.x) + t * t * (p3.x - p2.x)),
        y: 3 * (u * u * (p1.y - p0.y) + 2 * u * t * (p2.y - p1.y) + t * t * (p3.y - p2.y))
    };
}

function cubicSecondDerivative(segment, t) {
    const p0 = segmentPoint(segment, 'p0', { x: 0, y: 0 });
    const p1 = segmentPoint(segment, 'p1', p0);
    const p2 = segmentPoint(segment, 'p2', p1);
    const p3 = segmentPoint(segment, 'p3', p2);
    return {
        x: 6 * ((1 - t) * (p2.x - 2 * p1.x + p0.x) + t * (p3.x - 2 * p2.x + p1.x)),
        y: 6 * ((1 - t) * (p2.y - 2 * p1.y + p0.y) + t * (p3.y - 2 * p2.y + p1.y))
    };
}

function tangentAt(segment, t) {
    const tangent = cubicDerivative(segment, t);
    if (Math.hypot(tangent.x, tangent.y) > EPSILON) return normalizeVector(tangent);
    const p0 = segmentPoint(segment, 'p0', { x: 0, y: 0 });
    const p3 = segmentPoint(segment, 'p3', p0);
    return normalizeVector(subPoint(p3, p0));
}

function splitControls(segment, t) {
    const p0 = segment.p0;
    const p1 = segment.p1;
    const p2 = segment.p2;
    const p3 = segment.p3;
    const q0 = lerpPoint(p0, p1, t);
    const q1 = lerpPoint(p1, p2, t);
    const q2 = lerpPoint(p2, p3, t);
    const r0 = lerpPoint(q0, q1, t);
    const r1 = lerpPoint(q1, q2, t);
    const point = lerpPoint(r0, r1, t);
    return { q0, q2, r0, r1, point };
}

function safePresetDimension(value, fallback) {
    return Math.max(1, Math.abs(finite(Number(value), fallback)));
}

function lineNode(id, x, y, smooth = false) {
    return { id, x, y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth };
}

function handleNode(id, x, y, inOffset, outOffset, smooth = true) {
    return { id, x, y, in: { ...inOffset }, out: { ...outOffset }, smooth };
}

/**
 * Create a deterministic small-node path for a lettering baseline.
 * `none` intentionally has no nodes; a renderer can treat it as ordinary text.
 */
export function createCurvePreset(kind, width = DEFAULT_PRESET_WIDTH, height = DEFAULT_PRESET_HEIGHT) {
    const preset = BASELINE_PRESETS.has(kind) ? kind : 'straight';
    const w = safePresetDimension(width, DEFAULT_PRESET_WIDTH);
    const h = safePresetDimension(height, DEFAULT_PRESET_HEIGHT);
    const cy = h / 2;
    if (preset === 'none') return { closed: false, nodes: [] };
    if (preset === 'straight') {
        return { closed: false, nodes: [lineNode('node-0', 0, cy), lineNode('node-1', w, cy)] };
    }
    if (preset === 'arc') {
        // Upper half of an ellipse, two tangent-continuous quarter cubics.
        const rx = w / 2, k = 0.5522847498307936;
        return { closed: false, nodes: [
            handleNode('node-0', 0, h, { x: 0, y: 0 }, { x: 0, y: -k * h }, true),
            handleNode('node-1', rx, 0, { x: -k * rx, y: 0 }, { x: k * rx, y: 0 }, true),
            handleNode('node-2', w, h, { x: 0, y: -k * h }, { x: 0, y: 0 }, true)
        ] };
    }
    if (preset === 'wave') {
        const quarter = w / 4;
        const amplitude = h * 0.28;
        const handleX = quarter * 0.55;
        return {
            closed: false,
            nodes: [
                handleNode('node-0', 0, cy, { x: 0, y: 0 }, { x: handleX, y: 0 }),
                handleNode('node-1', quarter, cy - amplitude, { x: -handleX, y: 0 }, { x: handleX, y: 0 }),
                handleNode('node-2', quarter * 2, cy, { x: -handleX, y: 0 }, { x: handleX, y: 0 }),
                handleNode('node-3', quarter * 3, cy + amplitude, { x: -handleX, y: 0 }, { x: handleX, y: 0 }),
                handleNode('node-4', w, cy, { x: -handleX, y: 0 }, { x: 0, y: 0 })
            ]
        };
    }
    if (preset === 'ellipse') {
        const rx = w / 2;
        const ry = h / 2;
        const k = 0.5522847498307936;
        return {
            closed: true,
            nodes: [
                handleNode('node-0', rx, 0, { x: -k * rx, y: 0 }, { x: k * rx, y: 0 }),
                handleNode('node-1', w, ry, { x: 0, y: -k * ry }, { x: 0, y: k * ry }),
                handleNode('node-2', rx, h, { x: k * rx, y: 0 }, { x: -k * rx, y: 0 }),
                handleNode('node-3', 0, ry, { x: 0, y: k * ry }, { x: 0, y: -k * ry })
            ]
        };
    }
    if (preset === 'polyline') {
        return {
            closed: false,
            nodes: [lineNode('node-0', 0, cy), lineNode('node-1', w * 0.5, cy - h * 0.18), lineNode('node-2', w, cy)]
        };
    }
    // free starts as a deliberately small, editable line with a slight bend.
    return {
        closed: false,
        nodes: [
            handleNode('node-0', 0, cy, { x: 0, y: 0 }, { x: w * 0.22, y: -h * 0.08 }, true),
            handleNode('node-1', w * 0.5, cy + h * 0.14, { x: -w * 0.18, y: 0 }, { x: w * 0.18, y: 0 }, true),
            handleNode('node-2', w, cy, { x: -w * 0.22, y: h * 0.08 }, { x: 0, y: 0 }, true)
        ]
    };
}

/**
 * Expand node-relative handles to cubic segments. Each returned object is a
 * fresh value, so callers may inspect or modify it without changing the path.
 */
export function curveSegments(path) {
    const safePath = clonePath(path);
    const count = safePath.nodes.length;
    if (count < 2) return [];
    const segmentCount = safePath.closed ? count : count - 1;
    const segments = [];
    for (let index = 0; index < segmentCount; index += 1) {
        const endIndex = (index + 1) % count;
        const start = nodeAt(safePath, index);
        const end = nodeAt(safePath, endIndex);
        const p0 = { x: start.x, y: start.y };
        const p3 = { x: end.x, y: end.y };
        segments.push({
            index,
            segmentIndex: index,
            startIndex: index,
            endIndex,
            startId: start.id,
            endId: end.id,
            p0,
            p1: addOffset(p0, start.out),
            p2: addOffset(p3, end.in),
            p3
        });
    }
    return segments;
}

/** Evaluate a cubic segment at t. Values outside [0,1] are clamped. */
export function evaluateCubic(segment, t) {
    const p0 = segmentPoint(segment, 'p0', segmentPoint(segment, 'start', { x: 0, y: 0 }));
    const p1 = segmentPoint(segment, 'p1', segmentPoint(segment, 'control1', p0));
    const p2 = segmentPoint(segment, 'p2', segmentPoint(segment, 'control2', p1));
    const p3 = segmentPoint(segment, 'p3', segmentPoint(segment, 'end', p2));
    const ratio = Math.min(1, Math.max(0, finite(Number(t), 0)));
    const u = 1 - ratio;
    const uu = u * u;
    const tt = ratio * ratio;
    const uuu = uu * u;
    const ttt = tt * ratio;
    return {
        x: uuu * p0.x + 3 * uu * ratio * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * ratio * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
}

function uniqueSplitId(nodes, startId, endId, ratio) {
    const start = String(startId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const end = String(endId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const base = `split-${start}-${end}-${Math.round(ratio * 1000000)}`;
    let id = base;
    let suffix = 1;
    while (nodes.some(node => sameId(node.id, id))) {
        id = `${base}-${suffix}`;
        suffix += 1;
    }
    return id;
}

/**
 * Insert one node by exactly splitting a cubic segment. Endpoint t values are
 * treated as no-ops because they do not add a meaningful editable node.
 */
export function splitCurveAt(path, segmentIndex, t) {
    const result = clonePath(path);
    const segments = curveSegments(result);
    const index = Number.isInteger(segmentIndex) ? segmentIndex : Math.trunc(Number(segmentIndex));
    if (index < 0 || index >= segments.length) return result;
    const ratio = Math.min(1, Math.max(0, finite(Number(t), 0)));
    if (ratio <= EPSILON || ratio >= 1 - EPSILON) return result;
    const segment = segments[index];
    const controls = splitControls(segment, ratio);
    const start = result.nodes[segment.startIndex];
    const end = result.nodes[segment.endIndex];
    start.out = subPoint(controls.q0, segment.p0);
    end.in = subPoint(controls.q2, segment.p3);
    const inserted = {
        id: uniqueSplitId(result.nodes, start.id, end.id, ratio),
        x: controls.point.x,
        y: controls.point.y,
        in: subPoint(controls.r0, controls.point),
        out: subPoint(controls.r1, controls.point),
        smooth: start.smooth === true && end.smooth === true
    };
    result.nodes.splice(segment.startIndex + 1, 0, inserted);
    return result;
}

/** Move only the anchor. Relative in/out handles travel with that anchor. */
export function moveCurveNode(path, id, point) {
    const result = clonePath(path);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return result;
    const target = result.nodes.find(node => sameId(node.id, id));
    if (target) {
        target.x = point.x;
        target.y = point.y;
    }
    return result;
}

/**
 * Remove a node and join its neighboring cubics using the outer controls.
 * The join is intentionally an approximation; endpoint deletion remains exact.
 */
export function deleteCurveNode(path, id) {
    const result = clonePath(path);
    const index = result.nodes.findIndex(node => sameId(node.id, id));
    if (index < 0) return result;
    const count = result.nodes.length;
    if (count <= 2) {
        result.nodes.splice(index, 1);
        return result;
    }
    const segments = curveSegments(result);
    if (!result.closed && (index === 0 || index === count - 1)) {
        result.nodes.splice(index, 1);
        return result;
    }
    const previousIndex = (index - 1 + count) % count;
    const nextIndex = (index + 1) % count;
    const previousSegment = segments[previousIndex];
    const nextSegment = segments[index];
    const previous = result.nodes[previousIndex];
    const next = result.nodes[nextIndex];
    if (previousSegment && nextSegment) {
        previous.out = subPoint(previousSegment.p1, previousSegment.p0);
        next.in = subPoint(nextSegment.p2, nextSegment.p3);
    }
    result.nodes.splice(index, 1);
    return result;
}

function cubicFlatness(segment) {
    const chord = distance(segment.p0, segment.p3);
    if (chord <= EPSILON) return Math.max(distance(segment.p0, segment.p1), distance(segment.p0, segment.p2));
    const dx = segment.p3.x - segment.p0.x;
    const dy = segment.p3.y - segment.p0.y;
    const lineDistance = point => Math.abs((point.x - segment.p0.x) * dy - (point.y - segment.p0.y) * dx) / chord;
    return Math.max(lineDistance(segment.p1), lineDistance(segment.p2));
}

function sampleCubic(segment, tolerance, segmentIndex) {
    const samples = [];
    const visit = (p0, p1, p2, p3, t0, t1, depth) => {
        const local = { p0, p1, p2, p3 };
        if (depth >= MAX_TABLE_DEPTH || cubicFlatness(local) <= tolerance) {
            samples.push({ segmentIndex, t: t1, point: clonePoint(p3), tangent: tangentAt(segment, t1) });
            return;
        }
        const q0 = lerpPoint(p0, p1, 0.5);
        const q1 = lerpPoint(p1, p2, 0.5);
        const q2 = lerpPoint(p2, p3, 0.5);
        const r0 = lerpPoint(q0, q1, 0.5);
        const r1 = lerpPoint(q1, q2, 0.5);
        const mid = lerpPoint(r0, r1, 0.5);
        const tm = (t0 + t1) / 2;
        visit(p0, q0, r0, mid, t0, tm, depth + 1);
        visit(mid, r1, q2, p3, tm, t1, depth + 1);
    };
    samples.push({ segmentIndex, t: 0, point: clonePoint(segment.p0), tangent: tangentAt(segment, 0) });
    visit(segment.p0, segment.p1, segment.p2, segment.p3, 0, 1, 0);
    return samples;
}

function appendDistanceSamples(target, localSamples, totalDistance) {
    let total = totalDistance;
    for (const sample of localSamples) {
        const previous = target[target.length - 1];
        if (previous && sample.t === 0 && distance(previous.point, sample.point) <= EPSILON) continue;
        if (previous) total += distance(previous.point, sample.point);
        target.push({
            segmentIndex: sample.segmentIndex,
            t: sample.t,
            distance: total,
            point: clonePoint(sample.point),
            tangent: clonePoint(sample.tangent)
        });
    }
    return total;
}

/** Build an adaptive arc-length table; editable nodes and table samples stay separate. */
export function curveLengthTable(path, tolerance = 0.5) {
    const safePath = clonePath(path);
    const segments = curveSegments(safePath);
    const allowedTolerance = Math.max(1e-5, Math.abs(finite(Number(tolerance), 0.5)));
    const samples = [];
    let total = 0;
    for (const segment of segments) {
        total = appendDistanceSamples(samples, sampleCubic(segment, allowedTolerance, segment.segmentIndex), total);
    }
    if (samples.length === 0 && safePath.nodes.length > 0) {
        samples.push({ segmentIndex: -1, t: 0, distance: 0, point: clonePoint(safePath.nodes[0]), tangent: { x: 0, y: 0 } });
    }
    return {
        path: safePath,
        segments,
        samples,
        entries: samples,
        length: total
    };
}

function interpolateTangent(left, right, ratio) {
    return normalizeVector({
        x: left.x + (right.x - left.x) * ratio,
        y: left.y + (right.y - left.y) * ratio
    }, left);
}

/** Evaluate a table by distance, with a point and unit tangent in the result. */
export function curvePointAtDistance(table, distanceAlong) {
    const samples = Array.isArray(table?.samples) ? table.samples : [];
    if (samples.length === 0) return null;
    const requested = finite(Number(distanceAlong), 0);
    const target = Math.min(Math.max(0, requested), Math.max(0, finite(table.length, 0)));
    if (target <= samples[0].distance + EPSILON) {
        return { segmentIndex: samples[0].segmentIndex, t: samples[0].t, point: clonePoint(samples[0].point), tangent: clonePoint(samples[0].tangent) };
    }
    const last = samples[samples.length - 1];
    if (target >= last.distance - EPSILON) {
        return { segmentIndex: last.segmentIndex, t: last.t, point: clonePoint(last.point), tangent: clonePoint(last.tangent) };
    }
    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (samples[middle].distance <= target) low = middle;
        else high = middle;
    }
    const left = samples[low];
    const right = samples[high];
    const span = right.distance - left.distance;
    const ratio = span <= EPSILON ? 0 : (target - left.distance) / span;
    return {
        segmentIndex: left.segmentIndex,
        t: left.t + (right.t - left.t) * ratio,
        point: lerpPoint(left.point, right.point, ratio),
        tangent: interpolateTangent(left.tangent, right.tangent, ratio)
    };
}

function refineNearest(segment, initialT, target) {
    let t = Math.min(1, Math.max(0, initialT));
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const point = evaluateCubic(segment, t);
        const first = cubicDerivative(segment, t);
        const second = cubicSecondDerivative(segment, t);
        const delta = { x: point.x - target.x, y: point.y - target.y };
        const numerator = delta.x * first.x + delta.y * first.y;
        const denominator = first.x * first.x + first.y * first.y + delta.x * second.x + delta.y * second.y;
        if (Math.abs(denominator) <= 1e-12) break;
        const next = Math.min(1, Math.max(0, t - numerator / denominator));
        if (Math.abs(next - t) <= 1e-10) {
            t = next;
            break;
        }
        t = next;
    }
    return t;
}

/** Find the closest cubic point by dense seeds plus derivative refinement. */
export function nearestCurvePoint(path, point) {
    const safePath = clonePath(path);
    const target = finitePoint(point);
    const segments = curveSegments(safePath);
    if (segments.length === 0) {
        if (safePath.nodes.length === 0) return null;
        const only = clonePoint(safePath.nodes[0]);
        return { segmentIndex: -1, t: 0, point: only, distance: distance(only, target) };
    }
    let best = null;
    for (const segment of segments) {
        const seedCount = 48;
        for (let i = 0; i <= seedCount; i += 1) {
            const seed = i / seedCount;
            const t = refineNearest(segment, seed, target);
            const candidate = evaluateCubic(segment, t);
            const candidateDistance = distance(candidate, target);
            if (!best || candidateDistance < best.distance) {
                best = { segmentIndex: segment.segmentIndex, t, point: candidate, distance: candidateDistance };
            }
        }
    }
    return best;
}

function candidatePoint(candidate) {
    const point = candidate?.point && Number.isFinite(candidate.point.x) && Number.isFinite(candidate.point.y)
        ? candidate.point
        : candidate;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { x: point.x, y: point.y };
}

/**
 * Snap to the closest supplied candidate or origin-based grid point. The
 * result keeps the chosen point separate from the source object so it remains
 * safe to hand to a drag session.
 */
export function snapEditorPoint(point, { grid = 0, candidates = [], threshold = 6 } = {}) {
    const source = finitePoint(point);
    const limit = Math.max(0, finite(Number(threshold), 6));
    let best = null;
    const consider = (candidate, kind, metadata = null) => {
        const d = distance(source, candidate);
        if (d > limit + EPSILON) return;
        if (!best || d < best.distance - EPSILON || (Math.abs(d - best.distance) <= EPSILON && kind === 'candidate')) {
            best = { point: clonePoint(candidate), distance: d, kind, candidate: metadata };
        }
    };
    const step = Math.abs(finite(Number(grid), 0));
    if (step > EPSILON) {
        consider({ x: Math.round(source.x / step) * step, y: Math.round(source.y / step) * step }, 'grid');
    }
    if (Array.isArray(candidates)) {
        for (const raw of candidates) {
            const candidate = candidatePoint(raw);
            if (!candidate) continue;
            consider(candidate, 'candidate', raw && raw.point ? { ...raw, point: clonePoint(candidate) } : clonePoint(candidate));
        }
    }
    if (!best) return { point: source, snapped: false, kind: null, candidate: null };
    return { point: best.point, snapped: true, kind: best.kind, candidate: best.candidate };
}

function normalizeBounds(bounds) {
    return {
        x: finite(bounds?.x),
        y: finite(bounds?.y),
        width: Math.max(0, finite(bounds?.width)),
        height: Math.max(0, finite(bounds?.height))
    };
}

function normalizedEnvelopePoint(point, bounds) {
    return {
        u: bounds.width <= EPSILON ? 0 : (point.x - bounds.x) / bounds.width,
        v: bounds.height <= EPSILON ? 0 : (point.y - bounds.y) / bounds.height
    };
}

function fromNormalized(u, v, bounds) {
    return { x: bounds.x + u * bounds.width, y: bounds.y + v * bounds.height };
}

function mapBilinear(u, v, corners) {
    const top = lerpPoint(corners.tl, corners.tr, u);
    const bottom = lerpPoint(corners.bl, corners.br, u);
    return lerpPoint(top, bottom, v);
}

function mapProjectiveUnitSquare(u, v, corners) {
    const x0 = corners.tl.x; const y0 = corners.tl.y;
    const x1 = corners.tr.x; const y1 = corners.tr.y;
    const x2 = corners.br.x; const y2 = corners.br.y;
    const x3 = corners.bl.x; const y3 = corners.bl.y;
    // Solve the two equations at (1,1) for the projective denominator terms.
    // Writing them from the four corner constraints avoids assuming a convex
    // quad and, in particular, keeps all four corners exact.
    const a11 = x1 - x2;
    const a12 = x3 - x2;
    const a21 = y1 - y2;
    const a22 = y3 - y2;
    const b1 = x0 - x1 - x3 + x2;
    const b2 = y0 - y1 - y3 + y2;
    const denominator = a11 * a22 - a12 * a21;
    let a; let b; let c; let d; let e; let f; let g = 0; let h = 0;
    if (Math.abs(denominator) <= 1e-10) {
        return mapBilinear(u, v, corners);
    }
    g = (b1 * a22 - a12 * b2) / denominator;
    h = (a11 * b2 - b1 * a21) / denominator;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
    const denominatorAt = g * u + h * v + 1;
    if (Math.abs(denominatorAt) <= 1e-10) return mapBilinear(u, v, corners);
    return { x: (a * u + b * v + c) / denominatorAt, y: (d * u + e * v + f) / denominatorAt };
}

function quadraticBasis(value) {
    return [2 * (value - 0.5) * (value - 1), 4 * value * (1 - value), 2 * value * (value - 0.5)];
}

function mapNinePoint(u, v, points) {
    if (!Array.isArray(points) || points.length !== 9) return null;
    const us = quadraticBasis(u);
    const vs = quadraticBasis(v);
    const result = { x: 0, y: 0 };
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
            const p = candidatePoint(points[row * 3 + column]);
            if (!p) return null;
            const weight = vs[row] * us[column];
            result.x += p.x * weight;
            result.y += p.y * weight;
        }
    }
    return result;
}

/** Map one local point through a small preset or normalized 3x3 envelope. */
export function mapEnvelopePoint(point, bounds, envelope) {
    const safeBounds = normalizeBounds(bounds);
    const source = finitePoint(point);
    const normalized = normalizedEnvelopePoint(source, safeBounds);
    const u = normalized.u;
    const v = normalized.v;
    const kind = typeof envelope?.kind === 'string' ? envelope.kind : 'none';
    const amount = finite(Number(envelope?.amount), 0);
    let mapped = null;
    if (kind === 'points') {
        const nine = mapNinePoint(u, v, envelope.points);
        if (nine) mapped = nine;
    } else if (kind === 'skew') {
        mapped = { x: u + amount * (v - 0.5), y: v };
    } else if (kind === 'perspective') {
        const edge = amount * 0.45;
        mapped = mapProjectiveUnitSquare(u, v, {
            tl: { x: -edge, y: -edge * 0.5 },
            tr: { x: 1 + edge, y: edge * 0.5 },
            br: { x: 1 + edge * 0.5, y: 1 + edge },
            bl: { x: -edge * 0.5, y: 1 - edge }
        });
    } else if (kind === 'arc') {
        mapped = { x: u, y: v + amount * 4 * u * (1 - u) };
    } else if (kind === 'wave') {
        mapped = { x: u, y: v + amount * Math.sin(u * Math.PI * 2) };
    } else if (kind === 'bulge') {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const factor = 1 + amount * (1 - Math.min(1, Math.hypot(dx * 2, dy * 2)));
        mapped = { x: 0.5 + dx * factor, y: 0.5 + dy * factor };
    } else if (kind === 'taper') {
        const factor = 1 + amount * (1 - 2 * v);
        mapped = { x: 0.5 + (u - 0.5) * factor, y: v };
    } else {
        mapped = { x: u, y: v };
    }
    if (!mapped || !Number.isFinite(mapped.x) || !Number.isFinite(mapped.y)) mapped = { x: u, y: v };
    return fromNormalized(mapped.x, mapped.y, safeBounds);
}

function placementValues(placement) {
    return {
        x: finite(placement?.x),
        y: finite(placement?.y),
        rotation: finite(placement?.rotation),
        scaleX: finite(placement?.scaleX, 1),
        scaleY: finite(placement?.scaleY, 1)
    };
}

/** Map a lettering-local point through placement (translation, rotation, scale). */
export function letteringLocalToWorld(point, placement) {
    const p = finitePoint(point);
    const t = placementValues(placement);
    const cos = Math.cos(t.rotation);
    const sin = Math.sin(t.rotation);
    return {
        x: t.x + cos * t.scaleX * p.x - sin * t.scaleY * p.y,
        y: t.y + sin * t.scaleX * p.x + cos * t.scaleY * p.y
    };
}

/** Inverse of letteringLocalToWorld. Singular placement returns null. */
export function letteringWorldToLocal(point, placement) {
    const p = finitePoint(point);
    const t = placementValues(placement);
    if (Math.abs(t.scaleX) <= EPSILON || Math.abs(t.scaleY) <= EPSILON) return null;
    const cos = Math.cos(t.rotation);
    const sin = Math.sin(t.rotation);
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    return {
        x: (cos * dx + sin * dy) / t.scaleX,
        y: (-sin * dx + cos * dy) / t.scaleY
    };
}

