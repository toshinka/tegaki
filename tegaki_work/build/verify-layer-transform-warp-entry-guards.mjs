/** WP-005: Simple Layer WARP authoring entry must reject unsupported targets before mutation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { TEGAKI_CONFIG: { debug: false } };

const { TimelineModel } = await import('../system/animation/animation-data-model.js');
const { LayerSystem } = await import('../system/layer-system.js');
const { createRectControlMeshDeformer } = await import('../system/animation/control-mesh-deformer.js');
const {
    createFolderEffectRenderPlan
} = await import('../system/animation/folder-part-render-plan.js');
const {
    getClipLayerDeformer,
    setClipLayerDeformerTarget
} = await import('../system/animation/clip-layer-deformer.js');
const {
    planLayerWarpEditTransactionStart
} = await import('../system/animation/layer-warp-edit-transaction.js');
const {
    TRANSFORM_EDIT_AUTHORITY
} = await import('../system/animation/transform-edit-context.js');
const {
    TRANSFORM_EDIT_TRANSACTION_TARGET
} = await import('../system/animation/transform-edit-transaction.js');

const popupSource = readFileSync(
    new URL('../ui/animation-table-popup.js', import.meta.url),
    'utf8'
);

function extractMethod(name, nextName, dependencies) {
    const start = popupSource.indexOf(`\n    ${name}(`);
    const end = popupSource.indexOf(`\n    ${nextName}(`, start + 1);
    assert(start >= 0 && end > start, `${name} source range exists`);
    return new Function(
        ...Object.keys(dependencies),
        `return ({${popupSource.slice(start, end)}}).${name};`
    )(...Object.values(dependencies));
}

const projectLayerWarpBridgeStart = extractMethod(
    '_projectLayerWarpBridgeStart',
    '_beginLayerWarpBridge',
    {
        getClipLayerDeformer,
        planLayerWarpEditTransactionStart,
        setClipLayerDeformerTarget,
        createFolderEffectRenderPlan,
        TRANSFORM_EDIT_AUTHORITY
    }
);

const bounds = { x: 0, y: 0, width: 16, height: 16 };
const bind = createRectControlMeshDeformer({ columns: 4, rows: 4, bindBounds: bounds });
assert.ok(bind?.points?.length === 16, 'Simple fixture has the production 4x4 candidate');

function advancedDeformer() {
    return createRectControlMeshDeformer({ columns: 5, rows: 5, bindBounds: bounds });
}

function fixture(kind) {
    const target = {
        id: 'target',
        type: 'raster',
        parentLayerId: null,
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        clippingMode: kind === 'clipping-owner' ? 'normal' : 'none',
        drawingSnapshotId: 'snapshot'
    };
    const layers = [target];
    if (kind === 'clipping-source') {
        layers.unshift({
            id: 'owner',
            type: 'raster',
            parentLayerId: null,
            visible: true,
            opacity: 1,
            blendMode: 'normal',
            clippingMode: 'normal',
            drawingSnapshotId: 'snapshot'
        });
    }
    const asset = {
        id: 'asset',
        internalLayers: layers,
        rigDefinition: null,
        meshDefinitions: null,
        skinBindings: null
    };
    if (kind === 'rig') {
        asset.rigDefinition = {
            version: 1,
            parts: [{
                partId: 'target',
                parentPartId: null,
                bindTransform: {
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    pivotX: 0,
                    pivotY: 0
                }
            }]
        };
    }
    if (kind === 'mesh' || kind === 'skin') {
        asset.meshDefinitions = [{
            meshId: 'mesh-target',
            targetInternalLayerId: 'target',
            vertices: [],
            triangles: []
        }];
        if (kind === 'skin') {
            asset.skinBindings = [{
                meshId: 'mesh-target',
                vertexWeights: []
            }];
        }
    }

    const existingDeformer = kind === 'advanced' ? advancedDeformer() : null;
    const model = new TimelineModel({
        totalFrames: 2,
        drawingSnapshots: [{
            id: 'snapshot',
            width: 16,
            height: 16,
            rasterBounds: bounds,
            pixels: new Uint8ClampedArray(16 * 16 * 4)
        }],
        clipAssets: [asset],
        tracks: [{
            id: 'lane',
            cels: [{
                id: 'clip',
                assetId: 'asset',
                startFrame: 0,
                duration: 2,
                layerDeformers: existingDeformer
                    ? { version: 1, targets: [{ internalLayerId: 'target', deformer: existingDeformer }] }
                    : null
            }]
        }]
    });
    const entry = model.findClipEntry('clip');
    const resolvedAsset = model.getClipAsset('asset');
    const context = {
        mode: 'animate-ready',
        authority: TRANSFORM_EDIT_AUTHORITY.CLIP_LAYER_TRANSFORM_KEY,
        writable: true,
        clipId: 'clip',
        timelineFrame: 0,
        localFrame: 0,
        internalLayerId: 'target',
        hasExplicitKey: false
    };
    const popupHost = {
        model,
        _layerWarpBridgeSession: null,
        getTransformEditContext() { return context; },
        canEditSelectedWorkingLayer() { return true; },
        _getSelectedClipLayerMotionFrame() {
            return { entry, asset: resolvedAsset, internalLayerId: 'target' };
        }
    };
    const layerHost = Object.create(LayerSystem.prototype);
    Object.assign(layerHost, {
        _layerWarpEditSession: null,
        _layerTransformSession: { transaction: { target: TRANSFORM_EDIT_TRANSACTION_TARGET.CLIP_LAYER_TRANSFORM_KEY } },
        getActiveLayer() {
            return { layerData: { id: 'working-layer', isBackground: false, isFolder: false } };
        },
        getLayerMoveCommitState() {
            return { active: true, hasPendingTransform: false };
        },
        _resolveLayerTransformSourceBounds() { return bounds; },
        _transformEditAdapter: {
            beginWarp: request => projectLayerWarpBridgeStart.call(popupHost, request)
        }
    });
    return { model, entry, asset: resolvedAsset, popupHost, layerHost, existingDeformer };
}

const cases = [
    ['advanced', 'advanced-layer-warp-required'],
    ['rig', 'layer-deformer-rig-overlap'],
    ['mesh', 'layer-deformer-mesh-overlap'],
    ['skin', 'layer-deformer-mesh-overlap'],
    ['clipping-owner', 'layer-deformer-clipping-overlap'],
    ['clipping-source', 'layer-deformer-clipping-overlap']
];

for (const [kind, expectedReason] of cases) {
    const { model, entry, asset, popupHost, layerHost, existingDeformer } = fixture(kind);
    const before = model.serialize();
    const beforeLayerDeformers = structuredClone(entry.clip.layerDeformers);
    const result = projectLayerWarpBridgeStart.call(popupHost, {
        layerId: 'working-layer',
        sourceBounds: bounds
    });
    assert.equal(result.ok, false, `${kind}: popup entry must be blocked`);
    assert.equal(result.reason, expectedReason, `${kind}: explicit production reason`);
    assert.deepEqual(model.serialize(), before, `${kind}: popup preflight is zero mutation`);
    assert.deepEqual(entry.clip.layerDeformers, beforeLayerDeformers, `${kind}: no candidate persisted`);
    assert.equal(popupHost._layerWarpBridgeSession, null, `${kind}: no bridge session`);

    const layerResult = layerHost.beginLayerWarpEditSession();
    assert.equal(layerResult.ok, false, `${kind}: LayerSystem entry is blocked`);
    assert.equal(layerResult.reason, expectedReason, `${kind}: LayerSystem forwards production reason`);
    assert.equal(layerHost._layerWarpEditSession, null, `${kind}: no LayerSystem session`);
    assert.deepEqual(model.serialize(), before, `${kind}: LayerSystem entry is zero mutation`);
    assert.deepEqual(entry.clip.layerDeformers, beforeLayerDeformers, `${kind}: LayerSystem did not write effects`);
    assert.equal(existingDeformer ? entry.clip.layerDeformers?.targets?.length : 0,
        existingDeformer ? 1 : 0,
        `${kind}: existing effect remains intact`);
    console.log(`PASS ${kind}: reason=${result.reason}, mutation=0, History=0, session=none`);
}

console.log('Layer WARP production entry guards passed: non-4x4/RIG/Mesh/Skin/clipping are blocked before mutation.');
