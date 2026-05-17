/**
 * ============================================================================
 * ファイル名: system/project-manager.js
 * 責務: プロジェクト全体の保存（JSON/ZIP）と読み込みを担当する
 * 依存: system/event-bus.js, system/layer-system.js, system/config.js
 * 被依存: core-engine.js, ui/sidebar等
 * 公開API: ProjectManager
 * ============================================================================
 */

import { TegakiEventBus } from './event-bus.js';
import { TEGAKI_CONFIG } from '../config.js';
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

        const layers = this.layerSystem.getLayers();
        const canvasWidth = TEGAKI_CONFIG.canvas.width;
        const canvasHeight = TEGAKI_CONFIG.canvas.height;

        const projectData = {
            version: 1,
            app: "tegaki",
            canvas: {
                width: canvasWidth,
                height: canvasHeight
            },
            background: {
                color: TEGAKI_CONFIG.canvas.backgroundColor || 0xf0e0d6,
                visible: true // 現状固定
            },
            layers: []
        };

        // レイヤー情報を収集（通常レイヤーのみ。背景は別途保存）
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const data = layer.layerData;

            if (data.isBackground) {
                projectData.background.color = data.backgroundColor;
                continue;
            }
            if (data.isFolder) {
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
                const { layer, index } = this.layerSystem.createLayer(layerInfo.name);
                if (!layer) continue;

                // 基本プロパティ
                layer.layerData.id = layerInfo.id || layer.layerData.id;
                layer.layerData.visible = layerInfo.visible !== false;
                layer.layerData.opacity = layerInfo.opacity !== undefined ? layerInfo.opacity : 1.0;
                layer.layerData.blendMode = layerInfo.blendMode || 'normal';
                
                layer.visible = layer.layerData.visible;
                layer.alpha = layer.layerData.opacity;

                // 画像復元
                if (layerInfo.image && layer.layerData.renderTexture && this.app.renderer) {
                    await this._loadLayerImage(layer.layerData.renderTexture, layerInfo.image);
                }
            }
        }

        // 4. 履歴クリア
        if (window.History) {
            window.History.clear();
        }

        // 5. UI更新要求
        if (this.eventBus) {
            this.eventBus.emit('layer:panel-update-requested');
        }

        this.refreshLoadedProjectUI();
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
}

// 下位互換性のためにグローバルに登録
window.ProjectManager = ProjectManager;
