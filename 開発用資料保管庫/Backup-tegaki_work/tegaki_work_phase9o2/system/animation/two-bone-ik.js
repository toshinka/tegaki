/**
 * Fixed-length, rotation-only 2-Bone IK authoring math.
 *
 * This module owns no Clip, Asset, DOM, History, or playback state. It returns
 * deterministic world angles and rotation deltas so an authoring adapter can
 * write the result through the existing rigMotion.boneTracks setter.
 * Segment lengths are measured from the evaluated root/joint/effector points;
 * the display-only Bone `length` field is intentionally not read here.
 */

export const TWO_BONE_IK_EPSILON = 1e-8;

function isFinitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle) {
    if (!Number.isFinite(angle)) return null;
    const fullTurn = Math.PI * 2;
    let normalized = angle % fullTurn;
    if (normalized > Math.PI) normalized -= fullTurn;
    if (normalized < -Math.PI) normalized += fullTurn;
    return normalized;
}

function createError(reason, details = {}) {
    return { ok: false, reason, ...details };
}

/**
 * Solve a fixed-length two-segment chain in world coordinates.
 *
 * `root -> joint -> effector` are the currently evaluated segment roots. The
 * returned `rootRotationDelta` is applied to the first solver Bone, while
 * `jointRotationDelta` is the second Bone's local delta after that root delta.
 * `bendSign` is +1 for the positive side of the target vector and -1 for the
 * opposite side. Unreachable targets are clamped without changing lengths.
 */
export function solveFixedLengthTwoBoneIk(options = {}) {
    const root = options.root;
    const joint = options.joint;
    const effector = options.effector;
    const target = options.target;
    const epsilon = Number.isFinite(options.epsilon) && options.epsilon > 0
        ? options.epsilon
        : TWO_BONE_IK_EPSILON;
    const bendSign = options.bendSign;

    if (![root, joint, effector, target].every(isFinitePoint)) {
        return createError('non-finite-point');
    }
    if (bendSign !== -1 && bendSign !== 1) {
        return createError('invalid-bend-sign');
    }

    const lengthA = distance(root, joint);
    const lengthB = distance(joint, effector);
    if (lengthA <= epsilon || lengthB <= epsilon) {
        return createError('zero-length-segment', { lengthA, lengthB });
    }

    const targetDistance = distance(root, target);
    if (targetDistance <= epsilon) {
        return createError('target-at-root', { lengthA, lengthB });
    }

    const currentRootAngle = Math.atan2(joint.y - root.y, joint.x - root.x);
    const currentJointAngle = Math.atan2(effector.y - joint.y, effector.x - joint.x);
    const targetAngle = Math.atan2(target.y - root.y, target.x - root.x);
    const minimumReach = Math.abs(lengthA - lengthB);
    const maximumReach = lengthA + lengthB;
    const clampedDistance = clamp(targetDistance, minimumReach, maximumReach);
    const clampedTarget = {
        x: root.x + Math.cos(targetAngle) * clampedDistance,
        y: root.y + Math.sin(targetAngle) * clampedDistance
    };

    const rootCosine = clamp(
        (clampedDistance ** 2 + lengthA ** 2 - lengthB ** 2)
            / (2 * clampedDistance * lengthA),
        -1,
        1
    );
    const jointCosine = clamp(
        (clampedDistance ** 2 + lengthB ** 2 - lengthA ** 2)
            / (2 * clampedDistance * lengthB),
        -1,
        1
    );
    const desiredRootAngle = targetAngle - bendSign * Math.acos(rootCosine);
    const desiredJointAngle = targetAngle + bendSign * Math.acos(jointCosine);
    const desiredRootDelta = normalizeAngle(desiredRootAngle - currentRootAngle);
    const desiredJointWorldDelta = normalizeAngle(desiredJointAngle - currentJointAngle);
    if (desiredRootDelta == null || desiredJointWorldDelta == null) {
        return createError('non-finite-solution');
    }

    return {
        ok: true,
        bendSign,
        root: { x: root.x, y: root.y },
        joint: { x: joint.x, y: joint.y },
        effector: { x: effector.x, y: effector.y },
        target: { x: target.x, y: target.y },
        clampedTarget,
        lengthA,
        lengthB,
        targetDistance,
        clampedDistance,
        minimumReach,
        maximumReach,
        currentRootAngle,
        currentJointAngle,
        desiredRootAngle: normalizeAngle(desiredRootAngle),
        desiredJointAngle: normalizeAngle(desiredJointAngle),
        rootRotationDelta: desiredRootDelta,
        jointRotationDelta: normalizeAngle(desiredJointWorldDelta - desiredRootDelta)
    };
}
