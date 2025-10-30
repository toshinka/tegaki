/**
 * StrokeRenderer - ストローク描画専用クラス (Phase 2統合版)
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * 改修: ペン/消しゴム統合、blendMode切替のみで両モード実現
 * 
 * 描画方式:
 * - プレビュー: 筆圧対応Graphics（累積描画）
 * - 確定描画: 筆圧対応Graphics（同じ計算式）
 * - ペン: blendMode='normal', 通常描画
 * - 消しゴム: blendMode='erase', maskTextureへ描画
 * - 各線分ごとに stroke() 呼び出し（PixiJS v8要件）
 * 
 * Phase 2変更点:
 * - setTool()でペン/消しゴム切替
 * - renderStroke()で消しゴム時はmaskTextureに描画
 * - eraser-mask-renderer.jsの機能を完全統合
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
            this.currentTool = 'pen'; // 'pen' or 'eraser'
        }

        /**
         * 現在のツールを設定
         * @param {'pen'|'eraser'} tool
         */
        setTool(tool) {
            if (tool !== 'pen' && tool !== 'eraser') {
                console.warn(`Invalid tool: ${tool}, defaulting to pen`);
                tool = 'pen';
            }
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
         * @param {Array} points - [{x, y, pressure, time}, ...]
         * @param {Object} settings - {color, size, alpha}
         * @param {PIXI.Graphics} [targetGraphics] - 既存Graphicsに累積描画する場合
         * @returns {PIXI.Graphics}
         */
        renderPreview(points, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (points.length === 0) {
                return graphics;
            }

            // 消しゴムモードの場合はblendModeを変更
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            // 単独点の場合は円
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

            // PixiJS v8: 各線分ごとに stroke() を呼ぶ（重要！）
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
         * 確定ストローク描画（Phase 2統合版）
         * 
         * ペンモード: 通常レイヤーに描画
         * 消しゴムモード: maskTextureに描画（自動生成）
         * 
         * @param {PIXI.Container} layerContainer - 描画先レイヤーContainer
         * @param {Object} strokeData - {points, isSingleDot}
         * @param {Object} settings - {color, size, opacity}
         * @returns {Object} pathData
         */
        renderStroke(layerContainer, strokeData, settings) {
            if (!layerContainer || !strokeData || strokeData.points.length === 0) {
                return null;
            }

            // 消しゴムモードの場合はmaskTextureに描画
            if (this.currentTool === 'eraser') {
                return this._renderEraserStroke(layerContainer, strokeData, settings);
            }

            // ペンモード: 通常描画
            const graphics = new PIXI.Graphics();
            graphics.blendMode = 'normal';

            // 単独点の場合
            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const p = strokeData.points[0];
                const width = this.calculateWidth(p.pressure || 0.5, settings.size);
                
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({
                    color: settings.color,
                    alpha: settings.opacity || 1.0
                });
            } else {
                // PixiJS v8: 各線分ごとに stroke() を呼ぶ
                for (let i = 0; i < strokeData.points.length - 1; i++) {
                    const p1 = strokeData.points[i];
                    const p2 = strokeData.points[i + 1];
                    
                    const w1 = this.calculateWidth(p1.pressure || 0.5, settings.size);
                    const w2 = this.calculateWidth(p2.pressure || 0.5, settings.size);
                    const avgWidth = (w1 + w2) / 2;

                    graphics.moveTo(p1.x, p1.y);
                    graphics.lineTo(p2.x, p2.y);
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.opacity || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            // pathDataオブジェクト作成
            const pathData = {
                id: 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                points: strokeData.points,
                color: settings.color,
                size: settings.size,
                opacity: settings.opacity || 1.0,
                tool: this.currentTool,
                isComplete: true,
                graphics: graphics
            };

            return pathData;
        }

        /**
         * 消しゴムストローク描画（内部メソッド）
         * @private
         */
        _renderEraserStroke(layerContainer, strokeData, settings) {
            // LayerSystemからlayerDataを取得
            const layerData = this._getLayerDataFromContainer(layerContainer);
            if (!layerData) {
                console.warn('LayerData not found for eraser stroke');
                return null;
            }

            // maskTextureを自動生成（未作成の場合）
            if (!layerData.maskTexture) {
                this._ensureMaskTexture(layerData);
            }

            // 消しゴム用Graphics作成
            const graphics = new PIXI.Graphics();
            graphics.blendMode = 'erase'; // CRITICAL: 消しゴムモード

            // 単独点の場合
            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const p = strokeData.points[0];
                const width = this.calculateWidth(p.pressure || 0.5, settings.size);
                
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                // 各線分を描画
                for (let i = 0; i < strokeData.points.length - 1; i++) {
                    const p1 = strokeData.points[i];
                    const p2 = strokeData.points[i + 1];
                    
                    const w1 = this.calculateWidth(p1.pressure || 0.5, settings.size);
                    const w2 = this.calculateWidth(p2.pressure || 0.5, settings.size);
                    const avgWidth = (w1 + w2) / 2;

                    graphics.moveTo(p1.x, p1.y);
                    graphics.lineTo(p2.x, p2.y);
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            // maskTextureに描画
            this.app.renderer.render({
                container: graphics,
                target: layerData.maskTexture,
                clear: false
            });

            // Graphicsを破棄（maskTextureに転写済み）
            graphics.destroy();

            // pathDataオブジェクト作成（履歴用）
            const pathData = {
                id: 'eraser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                points: strokeData.points,
                color: 0xFFFFFF,
                size: settings.size,
                opacity: 1.0,
                tool: 'eraser',
                isComplete: true,
                graphics: null // maskTextureに転写済みのためnull
            };

            return pathData;
        }

        /**
         * maskTextureの自動生成（Phase 2新規）
         * @private
         */
        _ensureMaskTexture(layerData) {
            if (layerData.maskTexture) return;

            const config = window.TEGAKI_CONFIG || { canvas: { width: 800, height: 600 } };
            
            layerData.maskTexture = PIXI.RenderTexture.create({
                width: config.canvas.width,
                height: config.canvas.height,
                resolution: this.resolution
            });

            // 初期値: 完全不透明（白）
            const whiteFill = new PIXI.Graphics();
            whiteFill.rect(0, 0, config.canvas.width, config.canvas.height);
            whiteFill.fill({ color: 0xFFFFFF, alpha: 1.0 });

            this.app.renderer.render({
                container: whiteFill,
                target: layerData.maskTexture
            });

            whiteFill.destroy();

            // layerContainerにマスク適用
            if (layerData.container) {
                layerData.container.mask = new PIXI.Sprite(layerData.maskTexture);
                layerData.container.addChild(layerData.container.mask);
            }

            console.log(`✅ MaskTexture created for layer: ${layerData.id}`);
        }

        /**
         * ContainerからLayerDataを取得
         * @private
         */
        _getLayerDataFromContainer(container) {
            if (!this.layerSystem) return null;

            const layers = this.layerSystem.layers || [];
            return layers.find(layer => layer.container === container);
        }

        /**
         * 確定ストローク描画（筆圧反映版・プレビュー同一）
         * @param {Object} strokeData - {points, isSingleDot}
         * @param {Object} settings - {color, size, alpha}
         * @param {PIXI.Graphics} [targetGraphics] - 既存Graphics に描画する場合のターゲット
         * @returns {PIXI.Graphics}
         */
        renderFinalStroke(strokeData, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                return this.renderDot(strokeData.points[0], settings, graphics);
            }

            const points = strokeData.points;
            if (points.length === 0) {
                return graphics;
            }

            // PixiJS v8: 各線分ごとに stroke() を呼ぶ
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
         * @param {Object} point - {x, y, pressure}
         * @param {Object} settings - {color, size, alpha}
         * @param {PIXI.Graphics} [targetGraphics] - 既存Graphics に描画する場合のターゲット
         * @returns {PIXI.Graphics}
         */
        renderDot(point, settings, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const width = this.calculateWidth(point.pressure, settings.size);

            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            } else {
                graphics.blendMode = 'normal';
            }

            graphics.circle(point.x, point.y, width / 2);
            graphics.fill({
                color: this.currentTool === 'eraser' ? 0xFFFFFF : settings.color,
                alpha: this.currentTool === 'eraser' ? 1.0 : (settings.alpha || 1.0)
            });

            return graphics;
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

    console.log('✅ system/drawing/stroke-renderer.js loaded (Phase 2統合版)');

})();