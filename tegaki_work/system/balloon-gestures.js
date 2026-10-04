/** ROLE: Pure whole-balloon move/scale adapter for existing rect/tail recipes.
 * Relative contour/double/text frames follow rect. Font/line/tail widths are not scaling targets.
 * No rotation schema, DOM, renderer, or History ownership.
 */
import { BALLOON_LIMITS, normalizeBalloonParams } from './balloon-geometry.js';

export function transformBalloon(raw, canvas, { dx = 0, dy = 0, scale = 1 } = {}) {
    const p = normalizeBalloonParams(raw, canvas);
    const r = p.rect;
    dx = Number.isFinite(dx) ? dx : 0;
    dy = Number.isFinite(dy) ? dy : 0;
    scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const { min, max } = BALLOON_LIMITS.size;
    const k = Math.min(Math.min(max / r.w, max / r.h), Math.max(Math.max(min / r.w, min / r.h), scale));
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const point = ({ x, y }) => ({ x: cx + (x - cx) * k + dx, y: cy + (y - cy) * k + dy });
    const origin = point(r);
    p.rect = { x: origin.x, y: origin.y, w: r.w * k, h: r.h * k };
    p.tail.tip = point(p.tail.tip);
    if (p.extraTails) p.extraTails = p.extraTails.map(tail => ({ ...tail, tip: point(tail.tip) }));
    return normalizeBalloonParams(p, canvas);
}
