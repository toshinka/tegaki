// ===== system/ui/checker-utils.js - チェックパターン共通ユーティリティ =====
// 責務: 透明背景チェックパターンの一元生成（PIXI.Texture）
// 用途: サムネイル・キャンバス背景・エクスポートプレビュー等で共通使用
// カラー: futabaテーマ (--futaba-cream / --futaba-background) 対応

(function(window) {
    'use strict';

    class CheckerUtils {
        constructor() {
            this.cache = new Map();
            this.defaultColors = {
                colorA: '#f0e0d6', // --futaba-cream
                colorB: '#ffffee'  // --futaba-background
            };
        }

        /**
         * チェックパターンテクスチャ生成
         * @param {Object} options
         * @param {number} options.tilePx - タイルサイズ（px）
         * @param {string} options.colorA - カラーA（デフォルト: futaba-cream）
         * @param {string} options.colorB - カラーB（デフォルト: futaba-background）
         * @param {number} options.density - 密度倍率（デフォルト: 1）
         * @param {number} options.devicePixelRatio - DPI倍率（デフォルト: window.devicePixelRatio）
         * @returns {PIXI.Texture}
         */
        createCheckerTexture(options = {}) {
            const {
                tilePx = 16,
                colorA = this.defaultColors.colorA,
                colorB = this.defaultColors.colorB,
                density = 1,
                devicePixelRatio = window.devicePixelRatio || 1
            } = options;

            // キャッシュキー生成
            const cacheKey = `${tilePx}_${colorA}_${colorB}_${density}_${devicePixelRatio}`;
            
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // タイルサイズ計算（DPI対応）
            const scale = Math.max(1, devicePixelRatio);
            const tile = Math.max(1, Math.round(tilePx * scale / density));

            // Canvas生成
            const canvas = document.createElement('canvas');
            canvas.width = tile * 2;
            canvas.height = tile * 2;
            const ctx = canvas.getContext('2d', { alpha: true });

            // チェック柄描画
            ctx.fillStyle = colorA;
            ctx.fillRect(0, 0, tile, tile);
            ctx.fillRect(tile, tile, tile, tile);

            ctx.fillStyle = colorB;
            ctx.fillRect(tile, 0, tile, tile);
            ctx.fillRect(0, tile, tile, tile);

            // アンチエイリアス無効化（シャープなタイル）
            ctx.imageSmoothingEnabled = false;

            // PIXI.Texture生成
            const baseTexture = PIXI.BaseTexture.from(canvas, {
                scaleMode: PIXI.SCALE_MODES.NEAREST // ピクセル補間なし
            });
            const texture = new PIXI.Texture(baseTexture);

            // キャッシュ保存
            this.cache.set(cacheKey, texture);

            return texture;
        }

        /**
         * Canvas2D用チェックパターン生成（PIXI非依存）
         * @param {number} width - キャンバス幅
         * @param {number} height - キャンバス高さ
         * @param {Object} options
         * @returns {HTMLCanvasElement}
         */
        createCheckerCanvas(width, height, options = {}) {
            const {
                tilePx = 8,
                colorA = this.defaultColors.colorA,
                colorB = this.defaultColors.colorB
            } = options;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // タイル描画
            for (let y = 0; y < height; y += tilePx) {
                for (let x = 0; x < width; x += tilePx) {
                    const isEvenX = Math.floor(x / tilePx) % 2 === 0;
                    const isEvenY = Math.floor(y / tilePx) % 2 === 0;
                    ctx.fillStyle = (isEvenX === isEvenY) ? colorA : colorB;
                    ctx.fillRect(x, y, tilePx, tilePx);
                }
            }

            return canvas;
        }

        /**
         * CSS変数から色を取得
         * @returns {Object} {colorA, colorB}
         */
        getColorsFromCSS() {
            const root = document.documentElement;
            const computedStyle = getComputedStyle(root);
            
            return {
                colorA: computedStyle.getPropertyValue('--futaba-cream').trim() || this.defaultColors.colorA,
                colorB: computedStyle.getPropertyValue('--futaba-background').trim() || this.defaultColors.colorB
            };
        }

        /**
         * キャッシュクリア
         */
        clearCache() {
            this.cache.forEach(texture => {
                try {
                    if (texture && texture.baseTexture) {
                        texture.baseTexture.destroy();
                    }
                } catch (e) {
                    // 既に破棄済み
                }
            });
            this.cache.clear();
        }

        /**
         * テーマ変更時の一括更新
         * @param {Object} newColors
         */
        updateTheme(newColors) {
            if (newColors.colorA) this.defaultColors.colorA = newColors.colorA;
            if (newColors.colorB) this.defaultColors.colorB = newColors.colorB;
            this.clearCache();
        }
    }

    // グローバル登録
    window.CheckerUtils = new CheckerUtils();

    console.log('✅ system/ui/checker-utils.js loaded');

})(window);