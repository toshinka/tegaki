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
    internalLayers: [
        { id: 'body', type: 'folder', name: '体', parentLayerId: null },
        { id: 'arm', type: 'folder', name: '腕', parentLayerId: 'body' }
    ],
    rigDefinition: {
        parts: [{ partId: 'body' }, { partId: 'arm' }],
        bones: [
            { boneId: 'body-bone', name: 'BODY', parentBoneId: null },
            { boneId: 'arm-bone', name: 'ARM', parentBoneId: 'body-bone' }
        ],
        rigidBindings: [
            { partId: 'body', boneId: 'body-bone' },
            { partId: 'arm', boneId: 'arm-bone' }
        ]
    },
    meshDefinitions: [],
    skinBindings: []
};
const linked = createRigAuthoringStatusProjection(asset, 'arm');
assert.equal(linked.hasRootBoneBinding, true, 'parent linking keeps the Part PIVOT configured');
assert.equal(linked.parentLinkState, 'linked');
assert.equal(linked.parentLayer?.name, '体');

assert.doesNotMatch(renderer, /context-rig-hierarchy-open-button|接続を編集/u,
    'the Layer panel no longer exposes the hierarchy editor as a normal action');
assert.match(renderer, /getRigLensLegacyFallbackTarget[\s\S]*?openInternalRigidHierarchyFromExternal[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'legacy hierarchy and Raster editors are exposed only through the conditional fallback route');

const externalAdapter = table.match(
    /openInternalRigidHierarchyFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}/u
)?.[0] || '';
assert.match(
    externalAdapter,
    /_resolveInternalRigidHierarchyTarget\(assetId, layerId\)[\s\S]*?_selectRigFolderProjectionTarget\(context, \{[\s\S]*?focusRig: true,[\s\S]*?openInspector: true/u,
    'the external adapter opens the selected existing RIG Setup context'
);
assert.match(externalAdapter, /ok: true, changed: false/u, 'hierarchy handoff is explicit navigation only');
assert.doesNotMatch(
    externalAdapter,
    /_recordInternalLayerHistory|setClipAssetRigBoneParent|registerClipAssetRootBoneBinding|rigDefinition\s*=/u,
    'hierarchy handoff neither changes parent links nor owns History'
);
const targetResolver = table.match(
    /_resolveInternalRigidHierarchyTarget\(assetId, layerId\)[\s\S]*?\n    \}\n\n    openInternalRigidHierarchyFromExternal/u
)?.[0] || '';
assert.match(targetResolver, /rigidBindings[\s\S]*?bones[\s\S]*?_getSelectedCafRigProjection\(\)[\s\S]*?candidate\?\.layer\?\.id === layer\.id/u,
    'fallback eligibility and the opener share the exact bound Part / Bone projection');

for (const token of [
    '.right-panel .layer-panel-legacy-rig-fallback-button',
    'border: 1px solid var(--ui-panel-glass-border)',
    'color: var(--futaba-medium)',
    '.right-panel .layer-panel-legacy-rig-fallback-description',
    'grid-column: 1 / -1'
]) {
    assert.ok(css.includes(token), `legacy hierarchy fallback surface must include ${token}`);
}

for (const token of [
    'Stage C4 — Bone hierarchy / parent-link handoff Gate',
    'Partのbinding先BoneとRig全体のROOTを分離',
    '`boundBone / parentBone / parentLayer / parentLinkState`',
    '既存Animation Tableの親BONE dropdownを開く非破壊handoff'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C4 boundary must include ${token}`);
}

console.log('verify-right-rig-parent-link-handoff: bound Bone vs ROOT / conditional hierarchy escape hatch / no mutation OK');
