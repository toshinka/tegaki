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

for (const token of [
    '_createContextRigHierarchyElement(projection)',
    "hierarchy.dataset.parentState = parentState",
    "appendRow('PIVOT', boneLabel)",
    "appendRow('PARENT', parentLabel)",
    "? 'なし（ROOT）'",
    'context-rig-hierarchy-open-button',
    "hierarchyButton.textContent = '接続を編集'",
    '_openContextRigHierarchy(rigHierarchyButton)',
    'openInternalRigidHierarchyFromExternal',
    "{ source: 'right-rig-inspector' }"
]) {
    assert.ok(renderer.includes(token), `right RIG hierarchy handoff must include ${token}`);
}

assert.match(
    renderer,
    /_openContextRigHierarchy\(button\)[\s\S]*?projection\?\.hasRootBoneBinding === true[\s\S]*?openInternalRigidHierarchyFromExternal/u,
    'the handoff rechecks the fresh configured target before opening the existing editor'
);

const externalAdapter = table.match(
    /openInternalRigidHierarchyFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}\n\n    registerInternalRigPartFromExternal/u
)?.[0] || '';
assert.match(
    externalAdapter,
    /_getSelectedCafRigProjection\(\)[\s\S]*?_selectRigFolderProjectionTarget\(context, \{[\s\S]*?focusRig: true,[\s\S]*?openInspector: true/u,
    'the external adapter opens the selected existing RIG Setup context'
);
assert.match(externalAdapter, /ok: true, changed: false/u, 'hierarchy handoff is explicit navigation only');
assert.doesNotMatch(
    externalAdapter,
    /_recordInternalLayerHistory|setClipAssetRigBoneParent|registerClipAssetRootBoneBinding|rigDefinition\s*=/u,
    'hierarchy handoff neither changes parent links nor owns History'
);

for (const token of [
    '.right-panel .context-rig-handoff-button',
    'border: none',
    'color: var(--futaba-maroon)',
    '.right-panel .context-rig-hierarchy',
    'grid-template-columns: 38px minmax(0, 1fr)'
]) {
    assert.ok(css.includes(token), `hierarchy surface must include ${token}`);
}

for (const token of [
    'Stage C4 — Bone hierarchy / parent-link handoff Gate',
    'Partのbinding先BoneとRig全体のROOTを分離',
    '`boundBone / parentBone / parentLayer / parentLinkState`',
    '既存Animation Tableの親BONE dropdownを開く非破壊handoff'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C4 boundary must include ${token}`);
}

console.log('verify-right-rig-parent-link-handoff: bound Bone vs ROOT / read-only hierarchy / existing editor navigation / no mutation OK');
