// ===== system/checker-utils.js - 統一チェッカーパターン実装 =====
// DRY原則: 単一のチェッカー生成ロジック
// カメラ枠内限定、ズーム依存なし固定サイズ

(function() {
    'use strict';

    class CheckerUtils {
        constructor() {
            // Futaba配色
            this.color1 = 0xf0e0d6;  // --futaba-cream
            this.color2 = 0xffffee;  // --futaba-background
            this.squareSize = 16;    // 16x16px固定（ズーム影響なし）
        }

        /**
         * キャンバス用チェッカーパターン（PIXI.Graphics）
         * カメラ枠内に限定、ズーム依存なし
         * @param {number} width - キャンバス幅
         * @param {number} height - キャンバス高さ
         * @returns {PIXI.Graphics}
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
            g.visible = false;  // デフォルトは非表示
            g.zIndex = -1000;   // 最背面
            
            return g;
        }

        /**
         * サムネイル用チェッカーパターン（Canvas要素）
         * レイヤーサムネイルとタイムラインサムネイルで共通使用
         * @param {number} width - サムネイル幅
         * @param {number} height - サムネイル高さ
         * @param {number} squareSize - チェッカーマス目サイズ（デフォルト8px）
         * @returns {HTMLCanvasElement}
         */
        createThumbnailCheckerCanvas(width, height, squareSize = 8) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) return canvas;

            // 16進数カラーをRGBに変換
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
         * @param {number} width - サムネイル幅
         * @param {number} height - サムネイル高さ
         * @param {number} squareSize - チェッカーマス目サイズ
         * @returns {string} DataURL
         */
        createThumbnailCheckerDataURL(width, height, squareSize = 8) {
            const canvas = this.createThumbnailCheckerCanvas(width, height, squareSize);
            return canvas.toDataURL();
        }

        /**
         * チェッカーパターンをリサイズ
         * @param {PIXI.Graphics} checker - 既存のチェッカー
         * @param {number} newWidth - 新しい幅
         * @param {number} newHeight - 新しい高さ
         * @returns {PIXI.Graphics}
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

        /**
         * 16進数カラーをrgb()文字列に変換
         * @param {number} hex - 0xRRGGBB形式
         * @returns {string} "rgb(r, g, b)"
         */
        _hexToRgb(hex) {
            const r = (hex >> 16) & 0xFF;
            const g = (hex >> 8) & 0xFF;
            const b = hex & 0xFF;
            return `rgb(${r}, ${g}, ${b})`;
        }

        /**
         * 配色設定
         * @param {number} color1 - チェッカー色1（16進数）
         * @param {number} color2 - チェッカー色2（16進数）
         */
        setColors(color1, color2) {
            this.color1 = color1;
            this.color2 = color2;
        }

        /**
         * チェッカーサイズ設定
         * @param {number} size - 正方形サイズ（px）
         */
        setSquareSize(size) {
            this.squareSize = size;
        }
    }

    // グローバル公開
    window.CheckerUtils = CheckerUtils;

    // デフォルトインスタンス
    window.checkerUtils = new CheckerUtils();

})();

console.log('✅ system/checker-utils.js 統一実装版 loaded');