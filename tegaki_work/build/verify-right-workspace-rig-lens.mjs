import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.dirname(buildRoot);
const read = relative => fs.readFileSync(path.join(workRoot, relative), 'utf8');

const frame = read('ui/right-workspace-frame.js');
const renderer = read('ui/layer-panel-renderer.js');
const keyboard = read('ui/keyboard-handler.js');
const surface = read('styles/components/layer-panel-surface.css');

assert.match(frame, /rigLensActive = false/u, 'RIG lens starts as runtime-only inactive view');
assert.match(frame, /this\.root\.classList\.toggle\('has-transform-workspace', active\)/u,
    'LAYER / TRANSFORM switch follows the single workspace projection');
assert.match(frame, /this\.root\.classList\.toggle\('is-rig-lens-active', rigLensVisible\)/u,
    'RIG lens is projected separately from Transform edit state');
assert.match(frame, /this\.panel\.hidden = rigLensVisible/u,
    'RIG lens hides the regular Transform inspector');
assert.match(frame, /this\.drawing\.inert = active/u,
    'the existing Layer UI is inert while either Transform or RIG view is active');
assert.match(frame, /hasPendingTransform === true[\s\S]*?return false/u,
    'pending Transform/KEY changes reject RIG entry');
assert.match(frame, /transformSessionActive === true[\s\S]*?return false/u,
    'active selection Transform rejects RIG entry');
assert.match(frame, /preserveMotionWindow: true/u,
    'return to Transform preserves an open Animation Dock');
assert.match(frame, /this\.rigLensTarget = \{[\s\S]*?assetId: target\.assetId[\s\S]*?internalLayerId: target\.internalLayerId/u,
    'entry retains only the CAF Asset and internal Raster identity for this view handoff');
assert.match(frame, /Root／Boneの編集操作は/u,
    'the RIG skeleton does not claim Root/Bone editing is implemented');
assert.doesNotMatch(frame, /registerClipAsset|generateClipAsset|recordInternalLayerHistory|setClipRig/u,
    'RIG lens presentation does not mutate RIG data or History');
assert.match(renderer, /targetLayer\?\.type === 'raster'[\s\S]*?targetLayer\.parentLayerId == null/u,
    'RIG eligibility is based on the selected CAF root Raster');
assert.match(renderer, /assetId: cafContext\.asset\.id[\s\S]*?internalLayerId: targetLayer\?\.id/u,
    'RIG target comes from existing CAF and internal Layer identity');
assert.match(renderer, /CAF内のRasterを選択してからRIGを編集してください/u,
    'invalid target has user-visible refusal context');
assert.match(keyboard, /if \(options\.preserveMotionWindow !== true\)[\s\S]*?setMotionWindowOpen\?\.\(false\)/u,
    'the existing Transform entry keeps its default Dock behavior and has an explicit preserve option');
assert.match(surface, /layer-transform-panel\.is-context-inspector\[hidden\][\s\S]*?display: none !important/u,
    'the old Transform panel cannot paint through its forced display rule under the RIG lens');
assert.match(surface, /right-workspace-rig-lens[\s\S]*?background: transparent/u,
    'RIG view uses the existing transparent Workspace surface');

console.log('PASS: Right Workspace RIG lens projection, target guard, no-mutation shell, and Dock-preserving return contracts');
