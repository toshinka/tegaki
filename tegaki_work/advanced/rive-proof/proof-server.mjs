import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.resolve(HERE, '..', '..');
const CACHE = path.join(WORK, '.cache', 'rive-authoring-proof');
const PROJECT = path.join(CACHE, 'project');
const SESSION = path.join(CACHE, 'server-project');
const ARTIFACTS = path.join(CACHE, 'artifacts');
const SAVED = path.join(CACHE, 'saved');
const PNGS = path.join(CACHE, 'browser-png');
const RIVE_HOME = path.join(CACHE, 'rive-home');
const CLI = path.join(CACHE, 'cli-1.3.0', 'rive.exe');
const RUNTIME = path.join(CACHE, 'runtime-2.44.0', 'package');
const PORT = 18726;
const HOST = '127.0.0.1';
const MAX_BODY = 64 * 1024;
const INITIAL_ANGLE = 30;
const MUTATION_ORIGIN = `http://${HOST}:${PORT}`;
const STARTUP_NONCE = crypto.randomBytes(24).toString('hex');
const MUTATION_PATHS = new Set(['/api/compile', '/api/save', '/api/cancel', '/api/reopen', '/api/png', '/api/record']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.riv': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

function ensureDirs() {
  for (const dir of [CACHE, SESSION, path.join(SESSION, 'build'), ARTIFACTS, SAVED, PNGS, RIVE_HOME]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const file of ['rive.yaml', 'fixture.png']) {
    const source = path.join(PROJECT, file);
    const target = path.join(SESSION, file);
    // The cache is the only source of truth for this proof fixture. Copy on each
    // startup so an intentionally regenerated PNG cannot leave a stale embedded
    // asset in the server project.
    fs.copyFileSync(source, target);
  }
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function writeJson(file, value) {
  writeText(file, JSON.stringify(value, null, 2) + '\n');
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function cliEnvironment() {
  return { ...process.env, RIVE_HOME, RIVE_ANALYTICS: '0' };
}

function radians(angle) {
  return (angle * Math.PI / 180).toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

function renderAngle(source, angle) {
  const start = radians(INITIAL_ANGLE);
  const end = radians(angle);
  let next = source.replace(
    /(<Bone length="120" rotation=")[^"]+(" name="End")/,
    `$1${start}$2`,
  );
  next = next.replace(
    /(<KeyFrameDouble value=")[^"]+(" interpolationType="linear" frame="0"\/>)/,
    `$1${start}$2`,
  );
  return next.replace(
    /(<KeyFrameDouble value=")[^"]+(" interpolationType="linear" frame="60"\/>)/,
    `$1${end}$2`,
  );
}

function angleFromSource(source) {
  const match = source.match(/<KeyFrameDouble value="([^"]+)" interpolationType="linear" frame="60"\/>/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? Math.round(value * 180 / Math.PI * 1000) / 1000 : null;
}

function runCli(args, logName) {
  const result = spawnSync(CLI, args, {
    cwd: CACHE,
    env: cliEnvironment(),
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = `${stdout}${stderr}`;
  writeText(path.join(CACHE, logName), output);
  return { status: result.status ?? -1, output };
}

function configureCliEnvironment() {
  fs.mkdirSync(RIVE_HOME, { recursive: true });
  const off = runCli(['analytics', 'off'], 'server-analytics-off.log');
  if (off.status !== 0 || !/analytics\s+off/i.test(off.output)) {
    throw new Error(`Rive CLI analytics off failed: ${off.output.slice(-600)}`);
  }
  const status = runCli(['analytics'], 'server-analytics-status.log');
  if (status.status !== 0 || !/analytics\s+off/i.test(status.output)) {
    throw new Error(`Rive CLI analytics status was not off: ${status.output.slice(-600)}`);
  }
  writeJson(path.join(CACHE, 'cli-environment.json'), {
    riveHome: RIVE_HOME,
    riveAnalytics: '0',
    analyticsCommand: 'off',
    processOnly: true,
  });
}

function buildCandidate(source, imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    return { ok: false, phase: 'asset', output: `Missing saved image asset: ${imagePath || '(none)'}` };
  }
  let imageBytes;
  try {
    imageBytes = fs.readFileSync(imagePath);
  } catch (error) {
    return { ok: false, phase: 'asset', output: `Cannot read image asset: ${error.message}` };
  }
  const imageInfo = pngInfo(imageBytes);
  if (!imageInfo || imageBytes.length < 64 || imageInfo.width !== 240 || imageInfo.height !== 160 || imageInfo.bitDepth !== 8 || imageInfo.colorType !== 6) {
    return { ok: false, phase: 'asset', output: `Saved image asset is not the expected RGBA 240x160 PNG: ${imagePath}` };
  }
  writeText(path.join(SESSION, 'scene.rml'), source);
  fs.writeFileSync(path.join(SESSION, 'fixture.png'), imageBytes);
  const verify = runCli([SESSION, '--verify', '--format=json'], 'server-verify.log');
  if (verify.status !== 0) return { ok: false, phase: 'verify', output: verify.output };
  const build = runCli([SESSION, '--once', '--format=json'], 'server-once.log');
  if (build.status !== 0) return { ok: false, phase: 'build', output: build.output };
  const riv = path.join(SESSION, 'build', 'rive_authoring_proof.riv');
  if (!fs.existsSync(riv)) return { ok: false, phase: 'build', output: 'Rive CLI did not write the expected .riv.' };
  const inspect = runCli(['inspect', SESSION, '--json'], 'server-inspect.json');
  if (inspect.status !== 0) return { ok: false, phase: 'inspect', output: inspect.output };
  return { ok: true, riv, source, imagePath, inspect: inspect.output };
}

const baseSource = fs.readFileSync(path.join(PROJECT, 'scene.rml'), 'utf8');
let state = {
  ready: false,
  angle: INITIAL_ANGLE,
  scrub: 0,
  savedAngle: INITIAL_ANGLE,
  buildId: null,
  savedBuildId: null,
  currentSource: baseSource,
  currentImagePath: path.join(PROJECT, 'fixture.png'),
  savedSource: null,
  savedImagePath: null,
  currentRiv: null,
  rejected: [],
  savedBundleStatus: 'absent',
  savedBundleError: null,
};

function promote(candidate, reason) {
  const buildId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const target = path.join(ARTIFACTS, `${buildId}.riv`);
  const imageTarget = path.join(ARTIFACTS, `${buildId}.png`);
  fs.copyFileSync(candidate.riv, target);
  fs.copyFileSync(candidate.imagePath, imageTarget);
  state.ready = true;
  state.angle = angleFromSource(candidate.source) ?? state.angle;
  state.currentSource = candidate.source;
  state.currentImagePath = imageTarget;
  state.currentRiv = target;
  state.buildId = buildId;
  state.lastReason = reason;
  state.lastCompile = new Date().toISOString();
  return buildId;
}

function saveCurrent() {
  if (!state.currentRiv || !state.currentSource || !state.currentImagePath || !fs.existsSync(state.currentImagePath)) throw new Error('No successful source/image/build is available.');
  writeText(path.join(SAVED, 'scene.rml'), state.currentSource);
  fs.copyFileSync(state.currentImagePath, path.join(SAVED, 'fixture.png'));
  const savedRiv = path.join(SAVED, 'current.riv');
  fs.copyFileSync(state.currentRiv, savedRiv);
  state.savedSource = state.currentSource;
  state.savedImagePath = path.join(SAVED, 'fixture.png');
  state.savedAngle = state.angle;
  state.savedBuildId = state.buildId;
  state.savedBundleStatus = 'valid';
  state.savedBundleError = null;
}

function inspectSavedBundle() {
  const sourcePath = path.join(SAVED, 'scene.rml');
  const imagePath = path.join(SAVED, 'fixture.png');
  const rivPath = path.join(SAVED, 'current.riv');
  const paths = [sourcePath, imagePath, rivPath];
  const any = paths.some((filePath) => fs.existsSync(filePath));
  if (!any) return { status: 'absent', sourcePath, imagePath, rivPath };
  const missing = paths.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) return { status: 'corrupt', detail: `Saved bundle missing: ${missing.join(', ')}`, sourcePath, imagePath, rivPath };
  try {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const image = fs.readFileSync(imagePath);
    const riv = fs.readFileSync(rivPath);
    const imageInfo = pngInfo(image);
    const validPng = image.length >= 64 && imageInfo && imageInfo.width === 240 && imageInfo.height === 160 && imageInfo.bitDepth === 8 && imageInfo.colorType === 6;
    if (!source.trim() || !validPng || riv.length < 64) {
      return { status: 'corrupt', detail: 'Saved bundle source, PNG, or .riv is empty/corrupt.', sourcePath, imagePath, rivPath };
    }
    return { status: 'valid', source, sourcePath, imagePath, rivPath };
  } catch (error) {
    return { status: 'corrupt', detail: `Saved bundle read failed: ${error.message}`, sourcePath, imagePath, rivPath };
  }
}

function loadSavedBundle() {
  const bundle = inspectSavedBundle();
  state.savedBundleStatus = bundle.status;
  state.savedBundleError = bundle.status === 'corrupt' ? bundle.detail : null;
  if (bundle.status !== 'valid') return bundle;
  state.savedSource = bundle.source;
  state.savedImagePath = bundle.imagePath;
  state.savedAngle = angleFromSource(bundle.source);
  return bundle;
}

function publicState() {
  return {
    ok: state.ready,
    angle: state.angle,
    scrub: state.scrub,
    savedAngle: state.savedAngle,
    buildId: state.buildId,
    savedBuildId: state.savedBuildId,
    savedBundleStatus: state.savedBundleStatus,
    savedBundleError: state.savedBundleError,
    lastReason: state.lastReason || 'startup',
    lastCompile: state.lastCompile || null,
    sourceSha256: crypto.createHash('sha256').update(state.currentSource || '').digest('hex'),
    rivSha256: state.currentRiv && fs.existsSync(state.currentRiv) ? sha256(state.currentRiv) : null,
    rejected: state.rejected.slice(-8),
    maxBodyBytes: MAX_BODY,
    nonceSha256: crypto.createHash('sha256').update(STARTUP_NONCE).digest('hex'),
    artifactUrl: state.currentRiv ? `/artifact/current.riv?build=${encodeURIComponent(state.buildId)}` : null,
  };
}

function clientState() {
  return { ...publicState(), nonce: STARTUP_NONCE };
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
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        settled = true;
        const error = new Error(`request body exceeds ${MAX_BODY} bytes`);
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
    req.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function parseJsonBody(raw) {
  const textValue = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  if (!textValue.trim()) return {};
  const value = JSON.parse(textValue);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required');
  return value;
}

function rejectRequest(kind, detail) {
  state.rejected.push({ kind, detail, at: new Date().toISOString() });
}

function authorizeMutation(req, res, pathname) {
  if (req.headers.origin !== MUTATION_ORIGIN) {
    rejectRequest('origin', `${pathname}: mutation origin rejected`);
    json(res, 403, { ok: false, error: 'origin-rejected', message: 'Mutation origin must match the dedicated proof origin.' });
    return false;
  }
  if (req.headers['x-proof-nonce'] !== STARTUP_NONCE) {
    rejectRequest('nonce', `${pathname}: startup nonce rejected`);
    json(res, 403, { ok: false, error: 'nonce-rejected', message: 'Mutation startup nonce is invalid.' });
    return false;
  }
  return true;
}

function pngInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 26 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71 || bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) return null;
  const width = (bytes[16] * 16777216) + (bytes[17] * 65536) + (bytes[18] * 256) + bytes[19];
  const height = (bytes[20] * 16777216) + (bytes[21] * 65536) + (bytes[22] * 256) + bytes[23];
  return { width, height, bitDepth: bytes[24], colorType: bytes[25] };
}

function staticRoute(res, pathname) {
  const table = {
    '/': [path.join(HERE, 'proof.html'), 'text/html; charset=utf-8'],
    '/proof.html': [path.join(HERE, 'proof.html'), 'text/html; charset=utf-8'],
    '/proof-client.js': [path.join(HERE, 'proof-client.js'), 'text/javascript; charset=utf-8'],
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
  ensureDirs();
  try {
    configureCliEnvironment();
  } catch (error) {
    console.error(`Rive proof startup failed during CLI environment setup:\n${error.message}`);
    return;
  }
  const saved = loadSavedBundle();
  if (saved.status === 'valid') {
    const candidate = buildCandidate(saved.source, saved.imagePath);
    if (candidate.ok) {
      const buildId = promote(candidate, 'startup-saved');
      state.savedBuildId = `saved-${sha256(saved.rivPath).slice(0, 12)}`;
      state.savedAngle = angleFromSource(saved.source);
      state.savedBundleStatus = 'valid';
      state.savedBundleError = null;
      return buildId;
    }
    saved.status = 'corrupt';
    saved.detail = `Saved bundle rebuild failed during ${candidate.phase}: ${candidate.output.slice(-600)}`;
    state.savedBundleStatus = 'corrupt';
    state.savedBundleError = saved.detail;
    rejectRequest('startup-saved', saved.detail);
  }
  if (saved.status === 'corrupt') {
    state.savedSource = null;
    state.savedImagePath = null;
    state.savedAngle = null;
    state.savedBuildId = null;
    const fallback = buildCandidate(renderAngle(baseSource, INITIAL_ANGLE), path.join(PROJECT, 'fixture.png'));
    if (!fallback.ok) {
      console.error(`Rive proof startup fallback failed during ${fallback.phase}:\n${fallback.output}`);
      return;
    }
    promote(fallback, 'startup-fallback');
    return;
  }
  const candidate = buildCandidate(renderAngle(baseSource, INITIAL_ANGLE), path.join(PROJECT, 'fixture.png'));
  if (!candidate.ok) {
    console.error(`Rive proof startup failed during ${candidate.phase}:\n${candidate.output}`);
    return;
  }
  promote(candidate, 'startup');
  saveCurrent();
}

initialBuild();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;
  try {
    if (req.method === 'GET' && pathname === '/health') {
      return state.ready ? text(res, 200, 'ok') : text(res, 503, 'starting');
    }
    if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, clientState());
    if (req.method === 'GET' && pathname === '/artifact/current.riv') {
      return state.currentRiv ? file(res, state.currentRiv, 'application/octet-stream') : text(res, 503, 'No build');
    }
    if (req.method === 'GET' && pathname === '/artifact/saved.riv') {
      return file(res, path.join(SAVED, 'current.riv'), 'application/octet-stream');
    }
    if (req.method === 'POST' && MUTATION_PATHS.has(pathname) && !authorizeMutation(req, res, pathname)) return;
    if (req.method === 'POST' && pathname === '/api/compile') {
      const body = parseJsonBody(await readBody(req));
      const angle = typeof body.angle === 'number' ? body.angle : Number.NaN;
      const scrub = typeof body.scrub === 'number' ? body.scrub : 0;
      if (!Number.isFinite(angle) || angle < -90 || angle > 90) {
        rejectRequest('angle', 'Angle must be a finite number between -90 and 90 degrees.');
        return json(res, 400, { ok: false, error: 'angle-rejected', message: 'Use a finite end angle from -90 to 90 degrees.' });
      }
      if (!Number.isFinite(scrub) || scrub < 0 || scrub > 1) {
        rejectRequest('scrub', 'Scrub must be between 0 and 1.');
        return json(res, 400, { ok: false, error: 'scrub-rejected', message: 'Scrub must be between 0 and 1.' });
      }
      const source = renderAngle(state.currentSource, angle);
      const candidate = buildCandidate(source, state.currentImagePath);
      if (!candidate.ok) {
        rejectRequest('compile', `${candidate.phase}: ${candidate.output.slice(-600)}`);
        return json(res, 422, { ok: false, error: 'compile-rejected', phase: candidate.phase, message: 'The last good build was retained.' });
      }
      promote(candidate, 'compile');
      state.scrub = scrub;
      return json(res, 200, { ...clientState(), ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/save') {
      saveCurrent();
      return json(res, 200, { ...clientState(), saved: true });
    }
    if (req.method === 'POST' && pathname === '/api/cancel') {
      const saved = loadSavedBundle();
      if (saved.status !== 'valid') {
        rejectRequest('cancel', saved.detail || 'No saved source/image bundle is available.');
        return json(res, 409, { ok: false, error: 'saved-state-rejected', message: saved.detail || 'No saved source/image bundle is available.' });
      }
      const candidate = buildCandidate(saved.source, saved.imagePath);
      if (!candidate.ok) {
        rejectRequest('cancel', `${candidate.phase}: ${candidate.output}`);
        return json(res, 422, { ok: false, error: 'saved-state-rejected', phase: candidate.phase, message: 'Saved source/image rebuild was rejected; the last good build remains loaded.' });
      }
      promote(candidate, 'cancel');
      state.scrub = 0;
      return json(res, 200, { ...clientState(), cancelled: true });
    }
    if (req.method === 'POST' && pathname === '/api/reopen') {
      const body = parseJsonBody(await readBody(req));
      if (body.corrupt === 'source') {
        const candidate = buildCandidate('<Rive version="1" kind="fragment"><Artboard', state.currentImagePath);
        rejectRequest('source', `${candidate.phase || 'unknown'}: corrupt source bundle rejected`);
        return json(res, 400, { ok: false, error: 'source-rejected', phase: candidate.phase, message: 'Corrupt source was rejected; the last good build remains loaded.' });
      }
      if (body.corrupt === 'riv') {
        rejectRequest('riv', 'Browser requested a corrupt .riv load.');
        return json(res, 400, { ok: false, error: 'riv-rejected', message: 'Corrupt .riv load is intentionally rejected.' });
      }
      const saved = loadSavedBundle();
      if (saved.status !== 'valid') {
        rejectRequest('reopen', saved.detail || 'Saved source/image bundle is unavailable.');
        return json(res, 409, { ok: false, error: 'saved-state-rejected', message: saved.detail || 'Saved source/image bundle is unavailable; the last good build remains loaded.' });
      }
      const candidate = buildCandidate(saved.source, saved.imagePath);
      if (!candidate.ok) {
        rejectRequest('reopen', `${candidate.phase}: ${candidate.output.slice(-600)}`);
        return json(res, 422, { ok: false, error: 'reopen-rejected', phase: candidate.phase, message: 'The last good build was retained.' });
      }
      promote(candidate, 'reopen');
      state.scrub = 0;
      return json(res, 200, { ...clientState(), reopened: true });
    }
    if (req.method === 'POST' && pathname === '/api/png') {
      const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
      if (contentType !== 'application/octet-stream') return json(res, 415, { ok: false, error: 'png-binary-required' });
      const bytes = await readBody(req);
      const info = pngInfo(bytes);
      if (!info || bytes.length < 64 || !((info.width === 400 && info.height === 300) || (info.width === 800 && info.height === 600)) || info.colorType !== 6) {
        return json(res, 400, { ok: false, error: 'png-size-or-format' });
      }
      const pose = String(new URL(req.url || '/', MUTATION_ORIGIN).searchParams.get('pose') || 'pose').replace(/[^a-z0-9_-]/gi, '_').slice(0, 32);
      const output = path.join(PNGS, `${pose}.png`);
      fs.writeFileSync(output, bytes);
      return json(res, 200, { ok: true, pose, path: output, bytes: bytes.length, sha256: sha256(output) });
    }
    if (req.method === 'POST' && pathname === '/api/record') {
      const body = parseJsonBody(await readBody(req));
      writeJson(path.join(CACHE, 'browser-proof.json'), { ...body, recordedAt: new Date().toISOString(), state: publicState() });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && pathname === '/fixture.png') return file(res, path.join(PROJECT, 'fixture.png'), 'image/png');
    if (req.method === 'GET' && staticRoute(res, pathname)) return;
    text(res, 404, 'Not found');
  } catch (error) {
    if (error?.code === 'BODY_TOO_LARGE') {
      rejectRequest('body', error.message);
      return json(res, 413, { ok: false, error: 'body-too-large', message: `Mutation body must be <= ${MAX_BODY} bytes.` });
    }
    json(res, 500, { ok: false, error: 'server-error', message: String(error?.message || error) });
  }
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Rive authoring proof server listening at http://${HOST}:${PORT}/`);
  console.log(`PID=${process.pid}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
