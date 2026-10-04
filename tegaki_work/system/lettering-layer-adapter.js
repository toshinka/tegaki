/**
 * ROLE: Editable manga lettering → ordinary Raster Layer / History adapter.
 * AUTHORITY: LayerSystem pixels remain display/save/export authority; lettering
 *            is optional sanitized re-edit data, never a font or renderer cache.
 * INVARIANTS: one History per commit, verify current pixels before replacement,
 *             failed/stale render leaves the document unchanged; normal Canvas only.
 * RELATED: WP-025, lettering-model, ProjectManager, createRasterLayerFromSnapshot.
 */
import { normalizeLetteringParams, sanitizeLetteringData } from './lettering-model.js';
import { renderLettering } from './lettering-vector-renderer.js';
import { fontLibrary as defaultFontLibrary } from './font-library.js';
import { letteringRasterFingerprint, letteringFingerprintMatches } from './lettering-fingerprint.js';
import { hideLetteringPreviewSource, restoreLetteringPreviewSource } from './lettering-preview-display.js';
export { letteringRasterFingerprint, letteringFingerprintMatches } from './lettering-fingerprint.js';

export class LetteringLayerAdapter {
    constructor({ layerSystem, history, eventBus, fontLibrary = defaultFontLibrary, render = renderLettering } = {}) {
        Object.assign(this, { layerSystem, history, eventBus, fontLibrary, render });
        this.busy = false;
        this.previewSource = null;
        this._onContent = payload => {
            if (payload?.layerId === this.previewSource?.layerData?.id && !String(payload?.source || '').startsWith('lettering-')) this.endPreview();
        };
        this.eventBus?.on?.('layer:content-changed', this._onContent);
    }
    beginPreview(layerId) {
        const layer = this._find(layerId);
        if (layer && this.previewSource === layer && !this._guard() && this._untransformed(layer)) return true;
        this.endPreview();
        if (!layer || this._guard() || !this._untransformed(layer)) return false;
        const recipe = sanitizeLetteringData(layer.layerData.lettering, this._canvas());
        if (!recipe || !letteringFingerprintMatches(recipe.fingerprint,
            letteringRasterFingerprint(this.layerSystem.createLayerRasterSnapshot(layer)))) return false;
        const dirty = () => this.layerSystem._folderCompositor?.markDirty?.();
        if (!hideLetteringPreviewSource(layer, dirty)) return false;
        this.previewSource = layer; return true;
    }
    endPreview() {
        if (this.previewSource) restoreLetteringPreviewSource(this.previewSource);
        this.previewSource = null;
    }
    destroy() { this.endPreview(); this.eventBus?.off?.('layer:content-changed', this._onContent); }
    _canvas() {
        return { width: this.layerSystem?.config?.canvas?.width || this.layerSystem?.canvasWidth || 400,
            height: this.layerSystem?.config?.canvas?.height || this.layerSystem?.canvasHeight || 400 };
    }
    _guard() {
        if (!this.layerSystem?.createRasterLayerFromSnapshot) return '文字レイヤーを作成できません';
        if (!this.history?.record || this.history.isApplying || this.history.isRecordingSuppressed?.()) return '履歴処理が終わってから文字を適用してください';
        if (this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer) return '文字は通常Canvasで編集してください';
        return '';
    }
    _find(id) { return this.layerSystem?.getLayers?.().find(layer => layer.layerData?.id === id); }
    _untransformed(layer) {
        return (layer?.position?.x || 0) === 0 && (layer?.position?.y || 0) === 0
            && (layer?.rotation || 0) === 0 && (layer?.scale?.x ?? 1) === 1 && (layer?.scale?.y ?? 1) === 1
            && (layer?.pivot?.x || 0) === 0 && (layer?.pivot?.y || 0) === 0;
    }
    loadActive() {
        const reason = this._guard();
        if (reason) return { ok: false, reason };
        const layer = this.layerSystem.getActiveLayer?.();
        const meta = sanitizeLetteringData(layer?.layerData?.lettering, this._canvas());
        if (!meta) return { ok: false, reason: '選択レイヤーに再編集できる文字がありません' };
        const current = this.layerSystem.createLayerRasterSnapshot(layer);
        const intact = this._untransformed(layer) && letteringFingerprintMatches(meta.fingerprint, letteringRasterFingerprint(current));
        return { ok: true, params: structuredClone(meta.params), layerId: layer.layerData.id, intact,
            reason: intact ? '' : '画素が変更されています。「追加」で別の文字レイヤーを作成できます' };
    }
    async apply(input) { return this._commit(null, input); }
    async update(layerId, input) { return this._commit(layerId, input); }
    async _commit(layerId, input) {
        const reason = this._guard();
        if (reason) return { ok: false, reason };
        if (this.busy) return { ok: false, reason: '文字を処理中です' };
        this.busy = true;
        let rollback = null;
        try {
            const canvas = this._canvas();
            const frame = this.layerSystem.currentFrameContainer;
            const params = normalizeLetteringParams(input, canvas);
            if (!params.text.trim()) return { ok: false, reason: '文字を入力してください' };
            let layer = layerId ? this._find(layerId) : null;
            let metaBefore = layerId ? sanitizeLetteringData(layer?.layerData?.lettering, canvas) : null;
            if (layerId && (!layer || !metaBefore || layer.layerData.isAnimationWorkingLayer)) {
                return { ok: false, reason: '再編集中の文字レイヤーが見つかりません' };
            }
            const intact = () => !layerId || (this._untransformed(layer) && letteringFingerprintMatches(metaBefore.fingerprint,
                letteringRasterFingerprint(this.layerSystem.createLayerRasterSnapshot(layer))));
            if (!intact()) return { ok: false, reason: '手描き・変形後の画素は上書きできません。「追加」で別レイヤーを作成してください' };
            const raster = await this.render(params, { fontLibrary: this.fontLibrary });
            if (!raster?.ok) return { ok: false, reason: raster?.reason || '文字を描画できません' };
            if (this._guard() || frame !== this.layerSystem.currentFrameContainer || JSON.stringify(canvas) !== JSON.stringify(this._canvas())) {
                return { ok: false, reason: 'Canvasが切り替わりました。もう一度適用してください' };
            }
            if (layerId && (this._find(layerId) !== layer || !intact())) {
                return { ok: false, reason: '処理中にレイヤーが変更されました。「追加」で別レイヤーを作成してください' };
            }
            const pixels = new Uint8ClampedArray(raster.pixels);
            if (pixels.length !== raster.width * raster.height * 4) return { ok: false, reason: '文字画像のサイズが不正です' };
            const content = { width: raster.width, height: raster.height, pixels,
                rasterBounds: raster.rasterBounds, paths: [], pathsData: [] };
            if (!layerId) {
                const created = this.layerSystem.createRasterLayerFromSnapshot(content, {
                    name: `文字 ${params.text.replace(/\s+/g, ' ').slice(0, 16)}`,
                    historyName: 'lettering-apply', source: 'lettering',
                    lettering: { version: 1, params: structuredClone(params) }
                });
                layer = created?.layer;
                if (!layer?.layerData) return { ok: false, reason: '文字レイヤーを作成できません' };
                // LayerSystem attaches and validates the pixel/recipe pair before
                // its one History notification; no second GPU readback is needed.
                this._changed(layer.layerData.id, 'lettering-apply');
                return { ok: true, layerId: layer.layerData.id };
            }
            const before = this.layerSystem.createLayerRasterSnapshot(layer);
            const after = { ...before, ...content };
            rollback = () => {
                this.layerSystem.restoreLayerRasterSnapshot(before);
                layer.layerData.lettering = structuredClone(metaBefore);
            };
            if (!this.layerSystem.restoreLayerRasterSnapshot(after)) {
                rollback(); rollback = null;
                return { ok: false, reason: '文字レイヤーを更新できません' };
            }
            const actual = this.layerSystem.createLayerRasterSnapshot(layer);
            const fingerprint = letteringRasterFingerprint(actual);
            if (!fingerprint) {
                rollback(); rollback = null;
                return { ok: false, reason: '文字の画素を確認できないため更新を取り消しました' };
            }
            const metaAfter = { version: 1, params: structuredClone(params), fingerprint };
            // Keep the canonical readback in redo to make the pixel/metadata pair stable.
            const afterCanonical = { ...after, ...actual };
            layer.layerData.lettering = metaAfter;
            const restore = (snapshot, meta) => {
                if (!this.layerSystem.restoreLayerRasterSnapshot(snapshot)) throw new Error('文字レイヤーを復元できません');
                const target = this._find(layerId);
                if (!target) throw new Error('文字レイヤーが見つかりません');
                target.layerData.lettering = structuredClone(meta);
                this._changed(layerId, 'lettering-update');
            };
            this.history.record({
                name: 'lettering-update', do: () => restore(afterCanonical, metaAfter), undo: () => restore(before, metaBefore),
                byteSize: before.pixels.byteLength + afterCanonical.pixels.byteLength,
                meta: { type: 'lettering-update', layerId }
            });
            rollback = null;
            this._changed(layerId, 'lettering-update');
            return { ok: true, layerId };
        } catch (error) {
            try { rollback?.(); } catch (restoreError) { console.error('[Lettering] rollback failed', restoreError); }
            return { ok: false, reason: error?.message || '文字の適用に失敗しました' };
        } finally { this.busy = false; }
    }
    _changed(layerId, source) {
        this.eventBus?.emit('layer:content-changed', { layerId, source });
        const layer = this._find(layerId);
        if (layer) this.layerSystem.requestThumbnailUpdate?.(this.layerSystem.getLayerIndex(layer), true);
    }
}
