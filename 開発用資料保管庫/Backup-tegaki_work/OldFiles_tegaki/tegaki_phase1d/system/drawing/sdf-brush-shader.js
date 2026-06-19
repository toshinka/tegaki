/**
 * ================================================================================
 * system/drawing/sdf-brush-shader.js - ペン専用Shader【Phase 1-FIX】
 * ================================================================================
 * 
 * 【Phase 1-FIX 改修内容】
 * 🔧 消しゴムモードを削除（uEraseMode削除）
 * 🔧 ペン描画専用に特化
 * 🔧 stroke-renderer.js で消しゴムは通常Graphics描画を使用
 * 
 * 【依存関係 - Parents】
 *   - PixiJS v8.13 (PIXI.Shader)
 * 
 * 【依存関係 - Children】
 *   - stroke-renderer.js (_renderFinalStrokeWebGPU で使用 - ペン専用)
 *   - sdf-mesh-builder.js (メッシュ構築)
 * 
 * 【責務】
 *   - SDF距離場ベースのペン描画Shader
 *   - アンチエイリアス品質制御
 *   - ベクター構造保持（ラスター化回避）
 * 
 * 【使用禁止】
 *   - 消しゴム描画（blendMode問題のため通常Graphics使用）
 * 
 * 【技術詳細】
 *   PixiJS v8では、Custom Shader適用後にblendModeを設定しても
 *   正しく機能しない。消しゴムはShader不使用で実装する。
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
         * Fragment Shader - ペン専用
         * 
         * uHardness: 硬さ (0.0-1.0)
         *   - 1.0に近いほどエッジが鋭くなる
         *   - 0.0に近いほどぼかしが強くなる
         */
        static fragment = `
            precision highp float;
            varying vec2 vUV;
            uniform sampler2D uSDF;
            uniform float uRadius;
            uniform float uHardness;
            uniform vec4 uColor;
            
            void main() {
                float dist = texture2D(uSDF, vUV).r;
                
                float innerRadius = uRadius * uHardness;
                float alpha = 1.0 - smoothstep(innerRadius, uRadius, dist);
                
                // ペン描画のみ
                gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
            }
        `;
        
        /**
         * Shaderインスタンス作成（ペン専用）
         * @param {Object} params - Shaderパラメータ
         * @param {number} params.radius - ブラシ半径
         * @param {number} params.hardness - 硬さ (0.0-1.0)
         * @param {number} params.color - 色 (0xRRGGBB)
         * @param {number} params.opacity - 不透明度 (0.0-1.0)
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
                opacity = 1.0
            } = params;
            
            // 色を正規化
            const r = ((color >> 16) & 0xFF) / 255;
            const g = ((color >> 8) & 0xFF) / 255;
            const b = (color & 0xFF) / 255;
            
            return PIXI.Shader.from(this.vertex, this.fragment, {
                uRadius: radius,
                uHardness: Math.max(0.1, Math.min(1.0, hardness)),
                uColor: [r, g, b, opacity]
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
        }
    }

    window.SDFBrushShader = SDFBrushShader;

    console.log('✅ sdf-brush-shader.js (Phase 1-FIX: ペン専用) loaded');
    console.log('   ✓ 消しゴムモード削除');
    console.log('   ✓ ペン描画に特化');

})();