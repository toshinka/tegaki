import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moveLayerTransformKeyBundle } from '../system/animation/clip-layer-key-bundle.js';

const popupSource = readFileSync(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8');
assert.match(popupSource, /_beginLayerTransformKeyBundleDrag\(event, marker\)/);
assert.match(popupSource, /document\.addEventListener\('pointermove', onMove/);
assert.match(popupSource, /document\.addEventListener\('pointercancel', onEnd/);

function compileMethod(name, next, dependencies = {}) {
    const start = popupSource.indexOf(`\n    ${name}(`);
    const end = popupSource.indexOf(`\n    ${next}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source boundary`);
    const names = Object.keys(dependencies);
    return new Function(...names, `return ({${popupSource.slice(start, end)}}).${name};`)(
        ...names.map(key => dependencies[key])
    );
}

const points = Array.from({ length: 16 }, (_, index) => ({ x: index % 4, y: Math.floor(index / 4) }));
const makeState = () => ({
    clip: {
        id: 'clip-dnd', startFrame: 0, duration: 6,
        layerTransformTracks: [{
            internalLayerId: 'layer-1', pivotX: 50, pivotY: 50,
            keyframes: [{ frame: 1, interpolation: 'linear', x: 3, y: 4, scaleX: 1, scaleY: 1, rotation: 0 }]
        }],
        layerDeformers: {
            version: 1,
            targets: [{
                internalLayerId: 'layer-1',
                deformer: {
                    type: 'warp-grid', version: 1, columns: 4, rows: 4,
                    bindBounds: { x: 0, y: 0, width: 100, height: 100 },
                    bindPoints: points, points,
                    keyframes: [{ frame: 1, interpolation: 'hold', points }]
                }
            }]
        }
    }
});
const modelState = makeState();
const host = {
    selectedCelId: 'clip-dnd',
    model: { findClipEntry() { return modelState; } },
    layerSystem: { getLayerMoveCommitState() { return { active: false, hasPendingTransform: false }; } },
    _captureTimelineHistoryState() { return { revision: this.history.length }; },
    _syncWorkingLayersForCurrentFrame() {},
    render() {},
    _requestLayerPanelSync() {},
    _recordTimelineHistory(before, after, name, meta) { this.history.push({ before, after, name, meta }); },
    history: [],
    _selectLayerTransformKeyMarker() { this.clicked = true; }
};
const move = compileMethod('_moveLayerTransformKeyBundle', '_beginLayerTransformKeyBundleDrag', {
    moveLayerTransformKeyBundle,
    showFeedbackToast() {}
});
const begin = compileMethod('_beginLayerTransformKeyBundleDrag', '_hasActiveTimelineTransformNavigation', {
    moveLayerTransformKeyBundle,
    showFeedbackToast() {}
});
host._moveLayerTransformKeyBundle = move;

const listeners = new Map();
globalThis.document = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    dispatch(name, event) { listeners.get(name)?.(event); }
};
const slots = Array.from({ length: 6 }, (_, frame) => ({
    dataset: { frameIndex: String(frame) },
    classList: { add() {}, remove() {} }
}));
const row = { querySelectorAll() { return slots; } };
const marker = {
    dataset: {
        layerTransformKeyClipId: 'clip-dnd',
        layerTransformKeyInternalLayerId: 'layer-1',
        layerTransformKeyFrame: '1'
    },
    classList: { add() {}, remove() {} },
    closest() { return row; }
};
host.timelineCellWidth = 10;
host._layerTransformKeyBundleDrag = null;
host._layerTransformKeyClickSuppressed = false;
begin.call(host, {
    button: 0, pointerId: 7, clientX: 10,
    preventDefault() {}, stopPropagation() {}
}, marker);
globalThis.document.dispatch('pointermove', {
    pointerId: 7, clientX: 30, preventDefault() {}
});
globalThis.document.dispatch('pointerup', { pointerId: 7, type: 'pointerup' });
assert.equal(host.history.length, 1);
assert.deepEqual(modelState.clip.layerTransformTracks[0].keyframes.map(key => key.frame), [3]);
assert.deepEqual(modelState.clip.layerDeformers.targets[0].deformer.keyframes.map(key => key.frame), [3]);

const collision = move.call(host, {
    clipId: 'clip-dnd', internalLayerId: 'layer-1', sourceLocalFrame: 3
}, 3, host._captureTimelineHistoryState());
assert.equal(collision, false);
assert.equal(host.history.length, 1);

const sameFrame = move.call(host, {
    clipId: 'clip-dnd', internalLayerId: 'layer-1', sourceLocalFrame: 3
}, 3, host._captureTimelineHistoryState());
assert.equal(sameFrame, false);
assert.equal(host.history.length, 1);

host.layerSystem.getLayerMoveCommitState = () => ({ active: true, hasPendingTransform: true });
const before = JSON.stringify(modelState.clip);
const pendingStart = begin.call(host, {
    button: 0, pointerId: 8, clientX: 30,
    preventDefault() {}, stopPropagation() {}
}, marker);
assert.equal(pendingStart, true);
assert.equal(JSON.stringify(modelState.clip), before);
assert.equal(host.history.length, 1);

console.log('verify-layer-transform-key-bundle-dnd: PASS');
