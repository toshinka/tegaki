import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = globalThis.window || {};
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');

const [rendererSource, workspaceSource, popupSource, componentCss, mainCss] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8')
]);

const identity = () => ({
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pivotX: 0, pivotY: 0
});
const rootBone = id => ({
    boneId: id, name: 'Root', parentBoneId: null, bindTransform: identity(), length: 24
});
const raster = (id, extra = {}) => ({
    id, name: id, type: 'raster', isBackground: false, parentLayerId: null,
    drawingSnapshotId: 'pixels', ...extra
});
const makeAsset = ({ id, layer, bones = [], parts = [], rigidBindings = [], mesh = null, skin = null }) => ({
    id,
    name: id,
    internalLayers: [layer],
    rigDefinition: { version: 1, parts, rigidBindings, bones },
    meshDefinitions: mesh ? [mesh] : [],
    skinBindings: skin ? [skin] : []
});

function makePopup(asset, { folderContext = null, includeRasterContext = true } = {}) {
    const entry = { clip: { id: 'clip', assetId: asset.id, startFrame: 0, duration: 4, rigMotion: null } };
    const rasterContexts = asset.internalLayers
        .filter(layer => layer.type === 'raster')
        .map(layer => ({
            entry,
            asset,
            layer,
            mesh: asset.meshDefinitions.find(candidate => candidate.targetInternalLayerId === layer.id) || null,
            skinBinding: asset.skinBindings[0] || null,
            bones: asset.rigDefinition.bones,
            localFrame: 0,
            isFrameInClip: true
        }));
    const projection = {
        entry,
        asset,
        folders: folderContext ? [folderContext] : [],
        rasters: includeRasterContext ? rasterContexts : [],
        meshBones: asset.rigDefinition.bones
    };
    const popup = Object.create(AnimationTablePopup.prototype);
    Object.assign(popup, {
        model: {
            playback: { currentFrame: 0 },
            findClipEntry: id => id === 'clip' ? entry : null,
            getClipAsset: id => id === asset.id ? asset : null,
            getClipAssetRasterMeshStatus: (_assetId, layerId) => {
                const mesh = asset.meshDefinitions.find(candidate => candidate.targetInternalLayerId === layerId);
                return mesh ? { state: 'current', mesh } : { state: 'missing', mesh: null };
            },
            _hasClipAssetPartMotion: () => false
        },
        selectedCelId: 'clip',
        selectedInternalLayerId: asset.internalLayers[0].id,
        selectedRigBoneId: null,
        isPlaying: false,
        isVisible: true,
        _getSelectedCafRigProjection: () => projection,
        _selectRigRasterProjectionTarget: (context, options) => {
            popup.lastOpened = { route: 'raster-setup', context, options };
            return true;
        },
        _selectRigFolderProjectionTarget: (context, options) => {
            popup.lastOpened = { route: 'rigid-hierarchy', context, options };
            return true;
        },
        _requestLayerPanelSync: () => {},
        _setMotionTimelineKeyKind: () => {},
        setMotionWindowOpen: () => {},
        render: () => {}
    });
    return popup;
}

const newLensAsset = makeAsset({
    id: 'unset',
    layer: raster('unset-layer')
});
const unsetPopup = makePopup(newLensAsset);
assert.equal(unsetPopup.getRigLensLegacyFallbackTarget('unset', 'unset-layer').ok, false,
    'unconfigured Raster stays on the top-level new RIG entry');

const simplePartAsset = makeAsset({
    id: 'simple-part',
    layer: raster('part-layer'),
    bones: [rootBone('part-root')],
    parts: [{ partId: 'part-layer', parentPartId: null, bindTransform: identity() }],
    rigidBindings: [{ partId: 'part-layer', boneId: 'part-root' }]
});
const simplePartPopup = makePopup(simplePartAsset);
assert.equal(simplePartPopup.getRigLensLegacyFallbackTarget('simple-part', 'part-layer').ok, false,
    'a valid simple PART remains owned by the new RIG Lens');

const makeDeformAsset = (id, generator, generatorOverrides = {}) => {
    const layer = raster(`${id}-layer`);
    const mesh = {
        meshId: `${id}-mesh`, targetInternalLayerId: layer.id,
        vertices: [], triangles: [],
        generator: { type: generator, ...generatorOverrides }
    };
    const skin = {
        meshId: mesh.meshId,
        vertexWeights: [{ vertexId: 'v0', influences: [{ boneId: `${id}-root`, weight: 1 }] }]
    };
    return makeAsset({ id, layer, bones: [rootBone(`${id}-root`)], mesh, skin });
};

const simpleDeformAsset = makeDeformAsset('simple-deform', 'alpha-fit-grid-v1');
const simpleDeformPopup = makePopup(simpleDeformAsset);
assert.equal(simpleDeformPopup.getRigLensLegacyFallbackTarget(
    'simple-deform', 'simple-deform-layer'
).ok, false, 'a current AUTO GRID DEFORM target stays on the new RIG Lens');

for (const [id, generator, overrides] of [
    ['auto-shape', 'auto-shape-fill-v1', {}],
    ['auto-line', 'auto-shape-line-ribbon-v1', {}],
    ['manual-weight', 'alpha-fit-grid-v1', { weightCorrectionMode: 'fixed-topology-brush-v1' }],
    ['manual-mesh', 'alpha-fit-grid-v1', { topologyEditMode: 'fixed-vertex-position-v1' }]
]) {
    const asset = makeDeformAsset(id, generator, overrides);
    const popup = makePopup(asset);
    const result = popup.getRigLensLegacyFallbackTarget(asset.id, `${id}-layer`);
    assert.equal(result.ok, true, `${id} is rejected by the new edit guard and has a legacy Raster route`);
    assert.equal(result.route, 'raster-setup', `${id} uses the existing legacy Raster editor route`);

    const opened = popup.openInternalRasterRigSetupFromExternal(asset.id, `${id}-layer`, {
        source: 'layer-panel-legacy-fallback'
    });
    assert.equal(opened.ok, true, `${id} fallback reaches the existing RIG Workspace`);
    assert.equal(popup.lastOpened.context.layer.id, `${id}-layer`, `${id} opens the exact selected target`);
    assert.equal(popup.lastOpened.options.focusRig, true);
    assert.equal(popup.lastOpened.options.openInspector, true);
}

const folder = { id: 'legacy-folder', name: 'Legacy group', type: 'folder', isBackground: false };
const hierarchyAsset = makeAsset({
    id: 'legacy-hierarchy',
    layer: folder,
    bones: [rootBone('hierarchy-root')],
    parts: [{ partId: folder.id, parentPartId: null, bindTransform: identity() }],
    rigidBindings: [{ partId: folder.id, boneId: 'hierarchy-root' }]
});
const hierarchyPopup = makePopup(hierarchyAsset, {
    folderContext: {
        layer: folder,
        part: hierarchyAsset.rigDefinition.parts[0],
        binding: hierarchyAsset.rigDefinition.rigidBindings[0],
        bone: hierarchyAsset.rigDefinition.bones[0]
    },
    includeRasterContext: false
});
assert.deepEqual(
    hierarchyPopup.getRigLensLegacyFallbackTarget('legacy-hierarchy', folder.id),
    {
        ok: true,
        route: 'rigid-hierarchy',
        reason: '背景以外のRasterを選択してください。'
    },
    'a new-Lens-unsupported bound Folder exposes only the existing hierarchy fallback'
);
const hierarchyOpened = hierarchyPopup.openInternalRigidHierarchyFromExternal(
    'legacy-hierarchy', folder.id, { source: 'layer-panel-legacy-fallback' }
);
assert.equal(hierarchyOpened.ok, true, 'the hierarchy fallback opens the existing RIG Workspace');
assert.equal(hierarchyPopup.lastOpened.context.layer.id, folder.id);
assert.equal(hierarchyPopup.lastOpened.options.focusRig, true);

const unresolvedAsset = makeDeformAsset('no-legacy-route', 'auto-shape-fill-v1');
const unresolvedPopup = makePopup(unresolvedAsset, { includeRasterContext: false });
assert.equal(unresolvedPopup.getRigLensLegacyFallbackTarget(
    unresolvedAsset.id, `${unresolvedAsset.id}-layer`
).ok, false, 'unsupported inspection without a matching legacy route gets no fallback');

const rendererRender = rendererSource.slice(
    rendererSource.indexOf('render(layers, activeIndex, animationSystem = null)'),
    rendererSource.indexOf('    getDiagnosticsSnapshot() {')
);
assert.match(rendererRender, /legacyRigFallback\?\.ok === true[\s\S]*?_createLegacyRigFallbackElement/u,
    'Layer shows the secondary fallback only for the eligible target projection');
assert.doesNotMatch(rendererRender, /_createContextDockViewSwitch|_createCafRigInspectorElement/u,
    'normal Layer rendering has no RIG inspector tab or view');
assert.match(rendererSource, /textContent = '旧RIGで開く'/u);
assert.match(rendererSource, /getRigLensLegacyFallbackTarget\?\./u,
    'the fallback click rechecks the selected target before opening the old Workspace');
assert.match(popupSource, /_resolveInternalRasterRigSetupTarget\(assetId, layerId\)[\s\S]*?context\.layer\?\.id !== layer\.id/u,
    'the legacy Raster route is target-specific');
assert.match(popupSource, /getRigLensLegacyFallbackTarget\(assetId, layerId\)[\s\S]*?inspectStaticRigAuthoringTarget[\s\S]*?inspectStaticRigBindGestureTarget[\s\S]*?_resolveInternalRigidHierarchyTarget[\s\S]*?_resolveInternalRasterRigSetupTarget/u,
    'eligibility composes current RIG inspections and existing editor route resolvers');
assert.doesNotMatch(workspaceSource, /rigLayerEntryButton|right-workspace-rig-layer-entry/u,
    'the redundant Layer-side RIG primary CTA is retired');
assert.match(workspaceSource, /textContent = 'RIG'/u,
    'the top-level RIG lens remains in the primary navigation');
assert.match(popupSource, /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)/u,
    'the existing legacy Raster Workspace entry remains available');
assert.match(popupSource, /openInternalRigidHierarchyFromExternal\(assetId, layerId, options = \{\}\)/u,
    'the existing legacy hierarchy Workspace entry remains available');
for (const obsoleteSelector of [
    '.layer-panel-context-view-switch',
    '.layer-panel-context-view-button',
    '.right-workspace-rig-layer-entry'
]) {
    assert.equal(componentCss.includes(obsoleteSelector), false, `${obsoleteSelector} shell styling is retired`);
    assert.equal(mainCss.includes(obsoleteSelector), false, `${obsoleteSelector} global styling is retired`);
}

console.log('verify-rig-legacy-entry-retirement: normal RIG targets, exact legacy routes, and old editor access OK');
