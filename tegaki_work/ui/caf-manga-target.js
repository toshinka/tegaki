/** ROLE: Manga raster -> selected CAF adapter, without a second save authority.
 * Existing DrawingSnapshot/internal Layer and CAF asset History own the result.
 * Re-edit recipes stay normal-Canvas-only. Async callers retain a target token.
 */
import { DrawingSnapshotModel } from '../system/animation/animation-data-model.js';
import { historyManager } from '../system/history.js';

export function animationTable() {
    return window.PopupManager?.get?.('animationTable')
        || window.PopupManager?.popups?.get?.('animationTable')?.instance
        || window.coreEngine?.popupManager?.get?.('animationTable') || null;
}

export function cafMangaTarget(layerSystem, table = animationTable()) {
    if (!layerSystem?.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer) return null;
    const clip = table?.model?.findClipEntry?.(table.selectedCelId)?.clip;
    const asset = clip?.assetId ? table.model.getClipAsset(clip.assetId) : null;
    const reason = !asset ? '追加先のCAFを選択してください'
        : table.isPlaying ? '再生を止めてから追加してください'
        : table.isSelectedWorkingRestoreBlocked?.() ? 'CAFの原画を復元できないため追加できません'
        : layerSystem.getLayerMoveCommitState?.()?.active ? '変形を確定してから追加してください'
        : window.coreEngine?.brushCore?.isDrawing ? '描画を終えてから追加してください'
        : historyManager.isApplying || historyManager.isRecordingSuppressed?.() ? '履歴処理が終わってから追加してください'
        : '';
    return { table, model: table?.model, clipId: clip?.id, asset, reason };
}

export function appendMangaRaster(layerSystem, raster, name, source, token = cafMangaTarget(layerSystem)) {
    const current = cafMangaTarget(layerSystem);
    if (!token || token.reason || !current || current.reason || current.model !== token.model
        || current.clipId !== token.clipId || current.asset !== token.asset) {
        return { ok: false, reason: current?.reason || token?.reason || '追加先のCAFが切り替わりました。もう一度適用してください' };
    }
    const { table, asset, model } = current;
    if (!raster?.ok || !raster.width || !raster.height || raster.pixels?.length !== raster.width * raster.height * 4) {
        return { ok: false, reason: '追加する画像を確認できません' };
    }
    if (!table._validateInternalMergeSurface({ width: raster.width, height: raster.height }).ok) {
        return { ok: false, reason: '追加する画像が大きすぎます' };
    }
    table._saveSelectedClipFromWorkingLayers();
    const before = table._captureActiveCafAssetHistoryState(asset);
    try {
        const snapshot = new DrawingSnapshotModel({ width: raster.width, height: raster.height,
            rasterBounds: raster.rasterBounds, pixels: new Uint8ClampedArray(raster.pixels), isBlank: false });
        const layer = model.createClipAssetInternalLayer({ name, type: 'raster', drawingSnapshotId: snapshot.id });
        model.drawingSnapshots.push(snapshot);
        // Internal layers use top-to-bottom order. Effects are initially above all source layers.
        asset.internalLayers.unshift(layer);
        asset.updatedAt = Date.now();
        table.selectedInternalLayerId = layer.id;
        table._resetCafPreviewRuntime?.('manga-raster-add');
        const clip = model.findClipEntry(token.clipId)?.clip;
        // Capacity growth is display adaptation, not a second normal Layer History entry.
        const wasApplying = historyManager.isApplying;
        historyManager.isApplying = true;
        try {
            if (!clip || table._syncClipAssetToWorkingLayers(clip, { forceRestore: true }) === false) throw new Error('CAFへ画像を復元できません');
        } finally { historyManager.isApplying = wasApplying; }
        const after = table._captureActiveCafAssetHistoryState(asset);
        if (!table._recordActiveCafAssetHistoryFromStates(asset, before, after, `${source}-caf-add`, { source })) throw new Error('CAFの履歴を記録できません');
        table.render(); table._requestLayerPanelSync({ force: true });
        return { ok: true, caf: true, internalLayerId: layer.id, assetId: asset.id };
    } catch (error) {
        const wasApplying = historyManager.isApplying;
        historyManager.isApplying = true;
        try { table._restoreActiveCafAssetHistoryState(asset.id, before); }
        finally { historyManager.isApplying = wasApplying; }
        return { ok: false, reason: error.message || 'CAFへ追加できませんでした' };
    }
}

const controlOverrides = new WeakMap();
/** Restore adapter-owned UI changes before the tool computes its normal state. */
export function restoreMangaTargetControls(root) {
    for (const [button, state] of controlOverrides.get(root) || []) {
        button.disabled = state.disabled; button.textContent = state.text; button.title = state.title;
    }
    controlOverrides.delete(root);
}
/** Called after each tool's own control sync; context is selection, not Table visibility. */
export function syncMangaTargetControls(root, layerSystem, kind) {
    if (!root) return;
    const target = cafMangaTarget(layerSystem);
    const allowed = ['lettering', 'focus-lines', 'balloon'].includes(kind);
    let status = root.querySelector('[data-role="manga-target-status"]');
    if (!status) {
        status = document.createElement('div'); status.dataset.role = 'manga-target-status';
        status.className = 'manga-target-status'; status.setAttribute('role', 'status');
        root.querySelector('.manga-edit-actions')?.append(status);
    }
    status.hidden = !target;
    if (!target) return;
    const overrides = [];
    const remember = button => overrides.push([button, { disabled: button.disabled, text: button.textContent, title: button.title }]);
    status.textContent = !allowed ? '通常Canvas専用です。Tableの「静止画コピー」から素材を取り出せます。'
        : target.reason || 'CAFへ焼き込み追加。同じ素材を使う全クリップに反映／再編集は通常Canvasのみ。';
    const apply = root.querySelector('[data-action="apply"]');
    if (apply) { remember(apply); apply.disabled = apply.disabled || !allowed || !!target.reason; if (allowed) apply.textContent = 'CAFへ焼き込み追加'; }
    for (const action of ['update', 'load-active']) {
        const button = root.querySelector(`[data-action="${action}"]`);
        if (button) { remember(button); button.disabled = true; button.title = 'CAFでは再編集情報を保存しません。新規焼き込みか静止画コピーを使用してください'; }
    }
    controlOverrides.set(root, overrides);
}
