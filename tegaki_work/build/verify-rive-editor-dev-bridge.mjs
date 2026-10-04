/**
 * ROLE: WP-031 dev companion/bridge の限定 verifier。
 * AUTHORITY: HTTP/process境界の証拠だけ。製品host、Project、History、UIは所有しない。
 * INVARIANTS: statusはspawnしない、ensureは空body+nonce+same-origin、他者portを停止しない。
 * RELATED: advanced/rive-editor/dev-companion.mjs、rive-editor-dev-bridge.mjs、WP-031。
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
    CONNECTION_SCHEMA,
    RIVE_EDITOR_APP,
    RIVE_EDITOR_HOST,
    RIVE_EDITOR_ORIGIN,
    RIVE_EDITOR_PORT,
    createRiveEditorDevCompanion,
    fixedCachePaths,
    probeRiveEditorHealth,
    validateRiveEditorHealth,
    verifyFixedCache
} from '../advanced/rive-editor/dev-companion.mjs';
import {
    RIVE_EDITOR_CONNECTION_SCHEMA,
    RIVE_EDITOR_DEV_BRIDGE_PREFIX,
    RIVE_EDITOR_NONCE_HEADER,
    createRiveEditorDevBridgePlugin,
    handleRiveEditorDevBridgeRequest
} from './rive-editor-dev-bridge.mjs';

const failures = [];
const checks = [];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = path.join(root, 'tegaki_work', '.cache', 'rive-editor');

function check(condition, message) {
    if (!condition) failures.push(message);
    checks.push({ message, ok: Boolean(condition) });
}

function fakeResponse(req) {
    const headers = new Map();
    return {
        req,
        statusCode: 0,
        body: Buffer.alloc(0),
        headers,
        setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
        removeHeader(name) { headers.delete(String(name).toLowerCase()); },
        getHeader(name) { return headers.get(String(name).toLowerCase()); },
        end(body) { this.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body); this.ended = true; }
    };
}

function fakeRequest(url, overrides = {}) {
    const req = new EventEmitter();
    req.url = url;
    req.method = overrides.method || 'GET';
    req.headers = {
        host: '127.0.0.1:5173',
        origin: 'http://127.0.0.1:5173',
        ...(overrides.headers || {})
    };
    req.socket = { remoteAddress: overrides.remoteAddress || '127.0.0.1' };
    req.resume = () => {};
    const body = Buffer.isBuffer(overrides.body) ? overrides.body : Buffer.from(overrides.body || '');
    queueMicrotask(() => { if (body.length) req.emit('data', body); req.emit('end'); });
    return req;
}

async function bridgeRequest(state, url, overrides = {}) {
    const req = fakeRequest(url, overrides);
    const res = fakeResponse(req);
    let nextCalled = false;
    await handleRiveEditorDevBridgeRequest(req, res, () => { nextCalled = true; }, state);
    return { req, res, nextCalled, json: res.body.length ? JSON.parse(res.body) : null };
}

function fakeChild(pid) {
    const child = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.killCount = 0;
    child.kill = () => { child.killCount += 1; child.exitCode = 0; child.emit('exit', 0, null); return true; };
    return child;
}

async function tempReceipt(name) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), `tegaki-wp031-${name}-`));
    tempDirs.push(directory);
    return { directory, receiptPath: path.join(directory, 'receipt.json') };
}

async function verifyStaticAndFakeBoundary() {
    check(CONNECTION_SCHEMA === RIVE_EDITOR_CONNECTION_SCHEMA, 'bridge and companion schemas differ');
    check(RIVE_EDITOR_DEV_BRIDGE_PREFIX === '/__tegaki/rive-editor', 'bridge prefix changed');
    check(RIVE_EDITOR_PORT === 18729 && RIVE_EDITOR_ORIGIN === 'http://127.0.0.1:18729', 'fixed editor endpoint changed');
    check(validateRiveEditorHealth({ app: RIVE_EDITOR_APP, protocol: 1, installationId: 'a'.repeat(64), pid: 1 }).ok, 'valid health identity rejected');
    check(!validateRiveEditorHealth({ app: 'other', protocol: 1, installationId: 'a'.repeat(64), pid: 1 }).ok, 'foreign health identity accepted');

    let statusCalls = 0;
    let ensureCalls = 0;
    const fakeCompanion = {
        status() { statusCalls += 1; return { schema: CONNECTION_SCHEMA, phase: 'idle', reason: 'not-started' }; },
        async ensure() { ensureCalls += 1; return { schema: CONNECTION_SCHEMA, phase: 'ready', reason: 'started', editorOrigin: RIVE_EDITOR_ORIGIN }; },
        async close() {}
    };
    const bridgeState = { companion: fakeCompanion, nonce: 'wp031-test-nonce' };
    const idle = await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/status`);
    check(idle.res.statusCode === 200 && idle.json.phase === 'idle' && statusCalls === 1 && ensureCalls === 0, 'status read spawned or returned the wrong phase');
    check(!Object.hasOwn(idle.json, 'editorOrigin') && idle.json.nonce === bridgeState.nonce, 'idle status leaked ready data or lost nonce');
    const ensured = await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'POST', headers: { [RIVE_EDITOR_NONCE_HEADER]: bridgeState.nonce } });
    check(ensured.res.statusCode === 200 && ensured.json.phase === 'ready' && ensured.json.editorOrigin === RIVE_EDITOR_ORIGIN && ensureCalls === 1, 'valid ensure did not return ready editor origin');
    check(!ensured.res.getHeader('access-control-allow-origin'), 'bridge added CORS headers');
    const rejected = [
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/status?x=1`), 400, 'query was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'POST', headers: { [RIVE_EDITOR_NONCE_HEADER]: 'bad' } }), 403, 'bad nonce was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'POST', headers: { [RIVE_EDITOR_NONCE_HEADER]: bridgeState.nonce }, body: Buffer.from('{}') }), 400, 'non-empty body was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'POST', headers: { [RIVE_EDITOR_NONCE_HEADER]: bridgeState.nonce }, body: Buffer.alloc(1025, 1) }), 413, 'oversized body was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'GET', headers: { [RIVE_EDITOR_NONCE_HEADER]: bridgeState.nonce } }), 405, 'wrong ensure method was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/status`, { remoteAddress: '192.168.1.2' }), 403, 'non-loopback status was accepted'],
        [await bridgeRequest(bridgeState, `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`, { method: 'POST', headers: { origin: 'http://127.0.0.1:5174', [RIVE_EDITOR_NONCE_HEADER]: bridgeState.nonce } }), 403, 'foreign origin was accepted']
    ];
    for (const [result, code, message] of rejected) check(result.res.statusCode === code, message);
    const unrelated = await bridgeRequest(bridgeState, '/other');
    check(unrelated.nextCalled, 'unrelated request did not pass to the next middleware');

    const plugin = createRiveEditorDevBridgePlugin({ companion: fakeCompanion, nonce: bridgeState.nonce });
    check(plugin.apply === 'serve' && plugin.name === 'tegaki-rive-editor-dev-bridge', 'bridge plugin is not serve-only');
    let middlewareCalls = 0;
    let closeHandler = null;
    plugin.configureServer({
        config: { server: { host: '127.0.0.1' } },
        middlewares: { use() { middlewareCalls += 1; } },
        httpServer: { once(event, callback) { if (event === 'close') closeHandler = callback; } }
    });
    check(middlewareCalls === 1 && typeof closeHandler === 'function', 'loopback bridge middleware/close hook missing');
    let externalRejected = false;
    try { plugin.configureServer({ config: { server: { host: '0.0.0.0' } }, middlewares: { use() { throw new Error('must not register'); } } }); } catch { externalRejected = true; }
    check(externalRejected, 'external Vite host was not rejected');
}

async function verifyCompanionStateMachine() {
    const fixed = await verifyFixedCache();
    check(fixed.ok, `fixed cache gate did not pass: ${fixed.reason || 'unknown'}`);
    if (!fixed.ok) return { fixed, native: { status: 'HOLD', reason: fixed.reason } };
    const id = fixed.installationId;

    const receipt = await tempReceipt('single-flight');
    const child = fakeChild(9011);
    let spawnCount = 0;
    let started = false;
    const single = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        receiptPath: receipt.receiptPath,
        verifyCache: async () => ({ ok: true, reason: 'cache-valid' }),
        probeHealth: async () => started ? { kind: 'health', health: { app: RIVE_EDITOR_APP, protocol: 1, installationId: id, pid: child.pid } } : { kind: 'free' },
        spawnChild: async () => { spawnCount += 1; started = true; return { child, pid: child.pid }; },
        sleep: async () => {}
    });
    const [one, two, three] = await Promise.all([single.ensure(), single.ensure(), single.ensure()]);
    check(one.phase === 'ready' && two.phase === 'ready' && three.phase === 'ready' && one.editorOrigin === RIVE_EDITOR_ORIGIN, 'single-flight ensure did not resolve ready');
    check(spawnCount === 1, `single-flight spawned ${spawnCount} children`);
    await single.close();
    check(child.killCount === 1, 'close did not stop the own child exactly once');
    const stoppedReceipt = JSON.parse(await fs.readFile(receipt.receiptPath, 'utf8'));
    check(stoppedReceipt.event === 'stopped' && stoppedReceipt.owned === true && stoppedReceipt.stopReason === 'vite-close', 'own stop receipt is incomplete');

    const reusedReceipt = await tempReceipt('reuse');
    const reusedChild = fakeChild(9012);
    const reused = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        receiptPath: reusedReceipt.receiptPath,
        verifyCache: async () => ({ ok: true, reason: 'cache-valid' }),
        probeHealth: async () => ({ kind: 'health', health: { app: RIVE_EDITOR_APP, protocol: 1, installationId: id, pid: reusedChild.pid } }),
        spawnChild: async () => { throw new Error('reused server must not spawn'); }
    });
    const reusedState = await reused.ensure();
    check(reusedState.phase === 'ready' && reusedState.reason === 'reused', 'same-installation health was not reused');
    await reused.close();
    check(reusedChild.killCount === 0, 'reused service was stopped by bridge close');
    const reuseReceipt = JSON.parse(await fs.readFile(reusedReceipt.receiptPath, 'utf8'));
    check(reuseReceipt.event === 'reused-close' && reuseReceipt.owned === false && reuseReceipt.stopped === false, 'reuse stop receipt claimed ownership');

    let recoverySpawn = 0;
    let recoveryPhase = 'initial-free';
    const recoveryFirst = fakeChild(9013);
    const recoverySecond = fakeChild(9014);
    const recovery = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        verifyCache: async () => ({ ok: true, reason: 'cache-valid' }),
        probeHealth: async () => {
            if (recoveryPhase === 'initial-free') return { kind: 'free' };
            if (recoveryPhase === 'lost') return { kind: 'free' };
            const child = recoverySpawn === 1 ? recoveryFirst : recoverySecond;
            return { kind: 'health', health: { app: RIVE_EDITOR_APP, protocol: 1, installationId: id, pid: child.pid } };
        },
        spawnChild: async () => { recoverySpawn += 1; recoveryPhase = 'ready'; return { child: recoverySpawn === 1 ? recoveryFirst : recoverySecond, pid: recoverySpawn === 1 ? recoveryFirst.pid : recoverySecond.pid }; },
        sleep: async () => {}
    });
    const recoveryInitial = await recovery.ensure();
    check(recoveryInitial.phase === 'ready' && recovery.debugSnapshot().active?.owned === true, 'recovery fixture did not start an owned child');
    recoveryFirst.exitCode = 0;
    recoveryPhase = 'lost';
    const recovered = await recovery.ensure();
    check(recovered.phase === 'ready' && recoverySpawn === 2 && recovery.debugSnapshot().active?.owned === true && recovery.debugSnapshot().active?.pid === recoverySecond.pid, 'reused/owned server loss did not recover with a new own child');
    await recovery.close();
    check(recoverySecond.killCount === 1, 'recovered own child was not stopped at close');

    let mismatchReuseSpawn = 0;
    const mismatchReuse = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        verifyCache: async () => ({ ok: false, reason: 'cache-hash-mismatch' }),
        probeHealth: async () => ({ kind: 'health', health: { app: RIVE_EDITOR_APP, protocol: 1, installationId: id, pid: 9015 } }),
        spawnChild: async () => { mismatchReuseSpawn += 1; return { child: fakeChild(9015), pid: 9015 }; }
    });
    const mismatchReuseState = await mismatchReuse.ensure();
    check(mismatchReuseState.phase === 'error' && mismatchReuseState.reason === 'cache-hash-mismatch' && mismatchReuseSpawn === 0, 'reuse with SDK hash mismatch was reported ready or spawned');
    await mismatchReuse.close();

    let mismatchSpawn = 0;
    const mismatch = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        verifyCache: async () => ({ ok: true }),
        probeHealth: async () => ({ kind: 'health', health: { app: RIVE_EDITOR_APP, protocol: 1, installationId: 'b'.repeat(64), pid: 9020 } }),
        spawnChild: async () => { mismatchSpawn += 1; return { child: fakeChild(9020), pid: 9020 }; }
    });
    const mismatchState = await mismatch.ensure();
    check(mismatchState.phase === 'error' && mismatchState.reason === 'editor-port-occupied-other-installation' && mismatchSpawn === 0, 'other-installation port was not refused without spawn');
    await mismatch.close();

    let unknownSpawn = 0;
    const unknown = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        verifyCache: async () => ({ ok: true }),
        probeHealth: async () => ({ kind: 'occupied', reason: 'editor-port-occupied-unknown-health' }),
        spawnChild: async () => { unknownSpawn += 1; return { child: fakeChild(9021), pid: 9021 }; }
    });
    const unknownState = await unknown.ensure();
    check(unknownState.phase === 'error' && unknownState.reason === 'editor-port-occupied-unknown-health' && unknownSpawn === 0, 'unknown port occupant was not refused without spawn');
    await unknown.close();

    let missingSpawn = 0;
    const missing = createRiveEditorDevCompanion({
        workRoot: path.join(root, 'tegaki_work'),
        cacheRoot: cache,
        verifyCache: async () => ({ ok: false, reason: 'cache-unavailable' }),
        probeHealth: async () => ({ kind: 'free' }),
        spawnChild: async () => { missingSpawn += 1; return { child: fakeChild(9022), pid: 9022 }; }
    });
    const missingState = await missing.ensure();
    check(missingState.phase === 'error' && missingState.reason === 'cache-unavailable' && missingSpawn === 0, 'missing SDK/cache did not fail closed before spawn');
    await missing.close();

    return { fixed, native: { status: 'STATIC-FAKE-PASS', installationId: id, receipt: stoppedReceipt } };
}

function requestJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const request = http.request(url, options, response => {
            const chunks = [];
            response.setEncoding('utf8');
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                let body = null;
                try { body = JSON.parse(chunks.join('')); } catch {}
                resolve({ statusCode: response.statusCode, body });
            });
        });
        request.on('error', reject);
        request.end();
    });
}

async function verifyNativeCompanion(fixed) {
    if (!fixed.ok) return { status: 'HOLD', reason: fixed.reason, hashes: fixed.hashes || null };
    const initial = await probeRiveEditorHealth();
    if (initial.kind !== 'free') return { status: 'HOLD', reason: initial.reason || 'editor-port-occupied', observed: initial };
    let companion = null;
    let reused = null;
    let debug = null;
    try {
        companion = createRiveEditorDevCompanion();
        const states = await Promise.all([companion.ensure(), companion.ensure(), companion.ensure()]);
        check(states.every(value => value.phase === 'ready' && value.editorOrigin === RIVE_EDITOR_ORIGIN), 'native ensure did not become ready');
        debug = companion.debugSnapshot();
        check(debug.active?.owned === true && Number.isInteger(debug.active?.pid), 'native companion did not record own child ownership');
        const healthResponse = await requestJson(`http://${RIVE_EDITOR_HOST}:${RIVE_EDITOR_PORT}/health`);
        check(healthResponse.statusCode === 200 && healthResponse.body?.app === RIVE_EDITOR_APP && healthResponse.body?.protocol === 1, 'native health JSON is incomplete');
        check(healthResponse.body?.installationId === fixed.installationId && healthResponse.body?.pid === debug.active.pid, 'native health identity did not match child receipt');
        reused = createRiveEditorDevCompanion();
        const reusedState = await reused.ensure();
        check(reusedState.phase === 'ready' && reusedState.reason === 'reused', 'native second companion did not reuse identified service');
        await reused.close();
        const stillReady = await probeRiveEditorHealth();
        check(stillReady.kind === 'health', 'reused service was stopped by non-owner close');
        return { status: 'PASS', installationId: fixed.installationId, pid: debug.active.pid, health: healthResponse.body, stopped: true, receipt: debug.receiptPath };
    } finally {
        if (reused) await reused.close();
        if (companion) await companion.close();
        const stopped = await probeRiveEditorHealth();
        if (stopped.kind !== 'free') failures.push('own companion child did not stop at close');
    }
}

const tempDirs = [];
let fakeResult;
let nativeResult;
try {
    await verifyStaticAndFakeBoundary();
    fakeResult = await verifyCompanionStateMachine();
    nativeResult = await verifyNativeCompanion(fakeResult.fixed);
} catch (error) {
    failures.push(`verifier-exception:${error?.message || error}`);
    nativeResult = { status: 'HOLD', reason: 'verifier-exception' };
} finally {
    for (const directory of tempDirs) await fs.rm(directory, { recursive: true, force: true });
}

const result = {
    schema: 'tegaki.rive-editor.dev-bridge-verification.v1',
    static: failures.length ? 'FAIL' : 'PASS',
    checks: checks.length,
    failures,
    fixedCache: fakeResult?.fixed || null,
    fakeBoundary: fakeResult?.native || null,
    native: nativeResult
};
await fs.mkdir(cache, { recursive: true });
await fs.writeFile(path.join(cache, 'wp031-dev-bridge-verification.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
    console.error(`verify-rive-editor-dev-bridge: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log(`verify-rive-editor-dev-bridge: PASS (checks=${checks.length}; native=${nativeResult?.status || 'HOLD'}; cache=${fakeResult?.fixed?.reason || 'unknown'})`);
    console.log(JSON.stringify(result, null, 2));
}
