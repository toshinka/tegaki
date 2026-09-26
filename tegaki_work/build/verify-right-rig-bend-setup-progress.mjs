import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRigAuthoringStatusProjection } from '../system/animation/rig-authoring-status-projection.js';

const [renderer, table, css, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8')
]);

const asset = {
    internalLayers: [{ id: 'art', type: 'raster', name: '一枚絵', parentLayerId: null }],
    rigDefinition: {
        parts: [],
        bones: [{ boneId: 'mesh-bone', name: 'MESH BONE', parentBoneId: null }],
        rigidBindings: []
    },
    meshDefinitions: [],
    skinBindings: []
};
const candidate = createRigAuthoringStatusProjection(asset, 'art');
assert.equal(candidate.bendSetup?.state, 'bone-ready');
assert.equal(candidate.bendSetup?.boneState, 'candidate', 'unbound pre-Mesh Bone is not target-owned');

asset.meshDefinitions.push({
    meshId: 'mesh',
    targetInternalLayerId: 'art',
    generator: { type: 'auto-shape-fill-v1' }
});
asset.skinBindings.push({
    meshId: 'mesh',
    vertexWeights: [{ vertexId: 'v1', influences: [{ boneId: 'mesh-bone', weight: 1 }] }]
});
const ready = createRigAuthoringStatusProjection(asset, 'art', { meshState: 'current' });
assert.equal(ready.bendSetup?.state, 'ready');
assert.deepEqual(
    {
        bone: ready.bendSetup?.boneState,
        mesh: ready.bendSetup?.meshGeneratorLabel,
        weight: ready.bendSetup?.weightState,
        next: ready.bendSetup?.nextActionLabel
    },
    { bone: 'connected', mesh: 'SHAPE', weight: 'connected', next: 'Weightを確認' }
);
const stale = createRigAuthoringStatusProjection(asset, 'art', { meshState: 'stale' });
assert.equal(stale.bendSetup?.state, 'stale');
assert.equal(stale.bendSetup?.nextActionLabel, 'Meshを更新');

assert.doesNotMatch(renderer, /context-rig-bend-progress|context-rig-open-bend-button/u,
    'Layer no longer projects legacy bend setup progress or a normal bend entry');
assert.match(renderer, /getRigLensLegacyFallbackTarget[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'unsupported bend setup can still reach its existing Raster editor through fallback');

const legacyFallbackOpener = renderer.match(
    /_openLegacyRigFallback\(button\)[\s\S]*?\n    \}/u
)?.[0] || '';
assert.match(
    legacyFallbackOpener,
    /getRigLensLegacyFallbackTarget[\s\S]*?fallback\.route === 'rigid-hierarchy'[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'the conditional fallback revalidates the selected target before choosing an existing Workspace route'
);
const adapter = table.match(
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}\n\n    _resolveInternalRigidHierarchyTarget/u
)?.[0] || '';
assert.match(adapter, /ok: true, changed: false/u, 'Raster setup handoff stays navigation-only');
assert.match(
    adapter,
    /_resolveInternalRasterRigSetupTarget\(assetId, layerId\)[\s\S]*?_selectRigRasterProjectionTarget\(context, \{[\s\S]*?focusRig: true,[\s\S]*?openInspector: true/u,
    'the existing handoff consumes the shared exact-target preflight and selects that context'
);
assert.doesNotMatch(
    adapter,
    /generateClipAssetRasterBoneSetup|applyClipAssetRasterSkin|_recordInternalLayerHistory/u,
    'right RIG progress neither generates Mesh nor edits Weight or History'
);
const rasterResolver = table.match(
    /_resolveInternalRasterRigSetupTarget\(assetId, layerId\)[\s\S]*?\n    \}\n\n    openInternalRasterRigSetupFromExternal/u
)?.[0] || '';
assert.match(
    rasterResolver,
    /_getRasterRigProjectionContext\([\s\S]*?projection,[\s\S]*?layer\.id,[\s\S]*?this\.selectedRigBoneId[\s\S]*?context\.layer\?\.id !== layer\.id/u,
    'the resolver checks the selected Raster before and after Mesh generation without substituting a target'
);

for (const token of [
    '.right-panel .layer-panel-legacy-rig-fallback',
    '.right-panel .layer-panel-legacy-rig-fallback-button',
    'color: var(--futaba-maroon)',
    'background: var(--ui-layer-surface-hover)'
]) {
    assert.ok(css.includes(token), `bend fallback surface must include ${token}`);
}
assert.doesNotMatch(css, /context-rig-(?:bend-progress|hierarchy|inspector)/u,
    'the retired Layer RIG inspector has no remaining component styles');

for (const token of [
    'Stage C5 — Raster bend setup progress / Mesh-Bone handoff Gate',
    'Mesh生成前のunbound BoneにはRaster ownerがない',
    '`BONE / MESH / WEIGHT`進捗',
    '右RIGはMesh生成・Weight編集・Historyを所有しない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C5 boundary must include ${token}`);
}

console.log('verify-right-rig-bend-setup-progress: candidate/connected Bone, Mesh freshness, Weight projection and conditional fallback OK');
