/**
 * ============================================================================
 * ファイル名: ui/tool-group.js
 * 責務: QTPの「図形・範囲」ツールグループ(選択・投げ縄塗り…)の状態。現在の代表ツール、Shift+Lの送り、二行目を開くか
 * 依存: なし
 * 被依存: ui/quick-access-popup.js, ui/keyboard-handler.js
 * 公開API: TOOL_GROUP_MEMBERS, getToolGroupState, setToolGroupCurrent, setToolGroupOpen, cycleToolGroup
 * 保存: UI設定のみ(localStorage 'tegaki-qa-tool-group')。Project・Historyには関与しない。
 * 実装状態: ✅実装
 *
 * メンバーを増やすときはここへ足す(矩形/円/楕円/多角形など)。送りは前へ戻らず一方向でループする。
 * ============================================================================
 */

const STORAGE_KEY = 'tegaki-qa-tool-group';

/** tool: QTP/keyboardが使うtool名 / elementId: QTPのボタンid */
export const TOOL_GROUP_MEMBERS = Object.freeze([
    { tool: 'selection', label: '矩形選択', elementId: 'qa-selection-tool', icon: 'rectangleSelect' },
    { tool: 'lasso-fill', label: '投げ縄塗り', elementId: 'qa-lasso-fill-tool', icon: 'lasso' },
    { tool: 'auto-select', label: '自動選択', elementId: 'qa-auto-select-tool', icon: 'autoSelect' },
    { tool: 'gradient', label: 'グラデーション', elementId: 'qa-gradient-tool', icon: 'gradient' }
]);

const state = { current: 'lasso-fill', open: true };
let loaded = false;
const listeners = new Set();

function load() {
    if (loaded) return;
    loaded = true;
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (TOOL_GROUP_MEMBERS.some(m => m.tool === data?.current)) state.current = data.current;
        if (typeof data?.open === 'boolean') state.open = data.open;
    } catch (error) {
        // 壊れた設定は既定へ
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        // 保存不可でも動作は続ける
    }
    listeners.forEach(fn => fn({ ...state }));
}

export function getToolGroupState() {
    load();
    return { ...state };
}

export function isToolGroupMember(tool) {
    return TOOL_GROUP_MEMBERS.some(m => m.tool === tool);
}

export function setToolGroupCurrent(tool) {
    load();
    if (!isToolGroupMember(tool) || state.current === tool) return;
    state.current = tool;
    save();
}

export function setToolGroupOpen(open) {
    load();
    state.open = open === true;
    save();
}

/** 次のメンバーへ送る(末尾の次は先頭)。選ぶべきtool名を返す。 */
export function cycleToolGroup(fromTool = null) {
    load();
    const base = isToolGroupMember(fromTool) ? fromTool : state.current;
    const index = TOOL_GROUP_MEMBERS.findIndex(m => m.tool === base);
    const next = TOOL_GROUP_MEMBERS[(index + 1) % TOOL_GROUP_MEMBERS.length].tool;
    // 現在がグループ外のツールなら、送らずに代表ツールを選ぶ(初回のShift+Lで代表が出る)
    const target = isToolGroupMember(fromTool) || fromTool == null ? next : state.current;
    setToolGroupCurrent(target);
    return target;
}

export function onToolGroupChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
