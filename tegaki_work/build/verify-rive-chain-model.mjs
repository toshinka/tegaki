/**
 * ROLE: WP-039追加接続の入力境界/旧source/代表3骨warpを確認する限定verifier。
 * AUTHORITY: pure/model/offline handler fixtureと公式CLI一代表の証拠だけ。Browser画素は司令。
 * INVARIANTS: live server操作0、fixed SDK、良好source保持、source唯一正本、engine網羅試験なし。
 * RELATED: chain-model.mjs、model.mjs、server.mjs、WP-039 card。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as model from '../advanced/rive-editor/model.mjs';
import * as chainModel from '../advanced/rive-editor/chain-model.mjs';
import * as pivotModel from '../advanced/rive-editor/pivot-model.mjs';
import * as weightModel from '../advanced/rive-editor/weight-model.mjs';
import * as meshModel from '../advanced/rive-editor/mesh-profile.mjs';
import { verifyFixedCache, fixedCachePaths } from '../advanced/rive-editor/dev-companion.mjs';
const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(work, '.cache', 'rive-editor', 'wp039', 'backend');
fs.mkdirSync(cache, { recursive: true });
const checks = [];
function check(condition, message) { checks.push({ ok: Boolean(condition), message }); if (!condition) throw new Error(message); }
function rejected(callback) { try { callback(); return false; } catch { return true; } }
const clone = value => structuredClone(value);
const { createSource, parseSourceMetadata, makeSnapshot, sha256Text, sha256Bytes } = model;
const { assertChain, createDefaultChain, resizeChain, CHAIN_RML_ORDER } = chainModel;
const chain = createDefaultChain(320, 200, 3);
chain.joints[1] = { x: 117.123, y: 83.456 };
chain.angles = [20, -35, 25];
chain.warp[22] = { x: 12, y: -8 };
const source = createSource({ width: 320, height: 200, chain });
const parsed = parseSourceMetadata(source);
check(JSON.stringify(parsed?.chain) === JSON.stringify(chain), 'bent fractional joints+angles+one warp canonical roundtrip');
check(parsed.vertexCount === 45 && parsed.triangleCount === 64 && parsed.meshProfile === 'chain-grid', 'fixed45vertices/64triangles');
check((source.match(/<ContourMeshVertex /g) || []).length === 24 && (source.match(/<MeshVertex /g) || []).length === 21,
    'outline24 precedes interior21');
check(new Set(CHAIN_RML_ORDER).size === 45 && CHAIN_RML_ORDER.slice(0, 9).join(',') === '0,1,2,3,4,5,6,7,8', 'RML remaps API row-major into perimeter order');
check((source.match(/propertyKey="15"/g) || []).length === 3 && (source.match(/propertyKey="24"/g) || []).length === 45
    && (source.match(/propertyKey="25"/g) || []).length === 45, 'native EndPose key15/24/25 tracks');
const snapshot = makeSnapshot({ currentSource: source, image: { width: 320, height: 200 }, angle: 20, meshProfile: 'chain-grid' });
check(snapshot.rigMode === 'chain' && snapshot.chain.angles[0] === 20 && snapshot.meshWeights === null, 'chain snapshot avoids legacy weight assertions');
const legacy = createSource({ width: 320, height: 200, angle: 56, pivot: { x: 90, y: 75 } });
check(parseSourceMetadata(legacy)?.rigMode === 'legacy' && parseSourceMetadata(legacy)?.pivot.x === 90, 'one legacy pivot source still readable');
const reversed = createDefaultChain(320, 200, 2); reversed.joints = [{ x: 320, y: 0 }, { x: 160, y: 0 }, { x: 0, y: 0 }];
check(Boolean(parseSourceMetadata(createSource({ width: 320, height: 200, chain: reversed }))), 'boundary horizontal reverse chain canonicalizes negative zero');
const resized = resizeChain(chain, 320, 200, 640, 400);
check(resized.joints[1].x === 234.246 && resized.warp[22].x === 24 && JSON.stringify(resized.weights) === JSON.stringify(chain.weights), 'resize scales joints/warp while angles/weights remain');
const canonical = clone(chain); canonical.weights[0] = { a: 0, b: 1, mix: 255 }; canonical.weights[1] = { a: 2, b: 2, mix: 123 };
check(assertChain(canonical, 320, 200).weights[0].a === 1 && assertChain(canonical, 320, 200).weights[1].mix === 0, 'endpoint and equal-bone weights canonicalize');
const invalid = [null, '', 1, {}, { ...chain, angles: [0] }, { ...chain, angles: Array(9).fill(0) }, { ...chain, joints: [] },
    { ...chain, warp: [] }, { ...chain, weights: [] }];
for (const [field, index, value] of [['angles', 0, '5'], ['angles', 0, 90.001], ['angles', 0, NaN], ['joints', 0, { x: -1, y: 5 }],
    ['joints', 0, { x: 5, y: 201 }], ['joints', 1, chain.joints[0]], ['warp', 0, { x: 321, y: 0 }],
    ['warp', 0, { x: 0, y: -201 }], ['warp', 0, { x: 0, y: '' }], ['weights', 0, { a: 0, b: 3, mix: 127 }],
    ['weights', 0, { a: 0, b: 1, mix: 1.5 }], ['weights', 0, null]]) {
    const bad = clone(chain); bad[field][index] = value; invalid.push(bad);
}
for (const value of invalid) check(rejected(() => assertChain(value, 320, 200)), 'invalid chain rejected before source/build');
for (const [pattern, replacement] of [[/tx="-128"/, 'tx="-127"'], [/propertyKey="24"/, 'propertyKey="25"'],
    [/indices="[0-9]+"/, 'indices="0"'], [/name="Joint2"/, 'name="WrongJoint"'],
    [/(<Skin[\s\S]*?<\/Skin>)/, '<Node name="Wrapper">$1</Node>']]) {
    check(source.replace(pattern, replacement) !== source && parseSourceMetadata(source.replace(pattern, replacement)) === null, 'noncanonical source structure/bind/weights/track rejected');
}

const serverFile = path.join(work, 'advanced', 'rive-editor', 'server.mjs');
const serverSource = fs.readFileSync(serverFile, 'utf8');
let handler; let buildCalls = 0; let failBuild = false;
const fileWrites = [];
const fakeFs = { realpathSync: { native: () => work }, existsSync: () => true, mkdirSync() {}, copyFileSync() {}, writeFileSync(file, bytes) { fileWrites.push({ file, bytes }); } };
const fakeServer = { on() {}, listen() {}, close() {} };
const sandbox = { ...model, ...chainModel, ...pivotModel, ...weightModel, ...meshModel, fs: fakeFs, path, crypto, Buffer, URL, Date, console, fileURLToPath,
    process: { env: {}, on() {} }, http: { createServer(callback) { handler = callback; return fakeServer; } },
    fixtureBuild(value, imagePath) { buildCalls += 1; if (failBuild) return { ok: false, phase: 'build', output: 'fixture failure' };
        const info = parseSourceMetadata(value); return { ok: true, source: value, sourceInfo: info, imagePath, imageInfo: { width: info.width, height: info.height }, riv: 'fixture.riv' }; } };
let offline = serverSource.replace(/^import[\s\S]*?;\r?\n/gm, '').replace('fileURLToPath(import.meta.url)', JSON.stringify(serverFile)).replace(/^initialBuild\(\);$/m, '')
    .replace(/function buildCandidate\(source, imagePath\) \{[\s\S]*?\n\}\r?\n\r?\nconst fixturePath/, 'function buildCandidate(source,imagePath) { return fixtureBuild(source,imagePath); }\n\nconst fixturePath');
offline += '\nglobalThis.fixture={reset(value){Object.assign(state,value);},read(){return publicState();},nonce:STARTUP_NONCE};';
vm.runInNewContext(offline, sandbox);
sandbox.fixture.reset({ status: 'ready', currentSource: legacy, currentImagePath: 'fixture.png', currentRiv: 'fixture.riv', image: { name: 'fixture.png', width: 320, height: 200 },
    buildId: 'good', savedBuildId: 'saved-good', angle: 56, progress: 1, dirty: false, meshProfile: 'quad', meshWeights: [0, 255, 255, 0] });
async function request(body, route = '/api/compile') {
    const req = new EventEmitter(); Object.assign(req, { method: 'POST', url: route, headers: { origin: 'http://127.0.0.1:18729', 'x-editor-nonce': sandbox.fixture.nonce }, resume() {} });
    let result; const res = { writeHead(status) { this.status = status; }, end(value) { result = { status: this.status, value: JSON.parse(value) }; } };
    const pending = handler(req, res); req.emit('data', Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))); req.emit('end'); await pending; return result;
}
const before = JSON.stringify(sandbox.fixture.read());
for (const bad of invalid) {
    check((await request({ chain: bad, progress: 1 })).status === 400, 'offline actual handler invalid chain400');
    check(JSON.stringify(sandbox.fixture.read()) === before && buildCalls === 0 && fileWrites.length === 0, 'invalid preserves good source/build/dirty/saved before CLI/files');
}
const compile = await request({ chain, progress: 0.5 });
check(compile.status === 200 && compile.value.snapshot.rigMode === 'chain' && compile.value.snapshot.progress === 0.5 && buildCalls === 1, 'chain handler promotes only successful candidate');
const good = JSON.stringify(sandbox.fixture.read());
check((await request({ angle: 30, profile: 'quad' })).status === 409 && buildCalls === 1 && JSON.stringify(sandbox.fixture.read()) === good, 'chain scene rejects legacy controls409 without mutation');
failBuild = true;
check((await request({ chain, progress: 1 })).status === 422 && JSON.stringify(sandbox.fixture.read()) === good, 'CLI failure422 preserves good chain');
failBuild = false;
const image = await request(model.createFixturePng(640, 400), '/api/image');
check(image.status === 200 && image.value.snapshot.chain.joints[1].x === resized.joints[1].x && image.value.snapshot.chain.warp[22].x === 24, 'actual image handler resizes chain');
check(serverSource.includes("'/': [path.join(HERE, 'workbench.html')") && serverSource.includes("'/editor.html'") && serverSource.includes("'/chain-model.mjs'"), 'workbench default route with legacy route/static helper retained');

const fixedCache = await verifyFixedCache({ workRoot: work, cacheRoot: cache });
check(fixedCache.ok, 'fixed CLI1.3.0/runtime2.44.0 hash gate');
const project = path.join(cache, 'representative-chain'); fs.mkdirSync(path.join(project, 'build'), { recursive: true });
fs.writeFileSync(path.join(project, 'scene.rml'), source); const png = model.createFixturePng(); fs.writeFileSync(path.join(project, 'fixture.png'), png);
fs.writeFileSync(path.join(project, 'rive.yaml'), model.createRiveYaml(320, 200));
const commands = [];
for (const [label, args] of [['verify', [project, '--verify', '--format=json']], ['once', [project, '--once', '--format=json']], ['inspect', ['inspect', project, '--json']]]) {
    const run = spawnSync(fixedCachePaths(work, cache).cli, args, { cwd: cache, env: { ...process.env, RIVE_HOME: path.join(cache, 'rive-home'), RIVE_ANALYTICS: '0' }, windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(path.join(project, `${label}.stdout.txt`), run.stdout || ''); fs.writeFileSync(path.join(project, `${label}.stderr.txt`), run.stderr || '');
    check(run.status === 0, `representative official ${label} exit0`);
    let json;
    try { json = JSON.parse(String(run.stdout || '').trim()); } catch {
        for (const line of String(run.stdout || '').trim().split(/\r?\n/).reverse()) { try { json = JSON.parse(line); break; } catch {} }
    }
    check(label === 'inspect' ? Boolean(json?.artboards) : json?.success === true, `representative ${label} JSON success`);
    commands.push({ label, args, status: run.status, json, stdoutHash: sha256Text(run.stdout || '') });
}
const inspect = commands.find(entry => entry.label === 'inspect').json;
const allNodes = []; function nodes(value) { if (!value || typeof value !== 'object') return; if (value.type) allNodes.push(value); for (const child of Object.values(value)) nodes(child); } nodes(inspect);
const mesh = allNodes.find(entry => entry.type === 'Mesh');
check(mesh?.rig?.vertices === 45 && mesh.rig.triangles.length === 64, 'official inspect45/64 topology');
const result = { status: 'PASS', checks: checks.length, checksDetail: checks, fixedCache, commands,
    representative: { project, chain, sourceHash: sha256Text(source), pngHash: sha256Bytes(png), rivHash: sha256Bytes(fs.readFileSync(path.join(project, 'build', 'tegaki_rive_editor.riv'))) },
    evidence: { pure: 'PASS', offlineHandler: 'PASS / build-files-http fixtures', officialCli: 'PASS / one representative', liveApi: 'UNVERIFIED', browser: 'UNVERIFIED', nativePixels: 'UNVERIFIED', owner: 'UNVERIFIED' } };
fs.writeFileSync(path.join(cache, 'chain-model-verification.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`verify-rive-chain-model PASS ${checks.length} checks; official CLI representative1; Browser/native pixels UNVERIFIED`);
