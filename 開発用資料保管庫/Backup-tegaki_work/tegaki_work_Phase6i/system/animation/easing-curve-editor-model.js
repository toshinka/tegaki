import { normalizeCubicBezierEasing } from './cubic-bezier-easing.js';

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

export function resolveEditableEasingCurve(easing) {
    return normalizeCubicBezierEasing(easing) || { ...LINEAR_CURVE };
}

export function curvePointToGraphPoint(point, bounds = {}) {
    const width = Math.max(1, Number(bounds.width) || 1);
    const height = Math.max(1, Number(bounds.height) || 1);
    const padding = Math.max(0, Number(bounds.padding) || 0);
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    return {
        x: padding + clampEasingCurveCoordinate(point?.x) * innerWidth,
        y: padding + (1 - clampEasingCurveCoordinate(point?.y)) * innerHeight
    };
}

export function graphPointToCurvePoint(point, bounds = {}) {
    const width = Math.max(1, Number(bounds.width) || 1);
    const height = Math.max(1, Number(bounds.height) || 1);
    const padding = Math.max(0, Number(bounds.padding) || 0);
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    return {
        x: clampEasingCurveCoordinate((Number(point?.x) - padding) / innerWidth),
        y: clampEasingCurveCoordinate(1 - (Number(point?.y) - padding) / innerHeight)
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
