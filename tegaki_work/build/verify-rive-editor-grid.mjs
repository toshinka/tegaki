/**
 * ROLE: WP-035 Slice A/B の quad/grid3 profile、draft wiring、固定CLI/native再構築、専用cache evidence verifier。
 * AUTHORITY: 純粋なmodel/controller/static契約と公式 CLI の限定実行ログだけ。Product server/Project/History/renderer は変更しない。
 * INVARIANTS: 既存quad source bytes、grid3の8 ContourMeshVertex+1 MeshVertex、公式Root/End packed weight、profile draftの一回Apply、別directory再buildの一致を確認する。
 * RELATED: advanced/rive-editor/model.mjs、mesh-profile.mjs、weight-editor.js、editor.js、server.mjs、WP-035-rive-grid-mesh-editing.md。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_END_WEIGHTS } from '../advanced/rive-editor/weight-model.mjs';
import { WeightEditorController } from '../advanced/rive-editor/weight-editor.js';
import {
    GRID_TRIANGLES,
    GRID_VERTEX_NAMES,
    GRID_UV,
    MESH_PROFILES,
    QUAD_TRIANGLES,
    assertMeshProfile,
    assertMeshWeights,
    assertProfileTriangles,
    assertTriangleIndices,
    convertMeshWeights,
    decodeTriangleIndices,
    encodeTriangleIndices,
    gridWeightsFromQuad,
    triangleIndexBytesForProfile,
} from '../advanced/rive-editor/mesh-profile.mjs';
import {
    createFixturePng,
    createRiveYaml,
    createSource,
    makeSnapshot,
    parseSourceMetadata,
    sha256Bytes,
} from '../advanced/rive-editor/model.mjs';
import { verifyFixedCache } from '../advanced/rive-editor/dev-companion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workRoot = path.join(root, 'tegaki_work');
const cacheRoot = path.join(workRoot, '.cache', 'rive-editor', 'wp035');
const checks = [];
const failures = [];

function check(condition, message) {
    checks.push({ ok: Boolean(condition), message });
    if (!condition) failures.push(message);
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
        for (const handler of this.listeners.get(type) || []) handler({ preventDefault() {}, target: this, ...event });
    }
}

async function writeJson(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function read(relativePath) {
    return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function hashFile(filePath) {
    return sha256Bytes(await fs.readFile(filePath));
}

async function readFirstExisting(paths) {
    for (const filePath of paths) {
        try {
            return { path: filePath, source: await fs.readFile(filePath, 'utf8') };
        } catch {
            // The bounded evidence path is optional on a clean checkout.
        }
    }
    return null;
}

function expectThrow(callback, message) {
    let rejected = false;
    try { callback(); } catch { rejected = true; }
    check(rejected, message);
}

function mutateOnce(source, pattern, replacement) {
    const next = source.replace(pattern, replacement);
    if (next === source) throw new Error(`mutation did not match: ${pattern}`);
    return next;
}

async function verifyQuadCompatibility() {
    const candidates = [
        path.join(workRoot, '.cache', 'rive-editor', 'wp034-saved-backup', 'scene.rml'),
        path.join(workRoot, '.cache', 'rive-editor', 'wp034-resume-backup', 'scene.rml'),
        path.join(workRoot, '.cache', 'rive-editor', 'saved', 'scene.rml'),
    ];
    const evidence = await readFirstExisting(candidates);
    check(Boolean(evidence), 'existing quad source evidence is available');
    if (!evidence) return null;
    const metadata = parseSourceMetadata(evidence.source);
    check(metadata?.meshProfile === MESH_PROFILES.quad && metadata.vertexCount === 4 && metadata.triangleCount === 2,
        'existing source remains the quad profile');
    if (!metadata) return null;
    const recreated = createSource({
        width: metadata.width,
        height: metadata.height,
        angle: metadata.angle,
        meshWeights: metadata.meshWeights,
    });
    check(recreated === evidence.source, `quad source bytes remain identical (${path.basename(path.dirname(evidence.path))})`);
    check(recreated.includes('triangleIndexBytes="AAECAAID"') && !recreated.includes('GridMesh3'),
        'quad source keeps the original triangle bytes and mesh name');
    return { path: evidence.path, sourceHash: sha256Bytes(Buffer.from(evidence.source, 'utf8')), metadata };
}

async function verifyBrowserFixture() {
    const fixturePath = path.join(workRoot, 'build', 'wp035-rive-grid-browser.html');
    const source = await fs.readFile(fixturePath, 'utf8');
    check(source.includes('trusted操作') && source.includes('data-testid="wp035-grid-open"')
        && source.includes('data-testid="wp035-grid-inspect"') && source.includes('data-testid="wp035-grid-native-inspect"'),
    'visible Browser fixture exposes trusted grid receipt controls');
    check(source.includes('default-progress1.png') && source.includes('mixed-progress1.png') && source.includes('reload-progress1.png'),
        'visible Browser fixture exposes all three native screenshot receipts');
    check(!source.includes('dispatchEvent') && !source.includes('PointerEvent') && !source.includes('KeyboardEvent'),
        'visible Browser fixture does not synthesize product input events');
    check(source.includes("import { RiveNativeRuntime, imageMetrics } from '/runtime.js';")
        && source.includes('await runtime.load') && source.includes('runtime.render(1)')
        && source.includes('runtime.dispose()') && source.includes('getImageData')
        && source.includes('transparentPixels') && source.includes('rgbaSha256') && source.includes('nativeSha256'),
    'visible Browser fixture uses the existing native runtime lifecycle and RGBA receipt');
    return { path: fixturePath, trustedInput: true };
}

function verifyGridDraftController() {
    const gridInputs = Object.fromEntries(GRID_VERTEX_NAMES.map((name, index) => [name, new FakeElement(String([0, 50.2, 100, 100, 100, 50.2, 0, 0, 50.2][index]))]));
    const gridOutputs = Object.fromEntries(GRID_VERTEX_NAMES.map(name => [name, new FakeElement()]));
    const gridProfile = new FakeElement('grid3');
    const gridRoot = new FakeElement();
    const gridMessages = [];
    const grid = new WeightEditorController({
        root: gridRoot,
        profile: MESH_PROFILES.grid3,
        profileSelect: gridProfile,
        inputs: gridInputs,
        rootOutputs: gridOutputs,
        initialWeights: [10, 20, 30, 40, 50, 60, 70, 80, 90],
        onMessage: message => gridMessages.push(message),
    });
    grid.attach();
    gridInputs.TopLeft.emit('focus');
    gridInputs.TopLeft.value = '';
    gridInputs.TopLeft.emit('input');
    const invalid = grid.getDraft();
    gridProfile.value = MESH_PROFILES.quad;
    const blockedProfileSwitch = grid.setProfile(MESH_PROFILES.quad);
    check(blockedProfileSwitch.ok === false && blockedProfileSwitch.reason === 'draft-invalid'
        && gridProfile.value === MESH_PROFILES.grid3
        && grid.getDraft().profile === MESH_PROFILES.grid3
        && grid.getDraft().rawValues.TopLeft === ''
        && grid.getDraft().fieldValidity.TopLeft === false,
    'invalid grid3 draft rejects profile switch and restores the current selector/raw field');
    gridInputs.TopCenter.value = '25';
    gridInputs.TopCenter.emit('input');
    check(invalid.valid === false && invalid.rawValues.TopLeft === '' && grid.getDraft().fieldValidity.TopLeft === false,
        'grid3 raw empty field stays invalid while another field changes');
    grid.discard();
    check(!grid.isDraft() && gridInputs.Center.value === '35.29', 'grid3 discard restores confirmed center byte percentage');
    grid.dispose();

    let applyCalls = 0;
    const profileInputs = Object.fromEntries([...new Set(['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft', ...GRID_VERTEX_NAMES])]
        .map(name => [name, new FakeElement(name === 'Center' ? '50' : '0')]));
    const profileSelect = new FakeElement('quad');
    const profileRoot = new FakeElement();
    const profile = new WeightEditorController({
        root: profileRoot,
        profile: MESH_PROFILES.quad,
        profileSelect,
        inputs: profileInputs,
        initialWeights: [10, 30, 50, 70],
        onApply: async draft => {
            applyCalls += 1;
            return { ok: true, acceptedByCallback: false, snapshot: { meshProfile: draft.profile, meshWeights: draft.endWeights } };
        },
    });
    profile.attach();
    profileSelect.value = MESH_PROFILES.grid3;
    profileSelect.emit('change', { target: profileSelect });
    check(profile.isDraft() && applyCalls === 0 && profile.getDraft().profile === MESH_PROFILES.grid3,
        'profile selection stays draft-only until explicit Apply');
    check(JSON.stringify(profile.getDraft().endWeights) === JSON.stringify([10, 20, 30, 40, 50, 60, 70, 40, 40]),
        'quad to grid3 profile conversion uses fixed UV interpolation');
    profileInputs.Center.value = 'NaN';
    profileInputs.Center.emit('input');
    check(profile.getDraft().fieldValidity.Center === false && profile.getDraft().rawValues.Center === 'NaN',
        'grid3 center preserves raw invalid input and field validity');
    profileInputs.Center.value = '50';
    profileInputs.Center.emit('input');
    const applied = profile.apply();
    return applied.then(result => {
        check(result.ok === true && applyCalls === 1 && !profile.isDraft() && profileRoot.dataset.profile === MESH_PROFILES.grid3,
            'grid3 Apply performs one compile callback and promotes the profile');
        profile.dispose();

        const reverseInputs = Object.fromEntries([...new Set(['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft', ...GRID_VERTEX_NAMES])]
            .map(name => [name, new FakeElement('0')]));
        const reverse = new WeightEditorController({
            profile: MESH_PROFILES.grid3,
            inputs: reverseInputs,
            initialWeights: [10, 20, 30, 40, 50, 60, 70, 80, 90],
            onMessage: message => gridMessages.push(message),
        });
        reverse.attach();
        const switched = reverse.setProfile(MESH_PROFILES.quad);
        check(switched.ok === true && reverse.getDraft().profileChange?.discardedInternalWeights === true
            && JSON.stringify(reverse.getDraft().endWeights) === JSON.stringify([10, 30, 50, 70])
            && gridMessages.some(message => message.includes('内部weight') && message.includes('適用')),
        'grid3 to quad uses corner indices and warns before Apply');
        reverse.dispose();
    });
}

async function verifyBStaticWiring() {
    const [weightEditorSource, serverSource, editorSource, htmlSource] = await Promise.all([
        read('tegaki_work/advanced/rive-editor/weight-editor.js'),
        read('tegaki_work/advanced/rive-editor/server.mjs'),
        read('tegaki_work/advanced/rive-editor/editor.js'),
        read('tegaki_work/advanced/rive-editor/editor.html'),
    ]);
    for (const name of GRID_VERTEX_NAMES) check(htmlSource.includes(`data-rive-weight="${name}"`), `grid3 input is present: ${name}`);
    const sourceOrder = { TopLeft: 0, TopCenter: 1, TopRight: 2, MiddleRight: 3, BottomRight: 4, BottomCenter: 5, BottomLeft: 6, MiddleLeft: 7, Center: 8 };
    for (const [name, index] of Object.entries(sourceOrder)) check(htmlSource.includes(`data-rive-weight="${name}" data-rive-source-index="${index}"`), `grid3 source order is fixed: ${name}=${index}`);
    check(htmlSource.includes('data-testid="rive-mesh-profile"') && htmlSource.includes('option value="grid3"')
        && htmlSource.includes('メッシュ: 四隅 / 9点') && htmlSource.includes('.weight-row[hidden] { display: none !important; }')
        && htmlSource.includes('data-grid3-only hidden'),
    'profile selector exposes quad/grid3 choices, hidden profile rows stay out of layout, and center note is grid-only');
    check(htmlSource.includes('中央は現在の骨の回転中心にあるため、中央の追従だけでは見た目は変わりません。'),
        'grid3 center explains rotation-pivot visual behavior');
    check(weightEditorSource.includes('setProfile') && weightEditorSource.includes('convertMeshWeights')
        && weightEditorSource.includes('profileChange') && weightEditorSource.includes('discardedInternalWeights')
        && weightEditorSource.includes('rawValues') && weightEditorSource.includes('data-grid3-only'),
    'weight controller owns profile conversion, raw draft validity, and grid-only center note visibility');
    check(editorSource.includes('meshProfileSelect') && editorSource.includes('profile: draft.profile')
        && editorSource.includes('loadCommitted(value.snapshot.meshProfile')
        && editorSource.includes("reason: 'weights-draft'")
        && editorSource.includes('weightController?.isDraft() || weightController?.isPending()'),
    'editor keeps profile/weights draft-only and blocks operations while active');
    check(editorSource.includes('meshProfile') && editorSource.includes('vertexCount') && editorSource.includes('triangleCount')
        && editorSource.includes('centerAtRotationPivot') && editorSource.includes('weightDraft'),
    'editor snapshot carries profile topology and draft fields');
    check(serverSource.includes('assertMeshProfile') && serverSource.includes('assertMeshWeights')
        && serverSource.includes('convertMeshWeights') && serverSource.includes("hasOwnProperty.call(body, 'profile')")
        && serverSource.includes("'/mesh-profile.mjs'") && serverSource.includes('centerAtRotationPivot')
        && serverSource.includes('meshProfile: state.meshProfile') && serverSource.includes('state.meshProfile = assertMeshProfile')
        && !serverSource.includes('? { ...baseSnapshot, centerAtRotationPivot: true }'),
    'server validates profile/weights before CLI, preserves them on image replacement, and exposes profile topology');
    const centered = parseSourceMetadata(createSource({ width: 320, height: 200, profile: 'grid3' }));
    const moved = parseSourceMetadata(createSource({ width: 320, height: 200, profile: 'grid3', pivot: { x: 120, y: 100 } }));
    check(centered?.centerAtRotationPivot === true && moved?.centerAtRotationPivot === false,
        'grid3 center note follows the source rotation pivot rather than the profile alone');
    check(serverSource.includes("pathname === '/api/reopen'") && serverSource.includes("pathname === '/api/cancel'")
        && serverSource.includes('promote(candidate, reason, false)'),
    'server reopen/cancel rebuilds source-authoritative profile and weights');
    const classifierMatch = serverSource.match(/function isInputRejectedError\(error\) \{[\s\S]*?\n\}/u);
    let classifyInputError = null;
    try {
        if (classifierMatch) classifyInputError = new Function(`${classifierMatch[0]}; return isInputRejectedError;`)();
    } catch {
        classifyInputError = null;
    }
    check(typeof classifyInputError === 'function'
        && classifyInputError({ message: 'Unknown mesh profile: null' })
        && classifyInputError({ message: 'Unknown mesh profile: ' })
        && classifyInputError({ message: 'grid3 mesh weights must contain 9 bytes.' })
        && classifyInputError({ message: 'grid3 mesh weight Center must be an integer between 0 and 255.' })
        && !classifyInputError({ message: 'Rive CLI/internal server failure' }),
    'server maps profile/weight input errors to 400 but leaves internal failures at 500');
    check(!serverSource.includes('weights: state.meshWeights') && !serverSource.includes('weights: candidate.sourceInfo.meshWeights'),
        'server does not add a second weight authority to saved meta');
}

function verifyMeshProfileModel() {
    const quadBytes = triangleIndexBytesForProfile(MESH_PROFILES.quad);
    const gridBytes = triangleIndexBytesForProfile(MESH_PROFILES.grid3);
    check(quadBytes === 'AAECAAID', 'quad triangle bytes stay fixed');
    check(gridBytes === 'AAEIAQIIAgMIAwQIBAUIBQYIBgcIBwAI', 'grid3 triangle bytes use the fixed eight-fan topology');
    check(JSON.stringify(decodeTriangleIndices(gridBytes)) === JSON.stringify(GRID_TRIANGLES.flat()),
        'grid3 triangle bytes decode to eight positive fan triangles');
    check(JSON.stringify(assertTriangleIndices(MESH_PROFILES.grid3, gridBytes)) === JSON.stringify(GRID_TRIANGLES.flat()),
        'grid3 topology is exact and range checked');
    assertProfileTriangles(MESH_PROFILES.quad, QUAD_TRIANGLES);
    assertProfileTriangles(MESH_PROFILES.grid3, GRID_TRIANGLES, GRID_UV);
    check(JSON.stringify(gridWeightsFromQuad(DEFAULT_END_WEIGHTS)) === JSON.stringify([0, 128, 255, 255, 255, 128, 0, 0, 128]),
        'default quad bytes expand to the fixed grid3 bytes');
    check(JSON.stringify(convertMeshWeights([0, 140, 255, 220], MESH_PROFILES.quad, MESH_PROFILES.grid3))
        === JSON.stringify([0, 70, 140, 198, 255, 238, 220, 110, 154]),
    'quad to grid3 conversion preserves byte quantization');
    check(JSON.stringify(convertMeshWeights([0, 70, 140, 198, 255, 238, 220, 110, 154], MESH_PROFILES.grid3, MESH_PROFILES.quad))
        === JSON.stringify([0, 140, 255, 220]),
    'grid3 to quad conversion uses the four corners');
    for (const invalid of ['unsupported', null, '', 1, {}, []]) expectThrow(() => assertMeshProfile(invalid), `invalid mesh profile is rejected: ${String(invalid)}`);
    expectThrow(() => assertMeshWeights(MESH_PROFILES.grid3, [0, 1, 2, 3]), 'grid3 does not accept four weights');
    expectThrow(() => assertMeshWeights(MESH_PROFILES.quad, [0, 1, 2, 3, 4]), 'quad does not accept nine weights');
}

function verifyGridSource() {
    const width = 320;
    const height = 200;
    const source = createSource({ width, height, angle: 56, meshProfile: MESH_PROFILES.grid3 });
    const metadata = parseSourceMetadata(source);
    check(metadata?.meshProfile === MESH_PROFILES.grid3, 'grid3 source parses as grid3');
    check(metadata?.vertexCount === 9 && metadata?.triangleCount === 8 && metadata?.vertices === 9 && metadata?.triangles === 8,
        'grid3 source exposes 9 vertices and 8 triangles');
    check(JSON.stringify(metadata?.meshWeights) === JSON.stringify([0, 128, 255, 255, 255, 128, 0, 0, 128]),
        'grid3 source uses the derived default weights');
    check((source.match(/<ContourMeshVertex\b/g) || []).length === 8
        && (source.match(/<MeshVertex\b/g) || []).length === 1
        && (source.match(/<Weight\b/g) || []).length === 9,
    'grid3 source has eight outline vertices, one center vertex, and nine weights');
    const customWeights = [0, 180, 255, 220, 255, 60, 0, 30, 150];
    const customSource = createSource({ width, height, angle: 56, profile: MESH_PROFILES.grid3, meshWeights: customWeights });
    const customMetadata = parseSourceMetadata(customSource);
    check(JSON.stringify(customMetadata?.meshWeights) === JSON.stringify(customWeights), 'grid3 middle and edge bytes round-trip exactly');
    const snapshot = makeSnapshot({
        status: 'ready',
        documentId: 'wp035-grid',
        buildId: 'wp035-build',
        currentSource: customSource,
        image: { name: 'fixture.png', width, height },
        angle: 56,
        progress: 1,
        dirty: false,
        meshWeights: customWeights,
    });
    check(snapshot.meshProfile === MESH_PROFILES.grid3 && snapshot.vertexCount === 9 && snapshot.triangleCount === 8,
        'snapshot derives grid3 profile and topology from source');
    check(JSON.stringify(snapshot.meshWeights) === JSON.stringify(customWeights), 'snapshot derives grid3 bytes from source');
    expectThrow(() => createSource({ width, height, meshProfile: 'unsupported' }), 'createSource rejects an unsupported profile');
    expectThrow(() => createSource({ width, height, profile: null }), 'createSource rejects an explicit null profile');
    expectThrow(() => createSource({ width, height, meshProfile: '' }), 'createSource rejects an explicit empty profile');
    expectThrow(() => createSource({ width, height, meshProfile: 9 }), 'createSource rejects a non-string profile');
    expectThrow(() => createSource({ width, height, meshProfile: MESH_PROFILES.grid3, meshWeights: [0, 1, 2, 3] }),
        'createSource rejects a grid3 four-byte weight payload');
    check(parseSourceMetadata(mutateOnce(source, /name="GridMesh3"/u, 'name="UnknownMesh"')) === null,
        'unknown mesh name is rejected without fallback');
    check(parseSourceMetadata(mutateOnce(source, /triangleIndexBytes="[^"]+"/u, 'triangleIndexBytes="AAECAAID"')) === null,
        'grid3 quad triangle bytes are rejected');
    check(parseSourceMetadata(mutateOnce(source, /<MeshVertex\b/u, '<ContourMeshVertex')) === null,
        'grid3 center outline kind mutation is rejected');
    check(parseSourceMetadata(mutateOnce(source, /u="0\.5" v="0" name="TopCenter"/u, 'u="0.25" v="0" name="TopCenter"')) === null,
        'grid3 UV mutation is rejected');
    check(parseSourceMetadata(mutateOnce(source, /values="[0-9]+" indices="[0-9]+"\/>\s*<\/MeshVertex>/u, 'values="255" indices="513"/>\n                </MeshVertex>')) === null,
        'unsupported center packed weight is rejected');
    check(parseSourceMetadata(mutateOnce(source, /<MeshVertex[\s\S]*?<\/MeshVertex>/u, match => `${match}\n                <MeshVertex x="0" y="0" u="0.5" v="0.5" name="Extra"><Weight values="255" indices="1"/></MeshVertex>`)) === null,
        'extra grid vertex is rejected');
    return { source, customSource, metadata, customMetadata, customWeights };
}

function parseJsonEnvelope(output) {
    const trimmed = String(output || '').trim();
    if (trimmed) {
        try {
            return JSON.parse(trimmed);
        } catch {
            const firstBrace = trimmed.indexOf('{');
            const lastBrace = trimmed.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch { /* continue */ }
            }
        }
    }
    const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        try {
            const value = JSON.parse(lines[index]);
            if (value && typeof value === 'object') return value;
        } catch {
            // The CLI may print a human log before its final JSON envelope.
        }
    }
    return null;
}

function inspectNodes(value, output = []) {
    if (!value || typeof value !== 'object') return output;
    if (value.type) output.push(value);
    for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(entry => inspectNodes(entry, output));
        else if (child && typeof child === 'object') inspectNodes(child, output);
    }
    return output;
}

function runCli(cli, projectPath, args, label, environment, commandFirst = false) {
    const cliArgs = commandFirst ? [...args, projectPath] : [projectPath, ...args];
    const result = spawnSync(cli, cliArgs, {
        cwd: cacheRoot,
        env: environment,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 8,
    });
    const output = String(result.stdout || '');
    const error = String(result.stderr || '');
    const logRoot = path.join(projectPath, 'build', 'wp035-cli-logs');
    fs.mkdir(logRoot, { recursive: true }).catch(() => {});
    fs.writeFile(path.join(logRoot, `${label}.stdout.txt`), output, 'utf8').catch(() => {});
    fs.writeFile(path.join(logRoot, `${label}.stderr.txt`), error, 'utf8').catch(() => {});
    return {
        label,
        args: cliArgs,
        status: result.status,
        signal: result.signal || null,
        error: result.error ? String(result.error.message || result.error) : null,
        stdout: output,
        stderr: error,
        json: parseJsonEnvelope(output),
    };
}

async function writeProject(projectName, source, fixture) {
    const projectPath = path.join(cacheRoot, projectName);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'build'), { recursive: true });
    await fs.writeFile(path.join(projectPath, 'rive.yaml'), createRiveYaml(320, 200), 'utf8');
    await fs.writeFile(path.join(projectPath, 'scene.rml'), source, 'utf8');
    await fs.writeFile(path.join(projectPath, 'fixture.png'), fixture);
    return projectPath;
}

async function findRiv(projectPath) {
    const buildPath = path.join(projectPath, 'build');
    const entries = await fs.readdir(buildPath, { withFileTypes: true });
    const riv = entries.find(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.riv'));
    return riv ? path.join(buildPath, riv.name) : null;
}

async function verifyNative(cli, sourceInfo) {
    const fixture = createFixturePng(320, 200);
    const fixtureHash = sha256Bytes(fixture);
    const defaultProject = await writeProject('default-grid', sourceInfo.source, fixture);
    const mixedProject = await writeProject('mixed-grid', sourceInfo.customSource, fixture);
    const reloadProject = await writeProject('reload-grid', sourceInfo.customSource, fixture);
    const riveHome = path.join(cacheRoot, 'rive-home');
    await fs.mkdir(riveHome, { recursive: true });
    const environment = { ...process.env, RIVE_HOME: riveHome, RIVE_ANALYTICS: '0' };
    const runs = [];
    for (const [name, projectPath] of [['default', defaultProject], ['mixed', mixedProject], ['reload', reloadProject]]) {
        const verify = runCli(cli, projectPath, ['--verify', '--format=json'], `${name}-verify`, environment);
        const once = runCli(cli, projectPath, ['--once', '--format=json'], `${name}-once`, environment);
        const inspect = runCli(cli, projectPath, ['inspect', '--json'], `${name}-inspect`, environment, true);
        const screenshotPath = path.join(projectPath, 'build', `${name}-progress1.png`);
        const screenshot = runCli(cli, projectPath, [`--screenshot=${screenshotPath}`, '--advance=60'], `${name}-screenshot`, environment);
        runs.push({ name, projectPath, verify, once, inspect, screenshot });
        check(verify.status === 0 && verify.json?.success === true, `${name} native --verify succeeds`);
        check(once.status === 0 && once.json?.success === true, `${name} native --once succeeds`);
        check(inspect.status === 0 && Boolean(inspect.json?.artboards), `${name} native inspect succeeds`);
        check(screenshot.status === 0, `${name} native screenshot command succeeds`);
    }
    const receipts = [];
    for (const run of runs) {
        const mesh = inspectNodes(run.inspect.json).find(node => node.type === 'Mesh' && node.name === 'GridMesh3');
        check(mesh?.rig?.vertices === 9 && JSON.stringify(mesh.rig.triangles) === JSON.stringify(GRID_TRIANGLES),
            `${run.name} inspect reports 9 grid3 vertices and eight triangles`);
        const rivPath = await findRiv(run.projectPath);
        const screenshotPath = path.join(run.projectPath, 'build', `${run.name}-progress1.png`);
        const rivHash = rivPath ? await hashFile(rivPath) : null;
        let screenshotHash = null;
        try { screenshotHash = await hashFile(screenshotPath); } catch { /* native screenshot may be unavailable on this host */ }
        receipts.push({
            name: run.name,
            project: run.projectPath,
            sourceHash: await hashFile(path.join(run.projectPath, 'scene.rml')),
            fixtureHash,
            rivPath,
            rivHash,
            screenshotPath,
            screenshotHash,
            inspectMesh: mesh ? { vertices: mesh.rig.vertices, triangles: mesh.rig.triangles } : null,
        });
    }
    const defaultReceipt = receipts.find(receipt => receipt.name === 'default');
    const mixedReceipt = receipts.find(receipt => receipt.name === 'mixed');
    const reloadReceipt = receipts.find(receipt => receipt.name === 'reload');
    check(mixedReceipt?.sourceHash === reloadReceipt?.sourceHash, 'mixed source survives save into a separate reload directory');
    check(mixedReceipt?.rivHash && mixedReceipt.rivHash === reloadReceipt?.rivHash,
        'mixed source rebuild produces identical .riv bytes in a new CLI instance');
    check(mixedReceipt?.screenshotHash && reloadReceipt?.screenshotHash && mixedReceipt.screenshotHash === reloadReceipt.screenshotHash,
        'mixed source rebuild produces identical native progress-1 pixels');
    const pixelCompared = Boolean(defaultReceipt?.screenshotHash && mixedReceipt?.screenshotHash);
    check(!pixelCompared || defaultReceipt.screenshotHash !== mixedReceipt.screenshotHash,
        'middle/edge weight change produces a native progress-1 pixel difference');
    const native = {
        status: runs.every(run => run.verify.status === 0 && run.once.status === 0 && run.inspect.status === 0) ? 'PASS' : 'FAIL',
        pixelComparison: pixelCompared ? (defaultReceipt.screenshotHash !== mixedReceipt.screenshotHash ? 'PASS' : 'FAIL') : 'UNVERIFIED',
        runs: runs.map(run => ({
            name: run.name,
            verify: { status: run.verify.status, json: run.verify.json },
            once: { status: run.once.status, json: run.once.json },
            inspect: { status: run.inspect.status, json: run.inspect.json },
            screenshot: { status: run.screenshot.status, json: run.screenshot.json },
        })),
        receipts,
    };
    await writeJson(path.join(cacheRoot, 'native-grid-receipt.json'), native);
    return native;
}

await fs.mkdir(cacheRoot, { recursive: true });
const fixedCache = await verifyFixedCache({ workRoot, cacheRoot });
check(fixedCache.ok, `fixed CLI/runtime cache gate: ${fixedCache.reason || 'unknown'}`);
verifyMeshProfileModel();
const quadCompatibility = await verifyQuadCompatibility();
const sourceInfo = verifyGridSource();
const browserFixture = await verifyBrowserFixture();
await verifyGridDraftController();
await verifyBStaticWiring();
let native = { status: 'UNVERIFIED', reason: 'fixed cache unavailable' };
if (fixedCache.ok && sourceInfo) {
    native = await verifyNative(fixedCache.paths?.cli || path.join(workRoot, '.cache', 'rive-authoring-proof', 'cli-1.3.0', 'rive.exe'), sourceInfo);
}
const result = {
    schema: 'tegaki.rive-editor.grid-verification.v1',
    status: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    fixedCache,
    quadCompatibility,
    browserFixture,
    gridDraft: 'controller/static checks included above',
    grid: sourceInfo ? {
        meshProfile: sourceInfo.metadata?.meshProfile,
        vertexCount: sourceInfo.metadata?.vertexCount,
        triangleCount: sourceInfo.metadata?.triangleCount,
        triangleIndexBytes: triangleIndexBytesForProfile(MESH_PROFILES.grid3),
        defaultWeights: sourceInfo.metadata?.meshWeights,
        customWeights: sourceInfo.customWeights,
    } : null,
    native,
    browser: 'UNVERIFIED — wp035-rive-grid-browser.html requires trusted visible inspection',
    owner: 'UNVERIFIED — Owner acceptance is outside Slice A/B verifier',
};
await writeJson(path.join(cacheRoot, 'wp035-grid-verification.json'), result);
if (failures.length) {
    console.error(`verify-rive-editor-grid: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-editor-grid: PASS (checks=${checks.length}; native=${native.status}; pixels=${native.pixelComparison || 'UNVERIFIED'}; browser=UNVERIFIED)`);
}

