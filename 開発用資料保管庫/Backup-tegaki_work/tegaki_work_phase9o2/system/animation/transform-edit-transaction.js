/**
 * Layer Transform bridgeのtransaction所有とpure preview payloadを決める。
 *
 * 責務:
 * - SOURCEはLayerSystem、ANIMATEはAnimationTablePopupへ所有を一意にrouteする。
 * - ANIMATE previewをLayer gesture delta → sampled Clip transform →既存key upsertの
 *   一経路で計画する。
 * - confirm / cancel / context invalidation時に、どのownerがBake / History / rollbackを
 *   行うかを返す。
 *
 * 境界:
 * - Model、History、working Layer、Raster、EventBus、DOMを変更しない。
 * - ANIMATE READYへの入場だけではbaseline keyを作らない。
 * - transaction開始後にClip / Frame / authorityが変わった場合はretargetせずrollbackする。
 */

import {
    TRANSFORM_EDIT_AUTHORITY,
    TRANSFORM_EDIT_CONTEXT_MODE
} from './transform-edit-context.js';
import { planClipTransformFromLayerGesture } from './clip-transform-layer-gesture.js';
import { planClipTransformKeyUpsert } from './clip-transform-key-upsert.js';

export const TRANSFORM_EDIT_TRANSACTION_OWNER = Object.freeze({
    LAYER_SYSTEM: 'layer-system',
    ANIMATION_TABLE: 'animation-table',
    NONE: 'none'
});

export const TRANSFORM_EDIT_TRANSACTION_TARGET = Object.freeze({
    LAYER_SOURCE: 'layer-source',
    CLIP_TRANSFORM_KEY: 'clip-transform-key',
    NONE: 'none'
});

export const TRANSFORM_EDIT_TRANSACTION_ACTION = Object.freeze({
    PREVIEW_SOURCE: 'preview-source',
    PREVIEW_ANIMATE: 'preview-animate-key',
    PREVIEW_ANIMATE_NOOP: 'preview-animate-noop',
    CONFIRM_SOURCE: 'confirm-source-bake',
    COMMIT_ANIMATE: 'commit-timeline-history',
    ROLLBACK_SOURCE: 'rollback-source-preview',
    ROLLBACK_ANIMATE: 'rollback-timeline-preview',
    CLOSE_SOURCE_NOOP: 'close-source-noop',
    CLOSE_ANIMATE_NOOP: 'close-animate-noop',
    BLOCK: 'block'
});

export const TRANSFORM_EDIT_TRANSACTION_INTENT = Object.freeze({
    CONFIRM: 'confirm',
    CANCEL: 'cancel'
});

const ANIMATE_MODES = new Set([
    TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
    TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED
]);
const EDITABLE_TRANSFORM_FIELDS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation',
    'anchorX',
    'anchorY'
]);
const COMPLETE_CLIP_TRANSFORM_FIELDS = Object.freeze([
    'x',
    'y',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
    'blendStrength',
    'anchorX',
    'anchorY'
]);
const EPSILON = 1e-8;

function blocked(reason, overrides = {}) {
    return {
        ok: false,
        blocked: true,
        action: TRANSFORM_EDIT_TRANSACTION_ACTION.BLOCK,
        reason,
        ...overrides
    };
}

function cloneKeyframes(keyframes) {
    return (Array.isArray(keyframes) ? keyframes : []).map(key => ({
        ...key,
        ...(key?.easing ? { easing: { ...key.easing } } : {})
    }));
}

function hasLayerTransformChange(start, current) {
    if (!start || !current) return false;
    return EDITABLE_TRANSFORM_FIELDS.some(field => {
        const fallback = field.startsWith('scale') ? 1 : (field.startsWith('anchor') ? 0.5 : 0);
        const left = Number.isFinite(start[field]) ? start[field] : fallback;
        const right = Number.isFinite(current[field]) ? current[field] : fallback;
        return Math.abs(left - right) > EPSILON;
    });
}

function rollbackActionFor(transaction) {
    return transaction?.owner === TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE
        ? TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE
        : TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_SOURCE;
}

/**
 * V session開始時のowner / target / immutable target identityを固定する。
 */
export function planTransformEditTransactionStart({
    context,
    layerId,
    activeTransaction = null,
    clipSample = null,
    keyframes = [],
    duration = null
} = {}) {
    if (activeTransaction) return blocked('transform-transaction-active');
    if (!context || typeof context !== 'object') return blocked('edit-context-required');
    if (!layerId) return blocked('layer-target-required');

    if (context.mode === TRANSFORM_EDIT_CONTEXT_MODE.SOURCE
        && context.authority === TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE
        && context.writable === true) {
        return {
            ok: true,
            blocked: false,
            owner: TRANSFORM_EDIT_TRANSACTION_OWNER.LAYER_SYSTEM,
            target: TRANSFORM_EDIT_TRANSACTION_TARGET.LAYER_SOURCE,
            layerId,
            clipId: null,
            timelineFrame: Number.isInteger(context.timelineFrame) ? context.timelineFrame : null,
            localFrame: null,
            entryMode: context.mode,
            hadExplicitKey: false,
            baselinePolicy: 'not-applicable',
            historyOwner: 'layer-source'
        };
    }

    if (ANIMATE_MODES.has(context.mode)
        && context.authority === TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY
        && context.writable === true) {
        if (!context.clipId) return blocked('clip-target-required');
        if (!Number.isInteger(context.timelineFrame) || !Number.isInteger(context.localFrame)) {
            return blocked('clip-frame-target-required');
        }
        if (!Number.isInteger(duration) || duration <= 1) {
            return blocked('animated-duration-required');
        }
        if (!clipSample
            || COMPLETE_CLIP_TRANSFORM_FIELDS.some(field => !Number.isFinite(clipSample[field]))
            || typeof clipSample.blendMode !== 'string') {
            return blocked('clip-transform-baseline-required');
        }
        return {
            ok: true,
            blocked: false,
            owner: TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE,
            target: TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_TRANSFORM_KEY,
            layerId,
            clipId: context.clipId,
            timelineFrame: context.timelineFrame,
            localFrame: context.localFrame,
            entryMode: context.mode,
            hadExplicitKey: context.hasExplicitKey === true,
            baselinePolicy: 'implicit-sampler-until-first-change',
            historyOwner: 'timeline',
            duration,
            baselineTransform: { ...clipSample },
            baselineKeyframes: cloneKeyframes(keyframes)
        };
    }

    return blocked(context.reason || 'edit-context-blocked');
}

/**
 * session中のContext変化を検出する。READY→KEYEDは同じFrameへのpreview key生成で
 * 起き得るため許可するが、owner / Clip / Timeline Frameのretargetは拒否する。
 */
export function validateTransformEditTransactionContext(transaction, context) {
    if (!transaction?.ok || transaction.blocked) {
        return { ok: false, reason: 'transform-transaction-required' };
    }
    if (!context || typeof context !== 'object') {
        return { ok: false, reason: 'edit-context-required' };
    }

    if (transaction.owner === TRANSFORM_EDIT_TRANSACTION_OWNER.LAYER_SYSTEM) {
        const valid = context.mode === TRANSFORM_EDIT_CONTEXT_MODE.SOURCE
            && context.authority === TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE
            && context.writable === true;
        return valid
            ? { ok: true, reason: null }
            : { ok: false, reason: 'edit-context-changed' };
    }

    if (transaction.owner !== TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE) {
        return { ok: false, reason: 'transform-owner-invalid' };
    }
    if (!ANIMATE_MODES.has(context.mode)
        || context.authority !== TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY
        || context.writable !== true) {
        return { ok: false, reason: 'edit-context-changed' };
    }
    if (context.clipId !== transaction.clipId) {
        return { ok: false, reason: 'clip-target-changed' };
    }
    if (context.timelineFrame !== transaction.timelineFrame
        || context.localFrame !== transaction.localFrame) {
        return { ok: false, reason: 'frame-target-changed' };
    }
    return { ok: true, reason: null };
}

/**
 * pointer / slider / shortcut previewのpure payloadを作る。
 * SOURCEはLayerSystemへ戻し、ANIMATEだけB1→B0の順でkeyframes候補を返す。
 */
export function planTransformEditTransactionPreview({
    transaction,
    context,
    layerStart,
    layerCurrent
} = {}) {
    const validation = validateTransformEditTransactionContext(transaction, context);
    if (!validation.ok) return blocked(validation.reason, { rollback: rollbackActionFor(transaction) });

    if (transaction.owner === TRANSFORM_EDIT_TRANSACTION_OWNER.LAYER_SYSTEM) {
        return {
            ok: true,
            blocked: false,
            action: TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_SOURCE,
            owner: transaction.owner,
            changed: hasLayerTransformChange(layerStart, layerCurrent)
        };
    }

    const gesturePlan = planClipTransformFromLayerGesture({
        layerStart,
        layerCurrent,
        clipSample: transaction.baselineTransform
    });
    if (!gesturePlan.ok) {
        return blocked(gesturePlan.reason, {
            rollback: TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE
        });
    }
    if (!gesturePlan.changed) {
        return {
            ok: true,
            blocked: false,
            action: TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_ANIMATE_NOOP,
            owner: transaction.owner,
            changed: false,
            transform: { ...gesturePlan.transform },
            keyframes: cloneKeyframes(transaction.baselineKeyframes)
        };
    }

    const upsertPlan = planClipTransformKeyUpsert({
        keyframes: transaction.baselineKeyframes,
        frame: transaction.localFrame,
        duration: transaction.duration,
        transform: gesturePlan.transform
    });
    if (!upsertPlan.ok) {
        return blocked(upsertPlan.reason, {
            rollback: TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE
        });
    }
    return {
        ok: true,
        blocked: false,
        action: TRANSFORM_EDIT_TRANSACTION_ACTION.PREVIEW_ANIMATE,
        owner: transaction.owner,
        changed: upsertPlan.changed,
        transform: { ...gesturePlan.transform },
        keyframes: upsertPlan.keyframes,
        key: upsertPlan.key,
        replaced: upsertPlan.replaced,
        delta: { ...gesturePlan.delta }
    };
}

/**
 * V toggle /明示confirmまたはEscape cancel時のterminal actionを返す。
 * handle pointercancelはLayer Transformがgesture開始値へ戻し、session自体は閉じない。
 */
export function planTransformEditTransactionFinish({
    transaction,
    context,
    intent = TRANSFORM_EDIT_TRANSACTION_INTENT.CONFIRM,
    changed = false,
    previewApplied = false
} = {}) {
    if (!transaction?.ok || transaction.blocked) return blocked('transform-transaction-required');
    if (!Object.values(TRANSFORM_EDIT_TRANSACTION_INTENT).includes(intent)) {
        return blocked('transform-finish-intent-invalid', {
            rollback: rollbackActionFor(transaction)
        });
    }

    const validation = validateTransformEditTransactionContext(transaction, context);
    if (!validation.ok) {
        return {
            ok: true,
            blocked: false,
            action: rollbackActionFor(transaction),
            owner: transaction.owner,
            commit: false,
            terminal: true,
            reason: validation.reason
        };
    }

    if (intent === TRANSFORM_EDIT_TRANSACTION_INTENT.CANCEL) {
        return {
            ok: true,
            blocked: false,
            action: rollbackActionFor(transaction),
            owner: transaction.owner,
            commit: false,
            terminal: true,
            reason: 'cancelled'
        };
    }

    if (!changed) {
        const rollback = previewApplied === true;
        return {
            ok: true,
            blocked: false,
            action: rollback
                ? rollbackActionFor(transaction)
                : (transaction.owner === TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE
                    ? TRANSFORM_EDIT_TRANSACTION_ACTION.CLOSE_ANIMATE_NOOP
                    : TRANSFORM_EDIT_TRANSACTION_ACTION.CLOSE_SOURCE_NOOP),
            owner: transaction.owner,
            commit: false,
            terminal: true,
            reason: rollback ? 'returned-to-start' : 'no-change'
        };
    }

    if (transaction.owner === TRANSFORM_EDIT_TRANSACTION_OWNER.ANIMATION_TABLE) {
        if (previewApplied !== true) {
            return blocked('animate-preview-required', {
                rollback: TRANSFORM_EDIT_TRANSACTION_ACTION.ROLLBACK_ANIMATE
            });
        }
        return {
            ok: true,
            blocked: false,
            action: TRANSFORM_EDIT_TRANSACTION_ACTION.COMMIT_ANIMATE,
            owner: transaction.owner,
            commit: true,
            terminal: true,
            historyOwner: 'timeline',
            reason: null
        };
    }

    return {
        ok: true,
        blocked: false,
        action: TRANSFORM_EDIT_TRANSACTION_ACTION.CONFIRM_SOURCE,
        owner: transaction.owner,
        commit: true,
        terminal: true,
        historyOwner: 'layer-source',
        reason: null
    };
}
