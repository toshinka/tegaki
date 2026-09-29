// R-66: New RIG PART foundation — the PART Lens projects the stored rigDefinition.parts and
// never becomes a second source of truth. Inspection / selection write nothing; composite or
// legacy PART structures are read-only in the new Lens and keep the legacy route.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = globalThis.window || {};
const { projectRigPartStructure } = await import('../system/animation/rig-part-projection.js');
const { ClipAssetModel } = await import('../system/animation/animation-data-model.js');
const { inspectStaticRigAuthoringTarget } = await import('../system/animation/rig-static-authoring.js');
const { AnimationTablePopup } = await import('../ui/animation-table-popup.js');
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');

const bind = (x, y, pivotX, pivotY, rotation = 0) => ({
    x, y, scaleX: 1, scaleY: 1, rotation, pivotX, pivotY
});
const raster = (id, extra = {}) => ({
    id, name: id.toUpperCase(), type: 'raster', isBackground: false, parentLayerId: null,
    drawingSnapshotId: `${id}-pixels`, ...extra
});
const snapshot = value => JSON.stringify(value);

function makePopup(asset, { partMotion = false } = {}) {
    const entry = { clip: { id: 'clip', assetId: asset.id, startFrame: 0, duration: 4, rigMotion: null } };
    const popup = Object.create(AnimationTablePopup.prototype);
    Object.assign(popup, {
        model: {
            playback: { currentFrame: 0 },
            findClipEntry: id => id === 'clip' ? entry : null,
            getClipAsset: id => id === asset.id ? asset : null,
            getClipAssetRasterMeshStatus: () => ({ state: 'missing', mesh: null }),
            _hasClipAssetPartMotion: () => partMotion
        },
        selectedCelId: 'clip',
        selectedInternalLayerId: asset.internalLayers.find(layer => layer.type === 'raster').id,
        isPlaying: false,
        _rigLensPartPoseDraft: null
    });
    return popup;
}

// ---- Simple rigid-Raster hierarchy: A (root) -> B -> C, plus one unregistered Raster -------
const simple = {
    id: 'simple',
    name: 'simple',
    internalLayers: [raster('a'), raster('b'), raster('c'), raster('d')],
    rigDefinition: {
        version: 1,
        parts: [
            { partId: 'c', parentPartId: 'b', bindTransform: bind(4, 5, 6, 7, 0.25) },
            { partId: 'a', parentPartId: null, bindTransform: bind(10, 20, 30, 40) },
            { partId: 'b', parentPartId: 'a', bindTransform: bind(1, 2, 3, 4) }
        ],
        bones: [],
        rigidBindings: []
    },
    meshDefinitions: [],
    skinBindings: []
};
const simpleBefore = snapshot(simple);
const projection = projectRigPartStructure(simple);
assert.equal(snapshot(simple), simpleBefore, 'projection never mutates the stored asset');
assert.equal(projection.support.editable, true, 'simple top-level Raster hierarchy is owned by the new PART Lens');
assert.deepEqual(projection.structure.map(item => [item.partId, item.depth, item.parentPartId, item.parentName]), [
    ['a', 0, null, null],
    ['b', 1, 'a', 'A'],
    ['c', 2, 'b', 'B']
], 'hierarchy order / depth / parent names come from the stored parentPartId chain');
const stored = new Map(simple.rigDefinition.parts.map(part => [part.partId, part.bindTransform]));
projection.structure.forEach(item => {
    const source = stored.get(item.partId);
    assert.deepEqual(item.pivot, { x: source.pivotX, y: source.pivotY }, `${item.partId} pivot is the stored pivot`);
    assert.deepEqual(item.origin, { x: source.x, y: source.y }, `${item.partId} origin is the stored bind origin`);
});

const simplePopup = makePopup(simple);
const target = simplePopup.getRigLensPartTarget('simple');
assert.equal(target.ok, true);
assert.equal(target.staticSetupAllowed, true);
assert.equal(target.motionAllowed, true);
assert.deepEqual(target.structure.map(item => item.partId), ['a', 'b', 'c']);
assert.deepEqual(target.layers.map(layer => layer.id), ['a', 'b', 'c', 'd'], 'unregistered Raster stays listed for registration');
assert.equal(simplePopup.getRigLensPartMotionTarget('simple', 'b').ok, true, 'existing PART Motion entry is unchanged');
assert.equal(snapshot(simple), simpleBefore, 'target resolution writes nothing');

// Selection is transient RightWorkspaceFrame state only.
const frame = Object.create(RightWorkspaceFrame.prototype);
let syncs = 0;
Object.assign(frame, {
    rigLensActive: true, rigPointerGesture: null, rigLensMode: 'setup',
    rigLensTarget: { assetId: 'simple', internalLayerId: 'a' },
    rigSelectedPartId: 'a', rigPartIkEffectorId: null, rigPlacementMode: null, rigEntryMessage: ''
});
frame._getRigLensTable = () => simplePopup;
frame.sync = () => { syncs += 1; };
assert.equal(frame._selectRigLensPart('b'), true);
assert.equal(frame.rigSelectedPartId, 'b');
assert.equal(frame._selectRigLensPart('c'), true);
assert.equal(frame.rigSelectedPartId, 'c');
assert.equal(frame._selectRigLensPart('c'), true, 'reselecting the current Part is a no-op');
assert.equal(syncs, 2, 'each selection change projects once');
assert.equal(snapshot(simple), simpleBefore, 'PART selection leaves persistent rig data untouched (zero History edit)');

// PART <-> DEFORM: the DEFORM static target refuses a PART asset instead of converting it.
const deformView = inspectStaticRigAuthoringTarget(simple, 'a');
assert.equal(deformView.ok, false, 'DEFORM does not claim or convert an existing PART rig');
assert.equal(snapshot(simple), simpleBefore);

// ---- Composite / legacy structures: read-only, never converted ---------------------------------
const composite = {
    id: 'composite',
    name: 'composite',
    internalLayers: [
        raster('top'),
        { id: 'grp', name: 'GROUP', type: 'folder', isBackground: false, parentLayerId: null },
        raster('inner', { parentLayerId: 'grp' })
    ],
    rigDefinition: {
        version: 1,
        parts: [
            { partId: 'grp', parentPartId: null, bindTransform: bind(0, 0, 8, 9) },
            { partId: 'inner', parentPartId: 'grp', bindTransform: bind(1, 1, 2, 2) },
            { partId: 'top', parentPartId: 'grp', bindTransform: bind(3, 3, 5, 5) }
        ],
        bones: [{ boneId: 'rb', parentBoneId: null, bindTransform: bind(0, 0, 0, 0), length: 0 }],
        rigidBindings: [{ boneId: 'rb', partId: 'grp' }]
    },
    meshDefinitions: [],
    skinBindings: []
};
const compositeBefore = snapshot(composite);
const compositeProjection = projectRigPartStructure(composite);
assert.equal(compositeProjection.support.editable, false);
for (const reason of ['folder-part', 'nested-part', 'rigid-binding']) {
    assert.ok(compositeProjection.support.reasons.includes(reason), `composite reports ${reason}`);
}
assert.deepEqual(compositeProjection.structure.map(item => [item.partId, item.depth, item.parentName]), [
    ['grp', 0, null], ['inner', 1, 'GROUP'], ['top', 1, 'GROUP']
], 'Folder / nested Parts stay visible with their real parent instead of "unknown"');

const compositePopup = makePopup(composite);
const compositeTarget = compositePopup.getRigLensPartTarget('composite');
assert.equal(compositeTarget.staticSetupAllowed, false, 'composite PART is not editable in the new Lens');
assert.equal(compositeTarget.motionAllowed, false);
assert.match(compositeTarget.unsupportedReason, /旧RIGで開く/u, 'the refusal names the preserved legacy route');
assert.equal(compositePopup.getRigLensPartMotionTarget('composite', 'top').ok, false);
assert.equal(compositePopup.registerRigLensPart?.('composite', 'top')?.ok, false);
assert.equal(compositePopup.setRigLensPartParent?.('composite', 'top', null)?.ok, false);
assert.equal(snapshot(composite), compositeBefore, 'unsupported structure is never flattened or converted');

// ---- Serialization shape is unchanged: the projection adds nothing to the saved asset --------
const model = new ClipAssetModel({
    id: 'simple', name: 'simple', internalLayers: simple.internalLayers, rigDefinition: simple.rigDefinition
});
const serialized = model.serialize();
assert.deepEqual(Object.keys(serialized.rigDefinition).sort(), Object.keys(simple.rigDefinition).sort(),
    'no new rigDefinition keys');
const reopened = new ClipAssetModel(JSON.parse(JSON.stringify(serialized)));
assert.deepEqual(projectRigPartStructure(reopened).structure, projection.structure,
    'save / reopen reprojects the same structure from the same stored data');

// ---- Source guards --------------------------------------------------------------------------------
const [popupSource, frameSource] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8')
]);
assert.match(popupSource, /projectRigPartStructure\(asset\)/u, 'getRigLensPartTarget projects the stored asset');
assert.match(popupSource, /partTarget\.support\?\.editable === true/u,
    'legacy fallback is withheld only for Lens-editable PART structures');
assert.match(frameSource, /item\.className = 'right-workspace-rig-part-item';[\s\S]*?--rig-part-depth/u,
    'Part cards keep the existing card class and expose the stored rig depth');
assert.doesNotMatch(frameSource, /rigDefinition\s*=|parts\.push\(|parentPartId\s*=/u,
    'the right Workspace never writes PART data directly');

console.log('verify-rig-part-foundation: stored PART hierarchy/pivot projection / transient selection / zero writes / composite read-only + legacy route / unchanged serialization OK');
