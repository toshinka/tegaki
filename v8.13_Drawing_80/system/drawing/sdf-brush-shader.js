// ===== system/drawing/sdf-brush-shader.js - Phase 3-A: SDF Brush Shader =====
// SDF（Signed Distance Field）ベースのブラシシェーダー
// 高品質なアンチエイリアス・スケール非依存な描画を実現

(function() {
    'use strict';

    /**
     * SDF Brush Fragment Shader
     * 距離場テクスチャからスムーズなブラシ形状を描画
     */
    const sdfBrushFragment = `
        precision highp float;

        varying vec2 vTextureCoord;
        varying vec4 vColor;

        uniform sampler2D uSampler;
        uniform float uSoftness;      // エッジのソフトネス（0.0-1.0）
        uniform float uThreshold;     // 距離場の閾値（0.0-1.0）
        uniform float uAntialiasing;  // アンチエイリアス幅

        void main(void) {
            // SDFテクスチャから距離値を取得（0.0-1.0）
            float distance = texture2D(uSampler, vTextureCoord).r;
            
            // 距離場からアルファ値を計算
            // smoothstep()で滑らかなエッジを実現
            float edge0 = uThreshold - uSoftness - uAntialiasing;
            float edge1 = uThreshold - uSoftness + uAntialiasing;
            float alpha = smoothstep(edge0, edge1, distance);
            
            // 最終色を出力
            gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
        }
    `;

    /**
     * SDF Brush Vertex Shader
     * 標準的な頂点シェーダー（変換のみ）
     */
    const sdfBrushVertex = `
        precision highp float;

        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        attribute vec4 aColor;

        uniform mat3 projectionMatrix;
        uniform mat3 translationMatrix;

        varying vec2 vTextureCoord;
        varying vec4 vColor;

        void main(void) {
            vTextureCoord = aTextureCoord;
            vColor = aColor;
            gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        }
    `;

    /**
     * SDF Eraser Fragment Shader
     * 消しゴム用（blendMode='erase'と併用）
     */
    const sdfEraserFragment = `
        precision highp float;

        varying vec2 vTextureCoord;
        varying vec4 vColor;

        uniform sampler2D uSampler;
        uniform float uSoftness;
        uniform float uThreshold;
        uniform float uAntialiasing;

        void main(void) {
            float distance = texture2D(uSampler, vTextureCoord).r;
            
            float edge0 = uThreshold - uSoftness - uAntialiasing;
            float edge1 = uThreshold - uSoftness + uAntialiasing;
            float alpha = smoothstep(edge0, edge1, distance);
            
            // 消しゴムは白色でアルファのみ制御
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `;

    /**
     * SDFBrushShader - SDF Brush Shader管理クラス
     */
    class SDFBrushShader {
        constructor() {
            this.penShader = null;
            this.eraserShader = null;
            this.initialized = false;
        }

        /**
         * シェーダー初期化
         * @param {PIXI.Renderer} renderer - PixiJSレンダラー
         */
        initialize(renderer) {
            if (this.initialized) return;

            try {
                // ペン用シェーダー
                this.penShader = PIXI.Shader.from(
                    sdfBrushVertex,
                    sdfBrushFragment,
                    {
                        uSampler: null,
                        uSoftness: 0.1,
                        uThreshold: 0.5,
                        uAntialiasing: 0.05
                    }
                );

                // 消しゴム用シェーダー
                this.eraserShader = PIXI.Shader.from(
                    sdfBrushVertex,
                    sdfEraserFragment,
                    {
                        uSampler: null,
                        uSoftness: 0.1,
                        uThreshold: 0.5,
                        uAntialiasing: 0.05
                    }
                );

                this.initialized = true;
                console.log('✅ SDF Brush Shader initialized');
            } catch (error) {
                console.error('❌ SDF Brush Shader initialization failed:', error);
                this.initialized = false;
            }
        }

        /**
         * ペン用シェーダーを取得
         * @param {Object} params - シェーダーパラメータ
         * @returns {PIXI.Shader}
         */
        getPenShader(params = {}) {
            if (!this.initialized || !this.penShader) return null;

            const shader = this.penShader.clone();
            
            // パラメータ設定
            shader.uniforms.uSoftness = params.softness ?? 0.1;
            shader.uniforms.uThreshold = params.threshold ?? 0.5;
            shader.uniforms.uAntialiasing = params.antialiasing ?? 0.05;

            return shader;
        }

        /**
         * 消しゴム用シェーダーを取得
         * @param {Object} params - シェーダーパラメータ
         * @returns {PIXI.Shader}
         */
        getEraserShader(params = {}) {
            if (!this.initialized || !this.eraserShader) return null;

            const shader = this.eraserShader.clone();
            
            // パラメータ設定
            shader.uniforms.uSoftness = params.softness ?? 0.1;
            shader.uniforms.uThreshold = params.threshold ?? 0.5;
            shader.uniforms.uAntialiasing = params.antialiasing ?? 0.05;

            return shader;
        }

        /**
         * シェーダー対応チェック
         * @returns {boolean}
         */
        isAvailable() {
            return this.initialized && this.penShader !== null && this.eraserShader !== null;
        }

        /**
         * デフォルトパラメータを取得
         * @param {string} tool - 'pen' | 'eraser'
         * @param {number} pressure - 筆圧（0.0-1.0）
         * @returns {Object}
         */
        getDefaultParams(tool = 'pen', pressure = 0.5) {
            // 筆圧に応じてソフトネスを調整
            const softness = 0.05 + (1.0 - pressure) * 0.15;

            return {
                softness: softness,
                threshold: 0.5,
                antialiasing: 0.05
            };
        }
    }

    // グローバル公開
    window.SDFBrushShader = SDFBrushShader;

    console.log('✅ sdf-brush-shader.js (Phase 3-A) loaded');
    console.log('   ✓ SDF fragment shader with smoothstep()');
    console.log('   ✓ Scale-independent smooth edges');
    console.log('   ✓ Pressure-sensitive softness control');
})();