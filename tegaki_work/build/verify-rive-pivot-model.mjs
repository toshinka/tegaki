/**
 * ROLE: WP-038 pivot/source/parser/APIの限定fixture検証と独立cacheでの公式CLI再build。
 * AUTHORITY: pure/static/offline handler fixtureとCLI verify/once/inspectの証拠だけ。
 * INVARIANTS: 稼働server/browserを操作せず、SDK hash gate、source唯一正本、中央bytes、bind拒否を確認。
 * RELATED: pivot-model.mjs、model.mjs、server.mjs、WP-038-rive-pivot-authoring.md。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as model from '../advanced/rive-editor/model.mjs';
import * as pivotModel from '../advanced/rive-editor/pivot-model.mjs';
import * as weights from '../advanced/rive-editor/weight-model.mjs';
import * as profiles from '../advanced/rive-editor/mesh-profile.mjs';
import { verifyFixedCache, fixedCachePaths } from '../advanced/rive-editor/dev-companion.mjs';

const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(work, '.cache', 'rive-editor', 'wp038', 'backend');
fs.mkdirSync(cache, { recursive: true });
const checks = [];
function check(value, message) {
    checks.push({ ok: Boolean(value), message });
    if (!value) throw new Error(message);
}
function rejects(callback, message) {
    let rejected = false;
    try { callback(); } catch { rejected = true; }
    check(rejected, message);
}
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const { assertPivot, defaultPivot, scalePivot } = pivotModel;
const { createSource, parseSourceMetadata, makeSnapshot, sha256Bytes, sha256Text } = model;
const invalidPivots = [null, '', '5', 5, [], true, {}, { x: 5 }, { y: 5 }, { x: '5', y: 5 },
    { x: 5, y: '' }, { x: NaN, y: 5 }, { x: 5, y: Infinity }, { x: -0.0001, y: 5 },
    { x: 320.0001, y: 5 }, { x: 5, y: -1 }, { x: 5, y: 201 }];
check(same(defaultPivot(321, 201), { x: 160.5, y: 100.5 }), 'odd dimensions retain exact default center');
check(same(assertPivot(undefined, 320, 200), { x: 160, y: 100 }), 'undefined alone defaults to center');
for (const invalid of invalidPivots) rejects(() => assertPivot(invalid, 320, 200), `reject pivot ${JSON.stringify(invalid)}`);
check(same(assertPivot({ x: 0, y: 200 }, 320, 200), { x: 0, y: 200 }), 'inclusive image edges accepted');
check(same(assertPivot({ x: 5.12349, y: 6.45678 }, 320, 200), { x: 5.123, y: 6.457 }), 'pivot normalizes to three decimals');
check(same(scalePivot({ x: 80, y: 50 }, 320, 200, 300, 180), { x: 75, y: 45 }), 'PNG replacement preserves normalized ratio');
check(same(scalePivot({ x: 320, y: 0 }, 320, 200, 301, 181), { x: 301, y: 0 }), 'PNG replacement preserves endpoints');
for (const dimensions of [[0, 200], [320, 0], [3.5, 20], [320, Infinity]]) {
    rejects(() => defaultPivot(...dimensions), `invalid image dimensions ${dimensions}`);
}

const defaultHashes = {
    "quad-320x200-30.rml": "641bca389046a15ada8e93f6673a48d1842505b7d0c8de52edace387cd512905",
    "quad-320x200-56.rml": "81ac772ec6c179a344e0b0f824cc338bd360a46ebc00ebc83b95929d55a5d9f9",
    "quad-320x200--90.rml": "4a971c3b3149f52128efac9ea64f2f36a6ab2becc1581044ec44af4322e319c3",
    "quad-320x200-90.rml": "65cd8c8bcf1b8da24b84273c32910241a4efc00baaa7a8420643983b5fac81fe",
    "grid3-320x200-30.rml": "59ef5a20199929eb1ab8a1f75d0caeda22b2d0c289c58ab2a04e7210ff836213",
    "grid3-320x200-56.rml": "e2f7a276019d05955bbaa0713ea5c210525e17970f8988ff68b2755aef68eedb",
    "grid3-320x200--90.rml": "0b3bf26a0f431ccf5d53d009b3d910d516bd926f409bcfa7840311de71800485",
    "grid3-320x200-90.rml": "cc6bbdd65d8e143fec0f532d4522c0b6bf032e9a7ae542872f18e7244d46d21c",
    "quad-300x180-30.rml": "0a189097d0108db693d40780a4d4d8c680152b884474aec79a7d3c823d6d1daf",
    "quad-300x180-56.rml": "276e588776bdbab33d75a6438153f947cca30f1f01fa2a9de41f93b4fcc7ddf9",
    "quad-300x180--90.rml": "c0d3dcfb8102275221528bf872df1c778840988910a5a0d185c7160c58abc32a",
    "quad-300x180-90.rml": "80ffcf3ca1fb4003654892c3cf5a09b5e736a8034954e8cec6ca53ede0202565",
    "grid3-300x180-30.rml": "5474856f42e41a6b9909ff723be9ad721579297429094689e62bbeddbfa3c115",
    "grid3-300x180-56.rml": "cb1a8e4f6fd21e1b8b205a6feb654fd76b5bb236433a0dbad8cdff7815abbe8a",
    "grid3-300x180--90.rml": "de9c96b79caf4bd837c0944065e5dc52ece86d5ee48bd572e280dbce6009bd99",
    "grid3-300x180-90.rml": "364fe423717d66523122c954f20b06f799b00bbb1cdfc24306e7f3a2933b59c1",
    "quad-321x201-30.rml": "c0541548d5e546f89ce94676bd89f5452a2e97638c2d4c923ec731a721e2e40f",
    "quad-321x201-56.rml": "7f05cac4f368a497146825a14bda50ea4fa01884711258584f7b9f45fdf0c412",
    "quad-321x201--90.rml": "551dda0b48d47e9b618a9a3d3751f9b9cbd02820cf40313d5e6002ea23029d13",
    "quad-321x201-90.rml": "d2e7628451478c5b600b2d5add4863ba9fec0a07de6813eb887d3d6345604738",
    "grid3-321x201-30.rml": "4d0ae6ebd66bcb4c35b300f0f20693fe2673f9e60f2ffba0dc9c47114a046d95",
    "grid3-321x201-56.rml": "8fc0bc76ec6638ba9d6c406796237595e2e8c85a2328fe98e41b0e0e088021e7",
    "grid3-321x201--90.rml": "409bf2c42f1c3e70085bd6692977d898b8afadcae07802efb6852d7c4eef2d9e",
    "grid3-321x201-90.rml": "eb85ed4cfe7614e9a87e49747f9f653e53827e797cc5fd2533c271ef7c48f18d",
    "quad-1x1-30.rml": "dd5a43bd70eb4f927009d61fc38b58f90be66ae9398858669dd250b008a1e5c5",
    "quad-1x1-56.rml": "9327799d0481c974c4bc79161de3646bf69fc19b26b5448c2eefa4073893bbc2",
    "quad-1x1--90.rml": "4a43221a2aa44d357a6961dcb0c88c924f3e4baa18ffa3f57da16b4dc94e38ef",
    "quad-1x1-90.rml": "9a93d43a4c2073bb275400c6f71e4bb76d4af1b9fd2240414686e88399fdd5fd",
    "grid3-1x1-30.rml": "34c361bf8d9ec1e482cbdc24e842a1920a57e2240f962d883aa2bad99589c703",
    "grid3-1x1-56.rml": "b44795df53ac5e47d099b54a074eb61289ddabf6a37ffcd2edb7b921f9930a88",
    "grid3-1x1--90.rml": "092a9c9ee7b579d045a28e2d8a97518e29d518993e3acb5b9fb8149851224754",
    "grid3-1x1-90.rml": "1cc62ce58da60aa2a7ad6a44942dc2d6b3b59b974c101c32d1d1d802e3fb0b45"
};
const baselines = [];
for (const [width, height] of [[320, 200], [300, 180], [321, 201], [1, 1]]) {
    for (const profile of ['quad', 'grid3']) for (const angle of [30, 56, -90, 90]) {
        const file = `${profile}-${width}x${height}-${angle}.rml`;
        baselines.push({ options: { width, height, profile, angle }, file, sha256: defaultHashes[file] });
    }
}
check(baselines.length === 32 && baselines.every(item => item.sha256), '32 captured pre-edit source hashes available');
for (const item of baselines) {
    const source = createSource(item.options);
    const savedPath = path.join(cache, 'baseline', item.file);
    check(sha256Text(source) === item.sha256 && (!fs.existsSync(savedPath) || source === fs.readFileSync(savedPath, 'utf8')),
        `default bytes unchanged ${item.file}`);
    check(Boolean(parseSourceMetadata(source)), `old central source parses ${item.file}`);
}
for (const profile of ['quad', 'grid3']) {
    for (const pivot of [{ x: 0, y: 0 }, { x: 320, y: 200 }, { x: 102.123, y: 63.456 }, { x: 160, y: 100 }]) {
        const source = createSource({ width: 320, height: 200, angle: 56, profile, pivot });
        const info = parseSourceMetadata(source);
        check(same(info?.pivot, pivot), `${profile} source roundtrip ${JSON.stringify(pivot)}`);
        check(Math.abs(info.rootX - (pivot.x - 160)) <= 1e-6 && info.rootY === pivot.y && info.boneLength === 160,
            `${profile} Root derived from pivot with fixed length`);
        check(info.centerAtRotationPivot === (profile === 'grid3' && pivot.x === 160 && pivot.y === 100),
            `${profile} centerAtRotationPivot derived from source`);
        const snapshot = makeSnapshot({ currentSource: source, meshProfile: profile, image: { width: 320, height: 200 }, pivot: { x: 1, y: 2 } });
        check(same(snapshot.pivot, pivot), 'snapshot ignores unrelated state pivot authority');
    }
}
check(makeSnapshot({ pivot: { x: 1, y: 2 }, image: { width: 320, height: 200 } }).pivot === null,
    'snapshot does not invent pivot without source');

const moved = createSource({ width: 320, height: 200, angle: 56, profile: 'grid3', pivot: { x: 102.123, y: 63.456 } });
const mutations = [
    [/x="-57.877" y="63.456"/, 'x="-56.877" y="63.456"', 'Root/rest bind mismatch'],
    [/<Bone[^>]*\/>/, '', 'missing End'],
    [/<Tendon[^>]*name="EndTendon"\/>/, '', 'missing EndTendon'],
    [/length="160" rotation="0"/, 'length="159" rotation="0"', 'Root length'],
    [/length="160" rotation="0.523599"/, 'length="159" rotation="0.523599"', 'End length'],
    [/rotation="0" name="Root"/, 'rotation="0.1" name="Root"', 'Root rotation'],
    [/rotation="0.523599" name="End"/, 'rotation="0.1" name="End"', 'End rest angle'],
    [/value="0.523599" interpolationType="linear" frame="0"/, 'value="0.1" interpolationType="linear" frame="0"', 'animation rest angle'],
    [/tx="-217.877"/, 'tx="-218.877"', 'RootTendon bind'],
    [/tx="-57.877"/, 'tx="-58.877"', 'EndTendon bind'],
    [/xx="0.8660254"/, 'xx="0.7"', 'EndTendon rest matrix'],
    [/boneId="0:41"/, 'boneId="0:40"', 'EndTendon bone identity'],
    [/<Skin tx="0"/, '<Skin tx="1"', 'Skin transform'],
    [/<Skin tx="0"/, '<Skin xx="2" tx="0"', 'Skin scale'],
    [/<\/Skin>/, '<Tendon boneId="0:40" tx="-217.877" ty="-36.544" name="RootTendon"/></Skin>', 'extra Tendon'],
    [/<\/Mesh>/, '<Skin tx="0" ty="0"/></Mesh>', 'extra Skin'],
    [/name="End" id="0:41"/, 'name="End" id="0:42"', 'End identity'],
    [/(<Tendon[^>]*name="RootTendon"\/>)(\s*)(<Tendon[^>]*name="EndTendon"\/>)/, '$3$2$1', 'Tendon order'],
    [/(<Bone[^>]*\/>)(\s*<\/RootBone>)/, '$2\n        $1', 'End moved outside Root'],
    [/<RootBone x=/, '<RootBone scaleX="2" x=', 'unknown Root transform'],
    [/<RootBone x=/, "<RootBone scaleX='2' x=", 'noncanonical Root attribute syntax'],
    [/<Bone length=/, '<Bone scaleY="2" length=', 'unknown End transform'],
    [/(<Skin\b[^>]*>[\s\S]*?<\/Skin>)(\s*<\/Mesh>)/, '$2\n                $1', 'Skin moved outside Mesh'],
    [/(<Skin\b[^>]*>[\s\S]*?<\/Skin>)/, '<Node name="BindWrapper">$1</Node>', 'Skin wrapped beneath Mesh'],
    [/(<Mesh\b[^>]*>[\s\S]*?<\/Mesh>)(\s*<\/Image>)/, '$2\n            $1', 'Mesh moved outside Image'],
];
for (const [pattern, replacement, label] of mutations) {
    const changed = moved.replace(pattern, replacement);
    check(changed !== moved && parseSourceMetadata(changed) === null, `parse rejects ${label}`);
}

// Execute the actual handler body offline; build/files/http are fixtures. This is not live API/native proof.
const serverPath = path.join(work, 'advanced', 'rive-editor', 'server.mjs');
const serverSource = fs.readFileSync(serverPath, 'utf8');
check(serverSource.includes("'/pivot-model.mjs'") && serverSource.includes("'/pivot-editor.js'"), 'static table exposes pure model/controller');
let handler;
let buildCalls = 0;
let failBuild = false;
let throwBuild = false;
const fileWrites = [];
const fakeFs = {
    realpathSync: { native: () => work }, existsSync: () => true,
    mkdirSync() {}, copyFileSync() {},
    writeFileSync: (file, bytes) => fileWrites.push({ file, bytes }),
};
const fakeServer = { on() {}, listen() {}, close() {} };
const sandbox = { ...model, ...pivotModel, ...weights, ...profiles, Buffer, URL, Date, crypto, path, fileURLToPath,
    fs: fakeFs, console, process: { env: {}, on() {} },
    http: { createServer(callback) { handler = callback; return fakeServer; } },
    fixtureBuild(source, imagePath) {
        buildCalls += 1;
        if (throwBuild) throw new Error('fixture internal CLI/server failure');
        if (failBuild) return { ok: false, phase: 'build', output: 'fixture CLI rejection' };
        const sourceInfo = parseSourceMetadata(source);
        return { ok: true, source, sourceInfo, imagePath, imageInfo: { width: sourceInfo.width, height: sourceInfo.height }, riv: 'fixture.riv' };
    },
};
let fixtureSource = serverSource.replace(/^import[\s\S]*?;\r?\n/gm, '')
    .replace('fileURLToPath(import.meta.url)', JSON.stringify(serverPath))
    .replace(/^initialBuild\(\);$/m, '')
    .replace(/function buildCandidate\(source, imagePath\) \{[\s\S]*?\n\}\r?\n\r?\nconst fixturePath/, 'function buildCandidate(source, imagePath) { return fixtureBuild(source, imagePath); }\n\nconst fixturePath');
fixtureSource += '\nglobalThis.fixture = { reset(value) { Object.assign(state, value); }, read() { return publicState(); }, nonce: STARTUP_NONCE };';
vm.runInNewContext(fixtureSource, sandbox, { filename: 'server-offline-fixture.js' });
check(typeof handler === 'function', 'actual server handler captured without listener/startup/build');
sandbox.fixture.reset({ status: 'ready', image: { name: 'fixture.png', width: 320, height: 200 }, currentSource: moved,
    currentImagePath: 'fixture.png', currentRiv: 'fixture.riv', meshProfile: 'grid3', meshWeights: parseSourceMetadata(moved).meshWeights,
    angle: 56, progress: 1, buildId: 'baseline-build', dirty: false, savedBuildId: 'saved-baseline', savedAngle: 56 });
async function request(route, body, origin = 'http://127.0.0.1:18729', nonce = sandbox.fixture.nonce, query = '') {
    const req = new EventEmitter();
    Object.assign(req, { method: 'POST', url: route + query, headers: { origin, 'x-editor-nonce': nonce }, resume() {} });
    let result;
    const res = { writeHead(status) { this.status = status; }, end(bytes) { result = { status: this.status, value: JSON.parse(bytes) }; } };
    const pending = handler(req, res);
    req.emit('data', Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    req.emit('end');
    await pending;
    return result;
}
const before = JSON.stringify(sandbox.fixture.read());
for (const pivot of invalidPivots) {
    const result = await request('/api/compile', { angle: 56, progress: 1, pivot });
    check(result.status === 400 && result.value.error === 'input-rejected', `offline invalid pivot400 ${JSON.stringify(pivot)}`);
    check(JSON.stringify(sandbox.fixture.read()) === before && buildCalls === 0 && fileWrites.length === 0,
        'invalid pivot preserves source/buildId/dirty/saved before any build/files');
}
check((await request('/api/compile', { angle: 56 }, 'http://evil.invalid')).status === 403 && buildCalls === 0, 'existing origin gate preserved');
check((await request('/api/compile', { angle: 56 }, undefined, 'wrong')).status === 403 && buildCalls === 0, 'existing nonce gate preserved');
const omit = await request('/api/compile', { angle: 60, progress: 0.75 });
check(omit.status === 200 && same(omit.value.snapshot.pivot, { x: 102.123, y: 63.456 }) && buildCalls === 1,
    'angle compile omitting pivot retains current-source pivot');
const quad = await request('/api/compile', { angle: 60, progress: 0.75, profile: 'quad' });
check(quad.status === 200 && same(quad.value.snapshot.pivot, omit.value.snapshot.pivot), 'profile compile retains pivot');
const reweight = await request('/api/compile', { angle: 60, progress: 0.75, weights: [0, 128, 255, 0] });
check(reweight.status === 200 && same(reweight.value.snapshot.pivot, omit.value.snapshot.pivot), 'weight compile retains pivot');
const explicit = await request('/api/compile', { angle: 60, progress: 0.75, pivot: { x: 80, y: 50 } });
check(explicit.status === 200 && same(explicit.value.snapshot.pivot, { x: 80, y: 50 }), 'explicit pivot compile changes source-derived snapshot');
const replaced = await request('/api/image', model.createFixturePng(300, 180), undefined, undefined, '?name=replacement.png');
check(replaced.status === 200 && same(replaced.value.snapshot.pivot, { x: 75, y: 45 }), 'actual image handler scales pivot into PNG replacement');
failBuild = true;
const goodState = JSON.stringify(sandbox.fixture.read());
check((await request('/api/compile', { angle: 60, pivot: { x: 40, y: 20 } })).status === 422
    && JSON.stringify(sandbox.fixture.read()) === goodState, 'CLI failure remains422 and preserves good source');
failBuild = false;
throwBuild = true;
check((await request('/api/compile', { angle: 60, pivot: { x: 40, y: 20 } })).status === 500
    && JSON.stringify(sandbox.fixture.read()) === goodState, 'internal failure remains500 and preserves good source');
const classifier = new Function(`${serverSource.match(/function isInputRejectedError\(error\) \{[\s\S]*?\n\}/)[0]}; return isInputRejectedError;`)();
check(!classifier({ message: 'Rive CLI/internal server failure' }), 'internal errors remain outside400 classifier');
const apiFixture = { kind: 'offline actual handler / build-files-http fixtures', invalidPivots: invalidPivots.length,
    beforeStateUnchanged: true, beforeBuildCalls: 0, liveApi: 'UNVERIFIED', buildCalls };

const gate = await verifyFixedCache({ workRoot: work, cacheRoot: cache });
check(gate.ok, `fixed SDK gate ${gate.reason}`);
const cli = fixedCachePaths(work, cache).cli;
const nativeRuns = [];
const fixturePng = model.createFixturePng();
function parseCliJson(text) {
    try { return JSON.parse(text); } catch {}
    for (const line of text.trim().split(/\r?\n/).reverse()) { try { return JSON.parse(line); } catch {} }
    return null;
}
function nodes(value, result = []) {
    if (!value || typeof value !== 'object') return result;
    if (value.type) result.push(value);
    for (const child of Object.values(value)) if (typeof child === 'object') nodes(child, result);
    return result;
}
for (const [name, options] of [
    ['central-quad', { profile: 'quad', angle: 56 }],
    ['central-grid', { profile: 'grid3', angle: 56 }],
    ['moved-rest', { profile: 'grid3', angle: 30, pivot: { x: 102.123, y: 63.456 } }],
    ['moved-end', { profile: 'grid3', angle: 56, pivot: { x: 102.123, y: 63.456 } }],
    ['moved-reload', { profile: 'grid3', angle: 56, pivot: { x: 102.123, y: 63.456 } }],
    ['edge-origin', { profile: 'quad', angle: 56, pivot: { x: 0, y: 0 } }],
    ['edge-limit', { profile: 'grid3', angle: 56, pivot: { x: 320, y: 200 } }],
]) {
    const project = path.join(cache, 'official-cli', name);
    fs.mkdirSync(path.join(project, 'build'), { recursive: true });
    const source = createSource({ width: 320, height: 200, ...options });
    fs.writeFileSync(path.join(project, 'scene.rml'), source);
    fs.writeFileSync(path.join(project, 'fixture.png'), fixturePng);
    fs.writeFileSync(path.join(project, 'rive.yaml'), model.createRiveYaml(320, 200));
    const commands = [];
    for (const [label, args] of [['verify', [project, '--verify', '--format=json']],
        ['once', [project, '--once', '--format=json']], ['inspect', ['inspect', project, '--json']]]) {
        const run = spawnSync(cli, args, { cwd: cache, env: { ...process.env, RIVE_HOME: path.join(cache, 'rive-home'), RIVE_ANALYTICS: '0' },
            windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
        fs.writeFileSync(path.join(project, `${label}.stdout.txt`), run.stdout || '');
        fs.writeFileSync(path.join(project, `${label}.stderr.txt`), run.stderr || '');
        check(run.status === 0, `${name} official ${label} exits0`);
        const json = parseCliJson(run.stdout || '');
        check(label === 'inspect' ? Boolean(json?.artboards) : json?.success === true, `${name} official ${label} JSON success`);
        commands.push({ label, args, status: run.status, stdoutHash: sha256Text(run.stdout || ''), json });
    }
    const inspect = commands.find(item => item.label === 'inspect').json;
    const mesh = nodes(inspect).find(item => item.type === 'Mesh');
    check(mesh?.rig?.vertices === (options.profile === 'quad' ? 4 : 9), `${name} official inspect topology`);
    const riv = path.join(project, 'build', 'tegaki_rive_editor.riv');
    nativeRuns.push({ name, project, options, sourceHash: sha256Text(source), imageHash: sha256Bytes(fixturePng),
        rivHash: sha256Bytes(fs.readFileSync(riv)), commands });
}
check(nativeRuns.find(item => item.name === 'moved-end').rivHash === nativeRuns.find(item => item.name === 'moved-reload').rivHash,
    'same source+PNG builds identical riv in a separate directory/new CLI');
const report = { schema: 'tegaki.rive-editor.pivot-model-verification.v1', status: 'PASS', checks: checks.length,
    evidenceTiers: { pure: 'PASS', static: 'PASS', offlineApiFixture: 'PASS', officialCli: 'PASS',
        liveApi: 'UNVERIFIED', browser: 'UNVERIFIED', nativePixels: 'UNVERIFIED', owner: 'UNVERIFIED' },
    checksDetail: checks, apiFixture, gate, baselines, nativeRuns };
fs.writeFileSync(path.join(cache, 'pivot-model-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`verify-rive-pivot-model: PASS (${checks.length} checks; official CLI 7 projects; Browser/native pixels UNVERIFIED)`);
