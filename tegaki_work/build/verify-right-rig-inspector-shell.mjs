import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, css, mainCss, domBuilder, popup, frame] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/dom-builder.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8')
]);

const render = renderer.slice(
    renderer.indexOf('render(layers, activeIndex, animationSystem = null)'),
    renderer.indexOf('    getDiagnosticsSnapshot() {')
);
assert.match(render, /legacyRigFallback\?\.ok === true[\s\S]*?_createLegacyRigFallbackElement/u,
    'the old route appears only from the selected target fallback projection');
assert.doesNotMatch(render, /_createContextDockViewSwitch|_createCafRigInspectorElement/u,
    'Layer no longer renders an ordinary RIG view or switch');
assert.match(renderer, /getRigLensLegacyFallbackTarget\?\./u,
    'the fallback click revalidates the selected CAF target');
assert.match(popup, /inspectStaticRigAuthoringTarget[\s\S]*?inspectStaticRigBindGestureTarget[\s\S]*?_resolveInternalRigidHierarchyTarget[\s\S]*?_resolveInternalRasterRigSetupTarget/u,
    'fallback eligibility joins existing RIG inspection and legacy route resolvers');
assert.match(popup, /openInternalRasterRigSetupFromExternal\(assetId, layerId, options = \{\}\)/u,
    'the legacy Raster Workspace route remains callable');
assert.match(popup, /openInternalRigidHierarchyFromExternal\(assetId, layerId, options = \{\}\)/u,
    'the legacy hierarchy Workspace route remains callable');
assert.match(frame, /textContent = 'RIG'/u,
    'top-level RIG remains in the primary Layer / Transform / RIG navigation');
assert.doesNotMatch(frame, /rigLayerEntryButton|right-workspace-rig-layer-entry/u,
    'the Layer surface has no duplicate RIG primary CTA');

for (const obsoleteSelector of [
    '.layer-panel-context-view-switch',
    '.layer-panel-context-view-button',
    '.right-workspace-rig-layer-entry'
]) {
    assert.equal(css.includes(obsoleteSelector), false, `${obsoleteSelector} component styling is retired`);
    assert.equal(mainCss.includes(obsoleteSelector), false, `${obsoleteSelector} global styling is retired`);
}
assert.match(css, /\.right-panel \.layer-panel-legacy-rig-fallback-button[\s\S]*?min-height:\s*26px/u,
    'the fallback receives a compact secondary-action surface');
assert.doesNotMatch(mainCss, /layer-panel-container--rig-view[\s\S]{0,160}visibility:\s*hidden/u,
    'Layer mutation controls are no longer hidden by a second RIG view');
assert.equal(
    (domBuilder.match(/className:\s*'right-panel'/gu) || []).length,
    1,
    'the fallback stays inside the existing right-panel DOM owner'
);
assert.doesNotMatch(
    domBuilder,
    /layer-panel-legacy-rig-fallback|layer-panel-context-view-switch/u,
    'the fallback remains inside LayerPanelRenderer instead of adding a new DOM owner'
);

console.log('verify-right-rig-inspector-shell: top-level RIG primary / exact-target legacy escape hatch / one right-panel owner OK');
