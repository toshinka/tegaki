/**
 * ================================================================================
 * system/drawing/sdf-brush-shader.js - Phase 3-B: SDF Brush Shader (消しゴム統合版)
 * ================================================================================
 * 
 * 【依存関係 - Parents (このファイルが依存)】
 *   - PixiJS v8.13 (PIXI.Shader API)
 *   - webgpu-compute-sdf.js (SDF texture generation)
 *   - webgpu-compute-msdf.js (MSDF texture generation)
 * 
 * 【依存関係 - Children (このファイルに依存)】
 *   - stroke-renderer.js (shader instantiation for pen/eraser)
 *   - brush-core.js (tool mode switching)
 * 
 * 【責務】
 *   - SDF-based brush shader creation (pen/eraser unified)
 *   - Anti-aliased edge rendering with smoothstep
 *   - Pressure-sensitive parameter control
 *   - Separate shader instances for pen and eraser modes
 * 
 * 【実装方式】
 *   - Pen: RGB color output with alpha channel
 *   - Eraser: White output with alpha (used with blendMode='erase')
 *   - Unified vertex shader for both modes
 *   - Distance field-based smooth falloff
 * ================================================================================
 */

(function() {
    'use strict';

    /**
     * SDF Brush Vertex Shader (共通)
     * 標準的な2D変換パイプライン
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
     * SDF Brush Fragment Shader (ペン用)
     * 距離場テクスチャからスムーズなブラシ形状を描画
     * 
     * Uniforms:
     *   - uSampler: SDF texture (R channel = normalized distance)
     *   - uSoftness: Edge softness (0.0-1.0)
     *   - uThreshold: Distance field threshold (0.0-1.0, default 0.5)
     *   - uAntialiasing: AA width (pixels, default 0.05)
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
            
            // 最終色を出力（ペンモード: カラー+アルファ）
            gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
        }
    `;

    /**
     * SDF Eraser Fragment Shader (消しゴム用)
     * blendMode='erase'と併用することでアルファ減算を実現
     * 
     * Uniforms:
     *   - uSampler: SDF texture
     *   - uSoftness: Edge softness
     *   - uThreshold: Distance threshold
     *   - uAntialiasing: AA width
     *   - uOpacity: Eraser opacity (0.0-1.0)
     */
    const sdfEraserFragment = `
        precision highp float;

        varying vec2 vTextureCoord;
        varying vec4 vColor;

        uniform sampler2D uSampler;
        uniform float uSoftness;
        uniform float uThreshold;
        uniform float uAntialiasing;
        uniform float uOpacity;       // 消しゴムの不透明度

        void main(void) {
            // SDFテクスチャから距離値を取得
            float distance = texture2D(uSampler, vTextureCoord).r;
            
            // 距離場からアルファ値を計算（ペンと同じアルゴリズム）
            float edge0 = uThreshold - uSoftness - uAntialiasing;
            float edge1 = uThreshold - uSoftness + uAntialiasing;
            float alpha = smoothstep(edge0, edge1, distance);
            
            // 消しゴムの不透明度を適用
            alpha *= uOpacity;
            
            // 消しゴムは白色でアルファのみ制御
            // blendMode='erase'がアルファチャンネルを減算する
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `;

    /**
     * SDFBrushShader - SDF Brush Shader管理クラス
     * ペンと消しゴムのシェーダーインスタンスを管理
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
            if (this.initialized) {
                console.warn('[SDFBrushShader] Already initialized');
                return;
            }

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
                        uAntialiasing: 0.05,
                        uOpacity: 1.0
                    }
                );

                this.initialized = true;
                console.log('✅ [SDFBrushShader] Initialized');
            } catch (error) {
                console.error('❌ [SDFBrushShader] Initialization failed:', error);
                this.initialized = false;
            }
        }

        /**
         * ペン用シェーダーを取得
         * @param {Object} params - シェーダーパラメータ
         * @param {number} [params.softness=0.1] - エッジソフトネス（0.0-1.0）
         * @param {number} [params.threshold=0.5] - 距離閾値（0.0-1.0）
         * @param {number} [params.antialiasing=0.05] - AA幅
         * @returns {PIXI.Shader|null}
         */
        getPenShader(params = {}) {
            if (!this.initialized || !this.penShader) {
                console.warn('[SDFBrushShader] Not initialized');
                return null;
            }

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
         * @param {number} [params.softness=0.1] - エッジソフトネス
         * @param {number} [params.threshold=0.5] - 距離閾値
         * @param {number} [params.antialiasing=0.05] - AA幅
         * @param {number} [params.opacity=1.0] - 消しゴム不透明度（0.0-1.0）
         * @returns {PIXI.Shader|null}
         */
        getEraserShader(params = {}) {
            if (!this.initialized || !this.eraserShader) {
                console.warn('[SDFBrushShader] Not initialized');
                return null;
            }

            const shader = this.eraserShader.clone();
            
            // パラメータ設定
            shader.uniforms.uSoftness = params.softness ?? 0.1;
            shader.uniforms.uThreshold = params.threshold ?? 0.5;
            shader.uniforms.uAntialiasing = params.antialiasing ?? 0.05;
            shader.uniforms.uOpacity = params.opacity ?? 1.0;

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
         * デフォルトパラメータを取得（筆圧対応）
         * @param {string} tool - 'pen' | 'eraser'
         * @param {number} pressure - 筆圧（0.0-1.0）
         * @returns {Object} パラメータオブジェクト
         */
        getDefaultParams(tool = 'pen', pressure = 0.5) {
            // 筆圧に応じてソフトネスを調整
            // 筆圧が低い → エッジが柔らかく
            // 筆圧が高い → エッジがシャープに
            const softness = 0.05 + (1.0 - pressure) * 0.15;

            const baseParams = {
                softness: softness,
                threshold: 0.5,
                antialiasing: 0.05
            };

            // 消しゴムの場合は不透明度パラメータを追加
            if (tool === 'eraser') {
                baseParams.opacity = 1.0;
            }

            return baseParams;
        }

        /**
         * パラメータのバリデーション
         * @param {Object} params - 検証するパラメータ
         * @returns {Object} バリデート済みパラメータ
         */
        validateParams(params) {
            const validated = { ...params };

            // 範囲チェック
            if (validated.softness !== undefined) {
                validated.softness = Math.max(0.0, Math.min(1.0, validated.softness));
            }
            if (validated.threshold !== undefined) {
                validated.threshold = Math.max(0.0, Math.min(1.0, validated.threshold));
            }
            if (validated.antialiasing !== undefined) {
                validated.antialiasing = Math.max(0.0, Math.min(0.2, validated.antialiasing));
            }
            if (validated.opacity !== undefined) {
                validated.opacity = Math.max(0.0, Math.min(1.0, validated.opacity));
            }

            return validated;
        }
    }

    // グローバル公開
    window.SDFBrushShader = SDFBrushShader;

    console.log('✅ sdf-brush-shader.js (Phase 3-B - 消しゴム統合版) loaded');
    console.log('   ✓ Unified SDF shader system');
    console.log('   ✓ Pen: Color + alpha rendering');
    console.log('   ✓ Eraser: White + alpha (blendMode="erase")');
    console.log('   ✓ Pressure-sensitive softness control');
    console.log('   ✓ Parameter validation support');
})();