/**
 * ================================================================================
 * system/drawing/webgpu/earcut-triangulator.js
 * ================================================================================
 * 
 * 【責務】
 * - Polygon頂点配列を三角形インデックスに変換
 * - Earcut.js の薄いラッパー
 * - 凹多角形対応
 * 
 * 【依存Parents】
 * - earcut (CDN: https://unpkg.com/earcut@2.2.4/dist/earcut.min.js)
 * 
 * 【依存Children】
 * - webgpu-geometry-layer.js (triangulation呼び出し)
 * 
 * 【使用例】
 * const vertices = new Float32Array([0,0, 100,0, 100,100, 0,100]);
 * const indices = window.EarcutTriangulator.triangulate(vertices);
 * // → Uint32Array([0,1,2, 0,2,3])
 * 
 * ================================================================================
 */

(function() {
    'use strict';

    class EarcutTriangulator {
        constructor() {
            this.initialized = false;
            this.earcutFn = null;
        }

        /**
         * 初期化（遅延実行）
         */
        _doInitialize() {
            if (this.initialized) return;

            // Earcut読み込み確認
            if (typeof window.earcut !== 'function') {
                console.error('❌ [EarcutTriangulator] earcut not loaded');
                console.error('   Add to index.html: <script src="https://unpkg.com/earcut@2.2.4/dist/earcut.min.js"></script>');
                this.initialized = false;
                return;
            }

            this.earcutFn = window.earcut;
            this.initialized = true;

            console.log('✅ [EarcutTriangulator] Initialized');
        }

        /**
         * Polygon頂点配列を三角形インデックスに変換
         * 
         * @param {Float32Array} vertices - [x1,y1, x2,y2, x3,y3, ...]
         * @param {Array} holes - 穴の開始インデックス（オプション）
         * @param {number} dimensions - 次元数（デフォルト: 2）
         * @returns {Uint32Array} 三角形インデックス [i1,i2,i3, ...]
         */
        triangulate(vertices, holes = null, dimensions = 2) {
            if (!this.initialized) {
                this._doInitialize();
            }

            if (!this.initialized || !this.earcutFn) {
                console.error('❌ [EarcutTriangulator] Not initialized');
                return this._createFallbackIndices(vertices, dimensions);
            }

            // 入力検証
            if (!vertices || vertices.length < 6) {
                console.warn('⚠️ [EarcutTriangulator] Not enough vertices (minimum 3 points)');
                return new Uint32Array(0);
            }

            if (vertices.length % 2 !== 0) {
                console.warn('⚠️ [EarcutTriangulator] Invalid vertex count (must be even)');
                return new Uint32Array(0);
            }

            try {
                // Earcut呼び出し
                // earcut(vertices, holes, dimensions) → Array of indices
                const indicesArray = this.earcutFn(
                    Array.from(vertices),
                    holes,
                    dimensions
                );

                if (!indicesArray || indicesArray.length === 0) {
                    console.warn('⚠️ [EarcutTriangulator] Earcut returned empty result');
                    return this._createFallbackIndices(vertices, dimensions);
                }

                // Uint32Arrayに変換
                return new Uint32Array(indicesArray);

            } catch (error) {
                console.error('❌ [EarcutTriangulator] Triangulation failed:', error);
                return this._createFallbackIndices(vertices, dimensions);
            }
        }

        /**
         * フォールバック: 単純なファン三角形分割（凸多角形のみ）
         */
        _createFallbackIndices(vertices, dimensions = 2) {
            const vertexCount = vertices.length / dimensions;
            
            if (vertexCount < 3) {
                return new Uint32Array(0);
            }

            // Fan triangulation: 0-1-2, 0-2-3, 0-3-4, ...
            const triangleCount = vertexCount - 2;
            const indices = new Uint32Array(triangleCount * 3);

            for (let i = 0; i < triangleCount; i++) {
                indices[i * 3 + 0] = 0;
                indices[i * 3 + 1] = i + 1;
                indices[i * 3 + 2] = i + 2;
            }

            console.warn('⚠️ [EarcutTriangulator] Using fallback fan triangulation');
            return indices;
        }

        /**
         * 三角形数の計算
         */
        getTriangleCount(indices) {
            return indices.length / 3;
        }

        /**
         * 頂点数の計算
         */
        getVertexCount(vertices, dimensions = 2) {
            return vertices.length / dimensions;
        }
    }

    // グローバル公開
    window.EarcutTriangulator = new EarcutTriangulator();

    console.log('✅ earcut-triangulator.js loaded');

})();