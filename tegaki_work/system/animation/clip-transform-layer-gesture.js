/**
 * Layer Transform sessionの開始→現在差分を、現在Frameのsampled Clip transformへ
 * 合成するpure planner。source Layerの絶対transformやRasterは参照しない。
 *
 * Stage B1境界:
 * - Layer session / Clipは同じCanvas anchorを使う。
 * - Anchor editはFrame-local keyではないため拒否する。
 * - x / y / rotationは加算差分、scaleX / scaleYは符号を含む比率で合成する。
 * - opacity / blendはLayer Transform gestureの対象外なのでsampled Clip値を維持する。
 */

const EPSILON = 1e-8;

function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function normalizeLayerTransform(transform = {}) {
    return {
        x: finite(transform.x, 0),
        y: finite(transform.y, 0),
        scaleX: finite(transform.scaleX, 1),
        scaleY: finite(transform.scaleY, 1),
        rotation: finite(transform.rotation, 0),
        anchorX: finite(transform.anchorX, 0.5),
        anchorY: finite(transform.anchorY, 0.5)
    };
}

function normalizeClipTransform(transform = {}) {
    return {
        x: finite(transform.x, 0),
        y: finite(transform.y, 0),
        scaleX: finite(transform.scaleX, 1),
        scaleY: finite(transform.scaleY, 1),
        rotation: finite(transform.rotation, 0),
        opacity: finite(transform.opacity, 1),
        blendMode: typeof transform.blendMode === 'string' ? transform.blendMode : 'normal',
        blendStrength: finite(transform.blendStrength, 1),
        anchorX: finite(transform.anchorX, 0.5),
        anchorY: finite(transform.anchorY, 0.5)
    };
}

function nearlyEqual(left, right) {
    return Math.abs(left - right) <= EPSILON;
}

function sameEditableTransform(left, right) {
    return ['x', 'y', 'scaleX', 'scaleY', 'rotation']
        .every(name => nearlyEqual(left[name], right[name]));
}

export function planClipTransformFromLayerGesture({
    layerStart,
    layerCurrent,
    clipSample
} = {}) {
    if (!layerStart || !layerCurrent || !clipSample) {
        return { ok: false, changed: false, reason: 'transform-state-required' };
    }

    const start = normalizeLayerTransform(layerStart);
    const current = normalizeLayerTransform(layerCurrent);
    const clip = normalizeClipTransform(clipSample);
    if (!nearlyEqual(start.anchorX, current.anchorX)
        || !nearlyEqual(start.anchorY, current.anchorY)) {
        return { ok: false, changed: false, reason: 'anchor-edit-not-frame-local' };
    }
    if (!nearlyEqual(start.anchorX, clip.anchorX)
        || !nearlyEqual(start.anchorY, clip.anchorY)) {
        return { ok: false, changed: false, reason: 'anchor-context-mismatch' };
    }
    if (Math.abs(start.scaleX) <= EPSILON || Math.abs(start.scaleY) <= EPSILON) {
        return { ok: false, changed: false, reason: 'layer-start-scale-not-invertible' };
    }

    const delta = {
        x: current.x - start.x,
        y: current.y - start.y,
        scaleX: current.scaleX / start.scaleX,
        scaleY: current.scaleY / start.scaleY,
        rotation: current.rotation - start.rotation
    };
    if (Object.values(delta).some(value => !Number.isFinite(value))) {
        return { ok: false, changed: false, reason: 'gesture-delta-invalid' };
    }

    const transform = {
        ...clip,
        x: clip.x + delta.x,
        y: clip.y + delta.y,
        scaleX: clip.scaleX * delta.scaleX,
        scaleY: clip.scaleY * delta.scaleY,
        rotation: clip.rotation + delta.rotation
    };
    return {
        ok: true,
        changed: !sameEditableTransform(clip, transform),
        transform,
        delta
    };
}
