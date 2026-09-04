/**
 * Phase 6u Stage A: WARP GRID初期Bind範囲のpure auto-fit契約を固定検証する。
 */
import assert from 'node:assert/strict';

// AnimationTablePopupの既存target adapterをDOMなしで直接fixture検証する。
// import時の副作用は最小stubへ閉じ、production codeの探索・visibilityを複製しない。
globalThis.window = {
    TEGAKI_CONFIG: { canvas: { width: 400, height: 400 } }
};
globalThis.document = {
    querySelectorAll: () => [],
    createElement: () => ({
        style: {},
        classList: { add() {}, remove() {} },
        appendChild() {},
        setAttribute() {}
    })
};

const { fitWarpGridBindBoundsToContent, createWarpGridDeformer } = await import(
    '../system/animation/warp-grid-deformer.js'
);
const { createRectControlMeshDeformer } = await import(
    '../system/animation/control-mesh-deformer.js'
);
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');

function assertBounds(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
}

const source = { x: 10, y: 20, width: 100, height: 50 };
const fitted = fitWarpGridBindBoundsToContent(source);
assertBounds(fitted, { x: 5, y: 16, width: 110, height: 58 }, 'content bounds use 5% / 4px padding');
assert.deepEqual(source, { x: 10, y: 20, width: 100, height: 50 }, 'fit does not mutate content bounds');

assertBounds(
    fitWarpGridBindBoundsToContent({ x: -8, y: -4, width: 1, height: 1 }),
    { x: -12, y: -8, width: 9, height: 9 },
    'negative and one-pixel content remain in project coordinates'
);

assertBounds(
    fitWarpGridBindBoundsToContent(null, { x: -3, y: 5, width: 20, height: 10 }),
    { x: -3, y: 5, width: 20, height: 10 },
    'empty content falls back to stored raster bounds'
);
assertBounds(
    fitWarpGridBindBoundsToContent(null, null),
    null,
    'missing content and fallback remains unavailable'
);

const bindBounds = fitWarpGridBindBoundsToContent({ x: 40, y: 30, width: 12, height: 8 });
const fixed = createWarpGridDeformer({ bindBounds });
const control = createRectControlMeshDeformer({ columns: 4, rows: 4, bindBounds });
assert.ok(fixed?.bindBounds, 'fixed GRID accepts the shared bind bounds');
assert.ok(control?.bindBounds, 'Control Mesh accepts the shared bind bounds');
assert.deepEqual(fixed.bindBounds, control.bindBounds, 'fixed GRID and Control Mesh share the fit result');

const custom = fitWarpGridBindBoundsToContent(
    { x: 1.2, y: 2.8, width: 10.1, height: 20.2 },
    null,
    { paddingRatio: 0, minimumPadding: 0 }
);
assertBounds(custom, { x: 1, y: 2, width: 11, height: 21 }, 'rounding is deterministic');

function createBoundsSnapshot(id, contentBounds, rasterBounds = contentBounds) {
    return {
        id,
        width: 1,
        height: 1,
        pixels: new Uint8ClampedArray(4),
        contentBounds,
        rasterBounds
    };
}

function createTargetFixture({ targetFolderId = null, layers, snapshots }) {
    const popup = Object.create(AnimationTablePopup.prototype);
    const asset = { id: 'asset-target-fixture', internalLayers: layers };
    const snapshotById = new Map(Object.entries(snapshots));
    const popupPrototype = AnimationTablePopup.prototype;
    popup.model = {
        getClipAsset: assetId => assetId === asset.id ? asset : null,
        getDrawingSnapshot: snapshotId => snapshotById.get(snapshotId) || null
    };
    popup.selectedAssetId = asset.id;
    popup.selectedInternalLayerId = targetFolderId;
    popup._motionInspectorScope = targetFolderId ? 'internal' : 'caf';
    popup._getWarpGridTargetFolderId = () => targetFolderId;
    popup._isInternalLayerEffectivelyVisible = popupPrototype
        ._isInternalLayerEffectivelyVisible;
    popup._getDrawingSnapshotContentBounds = snapshot => snapshot?.contentBounds || null;
    popup._getDrawingSnapshotRasterBounds = snapshot => snapshot?.rasterBounds || null;
    popup._getCanvasSnapshotSize = () => ({ width: 400, height: 400 });
    popup.layerSystem = { _getMaxRenderTextureSize: () => 8192 };
    popup._validateInternalMergeSurface = popupPrototype._validateInternalMergeSurface;
    return { popup, asset, entry: { clip: { assetId: asset.id } } };
}

const targetLayers = [
    { id: 'folder-a', type: 'folder', visible: true, parentLayerId: null },
    { id: 'a-visible', type: 'raster', visible: true, parentLayerId: 'folder-a', drawingSnapshotId: 'a-visible-snapshot' },
    { id: 'a-clipped', type: 'raster', visible: true, parentLayerId: 'folder-a', clippingMode: 'alpha-inherit', drawingSnapshotId: 'a-clipped-snapshot' },
    { id: 'a-hidden', type: 'raster', visible: false, parentLayerId: 'folder-a', drawingSnapshotId: 'a-hidden-snapshot' },
    { id: 'a-hidden-folder', type: 'folder', visible: false, parentLayerId: 'folder-a' },
    { id: 'a-hidden-descendant', type: 'raster', visible: true, parentLayerId: 'a-hidden-folder', drawingSnapshotId: 'a-hidden-descendant-snapshot' },
    { id: 'folder-b', type: 'folder', visible: true, parentLayerId: null },
    { id: 'b-visible', type: 'raster', visible: true, parentLayerId: 'folder-b', drawingSnapshotId: 'b-visible-snapshot' }
];
const targetSnapshots = {
    'a-visible-snapshot': createBoundsSnapshot('a-visible-snapshot', { x: 10, y: 10, width: 20, height: 20 }),
    'a-clipped-snapshot': createBoundsSnapshot('a-clipped-snapshot', { x: 30, y: 10, width: 20, height: 20 }),
    'a-hidden-snapshot': createBoundsSnapshot('a-hidden-snapshot', { x: 100, y: 10, width: 20, height: 20 }),
    'a-hidden-descendant-snapshot': createBoundsSnapshot('a-hidden-descendant-snapshot', { x: 120, y: 10, width: 20, height: 20 }),
    'b-visible-snapshot': createBoundsSnapshot('b-visible-snapshot', { x: 200, y: 10, width: 20, height: 20 })
};
const folderTarget = createTargetFixture({
    targetFolderId: 'folder-a',
    layers: targetLayers,
    snapshots: targetSnapshots
});
assertBounds(
    folderTarget.popup._getWarpGridContentBounds(folderTarget.entry),
    { x: 10, y: 10, width: 40, height: 20 },
    'Folder target includes visible/clipped descendants only'
);

const cafTarget = createTargetFixture({ layers: targetLayers, snapshots: targetSnapshots });
assertBounds(
    cafTarget.popup._getWarpGridContentBounds(cafTarget.entry),
    { x: 10, y: 10, width: 210, height: 20 },
    'CAF target includes visible sibling folders but excludes hidden layers and ancestors'
);

const oversized = createTargetFixture({
    targetFolderId: 'folder-a',
    layers: [
        { id: 'folder-a', type: 'folder', visible: true, parentLayerId: null },
        { id: 'oversized', type: 'raster', visible: true, parentLayerId: 'folder-a', drawingSnapshotId: 'oversized-snapshot' }
    ],
    snapshots: {
        'oversized-snapshot': createBoundsSnapshot('oversized-snapshot', { x: 0, y: 0, width: 9000, height: 10 })
    }
});
assert.equal(
    oversized.popup._getWarpGridInitialBounds(oversized.entry),
    null,
    'oversized content is rejected instead of falling back to Canvas bounds'
);

console.log('verify-warp-grid-auto-fit: all assertions passed');
