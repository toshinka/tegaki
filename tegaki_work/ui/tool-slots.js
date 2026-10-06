/**
 * ============================================================================
 * ファイル名: ui/tool-slots.js
 * 責務: QTPの「ツールスロット」(親ツール)とその仲間(メンバー)の定義、並び順・最後に使った仲間の記憶、順送りの計算
 * 依存: なし（DOM / Pixi非依存。実際の切替はQTPが registerSlotActivator で登録する）
 * 被依存: ui/quick-access-popup.js, ui/keyboard-handler.js, build/verify-tool-slots.mjs
 * 公開API: TOOL_SLOTS, slotOfTool, getSlot, orderMembers, nextMember, getLastMember, rememberMember, setMemberOrder,
 *   registerSlotActivator, activateToolSlot, activateNextInCurrentSlot
 * 保存: UI設定のみ(localStorage 'tegaki-qa-tool-slots-v1')。Project・Historyには関与しない。
 * 実装状態: ✅実装
 *
 * 考え方: 一行目=親スロット、二行目=選んだスロットの仲間。ショートカット(P/E/G…)は
 *   「別のスロットからなら最後に使った仲間へ、同じスロット内なら次の仲間へ順送り(ループ)」。
 *   仲間の並びは二行目のD&Dで入れ替えられ、その順が順送りの順になる。
 * ============================================================================
 */

const STORAGE_KEY = 'tegaki-qa-tool-slots-v1';
const MEMBER_ID_ALIASES = Object.freeze({
    'builtin-pen-square': 'builtin-pen-square-follow'
});

function canonicalMemberId(id) {
    return MEMBER_ID_ALIASES[id] || id;
}

/**
 * kind 'preset': 仲間は筆プリセット(presetTool のプリセット一覧が仲間になる)
 * kind 'tools' : 仲間は固定のツール(members)
 */
export const TOOL_SLOTS = Object.freeze([
    { id: 'pen', label: 'ペン', kind: 'preset', tool: 'pen', presetTool: 'pen', elementId: 'qa-pen-tool', icon: 'pen', action: 'TOOL_PEN' },
    { id: 'eraser', label: '消しゴム', kind: 'preset', tool: 'eraser', presetTool: 'eraser', elementId: 'qa-eraser-tool', icon: 'eraser', action: 'TOOL_ERASER',
        members: Object.freeze([
            { id: 'erase-polygon', tool: 'erase-polygon', label: '多角線消し', icon: 'shapePolygon', erase: true },
            { id: 'erase-lasso', tool: 'erase-lasso', label: '投げ縄塗り消し', icon: 'lasso', erase: true }
        ]) },
    { id: 'airbrush', label: 'エアブラシ', kind: 'preset', tool: 'airbrush', presetTool: 'airbrush', elementId: 'qa-airbrush-tool', icon: 'airbrush', action: 'TOOL_AIRBRUSH_BLUR_TOGGLE' },
    {
        id: 'bucket', label: 'バケツ', kind: 'tools', tool: 'fill', elementId: 'qa-fill-tool', icon: 'fill', action: 'TOOL_FILL',
        members: Object.freeze([
            { id: 'fill', tool: 'fill', label: 'バケツ', icon: 'fill' },
            { id: 'eraser-fill', tool: 'eraser-fill', label: '消しバケツ', icon: 'fill', erase: true },
            { id: 'gradient', tool: 'gradient', label: 'グラデーション', icon: 'gradient' },
            { id: 'border', tool: 'border', label: 'フチ', icon: 'borderFrame' }
        ])
    },
    {
        id: 'shape', label: '図形', kind: 'tools', tool: 'lasso-fill', elementId: 'qa-lasso-fill-tool', icon: 'lasso', action: 'TOOL_LASSO_FILL',
        members: Object.freeze([
            { id: 'lasso-fill', tool: 'lasso-fill', label: '投げ縄塗り', icon: 'lasso' },
            { id: 'shape-rect', tool: 'shape-rect', label: '四角', icon: 'shapeRect' },
            { id: 'shape-ellipse', tool: 'shape-ellipse', label: '楕円', icon: 'shapeEllipse' },
            { id: 'shape-polygon', tool: 'shape-polygon', label: '多角形', icon: 'shapePolygon' }
        ])
    },
    {
        id: 'select', label: '選択', kind: 'tools', tool: 'selection', elementId: 'qa-selection-tool', icon: 'rectangleSelect', action: 'TOOL_RECT_SELECTION',
        members: Object.freeze([
            { id: 'selection', tool: 'selection', label: '矩形選択', icon: 'rectangleSelect' },
            { id: 'auto-select', tool: 'auto-select', label: '自動選択', icon: 'autoSelect' }
        ])
    }
]);

const TOOL_TO_SLOT = Object.freeze({
    pen: 'pen',
    eraser: 'eraser',
    'erase-polygon': 'eraser',
    'erase-lasso': 'eraser',
    airbrush: 'airbrush',
    'airbrush-erase': 'airbrush',
    blur: 'airbrush',
    fill: 'bucket',
    'eraser-fill': 'bucket',
    gradient: 'bucket',
    border: 'bucket',
    'lasso-fill': 'shape',
    'shape-rect': 'shape',
    'shape-ellipse': 'shape',
    'shape-polygon': 'shape',
    selection: 'select',
    'auto-select': 'select'
});

export function slotOfTool(tool) {
    return TOOL_TO_SLOT[tool] || null;
}

export function getSlot(slotId) {
    return TOOL_SLOTS.find(slot => slot.id === slotId) || null;
}

let state = null;
const listeners = new Set();

function load() {
    if (state) return state;
    state = { order: {}, last: {} };
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        for (const slot of TOOL_SLOTS) {
            const order = data?.order?.[slot.id];
            if (Array.isArray(order)) state.order[slot.id] = order.filter(id => typeof id === 'string').slice(0, 40);
            const last = data?.last?.[slot.id];
            if (typeof last === 'string') state.last[slot.id] = last;
        }
    } catch (error) {
        // 壊れた設定は既定へ
    }
    return state;
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        // 保存不可でも動作は続ける
    }
    listeners.forEach(fn => fn());
}

/** 保存済みの並びを適用する。保存に無い仲間(新しく増えたもの)は末尾へ、無くなったものは捨てる。 */
export function orderMembers(slotId, availableIds) {
    const stored = load().order[slotId] || [];
    const ordered = [];
    for (const savedId of stored) {
        const id = canonicalMemberId(savedId);
        if (availableIds.includes(id) && !ordered.includes(id)) ordered.push(id);
    }
    for (const id of availableIds) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
}

export function getLastMember(slotId, availableIds) {
    const last = canonicalMemberId(load().last[slotId]);
    const ordered = orderMembers(slotId, availableIds);
    return ordered.includes(last) ? last : (ordered[0] ?? null);
}

export function rememberMember(slotId, memberId) {
    const s = load();
    const id = canonicalMemberId(memberId);
    if (s.last[slotId] === id) return;
    s.last[slotId] = id;
    save();
}

export function setMemberOrder(slotId, ids) {
    const unique = [];
    ids.filter(id => typeof id === 'string').forEach((id) => {
        const canonical = canonicalMemberId(id);
        if (!unique.includes(canonical)) unique.push(canonical);
    });
    load().order[slotId] = unique;
    save();
}

/** 現在の仲間の次(末尾の次は先頭)。仲間が1つなら自分。現在がこのスロットの仲間でなければ最後に使った仲間。 */
export function nextMember(slotId, availableIds, currentId) {
    const ordered = orderMembers(slotId, availableIds);
    if (!ordered.length) return null;
    const index = ordered.indexOf(currentId);
    if (index < 0) return getLastMember(slotId, availableIds);
    return ordered[(index + 1) % ordered.length];
}

export function onToolSlotsChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// ---- 切替の実行(QTPが登録)。キーボード側はQTPを直接知らずに呼べる。
let activator = null;

export function registerSlotActivator(fn) {
    activator = typeof fn === 'function' ? fn : null;
}

/** スロットを有効にする(別スロットなら最後の仲間、同じスロットなら順送り)。実行できたらtrue。 */
export function activateToolSlot(slotId) {
    return activator ? activator(slotId, { cycle: true }) === true : false;
}

/** 現在のスロットの次の仲間へ(Shift+L)。 */
export function activateNextInCurrentSlot() {
    return activator ? activator(null, { cycle: true, current: true }) === true : false;
}

/** テスト用: 状態を捨てて読み直す。 */
export function __resetToolSlotsForTest() {
    state = null;
}
