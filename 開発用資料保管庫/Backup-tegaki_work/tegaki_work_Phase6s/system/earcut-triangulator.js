/**
 * ============================================================================
 * ファイル名: system/earcut-triangulator.js
 * 責務: 多角形の頂点配列を三角形インデックスに変換する（earcutのラッパー）
 * 依存: earcut
 * 被依存: system/drawing/webgl2/gl-stroke-processor.js
 * 公開API: EarcutTriangulator, earcutTriangulator
 * イベント発火: なし
 * イベント受信: なし
 * グローバル登録: window.EarcutTriangulator
 * 実装状態: ♻️移植
 * ============================================================================
 */

import earcut from 'earcut';

export class EarcutTriangulator {
    constructor() {
        this.earcutFn = earcut;
    }

    /**
     * 三角形分割実行
     * @param {Float32Array|Array} vertices - 頂点配列 [x0,y0, x1,y1, ...]
     * @param {Array|null} holes - ホール配列（穴あき多角形用）
     * @param {number} dimensions - 次元数（デフォルト: 2）
     * @returns {Uint32Array} 三角形インデックス配列
     */
    triangulate(vertices, holes = null, dimensions = 2) {
        if (!vertices || vertices.length < 6) {
            return new Uint32Array(0);
        }

        if (vertices.length % dimensions !== 0) {
            console.warn('[EarcutTriangulator] Vertex count does not match dimensions');
            return new Uint32Array(0);
        }

        try {
            const indicesArray = this.earcutFn(
                Array.isArray(vertices) ? vertices : Array.from(vertices),
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

export const earcutTriangulator = new EarcutTriangulator();

// 下位互換性のためにグローバルに登録
window.EarcutTriangulator = earcutTriangulator;
