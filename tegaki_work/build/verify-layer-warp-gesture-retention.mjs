import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LayerTransformWarpController } from '../ui/layer-transform-warp-controller.js';

const clonePoints = points => points.map(point => ({ x: point.x, y: point.y }));
const makePoints = () => Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));

const baselinePoints = makePoints();
let activePoints = clonePoints(baselinePoints);
const previewCalls = [];
const trace = [];
let failNextPreview = false;

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
            points: clonePoints(activePoints),
            changed: !activePoints.every((point, index) => (
                point.x === baselinePoints[index].x && point.y === baselinePoints[index].y
            )),
            transaction: {
                timelineFrame: 0,
                internalLayerId: 'layer-1'
            }
        };
    },
    getLayerWarpAuthoringMotion() {
        return { ok: true, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } };
    },
    previewLayerWarpEditSession(points) {
        const next = clonePoints(points);
        previewCalls.push(next);
        if (failNextPreview) {
            failNextPreview = false;
            return { ok: false, reason: 'preview-refresh-failed' };
        }
        activePoints = next;
        return { ok: true, changed: true };
    }
};

const overlay = {
    options: null,
    activateCount: 0,
    activate(options) {
        this.options = options;
        this.activateCount += 1;
        return true;
    },
    deactivate() {
        this.options = null;
    },
    isActive() {
        return !!this.options;
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
    overlay,
    onTrace: event => trace.push(event)
});

const makeTarget = () => {
    const captures = new Set();
    return {
        isConnected: true,
        captures,
        setPointerCapture(pointerId) {
            captures.add(pointerId);
        },
        hasPointerCapture(pointerId) {
            return captures.has(pointerId);
        },
        releasePointerCapture(pointerId) {
            captures.delete(pointerId);
        }
    };
};

const makeEvent = ({ pointerId, clientX, clientY, currentTarget, type = 'mouse' }) => ({
    pointerId,
    pointerType: type,
    button: 0,
    buttons: 1,
    isPrimary: true,
    clientX,
    clientY,
    currentTarget,
    preventDefault() {},
    stopPropagation() {}
});

assert.equal(controller.begin(), true);
assert.equal(overlay.activateCount, 1);
const pointIndex = 5;
const callbacks = overlay.options;

// Normal down -> move A -> move B -> up retains B and does not rebuild the overlay.
const targetA = makeTarget();
callbacks.onPointPointerDown(pointIndex, makeEvent({ pointerId: 1, clientX: 20, clientY: 20, currentTarget: targetA }));
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 1, clientX: 48, clientY: 52, currentTarget: targetA }));
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 1, clientX: 76, clientY: 81, currentTarget: targetA }));
const retainedB = clonePoints(activePoints);
callbacks.onPointPointerUp(pointIndex, makeEvent({ pointerId: 1, clientX: 76, clientY: 81, currentTarget: targetA }));
assert.deepEqual(activePoints, retainedB, 'pointerup must retain the final preview');
assert.equal(controller.gesture, null);
assert.equal(overlay.activateCount, 1, 'preview must not recreate the overlay');
assert.equal(targetA.captures.size, 0, 'pointerup releases capture');

// A real cancel rolls only the active gesture back to its gesture baseline.
const targetB = makeTarget();
const beforeCancel = clonePoints(activePoints);
callbacks.onPointPointerDown(pointIndex, makeEvent({ pointerId: 2, clientX: 76, clientY: 81, currentTarget: targetB }));
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 2, clientX: 94, clientY: 96, currentTarget: targetB }));
callbacks.onPointPointerCancel(pointIndex, makeEvent({ pointerId: 2, clientX: 94, clientY: 96, currentTarget: targetB }));
assert.deepEqual(activePoints, beforeCancel, 'pointercancel must roll back the active gesture');
assert.equal(controller.gesture, null);

// A lost capture before pointerup has the same rollback contract.
const targetC = makeTarget();
callbacks.onPointPointerDown(pointIndex, makeEvent({ pointerId: 3, clientX: 76, clientY: 81, currentTarget: targetC }));
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 3, clientX: 12, clientY: 18, currentTarget: targetC }));
callbacks.onPointLostPointerCapture(pointIndex, makeEvent({ pointerId: 3, clientX: 12, clientY: 18, currentTarget: targetC }));
assert.deepEqual(activePoints, beforeCancel, 'lostpointercapture must roll back before pointerup');

// Late lost capture after pointerup is ignored and cannot undo the retained point.
const targetD = makeTarget();
callbacks.onPointPointerDown(pointIndex, makeEvent({ pointerId: 4, clientX: 76, clientY: 81, currentTarget: targetD }));
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 4, clientX: 62, clientY: 67, currentTarget: targetD }));
const retainedD = clonePoints(activePoints);
callbacks.onPointPointerUp(pointIndex, makeEvent({ pointerId: 4, clientX: 62, clientY: 67, currentTarget: targetD }));
const previewCountAfterUp = previewCalls.length;
callbacks.onPointLostPointerCapture(pointIndex, makeEvent({ pointerId: 4, clientX: 62, clientY: 67, currentTarget: targetD }));
assert.deepEqual(activePoints, retainedD, 'late lostpointercapture must not rollback pointerup');
assert.equal(previewCalls.length, previewCountAfterUp);

// A preview failure is still an explicit rollback cause; the verifier keeps it distinct.
const targetE = makeTarget();
const beforeFailure = clonePoints(activePoints);
callbacks.onPointPointerDown(pointIndex, makeEvent({ pointerId: 5, clientX: 62, clientY: 67, currentTarget: targetE }));
failNextPreview = true;
callbacks.onPointPointerMove(pointIndex, makeEvent({ pointerId: 5, clientX: 63, clientY: 68, currentTarget: targetE }));
assert.deepEqual(activePoints, beforeFailure);
assert.equal(controller.gesture, null);

const eventTypes = trace.map(event => event.type);
assert.deepEqual(
    eventTypes,
    ['pointerdown', 'pointermove', 'pointermove', 'pointerup', 'pointerdown', 'pointermove',
        'pointercancel', 'pointerdown', 'pointermove', 'lostpointercapture', 'pointerdown',
        'pointermove', 'pointerup', 'pointerdown', 'pointermove'],
    'diagnostic trace must preserve the gesture event order'
);
assert.equal(trace[0].capture, 'success');
assert.equal(trace[2].preview.ok, true);
assert.deepEqual(trace[2].sessionPoint, retainedB[pointIndex]);
assert.equal(trace.find(event => event.type === 'pointercancel').terminal, 'rollback');
assert.equal(trace.find(event => event.type === 'lostpointercapture').terminal, 'rollback');
assert.equal(trace.at(-1).preview.reason, 'preview-refresh-failed');
assert.equal(trace.at(-1).targetConnected, true);

const css = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');
assert.match(css, /\.warp-grid-overlay\.is-interactive\s*\{[^}]*touch-action:\s*none/s,
    'interactive WARP overlay must own browser touch arbitration');
assert.match(css, /\.warp-grid-overlay\.is-interactive \.warp-grid-overlay-point-hit\s*\{[^}]*touch-action:\s*none/s,
    'interactive WARP point hit target must own browser touch arbitration');

console.log('Layer WARP gesture retention verifier passed: final preview retention, cancel/lost rollback, late lost capture, preview failure, trace order, and scoped touch-action are fixed.');
