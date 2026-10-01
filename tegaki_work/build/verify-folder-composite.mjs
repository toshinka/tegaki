import assert from 'node:assert/strict';
import { collectCompositedFolderIds, isCompositedFolderData } from '../system/folder-composite.js';

const L = (id, extra = {}) => ({ layerData: { id, isFolder: false, isBackground: false, opacity: 1, blendMode: 'normal', children: [], ...extra } });
const F = (id, children, extra = {}) => ({ layerData: { id, isFolder: true, isBackground: false, opacity: 1, blendMode: 'normal', children, ...extra } });

// 合成フォルダの判定: 合成モードが通常でない or 不透明度<1。通常Layer・背景は対象外
assert.equal(isCompositedFolderData(F('f', []).layerData), false);
assert.equal(isCompositedFolderData(F('f', [], { blendMode: 'multiply' }).layerData), true);
assert.equal(isCompositedFolderData(F('f', [], { opacity: 0.5 }).layerData), true);
assert.equal(isCompositedFolderData(F('f', [], { opacity: 0.9995 }).layerData), false, '誤差は通常扱い');
assert.equal(isCompositedFolderData(L('a', { blendMode: 'multiply' }).layerData), false);
assert.equal(isCompositedFolderData(null), false);

// 集合: 子孫に通常Layerが無いフォルダは対象外。入れ子の合成フォルダも拾う
{
    const a = L('a');
    const b = L('b');
    const empty = F('empty', [], { blendMode: 'multiply' });
    const inner = F('inner', ['b'], { opacity: 0.5 });
    const outer = F('outer', ['a', 'inner'], { blendMode: 'multiply' });
    const plain = F('plain', ['inner']);
    assert.deepEqual([...collectCompositedFolderIds([a, empty])], [], '空フォルダは対象外');
    assert.deepEqual([...collectCompositedFolderIds([b, inner, a, outer])].sort(), ['inner', 'outer']);
    assert.deepEqual([...collectCompositedFolderIds([b, inner, plain])], ['inner'], '通常フォルダは対象外');
    // 背景だけを子に持つフォルダは対象外
    const bg = L('bg', { isBackground: true });
    assert.deepEqual([...collectCompositedFolderIds([bg, F('onlybg', ['bg'], { blendMode: 'add' })])], []);
}

// 循環参照でも止まる
{
    const a = F('a', ['b'], { blendMode: 'multiply' });
    const b = F('b', ['a']);
    assert.deepEqual([...collectCompositedFolderIds([a, b])], []);
}

console.log('folder-composite verifier: composited-folder detection / nesting / empty and cyclic folders ok');
