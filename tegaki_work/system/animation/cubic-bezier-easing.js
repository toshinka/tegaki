/**
 * Motion区間のcubic-bezier easingを純粋にsamplingする。
 * X controlは0..1、Y controlは明示Overshoot用の有限範囲だけを許可する。
 */

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 24;
const DERIVATIVE_EPSILON = 1e-7;
const SOLVE_EPSILON = 1e-7;
const SPLIT_SPAN_EPSILON = 1e-12;
const SPLIT_CONTROL_EPSILON = 1e-9;

export const CUBIC_BEZIER_OVERSHOOT_Y_MIN = -1;
export const CUBIC_BEZIER_OVERSHOOT_Y_MAX = 2;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function clampOvershootY(value) {
    return Math.max(CUBIC_BEZIER_OVERSHOOT_Y_MIN, Math.min(CUBIC_BEZIER_OVERSHOOT_Y_MAX, value));
}

function cubicCoordinate(t, first, second) {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * first
        + 3 * inverse * t * t * second
        + t * t * t;
}

function cubicDerivative(t, first, second) {
    const inverse = 1 - t;
    return 3 * inverse * inverse * first
        + 6 * inverse * t * (second - first)
        + 3 * t * t * (1 - second);
}

function interpolatePoint(left, right, ratio) {
    return {
        x: left.x + (right.x - left.x) * ratio,
        y: left.y + (right.y - left.y) * ratio
    };
}

export function normalizeCubicBezierEasing(easing) {
    if (easing?.type !== 'cubic-bezier') return null;
    const points = ['x1', 'y1', 'x2', 'y2'].map(name => Number(easing[name]));
    if (!points.every(Number.isFinite)) return null;
    const [rawX1, y1, rawX2, y2] = points;
    if (y1 < CUBIC_BEZIER_OVERSHOOT_Y_MIN || y1 > CUBIC_BEZIER_OVERSHOOT_Y_MAX
        || y2 < CUBIC_BEZIER_OVERSHOOT_Y_MIN || y2 > CUBIC_BEZIER_OVERSHOOT_Y_MAX) {
        return null;
    }
    const x1 = clamp01(rawX1);
    const x2 = clamp01(rawX2);
    return { type: 'cubic-bezier', x1, y1, x2, y2 };
}

export function solveCubicBezierParameter(ratio, easing) {
    const progress = clamp01(Number.isFinite(ratio) ? ratio : 0);
    const curve = normalizeCubicBezierEasing(easing);
    if (!curve) return { ok: false, reason: 'easing-invalid', progress };
    if (progress === 0 || progress === 1) {
        return { ok: true, curve, progress, parameter: progress };
    }

    let parameter = progress;
    for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration++) {
        const error = cubicCoordinate(parameter, curve.x1, curve.x2) - progress;
        if (Math.abs(error) <= SOLVE_EPSILON) {
            return { ok: true, curve, progress, parameter };
        }
        const derivative = cubicDerivative(parameter, curve.x1, curve.x2);
        if (Math.abs(derivative) < DERIVATIVE_EPSILON) break;
        const next = parameter - error / derivative;
        if (next < 0 || next > 1) break;
        parameter = next;
    }

    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration++) {
        parameter = (low + high) / 2;
        const x = cubicCoordinate(parameter, curve.x1, curve.x2);
        if (Math.abs(x - progress) <= SOLVE_EPSILON) break;
        if (x < progress) low = parameter;
        else high = parameter;
    }
    return { ok: true, curve, progress, parameter };
}

export function evaluateCubicBezierPoint(parameter, easing) {
    const curve = normalizeCubicBezierEasing(easing);
    if (!curve || !Number.isFinite(parameter)) return null;
    const t = clamp01(parameter);
    return {
        x: cubicCoordinate(t, curve.x1, curve.x2),
        y: cubicCoordinate(t, curve.y1, curve.y2)
    };
}

export function splitCubicBezierEasing(ratio, easing) {
    const progress = Number(ratio);
    if (!Number.isFinite(progress) || progress <= 0 || progress >= 1) {
        return { ok: false, reason: 'split-ratio-out-of-range' };
    }
    // samplerと同じparameter solveを共有し、挿入Frameの現行sample値を正確に維持する。
    const solved = solveCubicBezierParameter(progress, easing);
    if (!solved.ok) return solved;

    const { curve, parameter } = solved;
    const start = { x: 0, y: 0 };
    const control1 = { x: curve.x1, y: curve.y1 };
    const control2 = { x: curve.x2, y: curve.y2 };
    const end = { x: 1, y: 1 };
    const first = interpolatePoint(start, control1, parameter);
    const middle = interpolatePoint(control1, control2, parameter);
    const last = interpolatePoint(control2, end, parameter);
    const leftControl2 = interpolatePoint(first, middle, parameter);
    const rightControl1 = interpolatePoint(middle, last, parameter);
    const splitPoint = interpolatePoint(leftControl2, rightControl1, parameter);
    const leftTimeSpan = splitPoint.x;
    const rightTimeSpan = 1 - splitPoint.x;
    const leftValueSpan = splitPoint.y;
    const rightValueSpan = 1 - splitPoint.y;
    if (Math.min(leftTimeSpan, rightTimeSpan) <= SPLIT_SPAN_EPSILON
        || Math.min(Math.abs(leftValueSpan), Math.abs(rightValueSpan)) <= SPLIT_SPAN_EPSILON) {
        return { ok: false, reason: 'split-span-too-small' };
    }

    const controls = {
        leftX1: first.x / leftTimeSpan,
        leftY1: first.y / leftValueSpan,
        leftX2: leftControl2.x / leftTimeSpan,
        leftY2: leftControl2.y / leftValueSpan,
        rightX1: (rightControl1.x - splitPoint.x) / rightTimeSpan,
        rightY1: (rightControl1.y - splitPoint.y) / rightValueSpan,
        rightX2: (last.x - splitPoint.x) / rightTimeSpan,
        rightY2: (last.y - splitPoint.y) / rightValueSpan
    };
    if (Object.values(controls).some(value => !Number.isFinite(value))) {
        return { ok: false, reason: 'split-control-out-of-range' };
    }
    const xControls = [controls.leftX1, controls.leftX2, controls.rightX1, controls.rightX2];
    const yControls = [controls.leftY1, controls.leftY2, controls.rightY1, controls.rightY2];
    if (xControls.some(value => value < -SPLIT_CONTROL_EPSILON || value > 1 + SPLIT_CONTROL_EPSILON)
        || yControls.some(value => (
            value < CUBIC_BEZIER_OVERSHOOT_Y_MIN - SPLIT_CONTROL_EPSILON
            || value > CUBIC_BEZIER_OVERSHOOT_Y_MAX + SPLIT_CONTROL_EPSILON
        ))) {
        return { ok: false, reason: 'split-control-out-of-range' };
    }

    return {
        ok: true,
        ratio: progress,
        parameter,
        easedRatio: splitPoint.y,
        left: {
            type: 'cubic-bezier',
            x1: clamp01(controls.leftX1),
            y1: clampOvershootY(controls.leftY1),
            x2: clamp01(controls.leftX2),
            y2: clampOvershootY(controls.leftY2)
        },
        right: {
            type: 'cubic-bezier',
            x1: clamp01(controls.rightX1),
            y1: clampOvershootY(controls.rightY1),
            x2: clamp01(controls.rightX2),
            y2: clampOvershootY(controls.rightY2)
        }
    };
}

export function sampleRawEasingRatio(ratio, easing) {
    const progress = clamp01(Number.isFinite(ratio) ? ratio : 0);
    const solved = solveCubicBezierParameter(progress, easing);
    if (!solved.ok || progress === 0 || progress === 1) return progress;
    return cubicCoordinate(solved.parameter, solved.curve.y1, solved.curve.y2);
}

export function sampleEasingRatio(ratio, easing) {
    return clamp01(sampleRawEasingRatio(ratio, easing));
}
