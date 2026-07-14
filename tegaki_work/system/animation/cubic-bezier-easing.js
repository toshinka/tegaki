/**
 * Motion区間のcubic-bezier easingを純粋にsamplingする。
 * Phase 5z5の初期契約ではcontrol pointを0..1へ制限し、欠損・不正値はlinearへ戻す。
 */

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 24;
const DERIVATIVE_EPSILON = 1e-7;
const SOLVE_EPSILON = 1e-7;

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
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

export function normalizeCubicBezierEasing(easing) {
    if (easing?.type !== 'cubic-bezier') return null;
    const points = ['x1', 'y1', 'x2', 'y2'].map(name => Number(easing[name]));
    if (!points.every(Number.isFinite)) return null;
    const [x1, y1, x2, y2] = points.map(clamp01);
    return { type: 'cubic-bezier', x1, y1, x2, y2 };
}

export function sampleEasingRatio(ratio, easing) {
    const progress = clamp01(Number.isFinite(ratio) ? ratio : 0);
    const curve = normalizeCubicBezierEasing(easing);
    if (!curve || progress === 0 || progress === 1) return progress;

    let parameter = progress;
    for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration++) {
        const error = cubicCoordinate(parameter, curve.x1, curve.x2) - progress;
        if (Math.abs(error) <= SOLVE_EPSILON) {
            return clamp01(cubicCoordinate(parameter, curve.y1, curve.y2));
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
    return clamp01(cubicCoordinate(parameter, curve.y1, curve.y2));
}
