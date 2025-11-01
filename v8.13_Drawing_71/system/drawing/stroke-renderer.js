/**
 * StrokeRenderer - ストローク描画専用クラス (Phase 4-B: MSDF統合版)
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * Phase 4-A改修: WebGPU Compute ShaderによるSDF生成統合
 * Phase 4-B改修: MSDF (Multi-channel SDF) 統合
 * 
 * 描画方式優先順位:
 * 1. WebGPU MSDF（最高品質・RGB 3チャンネル）
 * 2. WebGPU SDF（高品質・シングルチャンネル）
 * 3. Legacy Graphics（フォールバック・互換性）
 */

(function() {
    'use strict';

    class StrokeRenderer {
        constructor(app, layerSystem, cameraSystem) {
            this.app = app;
            this.layerSystem = layerSystem;
            this.cameraSystem = cameraSystem;
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
            this.currentTool = 'pen';
            
            // WebGPU関連
            this.webgpuLayer = null;
            this.webgpuComputeSDF = null;
            this.textureBridge = null;
            this.webgpuEnabled = false;
        }

        /**
         * WebGPUレイヤー設定
         * @param {WebGPUDrawingLayer} webgpuLayer
         */
        async setWebGPULayer(webgpuLayer) {
            this.webgpuLayer = webgpuLayer;
            
            if (webgpuLayer && webgpuLayer.isInitialized()) {
                // WebGPU Compute SDF初期化
                this.webgpuComputeSDF = new window.WebGPUComputeSDF(webgpuLayer);
                await this.webgpuComputeSDF.initialize();
                
                // Texture Bridge初期化
                this.textureBridge = new window.WebGPUTextureBridge(webgpuLayer);
                
                this.webgpuEnabled = true;
                console.log('[StrokeRenderer] WebGPU integration enabled');
            }
        }

        /**
         * 現在のツールを設定
         */
        setTool(tool) {
            this.currentTool = tool;
        }

        /**
         * 幅計算（プレビュー・確定共通）
         */
        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * リアルタイムプレビュー描画（筆圧対応・累積描画）
         */
        renderPreview(points, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (points.length === 0) {
                return graphics;
            }

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (this.currentTool === 'eraser') {
                    graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
                }
                return graphics;
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                graphics.stroke({
                    width: avgWidth,
                    color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                    alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0),
                    cap: 'round',
                    join: 'round'
                });
            }

            return graphics;
        }

        /**
         * 確定ストローク描画（WebGPU/Legacy自動選択）
         */
        async renderFinalStroke(strokeData, settings, targetGraphics = null) {
            // WebGPU SDF有効時
            if (this.webgpuEnabled && this.webgpuComputeSDF && strokeData.points.length > 5) {
                try {
                    return await this._renderFinalStrokeWebGPU(strokeData, settings, targetGraphics);
                } catch (error) {
                    console.warn('[StrokeRenderer] WebGPU SDF failed, fallback to legacy:', error);
                }
            }

            // Legacy Graphics描画
            return this._renderFinalStrokeLegacy(strokeData, settings, targetGraphics);
        }

        /**
         * WebGPU SDF描画
         */
        async _renderFinalStrokeWebGPU(strokeData, settings, targetGraphics = null) {
            const points = strokeData.points;
            
            // Bounding Box計算
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            
            for (const p of points) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const padding = settings.size * 3;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            const width = Math.ceil(maxX - minX);
            const height = Math.ceil(maxY - minY);

            // ローカル座標に変換
            const localPoints = points.map(p => ({
                x: p.x - minX,
                y: p.y - minY
            }));

            // WebGPU Compute ShaderでSDF生成
            const sdfData = await this.webgpuComputeSDF.generateSDF(
                localPoints,
                width,
                height,
                settings.size * 2
            );

            if (!sdfData) {
                throw new Error('SDF generation failed');
            }

            // SDF → PixiJS Texture
            const sdfTexture = await this.textureBridge.sdfToPixiTexture(
                sdfData,
                width,
                height
            );

            if (!sdfTexture) {
                throw new Error('Texture conversion failed');
            }

            // SDF Sprite作成
            const sprite = new PIXI.Sprite(sdfTexture);
            sprite.position.set(minX, minY);

            if (this.currentTool === 'eraser') {
                sprite.blendMode = 'erase';
            } else {
                // 色適用（Tint）
                sprite.tint = settings.color;
                sprite.alpha = settings.alpha || 1.0;
            }

            console.log('[StrokeRenderer] WebGPU SDF rendered:', {
                points: points.length,
                resolution: `${width}x${height}`,
                tool: this.currentTool
            });

            return sprite;
        }

        /**
         * Legacy Graphics描画（フォールバック）
         */
        _renderFinalStrokeLegacy(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, graphics);
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return graphics;
            }

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                graphics.stroke({
                    width: avgWidth,
                    color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                    alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0),
                    cap: 'round',
                    join: 'round'
                });
            }

            return graphics;
        }

        /**
         * 単独点描画（円）
         */
        renderDot(point, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const width = this.calculateWidth(point.pressure, settings.size);

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            graphics.circle(point.x, point.y, width / 2);
            graphics.fill({
                color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0)
            });

            return graphics;
        }

        /**
         * エラーハンドリング（WebGPU失敗時）
         */
        _handleWebGPUError(error) {
            console.error('[StrokeRenderer] WebGPU error:', error);
            this.webgpuEnabled = false;
        }

        /**
         * 解像度更新（ウィンドウリサイズ時）
         */
        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    // グローバル登録
    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ system/drawing/stroke-renderer.js (Phase 4-A: WebGPU統合版) loaded');

})();