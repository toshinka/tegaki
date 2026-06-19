/**
 * ================================================================================
 * system/drawing/earcut-triangulator.js
 * ================================================================================
 * 
 * 📁 親ファイル依存:
 *   - earcut (CDN: https://unpkg.com/earcut@2.2.4/dist/earcut.min.js)
 * 
 * 📄 子ファイル使用先:
 *   - gl-stroke-processor.js (triangulation呼び出し)
 * 
 * 【責務】
 * - Polygon頂点配列を三角形インデックスに変換
 * - Earcut.js の薄いラッパー
 * - 凹多角形対応
 * 
 * 【WebGPU→WebGL2移行対応】
 * - system/drawing/webgpu/ から system/drawing/ 直下に移動
 * - 両実装で共通利用
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

        _doInitialize() {
            if (this.initialized) return;

            if (typeof window.earcut !== 'function') {
                console.error('[EarcutTriangulator] earcut not loaded');
                this.initialized = false;
                return;
            }

            this.earcutFn = window.earcut;
            this.initialized = true;
        }

        triangulate(vertices, holes = null, dimensions = 2) {
            if (!this.initialized) {
                this._doInitialize();
            }

            if (!this.initialized || !this.earcutFn) {
                return this._createFallbackIndices(vertices, dimensions);
            }

            if (!vertices || vertices.length < 6) {
                return new Uint32Array(0);
            }

            if (vertices.length % 2 !== 0) {
                return new Uint32Array(0);
            }

            try {
                const indicesArray = this.earcutFn(
                    Array.from(vertices),
                    holes,
                    dimensions
                );

                if (!indicesArray || indicesArray.length === 0) {
                    return this._createFallbackIndices(vertices, dimensions);
                }

                return new Uint32Array(indicesArray);

            } catch (error) {
                console.error('[EarcutTriangulator] Triangulation failed:', error);
                return this._createFallbackIndices(vertices, dimensions);
            }
        }

        _createFallbackIndices(vertices, dimensions = 2) {
            const vertexCount = vertices.length / dimensions;
            
            if (vertexCount < 3) {
                return new Uint32Array(0);
            }

            const triangleCount = vertexCount - 2;
            const indices = new Uint32Array(triangleCount * 3);

            for (let i = 0; i < triangleCount; i++) {
                indices[i * 3 + 0] = 0;
                indices[i * 3 + 1] = i + 1;
                indices[i * 3 + 2] = i + 2;
            }

            return indices;
        }

        getTriangleCount(indices) {
            return indices.length / 3;
        }

        getVertexCount(vertices, dimensions = 2) {
            return vertices.length / dimensions;
        }
    }

    window.EarcutTriangulator = new EarcutTriangulator();

})();