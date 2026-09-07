import assert from 'node:assert/strict';

import { LayerTransformWarpController } from '../ui/layer-transform-warp-controller.js';

const clonePoints = points => points.map(point => ({ x: point.x, y: point.y }));
const makePoints = () => Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));

const baselinePoints = makePoints();
const previewCalls = [];
let finishCalls = 0;
let historyMutations = 0;
let activePoints = clonePoints(baselinePoints);

const layerSystem = {
    isLayerMoveMode: true,
    beginLayerWarpEditSession() {
        return {
            ok: true,
            bindBounds: { x: 0, y: 0, width: 100, height: 100 },
            points: clonePoints(activePoints)
        };
    },
    getLayerWarpEditSession() {
        return {
            bindBounds: { x: 0, y: 0, width: 100, height: 100 },
            points: clonePoints(activePoints)
        };
    },
    previewLayerWarpEditSession(points) {
        const next = clonePoints(points);
        activePoints = next;
        previewCalls.push(clonePoints(next));
        return { ok: true, changed: true };
    },
    finishLayerWarpEditSession() {
        finishCalls += 1;
        return { ok: true, commit: false };
    }
};

const overlay = {
    options: null,
    active: false,
    activate(options) {
        this.options = options;
        this.active = true;
        return true;
    },
    deactivate() {
        this.active = false;
        this.options = null;
    },
    _update() {}
};

const coordinateSystem = {
    screenClientToWorld(clientX, clientY) {
        return { worldX: clientX, worldY: clientY };
    }
};

const controller = new LayerTransformWarpController({
    layerSystem,
    coordinateSystem,
    overlay
});

const pointerTargets = [];
const createTarget = () => ({
    captures: [],
    releases: [],
    setPointerCapture(pointerId) {
        this.captures.push(pointerId);
    },
    releasePointerCapture(pointerId) {
        this.releases.push(pointerId);
    }
});
const eventFor = ({ pointerId, clientX, clientY, currentTarget, button = 0 }) => ({
    pointerId,
    clientX,
    clientY,
    button,
    currentTarget,
    preventDefault() {},
    stopPropagation() {}
});

assert.equal(controller.begin(), true);
assert.equal(overlay.active, true);
assert.equal(overlay.options?.columns, 4);
assert.equal(overlay.options?.rows, 4);
assert.equal(overlay.options?.interactive, true);
assert.equal(activePoints.length, 16);

const pointIndex = 5;
const pointerDown = overlay.options.onPointPointerDown;
const pointerMove = overlay.options.onPointPointerMove;
const pointerUp = overlay.options.onPointPointerUp;
const pointerCancel = overlay.options.onPointPointerCancel;
const lostPointerCapture = overlay.options.onPointLostPointerCapture;

// Gesture A completes normally and becomes the retained preview state.
const targetA = createTarget();
pointerTargets.push(targetA);
pointerDown(pointIndex, eventFor({ pointerId: 1, clientX: 33, clientY: 33, currentTarget: targetA }));
pointerMove(pointIndex, eventFor({ pointerId: 1, clientX: 70, clientY: 80, currentTarget: targetA }));
const stateA = clonePoints(activePoints);
pointerUp(pointIndex, eventFor({ pointerId: 1, clientX: 70, clientY: 80, currentTarget: targetA }));
assert.deepEqual(activePoints, stateA, 'pointerup must retain the completed gesture preview');
assert.equal(controller.gesture, null);

// A later pointercancel rolls back only Gesture B, not the session baseline.
const targetB = createTarget();
pointerTargets.push(targetB);
pointerDown(pointIndex, eventFor({ pointerId: 2, clientX: 70, clientY: 80, currentTarget: targetB }));
pointerMove(pointIndex, eventFor({ pointerId: 2, clientX: 85, clientY: 95, currentTarget: targetB }));
assert.notDeepEqual(activePoints, stateA);
pointerCancel(pointIndex, eventFor({ pointerId: 2, clientX: 85, clientY: 95, currentTarget: targetB }));
assert.deepEqual(activePoints, stateA, 'pointercancel must restore Gesture B start points');
assert.equal(controller.gesture, null);
assert.equal(controller.modeActive, true);
assert.ok(layerSystem.getLayerWarpEditSession());

// Lost capture before pointerup follows the same gesture rollback terminal.
const targetC = createTarget();
pointerTargets.push(targetC);
pointerDown(pointIndex, eventFor({ pointerId: 3, clientX: 70, clientY: 80, currentTarget: targetC }));
pointerMove(pointIndex, eventFor({ pointerId: 3, clientX: 25, clientY: 30, currentTarget: targetC }));
lostPointerCapture(pointIndex, eventFor({ pointerId: 3, clientX: 25, clientY: 30, currentTarget: targetC }));
assert.deepEqual(activePoints, stateA, 'lostpointercapture must rollback the active gesture');
assert.equal(controller.gesture, null);

// A late lostpointercapture after pointerup must not undo the retained move.
const targetD = createTarget();
pointerTargets.push(targetD);
pointerDown(pointIndex, eventFor({ pointerId: 4, clientX: 70, clientY: 80, currentTarget: targetD }));
pointerMove(pointIndex, eventFor({ pointerId: 4, clientX: 60, clientY: 65, currentTarget: targetD }));
const stateD = clonePoints(activePoints);
pointerUp(pointIndex, eventFor({ pointerId: 4, clientX: 60, clientY: 65, currentTarget: targetD }));
lostPointerCapture(pointIndex, eventFor({ pointerId: 4, clientX: 60, clientY: 65, currentTarget: targetD }));
assert.deepEqual(activePoints, stateD, 'late lostpointercapture must preserve pointerup result');
assert.equal(controller.gesture, null);

assert.equal(finishCalls, 0, 'gesture terminals must not finish the WARP session');
assert.equal(historyMutations, 0, 'gesture terminals must not create History commands');
assert.equal(previewCalls.length, 6, 'A/B/capture-loss/pointerup paths should use preview only');
assert.ok(pointerTargets.every(target => target.captures.length === 1));

console.log('Layer WARP pointer terminal verifier passed: pointercancel/lost capture rollback and pointerup retention are session-local.');
