import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, table] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(renderer, /context-rig-root-pivot-button|_registerContextRigRootPivot/u,
    'Layer no longer presents a separate legacy PIVOT authoring action');
assert.match(renderer, /getRigLensLegacyFallbackTarget[\s\S]*?openInternalRigidHierarchyFromExternal/u,
    'an unsupported bound Part retains its conditional legacy hierarchy route');
assert.match(renderer, /textContent = '旧RIGで開く'/u,
    'the legacy route is presented as an explicit fallback');

assert.match(
    table,
    /registerInternalRootBoneFromExternal\(assetId, partId, options = \{\}\)[\s\S]*?_getRigTargetSourceBounds[\s\S]*?options\.allowEmptyTarget === true[\s\S]*?if \(!sourceBounds\) return \{ ok: false, reason: 'empty-part' \}[\s\S]*?registerClipAssetRootBoneBinding[\s\S]*?_recordInternalLayerHistory/u,
    'the saved legacy root binding adapter remains available with its existing bounds and History contract'
);
assert.match(table, /openInternalRigidHierarchyFromExternal\(assetId, layerId, options = \{\}\)/u,
    'the old Workspace hierarchy opener remains callable');
assert.doesNotMatch(renderer, /allowEmptyTarget|registerClipAssetRootBoneBinding/u,
    'Layer fallback does not take ownership of root Bone model or History data');

console.log('verify-right-rig-root-pivot-action: Layer entry retired / legacy root binding and Workspace compatibility preserved');
