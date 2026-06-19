/**
 * ================================================================================
 * system/drawing/sdf-brush-shader.js - ペン/消しゴム統合Shader【Phase 1完成版】
 * ================================================================================
 * 
 * 【依存関係 - Parents】
 *   - PixiJS v8.13 (PIXI.Shader)
 * 
 * 【依存関係 - Children】
 *   - stroke-renderer.js (描画時に使用)
 *   - sdf-mesh-builder.js (メッシュ構築)
 * 
 * 【責務】
 *   - SDF距離場ベースのペン/消しゴムShader統合管理
 *   - isErase フラグによる描画/消去モード切り替え
 *   - ベクター構造保持（ラスター化回避）
 * 
 * 【改修内容】
 *   ✅ ペン/消しゴムを単一Shaderに統合
 *   ✅ uEraseMode uniform で動作切替
 *   ✅ 消しゴム時は alphaMode='subtract' で合成
 *   ✅ ベクター情報を完全保持
 * ================================================================================
 */

(function() {
    'use strict';

    class SDFBrushShader {
        /**
         * Vertex Shader - 標準的な頂点変換
         */
        static vertex = `
            attribute vec2 aPosition;
            attribute vec2 aUV;
            uniform mat3 translationMatrix;
            uniform mat3 projectionMatrix;
            varying vec2 vUV;
            
            void main() {
                vUV = aUV;
                gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
            }
        `;
        
        /**
         * Fragment Shader - ペン/消しゴム統合版
         * 
         * uEraseMode:
         *   0.0 = ペンモード（通常描画）
         *   1.0 = 消しゴムモード（アルファ減算）
         */
        static fragment = `
            precision highp float;
            varying vec2 vUV;
            uniform sampler2D uSDF;
            uniform float uRadius;
            uniform float uHardness;
            uniform vec4 uColor;
            uniform float uEraseMode;
            
            void main() {
                float dist = texture2D(uSDF, vUV).r;
                
                float innerRadius = uRadius * uHardness;
                float alpha = 1.0 - smoothstep(innerRadius, uRadius, dist);
                
                if (uEraseMode > 0.5) {
                    // 消しゴムモード: アルファのみ出力（減算合成用）
                    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
                } else {
                    // ペンモード: 通常描画
                    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
                }
            }
        `;
        
        /**
         * Shaderインスタンス作成
         * @param {Object} params - Shaderパラメータ
         * @param {number} params.radius - ブラシ半径
         * @param {number} params.hardness - 硬さ (0.0-1.0)
         * @param {number} params.color - 色 (0xRRGGBB)
         * @param {number} params.opacity - 不透明度 (0.0-1.0)
         * @param {boolean} params.isErase - 消しゴムモード
         * @returns {PIXI.Shader} Shader
         */
        static create(params = {}) {
            if (!window.PIXI || !PIXI.Shader) {
                console.error('[SDFBrushShader] PixiJS not available');
                return null;
            }
            
            const {
                radius = 10,
                hardness = 0.8,
                color = 0x000000,
                opacity = 1.0,
                isErase = false
            } = params;
            
            // 色を正規化
            const r = ((color >> 16) & 0xFF) / 255;
            const g = ((color >> 8) & 0xFF) / 255;
            const b = (color & 0xFF) / 255;
            
            return PIXI.Shader.from(this.vertex, this.fragment, {
                uRadius: radius,
                uHardness: Math.max(0.1, Math.min(1.0, hardness)),
                uColor: [r, g, b, opacity],
                uEraseMode: isErase ? 1.0 : 0.0
            });
        }
        
        /**
         * Shader設定更新
         * @param {PIXI.Shader} shader - 既存Shader
         * @param {Object} params - 更新パラメータ
         */
        static updateUniforms(shader, params = {}) {
            if (!shader || !shader.uniforms) return;
            
            if (params.radius !== undefined) {
                shader.uniforms.uRadius = params.radius;
            }
            if (params.hardness !== undefined) {
                shader.uniforms.uHardness = Math.max(0.1, Math.min(1.0, params.hardness));
            }
            if (params.color !== undefined) {
                const r = ((params.color >> 16) & 0xFF) / 255;
                const g = ((params.color >> 8) & 0xFF) / 255;
                const b = (params.color & 0xFF) / 255;
                shader.uniforms.uColor[0] = r;
                shader.uniforms.uColor[1] = g;
                shader.uniforms.uColor[2] = b;
            }
            if (params.opacity !== undefined) {
                shader.uniforms.uColor[3] = params.opacity;
            }
            if (params.isErase !== undefined) {
                shader.uniforms.uEraseMode = params.isErase ? 1.0 : 0.0;
            }
        }
    }

    // sdf-eraser-shader.js は廃止（統合済み）
    window.SDFBrushShader = SDFBrushShader;

    console.log('✅ sdf-brush-shader.js (ペン/消しゴム統合版) loaded');
    console.log('   ✓ 単一Shaderでペン/消しゴム対応');
    console.log('   ✓ uEraseMode uniform で切替');
    console.log('   ✓ ベクター構造完全保持');

})();