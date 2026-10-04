/**
 * ============================================================================
 * ファイル名: system/balloon-geometry.js
 * 責務: 吹き出しの純幾何。本体(楕円/角丸/雲/ギザギザ)としっぽ(尖り/考え事の丸)の多角形を作り、
 *       文字を置く内側の矩形、保存値のsanitize、編集ハンドルを返す。DOM / Pixi / Canvasを使わない。
 * 依存: なし
 * 被依存: system/balloon-raster.js, ui/balloon-popup.js, ui/balloon-overlay.js, system/project-manager.js,
 *   build/verify-balloon.mjs
 * 公開API: BALLOON_SHAPES, BALLOON_TAIL_STYLES, BALLOON_LIMITS, defaultBalloonParams, normalizeBalloonParams,
 *   sanitizeBalloonData, createBalloonContour, insertBalloonContourPoint, removeBalloonContourPoint,
 *   moveBalloonContourPoint, secondaryBalloonRect, buildBalloonParts, balloonTextArea, balloonHandles, balloonBounds
 * 保存: Projectの正本ではない。popupがUI設定(localStorage)と、確定Layerの layerData.balloon(optional・sanitize済み)に保持。
 *   画素は派生物で、更新で再生成する。
 *
 * モデル
 *   rect = 本体の外接矩形(キャンバス座標)。shape が形、tail が しっぽ(先端tipと根元の幅)。
 *   extraTails は同じtail形状のoptional追加配列(最大3件)。欠損時は旧recipeのキーを増やさない。
 *   しっぽは本体の中心→先端の線が本体の縁と交わる所を根元にする。
 *   描画は「本体+しっぽを2×線幅で縁取り→塗りで内側を隠す」ため、合成部に継ぎ目の線が出ない。
 * ============================================================================
 */

export const BALLOON_SHAPES = Object.freeze([
    { id: 'ellipse', label: '楕円', textRatio: 0.74 },
    { id: 'roundrect', label: '角丸', textRatio: 0.9 },
    { id: 'cloud', label: '雲', textRatio: 0.7 },
    { id: 'burst', label: 'ギザギザ', textRatio: 0.58 },
    { id: 'custom', label: '自由輪郭', textRatio: 0.74 },
    { id: 'double', label: '二連', textRatio: 0.74 }
]);

export const BALLOON_TAIL_STYLES = Object.freeze([
    { id: 'pointed', label: '尖り' },
    { id: 'thought', label: '丸（考え）' }
]);

export const BALLOON_DEFAULT_LINE_COLOR = '#800000'; // futaba-maroon
export const BALLOON_DEFAULT_FILL_COLOR = '#ffffee'; // futaba-background

export const BALLOON_LIMITS = Object.freeze({
    size: { min: 16, max: 4000 },
    lineWidth: { min: 0.5, max: 24 },
    corner: { min: 0, max: 0.5 },
    bumps: { min: 5, max: 40 },
    spikes: { min: 6, max: 60 },
    depth: { min: 0.05, max: 0.6 },
    jitter: { min: 0, max: 1 },
    tailWidth: { min: 4, max: 400 },
    tailCurve: { min: -1, max: 1 },
    fontSize: { min: 8, max: 400 },
    lineHeight: { min: 0.8, max: 3 },
    letterSpacing: { min: -0.2, max: 1 },
    outlineWidth: { min: 0, max: 24 }
});

const SEG = 6; // 円弧1/4あたりの分割数の基準
const ADVANCED_SHAPES = new Set(['custom', 'double']);
const CONTOUR_MIN_POINTS = 4;
const CONTOUR_MAX_POINTS = 24;
const CONTOUR_SAMPLE_COUNT = 256;
const CONTOUR_RADIUS_MIN = 0.25;
const CONTOUR_RADIUS_MAX = 1.5;
const SECONDARY_SCALE_MIN = 0.4;
const SECONDARY_SCALE_MAX = 1.2;
const EXTRA_TAIL_MAX = 3;
const TEXT_FRAME_XY_MIN = -2;
const TEXT_FRAME_XY_MAX = 2;
const TEXT_FRAME_SIZE_MIN = 0.02;
const TEXT_FRAME_SIZE_MAX = 3;

function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function hexOr(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

/** 本体rectに対する文字領域の相対値。壊れたframeは保存せず旧recipeを保つ。 */
function normalizeOptionalTextFrame(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const w = Number(raw.w);
    const h = Number(raw.h);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return {
        x: Math.min(TEXT_FRAME_XY_MAX, Math.max(TEXT_FRAME_XY_MIN, x)),
        y: Math.min(TEXT_FRAME_XY_MAX, Math.max(TEXT_FRAME_XY_MIN, y)),
        w: Math.min(TEXT_FRAME_SIZE_MAX, Math.max(TEXT_FRAME_SIZE_MIN, w)),
        h: Math.min(TEXT_FRAME_SIZE_MAX, Math.max(TEXT_FRAME_SIZE_MIN, h))
    };
}

function normalizeExtraTail(raw, canvasWidth, canvasHeight, fallbackTail) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const tip = raw.tip && typeof raw.tip === 'object' ? raw.tip : null;
    const x = Number(tip?.x);
    const y = Number(tip?.y);
    const width = Number(raw.width);
    const curve = Number(raw.curve);
    if (!BALLOON_TAIL_STYLES.some(item => item.id === raw.style)) return null;
    if (![x, y, width, curve].every(Number.isFinite)) return null;
    return {
        enabled: raw.enabled === false ? false : true,
        style: raw.style,
        tip: {
            x: clamp(x, -canvasWidth * 4, canvasWidth * 5, fallbackTail.tip.x),
            y: clamp(y, -canvasHeight * 4, canvasHeight * 5, fallbackTail.tip.y)
        },
        width: clamp(width, BALLOON_LIMITS.tailWidth.min, BALLOON_LIMITS.tailWidth.max, fallbackTail.width),
        curve: clamp(curve, BALLOON_LIMITS.tailCurve.min, BALLOON_LIMITS.tailCurve.max, fallbackTail.curve)
    };
}

/** custom輪郭の初期点。angleは1周を1とする正規化角度。 */
export function createBalloonContour(count = 8) {
    const n = Math.round(clamp(count, CONTOUR_MIN_POINTS, CONTOUR_MAX_POINTS, 8));
    return Array.from({ length: n }, (_, i) => ({ angle: i / n, radius: 1 }));
}

function normalizeBalloonContour(raw) {
    if (!Array.isArray(raw)) return createBalloonContour();
    const points = raw.map(point => {
        if (!point || typeof point !== 'object') return null;
        const angle = Number(point.angle);
        const radius = Number(point.radius);
        if (!Number.isFinite(angle) || !Number.isFinite(radius)) return null;
        return {
            angle: clamp(angle, 0, 1, 0),
            radius: clamp(radius, CONTOUR_RADIUS_MIN, CONTOUR_RADIUS_MAX, 1)
        };
    }).filter(Boolean).sort((a, b) => a.angle - b.angle);
    if (points.length < CONTOUR_MIN_POINTS) return createBalloonContour();
    return points.slice(0, CONTOUR_MAX_POINTS);
}

function normalizeSecondary(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const scale = clamp(src.scale ?? 0.85, SECONDARY_SCALE_MIN, SECONDARY_SCALE_MAX, 0.85);
    let dx = Number(src.dx ?? 0);
    let dy = Number(src.dy ?? 0.5);
    if (!Number.isFinite(dx)) dx = 0;
    if (!Number.isFinite(dy)) dy = 0.5;
    // dx/dy are measured in primary rect width/height units. Keep the two
    // ellipses overlapping in that normalized dimension space.
    const maxDistance = 0.8 * (1 + scale) / 2;
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance && distance > 0) {
        const k = maxDistance / distance;
        dx *= k;
        dy *= k;
    }
    return {
        dx,
        dy,
        scale,
        content: String(src.content ?? '').replace(/\r\n?/g, '\n').slice(0, 2000)
    };
}

export function defaultBalloonParams(canvas = { width: 400, height: 400 }) {
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const bw = Math.round(Math.min(w * 0.4, 260));
    const bh = Math.round(Math.min(h * 0.5, 340));
    const x = Math.round(w / 2 - bw / 2);
    const y = Math.round(h / 2 - bh / 2);
    return {
        shape: 'ellipse',
        rect: { x, y, w: bw, h: bh },
        corner: 0.25,
        bumps: 14,
        spikes: 18,
        depth: 0.22,
        jitter: 0.35,
        seed: 1,
        lineWidth: 3,
        lineColor: BALLOON_DEFAULT_LINE_COLOR,
        fillColor: BALLOON_DEFAULT_FILL_COLOR,
        tail: { enabled: true, style: 'pointed', tip: { x: x + bw * 0.35, y: y + bh + Math.round(bh * 0.28) }, width: Math.round(bw * 0.16), curve: 0.25 },
        text: {
            content: 'セリフを入力',
            vertical: true,
            fontKind: 'system',      // 'system' = family名 / 'imported' = 取り込みフォントのid
            fontFamily: 'sans-serif',
            fontId: null,
            fontSize: 28,
            autoFit: true,
            lineHeight: 1.45,
            letterSpacing: 0.04,
            bold: false,
            color: BALLOON_DEFAULT_LINE_COLOR,
            outlineWidth: 0,
            outlineColor: BALLOON_DEFAULT_FILL_COLOR,
            align: 'center'
        }
    };
}

export function normalizeBalloonParams(raw, canvas = { width: 400, height: 400 }) {
    const L = BALLOON_LIMITS;
    const d = defaultBalloonParams(canvas);
    const src = raw && typeof raw === 'object' ? raw : {};
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const lim = (n, k) => clamp(n, L[k].min, L[k].max, d[k] ?? L[k].min);
    const rectSrc = src.rect || {};
    const rw = clamp(rectSrc.w, L.size.min, L.size.max, d.rect.w);
    const rh = clamp(rectSrc.h, L.size.min, L.size.max, d.rect.h);
    // 位置はキャンバス寸法の4倍の範囲(極端な保存値を捨てる)
    const rx = clamp(rectSrc.x, -w * 4, w * 5, d.rect.x);
    const ry = clamp(rectSrc.y, -h * 4, h * 5, d.rect.y);
    const t = src.tail && typeof src.tail === 'object' ? src.tail : {};
    const tx = clamp(t.tip?.x, -w * 4, w * 5, d.tail.tip.x);
    const ty = clamp(t.tip?.y, -h * 4, h * 5, d.tail.tip.y);
    const s = src.text && typeof src.text === 'object' ? src.text : {};
    const shape = BALLOON_SHAPES.some(x => x.id === src.shape) || ADVANCED_SHAPES.has(src.shape) ? src.shape : d.shape;
    const normalized = {
        shape,
        rect: { x: rx, y: ry, w: rw, h: rh },
        corner: clamp(src.corner ?? d.corner, L.corner.min, L.corner.max),
        bumps: Math.round(clamp(src.bumps ?? d.bumps, L.bumps.min, L.bumps.max)),
        spikes: Math.round(clamp(src.spikes ?? d.spikes, L.spikes.min, L.spikes.max)),
        depth: clamp(src.depth ?? d.depth, L.depth.min, L.depth.max),
        jitter: clamp(src.jitter ?? d.jitter, L.jitter.min, L.jitter.max),
        seed: Math.trunc(Number.isFinite(Number(src.seed)) ? Number(src.seed) : d.seed) >>> 0,
        lineWidth: clamp(src.lineWidth ?? d.lineWidth, L.lineWidth.min, L.lineWidth.max),
        lineColor: hexOr(src.lineColor, d.lineColor),
        fillColor: hexOr(src.fillColor, d.fillColor),
        tail: {
            enabled: t.enabled === false ? false : true,
            style: BALLOON_TAIL_STYLES.some(x => x.id === t.style) ? t.style : 'pointed',
            tip: { x: tx, y: ty },
            width: clamp(t.width ?? d.tail.width, L.tailWidth.min, L.tailWidth.max),
            curve: clamp(t.curve ?? d.tail.curve, L.tailCurve.min, L.tailCurve.max, 0)
        },
        text: {
            content: String(s.content ?? d.text.content).replace(/\r\n?/g, '\n').slice(0, 2000),
            vertical: s.vertical === false ? false : true,
            fontKind: s.fontKind === 'imported' ? 'imported' : 'system',
            fontFamily: String(s.fontFamily || d.text.fontFamily).replace(/['"\\<>;{}]/g, '').slice(0, 120),
            fontId: typeof s.fontId === 'string' ? s.fontId.slice(0, 80) : null,
            fontSize: Math.round(clamp(s.fontSize ?? d.text.fontSize, L.fontSize.min, L.fontSize.max)),
            autoFit: s.autoFit === false ? false : true,
            lineHeight: clamp(s.lineHeight ?? d.text.lineHeight, L.lineHeight.min, L.lineHeight.max),
            letterSpacing: clamp(s.letterSpacing ?? d.text.letterSpacing, L.letterSpacing.min, L.letterSpacing.max),
            bold: s.bold === true,
            color: hexOr(s.color, d.text.color),
            outlineWidth: clamp(s.outlineWidth ?? d.text.outlineWidth, L.outlineWidth.min, L.outlineWidth.max),
            outlineColor: hexOr(s.outlineColor, d.text.outlineColor),
            align: ['start', 'center', 'end'].includes(s.align) ? s.align : 'center'
        }
    };
    const textFrame = normalizeOptionalTextFrame(s.frame);
    if (textFrame) normalized.text.frame = textFrame;
    if (Array.isArray(src.extraTails)) {
        const extraTails = src.extraTails
            .map(item => normalizeExtraTail(item, w, h, normalized.tail))
            .filter(Boolean)
            .slice(0, EXTRA_TAIL_MAX);
        if (extraTails.length) normalized.extraTails = extraTails;
    }
    if (shape === 'custom') normalized.contour = normalizeBalloonContour(src.contour);
    if (shape === 'double') {
        normalized.double = normalizeSecondary(src.double);
        const doubleFrame = normalizeOptionalTextFrame(src.double?.frame);
        if (doubleFrame) normalized.double.frame = doubleFrame;
    }
    return normalized;
}

/** 保存/復元境界。壊れたdataはnull。 */
export function sanitizeBalloonData(raw, canvas = { width: 400, height: 400 }) {
    if (!raw || typeof raw !== 'object' || !raw.params || typeof raw.params !== 'object') return null;
    return { v: 1, params: normalizeBalloonParams(raw.params, canvas) };
}

function secondaryRectFromParams(p) {
    const { x, y, w, h } = p.rect;
    const cx = x + w / 2 + p.double.dx * w;
    const cy = y + h / 2 + p.double.dy * h;
    const sw = w * p.double.scale;
    const sh = h * p.double.scale;
    return { x: cx - sw / 2, y: cy - sh / 2, w: sw, h: sh };
}

function looksNormalizedDouble(raw) {
    const s = raw?.double;
    return raw?.shape === 'double'
        && raw.rect && Number.isFinite(Number(raw.rect.x)) && Number.isFinite(Number(raw.rect.y))
        && Number.isFinite(Number(raw.rect.w)) && Number.isFinite(Number(raw.rect.h))
        && s && typeof s.content === 'string'
        && Number.isFinite(Number(s.dx)) && Number.isFinite(Number(s.dy))
        && Number.isFinite(Number(s.scale))
        && s.scale >= SECONDARY_SCALE_MIN && s.scale <= SECONDARY_SCALE_MAX
        && Math.hypot(s.dx, s.dy) <= 0.8 * (1 + s.scale) / 2 + 1e-9;
}

/** doubleの第2楕円のrect。dx/dyはprimary rectの幅/高さ単位。 */
export function secondaryBalloonRect(rawParams) {
    const p = looksNormalizedDouble(rawParams) ? rawParams : normalizeBalloonParams(rawParams);
    return secondaryRectFromParams(p);
}

function editingCanvas(raw, canvas) {
    if (canvas && Number.isFinite(Number(canvas.width)) && Number.isFinite(Number(canvas.height))) return canvas;
    const rect = raw?.rect || {};
    const x = Math.abs(Number(rect.x) || 0);
    const y = Math.abs(Number(rect.y) || 0);
    const w = Math.abs(Number(rect.w) || 0);
    const h = Math.abs(Number(rect.h) || 0);
    return { width: Math.max(400, x + w + 400), height: Math.max(400, y + h + 400) };
}

function asCustomParams(raw, canvas) {
    const p = normalizeBalloonParams(raw, editingCanvas(raw, canvas));
    if (p.shape !== 'custom') {
        p.shape = 'custom';
        p.contour = createBalloonContour();
    }
    return p;
}

function insertionIndex(index, length) {
    const n = Number(index);
    if (!Number.isFinite(n)) return length;
    return Math.min(length, Math.max(0, Math.trunc(n)));
}

/** custom輪郭の角度順スロットへ隣接点の中点を追加する。 */
export function insertBalloonContourPoint(raw, index, canvas) {
    const p = asCustomParams(raw, canvas);
    if (p.contour.length >= CONTOUR_MAX_POINTS) return p;
    const contour = p.contour.slice();
    const at = insertionIndex(index, contour.length);
    const lower = at > 0 ? contour[at - 1].angle : 0;
    const upper = at < contour.length ? contour[at].angle : 1;
    const angle = lower + (upper - lower) / 2;
    const lowerRadius = at > 0 ? contour[at - 1].radius : contour[0].radius;
    const upperRadius = at < contour.length ? contour[at].radius : contour[contour.length - 1].radius;
    contour.splice(at, 0, { angle, radius: (lowerRadius + upperRadius) / 2 });
    p.contour = contour;
    return p;
}

/** custom輪郭点を削除する。4点を下回る削除は無視する。 */
export function removeBalloonContourPoint(raw, index, canvas) {
    const p = asCustomParams(raw, canvas);
    if (p.contour.length <= CONTOUR_MIN_POINTS) return p;
    const at = Math.min(p.contour.length - 1, Math.max(0, Math.trunc(Number(index) || 0)));
    p.contour = p.contour.filter((_, i) => i !== at);
    return p;
}

/**
 * custom輪郭点をworld座標から移動する。隣接角の間に閉じ込め、
 * contour配列の順序とindexを保つ。canvasは呼び出し側の座標契約を明示するため受け取る。
 */
export function moveBalloonContourPoint(raw, index, worldPoint, canvas) {
    const p = asCustomParams(raw, canvas);
    const contour = p.contour.slice();
    if (!contour.length) return p;
    const at = Math.min(contour.length - 1, Math.max(0, Math.trunc(Number(index) || 0)));
    const current = contour[at];
    const point = worldPoint && Number.isFinite(Number(worldPoint.x)) && Number.isFinite(Number(worldPoint.y))
        ? worldPoint
        : {
            x: p.rect.x + p.rect.w / 2 + Math.cos(current.angle * Math.PI * 2) * p.rect.w * current.radius / 2,
            y: p.rect.y + p.rect.h / 2 + Math.sin(current.angle * Math.PI * 2) * p.rect.h * current.radius / 2
        };
    const nx = (Number(point.x) - (p.rect.x + p.rect.w / 2)) / (p.rect.w / 2);
    const ny = (Number(point.y) - (p.rect.y + p.rect.h / 2)) / (p.rect.h / 2);
    let rawAngle = ((Math.atan2(ny, nx) / (Math.PI * 2)) + 1) % 1;
    // Use the nearest turn at the 0/1 seam instead of jumping to the next node.
    if (rawAngle - current.angle > 0.5) rawAngle -= 1;
    else if (rawAngle - current.angle < -0.5) rawAngle += 1;
    const rawRadius = Math.hypot(nx, ny);
    const lower = at > 0 ? contour[at - 1].angle : 0;
    const upper = at + 1 < contour.length ? contour[at + 1].angle : 1;
    const inset = Math.min(1e-5, Math.max(0, upper - lower) / 4);
    const angle = Math.min(upper - inset, Math.max(lower + inset, rawAngle));
    contour[at] = {
        angle,
        radius: clamp(rawRadius, CONTOUR_RADIUS_MIN, CONTOUR_RADIUS_MAX, current.radius)
    };
    p.contour = contour;
    return p;
}

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

// ---------------------------------------------------------------- 本体

function ellipsePoints(cx, cy, rx, ry, count = 96) {
    const pts = [];
    for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
}

function roundRectPoints(x, y, w, h, radiusRatio) {
    const r = Math.min(w, h) * radiusRatio;
    if (r < 0.5) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    const pts = [];
    const arc = (cx, cy, a0) => {
        for (let i = 0; i <= SEG; i += 1) {
            const a = a0 + (i / SEG) * (Math.PI / 2);
            pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
    };
    arc(x + w - r, y + r, -Math.PI / 2);
    arc(x + w - r, y + h - r, 0);
    arc(x + r, y + h - r, Math.PI / 2);
    arc(x + r, y + r, Math.PI);
    return pts;
}

/** 雲: 縁のbumps個の「ふくらみ」。隣り合うふくらみは内側の尖り(くびれ)で接する。 */
function cloudPoints(cx, cy, rx, ry, bumps) {
    const pts = [];
    const per = 14;
    const depth = 0.12; // 縁の凹み量(半径比)
    for (let i = 0; i < bumps * per; i += 1) {
        const a = (i / (bumps * per)) * Math.PI * 2;
        const bump = Math.abs(Math.sin((a * bumps) / 2)); // 0(くびれ)〜1(ふくらみ頂点)
        const k = 1 - depth + depth * Math.sqrt(bump);
        pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
    }
    return pts;
}

function burstPoints(cx, cy, rx, ry, spikes, depth, jitter, seed) {
    const rand = mulberry32(seed);
    const pts = [];
    for (let i = 0; i < spikes * 2; i += 1) {
        const outer = i % 2 === 0;
        const a = (i / (spikes * 2)) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / spikes) * jitter * 0.8;
        const k = outer ? 1 + (rand() - 0.5) * jitter * 0.18 : 1 - depth * (1 - (rand() - 0.5) * jitter * 0.6);
        pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
    }
    return pts;
}

function contourRadiusAt(contour, angle) {
    const n = contour.length;
    if (!n) return 1;
    const t = ((angle % 1) + 1) % 1;
    for (let i = 0; i < n; i += 1) {
        const a0 = contour[i].angle;
        const a1 = i + 1 < n ? contour[i + 1].angle : contour[0].angle + 1;
        const probe = i === n - 1 && t < a0 ? t + 1 : t;
        const span = a1 - a0;
        if (span <= 1e-9 || probe < a0 || probe > a1) continue;
        const u = Math.min(1, Math.max(0, (probe - a0) / span));
        const p0 = contour[(i - 1 + n) % n].radius;
        const p1 = contour[i].radius;
        const p2 = contour[(i + 1) % n].radius;
        const p3 = contour[(i + 2) % n].radius;
        const u2 = u * u;
        const u3 = u2 * u;
        const value = 0.5 * (
            2 * p1
            + (-p0 + p2) * u
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2
            + (-p0 + 3 * p1 - 3 * p2 + p3) * u3
        );
        return clamp(value, CONTOUR_RADIUS_MIN, CONTOUR_RADIUS_MAX, 1);
    }
    return clamp(contour[0].radius, CONTOUR_RADIUS_MIN, CONTOUR_RADIUS_MAX, 1);
}

function customContourPoints(p) {
    const { x, y, w, h } = p.rect;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const pts = [];
    for (let i = 0; i < CONTOUR_SAMPLE_COUNT; i += 1) {
        const angle = i / CONTOUR_SAMPLE_COUNT;
        const a = angle * Math.PI * 2;
        const radius = contourRadiusAt(p.contour, angle);
        pts.push({ x: cx + Math.cos(a) * (w / 2) * radius, y: cy + Math.sin(a) * (h / 2) * radius });
    }
    return pts;
}

function customTextRatio(p, baseRatio) {
    if (p.shape !== 'custom') return baseRatio;
    let minimum = 1;
    for (let i = 0; i < CONTOUR_SAMPLE_COUNT; i += 1) minimum = Math.min(minimum, contourRadiusAt(p.contour, i / CONTOUR_SAMPLE_COUNT));
    // The existing ratio leaves room for a rectangular text box inside an
    // ellipse. Scale that same conservative ratio by the evaluated contour
    // minimum so a deeply indented custom side cannot cut through the body.
    return baseRatio * Math.max(CONTOUR_RADIUS_MIN, Math.min(1, minimum));
}

function ellipseRayExit(rect, origin, dir) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const rx = Math.max(1e-9, rect.w / 2);
    const ry = Math.max(1e-9, rect.h / 2);
    const ox = origin.x - cx;
    const oy = origin.y - cy;
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);
    const a = dir.x * dir.x * invRx2 + dir.y * dir.y * invRy2;
    const b = 2 * (ox * dir.x * invRx2 + oy * dir.y * invRy2);
    const c = ox * ox * invRx2 + oy * oy * invRy2 - 1;
    const disc = Math.max(0, b * b - 4 * a * c);
    return (-b + Math.sqrt(disc)) / (2 * a);
}

function doubleBodyPoints(p) {
    const primary = p.rect;
    const secondary = secondaryBalloonRect(p);
    const scale = p.double.scale;
    const primaryCenter = { x: primary.x + primary.w / 2, y: primary.y + primary.h / 2 };
    const secondaryCenter = { x: secondary.x + secondary.w / 2, y: secondary.y + secondary.h / 2 };
    // In normalized rect dimensions this is the weighted center at which both
    // ellipse interiors contain the ray origin under the overlap contract.
    const ratio = 1 / (1 + scale);
    const origin = {
        x: primaryCenter.x + (secondaryCenter.x - primaryCenter.x) * ratio,
        y: primaryCenter.y + (secondaryCenter.y - primaryCenter.y) * ratio
    };
    const pts = [];
    for (let i = 0; i < CONTOUR_SAMPLE_COUNT; i += 1) {
        const a = (i / CONTOUR_SAMPLE_COUNT) * Math.PI * 2;
        const dir = { x: Math.cos(a), y: Math.sin(a) };
        const t = Math.max(ellipseRayExit(primary, origin, dir), ellipseRayExit(secondary, origin, dir));
        pts.push({ x: origin.x + dir.x * t, y: origin.y + dir.y * t });
    }
    return pts;
}

export function bodyPolygon(p) {
    const { x, y, w, h } = p.rect;
    const cx = x + w / 2;
    const cy = y + h / 2;
    switch (p.shape) {
        case 'custom': return customContourPoints(p);
        case 'double': return doubleBodyPoints(p);
        case 'roundrect': return roundRectPoints(x, y, w, h, p.corner);
        case 'cloud': return cloudPoints(cx, cy, w / 2, h / 2, p.bumps);
        case 'burst': return burstPoints(cx, cy, w / 2, h / 2, p.spikes, p.depth, p.jitter, p.seed);
        default: return ellipsePoints(cx, cy, w / 2, h / 2);
    }
}

// ---------------------------------------------------------------- しっぽ

/** 中心→先端の半直線と多角形の縁の交点(最も遠い交点)。見つからなければ中心。 */
function rayExit(poly, origin, dir) {
    let best = null;
    let bestT = -Infinity;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const denom = dir.x * ey - dir.y * ex;
        if (Math.abs(denom) < 1e-9) continue;
        const t = ((a.x - origin.x) * ey - (a.y - origin.y) * ex) / denom;
        const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
        if (t > 0 && u >= 0 && u <= 1 && t > bestT) {
            bestT = t;
            best = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
        }
    }
    return best || origin;
}

function pointInPolygon(poly, point) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i];
        const b = poly[j];
        const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
        const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
        if (Math.abs(cross) <= 1e-7 && dot <= 1e-7) return true;
        if ((a.y > point.y) !== (b.y > point.y)) {
            const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
            if (point.x < x) inside = !inside;
        }
    }
    return inside;
}

function quadPoint(a, c, b, t) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function pointedTail(p, body) {
    const cx = p.rect.x + p.rect.w / 2;
    const cy = p.rect.y + p.rect.h / 2;
    const dx = p.tail.tip.x - cx;
    const dy = p.tail.tip.y - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    if (pointInPolygon(body, p.tail.tip)) return null;
    const dir = { x: dx / len, y: dy / len };
    const exit = rayExit(body, { x: cx, y: cy }, dir);
    const reach = Math.hypot(p.tail.tip.x - exit.x, p.tail.tip.y - exit.y);
    if (reach < 2) return null; // 先端が本体の中なら出さない
    const n = { x: -dir.y, y: dir.x };
    const half = p.tail.width / 2;
    // 根元は本体の内側へ少し食い込ませて継ぎ目を隠す
    // (本体の縁が凹凸でも根元の辺が見えないよう、幅に比例して深く入れる。本体の塗りが覆う)
    const inset = Math.max(8, Math.min(half * 1.6, Math.min(p.rect.w, p.rect.h) * 0.4));
    const baseL = { x: exit.x - dir.x * inset + n.x * half, y: exit.y - dir.y * inset + n.y * half };
    const baseR = { x: exit.x - dir.x * inset - n.x * half, y: exit.y - dir.y * inset - n.y * half };
    const bend = p.tail.curve * reach * 0.35;
    const mid = { x: (exit.x + p.tail.tip.x) / 2 + n.x * bend, y: (exit.y + p.tail.tip.y) / 2 + n.y * bend };
    const ctrlL = { x: mid.x + n.x * half * 0.35, y: mid.y + n.y * half * 0.35 };
    const ctrlR = { x: mid.x - n.x * half * 0.35, y: mid.y - n.y * half * 0.35 };
    const pts = [];
    for (let i = 0; i <= 12; i += 1) pts.push(quadPoint(baseL, ctrlL, p.tail.tip, i / 12));
    for (let i = 1; i <= 12; i += 1) pts.push(quadPoint(p.tail.tip, ctrlR, baseR, i / 12));
    return pts;
}

function thoughtTail(p, body) {
    const cx = p.rect.x + p.rect.w / 2;
    const cy = p.rect.y + p.rect.h / 2;
    const dx = p.tail.tip.x - cx;
    const dy = p.tail.tip.y - cy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return [];
    if (pointInPolygon(body, p.tail.tip)) return [];
    const dir = { x: dx / len, y: dy / len };
    const exit = rayExit(body, { x: cx, y: cy }, dir);
    const reach = Math.hypot(p.tail.tip.x - exit.x, p.tail.tip.y - exit.y);
    if (reach < 2) return [];
    const n = { x: -dir.y, y: dir.x };
    const circles = [];
    const base = Math.max(4, p.tail.width / 2);
    const sizes = [0.62, 0.42, 0.26];
    for (let i = 0; i < sizes.length; i += 1) {
        const t = (i + 0.7) / (sizes.length + 0.2);
        const bend = p.tail.curve * reach * 0.25 * Math.sin(t * Math.PI);
        const r = Math.max(2, base * sizes[i] * 1.6);
        circles.push(ellipsePoints(
            exit.x + dir.x * reach * t + n.x * bend,
            exit.y + dir.y * reach * t + n.y * bend,
            r, r, 28
        ));
    }
    return circles;
}

/**
 * 吹き出しを構成する多角形。body は1つ、tails は0個以上。
 * @returns {{ body: Array<{x,y}>, tails: Array<Array<{x,y}>> }}
 */
export function buildBalloonParts(rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const body = bodyPolygon(p);
    let tails = [];
    if (p.tail.enabled) {
        if (p.tail.style === 'thought') tails = thoughtTail(p, body);
        else {
            const tail = pointedTail(p, body);
            tails = tail ? [tail] : [];
        }
    }
    if (Array.isArray(p.extraTails)) {
        for (const extra of p.extraTails) {
            if (!extra.enabled) continue;
            const extraParams = { ...p, tail: extra };
            if (extra.style === 'thought') {
                tails.push(...thoughtTail(extraParams, body));
            } else {
                const tail = pointedTail(extraParams, body);
                if (tail) tails.push(tail);
            }
        }
    }
    return { body, tails };
}

// ---------------------------------------------------------------- 文字領域 / ハンドル / 外接矩形

/** 文字を置く内側の矩形。doubleのindex=1だけ第2本体を返す。 */
export function balloonTextArea(rawParams, canvas, index = 0) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const ratio = customTextRatio(p, BALLOON_SHAPES.find(s => s.id === p.shape)?.textRatio ?? 0.74);
    const rect = p.shape === 'double' && index === 1 ? secondaryBalloonRect(p) : p.rect;
    const minAreaSize = p.shape === 'custom' ? 1 : 8;
    const w = Math.max(minAreaSize, rect.w * ratio - p.lineWidth * 2);
    const h = Math.max(minAreaSize, rect.h * ratio - p.lineWidth * 2);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

/** 編集ハンドル: 4隅(本体の矩形)、しっぽの先端、中心(移動)。 */
export function balloonHandles(rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const { x, y, w, h } = p.rect;
    const handles = {
        center: { x: x + w / 2, y: y + h / 2 },
        corners: { tl: { x, y }, tr: { x: x + w, y }, br: { x: x + w, y: y + h }, bl: { x, y: y + h } },
        tip: p.tail.enabled ? { ...p.tail.tip } : null
    };
    if (Array.isArray(p.extraTails)) {
        handles.extraTips = p.extraTails.map(tail => (tail.enabled ? { ...tail.tip } : null));
    }
    if (p.shape === 'custom') handles.contour = p.contour.map(point => ({
        x: x + w / 2 + Math.cos(point.angle * Math.PI * 2) * (w / 2) * point.radius,
        y: y + h / 2 + Math.sin(point.angle * Math.PI * 2) * (h / 2) * point.radius
    }));
    if (p.shape === 'double') {
        const secondary = secondaryBalloonRect(p);
        handles.secondary = {
            center: { x: secondary.x + secondary.w / 2, y: secondary.y + secondary.h / 2 },
            corners: {
                tl: { x: secondary.x, y: secondary.y },
                tr: { x: secondary.x + secondary.w, y: secondary.y },
                br: { x: secondary.x + secondary.w, y: secondary.y + secondary.h },
                bl: { x: secondary.x, y: secondary.y + secondary.h }
            }
        };
    }
    return handles;
}

/** 縁取りを含む外接矩形。キャンバス内へ丸めて返す(Layerのrasterサイズ用)。 */
export function balloonBounds(rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const { body, tails } = buildBalloonParts(p, canvas);
    const pts = [...body, ...tails.flat()];
    const pad = Math.ceil(p.lineWidth * 2) + 2;
    const xs = pts.map(q => q.x);
    const ys = pts.map(q => q.y);
    const w = Math.max(1, Number(canvas.width) || 400);
    const h = Math.max(1, Number(canvas.height) || 400);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
    const x1 = Math.min(w, Math.ceil(Math.max(...xs) + pad));
    const y1 = Math.min(h, Math.ceil(Math.max(...ys) + pad));
    return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}
