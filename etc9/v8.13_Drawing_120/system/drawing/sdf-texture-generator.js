// ===== system/drawing/sdf-texture-generator.js - Phase 3-A: SDF Texture Generator =====
// SDF（Signed Distance Field）テクスチャ生成器
// ブラシ形状の距離場を事前計算

(function() {
    'use strict';

    /**
     * SDFTextureGenerator - SDF距離場テクスチャ生成
     */
    class SDFTextureGenerator {
        constructor(renderer) {
            this.renderer = renderer;
            this.cache = new Map();
        }

        /**
         * 円形ブラシのSDFテクスチャを生成
         * @param {number} size - テクスチャサイズ（推奨: 64, 128, 256）
         * @param {number} radius - ブラシ半径（0.0-1.0, テクスチャサイズに対する割合）
         * @returns {PIXI.Texture}
         */
        generateCircleSDF(size = 128, radius = 0.45) {
            const cacheKey = `circle_${size}_${radius.toFixed(3)}`;
            
            // キャッシュチェック
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Canvas2Dで距離場を計算
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const imageData = ctx.createImageData(size, size);
            const data = imageData.data;

            const centerX = size / 2;
            const centerY = size / 2;
            const maxDistance = Math.sqrt(2) * size / 2; // 対角線距離

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // 正規化された距離（0.0-1.0）
                    // radius以内は1.0、外側は0.0に向かって減衰
                    const normalizedRadius = radius * size / 2;
                    let sdfValue;

                    if (distance <= normalizedRadius) {
                        // 内側: 中心から距離に応じて1.0 → threshold
                        sdfValue = 1.0 - (distance / normalizedRadius) * 0.5;
                    } else {
                        // 外側: threshold → 0.0に減衰
                        const outerDistance = distance - normalizedRadius;
                        const falloff = maxDistance - normalizedRadius;
                        sdfValue = Math.max(0.0, 0.5 - (outerDistance / falloff) * 0.5);
                    }

                    // RGBAに格納（Rチャンネルのみ使用）
                    const idx = (y * size + x) * 4;
                    const value = Math.floor(sdfValue * 255);
                    data[idx] = value;     // R
                    data[idx + 1] = value; // G
                    data[idx + 2] = value; // B
                    data[idx + 3] = 255;   // A
                }
            }

            ctx.putImageData(imageData, 0, 0);

            // PixiJSテクスチャに変換
            const texture = PIXI.Texture.from(canvas);
            
            // キャッシュに保存
            this.cache.set(cacheKey, texture);

            console.log(`✓ SDF texture generated: ${cacheKey}`);
            return texture;
        }

        /**
         * ソフト円形ブラシのSDFテクスチャを生成
         * @param {number} size - テクスチャサイズ
         * @param {number} hardness - 硬さ（0.0-1.0）
         * @returns {PIXI.Texture}
         */
        generateSoftCircleSDF(size = 128, hardness = 0.5) {
            const cacheKey = `soft_circle_${size}_${hardness.toFixed(3)}`;
            
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const imageData = ctx.createImageData(size, size);
            const data = imageData.data;

            const centerX = size / 2;
            const centerY = size / 2;
            const maxRadius = size / 2;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const normalizedDistance = distance / maxRadius;

                    // hardnessに基づくフォールオフ曲線
                    let sdfValue;
                    if (normalizedDistance < hardness) {
                        // ハード領域: 完全な不透明
                        sdfValue = 1.0;
                    } else {
                        // ソフト領域: スムーズにフェードアウト
                        const softDistance = (normalizedDistance - hardness) / (1.0 - hardness);
                        sdfValue = 1.0 - smoothstep(0.0, 1.0, softDistance);
                    }

                    const idx = (y * size + x) * 4;
                    const value = Math.floor(sdfValue * 255);
                    data[idx] = value;
                    data[idx + 1] = value;
                    data[idx + 2] = value;
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            const texture = PIXI.Texture.from(canvas);
            this.cache.set(cacheKey, texture);

            console.log(`✓ Soft SDF texture generated: ${cacheKey}`);
            return texture;
        }

        /**
         * 楕円ブラシのSDFテクスチャを生成
         * @param {number} size - テクスチャサイズ
         * @param {number} aspectRatio - アスペクト比（幅/高さ）
         * @returns {PIXI.Texture}
         */
        generateEllipseSDF(size = 128, aspectRatio = 1.5) {
            const cacheKey = `ellipse_${size}_${aspectRatio.toFixed(3)}`;
            
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            const imageData = ctx.createImageData(size, size);
            const data = imageData.data;

            const centerX = size / 2;
            const centerY = size / 2;
            const radiusX = (size / 2) * aspectRatio;
            const radiusY = size / 2;
            const maxDistance = Math.max(radiusX, radiusY);

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = (x - centerX) / radiusX;
                    const dy = (y - centerY) / radiusY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    let sdfValue;
                    if (distance <= 1.0) {
                        sdfValue = 1.0 - distance * 0.5;
                    } else {
                        sdfValue = Math.max(0.0, 0.5 - (distance - 1.0) * 0.5);
                    }

                    const idx = (y * size + x) * 4;
                    const value = Math.floor(sdfValue * 255);
                    data[idx] = value;
                    data[idx + 1] = value;
                    data[idx + 2] = value;
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            const texture = PIXI.Texture.from(canvas);
            this.cache.set(cacheKey, texture);

            console.log(`✓ Ellipse SDF texture generated: ${cacheKey}`);
            return texture;
        }

        /**
         * デフォルトブラシセットを生成
         * @returns {Object} ブラシテクスチャのセット
         */
        generateDefaultBrushSet() {
            return {
                circle: this.generateCircleSDF(128, 0.45),
                softCircle: this.generateSoftCircleSDF(128, 0.5),
                hardCircle: this.generateSoftCircleSDF(128, 0.8),
                ellipse: this.generateEllipseSDF(128, 1.5)
            };
        }

        /**
         * キャッシュクリア
         */
        clearCache() {
            for (const [key, texture] of this.cache.entries()) {
                if (texture && texture.destroy) {
                    texture.destroy(true);
                }
            }
            this.cache.clear();
            console.log('✓ SDF texture cache cleared');
        }

        /**
         * キャッシュサイズ取得
         * @returns {number}
         */
        getCacheSize() {
            return this.cache.size;
        }
    }

    /**
     * smoothstep関数（GLSL互換）
     * @param {number} edge0 - 下限
     * @param {number} edge1 - 上限
     * @param {number} x - 入力値
     * @returns {number} 0.0-1.0
     */
    function smoothstep(edge0, edge1, x) {
        const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
        return t * t * (3.0 - 2.0 * t);
    }

    // グローバル公開
    window.SDFTextureGenerator = SDFTextureGenerator;

    console.log('✅ sdf-texture-generator.js (Phase 3-A) loaded');
    console.log('   ✓ Circle SDF generation');
    console.log('   ✓ Soft/Hard brush variations');
    console.log('   ✓ Ellipse SDF generation');
    console.log('   ✓ Texture caching system');
})();