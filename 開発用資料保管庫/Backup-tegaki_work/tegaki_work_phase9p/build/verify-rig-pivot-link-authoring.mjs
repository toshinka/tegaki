import assert from 'node:assert/strict';

const { RigPivotOverlay } = await import('../ui/rig-pivot-overlay.js');

const overlay = new RigPivotOverlay();
overlay._renderLinkPreview = () => {};
overlay.screenItems = [
    { id: 'child', kind: 'folder', configured: true, root: { x: 20, y: 20 } },
    { id: 'parent-near', kind: 'folder', configured: true, root: { x: 80, y: 80 } },
    { id: 'parent-far', kind: 'folder', configured: true, root: { x: 160, y: 160 } },
    { id: 'candidate', kind: 'folder', configured: false, root: { x: 82, y: 82 } },
    { id: 'caf', kind: 'caf', configured: true, root: { x: 81, y: 81 } }
];
overlay.gesture = {
    pointerId: 1,
    itemId: 'child',
    mode: 'link',
    clientX: 20,
    clientY: 20,
    linkTargetId: null
};
overlay._moveLinkGesture({ clientX: 81, clientY: 81 });
assert.equal(
    overlay.gesture.linkTargetId,
    'parent-near',
    'nearest configured non-CAF PIVOT becomes the link target'
);

let committed = null;
overlay.options = {
    onLinkEnd: (childItemId, parentItemId, result) => {
        committed = { childItemId, parentItemId, cancelled: result.cancelled };
    }
};
overlay.element = {
    hasPointerCapture: () => false,
    classList: { remove: () => {} },
    querySelector: () => null,
    querySelectorAll: () => []
};
overlay._finishGesture({
    pointerId: 1,
    preventDefault: () => {},
    stopImmediatePropagation: () => {}
}, false);
assert.deepEqual(committed, {
    childItemId: 'child',
    parentItemId: 'parent-near',
    cancelled: false
}, 'link release forwards one child/parent authoring result');

let selected = null;
committed = null;
overlay.options = {
    onSelect: itemId => { selected = itemId; },
    onLinkEnd: () => { committed = 'unexpected'; }
};
overlay.gesture = {
    pointerId: 2,
    itemId: 'child',
    mode: 'pending-link'
};
overlay._finishGesture({
    pointerId: 2,
    preventDefault: () => {},
    stopImmediatePropagation: () => {}
}, false);
assert.equal(selected, 'child', 'short root press keeps the existing selection gesture');
assert.equal(committed, null, 'short root press does not change parentBoneId');

console.log('verify-rig-pivot-link-authoring: nearest target, commit, and short-press fallback OK');
