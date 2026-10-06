/**
 * ============================================================================
 * ファイル名: system/focus-flash-geometry.js
 * 責務: 新しい両端taperの密ウニを、決定的な純幾何として評価する。
 * 依存: なし（DOM / Pixi / Canvas / 既存集中線evaluatorを参照しない）
 * 被依存: focus-lines popup/overlay/raster の候補入口、verify-focus-flash.mjs
 * 保存: Project/Historyの正本ではない。呼び出し側がoptional recipeと画素を所有する。
 * 不変条件: polygonの両端は点、中央だけが幅を持つ。角度順を崩さず、入力の悪値でも有限値を返す。
 * ============================================================================
 */

const MIN_COUNT = 4;
const MAX_COUNT = 600;
const BOUNDARY_POINTS = 128;
const DEFAULT_COLOR = '#800000';
const DEFAULT_PAPER_COLOR = '#f1e2d8';
const MAX_DIMENSION = 10_000_000;
const EPSILON = 1e-9;

export const FOCUS_FLASH_LIMITS = Object.freeze({
    depth: { min: 0.05, max: 3, default: 0.45 },
    ellipseWidth: { min: 0.5, max: 60, default: 2 },
    count: { min: MIN_COUNT, max: MAX_COUNT },
    boundaryPoints: BOUNDARY_POINTS
});

const DEFAULT_FLASH = Object.freeze({
    kind: 'tapered',
    depth: 0.45,
    fill: 'none',
    paperColor: DEFAULT_PAPER_COLOR,
    ellipse: 'none',
    ellipseWidth: 2
});

function finiteNumber(value) {
    try {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    } catch {
        return null;
    }
}

function clamp(value, min, max, fallback) {
    const number = finiteNumber(value);
    if (number === null) return fallback;
    return Math.min(max, Math.max(min, number));
}

function clampOrDefault(value, min, max, fallback) {
    return value === null || value === undefined ? fallback : clamp(value, min, max, fallback);
}

function integer(value, fallback) {
    const number = finiteNumber(value);
    return number === null ? fallback : Math.trunc(number);
}

function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function safeDimension(value, fallback) {
    return value === null || value === undefined ? fallback : clamp(value, 1, MAX_DIMENSION, fallback);
}

function safeCanvas(canvas) {
    return {
        width: safeDimension(canvas?.width, 400),
        height: safeDimension(canvas?.height, 400)
    };
}

function safePoint(point, fallback) {
    const x = finiteNumber(point?.x);
    const y = finiteNumber(point?.y);
    return {
        x: x === null ? fallback.x : x,
        y: y === null ? fallback.y : y
    };
}

function normalizedSeed(value, fallback = 1) {
    const number = finiteNumber(value);
    return number === null ? fallback >>> 0 : Math.trunc(number) >>> 0;
}

/**
 * Normalize only the optional new flash recipe.  Legacy/other body kinds are
 * deliberately rejected so the caller can keep their old evaluator in charge.
 */
export function normalizeFocusFlash(raw) {
    if (!raw || typeof raw !== 'object' || raw.kind !== 'tapered') return null;

    const depth = clampOrDefault(raw.depth, FOCUS_FLASH_LIMITS.depth.min, FOCUS_FLASH_LIMITS.depth.max, DEFAULT_FLASH.depth);
    const ellipseWidth = clampOrDefault(raw.ellipseWidth, 0.5, 60, DEFAULT_FLASH.ellipseWidth);
    const fill = raw.fill === 'inside' || raw.fill === 'outside' ? raw.fill : 'none';
    const ellipse = raw.ellipse === 'fill' || raw.ellipse === 'outline' ? raw.ellipse : 'none';
    const paperColor = isHexColor(raw.paperColor)
        ? raw.paperColor
        : DEFAULT_FLASH.paperColor;

    return {
        kind: 'tapered',
        depth,
        fill,
        paperColor,
        ellipse,
        ellipseWidth
    };
}

function hash32(seed, index, stream) {
    let value = (seed ^ Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b) >>> 0;
    value ^= value >>> 16;
    return value >>> 0;
}

/** A random value tied to (seed,index,stream), so count edits do not reshuffle old indices. */
function randomFor(seed, index, stream) {
    return hash32(seed, index, stream) / 4294967296;
}

function pointOnEllipse(center, rx, ry, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const denom = Math.sqrt((c * c) / Math.max(rx * rx, EPSILON) + (s * s) / Math.max(ry * ry, EPSILON));
    const radius = 1 / Math.max(denom, EPSILON);
    return { x: center.x + c * radius, y: center.y + s * radius };
}

function tangentOnEllipse(angle) {
    // The ellipse point is reached along the center-to-angle radial.  Use the
    // exact perpendicular to that radial for the diamond width; the derivative
    // of an ellipse parameter would tilt the band on a non-circular opening.
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const length = Math.hypot(tangentX, tangentY) || 1;
    return { x: tangentX / length, y: tangentY / length };
}

function clampPoint(point, limit) {
    return {
        x: Math.min(limit, Math.max(-limit, finiteNumber(point.x) ?? 0)),
        y: Math.min(limit, Math.max(-limit, finiteNumber(point.y) ?? 0))
    };
}

function ellipsePoints(center, rx, ry, count, limit) {
    const points = [];
    for (let index = 0; index < count; index += 1) {
        points.push(clampPoint(
            pointOnEllipse(center, rx, ry, (Math.PI * 2 * index) / count),
            limit
        ));
    }
    return points;
}

function normalizedGeometryParams(params, canvas) {
    const { width, height } = safeCanvas(canvas);
    const shortCanvas = Math.min(width, height);
    const coordinateLimit = Math.max(16, Math.min(MAX_DIMENSION, Math.max(width, height) * 8));
    const centerFallback = { x: width / 2, y: height / 2 };
    const centerRaw = safePoint(params?.center, centerFallback);
    const center = {
        x: Math.min(coordinateLimit, Math.max(-coordinateLimit, centerRaw.x)),
        y: Math.min(coordinateLimit, Math.max(-coordinateLimit, centerRaw.y))
    };
    const radiusLimit = Math.max(1, Math.min(coordinateLimit / 2, Math.max(width, height) * 2));
    const defaultRadius = Math.max(1, shortCanvas * 0.29);
    const innerRx = clamp(params?.innerRx, 0.5, radiusLimit, defaultRadius);
    const innerRy = clamp(params?.innerRy, 0.5, radiusLimit, defaultRadius);
    const count = Math.min(MAX_COUNT, Math.max(MIN_COUNT, integer(params?.count, 150)));
    const defaultWidthMin = Math.max(0.5, shortCanvas / 100);
    const defaultWidthMax = Math.max(defaultWidthMin, shortCanvas / 50);
    const rawWidthMin = clamp(params?.widthMin, 0.25, Math.max(1, Math.max(width, height) * 0.5), defaultWidthMin);
    const rawWidthMax = clamp(params?.widthMax, 0.25, Math.max(1, Math.max(width, height) * 0.5), defaultWidthMax);
    const widthMin = Math.min(rawWidthMin, rawWidthMax);
    const widthMax = Math.max(rawWidthMin, rawWidthMax);
    const flash = normalizeFocusFlash(params?.flash) || { ...DEFAULT_FLASH };
    const color = isHexColor(params?.color) ? params.color : DEFAULT_COLOR;
    return {
        width,
        height,
        shortCanvas,
        coordinateLimit,
        center,
        innerRx,
        innerRy,
        count,
        widthMin,
        widthMax,
        angleJitter: clamp(params?.angleJitter, 0, 1, 0.35),
        lengthJitter: clamp(params?.lengthJitter, 0, 1, 0.25),
        seed: normalizedSeed(params?.seed),
        flash,
        color
    };
}

/**
 * Build the new tapered flash.  Each polygon is ordered as
 * [innerTip, middleLeft, outerTip, middleRight].
 */
export function buildFocusFlash(params, canvas = { width: 400, height: 400 }) {
    const p = normalizedGeometryParams(params, canvas);
    const { center, innerRx, innerRy, count, widthMin, widthMax, coordinateLimit } = p;
    const depthBand = Math.max(0.5, Math.min(
        coordinateLimit / 4,
        Math.min(innerRx, innerRy) * p.flash.depth
    ));
    const middleRx = Math.min(coordinateLimit / 2, innerRx + depthBand * 0.5);
    const middleRy = Math.min(coordinateLimit / 2, innerRy + depthBand * 0.5);
    const outerRx = Math.min(coordinateLimit / 2, innerRx + depthBand);
    const outerRy = Math.min(coordinateLimit / 2, innerRy + depthBand);
    const positiveTipGap = Math.max(0.25, depthBand * 0.05);
    const innerJitterAmplitude = depthBand * 0.3 * p.lengthJitter;
    const openingMargin = Math.max(
        0.5,
        widthMax * 0.75,
        innerJitterAmplitude + positiveTipGap
    );
    // Homothetic ellipse preserves the vertical/horizontal character. Since
    // each polar radius >= shortRadius, this scale retreats every direction
    // by at least openingMargin and stays below all possible inner endpoints.
    const openingScale = Math.max(0.001, 1 - openingMargin / Math.min(innerRx, innerRy));
    const openingRx = innerRx * openingScale;
    const openingRy = innerRy * openingScale;
    const step = (Math.PI * 2) / count;
    const polygons = [];
    const seedPhase = randomFor(p.seed, 0, 17) * Math.PI * 2;

    for (let index = 0; index < count; index += 1) {
        const baseAngle = (index + 0.5) * step;
        const angleOffset = (randomFor(p.seed, index, 0) - 0.5) * 2 * step * 0.35 * p.angleJitter;
        const angle = baseAngle + angleOffset;
        const innerBase = pointOnEllipse(center, innerRx, innerRy, angle);
        const middlePoint = pointOnEllipse(center, middleRx, middleRy, angle);
        const innerVectorX = innerBase.x - center.x;
        const innerVectorY = innerBase.y - center.y;
        const innerLength = Math.hypot(innerVectorX, innerVectorY) || 1;
        const middleLength = Math.hypot(middlePoint.x - center.x, middlePoint.y - center.y);
        const requestedInnerLength = innerLength +
            (randomFor(p.seed, index, 3) - 0.5) * 2 * innerJitterAmplitude;
        const safeInnerLength = Math.min(
            Math.max(0.05, requestedInnerLength),
            Math.max(0.05, middleLength - positiveTipGap)
        );
        const innerScale = safeInnerLength / innerLength;
        const innerTip = {
            x: center.x + innerVectorX * innerScale,
            y: center.y + innerVectorY * innerScale
        };
        const outerBase = pointOnEllipse(center, outerRx, outerRy, angle);
        const radialX = outerBase.x - center.x;
        const radialY = outerBase.y - center.y;
        const outerLength = Math.hypot(radialX, radialY) || 1;
        const requestedScale = 1 + (randomFor(p.seed, index, 1) - 0.5) * 0.26 * p.lengthJitter;
        const minimumScale = middleLength / outerLength + 0.004;
        const outerScale = Math.min(1.3, Math.max(requestedScale, minimumScale));
        const outerTip = {
            x: center.x + radialX * outerScale,
            y: center.y + radialY * outerScale
        };

        // A slow wave gives the fine/accent rhythm; the small indexed term keeps
        // neighboring strokes from becoming mechanically identical.
        const smoothAccent = 0.5 + 0.5 * Math.sin(seedPhase + index * 0.21);
        const fineVariation = randomFor(p.seed, index, 2);
        const widthMix = Math.min(1, Math.max(0, smoothAccent * 0.78 + fineVariation * 0.22));
        const thickness = widthMin + (widthMax - widthMin) * widthMix;
        const tangent = tangentOnEllipse(angle);
        const halfWidth = Math.min(thickness * 0.5, Math.max(0.25, depthBand * 0.45));
        const middleLeft = {
            x: middlePoint.x + tangent.x * halfWidth,
            y: middlePoint.y + tangent.y * halfWidth
        };
        const middleRight = {
            x: middlePoint.x - tangent.x * halfWidth,
            y: middlePoint.y - tangent.y * halfWidth
        };

        polygons.push([
            clampPoint(innerTip, coordinateLimit),
            clampPoint(middleLeft, coordinateLimit),
            clampPoint(outerTip, coordinateLimit),
            clampPoint(middleRight, coordinateLimit)
        ]);
    }

    const boundary = ellipsePoints(center, middleRx, middleRy, BOUNDARY_POINTS, coordinateLimit);
    const opening = ellipsePoints(center, openingRx, openingRy, BOUNDARY_POINTS, coordinateLimit);
    return {
        kind: 'tapered',
        polygons,
        boundary,
        opening,
        fill: p.flash.fill,
        paperColor: p.flash.paperColor,
        ellipse: p.flash.ellipse,
        ellipseWidth: p.flash.ellipseWidth,
        color: p.color
    };
}

