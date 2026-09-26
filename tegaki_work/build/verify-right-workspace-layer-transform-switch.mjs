/**
 * Primary Layer / Transform / Rig segmented switch contract.
 *
 * The switch is presentation-only: Transform's existing show class and V
 * lifecycle remain authoritative, while pending edits are routed to the
 * existing confirm/cancel terminal instead of being committed implicitly.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frameSource = readFileSync(new URL('../ui/right-workspace-frame.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8');
const mainStyleSource = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const domSource = readFileSync(new URL('../ui/dom-builder.js', import.meta.url), 'utf8');
const transformSource = readFileSync(new URL('../system/layer-transform.js', import.meta.url), 'utf8');
const transformStyleSource = readFileSync(new URL('../styles/components/layer-transform-basic.css', import.meta.url), 'utf8');

assert.match(frameSource, /_mountModeSwitch\(\)/,
    'Right Workspace mounts one shared mode switch');
assert.match(frameSource, /querySelector\(':scope > \.right-workspace-mode-switch'\)/,
    'mount reuses an existing direct child instead of duplicating the switch');
assert.match(frameSource, /textContent = 'LAYER'/);
assert.match(frameSource, /textContent = 'TRANSFORM'/);
assert.match(frameSource, /textContent = 'RIG'/);
assert.match(frameSource, /_rigModeClickHandler = \(\) => this\._requestWorkspaceMode\('rig'\)/,
    'the third top-level segment enters the existing RIG lens');
assert.match(frameSource, /setAttribute\('role', 'group'\)/,
    'segmented switch exposes a grouped button contract');

assert.match(frameSource, /this\.panel\?\.classList\.contains\('show'\) === true/,
    'existing Transform panel visibility is the projected state authority');
assert.match(frameSource, /toggleLayerTransform\?\.\('right-workspace-segment'\)/,
    'segment actions delegate to the existing V lifecycle');
assert.match(frameSource, /commitState\?\.hasPendingTransform === true/,
    'existing commit projection guards pending Layer return');
assert.match(frameSource, /keyButton && !keyButton\.disabled \? keyButton : this\.endButton/,
    'pending Layer return focuses the existing KEY or SOURCE terminal');
assert.match(frameSource, /_syncTransformActions\(layerEditing\)/,
    'terminal labels follow the active Transform edit context');
assert.match(frameSource, /isTransformTimelineKeyTarget\(target\)/,
    'the terminal distinguishes SOURCE from Animation KEY ownership');
assert.match(frameSource, /this\.endButton\.hidden = !layerEditing \|\| animate/,
    'ANIMATE never gets a duplicate confirm button');
assert.match(transformSource, /this\.onCommitTimelineKey\?\.\(\)/,
    'ANIMATE KEY remains on its existing commit handler');
assert.match(frameSource, /SOURCE変形をRasterへ確定/);
assert.match(frameSource, /resetButton\?\.setAttribute\('aria-label', '変形をリセット'\)/,
    'reset feedback does not infer dirty state from an unreliable shared projection');
assert.match(frameSource, /this\.actions\?\.append\(this\.endButton, this\.cancelButton\)/,
    'V and Escape actions live in the Transform header');
assert.doesNotMatch(styleSource, /right-workspace-terminal/,
    'the large lower terminal is removed');
assert.match(domSource, /createElement\('button',\s*\{\s*className: 'flip-button flip-button--icon',[\s\S]*?id: 'layer-transform-reset-btn',[\s\S]*?'aria-label': '変形をリセット'/);
assert.doesNotMatch(transformStyleSource, /#layer-transform-reset-btn\.is-transform-pending/,
    'no dirty color is presented without a reliable resettable pending state');
assert.doesNotMatch(frameSource, /panel\?\.classList\.(?:add|remove|toggle)\('show'/,
    'the segmented switch never writes Transform visibility state');

assert.match(frameSource, /\[this\.layerModeButton, !active\][\s\S]*?\[this\.transformModeButton, surface === 'transform'\][\s\S]*?\[this\.rigModeButton, rigLensVisible\]/,
    'one active top-level segment follows the projected Layer, Transform or RIG surface');
assert.match(frameSource, /transformModeButton\.disabled = false[\s\S]*?rigModeButton\.disabled = !rigLensVisible && rigTarget\?\.eligible !== true/,
    'RIG ownership never disables the top-level Transform navigation');
assert.match(frameSource, /transformGateNotice\.textContent = transformGateVisible[\s\S]*?transformBlockMessage/,
    'unsafe Transform targets display the existing R-38 reason inside the lens');

const switchStyle = styleSource.match(
    /\/\* Primary Layer \/ Transform \/ Rig navigation\.[\s\S]*?@media \(pointer: coarse\) \{[\s\S]*?\n\}/u
)?.[0] || '';
assert.ok(switchStyle, 'primary segmented switch owns a scoped component style block');
assert.match(switchStyle, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
    'the three lenses share one navigation hierarchy');
assert.match(switchStyle, /width: min\(210px, 100%\)/,
    'compact switch width stays inside the existing content column');
assert.match(switchStyle, /min-height: 32px/);
assert.match(switchStyle, /min-height: 26px/);
assert.match(switchStyle, /font-size: 9px/);
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

const railStyle = styleSource.match(
    /\.right-workspace-frame > \.layer-panel-container > \.layer-controls-row \{[\s\S]*?\n\}/u
)?.[0] || '';
assert.ok(railStyle, 'right action rail keeps a scoped geometry owner');
assert.match(railStyle, /position: fixed/,
    'right action rail is positioned against the viewport, not the Dock-bound Layer container');
assert.match(railStyle, /inset-inline-end: var\(--ui-right-workspace-inset\)/,
    'right action rail keeps the shared viewport inset');
assert.match(railStyle, /max-block-size: calc\(100dvh - 96px\)/,
    'small viewports retain a rail-local vertical reachability fallback');
assert.match(railStyle, /overflow-x: hidden/,
    'rail-local vertical fallback cannot create a horizontal scrollbar');
assert.match(railStyle, /overflow-y: auto/,
    'short viewports may still scroll the rail without moving it');

assert.match(mainStyleSource, /--ui-dock-rail-clearance: 2px/,
    'Dock edge clearance has one shared layout token');
assert.match(mainStyleSource,
    /--ui-bottom-dock-left: calc\(var\(--ui-rail-inline-inset\) \+ var\(--ui-rail-width\) \+ var\(--ui-dock-rail-clearance\)\)/,
    'Dock left edge derives clearance from the left rail geometry');
assert.match(mainStyleSource,
    /--ui-bottom-dock-right: calc\(var\(--ui-right-workspace-inset\) \+ var\(--ui-layer-panel-rail-column\) \+ var\(--ui-dock-rail-clearance\)\)/,
    'Drawing Dock right edge derives the same clearance from the right rail geometry');
assert.match(mainStyleSource,
    /:root\.animation-table-bottom-dock-active\.right-workspace-transform-active[\s\S]*?--ui-bottom-dock-right: var\(--ui-canvas-right\)/u,
    'Transform keeps its existing context-adaptive Dock geometry');

globalThis.window = globalThis.window || {};
const { RightWorkspaceFrame } = await import('../ui/right-workspace-frame.js');
const navigationFrame = (rigActive, canStart) => {
    const calls = [];
    const instance = Object.create(RightWorkspaceFrame.prototype);
    instance.rigLensActive = rigActive;
    instance.transformLensRequested = false;
    instance.panel = { classList: { contains: () => false } };
    instance.layerSystem = { canStartTransformEditSession: () => canStart };
    instance.sync = () => calls.push('sync');
    instance._enterRigLens = () => calls.push('enter-rig');
    instance._exitRigToLayer = options => calls.push(options?.showTransformGate ? 'rig-to-gate' : 'rig-to-layer');
    instance._returnToTransform = () => calls.push('rig-to-transform');
    window.KeyboardHandler = { toggleLayerTransform: () => calls.push('enter-transform') };
    return { instance, calls };
};
const fromLayer = navigationFrame(false, true);
fromLayer.instance._requestWorkspaceMode('rig');
assert.deepEqual(fromLayer.calls, ['enter-rig'], 'RIG tab delegates once to the existing entry');
const activeRig = navigationFrame(true, true);
activeRig.instance._requestWorkspaceMode('rig');
activeRig.instance._requestWorkspaceMode('transform');
assert.deepEqual(activeRig.calls, ['rig-to-transform'], 'reselecting RIG cannot double-enter');
const blockedRig = navigationFrame(true, false);
blockedRig.instance._requestWorkspaceMode('transform');
assert.deepEqual(blockedRig.calls, ['rig-to-gate'], 'unsafe target enters the Transform lens without a V session');
const blockedTransform = navigationFrame(false, false);
blockedTransform.instance._requestWorkspaceMode('transform');
assert.deepEqual(blockedTransform.calls, ['sync'], 'R-38 guard prevents starting unsafe Transform');
assert.equal(blockedTransform.instance.transformLensRequested, true);
blockedTransform.instance._requestWorkspaceMode('layer');
assert.equal(blockedTransform.instance.transformLensRequested, false);
assert.deepEqual(blockedTransform.calls, ['sync', 'sync'], 'the view-only Transform lens returns to Layer');
const allowedTransform = navigationFrame(false, true);
allowedTransform.instance._requestWorkspaceMode('transform');
assert.deepEqual(allowedTransform.calls, ['enter-transform', 'sync'],
    'valid targets continue through the existing V entry exactly once');

const rigEntryCase = ({ hasMesh = false, parts = [], bones = [], layerCount = 2 } = {}) => {
    const instance = Object.create(RightWorkspaceFrame.prototype);
    instance.getTarget = () => ({ rigTarget: {
        eligible: true, assetId: 'asset', internalLayerId: 'raster', hasMesh
    } });
    instance.panel = { classList: { contains: () => false } };
    instance.layerSystem = { transform: {
        isVKeyPressed: false, getTransformMode: () => 'basic'
    } };
    instance.rigEntryMessageNode = { textContent: '', hidden: true };
    instance.rigStructureCreatedBoneIds = new Set();
    instance.rigTreeCollapsedBoneIds = new Set();
    instance._getRigLensTable = () => ({ getRigLensPartTarget: () => ({
        layers: Array.from({ length: layerCount }),
        asset: { rigDefinition: { parts, bones } }
    }) });
    instance._resolveRigLensInitialMotionEntry = () => ({ ok: false });
    instance.sync = () => {};
    instance.transformLensRequested = true;
    instance.rigAuthoringKind = 'wrong';
    assert.equal(instance._enterRigLens(), true);
    assert.equal(instance.transformLensRequested, false);
    return instance.rigAuthoringKind;
};
assert.equal(rigEntryCase({ parts: [{ partId: 'raster' }], bones: [{ boneId: 'root' }] }), 'part',
    'existing PART ownership wins over generic Bone presence on re-entry');
assert.equal(rigEntryCase({ hasMesh: true, parts: [{ partId: 'raster' }] }), 'deform',
    'an existing target Mesh restores DEFORM');
assert.equal(rigEntryCase({ bones: [{ boneId: 'root' }] }), 'deform',
    'an unbound DEFORM Bone structure restores DEFORM');
assert.equal(rigEntryCase(), 'part', 'a new multi-Raster CAF keeps PART as its initial candidate');

console.log('verify-right-workspace-layer-transform-switch: three lenses, V/RIG authority, guarded navigation, Dock clearance and pointer ownership OK');
