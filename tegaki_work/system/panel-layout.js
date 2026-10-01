/**
 * ============================================================================
 * ファイル名: system/panel-layout.js
 * 責務: 漫画コマ割りのpure幾何。分割木(BSP)から各コマの四角形を導出する
 * 依存: なし（DOM / Pixi / Canvasを使わない）
 * 被依存: ui/panel-layout-popup.js, build/verify-panel-layout.mjs
 * 公開API: addFreePanel, toggleFreePanel, moveFreePanel, panelBounds, sanitizePanelLayoutData, isValidPanelTree, setPanelLineWidth, setPanelDeleted,
 *   dragPanelCorner, resetOuterCorners, snapSplitPoint, alignLayout, hitTestCorner, createPanelTree, resolvePanelLayout, splitPanel, removePanel,
 *   updateSplit, setPanelBleed, hitTestPanel, hitTestSplit, dragSplitRatio, buildPresetTree,
 *   PANEL_PRESETS, normalizePanelLayoutParams
 * 保存: 木そのものはここでは保存しない。popupが(a)UI設定をlocalStorageへ、(b)確定した枠Layerの
 *   layerData.panelLayout(任意field)へ保持し、Project JSONへ旧版互換のoptional fieldとして入る。
 * 実装状態: ✅実装（WP-010 Rough Product Pass）
 *
 * データ契約
 *   node = { id, kind: 'panel', bleed?: {top,right,bottom,left}, lineWidth?: number, deleted?: true }
 *        | { id, kind: 'split', dir: 'h'|'v'|'o', ratio, slant, gap: number|null, a, b }
 *   dir 'h' = 水平に切って a=上 / b=下、'v' = 垂直に切って a=左 / b=右。
 *   dir 'o' = 重ね(overlay): a は領域そのまま、b はフリーコマ(free)。コマ内コマ用で、a の幾何は一切変わらない。
 *   free:true のコマは分割木の領域に従わず、自分の quad(絶対座標)を持つ。他コマの追従も受けない。
 *   ratio = a側が占める割合(0..1)。slant = 切断線の傾き(割合単位。0で直線)。
 *   gap = この分割線だけの間隔(px)。nullなら全体paramsのgapを使う。
 *   bleed = 辺ごとに外周余白を無視してキャンバス端まで伸ばす(裁ち落とし)。
 *   lineWidth = このコマだけの線幅(px)。deleted = コマを描かず番号も振らない(領域は空白のまま)。
 *   root node のみ outer?: [[dx,dy]x4] = ページ外周4頂点のオフセット。
 *   頂点ドラッグは「その頂点が乗る分割線の端 / 外周」を動かす(setPanelCornerの代わりにdragPanelCorner)。
 *   このため斜め変形しても隣のコマは設定の間隔を保って追従する。
 *   番号: 右上から(日本式)。h分割は a→b、v分割は b(右)→a(左) の順に深さ優先で振る。
 *   コマは常に凸四角形 [TL, TR, BR, BL]。
 * ============================================================================
 */

/** 既定色はふたば配色(白・灰・黒を使わない)。futaba-maroon / futaba-cream。 */
export const PANEL_DEFAULT_LINE_COLOR = '#800000';
export const PANEL_DEFAULT_PAPER_COLOR = '#f0e0d6';

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
    // 間隔は縦線(左右のコマの間)と横線(上下のコマの間)の二系統。旧データの単一gapは両方へ引き継ぐ。
    // 漫画の作法として縦は細め・横は太めを既定にする。
    return {
        margin: clamp(params.margin ?? 40, L.margin.min, L.margin.max),
        gapV: clamp(params.gapV ?? params.gap ?? 12, L.gap.min, L.gap.max),
        gapH: clamp(params.gapH ?? params.gap ?? 20, L.gap.min, L.gap.max),
        lineWidth: clamp(params.lineWidth ?? 4, L.lineWidth.min, L.lineWidth.max)
    };
}

let idCounter = 0;
function nextId(prefix) {
    idCounter += 1;
    return `${prefix}${idCounter}`;
}

/** 保存済みtreeのidと衝突しないよう、新規idの採番を最大値の次へ進める。 */
function reserveIds(node) {
    const m = /^[ps](\d+)$/.exec(node.id || '');
    if (m) idCounter = Math.max(idCounter, Number(m[1]));
    if (node.kind === 'split') {
        reserveIds(node.a);
        reserveIds(node.b);
    }
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

function stripOuter(node) {
    const { outer, ...rest } = node;
    if (node.kind === 'split') return { ...rest, a: stripOuter(node.a), b: stripOuter(node.b) };
    return rest;
}

/** 根が差し替わる編集でも外周オフセットを新しい根へ引き継ぐ。 */
function carryOuter(before, after) {
    if (!before.outer || after === before) return after;
    return { ...stripOuter(after), outer: before.outer };
}

/** コマ panelId を dir に ratio で二分割する。新しいコマは a/b それぞれ新IDを持つ(aが元のIDを継ぐ)。 */
export function splitPanel(root, panelId, dir, ratio = 0.5, extra = {}) {
    const target = findNode(root, panelId);
    if (!target || target.kind !== 'panel' || target.free) return root;
    return carryOuter(root, mapNode(root, panelId, (panel) => makeSplit(
        dir === 'v' ? 'v' : 'h',
        ratio,
        panel,
        { id: nextId('p'), kind: 'panel' },
        extra
    )));
}

/** コマを削除し、兄弟が親の領域を引き継ぐ(結合)。最後の1コマは削除しない。 */
export function removePanel(root, panelId) {
    if (root.kind === 'panel') return root;
    const parent = findParent(root, panelId);
    if (!parent) return root;
    const sibling = parent.a.id === panelId ? parent.b : parent.a;
    return carryOuter(root, mapNode(root, parent.id, () => sibling));
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

export function setPanelLineWidth(root, panelId, lineWidth) {
    return mapNode(root, panelId, (node) => {
        if (node.kind !== 'panel') return node;
        const next = { ...node };
        if (lineWidth === null || lineWidth === undefined) delete next.lineWidth;
        else next.lineWidth = clamp(lineWidth, PANEL_LAYOUT_LIMITS.lineWidth.min, PANEL_LAYOUT_LIMITS.lineWidth.max);
        return next;
    });
}

function quadBounds(quad) {
    const xs = quad.map(p => p.x);
    const ys = quad.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** コマのquadを pad 拡張した外接矩形を、キャンバス内へ丸めて返す(Layerのrasterサイズ用)。 */
export function panelBounds(quad, canvas, pad = 0) {
    const b = quadBounds(quad);
    const x0 = Math.max(0, Math.floor(b.x - pad));
    const y0 = Math.max(0, Math.floor(b.y - pad));
    const x1 = Math.min(canvas.width, Math.ceil(b.x + b.width + pad));
    const y1 = Math.min(canvas.height, Math.ceil(b.y + b.height + pad));
    return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

/**
 * コマ panelId の上に、分割木へ影響しないフリーコマ(コマ内コマ)を重ねる。
 * 初期位置は resolved 上の panelId の内側(中心25%〜75%)。
 * @returns {{ tree, newId: string|null }}
 */
export function addFreePanel(root, resolved, panelId) {
    const base = resolved.panels.find(p => p.id === panelId);
    if (!base) return { tree: root, newId: null };
    const [TL, TR, BR, BL] = base.quad;
    const at = (u, v) => {
        const top = lerp(TL, TR, u);
        const bottom = lerp(BL, BR, u);
        return lerp(top, bottom, v);
    };
    const quad = [at(0.25, 0.25), at(0.75, 0.25), at(0.75, 0.75), at(0.25, 0.75)];
    const free = { id: nextId('p'), kind: 'panel', free: true, quad };
    const tree = carryOuter(root, mapNode(root, panelId, (panel) => ({
        id: nextId('s'), kind: 'split', dir: 'o', ratio: 0.5, slant: 0, gap: null, a: panel, b: free
    })));
    return { tree, newId: free.id };
}

/** 通常コマ↔フリーコマ。フリー化は現在の見た目を絶対座標として固定し、以後は他コマに追従しない。 */
export function toggleFreePanel(root, resolved, panelId) {
    const node = findNode(root, panelId);
    const base = resolved.panels.find(p => p.id === panelId);
    if (!node || node.kind !== 'panel' || !base) return root;
    return mapNode(root, panelId, (panel) => {
        const next = { ...panel };
        if (panel.free) {
            delete next.free;
            delete next.quad;
        } else {
            next.free = true;
            next.quad = base.quad.map(p => ({ x: p.x, y: p.y }));
        }
        return next;
    });
}

/** フリーコマを (dx,dy) 平行移動する。startNodeはドラッグ開始時のnode(累積誤差を避ける)。 */
export function moveFreePanel(root, panelId, startQuad, dx, dy) {
    return mapNode(root, panelId, (panel) => {
        if (panel.kind !== 'panel' || !panel.free) return panel;
        return { ...panel, quad: startQuad.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    });
}

export function setPanelDeleted(root, panelId, deleted) {
    return mapNode(root, panelId, (node) => {
        if (node.kind !== 'panel') return node;
        const next = { ...node };
        if (deleted) next.deleted = true;
        else delete next.deleted;
        return next;
    });
}

/** ページ外周の頂点オフセットを消す(外周を元の矩形へ戻す)。 */
export function resetOuterCorners(root) {
    if (!root.outer) return root;
    const next = { ...root };
    delete next.outer;
    return next;
}

/**
 * 解決済みコマ panelId の頂点 index(0..3=TL,TR,BR,BL) をポインタ pt へ動かす。
 * 頂点が分割線の端なら、その線の端(割合)だけを動かすので、間隔を保ったまま隣のコマも追従する。
 * 外周の頂点なら外周オフセットを動かす(全コマが追従)。
 */
export function dragPanelCorner(root, resolved, panelId, index, pt) {
    const panel = resolved.panels.find(p => p.id === panelId);
    const src = panel?.cornerSources?.[index];
    if (!src) return root;
    if (src.type === 'free') {
        return mapNode(root, panelId, (node) => {
            if (!node.free || !node.quad) return node;
            const quad = node.quad.map(p => ({ ...p }));
            quad[src.index] = { x: pt.x, y: pt.y };
            return { ...node, quad };
        });
    }
    if (src.type === 'root') {
        const base = resolved.rootBase[src.index];
        const outer = (root.outer || [[0, 0], [0, 0], [0, 0], [0, 0]]).map(c => [...c]);
        outer[src.index] = [pt.x - base.x, pt.y - base.y];
        const next = { ...root };
        if (outer.every(([x, y]) => Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6)) delete next.outer;
        else next.outer = outer;
        return next;
    }
    const split = resolved.splits.find(sp => sp.id === src.splitId);
    if (!split) return root;
    const [e0, e1] = split.edges[src.end];
    // 隅は中心線から間隔の半分だけa側/b側へずれているので、中心線の端へ補正してから辺へ射影する
    const sign = src.side === 'a' ? 1 : -1;
    const target = { x: pt.x + split.normal.x * (split.gap / 2) * sign, y: pt.y + split.normal.y * (split.gap / 2) * sign };
    const dx = e1.x - e0.x;
    const dy = e1.y - e0.y;
    const t = clamp(((target.x - e0.x) * dx + (target.y - e0.y) * dy) / (dx * dx + dy * dy || 1), 0.02, 0.98);
    const t0 = split.node.ratio + (split.node.slant || 0) / 2;
    const t1 = split.node.ratio - (split.node.slant || 0) / 2;
    const n0 = src.end === 0 ? t : t0;
    const n1 = src.end === 1 ? t : t1;
    return updateSplit(root, split.id, { ratio: (n0 + n1) / 2, slant: n0 - n1 });
}

export function isValidPanelTree(node, depth = 0) {
    if (!node || depth > 12 || typeof node.id !== 'string') return false;
    if (node.kind === 'panel') return true;
    return node.kind === 'split'
        && (node.dir === 'h' || node.dir === 'v' || node.dir === 'o')
        && Number.isFinite(node.ratio)
        && isValidPanelTree(node.a, depth + 1)
        && isValidPanelTree(node.b, depth + 1);
}

/** 保存/復元境界。壊れたdataはnull。数値はclampし、未知fieldは落とす。 */
export function sanitizePanelLayoutData(data) {
    if (!data || typeof data !== 'object' || !isValidPanelTree(data.tree)) return null;
    const clean = (node) => {
        if (node.kind === 'panel') {
            const out = { id: String(node.id), kind: 'panel' };
            if (node.bleed && typeof node.bleed === 'object') {
                const bleed = {};
                for (const side of ['top', 'right', 'bottom', 'left']) if (node.bleed[side]) bleed[side] = true;
                if (Object.keys(bleed).length) out.bleed = bleed;
            }
            if (Number.isFinite(node.lineWidth)) {
                out.lineWidth = clamp(node.lineWidth, PANEL_LAYOUT_LIMITS.lineWidth.min, PANEL_LAYOUT_LIMITS.lineWidth.max);
            }
            if (node.deleted === true) out.deleted = true;
            if (node.free === true && Array.isArray(node.quad) && node.quad.length === 4
                && node.quad.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
                out.free = true;
                out.quad = node.quad.map(p => ({ x: p.x, y: p.y }));
            }
            return out;
        }
        return {
            id: String(node.id),
            kind: 'split',
            dir: node.dir,
            ratio: clamp(node.ratio, PANEL_LAYOUT_LIMITS.ratio.min, PANEL_LAYOUT_LIMITS.ratio.max),
            slant: clamp(node.slant ?? 0, PANEL_LAYOUT_LIMITS.slant.min, PANEL_LAYOUT_LIMITS.slant.max),
            gap: Number.isFinite(node.gap) ? clamp(node.gap, PANEL_LAYOUT_LIMITS.gap.min, PANEL_LAYOUT_LIMITS.gap.max) : null,
            a: clean(node.a),
            b: clean(node.b)
        };
    };
    const color = /^#[0-9a-f]{6}$/i.test(data.color || '') ? data.color : PANEL_DEFAULT_LINE_COLOR;
    const paperColor = /^#[0-9a-f]{6}$/i.test(data.paperColor || '') ? data.paperColor : PANEL_DEFAULT_PAPER_COLOR;
    const tree = clean(data.tree);
    reserveIds(tree);
    const outer = data.tree.outer;
    if (Array.isArray(outer) && outer.length === 4
        && outer.every(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))) {
        tree.outer = outer.map(c => [c[0], c[1]]);
    }
    return {
        v: 1,
        groupId: typeof data.groupId === 'string' ? data.groupId : null,
        role: ['paper', 'inner', 'folder'].includes(data.role) ? data.role : 'lines',
        panelId: typeof data.panelId === 'string' ? data.panelId : null,
        tree,
        params: normalizePanelLayoutParams(data.params),
        color,
        paperColor
    };
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

function splitQuad(quad, node, gapPx, src) {
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
        const sid = node.id;
        return {
            cut: base.line,
            a: [TL, TR, up.q1, up.q0],
            b: [down.q0, down.q1, BR, BL],
            aSrc: [src[0], src[1], { type: 'cut', splitId: sid, end: 1, side: 'a' }, { type: 'cut', splitId: sid, end: 0, side: 'a' }],
            bSrc: [{ type: 'cut', splitId: sid, end: 0, side: 'b' }, { type: 'cut', splitId: sid, end: 1, side: 'b' }, src[2], src[3]],
            edges: [[TL, BL], [TR, BR]],
            normal: n
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
    const sid = node.id;
    return {
        cut: base.line,
        a: [TL, left.q0, left.q1, BL],
        b: [right.q0, TR, BR, right.q1],
        aSrc: [src[0], { type: 'cut', splitId: sid, end: 0, side: 'a' }, { type: 'cut', splitId: sid, end: 1, side: 'a' }, src[3]],
        bSrc: [{ type: 'cut', splitId: sid, end: 0, side: 'b' }, src[1], src[2], { type: 'cut', splitId: sid, end: 1, side: 'b' }],
        edges: [[TL, TR], [BL, BR]],
        normal: n
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
    const rootBase = [
        { x: m, y: m },
        { x: width - m, y: m },
        { x: width - m, y: height - m },
        { x: m, y: height - m }
    ];
    const rootQuad = root.outer
        ? rootBase.map((p, i) => ({ x: p.x + root.outer[i][0], y: p.y + root.outer[i][1] }))
        : rootBase;
    const panels = [];
    const splits = [];
    const numbers = numberPanels(root);
    let valid = true;

    const walk = (node, quad, src) => {
        if (node.kind === 'panel') {
            const isFree = node.free === true && Array.isArray(node.quad);
            const panelQuad = isFree ? node.quad.map(p => ({ x: p.x, y: p.y })) : applyBleed(quad, node.bleed, { width, height });
            const panelSrc = isFree ? [0, 1, 2, 3].map(index => ({ type: 'free', index })) : src;
            if (quadMinEdge(panelQuad) < MIN_PANEL_EDGE && node.deleted !== true) valid = false;
            panels.push({
                id: node.id,
                free: isFree,
                quad: panelQuad,
                bleed: node.bleed || null,
                lineWidth: Number.isFinite(node.lineWidth) ? node.lineWidth : null,
                deleted: node.deleted === true,
                number: numbers.get(node.id) ?? null,
                cornerSources: panelSrc
            });
            return;
        }
        if (node.dir === 'o') {
            // 重ね: aは領域そのまま、bはフリーコマ。幾何も間隔も一切変えない。
            walk(node.a, quad, src);
            walk(node.b, quad, src);
            return;
        }
        const gapPx = node.gap ?? (node.dir === 'v' ? params.gapV : params.gapH);
        const result = splitQuad(quad, node, gapPx, src);
        splits.push({
            id: node.id,
            dir: node.dir,
            cut: result.cut,
            region: quad,
            node,
            gap: gapPx,
            edges: result.edges,
            normal: result.normal
        });
        walk(node.a, result.a, result.aSrc);
        walk(node.b, result.b, result.bSrc);
    };
    walk(root, rootQuad, [0, 1, 2, 3].map(index => ({ type: 'root', index })));
    return { panels, splits, valid, params, rootBase };
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

/** 指定コマの頂点を tolerance 以内で拾う。返り値は index(0..3) または -1。 */
export function hitTestCorner(resolved, panelId, pt, tolerance = 8) {
    const panel = resolved.panels.find(p => p.id === panelId);
    if (!panel) return -1;
    let best = -1;
    let bestDist = tolerance;
    panel.quad.forEach((q, i) => {
        const dist = Math.hypot(pt.x - q.x, pt.y - q.y);
        if (dist <= bestDist) {
            bestDist = dist;
            best = i;
        }
    });
    return best;
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

// ---------------------------------------------------------------- 番号 / 吸着 / 整列

/** 右上から数える日本式の番号。deletedは番号を飛ばす。Map(panelId → 1..N) */
export function numberPanels(root) {
    const map = new Map();
    let n = 0;
    const walk = (node) => {
        if (node.kind === 'panel') {
            if (node.deleted !== true) map.set(node.id, (n += 1));
            return;
        }
        if (node.dir === 'v') {
            walk(node.b);
            walk(node.a);
        } else {
            walk(node.a);
            walk(node.b);
        }
    };
    walk(root);
    return map;
}

function isAxisAlignedRegion(region) {
    const [TL, TR, BR, BL] = region;
    const eps = 0.75;
    return Math.abs(TL.y - TR.y) < eps && Math.abs(BL.y - BR.y) < eps
        && Math.abs(TL.x - BL.x) < eps && Math.abs(TR.x - BR.x) < eps;
}

/** 他の同方向・水平/垂直な分割線の位置へ、ドラッグ中の点を吸着させる(snapPx以内)。 */
export function snapSplitPoint(resolved, splitId, pt, snapPx = 6) {
    const split = resolved.splits.find(s => s.id === splitId);
    if (!split) return pt;
    const axis = split.dir === 'h' ? 'y' : 'x';
    let best = null;
    let bestDist = snapPx;
    for (const other of resolved.splits) {
        if (other.id === splitId || other.dir !== split.dir || Math.abs(other.node.slant || 0) > 0.001) continue;
        const value = other.cut[0][axis];
        const dist = Math.abs(pt[axis] - value);
        if (dist <= bestDist) {
            bestDist = dist;
            best = value;
        }
    }
    return best === null ? pt : { ...pt, [axis]: best };
}

const NICE_RATIOS = [1 / 2, 1 / 3, 2 / 3, 1 / 4, 3 / 4, 1 / 5, 2 / 5, 3 / 5, 4 / 5];

/**
 * わずかなズレを整える: 小さな傾き→0、素直な分割比へスナップ、
 * 別々の列にある水平/垂直の分割線(ほぼ同じ位置)を同じ位置へ揃える。
 * @returns {{ tree, changed: number }}
 */
export function alignLayout(root, canvas, params, options = {}) {
    const tolPx = options.tolPx ?? 14;
    const tolSlant = options.tolSlant ?? 0.03;
    const tolRatio = options.tolRatio ?? 0.015;
    let tree = root;
    let changed = 0;

    const visit = (node) => {
        if (node.kind !== 'split') return;
        if (node.dir === 'o') {
            visit(node.a);
            visit(node.b);
            return;
        }
        if (node.slant && Math.abs(node.slant) < tolSlant) {
            tree = updateSplit(tree, node.id, { slant: 0 });
            changed += 1;
        }
        const target = NICE_RATIOS.find(r => Math.abs(r - node.ratio) < tolRatio && Math.abs(r - node.ratio) > 1e-6);
        if (target !== undefined) {
            tree = updateSplit(tree, node.id, { ratio: target });
            changed += 1;
        }
        visit(node.a);
        visit(node.b);
    };
    visit(root);

    // 位置の揃え: 1回に1クラスタずつ適用し、再解決して繰り返す(親の移動が子の領域を変えるため)
    for (let pass = 0; pass < 24; pass += 1) {
        const resolved = resolvePanelLayout(tree, canvas, params);
        let applied = false;
        for (const dir of ['h', 'v']) {
            const axis = dir === 'h' ? 'y' : 'x';
            const candidates = resolved.splits
                .filter(sp => sp.dir === dir && !sp.node.slant && isAxisAlignedRegion(sp.region))
                .map(sp => ({ sp, value: sp.cut[0][axis] }))
                .sort((a, b) => a.value - b.value);
            for (let i = 0; i < candidates.length && !applied; i += 1) {
                const group = [candidates[i]];
                for (let j = i + 1; j < candidates.length; j += 1) {
                    if (candidates[j].value - group[0].value <= tolPx) group.push(candidates[j]);
                }
                const mean = group.reduce((sum, g) => sum + g.value, 0) / group.length;
                if (group.length < 2 || group.every(g => Math.abs(g.value - mean) < 0.5)) continue;
                for (const g of group) {
                    const [TL, TR, BR, BL] = g.sp.region;
                    const start = dir === 'h' ? TL.y : TL.x;
                    const end = dir === 'h' ? BL.y : TR.x;
                    const ratio = (mean - start) / (end - start || 1);
                    tree = updateSplit(tree, g.sp.id, { ratio });
                    changed += 1;
                }
                applied = true;
            }
            if (applied) break;
        }
        if (!applied) break;
    }
    return { tree, changed };
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
