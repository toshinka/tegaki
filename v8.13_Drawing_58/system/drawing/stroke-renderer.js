/**
 * StrokeRenderer - ストローク描画専用クラス (透明ペン完全対応版)
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * 改修: blendMode設定をPixiJS v8準拠に修正 (PIXI.BLEND_MODES.ERASE使用)
 * 
 * 描画方式:
 * - プレビュー: 筆圧対応Graphics
 * - 確定描画: 筆圧対応Graphics（同じ計算式）
 * - 消しゴム: PIXI.BLEND_MODES.ERASE で透明化（v8準拠）
 * - 分割描画: 既存 Graphics への描画（上書き）
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
         */
        setTool(tool) {
            this.currentTool = tool;
        }

        /**
         * 幅計算（プレビュー・確定共通）
         */
        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * リアルタイムプレビュー描画（筆圧対応）
         * @param {Array} points - [{x, y, pressure, time}, ...]
         * @param {Object} settings - {color, size, alpha}
         * @returns {PIXI.Graphics}
         */
        renderPreview(points, settings) {
            const graphics = new PIXI.Graphics();

            if (points.length === 0) {
                return graphics;
            }

            // ✅ 消しゴムモードの場合はblendModeを変更（PixiJS v8準拠）
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            // 単独点の場合は円
            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                
                if (this.currentTool === 'eraser') {
                    // 消しゴムは白色で描画（blendModeがERASEなので透明化される）
                    graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
                }
                return graphics;
            }

            // 複数点の場合は線分群（筆圧対応）
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                
                if (this.currentTool === 'eraser') {
                    // 消しゴムは白色で描画（blendModeがERASEなので透明化される）
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
            }

            return graphics;
        }

        /**
         * 確定ストローク描画
         * @param {PIXI.Container} layer - 描画先レイヤー
         * @param {Object} strokeData - {points, isSingleDot}
         * @param {Object} settings - {color, size, opacity}
         * @returns {Object} pathData
         */
        renderStroke(layer, strokeData, settings) {
            if (!layer || !strokeData || strokeData.points.length === 0) {
                return null;
            }

            const graphics = new PIXI.Graphics();
            
            // 消しゴムモードの場合はblendModeを設定
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            // 単独点の場合
            if (strokeData.isSingleDot || strokeData.points.length === 1) {
                const p = strokeData.points[0];
                const width = this.calculateWidth(p.pressure || 0.5, settings.size);
                
                graphics.circle(p.x, p.y, width / 2);
                
                if (this.currentTool === 'eraser') {
                    graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
                } else {
                    graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
                }
            } else {
                // 複数点の場合
                for (let i = 0; i < strokeData.points.length - 1; i++) {
                    const p1 = strokeData.points[i];
                    const p2 = strokeData.points[i + 1];
                    
                    const w1 = this.calculateWidth(p1.pressure || 0.5, settings.size);
                    const w2 = this.calculateWidth(p2.pressure || 0.5, settings.size);
                    const avgWidth = (w1 + w2) / 2;

                    graphics.moveTo(p1.x, p1.y);
                    graphics.lineTo(p2.x, p2.y);
                    
                    if (this.currentTool === 'eraser') {
                        graphics.stroke({
                            width: avgWidth,
                            color: 0xFFFFFF,
                            alpha: 1.0,
                            cap: 'round',
                            join: 'round'
                        });
                    } else {
                        graphics.stroke({
                            width: avgWidth,
                            color: settings.color,
                            alpha: settings.opacity || 1.0,
                            cap: 'round',
                            join: 'round'
                        });
                    }
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
         * 確定ストローク描画（筆圧反映版・プレビュー同一）
         * @param {Object} strokeData - {points, isSingleDot}
         * @param {Object} settings - {color, size, alpha}
         * @param {PIXI.Graphics} [targetGraphics] - 既存Graphics に描画する場合のターゲット
         * @returns {PIXI.Graphics}
         */
        renderFinalStroke(strokeData, settings, targetGraphics = null) {
            // 既存 Graphics への上書き描画
            const graphics = targetGraphics || new PIXI.Graphics();

            // ✅ 消しゴムモードの場合はblendModeを設定（PixiJS v8準拠）
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            if (strokeData.isSingleDot) {
                return this.renderDot(strokeData.points[0], settings, graphics);
            }

            const points = strokeData.points;

            if (points.length === 0) {
                return graphics;
            }

            // 複数点の場合は線分群（筆圧対応）
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                const w1 = this.calculateWidth(p1.pressure, settings.size);
                const w2 = this.calculateWidth(p2.pressure, settings.size);
                const avgWidth = (w1 + w2) / 2;

                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p2.x, p2.y);
                
                // 消しゴムモード時のストローク色設定
                if (this.currentTool === 'eraser') {
                    // 消しゴムは白色で描画（blendModeがERASEなので透明化される）
                    graphics.stroke({
                        width: avgWidth,
                        color: 0xFFFFFF,
                        alpha: 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                } else {
                    graphics.stroke({
                        width: avgWidth,
                        color: settings.color,
                        alpha: settings.alpha || 1.0,
                        cap: 'round',
                        join: 'round'
                    });
                }
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

            // ✅ 消しゴムモードの場合はblendModeを設定
            if (this.currentTool === 'eraser') {
                graphics.blendMode = 'erase';
            }

            graphics.circle(point.x, point.y, width / 2);
            
            if (this.currentTool === 'eraser') {
                // 消しゴムは白色で描画（blendModeがERASEなので透明化される）
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
            }

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

    // ===== グローバル登録（重要！）=====
    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ system/drawing/stroke-renderer.js loaded (グローバル登録修正版)');

})();