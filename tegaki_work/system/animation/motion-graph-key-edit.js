/**
 * Motion Graphの表示値を既存Clip transform keyの一channelへ写すpure helper。
 * Graph固有keyやselectionを保存せず、複合keyの他channelを維持する。
 */

import { MOTION_GRAPH_GROUPS, normalizeMotionGraphGroup } from './motion-graph-view-model.js';

const PERCENT_CHANNELS = new Set(['opacity', 'blendStrength']);

export function normalizeMotionGraphEditChannel(group, channel) {
    const groupId = normalizeMotionGraphGroup(group);
    const channels = MOTION_GRAPH_GROUPS[groupId]?.channels || [];
    const requested = typeof channel === 'string' ? channel.trim() : '';
    return channels.some(candidate => candidate.id === requested)
        ? requested
        : (channels[0]?.id || null);
}

export function patchMotionGraphTransformChannel({
    transform,
    group,
    channel,
    displayValue
} = {}) {
    if (!transform || typeof transform !== 'object') {
        return { ok: false, reason: 'transform-required' };
    }
    const groupId = normalizeMotionGraphGroup(group);
    const channelId = normalizeMotionGraphEditChannel(groupId, channel);
    if (!channelId || channelId !== channel) {
        return { ok: false, reason: 'channel-invalid' };
    }
    const numericValue = Number(displayValue);
    if (!Number.isFinite(numericValue)) {
        return { ok: false, reason: 'value-invalid' };
    }

    let storedValue = numericValue;
    let normalizedDisplayValue = numericValue;
    if (channelId === 'rotation') {
        storedValue = numericValue * Math.PI / 180;
    } else if (PERCENT_CHANNELS.has(channelId)) {
        normalizedDisplayValue = Math.max(0, Math.min(100, numericValue));
        storedValue = normalizedDisplayValue / 100;
    }

    const previousValue = Number(transform[channelId]);
    const changed = !Number.isFinite(previousValue)
        || Math.abs(previousValue - storedValue) > 1e-12;
    return {
        ok: true,
        changed,
        group: groupId,
        channel: channelId,
        displayValue: normalizedDisplayValue,
        storedValue,
        transform: {
            ...transform,
            [channelId]: storedValue
        }
    };
}
