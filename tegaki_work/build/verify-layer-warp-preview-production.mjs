import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const workDir = path.resolve(buildDir, '..');
const read = relative => fs.readFileSync(path.join(workDir, relative), 'utf8');

const popup = read('ui/animation-table-popup.js');
const layerSystem = read('system/layer-system.js');
const task = read('../task-codex/phase9q.md');

const previewStart = popup.indexOf('    _renderInternalLayerPreviewGroup(container,');
const previewEnd = popup.indexOf('    _createInternalClippedSnapshot(asset,', previewStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart);
const preview = popup.slice(previewStart, previewEnd);
assert.match(preview, /layerEffectByLayerId\?\.get\(internalLayer\.id\)/);
assert.match(preview, /_createDeformerPreviewNode\([\s\S]*?layerEffect\.sampledDeformer/);
assert.match(preview, /const matrix = layerEffect\.layerMotionMatrix/);
assert.ok(
    preview.indexOf('layerEffect.sampledDeformer') < preview.indexOf('const matrix = layerEffect.layerMotionMatrix'),
    'Pixi preview must bake Layer WARP before applying Layer Motion'
);
assert.match(preview, /previewNode\.alpha = opacity \* focusAlpha/);
assert.match(preview, /previewNode\.blendMode = internalLayer\.blendMode \|\| 'normal'/);
assert.match(preview, /_createFolderEffectPreviewChildPlan/);
assert.match(preview, /calculateFolderEffectAssetBounds\([\s\S]*?childEffectPlan/);
assert.match(preview, /layerEffects = \(renderPlan\?\.layerEffects \|\| \[\]\)\.filter/);
assert.match(preview, /island\?\.targetKind === 'layer-motion'/);

const adapterStart = popup.indexOf('createLayerTransformEditAdapter()');
const adapterEnd = popup.indexOf('updateClipDeformerFromExternal(', adapterStart);
assert.ok(adapterStart >= 0 && adapterEnd > adapterStart);
const adapter = popup.slice(adapterStart, adapterEnd);
assert.match(adapter, /canStartWarp: request => this\._projectLayerWarpBridgeStart/);
assert.match(adapter, /beginWarp: request => this\._beginLayerWarpBridge/);
assert.match(adapter, /previewWarp: request => this\._previewLayerWarpBridge/);
assert.match(adapter, /finishWarp: request => this\._finishLayerWarpBridge/);
assert.match(adapter, /planLayerWarpEditTransactionStart/);
assert.match(adapter, /planLayerWarpEditTransactionPreview/);
assert.match(adapter, /planLayerWarpEditTransactionFinish/);
assert.match(adapter, /setClipLayerDeformer\(/);
assert.match(adapter, /baselineLayerDeformers/);
assert.match(adapter, /caf-layer-warp-transform-bridge/);
assert.match(adapter, /this\._captureTimelineHistoryState\(\)/);
assert.match(adapter, /_restoreLayerWarpBridgePreview/);
assert.doesNotMatch(adapter, /confirmLayerTransform|bakeTransform|DrawingSnapshot/);

assert.match(layerSystem, /canStartLayerWarpEditSession\(\)/);
assert.match(layerSystem, /beginLayerWarpEditSession\(\)/);
assert.match(layerSystem, /previewLayerWarpEditSession\(points\)/);
assert.match(layerSystem, /finishLayerWarpEditSession\(options = \{\}\)/);
assert.match(layerSystem, /this\._transformEditAdapter\.beginWarp/);
assert.match(layerSystem, /this\._transformEditAdapter\.previewWarp/);
assert.match(layerSystem, /this\._transformEditAdapter\.finishWarp/);
assert.match(popup, /hide\(\)[\s\S]*?getLayerWarpEditSession[\s\S]*?cancelled: true/);
assert.match(popup, /animation:frame-changed'[\s\S]*?getLayerWarpEditSession[\s\S]*?cancelled: true/);

assert.match(task, /Task D/);

console.log('Layer WARP Pixi preview / transaction production verifier passed.');
