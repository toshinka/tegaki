/**
 * ROLE: WP-036 source-image influence-map static/controller verifier.
 * AUTHORITY: editor-local UV/profile/selection wiring and bounded native/browser fixture references.
 * INVARIANTS: no server/native evaluator is introduced by the map; shared live processes and caches remain untouched.
 * RELATED: advanced/rive-editor/influence-map.js、weight-editor.js、editor.js、WP-036。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    deriveInfluenceSnapshotFields,
    InfluenceMapController,
    INFLUENCE_SELECTION_SPACE,
    VISUAL_VERTEX_ORDER,
} from '../advanced/rive-editor/influence-map.js';
import { WeightEditorController } from '../advanced/rive-editor/weight-editor.js';
import { GRID_VERTEX_NAMES, MESH_PROFILES, QUAD_VERTEX_NAMES } from '../advanced/rive-editor/mesh-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cacheRoot = path.join(root, 'tegaki_work', '.cache', 'rive-editor', 'wp036');
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
        this.style = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.parentNode = null;
        this.textContent = '';
        this.focused = false;
    }

    append(...nodes) {
        for (const node of nodes) {
            if (!node) continue;
            node.parentNode = this;
            this.children.push(node);
        }
    }

    appendChild(node) { this.append(node); return node; }

    replaceChildren(...nodes) {
        this.children = [];
        this.append(...nodes);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'data-influence-point') this.dataset.influencePoint = String(value);
    }

    getAttribute(name) { return this.attributes.get(name) || null; }

    removeAttribute(name) { this.attributes.delete(name); }

    setAttributeNS(namespace, name, value) { this.setAttribute(name, value); }

    removeAttributeNS(namespace, name) { this.removeAttribute(name); }

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
            handler({ preventDefault() {}, target: this, key: undefined, ...event });
        }
    }

    focus() { this.focused = true; }

    querySelectorAll(selector) {
        const matches = [];
        const visit = node => {
            for (const child of node.children || []) {
                const match = selector === '[data-influence-point]'
                    ? Boolean(child.dataset?.influencePoint)
                    : selector === '[data-influence-label]'
                        ? child.dataset?.influenceLabel === 'true'
                        : selector === '[data-influence-value]'
                            ? child.dataset?.influenceValue === 'true'
                            : false;
                if (match) matches.push(child);
                visit(child);
            }
        };
        visit(this);
        return matches;
    }

    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

    closest(selector) {
        if (selector === '[data-profile-vertex]') return this.parentNode?.dataset?.profileVertex ? this.parentNode : null;
        return null;
    }
}

function fakeDocument() {
    return { createElementNS: () => new FakeNode() };
}

function makeMapFixture() {
    const rootNode = new FakeNode();
    const svg = new FakeNode();
    const image = new FakeNode();
    const pointLayer = new FakeNode();
    const buttonRoot = new FakeNode();
    const selection = new FakeNode();
    const status = new FakeNode();
    const buttons = [...new Set([...QUAD_VERTEX_NAMES, ...GRID_VERTEX_NAMES])].map(name => {
        const button = new FakeNode();
        button.dataset.influencePoint = name;
        const label = new FakeNode();
        label.dataset.influenceLabel = 'true';
        const value = new FakeNode();
        value.dataset.influenceValue = 'true';
        button.append(label, value);
        buttonRoot.append(button);
        return button;
    });
    return { rootNode, svg, image, pointLayer, buttonRoot, selection, status, buttons };
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

function verifyStaticContracts(sources) {
    const { map, weight, editor, html, server, fixture } = sources;
    check(map.includes("INFLUENCE_SELECTION_SPACE = 'source-uv'")
        && map.includes('getMeshProfileDefinition')
        && map.includes('sourcePointDefinitions')
        && map.includes('deriveInfluenceSnapshotFields')
        && map.includes('VISUAL_VERTEX_ORDER'),
    'map uses the fixed mesh profile UV/source order and source-uv selection space');
    check(!map.includes('fetch(') && !map.includes('postJson(') && !map.includes('RiveNativeRuntime'),
    'map module has no server call, native runtime, or custom evaluator path');
    check(map.includes('imageToken') && map.includes('imageKey') && map.includes('token !== this.imageToken')
        && map.includes('removeEventListener'),
    'map image handling rejects stale load/error events and removes listeners on dispose');
    check(map.includes("event.key !== 'Enter'") && map.includes("event.key !== ' '")
        && map.includes('select(name, { focusInput: true })'),
    'map point selection supports click and Enter/Space without synthetic product input');
    check(map.includes('End ${percentText') && map.includes('Root ${point.rootPercent')
        && map.includes('未確定') && map.includes('endPercent'),
    'map displays End/Root numeric values and marks invalid selected fields as unconfirmed');
    check(map.includes('nodes.label.textContent = point.label')
        && map.includes('data-source-viewBox')
        && !map.includes('nodes.label.textContent = `${point.label} / ${point.name}`'),
    'SVG keeps short Japanese position labels and display-only margin metadata while full names stay outside the drawing');
    check(weight.includes('selectVertex(name') && weight.includes('getSelectionView()')
        && weight.includes('selectedWeightValid') && weight.includes('weightDraftActive')
        && weight.includes('_normalizeSelection'),
    'weight controller exposes a derived selection view and profile-safe selection lifecycle');
    check(editor.includes("from './influence-map.js'") && editor.includes('deriveInfluenceSnapshotFields')
        && editor.includes('syncInfluenceMap')
        && editor.includes('selectionSpace: INFLUENCE_SELECTION_SPACE')
        && editor.includes('selectedEndPercent') && editor.includes('selectedWeightValid')
        && editor.includes('weightDraftActive'),
    'editor snapshot and callbacks carry runtime-only influence selection fields');
    check(html.includes('data-testid="rive-influence-map"') && html.includes('data-testid="rive-influence-map-svg"')
        && html.includes('data-testid="rive-influence-Center"') && html.includes('素材上の点（変形前）')
        && html.includes('End（橙）') && html.includes('Root（えんじ）') && html.includes('未適用')
        && html.includes('360px') && !html.includes('source UV')
        && html.includes('TopLeft') && html.includes('BottomRight'),
    'editor UI exposes the bounded source map, Japanese/internal point names, legend, and 360px layout cap');
    check(server.includes("'/influence-map.js':") && server.includes('influence-map.js'),
        'server exposes exactly the editor-local influence-map static module');
    check(fixture.includes('InfluenceMapController') && fixture.includes('RiveNativeRuntime')
        && fixture.includes('await runtime.load') && fixture.includes('runtime.render')
        && fixture.includes('getImageData') && fixture.includes('rgbaReceipt')
        && fixture.includes('trusted source/state'),
    'visible fixture references the real influence module and native RGBA receipt controls');
    check(!fixture.includes('dispatchEvent') && !fixture.includes('PointerEvent') && !fixture.includes('KeyboardEvent'),
        'visible fixture does not synthesize product input events');
}

async function verifyController() {
    const previousDocument = globalThis.document;
    globalThis.document = fakeDocument();
    try {
        const fixture = makeMapFixture();
        const selected = [];
        const focusTargets = [];
        const map = new InfluenceMapController({
            root: fixture.rootNode,
            svg: fixture.svg,
            imageNode: fixture.image,
            pointLayer: fixture.pointLayer,
            buttonRoot: fixture.buttonRoot,
            selectionNode: fixture.selection,
            statusNode: fixture.status,
            onSelectionChanged: name => selected.push(name),
            onFocusInput: name => focusTargets.push(name),
        });
        map.attach();
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/wp036-source.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: {
                profile: MESH_PROFILES.grid3,
                endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128],
                percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2],
                selectedVertex: 'Center',
            },
        });
        check(fixture.image.getAttribute('href')?.includes('wp036-source.png') && fixture.image.hidden === false,
            'controller binds a source image URL without converting it into a data URL');
        check(fixture.buttons.every(button => button.disabled === true), 'map stays non-interactive until the image load receipt');
        const staleLoad = fixture.image.listeners.get('load')?.[0];
        fixture.image.emit('load');
        let view = map.getView();
        check(view.profile === MESH_PROFILES.grid3 && view.sourcePoints.length === 9 && view.visualPoints.length === 9,
            'grid3 source map exposes all nine points');
        const center = view.sourcePoints.find(point => point.name === 'Center');
        const topRight = view.sourcePoints.find(point => point.name === 'TopRight');
        check(center?.x === 150 && center?.y === 90 && topRight?.x === 300 && topRight?.y === 0,
            'anisotropic 300x180 map uses fixed source UV positions');
        check(fixture.svg.getAttribute('data-source-viewBox') === '0 0 300 180'
            && fixture.svg.getAttribute('viewBox') !== '0 0 300 180',
        'display-only SVG margin avoids edge clipping without changing source UV coordinates');
        check(view.visualPoints.map(point => point.name).join(',') === VISUAL_VERTEX_ORDER.join(','),
            'visual map order is row-major while source order stays profile-defined');
        check(fixture.selection.textContent.includes('中央') && fixture.selection.textContent.includes('Center')
            && fixture.selection.textContent.includes('End 50.2%') && fixture.selection.textContent.includes('Root 49.8%'),
        'selected point exposes Japanese/internal name and End/Root numeric receipt');
        check(fixture.status.textContent.includes('確認済み') && !fixture.status.textContent.includes('未適用draft'),
            'confirmed view status is explicit after image load');
        fixture.buttons.find(button => button.dataset.influencePoint === 'BottomCenter').emit('keydown', { key: 'Enter' });
        check(selected.at(-1) === 'BottomCenter' && focusTargets.at(-1) === 'BottomCenter',
            'Enter on a point button selects once and requests corresponding input focus');
        fixture.buttons.find(button => button.dataset.influencePoint === 'TopLeft').emit('keydown', { key: ' ' });
        check(selected.at(-1) === 'TopLeft' && focusTargets.at(-1) === 'TopLeft',
            'Space on a point button selects the matching point');

        const oldGroups = [...fixture.pointLayer.children];
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/wp036-source.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.quad },
            weightView: { profile: MESH_PROFILES.quad, endWeights: [0, 128, 255, 0], percentages: [0, 50.2, 100, 0], selectedVertex: 'TopLeft' },
        });
        selected.splice(0);
        oldGroups[0].emit('click');
        check(selected.length === 0 && map.pointListeners.length === QUAD_VERTEX_NAMES.length * 2,
            'profile remount removes detached point listeners and old SVG points cannot callback');
        const quadTopRight = map.points.get('TopRight')?.group;
        quadTopRight?.emit('click');
        check(selected.length === 1 && selected[0] === 'TopRight', 'new profile point invokes one callback');
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/wp036-source.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2], selectedVertex: 'TopLeft' },
        });
        check(map.pointListeners.length === GRID_VERTEX_NAMES.length * 2, 'repeated quad/grid remount keeps point listener ownership bounded');
        const gridCenterGroup = map.points.get('Center')?.group;
        const beforeSameProfile = map.points.get('Center')?.group;
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/wp036-source.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2], selectedVertex: 'Center' },
        });
        check(beforeSameProfile === map.points.get('Center')?.group && gridCenterGroup === beforeSameProfile,
            'same-profile seek/playback sync keeps point DOM nodes');

        map.sync({
            imageUrl: 'http://127.0.0.1:18838/second.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2], selectedVertex: 'Center' },
        });
        staleLoad?.();
        check(map.getView().imageReady === false, 'stale load callback cannot re-enable a newer source image');
        fixture.image.emit('load');
        const hrefWrites = (fixture.image.attributes.get('href') || '').length;
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/second.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2], selectedVertex: 'Center' },
        });
        check((fixture.image.attributes.get('href') || '').length === hrefWrites, 'same source playback sync does not refetch or rebind the image');
        fixture.image.emit('error');
        check(map.getView().interactive === false && fixture.status.textContent.includes('表示できません')
            && fixture.buttons.every(button => button.disabled === true), 'image error disables the map and reports the failed image generation');
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/second.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 255, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 100, 0, 50.2], selectedVertex: 'Center' },
        });
        check(fixture.status.textContent.includes('表示できません') && fixture.buttons.every(button => button.disabled === true), 'same failed image generation remains error/disabled on later sync');
        map.sync({
            imageUrl: 'http://127.0.0.1:18838/third.png',
            snapshot: { status: 'ready', image: { width: 300, height: 180 }, meshProfile: MESH_PROFILES.grid3 },
            weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2], selectedVertex: 'Center' },
        });
        check(fixture.status.textContent.includes('読み込み中') && fixture.buttons.every(button => button.disabled === true), 'new image generation returns to loading state');
        fixture.image.emit('load');
        map.sync({ busy: true, imageUrl: 'http://127.0.0.1:18838/third.png', snapshot: { status: 'ready', image: { width: 300, height: 180 } }, weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 255, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 100, 0, 0, 50.2], selectedVertex: 'Center' } });
        check(map.getView().interactive === false && fixture.buttons.every(button => button.disabled === true), 'busy state disables all map selection controls');
        map.sync({ imageUrl: 'http://127.0.0.1:18838/third.png', snapshot: { status: 'building', weightEditPhase: 'draft', image: { width: 300, height: 180 } }, weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 255, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 100, 0, 0, 50.2], selectedVertex: 'Center', fieldValidity: { Center: true }, weightDraftActive: true } });
        check(map.getView().interactive === true && fixture.status.textContent.includes('未適用draft'), 'weight draft keeps map selection available and explains uncommitted values');
        map.sync({ imageUrl: 'http://127.0.0.1:18838/third.png', snapshot: { status: 'building', weightEditPhase: 'draft', image: { width: 300, height: 180 } }, weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 255, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 100, 0, 0, 50.2], selectedVertex: 'Center', fieldValidity: { Center: false }, weightDraftActive: true } });
        check(map.getView().selectedWeightValid === false && fixture.status.textContent.includes('未確定'), 'invalid draft status explains unconfirmed input');
        map.sync({ imageUrl: 'http://127.0.0.1:18838/third.png', snapshot: { status: 'ready', image: { width: 300, height: 180 } }, weightView: { profile: MESH_PROFILES.grid3, endWeights: [0, 128, 255, 255, 255, 255, 0, 0, 128], percentages: [0, 50.2, 100, 100, 100, 100, 0, 0, 50.2], selectedVertex: 'Center', fieldValidity: null, weightDraftActive: false } });
        check(fixture.status.textContent.includes('確認済み') && !fixture.status.textContent.includes('未適用draft'), 'Apply/Discard/seek confirmed sync clears stale draft status');
        map.dispose();
        check(map.select('Center') === false && map.pointListeners.length === 0
            && fixture.buttons.every(button => button.listeners.get('click')?.length === 0), 'dispose removes map listeners and rejects later selection');
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
}

async function verifySnapshotProjection() {
    const inputs = Object.fromEntries([...new Set([...QUAD_VERTEX_NAMES, ...GRID_VERTEX_NAMES])].map(name => [name, new FakeNode('0')]));
    let applyCalls = 0;
    const controller = new WeightEditorController({
        root: new FakeNode(),
        profile: MESH_PROFILES.quad,
        inputs,
        initialWeights: [0, 128, 255, 0],
        onApply: async draft => {
            applyCalls += 1;
            return { ok: true, acceptedByCallback: false, snapshot: { meshProfile: draft.profile, meshWeights: draft.endWeights } };
        },
    });
    controller.attach();
    const stale = {
        meshProfile: MESH_PROFILES.quad,
        selectionProfile: MESH_PROFILES.quad,
        selectedVertex: 'TopLeft',
        selectedEndPercent: 100,
        selectedWeightValid: true,
        weightDraftActive: false,
    };
    const project = (next = stale) => deriveInfluenceSnapshotFields({
        next: { ...stale, ...next },
        previous: stale,
        selectionView: controller.getSelectionView(),
    });
    inputs.TopRight.emit('focus');
    inputs.TopRight.value = '5';
    inputs.TopRight.emit('input');
    let projected = project();
    check(projected.selectedVertex === 'TopRight'
        && Math.abs(projected.selectedEndPercent - 5.1) < 0.02
        && projected.selectedWeightValid === true
        && projected.weightDraftActive === true,
    'editor snapshot projection prefers current first-input draft view over stale spread fields');

    controller.selectVertex('TopLeft');
    const switched = controller.setProfile(MESH_PROFILES.grid3);
    projected = deriveInfluenceSnapshotFields({
        next: { ...stale, meshProfile: MESH_PROFILES.quad, selectionProfile: MESH_PROFILES.quad, selectedEndPercent: 100, weightDraftActive: false },
        previous: stale,
        selectionView: controller.getSelectionView(),
    });
    check(switched.ok === true && projected.selectionProfile === MESH_PROFILES.grid3
        && projected.selectedVertex === 'TopLeft' && projected.selectedEndPercent === 0
        && projected.weightDraftActive === true,
    'quad-to-grid3 draft snapshot uses current selection profile/percent/active while confirmed native profile stays separate');

    inputs.Center.value = '';
    inputs.Center.emit('input');
    projected = project();
    check(projected.selectedVertex === 'Center' && projected.selectedEndPercent === null
        && projected.selectedWeightValid === false && projected.weightDraftActive === true,
    'invalid draft snapshot preserves explicit null selected percent and false validity');
    controller.discard();
    projected = project();
    check(projected.selectionProfile === MESH_PROFILES.quad && projected.selectedVertex === 'TopLeft'
        && projected.selectedEndPercent === 0 && projected.weightDraftActive === false,
    'Discard snapshot returns to confirmed quad selection without stale draft fields');

    controller.setPreset('end');
    const applied = await controller.apply();
    projected = project();
    check(applied.ok === true && applyCalls === 1 && projected.selectionProfile === MESH_PROFILES.quad
        && projected.weightDraftActive === false && projected.selectedWeightValid === true,
    'Apply snapshot promotes the confirmed view once and clears draft-active state');
    controller.loadCommitted(MESH_PROFILES.grid3, [0, 128, 255, 255, 255, 128, 0, 0, 128]);
    projected = project({ meshProfile: MESH_PROFILES.grid3 });
    check(projected.selectionProfile === MESH_PROFILES.grid3 && projected.weightDraftActive === false
        && projected.selectedVertex === 'TopLeft', 'load snapshot synchronizes the confirmed profile and retained selection');
    const explicitNull = deriveInfluenceSnapshotFields({
        next: { ...stale, selectedEndPercent: null, selectedWeightValid: false, weightDraftActive: true },
        previous: stale,
        selectionView: null,
    });
    check(explicitNull.selectedEndPercent === null && explicitNull.selectedWeightValid === false
        && explicitNull.weightDraftActive === true, 'snapshot fallback preserves explicit null/false runtime fields');
    controller.dispose();
}

function verifyWeightSelection() {
    const inputs = Object.fromEntries([...new Set([...QUAD_VERTEX_NAMES, ...GRID_VERTEX_NAMES])].map(name => [name, new FakeNode(name === 'Center' ? '50' : '0')]));
    const rootNode = new FakeNode();
    const selected = [];
    const controller = new WeightEditorController({
        root: rootNode,
        profile: MESH_PROFILES.grid3,
        inputs,
        initialWeights: [0, 128, 255, 255, 255, 128, 0, 0, 128],
        onSelectionChanged: name => selected.push(name),
    });
    controller.attach();
    controller.selectVertex('Center', { focus: true });
    check(!controller.isDraft() && selected.at(-1) === 'Center' && inputs.Center.focused === true,
        'selection/focus alone does not start a weight draft');
    inputs.TopLeft.emit('focus');
    inputs.TopLeft.value = '5';
    inputs.TopLeft.emit('input');
    inputs.Center.value = '';
    inputs.Center.emit('input');
    inputs.TopCenter.value = '25';
    inputs.TopCenter.emit('input');
    controller.selectVertex('Center');
    const draft = controller.getDraft();
    check(draft?.rawValues.TopLeft === '5' && draft?.rawValues.Center === '' && draft?.fieldValidity.Center === false,
        'raw numeric values remain per-field and an empty field stays invalid after another point changes');
    const selectionView = controller.getSelectionView();
    check(selectionView.selectedWeightValid === false && selectionView.selectedEndPercent === null,
        'invalid selected input is shown as unconfirmed instead of an old numeric candidate');
    controller.dispose();
}

const sources = Object.fromEntries(await Promise.all([
    ['map', read('tegaki_work/advanced/rive-editor/influence-map.js')],
    ['weight', read('tegaki_work/advanced/rive-editor/weight-editor.js')],
    ['editor', read('tegaki_work/advanced/rive-editor/editor.js')],
    ['html', read('tegaki_work/advanced/rive-editor/editor.html')],
    ['server', read('tegaki_work/advanced/rive-editor/server.mjs')],
    ['fixture', read('tegaki_work/build/wp036-rive-influence-browser.html')],
].map(async ([key, promise]) => [key, await promise])));
verifyStaticContracts(sources);
await verifyController();
await verifySnapshotProjection();
verifyWeightSelection();

const result = {
    schema: 'tegaki.rive-editor.influence-map-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    selectionSpace: INFLUENCE_SELECTION_SPACE,
    profiles: {
        quad: { vertexNames: QUAD_VERTEX_NAMES, vertexCount: QUAD_VERTEX_NAMES.length },
        grid3: { vertexNames: GRID_VERTEX_NAMES, vertexCount: GRID_VERTEX_NAMES.length },
    },
    native: 'UNVERIFIED — visible trusted fixture requires Owner/browser runtime receipt',
    browser: 'UNVERIFIED — wp036-rive-influence-browser.html requires trusted visible inspection',
    owner: 'UNVERIFIED — Owner acceptance is outside the bounded verifier',
};
await fs.mkdir(cacheRoot, { recursive: true });
await fs.writeFile(path.join(cacheRoot, 'wp036-influence-map-verification.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
    console.error(`verify-rive-influence-map: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-influence-map: PASS (checks=${checks.length}; native=UNVERIFIED; browser=UNVERIFIED)`);
}
