/**
 * WP-005: verify the production WARP authoring projection around Layer Motion.
 * The fixture owns no projection math: the controller and transform-math
 * helpers under test provide both the forward and inverse operations.
 */
import assert from 'node:assert/strict';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };

const { LayerTransformWarpController } = await import('../ui/layer-transform-warp-controller.js');
const {
    applyTransformMatrix,
    createCenteredTransformMatrix
} = await import('../system/transform-math.js');
const { LayerSystem } = await import('../system/layer-system.js');

const bounds = Object.freeze({ x: 37, y: 29, width: 84, height: 62 });
const points = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) / 3,
    y: Math.floor(index / 4) / 3
}));
const baselineModel = {
    bindBounds: { ...bounds },
    points: points.map(point => ({ ...point })),
    layerTransformTracks: [{
        internalLayerId: 'internal-a',
        pivotX: 79,
        pivotY: 60,
        keyframes: [{ frame: 4, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }]
    }],
    layerDeformers: [{
        internalLayerId: 'internal-a',
        type: 'control-mesh',
        columns: 4,
        rows: 4,
        bindBounds: { ...bounds },
        points: points.map(point => ({ ...point }))
    }]
};

function clone(value) {
    return structuredClone(value);
}

function close(actual, expected, label, epsilon = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} !== ${expected}`);
}

function assertPoint(actual, expected, label) {
    close(actual.x, expected.x, `${label}.x`);
    close(actual.y, expected.y, `${label}.y`);
}

function makeLayerSystemFixture(transform) {
    const layerSystem = Object.create(LayerSystem.prototype);
    layerSystem.config = { canvas: { width: 320, height: 240 } };
    layerSystem._layerTransformSession = {
        layerId: 'working-a',
        transaction: {
            target: 'clip-layer-transform-key',
            clipId: 'clip-a',
            internalLayerId: 'internal-a',
            timelineFrame: 4
        },
        transform: { ...transform }
    };
    layerSystem._layerWarpEditSession = {
        layerId: 'working-a',
        transaction: {
            kind: 'layer-warp-edit-transaction',
            target: 'clip-layer-deformer-key',
            clipId: 'clip-a',
            internalLayerId: 'internal-a',
            timelineFrame: 4
        }
    };
    layerSystem._transformEditAdapter = {
        getWarpAuthoringMotion() {
            return {
                ok: true,
                source: 'clip.layerTransformTracks',
                clipId: 'clip-a',
                internalLayerId: 'internal-a',
                timelineFrame: 4,
                transform: { ...transform }
            };
        }
    };
    layerSystem.transform = {
        getTransform() {
            return { ...transform };
        }
    };
    return layerSystem;
}

function makeController(layerSystem, model) {
    const overlay = {
        options: null,
        activate(options) {
            this.options = options;
            return true;
        },
        deactivate() {
            this.options = null;
        },
        _update() {}
    };
    const session = {
        bindBounds: { ...model.bindBounds },
        points: model.points.map(point => ({ ...point })),
        transaction: layerSystem._layerWarpEditSession.transaction
    };
    layerSystem.beginLayerWarpEditSession = () => ({ ok: true });
    layerSystem.getLayerWarpEditSession = () => session;
    layerSystem.previewLayerWarpEditSession = nextPoints => {
        session.points = nextPoints.map(point => ({ ...point }));
        return { ok: true, changed: true };
    };
    layerSystem.finishLayerWarpEditSession = () => ({ ok: true, commit: false });
    const controller = new LayerTransformWarpController({
        layerSystem,
        coordinateSystem: {
            screenClientToWorld(clientX, clientY) {
                return { worldX: clientX, worldY: clientY };
            }
        },
        overlay
    });
    assert.equal(controller.begin(), true, 'controller begins through production boundary');
    return { controller, session, overlay };
}

const cases = [
    ['identity', { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 }],
    ['translation', { x: 120, y: -60, scaleX: 1, scaleY: 1, rotation: 0, anchorX: 0.5, anchorY: 0.5 }],
    ['rotation', { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: Math.PI / 5, anchorX: 0.5, anchorY: 0.5 }],
    ['scale', { x: 0, y: 0, scaleX: 1.7, scaleY: 0.65, rotation: 0, anchorX: 0.5, anchorY: 0.5 }],
    ['flip', { x: 18, y: -12, scaleX: -1.25, scaleY: 0.8, rotation: 0, anchorX: 0.5, anchorY: 0.5 }],
    ['combined-anchor', {
        x: 31,
        y: -17,
        scaleX: -1.15,
        scaleY: 0.72,
        rotation: -Math.PI / 7,
        anchorX: 0.23,
        anchorY: 0.71
    }]
];

for (const [name, transform] of cases) {
    const model = clone(baselineModel);
    const layerSystem = makeLayerSystemFixture(transform);
    const { controller, session } = makeController(layerSystem, model);
    const projection = layerSystem.getLayerWarpAuthoringMotion();
    assert.equal(projection.source, 'clip.layerTransformTracks', `${name}: current Motion source`);
    const expectedMatrix = createCenteredTransformMatrix(transform, 160, 120);
    const actualWorld = controller._getWorldPoints();
    assert.equal(actualWorld.length, 16, `${name}: all WARP points project`);
    points.forEach((point, index) => {
        const source = {
            x: bounds.x + point.x * bounds.width,
            y: bounds.y + point.y * bounds.height
        };
        assertPoint(actualWorld[index], applyTransformMatrix(expectedMatrix, source.x, source.y), `${name}: forward ${index}`);
        const normalized = controller._screenToNormalized({
            clientX: actualWorld[index].x,
            clientY: actualWorld[index].y
        });
        assertPoint(normalized, point, `${name}: inverse ${index}`);
    });
    assert.deepEqual(session.bindBounds, model.bindBounds, `${name}: bindBounds unchanged`);
    assert.deepEqual(session.points, model.points, `${name}: WARP points unchanged by projection`);
    assert.deepEqual(model.layerTransformTracks, baselineModel.layerTransformTracks, `${name}: Motion tracks unchanged`);
    assert.deepEqual(model.layerDeformers, baselineModel.layerDeformers, `${name}: deformers unchanged`);
    assert.equal(layerSystem.historyCount || 0, 0, `${name}: projection-only History 0`);
    controller.deactivate();
}

// The production LayerSystem boundary must also stay on the current session
// when the adapter has no CAF-specific evaluator (normal SOURCE fallback).
const sourceTransform = {
    x: 48,
    y: 23,
    scaleX: 0.8,
    scaleY: -1.1,
    rotation: Math.PI / 9,
    anchorX: 0.61,
    anchorY: 0.34
};
const sourceLayerSystem = makeLayerSystemFixture(sourceTransform);
sourceLayerSystem._transformEditAdapter = null;
const sourceProjection = sourceLayerSystem.getLayerWarpAuthoringMotion();
assert.equal(sourceProjection.source, 'layer-transform-session', 'SOURCE Motion fallback source');
assert.deepEqual(
    sourceProjection.matrix,
    createCenteredTransformMatrix(sourceTransform, 160, 120),
    'SOURCE Motion uses the existing centered transform semantics'
);

console.log(`verify-layer-transform-warp-motion-projection: PASS (${cases.length} affine cases × 16 points)`);
