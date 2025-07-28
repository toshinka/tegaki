// src/engine/OGLRenderingEngine.js

import { Renderer, Program, Mesh, Geometry } from 'ogl';

export class OGLRenderingEngine {
    constructor() {
        this.renderer = null;
        this.gl = null;
        this.program = null;
        this.meshes = [];
        this.config = {
            lineWidth: 2,
            alpha: 1.0,
            color: [0, 0, 0],
            blendMode: 'normal'
        };
        this.initialized = false;
    }

    initialize(canvas, config = {}) {
        try {
            this.config = { ...this.config, ...config };
            
            // キャンバスサイズを設定
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            // OGLレンダラーの初期化
            this.renderer = new Renderer({ 
                canvas,
                width: canvas.width,
                height: canvas.height,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
            
            this.gl = this.renderer.gl;
            
            // WebGLコンテキストの設定
            this.gl.enable(this.gl.BLEND);
            this.setupBlendMode(this.config.blendMode);
            
            // シェーダープログラムの作成
            this.program = new Program(this.gl, {
                vertex: this.getVertexShader(),
                fragment: this.getFragmentShader(),
                uniforms: {
                    uProjectionMatrix: { value: this.getProjectionMatrix(canvas) },
                    uColor: { value: this.config.color },
                    uAlpha: { value: this.config.alpha }
                }
            });

            this.initialized = true;
            console.log('OGL Rendering Engine initialized');
        } catch (error) {
            console.error('Failed to initialize OGL Rendering Engine:', error);
            this.initialized = false;
        }
    }

    // 設定を更新
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        
        if (this.program && this.program.uniforms) {
            this.program.uniforms.uColor.value = this.config.color;
            this.program.uniforms.uAlpha.value = this.config.alpha;
        }
        
        if (this.gl && this.config.blendMode) {
            this.setupBlendMode(this.config.blendMode);
        }
    }

    // ブレンドモードの設定
    setupBlendMode(blendMode) {
        switch (blendMode) {
            case 'destination-out': // 消しゴム用
                this.gl.blendFunc(this.gl.ZERO, this.gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'multiply':
                this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'screen':
                this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_COLOR);
                break;
            case 'normal':
            default:
                this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                break;
        }
    }

    // 軌跡データを描画
    renderPath(pathData) {
        if (!this.initialized || !pathData || !pathData.points || pathData.points.length < 2) {
            return;
        }

        try {
            // 軌跡データから頂点配列を作成
            const vertices = this.createVerticesFromPath(pathData);
            
            if (vertices.length === 0) return;
            
            // ジオメトリとメッシュを作成
            const geometry = new Geometry(this.gl, {
                position: { size: 2, data: new Float32Array(vertices) }
            });
            
            const mesh = new Mesh(this.gl, { 
                geometry, 
                program: this.program,
                mode: this.gl.TRIANGLES
            });
            
            // シーンに追加
            this.meshes.push(mesh);
            
            // 描画
            this.render();
            
        } catch (error) {
            console.error('Failed to render path:', error);
        }
    }

    // 描画実行
    render() {
        if (!this.initialized || !this.renderer) return;
        
        try {
            this.renderer.render({ scene: this.meshes });
        } catch (error) {
            console.error('Failed to render:', error);
        }
    }

    // 軌跡データから頂点配列を生成
    createVerticesFromPath(pathData) {
        const vertices = [];
        const points = pathData.points;
        const widths = pathData.widths || [];
        
        if (points.length < 2) return vertices;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const width1 = (widths[i] || this.config.lineWidth) / 2;
            const width2 = (widths[i + 1] || this.config.lineWidth) / 2;
            
            // 線セグメントを四角形として描画するための頂点を計算
            const segment = this.createLineSegment(p1, p2, width1, width2);
            vertices.push(...segment);
        }
        
        return vertices;
    }

    // 線セグメントを四角形として表現する頂点を生成
    createLineSegment(p1, p2, width1, width2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        // 法線ベクトル
        const nx = -dy / length;
        const ny = dx / length;
        
        // 四角形の4つの頂点
        const v1x = p1.x + nx * width1;
        const v1y = p1.y + ny * width1;
        const v2x = p1.x - nx * width1;
        const v2y = p1.y - ny * width1;
        const v3x = p2.x + nx * width2;
        const v3y = p2.y + ny * width2;
        const v4x = p2.x - nx * width2;
        const v4y = p2.y - ny * width2;
        
        // 2つの三角形として返す
        return [
            // 第1三角形
            v1x, v1y,
            v2x, v2y,
            v3x, v3y,
            // 第2三角形
            v2x, v2y,
            v4x, v4y,
            v3x, v3y
        ];
    }

    // 頂点シェーダー
    getVertexShader() {
        return `
            attribute vec2 position;
            uniform mat3 uProjectionMatrix;
            
            void main() {
                vec3 pos = uProjectionMatrix * vec3(position, 1.0);
                gl_Position = vec4(pos.xy, 0.0, 1.0);
            }
        `;
    }

    // フラグメントシェーダー
    getFragmentShader() {
        return `
            precision mediump float;
            uniform vec3 uColor;
            uniform float uAlpha;
            
            void main() {
                gl_FragColor = vec4(uColor, uAlpha);
            }
        `;
    }

    // 2D描画用の射影行列を生成
    getProjectionMatrix(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        
        // 正規化座標系への変換行列
        return [
            2 / width, 0, 0,
            0, -2 / height, 0,
            -1, 1, 1
        ];
    }

    // キャンバスをクリア
    clear() {
        if (!this.initialized) return;
        
        try {
            // 既存のメッシュを削除
            this.meshes.forEach(mesh => {
                if (mesh.geometry) mesh.geometry.dispose();
            });
            this.meshes = [];
            
            // キャンバスをクリア
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            
        } catch (error) {
            console.error('Failed to clear canvas:', error);
        }
    }

    // リソースを解放
    dispose() {
        try {
            // メッシュとジオメトリを削除
            this.meshes.forEach(mesh => {
                if (mesh.geometry) mesh.geometry.dispose();
            });
            this.meshes = [];
            
            // プログラムを削除
            if (this.program) {
                this.program.dispose();
                this.program = null;
            }
            
            // レンダラーを削除
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }
            
            this.gl = null;
            this.initialized = false;
            
            console.log('OGL Rendering Engine disposed');
        } catch (error) {
            console.error('Failed to dispose OGL Rendering Engine:', error);
        }
    }

    // キャンバスサイズを更新
    resize(width, height) {
        if (!this.initialized || !this.renderer) return;
        
        try {
            const dpr = window.devicePixelRatio || 1;
            const pixelWidth = width * dpr;
            const pixelHeight = height * dpr;
            
            this.renderer.setSize(pixelWidth, pixelHeight);
            
            // 射影行列を更新
            if (this.program && this.program.uniforms.uProjectionMatrix) {
                this.program.uniforms.uProjectionMatrix.value = [
                    2 / pixelWidth, 0, 0,
                    0, -2 / pixelHeight, 0,
                    -1, 1, 1
                ];
            }
            
        } catch (error) {
            console.error('Failed to resize:', error);
        }
    }

    // 初期化状態を取得
    isInitialized() {
        return this.initialized;
    }

    // 統計情報を取得
    getStats() {
        return {
            meshCount: this.meshes.length,
            initialized: this.initialized,
            config: { ...this.config }
        };
    }
}