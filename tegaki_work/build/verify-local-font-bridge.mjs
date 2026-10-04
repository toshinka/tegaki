import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import {
    createLocalFontBridgePlugin,
    createLocalFontBridgeState,
    handleLocalFontBridgeRequest,
    localFontBridgeRuntimeConfig
} from './local-font-bridge.mjs';
import { FontLibrary } from '../system/font-library.js';
import viteConfig from '../vite.config.js';

const failures = [];

const developmentConfig = viteConfig({ command: 'serve', isPreview: false });
if (developmentConfig.server?.cors !== false) failures.push('Vite CORS must be disabled before plugin middleware, including preflight');
for (const mode of [{ command: 'serve', isPreview: true }, { command: 'build', isPreview: false }]) {
    if (viteConfig(mode).plugins?.length) failures.push('preview/build must not register the local font plugin');
}

function check(condition, message) {
    if (!condition) failures.push(message);
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
        end(body) {
            this.body = body === undefined ? Buffer.alloc(0) : Buffer.from(body);
            this.ended = true;
        }
    };
}

async function request(state, url, overrides = {}) {
    const req = {
        url,
        method: overrides.method || 'GET',
        headers: {
            host: '127.0.0.1:5173',
            origin: 'http://127.0.0.1:5173',
            ...(overrides.headers || {})
        },
        socket: { remoteAddress: overrides.remoteAddress || '127.0.0.1' }
    };
    const res = fakeResponse(req);
    let nextCalled = false;
    await handleLocalFontBridgeRequest(req, res, () => { nextCalled = true; }, state);
    return { req, res, nextCalled };
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
}

function jsonResponse(value) {
    return { ok: true, async json() { return value; } };
}

async function digestHex(data) {
    return [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', data))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyBridgeSecurity(root) {
    const fontBytes = new Uint8Array([1, 2, 3, 4]);
    const license = 'License text\n';
    await fs.mkdir(path.join(root, 'Library', 'auto-font'), { recursive: true });
    await fs.writeFile(path.join(root, 'Library', 'auto-font', 'font.ttf'), fontBytes);
    await fs.writeFile(path.join(root, 'Library', 'auto-font', 'LICENSE.txt'), license);
    const outsidePath = path.join(path.dirname(root), 'tegaki-local-bridge-outside.txt');
    await fs.writeFile(outsidePath, 'outside');
    const catalog = {
        version: 1,
        fonts: [{
            id: 'auto-font',
            family: 'Auto Font',
            file: 'Library/auto-font/font.ttf',
            licenseFile: 'Library/auto-font/LICENSE.txt',
            external: true
        }]
    };
    const state = await createLocalFontBridgeState({ root, catalog });
    const status = await request(state, '/__tegaki/local-fonts/status');
    check(status.res.statusCode === 200, 'bridge status did not succeed');
    check(JSON.parse(status.res.body).automatic === true, 'bridge status did not identify automatic mode');
    check(!status.res.body.toString().includes(root), 'bridge status exposed the external root path');
    check(!status.res.getHeader('access-control-allow-origin'), 'bridge status retained an ACAO header');

    const font = await request(state, '/__tegaki/local-fonts/file/font/auto-font');
    check(font.res.statusCode === 200 && font.res.body.equals(Buffer.from(fontBytes)), 'allowlisted font was not served');
    check(font.res.getHeader('content-type') === 'font/ttf', 'font content type was not set');
    const head = await request(state, '/__tegaki/local-fonts/file/font/auto-font', { method: 'HEAD' });
    check(head.res.statusCode === 200 && head.res.body.length === 0, 'font HEAD did not omit the body');
    const text = await request(state, '/__tegaki/local-fonts/file/license/auto-font');
    check(text.res.statusCode === 200 && text.res.body.toString() === license, 'allowlisted license was not served');

    const rejected = [
        [await request(state, '/__tegaki/local-fonts/status', { remoteAddress: '192.168.1.2' }), 'remote network address was accepted'],
        [await request(state, '/__tegaki/local-fonts/status', { headers: { origin: 'http://127.0.0.1:5174' } }), 'foreign origin port was accepted'],
        [await request(state, '/__tegaki/local-fonts/status', { headers: { host: 'evil.example:5173' } }), 'foreign host was accepted'],
        [await request(state, '/__tegaki/local-fonts/status', { headers: { 'sec-fetch-site': 'cross-site' } }), 'cross-site fetch metadata was accepted'],
        [await request(state, '/__tegaki/local-fonts/file/font/unknown-font'), 'unknown catalog id was accepted'],
        [await request(state, '/__tegaki/local-fonts/file/font/auto-font?raw=1'), 'query parameter was accepted']
    ];
    for (const [{ res }, message] of rejected) check(res.statusCode >= 400, message);

    const outsideRowState = await createLocalFontBridgeState({
        root,
        catalog: { fonts: [{ ...catalog.fonts[0], file: '../tegaki-local-bridge-outside.txt' }] }
    });
    const outsideRow = await request(outsideRowState, '/__tegaki/local-fonts/file/font/auto-font');
    check(outsideRow.res.statusCode >= 400, 'catalog traversal path was accepted');
    try {
        await fs.symlink(outsidePath, path.join(root, 'Library', 'auto-font', 'escape.ttf'));
        const symlinkState = await createLocalFontBridgeState({
            root,
            catalog: { fonts: [{ ...catalog.fonts[0], file: 'Library/auto-font/escape.ttf' }] }
        });
        const escaped = await request(symlinkState, '/__tegaki/local-fonts/file/font/auto-font');
        check(escaped.res.statusCode === 403, 'symlink escape was accepted');
    } catch (error) {
        // Windows may deny symlink creation for an ordinary user; the realpath
        // guard remains covered by the implementation and the other rejects run.
    }
    await fs.rm(outsidePath, { force: true });
}

async function verifyRuntimeAndLibrary(root) {
    const runtime = localFontBridgeRuntimeConfig();
    check(runtime.automatic === true && runtime.baseUrl === '/__tegaki/local-fonts', 'runtime bridge config is incomplete');
    const plugin = createLocalFontBridgePlugin({
        root,
        catalog: { fonts: [] }
    });
    check(plugin.apply === 'serve', 'bridge plugin is not serve-only');
    const config = plugin.config();
    check(config.define['import.meta.env.VITE_TEGAKI_LOCAL_FONT_BRIDGE'], 'serve config did not inject runtime bridge settings');
    let externalMiddlewareCalls = 0;
    let externalHostRejected = false;
    try {
        plugin.configureServer({
            config: { server: { host: '0.0.0.0' } },
            middlewares: { use() { externalMiddlewareCalls += 1; } }
        });
    } catch (error) {
        externalHostRejected = true;
    }
    check(externalHostRejected && externalMiddlewareCalls === 0, 'external --host did not fail closed before enabling the local bridge');
    let loopbackMiddlewareCalls = 0;
    plugin.configureServer({
        config: { server: { host: '127.0.0.1' } },
        middlewares: { use() { loopbackMiddlewareCalls += 1; } }
    });
    check(loopbackMiddlewareCalls === 1, 'loopback Vite host did not register the bridge middleware');

    const bytes = new Uint8Array([9, 8, 7]);
    const hash = await digestHex(bytes);
    const catalog = {
        version: 1,
        fonts: [{
            id: 'auto-font',
            family: 'Auto Font',
            file: 'Library/auto-font/font.ttf',
            external: true,
            sha256: hash
        }]
    };
    const calls = [];
    let pickerCalls = 0;
    const fetch = async url => {
        const value = String(url);
        calls.push(value);
        if (value === '/fonts/catalog.json') return jsonResponse(catalog);
        if (value === '/__test/status') return jsonResponse({ automatic: true, connected: true, supported: true, name: 'TegakiFonts', permission: 'granted' });
        if (value === '/__test/file/font/auto-font') {
            return { ok: true, async blob() { return new Blob([bytes], { type: 'font/ttf' }); } };
        }
        throw new Error(`unexpected fetch: ${value}`);
    };
    class FakeFontFace {
        constructor(family, data) { this.family = family; this.data = data; }
        async load() { return this; }
    }
    const library = new FontLibrary({
        baseUrl: '/',
        localBridge: { automatic: true, baseUrl: '/__test' },
        fetch,
        indexedDB: null,
        directoryPicker() { pickerCalls += 1; return Promise.resolve(null); },
        FontFace: FakeFontFace,
        document: { fonts: { add() {} } },
        crypto: webcrypto,
        storage: memoryStorage()
    });
    const status = await library.getExternalStatus();
    check(status.automatic === true && status.connected === true, 'FontLibrary did not expose automatic bridge status');
    const connect = await library.connectExternalDirectory();
    check(connect.automatic === true && pickerCalls === 0, 'automatic bridge mode still invoked the directory picker');
    const loaded = await Promise.all([library.ensureLoaded('auto-font'), library.ensureLoaded('auto-font')]);
    check(loaded[0]?.family === 'Auto Font' && loaded[0] === loaded[1], 'automatic bridge font did not load or share its request');
    check(calls.filter(value => value === '/__test/file/font/auto-font').length === 1, 'automatic bridge made duplicate font requests');
    check((await library.readExternalFile('Library/unknown/font.ttf')) === null, 'automatic bridge accepted a non-catalog path');
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tegaki-local-font-bridge-'));
try {
    await verifyBridgeSecurity(root);
    await verifyRuntimeAndLibrary(root);
} finally {
    await fs.rm(root, { recursive: true, force: true });
}

if (failures.length) {
    console.error(`verify-local-font-bridge: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log('verify-local-font-bridge: PASS (allowlist, loopback/origin/security, serve-only runtime, FontLibrary auto mode)');
}
