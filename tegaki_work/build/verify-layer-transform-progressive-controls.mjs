/**
 * WP-008: runtime-only progressive Layer Transform shell contract.
 *
 * The verifier intentionally reads the production sources instead of creating
 * a second DOM implementation. It locks the small surface contract while
 * leaving styling and final labels available for Owner review.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const domSource = readFileSync(new URL('../ui/dom-builder.js', import.meta.url), 'utf8');
const transformSource = readFileSync(new URL('../system/layer-transform.js', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../ui/layer-transform-warp-controller.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../styles/components/layer-transform-basic.css', import.meta.url), 'utf8');
const mainStyleSource = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const workspaceStyleSource = readFileSync(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8');

// Level 1 keeps BASIC/WARP and the existing KEY strip available. The detail
// surfaces begin hidden and are runtime DOM state, not saved model fields.
assert.match(domSource, /data-transform-mode[\s\S]*?BASIC/);
assert.match(domSource, /data-transform-mode[\s\S]*?WARP/);
assert.match(domSource, /layer-transform-key-strip/);
assert.match(domSource, /layer-transform-extension-toggle/);
assert.match(domSource, /layer-transform-basic-extension/);
assert.match(domSource, /layer-transform-warp-extension/);
assert.match(domSource, /'data-transform-extension': 'basic'/);
assert.match(domSource, /'data-transform-extension': 'warp'/);
assert.match(domSource, /'data-warp-tool': 'point'/);
assert.match(domSource, /'data-warp-tool': 'brush'/);
assert.match(domSource, /'data-warp-brush-type': value/);
assert.match(domSource, /layer-transform-warp-brush-radius/);
assert.match(domSource, /layer-transform-warp-brush-strength/);
assert.match(domSource, /layer-transform-warp-brush-hardness/);

// The shared vocabulary is opt-in and all three visual sizes are used by the
// Transform surface without changing its ids, data attributes, or handlers.
assert.match(mainStyleSource, /--ui-control-height-s: 24px/);
assert.match(mainStyleSource, /--ui-control-height-m: 31px/);
assert.match(mainStyleSource, /--ui-control-height-l: 38px/);
assert.match(mainStyleSource, /\.gui-control--s/);
assert.match(mainStyleSource, /\.gui-control--m/);
assert.match(mainStyleSource, /\.gui-control--l/);
assert.match(mainStyleSource, /\.gui-segmented--secondary/);
assert.match(mainStyleSource, /\.gui-segmented--compact/);
assert.match(mainStyleSource, /\.gui-surface--compact/);
assert.doesNotMatch(mainStyleSource, /\.gui-control\s*,\s*(?:button|input|select)/);
assert.match(domSource, /modeStrip\.classList\.add\('gui-segmented', 'gui-segmented--secondary'\)/);
assert.match(domSource, /control\.classList\.add\('gui-control', 'gui-control--s', 'gui-control--icon'\)/);
assert.match(domSource, /extensionToggle\.classList\.add\('gui-control', 'gui-control--m', 'gui-control--quiet'\)/);
assert.match(domSource, /warpToolStrip\.classList\.add\('gui-segmented', 'gui-segmented--secondary'\)/);
assert.match(domSource, /brushTypeStrip\.classList\.add\('gui-segmented', 'gui-segmented--compact'\)/);
assert.match(mainStyleSource, /\.gui-segmented--secondary > \.gui-control:is\(\.is-selected, \.active, \[aria-selected="true"\], \[aria-pressed="true"\]\):hover/);

// The extension is bound independently of the optional slider helper, and the
// selected mode is the only extension made visible by the sync method.
assert.match(transformSource, /this\._setupProgressiveExtensionControls\(\);/);
assert.match(transformSource, /if \(!window\.TegakiUI\?\.SliderUtils\) \{/);
assert.match(transformSource, /basicExtension\.hidden = isWarp \|\| !open/);
assert.match(transformSource, /warpExtension\.hidden = !isWarp \|\| !open/);
assert.match(transformSource, /brushControls\.hidden = tool !== 'brush'/);
assert.match(transformSource, /this\.progressiveExtensionOpen = false/);

// Tool changes and brush settings stay in the interaction controller. They do
// not add a Project/History authority or a second WARP point store.
assert.match(controllerSource, /setInteractionTool\(/);
assert.match(controllerSource, /setBrushType\(/);
assert.match(controllerSource, /setBrushSettings\(/);
assert.match(controllerSource, /previewLayerWarpEditSession/);
assert.doesNotMatch(controllerSource, /pointWarpState/);
assert.doesNotMatch(controllerSource, /brushWarpState/);
assert.match(controllerSource, /getBrushPreview/);

// Existing WP-005 glass contract remains fixed while the rough controls are
// added to the same surface.
assert.match(mainStyleSource, /--ui-panel-glass-surface: rgba\(255, 255, 238, 0\.72\)/);
assert.match(mainStyleSource, /--ui-panel-glass-backdrop: blur\(3px\)/);
assert.match(styleSource, /layer-transform-extension-shell/);
assert.match(styleSource, /layer-transform-warp-brush-controls/);
assert.match(styleSource, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(styleSource, /::-webkit-slider-thumb \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(styleSource, /::-moz-range-thumb \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(workspaceStyleSource, /\.layer-panel-context-inspector \{[\s\S]*?padding-top: 9px/);

// The terminal stays on the existing V/Escape routes. Presentation changes to
// a same-row L-sized pair, but KEY confirmation remains a separate operation.
assert.match(workspaceSource, /className = 'gui-control gui-control--l gui-control--primary'/);
assert.match(workspaceSource, /textContent = '✓ 確定'/);
assert.match(workspaceSource, /toggleLayerTransform\?\.\('right-workspace'\)/);
assert.match(workspaceSource, /textContent = '× 取消'/);
assert.match(workspaceSource, /cancelSourceTransform: true/);
assert.match(workspaceSource, /cancelled: true/);
assert.match(workspaceStyleSource, /\.right-workspace-terminal \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(workspaceStyleSource, /\.layer-panel-context-inspector \{[\s\S]*?pointer-events: none/);
assert.match(workspaceStyleSource, /layer-transform-panel\.is-context-inspector > \* \{[\s\S]*?pointer-events: auto/);

console.log('verify-layer-transform-progressive-controls: shared S/M/L controls, compact glass inspector, terminals, runtime-only tools, and authority contracts OK');
