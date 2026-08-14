import {
    CUBIC_BEZIER_OVERSHOOT_Y_MAX,
    CUBIC_BEZIER_OVERSHOOT_Y_MIN,
    normalizeCubicBezierEasing
} from './cubic-bezier-easing.js';

const LINEAR_CURVE = Object.freeze({
    type: 'cubic-bezier',
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 1
});

export function clampEasingCurveCoordinate(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
}

function resolveCurveYRange(bounds = {}) {
    const rawMin = Number(bounds.yMin);
    const rawMax = Number(bounds.yMax);
    const yMin = Number.isFinite(rawMin) ? rawMin : 0;
    const yMax = Number.isFinite(rawMax) && rawMax > yMin ? rawMax : 1;
    return { yMin, yMax, span: yMax - yMin };
}

function clampEasingCurveY(value, bounds = {}) {
    const { yMin, yMax } = resolveCurveYRange(bounds);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return yMin;
    return Math.max(yMin, Math.min(yMax, numeric));
}

export function getEasingCurveYRange(allowOvershoot = false) {
    return allowOvershoot === true
        ? { yMin: CUBIC_BEZIER_OVERSHOOT_Y_MIN, yMax: CUBIC_BEZIER_OVERSHOOT_Y_MAX }
        : { yMin: 0, yMax: 1 };
}

export function isEasingCurveOvershoot(easing) {
    const curve = normalizeCubicBezierEasing(easing);
    return !!curve && (curve.y1 < 0 || curve.y1 > 1 || curve.y2 < 0 || curve.y2 > 1);
}

export function normalizeEditableEasingCurve(easing, { allowOvershoot = false } = {}) {
    if (easing?.type !== 'cubic-bezier') return null;
    const values = ['x1', 'y1', 'x2', 'y2'].map(name => Number(easing[name]));
    if (!values.every(Number.isFinite)) return null;
    const [x1, y1, x2, y2] = values;
    const range = getEasingCurveYRange(allowOvershoot);
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1
        || y1 < range.yMin || y1 > range.yMax
        || y2 < range.yMin || y2 > range.yMax) return null;
    return normalizeCubicBezierEasing({ type: 'cubic-bezier', x1, y1, x2, y2 });
}

export function resolveEditableEasingCurve(easing) {
    return normalizeCubicBezierEasing(easing) || { ...LINEAR_CURVE };
}

export function curvePointToGraphPoint(point, bounds = {}) {
    const width = Math.max(1, Number(bounds.width) || 1);
    const height = Math.max(1, Number(bounds.height) || 1);
    const padding = Math.max(0, Number(bounds.padding) || 0);
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    const { yMin, span } = resolveCurveYRange(bounds);
    return {
        x: padding + clampEasingCurveCoordinate(point?.x) * innerWidth,
        y: padding + (1 - (clampEasingCurveY(point?.y, bounds) - yMin) / span) * innerHeight
    };
}

export function graphPointToCurvePoint(point, bounds = {}) {
    const width = Math.max(1, Number(bounds.width) || 1);
    const height = Math.max(1, Number(bounds.height) || 1);
    const padding = Math.max(0, Number(bounds.padding) || 0);
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    const { yMin, span } = resolveCurveYRange(bounds);
    return {
        x: clampEasingCurveCoordinate((Number(point?.x) - padding) / innerWidth),
        y: clampEasingCurveY(
            yMin + (1 - (Number(point?.y) - padding) / innerHeight) * span,
            bounds
        )
    };
}

export function getEasingCurveEditAvailability({ key, localFrame, duration, isPlaying } = {}) {
    if (!key) return { editable: false, reason: '現在Frameにmotion keyがありません' };
    if (key.interpolation === 'hold') return { editable: false, reason: 'HOLD区間はcurveを編集できません' };
    if (!Number.isFinite(localFrame) || !Number.isFinite(duration) || localFrame >= duration - 1) {
        return { editable: false, reason: '終端keyには右側の補間区間がありません' };
    }
    if (isPlaying) return { editable: false, reason: '再生中はcurveを確認のみできます' };
    return { editable: true, reason: '左keyから次keyまでのEasing Curveを編集' };
}
