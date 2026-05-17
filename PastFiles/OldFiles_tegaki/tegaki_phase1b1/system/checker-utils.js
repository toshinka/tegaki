/**
 * ============================================================================
 * ファイル名: system/checker-utils.js
 * 責務: キャンバス背景やサムネイル用のチェッカーパターンを生成する
 * 依存: pixi.js
 * 被依存: layer-system.js等
 * 公開API: CheckerUtils, checkerUtils
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.CheckerUtils, window.checkerUtils
 * 実装状態: ♻️移植
 * ============================================================================
 */

import * as PIXI from 'pixi.js';

export class CheckerUtils {
    constructor() {
        this.color1 = 0xf0e0d6;  // --futaba-cream
        this.color2 = 0xffffee;  // --futaba-background
        this.squareSize = 16;    // 16x16px固定
    }

    /**
     * キャンバス用チェッカーパターン（PIXI.Graphics）
     */
    createCanvasChecker(width, height) {
        const g = new PIXI.Graphics();
        
        const cols = Math.ceil(width / this.squareSize);
        const rows = Math.ceil(height / this.squareSize);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * this.squareSize;
                const y = row * this.squareSize;
                const isEvenCol = col % 2 === 0;
                const isEvenRow = row % 2 === 0;
                const color = (isEvenCol === isEvenRow) ? this.color1 : this.color2;
                
                g.rect(x, y, this.squareSize, this.squareSize);
                g.fill({ color });
            }
        }
        
        g.label = 'checkerPattern';
        g.visible = false;
        g.zIndex = -1000;
        
        return g;
    }

    /**
     * サムネイル用チェッカーパターン（Canvas要素）
     */
    createThumbnailCheckerCanvas(width, height, squareSize = 8) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return canvas;

        const color1RGB = this._hexToRgb(this.color1);
        const color2RGB = this._hexToRgb(this.color2);

        const cols = Math.ceil(width / squareSize);
        const rows = Math.ceil(height / squareSize);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const isEvenCol = col % 2 === 0;
                const isEvenRow = row % 2 === 0;
                ctx.fillStyle = (isEvenCol === isEvenRow) ? color1RGB : color2RGB;
                ctx.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
            }
        }

        return canvas;
    }

    /**
     * サムネイル用チェッカーDataURL取得
     */
    createThumbnailCheckerDataURL(width, height, squareSize = 8) {
        const canvas = this.createThumbnailCheckerCanvas(width, height, squareSize);
        return canvas.toDataURL();
    }

    /**
     * チェッカーパターンをリサイズ
     */
    resizeCanvasChecker(checker, newWidth, newHeight) {
        const wasVisible = checker.visible;
        const parent = checker.parent;
        const zIndex = checker.zIndex;
        
        if (parent) {
            parent.removeChild(checker);
        }
        checker.destroy();
        
        const newChecker = this.createCanvasChecker(newWidth, newHeight);
        newChecker.visible = wasVisible;
        newChecker.zIndex = zIndex;
        
        if (parent) {
            parent.addChildAt(newChecker, 0);
        }
        
        return newChecker;
    }

    _hexToRgb(hex) {
        const r = (hex >> 16) & 0xFF;
        const g = (hex >> 8) & 0xFF;
        const b = hex & 0xFF;
        return `rgb(${r}, ${g}, ${b})`;
    }

    setColors(color1, color2) {
        this.color1 = color1;
        this.color2 = color2;
    }

    setSquareSize(size) {
        this.squareSize = size;
    }
}

export const checkerUtils = new CheckerUtils();

// 下位互換性のためにグローバルに登録
window.CheckerUtils = CheckerUtils;
window.checkerUtils = checkerUtils;
