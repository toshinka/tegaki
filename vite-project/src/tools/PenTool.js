// src/tools/PenTool.js - OGL統一ペンツール実装
// v5.2 OGL統一エンジン専用ペンツール

/**
 * OGL統一ペンツール
 * - OGL Polyline専用描画
 * - Canvas2D完全禁止
 * - Bezier.js依存排除
 * - 筆圧対応
 * - リアルタイム描画最適化
 */
export class PenTool {
    constructor(oglEngine) {
        console.log('✏️ OGL統一ペンツール構築開始...');
        
        this.oglEngine = oglEngine;
        this.toolId = 'pen';
        this.toolName = 'ペン';
        this.toolType = 'drawing';
        
        // OGL統一ペン設定
        this.config = {
            // OGL Polyline設定（憲章準拠）
            polyline: {
                lineWidth: 3,
                color: [0, 0, 0, 1], // RGBA (黒、不透明)
                smooth: true,
                join: 'round',
                cap: 'round',
                segments: 32 // 滑らかさ制御
            },
            
            // OGL描画設定
            shader: 'pen',
            blend: 'normal',
            renderMode: 'line',
            
            // 筆圧設定
            pressure: {
                enabled: true,
                minWidth: 1,
                maxWidth: 6,
                curve: 'linear' // linear, quadratic, cubic
            },
            
            // パフォーマンス設定
            performance: {
                smoothingDistance: 3.0, // ポイント間隔最小値
                maxPointsPerStroke: 10000, // 最大ポイント数
                realTimeOptimization: true
            }
        };
        
        // 現在のストローク状態
        this.currentStroke = null;
        this.isDrawing = false;
        this.strokePoints = [];
        this.lastPoint = null;
        this.totalDistance = 0;
        
        // OGLペン専用リソース
        this.penGeometry = null;
        this.penMaterial = null;
        this.penMesh = null;
        
        this.initialize();
        
        console.log('✏️ OGL統一ペンツール構築完了');
    }

    async initialize() {
        try {
            console.log('✏️ ペンツールOGL初期化開始...');
            
            // OGL統一エンジン接続確認
            if (!this.oglEngine) {
                throw new Error('OGL統一エンジンが未接続');
            }
            
            // OGLペン専用シェーダー初期化
            await this.initializePenShader();
            
            // OGLペン専用マテリアル初期化
            this.initializePenMaterial();
            
            console.log('✅ ペンツールOGL初期化完了');
            
        } catch (error) {
            console.error('❌ ペンツールOGL初期化エラー:', error);
            throw error;
        }
    }

    async initializePenShader() {
        // OGL統一ペン専用シェーダー定義
        const penVertexShader = `
            attribute vec3 position;
            attribute vec2 uv;
            attribute float pressure;
            
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float uLineWidth;
            uniform float uPressureScale;
            
            varying vec2 vUv;
            varying float vPressure;
            
            void main() {
                vUv = uv;
                vPressure = pressure;
                
                // 筆圧に基づく線幅調整
                float pressureWidth = uLineWidth * (1.0 + pressure * uPressureScale);
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = pressureWidth;
            }
        `;
        
        const penFragmentShader = `
            precision mediump float;
            
            uniform vec4 uColor;
            uniform float uOpacity;
            uniform float uSmoothness;
            
            varying vec2 vUv;
            varying float vPressure;
            
            void main() {
                // 円形ペン先効果
                vec2 center = vec2(0.5);
                float dist = distance(vUv, center);
                
                // 筆圧に基づく不透明度調整
                float pressureAlpha = mix(0.7, 1.0, vPressure);
                
                // スムージング（アンチエイリアス）
                float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                alpha *= pressureAlpha * uOpacity;
                
                gl_FragColor = vec4(uColor.rgb, alpha);
            }
        `;
        
        // OGLエンジンにシェーダー登録
        if (this.oglEngine.registerShader) {
            await this.oglEngine.registerShader('pen', {
                vertex: penVertexShader,
                fragment: penFragmentShader
            });
        }
        
        console.log('✅ OGLペンシェーダー初期化完了');
    }

    initializePenMaterial() {
        try {
            // OGL統一マテリアル設定
            this.penMaterialConfig = {
                uniforms: {
                    uColor: { value: [...this.config.polyline.color] },
                    uOpacity: { value: 1.0 },
                    uLineWidth: { value: this.config.polyline.lineWidth },
                    uPressureScale: { value: 0.5 },
                    uSmoothness: { value: 1.0 }
                },
                transparent: true,
                depthTest: false,
                depthWrite: false
            };
            
            console.log('✅ OGLペンマテリアル初期化完了');
            
        } catch (error) {
            console.error('❌ OGLペンマテリアル初期化エラー:', error);
            throw error;
        }
    }

    // === OGL統一描画メソッド ===
    
    /**
     * ストローク開始（OGL統一）
     */
    startStroke(x, y, pressure = 1.0) {
        console.log(`✏️ ペンストローク開始: (${x.toFixed(1)}, ${y.toFixed(1)}) 筆圧: ${pressure.toFixed(2)}`);
        
        try {
            // ストローク状態初期化
            this.isDrawing = true;
            this.strokePoints = [];
            this.lastPoint = { x, y, pressure, timestamp: Date.now() };
            this.totalDistance = 0;
            
            // 初期ポイント追加
            this.addStrokePoint(x, y, pressure);
            
            // OGL統一エンジンでストローク開始
            this.currentStroke = this.oglEngine.createStroke({
                tool: this.toolId,
                config: this.config,
                initialPoint: { x, y, pressure }
            });
            
            return this.currentStroke;
            
        } catch (error) {
            console.error('❌ ペンストローク開始エラー:', error);
            throw error;
        }
    }

    /**
     * ストローク継続（OGL統一）
     */
    continueStroke(x, y, pressure = 1.0) {
        if (!this.isDrawing || !this.currentStroke) {
            return;
        }

        try {
            const currentPoint = { x, y, pressure, timestamp: Date.now() };
            
            // スムージング距離チェック
            if (this.lastPoint) {
                const distance = this.calculateDistance(this.lastPoint, currentPoint);
                
                if (distance < this.config.performance.smoothingDistance) {
                    return; // 距離が近すぎる場合はスキップ
                }
                
                this.totalDistance += distance;
            }
            
            // ポイント追加
            this.addStrokePoint(x, y, pressure);
            
            // OGL統一エンジンでポイント追加
            this.oglEngine.addStrokePoint(this.currentStroke, {
                x, y, pressure,
                smoothed: true
            });
            
            // リアルタイム描画更新
            if (this.config.performance.realTimeOptimization) {
                this.oglEngine.updateStrokeRendering(this.currentStroke);
            }
            
            this.lastPoint = currentPoint;
            
        } catch (error) {
            console.error('❌ ペンストローク継続エラー:', error);
        }
    }

    /**
     * ストローク終了（OGL統一）
     */
    endStroke() {
        if (!this.isDrawing || !this.currentStroke) {
            return;
        }

        console.log(`✏️ ペンストローク終了: ${this.strokePoints.length}ポイント, 距離: ${this.totalDistance.toFixed(1)}px`);

        try {
            // ストローク最終化
            this.finalizeStroke();
            
            // OGL統一エンジンでストローク完了
            this.oglEngine.finalizeStroke(this.currentStroke, {
                points: this.strokePoints,
                totalDistance: this.totalDistance,
                smoothed: true
            });
            
            // ストローク状態リセット
            this.resetStrokeState();
            
        } catch (error) {
            console.error('❌ ペンストローク終了エラー:', error);
        }
    }

    // === ストローク処理ユーティリティ ===

    addStrokePoint(x, y, pressure) {
        // 最大ポイント数チェック
        if (this.strokePoints.length >= this.config.performance.maxPointsPerStroke) {
            console.warn('⚠️ ストロークポイント数上限到達');
            return;
        }

        // 筆圧調整
        const adjustedPressure = this.adjustPressure(pressure);
        
        const point = {
            x: x,
            y: y,
            pressure: adjustedPressure,
            width: this.calculateLineWidth(adjustedPressure),
            timestamp: Date.now()
        };
        
        this.strokePoints.push(point);
    }

    adjustPressure(rawPressure) {
        if (!this.config.pressure.enabled) {
            return 1.0;
        }
        
        // 筆圧カーブ適用
        switch (this.config.pressure.curve) {
            case 'quadratic':
                return Math.pow(rawPressure, 2);
            case 'cubic':
                return Math.pow(rawPressure, 3);
            case 'linear':
            default:
                return rawPressure;
        }
    }

    calculateLineWidth(pressure) {
        if (!this.config.pressure.enabled) {
            return this.config.polyline.lineWidth;
        }
        
        const { minWidth, maxWidth } = this.config.pressure;
        return minWidth + (maxWidth - minWidth) * pressure;
    }

    calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    finalizeStroke() {
        if (this.strokePoints.length < 2) {
            // 単一ポイントの場合は小さな円として処理
            if (this.strokePoints.length === 1) {
                const point = this.strokePoints[0];
                this.strokePoints.push({
                    ...point,
                    x: point.x + 0.1,
                    y: point.y + 0.1
                });
            }
        }
        
        // スムージング処理（OGL内蔵機能活用）
        if (this.config.polyline.smooth && this.strokePoints.length > 2) {
            this.strokePoints = this.applySmoothingToPoints(this.strokePoints);
        }
    }

    applySmoothingToPoints(points) {
        // OGL統一スムージング（シンプル移動平均）
        if (points.length < 3) return points;
        
        const smoothedPoints = [points[0]]; // 最初のポイントは保持
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const smoothed = {
                x: (prev.x + curr.x + next.x) / 3,
                y: (prev.y + curr.y + next.y) / 3,
                pressure: (prev.pressure + curr.pressure + next.pressure) / 3,
                width: (prev.width + curr.width + next.width) / 3,
                timestamp: curr.timestamp
            };
            
            smoothedPoints.push(smoothed);
        }
        
        smoothedPoints.push(points[points.length - 1]); // 最後のポイントは保持
        return smoothedPoints;
    }

    resetStrokeState() {
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokePoints = [];
        this.lastPoint = null;
        this.totalDistance = 0;
    }

    // === ツール設定更新 ===

    updateProperty(property, value) {
        console.log(`✏️ ペンプロパティ更新: ${property} = ${value}`);

        try {
            switch (property) {
                case 'size':
                    this.config.polyline.lineWidth = value;
                    this.config.pressure.maxWidth = value * 2;
                    break;
                    
                case 'opacity':
                    this.config.polyline.color[3] = value / 100;
                    break;
                    
                case 'color':
                    if (Array.isArray(value) && value.length >= 3) {
                        this.config.polyline.color = [
                            value[0], value[1], value[2], 
                            this.config.polyline.color[3] // アルファ値保持
                        ];
                    }
                    break;
                    
                case 'smoothness':
                    this.config.polyline.smooth = value > 0;
                    break;
                    
                default:
                    console.warn(`未対応ペンプロパティ: ${property}`);
            }
            
            // OGL統一エンジンに設定反映
            if (this.oglEngine && this.oglEngine.updateToolConfig) {
                this.oglEngine.updateToolConfig(this.toolId, this.config);
            }
            
        } catch (error) {
            console.error(`❌ ペンプロパティ更新エラー (${property}: ${value}):`, error);
        }
    }

    // === ツール情報取得 ===

    getToolInfo() {
        return {
            id: this.toolId,
            name: this.toolName,
            type: this.toolType,
            config: { ...this.config },
            isDrawing: this.isDrawing,
            currentStrokePoints: this.strokePoints.length,
            totalDistance: this.totalDistance
        };
    }

    getConfig() {
        return { ...this.config };
    }

    getCurrentSettings() {
        return {
            size: this.config.polyline.lineWidth,
            opacity: Math.round(this.config.polyline.color[3] * 100),
            color: [...this.config.polyline.color],
            smooth: this.config.polyline.smooth,
            pressureEnabled: this.config.pressure.enabled
        };
    }

    // === デバッグ用 ===

    getDebugInfo() {
        return {
            toolId: this.toolId,
            isDrawing: this.isDrawing,
            strokePoints: this.strokePoints.length,
            totalDistance: this.totalDistance,
            lastPoint: this.lastPoint,
            config: this.config,
            oglEngineConnected: !!this.oglEngine
        };
    }

    logStatus() {
        console.log('✏️ PenTool状態:', this.getDebugInfo());
    }

    // === 廃棄処理 ===

    dispose() {
        console.log('🧹 PenTool廃棄開始...');

        try {
            // 進行中のストロークを強制終了
            if (this.isDrawing) {
                this.endStroke();
            }
            
            // リソースクリア
            this.resetStrokeState();
            this.penGeometry = null;
            this.penMaterial = null;
            this.penMesh = null;
            
            // OGLエンジン参照クリア
            this.oglEngine = null;
            
            console.log('✅ PenTool廃棄完了');
            
        } catch (error) {
            console.error('❌ PenTool廃棄エラー:', error);
        }
    }
}

// === ペンツール設定定数 ===
export const PEN_TOOL_CONFIG = {
    id: 'pen',
    name: 'ペン',
    type: 'drawing',
    icon: 'pen',
    shortcut: 'P',
    
    // OGL統一設定
    oglConfig: {
        polyline: {
            lineWidth: 3,
            color: [0, 0, 0, 1],
            smooth: true,
            join: 'round',
            cap: 'round'
        },
        shader: 'pen',
        blend: 'normal',
        renderMode: 'line'
    },
    
    // プロパティ範囲
    properties: {
        size: { min: 1, max: 50, default: 3, step: 1 },
        opacity: { min: 1, max: 100, default: 100, step: 1 },
        smoothness: { min: 0, max: 10, default: 5, step: 1 }
    }
};

export default PenTool;