import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, table, componentCss, mainCss, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8')
]);

for (const token of [
    'layer-panel-legacy-rig-fallback-button',
    "button.textContent = '旧RIGで開く'",
    'getRigLensLegacyFallbackTarget',
    'openInternalRasterRigSetupFromExternal',
    "{ source: 'layer-panel-legacy-fallback' }"
]) {
    assert.ok(renderer.includes(token), `legacy Raster fallback must include ${token}`);
}
assert.doesNotMatch(renderer, /context-rig-(?:method-actions|open-bend-button|register-button)/u,
    'new curve/whole setup entry buttons are retired from the Layer panel');

assert.match(
    table,
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?_resolveInternalRasterRigSetupTarget\(assetId, layerId\)[\s\S]*?_selectRigRasterProjectionTarget\(context, \{[\s\S]*?focusRig: true,[\s\S]*?openInspector: true/u,
    'the external handoff reuses the exact selected target resolver and existing Raster RIG inspector'
);
const externalAdapter = table.match(
    /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?\n    \}\n\n    _resolveInternalRigidHierarchyTarget/u
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
const targetResolver = table.match(
    /_resolveInternalRasterRigSetupTarget\(assetId, layerId\)[\s\S]*?\n    \}\n\n    openInternalRasterRigSetupFromExternal/u
)?.[0] || '';
assert.match(targetResolver, /entry\?\.clip\?\.assetId !== asset\.id[\s\S]*?_getSelectedCafRigProjection\(\)[\s\S]*?_getRasterRigProjectionContext/u,
    'eligibility uses the same selected CAF / Raster projection as the legacy opener');
assert.match(targetResolver, /context\.layer\?\.id !== layer\.id/u,
    'legacy Raster preflight refuses a stale or substituted target');

for (const token of [
    '.right-panel .layer-panel-legacy-rig-fallback',
    'grid-template-columns: minmax(0, 1fr) auto',
    '.right-panel .layer-panel-legacy-rig-fallback-button',
    'min-height: 26px',
    'background: var(--ui-layer-surface-hover)',
    '@media (pointer: coarse)',
    'min-height: 38px'
]) {
    assert.ok(componentCss.includes(token) || mainCss.includes(token), `legacy fallback CSS must include ${token}`);
}
for (const token of [
    'Stage C2 — Raster method fork Gate',
    '曲げRIG / 全体PIVOT',
    '新しいMesh / Bone / Weight mutationやmode flagを作らない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C2 boundary must include ${token}`);
}

console.log('verify-right-rig-raster-method-fork: unsupported Raster fallback / exact existing Workspace handoff / no setup mutation OK');
