/**
 * ================================================================================
 * system/drawing/stroke-renderer.js - Surgical Update for Perfect-Freehand
 * ================================================================================
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
        }

        // WebGL2統合（互換性維持のためのダミー）
        async setWebGLLayer(webgl2Layer) {
            this.webgl2Enabled = false;
            return true;
        }

        _getSettings(providedSettings = null) {
            if (providedSettings) return providedSettings;
            if (window.brushSettings) return window.brushSettings.getSettings();
            return { size: 3, opacity: 1.0, color: 0x800000, mode: 'pen' };
        }

        _getCurrentMode(settings) {
            return settings?.mode || this.currentTool || 'pen';
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        calculateWidth(pressure, brushSize) {
            const minRatio = Math.max(0.3, this.minPhysicalWidth);
            const ratio = Math.max(minRatio, pressure || 0.5);
            return Math.max(this.minPhysicalWidth, brushSize * ratio);
        }

        /**
         * プレビュー描画（リアルタイム）
         */
        renderPreview(points, providedSettings = null, targetGraphics = null) {
            const graphics = targetGraphics || new PIXI.Graphics();
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);

            if (points.length === 0) return graphics;

            graphics.clear();

            // 1点のみ
            if (points.length === 1) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({ 
                    color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                    alpha: mode === 'eraser' ? 0.5 : (settings.opacity || 1.0) 
                });
                return graphics;
            }

            // Perfect-Freehand による高品質プレビュー
            if (window.VectorOperations && points.length > 2) {
                const polygon = window.VectorOperations.generateStrokePolygon(points, settings.size);
                if (polygon && polygon.length > 2) {
                    graphics.poly(polygon).fill({ 
                        color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                        alpha: mode === 'eraser' ? 0.5 : (settings.opacity || 1.0) 
                    });
                    return graphics;
                }
            }

            // Fallback: 簡易描画
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const w = this.calculateWidth((p1.pressure + p2.pressure) / 2, settings.size);
                graphics.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ 
                    width: w, 
                    color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                    alpha: mode === 'eraser' ? 0.5 : (settings.opacity || 1.0),
                    cap: 'round' 
                });
            }

            return graphics;
        }

        /**
         * 最終描画
         */
        async renderFinalStroke(strokeData, providedSettings = null) {
            const settings = this._getSettings(providedSettings);
            const mode = this._getCurrentMode(settings);
            const points = strokeData.points;

            if (!points || points.length === 0) return null;

            const graphics = new PIXI.Graphics();
            graphics.blendMode = (mode === 'eraser') ? 'erase' : 'normal';

            // 1点のみ
            if (points.length === 1 || strokeData.isSingleDot) {
                const p = points[0];
                const width = this.calculateWidth(p.pressure, settings.size);
                graphics.circle(p.x, p.y, width / 2);
                graphics.fill({ 
                    color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                    alpha: settings.opacity || 1.0 
                });
                return graphics;
            }

            // Perfect-Freehand による高品質描画
            if (window.VectorOperations) {
                const polygon = window.VectorOperations.generateStrokePolygon(points, settings.size);
                if (polygon && polygon.length > 2) {
                    graphics.poly(polygon).fill({ 
                        color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                        alpha: settings.opacity || 1.0 
                    });
                    return graphics;
                }
            }

            // Fallback: 高品質スタンプ描画
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const steps = Math.ceil(dist / 1); // 1px刻み
                
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const x = p1.x + (p2.x - p1.x) * t;
                    const y = p1.y + (p2.y - p1.y) * t;
                    const pr = p1.pressure + (p2.pressure - p1.pressure) * t;
                    const w = this.calculateWidth(pr, settings.size);
                    graphics.circle(x, y, w / 2);
                }
            }
            graphics.fill({ 
                color: mode === 'eraser' ? 0xFFFFFF : settings.color, 
                alpha: settings.opacity || 1.0 
            });

            return graphics;
        }

        updateResolution() {
            this.resolution = window.devicePixelRatio || 1;
            this.minPhysicalWidth = 1 / this.resolution;
        }
    }

    window.StrokeRenderer = StrokeRenderer;

    console.log('✅ stroke-renderer.js (Surgical Update) loaded');

})();
