/**
 * ROLE: WP-031 Vite serve-only bridge for lazy Rive editor companion startup.
 * AUTHORITY: loopback HTTP boundary and bridge startup nonce; companion owns child lifecycle.
 * INVARIANTS: exact same-origin/nonce, empty ensure body, no query/CORS, status never spawns.
 * RELATED: advanced/rive-editor/dev-companion.mjs、ui/rive-editor-entry.js、WP-031。
 */
import crypto from 'node:crypto';
import { createRiveEditorDevCompanion } from '../advanced/rive-editor/dev-companion.mjs';

export const RIVE_EDITOR_DEV_BRIDGE_PREFIX = '/__tegaki/rive-editor';
export const RIVE_EDITOR_CONNECTION_SCHEMA = 'tegaki.rive-editor.connection.v1';
export const RIVE_EDITOR_NONCE_HEADER = 'x-tegaki-rive-nonce';

function header(req, name) {
    const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}

function loopbackAddress(value) {
    const raw = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    return raw === '127.0.0.1' || raw === '::1' || raw === '::ffff:127.0.0.1';
}

export function normalizeLoopbackAuthority(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.includes('@')) return null;
    try {
        const parsed = new URL(`http://${raw}`);
        if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
        const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return null;
        const port = Number(parsed.port || 80);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
        return `${hostname.includes(':') ? `[${hostname}]` : hostname}:${port}`;
    } catch {
        return null;
    }
}

export function requestOrigin(req, { requireOrigin = false } = {}) {
    const authority = normalizeLoopbackAuthority(header(req, 'host'));
    if (!authority) return { ok: false, reason: 'host-rejected' };
    const originHeader = header(req, 'origin');
    if (requireOrigin && !originHeader) return { ok: false, reason: 'origin-rejected' };
    if (originHeader !== undefined) {
        let origin;
        try {
            const parsed = new URL(String(originHeader));
            const originHost = normalizeLoopbackAuthority(parsed.host);
            origin = parsed.protocol === 'http:' && originHost ? `${parsed.protocol}//${originHost}` : null;
        } catch { origin = null; }
        if (origin !== `http://${authority}`) return { ok: false, reason: 'origin-rejected' };
    }
    const remoteAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
    if (!loopbackAddress(remoteAddress)) return { ok: false, reason: 'loopback-rejected' };
    const fetchSite = String(header(req, 'sec-fetch-site') || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin') return { ok: false, reason: 'fetch-site-rejected' };
    const fetchMode = String(header(req, 'sec-fetch-mode') || '').toLowerCase();
    if (fetchMode && !['same-origin', 'cors'].includes(fetchMode)) return { ok: false, reason: 'fetch-mode-rejected' };
    return { ok: true, origin: `http://${authority}` };
}

function send(res, statusCode, value) {
    const body = Buffer.from(JSON.stringify(value));
    for (const name of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Expose-Headers']) res.removeHeader?.(name);
    res.statusCode = statusCode;
    res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
    res.setHeader?.('Content-Length', String(body.byteLength));
    res.setHeader?.('Cache-Control', 'no-store');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    res.end(body);
}

function readBody(req, limit = 1024) {
    const declared = header(req, 'content-length');
    const declaredLength = declared === undefined ? null : Number(declared);
    if (declaredLength !== null && (!Number.isInteger(declaredLength) || declaredLength < 0)) return Promise.resolve({ invalid: true });
    if (declaredLength !== null && declaredLength > limit) return Promise.resolve({ tooLarge: true });
    if (Buffer.isBuffer(req?.body)) {
        if (req.body.byteLength > limit) return Promise.resolve({ tooLarge: true });
        return Promise.resolve(declaredLength !== null && declaredLength !== req.body.byteLength ? { invalid: true } : req.body);
    }
    return new Promise(resolve => {
        let size = 0;
        let settled = false;
        const chunks = [];
        const finish = value => { if (!settled) { settled = true; resolve(value); } };
        req.on?.('data', chunk => {
            if (settled) return;
            size += chunk.length;
            if (size > limit) { finish({ tooLarge: true }); req.resume?.(); return; }
            chunks.push(Buffer.from(chunk));
        });
        req.on?.('end', () => {
            const body = Buffer.concat(chunks);
            finish(declaredLength !== null && declaredLength !== body.byteLength ? { invalid: true } : body);
        });
        req.on?.('error', () => finish({ invalid: true }));
        if (!req.on) finish(Buffer.alloc(0));
    });
}

function snapshot(state, nonce) {
    const value = { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: state?.phase || 'error', reason: state?.reason || 'bridge-unavailable', nonce };
    if (value.phase === 'ready') value.editorOrigin = state.editorOrigin || 'http://127.0.0.1:18729';
    return value;
}

export async function handleRiveEditorDevBridgeRequest(req, res, next, bridgeState) {
    let parsed;
    try { parsed = new URL(req?.url || '', 'http://127.0.0.1'); } catch { return send(res, 400, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'bad-request', nonce: bridgeState?.nonce }); }
    if (parsed.pathname !== `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/status` && parsed.pathname !== `${RIVE_EDITOR_DEV_BRIDGE_PREFIX}/ensure`) return next?.();
    if (parsed.search || String(req?.url || '').includes('?')) return send(res, 400, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'query-not-allowed', nonce: bridgeState?.nonce });
    const isStatus = parsed.pathname.endsWith('/status');
    const method = String(req?.method || 'GET').toUpperCase();
    const origin = requestOrigin(req, { requireOrigin: !isStatus });
    if (!origin.ok) return send(res, 403, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: origin.reason, nonce: bridgeState?.nonce });
    if (isStatus && method !== 'GET') return send(res, 405, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'method-not-allowed', nonce: bridgeState?.nonce });
    if (!isStatus && method !== 'POST') return send(res, 405, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'method-not-allowed', nonce: bridgeState?.nonce });
    if (isStatus) return send(res, 200, snapshot(bridgeState?.companion?.status?.(), bridgeState?.nonce));
    if (header(req, RIVE_EDITOR_NONCE_HEADER) !== bridgeState?.nonce) return send(res, 403, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'nonce-rejected', nonce: bridgeState?.nonce });
    const body = await readBody(req, 1024);
    if (body?.tooLarge) return send(res, 413, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'body-too-large', nonce: bridgeState?.nonce });
    if (body?.invalid) return send(res, 400, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'body-invalid', nonce: bridgeState?.nonce });
    if (body?.byteLength) return send(res, 400, { schema: RIVE_EDITOR_CONNECTION_SCHEMA, phase: 'error', reason: 'body-not-empty', nonce: bridgeState?.nonce });
    const state = await bridgeState?.companion?.ensure?.();
    const result = snapshot(state, bridgeState?.nonce);
    return send(res, result.phase === 'ready' ? 200 : 503, result);
}

export function createRiveEditorDevBridgePlugin(options = {}) {
    const companion = options.companion || createRiveEditorDevCompanion(options.companionOptions);
    const bridgeState = { companion, nonce: options.nonce || crypto.randomBytes(24).toString('hex') };
    return {
        name: 'tegaki-rive-editor-dev-bridge',
        apply: 'serve',
        configureServer(server) {
            const configuredHost = server?.config?.server?.host;
            if (configuredHost === true || (typeof configuredHost === 'string' && !['localhost', '127.0.0.1', '::1'].includes(configuredHost.replace(/^\[|\]$/g, '').toLowerCase()))) throw new Error('Tegaki Rive editor bridge requires a loopback Vite host');
            server.middlewares.use((req, res, next) => handleRiveEditorDevBridgeRequest(req, res, next, bridgeState));
            server.httpServer?.once?.('close', () => { void companion.close?.(); });
        },
        getBridgeState() { return bridgeState; }
    };
}

export const createRiveEditorDevBridge = createRiveEditorDevBridgePlugin;
export default createRiveEditorDevBridgePlugin;
