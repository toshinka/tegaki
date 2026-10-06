/**
 * ROLE: WP-034 standalone GUI、weight/profile draft、WP-038 pivot draft、iframe protocol、End bone の native preview bridge。
 * AUTHORITY: server の snapshot を表示し、native runtime は preview/receipt 派生。host Project/History は所有しない。
 * INVARIANTS: loopback origin+event source+session/version、ready/非previewだけ frame、bone previewはpointermoveでcompileしない。
 * RELATED: runtime.js、bone-editor.js、weight-editor.js、pivot-editor.js、weight-model.mjs、bone-projection.mjs、server.mjs、WP-038。
 */
import { BoneEditorController } from './bone-editor.js';
import { WeightEditorController } from './weight-editor.js';
import { deriveInfluenceSnapshotFields, InfluenceMapController, INFLUENCE_SELECTION_SPACE } from './influence-map.js';
import { derivePivotSnapshotFields, PivotEditorController } from './pivot-editor.js';
import { RiveNativeRuntime, imageMetrics } from './runtime.js';
import { PlaybackController } from './playback-controller.js';

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
const weightRoot = document.querySelector('#weight-editor');
const meshProfileSelect = document.querySelector('#mesh-profile');
const weightInputs = Object.fromEntries([...document.querySelectorAll('[data-rive-weight]')].map(node => [node.dataset.riveWeight, node]));
const weightRootOutputs = Object.fromEntries([...document.querySelectorAll('[data-rive-root]')].map(node => [node.dataset.riveRoot, node]));
const weightApplyButton = document.querySelector('#weight-apply');
const weightDiscardButton = document.querySelector('#weight-discard');
const weightPresetButtons = Object.fromEntries([...document.querySelectorAll('[data-weight-preset]')].map(node => [node.dataset.weightPreset, node]));
const influenceMapRoot = document.querySelector('#influence-map');
const influenceMapSvg = document.querySelector('#influence-map-svg');
const influenceMapImage = document.querySelector('#influence-map-image');
const influenceMapPointLayer = document.querySelector('#influence-map-points');
const influenceMapButtonRoot = document.querySelector('#influence-map-buttons');
const influenceMapSelection = document.querySelector('#influence-map-selection');
const influenceMapStatus = document.querySelector('#influence-map-status');
const pivotEditorRoot = document.querySelector('#pivot-editor');
const pivotEditorLayer = document.querySelector('#pivot-editor-layer');
const pivotEditorSurface = document.querySelector('#pivot-editor-placement-surface');
const pivotEditorMarker = document.querySelector('#pivot-editor-marker');
const pivotEditorMarkerLabel = document.querySelector('#pivot-editor-marker-label');
const pivotXInput = document.querySelector('#pivot-x');
const pivotYInput = document.querySelector('#pivot-y');
const pivotModeButton = document.querySelector('#pivot-mode');
const pivotCenterButton = document.querySelector('#pivot-center');
const pivotApplyButton = document.querySelector('#pivot-apply');
const pivotDiscardButton = document.querySelector('#pivot-discard');
const pivotStatusNode = document.querySelector('#pivot-status');
const playbackPlayButton = document.querySelector('#playback-play');
const playbackPauseButton = document.querySelector('#playback-pause');
const playbackStartButton = document.querySelector('#playback-start');
const playbackEndButton = document.querySelector('#playback-end');
const playbackLoopInput = document.querySelector('#playback-loop');
const playbackStatusNode = document.querySelector('#playback-status');
const playbackProgressNode = document.querySelector('#playback-progress');

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
let weightController = null;
let influenceMapController = null;
let pivotController = null;
let weightGeneration = 0;
let weightBaselineSnapshot = null;
let pivotGeneration = 0;
let pivotBaselineSnapshot = null;
let playbackController = null;
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
    pixelInspectButton,
];

function syncInfluenceMap() {
    if (!influenceMapController) return;
    influenceMapController.sync({
        snapshot,
        busy,
        imageUrl: snapshot?.imageUrl || null,
        weightView: weightController?.getSelectionView?.() || null,
    });
}

function syncPivotEditor() {
    if (!pivotController) return;
    pivotController.sync({
        snapshot,
        busy,
        imageUrl: snapshot?.imageUrl || null,
    });
}

function syncOperationControls() {
    const locked = busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending();
    for (const control of operationControls) if (control) control.disabled = locked;
    if (meshProfileSelect) meshProfileSelect.disabled = busy || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending();
    syncPlaybackControls();
}

function syncPlaybackControls() {
    if (!playbackController) return;
    const state = playbackController.getState();
    const blocked = editorDisposed || busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending()
        || !snapshot || snapshot.status !== 'ready' || !runtime;
    if (playbackPlayButton) playbackPlayButton.disabled = blocked || state.playing;
    if (playbackPauseButton) playbackPauseButton.disabled = blocked || !state.playing;
    if (playbackStartButton) playbackStartButton.disabled = blocked;
    if (playbackEndButton) playbackEndButton.disabled = blocked;
    if (playbackLoopInput) playbackLoopInput.disabled = editorDisposed || busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending() || !snapshot || snapshot.status !== 'ready';
}

function setBusy(next) {
    if (editorDisposed) return;
    busy = next === true;
    root.dataset.editorBusy = String(busy);
    syncOperationControls();
    syncInfluenceMap();
    syncPivotEditor();
    boneController?.refresh();
}

async function runOperation(label, operation) {
    if (busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending()) return;
    stopPlaybackForOperation(label);
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
    const meshProfile = next?.meshProfile || snapshot?.meshProfile || 'quad';
    const pivotFields = pivotController?.getSnapshotFields?.()
        || derivePivotSnapshotFields(next || {}, snapshot || {});
    const selectionFields = deriveInfluenceSnapshotFields({
        next: next || {},
        previous: snapshot || {},
        selectionView: weightController?.getSelectionView?.() || null,
    });
    snapshot = {
        schema: SNAPSHOT_SCHEMA,
        status: next?.status || 'error',
        documentId: next?.documentId || null,
        buildId: next?.buildId || null,
        sourceHash: next?.sourceHash || null,
        image: next?.image || null,
        imageUrl: next?.imageUrl || snapshot?.imageUrl || null,
        angle: next?.angle ?? null,
        progress: next?.progress ?? 0,
        playbackState: next?.playbackState || snapshot?.playbackState || 'idle',
        playbackLoop: next?.playbackLoop === true || (next?.playbackLoop === undefined && snapshot?.playbackLoop === true),
        dirty: next?.dirty === true,
        reason: reason || next?.reason || null,
        selectedBone: next?.selectedBone || null,
        editPhase: next?.editPhase || 'idle',
        previewAngle,
        meshProfile,
        vertexCount: Number(next?.vertexCount ?? snapshot?.vertexCount ?? (meshProfile === 'grid3' ? 9 : 4)),
        triangleCount: Number(next?.triangleCount ?? snapshot?.triangleCount ?? (meshProfile === 'grid3' ? 8 : 2)),
        pivot: pivotFields.pivot ? { ...pivotFields.pivot } : null,
        centerAtRotationPivot: meshProfile === 'grid3' && pivotFields.centerAtRotationPivot === true,
        pivotEditPhase: pivotFields.pivotEditPhase || 'idle',
        pivotDraft: pivotFields.pivotDraft ? {
            rawValues: pivotFields.pivotDraft.rawValues ? { ...pivotFields.pivotDraft.rawValues } : null,
            fieldValidity: pivotFields.pivotDraft.fieldValidity ? { ...pivotFields.pivotDraft.fieldValidity } : null,
            fieldErrors: pivotFields.pivotDraft.fieldErrors ? { ...pivotFields.pivotDraft.fieldErrors } : null,
            value: pivotFields.pivotDraft.value ? { ...pivotFields.pivotDraft.value } : null,
            valid: pivotFields.pivotDraft.valid === true,
            editPhase: pivotFields.pivotDraft.editPhase || 'draft',
        } : null,
        placementMode: pivotFields.placementMode === true,
        meshWeights: Array.isArray(next?.meshWeights) ? [...next.meshWeights] : null,
        weightEditPhase: next?.weightEditPhase || 'idle',
        weightDraft: next?.weightDraft ? {
            profile: next.weightDraft.profile || next?.meshProfile || snapshot?.meshProfile || 'quad',
            endWeights: Array.isArray(next.weightDraft.endWeights) ? [...next.weightDraft.endWeights] : null,
            percentages: Array.isArray(next.weightDraft.percentages) ? [...next.weightDraft.percentages] : null,
            rawValues: next.weightDraft.rawValues ? { ...next.weightDraft.rawValues } : null,
            fieldValidity: next.weightDraft.fieldValidity ? { ...next.weightDraft.fieldValidity } : null,
            fieldErrors: next.weightDraft.fieldErrors ? { ...next.weightDraft.fieldErrors } : null,
            selectedVertex: next.weightDraft.selectedVertex || null,
            valid: next.weightDraft.valid !== false,
            error: next.weightDraft.error || null,
            profileChange: next.weightDraft.profileChange ? { ...next.weightDraft.profileChange } : null,
        } : null,
        ...selectionFields,
    };
    root.dataset.editorStatus = snapshot.status;
    statusNode.dataset.editorStatus = snapshot.status;
    weightController?.setCenterAtRotationPivot?.(snapshot.centerAtRotationPivot === true);
    snapshotNode.textContent = JSON.stringify(snapshot, null, 2);
    syncInfluenceMap();
    syncPivotEditor();
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
        meshProfile: snapshot.meshProfile,
        vertexCount: snapshot.vertexCount,
        triangleCount: snapshot.triangleCount,
        centerAtRotationPivot: snapshot.centerAtRotationPivot === true,
    };
}

async function inspectNativePixels() {
    if (busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending()) return;
    stopPlaybackForOperation('pixel-inspect');
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

function capturePlaybackFrame(reason, progress = runtime?.progress ?? snapshot?.progress ?? 0) {
    if (editorDisposed || !runtime || !snapshot || snapshot.status !== 'ready') return null;
    const nextProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    try {
        // Playback capture is an action boundary. The RAF tick itself only calls runtime.seek.
        lastFrame = runtime.render(nextProgress);
        return { reason, progress: nextProgress, frame: lastFrame };
    } catch {
        return null;
    }
}

function onPlaybackState(state) {
    if (editorDisposed || !state) return;
    const progress = Math.max(0, Math.min(1, Number(state.progress) || 0));
    if (progressInput) progressInput.value = String(progress);
    if (progressValue) progressValue.value = progress.toFixed(2);
    if (playbackProgressNode) playbackProgressNode.textContent = progress.toFixed(2);
    if (playbackStatusNode) playbackStatusNode.textContent = `${state.state} / ${progress.toFixed(2)}${state.loop ? ' / loop' : ''}`;
    if (snapshot) {
        setSnapshot({
            ...snapshot,
            progress,
            playbackState: state.state,
            playbackLoop: state.loop === true,
        }, 'playback');
    }
    boneController?.refresh();
    syncPlaybackControls();
}

function stopPlaybackForOperation(reason) {
    if (!playbackController) return;
    playbackController.stopAndCapture(reason);
}

function playbackReady() {
    return !editorDisposed
        && !busy
        && !weightController?.isDraft()
        && !weightController?.isPending()
        && !pivotController?.isDraft()
        && !pivotController?.isPending()
        && Boolean(runtime && snapshot?.status === 'ready');
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

function cloneWeightBaseline(value) {
    if (!value) return null;
    return {
        ...value,
        image: value.image ? { ...value.image } : null,
        meshProfile: value.meshProfile || 'quad',
        vertexCount: value.vertexCount ?? null,
        triangleCount: value.triangleCount ?? null,
        centerAtRotationPivot: value.centerAtRotationPivot === true,
        meshWeights: Array.isArray(value.meshWeights) ? [...value.meshWeights] : null,
        weightDraft: value.weightDraft ? {
            ...value.weightDraft,
            profile: value.weightDraft.profile || value.meshProfile || 'quad',
            endWeights: Array.isArray(value.weightDraft.endWeights) ? [...value.weightDraft.endWeights] : null,
            percentages: Array.isArray(value.weightDraft.percentages) ? [...value.weightDraft.percentages] : null,
            rawValues: value.weightDraft.rawValues ? { ...value.weightDraft.rawValues } : null,
            fieldValidity: value.weightDraft.fieldValidity ? { ...value.weightDraft.fieldValidity } : null,
            fieldErrors: value.weightDraft.fieldErrors ? { ...value.weightDraft.fieldErrors } : null,
            profileChange: value.weightDraft.profileChange ? { ...value.weightDraft.profileChange } : null,
        } : null,
    };
}

function localWeightFields(phase = 'draft') {
    const draft = weightController?.getDraft?.();
    if (!draft) return { weightEditPhase: 'idle', weightDraft: null, selectedVertex: null };
    return {
        weightEditPhase: phase,
        weightDraft: {
            profile: draft.profile || snapshot?.meshProfile || 'quad',
            endWeights: draft.endWeights ? [...draft.endWeights] : null,
            percentages: draft.percentages ? [...draft.percentages] : null,
            rawValues: draft.rawValues ? { ...draft.rawValues } : null,
            fieldValidity: draft.fieldValidity ? { ...draft.fieldValidity } : null,
            fieldErrors: draft.fieldErrors ? { ...draft.fieldErrors } : null,
            selectedVertex: draft.selectedVertex || null,
            valid: draft.valid === true,
            error: draft.error || null,
            profileChange: draft.profileChange ? { ...draft.profileChange } : null,
        },
        selectedVertex: draft.selectedVertex || null,
    };
}

function clonePivotBaseline(value) {
    if (!value) return null;
    return {
        ...value,
        image: value.image ? { ...value.image } : null,
        pivot: value.pivot ? { ...value.pivot } : null,
        pivotDraft: null,
        pivotEditPhase: 'idle',
        placementMode: false,
    };
}

function pivotFieldsFromDraft(draft, phase = 'draft') {
    return {
        pivotEditPhase: phase,
        pivotDraft: draft ? {
            rawValues: draft.rawValues ? { ...draft.rawValues } : null,
            fieldValidity: draft.fieldValidity ? { ...draft.fieldValidity } : null,
            fieldErrors: draft.fieldErrors ? { ...draft.fieldErrors } : null,
            value: draft.value ? { ...draft.value } : null,
            valid: draft.valid === true,
            editPhase: draft.editPhase || phase,
        } : null,
        placementMode: pivotController?.getView?.().placementMode === true,
    };
}

function localPivotFields(phase = 'draft') {
    return pivotFieldsFromDraft(pivotController?.getDraft?.(), phase);
}

async function applyState(value, message = null, options = {}) {
    if (editorDisposed) throw new Error('Editor is disposed.');
    stopPlaybackForOperation('scene-load');
    apiState = value;
    if (value.snapshot?.status === 'error') {
        setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null }, value.snapshot?.reason);
        setStatus(value.error || value.snapshot.reason || 'Editor state is unavailable.', 'error');
        return;
    }
    pivotController?.sync({
        snapshot: value.snapshot,
        busy,
        imageUrl: value.imageUrl || value.snapshot?.imageUrl || null,
    });
    const weightOverlay = weightController?.isDraft() ? localWeightFields('commit') : {};
    const pivotOverlay = pivotController?.isDraft() ? localPivotFields('commit') : {};
    setSnapshot({ ...value.snapshot, imageUrl: value.imageUrl || value.snapshot?.imageUrl || null, ...weightOverlay, ...pivotOverlay, status: 'loading', reason: 'native-load' }, 'native-load');
    await loadRuntime(value);
    if (editorDisposed) throw new Error('Editor is disposed.');
    playbackController?.reset(Number(value.snapshot?.progress ?? 0));
    const keepWeightPending = options.keepWeightPending === true && weightController?.isDraft();
    const keepPivotPending = options.keepPivotPending === true && pivotController?.isDraft();
    setSnapshot({
        ...value.snapshot,
        imageUrl: value.imageUrl || value.snapshot?.imageUrl || null,
        ...weightOverlay,
        ...pivotOverlay,
        status: keepWeightPending || keepPivotPending ? 'building' : 'ready',
        reason: keepWeightPending ? 'weights-commit-recording' : keepPivotPending ? 'pivot-commit-recording' : value.snapshot?.reason,
    }, keepWeightPending ? 'weights-commit-recording' : keepPivotPending ? 'pivot-commit-recording' : value.snapshot?.reason);
    if (!keepWeightPending && !weightController?.isDraft() && Array.isArray(value.snapshot?.meshWeights)) {
        weightController?.loadCommitted(value.snapshot.meshProfile || 'quad', value.snapshot.meshWeights);
    }
    if (!keepPivotPending && !pivotController?.isDraft() && value.snapshot?.pivot) {
        pivotController?.loadCommitted(value.snapshot.pivot, value.snapshot.image || snapshot?.image);
    }
    const selectionView = weightController?.getSelectionView?.();
    if (selectionView) {
        setSnapshot({
            ...snapshot,
            selectedVertex: selectionView.selectedVertex,
            selectionSpace: INFLUENCE_SELECTION_SPACE,
            selectionProfile: selectionView.profile,
            selectedEndPercent: selectionView.selectedEndPercent,
            selectedWeightValid: selectionView.selectedWeightValid === true,
            weightDraftActive: selectionView.weightDraftActive === true,
        }, snapshot.reason);
    }
    syncInfluenceMap();
    syncPivotEditor();
    syncOperationControls();
    boneController?.refresh();
    if (message && !keepWeightPending) setStatus(message, 'ready');
}

async function compileAngle() {
    stopPlaybackForOperation('compile');
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
    stopPlaybackForOperation(`bone-${reason}`);
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
    stopPlaybackForOperation('bone-commit');
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

function beginPivotBaseline() {
    stopPlaybackForOperation('pivot-edit');
    pivotBaselineSnapshot = snapshot ? clonePivotBaseline(snapshot) : null;
}

function onPivotDraftChanged(draft) {
    if (editorDisposed || !snapshot) return;
    if (draft) stopPlaybackForOperation('pivot-draft');
    else stopPlaybackForOperation('pivot-draft-end');
    syncOperationControls();
    if (draft && !pivotBaselineSnapshot && snapshot.status === 'ready') beginPivotBaseline();
    if (!draft) {
        setSnapshot({
            ...snapshot,
            status: snapshot.buildId ? 'ready' : snapshot.status,
            ...pivotFieldsFromDraft(null, 'idle'),
            reason: 'pivot-idle',
        }, 'pivot-idle');
        pivotBaselineSnapshot = null;
        syncOperationControls();
        return;
    }
    setSnapshot({
        ...snapshot,
        status: 'building',
        reason: draft.editPhase === 'commit' ? 'pivot-commit' : 'pivot-draft',
        ...pivotFieldsFromDraft(draft, draft.editPhase === 'commit' ? 'commit' : 'draft'),
    }, draft.editPhase === 'commit' ? 'pivot-commit' : 'pivot-draft');
    setStatus(draft.valid === false ? '回転中心のX/Yを確認してください。' : '回転中心を編集中です。', draft.valid === false ? 'error' : '');
    syncOperationControls();
}

function onPivotDiscard() {
    stopPlaybackForOperation('pivot-discard');
    pivotGeneration += 1;
    const baseline = pivotBaselineSnapshot;
    if (baseline) {
        setSnapshot({
            ...baseline,
            status: 'ready',
            ...pivotFieldsFromDraft(null, 'idle'),
            reason: 'pivot-discarded',
        }, 'pivot-discarded');
    }
    pivotBaselineSnapshot = null;
    syncPivotEditor();
    syncOperationControls();
    boneController?.refresh();
}

async function commitPivotDraft(draft) {
    stopPlaybackForOperation('pivot-commit');
    const previous = pivotBaselineSnapshot || snapshot;
    const token = ++pivotGeneration;
    if (!previous || previous.status !== 'ready' || !draft?.valid || !draft.value) {
        return { ok: false, reason: 'pivot-commit-state-invalid' };
    }
    setSnapshot({
        ...snapshot,
        status: 'building',
        reason: 'pivot-commit',
        ...pivotFieldsFromDraft(draft, 'commit'),
    }, 'pivot-commit');
    setStatus('回転中心を公式CLIで一度だけ確定中…');
    setBusy(true);
    try {
        const value = await postJson('/api/compile', {
            angle: Number(previous.angle),
            progress: Number(previous.progress),
            pivot: { x: Number(draft.value.x), y: Number(draft.value.y) },
        });
        if (editorDisposed || token !== pivotGeneration) return { ok: false, reason: 'pivot-commit-stale', suppressCancel: true };
        await applyState(value, null, { keepPivotPending: true });
        if (editorDisposed || token !== pivotGeneration) return { ok: false, reason: 'pivot-commit-stale', suppressCancel: true };
        await record('pivot-commit', { pivot: { ...draft.value } });
        if (editorDisposed || token !== pivotGeneration) return { ok: false, reason: 'pivot-commit-stale', suppressCancel: true };
        pivotBaselineSnapshot = null;
        pivotController?.commitAccepted(value.snapshot.pivot || draft.value);
        setBusy(false);
        return { ok: true, acceptedByCallback: true, snapshot: value.snapshot };
    } catch (error) {
        if (!editorDisposed && token === pivotGeneration) {
            setSnapshot({
                ...previous,
                status: 'building',
                reason: 'pivot-draft-rejected',
                ...pivotFieldsFromDraft(draft, 'draft'),
            }, 'pivot-draft-rejected');
            setStatus(error?.message || '回転中心を適用できませんでした。', 'error');
        }
        if (!editorDisposed) setBusy(false);
        return {
            ok: false,
            reason: editorDisposed || token !== pivotGeneration ? 'pivot-commit-stale' : (error?.message || 'pivot-commit-rejected'),
            suppressCancel: editorDisposed || token !== pivotGeneration,
        };
    }
}

async function loadImage(file) {
    if (!file) return;
    stopPlaybackForOperation('image-load');
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
    stopPlaybackForOperation('save');
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
    stopPlaybackForOperation('reopen');
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
    stopPlaybackForOperation('cancel');
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
    stopPlaybackForOperation('frame-png');
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
    if (busy || weightController?.isDraft() || weightController?.isPending()
        || pivotController?.isDraft() || pivotController?.isPending()
        || !runtime || !snapshot || snapshot.status !== 'ready') return;
    const progress = Number(progressInput.value);
    stopPlaybackForOperation('scrub');
    const previous = snapshot;
    progressValue.value = progress.toFixed(2);
    try {
        lastFrame = runtime.render(progress);
        playbackController?.syncProgress(progress);
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
    stopPlaybackForOperation('frame-request');
    if (weightController?.isDraft() || weightController?.isPending()) {
        sendError(requestId, 'weight-draft-active');
        return;
    }
    if (pivotController?.isDraft() || pivotController?.isPending()) {
        sendError(requestId, 'pivot-draft-active');
        return;
    }
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
    stopPlaybackForOperation('bone-edit');
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

function weightFieldsFromDraft(draft, phase = 'draft') {
    return {
        weightEditPhase: phase,
        weightDraft: draft ? {
            profile: draft.profile || snapshot?.meshProfile || 'quad',
            endWeights: draft.endWeights ? [...draft.endWeights] : null,
            percentages: draft.percentages ? [...draft.percentages] : null,
            rawValues: draft.rawValues ? { ...draft.rawValues } : null,
            fieldValidity: draft.fieldValidity ? { ...draft.fieldValidity } : null,
            fieldErrors: draft.fieldErrors ? { ...draft.fieldErrors } : null,
            selectedVertex: draft.selectedVertex || null,
            valid: draft.valid === true,
            error: draft.error || null,
            profileChange: draft.profileChange ? { ...draft.profileChange } : null,
        } : null,
        selectedVertex: draft?.selectedVertex || null,
    };
}

function onWeightSelectionChanged(selectedVertex) {
    if (editorDisposed || !snapshot) return;
    setSnapshot({
        ...snapshot,
        selectedVertex,
        selectionSpace: INFLUENCE_SELECTION_SPACE,
        selectionProfile: weightController?.getProfile?.() || snapshot.selectionProfile || snapshot.meshProfile,
        selectedEndPercent: weightController?.getSelectionView?.().selectedEndPercent ?? null,
        selectedWeightValid: weightController?.getSelectionView?.().selectedWeightValid === true,
        weightDraftActive: weightController?.isDraft?.() === true,
    }, snapshot.reason);
}

function onWeightDraftChanged(draft) {
    if (editorDisposed || !snapshot) return;
    if (draft) stopPlaybackForOperation('weight-draft');
    else stopPlaybackForOperation('weight-draft-end');
    syncOperationControls();
    syncInfluenceMap();
    if (draft && !weightBaselineSnapshot && snapshot.status === 'ready') weightBaselineSnapshot = cloneWeightBaseline(snapshot);
    if (!draft) {
        setSnapshot({
            ...snapshot,
            status: snapshot.buildId ? 'ready' : snapshot.status,
            ...weightFieldsFromDraft(null, 'idle'),
            reason: 'weights-idle',
        }, 'weights-idle');
        syncOperationControls();
        return;
    }
    setSnapshot({
        ...snapshot,
        status: 'building',
        reason: 'weights-draft',
        ...weightFieldsFromDraft(draft, 'draft'),
    }, 'weights-draft');
    const profileLabel = draft.profile === 'grid3' ? '9点' : '四隅';
    setStatus(draft.valid === false ? (draft.error || 'End追従率を確認してください。') : `${profileLabel}の骨への追従を編集中です。`, draft.valid === false ? 'error' : '');
    syncOperationControls();
    boneController?.refresh();
}

function onWeightDiscard() {
    stopPlaybackForOperation('weight-discard');
    weightGeneration += 1;
    const baseline = weightBaselineSnapshot;
    if (baseline) {
        angleInput.value = String(baseline.angle ?? 30);
        progressInput.value = String(baseline.progress ?? 0);
        progressValue.value = Number(baseline.progress ?? 0).toFixed(2);
        setSnapshot({
            ...baseline,
            status: 'ready',
            ...weightFieldsFromDraft(null, 'idle'),
            reason: 'weights-discarded',
        }, 'weights-discarded');
    }
    weightBaselineSnapshot = null;
    syncInfluenceMap();
    boneController?.refresh();
}

async function commitWeightDraft(draft) {
    stopPlaybackForOperation('weight-commit');
    const previous = weightBaselineSnapshot || snapshot;
    const token = ++weightGeneration;
    if (!previous || previous.status !== 'ready' || !draft?.valid || !Array.isArray(draft.endWeights)) {
        return { ok: false, reason: 'weight-commit-state-invalid' };
    }
    setSnapshot({
        ...snapshot,
        status: 'building',
        reason: 'weights-commit',
        ...weightFieldsFromDraft(draft, 'commit'),
    }, 'weights-commit');
    setStatus(`${draft.profile === 'grid3' ? '9点' : '四隅'}の追従率を公式CLIで一度だけ確定中…`);
    try {
        const value = await postJson('/api/compile', {
            angle: Number(previous.angle),
            progress: Number(previous.progress),
            profile: draft.profile || previous.meshProfile || 'quad',
            weights: [...draft.endWeights],
        });
        if (editorDisposed || token !== weightGeneration) return { ok: false, reason: 'weight-commit-stale', suppressCancel: true };
        await applyState(value, null, { keepWeightPending: true });
        if (editorDisposed || token !== weightGeneration) return { ok: false, reason: 'weight-commit-stale', suppressCancel: true };
        await record('weights-commit', { weights: { profile: draft.profile || previous.meshProfile || 'quad', endBytes: [...draft.endWeights], selectedVertex: draft.selectedVertex || null } });
        if (editorDisposed || token !== weightGeneration) return { ok: false, reason: 'weight-commit-stale', suppressCancel: true };
        weightBaselineSnapshot = null;
        weightController?.commitAccepted(value.snapshot.meshProfile || draft.profile || 'quad', value.snapshot.meshWeights);
        return { ok: true, acceptedByCallback: true, snapshot: value.snapshot };
    } catch (error) {
        if (!editorDisposed && token === weightGeneration) {
            setSnapshot({
                ...previous,
                status: 'building',
                reason: 'weights-draft-rejected',
                ...weightFieldsFromDraft(draft, 'draft'),
            }, 'weights-draft-rejected');
            setStatus(error?.message || `${draft.profile === 'grid3' ? '9点' : '四隅'}の追従率を適用できませんでした。`, 'error');
            boneController?.refresh();
        }
        return {
            ok: false,
            reason: editorDisposed || token !== weightGeneration ? 'weight-commit-stale' : (error?.message || 'weight-commit-rejected'),
            suppressCancel: editorDisposed || token !== weightGeneration,
        };
    }
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

weightController = new WeightEditorController({
    root: weightRoot,
    profileSelect: meshProfileSelect,
    inputs: weightInputs,
    rootOutputs: weightRootOutputs,
    applyButton: weightApplyButton,
    discardButton: weightDiscardButton,
    presetButtons: weightPresetButtons,
    profile: snapshot?.meshProfile || 'quad',
    initialWeights: snapshot?.meshWeights,
    onDraftChanged: onWeightDraftChanged,
    onSelectionChanged: onWeightSelectionChanged,
    onPendingChanged: () => {
        syncOperationControls();
        syncInfluenceMap();
    },
    onApply: commitWeightDraft,
    onDiscard: onWeightDiscard,
    canBeginDraft: () => !busy && !pivotController?.isDraft() && !pivotController?.isPending() && snapshot?.status === 'ready',
    onMessage: (message, kind) => {
        if (!message) return;
        setStatus(message, kind === 'error' ? 'error' : kind === 'ready' ? 'ready' : '');
    },
});
weightController.attach();

pivotController = new PivotEditorController({
    root: pivotEditorRoot,
    svg: influenceMapSvg,
    layer: pivotEditorLayer,
    surface: pivotEditorSurface,
    marker: pivotEditorMarker,
    markerLabel: pivotEditorMarkerLabel,
    xInput: pivotXInput,
    yInput: pivotYInput,
    modeButton: pivotModeButton,
    centerButton: pivotCenterButton,
    applyButton: pivotApplyButton,
    discardButton: pivotDiscardButton,
    statusNode: pivotStatusNode,
    onDraftChanged: onPivotDraftChanged,
    onApply: commitPivotDraft,
    onDiscard: onPivotDiscard,
    onPendingChanged: () => {
        syncOperationControls();
        syncPlaybackControls();
        syncInfluenceMap();
    },
    onModeChanged: placementMode => {
        if (!snapshot) return;
        setSnapshot({ ...snapshot, placementMode, reason: 'pivot-placement-mode' }, 'pivot-placement-mode');
    },
    onMessage: (message, kind) => {
        if (!message) return;
        if (kind === 'error') setStatus(message, 'error');
        else if (kind === 'ready') setStatus(message, 'ready');
        else if (kind === 'mode') setStatus(message, '');
    },
    canBeginDraft: () => !busy && !weightController?.isDraft() && !weightController?.isPending()
        && snapshot?.status === 'ready',
});
pivotController.attach();
syncPivotEditor();

influenceMapController = new InfluenceMapController({
    root: influenceMapRoot,
    svg: influenceMapSvg,
    imageNode: influenceMapImage,
    pointLayer: influenceMapPointLayer,
    buttonRoot: influenceMapButtonRoot,
    selectionNode: influenceMapSelection,
    statusNode: influenceMapStatus,
    getWeightView: () => weightController?.getSelectionView?.() || null,
    onSelectionChanged: name => {
        weightController?.selectVertex(name, { focus: true });
    },
    onMessage: (message, kind) => {
        if (kind === 'error') setStatus(message, 'error');
    },
});
influenceMapController.attach();
syncInfluenceMap();

playbackController = new PlaybackController({
    clock: () => globalThis.performance?.now?.() ?? Date.now(),
    requestFrame: callback => globalThis.requestAnimationFrame(callback),
    cancelFrame: frameId => globalThis.cancelAnimationFrame(frameId),
    seek: progress => runtime.seek(progress),
    getProgress: () => runtime?.progress ?? snapshot?.progress ?? 0,
    captureFrame: (reason, progress) => capturePlaybackFrame(reason, progress),
    onState: state => onPlaybackState(state),
});

function handlePlaybackPlay() {
    if (!playbackReady()) return;
    playbackController.play();
}

function handlePlaybackPause() {
    if (!playbackReady()) return;
    playbackController.pause('pause');
}

function handlePlaybackStart() {
    if (!playbackReady()) return;
    playbackController.seekTo(0, 'start');
}

function handlePlaybackEnd() {
    if (!playbackReady()) return;
    playbackController.seekTo(1, 'end');
}

playbackPlayButton?.addEventListener('click', handlePlaybackPlay);
playbackPauseButton?.addEventListener('click', handlePlaybackPause);
playbackStartButton?.addEventListener('click', handlePlaybackStart);
playbackEndButton?.addEventListener('click', handlePlaybackEnd);
playbackLoopInput?.addEventListener('change', () => {
    playbackController?.setLoop(playbackLoopInput.checked);
});

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
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopPlaybackForOperation('visibility-hidden');
});
window.addEventListener('blur', () => stopPlaybackForOperation('window-blur'));
window.addEventListener('pagehide', () => {
    playbackController?.stop('pagehide', { capture: false });
    playbackController?.dispose();
    editorDisposed = true;
    pixelInspectionGeneration += 1;
    weightGeneration += 1;
    boneController?.dispose();
    influenceMapController?.dispose();
    weightController?.dispose();
    pivotGeneration += 1;
    pivotController?.dispose();
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

