/**
 * ============================================================================
 * ファイル名: system/drawing/stroke-renderer.js
 * 責務: ストロークの視覚化（プレビュー・最終描画）を担当する。Perfect-Freehandを使用したポリゴン描画を基本とする。
 * 依存: pixi.js, config.js, brush-settings.js, perfect-freehand
 * 被依存: brush-core.js, core-engine.js等
 * 公開API: StrokeRenderer
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.StrokeRenderer
 * 実装状態: ♻️移植・最適化
 * ============================================================================
 */

import { Graphics, Mesh, Geometry } from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { TEGAKI_CONFIG } from '../../config.js';

export class StrokeRenderer {
    constructor(app, layerSystem, cameraSystem) {
        this.app = app;
        this.layerSystem = layerSystem;
        this.cameraSystem = cameraSystem;
        this.resolution = 1; // Phase 1: DPR=1固定
        this.minPhysicalWidth = 1 / this.resolution;
        this.currentTool = 'pen';
        
        this.glStrokeProcessor = null;
        this.glMSDFPipeline = null;
        this.textureBridge = null;
        this.webgl2Enabled = false;
        
        this.config = window.TEGAKI_CONFIG?.webgpu || {};
    }

    async setWebGLLayer(webgl2Layer) {
        if (!this.config.enabled) {
            this.webgl2Enabled = false;
            return false;
        }
        return false;
    }

    _getSettings(providedSettings = null) {
        if (providedSettings) {
            return providedSettings;
        }
        
        if (window.brushSettings) {
            return window.brushSettings.getSettings();
        }
        
        return {
            size: 3,
            opacity: 1.0,
            color: 0x800000,
            mode: 'pen'
        };
    }

    _getCurrentMode(settings) {
        const mode = settings?.mode || this.currentTool || 'pen';
        return mode;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    calculateWidth(pressure, brushSize) {
        const minRatio = 0.02; // クランプを 0.02 に変更
        const ratio = Math.max(minRatio, pressure ?? 0.5);
        return Math.max(this.minPhysicalWidth, brushSize * ratio);
    }

    /**
     * [指示書] 消しゴムのリアルタイム反映用：短いセグメント用の実描画Graphicsを生成
     */
    renderEraserSegment(points, settings) {
        return this._renderEraserStroke(
            { points, isSingleDot: points.length === 1 },
            { ...settings, mode: 'eraser' }
        );
    }

    /**
     * [指示書] ペンのリアルタイム反映用：短いセグメント用の実描画Graphicsを生成
     * Graphics.moveTo/lineTo + stroke を使用する。
     */
    renderPenSegment(points, settings) {
        if (!points || points.length < 2) return null;
        
        const graphics = new Graphics();
        graphics.blendMode = 'normal';
        
        const color = settings.color;
        const alpha = settings.opacity || 1.0;
        const p0 = points[0]?.pressure ?? 1.0;
        const p1 = points[points.length - 1]?.pressure ?? p0;
        const segmentPressure = (p0 + p1) / 2;
        const width = settings.pressureEnabled === true
            ? this.calculateWidth(segmentPressure, settings.size)
            : settings.size;
        
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        
        graphics.stroke({ 
            width: width, 
            color: color, 
            alpha: alpha, 
            cap: 'round', 
            join: 'round' 
        });
        
        return graphics;
    }

    /**
     * Perfect-Freehand のオプションを統一
     */
    _getFreehandOptions(size) {
        return {
            size: size,
            thinning: 0.7,
            smoothing: 0.08, // [指示書] デフォルト補正を弱める (0.4 -> 0.08)
            streamline: 0.0, // [指示書] デフォルト補正を弱める (0.3 -> 0.0)
            simulatePressure: false,
            last: true
        };
    }

    /**
     * [指示書] 鋭角対策：極端に近い点を除外するフィルタ
     */
    _filterNearPoints(points) {
        if (!points || points.length === 0) return [];
        const MIN_DIST = 0.25;
        const result = [];
        for (const p of points) {
            const last = result[result.length - 1];
            if (!last) {
                result.push(p);
                continue;
            }

            const dx = p.x - last.x;
            const dy = p.y - last.y;
            if (Math.hypot(dx, dy) >= MIN_DIST) {
                result.push(p);
            }
        }
        return result;
    }

    /**
     * [指示書] 高速ストローク対策：異常な輪郭を検知する
     */
    _isOutlineSuspicious(outlinePoints, sourcePoints, size) {
        if (!outlinePoints || outlinePoints.length < 3) return false;
        
        const getBounds = (pts) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of pts) {
                const px = p.x ?? p[0];
                const py = p.y ?? p[1];
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        };

        const sourceBounds = getBounds(sourcePoints);
        const outlineBounds = getBounds(outlinePoints);
        const pad = Math.max(size * 3, 12);

        return (
            outlineBounds.x < sourceBounds.x - pad ||
            outlineBounds.y < sourceBounds.y - pad ||
            outlineBounds.x + outlineBounds.width > sourceBounds.x + sourceBounds.width + pad ||
            outlineBounds.y + outlineBounds.height > sourceBounds.y + sourceBounds.height + pad
        );
    }

    renderPreview(points, providedSettings = null, targetGraphics = null) {
        const graphics = targetGraphics || new Graphics();
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);

        if (points.length === 0) {
            return graphics;
        }

        graphics.clear();
        
        // 消しゴムの場合はプレビューを描画しない（リアルタイム焼き込みに移行したため）
        if (mode === 'eraser') {
            return graphics;
        }

        graphics.blendMode = 'normal';

        if (points.length === 1) {
            const p = points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            return graphics;
        }

        const filteredPoints = this._filterNearPoints(points);
        if (filteredPoints.length < 2) return graphics;

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = this._getFreehandOptions(settings.size);
        
        const outlinePoints = getStroke(inputPoints, options);
        if (outlinePoints.length < 2) return graphics;

        // [指示書] 異常輪郭検知
        if (this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック描画
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: settings.color, alpha: settings.opacity || 1.0, cap: 'round', join: 'round' });
        } else {
            graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
            graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
        }

        return graphics;
    }

    async renderFinalStroke(strokeData, settings) {
        const mode = settings?.mode || this.currentTool || 'pen';
        
        if (mode === 'eraser') {
            return this._renderEraserStroke(strokeData, settings);
        }
        
        // [指示書] Mesh経路を使わず Graphics.poly に統一
        return this._renderFinalStrokeGraphics(strokeData, settings, mode);
    }

    async _renderWithPerfectFreehand(strokeData, settings) {
        // [指示書] Mesh経路は使用しない方針のため、nullを返す
        return null;
    }

    _renderEraserStroke(strokeData, settings) {
        const filteredPoints = this._filterNearPoints(strokeData.points);
        const options = this._getFreehandOptions(settings.size);
        
        const graphics = new Graphics();
        graphics.blendMode = 'erase';

        if (strokeData.isSingleDot || filteredPoints.length === 1) {
            const p = filteredPoints[0] || strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            return graphics;
        }

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const outlinePoints = getStroke(inputPoints, options);
        
        if (!outlinePoints || outlinePoints.length < 2 || this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: 0xFFFFFF, alpha: 1.0, cap: 'round', join: 'round' });
            return graphics;
        }

        graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

        return graphics;
    }

    _renderFinalStrokeGraphics(strokeData, settings, mode) {
        const graphics = new Graphics();
        
        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        const filteredPoints = this._filterNearPoints(strokeData.points);
        if (strokeData.isSingleDot || filteredPoints.length === 1) {
            const p = filteredPoints[0] || strokeData.points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            
            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }
            return graphics;
        }

        const inputPoints = filteredPoints.map(p => [p.x, p.y, Math.max(p.pressure ?? 0.5, 0.02)]);
        const options = this._getFreehandOptions(settings.size);

        const outlinePoints = getStroke(inputPoints, options);
        
        if (!outlinePoints || outlinePoints.length < 2 || this._isOutlineSuspicious(outlinePoints, filteredPoints, settings.size)) {
            // 安全なフォールバック
            graphics.moveTo(filteredPoints[0].x, filteredPoints[0].y);
            for (let i = 1; i < filteredPoints.length; i++) {
                graphics.lineTo(filteredPoints[i].x, filteredPoints[i].y);
            }
            graphics.stroke({ width: settings.size, color: mode === 'eraser' ? 0xFFFFFF : settings.color, alpha: mode === 'eraser' ? 1.0 : settings.opacity || 1.0, cap: 'round', join: 'round' });
        } else {
            graphics.poly(outlinePoints.map(p => ({ x: p[0], y: p[1] })));
            
            if (mode === 'eraser') {
                graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            } else {
                graphics.fill({ color: settings.color, alpha: settings.opacity || 1.0 });
            }
        }

        return graphics;
    }

    renderDot(point, providedSettings = null, mode = 'pen', targetGraphics = null) {
        const graphics = targetGraphics || new Graphics();
        const settings = this._getSettings(providedSettings);
        const width = this.calculateWidth(point.pressure, settings.size);

        if (mode === 'eraser') {
            graphics.blendMode = 'erase';
        } else {
            graphics.blendMode = 'normal';
        }

        graphics.circle(point.x, point.y, width / 2);
        graphics.fill({ color: 0xFFFFFF, alpha: 1.0 });

        return graphics;
    }

    renderStroke(layer, strokeData, providedSettings = null) {
        const settings = this._getSettings(providedSettings);
        const mode = this._getCurrentMode(settings);
        
        let graphics;
        if (mode === 'eraser') {
            graphics = this._renderEraserStroke(strokeData, settings);
        } else {
            graphics = this._renderFinalStrokeGraphics(strokeData, settings, mode);
        }
        
        return {
            id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            graphics: graphics,
            points: strokeData.points,
            tool: mode,
            settings: { ...settings }
        };
    }

    updateResolution() {
        this.resolution = 1;
        this.minPhysicalWidth = 1 / this.resolution;
    }
}

// 下位互換性のためにグローバルに登録
window.StrokeRenderer = StrokeRenderer;
