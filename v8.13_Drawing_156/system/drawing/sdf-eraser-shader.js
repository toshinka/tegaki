/**
 * ================================================================================
 * system/drawing/sdf-eraser-shader.js - Phase 1-1: SDF消しゴムShader
 * ================================================================================
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - PixiJS v8.13 (PIXI.Shader)
 * 
 * 【依存関係 - Children (このファイルに依存)】
 *   - stroke-renderer.js (消しゴム描画時に使用)
 * 
 * 【責務】
 *   - 消しゴム専用Fragment Shader定義
 *   - Destination Alpha減算処理
 *   - SDF距離場ベースのスムーズ消去
 * 
 * 【Phase 1-1 実装内容】
 *   ✅ Alpha Mask方式のFragment Shader
 *   ✅ SDF距離場に基づくスムーズエッジ
 *   ✅ uRadius, uHardness パラメータ制御
 * ================================================================================
 */

(function() {
    'use strict';

    class SDFEraserShader {
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
         * Fragment Shader - Alpha減算による消しゴム処理
         * 
         * アルゴリズム:
         * 1. SDF距離場からeraseFactor計算 (0.0=消去なし, 1.0=完全消去)
         * 2. gl_FragColor.a に eraseFactor を適用
         * 3. blendMode='erase' で既存アルファから減算
         */
        static fragment = `
            precision highp float;
            varying vec2 vUV;
            uniform sampler2D uSDF;
            uniform float uRadius;
            uniform float uHardness;
            
            void main() {
                // SDF距離場取得
                float dist = texture2D(uSDF, vUV).r;
                
                // 距離に基づくスムーズな消去係数計算
                // uHardness = 0.8 の場合、radius*0.8 ~ radius の範囲でスムーズに遷移
                float innerRadius = uRadius * uHardness;
                float eraseFactor = 1.0 - smoothstep(innerRadius, uRadius, dist);
                
                // Alpha減算用の白色出力 (blendMode='erase'で機能)
                gl_FragColor = vec4(1.0, 1.0, 1.0, eraseFactor);
            }
        `;
        
        /**
         * Shaderインスタンス作成
         * @param {number} radius - 消しゴム半径
         * @param {number} hardness - 硬さ (0.0-1.0)
         * @returns {PIXI.Shader} 消しゴムShader
         */
        static create(radius, hardness = 0.8) {
            if (!window.PIXI || !PIXI.Shader) {
                console.error('[SDFEraserShader] PixiJS not available');
                return null;
            }
            
            return PIXI.Shader.from(this.vertex, this.fragment, {
                uRadius: radius,
                uHardness: Math.max(0.1, Math.min(1.0, hardness))
            });
        }
        
        /**
         * Shader設定更新
         * @param {PIXI.Shader} shader - 既存Shader
         * @param {number} radius - 新しい半径
         * @param {number} hardness - 新しい硬さ
         */
        static updateUniforms(shader, radius, hardness = 0.8) {
            if (!shader || !shader.uniforms) return;
            
            shader.uniforms.uRadius = radius;
            shader.uniforms.uHardness = Math.max(0.1, Math.min(1.0, hardness));
        }
    }

    window.SDFEraserShader = SDFEraserShader;

    console.log('✅ sdf-eraser-shader.js (Phase 1-1) loaded');
    console.log('   ✓ Alpha Mask方式Fragment Shader');
    console.log('   ✓ SDF距離場ベーススムーズ消去');
    console.log('   ✓ uRadius/uHardness パラメータ制御');

})();