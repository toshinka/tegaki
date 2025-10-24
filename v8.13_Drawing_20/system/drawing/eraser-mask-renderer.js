// ===== system/drawing/eraser-mask-renderer.js - Phase 2完成版 =====
// BlendMode.ERASE + GPU最適化による高速消しゴム実装
// RenderTexture GPUコピーによるUndo/Redo高速化

/**
 * EraserMaskRenderer - Phase 2: GPU最適化版
 * - BlendMode.ERASE活用でGPU直接処理
 * - RenderTexture GPU間コピーで高速Undo/Redo
 * - Canvas2D依存完全排除
 */
class EraserMaskRenderer {
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
    }

    /**
     * Phase 2: BlendMode.ERASEによるGPU消しゴム描画
     * @param {LayerModel} layerData - レイヤーデータモデル
     * @param {Array} points - 消しゴムポイント配列 [{x, y}, ...]
     * @param {number} radius - 消しゴム半径
     * @returns {boolean} 成功/失敗
     */
    renderEraserToMask(layerData, points, radius) {
        if (!layerData.hasMask()) {
            return false;
        }

        if (!points || points.length === 0) {
            return false;
        }

        try {
            const eraserGraphics = new PIXI.Graphics();
            
            // ===== Phase 2: BlendMode.ERASE使用 =====
            eraserGraphics.blendMode = PIXI.BLEND_MODES.ERASE;

            // 黒色で描画（BLEND_MODES.ERASEと組み合わせて消去）
            const eraserColor = 0x000000;
            const eraserAlpha = 1.0;

            // 各ポイントに円を描画
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                eraserGraphics.circle(point.x, point.y, radius);
                eraserGraphics.fill({ color: eraserColor, alpha: eraserAlpha });

                // 前のポイントと線で接続
                if (i > 0) {
                    const prevPoint = points[i - 1];
                    eraserGraphics.moveTo(prevPoint.x, prevPoint.y);
                    eraserGraphics.lineTo(point.x, point.y);
                    eraserGraphics.stroke({ 
                        width: radius * 2, 
                        color: eraserColor, 
                        alpha: eraserAlpha,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            // ===== GPU直接レンダリング（clear: false で既存保持） =====
            this.renderer.render({
                container: eraserGraphics,
                target: layerData.maskTexture,
                clear: false
            });

            eraserGraphics.destroy({ children: true });

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * Phase 2: マスククリア（GPU直接処理）
     */
    clearMask(layerData, width, height) {
        if (!layerData.hasMask()) {
            return false;
        }

        try {
            const clearGraphics = new PIXI.Graphics();
            clearGraphics.rect(0, 0, width, height);
            clearGraphics.fill({ color: 0xFFFFFF });

            this.renderer.render({
                container: clearGraphics,
                target: layerData.maskTexture,
                clear: true
            });

            clearGraphics.destroy({ children: true });

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * Phase 2: GPU高速スナップショット（RenderTexture直接コピー）
     * @param {LayerModel} layerData
     * @returns {PIXI.RenderTexture|null} バックアップテクスチャ
     */
    captureMaskSnapshot(layerData) {
        if (!layerData.hasMask()) {
            return null;
        }

        try {
            // ===== GPU内コピー（高速） =====
            const backup = PIXI.RenderTexture.create({
                width: layerData.maskTexture.width,
                height: layerData.maskTexture.height
            });

            // GPU間コピー（CPUを経由しない）
            const sprite = new PIXI.Sprite(layerData.maskTexture);
            this.renderer.render({
                container: sprite,
                target: backup,
                clear: true
            });
            sprite.destroy();

            return backup;

        } catch (error) {
            return null;
        }
    }

    /**
     * Phase 2: GPU高速復元（RenderTexture直接コピー）
     * @param {LayerModel} layerData
     * @param {PIXI.RenderTexture} snapshotTexture - バックアップテクスチャ
     * @returns {Promise<boolean>} 成功/失敗
     */
    async restoreMaskSnapshot(layerData, snapshotTexture) {
        if (!layerData.hasMask() || !snapshotTexture) {
            return false;
        }

        try {
            // ===== GPU間コピーで復元（高速） =====
            const sprite = new PIXI.Sprite(snapshotTexture);
            this.renderer.render({
                container: sprite,
                target: layerData.maskTexture,
                clear: true
            });
            sprite.destroy();

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * Phase 2: リアルタイム増分プレビュー（GPU最適化）
     * @param {LayerModel} layerData
     * @param {Array} newPoints - 新規追加ポイントのみ
     * @param {number} radius
     */
    renderIncrementalErase(layerData, newPoints, radius) {
        if (!layerData.hasMask() || !newPoints || newPoints.length === 0) {
            return false;
        }

        try {
            const incrementalGraphics = new PIXI.Graphics();
            incrementalGraphics.blendMode = PIXI.BLEND_MODES.ERASE;

            const eraserColor = 0x000000;
            const eraserAlpha = 1.0;

            // 新規ポイントのみ描画
            for (let i = 0; i < newPoints.length; i++) {
                const point = newPoints[i];
                
                incrementalGraphics.circle(point.x, point.y, radius);
                incrementalGraphics.fill({ color: eraserColor, alpha: eraserAlpha });

                if (i > 0) {
                    const prevPoint = newPoints[i - 1];
                    incrementalGraphics.moveTo(prevPoint.x, prevPoint.y);
                    incrementalGraphics.lineTo(point.x, point.y);
                    incrementalGraphics.stroke({ 
                        width: radius * 2, 
                        color: eraserColor, 
                        alpha: eraserAlpha,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            // 増分描画（既存保持）
            this.renderer.render({
                container: incrementalGraphics,
                target: layerData.maskTexture,
                clear: false
            });

            incrementalGraphics.destroy({ children: true });

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * 消しゴムプレビュー描画
     */
    renderEraserPreview(previewGraphics, worldPos, radius) {
        if (!previewGraphics) {
            return;
        }

        try {
            previewGraphics.clear();
            
            previewGraphics.circle(worldPos.x, worldPos.y, radius);
            previewGraphics.stroke({ 
                width: 2, 
                color: 0xFF0000, 
                alpha: 0.6 
            });

            previewGraphics.circle(worldPos.x, worldPos.y, 1);
            previewGraphics.fill({ 
                color: 0xFF0000, 
                alpha: 0.8 
            });

        } catch (error) {}
    }

    /**
     * スナップショット破棄（メモリ管理）
     * @param {PIXI.RenderTexture} snapshot
     */
    destroySnapshot(snapshot) {
        if (snapshot && snapshot.destroy) {
            try {
                snapshot.destroy(true);
            } catch (e) {}
        }
    }
}

window.EraserMaskRenderer = EraserMaskRenderer;