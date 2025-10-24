// ===== system/drawing/eraser-mask-renderer.js - Phase 3: 消しゴムマスクレンダラー =====
// マスクベース消しゴム実装
// レイヤーの maskTexture に黒い円と線を描画することで消去効果を実現
// API: renderEraserToMask(), clearMask()

/**
 * EraserMaskRenderer
 * 消しゴムツールでレイヤーマスクに黒を描画
 * 黒い部分 = 非表示（削られた部分）
 * 白い部分 = 表示（残っている部分）
 */
class EraserMaskRenderer {
    /**
     * @param {PIXI.Application} app - PixiJS アプリケーション
     */
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
    }

    /**
     * ===== Phase 3: マスクに消しゴムを描画 =====
     * レイヤーの maskTexture に黒い円と線を描画
     * @param {LayerModel} layerData - レイヤーデータモデル
     * @param {Array} points - 消しゴムポイント配列 [{x, y}, ...]
     * @param {number} radius - 消しゴム半径
     * @returns {boolean} 成功/失敗
     */
    renderEraserToMask(layerData, points, radius) {
        // マスク存在チェック
        if (!layerData.hasMask()) {
            return false;
        }

        // ポイント配列チェック
        if (!points || points.length === 0) {
            return false;
        }

        try {
            // 一時 Graphics 作成
            const eraserGraphics = new PIXI.Graphics();

            // 黒色で描画（非表示領域）
            const eraserColor = 0x000000;
            const eraserAlpha = 1.0;

            // 各ポイントに円を描画
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                // 円を描画
                eraserGraphics.circle(point.x, point.y, radius);
                eraserGraphics.fill({ color: eraserColor, alpha: eraserAlpha });

                // 前のポイントと線で接続（滑らかな軌跡）
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

            // マスクテクスチャに描画（既存マスクを保持）
            this.renderer.render({
                container: eraserGraphics,
                target: layerData.maskTexture,
                clear: false  // 既存のマスクを保持
            });

            // 一時 Graphics を破棄
            eraserGraphics.destroy({ children: true });

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * ===== Phase 3: マスククリア =====
     * マスクを全白（全表示）にリセット
     * @param {LayerModel} layerData - レイヤーデータモデル
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @returns {boolean} 成功/失敗
     */
    clearMask(layerData, width, height) {
        if (!layerData.hasMask()) {
            return false;
        }

        try {
            // 白い矩形で全体を塗りつぶす
            const clearGraphics = new PIXI.Graphics();
            clearGraphics.rect(0, 0, width, height);
            clearGraphics.fill({ color: 0xFFFFFF });

            // マスクテクスチャをクリア
            this.renderer.render({
                container: clearGraphics,
                target: layerData.maskTexture,
                clear: true  // 完全にクリア
            });

            clearGraphics.destroy({ children: true });

            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * ===== Phase 3: マスク状態のスナップショット取得 =====
     * History 記録用にマスクの画像データを取得
     * @param {LayerModel} layerData - レイヤーデータモデル
     * @returns {string|null} DataURL または null
     */
    captureMaskSnapshot(layerData) {
        if (!layerData.hasMask()) {
            return null;
        }

        try {
            // RenderTexture から Canvas を抽出
            const canvas = this.renderer.extract.canvas(layerData.maskTexture);
            
            // DataURL に変換
            return canvas.toDataURL('image/png');

        } catch (error) {
            return null;
        }
    }

    /**
     * ===== Phase 3: マスク状態の復元 =====
     * History Undo/Redo 用にマスクを復元
     * @param {LayerModel} layerData - レイヤーデータモデル
     * @param {string} dataURL - スナップショットの DataURL
     * @returns {Promise<boolean>} 成功/失敗
     */
    async restoreMaskSnapshot(layerData, dataURL) {
        if (!layerData.hasMask() || !dataURL) {
            return false;
        }

        return new Promise((resolve) => {
            try {
                // Image 要素で読み込み
                const img = new Image();
                
                img.onload = () => {
                    try {
                        // Sprite を作成して描画
                        const texture = PIXI.Texture.from(img);
                        const sprite = new PIXI.Sprite(texture);

                        // マスクテクスチャに描画
                        this.renderer.render({
                            container: sprite,
                            target: layerData.maskTexture,
                            clear: true
                        });

                        sprite.destroy({ children: true });
                        texture.destroy(true);
                        
                        resolve(true);
                    } catch (renderError) {
                        resolve(false);
                    }
                };

                img.onerror = () => {
                    resolve(false);
                };

                img.src = dataURL;

            } catch (error) {
                resolve(false);
            }
        });
    }

    /**
     * ===== Phase 3: マスクのプレビュー描画 =====
     * 消しゴム使用中のプレビュー円を表示
     * @param {PIXI.Graphics} previewGraphics - プレビュー用 Graphics
     * @param {Object} worldPos - ワールド座標 {x, y}
     * @param {number} radius - 消しゴム半径
     */
    renderEraserPreview(previewGraphics, worldPos, radius) {
        if (!previewGraphics) {
            return;
        }

        try {
            previewGraphics.clear();
            
            // 赤い円（半透明）でプレビュー
            previewGraphics.circle(worldPos.x, worldPos.y, radius);
            previewGraphics.stroke({ 
                width: 2, 
                color: 0xFF0000, 
                alpha: 0.6 
            });

            // 中心点
            previewGraphics.circle(worldPos.x, worldPos.y, 1);
            previewGraphics.fill({ 
                color: 0xFF0000, 
                alpha: 0.8 
            });

        } catch (error) {
            // プレビュー描画失敗は無視
        }
    }
}

// グローバル公開
window.EraserMaskRenderer = EraserMaskRenderer;