/**
 * ============================================================================
 * ファイル名: system/animation/layer-warp-edit-transaction.js
 * 責務: Layer Transform WARPのANIMATE transactionをpureに計画する
 * 依存: transform-edit-context.js, clip-deformer.js, control-mesh-deformer.js
 * 被依存: AnimationTablePopup、verifier、後続Simple 4x4 controller
 * Authority境界:
 * - active CAF internal Raster一枚のClipInstance.layerDeformersだけを対象にする。
 * - entry candidate / point previewを返すだけで、Model、History、Pixi、DOMを変更しない。
 * - root / Folder WARP、SOURCE Raster bake、RIG Mesh / Skinを暗黙retargetしない。
 * ============================================================================
 */

import { normalizeClipDeformer, sampleClipDeformer } from './clip-deformer.js';
import { createRectControlMeshDeformer } from './control-mesh-deformer.js';
import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} from './transform-edit-context.js';

export const LAYER_WARP_GRID_COLUMNS = 4;
export const LAYER_WARP_GRID_ROWS = 4;

export const LAYER_WARP_TRANSACTION_ACTION = Object.freeze({
    PREVIEW: 'preview-layer-warp-key',
    PREVIEW_NOOP: 'preview-layer-warp-noop',
    COMMIT: 'commit-layer-warp-history',
    ROLLBACK: 'rollback-layer-warp-preview',
    CLOSE_NOOP: 'close-layer-warp-noop',
    BLOCK: 'block'
});

export const LAYER_WARP_TRANSACTION_INTENT = Object.freeze({
    CONFIRM: 'confirm',
    CANCEL: 'cancel'
});

const EPSILON = 1e-8;

function blocked(reason, overrides = {}) {
    return {
        ok: false,
        blocked: true,
        action: LAYER_WARP_TRANSACTION_ACTION.BLOCK,
        reason,
        ...overrides
    };
}

function normalizeBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') return null;
    const x = Number(bounds.x);
    const y = Number(bounds.y);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return null;
    }
    return { x, y, width, height };
}

function clonePoints(points) {
    return Array.isArray(points) ? points.map(point => ({ x: point.x, y: point.y })) : [];
}

function pointsEqual(left, right) {
    return Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((point, index) => (
            Math.abs(point.x - right[index].x) <= EPSILON
            && Math.abs(point.y - right[index].y) <= EPSILON
        ));
}

function isAnimateLayerContext(context, transaction = null) {
    if (!context || typeof context !== 'object') return false;
    const animateMode = context.mode === TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY
        || context.mode === TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED;
    return animateMode
        && context.authority === TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY
        && context.writable === true
        && (!transaction
            || (context.clipId === transaction.clipId
                && context.timelineFrame === transaction.timelineFrame
                && context.localFrame === transaction.localFrame
                && context.internalLayerId === transaction.internalLayerId));
}

function createCandidate(existingDeformer, sourceBounds) {
    const existing = normalizeClipDeformer(existingDeformer);
    if (existing) return existing;
    return createRectControlMeshDeformer({
        columns: LAYER_WARP_GRID_COLUMNS,
        rows: LAYER_WARP_GRID_ROWS,
        bindBounds: sourceBounds
    });
}

function isSimpleGrid(deformer) {
    return deformer?.type === 'control-mesh'
        && deformer.columns === LAYER_WARP_GRID_COLUMNS
        && deformer.rows === LAYER_WARP_GRID_ROWS
        && deformer.bindPoints?.length === LAYER_WARP_GRID_COLUMNS * LAYER_WARP_GRID_ROWS;
}

function upsertPointKey(deformer, localFrame, points) {
    const existingIndex = deformer.keyframes.findLastIndex(key => key?.frame === localFrame);
    const existing = existingIndex >= 0 ? deformer.keyframes[existingIndex] : null;
    const keyframes = deformer.keyframes
        .filter(key => key?.frame !== localFrame)
        .map(key => structuredClone(key));
    keyframes.push({
        frame: localFrame,
        interpolation: existing?.interpolation === 'hold' ? 'hold' : 'linear',
        points: clonePoints(points),
        ...(existing?.placement ? { placement: { ...existing.placement } } : {})
    });
    keyframes.sort((left, right) => left.frame - right.frame);
    return normalizeClipDeformer({
        ...deformer,
        keyframes
    });
}

export function planLayerWarpEditTransactionStart({
    context,
    layerId,
    internalLayerId,
    sourceBounds,
    existingDeformer = null,
    duration,
    activeTransaction = null
} = {}) {
    if (activeTransaction) return blocked('layer-warp-transaction-active');
    if (!layerId) return blocked('layer-target-required');
    if (!isAnimateLayerContext(context)) return blocked(context?.reason || 'animate-layer-context-required');
    if (!internalLayerId || internalLayerId !== context.internalLayerId) {
        return blocked('internal-layer-target-required');
    }
    if (!Number.isInteger(duration) || duration <= 1) return blocked('animated-duration-required');
    const bounds = normalizeBounds(sourceBounds);
    if (!bounds) return blocked('layer-raster-bounds-required');

    const candidate = createCandidate(existingDeformer, bounds);
    if (!candidate) return blocked('layer-warp-candidate-required');
    if (!isSimpleGrid(candidate)) return blocked('advanced-layer-warp-required');
    const sampled = sampleClipDeformer(candidate, context.localFrame, duration);
    if (!sampled || !Array.isArray(sampled.points)) return blocked('layer-warp-sample-required');

    return {
        ok: true,
        blocked: false,
        kind: 'layer-warp-edit-transaction',
        layerId,
        clipId: context.clipId,
        internalLayerId,
        timelineFrame: context.timelineFrame,
        localFrame: context.localFrame,
        duration,
        sourceBounds: bounds,
        bindBounds: candidate.bindBounds ? { ...candidate.bindBounds } : { ...bounds },
        baselineDeformer: normalizeClipDeformer(existingDeformer),
        candidateDeformer: candidate,
        baselinePoints: clonePoints(sampled.points),
        hadExplicitKey: candidate.keyframes.some(key => key?.frame === context.localFrame),
        historyOwner: 'timeline',
        baselinePolicy: 'runtime-candidate-until-first-change'
    };
}

export function planLayerWarpEditTransactionPreview({ transaction, context, points } = {}) {
    if (!transaction || transaction.kind !== 'layer-warp-edit-transaction') {
        return blocked('layer-warp-transaction-required');
    }
    if (!isAnimateLayerContext(context, transaction)) return blocked('edit-context-changed');
    const nextPoints = clonePoints(points);
    if (nextPoints.length !== transaction.baselinePoints.length
        || nextPoints.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
        return blocked('layer-warp-points-invalid');
    }
    const changed = !pointsEqual(transaction.baselinePoints, nextPoints);
    if (!changed) {
        return {
            ok: true,
            blocked: false,
            action: LAYER_WARP_TRANSACTION_ACTION.PREVIEW_NOOP,
            changed: false,
            deformer: transaction.baselineDeformer
        };
    }
    const deformer = upsertPointKey(
        transaction.candidateDeformer,
        transaction.localFrame,
        nextPoints
    );
    if (!deformer) return blocked('layer-warp-key-invalid');
    return {
        ok: true,
        blocked: false,
        action: LAYER_WARP_TRANSACTION_ACTION.PREVIEW,
        changed: true,
        deformer
    };
}

export function planLayerWarpEditTransactionFinish({
    transaction,
    context,
    intent = LAYER_WARP_TRANSACTION_INTENT.CONFIRM,
    changed = false,
    previewApplied = false
} = {}) {
    if (!transaction || transaction.kind !== 'layer-warp-edit-transaction') {
        return blocked('layer-warp-transaction-required');
    }
    const validContext = isAnimateLayerContext(context, transaction);
    if (intent === LAYER_WARP_TRANSACTION_INTENT.CANCEL || !validContext) {
        return {
            ok: validContext || intent === LAYER_WARP_TRANSACTION_INTENT.CANCEL,
            blocked: !validContext && intent !== LAYER_WARP_TRANSACTION_INTENT.CANCEL,
            action: LAYER_WARP_TRANSACTION_ACTION.ROLLBACK,
            commit: false,
            terminal: true,
            reason: validContext ? 'cancelled' : 'edit-context-changed'
        };
    }
    if (changed !== true) {
        return {
            ok: true,
            blocked: false,
            action: previewApplied
                ? LAYER_WARP_TRANSACTION_ACTION.ROLLBACK
                : LAYER_WARP_TRANSACTION_ACTION.CLOSE_NOOP,
            commit: false,
            terminal: true,
            reason: previewApplied ? 'returned-to-start' : 'no-change'
        };
    }
    if (previewApplied !== true) {
        return blocked('layer-warp-preview-required', {
            rollback: LAYER_WARP_TRANSACTION_ACTION.ROLLBACK
        });
    }
    return {
        ok: true,
        blocked: false,
        action: LAYER_WARP_TRANSACTION_ACTION.COMMIT,
        commit: true,
        terminal: true,
        historyOwner: 'timeline',
        reason: null
    };
}
