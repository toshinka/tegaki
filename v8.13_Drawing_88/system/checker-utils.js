// ===== system/checker-utils.js - Phase 2完全版 =====
// チェッカーパターン生成ユーティリティ
// 背景レイヤー非表示時の透明表示用

(function() {
    'use strict';

    class CheckerUtils {
        constructor() {
            // Futaba配色: クリーム色と背景色
            this.color1 = 0xf0e0d6;  // --futaba-cream
            this.color2 = 0xffffee;  // --futaba-background
            this.squareSize = 16;    // 16x16pxチェッカー
        }

        /**
         * チェッカーパターンGraphicsを生成
         * @param {number} width - キャンバス幅
         * @param {number} height - キャンバス高さ
         * @param {number} squareSize - チェッカー正方形サイズ（オプション）
         * @returns {PIXI.Graphics}
         */
        createCheckerPattern(width, height, squareSize = this.squareSize) {
            const g = new PIXI.Graphics();
            
            for (let y = 0; y < height; y += squareSize) {
                for (let x = 0; x < width; x += squareSize) {
                    const isEvenX = Math.floor(x / squareSize) % 2 === 0;
                    const isEvenY = Math.floor(y / squareSize) % 2 === 0;
                    const color = (isEvenX === isEvenY) ? this.color1 : this.color2;
                    
                    g.rect(x, y, squareSize, squareSize);
                    g.fill({ color });
                }
            }
            
            g.label = 'checkerPattern';
            g.visible = false;  // デフォルトは非表示
            
            return g;
        }

        /**
         * 無限スクロール対応のチェッカーパターン（タイル型）
         * @param {number} width - 基本幅
         * @param {number} height - 基本高さ
         * @param {number} squareSize - チェッカー正方形サイズ
         * @returns {PIXI.TilingSprite}
         */
        createTilingCheckerPattern(width, height, squareSize = this.squareSize) {
            // 2x2のチェッカーパターンをテクスチャとして生成
            const tileSize = squareSize * 2;
            const canvas = document.createElement('canvas');
            canvas.width = tileSize;
            canvas.height = tileSize;
            const ctx = canvas.getContext('2d');
            
            // 色1をRGB変換
            const c1r = (this.color1 >> 16) & 0xFF;
            const c1g = (this.color1 >> 8) & 0xFF;
            const c1b = this.color1 & 0xFF;
            
            // 色2をRGB変換
            const c2r = (this.color2 >> 16) & 0xFF;
            const c2g = (this.color2 >> 8) & 0xFF;
            const c2b = this.color2 & 0xFF;
            
            // 左上と右下：色1
            ctx.fillStyle = `rgb(${c1r}, ${c1g}, ${c1b})`;
            ctx.fillRect(0, 0, squareSize, squareSize);
            ctx.fillRect(squareSize, squareSize, squareSize, squareSize);
            
            // 右上と左下：色2
            ctx.fillStyle = `rgb(${c2r}, ${c2g}, ${c2b})`;
            ctx.fillRect(squareSize, 0, squareSize, squareSize);
            ctx.fillRect(0, squareSize, squareSize, squareSize);
            
            const texture = PIXI.Texture.from(canvas);
            const tilingSprite = new PIXI.TilingSprite(texture, width, height);
            tilingSprite.label = 'checkerPatternTiling';
            tilingSprite.visible = false;
            
            return tilingSprite;
        }

        /**
         * カメラズームに依存しない固定サイズチェッカー
         * @param {number} width - キャンバス幅
         * @param {number} height - キャンバス高さ
         * @param {PIXI.Container} worldContainer - worldContainerへの参照
         * @returns {PIXI.Graphics}
         */
        createFixedSizeChecker(width, height, worldContainer) {
            const checker = this.createCheckerPattern(width, height);
            
            // worldContainerのスケール変更を監視して逆スケール適用
            if (worldContainer) {
                const updateScale = () => {
                    const worldScale = worldContainer.scale.x;
                    checker.scale.set(1 / worldScale);
                };
                
                // 初期スケール設定
                updateScale();
                
                // worldContainerのスケール変更を定期的にチェック
                // （本来はEventBus経由が望ましいが、シンプルに実装）
                setInterval(updateScale, 100);
            }
            
            return checker;
        }

        /**
         * 半無限キャンバス対応の大きなチェッカーパターン
         * @param {number} centerX - キャンバス中心X
         * @param {number} centerY - キャンバス中心Y
         * @param {number} size - パターンサイズ（デフォルト4096）
         * @returns {PIXI.Graphics}
         */
        createLargeCheckerPattern(centerX, centerY, size = 4096) {
            const halfSize = size / 2;
            const g = new PIXI.Graphics();
            
            // 中心基点で描画
            for (let y = -halfSize; y < halfSize; y += this.squareSize) {
                for (let x = -halfSize; x < halfSize; x += this.squareSize) {
                    const isEvenX = Math.floor(x / this.squareSize) % 2 === 0;
                    const isEvenY = Math.floor(y / this.squareSize) % 2 === 0;
                    const color = (isEvenX === isEvenY) ? this.color1 : this.color2;
                    
                    g.rect(centerX + x, centerY + y, this.squareSize, this.squareSize);
                    g.fill({ color });
                }
            }
            
            g.label = 'checkerPatternLarge';
            g.visible = false;
            
            return g;
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

        /**
         * 既存のチェッカーパターンをリサイズ
         * @param {PIXI.Graphics} checker - 既存のチェッカーGraphics
         * @param {number} newWidth - 新しい幅
         * @param {number} newHeight - 新しい高さ
         * @returns {PIXI.Graphics} - 新しいチェッカーGraphics
         */
        resizeCheckerPattern(checker, newWidth, newHeight) {
            const wasVisible = checker.visible;
            
            // 古いパターンを破棄
            if (checker.parent) {
                checker.parent.removeChild(checker);
            }
            checker.destroy();
            
            // 新しいパターンを生成
            const newChecker = this.createCheckerPattern(newWidth, newHeight);
            newChecker.visible = wasVisible;
            
            return newChecker;
        }
    }

    // グローバル公開
    window.CheckerUtils = CheckerUtils;

    // デフォルトインスタンス
    window.checkerUtils = new CheckerUtils();

})();

console.log('✅ system/checker-utils.js Phase 2完全版 loaded');