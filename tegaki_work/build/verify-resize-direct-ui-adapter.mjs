import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const popupSource = await readFile(new URL('../ui/resize-popup.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../styles/main.css', import.meta.url), 'utf8');

assert.match(popupSource, /resolveResizePreviewDragOffset/);
assert.match(popupSource, /resolveResizeWheelScalePercent/);
assert.match(popupSource, /this\.resizeTarget !== 'content'/);
assert.match(popupSource, /offsetX: this\.contentOffset\.x/);
assert.match(popupSource, /offsetY: this\.contentOffset\.y/);
assert.match(popupSource, /this\.contentOffset = \{ x: 0, y: 0 \}/);
assert.match(popupSource, /previousTarget === 'content'[\s\S]*this\.contentOffset = \{ x: 0, y: 0 \}/);
assert.match(popupSource, /lostpointercapture/);
assert.match(cssSource, /\.resize-preview\.is-direct \.resize-preview-frame/);
assert.match(cssSource, /touch-action: none/);

console.log('verify-resize-direct-ui-adapter: ok');
