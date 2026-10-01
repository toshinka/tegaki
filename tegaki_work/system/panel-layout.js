/**
 * ============================================================================
 * ファイル名: system/panel-layout.js
 * 責務: 漫画コマ割りのpure幾何。分割木(BSP)から各コマの四角形を導出する
 * 依存: なし（DOM / Pixi / Canvasを使わない）
 * 被依存: ui/panel-layout-popup.js, build/verify-panel-layout.mjs
 * 公開API: createPanelTree, resolvePanelLayout, splitPanel, removePanel,
 *   updateSplit, setPanelBleed, hitTestPanel, hitTestSplit, dragSplitRatio, buildPresetTree,
 *   PANEL_PRESETS, normalizePanelLayoutParams
 * 保存: Projectへ保存しない。popupのUI設定（localStorage）だけが保持する。
 * 実装状態: ✅実装（WP-010 Rough Product Pass）
 *
 * データ契約
 *   node = { id, kind: 'panel', bleed?: {top,right,bottom,left} }
 *        | { id, kind: 'split', dir: 'h'|'v', ratio, slant, gap: number|null, a, b }
 *   dir 'h' = 水平に切って a=上 / b=下、'v' = 垂直に切って a=左 / b=右。
 *   ratio = a側が占める割合(0..1)。slant = 切断線の傾き(割合単位。0で直線)。
 *   gap = この分割線だけの間隔(px)。nullなら全体paramsのgapを使う。
 *   bleed = 辺ごとに外周余白を無視してキャンバス端まで伸ばす(裁ち落とし)。
 *   コマは常に凸四角形 [TL, TR, BR, BL]。
 * ============================================================================
 */

export const PANEL_LAYOUT_LIMITS = Object.freeze({
    margin: { min: 0, max: 400 },
    gap: { min: 0, max: 200 },
    lineWidth: { min: 0, max: 40 },
    ratio: { min: 0.05, max: 0.95 },
    slant: { min: -0.5, max: 0.5 }
});

const EPS = 1e-9;
const MIN_PANEL_EDGE = 4;

function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

export function normalizePanelLayoutParams(params = {}) {
    const L = PANEL_LAYOUT_LIMITS;
    return {
        margin: clamp(params.margin ?? 40, L.margin.min, L.margin.max),
        gap: clamp(params.gap ?? 16, L.gap.min, L.gap.max),
        lineWidth: clamp(params.lineWidth ?? 4, L.lineWidth.min, L.lineWidth.max)
    };
}

let idCounter = 0;
function nextId(prefix) {
    idCounter += 1;
    return `${prefix}${idCounter}`;
}

export function createPanelTree() {
    return { id: nextId('p'), kind: 'panel' };
}

function makeSplit(dir, ratio, a, b, extra = {}) {
    return {
        id: nextId('s'),
        kind: 'split',
        dir,
        ratio: clamp(ratio, PANEL_LAYOUT_LIMITS.ratio.min, PANEL_LAYOUT_LIMITS.ratio.max),
        slant: clamp(extra.slant ?? 0, PANEL_LAYOUT_LIMITS.slant.min, PANEL_LAYOUT_LIMITS.slant.max),
        gap: extra.gap ?? null,
        a,
        b
    };
}

// ---------------------------------------------------------------- 木の編集 (immutable)

function mapNode(node, id, fn) {
    if (node.id === id) return fn(node);
    if (node.kind !== 'split') return node;
    const a = mapNode(node.a, id, fn);
    const b = mapNode(node.b, id, fn);
    return a === node.a && b === node.b ? node : { ...node, a, b };
}

export function findNode(node, id) {
    if (node.id === id) return node;
    if (node.kind !== 'split') return null;
    return findNode(node.a, id) || findNode(node.b, id);
}

export function findParent(root, id) {
    if (root.kind !== 'split') return null;
    if (root.a.id === id || root.b.id === id) return root;
    return findParent(root.a, id) || findParent(root.b, id);
}

export function listPanels(node, out = []) {
    if (node.kind === 'panel') out.push(node);
    else {
        listPanels(node.a, out);
        listPanels(node.b, out);
    }
    return out;
}

/** コマ panelId を dir に ratio で二分割する。新しいコマは a/b それぞれ新IDを持つ(aが元のIDを継ぐ)。 */
export function splitPanel(root, panelId, dir, ratio = 0.5, extra = {}) {
    const target = findNode(root, panelId);
    if (!target || target.kind !== 'panel') return root;
    return mapNode(root, panelId, (panel) => makeSplit(
        dir === 'v' ? 'v' : 'h',
        ratio,
        panel,
        { id: nextId('p'), kind: 'panel' },
        extra
    ));
}

/** コマを削除し、兄弟が親の領域を引き継ぐ(結合)。最後の1コマは削除しない。 */
export function removePanel(root, panelId) {
    if (root.kind === 'panel') return root;
    const parent = findParent(root, panelId);
    if (!parent) return root;
    const sibling = parent.a.id === panelId ? parent.b : parent.a;
    return mapNode(root, parent.id, () => sibling);
}

export function updateSplit(root, splitId, patch = {}) {
    return mapNode(root, splitId, (node) => {
        if (node.kind !== 'split') return node;
        const next = { ...node };
        if (patch.ratio !== undefined) next.ratio = clamp(patch.ratio, PANEL_LAYOUT_LIMITS.ratio.min, PANEL_LAYOUT_LIMITS.ratio.max);
        if (patch.slant !== undefined) next.slant = clamp(patch.slant, PANEL_LAYOUT_LIMITS.slant.min, PANEL_LAYOUT_LIMITS.slant.max);
        if (patch.gap !== undefined) next.gap = patch.gap === null ? null : clamp(patch.gap, PANEL_LAYOUT_LIMITS.gap.min, PANEL_LAYOUT_LIMITS.gap.max);
        if (patch.dir === 'h' || patch.dir === 'v') next.dir = patch.dir;
        return next;
    });
}

export function setPanelBleed(root, panelId, bleed) {
    return mapNode(root, panelId, (node) => {
        if (node.kind !== 'panel') return node;
        const clean = {};
        for (const side of ['top', 'right', 'bottom', 'left']) if (bleed?.[side]) clean[side] = true;
        const next = { ...node };
        if (Object.keys(clean).length) next.bleed = clean;
        else delete next.bleed;
        return next;
    });
}

// ---------------------------------------------------------------- 幾何

function lerp(p, q, t) {
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

function intersectLines(p, d, q, e) {
    const cross = d.x * e.y - d.y * e.x;
    if (Math.abs(cross) < EPS) return null;
    const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / cross;
    return { x: p.x + d.x * t, y: p.y + d.y * t };
}

/** 切断線を法線方向にoffsetし、四角形の2辺と交差させた点を返す。 */
function cutPoints(edgeA0, edgeA1, edgeB0, edgeB1, t0, t1, offset, nx, ny) {
    // 元の切断線
    const p0 = lerp(edgeA0, edgeA1, t0);
    const p1 = lerp(edgeB0, edgeB1, t1);
    const d = { x: p1.x - p0.x, y: p1.y - p0.y };
    const shifted = { x: p0.x + nx * offset, y: p0.y + ny * offset };
    const q0 = intersectLines(shifted, d, edgeA0, { x: edgeA1.x - edgeA0.x, y: edgeA1.y - edgeA0.y });
    const q1 = intersectLines(shifted, d, edgeB0, { x: edgeB1.x - edgeB0.x, y: edgeB1.y - edgeB0.y });
    return { line: [p0, p1], q0: q0 || p0, q1: q1 || p1 };
}

function splitQuad(quad, node, gapPx) {
    const [TL, TR, BR, BL] = quad;
    const half = gapPx / 2;
    const slant = node.slant || 0;
    const t0 = clamp(node.ratio + slant / 2, 0.02, 0.98);
    const t1 = clamp(node.ratio - slant / 2, 0.02, 0.98);

    if (node.dir === 'h') {
        // 切断線: 左辺(TL→BL)上のt0 と 右辺(TR→BR)上のt1
        const base = cutPoints(TL, BL, TR, BR, t0, t1, 0, 0, 0);
        const d = { x: base.line[1].x - base.line[0].x, y: base.line[1].y - base.line[0].y };
        const len = Math.hypot(d.x, d.y) || 1;
        let n = { x: -d.y / len, y: d.x / len };
        if (n.x * (BL.x - TL.x) + n.y * (BL.y - TL.y) < 0) n = { x: -n.x, y: -n.y }; // 下向き(b側)
        const up = cutPoints(TL, BL, TR, BR, t0, t1, -half, n.x, n.y);
        const down = cutPoints(TL, BL, TR, BR, t0, t1, half, n.x, n.y);
        return {
            cut: base.line,
            a: [TL, TR, up.q1, up.q0],
            b: [down.q0, down.q1, BR, BL]
        };
    }

    // 'v': 切断線: 上辺(TL→TR)上のt0 と 下辺(BL→BR)上のt1
    const base = cutPoints(TL, TR, BL, BR, t0, t1, 0, 0, 0);
    const d = { x: base.line[1].x - base.line[0].x, y: base.line[1].y - base.line[0].y };
    const len = Math.hypot(d.x, d.y) || 1;
    let n = { x: -d.y / len, y: d.x / len };
    if (n.x * (TR.x - TL.x) + n.y * (TR.y - TL.y) < 0) n = { x: -n.x, y: -n.y }; // 右向き(b側)
    const left = cutPoints(TL, TR, BL, BR, t0, t1, -half, n.x, n.y);
    const right = cutPoints(TL, TR, BL, BR, t0, t1, half, n.x, n.y);
    return {
        cut: base.line,
        a: [TL, left.q0, left.q1, BL],
        b: [right.q0, TR, BR, right.q1]
    };
}

function quadSignedArea(quad) {
    let sum = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = quad[i];
        const q = quad[(i + 1) % 4];
        sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
}

function quadMinEdge(quad) {
    // 間隔が領域より大きいと四角形が裏返る。裏返りは潰れ(0以下)として扱う。
    if (quadSignedArea(quad) <= 0) return 0;
    let min = Infinity;
    for (let i = 0; i < 4; i += 1) {
        const p = quad[i];
        const q = quad[(i + 1) % 4];
        min = Math.min(min, Math.hypot(q.x - p.x, q.y - p.y));
    }
    return min;
}

function applyBleed(quad, bleed, canvas) {
    if (!bleed) return quad;
    const [TL, TR, BR, BL] = quad.map(p => ({ ...p }));
    if (bleed.top) { TL.y = 0; TR.y = 0; }
    if (bleed.bottom) { BL.y = canvas.height; BR.y = canvas.height; }
    if (bleed.left) { TL.x = 0; BL.x = 0; }
    if (bleed.right) { TR.x = canvas.width; BR.x = canvas.width; }
    return [TL, TR, BR, BL];
}

/**
 * 木から全コマの四角形と分割線を導出する。
 * @returns {{ panels: Array<{id, quad, bleed}>, splits: Array<{id, dir, cut, region, node}>, valid: boolean }}
 *   valid=false: 間隔/余白が大きすぎて潰れたコマがある(描画は可能だが警告に使う)。
 */
export function resolvePanelLayout(root, canvas, rawParams = {}) {
    const params = normalizePanelLayoutParams(rawParams);
    const width = Math.max(1, Number(canvas?.width) || 1);
    const height = Math.max(1, Number(canvas?.height) || 1);
    const m = Math.min(params.margin, Math.min(width, height) / 2 - 1);
    const rootQuad = [
        { x: m, y: m },
        { x: width - m, y: m },
        { x: width - m, y: height - m },
        { x: m, y: height - m }
    ];
    const panels = [];
    const splits = [];
    let valid = true;

    const walk = (node, quad) => {
        if (node.kind === 'panel') {
            if (quadMinEdge(quad) < MIN_PANEL_EDGE) valid = false;
            panels.push({ id: node.id, quad: applyBleed(quad, node.bleed, { width, height }), bleed: node.bleed || null });
            return;
        }
        const gapPx = node.gap ?? params.gap;
        const result = splitQuad(quad, node, gapPx);
        splits.push({ id: node.id, dir: node.dir, cut: result.cut, region: quad, node });
        walk(node.a, result.a);
        walk(node.b, result.b);
    };
    walk(root, rootQuad);
    return { panels, splits, valid, params };
}

function pointInQuad(pt, quad) {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
        const p = quad[i];
        const q = quad[(i + 1) % 4];
        const cross = (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x);
        if (Math.abs(cross) < EPS) continue;
        const s = cross > 0 ? 1 : -1;
        if (sign === 0) sign = s;
        else if (sign !== s) return false;
    }
    return true;
}

export function hitTestPanel(resolved, pt) {
    for (let i = resolved.panels.length - 1; i >= 0; i -= 1) {
        if (pointInQuad(pt, resolved.panels[i].quad)) return resolved.panels[i].id;
    }
    return null;
}

/** 切断線(間隔の中心線)から tolerance 以内の分割を返す。 */
export function hitTestSplit(resolved, pt, tolerance = 8) {
    let best = null;
    let bestDist = tolerance;
    for (const split of resolved.splits) {
        const [p, q] = split.cut;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = clamp(((pt.x - p.x) * dx + (pt.y - p.y) * dy) / len2, 0, 1);
        const dist = Math.hypot(pt.x - (p.x + dx * t), pt.y - (p.y + dy * t));
        if (dist <= bestDist) {
            bestDist = dist;
            best = split.id;
        }
    }
    return best;
}

/** ポインタ位置から分割 splitId の新しいratioを求める(領域の中線方向へ射影)。 */
export function dragSplitRatio(resolved, splitId, pt) {
    const split = resolved.splits.find(s => s.id === splitId);
    if (!split) return null;
    const [TL, TR, BR, BL] = split.region;
    const a0 = split.dir === 'h' ? lerp(TL, TR, 0.5) : lerp(TL, BL, 0.5);
    const a1 = split.dir === 'h' ? lerp(BL, BR, 0.5) : lerp(TR, BR, 0.5);
    const dx = a1.x - a0.x;
    const dy = a1.y - a0.y;
    const len2 = dx * dx + dy * dy || 1;
    return clamp(((pt.x - a0.x) * dx + (pt.y - a0.y) * dy) / len2,
        PANEL_LAYOUT_LIMITS.ratio.min, PANEL_LAYOUT_LIMITS.ratio.max);
}

// ---------------------------------------------------------------- プリセット

/**
 * 行ごとの列重みでプリセット木を作る。rowWeights省略時は行高さ均等。
 * 列要素が配列なら、その中身を直交方向(縦)に等分して積む。例 [1, [1, 1]] = 左1コマ + 右2コマ縦積み。
 */
function itemWeight(item) {
    return Array.isArray(item) ? 1 : item;
}

function buildGroup(items, dir) {
    const other = dir === 'v' ? 'h' : 'v';
    const leaf = (item) => (Array.isArray(item) ? buildGroup(item, other) : createPanelTree());
    if (items.length === 1) return leaf(items[0]);
    const first = itemWeight(items[0]);
    const rest = items.slice(1).reduce((sum, item) => sum + itemWeight(item), 0);
    return makeSplit(dir, first / (first + rest), leaf(items[0]), buildGroup(items.slice(1), dir));
}

export function buildPresetTree(definition) {
    const rows = definition.rows;
    const rowWeights = definition.rowWeights || rows.map(() => 1);
    const make = (index) => {
        if (index === rows.length - 1) return buildGroup(rows[index], 'v');
        const rest = rowWeights.slice(index + 1).reduce((sum, v) => sum + v, 0);
        return makeSplit('h', rowWeights[index] / (rowWeights[index] + rest), buildGroup(rows[index], 'v'), make(index + 1));
    };
    return make(0);
}

export const PANEL_PRESETS = Object.freeze([
    { id: 'single', label: '1コマ', rows: [[1]] },
    { id: 'v2', label: '縦2分割(左右)', rows: [[1, 1]] },
    { id: 'h2', label: '横2分割(上下)', rows: [[1], [1]] },
    { id: 'grid4', label: '2×2', rows: [[1, 1], [1, 1]] },
    { id: 'yonkoma', label: '4コマ(縦並び)', rows: [[1], [1], [1], [1]] },
    { id: 'row3', label: '3段(2-1-2)', rows: [[1, 1], [1], [1, 1]], rowWeights: [1, 1.2, 1] },
    { id: 'grid6', label: '2×3', rows: [[1, 1], [1, 1], [1, 1]] },
    { id: 'lshape', label: '1+縦2', rows: [[1, [1, 1]], [1, 1]], rowWeights: [1.4, 1] },
    { id: 'top-wide', label: '上大+下3', rows: [[1], [1, 1, 1]], rowWeights: [1.5, 1] }
]);

export function buildPresetById(id) {
    const def = PANEL_PRESETS.find(p => p.id === id) || PANEL_PRESETS[0];
    return buildPresetTree(def);
}
