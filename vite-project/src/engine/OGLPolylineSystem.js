// src/engine/OGLPolylineSystem.js - OGL線描画システム
// v5.2 OGL統一 - Polyline専門システム

import { Polyline, Vec3, Color, Geometry, Program, Mesh } from 'https://cdnjs.cloudflare.com/ajax/libs/ogl/1.0.6/ogl.mjs';

// OGL専用シェーダー定義
const OGL_SHADERS = {
    pen: {
        vertex: `
            attribute vec3 position;
            attribute vec3 next;
            attribute vec3 prev;
            attribute vec2 uv;
            attribute float side;
            
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float uThickness;
            uniform vec2 uResolution;
            
            varying vec2 vUv;
            varying float vSide;
            
            void main() {
                vUv = uv;
                vSide = side;
                
                vec2 aspectCorrection = vec2(1.0, uResolution.x / uResolution.y);
                
                vec4 currentP = modelViewMatrix * vec4(position, 1.0);
                vec4 nextP = modelViewMatrix * vec4(next, 1.0);
                vec4 prevP = modelViewMatrix * vec4(prev, 1.0);
                
                vec2 currentScreen = currentP.xy * aspectCorrection;
                vec2 nextScreen = nextP.xy * aspectCorrection;
                vec2 prevScreen = prevP.xy * aspectCorrection;
                
                vec2 dir1 = normalize(currentScreen - prevScreen);
                vec2 dir2 = normalize(nextScreen - currentScreen);
                vec2 dir = normalize(dir1 + dir2);
                
                vec2 normal = vec2(-dir.y, dir.x);
                normal *= uThickness * 0.5 * side;
                normal.y *= uResolution.x / uResolution.y;
                
                vec4 offset = vec4(normal, 0.0, 0.0);
                gl_Position = projectionMatrix * (currentP + offset);
            }
        `,
        fragment: `
            precision mediump float;
            
            uniform vec4 uColor;
            uniform float uOpacity;
            
            varying vec2 vUv;
            varying float vSide;
            
            void main() {
                float alpha = uColor.a * uOpacity;
                
                // アンチエイリアシング
                float edge = abs(vSide);
                alpha *= 1.0 - smoothstep(0.8, 1.0, edge);
                
                gl_FragColor = vec4(uColor.rgb, alpha);
            }
        `
    },
    
    eraser: {
        vertex: `
            attribute vec3 position;
            attribute vec3 next;
            attribute vec3 prev;
            attribute vec2 uv;
            attribute float side;
            
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            uniform float uThickness;
            uniform vec2 uResolution;
            
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                
                vec2 aspectCorrection = vec2(1.0, uResolution.x / uResolution.y);
                
                vec4 currentP = modelViewMatrix * vec4(position, 1.0);
                vec4 nextP = modelViewMatrix * vec4(next, 1.0);
                vec4 prevP = modelViewMatrix * vec4(prev, 1.0);
                
                vec2 currentScreen = currentP.xy * aspectCorrection;
                vec2 nextScreen = nextP.xy * aspectCorrection;
                vec2 prevScreen = prevP.xy * aspectCorrection;
                
                vec2 dir1 = normalize(currentScreen - prevScreen);
                vec2 dir2 = normalize(nextScreen - currentScreen);
                vec2 dir = normalize(dir1 + dir2);
                
                vec2 normal = vec2(-dir.y, dir.x);
                normal *= uThickness * 0.5 * side;
                normal.y *= uResolution.x / uResolution.y;
                
                vec4 offset = vec4(normal, 0.0, 0.0);
                gl_Position = projectionMatrix * (currentP + offset);
            }
        `,
        fragment: `
            precision mediump float;
            
            uniform vec4 uColor;
            
            varying vec2 vUv;
            
            void main() {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // 透明で消去
            }
        `
    }
};

export class OGLPolylineSystem {
    constructor(renderer) {
        console.log('📐 OGLPolylineSystem構築開始...');
        
        this.renderer = renderer;
        this.gl = renderer.gl;
        
        // OGL統一制御
        this.activePolylines = new Map();
        this.programs = new Map();
        this.currentConfig = null;
        
        // パフォーマンス設定
        this.maxPointsPerStroke = 10000;
        this.simplificationThreshold = 2.0; // ピクセル
        
        this.initializePrograms();
        
        console.log('✅ OGLPolylineSystem構築完了');
    }

    initializePrograms() {
        console.log('🎨 OGLシェーダープログラム初期化...');
        
        try {
            // ペン用プログラム
            this.programs.set('pen', new Program(this.gl, {
                vertex: OGL_SHADERS.pen.vertex,
                fragment: OGL_SHADERS.pen.fragment,
                uniforms: {
                    uThickness: { value: 3.0 },
                    uColor: { value: new Color(0, 0, 0, 1) },
                    uOpacity: { value: 1.0 },
                    uResolution: { value: [this.renderer.width, this.renderer.height] }
                }
            }));

            // 消しゴム用プログラム
            this.programs.set('eraser', new Program(this.gl, {
                vertex: OGL_SHADERS.eraser.vertex,
                fragment: OGL_SHADERS.eraser.fragment,
                uniforms: {
                    uThickness: { value: 10.0 },
                    uColor: { value: new Color(1, 1, 1, 1) },
                    uResolution: { value: [this.renderer.width, this.renderer.height] }
                },
                transparent: true,
                blendFunc: [this.gl.ZERO, this.gl.ONE_MINUS_SRC_ALPHA]
            }));

            console.log('✅ OGLシェーダープログラム初期化完了');
            
        } catch (error) {
            console.error('❌ シェーダープログラム初期化エラー:', error);
            throw error;
        }
    }

    // === OGL統一ポリライン作成 ===
    createPolyline(strokeId, initialPoints, config) {
        console.log(`📐 OGLポリライン作成: ${strokeId}, 点数=${initialPoints.length}`);
        
        try {
            // 点データの前処理
            const processedPoints = this.preprocessPoints(initialPoints);
            
            if (processedPoints.length < 2) {
                // 1点の場合は小さな線分として処理
                processedPoints.push({
                    x: processedPoints[0].x + 0.1,
                    y: processedPoints[0].y,
                    pressure: processedPoints[0].pressure
                });
            }

            // OGLジオメトリ作成
            const geometry = this.createPolylineGeometry(processedPoints);
            
            // プログラム取得
            const program = this.programs.get(config.tool);
            if (!program) {
                throw new Error(`未知のツール: ${config.tool}`);
            }

            // ユニフォーム更新
            this.updateProgramUniforms(program, config);

            // OGLメッシュ作成
            const mesh = new Mesh(geometry, program);
            
            // ポリライン情報保存
            const polylineData = {
                id: strokeId,
                mesh: mesh,
                geometry: geometry,
                program: program,
                points: [...processedPoints],
                config: { ...config },
                created: Date.now()
            };

            this.activePolylines.set(strokeId, polylineData);

            console.log(`✅ OGLポリライン作成完了: ${strokeId}`);
            return mesh;

        } catch (error) {
            console.error(`❌ ポリライン作成エラー (${strokeId}):`, error);
            throw error;
        }
    }

    // === ポリライン更新 ===
    updatePolyline(strokeId, newPoints) {
        const polylineData = this.activePolylines.get(strokeId);
        if (!polylineData) {
            console.warn(`⚠️ 存在しないポリライン: ${strokeId}`);
            return;
        }

        try {
            // 点データ更新
            const processedPoints = this.preprocessPoints(newPoints);
            polylineData.points = processedPoints;

            // ジオメトリ更新
            this.updatePolylineGeometry(polylineData.geometry, processedPoints);

            console.log(`📐 ポリライン更新: ${strokeId}, 点数=${processedPoints.length}`);

        } catch (error) {
            console.error(`❌ ポリライン更新エラー (${strokeId}):`, error);
        }
    }

    // === ジオメトリ作成（OGL統一） ===
    createPolylineGeometry(points) {
        const vertexCount = (points.length - 1) * 6; // 各セグメント = 2三角形 = 6頂点
        
        // 属性配列準備
        const positions = new Float32Array(vertexCount * 3);
        const nexts = new Float32Array(vertexCount * 3);
        const prevs = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const sides = new Float32Array(vertexCount);
        const indices = new Uint16Array((points.length - 1) * 6);

        let vertexIndex = 0;
        let indexIndex = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const prev = i > 0 ? points[i - 1] : current;
            const nextNext = i < points.length - 2 ? points[i + 2] : next;

            // 各セグメントの6頂点を作成
            for (let j = 0; j < 6; j++) {
                const isStart = j < 3;
                const point = isStart ? current : next;
                const nextPoint = isStart ? next : nextNext;
                const prevPoint = isStart ? prev : current;

                // Position
                positions[vertexIndex * 3] = point.x;
                positions[vertexIndex * 3 + 1] = point.y;
                positions[vertexIndex * 3 + 2] = 0;

                // Next
                nexts[vertexIndex * 3] = nextPoint.x;
                nexts[vertexIndex * 3 + 1] = nextPoint.y;
                nexts[vertexIndex * 3 + 2] = 0;

                // Prev
                prevs[vertexIndex * 3] = prevPoint.x;
                prevs[vertexIndex * 3 + 1] = prevPoint.y;
                prevs[vertexIndex * 3 + 2] = 0;

                // UV
                uvs[vertexIndex * 2] = isStart ? 0 : 1;
                uvs[vertexIndex * 2 + 1] = (j % 3 === 0) ? -1 : ((j % 3 === 1) ? 1 : (j === 2 ? -1 : 1));

                // Side (線の太さ方向)
                sides[vertexIndex] = uvs[vertexIndex * 2 + 1];

                vertexIndex++;
            }

            // インデックス設定（2つの三角形）
            const baseIndex = i * 6;
            
            // 最初の三角形
            indices[indexIndex++] = baseIndex;
            indices[indexIndex++] = baseIndex + 1;
            indices[indexIndex++] = baseIndex + 2;
            
            // 2番目の三角形
            indices[indexIndex++] = baseIndex + 3;
            indices[indexIndex++] = baseIndex + 4;
            indices[indexIndex++] = baseIndex + 5;
        }

        // OGLジオメトリ作成
        const geometry = new Geometry(this.gl, {
            position: { size: 3, data: positions },
            next: { size: 3, data: nexts },
            prev: { size: 3, data: prevs },
            uv: { size: 2, data: uvs },
            side: { size: 1, data: sides },
            index: { data: indices }
        });

        return geometry;
    }

    updatePolylineGeometry(geometry, points) {
        // 新しいジオメトリデータを生成
        const vertexCount = (points.length - 1) * 6;
        
        if (geometry.attributes.position.data.length !== vertexCount * 3) {
            // サイズが変わった場合は新しい配列を作成
            const positions = new Float32Array(vertexCount * 3);
            const nexts = new Float32Array(vertexCount * 3);
            const prevs = new Float32Array(vertexCount * 3);
            const uvs = new Float32Array(vertexCount * 2);
            const sides = new Float32Array(vertexCount);
            
            // データ更新
            this.fillGeometryData(points, positions, nexts, prevs, uvs, sides);
            
            // 属性更新
            geometry.attributes.position.data = positions;
            geometry.attributes.next.data = nexts;
            geometry.attributes.prev.data = prevs;
            geometry.attributes.uv.data = uvs;
            geometry.attributes.side.data = sides;
        } else {
            // サイズが同じ場合は既存配列を更新
            this.fillGeometryData(
                points,
                geometry.attributes.position.data,
                geometry.attributes.next.data,
                geometry.attributes.prev.data,
                geometry.attributes.uv.data,
                geometry.attributes.side.data
            );
        }

        // 更新フラグ設定
        Object.values(geometry.attributes).forEach(attr => {
            attr.needsUpdate = true;
        });
    }

    fillGeometryData(points, positions, nexts, prevs, uvs, sides) {
        let vertexIndex = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const prev = i > 0 ? points[i - 1] : current;
            const nextNext = i < points.length - 2 ? points[i + 2] : next;

            for (let j = 0; j < 6; j++) {
                const isStart = j < 3;
                const point = isStart ? current : next;
                const nextPoint = isStart ? next : nextNext;
                const prevPoint = isStart ? prev : current;

                positions[vertexIndex * 3] = point.x;
                positions[vertexIndex * 3 + 1] = point.y;
                positions[vertexIndex * 3 + 2] = 0;

                nexts[vertexIndex * 3] = nextPoint.x;
                nexts[vertexIndex * 3 + 1] = nextPoint.y;
                nexts[vertexIndex * 3 + 2] = 0;

                prevs[vertexIndex * 3] = prevPoint.x;
                prevs[vertexIndex * 3 + 1] = prevPoint.y;
                prevs[vertexIndex * 3 + 2] = 0;

                uvs[vertexIndex * 2] = isStart ? 0 : 1;
                uvs[vertexIndex * 2 + 1] = (j % 3 === 0) ? -1 : ((j % 3 === 1) ? 1 : (j === 2 ? -1 : 1));

                sides[vertexIndex] = uvs[vertexIndex * 2 + 1];

                vertexIndex++;
            }
        }
    }

    // === ユーティリティ ===
    preprocessPoints(rawPoints) {
        if (!rawPoints || rawPoints.length === 0) return [];

        // 点の簡略化（パフォーマンス向上）
        const simplified = this.simplifyPoints(rawPoints);
        
        // 筆圧の正規化
        return simplified.map(point => ({
            x: point.x,
            y: point.y,
            pressure: Math.max(0.1, Math.min(1.0, point.pressure || 1.0))
        }));
    }

    simplifyPoints(points) {
        if (points.length <= 2) return points;

        const simplified = [points[0]];
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const current = points[i];
            
            const distance = Math.sqrt(
                Math.pow(current.x - prev.x, 2) + 
                Math.pow(current.y - prev.y, 2)
            );
            
            if (distance >= this.simplificationThreshold) {
                simplified.push(current);
            }
        }
        
        simplified.push(points[points.length - 1]);
        return simplified;
    }

    updateProgramUniforms(program, config) {
        if (!program || !config) return;

        const uniforms = program.uniforms;
        
        if (uniforms.uThickness) {
            uniforms.uThickness.value = config.polyline.lineWidth;
        }
        
        if (uniforms.uColor) {
            const color = config.polyline.color;
            uniforms.uColor.value = new Color(color[0], color[1], color[2], color[3]);
        }
        
        if (uniforms.uOpacity) {
            uniforms.uOpacity.value = config.polyline.color[3];
        }
        
        if (uniforms.uResolution) {
            uniforms.uResolution.value = [this.renderer.width, this.renderer.height];
        }
    }

    // === 設定更新 ===
    setToolConfig(config) {
        this.currentConfig = config;
        
        // 既存ポリラインの設定更新
        this.activePolylines.forEach(polylineData => {
            if (polylineData.program) {
                this.updateProgramUniforms(polylineData.program, { 
                    polyline: config,
                    tool: polylineData.config.tool 
                });
            }
        });
    }

    // === クリーンアップ ===
    removePolyline(strokeId) {
        const polylineData = this.activePolylines.get(strokeId);
        if (polylineData) {
            // ジオメトリのクリーンアップ
            if (polylineData.geometry) {
                // WebGLリソース解放
                Object.values(polylineData.geometry.attributes).forEach(attr => {
                    if (attr.buffer) {
                        this.gl.deleteBuffer(attr.buffer);
                    }
                });
            }
            
            this.activePolylines.delete(strokeId);
            console.log(`🗑️ ポリライン削除: ${strokeId}`);
        }
    }

    dispose() {
        console.log('🧹 OGLPolylineSystem廃棄開始...');

        try {
            // 全ポリライン削除
            this.activePolylines.forEach((_, strokeId) => {
                this.removePolyline(strokeId);
            });

            // プログラム廃棄
            this.programs.forEach(program => {
                if (program.program) {
                    this.gl.deleteProgram(program.program);
                }
            });
            this.programs.clear();

            console.log('✅ OGLPolylineSystem廃棄完了');

        } catch (error) {
            console.error('❌ OGLPolylineSystem廃棄エラー:', error);
        }
    }

    // === デバッグ ===
    getDebugInfo() {
        return {
            activePolylines: this.activePolylines.size,
            programs: this.programs.size,
            currentConfig: this.currentConfig,
            maxPointsPerStroke: this.maxPointsPerStroke,
            simplificationThreshold: this.simplificationThreshold
        };
    }
}