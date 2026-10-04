/**
 * ROLE: WP-029 専用 loopback server、公式 CLI build、source+image bundle の保存/復元。
 * AUTHORITY: dedicated cache と startup nonce のみ。Project/History/Canvas の正本は所有しない。
 * INVARIANTS: 127.0.0.1:18729、Origin+nonce mutation gate、saved bundle 破損時は fallback しない、health は installation/pid を識別する。
 * RELATED: advanced/rive-editor/model.mjs、run-editor.ps1、editor.js、WP-029 card。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
    LIMITS,
    assertAngle,
    assertProgress,
    createRiveYaml,
    createSource,
    makeSnapshot,
    parseSourceMetadata,
    sanitizeImageName,
    sha256Bytes,
    sha256Text,
    validatePngBytes,
    writeInitialFixture,
} from './model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.resolve(HERE, '..', '..');
const CACHE = path.join(WORK, '.cache', 'rive-editor');
const PROOF_CACHE = path.join(WORK, '.cache', 'rive-authoring-proof');
const PROJECT = path.join(CACHE, 'project');
const SESSION = path.join(CACHE, 'session');
const SAVED = path.join(CACHE, 'saved');
const ARTIFACTS = path.join(CACHE, 'artifacts');
const PNGS = path.join(CACHE, 'browser-png');
const RIVE_HOME = path.join(CACHE, 'rive-home');
const CLI = path.join(PROOF_CACHE, 'cli-1.3.0', 'rive.exe');
const RUNTIME = path.join(PROOF_CACHE, 'runtime-2.44.0', 'package');
const PORT = 18729;
const HOST = '127.0.0.1';
const INSTALLATION_ID = sha256Text(fs.realpathSync.native(WORK));
const MUTATION_ORIGIN = `http://${HOST}:${PORT}`;
const STARTUP_NONCE = crypto.randomBytes(24).toString('hex');
const MUTATION_PATHS = new Set(['/api/image', '/api/compile', '/api/save', '/api/reopen', '/api/cancel', '/api/png', '/api/record']);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.riv': 'application/octet-stream',
    '.wasm': 'application/wasm',
};

function writeText(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, value, 'utf8');
}

function writeJson(filePath, value) {
    writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(filePath) {
    return sha256Bytes(fs.readFileSync(filePath));
}

function cliEnvironment() {
    return { ...process.env, RIVE_HOME, RIVE_ANALYTICS: '0' };
}

function runCli(args, logName) {
    const result = spawnSync(CLI, args, {
        cwd: CACHE,
        env: cliEnvironment(),
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    writeText(path.join(CACHE, logName), output);
    return { status: result.status ?? -1, output };
}

function configureCliEnvironment() {
    fs.mkdirSync(RIVE_HOME, { recursive: true });
    const off = runCli(['analytics', 'off'], 'server-analytics-off.log');
    const status = runCli(['analytics'], 'server-analytics-status.log');
    if (off.status !== 0 || status.status !== 0 || !/analytics\s+off/i.test(status.output)) {
        throw new Error('Rive CLI analytics could not be set to off.');
    }
    writeJson(path.join(CACHE, 'cli-environment.json'), {
        riveHome: RIVE_HOME,
        riveAnalytics: '0',
        analyticsCommand: 'off',
        processOnly: true,
        pathChanged: false,
    });
}

function ensureDirs() {
    for (const directory of [CACHE, PROJECT, SESSION, path.join(SESSION, 'build'), SAVED, ARTIFACTS, PNGS, RIVE_HOME]) {
        fs.mkdirSync(directory, { recursive: true });
    }
    const fixturePath = writeInitialFixture(CACHE);
    const fixtureInfo = validatePngBytes(fs.readFileSync(fixturePath));
    if (!fixtureInfo.ok) throw new Error(`Editor fixture is invalid: ${fixtureInfo.reason}`);
    writeText(path.join(PROJECT, 'rive.yaml'), createRiveYaml(fixtureInfo.width, fixtureInfo.height));
    fs.copyFileSync(fixturePath, path.join(PROJECT, 'fixture.png'));
}

function inspectSavedBundle() {
    const sourcePath = path.join(SAVED, 'scene.rml');
    const imagePath = path.join(SAVED, 'fixture.png');
    const rivPath = path.join(SAVED, 'current.riv');
    const metaPath = path.join(SAVED, 'meta.json');
    const paths = [sourcePath, imagePath, rivPath];
    const any = paths.some(filePath => fs.existsSync(filePath));
    if (!any) return { status: 'absent', sourcePath, imagePath, rivPath, metaPath };
    const missing = paths.filter(filePath => !fs.existsSync(filePath));
    if (missing.length) return { status: 'corrupt', detail: `Saved bundle missing: ${missing.join(', ')}`, sourcePath, imagePath, rivPath, metaPath };
    try {
        const source = fs.readFileSync(sourcePath, 'utf8');
        const image = fs.readFileSync(imagePath);
        const riv = fs.readFileSync(rivPath);
        const sourceInfo = parseSourceMetadata(source);
        const imageInfo = validatePngBytes(image);
        if (!sourceInfo || !imageInfo.ok || sourceInfo.width !== imageInfo.width || sourceInfo.height !== imageInfo.height || riv.length < 64) {
            return { status: 'corrupt', detail: 'Saved source, image, or derived .riv does not pass the editor contract.', sourcePath, imagePath, rivPath, metaPath };
        }
        let meta = {};
        if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return { status: 'valid', source, sourceInfo, imageInfo, meta, sourcePath, imagePath, rivPath, metaPath };
    } catch (error) {
        return { status: 'corrupt', detail: `Saved bundle read failed: ${error.message}`, sourcePath, imagePath, rivPath, metaPath };
    }
}

function buildCandidate(source, imagePath) {
    if (!imagePath || !fs.existsSync(imagePath)) return { ok: false, phase: 'asset', output: `Missing image asset: ${imagePath || '(none)'}` };
    let image;
    try {
        image = fs.readFileSync(imagePath);
    } catch (error) {
        return { ok: false, phase: 'asset', output: error.message };
    }
    const imageInfo = validatePngBytes(image);
    const sourceInfo = parseSourceMetadata(source);
    if (!imageInfo.ok) return { ok: false, phase: 'asset', output: `PNG rejected: ${imageInfo.reason}` };
    const tolerance = 1e-6;
    const fullMesh = sourceInfo && Math.abs(sourceInfo.imageX - imageInfo.width / 2) <= tolerance
        && Math.abs(sourceInfo.imageY - imageInfo.height / 2) <= tolerance
        && Math.abs(sourceInfo.rootX) <= tolerance
        && Math.abs(sourceInfo.rootY - imageInfo.height / 2) <= tolerance
        && Math.abs(sourceInfo.boneLength - imageInfo.width / 2) <= tolerance
        && Math.abs(sourceInfo.meshBounds.minX + imageInfo.width / 2) <= tolerance
        && Math.abs(sourceInfo.meshBounds.maxX - imageInfo.width / 2) <= tolerance
        && Math.abs(sourceInfo.meshBounds.minY + imageInfo.height / 2) <= tolerance
        && Math.abs(sourceInfo.meshBounds.maxY - imageInfo.height / 2) <= tolerance;
    if (!sourceInfo || sourceInfo.width !== imageInfo.width || sourceInfo.height !== imageInfo.height || !fullMesh) {
        return { ok: false, phase: 'source', output: 'Source artboard and PNG dimensions must match.' };
    }
    writeText(path.join(SESSION, 'rive.yaml'), createRiveYaml(imageInfo.width, imageInfo.height));
    writeText(path.join(SESSION, 'scene.rml'), source);
    fs.writeFileSync(path.join(SESSION, 'fixture.png'), image);
    const verify = runCli([SESSION, '--verify', '--format=json'], 'server-verify.log');
    if (verify.status !== 0) return { ok: false, phase: 'verify', output: verify.output };
    const build = runCli([SESSION, '--once', '--format=json'], 'server-once.log');
    if (build.status !== 0) return { ok: false, phase: 'build', output: build.output };
    const riv = path.join(SESSION, 'build', 'tegaki_rive_editor.riv');
    if (!fs.existsSync(riv)) return { ok: false, phase: 'build', output: 'Rive CLI did not write the expected artifact.' };
    const inspect = runCli(['inspect', SESSION, '--json'], 'server-inspect.json');
    if (inspect.status !== 0) return { ok: false, phase: 'inspect', output: inspect.output };
    return { ok: true, riv, source, sourceInfo, imageInfo, imagePath };
}

const fixturePath = path.join(PROJECT, 'fixture.png');
const fixtureInfo = { name: 'fixture-320x200.png', width: 320, height: 200 };
const state = {
    serverReady: false,
    status: 'loading',
    documentId: `rive-editor-${crypto.randomUUID?.() || crypto.randomBytes(12).toString('hex')}`,
    buildId: null,
    currentSource: null,
    currentImagePath: null,
    image: null,
    angle: LIMITS.restAngle,
    progress: 0,
    dirty: false,
    reason: 'startup',
    error: null,
    savedAngle: null,
    savedBuildId: null,
    savedBundleStatus: 'absent',
    savedBundleError: null,
    currentRiv: null,
};

function promote(candidate, reason, dirty = true) {
    const buildId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const rivPath = path.join(ARTIFACTS, `${buildId}.riv`);
    const imagePath = path.join(ARTIFACTS, `${buildId}.png`);
    fs.copyFileSync(candidate.riv, rivPath);
    fs.copyFileSync(candidate.imagePath, imagePath);
    state.status = 'ready';
    state.error = null;
    state.buildId = buildId;
    state.currentSource = candidate.source;
    state.currentImagePath = imagePath;
    state.currentRiv = rivPath;
    state.image = {
        name: state.image?.name || fixtureInfo.name,
        width: candidate.imageInfo.width,
        height: candidate.imageInfo.height,
    };
    state.angle = candidate.sourceInfo.angle;
    state.dirty = dirty;
    state.reason = reason;
    return buildId;
}

function setError(reason, error) {
    state.status = 'error';
    state.error = String(error?.message || error);
    state.reason = reason;
}

function publicState() {
    return {
        ok: true,
        snapshot: makeSnapshot(state),
        status: state.status,
        error: state.error,
        artifactUrl: state.currentRiv ? `/artifact/current.riv?build=${encodeURIComponent(state.buildId)}` : null,
        imageUrl: state.currentImagePath ? `/image/current.png?build=${encodeURIComponent(state.buildId)}` : null,
        savedAngle: state.savedAngle,
        savedBuildId: state.savedBuildId,
        savedBundleStatus: state.savedBundleStatus,
        savedBundleError: state.savedBundleError,
        maxControlBytes: LIMITS.maxControlBytes,
        maxPngBytes: LIMITS.maxPngBytes,
        nonceSha256: sha256Text(STARTUP_NONCE),
    };
}

function clientState() {
    return { ...publicState(), nonce: STARTUP_NONCE };
}

function saveCurrent() {
    if (!state.currentRiv || !state.currentSource || !state.currentImagePath) throw new Error('No successful editor build is available.');
    writeText(path.join(SAVED, 'scene.rml'), state.currentSource);
    fs.copyFileSync(state.currentImagePath, path.join(SAVED, 'fixture.png'));
    fs.copyFileSync(state.currentRiv, path.join(SAVED, 'current.riv'));
    writeJson(path.join(SAVED, 'meta.json'), {
        documentId: state.documentId,
        image: state.image,
        angle: state.angle,
        sourceHash: sha256Text(state.currentSource),
        imageHash: sha256File(state.currentImagePath),
    });
    state.savedAngle = state.angle;
    state.savedBuildId = state.buildId;
    state.savedBundleStatus = 'valid';
    state.savedBundleError = null;
    state.dirty = false;
    state.reason = 'save';
}

function loadSavedBundle() {
    const saved = inspectSavedBundle();
    state.savedBundleStatus = saved.status;
    state.savedBundleError = saved.status === 'corrupt' ? saved.detail : null;
    if (saved.status === 'valid') {
        state.savedAngle = saved.sourceInfo.angle;
        state.savedBuildId = `saved-${sha256File(saved.rivPath).slice(0, 12)}`;
    }
    return saved;
}

function rebuildSaved(reason) {
    const saved = loadSavedBundle();
    if (saved.status !== 'valid') {
        const error = new Error(saved.detail || 'Saved source/image bundle is unavailable.');
        error.code = 'SAVED_STATE_REJECTED';
        throw error;
    }
    const candidate = buildCandidate(saved.source, saved.imagePath);
    if (!candidate.ok) {
        const error = new Error(`Saved bundle rebuild rejected during ${candidate.phase}: ${candidate.output.slice(-500)}`);
        error.code = 'SAVED_STATE_REJECTED';
        throw error;
    }
    if (saved.meta?.documentId) state.documentId = String(saved.meta.documentId);
    if (saved.meta?.image?.name) state.image = { ...state.image, name: sanitizeImageName(saved.meta.image.name) };
    promote(candidate, reason, false);
    state.progress = 0;
    return clientState();
}

function readBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        let size = 0;
        let settled = false;
        const chunks = [];
        req.on('data', chunk => {
            if (settled) return;
            size += chunk.length;
            if (size > maxBytes) {
                settled = true;
                const error = new Error(`request body exceeds ${maxBytes} bytes`);
                error.code = 'BODY_TOO_LARGE';
                reject(error);
                req.resume();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (!settled) {
                settled = true;
                resolve(Buffer.concat(chunks));
            }
        });
        req.on('error', error => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        });
    });
}

function parseJson(buffer) {
    const text = Buffer.from(buffer).toString('utf8');
    if (!text.trim()) return {};
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required.');
    return value;
}

function json(res, status, value) {
    const body = JSON.stringify(value);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
    });
    res.end(body);
}

function text(res, status, value, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(value);
}

function file(res, filePath, type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream') {
    if (!fs.existsSync(filePath)) return text(res, 404, 'Not found');
    const stat = fs.statSync(filePath);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'content-length': stat.size });
    fs.createReadStream(filePath).pipe(res);
}

function authorizeMutation(req, res, pathname) {
    if (req.headers.origin !== MUTATION_ORIGIN) {
        json(res, 403, { ok: false, error: 'origin-rejected', message: 'Mutation origin must match the dedicated editor origin.' });
        return false;
    }
    if (req.headers['x-editor-nonce'] !== STARTUP_NONCE) {
        json(res, 403, { ok: false, error: 'nonce-rejected', message: 'Editor startup nonce is invalid.' });
        return false;
    }
    return true;
}

function staticRoute(res, pathname) {
    const table = {
        '/': [path.join(HERE, 'editor.html'), 'text/html; charset=utf-8'],
        '/editor.html': [path.join(HERE, 'editor.html'), 'text/html; charset=utf-8'],
        '/editor.js': [path.join(HERE, 'editor.js'), 'text/javascript; charset=utf-8'],
        '/runtime.js': [path.join(HERE, 'runtime.js'), 'text/javascript; charset=utf-8'],
        '/bone-editor.js': [path.join(HERE, 'bone-editor.js'), 'text/javascript; charset=utf-8'],
        '/bone-projection.mjs': [path.join(HERE, 'bone-projection.mjs'), 'text/javascript; charset=utf-8'],
        '/runtime/canvas_advanced.mjs': [path.join(RUNTIME, 'canvas_advanced.mjs'), 'text/javascript; charset=utf-8'],
        '/runtime/rive.wasm': [path.join(RUNTIME, 'rive.wasm'), 'application/wasm'],
        '/runtime/rive_fallback.wasm': [path.join(RUNTIME, 'rive_fallback.wasm'), 'application/wasm'],
    };
    const target = table[pathname];
    if (!target) return false;
    file(res, target[0], target[1]);
    return true;
}

function initialBuild() {
    try {
        ensureDirs();
        configureCliEnvironment();
        const saved = loadSavedBundle();
        if (saved.status === 'valid') {
            const candidate = buildCandidate(saved.source, saved.imagePath);
            if (!candidate.ok) throw new Error(`Saved bundle rebuild rejected during ${candidate.phase}: ${candidate.output.slice(-500)}`);
            state.documentId = saved.meta?.documentId || state.documentId;
            state.image = { name: sanitizeImageName(saved.meta?.image?.name || fixtureInfo.name), width: candidate.imageInfo.width, height: candidate.imageInfo.height };
            promote(candidate, 'startup-saved', false);
            state.savedBundleStatus = 'valid';
            state.savedBundleError = null;
            return;
        }
        if (saved.status === 'corrupt') {
            throw new Error(saved.detail || 'Saved editor bundle is corrupt.');
        }
        const image = fs.readFileSync(fixturePath);
        const info = validatePngBytes(image);
        const candidate = buildCandidate(createSource({ width: info.width, height: info.height, angle: LIMITS.restAngle }), fixturePath);
        if (!candidate.ok) throw new Error(`Initial fixture build rejected during ${candidate.phase}: ${candidate.output.slice(-500)}`);
        state.image = { ...fixtureInfo, width: info.width, height: info.height };
        promote(candidate, 'startup-unsaved', true);
    } catch (error) {
        setError('startup-rejected', error);
        state.savedBundleError = state.savedBundleError || error.message;
    }
}

initialBuild();

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    const pathname = url.pathname;
    try {
        if (req.method === 'GET' && pathname === '/health') return json(res, 200, { app: 'tegaki.rive-editor', protocol: 1, installationId: INSTALLATION_ID, pid: process.pid });
        if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, clientState());
        if (req.method === 'GET' && pathname === '/artifact/current.riv') return state.currentRiv ? file(res, state.currentRiv, 'application/octet-stream') : text(res, 409, 'No successful editor build.');
        if (req.method === 'GET' && pathname === '/artifact/saved.riv') return file(res, path.join(SAVED, 'current.riv'), 'application/octet-stream');
        if (req.method === 'GET' && pathname === '/image/current.png') return state.currentImagePath ? file(res, state.currentImagePath, 'image/png') : text(res, 409, 'No current editor image.');
        if (req.method === 'GET' && pathname === '/image/saved.png') return file(res, path.join(SAVED, 'fixture.png'), 'image/png');
        if (req.method === 'GET' && pathname === '/fixture.png') return file(res, fixturePath, 'image/png');
        if (req.method === 'POST' && MUTATION_PATHS.has(pathname) && !authorizeMutation(req, res, pathname)) return;

        if (req.method === 'POST' && pathname === '/api/image') {
            const image = await readBody(req, LIMITS.maxPngBytes);
            const info = validatePngBytes(image);
            if (!info.ok) return json(res, 400, { ok: false, error: 'image-rejected', reason: info.reason, message: 'PNG must be RGBA, <=1024px per axis, <=1MP and <=8MiB.' });
            const name = sanitizeImageName(url.searchParams.get('name') || 'image.png');
            const uploadPath = path.join(CACHE, 'incoming-image.png');
            fs.writeFileSync(uploadPath, image);
            const source = createSource({ width: info.width, height: info.height, angle: state.angle });
            const candidate = buildCandidate(source, uploadPath);
            if (!candidate.ok) return json(res, 422, { ok: false, error: 'image-build-rejected', phase: candidate.phase, message: candidate.output.slice(-500) });
            state.image = { name, width: info.width, height: info.height };
            promote(candidate, 'image-load', true);
            state.progress = 0;
            return json(res, 200, clientState());
        }
        if (req.method === 'POST' && pathname === '/api/compile') {
            const body = parseJson(await readBody(req, LIMITS.maxControlBytes));
            const angle = assertAngle(body.angle);
            const progress = assertProgress(body.progress ?? 0);
            if (!state.image) return json(res, 409, { ok: false, error: 'no-image', message: 'Load a PNG before compiling.' });
            const candidate = buildCandidate(createSource({ width: state.image.width, height: state.image.height, angle }), state.currentImagePath);
            if (!candidate.ok) return json(res, 422, { ok: false, error: 'compile-rejected', phase: candidate.phase, message: candidate.output.slice(-500) });
            promote(candidate, 'compile', true);
            state.progress = progress;
            return json(res, 200, clientState());
        }
        if (req.method === 'POST' && pathname === '/api/save') {
            if (state.status !== 'ready') return json(res, 409, { ok: false, error: 'not-ready', message: state.error || 'Editor is not ready.' });
            saveCurrent();
            return json(res, 200, clientState());
        }
        if (req.method === 'POST' && (pathname === '/api/reopen' || pathname === '/api/cancel')) {
            try {
                const result = rebuildSaved(pathname === '/api/reopen' ? 'reopen' : 'cancel');
                return json(res, 200, result);
            } catch (error) {
                const status = error.code === 'SAVED_STATE_REJECTED' ? 409 : 422;
                return json(res, status, { ok: false, error: 'saved-state-rejected', message: error.message });
            }
        }
        if (req.method === 'POST' && pathname === '/api/png') {
            const bytes = await readBody(req, LIMITS.maxPngBytes);
            const info = validatePngBytes(bytes);
            if (!info.ok || !state.image || info.width !== state.image.width || info.height !== state.image.height) {
                return json(res, 400, { ok: false, error: 'frame-rejected', message: 'Frame PNG dimensions/format do not match the current artboard.' });
            }
            const progress = Number(url.searchParams.get('progress') || state.progress).toFixed(4).replace('.', '-');
            const output = path.join(PNGS, `frame-${progress}.png`);
            fs.writeFileSync(output, bytes);
            return json(res, 200, { ok: true, path: output, bytes: bytes.length, sha256: sha256File(output), width: info.width, height: info.height, progress: Number(progress.replace('-', '.')) });
        }
        if (req.method === 'POST' && pathname === '/api/record') {
            const body = parseJson(await readBody(req, LIMITS.maxControlBytes));
            writeJson(path.join(CACHE, 'editor-proof.json'), { ...body, recordedAt: new Date().toISOString(), state: publicState() });
            return json(res, 200, { ok: true });
        }
        if (req.method === 'GET' && staticRoute(res, pathname)) return;
        return text(res, 404, 'Not found');
    } catch (error) {
        if (error?.code === 'BODY_TOO_LARGE') return json(res, 413, { ok: false, error: 'body-too-large', message: error.message });
        if (error?.code === 'SAVED_STATE_REJECTED') return json(res, 409, { ok: false, error: 'saved-state-rejected', message: error.message });
        if (error?.message?.startsWith('Angle must') || error?.message?.startsWith('Progress must')) return json(res, 400, { ok: false, error: 'input-rejected', message: error.message });
        return json(res, 500, { ok: false, error: 'server-error', message: String(error?.message || error) });
    }
});

server.on('error', error => {
    console.error(error);
    process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
    state.serverReady = true;
    console.log(`Rive editor server listening at http://${HOST}:${PORT}/`);
    console.log(`PID=${process.pid}`);
});

function shutdown() {
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

