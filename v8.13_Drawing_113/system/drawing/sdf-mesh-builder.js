// ===== system/drawing/sdf-mesh-builder.js - Phase 3-B: SDF Mesh Builder =====
// SDFテクスチャを使用したMeshストローク生成
// カスタムシェーダー適用による高品質描画

(function() {
    'use strict';

    /**
     * SDFMeshBuilder - SDFブラシのMesh生成
     */
    class SDFMeshBuilder {
        constructor(app) {
            this.app = app;
        }

        /**
         * 2点間にSDFブラシMeshを生成
         * @param {Object} p1 - 開始点 {x, y, pressure}
         * @param {Object} p2 - 終了点 {x, y, pressure}
         * @param {PIXI.Texture} brushTexture - SDFブラシテクスチャ
         * @param {number} baseSize - 基本サイズ
         * @param {PIXI.Shader} shader - カスタムシェーダー
         * @param {number} color - 色（0xRRGGBB）
         * @param {number} alpha - 不透明度（0.0-1.0）
         * @returns {PIXI.Mesh}
         */
        createSegmentMesh(p1, p2, brushTexture, baseSize, shader, color, alpha) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 筆圧に応じたサイズ
            const size1 = baseSize * (p1.pressure || 0.5);
            const size2 = baseSize * (p2.pressure || 0.5);
            const avgSize = (size1 + size2) / 2;

            // Quad Mesh生成
            const vertices = new Float32Array([
                // x, y
                p1.x - size1 * Math.sin(angle), p1.y + size1 * Math.cos(angle), // 左上
                p1.x + size1 * Math.sin(angle), p1.y - size1 * Math.cos(angle), // 右上
                p2.x + size2 * Math.sin(angle), p2.y - size2 * Math.cos(angle), // 右下
                p2.x - size2 * Math.sin(angle), p2.y + size2 * Math.cos(angle)  // 左下
            ]);

            // UV座標
            const uvs = new Float32Array([
                0, 0,  // 左上
                1, 0,  // 右上
                1, 1,  // 右下
                0, 1   // 左下
            ]);

            // インデックス（2つの三角形）
            const indices = new Uint16Array([
                0, 1, 2,  // 上三角形
                0, 2, 3   // 下三角形
            ]);

            // Geometry作成
            const geometry = new PIXI.Geometry()
                .addAttribute('aVertexPosition', vertices, 2)
                .addAttribute('aTextureCoord', uvs, 2)
                .addIndex(indices);

            // Mesh作成
            const mesh = new PIXI.Mesh({
                geometry: geometry,
                texture: brushTexture,
                shader: shader
            });

            // 色設定（シェーダーに渡す）
            mesh.tint = color;
            mesh.alpha = alpha;

            return mesh;
        }

        /**
         * ストローク全体のMeshコンテナを生成
         * @param {Array} points - ストロークポイント配列
         * @param {PIXI.Texture} brushTexture - SDFブラシテクスチャ
         * @param {number} baseSize - 基本サイズ
         * @param {PIXI.Shader} shader - カスタムシェーダー
         * @param {number} color - 色
         * @param {number} alpha - 不透明度
         * @returns {PIXI.Container}
         */
        createStrokeMeshContainer(points, brushTexture, baseSize, shader, color, alpha) {
            const container = new PIXI.Container();

            if (points.length < 2) {
                // 単独点の場合
                if (points.length === 1) {
                    const dotMesh = this.createDotMesh(
                        points[0],
                        brushTexture,
                        baseSize,
                        shader,
                        color,
                        alpha
                    );
                    container.addChild(dotMesh);
                }
                return container;
            }

            // 連続線分としてMesh生成
            for (let i = 0; i < points.length - 1; i++) {
                const mesh = this.createSegmentMesh(
                    points[i],
                    points[i + 1],
                    brushTexture,
                    baseSize,
                    shader,
                    color,
                    alpha
                );
                container.addChild(mesh);
            }

            return container;
        }

        /**
         * 単独点のMesh生成
         * @param {Object} point - 点 {x, y, pressure}
         * @param {PIXI.Texture} brushTexture - SDFブラシテクスチャ
         * @param {number} baseSize - 基本サイズ
         * @param {PIXI.Shader} shader - カスタムシェーダー
         * @param {number} color - 色
         * @param {number} alpha - 不透明度
         * @returns {PIXI.Mesh}
         */
        createDotMesh(point, brushTexture, baseSize, shader, color, alpha) {
            const size = baseSize * (point.pressure || 0.5);
            const halfSize = size / 2;

            // Quad頂点
            const vertices = new Float32Array([
                point.x - halfSize, point.y - halfSize, // 左上
                point.x + halfSize, point.y - halfSize, // 右上
                point.x + halfSize, point.y + halfSize, // 右下
                point.x - halfSize, point.y + halfSize  // 左下
            ]);

            const uvs = new Float32Array([
                0, 0,
                1, 0,
                1, 1,
                0, 1
            ]);

            const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

            const geometry = new PIXI.Geometry()
                .addAttribute('aVertexPosition', vertices, 2)
                .addAttribute('aTextureCoord', uvs, 2)
                .addIndex(indices);

            const mesh = new PIXI.Mesh({
                geometry: geometry,
                texture: brushTexture,
                shader: shader
            });

            mesh.tint = color;
            mesh.alpha = alpha;

            return mesh;
        }

        /**
         * 最適化されたストロークMesh生成（バッチ処理）
         * @param {Array} points - ストロークポイント配列
         * @param {PIXI.Texture} brushTexture - SDFブラシテクスチャ
         * @param {number} baseSize - 基本サイズ
         * @param {PIXI.Shader} shader - カスタムシェーダー
         * @param {number} color - 色
         * @param {number} alpha - 不透明度
         * @returns {PIXI.Mesh} 単一の最適化されたMesh
         */
        createOptimizedStrokeMesh(points, brushTexture, baseSize, shader, color, alpha) {
            if (points.length < 2) {
                if (points.length === 1) {
                    return this.createDotMesh(points[0], brushTexture, baseSize, shader, color, alpha);
                }
                return null;
            }

            const segmentCount = points.length - 1;
            const vertexCount = segmentCount * 4; // 各セグメントに4頂点
            const indexCount = segmentCount * 6;  // 各セグメントに6インデックス

            const vertices = new Float32Array(vertexCount * 2);
            const uvs = new Float32Array(vertexCount * 2);
            const indices = new Uint16Array(indexCount);

            let vertexOffset = 0;
            let uvOffset = 0;
            let indexOffset = 0;

            for (let i = 0; i < segmentCount; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const angle = Math.atan2(dy, dx);

                const size1 = baseSize * (p1.pressure || 0.5);
                const size2 = baseSize * (p2.pressure || 0.5);

                const perpX = Math.sin(angle);
                const perpY = -Math.cos(angle);

                // 4頂点
                const baseVertexIndex = i * 4;

                // 左上
                vertices[vertexOffset++] = p1.x - size1 * perpX;
                vertices[vertexOffset++] = p1.y - size1 * perpY;
                uvs[uvOffset++] = 0;
                uvs[uvOffset++] = 0;

                // 右上
                vertices[vertexOffset++] = p1.x + size1 * perpX;
                vertices[vertexOffset++] = p1.y + size1 * perpY;
                uvs[uvOffset++] = 1;
                uvs[uvOffset++] = 0;

                // 右下
                vertices[vertexOffset++] = p2.x + size2 * perpX;
                vertices[vertexOffset++] = p2.y + size2 * perpY;
                uvs[uvOffset++] = 1;
                uvs[uvOffset++] = 1;

                // 左下
                vertices[vertexOffset++] = p2.x - size2 * perpX;
                vertices[vertexOffset++] = p2.y - size2 * perpY;
                uvs[uvOffset++] = 0;
                uvs[uvOffset++] = 1;

                // インデックス（2つの三角形）
                indices[indexOffset++] = baseVertexIndex + 0;
                indices[indexOffset++] = baseVertexIndex + 1;
                indices[indexOffset++] = baseVertexIndex + 2;

                indices[indexOffset++] = baseVertexIndex + 0;
                indices[indexOffset++] = baseVertexIndex + 2;
                indices[indexOffset++] = baseVertexIndex + 3;
            }

            const geometry = new PIXI.Geometry()
                .addAttribute('aVertexPosition', vertices, 2)
                .addAttribute('aTextureCoord', uvs, 2)
                .addIndex(indices);

            const mesh = new PIXI.Mesh({
                geometry: geometry,
                texture: brushTexture,
                shader: shader
            });

            mesh.tint = color;
            mesh.alpha = alpha;

            return mesh;
        }

        /**
         * プレビュー用の軽量Mesh生成（間引き処理付き）
         * @param {Array} points - ストロークポイント配列
         * @param {PIXI.Texture} brushTexture - SDFブラシテクスチャ
         * @param {number} baseSize - 基本サイズ
         * @param {PIXI.Shader} shader - カスタムシェーダー
         * @param {number} color - 色
         * @param {number} alpha - 不透明度
         * @param {number} simplificationFactor - 間引き係数（デフォルト: 2）
         * @returns {PIXI.Mesh}
         */
        createPreviewMesh(points, brushTexture, baseSize, shader, color, alpha, simplificationFactor = 2) {
            // ポイント数が少ない場合は通常処理
            if (points.length < simplificationFactor * 2) {
                return this.createOptimizedStrokeMesh(points, brushTexture, baseSize, shader, color, alpha);
            }

            // 間引き処理
            const simplifiedPoints = [];
            for (let i = 0; i < points.length; i += simplificationFactor) {
                simplifiedPoints.push(points[i]);
            }

            // 最後の点を必ず含める
            if (simplifiedPoints[simplifiedPoints.length - 1] !== points[points.length - 1]) {
                simplifiedPoints.push(points[points.length - 1]);
            }

            return this.createOptimizedStrokeMesh(simplifiedPoints, brushTexture, baseSize, shader, color, alpha);
        }
    }

    // グローバル公開
    window.SDFMeshBuilder = SDFMeshBuilder;

    console.log('✅ sdf-mesh-builder.js (Phase 3-B) loaded');
    console.log('   ✓ Segment mesh generation');
    console.log('   ✓ Optimized batch mesh generation');
    console.log('   ✓ Preview mesh with simplification');
    console.log('   ✓ Custom shader support');
})();