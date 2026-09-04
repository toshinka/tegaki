/**
 * Transform Edit Context の読み取り専用runtime projection。
 *
 * 責務:
 * - Animation Table表示、primary Clip選択、Timeline Frameから、Layer Transformが
 *   将来どの正本へ書くべきかをSOURCE / ANIMATE / BLOCKEDとして説明する。
 * - ClipInstance.transform / transformKeyframes、History、working Layerを変更しない。
 *
 * 境界:
 * - `ready`はkey作成許可ではない。Auto Key / baseline / preview / confirmは後続Gate。
 * - `keyed`は現在Clip-local Frameに明示transform keyが存在するという表示状態だけ。
 * - Table表示中に対象が曖昧ならSOURCEへ黙ってfallbackせず、BLOCKEDを返す。
 */

export const TRANSFORM_EDIT_CONTEXT_MODE = Object.freeze({
    SOURCE: 'source',
    ANIMATE_READY: 'animate-ready',
    ANIMATE_KEYED: 'animate-keyed',
    BLOCKED: 'blocked'
});

export const TRANSFORM_EDIT_AUTHORITY = Object.freeze({
    LAYER_SOURCE: 'layer-source',
    CLIP_TRANSFORM_KEY: 'clip-transform-key',
    CLIP_LAYER_TRANSFORM_KEY: 'clip-layer-transform-key',
    NONE: 'none'
});

function createContext(overrides = {}) {
    return {
        mode: TRANSFORM_EDIT_CONTEXT_MODE.BLOCKED,
        authority: TRANSFORM_EDIT_AUTHORITY.NONE,
        writable: false,
        reason: null,
        clipId: null,
        timelineFrame: null,
        localFrame: null,
        keyIndex: -1,
        hasExplicitKey: false,
        internalLayerId: null,
        ...overrides
    };
}

/**
 * @param {object} input
 * @param {boolean} input.tableVisible
 * @param {boolean} input.isPlaying
 * @param {object|null} input.selectedClip primary ClipInstance
 * @param {number} input.selectedClipCount primaryを含む選択Clip数
 * @param {number} input.timelineFrame Timelineの0-based current Frame
 */
export function projectTransformEditContext(input = {}) {
    const tableVisible = input.tableVisible === true;
    const isPlaying = input.isPlaying === true;
    const clip = input.selectedClip && typeof input.selectedClip === 'object'
        ? input.selectedClip
        : null;
    const selectedClipCount = Number.isInteger(input.selectedClipCount)
        ? Math.max(0, input.selectedClipCount)
        : (clip ? 1 : 0);
    const timelineFrame = Number.isInteger(input.timelineFrame)
        ? input.timelineFrame
        : null;

    if (!tableVisible) {
        return createContext({
            mode: TRANSFORM_EDIT_CONTEXT_MODE.SOURCE,
            authority: TRANSFORM_EDIT_AUTHORITY.LAYER_SOURCE,
            writable: true,
            timelineFrame
        });
    }

    if (isPlaying) {
        return createContext({ reason: 'playback-active', timelineFrame });
    }
    if (!clip) {
        return createContext({ reason: 'clip-selection-required', timelineFrame });
    }
    if (selectedClipCount !== 1) {
        return createContext({
            reason: 'single-clip-required',
            clipId: clip.id || null,
            timelineFrame
        });
    }
    if (!Number.isInteger(clip.duration) || clip.duration <= 1) {
        return createContext({
            reason: 'animated-duration-required',
            clipId: clip.id || null,
            timelineFrame
        });
    }
    if (timelineFrame === null) {
        return createContext({
            reason: 'timeline-frame-required',
            clipId: clip.id || null
        });
    }

    const startFrame = Number.isInteger(clip.startFrame) ? clip.startFrame : 0;
    const localFrame = timelineFrame - startFrame;
    if (localFrame < 0 || localFrame >= clip.duration) {
        return createContext({
            reason: 'frame-outside-clip',
            clipId: clip.id || null,
            timelineFrame,
            localFrame
        });
    }

    const internalLayerId = typeof input.internalLayerId === 'string' && input.internalLayerId.length > 0
        ? input.internalLayerId
        : null;
    const layerTrack = internalLayerId
        ? (clip.layerTransformTracks || []).find(track => track?.internalLayerId === internalLayerId) || null
        : null;
    const keyframes = internalLayerId
        ? (Array.isArray(layerTrack?.keyframes) ? layerTrack.keyframes : [])
        : (Array.isArray(clip.transformKeyframes) ? clip.transformKeyframes : []);
    const keyIndex = keyframes.findLastIndex(key => key?.frame === localFrame);
    const hasExplicitKey = keyIndex >= 0;
    return createContext({
        mode: hasExplicitKey
            ? TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_KEYED
            : TRANSFORM_EDIT_CONTEXT_MODE.ANIMATE_READY,
        authority: internalLayerId
            ? TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY
            : TRANSFORM_EDIT_AUTHORITY.CLIP_TRANSFORM_KEY,
        writable: true,
        clipId: clip.id || null,
        timelineFrame,
        localFrame,
        keyIndex,
        hasExplicitKey,
        internalLayerId
    });
}
