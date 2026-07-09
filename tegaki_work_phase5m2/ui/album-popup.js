/**
 * ============================================================================
 * ファイル名: ui/album-popup.js
 * 責務: 作品のスナップショット（アルバム）の保存、表示、復元、管理（並べ替え・選択）UIを提供する
 * 依存: pixi.js, sortablejs, ui/ui-icons.js, system/project-manager.js
 * 被依存: core-engine.js, system/popup-manager.js
 * 公開API: AlbumPopup
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.AlbumPopup, window.TegakiUI.AlbumPopup
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { Container, Graphics, RenderTexture } from 'pixi.js';
import Sortable from 'sortablejs';

import { UI_ICONS } from './ui-icons.js';
import { albumStorage } from '../system/album-storage.js';
import { mountPopupAtOverlayRoot } from './popup-drag-helper.js';
import {
    ClipAssetInternalLayerModel,
    DrawingSnapshotModel
} from '../system/animation/animation-data-model.js';

export class AlbumPopup {
    constructor(dependencies = {}) {
        this.app = dependencies.app;
        this.layerSystem = dependencies.layerSystem;
        this.animationSystem = dependencies.animationSystem;
        
        this.popup = null;
        this.isVisible = false;
        this.snapshots = [];
        this.selectedSnapshotIds = new Set();
        this.lastSelectedSnapshotId = null;
        this.selectionMode = false;
        this.sortable = null;
        
        this._storageReady = this._initStorage();
        this._ensurePopupElement();
    }

    async _initStorage() {
        try {
            await albumStorage.init();
            await albumStorage.migrateFromLocalStorage();
            this.snapshots = await albumStorage.getSnapshotSummaries();
        } catch (e) {
            console.error('[AlbumPopup] Storage init failed', e);
        }
    }

    _ensurePopupElement() {
        this.popup = document.getElementById('album-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            mountPopupAtOverlayRoot(this.popup);
            this.popup.classList.remove('show');
            this.popup.style.display = 'none';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.main-layout') || document.body;
        if (!container) return;

        const popupDiv = document.createElement('div');
        popupDiv.id = 'album-popup';
        popupDiv.className = 'popup-panel popup-panel--translucent';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.width = '80%';
        popupDiv.style.maxWidth = '900px';
        popupDiv.style.height = '80vh';
        popupDiv.style.maxHeight = '700px';
        popupDiv.style.display = 'none';
        popupDiv.style.flexDirection = 'column';
        
        popupDiv.innerHTML = `
            <button class="ui-close-button ui-close-button--medium" id="album-close-btn" title="閉じる">
                ${UI_ICONS.close}
            </button>
            <div class="popup-title">アルバム</div>
            
            <!-- アルバムツールバー -->
            <div class="album-toolbar">
                <div class="album-toolbar-group">
                    <button id="albumSave" class="ui-icon-button ui-icon-button--large" title="現在の状態をアルバムに追加">
                        ${UI_ICONS.bookPlus.replace('stroke-width="2"', 'stroke-width="1.8"')}
                    </button>
                    <button id="albumSaveActiveCaf" class="ui-icon-button ui-icon-button--large album-caf-action" title="アクティブCAFをアルバムに追加">
                        ${UI_ICONS.bookPlus.replace('stroke-width="2"', 'stroke-width="1.8"')}
                    </button>
                    <span class="album-toolbar-divider" aria-hidden="true"></span>
                    <button id="albumRestoreProject" class="ui-icon-button ui-icon-button--large" title="選択中を通常Projectとしてロード" style="display:none;">
                        ${UI_ICONS.bookOpenCheck.replace('stroke-width="2"', 'stroke-width="1.8"')}
                    </button>
                    <button id="albumRestoreCaf" class="ui-icon-button ui-icon-button--large album-caf-action" title="選択中をアクティブCAFへロード" style="display:none;">
                        ${UI_ICONS.bookOpenCheck.replace('stroke-width="2"', 'stroke-width="1.8"')}
                    </button>
                </div>

                <div class="album-toolbar-group">
                    <button id="albumSelectMode" class="ui-icon-button ui-icon-button--medium" title="選択をすべて解除" style="display:none;">
                        ${UI_ICONS.listChecks.replace('stroke-width="2"', 'stroke-width="1.8"')}
                    </button>
                    <span id="albumSelectionCount" class="album-selection-badge" style="display:none;">0</span>
                    <button id="albumBatchDelete" class="ui-icon-button ui-icon-button--medium" title="選択中を削除" style="display:none;">
                        ${UI_ICONS.trash}
                    </button>
                </div>

                <div class="album-toolbar-group">
                    <button id="albumExport" class="ui-icon-button ui-icon-button--medium" title="アルバムをHTMLとして保存">
                        ${UI_ICONS.download}
                    </button>
                    <button id="albumImport" class="ui-icon-button ui-icon-button--medium" title="保存したアルバムHTML/JSONを読み込み">
                        ${UI_ICONS.load}
                    </button>
                    <input type="file" id="albumImportFile" accept=".html,.json,text/html,application/json" style="display:none;">
                </div>

                <div class="album-toolbar-group album-toolbar-emergency">
                    <button id="albumHospital" class="ui-icon-button ui-icon-button--large hospital-btn" title="緊急避難所：自動退避データはまだありません" disabled>
                        ${UI_ICONS.hospital}
                    </button>
                </div>
            </div>
            
            <div id="albumProjectSaveTarget" class="album-project-save-target">
                <span id="albumProjectSaveTargetText">Project保存先: 未設定</span>
                <button id="albumProjectSaveTargetChange" class="ui-icon-button ui-icon-button--small" title="Project保存先を選び直す">
                    ${UI_ICONS.folderOpen}
                </button>
            </div>
            <div id="albumStorageStatus" class="album-storage-status" data-pressure="unknown">保存領域: 計算中...</div>
            <div id="albumGallery" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 0; display: grid; grid-template-columns: repeat(auto-fill, 130px); gap: 12px; align-content: start; justify-content: start;"></div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        
        // イベントバインド
        const closeBtn = document.getElementById('album-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.hide();

        const saveBtn = document.getElementById('albumSave');
        if (saveBtn) saveBtn.onclick = () => this._saveSnapshot();

        const saveActiveCafBtn = document.getElementById('albumSaveActiveCaf');
        if (saveActiveCafBtn) saveActiveCafBtn.onclick = () => this._saveActiveCafSnapshot();

        const selectModeBtn = document.getElementById('albumSelectMode');
        if (selectModeBtn) selectModeBtn.onclick = () => this._toggleSelectionMode();

        const batchDeleteBtn = document.getElementById('albumBatchDelete');
        if (batchDeleteBtn) batchDeleteBtn.onclick = () => this._batchDelete();

        const restoreProjectBtn = document.getElementById('albumRestoreProject');
        if (restoreProjectBtn) restoreProjectBtn.onclick = () => this._loadSelectedSnapshot('project');

        const restoreCafBtn = document.getElementById('albumRestoreCaf');
        if (restoreCafBtn) restoreCafBtn.onclick = () => this._loadSelectedSnapshot('active-caf');

        const hospitalBtn = document.getElementById('albumHospital');
        if (hospitalBtn) hospitalBtn.onclick = () => this._loadHospitalCheckpoint();

        const exportBtn = document.getElementById('albumExport');
        if (exportBtn) exportBtn.onclick = () => this._exportAlbum();

        const importBtn = document.getElementById('albumImport');
        const importFile = document.getElementById('albumImportFile');
        if (importBtn && importFile) {
            importBtn.onclick = () => importFile.click();
            importFile.onchange = (e) => this._handleAlbumImport(e);
        }

        const saveTargetChangeBtn = document.getElementById('albumProjectSaveTargetChange');
        if (saveTargetChangeBtn) {
            saveTargetChangeBtn.onclick = () => this._changeProjectSaveTarget();
        }
    }

    _formatBytes(bytes) {
        const value = Number(bytes) || 0;
        if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
        if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
        if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${Math.round(value)} B`;
    }

    async _updateStorageStatus() {
        const statusEl = document.getElementById('albumStorageStatus');
        if (!statusEl) return;
        try {
            const usage = await albumStorage.estimateUsage(this.snapshots);
            const browserUsage = usage.browserUsageBytes;
            const browserQuota = usage.browserQuotaBytes;
            const browserRatio = browserUsage && browserQuota ? browserUsage / browserQuota : 0;
            const albumText = this._formatBytes(usage.albumBytes);
            const browserText = browserUsage && browserQuota
                ? ` / ブラウザ ${this._formatBytes(browserUsage)} / ${this._formatBytes(browserQuota)}`
                : '';
            const pressure = browserRatio >= 0.95 ? 'critical' : (browserRatio >= 0.8 ? 'warning' : 'normal');
            statusEl.dataset.pressure = pressure;
            statusEl.textContent = `保存領域: Album概算 ${albumText} (${usage.count}件)${browserText}`;
            statusEl.title = `projectData: ${this._formatBytes(usage.projectBytes)} / thumbnail: ${this._formatBytes(usage.thumbnailBytes)} / 最大項目: ${this._formatBytes(usage.maxSnapshotBytes)}`;
        } catch (error) {
            statusEl.dataset.pressure = 'unknown';
            statusEl.textContent = '保存領域: 取得できません';
            statusEl.title = error?.message || String(error);
        }
    }

    _updateProjectSaveTargetStatus() {
        const textEl = document.getElementById('albumProjectSaveTargetText');
        if (!textEl) return;
        const label = window.projectManager?.getCurrentSaveTargetLabel?.() || '';
        textEl.textContent = label
            ? `Project保存先: ${label}`
            : 'Project保存先: 未設定';
        textEl.title = label
            ? `現在のProject保存先: ${label}`
            : 'CAF/Animation保存時に保存先を選択します';
    }

    async _changeProjectSaveTarget() {
        const result = await window.projectManager?.selectSaveLocation?.({ showToast: true });
        if (result?.ok) {
            this._updateProjectSaveTargetStatus();
        }
    }

    async _loadSelectedSnapshot(mode = 'auto') {
        if (this.selectedSnapshotIds.size !== 1) return;
        const id = Array.from(this.selectedSnapshotIds)[0];
        const snapshot = await albumStorage.getSnapshot(id);
        if (snapshot) {
            this._loadSnapshot(snapshot, { mode });
        }
    }

    async _loadHospitalCheckpoint() {
        if (!window.emergencyRecoveryStore) return;
        
        const checkpoint = await window.emergencyRecoveryStore.getLatestCheckpoint();
        if (!checkpoint) {
            alert('復帰可能なデータが見つかりませんでした。');
            return;
        }

        const dateStr = new Date(checkpoint.timestamp).toLocaleString();
        if (confirm(`最後の自動退避（${dateStr}）へ復帰します。現在のキャンバス状態は置き換わります。実行しますか？`)) {
            if (window.projectManager && checkpoint.projectData) {
                try {
                    await window.projectManager.loadProject(checkpoint.projectData);
                    this.hide();
                } catch (e) {
                    console.error('[AlbumPopup] Hospital restore failed:', e);
                    alert('復元に失敗しました。');
                }
            }
        }
    }

    _toggleSelectionMode() {
        this._setSelectionMode(!this.selectionMode);
    }

    _setSelectionMode(enabled) {
        this.selectionMode = !!enabled;

        const btn = document.getElementById('albumSelectMode');
        if (btn) {
            btn.classList.toggle('active', this.selectionMode);
        }

        if (!this.selectionMode) {
            this.selectedSnapshotIds.clear();
            this.lastSelectedSnapshotId = null;
        }

        this._updateToolbarState();
        this._renderGallery();
    }

    _updateToolbarState() {
        const badge = document.getElementById('albumSelectionCount');
        const delBtn = document.getElementById('albumBatchDelete');
        const restoreProjectBtn = document.getElementById('albumRestoreProject');
        const restoreCafBtn = document.getElementById('albumRestoreCaf');
        const clearBtn = document.getElementById('albumSelectMode');
        const hospitalBtn = document.getElementById('albumHospital');
        const saveActiveCafBtn = document.getElementById('albumSaveActiveCaf');
        const count = this.selectedSnapshotIds.size;
        const selectedSummary = this._getSingleSelectedSnapshotSummary();
        const isActiveCafItem = selectedSummary?.snapshotType === 'active-caf' || selectedSummary?.hasActiveCafData === true;
        const hasActiveCaf = !!this._getActiveCafAsset();

        if (badge) {
            badge.textContent = count;
            badge.style.display = (count > 0) ? 'inline-block' : 'none';
        }

        if (delBtn) {
            delBtn.style.display = (count > 0) ? 'flex' : 'none';
        }

        if (restoreProjectBtn) {
            restoreProjectBtn.style.display = (count === 1) ? 'flex' : 'none';
            restoreProjectBtn.title = isActiveCafItem
                ? '選択中のCAF素材を通常Projectとしてロード'
                : '選択中を通常Projectとしてロード';
        }

        if (restoreCafBtn) {
            restoreCafBtn.style.display = (count === 1 && isActiveCafItem) ? 'flex' : 'none';
            restoreCafBtn.disabled = !hasActiveCaf;
            restoreCafBtn.title = hasActiveCaf
                ? '選択中のCAF素材をアクティブCAFへロード'
                : '取り込み先のアクティブCAFを選択してください';
        }

        if (clearBtn) {
            // 選択されている時のみ解除ボタンを表示
            clearBtn.style.display = (count > 0) ? 'flex' : 'none';
        }

        if (saveActiveCafBtn) {
            saveActiveCafBtn.disabled = !hasActiveCaf;
            saveActiveCafBtn.title = hasActiveCaf
                ? 'アクティブCAFをアルバムに追加'
                : 'アクティブCAFを選択すると保存できます';
        }

        // 緊急復帰ボタンの状態制御
        if (hospitalBtn && window.emergencyRecoveryStore) {
            window.emergencyRecoveryStore.getLatestCheckpoint().then(checkpoint => {
                hospitalBtn.disabled = !checkpoint;
                hospitalBtn.classList.toggle('available', !!checkpoint);
                hospitalBtn.title = checkpoint
                    ? `緊急避難所：${new Date(checkpoint.timestamp).toLocaleString()} の自動退避から復帰`
                    : '緊急避難所：自動退避データはまだありません';
            }).catch(() => {
                hospitalBtn.disabled = true;
                hospitalBtn.classList.remove('available');
                hospitalBtn.title = '緊急避難所：自動退避データを確認できません';
            });
        }
    }

    async _batchDelete() {
        if (this.selectedSnapshotIds.size === 0) return;

        if (confirm(`${this.selectedSnapshotIds.size}件のアルバム項目を削除しますか？`)) {
            const deleteIds = Array.from(this.selectedSnapshotIds);
            const deleteSet = new Set(deleteIds);
            
            try {
                await albumStorage.deleteSnapshots(deleteIds);
                this.snapshots = this.snapshots.filter(s => !deleteSet.has(s.id));
                this.selectedSnapshotIds.clear();
                this.lastSelectedSnapshotId = null;
                
                this._updateToolbarState();
                this._renderGallery();
                this._updateStorageStatus();
            } catch (e) {
                console.error('[AlbumPopup] Batch delete failed', e);
                alert('削除に失敗しました。');
            }
        }
    }

    async _exportAlbum() {
        // 選択中があれば選択中のみ、なければ全件
        const exportSummaries = this.selectedSnapshotIds.size > 0
            ? this.snapshots.filter(s => this.selectedSnapshotIds.has(s.id))
            : this.snapshots;

        if (exportSummaries.length === 0) {
            alert('書き出す項目がありません');
            return;
        }
        const exportTargets = await albumStorage.getSnapshotsByIds(exportSummaries.map(snapshot => snapshot.id));

        const data = {
            app: "tegaki-album",
            version: 1,
            exportedAt: Date.now(),
            count: exportTargets.length,
            snapshots: exportTargets
        };

        this._downloadTextFile(
            this._createAlbumHTML(data),
            `tegaki_album_export_${this._timestampForFile()}.html`,
            'text/html'
        );
    }

    _createAlbumHTML(data) {
        const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');
        const cards = data.snapshots.map((snapshot, index) => {
            const label = this._escapeHTML(this._formatSnapshotTime(snapshot.timestamp) || `作品 ${index + 1}`);
            const src = snapshot.thumbnail || '';
            return `
                <figure class="album-card">
                    <img src="${src}" alt="${label}">
                    <figcaption>${label}</figcaption>
                </figure>
            `;
        }).join('');

        return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tegaki Album</title>
<style>
body{margin:0;background:#ffffee;color:#3a2018;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
header{position:sticky;top:0;background:#f0e0d6;border-bottom:1px solid #b8706b;padding:14px 18px;font-weight:700;color:#8b0000;}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;padding:18px;}
.album-card{margin:0;background:#ffffee;border:1px solid #efc9c4;border-radius:6px;overflow:hidden;}
.album-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:contain;background:#ffffee;}
.album-card figcaption{border-top:1px solid #efc9c4;padding:8px 10px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
</style>
</head>
<body>
<header>Tegaki Album (${data.snapshots.length})</header>
<main>${cards}</main>
<script id="tegaki-album-data" type="application/json">${safeJson}</script>
</body>
</html>`;
    }

    _downloadTextFile(text, filename, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = filename;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    _timestampForFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return timestamp;
    }

    _escapeHTML(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _formatSnapshotTime(timestamp) {
        if (!timestamp) return '';
        try {
            return new Date(timestamp).toLocaleString('ja-JP');
        } catch {
            return '';
        }
    }

    _handleAlbumImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            let data = null;
            try {
                data = this._parseAlbumImportText(event.target.result);
                if (this._isTegakiProjectData(data)) {
                    await this._loadImportedProjectData(data, file);
                    e.target.value = '';
                    return;
                }
                if (data.app !== 'tegaki-album' || !Array.isArray(data.snapshots)) {
                    throw new Error('Invalid album format');
                }
            } catch (err) {
                console.error('[AlbumPopup] Import parse failed:', err);
                alert('アルバムファイルの解析に失敗しました。');
                e.target.value = '';
                return;
            }

            if (confirm(`${data.snapshots.length}件の項目を現在のアルバムに追加しますか？`)) {
                // IDの衝突を避けるために再採番
                const now = Date.now();
                const baseOrder = this.snapshots.length;
                const newSnapshots = data.snapshots.map((snapshot, index) => {
                    const normalized = this._normalizeImportedSnapshot(
                        snapshot,
                        now + index + Math.floor(Math.random() * 1000)
                    );
                    normalized.order = baseOrder + index;
                    return normalized;
                });

                try {
                    await albumStorage.putSnapshots(newSnapshots);
                    this.snapshots = await albumStorage.getSnapshotSummaries();
                    this._renderGallery();
                    this._updateStorageStatus();
                }
                catch (err) {
                    console.error('[AlbumPopup] Import storage failed:', err);
                    alert('アルバムの保存容量が不足している可能性があります。既存項目を減らすか、分割して読み込んでください。');
                }
            }
            e.target.value = '';
        };
        reader.onerror = (err) => {
            console.error('[AlbumPopup] Import file read failed:', err);
            alert('アルバムファイルを読み取れませんでした。');
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    _isTegakiProjectData(data) {
        return !!(data && data.app === 'tegaki' && data.version);
    }

    async _loadImportedProjectData(projectData, file = null) {
        if (!window.projectManager?.loadProject) {
            alert('Project読み込み機能が利用できません。');
            return;
        }
        try {
            this.hide();
            await window.projectManager.loadProject(projectData);
            if (file?.name) {
                window.projectManager.currentFileName = file.name;
                window.projectManager.currentFileHandle = null;
            }
            window.projectManager?._showSaveToast?.('Projectを読み込みました');
        } catch (error) {
            console.error('[AlbumPopup] Project import failed:', error);
            alert('Project JSONの読み込みに失敗しました。');
        }
    }

    _getSingleSelectedSnapshotSummary() {
        if (this.selectedSnapshotIds.size !== 1) return null;
        const id = Array.from(this.selectedSnapshotIds)[0];
        return this.snapshots.find(snapshot => snapshot.id === id) || null;
    }

    _normalizeImportedSnapshot(snapshot, nextId) {
        const normalized = {
            ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
            id: nextId
        };
        if (typeof normalized.projectData === 'string') {
            try {
                normalized.projectData = JSON.parse(normalized.projectData);
            } catch {
                normalized.projectData = null;
            }
        }
        if (!normalized.projectData && normalized.project && typeof normalized.project === 'object') {
            normalized.projectData = normalized.project;
        }
        normalized.timestamp = Number.isFinite(normalized.timestamp)
            ? normalized.timestamp
            : Date.now();
        normalized.thumbnail = typeof normalized.thumbnail === 'string'
            ? normalized.thumbnail
            : '';
        return normalized;
    }

    _parseAlbumImportText(text) {
        const trimmed = String(text || '').trim();
        if (trimmed.startsWith('<')) {
            const doc = new DOMParser().parseFromString(trimmed, 'text/html');
            const dataScript = doc.getElementById('tegaki-album-data');
            if (!dataScript?.textContent) {
                throw new Error('Album HTML does not contain tegaki-album-data');
            }
            return JSON.parse(dataScript.textContent);
        }
        return JSON.parse(trimmed);
    }

    _setupButtonHover(btn) {
        btn.onmouseenter = () => {
            btn.style.background = 'var(--futaba-maroon)';
            btn.style.color = 'var(--text-inverse)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'var(--futaba-background)';
            btn.style.color = 'var(--futaba-maroon)';
        };
    }

    async _saveSnapshot() {
        if (window.projectManager?.hasCurrentAnimationProject?.()) {
            await this._saveAnimationReferenceSnapshot();
            return;
        }

        const snapshot = await this._captureSnapshot();
        if (snapshot?.thumbnail) {
            let pushedToMemory = false;
            try {
                const shouldUseAlbum = await this._confirmLargeSnapshotAlbumSave(snapshot);
                if (!shouldUseAlbum) {
                    await window.projectManager?.saveProjectDataToFile?.(snapshot.projectData);
                    return;
                }
                snapshot.order = this.snapshots.length;
                const summary = await albumStorage.putSnapshot(snapshot);
                this.snapshots.push(summary || {
                    id: snapshot.id,
                    order: snapshot.order,
                    timestamp: snapshot.timestamp,
                    thumbnail: snapshot.thumbnail,
                    currentFrame: snapshot.currentFrame ?? null
                });
                pushedToMemory = true;
                this._renderGallery();
                this._updateStorageStatus();
            } catch (e) {
                if (pushedToMemory) this.snapshots.pop();
                console.error('[AlbumPopup] Save snapshot failed', e);
                alert('保存に失敗しました。');
            }
        }
    }

    async _saveAnimationReferenceSnapshot() {
        const projectManager = window.projectManager;
        if (!projectManager?.saveToFile) return;

        let saved = null;
        try {
            saved = await projectManager.saveToFile({
                preferNative: true,
                showToast: true,
                forcePicker: !projectManager.currentFileHandle,
                cancelledIfNoHandle: true
            });
        } catch (error) {
            console.error('[AlbumPopup] Animation external save failed:', error);
            alert('外部ファイル保存に失敗しました。');
            return;
        }

        if (!saved?.ok) {
            if (saved?.cancelled) return;
            alert('外部ファイル保存に失敗しました。');
            return;
        }
        if (!saved.native || !projectManager.currentFileHandle) {
            this._updateProjectSaveTargetStatus();
            return;
        }

        const thumbnail = await this._captureCurrentThumbnail();
        if (!thumbnail) {
            alert('参照カード用のサムネイルを作成できませんでした。');
            return;
        }

        const snapshot = {
            id: Date.now(),
            timestamp: Date.now(),
            order: this.snapshots.length,
            thumbnail,
            currentFrame: this.animationSystem?.getCurrentFrameIndex?.() ?? null,
            frameStates: [],
            projectData: null,
            projectReference: {
                type: saved.native ? 'file-system-access' : 'download',
                fileName: saved.fileName || projectManager.currentFileName || null,
                savedAt: Date.now(),
                fileHandle: projectManager.currentFileHandle || null
            }
        };

        try {
            const summary = await albumStorage.putSnapshot(snapshot);
            this.snapshots.push(summary || {
                id: snapshot.id,
                order: snapshot.order,
                timestamp: snapshot.timestamp,
                thumbnail: snapshot.thumbnail,
                currentFrame: snapshot.currentFrame ?? null,
                projectReference: {
                    type: snapshot.projectReference.type,
                    fileName: snapshot.projectReference.fileName,
                    savedAt: snapshot.projectReference.savedAt,
                    hasFileHandle: !!snapshot.projectReference.fileHandle
                }
            });
            this._renderGallery();
            this._updateStorageStatus();
            this._updateProjectSaveTargetStatus();
        } catch (error) {
            console.error('[AlbumPopup] Animation reference save failed:', error);
            alert('参照カードの保存に失敗しました。');
        }
    }

    async _saveActiveCafSnapshot() {
        const activeCafData = this._captureActiveCafData();
        if (!activeCafData) {
            alert('保存するアクティブCAFが選択されていません。');
            return;
        }

        const thumbnail = this._createActiveCafThumbnail(activeCafData);
        if (!thumbnail) {
            alert('アクティブCAFのサムネイルを作成できませんでした。');
            return;
        }

        const snapshot = {
            id: Date.now(),
            timestamp: Date.now(),
            order: this.snapshots.length,
            thumbnail,
            currentFrame: this.animationSystem?.getCurrentFrameIndex?.() ?? null,
            frameStates: [],
            projectData: null,
            snapshotType: 'active-caf',
            activeCafData
        };

        try {
            const summary = await albumStorage.putSnapshot(snapshot);
            this.snapshots.push(summary || {
                id: snapshot.id,
                order: snapshot.order,
                timestamp: snapshot.timestamp,
                thumbnail: snapshot.thumbnail,
                currentFrame: snapshot.currentFrame ?? null,
                snapshotType: snapshot.snapshotType
            });
            this._renderGallery();
            this._updateStorageStatus();
        } catch (error) {
            console.error('[AlbumPopup] Active CAF save failed:', error);
            alert('アクティブCAFの保存に失敗しました。');
        }
    }

    _captureActiveCafData() {
        const table = this._getAnimationTable();
        const model = table?.model;
        const asset = table?.selectedAssetId ? model?.getClipAsset?.(table.selectedAssetId) : null;
        if (!table || !model || !asset) return null;

        table._saveSelectedClipFromWorkingLayers?.({ force: true });

        const snapshotIds = new Set();
        if (asset.drawingSnapshotId) snapshotIds.add(asset.drawingSnapshotId);
        (asset.internalLayers || []).forEach(layer => {
            if (layer?.drawingSnapshotId) snapshotIds.add(layer.drawingSnapshotId);
        });

        const drawingSnapshots = [...snapshotIds]
            .map(snapshotId => model.getDrawingSnapshot?.(snapshotId))
            .filter(Boolean)
            .map(snapshot => this._serializeDrawingSnapshotForAlbum(snapshot));

        return {
            type: 'active-caf',
            version: 1,
            savedAt: Date.now(),
            canvas: {
                width: window.TEGAKI_CONFIG?.canvas?.width || 400,
                height: window.TEGAKI_CONFIG?.canvas?.height || 400
            },
            asset: asset.serialize ? asset.serialize() : { ...asset },
            drawingSnapshots
        };
    }

    _serializeDrawingSnapshotForAlbum(snapshot) {
        const serialized = snapshot?.serialize ? snapshot.serialize() : { ...snapshot };
        if (serialized?.pixels && typeof serialized.pixels.length === 'number' && !Array.isArray(serialized.pixels)) {
            serialized.pixels = Array.from(serialized.pixels);
        }
        return serialized;
    }

    _createActiveCafThumbnail(activeCafData) {
        const width = Math.max(1, Math.round(activeCafData?.canvas?.width || window.TEGAKI_CONFIG?.canvas?.width || 400));
        const height = Math.max(1, Math.round(activeCafData?.canvas?.height || window.TEGAKI_CONFIG?.canvas?.height || 400));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const rendered = this._drawActiveCafDataLayerGroup(ctx, activeCafData, null, width, height);
        if (!rendered) return null;
        return canvas.toDataURL('image/png');
    }

    _drawActiveCafDataLayerGroup(ctx, activeCafData, parentId, width, height) {
        const layers = activeCafData?.asset?.internalLayers || [];
        const snapshots = new Map((activeCafData?.drawingSnapshots || []).map(snapshot => [snapshot.id, snapshot]));
        const siblings = layers.filter(layer => (layer.parentLayerId || null) === (parentId || null));
        let rendered = false;

        for (let index = siblings.length - 1; index >= 0; index--) {
            const layer = siblings[index];
            if (!layer || layer.visible === false || layer.isBackground === true) continue;

            if (layer.type === 'folder') {
                const folderCanvas = document.createElement('canvas');
                folderCanvas.width = width;
                folderCanvas.height = height;
                const folderCtx = folderCanvas.getContext('2d');
                if (!folderCtx) continue;
                const hasFolderContent = this._drawActiveCafDataLayerGroup(folderCtx, activeCafData, layer.id, width, height);
                if (!hasFolderContent) continue;
                ctx.save();
                ctx.globalAlpha = this._normalizeOpacity(layer.opacity);
                ctx.globalCompositeOperation = this._canvasCompositeMode(layer.blendMode);
                ctx.drawImage(folderCanvas, 0, 0);
                ctx.restore();
                rendered = true;
                continue;
            }

            const snapshot = snapshots.get(layer.drawingSnapshotId);
            const snapshotCanvas = this._createSnapshotCanvas(snapshot);
            if (!snapshotCanvas) continue;
            const bounds = snapshot.rasterBounds || { x: 0, y: 0 };
            ctx.save();
            ctx.globalAlpha = this._normalizeOpacity(layer.opacity);
            ctx.globalCompositeOperation = this._canvasCompositeMode(layer.blendMode);
            ctx.drawImage(snapshotCanvas, Number(bounds.x) || 0, Number(bounds.y) || 0);
            ctx.restore();
            rendered = true;
        }

        return rendered;
    }

    _createSnapshotCanvas(snapshot) {
        if (!snapshot?.pixels || !snapshot.width || !snapshot.height) return null;
        const width = Math.max(1, Math.round(Number(snapshot.width) || 1));
        const height = Math.max(1, Math.round(Number(snapshot.height) || 1));
        const expectedPixelBytes = width * height * 4;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const pixels = snapshot.pixels instanceof Uint8ClampedArray
            ? snapshot.pixels
            : new Uint8ClampedArray(snapshot.pixels);
        if (pixels.length !== expectedPixelBytes) {
            console.warn('[AlbumPopup] snapshot canvas skipped: invalid pixel length', {
                snapshotId: snapshot.id,
                width,
                height,
                expectedPixelBytes,
                actualPixelBytes: pixels.length
            });
            return null;
        }
        try {
            ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
        } catch (error) {
            console.warn('[AlbumPopup] snapshot canvas skipped: ImageData creation failed', {
                snapshotId: snapshot.id,
                width,
                height,
                error
            });
            return null;
        }
        return canvas;
    }

    _normalizeOpacity(opacity) {
        return Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
    }

    _canvasCompositeMode(blendMode) {
        if (blendMode === 'add') return 'lighter';
        const supported = new Set([
            'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light',
            'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
        ]);
        return supported.has(blendMode) ? blendMode : 'source-over';
    }

    _getAnimationTable() {
        return window.PopupManager?.get?.('animationTable')
            || window.PopupManager?.popups?.get?.('animationTable')?.instance
            || window.coreEngine?.popupManager?.get?.('animationTable')
            || null;
    }

    _getActiveCafAsset() {
        const table = this._getAnimationTable();
        return table?.selectedAssetId && table.model?.getClipAsset
            ? table.model.getClipAsset(table.selectedAssetId)
            : null;
    }

    async _confirmLargeSnapshotAlbumSave(snapshot) {
        const profile = snapshot?.__albumProfile;
        const estimatedBytes = Number(profile?.projectJsonLength)
            ? Number(profile.projectJsonLength) * 2
            : this._estimateProjectPayloadBytes(snapshot?.projectData);
        if (estimatedBytes < 100 * 1024 * 1024) return true;
        const sizeText = this._formatBytes(estimatedBytes);
        return window.confirm(
            `この作品データは大きめです（概算 ${sizeText}）。\n`
            + 'アルバムへ保存するとブラウザ保存領域を圧迫する可能性があります。\n\n'
            + 'OK: アルバムへ保存\n'
            + 'キャンセル: ファイルとして保存'
        );
    }

    _estimateProjectPayloadBytes(projectData) {
        if (!projectData) return 0;
        let bytes = 0;
        (projectData.animation?.drawingSnapshots || []).forEach(snapshot => {
            bytes += (Number(snapshot?.pixels?.length) || 0) * 2;
        });
        (projectData.layers || []).forEach(layer => {
            if (typeof layer?.image === 'string') bytes += layer.image.length * 2;
        });
        return bytes;
    }

    async _loadProjectReference(reference) {
        if (!reference?.fileHandle) {
            alert('この参照カードには読み込み可能な保存先がありません。ファイルを直接読み込んでください。');
            return;
        }
        try {
            if (reference.fileHandle.queryPermission) {
                let permission = await reference.fileHandle.queryPermission({ mode: 'read' });
                if (permission !== 'granted' && reference.fileHandle.requestPermission) {
                    permission = await reference.fileHandle.requestPermission({ mode: 'read' });
                }
                if (permission !== 'granted') return;
            }

            const file = await reference.fileHandle.getFile();
            const text = await file.text();
            const projectData = JSON.parse(text);
            if (!projectData || projectData.app !== 'tegaki') {
                throw new Error('Invalid Tegaki project file');
            }
            await window.projectManager?.loadProject?.(projectData);
            this.hide();
        } catch (error) {
            console.error('[AlbumPopup] Project reference load failed:', error);
            alert('参照先Projectの読み込みに失敗しました。ファイルが移動・削除されたか、権限が失効している可能性があります。');
        }
    }

    async saveCurrentSnapshot() {
        await this._saveSnapshot();
    }

    async _captureSnapshot() {
        const profileEnabled = window.TEGAKI_CONFIG?.debug === true;
        const startedAt = performance?.now?.() || Date.now();
        const projectStartedAt = performance?.now?.() || Date.now();
        const projectData = await window.projectManager?.exportProject?.({ profile: profileEnabled });
        const projectMs = (performance?.now?.() || Date.now()) - projectStartedAt;
        const thumbnailStartedAt = performance?.now?.() || Date.now();
        const thumbnail = await this._captureCurrentThumbnail();
        const thumbnailMs = (performance?.now?.() || Date.now()) - thumbnailStartedAt;
        if (!thumbnail) {
            alert('現在の状態を保存できませんでした');
            return null;
        }
        const snapshot = {
            id: Date.now(),
            timestamp: Date.now(),
            thumbnail,
            currentFrame: this.animationSystem?.getCurrentFrameIndex?.() ?? null,
            frameStates: [],
            projectData: projectData || null
        };
        if (profileEnabled) {
            const stringifyStartedAt = performance?.now?.() || Date.now();
            const projectJsonLength = projectData ? JSON.stringify(projectData).length : 0;
            const stringifyMs = (performance?.now?.() || Date.now()) - stringifyStartedAt;
            const albumProfile = {
                projectMs,
                thumbnailMs,
                totalMs: (performance?.now?.() || Date.now()) - startedAt,
                projectJsonLength,
                projectStringifyMs: stringifyMs,
                thumbnailChars: typeof thumbnail === 'string' ? thumbnail.length : 0,
                projectExportProfile: projectData?.__exportProfile || null
            };
            Object.defineProperty(snapshot, '__albumProfile', {
                value: albumProfile,
                enumerable: false,
                configurable: true
            });
            console.info('[AlbumPopup] snapshot profile', albumProfile);
        }
        return snapshot;
    }

    async _loadSnapshot(snapshot, options = {}) {
        const mode = options.mode || 'auto';
        const normalizedSnapshot = this._normalizeImportedSnapshot(
            snapshot,
            snapshot?.id ?? Date.now()
        );
        if (normalizedSnapshot.projectData && window.projectManager?.loadProject && mode !== 'active-caf') {
            await window.projectManager.loadProject(normalizedSnapshot.projectData);
            this.hide();
            return;
        }

        if (normalizedSnapshot.activeCafData) {
            if (mode === 'project') {
                const loaded = await this._loadActiveCafDataAsNormalProject(normalizedSnapshot.activeCafData);
                if (loaded) this.hide();
            } else {
                const imported = this._importActiveCafDataToSelectedCaf(normalizedSnapshot.activeCafData);
                if (imported) this.hide();
            }
            return;
        }

        if (normalizedSnapshot.projectReference) {
            await this._loadProjectReference(normalizedSnapshot.projectReference);
            return;
        }

        if (!this.animationSystem) return;

        const frames = this.animationSystem.animationData.frames;
        
        while (frames.length < snapshot.frameStates.length) {
            if (this.animationSystem.createNewEmptyFrame) {
                this.animationSystem.createNewEmptyFrame();
            }
        }

        snapshot.frameStates.forEach((frameState, frameIndex) => {
            if (frameIndex >= frames.length) return;
            
            const frame = frames[frameIndex];
            if (!frame.container) return;

            while (frame.container.children.length > 0) {
                const child = frame.container.children[0];
                frame.container.removeChild(child);
                if (child.destroy) child.destroy({ children: true });
            }

            frameState.layerStates.forEach(layerState => {
                const layerContainer = new Container();
                layerContainer.label = layerState.name;
                
                const isVisible = layerState.visible !== false;
                layerContainer.visible = isVisible;
                layerContainer.alpha = layerState.opacity;
                
                layerContainer.layerData = {
                    id: layerState.id,
                    name: layerState.name,
                    visible: isVisible,
                    opacity: layerState.opacity,
                    isBackground: layerState.isBackground || false,
                    paths: []
                };

                if (layerState.isBackground) {
                    const bg = new Graphics();
                    const CONFIG = window.TEGAKI_CONFIG;
                    const bgColor = layerState.backgroundColor || CONFIG.background.color || 0xF0E0D6;
                    bg.rect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
                    bg.fill(bgColor);
                    layerContainer.addChild(bg);
                    layerContainer.layerData.backgroundGraphics = bg;
                } else {
                    layerState.paths.forEach(pathData => {
                        const graphics = new Graphics();
                        pathData.points.forEach(point => {
                            graphics.circle(point.x, point.y, pathData.size / 2);
                            graphics.fill({ color: pathData.color, alpha: pathData.opacity });
                        });
                        
                        const path = {
                            id: pathData.id,
                            graphics,
                            points: pathData.points,
                            color: pathData.color,
                            size: pathData.size,
                            opacity: pathData.opacity,
                            tool: pathData.tool,
                            isComplete: true
                        };
                        
                        layerContainer.layerData.paths.push(path);
                        layerContainer.addChild(graphics);
                    });
                }

                frame.container.addChild(layerContainer);
            });

            if (this.animationSystem.generateFrameThumbnail) {
                setTimeout(() => {
                    this.animationSystem.generateFrameThumbnail(frameIndex);
                }, 50 + frameIndex * 20);
            }
        });

        if (this.animationSystem.switchToActiveFrame) {
            this.animationSystem.switchToActiveFrame(snapshot.currentFrame);
        }

        this.hide();
    }

    async _captureCurrentThumbnail() {
        try {
            const result = await window.exportManager?.generatePreview?.('png', {
                resolution: 1,
                transparent: false
            });
            const blob = result?.blob || result;
            if (blob instanceof Blob) {
                return await this._blobToDataURL(blob);
            }
        } catch (error) {
            console.warn('[AlbumPopup] export preview capture failed, falling back to renderer extract:', error);
        }

        const target = this.layerSystem?.currentFrameContainer;
        if (!this.app?.renderer || !target) return null;

        const canvas = this.app.renderer.extract.canvas({
            target,
            clearColor: [1, 1, 1, 1]
        });
        return canvas?.toDataURL?.('image/png') || null;
    }

    _blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    _renderGallery() {
        const gallery = document.getElementById('albumGallery');
        if (!gallery) return;

        gallery.innerHTML = '';
        
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }

        this.snapshots.forEach((snapshot, index) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            if (snapshot.projectReference) card.classList.add('album-card--reference');
            if (snapshot.snapshotType === 'active-caf') card.classList.add('album-card--caf');
            if (this.selectionMode) card.classList.add('selection-mode');
            if (this.selectedSnapshotIds.has(snapshot.id)) {
                card.classList.add('selected');
            }
            card.dataset.id = snapshot.id;
            card.dataset.index = index;
            
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';

            const img = document.createElement('img');
            img.src = snapshot.thumbnail;
            
            thumbnailContainer.appendChild(img);
            if (snapshot.projectReference) {
                const badge = document.createElement('div');
                badge.className = 'album-reference-badge';
                badge.textContent = 'FILE';
                badge.title = snapshot.projectReference.fileName
                    ? `外部保存: ${snapshot.projectReference.fileName}`
                    : '外部保存参照';
                thumbnailContainer.appendChild(badge);
            }
            if (snapshot.snapshotType === 'active-caf') {
                const badge = document.createElement('div');
                badge.className = 'album-reference-badge album-caf-badge';
                badge.textContent = 'CAF';
                badge.title = 'アクティブCAF素材';
                thumbnailContainer.appendChild(badge);
            }

            // [指示書] カード内の個別ボタンを撤去（または非表示）
            // 今回は生成自体をスキップしてツールバーへ集約
            
            card.appendChild(thumbnailContainer);
            
            // カード全体のクリックイベント
            card.addEventListener('click', (e) => {
                e.stopPropagation();

                if (e.shiftKey) {
                    this._setSelectionMode(true);
                    this._selectSnapshotRange(snapshot.id);
                } else {
                    // 通常クリックでトグル選択（Ctrlキーなしでも複数選択可能に）
                    this._setSelectionMode(true);
                    this._toggleSnapshotSelection(snapshot.id);
                }
                
                this._updateToolbarState();
                this._renderGallery();
            });

            gallery.appendChild(card);
        });

        // SortableJS の初期化 (感触改善)
        this.sortable = new Sortable(gallery, {
            animation: 240,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // 弾力のある動き
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            fallbackClass: 'sortable-fallback',
            fallbackOnBody: true,
            forceFallback: true,
            fallbackTolerance: 4,
            swapThreshold: 0.75,
            invertSwap: true,
            touchStartThreshold: 5,
            onEnd: async () => {
                const newOrder = [];
                const orderedIds = [];
                const cards = gallery.querySelectorAll('.album-card');
                cards.forEach(card => {
                    const id = parseInt(card.dataset.id);
                    const snap = this.snapshots.find(s => s.id === id);
                    if (snap) {
                        newOrder.push(snap);
                        orderedIds.push(id);
                    }
                });
                this.snapshots = newOrder.map((snapshot, order) => ({ ...snapshot, order }));
                await albumStorage.updateSnapshotOrder(orderedIds);
            }
        });
    }

    _toggleSnapshotSelection(id) {
        if (this.selectedSnapshotIds.has(id)) {
            this.selectedSnapshotIds.delete(id);
        } else {
            this.selectedSnapshotIds.add(id);
            this.lastSelectedSnapshotId = id;
        }
    }

    _selectSnapshotRange(id) {
        if (!this.lastSelectedSnapshotId || !this.snapshots.some(s => s.id === this.lastSelectedSnapshotId)) {
            this.selectedSnapshotIds.add(id);
            this.lastSelectedSnapshotId = id;
            return;
        }

        const start = this.snapshots.findIndex(s => s.id === this.lastSelectedSnapshotId);
        const end = this.snapshots.findIndex(s => s.id === id);
        if (start === -1 || end === -1) {
            this.selectedSnapshotIds.add(id);
            this.lastSelectedSnapshotId = id;
            return;
        }

        const [from, to] = start < end ? [start, end] : [end, start];
        for (let i = from; i <= to; i++) {
            this.selectedSnapshotIds.add(this.snapshots[i].id);
        }
    }

    _createIconButton(svgContent, color, onClick) {
        const btn = document.createElement('button');
        btn.className = 'ui-icon-button ui-icon-button--small';
        btn.innerHTML = svgContent;
        btn.style.color = color;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };
        return btn;
    }

    _downloadAsPNG(snapshot) {
        const link = document.createElement('a');
        link.download = `snapshot_${snapshot.id}.png`;
        link.href = snapshot.thumbnail;
        link.click();
    }

    async _deleteSnapshot(id) {
        const deleteIds = this.selectedSnapshotIds.has(id) && this.selectedSnapshotIds.size > 1
            ? Array.from(this.selectedSnapshotIds)
            : [id];

        if (deleteIds.length > 1 && !window.confirm(`${deleteIds.length}件のアルバム項目を削除しますか？`)) {
            return;
        }

        const deleteSet = new Set(deleteIds);
        
        try {
            await albumStorage.deleteSnapshots(deleteIds);
            this.snapshots = this.snapshots.filter(s => !deleteSet.has(s.id));
            deleteIds.forEach(deleteId => this.selectedSnapshotIds.delete(deleteId));
            if (this.lastSelectedSnapshotId && deleteSet.has(this.lastSelectedSnapshotId)) {
                this.lastSelectedSnapshotId = null;
            }
            this._renderGallery();
            this._updateToolbarState();
            this._updateStorageStatus();
        } catch (e) {
            console.error('[AlbumPopup] Delete failed', e);
            alert('削除に失敗しました。');
        }
    }

    async _saveToStorage() {
        try {
            await albumStorage.updateSnapshotOrder(this.snapshots.map(snapshot => snapshot.id));
        } catch (e) {
            console.error('[AlbumPopup] Save to storage failed', e);
            throw e; // 上位で catch する
        }
    }

    async _loadActiveCafDataAsNormalProject(activeCafData) {
        if (!activeCafData?.asset || !window.projectManager?.loadProject) {
            alert('通常Projectとして開けるCAFデータがありません。');
            return false;
        }

        const width = Math.max(1, Math.round(activeCafData.canvas?.width || window.TEGAKI_CONFIG?.canvas?.width || 400));
        const height = Math.max(1, Math.round(activeCafData.canvas?.height || window.TEGAKI_CONFIG?.canvas?.height || 400));
        const snapshots = new Map((activeCafData.drawingSnapshots || []).map(snapshot => [snapshot.id, snapshot]));
        const sourceLayers = activeCafData.asset.internalLayers || [];
        const validIds = new Set();
        const projectLayers = [];

        sourceLayers.forEach(layer => {
            if (!layer || layer.isBackground) return;
            if (layer.type === 'folder') {
                validIds.add(layer.id);
                projectLayers.push({
                    id: layer.id,
                    name: layer.name || 'Folder',
                    visible: layer.visible !== false,
                    opacity: this._normalizeOpacity(layer.opacity),
                    blendMode: layer.blendMode || 'normal',
                    isFolder: true,
                    folderExpanded: layer.folderExpanded !== false,
                    children: [],
                    parentId: layer.parentLayerId || null
                });
                return;
            }

            const snapshot = snapshots.get(layer.drawingSnapshotId);
            const canvas = this._createSnapshotCanvas(snapshot);
            if (!canvas) return;
            validIds.add(layer.id);
            projectLayers.push({
                id: layer.id,
                name: layer.name || 'Layer',
                visible: layer.visible !== false,
                opacity: this._normalizeOpacity(layer.opacity),
                blendMode: layer.blendMode || 'normal',
                parentId: layer.parentLayerId || null,
                clipping: layer.clipping === true,
                clippingMode: layer.clipping === true ? 'normal' : 'none',
                rasterBounds: snapshot.rasterBounds || {
                    x: 0,
                    y: 0,
                    width: snapshot.width,
                    height: snapshot.height
                },
                image: canvas.toDataURL('image/png')
            });
        });

        projectLayers.forEach(layer => {
            if (!layer.isFolder) return;
            layer.children = sourceLayers
                .filter(candidate => candidate?.parentLayerId === layer.id && validIds.has(candidate.id))
                .map(candidate => candidate.id);
        });

        const projectData = {
            version: 2,
            app: 'tegaki',
            canvas: { width, height },
            background: {
                color: window.TEGAKI_CONFIG?.canvas?.backgroundColor || 0xf0e0d6,
                visible: true
            },
            layers: projectLayers,
            animation: null,
            animationState: null
        };

        await window.projectManager.loadProject(projectData);
        return true;
    }

    _importActiveCafDataToSelectedCaf(activeCafData) {
        const table = this._getAnimationTable();
        const model = table?.model;
        const selectedEntry = table?.selectedCelId ? model?.findClipEntry?.(table.selectedCelId) : null;
        const selectedAssetId = table?.selectedAssetId || null;
        const selectedAssetEntry = selectedAssetId
            ? table?._findClipEntryByAssetId?.(selectedAssetId)
            : null;
        const targetEntry = selectedEntry?.clip?.assetId
            ? selectedEntry
            : (selectedAssetEntry || null);
        const targetAssetId = targetEntry?.clip?.assetId || selectedAssetId || null;
        const targetAsset = targetAssetId ? model?.getClipAsset?.(targetAssetId) : null;
        if (!table || !model || !targetAsset) {
            alert('取り込み先のアクティブCAFを選択してください。');
            return false;
        }
        if (targetEntry?.clip && table.selectedCelId !== targetEntry.clip.id) {
            table._activateClipEntry?.(targetEntry, { saveCurrent: true });
        }
        if (targetEntry?.lane?.id) {
            table.activeLaneId = targetEntry.lane.id;
        }
        if (targetEntry?.clip?.id) {
            table.selectedCelId = targetEntry.clip.id;
        }
        table.selectedAssetId = targetAsset.id;
        table.selectedAssetFolderId = targetAsset.folderId || null;

        const sourceAsset = activeCafData?.asset;
        const sourceLayers = sourceAsset?.internalLayers || [];
        const sourceSnapshots = activeCafData?.drawingSnapshots || [];
        if (!sourceAsset || sourceLayers.length === 0) {
            alert('このAlbum項目には取り込めるCAFデータがありません。');
            return false;
        }

        table._saveSelectedClipFromWorkingLayers?.();
        const beforeState = table._captureActiveCafAssetHistoryState?.(targetAsset)
            || table._captureTimelineHistoryState?.();
        table._resetCafPreviewRuntime?.('album-active-caf-import-before-apply');
        const snapshotIdMap = new Map();

        sourceSnapshots.forEach(snapshotData => {
            const snapshot = new DrawingSnapshotModel({
                ...snapshotData,
                id: undefined,
                pixels: snapshotData?.pixels instanceof Uint8ClampedArray
                    ? new Uint8ClampedArray(snapshotData.pixels)
                    : new Uint8ClampedArray(snapshotData?.pixels || [])
            });
            snapshotIdMap.set(snapshotData.id, snapshot.id);
            model.drawingSnapshots.push(snapshot);
        });

        const layerIdMap = new Map();
        const nextLayers = sourceLayers.map(layerData => {
            const nextLayer = new ClipAssetInternalLayerModel({
                ...layerData,
                id: undefined,
                drawingSnapshotId: snapshotIdMap.get(layerData.drawingSnapshotId) || null,
                parentLayerId: null
            });
            layerIdMap.set(layerData.id, nextLayer.id);
            return nextLayer;
        });

        nextLayers.forEach((nextLayer, index) => {
            const sourceLayer = sourceLayers[index];
            nextLayer.parentLayerId = sourceLayer?.parentLayerId
                ? (layerIdMap.get(sourceLayer.parentLayerId) || null)
                : null;
        });

        targetAsset.name = sourceAsset.name || targetAsset.name;
        targetAsset.type = sourceAsset.type || targetAsset.type;
        targetAsset.drawingSnapshotId = snapshotIdMap.get(sourceAsset.drawingSnapshotId)
            || nextLayers.find(layer => layer.type !== 'folder')?.drawingSnapshotId
            || null;
        targetAsset.internalLayers = nextLayers;
        targetAsset.updatedAt = Date.now();

        table.selectedInternalLayerId = nextLayers.find(layer => layer.type !== 'folder')?.id || nextLayers[0]?.id || null;
        table.selectedAssetId = targetAsset.id;
        table.selectedAssetFolderId = targetAsset.folderId || null;
        if (table._resetCafPreviewRuntime) {
            table._resetCafPreviewRuntime('album-active-caf-import-after-apply');
        } else {
            table._invalidateSnapshotTextureCache?.({ immediate: true });
        }
        const syncOk = targetEntry?.clip
            ? table._syncClipAssetToWorkingLayers?.(targetEntry.clip, { forceRestore: true }) !== false
            : table._syncSelectedClipToWorkingLayers?.({ forceRestore: true }) !== false;
        if (!syncOk) {
            if (beforeState?.asset && table._restoreActiveCafAssetHistoryState) {
                table._restoreActiveCafAssetHistoryState(targetAsset.id, beforeState);
            }
            alert('AlbumからのアクティブCAF取り込み後にキャンバス表示へ同期できませんでした。');
            return false;
        }
        table.render?.();
        table._flushLayerPanelSync?.();

        const afterState = table._captureActiveCafAssetHistoryState?.(targetAsset)
            || table._captureTimelineHistoryState?.();
        if (table._recordActiveCafAssetHistoryFromStates && beforeState?.asset && afterState?.asset) {
            table._recordActiveCafAssetHistoryFromStates(targetAsset, beforeState, afterState, 'caf-import-album-active-caf', {
                type: 'caf-import-album-active-caf',
                source: 'album',
                assetId: targetAsset.id
            });
        } else {
            table._recordTimelineHistory?.(beforeState, afterState, 'caf-import-album-active-caf', {
                type: 'caf-import-album-active-caf',
                source: 'album',
                assetId: targetAsset.id
            });
        }

        return true;
    }

    async show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;

        // ストレージの準備を待つ
        if (this._storageReady) {
            await this._storageReady;
        }
        
        this.popup.style.display = 'flex';
        this.popup.classList.add('show');
        this.isVisible = true;
        this._updateToolbarState();
        this._renderGallery();
        this._updateStorageStatus();
        this._updateProjectSaveTargetStatus();
    }

    hide() {
        if (!this.popup) return;
        
        this._setSelectionMode(false);
        this.selectedSnapshotIds.clear();
        this.lastSelectedSnapshotId = null;
        this._renderGallery();
        this.popup.classList.remove('show');
        this.popup.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isReady() {
        return !!this.popup;
    }
}

// 下位互換性のためにグローバルに登録
window.AlbumPopup = AlbumPopup;
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.AlbumPopup = AlbumPopup;
