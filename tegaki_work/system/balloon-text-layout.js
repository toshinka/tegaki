/**
 * ============================================================================
 * ファイル名: system/balloon-text-layout.js
 * 責務: 吹き出し本体ごとの文字領域を相対値で扱い、初期化・ハンドル・
 *       本体内収まり/領域重なりを評価する純粋な組版補助。DOM / Pixi / Canvasを使わない。
 * 依存: system/balloon-geometry.js
 * 被依存: ui/balloon-popup.js, ui/balloon-overlay.js, system/balloon-raster.js
 * 保存: `text.frame` / `double.frame` は各本体rectに対するoptional相対値。
 *       本文、font、History、Rasterの正本は所有しない。
 * 検証: build/verify-balloon-text-layout.mjs
 * ============================================================================
 */

import {
    balloonTextArea,
    buildBalloonParts,
    normalizeBalloonParams,
    secondaryBalloonRect
} from './balloon-geometry.js';

const FRAME_XY_MIN = -2;
const FRAME_XY_MAX = 2;
const FRAME_SIZE_MIN = 0.02;
const FRAME_SIZE_MAX = 3;
const MAX_TEXT_BOXES = 8;
const RECT_SAMPLE_COUNT = 8;
const EPSILON = 1e-7;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function finiteRect(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const w = Number(raw.w);
    const h = Number(raw.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
    return { x, y, w, h };
}

function normalizeRelativeFrame(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const w = Number(raw.w);
    const h = Number(raw.h);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return {
        x: clamp(x, FRAME_XY_MIN, FRAME_XY_MAX),
        y: clamp(y, FRAME_XY_MIN, FRAME_XY_MAX),
        w: clamp(w, FRAME_SIZE_MIN, FRAME_SIZE_MAX),
        h: clamp(h, FRAME_SIZE_MIN, FRAME_SIZE_MAX)
    };
}

function bodyRectFor(params, index) {
    return params.shape === 'double' && index === 1
        ? secondaryBalloonRect(params)
        : params.rect;
}

function explicitFrameFor(params, index) {
    if (index === 1 && params.shape === 'double') return params.double?.frame || null;
    if (index === 0) return params.text?.frame || null;
    return null;
}

function frameToWorld(relative, bodyRect) {
    const x = bodyRect.x + relative.x * bodyRect.w;
    const y = bodyRect.y + relative.y * bodyRect.h;
    const w = relative.w * bodyRect.w;
    const h = relative.h * bodyRect.h;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function worldToFrame(worldRect, bodyRect) {
    if (!worldRect || !bodyRect || bodyRect.w <= 0 || bodyRect.h <= 0) return null;
    return normalizeRelativeFrame({
        x: (worldRect.x - bodyRect.x) / bodyRect.w,
        y: (worldRect.y - bodyRect.y) / bodyRect.h,
        w: worldRect.w / bodyRect.w,
        h: worldRect.h / bodyRect.h
    });
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w
        && a.x + a.w > b.x
        && a.y < b.y + b.h
        && a.y + a.h > b.y;
}

function axisRange(rect, axis) {
    const start = axis === 'x' ? rect.x : rect.y;
    const size = axis === 'x' ? rect.w : rect.h;
    return { start, end: start + size, size };
}

function axisCenter(rect, axis) {
    const range = axisRange(rect, axis);
    return (range.start + range.end) / 2;
}

function withAxisRange(rect, axis, start, end) {
    const next = axis === 'x'
        ? { ...rect, x: start, w: Math.max(EPSILON, end - start) }
        : { ...rect, y: start, h: Math.max(EPSILON, end - start) };
    return { ...next, cx: next.x + next.w / 2, cy: next.y + next.h / 2 };
}

/**
 * 二連の既定文字領域が重なる時だけ、中心の離れている方向へ各領域を縮める。
 * 元のsafe areaの中だけを使うので、本体移動/resizeと相対追従できる。
 */
function splitDoubleFrames(first, second, firstBody, secondBody) {
    if (!rectsOverlap(first, second)) return [first, second];
    const dx = Math.abs(first.cx - second.cx);
    const dy = Math.abs(first.cy - second.cy);
    const axis = dx >= dy ? 'x' : 'y';
    const entries = [
        { index: 0, rect: first, body: firstBody },
        { index: 1, rect: second, body: secondBody }
    ].sort((a, b) => axisCenter(a.rect, axis) - axisCenter(b.rect, axis));
    const left = entries[0];
    const right = entries[1];
    const leftRange = axisRange(left.rect, axis);
    const rightRange = axisRange(right.rect, axis);
    const leftMinimum = Math.max(EPSILON, Math.min(leftRange.size, left.body[axis === 'x' ? 'w' : 'h'] * FRAME_SIZE_MIN));
    const rightMinimum = Math.max(EPSILON, Math.min(rightRange.size, right.body[axis === 'x' ? 'w' : 'h'] * FRAME_SIZE_MIN));
    const desiredGap = Math.max(0.5, Math.min(2, Math.min(leftRange.size, rightRange.size) * 0.04));
    const available = Math.max(0, rightRange.end - leftRange.start - leftMinimum - rightMinimum);
    const gap = Math.min(desiredGap, available);
    const lower = leftRange.start + leftMinimum + gap / 2;
    const upper = rightRange.end - rightMinimum - gap / 2;
    const midpoint = (axisCenter(first, axis) + axisCenter(second, axis)) / 2;
    const split = lower <= upper ? clamp(midpoint, lower, upper) : (lower + upper) / 2;

    let leftEnd = Math.min(leftRange.end, split - gap / 2);
    let rightStart = Math.max(rightRange.start, split + gap / 2);
    if (leftEnd <= leftRange.start) leftEnd = Math.min(leftRange.end, leftRange.start + leftMinimum);
    if (rightStart >= rightRange.end) rightStart = Math.max(rightRange.start, rightRange.end - rightMinimum);

    // Degenerate, nearly coincident source rectangles still get positive bounded
    // areas. Normal saved frames clamp to FRAME_SIZE_MIN on the next sanitize.
    if (leftEnd >= rightStart) {
        const pivot = (leftRange.start + rightRange.end) / 2;
        leftEnd = Math.min(leftRange.end, Math.max(leftRange.start + EPSILON, pivot));
        rightStart = Math.max(rightRange.start, Math.min(rightRange.end - EPSILON, pivot));
        if (leftEnd >= rightStart) {
            leftEnd = Math.min(leftRange.end, leftRange.start + Math.max(EPSILON, leftRange.size * 0.25));
            rightStart = Math.max(rightRange.start, rightRange.end - Math.max(EPSILON, rightRange.size * 0.25));
        }
    }

    const output = [first, second];
    output[left.index] = withAxisRange(left.rect, axis, leftRange.start, Math.max(leftRange.start + EPSILON, leftEnd));
    output[right.index] = withAxisRange(right.rect, axis, Math.min(rightRange.end - EPSILON, rightStart), rightRange.end);
    return output;
}

function centeredScale(rect, scale) {
    const w = Math.max(EPSILON, rect.w * scale);
    const h = Math.max(EPSILON, rect.h * scale);
    return { x: rect.cx - w / 2, y: rect.cy - h / 2, w, h, cx: rect.cx, cy: rect.cy };
}

/** balloonTextAreaは形状ごとの目安なので、reset時だけbody内へ最大限保守的に縮める。 */
function safeCentralRect(body, area, margin) {
    if (rectInsideBody(body, area, margin)) return area;
    let low = 0;
    let high = 1;
    let best = 0;
    for (let i = 0; i < 24; i += 1) {
        const scale = (low + high) / 2;
        const candidate = centeredScale(area, scale);
        if (rectInsideBody(body, candidate, margin)) {
            best = scale;
            low = scale;
        } else {
            high = scale;
        }
    }
    return centeredScale(area, best > 0 ? best : FRAME_SIZE_MIN);
}

/** 文字領域。保存済みframeがあれば相対値をworldへ戻し、旧recipeは従来areaを返す。 */
export function balloonTextFrame(raw, canvas, index = 0) {
    const params = normalizeBalloonParams(raw, canvas);
    const relative = normalizeRelativeFrame(explicitFrameFor(params, index));
    if (!relative) return balloonTextArea(params, canvas, index);
    return frameToWorld(relative, bodyRectFor(params, index));
}

/** world矩形を本体rect相対のoptional frameへ変換する。入力paramsは変更しない。 */
export function setBalloonTextFrame(raw, canvas, index = 0, worldRect) {
    const params = normalizeBalloonParams(raw, canvas);
    const rect = finiteRect(worldRect);
    if (!rect || (index !== 0 && !(params.shape === 'double' && index === 1))) return params;
    const relative = worldToFrame(rect, bodyRectFor(params, index));
    if (!relative) return params;
    if (index === 1) params.double = { ...params.double, frame: relative };
    else params.text = { ...params.text, frame: relative };
    return params;
}

/** 現在の文字areaをframeとして保存する。二連は重なる時だけ中心間の主軸で分割する。 */
export function resetBalloonTextFrames(raw, canvas) {
    const params = normalizeBalloonParams(raw, canvas);
    const body = buildBalloonParts(params, canvas).body;
    const margin = params.lineWidth + 2;
    const firstArea = safeCentralRect(body, balloonTextArea(params, canvas, 0), margin);
    if (params.shape !== 'double') {
        params.text = { ...params.text, frame: worldToFrame(firstArea, params.rect) };
        return params;
    }
    const secondBody = secondaryBalloonRect(params);
    const secondArea = safeCentralRect(body, balloonTextArea(params, canvas, 1), margin);
    const [first, second] = splitDoubleFrames(firstArea, secondArea, params.rect, secondBody);
    params.text = { ...params.text, frame: worldToFrame(safeCentralRect(body, first, margin), params.rect) };
    params.double = { ...params.double, frame: worldToFrame(safeCentralRect(body, second, margin), secondBody) };
    return params;
}

/** 各本文frameの中心と4隅。配列順は本文①、本文②（doubleのみ）。 */
export function balloonTextFrameHandles(raw, canvas) {
    const params = normalizeBalloonParams(raw, canvas);
    const count = params.shape === 'double' ? 2 : 1;
    return Array.from({ length: count }, (_, index) => {
        const frame = balloonTextFrame(params, canvas, index);
        const { x, y, w, h } = frame;
        return {
            center: { x: x + w / 2, y: y + h / 2 },
            corners: {
                tl: { x, y },
                tr: { x: x + w, y },
                br: { x: x + w, y: y + h },
                bl: { x, y: y + h }
            }
        };
    });
}

function pointInPolygon(poly, point) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i];
        const b = poly[j];
        const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
        const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
        if (Math.abs(cross) <= EPSILON && dot <= EPSILON) return true;
        if ((a.y > point.y) !== (b.y > point.y)) {
            const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
            if (point.x < x) inside = !inside;
        }
    }
    return inside;
}

function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, p) {
    return Math.min(a.x, b.x) - EPSILON <= p.x && p.x <= Math.max(a.x, b.x) + EPSILON
        && Math.min(a.y, b.y) - EPSILON <= p.y && p.y <= Math.max(a.y, b.y) + EPSILON
        && Math.abs(orientation(a, b, p)) <= EPSILON;
}

function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
        && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) return true;
    return (Math.abs(o1) <= EPSILON && onSegment(a, b, c))
        || (Math.abs(o2) <= EPSILON && onSegment(a, b, d))
        || (Math.abs(o3) <= EPSILON && onSegment(c, d, a))
        || (Math.abs(o4) <= EPSILON && onSegment(c, d, b));
}

function distancePointToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON) return Math.hypot(point.x - a.x, point.y - a.y);
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function distanceToPolygon(point, poly) {
    let distance = Infinity;
    for (let i = 0; i < poly.length; i += 1) {
        distance = Math.min(distance, distancePointToSegment(point, poly[i], poly[(i + 1) % poly.length]));
    }
    return distance;
}

function rectCorners(rect) {
    return [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x + rect.w, y: rect.y + rect.h },
        { x: rect.x, y: rect.y + rect.h }
    ];
}

function rectEdges(rect) {
    const corners = rectCorners(rect);
    return corners.map((point, index) => [point, corners[(index + 1) % corners.length]]);
}

function pointInsideRect(point, rect) {
    return point.x > rect.x + EPSILON && point.x < rect.x + rect.w - EPSILON
        && point.y > rect.y + EPSILON && point.y < rect.y + rect.h - EPSILON;
}

/**
 * full rectangleをbody内へ収める。rectをmarginぶん膨らませ、角・辺交差・
 * 境界距離をすべて検査するため、customの局所的な凹みを外接矩形だけで見逃さない。
 */
function rectInsideBody(body, rect, margin) {
    const expanded = {
        x: rect.x - margin,
        y: rect.y - margin,
        w: rect.w + margin * 2,
        h: rect.h + margin * 2
    };
    if (!rectCorners(expanded).every(point => pointInPolygon(body, point))) return false;

    const edges = rectEdges(expanded);
    for (const [a, b] of edges) {
        for (let i = 0; i < body.length; i += 1) {
            if (segmentsIntersect(a, b, body[i], body[(i + 1) % body.length])) return false;
        }
    }
    for (const point of body) {
        if (pointInsideRect(point, expanded)) return false;
    }

    for (const [a, b] of rectEdges(rect)) {
        for (let sample = 0; sample <= RECT_SAMPLE_COUNT; sample += 1) {
            const t = sample / RECT_SAMPLE_COUNT;
            const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            if (!pointInPolygon(body, point) || distanceToPolygon(point, body) < margin - EPSILON) return false;
        }
    }
    return true;
}

/**
 * 確定前の文字boundsをbody polygonへ照合する。boxes=nullは未配置として空結果。
 * tailは意図的に無視し、overlapは正の面積だけを衝突とする。
 */
export function assessBalloonTextBounds(raw, canvas, boxes) {
    if (!Array.isArray(boxes)) return { outside: [], overlap: false };
    const params = normalizeBalloonParams(raw, canvas);
    const { body } = buildBalloonParts(params, canvas);
    const margin = params.lineWidth + 2;
    const valid = [];
    const outside = [];
    for (let index = 0; index < boxes.length; index += 1) {
        if (index >= MAX_TEXT_BOXES) {
            outside.push(index);
            continue;
        }
        if (boxes[index] == null) continue;
        const rect = finiteRect(boxes[index]);
        if (!rect || !rectInsideBody(body, rect, margin)) outside.push(index);
        if (rect) valid.push({ index, rect });
    }
    let overlap = false;
    for (let i = 0; i < valid.length && !overlap; i += 1) {
        for (let j = i + 1; j < valid.length; j += 1) {
            if (rectsOverlap(valid[i].rect, valid[j].rect)) {
                overlap = true;
                break;
            }
        }
    }
    return { outside, overlap };
}

