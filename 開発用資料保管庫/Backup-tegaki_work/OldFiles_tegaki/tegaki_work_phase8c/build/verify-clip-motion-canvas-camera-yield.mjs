import assert from 'node:assert/strict';

globalThis.window = { cameraSystem: { spacePressed: false } };
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');

const createContext = (overrides = {}) => ({
    layerSystem: { cameraSystem: { spacePressed: true } },
    _motionCanvasGesture: null,
    _partCanvasGesture: null,
    _boneCanvasGesture: null,
    _warpGridGesture: null,
    _warpBrushShortcutControl: null,
    ...overrides
});
const plainLeftPointer = {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false
};
const shouldYield = (context, event = plainLeftPointer) => (
    AnimationTablePopup.prototype._shouldYieldMotionCanvasPointerToCamera.call(context, event)
);

assert.equal(
    shouldYield(createContext()),
    true,
    'plain Space + left pointer yields CLIP Motion capture to CameraSystem'
);
assert.equal(
    shouldYield(createContext({ layerSystem: null })),
    false,
    'window CameraSystem fallback still requires an active Space key'
);

for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    assert.equal(
        shouldYield(createContext(), { ...plainLeftPointer, [modifier]: true }),
        false,
        `${modifier} keeps its existing CLIP Motion/camera shortcut semantics`
    );
}
assert.equal(
    shouldYield(createContext(), { ...plainLeftPointer, button: 2 }),
    false,
    'only left-pointer Space drag uses the new yield path'
);
assert.equal(
    shouldYield(createContext({ layerSystem: { cameraSystem: { spacePressed: false } } })),
    false,
    'ordinary CLIP Motion drag remains captured when Space is not pressed'
);

for (const gesture of [
    '_motionCanvasGesture',
    '_partCanvasGesture',
    '_boneCanvasGesture',
    '_warpGridGesture',
    '_warpBrushShortcutControl'
]) {
    assert.equal(
        shouldYield(createContext({ [gesture]: {} })),
        false,
        `${gesture} is never handed off after a CLIP Motion gesture has started`
    );
}

console.log('verify-clip-motion-canvas-camera-yield: plain Space yield and conflict guards OK');
