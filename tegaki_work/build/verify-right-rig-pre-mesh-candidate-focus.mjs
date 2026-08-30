import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRigAuthoringStatusProjection } from '../system/animation/rig-authoring-status-projection.js';

const [table, renderer, phase] = await Promise.all([
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../../task-codex/phase9n.md', import.meta.url), 'utf8')
]);

const asset = {
    internalLayers: [
        { id: 'art-a', type: 'raster', name: 'A', parentLayerId: null },
        { id: 'art-b', type: 'raster', name: 'B', parentLayerId: null }
    ],
    rigDefinition: {
        parts: [],
        bones: [{ boneId: 'unbound', name: 'BONE', parentBoneId: null }],
        rigidBindings: []
    },
    meshDefinitions: [],
    skinBindings: []
};
const rasterA = createRigAuthoringStatusProjection(asset, 'art-a');
const rasterB = createRigAuthoringStatusProjection(asset, 'art-b');
assert.equal(rasterA.status, 'none');
assert.equal(rasterB.status, 'none');
assert.equal(rasterA.bendSetup?.boneState, 'candidate');
assert.equal(rasterB.bendSetup?.boneState, 'candidate');
assert.equal(
    rasterA.unboundBones[0],
    rasterB.unboundBones[0],
    'the static projection must not invent a Raster owner for an unbound Bone'
);

for (const token of [
    'this._rigRasterCandidateFocus = null',
    '_setRigRasterCandidateFocus(assetId, layerId, boneId)',
    'clearRigRasterCandidateFocusForExternal()',
    'getRigRasterCandidateFocusForExternal()',
    "this._motionInspectorScope === 'internal'",
    "this._motionInspectorTargetKind === 'raster'",
    'layer.parentLayerId == null',
    'hasPart || hasMesh || !bone',
    'const isPreMeshCandidate = connectedBoneIds.size === 0 && !context.mesh',
    'const focusedBoneId = retainedCandidateFocus?.boneId || null',
    'this._setRigRasterCandidateFocus(asset.id, layer.id, result.bone.boneId)',
    'context.projection?.asset?.id',
    'context.folder?.layer?.id',
    'this._flushLayerPanelSync()',
    "options.focusRig === true && options.openInspector === true",
    "this._setMotionTimelineKeyKind('rig', { render: false })"
]) {
    assert.ok(table.includes(token), `runtime-only candidate focus must include ${token}`);
}

const resolver = table.match(
    /getRigRasterCandidateFocusForExternal\(\)[\s\S]*?\n    \}\n\n    _openSelectedRigInspector/u
)?.[0] || '';
assert.match(
    resolver,
    /selectedAssetId === focus\.assetId[\s\S]*?selectedInternalLayerId === focus\.layerId[\s\S]*?selectedRigBoneId === focus\.boneId/u,
    'asset, Raster and Bone selection must all match the candidate focus'
);
assert.match(
    resolver,
    /if \(!isCurrent \|\| !isEligibleRaster \|\| hasPart \|\| hasMesh \|\| !bone\) \{[\s\S]*?_rigRasterCandidateFocus = null/u,
    'CAF/Raster mismatch, rigid target, Mesh generation and missing Bone clear the lens'
);
assert.doesNotMatch(
    resolver,
    /serialize|localStorage|_recordInternalLayerHistory|_recordTimelineHistory|rigDefinition\s*=|meshDefinitions\s*=|skinBindings\s*=/u,
    'candidate focus remains outside Project, History and static Rig authority'
);

for (const token of [
    'animationTable.getRigRasterCandidateFocusForExternal?.()',
    'animationTable.clearRigRasterCandidateFocusForExternal?.()',
    "projection?.bendSetup?.state === 'bone-ready'",
    "? '曲げRIG 準備中'",
    "inspector.dataset.rigFocus = hasPreMeshCandidateFocus ? 'pre-mesh' : 'none'",
    "&& !hasPreMeshCandidateFocus",
    'hasPreMeshCandidateFocus ||',
    'bendProgressButton.textContent = projection.bendSetup.nextActionLabel'
]) {
    assert.ok(renderer.includes(token), `right RIG Pre-Mesh lens must include ${token}`);
}

for (const token of [
    'Stage C6 — Pre-Mesh Bone candidate focus / Raster onboarding Gate',
    'runtime-only view lens',
    'Projectへownerやmode flagを保存しない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C6 boundary must include ${token}`);
}

console.log('verify-right-rig-pre-mesh-candidate-focus: runtime asset/Raster/Bone lens, no static owner, no Project/History mutation OK');
