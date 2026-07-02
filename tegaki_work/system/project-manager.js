/**
 * ============================================================================
 * ファイル名: system/project-manager.js
 * 責務: プロジェクト全体の保存（JSON）と読み込みを担当する
 * 依存: system/event-bus.js, system/layer-system.js, system/config.js
 * 被依存: core-engine.js, ui/sidebar等
 * 公開API: ProjectManager
 * 実装状態: ✅完成/整備
 * ============================================================================
 */

import { TegakiEventBus } from './event-bus.js';
import { TEGAKI_CONFIG } from '../config.js';
import { TimelineModel } from './animation/animation-data-model.js';
import {
    applyClippingMode,
    getClippingMode
} from './clipping-mode.js';
import { normalizeRasterBounds } from './raster-bounds.js';
import * as PIXI from 'pixi.js';

export class ProjectManager {
    constructor(layerSystem, app) {
        this.layerSystem = layerSystem;
        this.app = app;
        this.eventBus = TegakiEventBus;
        this.currentFileHandle = null;
        this.currentFileName = null;
    }

    /**
     * プロジェクトをJSONデータとしてエクスポート
     */
    async exportProject(options = {}) {
        if (!this.layerSystem || !this.app) return null;
        const profileEnabled = options.profile === true || TEGAKI_CONFIG.debug === true;
        const profile = profileEnabled ? this._createExportProfile() : null;
        const exportStartedAt = this._now();
        this._commitFloatingSelection();
        if (profile) profile.timings.commitFloatingSelectionMs = this._elapsed(exportStartedAt);

        const layers = this.layerSystem.getLayers();
        const canvasWidth = TEGAKI_CONFIG.canvas.width;
        const canvasHeight = TEGAKI_CONFIG.canvas.height;

        const projectData = {
            version: 2,
            app: "tegaki",
            canvas: {
                width: canvasWidth,
                height: canvasHeight
            },
            background: {
                color: TEGAKI_CONFIG.canvas.backgroundColor || 0xf0e0d6,
                visible: true // 現状固定
            },
            layers: [],
            animation: null,
            animationState: null
        };

        const animationTable = this._getAnimationTable();
        if (
            animationTable?.model?.serialize &&
            this._hasAnimationProjectData(animationTable.model)
        ) {
            const saveClipStartedAt = this._now();
            animationTable._saveSelectedClipFromWorkingLayers?.({ force: true });
            if (profile) profile.timings.saveSelectedClipMs = this._elapsed(saveClipStartedAt);

            if (profile) {
                profile.animation.beforeSerialize = this._getAnimationSerializeStats(animationTable.model);
            }
            const animationSerializeStartedAt = this._now();
            projectData.animation = await this._serializeAnimationForProject(animationTable.model, profile);
            if (profile) {
                profile.timings.animationSerializeMs = this._elapsed(animationSerializeStartedAt);
                profile.animation.afterSerialize = this._getSerializedAnimationStats(projectData.animation);
            }
            projectData.animationState = this._captureAnimationUiState(animationTable);
        }

        // レイヤー情報を収集（背景は別途保存）
        const layersStartedAt = this._now();
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const data = layer.layerData;

            if (data.isBackground) {
                projectData.background.color = data.backgroundColor;
                continue;
            }
            if (data.isFolder) {
                projectData.layers.push({
                    id: data.id,
                    name: data.name,
                    visible: data.visible !== false,
                    opacity: data.opacity !== undefined ? data.opacity : 1.0,
                    isFolder: true,
                    folderExpanded: data.folderExpanded !== false,
                    children: Array.isArray(data.children) ? [...data.children] : [],
                    parentId: data.parentId || null
                });
                continue;
            }

            // 画像データをPNG dataURLとして取得
            let imageData = null;
            if (data.renderTexture && this.app.renderer) {
                try {
                    // PixiJS v8 の extract.canvas() を使用
                    const canvas = this.app.renderer.extract.canvas({
                        target: data.renderTexture,
                        clearColor: '#00000000'
                    });
                    this._unpremultiplyCanvas(canvas);
                    imageData = canvas.toDataURL('image/png');
                } catch (e) {
                    console.error('[ProjectManager] Failed to extract layer image:', e);
                }
            }

            projectData.layers.push({
                id: data.id,
                name: data.name,
                visible: data.visible !== false,
                opacity: data.opacity !== undefined ? data.opacity : 1.0,
                blendMode: data.blendMode || 'normal',
                parentId: data.parentId || null,
                clipping: data.clipping === true,
                clippingMode: getClippingMode(data),
                rasterBounds: normalizeRasterBounds(data.rasterBounds, {
                    width: data.renderTexture?.width || canvasWidth,
                    height: data.renderTexture?.height || canvasHeight
                }),
                image: imageData
            });
        }
        if (profile) {
            profile.timings.layersSerializeMs = this._elapsed(layersStartedAt);
            profile.timings.exportProjectMs = this._elapsed(exportStartedAt);
            profile.layers = this._getLayerExportStats(projectData.layers);
            this._attachExportProfile(projectData, profile);
        }

        return projectData;
    }

    /**
     * プロジェクトJSONをファイルとしてダウンロード
     */
    async saveToFile(options = {}) {
        let fileHandle = null;
        if (options.preferNative === true && this._canUseNativeFileSave()) {
            const fileHandleResult = await this._getFileHandleForSave(options);
            if (fileHandleResult?.cancelled === true && options.cancelledIfNoHandle === true) {
                return { ok: false, cancelled: true };
            }
            fileHandle = fileHandleResult?.handle || null;
        }
        const data = await this.exportProject({ profile: TEGAKI_CONFIG.debug === true });
        if (!data) return { ok: false, reason: 'empty-project' };
        return this.saveProjectDataToFile(data, {
            ...options,
            fileHandle: fileHandle || options.fileHandle || null
        });
    }

    async saveProjectDataToFile(projectData, options = {}) {
        if (!projectData) return { ok: false, reason: 'empty-project' };
        const stringifyStartedAt = this._now();
        const json = JSON.stringify(projectData);
        this._finalizeExportProfile(projectData, {
            stringifyMs: this._elapsed(stringifyStartedAt),
            jsonLength: json.length
        });
        if (TEGAKI_CONFIG.debug === true && projectData.__exportProfile) {
            console.info('[ProjectManager] export profile', projectData.__exportProfile);
        }

        const fileHandle = options.fileHandle
            || (options.preferNative === true ? this.currentFileHandle : null);
        if (fileHandle && this._canUseNativeFileSave()) {
            try {
                await this._writeTextToFileHandle(fileHandle, json);
                this.currentFileHandle = fileHandle;
                this.currentFileName = fileHandle.name || this.currentFileName;
                if (options.showToast === true) {
                    this._showSaveToast(`保存しました${this.currentFileName ? `: ${this.currentFileName}` : ''}`);
                }
                return { ok: true, native: true, fileName: this.currentFileName };
            } catch (error) {
                if (error?.name === 'AbortError') {
                    return { ok: false, cancelled: true };
                }
                console.warn('[ProjectManager] Native file save failed; falling back to download.', error);
            }
        }

        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `tegaki_project_${timestamp}.json`;
        a.href = url;
        a.click();
        
        URL.revokeObjectURL(url);
        if (options.showToast === true) {
            this._showSaveToast('保存ファイルをダウンロードしました');
        }
        return { ok: true, native: false };
    }

    async quickSave(options = {}) {
        if (!this.hasCurrentAnimationProject()) {
            return { handled: false, reason: 'no-animation-project' };
        }
        const result = await this.saveToFile({
            preferNative: true,
            showToast: true,
            forcePicker: options.forcePicker === true || !this.currentFileHandle,
            cancelledIfNoHandle: true
        });
        return {
            handled: true,
            ...(result || {})
        };
    }

    async selectSaveLocation(options = {}) {
        if (!this._canUseNativeFileSave()) {
            this._showSaveToast('このブラウザでは保存先の固定に対応していません');
            return { ok: false, reason: 'native-file-save-unavailable' };
        }
        const result = await this._getFileHandleForSave({
            forcePicker: true,
            suggestedName: options.suggestedName || null
        });
        if (result?.cancelled) return { ok: false, cancelled: true };
        if (!result?.handle) return { ok: false, reason: 'no-handle' };
        this.currentFileHandle = result.handle;
        this.currentFileName = result.handle.name || this.currentFileName;
        if (options.showToast !== false) {
            this._showSaveToast(`保存先: ${this.currentFileName || '選択済み'}`);
        }
        return { ok: true, fileName: this.currentFileName };
    }

    getCurrentSaveTargetLabel() {
        return this.currentFileName || '';
    }

    hasCurrentAnimationProject() {
        const animationTable = this._getAnimationTable();
        return this._hasAnimationProjectData(animationTable?.model);
    }

    async profileProjectExport() {
        const data = await this.exportProject({ profile: true });
        if (!data) return null;
        const stringifyStartedAt = this._now();
        const json = JSON.stringify(data);
        return this._finalizeExportProfile(data, {
            stringifyMs: this._elapsed(stringifyStartedAt),
            jsonLength: json.length
        });
    }

    _now() {
        return globalThis.performance?.now?.() || Date.now();
    }

    _elapsed(startedAt) {
        return Math.max(0, this._now() - startedAt);
    }

    _createExportProfile() {
        return {
            collectedAt: new Date().toISOString(),
            timings: {
                commitFloatingSelectionMs: 0,
                saveSelectedClipMs: 0,
                animationSerializeMs: 0,
                layersSerializeMs: 0,
                exportProjectMs: 0,
                stringifyMs: null,
                animationSerializeYields: 0
            },
            animation: {
                beforeSerialize: null,
                afterSerialize: null
            },
            layers: null,
            jsonLength: null,
            warnings: []
        };
    }

    _canUseNativeFileSave() {
        return typeof globalThis.showSaveFilePicker === 'function';
    }

    async _getFileHandleForSave(options = {}) {
        if (this.currentFileHandle && options.forcePicker !== true) {
            return { handle: this.currentFileHandle };
        }
        if (!this._canUseNativeFileSave()) return null;
        try {
            const suggestedName = options.suggestedName || this.currentFileName || `tegaki_project_${this._timestampForFile()}.json`;
            const handle = await globalThis.showSaveFilePicker({
                suggestedName,
                types: [{
                    description: 'Tegaki Project JSON',
                    accept: {
                        'application/json': ['.json']
                    }
                }]
            });
            return { handle };
        } catch (error) {
            if (error?.name === 'AbortError') {
                return { cancelled: true };
            }
            console.warn('[ProjectManager] File picker failed; falling back to download.', error);
            return null;
        }
    }

    async _writeTextToFileHandle(fileHandle, text) {
        const writable = await fileHandle.createWritable();
        try {
            await writable.write(text);
        } finally {
            await writable.close();
        }
    }

    _timestampForFile() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    _showSaveToast(message) {
        let toast = document.getElementById('project-save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'project-save-toast';
            toast.className = 'project-save-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this._saveToastTimer);
        this._saveToastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 1600);
    }

    async _serializeAnimationForProject(model, profile = null) {
        let sliceStartedAt = this._now();
        const serializedSnapshots = [];
        const snapshots = model?.drawingSnapshots || [];

        for (let index = 0; index < snapshots.length; index++) {
            serializedSnapshots.push(snapshots[index]?.serialize ? snapshots[index].serialize() : { ...snapshots[index] });
            if (this._elapsed(sliceStartedAt) > 12 || index % 4 === 3) {
                if (profile) profile.timings.animationSerializeYields++;
                await this._yieldToBrowser();
                sliceStartedAt = this._now();
            }
        }

        return {
            fps: model.fps,
            totalFrames: model.totalFrames,
            tracks: (model.tracks || []).map(track => track.serialize ? track.serialize() : { ...track }),
            clipAssetFolders: (model.clipAssetFolders || []).map(folder => folder.serialize ? folder.serialize() : { ...folder }),
            clipAssets: (model.clipAssets || []).map(asset => asset.serialize ? asset.serialize() : { ...asset }),
            drawingSnapshots: serializedSnapshots,
            playback: { ...(model.playback || {}) }
        };
    }

    _yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    _attachExportProfile(projectData, profile) {
        if (!projectData || !profile) return;
        Object.defineProperty(projectData, '__exportProfile', {
            value: profile,
            enumerable: false,
            configurable: true
        });
    }

    _finalizeExportProfile(projectData, details = {}) {
        const profile = projectData?.__exportProfile;
        if (!profile) return null;
        if (Number.isFinite(details.stringifyMs)) {
            profile.timings.stringifyMs = details.stringifyMs;
        }
        if (Number.isFinite(details.jsonLength)) {
            profile.jsonLength = details.jsonLength;
            if (details.jsonLength > 100 * 1024 * 1024) {
                profile.warnings.push('Project JSON exceeds 100MB; save/download may be delayed.');
            }
        }
        return profile;
    }

    _getAnimationSerializeStats(model) {
        const snapshots = model?.drawingSnapshots || [];
        let pixelBytes = 0;
        let pixelElements = 0;
        let withPixels = 0;
        snapshots.forEach(snapshot => {
            const pixels = snapshot?.pixels;
            const length = Number(pixels?.length) || 0;
            const bytes = Number(pixels?.byteLength) || length;
            if (length > 0 || bytes > 0) withPixels++;
            pixelBytes += bytes;
            pixelElements += length;
        });
        return {
            totalFrames: model?.totalFrames || 0,
            tracks: model?.tracks?.length || 0,
            clipAssets: model?.clipAssets?.length || 0,
            drawingSnapshots: snapshots.length,
            drawingSnapshotsWithPixels: withPixels,
            pixelBytes,
            pixelElements,
            estimatedArrayNumberBytes: pixelElements * 8
        };
    }

    _getSerializedAnimationStats(animationData) {
        const snapshots = animationData?.drawingSnapshots || [];
        let serializedPixelElements = 0;
        snapshots.forEach(snapshot => {
            serializedPixelElements += Number(snapshot?.pixels?.length) || 0;
        });
        return {
            tracks: animationData?.tracks?.length || 0,
            clipAssets: animationData?.clipAssets?.length || 0,
            drawingSnapshots: snapshots.length,
            serializedPixelElements,
            estimatedArrayNumberBytes: serializedPixelElements * 8
        };
    }

    _getLayerExportStats(layers = []) {
        let imageChars = 0;
        let rasterLayerCount = 0;
        layers.forEach(layer => {
            if (typeof layer?.image === 'string') {
                rasterLayerCount++;
                imageChars += layer.image.length;
            }
        });
        return {
            count: layers.length,
            rasterLayerCount,
            imageChars
        };
    }

    /**
     * プロジェクトJSONを読み込み
     */
    async loadProject(projectData) {
        if (!projectData || projectData.app !== 'tegaki') {
            throw new Error('Invalid project data');
        }
        const history = window.History || null;
        const wasHistoryApplying = history?.isApplying === true;
        const hasRecordingSuppression = typeof history?.beginRecordingSuppression === 'function'
            && typeof history?.endRecordingSuppression === 'function';
        if (hasRecordingSuppression) {
            history.beginRecordingSuppression('project-load');
        }
        if (history) history.isApplying = true;

        try {
        this._getAnimationTable()?._resetCafPreviewRuntime?.('project-load-before');
        window.CoreRuntime?.api?.selection?.clear?.();

        // 1. キャンバスサイズ復元
        if (projectData.canvas) {
            const { width, height } = projectData.canvas;
            if (window.coreEngine?.cameraSystem) {
                window.coreEngine.cameraSystem.resizeCanvas(width, height);
            }
        }

        // 2. 背景設定復元
        if (projectData.background) {
            const { color } = projectData.background;
            if (this.layerSystem && this.layerSystem.getLayers().length > 0) {
                const bgLayer = this.layerSystem.getLayers()[0];
                if (bgLayer.layerData?.isBackground) {
                    this.layerSystem.changeBackgroundLayerColor(0, bgLayer.layerData.id, color);
                }
            }
        }

        // 3. レイヤー復元（既存の通常レイヤーを全削除してから追加）
        if (projectData.layers && this.layerSystem) {
            const legacyParentByChildId = this._createLegacyFolderParentMap(projectData.layers);
            const folderIdByKey = new Map(
                projectData.layers
                    .filter(layerInfo => layerInfo?.isFolder && layerInfo.id != null)
                    .map(layerInfo => [String(layerInfo.id), layerInfo.id])
            );
            // Pixiのinverse AlphaMask描画命令が旧Layerを参照したまま
            // RenderTexture破棄へ進まないよう、mask解除を1描画フレーム先行させる。
            this.layerSystem.clearClippingMasks?.();
            await new Promise(resolve => requestAnimationFrame(resolve));

            // 背景以外のレイヤーを削除
            const currentLayers = [...this.layerSystem.getLayers()];
            for (let i = currentLayers.length - 1; i >= 0; i--) {
                if (!currentLayers[i].layerData?.isBackground) {
                    this.layerSystem.deleteLayer(i);
                }
            }

            // JSONの順序通りにレイヤーを作成
            // (JSON内では下から上の順であることを期待。LayerSystem.createLayer は一番上に積む)
            for (const layerInfo of projectData.layers) {
                const result = layerInfo.isFolder
                    ? this.layerSystem.createFolder(layerInfo.name)
                    : this.layerSystem.createLayer(layerInfo.name);
                const { layer } = result || {};
                if (!layer) continue;

                // 基本プロパティ
                layer.layerData.id = layerInfo.id || layer.layerData.id;
                layer.id = layer.layerData.id;
                layer.label = layer.layerData.id;
                layer.layerData.visible = layerInfo.visible !== false;
                layer.layerData.opacity = layerInfo.opacity !== undefined ? layerInfo.opacity : 1.0;
                layer.layerData.parentId = this._resolveLoadedLayerParentId(
                    layerInfo,
                    folderIdByKey,
                    legacyParentByChildId
                );
                layer.layerData.blendMode = layerInfo.blendMode || 'normal';
                applyClippingMode(
                    layer.layerData,
                    layerInfo.clippingMode || (layerInfo.clipping === true ? 'normal' : 'none')
                );
                if (layerInfo.isFolder) {
                    layer.layerData.isFolder = true;
                    layer.layerData.folderExpanded = layerInfo.folderExpanded !== false;
                    layer.layerData.children = Array.isArray(layerInfo.children) ? [...layerInfo.children] : [];
                }
                
                layer.visible = layer.layerData.visible;
                layer.alpha = layer.layerData.opacity;
                if (!layerInfo.isFolder) {
                    layer.blendMode = layer.layerData.blendMode;
                    if (layer.layerData.layerSprite) {
                        layer.layerData.layerSprite.blendMode = layer.layerData.blendMode;
                    }
                }

                if (!layerInfo.isFolder) {
                    const savedRasterBounds = normalizeRasterBounds(layerInfo.rasterBounds, {
                        width: TEGAKI_CONFIG.canvas.width,
                        height: TEGAKI_CONFIG.canvas.height
                    });
                    if (layerInfo.image && layer.layerData.renderTexture && this.app.renderer) {
                        await this._loadLayerImage(layer, layerInfo.image, savedRasterBounds);
                    }
                    const rasterBounds = normalizeRasterBounds(savedRasterBounds, {
                        width: layer.layerData.renderTexture?.width || savedRasterBounds.width,
                        height: layer.layerData.renderTexture?.height || savedRasterBounds.height
                    });
                    rasterBounds.width = layer.layerData.renderTexture?.width || rasterBounds.width;
                    rasterBounds.height = layer.layerData.renderTexture?.height || rasterBounds.height;
                    layer.layerData.rasterBounds = rasterBounds;
                    layer.layerData.layerSprite?.position.set(rasterBounds.x, rasterBounds.y);
                }
            }

            const loadedLayers = this.layerSystem.getLayers();
            for (const layer of loadedLayers) {
                if (layer.layerData?.isFolder) {
                    layer.layerData.children = [];
                }
            }
            for (const layer of loadedLayers) {
                const parentId = layer.layerData?.parentId;
                if (!parentId || layer.layerData?.isBackground) continue;
                const folder = loadedLayers.find(l => l.layerData?.id === parentId && l.layerData?.isFolder);
                if (folder) {
                    folder.layerData.addChild(layer.layerData.id);
                } else {
                    layer.layerData.parentId = null;
                }
            }
        }

        // 4. CAF / TimelineModel 復元
        if (this._hasAnimationProjectData(projectData.animation)) {
            this._restoreAnimationProjectData(projectData.animation, projectData.animationState);
        } else {
            this._resetAnimationProjectData();
        }

        // 5. 履歴クリア
        if (window.History) {
            window.History.clear();
        }

        // 6. UI更新要求
        if (this.eventBus) {
            this.eventBus.emit('layer:panel-update-requested');
        }

        this.refreshLoadedProjectUI();
        } finally {
            if (hasRecordingSuppression) {
                history.endRecordingSuppression('project-load');
            }
            if (history) history.isApplying = wasHistoryApplying;
        }
    }

    _createLegacyFolderParentMap(layerInfos = []) {
        const parentByChildId = new Map();
        layerInfos.forEach(layerInfo => {
            if (!layerInfo?.isFolder || !Array.isArray(layerInfo.children)) return;
            layerInfo.children.forEach(childEntry => {
                const childId = childEntry && typeof childEntry === 'object'
                    ? childEntry.id
                    : childEntry;
                if (childId != null && layerInfo.id != null) {
                    const childKey = String(childId);
                    if (!parentByChildId.has(childKey)) {
                        parentByChildId.set(childKey, layerInfo.id);
                    }
                }
            });
        });
        return parentByChildId;
    }

    _resolveLoadedLayerParentId(layerInfo, folderIdByKey, legacyParentByChildId) {
        if (!layerInfo || layerInfo.id == null) return null;

        const explicitParentKey = layerInfo.parentId != null
            ? String(layerInfo.parentId)
            : null;
        if (explicitParentKey && folderIdByKey.has(explicitParentKey)) {
            return folderIdByKey.get(explicitParentKey);
        }

        return legacyParentByChildId.get(String(layerInfo.id)) || null;
    }

    _getAnimationTable() {
        return window.PopupManager?.get?.('animationTable')
            || window.coreEngine?.popupManager?.get?.('animationTable')
            || null;
    }

    _commitFloatingSelection() {
        const selectionApi = window.CoreRuntime?.api?.selection;
        if (!selectionApi?.getState?.()?.transformSessionActive) return false;
        return selectionApi.confirmTransform?.() === true;
    }

    _hasAnimationProjectData(animationData) {
        return !!(
            animationData &&
            (
                (animationData.tracks?.length || 0) > 0 ||
                (animationData.clipAssets?.length || 0) > 0
            )
        );
    }

    _resetAnimationProjectData() {
        const animationTable = this._getAnimationTable();
        if (!animationTable) return false;

        animationTable.stop?.();
        animationTable._restoreVisibility?.();
        animationTable.resetLaneReferenceMode?.();
        animationTable.model = new TimelineModel();
        this._restoreAnimationUiState(animationTable);
        animationTable.initialClipAssetSeeded = false;
        animationTable._copiedCelRef = null;
        animationTable._internalLayerClipboard = null;
        animationTable._invalidateSnapshotTextureCache?.();
        animationTable.render?.();
        animationTable._flushLayerPanelSync?.();
        return true;
    }

    _captureAnimationUiState(animationTable) {
        return {
            selectedCelId: animationTable.selectedCelId || null,
            activeLaneId: animationTable.activeLaneId || null,
            selectedAssetId: animationTable.selectedAssetId || null,
            selectedAssetFolderId: animationTable.selectedAssetFolderId || null,
            selectedInternalLayerId: animationTable.selectedInternalLayerId || null,
            isLaneOnlySelected: animationTable.isLaneOnlySelected === true,
            playbackScope: animationTable.playbackScope || 'all',
            includedLaneIds: [...(animationTable.includedLaneIds || [])]
        };
    }

    _restoreAnimationProjectData(animationData, animationState = null) {
        const animationTable = this._getAnimationTable();
        if (!animationTable) return false;

        animationTable.stop?.();
        animationTable._restoreVisibility?.();
        animationTable.resetLaneReferenceMode?.();
        animationTable.model = new TimelineModel(animationData || {});
        this._restoreAnimationUiState(animationTable, animationState);
        animationTable.initialClipAssetSeeded = animationTable.model.clipAssets.length > 0;
        animationTable._copiedCelRef = null;
        animationTable._internalLayerClipboard = null;
        animationTable._invalidateSnapshotTextureCache?.();

        const selectedEntry = animationTable.selectedCelId
            ? animationTable.model.findClipEntry(animationTable.selectedCelId)
            : null;
        if (selectedEntry?.clip) {
            animationTable.activeLaneId = selectedEntry.lane.id;
            animationTable.model.setCurrentFrame(selectedEntry.clip.startFrame);
            animationTable._activateClipEntry?.(selectedEntry, { saveCurrent: false });
        } else if (animationTable.isLaneOnlySelected) {
            animationTable._clearWorkingLayersForEmptyFrame?.();
        } else {
            animationTable._syncWorkingLayersForCurrentFrame?.();
        }
        animationTable.render?.();
        animationTable._flushLayerPanelSync?.();
        return true;
    }

    _restoreAnimationUiState(animationTable, animationState = null) {
        const state = animationState || {};
        const selectedEntry = state.selectedCelId
            ? animationTable.model.findClipEntry(state.selectedCelId)
            : null;
        const activeLane = state.activeLaneId
            ? animationTable.model.getLaneById(state.activeLaneId)
            : null;
        const selectedAsset = state.selectedAssetId
            ? animationTable.model.getClipAsset(state.selectedAssetId)
            : null;

        animationTable.selectedCelId = selectedEntry?.clip?.id || null;
        animationTable.activeLaneId = selectedEntry?.lane?.id
            || (activeLane && activeLane.type !== 'folder' && !activeLane.isBackground ? activeLane.id : null);
        animationTable.isLaneOnlySelected = state.isLaneOnlySelected === true
            && !animationTable.selectedCelId
            && !!animationTable.activeLaneId;
        animationTable.selectedAssetId = selectedAsset?.id
            || (selectedEntry?.clip?.assetId || null);
        const resolvedAsset = animationTable.selectedAssetId
            ? animationTable.model.getClipAsset(animationTable.selectedAssetId)
            : null;
        animationTable.selectedAssetFolderId = resolvedAsset?.folderId || null;
        animationTable.selectedInternalLayerId = resolvedAsset?.internalLayers?.some(
            layer => layer.id === state.selectedInternalLayerId
        ) ? state.selectedInternalLayerId : (resolvedAsset?.internalLayers?.[0]?.id || null);
        animationTable.playbackScope = ['all', 'activeLane', 'includedLanes'].includes(state.playbackScope)
            ? state.playbackScope
            : 'all';
        const validLaneIds = new Set(animationTable.model.tracks.map(track => track.id));
        animationTable.includedLaneIds = new Set(
            (Array.isArray(state.includedLaneIds) ? state.includedLaneIds : [])
                .filter(laneId => validLaneIds.has(laneId))
        );
        animationTable.model.tracks.forEach(track => {
            track.active = track.id === animationTable.activeLaneId;
        });
    }

    refreshLoadedProjectUI() {
        if (!this.layerSystem) return;

        const layers = this.layerSystem.getLayers();
        let topDrawableIndex = -1;
        for (let index = layers.length - 1; index >= 0; index--) {
            const layerData = layers[index]?.layerData;
            if (layerData && !layerData.isBackground && !layerData.isFolder) {
                topDrawableIndex = index;
                break;
            }
        }

        if (topDrawableIndex >= 0 && typeof this.layerSystem.setActiveLayer === 'function') {
            this.layerSystem.setActiveLayer(topDrawableIndex);
        }

        this.layerSystem.refreshClippingMasks?.();

        layers.forEach((layer, index) => {
            if (layer.layerData?.isFolder) return;
            this.layerSystem.requestThumbnailUpdate?.(index, true);
        });

        requestAnimationFrame(() => {
            layers.forEach((layer, index) => {
                if (layer.layerData?.isFolder) return;
                this.layerSystem.requestThumbnailUpdate?.(index, true);
            });
        });

        setTimeout(() => {
            layers.forEach((layer, index) => {
                if (layer.layerData?.isFolder) return;
                this.layerSystem.requestThumbnailUpdate?.(index, true);
            });
        }, 80);
    }

    /**
     * dataURLからRenderTextureへ画像を読み込む
     */
    _loadLayerImage(target, dataURL, rasterBounds = null) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const layerData = target?.layerData || null;
                    let renderTexture = layerData ? layerData.renderTexture : target;
                    const imageWidth = Math.max(1, Math.round(img.naturalWidth || img.width || renderTexture?.width || 1));
                    const imageHeight = Math.max(1, Math.round(img.naturalHeight || img.height || renderTexture?.height || 1));
                    const requestedWidth = Math.max(1, Math.round(rasterBounds?.width || imageWidth));
                    const requestedHeight = Math.max(1, Math.round(rasterBounds?.height || imageHeight));
                    const targetWidth = Math.max(imageWidth, requestedWidth);
                    const targetHeight = Math.max(imageHeight, requestedHeight);
                    if (imageWidth < requestedWidth || imageHeight < requestedHeight) {
                        console.warn('[ProjectManager] layer image restore size is smaller than saved raster bounds', {
                            imageWidth,
                            imageHeight,
                            requestedWidth,
                            requestedHeight,
                            rasterBounds
                        });
                    }

                    if (layerData && (!renderTexture || renderTexture.width !== targetWidth || renderTexture.height !== targetHeight)) {
                        if (renderTexture) {
                            renderTexture.destroy(true);
                        }
                        renderTexture = PIXI.RenderTexture.create({
                            width: targetWidth,
                            height: targetHeight,
                            antialias: true
                        });
                        layerData.renderTexture = renderTexture;
                        if (layerData.layerSprite) {
                            layerData.layerSprite.texture = renderTexture;
                        }
                    }

                    if (!renderTexture) {
                        throw new Error('RenderTexture is not available for layer image restore.');
                    }

                    if (layerData) {
                        const nextBounds = normalizeRasterBounds(rasterBounds, {
                            width: targetWidth,
                            height: targetHeight
                        });
                        nextBounds.width = targetWidth;
                        nextBounds.height = targetHeight;
                        layerData.rasterBounds = nextBounds;
                        layerData.layerSprite?.position.set(nextBounds.x, nextBounds.y);
                    }

                    const restoreCanvas = document.createElement('canvas');
                    restoreCanvas.width = targetWidth;
                    restoreCanvas.height = targetHeight;
                    const restoreCtx = restoreCanvas.getContext('2d');
                    if (!restoreCtx) {
                        throw new Error('2D canvas context is not available for layer image restore.');
                    }
                    restoreCtx.clearRect(0, 0, targetWidth, targetHeight);
                    restoreCtx.drawImage(img, 0, 0, imageWidth, imageHeight);

                    // Decode result is normalized through Canvas2D before uploading to Pixi.
                    const texture = PIXI.Texture.from(restoreCanvas);
                    const sprite = new PIXI.Sprite(texture);
                    
                    this.app.renderer.render({
                        container: sprite,
                        target: renderTexture,
                        clear: true,
                        clearColor: [0, 0, 0, 0]
                    });

                    sprite.destroy({ texture: true, baseTexture: true });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    /**
     * Canvas の ImageData をアンプリマルチプライドに変換する
     * @param {HTMLCanvasElement} canvas
     * @returns {HTMLCanvasElement}
     */
    _unpremultiplyCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;

        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a > 0 && a < 255) {
                d[i]     = Math.min(255, Math.round(d[i]     * 255 / a));
                d[i + 1] = Math.min(255, Math.round(d[i + 1] * 255 / a));
                d[i + 2] = Math.min(255, Math.round(d[i + 2] * 255 / a));
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }
}

// 下位互換性のためにグローバルに登録
window.ProjectManager = ProjectManager;
