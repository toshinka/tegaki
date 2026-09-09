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
assert.match(readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8'),
    /--ui-panel-glass-surface: rgba\(255, 255, 238, 0\.72\)/);
assert.match(readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8'),
    /--ui-panel-glass-backdrop: blur\(3px\)/);
assert.match(styleSource, /layer-transform-extension-shell/);
assert.match(styleSource, /layer-transform-warp-brush-controls/);

console.log('verify-layer-transform-progressive-controls: progressive shell, mode-local visibility, runtime-only tools, and glass contract OK');
