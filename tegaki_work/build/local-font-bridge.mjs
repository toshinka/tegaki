/**
 * WP-023 dev-only local font bridge.
 *
 * The bridge is intentionally a small allowlist reader. It never exposes a
 * filesystem path, accepts no path supplied by the browser, and is only
 * registered by the Vite serve config. Production builds and previews do not
 * import it as a Vite plugin.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCAL_FONT_BRIDGE_PREFIX = '/__tegaki/local-fonts';
export const LOCAL_FONT_BRIDGE_RUNTIME_KEY = 'import.meta.env.VITE_TEGAKI_LOCAL_FONT_BRIDGE';
export const DEFAULT_LOCAL_FONT_ROOT = 'E:\\Data\\TegakiFonts';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG_PATH = path.resolve(MODULE_DIR, '../public/fonts/catalog.json');
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const ALLOWED_KINDS = Object.freeze({
    font: ['file'],
    license: ['licenseFile'],
    author: ['authorFile', 'readmeFile']
});

function header(req, name) {
    const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}

function loopbackHostname(hostname) {
    const value = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    return value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

function normalizeAuthority(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.includes('@')) return null;
    try {
        const parsed = new URL(`http://${raw}`);
        if (parsed.username || parsed.password) return null;
        if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
        const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (!loopbackHostname(hostname)) return null;
        return `${hostname.includes(':') ? `[${hostname}]` : hostname}:${parsed.port || '80'}`;
    } catch (error) {
        return null;
    }
}

function normalizeOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'null') return null;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'http:' || parsed.username || parsed.password) return null;
        const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
        if (!loopbackHostname(hostname)) return null;
        return `${parsed.protocol}//${hostname.includes(':') ? `[${hostname}]` : hostname}:${parsed.port || '80'}`;
    } catch (error) {
        return null;
    }
}

export function isLoopbackRemoteAddress(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return false;
    const unwrapped = raw.replace(/^\[|\]$/g, '');
    return unwrapped === '127.0.0.1'
        || unwrapped === '::1'
        || unwrapped === '::ffff:127.0.0.1';
}

export function isLoopbackRequest(req) {
    const remoteAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
    if (!isLoopbackRemoteAddress(remoteAddress)) return false;
    const requestAuthority = normalizeAuthority(header(req, 'host'));
    if (!requestAuthority) return false;
    const origin = header(req, 'origin');
    if (origin !== undefined && normalizeOrigin(origin) !== `http://${requestAuthority}`) return false;
    const referer = header(req, 'referer');
    if (referer !== undefined && normalizeOrigin(referer) !== `http://${requestAuthority}`) return false;
    const fetchSite = String(header(req, 'sec-fetch-site') || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin') return false;
    const fetchMode = String(header(req, 'sec-fetch-mode') || '').toLowerCase();
    if (fetchMode && !['cors', 'same-origin'].includes(fetchMode)) return false;
    const fetchDest = String(header(req, 'sec-fetch-dest') || '').toLowerCase();
    if (fetchDest && !['empty', 'font'].includes(fetchDest)) return false;
    return true;
}

function safeCatalogPath(value) {
    const raw = String(value ?? '').trim().replace(/\\/g, '/');
    if (!raw || raw.startsWith('/') || /^[a-z]:/i.test(raw) || raw.includes('\u0000')) return '';
    const segments = raw.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) return '';
    return raw;
}

function insideRoot(rootPath, candidatePath) {
    const relative = path.relative(rootPath, candidatePath);
    return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function rowId(value) {
    const id = String(value ?? '').trim();
    return ID_PATTERN.test(id) ? id : '';
}

export function buildLocalFontAllowlist(catalog, root = DEFAULT_LOCAL_FONT_ROOT) {
    const entries = new Map();
    const rows = Array.isArray(catalog?.fonts) ? catalog.fonts : [];
    for (const row of rows) {
        if (row?.external !== true) continue;
        const id = rowId(row.id);
        if (!id || entries.has(id)) continue;
        const files = {};
        for (const [kind, fields] of Object.entries(ALLOWED_KINDS)) {
            for (const field of fields) {
                const relative = safeCatalogPath(row?.[field]);
                if (relative) {
                    files[kind] = relative;
                    break;
                }
            }
        }
        if (files.font) entries.set(id, Object.freeze({ id, files }));
    }
    return Object.freeze({ root: path.resolve(root), entries });
}

async function loadCatalog(options) {
    if (options.catalog && typeof options.catalog === 'object') return options.catalog;
    try {
        return JSON.parse(await fs.readFile(options.catalogPath || DEFAULT_CATALOG_PATH, 'utf8'));
    } catch (error) {
        return null;
    }
}

export async function createLocalFontBridgeState(options = {}) {
    const root = path.resolve(options.root || DEFAULT_LOCAL_FONT_ROOT);
    const catalog = await loadCatalog(options);
    const allowlist = buildLocalFontAllowlist(catalog, root);
    const rootRealPath = await fs.realpath(root).catch(() => null);
    return Object.freeze({
        root,
        rootRealPath,
        entries: allowlist.entries,
        prefix: options.prefix || LOCAL_FONT_BRIDGE_PREFIX,
        available: !!rootRealPath,
        catalogLoaded: !!catalog
    });
}

export function localFontBridgeRuntimeConfig(prefix = LOCAL_FONT_BRIDGE_PREFIX) {
    return Object.freeze({
        automatic: true,
        baseUrl: prefix,
        statusUrl: `${prefix}/status`,
        fileUrl: `${prefix}/file`
    });
}

function send(res, statusCode, body, contentType = 'application/json; charset=utf-8') {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    for (const name of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Expose-Headers']) {
        res.removeHeader?.(name);
    }
    res.statusCode = statusCode;
    res.setHeader?.('Content-Type', contentType);
    res.setHeader?.('Content-Length', String(buffer.byteLength));
    res.setHeader?.('Cache-Control', 'no-store');
    res.setHeader?.('X-Content-Type-Options', 'nosniff');
    if (res.req?.method === 'HEAD') return res.end();
    return res.end(buffer);
}

function sendJson(res, statusCode, value) {
    return send(res, statusCode, JSON.stringify(value));
}

function decodeRouteSegment(value) {
    try {
        const decoded = decodeURIComponent(value);
        return decoded && !decoded.includes('/') && !decoded.includes('\\') && ID_PATTERN.test(decoded) ? decoded : '';
    } catch (error) {
        return '';
    }
}

async function resolveRegisteredFile(state, entry, kind, realpath = fs.realpath) {
    const relative = entry?.files?.[kind];
    if (!relative || !state.rootRealPath) return { ok: false, statusCode: state.rootRealPath ? 404 : 503 };
    const candidate = path.resolve(state.root, relative);
    if (!insideRoot(state.root, candidate)) return { ok: false, statusCode: 403 };
    let realCandidate;
    try { realCandidate = await realpath(candidate); } catch (error) { return { ok: false, statusCode: 404 }; }
    if (!insideRoot(state.rootRealPath, realCandidate)) return { ok: false, statusCode: 403 };
    try {
        const stat = await fs.stat(realCandidate);
        if (!stat.isFile()) return { ok: false, statusCode: 404 };
    } catch (error) {
        return { ok: false, statusCode: 404 };
    }
    return { ok: true, path: realCandidate };
}

function contentType(kind, filePath) {
    if (kind === 'license' || kind === 'author') return 'text/plain; charset=utf-8';
    const ext = path.extname(filePath).toLowerCase();
    return ({
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttc': 'font/collection'
    })[ext] || 'application/octet-stream';
}

export async function handleLocalFontBridgeRequest(req, res, next, state) {
    const prefix = state?.prefix || LOCAL_FONT_BRIDGE_PREFIX;
    let parsed;
    try { parsed = new URL(req?.url || '', 'http://127.0.0.1'); } catch (error) { return sendJson(res, 400, { error: 'bad-request' }); }
    if (parsed.pathname !== prefix && !parsed.pathname.startsWith(`${prefix}/`)) return next?.();
    if (!isLoopbackRequest(req)) return sendJson(res, 403, { error: 'loopback-only' });
    if (!['GET', 'HEAD'].includes(String(req?.method || 'GET').toUpperCase())) return sendJson(res, 405, { error: 'method-not-allowed' });
    if (parsed.search) return sendJson(res, 400, { error: 'query-not-allowed' });

    if (parsed.pathname === `${prefix}/status`) {
        return sendJson(res, 200, {
            automatic: true,
            connected: state.available,
            supported: true,
            name: 'TegakiFonts',
            permission: state.available ? 'granted' : 'unavailable',
            registeredCount: state.entries.size
        });
    }

    const pieces = parsed.pathname.slice(`${prefix}/file/`.length).split('/');
    if (!parsed.pathname.startsWith(`${prefix}/file/`) || pieces.length !== 2 || !['font', 'license', 'author'].includes(pieces[0])) {
        return sendJson(res, 404, { error: 'not-found' });
    }
    const kind = pieces[0];
    const id = decodeRouteSegment(pieces[1]);
    const entry = id ? state.entries.get(id) : null;
    if (!entry || !entry.files[kind]) return sendJson(res, 404, { error: 'not-found' });
    const resolved = await resolveRegisteredFile(state, entry, kind);
    if (!resolved.ok) return sendJson(res, resolved.statusCode, { error: resolved.statusCode === 403 ? 'forbidden' : 'not-found' });
    try {
        const data = await fs.readFile(resolved.path);
        for (const name of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Expose-Headers']) {
            res.removeHeader?.(name);
        }
        res.statusCode = 200;
        res.setHeader?.('Content-Type', contentType(kind, resolved.path));
        res.setHeader?.('Content-Length', String(data.byteLength));
        res.setHeader?.('Cache-Control', 'no-store');
        res.setHeader?.('X-Content-Type-Options', 'nosniff');
        if (String(req?.method || 'GET').toUpperCase() === 'HEAD') return res.end();
        return res.end(data);
    } catch (error) {
        return sendJson(res, 404, { error: 'not-found' });
    }
}

export function createLocalFontBridgePlugin(options = {}) {
    const statePromise = createLocalFontBridgeState(options);
    const prefix = options.prefix || LOCAL_FONT_BRIDGE_PREFIX;
    return {
        name: 'tegaki-local-font-bridge',
        apply: 'serve',
        config() {
            return {
                define: {
                    [LOCAL_FONT_BRIDGE_RUNTIME_KEY]: JSON.stringify(localFontBridgeRuntimeConfig(prefix))
                }
            };
        },
        configureServer(server) {
            const configuredHost = server?.config?.server?.host;
            if (configuredHost === true || (typeof configuredHost === 'string' && !['localhost', '127.0.0.1', '::1'].includes(configuredHost.replace(/^\[|\]$/g, '').toLowerCase()))) throw new Error('Tegaki local font bridge requires a loopback Vite host');
            server.middlewares.use(async (req, res, next) => {
                const state = await statePromise;
                return handleLocalFontBridgeRequest(req, res, next, state);
            });
        }
    };
}

export default createLocalFontBridgePlugin;
