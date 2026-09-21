/**
 * Primary Layer / Transform segmented switch contract.
 *
 * The switch is presentation-only: Transform's existing show class and V
 * lifecycle remain authoritative, while pending edits are routed to the
 * existing confirm/cancel terminal instead of being committed implicitly.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frameSource = readFileSync(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8');

assert.match(frameSource, /_mountModeSwitch\(\)/,
    'Right Workspace mounts one shared mode switch');
assert.match(frameSource, /querySelector\(':scope > \.right-workspace-mode-switch'\)/,
    'mount reuses an existing direct child instead of duplicating the switch');
assert.match(frameSource, /textContent = 'LAYER'/);
assert.match(frameSource, /textContent = 'TRANSFORM'/);
assert.match(frameSource, /setAttribute\('role', 'group'\)/,
    'segmented switch exposes a grouped button contract');

assert.match(frameSource, /this\.panel\?\.classList\.contains\('show'\) === true/,
    'existing Transform panel visibility is the projected state authority');
assert.match(frameSource, /toggleLayerTransform\?\.\('right-workspace-segment'\)/,
    'segment actions delegate to the existing V lifecycle');
assert.match(frameSource, /commitState\?\.hasPendingTransform === true/,
    'existing commit projection guards pending Layer return');
assert.match(frameSource, /this\.endButton\?\.focus\?\.\(\{ preventScroll: true \}\)/,
    'pending Layer return focuses the existing terminal');
assert.doesNotMatch(frameSource, /panel\?\.classList\.(?:add|remove|toggle)\('show'/,
    'the segmented switch never writes Transform visibility state');

for (const projection of [
    "setAttribute('aria-pressed', String(!active))",
    "setAttribute('aria-pressed', String(active))"
]) {
    assert.ok(frameSource.includes(projection), `state projection includes ${projection}`);
}

const switchStyle = styleSource.match(
    /\/\* Primary Layer \/ Transform presentation switch\.[\s\S]*?@media \(pointer: coarse\) \{[\s\S]*?\n\}/u
)?.[0] || '';
assert.ok(switchStyle, 'primary segmented switch owns a scoped component style block');
assert.match(switchStyle, /width: min\(178px, 100%\)/,
    'compact switch width stays inside the existing content column');
assert.match(switchStyle, /min-height: 32px/);
assert.match(switchStyle, /min-height: 26px/);
assert.match(switchStyle, /font-size: 10px/);
assert.match(switchStyle, /font-weight: 700/);
assert.match(switchStyle, /border-radius: 999px/);
assert.match(switchStyle, /background: color-mix\(in srgb, var\(--futaba-background\) 58%, transparent\)/,
    'outer capsule derives its translucent surface from the Futaba background token');
assert.match(switchStyle, /background: color-mix\(in srgb, var\(--futaba-maroon\) 68%, transparent\)/,
    'selected capsule keeps maroon authority without becoming opaque');
assert.match(switchStyle, /backdrop-filter: var\(--ui-panel-glass-backdrop\)/,
    'capsule reuses the shared glass backdrop treatment');
assert.match(switchStyle, /color: var\(--futaba-background\)/,
    'selected label uses the existing light Futaba token');
assert.match(switchStyle, /outline: 2px solid var\(--active-border\)/,
    'keyboard focus remains distinct from selection fill');
assert.doesNotMatch(switchStyle, /#[0-9a-f]{3,8}|rgba?\(/iu,
    'the switch introduces no independent hard-coded color');
assert.doesNotMatch(switchStyle, /(?:^|[;{]\s*)opacity\s*:/mu,
    'glass alpha stays on backgrounds instead of fading labels');

assert.match(styleSource, /grid-template-rows: max-content minmax\(0, 1fr\) max-content/,
    'switch, active workspace and Status retain distinct grid rows');
assert.match(styleSource, /\.right-workspace-frame > \.layer-panel-container,[\s\S]*?grid-area: 2 \/ 1/u,
    'Drawing and Transform continue to replace each other in one content slot');
assert.match(styleSource, /\.right-workspace-frame > \.right-workspace-status \{\s*grid-area: 3 \/ 1/u,
    'Status remains a separate lower slot');
assert.match(switchStyle, /pointer-events: auto/,
    'only the visible switch surface opts into pointer ownership');

console.log('verify-right-workspace-layer-transform-switch: single mount, V authority, pending terminal, capsule tokens and grid ownership OK');
