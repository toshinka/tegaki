/**
 * ROLE: WP-034 Slice A weight/source/editor wiring verifier。
 * AUTHORITY: pure packing, source parsing, draft state machine、static wiring。native/Browser/Owner acceptance は所有しない。
 * INVARIANTS: four fixed vertices、Root/End packed sum=255、draft は Apply まで compile 0。
 * RELATED: advanced/rive-editor/weight-model.mjs、weight-editor.js、model.mjs、editor.js、WP-034。
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_END_WEIGHTS,
    VERTEX_NAMES,
    assertEndWeights,
    byteToEndPercent,
    decodePackedWeight,
    decodeWeightRecords,
    endPercentToByte,
    encodePackedWeight,
    encodeWeightRecords,
    endWeightsToPercentages,
} from '../advanced/rive-editor/weight-model.mjs';
import { WeightEditorController } from '../advanced/rive-editor/weight-editor.js';
import {
    LIMITS,
    createSource,
    makeSnapshot,
    parseSourceMetadata,
} from '../advanced/rive-editor/model.mjs';
import { verifyFixedCache } from '../advanced/rive-editor/dev-companion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const editorRoot = path.join(root, 'tegaki_work', 'advanced', 'rive-editor');
const cacheRoot = path.join(root, 'tegaki_work', '.cache', 'rive-editor');
const checks = [];
const failures = [];

function check(condition, message) {
    checks.push({ message, ok: Boolean(condition) });
    if (!condition) failures.push(message);
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

class FakeElement {
    constructor(value = '') {
        this.value = value;
        this.disabled = false;
        this.dataset = {};
        this.listeners = new Map();
        this.textContent = '';
    }

    addEventListener(type, handler) {
        const list = this.listeners.get(type) || [];
        list.push(handler);
        this.listeners.set(type, list);
    }

    removeEventListener(type, handler) {
        this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry !== handler));
    }

    emit(type, event = {}) {
        for (const handler of this.listeners.get(type) || []) handler({ preventDefault() {}, ...event });
    }
}

async function verifyPacking() {
    check(JSON.stringify(encodeWeightRecords(DEFAULT_END_WEIGHTS).map(({ values, indices }) => ({ values, indices })))
        === JSON.stringify([{ values: 255, indices: 1 }, { values: 255, indices: 2 }, { values: 255, indices: 2 }, { values: 255, indices: 1 }]),
    'default End bytes use one-based Root/End packed records');
    for (const endByte of [0, 1, 64, 128, 254, 255]) {
        const packed = encodePackedWeight(endByte);
        check(decodePackedWeight(packed.values, packed.indices) === endByte, `packed roundtrip ${endByte}`);
    }
    check(endPercentToByte(50) === 128 && byteToEndPercent(128) === 50.2, 'percentage quantizes once and reports actual byte percentage');
    check(JSON.stringify(endWeightsToPercentages([0, 255, 255, 0])) === JSON.stringify([0, 100, 100, 0]), 'default percentages are readable');
    check(JSON.stringify(endWeightsToPercentages(new Uint8Array([128, 64, 255, 0]))) === JSON.stringify([50.2, 25.1, 100, 0]), 'typed byte arrays stay ordinary percentage arrays');
    for (const invalid of [null, '255', [0, 1], [0, 1, 2, 256], [0, 1, 2, Number.NaN]]) {
        let rejected = false;
        try { assertEndWeights(invalid); } catch { rejected = true; }
        check(rejected, `invalid End bytes rejected: ${String(invalid)}`);
    }
    for (const invalid of [-1, 100.1, Number.NaN, Infinity, '50']) {
        let rejected = false;
        try { endPercentToByte(invalid); } catch { rejected = true; }
        check(rejected, `invalid End percentage rejected: ${String(invalid)}`);
    }
    let mixedRejected = false;
    try { decodePackedWeight(255, 513); } catch { mixedRejected = true; }
    check(mixedRejected, 'mixed packed record cannot hide an all-root/all-End profile');
    check(JSON.stringify(decodeWeightRecords(encodeWeightRecords([128, 64, 255, 0]))) === JSON.stringify([128, 64, 255, 0]), 'four fixed records decode in source order');
}

async function verifySource() {
    const profiles = [
        DEFAULT_END_WEIGHTS,
        [0, 0, 0, 0],
        [255, 255, 255, 255],
        [128, 64, 192, 32],
    ];
    for (const meshWeights of profiles) {
        const source = createSource({ width: 320, height: 200, angle: 30, meshWeights });
        const metadata = parseSourceMetadata(source);
        check(JSON.stringify(metadata?.meshWeights) === JSON.stringify(meshWeights), `source roundtrip preserves bytes ${JSON.stringify(meshWeights)}`);
        check((source.match(/<ContourMeshVertex\b/g) || []).length === 4 && (source.match(/<Weight\b/g) || []).length === 4, 'source keeps exactly four weighted vertices');
    }
    const malformed = createSource({ width: 320, height: 200, angle: 30 }).replace('values="255" indices="1"', 'values="254" indices="513"');
    check(parseSourceMetadata(malformed) === null, 'unsupported source weight profile is rejected without defaulting');
    const oldPath = path.join(cacheRoot, 'wp034-saved-backup', 'scene.rml');
    const oldSource = await fs.readFile(oldPath, 'utf8');
    const oldInfo = parseSourceMetadata(oldSource);
    const recreated = createSource({ width: oldInfo.width, height: oldInfo.height, angle: oldInfo.angle, meshWeights: oldInfo.meshWeights });
    check(recreated === oldSource, 'existing valid source bytes remain byte-identical after weight model integration');
    const snapshot = makeSnapshot({ status: 'ready', documentId: 'doc', buildId: 'build', currentSource: recreated, image: { name: 'fixture.png', width: oldInfo.width, height: oldInfo.height }, angle: oldInfo.angle, progress: 0, dirty: true, meshWeights: oldInfo.meshWeights });
    check(JSON.stringify(snapshot.meshWeights) === JSON.stringify(oldInfo.meshWeights) && snapshot.weightEditPhase === 'idle', 'server snapshot exposes confirmed bytes and idle weight phase');
}

async function verifyDraftController() {
    const focusInputs = Object.fromEntries(VERTEX_NAMES.map(name => [name, new FakeElement('0')]));
    let focusDraftEvents = 0;
    let selectedVertex = null;
    const focusOnly = new WeightEditorController({
        inputs: focusInputs,
        onDraftChanged: () => { focusDraftEvents += 1; },
        onSelectionChanged: name => { selectedVertex = name; },
    });
    focusOnly.attach();
    focusInputs.TopLeft.emit('focus');
    check(!focusOnly.isDraft() && focusDraftEvents === 0 && selectedVertex === 'TopLeft', 'focus-only selection does not start a draft or compile');
    focusOnly.dispose();

    const inputs = Object.fromEntries(VERTEX_NAMES.map((name, index) => [name, new FakeElement(String([0, 100, 100, 0][index]))]));
    const outputs = Object.fromEntries(VERTEX_NAMES.map(name => [name, new FakeElement()]));
    const presets = Object.fromEntries(['initial', 'root', 'end', 'even'].map(name => [name, new FakeElement()]));
    const applyButton = new FakeElement();
    const discardButton = new FakeElement();
    const rootNode = new FakeElement();
    let applyCalls = 0;
    const draftEvents = [];
    const controller = new WeightEditorController({
        root: rootNode,
        inputs,
        rootOutputs: outputs,
        presetButtons: presets,
        applyButton,
        discardButton,
        initialWeights: DEFAULT_END_WEIGHTS,
        onDraftChanged: draft => draftEvents.push(draft),
        onApply: async draft => { applyCalls += 1; return { ok: true, snapshot: { meshWeights: draft.endWeights } }; },
    });
    controller.attach();
    inputs.TopLeft.emit('focus');
    inputs.TopLeft.value = '5';
    inputs.TopLeft.emit('input');
    check(inputs.TopLeft.value === '5' && controller.getDraft().endWeights[0] === 13, 'continuous numeric input keeps raw display while tracking quantized byte');
    inputs.TopLeft.value = '';
    inputs.TopLeft.emit('input');
    const invalidBeforeOther = controller.getDraft();
    inputs.TopRight.value = '50';
    inputs.TopRight.emit('input');
    check(invalidBeforeOther.valid === false && inputs.TopLeft.value === '' && controller.getDraft().fieldValidity.TopLeft === false, 'empty field remains invalid after another field changes');
    const invalidApply = await controller.apply();
    check(invalidApply.ok === false && invalidApply.reason === 'draft-invalid' && applyCalls === 0, 'apply validates all four raw fields before callback');
    controller.discard();
    inputs.TopLeft.emit('focus');
    inputs.TopLeft.value = '50';
    inputs.TopLeft.emit('input');
    check(controller.isDraft() && controller.getDraft().endWeights[0] === 128, 'input creates a byte-quantized draft without compile');
    check(applyCalls === 0 && rootNode.dataset.draft === 'true', 'draft input does not call API and exposes draft state');
    await controller.apply();
    check(applyCalls === 1 && !controller.isDraft() && inputs.TopLeft.value === '50.2', 'Apply performs one callback and promotes confirmed actual percentage');
    presets.root.emit('click');
    check(controller.getDraft().endWeights.every(value => value === 0), 'Root-only preset is draft-only');
    controller.discard();
    check(!controller.isDraft() && inputs.TopRight.value === '100', 'Discard restores the confirmed profile without callback');
    inputs.BottomLeft.emit('focus');
    inputs.BottomLeft.value = 'NaN';
    inputs.BottomLeft.emit('input');
    const invalid = await controller.apply();
    check(invalid.ok === false && invalid.reason === 'draft-invalid' && applyCalls === 1, 'invalid draft is rejected before callback');
    controller.discard();
    controller.dispose();
    check(draftEvents.length >= 4, 'draft lifecycle emits observable state snapshots');

    let resolveApply;
    const deferredInputs = Object.fromEntries(VERTEX_NAMES.map((name, index) => [name, new FakeElement(String([0, 100, 100, 0][index]))]));
    const deferred = new WeightEditorController({
        inputs: deferredInputs,
        onApply: draft => new Promise(resolve => { resolveApply = () => resolve({ ok: true, snapshot: { meshWeights: draft.endWeights } }); }),
    });
    deferred.attach();
    deferredInputs.TopLeft.emit('focus');
    deferredInputs.TopLeft.value = '25';
    deferredInputs.TopLeft.emit('input');
    const pendingApply = deferred.apply();
    await Promise.resolve();
    const duplicate = await deferred.apply();
    check(deferred.isPending() && duplicate.ok === false && duplicate.reason === 'apply-pending', 'deferred Apply blocks duplicate commit while pending');
    resolveApply();
    await pendingApply;
    check(!deferred.isPending() && !deferred.isDraft(), 'deferred commit clears pending/draft only after callback success');
    deferred.dispose();
}

async function verifyWiring() {
    const [modelSource, weightModelSource, weightEditorSource, serverSource, editorSource, htmlSource, browserSource] = await Promise.all([
        read('tegaki_work/advanced/rive-editor/model.mjs'),
        read('tegaki_work/advanced/rive-editor/weight-model.mjs'),
        read('tegaki_work/advanced/rive-editor/weight-editor.js'),
        read('tegaki_work/advanced/rive-editor/server.mjs'),
        read('tegaki_work/advanced/rive-editor/editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.html'),
        read('tegaki_work/build/wp034-rive-weights-browser.html'),
    ]);
    check(weightModelSource.includes('DEFAULT_END_WEIGHTS') && weightModelSource.includes('indices: 1 | (2 << 8)'), 'weight model owns fixed bytes and official packed indices');
    check(modelSource.includes("from './weight-model.mjs'") && modelSource.includes('meshWeights') && modelSource.includes('decodeWeightRecords'), 'source model delegates weight parsing and generation to pure model');
    check(serverSource.includes("'/weight-model.mjs'") && serverSource.includes("'/weight-editor.js'"), 'server exposes the two independent Slice A modules');
    check(serverSource.includes("hasOwnProperty.call(body, 'weights')") && serverSource.includes('assertEndWeights(body.weights)') && serverSource.includes('meshWeights: state.meshWeights'), 'compile preserves omitted bytes and validates explicit bytes before CLI');
    check(!serverSource.includes('weights: state.meshWeights') && !serverSource.includes('weights: candidate.sourceInfo.meshWeights'), 'meta.json authority is not extended with a second weight field');
    check(editorSource.includes("import { WeightEditorController } from './weight-editor.js';") && editorSource.includes("postJson('/api/compile'") && editorSource.includes('weight-commit-stale'), 'editor uses independent draft controller and stale commit guard');
    check(editorSource.includes('weightEditPhase') && editorSource.includes('weightDraft') && editorSource.includes('selectedVertex'), 'AI snapshot carries weight draft diagnostics');
    check(editorSource.includes('weightController?.isDraft()') && editorSource.includes('weightController?.isPending()') && editorSource.includes("reason: 'weights-draft'"), 'draft/pending blocks existing operations and marks building reason');
    check(editorSource.includes("sendError(requestId, 'weight-draft-active')") && editorSource.includes('keepWeightPending') && editorSource.includes('acceptedByCallback'), 'frame requests and post-native record phase stay behind the weight pending guard');
    check(editorSource.includes('syncOperationControls') && editorSource.includes('control.disabled = locked'), 'existing operation controls are disabled for draft/pending while weight controls stay local');
    check(weightEditorSource.includes('rawValues') && weightEditorSource.includes('fieldValidity') && weightEditorSource.includes('onSelectionChanged'), 'controller preserves raw fields, all-field validity, and focus selection separately');
    check(htmlSource.includes('四隅の骨への追従') && htmlSource.includes('Endへ追従') && htmlSource.includes('data-testid="rive-weight-apply"') && htmlSource.includes('data-testid="rive-weight-discard"'), 'Japanese weight UI has explicit Apply/Discard controls');
    check(htmlSource.includes('.editor-grid > * { min-width: 0; }') && htmlSource.includes('.weight-grid') && htmlSource.includes('@media (max-width: 620px)'), 'weight UI stays within the narrow editor layout');
    check(browserSource.includes('trusted操作') && browserSource.includes('data-testid="wp034-open"') && browserSource.includes('data-testid="wp034-inspect"'), 'Browser fixture exposes trusted manual weight operations');
    check(!browserSource.includes('dispatchEvent') && !browserSource.includes('PointerEvent') && !browserSource.includes('KeyboardEvent'), 'Browser fixture does not synthesize trusted input evidence');
    check(!weightEditorSource.includes('/api/') && !weightEditorSource.includes('RiveNativeRuntime'), 'weight controller does not own server/native persistence');
}

const fixedCache = await verifyFixedCache();
check(fixedCache.ok, `fixed SDK/cache gate: ${fixedCache.reason || 'unknown'}`);
await verifyPacking();
await verifySource();
await verifyDraftController();
await verifyWiring();

const result = {
    schema: 'tegaki.rive-editor.weights-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    fixedCache,
    native: 'UNVERIFIED — this verifier is pure/static and does not spawn 18729',
    browser: 'UNVERIFIED — wp034-rive-weights-browser.html requires trusted manual interaction',
};
await fs.mkdir(cacheRoot, { recursive: true });
await fs.writeFile(path.join(cacheRoot, 'wp034-rive-weights-verification.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
    console.error(`verify-rive-editor-weights: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-editor-weights: PASS (checks=${checks.length}; native=UNVERIFIED; browser=UNVERIFIED; cache=${fixedCache.reason || 'unknown'})`);
}

