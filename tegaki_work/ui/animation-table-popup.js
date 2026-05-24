/**
 * ============================================================================
 * ファイル名: ui/animation-table-popup.js
 * 責務: 動画ツール風アニメーションテーブル（ToonSquid風）のUIを提供する
 * 依存: system/event-bus.js, system/animation/animation-data-model.js
 * 被依存: core-engine.js, system/popup-manager.js
 * ============================================================================
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { TimelineModel, ClipAssetModel, DrawingSnapshotModel } from '../system/animation/animation-data-model.js';

export class AnimationTablePopup {
    constructor(dependencies = {}) {
        this.eventBus = TegakiEventBus;
        this.layerSystem = dependencies.layerSystem;
        this.animationSystem = dependencies.animationSystem;
        
        this.panel = null;
        this.isVisible = false;
        this.initialized = false;
        this._updateTimeout = null;
        
        this.model = new TimelineModel();
        this.selectedCelId = null;
        
        // 再生関連
        this.isPlaying = false;
        this._playTimer = null;

        // プレビュー関連
        this.isPreviewActive = true;
        this._visibilityPreviewApplied = false;
        this._backupSnapshots = new Map(); // layerId -> snapshot (元の状態バックアップ)
        this.animationPreviewContainer = null;
        this._snapshotTextureCache = new WeakMap();
        
        // オニオンスキン関連
        this.isOnionSkinActive = false;
        this.onionSkinPrevAlpha = 0.30;
        this.onionSkinNextAlpha = 0.20;
        this.onionSkinPrevTint = 0x4f8cff; // 前フレーム：青系
        this.onionSkinNextTint = 0xff8c42; // 次フレーム：赤系

        // ドラッグ移動関連
        this._isDragging = false;
        this._dragOffset = { x: 0, y: 0 };
        this._panelPos = { x: 70, y: null }; // y は初期表示時に下部固定から計算

        // リタイミング（セル伸縮）関連
        this._isRetiming = false;
        this._retimingData = null;

        // コピー/ペースト関連
        this._copiedCelRef = null;

        // クリップ移動関連
        this._clipMoveData = null;
        this._clipMoveMoved = false;
        this._isClipMoving = false;

        // 自動キャプチャ関連
        this.isAutoCaptureActive = false;

        // クリップ編集モード関連
        this.isClipEditModeActive = false;
        this._previewBeforeClipEdit = null;
        
        this._ensurePanelElement();
    }

    initialize() {
        if (this.initialized) return;
        
        this._injectStyles();
        this._setupEventListeners();
        
        this.initialized = true;
    }

    show() {
        if (!this.initialized) this.initialize();
        if (this.isVisible) return;
        
        this.panel.style.display = 'flex';
        this.isVisible = true;
        
        // 初回表示時に位置が未設定（null）なら下部デフォルト位置へ
        if (this._panelPos.y === null) {
            const rect = this.panel.getBoundingClientRect();
            this._panelPos.y = window.innerHeight - rect.height - 20;
            this._updatePanelPosition();
        }

        this.render();
    }

    hide() {
        if (!this.panel) return;
        this.stop();
        if (this.isClipEditModeActive) {
            this.exitClipEditMode();
        }
        this._restoreVisibility();
        this.panel.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    play() {
        if (this.isPlaying) return;
        if (this.isClipEditModeActive) {
            this.exitClipEditMode();
        }
        this.selectedCelId = null;
        this.isPlaying = true;
        this._updatePlayButtonUI();

        const interval = 1000 / this.model.fps;
        this._playTimer = setInterval(() => {
            if (!this.model.advanceFrame()) {
                this.stop();
            } else {
                this.render();
            }
        }, interval);
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this._playTimer) {
            clearInterval(this._playTimer);
            this._playTimer = null;
        }
        this._updatePlayButtonUI();
        this.render();
    }

    togglePlayback() {
        if (this.isPlaying) this.stop();
        else this.play();
    }

    _updatePlayButtonUI() {
        if (!this.panel) return;
        const playBtn = this.panel.querySelector('#anim-play-toggle-btn');
        if (playBtn) {
            if (this.isPlaying) {
                playBtn.textContent = '■';
                playBtn.classList.add('playing');
                playBtn.title = 'Stop';
            } else {
                playBtn.textContent = '▶';
                playBtn.classList.remove('playing');
                playBtn.title = 'Play';
            }
        }
    }

    requestUpdate() {
        if (!this.isVisible) return;
        if (this._updateTimeout) return;
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = null;
            this.render();
        }, 32);
    }

    enterClipEditMode() {
        if (!this.selectedCelId) {
            this.isClipEditModeActive = false;
            this.render();
            return;
        }

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry || entry.lane.type === 'folder') {
            this.isClipEditModeActive = false;
            this.render();
            return;
        }

        if (this.isPlaying) this.stop();

        this._previewBeforeClipEdit = this.isPreviewActive;
        this.isClipEditModeActive = true;
        
        // 合成プレビューを一時停止して実レイヤー表示を戻す
        this._restoreVisibility();
        this.render();
    }

    exitClipEditMode(options = {}) {
        this.isClipEditModeActive = false;
        
        if (this._previewBeforeClipEdit !== null) {
            this.isPreviewActive = this._previewBeforeClipEdit;
            this._previewBeforeClipEdit = null;
        }

        this.render();
    }

    _applyVisibilityPreview() {
        if (!this.isVisible || !this.isPreviewActive || !this.layerSystem) return;
        
        this._ensurePreviewContainer();
        if (this.animationPreviewContainer) {
            this.animationPreviewContainer.removeChildren();
        }

        const layers = this.layerSystem.getLayers() || [];
        const currentFrame = this.model.playback.currentFrame;

        // 1. まず、タイムラインで管理されている全実レイヤーを一時的に非表示にする
        layers.forEach(layer => {
            const layerData = layer.layerData;
            if (!layerData || layerData.isBackground || layerData.isFolder) return;

            const isTracked = this.model.tracks.some(t => (t.sourceLayerId || t.layerId) === layerData.id);
            if (isTracked) {
                layer.visible = false;
            }
        });

        // 2. オニオンスキンの描画 (再生中・OFF時はスキップ)
        if (this.isOnionSkinActive && !this.isPlaying) {
            this._renderOnionSkins(currentFrame, layers);
        }

        // 3. メインプレビュー（現在フレーム）の描画
        if (this.selectedCelId && !this.isPlaying) {
            const selectedEntry = this._findSelectedCelEntry();
            if (selectedEntry) {
                this._renderCelPreview(selectedEntry.lane, selectedEntry.clip, layers, {
                    allowSourceLayerFallback: true
                });
            }
        } else {
            // 現在フレームの全セル合成
            this._renderFrameComposite(currentFrame, layers);
        }

        this._visibilityPreviewApplied = true;
    }

    _renderFrameComposite(frameIndex, layers, options = {}) {
        const tracks = this.model.tracks;
        // データの tracks[0] は UI の一番上（＝レイヤーの前面）なので、逆順で addChild する
        for (let i = tracks.length - 1; i >= 0; i--) {
            const track = tracks[i];
            const cel = track.getCelAtFrame(frameIndex);
            if (cel) {
                this._renderCelPreview(track, cel, layers, {
                    ...options,
                    allowSourceLayerFallback: false
                });
            }
        }
    }

    _renderOnionSkins(currentFrame, layers) {
        // 前フレーム
        if (currentFrame > 0) {
            this._renderOnionFrame(currentFrame - 1, layers, {
                alpha: this.onionSkinPrevAlpha,
                tint: this.onionSkinPrevTint
            });
        }

        // 次フレーム
        if (currentFrame < this.model.totalFrames - 1) {
            this._renderOnionFrame(currentFrame + 1, layers, {
                alpha: this.onionSkinNextAlpha,
                tint: this.onionSkinNextTint
            });
        }
    }

    _renderOnionFrame(frameIndex, layers, options) {
        // セル選択中は同じ track の前後だけ、非選択時は全トラック合成
        if (this.selectedCelId) {
            const selectedEntry = this._findSelectedCelEntry();
            if (selectedEntry) {
                const cel = selectedEntry.lane.getCelAtFrame(frameIndex);
                if (cel) {
                    this._renderCelPreview(selectedEntry.lane, cel, layers, options);
                }
            }
        } else {
            this._renderFrameComposite(frameIndex, layers, options);
        }
    }

    _findSelectedCelEntry() {
        return this.model.findClipEntry(this.selectedCelId);
    }

    _renderCelPreview(track, cel, layers, options = {}) {
        if (!track || !cel) return;

        // sourceLayerId 優先
        const sourceLayer = layers.find(l => l.layerData?.id === (track.sourceLayerId || track.layerId));
        const snapshot = this.model.getSnapshotForCel(cel);

        if (snapshot && this.animationPreviewContainer) {
            const texture = this._getTextureFromSnapshot(snapshot);
            if (texture) {
                const sprite = new Sprite(texture);
                
                // 本来のレイヤー設定（透明度・合成モード）を継承
                if (sourceLayer?.layerData) {
                    sprite.blendMode = sourceLayer.layerData.blendMode || 'normal';
                    const baseAlpha = sourceLayer.layerData.opacity ?? 1.0;
                    sprite.alpha = baseAlpha * (options.alpha ?? 1.0);
                } else {
                    sprite.alpha = options.alpha ?? 1.0;
                }

                // ティント（オニオン用）
                if (options.tint !== undefined) {
                    sprite.tint = options.tint;
                }

                this.animationPreviewContainer.addChild(sprite);
            }
            return;
        }

        // Snapshot未取得の選択セルは、編集対象が見えるようにソース実レイヤーだけを暫定表示する。
        if (options.allowSourceLayerFallback && sourceLayer?.layerData) {
            sourceLayer.visible = sourceLayer.layerData.visible !== false;
        }
    }

    _restoreVisibility() {
        if (this.animationPreviewContainer) {
            this.animationPreviewContainer.removeChildren();
        }

        if (!this._visibilityPreviewApplied || !this.layerSystem) return;
        
        const layers = this.layerSystem.getLayers() || [];

        // Snapshotバックアップの復元
        this._backupSnapshots.clear();

        // Visibility の復元
        layers.forEach(layer => {
            if (layer.layerData) {
                layer.visible = layer.layerData.visible;
            }
        });

        this._visibilityPreviewApplied = false;
        // レイヤーパネルの状態と合わせるため、必要ならパネル更新を発火
        this.eventBus.emit('layer:panel-update-requested');
    }

    _ensurePreviewContainer() {
        if (this.animationPreviewContainer) return;
        
        const canvasContainer = this.layerSystem?.cameraSystem?.canvasContainer;
        if (!canvasContainer) return;

        this.animationPreviewContainer = new Container();
        this.animationPreviewContainer.label = 'animation_preview_container';
        
        // currentFrameContainer より上に配置
        canvasContainer.addChild(this.animationPreviewContainer);
    }

    _getTextureFromSnapshot(snapshot) {
        if (!snapshot || !snapshot.pixels) return null;
        
        const cachedTexture = this._snapshotTextureCache.get(snapshot);
        if (cachedTexture && !cachedTexture.destroyed) {
            return cachedTexture;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = snapshot.width;
            canvas.height = snapshot.height;
            const ctx = canvas.getContext('2d');
            const imageData = new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshot.width, snapshot.height);
            ctx.putImageData(imageData, 0, 0);

            const texture = Texture.from(canvas);
            this._snapshotTextureCache.set(snapshot, texture);
            return texture;
        } catch (e) {
            console.error('[AnimationTable] Failed to create texture from snapshot', e);
            return null;
        }
    }

    captureSelectedCel() {
        this._captureSelectedClip();
    }

    _captureSelectedClip(options = {}) {
        const { silent = false, requireSourceLayerId = null } = options;
        if (!this.selectedCelId || !this.layerSystem) return;

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry) return;

        const { lane, clip } = entry;
        const sourceLayerId = lane.sourceLayerId || lane.layerId;

        // ID指定がある場合は一致チェック
        if (requireSourceLayerId && sourceLayerId !== requireSourceLayerId) return;

        const layers = this.layerSystem.getLayers();
        const layer = layers.find(l => l.layerData?.id === sourceLayerId);
        
        if (layer) {
            // 1. レイヤーから Snapshot 生成
            const rawSnapshot = this.layerSystem.createLayerRasterSnapshot(layer);
            if (!rawSnapshot) return;

            // 2. 既存の ClipAsset / DrawingSnapshotModel の更新または新規作成
            if (clip.assetId) {
                const asset = this.model.getClipAsset(clip.assetId);
                if (asset && asset.drawingSnapshotId) {
                    const snapshot = this.model.getDrawingSnapshot(asset.drawingSnapshotId);
                    if (snapshot) {
                        // 既存のテクスチャキャッシュを破棄
                        const oldTexture = this._snapshotTextureCache.get(snapshot);
                        if (oldTexture && !oldTexture.destroyed) {
                            try { oldTexture.destroy(true); } catch (e) {}
                            this._snapshotTextureCache.delete(snapshot);
                        }

                        // データの更新
                        snapshot.width = rawSnapshot.width;
                        snapshot.height = rawSnapshot.height;
                        snapshot.pixels = rawSnapshot.pixels;
                        snapshot.updatedAt = Date.now();
                        asset.updatedAt = Date.now();

                        // 互換フィールドも更新
                        clip.rasterSnapshot = rawSnapshot;

                        this.render();
                        return;
                    }
                }
            }

            // 新規作成フロー
            const drawingSnapshot = new DrawingSnapshotModel({
                width: rawSnapshot.width,
                height: rawSnapshot.height,
                pixels: rawSnapshot.pixels
            });
            this.model.drawingSnapshots.push(drawingSnapshot);

            const clipAsset = new ClipAssetModel({
                name: `Asset for ${lane.name}`,
                drawingSnapshotId: drawingSnapshot.id
            });
            this.model.clipAssets.push(clipAsset);

            clip.assetId = clipAsset.id;
            clip.rasterSnapshot = rawSnapshot;

            this.render();
        }
    }

    _handleDrawingCompleted(data = {}) {
        if (!this.isVisible || !this.isAutoCaptureActive || !this.selectedCelId) return;

        const layerId = data.layerId || data.data?.layerId;
        if (!layerId) return;

        this._captureSelectedClip({
            silent: true,
            requireSourceLayerId: layerId
        });
    }

    makeSelectedClipUnique() {
        if (!this.selectedCelId) return;

        const result = this.model.makeClipAssetUnique(this.selectedCelId);
        if (result.ok) {
            this.render();
        } else {
            console.warn('[AnimationTable] Make Unique failed:', result.reason);
        }
    }

    copySelectedCel() {
        if (!this.selectedCelId) return;

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (entry) {
            const clip = entry.clip;
            this._copiedCelRef = {
                assetId: clip.assetId,
                rasterSnapshot: clip.rasterSnapshot, // 互換用
                duration: clip.duration
            };
        }
    }

    pasteCopiedCel() {
        if (!this._copiedCelRef || !this.layerSystem) return;

        const currentFrame = this.model.playback.currentFrame;
        const activeIndex = this.layerSystem.getActiveLayerIndex();
        const layers = this.layerSystem.getLayers();
        const activeLayer = layers[activeIndex];
        if (!activeLayer?.layerData) return;

        // アクティブレイヤーに対応するレーンを探す
        const lane = this.model.getLaneForSourceLayer(activeLayer.layerData.id);
        if (!lane || lane.type === 'folder') return;

        // 重なりチェック
        if (!lane.canPlaceCel(currentFrame, this._copiedCelRef.duration)) {
            console.warn('[AnimationTable] Cannot paste: Space occupied');
            return;
        }

        // 新規セル作成 (ClipInstanceModel)
        const newClip = lane.addCel({
            sourceLayerId: lane.sourceLayerId,
            layerId: lane.layerId,
            assetId: this._copiedCelRef.assetId,
            rasterSnapshot: this._copiedCelRef.rasterSnapshot, // 互換用
            startFrame: currentFrame,
            duration: this._copiedCelRef.duration
        });

        if (newClip) {
            this.selectedCelId = newClip.id;
            this.render();
        }
    }

    render() {
        if (!this.panel || !this.isVisible) return;
        
        // 【重要】モデルを LayerSystem と同期（暫定接続）
        const layers = this.layerSystem?.getLayers() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
        this.model.syncWithLayers(layers, activeIndex);

        const trackList = this.panel.querySelector('.anim-track-list');
        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        
        // パネル全体の編集状態クラス
        this.panel.classList.toggle('clip-edit-active', this.isClipEditModeActive);
        
        // UI上のチェック状態同期
        const editChk = this.panel.querySelector('#anim-clip-edit-chk');
        if (editChk) {
            editChk.checked = this.isClipEditModeActive;
            editChk.disabled = !this.selectedCelId;
        }

        const uniqueBtn = this.panel.querySelector('#anim-unique-btn');
        if (uniqueBtn) {
            const selectedEntry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
            const hasAsset = selectedEntry?.clip?.assetId;
            uniqueBtn.disabled = !hasAsset;
            // 共有中なら少し目立たせるなどの工夫も可能だが、まずはdisabled制御のみ
        }

        if (trackList) {
            let trackHtml = `<div class="anim-track-header">LANES</div>`;
            this.model.tracks.forEach(track => {
                const activeClass = track.active ? ' active' : '';
                const typeClass = track.type === 'folder' ? ' is-folder' : '';
                trackHtml += `<div class="anim-track-item${activeClass}${typeClass}" data-track-id="${track.id}">${this._escapeHtml(track.name)}</div>`;
            });
            trackList.innerHTML = trackHtml;
        }
        
        if (timelineGrid) {
            const totalFrames = this.model.totalFrames;
            const currentFrame = this.model.playback.currentFrame;

            let headerHtml = `<div class="anim-timeline-header">`;
            for (let i = 0; i < totalFrames; i++) {
                const isCurrent = (i === currentFrame) ? ' current' : '';
                headerHtml += `<div class="anim-frame-num${isCurrent}" data-frame-index="${i}">${i + 1}</div>`;
            }
            headerHtml += `</div>`;

            let gridHtml = headerHtml;
            this.model.tracks.forEach(track => {
                const activeClass = track.active ? ' active' : '';
                const isFolder = track.type === 'folder';
                const folderClass = isFolder ? ' is-folder' : '';
                
                gridHtml += `<div class="anim-timeline-row${activeClass}${folderClass}">`;
                for (let i = 0; i < totalFrames; i++) {
                    const isCurrent = (i === currentFrame) ? ' current-col' : '';
                    const cel = track.getCelAtFrame(i);
                    const hasCelClass = cel ? ' has-cel' : '';
                    const isSelected = cel && cel.id === this.selectedCelId;
                    const selectedClass = isSelected ? ' selected' : '';
                    const editingClass = (isSelected && this.isClipEditModeActive) ? ' editing' : '';

                    const isShared = cel && cel.assetId && this.model.isAssetShared(cel.assetId);
                    const sharedClass = isShared ? ' shared-asset' : '';

                    const hasSnapshot = cel && !!this.model.getSnapshotForCel(cel);
                    const hasSnapshotClass = hasSnapshot ? ' has-snapshot' : '';
                    
                    const isStart = cel && cel.startFrame === i;
                    
                    const durationClass = isStart ? ` duration-${Math.max(1, Math.min(cel.duration, totalFrames))}` : '';
                    gridHtml += `<div class="anim-cell-slot${isCurrent}${hasCelClass}${selectedClass}" 
                                     data-track-id="${track.id}" 
                                     data-frame-index="${i}">
                                     ${isStart ? `<div class="anim-cel-block${selectedClass}${editingClass}${hasSnapshotClass}${sharedClass}${durationClass}" data-cel-id="${cel.id}">
                                         <div class="anim-cel-handle" data-cel-id="${cel.id}"></div>
                                         ${hasSnapshot ? '<div class="anim-snapshot-icon"></div>' : ''}
                                         ${isShared ? '<div class="anim-shared-icon" title="Shared Asset"></div>' : ''}
                                     </div>` : ''}
                                 </div>`;
                }
                gridHtml += `</div>`;
            });
            timelineGrid.innerHTML = gridHtml;
        }

        // プレビューの適用判定
        if (this.isClipEditModeActive) {
            // EDITモード中は合成を停止し、実レイヤー描画を優先
            this._restoreVisibility();
        } else if (this.isPreviewActive) {
            this._applyVisibilityPreview();
        } else {
            this._restoreVisibility();
        }
    }

    _ensurePanelElement() {
        this.panel = document.getElementById('animation-table-popup');
        if (this.panel) return;
        
        this.panel = document.createElement('div');
        this.panel.id = 'animation-table-popup';
        this.panel.className = 'animation-table-panel popup-panel--translucent';
        this.panel.style.display = 'none';
        
        this.panel.innerHTML = `
            <div class="anim-table-header">
                <div class="anim-table-header-left">
                    <button class="anim-tool-btn anim-play-btn" id="anim-play-toggle-btn" title="Play">▶</button>
                    <span class="anim-table-title">ANIMATION TABLE</span>
                    <label class="anim-preview-toggle" title="キャンバス表示をタイムラインに連動させる">
                        <input type="checkbox" id="anim-preview-chk" ${this.isPreviewActive ? 'checked' : ''}> PREVIEW
                    </label>
                    <label class="anim-preview-toggle" title="前後フレームを薄く表示">
                        <input type="checkbox" id="anim-onion-chk" ${this.isOnionSkinActive ? 'checked' : ''}> ONION
                    </label>
                    <label class="anim-preview-toggle" title="描画終了時に選択中セルへ自動キャプチャ">
                        <input type="checkbox" id="anim-auto-capture-chk" ${this.isAutoCaptureActive ? 'checked' : ''}> AUTO
                    </label>
                    <label class="anim-preview-toggle" title="選択Clipを実レイヤーで編集">
                        <input type="checkbox" id="anim-clip-edit-chk" ${this.isClipEditModeActive ? 'checked' : ''}> EDIT
                    </label>
                </div>
                <div class="anim-table-header-center">
                    <div class="anim-duration-controls">
                        <span class="anim-control-label">DURATION:</span>
                        <button class="anim-tool-btn" id="anim-duration-dec" title="Decrease Duration">-</button>
                        <button class="anim-tool-btn" id="anim-duration-inc" title="Increase Duration">+</button>
                    </div>
                    <div class="anim-capture-controls">
                        <button class="anim-tool-btn anim-capture-btn" id="anim-capture-btn" title="選択中セルに現在のレイヤー内容をキャプチャ">CAPTURE</button>
                    </div>
                    <div class="anim-copy-paste-controls">
                        <button class="anim-tool-btn anim-unique-btn" id="anim-unique-btn" title="選択Clipだけ独立したAssetにする">UNIQUE</button>
                        <button class="anim-tool-btn anim-copy-btn" id="anim-copy-btn" title="選択セルをコピー">COPY</button>
                        <button class="anim-tool-btn anim-paste-btn" id="anim-paste-btn" title="コピーした内容を貼り付け">PASTE</button>
                    </div>
                </div>
                <div class="anim-table-header-right">
                    <button class="ui-close-button" id="anim-table-close-btn">×</button>
                </div>
            </div>
            <div class="anim-table-viewport ui-scrollbar">
                <div class="anim-table-content">
                    <div class="anim-track-list"></div>
                    <div class="anim-timeline-grid-container">
                        <div class="anim-timeline-grid"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        this._setupPanelEvents();
    }

    _setupPanelEvents() {
        const closeBtn = this.panel.querySelector('#anim-table-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const playBtn = this.panel.querySelector('#anim-play-toggle-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayback());
        }

        const previewChk = this.panel.querySelector('#anim-preview-chk');
        if (previewChk) {
            previewChk.addEventListener('change', (e) => {
                this.isPreviewActive = e.target.checked;
                this.render();
            });
        }

        const onionChk = this.panel.querySelector('#anim-onion-chk');
        if (onionChk) {
            onionChk.addEventListener('change', (e) => {
                this.isOnionSkinActive = e.target.checked;
                this.render();
            });
        }

        const autoCaptureChk = this.panel.querySelector('#anim-auto-capture-chk');
        if (autoCaptureChk) {
            autoCaptureChk.addEventListener('change', (e) => {
                this.isAutoCaptureActive = e.target.checked;
            });
        }

        const editChk = this.panel.querySelector('#anim-clip-edit-chk');
        if (editChk) {
            editChk.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.enterClipEditMode();
                } else {
                    this.exitClipEditMode();
                }
            });
        }

        const decBtn = this.panel.querySelector('#anim-duration-dec');
        const incBtn = this.panel.querySelector('#anim-duration-inc');
        
        if (decBtn) {
            decBtn.addEventListener('click', () => this._adjustSelectedCelDuration(-1));
        }
        if (incBtn) {
            incBtn.addEventListener('click', () => this._adjustSelectedCelDuration(1));
        }

        const captureBtn = this.panel.querySelector('#anim-capture-btn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.captureSelectedCel());
        }

        const uniqueBtn = this.panel.querySelector('#anim-unique-btn');
        if (uniqueBtn) {
            uniqueBtn.addEventListener('click', () => this.makeSelectedClipUnique());
        }

        const copyBtn = this.panel.querySelector('#anim-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copySelectedCel());
        }

        const pasteBtn = this.panel.querySelector('#anim-paste-btn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => this.pasteCopiedCel());
        }

        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        if (timelineGrid) {
            timelineGrid.addEventListener('click', (e) => {
                // ドラッグ・伸縮・移動中なら無視
                if (this._dragMoved || this._retimingMoved || this._clipMoveMoved) {
                    this._dragMoved = false;
                    this._retimingMoved = false;
                    this._clipMoveMoved = false;
                    return;
                }

                // フレームヘッダークリックによる移動
                const frameNum = e.target.closest('.anim-frame-num');
                if (frameNum) {
                    const frameIndex = parseInt(frameNum.dataset.frameIndex, 10);
                    if (this.isClipEditModeActive) this.exitClipEditMode();
                    this.selectedCelId = null;
                    this.model.setCurrentFrame(frameIndex);
                    this.render();
                    return;
                }

                // セルスロットクリック
                const slot = e.target.closest('.anim-cell-slot');
                if (!slot) return;

                const trackId = slot.dataset.trackId;
                const frameIndex = parseInt(slot.dataset.frameIndex, 10);
                const track = this.model.tracks.find(t => t.id === trackId);
                if (!track) return;

                // フォルダトラックはセル配置不可
                if (track.type === 'folder') return;

                const existingCel = track.getCelAtFrame(frameIndex);

                // Alt+Click で削除（またはセルが存在する場合に反転）
                if (e.altKey || e.shiftKey) {
                    if (existingCel) {
                        if (this.selectedCelId === existingCel.id) this.selectedCelId = null;
                        track.removeCelAtFrame(existingCel.startFrame);
                    }
                } else {
                    // 通常クリック：選択 または 追加＆選択
                    if (existingCel) {
                        this.selectedCelId = existingCel.id;
                    } else {
                        const newCel = track.addCel({
                            sourceLayerId: track.sourceLayerId,
                            layerId: track.layerId,
                            startFrame: frameIndex,
                            duration: 1
                        });
                        if (newCel) {
                            this.selectedCelId = newCel.id;
                        }
                    }
                }
                
                this.render();
            });

            // マウスダウン：リタイミング または クリップ移動
            timelineGrid.addEventListener('mousedown', (e) => {
                // 1. リタイミング（右端ハンドル）
                const handle = e.target.closest('.anim-cel-handle');
                if (handle) {
                    const celId = handle.dataset.celId;
                    const entry = this.model.findClipEntry(celId);

                    if (entry) {
                        const { lane, clip } = entry;
                        this._isRetiming = true;
                        this._retimingMoved = false;
                        this._retimingData = {
                            cel: clip,
                            track: lane,
                            startDuration: clip.duration,
                            startX: e.clientX
                        };

                        this.selectedCelId = celId;
                        this.render();

                        document.addEventListener('mousemove', this._onRetimingMouseMove);
                        document.addEventListener('mouseup', this._onRetimingMouseUp);
                        e.stopPropagation();
                        e.preventDefault();
                    }
                    return;
                }

                // 2. クリップ移動（ブロック本体）
                const block = e.target.closest('.anim-cel-block');
                if (block) {
                    const clipId = block.dataset.celId;
                    const entry = this.model.findClipEntry(clipId);
                    if (!entry) return;

                    this._isClipMoving = true;
                    this._clipMoveMoved = false;
                    this._clipMoveData = {
                        clipId,
                        startX: e.clientX,
                        startY: e.clientY,
                        sourceLaneId: entry.lane.id,
                        sourceStartFrame: entry.clip.startFrame
                    };
                    
                    this.selectedCelId = clipId;
                    // ドラッグ中は少し透明にするなどのフィードバック
                    block.classList.add('moving');

                    document.addEventListener('mousemove', this._onClipMoveMouseMove);
                    document.addEventListener('mouseup', this._onClipMoveMouseUp);
                    
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        }

        // ドラッグ移動の実装
        const header = this.panel.querySelector('.anim-table-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.anim-tool-btn, .ui-close-button, #anim-preview-chk, #anim-onion-chk, #anim-auto-capture-chk, #anim-clip-edit-chk')) return;
            
            this._isDragging = true;
            this._dragMoved = false;
            this._dragOffset.x = e.clientX - this._panelPos.x;
            this._dragOffset.y = e.clientY - this._panelPos.y;
            
            document.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('mouseup', this._onMouseUp);
            e.preventDefault();
        });

        this._onMouseMove = (e) => {
            if (!this._isDragging) return;
            this._dragMoved = true;
            this._panelPos.x = e.clientX - this._dragOffset.x;
            this._panelPos.y = e.clientY - this._dragOffset.y;
            
            // 画面内クランプ
            this._panelPos.x = Math.max(0, Math.min(window.innerWidth - 200, this._panelPos.x));
            this._panelPos.y = Math.max(0, Math.min(window.innerHeight - 40, this._panelPos.y));
            
            this._updatePanelPosition();
        };

        this._onMouseUp = () => {
            this._isDragging = false;
            document.removeEventListener('mousemove', this._onMouseMove);
            document.removeEventListener('mouseup', this._onMouseUp);
            setTimeout(() => {
                this._dragMoved = false;
            }, 0);
        };

        this._onRetimingMouseMove = (e) => {
            if (!this._isRetiming || !this._retimingData) return;
            this._retimingMoved = true;

            const deltaX = e.clientX - this._retimingData.startX;
            const deltaFrames = Math.round(deltaX / 30);
            
            const newDuration = Math.max(1, this._retimingData.startDuration + deltaFrames);
            const { cel, track } = this._retimingData;

            // タイムライン末尾制限
            const maxDuration = this.model.totalFrames - cel.startFrame;
            const finalDuration = Math.min(newDuration, maxDuration);

            if (track.setCelDuration(cel.id, finalDuration)) {
                this.render();
            }
        };

        this._onRetimingMouseUp = () => {
            this._isRetiming = false;
            this._retimingData = null;
            document.removeEventListener('mousemove', this._onRetimingMouseMove);
            document.removeEventListener('mouseup', this._onRetimingMouseUp);
            setTimeout(() => {
                this._retimingMoved = false;
            }, 0);
        };

        this._onClipMoveMouseMove = (e) => {
            if (!this._isClipMoving || !this._clipMoveData) return;

            const dx = e.clientX - this._clipMoveData.startX;
            const dy = e.clientY - this._clipMoveData.startY;
            
            if (!this._clipMoveMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                this._clipMoveMoved = true;
                // 移動開始のフィードバック
                const block = this.panel.querySelector(`.anim-cel-block[data-cel-id="${this._clipMoveData.clipId}"]`);
                if (block) block.classList.add('moving');
            }
        };

        this._onClipMoveMouseUp = (e) => {
            if (!this._isClipMoving || !this._clipMoveData) return;

            if (this._clipMoveMoved) {
                // ドロップ先の解決
                const targetEl = document.elementFromPoint(e.clientX, e.clientY);
                const slot = targetEl?.closest('.anim-cell-slot');

                if (slot) {
                    const targetLaneId = slot.dataset.trackId;
                    const targetFrame = parseInt(slot.dataset.frameIndex, 10);
                    
                    const result = this.model.moveClip(this._clipMoveData.clipId, targetLaneId, targetFrame);
                }
            }

            this._isClipMoving = false;
            this._clipMoveData = null;
            document.removeEventListener('mousemove', this._onClipMoveMouseMove);
            document.removeEventListener('mouseup', this._onClipMoveMouseUp);
            
            // 少し遅延させてからフラグを下ろす（click誤爆防止）
            setTimeout(() => {
                this.render();
            }, 0);
        };
    }

    _updatePanelPosition() {
        if (!this.panel) return;
        this.panel.style.left = `${this._panelPos.x}px`;
        this.panel.style.top = `${this._panelPos.y}px`;
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
    }

    _adjustSelectedCelDuration(delta) {
        if (!this.selectedCelId) return;

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (entry) {
            const { lane, clip } = entry;
            const maxDuration = Math.max(1, this.model.totalFrames - clip.startFrame);
            const newDuration = Math.max(1, Math.min(maxDuration, clip.duration + delta));
            if (lane.setCelDuration(clip.id, newDuration)) {
                this.render();
            }
        }
    }

    _injectStyles() {
        if (document.getElementById('animation-table-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'animation-table-styles';
        style.textContent = `
            .animation-table-panel {
                position: fixed;
                bottom: 20px;
                left: 70px;
                width: calc(100vw - 320px);
                height: 260px;
                min-width: 400px;
                z-index: 2000;
                display: flex;
                flex-direction: column;
                background: rgba(255, 255, 238, 0.85);
                backdrop-filter: blur(12px);
                border: 2px solid var(--futaba-maroon);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                overflow: hidden;
            }

            .anim-table-header {
                padding: 4px 12px;
                background: var(--futaba-maroon);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                font-weight: bold;
                cursor: move;
                flex-shrink: 0;
            }

            .anim-table-header-center {
                flex: 1;
                display: flex;
                justify-content: center;
            }

            .anim-duration-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(0,0,0,0.2);
                padding: 2px 8px;
                border-radius: 20px;
            }

            .anim-control-label {
                font-size: 9px;
                opacity: 0.8;
                margin-right: 4px;
            }

            .anim-tool-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-weight: bold;
                transition: background 0.2s;
            }

            .anim-tool-btn:hover {
                background: rgba(255,255,255,0.3);
            }

            .anim-tool-btn:active {
                background: #ff6600;
                border-color: #ff6600;
            }

            .anim-tool-btn:disabled {
                opacity: 0.3;
                cursor: not-allowed;
                background: rgba(255,255,255,0.05);
            }

            .anim-unique-btn:not(:disabled):hover {
                background: #4caf50;
                border-color: #81c784;
            }

            .anim-play-btn {
                margin-right: 8px;
                width: 24px;
                height: 24px;
                font-size: 12px;
            }

            .anim-play-btn.playing {
                background: #ff6600;
                border-color: #ff6600;
                color: white;
            }

            .anim-preview-toggle {
                margin-left: 12px;
                font-size: 9px;
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                opacity: 0.8;
                color: white;
                user-select: none;
            }

            .anim-preview-toggle:hover {
                opacity: 1;
            }

            .anim-preview-toggle input {
                margin: 0;
                cursor: pointer;
            }

            .anim-capture-controls {
                margin-left: 12px;
                display: flex;
                align-items: center;
            }

            .anim-capture-btn {
                padding: 0 8px;
                width: auto;
                font-size: 9px;
                background: rgba(255,255,255,0.1);
            }

            .anim-copy-paste-controls {
                margin-left: 8px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .anim-copy-btn, .anim-paste-btn {
                padding: 0 6px;
                width: auto;
                font-size: 8px;
                background: rgba(255,255,255,0.05);
            }

            .anim-table-viewport {
                flex: 1;
                overflow: auto;
                background: rgba(128, 0, 0, 0.02);
            }

            .anim-table-content {
                display: flex;
                min-width: fit-content;
                min-height: fit-content;
                position: relative;
            }

            .anim-track-list {
                width: 140px;
                border-right: 1px solid var(--futaba-light-medium);
                display: flex;
                flex-direction: column;
                background: rgba(255, 255, 238, 0.9);
                position: sticky;
                left: 0;
                z-index: 20;
                flex-shrink: 0;
            }

            .anim-track-header {
                height: 24px;
                padding: 4px 8px;
                font-size: 9px;
                color: var(--futaba-maroon);
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid var(--futaba-light-medium);
                display: flex;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 21;
            }

            .anim-track-item {
                padding: 8px;
                font-size: 11px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.1);
                color: var(--futaba-maroon);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                height: 32px;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                background: rgba(255, 255, 238, 0.6);
            }

            .anim-track-item.is-folder {
                background: rgba(128, 0, 0, 0.05);
                font-weight: bold;
                font-size: 10px;
            }

            .anim-track-item.active {
                background: rgba(255, 102, 0, 0.15);
                font-weight: bold;
                border-left: 3px solid #ff6600;
                padding-left: 5px;
            }

            .anim-timeline-grid-container {
                flex: 1;
                background: transparent;
            }

            .anim-timeline-grid {
                display: flex;
                flex-direction: column;
                min-width: 100%;
                background-image: 
                    linear-gradient(to right, rgba(128, 0, 0, 0.05) 1px, transparent 1px);
                background-size: 30px 100%;
            }

            .anim-timeline-header {
                display: flex;
                height: 24px;
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid var(--futaba-light-medium);
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .anim-frame-num {
                width: 30px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-family: monospace;
                border-right: 1px solid rgba(128, 0, 0, 0.1);
                color: var(--futaba-maroon);
                background: rgba(255, 255, 238, 0.9);
            }

            .anim-frame-num:hover {
                background: rgba(128, 0, 0, 0.1);
                cursor: pointer;
            }

            .anim-frame-num.current {
                background: #ff6600;
                color: white;
                font-weight: bold;
            }

            .anim-timeline-row {
                display: flex;
                height: 32px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.1);
                box-sizing: border-box;
            }

            .anim-timeline-row.is-folder {
                background: rgba(0, 0, 0, 0.02);
            }

            .anim-timeline-row.active {
                background: rgba(255, 102, 0, 0.05);
            }

            .anim-cell-slot {
                width: 30px;
                flex-shrink: 0;
                border-right: 1px solid rgba(128, 0, 0, 0.05);
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                cursor: pointer;
                position: relative;
            }

            .anim-timeline-row.is-folder .anim-cell-slot {
                cursor: default;
            }

            .anim-cell-slot:hover:not(.is-folder *) {
                background: rgba(128, 0, 0, 0.03);
            }

            .anim-cell-slot.current-col {
                background: rgba(255, 102, 0, 0.05);
            }

            .anim-cell-slot.selected {
                background: rgba(255, 102, 0, 0.1);
            }

            .anim-cel-block {
                height: 22px;
                background: var(--futaba-maroon);
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: transform 0.1s ease;
                z-index: 5;
                margin-left: 4px;
                flex-shrink: 0;
                position: relative;
                pointer-events: auto;
                cursor: grab;
            }

            .anim-cel-block.moving {
                opacity: 0.72;
                transform: scale(1.08);
                cursor: grabbing;
                z-index: 100;
                outline: 3px solid rgba(255, 255, 255, 0.95);
                box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.65), 0 8px 18px rgba(128, 0, 0, 0.35);
            }

            .anim-cel-handle {
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 8px;
                cursor: ew-resize;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 0 4px 4px 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .anim-cel-handle::after {
                content: '';
                width: 2px;
                height: 10px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 1px;
            }

            .anim-cel-handle:hover {
                background: rgba(255, 255, 255, 0.4);
            }

            .anim-snapshot-icon {
                position: absolute;
                left: 4px;
                top: 4px;
                width: 6px;
                height: 6px;
                background: white;
                border-radius: 50%;
                box-shadow: 0 0 4px rgba(0,0,0,0.5);
                pointer-events: none;
            }

            .anim-shared-icon {
                position: absolute;
                right: 12px;
                top: 6px;
                width: 10px;
                height: 10px;
                pointer-events: none;
                opacity: 0.8;
            }

            .anim-shared-icon::before, .anim-shared-icon::after {
                content: '';
                position: absolute;
                width: 6px;
                height: 4px;
                border: 1.5px solid white;
                border-radius: 2px;
            }

            .anim-shared-icon::before {
                top: 0;
                left: 0;
                transform: rotate(-45deg);
            }

            .anim-shared-icon::after {
                bottom: 0;
                right: 0;
                transform: rotate(-45deg);
            }

            .anim-cel-block.duration-1 { width: 22px; }
            .anim-cel-block.duration-2 { width: 52px; }
            .anim-cel-block.duration-3 { width: 82px; }
            .anim-cel-block.duration-4 { width: 112px; }
            .anim-cel-block.duration-5 { width: 142px; }
            .anim-cel-block.duration-6 { width: 172px; }
            .anim-cel-block.duration-7 { width: 202px; }
            .anim-cel-block.duration-8 { width: 232px; }
            .anim-cel-block.duration-9 { width: 262px; }
            .anim-cel-block.duration-10 { width: 292px; }
            .anim-cel-block.duration-11 { width: 322px; }
            .anim-cel-block.duration-12 { width: 352px; }
            .anim-cel-block.duration-13 { width: 382px; }
            .anim-cel-block.duration-14 { width: 412px; }
            .anim-cel-block.duration-15 { width: 442px; }
            .anim-cel-block.duration-16 { width: 472px; }
            .anim-cel-block.duration-17 { width: 502px; }
            .anim-cel-block.duration-18 { width: 532px; }
            .anim-cel-block.duration-19 { width: 562px; }
            .anim-cel-block.duration-20 { width: 592px; }
            .anim-cel-block.duration-21 { width: 622px; }
            .anim-cel-block.duration-22 { width: 652px; }
            .anim-cel-block.duration-23 { width: 682px; }
            .anim-cel-block.duration-24 { width: 712px; }

            .anim-cel-block.selected {
                background: #ff6600;
                transform: scaleY(1.1);
                box-shadow: 0 0 8px rgba(255, 102, 0, 0.5);
                border: 2px solid white;
            }

            .anim-cel-block.editing {
                background: #00e5ff !important;
                border: 2px solid white;
                box-shadow: 0 0 15px rgba(0, 229, 255, 0.8);
                transform: scaleY(1.15);
            }

            .clip-edit-active .anim-table-header {
                background: #00acc1; /* EDITモード中はヘッダー色を変更 */
            }

            .anim-timeline-row.active .anim-cel-block {
                background: #ff6600;
            }

            .anim-timeline-row.active .anim-cel-block.selected {
                background: #ff8c42;
                border-color: white;
            }
        `;
        document.head.appendChild(style);
    }

    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // レイヤー系の更新を購読
        this.eventBus.on('layer:panel-update-requested', () => this.requestUpdate());
        this.eventBus.on('layer:created', () => this.requestUpdate());
        this.eventBus.on('layer:deleted', () => this.requestUpdate());
        this.eventBus.on('layer:activated', () => this.requestUpdate());
        this.eventBus.on('layer:reordered', () => this.requestUpdate());
        this.eventBus.on('layer:name-changed', () => this.requestUpdate());
        
        // アニメーション系
        this.eventBus.on('animation:frame-changed', () => this.requestUpdate());

        // 自動キャプチャ
        this.eventBus.on('drawing:stroke-completed', (data = {}) => {
            this._handleDrawingCompleted(data);
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            // 入力欄編集中は無視
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.isContentEditable;
            if (isInput) return;

            if (e.key === 'ArrowLeft') {
                const current = this.model.playback.currentFrame;
                if (current > 0) {
                    if (this.isClipEditModeActive) this.exitClipEditMode();
                    this.selectedCelId = null;
                    this.model.setCurrentFrame(current - 1);
                    this.render();
                }
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                const current = this.model.playback.currentFrame;
                if (current < this.model.totalFrames - 1) {
                    if (this.isClipEditModeActive) this.exitClipEditMode();
                    this.selectedCelId = null;
                    this.model.setCurrentFrame(current + 1);
                    this.render();
                }
                e.preventDefault();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedCelId) {
                    // すべてのトラックから該当セルを探して削除
                    const entry = this.model.findClipEntry(this.selectedCelId);
                    if (entry) {
                        entry.lane.removeCelAtFrame(entry.clip.startFrame);
                        this.selectedCelId = null;
                        if (this.isClipEditModeActive) this.exitClipEditMode();
                        this.render();
                    }
                }
            }
        });
    }

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }
}

// 下位互換性のためにグローバルに登録
window.AnimationTablePopup = AnimationTablePopup;
