/**
 * ============================================================================
 * ファイル名: ui/animation-table-popup.js
 * 責務: 動画ツール風アニメーションテーブル（ToonSquid風）のUI、CAF合成preview、Timeline操作を提供する
 * 依存: system/event-bus.js, system/animation/animation-data-model.js
 * 被依存: core-engine.js, system/popup-manager.js
 * ============================================================================
 */

import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js';
import { TegakiEventBus } from '../system/event-bus.js';
import { historyManager } from '../system/history.js';
import { TimelineModel, ClipAssetModel, DrawingSnapshotModel } from '../system/animation/animation-data-model.js';
import { createCenteredTransformMatrix } from '../system/transform-math.js';
import { collectCafMemoryProfile } from '../system/animation/caf-memory-profiler.js';
import { normalizeRasterBounds } from '../system/raster-bounds.js';
import { UI_ICONS } from './ui-icons.js';

const ANIMATION_TABLE_UI_STORAGE_KEY = 'tegaki_animation_table_ui_v1';
const TIMELINE_ZOOM_STEPS = [18, 22, 26, 30, 36, 44];
const SNAPSHOT_TEXTURE_CACHE_DEFAULT_MAX_ENTRIES = 96;
const SNAPSHOT_TEXTURE_CACHE_DEFAULT_MAX_BYTES = 512 * 1024 * 1024;

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
        this.isLaneOnlySelected = false;
        
        // 再生関連
        this.isPlaying = false;
        this._playTimer = null;

        // プレビュー関連
        this.isPreviewActive = true;
        this._visibilityPreviewApplied = false;
        this._backupSnapshots = new Map(); // layerId -> snapshot (元の状態バックアップ)
        this.animationPreviewContainer = null;
        this.animationPreviewBackContainer = null;
        this.animationPreviewBackgroundContainer = null;
        this._animationPreviewMode = null;
        this._animationPreviewKey = null;
        this._drawingPreviewCompositeKey = null;
        this._snapshotTextureCache = new Map();
        this._snapshotTextureCacheProfile = this._createSnapshotTextureCacheProfile();
        this._snapshotTextureCachePendingDestroy = [];
        this._snapshotTextureCacheDestroyFrame = null;
        this._snapshotTextureCacheGcPending = false;
        
        // オニオンスキン関連
        this.isOnionSkinActive = false;
        this.onionSkinFrameCount = 1;
        this.onionSkinPrevAlpha = 0.30;
        this.onionSkinNextAlpha = 0.25;
        this.onionSkinPrevTint = 0xd64a3a;
        this.onionSkinNextTint = 0x3a86c8;
        this.laneReferenceMode = 'active-only'; // 'active-only' | 'lane-onion'
        this.laneReferenceAlpha = 0.24;
        this._laneReferencePreviewFrame = null;

        // ドラッグ移動関連
        this._isDragging = false;
        this._dragPointerId = null;
        this._dragOffset = { x: 0, y: 0 };
        this._panelPos = { x: 70, y: null }; // y は初期表示時に下部固定から計算
        this._isResizing = false;
        this._resizePointerId = null;
        this._resizeStart = null;
        this._panelSize = { width: null, height: 260 };

        // リタイミング（セル伸縮）関連
        this._isRetiming = false;
        this._retimingData = null;

        // コピー/ペースト関連
        this._copiedCelRef = null;

        // クリップ移動関連
        this._clipMoveData = null;
        this._clipMoveMoved = false;
        this._isClipMoving = false;
        this._clipMovePreviewSlot = null;

        // Timeline viewportの修飾ドラッグ操作
        this._timelineViewportGesture = null;
        this._timelineGestureMoved = false;
        this._timelineSpacePressed = false;

        // 自動キャプチャ関連
        this.isAutoCaptureActive = false;

        // クリップ編集モード関連
        this.isClipEditModeActive = false;
        this._previewBeforeClipEdit = null;
        this._previewBeforeTransform = null;
        this.isTransformPreviewSuspended = false;
        this._transformHistoryBeforeState = null;
        this._transformWorkingLayerBeforeSignature = null;
        this.isDrawingPreviewSuspended = false;
        this._attributePreviewSyncFrame = null;
        this._drawingHistoryBeforeStates = new Map();

        // 再生スコープ関連
        this.playbackScope = 'all'; // 'all' | 'activeLane' | 'includedLanes'
        this.activePlaybackLaneIds = null; // Set<string> | null
        this.includedLaneIds = new Set();
        this.timelineCellWidth = 30;

        // アセットライブラリ関連 (Phase 4z4)
        this.isAssetLibraryVisible = false;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null; // null = Uncategorized
        this.selectedInternalLayerId = null; // Phase 4z7
        this._internalFolderTransformContext = null;
        this._internalLayerClipboard = null;
        
        // 初期シード関連 (Phase 4z5)
        this.initialClipAssetSeeded = false;

        this._loadUiPreferences();
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
        }
        this._clampPanelPlacement();
        this._updatePanelPosition();

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
        this._invalidateSnapshotTextureCache();
        this.panel.style.display = 'none';
        this.isVisible = false;
        this._requestLayerPanelSync({ force: true });
        this._scheduleLaneReferencePreviewUpdate();
    }

    _loadUiPreferences() {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(ANIMATION_TABLE_UI_STORAGE_KEY);
            if (!raw) return;
            const prefs = JSON.parse(raw);
            if (!prefs || typeof prefs !== 'object') return;

            const pos = prefs.panelPos || {};
            if (Number.isFinite(pos.x)) {
                this._panelPos.x = Math.max(0, pos.x);
            }
            if (Number.isFinite(pos.y)) {
                this._panelPos.y = Math.max(0, pos.y);
            }

            const size = prefs.panelSize || {};
            if (Number.isFinite(size.width)) {
                this._panelSize.width = Math.max(460, size.width);
            }
            if (Number.isFinite(size.height)) {
                this._panelSize.height = Math.max(180, size.height);
            }

            if (TIMELINE_ZOOM_STEPS.includes(prefs.timelineCellWidth)) {
                this.timelineCellWidth = prefs.timelineCellWidth;
            }
        } catch (error) {}
    }

    _saveUiPreferences() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(ANIMATION_TABLE_UI_STORAGE_KEY, JSON.stringify({
                panelPos: {
                    x: Number.isFinite(this._panelPos.x) ? this._panelPos.x : 70,
                    y: Number.isFinite(this._panelPos.y) ? this._panelPos.y : null
                },
                panelSize: {
                    width: Number.isFinite(this._panelSize.width) ? this._panelSize.width : null,
                    height: Number.isFinite(this._panelSize.height) ? this._panelSize.height : 260
                },
                timelineCellWidth: this.timelineCellWidth
            }));
        } catch (error) {}
    }

    _clampPanelPlacement() {
        const minWidth = 460;
        const minHeight = 180;
        if (Number.isFinite(this._panelSize.width)) {
            this._panelSize.width = Math.max(minWidth, Math.min(this._panelSize.width, Math.max(minWidth, window.innerWidth - 8)));
        }
        if (Number.isFinite(this._panelSize.height)) {
            this._panelSize.height = Math.max(minHeight, Math.min(this._panelSize.height, Math.max(minHeight, window.innerHeight - 8)));
        }

        const width = this._panelSize.width || this.panel?.getBoundingClientRect?.().width || 760;
        const height = this._panelSize.height || this.panel?.getBoundingClientRect?.().height || 260;
        this._panelPos.x = Math.max(0, Math.min(Math.max(0, window.innerWidth - Math.min(width, window.innerWidth)), this._panelPos.x));
        this._panelPos.y = Math.max(0, Math.min(Math.max(0, window.innerHeight - Math.min(height, window.innerHeight)), this._panelPos.y ?? 0));
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

        const rangeOptions = this._getPlaybackRangeOptions();
        const { start, end } = this.model.getPlaybackRange(rangeOptions);
        if (this.model.playback.currentFrame < start || this.model.playback.currentFrame > end) {
            this.model.setCurrentFrame(start);
            this._syncWorkingLayersForCurrentFrame();
            this.render();
            if (this.eventBus) {
                this.eventBus.emit('animation:frame-changed', {
                    frameIndex: this.model.playback.currentFrame
                });
            }
        }

        this.isPlaying = true;
        this._updatePlayButtonUI();

        const interval = 1000 / this.model.fps;
        this._playTimer = setInterval(() => {
            if (!this.model.advanceFrame(this._getPlaybackRangeOptions())) {
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
        if (!this.isVisible) {
            this._scheduleLaneReferencePreviewUpdate();
            return;
        }
        if (this._editingLaneNameInline) return;
        if (this._updateTimeout) return;
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = null;
            this.render();
        }, 32);
    }

    /**
     * レイヤーパネル側の表示更新を要求する (Phase 4z21)
     */
    _requestLayerPanelSync(options = {}) {
        if (this.eventBus) {
            this.eventBus.emit('layer:panel-update-requested', {
                force: options.force === true,
                skipRender: options.skipRender === true
            });
        }
        if (options.force === true && window.layerPanelRenderer?.requestUpdate) {
            window.layerPanelRenderer.requestUpdate({ force: true });
        }
        if (window.timelineUI?.updateLayerPanelIndicator) {
            window.timelineUI.updateLayerPanelIndicator();
        }
    }

    _flushLayerPanelSync() {
        this._requestLayerPanelSync({ skipRender: true });
        const renderer = window.layerPanelRenderer;
        this._emitAnimationLayerStatusUpdate();
        if (!renderer) return;

        if (renderer._updateTimeout) {
            clearTimeout(renderer._updateTimeout);
            renderer._updateTimeout = null;
        }

        const layers = this.layerSystem?.getLayers?.() || [];
        const activeIndex = this.layerSystem?.getActiveLayerIndex?.() || 0;
        renderer.render(layers, activeIndex, window.animationSystem || null);
        renderer._syncOpenLayerAttributePopupToCurrentTarget?.();
    }

    _emitAnimationLayerStatusUpdate() {
        if (!this.eventBus?.emit) return;
        const entry = this.selectedCelId ? this.model?.findClipEntry?.(this.selectedCelId) : null;
        const asset = entry?.clip?.assetId ? this.model?.getClipAsset?.(entry.clip.assetId) : null;
        const selectedLayer = asset?.internalLayers?.find(layer => layer.id === this.selectedInternalLayerId) || null;
        this.eventBus.emit('layer:status-update-requested', {
            currentLayer: selectedLayer?.name || asset?.name || entry?.clip?.name || (this.selectedCelId ? 'CAF' : 'NO FRAME'),
            source: 'animation-table-layer-status'
        });
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

        const asset = this._getSelectedAssetForInspector();
        this._transformHistoryBeforeState = asset
            ? this._captureInternalLayerHistoryState(asset)
            : null;
        this._transformWorkingLayerBeforeSignature = this._captureWorkingLayerTransformSignature();
        this._previewBeforeTransform = this.isPreviewActive;
        this.isTransformPreviewSuspended = true;
        this._restoreVisibility();
        this.render();
    }

    _exitTransformEditPreviewMode() {
        if (!this.isTransformPreviewSuspended) {
            this._clearInternalFolderTransformContext();
            return;
        }

        this.isTransformPreviewSuspended = false;
        this._transformHistoryBeforeState = null;
        this._transformWorkingLayerBeforeSignature = null;
        this._clearInternalFolderTransformContext();
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

    _getTimelineOnionLaneFilterIds() {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        const laneId = entry?.lane?.id || this.activeLaneId || null;
        return laneId ? new Set([laneId]) : this._getPreviewLaneFilterIds();
    }

    _getPlaybackRangeOptions() {
        if (this.activePlaybackLaneIds) {
            return {
                playbackScope: 'includedLanes',
                activeLaneId: this.activeLaneId,
                includedLaneIds: new Set(this.activePlaybackLaneIds)
            };
        }

        return {
            playbackScope: this.playbackScope,
            activeLaneId: this.activeLaneId,
            includedLaneIds: this.includedLaneIds
        };
    }

    _applyVisibilityPreview() {
        if (!this.isVisible || !this.isPreviewActive || !this.layerSystem) return;
        if (this.isDrawingPreviewSuspended !== true) {
            this._clearDrawingLiveStrokeOverlay({ restoreSourceLayers: true });
        }
        
        const layers = this.layerSystem.getLayers() || [];
        const currentFrame = this.model.playback.currentFrame;

        const filterIds = this._getPreviewLaneFilterIds();

        const selectedEntry = this._getSelectedEntryForPreview(currentFrame);
        // 非描画PREVIEWは全CAFをdisplay-only snapshotで合成する。
        // 選択CAFの実working Layerはstroke中だけ使い、セル選択時の可視状態ガチャを避ける。
        const showSelectedWorkingLayer = false;
        const selectedWorkingLayerIds = showSelectedWorkingLayer && selectedEntry?.clip?.assetId
            ? this._getWorkingLayerIdsForClipAsset(selectedEntry.clip.assetId)
            : null;
        const selectedEditClipIds = selectedEntry?.clip?.id
            ? new Set([selectedEntry.clip.id])
            : null;
        const onionFilterIds = this._getTimelineOnionLaneFilterIds();
        const previewKey = this._buildAnimationPreviewStateKey('preview', currentFrame, {
            filterIds,
            onionFilterIds,
            selectedEntry,
            showSelectedWorkingLayer
        });

        if (this._visibilityPreviewApplied && this._animationPreviewMode === 'preview' && this._animationPreviewKey === previewKey) {
            this._hideTimelineLayersForPreview(layers, {
                preserveWorkingLayerIds: selectedWorkingLayerIds
            });
            return;
        }

        this._ensurePreviewContainer();
        const staging = this._createAnimationPreviewStagingContainers();

        // 1. previewを先に構築する。実Layerを先に隠すと、背面previewだけが見えるフレームが挟まる。
        let onionRenderedCount = 0;
        if (this.isOnionSkinActive && !this.isPlaying) {
            onionRenderedCount = this._renderOnionSkins(currentFrame, layers, {
                filterIds: onionFilterIds,
                excludeClipIds: selectedEditClipIds,
                previewContainer: staging.back
            });
        }

        const framePreviewOptions = {
            filterIds,
            excludeClipIds: showSelectedWorkingLayer ? selectedEditClipIds : null,
            backPreviewContainer: staging.back,
            previewContainer: showSelectedWorkingLayer ? staging.front : staging.back
        };
        const renderedCount = showSelectedWorkingLayer
            ? this._renderFrameCompositeAroundSelectedClip(currentFrame, layers, selectedEntry, framePreviewOptions)
            : this._renderFrameComposite(currentFrame, layers, framePreviewOptions);
        if (renderedCount === 0 && onionRenderedCount === 0 && !showSelectedWorkingLayer) {
            this._destroyAnimationPreviewStagingContainers(staging);
            this._restoreVisibility();
            return;
        }

        this._replacePreviewContainerChildren(this.animationPreviewBackContainer, staging.back);
        this._replacePreviewContainerChildren(this.animationPreviewContainer, staging.front);
        this._hideTimelineLayersForPreview(layers, {
            preserveWorkingLayerIds: selectedWorkingLayerIds
        });
        this._animationPreviewMode = 'preview';
        this._animationPreviewKey = previewKey;
        this._drawingPreviewCompositeKey = null;
        this._visibilityPreviewApplied = true;
    }

    _applyDrawingVisibilityPreview() {
        if (!this.isVisible || !this.isPreviewActive || !this.selectedCelId || !this.layerSystem) return;

        const layers = this.layerSystem.getLayers() || [];
        const currentFrame = this.model.playback.currentFrame;
        const selectedEntry = this._getSelectedEntryForPreview(currentFrame);
        if (!selectedEntry?.clip) {
            this.isDrawingPreviewSuspended = false;
            this._restoreVisibility();
            return;
        }
        const filterIds = this._getPreviewLaneFilterIds();

        this._ensurePreviewContainer();
        const staging = this._createAnimationPreviewStagingContainers();

        // 描画中はPhase5m同様、毎回実Layerを隠して単一previewを組み直す。
        // key再利用や選択working Layer温存が入ると、stroke開始時の可視状態が
        // 当たり/外れとして固定されるため、この経路だけは単純化する。
        if (this.isOnionSkinActive && !this.isPlaying) {
            this._renderOnionSkins(currentFrame, layers, {
                filterIds: this._getTimelineOnionLaneFilterIds(),
                excludeClipIds: new Set([this.selectedCelId]),
                previewContainer: staging.front
            });
        }
        // 選択Laneより下はback、上はfrontへ分け、実working Layerを
        // Timeline UI上のLane順へ挟む。preview container自体の安定順序は
        // _ensurePreviewContainer() が保証するため、stroke契約は変えない。
        this._renderFrameCompositeAroundSelectedClip(currentFrame, layers, selectedEntry, {
            filterIds,
            excludeClipIds: new Set([this.selectedCelId]),
            backPreviewContainer: staging.back,
            previewContainer: staging.front
        });
        this._replacePreviewContainerChildren(this.animationPreviewBackContainer, staging.back);
        this._replacePreviewContainerChildren(this.animationPreviewContainer, staging.front);

        this._hideTimelineLayersForPreview(layers);
        this._showSelectedClipWorkingLayers();
        this._drawingPreviewCompositeKey = null;
        this._visibilityPreviewApplied = true;
    }

    _applyTimelineOnionOnlyPreview() {
        if (!this.isVisible || !this.isOnionSkinActive || this.isPlaying || !this.layerSystem) return;

        const layers = this.layerSystem.getLayers() || [];
        const currentFrame = this.model.playback.currentFrame;
        const onionFilterIds = this._getTimelineOnionLaneFilterIds();
        const onionKey = this._buildAnimationPreviewStateKey('onion-only', currentFrame, {
            filterIds: null,
            onionFilterIds,
            selectedEntry: this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null
        });
        if (this._visibilityPreviewApplied && this._animationPreviewMode === 'onion-only' && this._animationPreviewKey === onionKey) {
            return;
        }

        // PREVIEW OFF + onion は実Layer表示を正とする。直前のPREVIEWが隠した実Layerを先に戻す。
        if (this._visibilityPreviewApplied && this._animationPreviewMode !== 'onion-only') {
            this._restoreVisibility();
        }
        this._ensurePreviewContainer();
        const staging = this._createAnimationPreviewStagingContainers();

        const renderedCount = this._renderOnionSkins(currentFrame, layers, {
            filterIds: onionFilterIds,
            previewContainer: staging.front
        });
        if (renderedCount === 0) {
            this._destroyAnimationPreviewStagingContainers(staging);
            this._clearAnimationPreviewContainer();
            return;
        }
        this._replacePreviewContainerChildren(this.animationPreviewBackContainer, staging.back);
        this._replacePreviewContainerChildren(this.animationPreviewContainer, staging.front);
        this._animationPreviewMode = 'onion-only';
        this._animationPreviewKey = onionKey;
        this._visibilityPreviewApplied = true;
    }

    toggleLaneReferenceMode() {
        this.laneReferenceMode = this.laneReferenceMode === 'lane-onion'
            ? 'active-only'
            : 'lane-onion';
        this._scheduleLaneReferencePreviewUpdate({ immediate: true });
        this._requestLayerPanelSync({ skipRender: true });
        return this.laneReferenceMode;
    }

    isLaneReferenceActive() {
        return this.laneReferenceMode === 'lane-onion';
    }

    resetLaneReferenceMode() {
        this.laneReferenceMode = 'active-only';
        this._clearAnimationPreviewContainer();
        this._requestLayerPanelSync({ skipRender: true });
    }

    cycleTimelineOnionSkin() {
        if (!this.isOnionSkinActive) {
            this.isOnionSkinActive = true;
            this.onionSkinFrameCount = 1;
        } else if (this.onionSkinFrameCount >= 4) {
            this.isOnionSkinActive = false;
            this.onionSkinFrameCount = 1;
        } else {
            this.onionSkinFrameCount += 1;
        }
        this.render();
    }

    _scheduleLaneReferencePreviewUpdate(options = {}) {
        if (this._laneReferencePreviewFrame !== null) return;
        const run = () => {
            this._laneReferencePreviewFrame = null;
            this._updateLaneReferencePreview();
        };
        if (options.immediate === true) {
            run();
            return;
        }
        this._laneReferencePreviewFrame = requestAnimationFrame(run);
    }

    _updateLaneReferencePreview() {
        if (this.isVisible || this.isPlaying || this.isClipEditModeActive || this.isTransformPreviewSuspended) {
            if (!this.isVisible && this.laneReferenceMode !== 'lane-onion') {
                this._clearAnimationPreviewContainer();
            }
            return;
        }

        if (this.laneReferenceMode !== 'lane-onion' || !this.layerSystem) {
            this._clearAnimationPreviewContainer();
            return;
        }

        this._ensurePreviewContainer();
        this._clearAnimationPreviewContainer();

        const layers = this.layerSystem.getLayers?.() || [];
        const currentFrame = this.model.playback.currentFrame;
        const selectedClipIds = this.selectedCelId ? new Set([this.selectedCelId]) : null;
        const selectedEntry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        const activeLaneId = selectedEntry?.lane?.id || this.activeLaneId || null;

        this._renderLaneReferenceFrame(currentFrame, layers, {
            alpha: this.laneReferenceAlpha,
            excludeClipIds: selectedClipIds,
            excludeLaneIds: activeLaneId ? new Set([activeLaneId]) : null,
            allowSourceLayerFallback: false
        });
    }

    _renderLaneReferenceFrame(frameIndex, layers, options = {}) {
        const tracks = this.model.tracks || [];
        const excludeClipIds = options.excludeClipIds || null;
        const excludeLaneIds = options.excludeLaneIds || null;

        for (let i = tracks.length - 1; i >= 0; i--) {
            const track = tracks[i];
            if (track.isBackground || track.type === 'folder') continue;
            if (excludeLaneIds?.has(track.id)) continue;

            const cel = track.getCelAtFrame(frameIndex);
            if (cel && cel.visible !== false && !excludeClipIds?.has(cel.id)) {
                this._renderCelPreview(track, cel, layers, {
                    ...options,
                    allowSourceLayerFallback: false
                });
            }
        }
    }

    _showSelectedClipWorkingLayers() {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.clip?.assetId) return false;

        const asset = this.model.getClipAsset(entry.clip.assetId);
        if (!asset) return false;

        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const workingLayers = this._getRasterWorkingLayers();
        const visibleWorkingLayers = [];
        drawableInternalLayers.forEach((internalLayer, index) => {
            const workingLayer = workingLayers[index];
            if (!workingLayer?.layerData) return;
            const isVisible = entry.clip.visible !== false
                && this._isInternalLayerEffectivelyVisible(asset, internalLayer);
            workingLayer.visible = isVisible;
            workingLayer.layerData.visible = isVisible;
            if (isVisible) {
                visibleWorkingLayers.push(workingLayer);
            }
        });
        for (let index = drawableInternalLayers.length; index < workingLayers.length; index++) {
            if (workingLayers[index]) {
                workingLayers[index].visible = false;
                if (workingLayers[index].layerData) workingLayers[index].layerData.visible = false;
            }
        }
        this.layerSystem.refreshClippingMasks?.();
        visibleWorkingLayers.forEach(layer => this._ensureWorkingLayerDisplaySurface(layer));
        return true;
    }

    _keepDrawingPreviewWorkingLayerVisible(layerId = null) {
        if (!this.layerSystem) return false;
        const targetLayerId = layerId || this.layerSystem.getActiveLayer?.()?.layerData?.id || null;
        if (!targetLayerId || !this._isAnimationWorkingLayerId(targetLayerId)) return false;

        const shown = this._showSelectedClipWorkingLayers();
        const forced = this._forceAnimationWorkingLayerVisible(targetLayerId);
        return forced || shown;
    }

    _clearDrawingLiveStrokeOverlay() {
        // PREVIEW中のstrokeは本物のanimation working Layerを表示する。
        // 旧live-stroke overlayは当たり外れの原因になったため互換no-opだけ残す。
    }

    _ensureWorkingLayerDisplaySurface(layer) {
        if (!layer?.layerData || layer.layerData.isAnimationWorkingLayer !== true) return false;
        layer.visible = true;
        if ('renderable' in layer) {
            layer.renderable = true;
        }
        if ('culled' in layer) {
            layer.culled = false;
        }

        const sprite = layer.layerData.layerSprite;
        if (sprite) {
            if (layer.layerData.clipping !== true) {
                sprite.visible = true;
            }
            if ('renderable' in sprite) {
                sprite.renderable = true;
            }
            if ('culled' in sprite) {
                sprite.culled = false;
            }
        }
        for (const child of layer.children || []) {
            if (!child || (child.label !== 'strokePreview' && child.label !== 'penOpacityStrokePreview' && child.label !== 'airbrushStrokePreview')) continue;
            child.visible = true;
            if ('renderable' in child) {
                child.renderable = true;
            }
            if ('culled' in child) {
                child.culled = false;
            }
        }
        return true;
    }

    _getWorkingLayerIdsForClipAsset(assetId) {
        const asset = assetId ? this.model.getClipAsset(assetId) : null;
        if (!asset) return null;
        const workingLayerIds = new Set();
        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const workingLayers = this._getRasterWorkingLayers();
        drawableInternalLayers.forEach((internalLayer, index) => {
            if (!internalLayer) return;
            const workingLayerId = workingLayers[index]?.layerData?.id;
            if (workingLayerId) workingLayerIds.add(workingLayerId);
        });
        return workingLayerIds;
    }

    _hideTimelineLayersForPreview(layers, options = {}) {
        const preserveWorkingLayerIds = options.preserveWorkingLayerIds || null;
        layers.forEach(layer => {
            const layerData = layer.layerData;
            if (!layerData || layerData.isFolder) return;

            if (layerData.isBackground) {
                this._setPreviewBackgroundSubstitute(true, layer);
                layer.visible = false;
                return;
            }

            if (layerData.isAnimationWorkingLayer === true) {
                if (preserveWorkingLayerIds?.has(layerData.id)) return;
                layer.visible = false;
                return;
            }

            const isTracked = this.model.tracks.some(t => (t.sourceLayerId || t.layerId) === layerData.id);
            if (isTracked) {
                layer.visible = false;
            }
        });
    }

    _buildPreviewCompositeKey(frameIndex, filterIds) {
        const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
        const filterKey = filterIds
            ? [...filterIds].sort().join(',')
            : 'all';
        return `frame:${frame}|filter:${filterKey}`;
    }

    _buildDrawingPreviewCompositeKey(frameIndex, selectedEntry, filterIds) {
        const clipId = selectedEntry?.clip?.id || 'none';
        const onionKey = this.isOnionSkinActive
            ? `${Math.max(1, Math.min(4, Math.round(this.onionSkinFrameCount || 1)))}`
            : 'off';
        return `${this._buildPreviewCompositeKey(frameIndex, filterIds)}|selected:${clipId}|onion:${onionKey}`;
    }

    _buildAnimationPreviewStateKey(mode, frameIndex, options = {}) {
        const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
        const filterKey = this._buildPreviewFilterKey(options.filterIds || null);
        const onionFilterKey = this._buildPreviewFilterKey(options.onionFilterIds || null);
        const selectedClipId = options.selectedEntry?.clip?.id || this.selectedCelId || 'none';
        const selectedLaneId = options.selectedEntry?.lane?.id || this.activeLaneId || 'none';
        const liveSelected = options.showSelectedWorkingLayer === true ? '1' : '0';
        const onionCount = this.isOnionSkinActive
            ? Math.max(1, Math.min(4, Math.round(this.onionSkinFrameCount || 1)))
            : 0;
        const currentFrameKey = this._buildFrameCellsKey([frame], options.filterIds || null);
        const onionFrames = [];
        if (this.isOnionSkinActive && !this.isPlaying && onionCount > 0) {
            for (let offset = 1; offset <= onionCount; offset++) {
                const prevFrame = frame - offset;
                const nextFrame = frame + offset;
                if (prevFrame >= 0) onionFrames.push(prevFrame);
                if (nextFrame < this.model.totalFrames) onionFrames.push(nextFrame);
            }
        }
        const onionFrameKey = onionFrames.length > 0
            ? this._buildFrameCellsKey(onionFrames, options.onionFilterIds || null)
            : 'off';
        return [
            mode,
            `frame:${frame}`,
            `filter:${filterKey}`,
            `onionFilter:${onionFilterKey}`,
            `selected:${selectedClipId}`,
            `lane:${selectedLaneId}`,
            `live:${liveSelected}`,
            `onion:${onionCount}`,
            `current:${currentFrameKey}`,
            `onionFrames:${onionFrameKey}`
        ].join('|');
    }

    _buildPreviewFilterKey(filterIds) {
        return filterIds ? [...filterIds].sort().join(',') : 'all';
    }

    _buildFrameCellsKey(frameIndexes, filterIds) {
        const tracks = this.model.tracks || [];
        const frames = [...new Set(frameIndexes.map(frame => Math.max(0, Math.round(Number(frame) || 0))))].sort((a, b) => a - b);
        const parts = [];
        tracks.forEach((track, trackIndex) => {
            if (!track || track.isBackground || track.type === 'folder') return;
            if (filterIds && !filterIds.has(track.id)) return;
            frames.forEach(frame => {
                const cel = track.getCelAtFrame?.(frame) || null;
                if (!cel || cel.visible === false) return;
                const snapshot = this.model.getSnapshotForCel?.(cel) || null;
                parts.push([
                    trackIndex,
                    track.id,
                    frame,
                    cel.id,
                    cel.assetId || '',
                    cel.startFrame ?? '',
                    cel.duration ?? '',
                    snapshot?.id || '',
                    snapshot?.updatedAt || ''
                ].join(':'));
            });
        });
        return parts.join(';') || 'empty';
    }

    _tagPreviewNode(node, track, cel, options = {}) {
        if (!node || !track || !cel) return;
        node._tegakiAnimationPreview = {
            celId: cel.id || null,
            trackId: track.id || null,
            frameIndex: Math.max(0, Math.round(Number(options.frameIndex) || 0)),
            trackIndex: Number.isInteger(options.trackIndex) ? options.trackIndex : -1,
            isOnion: options.isOnion === true || options.tint !== undefined
        };
        if (!node.label) {
            node.label = `animation_preview_${node._tegakiAnimationPreview.celId || 'cel'}`;
        }
    }

    _renderFrameComposite(frameIndex, layers, options = {}) {
        const tracks = this.model.tracks;
        const filterIds = options.filterIds || null;
        const excludeClipIds = options.excludeClipIds || null;
        let renderedCount = 0;

        // データの tracks[0] は UI の一番上（＝レイヤーの前面）なので、逆順で addChild する
        for (let i = tracks.length - 1; i >= 0; i--) {
            const track = tracks[i];
            
            // Phase 4z2: フィルタがある場合は対象外Laneをスキップ
            if (track.isBackground) continue;
            if (filterIds && !filterIds.has(track.id)) continue;

            const cel = track.getCelAtFrame(frameIndex);
            if (cel && cel.visible !== false && !excludeClipIds?.has(cel.id)) {
                if (this._renderCelPreview(track, cel, layers, {
                    ...options,
                    frameIndex,
                    trackIndex: i,
                    allowSourceLayerFallback: false
                })) {
                    renderedCount++;
                }
            }
        }
        return renderedCount;
    }

    _renderFrameCompositeAroundSelectedClip(frameIndex, layers, selectedEntry, options = {}) {
        const tracks = this.model.tracks || [];
        const selectedLaneId = selectedEntry?.lane?.id || null;
        const selectedIndex = selectedLaneId
            ? tracks.findIndex(track => track.id === selectedLaneId)
            : -1;

        if (selectedIndex < 0) {
            return this._renderFrameComposite(frameIndex, layers, options);
        }

        let renderedCount = 0;
        const renderTrack = (track, targetContainer) => {
            if (!track || track.isBackground || track.type === 'folder') return;
            if (options.filterIds && !options.filterIds.has(track.id)) return;

            const cel = track.getCelAtFrame(frameIndex);
            if (!cel || cel.visible === false || options.excludeClipIds?.has(cel.id)) return;

            if (this._renderCelPreview(track, cel, layers, {
                ...options,
                frameIndex,
                trackIndex: tracks.findIndex(candidate => candidate.id === track.id),
                allowSourceLayerFallback: false,
                previewContainer: targetContainer
            })) {
                renderedCount++;
            }
        };

        const backContainer = options.backPreviewContainer || this.animationPreviewBackContainer || this.animationPreviewContainer;
        const frontContainer = options.previewContainer || this.animationPreviewContainer;

        for (let i = tracks.length - 1; i > selectedIndex; i--) {
            renderTrack(tracks[i], backContainer);
        }
        for (let i = selectedIndex - 1; i >= 0; i--) {
            renderTrack(tracks[i], frontContainer);
        }
        return renderedCount;
    }

    _renderOnionSkins(currentFrame, layers, options = {}) {
        const frameCount = Math.max(1, Math.min(4, Math.round(this.onionSkinFrameCount || 1)));
        let renderedCount = 0;
        for (let offset = frameCount; offset >= 1; offset--) {
            const alphaScale = (frameCount - offset + 1) / frameCount;
            const prevFrame = currentFrame - offset;
            if (prevFrame >= 0) {
                renderedCount += this._renderOnionFrame(prevFrame, layers, {
                    ...options,
                    alpha: this.onionSkinPrevAlpha * alphaScale,
                    tint: this.onionSkinPrevTint
                });
            }
            const nextFrame = currentFrame + offset;
            if (nextFrame < this.model.totalFrames) {
                renderedCount += this._renderOnionFrame(nextFrame, layers, {
                    ...options,
                    alpha: this.onionSkinNextAlpha * alphaScale,
                    tint: this.onionSkinNextTint
                });
            }
        }
        return renderedCount;
    }

    _renderOnionFrame(frameIndex, layers, options) {
        return this._renderFrameComposite(frameIndex, layers, options);
    }

    _findSelectedCelEntry() {
        return this.model.findClipEntry(this.selectedCelId);
    }

    _getSelectedEntryForPreview(frameIndex) {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.clip) return null;
        const start = Math.max(0, Math.round(Number(entry.clip.startFrame) || 0));
        const duration = Math.max(1, Math.round(Number(entry.clip.duration) || 1));
        const frame = Math.max(0, Math.round(Number(frameIndex) || 0));
        return frame >= start && frame < start + duration ? entry : null;
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

    _canEditSelectedClipAsset() {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.clip || !entry.lane || entry.lane.type === 'folder' || entry.lane.isBackground) return false;
        return !!(entry.clip.assetId && this.model.getClipAsset(entry.clip.assetId));
    }

    /**
     * ClipAsset の内部レイヤーを合成してプレビュー描画する (Phase 4z10)
     */
    _renderClipAssetInternalLayerPreview(track, cel, layers, options = {}) {
        const targetContainer = options.previewContainer || this.animationPreviewContainer;
        if (!cel || !targetContainer) return false;

        const result = this.model.getPreviewInternalLayersForCel(cel);
        if (!result || !result.ok) return false;

        const { asset, layers: internalLayers } = result;
        const root = new Container();
        root.eventMode = 'none';
        root.alpha = Math.max(0, Math.min(1, options.alpha ?? 1.0));

        const rendered = this._renderInternalLayerPreviewGroup(root, asset, internalLayers, null, options);
        if (!rendered) {
            root.destroy({ children: true, texture: false, baseTexture: false });
            return false;
        }

        this._tagPreviewNode(root, track, cel, options);
        targetContainer.addChild(root);
        return true;
    }

    _renderInternalLayerPreviewGroup(container, asset, internalLayers, parentId, options = {}) {
        const siblings = (internalLayers || [])
            .filter(layer => (layer.parentLayerId || null) === (parentId || null));
        let rendered = false;

        for (let i = siblings.length - 1; i >= 0; i--) {
            const internalLayer = siblings[i];
            if (!internalLayer || internalLayer.visible === false) continue;

            if (internalLayer.type === 'folder') {
                const folderContainer = new Container();
                folderContainer.eventMode = 'none';
                const hasFolderContent = this._renderInternalLayerPreviewGroup(
                    folderContainer,
                    asset,
                    internalLayers,
                    internalLayer.id,
                    options
                );
                const opacity = this._getInternalLayerOwnOpacity(internalLayer);
                if (!hasFolderContent || opacity <= 0) {
                    folderContainer.destroy({ children: true, texture: false, baseTexture: false });
                    continue;
                }
                folderContainer.alpha = opacity;
                folderContainer.blendMode = internalLayer.blendMode || 'normal';
                container.addChild(folderContainer);
                rendered = true;
                continue;
            }

            const opacity = this._getInternalLayerOwnOpacity(internalLayer);
            if (opacity <= 0) continue;

            const snapshot = this.model.getDrawingSnapshot(internalLayer.drawingSnapshotId);
            if (!snapshot) continue;

            const displaySnapshot = this._createInternalClippedSnapshot(asset, internalLayer, snapshot) || snapshot;
            const texture = this._getTextureFromSnapshot(displaySnapshot);
            if (!texture) continue;

            const sprite = new Sprite(texture);
            this._positionSnapshotSprite(sprite, displaySnapshot);
            sprite.alpha = opacity;
            sprite.blendMode = internalLayer.blendMode || 'normal';
            sprite.eventMode = 'none';

            if (options.tint !== undefined) {
                sprite.tint = options.tint;
            }

            container.addChild(sprite);
            rendered = true;
        }

        return rendered;
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
                && sourceSnapshot.width > 0
                && sourceSnapshot.height > 0;
        });
        if (visibleSourceSnapshots.length === 0) return null;

        const maskedPixels = new Uint8ClampedArray(snapshot.pixels);
        const maskAlpha = new Uint8ClampedArray(snapshot.width * snapshot.height);
        const targetBounds = normalizeRasterBounds(snapshot.rasterBounds, {
            x: 0,
            y: 0,
            width: snapshot.width,
            height: snapshot.height
        });
        visibleSourceSnapshots.forEach(sourceSnapshot => {
            const sourcePixels = sourceSnapshot.pixels;
            const sourceBounds = normalizeRasterBounds(sourceSnapshot.rasterBounds, {
                x: 0,
                y: 0,
                width: sourceSnapshot.width,
                height: sourceSnapshot.height
            });
            for (let targetY = 0; targetY < snapshot.height; targetY++) {
                const sourceY = targetBounds.y + targetY - sourceBounds.y;
                if (sourceY < 0 || sourceY >= sourceSnapshot.height) continue;
                for (let targetX = 0; targetX < snapshot.width; targetX++) {
                    const sourceX = targetBounds.x + targetX - sourceBounds.x;
                    if (sourceX < 0 || sourceX >= sourceSnapshot.width) continue;
                    const sourceAlpha = sourcePixels[(sourceY * sourceSnapshot.width + sourceX) * 4 + 3];
                    const maskIndex = targetY * snapshot.width + targetX;
                    if (sourceAlpha > maskAlpha[maskIndex]) {
                        maskAlpha[maskIndex] = sourceAlpha;
                    }
                }
            }
        });

        const maskThreshold = 128;
        for (let targetIndex = 3, maskIndex = 0; targetIndex < maskedPixels.length; targetIndex += 4, maskIndex++) {
            maskedPixels[targetIndex] = maskAlpha[maskIndex] >= maskThreshold ? maskedPixels[targetIndex] : 0;
        }

        const sourceSignature = visibleSourceSnapshots
            .map(sourceSnapshot => `${sourceSnapshot.id || 'unknown'}@${sourceSnapshot.updatedAt || 0}`)
            .join('|');
        const clippedCacheKey = [
            'clipped',
            asset.id || 'asset',
            layer.id || 'layer',
            snapshot.id || 'snapshot',
            snapshot.updatedAt || 0,
            sourceSignature
        ].join(':');

        return {
            id: clippedCacheKey,
            width: snapshot.width,
            height: snapshot.height,
            rasterBounds: { ...targetBounds, width: snapshot.width, height: snapshot.height },
            pixels: maskedPixels,
            updatedAt: clippedCacheKey
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
            this._positionSnapshotSprite(sprite, snapshot);
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

    _getSelectedInternalFolderTransformTargets(asset = this._getSelectedAssetForInspector()) {
        if (!asset || !this.layerSystem) return null;
        let selectedLayer = (asset.internalLayers || [])
            .find(layer => layer.id === this.selectedInternalLayerId);
        if (selectedLayer?.type !== 'folder') {
            selectedLayer = this._getInternalFolderTransformSessionLayer(asset);
        }
        if (selectedLayer?.type !== 'folder') return null;

        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const workingLayers = this._getRasterWorkingLayers();
        const descendantIds = new Set(
            this._getInternalFolderDescendantRasterLayers(asset, selectedLayer.id)
                .map(layer => layer.id)
        );
        const targets = drawableInternalLayers
            .map((internalLayer, index) => ({
                internalLayer,
                workingLayer: workingLayers[index] || null,
                index
            }))
            .filter(entry => {
                return descendantIds.has(entry.internalLayer.id)
                    && entry.workingLayer?.layerData?.isAnimationWorkingLayer === true;
            });

        return targets.length > 0
            ? { asset, folderLayer: selectedLayer, targets }
            : null;
    }

    _getInternalFolderTransformSessionLayer(asset = this._getSelectedAssetForInspector()) {
        const context = this._internalFolderTransformContext;
        if (!asset || !context || context.assetId !== asset.id || !context.folderLayerId) return null;
        const folderLayer = (asset.internalLayers || [])
            .find(layer => layer.id === context.folderLayerId);
        return folderLayer?.type === 'folder' ? folderLayer : null;
    }

    _isInternalFolderTransformWorkingLayer(activeLayer, asset = this._getSelectedAssetForInspector()) {
        const folderLayer = this._getInternalFolderTransformSessionLayer(asset);
        const workingLayerId = activeLayer?.layerData?.id || null;
        const targetWorkingLayerIds = this._internalFolderTransformContext?.targetWorkingLayerIds || [];
        return Boolean(folderLayer && workingLayerId && targetWorkingLayerIds.includes(workingLayerId));
    }

    _clearInternalFolderTransformContext() {
        this._internalFolderTransformContext = null;
    }

    prepareInternalFolderTransform() {
        const context = this._getSelectedInternalFolderTransformTargets();
        const firstTarget = context?.targets?.[0]?.workingLayer || null;
        if (!firstTarget || !this.layerSystem?.setActiveLayer) return false;

        const layerIndex = this.layerSystem.getLayerIndex
            ? this.layerSystem.getLayerIndex(firstTarget)
            : (this.layerSystem.getLayers?.() || []).indexOf(firstTarget);
        if (layerIndex < 0) return false;

        this._internalFolderTransformContext = {
            assetId: context.asset.id,
            folderLayerId: context.folderLayer.id,
            targetWorkingLayerIds: context.targets
                .map(entry => entry.workingLayer?.layerData?.id)
                .filter(Boolean)
        };
        this.selectedInternalLayerId = context.folderLayer.id;
        this.layerSystem.setActiveLayer(layerIndex, { preserveSelection: true });
        this.selectedInternalLayerId = context.folderLayer.id;
        this._requestLayerPanelSync({ skipRender: true });
        return true;
    }

    _syncInternalFolderWorkingLayerTransform(sourceLayerId, transform) {
        if (!sourceLayerId || !transform || !this.layerSystem?.transform) return false;
        const context = this._getSelectedInternalFolderTransformTargets();
        if (!context) return false;
        const sourceTarget = context.targets.find(entry => {
            return entry.workingLayer?.layerData?.id === sourceLayerId;
        });
        if (!sourceTarget) return false;

        const centerX = this.layerSystem.config?.canvas?.width / 2 || 0;
        const centerY = this.layerSystem.config?.canvas?.height / 2 || 0;
        context.targets.forEach(({ workingLayer }) => {
            const layerId = workingLayer?.layerData?.id;
            if (!layerId || layerId === sourceLayerId) return;
            const nextTransform = structuredClone(transform);
            this.layerSystem.transform.setTransform(layerId, nextTransform);
            this.layerSystem.transform.applyTransform(workingLayer, nextTransform, centerX, centerY);
        });
        return true;
    }

    _confirmInternalFolderPeerTransforms(sourceLayerId) {
        if (!sourceLayerId || !this.layerSystem?.confirmLayerTransform) {
            return { ok: true, confirmedAny: false, failedLayerIds: [] };
        }
        const context = this._getSelectedInternalFolderTransformTargets();
        if (!context) return { ok: true, confirmedAny: false, failedLayerIds: [] };

        let confirmedAny = false;
        const failedLayerIds = [];
        context.targets.forEach(({ workingLayer }) => {
            const layerId = workingLayer?.layerData?.id;
            if (!layerId || layerId === sourceLayerId) return;
            const transform = this.layerSystem.transform?.getTransform?.(layerId);
            if (!this.layerSystem.transform?._isTransformNonDefault?.(transform)) return;
            const confirmed = this.layerSystem.confirmLayerTransform(workingLayer);
            confirmedAny = confirmedAny || confirmed;
            if (confirmed) {
                workingLayer.layerData.animationSnapshotId = null;
            } else {
                failedLayerIds.push(layerId);
            }
        });
        return {
            ok: failedLayerIds.length === 0,
            confirmedAny,
            failedLayerIds
        };
    }

    canConfirmInternalFolderTransform() {
        const context = this._getSelectedInternalFolderTransformTargets();
        if (!context || context.targets.length <= 1) return true;
        if (!this.layerSystem?.canBakeLayerTransform) return true;

        const failed = [];
        context.targets.forEach(({ workingLayer }) => {
            const layerId = workingLayer?.layerData?.id;
            if (!layerId) return;
            const transform = this.layerSystem.transform?.getTransform?.(layerId);
            if (!this.layerSystem.transform?._isTransformNonDefault?.(transform)) return;
            const result = this.layerSystem.canBakeLayerTransform(workingLayer, transform);
            if (result?.ok === false) {
                failed.push({
                    layerId,
                    name: workingLayer.layerData?.name || layerId,
                    reason: result.reason,
                    targetBounds: result.targetBounds || null
                });
            }
        });

        if (failed.length === 0) return true;
        console.warn('[AnimationTablePopup] CAF folder transform blocked by safety preflight', {
            folderLayerId: context.folderLayer?.id,
            failed
        });
        window.projectManager?._showSaveToast?.('CAFフォルダ変形が大きすぎるため確定を止めました。縮小量を下げるか、個別Layerで変形してください。');
        return false;
    }

    _renderCelPreview(track, cel, layers, options = {}) {
        if (!track || !cel) return false;

        // Phase 4z10: 内部レイヤー合成プレビューを試行
        if (this._renderClipAssetInternalLayerPreview(track, cel, layers, options)) {
            return true;
        }

        // --- 以下、従来の単一Snapshotプレビュー (Fallback用) ---
        const sourceLayer = layers.find(l => l.layerData?.id === (track.sourceLayerId || track.layerId));
        const snapshot = this.model.getSnapshotForCel(cel);

        const targetContainer = options.previewContainer || this.animationPreviewContainer;
        if (snapshot && targetContainer) {
            const texture = this._getTextureFromSnapshot(snapshot);
            if (texture) {
                const sprite = new Sprite(texture);
                this._positionSnapshotSprite(sprite, snapshot);
                
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

                this._tagPreviewNode(sprite, track, cel, options);
                targetContainer.addChild(sprite);
                return true;
            }
            return false;
        }

        // Snapshot未取得の選択セルは、編集対象が見えるようにソース実レイヤーだけを暫定表示する。
        if (options.allowSourceLayerFallback && sourceLayer?.layerData) {
            sourceLayer.visible = sourceLayer.layerData.visible !== false;
            return true;
        }
        return false;
    }

    _restoreVisibility() {
        this._clearDrawingLiveStrokeOverlay({ restoreSourceLayers: true });
        if (this.animationPreviewContainer) {
            this._clearAnimationPreviewContainer();
        }
        this._setPreviewBackgroundSubstitute(false);

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
        const canvasContainer = this.layerSystem?.cameraSystem?.canvasContainer;
        const currentFrameContainer = this.layerSystem?.currentFrameContainer;
        if (!canvasContainer || !currentFrameContainer) return;

        if (!this.animationPreviewBackgroundContainer) {
            this.animationPreviewBackgroundContainer = new Container();
            this.animationPreviewBackgroundContainer.label = 'animation_preview_background_container';
            this.animationPreviewBackgroundContainer.eventMode = 'none';
            this.animationPreviewBackgroundContainer.visible = false;
        }
        if (!this.animationPreviewBackContainer) {
            this.animationPreviewBackContainer = new Container();
            this.animationPreviewBackContainer.label = 'animation_preview_back_container';
            this.animationPreviewBackContainer.eventMode = 'none';
        }
        if (!this.animationPreviewContainer) {
            this.animationPreviewContainer = new Container();
            this.animationPreviewContainer.label = 'animation_preview_front_container';
            this.animationPreviewContainer.eventMode = 'none';
        }
        const previewContainers = [
            this.animationPreviewBackgroundContainer,
            this.animationPreviewBackContainer,
            this.animationPreviewContainer
        ];
        const detachPreviewContainers = () => {
            previewContainers.forEach(child => {
                if (child.parent) {
                    child.parent.removeChild(child);
                }
            });
        };

        // Pixi setChildIndex は同じ親のchildを一度抜いて指定indexへ挿すため、
        // 「currentの前へ移動」を連続すると呼び出しごとに順序が反転し得る。
        // preview群を一度外してから currentFrameContainer を基準に挿し直し、
        // background -> back -> current -> front を冪等に保つ。
        detachPreviewContainers();

        if (currentFrameContainer.parent === canvasContainer) {
            const currentIndex = canvasContainer.getChildIndex(currentFrameContainer);
            canvasContainer.addChildAt(this.animationPreviewBackgroundContainer, currentIndex);
            canvasContainer.addChildAt(this.animationPreviewBackContainer, currentIndex + 1);
            const updatedCurrentIndex = canvasContainer.getChildIndex(currentFrameContainer);
            canvasContainer.addChildAt(
                this.animationPreviewContainer,
                Math.min(updatedCurrentIndex + 1, canvasContainer.children.length)
            );
        } else {
            previewContainers.forEach(child => canvasContainer.addChild(child));
        }
    }

    _setPreviewBackgroundSubstitute(active, backgroundLayer = null) {
        if (!this.animationPreviewBackgroundContainer) return;

        if (!active) {
            this.animationPreviewBackgroundContainer.visible = false;
            const removed = this.animationPreviewBackgroundContainer.removeChildren();
            removed.forEach(child => child.destroy?.({ children: true, texture: false, baseTexture: false }));
            return;
        }

        const layerData = backgroundLayer?.layerData || {};
        const shouldShow = layerData.visible !== false;
        this.animationPreviewBackgroundContainer.visible = shouldShow;
        const removed = this.animationPreviewBackgroundContainer.removeChildren();
        removed.forEach(child => child.destroy?.({ children: true, texture: false, baseTexture: false }));
        if (!shouldShow) return;

        const config = window.TEGAKI_CONFIG?.canvas || {};
        const width = Math.max(1, Math.round(config.width || layerData.width || 400));
        const height = Math.max(1, Math.round(config.height || layerData.height || 400));
        const color = layerData.backgroundColor ?? window.TEGAKI_CONFIG?.background?.color ?? 0xf0e0d6;
        const graphics = new Graphics();
        graphics.rect(0, 0, width, height);
        graphics.fill({ color, alpha: 1.0 });
        graphics.eventMode = 'none';
        this.animationPreviewBackgroundContainer.addChild(graphics);
    }

    _getTextureFromSnapshot(snapshot) {
        if (!snapshot || !snapshot.pixels) return null;

        const cacheKey = this._getSnapshotTextureCacheKey(snapshot);
        const cachedEntry = cacheKey ? this._snapshotTextureCache.get(cacheKey) : null;
        if (cachedEntry?.texture && !cachedEntry.texture.destroyed && this._isSnapshotTextureCacheEntryFresh(cachedEntry, snapshot)) {
            this._recordSnapshotTextureCacheHit(cachedEntry);
            return cachedEntry.texture;
        }
        if (cacheKey && cachedEntry) {
            this._evictSnapshotTextureCacheEntry(cacheKey, 'stale');
        }

        try {
            this._snapshotTextureCacheProfile.misses++;
            const canvas = document.createElement('canvas');
            canvas.width = snapshot.width;
            canvas.height = snapshot.height;
            const ctx = canvas.getContext('2d');
            const imageData = new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshot.width, snapshot.height);
            ctx.putImageData(imageData, 0, 0);

            const texture = Texture.from(canvas);
            if (cacheKey) {
                this._recordSnapshotTextureCacheCreate(cacheKey, snapshot, texture);
                this._enforceSnapshotTextureCacheLimits();
            }
            return texture;
        } catch (e) {
            console.error('[AnimationTable] Failed to create texture from snapshot', e);
            return null;
        }
    }

    _positionSnapshotSprite(sprite, snapshot) {
        if (!sprite || !snapshot) return;
        const bounds = normalizeRasterBounds(snapshot.rasterBounds, {
            x: 0,
            y: 0,
            width: snapshot.width || 1,
            height: snapshot.height || 1
        });
        sprite.position.set(bounds.x, bounds.y);
    }

    _invalidateSnapshotTextureCache(options = {}) {
        const immediate = options.immediate === true;
        this._snapshotTextureCache.forEach((entry, key) => {
            this._evictSnapshotTextureCacheEntry(key, 'invalidate', {
                immediate: false,
                defer: immediate
            });
        });
        this._snapshotTextureCache.clear();
        if (immediate) {
            this._scheduleSnapshotTextureCacheDestroyFlush(true);
        }
        this._snapshotTextureCacheProfile.invalidations++;
    }

    _resetCafPreviewRuntime(reason = 'reset') {
        this.isDrawingPreviewSuspended = false;
        this._restoreVisibility();
        this._clearAnimationPreviewContainer({ includeBackground: true });
        this._invalidateSnapshotTextureCache({ immediate: true });
        if (window.TEGAKI_CONFIG?.debug === true) {
            console.debug('[AnimationTable] CAF preview runtime reset', {
                reason,
                cache: this._getSnapshotTextureCacheProfile()
            });
        }
    }

    _createSnapshotTextureCacheProfile() {
        return {
            hits: 0,
            misses: 0,
            creates: 0,
            invalidations: 0,
            evictions: 0,
            evictionsByReason: {}
        };
    }

    _getSnapshotTextureCacheKey(snapshot) {
        if (!snapshot?.id) return null;
        return String(snapshot.id);
    }

    _getSnapshotTextureCacheLimits() {
        const config = window.TEGAKI_CONFIG?.animation?.snapshotTextureCache || {};
        const maxEntries = Number(config.maxEntries);
        const maxBytes = Number(config.maxBytes);
        return {
            maxEntries: Number.isFinite(maxEntries) && maxEntries > 0
                ? Math.floor(maxEntries)
                : SNAPSHOT_TEXTURE_CACHE_DEFAULT_MAX_ENTRIES,
            maxBytes: Number.isFinite(maxBytes) && maxBytes > 0
                ? Math.floor(maxBytes)
                : SNAPSHOT_TEXTURE_CACHE_DEFAULT_MAX_BYTES
        };
    }

    _isSnapshotTextureCacheEntryFresh(entry, snapshot) {
        return entry.sourceUpdatedAt === (snapshot.updatedAt || null)
            && entry.width === (snapshot.width || 0)
            && entry.height === (snapshot.height || 0);
    }

    _recordSnapshotTextureCacheHit(entry) {
        this._snapshotTextureCacheProfile.hits++;
        if (entry) {
            entry.hits++;
            entry.lastUsed = Date.now();
        }
    }

    _recordSnapshotTextureCacheCreate(cacheKey, snapshot, texture) {
        this._snapshotTextureCacheProfile.creates++;
        texture._tegakiCafSnapshotTextureCacheKey = cacheKey;
        this._snapshotTextureCache.set(cacheKey, {
            key: cacheKey,
            snapshotId: snapshot.id,
            texture,
            width: snapshot.width || 0,
            height: snapshot.height || 0,
            byteSize: (snapshot.width || 0) * (snapshot.height || 0) * 4,
            sourceUpdatedAt: snapshot.updatedAt || null,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            hits: 0
        });
    }

    _clearAnimationPreviewContainer(options = {}) {
        this._clearDrawingLiveStrokeOverlay({ restoreSourceLayers: options.restoreSourceLayers === true });
        this._animationPreviewMode = null;
        this._animationPreviewKey = null;
        this._drawingPreviewCompositeKey = null;
        const containers = [
            options.includeBackground === true ? this.animationPreviewBackgroundContainer : null,
            this.animationPreviewBackContainer,
            this.animationPreviewContainer
        ].filter(Boolean);

        if (containers.length === 0) {
            this._flushPendingSnapshotTextureCacheDestroy();
            return;
        }

        if (options.includeBackground === true && this.animationPreviewBackgroundContainer) {
            this.animationPreviewBackgroundContainer.visible = false;
        }

        containers.forEach(container => {
            const removedChildren = container.removeChildren();
            this._destroyPreviewChildren(removedChildren);
        });
        this._flushPendingSnapshotTextureCacheDestroy();
    }

    _createAnimationPreviewStagingContainers() {
        const front = new Container();
        const back = new Container();
        front.eventMode = 'none';
        back.eventMode = 'none';
        front.label = 'animation_preview_front_staging';
        back.label = 'animation_preview_back_staging';
        return { front, back };
    }

    _destroyAnimationPreviewStagingContainers(staging) {
        if (!staging) return;
        [staging.front, staging.back].forEach(container => {
            if (!container) return;
            try {
                this._destroyPreviewChildren(container.removeChildren());
                container.destroy?.({ children: false, texture: false, baseTexture: false });
            } catch (error) {
                console.warn('[AnimationTable] Failed to destroy preview staging container', error);
            }
        });
        this._flushPendingSnapshotTextureCacheDestroy();
    }

    _replacePreviewContainerChildren(targetContainer, stagingContainer) {
        if (!targetContainer || !stagingContainer) {
            this._destroyAnimationPreviewStagingContainers({
                front: stagingContainer,
                back: null
            });
            return;
        }

        const oldChildren = targetContainer.removeChildren();
        // PixiJS v8 の removeChildren() は末尾から削除した配列を返す。
        // 戻り値をそのまま再追加すると、stagingで正しく組んだLane順が反転するため、
        // 削除前のchildren順を正本として移す。
        const newChildren = stagingContainer.children.slice();
        stagingContainer.removeChildren();
        newChildren.forEach(child => targetContainer.addChild(child));
        this._destroyPreviewChildren(oldChildren);
        try {
            stagingContainer.destroy?.({ children: false, texture: false, baseTexture: false });
        } catch (error) {
            console.warn('[AnimationTable] Failed to destroy preview staging container', error);
        }
        this._flushPendingSnapshotTextureCacheDestroy();
    }

    _destroyPreviewChildren(children = []) {
        children.forEach(child => {
            try {
                child.destroy?.({ children: true, texture: false, baseTexture: false });
            } catch (error) {
                console.warn('[AnimationTable] Failed to destroy preview child', error);
            }
        });
    }

    _getDisplayedSnapshotTextureCacheKeys() {
        const keys = new Set();
        const visit = (node) => {
            if (!node) return;
            const key = node.texture?._tegakiCafSnapshotTextureCacheKey;
            if (key) keys.add(key);
            (node.children || []).forEach(child => visit(child));
        };
        visit(this.animationPreviewBackContainer);
        visit(this.animationPreviewContainer);
        return keys;
    }

    _getDisplayedSnapshotTextures() {
        const textures = new Set();
        const visit = (node) => {
            if (!node) return;
            if (node.texture) textures.add(node.texture);
            (node.children || []).forEach(child => visit(child));
        };
        visit(this.animationPreviewBackContainer);
        visit(this.animationPreviewContainer);
        return textures;
    }

    _destroySnapshotTextureCacheEntryNow(entry) {
        if (!entry) return;
        try {
            if (entry.texture && !entry.texture.destroyed) {
                delete entry.texture._tegakiCafSnapshotTextureCacheKey;
                entry.texture.destroy(true);
            }
        } catch (error) {
            console.warn('[AnimationTable] Failed to destroy snapshot texture cache entry', error);
        }
    }

    _scheduleSnapshotTextureCacheEntryDestroy(entry, reason = 'evict', options = {}) {
        if (!entry || entry.destroyQueued === true) return;
        entry.destroyQueued = true;
        this._snapshotTextureCacheProfile.evictions++;
        this._snapshotTextureCacheProfile.evictionsByReason[reason] =
            (this._snapshotTextureCacheProfile.evictionsByReason[reason] || 0) + 1;
        if (options.defer === true || (options.immediate !== true && this._getDisplayedSnapshotTextures().has(entry.texture))) {
            this._snapshotTextureCachePendingDestroy.push(entry);
            if (options.defer === true) {
                this._scheduleSnapshotTextureCacheDestroyFlush(options.runGc === true);
            }
            return;
        }
        this._destroySnapshotTextureCacheEntryNow(entry);
    }

    _scheduleSnapshotTextureCacheDestroyFlush(runGc = false) {
        this._snapshotTextureCacheGcPending = this._snapshotTextureCacheGcPending || runGc;
        if (this._snapshotTextureCacheDestroyFrame !== null) return;

        this._snapshotTextureCacheDestroyFrame = requestAnimationFrame(() => {
            this._snapshotTextureCacheDestroyFrame = requestAnimationFrame(() => {
                this._snapshotTextureCacheDestroyFrame = null;
                this._flushPendingSnapshotTextureCacheDestroy();
                if (this._snapshotTextureCacheGcPending) {
                    this._snapshotTextureCacheGcPending = false;
                    this._runSnapshotTextureGc();
                }
            });
        });
    }

    _flushPendingSnapshotTextureCacheDestroy() {
        if (this._snapshotTextureCachePendingDestroy.length === 0) return;
        const displayedTextures = this._getDisplayedSnapshotTextures();
        const stillPending = [];
        this._snapshotTextureCachePendingDestroy.forEach(entry => {
            if (displayedTextures.has(entry.texture)) {
                stillPending.push(entry);
                return;
            }
            this._destroySnapshotTextureCacheEntryNow(entry);
        });
        this._snapshotTextureCachePendingDestroy = stillPending;
    }

    _evictSnapshotTextureCacheEntry(cacheKey, reason = 'evict', options = {}) {
        const entry = this._snapshotTextureCache.get(cacheKey);
        if (!entry) return false;
        this._snapshotTextureCache.delete(cacheKey);
        this._scheduleSnapshotTextureCacheEntryDestroy(entry, reason, options);
        return true;
    }

    _runSnapshotTextureGc() {
        const renderer = this.layerSystem?.app?.renderer || this.app?.renderer || window.coreEngine?.app?.renderer;
        try {
            if (renderer?.gc?.run) {
                renderer.gc.run();
                return;
            }
            renderer?.textureGC?.run?.();
            renderer?.texture?.GC?.run?.();
        } catch (error) {
            console.warn('[AnimationTable] Snapshot texture GC failed', error);
        }
    }

    _getProtectedSnapshotTextureCacheKeys() {
        const protectedKeys = new Set();
        const addSnapshot = (snapshot) => {
            const key = this._getSnapshotTextureCacheKey(snapshot);
            if (key) protectedKeys.add(key);
        };
        const addAsset = (asset) => {
            if (!asset) return;
            addSnapshot(asset.drawingSnapshotId ? this.model.getDrawingSnapshot(asset.drawingSnapshotId) : null);
            (asset.internalLayers || []).forEach(layer => {
                if (layer?.drawingSnapshotId) addSnapshot(this.model.getDrawingSnapshot(layer.drawingSnapshotId));
            });
        };

        if (this.selectedCelId) {
            const entry = this.model.findClipEntry(this.selectedCelId);
            if (entry?.clip?.assetId) addAsset(this.model.getClipAsset(entry.clip.assetId));
            addSnapshot(this.model.getSnapshotForCel(entry?.clip));
        }

        const currentFrame = this.model?.playback?.currentFrame || 0;
        for (let frame = Math.max(0, currentFrame - 1); frame <= Math.min((this.model?.totalFrames || 1) - 1, currentFrame + 1); frame++) {
            (this.model?.tracks || []).forEach(track => {
                if (track?.isBackground || track?.type === 'folder') return;
                const cel = track.getCelAtFrame?.(frame);
                if (!cel) return;
                if (cel.assetId) addAsset(this.model.getClipAsset(cel.assetId));
                addSnapshot(this.model.getSnapshotForCel(cel));
            });
        }

        return protectedKeys;
    }

    _enforceSnapshotTextureCacheLimits() {
        const limits = this._getSnapshotTextureCacheLimits();
        const protectedKeys = this._getProtectedSnapshotTextureCacheKeys();
        this._getDisplayedSnapshotTextureCacheKeys().forEach(key => protectedKeys.add(key));
        this._flushPendingSnapshotTextureCacheDestroy();

        const getTotalBytes = () => {
            let bytes = 0;
            this._snapshotTextureCache.forEach(entry => {
                bytes += entry.byteSize || 0;
            });
            return bytes;
        };

        while (
            this._snapshotTextureCache.size > limits.maxEntries ||
            getTotalBytes() > limits.maxBytes
        ) {
            const entries = [...this._snapshotTextureCache.entries()]
                .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
            const evictTarget = entries.find(([key]) => !protectedKeys.has(key)) || entries[0];
            if (!evictTarget) break;
            this._evictSnapshotTextureCacheEntry(evictTarget[0], 'lru');
        }
    }

    _getSnapshotTextureCacheProfile() {
        let bytes = 0;
        let maxEntryBytes = 0;
        let maxEntrySnapshotId = null;
        this._snapshotTextureCache.forEach(entry => {
            bytes += entry.byteSize || 0;
            if ((entry.byteSize || 0) > maxEntryBytes) {
                maxEntryBytes = entry.byteSize || 0;
                maxEntrySnapshotId = entry.snapshotId;
            }
        });
        const limits = this._getSnapshotTextureCacheLimits();

        return {
            count: this._snapshotTextureCache.size,
            bytes,
            maxEntryBytes,
            maxEntrySnapshotId,
            maxEntries: limits.maxEntries,
            maxBytes: limits.maxBytes,
            hits: this._snapshotTextureCacheProfile.hits,
            misses: this._snapshotTextureCacheProfile.misses,
            creates: this._snapshotTextureCacheProfile.creates,
            invalidations: this._snapshotTextureCacheProfile.invalidations,
            evictions: this._snapshotTextureCacheProfile.evictions,
            pendingDestroy: this._snapshotTextureCachePendingDestroy.length,
            evictionsByReason: { ...this._snapshotTextureCacheProfile.evictionsByReason }
        };
    }

    async getCafMemoryProfile(options = {}) {
        return collectCafMemoryProfile({
            animationTable: this,
            model: this.model,
            history: historyManager,
            layerSystem: this.layerSystem,
            includeUserAgentSpecificMemory: options.includeUserAgentSpecificMemory === true,
            force: options.force === true
        });
    }

    async logCafMemoryProfile(options = {}) {
        const report = await this.getCafMemoryProfile(options);
        if (report?.enabled && (window.TEGAKI_CONFIG?.debug === true || options.force === true)) {
            console.log('[CAFMemoryProfile]', report);
            if (console.table) {
                console.table(report.formatted || {});
            }
        }
        return report;
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
        const previousSelectedInternalLayerId = this.selectedInternalLayerId || null;
        const previousSelectedInternalLayer = existingAsset
            ? existingAsset.internalLayers.find(layer => layer.id === previousSelectedInternalLayerId)
            : null;
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
            this.selectedInternalLayerId = previousSelectedInternalLayer?.type === 'folder'
                && existingAsset.internalLayers.some(layer => layer.id === previousSelectedInternalLayerId)
                    ? previousSelectedInternalLayerId
                    : drawableInternalLayers[nextInternalIndex]?.id
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
        this._syncClipAssetToWorkingLayers(clip, { forceRestore: true });

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
        const selectedInternalLayerId = beforeState?.internalLayerId
            || this.selectedInternalLayerId
            || null;
        const captured = this._captureDrawingLayerToSelectedClip(layerId, selectedInternalLayerId);
        this._clearDrawingLiveStrokeOverlay({ restoreSourceLayers: true });
        this.isDrawingPreviewSuspended = false;
        this._drawingPreviewCompositeKey = null;
        this._animationPreviewKey = null;
        this.render();
        this._scheduleLaneReferencePreviewUpdate();
        this._requestLayerPanelSync();

        const afterAsset = asset?.id ? this.model.getClipAsset(asset.id) : null;
        const afterState = captured
            ? this._captureCafRasterHistoryState(afterAsset, selectedInternalLayerId)
            : null;
        if (afterAsset && beforeState && afterState) {
            this._recordCafRasterHistory(afterAsset, beforeState, afterState, {
                type: 'caf-internal-layer-draw',
                clipId: this.selectedCelId,
                layerId,
                internalLayerId: selectedInternalLayerId,
                mode: data.mode || data.data?.mode || 'draw'
            });
        }
    }

    _handleDrawingCancelled() {
        if (!this.isDrawingPreviewSuspended) return;
        this._clearDrawingLiveStrokeOverlay({ restoreSourceLayers: true });
        this.isDrawingPreviewSuspended = false;
        this._drawingPreviewCompositeKey = null;
        this._drawingHistoryBeforeStates.clear();
        this.render();
        this._scheduleLaneReferencePreviewUpdate();
    }

    _handleDrawingStarted(data = {}) {
        if (!this.selectedCelId) return;

        const layerId = data.layerId || data.data?.layerId;
        if (!layerId || !this._isAnimationWorkingLayerId(layerId)) return;

        const asset = this._getSelectedAssetForInspector();
        if (asset) {
            const internalLayerId = this._resolveInternalLayerIdForWorkingLayer(asset, layerId);
            const beforeState = this._captureCafRasterHistoryState(asset, internalLayerId);
            if (beforeState) {
                this._drawingHistoryBeforeStates.set(layerId, beforeState);
            }
        }
        this._invalidateWorkingLayerSnapshotId(layerId);
        if (this.isVisible && this.isPreviewActive) {
            this.isDrawingPreviewSuspended = true;
            this._drawingPreviewCompositeKey = null;
            this._applyDrawingVisibilityPreview();
        } else {
            this._scheduleLaneReferencePreviewUpdate();
        }
    }

    _forceAnimationWorkingLayerVisible(layerId) {
        if (!layerId || !this.layerSystem) return false;
        const layer = (this.layerSystem.getLayers?.() || [])
            .find(candidate => candidate.layerData?.id === layerId);
        if (!layer?.layerData || layer.layerData.isAnimationWorkingLayer !== true) return false;

        this.layerSystem.refreshClippingMasks?.();
        this._ensureWorkingLayerDisplaySurface(layer);
        return true;
    }

    _resolveInternalLayerIdForWorkingLayer(asset, workingLayerId) {
        if (!asset || !workingLayerId) return this.selectedInternalLayerId || null;
        const workingLayers = this._getRasterWorkingLayers();
        const workingIndex = workingLayers.findIndex(layer => layer.layerData?.id === workingLayerId);
        if (workingIndex < 0) return this.selectedInternalLayerId || null;
        return this._getDrawableInternalLayers(asset)[workingIndex]?.id
            || this.selectedInternalLayerId
            || null;
    }

    _captureDrawingLayerToSelectedClip(workingLayerId, internalLayerId) {
        if (!workingLayerId || !internalLayerId || !this.layerSystem) return false;
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        const asset = entry?.clip?.assetId ? this.model.getClipAsset(entry.clip.assetId) : null;
        const internalLayer = asset?.internalLayers?.find(layer => layer.id === internalLayerId);
        const workingLayer = (this.layerSystem.getLayers?.() || [])
            .find(layer => layer.layerData?.id === workingLayerId);
        if (!entry?.clip || !asset || !internalLayer || !workingLayer) return false;

        const rawSnapshot = this.layerSystem.createLayerRasterSnapshot(workingLayer);
        if (!rawSnapshot?.pixels) return false;
        const drawingSnapshot = new DrawingSnapshotModel({
            width: rawSnapshot.width,
            height: rawSnapshot.height,
            rasterBounds: rawSnapshot.rasterBounds,
            pixels: new Uint8ClampedArray(rawSnapshot.pixels),
            isBlank: this._isRasterSnapshotBlank(rawSnapshot)
        });
        this.model.drawingSnapshots.push(drawingSnapshot);
        internalLayer.drawingSnapshotId = drawingSnapshot.id;
        internalLayer.updatedAt = Date.now();
        asset.updatedAt = Date.now();

        const drawableLayers = this._getDrawableInternalLayers(asset);
        if (drawableLayers[0]?.id === internalLayer.id) {
            asset.drawingSnapshotId = drawingSnapshot.id;
            entry.clip.rasterSnapshot = {
                width: rawSnapshot.width,
                height: rawSnapshot.height,
                rasterBounds: { ...drawingSnapshot.rasterBounds },
                pixels: new Uint8ClampedArray(rawSnapshot.pixels)
            };
        }

        workingLayer.layerData.animationSnapshotId = drawingSnapshot.id;
        this.selectedInternalLayerId = internalLayer.id;
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this._invalidateSnapshotTextureCache();
        return true;
    }

    _captureCafRasterHistoryState(asset, internalLayerId) {
        if (!asset || !internalLayerId) return null;
        const internalLayer = asset.internalLayers?.find(layer => layer.id === internalLayerId);
        const snapshot = internalLayer?.drawingSnapshotId
            ? this.model.getDrawingSnapshot(internalLayer.drawingSnapshotId)
            : null;
        if (!internalLayer || !snapshot?.pixels) return null;

        return {
            assetId: asset.id,
            clipId: this.selectedCelId || null,
            internalLayerId,
            layer: internalLayer.serialize ? internalLayer.serialize() : { ...internalLayer },
            snapshot: {
                id: snapshot.id,
                width: snapshot.width,
                height: snapshot.height,
                rasterBounds: snapshot.rasterBounds ? { ...snapshot.rasterBounds } : null,
                pixels: new Uint8ClampedArray(snapshot.pixels),
                isBlank: snapshot.isBlank === true,
                createdAt: snapshot.createdAt,
                updatedAt: snapshot.updatedAt
            }
        };
    }

    _recordCafRasterHistory(asset, beforeState, afterState, meta = {}) {
        if (!asset || !beforeState || !afterState || !historyManager || historyManager.isApplying) {
            return false;
        }
        const byteSize = (beforeState.snapshot?.pixels?.byteLength || 0)
            + (afterState.snapshot?.pixels?.byteLength || 0);
        historyManager.record({
            name: 'caf-internal-layer-draw',
            do: () => this._restoreCafRasterHistoryState(afterState),
            undo: () => this._restoreCafRasterHistoryState(beforeState),
            byteSize,
            meta: {
                historyKind: 'raster',
                assetId: asset.id,
                ...meta
            }
        });
        this._collectUnreferencedDrawingSnapshots();
        return true;
    }

    _restoreCafRasterHistoryState(state) {
        if (!state?.assetId || !state.internalLayerId || !state.snapshot) return false;
        const asset = this.model.getClipAsset(state.assetId);
        const internalLayer = asset?.internalLayers?.find(layer => layer.id === state.internalLayerId);
        if (!asset || !internalLayer) return false;

        const restoredSnapshot = new DrawingSnapshotModel({
            ...state.snapshot,
            pixels: new Uint8ClampedArray(state.snapshot.pixels)
        });
        const snapshotIndex = this.model.drawingSnapshots
            .findIndex(snapshot => snapshot.id === restoredSnapshot.id);
        if (snapshotIndex >= 0) {
            this.model.drawingSnapshots[snapshotIndex] = restoredSnapshot;
        } else {
            this.model.drawingSnapshots.push(restoredSnapshot);
        }

        Object.assign(internalLayer, state.layer, {
            drawingSnapshotId: restoredSnapshot.id,
            updatedAt: Date.now()
        });
        const drawableLayers = this._getDrawableInternalLayers(asset);
        if (drawableLayers[0]?.id === internalLayer.id) {
            asset.drawingSnapshotId = restoredSnapshot.id;
        }
        asset.updatedAt = Date.now();

        const entry = (state.clipId ? this.model.findClipEntry(state.clipId) : null)
            || this._findClipEntryByAssetId(asset.id);
        if (entry?.clip) {
            if (drawableLayers[0]?.id === internalLayer.id) {
                entry.clip.rasterSnapshot = {
                    width: restoredSnapshot.width,
                    height: restoredSnapshot.height,
                    rasterBounds: { ...restoredSnapshot.rasterBounds },
                    pixels: new Uint8ClampedArray(restoredSnapshot.pixels)
                };
            }
            this.selectedCelId = entry.clip.id;
            this.activeLaneId = entry.lane?.id || this.activeLaneId;
            this.model.setCurrentFrame(entry.clip.startFrame);
            this.model.tracks.forEach(track => {
                track.active = track.id === this.activeLaneId;
            });
        }
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = internalLayer.id;
        this._invalidateSnapshotTextureCache();
        this._ensureWorkingLayerCapacity(drawableLayers.length);
        if (entry?.clip) {
            this._syncClipAssetToWorkingLayers(entry.clip, { forceRestore: true });
        }
        this._collectUnreferencedDrawingSnapshots();
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _collectUnreferencedDrawingSnapshots() {
        const referencedIds = new Set();
        (this.model.clipAssets || []).forEach(asset => {
            if (asset.drawingSnapshotId) referencedIds.add(asset.drawingSnapshotId);
            (asset.internalLayers || []).forEach(layer => {
                if (layer.drawingSnapshotId) referencedIds.add(layer.drawingSnapshotId);
            });
        });
        this.model.drawingSnapshots = (this.model.drawingSnapshots || [])
            .filter(snapshot => referencedIds.has(snapshot.id));
    }

    _handleHistoryChanged(data = {}) {
        if (!this.isVisible || !this.selectedCelId) return;
        if (!['record', 'undo', 'redo'].includes(data.action)) return;
        if (data.action === 'record' && data.meta?.type === 'draw') return;
        if (typeof data.meta?.type === 'string' && data.meta.type.startsWith('caf-')) return;

        const layerId = data.meta?.layerId || null;
        if (!layerId || !this._isAnimationWorkingLayerId(layerId)) return;
        if (this.isTransformPreviewSuspended) return;

        if (data.meta?.type === 'pixel-selection') {
            this._invalidateWorkingLayerSnapshotId(layerId);
        }
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
        if (!this.selectedCelId) return false;

        this._saveSelectedClipFromWorkingLayers();
        const entry = this.model.findClipEntry(this.selectedCelId);
        if (entry) {
            const clip = entry.clip;
            this._copiedCelRef = {
                assetId: clip.assetId,
                rasterSnapshot: this._cloneRasterSnapshotForRuntime(clip.rasterSnapshot, {
                    includePixels: !clip.assetId
                }), // 互換用
                duration: clip.duration,
                transform: this._cloneClipInstanceMetadata(clip.transform),
                transformKeyframes: this._cloneClipInstanceMetadata(clip.transformKeyframes, []),
                physics: this._cloneClipInstanceMetadata(clip.physics),
                copiedAt: Date.now()
            };
            this.render();
            return true;
        }
        return false;
    }

    getCopiedCelTimestamp() {
        return Number(this._copiedCelRef?.copiedAt) || 0;
    }

    getInternalLayerClipboardTimestamp() {
        return Number(this._internalLayerClipboard?.copiedAt) || 0;
    }

    pasteBestClipboardAtCurrentCell() {
        const selectionClipboard = window.pixelSelectionSystem?.getClipboardPayload?.() || null;
        const selectionCopiedAt = Number(selectionClipboard?.copiedAt) || 0;
        const layerClipboard = window.drawingClipboard?.getClipboardPayload?.() || window.drawingClipboard?.get?.() || null;
        const layerCopiedAt = layerClipboard?.kind === 'layer-block' ? Number(layerClipboard.copiedAt) || 0 : 0;
        const internalCopiedAt = this.getInternalLayerClipboardTimestamp();
        const copiedCelAt = this.getCopiedCelTimestamp();
        const latest = Math.max(selectionCopiedAt, layerCopiedAt, internalCopiedAt, copiedCelAt);

        if (selectionClipboard && selectionCopiedAt === latest && latest > 0) {
            return this.pasteCanvasSelectionAsNewCel(selectionClipboard);
        }
        if (layerClipboard?.kind === 'layer-block' && layerCopiedAt === latest && latest > 0) {
            return this.pasteLayerBlockAsNewCel(layerClipboard);
        }
        if (this._internalLayerClipboard?.layers?.length && internalCopiedAt === latest && latest > 0) {
            return this.pasteInternalLayerClipboardAsNewCel();
        }
        return this.pasteCopiedCel();
    }

    pasteCanvasSelectionAsNewCel(clipboard = null) {
        const source = clipboard || window.pixelSelectionSystem?.getClipboardPayload?.();
        if (source?.kind === 'folder-pixel-selection') {
            return this.pasteFolderSelectionAsNewCel(source);
        }
        if (!source?.pixels || !this.layerSystem) return false;

        const currentFrame = this.model.playback.currentFrame;
        const lane = this.activeLaneId ? this.model.getLaneById(this.activeLaneId) : null;
        if (!lane || lane.type === 'folder' || lane.isBackground || !lane.canPlaceCel(currentFrame, 1)) {
            return false;
        }

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const size = this._getCanvasSnapshotSize();
        const pixels = new Uint8ClampedArray(size.width * size.height * 4);
        const x = Math.max(0, Math.min(size.width - source.width, Math.round(source.sourceBounds?.x || 0)));
        const y = Math.max(0, Math.min(size.height - source.height, Math.round(source.sourceBounds?.y || 0)));
        for (let row = 0; row < source.height; row++) {
            const sourceStart = row * source.width * 4;
            const targetStart = ((y + row) * size.width + x) * 4;
            pixels.set(source.pixels.subarray(sourceStart, sourceStart + source.width * 4), targetStart);
        }

        const snapshot = new DrawingSnapshotModel({
            width: size.width,
            height: size.height,
            pixels,
            isBlank: false
        });
        this.model.drawingSnapshots.push(snapshot);
        const folder = this._createNextClipAssetFolder();
        const asset = new ClipAssetModel({
            name: '選択範囲から作成',
            type: 'raster',
            folderId: folder?.id || null,
            drawingSnapshotId: snapshot.id
        });
        asset.internalLayers = [
            this.model.createClipAssetInternalLayer({
                name: '選択範囲',
                type: 'raster',
                drawingSnapshotId: snapshot.id
            })
        ];
        this.model.clipAssets.push(asset);

        const newClip = lane.addCel({
            assetId: asset.id,
            startFrame: currentFrame,
            duration: 1,
            rasterSnapshot: this._createRasterSnapshotCompat(snapshot, {
                drawingSnapshotId: snapshot.id,
                includePixels: false
            })
        });
        if (!newClip) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        this.selectedCelId = newClip.id;
        this.activeLaneId = lane.id;
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = asset.internalLayers[0].id;
        this._syncClipAssetToWorkingLayers(newClip, { forceRestore: true });
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-paste-selection', {
            type: 'caf-clip-paste-selection',
            clipId: newClip.id,
            assetId: asset.id,
            laneId: lane.id,
            frameIndex: currentFrame,
            sourceLayerId: source.sourceLayerId || null,
            bounds: { x, y, width: source.width, height: source.height }
        });
        this.render();
        this._requestLayerPanelSync();
        return true;
    }

    pasteFolderSelectionAsNewCel(clipboard = null) {
        const source = clipboard || window.pixelSelectionSystem?.getClipboardPayload?.();
        const isValid = window.pixelSelectionSystem?.validateClipboardPayload?.(source);
        if (
            !source
            || source.kind !== 'folder-pixel-selection'
            || source.version !== 1
            || isValid === false
            || !this.layerSystem
        ) {
            return false;
        }

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const currentFrame = this.model.playback.currentFrame;
        const target = this._resolveSelectionPasteTarget(currentFrame, 1);
        const lane = target?.lane || null;
        if (!lane) return false;

        const size = this._getCanvasSnapshotSize();
        const assetFolder = this._createNextClipAssetFolder();
        if (!assetFolder) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const internalRoot = this.model.createClipAssetInternalLayer({
            name: source.rootFolder.name || 'フォルダ',
            type: 'folder',
            visible: source.rootFolder.visible !== false,
            opacity: Number.isFinite(source.rootFolder.opacity) ? source.rootFolder.opacity : 1,
            blendMode: 'normal'
        });
        const internalBySourceKey = new Map([['root', internalRoot]]);
        const createdEntries = [];
        let primarySnapshot = null;
        let primaryInternalLayer = null;
        let rasterByteSize = 0;

        const sortedEntries = [...source.entries].sort((a, b) => b.order - a.order);
        for (const entry of sortedEntries) {
            let drawingSnapshot = null;
            if (entry.type === 'raster') {
                const pixels = this._createCanvasPixelsFromFolderClipboardEntry(entry, source, size);
                drawingSnapshot = new DrawingSnapshotModel({
                    width: size.width,
                    height: size.height,
                    pixels,
                    isBlank: this._isRasterSnapshotBlank({ pixels })
                });
                this.model.drawingSnapshots.push(drawingSnapshot);
                rasterByteSize += drawingSnapshot.pixels?.byteLength || 0;
            }

            const internalLayer = this.model.createClipAssetInternalLayer({
                name: entry.name || (entry.type === 'folder' ? 'フォルダ' : 'レイヤー'),
                type: entry.type,
                visible: entry.visible !== false,
                opacity: Number.isFinite(entry.opacity) ? entry.opacity : 1,
                blendMode: entry.blendMode || 'normal',
                clipping: entry.clipping === true,
                drawingSnapshotId: drawingSnapshot?.id || null
            });
            internalBySourceKey.set(entry.sourceKey, internalLayer);
            createdEntries.push({ entry, internalLayer });
            if (drawingSnapshot && !primarySnapshot) {
                primarySnapshot = drawingSnapshot;
                primaryInternalLayer = internalLayer;
            }
        }

        for (const { entry, internalLayer } of createdEntries) {
            internalLayer.parentLayerId = internalBySourceKey.get(entry.relativeParentKey)?.id
                || internalRoot.id;
        }

        if (!primarySnapshot || !primaryInternalLayer) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const asset = new ClipAssetModel({
            name: `${source.rootFolder.name || 'フォルダ'} から作成`,
            type: 'raster',
            folderId: assetFolder.id,
            drawingSnapshotId: primarySnapshot.id
        });
        asset.internalLayers = [
            internalRoot,
            ...createdEntries.map(({ internalLayer }) => internalLayer)
        ];
        this.model.clipAssets.push(asset);

        const newClip = lane.addCel({
            assetId: asset.id,
            startFrame: currentFrame,
            duration: 1,
            rasterSnapshot: this._createRasterSnapshotCompat(primarySnapshot, {
                drawingSnapshotId: primarySnapshot.id,
                includePixels: false
            })
        });
        if (!newClip) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        this.selectedCelId = newClip.id;
        this.activeLaneId = lane.id;
        this.isLaneOnlySelected = false;
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId;
        this.selectedInternalLayerId = primaryInternalLayer.id;
        this.model.tracks.forEach(track => {
            track.active = track.id === lane.id;
        });
        this._syncClipAssetToWorkingLayers(newClip, { forceRestore: true });
        this._recordTimelineHistory(
            beforeState,
            this._captureTimelineHistoryState(),
            'caf-clip-paste-folder-selection',
            {
                type: 'caf-clip-paste-folder-selection',
                clipId: newClip.id,
                assetId: asset.id,
                assetFolderId: assetFolder.id,
                laneId: lane.id,
                frameIndex: currentFrame,
                createdLaneId: target.created ? lane.id : null,
                internalLayerCount: asset.internalLayers.length,
                rasterCount: createdEntries.filter(record => record.entry.type === 'raster').length,
                bounds: { ...(source.canvasBounds || {}) },
                byteSize: rasterByteSize
            }
        );
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    pasteLayerBlockAsNewCel(clipboard = null) {
        const source = clipboard || window.drawingClipboard?.getClipboardPayload?.() || window.drawingClipboard?.get?.();
        if (
            !source
            || source.kind !== 'layer-block'
            || source.version !== 1
            || !Array.isArray(source.layers)
            || source.layers.length === 0
            || !this.layerSystem
        ) {
            return false;
        }

        const entries = source.layers.map(entry => ({
            sourceId: entry.sourceId,
            parentSourceId: entry.parentSourceId || null,
            order: entry.order,
            type: entry.type,
            name: entry.name,
            visible: entry.visible,
            opacity: entry.opacity,
            blendMode: entry.blendMode,
            clipping: entry.clipping === true,
            snapshot: entry.rasterSnapshot
        }));
        const rootEntry = source.layers.find(entry => entry.sourceId === source.rootSourceId) || source.layers[0];
        return this._pasteLayerEntriesAsNewCel({
            entries,
            rootSourceId: source.rootSourceId,
            assetName: `${rootEntry?.name || 'Layer'} から作成`,
            historyName: 'caf-clip-paste-layer-block',
            historyType: 'caf-clip-paste-layer-block'
        });
    }

    pasteInternalLayerClipboardAsNewCel() {
        const clipboard = this._internalLayerClipboard;
        if (!clipboard?.layers?.length || !this.layerSystem) return false;
        const rootEntry = clipboard.layers.find(entry => entry.layer?.id === clipboard.rootLayerId) || clipboard.layers[0];
        const entries = clipboard.layers.map((entry, index) => {
            const layer = entry.layer || {};
            return {
                sourceId: layer.id,
                parentSourceId: layer.parentLayerId || null,
                order: index,
                type: layer.type || 'raster',
                name: layer.name || (layer.type === 'folder' ? 'フォルダ' : 'レイヤー'),
                visible: layer.visible !== false,
                opacity: layer.opacity ?? 1,
                blendMode: layer.blendMode || 'normal',
                clipping: layer.clipping === true,
                snapshot: entry.snapshot || null
            };
        });
        return this._pasteLayerEntriesAsNewCel({
            entries,
            rootSourceId: clipboard.rootLayerId,
            assetName: `${rootEntry?.layer?.name || 'Layer'} から作成`,
            historyName: 'caf-clip-paste-internal-layer-block',
            historyType: 'caf-clip-paste-internal-layer-block'
        });
    }

    _pasteLayerEntriesAsNewCel({
        entries = [],
        rootSourceId = null,
        assetName = 'Layer から作成',
        historyName = 'caf-clip-paste-layer-entries',
        historyType = 'caf-clip-paste-layer-entries'
    } = {}) {
        const normalizedEntries = entries
            .filter(entry => entry?.sourceId)
            .sort((a, b) => b.order - a.order);
        if (normalizedEntries.length === 0) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const currentFrame = this.model.playback.currentFrame;
        const target = this._resolveSelectionPasteTarget(currentFrame, 1);
        const lane = target?.lane || null;
        if (!lane) return false;

        const assetFolder = this._createNextClipAssetFolder();
        if (!assetFolder) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const internalBySourceId = new Map();
        const createdEntries = [];
        let primarySnapshot = null;
        let primaryInternalLayer = null;
        let rasterByteSize = 0;

        for (const entry of normalizedEntries) {
            let drawingSnapshot = null;
            const snapshot = entry.snapshot || null;
            if (entry.type === 'raster' && snapshot?.pixels) {
                const pixels = new Uint8ClampedArray(snapshot.pixels);
                drawingSnapshot = new DrawingSnapshotModel({
                    width: snapshot.width || this.layerSystem?.config?.canvas?.width || 1,
                    height: snapshot.height || this.layerSystem?.config?.canvas?.height || 1,
                    rasterBounds: snapshot.rasterBounds ? { ...snapshot.rasterBounds } : null,
                    pixels,
                    isBlank: this._isRasterSnapshotBlank({ pixels })
                });
                this.model.drawingSnapshots.push(drawingSnapshot);
                rasterByteSize += drawingSnapshot.pixels?.byteLength || 0;
            }

            const internalLayer = this.model.createClipAssetInternalLayer({
                name: entry.name || (entry.type === 'folder' ? 'フォルダ' : 'レイヤー'),
                type: entry.type,
                visible: entry.visible !== false,
                opacity: Number.isFinite(entry.opacity) ? entry.opacity : 1,
                blendMode: entry.blendMode || 'normal',
                clipping: entry.clipping === true,
                drawingSnapshotId: drawingSnapshot?.id || null
            });
            internalBySourceId.set(entry.sourceId, internalLayer);
            createdEntries.push({ entry, internalLayer, drawingSnapshot });
            if (drawingSnapshot && !primarySnapshot) {
                primarySnapshot = drawingSnapshot;
                primaryInternalLayer = internalLayer;
            }
        }

        for (const { entry, internalLayer } of createdEntries) {
            const parent = internalBySourceId.get(entry.parentSourceId);
            internalLayer.parentLayerId = parent?.id || null;
        }

        if (!primarySnapshot || !primaryInternalLayer) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const asset = new ClipAssetModel({
            name: assetName,
            type: 'raster',
            folderId: assetFolder.id,
            drawingSnapshotId: primarySnapshot.id
        });
        asset.internalLayers = createdEntries.map(({ internalLayer }) => internalLayer);
        this.model.clipAssets.push(asset);

        const newClip = lane.addCel({
            assetId: asset.id,
            startFrame: currentFrame,
            duration: 1,
            rasterSnapshot: this._createRasterSnapshotCompat(primarySnapshot, {
                drawingSnapshotId: primarySnapshot.id,
                includePixels: false
            })
        });
        if (!newClip) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        this.selectedCelId = newClip.id;
        this.activeLaneId = lane.id;
        this.isLaneOnlySelected = false;
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId;
        this.selectedInternalLayerId = primaryInternalLayer.id;
        this.model.tracks.forEach(track => {
            track.active = track.id === lane.id;
        });
        this._syncClipAssetToWorkingLayers(newClip, { forceRestore: true });
        this._recordTimelineHistory(
            beforeState,
            this._captureTimelineHistoryState(),
            historyName,
            {
                type: historyType,
                clipId: newClip.id,
                assetId: asset.id,
                assetFolderId: assetFolder.id,
                laneId: lane.id,
                frameIndex: currentFrame,
                createdLaneId: target.created ? lane.id : null,
                internalLayerCount: asset.internalLayers.length,
                rasterCount: createdEntries.filter(record => record.entry.type === 'raster').length,
                rootSourceId,
                byteSize: rasterByteSize
            }
        );
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _resolveSelectionPasteTarget(frameIndex, duration = 1) {
        const isAvailable = (lane) => {
            return !!lane
                && lane.type !== 'folder'
                && !lane.isBackground
                && lane.canPlaceCel(frameIndex, duration);
        };
        const activeLane = this.activeLaneId ? this.model.getLaneById(this.activeLaneId) : null;
        if (isAvailable(activeLane)) return { lane: activeLane, created: false };

        const availableLane = this.model.tracks.find(isAvailable);
        if (availableLane) return { lane: availableLane, created: false };

        const createdLane = this.model.createIndependentLane();
        return createdLane ? { lane: createdLane, created: true } : null;
    }

    importImageSequenceAsCafs(frames, options = {}) {
        if (!Array.isArray(frames) || frames.length === 0 || !this.layerSystem) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const size = this._getCanvasSnapshotSize();
        const startFrame = Math.max(0, Math.round(Number(options.startFrame ?? this.model.playback.currentFrame) || 0));
        const frameCount = frames.length;
        const target = this._resolveImageSequenceImportTarget(startFrame, frameCount);
        const lane = target?.lane || null;
        if (!lane) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const assetFolder = this._createNextClipAssetFolder();
        if (!assetFolder) {
            this._restoreTimelineHistoryState(beforeState);
            return false;
        }

        const sourceName = this._formatImportedSequenceName(options.name || options.kind || 'animated image');
        const created = [];
        let totalPixelBytes = 0;

        for (let index = 0; index < frameCount; index++) {
            const frame = frames[index] || {};
            const pixels = this._normalizeImportedFramePixels(frame, size);
            const snapshot = new DrawingSnapshotModel({
                width: size.width,
                height: size.height,
                rasterBounds: frame.rasterBounds || { x: 0, y: 0, width: size.width, height: size.height },
                pixels,
                isBlank: this._isRasterSnapshotBlank({ pixels })
            });
            this.model.drawingSnapshots.push(snapshot);
            totalPixelBytes += pixels.byteLength || 0;

            const internalLayer = this.model.createClipAssetInternalLayer({
                name: `Frame ${index + 1}`,
                type: 'raster',
                drawingSnapshotId: snapshot.id
            });
            const asset = new ClipAssetModel({
                name: `${sourceName} ${index + 1}`,
                type: 'raster',
                folderId: assetFolder.id,
                drawingSnapshotId: snapshot.id,
                internalLayers: [internalLayer]
            });
            this.model.clipAssets.push(asset);

            const clip = lane.addCel({
                assetId: asset.id,
                startFrame: startFrame + index,
                duration: 1,
                rasterSnapshot: this._createRasterSnapshotCompat(snapshot, {
                    drawingSnapshotId: snapshot.id,
                    includePixels: false
                })
            });
            if (!clip) {
                this._restoreTimelineHistoryState(beforeState);
                return false;
            }

            created.push({ clip, asset, internalLayer, snapshot });
        }

        const first = created[0];
        this.model.totalFrames = Math.max(this.model.totalFrames || 1, startFrame + frameCount);
        this.model.setCurrentFrame?.(startFrame);
        this.model.clampPlaybackSettings?.();
        this.selectedCelId = first.clip.id;
        this.activeLaneId = lane.id;
        this.isLaneOnlySelected = false;
        this.selectedAssetId = first.asset.id;
        this.selectedAssetFolderId = assetFolder.id;
        this.selectedInternalLayerId = first.internalLayer.id;
        this.initialClipAssetSeeded = true;
        this.model.tracks.forEach(track => {
            track.active = track.id === lane.id;
        });

        this._invalidateSnapshotTextureCache();
        this._syncClipAssetToWorkingLayers(first.clip, { forceRestore: true });
        this._resetCafPreviewRuntime('caf-image-sequence-import');
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-import-image-sequence', {
            type: 'caf-import-image-sequence',
            source: options.source || 'unknown',
            kind: options.kind || 'animated-image',
            frameCount,
            laneId: lane.id,
            createdLaneId: target.created ? lane.id : null,
            assetFolderId: assetFolder.id,
            startFrame,
            sourceWidth: options.sourceWidth || null,
            sourceHeight: options.sourceHeight || null,
            byteSize: totalPixelBytes
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _resolveImageSequenceImportTarget(frameIndex, frameCount) {
        const duration = Math.max(1, Math.round(Number(frameCount) || 1));
        this.model.totalFrames = Math.max(this.model.totalFrames || 1, frameIndex + duration);
        this.model.clampPlaybackSettings?.();
        return this._resolveSelectionPasteTarget(frameIndex, duration);
    }

    _normalizeImportedFramePixels(frame, size) {
        const expectedLength = size.width * size.height * 4;
        const pixels = frame?.pixels;
        if (pixels && typeof pixels.length === 'number') {
            const normalized = pixels instanceof Uint8ClampedArray
                ? new Uint8ClampedArray(pixels)
                : new Uint8ClampedArray(pixels);
            if (normalized.length === expectedLength) return normalized;
        }
        return new Uint8ClampedArray(expectedLength);
    }

    _formatImportedSequenceName(name) {
        const base = String(name || 'animated image')
            .replace(/\.[^.]+$/, '')
            .trim();
        return base || 'animated image';
    }

    _createCanvasPixelsFromFolderClipboardEntry(entry, payload, size) {
        const pixels = new Uint8ClampedArray(size.width * size.height * 4);
        if (!(entry?.pixels instanceof Uint8ClampedArray)) return pixels;

        const sourceWidth = Math.max(1, Math.round(entry.width || 1));
        const sourceHeight = Math.max(1, Math.round(entry.height || 1));
        const localBounds = entry.localBounds || {};
        const localX = Math.round(localBounds.x || 0);
        const localY = Math.round(localBounds.y || 0);
        const matrix = createCenteredTransformMatrix(
            entry.transform || {},
            size.width / 2,
            size.height / 2
        );
        const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
        if (Math.abs(determinant) < 1e-8) return pixels;

        const selection = payload.canvasBounds || {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height
        };
        const x0 = Math.max(0, Math.floor(selection.x || 0));
        const y0 = Math.max(0, Math.floor(selection.y || 0));
        const x1 = Math.min(size.width, Math.ceil((selection.x || 0) + (selection.width || 0)));
        const y1 = Math.min(size.height, Math.ceil((selection.y || 0) + (selection.height || 0)));

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const translatedX = x + 0.5 - matrix.tx;
                const translatedY = y + 0.5 - matrix.ty;
                const sourceCanvasX = (matrix.d * translatedX - matrix.c * translatedY) / determinant;
                const sourceCanvasY = (-matrix.b * translatedX + matrix.a * translatedY) / determinant;
                const sourceX = Math.floor(sourceCanvasX) - localX;
                const sourceY = Math.floor(sourceCanvasY) - localY;
                if (
                    sourceX < 0
                    || sourceY < 0
                    || sourceX >= sourceWidth
                    || sourceY >= sourceHeight
                ) {
                    continue;
                }
                const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
                const targetIndex = (y * size.width + x) * 4;
                pixels.set(entry.pixels.subarray(sourceIndex, sourceIndex + 4), targetIndex);
            }
        }
        return pixels;
    }

    _cloneClipInstanceMetadata(value, fallback = null) {
        if (value == null) return fallback;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return fallback;
        }
    }

    _clonePixelBufferForRuntime(pixels) {
        if (!pixels || typeof pixels.length !== 'number') return pixels || null;
        if (pixels instanceof Uint8ClampedArray) return new Uint8ClampedArray(pixels);
        return new Uint8ClampedArray(pixels);
    }

    _cloneDrawingSnapshotForRuntime(snapshot, options = {}) {
        if (!snapshot) return null;
        const sharePixels = options.sharePixels === true;
        return {
            id: snapshot.id,
            width: snapshot.width || 0,
            height: snapshot.height || 0,
            rasterBounds: normalizeRasterBounds(snapshot.rasterBounds, {
                width: snapshot.width || 1,
                height: snapshot.height || 1
            }),
            pixels: sharePixels ? (snapshot.pixels || null) : this._clonePixelBufferForRuntime(snapshot.pixels),
            isBlank: snapshot.isBlank === true,
            createdAt: snapshot.createdAt || Date.now(),
            updatedAt: snapshot.updatedAt || Date.now()
        };
    }

    _createRasterSnapshotCompat(snapshot, options = {}) {
        if (!snapshot) return null;
        const includePixels = options.includePixels === true;
        return {
            id: snapshot.id || null,
            drawingSnapshotId: options.drawingSnapshotId || snapshot.id || null,
            width: snapshot.width || 0,
            height: snapshot.height || 0,
            rasterBounds: normalizeRasterBounds(snapshot.rasterBounds, {
                width: snapshot.width || 1,
                height: snapshot.height || 1
            }),
            pixels: includePixels ? this._clonePixelBufferForRuntime(snapshot.pixels) : null,
            isBlank: snapshot.isBlank === true,
            updatedAt: snapshot.updatedAt || null
        };
    }

    _cloneRasterSnapshotForRuntime(rasterSnapshot, options = {}) {
        if (!rasterSnapshot) return null;
        const includePixels = options.includePixels === true;
        return {
            ...rasterSnapshot,
            rasterBounds: normalizeRasterBounds(rasterSnapshot.rasterBounds, {
                width: rasterSnapshot.width || 1,
                height: rasterSnapshot.height || 1
            }),
            pixels: includePixels ? this._clonePixelBufferForRuntime(rasterSnapshot.pixels) : null
        };
    }

    _cloneClipForTimelineHistory(clip) {
        if (!clip) return null;
        const assetId = clip.assetId || null;
        return {
            id: clip.id,
            sourceLayerId: clip.sourceLayerId,
            layerId: clip.layerId,
            assetId,
            startFrame: clip.startFrame,
            duration: clip.duration,
            isKeyframe: clip.isKeyframe,
            visible: clip.visible,
            transform: this._cloneClipInstanceMetadata(clip.transform, {}),
            transformKeyframes: this._cloneClipInstanceMetadata(clip.transformKeyframes, []),
            physics: this._cloneClipInstanceMetadata(clip.physics, {}),
            rasterSnapshot: this._cloneRasterSnapshotForRuntime(clip.rasterSnapshot, {
                includePixels: !assetId
            })
        };
    }

    _captureTimelineModelHistoryState() {
        return {
            fps: this.model.fps,
            totalFrames: this.model.totalFrames,
            tracks: (this.model.tracks || []).map(track => ({
                id: track.id,
                sourceLayerId: track.sourceLayerId,
                layerId: track.layerId,
                name: track.name,
                displayName: track.displayName,
                sourceName: track.sourceName,
                kind: track.kind,
                orderIndex: track.orderIndex,
                sourceMissing: track.sourceMissing,
                isBackground: track.isBackground,
                type: track.type,
                active: track.active,
                cels: (track.cels || []).map(clip => this._cloneClipForTimelineHistory(clip))
            })),
            clipAssetFolders: (this.model.clipAssetFolders || []).map(folder => folder.serialize ? folder.serialize() : { ...folder }),
            clipAssets: (this.model.clipAssets || []).map(asset => asset.serialize ? asset.serialize() : { ...asset }),
            drawingSnapshots: (this.model.drawingSnapshots || []).map(snapshot => {
                return this._cloneDrawingSnapshotForRuntime(snapshot, { sharePixels: true });
            }),
            playback: { ...(this.model.playback || {}) }
        };
    }

    pasteCopiedCel() {
        if (!this._copiedCelRef || !this.layerSystem) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const currentFrame = this.model.playback.currentFrame;
        const lane = this.activeLaneId
            ? this.model.getLaneById(this.activeLaneId)
            : null;
        if (!lane || lane.type === 'folder' || lane.isBackground) return false;

        // 重なりチェック
        if (!lane.canPlaceCel(currentFrame, this._copiedCelRef.duration)) {
            console.warn('[AnimationTable] Cannot paste: Space occupied');
            return false;
        }

        const duplicateAssetResult = this._copiedCelRef.assetId && this.model.duplicateClipAsset
            ? this.model.duplicateClipAsset(this._copiedCelRef.assetId)
            : null;
        if (this._copiedCelRef.assetId && duplicateAssetResult && !duplicateAssetResult.ok) {
            console.warn('[AnimationTable] Cannot paste: Failed to duplicate clip asset', duplicateAssetResult.reason);
            return false;
        }
        const pastedAsset = duplicateAssetResult?.ok ? duplicateAssetResult.asset : null;
        const pastedAssetId = pastedAsset?.id || this._copiedCelRef.assetId || null;
        const primarySnapshot = pastedAsset?.drawingSnapshotId
            ? this.model.getDrawingSnapshot(pastedAsset.drawingSnapshotId)
            : null;
        const pastedRasterSnapshot = primarySnapshot
            ? this._createRasterSnapshotCompat(primarySnapshot, {
                drawingSnapshotId: primarySnapshot.id,
                includePixels: false
            })
            : this._cloneRasterSnapshotForRuntime(this._copiedCelRef.rasterSnapshot, { includePixels: true });

        // 新規セル作成 (ClipInstanceModel)
        const newClip = lane.addCel({
            assetId: pastedAssetId,
            rasterSnapshot: pastedRasterSnapshot, // 互換用
            startFrame: currentFrame,
            duration: this._copiedCelRef.duration,
            transform: this._cloneClipInstanceMetadata(this._copiedCelRef.transform),
            transformKeyframes: this._cloneClipInstanceMetadata(this._copiedCelRef.transformKeyframes, []),
            physics: this._cloneClipInstanceMetadata(this._copiedCelRef.physics)
        });

        if (!newClip) {
            if (pastedAsset) {
                this._restoreTimelineHistoryState(beforeState);
            }
            return false;
        }

        this.selectedCelId = newClip.id;
        this.activeLaneId = lane.id;
        this._syncClipAssetToWorkingLayers(newClip, { forceRestore: true });
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-paste', {
            type: 'caf-clip-paste',
            clipId: newClip.id,
            assetId: newClip.assetId || null,
            sourceAssetId: this._copiedCelRef.assetId || null,
            duplicatedAssetId: pastedAsset?.id || null,
            laneId: lane.id,
            frameIndex: currentFrame
        });
        this.render();
        this._requestLayerPanelSync();
        return true;
    }

    canPasteCopiedCel() {
        if (!this._copiedCelRef || !this.layerSystem) return false;
        const currentFrame = this.model.playback.currentFrame;
        const lane = this.activeLaneId
            ? this.model.getLaneById(this.activeLaneId)
            : null;
        return !!lane
            && lane.type !== 'folder'
            && !lane.isBackground
            && lane.canPlaceCel(currentFrame, this._copiedCelRef.duration || 1);
    }

    canPasteCanvasSelection(clipboard = null) {
        if (!clipboard || !this.layerSystem) return false;
        if (clipboard.kind === 'folder-pixel-selection') {
            return clipboard.version === 1
                && Array.isArray(clipboard.entries)
                && clipboard.entries.some(entry => entry.type === 'raster');
        }
        if (!clipboard.pixels) return false;
        return this._hasAvailablePasteTarget(this.model.playback.currentFrame, 1);
    }

    _hasAvailablePasteTarget(frameIndex, duration = 1) {
        const isAvailable = (lane) => {
            return !!lane
                && lane.type !== 'folder'
                && !lane.isBackground
                && lane.canPlaceCel(frameIndex, duration);
        };
        const activeLane = this.activeLaneId ? this.model.getLaneById(this.activeLaneId) : null;
        return isAvailable(activeLane) || this.model.tracks.some(isAvailable);
    }

    canPasteLayerBlockAsNewCel(clipboard = null) {
        return !!(
            clipboard
            && clipboard.kind === 'layer-block'
            && clipboard.version === 1
            && Array.isArray(clipboard.layers)
            && clipboard.layers.some(entry => entry.type === 'raster' && entry.rasterSnapshot?.pixels)
            && this.layerSystem
            && this._hasAvailablePasteTarget(this.model.playback.currentFrame, 1)
        );
    }

    canPasteInternalLayerClipboardAsNewCel() {
        return !!(
            this._internalLayerClipboard?.layers?.some(entry => entry.layer?.type === 'raster' && entry.snapshot?.pixels)
            && this.layerSystem
            && this._hasAvailablePasteTarget(this.model.playback.currentFrame, 1)
        );
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

    _editInternalLayerInspectorNameInline(row, layerId) {
        const asset = this._getSelectedAssetForInspector();
        const layer = asset?.internalLayers?.find(item => item.id === layerId);
        const nameEl = row?.querySelector('.anim-internal-layer-name');
        if (!asset || !layer || !nameEl || nameEl.querySelector('input')) return false;

        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = layerId;

        const currentName = layer.name || 'Layer';
        const prefix = layer.type === 'folder' ? '[Folder] ' : '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'anim-internal-layer-name-input';
        nameEl.textContent = '';
        nameEl.appendChild(input);

        const finish = (shouldCommit) => {
            if (!input.parentNode) return;
            const nextName = input.value.trim();
            nameEl.textContent = `${prefix}${nextName || currentName}`;
            if (shouldCommit && nextName && nextName !== currentName) {
                this.renameInternalLayerFromExternal(asset.id, layerId, nextName, { source: 'animation-inspector-inline' });
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return true;
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

    _getInternalLayerEffectiveOpacity(asset, layer) {
        if (!layer) return 1;

        const byId = new Map((asset?.internalLayers || []).map(item => [item.id, item]));
        let opacity = typeof layer.opacity === 'number' ? layer.opacity : 1.0;
        let parentId = layer.parentLayerId || null;
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            visited.add(parentId);
            const parent = byId.get(parentId);
            if (!parent) break;
            const parentOpacity = typeof parent.opacity === 'number' ? parent.opacity : 1.0;
            opacity *= parentOpacity;
            parentId = parent.parentLayerId || null;
        }

        return Math.max(0, Math.min(1, opacity));
    }

    _getInternalLayerOwnOpacity(layer) {
        return Math.max(0, Math.min(1, typeof layer?.opacity === 'number' ? layer.opacity : 1.0));
    }

    _getInternalLayerEffectiveBlendMode(asset, layer) {
        if (!layer) return 'normal';
        // working Layerはflat adapterなので、フォルダblendは継承させない。
        // フォルダblendはCAF preview / onion / exportの再帰group合成側で適用する。
        return layer.blendMode || 'normal';
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
        if (!asset) return { ok: false, reason: 'asset-not-found' };

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
        return result;
    }

    addInternalFolder() {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !this.model.addClipAssetInternalFolder) return { ok: false, reason: 'unavailable' };

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
        return result;
    }

    createAssetFolder() {
        const name = prompt('Enter new folder name:');
        if (!name || !name.trim()) return;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const result = this.model.createClipAssetFolder({ name: name.trim() });
        if (result.ok) {
            this.selectedAssetFolderId = result.folder.id;
            this.selectedAssetId = null;
            this.selectedInternalLayerId = null;
            this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-folder-create', {
                type: 'caf-folder-create',
                folderId: result.folder.id,
                name: result.folder.name
            });
            this.render();
            this._flushLayerPanelSync();
        }
    }

    addIndependentLane() {
        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const lane = this.model.createIndependentLane();
        if (!lane) return null;
        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null;
        this.selectedInternalLayerId = null;
        this.isLaneOnlySelected = true;
        this._setActiveLane(lane.id);
        this._clearWorkingLayersForEmptyFrame();
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-lane-create', {
            type: 'caf-lane-create',
            laneId: lane.id
        });
        this.render();
        this._requestLayerPanelSync();
        return lane;
    }

    deleteActiveLane() {
        const lanes = this.model.tracks.filter(track => track.type !== 'folder' && !track.isBackground);
        if (lanes.length <= 1) return false;

        const targetIndex = Math.max(0, lanes.findIndex(lane => lane.id === this.activeLaneId));
        const targetLane = lanes[targetIndex] || lanes[0];
        if (!targetLane) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const removedLaneId = targetLane.id;
        const removedClipIds = (targetLane.cels || []).map(clip => clip.id);
        const modelIndex = this.model.tracks.findIndex(track => track.id === removedLaneId);
        if (modelIndex < 0) return false;

        this.model.tracks.splice(modelIndex, 1);
        this.includedLaneIds.delete(removedLaneId);
        const nextLane = lanes[targetIndex + 1] || lanes[targetIndex - 1] || null;
        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null;
        this.selectedInternalLayerId = null;
        if (nextLane) {
            this.isLaneOnlySelected = true;
            this._setActiveLane(nextLane.id);
            this._clearWorkingLayersForEmptyFrame();
        } else {
            this.isLaneOnlySelected = false;
            this.activeLaneId = null;
            this._syncWorkingLayersForCurrentFrame();
        }
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-lane-delete', {
            type: 'caf-lane-delete',
            laneId: removedLaneId,
            clipIds: removedClipIds
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    renameLane(laneId = this.activeLaneId, requestedName = null) {
        const lane = laneId ? this.model.getLaneById(laneId) : null;
        if (!lane || lane.type === 'folder' || lane.isBackground) return false;

        const currentName = this.model.getLaneDisplayName
            ? this.model.getLaneDisplayName(lane)
            : (lane.displayName || lane.name || 'Lane');
        const nextName = requestedName === null ? prompt('Lane name:', currentName) : requestedName;
        if (!nextName || !nextName.trim()) return false;
        const trimmedName = nextName.trim();
        if (trimmedName === currentName && trimmedName === (lane.displayName || lane.name)) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const oldName = lane.displayName || lane.name || currentName;
        lane.name = trimmedName;
        lane.displayName = trimmedName;
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-lane-rename', {
            type: 'caf-lane-rename',
            laneId: lane.id,
            oldName,
            newName: trimmedName
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    renameClipAssetFolderFromExternal(folderId, requestedName, options = {}) {
        const folder = folderId ? this.model.getClipAssetFolder(folderId) : null;
        if (!folder) return false;
        const nextName = typeof requestedName === 'string' ? requestedName.trim() : '';
        if (!nextName || nextName === folder.name) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const oldName = folder.name;
        const result = this.model.renameClipAssetFolder(folderId, nextName);
        if (!result.ok) return false;
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-folder-rename', {
            type: 'caf-folder-rename',
            folderId,
            oldName,
            newName: nextName,
            source: options.source || 'external'
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    renameSelectedAssetFolder() {
        if (this.selectedAssetFolderId === null) return;
        const folder = this.model.getClipAssetFolder(this.selectedAssetFolderId);
        if (!folder) return;

        const newName = prompt('Enter new folder name:', folder.name);
        if (!newName || !newName.trim()) return;

        this.renameClipAssetFolderFromExternal(this.selectedAssetFolderId, newName.trim(), {
            source: 'animation-asset-library-prompt'
        });
    }

    deleteSelectedAssetFolder() {
        if (!this.selectedAssetFolderId || !this.model.removeClipAssetFolder) return false;
        const folder = this.model.getClipAssetFolder(this.selectedAssetFolderId);
        if (!folder) return false;
        if (this.model.getClipAssetsInFolder(folder.id).length > 0) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const folderId = folder.id;
        const folderName = folder.name;
        const result = this.model.removeClipAssetFolder(folderId);
        if (!result.ok) return false;

        this.selectedAssetFolderId = null;
        this.selectedAssetId = null;
        this.selectedInternalLayerId = null;
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-folder-delete', {
            type: 'caf-folder-delete',
            folderId,
            name: folderName
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _editAssetFolderNameInline(folderItem) {
        const folderId = folderItem?.dataset?.folderId;
        if (!folderId || folderId === 'uncategorized') return false;
        const folder = this.model.getClipAssetFolder(folderId);
        const nameEl = folderItem.querySelector('.anim-lib-folder-name');
        if (!folder || !nameEl || nameEl.querySelector('input')) return false;

        this.selectedAssetFolderId = folderId;
        const currentName = folder.name || 'Folder';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'anim-lib-folder-name-input';
        nameEl.textContent = '';
        nameEl.appendChild(input);

        const finish = (shouldCommit) => {
            if (!input.parentNode) return;
            const nextName = input.value.trim();
            nameEl.textContent = nextName || currentName;
            if (shouldCommit && nextName && nextName !== currentName) {
                this.renameClipAssetFolderFromExternal(folderId, nextName, { source: 'animation-asset-library-inline' });
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return true;
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

        if ((asset.folderId || null) === targetFolderId) return;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const sourceFolderId = asset.folderId || null;
        const assetId = this.selectedAssetId;
        const result = this.model.moveClipAssetToFolder(assetId, targetFolderId);
        if (result.ok) {
            // 移動先フォルダを表示対象にする
            this.selectedAssetFolderId = targetFolderId;
            this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-asset-move-folder', {
                type: 'caf-asset-move-folder',
                assetId,
                sourceFolderId,
                targetFolderId
            });
            this.render();
            this._flushLayerPanelSync();
        }
    }

    deleteSelectedAssetFromLibrary() {
        if (!this.selectedAssetId || !this.model.removeClipAsset) return false;
        const asset = this.model.getClipAsset(this.selectedAssetId);
        if (!asset) return false;
        if (this.model.countAssetReferences(asset.id) > 0) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const folderId = asset.folderId || null;
        const assetId = asset.id;
        const result = this.model.removeClipAsset(assetId);
        if (!result.ok) return false;

        this.selectedAssetId = null;
        this.selectedInternalLayerId = null;
        this.selectedAssetFolderId = folderId;
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-asset-delete', {
            type: 'caf-asset-delete',
            assetId,
            folderId,
            removedSnapshotIds: result.removedSnapshotIds || []
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    renameClipAssetFromExternal(assetId, requestedName, options = {}) {
        const asset = assetId ? this.model.getClipAsset(assetId) : null;
        if (!asset || !this.model.renameClipAsset) return false;
        const nextName = typeof requestedName === 'string' ? requestedName.trim() : '';
        if (!nextName || nextName === asset.name) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const oldName = asset.name;
        const result = this.model.renameClipAsset(assetId, nextName);
        if (!result.ok) return false;
        this.selectedAssetId = assetId;
        this.selectedAssetFolderId = result.asset.folderId || null;
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-asset-rename', {
            type: 'caf-asset-rename',
            assetId,
            oldName,
            newName: nextName,
            source: options.source || 'external'
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _editAssetNameInline(assetItem) {
        const assetId = assetItem?.dataset?.assetId;
        const asset = assetId ? this.model.getClipAsset(assetId) : null;
        const nameEl = assetItem?.querySelector('.anim-lib-asset-name');
        if (!asset || !nameEl || nameEl.querySelector('input')) return false;

        this.selectedAssetId = assetId;
        const currentName = asset.name || 'Asset';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'anim-lib-asset-name-input';
        nameEl.textContent = '';
        nameEl.appendChild(input);

        const finish = (shouldCommit) => {
            if (!input.parentNode) return;
            const nextName = input.value.trim();
            nameEl.textContent = nextName || currentName;
            if (shouldCommit && nextName && nextName !== currentName) {
                this.renameClipAssetFromExternal(assetId, nextName, {
                    source: 'animation-asset-library-inline'
                });
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return true;
    }

    moveInternalLayer(layerId, direction, options = {}) {
        const asset = this._getSelectedAssetForInspector();
        if (!asset || !layerId) return { ok: false, reason: 'asset-not-found' };

        const shouldRecordHistory = options.recordHistory !== false;
        const beforeState = shouldRecordHistory
            ? (options.beforeState || this._captureInternalLayerHistoryState(asset))
            : null;
        const result = this._applyInternalLayerMoveByStep(asset, layerId, direction);
        if (result.ok) {
            this._syncSelectedClipToWorkingLayers();
            this.render();
            this._flushLayerPanelSync();
            if (shouldRecordHistory) {
                this._recordInternalLayerHistory(asset, beforeState, 'caf-internal-layer-reorder', {
                    type: 'caf-internal-layer-reorder',
                    layerId,
                    direction,
                    index: result.index
                });
            }
        }
        return result;
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
                    snapshot: this._cloneDrawingSnapshotForRuntime(snapshot)
                };
            });

        this._internalLayerClipboard = {
            rootLayerId: layerId,
            layers,
            copiedAt: Date.now()
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
                    rasterBounds: entry.snapshot.rasterBounds,
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

    canMergeInternalFolderToLayer(layerId = this.selectedInternalLayerId, asset = null) {
        const targetAsset = asset || this._getSelectedAssetForInspector();
        const folderLayer = (targetAsset?.internalLayers || []).find(layer => layer.id === layerId);
        if (!targetAsset || folderLayer?.type !== 'folder') return false;
        if (!this._isInternalLayerEffectivelyVisible(targetAsset, folderLayer)) return false;
        const subtreeIds = this._getInternalLayerSubtreeIds(targetAsset, layerId);
        return (targetAsset.internalLayers || []).some(layer => {
            if (!subtreeIds.has(layer.id) || layer.id === layerId || layer.type === 'folder') return false;
            if (!this._isInternalLayerEffectivelyVisible(targetAsset, layer)) return false;
            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            return !!snapshot?.pixels;
        });
    }

    _applyInternalLayerMergeDown(asset, layerId) {
        const layers = asset.internalLayers || [];
        const sourceIndex = layers.findIndex(layer => layer.id === layerId);
        const sourceLayer = layers[sourceIndex];
        if (!sourceLayer) return { ok: false, reason: 'layer-not-found' };
        if (sourceLayer.type === 'folder') {
            return this._applyInternalFolderMergeToLayer(asset, layerId);
        }
        if (sourceLayer.isBackground) {
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

    _applyInternalFolderMergeToLayer(asset, folderLayerId) {
        const layers = asset?.internalLayers || [];
        const folderIndex = layers.findIndex(layer => layer.id === folderLayerId);
        const folderLayer = layers[folderIndex];
        if (!folderLayer || folderLayer.type !== 'folder') return { ok: false, reason: 'folder-not-found' };
        if (!this.canMergeInternalFolderToLayer(folderLayerId, asset)) {
            return { ok: false, reason: 'empty-folder' };
        }

        const subtreeIds = this._getInternalLayerSubtreeIds(asset, folderLayerId);
        const mergedSnapshot = this._createInternalFolderCompositeSnapshot(asset, folderLayer);
        if (!mergedSnapshot) return { ok: false, reason: 'snapshot-merge-failed' };

        this.model.drawingSnapshots.push(mergedSnapshot);
        const mergedLayer = this.model.createClipAssetInternalLayer({
            name: `${folderLayer.name || 'Folder'} 結合`,
            type: 'raster',
            visible: folderLayer.visible !== false,
            opacity: 1,
            blendMode: 'normal',
            clipping: false,
            drawingSnapshotId: mergedSnapshot.id,
            parentLayerId: folderLayer.parentLayerId || null
        });

        const remainingLayers = layers.filter(layer => !subtreeIds.has(layer.id));
        const insertIndex = Math.min(folderIndex, remainingLayers.length);
        remainingLayers.splice(insertIndex, 0, mergedLayer);
        asset.internalLayers = remainingLayers;
        asset.updatedAt = Date.now();
        this.selectedInternalLayerId = mergedLayer.id;
        this._invalidateSnapshotTextureCache();
        this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(asset).length);
        this._syncSelectedClipToWorkingLayers({ forceRestore: true });
        this.render();
        this._flushLayerPanelSync();
        return { ok: true, asset, layer: mergedLayer, removedLayer: folderLayer, removedLayerIds: [...subtreeIds] };
    }

    _createInternalFolderCompositeSnapshot(asset, folderLayer) {
        const size = this._getCanvasSnapshotSize();
        const width = Math.max(1, Math.round(size.width || 1));
        const height = Math.max(1, Math.round(size.height || 1));
        const subtreeIds = this._getInternalLayerSubtreeIds(asset, folderLayer.id);
        const layersToDraw = (asset.internalLayers || [])
            .filter(layer => {
                return subtreeIds.has(layer.id)
                    && layer.id !== folderLayer.id
                    && layer.type !== 'folder'
                    && this._isInternalLayerEffectivelyVisible(asset, layer);
            })
            .reverse();
        if (layersToDraw.length === 0) return null;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let rendered = false;
        layersToDraw.forEach(layer => {
            const snapshot = this.model.getDrawingSnapshot(layer.drawingSnapshotId);
            if (!snapshot?.pixels) return;

            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = width;
            sourceCanvas.height = height;
            const sourceCtx = sourceCanvas.getContext('2d');
            if (!sourceCtx) return;
            this._putSnapshotPixels(sourceCtx, snapshot, width, height);

            if (layer.clipping === true) {
                sourceCtx.globalCompositeOperation = 'destination-in';
                sourceCtx.drawImage(canvas, 0, 0);
                sourceCtx.globalCompositeOperation = 'source-over';
            }

            ctx.globalAlpha = this._getInternalLayerEffectiveOpacity(asset, layer);
            ctx.globalCompositeOperation = this._canvasCompositeModeForBlendMode(layer.blendMode || 'normal');
            ctx.drawImage(sourceCanvas, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            rendered = true;
        });

        if (!rendered) return null;
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = new Uint8ClampedArray(imageData.data);
        const hasPixels = pixels.some((value, index) => index % 4 === 3 && value > 0);
        if (!hasPixels) return null;

        return new DrawingSnapshotModel({
            width,
            height,
            rasterBounds: { x: 0, y: 0, width, height },
            pixels,
            isBlank: false
        });
    }

    _captureInternalLayerHistoryState(asset) {
        if (!asset) return null;
        return this._captureActiveCafAssetHistoryState(asset);
    }

    _recordInternalLayerHistory(asset, beforeState, name, meta = {}) {
        if (!asset || !beforeState || !historyManager || historyManager.isApplying) return false;
        const afterState = this._captureInternalLayerHistoryState(asset);
        const byteSize = this._estimateActiveCafAssetHistoryBytes(beforeState)
            + this._estimateActiveCafAssetHistoryBytes(afterState);
        historyManager.record({
            name,
            do: () => this._restoreInternalLayerHistoryState(asset.id, afterState),
            undo: () => this._restoreInternalLayerHistoryState(asset.id, beforeState),
            byteSize,
            meta: {
                assetId: asset.id,
                historyKind: 'caf-asset',
                byteSize,
                ...meta
            }
        });
        return true;
    }

    _recordInternalLayerHistoryFromStates(asset, beforeState, afterState, name, meta = {}) {
        if (!asset || !beforeState || !afterState || !historyManager || historyManager.isApplying) return false;
        const byteSize = this._estimateActiveCafAssetHistoryBytes(beforeState)
            + this._estimateActiveCafAssetHistoryBytes(afterState);
        historyManager.record({
            name,
            do: () => this._restoreInternalLayerHistoryState(asset.id, afterState),
            undo: () => this._restoreInternalLayerHistoryState(asset.id, beforeState),
            byteSize,
            meta: {
                assetId: asset.id,
                historyKind: 'caf-asset',
                byteSize,
                ...meta
            }
        });
        return true;
    }

    _getClipAssetSnapshotRefs(asset) {
        const refs = new Set();
        if (asset?.drawingSnapshotId) refs.add(asset.drawingSnapshotId);
        (asset?.internalLayers || []).forEach(layer => {
            if (layer?.drawingSnapshotId) refs.add(layer.drawingSnapshotId);
        });
        return refs;
    }

    _captureActiveCafAssetHistoryState(asset) {
        if (!asset) return null;
        const snapshotRefs = this._getClipAssetSnapshotRefs(asset);
        return {
            assetId: asset.id,
            selectedCelId: this.selectedCelId || null,
            selectedAssetId: this.selectedAssetId || null,
            selectedAssetFolderId: this.selectedAssetFolderId || null,
            selectedInternalLayerId: this.selectedInternalLayerId || null,
            activeLaneId: this.activeLaneId || null,
            asset: asset.serialize ? asset.serialize() : { ...asset },
            drawingSnapshots: (this.model.drawingSnapshots || [])
                .filter(snapshot => snapshotRefs.has(snapshot.id))
                .map(snapshot => this._cloneDrawingSnapshotForRuntime(snapshot))
        };
    }

    _estimateActiveCafAssetHistoryBytes(state) {
        if (!state) return 0;
        return (state.drawingSnapshots || []).reduce((total, snapshot) => {
            return total + this._getTimelineSnapshotByteSize(snapshot);
        }, 0);
    }

    _restoreActiveCafAssetHistoryState(assetId, state) {
        if (!assetId || !state?.asset) return false;
        const targetIndex = (this.model.clipAssets || []).findIndex(asset => asset.id === assetId);
        if (targetIndex < 0) return false;

        this._resetCafPreviewRuntime('caf-asset-history-restore');
        const currentAsset = this.model.clipAssets[targetIndex];
        const currentRefs = this._getClipAssetSnapshotRefs(currentAsset);
        const nextAsset = new ClipAssetModel(state.asset);
        const nextRefs = this._getClipAssetSnapshotRefs(nextAsset);
        const refsFromOtherAssets = new Set();
        (this.model.clipAssets || []).forEach(asset => {
            if (!asset || asset.id === assetId) return;
            this._getClipAssetSnapshotRefs(asset).forEach(id => refsFromOtherAssets.add(id));
        });

        this.model.drawingSnapshots = (this.model.drawingSnapshots || []).filter(snapshot => {
            if (!snapshot?.id) return false;
            if (nextRefs.has(snapshot.id)) return true;
            return !currentRefs.has(snapshot.id) || refsFromOtherAssets.has(snapshot.id);
        });

        (state.drawingSnapshots || []).forEach(snapshot => {
            if (!snapshot?.id) return;
            const restored = new DrawingSnapshotModel({
                ...snapshot,
                pixels: this._clonePixelBufferForRuntime(snapshot.pixels)
            });
            const index = this.model.drawingSnapshots.findIndex(candidate => candidate.id === restored.id);
            if (index >= 0) {
                this.model.drawingSnapshots[index] = restored;
            } else {
                this.model.drawingSnapshots.push(restored);
            }
        });

        this.model.clipAssets[targetIndex] = nextAsset;
        const stateEntry = state.selectedCelId
            ? this.model.findClipEntry(state.selectedCelId)
            : null;
        const assetEntry = this._findClipEntryByAssetId(nextAsset.id);
        const restoreEntry = stateEntry?.clip?.assetId === nextAsset.id
            ? stateEntry
            : assetEntry;
        this.selectedCelId = restoreEntry?.clip?.id || state.selectedCelId || this.selectedCelId;
        this.selectedAssetId = state.selectedAssetId === nextAsset.id ? state.selectedAssetId : nextAsset.id;
        this.selectedAssetFolderId = state.selectedAssetFolderId || nextAsset.folderId || null;
        this.selectedInternalLayerId = state.selectedInternalLayerId
            || this._getDrawableInternalLayers(nextAsset)[0]?.id
            || null;
        this.activeLaneId = restoreEntry?.lane?.id || state.activeLaneId || this.activeLaneId;
        if (Number.isInteger(restoreEntry?.clip?.startFrame)) {
            this.model.setCurrentFrame(restoreEntry.clip.startFrame);
        }
        if (this.activeLaneId) {
            this.model.tracks.forEach(track => {
                track.active = track.id === this.activeLaneId;
            });
        }

        this._ensureWorkingLayerCapacity(this._getDrawableInternalLayers(nextAsset).length);
        const clipToSync = restoreEntry?.clip || this._findClipEntryByAssetId(nextAsset.id)?.clip;
        let syncOk = true;
        if (clipToSync) {
            syncOk = this._syncClipAssetToWorkingLayers(clipToSync, { forceRestore: true }) !== false;
        }
        this.render();
        this._flushLayerPanelSync();
        return syncOk;
    }

    _recordActiveCafAssetHistoryFromStates(asset, beforeState, afterState, name, meta = {}) {
        if (!asset || !beforeState || !afterState || !historyManager || historyManager.isApplying) return false;
        const byteSize = this._estimateActiveCafAssetHistoryBytes(beforeState)
            + this._estimateActiveCafAssetHistoryBytes(afterState);
        historyManager.record({
            name,
            do: () => this._restoreActiveCafAssetHistoryState(asset.id, afterState),
            undo: () => this._restoreActiveCafAssetHistoryState(asset.id, beforeState),
            byteSize,
            meta: {
                assetId: asset.id,
                historyKind: 'caf-asset',
                byteSize,
                ...meta
            }
        });
        return true;
    }

    _captureTimelineHistoryState() {
        const state = this._captureTimelineModelHistoryState();
        return {
            ...state,
            selectedCelId: this.selectedCelId || null,
            selectedAssetId: this.selectedAssetId || null,
            selectedAssetFolderId: this.selectedAssetFolderId || null,
            selectedInternalLayerId: this.selectedInternalLayerId || null,
            activeLaneId: this.activeLaneId || null,
            isLaneOnlySelected: this.isLaneOnlySelected === true,
            includedLaneIds: [...this.includedLaneIds],
            playbackScope: this.playbackScope
        };
    }

    _estimateTimelineHistoryStateBytes(state) {
        if (!state) return 0;
        let bytes = 0;
        (state.drawingSnapshots || []).forEach(snapshot => {
            bytes += snapshot?.pixels?.byteLength || snapshot?.pixels?.length || 0;
        });
        (state.tracks || []).forEach(track => {
            (track.cels || []).forEach(clip => {
                bytes += clip?.rasterSnapshot?.pixels?.byteLength || clip?.rasterSnapshot?.pixels?.length || 0;
            });
        });
        return bytes;
    }

    _getTimelineSnapshotByteSize(snapshot) {
        return snapshot?.pixels?.byteLength || snapshot?.pixels?.length || 0;
    }

    _getTimelineHistoryStateStats(state) {
        const snapshots = state?.drawingSnapshots || [];
        let pixelBytes = 0;
        let withPixels = 0;
        snapshots.forEach(snapshot => {
            const bytes = this._getTimelineSnapshotByteSize(snapshot);
            pixelBytes += bytes;
            if (bytes > 0) withPixels++;
        });
        return {
            snapshots: snapshots.length,
            snapshotsWithPixels: withPixels,
            snapshotPixelBytes: pixelBytes,
            tracks: state?.tracks?.length || 0,
            clipAssets: state?.clipAssets?.length || 0
        };
    }

    _estimateTimelineHistoryTransitionBytes(beforeState, afterState) {
        const beforeSnapshots = new Map();
        const afterSnapshots = new Map();
        (beforeState?.drawingSnapshots || []).forEach(snapshot => {
            if (snapshot?.id) beforeSnapshots.set(snapshot.id, snapshot);
        });
        (afterState?.drawingSnapshots || []).forEach(snapshot => {
            if (snapshot?.id) afterSnapshots.set(snapshot.id, snapshot);
        });

        let bytes = 0;
        afterSnapshots.forEach((afterSnapshot, snapshotId) => {
            const beforeSnapshot = beforeSnapshots.get(snapshotId);
            if (!beforeSnapshot || beforeSnapshot.pixels !== afterSnapshot.pixels) {
                bytes += this._getTimelineSnapshotByteSize(afterSnapshot);
            }
        });
        beforeSnapshots.forEach((beforeSnapshot, snapshotId) => {
            if (!afterSnapshots.has(snapshotId)) {
                bytes += this._getTimelineSnapshotByteSize(beforeSnapshot);
            }
        });

        (beforeState?.tracks || []).forEach(track => {
            (track.cels || []).forEach(clip => {
                bytes += clip?.rasterSnapshot?.pixels?.byteLength || clip?.rasterSnapshot?.pixels?.length || 0;
            });
        });
        (afterState?.tracks || []).forEach(track => {
            (track.cels || []).forEach(clip => {
                bytes += clip?.rasterSnapshot?.pixels?.byteLength || clip?.rasterSnapshot?.pixels?.length || 0;
            });
        });

        return bytes;
    }

    _recordTimelineHistory(beforeState, afterState, name, meta = {}) {
        if (!beforeState || !afterState || !historyManager || historyManager.isApplying) return false;
        const estimatedByteSize = this._estimateTimelineHistoryTransitionBytes(beforeState, afterState);
        const { byteSize = estimatedByteSize, ...historyMeta } = meta;
        const beforeStats = this._getTimelineHistoryStateStats(beforeState);
        const afterStats = this._getTimelineHistoryStateStats(afterState);
        historyManager.record({
            name,
            do: () => this._restoreTimelineHistoryState(afterState),
            undo: () => this._restoreTimelineHistoryState(beforeState),
            byteSize,
            meta: {
                historyKind: 'timeline',
                ...historyMeta,
                byteSize,
                beforeStateStats: beforeStats,
                afterStateStats: afterStats,
                timelineSnapshotRefs: beforeStats.snapshots + afterStats.snapshots,
                timelineSnapshotPixelBytes: beforeStats.snapshotPixelBytes + afterStats.snapshotPixelBytes
            }
        });
        return true;
    }

    deleteSelectedClip() {
        const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (!entry?.lane || !entry?.clip) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const removedCelId = entry.clip.id;
        const removedAssetId = entry.clip.assetId || null;
        const removedFrame = entry.clip.startFrame;
        const laneId = entry.lane.id;

        if (this.isClipEditModeActive) this.exitClipEditMode();
        entry.lane.removeCelAtFrame(removedFrame);
        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null;
        this.selectedInternalLayerId = null;
        this._syncWorkingLayersForCurrentFrame();
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-delete', {
            type: 'caf-clip-delete',
            clipId: removedCelId,
            assetId: removedAssetId,
            laneId,
            frameIndex: removedFrame
        });
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    deleteActiveSelection() {
        if (this.selectedCelId) {
            return this.deleteSelectedClip();
        }
        if (this.isLaneOnlySelected) {
            return this.deleteActiveLane();
        }
        return false;
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
        this.model.clampPlaybackSettings?.();
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
        this.isLaneOnlySelected = state.isLaneOnlySelected === true && !this.selectedCelId;
        this.includedLaneIds = new Set(Array.isArray(state.includedLaneIds) ? state.includedLaneIds : []);
        this.playbackScope = state.playbackScope || this.playbackScope || 'all';
        this._invalidateSnapshotTextureCache();

        const selectedEntry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
        if (selectedEntry?.clip) {
            this.activeLaneId = selectedEntry.lane?.id || this.activeLaneId;
            this.model.tracks.forEach(track => {
                track.active = track.id === this.activeLaneId;
            });
            this._activateClipEntry(selectedEntry, { saveCurrent: false });
        } else if (this.isLaneOnlySelected) {
            this._clearWorkingLayersForEmptyFrame();
        } else {
            this._syncWorkingLayersForCurrentFrame();
        }

        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _restoreInternalLayerHistoryState(assetId, state) {
        if (!assetId || !state) return false;
        if (state.asset) {
            return this._restoreActiveCafAssetHistoryState(assetId, state);
        }

        // Legacy fallback for history entries created before internal-layer
        // history became asset-scoped. New commands must not capture all CAFs.
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
            rasterBounds: { x: 0, y: 0, width, height },
            pixels: new Uint8ClampedArray(imageData.data),
            isBlank: false
        });
    }

    _putSnapshotPixels(ctx, snapshot, width, height) {
        if (!snapshot?.pixels) return false;
        const snapshotWidth = Math.max(1, Math.round(snapshot.width || width));
        const snapshotHeight = Math.max(1, Math.round(snapshot.height || height));
        const imageData = new ImageData(new Uint8ClampedArray(snapshot.pixels), snapshotWidth, snapshotHeight);
        const bounds = normalizeRasterBounds(snapshot.rasterBounds, {
            x: 0,
            y: 0,
            width: snapshotWidth,
            height: snapshotHeight
        });
        ctx.putImageData(imageData, bounds.x, bounds.y);
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
        if (!asset || !layerId) return { ok: false, reason: 'asset-not-found' };

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
        return result;
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

        const preserveSelection = options.preserveSelection === true;
        const previousSelection = {
            assetId: this.selectedAssetId || null,
            assetFolderId: this.selectedAssetFolderId || null,
            internalLayerId: this.selectedInternalLayerId || null
        };
        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.toggleClipAssetInternalLayerVisibility(asset.id, layerId);
        if (result.ok) {
            if (preserveSelection) {
                this.selectedAssetId = previousSelection.assetId;
                this.selectedAssetFolderId = previousSelection.assetFolderId;
                this.selectedInternalLayerId = previousSelection.internalLayerId;
                if (previousSelection.assetId === asset.id) {
                    if (result.layer?.type === 'folder') {
                        this._syncWorkingLayerDisplayAttributesFromAsset(asset);
                    } else if (previousSelection.internalLayerId === layerId) {
                        this._syncSelectedClipToWorkingLayers();
                    }
                }
            } else {
                this.selectedAssetId = asset.id;
                this.selectedAssetFolderId = asset.folderId || null;
                this.selectedInternalLayerId = layerId;
                this._syncSelectedClipToWorkingLayers();
            }

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

        const preserveSelection = options.preserveSelection === true;
        const previousSelection = {
            assetId: this.selectedAssetId || null,
            assetFolderId: this.selectedAssetFolderId || null,
            internalLayerId: this.selectedInternalLayerId || null
        };
        const beforeState = this._captureInternalLayerHistoryState(asset);
        const result = this.model.toggleClipAssetInternalLayerClipping(asset.id, layerId);
        if (result.ok) {
            if (preserveSelection) {
                this.selectedAssetId = previousSelection.assetId;
                this.selectedAssetFolderId = previousSelection.assetFolderId;
                this.selectedInternalLayerId = previousSelection.internalLayerId;
            } else {
                this.selectedAssetId = asset.id;
                this.selectedAssetFolderId = asset.folderId || null;
                this.selectedInternalLayerId = layerId;
            }
            if (result.layer?.type === 'folder') {
                this._invalidateSnapshotTextureCache();
            } else if (!preserveSelection || (previousSelection.assetId === asset.id && previousSelection.internalLayerId === layerId)) {
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

    setInternalLayerAttributesFromExternal(assetId, layerId, attributes = {}, options = {}) {
        const asset = this.model.getClipAsset(assetId);
        if (!asset) return { ok: false, reason: 'asset-not-found' };
        const layer = asset.internalLayers.find(item => item.id === layerId);
        if (!layer) return { ok: false, reason: 'layer-not-found' };

        const shouldRecordHistory = options.recordHistory !== false;
        const beforeState = shouldRecordHistory
            ? (options.beforeState || this._captureInternalLayerHistoryState(asset))
            : null;
        let changed = false;

        if (typeof attributes.opacity === 'number') {
            const nextOpacity = Math.max(0, Math.min(1, attributes.opacity));
            if (layer.opacity !== nextOpacity) {
                layer.opacity = nextOpacity;
                changed = true;
            }
        }

        if (typeof attributes.blendMode === 'string') {
            const nextBlendMode = attributes.blendMode || 'normal';
            if (layer.blendMode !== nextBlendMode) {
                layer.blendMode = nextBlendMode;
                changed = true;
            }
        }

        if (typeof attributes.clipping === 'boolean' && layer.type !== 'folder') {
            if (layer.clipping !== attributes.clipping) {
                layer.clipping = attributes.clipping;
                changed = true;
            }
        }

        if (!changed && !(options.forceHistory === true && options.beforeState)) {
            return { ok: true, asset, layer, changed: false };
        }

        layer.updatedAt = Date.now();
        asset.updatedAt = Date.now();
        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = layerId;

        if (layer.type === 'folder') {
            this._invalidateSnapshotTextureCache();
            this._syncWorkingLayerDisplayAttributesFromAsset(asset);
        } else {
            this._syncSelectedClipToWorkingLayers();
        }

        this.render();
        this._flushLayerPanelSync();
        if (shouldRecordHistory) {
            const historyName = options.historyName || 'caf-internal-layer-attributes';
            this._recordInternalLayerHistory(asset, beforeState, historyName, {
                type: historyName,
                layerId,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                clipping: layer.clipping === true
            });
        }
        return { ok: true, asset, layer, changed: true };
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

    updateClipTransformFromExternal(clipId, transform = {}, options = {}) {
        return this._updateClipMotionMetadataFromExternal('transform', clipId, transform, options);
    }

    updateClipTransformKeyframesFromExternal(clipId, keyframes = [], options = {}) {
        return this._updateClipMotionMetadataFromExternal('transformKeyframes', clipId, keyframes, options);
    }

    updateClipPhysicsFromExternal(clipId, physics = {}, options = {}) {
        return this._updateClipMotionMetadataFromExternal('physics', clipId, physics, options);
    }

    _updateClipMotionMetadataFromExternal(kind, clipId, value, options = {}) {
        const entry = this.model.findClipEntry(clipId);
        if (!entry?.clip) return { ok: false, reason: 'clip-not-found' };

        if (options.saveCurrent !== false) {
            this._saveSelectedClipFromWorkingLayers();
        }
        const beforeState = this._captureTimelineHistoryState();
        let result = { ok: false, reason: 'invalid-kind' };

        if (kind === 'transform') {
            result = this.model.setClipTransform(clipId, value);
        } else if (kind === 'transformKeyframes') {
            result = this.model.setClipTransformKeyframes(clipId, value);
        } else if (kind === 'physics') {
            result = this.model.setClipPhysics(clipId, value);
        }

        if (!result.ok) return result;

        this._activateClipEntry(result, { saveCurrent: false });
        this.render();
        this._flushLayerPanelSync();
        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), `caf-clip-${kind}`, {
            type: `caf-clip-${kind}`,
            clipId,
            assetId: result.clip.assetId || null,
            laneId: result.lane?.id || null,
            source: options.source || 'external'
        });
        return result;
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
        this._flushLayerPanelSync();
        this._emitAnimationLayerStatusUpdate();

        return { ok: true, clip, assetId: clip.assetId };
    }

    _activateClipEntry(entry, options = {}) {
        if (!entry?.clip) return false;
        this.isLaneOnlySelected = false;
        const changedClip = this.selectedCelId !== entry.clip.id;
        if (changedClip && (this._visibilityPreviewApplied || this.isDrawingPreviewSuspended)) {
            this.isDrawingPreviewSuspended = false;
            this._drawingPreviewCompositeKey = null;
            this._animationPreviewKey = null;
            this._restoreVisibility();
        }
        if (changedClip && options.saveCurrent !== false) {
            this._saveSelectedClipFromWorkingLayers();
        }
        this.selectedCelId = entry.clip.id;
        this.activeLaneId = entry.lane?.id || this.activeLaneId;
        const asset = entry.clip.assetId ? this.model.getClipAsset(entry.clip.assetId) : null;
        this.selectedAssetId = asset?.id || entry.clip.assetId || null;
        this.selectedAssetFolderId = asset?.folderId || null;
        if (Number.isInteger(entry.clip.startFrame)) {
            this.model.setCurrentFrame(entry.clip.startFrame);
        }
        this.model.tracks.forEach(track => {
            track.active = track.id === this.activeLaneId;
        });
        this._syncClipAssetToWorkingLayers(entry.clip, {
            forceRestore: changedClip || options.forceRestore === true
        });
        this._drawingPreviewCompositeKey = null;
        this._animationPreviewKey = null;
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

    _captureWorkingLayerTransformSignature() {
        return this._getRasterWorkingLayers().map(layer => {
            const layerData = layer?.layerData || {};
            return {
                id: layerData.id || null,
                snapshotId: layerData.animationSnapshotId || null,
                x: Number(layer?.position?.x || 0),
                y: Number(layer?.position?.y || 0),
                rotation: Number(layer?.rotation || 0),
                scaleX: Number(layer?.scale?.x ?? 1),
                scaleY: Number(layer?.scale?.y ?? 1),
                alpha: Number(layer?.alpha ?? layerData.opacity ?? 1),
                visible: layer?.visible !== false
            };
        });
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
                rasterBounds: rawSnapshot.rasterBounds,
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
                primaryRasterSnapshot = this._createRasterSnapshotCompat(drawingSnapshot, {
                    drawingSnapshotId: drawingSnapshot.id,
                    includePixels: false
                });
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
                id: primarySnapshot.id,
                drawingSnapshotId: primarySnapshot.id,
                width: primarySnapshot.width,
                height: primarySnapshot.height,
                rasterBounds: { ...primarySnapshot.rasterBounds },
                pixels: null,
                isBlank: true,
                updatedAt: primarySnapshot.updatedAt || null
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
            rasterBounds: { x: 0, y: 0, width: size.width, height: size.height },
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
        this._ensureWorkingLayerCapacity(drawableInternalLayers.length);
        const targetLayers = this._getRasterWorkingLayers();
        if (targetLayers.length === 0) return false;
        let restoreFailed = false;
        if (!drawableInternalLayers.some(layer => layer.id === this.selectedInternalLayerId)) {
            this.selectedInternalLayerId = drawableInternalLayers[0]?.id || null;
        }

        const visibleTargetLayers = [];
        drawableInternalLayers.forEach((internalLayer, index) => {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) return;

            const snapshot = this.model.getDrawingSnapshot(internalLayer.drawingSnapshotId);
            const snapshotId = internalLayer.drawingSnapshotId || null;
            if (snapshotId && !snapshot) {
                restoreFailed = true;
                console.warn('[AnimationTablePopup] Missing DrawingSnapshot for working layer restore', {
                    assetId: asset.id,
                    internalLayerId: internalLayer.id,
                    snapshotId
                });
                targetLayer.layerData.animationSnapshotId = null;
                targetLayer.visible = false;
                targetLayer.layerData.visible = false;
                return;
            }
            if (forceRestore || targetLayer.layerData.animationSnapshotId !== snapshotId) {
                const restoreSnapshot = snapshot
                    ? {
                        ...snapshot,
                        layerId: targetLayer.layerData.id,
                        pathsData: [],
                        paths: []
                    }
                    : this._createBlankRasterSnapshot(targetLayer.layerData.id);

                const restored = this.layerSystem.restoreLayerRasterSnapshot(restoreSnapshot);
                if (!restored) {
                    console.warn('[AnimationTablePopup] Working layer restore skipped for oversized snapshot', {
                        internalLayerId: internalLayer.id,
                        snapshotId,
                        width: restoreSnapshot.width,
                        height: restoreSnapshot.height
                    });
                    this.layerSystem.restoreLayerRasterSnapshot(this._createBlankRasterSnapshot(targetLayer.layerData.id));
                    targetLayer.layerData.animationSnapshotId = null;
                    targetLayer.visible = false;
                    targetLayer.layerData.visible = false;
                    restoreFailed = true;
                    return;
                }
                targetLayer.layerData.animationSnapshotId = snapshotId;
            }
            targetLayer.layerData.isAnimationWorkingLayer = true;
            targetLayer.layerData.name = internalLayer.name || targetLayer.layerData.name;
            const opacity = internalLayer.opacity ?? 1;
            const effectiveOpacity = this._getInternalLayerEffectiveOpacity(asset, internalLayer);
            const blendMode = this._getInternalLayerEffectiveBlendMode(asset, internalLayer);
            targetLayer.alpha = effectiveOpacity;
            targetLayer.blendMode = blendMode;
            if (targetLayer.layerData.layerSprite) {
                targetLayer.layerData.layerSprite.blendMode = blendMode;
            }
            targetLayer.layerData.opacity = opacity;
            targetLayer.layerData.effectiveOpacity = effectiveOpacity;
            targetLayer.layerData.blendMode = blendMode;
            targetLayer.layerData.clipping = internalLayer.clipping === true;
            targetLayer.layerData.parentId = internalLayer.parentLayerId || null;
            const isEffectivelyVisible = clip.visible !== false
                && this._isInternalLayerEffectivelyVisible(asset, internalLayer);
            targetLayer.visible = isEffectivelyVisible;
            targetLayer.layerData.visible = isEffectivelyVisible;
            if (isEffectivelyVisible) {
                visibleTargetLayers.push(targetLayer);
            }
        });

        for (let index = drawableInternalLayers.length; index < targetLayers.length; index++) {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) continue;
            if (forceRestore || targetLayer.layerData.animationSnapshotId !== null) {
                const restored = this.layerSystem.restoreLayerRasterSnapshot(this._createBlankRasterSnapshot(targetLayer.layerData.id));
                restoreFailed = !restored || restoreFailed;
                targetLayer.layerData.animationSnapshotId = null;
            }
            targetLayer.layerData.isAnimationWorkingLayer = true;
            targetLayer.layerData.parentId = null;
            targetLayer.visible = false;
            targetLayer.layerData.visible = false;
        }

        if (restoreFailed) {
            this._requestLayerPanelSync();
            return false;
        }

        this.layerSystem.refreshClippingMasks?.();
        visibleTargetLayers.forEach(layer => this._ensureWorkingLayerDisplaySurface(layer));
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

    selectAdjacentInternalLayerByDirection(direction) {
        const asset = this._getSelectedAssetForInspector();
        const layers = asset?.internalLayers || [];
        if (!asset || layers.length === 0) return false;

        const currentIndex = layers.findIndex(layer => layer.id === this.selectedInternalLayerId);
        const fallbackIndex = direction === 'up' ? layers.length : -1;
        const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
        const nextIndex = direction === 'up' ? baseIndex - 1 : baseIndex + 1;
        const nextLayer = layers[nextIndex];
        if (!nextLayer || nextLayer.id === this.selectedInternalLayerId) return false;

        this.selectedAssetId = asset.id;
        this.selectedAssetFolderId = asset.folderId || null;
        this.selectedInternalLayerId = nextLayer.id;
        this._syncActiveWorkingLayerToSelectedInternalLayer(asset);
        this.render();
        this._flushLayerPanelSync();
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

        if (this._isInternalFolderTransformWorkingLayer(activeLayer, asset)) {
            const folderLayer = this._getInternalFolderTransformSessionLayer(asset);
            if (folderLayer && this.selectedInternalLayerId !== folderLayer.id) {
                this.selectedInternalLayerId = folderLayer.id;
                this._requestLayerPanelSync();
            }
            return false;
        }

        const selectedInternalLayer = asset.internalLayers
            .find(layer => layer.id === this.selectedInternalLayerId);
        if (selectedInternalLayer?.type === 'folder') {
            // CAFフォルダ変形中は、代表working layerをactiveにしても選択正本は内部フォルダに保つ。
            const folderTransformContext = this._getSelectedInternalFolderTransformTargets(asset);
            if (folderTransformContext?.targets?.some(entry => entry.workingLayer === activeLayer)) {
                return false;
            }
        }

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

    _syncWorkingLayerDisplayAttributesFromAsset(asset) {
        if (!asset || !this.layerSystem) return false;
        const drawableInternalLayers = this._getDrawableInternalLayers(asset);
        const targetLayers = this._getRasterWorkingLayers();
        let changed = false;

        drawableInternalLayers.forEach((internalLayer, index) => {
            const targetLayer = targetLayers[index];
            if (!targetLayer?.layerData) return;

            const opacity = internalLayer.opacity ?? 1;
            const effectiveOpacity = this._getInternalLayerEffectiveOpacity(asset, internalLayer);
            const blendMode = this._getInternalLayerEffectiveBlendMode(asset, internalLayer);
            const isEffectivelyVisible = this._isInternalLayerEffectivelyVisible(asset, internalLayer);

            targetLayer.alpha = effectiveOpacity;
            targetLayer.blendMode = blendMode;
            if (targetLayer.layerData.layerSprite) {
                targetLayer.layerData.layerSprite.blendMode = blendMode;
            }
            targetLayer.layerData.opacity = opacity;
            targetLayer.layerData.effectiveOpacity = effectiveOpacity;
            targetLayer.layerData.blendMode = blendMode;
            targetLayer.layerData.clipping = internalLayer.clipping === true;
            targetLayer.layerData.parentId = internalLayer.parentLayerId || null;
            targetLayer.visible = isEffectivelyVisible;
            targetLayer.layerData.visible = isEffectivelyVisible;
            changed = true;
        });

        if (changed) {
            this.layerSystem.refreshClippingMasks?.();
            this._requestLayerPanelSync();
        }
        return changed;
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
            targetLayer.layerData.effectiveOpacity = 1;
            targetLayer.layerData.blendMode = 'normal';
            targetLayer.layerData.parentId = null;
            targetLayer.alpha = 1;
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
            const changedClip = this.selectedCelId !== clip.id;
            this.isLaneOnlySelected = false;
            this.selectedCelId = clip.id;
            this.selectedAssetId = clip.assetId || null;
            const asset = clip.assetId ? this.model.getClipAsset(clip.assetId) : null;
            this.selectedAssetFolderId = asset?.folderId || null;
            this.selectedInternalLayerId = null;
            this._syncClipAssetToWorkingLayers(clip, { forceRestore: changedClip });
            this._drawingPreviewCompositeKey = null;
            this._animationPreviewKey = null;
            return true;
        }

        this.isLaneOnlySelected = false;
        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedInternalLayerId = null;
        this._clearWorkingLayersForEmptyFrame();
        this._drawingPreviewCompositeKey = null;
        this._animationPreviewKey = null;
        return false;
    }

    _moveActiveLaneBy(delta) {
        const lanes = this.model.tracks.filter(track => track.type !== 'folder' && !track.isBackground);
        if (lanes.length === 0) return false;

        const foundIndex = lanes.findIndex(lane => lane.id === this.activeLaneId);
        const currentIndex = foundIndex >= 0
            ? foundIndex
            : (delta > 0 ? -1 : lanes.length);
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

    _moveSelectedClipWithinCurrentFrame(direction) {
        if (!this.selectedCelId || direction === 0) return false;

        const frameIndex = this.model.playback.currentFrame;
        const entries = this.model.tracks.map(lane => {
            if (lane.type === 'folder' || lane.isBackground) return null;
            const clip = lane.getCelAtFrame?.(frameIndex) || null;
            return clip ? { lane, track: lane, clip } : null;
        }).filter(Boolean);
        if (entries.length <= 1) return false;

        const currentIndex = entries.findIndex(entry => entry.clip.id === this.selectedCelId);
        if (currentIndex < 0) return false;
        const nextIndex = Math.max(0, Math.min(entries.length - 1, currentIndex + direction));
        const nextEntry = entries[nextIndex];
        if (!nextEntry || nextEntry.clip.id === this.selectedCelId) return false;

        this._activateClipEntry(nextEntry);
        this.render();
        this._flushLayerPanelSync();
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

    _selectLaneOnly(laneId) {
        this._saveSelectedClipFromWorkingLayers();
        if (!this._setActiveLane(laneId)) return false;
        this.selectedCelId = null;
        this.selectedAssetId = null;
        this.selectedAssetFolderId = null;
        this.selectedInternalLayerId = null;
        this.isLaneOnlySelected = true;
        this._clearWorkingLayersForEmptyFrame();
        this.render();
        this._flushLayerPanelSync();
        return true;
    }

    _editLaneNameInline(nameElement, laneId) {
        const lane = laneId ? this.model.getLaneById(laneId) : null;
        if (!nameElement || !lane || lane.type === 'folder' || lane.isBackground) return false;
        const currentName = this.model.getLaneDisplayName
            ? this.model.getLaneDisplayName(lane)
            : (lane.displayName || lane.name || 'Lane');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'anim-track-name-input';
        this._editingLaneNameInline = true;
        const editStartedAt = performance.now();

        const finishEdit = (shouldCommit) => {
            if (!input.parentNode) return;
            const nextName = input.value.trim();
            nameElement.textContent = nextName || currentName;
            input.replaceWith(nameElement);
            this._editingLaneNameInline = false;
            if (shouldCommit && nextName && nextName !== currentName) {
                this.renameLane(laneId, nextName);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finishEdit(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                input.value = currentName;
                finishEdit(false);
            }
        });
        input.addEventListener('blur', () => {
            if (performance.now() - editStartedAt < 160) {
                requestAnimationFrame(() => {
                    if (input.parentNode) input.focus();
                });
                return;
            }
            finishEdit(true);
        });
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());

        nameElement.replaceWith(input);
        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        return true;
    }

    render() {
        if (!this.panel || !this.isVisible) return;
        this.panel.style.setProperty('--anim-cell-width', `${this.timelineCellWidth}px`);
        this.panel.style.setProperty('--anim-cel-inset', '8px');
        
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
        this._updateHeaderNarrowState();
        this.panel.classList.toggle('clip-edit-active', this.isClipEditModeActive);
        this.panel.classList.toggle('set-scope-active', this.playbackScope === 'includedLanes');
        this.panel.classList.toggle('lane-only-selected', this.isLaneOnlySelected === true);
        
        // UI上のチェック状態同期
        const editChk = this.panel.querySelector('#anim-clip-edit-chk');
        if (editChk) {
            editChk.checked = this.isClipEditModeActive;
            editChk.disabled = !this._canEditSelectedClipAsset();
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

        const onionToggleBtn = this.panel.querySelector('#anim-onion-toggle-btn');
        if (onionToggleBtn) {
            const count = this.isOnionSkinActive
                ? Math.max(1, Math.min(4, Math.round(this.onionSkinFrameCount || 1)))
                : 0;
            onionToggleBtn.classList.toggle('is-active', count > 0);
            onionToggleBtn.setAttribute('aria-pressed', count > 0 ? 'true' : 'false');
            onionToggleBtn.title = count > 0
                ? `Timeline onion: 前後${count}フレーム`
                : 'Timeline onion: off';
            const countNode = onionToggleBtn.querySelector('.anim-onion-count');
            if (countNode) countNode.textContent = String(count);
        }

        const previewToggleBtn = this.panel.querySelector('#anim-preview-toggle-btn');
        if (previewToggleBtn) {
            previewToggleBtn.classList.toggle('active', this.isPreviewActive === true);
            previewToggleBtn.setAttribute('aria-pressed', this.isPreviewActive === true ? 'true' : 'false');
            previewToggleBtn.title = this.isPreviewActive
                ? 'PREVIEW ON: キャンバス表示をタイムラインに連動'
                : 'PREVIEW OFF: 通常Layer表示を優先';
        }

        const loopBtn = this.panel.querySelector('#anim-loop-toggle-btn');
        if (loopBtn) {
            const isLoop = this.model.playback.loop !== false;
            loopBtn.classList.toggle('active', isLoop);
            loopBtn.textContent = isLoop ? 'LOOP' : 'STOP';
            loopBtn.title = isLoop
                ? 'Loop ON: 終端後にIN/先頭へ戻る'
                : 'Loop OFF: 終端Frameで停止する';
        }

        const endModeBtn = this.panel.querySelector('#anim-end-mode-btn');
        if (endModeBtn) {
            const endMode = this.model.playback.endMode || 'timeline';
            const labelMap = {
                timeline: 'END:T',
                'last-clip': 'END:C',
                'out-marker': 'END:O'
            };
            const titleMap = {
                timeline: '終端: Timeline末尾',
                'last-clip': '終端: 再生Scope内の最後のCAF',
                'out-marker': '終端: OUT marker'
            };
            endModeBtn.textContent = labelMap[endMode] || labelMap.timeline;
            endModeBtn.title = `${titleMap[endMode] || titleMap.timeline}。クリックで切り替え`;
        }

        const inBtn = this.panel.querySelector('#anim-set-in-btn');
        const outBtn = this.panel.querySelector('#anim-set-out-btn');
        if (inBtn) {
            const isCurrentIn = this.model.playback.inFrame === this.model.playback.currentFrame;
            inBtn.classList.toggle('active', isCurrentIn);
            inBtn.title = isCurrentIn
                ? '現在FrameのIN markerを解除'
                : '現在FrameをIN markerに設定';
        }
        if (outBtn) {
            const isCurrentOut = this.model.playback.outFrame === this.model.playback.currentFrame;
            outBtn.classList.toggle('active', isCurrentOut);
            outBtn.title = isCurrentOut
                ? '現在FrameのOUT markerを解除'
                : '現在FrameをOUT markerに設定';
        }

        // ASSETSボタンの状態
        const assetsBtn = this.panel.querySelector('#anim-assets-toggle-btn');
        if (assetsBtn) {
            assetsBtn.classList.toggle('active', this.isAssetLibraryVisible);
        }

        const durationDecBtn = this.panel.querySelector('#anim-duration-dec');
        const durationIncBtn = this.panel.querySelector('#anim-duration-inc');
        if (durationDecBtn || durationIncBtn) {
            const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
            const clip = entry?.clip || null;
            const lane = entry?.lane || null;
            const canDecrease = !!clip && clip.duration > 1;
            const maxDuration = clip ? Math.max(1, this.model.totalFrames - clip.startFrame) : 1;
            const canIncrease = !!clip
                && !!lane
                && clip.duration < maxDuration
                && this._canAdjustSelectedCelDuration(1);
            if (durationDecBtn) {
                durationDecBtn.disabled = !canDecrease;
                durationDecBtn.title = canDecrease
                    ? '選択CAFのDurationを1短くする'
                    : 'Durationを短くできるCAFがありません';
            }
            if (durationIncBtn) {
                durationIncBtn.disabled = !canIncrease;
                durationIncBtn.title = canIncrease
                    ? '選択CAFのDurationを1長くする'
                    : 'Durationを長くできる空きがありません';
            }
        }

        const copyBtn = this.panel.querySelector('#anim-copy-btn');
        if (copyBtn) {
            copyBtn.disabled = !this.selectedCelId;
            copyBtn.title = this.selectedCelId
                ? '選択CAFをコピー (Ctrl+C)'
                : 'コピーするCAFを選択してください';
        }

        const pasteBtn = this.panel.querySelector('#anim-paste-btn');
        if (pasteBtn) {
            const selectionClipboard = window.pixelSelectionSystem?.getClipboardPayload?.() || null;
            const layerClipboard = window.drawingClipboard?.getClipboardPayload?.() || window.drawingClipboard?.get?.() || null;
            const canPaste = this.canPasteCopiedCel()
                || this.canPasteCanvasSelection(selectionClipboard)
                || this.canPasteLayerBlockAsNewCel(layerClipboard)
                || this.canPasteInternalLayerClipboardAsNewCel();
            pasteBtn.disabled = !canPaste;
            pasteBtn.title = canPaste
                ? '最新のCAF/選択範囲/レイヤー/フォルダを現在Frame/Laneへ貼り付け (Ctrl+V)'
                : '貼り付け可能なコピー元または空きセルがありません';
        }

        const zoomOutBtn = this.panel.querySelector('#anim-zoom-out-btn');
        const zoomInBtn = this.panel.querySelector('#anim-zoom-in-btn');
        const zoomValue = this.panel.querySelector('#anim-zoom-value');
        if (zoomOutBtn) zoomOutBtn.disabled = this.timelineCellWidth <= 18;
        if (zoomInBtn) zoomInBtn.disabled = this.timelineCellWidth >= 44;
        if (zoomValue) zoomValue.textContent = `${Math.round((this.timelineCellWidth / 30) * 100)}%`;

        const fpsInput = this.panel.querySelector('#anim-fps-input');
        if (fpsInput && document.activeElement !== fpsInput) {
            fpsInput.value = String(this.model.fps || 12);
        }
        const totalFramesInput = this.panel.querySelector('#anim-total-frames-input');
        if (totalFramesInput && document.activeElement !== totalFramesInput) {
            totalFramesInput.value = String(this.model.totalFrames || 24);
            totalFramesInput.min = String(this._getMinimumTotalFrames());
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
                    <span class="anim-axis-label anim-axis-label--lanes">
                        <button class="anim-lane-add-btn" title="Add independent animation Lane">+</button>
                        Lanes
                    </span>
                    <span class="anim-axis-label anim-axis-label--timeline">Timeline</span>
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
                    `<button class="anim-lane-include-btn${includeActive}" data-lane-id="${track.id}" title="${includeTitle}">${isIncluded ? '✓' : ''}</button>`;

                const displayIndex = (track.type === 'folder' || track.isBackground) ? null : visibleLaneIndex++;
                const displayName = this.model.getLaneDisplayName
                    ? this.model.getLaneDisplayName(track, displayIndex)
                    : (track.name || `Lane ${trackIndex + 1}`);

                trackHtml += `
                    <div class="anim-track-item${activeClass}${typeClass}" data-track-id="${track.id}">
                        <span class="anim-track-name">${this._escapeHtml(displayName)}</span>
                        ${includeBtn}
                    </div>`;
            });
            trackList.innerHTML = trackHtml;
        }
        
        if (timelineGrid) {
            const totalFrames = this.model.totalFrames;
            const currentFrame = this.model.playback.currentFrame;
            const showCurrentFrame = !this.isLaneOnlySelected;
            const inFrame = this.model.playback.inFrame;
            const outFrame = this.model.playback.outFrame;

            let headerHtml = `<div class="anim-timeline-header">`;
            for (let i = 0; i < totalFrames; i++) {
                const isCurrent = (showCurrentFrame && i === currentFrame) ? ' current' : '';
                const isInMarker = (inFrame === i) ? ' in-marker' : '';
                const isOutMarker = (outFrame === i) ? ' out-marker' : '';
                const markerLabel = (inFrame === i && outFrame === i) ? 'IN/OUT' : ((inFrame === i) ? 'IN' : ((outFrame === i) ? 'OUT' : ''));
                const markerBadge = markerLabel ? `<span class="anim-marker-badge">${markerLabel}</span>` : '';
                headerHtml += `<div class="anim-frame-num${isCurrent}${isInMarker}${isOutMarker}" data-frame-index="${i}">${i + 1}${markerBadge}</div>`;
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
                    const isCurrent = (showCurrentFrame && i === currentFrame) ? ' current-col' : '';
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
                    
                    const duration = isStart ? Math.max(1, Math.min(cel.duration, totalFrames)) : 0;
                    const durationClass = isStart ? ` duration-${duration}` : '';
                    const retimingEdge = (isStart && this._isRetiming && this._retimingData?.cel?.id === cel.id)
                        ? (this._retimingData.edge === 'left' ? 'left' : 'right')
                        : '';
                    const retimingBlockedClass = (retimingEdge && this._retimingData?.blocked) ? ' retiming-blocked' : '';
                    const retimingClass = retimingEdge ? ` retiming retiming-${retimingEdge}${retimingBlockedClass}` : '';
                    gridHtml += `<div class="anim-cell-slot${isCurrent}${hasCelClass}${selectedClass}" 
                                     data-track-id="${track.id}" 
                                     data-frame-index="${i}">
                                     ${isStart ? `<div class="anim-cel-block${selectedClass}${editingClass}${hasSnapshotClass}${sharedClass}${durationClass}${retimingClass}" data-cel-id="${cel.id}">
                                         <div class="anim-cel-handle anim-cel-handle--left" data-cel-id="${cel.id}" data-edge="left"></div>
                                         <div class="anim-cel-handle anim-cel-handle--right" data-cel-id="${cel.id}" data-edge="right"></div>
                                         ${duration === 1 ? `<div class="anim-cel-resize-grip" aria-hidden="true">
                                             <div class="anim-cel-handle anim-cel-handle--bottom-left" data-cel-id="${cel.id}" data-edge="left"></div>
                                             <div class="anim-cel-handle anim-cel-handle--bottom-right" data-cel-id="${cel.id}" data-edge="right"></div>
                                         </div>` : ''}
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
        if (this.isLaneOnlySelected) {
            this._restoreVisibility();
        } else if (this.isDrawingPreviewSuspended) {
            if (this.isPreviewActive) {
                this._applyDrawingVisibilityPreview();
            } else {
                this.isDrawingPreviewSuspended = false;
                this._restoreVisibility();
            }
        } else if (this.isClipEditModeActive || this.isTransformPreviewSuspended) {
            // EDIT/変形中は合成を停止し、実レイヤー表示を優先する。
            this._restoreVisibility();
        } else if (this.isPreviewActive) {
            this._applyVisibilityPreview();
        } else if (this.isOnionSkinActive && !this.isPlaying) {
            this._applyTimelineOnionOnlyPreview();
        } else {
            this._restoreVisibility();
        }
        this._scheduleLaneReferencePreviewUpdate();

        const deleteActiveBtn = this.panel.querySelector('#anim-delete-active-btn');
        if (deleteActiveBtn) {
            const laneCount = this.model.tracks.filter(track => track.type !== 'folder' && !track.isBackground).length;
            const canDeleteClip = !!this.selectedCelId;
            const canDeleteLane = this.isLaneOnlySelected && !!this.activeLaneId && laneCount > 1;
            deleteActiveBtn.disabled = !(canDeleteClip || canDeleteLane);
            const title = canDeleteLane
                ? 'アクティブLaneを削除 (Alt+Delete / Alt+Backspace)'
                : '選択CAFを削除 (Alt+Delete / Alt+Backspace)';
            deleteActiveBtn.title = title;
            deleteActiveBtn.setAttribute('aria-label', canDeleteLane ? 'Delete active Lane' : 'Delete selected CAF');
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
                    <div class="anim-playback-controls" title="再生範囲・終端・ループ">
                        <button class="anim-playback-btn" id="anim-loop-toggle-btn" title="Loop ON/OFF">LOOP</button>
                        <button class="anim-playback-btn" id="anim-end-mode-btn" title="終端基準を切り替え">END:T</button>
                        <button class="anim-playback-btn" id="anim-set-in-btn" title="現在FrameをIN markerに設定">IN</button>
                        <button class="anim-playback-btn" id="anim-set-out-btn" title="現在FrameをOUT markerに設定">OUT</button>
                    </div>
                    <button class="anim-preview-toggle" id="anim-preview-toggle-btn" title="PREVIEW OFF: 通常Layer表示を優先" aria-pressed="false">PREVIEW</button>
                    <button class="anim-onion-toggle" id="anim-onion-toggle-btn" title="Timeline onion: off">
                        <span class="anim-onion-icon">${UI_ICONS.onionSkin}</span>
                        <span class="anim-onion-count">0</span>
                    </button>
                    <div class="anim-timeline-settings" title="Timeline settings">
                        <label class="anim-setting-field">FPS
                            <input type="number" id="anim-fps-input" min="1" max="60" step="1" value="${this.model.fps}">
                        </label>
                        <label class="anim-setting-field">FRAMES
                            <input type="number" id="anim-total-frames-input" min="1" max="240" step="1" value="${this.model.totalFrames}">
                        </label>
                    </div>
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
                        <button class="anim-tool-btn anim-delete-btn anim-icon-btn" id="anim-delete-active-btn" title="選択CAFを削除 (Alt+Delete / Alt+Backspace)" aria-label="Delete selected CAF">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M9 11v6"/><path d="M15 11v6"/></svg>
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
            <div class="anim-zoom-controls" title="Timeline zoom">
                <button class="anim-zoom-btn" id="anim-zoom-out-btn" aria-label="Zoom out timeline">-</button>
                <span class="anim-zoom-value" id="anim-zoom-value">100%</span>
                <button class="anim-zoom-btn" id="anim-zoom-in-btn" aria-label="Zoom in timeline">+</button>
            </div>
            <div class="anim-asset-library" id="anim-asset-library">
                <!-- Library content will be rendered here -->
            </div>
            <div class="anim-resize-handle" title="Resize animation table" aria-hidden="true"></div>
        `;
        
        document.body.appendChild(this.panel);
        this.panel.addEventListener('contextmenu', (e) => {
            if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
            e.preventDefault();
            e.stopPropagation();
        });
        
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
        const selectedFolderAssetCount = this.selectedAssetFolderId
            ? this.model.getClipAssetsInFolder(this.selectedAssetFolderId).length
            : 0;
        const canDeleteSelectedFolder = !!this.selectedAssetFolderId && selectedFolderAssetCount === 0;

        // 2. アセット一覧の生成
        const assets = this.model.getClipAssetsInFolder(this.selectedAssetFolderId);
        let assetHtml = '';
        const selectedLibraryAsset = this.selectedAssetId ? this.model.getClipAsset(this.selectedAssetId) : null;
        const selectedAssetRefCount = selectedLibraryAsset ? this.model.countAssetReferences(selectedLibraryAsset.id) : 0;
        const canDeleteSelectedAsset = !!selectedLibraryAsset && selectedAssetRefCount === 0;
        
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
                        <button class="anim-folder-delete-btn" title="${canDeleteSelectedFolder ? 'Delete empty selected folder' : 'Only empty folders can be deleted'}" ${canDeleteSelectedFolder ? '' : 'disabled'}>DEL</button>
                    </div>
                </div>
                <div class="anim-lib-list ui-scrollbar">${folderHtml}</div>
            </div>
            <div class="anim-lib-assets">
                <div class="anim-lib-label">
                    ASSETS
                    <div class="anim-lib-asset-actions">
                        <button class="anim-asset-move-btn" title="Move selected asset to folder" ${!this.selectedAssetId ? 'disabled' : ''}>MOVE</button>
                        <button class="anim-asset-delete-btn" title="${canDeleteSelectedAsset ? 'Delete unreferenced selected asset' : 'Only unreferenced assets can be deleted'}" ${canDeleteSelectedAsset ? '' : 'disabled'}>DEL</button>
                    </div>
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
            this.model.detachLaneSourceLayer?.(targetLane.id);
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
            assetId: asset.id,
            startFrame: 0,
            duration: 1,
            rasterSnapshot // 互換用
        });

        if (newClip) {
            this.model.detachLaneSourceLayer?.(targetLane.id);
            // 自動作成されたクリップを選択状態にする
            this.selectedCelId = newClip.id;
            this.activeLaneId = targetLane.id;
            this.selectedAssetId = asset.id;
            this.selectedAssetFolderId = asset.folderId || null;
            this.selectedInternalLayerId = this._getDrawableInternalLayers(asset)[0]?.id || null;
            this._syncClipAssetToWorkingLayers(newClip, { forceRestore: true });
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
                    const selectedFolderItem = libraryPanel.querySelector(`.anim-lib-folder-item.selected[data-folder-id="${this.selectedAssetFolderId || ''}"]`);
                    if (!this._editAssetFolderNameInline(selectedFolderItem)) {
                        this.renameSelectedAssetFolder();
                    }
                    return;
                }
                if (e.target.closest('.anim-folder-delete-btn')) {
                    this.deleteSelectedAssetFolder();
                    return;
                }
                // アセット移動 (Phase 4z11)
                if (e.target.closest('.anim-asset-move-btn')) {
                    this.moveSelectedAssetToFolder();
                    return;
                }
                if (e.target.closest('.anim-asset-delete-btn')) {
                    this.deleteSelectedAssetFromLibrary();
                    return;
                }

                // フォルダ選択
                const folderItem = e.target.closest('.anim-lib-folder-item');
                if (folderItem) {
                    if (e.target.closest('.anim-lib-folder-name') && e.detail >= 2) {
                        this._editAssetFolderNameInline(folderItem);
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
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
                    if (e.target.closest('.anim-lib-asset-name') && e.detail >= 2) {
                        this._editAssetNameInline(assetItem);
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
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
                        this._editInternalLayerInspectorNameInline(internalLayerItem, layerId);
                        return;
                    }
                    if (e.target.closest('.anim-internal-layer-name') && e.detail >= 2) {
                        this._editInternalLayerInspectorNameInline(internalLayerItem, layerId);
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

        const previewToggleBtn = this.panel.querySelector('#anim-preview-toggle-btn');
        if (previewToggleBtn) {
            previewToggleBtn.addEventListener('click', (e) => {
                this.isPreviewActive = !this.isPreviewActive;
                if (!this.isPreviewActive) {
                    this.isDrawingPreviewSuspended = false;
                    this._drawingPreviewCompositeKey = null;
                    this._restoreVisibility();
                }
                e.currentTarget.blur();
                this.render();
            });
        }

        const onionToggleBtn = this.panel.querySelector('#anim-onion-toggle-btn');
        if (onionToggleBtn) {
            onionToggleBtn.addEventListener('click', (e) => {
                this.cycleTimelineOnionSkin();
                e.currentTarget.blur();
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

        const fpsInput = this.panel.querySelector('#anim-fps-input');
        const totalFramesInput = this.panel.querySelector('#anim-total-frames-input');
        if (fpsInput) {
            fpsInput.addEventListener('change', () => this._updateTimelineSettingsFromInputs());
            fpsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    fpsInput.blur();
                }
                e.stopPropagation();
            });
        }
        if (totalFramesInput) {
            totalFramesInput.addEventListener('change', () => this._updateTimelineSettingsFromInputs());
            totalFramesInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    totalFramesInput.blur();
                }
                e.stopPropagation();
            });
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
            pasteBtn.addEventListener('click', () => this.pasteBestClipboardAtCurrentCell());
        }

        const deleteActiveBtn = this.panel.querySelector('#anim-delete-active-btn');
        if (deleteActiveBtn) {
            deleteActiveBtn.addEventListener('click', () => this.deleteActiveSelection());
        }

        const zoomOutBtn = this.panel.querySelector('#anim-zoom-out-btn');
        const zoomInBtn = this.panel.querySelector('#anim-zoom-in-btn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this._adjustTimelineZoom(-1));
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this._adjustTimelineZoom(1));
        }

        const timelineViewport = this.panel.querySelector('.anim-table-viewport');
        if (timelineViewport) {
            timelineViewport.addEventListener('wheel', (e) => {
                if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;

                if (e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.deltaY === 0) return;
                    this._adjustTimelineZoom(e.deltaY < 0 ? 1 : -1);
                    return;
                }

                if (e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    timelineViewport.scrollLeft += e.deltaX || e.deltaY;
                    return;
                }

                if (e.deltaY !== 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    timelineViewport.scrollTop += e.deltaY;
                }
            }, { passive: false });

            timelineViewport.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                if (!this._timelineSpacePressed) return;
                if (e.target.closest('button, input, label, select, textarea, [contenteditable="true"], .anim-cel-block, .anim-cel-handle, .anim-cel-resize-grip')) return;

                const rect = timelineViewport.getBoundingClientRect();
                const trackListWidth = this.panel.querySelector('.anim-track-list')?.getBoundingClientRect().width || 0;
                const localX = e.clientX - rect.left;
                const anchorContentX = timelineViewport.scrollLeft + localX;
                this._timelineViewportGesture = {
                    mode: e.shiftKey ? 'zoom' : 'pan',
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    startScrollLeft: timelineViewport.scrollLeft,
                    startScrollTop: timelineViewport.scrollTop,
                    startCellWidth: this.timelineCellWidth,
                    startZoomIndex: Math.max(0, TIMELINE_ZOOM_STEPS.indexOf(this.timelineCellWidth)),
                    anchorLocalX: localX,
                    anchorTimelineX: Math.max(0, anchorContentX - trackListWidth),
                    trackListWidth
                };
                this._timelineGestureMoved = false;
                this.panel.classList.add(e.shiftKey ? 'timeline-zoom-dragging' : 'timeline-pan-dragging');
                try {
                    timelineViewport.setPointerCapture?.(e.pointerId);
                } catch (error) {}
                document.addEventListener('pointermove', this._onTimelineViewportPointerMove, { passive: false });
                document.addEventListener('pointerup', this._onTimelineViewportPointerUp);
                document.addEventListener('pointercancel', this._onTimelineViewportPointerUp);
                e.preventDefault();
                e.stopPropagation();
            });
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

        const loopBtn = this.panel.querySelector('#anim-loop-toggle-btn');
        if (loopBtn) {
            loopBtn.addEventListener('click', () => this._togglePlaybackLoop());
        }

        const endModeBtn = this.panel.querySelector('#anim-end-mode-btn');
        if (endModeBtn) {
            endModeBtn.addEventListener('click', () => this._cyclePlaybackEndMode());
        }

        const setInBtn = this.panel.querySelector('#anim-set-in-btn');
        if (setInBtn) {
            setInBtn.addEventListener('click', () => this._togglePlaybackMarker('inFrame'));
        }

        const setOutBtn = this.panel.querySelector('#anim-set-out-btn');
        if (setOutBtn) {
            setOutBtn.addEventListener('click', () => this._togglePlaybackMarker('outFrame'));
        }

        // Phase 4z2: Lane include ボタン (イベント委譲)
        const trackList = this.panel.querySelector('.anim-track-list');
        if (trackList) {
            trackList.addEventListener('click', (e) => {
                if (this._timelineGestureMoved) return;
                if (e.target.closest('.anim-lane-add-btn')) {
                    this.addIndependentLane();
                    e.stopPropagation();
                    return;
                }

                const includeBtn = e.target.closest('.anim-lane-include-btn');
                if (includeBtn && this.playbackScope === 'includedLanes') {
                    const laneId = includeBtn.dataset.laneId;
                    if (this.includedLaneIds.has(laneId)) {
                        this.includedLaneIds.delete(laneId);
                    } else {
                        this.includedLaneIds.add(laneId);
                    }
                    this.render();
                    e.stopPropagation();
                    return;
                }

                const laneItem = e.target.closest('.anim-track-item');
                if (laneItem) {
                    this._selectLaneOnly(laneItem.dataset.trackId);
                    e.stopPropagation();
                }
            });

        }

        const timelineGrid = this.panel.querySelector('.anim-timeline-grid');
        if (timelineGrid) {
            timelineGrid.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            timelineGrid.addEventListener('click', (e) => {
                // ドラッグ・伸縮・移動中なら無視
                if (this._dragMoved || this._retimingMoved || this._clipMoveMoved || this._timelineGestureMoved) {
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

                // Ctrl+Click でClipを作成/削除する。通常クリックは選択/Frame移動のみ。
                if (e.ctrlKey || e.metaKey) {
                    if (existingCel) {
                        this._activateClipEntry({ lane: track, track, clip: existingCel }, { saveCurrent: true });
                        this.deleteSelectedClip();
                    } else {
                        this._saveSelectedClipFromWorkingLayers();
                        const beforeState = this._captureTimelineHistoryState();
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
                            assetId: asset.id,
                            startFrame: frameIndex,
                            duration: 1,
                            // 互換用にも代表スナップショットを保持
                            rasterSnapshot: this._createRasterSnapshotCompat(snapshot, {
                                drawingSnapshotId: snapshot.id,
                                includePixels: false
                            })
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
                    // 通常クリック：既存Clipの選択、またはFrame移動。空セルのClip作成はCtrl+Clickに限定する。
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

            // ポインター操作：リタイミング または クリップ移動
            timelineGrid.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                // 1. リタイミング（左右端ハンドル）
                const handle = e.target.closest('.anim-cel-handle');
                if (handle) {
                    const celId = handle.dataset.celId;
                    const entry = this.model.findClipEntry(celId);

                    let shouldStartRetiming = !!entry;
                    if (shouldStartRetiming && e.pointerType === 'pen' && (entry.clip?.duration || 1) <= 1) {
                        const blockRect = handle.closest('.anim-cel-block')?.getBoundingClientRect();
                        const edge = handle.dataset.edge === 'left' ? 'left' : 'right';
                        const isBottomGrip = handle.classList.contains('anim-cel-handle--bottom-left') ||
                            handle.classList.contains('anim-cel-handle--bottom-right');
                        // 単セルCAFのペン操作では、セル内側は移動、外側の隙間寄りだけ伸縮にする。
                        shouldStartRetiming = isBottomGrip || (blockRect
                            ? (edge === 'left' ? e.clientX <= blockRect.left + 2 : e.clientX >= blockRect.right - 2)
                            : false);
                    }
                    if (shouldStartRetiming) {
                        const { lane, clip } = entry;
                        this._saveSelectedClipFromWorkingLayers();
                        this._isRetiming = true;
                        this._retimingMoved = false;
                        this._retimingData = {
                            cel: clip,
                            track: lane,
                            edge: handle.dataset.edge === 'left' ? 'left' : 'right',
                            startFrame: clip.startFrame,
                            startDuration: clip.duration,
                            startX: e.clientX,
                            laneSnapshot: (lane.cels || []).map(cel => ({
                                id: cel.id,
                                startFrame: cel.startFrame,
                                duration: cel.duration
                            })),
                            beforeState: this._captureTimelineHistoryState()
                        };

                        this._activateClipEntry(entry);
                        this.render();

                        document.addEventListener('pointermove', this._onRetimingMouseMove, { passive: false });
                        document.addEventListener('pointerup', this._onRetimingMouseUp);
                        document.addEventListener('pointercancel', this._onRetimingMouseUp);
                        e.stopPropagation();
                        e.preventDefault();
                    }
                    if (shouldStartRetiming) return;
                }

                // 2. クリップ移動（ブロック本体）
                const block = e.target.closest('.anim-cel-block');
                if (block) {
                    const clipId = block.dataset.celId;
                    const entry = this.model.findClipEntry(clipId);
                    if (!entry) return;

                    this._saveSelectedClipFromWorkingLayers();
                    this._isClipMoving = true;
                    this._clipMoveMoved = false;
                    this._clipMoveData = {
                        clipId,
                        startX: e.clientX,
                        startY: e.clientY,
                        sourceLaneId: entry.lane.id,
                        sourceStartFrame: entry.clip.startFrame,
                        beforeState: this._captureTimelineHistoryState()
                    };
                    
                    this._activateClipEntry(entry);
                    // ドラッグ中は少し透明にするなどのフィードバック
                    block.classList.add('moving');

                    document.addEventListener('pointermove', this._onClipMoveMouseMove, { passive: false });
                    document.addEventListener('pointerup', this._onClipMoveMouseUp);
                    document.addEventListener('pointercancel', this._onClipMoveMouseUp);
                    
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        }

        // ドラッグ移動の実装
        const header = this.panel.querySelector('.anim-table-header');
        header.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            if (e.target.closest('button, input, label, .anim-scope-controls, .anim-playback-controls, .anim-duration-controls, .anim-capture-controls, .anim-copy-paste-controls, .anim-timeline-settings')) return;
            
            this._isDragging = true;
            this._dragMoved = false;
            this._dragPointerId = e.pointerId;
            this._dragOffset.x = e.clientX - this._panelPos.x;
            this._dragOffset.y = e.clientY - this._panelPos.y;
            
            try {
                header.setPointerCapture?.(e.pointerId);
            } catch (err) {}
            document.addEventListener('pointermove', this._onMouseMove, { passive: false });
            document.addEventListener('pointerup', this._onMouseUp);
            document.addEventListener('pointercancel', this._onMouseUp);
            e.preventDefault();
        });

        this._onMouseMove = (e) => {
            if (!this._isDragging) return;
            if (this._dragPointerId !== undefined && e.pointerId !== this._dragPointerId) return;
            e.preventDefault?.();
            this._dragMoved = true;
            this._panelPos.x = e.clientX - this._dragOffset.x;
            this._panelPos.y = e.clientY - this._dragOffset.y;
            
            // 画面内クランプ
            this._panelPos.x = Math.max(0, Math.min(window.innerWidth - 200, this._panelPos.x));
            this._panelPos.y = Math.max(0, Math.min(window.innerHeight - 40, this._panelPos.y));
            
            this._updatePanelPosition();
        };

        this._onMouseUp = (e = null) => {
            if (e && this._dragPointerId !== undefined && e.pointerId !== this._dragPointerId) return;
            this._isDragging = false;
            try {
                header.releasePointerCapture?.(this._dragPointerId);
            } catch (err) {}
            this._dragPointerId = null;
            document.removeEventListener('pointermove', this._onMouseMove);
            document.removeEventListener('pointerup', this._onMouseUp);
            document.removeEventListener('pointercancel', this._onMouseUp);
            this._clampPanelPlacement();
            this._saveUiPreferences();
            setTimeout(() => {
                this._dragMoved = false;
            }, 0);
        };

        this._onTimelineViewportPointerMove = (e) => {
            const gesture = this._timelineViewportGesture;
            if (!gesture || e.pointerId !== gesture.pointerId) return;

            const deltaX = e.clientX - gesture.startX;
            const deltaY = e.clientY - gesture.startY;
            if (!this._timelineGestureMoved && Math.hypot(deltaX, deltaY) < 4) return;
            this._timelineGestureMoved = true;
            e.preventDefault();

            if (gesture.mode === 'pan') {
                timelineViewport.scrollLeft = gesture.startScrollLeft - deltaX;
                timelineViewport.scrollTop = gesture.startScrollTop - deltaY;
                return;
            }

            const zoomStepDelta = Math.trunc(-deltaY / 28);
            const nextIndex = Math.max(
                0,
                Math.min(TIMELINE_ZOOM_STEPS.length - 1, gesture.startZoomIndex + zoomStepDelta)
            );
            const nextCellWidth = TIMELINE_ZOOM_STEPS[nextIndex];
            if (!nextCellWidth || nextCellWidth === this.timelineCellWidth) return;

            const scaleRatio = nextCellWidth / gesture.startCellWidth;
            this._adjustTimelineZoom(nextIndex - TIMELINE_ZOOM_STEPS.indexOf(this.timelineCellWidth));
            timelineViewport.scrollLeft = gesture.trackListWidth
                + (gesture.anchorTimelineX * scaleRatio)
                - gesture.anchorLocalX;
        };

        this._onTimelineViewportPointerUp = (e = null) => {
            const gesture = this._timelineViewportGesture;
            if (!gesture || (e && e.pointerId !== gesture.pointerId)) return;
            try {
                timelineViewport.releasePointerCapture?.(gesture.pointerId);
            } catch (error) {}
            this._timelineViewportGesture = null;
            this.panel.classList.remove('timeline-pan-dragging', 'timeline-zoom-dragging');
            document.removeEventListener('pointermove', this._onTimelineViewportPointerMove);
            document.removeEventListener('pointerup', this._onTimelineViewportPointerUp);
            document.removeEventListener('pointercancel', this._onTimelineViewportPointerUp);
            if (this._timelineGestureMoved) {
                setTimeout(() => {
                    this._timelineGestureMoved = false;
                }, 0);
            }
        };

        const resizeHandle = this.panel.querySelector('.anim-resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('pointerdown', (e) => {
                if (e.button !== undefined && e.button !== 0) return;
                const rect = this.panel.getBoundingClientRect();
                this._isResizing = true;
                this._resizePointerId = e.pointerId;
                this._resizeStart = {
                    x: e.clientX,
                    y: e.clientY,
                    width: rect.width,
                    height: rect.height
                };
                try {
                    resizeHandle.setPointerCapture?.(e.pointerId);
                } catch (err) {}
                document.addEventListener('pointermove', this._onResizeMouseMove, { passive: false });
                document.addEventListener('pointerup', this._onResizeMouseUp);
                document.addEventListener('pointercancel', this._onResizeMouseUp);
                e.preventDefault();
                e.stopPropagation();
            });
        }

        this._onResizeMouseMove = (e) => {
            if (!this._isResizing || !this._resizeStart) return;
            if (this._resizePointerId !== undefined && e.pointerId !== this._resizePointerId) return;
            e.preventDefault?.();
            const minWidth = 460;
            const minHeight = 180;
            const maxWidth = Math.max(minWidth, window.innerWidth - this._panelPos.x - 8);
            const maxHeight = Math.max(minHeight, window.innerHeight - this._panelPos.y - 8);
            const nextWidth = Math.max(minWidth, Math.min(maxWidth, this._resizeStart.width + (e.clientX - this._resizeStart.x)));
            const nextHeight = Math.max(minHeight, Math.min(maxHeight, this._resizeStart.height + (e.clientY - this._resizeStart.y)));

            this._panelSize.width = nextWidth;
            this._panelSize.height = nextHeight;
            this._updatePanelPosition();
        };

        this._onResizeMouseUp = (e = null) => {
            if (e && this._resizePointerId !== undefined && e.pointerId !== this._resizePointerId) return;
            this._isResizing = false;
            this._resizeStart = null;
            try {
                resizeHandle?.releasePointerCapture?.(this._resizePointerId);
            } catch (err) {}
            this._resizePointerId = null;
            document.removeEventListener('pointermove', this._onResizeMouseMove);
            document.removeEventListener('pointerup', this._onResizeMouseUp);
            document.removeEventListener('pointercancel', this._onResizeMouseUp);
            this._clampPanelPlacement();
            this._updatePanelPosition();
            this._saveUiPreferences();
        };

        this._onRetimingMouseMove = (e) => {
            if (!this._isRetiming || !this._retimingData) return;
            e.preventDefault?.();
            this._retimingMoved = true;

            const deltaX = e.clientX - this._retimingData.startX;
            const deltaFrames = Math.round(deltaX / this.timelineCellWidth);

            const applied = this._applyRetimingWithPush(this._retimingData, deltaFrames);
            this._retimingData.blocked = !applied;
            this.render();
        };

        this._onRetimingMouseUp = () => {
            const retimingData = this._retimingData;
            const retimingBlock = retimingData?.cel?.id
                ? this.panel.querySelector(`.anim-cel-block[data-cel-id="${retimingData.cel.id}"]`)
                : null;
            retimingBlock?.classList.remove('retiming', 'retiming-left', 'retiming-right', 'retiming-blocked');
            const startFrameChanged = retimingData?.cel?.startFrame !== retimingData?.startFrame;
            const durationChanged = retimingData?.cel?.duration !== retimingData?.startDuration;
            if (this._retimingMoved && retimingData?.cel && (startFrameChanged || durationChanged)) {
                this._recordTimelineHistory(retimingData.beforeState, this._captureTimelineHistoryState(), 'caf-clip-retime', {
                    type: 'caf-clip-retime',
                    clipId: retimingData.cel.id,
                    assetId: retimingData.cel.assetId || null,
                    laneId: retimingData.track?.id || null,
                    frameIndex: retimingData.cel.startFrame,
                    beforeStartFrame: retimingData.startFrame,
                    afterStartFrame: retimingData.cel.startFrame,
                    beforeDuration: retimingData.startDuration,
                    afterDuration: retimingData.cel.duration,
                    edge: retimingData.edge || 'right'
                });
            }
            this._isRetiming = false;
            this._retimingData = null;
            document.removeEventListener('pointermove', this._onRetimingMouseMove);
            document.removeEventListener('pointerup', this._onRetimingMouseUp);
            document.removeEventListener('pointercancel', this._onRetimingMouseUp);
            setTimeout(() => {
                this._retimingMoved = false;
                this._requestLayerPanelSync(); // Phase 4z21
            }, 0);
        };

        this._onClipMoveMouseMove = (e) => {
            if (!this._isClipMoving || !this._clipMoveData) return;
            e.preventDefault?.();

            const dx = e.clientX - this._clipMoveData.startX;
            const dy = e.clientY - this._clipMoveData.startY;
            
            if (!this._clipMoveMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                this._clipMoveMoved = true;
                // 移動開始のフィードバック
                const block = this.panel.querySelector(`.anim-cel-block[data-cel-id="${this._clipMoveData.clipId}"]`);
                if (block) block.classList.add('moving');
            }

            this._updateClipMovePreview(e.clientX, e.clientY);
        };

        this._onClipMoveMouseUp = (e) => {
            if (!this._isClipMoving || !this._clipMoveData) return;

            if (this._clipMoveMoved) {
                // ドロップ先の解決
                const slot = this._getClipMoveTargetSlot(e.clientX, e.clientY);

                if (slot) {
                    const targetLaneId = slot.dataset.trackId;
                    const targetFrame = parseInt(slot.dataset.frameIndex, 10);
                    
                    const movedToNewSlot = targetLaneId !== this._clipMoveData.sourceLaneId
                        || targetFrame !== this._clipMoveData.sourceStartFrame;
                    const result = this.model.moveClip(this._clipMoveData.clipId, targetLaneId, targetFrame);
                    if (result.ok) {
                        this.selectedCelId = result.clip.id;
                        this.activeLaneId = result.lane.id;
                        this.model.setCurrentFrame(result.clip.startFrame);
                        this.model.tracks.forEach(track => {
                            track.active = track.id === result.lane.id;
                        });
                        this._syncClipAssetToWorkingLayers(result.clip, { forceRestore: true });
                        if (movedToNewSlot) {
                            this._recordTimelineHistory(this._clipMoveData.beforeState, this._captureTimelineHistoryState(), 'caf-clip-move', {
                                type: 'caf-clip-move',
                                clipId: result.clip.id,
                                assetId: result.clip.assetId || null,
                                fromLaneId: this._clipMoveData.sourceLaneId,
                                toLaneId: result.lane.id,
                                fromFrame: this._clipMoveData.sourceStartFrame,
                                toFrame: result.clip.startFrame
                            });
                        }
                    }
                }
            }

            this._isClipMoving = false;
            this._clipMoveData = null;
            this._clearClipMovePreview();
            document.removeEventListener('pointermove', this._onClipMoveMouseMove);
            document.removeEventListener('pointerup', this._onClipMoveMouseUp);
            document.removeEventListener('pointercancel', this._onClipMoveMouseUp);
            
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
        if (this._panelSize.width !== null) {
            this.panel.style.width = `${this._panelSize.width}px`;
        }
        if (this._panelSize.height !== null) {
            this.panel.style.height = `${this._panelSize.height}px`;
        }
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
        this._updateHeaderNarrowState();
    }

    _updateHeaderNarrowState() {
        if (!this.panel) return;
        const width = this._panelSize.width || this.panel.getBoundingClientRect().width || 0;
        this.panel.classList.toggle('is-narrow', width > 0 && width <= 760);
    }

    _adjustSelectedCelDuration(delta) {
        if (!this.selectedCelId) return;

        const entry = this.model.findClipEntry(this.selectedCelId);
        if (entry) {
            const { lane, clip } = entry;
            const maxDuration = Math.max(1, this.model.totalFrames - clip.startFrame);
            const newDuration = Math.max(1, Math.min(maxDuration, clip.duration + delta));
            if (newDuration === clip.duration) return;
            this._saveSelectedClipFromWorkingLayers();
            const beforeState = this._captureTimelineHistoryState();
            const previousDuration = clip.duration;
            const retimingData = {
                cel: clip,
                track: lane,
                edge: 'right',
                startFrame: clip.startFrame,
                startDuration: clip.duration,
                laneSnapshot: (lane.cels || []).map(cel => ({
                    id: cel.id,
                    startFrame: cel.startFrame,
                    duration: cel.duration
                }))
            };
            if (this._applyRetimingWithPush(retimingData, newDuration - previousDuration)) {
                this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-clip-duration', {
                    type: 'caf-clip-duration',
                    clipId: clip.id,
                    assetId: clip.assetId || null,
                    laneId: lane.id,
                    frameIndex: clip.startFrame,
                    beforeDuration: previousDuration,
                    afterDuration: newDuration
                });
                this.render();
                this._requestLayerPanelSync();
            }
        }
    }

    _canAdjustSelectedCelDuration(delta) {
        if (!this.selectedCelId) return false;
        const entry = this.model.findClipEntry(this.selectedCelId);
        if (!entry?.lane || !entry.clip) return false;

        const { lane, clip } = entry;
        const maxDuration = Math.max(1, this.model.totalFrames - clip.startFrame);
        const newDuration = Math.max(1, Math.min(maxDuration, clip.duration + delta));
        if (newDuration === clip.duration) return false;

        const laneSnapshot = (lane.cels || []).map(cel => ({
            id: cel.id,
            startFrame: cel.startFrame,
            duration: cel.duration
        }));
        const ok = this._applyRetimingWithPush({
            cel: clip,
            track: lane,
            edge: 'right',
            startFrame: clip.startFrame,
            startDuration: clip.duration,
            laneSnapshot
        }, newDuration - clip.duration);
        this._restoreRetimingLaneSnapshot(lane, laneSnapshot);
        return ok;
    }

    _getMinimumTotalFrames() {
        let minFrames = 1;
        for (const lane of this.model.tracks || []) {
            for (const clip of lane.cels || []) {
                minFrames = Math.max(minFrames, clip.startFrame + clip.duration);
            }
        }
        return Math.max(minFrames, (this.model.playback?.currentFrame || 0) + 1);
    }

    _updateTimelineSettingsFromInputs() {
        const fpsInput = this.panel?.querySelector('#anim-fps-input');
        const totalFramesInput = this.panel?.querySelector('#anim-total-frames-input');
        if (!fpsInput && !totalFramesInput) return false;

        const currentFps = this.model.fps || 12;
        const currentTotalFrames = this.model.totalFrames || 24;
        const nextFps = fpsInput
            ? Math.max(1, Math.min(60, Math.round(Number(fpsInput.value) || currentFps)))
            : currentFps;
        const minTotalFrames = this._getMinimumTotalFrames();
        const nextTotalFrames = totalFramesInput
            ? Math.max(minTotalFrames, Math.min(240, Math.round(Number(totalFramesInput.value) || currentTotalFrames)))
            : currentTotalFrames;

        if (fpsInput) fpsInput.value = String(nextFps);
        if (totalFramesInput) {
            totalFramesInput.min = String(minTotalFrames);
            totalFramesInput.value = String(nextTotalFrames);
        }
        if (nextFps === currentFps && nextTotalFrames === currentTotalFrames) return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.stop();

        this.model.fps = nextFps;
        this.model.totalFrames = nextTotalFrames;
        this.model.clampPlaybackSettings?.();

        this._recordTimelineHistory(beforeState, this._captureTimelineHistoryState(), 'caf-timeline-settings', {
            type: 'caf-timeline-settings',
            beforeFps: currentFps,
            afterFps: nextFps,
            beforeTotalFrames: currentTotalFrames,
            afterTotalFrames: nextTotalFrames
        });
        this.render();
        this._requestLayerPanelSync();
        if (wasPlaying) this.play();
        return true;
    }

    _applyPlaybackSetting(mutator, historyName, meta = {}) {
        if (typeof mutator !== 'function') return false;

        this._saveSelectedClipFromWorkingLayers();
        const beforeState = this._captureTimelineHistoryState();
        const beforePlayback = JSON.stringify(beforeState.playback || {});
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.stop();

        mutator(this.model.playback);
        this.model.clampPlaybackSettings?.();

        const afterState = this._captureTimelineHistoryState();
        const afterPlayback = JSON.stringify(afterState.playback || {});
        if (beforePlayback === afterPlayback) {
            this.render();
            if (wasPlaying) this.play();
            return false;
        }

        this._recordTimelineHistory(beforeState, afterState, historyName, meta);
        this.render();
        this._requestLayerPanelSync();
        if (wasPlaying) this.play();
        return true;
    }

    _togglePlaybackLoop() {
        return this._applyPlaybackSetting((playback) => {
            playback.loop = playback.loop === false;
        }, 'caf-playback-loop', {
            type: 'caf-playback-loop'
        });
    }

    _cyclePlaybackEndMode() {
        const modes = ['timeline', 'last-clip', 'out-marker'];
        return this._applyPlaybackSetting((playback) => {
            const currentIndex = Math.max(0, modes.indexOf(playback.endMode || 'timeline'));
            playback.endMode = modes[(currentIndex + 1) % modes.length];
        }, 'caf-playback-end-mode', {
            type: 'caf-playback-end-mode'
        });
    }

    _togglePlaybackMarker(markerKey) {
        if (markerKey !== 'inFrame' && markerKey !== 'outFrame') return false;
        const historyName = markerKey === 'inFrame' ? 'caf-playback-in-marker' : 'caf-playback-out-marker';
        return this._applyPlaybackSetting((playback) => {
            const currentFrame = this.model.playback.currentFrame;
            playback[markerKey] = playback[markerKey] === currentFrame ? null : currentFrame;
        }, historyName, {
            type: historyName,
            marker: markerKey
        });
    }

    _adjustTimelineZoom(delta) {
        const currentIndex = TIMELINE_ZOOM_STEPS.findIndex(width => width >= this.timelineCellWidth);
        const baseIndex = currentIndex >= 0 ? currentIndex : TIMELINE_ZOOM_STEPS.indexOf(30);
        const nextIndex = Math.max(0, Math.min(TIMELINE_ZOOM_STEPS.length - 1, baseIndex + delta));
        const nextWidth = TIMELINE_ZOOM_STEPS[nextIndex];
        if (!nextWidth || nextWidth === this.timelineCellWidth) return false;

        this.timelineCellWidth = nextWidth;
        this._saveUiPreferences();
        this.render();
        return true;
    }

    _injectStyles() {
        if (document.getElementById('animation-table-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'animation-table-styles';
        const durationWidthCss = Array.from({ length: 240 }, (_, index) => {
            const duration = index + 1;
            return `.anim-cel-block.duration-${duration} { width: calc(var(--anim-cell-width) * ${duration} - var(--anim-cel-inset)); }`;
        }).join('\n');
        style.textContent = `
            .animation-table-panel {
                position: fixed;
                --anim-cell-width: 30px;
                --anim-cel-inset: 8px;
                bottom: 20px;
                left: 70px;
                width: calc(100vw - 320px);
                height: 260px;
                min-width: 460px;
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
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                position: relative;
                font-size: 11px;
                font-weight: bold;
                cursor: move;
                flex-shrink: 0;
                border-bottom: 1px solid rgba(128, 0, 0, 0.2);
                gap: 6px 10px;
                touch-action: none;
            }

            html[data-tegaki-shortcut-context="canvas"] .animation-table-panel {
                border-color: rgba(128, 0, 0, 0.32);
                box-shadow: 0 8px 22px rgba(128, 0, 0, 0.08);
            }

            html[data-tegaki-shortcut-context="canvas"] .animation-table-panel .anim-table-header,
            html[data-tegaki-shortcut-context="canvas"] .animation-table-panel .anim-table-viewport {
                opacity: 0.72;
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
                flex: 1 1 380px;
                flex-wrap: wrap;
            }

            .anim-table-header-center {
                flex: 1 1 220px;
                justify-content: center;
            }

            .anim-table-header-right {
                justify-content: flex-end;
                flex: 0 0 auto;
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
                height: 22px;
                min-width: 58px;
                padding: 0 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--futaba-light-medium);
                border-radius: 5px;
                background: transparent;
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                opacity: 0.72;
                user-select: none;
                transition: background 0.2s, border-color 0.2s, opacity 0.2s;
            }

            .anim-preview-toggle:hover {
                background: rgba(128, 0, 0, 0.08);
                opacity: 0.95;
            }

            .anim-preview-toggle.active {
                background: rgba(255, 102, 0, 0.18);
                border-color: var(--futaba-salmon);
                color: var(--futaba-maroon);
                opacity: 1;
            }

            .anim-onion-toggle {
                margin-left: 6px;
                height: 22px;
                min-width: 42px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
                padding: 0 5px;
                background: transparent;
                border: 1px solid var(--futaba-light-medium);
                border-radius: 5px;
                color: var(--futaba-maroon);
                cursor: pointer;
                transition: background 0.2s, border-color 0.2s;
            }

            .anim-onion-toggle:hover {
                background: rgba(128, 0, 0, 0.08);
                border-color: var(--futaba-medium);
            }

            .anim-onion-toggle.is-active {
                background: rgba(255, 102, 0, 0.18);
                border-color: rgba(255, 102, 0, 0.45);
            }

            .anim-onion-toggle .anim-onion-icon,
            .anim-onion-toggle .anim-onion-icon svg {
                width: 13px;
                height: 13px;
                display: inline-flex;
            }

            .anim-onion-count {
                min-width: 8px;
                font-size: 10px;
                font-weight: 700;
                line-height: 1;
                text-align: center;
                color: var(--futaba-maroon);
            }

            .anim-timeline-settings {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-left: 2px;
                padding: 2px 6px;
                border-radius: 6px;
                background: rgba(128, 0, 0, 0.06);
                cursor: default;
            }

            .anim-setting-field {
                display: flex;
                align-items: center;
                gap: 3px;
                font-size: 9px;
                color: var(--futaba-maroon);
                opacity: 0.82;
                cursor: default;
                user-select: none;
            }

            .anim-setting-field input {
                width: 34px;
                height: 18px;
                box-sizing: border-box;
                border: 1px solid rgba(128, 0, 0, 0.22);
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.62);
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                text-align: center;
                padding: 0 2px;
                outline: none;
            }

            .anim-setting-field input:focus {
                border-color: rgba(255, 102, 0, 0.9);
                box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14);
                background: rgba(255, 255, 255, 0.92);
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
                margin-left: 2px;
                display: flex;
                align-items: center;
                gap: 3px;
            }

            .animation-table-panel.is-narrow .anim-table-header {
                align-items: center;
                justify-content: flex-start;
                padding: 5px 34px 5px 10px;
                gap: 6px 8px;
            }

            .animation-table-panel.is-narrow .anim-table-header-left,
            .animation-table-panel.is-narrow .anim-table-header-center,
            .animation-table-panel.is-narrow .anim-table-header-right {
                display: contents;
            }

            .animation-table-panel.is-narrow .anim-play-btn,
            .animation-table-panel.is-narrow .anim-playback-controls,
            .animation-table-panel.is-narrow .anim-preview-toggle,
            .animation-table-panel.is-narrow .anim-onion-toggle,
            .animation-table-panel.is-narrow .anim-timeline-settings,
            .animation-table-panel.is-narrow .anim-copy-paste-controls,
            .animation-table-panel.is-narrow #anim-assets-toggle-btn {
                margin-left: 0;
                margin-right: 0;
            }

            .animation-table-panel.is-narrow .anim-duration-controls {
                gap: 5px;
                padding: 2px 6px;
            }

            .animation-table-panel.is-narrow #anim-table-close-btn {
                position: absolute !important;
                top: 8px;
                right: 8px;
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

            .anim-playback-controls {
                margin-left: 4px;
                display: flex;
                align-items: center;
                gap: 2px;
                background: rgba(128, 0, 0, 0.06);
                padding: 2px;
                border-radius: 4px;
            }

            .anim-playback-btn {
                min-width: 22px;
                height: 18px;
                border: none;
                border-radius: 3px;
                padding: 1px 5px;
                background: transparent;
                color: var(--futaba-maroon);
                font-size: 8px;
                font-weight: 700;
                cursor: pointer;
                opacity: 0.68;
            }

            .anim-playback-btn:hover {
                opacity: 0.95;
                background: rgba(128, 0, 0, 0.08);
            }

            .anim-playback-btn.active {
                opacity: 1;
                background: rgba(255, 102, 0, 0.18);
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

            .animation-table-panel.timeline-pan-dragging .anim-table-viewport {
                cursor: grabbing;
                user-select: none;
            }

            .animation-table-panel.timeline-zoom-dragging .anim-table-viewport {
                cursor: ns-resize;
                user-select: none;
            }

            .anim-zoom-controls {
                position: absolute;
                right: 8px;
                bottom: 2px;
                z-index: 35;
                display: flex;
                align-items: center;
                gap: 3px;
                padding: 2px 4px;
                border-radius: 6px;
                background: rgba(255, 251, 230, 0.9);
                border: 1px solid rgba(128, 0, 0, 0.18);
                box-shadow: 0 2px 6px rgba(128, 0, 0, 0.12);
            }

            .anim-zoom-btn {
                width: 18px;
                height: 18px;
                border-radius: 4px;
                border: 1px solid rgba(128, 0, 0, 0.28);
                background: rgba(255, 255, 255, 0.65);
                color: var(--futaba-maroon);
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                cursor: pointer;
                padding: 0;
            }

            .anim-zoom-btn:hover:not(:disabled) {
                border-color: rgba(255, 102, 0, 0.85);
                background: rgba(255, 255, 255, 0.95);
            }

            .anim-zoom-btn:disabled {
                opacity: 0.28;
                cursor: default;
            }

            .anim-zoom-value {
                min-width: 28px;
                text-align: center;
                font-size: 9px;
                font-weight: 700;
                color: var(--futaba-maroon);
                opacity: 0.78;
            }

            .anim-resize-handle {
                position: absolute;
                right: 3px;
                bottom: 3px;
                width: 16px;
                height: 16px;
                cursor: nwse-resize;
                z-index: 36;
                opacity: 0.45;
                touch-action: none;
                background:
                    linear-gradient(135deg, transparent 0 44%, rgba(128, 0, 0, 0.55) 45% 52%, transparent 53%),
                    linear-gradient(135deg, transparent 0 62%, rgba(128, 0, 0, 0.45) 63% 70%, transparent 71%);
            }

            .anim-resize-handle:hover {
                opacity: 0.85;
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

            .anim-internal-layer-name-input {
                width: 100%;
                min-width: 0;
                height: 20px;
                box-sizing: border-box;
                border: 1px solid rgba(207, 156, 151, 0.85);
                border-radius: 4px;
                background: rgba(255, 255, 238, 0.96);
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                outline: none;
                padding: 1px 4px;
                box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14);
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

            .anim-lib-folder-name-input {
                width: 72px;
                min-width: 0;
                height: 18px;
                box-sizing: border-box;
                border: 1px solid rgba(207, 156, 151, 0.85);
                border-radius: 4px;
                background: rgba(255, 255, 238, 0.96);
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                outline: none;
                padding: 1px 4px;
                box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14);
            }

            .anim-lib-asset-name-input {
                width: 86px;
                min-width: 0;
                height: 18px;
                box-sizing: border-box;
                border: 1px solid rgba(207, 156, 151, 0.85);
                border-radius: 4px;
                background: rgba(255, 255, 238, 0.96);
                color: var(--futaba-maroon);
                font-size: 10px;
                font-weight: 700;
                outline: none;
                padding: 1px 4px;
                box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.14);
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

            .anim-lib-asset-actions {
                display: flex;
                gap: 2px;
            }

            .anim-folder-add-btn, .anim-folder-rename-btn, .anim-folder-delete-btn, .anim-asset-move-btn, .anim-asset-delete-btn {
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

            .anim-folder-add-btn:hover:not(:disabled),
            .anim-folder-rename-btn:hover:not(:disabled),
            .anim-folder-delete-btn:hover:not(:disabled),
            .anim-asset-move-btn:hover:not(:disabled),
            .anim-asset-delete-btn:hover:not(:disabled) {
                background: white;
                border-color: #ff6600;
                color: #ff6600;
            }

            .anim-folder-rename-btn:disabled, .anim-folder-delete-btn:disabled, .anim-asset-move-btn:disabled, .anim-asset-delete-btn:disabled {
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
                padding: 0 8px;
                font-size: 9px;
                color: var(--futaba-maroon);
                background: rgba(128, 0, 0, 0.05);
                border-bottom: 1px solid var(--futaba-light-medium);
                box-sizing: border-box;
                position: sticky;
                top: 0;
                z-index: 21;
                overflow: hidden;
                display: grid;
                grid-template-columns: 78px 1fr;
                align-items: center;
                column-gap: 10px;
            }

            .anim-track-header::before {
                content: '';
                position: absolute;
                left: 84px;
                top: 2px;
                width: 1px;
                height: 26px;
                background: rgba(128, 0, 0, 0.32);
                transform: rotate(-10deg);
                transform-origin: top center;
                pointer-events: none;
            }

            .anim-axis-label {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                gap: 4px;
                line-height: 1;
                white-space: nowrap;
            }

            .anim-axis-label--timeline {
                justify-self: start;
                font-size: 10px;
                opacity: 0.8;
            }

            .anim-axis-label--lanes {
                justify-self: start;
                font-size: 10px;
                font-weight: bold;
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
                cursor: pointer;
            }

            .anim-track-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .anim-track-name-input {
                flex: 1;
                min-width: 0;
                height: 22px;
                box-sizing: border-box;
                border: 1px solid rgba(207, 156, 151, 0.85);
                border-radius: 4px;
                background: rgba(255, 255, 238, 0.9);
                color: var(--futaba-maroon);
                font-size: 11px;
                font-weight: 700;
                outline: none;
                padding: 1px 4px;
                box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.16);
            }

            .anim-lane-include-btn {
                width: 14px;
                height: 14px;
                border-radius: 3px;
                border: 1px solid rgba(128, 0, 0, 0.3);
                background: rgba(255, 255, 255, 0.25);
                color: var(--futaba-maroon);
                font-size: 10px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: default;
                padding: 0;
                flex-shrink: 0;
                transition: all 0.2s;
                opacity: 0.18;
            }

            .set-scope-active .anim-lane-include-btn {
                opacity: 0.55;
                cursor: pointer;
            }

            .set-scope-active .anim-lane-include-btn:hover {
                background: white;
                border-color: #ff6600;
            }

            .anim-lane-include-btn.active {
                background: #4caf50;
                color: white;
                border-color: #4caf50;
                font-weight: bold;
                opacity: 1;
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

            .animation-table-panel.lane-only-selected .anim-track-item.active {
                box-shadow: inset 0 0 0 2px #ff6600;
                border-radius: 4px;
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
                background-size: var(--anim-cell-width) 100%;
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
                width: var(--anim-cell-width);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
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

            .anim-frame-num.in-marker {
                box-shadow: inset 2px 0 0 var(--futaba-maroon);
            }

            .anim-frame-num.out-marker {
                box-shadow: inset -2px 0 0 var(--active-border);
            }

            .anim-frame-num.in-marker.out-marker {
                box-shadow:
                    inset 2px 0 0 var(--futaba-maroon),
                    inset -2px 0 0 var(--active-border);
            }

            .anim-marker-badge {
                position: absolute;
                top: 1px;
                left: 50%;
                transform: translateX(-50%);
                max-width: calc(var(--anim-cell-width) - 2px);
                overflow: hidden;
                text-overflow: clip;
                font-size: 7px;
                line-height: 1;
                color: var(--futaba-maroon);
                background: rgba(255, 251, 230, 0.92);
                border: 1px solid rgba(128, 0, 0, 0.22);
                border-radius: 3px;
                padding: 0 2px;
                pointer-events: none;
            }

            .anim-frame-num.current .anim-marker-badge {
                color: var(--futaba-background);
                background: rgba(128, 0, 0, 0.48);
                border-color: rgba(255, 255, 238, 0.42);
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
                width: var(--anim-cell-width);
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
                touch-action: none;
                user-select: none;
                cursor: grab;
            }

            .anim-cel-block.moving {
                opacity: 0.72;
                transform: rotate(2deg) scale(1.08);
                cursor: grabbing;
                z-index: 100;
                outline: 3px solid rgba(255, 255, 255, 0.95);
                box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.65), 0 8px 18px rgba(128, 0, 0, 0.35);
            }

            .anim-cel-block.retiming {
                cursor: ew-resize;
                outline: 2px solid rgba(255, 255, 255, 0.88);
                box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.55), 0 6px 14px rgba(128, 0, 0, 0.26);
                z-index: 90;
            }

            .anim-cel-block.retiming::before {
                content: '';
                position: absolute;
                top: 0;
                bottom: 0;
                width: min(50%, calc(var(--anim-cell-width) * 0.5));
                background: rgba(255, 183, 92, 0.78);
                box-shadow: 0 0 12px rgba(255, 102, 0, 0.85);
                pointer-events: none;
                z-index: 1;
            }

            .anim-cel-block.retiming-left::before {
                left: 0;
                border-radius: 4px 0 0 4px;
            }

            .anim-cel-block.retiming-right::before {
                right: 0;
                border-radius: 0 4px 4px 0;
            }

            .anim-cel-block.retiming-blocked {
                background: #9a2f2f !important;
                outline-color: rgba(255, 236, 226, 0.92);
                box-shadow: 0 0 0 3px rgba(160, 0, 0, 0.55), 0 6px 14px rgba(128, 0, 0, 0.25);
            }

            .anim-cel-block.retiming-blocked::before {
                background: rgba(160, 0, 0, 0.42);
                box-shadow: inset 0 0 0 2px rgba(255, 236, 226, 0.75), 0 0 10px rgba(160, 0, 0, 0.65);
            }

            .anim-cell-slot.move-target {
                background: rgba(255, 102, 0, 0.38) !important;
                box-shadow:
                    inset 0 0 0 3px rgba(255, 102, 0, 0.95),
                    inset 0 0 16px rgba(255, 102, 0, 0.5);
            }

            .anim-cell-slot.move-target-blocked {
                background: rgba(160, 0, 0, 0.22) !important;
                box-shadow: inset 0 0 0 2px rgba(128, 0, 0, 0.65);
            }

            .anim-cel-handle {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 6px;
                cursor: ew-resize;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2;
                touch-action: none;
            }

            .anim-cel-handle--left {
                left: -5px;
            }

            .anim-cel-handle--right {
                right: -5px;
            }

            .anim-cel-handle::after {
                content: none;
            }

            .anim-cel-handle:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .anim-cel-handle:hover::after {
                content: none;
            }

            .anim-cel-resize-grip {
                position: absolute;
                left: 4px;
                right: 4px;
                bottom: 2px;
                height: 9px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.18);
                display: none;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.9);
                font-size: 10px;
                line-height: 1;
                font-weight: 700;
                pointer-events: auto;
                z-index: 3;
            }

            .anim-cel-block.duration-1 .anim-cel-resize-grip {
                display: flex;
            }

            .anim-cel-resize-grip::before {
                content: '↔';
                pointer-events: none;
                transform: translateY(-0.5px);
            }

            .anim-cel-resize-grip:hover {
                background: rgba(255, 255, 255, 0.28);
            }

            .anim-cel-handle--bottom-left,
            .anim-cel-handle--bottom-right {
                top: 0;
                bottom: 0;
                width: 50%;
                height: auto;
                background: transparent;
                z-index: 4;
            }

            .anim-cel-handle--bottom-left {
                left: 0;
            }

            .anim-cel-handle--bottom-right {
                right: 0;
            }

            .anim-snapshot-icon {
                position: absolute;
                left: 8px;
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

            ${durationWidthCss}

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

    _restoreRetimingLaneSnapshot(track, snapshot = []) {
        if (!track || !Array.isArray(snapshot)) return;
        const byId = new Map(snapshot.map(item => [item.id, item]));
        (track.cels || []).forEach(cel => {
            const original = byId.get(cel.id);
            if (!original) return;
            cel.startFrame = original.startFrame;
            cel.duration = original.duration;
        });
    }

    _applyRetimingWithPush(retimingData, deltaFrames) {
        const { cel, track, laneSnapshot, edge, startFrame, startDuration } = retimingData || {};
        if (!cel || !track || !Array.isArray(laneSnapshot)) return false;

        this._restoreRetimingLaneSnapshot(track, laneSnapshot);

        const totalFrames = Math.max(1, this.model.totalFrames || 1);
        const originalEnd = startFrame + startDuration;
        const others = (track.cels || []).filter(item => item.id !== cel.id);

        if (edge === 'left') {
            const targetStart = Math.max(0, Math.min(originalEnd - 1, startFrame + deltaFrames));
            const targetDuration = Math.max(1, originalEnd - targetStart);
            let requiredStart = targetStart;
            const previousCels = others
                .filter(item => item.startFrame < originalEnd)
                .sort((a, b) => b.startFrame - a.startFrame);

            for (const item of previousCels) {
                const itemEnd = item.startFrame + item.duration;
                if (itemEnd <= requiredStart) continue;
                item.startFrame = requiredStart - item.duration;
                requiredStart = item.startFrame;
                if (item.startFrame < 0) {
                    const original = laneSnapshot.find(snapshot => snapshot.id === item.id);
                    const originalStart = original?.startFrame ?? 0;
                    const shrinkDuration = requiredStart + item.duration - originalStart;
                    if (shrinkDuration < 1) {
                        this._restoreRetimingLaneSnapshot(track, laneSnapshot);
                        return false;
                    }
                    item.startFrame = originalStart;
                    item.duration = shrinkDuration;
                    requiredStart = item.startFrame;
                }
            }

            cel.startFrame = targetStart;
            cel.duration = targetDuration;
            return true;
        }

        const targetDuration = Math.max(1, Math.min(startDuration + deltaFrames, totalFrames - startFrame));
        let requiredEnd = startFrame + targetDuration;
        const nextCels = others
            .filter(item => item.startFrame >= startFrame)
            .sort((a, b) => a.startFrame - b.startFrame);

        for (const item of nextCels) {
            if (item.startFrame >= requiredEnd) continue;
            item.startFrame = requiredEnd;
            requiredEnd = item.startFrame + item.duration;
            if (requiredEnd > totalFrames) {
                this._restoreRetimingLaneSnapshot(track, laneSnapshot);
                return false;
            }
        }

        cel.startFrame = startFrame;
        cel.duration = targetDuration;
        return true;
    }

    _clearClipMovePreview() {
        if (!this._clipMovePreviewSlot) return;
        this._clipMovePreviewSlot.classList.remove('move-target', 'move-target-blocked');
        this._clipMovePreviewSlot = null;
    }

    _getClipMoveTargetSlot(clientX, clientY) {
        if (!this._clipMoveData || !this.panel) return null;
        const movingBlock = this.panel?.querySelector(`.anim-cel-block[data-cel-id="${this._clipMoveData.clipId}"]`);
        const previousPointerEvents = movingBlock?.style.pointerEvents;
        if (movingBlock) movingBlock.style.pointerEvents = 'none';
        const targetEl = document.elementFromPoint(clientX, clientY);
        if (movingBlock) movingBlock.style.pointerEvents = previousPointerEvents || '';

        const grid = this.panel.querySelector('.anim-timeline-grid');
        if (!grid) return null;
        const targetRow = targetEl?.closest?.('.anim-timeline-row') || null;
        const row = targetRow || [...grid.querySelectorAll('.anim-timeline-row')].find(item => {
            const rect = item.getBoundingClientRect();
            return clientY >= rect.top && clientY <= rect.bottom;
        });
        if (!row) return null;
        const firstSlot = row.querySelector('.anim-cell-slot');
        if (!firstSlot) return null;
        const rect = firstSlot.getBoundingClientRect();
        const frameIndex = Math.floor((clientX - rect.left) / this.timelineCellWidth);
        if (frameIndex < 0 || frameIndex >= this.model.totalFrames) return null;
        const coordinateSlot = row.querySelector(`.anim-cell-slot[data-frame-index="${frameIndex}"]`);
        if (coordinateSlot) return coordinateSlot;

        return targetEl?.closest?.('.anim-cell-slot') || null;
    }

    _updateClipMovePreview(clientX, clientY) {
        if (!this._clipMoveData) return;
        const slot = this._getClipMoveTargetSlot(clientX, clientY);
        if (slot === this._clipMovePreviewSlot) return;

        this._clearClipMovePreview();
        if (!slot) return;

        const targetLaneId = slot.dataset.trackId;
        const targetFrame = parseInt(slot.dataset.frameIndex, 10);
        const canMove = Number.isInteger(targetFrame)
            && this.model.canMoveClip(this._clipMoveData.clipId, targetLaneId, targetFrame).ok;
        slot.classList.add(canMove ? 'move-target' : 'move-target-blocked');
        this._clipMovePreviewSlot = slot;
    }

    _setupEventListeners() {
        if (!this.eventBus) return;
        
        // レイヤー系の更新を購読
        this.eventBus.on('layer:panel-update-requested', (payload = {}) => {
            if (payload.skipRender === true) return;
            this.requestUpdate();
        });
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
        this.eventBus.on('layer:updated', ({ layerId, transform } = {}) => {
            if (!this.isTransformPreviewSuspended) return;
            this._syncInternalFolderWorkingLayerTransform(layerId, transform);
        });
        
        // アニメーション系
        this.eventBus.on('animation:frame-changed', () => this.requestUpdate());
        this.eventBus.on('history:changed', (data = {}) => {
            this._handleHistoryChanged(data);
        });
        this.eventBus.on('keyboard:vkey-state-changed', ({ pressed } = {}) => {
            if (pressed) {
                this._enterTransformEditPreviewMode();
                return;
            }
            if (!this.isTransformPreviewSuspended) {
                this._clearInternalFolderTransformContext();
                return;
            }
            requestAnimationFrame(() => {
                const beforeState = this._transformHistoryBeforeState;
                const beforeSignature = this._transformWorkingLayerBeforeSignature;
                const afterSignature = this._captureWorkingLayerTransformSignature();
                const entry = this.selectedCelId ? this.model.findClipEntry(this.selectedCelId) : null;
                const hasDirtyWorkingLayers = entry?.clip ? this._hasDirtyWorkingLayersForClip(entry.clip) : false;
                const hasTransformChange = !!beforeSignature
                    && JSON.stringify(beforeSignature) !== JSON.stringify(afterSignature);
                if (hasTransformChange) {
                    return;
                }
                if (!hasDirtyWorkingLayers && !hasTransformChange) {
                    this._exitTransformEditPreviewMode();
                    return;
                }

                const saved = this._saveSelectedClipFromWorkingLayers({ force: hasTransformChange });
                if (saved) {
                    const asset = this._getSelectedAssetForInspector();
                    const afterState = asset ? this._captureInternalLayerHistoryState(asset) : null;
                    if (asset && beforeState && afterState && JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
                        this._recordInternalLayerHistoryFromStates(asset, beforeState, afterState, 'caf-internal-layer-transform', {
                            type: 'caf-internal-layer-transform',
                            clipId: this.selectedCelId,
                            internalLayerId: this.selectedInternalLayerId || null
                        });
                    }
                    this._requestLayerPanelSync();
                }
                this._exitTransformEditPreviewMode();
            });
        });
        this.eventBus.on('layer:transform-exit', ({ layerId, confirmed = false, cancelled = false } = {}) => {
            const shouldSave = layerId && this._isAnimationWorkingLayerId(layerId);
            const folderTransformContext = shouldSave && confirmed && !cancelled
                ? this._getSelectedInternalFolderTransformTargets()
                : null;
            if (folderTransformContext?.targets?.length > 1) {
                this.layerSystem?._showOperationIndicator?.(
                    `CAFフォルダ変形を確定中... ${folderTransformContext.targets.length} layers`
                );
            }
            requestAnimationFrame(() => {
                if (shouldSave) {
                    const shouldCommit = !cancelled && confirmed;
                    const beforeState = shouldCommit ? this._transformHistoryBeforeState : null;
                    if (!shouldCommit) {
                        const asset = this._getSelectedAssetForInspector();
                        if (asset && this._transformHistoryBeforeState) {
                            this._restoreInternalLayerHistoryState(asset.id, this._transformHistoryBeforeState);
                        } else {
                            this._syncSelectedClipToWorkingLayers({ forceRestore: true });
                        }
                        this._requestLayerPanelSync();
                    } else {
                        const peerResult = this._confirmInternalFolderPeerTransforms(layerId);
                        if (peerResult?.ok === false) {
                            const asset = this._getSelectedAssetForInspector();
                            if (asset && beforeState) {
                                this._restoreInternalLayerHistoryState(asset.id, beforeState);
                            } else {
                                this._syncSelectedClipToWorkingLayers({ forceRestore: true });
                            }
                            console.warn('[AnimationTablePopup] CAF folder transform rolled back after peer confirm failure', peerResult);
                            window.projectManager?._showSaveToast?.('CAFフォルダ変形の確定に失敗したため、変形前へ戻しました。');
                            this._requestLayerPanelSync();
                        } else {
                            this._invalidateWorkingLayerSnapshotId(layerId);
                            const saved = this._saveSelectedClipFromWorkingLayers({ force: true });
                            if (saved && beforeState) {
                                const asset = this._getSelectedAssetForInspector();
                                const afterState = asset ? this._captureInternalLayerHistoryState(asset) : null;
                                if (asset && afterState && JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
                                    this._recordInternalLayerHistoryFromStates(asset, beforeState, afterState, 'caf-internal-layer-transform', {
                                        type: 'caf-internal-layer-transform',
                                        clipId: this.selectedCelId,
                                        internalLayerId: this.selectedInternalLayerId || null
                                    });
                                }
                            }
                            this._requestLayerPanelSync();
                        }
                    }
                }
                this.layerSystem?._hideOperationIndicator?.();
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
        this.eventBus.on('drawing:stroke-cancelled', () => {
            this._handleDrawingCancelled();
        });
        this.eventBus.on('selection:tool-changed', ({ active } = {}) => {
            if (!this.isVisible || !this.selectedCelId) return;
            if (active === true && this.isPreviewActive) {
                this._showSelectedClipWorkingLayers();
            } else if (this.isDrawingPreviewSuspended) {
                this.isDrawingPreviewSuspended = false;
                this.render();
            }
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            // 入力欄編集中は無視
            const isInput = e.target.tagName === 'INPUT' ||
                           e.target.tagName === 'TEXTAREA' ||
                           e.target.isContentEditable;
            if (isInput) return;

            if (e.code === 'Space') {
                this._timelineSpacePressed = true;
                return;
            }

            if (this.isTransformPreviewSuspended && e.key?.startsWith?.('Arrow')) {
                return;
            }

            if (e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
                this.deleteActiveSelection();
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (e.altKey && e.key === 'ArrowUp') {
                this._moveActiveLaneBy(-1);
                e.preventDefault();
            } else if (e.altKey && e.key === 'ArrowDown') {
                this._moveActiveLaneBy(1);
                e.preventDefault();
            } else if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'ArrowUp') {
                this._moveActiveLaneBy(-1);
                e.preventDefault();
                e.stopImmediatePropagation();
            } else if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'ArrowDown') {
                this._moveActiveLaneBy(1);
                e.preventDefault();
                e.stopImmediatePropagation();
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
        document.addEventListener('keyup', (e) => {
            if (e.code !== 'Space') return;
            this._timelineSpacePressed = false;
            if (this._timelineViewportGesture) {
                this._onTimelineViewportPointerUp?.();
            }
        });
        window.addEventListener('blur', () => {
            this._timelineSpacePressed = false;
            if (this._timelineViewportGesture) {
                this._onTimelineViewportPointerUp?.();
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
