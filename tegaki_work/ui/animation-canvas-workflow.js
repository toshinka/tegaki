/** ROLE: Explicit normal Canvas -> CAF entry and non-destructive Album copy exit.
 * AUTHORITY: ProjectManager/Album existing copies; never persists a mode or backup schema.
 */
import { showFeedbackToast } from './feedback-toast.js';
import { historyManager } from '../system/history.js';

export class AnimationCanvasWorkflow {
    constructor(table) {
        this.table = table; this.busy = false;
        const header = table.panel.querySelector('.anim-table-header');
        this.root = document.createElement('div'); this.root.className = 'anim-canvas-workflow';
        this.root.innerHTML = `<button type="button" data-start>アニメとして開始</button>
            <button type="button" data-copy>静止画コピー</button><button type="button" data-close>閉じる</button><span role="status"></span>`;
        header.prepend(this.root);
        this.root.querySelector('[data-start]').addEventListener('click', () => this.start());
        this.root.querySelector('[data-copy]').addEventListener('click', () => this.copy());
        this.root.querySelector('[data-close]').addEventListener('click', () => table.hide());
    }
    get awaiting() {
        const t = this.table;
        return !t.initialClipAssetSeeded && !t.model.clipAssets.length && !t.model.tracks.some(lane => lane.cels?.length);
    }
    album() { return window.PopupManager?.get?.('album') || window.coreEngine?.popupManager?.get?.('album'); }
    sync() {
        const waiting = this.awaiting;
        this.table.panel.classList.toggle('is-awaiting-animation', waiting);
        this.root.querySelector('[data-start]').hidden = !waiting;
        this.root.querySelector('[data-copy]').hidden = waiting;
        this.root.querySelector('[data-start]').disabled = this.busy;
        this.root.querySelector('[data-copy]').disabled = this.busy || !this.table.selectedAssetId || this.table.isPlaying || this.table.isSelectedWorkingRestoreBlocked?.()
            || this.table.layerSystem.getLayerMoveCommitState?.()?.active || window.coreEngine?.brushCore?.isDrawing;
        this.root.querySelector('[role="status"]').textContent = this.busy ? 'コピーを保存中…'
            : waiting ? '開始前のCanvasをアルバムへ保存し、新しい履歴でアニメを開始します。'
            : '静止画コピーは素材のレイヤーを保持。動画の変形・動きは含みません。';
    }
    async start() {
        if (this.busy || !this.awaiting) return { ok: false };
        const table = this.table, model = table.model, frame = table.layerSystem.currentFrameContainer;
        const album = this.album();
        if (!album?.saveProjectCopy || !window.projectManager?.exportProject) return { ok: false, reason: 'アルバムを利用できません' };
        const historyIndex = historyManager.index;
        let normalCopy = null, converted = false;
        this.busy = true; this.sync();
        try {
            if (table.layerSystem.getLayerMoveCommitState?.()?.active) throw new Error('変形を確定してから開始してください');
            if (window.coreEngine?.brushCore?.isDrawing) throw new Error('描画を終えてから開始してください');
            const rasters = table.layerSystem.getLayers().filter(layer => layer.layerData?.renderTexture && !layer.layerData.isBackground && layer.layerData.visible !== false);
            if (!rasters.length) throw new Error('アニメ化できるRasterレイヤーがありません');
            if (rasters.some(layer => !table._validateInternalMergeSurface({ x: 0, y: 0, width: layer.layerData.renderTexture.width, height: layer.layerData.renderTexture.height }).ok)) throw new Error('Rasterが大きすぎるためアニメを開始できません');
            const projectData = await window.projectManager.exportProject();
            if (!projectData || projectData.animation) throw new Error('通常Canvasを確認できません');
            normalCopy = projectData;
            await album.saveProjectCopy(projectData);
            if (table.model !== model || frame !== table.layerSystem.currentFrameContainer || !this.awaiting || historyManager.index !== historyIndex || window.coreEngine?.brushCore?.isDrawing) throw new Error('作品が変更されました。開始をやり直してください');
            converted = true;
            // Starting a new animation document uses the existing Project-load boundary.
            // Normal Canvas commands must never later undo against CAF working layers.
            await window.projectManager.loadProject(normalCopy);
            table.model.syncWithLayers(table.layerSystem.getLayers(), table.layerSystem.getActiveLayerIndex());
            table._ensureInitialClipAssetSeed();
            if (!table.selectedCelId || table.isSelectedWorkingRestoreBlocked?.()) throw new Error('CAFの原画を復元できません');
            showFeedbackToast('アニメを開始しました。開始前のCanvasはアルバムから開けます');
            return { ok: true };
        } catch (error) {
            // After a failed conversion, use the existing Project-load boundary.
            // This restores the archived normal document; its old history is not reused as CAF history.
            if (converted && normalCopy) {
                try { await window.projectManager.loadProject(normalCopy); }
                catch (restoreError) {
                    const reason = '復元できませんでした。開始前のCanvasをアルバムから開いてください';
                    showFeedbackToast(reason); return { ok: false, reason };
                }
            }
            showFeedbackToast(error.message); return { ok: false, reason: error.message };
        }
        finally { this.busy = false; table.render(); }
    }
    async copy() {
        if (this.busy || this.awaiting) return { ok: false };
        if (this.table.isPlaying || this.table.isSelectedWorkingRestoreBlocked?.()) return { ok: false, reason: '再生を止め、素材を復元してからコピーしてください' };
        if (this.table.layerSystem.getLayerMoveCommitState?.()?.active || window.coreEngine?.brushCore?.isDrawing) {
            return { ok: false, reason: '描画・変形を確定してからコピーしてください' };
        }
        const album = this.album();
        if (!album?.saveActiveCafAsNormalCopy) return { ok: false, reason: 'アルバムを利用できません' };
        this.busy = true; this.sync();
        try {
            const result = await album.saveActiveCafAsNormalCopy();
            showFeedbackToast('静止画コピーをアルバムへ保存しました。開くと通常Canvasで編集できます');
            await album.showProjectCopy(result.snapshotId); return { ok: true, ...result };
        } catch (error) { showFeedbackToast(error.message); return { ok: false, reason: error.message }; }
        finally { this.busy = false; this.sync(); }
    }
}
