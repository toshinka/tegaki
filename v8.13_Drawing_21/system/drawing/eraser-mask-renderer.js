// ============================================================================
// system/drawing/eraser-mask-renderer.js - Phase 2完全版
// ============================================================================

(function() {
    'use strict';

    class EraserMaskRenderer {
        constructor(app) {
            this.app = app;
            this.renderer = app.renderer;
            this.eraserSnapshotCache = new Map();
        }

        // Phase 2: GPU最適化版 - destination-out使用
        renderEraserToMask(layerData, points, radius) {
            if (!layerData?.maskTexture || points.length === 0) {
                return false;
            }

            try {
                const eraserGraphics = new PIXI.Graphics();
                
                // PixiJS v8: globalCompositeOperation互換
                eraserGraphics.context.globalCompositeOperation = 'destination-out';
                
                eraserGraphics.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length; i++) {
                    eraserGraphics.lineTo(points[i].x, points[i].y);
                }
                
                eraserGraphics.stroke({ 
                    width: radius * 2, 
                    color: 0x000000,
                    cap: 'round',
                    join: 'round'
                });

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

        // Phase 2: リアルタイム増分消しゴム
        renderIncrementalErase(layerData, newPoints, radius) {
            if (!layerData?.maskTexture || newPoints.length === 0) {
                return;
            }

            try {
                const incrementalGraphics = new PIXI.Graphics();
                incrementalGraphics.context.globalCompositeOperation = 'destination-out';

                for (let i = 0; i < newPoints.length - 1; i++) {
                    const p1 = newPoints[i];
                    const p2 = newPoints[i + 1];
                    incrementalGraphics.moveTo(p1.x, p1.y);
                    incrementalGraphics.lineTo(p2.x, p2.y);
                }
                
                incrementalGraphics.stroke({ 
                    width: radius * 2, 
                    color: 0x000000,
                    cap: 'round',
                    join: 'round'
                });

                this.renderer.render({
                    container: incrementalGraphics,
                    target: layerData.maskTexture,
                    clear: false
                });

                incrementalGraphics.destroy();

            } catch (error) {
                // エラーは無視（パフォーマンス優先）
            }
        }

        // Phase 2: GPU高速スナップショット
        captureMaskSnapshot(layerData) {
            if (!layerData?.maskTexture) {
                return null;
            }

            try {
                const backup = PIXI.RenderTexture.create({
                    width: layerData.maskTexture.width,
                    height: layerData.maskTexture.height
                });

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

        // Phase 2: GPU高速復元
        async restoreMaskSnapshot(layerData, snapshotTexture) {
            if (!layerData?.maskTexture || !snapshotTexture) {
                return false;
            }

            try {
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

        // 消しゴムプレビュー描画
        renderEraserPreview(graphics, worldPos, radius) {
            if (!graphics || !worldPos) return;
            
            graphics.clear();
            graphics.circle(worldPos.x, worldPos.y, radius);
            graphics.stroke({ 
                width: 1, 
                color: 0xFFFFFF,
                alpha: 0.7
            });
            graphics.circle(worldPos.x, worldPos.y, radius);
            graphics.stroke({ 
                width: 1, 
                color: 0x000000,
                alpha: 0.3
            });
        }

        // スナップショット破棄
        destroySnapshot(snapshot) {
            if (snapshot && snapshot.destroy) {
                snapshot.destroy(true);
            }
        }

        // レイヤーキャッシュクリア
        clearLayerCache(layerId) {
            if (this.eraserSnapshotCache.has(layerId)) {
                const cache = this.eraserSnapshotCache.get(layerId);
                cache.forEach(snap => this.destroySnapshot(snap));
                this.eraserSnapshotCache.delete(layerId);
            }
        }

        // 全キャッシュクリア
        clearAllCache() {
            this.eraserSnapshotCache.forEach((cache, layerId) => {
                cache.forEach(snap => this.destroySnapshot(snap));
            });
            this.eraserSnapshotCache.clear();
        }
    }

    window.EraserMaskRenderer = EraserMaskRenderer;
    
    console.log('✅ eraser-mask-renderer.js (Phase 2完全版) loaded');

})();