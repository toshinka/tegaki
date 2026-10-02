import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const slots = await import('../ui/tool-slots.js');
const { TOOL_SLOTS, slotOfTool, getSlot, orderMembers, nextMember, getLastMember, rememberMember, setMemberOrder, registerSlotActivator, activateToolSlot, activateNextInCurrentSlot } = slots;

// 親スロットとツールの対応
assert.deepEqual(TOOL_SLOTS.map(s => s.id), ['pen', 'eraser', 'airbrush', 'bucket', 'shape', 'select']);
for (const [tool, slot] of Object.entries({ pen: 'pen', eraser: 'eraser', 'airbrush-erase': 'airbrush', 'eraser-fill': 'bucket', gradient: 'bucket', 'lasso-fill': 'shape', 'shape-rect': 'shape', 'shape-ellipse': 'shape', border: 'bucket', 'auto-select': 'select', selection: 'select' })) {
    assert.equal(slotOfTool(tool), slot, tool);
}
assert.equal(slotOfTool('eyedropper'), null);
// バケツ枠は 普通/消し/グラデ の三つ(規格違いにならない)
assert.deepEqual(getSlot('bucket').members.map(m => m.id), ['fill', 'eraser-fill', 'gradient', 'border']);
assert.deepEqual(getSlot('shape').members.map(m => m.id), ['lasso-fill', 'shape-rect', 'shape-ellipse']);
assert.deepEqual(getSlot('select').members.map(m => m.id), ['selection', 'auto-select']);

// 並び: 保存順 + 新しい仲間は末尾 + 消えた仲間は捨てる
const ids = ['a', 'b', 'c', 'd'];
assert.deepEqual(orderMembers('pen', ids), ids);
setMemberOrder('pen', ['c', 'a', 'zzz']);
assert.deepEqual(orderMembers('pen', ids), ['c', 'a', 'b', 'd']);
// 順送り(ループ)
assert.equal(nextMember('pen', ids, 'c'), 'a');
assert.equal(nextMember('pen', ids, 'd'), 'c', 'wraps to the first');
assert.equal(nextMember('pen', ['x'], 'x'), 'x', 'single member stays');
// 最後に使った仲間
assert.equal(getLastMember('pen', ids), 'c', 'defaults to the first');
rememberMember('pen', 'b');
assert.equal(getLastMember('pen', ids), 'b');
assert.equal(getLastMember('pen', ['a', 'c']), 'c', 'last member gone → first');
assert.equal(nextMember('pen', ids, 'not-a-member'), 'b', 'not in slot → last used');
// 保存の往復
const saved = JSON.parse(store.get('tegaki-qa-tool-slots-v1'));
assert.deepEqual(saved.order.pen, ['c', 'a', 'zzz']);
assert.equal(saved.last.pen, 'b');
slots.__resetToolSlotsForTest();
assert.equal(getLastMember('pen', ids), 'b', 'reloaded from storage');
// 壊れた保存は既定へ
store.set('tegaki-qa-tool-slots-v1', '{broken');
slots.__resetToolSlotsForTest();
assert.deepEqual(orderMembers('pen', ids), ids);

// 切替の実行はQTPが登録する。未登録ならfalse(キーボード側が従来処理へ戻る)
assert.equal(activateToolSlot('pen'), false);
const calls = [];
registerSlotActivator((id, opt) => { calls.push([id, opt]); return true; });
assert.equal(activateToolSlot('pen'), true);
assert.equal(activateNextInCurrentSlot(), true);
assert.deepEqual(calls[0], ['pen', { cycle: true }]);
assert.deepEqual(calls[1], [null, { cycle: true, current: true }]);
console.log('tool slots verifier: slots / mapping / order+cycle / last member / persistence / activator ok');
