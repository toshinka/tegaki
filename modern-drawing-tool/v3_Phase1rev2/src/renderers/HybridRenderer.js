// 🎨 統一レンダリングエンジン - WebGL優先・Canvas2D戦略併用
// 座標統一保証 + 高性能描画 + Phase2・3拡張対応

/**
 * 🚀 HybridRenderer - WebGL/Canvas2D統一レンダリングシステム
 * 
 * 【責務】
 * - WebGL優先の高性能レンダリング
 * - 戦略的Canvas2D併用（座標統一条件下）
 * - ベクターストロークの非破壊描画
 * - リアルタイム描画とキャッシュ管理
 * - Phase2・3機能の拡張ベース
 */
export class HybridRenderer {
    constructor(canvas, coordinateUnifier, eventStore) {
        this.canvas = canvas;
        this.coordinate = coordinateUnifier;
        this.eventStore = eventStore;

        // WebGL基盤初期化
        this.initializeWebGL();
        
        // Canvas2D遅延初期化（必要時のみ）
        this.canvas2dContext = null;
        
        // ストローク管理
        this.strokes = [];
        this.currentStroke = null;
        this.strokeBuffer = [];
        
        // 描画状態
        this.currentTool = 'pen';
        this.isRenderingEnabled = true;
        this.frameCount = 0;
        this.lastFPSCheck = Date.now();
        this.currentFPS = 60;
        
        // デバッグ機能
        this.debugMode = false;
        this.showCoordinateGrid = false;
        
        // Phase2・3拡張準備
        this.toolProcessor = null;        // 🔒Phase2解封
        this.vectorLayerProcessor = null; // 🔒Phase2解封
        this.offscreenProcessor = null;   // 🔒Phase3解封

        console.log('🎨 HybridRenderer初期化完了');
    }

    /**
     * 🔧 WebGL初期化
     */
    initializeWebGL() {
        // WebGLコンテキスト取得
        this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
        
        if (!this.gl) {
            console.warn('⚠️ WebGL不対応 - Canvas2Dフォールバック');
            this.webglUnavailable = true;
            return;
        }

        // 基本設定
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(240/255, 224/255, 214/255, 1.0); // ふたばクリーム背景
        
        // アルファブレンディング有効化
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // シェーダー初期化
        this.initializeShaders();
        
        // バッファ初期化
        this.initializeBuffers();

        console.log('🔧 WebGL初期化完了');
    }

    /**
     * 🎭 シェーダー初期化（基本線描画用）
     */
    initializeShaders() {
        // 頂点シェーダー（統一座標対応）
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute float a_pressure;
            uniform mat4 u_projection;
            uniform mat4 u_view;
            uniform float u_lineWidth;
            varying float v_pressure;
            
            void main() {
                gl_Position = u_projection * u_view * vec4(a_position, 0.0, 1.0);
                gl_PointSize = u_lineWidth * a_pressure;
                v_pressure = a_pressure;
            }
        `;

        // フラグメントシェーダー
        const fragmentShaderSource = `
            precision mediump float;
            uniform vec4 u_color;
            varying float v_pressure;
            
            void main() {
                float alpha = u_color.a * v_pressure;
                gl_FragColor = vec4(u_color.rgb, alpha);
            }
        `;

        // シェーダーコンパイル
        this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        
        // アトリビュート・ユニフォーム取得
        this.attributes = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            pressure: this.gl.getAttribLocation(this.program, 'a_pressure')
        };
        
        this.uniforms = {
            projection: this.gl.getUniformLocation(this.program, 'u_projection'),
            view: this.gl.getUniformLocation(this.program, 'u_view'),
            color: this.gl.getUniformLocation(this.program, 'u_color'),
            lineWidth: this.gl.getUniformLocation(this.program, 'u_lineWidth')
        };
    }

    /**
     * 🎨 シェーダープログラム作成
     */
    createShaderProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('シェーダープログラムリンクエラー:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }

    /**
     * 🔧 シェーダー作成
     */
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('シェーダーコンパイルエラー:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    /**
     * 📦 バッファ初期化
     */
    initializeBuffers() {
        // 頂点バッファ
        this.positionBuffer = this.gl.createBuffer();
        this.pressureBuffer = this.gl.createBuffer();
        
        // インデックスバッファ（線分用）
        this.indexBuffer = this.gl.createBuffer();
    }

    /**
     * 🖌️ ストローク開始
     */
    beginStroke(strokeData) {
        this.currentStroke = {
            ...strokeData,
            webglPoints: [],
            renderData: null
        };

        // 統一座標をWebGL座標に変換
        strokeData.points.forEach(point => {
            const webglPoint = this.coordinate.unifiedToWebGL(point.x, point.y);
            this.currentStroke.webglPoints.push(webglPoint);
        });

        // リアルタイム描画開始
        this.updateStrokeRenderData();
    }

    /**
     * 🖌️ ストローク更新
     */
    updateStroke(strokeData) {
        if (!this.currentStroke) return;

        // 新しい点をWebGL座標に変換して追加
        const lastIndex = this.currentStroke.webglPoints.length;
        const newPoints = strokeData.points.slice(lastIndex);
        
        newPoints.forEach(point => {
            const webglPoint = this.coordinate.unifiedToWebGL(point.x, point.y);
            this.currentStroke.webglPoints.push(webglPoint);
        });

        // レンダリングデータ更新
        this.updateStrokeRenderData();
        
        // リアルタイム描画
        this.renderCurrentStroke();
    }

    /**
     * 🖌️ ストローク確定
     */
    finalizeStroke(strokeData) {
        if (!this.currentStroke) return;

        // ストロークを確定リストに追加
        this.strokes.push({...this.currentStroke});
        
        // イベント通知
        this.eventStore.emit('render:stroke-finalized', {
            stroke: this.currentStroke,
            totalStrokes: this.strokes.length
        });

        this.currentStroke = null;
        
        // 全体再描画
        this.render();
    }

    /**
     * 📊 ストロークレンダリングデータ更新
     */
    updateStrokeRenderData() {
        if (!this.currentStroke || this.currentStroke.webglPoints.length < 2) return;

        const points = this.currentStroke.webglPoints;
        const positions = [];
        const pressures = [];
        const indices = [];

        // 点データ準備
        points.forEach((point, index) => {
            positions.push(point.x, point.y);
            pressures.push(point.pressure || 1.0);
        });

        // 線分インデックス準備
        for (let i = 0; i < points.length - 1; i++) {
            indices.push(i, i + 1);
        }

        this.currentStroke.renderData = {
            positions: new Float32Array(positions),
            pressures: new Float32Array(pressures),
            indices: new Uint16Array(indices)
        };
    }

    /**
     * 🎨 現在ストローク描画
     */
    renderCurrentStroke() {
        if (!this.currentStroke?.renderData || this.webglUnavailable) {
            // WebGL不可能時はCanvas2Dフォールバック
            this.renderCurrentStrokeCanvas2D();
            return;
        }

        const renderData = this.currentStroke.renderData;

        // WebGL描画
        this.gl.useProgram(this.program);

        // 投影マトリックス設定
        this.gl.uniformMatrix4fv(this.uniforms.projection, false, this.coordinate.getProjectionMatrix());
        
        // ビューマトリックス設定（アイデンティティ）
        const identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
        this.gl.uniformMatrix4fv(this.uniforms.view, false, identityMatrix);

        // ツール設定
        this.setToolUniforms();

        // 頂点データバッファ更新
        this.updateVertexBuffers(renderData);

        // 描画実行
        this.gl.drawElements(this.gl.LINES, renderData.indices.length, this.gl.UNSIGNED_SHORT, 0);
    }

    /**
     * 🎨 Canvas2Dフォールバック（座標統一保証）
     */
    renderCurrentStrokeCanvas2D() {
        if (!this.currentStroke) return;

        // Canvas2D遅延初期化
        if (!this.canvas2dContext) {
            this.canvas2dContext = this.canvas.getContext('2d');
        }

        const ctx = this.canvas2dContext;
        const points = this.currentStroke.points; // 統一座標を使用

        ctx.beginPath();
        ctx.strokeStyle = this.getToolColor();
        ctx.lineWidth = this.getToolWidth();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (points.length >= 2) {
            // 統一座標をCanvas2D座標に変換（実際はそのまま）
            const startPoint = this.coordinate.unifiedToCanvas2D(points[0].x, points[0].y);
            ctx.moveTo(startPoint.x, startPoint.y);

            for (let i = 1; i < points.length; i++) {
                const point = this.coordinate.unifiedToCanvas2D(points[i].x, points[i].y);
                ctx.lineTo(point.x, point.y);
            }
        }

        ctx.stroke();
    }

    /**
     * 🎛️ ツールユニフォーム設定
     */
    setToolUniforms() {
        // 色設定（Phase2でColorProcessor連携予定）
        const color = this.getToolColor();
        this.gl.uniform4f(this.uniforms.color, color.r, color.g, color.b, color.a);
        
        // 線幅設定
        this.gl.uniform1f(this.uniforms.lineWidth, this.getToolWidth());
    }

    /**
     * 🎨 ツール色取得（Phase2拡張予定）
     */
    getToolColor() {
        // Phase2でColorProcessor連携
        const defaultColors = {
            pen: { r: 0.5, g: 0, b: 0, a: 1.0 },      // 茶色（ふたば色）
            brush: { r: 0.67, g: 0.35, b: 0.34, a: 0.8 }, // 薄茶色
            eraser: { r: 0.94, g: 0.88, b: 0.84, a: 1.0 }  // 背景色
        };
        
        return defaultColors[this.currentTool] || defaultColors.pen;
    }

    /**
     * 📏 ツール幅取得（Phase2拡張予定）
     */
    getToolWidth() {
        // Phase2でToolProcessor連携
        const defaultWidths = {
            pen: 2.0,
            brush: 8.0,
            eraser: 16.0
        };
        
        return defaultWidths[this.currentTool] || defaultWidths.pen;
    }

    /**
     * 📦 頂点バッファ更新
     */
    updateVertexBuffers(renderData) {
        // 位置バッファ
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, renderData.positions, this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, 0, 0);

        // 筆圧バッファ
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pressureBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, renderData.pressures, this.gl.DYNAMIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.pressure);
        this.gl.vertexAttribPointer(this.attributes.pressure, 1, this.gl.FLOAT, false, 0, 0);

        // インデックスバッファ
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, renderData.indices, this.gl.DYNAMIC_DRAW);
    }

    /**
     * 🎨 メイン描画処理
     */
    render() {
        if (!this.isRenderingEnabled) return;

        // WebGL描画
        if (!this.webglUnavailable) {
            this.renderWebGL();
        } else {
            this.renderCanvas2D();
        }

        // デバッグ描画
        if (this.debugMode) {
            this.renderDebugInfo();
        }

        // FPS計測
        this.updateFPS();
    }

    /**
     * 🔧 WebGL全体描画
     */
    renderWebGL() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // 全ストローク描画
        this.strokes.forEach(stroke => {
            if (stroke.renderData) {
                this.renderStrokeWebGL(stroke);
            }
        });

        // 現在描画中ストローク
        if (this.currentStroke) {
            this.renderCurrentStroke();
        }

        // 座標グリッド（デバッグ時）
        if (this.showCoordinateGrid) {
            this.renderCoordinateGrid();
        }
    }

    /**
     * 🎨 個別ストロークWebGL描画
     */
    renderStrokeWebGL(stroke) {
        // ストローク用シェーダー設定
        this.gl.useProgram(this.program);
        
        // 投影・ビューマトリックス
        this.gl.uniformMatrix4fv(this.uniforms.projection, false, this.coordinate.getProjectionMatrix());
        const identityMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
        this.gl.uniformMatrix4fv(this.uniforms.view, false, identityMatrix);

        // ストローク固有設定
        const color = this.getStrokeColor(stroke);
        this.gl.uniform4f(this.uniforms.color, color.r, color.g, color.b, color.a);
        this.gl.uniform1f(this.uniforms.lineWidth, stroke.lineWidth || 2.0);

        // バッファ設定・描画
        this.updateVertexBuffers(stroke.renderData);
        this.gl.drawElements(this.gl.LINES, stroke.renderData.indices.length, this.gl.UNSIGNED_SHORT, 0);
    }

    /**
     * 🎨 Canvas2D全体描画
     */
    renderCanvas2D() {
        if (!this.canvas2dContext) {
            this.canvas2dContext = this.canvas.getContext('2d');
        }

        const ctx = this.canvas2dContext;
        
        // 背景クリア
        ctx.fillStyle = '#f0e0d6'; // ふたばクリーム
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 全ストローク描画
        this.strokes.forEach(stroke => {
            this.renderStrokeCanvas2D(stroke);
        });

        // 現在ストローク
        if (this.currentStroke) {
            this.renderCurrentStrokeCanvas2D();
        }
    }

    /**
     * 📊 ストローク色取得
     */
    getStrokeColor(stroke) {
        // ストローク固有色またはデフォルト
        return stroke.color || this.getToolColor();
    }

    /**
     * 📈 FPS更新
     */
    updateFPS() {
        this.frameCount++;
        const now = Date.now();
        
        if (now - this.lastFPSCheck >= 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSCheck = now;
        }
    }

    /**
     * 📊 FPS取得
     */
    getCurrentFPS() {
        return this.currentFPS;
    }

    /**
     * 🔧 キャンバスサイズ更新
     */
    updateCanvasSize(width, height) {
        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
        }
        
        console.log('📏 レンダラーサイズ更新:', { width, height });
    }

    /**
     * 🛠️ 現在ツール設定
     */
    setCurrentTool(tool) {
        this.currentTool = tool;
        console.log('🛠️ ツール変更:', tool);
    }

    /**
     * 📐 投影マトリックス更新
     */
    updateProjectionMatrix(projectionMatrix) {
        // WebGL描画時に使用される投影マトリックス更新
        console.log('📐 投影マトリックス更新');
    }

    /**
     * ⏪ アンドゥ処理
     */
    undoLastAction() {
        if (this.strokes.length > 0) {
            const removedStroke = this.strokes.pop();
            this.render();
            
            console.log('⏪ ストローク削除:', this.strokes.length);
        }
    }

    /**
     * ⏩ リドゥ処理（Phase2で実装予定）
     */
    redoLastAction() {
        // Phase2でHistoryControllerと連携
        console.log('⏩ リドゥ（Phase2実装予定）');
    }

    /**
     * 🐛 デバッグ情報描画
     */
    renderDebugInfo() {
        if (!this.canvas2dContext) {
            this.canvas2dContext = this.canvas.getContext('2d');
        }

        const ctx = this.canvas2dContext;
        ctx.fillStyle = 'rgba(128, 0, 0, 0.8)';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${this.currentFPS}`, 10, 20);
        ctx.fillText(`Strokes: ${this.strokes.length}`, 10, 35);
        ctx.fillText(`Tool: ${this.currentTool}`, 10, 50);
    }

    /**
     * 📐 座標グリッド描画
     */
    renderCoordinateGrid() {
        if (!this.canvas2dContext) return;

        const ctx = this.canvas2dContext;
        ctx.strokeStyle = 'rgba(128, 0, 0, 0.3)';
        ctx.lineWidth = 1;

        const gridSize = 50;
        
        // 縦線
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        // 横線
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }

    /**
     * 🔧 デバッグモード設定
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log('🐛 デバッグモード:', enabled ? '有効' : '無効');
    }

    /**
     * 📐 座標グリッド表示設定
     */
    setDebugGrid(enabled) {
        this.showCoordinateGrid = enabled;
        this.render();
    }

    // 🎨 Phase2拡張メソッド（解封時有効化）
    /*
    connectToolProcessor(toolProcessor) {           // 🔒Phase2解封
        this.toolProcessor = toolProcessor;
        console.log('🎨 ToolProcessor連携完了');
    }

    connectVectorLayerProcessor(vectorProcessor) {  // 🔒Phase2解封
        this.vectorLayerProcessor = vectorProcessor;
        console.log('📚 VectorLayerProcessor連携完了');
    }
    */

    // ⚡ Phase3拡張メソッド（解封時有効化）
    /*
    connectOffscreenProcessor(offscreenProcessor) { // 🔒Phase3解封
        this.offscreenProcessor = offscreenProcessor;
        console.log('⚡ OffscreenProcessor連携完了');
    }

    enableChromeFeatrues() {                        // 🔒Phase3解封
        // OffscreenCanvas・WebCodecs活用有効化
        console.log('⚡ Chrome API機能有効化');
    }
    */

    /**
     * 🗑️ リソース解放
     */
    destroy() {
        if (this.gl) {
            this.gl.deleteProgram(this.program);
            this.gl.deleteBuffer(this.positionBuffer);
            this.gl.deleteBuffer(this.pressureBuffer);
            this.gl.deleteBuffer(this.indexBuffer);
        }

        this.strokes = null;
        this.currentStroke = null;
        this.canvas2dContext = null;
        
        console.log('🗑️ HybridRenderer リソース解放完了');
    }
}