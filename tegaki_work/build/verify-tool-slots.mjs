import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
assert.deepEqual(getSlot('shape').members.map(m => m.id), ['lasso-fill', 'shape-rect', 'shape-ellipse', 'shape-polygon']);
assert.equal(slotOfTool('shape-polygon'), 'shape');
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
// Square-pen migration: historical order and last-member values resolve to the follow preset.
const squareIds = ['builtin-pen-standard', 'builtin-pen-square-follow', 'builtin-pen-pencil'];
for (const savedSquareIds of [
    ['builtin-pen-square'],
    ['builtin-pen-square-follow'],
    ['builtin-pen-square', 'builtin-pen-square-follow']
]) {
    store.set('tegaki-qa-tool-slots-v1', JSON.stringify({
        order: { pen: ['builtin-pen-standard', ...savedSquareIds, 'builtin-pen-pencil'] },
        last: { pen: savedSquareIds[0] }
    }));
    slots.__resetToolSlotsForTest();
    assert.deepEqual(orderMembers('pen', squareIds), squareIds, `historical order resolves once: ${savedSquareIds.join(',')}`);
    assert.equal(getLastMember('pen', squareIds), 'builtin-pen-square-follow', `historical last member resolves: ${savedSquareIds[0]}`);
}
setMemberOrder('pen', ['builtin-pen-standard', 'builtin-pen-square', 'builtin-pen-square-follow', 'builtin-pen-pencil']);
assert.deepEqual(JSON.parse(store.get('tegaki-qa-tool-slots-v1')).order.pen, squareIds, 'writes canonicalize and deduplicate the square pen');
rememberMember('pen', 'builtin-pen-square');
assert.equal(JSON.parse(store.get('tegaki-qa-tool-slots-v1')).last.pen, 'builtin-pen-square-follow');
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

const [toolSlotsSource, qtpSource, qtpCss, reorderSource] = await Promise.all([
    readFile(new URL('../ui/tool-slots.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/quick-access-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/quick-access-popup.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/row-reorder.js', import.meta.url), 'utf8')
]);
assert.match(toolSlotsSource, /const STORAGE_KEY = 'tegaki-qa-tool-slots-v1'/, 'slot storage key remains unchanged');
assert.match(qtpSource, /const QA_SLOT_MEMBER_COLUMN_COUNT = 6/);
assert.match(qtpSource, /const QA_SLOT_MEMBER_LIMIT = QA_SLOT_MEMBER_COLUMN_COUNT - 1/, 'overflow reserves one of the six columns for disclosure');
assert.match(qtpSource, /members\.length > QA_SLOT_MEMBER_COLUMN_COUNT/, 'disclosure appears only above six members');
assert.match(qtpSource, /projectSlotMemberWindow\(members, activeId, projectionLimit\)/, 'collapsed projection includes the active member when needed');
assert.match(qtpSource, /const projectionLimit = hasOverflow \? QA_SLOT_MEMBER_LIMIT : QA_SLOT_MEMBER_COLUMN_COUNT/);
assert.match(qtpSource, /aria-expanded/);
assert.match(qtpSource, /aria-controls/);
assert.match(qtpSource, /nextOrder\.splice\(visibleStart, ids\.length, \.\.\.ids\)/, 'collapsed D&D only replaces the visible canonical slice');
assert.match(qtpCss, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/, 'the secondary shelf shares six equal tracks');
assert.match(qtpCss, /#quick-access-popup\.qa-popup \.qa-tool-grid\s*\{[^}]*width:\s*var\(--ui-qa-inner-width\)/s, 'the primary row uses the shared content width');
assert.match(qtpCss, /#quick-access-popup\.qa-popup \.qa-slot-members\s*\{[^}]*border:\s*0/s, 'the colored secondary shelf has no outer frame');
assert.match(qtpSource, /memberGrid\.appendChild\(disclosure\)/, 'overflow occupies a track inside the six-column shelf');
assert.doesNotMatch(qtpCss, /\.qa-slot-members\s*\{[^}]*min-height:\s*62px/, 'the permanent two-row reservation is removed');
assert.match(reorderSource, /const THRESHOLD = 7/);
assert.match(reorderSource, /qa-slot-drag-ghost/);
assert.match(reorderSource, /qa-slot-placeholder/);
assert.match(reorderSource, /window\.addEventListener\('pointercancel', pointerCancel\)/);
assert.match(reorderSource, /container\.replaceChildren\(\.\.\.originalChildren\)/, 'cancel restores the original children');
assert.match(reorderSource, /onReorder\?\.\(nextOrder\)/, 'only a changed drop order is committed');
console.log('tool slots verifier: slots / mapping / order+cycle / last member / persistence / activator ok');
