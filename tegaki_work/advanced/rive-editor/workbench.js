/**
 * ROLE: WP-039 standalone workbench glue. Server snapshot/API、Rive native runtime、
 * playback、parent frame protocol を chain-controller へ接続する。
 * AUTHORITY: server source/image/build と公式 Rive runtime。chain-controller は
 * authoring draftだけを所有する。ここで画像の独自変形やmesh評価は行わない。
 */
import { RiveNativeRuntime, imageMetrics } from './runtime.js';
import { PlaybackController } from './playback-controller.js';
import { ChainEditorController } from './chain-controller.js';

const PROTOCOL_VERSION = 1;
const SNAPSHOT_SCHEMA = 'tegaki.rive-editor.state.v1';
const MAX_PNG_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1024;
const MAX_PIXELS = 1024 * 1024;

const root = document.querySelector('#rive-workbench');
const canvas = document.querySelector('#preview');
const statusNode = document.querySelector('#status');
const snapshotNode = document.querySelector('#snapshot');
const pixelInspectButton = document.querySelector('#pixel-inspect');
const pixelReportNode = document.querySelector('#pixel-report');
const imageInput = document.querySelector('#image-input');
const overlay = document.querySelector('#chain-overlay');
const sourceImage = document.querySelector('#chain-source-image');
const chainRoot = document.querySelector('#rive-workbench');
const chainJointLayer = document.querySelector('#chain-joint-layer');
const chainWarpLayer = document.querySelector('#chain-warp-layer');
const chainJointList = document.querySelector('#chain-joint-list');
const chainPointList = document.querySelector('#chain-point-list');
const chainCount = document.querySelector('#chain-count');
const chainApply = document.querySelector('#chain-apply');
const chainDiscard = document.querySelector('#chain-discard');
const chainPlacement = document.querySelector('#chain-placement');
const chainDraftStatusNode = document.querySelector('#chain-draft-status');
const chainPresetButtons = {
    arm3: document.querySelector('#chain-preset-arm'),
    snake6: document.querySelector('#chain-preset-snake'),
};
const progressInput = document.querySelector('#progress');
const progressValue = document.querySelector('#progress-value');
const playbackStartButton = document.querySelector('#playback-start');
const playbackPlayButton = document.querySelector('#playback-play');
const playbackPauseButton = document.querySelector('#playback-pause');
const playbackEndButton = document.querySelector('#playback-end');
const playbackLoopInput = document.querySelector('#playback-loop');
const playbackStatusNode = document.querySelector('#playback-status');
const saveButton = document.querySelector('#save');
const reopenButton = document.querySelector('#reopen');
const cancelButton = document.querySelector('#cancel');
const saveFrameButton = document.querySelector('#save-frame');

const chainInputs = {
    jointX: document.querySelector('#chain-joint-x'),
    jointY: document.querySelector('#chain-joint-y'),
    angle: document.querySelector('#chain-angle'),
    warpX: document.querySelector('#chain-warp-x'),
    warpY: document.querySelector('#chain-warp-y'),
    weightA: document.querySelector('#chain-weight-a'),
    weightB: document.querySelector('#chain-weight-b'),
    weightMix: document.querySelector('#chain-weight-mix'),
};

let apiState = null;
let snapshot = null;
let runtime = new RiveNativeRuntime(canvas);
let playbackController = null;
let chainController = null;
let lastFrame = null;
let parentOrigin = null;
let sessionId = null;
let busy = false;
let disposed = false;
let lifecycle = 0;
let pixelInspectionGeneration = 0;
const handledRequests = new Set();

function loopbackOrigin(value) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:') return null;
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) return null;
        return parsed.origin;
    } catch { return null; }
}

function readEmbedTarget() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    sessionId = hash.get('session');
    parentOrigin = loopbackOrigin(hash.get('parent'));
    if (!sessionId || sessionId.length > 128) sessionId = `standalone-${crypto.randomUUID?.() || Date.now()}`;
}

function setStatus(message, kind = '') {
    if (disposed) return;
    statusNode.textContent = String(message || '');
    statusNode.dataset.statusKind = kind;
    statusNode.classList.toggle('status-error', kind === 'error');
    statusNode.classList.toggle('status-ready', kind === 'ready');
}

function digestHex(buffer) {
    return Array.from(new Uint8Array(buffer), value => value.toString(16).padStart(2, '0')).join('');
}

function countTransparentPixels(imageData) {
    let transparentPixels = 0;
    for (let index = 3; index < imageData.data.length; index += 4) if (imageData.data[index] === 0) transparentPixels += 1;
    return transparentPixels;
}

function selectedFields() {
    return chainController?.getSnapshotFields?.() || {
        rigMode: snapshot?.rigMode || 'legacy', chain: snapshot?.chain || null, chainDraft: null,
        chainEditPhase: 'idle', selectedJoint: 0, selectedPoint: 0, placementMode: false,
    };
}

function setSnapshot(next, reason = null) {
    if (disposed) return;
    const fields = selectedFields();
    snapshot = {
        schema: SNAPSHOT_SCHEMA,
        status: next?.status || snapshot?.status || 'error',
        documentId: next?.documentId ?? snapshot?.documentId ?? null,
        buildId: next?.buildId ?? snapshot?.buildId ?? null,
        sourceHash: next?.sourceHash ?? snapshot?.sourceHash ?? null,
        image: next?.image || snapshot?.image || null,
        imageUrl: next?.imageUrl || snapshot?.imageUrl || null,
        artifactUrl: next?.artifactUrl || snapshot?.artifactUrl || null,
        angle: next?.angle ?? snapshot?.angle ?? null,
        progress: Number.isFinite(Number(next?.progress)) ? Number(next.progress) : Number(snapshot?.progress || 0),
        dirty: next?.dirty === true,
        rigMode: next?.rigMode || fields.rigMode || 'legacy',
        chain: next?.chain || fields.chain || null,
        chainDraft: fields.chainDraft,
        chainEditPhase: fields.chainEditPhase,
        selectedJoint: fields.selectedJoint,
        selectedPoint: fields.selectedPoint,
        placementMode: fields.placementMode,
        meshProfile: next?.meshProfile ?? snapshot?.meshProfile ?? null,
        vertexCount: next?.vertexCount ?? snapshot?.vertexCount ?? null,
        triangleCount: next?.triangleCount ?? snapshot?.triangleCount ?? null,
        playbackState: next?.playbackState || snapshot?.playbackState || 'idle',
        playbackLoop: next?.playbackLoop === true || (next?.playbackLoop === undefined && snapshot?.playbackLoop === true),
        busy,
        reason: reason || next?.reason || snapshot?.reason || null,
    };
    root.dataset.editorStatus = snapshot.status;
    root.dataset.editorBusy = String(busy);
    statusNode.dataset.editorStatus = snapshot.status;
    snapshotNode.textContent = JSON.stringify(snapshot, null, 2);
    sendState();
}

function chainDraftStatus(draft) {
    if (!chainDraftStatusNode) return;
    if (!draft) {
        chainDraftStatusNode.textContent = snapshot?.rigMode === 'chain' ? '編集内容を表示中です。' : '現在の画像を表示中です。presetで未適用の変更を作成できます。';
        return;
    }
    const rawCount = Object.values(draft.rawValues || {}).filter(value => value === '').length;
    chainDraftStatusNode.textContent = draft.valid
        ? `${draft.editPhase === 'commit' ? '適用中' : '未適用'}：入力有効（空欄 ${rawCount}）`
        : `入力を確認してください：${draft.error || '不正値'}`;
}

function syncControls() {
    const draftBlocked = chainController?.isDraft?.() || chainController?.isPending?.();
    const operationBlocked = busy || draftBlocked;
    for (const button of [imageInput, saveButton, reopenButton, cancelButton, saveFrameButton, pixelInspectButton, progressInput, playbackStartButton, playbackPlayButton, playbackPauseButton, playbackEndButton, playbackLoopInput]) {
        if (button) button.disabled = operationBlocked || (snapshot?.status !== 'ready' && button !== imageInput);
    }
    if (chainCount) chainCount.disabled = busy || chainController?.isPending?.();
    chainDraftStatusNode?.classList.toggle('danger', Boolean(chainController?.getDraft?.()?.valid === false));
}

function sendState() {
    if (!parentOrigin || window.parent === window || !snapshot) return;
    window.parent.postMessage({ type: 'tegaki:rive-editor:state', version: PROTOCOL_VERSION, sessionId, state: snapshot }, parentOrigin);
}

function sendError(requestId, reason) {
    if (!parentOrigin || window.parent === window) return;
    window.parent.postMessage({ type: 'tegaki:rive-editor:error', version: PROTOCOL_VERSION, sessionId, requestId, reason: String(reason || 'frame-request-rejected') }, parentOrigin);
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
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-editor-nonce': apiState.nonce }, body: JSON.stringify(body) });
    return responseValue(response);
}

async function postPng(endpoint, bytes) {
    if (!apiState?.nonce) throw new Error('Editor startup nonce is unavailable.');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-editor-nonce': apiState.nonce }, body: bytes });
    return responseValue(response);
}

function readPngHeader(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) throw new Error('PNGヘッダーを読み取れません。');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') throw new Error('PNGのIHDRが不正です。');
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) throw new Error('PNGは1辺1024px以下、かつ1MP以下にしてください。');
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
    const bitmap = await createImageBitmap(new Blob([sourceBytes], { type: 'image/png' }));
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
    } finally { bitmap.close?.(); }
}

function stopPlayback(reason) {
    playbackController?.stopAndCapture?.(reason);
}

function applyPlaybackState(state) {
    if (!state || disposed) return;
    const progress = Math.max(0, Math.min(1, Number(state.progress) || 0));
    progressInput.value = String(progress);
    progressValue.value = progress.toFixed(2);
    playbackStatusNode.textContent = `${state.state} / ${progress.toFixed(2)}${state.loop ? ' / loop' : ''}`;
    if (snapshot) setSnapshot({ ...snapshot, progress, playbackState: state.state, playbackLoop: state.loop === true }, 'playback');
}

function playbackReady() {
    return !disposed && !busy && !chainController?.isDraft?.() && !chainController?.isPending?.() && runtime && snapshot?.status === 'ready';
}

function capturePlaybackFrame(reason, progress = runtime?.progress ?? snapshot?.progress ?? 0) {
    if (disposed || !runtime || !snapshot || snapshot.status !== 'ready' || chainController?.isDraft?.() || chainController?.isPending?.()) return null;
    try {
        lastFrame = runtime.render(progress);
        return { reason, progress, frame: lastFrame };
    } catch { return null; }
}

async function loadRuntime(value) {
    if (disposed) throw new Error('Workbench is disposed.');
    if (!value?.artifactUrl || !value.snapshot?.image) throw new Error(value?.error || 'No native Rive artifact is available.');
    await runtime.load(value.artifactUrl, value.snapshot.image.width, value.snapshot.image.height);
    if (disposed) throw new Error('Workbench is disposed.');
    const progress = Number(value.snapshot.progress || 0);
    progressInput.value = String(progress);
    progressValue.value = progress.toFixed(2);
    lastFrame = runtime.render(progress);
}

async function applyState(value, message = null) {
    if (disposed) throw new Error('Workbench is disposed.');
    stopPlayback('scene-load');
    apiState = value;
    if (value.snapshot?.status === 'error') {
        setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null }, value.snapshot.reason);
        setStatus(value.error || value.snapshot.reason || 'Editor state is unavailable.', 'error');
        syncControls();
        return;
    }
    setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null, artifactUrl: value.artifactUrl || null, status: 'loading', reason: 'native-load' }, 'native-load');
    await loadRuntime(value);
    if (disposed) throw new Error('Workbench is disposed.');
    playbackController?.reset(Number(value.snapshot.progress || 0));
    setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null, artifactUrl: value.artifactUrl || null, status: 'ready', reason: value.snapshot.reason }, value.snapshot.reason);
    chainController?.sync({ snapshot: value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null, busy });
    chainDraftStatus(null);
    syncControls();
    if (message) setStatus(message, 'ready');
}

function restoreRejected(previous, reason, error) {
    if (previous) setSnapshot({ ...previous, status: previous.buildId ? 'ready' : 'error', reason: `${reason}-rejected` }, `${reason}-rejected`);
    setStatus(error?.message || `${reason} failed.`, 'error');
    syncControls();
}

function onChainDraftChanged(draft) {
    if (disposed) return;
    stopPlayback(draft ? 'chain-draft' : 'chain-draft-end');
    chainDraftStatus(draft);
    if (!snapshot) return;
    const fields = selectedFields();
    if (!draft) {
        setSnapshot({ ...snapshot, status: snapshot.buildId ? 'ready' : snapshot.status, ...fields, reason: 'chain-idle' }, 'chain-idle');
        syncControls();
        return;
    }
    setSnapshot({ ...snapshot, status: 'building', ...fields, reason: draft.editPhase === 'commit' ? 'chain-commit' : 'chain-draft' }, draft.editPhase === 'commit' ? 'chain-commit' : 'chain-draft');
    setStatus(draft.valid ? (draft.editPhase === 'commit' ? '変更を一度だけ適用中…' : '未適用の変更を編集中です。適用で動きに反映します。') : (draft.error || '入力を確認してください。'), draft.valid ? '' : 'error');
    syncControls();
}

function onChainSelectionChanged() {
    if (!snapshot) return;
    setSnapshot({ ...snapshot, ...selectedFields(), reason: 'chain-selection' }, 'chain-selection');
    chainDraftStatus(chainController?.getDraft?.());
}

async function commitChainDraft(draft) {
    stopPlayback('chain-commit');
    const previous = snapshot;
    const token = ++lifecycle;
    busy = true;
    chainController?.setBusy(true);
    setSnapshot({ ...snapshot, status: 'building', ...selectedFields(), reason: 'chain-commit' }, 'chain-commit');
    setStatus('chainを公式CLIで一度だけ適用中…');
    try {
        const value = await postJson('/api/compile', { chain: draft.chain, progress: Number(previous?.progress || 0) });
        if (disposed || token !== lifecycle) return { ok: false, reason: 'chain-commit-stale', suppressCancel: true };
        await applyState(value, `chain ${draft.chain.angles.length}関節をnativeへ適用しました。`);
        if (disposed || token !== lifecycle) return { ok: false, reason: 'chain-commit-stale', suppressCancel: true };
        const committed = chainController?.commitAccepted(value.snapshot.chain);
        if (!committed) throw new Error('serverから確定chainを受け取れませんでした。');
        busy = false;
        chainController?.setBusy(false);
        setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null, artifactUrl: value.artifactUrl || null, status: 'ready', ...selectedFields(), reason: 'chain-commit-accepted' }, 'chain-commit-accepted');
        setStatus('chainをnativeへ適用しました。', 'ready');
        syncControls();
        return { ok: true, acceptedByCallback: true, chain: value.snapshot.chain };
    } catch (error) {
        if (!disposed && token === lifecycle) {
            busy = false;
            chainController?.setBusy(false);
            restoreRejected(previous, 'chain-commit', error);
            chainDraftStatus(chainController?.getDraft?.());
        }
        return { ok: false, reason: disposed || token !== lifecycle ? 'chain-commit-stale' : (error?.message || 'chain-commit-rejected'), suppressCancel: disposed || token !== lifecycle };
    }
}

function onChainDiscard() {
    stopPlayback('chain-discard');
    if (snapshot) setSnapshot({ ...snapshot, status: 'ready', ...selectedFields(), reason: 'chain-discarded' }, 'chain-discarded');
    chainDraftStatus(null);
    setStatus('chainの変更を取り消しました。', 'ready');
    syncControls();
}

async function saveSource() {
    stopPlayback('save');
    const previous = snapshot;
    const runtimeProgress = Math.max(0, Math.min(1, Number(runtime?.progress ?? snapshot?.progress ?? progressInput.value) || 0));
    try {
        const value = await postJson('/api/save');
        // Save persists source/PNG; playback progress is a runtime-only value.
        // Keep the currently displayed pose while hydrating the server response.
        const hydrated = { ...value, snapshot: { ...value.snapshot, progress: runtimeProgress } };
        await applyState(hydrated, 'source＋PNGを保存しました。');
    }
    catch (error) { restoreRejected(previous, 'save', error); }
}

async function reopenSource() {
    stopPlayback('reopen');
    const previous = snapshot;
    try { const value = await postJson('/api/reopen'); await applyState(value, '保存済みsource＋PNGを再読込しました。'); }
    catch (error) { restoreRejected(previous, 'reopen', error); }
}

async function cancelSource() {
    stopPlayback('cancel');
    const previous = snapshot;
    try { const value = await postJson('/api/cancel'); await applyState(value, '保存済み良好状態へ戻しました。'); }
    catch (error) { restoreRejected(previous, 'cancel', error); }
}

async function saveCurrentFrame() {
    stopPlayback('frame-png');
    if (!runtime || !snapshot || snapshot.status !== 'ready') { setStatus('native runtimeが未接続です。', 'error'); return; }
    try {
        lastFrame = runtime.render(Number(progressInput.value));
        const value = await postPng(`/api/png?progress=${encodeURIComponent(progressInput.value)}`, lastFrame.png);
        setStatus(`現在フレームの透明1x PNGを保存しました（${value.width}×${value.height}）。`, 'ready');
    } catch (error) { restoreRejected(snapshot, 'frame-png', error); }
}

function scrub() {
    if (!playbackReady()) return;
    const progress = Number(progressInput.value);
    stopPlayback('scrub');
    try {
        lastFrame = runtime.render(progress);
        playbackController?.syncProgress(progress);
        progressValue.value = progress.toFixed(2);
        setSnapshot({ ...snapshot, progress, reason: 'scrub' }, 'scrub');
    } catch (error) { restoreRejected(snapshot, 'scrub', error); }
}

function capturedPixelSnapshot() {
    if (!snapshot) return null;
    return { status: snapshot.status, progress: snapshot.progress, sourceHash: snapshot.sourceHash, buildId: snapshot.buildId, rigMode: snapshot.rigMode, chainEditPhase: snapshot.chainEditPhase };
}

async function inspectNativePixels() {
    if (busy || chainController?.isDraft?.() || chainController?.isPending?.() || !runtime?.context) return;
    stopPlayback('pixel-inspect');
    const inspectionId = ++pixelInspectionGeneration;
    const captured = snapshot;
    const base = { schema: 'tegaki.rive-editor.pixel-inspection.v1', capturedAt: new Date().toISOString(), capturedSnapshot: capturedPixelSnapshot(), progress: captured?.progress ?? null, sourceHash: captured?.sourceHash ?? null, overlayComposited: false };
    try {
        const width = Number(runtime.width || canvas.width || 0);
        const height = Number(runtime.height || canvas.height || 0);
        if (!(width > 0) || !(height > 0)) throw new Error('Native canvas is unavailable.');
        const imageData = runtime.context.getImageData(0, 0, width, height);
        const metrics = imageMetrics(imageData);
        const pending = { ...base, width: imageData.width, height: imageData.height, transparentPixels: countTransparentPixels(imageData), alphaPixels: metrics.alphaPixels, bbox: metrics.bbox, rgbaSha256: null, hashStatus: 'pending', staleDuringHash: false };
        pixelReportNode.textContent = JSON.stringify(pending, null, 2);
        const digest = await globalThis.crypto?.subtle?.digest('SHA-256', new Uint8Array(imageData.data));
        if (!digest) throw new Error('Web Crypto SHA-256 is unavailable.');
        const report = { ...pending, rgbaSha256: digestHex(digest), hashStatus: 'complete', staleDuringHash: disposed || inspectionId !== pixelInspectionGeneration || snapshot !== captured, hashedAt: new Date().toISOString() };
        if (!disposed && inspectionId === pixelInspectionGeneration) pixelReportNode.textContent = JSON.stringify(report, null, 2);
    } catch (error) {
        if (!disposed && inspectionId === pixelInspectionGeneration) pixelReportNode.textContent = JSON.stringify({ ...base, hashStatus: 'error', error: error?.message || String(error), staleDuringHash: disposed || inspectionId !== pixelInspectionGeneration || snapshot !== captured }, null, 2);
    }
}

async function loadImage(file) {
    if (!file) return;
    stopPlayback('image-load');
    const previous = snapshot;
    try {
        const normalized = await normalizePngFile(file);
        const value = await postPng(`/api/image?name=${encodeURIComponent(file.name)}`, normalized.bytes);
        await applyState(value, `PNG素材${value.snapshot.image.width}×${value.snapshot.image.height}を読み込みました。`);
    } catch (error) { restoreRejected(previous, 'image-load', error); }
}

async function handleFrameRequest(event) {
    const data = event.data;
    if (!data || data.type !== 'tegaki:rive-editor:request-frame' || data.version !== PROTOCOL_VERSION) return;
    if (!parentOrigin || event.source !== window.parent || event.origin !== parentOrigin || data.sessionId !== sessionId) return;
    const requestId = String(data.requestId || '');
    if (!requestId || handledRequests.has(requestId)) return;
    handledRequests.add(requestId);
    stopPlayback('frame-request');
    if (chainController?.isDraft?.() || chainController?.isPending?.()) { sendError(requestId, 'chain-draft-active'); return; }
    if (busy || !runtime || !snapshot || snapshot.status !== 'ready' || !snapshot.buildId || !snapshot.documentId) { sendError(requestId, 'editor-not-ready'); return; }
    try {
        const frame = runtime.render(snapshot.progress);
        if (frame.width > MAX_DIMENSION || frame.height > MAX_DIMENSION || frame.width * frame.height > MAX_PIXELS || frame.png.byteLength > MAX_PNG_BYTES) { sendError(requestId, 'frame-limit-rejected'); return; }
        const buffer = frame.png.buffer;
        window.parent.postMessage({ type: 'tegaki:rive-editor:frame', version: PROTOCOL_VERSION, sessionId, requestId, buildId: snapshot.buildId, documentId: snapshot.documentId, width: frame.width, height: frame.height, progress: snapshot.progress, png: buffer }, parentOrigin, [buffer]);
    } catch (error) { sendError(requestId, error.message || 'frame-render-rejected'); }
}

chainController = new ChainEditorController({
    root: chainRoot,
    svg: overlay,
    imageNode: sourceImage,
    jointLayer: chainJointLayer,
    warpLayer: chainWarpLayer,
    jointList: chainJointList,
    pointList: chainPointList,
    inputs: chainInputs,
    applyButton: chainApply,
    discardButton: chainDiscard,
    placementButton: chainPlacement,
    presetButtons: chainPresetButtons,
    onDraftChanged: onChainDraftChanged,
    onSelectionChanged: onChainSelectionChanged,
    onPendingChanged: syncControls,
    onApply: commitChainDraft,
    onDiscard: onChainDiscard,
    canBeginDraft: () => !busy && snapshot?.status === 'ready' && !chainController?.isPending?.(),
    onMessage: (message, kind) => { if (kind === 'error') setStatus(message, 'error'); else if (kind === 'ready') setStatus(message, 'ready'); },
});
chainController.attach();

playbackController = new PlaybackController({
    clock: () => globalThis.performance?.now?.() ?? Date.now(),
    requestFrame: callback => globalThis.requestAnimationFrame(callback),
    cancelFrame: frameId => globalThis.cancelAnimationFrame(frameId),
    seek: progress => runtime.seek(progress),
    getProgress: () => runtime?.progress ?? snapshot?.progress ?? 0,
    captureFrame: (reason, progress) => capturePlaybackFrame(reason, progress),
    onState: applyPlaybackState,
});

for (const [name, button] of Object.entries(chainPresetButtons)) button?.addEventListener('click', () => chainController.setPreset(name));
chainCount?.addEventListener('change', () => chainController.setCount(Number(chainCount.value)));
imageInput?.addEventListener('change', () => { if (!busy && !chainController.isDraft() && !chainController.isPending()) void loadImage(imageInput.files?.[0]); });
progressInput?.addEventListener('input', scrub);
playbackStartButton?.addEventListener('click', () => { if (playbackReady()) playbackController.seekTo(0, 'start'); });
playbackPlayButton?.addEventListener('click', () => { if (playbackReady()) playbackController.play(); });
playbackPauseButton?.addEventListener('click', () => { if (playbackReady()) playbackController.pause('pause'); });
playbackEndButton?.addEventListener('click', () => { if (playbackReady()) playbackController.seekTo(1, 'end'); });
playbackLoopInput?.addEventListener('change', () => playbackController.setLoop(playbackLoopInput.checked));
saveButton?.addEventListener('click', () => { if (!busy && !chainController.isDraft() && !chainController.isPending()) void saveSource(); });
reopenButton?.addEventListener('click', () => { if (!busy && !chainController.isDraft() && !chainController.isPending()) void reopenSource(); });
cancelButton?.addEventListener('click', () => { if (!busy && !chainController.isDraft() && !chainController.isPending()) void cancelSource(); });
saveFrameButton?.addEventListener('click', () => { if (!busy && !chainController.isDraft() && !chainController.isPending()) void saveCurrentFrame(); });
pixelInspectButton?.addEventListener('pointerdown', event => event.preventDefault());
pixelInspectButton?.addEventListener('click', () => void inspectNativePixels());
window.addEventListener('message', event => void handleFrameRequest(event));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopPlayback('visibility-hidden'); });
window.addEventListener('blur', () => stopPlayback('window-blur'));
window.addEventListener('pagehide', () => {
    lifecycle += 1;
    disposed = true;
    pixelInspectionGeneration += 1;
    playbackController?.stop('pagehide', { capture: false });
    playbackController?.dispose();
    chainController?.dispose();
    runtime.dispose();
});

async function initialLoad() {
    readEmbedTarget();
    try {
        const value = await getState();
        if (value.snapshot?.status === 'error') { setSnapshot(value.snapshot, value.snapshot.reason); setStatus(value.error || '保存状態を読み込めませんでした。', 'error'); return; }
        await applyState(value, `Rive native workbench準備完了（${value.snapshot.image.width}×${value.snapshot.image.height}）。`);
    } catch (error) {
        setSnapshot({ status: 'error', reason: 'server-unavailable' }, 'server-unavailable');
        setStatus(error?.message || 'Rive editor serverに接続できません。', 'error');
    }
}

void initialLoad();

