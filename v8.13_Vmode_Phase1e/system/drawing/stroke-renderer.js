/**
 * StrokeRenderer - ストローク描画専用クラス
 * 
 * 責務: ストロークデータ → PIXI描画オブジェクト変換
 * 
 * 描画方式:
 * - プレビュー: Graphics.lineStyle() （高速・軽量）
 * - 確定描画: Graphics + 筆圧反映曲線 （高品質）
 * 
 * 外部依存: なし（PixiJS標準機能のみ使用）
 */

class StrokeRenderer {
    constructor(app) {
        this.app = app;
        this.resolution = window.devicePixelRatio || 1;
        this.minPhysicalWidth = 1 / this.resolution;
    }

    /**
     * リアルタイムプレビュー描画（軽量Graphics）
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
            const radius = Math.max(this.minPhysicalWidth, settings.size * Math.max(0.3, p.pressure) / 2);
            graphics.circle(p.x, p.y, radius);
            graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });
            return graphics;
        }

        // 複数点の場合は線
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.stroke({
            width: settings.size,
            color: settings.color,
            alpha: settings.alpha || 1.0,
            cap: 'round',
            join: 'round'
        });

        return graphics;
    }

    /**
     * 確定ストローク描画（筆圧反映版）
     * @param {Object} strokeData - {points, isSingleDot}
     * @param {Object} settings - {color, size, alpha}
     * @returns {PIXI.Graphics}
     */
    renderFinalStroke(strokeData, settings) {
        // 単独点は円描画
        if (strokeData.isSingleDot) {
            return this.renderDot(strokeData.points[0], settings);
        }

        // 筆圧対応曲線描画
        return this.renderPressureCurve(strokeData.points, settings);
    }

    /**
     * 単独点描画（円）
     */
    renderDot(point, settings) {
        const graphics = new PIXI.Graphics();
        const pressure = Math.max(0.3, point.pressure); // 最低30%の太さを保証
        const radius = Math.max(this.minPhysicalWidth, settings.size * pressure / 2);

        graphics.circle(point.x, point.y, radius);
        graphics.fill({ color: settings.color, alpha: settings.alpha || 1.0 });

        return graphics;
    }

    /**
     * 筆圧対応曲線描画
     */
    renderPressureCurve(points, settings) {
        const graphics = new PIXI.Graphics();

        if (points.length < 2) {
            return this.renderDot(points[0], settings);
        }

        // 筆圧ベースの幅計算
        const widths = points.map(p => {
            const pressure = Math.max(0.3, p.pressure); // 最低30%
            return settings.size * pressure;
        });

        // 線分ごとに太さを反映した描画
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const w1 = widths[i];
            const w2 = widths[i + 1];

            // 線分の平均幅で描画
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
     * 解像度更新
     */
    updateResolution() {
        this.resolution = window.devicePixelRatio || 1;
        this.minPhysicalWidth = 1 / this.resolution;
    }
}