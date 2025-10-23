/**
 * StrokeRenderer - ストローク描画専用クラス (Phase 1: 筆圧リアルタイム対応版)
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * 修正: プレビュー・確定描画の筆圧計算を統一
 * 
 * 描画方式:
 * - プレビュー: 筆圧対応Graphics
 * - 確定描画: 筆圧対応Graphics（同じ計算式）
 */

class StrokeRenderer {
    constructor(app) {
        this.app = app;
        this.resolution = window.devicePixelRatio || 1;
        this.minPhysicalWidth = 1 / this.resolution;
    }

    /**
     * 幅計算（プレビュー・確定共通）
     */
    calculateWidth(pressure, brushSize) {
        // pressure: 0.0 ~ 1.0
        // 0.0でも最低30%の太さを保証（minPhysicalWidth対応）
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

        // 単独点の場合は円
        if (points.length === 1) {
            const p = points[0];
            const width = this.calculateWidth(p.pressure, settings.size);
            graphics.circle(p.x, p.y, width / 2);
            graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
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
            graphics.stroke({
                width: avgWidth,
                color: settings.color,
                alpha: settings.alpha || 1.0,
                cap: 'round',
                join: 'round'
            });
        }

        return graphics;
    }

    /**
     * 確定ストローク描画（筆圧反映版・プレビュー同一）
     * @param {Object} strokeData - {points, isSingleDot}
     * @param {Object} settings - {color, size, alpha}
     * @returns {PIXI.Graphics}
     */
    renderFinalStroke(strokeData, settings) {
        // 単独点は円描画
        if (strokeData.isSingleDot) {
            return this.renderDot(strokeData.points[0], settings);
        }

        // 複数点の場合は同じ計算式でレンダリング
        return this.renderPreview(strokeData.points, settings);
    }

    /**
     * 単独点描画（円）
     */
    renderDot(point, settings) {
        const graphics = new PIXI.Graphics();
        const width = this.calculateWidth(point.pressure, settings.size);

        graphics.circle(point.x, point.y, width / 2);
        graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });

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