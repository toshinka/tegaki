/**
 * MSDFBrushShader - MSDF (Multi-channel SDF) Fragment Shader管理
 * Phase 4-B-2: MSDFシェーダー実装
 * 
 * 責務:
 * - RGB 3チャンネルからmedian()計算
 * - エッジ精度向上（角・交差部を完璧に表現）
 * - PixiJS Shader統合
 */

(function() {
    'use strict';

    // MSDF Fragment Shader（GLSL）
    const MSDF_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vTextureCoord;
varying vec4 vColor;

uniform sampler2D uSampler;
uniform float uThreshold;
uniform float uSmoothness;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main(void) {
    vec3 msdf = texture2D(uSampler, vTextureCoord).rgb;
    float sd = median(msdf.r, msdf.g, msdf.b);
    float alpha = smoothstep(uThreshold - uSmoothness, uThreshold + uSmoothness, sd);
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
}
`;

    // 標準 Vertex Shader（PixiJS互換）
    const VERTEX_SHADER = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec4 aColor;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;
varying vec4 vColor;

void main(void) {
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
    vColor = aColor;
}
`;

    class MSDFBrushShader {
        constructor() {
            this.shader = null;
            this.initialized = false;
        }

        /**
         * 初期化
         * @param {PIXI.Renderer} renderer - PixiJS Renderer
         */
        initialize(renderer) {
            if (this.initialized) {
                return;
            }

            try {
                // PixiJS v8 Shader作成
                this.shader = PIXI.Shader.from({
                    gl: {
                        vertex: VERTEX_SHADER,
                        fragment: MSDF_FRAGMENT_SHADER
                    },
                    resources: {
                        uniforms: {
                            uSampler: { value: null, type: 'sampler2D' },
                            uThreshold: { value: 0.5, type: 'f32' },
                            uSmoothness: { value: 0.05, type: 'f32' }
                        }
                    }
                });

                this.initialized = true;
                console.log('[MSDF Shader] Initialized');

            } catch (error) {
                console.error('[MSDF Shader] Initialization failed:', error);
                throw error;
            }
        }

        /**
         * MSDFシェーダー取得
         * @param {Object} params - { threshold, smoothness }
         * @returns {PIXI.Shader}
         */
        getMSDFShader(params = {}) {
            if (!this.initialized) {
                throw new Error('[MSDF Shader] Not initialized');
            }

            const threshold = params.threshold ?? 0.5;
            const smoothness = params.smoothness ?? 0.05;

            // Uniform更新
            this.shader.resources.uniforms.uniforms.uThreshold = threshold;
            this.shader.resources.uniforms.uniforms.uSmoothness = smoothness;

            return this.shader;
        }

        /**
         * Uniform更新
         * @param {PIXI.Shader} shader
         * @param {number} threshold
         * @param {number} smoothness
         */
        updateUniforms(shader, threshold, smoothness) {
            if (shader && shader.resources && shader.resources.uniforms) {
                shader.resources.uniforms.uniforms.uThreshold = threshold;
                shader.resources.uniforms.uniforms.uSmoothness = smoothness;
            }
        }

        /**
         * 破棄
         */
        destroy() {
            if (this.shader) {
                this.shader.destroy();
                this.shader = null;
            }
            this.initialized = false;
        }
    }

    // グローバル登録
    window.MSDFBrushShader = MSDFBrushShader;

    console.log('✅ system/drawing/msdf/msdf-brush-shader.js loaded');

})();