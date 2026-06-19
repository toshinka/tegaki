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
import * as PIXI from 'pixi.js';

export class ProjectManager {
    constructor(layerSystem, app) {
        this.layerSystem = layerSystem;
        this.app = app;
        this.eventBus = TegakiEventBus;
    }

    /**
     * プロジェクトをJSONデータとしてエクスポート
     */
    async exportProject() {
        if (!this.layerSystem || !this.app) return null;
        this._commitFloatingSelection();

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
            animationTable._saveSelectedClipFromWorkingLayers?.({ force: true });
            projectData.animation = animationTable.model.serialize();
            projectData.animationState = this._captureAnimationUiState(animationTable);
        }

        // レイヤー情報を収集（背景は別途保存）
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
                image: imageData
            });
        }

        return projectData;
    }

    /**
     * プロジェクトJSONをファイルとしてダウンロード
     */
    async saveToFile() {
        const data = await this.exportProject();
        if (!data) return;

        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `tegaki_project_${timestamp}.json`;
        a.href = url;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * プロジェクトJSONを読み込み
     */
    async loadProject(projectData) {
        if (!projectData || projectData.app !== 'tegaki') {
            throw new Error('Invalid project data');
        }
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
                layer.layerData.clipping = layerInfo.clipping === true;
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

                // 画像復元
                if (!layerInfo.isFolder && layerInfo.image && layer.layerData.renderTexture && this.app.renderer) {
                    await this._loadLayerImage(layer.layerData.renderTexture, layerInfo.image);
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
    _loadLayerImage(renderTexture, dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    // PixiJS v8 の基盤テクスチャを作成
                    const texture = PIXI.Texture.from(img);
                    const sprite = new PIXI.Sprite(texture);
                    
                    this.app.renderer.render({
                        container: sprite,
                        target: renderTexture,
                        clear: true
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
