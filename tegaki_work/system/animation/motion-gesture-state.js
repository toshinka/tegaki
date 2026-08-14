const MOTION_TRANSFORM_NUMERIC_FIELDS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'opacity',
    'blendStrength',
    'rotation'
]);

export function areMotionTransformsEquivalent(left, right, epsilon = 1e-9) {
    if (!left || !right) return false;
    const tolerance = Number.isFinite(epsilon) && epsilon >= 0 ? epsilon : 1e-9;
    if ((left.blendMode || 'normal') !== (right.blendMode || 'normal')) return false;
    return MOTION_TRANSFORM_NUMERIC_FIELDS.every((field) => {
        const leftValue = Number(left[field]);
        const rightValue = Number(right[field]);
        return Number.isFinite(leftValue)
            && Number.isFinite(rightValue)
            && Math.abs(leftValue - rightValue) <= tolerance;
    });
}
