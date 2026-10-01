/**
 * ============================================================================
 * ファイル名: system/focus-lines.js
 * 責務: 集中線 / ウニフラ の純幾何。パラメータ(+seed)から決定的に線ポリゴン列を生成する
 * 依存: なし（DOM / Pixi / Canvasを使わない）
 * 被依存: ui/focus-lines-popup.js, ui/focus-lines-overlay.js, system/focus-lines-raster.js,
 *   system/project-manager.js(sanitize), build/verify-focus-lines.mjs
 * 公開API: FOCUS_LINES_LIMITS, FOCUS_LINES_STYLES, defaultFocusLinesParams, normalizeFocusLinesParams,
 *   sanitizeFocusLinesData, buildFocusLines, innerRadiusAt, focusLinesHandles
 * 保存: Projectの正本ではない。popupがUI設定(localStorage)と、確定Layerの layerData.focusLines
 *   (optional・sanitize済み)へ保持する。画素は派生物で、更新で再生成する。
 *
 * モデル
 *   中心 center、内側の楕円(rx, ry)=線が入らない「抜け」。count本の線を中心の周りへ配る。
 *   direction 'in'  : 外側が太く中心側へ尖る(集中線)。taper=1で完全に尖る。
 *   direction 'out' : 内側(楕円の縁)が太く外へ尖る(ウニフラ)。outerを有限にして使う。
 *   outer: 0 = キャンバスの最遠隅を越えるまで伸ばす / >0 = 中心からの長さ(px)。
 *   乱数は seed のみから決まる(同じseedなら同じ絵)。
 * ============================================================================
 */

export const FOCUS_LINES_DEFAULT_COLOR = '#800000'; // futaba-maroon

export const FOCUS_LINES_LIMITS = Object.freeze({
    count: { min: 4, max: 600, step: 1 },
    width: { min: 0.5, max: 200, step: 0.5 },
    taper: { min: 0, max: 1, step: 0.01 },
    inner: { min: 0, max: 4000, step: 1 },
    outer: { min: 0, max: 8000, step: 1 },
    jitter: { min: 0, max: 1, step: 0.01 }
});

export const FOCUS_LINES_STYLES = Object.freeze([
    { id: 'focus', label: '集中線', patch: { count: 120, widthMin: 1, widthMax: 5, taper: 1, direction: 'in', outer: 0, angleJitter: 0.6, lengthJitter: 0.25 } },
    { id: 'fine', label: '細かい', patch: { count: 260, widthMin: 0.5, widthMax: 2.5, taper: 1, direction: 'in', outer: 0, angleJitter: 0.8, lengthJitter: 0.35 } },
    { id: 'bold', label: '太い', patch: { count: 56, widthMin: 6, widthMax: 22, taper: 1, direction: 'in', outer: 0, angleJitter: 0.5, lengthJitter: 0.2 } },
    { id: 'flash', label: 'ウニフラ', patch: { count: 48, widthMin: 10, widthMax: 34, taper: 1, direction: 'out', outer: 260, angleJitter: 0.7, lengthJitter: 0.55 } },
    { id: 'solid', label: 'ベタ放射', patch: { count: 36, widthMin: 30, widthMax: 90, taper: 1, direction: 'in', outer: 0, angleJitter: 0.4, lengthJitter: 0.15 } }
]);

const EPS = 1e-9;

function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export function defaultFocusLinesParams(canvas = { width: 400, height: 400 }) {
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const base = Math.min(w, h);
    return {
        center: { x: w / 2, y: h / 2 },
        innerRx: Math.round(base * 0.22),
        innerRy: Math.round(base * 0.22),
        color: FOCUS_LINES_DEFAULT_COLOR,
        seed: 1,
        ...FOCUS_LINES_STYLES[0].patch
    };
}

/** 範囲外・欠損を既定/clampで補い、常に完全なparamsを返す。 */
export function normalizeFocusLinesParams(raw, canvas = { width: 400, height: 400 }) {
    const L = FOCUS_LINES_LIMITS;
    const d = defaultFocusLinesParams(canvas);
    const src = raw && typeof raw === 'object' ? raw : {};
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const cx = Number(src.center?.x);
    const cy = Number(src.center?.y);
    // 中心がキャンバスから極端に離れた値は捨てる(キャンバス寸法の4倍まで)
    const centerOk = Number.isFinite(cx) && Number.isFinite(cy) && Math.abs(cx) <= w * 4 && Math.abs(cy) <= h * 4;
    const widthMin = clamp(src.widthMin ?? d.widthMin, L.width.min, L.width.max);
    const widthMax = clamp(src.widthMax ?? d.widthMax, L.width.min, L.width.max);
    return {
        center: centerOk ? { x: cx, y: cy } : d.center,
        innerRx: clamp(src.innerRx ?? d.innerRx, L.inner.min, L.inner.max),
        innerRy: clamp(src.innerRy ?? d.innerRy, L.inner.min, L.inner.max),
        count: Math.round(clamp(src.count ?? d.count, L.count.min, L.count.max)),
        widthMin: Math.min(widthMin, widthMax),
        widthMax: Math.max(widthMin, widthMax),
        taper: clamp(src.taper ?? d.taper, L.taper.min, L.taper.max),
        direction: src.direction === 'out' ? 'out' : 'in',
        outer: clamp(src.outer ?? d.outer, L.outer.min, L.outer.max),
        angleJitter: clamp(src.angleJitter ?? d.angleJitter, L.jitter.min, L.jitter.max),
        lengthJitter: clamp(src.lengthJitter ?? d.lengthJitter, L.jitter.min, L.jitter.max),
        seed: Math.trunc(Number.isFinite(Number(src.seed)) ? Number(src.seed) : d.seed) >>> 0,
        color: /^#[0-9a-f]{6}$/i.test(src.color || '') ? src.color : d.color
    };
}

/** 保存/復元境界。壊れたdataはnull。 */
export function sanitizeFocusLinesData(raw, canvas = { width: 400, height: 400 }) {
    if (!raw || typeof raw !== 'object' || !raw.params || typeof raw.params !== 'object') return null;
    return { v: 1, params: normalizeFocusLinesParams(raw.params, canvas) };
}

/** 再現可能な乱数(mulberry32)。 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 角度 angle 方向の、内側楕円の半径。rx=ry=0 なら 0。 */
export function innerRadiusAt(rx, ry, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const denom = Math.sqrt((c * c) / Math.max(rx * rx, EPS) + (s * s) / Math.max(ry * ry, EPS));
    return rx <= 0 && ry <= 0 ? 0 : 1 / Math.max(denom, EPS);
}

/**
 * 線ポリゴン列を作る。各ポリゴンは4点 [内側の左, 外側の左, 外側の右, 内側の右]。
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function buildFocusLines(rawParams, canvas = { width: 400, height: 400 }) {
    const p = normalizeFocusLinesParams(rawParams, canvas);
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const { x: cx, y: cy } = p.center;
    const rand = mulberry32(p.seed);
    const farCorner = Math.max(
        Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy)
    );
    const reach = farCorner + 4;
    const step = (Math.PI * 2) / p.count;
    const polygons = [];

    for (let i = 0; i < p.count; i += 1) {
        const theta = (i + 0.5) * step + (rand() - 0.5) * step * p.angleJitter * 1.8;
        const dx = Math.cos(theta);
        const dy = Math.sin(theta);
        const nx = -dy;
        const ny = dx;

        const ellipse = innerRadiusAt(p.innerRx, p.innerRy, theta);
        const rIn = Math.max(0, ellipse * (1 + (rand() - 0.5) * p.lengthJitter));
        let rOut = p.outer > 0 ? p.outer * (1 + (rand() - 0.5) * p.lengthJitter * 0.6) : reach;
        rOut = Math.max(rOut, rIn + 1);

        const thick = p.widthMin + rand() * (p.widthMax - p.widthMin);
        const thin = thick * (1 - p.taper);
        const wIn = p.direction === 'in' ? thin : thick;
        const wOut = p.direction === 'in' ? thick : thin;

        polygons.push([
            { x: cx + dx * rIn + nx * wIn / 2, y: cy + dy * rIn + ny * wIn / 2 },
            { x: cx + dx * rOut + nx * wOut / 2, y: cy + dy * rOut + ny * wOut / 2 },
            { x: cx + dx * rOut - nx * wOut / 2, y: cy + dy * rOut - ny * wOut / 2 },
            { x: cx + dx * rIn - nx * wIn / 2, y: cy + dy * rIn - ny * wIn / 2 }
        ]);
    }
    return polygons;
}

/** 編集ハンドルの文書座標: 中心 / 楕円の右端(rx) / 楕円の下端(ry)。 */
export function focusLinesHandles(params) {
    const { x, y } = params.center;
    return {
        center: { x, y },
        rx: { x: x + params.innerRx, y },
        ry: { x, y: y + params.innerRy }
    };
}
