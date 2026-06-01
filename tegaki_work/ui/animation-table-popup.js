/**
 * ============================================================================
 * ファイル名: ui/animation-table-popup.js
 * 責務: 動画ツール風アニメーションテーブル（ToonSquid風）のUIを提供する
 * 依存: system/event-bus.js, system/animation/animation-data-model.js
 * 被依存: core-engine.js, system/popup-manager.js
 * ============================================================================
 */

import { Container, RenderTexture, Sprite, Texture } from 'pixi.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
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
        this.activeLaneId = null;
        
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
        this._previewBeforeTransform = null;
        this.isTransformPreviewSuspended = false;
        this.isDrawingPreviewSuspended = false;
        this._attributePreviewSyncFrame = null;
        this._drawingHistoryBeforeStates = new Map();

        // 再生スコープ関連
        this.playbackScope = 'all'; // 'all' | 'activeLane' | 'includedLanes'
        this.activePlaybackLaneIds = null; // Set<string> | null
        this.includedLaneIds = new Set();

        // アセットライブラリ関連 (Phase 4z4)
        this.isAssetLibraryVisible = false;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null; // null = Uncategorized
        this.selectedInternalLayerId = null; // Phase 4z7
        this._internalLayerClipboard = null;
        
        // 初期シード関連 (Phase 4z5)
        this.initialClipAssetSeeded = false;

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

        this._saveSelectedClipFromWorkingLayers();
        
        this.panel.style.display = 'flex';
        this.isVisible = true;
        
        // 初回表示時に位置が未設定（null）なら下部デフォルト位置へ
        if (this._panelPos.y === null) {
            const rect = this.panel.getBoundingClientRect();
            this._panelPos.y = window.innerHeight - rect.height - 20;
            this._updatePanelPosition();
        }

        this.render();
        this._requestLayerPanelSync();
    }

    hide() {
        if (!this.panel) return;
        this.stop();
        if (this.isClipEditModeActive) {
            this.exitClipEditMode();
        }
        this._saveSelectedClipFromWorkingLayers();
        this._restoreVisibility();
        this.panel.style.display = 'none';
        this.isVisible = false;
        this._requestLayerPanelSync();
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
        this._saveSelectedClipFromWorkingLayers();

        // Phase 4z2: 再生開始時点の対象を固定
        const filterIds = this._getPreviewLaneFilterIds();
        if (filterIds) {
            this.activePlaybackLaneIds = new Set(filterIds);
        } else {
            this.activePlaybackLaneIds = null;
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
                if (this.eventBus) {
                    this.eventBus.emit('animation:frame-changed', {
                        frameIndex: this.model.playback.currentFrame
                    });
                }
            }
        }, interval);
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.activePlaybackLaneIds = null; // 固定クリア
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

    /**
     * レイヤーパネル側の表示更新を要求する (Phase 4z21)
     */
    _requestLayerPanelSync() {
        if (this.eventBus) {
            this.eventBus.emit('layer:panel-update-requested');
        }
        if (window.timelineUI?.updateLayerPanelIndicator) {
            window.timelineUI.updateLayerPanelIndicator();
        }
    }

    _flushLayerPanelSync() {
        this._requestLayerPanelSync();
        const renderer = window.layerPanelRenderer;
        if (!renderer) return;

        if (renderer._updateTimeout) {
            clearTimeout(renderer._updateTimeout);
            renderer._updateTimeout = null;
        }

        const layers = this.layerSystem?.getLayers?.() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex?.() || 0;
        renderer.render(layers, activeIndex, window.animationSystem || null);
    }

    enterClipEditMode() {
        if (!this.selectedCelId) {
            this.isClipEditModeActive = false;
            this.render();
            return;
        }

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry || entry.lane.type === 'folder' || entry.lane.isBackground) {
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

    _enterTransformEditPreviewMode() {
        if (!this.isVisible || !this.selectedCelId || this.isTransformPreviewSuspended) return;

        this._previewBeforeTransform = this.isPreviewActive;
        this.isTransformPreviewSuspended = true;
        this._restoreVisibility();
        this.render();
    }

    _exitTransformEditPreviewMode() {
        if (!this.isTransformPreviewSuspended) return;

        this.isTransformPreviewSuspended = false;
        if (this._previewBeforeTransform !== null) {
            this.isPreviewActive = this._previewBeforeTransform;
            this._previewBeforeTransform = null;
        }
        this.render();
    }

    /**
     * 現在のコンテキストから「アクティブなプレビュー対象Lane」を解決する
     */
    _getActivePreviewLane() {
        // 1. UI上のアクティブLaneを優先する
        if (this.activeLaneId) {
            const lane = this.model.tracks.find(track => track.id === this.activeLaneId);
            if (lane && !lane.isBackground && lane.type !== 'folder') return lane;
        }

        // 2. activeLaneId が未設定の場合だけ選択ClipのLaneを使う
        if (this.selectedCelId) {
            const entry = this.model.findClipEntry(this.selectedCelId);
            if (entry?.lane) return entry.lane;
        }

        // 3. 旧Layer連動は移行用fallbackに限定する
        const activeLayer = this.layerSystem?.getActiveLayer?.();
        const activeLayerId = activeLayer?.layerData?.id || activeLayer?.id;
        if (activeLayerId && this.model.getLaneForSourceLayer) {
            return this.model.getLaneForSourceLayer(activeLayerId);
        }

        return null;
    }

    /**
     * 現在のPlayback Scope設定に基づき、適用すべきLane IDフィルタ(Set)を返す
     */
    _getPreviewLaneFilterIds() {
        // 再生中なら固定された対象を優先
        if (this.isPlaying && this.activePlaybackLaneIds) {
            return this.activePlaybackLaneIds;
        }

        if (this.playbackScope === 'activeLane') {
            const lane = this._getActivePreviewLane();
            return lane ? new Set([lane.id]) : null;
        }

        if (this.playbackScope === 'includedLanes') {
            // SETモードで空の場合はALL fallback (安全策)
            const validLaneIds = new Set(this.model.tracks.map(track => track.id));
            const includedIds = [...this.includedLaneIds].filter(laneId => validLaneIds.has(laneId));
            this.includedLaneIds = new Set(includedIds);
            return includedIds.length > 0 ? new Set(includedIds) : null;
        }

        return null; // ALL
    }

    _applyVisibilityPreview() {
        if (!this.isVisible || !this.isPreviewActive || !this.layerSystem) return;
        
        this._ensurePreviewContainer();
        if (this.animationPreviewContainer) {
            this.animationPreviewContainer.removeChildren();
        }

        const layers = this.layerSystem.getLayers() || [];
        const currentFrame = this.model.playback.currentFrame;

        // Phase 4z2: LaneフィルタIDセットの取得
        const filterIds = this._getPreviewLaneFilterIds();

        // 1. まず、タイムラインで管理されている全実レイヤーとCAF作業レイヤーを一時的に非表示にする
        layers.forEach(layer => {
            const layerData = layer.layerData;
            if (!layerData || layerData.isBackground || layerData.isFolder) return;

            const isTracked = this.model.tracks.some(t => (t.sourceLayerId || t.layerId) === layerData.id);
            if (isTracked || layerData.isAnimationWorkingLayer === true) {
                layer.visible = false;
            }
        });

        // 2. オニオンスキンの描画 (再生中・OFF時はスキップ)
        if (this.isOnionSkinActive && !this.isPlaying) {
            this._renderOnionSkins(currentFrame, layers, { filterIds });
        }

        // 3. メインプレビュー（現在フレーム）の描画
        // 選択Clipは編集対象のハイライトであり、Preview Scopeを上書きしない。
        this._renderFrameComposite(currentFrame, layers, { filterIds });

        this._visibilityPreviewApplied = true;
    }

    _renderFrameComposite(frameIndex, layers, options = {}) {
        const tracks = this.model.tracks;
        const filterIds = options.filterIds || null;

        // データの tracks[0] は UI の一番上（＝レイヤーの前面）なので、逆順で addChild する
        for (let i = tracks.length - 1; i >= 0; i--) {
            const track = tracks[i];
            
            // Phase 4z2: フィルタがある場合は対象外Laneをスキップ
            if (track.isBackground) continue;
            if (filterIds && !filterIds.has(track.id)) continue;

            const cel = track.getCelAtFrame(frameIndex);
            if (cel && cel.visible !== false) {
                this._renderCelPreview(track, cel, layers, {
                    ...options,
                    allowSourceLayerFallback: false
                });
            }
        }
    }

    _renderOnionSkins(currentFrame, layers, options = {}) {
        // 前フレーム
        if (currentFrame > 0) {
            this._renderOnionFrame(currentFrame - 1, layers, {
                ...options,
                alpha: this.onionSkinPrevAlpha,
                tint: this.onionSkinPrevTint
            });
        }

        // 次フレーム
        if (currentFrame < this.model.totalFrames - 1) {
            this._renderOnionFrame(currentFrame + 1, layers, {
                ...options,
                alpha: this.onionSkinNextAlpha,
                tint: this.onionSkinNextTint
            });
        }
    }

    _renderOnionFrame(frameIndex, layers, options) {
        this._renderFrameComposite(frameIndex, layers, options);
    }

    _findSelectedCelEntry() {
        return this.model.findClipEntry(this.selectedCelId);
    }

    _findClipEntryByAssetId(assetId) {
        if (!assetId) return null;
        for (const lane of this.model.tracks || []) {
            for (const clip of lane.cels || []) {
                if (clip?.assetId === assetId) {
                    return { lane, track: lane, clip };
                }
            }
        }
        return null;
    }

    _getSelectedClipSourceLayerId() {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.lane) return null;
        return entry.lane.sourceLayerId || entry.lane.layerId || null;
    }

    /**
     * ClipAsset の内部レイヤーを合成してプレビュー描画する (Phase 4z10)
     */
    _renderClipAssetInternalLayerPreview(track, cel, layers, options = {}) {
        if (!cel || !this.animationPreviewContainer) return false;

        const result = this.model.getPreviewInternalLayersForCel(cel);
        if (!result || !result.ok) return false;

        const { asset, layers: internalLayers } = result;
        const drawableInternalLayers = internalLayers.filter(layer => layer?.type !== 'folder');
        const sourceLayer = layers.find(l => l.layerData?.id === (track.sourceLayerId || track.layerId));
        
        // 描画順：末尾から先頭へ (配列先頭がInspector上で上＝前面になるように)
        for (let i = internalLayers.length - 1; i >= 0; i--) {
            const internalLayer = internalLayers[i];
            if (internalLayer.type === 'folder') continue;
            
            // 可視性チェック
            if (!this._isInternalLayerEffectivelyVisible(asset, internalLayer)) continue;
            
            // 不透明度チェック
            const opacity = typeof internalLayer.opacity === 'number' ? internalLayer.opacity : 1.0;
            if (opacity <= 0) continue;

            const snapshot = this.model.getDrawingSnapshot(internalLayer.drawingSnapshotId);
            if (!snapshot) continue;

            const displaySnapshot = this._createInternalClippedSnapshot(asset, internalLayer, snapshot) || snapshot;
            const texture = this._getTextureFromSnapshot(displaySnapshot);
            if (!texture) continue;

            const sprite = new Sprite(texture);
            
            // アルファの積算：実レイヤー透明度 * 内部レイヤー透明度 * オプション（オニオン等）
            const baseAlpha = drawableInternalLayers.length <= 1 ? (sourceLayer?.layerData?.opacity ?? 1.0) : 1.0;
            sprite.alpha = baseAlpha * opacity * (options.alpha ?? 1.0);
            
            // 合成モード：内部レイヤーの設定を優先
            if (internalLayer.blendMode && internalLayer.blendMode !== 'normal') {
                sprite.blendMode = internalLayer.blendMode;
            } else if (sourceLayer?.layerData?.blendMode && drawableInternalLayers.length <= 1) {
                sprite.blendMode = sourceLayer.layerData.blendMode;
            } else {
                sprite.blendMode = 'normal';
            }

            // ティント（オニオン用）
            if (options.tint !== undefined) {
                sprite.tint = options.tint;
            }

            this.animationPreviewContainer.addChild(sprite);
        }

        return true;
    }

    _createInternalClippedSnapshot(asset, layer, snapshot) {
        const clippingOwner = this._findInternalClippingOwner(asset, layer);
        const sourceItem = clippingOwner
            ? this._findInternalClippingSourceItem(asset, clippingOwner)
            : null;
        if (!snapshot?.pixels || !sourceItem) return null;

        const sourceItems = sourceItem.type === 'folder'
            ? this._getInternalFolderDescendantRasterLayers(asset, sourceItem.id)
            : [sourceItem];
        const visibleSourceSnapshots = sourceItems.map(item => {
            if (!this._isInternalLayerEffectivelyVisible(asset, item)) return null;
            return this.model.getDrawingSnapshot(item.drawingSnapshotId);
        }).filter(sourceSnapshot => {
            return sourceSnapshot
                && sourceSnapshot.pixels
                && sourceSnapshot.width === snapshot.width
                && sourceSnapshot.height === snapshot.height;
        });
        if (visibleSourceSnapshots.length === 0) return null;

        const maskedPixels = new Uint8ClampedArray(snapshot.pixels);
        const maskAlpha = new Uint8ClampedArray(snapshot.width * snapshot.height);
        visibleSourceSnapshots.forEach(sourceSnapshot => {
            const sourcePixels = sourceSnapshot.pixels;
            for (let sourceIndex = 3, maskIndex = 0; sourceIndex < sourcePixels.length; sourceIndex += 4, maskIndex++) {
                if (sourcePixels[sourceIndex] > maskAlpha[maskIndex]) {
                    maskAlpha[maskIndex] = sourcePixels[sourceIndex];
                }
            }
        });

        const maskThreshold = 128;
        for (let targetIndex = 3, maskIndex = 0; targetIndex < maskedPixels.length; targetIndex += 4, maskIndex++) {
            maskedPixels[targetIndex] = maskAlpha[maskIndex] >= maskThreshold ? maskedPixels[targetIndex] : 0;
        }

        return {
            width: snapshot.width,
            height: snapshot.height,
            pixels: maskedPixels
        };
    }

    _createInternalClippingMask(asset, layer) {
        const clippingOwner = this._findInternalClippingOwner(asset, layer);
        const sourceItem = clippingOwner
            ? this._findInternalClippingSourceItem(asset, clippingOwner)
            : null;
        if (!sourceItem) return null;

        const maskSprites = this._createInternalMaskSprites(asset, sourceItem);
        if (maskSprites.length === 0) return null;

        const compositeMask = this._createCompositeMaskSprite(maskSprites);
        if (compositeMask) return compositeMask;

        const maskContainer = new Container();
        maskContainer.eventMode = 'none';
        maskSprites.forEach(sprite => maskContainer.addChild(sprite));
        return maskContainer;
    }

    _createCompositeMaskSprite(maskSprites) {
        const renderer = this.layerSystem?.app?.renderer || this.app?.renderer || window.coreEngine?.app?.renderer;
        if (!renderer || maskSprites.length === 0) return null;

        const size = this._getCanvasSnapshotSize();
        const renderTexture = RenderTexture.create({
            width: size.width,
            height: size.height
        });
        const maskContainer = new Container();
        maskSprites.forEach(sprite => maskContainer.addChild(sprite));
        renderer.render({
            container: maskContainer,
            target: renderTexture,
            clear: true,
            clearColor: [0, 0, 0, 0]
        });
        maskContainer.destroy({ children: true, texture: false, baseTexture: false });

        const maskSprite = new Sprite(renderTexture);
        maskSprite.eventMode = 'none';
        return maskSprite;
    }

    _findInternalClippingOwner(asset, layer) {
        if (!asset || !layer) return null;

        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let current = layer;
        const visited = new Set();

        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.clipping === true) return current;
            current = current.parentLayerId ? byId.get(current.parentLayerId) : null;
        }

        return null;
    }

    _findInternalClippingSourceItem(asset, clippingOwner) {
        if (!asset || !clippingOwner) return null;

        const layers = asset.internalLayers || [];
        const layerIndex = layers.findIndex(item => item.id === clippingOwner.id);
        if (layerIndex < 0) return null;

        const parentId = clippingOwner.parentLayerId || null;
        for (let index = layerIndex + 1; index < layers.length; index++) {
            const candidate = layers[index];
            if (!candidate) continue;
            if ((candidate.parentLayerId || null) !== parentId) continue;
            if (!this._isInternalLayerEffectivelyVisible(asset, candidate)) return null;
            return candidate;
        }

        return null;
    }

    _createInternalMaskSprites(asset, sourceItem) {
        if (!sourceItem) return [];

        const sourceItems = sourceItem.type === 'folder'
            ? this._getInternalFolderDescendantRasterLayers(asset, sourceItem.id)
            : [sourceItem];

        return sourceItems.map(item => {
            if (!this._isInternalLayerEffectivelyVisible(asset, item)) return null;
            const snapshot = this.model.getDrawingSnapshot(item.drawingSnapshotId);
            const texture = snapshot ? this._getTextureFromSnapshot(snapshot) : null;
            if (!texture) return null;
            const sprite = new Sprite(texture);
            sprite.eventMode = 'none';
            return sprite;
        }).filter(Boolean);
    }

    _getInternalFolderDescendantRasterLayers(asset, folderId) {
        const layers = asset?.internalLayers || [];
        const result = [];
        const collect = (parentId) => {
            layers.forEach(layer => {
                if ((layer.parentLayerId || null) !== parentId) return;
                if (layer.type === 'folder') {
                    collect(layer.id);
                    return;
                }
                result.push(layer);
            });
        };
        collect(folderId);
        return result;
    }

    _renderCelPreview(track, cel, layers, options = {}) {
        if (!track || !cel) return;

        // Phase 4z10: 内部レイヤー合成プレビューを試行
        if (this._renderClipAssetInternalLayerPreview(track, cel, layers, options)) {
            return;
        }

        // --- 以下、従来の単一Snapshotプレビュー (Fallback用) ---
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

    _invalidateSnapshotTextureCache() {
        this._snapshotTextureCache = new WeakMap();
    }

    captureSelectedCel() {
        this._captureSelectedClip();
    }

    _captureSelectedClip(options = {}) {
        const { silent = false, requireSourceLayerId = null, folderId = null, renderAfter = true } = options;
        if (!this.selectedCelId || !this.layerSystem) return;

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry) return;

        const { lane, clip } = entry;
        const sourceLayerId = lane.sourceLayerId || lane.layerId;

        // AUTO時だけ、旧来の「このLayerで描いた時だけ反応する」絞り込みを残す。
        if (requireSourceLayerId && sourceLayerId && sourceLayerId !== requireSourceLayerId) return;

        const existingAsset = clip.assetId ? this.model.getClipAsset(clip.assetId) : null;
        const previousInternalLayerIndex = existingAsset
            ? existingAsset.internalLayers.findIndex(layer => layer.id === this.selectedInternalLayerId)
            : -1;
        const expectedDrawableLayerCount = existingAsset
            ? this._getDrawableInternalLayers(existingAsset).length
            : null;
        const captured = this._createClipAssetFromVisibleLayers({
            name: existingAsset?.name || `Asset for ${this.model.getLaneDisplayName ? this.model.getLaneDisplayName(lane) : lane.name}`,
            folderId: existingAsset?.folderId ?? folderId,
            maxWorkingLayerCount: expectedDrawableLayerCount
        });

        if (existingAsset) {
            const capturedIndex = this.model.clipAssets.findIndex(asset => asset.id === captured.asset.id);
            if (capturedIndex !== -1) this.model.clipAssets.splice(capturedIndex, 1);
            existingAsset.drawingSnapshotId = captured.asset.drawingSnapshotId;
            existingAsset.internalLayers = this._mergeCapturedInternalLayers(existingAsset, captured.asset.internalLayers);
            existingAsset.updatedAt = Date.now();
            clip.assetId = existingAsset.id;
            const nextInternalIndex = previousInternalLayerIndex >= 0 ? previousInternalLayerIndex : 0;
            const drawableInternalLayers = this._getDrawableInternalLayers(existingAsset);
            this.selectedInternalLayerId = drawableInternalLayers[nextInternalIndex]?.id
                || drawableInternalLayers[0]?.id
                || null;
        } else {
            clip.assetId = captured.asset.id;
            this.selectedInternalLayerId = this._getDrawableInternalLayers(captured.asset)[0]?.id || null;
        }

        clip.rasterSnapshot = captured.rasterSnapshot;
        this.selectedAssetId = clip.assetId;
        this.selectedAssetFolderId = existingAsset?.folderId ?? captured.asset.folderId ?? null;
        this._invalidateSnapshotTextureCache();
        this._markWorkingLayerSnapshotIds(existingAsset || captured.asset);

        if (renderAfter) {
            this.render();
            this._requestLayerPanelSync(); // Phase 4z21
        }
    }

    _mergeCapturedInternalLayers(existingAsset, capturedInternalLayers) {
        const capturedDrawableLayers = this._getDrawableInternalLayers({ internalLayers: capturedInternalLayers });
        const nextInternalLayers = [];
        let drawableIndex = 0;

        existingAsset.internalLayers.forEach(existingLayer => {
            if (existingLayer.type === 'folder') {
                nextInternalLayers.push(existingLayer);
                return;
            }

            const capturedLayer = capturedDrawableLayers[drawableIndex];
            drawableIndex += 1;
            if (!capturedLayer) return;

            existingLayer.name = capturedLayer.name;
            existingLayer.visible = capturedLayer.visible;
            existingLayer.opacity = capturedLayer.opacity;
            existingLayer.blendMode = capturedLayer.blendMode;
            existingLayer.clipping = capturedLayer.clipping;
            existingLayer.drawingSnapshotId = capturedLayer.drawingSnapshotId;
            existingLayer.updatedAt = Date.now();
            nextInternalLayers.push(existingLayer);
        });

        for (; drawableIndex < capturedDrawableLayers.length; drawableIndex++) {
            nextInternalLayers.push(capturedDrawableLayers[drawableIndex]);
        }

        return nextInternalLayers;
    }

    _saveSelectedClipFromWorkingLayers(options = {}) {
        if (!this.selectedCelId || !this.layerSystem) return false;
        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry?.clip) return false;
        if (options.force !== true && !this._hasDirtyWorkingLayersForClip(entry.clip)) return false;
        this._captureSelectedClip({ silent: true, renderAfter: false });
        return true;
    }

    _hasDirtyWorkingLayersForClip(clip) {
        if (!clip?.assetId || !this.layerSystem) return false;
        const asset = this.model.getClipAsset(clip.assetId);
        if (!asset) return false;

        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const targetLayers = this._getRasterWorkingLayers();
        for (let index = 0; index < drawableInternalLayers.length; index++) {
            const targetLayer = targetLayers[index];
            const snapshotId = drawableInternalLayers[index]?.drawingSnapshotId || null;
            if (!targetLayer?.layerData || targetLayer.layerData.animationSnapshotId !== snapshotId) {
                return true;
            }
        }
        for (let index = drawableInternalLayers.length; index < targetLayers.length; index++) {
            const targetLayer = targetLayers[index];
            if (targetLayer?.layerData?.animationSnapshotId !== null) {
                return true;
            }
        }
        return false;
    }

    _handleDrawingCompleted(data = {}) {
        if (!this.selectedCelId) return;

        const layerId = data.layerId || data.data?.layerId;
        if (!layerId) return;
        if (!this._isAnimationWorkingLayerId(layerId)) return;

        const beforeState = this._drawingHistoryBeforeStates.get(layerId) || null;
        this._drawingHistoryBeforeStates.delete(layerId);
        const asset = this._getSelectedAssetForInspector();
        const selectedInternalLayerId = this.selectedInternalLayerId || null;

        this._captureSelectedClip({
            silent: true,
            requireSourceLayerId: this.isAutoCaptureActive ? layerId : null
        });
        this.isDrawingPreviewSuspended = false;

        const afterAsset = asset?.id ? this.model.getClipAsset(asset.id) : null;
        const afterState = afterAsset ? this._captureInternalLayerHistoryState(afterAsset) : null;
        if (afterAsset && beforeState && afterState) {
            this._recordInternalLayerHistoryFromStates(afterAsset, beforeState, afterState, 'caf-internal-layer-draw', {
                type: 'caf-internal-layer-draw',
                clipId: this.selectedCelId,
                layerId,
                internalLayerId: selectedInternalLayerId,
                mode: data.mode || data.data?.mode || 'draw'
            });
        }
    }

    _handleDrawingStarted(data = {}) {
        if (!this.isVisible || !this.selectedCelId) return;

        const layerId = data.layerId || data.data?.layerId;
        if (!layerId || !this._isAnimationWorkingLayerId(layerId)) return;

        const asset = this._getSelectedAssetForInspector();
        if (asset) {
            this._drawingHistoryBeforeStates.set(layerId, this._captureInternalLayerHistoryState(asset));
        }
        this._invalidateWorkingLayerSnapshotId(layerId);
        if (this.isPreviewActive) {
            this.isDrawingPreviewSuspended = true;
            this._restoreVisibility();
        }
    }

    _handleHistoryChanged(data = {}) {
        if (!this.isVisible || !this.selectedCelId) return;
        if (!['record', 'undo', 'redo'].includes(data.action)) return;
        if (data.action === 'record' && data.meta?.type === 'draw') return;
        if (typeof data.meta?.type === 'string' && data.meta.type.startsWith('caf-')) return;

        const layerId = data.meta?.layerId || null;
        if (!layerId || !this._isAnimationWorkingLayerId(layerId)) return;
        if (this.isTransformPreviewSuspended) return;

        this._saveSelectedClipFromWorkingLayers();
        this.render();
        this._requestLayerPanelSync();
    }

    _handleLayerDeleted(data = {}) {
        if (!this.isVisible || !this.selectedCelId) return;

        this._saveSelectedClipFromWorkingLayers();
        this.render();
        this._flushLayerPanelSync();
    }


    _isAnimationWorkingLayerId(layerId) {
        if (!layerId || !this.layerSystem) return false;
        return this._getRasterWorkingLayers().some(layer => {
            return layer.layerData?.id === layerId
                && layer.layerData?.isAnimationWorkingLayer === true;
        });
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
        if (!lane || lane.type === 'folder' || lane.isBackground) return;

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
            this.activeLaneId = lane.id;
            this._syncClipAssetToWorkingLayers(newClip);
            this.render();
            this._requestLayerPanelSync();
        }
    }

    _getCanvasSnapshotSize() {
        return {
            width: this.layerSystem?.config?.canvas?.width || 1,
            height: this.layerSystem?.config?.canvas?.height || 1
        };
    }

    /**
     * Inspector表示対象のアセットを解決する
     */
    _getSelectedAssetForInspector() {
        // 優先度 1: 選択中Clipの assetId
        if (this.selectedCelId) {
            const entry = this.model.findClipEntry(this.selectedCelId);
            if (entry?.clip?.assetId) {
                return this.model.getClipAsset(entry.clip.assetId);
            }
        }

        // 優先度 2: Asset Library内で選択中のAsset
        if (this.selectedAssetId) {
            return this.model.getClipAsset(this.selectedAssetId);
        }

        return null;
    }

    _renderInternalLayerInspector(container, asset) {
        if (!asset) {
            container.innerHTML = '<div class="anim-lib-empty">No asset selected</div>';
            return;
        }

        // 内部レイヤーの補完 (Phase 4z7要件)
        if (asset.internalLayers.length === 0 && this.model.ensureClipAssetInternalLayer) {
             this.model.ensureClipAssetInternalLayer(asset.id);
        }

        let layerHtml = '';
        asset.internalLayers.forEach((layer, index) => {
            const isSelected = this.selectedInternalLayerId === layer.id;
            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            const isBlank = snapshot?.isBlank === true;
            const hasSnapshot = !!snapshot;
            const isVisible = layer.visible !== false;
            const isEffectivelyVisible = this._isInternalLayerEffectivelyVisible(asset, layer);
            const isFolder = layer.type === 'folder';
            const depth = this._getInternalLayerDepth(asset, layer);

            const isFirst = index === 0;
            const isLast = index === asset.internalLayers.length - 1;

            layerHtml += `
                <div class="anim-internal-layer-row${isSelected ? ' is-selected' : ''}${isEffectivelyVisible ? '' : ' is-hidden'}${isFolder ? ' is-folder' : ''} depth-${depth}" data-layer-id="${layer.id}" data-depth="${depth}">
                    <div class="anim-internal-layer-main">
                        <button class="anim-layer-visibility-btn ${isVisible ? 'visible' : 'hidden'}" title="Toggle Visibility">${isVisible ? '👁' : '·'}</button>
                        <div class="anim-internal-layer-name" title="Double click to rename">${isFolder ? '[Folder] ' : ''}${this._escapeHtml(layer.name)}</div>
                        <div class="anim-layer-row-actions">
                            <button class="anim-layer-order-btn up" title="Move Up" ${isFirst ? 'disabled' : ''}>▲</button>
                            <button class="anim-layer-order-btn down" title="Move Down" ${isLast ? 'disabled' : ''}>▼</button>
                            <button class="anim-layer-rename-btn" title="Rename">✎</button>
                            <button class="anim-layer-delete-btn" title="Delete">×</button>
                        </div>
                    </div>
                    <div class="anim-internal-layer-meta">
                        <span class="meta-type">${layer.type}</span>
                        <span class="meta-opacity">${Math.round(layer.opacity * 100)}%</span>
                        <span class="meta-blend">${layer.blendMode}</span>
                        <span class="meta-snapshot ${isBlank ? 'is-blank' : (hasSnapshot ? 'has-data' : 'none')}">
                            ${isBlank ? 'blank' : (hasSnapshot ? 'snapshot' : 'none')}
                        </span>
                    </div>
                </div>`;
        });

        container.innerHTML = `
            <div class="anim-lib-label">
                INTERNAL LAYERS
                <button class="anim-layer-add-btn" title="Add internal layer">+</button>
            </div>
            <div class="anim-internal-layer-list ui-scrollbar">
                ${layerHtml}
            </div>
        `;
    }

    _getInternalLayerDepth(asset, layer) {
        if (!asset || !layer?.parentLayerId) return 0;
        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let depth = 0;
        let parentId = layer.parentLayerId;
        const visited = new Set();

        while (parentId && !visited.has(parentId) && depth < 4) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            depth += 1;
            parentId = parent.parentLayerId || null;
        }

        return Math.min(depth, 4);
    }

    _isInternalLayerEffectivelyVisible(asset, layer) {
        if (!asset || !layer || layer.visible === false) return false;

        const byId = new Map((asset.internalLayers || []).map(item => [item.id, item]));
        let parentId = layer.parentLayerId || null;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            if (parent.visible === false) return false;
            parentId = parent.parentLayerId || null;
        }

        return true;
    }

    _getInternalLayerCreationParentId(asset) {
        if (!asset || !this.selectedInternalLayerId) return null;

        const selectedLayer = (asset.internalLayers || []).find(layer => layer.id === this.selectedInternalLayerId);
        if (!selectedLayer) return null;

        if (selectedLayer.type === 'folder') {
            return selectedLayer.id;
        }

        return selectedLayer.parentLayerId || null;
    }

    addInternalLayer() {
        const asset = this._getSelectedAssetForInspector();
        if (!asset) return;

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const parentLayerId = this._getInternalLayerCreationParentId(asset);
        const result = this.model.addClipAssetInternalLayer(asset.id, {
            parentLayerId,
            insertAfterLayerId: this.selectedInternalLayerId || parentLayerId
        });
        if (result.ok) {
            this.selectedInternalLayerId = result.layer.id;
            this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(asset).length);
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-create', {
                type: 'caf-internal-layer-create',
                layerId: result.layer.id
            });
        }
    }

    addInternalFolder() {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !this.model.addClipAssetInternalFolder) return;

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const parentLayerId = this._getInternalLayerCreationParentId(asset);
        const result = this.model.addClipAssetInternalFolder(asset.id, {
            parentLayerId,
            insertAfterLayerId: this.selectedInternalLayerId || parentLayerId
        });
        if (result.ok) {
            this.selectedInternalLayerId = result.layer.id;
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-folder-create', {
                type: 'caf-internal-folder-create',
                layerId: result.layer.id
            });
        }
    }

    createAssetFolder() {
        const name = prompt('Enter new folder name:');
        if (!name || !name.trim()) return;

        const result = this.model.createClipAssetFolder({ name: name.trim() });
        if (result.ok) {
            this.selectedAssetFolderId = result.folder.id;
            this.selectedAssetId = null;
            this.selectedInternalLayerId = null;
            this.render();
            this._requestLayerPanelSync();
        }
    }

    addIndependentLane() {
        const lane = this.model.createIndependentLane();
        this.selectedCelId = null;
        this.render();
        this._requestLayerPanelSync();
        return lane;
    }

    renameSelectedAssetFolder() {
        if (this.selectedAssetFolderId === null) return;
        const folder = this.model.getClipAssetFolder(this.selectedAssetFolderId);
        if (!folder) return;

        const newName = prompt('Enter new folder name:', folder.name);
        if (!newName || !newName.trim()) return;

        const result = this.model.renameClipAssetFolder(this.selectedAssetFolderId, newName.trim());
        if (result.ok) {
            this.render();
            this._requestLayerPanelSync();
        }
    }

    moveSelectedAssetToFolder() {
        if (!this.selectedAssetId) return;
        const asset = this.model.getClipAsset(this.selectedAssetId);
        if (!asset) return;

        const folders = this.model.clipAssetFolders;
        let promptText = 'Select destination folder number:\n0: Uncategorized\n';
        folders.forEach((f, i) => {
            promptText += `${i + 1}: ${f.name}\n`;
        });

        const input = prompt(promptText, '0');
        if (input === null) return;

        const index = Number(input.trim());
        if (!Number.isInteger(index)) {
            alert('Invalid folder number.');
            return;
        }

        let targetFolderId = null;
        if (index > 0 && index <= folders.length) {
            targetFolderId = folders[index - 1].id;
        } else if (index === 0) {
            targetFolderId = null;
        } else {
            alert('Invalid folder number.');
            return;
        }

        const result = this.model.moveClipAssetToFolder(this.selectedAssetId, targetFolderId);
        if (result.ok) {
            // 移動先フォルダを表示対象にする
            this.selectedAssetFolderId = targetFolderId;
            this.render();
            this._requestLayerPanelSync();
        }
    }

    moveInternalLayer(layerId, direction) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return;

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this._applyInternalLayerMoveByStep(asset, layerId, direction);
        if (result.ok) {
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-reorder', {
                type: 'caf-internal-layer-reorder',
                layerId,
                direction,
                index: result.index
            });
        }
    }

    _applyInternalLayerMoveByStep(asset, layerId, direction) {
        const layers = asset?.internalLayers || [];
        const movingLayer = layers.find(layer => layer.id === layerId);
        if (!movingLayer) return { ok: false, reason: 'layer-not-found' };

        const movingIds = this._getInternalLayerSubtreeIds(asset, layerId);
        const firstIndex = layers.findIndex(layer => movingIds.has(layer.id));
        const lastIndex = layers.reduce((last, layer, index) => movingIds.has(layer.id) ? index : last, -1);
        if (firstIndex < 0 || lastIndex < firstIndex) return { ok: false, reason: 'invalid-subtree' };

        if (direction === 'up') {
            const targetLayer = layers[firstIndex - 1];
            if (!targetLayer) return { ok: false, reason: 'out-of-range' };
            return this._applyInternalLayerMoveToPosition(asset, layerId, targetLayer.id, 'before');
        }

        const targetLayer = layers[lastIndex + 1];
        if (!targetLayer) return { ok: false, reason: 'out-of-range' };
        return this._applyInternalLayerMoveToPosition(asset, layerId, targetLayer.id, 'after');
    }

    moveInternalLayerToPosition(assetId, layerId, targetLayerId, placement = 'after') {
        const asset = this.model.getClipAsset(assetId);
        if (!asset || !layerId || !targetLayerId || layerId === targetLayerId) {
            return { ok: false, reason: 'invalid-target' };
        }

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this._applyInternalLayerMoveToPosition(asset, layerId, targetLayerId, placement);
        if (result.ok) {
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.selectedInternalLayerId = layerId;
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-dnd', {
                type: 'caf-internal-layer-dnd',
                layerId,
                targetLayerId,
                placement: result.placement
            });
        }
        return result;
    }

    _applyInternalLayerMoveToPosition(asset, layerId, targetLayerId, placement = 'after') {
        const layers = asset?.internalLayers || [];
        const movingLayer = layers.find(layer => layer.id === layerId);
        const targetLayer = layers.find(layer => layer.id === targetLayerId);
        if (!movingLayer || !targetLayer) return { ok: false, reason: 'layer-not-found' };

        const movingIds = this._getInternalLayerSubtreeIds(asset, layerId);
        if (movingIds.has(targetLayerId)) return { ok: false, reason: 'cannot-drop-on-descendant' };

        const nextPlacement = placement === 'inside' && targetLayer.type === 'folder'
            ? 'inside'
            : (placement === 'before' ? 'before' : 'after');
        const movedLayers = layers.filter(layer => movingIds.has(layer.id));
        const remainingLayers = layers.filter(layer => !movingIds.has(layer.id));
        const targetIndex = remainingLayers.findIndex(layer => layer.id === targetLayerId);
        if (targetIndex < 0) return { ok: false, reason: 'target-not-found' };

        if (nextPlacement === 'inside') {
            movingLayer.parentLayerId = targetLayer.id;
        } else {
            movingLayer.parentLayerId = targetLayer.parentLayerId || null;
        }
        movingLayer.updatedAt = Date.now();

        let insertIndex = targetIndex;
        if (nextPlacement === 'after' || nextPlacement === 'inside') {
            const targetSubtreeIds = this._getInternalLayerSubtreeIds({ internalLayers: remainingLayers }, targetLayerId);
            insertIndex = targetIndex + 1;
            for (let index = targetIndex + 1; index < remainingLayers.length; index++) {
                if (!targetSubtreeIds.has(remainingLayers[index].id)) break;
                insertIndex = index + 1;
            }
        }

        remainingLayers.splice(insertIndex, 0, ...movedLayers);
        asset.internalLayers = remainingLayers;
        asset.updatedAt = Date.now();
        return { ok: true, asset, layer: movingLayer, placement: nextPlacement, index: insertIndex };
    }

    _getInternalLayerSubtreeIds(asset, layerId) {
        const layers = asset?.internalLayers || [];
        const ids = new Set([layerId]);
        let changed = true;
        while (changed) {
            changed = false;
            layers.forEach(layer => {
                if (layer.parentLayerId && ids.has(layer.parentLayerId) && !ids.has(layer.id)) {
                    ids.add(layer.id);
                    changed = true;
                }
            });
        }
        return ids;
    }

    duplicateInternalLayer(layerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId || !this.model.duplicateClipAssetInternalLayer) return { ok: false, reason: 'unavailable' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.duplicateClipAssetInternalLayer(asset.id, layerId);
        if (result.ok) {
            this.selectedInternalLayerId = result.layer?.id || null;
            this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(asset).length);
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-duplicate', {
                type: 'caf-internal-layer-duplicate',
                layerId,
                duplicatedLayerId: result.layer?.id || null
            });
        }
        return result;
    }

    copyInternalLayer(layerId = this.selectedInternalLayerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return { ok: false, reason: 'asset-not-found' };

        const selectedLayer = asset.internalLayers.find(layer => layer.id === layerId);
        if (!selectedLayer) return { ok: false, reason: 'layer-not-found' };

        const sourceIds = new Set([layerId]);
        if (selectedLayer.type === 'folder') {
            let changed = true;
            while (changed) {
                changed = false;
                asset.internalLayers.forEach(layer => {
                    if (layer.parentLayerId && sourceIds.has(layer.parentLayerId) && !sourceIds.has(layer.id)) {
                        sourceIds.add(layer.id);
                        changed = true;
                    }
                });
            }
        }

        const layers = asset.internalLayers
            .filter(layer => sourceIds.has(layer.id))
            .map(layer => {
                const snapshot = layer.drawingSnapshotId
                    ? this.model.getDrawingSnapshot(layer.drawingSnapshotId)
                    : null;
                return {
                    layer: layer.serialize ? layer.serialize() : { ...layer },
                    snapshot: snapshot?.serialize ? snapshot.serialize() : (snapshot ? { ...snapshot } : null)
                };
            });

        this._internalLayerClipboard = {
            rootLayerId: layerId,
            layers
        };
        return { ok: true, count: layers.length };
    }

    pasteInternalLayer() {
        const asset = this._getSelectedAssetForInspector();
        const clipboard = this._internalLayerClipboard;
        if (!asset || !clipboard?.layers?.length) return { ok: false, reason: 'clipboard-empty' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const parentLayerId = this._getInternalLayerCreationParentId(asset);
        const insertAfterLayerId = this.selectedInternalLayerId || parentLayerId;
        const idMap = new Map();
        const pastedLayers = clipboard.layers.map((entry, index) => {
            const sourceLayer = entry.layer;
            let drawingSnapshotId = null;
            if (entry.snapshot?.pixels) {
                const snapshot = new DrawingSnapshotModel({
                    width: entry.snapshot.width,
                    height: entry.snapshot.height,
                    pixels: new Uint8ClampedArray(entry.snapshot.pixels),
                    isBlank: entry.snapshot.isBlank === true
                });
                this.model.drawingSnapshots.push(snapshot);
                drawingSnapshotId = snapshot.id;
            }

            const layer = this.model.createClipAssetInternalLayer({
                name: index === 0 ? `${sourceLayer.name} copy` : sourceLayer.name,
                type: sourceLayer.type,
                visible: sourceLayer.visible !== false,
                opacity: sourceLayer.opacity ?? 1,
                blendMode: sourceLayer.blendMode || 'normal',
                clipping: sourceLayer.clipping === true,
                drawingSnapshotId,
                parentLayerId: sourceLayer.parentLayerId,
                isBackground: sourceLayer.isBackground === true
            });
            idMap.set(sourceLayer.id, layer.id);
            return { layer, sourceLayer };
        });

        pastedLayers.forEach(({ layer, sourceLayer }, index) => {
            if (sourceLayer.parentLayerId && idMap.has(sourceLayer.parentLayerId)) {
                layer.parentLayerId = idMap.get(sourceLayer.parentLayerId);
            } else if (index === 0) {
                layer.parentLayerId = parentLayerId;
            } else if (sourceLayer.parentLayerId && !idMap.has(sourceLayer.parentLayerId)) {
                layer.parentLayerId = parentLayerId;
            }
        });

        const insertIndex = this.model._resolveInternalLayerInsertIndex
            ? this.model._resolveInternalLayerInsertIndex(asset, { insertAfterLayerId })
            : asset.internalLayers.length;
        asset.internalLayers.splice(insertIndex, 0, ...pastedLayers.map(entry => entry.layer));
        asset.updatedAt = Date.now();
        this.selectedInternalLayerId = pastedLayers[0]?.layer?.id || null;
        this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(asset).length);
        this._syncSelectedClipToWorkingLayers();
        this.render();
        this._flushLayerPanelSync();
        this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-paste', {
            type: 'caf-internal-layer-paste',
            layerId: pastedLayers[0]?.layer?.id || null,
            count: pastedLayers.length
        });
        return { ok: true, layer: pastedLayers[0]?.layer || null, pastedLayers: pastedLayers.map(entry => entry.layer) };
    }

    cutInternalLayer(layerId = this.selectedInternalLayerId) {
        const copyResult = this.copyInternalLayer(layerId);
        if (!copyResult.ok) return copyResult;
        this.removeInternalLayer(layerId, { historyName: 'caf-internal-layer-cut' });
        return copyResult;
    }

    mergeInternalLayerDown(layerId = this.selectedInternalLayerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return { ok: false, reason: 'asset-not-found' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this._applyInternalLayerMergeDown(asset, layerId);
        if (result.ok) {
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-merge-down', {
                type: 'caf-internal-merge-down',
                layerId,
                targetLayerId: result.layer?.id || null
            });
        }
        return result;
    }

    _applyInternalLayerMergeDown(asset, layerId) {
        const layers = asset.internalLayers || [];
        const sourceIndex = layers.findIndex(layer => layer.id === layerId);
        const sourceLayer = layers[sourceIndex];
        if (!sourceLayer) return { ok: false, reason: 'layer-not-found' };
        if (sourceLayer.type === 'folder' || sourceLayer.isBackground) {
            return { ok: false, reason: 'not-raster-layer' };
        }

        const targetIndex = layers.findIndex((layer, index) => {
            return index > sourceIndex
                && layer.parentLayerId === sourceLayer.parentLayerId
                && layer.type !== 'folder'
                && layer.isBackground !== true;
        });
        const targetLayer = layers[targetIndex];
        if (!targetLayer) return { ok: false, reason: 'no-layer-below' };

        const sourceSnapshot = this.model.getDrawingSnapshot(sourceLayer.drawingSnapshotId);
        const targetSnapshot = this.model.getDrawingSnapshot(targetLayer.drawingSnapshotId);
        const size = this._getCanvasSnapshotSize();
        const width = Math.max(sourceSnapshot?.width || 0, targetSnapshot?.width || 0, size.width || 1);
        const height = Math.max(sourceSnapshot?.height || 0, targetSnapshot?.height || 0, size.height || 1);
        const mergedSnapshot = this._mergeInternalLayerSnapshots({
            width,
            height,
            sourceSnapshot,
            targetSnapshot,
            sourceLayer,
            targetLayer
        });
        if (!mergedSnapshot) return { ok: false, reason: 'snapshot-merge-failed' };

        this.model.drawingSnapshots.push(mergedSnapshot);
        targetLayer.drawingSnapshotId = mergedSnapshot.id;
        targetLayer.updatedAt = Date.now();
        targetLayer.visible = targetLayer.visible !== false;
        layers.splice(sourceIndex, 1);
        asset.updatedAt = Date.now();
        this.selectedInternalLayerId = targetLayer.id;
        this._invalidateSnapshotTextureCache();
        this._syncSelectedClipToWorkingLayers();
        this.render();
        this._flushLayerPanelSync();
        return { ok: true, asset, layer: targetLayer, removedLayer: sourceLayer };
    }

    _captureInternalLayerHistoryState(asset) {
        if (!asset) return null;
        return {
            assetId: asset.id,
            selectedCelId: this.selectedCelId || null,
            selectedInternalLayerId: this.selectedInternalLayerId || null,
            clipAssets: (this.model.clipAssets || []).map(clipAsset => {
                return clipAsset.serialize ? clipAsset.serialize() : { ...clipAsset };
            }),
            internalLayers: (asset.internalLayers || []).map(layer => {
                return layer.serialize ? layer.serialize() : { ...layer };
            }),
            drawingSnapshots: (this.model.drawingSnapshots || []).map(snapshot => {
                return snapshot.serialize ? snapshot.serialize() : { ...snapshot };
            })
        };
    }

    _recordInternalLayerHistory(asset, beforeState, name, meta = {}) {
        if (!asset || !beforeState || !historyManager || historyManager.isApplying) return false;
        const afterState = this._captureInternalLayerHistoryState(asset);
        historyManager.record({
            name,
            do: () => this._restoreInternalLayerHistoryState(asset.id, afterState),
            undo: () => this._restoreInternalLayerHistoryState(asset.id, beforeState),
            meta: {
                assetId: asset.id,
                ...meta
            }
        });
        return true;
    }

    _recordInternalLayerHistoryFromStates(asset, beforeState, afterState, name, meta = {}) {
        if (!asset || !beforeState || !afterState || !historyManager || historyManager.isApplying) return false;
        historyManager.record({
            name,
            do: () => this._restoreInternalLayerHistoryState(asset.id, afterState),
            undo: () => this._restoreInternalLayerHistoryState(asset.id, beforeState),
            meta: {
                assetId: asset.id,
                ...meta
            }
        });
        return true;
    }

    _captureTimelineHistoryState() {
        const state = this.model.serialize ? this.model.serialize() : {};
        return {
            ...state,
            selectedCelId: this.selectedCelId || null,
            selectedAssetId: this.selectedAssetId || null,
            selectedAssetFolderId: this.selectedAssetFolderId || null,
            selectedInternalLayerId: this.selectedInternalLayerId || null,
            activeLaneId: this.activeLaneId || null
        };
    }

    _recordTimelineHistory(beforeState, afterState, name, meta = {}) {
        if (!beforeState || !afterState || !historyManager || historyManager.isApplying) return false;
        historyManager.record({
            name,
            do: () => this._restoreTimelineHistoryState(afterState),
            undo: () => this._restoreTimelineHistoryState(beforeState),
            meta
        });
        return true;
    }

    _restoreTimelineHistoryState(state) {
        if (!state) return false;
        const restoredModel = new TimelineModel(state);
        this.model.fps = restoredModel.fps;
        this.model.totalFrames = restoredModel.totalFrames;
        this.model.tracks = restoredModel.tracks;
        this.model.clipAssetFolders = restoredModel.clipAssetFolders;
        this.model.clipAssets = restoredModel.clipAssets;
        this.model.drawingSnapshots = restoredModel.drawingSnapshots;
        this.model.playback = { ...restoredModel.playback };
        this.model.layerSyncInitialized = restoredModel.layerSyncInitialized;

        this.activeLaneId = state.activeLaneId || null;
        const activeLane = this.activeLaneId ? this.model.getLaneById(this.activeLaneId) : null;
        if (activeLane && activeLane.type !== 'folder' && !activeLane.isBackground) {
            this.model.tracks.forEach(track => {
                track.active = track.id === activeLane.id;
            });
        } else {
            this.activeLaneId = null;
            this.model.tracks.forEach(track => {
                track.active = false;
            });
        }

        this.selectedCelId = state.selectedCelId || null;
        this.selectedAssetId = state.selectedAssetId || null;
        this.selectedAssetFolderId = state.selectedAssetFolderId || null;
        this.selectedInternalLayerId = state.selectedInternalLayerId || null;
        this._invalidateSnapshotTextureCache();

        const selectedEntry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (selectedEntry?.clip) {
            this.activeLaneId = selectedEntry.lane?.id || this.activeLaneId;
            this.model.tracks.forEach(track => {
                track.active = track.id === this.activeLaneId;
            });
            this._activateClipEntry(selectedEntry, { saveCurrent: false });
        } else {
            this._syncWorkingLayersForCurrentFrame();
        }

        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _restoreInternalLayerHistoryState(assetId, state) {
        if (!assetId || !state) return false;
        if (Array.isArray(state.clipAssets)) {
            this.model.clipAssets = state.clipAssets.map(clipAsset => new ClipAssetModel(clipAsset));
        }
        let asset = this.model.getClipAsset(assetId);
        if (!asset) return false;

        if (!Array.isArray(state.clipAssets)) {
            asset.internalLayers = (state.internalLayers || []).map(layer => {
                return this.model.createClipAssetInternalLayer(layer);
            });
        }
        this.model.drawingSnapshots = (state.drawingSnapshots || []).map(snapshot => {
            return new DrawingSnapshotModel({
                ...snapshot,
                pixels: snapshot.pixels && typeof snapshot.pixels.length === 'number'
                    ? new Uint8ClampedArray(snapshot.pixels)
                    : snapshot.pixels
            });
        });
        asset = this.model.getClipAsset(assetId);
        if (!asset) return false;
        asset.updatedAt = Date.now();
        const entry = (state.selectedCelId ? this.model.findClipEntry(state.selectedCelId) : null)
            || this._findClipEntryByAssetId(asset.id);
        if (entry?.clip) {
            this.selectedCelId = entry.clip.id;
            this.activeLaneId = entry.lane?.id || this.activeLaneId;
            if (Number.isInteger(entry.clip.startFrame)) {
                this.model.setCurrentFrame(entry.clip.startFrame);
            }
            this.model.tracks.forEach(track => {
                track.active = track.id === this.activeLaneId;
            });
        }
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = state.selectedInternalLayerId || this._getDrawableInternalLayers(asset)[0]?.id || null;
        this._invalidateSnapshotTextureCache();
        this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(asset).length);
        this._restoreVisibility();
        const clipToSync = entry?.clip || this.model.findClipEntry(this.selectedCelId)?.clip || null;
        if (clipToSync) {
            this._syncClipAssetToWorkingLayers(clipToSync, { forceRestore: true });
        }
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _mergeInternalLayerSnapshots({ width, height, sourceSnapshot, targetSnapshot, sourceLayer, targetLayer }) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        this._putSnapshotPixels(ctx, targetSnapshot, width, height);

        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return null;
        this._putSnapshotPixels(sourceCtx, sourceSnapshot, width, height);

        if (sourceLayer?.clipping === true && targetSnapshot?.pixels) {
            sourceCtx.globalCompositeOperation = 'destination-in';
            this._putSnapshotPixels(sourceCtx, targetSnapshot, width, height);
            sourceCtx.globalCompositeOperation = 'source-over';
        }

        ctx.globalAlpha = sourceLayer?.opacity ?? 1;
        ctx.globalCompositeOperation = this._canvasCompositeModeForBlendMode(sourceLayer?.blendMode || 'normal');
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const imageData = ctx.getImageData(0, 0, width, height);
        return new DrawingSnapshotModel({
            width,
            height,
            pixels: new Uint8ClampedArray(imageData.data),
            isBlank: false
        });
    }

    _putSnapshotPixels(ctx, snapshot, width, height) {
        if (!snapshot?.pixels) return false;
        const snapshotWidth = Math.max(1, Math.round(snapshot.width || width));
        const snapshotHeight = Math.max(1, Math.round(snapshot.height || height));
        const imageData = new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshotWidth, snapshotHeight);
        ctx.putImageData(imageData, 0, 0);
        return true;
    }

    _canvasCompositeModeForBlendMode(blendMode) {
        switch (blendMode) {
            case 'multiply':
            case 'overlay':
                return blendMode;
            case 'add':
                return 'lighter';
            default:
                return 'source-over';
        }
    }

    renameInternalLayer(layerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return;
        this.renameInternalLayerFromExternal(asset.id, layerId);
    }

    /**
     * 外部UI（レイヤーパネル等）から内部Layer名を変更する (Phase 4z19)
     */
    renameInternalLayerFromExternal(assetId, layerId, name = null, options = {}) {
        const asset = this.model.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(l => l.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        // 名前の確定
        let nextName = name;
        if (nextName === null || nextName === undefined) {
            nextName = prompt('Enter new layer name:', layer.name);
            if (nextName === null) return { ok: false, reason: 'cancelled' };
        }

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.renameClipAssetInternalLayer(asset.id, layerId, nextName);
        if (result.ok) {
            // 選択状態の同期
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.selectedInternalLayerId = layerId;
            this._syncSelectedClipToWorkingLayers();

            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-rename', {
                type: 'caf-internal-layer-rename',
                layerId,
                name: result.layer?.name || nextName
            });
        } else if (result.reason === 'invalid-name' && name === null) {
            alert('Invalid name. It cannot be empty.');
        }

        return result;
    }

    removeInternalLayer(layerId, options = {}) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return;

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.removeClipAssetInternalLayer(asset.id, layerId);
        if (result.ok) {
            const removedIds = new Set((result.removedLayers || [result.layer]).map(layer => layer?.id).filter(Boolean));
            if (removedIds.has(this.selectedInternalLayerId)) {
                this.selectedInternalLayerId = result.fallbackLayer?.id || this._getDrawableInternalLayers(asset)[0]?.id || null;
            }
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            const historyName = options.historyName || 'caf-internal-layer-delete';
            this._recordInternalLayerHistory(asset, beforeState, historyName, {
                type: historyName,
                layerId,
                removedLayerIds: Array.from(removedIds)
            });
        } else if (result.reason === 'last-layer') {
            alert('Cannot delete the last layer of an asset.');
        }
    }

    clearInternalLayerDrawing(layerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return { ok: false, reason: 'asset-not-found' };

        const layer = asset.internalLayers.find(item => item.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };
        if (layer.type === 'folder' || layer.isBackground) return { ok: false, reason: 'not-raster-layer' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const size = this._getCanvasSnapshotSize();
        const blankSnapshot = new DrawingSnapshotModel({
            width: size.width,
            height: size.height,
            pixels: new Uint8ClampedArray(size.width * size.height * 4),
            isBlank: true
        });
        this.model.drawingSnapshots.push(blankSnapshot);
        layer.drawingSnapshotId = blankSnapshot.id;
        layer.updatedAt = Date.now();
        asset.updatedAt = Date.now();
        this.selectedInternalLayerId = layer.id;
        this._invalidateSnapshotTextureCache();
        this._syncSelectedClipToWorkingLayers();
        this.render();
        this._flushLayerPanelSync();
        this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-clear', {
            type: 'caf-internal-layer-clear',
            layerId
        });
        return { ok: true, asset, layer };
    }

    toggleInternalLayerVisibility(layerId) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return;
        this.toggleInternalLayerVisibilityFromExternal(asset.id, layerId);
    }

    /**
     * 外部UI（レイヤーパネル等）から内部Layerの可視性を切り替える (Phase 4z18)
     */
    toggleInternalLayerVisibilityFromExternal(assetId, layerId, options = {}) {
        const asset = this.model.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.toggleClipAssetInternalLayerVisibility(asset.id, layerId);
        if (result.ok) {
            // 選択状態の同期
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.selectedInternalLayerId = layerId;
            this._syncSelectedClipToWorkingLayers();

            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-visibility', {
                type: 'caf-internal-layer-visibility',
                layerId,
                visible: result.layer?.visible !== false
            });
        }
        return result;
    }

    toggleInternalLayerClippingFromExternal(assetId, layerId, options = {}) {
        const asset = this.model.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };

        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.toggleClipAssetInternalLayerClipping(asset.id, layerId);
        if (result.ok) {
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.selectedInternalLayerId = layerId;
            if (result.layer?.type === 'folder') {
                this._invalidateSnapshotTextureCache();
            } else {
                this._syncSelectedClipToWorkingLayers();
            }
            this.render();
            this._flushLayerPanelSync();
            this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-clipping', {
                type: 'caf-internal-layer-clipping',
                layerId,
                clipping: result.layer?.clipping === true
            });
        }
        return result;
    }

    toggleClipVisibilityFromExternal(clipId, options = {}) {
        const entry = this.model.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };

        const beforeVisible = entry.clip.visible !== false;
        entry.clip.visible = entry.clip.visible === false ? true : false;
        const afterVisible = entry.clip.visible !== false;
        this._activateClipEntry(entry);
        this._syncClipAssetToWorkingLayers(entry.clip);
        this.render();
        this._flushLayerPanelSync();
        this._recordClipVisibilityHistory(clipId, beforeVisible, afterVisible);
        return { ok: true, clip: entry.clip, lane: entry.lane };
    }

    _recordClipVisibilityHistory(clipId, beforeVisible, afterVisible) {
        if (!clipId || beforeVisible === afterVisible || !historyManager || historyManager.isApplying) return false;
        historyManager.record({
            name: 'caf-clip-visibility',
            do: () => this._restoreClipVisibilityHistoryState(clipId, afterVisible),
            undo: () => this._restoreClipVisibilityHistoryState(clipId, beforeVisible),
            meta: {
                type: 'caf-clip-visibility',
                clipId,
                visible: afterVisible
            }
        });
        return true;
    }

    _restoreClipVisibilityHistoryState(clipId, visible) {
        const entry = this.model.findClipEntry(clipId);
        if (!entry?.clip) return false;

        entry.clip.visible = visible !== false;
        this._activateClipEntry(entry, { saveCurrent: false });
        this._syncClipAssetToWorkingLayers(entry.clip);
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    /**
     * 外部UI（レイヤーパネル等）からクリップ・アセットを選択する (Phase 4z16)
     */
    selectClipAssetFromExternal(clipId, options = {}) {
        const entry = this.model.findClipEntry(clipId);
        if (!entry) return { ok: false, reason: 'clip-not-found' };

        const { clip } = entry;

        // 1. クリップ選択
        this._activateClipEntry(entry);

        // 2. アセット関連の選択状態更新
        if (clip.assetId) {
            const asset = this.model.getClipAsset(clip.assetId);
            if (asset) {
                this.selectedAssetId = asset.id;
                this.selectedAssetFolderId = asset.folderId || null;
            } else {
                this.selectedAssetId = null;
                this.selectedAssetFolderId = null;
            }
        } else {
            this.selectedAssetId = null;
            this.selectedAssetFolderId = null;
        }

        // 3. 再描画
        this.render();

        return { ok: true, clip, assetId: clip.assetId };
    }

    _activateClipEntry(entry, options = {}) {
        if (!entry?.clip) return false;
        if (this.selectedCelId !== entry.clip.id && options.saveCurrent !== false) {
            this._saveSelectedClipFromWorkingLayers();
        }
        this.selectedCelId = entry.clip.id;
        this.activeLaneId = entry.lane?.id || this.activeLaneId;
        if (Number.isInteger(entry.clip.startFrame)) {
            this.model.setCurrentFrame(entry.clip.startFrame);
        }
        this.model.tracks.forEach(track => {
            track.active = track.id === this.activeLaneId;
        });
        this._syncClipAssetToWorkingLayers(entry.clip);
        return true;
    }

    _createNextClipAssetFolder() {
        const usedNumbers = new Set();
        this.model.clipAssetFolders.forEach(folder => {
            const match = /^CAF(\d+)$/.exec(folder.name || '');
            if (match) usedNumbers.add(Number(match[1]));
        });
        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) nextNumber += 1;
        const result = this.model.createClipAssetFolder({ name: `CAF${nextNumber}` });
        return result.ok ? result.folder : null;
    }

    _isRasterSnapshotBlank(snapshot) {
        const pixels = snapshot?.pixels;
        if (!pixels || typeof pixels.length !== 'number') return true;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] !== 0) return false;
        }
        return true;
    }

    _getVisibleRasterLayersForClipAsset() {
        return this._getRasterWorkingLayers().filter(layer => {
            const layerData = layer?.layerData;
            return layerData?.visible !== false;
        });
    }

    _getDrawableInternalLayers(asset) {
        return (asset?.internalLayers || []).filter(layer => {
            return layer && layer.type !== 'folder' && layer.isBackground !== true;
        });
    }

    _getVisibleLayerItemsForClipAsset(options = {}) {
        if (!this.layerSystem) return [];
        const workingLayers = this._getRasterWorkingLayers();
        if (workingLayers.some(layer => layer.layerData?.isAnimationWorkingLayer === true)) {
            const maxCount = Number.isInteger(options.maxWorkingLayerCount)
                ? Math.max(0, options.maxWorkingLayerCount)
                : workingLayers.length;
            return workingLayers.slice(0, maxCount);
        }

        const layers = this.layerSystem.getLayers() || [];
        return [...layers].reverse().filter(layer => {
            const layerData = layer?.layerData;
            if (!layerData || layerData.isBackground) return false;
            if (layerData.isAnimationWorkingLayer) return false;
            if (layerData.isFolder) return true;
            return !!layerData.renderTexture && layerData.visible !== false;
        });
    }

    _getRasterWorkingLayers() {
        if (!this.layerSystem) return [];
        const layers = this.layerSystem.getLayers() || [];
        const rasterLayers = [...layers].reverse().filter(layer => {
            const layerData = layer?.layerData;
            if (!layerData || layerData.isBackground || layerData.isFolder) return false;
            return !!layerData.renderTexture;
        });
        const animationWorkingLayers = rasterLayers.filter(layer => layer.layerData?.isAnimationWorkingLayer === true);
        return animationWorkingLayers.length > 0 ? animationWorkingLayers : rasterLayers;
    }

    _ensureWorkingLayerCapacity(requiredCount) {
        if (!this.layerSystem || !Number.isFinite(requiredCount) || requiredCount <= 0) return;

        while (this._getRasterWorkingLayers().length < requiredCount) {
            const result = this.layerSystem.createLayer?.();
            if (!result) break;
            if (result.layer?.layerData) {
                result.layer.layerData.isAnimationWorkingLayer = true;
                result.layer.visible = false;
                result.layer.layerData.visible = false;
            }
        }
    }

    _createClipAssetFromVisibleLayers(options = {}) {
        const name = options.name || 'Clip Asset';
        const sourceLayers = this._getVisibleLayerItemsForClipAsset({
            maxWorkingLayerCount: options.maxWorkingLayerCount
        });
        const internalLayers = [];
        const importedLayerIdMap = new Map();
        const pendingParentLinks = [];
        let primarySnapshot = null;
        let primaryRasterSnapshot = null;

        sourceLayers.forEach(layer => {
            const layerData = layer.layerData;
            if (!layerData) return;

            if (layerData.isFolder) {
                const folderLayer = this.model.createClipAssetInternalLayer({
                    name: layerData.name || 'フォルダ',
                    type: 'folder',
                    visible: layerData.visible !== false,
                    opacity: layerData.opacity ?? 1,
                    blendMode: 'normal',
                    parentLayerId: layerData.parentId ? importedLayerIdMap.get(layerData.parentId) || null : null
                });
                importedLayerIdMap.set(layerData.id, folderLayer.id);
                if (layerData.parentId) pendingParentLinks.push({ internalLayer: folderLayer, parentId: layerData.parentId });
                internalLayers.push(folderLayer);
                return;
            }

            const rawSnapshot = this.layerSystem.createLayerRasterSnapshot(layer);
            if (!rawSnapshot) return;

            const drawingSnapshot = new DrawingSnapshotModel({
                width: rawSnapshot.width,
                height: rawSnapshot.height,
                pixels: rawSnapshot.pixels ? new Uint8ClampedArray(rawSnapshot.pixels) : null,
                isBlank: this._isRasterSnapshotBlank(rawSnapshot)
            });
            this.model.drawingSnapshots.push(drawingSnapshot);

            const internalLayer = this.model.createClipAssetInternalLayer({
                name: layerData.name || 'Layer',
                type: 'raster',
                visible: layerData.visible !== false,
                opacity: layerData.opacity ?? 1,
                blendMode: layerData.blendMode || 'normal',
                clipping: layerData.clipping === true,
                parentLayerId: layerData.parentId ? importedLayerIdMap.get(layerData.parentId) || null : null,
                drawingSnapshotId: drawingSnapshot.id
            });
            importedLayerIdMap.set(layerData.id, internalLayer.id);
            if (layerData.parentId) pendingParentLinks.push({ internalLayer, parentId: layerData.parentId });
            internalLayers.push(internalLayer);

            if (!primarySnapshot) {
                primarySnapshot = drawingSnapshot;
                primaryRasterSnapshot = rawSnapshot;
            }
        });

        pendingParentLinks.forEach(({ internalLayer, parentId }) => {
            internalLayer.parentLayerId = importedLayerIdMap.get(parentId) || null;
        });

        if (!primarySnapshot) {
            const size = this._getCanvasSnapshotSize();
            const pixelCount = size.width * size.height * 4;
            primarySnapshot = new DrawingSnapshotModel({
                width: size.width,
                height: size.height,
                pixels: new Uint8ClampedArray(pixelCount),
                isBlank: true
            });
            this.model.drawingSnapshots.push(primarySnapshot);
            internalLayers.push(this.model.createClipAssetInternalLayer({
                name: 'レイヤー1',
                type: 'raster',
                drawingSnapshotId: primarySnapshot.id
            }));
            primaryRasterSnapshot = {
                width: primarySnapshot.width,
                height: primarySnapshot.height,
                pixels: new Uint8ClampedArray(primarySnapshot.pixels)
            };
        }

        const asset = new ClipAssetModel({
            name,
            type: 'raster',
            folderId: options.folderId || null,
            drawingSnapshotId: primarySnapshot.id
        });
        asset.internalLayers = internalLayers;
        this.model.clipAssets.push(asset);

        return { asset, snapshot: primarySnapshot, rasterSnapshot: primaryRasterSnapshot };
    }

    _createBlankRasterSnapshot(layerId = null) {
        const size = this._getCanvasSnapshotSize();
        return {
            layerId,
            width: size.width,
            height: size.height,
            pixels: new Uint8ClampedArray(size.width * size.height * 4),
            pathsData: [],
            paths: []
        };
    }

    _syncClipAssetToWorkingLayers(clip, options = {}) {
        if (!clip?.assetId || !this.layerSystem) return false;
        const asset = this.model.getClipAsset(clip.assetId);
        if (!asset) return false;
        const forceRestore = options.forceRestore === true;

        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const targetLayers = this._getRasterWorkingLayers();
        if (targetLayers.length === 0) return false;
        if (!drawableInternalLayers.some(layer => layer.id === this.selectedInternalLayerId)) {
            this.selectedInternalLayerId = drawableInternalLayers[0]?.id || null;
        }

        drawableInternalLayers.forEach((internalLayer, index) => {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) return;

            const snapshot = this.model.getDrawingSnapshot(internalLayer.drawingSnapshotId);
            const snapshotId = internalLayer.drawingSnapshotId || null;
            if (forceRestore || targetLayer.layerData.animationSnapshotId !== snapshotId) {
                const restoreSnapshot = snapshot
                    ? {
                        ...snapshot,
                        layerId: targetLayer.layerData.id,
                        pathsData: [],
                        paths: []
                    }
                    : this._createBlankRasterSnapshot(targetLayer.layerData.id);

                this.layerSystem.restoreLayerRasterSnapshot(restoreSnapshot);
                targetLayer.layerData.animationSnapshotId = snapshotId;
            }
            targetLayer.layerData.isAnimationWorkingLayer = true;
            targetLayer.layerData.name = internalLayer.name || targetLayer.layerData.name;
            const opacity = internalLayer.opacity ?? 1;
            const blendMode = internalLayer.blendMode || 'normal';
            targetLayer.alpha = opacity;
            targetLayer.blendMode = blendMode;
            if (targetLayer.layerData.layerSprite) {
                targetLayer.layerData.layerSprite.blendMode = blendMode;
            }
            targetLayer.layerData.opacity = opacity;
            targetLayer.layerData.blendMode = blendMode;
            targetLayer.layerData.clipping = internalLayer.clipping === true;
            targetLayer.layerData.parentId = internalLayer.parentLayerId || null;
            const isEffectivelyVisible = clip.visible !== false
                && this._isInternalLayerEffectivelyVisible(asset, internalLayer);
            targetLayer.visible = isEffectivelyVisible;
            targetLayer.layerData.visible = isEffectivelyVisible;
        });

        for (let index = drawableInternalLayers.length; index < targetLayers.length; index++) {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) continue;
            if (forceRestore || targetLayer.layerData.animationSnapshotId !== null) {
                this.layerSystem.restoreLayerRasterSnapshot(this._createBlankRasterSnapshot(targetLayer.layerData.id));
                targetLayer.layerData.animationSnapshotId = null;
            }
            targetLayer.layerData.isAnimationWorkingLayer = true;
            targetLayer.layerData.parentId = null;
            targetLayer.visible = false;
            targetLayer.layerData.visible = false;
        }

        this.layerSystem.refreshClippingMasks?.();
        this._syncActiveWorkingLayerToSelectedInternalLayer(asset);
        this._requestLayerPanelSync();
        return true;
    }

    _markWorkingLayerSnapshotIds(asset) {
        if (!asset || !this.layerSystem) return;

        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const targetLayers = this._getRasterWorkingLayers();
        drawableInternalLayers.forEach((internalLayer, index) => {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) return;
            targetLayer.layerData.animationSnapshotId = internalLayer.drawingSnapshotId || null;
        });
    }

    _invalidateWorkingLayerSnapshotId(layerId) {
        if (!layerId || !this.layerSystem) return;
        const layer = (this.layerSystem.getLayers?.() || []).find(candidate => candidate.layerData?.id === layerId);
        if (layer?.layerData) {
            layer.layerData.animationSnapshotId = null;
        }
    }

    _syncActiveWorkingLayerToSelectedInternalLayer(asset = null) {
        if (!this.layerSystem) return false;
        const targetAsset = asset || this._getSelectedAssetForInspector();
        if (!targetAsset || !this.selectedInternalLayerId) return false;

        const drawableInternalLayers = this._getDrawableInternalLayers(targetAsset);
        const internalIndex = drawableInternalLayers.findIndex(layer => layer.id === this.selectedInternalLayerId);
        if (internalIndex < 0) return false;

        const targetLayer = this._getRasterWorkingLayers()[internalIndex];
        if (!targetLayer) return false;

        const layerIndex = this.layerSystem.getLayerIndex
            ? this.layerSystem.getLayerIndex(targetLayer)
            : (this.layerSystem.getLayers() || []).indexOf(targetLayer);
        if (layerIndex < 0 || !this.layerSystem.setActiveLayer) return false;

        this.layerSystem.setActiveLayer(layerIndex);
        return true;
    }

    _syncSelectedInternalLayerFromActiveWorkingLayer(layerIndex = null) {
        if (!this.layerSystem || !this.selectedCelId) return false;
        const asset = this._getSelectedAssetForInspector();
        if (!asset?.internalLayers?.length) return false;

        const layers = this.layerSystem.getLayers() || [];
        const activeIndex = Number.isInteger(layerIndex)
            ? layerIndex
            : (this.layerSystem.activeLayerIndex ?? this.layerSystem.currentLayerIndex);
        const activeLayer = layers[activeIndex];
        if (!activeLayer?.layerData?.isAnimationWorkingLayer) return false;

        const workingLayers = this._getRasterWorkingLayers();
        const internalIndex = workingLayers.indexOf(activeLayer);
        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        if (internalIndex < 0 || internalIndex >= drawableInternalLayers.length) return false;

        const nextLayerId = drawableInternalLayers[internalIndex]?.id || null;
        if (!nextLayerId || nextLayerId === this.selectedInternalLayerId) return false;

        this.selectedInternalLayerId = nextLayerId;
        this._requestLayerPanelSync();
        return true;
    }

    _syncSelectedInternalLayerAttributesFromWorkingLayer(layerIndex = null) {
        if (!this.layerSystem || !this.selectedCelId) return false;
        const asset = this._getSelectedAssetForInspector();
        if (!asset?.internalLayers?.length) return false;

        const layers = this.layerSystem.getLayers() || [];
        const activeIndex = Number.isInteger(layerIndex)
            ? layerIndex
            : (this.layerSystem.activeLayerIndex ?? this.layerSystem.currentLayerIndex);
        const activeLayer = layers[activeIndex];
        if (!activeLayer?.layerData?.isAnimationWorkingLayer) return false;

        const workingLayers = this._getRasterWorkingLayers();
        const internalIndex = workingLayers.indexOf(activeLayer);
        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const internalLayer = drawableInternalLayers[internalIndex];
        if (!internalLayer) return false;

        internalLayer.opacity = activeLayer.layerData.opacity ?? 1;
        internalLayer.blendMode = activeLayer.layerData.blendMode || 'normal';
        internalLayer.clipping = activeLayer.layerData.clipping === true;
        internalLayer.updatedAt = Date.now();
        asset.updatedAt = Date.now();

        if (this.selectedInternalLayerId !== internalLayer.id) {
            this.selectedInternalLayerId = internalLayer.id;
        }
        this._scheduleInternalLayerAttributePreviewSync();
        return true;
    }

    _scheduleInternalLayerAttributePreviewSync() {
        if (this._attributePreviewSyncFrame !== null) return;

        this._attributePreviewSyncFrame = requestAnimationFrame(() => {
            this._attributePreviewSyncFrame = null;
            if (this.isVisible && this.isPreviewActive) {
                this.render();
            }
            this._requestLayerPanelSync();
        });
    }

    _syncSelectedClipToWorkingLayers(options = {}) {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.clip) return false;
        return this._syncClipAssetToWorkingLayers(entry.clip, options);
    }

    _clearWorkingLayersForEmptyFrame() {
        const targetLayers = this._getRasterWorkingLayers();
        if (targetLayers.length === 0 || !this.layerSystem) return false;

        targetLayers.forEach((targetLayer, index) => {
            if (!targetLayer?.layerData) return;
            this.layerSystem.restoreLayerRasterSnapshot(this._createBlankRasterSnapshot(targetLayer.layerData.id));
            targetLayer.layerData.isAnimationWorkingLayer = true;
            targetLayer.layerData.animationSnapshotId = null;
            targetLayer.layerData.name = index === 0 ? 'レイヤー1' : targetLayer.layerData.name;
            targetLayer.layerData.opacity = 1;
            targetLayer.layerData.blendMode = 'normal';
            targetLayer.layerData.parentId = null;
            targetLayer.visible = false;
            targetLayer.layerData.visible = false;
        });

        this._requestLayerPanelSync();
        return true;
    }

    _syncWorkingLayersForCurrentFrame() {
        const lane = this.activeLaneId
            ? this.model.tracks.find(track => track.id === this.activeLaneId)
            : null;
        const frameIndex = this.model.playback.currentFrame;
        const clip = lane?.getCelAtFrame ? lane.getCelAtFrame(frameIndex) : null;

        if (clip) {
            this.selectedCelId = clip.id;
            this.selectedAssetId = clip.assetId || null;
            const asset = clip.assetId ? this.model.getClipAsset(clip.assetId) : null;
            this.selectedAssetFolderId = asset?.folderId || null;
            this.selectedInternalLayerId = null;
            this._syncClipAssetToWorkingLayers(clip);
            return true;
        }

        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedInternalLayerId = null;
        this._clearWorkingLayersForEmptyFrame();
        return false;
    }

    _moveActiveLaneBy(delta) {
        const lanes = this.model.tracks.filter(track => track.type !== 'folder' && !track.isBackground);
        if (lanes.length === 0) return false;

        const currentIndex = Math.max(0, lanes.findIndex(lane => lane.id === this.activeLaneId));
        const nextIndex = Math.max(0, Math.min(lanes.length - 1, currentIndex + delta));
        const nextLane = lanes[nextIndex];
        if (!nextLane || nextLane.id === this.activeLaneId) return false;

        this._saveSelectedClipFromWorkingLayers();
        this._setActiveLane(nextLane.id);
        this._syncWorkingLayersForCurrentFrame();
        this.render();
        this._requestLayerPanelSync();
        return true;
    }

    _setActiveLane(laneId) {
        if (!laneId) return false;
        const lane = this.model.tracks.find(track => track.id === laneId);
        if (!lane || lane.type === 'folder' || lane.isBackground) return false;

        this.activeLaneId = lane.id;
        this.model.tracks.forEach(track => {
            track.active = track.id === lane.id;
        });
        return true;
    }

    render() {
        if (!this.panel || !this.isVisible) return;
        
        // 【重要】モデルを LayerSystem と同期（暫定接続）
        const layers = this.layerSystem?.getLayers() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex() || 0;
        this.model.syncWithLayers(layers, activeIndex);

        // Phase 4z5: 初回表示時に既存描画をClipAsset化
        if (!this.initialClipAssetSeeded) {
            this._ensureInitialClipAssetSeed();
        }

        const trackList = this.panel.querySelector('.anim-track-list');
        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        
        // パネル全体の編集状態クラス
        this.panel.classList.toggle('clip-edit-active', this.isClipEditModeActive);
        
        // UI上のチェック状態同期
        const editChk = this.panel.querySelector('#anim-clip-edit-chk');
        if (editChk) {
            editChk.checked = this.isClipEditModeActive;
            editChk.disabled = !this.selectedCelId || !this._getSelectedClipSourceLayerId();
        }

        // Scopeボタンの表示同期
        const allBtn = this.panel.querySelector('#anim-scope-all-btn');
        const laneBtn = this.panel.querySelector('#anim-scope-lane-btn');
        const setBtn = this.panel.querySelector('#anim-scope-set-btn');
        if (allBtn && laneBtn && setBtn) {
            allBtn.classList.toggle('active', this.playbackScope === 'all');
            laneBtn.classList.toggle('active', this.playbackScope === 'activeLane');
            setBtn.classList.toggle('active', this.playbackScope === 'includedLanes');
        }

        // ASSETSボタンの状態
        const assetsBtn = this.panel.querySelector('#anim-assets-toggle-btn');
        if (assetsBtn) {
            assetsBtn.classList.toggle('active', this.isAssetLibraryVisible);
        }

        const libraryPanel = this.panel.querySelector('#anim-asset-library');
        if (libraryPanel) {
            libraryPanel.classList.toggle('is-visible', this.isAssetLibraryVisible);
            if (this.isAssetLibraryVisible) {
                this._renderAssetLibrary(libraryPanel);
            }
        }

        if (trackList) {
            let trackHtml = `
                <div class="anim-track-header">
                    <span>LANES</span>
                    <button class="anim-lane-add-btn" title="Add independent animation Lane">+</button>
                </div>`;
            let visibleLaneIndex = 0;
            this.model.tracks.forEach((track, trackIndex) => {
                if (track.isBackground || track.type === 'folder') return;
                const activeClass = (track.active || track.id === this.activeLaneId) ? ' active' : '';
                const typeClass = track.type === 'folder' ? ' is-folder' : '';
                
                // Phase 4z2: includeボタンの追加
                const isIncluded = this.includedLaneIds.has(track.id);
                const includeActive = isIncluded ? ' active' : '';
                const includeTitle = isIncluded ? 'このLaneをSET再生対象から外す' : 'このLaneをSET再生対象に含める';
                const includeBtn = (track.type === 'folder' || track.isBackground) ? '' :
                    `<button class="anim-lane-include-btn${includeActive}" data-lane-id="${track.id}" title="${includeTitle}">${isIncluded ? '✓' : '+'}</button>`;

                const displayIndex = (track.type === 'folder' || track.isBackground) ? null : visibleLaneIndex++;
                const displayName = this.model.getLaneDisplayName
                    ? this.model.getLaneDisplayName(track, displayIndex)
                    : (track.name || `Lane ${trackIndex + 1}`);

                trackHtml += `
                    <div class="anim-track-item${activeClass}${typeClass}" data-track-id="${track.id}">
                        ${includeBtn}
                        <span class="anim-track-name">${this._escapeHtml(displayName)}</span>
                    </div>`;
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
                if (track.isBackground || track.type === 'folder') return;
                const activeClass = (track.active || track.id === this.activeLaneId) ? ' active' : '';
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

                    const snapshot = cel ? this.model.getSnapshotForCel(cel) : null;
                    const hasSnapshot = !!snapshot && snapshot.isBlank !== true;
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
        if (this.isClipEditModeActive || this.isTransformPreviewSuspended || this.isDrawingPreviewSuspended) {
            // EDITモード中は合成を停止し、実レイヤー描画を優先
            this._restoreVisibility();
        } else if (this.isPreviewActive) {
            this._applyVisibilityPreview();
        } else {
            this._restoreVisibility();
        }

        window.timelineUI?.updateLayerPanelIndicator?.();
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
                    <div class="anim-scope-controls" title="プレビュー/再生対象を切り替え">
                        <span class="anim-control-label">SCOPE:</span>
                        <button class="anim-scope-btn" id="anim-scope-all-btn" title="全Laneをプレビュー/再生">ALL</button>
                        <button class="anim-scope-btn" id="anim-scope-lane-btn" title="アクティブLaneのみプレビュー/再生">LANE</button>
                        <button class="anim-scope-btn" id="anim-scope-set-btn" title="チェックしたLaneのみプレビュー/再生">SET</button>
                    </div>
                    <label class="anim-preview-toggle" title="キャンバス表示をタイムラインに連動させる">
                        <input type="checkbox" id="anim-preview-chk" ${this.isPreviewActive ? 'checked' : ''}> PREVIEW
                    </label>
                    <label class="anim-preview-toggle" title="前後フレームを薄く表示">
                        <input type="checkbox" id="anim-onion-chk" ${this.isOnionSkinActive ? 'checked' : ''}> ONION
                    </label>
                </div>
                <div class="anim-table-header-center">
                    <div class="anim-duration-controls">
                        <span class="anim-control-label">DURATION:</span>
                        <button class="anim-tool-btn" id="anim-duration-dec" title="Decrease Duration">-</button>
                        <button class="anim-tool-btn" id="anim-duration-inc" title="Increase Duration">+</button>
                    </div>
                    <div class="anim-copy-paste-controls">
                        <button class="anim-tool-btn anim-copy-btn anim-icon-btn" id="anim-copy-btn" title="選択セルをコピー" aria-label="Copy selected clip">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M16 4h2a2 2 0 0 1 2 2v4"/><path d="M21 14H11"/><path d="m15 10-4 4 4 4"/></svg>
                        </button>
                        <button class="anim-tool-btn anim-paste-btn anim-icon-btn" id="anim-paste-btn" title="コピーした内容を貼り付け" aria-label="Paste copied clip">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 14h10"/><path d="M16 4h2a2 2 0 0 1 2 2v1.344"/><path d="m17 18 4-4-4-4"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                        </button>
                    </div>
                </div>
                <div class="anim-table-header-right">
                    <button class="anim-tool-btn anim-assets-toggle-btn" id="anim-assets-toggle-btn" title="Asset Libraryを表示/非表示">LIB</button>
                    <button class="ui-close-button ui-close-button--small" id="anim-table-close-btn" title="閉じる">×</button>
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
            <div class="anim-asset-library" id="anim-asset-library">
                <!-- Library content will be rendered here -->
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        this._setupPanelEvents();
    }

    _renderAssetLibrary(container) {
        if (!container) return;

        // 1. フォルダ一覧の生成 (Phase 4z11: 件数表示追加)
        const uncategorizedCount = this.model.getClipAssetsInFolder(null).length;
        let folderHtml = `
            <div class="anim-lib-folder-item${this.selectedAssetFolderId === null ? ' selected' : ''}" data-folder-id="uncategorized">
                <span class="anim-lib-folder-name">Uncategorized</span>
                <span class="anim-lib-folder-count">${uncategorizedCount}</span>
            </div>`;
        
        this.model.clipAssetFolders.forEach(folder => {
            const isSelected = this.selectedAssetFolderId === folder.id;
            const count = this.model.getClipAssetsInFolder(folder.id).length;
            folderHtml += `
                <div class="anim-lib-folder-item${isSelected ? ' selected' : ''}" data-folder-id="${folder.id}">
                    <span class="anim-lib-folder-name">${this._escapeHtml(folder.name)}</span>
                    <span class="anim-lib-folder-count">${count}</span>
                </div>`;
        });

        // 2. アセット一覧の生成
        const assets = this.model.getClipAssetsInFolder(this.selectedAssetFolderId);
        let assetHtml = '';
        
        // 現在選択中のClipが参照しているAssetを特定
        const currentClipAssetId = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId)?.clip?.assetId : null;

        if (assets.length === 0) {
            assetHtml = '<div class="anim-lib-empty">No assets</div>';
        } else {
            assets.forEach(asset => {
                const isSelected = this.selectedAssetId === asset.id;
                const isCurrent = asset.id === currentClipAssetId;
                const refCount = this.model.countAssetReferences(asset.id);
                
                const snapshot = this.model.getDrawingSnapshot(asset.drawingSnapshotId);
                const isBlank = snapshot?.isBlank === true;
                
                assetHtml += `
                    <div class="anim-lib-asset-item${isSelected ? ' selected' : ''}${isCurrent ? ' current' : ''}" data-asset-id="${asset.id}">
                        <span class="anim-lib-asset-name">${this._escapeHtml(asset.name)}</span>
                        <div class="anim-lib-asset-meta">
                            ${isBlank ? '<span class="blank-tag">Blank</span>' : ''}
                            <span class="layer-count">L:${asset.internalLayers.length}</span>
                            <span class="ref-count">Refs: ${refCount}</span>
                        </div>
                    </div>`;
            });
        }

        container.innerHTML = `
            <div class="anim-lib-folders">
                <div class="anim-lib-label">
                    ASSET FOLDERS
                    <div class="anim-lib-folder-actions">
                        <button class="anim-folder-add-btn" title="Create asset folder">+</button>
                        <button class="anim-folder-rename-btn" title="Rename selected folder" ${this.selectedAssetFolderId === null ? 'disabled' : ''}>✎</button>
                    </div>
                </div>
                <div class="anim-lib-list ui-scrollbar">${folderHtml}</div>
            </div>
            <div class="anim-lib-assets">
                <div class="anim-lib-label">
                    ASSETS
                    <button class="anim-asset-move-btn" title="Move selected asset to folder" ${!this.selectedAssetId ? 'disabled' : ''}>MOVE</button>
                </div>
                <div class="anim-lib-list ui-scrollbar">${assetHtml}</div>
            </div>
            <div class="anim-internal-layer-inspector" id="anim-internal-layer-inspector">
                <!-- Internal layers will be rendered here -->
            </div>
        `;

        // 3. 内部レイヤー Inspector の描画 (Phase 4z7)
        const selectedAsset = this._getSelectedAssetForInspector();
        const inspectorContainer = container.querySelector('#anim-internal-layer-inspector');
        if (inspectorContainer) {
            this._renderInternalLayerInspector(inspectorContainer, selectedAsset);
        }
    }

    _ensureInitialClipAssetSeed() {
        if (this.initialClipAssetSeeded) return;
        if (!this.layerSystem) return;

        // 1. 同期済みのモデルから、シード対象のLaneを特定
        // 優先度: アクティブな通常Lane > 最初の通常Lane
        let targetLane = null;
        const tracks = this.model.tracks;

        const activeLayer = this.layerSystem.getActiveLayer();
        const activeLayerId = activeLayer?.layerData?.id || activeLayer?.id;
        
        if (activeLayerId) {
            targetLane = tracks.find(t => {
                if (t.type === 'folder') return false;
                const layer = this.layerSystem.getLayers().find(l => l.layerData?.id === (t.sourceLayerId || t.layerId));
                if (layer?.layerData?.isBackground || layer?.layerData?.isFolder) return false;
                return (t.sourceLayerId || t.layerId) === activeLayerId;
            });
        }

        if (!targetLane) {
            targetLane = tracks.find(t => {
                if (t.type === 'folder') return false;
                const layer = this.layerSystem.getLayers().find(l => l.layerData?.id === (t.sourceLayerId || t.layerId));
                return layer?.layerData && !layer.layerData.isBackground && !layer.layerData.isFolder;
            });
        }

        // 対象Laneがない、または背景Laneならスキップ
        if (!targetLane) return;

        const layers = this.layerSystem.getLayers();
        const sourceLayer = layers.find(l => l.layerData?.id === (targetLane.sourceLayerId || targetLane.layerId));
        if (!sourceLayer || sourceLayer.layerData?.isBackground) return;

        // 2. 重複チェック: すでにFrame 0（1コマ目）にClipがある場合は何もしない
        if (targetLane.getCelAtFrame(0)) {
            this.initialClipAssetSeeded = true;
            return;
        }

        // 3. 現在表示中の通常レイヤーZ軸を、1つのClipAsset内部Layer構造として取り込む
        const cafFolder = this._createNextClipAssetFolder();
        const { asset, rasterSnapshot } = this._createClipAssetFromVisibleLayers({
            name: `${this.model.getLaneDisplayName ? this.model.getLaneDisplayName(targetLane) : targetLane.name} Frame 1`,
            folderId: cafFolder?.id || null
        });

        const newClip = targetLane.addCel({
            sourceLayerId: targetLane.sourceLayerId,
            layerId: targetLane.layerId,
            assetId: asset.id,
            startFrame: 0,
            duration: 1,
            rasterSnapshot // 互換用
        });

        if (newClip) {
            // 自動作成されたクリップを選択状態にする
            this.selectedCelId = newClip.id;
            this.activeLaneId = targetLane.id;
            this._syncClipAssetToWorkingLayers(newClip);
        }

        this.initialClipAssetSeeded = true;
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

        const assetsToggleBtn = this.panel.querySelector('#anim-assets-toggle-btn');
        if (assetsToggleBtn) {
            assetsToggleBtn.addEventListener('click', () => {
                this.isAssetLibraryVisible = !this.isAssetLibraryVisible;
                this.render();
            });
        }

        // Phase 4z4: Asset Library クリックイベント (委譲)
        const libraryPanel = this.panel.querySelector('#anim-asset-library');
        if (libraryPanel) {
            libraryPanel.addEventListener('click', (e) => {
                // フォルダ作成 (Phase 4z11)
                if (e.target.closest('.anim-folder-add-btn')) {
                    this.createAssetFolder();
                    return;
                }
                // フォルダリネーム (Phase 4z11)
                if (e.target.closest('.anim-folder-rename-btn')) {
                    this.renameSelectedAssetFolder();
                    return;
                }
                // アセット移動 (Phase 4z11)
                if (e.target.closest('.anim-asset-move-btn')) {
                    this.moveSelectedAssetToFolder();
                    return;
                }

                // フォルダ選択
                const folderItem = e.target.closest('.anim-lib-folder-item');
                if (folderItem) {
                    const fid = folderItem.dataset.folderId;
                    const nextFolderId = fid === 'uncategorized' ? null : fid;

                    if (this.selectedAssetFolderId !== nextFolderId) {
                        this.selectedAssetFolderId = nextFolderId;

                        // フォルダ切り替え時に、現在の選択中Assetが移動先フォルダにないならクリア
                        const assetsInFolder = this.model.getClipAssetsInFolder(this.selectedAssetFolderId);
                        if (!assetsInFolder.some(a => a.id === this.selectedAssetId)) {
                            this.selectedAssetId = null;
                            this.selectedInternalLayerId = null;
                        }
                        this.render();
                    }
                    return;
                }
                
                // アセット選択
                const assetItem = e.target.closest('.anim-lib-asset-item');
                if (assetItem) {
                    this.selectedAssetId = assetItem.dataset.assetId;
                    this.selectedInternalLayerId = null; // アセット切り替えで内部レイヤー選択クリア
                    this.render();
                    return;
                }

                // 内部レイヤー選択 (Phase 4z7)
                const internalLayerItem = e.target.closest('.anim-internal-layer-row');
                if (internalLayerItem) {
                    const layerId = internalLayerItem.dataset.layerId;

                    // アクションボタンの判定
                    if (e.target.closest('.anim-layer-visibility-btn')) {
                        this.toggleInternalLayerVisibility(layerId);
                        return;
                    }
                    if (e.target.closest('.anim-layer-rename-btn')) {
                        this.renameInternalLayer(layerId);
                        return;
                    }
                    if (e.target.closest('.anim-layer-delete-btn')) {
                        this.removeInternalLayer(layerId);
                        return;
                    }
                    if (e.target.closest('.anim-layer-order-btn.up')) {
                        this.moveInternalLayer(layerId, 'up');
                        return;
                    }
                    if (e.target.closest('.anim-layer-order-btn.down')) {
                        this.moveInternalLayer(layerId, 'down');
                        return;
                    }

                    // 通常選択
                    this.selectedInternalLayerId = layerId;
                    this._syncActiveWorkingLayerToSelectedInternalLayer();
                    this.render();
                    return;
                }

                // 内部レイヤー追加 (Phase 4z8)
                if (e.target.closest('.anim-layer-add-btn')) {
                    this.addInternalLayer();
                    return;
                }
            });
        }

        const previewChk = this.panel.querySelector('#anim-preview-chk');
        if (previewChk) {
            previewChk.addEventListener('change', (e) => {
                this.isPreviewActive = e.target.checked;
                e.target.blur();
                this.render();
            });
        }

        const onionChk = this.panel.querySelector('#anim-onion-chk');
        if (onionChk) {
            onionChk.addEventListener('change', (e) => {
                this.isOnionSkinActive = e.target.checked;
                e.target.blur();
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

        const copyBtn = this.panel.querySelector('#anim-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copySelectedCel());
        }

        const pasteBtn = this.panel.querySelector('#anim-paste-btn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => this.pasteCopiedCel());
        }

        const scopeAllBtn = this.panel.querySelector('#anim-scope-all-btn');
        const scopeLaneBtn = this.panel.querySelector('#anim-scope-lane-btn');
        const scopeSetBtn = this.panel.querySelector('#anim-scope-set-btn');
        if (scopeAllBtn) {
            scopeAllBtn.addEventListener('click', () => {
                this.playbackScope = 'all';
                this.render();
            });
        }
        if (scopeLaneBtn) {
            scopeLaneBtn.addEventListener('click', () => {
                this.playbackScope = 'activeLane';
                this.render();
            });
        }
        if (scopeSetBtn) {
            scopeSetBtn.addEventListener('click', () => {
                this.playbackScope = 'includedLanes';
                this.render();
            });
        }

        // Phase 4z2: Lane include ボタン (イベント委譲)
        const trackList = this.panel.querySelector('.anim-track-list');
        if (trackList) {
            trackList.addEventListener('click', (e) => {
                if (e.target.closest('.anim-lane-add-btn')) {
                    this.addIndependentLane();
                    e.stopPropagation();
                    return;
                }

                const includeBtn = e.target.closest('.anim-lane-include-btn');
                if (includeBtn) {
                    const laneId = includeBtn.dataset.laneId;
                    if (this.includedLaneIds.has(laneId)) {
                        this.includedLaneIds.delete(laneId);
                    } else {
                        this.includedLaneIds.add(laneId);
                    }
                    this.render();
                    e.stopPropagation();
                }
            });
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
                    this._saveSelectedClipFromWorkingLayers();
                    this.model.setCurrentFrame(frameIndex);
                    this._syncWorkingLayersForCurrentFrame();
                    this.render();
                    this._requestLayerPanelSync();
                    return;
                }

                // セルスロットクリック
                const slot = e.target.closest('.anim-cell-slot');
                if (!slot) return;

                const trackId = slot.dataset.trackId;
                const frameIndex = parseInt(slot.dataset.frameIndex, 10);
                const track = this.model.tracks.find(t => t.id === trackId);
                if (!track) return;
                this._setActiveLane(track.id);

                // フォルダトラックはセル配置不可
                if (track.type === 'folder' || track.isBackground) return;

                const existingCel = track.getCelAtFrame(frameIndex);

                // Alt+Click でClipを作成/削除する。通常クリックは選択/Frame移動のみ。
                if (e.altKey) {
                    this._saveSelectedClipFromWorkingLayers();
                    const beforeState = this._captureTimelineHistoryState();
                    if (existingCel) {
                        const removedCelId = existingCel.id;
                        const removedAssetId = existingCel.assetId || null;
                        if (this.selectedCelId === existingCel.id) this.selectedCelId = null;
                        track.removeCelAtFrame(existingCel.startFrame);
                        this._syncWorkingLayersForCurrentFrame();
                        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-delete', {
                            type: 'caf-clip-delete',
                            clipId: removedCelId,
                            assetId: removedAssetId,
                            laneId: track.id,
                            frameIndex
                        });
                    } else {
                        // 新規Frame/LaneのClipは空のClipAssetから始める。
                        const size = this._getCanvasSnapshotSize();
                        const cafFolder = this._createNextClipAssetFolder();
                        const { asset, snapshot } = this.model.createBlankClipAsset({
                            width: size.width,
                            height: size.height,
                            name: `Asset for ${this.model.getLaneDisplayName ? this.model.getLaneDisplayName(track) : track.name}`,
                            folderId: cafFolder?.id || null
                        });

                        const newCel = track.addCel({
                            sourceLayerId: track.sourceLayerId,
                            layerId: track.layerId,
                            assetId: asset.id,
                            startFrame: frameIndex,
                            duration: 1,
                            // 互換用にも代表スナップショットを保持
                            rasterSnapshot: {
                                width: snapshot.width,
                                height: snapshot.height,
                                pixels: snapshot.pixels ? new Uint8ClampedArray(snapshot.pixels) : null
                            }
                        });
                        if (newCel) {
                            this._activateClipEntry({ lane: track, track, clip: newCel }, { saveCurrent: false });
                            this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-create', {
                                type: 'caf-clip-create',
                                clipId: newCel.id,
                                assetId: asset.id,
                                laneId: track.id,
                                frameIndex
                            });
                        }
                    }
                } else {
                    // 通常クリック：既存Clipの選択、またはFrame移動。空セルのClip作成はAlt+Clickに限定する。
                    if (existingCel) {
                        this._activateClipEntry({ lane: track, track, clip: existingCel });
                    } else {
                        this._saveSelectedClipFromWorkingLayers();
                        this.model.setCurrentFrame(frameIndex);
                        this._syncWorkingLayersForCurrentFrame();
                    }
                }

                this.render();
                this._requestLayerPanelSync();
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

                        this._activateClipEntry(entry);
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
                    
                    this._activateClipEntry(entry);
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
            if (e.target.closest('button, input, label, .anim-scope-controls, .anim-duration-controls, .anim-capture-controls, .anim-copy-paste-controls')) return;
            
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
                this._requestLayerPanelSync(); // Phase 4z21
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
                    if (result.ok) {
                        this.selectedCelId = result.clip.id;
                        this.activeLaneId = result.lane.id;
                        this.model.setCurrentFrame(result.clip.startFrame);
                        this.model.tracks.forEach(track => {
                            track.active = track.id === result.lane.id;
                        });
                        this._syncClipAssetToWorkingLayers(result.clip);
                    }
                }
            }

            this._isClipMoving = false;
            this._clipMoveData = null;
            document.removeEventListener('mousemove', this._onClipMoveMouseMove);
            document.removeEventListener('mouseup', this._onClipMoveMouseUp);
            
            // 少し遅延させてからフラグを下ろす（click誤爆防止）
            setTimeout(() => {
                this.render();
                this._requestLayerPanelSync();
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
                this._requestLayerPanelSync();
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
                background: rgba(255, 255, 238, 0.92);
                backdrop-filter: blur(10px);
                border: 2px solid rgba(128, 0, 0, 0.75);
                border-radius: 8px;
                box-shadow: 0 10px 28px rgba(128, 0, 0, 0.14);
                overflow: hidden;
            }

            .anim-table-header {
                padding: 6px 12px;
                background: rgba(255, 251, 230, 0.96);
                color: var(--futaba-maroon);
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
                font-weight: bold;
                cursor: move;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(128, 0, 0, 0.2);
                gap: 10px;
            }

            .anim-table-header-left,
            .anim-table-header-center,
            .anim-table-header-right {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }

            .anim-table-header-left {
                flex: 0 1 auto;
            }

            .anim-table-header-center {
                flex: 1 1 auto;
                justify-content: center;
            }

            .anim-table-header-right {
                justify-content: flex-end;
                flex-shrink: 0;
                padding-right: 2px;
            }

            #anim-table-close-btn {
                position: static;
                flex-shrink: 0;
            }

            .anim-duration-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(128, 0, 0, 0.08);
                padding: 2px 8px;
                border-radius: 20px;
            }

            .anim-control-label {
                font-size: 9px;
                opacity: 0.75;
                margin-right: 4px;
            }

            .anim-tool-btn {
                background: rgba(255,255,255,0.55);
                border: 1px solid rgba(128, 0, 0, 0.28);
                color: var(--futaba-maroon);
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
                background: rgba(255,255,255,0.9);
                border-color: rgba(255, 102, 0, 0.8);
            }

            .anim-tool-btn:active {
                background: #ff6600;
                border-color: #ff6600;
            }

            .anim-tool-btn:disabled {
                opacity: 0.3;
                cursor: not-allowed;
                background: rgba(255,255,255,0.25);
            }

            .anim-play-btn {
                margin-right: 4px;
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
                margin-left: 6px;
                font-size: 9px;
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                opacity: 0.8;
                color: var(--futaba-maroon);
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
                margin-left: 6px;
                display: flex;
                align-items: center;
                gap: 3px;
            }

            .anim-icon-btn svg {
                width: 14px;
                height: 14px;
                stroke: currentColor;
                stroke-width: 2;
                fill: none;
            }

            .anim-scope-controls {
                margin-left: 6px;
                display: flex;
                align-items: center;
                gap: 2px;
                background: rgba(128,0,0,0.06);
                padding: 2px;
                border-radius: 4px;
            }

            .anim-scope-btn {
                background: transparent;
                border: none;
                color: var(--futaba-maroon);
                font-size: 8px;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                opacity: 0.6;
            }

            .anim-scope-btn:hover {
                opacity: 0.9;
                background: rgba(128,0,0,0.08);
            }

            .anim-scope-btn.active {
                opacity: 1;
                background: rgba(255, 102, 0, 0.18);
                font-weight: bold;
                color: var(--futaba-maroon);
            }

            .anim-assets-toggle-btn {
                width: auto;
                min-width: 30px;
                padding: 0 6px;
                font-size: 8px;
                line-height: 1;
            }

            .anim-table-viewport {
                flex: 1;
                overflow: auto;
                background: rgba(128, 0, 0, 0.02);
            }

            .anim-asset-library {
                height: 120px;
                border-top: 2px solid var(--futaba-maroon);
                background: rgba(0,0,0,0.05);
                display: none;
                font-size: 10px;
            }

            .anim-asset-library.is-visible {
                display: flex;
            }

            .anim-lib-folders {
                width: 120px;
                border-right: 1px solid rgba(128, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
            }

            .anim-lib-assets {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 150px;
            }

            .anim-internal-layer-inspector {
                width: 240px;
                border-left: 1px solid rgba(128, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
                background: rgba(0, 0, 0, 0.03);
            }

            .anim-internal-layer-list {
                flex: 1;
                overflow-y: auto;
                padding: 4px 0;
            }

            .anim-internal-layer-row {
                padding: 6px 12px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                border-bottom: 1px solid rgba(128, 0, 0, 0.05);
                cursor: pointer;
            }

            .anim-internal-layer-row.depth-1 {
                padding-left: 24px;
            }

            .anim-internal-layer-row.depth-2 {
                padding-left: 36px;
            }

            .anim-internal-layer-row.depth-3,
            .anim-internal-layer-row.depth-4 {
                padding-left: 48px;
            }

            .anim-internal-layer-row.is-folder {
                background: rgba(240, 224, 214, 0.35);
            }

            .anim-internal-layer-row:hover {
                background: rgba(255, 102, 0, 0.05);
            }

            .anim-internal-layer-row.is-selected {
                background: rgba(255, 102, 0, 0.15);
                border-left: 3px solid #ff6600;
                padding-left: 9px;
            }

            .anim-internal-layer-row.is-hidden {
                opacity: 0.45;
            }

            .anim-internal-layer-main {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .anim-internal-layer-name {
                font-weight: bold;
                font-size: 10px;
                color: var(--futaba-maroon);
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .anim-layer-row-actions {
                display: flex;
                gap: 2px;
                opacity: 0.3;
                transition: opacity 0.2s;
            }

            .anim-internal-layer-row:hover .anim-layer-row-actions,
            .anim-internal-layer-row.is-selected .anim-layer-row-actions {
                opacity: 1;
            }

            .anim-layer-visibility-btn, .anim-layer-rename-btn, .anim-layer-delete-btn, .anim-layer-add-btn, .anim-layer-order-btn {
                background: transparent;
                border: none;
                color: var(--futaba-maroon);
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: sans-serif;
                transition: color 0.2s, opacity 0.2s;
            }

            .anim-layer-visibility-btn { width: 16px; font-size: 12px; }
            .anim-layer-rename-btn { width: 16px; font-size: 10px; }
            .anim-layer-delete-btn { width: 16px; font-size: 14px; }
            .anim-layer-order-btn { width: 14px; font-size: 9px; }

            .anim-layer-visibility-btn.hidden { opacity: 0.3; }
            .anim-layer-visibility-btn:hover { color: #ff6600; opacity: 1; }
            .anim-layer-rename-btn:hover { color: #00acc1; }
            .anim-layer-delete-btn:hover { color: #d32f2f; }
            .anim-layer-order-btn:hover:not(:disabled) { color: #ff6600; }
            .anim-layer-order-btn:disabled { opacity: 0.15; cursor: default; }

            .anim-lib-label {
                background: rgba(128, 0, 0, 0.1);
                padding: 4px 8px;
                font-size: 9px;
                font-weight: bold;
                color: var(--futaba-maroon);
                flex-shrink: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .anim-layer-add-btn {
                width: 14px;
                height: 14px;
                background: rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(128, 0, 0, 0.2);
                border-radius: 2px;
                font-size: 12px;
                line-height: 1;
            }

            .anim-layer-add-btn:hover {
                background: white;
                border-color: #ff6600;
                color: #ff6600;
            }

            .anim-internal-layer-meta {
                display: flex;
                gap: 6px;
                font-size: 8px;
                opacity: 0.7;
                flex-wrap: wrap;
            }

            .meta-snapshot.has-data {
                color: #4caf50;
                font-weight: bold;
            }

            .meta-snapshot.is-blank {
                opacity: 0.5;
            }

            .anim-lib-label {
                background: rgba(128, 0, 0, 0.1);
                padding: 2px 8px;
                font-size: 9px;
                font-weight: bold;
                color: var(--futaba-maroon);
                flex-shrink: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .anim-lib-list {
                flex: 1;
                overflow-y: auto;
                padding: 4px 0;
            }

            .anim-lib-folder-item, .anim-lib-asset-item {
                padding: 4px 12px;
                cursor: pointer;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: background 0.1s;
            }

            .anim-lib-folder-item:hover, .anim-lib-asset-item:hover {
                background: rgba(255, 102, 0, 0.1);
            }

            .anim-lib-folder-item.selected, .anim-lib-asset-item.selected {
                background: rgba(255, 102, 0, 0.2);
                font-weight: bold;
            }

            .anim-lib-asset-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }

            .anim-lib-asset-item.current {
                border-left: 3px solid #00acc1;
                background: rgba(0, 172, 193, 0.05);
            }

            .anim-lib-asset-meta {
                display: flex;
                gap: 6px;
                font-size: 8px;
                opacity: 0.6;
            }

            .blank-tag {
                background: rgba(128, 128, 128, 0.2);
                padding: 0 4px;
                border-radius: 2px;
            }

            .anim-lib-folder-actions {
                display: flex;
                gap: 2px;
            }

            .anim-folder-add-btn, .anim-folder-rename-btn, .anim-asset-move-btn {
                background: rgba(255, 255, 255, 0.3);
                border: 1px solid rgba(128, 0, 0, 0.1);
                border-radius: 2px;
                color: var(--futaba-maroon);
                cursor: pointer;
                font-size: 10px;
                padding: 0 4px;
                line-height: 1.4;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .anim-folder-add-btn:hover, .anim-folder-rename-btn:hover, .anim-asset-move-btn:hover {
                background: white;
                border-color: #ff6600;
                color: #ff6600;
            }

            .anim-folder-rename-btn:disabled, .anim-asset-move-btn:disabled {
                opacity: 0.2;
                cursor: default;
            }

            .anim-lib-folder-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }

            .anim-lib-folder-count {
                font-size: 8px;
                opacity: 0.4;
                background: rgba(0,0,0,0.05);
                padding: 0 4px;
                border-radius: 8px;
                min-width: 12px;
                text-align: center;
            }

            .anim-lib-empty {
                padding: 12px;
                text-align: center;
                opacity: 0.5;
                font-style: italic;
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
                justify-content: space-between;
                gap: 6px;
                position: sticky;
                top: 0;
                z-index: 21;
            }

            .anim-lane-add-btn {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 1px solid rgba(128, 0, 0, 0.3);
                background: rgba(255, 255, 255, 0.5);
                color: var(--futaba-maroon);
                font-size: 12px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                padding: 0;
                flex-shrink: 0;
            }

            .anim-lane-add-btn:hover {
                background: white;
                border-color: #ff6600;
            }

            .anim-track-item {
                padding: 0 8px;
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
                gap: 6px;
                background: rgba(255, 255, 238, 0.6);
            }

            .anim-track-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .anim-lane-include-btn {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                border: 1px solid rgba(128, 0, 0, 0.3);
                background: rgba(255, 255, 255, 0.5);
                color: var(--futaba-maroon);
                font-size: 10px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                padding: 0;
                flex-shrink: 0;
                transition: all 0.2s;
            }

            .anim-lane-include-btn:hover {
                background: white;
                border-color: #ff6600;
            }

            .anim-lane-include-btn.active {
                background: #4caf50;
                color: white;
                border-color: #4caf50;
                font-weight: bold;
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

            .anim-timeline-row.active .anim-cell-slot {
                background: rgba(255, 102, 0, 0.045);
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

            .anim-timeline-row.active .anim-cell-slot.current-col {
                background: rgba(255, 102, 0, 0.12);
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
        this.eventBus.on('layer:deleted', (data = {}) => {
            this._handleLayerDeleted(data);
            this.requestUpdate();
        });
        this.eventBus.on('layer:activated', ({ layerIndex } = {}) => {
            this._syncSelectedInternalLayerFromActiveWorkingLayer(layerIndex);
            this.requestUpdate();
        });
        this.eventBus.on('layer:reordered', () => this.requestUpdate());
        this.eventBus.on('layer:name-changed', () => this.requestUpdate());
        this.eventBus.on('layer:opacity-changed', ({ layerIndex } = {}) => {
            this._syncSelectedInternalLayerAttributesFromWorkingLayer(layerIndex);
        });
        this.eventBus.on('layer:blend-mode-changed', ({ layerIndex } = {}) => {
            this._syncSelectedInternalLayerAttributesFromWorkingLayer(layerIndex);
        });
        this.eventBus.on('layer:clipping-changed', ({ layerIndex } = {}) => {
            this._syncSelectedInternalLayerAttributesFromWorkingLayer(layerIndex);
        });
        
        // アニメーション系
        this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
        this.eventBus.on('history:changed', (data = {}) => {
            this._handleHistoryChanged(data);
        });
        this.eventBus.on('keyboard:vkey-state-changed', ({ pressed } = {}) => {
            if (pressed) {
                this._enterTransformEditPreviewMode();
            }
        });
        this.eventBus.on('layer:transform-exit', ({ layerId } = {}) => {
            const shouldSave = layerId && this._isAnimationWorkingLayerId(layerId);
            requestAnimationFrame(() => {
                if (shouldSave) {
                    this._invalidateWorkingLayerSnapshotId(layerId);
                    this._saveSelectedClipFromWorkingLayers({ force: true });
                    this._requestLayerPanelSync();
                }
                this._exitTransformEditPreviewMode();
            });
        });

        // 自動キャプチャ
        this.eventBus.on('drawing:stroke-started', (data = {}) => {
            this._handleDrawingStarted(data);
        });
        this.eventBus.on('drawing:stroke-completed', (data = {}) => {
            this._handleDrawingCompleted(data);
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            // 入力欄編集中は無視
            const isAnimToggleCheckbox = e.target.matches?.('#anim-preview-chk, #anim-onion-chk');
            const isInput = !isAnimToggleCheckbox && (
                           e.target.tagName === 'INPUT' ||
                           e.target.tagName === 'TEXTAREA' ||
                           e.target.isContentEditable
            );
            if (isInput) return;

            if (e.altKey && e.key === 'ArrowUp') {
                this._moveActiveLaneBy(-1);
                e.preventDefault();
            } else if (e.altKey && e.key === 'ArrowDown') {
                this._moveActiveLaneBy(1);
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                const current = this.model.playback.currentFrame;
                if (current > 0) {
                    if (this.isClipEditModeActive) this.exitClipEditMode();
                    this._saveSelectedClipFromWorkingLayers();
                    this.model.setCurrentFrame(current - 1);
                    this._syncWorkingLayersForCurrentFrame();
                    this.render();
                    if (this.eventBus) {
                        this.eventBus.emit('animation:frame-changed', {
                            frameIndex: this.model.playback.currentFrame
                        });
                    }
                }
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                const current = this.model.playback.currentFrame;
                if (current < this.model.totalFrames - 1) {
                    if (this.isClipEditModeActive) this.exitClipEditMode();
                    this._saveSelectedClipFromWorkingLayers();
                    this.model.setCurrentFrame(current + 1);
                    this._syncWorkingLayersForCurrentFrame();
                    this.render();
                    if (this.eventBus) {
                        this.eventBus.emit('animation:frame-changed', {
                            frameIndex: this.model.playback.currentFrame
                        });
                    }
                }
                e.preventDefault();
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
