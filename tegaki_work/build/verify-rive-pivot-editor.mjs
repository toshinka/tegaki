/**
 * ROLE: WP-038 pivot-editor pure controller/static wiring verifier。
 * AUTHORITY: local pivot draft and editor wiring only。native/Browser/Owner acceptanceは所有しない。
 * INVARIANTS: mode/focus are runtime-only, raw X/Y remain untouched, Apply delegates once, SVG marker is overlay-only。
 * RELATED: advanced/rive-editor/pivot-editor.js、editor.js、editor.html、weight-editor.js、WP-038。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PivotEditorController } from '../advanced/rive-editor/pivot-editor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cacheRoot = path.join(root, 'tegaki_work', '.cache', 'rive-editor', 'wp038', 'ui');
const checks = [];
const failures = [];

function check(condition, message) {
    checks.push({ ok: Boolean(condition), message });
    if (!condition) failures.push(message);
}

class FakeNode {
    constructor(value = '') {
        this.value = value;
        this.disabled = false;
        this.hidden = false;
        this.dataset = {};
        this.attributes = new Map([['viewBox', '0 0 320 200']]);
        this.listeners = new Map();
        this.children = [];
        this.textContent = '';
        this.style = {};
        this.screenCTM = null;
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
        for (const handler of [...(this.listeners.get(type) || [])]) {
            handler({ preventDefault() {}, target: this, ...event });
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'hidden') this.hidden = true;
    }

    getAttribute(name) { return this.attributes.get(name) || null; }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'hidden') this.hidden = false;
    }

    getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 200 }; }

    getScreenCTM() { return this.screenCTM; }

    createSVGPoint() {
        const point = {
            x: 0,
            y: 0,
            matrixTransform: matrix => ({
                x: point.x * matrix.a + point.y * matrix.c + matrix.e,
                y: point.x * matrix.b + point.y * matrix.d + matrix.f,
            }),
        };
        return point;
    }
}

function makeFixture() {
    const fixture = {
        root: new FakeNode(),
        svg: new FakeNode(),
        layer: new FakeNode(),
        surface: new FakeNode(),
        marker: new FakeNode(),
        markerLabel: new FakeNode(),
        xInput: new FakeNode(),
        yInput: new FakeNode(),
        modeButton: new FakeNode(),
        centerButton: new FakeNode(),
        applyButton: new FakeNode(),
        discardButton: new FakeNode(),
        statusNode: new FakeNode(),
    };
    fixture.svg.setAttribute('viewBox', '-20 -20 360 240');
    return fixture;
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function verifyController() {
    const fixture = makeFixture();
    let allowDraft = true;
    let applyCalls = 0;
    let discardCalls = 0;
    const draftEvents = [];
    const controller = new PivotEditorController({
        ...fixture,
        onDraftChanged: draft => draftEvents.push(draft),
        onApply: async draft => {
            applyCalls += 1;
            return { ok: true, snapshot: { pivot: draft.value } };
        },
        onDiscard: () => { discardCalls += 1; },
        canBeginDraft: () => allowDraft,
    });
    controller.attach();
    controller.sync({
        imageUrl: 'http://127.0.0.1:18729/image/current.png?build=one',
        snapshot: { status: 'ready', image: { width: 320, height: 200 }, pivot: { x: 160, y: 100 } },
    });
    check(controller.getView().pivot.x === 160 && controller.getView().pivot.y === 100, 'controller loads the confirmed source pivot and dimensions');
    check(fixture.layer.getAttribute('hidden') === null && fixture.marker.getAttribute('hidden') === null
        && fixture.markerLabel.getAttribute('hidden') === null && fixture.layer.hidden === false,
    'ready SVG layer removes the initial hidden attribute so marker and placement surface are visible');
    check(fixture.surface.getAttribute('pointer-events') === 'none', 'placement surface is pointer-inert while mode is OFF');

    fixture.xInput.emit('focus');
    check(!controller.isDraft() && controller.getView().pivotEditPhase === 'idle', 'focus alone does not start a pivot draft');
    fixture.modeButton.emit('click');
    check(controller.getView().placementMode === true && !controller.isDraft()
        && fixture.surface.getAttribute('pointer-events') === 'all',
    'placement mode selection is runtime-only, enables the surface, and does not start a draft');
    fixture.surface.emit('click', { clientX: 60, clientY: 58.333333 });
    check(controller.isDraft() && controller.getDraft().rawValues.x === '40' && controller.getDraft().rawValues.y === '50', 'placement click creates a local draft in source pixel coordinates');
    check(applyCalls === 0 && controller.getView().pivot.x === 160, 'placement draft leaves confirmed pivot and compile count unchanged');

    fixture.xInput.value = '5';
    fixture.xInput.emit('input');
    fixture.yInput.emit('focus');
    fixture.yInput.value = '';
    fixture.yInput.emit('input');
    check(controller.getDraft().rawValues.x === '5' && controller.getDraft().rawValues.y === ''
        && controller.getDraft().fieldValidity.x === true && controller.getDraft().fieldValidity.y === false,
    'raw 5 and blank Y survive another axis focus/input without repair');
    const invalidApply = await controller.apply();
    check(invalidApply.reason === 'draft-invalid' && applyCalls === 0, 'invalid raw draft is rejected before the Apply callback');
    const discarded = controller.discard();
    check(discarded.ok && discardCalls === 1 && !controller.isDraft() && applyCalls === 0, 'Discard clears local draft without compile');

    allowDraft = false;
    fixture.modeButton.emit('click');
    check(controller.getView().placementMode === false, 'placement mode cannot begin while another draft owner blocks the editor');
    fixture.xInput.value = '12';
    fixture.xInput.emit('input');
    check(!controller.isDraft() && applyCalls === 0, 'weight/bone draft ownership gate rejects pivot input');

    allowDraft = true;
    fixture.xInput.emit('focus');
    fixture.xInput.value = '12.3456';
    fixture.xInput.emit('input');
    fixture.yInput.value = '67';
    fixture.yInput.emit('input');
    check(controller.getDraft().valid === true && controller.getDraft().value.x === 12.346, 'valid input is quantized only in candidate value while raw text remains available');
    const applied = await controller.apply();
    check(applied.ok && applyCalls === 1 && !controller.isDraft() && controller.getView().pivot.x === 12.346,
        'valid Apply invokes the callback once and commits the accepted pivot');
    check(controller.getView().pivotEditPhase === 'idle' && fixture.applyButton.disabled === true, 'successful commit returns to idle and disables Apply');

    controller.setPlacementMode(true);
    fixture.surface.emit('click', { clientX: 160, clientY: 100 });
    check(controller.getDraft().rawValues.x === '160' && controller.getDraft().rawValues.y === '100',
        'padded non-square viewBox and CSS-sized SVG map its visual center back to the source center');
    controller.discard();

    const ctmFixture = makeFixture();
    ctmFixture.svg.screenCTM = { inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: -10, f: -20 }) };
    const ctmController = new PivotEditorController({
        ...ctmFixture,
        canBeginDraft: () => true,
    });
    ctmController.attach();
    ctmController.sync({ imageUrl: 'http://127.0.0.1:18729/current.png', snapshot: { status: 'ready', image: { width: 320, height: 200 }, pivot: { x: 160, y: 100 } } });
    ctmController.setPlacementMode(true);
    ctmFixture.surface.emit('click', { clientX: 170, clientY: 120 });
    check(ctmController.getDraft().rawValues.x === '160' && ctmController.getDraft().rawValues.y === '100',
        'available SVG getScreenCTM inverse takes priority over the fallback letterbox mapping');
    ctmController.dispose();

    const staleFixture = makeFixture();
    let resolveApply;
    const stale = new PivotEditorController({
        ...staleFixture,
        onApply: () => new Promise(resolve => { resolveApply = resolve; }),
        canBeginDraft: () => true,
    });
    stale.attach();
    stale.sync({ imageUrl: 'http://127.0.0.1:18729/current.png', snapshot: { status: 'ready', image: { width: 320, height: 200 }, pivot: { x: 160, y: 100 } } });
    staleFixture.xInput.value = '30';
    staleFixture.xInput.emit('input');
    const stalePromise = stale.apply();
    stale.dispose();
    resolveApply?.({ ok: true, snapshot: { pivot: { x: 30, y: 100 } } });
    const staleResult = await stalePromise;
    check(staleResult.reason === 'pivot-commit-stale' && staleFixture.marker.hidden === false, 'dispose makes a delayed Apply response stale without writing a new UI state');
}

async function verifyWiring() {
    const [pivot, editor, html, weight, server] = await Promise.all([
        read('tegaki_work/advanced/rive-editor/pivot-editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.html'),
        read('tegaki_work/advanced/rive-editor/weight-editor.js'),
        read('tegaki_work/advanced/rive-editor/server.mjs'),
    ]);
    check(pivot.includes('PivotEditorController') && pivot.includes('PIVOT_EDIT_PHASE')
        && pivot.includes('rawValues') && pivot.includes('fieldValidity') && pivot.includes('onApply'),
    'pivot controller exposes a local raw/validity draft and callback Apply contract');
    check(!pivot.includes('fetch(') && !pivot.includes('/api/') && !pivot.includes('RiveNativeRuntime')
        && !pivot.includes('getImageData') && !pivot.includes('toDataURL'),
    'pivot controller has no API, native runtime, pixel, or custom evaluator authority');
    check(pivot.includes('pointer-events') && pivot.includes('viewBoxValues') && pivot.includes('getScreenCTM')
        && pivot.includes('preserveAspectRatio') && pivot.includes('placementMode'),
        'pivot controller keeps the placement surface separate, prefers SVG CTM, and has a letterbox-safe fallback');
    check(editor.includes("from './pivot-editor.js'") && editor.includes('new PivotEditorController')
        && editor.includes('pivot: { x: Number(draft.value.x), y: Number(draft.value.y) }')
        && editor.includes('pivot-draft-active') && editor.includes('pivotEditPhase'),
    'editor connects pivot callbacks, compile payload, frame rejection, and AI snapshot phase');
    check(!editor.includes("next?.centerAtRotationPivot === true\n        || (next?.centerAtRotationPivot === undefined && meshProfile === 'grid3')"),
        'editor no longer forces grid3 centerAtRotationPivot true');
    check(html.includes('data-testid="rive-pivot-x"') && html.includes('data-testid="rive-pivot-y"')
        && html.includes('data-testid="rive-pivot-mode"') && html.includes('data-testid="rive-pivot-apply"')
        && html.includes('data-testid="rive-pivot-discard"') && html.includes('data-testid="rive-pivot-placement-surface"')
        && html.includes('回転中心'),
    'HTML exposes Japanese labeled X/Y, mode, center, Apply/Discard, marker, and placement surface controls');
    check(html.includes('#pivot-editor-layer[data-placement-mode="true"]')
        && html.includes('#pivot-editor-placement-surface { fill: transparent; pointer-events: none; }'),
    'mode OFF leaves the independent pivot surface pointer-inert beside influence points');
    check(weight.includes('setCenterAtRotationPivot') && weight.includes('!this.centerAtRotationPivot'),
        'weight central note visibility follows derived centerAtRotationPivot state');
    check(server.includes("'/pivot-model.mjs':") && server.includes("'/pivot-editor.js':"),
        'editor server exposes the pure pivot modules through its existing static route table');
}

await fs.mkdir(cacheRoot, { recursive: true });
await verifyController();
await verifyWiring();
const result = {
    schema: 'tegaki.rive-editor.pivot-ui-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    controller: failures.length ? 'FAIL' : 'PASS',
    native: 'UNVERIFIED — pure/controller verifier does not spawn 18729 or the official runtime',
    browser: 'UNVERIFIED — trusted visible Browser interaction remains with the Commander',
    owner: 'UNVERIFIED — Owner production acceptance is outside this verifier',
};
await fs.writeFile(path.join(cacheRoot, 'wp038-pivot-ui-verification.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
    console.error(`verify-rive-pivot-editor: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-pivot-editor: PASS (checks=${checks.length}; native=UNVERIFIED; browser=UNVERIFIED)`);
}

