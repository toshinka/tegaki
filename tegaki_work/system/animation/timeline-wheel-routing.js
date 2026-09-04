/**
 * Animation Tableのwheel入力を、DOMやFrame状態を持たずに操作種別へ振り分ける。
 * 高精度trackpadの微小な横ぶれで縦wheel量を失わないよう、絶対値の大きい軸を使う。
 */
export function getDominantTimelineWheelDelta(deltaX, deltaY) {
    const x = Number.isFinite(Number(deltaX)) ? Number(deltaX) : 0;
    const y = Number.isFinite(Number(deltaY)) ? Number(deltaY) : 0;
    return Math.abs(y) >= Math.abs(x) ? y : x;
}

export function resolveTimelineViewportWheelAction(options = {}) {
    const delta = getDominantTimelineWheelDelta(options.deltaX, options.deltaY);
    if (delta === 0) return { type: 'none', delta: 0 };
    if (options.ctrlKey === true || options.metaKey === true) {
        return { type: 'zoom', delta };
    }
    if (options.overTrackList === true) {
        return { type: 'vertical-scroll', delta };
    }
    if (options.shiftKey === true) {
        return { type: 'frame-step-create', delta };
    }
    return { type: 'frame-step', delta };
}
