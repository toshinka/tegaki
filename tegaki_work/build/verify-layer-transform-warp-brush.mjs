/**
 * WP-008: production WARP POINT/BRUSH adapter contract.
 *
 * This uses the actual LayerTransformWarpController with an isolated host for
 * LayerSystem and coordinate conversion. The host records preview calls and
 * commits, but the controller, brush algorithm, and gesture terminal logic
 * are production code.
 */
import assert from 'node:assert/strict';
import {
    LayerTransformWarpController,
    WARP_BRUSH_TYPES,
    WARP_INTERACTION_TOOLS
} from '../ui/layer-transform-warp-controller.js';

const BASE_POINTS = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));

function clonePoints(points) {
    return points.map(point => ({ ...point }));
}

function changed(a, b) {
    return a.some((point, index) => (
        Math.abs(point.x - b[index].x) > 1e-9 || Math.abs(point.y - b[index].y) > 1e-9
    ));
}

function makeTarget() {
    return {
        isConnected: true,
        captured: null,
        setPointerCapture(pointerId) { this.captured = pointerId; },
        releasePointerCapture(pointerId) {
            if (this.captured === pointerId) this.captured = null;
        },
        hasPointerCapture(pointerId) { return this.captured === pointerId; }
    };
}

function makeHarness() {
    const previews = [];
    let points = clonePoints(BASE_POINTS);
    let baseline = clonePoints(BASE_POINTS);
    let session = null;
    let history = 0;
    const overlay = {
        active: false,
        activate(options) { this.active = true; this.options = options; return true; },
        deactivate() { this.active = false; this.options = null; },
        isActive() { return this.active; },
        _update() {}
    };
    const layerSystem = {
        beginLayerWarpEditSession() {
            baseline = clonePoints(points);
            session = {
                bindBounds: { x: 0, y: 0, width: 100, height: 100 },
                points: clonePoints(points),
                changed: false,
                transaction: { baselinePoints: clonePoints(points), internalLayerId: 'layer-1', timelineFrame: 1 }
            };
            return { ok: true, bindBounds: session.bindBounds, points: session.points };
        },
        getLayerWarpEditSession() { return session; },
        getLayerWarpAuthoringMotion() {
            return { ok: true, matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } };
        },
        previewLayerWarpEditSession(nextPoints) {
            assert.equal(nextPoints.length, 16, 'preview always uses the shared 16-point authority');
            session.points = clonePoints(nextPoints);
            session.changed = changed(session.points, baseline);
            previews.push(clonePoints(nextPoints));
            return { ok: true, changed: session.changed };
        },
        finishLayerWarpEditSession({ cancelled = false } = {}) {
            if (!session) return { ok: true, commit: false };
            if (cancelled) {
                session.points = clonePoints(baseline);
                session.changed = false;
                points = clonePoints(baseline);
            } else if (session.changed) {
                points = clonePoints(session.points);
                history += 1;
            }
            const commit = !cancelled && session.changed;
            session = null;
            return { ok: true, commit };
        }
    };
    const coordinateSystem = {
        screenClientToWorld(clientX, clientY) { return { worldX: clientX, worldY: clientY }; },
        worldToScreenImmediate(x, y) { return { clientX: x, clientY: y }; }
    };
    const controller = new LayerTransformWarpController({
        layerSystem,
        coordinateSystem,
        overlay
    });
    controller.begin();
    return {
        controller,
        layerSystem,
        overlay,
        previews,
        get points() { return points; },
        get history() { return history; }
    };
}

function event(target, pointerId, clientX, clientY) {
    return {
        pointerId,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX,
        clientY,
        currentTarget: target,
        preventDefault() {},
        stopPropagation() {}
    };
}

// POINT remains the default, and the point mode never claims canvas-body drag.
const pointCase = makeHarness();
assert.equal(pointCase.controller.getInteractionTool(), WARP_INTERACTION_TOOLS.POINT);
assert.equal(pointCase.controller.handleCanvasPointerDown(event(makeTarget(), 1, 50, 50)), false);
assert.equal(pointCase.previews.length, 0);

// POINT -> BRUSH -> POINT keeps one pending session and never manufactures a
// key while the tools are switched.
const moveCase = makeHarness();
const moveTarget = makeTarget();
assert.equal(moveCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.BRUSH), true);
const moveStart = clonePoints(moveCase.layerSystem.getLayerWarpEditSession().points);
assert.equal(moveCase.controller.handleCanvasPointerDown(event(moveTarget, 2, 50, 50)), true);
assert.equal(moveCase.controller.handleCanvasPointerMove(event(moveTarget, 2, 62, 50)), true);
assert.equal(moveCase.controller.handleCanvasPointerUp(event(moveTarget, 2, 62, 50)), true);
assert.equal(moveCase.history, 0, 'pointerup retains the WARP candidate without History');
assert.equal(moveCase.previews.length >= 1, true);
assert.equal(moveCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.POINT), true);
assert.equal(moveCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.BRUSH), true);
assert.equal(changed(moveCase.layerSystem.getLayerWarpEditSession().points, moveStart), true);

// The three brush families all go through the same preview transaction.
for (const [type, radialDirection] of [
    [WARP_BRUSH_TYPES.INFLATE, 1],
    [WARP_BRUSH_TYPES.PINCH, -1]
]) {
    const brushCase = makeHarness();
    const target = makeTarget();
    brushCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.BRUSH);
    brushCase.controller.setBrushType(type);
    const before = clonePoints(brushCase.layerSystem.getLayerWarpEditSession().points);
    brushCase.controller.handleCanvasPointerDown(event(target, 3, 50, 50));
    brushCase.controller.handleCanvasPointerMove(event(target, 3, 51, 50));
    brushCase.controller.handleCanvasPointerUp(event(target, 3, 51, 50));
    const after = brushCase.layerSystem.getLayerWarpEditSession().points;
    assert.equal(changed(after, before), true, `${type} changes the shared candidate`);
    assert.equal(brushCase.history, 0, `${type} preview has no History`);
    const beforeDistance = Math.hypot(before[0].x * 100 - 51, before[0].y * 100 - 50);
    const afterDistance = Math.hypot(after[0].x * 100 - 51, after[0].y * 100 - 50);
    assert.equal(Math.sign(afterDistance - beforeDistance), radialDirection,
        `${type} has the expected radial direction`);
}

// Cancel restores the gesture baseline and explicit finish is the only commit
// point represented by this isolated host.
const cancelCase = makeHarness();
cancelCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.BRUSH);
const cancelTarget = makeTarget();
const cancelBaseline = clonePoints(cancelCase.layerSystem.getLayerWarpEditSession().points);
cancelCase.controller.handleCanvasPointerDown(event(cancelTarget, 4, 50, 50));
cancelCase.controller.handleCanvasPointerMove(event(cancelTarget, 4, 68, 50));
cancelCase.controller.handleCanvasPointerCancel(event(cancelTarget, 4, 68, 50));
assert.deepEqual(cancelCase.layerSystem.getLayerWarpEditSession().points, cancelBaseline,
    'cancel rolls the pending brush gesture back to its baseline');
assert.equal(cancelCase.history, 0);
assert.equal(cancelCase.layerSystem.finishLayerWarpEditSession({ cancelled: false }).commit, false,
    'a no-op session does not create a key');

const confirmCase = makeHarness();
confirmCase.controller.setInteractionTool(WARP_INTERACTION_TOOLS.BRUSH);
const confirmTarget = makeTarget();
confirmCase.controller.handleCanvasPointerDown(event(confirmTarget, 5, 50, 50));
confirmCase.controller.handleCanvasPointerMove(event(confirmTarget, 5, 64, 50));
confirmCase.controller.handleCanvasPointerUp(event(confirmTarget, 5, 64, 50));
assert.equal(confirmCase.layerSystem.finishLayerWarpEditSession({ cancelled: false }).commit, true);
assert.equal(confirmCase.history, 1, 'explicit WARP finish creates exactly one History entry');

console.log('verify-layer-transform-warp-brush: POINT/BRUSH shared-session MOVE/INFLATE/PINCH, cancel, pointerup, and explicit commit contracts OK');
