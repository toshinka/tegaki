import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

const core = read('core-engine.js');
const layerSystem = read('system/layer-system.js');
const layerTransform = read('system/layer-transform.js');
const keyboard = read('ui/keyboard-handler.js');
const popup = read('ui/animation-table-popup.js');
const domBuilder = read('ui/dom-builder.js');
const css = read('styles/main.css');

assert.ok(
    core.indexOf('this.popupManager.initializeAll();')
        < core.indexOf('animationTable?.createLayerTransformEditAdapter?.()'),
    'adapter must be injected only after popup initialization'
);
assert.match(core, /this\.layerSystem\.setTransformEditAdapter\([\s\S]*?createLayerTransformEditAdapter/);

assert.match(layerSystem, /setTransformEditAdapter\(adapter = null\)/);
assert.match(layerSystem, /canStartTransformEditSession\(\)/);
assert.match(layerSystem, /getActiveTransformEditTarget\(\)/);
assert.match(layerSystem, /this\._transformEditAdapter\?\.begin\?\.\(/);
assert.match(layerSystem, /targetLayerIds = new Set\(adapterStart\.targetLayerIds \|\| \[\]\)/);
assert.match(layerSystem, /unionRasterBounds\(previewLayers\.map\(layer => this\._getRasterTransformSourceBounds\(layer\)\)\)/);
assert.match(layerSystem, /_applyClipTransformKeyPreview\(transform\)/);
assert.match(layerSystem, /_handleLayerDrag\([\s\S]*?isTransformTimelineKeyTarget[\s\S]*?_applyClipTransformKeyPreview\(transform\)/);
assert.match(layerSystem, /if \(!isClipKey && historyManager && !historyManager\.isApplying\)/);
assert.match(layerSystem, /window\.addEventListener\('blur',[\s\S]*?isTransformTimelineKeyTarget[\s\S]*?return;/);
assert.match(layerSystem, /this\._transformEditAdapter\?\.preview\?\.\([\s\S]*?layerStart: session\.transform/);
assert.match(layerSystem, /if \(isClipKey\) \{[\s\S]*?_restoreTransformTargetState[\s\S]*?this\._transformEditAdapter\?\.finish/);
assert.match(layerSystem, /\} else \{[\s\S]*?transformConfirmed = this\.confirmLayerTransform\(\) === true;/);
assert.match(layerSystem, /target: transformTarget/);
assert.match(keyboard, /layerManager\?\.canStartTransformEditSession\?\.\(\) !== false/);
assert.match(keyboard, /window\.addEventListener\('blur',[\s\S]*?isTransformTimelineKeyTarget\(layerManager\?\.getActiveTransformEditTarget\?\.\(\)\)[\s\S]*?return;/);

const bridgeStart = popup.indexOf('createLayerTransformEditAdapter()');
const bridgeEnd = popup.indexOf('updateClipDeformerFromExternal(', bridgeStart);
assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart);
const bridge = popup.slice(bridgeStart, bridgeEnd);
assert.match(bridge, /planTransformEditTransactionStart/);
assert.match(bridge, /planTransformEditTransactionPreview/);
assert.match(bridge, /planTransformEditTransactionFinish/);
assert.match(bridge, /this\._captureTimelineHistoryState\(\)/);
assert.match(bridge, /entry\.clip\.transformKeyframes = structuredClone\(plan\.keyframes\)/);
assert.match(bridge, /entry\.clip\.layerTransformTracks = structuredClone\(plan\.tracks \|\| \[\]\)/);
assert.match(bridge, /caf-clip-transform-layer-bridge/);
assert.match(bridge, /_restoreLayerTransformBridgePreview\(session/);
assert.match(bridge, /transaction\.baselineKeyframes/);
assert.doesNotMatch(bridge, /_restoreTimelineHistoryState\(session\.beforeState\)/);
assert.doesNotMatch(bridge, /confirmLayerTransform|bakeTransform|_saveSelectedClipFromWorkingLayers|_captureDrawingLayerToSelectedClip/);

assert.match(popup, /isTransformTimelineKeyTarget\(target\)[\s\S]*?_exitTransformEditPreviewMode/);
assert.match(popup, /_transformPreviewAuthority === TRANSFORM_EDIT_AUTHORITY\.CLIP_TRANSFORM_KEY[\s\S]*?return;/);
assert.match(popup, /e\.key === 'Escape' && this\.isVisible[\s\S]*?this\.isTransformPreviewSuspended\) return;/);
assert.match(popup, /animation:frame-changed'[\s\S]*?_transformPreviewAuthority === TRANSFORM_EDIT_AUTHORITY\.CLIP_TRANSFORM_KEY[\s\S]*?exitLayerMoveMode\?\.\(\{ cancelled: true \}\)/);
assert.match(popup, /hide\(\)[\s\S]*?_transformPreviewAuthority === TRANSFORM_EDIT_AUTHORITY\.CLIP_TRANSFORM_KEY[\s\S]*?exitLayerMoveMode\?\.\(\{ cancelled: true \}\)/);
assert.match(popup, /const hasLayerMotionKey = isSelected && isInside[\s\S]*?layerMotionTrack/);
assert.match(popup, /const isProvisionalLayerMotionKey = hasLayerMotionKey[\s\S]*?previewSession\.changed === true/);
assert.match(popup, /class="anim-caf-motion-key-projection\$\{isProvisionalLayerMotionKey[\s\S]*?data-layer-motion-key-frame/);
assert.match(popup, /const timelineGridContainer = this\.panel\.querySelector\('\.anim-timeline-grid-container'\)[\s\S]*?this\.model\.setCurrentFrame\(frameIndex\)/);
assert.match(popup, /createBlankClip: action\.type === 'frame-step-create'/);
assert.match(keyboard, /e\.key === 'Escape' && vKeyPressed[\s\S]*?cancelled: true/);
assert.match(layerTransform, /_canEditTransformAnchor\(\)/);
assert.match(layerTransform, /allowAnchorEdit !== false/);
assert.match(layerTransform, /if \(!this\._canEditTransformAnchor\(\)\) return false;/);
assert.match(domBuilder, /textContent: 'SOURCE · 原画'/);
assert.match(css, /\.layer-transform-context-note\[data-context-state="ready"\]/);
assert.match(css, /\.layer-transform-context-note\[data-context-state="keyed"\]/);
assert.match(css, /#layer-transform-anchor-btn\.is-context-disabled/);
assert.match(css, /\.anim-caf-motion-key-projection\s*\{[\s\S]*?background: var\(--futaba-maroon\)/);
assert.match(css, /\.anim-caf-motion-key-projection\s*\{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(css, /\.anim-caf-motion-key-projection\.is-provisional\s*\{[\s\S]*?var\(--futaba-maroon\) 38%/);
assert.match(css, /\.anim-rig-folder-cell-slot\.is-outside-clip[\s\S]*?border-right: 0;[\s\S]*?background: var\(--futaba-background\)/);
assert.match(css, /\.anim-rig-folder-cell-slot\.is-clip-range[\s\S]*?border-right-color: color-mix/);
assert.match(css, /\.anim-rig-folder-timeline-row\.is-selected[\s\S]*?\.anim-rig-folder-cell-slot\.is-clip-range[\s\S]*?var\(--futaba-light-medium\) 26%/);
assert.match(popup, /\.anim-timeline-grid\s*\{[\s\S]*?background-image: none;/);

console.log('Phase 9p production Transform bridge verifier passed.');
