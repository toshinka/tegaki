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
        
        this._loadSnapshots();
        this._ensurePopupElement();
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
        popupDiv.className = 'popup-panel';
        popupDiv.style.top = '60px';
        popupDiv.style.left = '60px';
        popupDiv.style.width = '80%';
        popupDiv.style.maxWidth = '900px';
        popupDiv.style.height = '80vh';
        popupDiv.style.maxHeight = '700px';
        popupDiv.style.flexDirection = 'column';
        popupDiv.style.display = 'none';
        
        popupDiv.innerHTML = `
            <div class="popup-title" style="font-size: 16px; font-weight: 600; color: var(--futaba-maroon); margin-bottom: 16px; text-align: center; flex-shrink: 0;">
                アルバム
            </div>
            
            <!-- アルバムツールバー -->
            <div class="album-toolbar">
                <div class="album-toolbar-group">
                    <button id="albumSave" class="action-button" title="現在の状態をアルバムに追加">現在の状態を保存</button>
                </div>

                <div class="album-toolbar-group">
                    <button id="albumSelectMode" class="ui-icon-button ui-icon-button--medium" title="選択モード切替">
                        ${UI_ICONS.checkSquare}
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
            </div>
            
            <div id="albumGallery" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 0; display: grid; grid-template-columns: repeat(auto-fill, 130px); gap: 12px; align-content: start; justify-content: start;"></div>
        `;
        
        container.appendChild(popupDiv);
        this.popup = popupDiv;
        
        // イベントバインド
        const saveBtn = document.getElementById('albumSave');
        if (saveBtn) saveBtn.onclick = () => this._saveSnapshot();

        const selectModeBtn = document.getElementById('albumSelectMode');
        if (selectModeBtn) selectModeBtn.onclick = () => this._toggleSelectionMode();

        const batchDeleteBtn = document.getElementById('albumBatchDelete');
        if (batchDeleteBtn) batchDeleteBtn.onclick = () => this._batchDelete();

        const exportBtn = document.getElementById('albumExport');
        if (exportBtn) exportBtn.onclick = () => this._exportAlbum();

        const importBtn = document.getElementById('albumImport');
        const importFile = document.getElementById('albumImportFile');
        if (importBtn && importFile) {
            importBtn.onclick = () => importFile.click();
            importFile.onchange = (e) => this._handleAlbumImport(e);
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
        const count = this.selectedSnapshotIds.size;

        if (badge) {
            badge.textContent = count;
            badge.style.display = (this.selectionMode && count > 0) ? 'inline-block' : 'none';
        }

        if (delBtn) {
            delBtn.style.display = (this.selectionMode && count > 0) ? 'flex' : 'none';
        }
    }

    _batchDelete() {
        if (this.selectedSnapshotIds.size === 0) return;

        if (confirm(`${this.selectedSnapshotIds.size}件のアルバム項目を削除しますか？`)) {
            const deleteSet = new Set(this.selectedSnapshotIds);
            this.snapshots = this.snapshots.filter(s => !deleteSet.has(s.id));
            this.selectedSnapshotIds.clear();
            this.lastSelectedSnapshotId = null;
            this._saveToStorage();
            this._updateToolbarState();
            this._renderGallery();
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
        reader.onload = (event) => {
            try {
                const data = this._parseAlbumImportText(event.target.result);
                if (data.app !== 'tegaki-album' || !Array.isArray(data.snapshots)) {
                    throw new Error('Invalid album format');
                }

                if (confirm(`${data.snapshots.length}件の項目を現在のアルバムに追加しますか？`)) {
                    // IDの衝突を避けるために再採番
                    const now = Date.now();
                    const newSnapshots = data.snapshots.map((s, idx) => ({
                        ...s,
                        id: now + idx + Math.floor(Math.random() * 1000)
                    }));

                    this.snapshots.push(...newSnapshots);
                    this._saveToStorage();
                    this._renderGallery();
                }
            } catch (err) {
                console.error('[AlbumPopup] Import failed:', err);
                alert('アルバムの読み込みに失敗しました。');
            }
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
            this.snapshots.push(snapshot);
            this._saveToStorage();
            this._renderGallery();
        }
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
            clearColor: '#00000000'
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
                if (e.shiftKey) {
                    e.stopPropagation();
                    this._setSelectionMode(true);
                    this._selectSnapshotRange(snapshot.id);
                    this._updateToolbarState();
                    this._renderGallery();
                    return;
                }

                if (this.selectionMode || e.ctrlKey || e.metaKey) {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                        this._setSelectionMode(true);
                    }
                    this._toggleSnapshotSelection(snapshot.id);
                    this._updateToolbarState();
                    this._renderGallery();
                    return;
                }
                
                // 通常クリックは復元
                this._loadSnapshot(snapshot);
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

    _deleteSnapshot(id) {
        const deleteIds = this.selectedSnapshotIds.has(id) && this.selectedSnapshotIds.size > 1
            ? Array.from(this.selectedSnapshotIds)
            : [id];

        if (deleteIds.length > 1 && !window.confirm(`${deleteIds.length}件のアルバム項目を削除しますか？`)) {
            return;
        }

        const deleteSet = new Set(deleteIds);
        this.snapshots = this.snapshots.filter(s => !deleteSet.has(s.id));
        deleteIds.forEach(deleteId => this.selectedSnapshotIds.delete(deleteId));
        if (this.lastSelectedSnapshotId && deleteSet.has(this.lastSelectedSnapshotId)) {
            this.lastSelectedSnapshotId = null;
        }
        this._saveToStorage();
        this._renderGallery();
    }

    _saveToStorage() {
        const data = this.snapshots.map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            thumbnail: s.thumbnail,
            currentFrame: s.currentFrame,
            frameStates: s.frameStates,
            projectData: s.projectData || null
        }));
        localStorage.setItem('tegaki_album', JSON.stringify(data));
    }

    _loadSnapshots() {
        const stored = localStorage.getItem('tegaki_album');
        if (stored) {
            try {
                this.snapshots = JSON.parse(stored);
                this.selectedSnapshotIds.clear();
                this.lastSelectedSnapshotId = null;
            } catch (e) {
                this.snapshots = [];
            }
        }
    }

    show() {
        if (!this.popup) {
            this._ensurePopupElement();
        }
        
        if (!this.popup) return;
        
        this.popup.style.display = 'flex';
        this.popup.classList.add('show');
        this.isVisible = true;
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
        return !!this.popup && !!this.animationSystem;
    }
}

// 下位互換性のためにグローバルに登録
window.AlbumPopup = AlbumPopup;
window.TegakiUI = window.TegakiUI || {};
window.TegakiUI.AlbumPopup = AlbumPopup;
