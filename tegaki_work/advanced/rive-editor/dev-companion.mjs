/**
 * ROLE: WP-031 の dev-only Rive editor companion。固定 cache を検査し、同一 installation の
 * loopback editor server だけを再利用する。
 * AUTHORITY: companion child の起動所有と cache receipt。editor の保存/History/renderer は所有しない。
 * INVARIANTS: HTTP入力からspawn引数を受けない、識別不能portを停止しない、single-flightとown-child停止を守る。
 * RELATED: server.mjs、build/rive-editor-dev-bridge.mjs、WP-031、WP-026固定cache。
 */
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const RIVE_EDITOR_HOST = '127.0.0.1';
export const RIVE_EDITOR_PORT = 18729;
export const RIVE_EDITOR_ORIGIN = `http://${RIVE_EDITOR_HOST}:${RIVE_EDITOR_PORT}`;
export const RIVE_EDITOR_APP = 'tegaki.rive-editor';
export const RIVE_EDITOR_PROTOCOL = 1;
export const CONNECTION_SCHEMA = 'tegaki.rive-editor.connection.v1';
export const DEFAULT_WORK = path.resolve(MODULE_DIR, '..', '..');
export const DEFAULT_SERVER = path.join(MODULE_DIR, 'server.mjs');
export const DEFAULT_CACHE = path.join(DEFAULT_WORK, '.cache', 'rive-editor');
export const DEFAULT_RECEIPT = path.join(DEFAULT_CACHE, 'dev-companion-receipt.json');

export const FIXED_CACHE = Object.freeze({
    cliVersion: 'rive 1.3.0',
    cliSha256: '285532569626250849FEABA584080F99FAEBB7641E0D2155EF9B1F2348D7D4B9',
    cliArchiveSha256: 'F83AC81A28C53668BD4193579DC636F0286BDD044CF6B3F7393A199764F5AEEF',
    runtimeArchiveSha512: '1fVyM25yryj4ryjkU9Wpen6c5RlVBeEqLwwUZkvNC+sMoYuZ7vH7cjvHh49dZOW9ODay6feRs0q3X5TGpKw7qA==',
    servedRuntimeSha256: Object.freeze({
        canvasAdvancedMjs: '8F9F93340C29D60370C941D706DD1542596D61D4E076A7B52DC629DF7608D7B9',
        riveWasm: 'A8E6E11A827FCDF49AA141606EB158E29CBB72E95337DD962B724F1823690A74',
        fallbackWasm: 'A365794008237E20B9CA922291FD8B1B966C174AC21A8DA7B48C34F2D83F93A5'
    })
});

function sha256Text(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashFile(filePath, algorithm, encoding) {
    const hash = crypto.createHash(algorithm);
    hash.update(fsSync.readFileSync(filePath));
    return hash.digest(encoding);
}

export function fixedCachePaths(workRoot = DEFAULT_WORK, cacheRoot = path.join(workRoot, '.cache', 'rive-editor')) {
    const work = path.resolve(workRoot);
    const proofCache = path.join(work, '.cache', 'rive-authoring-proof');
    const cache = path.resolve(cacheRoot);
    return Object.freeze({
        work,
        cache,
        cli: path.join(proofCache, 'cli-1.3.0', 'rive.exe'),
        cliArchive: path.join(work, '.cache', 'rig-reassessment', 'rive-1.3.0-docs-source.tar.gz'),
        runtimeArchive: path.join(proofCache, 'canvas-advanced-2.44.0.tgz'),
        runtime: {
            canvasAdvancedMjs: path.join(proofCache, 'runtime-2.44.0', 'package', 'canvas_advanced.mjs'),
            riveWasm: path.join(proofCache, 'runtime-2.44.0', 'package', 'rive.wasm'),
            fallbackWasm: path.join(proofCache, 'runtime-2.44.0', 'package', 'rive_fallback.wasm')
        },
        riveHome: path.join(cache, 'rive-home')
    });
}

function cacheFailure(reason, failures = []) {
    return { ok: false, reason, failures };
}

export async function verifyFixedCache(options = {}) {
    const paths = fixedCachePaths(options.workRoot || DEFAULT_WORK, options.cacheRoot);
    const failures = [];
    const files = [
        ['cli', paths.cli],
        ['cliArchive', paths.cliArchive],
        ['runtimeArchive', paths.runtimeArchive],
        ['canvasAdvancedMjs', paths.runtime.canvasAdvancedMjs],
        ['riveWasm', paths.runtime.riveWasm],
        ['fallbackWasm', paths.runtime.fallbackWasm]
    ];
    for (const [label, filePath] of files) {
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) failures.push(`${label}-missing`);
        } catch {
            failures.push(`${label}-missing`);
        }
    }
    if (failures.length) return cacheFailure('cache-unavailable', failures);

    let realWork;
    try {
        realWork = await fs.realpath(paths.work);
    } catch {
        return cacheFailure('installation-unavailable', ['work-realpath']);
    }
    const hashes = {};
    try {
        hashes.cliSha256 = hashFile(paths.cli, 'sha256', 'hex').toUpperCase();
        hashes.cliArchiveSha256 = hashFile(paths.cliArchive, 'sha256', 'hex').toUpperCase();
        hashes.runtimeArchiveSha512 = hashFile(paths.runtimeArchive, 'sha512', 'base64');
        for (const [label, filePath] of Object.entries(paths.runtime)) hashes[label] = hashFile(filePath, 'sha256', 'hex').toUpperCase();
    } catch {
        return cacheFailure('cache-unavailable', ['hash-read']);
    }
    if (hashes.cliSha256 !== FIXED_CACHE.cliSha256) failures.push('cli-sha256-mismatch');
    if (hashes.cliArchiveSha256 !== FIXED_CACHE.cliArchiveSha256) failures.push('cli-archive-sha256-mismatch');
    if (hashes.runtimeArchiveSha512 !== FIXED_CACHE.runtimeArchiveSha512) failures.push('runtime-archive-sha512-mismatch');
    for (const [label, expected] of Object.entries(FIXED_CACHE.servedRuntimeSha256)) {
        if (hashes[label] !== expected) failures.push(`${label}-sha256-mismatch`);
    }
    if (failures.length) return cacheFailure('cache-hash-mismatch', failures);

    const version = spawnSync(paths.cli, ['--version'], {
        cwd: paths.cache,
        env: { ...process.env, RIVE_HOME: paths.riveHome, RIVE_ANALYTICS: '0' },
        windowsHide: true,
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 64 * 1024
    });
    const versionText = String(version.stdout || '').trim();
    if (version.error || version.status !== 0 || versionText !== FIXED_CACHE.cliVersion) {
        return cacheFailure('cache-version-mismatch', ['cli-version']);
    }
    return { ok: true, reason: 'cache-valid', version: versionText, hashes, installationId: sha256Text(realWork) };
}

function healthValue(value) {
    if (!value || value.app !== RIVE_EDITOR_APP || value.protocol !== RIVE_EDITOR_PROTOCOL
        || !/^[a-f0-9]{64}$/i.test(String(value.installationId || ''))
        || !Number.isInteger(value.pid) || value.pid < 1) return null;
    return { app: value.app, protocol: value.protocol, installationId: String(value.installationId).toLowerCase(), pid: value.pid };
}

export function validateRiveEditorHealth(value) {
    const health = healthValue(value);
    return health ? { ok: true, health } : { ok: false, reason: 'editor-port-occupied-unknown-health' };
}

function probeRequest({ host, port, timeoutMs }) {
    return new Promise(resolve => {
        let settled = false;
        const finish = value => { if (!settled) { settled = true; resolve(value); } };
        const request = http.get({ host, port, path: '/health', headers: { accept: 'application/json' } }, response => {
            const chunks = [];
            let size = 0;
            response.setEncoding('utf8');
            response.on('data', chunk => {
                size += Buffer.byteLength(chunk);
                if (size <= 64 * 1024) chunks.push(chunk);
            });
            response.on('end', () => {
                let value = null;
                try { value = JSON.parse(chunks.join('')); } catch {}
                const validated = response.statusCode === 200 ? validateRiveEditorHealth(value) : { ok: false, reason: 'editor-port-occupied-unknown-health' };
                finish(validated.ok ? { kind: 'health', health: validated.health } : { kind: 'occupied', reason: validated.reason });
            });
        });
        request.setTimeout(timeoutMs, () => { request.destroy(); finish({ kind: 'occupied', reason: 'editor-port-occupied-unknown-health' }); });
        request.on('error', error => finish(error?.code === 'ECONNREFUSED' ? { kind: 'free' } : { kind: 'occupied', reason: 'editor-port-occupied-unknown-health' }));
    });
}

export function probeRiveEditorHealth(options = {}) {
    return probeRequest({ host: options.host || RIVE_EDITOR_HOST, port: options.port || RIVE_EDITOR_PORT, timeoutMs: options.timeoutMs || 1000 });
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function stableErrorReason(error, fallback = 'spawn-failed') {
    return /^[a-z0-9-]+$/.test(String(error?.reason || '')) ? error.reason : fallback;
}

export function createRiveEditorDevCompanion(options = {}) {
    const workRoot = path.resolve(options.workRoot || DEFAULT_WORK);
    const cacheRoot = path.resolve(options.cacheRoot || path.join(workRoot, '.cache', 'rive-editor'));
    const config = Object.freeze({
        workRoot,
        cacheRoot,
        serverPath: path.resolve(options.serverPath || DEFAULT_SERVER),
        host: options.host || RIVE_EDITOR_HOST,
        port: options.port || RIVE_EDITOR_PORT,
        timeoutMs: Math.min(30000, Math.max(1000, Number(options.timeoutMs) || 25000)),
        receiptPath: path.resolve(options.receiptPath || path.join(cacheRoot, 'dev-companion-receipt.json'))
    });
    const verifyCache = options.verifyCache || verifyFixedCache;
    const probeHealth = options.probeHealth || probeRiveEditorHealth;
    const sleepFn = options.sleep || sleep;
    const spawnChild = options.spawnChild || (async () => {
        await fs.mkdir(config.cacheRoot, { recursive: true });
        const stdoutPath = path.join(config.cacheRoot, 'dev-companion-server.stdout.log');
        const stderrPath = path.join(config.cacheRoot, 'dev-companion-server.stderr.log');
        const stdout = fsSync.openSync(stdoutPath, 'a');
        const stderr = fsSync.openSync(stderrPath, 'a');
        try {
            const child = spawn(process.execPath, [config.serverPath], {
                cwd: config.workRoot,
                env: { ...process.env, RIVE_HOME: path.join(config.cacheRoot, 'rive-home'), RIVE_ANALYTICS: '0' },
                windowsHide: true,
                stdio: ['ignore', stdout, stderr]
            });
            return { child, pid: child.pid };
        } finally {
            fsSync.closeSync(stdout);
            fsSync.closeSync(stderr);
        }
    });

    let phase = 'idle';
    let reason = 'not-started';
    let flight = null;
    let active = null;
    let closed = false;
    let lastReceipt = null;
    let receiptWriteChain = Promise.resolve();

    const state = () => ({ schema: CONNECTION_SCHEMA, phase, reason, editorOrigin: phase === 'ready' ? RIVE_EDITOR_ORIGIN : undefined });

    async function installationId() {
        const realWork = await fs.realpath(config.workRoot);
        return sha256Text(realWork);
    }

    async function writeReceipt(event, record, extra = {}) {
        const receipt = {
            schema: 'tegaki.rive-editor.dev-companion-receipt.v1',
            event,
            recordedAt: new Date().toISOString(),
            installationId: record?.installationId || null,
            pid: record?.pid || null,
            owned: record?.owned === true,
            creationToken: record?.creationToken || null,
            health: record?.health || null,
            ...extra
        };
        lastReceipt = receipt;
        const persist = async () => {
            const temporaryPath = `${config.receiptPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
            try {
                await fs.mkdir(path.dirname(config.receiptPath), { recursive: true });
                await fs.writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
                await fs.rename(temporaryPath, config.receiptPath);
            } catch {
                try { await fs.rm(temporaryPath, { force: true }); } catch {}
                // Receipt failure never turns an already-started server into an unowned kill target.
            }
        };
        receiptWriteChain = receiptWriteChain.then(persist, persist);
        await receiptWriteChain;
        return receipt;
    }

    function childExited(child) {
        return child && child.exitCode !== null && child.exitCode !== undefined;
    }

    async function waitForChildExit(child, milliseconds = 2000) {
        if (!child || childExited(child)) return true;
        await new Promise(resolve => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            child.once?.('exit', finish);
            setTimeout(finish, milliseconds);
        });
        return childExited(child);
    }

    async function stopOwn(record, stopReason) {
        if (!record?.owned || !record.child) return false;
        if (!childExited(record.child)) {
            try { record.child.kill(); } catch {}
            await waitForChildExit(record.child);
        }
        await writeReceipt('stopped', record, { stopReason, stoppedAt: new Date().toISOString() });
        if (active === record) active = null;
        return true;
    }

    async function waitForReady(record) {
        const deadline = Date.now() + config.timeoutMs;
        while (Date.now() < deadline) {
            if (childExited(record.child)) return { ok: false, reason: 'server-exited' };
            const observed = await probeHealth({ host: config.host, port: config.port, timeoutMs: 500 });
            if (observed?.kind === 'health') {
                if (observed.health.installationId !== record.installationId) return { ok: false, reason: 'health-installation-mismatch' };
                if (observed.health.pid !== record.pid) return { ok: false, reason: 'health-pid-mismatch' };
                return { ok: true, health: observed.health };
            }
            if (observed?.kind === 'occupied') return { ok: false, reason: observed.reason || 'health-mismatch' };
            await sleepFn(100);
        }
        return { ok: false, reason: 'server-timeout' };
    }

    async function cacheGate() {
        try { return await verifyCache({ workRoot: config.workRoot, cacheRoot: config.cacheRoot }); }
        catch { return { ok: false, reason: 'cache-unavailable' }; }
    }

    async function revalidateReady() {
        if (!active) return false;
        const record = active;
        const observed = await probeHealth({ host: config.host, port: config.port, timeoutMs: 500 });
        if (observed?.kind === 'health') {
            if (observed.health.installationId !== record.installationId) {
                phase = 'error'; reason = 'editor-port-occupied-other-installation'; return true;
            }
            const cache = await cacheGate();
            if (!cache?.ok) { phase = 'error'; reason = cache?.reason || 'cache-unavailable'; return true; }
            if (record.owned && record.child && !childExited(record.child)) {
                if (observed.health.pid !== record.pid) { phase = 'error'; reason = 'editor-port-occupied-other-process'; return true; }
                record.health = observed.health;
                phase = 'ready'; reason = 'started';
                await writeReceipt('ready-revalidated', record);
                return true;
            }
            active = { owned: false, pid: observed.health.pid, installationId: record.installationId, health: observed.health, creationToken: null, child: null };
            phase = 'ready'; reason = 'reused';
            await writeReceipt('reused-revalidated', active);
            return true;
        }
        if (record.owned && record.child && !childExited(record.child)) {
            phase = 'error'; reason = observed?.reason || 'server-health-unavailable'; return true;
        }
        active = null;
        phase = 'starting'; reason = 'starting';
        return false;
    }

    async function ensureOnce() {
        phase = 'starting'; reason = 'starting';
        let id;
        try { id = await installationId(); } catch { phase = 'error'; reason = 'installation-unavailable'; return state(); }
        const observed = await probeHealth({ host: config.host, port: config.port, timeoutMs: 500 });
        if (observed?.kind === 'health') {
            if (observed.health.installationId !== id) { phase = 'error'; reason = 'editor-port-occupied-other-installation'; return state(); }
            const cache = await cacheGate();
            if (!cache?.ok) { phase = 'error'; reason = cache?.reason || 'cache-unavailable'; return state(); }
            if (active?.owned && active.child && !childExited(active.child)) {
                if (observed.health.pid !== active.pid) { phase = 'error'; reason = 'editor-port-occupied-other-process'; return state(); }
                active.health = observed.health;
                phase = 'ready'; reason = 'started';
                await writeReceipt('ready-revalidated', active);
                return state();
            }
            active = { owned: false, pid: observed.health.pid, installationId: id, health: observed.health, creationToken: null, child: null };
            phase = 'ready'; reason = 'reused';
            await writeReceipt('reused', active);
            return state();
        }
        if (observed?.kind === 'occupied') { phase = 'error'; reason = observed.reason || 'editor-port-occupied-unknown-health'; return state(); }
        const cache = await cacheGate();
        if (!cache?.ok) { phase = 'error'; reason = cache?.reason || 'cache-unavailable'; return state(); }

        let childInfo;
        try { childInfo = await spawnChild({ workRoot: config.workRoot, cacheRoot: config.cacheRoot, serverPath: config.serverPath, host: config.host, port: config.port }); }
        catch { phase = 'error'; reason = 'spawn-failed'; return state(); }
        const record = {
            owned: true,
            child: childInfo?.child || childInfo,
            pid: Number(childInfo?.pid || childInfo?.child?.pid || 0),
            installationId: id,
            creationToken: crypto.randomUUID()
        };
        if (!record.child || !Number.isInteger(record.pid) || record.pid < 1) { phase = 'error'; reason = 'spawn-failed'; return state(); }
        active = record;
        record.child.once?.('exit', () => {
            if (active === record && phase === 'ready') {
                phase = 'error'; reason = 'server-exited';
                void writeReceipt('exited', record, { exitCode: record.child.exitCode });
            }
        });
        await writeReceipt('spawned', record);
        const ready = await waitForReady(record);
        if (!ready.ok) {
            await stopOwn(record, ready.reason);
            phase = 'error'; reason = ready.reason;
            return state();
        }
        record.health = ready.health;
        phase = 'ready'; reason = 'started';
        await writeReceipt('ready', record);
        return state();
    }

    return {
        status() { return state(); },
        async ensure() {
            if (closed) { phase = 'error'; reason = 'bridge-closed'; return state(); }
            if (phase === 'ready' && active && await revalidateReady()) return state();
            if (!flight) {
                flight = ensureOnce().catch(error => { phase = 'error'; reason = stableErrorReason(error); return state(); }).finally(() => { flight = null; });
            }
            return flight;
        },
        async close() {
            closed = true;
            if (flight) await flight;
            if (active?.owned) await stopOwn(active, 'vite-close');
            else if (active) await writeReceipt('reused-close', active, { stopped: false });
            active = null;
            phase = 'idle'; reason = 'closed';
        },
        debugSnapshot() {
            return { ...state(), active: active ? { owned: active.owned, pid: active.pid, installationId: active.installationId, creationToken: active.creationToken, health: active.health || null } : null, receiptPath: config.receiptPath, lastReceipt };
        }
    };
}

export const createDevCompanion = createRiveEditorDevCompanion;
export default createRiveEditorDevCompanion;
