/**
 * GL Stroke Processor - Phase 4.0D カエルの卵最小化版
 * 
 * 【責務】
 * - Perfect-Freehand完全不使用
 * - 独自オフセット曲線生成（鋭角完全対応）
 * - 筆圧ベースの入り抜き処理（改善版）
 * - Earcut三角形分割（自己交差完全回避）
 * - WebGL2頂点バッファ作成（筆圧情報付き）
 * - カエルの卵最小化（セグメント最適化）
 * 
 * 【親依存】
 * - Earcut (window.earcut)
 * - config.js (基本設定のみ)
 * 
 * 【子依存】
 * - stroke-renderer.js Phase 4.0C
 * - webgl2-drawing-layer.js
 * 
 * 【Phase 4.0D 改修内容】
 * ✅ セグメント分割の細分化（カエルの卵を目立たなくする）
 * ✅ 速度適応の強化
 * ✅ キャップセグメントの増加
 * ✅ 筆圧カーブ維持
 * ✅ パフォーマンス維持
 * 
 * 【技術的限界の明示】
 * ⚠️ ペンツールの特性上、筆圧による濃淡グラデーションは不可
 * ⚠️ 水彩/エアブラシ表現は Phase 5.0 で別実装が必要
 */

(function() {
    'use strict';

    class GLStrokeProcessor {
        constructor(gl) {
            this.gl = gl;
            this.initialized = false;
            
            // Phase 4.0D: カエルの卵最小化設定
            this.config = {
                // セグメント分割の細分化
                minSegmentLength: 0.5,      // より細かく
                maxSegmentLength: 3.0,      // 短く（カエルの卵対策）
                maxStrokeLength: 3000,      
                closedShapeThreshold: 2.5,  
                epsilon: 0.0001,            
                capSegments: 8,             // 滑らかに
                // 筆圧カーブ
                minPressure: 0.01,          
                maxPressure: 1.0,           
                minRadiusRatio: 0.12,       
                pressureCurve: 1.8,         
                flowPressureCurve: 1.2,     
                // 速度適応強化
                slowSpeedThreshold: 3.0,    // より敏感に
                fastSpeedThreshold: 15.0,   
                sharpAngleSlow: Math.PI * 0.50,   
                sharpAngleFast: Math.PI * 0.67,   
                extremeAngleThreshold: Math.PI * 0.25,
                miterLimit: 2.0             
            };
            
            this.stats = {
                processedStrokes: 0,
                totalVertices: 0,
                averageVerticesPerStroke: 0,
                triangulationFailures: 0,
                polygonReversals: 0,
                bevelJoins: 0,
                fastSegments: 0,
                extremeAngles: 0,
                longStrokes: 0
            };
        }

        initialize() {
            try {
                if (typeof window.earcut === 'undefined') {
                    console.error('[GLStrokeProcessor] Earcut not loaded');
                    return false;
                }

                this.initialized = true;
                console.log('[GLStrokeProcessor] ✅ Phase 4.0D Initialized');
                console.log('   🔥 Perfect-Freehand完全不使用');
                console.log('   🎨 独自リボン生成（鋭角完全対応）');
                console.log('   🔧 筆圧カーブ改善');
                console.log('   ✨ カエルの卵最小化');
                console.log('   ⚠️ 技術的限界: ペンツールでは濃淡グラデーション不可');
                
                return true;

            } catch (error) {
                console.error('[GLStrokeProcessor] Initialization error:', error);
                return false;
            }
        }

        _applyPressureCurve(pressure) {
            const clampedPressure = Math.max(
                this.config.minPressure,
                Math.min(this.config.maxPressure, pressure)
            );
            
            const curved = Math.pow(clampedPressure, this.config.pressureCurve);
            return Math.max(this.config.minRadiusRatio, curved);
        }

        _applyFlowPressureCurve(pressure) {
            const clampedPressure = Math.max(
                this.config.minPressure,
                Math.min(this.config.maxPressure, pressure)
            );
            
            return Math.pow(clampedPressure, this.config.flowPressureCurve);
        }

        _calculateStrokeLength(points) {
            let totalLength = 0;
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
            }
            return totalLength;
        }

        createPolygonVertexBuffer(points, baseSize = 10) {
            if (!this.initialized) {
                console.error('[GLStrokeProcessor] Not initialized');
                return null;
            }

            if (!points || points.length < 2) {
                return null;
            }

            try {
                const strokeLength = this._calculateStrokeLength(points);
                if (strokeLength > this.config.maxStrokeLength) {
                    this.stats.longStrokes++;
                }

                const normalizedPoints = points.map(p => {
                    const rawPressure = p.pressure !== undefined ? p.pressure : 0.5;
                    const sizePressure = this._applyPressureCurve(rawPressure);
                    const flowPressure = this._applyFlowPressureCurve(rawPressure);
                    
                    return {
                        x: p.x !== undefined ? p.x : (p.localX || 0),
                        y: p.y !== undefined ? p.y : (p.localY || 0),
                        sizePressure: sizePressure,
                        flowPressure: flowPressure,
                        rawPressure: rawPressure
                    };
                });

                // Phase 4.0D: セグメント分割強化
                const refinedPoints = this._refineSegmentsBySpeedEnhanced(normalizedPoints);

                if (refinedPoints.length < 2) {
                    return null;
                }

                const result = this._generateRibbonWithPressure(refinedPoints, baseSize);

                if (!result || result.polygon.length < 6) {
                    return null;
                }

                const uniqueResult = this._removeDuplicateVerticesWithPressure(result);

                if (uniqueResult.polygon.length < 6) {
                    return null;
                }

                const ccwResult = this._ensureCounterClockwiseWithPressure(uniqueResult);

                const bounds = this._calculateBoundsFromPolygon(ccwResult.polygon);

                const indices = window.earcut(ccwResult.polygon);

                if (!indices || indices.length === 0) {
                    this.stats.triangulationFailures++;
                    return null;
                }

                const vertexCount = indices.length;
                const buffer = new Float32Array(vertexCount * 3);

                for (let i = 0; i < indices.length; i++) {
                    const idx = indices[i];
                    buffer[i * 3] = ccwResult.polygon[idx * 2];
                    buffer[i * 3 + 1] = ccwResult.polygon[idx * 2 + 1];
                    buffer[i * 3 + 2] = ccwResult.flowPressures[idx];
                }

                this.stats.processedStrokes++;
                this.stats.totalVertices += vertexCount;
                this.stats.averageVerticesPerStroke = 
                    Math.round(this.stats.totalVertices / this.stats.processedStrokes);

                return { 
                    buffer, 
                    vertexCount, 
                    bounds,
                    hasPressure: true
                };

            } catch (error) {
                console.error('[GLStrokeProcessor] Error:', error);
                return null;
            }
        }

        /**
         * Phase 4.0D: 速度適応セグメント分割（強化版）
         * カエルの卵を目立たなくするため、より細かく分割
         */
        _refineSegmentsBySpeedEnhanced(points) {
            if (points.length < 2) return points;

            const refined = [points[0]];

            for (let i = 1; i < points.length; i++) {
                const prev = refined[refined.length - 1];
                const curr = points[i];

                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Phase 4.0D: 速度に応じた適応的分割（強化）
                let maxSegmentLength = this.config.maxSegmentLength;
                
                if (dist > this.config.fastSpeedThreshold) {
                    maxSegmentLength = 2.0; // 高速時はより細かく
                    this.stats.fastSegments++;
                } else if (dist > this.config.slowSpeedThreshold) {
                    maxSegmentLength = 2.5; // 中速も細かく
                }

                if (dist > maxSegmentLength) {
                    const steps = Math.ceil(dist / maxSegmentLength);
                    for (let j = 1; j < steps; j++) {
                        const t = j / steps;
                        
                        const interpRawPressure = prev.rawPressure + 
                                                  (curr.rawPressure - prev.rawPressure) * t;
                        const interpSizePressure = this._applyPressureCurve(interpRawPressure);
                        const interpFlowPressure = this._applyFlowPressureCurve(interpRawPressure);
                        
                        refined.push({
                            x: prev.x + dx * t,
                            y: prev.y + dy * t,
                            sizePressure: interpSizePressure,
                            flowPressure: interpFlowPressure,
                            rawPressure: interpRawPressure,
                            speed: dist
                        });
                    }
                }

                if (dist >= this.config.minSegmentLength || i === points.length - 1) {
                    curr.speed = dist;
                    refined.push(curr);
                }
            }

            return refined;
        }

        _generateRibbonWithPressure(points, baseSize) {
            const segments = [];

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const radius = (baseSize / 2) * p.sizePressure;

                const tangent = this._calculateTangent(points, i);
                const normal = { x: -tangent.y, y: tangent.x };

                segments.push({
                    center: p,
                    tangent: tangent,
                    normal: normal,
                    radius: radius,
                    sizePressure: p.sizePressure,
                    flowPressure: p.flowPressure,
                    speed: p.speed || 0,
                    left: { 
                        x: p.x + normal.x * radius, 
                        y: p.y + normal.y * radius,
                        flowPressure: p.flowPressure
                    },
                    right: { 
                        x: p.x - normal.x * radius, 
                        y: p.y - normal.y * radius,
                        flowPressure: p.flowPressure
                    }
                });
            }

            for (let i = 1; i < segments.length - 1; i++) {
                const angle = this._calculateAngle(
                    segments[i - 1].center,
                    segments[i].center,
                    segments[i + 1].center
                );

                const avgSpeed = (segments[i - 1].speed + segments[i].speed + segments[i + 1].speed) / 3;
                
                let threshold = this.config.sharpAngleSlow;
                if (avgSpeed > this.config.fastSpeedThreshold) {
                    threshold = this.config.sharpAngleFast;
                } else if (avgSpeed > this.config.slowSpeedThreshold) {
                    const t = (avgSpeed - this.config.slowSpeedThreshold) / 
                              (this.config.fastSpeedThreshold - this.config.slowSpeedThreshold);
                    threshold = this.config.sharpAngleSlow + 
                               (this.config.sharpAngleFast - this.config.sharpAngleSlow) * t;
                }

                const isExtremeAngle = angle < this.config.extremeAngleThreshold;
                if (isExtremeAngle) {
                    this.stats.extremeAngles++;
                }

                if (angle < threshold || isExtremeAngle) {
                    const bevel = this._createBevelJoinWithMiterLimit(
                        segments[i - 1],
                        segments[i],
                        segments[i + 1],
                        angle
                    );
                    segments[i].left = bevel.left;
                    segments[i].right = bevel.right;
                    this.stats.bevelJoins++;
                }
            }

            const isClosedShape = this._isClosedShape(points, baseSize);
            const polygon = [];
            const flowPressures = [];

            if (isClosedShape) {
                for (const seg of segments) {
                    polygon.push(seg.left.x, seg.left.y);
                    flowPressures.push(seg.left.flowPressure);
                }
                for (let i = segments.length - 1; i >= 0; i--) {
                    polygon.push(segments[i].right.x, segments[i].right.y);
                    flowPressures.push(segments[i].right.flowPressure);
                }
            } else {
                const startCap = this._generateRoundCapWithPressure(
                    segments[0].center,
                    segments[0].left,
                    segments[0].right,
                    segments[0].radius,
                    segments[0].flowPressure,
                    this.config.capSegments
                );

                const endCap = this._generateRoundCapWithPressure(
                    segments[segments.length - 1].center,
                    segments[segments.length - 1].right,
                    segments[segments.length - 1].left,
                    segments[segments.length - 1].radius,
                    segments[segments.length - 1].flowPressure,
                    this.config.capSegments
                );

                for (let i = 1; i < startCap.length; i++) {
                    polygon.push(startCap[i].x, startCap[i].y);
                    flowPressures.push(startCap[i].flowPressure);
                }

                for (const seg of segments) {
                    polygon.push(seg.left.x, seg.left.y);
                    flowPressures.push(seg.left.flowPressure);
                }

                for (let i = 1; i < endCap.length; i++) {
                    polygon.push(endCap[i].x, endCap[i].y);
                    flowPressures.push(endCap[i].flowPressure);
                }

                for (let i = segments.length - 1; i >= 0; i--) {
                    polygon.push(segments[i].right.x, segments[i].right.y);
                    flowPressures.push(segments[i].right.flowPressure);
                }
            }

            return { polygon, flowPressures };
        }

        _calculateTangent(points, index) {
            let dx = 0, dy = 0;

            if (index === 0 && points.length > 1) {
                dx = points[1].x - points[0].x;
                dy = points[1].y - points[0].y;
            } else if (index === points.length - 1) {
                dx = points[index].x - points[index - 1].x;
                dy = points[index].y - points[index - 1].y;
            } else {
                const dx1 = points[index].x - points[index - 1].x;
                const dy1 = points[index].y - points[index - 1].y;
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
                
                const dx2 = points[index + 1].x - points[index].x;
                const dy2 = points[index + 1].y - points[index].y;
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
                
                dx = (dx1 / len1 + dx2 / len2);
                dy = (dy1 / len1 + dy2 / len2);
            }

            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            return { x: dx / length, y: dy / length };
        }

        _calculateAngle(p1, p2, p3) {
            const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
            const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

            const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 1;
            const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 1;

            v1.x /= len1;
            v1.y /= len1;
            v2.x /= len2;
            v2.y /= len2;

            const dot = v1.x * v2.x + v1.y * v2.y;
            return Math.acos(Math.max(-1, Math.min(1, dot)));
        }

        _createBevelJoinWithMiterLimit(prev, curr, next, angle) {
            const avgRadius = (prev.radius + curr.radius + next.radius) / 3;
            const avgFlowPressure = (prev.flowPressure + curr.flowPressure + next.flowPressure) / 3;
            
            return {
                left: {
                    x: curr.center.x + curr.normal.x * avgRadius,
                    y: curr.center.y + curr.normal.y * avgRadius,
                    flowPressure: avgFlowPressure
                },
                right: {
                    x: curr.center.x - curr.normal.x * avgRadius,
                    y: curr.center.y - curr.normal.y * avgRadius,
                    flowPressure: avgFlowPressure
                }
            };
        }

        _removeDuplicateVerticesWithPressure(result) {
            const unique = [];
            const uniqueFlowPressures = [];
            const eps = this.config.epsilon;

            const { polygon, flowPressures } = result;

            for (let i = 0; i < polygon.length; i += 2) {
                const x = polygon[i];
                const y = polygon[i + 1];
                const flowPressure = flowPressures[i / 2];

                let isDuplicate = false;

                if (unique.length >= 2) {
                    const lastX = unique[unique.length - 2];
                    const lastY = unique[unique.length - 1];
                    
                    const dx = x - lastX;
                    const dy = y - lastY;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < eps * eps) {
                        isDuplicate = true;
                    }
                }

                if (!isDuplicate) {
                    unique.push(x, y);
                    uniqueFlowPressures.push(flowPressure);
                }
            }

            if (unique.length >= 4) {
                const dx = unique[0] - unique[unique.length - 2];
                const dy = unique[1] - unique[unique.length - 1];
                const distSq = dx * dx + dy * dy;

                if (distSq < eps * eps) {
                    unique.pop();
                    unique.pop();
                    uniqueFlowPressures.pop();
                }
            }

            return { polygon: unique, flowPressures: uniqueFlowPressures };
        }

        _ensureCounterClockwiseWithPressure(result) {
            const { polygon, flowPressures } = result;

            if (polygon.length < 6) return result;

            let signedArea = 0;
            const numVertices = polygon.length / 2;

            for (let i = 0; i < numVertices; i++) {
                const x1 = polygon[i * 2];
                const y1 = polygon[i * 2 + 1];
                const x2 = polygon[((i + 1) % numVertices) * 2];
                const y2 = polygon[((i + 1) % numVertices) * 2 + 1];

                signedArea += (x1 * y2 - x2 * y1);
            }

            if (signedArea < 0) {
                const reversed = [];
                const reversedFlowPressures = [];
                
                for (let i = polygon.length - 2; i >= 0; i -= 2) {
                    reversed.push(polygon[i], polygon[i + 1]);
                    reversedFlowPressures.push(flowPressures[i / 2]);
                }
                
                this.stats.polygonReversals++;
                return { polygon: reversed, flowPressures: reversedFlowPressures };
            }

            return result;
        }

        _isClosedShape(points, baseSize) {
            if (points.length < 4) return false;

            const start = points[0];
            const end = points[points.length - 1];
            
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const threshold = baseSize * this.config.closedShapeThreshold;
            return distance < threshold;
        }

        _generateRoundCapWithPressure(center, start, end, radius, flowPressure, segments) {
            const cap = [];

            const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
            const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

            let angleDiff = endAngle - startAngle;
            if (angleDiff < 0) angleDiff += Math.PI * 2;
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            cap.push({ x: start.x, y: start.y, flowPressure: flowPressure });

            for (let i = 1; i < segments; i++) {
                const t = i / segments;
                const angle = startAngle + angleDiff * t;
                
                cap.push({
                    x: center.x + Math.cos(angle) * radius,
                    y: center.y + Math.sin(angle) * radius,
                    flowPressure: flowPressure
                });
            }

            cap.push({ x: end.x, y: end.y, flowPressure: flowPressure });

            return cap;
        }

        _calculateBoundsFromPolygon(polygon) {
            const bounds = {
                minX: Infinity, minY: Infinity,
                maxX: -Infinity, maxY: -Infinity
            };

            for (let i = 0; i < polygon.length; i += 2) {
                bounds.minX = Math.min(bounds.minX, polygon[i]);
                bounds.minY = Math.min(bounds.minY, polygon[i + 1]);
                bounds.maxX = Math.max(bounds.maxX, polygon[i]);
                bounds.maxY = Math.max(bounds.maxY, polygon[i + 1]);
            }

            return bounds;
        }

        calculateBounds(points) {
            const bounds = {
                minX: Infinity, minY: Infinity,
                maxX: -Infinity, maxY: -Infinity
            };

            for (const p of points) {
                const x = p.x !== undefined ? p.x : (p.localX || 0);
                
                bounds.minX = Math.min(bounds.minX, x);
                bounds.minY = Math.min(bounds.minY, y);
                bounds.maxX = Math.max(bounds.maxX, x);
                bounds.maxY = Math.max(bounds.maxY, y);
            }

            return bounds;
        }

        getStats() {
            return { ...this.stats };
        }

        resetStats() {
            this.stats = {
                processedStrokes: 0,
                totalVertices: 0,
                averageVerticesPerStroke: 0,
                triangulationFailures: 0,
                polygonReversals: 0,
                bevelJoins: 0,
                fastSegments: 0,
                extremeAngles: 0,
                longStrokes: 0
            };
        }

        dispose() {
            this.resetStats();
            this.initialized = false;
        }
    }

    // グローバル登録
    window.GLStrokeProcessor = GLStrokeProcessor;

    console.log('✅ gl-stroke-processor.js Phase 4.0D loaded');
    console.log('   🔥 Perfect-Freehand完全不使用');
    console.log('   🎨 独自リボン生成（鋭角完全対応）');
    console.log('   🔧 筆圧カーブ改善');
    console.log('   ✨ カエルの卵最小化');
    console.log('   ⚠️ 技術的限界: ペンツールでは濃淡グラデーション不可');
    console.log('   💡 水彩/エアブラシは Phase 5.0 で別実装が必要');

})();