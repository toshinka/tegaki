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

for (const token of [
    '_createContextRigBendProgressElement(projection)',
    "progress.setAttribute('aria-label', '曲げRIG設定進捗')",
    "appendRow('BONE', boneLabel)",
    "appendRow('MESH', meshLabel)",
    "appendRow('WEIGHT', weightLabel)",
    "['bend', 'stale', 'conflict'].includes(projection?.status)",
    'bendProgressButton.textContent = projection.bendSetup.nextActionLabel',
    'context-rig-handoff-button context-rig-open-bend-button'
]) {
    assert.ok(renderer.includes(token), `right RIG bend progress must include ${token}`);
}

assert.match(
    renderer,
    /_openContextRasterRigSetup\(button\)[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'the progress action reuses the existing Raster RIG editor handoff'
);
const adapter = table.match(
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}\n\n    openInternalRigidHierarchyFromExternal/u
)?.[0] || '';
assert.match(adapter, /ok: true, changed: false/u, 'Raster setup handoff stays navigation-only');
assert.match(
    adapter,
    /_getRasterRigProjectionContext\([\s\S]*?projection,[\s\S]*?layer\.id,[\s\S]*?this\.selectedRigBoneId/u,
    'the handoff resolves the Raster target before and after Mesh generation'
);
assert.doesNotMatch(
    adapter,
    /generateClipAssetRasterBoneSetup|applyClipAssetRasterSkin|_recordInternalLayerHistory/u,
    'right RIG progress neither generates Mesh nor edits Weight or History'
);

for (const token of [
    '.right-panel .context-rig-bend-progress',
    '.right-panel .context-rig-bend-progress-row',
    'color: var(--futaba-maroon)'
]) {
    assert.ok(css.includes(token), `bend progress surface must include ${token}`);
}
assert.doesNotMatch(
    css.match(/\.right-panel \.context-rig-hierarchy,[\s\S]*?\.context-rig-inspector-result/u)?.[0] || '',
    /border\s*:/u,
    'BONE / MESH / WEIGHT progress remains frameless'
);

for (const token of [
    'Stage C5 — Raster bend setup progress / Mesh-Bone handoff Gate',
    'Mesh生成前のunbound BoneにはRaster ownerがない',
    '`BONE / MESH / WEIGHT`進捗',
    '右RIGはMesh生成・Weight編集・Historyを所有しない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C5 boundary must include ${token}`);
}

console.log('verify-right-rig-bend-setup-progress: candidate/connected Bone, Mesh freshness, Weight projection and existing handoff OK');
