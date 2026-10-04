/**
 * ROLE: WP-032 standalone GUI、iframe protocol、End bone の native preview bridge。
 * AUTHORITY: server の snapshot を表示し、native runtime は preview/receipt 派生。host Project/History は所有しない。
 * INVARIANTS: loopback origin+event source+session/version、ready/非previewだけ frame、bone previewはpointermoveでcompileしない。
 * RELATED: runtime.js、bone-editor.js、bone-projection.mjs、server.mjs、ui/rive-editor-entry.js、WP-032。
 */
import { BoneEditorController } from './bone-editor.js';
import { RiveNativeRuntime, imageMetrics } from './runtime.js';

const PROTOCOL_VERSION = 1;
const SNAPSHOT_SCHEMA = 'tegaki.rive-editor.state.v1';
const MAX_PNG_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1024;
const MAX_PIXELS = 1024 * 1024;

const root = document.querySelector('#rive-editor');
const canvas = document.querySelector('#preview');
const statusNode = document.querySelector('#status');
const snapshotNode = document.querySelector('#snapshot');
const pixelInspectButton = document.querySelector('#pixel-inspect');
const pixelReportNode = document.querySelector('#pixel-report');
const imageInput = document.querySelector('#image-input');
const angleInput = document.querySelector('#angle');
const progressInput = document.querySelector('#progress');
const progressValue = document.querySelector('#progress-value');
const boneOverlay = document.querySelector('#bone-overlay');
const boneLine = document.querySelector('#bone-line');
const boneHandle = document.querySelector('#rive-bone-end');

let apiState = null;
let snapshot = null;
let runtime = new RiveNativeRuntime(canvas);
let lastFrame = null;
let parentOrigin = null;
let sessionId = null;
let busy = false;
let editorDisposed = false;
let boneController = null;
let boneGeneration = 0;
let boneBaselineSnapshot = null;
let pixelInspectionGeneration = 0;
const handledRequests = new Set();
const operationControls = [
    imageInput,
    angleInput,
    document.querySelector('#apply'),
    progressInput,
    document.querySelector('#save'),
    document.querySelector('#reopen'),
    document.querySelector('#cancel'),
    document.querySelector('#save-frame'),
];

function setBusy(next) {
    if (editorDisposed) return;
    busy = next === true;
    root.dataset.editorBusy = String(busy);
    for (const control of operationControls) if (control) control.disabled = busy;
    boneController?.refresh();
}

async function runOperation(label, operation) {
    if (busy) return;
    setBusy(true);
    try {
        return await operation();
    } finally {
        setBusy(false);
    }
}

function loopbackOrigin(value) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:') return null;
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return null;
        return parsed.origin;
    } catch {
        return null;
    }
}

function readPngHeader(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) throw new Error('PNGヘッダーを読み取れません。');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') throw new Error('PNGのIHDRが不正です。');
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
        throw new Error('PNGは1辺1024px以下、かつ1MP以下にしてください。');
    }
    return { width, height };
}

function dataUrlBytes(dataUrl) {
    const encoded = dataUrl.slice('data:image/png;base64,'.length);
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

async function normalizePngFile(file) {
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    if (sourceBytes.byteLength > MAX_PNG_BYTES) throw new Error('PNGは8MiB以下にしてください。');
    const header = readPngHeader(sourceBytes);
    if (typeof createImageBitmap !== 'function') throw new Error('ブラウザのPNG native decodeが利用できません。');
    let bitmap;
    try {
        bitmap = await createImageBitmap(new Blob([sourceBytes], { type: 'image/png' }));
    } catch {
        throw new Error('PNGのブラウザnative decodeに失敗しました。');
    }
    try {
        if (bitmap.width !== header.width || bitmap.height !== header.height) throw new Error('PNG実寸の検証に失敗しました。');
        const normalizedCanvas = document.createElement('canvas');
        normalizedCanvas.width = header.width;
        normalizedCanvas.height = header.height;
        const context = normalizedCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
        if (!context) throw new Error('PNG正規化Canvasを作成できません。');
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, header.width, header.height);
        context.drawImage(bitmap, 0, 0, header.width, header.height);
        const normalizedBytes = dataUrlBytes(normalizedCanvas.toDataURL('image/png'));
        if (normalizedBytes.byteLength > MAX_PNG_BYTES) throw new Error('正規化後のPNGが8MiBを超えました。');
        return { bytes: normalizedBytes, width: header.width, height: header.height };
    } finally {
        bitmap.close?.();
    }
}

function readEmbedTarget() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    sessionId = hash.get('session');
    const parent = hash.get('parent');
    parentOrigin = loopbackOrigin(parent);
    if (!sessionId || sessionId.length > 128) sessionId = `standalone-${crypto.randomUUID?.() || Date.now()}`;
}

function setStatus(message, kind = '') {
    if (editorDisposed) return;
    statusNode.textContent = message;
    statusNode.classList.remove('status-error', 'status-ready');
    if (kind === 'error') statusNode.classList.add('status-error');
    if (kind === 'ready') statusNode.classList.add('status-ready');
}

function setSnapshot(next, reason = null) {
    if (editorDisposed) return;
    const previewAngle = next?.previewAngle === null || next?.previewAngle === undefined
        ? null
        : Number.isFinite(Number(next.previewAngle)) ? Number(next.previewAngle) : null;
    snapshot = {
        schema: SNAPSHOT_SCHEMA,
        status: next?.status || 'error',
        documentId: next?.documentId || null,
        buildId: next?.buildId || null,
        sourceHash: next?.sourceHash || null,
        image: next?.image || null,
        angle: next?.angle ?? null,
        progress: next?.progress ?? 0,
        dirty: next?.dirty === true,
        reason: reason || next?.reason || null,
        selectedBone: next?.selectedBone || null,
        editPhase: next?.editPhase || 'idle',
        previewAngle,
    };
    root.dataset.editorStatus = snapshot.status;
    statusNode.dataset.editorStatus = snapshot.status;
    snapshotNode.textContent = JSON.stringify(snapshot, null, 2);
    sendState();
}

function digestHex(buffer) {
    return Array.from(new Uint8Array(buffer), value => value.toString(16).padStart(2, '0')).join('');
}

function countTransparentPixels(imageData) {
    let transparentPixels = 0;
    for (let index = 3; index < imageData.data.length; index += 4) {
        if (imageData.data[index] === 0) transparentPixels += 1;
    }
    return transparentPixels;
}

function capturedPixelSnapshot() {
    if (!snapshot) return null;
    return {
        status: snapshot.status,
        angle: snapshot.angle,
        progress: snapshot.progress,
        editPhase: snapshot.editPhase,
        previewAngle: snapshot.previewAngle,
        sourceHash: snapshot.sourceHash,
        buildId: snapshot.buildId,
    };
}

async function inspectNativePixels() {
    const inspectionId = ++pixelInspectionGeneration;
    const stateAtCapture = snapshot;
    const capturedSnapshot = capturedPixelSnapshot();
    const capturedAt = new Date().toISOString();
    const baseReport = {
        schema: 'tegaki.rive-editor.pixel-inspection.v1',
        capturedAt,
        capturedSnapshot,
        angle: capturedSnapshot?.angle ?? null,
        progress: capturedSnapshot?.progress ?? null,
        editPhase: capturedSnapshot?.editPhase ?? null,
        previewAngle: capturedSnapshot?.previewAngle ?? null,
        sourceHash: capturedSnapshot?.sourceHash ?? null,
        overlayComposited: false,
    };
    try {
        const width = Number(runtime?.width || canvas?.width || 0);
        const height = Number(runtime?.height || canvas?.height || 0);
        if (!runtime?.context || width <= 0 || height <= 0) throw new Error('Native canvas is unavailable.');
        const imageData = runtime.context.getImageData(0, 0, width, height);
        const rgbaBytes = new Uint8Array(imageData.data);
        const metrics = imageMetrics(imageData);
        const pending = {
            ...baseReport,
            width: imageData.width,
            height: imageData.height,
            transparentPixels: countTransparentPixels(imageData),
            alphaPixels: metrics.alphaPixels,
            bbox: metrics.bbox,
            rgbaSha256: null,
            hashStatus: 'pending',
            staleDuringHash: false,
        };
        if (pixelReportNode && !editorDisposed && inspectionId === pixelInspectionGeneration) {
            pixelReportNode.textContent = JSON.stringify(pending, null, 2);
        }
        const digest = await globalThis.crypto?.subtle?.digest('SHA-256', rgbaBytes);
        if (!digest) throw new Error('Web Crypto SHA-256 is unavailable.');
        const staleDuringHash = editorDisposed || inspectionId !== pixelInspectionGeneration || snapshot !== stateAtCapture;
        const report = {
            ...pending,
            rgbaSha256: digestHex(digest),
            hashStatus: 'complete',
            staleDuringHash,
            hashedAt: new Date().toISOString(),
        };
        if (pixelReportNode && !editorDisposed && inspectionId === pixelInspectionGeneration) {
            pixelReportNode.textContent = JSON.stringify(report, null, 2);
        }
    } catch (error) {
        if (pixelReportNode && !editorDisposed && inspectionId === pixelInspectionGeneration) {
            pixelReportNode.textContent = JSON.stringify({
                ...baseReport,
                hashStatus: 'error',
                staleDuringHash: editorDisposed || inspectionId !== pixelInspectionGeneration || snapshot !== stateAtCapture,
                error: error?.message || String(error),
            }, null, 2);
        }
    }
}

function setLocalState(changes, message = null, kind = '') {
    setSnapshot({ ...snapshot, ...changes }, changes.reason || snapshot?.reason);
    if (message) setStatus(message, kind);
}

function restoreRejected(previous, operation, error) {
    const reason = `${operation}-rejected`;
    const hasGoodState = previous?.status === 'ready' && previous.buildId && previous.sourceHash && previous.image;
    if (previous) {
        setSnapshot({ ...previous, status: hasGoodState ? 'ready' : 'error', reason }, reason);
    } else {
        setSnapshot({ status: 'error', reason }, reason);
    }
    setStatus(error?.message || `${operation} failed.`, 'error');
}

function sendState() {
    if (!parentOrigin || window.parent === window) return;
    window.parent.postMessage({
        type: 'tegaki:rive-editor:state',
        version: PROTOCOL_VERSION,
        sessionId,
        state: snapshot,
    }, parentOrigin);
}

function sendError(requestId, reason) {
    if (!parentOrigin || window.parent === window) return;
    window.parent.postMessage({
        type: 'tegaki:rive-editor:error',
        version: PROTOCOL_VERSION,
        sessionId,
        requestId,
        reason: String(reason || 'frame-request-rejected'),
    }, parentOrigin);
}

async function responseValue(response) {
    let value = null;
    try { value = await response.json(); } catch { value = { ok: false, error: 'invalid-response' }; }
    if (!response.ok || value?.ok === false) {
        const error = new Error(value?.message || value?.error || `Request failed: ${response.status}`);
        error.code = value?.error || `http-${response.status}`;
        throw error;
    }
    return value;
}

async function getState() {
    const response = await fetch(`/api/state?ts=${Date.now()}`, { cache: 'no-store' });
    const value = await responseValue(response);
    apiState = value;
    return value;
}

async function postJson(endpoint, body = {}) {
    if (!apiState?.nonce) throw new Error('Editor startup nonce is unavailable.');
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-editor-nonce': apiState.nonce },
        body: JSON.stringify(body),
    });
    return responseValue(response);
}

async function postPng(endpoint, bytes) {
    if (!apiState?.nonce) throw new Error('Editor startup nonce is unavailable.');
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream', 'x-editor-nonce': apiState.nonce },
        body: bytes,
    });
    return responseValue(response);
}

async function record(phase, extra = {}) {
    try {
        await postJson('/api/record', { phase, snapshot, ...extra });
    } catch {
        // Evidence recording must not replace the current good editor state.
    }
}

async function loadRuntime(value) {
    if (editorDisposed) throw new Error('Editor is disposed.');
    if (!value?.artifactUrl || !value.snapshot?.image) throw new Error(value?.error || 'No native Rive artifact is available.');
    await runtime.load(value.artifactUrl, value.snapshot.image.width, value.snapshot.image.height);
    if (editorDisposed) throw new Error('Editor is disposed.');
    angleInput.value = String(value.snapshot.angle ?? 30);
    progressInput.value = String(value.snapshot.progress ?? 0);
    progressValue.value = Number(value.snapshot.progress ?? 0).toFixed(2);
    lastFrame = runtime.render(Number(value.snapshot.progress ?? 0));
}

async function applyState(value, message = null) {
    if (editorDisposed) throw new Error('Editor is disposed.');
    apiState = value;
    if (value.snapshot?.status === 'error') {
        setSnapshot(value.snapshot, value.snapshot?.reason);
        setStatus(value.error || value.snapshot.reason || 'Editor state is unavailable.', 'error');
        return;
    }
    setSnapshot({ ...value.snapshot, status: 'loading', reason: 'native-load' }, 'native-load');
    await loadRuntime(value);
    if (editorDisposed) throw new Error('Editor is disposed.');
    setSnapshot({ ...value.snapshot, status: 'ready' }, value.snapshot?.reason);
    boneController?.refresh();
    if (message) setStatus(message, 'ready');
}

async function compileAngle() {
    const previous = snapshot;
    setLocalState({ status: 'building', reason: 'compile' }, '公式CLIで変形をコンパイル中…');
    try {
        const value = await postJson('/api/compile', { angle: Number(angleInput.value), progress: Number(progressInput.value) });
        await applyState(value, `終点角${value.snapshot.angle}°を適用しました。`);
        await record('compile');
    } catch (error) {
        restoreRejected(previous, 'compile', error);
    }
}

function boneContext() {
    const active = boneController?.machine?.getState?.();
    if (!snapshot || !runtime || (snapshot.status !== 'ready' && !active)) return { status: snapshot?.status || 'error' };
    return {
        status: active ? 'ready' : snapshot.status,
        selectedBone: 'End',
        angle: active?.originalAngle ?? snapshot.angle,
        progress: active?.originalProgress ?? snapshot.progress,
        dirty: active?.originalDirty ?? snapshot.dirty,
        projection: runtime.getEndBoneProjection(canvas.getBoundingClientRect()),
    };
}

function setBonePreviewSnapshot(angle, phase = 'preview', reason = 'bone-edit-preview') {
    if (!snapshot) return;
    setSnapshot({
        ...snapshot,
        status: 'building',
        selectedBone: 'End',
        editPhase: phase,
        previewAngle: angle,
        reason,
    }, reason);
}

function restoreBoneSnapshot(session, reason = 'cancel') {
    boneGeneration += 1;
    try { runtime.restorePose(session.originalProgress); } catch {}
    angleInput.value = String(session.originalAngle);
    progressInput.value = String(session.originalProgress);
    progressValue.value = Number(session.originalProgress).toFixed(2);
    if (snapshot) {
        setSnapshot({
            ...snapshot,
            status: 'ready',
            angle: session.originalAngle,
            progress: session.originalProgress,
            dirty: session.originalDirty,
            selectedBone: null,
            editPhase: 'idle',
            previewAngle: null,
            reason: `bone-edit-${reason}`,
        }, `bone-edit-${reason}`);
    }
    boneBaselineSnapshot = null;
    boneController?.refresh();
    setStatus('骨のプレビューを取り消しました。', 'ready');
}

async function commitBoneAngle(request) {
    const previous = boneBaselineSnapshot || snapshot;
    const token = ++boneGeneration;
    const angle = Number(request.angle);
    const progress = 1;
    if (!previous || previous.status !== 'ready' || !Number.isFinite(angle) || !Number.isFinite(progress)) {
        return { ok: false, reason: 'bone-commit-state-invalid' };
    }
    setBonePreviewSnapshot(angle, 'commit', 'bone-edit-commit');
    setStatus(`終点角${angle}°を公式CLIで一度だけ確定中…`);
    try {
        const value = await postJson('/api/compile', { angle, progress });
        if (editorDisposed || token !== boneGeneration) return { ok: false, reason: 'bone-commit-stale', suppressCancel: true };
        await applyState(value, `終点角${value.snapshot.angle}°を適用しました。`);
        if (editorDisposed || token !== boneGeneration) return { ok: false, reason: 'bone-commit-stale', suppressCancel: true };
        await record('bone-edit-commit', { bone: { selectedBone: 'End', angle: value.snapshot.angle, progress } });
        if (editorDisposed) return { ok: false, reason: 'bone-commit-stale', suppressCancel: true };
        boneBaselineSnapshot = null;
        setBusy(false);
        return { ok: true };
    } catch (error) {
        if (!editorDisposed && token === boneGeneration) {
            try { runtime.restorePose(previous.progress); } catch {}
            restoreRejected(previous, 'bone-edit-commit', error);
            boneBaselineSnapshot = null;
            boneController?.refresh();
        }
        if (!editorDisposed) setBusy(false);
        return {
            ok: false,
            reason: editorDisposed || token !== boneGeneration ? 'bone-commit-stale' : (error?.message || 'bone-commit-rejected'),
            suppressCancel: editorDisposed || token !== boneGeneration,
        };
    }
}

async function loadImage(file) {
    if (!file) return;
    const previous = snapshot;
    if (file.size > MAX_PNG_BYTES) {
        restoreRejected(previous, 'image-load', new Error('PNGは8MiB以下にしてください。'));
        return;
    }
    setLocalState({ status: 'building', reason: 'image-load' }, 'PNG素材を検証して読み込み中…');
    try {
        const normalized = await normalizePngFile(file);
        const value = await postPng(`/api/image?name=${encodeURIComponent(file.name)}`, normalized.bytes);
        await applyState(value, `PNG素材${value.snapshot.image.width}×${value.snapshot.image.height}をRGBA8透明PNGへ正規化しました。`);
        setSnapshot({ ...value.snapshot, reason: 'image-load-rgba8-normalized' }, 'image-load-rgba8-normalized');
        await record('image-load', { normalized: { width: normalized.width, height: normalized.height, bytes: normalized.bytes.byteLength } });
    } catch (error) {
        restoreRejected(previous, 'image-load', error);
    }
}

async function saveSource() {
    const previous = snapshot;
    try {
        const value = await postJson('/api/save');
        await applyState(value, `source＋PNGを${value.snapshot.angle}°で保存しました。`);
        await record('save');
    } catch (error) {
        restoreRejected(previous, 'save', error);
    }
}

async function reopenSource() {
    const previous = snapshot;
    setLocalState({ status: 'building', reason: 'reopen' }, '保存済みsource＋PNGを再構築中…');
    try {
        const value = await postJson('/api/reopen');
        await applyState(value, `保存済み${value.snapshot.angle}°を再読込しました。`);
        await record('reopen');
    } catch (error) {
        restoreRejected(previous, 'reopen', error);
    }
}

async function cancelSource() {
    const previous = snapshot;
    setLocalState({ status: 'building', reason: 'cancel' }, '保存済み良好状態へ戻しています…');
    try {
        const value = await postJson('/api/cancel');
        await applyState(value, `保存済み${value.snapshot.angle}°へ戻しました。`);
        await record('cancel');
    } catch (error) {
        restoreRejected(previous, 'cancel', error);
    }
}

async function saveCurrentFrame() {
    if (!runtime || !snapshot || snapshot.status !== 'ready') {
        setStatus('native runtimeが未接続です。', 'error');
        return;
    }
    try {
        lastFrame = runtime.render(Number(progressInput.value));
        const value = await postPng(`/api/png?progress=${encodeURIComponent(progressInput.value)}`, lastFrame.png);
        setStatus(`現在フレームの透明1x PNGを保存しました（${value.width}×${value.height}）。`, 'ready');
        await record('frame-png', { frame: { width: value.width, height: value.height, progress: value.progress, sha256: value.sha256, bytes: value.bytes } });
    } catch (error) {
        restoreRejected(snapshot, 'frame-png', error);
    }
}

function scrub() {
    if (busy || !runtime || !snapshot || snapshot.status !== 'ready') return;
    const previous = snapshot;
    const progress = Number(progressInput.value);
    progressValue.value = progress.toFixed(2);
    try {
        lastFrame = runtime.render(progress);
        setLocalState({ status: 'ready', progress, reason: 'scrub' });
        boneController?.refresh();
    } catch (error) {
        restoreRejected(previous, 'scrub', error);
    }
}

async function handleFrameRequest(event) {
    const data = event.data;
    if (!data || data.type !== 'tegaki:rive-editor:request-frame' || data.version !== PROTOCOL_VERSION) return;
    if (!parentOrigin || event.source !== window.parent || event.origin !== parentOrigin || data.sessionId !== sessionId) return;
    const requestId = String(data.requestId || '');
    if (!requestId || handledRequests.has(requestId)) return;
    handledRequests.add(requestId);
    if (busy || !runtime || !snapshot || snapshot.status !== 'ready' || !snapshot.buildId || !snapshot.documentId) {
        sendError(requestId, 'editor-not-ready');
        return;
    }
    try {
        const frame = runtime.render(snapshot.progress);
        if (frame.width > MAX_DIMENSION || frame.height > MAX_DIMENSION || frame.width * frame.height > MAX_PIXELS || frame.png.byteLength > MAX_PNG_BYTES) {
            sendError(requestId, 'frame-limit-rejected');
            return;
        }
        const buffer = frame.png.buffer;
        window.parent.postMessage({
            type: 'tegaki:rive-editor:frame',
            version: PROTOCOL_VERSION,
            sessionId,
            requestId,
            buildId: snapshot.buildId,
            documentId: snapshot.documentId,
            width: frame.width,
            height: frame.height,
            progress: snapshot.progress,
            png: buffer,
        }, parentOrigin, [buffer]);
    } catch (error) {
        sendError(requestId, error.message || 'frame-render-rejected');
    }
}

function beginBoneBaseline() {
    boneBaselineSnapshot = snapshot ? {
        ...snapshot,
        image: snapshot.image ? { ...snapshot.image } : null,
    } : null;
}

function previewBoneAngle(angle) {
    runtime.previewEndBone(angle, 1);
    angleInput.value = String(angle);
    setBonePreviewSnapshot(angle, 'preview', 'bone-edit-preview');
    setStatus(`終点角${angle}°をnative preview中…`);
}

boneController = new BoneEditorController({
    canvas,
    overlay: boneOverlay,
    line: boneLine,
    handle: boneHandle,
    getContext: boneContext,
    onBegin: beginBoneBaseline,
    onBusy: setBusy,
    onPreview: previewBoneAngle,
    onCommit: commitBoneAngle,
    onCancel: restoreBoneSnapshot,
    onMessage: (message, kind) => {
        if (!message || kind === 'preview' || kind === 'commit') return;
        setStatus(message, kind === 'error' ? 'error' : '');
    },
});
boneController.attach();

imageInput.addEventListener('change', () => void runOperation('image-load', () => loadImage(imageInput.files?.[0])));
document.querySelector('#apply').addEventListener('click', () => void runOperation('compile', compileAngle));
progressInput.addEventListener('input', scrub);
document.querySelector('#save').addEventListener('click', () => void runOperation('save', saveSource));
document.querySelector('#reopen').addEventListener('click', () => void runOperation('reopen', reopenSource));
document.querySelector('#cancel').addEventListener('click', () => void runOperation('cancel', cancelSource));
document.querySelector('#save-frame').addEventListener('click', () => void runOperation('frame-png', saveCurrentFrame));
pixelInspectButton?.addEventListener('pointerdown', event => event.preventDefault());
pixelInspectButton?.addEventListener('click', () => void inspectNativePixels());
window.addEventListener('message', event => handleFrameRequest(event));
window.addEventListener('pagehide', () => {
    editorDisposed = true;
    pixelInspectionGeneration += 1;
    boneController?.dispose();
    runtime.dispose();
});

async function initialLoad() {
    readEmbedTarget();
    try {
        const value = await getState();
        if (value.snapshot?.status === 'error') {
            setStatus(value.error || '保存状態を読み込めませんでした。', 'error');
            return;
        }
        await applyState(value, `Rive native editor準備完了（${value.snapshot.image.width}×${value.snapshot.image.height}）。`);
        await record('initial');
    } catch (error) {
        setSnapshot({ status: 'error', reason: 'server-unavailable' });
        setStatus(error.message || 'Rive editor serverに接続できません。', 'error');
    }
}

void runOperation('initial-load', initialLoad);

