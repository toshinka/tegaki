/** ROLE: Shared normal-Canvas panel destination for new manga rasters.
 * Uses existing panel recipes, Folder placement and clipping commands. No new
 * Project field or CAF/History authority. Async renderers retain a target token.
 */
const states = new WeakMap();
const id = layer => layer?.layerData?.id;
function rank(layer, layers, seen = new Set()) {
    if (seen.has(layer)) return 0;
    seen.add(layer);
    if (layer.layerData?.isFolder) return Math.max(0, ...layers.filter(child => child.layerData?.parentId === id(layer)).map(child => rank(child, layers, seen)));
    return layer.layerData?.lettering ? 3 : layer.layerData?.balloon ? 2 : layer.layerData?.focusLines ? 1 : 0;
}

export class MangaPanelTarget {
    constructor({ root, layerSystem, history } = {}) {
        Object.assign(this, { root, layerSystem, history });
        if (!states.has(layerSystem)) states.set(layerSystem, { folderId: '', explicit: false });
        this.state = states.get(layerSystem);
        this.row = document.createElement('label');
        this.row.className = 'manga-panel-target';
        this.row.innerHTML = '<span>配置先</span><select class="pl-select" aria-label="新規素材の配置先コマ"></select><span class="manga-panel-target__hint">白にclip</span>';
        this.select = this.row.querySelector('select');
        this.select.title = '新規追加の収納先。更新は元レイヤーの位置を保持します';
        this.select.addEventListener('change', () => {
            this.state.folderId = this.select.value; this.state.explicit = true;
            this.sync();
        });
        root.querySelector('.manga-edit-actions__commit')?.before(this.row);
        this.sync();
    }

    panels() {
        const layers = this.layerSystem.getLayers();
        return layers.filter(layer => layer.layerData?.isFolder && layer.layerData.panelLayout?.role === 'folder'
            && !layer.layerData.isAnimationWorkingLayer).map(folder => {
            const meta = folder.layerData.panelLayout;
            const paper = layers.find(layer => layer.layerData?.parentId === id(folder)
                && layer.layerData.panelLayout?.role === 'paper' && layer.layerData.panelLayout.groupId === meta.groupId
                && layer.layerData.panelLayout.panelId === meta.panelId);
            return { folder, paper };
        }).filter(panel => panel.paper);
    }

    sync() {
        if (this.state.frame !== this.layerSystem.currentFrameContainer) {
            this.state.frame = this.layerSystem.currentFrameContainer;
            this.state.folderId = ''; this.state.explicit = false;
        }
        const panels = this.panels(), byId = new Map(this.layerSystem.getLayers().map(layer => [id(layer), layer]));
        if (!this.state.explicit) {
            let active = this.layerSystem.getActiveLayer?.();
            const seen = new Set();
            while (active && !seen.has(active)) {
                seen.add(active);
                if (panels.some(panel => panel.folder === active)) { this.state.folderId = id(active); break; }
                active = byId.get(active.layerData.parentId);
            }
        }
        const signature = JSON.stringify(panels.map(panel => [id(panel.folder), panel.folder.layerData.name]));
        if (signature !== this.signature) {
            this.signature = signature;
            this.select.replaceChildren(new Option('Canvas', ''), ...panels.map(panel => new Option(panel.folder.layerData.name, id(panel.folder))));
        }
        if (this.state.folderId && !panels.some(panel => id(panel.folder) === this.state.folderId)) {
            // Keep a missing explicit destination visible; never silently place elsewhere.
            if (![...this.select.options].some(option => option.value === this.state.folderId)) this.select.add(new Option('コマが見つかりません', this.state.folderId));
        }
        this.select.value = this.state.folderId;
        this.row.hidden = this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer === true;
        this.row.querySelector('.manga-panel-target__hint').hidden = !this.state.folderId;
    }

    token() {
        this.sync();
        const panel = this.panels().find(panel => id(panel.folder) === this.state.folderId);
        return { frame: this.layerSystem.currentFrameContainer, folderId: this.state.folderId, ...panel };
    }

    create(snapshot, options, kind, token = this.token()) {
        const current = this.panels().find(panel => id(panel.folder) === token.folderId);
        if (token.frame !== this.layerSystem.currentFrameContainer || token.folderId !== this.state.folderId
            || (token.folderId && (!current || current.folder !== token.folder || current.paper !== token.paper))
            || this.layerSystem.getActiveLayer?.()?.layerData?.isAnimationWorkingLayer
            || this.history.isApplying || this.history.isRecordingSuppressed?.()) {
            return { ok: false, reason: '配置先が変わりました。コマを選び直して適用してください' };
        }
        let count = 0;
        try {
            const created = this.layerSystem.createRasterLayerFromSnapshot(snapshot, options);
            if (!created?.layer) return { ok: false, reason: '素材レイヤーを作成できません' };
            count++;
            if (current) {
                const layers = this.layerSystem.getLayers();
                let content = layers.find(layer => layer.layerData?.isFolder && layer.layerData.parentId === id(current.folder)
                    && layer.layerData.clippingMode === 'normal'
                    && this.layerSystem._resolveClippingSourceLayers(layer, layers).length === 1
                    && this.layerSystem._resolveClippingSourceLayers(layer, layers)[0] === current.paper);
                if (!content) {
                    content = this.layerSystem.createFolder('内容')?.layer;
                    if (!content) throw new Error('内容フォルダを作成できません');
                    count++;
                    if (!this.layerSystem.moveLayerNearLayerInFolder(id(content), id(current.paper), 'before')) throw new Error('内容フォルダを配置できません');
                    count++;
                    if (!this.layerSystem.setLayerClippingMode(this.layerSystem.getLayerIndex(content), 'normal')) throw new Error('白コマへclipできません');
                    count++;
                }
                // Older white panels put the drawing raster directly above the
                // paper. Bring that raster into the same clipped Folder so it
                // cannot cover newly placed dialogue. The pixel data stays intact.
                const oldInner = layers.filter(layer => layer.layerData?.parentId === id(current.folder)
                    && layer.layerData.panelLayout?.role === 'inner'
                    && layer.layerData.panelLayout.groupId === current.paper.layerData.panelLayout.groupId
                    && layer.layerData.panelLayout.panelId === current.paper.layerData.panelLayout.panelId);
                for (const inner of oldInner) {
                    if (!this.layerSystem.moveLayerIntoFolder(id(inner), id(content))) throw new Error('内描画を内容フォルダへ収納できません');
                    count++;
                    if (inner.layerData.clippingMode !== 'none') {
                        if (!this.layerSystem.setLayerClippingMode(this.layerSystem.getLayerIndex(inner), 'none')) throw new Error('内描画のclipを引き継げません');
                        count++;
                    }
                }
                const placedLayers = this.layerSystem.getLayers();
                const siblings = placedLayers.filter(layer => layer.layerData?.parentId === id(content));
                const higher = siblings.filter(layer => rank(layer, placedLayers) > ({ lettering: 3, balloon: 2, 'focus-lines': 1 }[kind] || 0));
                const placed = higher.length
                    ? this.layerSystem.moveLayerNearLayerInFolder(id(created.layer), id(higher[0]), 'after')
                    : siblings.length
                        ? this.layerSystem.moveLayerNearLayerInFolder(id(created.layer), id(siblings.at(-1)), 'before')
                        : this.layerSystem.moveLayerIntoFolder(id(created.layer), id(content));
                if (!placed) throw new Error('素材をコマへ収納できません');
                count++;
                this.layerSystem.refreshClippingMasks?.();
            }
            if (count > 1) this.history.mergeLastCommands(count, options.historyName, { type: options.historyName, panelFolderId: token.folderId });
            this.sync();
            return { ok: true, ...created };
        } catch (error) {
            if (count > 1) this.history.mergeLastCommands(count, options.historyName);
            if (count) this.history.undo();
            return { ok: false, reason: error.message || 'コマへ素材を配置できません' };
        }
    }
}
