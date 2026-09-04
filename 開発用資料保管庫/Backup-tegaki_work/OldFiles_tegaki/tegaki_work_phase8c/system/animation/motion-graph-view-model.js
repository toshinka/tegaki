/**
 * ClipInstance transform trackをread-only Motion Graph表示データへ投影するpure adapter。
 * 既存sampleClipTransform()だけを評価正本とし、Graph固有stateを保存しない。
 */

import { normalizeCubicBezierEasing } from './cubic-bezier-easing.js';
import { sampleClipTransform } from './clip-transform-sampler.js';

const RANGE_PADDING_RATIO = 0.08;

export const MOTION_GRAPH_GROUPS = Object.freeze({
    position: Object.freeze({
        id: 'position',
        label: 'POSITION',
        unit: 'px',
        channels: Object.freeze([
            Object.freeze({ id: 'x', label: 'X', read: transform => transform.x }),
            Object.freeze({ id: 'y', label: 'Y', read: transform => transform.y })
        ])
    }),
    scale: Object.freeze({
        id: 'scale',
        label: 'SCALE',
        unit: 'ratio',
        referenceValue: 1,
        channels: Object.freeze([
            Object.freeze({ id: 'scaleX', label: 'X', read: transform => transform.scaleX }),
            Object.freeze({ id: 'scaleY', label: 'Y', read: transform => transform.scaleY })
        ])
    }),
    rotation: Object.freeze({
        id: 'rotation',
        label: 'ROTATION',
        unit: 'deg',
        referenceValue: 0,
        channels: Object.freeze([
            Object.freeze({ id: 'rotation', label: 'ROTATION', read: transform => transform.rotation * 180 / Math.PI })
        ])
    }),
    opacity: Object.freeze({
        id: 'opacity',
        label: 'OPACITY',
        unit: '%',
        fixedRange: Object.freeze({ min: 0, max: 100 }),
        channels: Object.freeze([
            Object.freeze({ id: 'opacity', label: 'OPACITY', read: transform => transform.opacity * 100 })
        ])
    }),
    blend: Object.freeze({
        id: 'blend',
        label: 'BLEND',
        unit: '%',
        fixedRange: Object.freeze({ min: 0, max: 100 }),
        channels: Object.freeze([
            Object.freeze({ id: 'blendStrength', label: 'STRENGTH', read: transform => transform.blendStrength * 100 })
        ])
    })
});

function finiteIntegerOr(value, fallback) {
    return Number.isInteger(value) ? value : fallback;
}

function cloneEasing(easing) {
    const normalized = normalizeCubicBezierEasing(easing);
    return normalized ? { ...normalized } : null;
}

export function normalizeMotionGraphGroup(group) {
    const normalized = typeof group === 'string' ? group.trim().toLowerCase() : '';
    return MOTION_GRAPH_GROUPS[normalized] ? normalized : 'position';
}

function collectExplicitKeys(clip, duration) {
    const byFrame = new Map();
    (Array.isArray(clip?.transformKeyframes) ? clip.transformKeyframes : []).forEach(key => {
        if (!key || !Number.isInteger(key.frame) || key.frame < 0 || key.frame >= duration) return;
        byFrame.set(key.frame, key);
    });
    return [...byFrame.values()].sort((left, right) => left.frame - right.frame);
}

function createRange(group, channels, paddingRatio) {
    if (group.fixedRange) return { ...group.fixedRange };
    const values = channels.flatMap(channel => channel.values).filter(Number.isFinite);
    if (Number.isFinite(group.referenceValue)) values.push(group.referenceValue);
    if (values.length === 0) return { min: 0, max: 1 };
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const span = maximum - minimum;
    const fallbackSpan = Math.max(1, Math.abs(minimum), Math.abs(maximum)) * 0.1;
    const padding = span > 0
        ? span * paddingRatio
        : fallbackSpan * Math.max(paddingRatio, RANGE_PADDING_RATIO);
    return {
        min: minimum - padding,
        max: maximum + padding
    };
}

function createBlendModeRuns(samples) {
    const runs = [];
    samples.forEach(sample => {
        const previous = runs[runs.length - 1];
        if (previous?.mode === sample.transform.blendMode) {
            previous.endLocalFrame = sample.localFrame;
            previous.endProjectFrame = sample.projectFrame;
            return;
        }
        runs.push({
            mode: sample.transform.blendMode,
            startLocalFrame: sample.localFrame,
            endLocalFrame: sample.localFrame,
            startProjectFrame: sample.projectFrame,
            endProjectFrame: sample.projectFrame
        });
    });
    return runs;
}

function createSegments(explicitKeys, startFrame, duration) {
    const keyByFrame = new Map(explicitKeys.map(key => [key.frame, key]));
    if (!keyByFrame.has(0)) keyByFrame.set(0, { frame: 0, interpolation: 'linear' });
    if (duration > 1 && !keyByFrame.has(duration - 1)) {
        keyByFrame.set(duration - 1, { frame: duration - 1, interpolation: 'linear' });
    }
    const effectiveKeys = [...keyByFrame.values()].sort((left, right) => left.frame - right.frame);
    return effectiveKeys.slice(0, -1).map((left, index) => {
        const right = effectiveKeys[index + 1];
        const easing = left.interpolation === 'hold' ? null : cloneEasing(left.easing);
        return {
            startLocalFrame: left.frame,
            endLocalFrame: right.frame,
            startProjectFrame: startFrame + left.frame + 1,
            endProjectFrame: startFrame + right.frame + 1,
            interpolation: left.interpolation === 'hold' ? 'hold' : 'linear',
            ...(easing ? { easing } : {})
        };
    });
}

/**
 * @param {object} clip ClipInstance-like object.
 * @param {number} timelineFrame Timelineの0-based Frame。
 * @param {{ group?: string, rangePaddingRatio?: number }} options runtime表示option。
 */
export function createMotionGraphViewModel(clip, timelineFrame, options = {}) {
    const duration = Math.max(1, finiteIntegerOr(clip?.duration, 1));
    const startFrame = finiteIntegerOr(clip?.startFrame, 0);
    const groupId = normalizeMotionGraphGroup(options.group);
    const group = MOTION_GRAPH_GROUPS[groupId];
    const requestedFrame = finiteIntegerOr(timelineFrame, startFrame);
    const requestedLocalFrame = requestedFrame - startFrame;
    const cursorLocalFrame = Math.max(0, Math.min(duration - 1, requestedLocalFrame));
    const rangePaddingRatio = Number.isFinite(options.rangePaddingRatio)
        ? Math.max(0, Math.min(0.5, options.rangePaddingRatio))
        : RANGE_PADDING_RATIO;

    const samples = Array.from({ length: duration }, (_, localFrame) => {
        const timelineSampleFrame = startFrame + localFrame;
        return {
            localFrame,
            timelineFrame: timelineSampleFrame,
            projectFrame: timelineSampleFrame + 1,
            transform: sampleClipTransform(clip, timelineSampleFrame)
        };
    });

    const channels = group.channels.map(channel => ({
        id: channel.id,
        label: channel.label,
        unit: group.unit,
        values: samples.map(sample => channel.read(sample.transform))
    }));
    const explicitKeys = collectExplicitKeys(clip, duration);
    const keyPoints = explicitKeys.map(key => {
        const sample = samples[key.frame];
        const easing = key.interpolation === 'hold' ? null : cloneEasing(key.easing);
        return {
            localFrame: key.frame,
            timelineFrame: startFrame + key.frame,
            projectFrame: startFrame + key.frame + 1,
            interpolation: key.interpolation === 'hold' ? 'hold' : 'linear',
            values: Object.fromEntries(group.channels.map(channel => [channel.id, channel.read(sample.transform)])),
            ...(easing ? { easing } : {})
        };
    });
    const explicitFrames = new Set(explicitKeys.map(key => key.frame));
    const implicitBoundaryFrames = [0, ...(duration > 1 ? [duration - 1] : [])]
        .filter((frame, index, frames) => !explicitFrames.has(frame) && frames.indexOf(frame) === index)
        .map(localFrame => ({
            localFrame,
            timelineFrame: startFrame + localFrame,
            projectFrame: startFrame + localFrame + 1
        }));
    const cursorSample = samples[cursorLocalFrame];

    return {
        group: {
            id: group.id,
            label: group.label,
            unit: group.unit
        },
        startFrame,
        duration,
        samples,
        channels,
        range: createRange(group, channels, rangePaddingRatio),
        keyPoints,
        implicitBoundaryFrames,
        segments: createSegments(explicitKeys, startFrame, duration),
        blendModeRuns: groupId === 'blend' ? createBlendModeRuns(samples) : [],
        cursor: {
            requestedTimelineFrame: requestedFrame,
            timelineFrame: cursorSample.timelineFrame,
            localFrame: cursorSample.localFrame,
            projectFrame: cursorSample.projectFrame,
            inRange: requestedLocalFrame >= 0 && requestedLocalFrame < duration,
            values: Object.fromEntries(group.channels.map(channel => [channel.id, channel.read(cursorSample.transform)])),
            ...(groupId === 'blend' ? { blendMode: cursorSample.transform.blendMode } : {})
        }
    };
}
