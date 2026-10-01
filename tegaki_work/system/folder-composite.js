/**
 * ============================================================================
 * ファイル名: system/folder-composite.js
 * 責務: フォルダの「グループ合成」(フォルダ自身の合成モード/不透明度)と、フォルダのサムネイル生成
 * 依存: pixi.js (Container / Sprite / RenderTexture / Matrix)、LayerSystem(getLayers, config, app, eventBus)
 * 被依存: system/layer-system.js, system/export-manager.js, ui/layer-panel-renderer.js
 * 公開API: FolderCompositor, isCompositedFolderData, collectCompositedFolderIds
 * 保存: なし(表示専用の派生物)。フォルダの合成モード/不透明度は既存のlayerData(blendMode/opacity)のまま。
 *
 * 背景
 *   フォルダは「論理グループ」で、子Layerは同じframe containerの兄弟として描かれる。以前はフォルダの不透明度を
 *   子へ掛け算していただけで、フォルダの合成モード(乗算/加算/…)は子へ伝わらず無効だった。
 *
 * 方式(非破壊・既存の子Layer/History/保存/Layer順序には触れない)
 *   - 「合成フォルダ」= 合成モードが通常でない or 不透明度<1 のフォルダ。
 *   - 合成フォルダの子孫Layerは renderable=false にして通常描画から外し、子孫を (自分のblend/alphaのまま)
 *     キャンバス寸法のRenderTextureへ順に描き、そのSpriteをフォルダContainerの中(=子の真上)に置く。
 *     SpriteにフォルダのblendModeとalphaが掛かるので、グループとして合成される(グループ不透明度も正しい)。
 *   - 入れ子は内側(index小)から先に描く。更新は dirty のときだけ(描画中/変形中は毎フレーム)。
 *   - 書き出し(renderToCanvas)の直前に flush() し、最新の合成をextractへ載せる。
 *   - サムネイルは同じ「描画対象の列」を縮小RenderTextureへ描く(フォルダ自身のblend/opacityは含めない)。
 * 実装状態: ✅実装
 * ============================================================================
 */

import { Container, Matrix, RenderTexture, Sprite } from 'pixi.js';

const DIRTY_EVENTS = [
    'layer:content-changed', 'thumbnail:layer-updated', 'thumbnail:updated', 'layer:reordered', 'layer:opacity-changed',
    'layer:blend-mode-changed', 'layer:visibility-changed', 'layer:clipping-changed', 'layer:added-to-folder',
    'layer:transform-updated', 'layer:transform-exit', 'layer:created', 'layer:deleted', 'layer:panel-update-requested',
    'history:changed', 'canvas:resized', 'drawing:stroke-completed', 'drawing:stroke-cancelled'
];

/** 合成フォルダか(フォルダ自身の合成モード/不透明度が効く対象か)。 */
export function isCompositedFolderData(data) {
    if (!data?.isFolder) return false;
    const blend = data.blendMode || 'normal';
    const opacity = Number.isFinite(data.opacity) ? data.opacity : 1;
    return blend !== 'normal' || opacity < 0.999;
}

function descendantRasterCount(folderData, byId, seen = new Set()) {
    let count = 0;
    for (const id of folderData.children || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const child = byId.get(id)?.layerData;
        if (!child) continue;
        if (child.isFolder) count += descendantRasterCount(child, byId, seen);
        else if (!child.isBackground) count += 1;
    }
    return count;
}

/** 合成フォルダのid集合(子孫に通常Layerが1枚もないフォルダは対象外)。 */
export function collectCompositedFolderIds(layers) {
    const byId = new Map(layers.filter(l => l?.layerData?.id).map(l => [l.layerData.id, l]));
    const ids = new Set();
    for (const layer of layers) {
        const data = layer?.layerData;
        if (isCompositedFolderData(data) && descendantRasterCount(data, byId) > 0) ids.add(data.id);
    }
    return ids;
}

function unpremultiply(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a > 0 && a < 255) {
            d[i] = Math.min(255, Math.round((d[i] * 255) / a));
            d[i + 1] = Math.min(255, Math.round((d[i + 1] * 255) / a));
            d[i + 2] = Math.min(255, Math.round((d[i + 2] * 255) / a));
        }
    }
    ctx.putImageData(image, 0, 0);
}

export class FolderCompositor {
    constructor(layerSystem) {
        this.layerSystem = layerSystem;
        this.entries = new Map();      // folderId → { layer, rt, sprite }
        this.hidden = new Set();       // renderable=false にした Layer
        this.compositedIds = new Set();
        this.dirty = true;
        this.version = 0;              // 内容が変わるたびに増える(サムネイルのcache用)
        this.pointerActive = false;
        this.emptyContainer = new Container();
        this.thumbCache = new Map();   // folderId → { version, key, url }
        this._offs = [];
        this._tick = () => this.update();

        const bus = layerSystem.eventBus;
        for (const name of DIRTY_EVENTS) {
            const handler = () => this.markDirty();
            bus?.on?.(name, handler);
            this._offs.push(() => bus?.off?.(name, handler));
        }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            const down = () => { this.pointerActive = true; this.markDirty(); };
            const up = () => { this.pointerActive = false; this.markDirty(); };
            window.addEventListener('pointerdown', down, true);
            window.addEventListener('pointerup', up, true);
            window.addEventListener('pointercancel', up, true);
            this._offs.push(() => {
                window.removeEventListener('pointerdown', down, true);
                window.removeEventListener('pointerup', up, true);
                window.removeEventListener('pointercancel', up, true);
            });
        }
        layerSystem.app?.ticker?.add?.(this._tick);
    }

    markDirty() {
        this.dirty = true;
        this.version += 1;
    }

    isComposited(folderId) {
        return this.compositedIds.has(folderId);
    }

    _canvasSize() {
        const c = this.layerSystem.config?.canvas || {};
        return { width: Math.max(1, Math.round(c.width || 1)), height: Math.max(1, Math.round(c.height || 1)) };
    }

    _byId(layers) {
        return new Map(layers.filter(l => l?.layerData?.id).map(l => [l.layerData.id, l]));
    }

    /** layerData.children の順ではなく、実際のz順(index昇順)で直接の子を返す。 */
    _directChildren(folderLayer, layers, byId) {
        const ids = new Set(folderLayer.layerData.children || []);
        return layers.filter(l => ids.has(l?.layerData?.id) && byId.get(l.layerData.id) === l);
    }

    /** フォルダの描画対象(下から上): 通常Layer / 合成済みの入れ子フォルダ(proxy入りContainer)。 */
    collectItems(folderLayer, layers = this.layerSystem.getLayers(), byId = this._byId(layers), composited = this.compositedIds) {
        const out = [];
        const walk = (folder, seen) => {
            if (seen.has(folder.layerData.id)) return;
            seen.add(folder.layerData.id);
            for (const child of this._directChildren(folder, layers, byId)) {
                const data = child.layerData;
                if (!data.isFolder) out.push(child);
                else if (composited.has(data.id)) out.push(child);
                else walk(child, seen);
            }
        };
        walk(folderLayer, new Set());
        return out;
    }

    /** 合成フォルダの子孫すべて(通常描画から外す対象)。 */
    _descendants(folderLayer, layers, byId) {
        const out = [];
        const seen = new Set();
        const walk = (folder) => {
            for (const child of this._directChildren(folder, layers, byId)) {
                if (seen.has(child.layerData.id)) continue;
                seen.add(child.layerData.id);
                out.push(child);
                if (child.layerData.isFolder) walk(child);
            }
        };
        walk(folderLayer);
        return out;
    }

    /** 合成フォルダの集合・描画から外すLayer・proxyを現在のLayer構成へ合わせる。 */
    sync(layers = this.layerSystem.getLayers()) {
        const byId = this._byId(layers);
        const composited = collectCompositedFolderIds(layers);
        this.compositedIds = composited;

        const nextHidden = new Set();
        for (const id of composited) {
            for (const layer of this._descendants(byId.get(id), layers, byId)) nextHidden.add(layer);
        }
        for (const layer of this.hidden) {
            if (!nextHidden.has(layer)) layer.renderable = true;
        }
        for (const layer of nextHidden) layer.renderable = false;
        this.hidden = nextHidden;

        // 不要になったproxyを片付ける
        for (const [id, entry] of [...this.entries]) {
            if (!composited.has(id) || byId.get(id) !== entry.layer) this._destroyEntry(id, entry);
        }
        const size = this._canvasSize();
        for (const id of composited) {
            const layer = byId.get(id);
            let entry = this.entries.get(id);
            if (entry && (entry.rt.width !== size.width || entry.rt.height !== size.height)) {
                this._destroyEntry(id, entry);
                entry = null;
            }
            if (!entry) {
                const rt = RenderTexture.create({ width: size.width, height: size.height, resolution: 1 });
                const sprite = new Sprite(rt);
                sprite.label = 'folder_composite_sprite';
                sprite.eventMode = 'none';
                sprite.position.set(0, 0);
                layer.addChild(sprite);
                entry = { layer, rt, sprite };
                this.entries.set(id, entry);
            }
            // フォルダ自身の合成モード。不透明度はフォルダContainerのalpha(effective alpha)が掛かる。
            entry.sprite.blendMode = layer.layerData.blendMode || 'normal';
        }
        this.markDirty();
    }

    _destroyEntry(id, entry) {
        entry.sprite.parent?.removeChild(entry.sprite);
        entry.sprite.destroy();
        entry.rt.destroy(true);
        this.entries.delete(id);
    }

    _renderItems(items, rt, matrix = null) {
        const renderer = this.layerSystem.app?.renderer;
        if (!renderer) return;
        renderer.render({ container: this.emptyContainer, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
        for (const item of items) {
            const wasRenderable = item.renderable;
            item.renderable = true;
            try {
                renderer.render({ container: item, target: rt, clear: false, ...(matrix ? { transform: matrix } : {}) });
            } finally {
                item.renderable = wasRenderable;
            }
        }
    }

    /** dirtyな間(描画/変形中は毎フレーム)だけ、合成フォルダを内側から順に描き直す。 */
    update(force = false) {
        if (!this.entries.size) return;
        if (!force && !this.dirty && !this.pointerActive) return;
        this.dirty = false;
        const layers = this.layerSystem.getLayers();
        const byId = this._byId(layers);
        const ordered = [...this.entries.values()].sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer));
        for (const entry of ordered) {
            if (entry.layer.visible === false) continue;
            this._renderItems(this.collectItems(entry.layer, layers, byId), entry.rt);
        }
    }

    /** 書き出しなど、描画の直前に最新の合成を反映する。 */
    flush() {
        this.update(true);
    }

    /**
     * フォルダのサムネイル(PNG dataURL)。内容が変わっていなければcacheを返す。
     * @returns {string} 子孫に通常Layerが無い場合は ''。
     */
    getThumbnailUrl(folderLayer, width = 40, height = 32) {
        const id = folderLayer?.layerData?.id;
        const renderer = this.layerSystem.app?.renderer;
        if (!id || !renderer) return '';
        const key = `${width}x${height}`;
        const cached = this.thumbCache.get(id);
        if (cached && cached.version === this.version && cached.key === key) return cached.url;

        const layers = this.layerSystem.getLayers();
        const byId = this._byId(layers);
        const items = this.collectItems(folderLayer, layers, byId);
        if (!items.length) {
            this.thumbCache.set(id, { version: this.version, key, url: '' });
            return '';
        }
        const size = this._canvasSize();
        const scale = Math.min(width / size.width, height / size.height) * 2; // 2倍で作って縮小表示(くっきり)
        const tw = Math.max(1, Math.round(size.width * scale));
        const th = Math.max(1, Math.round(size.height * scale));
        let url = '';
        const rt = RenderTexture.create({ width: tw, height: th, resolution: 1 });
        try {
            this._renderItems(items, rt, new Matrix().scale(tw / size.width, th / size.height));
            const canvas = renderer.extract.canvas({ target: rt });
            unpremultiply(canvas);
            url = canvas.toDataURL('image/png');
        } catch (error) {
            url = '';
        } finally {
            rt.destroy(true);
        }
        this.thumbCache.set(id, { version: this.version, key, url });
        return url;
    }

    destroy() {
        this.layerSystem.app?.ticker?.remove?.(this._tick);
        this._offs.forEach(off => off());
        this._offs = [];
        for (const [id, entry] of [...this.entries]) this._destroyEntry(id, entry);
        for (const layer of this.hidden) layer.renderable = true;
        this.hidden.clear();
    }
}
