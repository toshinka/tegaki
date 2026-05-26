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
            this.snapshots = await albumStorage.getAllSnapshots();
        } catch (e) {
            console.error('[AlbumPopup] Storage init failed', e);
        }
    }

    _ensurePopupElement() {
        this.popup = document.getElementById('album-popup');
        
        if (!this.popup) {
            this._createPopupElement();
        } else {
            this.popup.classList.remove('show');
            this.popup.style.display = 'none';
        }
    }

    _createPopupElement() {
        const container = document.querySelector('.canvas-area') || document.body;
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
                    <button id="albumRestore" class="ui-icon-button ui-icon-button--large" title="選択中をロード" style="display:none;">
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
            
            <div id="albumGallery" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 0; display: grid; grid-template-columns: repeat(auto-fill, 130px); gap: 12px; align-content: start; justify-content: start;"></div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        
        // イベントバインド
        const closeBtn = document.getElementById('album-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.hide();

        const saveBtn = document.getElementById('albumSave');
        if (saveBtn) saveBtn.onclick = () => this._saveSnapshot();

        const selectModeBtn = document.getElementById('albumSelectMode');
        if (selectModeBtn) selectModeBtn.onclick = () => this._toggleSelectionMode();

        const batchDeleteBtn = document.getElementById('albumBatchDelete');
        if (batchDeleteBtn) batchDeleteBtn.onclick = () => this._batchDelete();

        const restoreBtn = document.getElementById('albumRestore');
        if (restoreBtn) restoreBtn.onclick = () => this._loadSelectedSnapshot();

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
    }

    _loadSelectedSnapshot() {
        if (this.selectedSnapshotIds.size !== 1) return;
        const id = Array.from(this.selectedSnapshotIds)[0];
        const snapshot = this.snapshots.find(s => s.id === id);
        if (snapshot) {
            this._loadSnapshot(snapshot);
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
        const restoreBtn = document.getElementById('albumRestore');
        const clearBtn = document.getElementById('albumSelectMode');
        const hospitalBtn = document.getElementById('albumHospital');
        const count = this.selectedSnapshotIds.size;

        if (badge) {
            badge.textContent = count;
            badge.style.display = (count > 0) ? 'inline-block' : 'none';
        }

        if (delBtn) {
            delBtn.style.display = (count > 0) ? 'flex' : 'none';
        }

        if (restoreBtn) {
            // 1つだけ選択されている時のみロード可能
            restoreBtn.style.display = (count === 1) ? 'flex' : 'none';
        }

        if (clearBtn) {
            // 選択されている時のみ解除ボタンを表示
            clearBtn.style.display = (count > 0) ? 'flex' : 'none';
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
            } catch (e) {
                console.error('[AlbumPopup] Batch delete failed', e);
                alert('削除に失敗しました。');
            }
        }
    }

    async _exportAlbum() {
        // 選択中があれば選択中のみ、なければ全件
        const exportTargets = this.selectedSnapshotIds.size > 0
            ? this.snapshots.filter(s => this.selectedSnapshotIds.has(s.id))
            : this.snapshots;

        if (exportTargets.length === 0) {
            alert('書き出す項目がありません');
            return;
        }

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
header{position:sticky;top:0;background:#f0e0d6;border-bottom:1px solid #cf9c97;padding:14px 18px;font-weight:700;color:#8b0000;}
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
                const newSnapshots = data.snapshots.map((s, idx) => ({
                    ...s,
                    id: now + idx + Math.floor(Math.random() * 1000)
                }));

                const previousSnapshots = [...this.snapshots];
                try {
                    this.snapshots.push(...newSnapshots);
                    await this._saveToStorage();
                    this._renderGallery();
                }
                catch (err) {
                    this.snapshots = previousSnapshots;
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
        const snapshot = await this._captureSnapshot();
        if (snapshot?.thumbnail) {
            try {
                this.snapshots.push(snapshot);
                await this._saveToStorage();
                this._renderGallery();
            } catch (e) {
                this.snapshots.pop();
                console.error('[AlbumPopup] Save snapshot failed', e);
                alert('保存に失敗しました。');
            }
        }
    }

    async saveCurrentSnapshot() {
        await this._saveSnapshot();
    }

    async _captureSnapshot() {
        const projectData = await window.projectManager?.exportProject?.();
        const thumbnail = await this._captureCurrentThumbnail();
        if (!thumbnail) {
            alert('現在の状態を保存できませんでした');
            return null;
        }
        return {
            id: Date.now(),
            timestamp: Date.now(),
            thumbnail,
            currentFrame: this.animationSystem?.getCurrentFrameIndex?.() ?? null,
            frameStates: [],
            projectData: projectData || null
        };
    }

    async _loadSnapshot(snapshot) {
        if (snapshot?.projectData && window.projectManager?.loadProject) {
            await window.projectManager.loadProject(snapshot.projectData);
            this.hide();
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
            onEnd: () => {
                const newOrder = [];
                const cards = gallery.querySelectorAll('.album-card');
                cards.forEach(card => {
                    const id = parseInt(card.dataset.id);
                    const snap = this.snapshots.find(s => s.id === id);
                    if (snap) newOrder.push(snap);
                });
                this.snapshots = newOrder;
                this._saveToStorage();
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
        } catch (e) {
            console.error('[AlbumPopup] Delete failed', e);
            alert('削除に失敗しました。');
        }
    }

    async _saveToStorage() {
        try {
            await albumStorage.putAllSnapshots(this.snapshots);
        } catch (e) {
            console.error('[AlbumPopup] Save to storage failed', e);
            throw e; // 上位で catch する
        }
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
