/**
 * ============================================================================
 * ファイル名: system/border-tool.js
 * 責務: フチツール。アクティブレイヤーの絵の輪郭に、太さ・色・位置(外/内)を指定した縁を付ける（プレビュー付き）
 * 依存: system/border-fill.js, system/pixel-selection-system.js(所有者・overlay), system/raster-bounds.js,
 *       system/raster-snapshot-memory.js, ui/inline-number-field.js, ui/feedback-toast.js
 * 被依存: system/selection-area-tools.js
 * 公開API: BorderEditor
 * 保存: 設定(太さ/位置)のみ localStorage 'tegaki-area-tools-v1'。結果は通常のRaster画素 + History 1件（レイヤー効果ではなく画素へ焼く）
 * 実装状態: ✅実装
 *
 * 操作: ツールを選ぶと操作盤が出て、キャンバスにフチのプレビューが重なる。太さ・位置を変え、「適用」(Enter)で画素へ焼く。
 *       色はメイン色。選択範囲があればその中だけに反映する。
 * ============================================================================
 */

import { BORDER_LIMITS, computeBorderPixels, contentBounds } from './border-fill.js';
import { normalizeRasterBounds } from './raster-bounds.js';
import { estimateRasterHistoryPairBytes } from './raster-snapshot-memory.js';
import { showFeedbackToast } from '../ui/feedback-toast.js';
import { createInlineNumberField } from '../ui/inline-number-field.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class BorderEditor {
    constructor(areaTools) {
        this.areaTools = areaTools;
        this.visible = false;
        this.panel = null;
        this.image = null;
        this.source = null; // { layerId, snapshot, rb, bounds }
        this.preview = null; // { url, region }
        this.frame = null;
        this.colorKey = '';
        this.pollTimer = null;
        this.unsubscribe = [];
    }

    get system() {
        return this.areaTools.system;
    }

    get options() {
        return this.areaTools.options.border;
    }

    /** ツールの有効/無効に合わせて操作盤とプレビューを出し入れする（selection systemから呼ぶ） */
    sync() {
        const active = this.system.toolActive === true && this.system.toolMode === 'border';
        if (active === this.visible) return;
        this.visible = active;
        if (active) this._show(); else this._hide();
    }

    _show() {
        this._ensurePanel();
        this.panel.style.display = 'flex';
        this._syncPanel();
        const bus = this.system.eventBus;
        if (bus?.on) {
            const invalidate = () => { this.source = null; this._schedule(); };
            const rerender = () => this.render();
            [['layer:content-changed', invalidate], ['layer:activated', invalidate], ['history:changed', invalidate],
                ['camera:transform-changed', rerender], ['layer:transform-updated', rerender]].forEach(([name, handler]) => {
                bus.on(name, handler);
                this.unsubscribe.push(() => bus.off?.(name, handler));
            });
        }
        // メイン色の変更を拾う（変更イベントに依存せず軽く見る）
        this.pollTimer = setInterval(() => {
            const key = this.areaTools.getColors().main.join(',');
            if (key !== this.colorKey) { this._syncPanel(); this._schedule(); }
        }, 400);
        this._schedule();
    }

    _hide() {
        this.unsubscribe.splice(0).forEach(fn => fn());
        if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
        if (this.frame) { cancelAnimationFrame(this.frame); this.frame = null; }
        if (this.panel) this.panel.style.display = 'none';
        if (this.image) this.image.style.display = 'none';
        this.source = null;
        this.preview = null;
    }

    // ------------------------------------------------------------ 操作盤

    _ensurePanel() {
        if (this.panel) return;
        const host = document.querySelector('.canvas-area') || document.body;
        const panel = document.createElement('div');
        panel.className = 'shape-tool-actions border-tool-panel';
        panel.style.display = 'none';
        panel.addEventListener('pointerdown', event => event.stopPropagation());

        const row1 = document.createElement('div');
        row1.className = 'shape-tool-row';
        const title = document.createElement('span');
        title.className = 'border-tool-title';
        title.textContent = 'フチ';
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'shape-tool-confirm';
        apply.textContent = '適用';
        apply.title = 'フチを画素に焼く (Enter)';
        apply.addEventListener('click', () => this.apply());
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'shape-tool-cancel';
        close.textContent = '×';
        close.title = 'フチツールを閉じる';
        close.addEventListener('click', () => this.system.setToolActive(false));
        row1.append(title, apply, close);

        const row2 = document.createElement('div');
        row2.className = 'shape-tool-row shape-tool-options';
        const width = createInlineNumberField('太さ', 'フチの太さ(px)。ホイールで増減', {
            min: BORDER_LIMITS.radius.min, max: BORDER_LIMITS.radius.max, step: 1, unit: 'px'
        }, v => { this.areaTools.setOptions({ border: { radius: Math.round(v) } }); this._schedule(); });
        const outside = document.createElement('button');
        outside.type = 'button';
        outside.className = 'shape-tool-chip';
        outside.textContent = '外';
        outside.title = '絵の外側にフチを付ける';
        outside.addEventListener('click', () => { this.areaTools.setOptions({ border: { position: 'outside' } }); this._syncPanel(); this._schedule(); });
        const inside = document.createElement('button');
        inside.type = 'button';
        inside.className = 'shape-tool-chip';
        inside.textContent = '内';
        inside.title = '絵の内側をフチ色にする';
        inside.addEventListener('click', () => { this.areaTools.setOptions({ border: { position: 'inside' } }); this._syncPanel(); this._schedule(); });
        const swatch = document.createElement('span');
        swatch.className = 'border-tool-swatch';
        swatch.title = 'フチの色（メイン色）';
        row2.append(width.field, outside, inside, swatch);

        panel.append(row1, row2);
        host.appendChild(panel);
        panel.style.left = '50%';
        panel.style.top = '12px';
        panel.style.transform = 'translateX(-50%)';
        this.panel = panel;
        this.parts = { width, outside, inside, swatch };
    }

    _syncPanel() {
        if (!this.parts) return;
        const { width, outside, inside, swatch } = this.parts;
        if (document.activeElement !== width.input) width.input.value = String(this.options.radius);
        outside.classList.toggle('is-active', this.options.position === 'outside');
        inside.classList.toggle('is-active', this.options.position === 'inside');
        const main = this.areaTools.getColors().main;
        this.colorKey = main.join(',');
        swatch.style.background = `rgb(${this.colorKey})`;
    }

    // ------------------------------------------------------------ プレビュー

    _schedule() {
        if (!this.visible || this.frame) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this._computePreview();
            this.render();
        });
    }

    _target() {
        const target = this.system._getActiveSelectionTarget?.();
        return target?.kind === 'layer' ? target : null;
    }

    _getSource(layer) {
        const layerId = layer.layerData.id;
        if (this.source?.layerId === layerId) return this.source;
        const snapshot = this.system.layerSystem?.createLayerRasterSnapshot?.(layer);
        if (!snapshot?.pixels) return null;
        const rb = normalizeRasterBounds(snapshot.rasterBounds, { width: snapshot.width, height: snapshot.height });
        const bounds = contentBounds({ pixels: snapshot.pixels, width: snapshot.width, height: snapshot.height, originX: rb.x, originY: rb.y });
        this.source = { layerId, snapshot, rb, bounds };
        return this.source;
    }

    _region(bounds) {
        const canvasCfg = this.system.layerSystem?.config?.canvas || window.TEGAKI_CONFIG?.canvas || {};
        const pad = (this.options.position === 'outside' ? this.options.radius + 2 : 0);
        const x0 = Math.max(0, bounds.x - pad);
        const y0 = Math.max(0, bounds.y - pad);
        const x1 = Math.min(Math.round(canvasCfg.width || 0), bounds.x + bounds.width + pad);
        const y1 = Math.min(Math.round(canvasCfg.height || 0), bounds.y + bounds.height + pad);
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }

    _compute(source, region) {
        const { snapshot, rb } = source;
        return computeBorderPixels(
            { pixels: snapshot.pixels, width: snapshot.width, height: snapshot.height, originX: rb.x, originY: rb.y },
            region,
            { radius: this.options.radius, rgb: this.areaTools.getColors().main, position: this.options.position }
        );
    }

    _computePreview() {
        this.preview = null;
        const target = this._target();
        if (!target) return;
        const source = this._getSource(target.layer);
        if (!source?.bounds) return;
        const region = this._region(source.bounds);
        if (!(region.width > 0 && region.height > 0)) return;
        const result = this._compute(source, region);
        if (!result) return;
        // 変わった画素だけを重ねる（元の絵を二重に描かない）
        const { snapshot, rb } = source;
        const delta = new Uint8ClampedArray(result.pixels.length);
        const r = result.region;
        for (let y = 0; y < r.height; y += 1) {
            for (let x = 0; x < r.width; x += 1) {
                const si = ((r.y + y - rb.y) * snapshot.width + (r.x + x - rb.x)) * 4;
                const di = (y * r.width + x) * 4;
                let diff = false;
                for (let k = 0; k < 4; k += 1) if (result.pixels[di + k] !== snapshot.pixels[si + k]) { diff = true; break; }
                if (diff) for (let k = 0; k < 4; k += 1) delta[di + k] = result.pixels[di + k];
            }
        }
        const canvas = document.createElement('canvas');
        canvas.width = r.width;
        canvas.height = r.height;
        canvas.getContext('2d').putImageData(new ImageData(delta, r.width, r.height), 0, 0);
        this.preview = { url: canvas.toDataURL('image/png'), region: r, layer: target.layer };
    }

    render() {
        const svg = this.system.overlay;
        if (!svg || typeof svg.appendChild !== 'function') return;
        if (!this.image) {
            const image = document.createElementNS(SVG_NS, 'image');
            image.setAttribute('preserveAspectRatio', 'none');
            image.style.display = 'none';
            image.style.pointerEvents = 'none';
            svg.appendChild(image);
            this.image = image;
        }
        const image = this.image;
        const preview = this.preview;
        if (!this.visible || !preview) {
            image.style.display = 'none';
            return;
        }
        const { region: b, layer } = preview;
        const toScreen = (x, y) => this.system._layerPointToScreen(layer, x, y);
        const p0 = toScreen(b.x, b.y);
        const p1 = toScreen(b.x + b.width, b.y);
        const p2 = toScreen(b.x, b.y + b.height);
        if (![p0, p1, p2].every(p => Number.isFinite(p?.clientX) && Number.isFinite(p?.clientY))) {
            image.style.display = 'none';
            return;
        }
        const a = (p1.clientX - p0.clientX) / b.width;
        const bb = (p1.clientY - p0.clientY) / b.width;
        const c = (p2.clientX - p0.clientX) / b.height;
        const d = (p2.clientY - p0.clientY) / b.height;
        image.setAttribute('href', preview.url);
        image.setAttribute('width', String(b.width));
        image.setAttribute('height', String(b.height));
        image.setAttribute('transform', `matrix(${a} ${bb} ${c} ${d} ${p0.clientX} ${p0.clientY})`);
        image.style.display = '';
        svg.classList.add('is-visible');
    }

    // ------------------------------------------------------------ 適用

    apply() {
        const system = this.system;
        const layerSystem = system.layerSystem;
        const target = this._target();
        if (!target) {
            showFeedbackToast('Raster Layerを選んでください');
            return false;
        }
        const layer = target.layer;
        const layerData = layer.layerData;
        if (!layerData?.renderTexture || layerData.isAnimationWorkingLayer === true) {
            showFeedbackToast('このレイヤーにはフチを付けられません');
            return false;
        }
        this.source = null; // 最新の画素で計算する
        const source = this._getSource(layer);
        if (!source?.bounds) {
            showFeedbackToast('フチを付ける絵がありません');
            return false;
        }
        const region = this._region(source.bounds);
        const expanded = layerSystem.ensureLayerRasterBoundsForRect?.(layer, region, { padding: 0 });
        if (expanded?.ok === false) {
            showFeedbackToast('描画範囲を広げられません（サイズ上限）');
            return false;
        }
        this.source = null;
        const fresh = this._getSource(layer);
        if (!fresh) return false;
        const result = this._compute(fresh, region);
        if (!result) return false;

        const before = fresh.snapshot;
        const after = { ...before, pixels: new Uint8ClampedArray(before.pixels), paths: [], pathsData: [] };
        const rb = fresh.rb;
        const r = result.region;
        const hasSel = system.hasSelection() && system.state.layerId === layerData.id && system.state.scope?.kind !== 'folder';
        const sel = hasSel ? { bounds: { ...system.state.bounds }, mask: system.state.mask || null } : null;
        let changed = 0;
        for (let y = 0; y < r.height; y += 1) {
            const py = r.y + y;
            for (let x = 0; x < r.width; x += 1) {
                const px = r.x + x;
                if (sel) {
                    const sb = sel.bounds;
                    if (px < sb.x || py < sb.y || px >= sb.x + sb.width || py >= sb.y + sb.height) continue;
                    if (sel.mask && sel.mask[(py - Math.floor(sb.y)) * sb.width + (px - Math.floor(sb.x))] !== 1) continue;
                }
                const di = (y * r.width + x) * 4;
                const si = ((py - rb.y) * after.width + (px - rb.x)) * 4;
                if (si < 0 || si + 3 >= after.pixels.length) continue;
                let diff = false;
                for (let k = 0; k < 4; k += 1) {
                    if (after.pixels[si + k] !== result.pixels[di + k]) { after.pixels[si + k] = result.pixels[di + k]; diff = true; }
                }
                if (diff) changed += 1;
            }
        }
        if (changed === 0) {
            showFeedbackToast('フチを付ける所がありません');
            return false;
        }
        if (!layerSystem.restoreLayerRasterSnapshot(after)) return false;

        const layerId = layerData.id;
        const retainedMemory = estimateRasterHistoryPairBytes(before, after);
        const restore = snapshot => {
            layerSystem.restoreLayerRasterSnapshot(snapshot);
            layerSystem.refreshClippingMasks?.();
            system.eventBus?.emit('layer:content-changed', { layerId, source: 'border-fill' });
        };
        system.history.record({
            name: 'border-fill',
            do: () => restore(after),
            undo: () => restore(before),
            byteSize: retainedMemory.estimatedBytes,
            meta: { type: 'border-fill', layerId, radius: this.options.radius, position: this.options.position, retainedMemory }
        });
        layerSystem.refreshClippingMasks?.();
        system.eventBus?.emit('layer:content-changed', { layerId, source: 'border-fill' });
        this.source = null;
        this._schedule();
        return true;
    }

    destroy() {
        this._hide();
        this.panel?.remove?.();
        this.image?.remove?.();
        this.panel = null;
        this.image = null;
    }
}
