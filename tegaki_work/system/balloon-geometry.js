/**
 * ============================================================================
 * ファイル名: system/balloon-geometry.js
 * 責務: 吹き出しの純幾何。本体(楕円/角丸/雲/ギザギザ)としっぽ(尖り/考え事の丸)の多角形を作り、
 *       文字を置く内側の矩形、保存値のsanitize、編集ハンドルを返す。DOM / Pixi / Canvasを使わない。
 * 依存: なし
 * 被依存: system/balloon-raster.js, ui/balloon-popup.js, ui/balloon-overlay.js, system/project-manager.js,
 *   build/verify-balloon.mjs
 * 公開API: BALLOON_SHAPES, BALLOON_TAIL_STYLES, BALLOON_LIMITS, defaultBalloonParams, normalizeBalloonParams,
 *   sanitizeBalloonData, buildBalloonParts, balloonTextArea, balloonHandles, balloonBounds
 * 保存: Projectの正本ではない。popupがUI設定(localStorage)と、確定Layerの layerData.balloon(optional・sanitize済み)に保持。
 *   画素は派生物で、更新で再生成する。
 *
 * モデル
 *   rect = 本体の外接矩形(キャンバス座標)。shape が形、tail が しっぽ(先端tipと根元の幅)。
 *   しっぽは本体の中心→先端の線が本体の縁と交わる所を根元にする。
 *   描画は「本体+しっぽを2×線幅で縁取り→塗りで内側を隠す」ため、合成部に継ぎ目の線が出ない。
 * ============================================================================
 */

export const BALLOON_SHAPES = Object.freeze([
    { id: 'ellipse', label: '楕円', textRatio: 0.74 },
    { id: 'roundrect', label: '角丸', textRatio: 0.9 },
    { id: 'cloud', label: '雲', textRatio: 0.7 },
    { id: 'burst', label: 'ギザギザ', textRatio: 0.58 }
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

function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function hexOr(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
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
    return {
        shape: BALLOON_SHAPES.some(x => x.id === src.shape) ? src.shape : d.shape,
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
}

/** 保存/復元境界。壊れたdataはnull。 */
export function sanitizeBalloonData(raw, canvas = { width: 400, height: 400 }) {
    if (!raw || typeof raw !== 'object' || !raw.params || typeof raw.params !== 'object') return null;
    return { v: 1, params: normalizeBalloonParams(raw.params, canvas) };
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

export function bodyPolygon(p) {
    const { x, y, w, h } = p.rect;
    const cx = x + w / 2;
    const cy = y + h / 2;
    switch (p.shape) {
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
    return { body, tails };
}

// ---------------------------------------------------------------- 文字領域 / ハンドル / 外接矩形

/** 文字を置く内側の矩形(本体の中心に同心)。 */
export function balloonTextArea(rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const ratio = BALLOON_SHAPES.find(s => s.id === p.shape)?.textRatio ?? 0.74;
    const w = Math.max(8, p.rect.w * ratio - p.lineWidth * 2);
    const h = Math.max(8, p.rect.h * ratio - p.lineWidth * 2);
    const cx = p.rect.x + p.rect.w / 2;
    const cy = p.rect.y + p.rect.h / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
}

/** 編集ハンドル: 4隅(本体の矩形)、しっぽの先端、中心(移動)。 */
export function balloonHandles(rawParams, canvas) {
    const p = normalizeBalloonParams(rawParams, canvas);
    const { x, y, w, h } = p.rect;
    return {
        center: { x: x + w / 2, y: y + h / 2 },
        corners: { tl: { x, y }, tr: { x: x + w, y }, br: { x: x + w, y: y + h }, bl: { x, y: y + h } },
        tip: p.tail.enabled ? { ...p.tail.tip } : null
    };
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
