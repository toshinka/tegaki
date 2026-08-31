import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createAxisScaleTransformFromScreenProjection,
    createRotationTransformFromScreenAngleDelta,
    createTransformBoundsWorldCorners,
    createTransformOverlayScreenGeometry,
    createUniformScaleTransformFromScreenDistance,
    normalizeScreenAngleDelta,
    normalizeTransformOverlayBounds,
    resolveScreenBasisCoordinates,
    resolveTransformContentCenterAnchor
} from '../system/transform-overlay-geometry.js';
import {
    captureLayerTransformPreviewSampling,
    restoreLayerTransformPreviewSampling,
    shouldUseExactPixelTransformPreview,
    updateLayerTransformPreviewSampling
} from '../system/layer-transform-preview-sampling.js';

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
    resolveTransformContentCenterAnchor(
        { x: -10, y: 20, width: 30, height: 40 },
        { width: 100, height: 200 }
    ),
    { x: 0.05, y: 0.2 }
);
assert.equal(resolveTransformContentCenterAnchor(
    { x: 0, y: 0, width: 10, height: 10 },
    { width: 0, height: 100 }
), null);

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
assert.deepEqual(geometry.sideMidpoints, [
    { x: 50, y: 0 },
    { x: 100, y: 25 },
    { x: 50, y: 50 },
    { x: 0, y: 25 }
]);
assert.deepEqual(geometry.rotationHandle, { x: 50, y: -30 });
assert.equal(createTransformOverlayScreenGeometry([{ x: 0, y: 0 }]), null);

const flippedScale = { x: 3, y: -4, rotation: 0.2, scaleX: -2, scaleY: 0.5 };
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(flippedScale, 100, 150),
    { x: 3, y: -4, rotation: 0.2, scaleX: -3, scaleY: 0.75 }
);
assert.deepEqual(flippedScale, { x: 3, y: -4, rotation: 0.2, scaleX: -2, scaleY: 0.5 });
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(flippedScale, 100, 0),
    { x: 3, y: -4, rotation: 0.2, scaleX: -0.4, scaleY: 0.1 }
);
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(flippedScale, 100, 10000),
    { x: 3, y: -4, rotation: 0.2, scaleX: -30, scaleY: 7.5 }
);
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(flippedScale, 100, 50, { direction: -1 }),
    { x: 3, y: -4, rotation: 0.2, scaleX: 1, scaleY: -0.25 }
);
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(
        flippedScale,
        100,
        0,
        { minScale: 0.0001 }
    ),
    { x: 3, y: -4, rotation: 0.2, scaleX: -0.0004, scaleY: 0.0001 }
);
assert.deepEqual(
    createUniformScaleTransformFromScreenDistance(flippedScale, 0, 100),
    flippedScale
);

assert.deepEqual(
    resolveScreenBasisCoordinates(
        { x: 10, y: 20 },
        { x: 87, y: 25 },
        { x: 100, y: 20 },
        { x: -10, y: 50 }
    ),
    { x: 0.75, y: -0.2 }
);
assert.equal(resolveScreenBasisCoordinates(
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 2 }
), null);
assert.deepEqual(
    createAxisScaleTransformFromScreenProjection(flippedScale, 'x', 0.5, 0.75),
    { x: 3, y: -4, rotation: 0.2, scaleX: -3, scaleY: 0.5 }
);
assert.deepEqual(
    createAxisScaleTransformFromScreenProjection(flippedScale, 'y', -0.5, -1),
    { x: 3, y: -4, rotation: 0.2, scaleX: -2, scaleY: 1 }
);
assert.deepEqual(
    createAxisScaleTransformFromScreenProjection(flippedScale, 'x', 0.5, -0.25),
    { x: 3, y: -4, rotation: 0.2, scaleX: 1, scaleY: 0.5 }
);
assert.deepEqual(
    createAxisScaleTransformFromScreenProjection(flippedScale, 'x', 0.5, 100),
    { x: 3, y: -4, rotation: 0.2, scaleX: -30, scaleY: 0.5 }
);
assert.deepEqual(
    createAxisScaleTransformFromScreenProjection(
        flippedScale,
        'x',
        0.5,
        0,
        { minScale: 0.0001 }
    ),
    { x: 3, y: -4, rotation: 0.2, scaleX: -0.0001, scaleY: 0.5 }
);
assert.deepEqual(flippedScale, { x: 3, y: -4, rotation: 0.2, scaleX: -2, scaleY: 0.5 });

assert.equal(shouldUseExactPixelTransformPreview({ scaleX: 1, scaleY: 1 }), false);
assert.equal(shouldUseExactPixelTransformPreview({ scaleX: -1.01, scaleY: 1 }), true);
const previewStyle = {
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    updateCount: 0,
    update() { this.updateCount++; }
};
const previewLayer = {
    layerData: { renderTexture: { source: { style: previewStyle } } }
};
const previewSampling = captureLayerTransformPreviewSampling([previewLayer, previewLayer]);
assert.equal(previewSampling.length, 1);
assert.equal(updateLayerTransformPreviewSampling(previewSampling, { scaleX: 2, scaleY: 1 }), true);
assert.deepEqual(
    [previewStyle.magFilter, previewStyle.minFilter, previewStyle.mipmapFilter],
    ['nearest', 'nearest', 'nearest']
);
assert.equal(previewStyle.updateCount, 1);
assert.equal(updateLayerTransformPreviewSampling(previewSampling, { scaleX: 0.75, scaleY: 1 }), false);
assert.deepEqual(
    [previewStyle.magFilter, previewStyle.minFilter, previewStyle.mipmapFilter],
    ['linear', 'linear', 'linear']
);
restoreLayerTransformPreviewSampling(previewSampling);
assert.equal(previewStyle.updateCount, 2);

assert.ok(Math.abs(normalizeScreenAngleDelta(
    179 * Math.PI / 180,
    -179 * Math.PI / 180
) - (2 * Math.PI / 180)) < 1e-10);
const rotated = createRotationTransformFromScreenAngleDelta(
    flippedScale,
    Math.PI / 2,
    { direction: 1 }
);
assert.deepEqual(rotated, {
    x: 3,
    y: -4,
    rotation: 0.2 + Math.PI / 2,
    scaleX: -2,
    scaleY: 0.5
});
assert.deepEqual(flippedScale, { x: 3, y: -4, rotation: 0.2, scaleX: -2, scaleY: 0.5 });
assert.equal(
    createRotationTransformFromScreenAngleDelta(
        { rotation: 0 },
        Math.PI / 2,
        { direction: -1 }
    ).rotation,
    -Math.PI / 2
);
assert.ok(Math.abs(createRotationTransformFromScreenAngleDelta(
    { rotation: Math.PI * 1.9 },
    Math.PI * 0.2,
    {
        rotationLoop: true,
        minRotation: -Math.PI * 2,
        maxRotation: Math.PI * 2
    }
).rotation - (-Math.PI * 1.9)) < 1e-10);

const index = read('index.html');
const domBuilder = read('ui/dom-builder.js');
const layerTransform = read('system/layer-transform.js');
const layerSystem = read('system/layer-system.js');
const previewSamplingSource = read('system/layer-transform-preview-sampling.js');
const overlay = read('ui/layer-transform-basic-overlay.js');
const css = read('styles/components/layer-transform-basic.css');
const fixture = read('build/phase9o-layer-transform-interaction-grammar-fixture.html');
const phase = fs.readFileSync(path.join(repoDir, 'task-codex', 'phase9o.md'), 'utf8');
const addendum = fs.readFileSync(
    path.join(repoDir, '開発用資料保管庫', 'proposals', 'Tegaki_Transform_Rig_Authoring_Interaction_Addendum_2026-08-31.md'),
    'utf8'
);
const revisedAddendum = fs.readFileSync(
    path.join(repoDir, '開発用資料保管庫', 'proposals', 'Tegaki_Transform_Rig_Authoring_Interaction_Addendum_REVISED_2026-08-31.md'),
    'utf8'
);

assert.match(index, /styles\/components\/layer-transform-basic\.css/);
assert.match(domBuilder, /className: 'layer-transform-mode-strip'/);
assert.match(domBuilder, /textContent: 'BASIC'[\s\S]*?'aria-selected': 'true'/);
assert.match(domBuilder, /textContent: 'DISTORT'[\s\S]*?disabled: ''/);
assert.match(domBuilder, /textContent: 'WARP'[\s\S]*?disabled: ''/);
assert.match(domBuilder, /className: 'layer-transform-precise'/);
assert.match(domBuilder, /詳細 — 数値で正確に調整/);
assert.match(domBuilder, /中心点を編集。ダブルクリックで描画範囲の中央へ戻す/);
assert.ok(
    domBuilder.indexOf("id: 'layer-transform-anchor-btn'")
        < domBuilder.indexOf("id: 'flip-horizontal-btn'")
);

assert.match(layerSystem, /calculateOpaqueRasterBounds/);
assert.match(layerSystem, /unionRasterBounds/);
assert.match(layerSystem, /sourceBounds: this\._resolveLayerTransformSourceBounds\(activeLayer\)/);
assert.match(layerSystem, /createTransformBoundsWorldCorners/);
assert.match(layerSystem, /this\.transform\.syncBasicOverlay\?\.\(\)/);
assert.match(layerSystem, /captureLayerTransformPreviewSampling/);
assert.match(layerSystem, /restoreLayerTransformPreviewSampling\(this\._layerTransformSession\?\.previewSampling\)/);
assert.match(previewSamplingSource, /Project \/ Layer schema、History、確定Bakeを所有せず/);

assert.match(layerTransform, /layerTransformBasicOverlay\.activate/);
assert.match(layerTransform, /layerTransformBasicOverlay\.deactivate/);
assert.match(layerTransform, /onGetTransformWorldCorners/);
assert.match(layerTransform, /onGetTransformSourceBounds/);
assert.match(layerTransform, /const getCurrentTransform = \(\) =>/);
assert.match(layerTransform, /_resetAnchorToContentCenter\(\)/);
assert.match(layerTransform, /_getContentCenterAnchor\(\)/);
assert.match(layerTransform, /BASIC_HANDLE_SCALE_EPSILON = 0\.0001/);
assert.match(layerTransform, /minScale: BASIC_HANDLE_SCALE_EPSILON/);
assert.match(layerTransform, /anchorBtn\?\.addEventListener\('dblclick'/);
assert.match(overlay, /四隅、辺中点、rotation handleの[\s\S]*pointer入力をcallbackへ渡す/);
assert.doesNotMatch(overlay, /(?:TegakiEventBus|historyManager|localStorage|sessionStorage|saveProject|fetch\s*\()/);
assert.match(overlay, /onUniformScaleStart/);
assert.match(overlay, /onRotationStart/);
assert.match(overlay, /onAxisScaleStart/);
assert.match(overlay, /setPointerCapture/);
assert.match(overlay, /document\.addEventListener\('pointermove'/);
assert.match(overlay, /_removePointerGestureListeners/);
assert.match(overlay, /_raiseInteractiveHandle\('corner', cornerIndex\)/);
assert.match(overlay, /_raiseInteractiveHandle\('side', sideIndex\)/);
assert.match(overlay, /appendChild\(visual\)[\s\S]*?appendChild\(hit\)/);
assert.equal((overlay.match(/classList\.add\('layer-transform-basic-overlay__corner'\)/g) || []).length, 1);
assert.match(overlay, /for \(let index = 0; index < 4; index\+\+\)[\s\S]*?corner-hit/);
assert.match(overlay, /for \(let index = 0; index < 4; index\+\+\)[\s\S]*?side-hit/);
assert.match(layerTransform, /createUniformScaleTransformFromScreenDistance/);
assert.match(layerTransform, /onUniformScaleStart:[\s\S]*?_startBasicUniformScaleGesture/);
assert.match(layerTransform, /handlePoint = geometry\?\.corners\?\.\[gesture\.cornerIndex\]/);
assert.match(layerTransform, /startVector[\s\S]*?startPointer/);
assert.match(layerTransform, /currentVector = \{[\s\S]*?state\.startPointer\.x[\s\S]*?state\.startPointer\.y/);
assert.match(layerTransform, /createRotationTransformFromScreenAngleDelta/);
assert.match(layerTransform, /onRotationStart:[\s\S]*?_startBasicRotationGesture/);
assert.match(layerTransform, /normalizeScreenAngleDelta/);
assert.match(layerTransform, /createAxisScaleTransformFromScreenProjection/);
assert.match(layerTransform, /resolveScreenBasisCoordinates/);
assert.match(layerTransform, /onAxisScaleStart:[\s\S]*?_startBasicAxisScaleGesture/);
assert.match(layerTransform, /handleCoordinates[\s\S]*?startPointerProjection/);
assert.match(layerTransform, /currentProjection = state\.startProjection[\s\S]*?- state\.startPointerProjection/);
assert.match(layerTransform, /_syncingLayerTransformPanel[\s\S]*?if \(this\._syncingLayerTransformPanel\) return/);
assert.match(layerTransform, /updateTransformPanelValues\(layer\)[\s\S]*?try \{[\s\S]*?finally \{[\s\S]*?_syncingLayerTransformPanel = false/);
assert.match(layerTransform, /gesture\.cancelled !== true/);
assert.match(css, /\.layer-transform-basic-overlay[\s\S]*?pointer-events: none/);
assert.match(css, /__corner-hit[\s\S]*?pointer-events: all/);
assert.match(css, /__side-hit[\s\S]*?pointer-events: all/);
assert.match(css, /__side\.is-hovered[\s\S]*?var\(--active-border\)/);
assert.match(css, /__rotation-hit[\s\S]*?pointer-events: all[\s\S]*?cursor: grab/);
assert.match(css, /@media \(pointer: coarse\)[\s\S]*?__corner-hit[\s\S]*?__side-hit[\s\S]*?__rotation-hit[\s\S]*?r: 18px/);
assert.match(css, /__rotation-stem[\s\S]*?stroke: var\(--futaba-maroon\)/);
assert.match(css, /__rotation \{[\s\S]*?fill: var\(--futaba-cream\)[\s\S]*?stroke: var\(--futaba-maroon\)/);
assert.match(css, /__rotation\.is-hovered[\s\S]*?var\(--active-border\)/);
assert.match(css, /@media \(pointer: coarse\)[\s\S]*?min-height: 38px/);
assert.match(css, /\.transform-anchor-toggle[\s\S]*?margin-right: 4px/);

const hybrid = fixture.match(/<article class="candidate" data-option="tegaki-hybrid"[\s\S]*?<\/article>/)?.[0] || '';
assert.equal((hybrid.match(/class="handle" data-handle=/g) || []).length, 4);
assert.match(phase, /Gate 1=`GO — D: Tegaki hybrid`/);
assert.match(phase, /read-only BASIC overlay/);
assert.match(phase, /DISTORT.*WARP.*後続Stage/s);
assert.match(phase, /Addendumの採否/);
assert.match(phase, /side midpoint.*別Slice/s);
assert.match(phase, /bounds-center Origin.*0\.5 \/ 0\.5/s);
assert.match(phase, /現PhaseでHOLD:[\s\S]*Root-first Joint authoring/);
assert.match(phase, /Stage B2 — corner Uniform Scale/);
assert.match(phase, /pointerupはpreviewを終えるだけでHistoryを作らない/);
assert.match(phase, /Stage B3 — Rotate handle/);
assert.match(phase, /±π境界で逆回転へ跳ばず/);
assert.match(phase, /Stage B3 Rotate handleをproduction実画面で操作確認し、受入れた/);
assert.match(phase, /Stage B4 — side midpoint one-axis Scale/);
assert.match(phase, /A: side midpointなし[\s\S]*?B: quiet 4辺中点/);
assert.match(phase, /上 \/ 下は`scaleY`だけ、左 \/ 右は`scaleX`だけ/);
assert.match(phase, /panel表示更新がScale sliderの`onChange`を返し[\s\S]*?silent同期/);
assert.match(phase, /box外drag、Origin \/ Anchor gesture[\s\S]*?接続していない/);
assert.match(phase, /Stage B4 Owner correction — Anchor \/ flip \/ preview quality/);
assert.match(phase, /double click.*runtime content-tight bounds中央/s);
assert.match(phase, /corner \/ side handleがAnchorを越えた時[\s\S]*?符号/);
assert.match(phase, /拡大中だけ`nearest`[\s\S]*?Bake前に必ず元filterへ戻す/);
assert.match(addendum, /Working Addendum。実装契約ではない/);
assert.match(addendum, /Root-first RIG \/ AutoMesh-first \/ TEST POSE.*後続Gate/s);
assert.match(addendum, /長年磨かれた良い文法.*TegakiのFocus Lens/s);
assert.match(revisedAddendum, /Interaction Context/);
assert.match(revisedAddendum, /Instant Animation/);
assert.match(revisedAddendum, /Lazy Lane Disclosure/);
assert.match(revisedAddendum, /Auto Key、baseline生成、Top Bar indicator、Lane materializationは実装しない/);

console.log('verify-phase9o-basic-transform-production: D shell, corner/axis scale, rotate handle and authority isolation OK');
