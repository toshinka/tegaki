import assert from 'node:assert/strict';

// LayerTransform and its event-bus dependency register compatibility globals at
// module load. The verifier supplies only the browser surface needed by the
// production pointer path; it does not replace the production classes.
globalThis.window = { TEGAKI_CONFIG: { debug: false } };
globalThis.document = {
    getElementById() {
        return null;
    },
    querySelector() {
        return null;
    },
    querySelectorAll() {
        return [];
    },
    addEventListener() {},
    removeEventListener() {}
};

const { LayerTransform } = await import('../system/layer-transform.js');
const { LayerTransformWarpController } = await import('../ui/layer-transform-warp-controller.js');

const listeners = new Map();
const captures = [];
const releases = [];
const canvas = {
    style: {},
    addEventListener(type, handler) {
        listeners.set(type, handler);
    },
    setPointerCapture(pointerId) {
        captures.push(pointerId);
    },
    releasePointerCapture(pointerId) {
        releases.push(pointerId);
    }
};

const coordinateSystem = {
    screenClientToWorld(clientX, clientY) {
        return { worldX: clientX, worldY: clientY };
    }
};

const pointerEvent = ({ pointerId = 1, clientX = 20, clientY = 30, button = 0 } = {}) => ({
    pointerId,
    clientX,
    clientY,
    button,
    shiftKey: false,
    preventDefaultCalled: false,
    preventDefault() {
        this.preventDefaultCalled = true;
    }
});

const transform = Object.create(LayerTransform.prototype);
transform.isVKeyPressed = true;
transform.isDragging = false;
transform.dragPointerId = null;
transform.dragTransformMode = null;
transform.dragStartPoint = { x: 0, y: 0 };
transform.dragLastPoint = { x: 0, y: 0 };
transform.transformMode = 'basic';
transform.coordinateSystem = coordinateSystem;
transform.transformPanel = null;
transform._getSafeCanvas = () => canvas;
let basicDragRequests = 0;
transform.onDragRequest = () => {
    basicDragRequests += 1;
};

transform._setupDragEvents();
assert.equal(listeners.has('pointerdown'), true, 'production canvas pointerdown listener must be installed');
assert.equal(listeners.has('pointermove'), true, 'production canvas pointermove listener must be installed');
assert.equal(listeners.has('pointerup'), true, 'production canvas pointerup listener must be installed');
assert.equal(listeners.has('pointercancel'), true, 'production canvas pointercancel listener must be installed');

// BASIC body drag remains the existing Layer Motion entry path.
const basicDown = pointerEvent({ pointerId: 11, clientX: 10, clientY: 20 });
listeners.get('pointerdown')(basicDown);
assert.equal(transform.isDragging, true);
assert.equal(transform.dragPointerId, 11);
assert.equal(basicDown.preventDefaultCalled, true);
listeners.get('pointermove')(pointerEvent({ pointerId: 11, clientX: 15, clientY: 27 }));
assert.equal(basicDragRequests, 1, 'BASIC body drag must call production onDragRequest');
listeners.get('pointerup')(pointerEvent({ pointerId: 11, clientX: 15, clientY: 27 }));
assert.equal(transform.isDragging, false);
assert.equal(transform.dragPointerId, null);
assert.deepEqual(captures, [11]);
assert.deepEqual(releases, [11]);

// WARP body drag must not enter the BASIC canvas gesture at all.
transform.transformMode = 'warp';
const warpBodyDown = pointerEvent({ pointerId: 12, clientX: 100, clientY: 120 });
listeners.get('pointerdown')(warpBodyDown);
assert.equal(transform.isDragging, false, 'WARP body pointerdown must not start BASIC dragging');
assert.equal(transform.dragPointerId, null);
assert.equal(warpBodyDown.preventDefaultCalled, false, 'WARP body gate must not consume the canvas event');
listeners.get('pointermove')(pointerEvent({ pointerId: 12, clientX: 130, clientY: 150 }));
listeners.get('pointerup')(pointerEvent({ pointerId: 12, clientX: 130, clientY: 150 }));
assert.equal(basicDragRequests, 1, 'WARP body drag must not call BASIC onDragRequest');

// The production WARP controller still owns point gestures and their preview
// session. This is intentionally separate from the generic canvas body path.
const baselinePoints = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));
let activePoints = baselinePoints.map(point => ({ ...point }));
let previewCalls = 0;
const overlay = {
    options: null,
    activate(options) {
        this.options = options;
        return true;
    },
    deactivate() {}
};
const layerSystem = {
    isLayerMoveMode: true,
    beginLayerWarpEditSession() {
        return {
            ok: true,
            bindBounds: { x: 0, y: 0, width: 100, height: 100 },
            points: activePoints.map(point => ({ ...point }))
        };
    },
    getLayerWarpEditSession() {
        return {
            bindBounds: { x: 0, y: 0, width: 100, height: 100 },
            points: activePoints.map(point => ({ ...point }))
        };
    },
    getLayerWarpAuthoringMotion() {
        return { ok: true, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } };
    },
    previewLayerWarpEditSession(points) {
        activePoints = points.map(point => ({ ...point }));
        previewCalls += 1;
        return { ok: true, changed: true };
    },
    getLayerMoveCommitState() {
        return { hasPendingTransform: false };
    }
};
const warpController = new LayerTransformWarpController({
    layerSystem,
    coordinateSystem,
    overlay
});
assert.equal(warpController.begin(), true);
const pointTarget = {
    setPointerCapture() {},
    releasePointerCapture() {}
};
const event = {
    pointerId: 21,
    clientX: 30,
    clientY: 40,
    button: 0,
    currentTarget: pointTarget,
    preventDefault() {},
    stopPropagation() {}
};
overlay.options.onPointPointerDown(5, event);
overlay.options.onPointPointerMove(5, { ...event, clientX: 60, clientY: 70 });
assert.equal(previewCalls, 1, 'WARP point drag must reach production previewLayerWarpEditSession');
overlay.options.onPointPointerUp(5, { ...event, clientX: 60, clientY: 70 });
assert.equal(warpController.gesture, null);
assert.equal(layerSystem.getLayerMoveCommitState().hasPendingTransform, false);

console.log('Layer Transform WARP body-drag isolation verifier passed: BASIC body drag remains active, WARP body drag is gated, and WARP point preview remains production-owned.');
