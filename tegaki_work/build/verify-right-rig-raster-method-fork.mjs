import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, table, componentCss, mainCss, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../../task-codex/phase9n.md', import.meta.url), 'utf8')
]);

for (const token of [
    'context-rig-method-actions',
    "actions.dataset.methodCount = canCreateRootPivot || hasRootPivot || canOpenBendSetup || isFolderTarget ? '1' : '2'",
    "(isFolderTarget ? '親子RIGの設定' : '一枚RasterのRIG方式')",
    'context-rig-open-bend-button',
    "bendButton.textContent = '曲げRIG'",
    "setupButton.textContent = isFolderTarget ? '親子RIGを開始' : '全体PIVOT'",
    'openInternalRasterRigSetupFromExternal',
    "{ source: 'right-rig-inspector' }"
]) {
    assert.ok(renderer.includes(token), `right RIG method fork must include ${token}`);
}

assert.match(
    table,
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?entry\?\.clip\?\.assetId !== asset\.id[\s\S]*?_getSelectedCafRigProjection\(\)[\s\S]*?if \(!this\.isVisible\) \{[\s\S]*?this\.show\(\)[\s\S]*?_selectRigRasterProjectionTarget\(context, \{[\s\S]*?focusRig: true,[\s\S]*?openInspector: true/u,
    'the external handoff reuses selected CAF projection and the existing Raster RIG inspector'
);
const externalAdapter = table.match(
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}/u
)?.[0] || '';
assert.doesNotMatch(
    externalAdapter,
    /_recordInternalLayerHistory|registerClipAssetRigPart|meshDefinitions\s*=|skinBindings\s*=|rigDefinition\s*=/u,
    'opening curve RIG setup does not mutate static Rig or History'
);
assert.match(
    externalAdapter,
    /ok: true, changed: false/u,
    'opening curve RIG setup is an explicit no-mutation navigation result'
);

for (const token of [
    '.right-panel .context-rig-method-button',
    'border: none',
    'color: var(--deformer-bind-point)',
    '.context-rig-method-actions[data-method-count="2"]',
    'grid-template-columns: repeat(2, minmax(0, 1fr))',
    '@media (max-width: 620px)',
    'margin-top: 0',
    '.right-panel .context-rig-inspector-target',
    'white-space: nowrap'
]) {
    assert.ok(componentCss.includes(token) || mainCss.includes(token), `method fork CSS must include ${token}`);
}
for (const token of [
    'Stage C2 — Raster method fork Gate',
    '曲げRIG / 全体PIVOT',
    '新しいMesh / Bone / Weight mutationやmode flagを作らない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C2 boundary must include ${token}`);
}

console.log('verify-right-rig-raster-method-fork: explicit curve/whole fork / existing inspector handoff / no setup mutation OK');
