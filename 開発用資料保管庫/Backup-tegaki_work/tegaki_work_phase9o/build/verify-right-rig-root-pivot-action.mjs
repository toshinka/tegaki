import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, table, css, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8')
]);

for (const token of [
    'context-rig-root-pivot-button',
    '_registerContextRigRootPivot(rigRootPivotButton)',
    "['folder', 'raster'].includes(projection?.targetKind)",
    "['parent', 'whole'].includes(projection?.status)",
    'projection?.hasPart === true',
    'projection?.hasRootBoneBinding !== true',
    'registerInternalRootBoneFromExternal',
    "{ source: 'right-rig-inspector' }",
    "pivotButton.textContent = 'PIVOTを作成'",
    'PIVOTは未作成です。',
    "hierarchy.setAttribute('aria-label', 'PIVOT接続済み')",
    "result.setAttribute('role', 'status')"
]) {
    assert.ok(renderer.includes(token), `right RIG root PIVOT action must include ${token}`);
}

const action = renderer.match(
    /_registerContextRigRootPivot\(button\)[\s\S]*?\n    \}/u
)?.[0] || '';
assert.doesNotMatch(
    action,
    /_recordInternalLayerHistory|registerClipAssetRootBoneBinding|rigDefinition\s*=|allowEmptyTarget/u,
    'the right Panel neither mutates root Bone / History authority nor enables empty-target fallback'
);
assert.match(
    renderer,
    /if \(reason === 'empty-part'\)[\s\S]*?Folder内に描画が必要です[\s\S]*?Rasterに描画が必要です/u,
    'empty Folder and Raster failures remain explicit'
);

assert.match(
    table,
    /registerInternalRootBoneFromExternal\(assetId, partId, options = \{\}\)[\s\S]*?_getRigTargetSourceBounds[\s\S]*?options\.allowEmptyTarget === true[\s\S]*?if \(!sourceBounds\) return \{ ok: false, reason: 'empty-part' \}[\s\S]*?registerClipAssetRootBoneBinding[\s\S]*?_recordInternalLayerHistory/u,
    'the reused adapter owns drawing bounds, empty rejection, root binding and History'
);

for (const token of [
    '.right-panel .context-rig-method-button',
    'border: none',
    'color: var(--deformer-bind-point)',
    'min-height: 38px'
]) {
    assert.ok(css.includes(token), `root PIVOT action reuses Setup-blue borderless CSS token ${token}`);
}

for (const token of [
    'Stage C3 — Rigid Part root PIVOT completion Gate',
    'Folder / Raster',
    'registerInternalRootBoneFromExternal()',
    '`empty-part`拒否',
    '`allowEmptyTarget`やfallback boundsをUI都合で追加しない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C3 boundary must include ${token}`);
}

console.log('verify-right-rig-root-pivot-action: Folder/Raster shared completion / existing adapter / empty reject / no direct mutation OK');
