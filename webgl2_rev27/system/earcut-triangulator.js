/**
 * ================================================================================
 * system/earcut-triangulator.js - Phase 2.0
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - earcut (CDN: https://unpkg.com/earcut@2.2.4/dist/earcut.min.js)
 * 
 * 📄 子ファイル使用先:
 *   - system/drawing/webgl2/gl-stroke-processor.js (triangulation呼び出し)
 * 
 * 【責務】
 * - Polygon頂点配列を三角形インデックスに変換
 * - Earcut.js の薄いラッパー
 * - 凹多角形対応
 * 
 * 【Phase 2.0 改修】
 * - system/drawing/webgpu/ から system/ 直下に移動
 * - WebGL2/WebGPU両対応の共通モジュール化
 * - コンソールログクリーンアップ
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
         * @private
         */
        _doInitialize() {
            if (this.initialized) return;

            if (typeof window.earcut !== 'function') {
                console.error('[EarcutTriangulator] earcut not loaded - Please add CDN: https://unpkg.com/earcut@2.2.4/dist/earcut.min.js');
                this.initialized = false;
                return;
            }

            this.earcutFn = window.earcut;
            this.initialized = true;
        }

        /**
         * 三角形分割実行
         * @param {Float32Array|Array} vertices - 頂点配列 [x0,y0, x1,y1, ...]
         * @param {Array|null} holes - ホール配列（穴あき多角形用）
         * @param {number} dimensions - 次元数（デフォルト: 2）
         * @returns {Uint32Array} 三角形インデックス配列
         */
        triangulate(vertices, holes = null, dimensions = 2) {
            if (!this.initialized) {
                this._doInitialize();
            }

            // Earcut未ロードの場合はFallback
            if (!this.initialized || !this.earcutFn) {
                return this._createFallbackIndices(vertices, dimensions);
            }

            // 頂点数チェック
            if (!vertices || vertices.length < 6) {
                return new Uint32Array(0);
            }

            // 偶数チェック（2D座標なので）
            if (vertices.length % 2 !== 0) {
                console.warn('[EarcutTriangulator] Odd vertex count, skipping last point');
                return new Uint32Array(0);
            }

            try {
                // Earcut実行
                const indicesArray = this.earcutFn(
                    Array.from(vertices),
                    holes,
                    dimensions
                );

                if (!indicesArray || indicesArray.length === 0) {
                    console.warn('[EarcutTriangulator] Earcut returned empty indices, using fallback');
                    return this._createFallbackIndices(vertices, dimensions);
                }

                return new Uint32Array(indicesArray);

            } catch (error) {
                console.error('[EarcutTriangulator] Triangulation failed:', error);
                return this._createFallbackIndices(vertices, dimensions);
            }
        }

        /**
         * Fallback: ファン三角形分割（凸多角形のみ対応）
         * @private
         */
        _createFallbackIndices(vertices, dimensions = 2) {
            const vertexCount = vertices.length / dimensions;
            
            if (vertexCount < 3) {
                return new Uint32Array(0);
            }

            // ファン三角形分割: 全ての三角形が頂点0を共有
            const triangleCount = vertexCount - 2;
            const indices = new Uint32Array(triangleCount * 3);

            for (let i = 0; i < triangleCount; i++) {
                indices[i * 3 + 0] = 0;
                indices[i * 3 + 1] = i + 1;
                indices[i * 3 + 2] = i + 2;
            }

            return indices;
        }

        /**
         * 三角形数取得
         */
        getTriangleCount(indices) {
            return indices.length / 3;
        }

        /**
         * 頂点数取得
         */
        getVertexCount(vertices, dimensions = 2) {
            return vertices.length / dimensions;
        }

        /**
         * 初期化状態確認
         */
        isInitialized() {
            return this.initialized;
        }
    }

    // Singleton登録
    window.EarcutTriangulator = new EarcutTriangulator();

    console.log('✅ earcut-triangulator.js Phase 2.0 loaded');

})();