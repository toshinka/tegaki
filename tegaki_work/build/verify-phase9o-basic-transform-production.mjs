import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createTransformBoundsWorldCorners,
    createTransformOverlayScreenGeometry,
    normalizeTransformOverlayBounds
} from '../system/transform-overlay-geometry.js';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const repoDir = path.resolve(workDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

assert.deepEqual(normalizeTransformOverlayBounds({ x: 10, y: 20, width: 30, height: 40 }), {
    x: 10,
    y: 20,
    width: 30,
    height: 40
});
assert.equal(normalizeTransformOverlayBounds({ x: 0, y: 0, width: 0, height: 10 }), null);

assert.deepEqual(
    createTransformBoundsWorldCorners(
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        { width: 100, height: 100 }
    ),
    [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 60 },
        { x: 10, y: 60 }
    ]
);

assert.deepEqual(
    createTransformBoundsWorldCorners(
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 5, y: -2, rotation: 0, scaleX: 1, scaleY: 1 },
        { width: 100, height: 100 }
    ),
    [
        { x: 15, y: 18 },
        { x: 45, y: 18 },
        { x: 45, y: 58 },
        { x: 15, y: 58 }
    ]
);

const scaled = createTransformBoundsWorldCorners(
    { x: 10, y: 20, width: 30, height: 40 },
    { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2 },
    { width: 100, height: 100 }
);
assert.deepEqual(scaled, [
    { x: -30, y: -10 },
    { x: 30, y: -10 },
    { x: 30, y: 70 },
    { x: -30, y: 70 }
]);

const geometry = createTransformOverlayScreenGeometry([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 }
], 30);
assert.deepEqual(geometry.center, { x: 50, y: 25 });
assert.deepEqual(geometry.topMid, { x: 50, y: 0 });
assert.deepEqual(geometry.rotationHandle, { x: 50, y: -30 });
assert.equal(createTransformOverlayScreenGeometry([{ x: 0, y: 0 }]), null);

const index = read('index.html');
const domBuilder = read('ui/dom-builder.js');
const layerTransform = read('system/layer-transform.js');
const layerSystem = read('system/layer-system.js');
const overlay = read('ui/layer-transform-basic-overlay.js');
const css = read('styles/components/layer-transform-basic.css');
const fixture = read('build/phase9o-layer-transform-interaction-grammar-fixture.html');
const phase = fs.readFileSync(path.join(repoDir, 'task-codex', 'phase9o.md'), 'utf8');

assert.match(index, /styles\/components\/layer-transform-basic\.css/);
assert.match(domBuilder, /className: 'layer-transform-mode-strip'/);
assert.match(domBuilder, /textContent: 'BASIC'[\s\S]*?'aria-selected': 'true'/);
assert.match(domBuilder, /textContent: 'DISTORT'[\s\S]*?disabled: ''/);
assert.match(domBuilder, /textContent: 'WARP'[\s\S]*?disabled: ''/);
assert.match(domBuilder, /className: 'layer-transform-precise'/);
assert.match(domBuilder, /詳細 — 数値で正確に調整/);

assert.match(layerSystem, /calculateOpaqueRasterBounds/);
assert.match(layerSystem, /unionRasterBounds/);
assert.match(layerSystem, /sourceBounds: this\._resolveLayerTransformSourceBounds\(activeLayer\)/);
assert.match(layerSystem, /createTransformBoundsWorldCorners/);
assert.match(layerSystem, /this\.transform\.syncBasicOverlay\?\.\(\)/);

assert.match(layerTransform, /layerTransformBasicOverlay\.activate/);
assert.match(layerTransform, /layerTransformBasicOverlay\.deactivate/);
assert.match(layerTransform, /onGetTransformWorldCorners/);
assert.match(overlay, /display-only DOM overlay/);
assert.doesNotMatch(overlay, /(?:TegakiEventBus|historyManager|localStorage|sessionStorage|saveProject|fetch\s*\()/);
assert.match(css, /\.layer-transform-basic-overlay[\s\S]*?pointer-events: none/);
assert.match(css, /@media \(pointer: coarse\)[\s\S]*?min-height: 38px/);

const hybrid = fixture.match(/<article class="candidate" data-option="tegaki-hybrid"[\s\S]*?<\/article>/)?.[0] || '';
assert.equal((hybrid.match(/class="handle" data-handle=/g) || []).length, 4);
assert.match(phase, /Gate 1=`GO — D: Tegaki hybrid`/);
assert.match(phase, /read-only BASIC overlay/);
assert.match(phase, /DISTORT.*WARP.*後続Stage/s);

console.log('verify-phase9o-basic-transform-production: D shell, pure geometry, tight-bounds read-only overlay and authority isolation OK');
