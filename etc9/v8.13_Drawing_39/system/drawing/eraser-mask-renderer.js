/**
 * EraserMaskRenderer - RenderTextureマスク方式の消しゴム描画
 * Phase 1 実装: BlendMode.ERASE使用
 * 
 * 使用方法:
 * 1. index.htmlの<script>タグで読み込む
 * 2. DrawingEngineのconstructorでインスタンス化
 * 3. stopDrawing()内でrenderEraserToMask()を呼び出し
 */

class EraserMaskRenderer {
    constructor(app) {
        this.app = app;
        this.renderer = app?.renderer;
    }

    /**
     * マスクに消しゴムを描画
     * @param {LayerModel} layerData - レイヤーデータ
     * @param {Array} points - 消しゴムの点列 [{x, y, pressure?}, ...]
     * @param {number} radius - 消しゴムの半径
     * @returns {boolean} 成功時true
     */
    renderEraserToMask(layerData, points, radius) {
        if (!layerData.maskTexture || !this.renderer) {
            return false;
        }

        if (!points || points.length === 0) {
            return false;
        }

        try {
            const eraserGraphics = new PIXI.Graphics();
            eraserGraphics.blendMode = PIXI.BLEND_MODES.ERASE;

            if (points.length === 1) {
                // 単独点
                eraserGraphics.circle(points[0].x, points[0].y, radius);
                eraserGraphics.fill({ color: 0x000000 });
            } else {
                // 線
                eraserGraphics.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    eraserGraphics.lineTo(points[i].x, points[i].y);
                }
                eraserGraphics.stroke({ width: radius * 2, color: 0x000000 });
            }

            // RenderTextureに描画（clear: false で既存内容保持）
            this.renderer.render({
                container: eraserGraphics,
                target: layerData.maskTexture,
                clear: false
            });

            eraserGraphics.destroy();

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * マスクのスナップショット取得（History用）
     * @param {LayerModel} layerData - レイヤーデータ
     * @returns {string|null} DataURL形式のスナップショット
     */
    captureMaskSnapshot(layerData) {
        if (!layerData.maskTexture || !this.renderer) {
            return null;
        }

        try {
            const canvas = this.renderer.extract.canvas(layerData.maskTexture);
            return canvas.toDataURL('image/png');

        } catch (error) {
            return null;
        }
    }

    /**
     * マスクのスナップショット復元（Undo/Redo用）
     * @param {LayerModel} layerData - レイヤーデータ
     * @param {string} snapshotDataURL - DataURL形式のスナップショット
     * @returns {Promise<boolean>} 成功時true
     */
    async restoreMaskSnapshot(layerData, snapshotDataURL) {
        if (!layerData.maskTexture || !this.renderer || !snapshotDataURL) {
            return false;
        }

        try {
            const img = new Image();
            
            return new Promise((resolve) => {
                img.onload = () => {
                    try {
                        const texture = PIXI.Texture.from(img);
                        const sprite = new PIXI.Sprite(texture);

                        this.renderer.render({
                            container: sprite,
                            target: layerData.maskTexture,
                            clear: true
                        });

                        sprite.destroy();
                        texture.destroy();

                        resolve(true);

                    } catch (error) {
                        resolve(false);
                    }
                };

                img.onerror = () => {
                    resolve(false);
                };

                img.src = snapshotDataURL;
            });

        } catch (error) {
            return false;
        }
    }
}

window.EraserMaskRenderer = EraserMaskRenderer;