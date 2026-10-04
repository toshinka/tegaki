/**
 * ROLE: Runtime-only Rive editor host and a single new-Raster receipt.
 * AUTHORITY: Rive owns detached authoring; LayerSystem/History own committed pixels.
 * INVARIANTS: Exact iframe/origin/session/request identity; recheck Canvas after decode.
 * RELATED: advanced/rive-editor/editor.js, right-workspace-frame.js, WP-029.
 */
import { historyManager } from '../system/history.js';

export const RIVE_EDITOR_ORIGIN = 'http://127.0.0.1:18729';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_AXIS = 1024;
const MESSAGE_TYPES = new Set(['tegaki:rive-editor:state', 'tegaki:rive-editor:frame', 'tegaki:rive-editor:error']);
const CONNECTION_SCHEMA = 'tegaki.rive-editor.connection.v1';
const BRIDGE_PATH = '/__tegaki/rive-editor';

export async function ensureRiveEditorConnection({ fetchImpl = globalThis.fetch, signal } = {}) {
    const fail = reason => { throw Object.assign(new Error(reason), { reason }); };
    async function read(response) {
        let value;
        try { value = await response.json(); } catch { fail('bridge-unavailable'); }
        if (value?.schema !== CONNECTION_SCHEMA) fail('bridge-unavailable');
        if (!response.ok || value.phase === 'error') fail(String(value.reason || 'start-failed').slice(0, 160));
        return value;
    }
    const status = await read(await fetchImpl(`${BRIDGE_PATH}/status`, { signal, cache: 'no-store' }));
    if (typeof status.nonce !== 'string' || !status.nonce || status.nonce.length > 160) fail('bridge-unavailable');
    const ready = await read(await fetchImpl(`${BRIDGE_PATH}/ensure`, {
        method: 'POST', signal, cache: 'no-store', headers: { 'x-tegaki-rive-nonce': status.nonce }
    }));
    if (ready.phase !== 'ready' || ready.editorOrigin !== RIVE_EDITOR_ORIGIN) fail('editor-identity-mismatch');
    return { phase: 'ready', reason: '', editorOrigin: RIVE_EDITOR_ORIGIN };
}

function connectionNotice(reason) {
    if (reason === 'bridge-unavailable') return 'この画面では編集の起動機能が使えません。開発Canvasを再読み込みしてください。';
    if (/missing|mismatch|version|integrity|sdk|cache/.test(reason)) return '編集に必要な実体を確認できませんでした。状態を確認に原因を記録しています。';
    if (/occupied|installation|identity/.test(reason)) return '編集用の接続先を確認できませんでした。別の作業を停止せずに接続を保留しています。';
    if (/timeout/.test(reason)) return '編集の起動に時間がかかっています。再試行できます。';
    return '編集画面へ接続できませんでした。再試行できます。';
}

export function acceptsRiveEditorMessage(event, source, sessionId) {
    return Boolean(source && event?.source === source && event.origin === RIVE_EDITOR_ORIGIN
        && event.data?.version === 1 && event.data.sessionId === sessionId
        && MESSAGE_TYPES.has(event.data.type));
}

export function validateRiveFrameReceipt(receipt, pending, state) {
    if (!pending || pending.consumed || receipt?.requestId !== pending.requestId) return 'unexpected-request';
    if (!state || state.status !== 'ready' || receipt.buildId !== pending.buildId
        || state.buildId !== pending.buildId || receipt.documentId !== pending.documentId
        || state.documentId !== pending.documentId || receipt.progress !== pending.progress
        || state.progress !== pending.progress) return 'stale-frame';
    if (!Number.isInteger(receipt.width) || !Number.isInteger(receipt.height)
        || receipt.width < 1 || receipt.height < 1 || receipt.width > MAX_AXIS || receipt.height > MAX_AXIS
        || !(receipt.png instanceof ArrayBuffer) || receipt.png.byteLength < 33
        || receipt.png.byteLength > MAX_BYTES) return 'invalid-png-envelope';
    const bytes = new Uint8Array(receipt.png);
    const magic = [137, 80, 78, 71, 13, 10, 26, 10];
    if (magic.some((byte, index) => bytes[index] !== byte)
        || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return 'invalid-png-header';
    const view = new DataView(receipt.png);
    return view.getUint32(16) === receipt.width && view.getUint32(20) === receipt.height ? '' : 'png-size-mismatch';
}

export function riveRasterContextReason(layerSystem, history, context, activity = {}) {
    if (!layerSystem?.createRasterLayerFromSnapshot || !layerSystem.currentFrameContainer) return 'Raster追加の準備ができていません';
    if (!history?.record || history.isApplying || history.isRecordingSuppressed?.()) return '履歴処理が終わってから追加してください';
    if (layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer
        || layerSystem.getLayers?.().some(layer => layer.layerData?.isAnimationWorkingLayer)) return '通常Canvasへ戻ってから追加してください';
    if (layerSystem.getLayerMoveCommitState?.().active || activity.drawing
        || activity.selectionTransform || activity.capture) return '描画・変形を終了してから追加してください';
    const canvas = layerSystem.config?.canvas;
    if (!Number.isInteger(canvas?.width) || !Number.isInteger(canvas?.height)) return 'Canvas寸法を取得できません';
    if (context && (context.frame !== layerSystem.currentFrameContainer
        || context.width !== canvas.width || context.height !== canvas.height)) return 'Canvasが切り替わりました。編集入口を開き直してください';
    return '';
}

function validatedState(value) {
    if (!value || value.schema !== 'tegaki.rive-editor.state.v1'
        || !['loading', 'ready', 'building', 'error'].includes(value.status)) return null;
    const state = {
        schema: value.schema, status: value.status,
        documentId: String(value.documentId || '').slice(0, 160), buildId: String(value.buildId || '').slice(0, 160),
        sourceHash: String(value.sourceHash || '').slice(0, 64), angle: value.angle, progress: value.progress,
        dirty: value.dirty === true, reason: String(value.reason || '').slice(0, 512),
        image: { name: String(value.image?.name || '').slice(0, 120), width: value.image?.width, height: value.image?.height }
    };
    if (state.status === 'ready' && (!state.documentId || !state.buildId || !/^[a-f0-9]{64}$/i.test(state.sourceHash)
        || !Number.isFinite(state.angle) || state.angle < -90 || state.angle > 90
        || !Number.isFinite(state.progress) || state.progress < 0 || state.progress > 1
        || !Number.isInteger(state.image.width) || !Number.isInteger(state.image.height)
        || state.image.width < 1 || state.image.height < 1 || state.image.width > MAX_AXIS || state.image.height > MAX_AXIS)) return null;
    return state;
}

export function mountRiveEditorEntry({ container, layerSystem, history = historyManager }) {
    if (!container) return { destroy() {} };
    let dialog = null, iframe = null, sessionId = null, context = null, state = null, pending = null;
    let receiptButton = null, notice = null, inspector = null, connectTimer = null, destroyed = false;
    let connectionPanel = null, connectionText = null, retryButton = null, connectionController = null;
    let connectionGeneration = 0, connection = { phase: 'idle', reason: '' };
    const row = document.createElement('div');
    row.className = 'rive-editor-entry';
    // The Drawing grid's first row is deliberately zero-height. Reserve space
    // inside its existing width instead of placing another item in that row.
    const previousPadding = container.style.paddingTop, previousSizing = container.style.boxSizing;
    container.style.paddingTop = '34px'; container.style.boxSizing = 'border-box';
    row.style.cssText = 'position:absolute;top:4px;left:0;right:0;display:flex;align-items:center;gap:4px;max-height:30px;pointer-events:auto;z-index:2';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'gui-control gui-control--s';
    button.textContent = '新RIG（試作）'; button.dataset.testid = 'rive-editor-entry';
    button.title = 'PNG素材を動かし、現在フレームを新しいRasterレイヤーへ追加';
    const entryNotice = document.createElement('span');
    entryNotice.setAttribute('role', 'status');
    entryNotice.style.cssText = 'font-size:11px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    row.append(button, entryNotice); container.prepend(row);

    function activity() {
        const selection = window.pixelSelectionSystem || window.drawingApp?.pixelSelectionSystem;
        return { drawing: window.drawingEngine?.isDrawing === true,
            selectionTransform: Boolean(selection?.transformSession), capture: selection?.isTransformPreviewCaptureActive?.() === true };
    }
    function guard() { return riveRasterContextReason(layerSystem, history, context, activity()); }
    function announce(text, phase = state?.status || 'loading') {
        if (notice) notice.textContent = text;
        if (dialog) dialog.dataset.editorStatus = phase;
        if (inspector) inspector.textContent = JSON.stringify({ state, connection, host: { phase, reason: text, pendingRequest: pending?.requestId || null } }, null, 2);
        if (receiptButton) receiptButton.disabled = Boolean(pending || state?.status !== 'ready' || guard());
    }
    function releasePending() {
        if (pending?.timer) clearTimeout(pending.timer);
        pending = null;
    }
    function close() {
        connectionGeneration += 1; connectionController?.abort(); connectionController = null;
        releasePending(); clearTimeout(connectTimer);
        dialog?.close(); iframe?.remove(); iframe = null;
        dialog?.remove(); dialog = null; state = null; sessionId = null; context = null;
        connectionPanel = null; connectionText = null; retryButton = null;
        connection = { phase: 'idle', reason: '' };
    }
    function showConnection(phase, reason, message) {
        connection = { phase, reason };
        if (connectionPanel) { connectionPanel.dataset.connectionPhase = phase; connectionPanel.hidden = false; }
        if (connectionText) connectionText.textContent = message;
        if (retryButton) retryButton.hidden = phase !== 'error';
        announce(message, phase === 'error' ? 'error' : 'loading');
    }
    async function connectEditor() {
        const generation = ++connectionGeneration;
        connectionController?.abort(); clearTimeout(connectTimer);
        const controller = new AbortController(); connectionController = controller;
        state = null; releasePending(); sessionId = crypto.randomUUID();
        iframe.hidden = true; iframe.removeAttribute('src');
        showConnection('starting', '', '編集画面を準備しています…');
        const startupTimeout = setTimeout(() => controller.abort(), 35000);
        try {
            await ensureRiveEditorConnection({ signal: controller.signal });
            if (generation !== connectionGeneration || destroyed || !dialog?.open) return;
            showConnection('loading', '', '編集画面を読み込んでいます…');
            iframe.src = `${RIVE_EDITOR_ORIGIN}/?embed=1#${new URLSearchParams({ session: sessionId, parent: location.origin })}`;
            connectTimer = setTimeout(() => {
                if (generation === connectionGeneration && !state) {
                    iframe.hidden = true;
                    showConnection('error', 'native-load-timeout', connectionNotice('native-load-timeout'));
                }
            }, 10000);
        } catch (error) {
            if (generation !== connectionGeneration || destroyed || !dialog?.open) return;
            const reason = error.name === 'AbortError' ? 'start-timeout' : (error.reason || 'connection-failed');
            showConnection('error', reason, connectionNotice(reason));
        } finally {
            clearTimeout(startupTimeout);
            if (connectionController === controller) connectionController = null;
        }
    }
    function open() {
        if (destroyed) return;
        if (dialog?.open) { dialog.focus(); return; }
        context = null;
        const reason = guard();
        if (reason) { entryNotice.textContent = reason; return; }
        if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(location.origin)) {
            entryNotice.textContent = 'この試作はローカル開発Canvasで使用してください'; return;
        }
        entryNotice.textContent = '';
        context = { frame: layerSystem.currentFrameContainer, width: layerSystem.config.canvas.width, height: layerSystem.config.canvas.height };
        sessionId = crypto.randomUUID();
        dialog = document.createElement('dialog'); dialog.id = 'rive-editor-host';
        dialog.setAttribute('aria-label', '新RIG 試作編集'); dialog.dataset.testid = 'rive-editor-host';
        dialog.style.cssText = 'width:min(1080px,calc(100vw - 24px));height:min(760px,calc(100dvh - 24px));box-sizing:border-box;margin:auto;padding:8px;border:1px solid var(--futaba-light-medium,#d4a8a0);border-radius:8px;background:var(--futaba-cream,#f0e0d6);color:var(--futaba-maroon,#800000)';
        const shell = document.createElement('div'); shell.style.cssText = 'height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px';
        const heading = document.createElement('header'); heading.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';
        const title = document.createElement('strong'); title.textContent = '新RIG（試作） · PNG素材 → 変形 → フレーム追加';
        const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'gui-control gui-control--s'; exit.textContent = '閉じる';
        exit.addEventListener('click', close); heading.append(title, exit);
        iframe = document.createElement('iframe'); iframe.title = 'Rive画像rig編集'; iframe.dataset.testid = 'rive-editor-frame';
        iframe.style.cssText = 'width:100%;height:100%;border:0;background:var(--futaba-background,#ffffee)';
        iframe.hidden = true;
        const editorBody = document.createElement('div'); editorBody.style.cssText = 'position:relative;min-height:0;overflow:hidden';
        connectionPanel = document.createElement('div'); connectionPanel.dataset.testid = 'rive-connection';
        connectionPanel.style.cssText = 'position:absolute;inset:0;align-content:center;text-align:center;padding:16px;box-sizing:border-box';
        connectionText = document.createElement('p'); connectionText.setAttribute('role', 'status');
        retryButton = document.createElement('button'); retryButton.type = 'button'; retryButton.className = 'gui-control';
        retryButton.textContent = '再試行'; retryButton.dataset.testid = 'rive-connect-retry'; retryButton.hidden = true;
        retryButton.addEventListener('click', connectEditor);
        connectionPanel.append(connectionText, retryButton); editorBody.append(iframe, connectionPanel);
        const footer = document.createElement('footer'); footer.style.cssText = 'display:grid;gap:4px;font-size:11px';
        notice = document.createElement('div'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
        receiptButton = document.createElement('button'); receiptButton.type = 'button'; receiptButton.className = 'gui-control';
        receiptButton.textContent = '現在フレームを新レイヤーへ'; receiptButton.dataset.testid = 'rive-frame-import'; receiptButton.disabled = true;
        receiptButton.addEventListener('click', requestFrame);
        const info = document.createElement('span'); info.textContent = '原寸でCanvas中央へ追加。元レイヤーは変更しません。編集素材の保存は上の編集面で行います。';
        const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '状態を確認';
        inspector = document.createElement('pre'); inspector.dataset.testid = 'rive-host-state'; inspector.style.cssText = 'max-height:90px;overflow:auto;white-space:pre-wrap;margin:4px 0';
        details.append(summary, inspector); footer.append(notice, receiptButton, info, details);
        shell.append(heading, editorBody, footer); dialog.append(shell); document.body.append(dialog);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.showModal();
        void connectEditor();
    }
    function requestFrame() {
        const reason = guard();
        if (reason || state?.status !== 'ready' || pending) { announce(reason || '編集の準備が終わるまでお待ちください'); return; }
        pending = { requestId: crypto.randomUUID(), buildId: state.buildId, documentId: state.documentId, progress: state.progress, consumed: false };
        pending.timer = setTimeout(() => { releasePending(); announce('フレームを取得できませんでした。もう一度追加してください', 'error'); }, 10000);
        iframe.contentWindow.postMessage({ type: 'tegaki:rive-editor:request-frame', version: 1, sessionId, requestId: pending.requestId }, RIVE_EDITOR_ORIGIN);
        announce('フレームを取得しています', 'requesting');
    }
    async function receive(event) {
        if (!acceptsRiveEditorMessage(event, iframe?.contentWindow, sessionId)) return;
        const data = event.data;
        if (data.type === 'tegaki:rive-editor:state') {
            const next = validatedState(data.state);
            if (!next) { announce('編集状態の形式を確認できません', 'error'); return; }
            state = next; clearTimeout(connectTimer);
            connection = { phase: 'connected', reason: '' };
            connectionPanel.hidden = true; iframe.hidden = false;
            announce(state.reason || `${state.image.name || 'PNG素材'} · ${state.image.width || '?'}×${state.image.height || '?'} · ${state.dirty ? '未保存' : '保存済み'}`); return;
        }
        if (data.type === 'tegaki:rive-editor:error') {
            if (pending && data.requestId === pending.requestId) { releasePending(); announce(String(data.reason || 'フレーム取得を拒否しました').slice(0, 512), 'error'); } return;
        }
        const failure = validateRiveFrameReceipt(data, pending, state);
        if (failure) { if (pending && !pending.consumed) { releasePending(); announce(`フレームを追加できません: ${failure}`, 'error'); } return; }
        const receipt = pending; receipt.consumed = true;
        let bitmap;
        try {
            const reason = guard(); if (reason) throw new Error(reason);
            bitmap = await createImageBitmap(new Blob([data.png], { type: 'image/png' }));
            if (bitmap.width !== data.width || bitmap.height !== data.height) throw new Error('PNGの実寸が一致しません');
            if (pending !== receipt || !dialog?.open || destroyed) throw new Error('受渡しを終了しました');
            const stale = guard(); if (stale) throw new Error(stale);
            if (state.buildId !== receipt.buildId || state.progress !== receipt.progress || state.documentId !== receipt.documentId) throw new Error('処理中にフレームが変わりました');
            const canvas = document.createElement('canvas'); canvas.width = data.width; canvas.height = data.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('PNGを読み取れません');
            ctx.drawImage(bitmap, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const created = layerSystem.createRasterLayerFromSnapshot({ width: data.width, height: data.height, pixels,
                rasterBounds: { x: Math.floor((context.width - data.width) / 2), y: Math.floor((context.height - data.height) / 2), width: data.width, height: data.height }, paths: [], pathsData: [] },
            { name: `RIG ${state.image.name || 'フレーム'}`.slice(0, 120), historyName: 'rive-frame-import', source: 'rive-editor' });
            if (!created?.layer?.layerData) throw new Error('新レイヤーを追加できません');
            releasePending(); announce('新しいRasterレイヤーへ追加しました。Undoで戻せます', 'complete');
        } catch (error) {
            if (pending === receipt) { releasePending(); announce(String(error.message || error), 'error'); }
        } finally { bitmap?.close?.(); }
    }
    // Parent footer focus must not route V/Delete/Undo into the covered Canvas.
    // Native button/Tab/Escape defaults remain available; iframe keys stay inside it.
    const captureHostKeys = event => { if (dialog?.open) event.stopPropagation(); };
    button.addEventListener('click', open); window.addEventListener('message', receive);
    window.addEventListener('keydown', captureHostKeys, true);
    return { open, getSnapshot: () => ({ state, connection, context: context ? { width: context.width, height: context.height } : null }),
        destroy() { destroyed = true; close(); window.removeEventListener('message', receive);
            window.removeEventListener('keydown', captureHostKeys, true); button.removeEventListener('click', open); row.remove();
            container.style.paddingTop = previousPadding; container.style.boxSizing = previousSizing; } };
}
