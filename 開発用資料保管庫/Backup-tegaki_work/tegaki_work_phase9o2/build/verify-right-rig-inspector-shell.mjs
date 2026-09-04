import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, css, mainCss, domBuilder, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../styles/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/dom-builder.js', import.meta.url), 'utf8'),
    readFile(new URL('../../開発用資料保管庫/Archive/phase9n.md', import.meta.url), 'utf8')
]);

for (const token of [
    "this._contextDockView = 'layers'",
    "nextView === 'rig'",
    'animationTable.selectedInternalLayerId || null',
    'createRigAuthoringStatusProjection(asset, targetLayer.id, { meshStatus })',
    'layer-panel-context-view-switch',
    "button.type = 'button'",
    "button.setAttribute('aria-pressed'",
    "['Enter', ' ', 'Spacebar'].includes(e.key)",
    '_setContextDockView(button.dataset.layerPanelView)',
    "inspector.setAttribute('role', 'region')",
    'context-rig-inspector-target',
    'context-rig-inspector-status',
    'RIG WORKSPACE'
]) {
    assert.ok(renderer.includes(token), `right RIG shell must include ${token}`);
}

assert.match(
    renderer,
    /if \(!rigInspectorContext\) this\._contextDockView = 'layers';[\s\S]*?if \(rigInspectorContext\) \{[\s\S]*?_createContextDockViewSwitch/u,
    'normal drawing resets the runtime lens and does not expose the switch'
);
assert.match(
    renderer,
    /_resolveCafRigInspectorContext[\s\S]*?!animationTable\?\.selectedCelId[\s\S]*?findClipEntry\?\.\(animationTable\.selectedCelId\)/u,
    'RIG context derives from selectedCelId instead of Table visibility'
);
assert.doesNotMatch(
    renderer,
    /_rigSelected(?:Asset|Layer|Clip)|localStorage|sessionStorage/u,
    'Stage B must not create a second target selection or saved view state'
);
assert.doesNotMatch(
    renderer,
    /Animation TableのRIG設定/u,
    'right RIG handoff copy must name the single RIG WORKSPACE host'
);

for (const token of [
    '.right-panel .layer-panel-context-view-switch',
    '.right-panel .layer-panel-context-view-button.is-active',
    'box-shadow: inset 0 -2px 0 var(--active-border)',
    '.right-panel .context-rig-inspector',
    '.right-panel .context-rig-inspector-status[data-rig-status="stale"]',
    '@media (pointer: coarse)',
    'min-height: 38px'
]) {
    assert.ok(css.includes(token), `right RIG shell CSS must include ${token}`);
}
assert.doesNotMatch(
    mainCss,
    /layer-panel-container--rig-view[\s\S]{0,160}display:\s*none/u,
    'RIG view hides the mutation rail without collapsing its footprint'
);
for (const token of [
    '.layer-panel-context-view-switch',
    'position: sticky',
    '.context-rig-inspector',
    '.layer-panel-container.layer-panel-container--rig-view .layer-controls-row',
    'visibility: hidden',
    'pointer-events: none'
]) {
    assert.ok(mainCss.includes(token), `right RIG shell geometry must include ${token}`);
}

assert.equal(
    (domBuilder.match(/className:\s*'right-panel'/gu) || []).length,
    1,
    'Stage B keeps one right-panel DOM owner'
);
assert.doesNotMatch(
    domBuilder,
    /context-rig-inspector|layer-panel-context-view-switch/u,
    'Stage B stays inside the existing LayerPanelRenderer instead of adding a second DOM owner'
);

for (const token of [
    'Stage B — read-only RIG Panel shell（checkpoint完了）',
    'selectedCelId / selectedInternalLayerId',
    '132px content column',
    'accessibility treeごと隠す',
    'Setup青はmutation actionがまだ無いため使わない'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage B contract must include ${token}`);
}

console.log('verify-right-rig-inspector-shell: one right dock / shared CAF selection / read-only RIG projection / stable rail footprint OK');
