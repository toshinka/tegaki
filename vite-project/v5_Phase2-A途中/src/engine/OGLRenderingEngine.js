// src/engine/OGLRenderingEngine.js

export class OGLRenderingEngine {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.meshes = [];
        this.config = {
            lineWidth: 2,
            alpha: 1.0,
            color: [0.5, 0, 0], // #800000 に対応 (128/255, 0, 0)
            blendMode: 'normal'
        };
        this.initialized = false;
        this.vertices = [];
        this.vertexBuffer = null;
        
        // 累積描画用のバッファ
        this.allVertices = [];
        this.maxVertices = 100000; // 最大頂点数
    }

    initialize(canvas, config = {}) {
        try {
            console.log('Initializing OGL Rendering Engine...');
            
            this.config = { ...this.config, ...config };
            this.canvas = canvas;
            
            // WebGLコンテキストの取得
            this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            console.log('WebGL context acquired');

            // キャンバスサイズを設定
            this.setupCanvas();
            
            // WebGLコンテキストの設定
            this.setupWebGL();
            
            // シェーダープログラムの作成
            this.createShaderProgram();
            
            // バッファの初期化
            this.initializeBuffers();

            this.initialized = true;
            console.log('OGL Rendering Engine initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OGL Rendering Engine:', error);
            this.initialized = false;
            throw error;
        }
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        // CSS サイズは元のまま
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // ビューポートを設定
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        console.log(`Canvas size set to ${this.canvas.width}x${this.canvas.height}`);
    }

    setupWebGL() {
        // ブレンディングを有効化
        this.gl.enable(this.gl.BLEND);
        this.setupBlendMode(this.config.blendMode);
        
        // 背景色を設定
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        
        // デプステストを無効化（2D描画のため）
        this.gl.disable(this.gl.DEPTH_TEST);
        
        // 線のスムージングを有効化（利用可能な場合）
        if (this.gl.getExtension('OES_standard_derivatives')) {
            console.log('Standard derivatives extension available');
        }
        
        console.log('WebGL context configured');
    }

    setupBlendMode(blendMode) {
        if (!this.gl) return;
        
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

    createShaderProgram() {
        // 頂点シェーダーをコンパイル
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, this.getVertexShader());
        if (!vertexShader) {
            throw new Error('Failed to compile vertex shader');
        }

        // フラグメントシェーダーをコンパイル
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, this.getFragmentShader());
        if (!fragmentShader) {
            throw new Error('Failed to compile fragment shader');
        }

        // プログラムを作成してリンク
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        // リンク結果を確認
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(this.program);
            this.gl.deleteProgram(this.program);
            throw new Error('Failed to link shader program: ' + error);
        }

        // attribute と uniform の位置を取得
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.projectionMatrixLocation = this.gl.getUniformLocation(this.program, 'u_projectionMatrix');
        this.colorLocation = this.gl.getUniformLocation(this.program, 'u_color');
        this.alphaLocation = this.gl.getUniformLocation(this.program, 'u_alpha');

        console.log('Shader program created successfully');
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            console.error('Shader compilation error:', error);
            return null;
        }

        return shader;
    }

    initializeBuffers() {
        // 頂点バッファを作成
        this.vertexBuffer = this.gl.createBuffer();
        
        console.log('Buffers initialized');
    }

    // 設定を更新
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        
        if (this.gl && this.config.blendMode) {
            this.setupBlendMode(this.config.blendMode);
        }
        
        console.log('Config updated:', this.config);
    }

    // 軌跡データを描画（累積描画方式に変更）
    renderPath(pathData) {
        if (!this.initialized || !pathData || !pathData.points || pathData.points.length < 2) {
            return;
        }

        try {
            // 軌跡データから頂点配列を作成
            const newVertices = this.createVerticesFromPath(pathData);
            
            if (newVertices.length === 0) return;
            
            // 新しい頂点を累積バッファに追加
            this.allVertices.push(...newVertices);
            
            // バッファサイズ制限
            if (this.allVertices.length > this.maxVertices) {
                const excess = this.allVertices.length - this.maxVertices;
                this.allVertices.splice(0, excess);
            }
            
            // 全体を再描画
            this.redrawAll();
            
        } catch (error) {
            console.error('Failed to render path:', error);
        }
    }

    // 累積されたすべての頂点を描画
    redrawAll() {
        if (!this.initialized || !this.program || this.allVertices.length === 0) return;
        
        // キャンバスをクリア
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // 頂点データをバッファに送信
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.allVertices), this.gl.DYNAMIC_DRAW);
        
        // 描画を実行
        this.draw(this.allVertices.length / 2); // 2D座標なので2で割る
    }

    draw(vertexCount) {
        if (!this.initialized || !this.program) return;
        
        // プログラムを使用
        this.gl.useProgram(this.program);
        
        // 射影行列を設定
        const projectionMatrix = this.getProjectionMatrix();
        this.gl.uniformMatrix3fv(this.projectionMatrixLocation, false, projectionMatrix);
        
        // 色と透明度を設定
        this.gl.uniform3fv(this.colorLocation, this.config.color);
        this.gl.uniform1f(this.alphaLocation, this.config.alpha);
        
        // 頂点属性を設定
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        // 描画実行
        this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);
    }

    // 軌跡データから頂点配列を生成（改善版）
    createVerticesFromPath(pathData) {
        const vertices = [];
        const points = pathData.points;
        const widths = pathData.widths || [];
        
        if (points.length < 2) return vertices;
        
        // デバイスピクセル比を考慮した座標変換
        const dpr = window.devicePixelRatio || 1;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = {
                x: points[i].x * dpr,
                y: points[i].y * dpr
            };
            const p2 = {
                x: points[i + 1].x * dpr,
                y: points[i + 1].y * dpr
            };
            
            const width1 = ((widths[i] || this.config.lineWidth) * dpr) / 2;
            const width2 = ((widths[i + 1] || this.config.lineWidth) * dpr) / 2;
            
            // 線セグメントを四角形として描画するための頂点を計算
            const segment = this.createLineSegment(p1, p2, width1, width2);
            vertices.push(...segment);
        }
        
        return vertices;
    }

    // 線セグメントを四角形として表現する頂点を生成（改善版）
    createLineSegment(p1, p2, width1, width2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        // 法線ベクトル（正規化済み）
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

    // 頂点シェーダー（改善版）
    getVertexShader() {
        return `
            attribute vec2 a_position;
            uniform mat3 u_projectionMatrix;
            
            void main() {
                vec3 pos = u_projectionMatrix * vec3(a_position, 1.0);
                gl_Position = vec4(pos.xy, 0.0, 1.0);
            }
        `;
    }

    // フラグメントシェーダー（改善版）
    getFragmentShader() {
        return `
            precision mediump float;
            uniform vec3 u_color;
            uniform float u_alpha;
            
            void main() {
                gl_FragColor = vec4(u_color, u_alpha);
            }
        `;
    }

    // 2D描画用の射影行列を生成（座標系修正）
    getProjectionMatrix() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 正規化デバイス座標系への変換行列
        // Y軸は反転させない（WebGLの座標系に合わせる）
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
            // 累積バッファもクリア
            this.allVertices = [];
            
            // キャンバスをクリア
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            
            console.log('Canvas cleared');
        } catch (error) {
            console.error('Failed to clear canvas:', error);
        }
    }

    // リソースを解放
    dispose() {
        try {
            console.log('Disposing OGL Rendering Engine...');
            
            // 累積バッファをクリア
            this.allVertices = [];
            
            // バッファを削除
            if (this.vertexBuffer) {
                this.gl.deleteBuffer(this.vertexBuffer);
                this.vertexBuffer = null;
            }
            
            // プログラムを削除
            if (this.program) {
                this.gl.deleteProgram(this.program);
                this.program = null;
            }
            
            this.gl = null;
            this.canvas = null;
            this.initialized = false;
            
            console.log('OGL Rendering Engine disposed successfully');
        } catch (error) {
            console.error('Failed to dispose OGL Rendering Engine:', error);
        }
    }

    // キャンバスサイズを更新
    resize(width, height) {
        if (!this.initialized || !this.canvas) return;
        
        try {
            const dpr = window.devicePixelRatio || 1;
            const pixelWidth = width * dpr;
            const pixelHeight = height * dpr;
            
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
            
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
            
            this.gl.viewport(0, 0, pixelWidth, pixelHeight);
            
            // リサイズ後に再描画
            if (this.allVertices.length > 0) {
                this.redrawAll();
            }
            
            console.log(`Canvas resized to ${pixelWidth}x${pixelHeight}`);
        } catch (error) {
            console.error('Failed to resize:', error);
        }
    }

    // 初期化状態を取得
    isInitialized() {
        return this.initialized && this.gl && this.program;
    }

    // 統計情報を取得
    getStats() {
        return {
            initialized: this.initialized,
            hasGL: !!this.gl,
            hasProgram: !!this.program,
            vertexCount: this.allVertices.length / 2,
            canvasSize: this.canvas ? {
                width: this.canvas.width,
                height: this.canvas.height
            } : null,
            config: { ...this.config }
        };
    }
}