/**
 * BezierStrokeRenderer.js - WebGL2専用ベジェストロークレンダラー（修正版）
 */

export class BezierStrokeRenderer {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.gl = container.resolve('gl');
        this.programInfo = container.resolve('programInfo');
        
        // 描画状態
        this.isActive = false;
        this.settings = { size: 3, opacity: 1.0, color: '#800000' };
        this.currentStroke = [];
        
        // ストローク管理
        this.completedStrokes = [];
        this.strokeBuffers = new Map();
        
        this.initCanvas();
        console.log('✅ BezierStrokeRenderer初期化完了');
    }

    // ツールエンジン連動メソッド
    activate() {
        console.log('✅ ペンツール（WebGL2）アクティブ');
    }

    deactivate() {
        if (this.isActive) {
            this.endStroke();
        }
        console.log('⏹️ ペンツール非アクティブ');
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    // 描画制御
    handlePointerDown(pointerData) {
        this.isActive = true;
        this.currentStroke = [pointerData];
        this.scheduleRender();
    }

    handlePointerMove(pointerData) {
        if (!this.isActive) return;
        this.currentStroke.push(pointerData);
        this.scheduleRender();
    }

    handlePointerUp() {
        if (!this.isActive) return;
        this.endStroke();
        this.isActive = false;
    }

    endStroke() {
        if (this.currentStroke.length < 2) {
            this.currentStroke = [];
            return;
        }

        // ベジェ曲線生成（bezier-js不使用版）
        const bezierCurve = this.createBezierFromPoints(this.currentStroke);
        if (bezierCurve) {
            const strokeData = {
                id: Date.now(),
                bezier: bezierCurve,
                settings: { ...this.settings }
            };
            
            this.completedStrokes.push(strokeData);
            this.createStrokeBuffer(strokeData);
        }

        this.currentStroke = [];
        this.scheduleRender();
    }

    /**
     * 点群からベジェ曲線を生成（独自実装版）
     * bezier-jsが読み込まれていない場合のフォールバック
     */
    createBezierFromPoints(points) {
        if (points.length < 2) return null;
        
        // bezier-jsの可用性をチェック
        if (typeof window.Bezier === 'undefined') {
            console.warn('⚠️ bezier-jsが利用できません。簡易補間を使用します');
            return this.createSimpleInterpolation(points);
        }
        
        // bezier-jsを使用したベジェ曲線生成
        try {
            const segments = [];
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                
                // 4点制御点でベジェ曲線を作成
                const bezier = new window.Bezier(
                    p1.x, p1.y,
                    p1.x + (p2.x - p1.x) * 0.33, p1.y + (p2.y - p1.y) * 0.33,
                    p1.x + (p2.x - p1.x) * 0.67, p1.y + (p2.y - p1.y) * 0.67,
                    p2.x, p2.y
                );
                
                segments.push({ bezier, pressure1: p1.pressure, pressure2: p2.pressure });
            }
            
            return segments;
        } catch (error) {
            console.error('❌ Bezier.js エラー:', error);
            return this.createSimpleInterpolation(points);
        }
    }

    /**
     * 簡易線形補間（bezier-js非依存版）
     */
    createSimpleInterpolation(points) {
        const segments = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            // 簡易ベジェ風オブジェクト（線形補間）
            const pseudoBezier = {
                get: (t) => ({
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t
                })
            };
            
            segments.push({ 
                bezier: pseudoBezier, 
                pressure1: p1.pressure, 
                pressure2: p2.pressure 
            });
        }
        
        return segments;
    }

    /**
     * ストローク用WebGLバッファ作成
     */
    createStrokeBuffer(strokeData) {
        const vertices = this.bezierToVertices(strokeData);
        if (!vertices.positions.length) return;

        const arrays = {
            a_position: { numComponents: 2, data: vertices.positions },
            a_width: { numComponents: 1, data: vertices.widths },
            a_color: { numComponents: 4, data: vertices.colors }
        };

        const bufferInfo = window.twgl.createBufferInfoFromArrays(this.gl, arrays);
        this.strokeBuffers.set(strokeData.id, bufferInfo);
    }

    /**
     * ベジェ曲線を描画用頂点に変換
     */
    bezierToVertices(strokeData) {
        const positions = [];
        const widths = [];
        const colors = [];
        
        // chroma-jsの可用性をチェック
        let strokeColor;
        if (typeof window.chroma !== 'undefined') {
            strokeColor = window.chroma(strokeData.settings.color).gl();
            strokeColor[3] = strokeData.settings.opacity;
        } else {
            // フォールバック：16進数色を手動でRGBAに変換
            const hex = strokeData.settings.color.replace('#', '');
            strokeColor = [
                parseInt(hex.substr(0, 2), 16) / 255,
                parseInt(hex.substr(2, 2), 16) / 255,
                parseInt(hex.substr(4, 2), 16) / 255,
                strokeData.settings.opacity
            ];
        }

        for (const segment of strokeData.bezier) {
            const steps = 20; // 細分化レベル
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const point = segment.bezier.get(t);
                
                // 筆圧補間
                const pressure = segment.pressure1 + (segment.pressure2 - segment.pressure1) * t;
                const width = strokeData.settings.size * (0.5 + pressure * 0.5);
                
                positions.push(point.x, point.y);
                widths.push(width);
                colors.push(...strokeColor);
            }
        }

        return { positions, widths, colors };
    }

    /**
     * 描画実行
     */
    scheduleRender() {
        requestAnimationFrame(() => this.render());
    }

    render() {
        const gl = this.gl;
        
        // キャンバスサイズ調整
        window.twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 画面クリア
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // シェーダー使用
        gl.useProgram(this.programInfo.program);
        
        // ユニフォーム設定
        window.twgl.setUniforms(this.programInfo, {
            u_resolution: [gl.canvas.width, gl.canvas.height]
        });

        // 確定ストローク描画
        for (const [strokeId, bufferInfo] of this.strokeBuffers) {
            window.twgl.setBuffersAndAttributes(gl, this.programInfo, bufferInfo);
            window.twgl.drawBufferInfo(gl, bufferInfo, gl.POINTS);
        }

        // プレビュー描画
        if (this.isActive && this.currentStroke.length > 1) {
            this.renderPreview();
        }
    }

    /**
     * プレビュー描画
     */
    renderPreview() {
        const tempStroke = {
            id: 'preview',
            bezier: this.createBezierFromPoints(this.currentStroke),
            settings: this.settings
        };

        if (!tempStroke.bezier) return;

        const vertices = this.bezierToVertices(tempStroke);
        if (!vertices.positions.length) return;

        const arrays = {
            a_position: { numComponents: 2, data: vertices.positions },
            a_width: { numComponents: 1, data: vertices.widths },
            a_color: { numComponents: 4, data: vertices.colors }
        };

        // 一時バッファ作成・描画（twglに管理を委譲）
        const bufferInfo = window.twgl.createBufferInfoFromArrays(this.gl, arrays);
        window.twgl.setBuffersAndAttributes(this.gl, this.programInfo, bufferInfo);
        window.twgl.drawBufferInfo(this.gl, bufferInfo, this.gl.POINTS);
        // バッファは次のフレームでGCにより自動削除
    }

    /**
     * キャンバス初期化（DPR=1固定）
     */
    initCanvas() {
        const dpr = 1;
        const displayWidth = this.canvas.clientWidth * dpr;
        const displayHeight = this.canvas.clientHeight * dpr;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }

        console.log(`WebGLキャンバス初期化: ${displayWidth}x${displayHeight}`);
    }
}