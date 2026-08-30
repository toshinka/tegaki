import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, css, table, phase] = await Promise.all([
    readFile(new URL('../ui/layer-panel-renderer.js', import.meta.url), 'utf8'),
    readFile(new URL('../styles/components/layer-panel-surface.css', import.meta.url), 'utf8'),
    readFile(new URL('../ui/animation-table-popup.js', import.meta.url), 'utf8'),
    readFile(new URL('../../task-codex/phase9n.md', import.meta.url), 'utf8')
]);

assert.match(
    renderer,
    /const canRegisterTarget = !!targetLayer[\s\S]*?isEligibleTarget[\s\S]*?projection\?\.status === 'none'/u,
    'the Setup action is limited to an eligible RIG-none target'
);
assert.match(
    renderer,
    /if \(canRegisterTarget\) \{[\s\S]*?inspector\.appendChild\(result\);[\s\S]*?context-rig-inspector-description/u,
    'the interactive Setup action stays above descriptive copy at narrow Table overlap'
);
for (const token of [
    'context-rig-register-button',
    "setupButton.type = 'button'",
    "setupButton.textContent = isFolderTarget ? '親子RIGを開始' : '全体PIVOTを開始'",
    '曲げRIGは現在のAnimation Table > RIG設定',
    "result.setAttribute('role', 'status')",
    "result.setAttribute('aria-live', 'polite')",
    "{ source: 'right-rig-inspector' }",
    '_getRigPartRegistrationFailureLabel(result?.reason)'
]) {
    assert.ok(renderer.includes(token), `right RIG Setup action must include ${token}`);
}
assert.match(
    renderer,
    /_registerContextRigTarget\(button\)[\s\S]*?registerInternalRigPartFromExternal\?\.\([\s\S]*?context\.asset\.id,[\s\S]*?context\.targetLayer\.id/u,
    'the right Panel delegates mutation to the existing Animation Table adapter'
);
assert.doesNotMatch(
    renderer.match(/_registerContextRigTarget\(button\)[\s\S]*?\n    \}/u)?.[0] || '',
    /rigDefinition|\.parts\.(?:push|splice)|_recordInternalLayerHistory/u,
    'the right Panel does not mutate Rig or History authority directly'
);

for (const token of [
    '.right-panel .context-rig-register-button',
    'border: none',
    'color: var(--deformer-bind-point)',
    'background: color-mix(in srgb, var(--deformer-bind-line) 18%, var(--futaba-cream))',
    '.right-panel .context-rig-register-button:focus-visible',
    'min-height: 38px'
]) {
    assert.ok(css.includes(token), `Setup blue action CSS must include ${token}`);
}

assert.match(
    table,
    /registerInternalRigPartFromExternal\(assetId, layerId, options = \{\}\)[\s\S]*?_captureInternalLayerHistoryState[\s\S]*?registerClipAssetRigPart[\s\S]*?if \(result\.changed && options\.recordHistory !== false\)[\s\S]*?'caf-rig-part-register'/u,
    'the reused adapter keeps success, no-op and one-entry History semantics'
);
for (const token of [
    'Stage C1 — RIG対象登録',
    'RIG未設定',
    'registerInternalRigPartFromExternal(assetId, layerId)',
    'ROOT BONE、全体PIVOT、Mesh BONE'
]) {
    assert.ok(phase.includes(token), `Phase 9n Stage C1 boundary must include ${token}`);
}

console.log('verify-right-rig-setup-action: RIG-none only / existing adapter / Setup blue / no direct model mutation OK');
