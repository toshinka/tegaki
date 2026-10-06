/**
 * WP-039 UI verifier. This is intentionally a small controller/static check;
 * native Rive, server lifecycle, Browser geometry and Owner acceptance belong
 * to the integration owner.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editorDir = path.join(HERE, 'advanced', 'rive-editor');
const chainPath = path.join(editorDir, 'chain-controller.js');
const workbenchPath = path.join(editorDir, 'workbench.js');
const htmlPath = path.join(editorDir, 'workbench.html');
const serverPath = path.join(editorDir, 'server.mjs');
const cacheDir = path.join(HERE, '.cache', 'rive-editor', 'wp039', 'ui');
const cachePath = path.join(cacheDir, 'wp039-chain-ui-verification.json');

const chainSource = fs.readFileSync(chainPath, 'utf8');
const workbenchSource = fs.readFileSync(workbenchPath, 'utf8');
const htmlSource = fs.readFileSync(htmlPath, 'utf8');
const serverSource = fs.readFileSync(serverPath, 'utf8');
const checks = [];
function check(name, fn) {
    try { fn(); checks.push({ name, ok: true }); }
    catch (error) { checks.push({ name, ok: false, error: error?.message || String(error) }); }
}
async function checkAsync(name, fn) {
    try { await fn(); checks.push({ name, ok: true }); }
    catch (error) { checks.push({ name, ok: false, error: error?.message || String(error) }); }
}

for (const file of [chainPath, workbenchPath]) {
    check(`syntax:${path.basename(file)}`, () => {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || result.stdout);
    });
}

check('controller-does-not-readback-or-evaluate-image', () => {
    assert.doesNotMatch(chainSource, /getImageData|toDataURL|fetch\s*\(/u);
    assert.doesNotMatch(chainSource, /RiveNativeRuntime|PlaybackController/u);
});
check('workbench-imports-runtime-playback-controller', () => {
    assert.match(workbenchSource, /from ['"]\.\/runtime\.js['"]/u);
    assert.match(workbenchSource, /from ['"]\.\/playback-controller\.js['"]/u);
    assert.match(workbenchSource, /from ['"]\.\/chain-controller\.js['"]/u);
});
check('workbench-compile-uses-one-chain-payload', () => {
    assert.match(workbenchSource, /postJson\(['"]\/api\/compile['"],\s*\{\s*chain:\s*draft\.chain,\s*progress:/u);
    assert.doesNotMatch(workbenchSource, /chain:\s*draft\.chain[\s\S]{0,500}getImageData/u);
});
check('parent-frame-gate-is-present', () => {
    assert.match(workbenchSource, /event\.source !== window\.parent/u);
    assert.match(workbenchSource, /event\.origin !== parentOrigin/u);
    assert.match(workbenchSource, /data\.sessionId !== sessionId/u);
    assert.match(workbenchSource, /chain-draft-active/u);
});
check('explicit-pixel-inspection-only', () => {
    assert.match(workbenchSource, /pixelInspectButton\?\.addEventListener\('click'/u);
    assert.match(workbenchSource, /getImageData\(/u);
    assert.match(workbenchSource, /overlayComposited:\s*false/u);
    assert.doesNotMatch(workbenchSource, /requestAnimationFrame[\s\S]{0,600}getImageData/u);
});
check('workbench-surface-and-diagnostics-wiring', () => {
    for (const token of ['rive-workbench', 'rive-chain-joint-layer', 'rive-chain-warp-layer', 'rive-chain-apply', 'rive-chain-discard', 'rive-chain-pixel-inspect', 'rive-chain-snapshot']) assert.match(htmlSource, new RegExp(token, 'u'));
    assert.match(serverSource, /'\/': \[path\.join\(HERE, 'workbench\.html'\)/u);
    assert.match(serverSource, /'\/workbench\.js': \[path\.join\(HERE, 'workbench\.js'\)/u);
});

const {
    ChainEditorController,
    CHAIN_POINT_COUNT,
    createChainPreset,
    createDefaultChain,
    mapEventToSvgPoint,
    validateChain,
} = await import('../advanced/rive-editor/chain-controller.js');

function fakeInput() {
    const listeners = new Map();
    return {
        value: '', disabled: false, ownerDocument: { activeElement: null },
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type) { listeners.delete(type); },
        dispatch(type) { listeners.get(type)?.({ target: this }); },
    };
}
function fakeButton() {
    const input = fakeInput();
    return input;
}
function controllerHarness(overrides = {}) {
    const inputs = Object.fromEntries(['jointX', 'jointY', 'angle', 'warpX', 'warpY', 'weightA', 'weightB', 'weightMix'].map(key => [key, fakeInput()]));
    let applyCount = 0;
    let discardCount = 0;
    const controller = new ChainEditorController({
        width: 320,
        height: 200,
        inputs,
        applyButton: fakeButton(),
        discardButton: fakeButton(),
        presetButtons: {},
        onApply: async draft => { applyCount += 1; return { ok: true, chain: draft.chain }; },
        onDiscard: () => { discardCount += 1; },
        canBeginDraft: () => true,
        ...overrides,
    });
    controller.attach();
    controller.sync({ snapshot: { status: 'ready', rigMode: 'legacy', image: { width: 320, height: 200 } } });
    return { controller, inputs, get applyCount() { return applyCount; }, get discardCount() { return discardCount; } };
}

check('arm3-and-snake6-local-payloads-are-valid', () => {
    for (const [name, count] of [['arm3', 3], ['snake6', 6]]) {
        const chain = createChainPreset(name, 320, 200);
        assert.equal(validateChain(chain, 320, 200).ok, true);
        assert.equal(chain.joints.length, count + 1);
        assert.equal(chain.angles.length, count);
        assert.equal(chain.warp.length, CHAIN_POINT_COUNT);
        assert.equal(chain.weights.length, CHAIN_POINT_COUNT);
    }
});
check('selection-and-focus-do-not-start-draft', () => {
    const { controller } = controllerHarness();
    controller.selectJoint(1, { focus: true });
    controller.selectPoint(12, { focus: true });
    assert.equal(controller.isDraft(), false);
    assert.equal(controller.getSnapshotFields().selectedJoint, 1);
    assert.equal(controller.getSnapshotFields().selectedPoint, 12);
});
check('raw-five-and-blank-remain-independent', () => {
    const { controller, inputs } = controllerHarness();
    controller.setPreset('arm3');
    controller.selectJoint(1);
    inputs.jointX.value = '5';
    inputs.jointX.dispatch('input');
    assert.equal(controller.getDraft().rawValues['joints.1.x'], '5');
    controller.selectJoint(2);
    inputs.jointY.value = '';
    inputs.jointY.dispatch('input');
    controller.selectPoint(8);
    assert.equal(controller.getDraft().rawValues['joints.2.y'], '');
    assert.equal(controller.getDraft().rawValues['joints.1.x'], '5');
    assert.equal(controller.getDraft().valid, false);
});
await checkAsync('invalid-apply-has-no-compile-callback', async () => {
    const harness = controllerHarness();
    const { controller, inputs } = harness;
    controller.setPreset('arm3');
    controller.selectJoint(1);
    inputs.jointX.value = '';
    inputs.jointX.dispatch('input');
    const result = await controller.apply();
    assert.equal(result.ok, false);
    assert.equal(harness.applyCount, 0);
    assert.equal(controller.getDraft().rawValues['joints.1.x'], '');
});
await checkAsync('discard-does-not-call-apply', async () => {
    const harness = controllerHarness();
    const { controller } = harness;
    controller.setPreset('snake6');
    assert.equal(controller.discard(), true);
    assert.equal(harness.discardCount, 1);
    assert.equal(harness.applyCount, 0);
    assert.equal(controller.isDraft(), false);
});
await checkAsync('valid-apply-calls-once-and-commits', async () => {
    const harness = controllerHarness();
    const { controller } = harness;
    controller.setPreset('arm3');
    const result = await controller.apply();
    assert.equal(result.ok, true);
    assert.equal(harness.applyCount, 1);
    assert.equal(controller.isDraft(), false);
    assert.equal(controller.getConfirmed().angles[1], 45);
});
await checkAsync('dispose-invalidates-delayed-apply', async () => {
    let resolveApply;
    const harness = controllerHarness({ onApply: () => new Promise(resolve => { resolveApply = resolve; }) });
    harness.controller.setPreset('arm3');
    const pending = harness.controller.apply();
    harness.controller.dispose();
    resolveApply({ ok: true, chain: createDefaultChain(320, 200, 3) });
    const result = await pending;
    assert.equal(result.reason, 'stale');
});
check('fallback-preserve-aspect-ratio-letterbox-mapping', () => {
    const svg = {
        getAttribute(name) { return name === 'viewBox' ? '0 0 320 200' : null; },
        getBoundingClientRect() { return { left: 10, top: 20, width: 640, height: 640 }; },
    };
    const point = mapEventToSvgPoint({ clientX: 330, clientY: 440 }, svg);
    assert.ok(Math.abs(point.x - 160) < 0.001);
    assert.ok(Math.abs(point.y - 150) < 0.001);
});

const passed = checks.filter(checkValue => checkValue.ok).length;
const failed = checks.length - passed;
const report = {
    schema: 'tegaki.rive-editor.wp039.chain-ui-verification.v1',
    generatedAt: new Date().toISOString(),
    checks,
    passed,
    failed,
    evidence: {
        syntax: 'PASS',
        controller: failed === 0 ? 'PASS' : 'FAIL',
        browser: 'UNVERIFIED',
        native: 'UNVERIFIED',
        owner: 'UNVERIFIED',
    },
};
fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(cachePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`WP-039 chain UI verifier: ${passed}/${checks.length} PASS`);
if (failed) {
    for (const item of checks.filter(checkValue => !checkValue.ok)) console.error(`FAIL ${item.name}: ${item.error}`);
    process.exitCode = 1;
}
