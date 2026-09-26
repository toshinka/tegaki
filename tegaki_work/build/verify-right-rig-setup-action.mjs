import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, css, table, frame] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(renderer, /context-rig-register-button|_registerContextRigTarget/u,
    'normal PART registration no longer has a second Layer-panel authoring entry');
assert.match(renderer, /getRigLensLegacyFallbackTarget[\s\S]*?openInternalRigidHierarchyFromExternal[\s\S]*?openInternalRasterRigSetupFromExternal/u,
    'only an unsupported target with an existing route exposes legacy editing');
assert.match(renderer, /textContent = '旧RIGで開く'/u,
    'the conditional route is labeled as a secondary legacy action');
assert.doesNotMatch(css, /context-rig-(?:method|inspector|hierarchy|bend)/u,
    'the old Layer-panel RIG authoring shell has no component styles');

assert.match(frame, /_renderRigPartLens[\s\S]*?this\.rigPartRegisterButton/u,
    'PART Setup remains available in the top-level RIG lens');
assert.match(table,
    /registerRigLensPart\(assetId, partId, initialPivot = null\)[\s\S]*?registerInternalRigPartFromExternal/u,
    'the top-level PART lens still uses the existing CAF Part adapter');
assert.match(table,
    /registerInternalRigPartFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?registerClipAssetRigPart[\s\S]*?caf-rig-part-register/u,
    'the existing Part model / History owner remains unchanged');

console.log('verify-right-rig-setup-action: top-level PART Setup / conditional legacy fallback / existing model owner OK');
