/**
 * ============================================================================
 * ファイル名: system/drawing/freehand-stroke.js
 * 責務: perfect-freehand を使用したポイント列から輪郭ポリゴンへの変換と描画
 * 依存: perfect-freehand, pixi.js
 * 被依存: system/drawing/drawing-engine.js
 * 公開API: FreehandStroke (Class)
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.FreehandStroke (暫定的に登録)
 * 実装状態: 🆕新規
 * ============================================================================
 */

import { getStroke } from 'perfect-freehand';
import * as PIXI from 'pixi.js';

export class FreehandStroke {
    /**
     * @param {Object} options 
     * @param {number} options.size 
     * @param {number} options.thinning 
     * @param {number} options.smoothing 
     * @param {number} options.streamline 
     * @param {string} options.strokeType - 'pen' | 'eraser'
     */
    constructor(options = {}) {
        this.options = {
            size: options.size || 16,
            thinning: options.thinning || 0.5,
            smoothing: options.smoothing || 0.5,
            streamline: options.streamline || 0.5,
            easing: (t) => t,
            simulatePressure: false,
            last: true,
            ...options
        };
        
        this.strokeType = options.strokeType || 'pen';
    }

    /**
     * ポイント列からポリゴンデータを生成する
     * @param {Array} points - [{x, y, pressure}, ...]
     * @returns {Array} 輪郭ポイントの配列
     */
    generateOutline(points) {
        if (points.length === 0) return [];
        
        // perfect-freehand 形式に変換 [x, y, pressure]
        const strokePoints = points.map(p => [p.x, p.y, p.pressure || 0.5]);
        
        const outline = getStroke(strokePoints, this.options);
        return outline.map(p => ({ x: p[0], y: p[1] }));
    }

    /**
     * PixiJS Graphics に描画する
     * @param {PIXI.Graphics} graphics 
     * @param {Array} points 
     * @param {string} color - CSS color string
     * @param {number} alpha - 0.0 to 1.0
     */
    draw(graphics, points, color = '#000000', alpha = 1.0) {
        // [ [x,y], [x,y], ... ] を [x, y, x, y, ...] に変換
        const strokePoints = points.map(p => [p.x, p.y, p.pressure || 0.5]);
        const outline = getStroke(strokePoints, this.options);
        
        if (outline.length < 3) return;

        const flatOutline = outline.flat();

        graphics.clear();
        
        if (this.strokeType === 'eraser') {
            graphics.blendMode = 'erase';
            graphics.poly(flatOutline).fill({ color: 0xFFFFFF, alpha: alpha });
        } else {
            graphics.blendMode = 'normal';
            graphics.poly(flatOutline).fill({ color: PIXI.Color.shared.setValue(color).toNumber(), alpha: alpha });
        }
    }
}

// 暫定的にグローバルに登録（既存の非ESMコードからの移行を容易にするため）
window.FreehandStroke = FreehandStroke;
