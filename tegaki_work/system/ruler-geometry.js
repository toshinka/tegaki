/**
 * ============================================================================
 * ファイル名: system/ruler-geometry.js
 * 責務: 定規(平行線 / 放射線)の純幾何。吸着の射影、Shift+ドラッグのつかみ判定、角度スナップ、
 *       保存状態のsanitize、ガイド線の線分列。DOM / Pixi / 保存へは触れない。
 * 被依存: system/drawing/ruler-system.js、build/verify-ruler.mjs
 *
 * 座標はすべて文書(world)座標。吸着は「描き始めの点を通り、定規の方向に沿う直線」へ以後の点を射影する。
 *   平行線: 方向 = 定規の角度
 *   放射線: 方向 = 中心→描き始めの点(集中線)
 * ============================================================================
 */

export const RULER_TYPES = ['parallel', 'radial'];
export const RULER_TYPE_LABELS = { parallel: '平行線定規', radial: '放射線定規（集中線）' };
export const RULER_CENTER_HANDLE_SCREEN_PX = 14;
export const RULER_ROTATION_RING_SCREEN_PX = 70;
export const RULER_ANGLE_SNAP_DEG = 15;
export const RULER_PARALLEL_SPACING_SCREEN_PX = 48;
export const RULER_RADIAL_SPOKES = 48;
// 保存値の中心がキャンバスから極端に離れていたら捨てる範囲(キャンバス寸法の倍数)。
const CENTER_LIMIT_FACTOR = 4;

export function clampRulerAngle(angle) {
    const turn = Math.PI * 2;
    return ((angle % turn) + turn) % turn;
}

export function snapRulerAngle(angle, stepDeg = RULER_ANGLE_SNAP_DEG) {
    const step = (stepDeg * Math.PI) / 180;
    return clampRulerAngle(Math.round(angle / step) * step);
}

/**
 * 定規への吸着。anchorを通り、定規が決める方向の直線へpointを射影する。
 * @returns {{x:number, y:number}}
 */
export function snapPointToRuler(state, anchor, point) {
    if (!state?.enabled || !anchor || !point) return point;
    let dirX;
    let dirY;
    if (state.type === 'radial') {
        dirX = anchor.x - state.center.x;
        dirY = anchor.y - state.center.y;
        const length = Math.hypot(dirX, dirY);
        // 中心そのものから描き始めた場合は方向が決まらないため吸着しない。
        if (!(length > 1e-6)) return point;
        dirX /= length;
        dirY /= length;
    } else {
        dirX = Math.cos(state.angle);
        dirY = Math.sin(state.angle);
    }
    const t = (point.x - anchor.x) * dirX + (point.y - anchor.y) * dirY;
    return { x: anchor.x + dirX * t, y: anchor.y + dirY * t };
}

/**
 * Shift+押下位置からドラッグの種類を決める。中心付近(画面px)と放射線は移動、それ以外の平行線は回転。
 * @param {number} screenScale 文書1pxあたりの画面px
 */
export function resolveRulerGrab(state, world, screenScale = 1, centerHandlePx = RULER_CENTER_HANDLE_SCREEN_PX) {
    const dx = world.x - state.center.x;
    const dy = world.y - state.center.y;
    if (state.type === 'radial' || Math.hypot(dx, dy) * screenScale <= centerHandlePx) {
        return { kind: 'move', offsetX: -dx, offsetY: -dy };
    }
    return { kind: 'rotate', grabOffset: state.angle - Math.atan2(dy, dx) };
}

/** つかみ(resolveRulerGrab)とポインタ位置から、新しい中心または角度を返す。 */
export function applyRulerDrag(state, grab, world, { snapAngle = false } = {}) {
    if (grab.kind === 'move') {
        return { ...state, center: { x: world.x + grab.offsetX, y: world.y + grab.offsetY } };
    }
    const raw = Math.atan2(world.y - state.center.y, world.x - state.center.x) + grab.grabOffset;
    return { ...state, angle: snapAngle ? snapRulerAngle(raw) : clampRulerAngle(raw) };
}

/**
 * localStorageなど外部から来た定規状態を検証する。enabledは保存対象外(常にOFFで起動)。
 * @returns {{type:string, angle:number, center:{x:number,y:number}|null}}
 */
export function sanitizeRulerState(raw, canvas = { width: 400, height: 400 }) {
    const result = { type: 'parallel', angle: 0, center: null };
    if (!raw || typeof raw !== 'object') return result;
    if (RULER_TYPES.includes(raw.type)) result.type = raw.type;
    if (Number.isFinite(raw.angle)) result.angle = clampRulerAngle(raw.angle);
    const cx = Number(raw.center?.x);
    const cy = Number(raw.center?.y);
    const limitX = Math.max(1, Number(canvas?.width) || 400) * CENTER_LIMIT_FACTOR;
    const limitY = Math.max(1, Number(canvas?.height) || 400) * CENTER_LIMIT_FACTOR;
    if (Number.isFinite(cx) && Number.isFinite(cy) && Math.abs(cx) <= limitX && Math.abs(cy) <= limitY) {
        result.center = { x: cx, y: cy };
    }
    return result;
}

/**
 * ガイド線の線分列(文書座標)。平行線は中心線を `main` として別に返す。
 * @param {number} screenScale 文書1pxあたりの画面px(線間隔を画面基準で一定にする)
 */
export function buildRulerGuideSegments(state, canvas, screenScale = 1) {
    const { x: cx, y: cy } = state.center;
    const reach = Math.hypot(canvas.width, canvas.height) + Math.hypot(cx, cy);
    const lines = [];
    if (state.type === 'radial') {
        for (let i = 0; i < RULER_RADIAL_SPOKES; i++) {
            const a = (i / RULER_RADIAL_SPOKES) * Math.PI * 2;
            lines.push([cx, cy, cx + Math.cos(a) * reach, cy + Math.sin(a) * reach]);
        }
        return { lines, main: null };
    }
    const dirX = Math.cos(state.angle);
    const dirY = Math.sin(state.angle);
    const spacing = RULER_PARALLEL_SPACING_SCREEN_PX / (screenScale > 0 ? screenScale : 1);
    const count = Math.ceil(reach / spacing);
    for (let i = -count; i <= count; i++) {
        if (i === 0) continue;
        const ox = cx - dirY * spacing * i;
        const oy = cy + dirX * spacing * i;
        lines.push([ox - dirX * reach, oy - dirY * reach, ox + dirX * reach, oy + dirY * reach]);
    }
    return { lines, main: [cx - dirX * reach, cy - dirY * reach, cx + dirX * reach, cy + dirY * reach] };
}
